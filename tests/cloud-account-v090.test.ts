import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { openAccountCache, accountCacheKey, type AccountStore } from '../src/cloud/cache';
import { AccountEngine, stateFromPull } from '../src/cloud/engine';
import { accountTransport } from '../src/cloud/transport';
import {
  AccountError,
  type AccountOperation,
  type AccountPull,
  type AccountReceipt,
  type AccountTransport,
  type HistoryRow,
  type HistoryResponse,
  type MergeOutcome,
} from '../src/cloud/types';
import { emptyAccountDatabase } from '../src/workspaces/vault';
import { STORAGE_KEY } from '../src/lib/storage';
import { guestStore } from '../src/workspaces/store';
import { emptyAircraft } from '../src/domain/model';
import type { Database } from '../src/domain/model';
import { records, canonical } from '../src/sync/records';
import { recordKey } from '../src/sync/crypto';
import { fingerprint } from '../src/migration/plan';
import { verifyArchive } from '../src/cloud/archive';
import { seedDatabase } from '../src/data/seed';
import {
  requestMerge,
  confirmPreparation,
  confirmFinal,
  bulkDecide,
  selectEligible,
  decide,
} from '../src/migration/plan';
const A = '90000000-0000-4000-8000-000000000001',
  B = '90000000-0000-4000-8000-000000000002',
  W = '90000000-0000-4000-8000-000000000003';
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
class Server implements AccountTransport {
  revision = 1;
  floor = 0;
  rows = new Map(
    records(emptyAccountDatabase()).map((record) => [
      recordKey(record),
      { ...record, revision: 1 },
    ]),
  );
  receipts = new Map<string, { hash: string; receipt: AccountReceipt }>();
  retired = new Map<string, { hash: string; expected: number }>();
  historyRows: HistoryRow[] = [];
  fail = false;
  failPush = false;
  loseAck = false;
  pushes = 0;
  pulls = 0;
  beforeReply: (() => Promise<void>) | null = null;
  async pull(cursor: number): Promise<AccountPull> {
    this.pulls++;
    if (cursor > 0 && cursor < this.floor) throw new AccountError('archived');
    if (this.fail) throw new AccountError('network');
    const list = [...this.rows.values()].filter((r) => r.revision > cursor);
    return structuredClone({
      version: 2,
      userId: A,
      workspaceId: W,
      established: true,
      legacyRevision: null,
      revision: this.revision,
      replayFloor: this.floor,
      records: list,
      count: list.length,
      total: this.rows.size,
    });
  }
  async prepareArchive() {
    const text = JSON.stringify({
      kind: 'tco-account-history-archive',
      version: 1,
      userId: A,
      workspaceId: W,
      revision: this.revision,
      previousFloor: this.floor,
      records: [...this.rows.values()],
      history: [],
      receipts: [],
    });
    return {
      version: 2 as const,
      userId: A,
      workspaceId: W,
      revision: this.revision,
      text,
      digest: await fingerprint(text),
    };
  }
  async archive(expected: number, digest: string) {
    if (expected !== this.revision || digest !== (await this.prepareArchive()).digest)
      throw new AccountError('conflict');
    this.floor = expected;
    this.receipts.clear();
    for (const [id, r] of this.retired) if (r.expected < expected) this.retired.delete(id);
    return {
      version: 2 as const,
      userId: A,
      workspaceId: W,
      revision: this.revision,
      replayFloor: this.floor,
    };
  }
  async initialize(): Promise<AccountReceipt> {
    throw new AccountError('conflict');
  }
  async history(collection: HistoryRow['collection'], id: string): Promise<HistoryResponse> {
    return structuredClone({
      version: 2,
      userId: A,
      workspaceId: W,
      revision: this.revision,
      replayFloor: this.floor,
      archivedAt: null,
      records: this.historyRows.filter((row) => row.collection === collection && row.id === id),
    });
  }
  async push(op: AccountOperation): Promise<AccountReceipt> {
    if (this.fail || this.failPush) throw new AccountError('network');
    const hash = canonical(op),
      prior = this.receipts.get(op.id);
    if (this.retired.has(op.id)) throw new AccountError('retired');
    if (prior) {
      if (prior.hash !== hash) throw new AccountError('conflict');
      return structuredClone(prior.receipt);
    }
    if (op.expected < this.floor) throw new AccountError('archived');
    if (op.expected !== this.revision) throw new AccountError('conflict');
    this.pushes++;
    this.revision++;
    for (const record of op.changes) {
      const priorRecord = this.rows.get(recordKey(record));
      if (priorRecord)
        this.historyRows.push({
          operationId: op.id,
          collection: record.collection,
          id: record.id,
          previousRevision: priorRecord.revision,
          replacementRevision: this.revision,
          value: structuredClone(priorRecord.value),
          createdAt: new Date().toISOString(),
        });
      this.rows.set(recordKey(record), { ...structuredClone(record), revision: this.revision });
    }
    const receipt: AccountReceipt = {
      version: 2,
      userId: A,
      workspaceId: W,
      operationId: op.id,
      revision: this.revision,
    };
    this.receipts.set(op.id, { hash, receipt });
    if (this.beforeReply) await this.beforeReply();
    if (this.loseAck) {
      this.loseAck = false;
      throw new AccountError('network');
    }
    return structuredClone(receipt);
  }
  async mergeOutcome(op: AccountOperation, retire: boolean): Promise<MergeOutcome> {
    if (this.fail) throw new AccountError('network');
    const prior = this.receipts.get(op.id),
      closed = this.retired.get(op.id),
      hash = canonical(op);
    if ((prior && prior.hash !== hash) || (closed && closed.hash !== hash))
      throw new AccountError('conflict');
    let outcome: MergeOutcome['outcome'] = prior
      ? 'committed'
      : closed
        ? 'retired'
        : op.expected < this.floor
          ? 'expired'
          : 'missing';
    if (outcome === 'missing' && retire) {
      this.retired.set(op.id, { hash, expected: op.expected });
      outcome = 'retired';
    }
    return {
      version: 2,
      userId: A,
      workspaceId: W,
      operationId: op.id,
      expected: op.expected,
      revision: this.revision,
      replayFloor: this.floor,
      outcome,
      operationRevision: prior?.receipt.revision ?? (outcome === 'retired' ? op.expected : null),
    };
  }
  async editOutcome(op: AccountOperation, retire: boolean) {
    return this.mergeOutcome(op, retire);
  }
}
const engines: AccountEngine[] = [];
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  localStorage.removeItem(STORAGE_KEY);
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: async (_name: string, options: unknown, fn?: (value: object) => unknown) =>
        typeof options === 'function' ? options({}) : fn!({}),
    },
  });
});
afterEach(() => {
  localStorage.removeItem(STORAGE_KEY);
  engines.forEach((e) => e.stop());
  engines.length = 0;
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'locks');
});
async function device(server: Server, storage = new MemoryStorage(), identity = () => A) {
  const initial = stateFromPull(await server.pull(0), A);
  const store = await openAccountCache(A, W, initial, identity, storage);
  const engine = new AccountEngine(store, server, () => true);
  engines.push(engine);
  return { store, engine, storage };
}
async function edit(store: AccountStore, fn: (db: Database) => void) {
  const current = store.read();
  fn(current.db);
  expect((await store.write(current.db, current.snapshot)).ok).toBe(true);
}
const newRecord = (id = 'fixture') => ({ ...emptyAircraft('', ''), id, notes: 'original' });
async function queuedGuest(server = new Server(), provided?: Database) {
  const d = await device(server),
    source = provided ? (JSON.parse(JSON.stringify(provided)) as Database) : emptyAccountDatabase();
  if (!provided) source.aircraft.push(newRecord('guest-original'));
  const raw = JSON.stringify(source),
    destination = d.store.read().db;
  localStorage.setItem(STORAGE_KEY, raw);
  let review = confirmPreparation(
    await requestMerge({
      source,
      destination,
      sourceSnapshot: raw,
      userId: A,
      workspaceId: W,
      revision: server.revision,
    }),
    A,
  );
  if (provided)
    for (const item of review.items)
      review = decide(review, item.key, { choice: 'local', target: item.targets[0] }, A);
  const plan = await confirmFinal(
    review,
    {
      userId: A,
      workspaceId: W,
      sourceSnapshot: raw,
      destination,
      revision: server.revision,
    },
    !!provided,
  );
  await d.engine.queueMerge(plan, raw);
  return { ...d, server, source, raw, plan, original: d.engine.state().operation! };
}
async function legacyLater(
  d: Awaited<ReturnType<typeof queuedGuest>>,
  change: (db: Database) => void,
) {
  const current = d.store.read();
  change(current.db);
  expect(
    (
      await d.store.account.write(
        JSON.parse(JSON.stringify(current.db)),
        d.engine.state(),
        current.snapshot,
      )
    ).ok,
  ).toBe(true);
}
async function keepLater(d: { engine: AccountEngine }, choice: 'cloud' | 'local' = 'local') {
  for (const row of d.engine.mixedEditRows())
    await d.engine.saveMixedDecision(row.key, { choice }, d.engine.state().mixed!.id);
}
describe('mixed legacy Guest queue and separately approved Account edits', () => {
  async function recordedAccountOperation(committed: boolean, revertAfter = false) {
    const d = await queuedGuest();
    await d.server.push(d.original);
    const fresh = stateFromPull(await d.server.pull(0), A);
    const queuedValue = { ...fresh.db.aircraft[0], notes: 'recorded intermediate Account intent' };
    const op: AccountOperation = {
      id: crypto.randomUUID(),
      expected: 2,
      purpose: 'edit',
      changes: [{ collection: 'aircraft', id: queuedValue.id, value: queuedValue }],
    };
    const later = structuredClone(fresh.db);
    later.aircraft[0].notes = revertAfter ? 'original' : 'final local intent';
    expect(
      (
        await d.store.account.write(
          later,
          { ...fresh.state, operation: op, merge: d.plan },
          d.store.snapshot(),
        )
      ).ok,
    ).toBe(true);
    if (committed) await d.server.push(op);
    return { ...d, retainedOp: op };
  }
  it('verifies a distinct recorded Account UUID after the original Guest receipt and preserves a subsequent local reversion', async () => {
    const d = await recordedAccountOperation(true, true),
      raw = d.store.snapshot();
    await d.engine.verifyGuestSubmission();
    expect(d.engine.state().mixed).toMatchObject({
      outcome: 'committed',
      stage: 'awaiting-cloud',
      originalCache: raw,
    });
    expect(d.engine.state().operation?.id).toBe(d.retainedOp.id);
    await d.engine.resolveRetainedAccountOperation(d.engine.recoveryBackup(), d.store.snapshot());
    expect(d.engine.state().mixed?.retained).toMatchObject({
      id: d.retainedOp.id,
      outcome: 'committed',
    });
    expect(d.engine.mixedEditRows()[0].candidate).toMatchObject({ notes: 'original' });
    await keepLater(d);
    await d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, true);
    expect(d.store.read().db.aircraft[0].notes).toBe('original');
    expect(d.server.pushes).toBe(3);
    expect(d.engine.state().mixed!.originalCache).toContain(d.retainedOp.id);
  });
  it('retires only an uncommitted recorded Account operation before separate reconciliation', async () => {
    const d = await recordedAccountOperation(false);
    await d.engine.verifyGuestSubmission();
    await d.engine.resolveRetainedAccountOperation(d.engine.recoveryBackup(), d.store.snapshot());
    expect(d.engine.state().mixed?.retained).toMatchObject({
      id: d.retainedOp.id,
      outcome: 'retired',
    });
    await expect(d.server.push(d.retainedOp)).rejects.toThrow('retired');
    expect(d.engine.mixedEditRows()[0].candidate).toMatchObject({ notes: 'final local intent' });
    await keepLater(d);
    await d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, true);
    expect(d.server.pushes).toBe(2);
    expect(d.store.read().db.aircraft[0].notes).toBe('final local intent');
  });
  it('resumes after a retained Account receipt was acknowledged but the following full download failed', async () => {
    const d = await recordedAccountOperation(true);
    await d.engine.verifyGuestSubmission();
    const query = d.server.editOutcome.bind(d.server);
    d.server.editOutcome = async (...args) => {
      const result = await query(...args);
      d.server.fail = true;
      return result;
    };
    await expect(
      d.engine.resolveRetainedAccountOperation(d.engine.recoveryBackup(), d.store.snapshot()),
    ).rejects.toThrow('network');
    expect(d.engine.state().mixed?.retained).toMatchObject({
      id: d.retainedOp.id,
      outcome: 'committed',
    });
    expect(d.engine.state().operation).toBeNull();
    d.engine.stop();
    d.store.lock();
    d.server.fail = false;
    d.server.editOutcome = query;
    const reopened = await device(d.server, d.storage);
    await reopened.engine.resolveRetainedAccountOperation(
      reopened.engine.recoveryBackup(),
      reopened.store.snapshot(),
    );
    expect(reopened.engine.state().mixed?.stage).toBe('account-review');
    expect(d.server.pushes).toBe(2);
    expect(reopened.engine.mixedEditRows()[0].candidate).toMatchObject({
      notes: 'final local intent',
    });
  });
  it('cancels only an unsent merge, retains two independent edits and requires separate approval', async () => {
    const server = new Server();
    for (const id of ['a', 'b'])
      server.rows.set(recordKey({ collection: 'aircraft', id, value: null }), {
        collection: 'aircraft',
        id,
        value: newRecord(id),
        revision: 1,
      });
    const d = await queuedGuest(server);
    await legacyLater(d, (db) => {
      db.aircraft.find((r) => r.id === 'a')!.notes = 'later A';
      db.aircraft.find((r) => r.id === 'b')!.notes = 'later B';
    });
    const exactCache = d.store.snapshot();
    await d.engine.cancelQueuedGuest(d.engine.recoveryBackup(), d.store.snapshot());
    expect(d.engine.state().mixed).toMatchObject({
      stage: 'awaiting-cloud',
      outcome: 'unsent',
      originalCache: exactCache,
    });
    expect(JSON.parse(d.store.snapshot()!).version).toBe(2);
    expect(JSON.parse(d.engine.state().mixed!.originalCache).version).toBe(1);
    expect(d.store.read().db.aircraft).toHaveLength(3);
    await d.engine.loadMixedCloud(d.engine.recoveryBackup(), d.store.snapshot());
    expect(d.engine.mixedEditRows()).toHaveLength(2);
    expect(d.engine.state().operation).toBeNull();
    expect(server.pushes).toBe(0);
    for (const row of d.engine.mixedEditRows())
      await d.engine.saveMixedDecision(
        row.key,
        { choice: row.id === 'a' ? 'local' : 'cloud' },
        d.engine.state().mixed!.id,
      );
    await expect(
      d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), false, true),
    ).rejects.toThrow('local');
    await d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, true);
    expect(d.engine.state().mixed?.stage).toBe('complete');
    expect(d.store.read().db.aircraft.find((r) => r.id === 'a')!.notes).toBe('later A');
    expect(d.store.read().db.aircraft.find((r) => r.id === 'b')!.notes).toBe('original');
    expect(server.pushes).toBe(1);
    expect(server.receipts.has(d.original.id)).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw);
  });
  it('resolves a lost original commit first and reviews later edits to the same imported record', async () => {
    const d = await queuedGuest();
    await legacyLater(d, (db) => {
      db.aircraft[0].notes = 'later Account edit';
    });
    await d.server.push(d.original);
    await d.engine.verifyGuestSubmission();
    expect(d.engine.state().mixed).toMatchObject({
      stage: 'account-review',
      outcome: 'committed',
      originalOperationId: d.original.id,
    });
    expect(d.store.read().db.aircraft[0].notes).toBe('original');
    expect(d.engine.mixedEditRows()[0]).toMatchObject({
      kind: 'Guest-imported record',
      candidate: { notes: 'later Account edit' },
    });
    expect(d.engine.snapshot().phase).not.toBe('synced');
    await keepLater(d);
    await d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, true);
    expect(d.server.pushes).toBe(2);
    expect(d.server.rows.size).toBe(2);
    expect(d.store.read().db.aircraft[0].notes).toBe('later Account edit');
    await d.engine.run();
    expect(d.server.pushes).toBe(2);
  });
  it('applies only the post-merge field intent and preserves concurrent Cloud fields on a replaced record', async () => {
    const source = emptyAccountDatabase(),
      a = {
        ...newRecord('guest'),
        date: '2026-10-28',
        airline: 'Cathay Pacific',
        variant: 'A350-1000',
        handling: 'Arrival Only' as const,
        arrival: { ...newRecord().arrival, flight: 'CX0402' },
        notes: 'Guest reviewed baseline',
      };
    source.aircraft.push(a);
    const server = new Server(),
      cloud = {
        ...structuredClone(a),
        id: 'cloud',
        arrival: { ...a.arrival, flight: 'CX402' },
        notes: 'old Account',
      };
    server.rows.set(recordKey({ collection: 'aircraft', id: 'cloud', value: cloud }), {
      collection: 'aircraft',
      id: 'cloud',
      value: cloud,
      revision: 1,
    });
    const d = await queuedGuest(server, source);
    await legacyLater(d, (db) => {
      db.aircraft.find((r) => r.id === 'cloud')!.notes = 'later only';
    });
    await server.push(d.original);
    const laterCloud = {
      ...d.plan.queuedResult!.aircraft.find((r) => r.id === 'cloud')!,
      registration: 'Cloud retained field',
    };
    await server.push({
      id: crypto.randomUUID(),
      expected: 2,
      purpose: 'edit',
      changes: [{ collection: 'aircraft', id: 'cloud', value: laterCloud }],
    });
    await d.engine.verifyGuestSubmission();
    expect(d.engine.mixedEditRows()[0].candidate).toMatchObject({
      notes: 'later only',
      registration: 'Cloud retained field',
      arrival: { flight: 'CX0402' },
    });
    await keepLater(d);
    await expect(
      d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, false),
    ).rejects.toThrow('conflict');
    await d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, true);
    expect(d.store.read().db.aircraft[0].registration).toBe('Cloud retained field');
  });
  it('retains later tombstones and rejects a partial decision that would break a linked graph', async () => {
    const server = new Server(),
      duty = { ...seedDatabase().duties[0], id: 'd', notes: 'existing', status: 'Draft' as const };
    const a = { ...newRecord('a'), dutyId: 'd' };
    for (const row of [
      { collection: 'duties' as const, id: 'd', value: duty },
      { collection: 'aircraft' as const, id: 'a', value: a },
    ])
      server.rows.set(recordKey(row), { ...row, revision: 1 });
    const d = await queuedGuest(server);
    await legacyLater(d, (db) => {
      db.duties = [];
      db.aircraft.find((r) => r.id === 'a')!.dutyId = '';
    });
    await server.push(d.original);
    await d.engine.verifyGuestSubmission();
    for (const row of d.engine.mixedEditRows())
      await d.engine.saveMixedDecision(
        row.key,
        { choice: row.collection === 'duties' ? 'local' : 'cloud' },
        d.engine.state().mixed!.id,
      );
    await expect(
      d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, true),
    ).rejects.toThrow();
    expect(server.pushes).toBe(1);
    await keepLater(d);
    await d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, true);
    expect(
      server.rows.get(recordKey({ collection: 'duties', id: 'd', value: null }))!.value,
    ).toBeNull();
    expect(d.store.read().db.aircraft.find((r) => r.id === 'a')!.dutyId).toBe('');
  });
  it('re-reviews expired Guest data first, then remaps later Journal references to the new imported identity', async () => {
    const d = await queuedGuest();
    await legacyLater(d, (db) => {
      db.journals.push({
        ...seedDatabase().journals[0],
        id: 'later-journal',
        dutyId: '',
        originalDutyId: undefined,
        aircraftIds: ['guest-original'],
      });
    });
    await d.server.push({
      id: crypto.randomUUID(),
      expected: 1,
      purpose: 'edit',
      changes: [
        {
          collection: 'aircraft',
          id: 'guest-original',
          value: { ...newRecord('guest-original'), notes: 'unrelated Cloud identity' },
        },
      ],
    });
    const archive = await d.server.prepareArchive();
    await d.server.archive(2, archive.digest);
    await d.engine.reviewUpdatedGuest(d.engine.recoveryBackup(), d.store.snapshot());
    expect(d.engine.state().mixed?.stage).toBe('guest-review');
    let plan = confirmPreparation(
      await requestMerge({
        source: d.source,
        destination: d.store.read().db,
        sourceSnapshot: d.raw,
        userId: A,
        workspaceId: W,
        revision: 2,
      }),
      A,
    );
    for (const item of plan.items)
      plan = decide(plan, item.key, { choice: 'manual', separate: true }, A);
    await d.engine.saveMergeReview(plan, d.raw);
    const approved = await confirmFinal(
      plan,
      {
        userId: A,
        workspaceId: W,
        sourceSnapshot: d.raw,
        destination: d.store.read().db,
        revision: 2,
      },
      true,
    );
    await d.engine.queueMerge(approved, d.raw);
    await d.engine.run();
    expect(d.engine.state().mixed?.stage).toBe('account-review');
    const imported = approved.mappings.aircraft['$guest-original'];
    expect(imported).not.toBe('guest-original');
    expect(d.engine.mixedEditRows()[0].candidate).toMatchObject({ aircraftIds: [imported] });
    await keepLater(d);
    await d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, true);
    expect(d.store.read().db.journals[0].aircraftIds).toEqual([imported]);
    expect(d.server.rows.size).toBe(4);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw);
  });
  it('persists review decisions over reload and invalidates all approval when Cloud changes', async () => {
    const d = await queuedGuest();
    await legacyLater(d, (db) => {
      db.aircraft[0].notes = 'later';
    });
    await d.server.push(d.original);
    await d.engine.verifyGuestSubmission();
    await keepLater(d);
    const originalBytes = d.engine.state().mixed!.originalCache;
    d.engine.stop();
    d.store.lock();
    const reopened = await device(d.server, d.storage);
    expect(Object.keys(reopened.engine.state().mixed!.decisions)).toHaveLength(1);
    const before = reopened.engine.recoveryBackup(),
      snapshot = reopened.store.snapshot();
    const changed = { ...d.source.aircraft[0], notes: 'concurrent Cloud' };
    await d.server.push({
      id: crypto.randomUUID(),
      expected: 2,
      purpose: 'edit',
      changes: [{ collection: 'aircraft', id: changed.id, value: changed }],
    });
    await expect(reopened.engine.approveMixed(before, snapshot, true, true)).rejects.toThrow(
      'conflict',
    );
    expect(reopened.engine.state().mixed!.decisions).toEqual({});
    expect(
      reopened.engine.state().mixed!.history.some((h) => Object.keys(h.decisions).length === 1),
    ).toBe(true);
    expect(reopened.engine.state().mixed!.originalCache).toBe(originalBytes);
    expect(reopened.engine.state().operation).toBeNull();
  });
  it('rebinds later Duty, Journal and Aircraft references after a complete renewed Guest review', async () => {
    const source = emptyAccountDatabase();
    source.duties.push({ ...seedDatabase().duties[0], id: 'sd' });
    source.aircraft.push({
      ...newRecord('g'),
      dutyId: 'sd',
      events: [
        {
          id: 'event',
          category: 'Other Operational',
          involvement: 'Observed',
          resolution: 'Resolved',
          notes: '',
          journalId: 'sj',
        },
      ],
    });
    source.journals.push({
      ...seedDatabase().journals[0],
      id: 'sj',
      dutyId: 'sd',
      originalDutyId: undefined,
      aircraftIds: ['g'],
    });
    const d = await queuedGuest(new Server(), source);
    await legacyLater(d, (db) => {
      db.aircraft[0].notes = 'later same aircraft';
      db.journals.push({ ...source.journals[0], id: 'later-j', title: 'Later Account entry' });
    });
    const unrelated = emptyAccountDatabase();
    unrelated.duties.push({ ...source.duties[0], notes: 'unrelated Cloud duty' });
    unrelated.aircraft.push(newRecord('g'));
    unrelated.journals.push({
      ...source.journals[0],
      dutyId: '',
      aircraftIds: [],
      title: 'unrelated Cloud journal',
    });
    await d.server.push({
      id: crypto.randomUUID(),
      expected: 1,
      purpose: 'edit',
      changes: records(unrelated),
    });
    const archive = await d.server.prepareArchive();
    await d.server.archive(2, archive.digest);
    await d.engine.reviewUpdatedGuest(d.engine.recoveryBackup(), d.store.snapshot());
    let review = confirmPreparation(
      await requestMerge({
        source: d.source,
        destination: d.store.read().db,
        sourceSnapshot: d.raw,
        userId: A,
        workspaceId: W,
        revision: 2,
      }),
      A,
    );
    for (const item of review.items)
      review = decide(review, item.key, { choice: 'manual', separate: true }, A);
    await d.engine.saveMergeReview(review, d.raw);
    const approved = await confirmFinal(
      review,
      {
        userId: A,
        workspaceId: W,
        sourceSnapshot: d.raw,
        destination: d.store.read().db,
        revision: 2,
      },
      true,
    );
    await d.engine.queueMerge(approved, d.raw);
    await d.engine.run();
    await keepLater(d);
    await d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, true);
    const db = d.store.read().db,
      g = approved.mappings.aircraft.$g,
      duty = approved.mappings.duties.$sd,
      journal = approved.mappings.journals.$sj;
    expect(db.journals.find((r) => r.id === 'later-j')).toMatchObject({
      dutyId: duty,
      aircraftIds: [g],
    });
    expect(db.aircraft.find((r) => r.id === g)!.events[0].journalId).toBe(journal);
    expect(db.aircraft.find((r) => r.id === 'g')!.notes).toBe('original');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw);
  });
  it('recovers a lost acknowledgement of the separately approved later operation using its exact UUID', async () => {
    const d = await queuedGuest();
    await legacyLater(d, (db) => {
      db.aircraft[0].notes = 'later';
    });
    await d.server.push(d.original);
    await d.engine.verifyGuestSubmission();
    await keepLater(d);
    const id = d.engine.state().mixed!.operationId;
    d.server.loseAck = true;
    await d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, true);
    expect(d.engine.state().mixed).toMatchObject({ stage: 'queued', delivery: 'unknown' });
    expect(d.engine.state().operation?.id).toBe(id);
    expect(d.engine.snapshot().phase).not.toBe('synced');
    d.engine.stop();
    d.store.lock();
    const reopened = await device(d.server, d.storage);
    await reopened.engine.run();
    expect(reopened.engine.state().mixed?.stage).toBe('complete');
    expect(d.server.pushes).toBe(2);
    expect(d.server.receipts.has(id)).toBe(true);
  });
  it('cannot bypass Guest duplicate confirmation when a retained edit needs an unimported Guest identity', async () => {
    const d = await queuedGuest();
    await legacyLater(d, (db) => {
      db.aircraft[0].notes = 'retained dependent edit';
    });
    await d.engine.reviewUpdatedGuest(d.engine.recoveryBackup(), d.store.snapshot());
    await d.engine.chooseMixedGuestReview(false, d.engine.recoveryBackup(), d.store.snapshot());
    expect(d.engine.mixedEditRows()[0].bound).toBe(false);
    await keepLater(d);
    await expect(
      d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, true),
    ).rejects.toThrow('conflict');
    expect(d.server.pushes).toBe(0);
    await keepLater(d, 'cloud');
    await d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, true);
    expect(d.engine.state().mixed?.stage).toBe('complete');
    expect(d.store.read().db.aircraft).toHaveLength(0);
    expect(d.engine.state().mixed!.originalCache).toContain('retained dependent edit');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw);
  });
  it('uses the changed Guest source for renewed approval while retaining older later-Account intent separately', async () => {
    const d = await queuedGuest();
    await legacyLater(d, (db) => {
      db.aircraft[0].notes = 'retained later intent';
    });
    const changed = structuredClone(d.source);
    changed.aircraft[0].notes = 'new Guest source';
    const changedRaw = JSON.stringify(changed);
    localStorage.setItem(STORAGE_KEY, changedRaw);
    await d.engine.reviewUpdatedGuest(d.engine.recoveryBackup(), d.store.snapshot());
    const stale = confirmPreparation(
      await requestMerge({
        source: d.source,
        destination: d.store.read().db,
        sourceSnapshot: d.raw,
        userId: A,
        workspaceId: W,
        revision: 1,
      }),
      A,
    );
    await expect(d.engine.saveMergeReview(stale, d.raw)).rejects.toThrow('conflict');
    const review = confirmPreparation(
      await requestMerge({
        source: changed,
        destination: d.store.read().db,
        sourceSnapshot: changedRaw,
        userId: A,
        workspaceId: W,
        revision: 1,
      }),
      A,
    );
    await d.engine.saveMergeReview(review, changedRaw);
    const approved = await confirmFinal(review, {
      sourceSnapshot: changedRaw,
      destination: d.store.read().db,
      userId: A,
      workspaceId: W,
      revision: 1,
    });
    await d.engine.queueMerge(approved, changedRaw);
    await d.engine.run();
    expect(d.store.read().db.aircraft[0].notes).toBe('new Guest source');
    expect(d.engine.mixedEditRows()[0].candidate).toMatchObject({ notes: 'retained later intent' });
    expect(d.engine.state().mixed?.stage).toBe('account-review');
    expect(d.server.pushes).toBe(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(changedRaw);
  });
  it('preserves a rejected later operation and renews its review only after a newer authoritative revision fences it', async () => {
    const d = await queuedGuest();
    await legacyLater(d, (db) => {
      db.aircraft[0].notes = 'later';
    });
    await d.server.push(d.original);
    await d.engine.verifyGuestSubmission();
    await keepLater(d);
    d.server.failPush = true;
    await d.engine.approveMixed(d.engine.recoveryBackup(), d.store.snapshot(), true, true);
    const old = d.engine.state().operation!;
    d.server.failPush = false;
    await d.server.push({
      id: crypto.randomUUID(),
      expected: 2,
      purpose: 'edit',
      changes: records(emptyAccountDatabase()),
    });
    await d.engine.renewMixedReview(d.engine.recoveryBackup(), d.store.snapshot());
    expect(d.engine.state().mixed?.stage).toBe('account-review');
    expect(d.engine.state().mixed!.history.some((h) => h.operation?.id === old.id)).toBe(true);
    expect(d.engine.state().operation).toBeNull();
    expect(d.engine.state().mixed!.operationId).not.toBe(old.id);
    expect(d.server.pushes).toBe(2);
  });
});
describe('durable Guest submission recovery', () => {
  it('preserves a pre-patch mixed queue and separates renewed Guest review from later Account edits', async () => {
    const d = await queuedGuest(),
      current = d.store.read();
    current.db.aircraft[0].notes = 'extra local Account edit after the old queue';
    expect((await d.store.account.write(current.db, d.engine.state(), current.snapshot)).ok).toBe(
      true,
    );
    const before = d.engine.recoveryBackup();
    const rawCache = d.store.snapshot();
    await d.engine.reviewUpdatedGuest(before, d.store.snapshot());
    expect(d.engine.state().mixed).toMatchObject({
      stage: 'guest-review',
      originalCache: rawCache,
      originalOperationId: d.original.id,
    });
    expect(d.engine.state().recovery?.db.aircraft[0].notes).toBe(
      'extra local Account edit after the old queue',
    );
    expect(d.server.retired.size).toBe(1);
    expect(d.server.pushes).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw);
  });
  it('survives browser closure during an upload and ignores the late response after locking', async () => {
    const d = await queuedGuest();
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    d.server.beforeReply = async () => {
      entered();
      await blocked;
    };
    const upload = d.engine.run();
    await started;
    expect(d.engine.state().guestDelivery?.phase).toBe('unknown');
    await expect(
      d.engine.cancelQueuedGuest(d.engine.recoveryBackup(), d.store.snapshot()),
    ).rejects.toThrow('local');
    d.engine.stop();
    d.store.lock();
    release();
    await upload;
    const reopened = await device(d.server, d.storage);
    await reopened.engine.verifyGuestSubmission();
    expect(reopened.engine.state().merge?.stage).toBe('verified');
    expect(d.server.pushes).toBe(1);
  });
  it('treats pre-patch queues without transmission metadata as uncertain and never cancellable', async () => {
    const d = await queuedGuest();
    d.engine.stop();
    d.store.lock();
    const raw = JSON.parse(d.storage.getItem(accountCacheKey(A))!);
    delete raw.state.guestDelivery;
    d.storage.setItem(accountCacheKey(A), JSON.stringify(raw));
    const reopened = await device(d.server, d.storage);
    await reopened.engine.run();
    expect(d.server.pushes).toBe(0);
    await expect(
      reopened.engine.cancelQueuedGuest(
        reopened.engine.recoveryBackup(),
        reopened.store.snapshot(),
      ),
    ).rejects.toThrow('conflict');
    await reopened.engine.reviewUpdatedGuest(
      reopened.engine.recoveryBackup(),
      reopened.store.snapshot(),
    );
    expect(reopened.engine.state().recovery?.guestReady).toBe(true);
    expect(d.server.retired.has(d.original.id)).toBe(true);
  });
  it('persists an explicit server CAS rejection from a race after the preflight read', async () => {
    const d = await queuedGuest(),
      originalPush = d.server.push.bind(d.server);
    d.server.push = async (op) => {
      d.server.push = originalPush;
      await originalPush({
        id: crypto.randomUUID(),
        expected: 1,
        purpose: 'edit',
        changes: records(emptyAccountDatabase()),
      });
      return originalPush(op);
    };
    await d.engine.run();
    expect(d.engine.state().guestDelivery?.phase).toBe('rejected');
    expect(d.engine.state().operation).toEqual(d.original);
    await d.engine.reviewUpdatedGuest(d.engine.recoveryBackup(), d.store.snapshot());
    expect(d.engine.state().recovery?.guestReady).toBe(true);
    expect(d.server.pushes).toBe(1);
  });
  it('cancels a provably unsent queue under the sync lock and retains its complete recovery copy', async () => {
    const d = await queuedGuest();
    d.server.fail = true;
    const backup = d.engine.recoveryBackup(),
      snapshot = d.store.snapshot();
    await expect(d.engine.cancelQueuedGuest('wrong-file', snapshot)).rejects.toThrow('conflict');
    await d.engine.cancelQueuedGuest(backup, snapshot);
    expect(d.store.read().db).toEqual(d.plan.destination);
    expect(d.engine.state().operation).toBeNull();
    expect(d.engine.state().recovery?.operation).toEqual(d.original);
    expect(d.server.pushes).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw);
  });
  it('recovers a lost commit response through restarts and never automatically retries an unknown submission', async () => {
    const d = await queuedGuest();
    d.server.loseAck = true;
    await d.engine.run();
    expect(d.engine.state().guestDelivery?.phase).toBe('unknown');
    expect(d.engine.snapshot().phase).not.toBe('synced');
    d.engine.stop();
    d.store.lock();
    const reopened = await device(d.server, d.storage);
    await reopened.engine.run();
    expect(d.server.pushes).toBe(1);
    expect(reopened.engine.state().operation).toEqual(d.original);
    await expect(
      reopened.engine.cancelQueuedGuest(
        reopened.engine.recoveryBackup(),
        reopened.store.snapshot(),
      ),
    ).rejects.toThrow('conflict');
    await reopened.engine.verifyGuestSubmission();
    expect(d.server.pushes).toBe(1);
    expect(reopened.engine.state().merge?.stage).toBe('verified');
    expect(reopened.engine.snapshot().phase).toBe('synced');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw);
  });
  it('retries only the exact original operation after an owner-scoped missing receipt check', async () => {
    const d = await queuedGuest();
    d.server.failPush = true;
    await d.engine.run();
    await d.engine.verifyGuestSubmission();
    expect(d.engine.state().guestDelivery).toMatchObject({ phase: 'unknown', reason: 'missing' });
    expect(d.engine.state().operation).toEqual(d.original);
    d.server.failPush = false;
    await d.engine.retryGuestSubmission();
    expect(d.server.pushes).toBe(1);
    expect(d.server.receipts.has(d.original.id)).toBe(true);
    expect(d.engine.state().merge?.stage).toBe('verified');
  });
  it('never reimports a confirmed commit when a second device edited it after the lost response', async () => {
    const d = await queuedGuest();
    d.server.loseAck = true;
    await d.engine.run();
    const changed = structuredClone(d.source.aircraft[0]);
    changed.notes = 'later device edit';
    await d.server.push({
      id: crypto.randomUUID(),
      expected: 2,
      purpose: 'edit',
      changes: [{ collection: 'aircraft', id: changed.id, value: changed }],
    });
    await d.engine.reviewUpdatedGuest(d.engine.recoveryBackup(), d.store.snapshot());
    expect(d.server.pushes).toBe(2);
    expect(d.engine.state().merge).toMatchObject({ stage: 'verified', verifiedRevision: 2 });
    expect(d.store.read().db.aircraft[0].notes).toBe('later device edit');
  });
  it('retains a durable commit acknowledgement even after its server receipt is manually archived', async () => {
    const d = await queuedGuest();
    d.server.beforeReply = async () => {
      d.server.fail = true;
      d.server.beforeReply = null;
    };
    await d.engine.run();
    expect(d.engine.state().guestDelivery?.phase).toBe('committed');
    expect(d.engine.state().merge?.stage).toBe('queued');
    d.server.fail = false;
    const archive = await d.server.prepareArchive();
    await d.server.archive(2, archive.digest);
    expect(d.server.receipts.has(d.original.id)).toBe(false);
    await d.engine.verifyGuestSubmission();
    expect(d.engine.state().merge).toMatchObject({ stage: 'verified', verifiedRevision: 2 });
    expect(d.server.pushes).toBe(1);
  });
  it('fences a stale original operation and starts a new unresolved review against authoritative Cloud data', async () => {
    const d = await queuedGuest();
    await d.server.push({
      id: crypto.randomUUID(),
      expected: 1,
      purpose: 'edit',
      changes: [{ collection: 'aircraft', id: 'other-device', value: newRecord('other-device') }],
    });
    await d.engine.run();
    expect(d.engine.state().guestDelivery).toMatchObject({
      phase: 'queued',
      reason: 'destination-changed',
    });
    const backup = d.engine.recoveryBackup();
    await expect(d.engine.reviewUpdatedGuest('unverified', d.store.snapshot())).rejects.toThrow(
      'local',
    );
    await d.engine.reviewUpdatedGuest(backup, d.store.snapshot());
    expect(d.engine.state().recovery).toMatchObject({
      guestReady: true,
      stage: 'review',
      operation: d.original,
    });
    expect(d.store.read().db.aircraft.map((r) => r.id)).toEqual(['other-device']);
    await expect(d.server.push(d.original)).rejects.toThrow('retired');
    const next = confirmPreparation(
      await requestMerge({
        source: d.source,
        destination: d.store.read().db,
        sourceSnapshot: d.raw,
        userId: A,
        workspaceId: W,
        revision: 2,
      }),
      A,
    );
    await d.engine.saveMergeReview(next, d.raw);
    expect(d.engine.state().merge?.confirmations.finalAt).toBeNull();
    expect(d.engine.state().merge?.operationId).not.toBe(d.original.id);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw);
  });
  it('requires complete Guest re-review after the replay floor expires and preserves the exact old queue', async () => {
    const d = await queuedGuest();
    d.server.failPush = true;
    await d.engine.run();
    d.server.failPush = false;
    await d.server.push({
      id: crypto.randomUUID(),
      expected: 1,
      purpose: 'edit',
      changes: [{ collection: 'aircraft', id: 'new-cloud', value: newRecord('new-cloud') }],
    });
    const file = await d.server.prepareArchive();
    await d.server.archive(2, file.digest);
    await d.engine.verifyGuestSubmission();
    expect(d.engine.state().guestDelivery?.phase).toBe('expired');
    const backup = d.engine.recoveryBackup();
    await d.engine.reviewUpdatedGuest(backup, d.store.snapshot());
    expect(d.engine.state().recovery?.operation).toEqual(d.original);
    expect(d.engine.state().recovery?.merge).toEqual(d.plan);
    expect(d.engine.state().merge).toBeNull();
    expect(d.engine.snapshot().phase).not.toBe('synced');
    expect(d.server.pushes).toBe(1);
  });
  it('does not let the older expired-device review bypass Guest outcome fencing or new consent', async () => {
    const d = await queuedGuest();
    d.server.failPush = true;
    await d.engine.run();
    d.server.failPush = false;
    await d.server.push({
      id: crypto.randomUUID(),
      expected: 1,
      purpose: 'edit',
      changes: [{ collection: 'aircraft', id: 'new-cloud', value: newRecord('new-cloud') }],
    });
    const archive = await d.server.prepareArchive();
    await d.server.archive(2, archive.digest);
    await d.engine.reviewAfterArchive(d.engine.recoveryBackup());
    expect(d.engine.state().recovery?.guestReady).not.toBe(true);
    const review = confirmPreparation(
      await requestMerge({
        source: d.source,
        destination: d.store.read().db,
        sourceSnapshot: d.raw,
        userId: A,
        workspaceId: W,
        revision: 2,
      }),
      A,
    );
    await expect(d.engine.saveMergeReview(review, d.raw)).rejects.toThrow('conflict');
    await d.engine.reviewUpdatedGuest(d.engine.recoveryBackup(), d.store.snapshot());
    expect(d.engine.state().recovery?.guestReady).toBe(true);
    expect(d.engine.state().operation).toBeNull();
    expect(d.server.pushes).toBe(1);
  });
  it('invalidates a queued approval when Guest bytes change and blocks ordinary edits while unresolved', async () => {
    const d = await queuedGuest();
    const local = d.store.read();
    local.db.aircraft[0].notes = 'unrelated edit';
    expect(await d.store.write(local.db, local.snapshot)).toMatchObject({ ok: false });
    localStorage.setItem(STORAGE_KEY, d.raw + ' ');
    await d.engine.run();
    expect(d.engine.state().guestDelivery).toMatchObject({
      phase: 'queued',
      reason: 'source-changed',
    });
    expect(d.server.pushes).toBe(0);
    await expect(d.engine.retryGuestSubmission()).rejects.toThrow('conflict');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw + ' ');
  });
  it('durably retains retirement if download fails and resumes from the same fenced operation', async () => {
    const d = await queuedGuest();
    const outcome = d.server.mergeOutcome.bind(d.server);
    d.server.mergeOutcome = async (...args) => {
      const result = await outcome(...args);
      d.server.fail = true;
      return result;
    };
    await expect(
      d.engine.reviewUpdatedGuest(d.engine.recoveryBackup(), d.store.snapshot()),
    ).rejects.toThrow('network');
    expect(d.engine.state().guestDelivery?.phase).toBe('retired');
    d.server.fail = false;
    d.server.mergeOutcome = outcome;
    d.engine.stop();
    d.store.lock();
    const reopened = await device(d.server, d.storage);
    await reopened.engine.reviewUpdatedGuest(
      reopened.engine.recoveryBackup(),
      reopened.store.snapshot(),
    );
    expect(reopened.engine.state().recovery?.guestReady).toBe(true);
    expect(d.server.pushes).toBe(0);
  });
  it('fences a late outcome response after account locking and rejects changed-payload operation reuse', async () => {
    const d = await queuedGuest();
    const tampered = structuredClone(d.original);
    tampered.changes[0].value = newRecord('changed');
    await d.server.mergeOutcome(d.original, true);
    await expect(d.server.mergeOutcome(tampered, false)).rejects.toThrow('conflict');
    let release!: (result: MergeOutcome) => void;
    d.server.mergeOutcome = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const result = d.engine.verifyGuestSubmission();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const before = d.storage.getItem(accountCacheKey(A));
    d.engine.stop();
    d.store.lock();
    release({
      version: 2,
      userId: A,
      workspaceId: W,
      operationId: d.original.id,
      expected: 1,
      revision: 1,
      replayFloor: 0,
      outcome: 'retired',
      operationRevision: 1,
    });
    await expect(result).rejects.toThrow('locked');
    expect(d.storage.getItem(accountCacheKey(A))).toBe(before);
  });
});
describe('isolated seamless Account cache and sync foundation', () => {
  it('cancels only an unsubmitted Guest review without modifying either workspace', async () => {
    const server = new Server(),
      d = await device(server),
      source = emptyAccountDatabase();
    source.aircraft.push(newRecord('guest-original'));
    const sourceRaw = JSON.stringify(source),
      before = d.store.read().db;
    localStorage.setItem(STORAGE_KEY, sourceRaw);
    const plan = confirmPreparation(
      await requestMerge({
        source,
        destination: before,
        sourceSnapshot: sourceRaw,
        userId: A,
        workspaceId: W,
        revision: 1,
      }),
      A,
    );
    await d.engine.saveMergeReview(plan, sourceRaw);
    const snapshot = d.store.snapshot();
    await d.engine.cancelUnsubmittedReview(snapshot);
    expect(d.store.account.read().merge).toBeNull();
    expect(d.store.read().db).toEqual(before);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(sourceRaw);
    expect(server.pushes).toBe(0);
    await expect(d.engine.cancelUnsubmittedReview(snapshot)).rejects.toThrow();
  });
  it('restores a reviewed prior version as a new revision after backup and stale-state checks', async () => {
    const server = new Server();
    server.rows.set(recordKey({ collection: 'aircraft', id: 'fixture', value: null }), {
      collection: 'aircraft',
      id: 'fixture',
      value: newRecord(),
      revision: 1,
    });
    const d = await device(server);
    await edit(d.store, (db) => {
      db.aircraft[0].notes = 'newer';
    });
    await d.engine.run();
    const reviewed = await d.engine.history('aircraft', 'fixture');
    expect(reviewed.records).toHaveLength(1);
    expect(reviewed.records[0].value).toMatchObject({ notes: 'original' });
    const backup = d.engine.recoveryBackup();
    await expect(
      d.engine.restoreHistory(reviewed, reviewed.records[0], backup, 'stale', true),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(server.revision).toBe(2);
    await d.engine.restoreHistory(reviewed, reviewed.records[0], backup, d.store.snapshot(), true);
    expect(server.revision).toBe(3);
    expect(d.store.read().db.aircraft[0].notes).toBe('original');
    expect((await d.engine.history('aircraft', 'fixture')).records).toHaveLength(2);
    expect(d.engine.snapshot().phase).toBe('synced');
  });
  it('rejects a stale history choice after another device advances the account revision', async () => {
    const server = new Server();
    server.rows.set(recordKey({ collection: 'aircraft', id: 'fixture', value: null }), {
      collection: 'aircraft',
      id: 'fixture',
      value: newRecord(),
      revision: 1,
    });
    const d = await device(server);
    await edit(d.store, (db) => {
      db.aircraft[0].notes = 'newer';
    });
    await d.engine.run();
    const reviewed = await d.engine.history('aircraft', 'fixture');
    const backup = d.engine.recoveryBackup();
    await server.push({
      id: crypto.randomUUID(),
      expected: 2,
      changes: [{ collection: 'aircraft', id: 'other', value: newRecord('other') }],
      purpose: 'edit',
    });
    await expect(
      d.engine.restoreHistory(reviewed, reviewed.records[0], backup, d.store.snapshot(), true),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(d.store.read().db.aircraft[0].notes).toBe('newer');
    expect(d.store.account.read().operation).toBeNull();
  });
  it('starts from verified cloud settings, uses no passphrase and never reads the Guest key', async () => {
    const server = new Server(),
      storage = new MemoryStorage();
    storage.setItem(guestStore.key, 'original Guest bytes');
    const d = await device(server, storage);
    expect(d.store.read().db.settings.privacy).toEqual(emptyAccountDatabase().settings.privacy);
    expect(d.store.sync).toBeUndefined();
    expect(storage.getItem(guestStore.key)).toBe('original Guest bytes');
    await d.engine.run();
    expect(d.engine.snapshot().phase).toBe('synced');
    expect(server.pushes).toBe(0);
    expect(() => new AccountEngine(guestStore as AccountStore, server)).toThrow();
  });
  it('durably saves offline creates/edits through restart and retries only changed records', async () => {
    const server = new Server(),
      d = await device(server);
    server.fail = true;
    await edit(d.store, (db) => db.aircraft.push(newRecord()));
    await d.engine.run();
    expect(d.engine.snapshot()).toMatchObject({ phase: 'paused', pending: 1, error: 'network' });
    const raw = d.storage.getItem(accountCacheKey(A));
    expect(raw).toContain('original');
    d.engine.stop();
    d.store.lock();
    server.fail = false;
    const reopened = await device(server, d.storage);
    expect(reopened.store.read().db.aircraft[0].notes).toBe('original');
    await reopened.engine.run();
    expect(server.pushes).toBe(1);
    expect(reopened.engine.snapshot()).toMatchObject({ phase: 'synced', pending: 0 });
    expect(server.rows.size).toBe(2);
  });
  it('recovers lost upload acknowledgement using the same durable operation exactly once', async () => {
    const server = new Server(),
      d = await device(server);
    await edit(d.store, (db) => db.aircraft.push(newRecord()));
    server.loseAck = true;
    await d.engine.run();
    const operation = d.store.account.read().operation!;
    expect(operation.id).toBeTruthy();
    expect(server.pushes).toBe(1);
    expect(d.engine.snapshot().phase).toBe('paused');
    await d.engine.run();
    expect(server.pushes).toBe(1);
    expect(d.store.account.read().operation).toBeNull();
    expect(d.engine.snapshot().phase).toBe('synced');
  });
  it('keeps rapid edits during an upload dirty without inventing a same-device conflict', async () => {
    const server = new Server(),
      d = await device(server);
    await edit(d.store, (db) => db.aircraft.push(newRecord()));
    server.beforeReply = async () => {
      server.beforeReply = null;
      await edit(d.store, (db) => {
        db.aircraft[0].notes = 'newer local';
      });
    };
    await d.engine.run();
    expect(d.store.read().db.aircraft[0].notes).toBe('newer local');
    expect(d.engine.snapshot()).toMatchObject({ phase: 'pending', pending: 1, conflicts: 0 });
    await d.engine.run();
    expect(d.engine.snapshot().phase).toBe('synced');
    expect(
      server.rows.get(recordKey({ collection: 'aircraft', id: 'fixture', value: null }))!.value,
    ).toMatchObject({ notes: 'newer local' });
  });
  it('preserves concurrent versions and supports explicit reviewed cloud selection', async () => {
    const server = new Server(),
      a = await device(server);
    await edit(a.store, (db) => db.aircraft.push(newRecord()));
    await a.engine.run();
    const b = await device(server);
    await edit(a.store, (db) => {
      db.aircraft[0].notes = 'A edit';
    });
    await edit(b.store, (db) => {
      db.aircraft[0].notes = 'B edit';
    });
    await a.engine.run();
    await b.engine.run();
    expect(b.engine.snapshot().phase).toBe('conflict');
    expect(b.store.read().db.aircraft[0].notes).toBe('B edit');
    expect(
      b.store.account.read().base.find((b) => b.record.collection === 'aircraft')!.record.value,
    ).toMatchObject({ notes: 'A edit' });
    await b.engine.resolveConflicts(
      Object.fromEntries(b.store.account.read().conflicts.map((key) => [key, 'cloud'])),
      b.store.snapshot(),
    );
    await b.engine.run();
    expect(b.store.read().db.aircraft[0].notes).toBe('A edit');
    expect(b.engine.snapshot().phase).toBe('synced');
  });
  it('propagates deletions and preserves a delete-versus-offline-edit conflict', async () => {
    const server = new Server(),
      a = await device(server);
    await edit(a.store, (db) => db.aircraft.push(newRecord()));
    await a.engine.run();
    const b = await device(server);
    await edit(a.store, (db) => {
      db.aircraft = [];
    });
    await edit(b.store, (db) => {
      db.aircraft[0].notes = 'offline edit';
    });
    await a.engine.run();
    await b.engine.run();
    expect(b.engine.snapshot().phase).toBe('conflict');
    expect(b.store.read().db.aircraft).toHaveLength(1);
    expect(
      server.rows.get(recordKey({ collection: 'aircraft', id: 'fixture', value: null }))!.value,
    ).toBeNull();
  });
  it('fences account switching, stale requests and locked cache writes without reclassifying data as Guest', async () => {
    let active = A;
    const server = new Server(),
      d = await device(server, new MemoryStorage(), () => active);
    await edit(d.store, (db) => db.aircraft.push(newRecord()));
    const before = d.storage.getItem(d.store.key);
    active = B;
    await expect(d.store.write(emptyAccountDatabase(), d.store.snapshot())).resolves.toMatchObject({
      ok: false,
    });
    expect(() => d.store.read()).toThrow('locked');
    expect(d.storage.getItem(d.store.key)).toBe(before);
    expect(server.pushes).toBe(0);
    active = A;
    d.store.lock();
    expect(() => d.store.read()).toThrow('locked');
    expect(d.storage.getItem(d.store.key)).toBe(before);
  });
  it('does not apply a late upload receipt after sign-out', async () => {
    const server = new Server(),
      d = await device(server);
    await edit(d.store, (db) => db.aircraft.push(newRecord()));
    const before = d.store.snapshot();
    server.beforeReply = async () => {
      d.store.lock();
    };
    await d.engine.run();
    expect(d.storage.getItem(accountCacheKey(A))).not.toBeNull();
    expect(() => d.store.read()).toThrow();
    expect(d.storage.getItem(accountCacheKey(A))).not.toBe(before); // durable queued operation, not deleted on lock
    const raw = JSON.parse(d.storage.getItem(accountCacheKey(A))!);
    expect(raw.state.operation).not.toBeNull();
  });
  it('refuses corrupted/mismatched caches without replacing bytes', async () => {
    const server = new Server(),
      d = await device(server);
    d.engine.stop();
    d.store.lock();
    const original = d.storage.getItem(accountCacheKey(A))!,
      bad = JSON.parse(original);
    bad.userId = B;
    d.storage.setItem(accountCacheKey(A), JSON.stringify(bad));
    await expect(device(server, d.storage)).rejects.toThrow('invalid');
    expect(d.storage.getItem(accountCacheKey(A))).toBe(JSON.stringify(bad));
  });
  it('keeps quota failures local and never claims synced or partially overwrites the cache', async () => {
    const server = new Server(),
      d = await device(server),
      raw = d.store.snapshot();
    vi.spyOn(d.storage, 'setItem').mockImplementation(() => {
      throw Error('quota');
    });
    const changed = d.store.read().db;
    changed.aircraft.push(newRecord());
    expect(await d.store.write(changed, raw)).toMatchObject({ ok: false });
    expect(d.store.snapshot()).toBe(raw);
    expect(d.store.read().db.aircraft).toHaveLength(0);
    expect(server.pushes).toBe(0);
  });
  it('pauses without cross-tab locking and preserves stale-tab bytes', async () => {
    const server = new Server(),
      d = await device(server);
    d.storage.setItem(d.store.key, d.store.snapshot() + ' ');
    await d.engine.run();
    expect(d.engine.snapshot().error).toBe('local');
    const next = await device(server);
    Reflect.deleteProperty(navigator, 'locks');
    await next.engine.run();
    expect(next.engine.snapshot()).toMatchObject({ phase: 'paused', error: 'locks' });
    const current = next.store.read();
    expect(await next.store.write(current.db, current.snapshot)).toMatchObject({ ok: false });
  });
  it('does not accept unsupported, incomplete or wrong-account cloud snapshots', async () => {
    const server = new Server(),
      snapshot = await server.pull(0);
    for (const patch of [
      { version: 3 },
      { userId: B },
      { total: 5001 },
      { count: 4 },
      { records: [], count: 0 },
      { workspaceId: null },
    ])
      expect(() => stateFromPull({ ...snapshot, ...patch } as AccountPull, A)).toThrow();
  });
  it('queues a confirmed Guest merge durably and verifies completion only after remote acknowledgement/readback', async () => {
    const server = new Server(),
      d = await device(server),
      source = emptyAccountDatabase();
    source.aircraft.push(newRecord('guest'));
    const sourceRaw = JSON.stringify(source),
      current = d.store.read();
    const requested = await requestMerge({
      source,
      destination: current.db,
      userId: A,
      workspaceId: W,
      revision: d.store.account.read().cursor,
      sourceSnapshot: sourceRaw,
    });
    const reviewed = confirmPreparation(requested, A);
    const queued = await confirmFinal(reviewed, {
      userId: A,
      workspaceId: W,
      sourceSnapshot: sourceRaw,
      destination: current.db,
      revision: 1,
    });
    localStorage.setItem(STORAGE_KEY, sourceRaw + ' ');
    await expect(d.engine.queueMerge(queued, sourceRaw)).rejects.toThrow('conflict');
    expect(d.store.account.read().merge).toBeNull();
    localStorage.setItem(STORAGE_KEY, sourceRaw);
    server.fail = true;
    await d.engine.queueMerge(queued, sourceRaw);
    expect(d.store.account.read().merge?.stage).toBe('queued');
    expect(d.store.account.read().operation?.id).toBe(queued.operationId);
    expect(JSON.stringify(source)).toBe(sourceRaw);
    server.fail = false;
    await d.engine.run();
    expect(d.store.account.read().merge?.stage).toBe('verified');
    expect(d.store.read().db.aircraft).toHaveLength(1);
    expect(server.rows.size).toBe(2);
  });
  it('does not rebase a stale reviewed Guest merge over a newer destination revision', async () => {
    const server = new Server(),
      d = await device(server),
      source = emptyAccountDatabase();
    source.aircraft.push(newRecord('guest'));
    const sourceRaw = JSON.stringify(source),
      destination = d.store.read().db;
    let plan = confirmPreparation(
      await requestMerge({
        source,
        destination,
        userId: A,
        workspaceId: W,
        revision: 1,
        sourceSnapshot: sourceRaw,
      }),
      A,
    );
    plan = await confirmFinal(plan, {
      userId: A,
      workspaceId: W,
      sourceSnapshot: sourceRaw,
      destination,
      revision: 1,
    });
    await server.push({
      id: 'different-device-operation',
      expected: 1,
      changes: [{ collection: 'aircraft', id: 'other-device', value: newRecord('other-device') }],
      purpose: 'edit',
    });
    localStorage.setItem(STORAGE_KEY, sourceRaw);
    await d.engine.queueMerge(plan, sourceRaw);
    await d.engine.run();
    expect(d.engine.snapshot()).toMatchObject({ phase: 'conflict', error: 'conflict' });
    expect(d.store.account.read().operation?.purpose).toBe('guest-merge');
    expect(d.store.account.read().merge?.stage).toBe('queued');
    expect(server.rows.has(recordKey({ collection: 'aircraft', id: 'guest', value: null }))).toBe(
      false,
    );
    expect(server.pushes).toBe(1);
    await d.engine.run();
    expect(server.pushes).toBe(1);
  });
  it('verifies an all-skipped no-op merge by reading cloud state without creating a fake revision', async () => {
    const server = new Server(),
      d = await device(server);
    await edit(d.store, (db) => db.aircraft.push(newRecord()));
    await d.engine.run();
    const source = d.store.read().db,
      sourceRaw = JSON.stringify(source),
      revision = server.revision;
    let plan = confirmPreparation(
      await requestMerge({
        source,
        destination: source,
        userId: A,
        workspaceId: W,
        revision,
        sourceSnapshot: sourceRaw,
      }),
      A,
    );
    plan = bulkDecide(plan, selectEligible(plan), 'cloud', A);
    plan = await confirmFinal(plan, {
      userId: A,
      workspaceId: W,
      sourceSnapshot: sourceRaw,
      destination: source,
      revision,
    });
    localStorage.setItem(STORAGE_KEY, sourceRaw);
    const before = server.pushes;
    await d.engine.queueMerge(plan, sourceRaw);
    await d.engine.run();
    expect(server.pushes).toBe(before);
    expect(server.revision).toBe(revision);
    expect(d.store.account.read().merge?.stage).toBe('verified');
  });
});
describe('owner-approved manual archive and expired-device review', () => {
  it('validates exact archive bytes/account/graph and rejects a changed destination', async () => {
    const server = new Server(),
      d = await device(server);
    await d.engine.run();
    const file = await d.engine.prepareArchive();
    await expect(verifyArchive(file, file.text + ' ', A, W)).rejects.toThrow('invalid');
    await expect(verifyArchive(file, file.text, B, W)).rejects.toThrow('invalid');
    await expect(d.engine.archiveHistory(file, 'different file')).rejects.toThrow('invalid');
    await server.push({
      id: crypto.randomUUID(),
      expected: 1,
      changes: records(emptyAccountDatabase()),
      purpose: 'edit',
    });
    await expect(d.engine.archiveHistory(file, file.text)).rejects.toThrow('conflict');
    expect(server.floor).toBe(0);
  });
  it('preserves old offline edits and exact outbox, requires saved-file readback and every renewed choice', async () => {
    const server = new Server(),
      d = await device(server);
    server.failPush = true;
    await edit(d.store, (db) => db.aircraft.push(newRecord('old-offline')));
    await d.engine.run();
    server.failPush = false;
    await server.push({
      id: crypto.randomUUID(),
      expected: 1,
      changes: [{ collection: 'aircraft', id: 'other-device', value: newRecord('other-device') }],
      purpose: 'edit',
    });
    const file = await server.prepareArchive();
    await server.archive(2, file.digest);
    const before = d.storage.getItem(accountCacheKey(A));
    await d.engine.run();
    expect(d.engine.snapshot()).toMatchObject({ phase: 'paused', error: 'archived' });
    expect(d.storage.getItem(accountCacheKey(A))).toBe(before);
    await expect(d.engine.reviewAfterArchive('unverified')).rejects.toThrow('local');
    await d.engine.reviewAfterArchive(d.engine.recoveryBackup());
    expect(
      d.store
        .read()
        .db.aircraft.map((a) => a.id)
        .sort(),
    ).toEqual(['old-offline', 'other-device']);
    expect(d.engine.state().recovery?.operation?.changes).toHaveLength(1);
    const pushes = server.pushes;
    await d.engine.run();
    expect(server.pushes).toBe(pushes);
    await expect(d.engine.approveArchiveReview({}, d.store.snapshot())).rejects.toThrow('conflict');
    const choices = Object.fromEntries(
      d.engine.recoveryRows().map((row) => [row.key, 'local' as const]),
    );
    await d.engine.approveArchiveReview(choices, d.store.snapshot());
    expect(d.engine.snapshot().phase).toBe('synced');
    expect(d.engine.state().recovery?.stage).toBe('approved');
    expect(
      server.rows.has(recordKey({ collection: 'aircraft', id: 'old-offline', value: null })),
    ).toBe(true);
  });
  it('retains competing delete/edit versions through reload and rejects stale review approval', async () => {
    const server = new Server();
    await server.push({
      id: crypto.randomUUID(),
      expected: 1,
      changes: [{ collection: 'aircraft', id: 'x', value: newRecord('x') }],
      purpose: 'edit',
    });
    const d = await device(server);
    await edit(d.store, (db) => {
      db.aircraft[0].notes = 'offline edit';
    });
    await server.push({
      id: crypto.randomUUID(),
      expected: 2,
      changes: [{ collection: 'aircraft', id: 'x', value: null }],
      purpose: 'edit',
    });
    const file = await server.prepareArchive();
    await server.archive(3, file.digest);
    await d.engine.run();
    await d.engine.reviewAfterArchive(d.engine.recoveryBackup());
    expect(d.engine.recoveryRows()[0].cloud?.value).toBeNull();
    d.engine.stop();
    d.store.lock();
    const reopened = await device(server, d.storage);
    expect(reopened.engine.state().recovery?.db.aircraft[0].notes).toBe('offline edit');
    await server.push({
      id: crypto.randomUUID(),
      expected: 3,
      changes: records(emptyAccountDatabase()),
      purpose: 'edit',
    });
    const choices = Object.fromEntries(
      reopened.engine.recoveryRows().map((row) => [row.key, 'cloud' as const]),
    );
    await expect(
      reopened.engine.approveArchiveReview(choices, reopened.store.snapshot()),
    ).rejects.toThrow('conflict');
    expect(reopened.store.read().db.aircraft).toHaveLength(1);
    await reopened.engine.reviewAfterArchive(reopened.engine.recoveryBackup());
    const currentChoices = Object.fromEntries(
      reopened.engine.recoveryRows().map((row) => [row.key, 'cloud' as const]),
    );
    await reopened.engine.approveArchiveReview(currentChoices, reopened.store.snapshot());
    expect(reopened.store.read().db.aircraft).toHaveLength(0);
    expect(reopened.engine.state().recovery?.db.aircraft).toHaveLength(1);
  });
});

describe('server-validated, request-bound Account transport', () => {
  function client() {
    const headers = new Map<string, string>(),
      rpc = vi.fn();
    const builder = {
      setHeader: vi.fn((key: string, value: string) => {
        headers.set(key, value);
        return builder;
      }),
      abortSignal: vi.fn(async () => ({ data: { version: 2, userId: A }, error: null })),
    };
    rpc.mockReturnValue(builder);
    return {
      headers,
      rpc,
      builder,
      value: {
        auth: {
          getUser: vi.fn(async () => ({
            data: {
              user: {
                id: A,
                email: 'fixture@example.test',
                email_confirmed_at: '2026-10-28',
                is_anonymous: false,
              },
            },
            error: null,
          })),
          getSession: vi.fn(async () => ({
            data: {
              session: {
                user: { id: A },
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                access_token: 'fixture-account-A-token',
              },
            },
            error: null,
          })),
        },
        rpc,
      } as unknown as SupabaseClient,
    };
  }
  it('captures the verified A token rather than relying on a later ambient B token', async () => {
    const p = client(),
      t = accountTransport(p.value, A, () => true);
    p.rpc.mockImplementation(() => {
      return p.builder;
    });
    await t.pull(0, new AbortController().signal);
    expect(p.headers.get('Authorization')).toBe('Bearer fixture-account-A-token');
    expect(p.rpc).toHaveBeenCalledWith('tco_account_pull', { p_cursor: 0 });
  });
  it('refuses a different session owner or cancelled identity before any RPC', async () => {
    const p = client();
    vi.spyOn(p.value.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          user: { id: B },
          expires_at: Date.now() / 1000 + 3000,
          access_token: 'fixture-B',
        },
      },
      error: null,
    } as never);
    await expect(
      accountTransport(p.value, A, () => true).pull(0, new AbortController().signal),
    ).rejects.toThrow('auth');
    expect(p.rpc).not.toHaveBeenCalled();
    await expect(
      accountTransport(p.value, A, () => false).pull(0, new AbortController().signal),
    ).rejects.toThrow('locked');
  });
  it('rejects wrong-owner responses and missing migration without logging raw provider errors', async () => {
    const p = client(),
      t = accountTransport(p.value, A, () => true);
    p.builder.abortSignal.mockResolvedValueOnce({ data: { version: 2, userId: B }, error: null });
    await expect(t.pull(0, new AbortController().signal)).rejects.toThrow('invalid');
    p.builder.abortSignal.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST202', message: 'private provider detail' },
    } as never);
    await expect(t.pull(0, new AbortController().signal)).rejects.toThrow('setup');
  });
});
