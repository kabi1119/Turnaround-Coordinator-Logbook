import type { WorkspaceStore } from '../workspaces/store';
import { createCloudKey, unlockCloudKey, decryptRecord, encryptRecord } from './crypto';
import type { CloudKeys } from './crypto';
import { pending, reconcile, resolve, same, validateSyncDatabase } from './records';
import type { CloudTransport, Pull, SyncState } from './types';
import { SyncError } from './types';
import { uuidV4 } from '../lib/uuid';
export type SyncStatus = {
  phase: 'disabled' | 'locked' | 'syncing' | 'pending' | 'synced' | 'conflict' | 'paused';
  pending: number;
  conflicts: number;
  lastSuccess: string | null;
  error: string;
};
/** One controller per unlocked Account, with no Guest adapter and no persisted plaintext keys. */
export class SyncEngine {
  private keys: CloudKeys | null = null;
  private epoch = 0;
  private controller: AbortController | null = null;
  private busy = false;
  private rerun = false;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private unsubscribe: () => void;
  private listeners = new Set<() => void>();
  private status: SyncStatus = {
    phase: 'disabled',
    pending: 0,
    conflicts: 0,
    lastSuccess: null,
    error: '',
  };
  constructor(
    readonly store: WorkspaceStore,
    readonly userId: string,
    private remote: CloudTransport,
    private safe: () => boolean = () =>
      !document.querySelector('dialog[open]:not([data-sync-control="true"])'),
    private invalidSession: () => void = () => {},
  ) {
    if (store.kind !== 'account' || !store.sync || store.key !== `tco-account-vault-v1:${userId}`)
      throw new SyncError('auth');
    this.unsubscribe =
      store.subscribe?.((reason) => {
        if (reason === 'lock') {
          this.stop();
          return;
        }
        if (reason === 'local') {
          this.refresh();
          this.schedule();
        }
      }) || (() => {});
    this.refresh();
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.status;
  canRun = () => Boolean(this.keys && !this.busy && !this.stopped && this.state()?.enabled);
  state = () => this.store.sync!.read();
  private refresh(phase?: SyncStatus['phase'], error = '') {
    if (this.stopped) return;
    const state = this.state();
    const count = state ? pending(this.store.read().db, state).length : 0;
    this.status = {
      phase:
        phase ||
        (state?.enabled
          ? state.conflicts.length
            ? 'conflict'
            : !this.keys
              ? 'locked'
              : count
                ? 'pending'
                : 'synced'
          : 'disabled'),
      pending: count,
      conflicts: state?.conflicts.length || 0,
      lastSuccess: state?.lastSuccess || null,
      error,
    };
    for (const fn of this.listeners) fn();
  }
  private check(turn: number) {
    if (this.stopped || turn !== this.epoch || this.controller?.signal.aborted)
      throw new SyncError('locked');
    if (!this.store.current(this.store.read().db)) throw new SyncError('local');
  }
  private schedule = () => {
    clearTimeout(this.timer);
    if (!this.stopped && this.keys && this.state()?.enabled)
      this.timer = setTimeout(() => void this.run(), 1200);
  };
  private validate(p: Pull, cursor: number) {
    if (
      !p ||
      p.version !== 1 ||
      p.userId !== this.userId ||
      !Number.isSafeInteger(p.revision) ||
      p.revision < cursor ||
      !Array.isArray(p.records) ||
      p.records.length > 5000 ||
      JSON.stringify(p).length > 9 * 1024 * 1024 ||
      (!p.envelope && (p.revision !== 0 || p.records.length))
    )
      throw new SyncError('invalid');
    if (
      p.count !== p.records.length ||
      !Number.isSafeInteger(p.total) ||
      p.total < 0 ||
      p.total > 5000
    )
      throw new SyncError('invalid');
    const ids = new Set<string>();
    for (const r of p.records) {
      if (!r || r.revision <= cursor || r.revision > p.revision || ids.has(r.recordId))
        throw new SyncError('invalid');
      ids.add(r.recordId);
    }
    if (p.revision > cursor && !p.records.length) throw new SyncError('invalid');
  }
  private async persist(
    db: ReturnType<WorkspaceStore['read']>['db'],
    state: SyncState,
    expected: string | null | undefined,
    turn: number,
  ) {
    this.check(turn);
    if (!this.safe()) throw new SyncError('editing');
    const result = await this.store.sync!.write(db, state, expected);
    this.check(turn);
    if (!result.ok) throw new SyncError('local');
  }
  /** Explicit consent + passphrase. Existing cloud keys are immutable; distinct device vaults are reconciled. */
  async enable(secret: string) {
    if (this.busy || this.stopped) return;
    if (!navigator.locks) {
      this.refresh('paused', 'locks');
      return;
    }
    this.busy = true;
    const turn = ++this.epoch;
    this.controller = new AbortController();
    this.refresh('syncing');
    try {
      const before = this.store.read(),
        prior = this.state();
      validateSyncDatabase(before.db);
      const remote = await this.remote.pull(0, this.controller.signal);
      this.check(turn);
      this.validate(remote, 0);
      let envelope = remote.envelope;
      if (prior && !same(prior.envelope, envelope)) throw new SyncError('invalid');
      let keys: CloudKeys;
      if (envelope) keys = await unlockCloudKey(envelope, this.userId, secret);
      else {
        const created = await createCloudKey(this.userId, secret);
        keys = created.keys;
        envelope = created.envelope;
        this.check(turn);
        await this.remote.initialize(envelope, this.controller.signal);
      }
      this.check(turn);
      this.keys = keys;
      const state: SyncState = prior
        ? { ...prior, enabled: true }
        : {
            version: 1,
            enabled: true,
            envelope,
            cursor: 0,
            base: [],
            conflicts: [],
            lastSuccess: null,
          };
      await this.persist(before.db, state, before.snapshot, turn);
      this.refresh('syncing');
    } catch (e) {
      this.keys = null;
      this.failure(e);
    } finally {
      this.busy = false;
      this.controller = null;
    }
    if (this.keys) await this.run();
  }
  async run() {
    if (this.busy) {
      this.rerun = true;
      return;
    }
    if (this.busy || this.stopped || !this.keys || !this.state()?.enabled) return;
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
        `tco-cloud-sync:${this.userId}`,
        { ifAvailable: true },
        async (lock) => {
          if (!lock) throw new SyncError('local');
          this.check(turn);
          const initial = this.store.read(),
            state = this.state()!;
          const response = await this.remote.pull(state.cursor, this.controller!.signal);
          this.check(turn);
          this.validate(response, state.cursor);
          if (!same(response.envelope, state.envelope)) throw new SyncError('invalid');
          const changes = [];
          for (const cipher of response.records) {
            changes.push({
              record: await decryptRecord(this.keys!, cipher),
              revision: cipher.revision,
            });
            this.check(turn);
          }
          const merged = reconcile(initial.db, state, changes, response.revision);
          if (merged.state.base.length !== response.total) throw new SyncError('invalid');
          await this.persist(merged.db, merged.state, initial.snapshot, turn);
          if (merged.state.conflicts.length) {
            this.refresh('conflict');
            return;
          }
          const current = this.store.read(),
            dirty = pending(current.db, merged.state);
          if (dirty.length) {
            validateSyncDatabase(current.db);
            const ciphers = [];
            for (const r of dirty) {
              ciphers.push(await encryptRecord(this.keys!, r, merged.state.cursor + 1));
              this.check(turn);
            }
            if (!this.safe()) throw new SyncError('editing');
            // No write is acknowledged locally until the complete atomic CAS transaction succeeds.
            const revision = await this.remote.push(
              merged.state.cursor,
              uuidV4(),
              ciphers,
              this.controller!.signal,
            );
            this.check(turn);
            if (revision !== merged.state.cursor + 1) throw new SyncError('invalid');
            const acknowledged = reconcile(
              current.db,
              merged.state,
              dirty.map((record) => ({ record, revision })),
              revision,
            );
            acknowledged.state.lastSuccess = new Date().toISOString();
            // New local edits during an upload stay dirty against the acknowledged version.
            // This receipt belongs to our own exact batch, so it is not a competing edit.
            const latest = this.store.read();
            await this.persist(latest.db, acknowledged.state, latest.snapshot, turn);
          } else {
            await this.persist(
              current.db,
              { ...merged.state, lastSuccess: new Date().toISOString() },
              current.snapshot,
              turn,
            );
          }
          this.refresh();
        },
      );
    } catch (e) {
      this.failure(e);
    } finally {
      this.busy = false;
      this.controller = null;
      if (this.rerun) {
        this.rerun = false;
        this.schedule();
      }
    }
  }
  private failure(e: unknown) {
    if (this.stopped) return;
    const code = e instanceof SyncError ? e.code : 'invalid';
    if (code === 'auth' || code === 'locked') this.keys = null;
    if (code === 'auth') {
      this.invalidSession();
      if (this.stopped) return;
    }
    this.refresh('paused', code);
    // No tight retry loop: local saves, focus/reconnect or explicit retry start another bounded attempt.
  }
  async disable() {
    this.epoch++;
    this.controller?.abort();
    this.keys = null;
    clearTimeout(this.timer);
    const state = this.state();
    if (!state) return;
    const current = this.store.read();
    const result = await this.store.sync!.write(
      current.db,
      { ...state, enabled: false },
      current.snapshot,
    );
    this.refresh(result.ok ? 'disabled' : 'paused', result.ok ? '' : 'local');
  }
  async resolveConflicts(
    choices: Record<string, 'local' | 'cloud'>,
    expected: string | null | undefined,
  ) {
    if (this.busy || this.stopped) throw new SyncError('local');
    const current = this.store.read(),
      state = this.state();
    if (!state || current.snapshot !== expected) throw new SyncError('local');
    const resolved = resolve(current.db, state, choices);
    const result = await this.store.sync!.write(resolved.db, resolved.state, expected);
    if (!result.ok) throw new SyncError('local');
    this.refresh();
    this.schedule();
  }
  attach() {
    const wake = () => {
      if (document.visibilityState !== 'hidden') void this.run();
    };
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }
  stop() {
    this.stopped = true;
    this.epoch++;
    this.controller?.abort();
    this.keys = null;
    clearTimeout(this.timer);
    this.unsubscribe();
    this.listeners.clear();
  }
}
