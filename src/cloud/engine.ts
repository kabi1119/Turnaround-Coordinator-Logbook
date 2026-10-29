import type { AccountStore } from './cache';
import type {
  AccountOperation,
  AccountPull,
  AccountReceipt,
  AccountState,
  AccountTransport,
  MergeOutcome,
  HistoryResponse,
  HistoryRow,
} from './types';
import { AccountError, type ArchiveExport } from './types';
import { verifyArchive } from './archive';
import {
  materialize,
  records,
  pending,
  reconcile,
  resolve,
  same,
  validateSyncDatabase,
} from '../sync/records';
import { recordKey } from '../sync/crypto';
import type { BaseRecord, RecordData } from '../sync/types';
import { uuidV4 } from '../lib/uuid';
import { STORAGE_KEY } from '../lib/storage';
import { fingerprint, validatePlan, verifyReceipt, type MergePlan } from '../migration/plan';
import {
  createMixed,
  laterEdits,
  mixedSource,
  mixedRows,
  mixedResult,
  type MixedDecision,
} from '../migration/mixed';
function guestSourceStill(raw: string) {
  try {
    return localStorage.getItem(STORAGE_KEY) === raw;
  } catch {
    return false;
  }
}
export type AccountStatus = {
  phase: 'pending' | 'syncing' | 'synced' | 'paused' | 'conflict';
  pending: number;
  conflicts: number;
  lastSuccess: string | null;
  error: string;
  capacity?: AccountPull['capacity'];
};
export function validatePull(p: AccountPull, userId: string, cursor: number, workspaceId?: string) {
  if (
    !p ||
    p.version !== 2 ||
    p.userId !== userId ||
    !Number.isSafeInteger(p.revision) ||
    p.revision < cursor ||
    typeof p.established !== 'boolean' ||
    !Array.isArray(p.records) ||
    p.count !== p.records.length ||
    !Number.isSafeInteger(p.total) ||
    p.total < 0 ||
    p.total > 5000 ||
    p.records.length > 5000 ||
    JSON.stringify(p).length > 9 * 1024 * 1024 ||
    (workspaceId !== undefined && p.workspaceId !== workspaceId) ||
    (!p.workspaceId && (p.records.length || p.revision !== 0)) ||
    (p.workspaceId !== null && !/^[0-9a-f-]{36}$/i.test(p.workspaceId))
  )
    throw new AccountError('invalid');
  if (
    (p.legacyRevision !== null &&
      (!Number.isSafeInteger(p.legacyRevision) || p.legacyRevision < 0)) ||
    (!p.workspaceId && p.established !== (p.legacyRevision !== null)) ||
    (p.workspaceId !== null && (!p.established || p.revision < 1))
  )
    throw new AccountError('invalid');
  if (
    p.replayFloor !== undefined &&
    (!Number.isSafeInteger(p.replayFloor) || p.replayFloor < 0 || p.replayFloor > p.revision)
  )
    throw new AccountError('invalid');
  if (p.capacity && Object.values(p.capacity).some((n) => !Number.isSafeInteger(n) || n < 0))
    throw new AccountError('invalid');
  const ids = new Set<string>();
  for (const row of p.records) {
    if (
      !row ||
      !Number.isSafeInteger(row.revision) ||
      row.revision <= cursor ||
      row.revision > p.revision
    )
      throw new AccountError('invalid');
    if (
      !['aircraft', 'duties', 'journals', 'privacy'].includes(row.collection) ||
      typeof row.id !== 'string' ||
      !row.id.trim() ||
      row.id.length > 512 ||
      Object.keys(row).sort().join(',') !== 'collection,id,revision,value'
    )
      throw new AccountError('invalid');
    const key = recordKey(row);
    if (ids.has(key)) throw new AccountError('invalid');
    ids.add(key);
  }
  if (p.revision > cursor && !p.records.length) throw new AccountError('invalid');
}
export function stateFromPull(p: AccountPull, userId: string, language: 'en' | 'zh-HK' = 'en') {
  validatePull(p, userId, 0);
  if (
    !p.workspaceId ||
    p.total !== p.records.length ||
    !p.records.some((r) => r.collection === 'privacy' && r.id === 'settings' && r.value !== null)
  )
    throw new AccountError('setup');
  const base: BaseRecord[] = p.records.map(({ revision, ...record }) => ({ record, revision }));
  const db = materialize(
    base.map((b) => b.record),
    language,
  );
  const state: AccountState = {
    cursor: p.revision,
    base,
    conflicts: [],
    operation: null,
    lastSuccess: new Date().toISOString(),
    merge: null,
  };
  return { db, state };
}
/** No keys/passphrase or daily enable step. Used ONLY after verified new-mode onboarding.
 * Every pending operation and conflict is part of the durable user-scoped account cache.
 */
export class AccountEngine {
  private capacity: AccountPull['capacity'];
  private stopped = false;
  private epoch = 0;
  private busy = false;
  private rerun = false;
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private unsubscribe: () => void;
  private status: AccountStatus = {
    phase: 'pending',
    pending: 0,
    conflicts: 0,
    lastSuccess: null,
    error: '',
  };
  constructor(
    readonly store: AccountStore,
    private remote: AccountTransport,
    private safe: () => boolean = () =>
      !document.querySelector('dialog[open]:not([data-sync-control="true"])'),
    private invalidSession: () => void = () => {},
  ) {
    if (
      store.kind !== 'account' ||
      store.key !== 'tco-cloud-account-cache-v1:' + store.account.userId
    )
      throw new AccountError('auth');
    this.unsubscribe = store.subscribe!((reason) => {
      if (reason === 'lock') {
        this.stop();
        return;
      }
      if (reason === 'local') {
        this.refresh();
        this.schedule();
      }
    });
    this.refresh();
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.status;
  state = () => this.store.account.read();
  canRun = () => !this.stopped && !this.busy;
  private refresh(phase?: AccountStatus['phase'], error = '') {
    if (this.stopped) return;
    const state = this.state(),
      count = Math.max(
        pending(this.store.read().db, state).length,
        state.mixed && state.mixed.stage !== 'complete'
          ? mixedSource(state.mixed.originalCache).changes.length
          : 0,
      );
    this.status = {
      phase:
        phase ||
        (state.conflicts.length
          ? 'conflict'
          : count ||
              state.operation ||
              state.merge?.stage === 'permission' ||
              state.merge?.stage === 'review' ||
              state.merge?.stage === 'queued' ||
              (state.recovery?.stage === 'review' && state.recovery.merge)
            ? 'pending'
            : state.lastSuccess
              ? 'synced'
              : 'pending'),
      pending: Math.max(count, state.operation?.changes.length || 0),
      conflicts: state.conflicts.length,
      lastSuccess: state.lastSuccess,
      error,
      capacity: this.capacity,
    };
    for (const fn of this.listeners) fn();
  }
  private check(turn: number) {
    if (this.stopped || turn !== this.epoch || this.controller?.signal.aborted)
      throw new AccountError('locked');
    if (!this.store.current(this.store.read().db)) throw new AccountError('local');
  }
  private schedule = () => {
    clearTimeout(this.timer);
    if (!this.stopped) this.timer = setTimeout(() => void this.run(), 1200);
  };
  private async persist(
    db: ReturnType<AccountStore['read']>['db'],
    state: AccountState,
    expected: string | null | undefined,
    turn: number,
  ) {
    this.check(turn);
    if (!this.safe()) throw new AccountError('editing');
    const result = await this.store.account.write(db, state, expected);
    this.check(turn);
    if (!result.ok) throw new AccountError('local');
  }
  private async send(operation: AccountOperation, turn: number) {
    if (
      this.state().mixed?.stage === 'queued' &&
      this.state().mixed?.operationId === operation.id
    ) {
      const current = this.store.read(),
        state = this.state();
      await this.persist(
        current.db,
        { ...state, mixed: { ...state.mixed!, delivery: 'unknown' } },
        current.snapshot,
        turn,
      );
    }
    if (operation.purpose === 'guest-merge') {
      const current = this.store.read(),
        state = this.state(),
        plan = state.merge;
      if (!plan || plan.stage !== 'queued' || plan.operationId !== operation.id)
        throw new AccountError('invalid');
      if (state.guestDelivery?.phase === 'queued') {
        let reason: 'source-changed' | 'destination-changed' | undefined;
        if (!guestSourceStill(plan.sourceSnapshot)) reason = 'source-changed';
        else {
          const full = await this.remote.pull(0, this.controller!.signal);
          this.check(turn);
          validatePull(full, this.store.account.userId, 0, this.store.account.workspaceId);
          if (
            full.revision !== operation.expected ||
            !same(
              stateFromPull(full, this.store.account.userId, plan.destination.settings.language).db,
              plan.destination,
            )
          )
            reason = 'destination-changed';
        }
        if (reason) {
          await this.persist(
            current.db,
            {
              ...state,
              guestDelivery: {
                operationId: operation.id,
                phase: 'queued',
                reason,
              },
            },
            current.snapshot,
            turn,
          );
          throw new AccountError('conflict');
        }
      }
      // Persist BEFORE invoking transport. A crash here is conservatively uncertain.
      await this.persist(
        current.db,
        {
          ...state,
          lastSuccess: null,
          guestDelivery: {
            operationId: operation.id,
            phase: 'unknown',
          },
        },
        current.snapshot,
        turn,
      );
      this.refresh('syncing');
    }
    let receipt: AccountReceipt;
    try {
      receipt = await this.remote.push(operation, this.controller!.signal);
    } catch (error) {
      if (
        operation.purpose === 'guest-merge' &&
        error instanceof AccountError &&
        ['conflict', 'archived', 'retired'].includes(error.code)
      ) {
        this.check(turn);
        const current = this.store.read(),
          state = this.state();
        await this.persist(
          current.db,
          {
            ...state,
            guestDelivery: {
              operationId: operation.id,
              phase:
                error.code === 'archived'
                  ? 'expired'
                  : error.code === 'retired'
                    ? 'retired'
                    : 'rejected',
              reason: 'server',
            },
          },
          current.snapshot,
          turn,
        );
      }
      throw error;
    }
    return this.acknowledge(operation, receipt, turn);
  }
  private async acknowledge(operation: AccountOperation, receipt: AccountReceipt, turn: number) {
    this.check(turn);
    if (operation.purpose === 'guest-merge') await this.captureMixed(turn);
    if (
      !receipt ||
      receipt.version !== 2 ||
      receipt.userId !== this.store.account.userId ||
      receipt.workspaceId !== this.store.account.workspaceId ||
      receipt.operationId !== operation.id ||
      receipt.revision !== operation.expected + 1
    )
      throw new AccountError('invalid');
    const current = this.store.read(),
      state = this.state();
    if (state.operation?.id !== operation.id || state.cursor !== operation.expected)
      throw new AccountError('local');
    const base = new Map(state.base.map((b) => [recordKey(b.record), b]));
    for (const record of operation.changes)
      base.set(recordKey(record), { record, revision: receipt.revision });
    // Our own receipt advances the baseline; edits made during upload stay dirty,
    // rather than being mistaken for another device's conflicting edit.
    await this.persist(
      current.db,
      {
        ...state,
        cursor: receipt.revision,
        base: [...base.values()],
        operation: null,
        ...(operation.purpose === 'guest-merge'
          ? {
              guestDelivery: {
                operationId: operation.id,
                phase: 'committed' as const,
                receiptRevision: receipt.revision,
              },
            }
          : {}),
        ...(state.mixed?.operationId === operation.id
          ? { mixed: { ...state.mixed, delivery: 'committed' as const } }
          : {}),
        ...(state.mixed?.stage === 'awaiting-cloud' &&
        operation.purpose === 'edit' &&
        mixedSource(state.mixed.originalCache).retainedOperation?.id === operation.id
          ? {
              mixed: {
                ...state.mixed,
                retained: {
                  id: operation.id,
                  outcome: 'committed' as const,
                  revision: receipt.revision,
                },
              },
            }
          : {}),
        lastSuccess: null,
      },
      current.snapshot,
      turn,
    );
    return receipt;
  }
  private fullChanges(response: AccountPull, state: AccountState) {
    validatePull(response, this.store.account.userId, 0, this.store.account.workspaceId);
    if (response.total !== response.records.length || response.revision < state.cursor)
      throw new AccountError('invalid');
    const previous = new Map(state.base.map((b) => [recordKey(b.record), b]));
    if (state.base.some((b) => !response.records.some((r) => recordKey(r) === recordKey(b.record))))
      throw new AccountError('invalid');
    return response.records.flatMap(({ revision, ...record }) => {
      const old = previous.get(recordKey(record));
      if (old && revision <= old.revision) {
        if (revision !== old.revision || !same(record, old.record))
          throw new AccountError('invalid');
        return [];
      }
      return [{ record, revision }];
    });
  }
  private async captureMixed(turn: number) {
    const state = this.state(),
      current = this.store.read();
    if (state.mixed && state.mixed.stage !== 'complete') return;
    const plan =
      state.merge?.stage === 'queued'
        ? state.merge
        : state.recovery?.stage === 'review'
          ? state.recovery.merge
          : null;
    const later =
      state.recovery?.stage === 'review' && state.recovery.merge ? state.recovery.db : current.db;
    if (
      !plan ||
      plan.stage !== 'queued' ||
      (!laterEdits(later, plan).length && state.operation?.purpose !== 'edit')
    )
      return;
    if (!current.snapshot) throw new AccountError('local');
    const mixed = await createMixed(
      current.snapshot,
      this.store.account.userId,
      this.store.account.workspaceId,
    );
    await this.persist(current.db, { ...state, mixed, lastSuccess: null }, current.snapshot, turn);
  }
  private mixedActive() {
    const m = this.state().mixed;
    return !!m && m.stage !== 'complete';
  }
  private async finishGuest(turn: number) {
    await this.captureMixed(turn);
    const before = this.store.read(),
      state = this.state(),
      plan = state.merge;
    if (!plan || plan.stage !== 'queued' || state.operation || !plan.queuedResult)
      throw new AccountError('local');
    const response = await this.remote.pull(0, this.controller!.signal);
    this.check(turn);
    const changes = this.fullChanges(response, state);
    const committed = state.guestDelivery?.phase === 'committed';
    if (
      !committed &&
      (!guestSourceStill(plan.sourceSnapshot) ||
        !same(plan.queuedResult, plan.destination) ||
        response.revision !== plan.destinationRevision ||
        !same(
          stateFromPull(response, this.store.account.userId, plan.destination.settings.language).db,
          plan.queuedResult,
        ))
    ) {
      await this.persist(
        before.db,
        {
          ...state,
          guestDelivery: {
            operationId: plan.operationId,
            phase: 'queued',
            reason: !guestSourceStill(plan.sourceSnapshot)
              ? 'source-changed'
              : 'destination-changed',
          },
        },
        before.snapshot,
        turn,
      );
      throw new AccountError('conflict');
    }
    const merged = reconcile(before.db, state, changes, response.revision);
    if (merged.state.base.length !== response.total) throw new AccountError('invalid');
    // The exact-payload receipt proves the original transaction committed. A later
    // independent snapshot may include other-device edits; never replay the import.
    const verifiedPlan = committed
      ? {
          ...plan,
          stage: 'verified' as const,
          verifiedRevision: state.guestDelivery!.receiptRevision!,
        }
      : verifyReceipt(plan, {
          userId: this.store.account.userId,
          workspaceId: this.store.account.workspaceId,
          operationId: plan.operationId,
          revision: response.revision,
          db: merged.db,
          verification: 'read',
        });
    if (state.mixed && state.mixed.stage !== 'complete') {
      const fresh = stateFromPull(response, this.store.account.userId, before.db.settings.language);
      const original = mixedSource(state.mixed.originalCache);
      const isOriginal = plan.operationId === original.plan.operationId;
      await this.persist(
        fresh.db,
        {
          ...fresh.state,
          merge: verifiedPlan,
          guestDelivery: committed ? state.guestDelivery : undefined,
          recovery: state.recovery ? { ...state.recovery, stage: 'approved' } : undefined,
          mixed: {
            ...state.mixed,
            stage: 'account-review',
            outcome: isOriginal ? 'committed' : state.mixed.outcome,
            guestPlan: isOriginal ? null : verifiedPlan,
            cloudRevision: response.revision,
            decisions: {},
            delivery: undefined,
          },
          lastSuccess: null,
        },
        before.snapshot,
        turn,
      );
      this.refresh('pending');
      return;
    }
    await this.persist(
      merged.db,
      {
        ...merged.state,
        merge: verifiedPlan,
        guestDelivery: committed ? state.guestDelivery : undefined,
        lastSuccess:
          !merged.state.conflicts.length && !pending(merged.db, merged.state).length
            ? new Date().toISOString()
            : null,
      },
      before.snapshot,
      turn,
    );
    this.capacity = response.capacity;
    this.refresh();
  }
  private async finishMixed(turn: number) {
    const current = this.store.read(),
      state = this.state();
    if (
      !state.mixed ||
      state.mixed.stage !== 'queued' ||
      state.mixed.delivery !== 'committed' ||
      state.operation
    )
      throw new AccountError('local');
    const response = await this.remote.pull(0, this.controller!.signal);
    this.check(turn);
    const changes = this.fullChanges(response, state);
    const final = reconcile(current.db, state, changes, response.revision);
    if (final.state.base.length !== response.total) throw new AccountError('invalid');
    await this.persist(
      final.db,
      {
        ...final.state,
        mixed: { ...state.mixed, stage: 'complete' },
        lastSuccess:
          !final.state.conflicts.length && !pending(final.db, final.state).length
            ? new Date().toISOString()
            : null,
      },
      current.snapshot,
      turn,
    );
    this.refresh();
  }
  async run() {
    if (this.stopped) return;
    if (this.busy) {
      this.rerun = true;
      return;
    }
    const mixed = this.state().mixed;
    if (
      mixed &&
      mixed.stage !== 'complete' &&
      mixed.stage !== 'queued' &&
      !(mixed.stage === 'guest-review' && this.state().merge?.stage === 'queued')
    ) {
      this.refresh('pending', 'editing');
      return;
    }
    if (this.state().recovery?.stage === 'review') {
      this.refresh('paused', 'archived');
      return;
    }
    if (!this.safe()) {
      this.refresh('pending', 'editing');
      return;
    }
    if (!navigator.locks) {
      this.refresh('paused', 'locks');
      return;
    }
    this.busy = true;
    const turn = this.epoch;
    this.controller = new AbortController();
    this.refresh('syncing');
    try {
      await navigator.locks.request(
        'tco-cloud-account-sync:' + this.store.account.userId,
        { ifAvailable: true },
        async (lock) => {
          if (!lock) throw new AccountError('local');
          this.check(turn);
          await this.captureMixed(turn);
          if (this.state().mixed?.stage === 'awaiting-cloud') {
            this.refresh('pending', 'editing');
            return;
          }
          // Retry the durable exact operation BEFORE downloading newer revisions.
          // This distinguishes a lost acknowledgement from an uncommitted concurrent edit.
          const outstanding = this.state().operation;
          if (
            !outstanding &&
            this.state().mixed?.stage === 'queued' &&
            this.state().mixed?.delivery === 'committed'
          ) {
            await this.finishMixed(turn);
            return;
          }
          if (
            outstanding?.purpose === 'guest-merge' &&
            this.state().guestDelivery?.phase !== 'queued'
          ) {
            this.refresh(
              'paused',
              this.state().guestDelivery?.phase === 'expired' ? 'archived' : 'conflict',
            );
            return;
          }
          if (outstanding) {
            try {
              await this.send(outstanding, turn);
              if (outstanding.purpose === 'guest-merge') {
                await this.finishGuest(turn);
                return;
              }
              if (
                this.state().mixed?.stage === 'queued' &&
                this.state().mixed?.operationId === outstanding.id
              ) {
                await this.finishMixed(turn);
                return;
              }
            } catch (error) {
              if (!(error instanceof AccountError) || error.code !== 'conflict') throw error;
              if (
                this.state().mixed?.stage === 'queued' &&
                this.state().mixed?.operationId === outstanding.id
              ) {
                this.refresh('conflict', 'conflict');
                return;
              }
              if (
                outstanding.purpose === 'guest-merge' ||
                outstanding.purpose === 'history-restore'
              ) {
                // Reviewed replacements cannot be silently rebased over a changed destination.
                // Keep the exact queued plan and both snapshots for explicit re-review.
                this.refresh('conflict', 'conflict');
                return;
              }
              const current = this.store.read(),
                state = this.state();
              await this.persist(
                current.db,
                { ...state, operation: null, lastSuccess: null },
                current.snapshot,
                turn,
              );
            }
          }
          this.check(turn);
          if (this.state().merge?.stage === 'queued') {
            if (
              this.state().guestDelivery?.phase === 'committed' ||
              same(this.state().merge!.queuedResult, this.state().merge!.destination)
            ) {
              await this.finishGuest(turn);
            } else this.refresh('paused', 'conflict');
            return;
          }
          let current = this.store.read(),
            state = this.state();
          const response = await this.remote.pull(state.cursor, this.controller!.signal);
          this.check(turn);
          validatePull(
            response,
            this.store.account.userId,
            state.cursor,
            this.store.account.workspaceId,
          );
          this.capacity = response.capacity;
          const merged = reconcile(
            current.db,
            state,
            response.records.map(({ revision, ...record }) => ({ record, revision })),
            response.revision,
          );
          if (merged.state.base.length !== response.total) throw new AccountError('invalid');
          await this.persist(merged.db, merged.state, current.snapshot, turn);
          if (merged.state.conflicts.length) {
            this.refresh('conflict');
            return;
          }
          current = this.store.read();
          state = this.state();
          const changes = pending(current.db, state);
          if (changes.length) {
            validateSyncDatabase(current.db);
            const operation: AccountOperation = {
              id: uuidV4(),
              expected: state.cursor,
              changes,
              purpose: 'edit',
            };
            await this.persist(
              current.db,
              { ...state, operation, lastSuccess: null },
              current.snapshot,
              turn,
            );
            await this.send(operation, turn);
          }
          current = this.store.read();
          state = this.state();
          // Independent read verifies the acknowledged state before Synced / Merge Complete.
          const verified = await this.remote.pull(state.cursor, this.controller!.signal);
          this.check(turn);
          validatePull(
            verified,
            this.store.account.userId,
            state.cursor,
            this.store.account.workspaceId,
          );
          this.capacity = verified.capacity;
          const final = reconcile(
            current.db,
            state,
            verified.records.map(({ revision, ...record }) => ({ record, revision })),
            verified.revision,
          );
          if (final.state.base.length !== verified.total) throw new AccountError('invalid');
          let next = final.state;
          if (!next.conflicts.length && !pending(final.db, next).length && !next.operation) {
            next = { ...next, lastSuccess: new Date().toISOString() };
            if (
              next.merge?.stage === 'queued' &&
              next.merge.queuedResult &&
              same(next.merge.queuedResult, final.db)
            ) {
              next = {
                ...next,
                merge: verifyReceipt(next.merge, {
                  userId: this.store.account.userId,
                  workspaceId: this.store.account.workspaceId,
                  operationId: next.merge.operationId,
                  revision: next.cursor,
                  db: final.db,
                  verification: same(next.merge.queuedResult, next.merge.destination)
                    ? 'read'
                    : 'write',
                }),
              };
            }
          }
          await this.persist(final.db, next, current.snapshot, turn);
          this.refresh();
        },
      );
    } catch (error) {
      if (!this.stopped) {
        const code = error instanceof AccountError ? error.code : 'invalid';
        this.refresh('paused', code);
        if (code === 'auth') this.invalidSession();
      }
    } finally {
      this.busy = false;
      this.controller = null;
      if (this.rerun) {
        this.rerun = false;
        this.schedule();
      }
    }
  }
  async resolveConflicts(
    choices: Record<string, 'local' | 'cloud'>,
    expected: string | null | undefined,
  ) {
    if (
      this.busy ||
      this.stopped ||
      this.mixedActive() ||
      this.state().recovery?.stage === 'review'
    )
      throw new AccountError('local');
    const current = this.store.read(),
      state = this.state();
    if (current.snapshot !== expected || state.operation) throw new AccountError('local');
    const next = resolve(current.db, state, choices);
    const result = await this.store.account.write(
      next.db,
      { ...next.state, lastSuccess: null },
      expected,
    );
    if (!result.ok) throw new AccountError('local');
    this.refresh();
    this.schedule();
  }
  /** Read only; history belongs to this account and never changes the local workspace. */
  async history(
    collection: BaseRecord['record']['collection'],
    id: string,
  ): Promise<HistoryResponse> {
    if (this.stopped || !this.remote.history || !id.trim() || id.length > 512)
      throw new AccountError('local');
    const controller = new AbortController(),
      turn = this.epoch;
    const response = await this.remote.history(collection, id, controller.signal);
    this.check(turn);
    if (
      response.version !== 2 ||
      response.userId !== this.store.account.userId ||
      response.workspaceId !== this.store.account.workspaceId ||
      !Number.isSafeInteger(response.revision) ||
      response.revision < 1 ||
      !Number.isSafeInteger(response.replayFloor) ||
      response.replayFloor < 0 ||
      response.replayFloor > response.revision ||
      (response.archivedAt !== null && !Number.isFinite(Date.parse(response.archivedAt))) ||
      !Array.isArray(response.records) ||
      response.records.length > 100 ||
      response.records.some(
        (row) =>
          row.collection !== collection ||
          row.id !== id ||
          !Number.isSafeInteger(row.previousRevision) ||
          row.previousRevision < 1 ||
          !Number.isSafeInteger(row.replacementRevision) ||
          row.replacementRevision > response.revision ||
          row.previousRevision >= row.replacementRevision ||
          !Number.isFinite(Date.parse(row.createdAt)),
      )
    )
      throw new AccountError('invalid');
    return response;
  }
  /** A restore is a fresh durable CAS write. An independent read must still verify its receipt. */
  async restoreHistory(
    reviewed: HistoryResponse,
    chosen: HistoryRow,
    savedRecoveryFile: string,
    expectedSnapshot: string | null | undefined,
    approved: boolean,
  ) {
    if (
      approved !== true ||
      this.stopped ||
      this.busy ||
      this.mixedActive() ||
      !this.remote.history
    )
      throw new AccountError('local');
    const current = this.store.read(),
      state = this.state(),
      turn = this.epoch;
    if (
      current.snapshot !== expectedSnapshot ||
      savedRecoveryFile !== this.recoveryBackup() ||
      state.cursor !== reviewed.revision ||
      state.operation ||
      state.merge?.stage === 'queued' ||
      state.recovery ||
      state.conflicts.length ||
      pending(current.db, state).length ||
      !reviewed.records.some((row) => same(row, chosen))
    )
      throw new AccountError('conflict');
    const fresh = await this.history(chosen.collection, chosen.id);
    this.check(turn);
    if (
      !same(fresh, reviewed) ||
      current.snapshot !== this.store.snapshot() ||
      savedRecoveryFile !== this.recoveryBackup()
    )
      throw new AccountError('conflict');
    const rows = new Map(state.base.map((b) => [recordKey(b.record), b.record]));
    const replacement = {
      collection: chosen.collection,
      id: chosen.id,
      value: structuredClone(chosen.value),
    };
    rows.set(recordKey(replacement), replacement);
    const restored = materialize([...rows.values()], current.db.settings.language);
    validateSyncDatabase(restored);
    const changes = pending(restored, state);
    if (
      changes.length !== 1 ||
      recordKey(changes[0]) !== recordKey(replacement) ||
      !same(changes[0], replacement)
    )
      throw new AccountError('invalid');
    const operation: AccountOperation = {
      id: uuidV4(),
      expected: state.cursor,
      purpose: 'history-restore',
      changes,
    };
    const result = await this.store.account.write(
      restored,
      { ...state, operation, lastSuccess: null },
      expectedSnapshot,
    );
    if (!result.ok) throw new AccountError('local');
    this.refresh();
    await this.run();
  }
  /** Persist an unsubmitted Guest review without changing operational records. */
  async cancelUnsubmittedReview(expected: string | null | undefined) {
    if (this.busy || this.stopped || expected !== this.store.snapshot())
      throw new AccountError('local');
    const current = this.store.read(),
      state = this.state();
    if (
      !state.merge ||
      !['permission', 'review'].includes(state.merge.stage) ||
      state.operation ||
      (state.recovery?.stage === 'review' &&
        !(state.recovery.merge && state.recovery.guestReady)) ||
      state.conflicts.length ||
      pending(current.db, state).length
    )
      throw new AccountError('conflict');
    const saved = await this.store.account.write(
      current.db,
      { ...state, merge: null, lastSuccess: null },
      expected,
    );
    if (!saved.ok) throw new AccountError('local');
    this.refresh();
  }
  async saveMergeReview(plan: MergePlan, sourceSnapshot: string) {
    await validatePlan(plan, this.store.account.userId);
    if (
      this.busy ||
      this.stopped ||
      (this.mixedActive() && this.state().mixed?.stage !== 'guest-review') ||
      !['permission', 'review'].includes(plan.stage)
    )
      throw new AccountError('local');
    const current = this.store.read(),
      state = this.state();
    if (
      state.operation ||
      (state.recovery?.stage === 'review' &&
        !(state.recovery.merge && state.recovery.guestReady)) ||
      state.conflicts.length ||
      pending(current.db, state).length ||
      !guestSourceStill(sourceSnapshot) ||
      plan.workspaceId !== this.store.account.workspaceId ||
      plan.destinationRevision !== state.cursor ||
      plan.sourceFingerprint !== (await fingerprint(sourceSnapshot)) ||
      plan.destinationFingerprint !== (await fingerprint(current.db))
    )
      throw new AccountError('conflict');
    const saved = await this.store.account.write(
      current.db,
      { ...state, merge: plan, guestDelivery: undefined, lastSuccess: null },
      current.snapshot,
    );
    if (!saved.ok) throw new AccountError('local');
    this.refresh();
  }
  async queueMerge(plan: MergePlan, sourceSnapshot: string) {
    await validatePlan(plan, this.store.account.userId);
    if (
      this.busy ||
      this.stopped ||
      (this.mixedActive() && this.state().mixed?.stage !== 'guest-review') ||
      plan.stage !== 'queued' ||
      !plan.queuedResult
    )
      throw new AccountError('local');
    const current = this.store.read(),
      state = this.state();
    if (
      state.operation ||
      (state.recovery?.stage === 'review' && !state.recovery.guestReady) ||
      state.conflicts.length ||
      pending(current.db, state).length ||
      !guestSourceStill(sourceSnapshot) ||
      plan.userId !== this.store.account.userId ||
      plan.workspaceId !== this.store.account.workspaceId ||
      plan.destinationRevision !== state.cursor ||
      plan.sourceFingerprint !== (await fingerprint(sourceSnapshot)) ||
      plan.destinationFingerprint !== (await fingerprint(current.db))
    )
      throw new AccountError('conflict');
    const changes = pending(plan.queuedResult, state);
    // A no-op merge still needs an authoritative verification, not a fake server revision.
    if (!changes.length) {
      const saved = await this.store.account.write(
        current.db,
        {
          ...state,
          merge: plan,
          lastSuccess: null,
          recovery: state.recovery ? { ...state.recovery, stage: 'approved' } : undefined,
          guestDelivery: { operationId: plan.operationId, phase: 'queued' },
        },
        current.snapshot,
      );
      if (!saved.ok) throw new AccountError('local');
      this.refresh();
      this.schedule();
      return;
    }
    const operation: AccountOperation = {
      id: plan.operationId,
      expected: state.cursor,
      changes,
      purpose: 'guest-merge',
    };
    const result = await this.store.account.write(
      plan.queuedResult,
      {
        ...state,
        operation,
        merge: plan,
        lastSuccess: null,
        recovery: state.recovery ? { ...state.recovery, stage: 'approved' } : undefined,
        guestDelivery: { operationId: plan.operationId, phase: 'queued' },
      },
      current.snapshot,
    );
    if (!result.ok) throw new AccountError('local');
    this.refresh();
    this.schedule();
  }
  private async guestTask<T>(action: (turn: number) => Promise<T>): Promise<T> {
    if (this.busy || this.stopped || !navigator.locks) throw new AccountError('local');
    clearTimeout(this.timer);
    this.busy = true;
    this.controller = new AbortController();
    const turn = this.epoch;
    try {
      return await navigator.locks.request(
        'tco-cloud-account-sync:' + this.store.account.userId,
        { ifAvailable: true },
        async (lock) => {
          if (!lock) throw new AccountError('local');
          this.check(turn);
          return action(turn);
        },
      );
    } catch (error) {
      if (!this.stopped) {
        this.refresh('paused', error instanceof AccountError ? error.code : 'invalid');
        if (error instanceof AccountError && error.code === 'auth') this.invalidSession();
      }
      throw error;
    } finally {
      this.busy = false;
      this.controller = null;
    }
  }
  private guestSubmission() {
    const state = this.state(),
      plan =
        state.merge?.stage === 'queued'
          ? state.merge
          : !state.merge && state.recovery?.stage === 'review'
            ? state.recovery.merge
            : null;
    if (!plan || plan.stage !== 'queued' || !plan.queuedResult) throw new AccountError('local');
    const original =
      state.operation ||
      (state.recovery?.merge?.operationId === plan.operationId ? state.recovery.operation : null);
    const operation =
      original?.purpose === 'guest-merge'
        ? original
        : (() => {
            const changes = pending(plan.queuedResult!, {
              base: records(plan.destination).map((record) => ({
                record,
                revision: plan.destinationRevision,
              })),
            });
            return changes.length
              ? {
                  id: plan.operationId,
                  expected: plan.destinationRevision,
                  changes,
                  purpose: 'guest-merge' as const,
                }
              : null;
          })();
    if (
      operation &&
      (operation.id !== plan.operationId || operation.expected !== plan.destinationRevision)
    )
      throw new AccountError('invalid');
    return { state, plan, operation };
  }
  private async outcome(
    operation: AccountOperation,
    retire: boolean,
    turn: number,
  ): Promise<MergeOutcome> {
    const query =
      operation.purpose === 'guest-merge'
        ? this.remote.mergeOutcome
        : operation.purpose === 'edit'
          ? this.remote.editOutcome
          : undefined;
    if (!query) throw new AccountError('setup');
    const result = await query.call(this.remote, operation, retire, this.controller!.signal);
    this.check(turn);
    if (
      !result ||
      result.version !== 2 ||
      result.userId !== this.store.account.userId ||
      result.workspaceId !== this.store.account.workspaceId ||
      result.operationId !== operation.id ||
      result.expected !== operation.expected ||
      !Number.isSafeInteger(result.revision) ||
      result.revision < operation.expected ||
      !Number.isSafeInteger(result.replayFloor) ||
      result.replayFloor < 0 ||
      result.replayFloor > result.revision ||
      !['missing', 'committed', 'retired', 'expired'].includes(result.outcome) ||
      (result.outcome === 'committed' &&
        (result.operationRevision !== operation.expected + 1 ||
          result.operationRevision > result.revision)) ||
      (result.outcome === 'retired' && result.operationRevision !== operation.expected) ||
      (['missing', 'expired'].includes(result.outcome) && result.operationRevision !== null) ||
      (result.outcome === 'expired' && result.replayFloor <= operation.expected)
    )
      throw new AccountError('invalid');
    return result;
  }
  private async committedGuest(operation: AccountOperation, revision: number, turn: number) {
    await this.captureMixed(turn);
    const current = this.store.read(),
      state = this.state();
    if (state.mixed && state.operation?.purpose === 'edit') {
      await this.persist(
        current.db,
        {
          ...state,
          guestDelivery: {
            operationId: operation.id,
            phase: 'committed',
            receiptRevision: revision,
          },
          mixed: { ...state.mixed, outcome: 'committed', stage: 'awaiting-cloud' },
          lastSuccess: null,
        },
        current.snapshot,
        turn,
      );
      this.refresh('pending');
      return;
    }
    if (state.operation?.id === operation.id && state.cursor === operation.expected) {
      await this.acknowledge(
        operation,
        {
          version: 2,
          userId: this.store.account.userId,
          workspaceId: this.store.account.workspaceId,
          operationId: operation.id,
          revision,
        },
        turn,
      );
    } else {
      if (state.operation || state.cursor < revision) throw new AccountError('invalid');
      const plan = state.merge || state.recovery?.merge;
      if (!plan || plan.operationId !== operation.id) throw new AccountError('invalid');
      await this.persist(
        current.db,
        {
          ...state,
          merge: plan,
          recovery: state.recovery ? { ...state.recovery, stage: 'approved' } : undefined,
          guestDelivery: {
            operationId: operation.id,
            phase: 'committed',
            receiptRevision: revision,
          },
          lastSuccess: null,
        },
        current.snapshot,
        turn,
      );
    }
    await this.finishGuest(turn);
  }
  /** The receipt RPC receives the exact approved payload to check its hash; it never replays record writes. */
  async verifyGuestSubmission() {
    return this.guestTask(async (turn) => {
      await this.captureMixed(turn);
      if (
        this.state().merge?.stage === 'queued' &&
        this.state().guestDelivery?.phase === 'committed'
      ) {
        if (this.state().operation?.purpose === 'edit') {
          const op = this.guestSubmission().operation;
          if (!op) throw new AccountError('invalid');
          await this.committedGuest(op, this.state().guestDelivery!.receiptRevision!, turn);
          return;
        }
        await this.finishGuest(turn);
        return;
      }
      const { plan, operation } = this.guestSubmission();
      if (!operation) {
        await this.finishGuest(turn);
        return;
      }
      const result = await this.outcome(operation, false, turn);
      if (result.outcome === 'committed') {
        await this.committedGuest(operation, result.operationRevision!, turn);
        return;
      }
      const current = this.store.read(),
        state = this.state();
      await this.persist(
        current.db,
        {
          ...state,
          guestDelivery: {
            operationId: plan.operationId,
            phase: result.outcome === 'missing' ? 'unknown' : result.outcome,
            ...(result.outcome === 'missing' ? { reason: 'missing' as const } : {}),
          },
          lastSuccess: null,
        },
        current.snapshot,
        turn,
      );
      this.refresh('paused', result.outcome === 'expired' ? 'archived' : 'conflict');
    });
  }
  /** Exact retry is an explicit user action, never an automatic unknown-outcome replay. */
  async retryGuestSubmission() {
    return this.guestTask(async (turn) => {
      await this.captureMixed(turn);
      const { plan, operation } = this.guestSubmission();
      if (!operation || !guestSourceStill(plan.sourceSnapshot)) throw new AccountError('conflict');
      const result = await this.outcome(operation, false, turn);
      if (result.outcome === 'committed')
        return this.committedGuest(operation, result.operationRevision!, turn);
      if (result.outcome !== 'missing' || result.revision !== operation.expected)
        throw new AccountError('conflict');
      await this.send(operation, turn);
      await this.finishGuest(turn);
    });
  }
  /** The same sync Web Lock fences cancellation against the first transport call. */
  async cancelQueuedGuest(savedBackup: string, expected: string | null | undefined) {
    return this.guestTask(async (turn) => {
      const { state, plan, operation } = this.guestSubmission(),
        current = this.store.read();
      if (
        state.guestDelivery?.phase !== 'queued' ||
        state.operation?.purpose === 'edit' ||
        current.snapshot !== expected ||
        savedBackup !== this.recoveryBackup()
      )
        throw new AccountError('conflict');
      if (!same(current.db, plan.queuedResult)) {
        await this.captureMixed(turn);
        const captured = this.store.read(),
          next = this.state();
        if (!next.mixed) throw new AccountError('invalid');
        await this.persist(
          captured.db,
          {
            ...next,
            operation: null,
            merge: null,
            guestDelivery: undefined,
            mixed: { ...next.mixed, outcome: 'unsent', stage: 'awaiting-cloud', skipGuest: true },
            recovery: {
              stage: 'review',
              guestReady: false,
              fromRevision: plan.destinationRevision,
              at: new Date().toISOString(),
              db: current.db,
              operation,
              merge: plan,
            },
            lastSuccess: null,
          },
          captured.snapshot,
          turn,
        );
        this.refresh('pending');
        return;
      }
      await this.persist(
        plan.destination,
        {
          ...state,
          operation: null,
          merge: null,
          guestDelivery: undefined,
          lastSuccess: null,
          recovery: {
            stage: 'approved',
            fromRevision: plan.destinationRevision,
            at: new Date().toISOString(),
            db: current.db,
            operation,
            merge: plan,
          },
        },
        current.snapshot,
        turn,
      );
      this.refresh();
    });
  }
  /** Preserve the exact old plan, then fence it remotely before opening a fresh review. */
  async reviewUpdatedGuest(savedBackup: string, expected: string | null | undefined) {
    return this.guestTask(async (turn) => {
      if (
        this.state().merge?.stage === 'queued' &&
        this.state().guestDelivery?.phase === 'committed'
      ) {
        if (this.state().operation?.purpose === 'edit') {
          const op = this.guestSubmission().operation;
          if (!op) throw new AccountError('invalid');
          await this.committedGuest(op, this.state().guestDelivery!.receiptRevision!, turn);
          return;
        }
        await this.finishGuest(turn);
        return;
      }
      if (this.store.snapshot() !== expected || savedBackup !== this.recoveryBackup())
        throw new AccountError('local');
      await this.captureMixed(turn);
      const { state, plan, operation } = this.guestSubmission(),
        current = this.store.read();
      const retained =
        state.recovery?.stage === 'review' && state.recovery.merge ? state.recovery.db : current.db;
      let phase: 'retired' | 'expired' = 'retired';
      if (operation) {
        const result = await this.outcome(operation, true, turn);
        if (result.outcome === 'committed') {
          await this.committedGuest(operation, result.operationRevision!, turn);
          return;
        }
        if (!['retired', 'expired'].includes(result.outcome)) throw new AccountError('invalid');
        phase = result.outcome as typeof phase;
        await this.persist(
          current.db,
          {
            ...state,
            guestDelivery: {
              operationId: plan.operationId,
              phase,
            },
            lastSuccess: null,
          },
          current.snapshot,
          turn,
        );
      }
      if (state.mixed && state.operation?.purpose === 'edit') {
        const held = this.store.read(),
          heldState = this.state();
        await this.persist(
          held.db,
          {
            ...heldState,
            mixed: { ...state.mixed, outcome: phase, stage: 'awaiting-cloud' },
            lastSuccess: null,
          },
          held.snapshot,
          turn,
        );
        this.refresh('pending');
        return;
      }
      const beforeDownload = this.store.read();
      const response = await this.remote.pull(0, this.controller!.signal);
      this.check(turn);
      validatePull(response, this.store.account.userId, 0, this.store.account.workspaceId);
      const fresh = stateFromPull(
        response,
        this.store.account.userId,
        current.db.settings.language,
      );
      await this.persist(
        fresh.db,
        {
          ...fresh.state,
          lastSuccess: null,
          mixed: state.mixed
            ? {
                ...state.mixed,
                outcome: phase,
                stage: 'guest-review',
                cloudRevision: response.revision,
                decisions: {},
                guestPlan: null,
                skipGuest: false,
              }
            : undefined,
          guestDelivery: { operationId: plan.operationId, phase },
          recovery: {
            stage: 'review',
            guestReady: true,
            fromRevision: plan.destinationRevision,
            at: new Date().toISOString(),
            db: retained,
            operation,
            merge: plan,
          },
        },
        beforeDownload.snapshot,
        turn,
      );
      this.refresh('pending');
    });
  }
  mixedCloud() {
    return materialize(
      this.state().base.map((b) => b.record),
      this.store.read().db.settings.language,
    );
  }
  async resolveRetainedAccountOperation(savedBackup: string, expected: string | null | undefined) {
    return this.guestTask(async (turn) => {
      const before = this.store.read(),
        state = this.state(),
        m = state.mixed;
      if (
        !m ||
        m.stage !== 'awaiting-cloud' ||
        m.outcome === 'unresolved' ||
        savedBackup !== this.recoveryBackup() ||
        before.snapshot !== expected
      )
        throw new AccountError('local');
      const source = mixedSource(m.originalCache),
        guestOp = this.guestSubmission().operation;
      const op = state.operation || source.retainedOperation;
      if (
        !op ||
        !source.retainedOperation ||
        !same(op, source.retainedOperation) ||
        (!state.operation && !m.retained)
      )
        throw new AccountError('invalid');
      const result =
        m.retained?.id === op.id
          ? { outcome: m.retained.outcome, operationRevision: m.retained.revision }
          : await this.outcome(op, true, turn);
      if (result.outcome === 'missing') throw new AccountError('invalid');
      if (result.outcome === 'committed' && state.operation)
        await this.acknowledge(
          op,
          {
            version: 2,
            userId: m.userId,
            workspaceId: m.workspaceId,
            operationId: op.id,
            revision: result.operationRevision!,
          },
          turn,
        );
      const retained = this.store.read(),
        latestState = this.state();
      const history = [
        ...m.history,
        {
          revision: m.cloudRevision,
          at: new Date().toISOString(),
          decisions: m.decisions,
          operation: op,
          reason: 'Retained Account operation independently verified: ' + result.outcome,
        },
      ];
      const retainedProof = {
        id: op.id,
        outcome: result.outcome as 'committed' | 'retired' | 'expired',
        revision: result.operationRevision,
      };
      await this.persist(
        retained.db,
        { ...latestState, mixed: { ...m, history, retained: retainedProof }, lastSuccess: null },
        retained.snapshot,
        turn,
      );
      const current = this.store.read();
      const response = await this.remote.pull(0, this.controller!.signal);
      this.check(turn);
      validatePull(response, m.userId, 0, m.workspaceId);
      const fresh = stateFromPull(response, m.userId, before.db.settings.language);
      const committed = m.outcome === 'committed';
      const verifiedPlan = committed
        ? {
            ...source.plan,
            stage: 'verified' as const,
            verifiedRevision: state.guestDelivery!.receiptRevision!,
          }
        : null;
      await this.persist(
        fresh.db,
        {
          ...fresh.state,
          merge: verifiedPlan,
          guestDelivery: committed
            ? state.guestDelivery
            : {
                operationId: source.plan.operationId,
                phase: m.outcome === 'expired' ? 'expired' : 'retired',
              },
          recovery: {
            stage: committed ? 'approved' : 'review',
            guestReady: !committed,
            fromRevision: source.plan.destinationRevision,
            at: new Date().toISOString(),
            db: source.later,
            operation: guestOp,
            merge: source.plan,
          },
          mixed: {
            ...m,
            history,
            retained: retainedProof,
            stage: committed ? 'account-review' : 'guest-review',
            cloudRevision: response.revision,
          },
          lastSuccess: null,
        },
        current.snapshot,
        turn,
      );
      this.refresh('pending');
    });
  }
  mixedEditRows() {
    const m = this.state().mixed;
    return m ? mixedRows(m, this.mixedCloud()) : [];
  }
  async saveMixedDecision(key: string, decision: MixedDecision, planId: string) {
    if (this.busy || this.stopped) throw new AccountError('local');
    const current = this.store.read(),
      state = this.state(),
      m = state.mixed;
    if (
      !m ||
      m.stage !== 'account-review' ||
      m.id !== planId ||
      !this.mixedEditRows().some((r) => r.key === key)
    )
      throw new AccountError('conflict');
    const [collection] = JSON.parse(key) as [RecordData['collection']];
    if (
      decision.target &&
      (collection === 'privacy'
        ? decision.target !== 'settings'
        : !this.mixedCloud()[collection].some((r) => r.id === decision.target))
    )
      throw new AccountError('invalid');
    const bindingChanged = m.decisions[key]?.target !== decision.target;
    const result = await this.store.account.write(
      current.db,
      {
        ...state,
        mixed: {
          ...m,
          decisions: { ...(bindingChanged ? {} : m.decisions), [key]: structuredClone(decision) },
          history: bindingChanged
            ? [
                ...m.history,
                {
                  revision: m.cloudRevision,
                  at: new Date().toISOString(),
                  decisions: m.decisions,
                  reason: 'Identity binding changed; dependent choices invalidated',
                },
              ]
            : m.history,
        },
        lastSuccess: null,
      },
      current.snapshot,
    );
    if (!result.ok) throw new AccountError('local');
    this.refresh('pending');
  }
  async loadMixedCloud(savedBackup: string, expected: string | null | undefined) {
    return this.guestTask(async (turn) => {
      const before = this.store.read(),
        state = this.state(),
        m = state.mixed;
      if (
        !m ||
        m.stage !== 'awaiting-cloud' ||
        m.outcome !== 'unsent' ||
        state.operation ||
        before.snapshot !== expected ||
        savedBackup !== this.recoveryBackup()
      )
        throw new AccountError('local');
      const response = await this.remote.pull(0, this.controller!.signal);
      this.check(turn);
      validatePull(response, this.store.account.userId, 0, this.store.account.workspaceId);
      const fresh = stateFromPull(response, this.store.account.userId, before.db.settings.language);
      await this.persist(
        fresh.db,
        {
          ...fresh.state,
          recovery: state.recovery
            ? { ...state.recovery, stage: 'approved', guestReady: false }
            : undefined,
          mixed: {
            ...m,
            cloudRevision: response.revision,
            stage: 'account-review',
            decisions: {},
            skipGuest: true,
          },
          lastSuccess: null,
        },
        before.snapshot,
        turn,
      );
      this.refresh('pending');
    });
  }
  async chooseMixedGuestReview(
    reviewGuest: boolean,
    savedBackup: string,
    expected: string | null | undefined,
  ) {
    return this.guestTask(async (turn) => {
      const current = this.store.read(),
        state = this.state(),
        m = state.mixed;
      if (
        !m ||
        !['guest-review', 'account-review'].includes(m.stage) ||
        m.outcome === 'committed' ||
        state.operation ||
        current.snapshot !== expected ||
        savedBackup !== this.recoveryBackup()
      )
        throw new AccountError('local');
      const original = mixedSource(m.originalCache);
      await this.persist(
        current.db,
        {
          ...state,
          operation: null,
          merge: null,
          guestDelivery: undefined,
          recovery: {
            stage: reviewGuest ? 'review' : 'approved',
            guestReady: reviewGuest,
            fromRevision: original.plan.destinationRevision,
            at: new Date().toISOString(),
            db: original.later,
            operation:
              original.payload.state.operation ||
              original.payload.state.recovery?.operation ||
              null,
            merge: original.plan,
          },
          mixed: {
            ...m,
            stage: reviewGuest ? 'guest-review' : 'account-review',
            skipGuest: !reviewGuest,
            decisions: {},
            history: [
              ...m.history,
              {
                revision: m.cloudRevision,
                at: new Date().toISOString(),
                decisions: m.decisions,
                reason: reviewGuest
                  ? 'Review Guest dependencies separately'
                  : 'No Guest transfer; unresolved dependencies require explicit existing targets',
              },
            ],
          },
          lastSuccess: null,
        },
        current.snapshot,
        turn,
      );
      this.refresh('pending');
    });
  }
  private async resetMixedReview(
    response: AccountPull,
    turn: number,
    reason: string,
    operation?: AccountOperation,
  ) {
    const current = this.store.read(),
      state = this.state(),
      m = state.mixed;
    if (!m) throw new AccountError('local');
    validatePull(response, this.store.account.userId, 0, this.store.account.workspaceId);
    if (response.revision < state.cursor) throw new AccountError('invalid');
    const fresh = stateFromPull(response, this.store.account.userId, current.db.settings.language);
    await this.persist(
      fresh.db,
      {
        ...fresh.state,
        merge: state.merge,
        guestDelivery: state.guestDelivery,
        recovery: state.recovery,
        mixed: {
          ...m,
          id: uuidV4(),
          stage: 'account-review',
          delivery: undefined,
          cloudRevision: response.revision,
          operationId: uuidV4(),
          decisions: {},
          history: [
            ...m.history,
            {
              revision: m.cloudRevision,
              at: new Date().toISOString(),
              decisions: m.decisions,
              operation,
              reason,
            },
          ],
        },
        lastSuccess: null,
      },
      current.snapshot,
      turn,
    );
    this.refresh('pending');
  }
  async approveMixed(
    savedBackup: string,
    expected: string | null | undefined,
    approved: boolean,
    highRisk: boolean,
  ) {
    const queued = await this.guestTask(async (turn) => {
      const current = this.store.read(),
        state = this.state(),
        m = state.mixed;
      if (
        !m ||
        m.stage !== 'account-review' ||
        state.operation ||
        !approved ||
        current.snapshot !== expected ||
        savedBackup !== this.recoveryBackup()
      )
        throw new AccountError('local');
      const result = mixedResult(m, this.mixedCloud());
      if (result.highRisk && !highRisk) throw new AccountError('conflict');
      const response = await this.remote.pull(0, this.controller!.signal);
      this.check(turn);
      validatePull(response, this.store.account.userId, 0, this.store.account.workspaceId);
      const latest = stateFromPull(
        response,
        this.store.account.userId,
        current.db.settings.language,
      );
      if (response.revision !== m.cloudRevision || !same(latest.db, this.mixedCloud())) {
        await this.resetMixedReview(response, turn, 'Cloud changed; prior approval invalidated');
        throw new AccountError('conflict');
      }
      if (!result.changes.length) {
        await this.persist(
          latest.db,
          {
            ...state,
            mixed: {
              ...m,
              stage: 'complete',
              history: [
                ...m.history,
                {
                  revision: m.cloudRevision,
                  at: new Date().toISOString(),
                  decisions: m.decisions,
                  reason: 'Reviewed without new writes',
                },
              ],
            },
            lastSuccess: new Date().toISOString(),
          },
          current.snapshot,
          turn,
        );
        this.refresh();
        return false;
      }
      const operation: AccountOperation = {
        id: m.operationId,
        expected: m.cloudRevision,
        purpose: 'edit',
        changes: result.changes,
      };
      await this.persist(
        result.db,
        {
          ...state,
          operation,
          mixed: {
            ...m,
            stage: 'queued',
            delivery: 'queued',
            history: [
              ...m.history,
              {
                revision: m.cloudRevision,
                at: new Date().toISOString(),
                decisions: m.decisions,
                operation,
                reason:
                  'Separately approved later Account edits, after original Guest outcome resolution',
              },
            ],
          },
          lastSuccess: null,
        },
        current.snapshot,
        turn,
      );
      this.refresh('pending');
      return true;
    });
    if (queued) await this.run();
  }
  async renewMixedReview(savedBackup: string, expected: string | null | undefined) {
    return this.guestTask(async (turn) => {
      const current = this.store.read(),
        state = this.state(),
        m = state.mixed,
        operation = state.operation;
      if (
        !m ||
        m.stage !== 'queued' ||
        current.snapshot !== expected ||
        savedBackup !== this.recoveryBackup()
      )
        throw new AccountError('local');
      if (m.delivery === 'committed' && !operation) {
        await this.finishMixed(turn);
        return;
      }
      if (!operation || operation.id !== m.operationId) throw new AccountError('invalid');
      if (m.delivery !== 'queued') {
        // An exact retry can confirm a lost acknowledgement. Do not clear the old ID
        // unless the server's CAS/floor and a newer full snapshot fence future replay.
        try {
          await this.send(operation, turn);
          await this.finishMixed(turn);
          return;
        } catch (error) {
          if (!(error instanceof AccountError) || !['conflict', 'archived'].includes(error.code))
            throw error;
        }
      }
      const response = await this.remote.pull(0, this.controller!.signal);
      this.check(turn);
      if (m.delivery !== 'queued' && response.revision <= operation.expected)
        throw new AccountError('conflict');
      await this.resetMixedReview(
        response,
        turn,
        m.delivery === 'queued'
          ? 'Unsent later operation returned to review'
          : 'Old exact retry rejected/expired; complete new Account review required',
        operation,
      );
    });
  }
  recoveryRows() {
    const state = this.state(),
      local = new Map(records(this.store.read().db).map((row) => [recordKey(row), row])),
      cloud = new Map(state.base.map((b) => [recordKey(b.record), b.record]));
    return [
      ...new Set([...pending(this.store.read().db, state).map(recordKey), ...state.conflicts]),
    ]
      .sort()
      .map((key) => ({ key, local: local.get(key) || null, cloud: cloud.get(key) || null }));
  }
  recoveryBackup() {
    const loaded = this.store.read();
    return JSON.stringify({
      kind: 'tco-account-pending-recovery',
      version: 1,
      userId: this.store.account.userId,
      workspaceId: this.store.account.workspaceId,
      db: loaded.db,
      state: this.state(),
    });
  }
  async reviewAfterArchive(savedBackup: string) {
    if (this.busy || this.stopped || this.mixedActive() || savedBackup !== this.recoveryBackup())
      throw new AccountError('local');
    const current = this.store.read(),
      state = this.state(),
      turn = this.epoch;
    this.busy = true;
    this.controller = new AbortController();
    try {
      const response = await this.remote.pull(0, this.controller.signal);
      this.check(turn);
      validatePull(response, this.store.account.userId, 0, this.store.account.workspaceId);
      if (
        !Number.isSafeInteger(response.replayFloor) ||
        (response.replayFloor! <= state.cursor && state.recovery?.stage !== 'review') ||
        response.total !== response.records.length ||
        current.snapshot !== this.store.snapshot()
      )
        throw new AccountError('conflict');
      const remoteRows = new Map(response.records.map((row) => [recordKey(row), row]));
      if (state.base.some((b) => !remoteRows.has(recordKey(b.record))))
        throw new AccountError('invalid');
      const previous = new Map(state.base.map((b) => [recordKey(b.record), b]));
      const changes = response.records.flatMap(({ revision, ...record }) => {
        const before = previous.get(recordKey(record));
        if (before && revision <= before.revision) {
          if (revision !== before.revision || !same(record, before.record))
            throw new AccountError('invalid');
          return [];
        }
        return [{ record, revision }];
      });
      const next = reconcile(
        current.db,
        { ...state, operation: null, merge: null },
        changes,
        response.revision,
      );
      const recovery =
        state.recovery?.stage === 'review'
          ? state.recovery
          : {
              stage: 'review' as const,
              fromRevision: state.cursor,
              at: new Date().toISOString(),
              db: current.db,
              operation: state.operation,
              merge: state.merge,
            };
      await this.persist(
        next.db,
        { ...next.state, recovery, lastSuccess: null },
        current.snapshot,
        turn,
      );
      this.refresh('paused', 'archived');
    } finally {
      this.busy = false;
      this.controller = null;
    }
  }
  async approveArchiveReview(choices: Record<string, 'local' | 'cloud'>, expected: string | null) {
    if (
      this.busy ||
      this.mixedActive() ||
      this.stopped ||
      this.state().recovery?.stage !== 'review' ||
      this.state().recovery?.merge ||
      expected !== this.store.snapshot()
    )
      throw new AccountError('local');
    const current = this.store.read(),
      state = this.state(),
      turn = this.epoch,
      keys = this.recoveryRows().map((r) => r.key);
    if (keys.some((k) => !['local', 'cloud'].includes(choices[k])))
      throw new AccountError('conflict');
    this.busy = true;
    this.controller = new AbortController();
    try {
      const response = await this.remote.pull(0, this.controller.signal);
      this.check(turn);
      validatePull(response, this.store.account.userId, 0, this.store.account.workspaceId);
      if (
        response.revision !== state.cursor ||
        current.snapshot !== this.store.snapshot() ||
        !same(
          response.records
            .map(({ collection, id, value }) => ({ collection, id, value }))
            .sort((a, b) => recordKey(a).localeCompare(recordKey(b))),
          state.base.map((b) => b.record).sort((a, b) => recordKey(a).localeCompare(recordKey(b))),
        )
      )
        throw new AccountError('conflict');
      const resolved = resolve(current.db, { ...state, conflicts: keys }, choices);
      await this.persist(
        resolved.db,
        {
          ...resolved.state,
          recovery: { ...state.recovery!, stage: 'approved' },
          lastSuccess: null,
        },
        current.snapshot,
        turn,
      );
      this.refresh();
    } finally {
      this.busy = false;
      this.controller = null;
    }
    await this.run();
  }
  /** No operation or local edits may be hidden by maintenance. Server revision is checked again. */
  async prepareArchive(): Promise<ArchiveExport> {
    if (!this.remote.prepareArchive) throw new AccountError('setup');
    if (
      this.busy ||
      this.stopped ||
      this.state().operation ||
      this.state().conflicts.length ||
      this.state().recovery?.stage === 'review' ||
      pending(this.store.read().db, this.state()).length
    )
      throw new AccountError('editing');
    this.busy = true;
    const turn = this.epoch,
      before = this.store.read();
    this.controller = new AbortController();
    try {
      const exported = await this.remote.prepareArchive(this.controller.signal);
      this.check(turn);
      if (before.snapshot !== this.store.snapshot() || exported.revision !== this.state().cursor)
        throw new AccountError('conflict');
      await verifyArchive(
        exported,
        exported.text,
        this.store.account.userId,
        this.store.account.workspaceId,
      );
      this.check(turn);
      return exported;
    } finally {
      this.busy = false;
      this.controller = null;
    }
  }
  async archiveHistory(exported: ArchiveExport, reread: string) {
    if (
      !this.remote.archive ||
      this.busy ||
      this.stopped ||
      this.state().operation ||
      this.state().conflicts.length ||
      pending(this.store.read().db, this.state()).length
    )
      throw new AccountError('editing');
    await verifyArchive(
      exported,
      reread,
      this.store.account.userId,
      this.store.account.workspaceId,
    );
    if (exported.revision !== this.state().cursor) throw new AccountError('conflict');
    this.busy = true;
    const turn = this.epoch;
    this.controller = new AbortController();
    try {
      this.check(turn);
      const receipt = await this.remote.archive(
        exported.revision,
        exported.digest,
        this.controller.signal,
      );
      this.check(turn);
      if (
        receipt.version !== 2 ||
        receipt.userId !== this.store.account.userId ||
        receipt.workspaceId !== this.store.account.workspaceId ||
        !Number.isSafeInteger(receipt.revision) ||
        receipt.replayFloor !== exported.revision ||
        receipt.revision < exported.revision
      )
        throw new AccountError('invalid');
      return receipt;
    } finally {
      this.busy = false;
      this.controller = null;
    }
  }
  attach() {
    const wake = () => {
      if (document.visibilityState !== 'hidden') void this.run();
    };
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    wake();
    return () => {
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.epoch++;
    this.controller?.abort();
    clearTimeout(this.timer);
    this.unsubscribe();
    this.listeners.clear();
  }
}
