import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SyncControl from '../src/sync/SyncControl';
import type { SyncEngine, SyncStatus } from '../src/sync/engine';
import { LanguageContext } from '../src/i18n';
function engine(phase: SyncStatus['phase'] = 'disabled') {
  const status: SyncStatus = { phase, pending: 2, conflicts: 0, lastSuccess: null, error: '' };
  return {
    subscribe: () => () => {},
    snapshot: () => status,
    state: () => null,
    canRun: () => false,
    enable: vi.fn(async () => {}),
    run: vi.fn(async () => {}),
    disable: vi.fn(async () => {}),
  } as unknown as SyncEngine;
}
describe('Account sync consent controls', () => {
  it('requires passphrase confirmation and explicit consent; rendering never enables or uploads', async () => {
    const e = engine();
    render(<SyncControl engine={e} />);
    const button = screen.getByRole('button', { name: 'Enable / unlock Cloud Sync' });
    expect(button).toBeDisabled();
    expect(e.enable).not.toHaveBeenCalled();
    expect(e.run).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Cloud vault passphrase'), {
      target: { value: 'unique fictional secret' },
    });
    fireEvent.change(screen.getByLabelText('Confirm passphrase'), {
      target: { value: 'different' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Confirm passphrase'), {
      target: { value: 'unique fictional secret' },
    });
    fireEvent.click(button);
    expect(e.enable).toHaveBeenCalledWith('unique fictional secret');
    await waitFor(() => expect(screen.getByLabelText('Cloud vault passphrase')).toHaveValue(''));
  });
  it('keeps offline/Guest without an engine unable to enable sync', () => {
    render(<SyncControl engine={null} />);
    expect(screen.getByText(/Guest stays device-only/)).toBeVisible();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('does not label pending or paused work Synced and supports Traditional Chinese', () => {
    render(
      <LanguageContext.Provider value="zh-HK">
        <SyncControl engine={engine('pending')} />
      </LanguageContext.Provider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('尚待同步');
    expect(screen.queryByText('已同步')).toBeNull();
  });
});
