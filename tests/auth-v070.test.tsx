import { webcrypto } from 'node:crypto';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import AuthApp from '../src/auth/AuthApp';
import SignIn from '../src/auth/SignIn';
import { consumeInvitation, LAST_ACCOUNT_KEY } from '../src/auth/client';
import { CHOICE_KEY } from '../src/workspaces/store';
import { openVault, vaultKey } from '../src/workspaces/vault';
import { seedDatabase } from '../src/data/seed';
import { STORAGE_KEY } from '../src/lib/storage';
const A = '70000000-0000-4000-8000-000000000001',
  B = '70000000-0000-4000-8000-000000000002';
const secret = 'a long unique local vault secret';
function provider() {
  let id = A,
    session: { user: ReturnType<typeof user>; expires_at: number } | null = null;
  const user = () => ({
    id,
    email: id === A ? 'a@example.test' : 'b@example.test',
    email_confirmed_at: '2026-10-01T00:00:00Z',
    is_anonymous: false,
  });
  const listeners = new Set<(event: string, session: unknown) => void>();
  const auth = {
    signInWithOtp: vi.fn(async () => ({ data: {}, error: null })),
    verifyOtp: vi.fn(async (args: { token?: string; token_hash?: string }) => {
      if (args.token !== '654321' && !args.token_hash)
        return { data: { session: null }, error: { message: 'private provider detail' } };
      session = { user: user(), expires_at: Math.floor(Date.now() / 1000) + 3600 };
      return { data: { session }, error: null };
    }),
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: user() }, error: null })),
    signOut: vi.fn(async () => {
      session = null;
      return { error: null };
    }),
    stopAutoRefresh: vi.fn(),
    startAutoRefresh: vi.fn(),
    onAuthStateChange: vi.fn((fn: (event: string, session: unknown) => void) => {
      listeners.add(fn);
      return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } };
    }),
  };
  const from = vi.fn((table: string) => {
    if (table !== 'profiles') throw new Error('Unexpected table');
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id }, error: null }) }) }),
      insert: vi.fn(async () => ({ error: null })),
    };
  });
  return {
    client: { auth, from } as unknown as SupabaseClient,
    auth,
    from,
    other: () => {
      id = B;
    },
    restore: () => {
      session = { user: user(), expires_at: Math.floor(Date.now() / 1000) + 3600 };
    },
    emit: (event: string) => listeners.forEach((fn) => fn(event, session)),
  };
}
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});
async function otp(email = 'a@example.test') {
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Email OTP' }));
  const input = await screen.findByLabelText('Six-digit verification code');
  fireEvent.change(input, { target: { value: '654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
  await screen.findByRole('heading', {
    name: /Create your local account vault|Unlock your local account vault/,
  });
}
async function unlock(create = false) {
  fireEvent.change(screen.getByLabelText('Local vault passphrase'), { target: { value: secret } });
  if (create)
    fireEvent.change(screen.getByLabelText('Confirm vault passphrase'), {
      target: { value: secret },
    });
  fireEvent.click(
    screen.getByRole('button', { name: create ? 'Create encrypted vault' : 'Unlock vault' }),
  );
  await screen.findByRole('button', { name: 'Account' });
}
describe('auth/workspace entry with simulated provider responses (not live Supabase)', () => {
  it('shows first-visit welcome, disabled Passkey, honest missing configuration, and remembers offline Guest', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const app = render(<AuthApp provider={null} />);
    await screen.findByRole('heading', { name: 'Welcome to TCO Logbook' });
    expect(screen.getByRole('button', { name: /Continue with Passkey/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continue with Email OTP' })).toBeDisabled();
    expect(app.container.querySelector('.home-intro')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue as Guest' }));
    await screen.findByRole('button', { name: 'Sign in' });
    app.unmount();
    render(<AuthApp provider={null} />);
    await screen.findByRole('button', { name: 'Sign in' });
    expect(screen.queryByText('Welcome to TCO Logbook')).toBeNull();
  });
  it('restores legacy Guest without onboarding or any profile request and preserves exact bytes', async () => {
    const p = provider(),
      raw = JSON.stringify(seedDatabase());
    localStorage.setItem(STORAGE_KEY, raw);
    render(<AuthApp provider={p.client} />);
    await screen.findByRole('button', { name: 'Sign in' });
    expect(p.auth.getSession).not.toHaveBeenCalled();
    expect(p.from).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('rejects invalid/expired OTP without exposing provider details, verifies real adapter options and supports resend cooldown', async () => {
    const p = provider(),
      done = vi.fn(async () => {});
    vi.useFakeTimers();
    render(<SignIn client={p.client} onVerified={done} onGuest={() => {}} />);
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'a@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Email OTP' }));
    await act(async () => {});
    expect(p.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@example.test',
      options: { shouldCreateUser: false },
    });
    fireEvent.change(screen.getByLabelText('Six-digit verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await act(async () => {});
    expect(screen.getByRole('alert')).toHaveTextContent('Could not verify');
    expect(screen.queryByText(/private provider detail/)).toBeNull();
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeDisabled();
    await act(async () => {
      vi.advanceTimersByTime(61000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await act(async () => {});
    expect(p.auth.signInWithOtp).toHaveBeenCalledTimes(2);
  });
  it('opens empty Account A only after OTP and vault setup, saves reviewed drafts encrypted, then restores Guest and isolates B', async () => {
    const p = provider(),
      guest = JSON.stringify(seedDatabase());
    localStorage.setItem(STORAGE_KEY, guest);
    render(<AuthApp provider={p.client} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    await otp();
    expect(screen.queryByRole('navigation')).toBeNull();
    await unlock(true);
    expect(screen.getByRole('region', { name: 'Handling summary' })).toHaveTextContent('00');
    expect(screen.queryByText(/CX9401/)).toBeNull();
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /New Handling Record/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      screen.getByRole('region', { name: 'Unfinished Records' }).querySelector('dd'),
    ).toHaveTextContent('01');
    const encrypted = localStorage.getItem(vaultKey(A))!;
    expect(encrypted).not.toContain('Untitled');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(guest);
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Switch to Guest' }));
    await screen.findByRole('button', { name: 'Sign in' });
    expect(p.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(localStorage.getItem(vaultKey(A))).toBe(encrypted);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(guest);
    p.other();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await otp('b@example.test');
    await unlock(true);
    expect(
      screen.getByRole('region', { name: 'Unfinished Records' }).querySelector('dd'),
    ).toHaveTextContent('00');
    expect(p.from.mock.calls.every((args) => args[0] === 'profiles')).toBe(true);
    expect(localStorage.getItem(vaultKey(A))).toBe(encrypted);
  });
  it('restores a server-verified account to a locked vault and hides it immediately on expiration', async () => {
    const vault = await openVault(A, secret, true);
    vault.lock();
    const p = provider();
    p.restore();
    localStorage.setItem(CHOICE_KEY, 'account:' + A);
    render(<AuthApp provider={p.client} />);
    await screen.findByRole('heading', { name: 'Unlock your local account vault' });
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(p.auth.getUser).toHaveBeenCalled();
    await unlock();
    const raw = localStorage.getItem(vaultKey(A));
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 7200000);
    fireEvent(document, new Event('visibilitychange'));
    await screen.findByRole('heading', { name: 'Welcome to TCO Logbook' });
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(localStorage.getItem(vaultKey(A))).toBe(raw);
  });
  it('rejects a revoked session and lets Guest win over a late startup response', async () => {
    const p = provider();
    p.restore();
    p.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('revoked'),
    } as never);
    const app = render(<AuthApp provider={p.client} />);
    await screen.findByRole('heading', { name: 'Welcome to TCO Logbook' });
    expect(screen.queryByText('Signed in as')).toBeNull();
    app.unmount();
    localStorage.clear();
    const late = provider();
    let release!: (value: unknown) => void;
    late.auth.getSession.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }) as never,
    );
    render(<AuthApp provider={late.client} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue as Guest' }));
    await act(async () => {
      release({
        data: { session: { user: { id: A }, expires_at: Math.floor(Date.now() / 1000) + 3600 } },
        error: null,
      });
    });
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
    expect(screen.queryByLabelText('Local vault passphrase')).toBeNull();
  });
  it('allows explicit offline vault unlock without pretending to renew an account session', async () => {
    const vault = await openVault(A, secret, true);
    vault.lock();
    localStorage.setItem(LAST_ACCOUNT_KEY, A);
    localStorage.setItem(CHOICE_KEY, 'account:' + A);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const p = provider();
    render(<AuthApp provider={p.client} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Unlock saved local vault' }));
    fireEvent.change(screen.getByLabelText('Local vault passphrase'), {
      target: { value: secret },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock vault' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Vault' }));
    expect(screen.getByRole('menu')).toHaveTextContent('Session not verified');
    act(() => p.emit('SIGNED_OUT'));
    expect(screen.getByRole('button', { name: 'Vault' })).toBeVisible();
    expect(p.auth.getSession).not.toHaveBeenCalled();
    expect(p.auth.getUser).not.toHaveBeenCalled();
  });
  it('consumes only supported invitation tokens and removes credentials from browser history', () => {
    const token = 'a'.repeat(64);
    window.history.replaceState(null, '', '/#invite_token_hash=' + token);
    expect(consumeInvitation(window.location, window.history)).toBe(token);
    expect(window.location.hash).toBe('');
    window.history.replaceState(null, '', '/#access_token=untrusted&refresh_token=untrusted');
    expect(consumeInvitation(window.location, window.history)).toBeNull();
    expect(window.location.hash).toBe('');
  });
});
