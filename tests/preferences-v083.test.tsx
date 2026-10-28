import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../src/App';
import {
  defaultOptionalFields,
  emptyAircraft,
  handlingTypes,
  restrictivePrivacy,
} from '../src/domain/model';
import { confirmedHandlingIssues } from '../src/domain/handlingForm';
import { readDatabase, STORAGE_KEY } from '../src/lib/storage';
import { emptyAccountDatabase, openVault } from '../src/workspaces/vault';

const id = '83000000-0000-4000-8000-000000000001';
const secret = 'fictional optional fields test passphrase';
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());
describe('v0.8.3 fresh optional fields without preference migration', () => {
  it('shares six enabled fresh Guest/Account preferences without copying Guest records or enabling Cloud Sync', async () => {
    const guest = readDatabase().db;
    expect(Object.keys(defaultOptionalFields)).toHaveLength(6);
    expect(Object.values(defaultOptionalFields)).toEqual(Array(6).fill(true));
    expect(guest.settings.privacy).toEqual(defaultOptionalFields);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guest));
    const rawGuest = localStorage.getItem(STORAGE_KEY);
    const account = await openVault(id, secret, true);
    expect(account.read().db).toEqual(emptyAccountDatabase());
    expect(account.read().db.settings.privacy).toEqual(defaultOptionalFields);
    expect(account.read().db.aircraft).toEqual([]);
    expect(account.sync!.read()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(rawGuest);
    const copy = emptyAccountDatabase();
    copy.settings.privacy.registration = false;
    expect(emptyAccountDatabase().settings.privacy.registration).toBe(true);
    account.lock();
  });
  it('preserves existing disabled and mixed Guest/Account preferences and ciphertext on reopen', async () => {
    const guest = readDatabase().db;
    guest.settings.privacy = { ...restrictivePrivacy, gateTimes: true };
    const guestBytes = JSON.stringify(guest);
    localStorage.setItem(STORAGE_KEY, guestBytes);
    expect(readDatabase().db.settings.privacy).toEqual(guest.settings.privacy);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(guestBytes);
    const account = await openVault(id, secret, true);
    const db = {
      ...account.read().db,
      settings: { language: 'zh-HK' as const, privacy: { ...restrictivePrivacy, statuses: true } },
    };
    expect((await account.write(db, account.snapshot())).ok).toBe(true);
    const encrypted = account.snapshot();
    account.lock();
    const reopened = await openVault(id, secret);
    expect(reopened.read().db).toEqual(db);
    expect(reopened.snapshot()).toBe(encrypted);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(guestBytes);
    reopened.lock();
  });
  it.each(handlingTypes)(
    'preserves applicable flight/Bay confirmation requirements and disabled-field exemptions for %s',
    (handling) => {
      const a = {
        ...emptyAircraft('', ''),
        date: '2026-10-01',
        airline: 'CX',
        handling,
        role: 'Primary Coordinator' as const,
        aircraftType: 'A350',
        variant: 'A350-1000',
      };
      // Visibility does not make registration, gate times, statuses or notes mandatory.
      expect(
        confirmedHandlingIssues(a, defaultOptionalFields, '2026-10-28')
          .map((x) => x.field)
          .sort(),
      ).toEqual(
        [
          'bay',
          ...(handling !== 'Departure Only' ? ['arrival'] : []),
          ...(handling !== 'Arrival Only' ? ['departure'] : []),
        ].sort(),
      );
      expect(confirmedHandlingIssues(a, restrictivePrivacy, '2026-10-28')).toEqual([]);
    },
  );
  it('renders enabled preferences from persistence, allows changing one and saves an incomplete reviewed Draft', async () => {
    const store = await openVault(id, secret, true);
    render(<App workspace={store} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getAllByRole('switch')).toHaveLength(6);
    for (const toggle of screen.getAllByRole('switch')) expect(toggle).toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name: 'Registration' }));
    const confirm = screen.getByRole('dialog');
    fireEvent.click(within(confirm).getByRole('button', { name: /Confirm/ }));
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Registration' })).not.toBeChecked(),
    );
    expect(store.read().db.settings.privacy.registration).toBe(false);
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /New Handling Record/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    expect(store.read().db.aircraft).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(store.read().db.aircraft).toHaveLength(1);
    expect(store.read().db.aircraft[0]).toMatchObject({
      status: 'Draft',
      bay: '',
      registration: '',
    });
    expect(store.read().db.settings.privacy.registration).toBe(false);
    expect(store.sync!.read()).toBeNull();
    store.lock();
  });
});
