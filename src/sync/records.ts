import type { Database } from '../domain/model';
import { restrictivePrivacy } from '../domain/model';
import { validateBackupDatabase, MAX_BACKUP_BYTES } from '../lib/backup';
import { recordKey, validateKey } from './crypto';
import type { BaseRecord, RecordData, SyncState } from './types';
import { SyncError } from './types';
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object')
    return (
      '{' +
      Object.entries(v)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => JSON.stringify(k) + ':' + canonical(x))
        .join(',') +
      '}'
    );
  return JSON.stringify(v);
}
export const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
export function records(db: Database): RecordData[] {
  return [
    ...(['duties', 'aircraft', 'journals'] as const).flatMap((collection) =>
      db[collection].map((value) => ({ collection, id: value.id, value })),
    ),
    { collection: 'privacy' as const, id: 'settings', value: db.settings.privacy },
  ];
}
export function materialize(
  rows: RecordData[],
  language: Database['settings']['language'],
): Database {
  const db: Database = {
    version: 1,
    duties: [],
    aircraft: [],
    journals: [],
    settings: { language, privacy: { ...restrictivePrivacy } },
  };
  const seen = new Set<string>();
  for (const r of rows) {
    const key = recordKey(r);
    if (seen.has(key)) throw new SyncError('invalid');
    seen.add(key);
    if (r.value === null) continue;
    if (r.collection === 'privacy')
      db.settings.privacy = r.value as Database['settings']['privacy'];
    else {
      if ((r.value as { id?: unknown })?.id !== r.id) throw new SyncError('invalid');
      (db[r.collection] as unknown[]).push(r.value);
    }
  }
  validateSyncDatabase(db);
  return db;
}
export function validateSyncDatabase(db: Database) {
  if (new TextEncoder().encode(JSON.stringify(db)).length > MAX_BACKUP_BYTES)
    throw new SyncError('capacity');
  validateBackupDatabase(db);
}
export function pending(db: Database, state: Pick<SyncState, 'base'>): RecordData[] {
  const local = new Map(records(db).map((r) => [recordKey(r), r]));
  const base = new Map(state.base.map((b) => [recordKey(b.record), b.record]));
  return [...new Set([...local.keys(), ...base.keys()])].flatMap((key) => {
    const before = base.get(key),
      after = local.get(key);
    if (same(before?.value ?? null, after?.value ?? null)) return [];
    return [after || { ...before!, value: null }];
  });
}
export function reconcile<S extends Pick<SyncState, 'base' | 'cursor' | 'conflicts'>>(
  db: Database,
  state: S,
  changes: BaseRecord[],
  cursor: number,
) {
  const local = new Map(records(db).map((r) => [recordKey(r), r]));
  const previous = new Map(state.base.map((b) => [recordKey(b.record), b]));
  const base = new Map(previous),
    conflicts = new Set(state.conflicts);
  for (const incoming of changes) {
    const key = recordKey(incoming.record),
      before = previous.get(key)?.record.value ?? null;
    const current = local.get(key)?.value ?? null,
      remote = incoming.record.value;
    if (incoming.revision <= (previous.get(key)?.revision || 0)) throw new SyncError('invalid');
    base.set(key, incoming);
    if (same(current, remote)) {
      conflicts.delete(key);
      continue;
    }
    if (!conflicts.has(key) && same(current, before)) local.set(key, incoming.record);
    else conflicts.add(key);
  }
  // Validate the complete remote graph, not just each decrypted record.
  materialize(
    [...base.values()].map((b) => b.record),
    db.settings.language,
  );
  let next = db;
  try {
    next = materialize([...local.values()], db.settings.language);
  } catch {
    // A cross-record edit/delete conflict must not leave broken links or lose either graph.
    const original = new Map(records(db).map((r) => [recordKey(r), r]));
    for (const [key, b] of base)
      if (!same(original.get(key)?.value ?? null, b.record.value)) conflicts.add(key);
  }
  return {
    db: next,
    state: { ...state, cursor, base: [...base.values()], conflicts: [...conflicts] },
  };
}
export function resolve<S extends Pick<SyncState, 'base' | 'cursor' | 'conflicts'>>(
  db: Database,
  state: S,
  choices: Record<string, 'local' | 'cloud'>,
) {
  const rows = new Map(records(db).map((r) => [recordKey(r), r]));
  const base = new Map(state.base.map((b) => [recordKey(b.record), b.record]));
  for (const key of state.conflicts) {
    if (!choices[key]) throw new SyncError('conflict');
    if (choices[key] === 'cloud') {
      const r = base.get(key);
      if (r) rows.set(key, r);
      else rows.delete(key);
    }
  }
  return {
    db: materialize([...rows.values()], db.settings.language),
    state: { ...state, conflicts: [] },
  };
}
export function validateSyncState(value: unknown, userId: string): asserts value is SyncState {
  const s = value as SyncState;
  if (
    !s ||
    s.version !== 1 ||
    typeof s.enabled !== 'boolean' ||
    !Number.isSafeInteger(s.cursor) ||
    s.cursor < 0 ||
    !Array.isArray(s.base) ||
    s.base.length > 5000 ||
    !Array.isArray(s.conflicts) ||
    !s.conflicts.every((x) => typeof x === 'string') ||
    (s.lastSuccess !== null &&
      (typeof s.lastSuccess !== 'string' || !Number.isFinite(Date.parse(s.lastSuccess))))
  )
    throw new SyncError('invalid');
  validateKey(s.envelope, userId);
  if (
    s.base.some(
      (b) => !b || !Number.isSafeInteger(b.revision) || b.revision < 1 || b.revision > s.cursor,
    )
  )
    throw new SyncError('invalid');
  materialize(
    s.base.map((b) => b.record),
    'en',
  );
}
