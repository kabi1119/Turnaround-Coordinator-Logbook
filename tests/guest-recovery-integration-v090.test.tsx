import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import GuestMergeWizard from '../src/migration/GuestMergeWizard';
import { openAccountCache } from '../src/cloud/cache';
import { AccountEngine, stateFromPull } from '../src/cloud/engine';
import { accountTransport } from '../src/cloud/transport';
import { confirmFinal, confirmPreparation, requestMerge } from '../src/migration/plan';
import { emptyAccountDatabase } from '../src/workspaces/vault';
import { emptyAircraft } from '../src/domain/model';
import { records, canonical } from '../src/sync/records';
import { recordKey } from '../src/sync/crypto';
import { STORAGE_KEY } from '../src/lib/storage';
import type { RecordData } from '../src/sync/types';
import type { AccountPull, AccountReceipt } from '../src/cloud/types';

const A = '90000000-0000-4000-8000-000000000001';
const W = '90000000-0000-4000-8000-000000000003';
const engines: AccountEngine[] = [];
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: async (_name: string, options: unknown, fn?: (lock: object) => unknown) =>
        typeof options === 'function' ? options({}) : fn!({}),
    },
  });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:recovery'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  engines.forEach((e) => e.stop());
  engines.length = 0;
  vi.unstubAllGlobals();
});

/** Synthetic provider executes the real RPC adapter contract; no network or credentials. */
async function fixture() {
  let revision = 1,
    floor = 0,
    loseAck = false,
    expired = false;
  let owner = A;
  let writes = 0,
    outcomeCalls = 0;
  const rowMap = new Map(
    records(emptyAccountDatabase()).map((r) => [recordKey(r), { ...r, revision: 1 }]),
  );
  const receipts = new Map<string, { hash: string; receipt: AccountReceipt }>();
  const retired = new Map<string, string>();
  const headers: string[] = [];
  const fail = (message: string) => ({ data: null, error: { code: 'P0001', message } });
  const pull = (cursor: number): AccountPull => {
    const rows = [...rowMap.values()].filter((r) => r.revision > cursor);
    return structuredClone({
      version: 2,
      userId: A,
      workspaceId: W,
      established: true,
      legacyRevision: null,
      revision,
      replayFloor: floor,
      records: rows,
      count: rows.length,
      total: rowMap.size,
    });
  };
  const client = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: owner,
            email: 'synthetic@example.invalid',
            email_confirmed_at: '2026-10-28',
            is_anonymous: false,
          },
        },
        error: null,
      }),
      getSession: async () => ({
        data: {
          session: {
            user: { id: owner },
            expires_at: Date.now() / 1000 + (expired ? -100 : 3600),
            access_token: 'synthetic-A-token',
          },
        },
        error: null,
      }),
      // These recovery cases simulate irrecoverable expiry, not a renewable access token.
      refreshSession: async () => ({
        data: { session: null },
        error: { status: 400, code: 'refresh_token_not_found', name: 'AuthApiError' },
      }),
    },
    rpc: (name: string, args: Record<string, unknown>) => ({
      setHeader(_key: string, value: string) {
        headers.push(value);
        return this;
      },
      async abortSignal(signal: AbortSignal) {
        if (signal.aborted) return fail('account_auth');
        if (name === 'tco_account_pull')
          return { data: pull(args.p_cursor as number), error: null };
        const id = args.p_operation as string,
          expected = args.p_expected as number;
        const rows = args.p_records as RecordData[];
        const hash = canonical({
          expected,
          records: rows,
          purpose: args.p_purpose || (name === 'tco_account_edit_outcome' ? 'edit' : 'guest-merge'),
        });
        const prior = receipts.get(id),
          closed = retired.get(id);
        if ((prior && prior.hash !== hash) || (closed && closed !== hash))
          return fail('account_conflict');
        if (name === 'tco_account_merge_outcome' || name === 'tco_account_edit_outcome') {
          outcomeCalls++;
          let outcome = prior
            ? 'committed'
            : closed
              ? 'retired'
              : expected < floor
                ? 'expired'
                : 'missing';
          if (outcome === 'missing' && args.p_retire) {
            retired.set(id, hash);
            outcome = 'retired';
          }
          return {
            data: {
              version: 2,
              userId: A,
              workspaceId: W,
              operationId: id,
              expected,
              revision,
              replayFloor: floor,
              outcome,
              operationRevision:
                prior?.receipt.revision ?? (outcome === 'retired' ? expected : null),
            },
            error: null,
          };
        }
        if (name !== 'tco_account_push') return fail('account_setup');
        if (closed) return fail('account_operation_retired');
        if (prior) return { data: prior.receipt, error: null };
        if (expected < floor) return fail('account_archived_review');
        if (expected !== revision) return fail('account_conflict');
        writes++;
        revision++;
        for (const row of rows) rowMap.set(recordKey(row), { ...structuredClone(row), revision });
        const receipt: AccountReceipt = {
          version: 2,
          userId: A,
          workspaceId: W,
          operationId: id,
          revision,
        };
        receipts.set(id, { hash, receipt });
        if (loseAck) {
          loseAck = false;
          return fail('network_timeout');
        }
        return { data: receipt, error: null };
      },
    }),
  } as unknown as SupabaseClient;
  const remote = accountTransport(client, A, () => true);
  const store = await openAccountCache(A, W, stateFromPull(pull(0), A), () => A);
  const engine = new AccountEngine(store, remote, () => true);
  engines.push(engine);
  const source = emptyAccountDatabase();
  source.aircraft.push({
    ...emptyAircraft('2026-10-28', ''),
    id: 'guest',
    airline: 'Cathay Pacific',
    handling: 'Arrival Only',
    role: 'Primary Coordinator',
    variant: 'A350-1000',
    arrival: {
      flight: 'CX0402',
      status: 'Not Recorded',
      origin: 'Self-reported',
      scheduled: '',
      actual: '',
    },
  });
  const raw = JSON.stringify(source);
  localStorage.setItem(STORAGE_KEY, raw);
  const plan = await confirmFinal(
    confirmPreparation(
      await requestMerge({
        source,
        destination: store.read().db,
        sourceSnapshot: raw,
        userId: A,
        workspaceId: W,
        revision: 1,
      }),
      A,
    ),
    { userId: A, workspaceId: W, sourceSnapshot: raw, destination: store.read().db, revision: 1 },
  );
  await engine.queueMerge(plan, raw);
  return {
    engine,
    store,
    remote,
    raw,
    source,
    lostResponse() {
      loseAck = true;
    },
    expire() {
      expired = true;
    },
    switchAccount() {
      owner = '90000000-0000-4000-8000-000000000002';
    },
    advanceCloud(archived = false) {
      revision++;
      const other = {
        ...structuredClone(source.aircraft[0]),
        id: 'cloud',
        arrival: { ...source.aircraft[0].arrival, flight: 'CX402' },
      };
      rowMap.set(recordKey({ collection: 'aircraft', id: 'cloud', value: other }), {
        collection: 'aircraft',
        id: 'cloud',
        value: other,
        revision,
      });
      if (archived) {
        floor = revision;
        receipts.clear();
      }
    },
    stats: () => ({ writes, outcomeCalls, headers }),
  };
}

describe('real Guest recovery engine, RPC adapter and React workflow', () => {
  async function mixedFixture() {
    const d = await fixture(),
      current = d.store.read(),
      state = d.engine.state();
    current.db.aircraft[0].notes = 'Later local Account intent';
    state.guestDelivery = { operationId: state.operation!.id, phase: 'unknown' };
    expect((await d.store.account.write(current.db, state, current.snapshot)).ok).toBe(true);
    await d.remote.push(state.operation!, new AbortController().signal); // Older client lost its acknowledgement.
    return d;
  }
  it('reviews mixed Account edits separately through the real UI and transport after verifying the original merge', async () => {
    const d = await mixedFixture();
    render(<GuestMergeWizard engine={d.engine} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verify Previous Submission' }));
    expect(await screen.findByRole('region', { name: 'Later Account edits review' })).toBeVisible();
    await waitFor(() => expect(d.engine.state().mixed?.stage).toBe('account-review'));
    expect(d.stats().writes).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Keep Local' }));
    await waitFor(() => expect(Object.keys(d.engine.state().mixed!.decisions)).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Approve later Account edits' })).toBeDisabled();
    const backup = d.engine.recoveryBackup();
    fireEvent.click(screen.getByRole('button', { name: 'Download mixed-queue recovery file' }));
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Reread saved mixed-queue recovery file'), {
        target: { files: [{ size: backup.length, text: async () => backup }] },
      }),
    );
    fireEvent.click(screen.getByLabelText(/I reviewed every later Account edit/));
    fireEvent.click(screen.getByRole('button', { name: 'Approve later Account edits' }));
    await waitFor(() => expect(d.engine.state().mixed?.stage).toBe('complete'));
    expect(d.stats().writes).toBe(2);
    expect(d.store.read().db.aircraft[0].notes).toBe('Later local Account intent');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw);
  });
  it('Manual Edit stages a real Handling editor result without writing Guest or uploading until separate approval', async () => {
    const d = await mixedFixture();
    await d.engine.verifyGuestSubmission();
    render(<GuestMergeWizard engine={d.engine} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Manual Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit Handling Record' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Notes'), {
      target: { value: 'Manually reviewed Account edit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    await waitFor(() =>
      expect(Object.values(d.engine.state().mixed!.decisions)[0]).toMatchObject({
        choice: 'manual',
        result: { notes: 'Manually reviewed Account edit' },
      }),
    );
    expect(d.stats().writes).toBe(1);
    expect(d.store.read().db.aircraft[0].notes).toBe('');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw);
  });
  it('keeps the mixed review and its decisions intact when authentication expires before approval', async () => {
    const d = await mixedFixture();
    await d.engine.verifyGuestSubmission();
    const row = d.engine.mixedEditRows()[0];
    await d.engine.saveMixedDecision(row.key, { choice: 'local' }, d.engine.state().mixed!.id);
    const backup = d.engine.recoveryBackup(),
      snapshot = d.store.snapshot();
    d.expire();
    await expect(d.engine.approveMixed(backup, snapshot, true, true)).rejects.toThrow('auth');
    expect(d.engine.recoveryBackup()).toBe(backup);
    expect(d.stats().writes).toBe(1);
  });
  it('never sends mixed Account A changes under a switched Account B session', async () => {
    const d = await mixedFixture();
    await d.engine.verifyGuestSubmission();
    const row = d.engine.mixedEditRows()[0];
    await d.engine.saveMixedDecision(row.key, { choice: 'local' }, d.engine.state().mixed!.id);
    const backup = d.engine.recoveryBackup(),
      snapshot = d.store.snapshot();
    d.switchAccount();
    await expect(d.engine.approveMixed(backup, snapshot, true, true)).rejects.toThrow('auth');
    expect(d.engine.recoveryBackup()).toBe(backup);
    expect(d.stats().writes).toBe(1);
  });
  it('resolves a separately recorded Account operation through its own RPC and real review UI', async () => {
    const d = await fixture(),
      originalPlan = d.engine.state().merge!;
    await d.remote.push(d.engine.state().operation!, new AbortController().signal);
    const fresh = stateFromPull(await d.remote.pull(0, new AbortController().signal), A);
    const value = { ...fresh.db.aircraft[0], notes: 'Recorded Account payload' };
    const operation = {
      id: crypto.randomUUID(),
      expected: 2,
      purpose: 'edit' as const,
      changes: [{ collection: 'aircraft' as const, id: value.id, value }],
    };
    const local = structuredClone(fresh.db);
    local.aircraft[0].notes = 'Final local after recorded operation';
    await d.store.account.write(
      local,
      { ...fresh.state, merge: originalPlan, operation },
      d.store.snapshot(),
    );
    await d.remote.push(operation, new AbortController().signal);
    render(<GuestMergeWizard engine={d.engine} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verify Previous Submission' }));
    expect(
      await screen.findByRole('button', { name: 'Verify retained Account operation' }),
    ).toBeDisabled();
    let backup = d.engine.recoveryBackup();
    fireEvent.click(screen.getByRole('button', { name: 'Download mixed-queue recovery file' }));
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Reread saved mixed-queue recovery file'), {
        target: { files: [{ size: backup.length, text: async () => backup }] },
      }),
    );
    fireEvent.click(screen.getByLabelText(/I verified the complete recovery file/));
    fireEvent.click(screen.getByRole('button', { name: 'Verify retained Account operation' }));
    await waitFor(() => expect(d.engine.state().mixed?.stage).toBe('account-review'));
    expect(d.engine.state().mixed?.retained).toMatchObject({
      id: operation.id,
      outcome: 'committed',
    });
    expect(d.stats().writes).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Keep Local' }));
    await waitFor(() => expect(Object.keys(d.engine.state().mixed!.decisions)).toHaveLength(1));
    backup = d.engine.recoveryBackup();
    fireEvent.click(screen.getByRole('button', { name: 'Download mixed-queue recovery file' }));
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Reread saved mixed-queue recovery file'), {
        target: { files: [{ size: backup.length, text: async () => backup }] },
      }),
    );
    fireEvent.click(screen.getByLabelText(/I reviewed every later Account edit/));
    fireEvent.click(screen.getByLabelText(/I approve the reviewed deletions/));
    fireEvent.click(screen.getByRole('button', { name: 'Approve later Account edits' }));
    await waitFor(() => expect(d.engine.state().mixed?.stage).toBe('complete'));
    expect(d.stats().writes).toBe(3);
    expect(d.store.read().db.aircraft[0].notes).toBe('Final local after recorded operation');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw);
  });
  it('verifies a lost acknowledgement through the real receipt action without another upload', async () => {
    const d = await fixture();
    d.lostResponse();
    await d.engine.run();
    render(<GuestMergeWizard engine={d.engine} onClose={() => {}} />);
    expect(screen.getByText(/Possibly submitted/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Cancel Unsubmitted Merge' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Verify Previous Submission' }));
    expect(await screen.findByText('View Completed Merge')).toBeVisible();
    expect(d.stats().writes).toBe(1);
    expect(d.stats().outcomeCalls).toBe(1);
    expect(d.stats().headers.every((h) => h === 'Bearer synthetic-A-token')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw);
  });
  it.each([false, true])(
    'requires saved-file readback and both renewed confirmations after stale/expired recovery (%s)',
    async (archived) => {
      const d = await fixture();
      d.advanceCloud(archived);
      await d.engine.run();
      render(<GuestMergeWizard engine={d.engine} onClose={() => {}} />);
      expect(screen.getByRole('button', { name: 'Review Updated Cloud Records' })).toBeDisabled();
      const backup = d.engine.recoveryBackup();
      fireEvent.click(screen.getByRole('button', { name: 'Export Recovery Data' }));
      await act(async () =>
        fireEvent.change(screen.getByLabelText('Reread saved Guest recovery file'), {
          target: { files: [{ size: backup.length, text: async () => backup }] },
        }),
      );
      fireEvent.click(screen.getByLabelText(/I verified this recovery file/));
      fireEvent.click(screen.getByRole('button', { name: 'Review Updated Cloud Records' }));
      expect(await screen.findByText('Full Guest review required')).toBeVisible();
      expect(screen.getByLabelText(/Confirmation 1/)).not.toBeChecked();
      expect(screen.getByRole('button', { name: 'Prepare duplicate review' })).toBeDisabled();
      fireEvent.click(screen.getByLabelText(/Confirmation 1/));
      fireEvent.click(screen.getByRole('button', { name: 'Prepare duplicate review' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Keep Cloud' })).toBeEnabled());
      expect(screen.getByRole('button', { name: 'Review transfer summary' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Keep Cloud' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Review transfer summary' })).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Review transfer summary' }));
      expect(screen.getByRole('button', { name: 'Approve and queue transfer' })).toBeDisabled();
      fireEvent.click(screen.getByLabelText(/Confirmation 2/));
      fireEvent.click(screen.getByRole('button', { name: 'Approve and queue transfer' }));
      await waitFor(() => expect(d.engine.state().merge?.stage).toBe('queued'));
      await act(async () => d.engine.run());
      expect(await screen.findByText('View Completed Merge')).toBeVisible();
      expect(d.stats().writes).toBe(0);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(d.raw);
    },
  );
  it('rejects expired authentication before recovery RPC execution and retains pending data', async () => {
    const d = await fixture();
    const original = d.engine.recoveryBackup();
    d.expire();
    await expect(d.engine.verifyGuestSubmission()).rejects.toThrow('auth');
    expect(d.stats().outcomeCalls).toBe(0);
    expect(d.engine.recoveryBackup()).toBe(original);
    expect(d.stats().writes).toBe(0);
  });
});
