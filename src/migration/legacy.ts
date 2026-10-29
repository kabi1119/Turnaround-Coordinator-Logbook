import type { Database } from '../domain/model';
import type { WorkspaceStore } from '../workspaces/store';
import type { CloudTransport, KeyEnvelope, Pull, RecordData, SyncState } from '../sync/types';
import { decryptRecord, recordKey, unlockCloudKey } from '../sync/crypto';
import { canonical, materialize, records, validateSyncDatabase } from '../sync/records';
import { fingerprint } from './plan';
import { uuidV4 } from '../lib/uuid';
import { createBackup } from '../lib/backup';

export class LegacyMigrationError extends Error {
  constructor(
    public code:
      | 'incomplete'
      | 'incompatible'
      | 'identity'
      | 'changed'
      | 'backup'
      | 'verification'
      | 'reconciliation',
  ) {
    super(code);
  }
}
export type LegacyManifest = {
  version: 1;
  operationId: string;
  keyId: string | null;
  revision: number | null;
  recordCount: number;
  entries: {
    opaqueId: string;
    collection: RecordData['collection'];
    id: string;
    revision: number;
  }[];
  backupDigest: string;
  localVaultDigest: string | null;
};
export type LegacySource = {
  version: 1;
  userId: string;
  operationId: string;
  createdAt: string;
  cloud: Pull;
  cloudRecords: RecordData[];
  cloudDatabase: Database;
  localDatabase: Database | null;
  localCiphertext: string | null;
  localDigest: string | null;
  localSync?: SyncState | null;
  cloudDigest: string;
};
function checkPull(p: Pull, userId: string) {
  if (
    !p ||
    p.version !== 1 ||
    p.userId !== userId ||
    !Number.isSafeInteger(p.revision) ||
    p.revision < 0 ||
    !Array.isArray(p.records) ||
    p.count !== p.records.length ||
    p.total !== p.records.length ||
    p.records.length > 5000 ||
    JSON.stringify(p).length > 9 * 1024 * 1024 ||
    (!p.envelope && (p.revision || p.records.length))
  )
    throw new LegacyMigrationError('incomplete');
  const ids = new Set<string>();
  for (const row of p.records) {
    if (
      !row ||
      row.userId !== userId ||
      !Number.isSafeInteger(row.revision) ||
      row.revision < 1 ||
      row.revision > p.revision ||
      ids.has(row.recordId)
    )
      throw new LegacyMigrationError('incomplete');
    ids.add(row.recordId);
  }
}
/** Read-only inspection. Never writes to the old local vault or calls a legacy push/initialize RPC. */
export async function inspectLegacy(input: {
  userId: string;
  remote: CloudTransport;
  cloudPassphrase: string;
  local: WorkspaceStore | null;
  signal: AbortSignal;
}): Promise<LegacySource> {
  if (
    input.local &&
    (input.local.kind !== 'account' || input.local.key !== 'tco-account-vault-v1:' + input.userId)
  )
    throw new LegacyMigrationError('identity');
  const original = input.local ? structuredClone(input.local.read()) : undefined,
    cipher = input.local?.snapshot() ?? null;
  const cloud = await input.remote.pull(0, input.signal);
  if (input.signal.aborted) throw new LegacyMigrationError('changed');
  checkPull(cloud, input.userId);
  const rows: RecordData[] = [];
  if (cloud.envelope) {
    const keys = await unlockCloudKey(cloud.envelope, input.userId, input.cloudPassphrase);
    for (const row of cloud.records) {
      if (input.signal.aborted) throw new LegacyMigrationError('changed');
      rows.push(await decryptRecord(keys, row));
    }
  }
  input.cloudPassphrase = '';
  if (new Set(rows.map(recordKey)).size !== rows.length)
    throw new LegacyMigrationError('incomplete');
  let cloudDatabase: Database;
  try {
    cloudDatabase = materialize(rows, original?.db.settings.language || 'en');
    if (original) validateSyncDatabase(original.db);
  } catch {
    throw new LegacyMigrationError('incompatible');
  }
  if (input.local && (input.local.snapshot() !== cipher || !input.local.current(original!.db)))
    throw new LegacyMigrationError('changed');
  return {
    version: 1,
    userId: input.userId,
    operationId: uuidV4(),
    createdAt: new Date().toISOString(),
    cloud: structuredClone(cloud),
    cloudRecords: structuredClone(rows),
    cloudDatabase,
    localDatabase: original ? structuredClone(original.db) : null,
    localCiphertext: cipher,
    localDigest: cipher === null ? null : await fingerprint(cipher),
    localSync: input.local?.sync?.read() || null,
    cloudDigest: await fingerprint(cloud),
  };
}
export function legacyBackupText(source: LegacySource): string {
  // This independent file intentionally contains plaintext AND untouched encrypted recovery bytes.
  // UI must disclose it, trigger download, and read back/verify the actual selected file.
  return JSON.stringify(
    {
      kind: 'tco-legacy-conversion-backup',
      version: 1,
      userId: source.userId,
      operationId: source.operationId,
      legacyRevision: source.cloud.envelope ? source.cloud.revision : null,
      cloud: {
        backup: createBackup(source.cloudDatabase, new Date(source.createdAt)),
        records: source.cloudRecords,
        envelope: source.cloud.envelope,
        ciphertext: source.cloud.records,
      },
      local: source.localDatabase
        ? {
            backup: createBackup(source.localDatabase, new Date(source.createdAt)),
            encryptedVault: source.localCiphertext,
            sync: source.localSync || null,
          }
        : null,
    },
    null,
    2,
  );
}
export async function verifyLegacyBackup(source: LegacySource, readBack: string): Promise<string> {
  const expected = legacyBackupText(source);
  if ((await fingerprint(readBack)) !== (await fingerprint(expected)))
    throw new LegacyMigrationError('backup');
  // Also parse independently, so a download claim/string length alone cannot count as verification.
  const parsed = JSON.parse(readBack);
  if (
    parsed.kind !== 'tco-legacy-conversion-backup' ||
    parsed.userId !== source.userId ||
    parsed.operationId !== source.operationId
  )
    throw new LegacyMigrationError('backup');
  return fingerprint(readBack);
}
export async function recheckLegacy(
  source: LegacySource,
  remote: CloudTransport,
  local: WorkspaceStore | null,
  signal: AbortSignal,
) {
  const current = await remote.pull(0, signal);
  checkPull(current, source.userId);
  if (
    signal.aborted ||
    (source.localDatabase === null && local !== null) ||
    (source.localDatabase !== null && (!local || !local.current(source.localDatabase))) ||
    (await fingerprint(current)) !== source.cloudDigest ||
    (source.localDigest !== null &&
      (!local ||
        local.key !== 'tco-account-vault-v1:' + source.userId ||
        (await fingerprint(local.snapshot())) !== source.localDigest))
  )
    throw new LegacyMigrationError('changed');
}
export async function prepareLegacyConversion(
  source: LegacySource,
  proposed: Database,
  backupDigest: string,
  consent: boolean,
  decisions?: LegacyDecisions,
) {
  if (consent !== true || backupDigest !== (await fingerprint(legacyBackupText(source))))
    throw new LegacyMigrationError('backup');
  validateSyncDatabase(proposed);
  const target = new Map(
    (decisions ? reconcileLegacy(source, decisions).rows : records(proposed)).map((row) => [
      recordKey(row),
      row,
    ]),
  );
  const entries: LegacyManifest['entries'] = [];
  for (let i = 0; i < source.cloudRecords.length; i++) {
    const record = source.cloudRecords[i],
      key = recordKey(record),
      cipher = source.cloud.records[i];
    if (record.value !== null && !target.has(key)) throw new LegacyMigrationError('incomplete');
    // Original tombstones remain represented, rather than disappearing in materialization.
    if (!target.has(key)) target.set(key, structuredClone(record));
    entries.push({
      opaqueId: cipher.recordId,
      collection: record.collection,
      id: record.id,
      revision: cipher.revision,
    });
  }
  // A changed source requires an explicit choice for every differing identity, including
  // conflict alternatives retained inside the encrypted local sync baseline.
  const authoritative = source.cloud.envelope ? source.cloudDatabase : source.localDatabase;
  if (
    !authoritative ||
    (decisions
      ? canonical(proposed) !== canonical(reconcileLegacy(source, decisions).db)
      : canonical(proposed) !== canonical(authoritative) ||
        (source.localDatabase &&
          source.cloud.envelope &&
          canonical(source.localDatabase) !== canonical(source.cloudDatabase)) ||
        !!source.localSync?.conflicts.length)
  )
    throw new LegacyMigrationError('reconciliation');
  const manifest: LegacyManifest = {
    version: 1,
    operationId: source.operationId,
    keyId: source.cloud.envelope?.keyId ?? null,
    revision: source.cloud.envelope ? source.cloud.revision : null,
    recordCount: source.cloud.records.length,
    entries,
    backupDigest,
    localVaultDigest: source.localDigest,
  };
  return {
    operationId: source.operationId,
    manifest,
    rows: [...target.values()].sort((a, b) => (recordKey(a) < recordKey(b) ? -1 : 1)),
    db: structuredClone(proposed),
  };
}
export type LegacyDecisions = Record<
  string,
  { choice: 'cloud' | 'local' | 'baseline' | 'manual'; value?: unknown }
>;
export function legacyDifferences(source: LegacySource) {
  const cloud = new Map(source.cloudRecords.map((r) => [recordKey(r), r]));
  const local = new Map(
    (source.localDatabase ? records(source.localDatabase) : []).map((r) => [recordKey(r), r]),
  );
  const base = new Map((source.localSync?.base || []).map((r) => [recordKey(r.record), r.record]));
  if (source.localDatabase)
    for (const [key, row] of base) if (!local.has(key)) local.set(key, { ...row, value: null });
  return [...new Set([...cloud.keys(), ...local.keys(), ...base.keys()])].sort().map((key) => {
    const c = cloud.get(key),
      l = local.get(key),
      b = base.get(key),
      row = c || l || b!;
    const choices = [c, l, ...(source.localSync?.conflicts.includes(key) ? [b] : [])].filter(
      (r): r is RecordData => !!r,
    );
    const differs =
      new Set(choices.map((r) => canonical(r.value))).size > 1 ||
      (!!source.localDatabase && !!source.cloud.envelope && !!c !== !!l) ||
      !!source.localSync?.conflicts.includes(key);
    return {
      key,
      collection: row.collection,
      id: row.id,
      cloud: c,
      local: l,
      baseline: b,
      differs,
    };
  });
}
export function reconcileLegacy(source: LegacySource, decisions: LegacyDecisions) {
  const rows = legacyDifferences(source).map((row) => {
    const d = decisions[row.key];
    if (!row.differs) return structuredClone(row.local || row.cloud || row.baseline!);
    if (!d) throw new LegacyMigrationError('reconciliation');
    const selected =
      d.choice === 'manual'
        ? { collection: row.collection, id: row.id, value: d.value }
        : row[d.choice];
    // Absence is not implicit deletion: a sole source record must be retained or manually reviewed.
    if (!selected || selected.value === undefined) throw new LegacyMigrationError('reconciliation');
    if (row.collection === 'privacy' && selected.value === null)
      throw new LegacyMigrationError('reconciliation');
    return structuredClone(selected);
  });
  if (
    !rows.some((row) => row.collection === 'privacy' && row.id === 'settings' && row.value !== null)
  )
    throw new LegacyMigrationError('incomplete');
  const db = materialize(
    rows,
    source.localDatabase?.settings.language || source.cloudDatabase.settings.language,
  );
  return { db, rows };
}
export function verifyLegacyResult(
  prepared: Awaited<ReturnType<typeof prepareLegacyConversion>>,
  rows: RecordData[],
  userId: string,
  expectedUserId: string,
) {
  if (userId !== expectedUserId) throw new LegacyMigrationError('identity');
  const ordered = (list: RecordData[]) =>
    [...list].sort((a, b) => (recordKey(a) < recordKey(b) ? -1 : 1));
  if (
    canonical(ordered(rows)) !== canonical(ordered(prepared.rows)) ||
    canonical(materialize(rows, prepared.db.settings.language)) !== canonical(prepared.db)
  )
    throw new LegacyMigrationError('verification');
}
export type LegacyWrappedKey = KeyEnvelope;
