import type { AccountPull, AccountTransport } from '../cloud/types';
import type { CloudTransport } from '../sync/types';
import { validatePull } from '../cloud/engine';
import { canonical, materialize } from '../sync/records';
import { fingerprint } from './plan';
import {
  prepareLegacyConversion,
  verifyLegacyBackup,
  verifyLegacyResult,
  recheckLegacy,
  reconcileLegacy,
  type LegacySource,
  type LegacyDecisions,
} from './legacy';
import type { WorkspaceStore } from '../workspaces/store';
import { vaultKey } from '../workspaces/vault';

export const conversionKey = (uid: string) =>
  'tco-legacy-conversion-v1:' + vaultKey(uid).split(':')[1];
export type Conversion = {
  version: 1;
  userId: string;
  source: LegacySource;
  decisions: LegacyDecisions;
  prepared: Awaited<ReturnType<typeof prepareLegacyConversion>>;
  backupDigest: string;
  phase: 'approved' | 'unknown' | 'verified';
};
export async function approveConversion(
  source: LegacySource,
  decisions: LegacyDecisions,
  backup: string,
  consent: boolean,
  confirmed: boolean,
): Promise<Conversion> {
  if (!consent || !confirmed) throw Error('consent');
  const digest = await verifyLegacyBackup(source, backup);
  const prepared = await prepareLegacyConversion(
    source,
    reconcileLegacy(source, decisions).db,
    digest,
    true,
    decisions,
  );
  return {
    version: 1,
    userId: source.userId,
    source: structuredClone(source),
    decisions: structuredClone(decisions),
    prepared,
    backupDigest: digest,
    phase: 'approved',
  };
}
export async function validateConversion(value: Conversion, uid: string) {
  if (
    !value ||
    value.version !== 1 ||
    value.userId !== uid ||
    value.source.userId !== uid ||
    !['approved', 'unknown', 'verified'].includes(value.phase) ||
    value.source.cloud.userId !== uid ||
    (await fingerprint(value.source.cloud)) !== value.source.cloudDigest ||
    (value.source.localCiphertext === null
      ? value.source.localDigest !== null
      : (await fingerprint(value.source.localCiphertext)) !== value.source.localDigest)
  )
    throw Error('invalid');
  const expected = await prepareLegacyConversion(
    value.source,
    reconcileLegacy(value.source, value.decisions).db,
    value.backupDigest,
    true,
    value.decisions,
  );
  if (canonical(expected) !== canonical(value.prepared)) throw Error('invalid');
  return value;
}
/** Retain superseded plans. Unknown writes can be superseded only after the server's
 * monotonic legacy revision guard proves their exact request can no longer initialize. */
export async function restartConversion(
  value: Conversion,
  remote: AccountTransport,
  active: () => boolean,
  signal: AbortSignal,
  storage: Storage = localStorage,
) {
  if (!navigator.locks) throw Error('locking unavailable');
  const key = conversionKey(value.userId);
  return navigator.locks.request(key, async () => {
    await validateConversion(value, value.userId);
    const raw = storage.getItem(key);
    if (!active() || signal.aborted || !raw || canonical(JSON.parse(raw)) !== canonical(value))
      throw Error('changed');
    const current = await remote.pull(0, signal);
    validatePull(current, value.userId, 0);
    if (
      !active() ||
      signal.aborted ||
      storage.getItem(key) !== raw ||
      current.workspaceId ||
      value.phase === 'verified' ||
      (value.phase === 'unknown' &&
        (current.legacyRevision === value.prepared.manifest.revision ||
          (value.prepared.manifest.revision !== null &&
            (current.legacyRevision === null ||
              current.legacyRevision <= value.prepared.manifest.revision))))
    )
      throw Error('unknown');
    const retained = key + ':retained:' + value.prepared.operationId;
    if (storage.getItem(retained) !== null && storage.getItem(retained) !== raw)
      throw Error('changed');
    storage.setItem(retained, raw);
    if (storage.getItem(retained) !== raw) throw Error('storage');
    storage.removeItem(key); // Only the retained plan pointer, never vaults/records/cloud data.
  });
}
/** Only a consented plaintext recovery plan is persisted. Old vault/Guest keys are never written. */
export async function runConversion(input: {
  value: Conversion;
  remote: AccountTransport;
  legacy: CloudTransport;
  active: () => boolean;
  signal: AbortSignal;
  storage?: Storage;
}): Promise<AccountPull> {
  const { value, remote, legacy, active, signal } = input,
    storage = input.storage || localStorage;
  const key = conversionKey(value.userId);
  const ensure = () => {
    if (signal.aborted || !active()) throw Error('locked');
  };
  if (!navigator.locks) throw Error('locking unavailable');
  return navigator.locks.request(key, () =>
    navigator.locks.request(vaultKey(value.userId), async () => {
      ensure();
      await validateConversion(value, value.userId);
      ensure();
      let snapshot = storage.getItem(key);
      if (snapshot === null || canonical(JSON.parse(snapshot)) !== canonical(value))
        throw Error('changed');
      const persist = (phase: Conversion['phase']) => {
        ensure();
        if (storage.getItem(key) !== snapshot) throw Error('changed');
        const next = JSON.stringify({ ...value, phase });
        storage.setItem(key, next);
        snapshot = next;
      };
      const first = await remote.pull(0, signal);
      ensure();
      validatePull(first, value.userId, 0);
      if (!first.workspaceId) {
        // A restored consented plan has all validated plaintext already. Compare untouched source
        // bytes without unlocking/re-writing the old vault; cloud changes invalidate approval.
        const local: WorkspaceStore | null = value.source.localDatabase
          ? {
              key: vaultKey(value.userId),
              kind: 'account',
              read: () => ({
                db: structuredClone(value.source.localDatabase!),
                snapshot: value.source.localCiphertext,
                error: '',
              }),
              snapshot: () => storage.getItem(vaultKey(value.userId)),
              current: () =>
                storage.getItem(vaultKey(value.userId)) === value.source.localCiphertext,
              write: () => ({ ok: false, reason: 'unavailable' }),
              lock: () => {},
            }
          : null;
        if (!local && storage.getItem(vaultKey(value.userId)) !== null) throw Error('changed');
        await recheckLegacy(value.source, legacy, local, signal);
        ensure();
      }
      if (!remote.verifyConversion) throw Error('setup');
      persist('unknown');
      // Server's initialize receipt verifies exact operation UUID + manifest + body. No fresh UUID
      // on retry, no rebase; an unrelated established workspace rejects this request atomically.
      const receipt = await remote.initialize(
        value.prepared.operationId,
        value.prepared.rows,
        value.prepared.manifest.revision,
        signal,
        value.prepared.manifest,
      );
      ensure();
      const downloaded = await remote.pull(0, signal);
      ensure();
      validatePull(downloaded, value.userId, 0);
      if (
        downloaded.count !== downloaded.total ||
        receipt.userId !== value.userId ||
        receipt.operationId !== value.prepared.operationId ||
        receipt.workspaceId !== downloaded.workspaceId ||
        receipt.revision !== downloaded.revision ||
        !downloaded.snapshotDigest ||
        !/^[0-9a-f]{64}$/.test(downloaded.snapshotDigest)
      )
        throw Error('verification');
      verifyLegacyResult(
        value.prepared,
        downloaded.records.map(({ collection, id, value }) => ({ collection, id, value })),
        downloaded.userId,
        value.userId,
      );
      await remote.verifyConversion(
        value.prepared.operationId,
        downloaded.revision,
        downloaded.snapshotDigest,
        signal,
      );
      ensure();
      const final = await remote.pull(0, signal);
      ensure();
      validatePull(final, value.userId, 0, downloaded.workspaceId!);
      if (
        final.conversionState !== 'active' ||
        final.revision !== downloaded.revision ||
        final.count !== final.total
      )
        throw Error('verification');
      verifyLegacyResult(
        value.prepared,
        final.records.map(({ collection, id, value }) => ({ collection, id, value })),
        final.userId,
        value.userId,
      );
      materialize(final.records, value.prepared.db.settings.language);
      persist('verified');
      return final;
    }),
  );
}
