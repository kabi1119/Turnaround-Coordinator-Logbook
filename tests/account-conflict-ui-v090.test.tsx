import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConflictControl from '../src/cloud/ConflictControl';
import type { AccountEngine } from '../src/cloud/engine';

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:synthetic-conflict'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
  vi.restoreAllMocks();
});

describe('ordinary Account conflict review', () => {
  it('shows both versions and requires a verified recovery file before resolving', async () => {
    const key = JSON.stringify(['aircraft', 'synthetic-id']);
    const backup = JSON.stringify({ kind: 'tco-account-pending-recovery', version: 1, rows: [] });
    const resolveConflicts = vi.fn(async () => {});
    const status = { phase: 'conflict' };
    const engine = {
      subscribe: () => () => {},
      snapshot: () => status,
      state: () => ({ conflicts: [key], recovery: null }),
      recoveryBackup: () => backup,
      recoveryRows: () => [
        {
          key,
          local: { collection: 'aircraft', id: 'synthetic-id', value: { notes: 'Local' } },
          cloud: { collection: 'aircraft', id: 'synthetic-id', value: { notes: 'Cloud' } },
        },
      ],
      store: { snapshot: () => 'same-cache-snapshot' },
      resolveConflicts,
    };
    render(<ConflictControl engine={engine as unknown as AccountEngine} />);
    expect(screen.getByText(/Both versions remain available/)).toBeVisible();
    fireEvent.click(screen.getByText('Review all field differences'));
    expect(screen.getByText(/Cloud: Cloud/)).toBeVisible();
    expect(screen.getByText(/Local: Local/)).toBeVisible();
    fireEvent.click(screen.getByLabelText('Keep Cloud version'));
    fireEvent.click(screen.getByLabelText(/I reviewed every conflict/));
    expect(screen.getByRole('button', { name: 'Approve conflict decisions' })).toBeDisabled();
    expect(resolveConflicts).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Download conflict recovery file' }));
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Reread saved recovery file'), {
        target: { files: [{ size: backup.length, text: async () => backup }] },
      });
    });
    fireEvent.click(screen.getByLabelText(/I reviewed every conflict/));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Approve conflict decisions' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve conflict decisions' }));
    await waitFor(() =>
      expect(resolveConflicts).toHaveBeenCalledWith({ [key]: 'cloud' }, 'same-cache-snapshot'),
    );
  });
});
