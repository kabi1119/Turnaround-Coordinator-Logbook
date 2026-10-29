import type { Database } from '../domain/model';
import type { WorkspaceStore, WriteResult } from '../workspaces/store';
import { materialize, pending, validateSyncDatabase } from '../sync/records';
import { recordKey } from '../sync/crypto';
import type { AccountPayload, AccountState } from './types';
import { AccountError } from './types';
import { validatePlan } from '../migration/plan';
import { validateMixed } from '../migration/mixed';
const identity = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function accountCacheKey(userId: string) {
  if (!identity.test(userId)) throw new AccountError('auth');
  return 'tco-cloud-account-cache-v1:' + userId;
}
export interface AccountStore extends WorkspaceStore {
  account: {
    read: () => AccountState;
    write: (
      db: Database,
      state: AccountState,
      expected: string | null | undefined,
    ) => Promise<WriteResult>;
    workspaceId: string;
    userId: string;
  };
}
export async function validatePayload(
  value: unknown,
  userId: string,
  workspaceId: string,
): Promise<AccountPayload> {
  const p = structuredClone(value) as AccountPayload;
  if (
    !p ||
    ![1, 2].includes(p.version) ||
    p.userId !== userId ||
    p.workspaceId !== workspaceId ||
    !identity.test(workspaceId)
  )
    throw new AccountError('invalid');
  validateSyncDatabase(p.db);
  const s = p.state;
  if (p.version === 2 && !s?.mixed) throw new AccountError('invalid');
  if (
    !s ||
    !Number.isSafeInteger(s.cursor) ||
    s.cursor < 1 ||
    !Array.isArray(s.base) ||
    s.base.length > 5000 ||
    !Array.isArray(s.conflicts) ||
    s.conflicts.some((k) => typeof k !== 'string') ||
    (s.lastSuccess !== null &&
      (typeof s.lastSuccess !== 'string' || !Number.isFinite(Date.parse(s.lastSuccess))))
  )
    throw new AccountError('invalid');
  if (s.mixed) await validateMixed(s.mixed, userId, workspaceId);
  if (
    s.base.some(
      (b) => !b || !Number.isSafeInteger(b.revision) || b.revision < 1 || b.revision > s.cursor,
    )
  )
    throw new AccountError('invalid');
  materialize(
    s.base.map((b) => b.record),
    p.db.settings.language,
  );
  const keys = new Set(s.base.map((b) => recordKey(b.record)));
  if (
    keys.size !== s.base.length ||
    new Set(s.conflicts).size !== s.conflicts.length ||
    s.conflicts.some((k) => !keys.has(k))
  )
    throw new AccountError('invalid');
  if (s.operation) {
    const op = s.operation;
    if (
      !identity.test(op.id) ||
      op.expected !== s.cursor ||
      !['edit', 'guest-merge', 'history-restore'].includes(op.purpose) ||
      !Array.isArray(op.changes) ||
      !op.changes.length ||
      new Set(op.changes.map(recordKey)).size !== op.changes.length
    )
      throw new AccountError('invalid');
    // Validate proposed snapshot as a whole, including tombstones and relationships.
    const proposed = new Map(s.base.map((b) => [recordKey(b.record), b.record]));
    for (const row of op.changes) proposed.set(recordKey(row), row);
    materialize([...proposed.values()], p.db.settings.language);
  }
  if (s.merge) {
    await validatePlan(s.merge, userId);
    if (s.merge.workspaceId !== workspaceId || s.merge.destinationRevision > s.cursor)
      throw new AccountError('invalid');
  }
  if (s.guestDelivery) {
    const d = s.guestDelivery,
      plan = s.merge || s.recovery?.merge;
    if (
      !plan ||
      d.operationId !== plan.operationId ||
      !['queued', 'unknown', 'rejected', 'expired', 'retired', 'committed'].includes(d.phase) ||
      (d.reason !== undefined &&
        !['source-changed', 'destination-changed', 'missing', 'server'].includes(d.reason)) ||
      (d.phase === 'committed' && s.operation?.purpose === 'guest-merge') ||
      (d.phase === 'queued' && plan.stage !== 'queued') ||
      (d.phase === 'committed' &&
        (!Number.isSafeInteger(d.receiptRevision) ||
          d.receiptRevision !== plan.destinationRevision + 1 ||
          d.receiptRevision > s.cursor))
    )
      throw new AccountError('invalid');
  }
  if (s.recovery) {
    const r = s.recovery;
    if (
      !['review', 'approved'].includes(r.stage) ||
      (r.guestReady !== undefined && typeof r.guestReady !== 'boolean') ||
      !Number.isSafeInteger(r.fromRevision) ||
      r.fromRevision < 1 ||
      r.fromRevision > s.cursor ||
      !Number.isFinite(Date.parse(r.at))
    )
      throw new AccountError('invalid');
    validateSyncDatabase(r.db);
    if (r.merge) {
      await validatePlan(r.merge, userId);
      if (r.merge.workspaceId !== workspaceId) throw new AccountError('invalid');
    }
    if (
      r.operation &&
      (!identity.test(r.operation.id) ||
        r.operation.expected !== r.fromRevision ||
        !['edit', 'guest-merge', 'history-restore'].includes(r.operation.purpose) ||
        !Array.isArray(r.operation.changes))
    )
      throw new AccountError('invalid');
  }
  return structuredClone(p);
}
/** New-mode only, after server-readable-model consent. Never reads/writes Guest or legacy vault keys.
 * Cache is device-local plaintext, NOT a passphrase vault; document device/origin/XSS risks.
 */
export async function openAccountCache(
  userId: string,
  workspaceId: string,
  initial: { db: Database; state: AccountState },
  currentIdentity: () => string | null,
  storage: Storage = localStorage,
): Promise<AccountStore> {
  const key = accountCacheKey(userId);
  if (currentIdentity() !== userId) throw new AccountError('auth');
  const raw = storage.getItem(key);
  let payload = await validatePayload(
    raw === null ? { version: 1, userId, workspaceId, ...initial } : JSON.parse(raw),
    userId,
    workspaceId,
  );
  let snapshot = raw,
    locked = false;
  const listeners = new Set<(reason: 'local' | 'sync' | 'lock') => void>();
  const allowed = () => !locked && currentIdentity() === userId;
  const ensure = () => {
    if (!allowed()) throw new AccountError('locked');
  };
  const emit = (reason: 'local' | 'sync' | 'lock') => {
    for (const fn of listeners) {
      try {
        fn(reason);
      } catch {
        /* Durable save cannot be undone by an observer. */
      }
    }
  };
  async function save(
    db: Database,
    state: AccountState,
    expected: string | null | undefined,
    reason: 'local' | 'sync',
  ): Promise<WriteResult> {
    const perform = async (): Promise<WriteResult> => {
      if (!allowed() || expected === undefined) return { ok: false, reason: 'unavailable' };
      if (storage.getItem(key) !== expected) return { ok: false, reason: 'conflict' };
      try {
        const next = await validatePayload(
          { version: state.mixed ? 2 : 1, userId, workspaceId, db, state },
          userId,
          workspaceId,
        );
        const serialized = JSON.stringify(next);
        if (new TextEncoder().encode(serialized).length > 16 * 1024 * 1024)
          return { ok: false, reason: 'invalid' };
        // Identity/sign-out and stale-tab fences after asynchronous validation.
        if (!allowed()) return { ok: false, reason: 'unavailable' };
        if (storage.getItem(key) !== expected) return { ok: false, reason: 'conflict' };
        storage.setItem(key, serialized);
        payload = next;
        snapshot = serialized;
        emit(reason);
        return { ok: true, snapshot: serialized };
      } catch {
        return { ok: false, reason: 'unavailable' };
      }
    };
    if (!navigator.locks) return { ok: false, reason: 'unavailable' };
    return navigator.locks.request(key, perform);
  }
  const store: AccountStore = {
    key,
    kind: 'account',
    storageModel: 'cloud-v2',
    read: () => {
      ensure();
      return { db: structuredClone(payload.db), snapshot, error: '' };
    },
    snapshot: () => storage.getItem(key),
    current: (db) =>
      allowed() &&
      storage.getItem(key) === snapshot &&
      JSON.stringify(db) === JSON.stringify(payload.db),
    write: async (db, expected) => {
      if (!allowed()) return { ok: false, reason: 'unavailable' };
      // An unresolved Guest submission owns its staged snapshot. Ordinary edits must
      // not be mixed into a payload whose remote outcome is still being established.
      if (
        (payload.state.mixed && payload.state.mixed.stage !== 'complete') ||
        payload.state.merge?.stage === 'queued' ||
        (payload.state.recovery?.stage === 'review' && payload.state.recovery.merge)
      )
        return { ok: false, reason: 'unavailable' };
      return save(db, payload.state, expected, 'local');
    },
    account: {
      userId,
      workspaceId,
      read: () => {
        ensure();
        return structuredClone(payload.state);
      },
      write: (db, state, expected) => save(db, state, expected, 'sync'),
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    lock: () => {
      locked = true;
      emit('lock');
      listeners.clear();
      payload = null as unknown as AccountPayload;
    },
  };
  if (raw === null) {
    const created = await save(initial.db, initial.state, null, 'sync');
    if (!created.ok) {
      store.lock();
      throw new AccountError('local');
    }
  }
  // pending() is derived from durable state; not exclusively navigator.onLine or in-memory flags.
  pending(store.read().db, store.account.read());
  return store;
}
