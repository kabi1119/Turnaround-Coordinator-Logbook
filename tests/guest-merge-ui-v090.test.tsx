import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GuestMergeWizard from '../src/migration/GuestMergeWizard';
import { emptyAccountDatabase } from '../src/workspaces/vault';
import { emptyAircraft } from '../src/domain/model';
import { STORAGE_KEY } from '../src/lib/storage';
import { confirmPreparation, requestMerge, type MergePlan } from '../src/migration/plan';
import type { AccountEngine } from '../src/cloud/engine';

const userId = '90000000-0000-4000-8000-000000000001';
const workspaceId = '90000000-0000-4000-8000-000000000003';
const guestId = '90000000-0000-4000-8000-000000000011';
const cloudId = '90000000-0000-4000-8000-000000000012';
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});
function fixture() {
  const guest = emptyAccountDatabase();
  guest.aircraft.push({
    ...emptyAircraft('2026-10-28', ''),
    id: guestId,
    airline: 'Cathay Pacific',
    variant: 'A350-1000',
    handling: 'Arrival Only',
    role: 'Primary Coordinator',
    arrival: {
      flight: 'CX0402',
      status: 'Not Recorded',
      origin: 'Self-reported',
      scheduled: '',
      actual: '',
    },
  });
  const cloud = structuredClone(guest);
  cloud.aircraft[0].id = cloudId;
  cloud.aircraft[0].arrival.flight = 'CX402';
  const raw = JSON.stringify(guest);
  localStorage.setItem(STORAGE_KEY, raw);
  let plan: MergePlan | null = null;
  let snapshot = { phase: 'pending' };
  const listeners = new Set<() => void>();
  const queue = vi.fn(async (next: MergePlan) => {
    plan = next;
  });
  const save = vi.fn(async (next: MergePlan, current: string) => {
    expect(current).toBe(raw);
    plan = next;
    snapshot = { phase: next.stage };
    for (const listener of listeners) listener();
  });
  const engine = {
    store: {
      account: { userId, workspaceId },
      read: () => ({ db: cloud, snapshot: 'account-snapshot' }),
      snapshot: () => 'account-snapshot',
    },
    state: () => ({ cursor: 1, merge: plan, operation: null, recovery: null }),
    snapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    saveMergeReview: save,
    canRun: () => true,
    recoveryBackup: () => 'synthetic-recovery',
    cancelUnsubmittedReview: vi.fn(async () => {}),
    queueMerge: queue,
  };
  return { guest, cloud, raw, engine, save, queue };
}
describe('Guest transfer UI', () => {
  it('keeps an unsubmitted review cancel action behind an actual saved-file readback', async () => {
    const { engine, guest, cloud, raw } = fixture();
    const plan = confirmPreparation(
      await requestMerge({
        source: guest,
        destination: cloud,
        sourceSnapshot: raw,
        userId,
        workspaceId,
        revision: 1,
      }),
      userId,
    );
    let current: MergePlan | null = plan;
    const cancel = vi.fn(async () => {
      current = null;
    });
    engine.state = () => ({ cursor: 1, merge: current, operation: null, recovery: null });
    engine.cancelUnsubmittedReview = cancel;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:review'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<GuestMergeWizard engine={engine as unknown as AccountEngine} onClose={() => {}} />);
    const button = screen.getByRole('button', { name: 'Cancel unsubmitted review' });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Download unsubmitted review' }));
    const text = JSON.stringify({ kind: 'tco-guest-review-backup', version: 1, plan });
    fireEvent.change(screen.getByLabelText('Reread saved review'), {
      target: { files: [{ size: text.length, text: async () => text }] },
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(cancel).toHaveBeenCalledWith('account-snapshot'));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    vi.restoreAllMocks();
  });
  it('does not inspect candidates or upload before confirmation 1', async () => {
    const { engine, save, queue, raw } = fixture();
    render(<GuestMergeWizard engine={engine as unknown as AccountEngine} onClose={() => {}} />);
    expect(screen.getByText(/Guest originals stay on this device/)).toBeVisible();
    expect(screen.queryByText(/Cloud candidate/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prepare duplicate review' })).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
    expect(queue).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('shows the candidate and requires an individual choice and second approval', async () => {
    const { engine, save, queue, raw } = fixture();
    render(<GuestMergeWizard engine={engine as unknown as AccountEngine} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Confirmation 1/));
    fireEvent.click(screen.getByRole('button', { name: 'Prepare duplicate review' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText(/CX0402/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Review transfer summary' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep Cloud' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Review transfer summary' }));
    expect(screen.getByRole('button', { name: 'Approve and queue transfer' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Confirmation 2/));
    fireEvent.click(screen.getByRole('button', { name: 'Approve and queue transfer' }));
    await waitFor(() => expect(queue).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('refuses to submit a plan after Guest bytes change', async () => {
    const { engine, guest, cloud, raw, queue } = fixture();
    const plan = confirmPreparation(
      await requestMerge({
        source: guest,
        destination: cloud,
        sourceSnapshot: raw,
        userId,
        workspaceId,
        revision: 1,
      }),
      userId,
    );
    engine.state = () => ({ cursor: 1, merge: plan, operation: null, recovery: null });
    const changed = structuredClone(guest);
    changed.aircraft[0].notes = 'changed after review';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(changed));
    render(<GuestMergeWizard engine={engine as unknown as AccountEngine} onClose={() => {}} />);
    expect(screen.getByText(/source or Account destination changed/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start a new review' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download old review plan' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Approve and queue transfer' }),
    ).not.toBeInTheDocument();
    expect(queue).not.toHaveBeenCalled();
  });
  it('opens the existing Handling editor for Manual Edit without writing Guest or uploading', async () => {
    const { engine, save, queue, raw } = fixture();
    render(<GuestMergeWizard engine={engine as unknown as AccountEngine} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Confirmation 1/));
    fireEvent.click(screen.getByRole('button', { name: 'Prepare duplicate review' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Manual Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open record editor' }));
    expect(screen.getByRole('heading', { name: 'Edit Handling Record' })).toBeVisible();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(queue).not.toHaveBeenCalled();
  });
});
