import { StrictMode } from 'react';
import { webcrypto } from 'node:crypto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import AuthApp from '../src/auth/AuthApp';
import AccountEntry from '../src/cloud/AccountEntry';
import { cloudAccountsEnabled } from '../src/cloud/config';
import { accountCacheKey } from '../src/cloud/cache';
import { emptyAccountDatabase } from '../src/workspaces/vault';
import { records } from '../src/sync/records';
import { CHOICE_KEY } from '../src/workspaces/store';
import { STORAGE_KEY } from '../src/lib/storage';
import { seedDatabase } from '../src/data/seed';
import type { AccountEngine } from '../src/cloud/engine';
import type { AccountStore } from '../src/cloud/cache';
const A = '90000000-0000-4000-8000-000000000001',
  B = '90000000-0000-4000-8000-000000000002',
  W = '90000000-0000-4000-8000-000000000003';
const features = ['legacy-manifest-v1', 'manual-archive-v1'];
function provider(existing = false) {
  let userId = A,
    revision = existing ? 1 : 0,
    legacy: number | null = null,
    rows = existing ? records(emptyAccountDatabase()) : [],
    setup = true;
  const listeners = new Set<(event: string, session: unknown) => void>();
  const user = () => ({
    id: userId,
    email: 'synthetic@example.test',
    email_confirmed_at: '2026-10-01',
    is_anonymous: false,
  });
  const session = () => ({
    user: user(),
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    access_token: 'synthetic-test-token-' + userId,
  });
  const pull = () => ({
    version: 2,
    userId,
    workspaceId: revision ? W : null,
    established: revision > 0 || legacy !== null,
    legacyRevision: legacy,
    revision,
    conversionState: 'active',
    features,
    records: rows.map((r) => ({ ...r, revision: 1 })),
    count: rows.length,
    total: rows.length,
  });
  const rpc = vi.fn((name: string, args: Record<string, unknown>) => {
    const builder = {
      setHeader: vi.fn(() => builder),
      abortSignal: vi.fn(async () => {
        if (!setup) return { data: null, error: { code: 'PGRST202', message: 'not installed' } };
        if (name === 'tco_account_pull') {
          const full = pull();
          return {
            data: {
              ...full,
              records: full.records.filter((r) => r.revision > Number(args.p_cursor)),
              count: full.records.filter((r) => r.revision > Number(args.p_cursor)).length,
            },
            error: null,
          };
        }
        if (name === 'tco_account_initialize') {
          rows = structuredClone(args.p_records as typeof rows);
          revision = 1;
          return {
            data: { version: 2, userId, workspaceId: W, revision, operationId: args.p_operation },
            error: null,
          };
        }
        return { data: null, error: { message: 'not enabled in fixture' } };
      }),
    };
    return builder;
  });
  const auth = {
    getUser: vi.fn(async () => ({ data: { user: user() }, error: null })),
    getSession: vi.fn(async () => ({ data: { session: session() }, error: null })),
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn((fn: (event: string, session: unknown) => void) => {
      listeners.add(fn);
      return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } };
    }),
  };
  return {
    client: {
      auth,
      rpc,
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { id: userId }, error: null }) }),
        }),
      }),
    } as unknown as SupabaseClient,
    rpc,
    auth,
    pull,
    legacy: () => {
      legacy = 1;
    },
    missing: () => {
      setup = false;
    },
    switch: () => {
      userId = B;
      listeners.forEach((fn) => fn('SIGNED_IN', session()));
    },
  };
}
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
});
afterEach(() => {
  engines.forEach((e) => e.stop());
  engines.length = 0;
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'locks');
});
function entry(
  p: ReturnType<typeof provider>,
  onOpen: (s: AccountStore, e: AccountEngine) => void = vi.fn(),
  extra = {},
) {
  return render(
    <AccountEntry
      user={{ id: A, email: 'synthetic@example.test' }}
      client={p.client}
      active={() => true}
      onOpen={(s, e) => {
        engines.push(e);
        onOpen(s, e);
      }}
      onLegacy={vi.fn()}
      onGuest={vi.fn()}
      onInvalid={vi.fn()}
      {...extra}
    />,
  );
}
describe('OFF-by-default actual Account entry integration', () => {
  it('requires the exact preview flag; ordinary production and generic true remain off', () => {
    expect(cloudAccountsEnabled({})).toBe(false);
    expect(cloudAccountsEnabled({ VITE_ACCOUNT_CLOUD_V2: 'false' })).toBe(false);
    expect(cloudAccountsEnabled({ VITE_ACCOUNT_CLOUD_V2: 'true' })).toBe(false);
    expect(cloudAccountsEnabled({ VITE_ACCOUNT_CLOUD_V2: 'preview' })).toBe(true);
  });
  it('real AuthApp acknowledges server-readable onboarding then opens the real App without a passphrase or Guest upload', async () => {
    const p = provider();
    const guest = JSON.stringify(seedDatabase());
    localStorage.setItem(STORAGE_KEY, guest);
    localStorage.setItem(CHOICE_KEY, 'account:' + A);
    render(<AuthApp provider={p.client} cloudMode />);
    const create = await screen.findByRole('button', { name: 'Create Cloud Account Workspace' });
    expect(create).toBeDisabled();
    expect(p.rpc.mock.calls.some(([n]) => n === 'tco_account_initialize')).toBe(false);
    expect(screen.queryByLabelText('Local vault passphrase')).toBeNull();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'I understand and accept this account storage model.' }),
    );
    fireEvent.click(create);
    await screen.findByRole('button', { name: 'Account' });
    expect(p.rpc.mock.calls.find(([n]) => n === 'tco_account_initialize')?.[1].p_records).toEqual(
      records(emptyAccountDatabase()),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(guest);
    await waitFor(() => expect(localStorage.getItem(accountCacheKey(A))).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Account Settings' }));
    expect(await screen.findByRole('dialog', { name: 'Account Settings' })).toHaveTextContent(
      'Account synchronization',
    );
    expect(screen.getByRole('button', { name: 'Download recovery archive' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Enable Cloud Sync' })).toBeNull();
  });
  it('leaves ordinary v0.8.3 authentication and vault creation unchanged while rollout is off', async () => {
    const p = provider();
    render(<AuthApp provider={p.client} cloudMode={false} />);
    await screen.findByRole('heading', { name: 'Create your local account vault' });
    expect(p.rpc).not.toHaveBeenCalled();
  });
  it('legacy settings-only accounts never initialize an empty replacement', async () => {
    const p = provider();
    p.legacy();
    entry(p);
    await screen.findByRole('button', { name: 'Open original local vault for recovery' });
    expect(screen.queryByRole('button', { name: 'Create Cloud Account Workspace' })).toBeNull();
    expect(p.rpc.mock.calls.map(([n]) => n)).toEqual(['tco_account_pull']);
  });
  it('opens a converted account without asking for a passphrase even when an original encrypted vault remains', async () => {
    const p = provider(true),
      original = 'preserved encrypted Legacy recovery bytes';
    localStorage.setItem('tco-account-vault-v1:' + A, original);
    localStorage.setItem(CHOICE_KEY, 'account:' + A);
    render(<AuthApp provider={p.client} cloudMode />);
    await screen.findByRole('button', { name: 'Account' });
    expect(screen.queryByLabelText(/passphrase/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Account Settings' }));
    expect(await screen.findByText('Account synchronization')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Enable Cloud Sync' })).toBeNull();
    expect(p.rpc.mock.calls.some(([n]) => n === 'tco_account_initialize')).toBe(false);
    expect(localStorage.getItem('tco-account-vault-v1:' + A)).toBe(original);
  });
  it('opens the integrated Legacy conversion review without consenting or uploading on navigation', async () => {
    const p = provider();
    p.legacy();
    entry(p);
    fireEvent.click(await screen.findByRole('button', { name: 'Review and convert Legacy Vault' }));
    await screen.findByRole('heading', { name: 'Review encrypted Legacy Vault' });
    expect(screen.getByText(/Nothing converts on sign-in/)).toBeVisible();
    expect(p.rpc.mock.calls.map(([n]) => n)).toEqual(['tco_account_pull']);
  });
  it('cloud-only legacy recovery does not create a new empty local vault', async () => {
    const p = provider();
    p.legacy();
    render(<AuthApp provider={p.client} cloudMode />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Open original local vault for recovery' }),
    );
    await screen.findByRole('heading', { name: 'Original vault not on this device' });
    expect(screen.queryByRole('button', { name: 'Create encrypted vault' })).toBeNull();
    expect(localStorage.getItem('tco-account-vault-v1:' + A)).toBeNull();
    expect(p.rpc.mock.calls.map(([name]) => name)).toEqual(['tco_account_pull']);
  });
  it('account switch during onboarding cancels the pending identity before any initialization', async () => {
    const p = provider();
    render(<AuthApp provider={p.client} cloudMode />);
    await screen.findByRole('button', { name: 'Create Cloud Account Workspace' });
    await act(async () => p.switch());
    await screen.findByRole('heading', { name: 'Welcome to TCO Logbook' });
    expect(p.rpc.mock.calls.some(([name]) => name === 'tco_account_initialize')).toBe(false);
    expect(localStorage.getItem(accountCacheKey(A))).toBeNull();
  });
  it('missing migration fails closed without creating a cache or initialization request', async () => {
    const p = provider();
    p.missing();
    entry(p);
    expect(await screen.findByRole('alert')).toHaveTextContent('No empty replacement was created');
    expect(localStorage.getItem(accountCacheKey(A))).toBeNull();
    expect(p.rpc.mock.calls.map(([n]) => n)).toEqual(['tco_account_pull']);
  });
  it('StrictMode opens once and ownership remains usable after entry hands off/unmounts', async () => {
    const p = provider(true);
    let captured: AccountStore | undefined;
    const opened = vi.fn((s: AccountStore, e: AccountEngine) => {
      captured = s;
      engines.push(e);
    });
    const view = render(
      <StrictMode>
        <AccountEntry
          user={{ id: A, email: 'synthetic@example.test' }}
          client={p.client}
          active={() => true}
          onOpen={opened}
          onLegacy={vi.fn()}
          onGuest={vi.fn()}
          onInvalid={vi.fn()}
        />
      </StrictMode>,
    );
    await waitFor(() => expect(opened).toHaveBeenCalledTimes(1));
    view.unmount();
    expect(captured!.read().db).toEqual(emptyAccountDatabase());
  });
  it('can reopen a saved account offline without authenticating or submitting requests', async () => {
    const p = provider(true);
    let store: AccountStore | undefined;
    const first = entry(p, (s: AccountStore) => {
      store = s;
    });
    await waitFor(() => expect(store).toBeDefined());
    expect((await store!.write(store!.read().db, store!.snapshot())).ok).toBe(true);
    first.unmount();
    p.rpc.mockClear();
    const opened = vi.fn();
    entry(p, opened, { offline: true });
    await waitFor(() => expect(opened).toHaveBeenCalledOnce());
    expect(p.rpc).not.toHaveBeenCalled();
  });
  it('account switching locks the real mounted workspace and retains its cache', async () => {
    const p = provider(true);
    localStorage.setItem(CHOICE_KEY, 'account:' + A);
    render(<AuthApp provider={p.client} cloudMode />);
    await screen.findByRole('button', { name: 'Account' });
    await waitFor(() => expect(localStorage.getItem(accountCacheKey(A))).not.toBeNull());
    const raw = localStorage.getItem(accountCacheKey(A));
    await act(async () => p.switch());
    await screen.findByRole('heading', { name: 'Welcome to TCO Logbook' });
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(localStorage.getItem(accountCacheKey(A))).toBe(raw);
  });
});
