import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../src/App';
import { openVault } from '../src/workspaces/vault';
import { STORAGE_KEY } from '../src/lib/storage';
const uid = '70000000-0000-4000-8000-000000000001';
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());
it('keeps reviewed Account drafts open on an asynchronous persistence failure without claiming success', async () => {
  const store = await openVault(uid, 'a lengthy unique test passphrase', true);
  vi.spyOn(store, 'write').mockResolvedValue({ ok: false, reason: 'unavailable' });
  render(<App workspace={store} />);
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Add' }));
  fireEvent.click(screen.getByRole('button', { name: /New Handling Record/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));
  await screen.findByText('Storage is unavailable. Nothing was saved.');
  expect(screen.getByRole('dialog', { name: 'Review Handling Record' })).toBeVisible();
  expect(screen.queryByText('Saved on this device')).toBeNull();
  expect(store.read().db.aircraft).toHaveLength(0);
  store.lock();
});
it('Account backup checks only the encrypted workspace, never the global Guest database', async () => {
  localStorage.setItem(STORAGE_KEY, 'Guest bytes must not be parsed by Account backup');
  const store = await openVault(uid, 'a lengthy unique test passphrase', true);
  const get = vi.spyOn(Storage.prototype, 'getItem');
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:fixture'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<App workspace={store} />);
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Export Full Backup (JSON)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Download unencrypted backup' }));
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(get.mock.calls.some((args) => args[0] === STORAGE_KEY)).toBe(false);
  expect(screen.getByText(/Backup download requested/)).toBeVisible();
  store.lock();
});
