import { StrictMode } from 'react';
import { webcrypto } from 'node:crypto';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { AUTH_STORAGE_KEY } from '../src/auth/client';
import { seedDatabase } from '../src/data/seed';
import type { AccountEngine } from '../src/cloud/engine';
import type { AccountStore } from '../src/cloud/cache';
const A = '90000000-0000-4000-8000-000000000001',
  B = '90000000-0000-4000-8000-000000000002',
  W = '90000000-0000-4000-8000-000000000003';
const features = ['legacy-manifest-v1', 'manual-archive-v1'];
function provider(existing = false, language: 'en' | 'zh-HK' = 'en') {
  let signedIn = true,
    expiry = Math.floor(Date.now() / 1000) + 3600;
  let userId = A,
    revision = existing ? 1 : 0,
    legacy: number | null = null,
    rows = existing ? records(emptyAccountDatabase(language)) : [],
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
    expires_at: expiry,
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
    getSession: vi.fn(async () => ({
      data: { session: signedIn ? session() : null },
      error: null,
    })),
    refreshSession: vi.fn(async () => {
      expiry = Math.floor(Date.now() / 1000) + 3600;
      listeners.forEach((fn) => fn('TOKEN_REFRESHED', session()));
      return { data: { session: session() }, error: null };
    }),
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn(),
    signOut: vi.fn(async () => {
      signedIn = false;
      listeners.forEach((fn) => fn('SIGNED_OUT', null));
      return { error: null };
    }),
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
    expire: () => {
      expiry = Math.floor(Date.now() / 1000) - 1;
    },
    expireIn: (ms: number) => {
      expiry = Date.now() / 1000 + ms / 1000;
    },
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

describe('v0.9.4 persistent session integration (synthetic Auth/RPC)', () => {
  it('the actual expiry timer renews a short-lived session without closing the Cloud Account', async () => {
    const p = provider(true);
    p.expireIn(2000);
    render(<AuthApp provider={p.client} cloudMode />);
    await screen.findByRole('button', { name: 'Account' });
    expect(p.auth.refreshSession).not.toHaveBeenCalled();
    await waitFor(() => expect(p.auth.refreshSession).toHaveBeenCalledOnce(), { timeout: 3500 });
    expect(screen.getByRole('button', { name: 'Account' })).toBeVisible();
    expect(screen.queryByLabelText('Email address')).toBeNull();
  });
  it('a late foreground verification cannot reopen Account A after switching to Guest', async () => {
    const p = provider(true);
    render(<AuthApp provider={p.client} cloudMode />);
    await screen.findByRole('button', { name: 'Account' });
    let release!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    p.auth.getUser.mockReturnValueOnce(pending as never);
    fireEvent(window, new Event('focus'));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Switch to Guest' }));
    await act(async () =>
      release({
        data: {
          user: {
            id: A,
            email: 'synthetic@example.test',
            email_confirmed_at: '2026-10-01',
            is_anonymous: false,
          },
        },
        error: null,
      }),
    );
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Account' })).toBeNull();
    expect(p.auth.signOut).not.toHaveBeenCalled();
  });
  it('restores the same Cloud Account across remount/reload without OTP or a passphrase', async () => {
    const p = provider(true);
    localStorage.setItem(CHOICE_KEY, 'account:' + A);
    const first = render(<AuthApp provider={p.client} cloudMode />);
    await screen.findByRole('button', { name: 'Account' });
    await waitFor(() => expect(localStorage.getItem(accountCacheKey(A))).not.toBeNull());
    first.unmount();
    render(<AuthApp provider={p.client} cloudMode />);
    await screen.findByRole('button', { name: 'Account' });
    expect(screen.queryByLabelText('Email address')).toBeNull();
    expect(screen.queryByLabelText(/passphrase/i)).toBeNull();
    expect(p.auth.getUser).toHaveBeenCalled();
    expect(p.rpc.mock.calls.some(([name]) => name === 'tco_account_initialize')).toBe(false);
  });
  it('refreshes an expired token and accepts same-account cross-tab rotation without closing the workspace', async () => {
    const p = provider(true);
    render(<AuthApp provider={p.client} cloudMode />);
    await screen.findByRole('button', { name: 'Account' });
    p.expire();
    fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(p.auth.refreshSession).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Account' })).toBeVisible();
    fireEvent(
      window,
      new StorageEvent('storage', {
        key: AUTH_STORAGE_KEY,
        newValue: JSON.stringify({ user: { id: A }, access_token: 'synthetic-rotated' }),
      }),
    );
    await act(async () => {});
    expect(screen.getByRole('navigation')).toBeVisible();
    expect(screen.queryByLabelText('Email address')).toBeNull();
    expect(p.auth.signOut).not.toHaveBeenCalled();
  });
  it('Switch to Guest preserves the remembered session; reopening verifies identity without OTP', async () => {
    const p = provider(true),
      guest = JSON.stringify(seedDatabase());
    localStorage.setItem(STORAGE_KEY, guest);
    localStorage.setItem(CHOICE_KEY, 'account:' + A);
    render(<AuthApp provider={p.client} cloudMode />);
    await screen.findByRole('button', { name: 'Account' });
    // This fixture has Guest records, so dismiss the separate reviewed-transfer prompt.
    const dialog = screen.queryByRole('dialog');
    if (dialog) fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Switch to Guest' }));
    await screen.findByRole('button', { name: 'Sign in' });
    expect(p.auth.signOut).not.toHaveBeenCalled();
    const checked = p.auth.getUser.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('button', { name: 'Account' });
    expect(p.auth.getUser.mock.calls.length).toBeGreaterThan(checked);
    expect(screen.queryByLabelText('Email address')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(guest);
  });
  it('retains durable pending drafts during network failure and re-verifies on reconnect', async () => {
    const p = provider(true);
    render(<AuthApp provider={p.client} cloudMode />);
    await screen.findByRole('button', { name: 'Account' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a Handling Record' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const raw = localStorage.getItem(accountCacheKey(A))!;
    expect(JSON.parse(raw).db.aircraft).toHaveLength(1);
    p.auth.getUser.mockRejectedValue(new TypeError('Synthetic network outage'));
    fireEvent(window, new Event('focus'));
    await screen.findByText(/Account session not verified/);
    expect(localStorage.getItem(accountCacheKey(A))).toBe(raw);
    expect(screen.queryByLabelText('Email address')).toBeNull();
    expect(screen.getByRole('navigation')).toBeVisible();
    p.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: A,
          email: 'synthetic@example.test',
          email_confirmed_at: '2026-10-01',
          is_anonymous: false,
        },
      },
      error: null,
    });
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(screen.queryByText(/Account session not verified/)).toBeNull());
    expect(JSON.parse(localStorage.getItem(accountCacheKey(A))!).db.aircraft).toHaveLength(1);
  });
  it('explicit Sign Out clears authenticated access, preserves the cache and requires fresh OTP', async () => {
    const p = provider(true);
    render(<AuthApp provider={p.client} cloudMode />);
    await screen.findByRole('button', { name: 'Account' });
    const raw = localStorage.getItem(accountCacheKey(A));
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign Out' }));
    await screen.findByRole('heading', { name: 'Welcome to TCO Logbook' });
    expect(p.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(screen.getByLabelText('Email address')).toBeVisible();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(localStorage.getItem(accountCacheKey(A))).toBe(raw);
  });
  it('rejects genuinely invalid identity and different-account storage immediately, retaining original cache', async () => {
    const p = provider(true);
    const app = render(<AuthApp provider={p.client} cloudMode />);
    await screen.findByRole('button', { name: 'Account' });
    const raw = localStorage.getItem(accountCacheKey(A));
    p.auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } } as never);
    fireEvent(window, new Event('focus'));
    await screen.findByRole('heading', { name: 'Welcome to TCO Logbook' });
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(localStorage.getItem(accountCacheKey(A))).toBe(raw);
    app.unmount();
    const other = provider(true);
    render(<AuthApp provider={other.client} cloudMode />);
    await screen.findByRole('button', { name: 'Account' });
    fireEvent(
      window,
      new StorageEvent('storage', {
        key: AUTH_STORAGE_KEY,
        newValue: JSON.stringify({ user: { id: B } }),
      }),
    );
    await screen.findByRole('heading', { name: 'Welcome to TCO Logbook' });
    expect(localStorage.getItem(accountCacheKey(B))).toBeNull();
  });
  it.each(['en', 'zh-HK'] as const)(
    'normal Cloud Account menu/settings have no passphrase or encrypted-sync instruction in %s',
    async (language) => {
      const p = provider(true, language);
      render(<AuthApp provider={p.client} cloudMode />);
      const account = language === 'en' ? 'Account' : '帳戶',
        settings = language === 'en' ? 'Account Settings' : '帳戶設定';
      if (language === 'zh-HK') {
        await screen.findByRole('button', { name: 'Account' });
        fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
        fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'zh-HK' } });
      }
      fireEvent.click(await screen.findByRole('button', { name: account }));
      expect(screen.getByRole('menu')).not.toHaveTextContent(/encrypted|passphrase|加密同步|密語/i);
      fireEvent.click(screen.getByRole('menuitem', { name: settings }));
      expect(await screen.findByRole('dialog', { name: settings })).not.toHaveTextContent(
        /passphrase|Local vault|Enable Cloud Sync|密語|啟用加密/,
      );
    },
  );
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
