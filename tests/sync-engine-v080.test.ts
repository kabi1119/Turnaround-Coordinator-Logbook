import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { SyncEngine } from '../src/sync/engine';
import { openVault, emptyAccountDatabase } from '../src/workspaces/vault';
import { guestStore } from '../src/workspaces/store';
import { emptyAircraft } from '../src/domain/model';
import type { Database } from '../src/domain/model';
import type { CloudTransport, KeyEnvelope, CipherRecord, Pull } from '../src/sync/types';
import { SyncError } from '../src/sync/types';
import { pending } from '../src/sync/records';
import { recordKey } from '../src/sync/crypto';
import { seedDatabase } from '../src/data/seed';
const A = '80000000-0000-4000-8000-000000000001',
  secret = 'long unique fictional cloud passphrase';
class MemoryStorage implements Storage {
  map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(n: number) {
    return [...this.map.keys()][n] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}
class Server implements CloudTransport {
  envelope: KeyEnvelope | null = null;
  revision = 0;
  rows = new Map<string, CipherRecord>();
  fail = false;
  loseAck = false;
  pushes = 0;
  async pull(cursor: number): Promise<Pull> {
    if (this.fail) throw new SyncError('network');
    const rows = [...this.rows.values()].filter((r) => r.revision > cursor);
    return structuredClone({
      version: 1,
      userId: A,
      revision: this.revision,
      envelope: this.envelope,
      records: rows,
      count: rows.length,
      total: this.rows.size,
    });
  }
  async initialize(envelope: KeyEnvelope) {
    if (this.envelope) throw new SyncError('conflict');
    this.envelope = structuredClone(envelope);
  }
  async push(expected: number, _op: string, records: CipherRecord[]) {
    if (this.fail) throw new SyncError('network');
    if (expected !== this.revision) throw new SyncError('conflict');
    this.pushes++;
    for (const r of records) this.rows.set(r.recordId, structuredClone(r));
    this.revision++;
    if (this.loseAck) {
      this.loseAck = false;
      throw new SyncError('network');
    }
    return this.revision;
  }
}
const engines: SyncEngine[] = [];
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: async (_name: string, options: unknown, fn?: (lock: object) => unknown) =>
        typeof options === 'function' ? options({}) : fn!({}),
    },
  });
});
afterEach(() => {
  engines.forEach((e) => e.stop());
  engines.length = 0;
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'locks');
});
async function device(server: Server, db = emptyAccountDatabase(), storage = new MemoryStorage()) {
  const store = await openVault(A, secret, true, storage);
  expect((await store.write(db, store.snapshot())).ok).toBe(true);
  const engine = new SyncEngine(store, A, server, () => true);
  engines.push(engine);
  return { store, engine, storage };
}
const dbWith = (note = 'original') => ({
  ...emptyAccountDatabase(),
  aircraft: [{ ...emptyAircraft('', ''), id: 'fixture-aircraft', notes: note }],
});
async function edit(d: Awaited<ReturnType<typeof device>>, fn: (db: Database) => void) {
  const db = structuredClone(d.store.read().db);
  fn(db);
  expect((await d.store.write(db, d.store.snapshot())).ok).toBe(true);
}
async function enable(d: Awaited<ReturnType<typeof device>>) {
  await d.engine.enable(secret);
  expect(d.engine.snapshot().error).toBe('');
}
async function chooseCloud(d: Awaited<ReturnType<typeof device>>) {
  const conflicts = d.engine.state()!.conflicts;
  if (conflicts.length)
    await d.engine.resolveConflicts(
      Object.fromEntries(conflicts.map((k) => [k, 'cloud'])),
      d.store.snapshot(),
    );
  await d.engine.run();
}
describe('offline encrypted synchronization', () => {
  it('is opt-in, refuses Guest and leaves legacy vault bytes untouched until explicit adoption', async () => {
    const server = new Server(),
      d = await device(server, dbWith());
    const bytes = d.store.snapshot();
    await d.engine.run();
    expect(server.envelope).toBeNull();
    expect(d.store.snapshot()).toBe(bytes);
    expect(() => new SyncEngine(guestStore, A, server)).toThrow();
    await enable(d);
    const adopted = d.store.snapshot();
    expect(adopted).not.toContain('original');
    d.engine.stop();
    d.store.lock();
    const reopened = await openVault(A, secret, false, d.storage);
    expect(reopened.read().db).toEqual(dbWith());
    expect(reopened.sync!.read()!.enabled).toBe(true);
    reopened.lock();
  });
  it('synchronizes two devices incrementally, preserving original IDs, links, all fields and device language', async () => {
    const server = new Server(),
      db = seedDatabase(),
      a = await device(server, db);
    await enable(a);
    const b = await device(server, { ...emptyAccountDatabase('zh-HK') });
    await enable(b);
    await chooseCloud(b);
    expect({
      ...b.store.read().db,
      settings: { ...b.store.read().db.settings, language: db.settings.language },
    }).toEqual(db);
    await edit(a, (d) => {
      d.aircraft[0].notes = 'one new edit';
    });
    const push = vi.spyOn(server, 'push');
    await a.engine.run();
    expect(push.mock.calls[0][2]).toHaveLength(1);
    await b.engine.run();
    expect(b.store.read().db.aircraft[0].notes).toBe('one new edit');
    expect(b.store.read().db.settings.language).toBe('zh-HK');
    expect(b.engine.snapshot().phase).toBe('synced');
  });
  it('keeps one initial encrypted privacy record, and restores saved cloud preferences through explicit review instead of uploading fresh defaults', async () => {
    const server = new Server();
    const db = emptyAccountDatabase();
    db.settings.privacy = {
      registration: false,
      flights: false,
      bay: false,
      gateTimes: true,
      statuses: false,
      disruptionNotes: false,
    };
    const a = await device(server, db);
    await enable(a);
    expect(server.rows.size).toBe(1);
    expect(server.revision).toBe(1);
    expect(a.engine.state()!.base[0].record).toEqual({
      collection: 'privacy',
      id: 'settings',
      value: db.settings.privacy,
    });
    const originalRows = structuredClone([...server.rows]);
    const b = await device(server);
    expect(Object.values(b.store.read().db.settings.privacy).every(Boolean)).toBe(true);
    await enable(b);
    expect(b.engine.snapshot().phase).toBe('conflict');
    expect(b.engine.state()!.conflicts).toEqual([JSON.stringify(['privacy', 'settings'])]);
    expect(server.pushes).toBe(1);
    expect([...server.rows]).toEqual(originalRows);
    await chooseCloud(b);
    expect(b.store.read().db.settings.privacy).toEqual(db.settings.privacy);
    expect(b.store.read().db.aircraft).toEqual([]);
    expect(b.engine.snapshot().phase).toBe('synced');
    expect(b.engine.snapshot().pending).toBe(0);
    expect(server.revision).toBe(1);
    expect([...server.rows]).toEqual(originalRows);
    b.engine.stop();
    b.store.lock();
    const reopened = await openVault(A, secret, false, b.storage);
    expect(reopened.read().db.settings.privacy).toEqual(db.settings.privacy);
    reopened.lock();
  });
  it('preserves two distinct initial local datasets and requires review for same-ID differences', async () => {
    const server = new Server(),
      a = await device(server, dbWith('A')),
      b = await device(server, dbWith('B'));
    await enable(a);
    await enable(b);
    expect(b.store.read().db.aircraft[0].notes).toBe('B');
    expect(b.engine.snapshot().phase).toBe('conflict');
    expect(
      b.engine.state()!.base.some((x) => (x.record.value as { notes?: string })?.notes === 'A'),
    ).toBe(true);
    await chooseCloud(b);
    expect(b.store.read().db.aircraft[0].notes).toBe('A');
  });
  it('keeps offline create/edit/delete durable through reload and retries only changed records', async () => {
    const server = new Server(),
      a = await device(server, dbWith());
    await enable(a);
    server.fail = true;
    await edit(a, (d) => {
      d.aircraft = [];
      d.journals = [
        { ...seedDatabase().journals[0], id: 'new-offline', dutyId: '', aircraftIds: [] },
      ];
    });
    await a.engine.run();
    expect(a.engine.snapshot().phase).toBe('paused');
    expect(a.engine.snapshot().pending).toBe(2);
    a.engine.stop();
    a.store.lock();
    const store = await openVault(A, secret, false, a.storage),
      engine = new SyncEngine(store, A, server, () => true);
    engines.push(engine);
    expect(engine.snapshot().phase).toBe('locked');
    expect(engine.snapshot().pending).toBe(2);
    server.fail = false;
    await engine.enable(secret);
    expect(engine.snapshot().phase).toBe('synced');
    const b = await device(server);
    await enable(b);
    await chooseCloud(b);
    expect(b.store.read().db.aircraft).toHaveLength(0);
    expect(b.store.read().db.journals[0].id).toBe('new-offline');
  });
  it('recovers an interrupted successful upload without duplicate records or overwriting newer data', async () => {
    const server = new Server(),
      a = await device(server, dbWith());
    await enable(a);
    await edit(a, (d) => {
      d.aircraft[0].notes = 'retry me';
    });
    server.loseAck = true;
    await a.engine.run();
    expect(a.engine.snapshot().pending).toBe(1);
    const n = server.pushes;
    await a.engine.run();
    expect(server.pushes).toBe(n);
    expect(a.engine.snapshot().phase).toBe('synced');
    expect(server.rows.size).toBe(2);
  });
  it('preserves concurrent versions until an explicit reviewed selection, including delete-versus-edit', async () => {
    const server = new Server(),
      a = await device(server, dbWith());
    await enable(a);
    const b = await device(server);
    await enable(b);
    await chooseCloud(b);
    await edit(a, (d) => {
      d.aircraft[0].notes = 'A changed';
    });
    await edit(b, (d) => {
      d.aircraft[0].notes = 'B changed';
    });
    await a.engine.run();
    await b.engine.run();
    expect(b.engine.snapshot().phase).toBe('conflict');
    expect(b.store.read().db.aircraft[0].notes).toBe('B changed');
    const key = recordKey({ collection: 'aircraft', id: 'fixture-aircraft', value: null });
    await b.engine.resolveConflicts({ [key]: 'local' }, b.store.snapshot());
    await b.engine.run();
    await a.engine.run();
    expect(a.store.read().db.aircraft[0].notes).toBe('B changed');
    await edit(a, (d) => {
      d.aircraft = [];
    });
    await edit(b, (d) => {
      d.aircraft[0].notes = 'offline edited';
    });
    await a.engine.run();
    await b.engine.run();
    expect(b.engine.snapshot().phase).toBe('conflict');
    expect(b.store.read().db.aircraft[0].notes).toBe('offline edited');
    await chooseCloud(b);
    expect(b.store.read().db.aircraft).toHaveLength(0);
  });
  it('does not resurrect deletions on an unchanged offline device', async () => {
    const server = new Server(),
      a = await device(server, dbWith());
    await enable(a);
    const b = await device(server);
    await enable(b);
    await chooseCloud(b);
    await edit(a, (d) => {
      d.aircraft = [];
    });
    await a.engine.run();
    await b.engine.run();
    expect(b.store.read().db.aircraft).toHaveLength(0);
    expect(b.engine.snapshot().pending).toBe(0);
  });
  it('rejects unsupported, corrupted, truncated or wrong-account responses without changing valid local records', async () => {
    const server = new Server(),
      a = await device(server, dbWith());
    await enable(a);
    const pull = server.pull.bind(server);
    for (const mutation of [
      (p: Pull) => ({ ...p, version: 2 }),
      (p: Pull) => ({ ...p, userId: 'other' }),
      (p: Pull) => ({ ...p, count: 100 }),
      (p: Pull) => ({ ...p, revision: p.revision + 1, records: [] }),
    ]) {
      const before = a.store.snapshot();
      vi.spyOn(server, 'pull').mockImplementation(async (c) => mutation(await pull(c)) as Pull);
      await a.engine.run();
      expect(a.store.snapshot()).toBe(before);
      expect(a.engine.snapshot().phase).toBe('paused');
      vi.restoreAllMocks();
    }
  });
  it('stops stale requests after vault lock or disable; never acknowledges into another account', async () => {
    const server = new Server(),
      a = await device(server, dbWith());
    await enable(a);
    let release!: (value: Pull) => void;
    const response = await server.pull(a.engine.state()!.cursor);
    vi.spyOn(server, 'pull').mockReturnValue(
      new Promise((r) => {
        release = r;
      }),
    );
    const before = a.store.snapshot();
    const request = a.engine.run();
    await Promise.resolve();
    a.store.lock();
    release(response);
    await request;
    expect(a.store.snapshot()).toBe(before);
    expect(() => a.store.read()).toThrow();
  });
  it('protects newer local edits made during a download and reports stale/quota writes without claiming Synced', async () => {
    const server = new Server(),
      a = await device(server, dbWith());
    await enable(a);
    let release!: (value: Pull) => void;
    const response = await server.pull(a.engine.state()!.cursor);
    const spy = vi.spyOn(server, 'pull').mockReturnValue(
      new Promise((r) => {
        release = r;
      }),
    );
    const request = a.engine.run();
    await Promise.resolve();
    await edit(a, (d) => {
      d.aircraft[0].notes = 'new while downloading';
    });
    release(response);
    await request;
    spy.mockRestore();
    expect(a.store.read().db.aircraft[0].notes).toBe('new while downloading');
    expect(a.engine.snapshot().phase).toBe('paused');
    const before = a.store.snapshot();
    vi.spyOn(a.storage, 'setItem').mockImplementation(() => {
      throw Error('quota');
    });
    await a.engine.run();
    expect(a.store.snapshot()).toBe(before);
    expect(a.engine.snapshot().error).toBe('local');
  });
  it('keeps pending edits on disable, does not upload again, and safely reconciles on re-enable', async () => {
    const server = new Server(),
      a = await device(server, dbWith());
    await enable(a);
    await edit(a, (d) => {
      d.aircraft[0].notes = 'pending';
    });
    await a.engine.disable();
    const n = server.pushes;
    await a.engine.run();
    expect(server.pushes).toBe(n);
    expect(a.engine.state()!.enabled).toBe(false);
    expect(pending(a.store.read().db, a.engine.state()!)).toHaveLength(1);
    await enable(a);
    expect(a.engine.snapshot().phase).toBe('synced');
  });
  it('requires Web Locks and defers synchronization while another editor is open', async () => {
    const server = new Server(),
      a = await device(server, dbWith());
    Reflect.deleteProperty(navigator, 'locks');
    await a.engine.enable(secret);
    expect(server.envelope).toBeNull();
    expect(a.engine.snapshot().error).toBe('locks');
  });
});

it('preserves rapid edits while an earlier upload is being acknowledged', async () => {
  const server = new Server(),
    a = await device(server, dbWith());
  await enable(a);
  await edit(a, (d) => {
    d.aircraft[0].notes = 'first';
  });
  const original = server.push.bind(server);
  vi.spyOn(server, 'push').mockImplementationOnce(async (expected, op, rows) => {
    const revision = await original(expected, op, rows);
    await edit(a, (d) => {
      d.aircraft[0].notes = 'second';
    });
    return revision;
  });
  await a.engine.run();
  expect(a.store.read().db.aircraft[0].notes).toBe('second');
  expect(a.engine.snapshot().phase).toBe('pending');
  expect(a.engine.snapshot().conflicts).toBe(0);
  await a.engine.run();
  expect(a.engine.snapshot().phase).toBe('synced');
});
it('preserves local work when the server wins a CAS race and retries into explicit conflict review', async () => {
  const server = new Server(),
    a = await device(server, dbWith());
  await enable(a);
  const b = await device(server);
  await enable(b);
  await chooseCloud(b);
  await edit(a, (d) => {
    d.aircraft[0].notes = 'A';
  });
  await edit(b, (d) => {
    d.aircraft[0].notes = 'B';
  });
  const original = server.push.bind(server);
  let raced = false;
  vi.spyOn(server, 'push').mockImplementation(async (expected, op, rows) => {
    if (!raced) {
      raced = true;
      await b.engine.run();
    }
    return original(expected, op, rows);
  });
  await a.engine.run();
  expect(a.engine.snapshot().error).toBe('conflict');
  expect(a.store.read().db.aircraft[0].notes).toBe('A');
  await a.engine.run();
  expect(a.engine.snapshot().phase).toBe('conflict');
});
it('blocks graph-breaking resolution and retains all local records and remote alternatives', async () => {
  const server = new Server(),
    a = await device(server, seedDatabase());
  await enable(a);
  const b = await device(server);
  await enable(b);
  await chooseCloud(b);
  const target = a.store.read().db.duties[0].id;
  await edit(a, (d) => {
    d.aircraft = d.aircraft.filter((x) => x.dutyId !== target);
    d.journals = d.journals.filter(
      (x) =>
        x.dutyId !== target && !x.aircraftIds.some((id) => !d.aircraft.some((a) => a.id === id)),
    );
    d.duties = d.duties.filter((x) => x.id !== target);
  });
  await edit(b, (d) => {
    d.aircraft.find((x) => x.dutyId === target)!.notes = 'offline linked change';
  });
  await a.engine.run();
  await b.engine.run();
  expect(b.engine.snapshot().phase).toBe('conflict');
  const before = b.store.snapshot(),
    state = b.engine.state()!;
  const choices = Object.fromEntries(
    state.conflicts.map((k) => [k, k.includes('duties') ? 'cloud' : 'local']),
  ) as Record<string, 'local' | 'cloud'>;
  await expect(b.engine.resolveConflicts(choices, before)).rejects.toThrow();
  expect(b.store.snapshot()).toBe(before);
  expect(b.engine.state()!.conflicts).toEqual(state.conflicts);
});
it('defers record integration while an editor is open', async () => {
  const server = new Server(),
    a = await device(server, dbWith());
  await enable(a);
  let safe = true;
  const e = new SyncEngine(a.store, A, server, () => safe);
  engines.push(e);
  await e.enable(secret);
  safe = false;
  const spy = vi.spyOn(server, 'pull');
  await e.run();
  expect(spy).not.toHaveBeenCalled();
  expect(e.snapshot().error).toBe('editing');
});
