import { readOnlyVault } from '../src/migration/recovery';
import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createCloudKey, encryptRecord } from '../src/sync/crypto';
import { records } from '../src/sync/records';
import { emptyAccountDatabase, openVault } from '../src/workspaces/vault';
import { emptyAircraft } from '../src/domain/model';
import type { CloudTransport, Pull } from '../src/sync/types';
import {
  inspectLegacy,
  legacyBackupText,
  verifyLegacyBackup,
  prepareLegacyConversion,
  recheckLegacy,
  verifyLegacyResult,
} from '../src/migration/legacy';
const A = '90000000-0000-4000-8000-000000000001',
  secret = 'original fictional legacy vault passphrase';
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());
async function source(withAircraft = false) {
  const db = emptyAccountDatabase();
  db.settings.privacy.registration = false;
  if (withAircraft) db.aircraft.push({ ...emptyAircraft('', ''), id: 'legacy-aircraft' });
  const { keys, envelope } = await createCloudKey(A, secret);
  const ciphertext = await Promise.all(records(db).map((row) => encryptRecord(keys, row, 1)));
  let pull: Pull = {
    version: 1,
    userId: A,
    revision: 1,
    envelope,
    records: ciphertext,
    count: ciphertext.length,
    total: ciphertext.length,
  };
  const remote: CloudTransport = {
    pull: vi.fn(async () => structuredClone(pull)),
    initialize: vi.fn(async () => {
      throw Error('Unexpected legacy mutation');
    }),
    push: vi.fn(async () => {
      throw Error('Unexpected legacy mutation');
    }),
  };
  return {
    db,
    keys,
    remote,
    set: (p: Pull) => {
      pull = p;
    },
    get: () => structuredClone(pull),
  };
}
it('treats a settings-only encrypted workspace as established and creates a stable independent read-back-verifiable backup', async () => {
  const f = await source(),
    view = await inspectLegacy({
      userId: A,
      remote: f.remote,
      cloudPassphrase: secret,
      local: null,
      signal: new AbortController().signal,
    });
  expect(view.cloudRecords).toHaveLength(1);
  expect(view.cloudDatabase.aircraft).toEqual([]);
  const file = legacyBackupText(view);
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86400000);
  const digest = await verifyLegacyBackup(view, file);
  expect(legacyBackupText(view)).toBe(file);
  const prepared = await prepareLegacyConversion(view, view.cloudDatabase, digest, true);
  expect(prepared.manifest).toMatchObject({
    recordCount: 1,
    keyId: f.get().envelope!.keyId,
    backupDigest: digest,
  });
  expect(f.remote.initialize).not.toHaveBeenCalled();
  expect(f.remote.push).not.toHaveBeenCalled();
  await expect(verifyLegacyBackup(view, file + ' ')).rejects.toThrow('backup');
  await expect(prepareLegacyConversion(view, view.cloudDatabase, digest, false)).rejects.toThrow(
    'backup',
  );
});
it('requires complete authoritative source coverage, preserves tombstones and rejects a privacy-only partial conversion', async () => {
  const f = await source(true),
    pull = f.get(),
    tombstone = await encryptRecord(
      f.keys,
      { collection: 'aircraft', id: 'deleted-original', value: null },
      1,
    );
  pull.records.push(tombstone);
  pull.count++;
  pull.total++;
  f.set(pull);
  const view = await inspectLegacy({
    userId: A,
    remote: f.remote,
    cloudPassphrase: secret,
    local: null,
    signal: new AbortController().signal,
  });
  const digest = await verifyLegacyBackup(view, legacyBackupText(view));
  await expect(prepareLegacyConversion(view, emptyAccountDatabase(), digest, true)).rejects.toThrow(
    'incomplete',
  );
  const result = await prepareLegacyConversion(view, view.cloudDatabase, digest, true);
  expect(result.manifest.entries).toHaveLength(3);
  expect(result.rows.find((r) => r.id === 'deleted-original')?.value).toBeNull();
  verifyLegacyResult(result, result.rows, A, A);
  expect(() => verifyLegacyResult(result, result.rows.slice(1), A, A)).toThrow('verification');
});
it('refuses incomplete, corrupt, incompatible and wrong-account sources instead of silently omitting records', async () => {
  const f = await source(true),
    original = f.get();
  f.set({ ...original, total: original.total + 1 });
  await expect(
    inspectLegacy({
      userId: A,
      remote: f.remote,
      cloudPassphrase: secret,
      local: null,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow('incomplete');
  f.set(original);
  await expect(
    inspectLegacy({
      userId: A,
      remote: f.remote,
      cloudPassphrase: 'wrong original passphrase',
      local: null,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow();
  const bad = await encryptRecord(
    f.keys,
    { collection: 'aircraft', id: 'incompatible', value: { id: 'incompatible' } },
    1,
  );
  f.set({
    ...original,
    records: [...original.records, bad],
    count: original.count + 1,
    total: original.total + 1,
  });
  await expect(
    inspectLegacy({
      userId: A,
      remote: f.remote,
      cloudPassphrase: secret,
      local: null,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow('incompatible');
  f.set({ ...original, userId: '90000000-0000-4000-8000-000000000002' });
  await expect(
    inspectLegacy({
      userId: A,
      remote: f.remote,
      cloudPassphrase: secret,
      local: null,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow('incomplete');
  expect(f.remote.push).not.toHaveBeenCalled();
});
it('keeps original local Vault bytes and rechecks both local snapshot and remote revision before conversion', async () => {
  const f = await source(true),
    store = await openVault(A, secret, true),
    raw = store.snapshot();
  const view = await inspectLegacy({
    userId: A,
    remote: f.remote,
    cloudPassphrase: secret,
    local: store,
    signal: new AbortController().signal,
  });
  expect(store.snapshot()).toBe(raw);
  expect(view.localCiphertext).toBe(raw);
  const backupDigest = await verifyLegacyBackup(view, legacyBackupText(view));
  await expect(
    prepareLegacyConversion(view, view.cloudDatabase, backupDigest, true),
  ).rejects.toThrow('reconciliation');
  await recheckLegacy(view, f.remote, store, new AbortController().signal);
  f.set({ ...f.get(), revision: 2 });
  await expect(recheckLegacy(view, f.remote, store, new AbortController().signal)).rejects.toThrow(
    'changed',
  );
  f.set(view.cloud);
  const db = store.read().db;
  db.settings.privacy.flights = false;
  await store.write(db, store.snapshot());
  await expect(recheckLegacy(view, f.remote, store, new AbortController().signal)).rejects.toThrow(
    'changed',
  );
  expect(f.remote.initialize).not.toHaveBeenCalled();
  store.lock();
});

it('legacy recovery never enables writing or sync and preserves original encrypted bytes', async () => {
  const store = await openVault(A, secret, true),
    db = store.read().db;
  db.settings.privacy.flights = false;
  expect((await store.write(db, store.snapshot())).ok).toBe(true);
  const original = store.snapshot(),
    recovery = readOnlyVault(store, A);
  expect(recovery.sync).toBeUndefined();
  const proposed = recovery.read().db;
  proposed.settings.privacy.flights = true;
  expect((await recovery.write(proposed, recovery.snapshot())).ok).toBe(false);
  expect(store.snapshot()).toBe(original);
  expect(recovery.read().db.settings.privacy.flights).toBe(false);
  expect(() => readOnlyVault(store, '90000000-0000-4000-8000-000000000002')).toThrow('identity');
  recovery.lock();
});
