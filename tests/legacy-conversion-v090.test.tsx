import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCloudKey, encryptRecord, recordKey } from '../src/sync/crypto';
import { records, canonical } from '../src/sync/records';
import { emptyAccountDatabase, openVault, vaultKey } from '../src/workspaces/vault';
import { emptyAircraft, disruptionCategories } from '../src/domain/model';
import type { CloudTransport, Pull, RecordData } from '../src/sync/types';
import type { AccountPull, AccountTransport } from '../src/cloud/types';
import {
  inspectLegacy,
  legacyBackupText,
  legacyDifferences,
  reconcileLegacy,
} from '../src/migration/legacy';
import {
  approveConversion,
  conversionKey,
  runConversion,
  restartConversion,
  validateConversion,
  type Conversion,
} from '../src/migration/conversion';
import LegacyConversion from '../src/migration/LegacyConversion';
import * as archive from '../src/cloud/archive';
import { STORAGE_KEY } from '../src/lib/storage';
const A = '90000000-0000-4000-8000-000000000001',
  B = '90000000-0000-4000-8000-000000000002',
  W = '90000000-0000-4000-8000-000000000003';
const secret = 'fictional legacy cloud passphrase',
  other = 'different local legacy passphrase';
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: async (_key: string, fn: () => Promise<unknown>) => fn() },
  });
});
afterEach(() => vi.unstubAllGlobals());
async function fixture(
  mode: 'cloud' | 'local' | 'same' | 'different' = 'cloud',
  withAircraft = true,
  linked = false,
) {
  const db = emptyAccountDatabase();
  db.settings.privacy.registration = false;
  if (withAircraft)
    db.aircraft.push({ ...emptyAircraft('', ''), id: 'legacy-a', notes: 'cloud original' });
  if (linked) {
    db.duties.push({
      id: 'legacy-duty',
      date: '2026-10-29',
      start: '',
      end: '',
      status: 'Draft',
      notes: '',
    });
    db.aircraft[0].dutyId = 'legacy-duty';
    db.journals.push({
      id: 'legacy-journal',
      date: '2026-10-29',
      title: '',
      status: 'Draft',
      situation: '',
      challenge: '',
      responsibility: '',
      actions: '',
      result: '',
      learning: '',
      tags: [],
      dutyId: 'legacy-duty',
      aircraftIds: ['legacy-a'],
      outcome: '',
      unit: '',
      contribution: '',
      evidence: '',
      verification: '',
    });
    db.aircraft[0].events.push({
      id: 'legacy-event',
      category: disruptionCategories[0],
      involvement: 'Observed',
      resolution: 'Resolved',
      notes: '',
      journalId: 'legacy-journal',
    });
  }
  const { keys, envelope } = await createCloudKey(A, secret);
  let pull: Pull =
    mode === 'local'
      ? { version: 1, userId: A, revision: 0, envelope: null, records: [], count: 0, total: 0 }
      : {
          version: 1,
          userId: A,
          revision: 1,
          envelope,
          records: await Promise.all(records(db).map((r) => encryptRecord(keys, r, 1))),
          count: records(db).length,
          total: records(db).length,
        };
  const legacy: CloudTransport = {
    pull: vi.fn(async () => structuredClone(pull)),
    initialize: vi.fn(),
    push: vi.fn(),
  };
  const local = mode === 'cloud' ? null : await openVault(A, other, true);
  if (local) {
    const value = structuredClone(db);
    if (mode === 'different') value.aircraft[0].notes = 'unsent local';
    await local.write(value, local.snapshot());
  }
  const source = await inspectLegacy({
    userId: A,
    remote: legacy,
    local,
    cloudPassphrase: secret,
    signal: new AbortController().signal,
  });
  let destination: AccountPull = {
    version: 2,
    userId: A,
    workspaceId: null,
    established: mode !== 'local',
    legacyRevision: mode === 'local' ? null : 1,
    revision: 0,
    records: [],
    count: 0,
    total: 0,
  };
  let body = '',
    writes = 0,
    lose = false,
    badDownload = false,
    deny = false;
  const remote: AccountTransport = {
    pull: vi.fn(async () => ({
      ...structuredClone(destination),
      ...(!destination.workspaceId ? { legacyRevision: pull.envelope ? pull.revision : null } : {}),
      ...(badDownload && destination.workspaceId ? { records: [], count: 0 } : {}),
    })),
    initialize: vi.fn<AccountTransport['initialize']>(
      async (operation, rows, revision, _signal, manifest) => {
        if (deny) throw Error('auth');
        const exact = canonical({ operation, rows, revision, manifest });
        if (destination.workspaceId && exact !== body) throw Error('conflict');
        if (!destination.workspaceId) {
          if (revision !== (pull.envelope ? pull.revision : null)) throw Error('legacy changed');
          body = exact;
          writes++;
          destination = {
            ...destination,
            workspaceId: W,
            established: true,
            revision: 1,
            conversionState: 'verifying',
            records: rows.map((r) => ({ ...r, revision: 1 })),
            count: rows.length,
            total: rows.length,
            snapshotDigest: 'a'.repeat(64),
          };
        }
        if (lose) {
          lose = false;
          throw Error('lost acknowledgement');
        }
        return {
          version: 2 as const,
          userId: A,
          workspaceId: W,
          revision: 1,
          operationId: operation,
        };
      },
    ),
    verifyConversion: vi.fn(async (_id, revision, digest) => {
      if (revision !== destination.revision || digest !== destination.snapshotDigest)
        throw Error('invalid');
      destination.conversionState = 'active';
    }),
    push: vi.fn(),
  };
  const approve = async (choice: 'cloud' | 'local' = 'local') => {
    const decisions = Object.fromEntries(
      legacyDifferences(source)
        .filter((r) => r.differs)
        .map((r) => [
          r.key,
          { choice: r[choice] ? choice : r.cloud ? ('cloud' as const) : ('local' as const) },
        ]),
    );
    const value = await approveConversion(source, decisions, legacyBackupText(source), true, true);
    localStorage.setItem(conversionKey(A), JSON.stringify(value));
    return value;
  };
  const run = (value: Conversion, active = () => true) =>
    runConversion({ value, remote, legacy, active, signal: new AbortController().signal });
  return {
    db,
    source,
    local,
    legacy,
    remote,
    approve,
    run,
    get pull() {
      return pull;
    },
    set pull(p: Pull) {
      pull = p;
    },
    get writes() {
      return writes;
    },
    set lose(v: boolean) {
      lose = v;
    },
    set badDownload(v: boolean) {
      badDownload = v;
    },
    set deny(v: boolean) {
      deny = v;
    },
  };
}
it.each(['local', 'cloud', 'same'] as const)(
  'converts %s sources only after verified backup and preserves ciphertext/Guest bytes',
  async (mode) => {
    const f = await fixture(mode),
      raw = f.local?.snapshot(),
      encrypted = JSON.stringify(f.pull);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f.db));
    const guest = localStorage.getItem(STORAGE_KEY);
    const value = await f.approve(),
      p = await f.run(value);
    expect(p.conversionState).toBe('active');
    expect(f.writes).toBe(1);
    expect(f.local?.snapshot()).toBe(raw);
    expect(JSON.stringify(f.pull)).toBe(encrypted);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(guest);
    expect(JSON.parse(localStorage.getItem(conversionKey(A))!).phase).toBe('verified');
    expect(f.legacy.push).not.toHaveBeenCalled();
    expect(f.remote.push).not.toHaveBeenCalled();
  },
);
it('converts a privacy-only legacy account without inventing flights or changing disabled preferences', async () => {
  const f = await fixture('cloud', false),
    value = await f.approve(),
    p = await f.run(value);
  expect(p.records).toHaveLength(1);
  expect(p.records[0]).toMatchObject({
    collection: 'privacy',
    id: 'settings',
    value: { registration: false },
  });
});
it('rejects tampered ciphertext and invalid manual relationships without any writes', async () => {
  const f = await fixture('different'),
    original = structuredClone(f.pull);
  const bytes = atob(f.pull.records[0].ciphertext);
  f.pull.records[0].ciphertext = btoa(
    String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1),
  );
  await expect(
    inspectLegacy({
      userId: A,
      remote: f.legacy,
      local: f.local,
      cloudPassphrase: secret,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow();
  f.pull = original;
  const key = recordKey({ collection: 'aircraft', id: 'legacy-a', value: null });
  await expect(
    approveConversion(
      f.source,
      { [key]: { choice: 'manual', value: { ...f.db.aircraft[0], dutyId: 'missing-duty' } } },
      legacyBackupText(f.source),
      true,
      true,
    ),
  ).rejects.toThrow();
  expect(f.writes).toBe(0);
  expect(f.local!.snapshot()).toBe(f.source.localCiphertext);
});
it('requires individual divergent choices and supports manual values without altering stable IDs', async () => {
  const f = await fixture('different');
  expect(() => reconcileLegacy(f.source, {})).toThrow('reconciliation');
  const key = recordKey({ collection: 'aircraft', id: 'legacy-a', value: null });
  const decisions = {
    [key]: {
      choice: 'manual' as const,
      value: { ...f.db.aircraft[0], notes: 'reviewed combination' },
    },
  };
  const value = await approveConversion(
    f.source,
    decisions,
    legacyBackupText(f.source),
    true,
    true,
  );
  localStorage.setItem(conversionKey(A), JSON.stringify(value));
  const p = await f.run(value);
  expect(p.records.find((r) => r.id === 'legacy-a')?.value).toMatchObject({
    id: 'legacy-a',
    notes: 'reviewed combination',
  });
  expect(f.local!.read().db.aircraft[0].notes).toBe('unsent local');
});
it('preserves Duty/Aircraft/Journal and nested disruption references with unchanged IDs', async () => {
  const f = await fixture('same', true, true),
    value = await f.approve(),
    p = await f.run(value);
  expect(
    p.records
      .map(({ collection, id, value }) => ({ collection, id, value }))
      .sort((a, b) => recordKey(a).localeCompare(recordKey(b))),
  ).toEqual(records(f.db).sort((a, b) => recordKey(a).localeCompare(recordKey(b))));
});
it('includes unresolved local baseline alternatives and unsent deletions in review and backup', async () => {
  const f = await fixture('different');
  const baseline = { ...f.db.aircraft[0], notes: 'retained baseline' },
    key = recordKey({ collection: 'aircraft', id: baseline.id, value: baseline });
  f.source.localSync = {
    version: 1,
    enabled: true,
    envelope: f.pull.envelope!,
    cursor: 1,
    base: [{ record: { collection: 'aircraft', id: baseline.id, value: baseline }, revision: 1 }],
    conflicts: [key],
    lastSuccess: null,
  };
  expect(legacyBackupText(f.source)).toContain('retained baseline');
  expect(() => reconcileLegacy(f.source, {})).toThrow('reconciliation');
  expect(reconcileLegacy(f.source, { [key]: { choice: 'baseline' } }).db.aircraft[0].notes).toBe(
    'retained baseline',
  );
  f.source.localDatabase!.aircraft = [];
  expect(legacyDifferences(f.source).find((r) => r.key === key)?.local?.value).toBeNull();
  expect(
    reconcileLegacy(f.source, { [key]: { choice: 'local' } }).rows.find((r) => r.id === baseline.id)
      ?.value,
  ).toBeNull();
});
it('requires consent, final confirmation and exact saved-file readback', async () => {
  const f = await fixture();
  const text = legacyBackupText(f.source);
  await expect(approveConversion(f.source, {}, text, false, true)).rejects.toThrow('consent');
  await expect(approveConversion(f.source, {}, text, true, false)).rejects.toThrow('consent');
  await expect(approveConversion(f.source, {}, text + ' ', true, true)).rejects.toThrow('backup');
  expect(f.writes).toBe(0);
});
it('resumes an interrupted lost-ack conversion with identical UUID/body and independently verifies destination', async () => {
  const f = await fixture(),
    value = await f.approve();
  f.lose = true;
  await expect(f.run(value)).rejects.toThrow('lost acknowledgement');
  const retained = JSON.parse(localStorage.getItem(conversionKey(A))!) as Conversion;
  expect(retained.phase).toBe('unknown');
  await f.run(retained);
  expect(f.writes).toBe(1);
  expect(vi.mocked(f.remote.initialize).mock.calls.map((c) => c[0])).toEqual([
    value.prepared.operationId,
    value.prepared.operationId,
  ]);
  expect(vi.mocked(f.remote.initialize).mock.calls[0].slice(0, 3)).toEqual(
    vi.mocked(f.remote.initialize).mock.calls[1].slice(0, 3),
  );
});
it('does not activate or mark complete after an incomplete destination download', async () => {
  const f = await fixture(),
    value = await f.approve();
  f.badDownload = true;
  await expect(f.run(value)).rejects.toThrow();
  expect(f.remote.verifyConversion).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(conversionKey(A))!).phase).toBe('unknown');
  f.badDownload = false;
  await f.run(JSON.parse(localStorage.getItem(conversionKey(A))!));
  expect(f.writes).toBe(1);
});
it('recovers a lost activation response and fences an account switch after upload', async () => {
  const f = await fixture(),
    value = await f.approve();
  const activate = f.remote.verifyConversion!;
  let lost = true;
  f.remote.verifyConversion = async (...args) => {
    await activate(...args);
    if (lost) {
      lost = false;
      throw Error('lost activation');
    }
  };
  await expect(f.run(value)).rejects.toThrow('lost activation');
  await f.run(JSON.parse(localStorage.getItem(conversionKey(A))!));
  expect(f.writes).toBe(1);
  let live = true;
  const pending = JSON.parse(localStorage.getItem(conversionKey(A))!) as Conversion;
  const initialize = f.remote.initialize;
  f.remote.initialize = async (...args) => {
    const receipt = await initialize(...args);
    live = false;
    return receipt;
  };
  await expect(f.run(pending, () => live)).rejects.toThrow('locked');
  expect(JSON.parse(localStorage.getItem(conversionKey(A))!).phase).toBe('unknown');
});
it('invalidates changed legacy revisions before upload and retains superseded approvals', async () => {
  const f = await fixture(),
    value = await f.approve();
  f.pull = { ...f.pull, revision: 2 };
  await expect(f.run(value)).rejects.toThrow('changed');
  expect(f.writes).toBe(0);
  await restartConversion(value, f.remote, () => true, new AbortController().signal);
  expect(localStorage.getItem(conversionKey(A))).toBeNull();
  expect(
    localStorage.getItem(conversionKey(A) + ':retained:' + value.prepared.operationId),
  ).toBeTruthy();
});
it('never cancels an unknown request with no monotonic server fence', async () => {
  const f = await fixture(),
    value = await f.approve();
  value.phase = 'unknown';
  localStorage.setItem(conversionKey(A), JSON.stringify(value));
  await expect(
    restartConversion(value, f.remote, () => true, new AbortController().signal),
  ).rejects.toThrow('unknown');
  expect(localStorage.getItem(conversionKey(A))).not.toBeNull();
});
it('fences account switching, expired authentication, wrong-owner caches and changed local vault bytes', async () => {
  const f = await fixture('local'),
    value = await f.approve();
  await expect(f.run(value, () => false)).rejects.toThrow('locked');
  await expect(validateConversion(value, B)).rejects.toThrow('invalid');
  const current = f.local!.read().db;
  current.aircraft[0].notes = 'newer local';
  await f.local!.write(current, f.local!.snapshot());
  await expect(f.run(value)).rejects.toThrow('changed');
  expect(f.writes).toBe(0);
});
it('preserves the pending plan when validated authentication expires before initialization', async () => {
  const f = await fixture(),
    value = await f.approve();
  f.deny = true;
  await expect(f.run(value)).rejects.toThrow('auth');
  expect(f.writes).toBe(0);
  expect(JSON.parse(localStorage.getItem(conversionKey(A))!).phase).toBe('unknown');
});

it('connects the real conversion UI to consent, backup File readback and final verification without legacy writes', async () => {
  const f = await fixture('different'),
    downloaded: string[] = [],
    done = vi.fn();
  vi.spyOn(archive, 'requestDownload').mockImplementation((text) => {
    downloaded.push(text);
  });
  const client = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: A,
            email: 'synthetic@example.test',
            email_confirmed_at: '2026-01-01',
            app_metadata: { provider: 'email' },
            is_anonymous: false,
          },
        },
        error: null,
      }),
      getSession: async () => ({
        data: {
          session: {
            user: { id: A },
            expires_at: Date.now() / 1000 + 600,
            access_token: 'synthetic-only-token',
          },
        },
        error: null,
      }),
    },
    rpc: (name: string, args: Record<string, unknown>) => {
      const builder = {
        setHeader: () => builder,
        abortSignal: async (signal: AbortSignal) => {
          try {
            const data =
              name === 'tco_sync_pull'
                ? await f.legacy.pull(0, signal)
                : name === 'tco_account_pull'
                  ? await f.remote.pull(0, signal)
                  : name === 'tco_account_initialize'
                    ? await f.remote.initialize(
                        args.p_operation as string,
                        args.p_records as RecordData[],
                        args.p_legacy_revision as number,
                        signal,
                        args.p_manifest as Conversion['prepared']['manifest'],
                      )
                    : name === 'tco_account_verify_conversion'
                      ? await f.remote.verifyConversion!(
                          args.p_operation as string,
                          args.p_expected as number,
                          args.p_digest as string,
                          signal,
                        )
                      : null;
            return { data, error: null };
          } catch {
            return { data: null, error: { message: 'fixture failure' } };
          }
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  render(
    <LegacyConversion
      userId={A}
      client={client}
      active={() => true}
      onComplete={done}
      onClose={() => {}}
    />,
  );
  await waitFor(() => expect(screen.getByText('Unlock and inspect sources')).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Local Vault Passphrase'), { target: { value: other } });
  fireEvent.change(screen.getByLabelText(/Cloud Vault Passphrase/), { target: { value: secret } });
  fireEvent.click(screen.getByText('Unlock and inspect sources'));
  await screen.findByText('Keep Local');
  expect(f.writes).toBe(0);
  fireEvent.click(screen.getByText('Manual Edit'));
  expect(screen.getByRole('heading', { name: 'Edit Handling Record' })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'manually reconciled' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));
  await screen.findByText(/Reviewed choice/);
  expect(f.writes).toBe(0);
  expect(screen.getByText('Confirm conversion')).toBeDisabled();
  fireEvent.click(screen.getByText('Download complete legacy backup'));
  expect(downloaded).toHaveLength(1);
  const file = new File([downloaded[0]], 'backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => downloaded[0] });
  fireEvent.change(screen.getByLabelText('Reread the saved backup'), { target: { files: [file] } });
  await waitFor(() => expect(screen.queryByText('Working…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByLabelText('I explicitly consent to the new storage model.'));
  fireEvent.click(screen.getByLabelText(/I reviewed all choices/));
  fireEvent.click(screen.getByText('Confirm conversion'));
  await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
  expect(f.writes).toBe(1);
  expect(localStorage.getItem(vaultKey(A))).toBe(f.source.localCiphertext);
});
