import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import HistoryControl from '../src/cloud/HistoryControl';
import type { AccountEngine } from '../src/cloud/engine';
import type { HistoryResponse } from '../src/cloud/types';
import { recordKey } from '../src/sync/crypto';

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:history'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('reviewed live record history', () => {
  it('compares each version and requires saved-file readback plus replacement approval', async () => {
    const current = { collection: 'aircraft' as const, id: 'synthetic', value: { notes: 'new' } };
    const response: HistoryResponse = {
      version: 2,
      userId: 'user',
      workspaceId: 'workspace',
      revision: 2,
      replayFloor: 0,
      archivedAt: null,
      records: [
        {
          operationId: 'operation',
          collection: 'aircraft',
          id: 'synthetic',
          previousRevision: 1,
          replacementRevision: 2,
          value: { notes: 'old' },
          createdAt: '2026-10-28T00:00:00Z',
        },
      ],
    };
    const backup = JSON.stringify({ kind: 'tco-account-pending-recovery', value: current });
    const restoreHistory = vi.fn(async () => {});
    const status = { phase: 'synced' };
    const engine = {
      subscribe: () => () => {},
      snapshot: () => status,
      state: () => ({ base: [{ record: current, revision: 2 }] }),
      store: {
        snapshot: () => 'snapshot',
        read: () => ({ db: { aircraft: [], duties: [], journals: [] } }),
      },
      recoveryBackup: () => backup,
      history: vi.fn(async () => response),
      restoreHistory,
    } as unknown as AccountEngine;
    render(<HistoryControl engine={engine} />);
    fireEvent.change(screen.getByLabelText('Record'), { target: { value: recordKey(current) } });
    fireEvent.click(screen.getByRole('button', { name: 'Open record history' }));
    expect(await screen.findByText(/Select a live version/)).toBeVisible();
    fireEvent.click(screen.getByLabelText(/Previous revision 1/));
    expect(screen.getByText(/Current: new/)).toBeVisible();
    expect(screen.getByText(/Selected: old/)).toBeVisible();
    fireEvent.click(screen.getByLabelText(/I reviewed the field differences/));
    fireEvent.click(screen.getByLabelText(/I approve replacing the current value/));
    expect(screen.getByRole('button', { name: 'Approve new restoration revision' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Download current recovery file' }));
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Reread saved recovery file'), {
        target: { files: [{ size: backup.length, text: async () => backup }] },
      }),
    );
    fireEvent.click(screen.getByLabelText(/I reviewed the field differences/));
    fireEvent.click(screen.getByLabelText(/I approve replacing the current value/));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Approve new restoration revision' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve new restoration revision' }));
    await waitFor(() =>
      expect(restoreHistory).toHaveBeenCalledWith(
        response,
        response.records[0],
        backup,
        'snapshot',
        true,
      ),
    );
  });
});
