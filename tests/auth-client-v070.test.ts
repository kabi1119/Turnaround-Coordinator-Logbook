import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
const uid = '70000000-0000-4000-8000-000000000001';
const user = {
  id: uid,
  email: 'a@example.test',
  email_confirmed_at: '2026-10-01T00:00:00Z',
  aud: 'authenticated',
  role: 'authenticated',
};
let client: SupabaseClient | null = null;
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
  });
function session() {
  const enc = (value: unknown) =>
    btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return {
    access_token: `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: uid, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.synthetic`,
    refresh_token: 'synthetic-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user,
  };
}
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://auth-fixture.example.test');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_synthetic_fixture_key');
});
afterEach(async () => {
  await client?.auth.stopAutoRefresh();
  await client?.auth.dispose();
  client = null;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('v0.9.4 official SDK remembered session (synthetic HTTP only)', () => {
  it('ordinary restoration does not cancel an SDK refresh already in flight', async () => {
    let release!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/verify')) return response(session());
        if (String(input).includes('/token?grant_type=refresh_token'))
          return new Promise<Response>((resolve) => {
            release = resolve;
          });
        throw new Error('Unexpected synthetic URL');
      }),
    );
    const mod = await import('../src/auth/client');
    client = mod.authClient()!;
    await client.auth.verifyOtp({ email: user.email, token: '654321', type: 'email' });
    const pending = client.auth.refreshSession();
    for (let i = 0; i < 30 && !release; i++) await new Promise((r) => setTimeout(r, 5));
    mod.resumeAuthRequests();
    release(response({ ...session(), refresh_token: 'synthetic-rotation-survived' }));
    expect((await pending).error).toBeNull();
    expect(JSON.parse(localStorage.getItem(mod.AUTH_STORAGE_KEY)!).refresh_token).toBe(
      'synthetic-rotation-survived',
    );
  });
  it('rechecks the replacement token when the previous token is rejected during rotation', async () => {
    let rotate = true,
      checks = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/verify')) return response(session());
        if (url.includes('/token?grant_type=refresh_token'))
          return response({
            ...session(),
            access_token: session().access_token.replace('.synthetic', '.rotated'),
          });
        if (url.includes('/user')) {
          checks++;
          if (rotate) {
            rotate = false;
            await client!.auth.refreshSession();
            return response({ message: 'Synthetic old token expired' }, 401);
          }
          return response(user);
        }
        throw new Error('Unexpected synthetic URL');
      }),
    );
    const mod = await import('../src/auth/client');
    client = mod.authClient()!;
    await client.auth.verifyOtp({ email: user.email, token: '654321', type: 'email' });
    expect((await (await import('../src/auth/session')).verifiedSession(client, uid)).user.id).toBe(
      uid,
    );
    expect(checks).toBe(2);
  });
  it('an invalid refresh credential requires fresh authentication without touching account/Guest data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/verify')) return response(session());
        if (String(input).includes('/token?grant_type=refresh_token'))
          return response(
            { code: 'refresh_token_not_found', message: 'Synthetic revoked session' },
            400,
          );
        throw new Error('Unexpected synthetic URL');
      }),
    );
    const mod = await import('../src/auth/client');
    client = mod.authClient()!;
    await client.auth.verifyOtp({ email: user.email, token: '654321', type: 'email' });
    localStorage.setItem('synthetic-pending-cache', 'preserved');
    const expired = JSON.parse(localStorage.getItem(mod.AUTH_STORAGE_KEY)!);
    expired.expires_at = Math.floor(Date.now() / 1000) - 1;
    localStorage.setItem(mod.AUTH_STORAGE_KEY, JSON.stringify(expired));
    const result = await client.auth.refreshSession();
    expect((await import('../src/auth/session')).rejectedSession(result.error)).toBe(true);
    expect(localStorage.getItem(mod.AUTH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('synthetic-pending-cache')).toBe('preserved');
  });
  it('restores persisted credentials in a recreated client and refreshes expiry without a second OTP', async () => {
    let verifies = 0,
      refreshes = 0,
      identities = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/verify')) {
          verifies++;
          return response(session());
        }
        if (url.includes('/token?grant_type=refresh_token')) {
          refreshes++;
          return response({ ...session(), refresh_token: 'synthetic-rotated-refresh' });
        }
        if (url.includes('/user')) {
          identities++;
          return response(user);
        }
        throw new Error('Unexpected synthetic URL');
      }),
    );
    const first = await import('../src/auth/client');
    client = first.authClient()!;
    expect(
      (await client.auth.verifyOtp({ email: user.email, token: '654321', type: 'email' })).error,
    ).toBeNull();
    const saved = JSON.parse(localStorage.getItem(first.AUTH_STORAGE_KEY)!);
    expect(saved.refresh_token).toBe('synthetic-refresh-token');
    await client.auth.dispose();
    // A new client instance has no in-memory identity. The SDK must read its saved session.
    vi.resetModules();
    const reloaded = await import('../src/auth/client');
    client = reloaded.authClient()!;
    const { verifiedSession } = await import('../src/auth/session');
    expect((await verifiedSession(client, uid)).user.id).toBe(uid);
    expect(verifies).toBe(1);
    expect(identities).toBeGreaterThan(0);
    // Simulate an old access-token deadline while keeping the SDK-owned refresh credential.
    await client.auth.dispose();
    saved.expires_at = Math.floor(Date.now() / 1000) - 1;
    localStorage.setItem(first.AUTH_STORAGE_KEY, JSON.stringify(saved));
    vi.resetModules();
    const resumed = await import('../src/auth/client');
    client = resumed.authClient()!;
    expect(
      (await (await import('../src/auth/session')).verifiedSession(client, uid)).expires,
    ).toBeGreaterThan(Date.now());
    expect(refreshes).toBeGreaterThan(0);
    expect(verifies).toBe(1);
    expect(JSON.parse(localStorage.getItem(first.AUTH_STORAGE_KEY)!).refresh_token).toBe(
      'synthetic-rotated-refresh',
    );
  });
  it('temporary server-identity failure leaves SDK credentials available for recovery', async () => {
    let unavailable = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/verify')) return response(session());
        if (String(input).includes('/user'))
          return unavailable
            ? response({ message: 'Synthetic temporary outage' }, 503)
            : response(user);
        throw new Error('Unexpected synthetic URL');
      }),
    );
    const mod = await import('../src/auth/client');
    client = mod.authClient()!;
    await client.auth.verifyOtp({ email: user.email, token: '654321', type: 'email' });
    const raw = localStorage.getItem(mod.AUTH_STORAGE_KEY);
    unavailable = true;
    const { verifiedSession, rejectedSession } = await import('../src/auth/session');
    const error = await verifiedSession(client, uid).catch((e) => e);
    expect(rejectedSession(error)).toBe(false);
    expect(localStorage.getItem(mod.AUTH_STORAGE_KEY)).toBe(raw);
    unavailable = false;
    expect((await verifiedSession(client, uid)).user.id).toBe(uid);
  });
  it('cancelling a new OTP request preserves an already remembered session and its later refresh', async () => {
    let release!: (response: Response) => void,
      pending = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/verify'))
          return pending
            ? new Promise<Response>((resolve) => {
                release = resolve;
              })
            : response(session());
        if (String(input).includes('/token?grant_type=refresh_token')) return response(session());
        if (String(input).includes('/user')) return response(user);
        throw new Error('Unexpected synthetic URL');
      }),
    );
    const mod = await import('../src/auth/client');
    client = mod.authClient()!;
    await client.auth.verifyOtp({ email: user.email, token: '654321', type: 'email' });
    const raw = localStorage.getItem(mod.AUTH_STORAGE_KEY);
    pending = true;
    const late = client.auth.verifyOtp({ email: user.email, token: '654321', type: 'email' });
    for (let i = 0; i < 30 && !release; i++) await new Promise((r) => setTimeout(r, 5));
    mod.cancelPendingSignIn();
    release(response(session()));
    expect((await late).error).not.toBeNull();
    expect(localStorage.getItem(mod.AUTH_STORAGE_KEY)).toBe(raw);
    expect((await client.auth.refreshSession()).error).toBeNull();
    expect(localStorage.getItem(mod.AUTH_STORAGE_KEY)).not.toBeNull();
  });
});
describe('official Supabase SDK transport contract (HTTP mocked; not a live provider test)', () => {
  it('sends shouldCreateUser=false, verifies email OTP, fetches server identity/profile only, and signs out locally', async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
        if (url.includes('/verify')) return response(session());
        if (url.includes('/user')) return response(user);
        if (url.includes('/rest/v1/profiles')) return response([{ id: uid }]);
        if (url.includes('/logout')) return new Response(null, { status: 204 });
        return response({});
      }),
    );
    const mod = await import('../src/auth/client');
    client = mod.authClient()!;
    await client.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: false } });
    expect(calls.find((c) => c.url.includes('/otp'))?.body).toMatchObject({
      email: user.email,
      create_user: false,
    });
    const verified = await client.auth.verifyOtp({
      email: user.email,
      token: '654321',
      type: 'email',
    });
    expect(verified.error).toBeNull();
    expect(calls.find((c) => c.url.includes('/verify'))?.body).toMatchObject({
      email: user.email,
      token: '654321',
      type: 'email',
    });
    expect(await mod.verifiedIdentity(client)).toEqual({ id: uid, email: user.email });
    await mod.ensureProfile(client, uid);
    mod.cancelAuthRequests();
    await mod.signOutLocal(client);
    expect(calls.some((c) => c.url.includes('/logout?scope=local'))).toBe(true);
    expect(localStorage.getItem(mod.AUTH_STORAGE_KEY)).toBeNull();
    expect(
      calls.every((c) => /\/(auth\/v1|rest\/v1\/profiles)/.test(new URL(c.url).pathname)),
    ).toBe(true);
  });
  it('does not persist a late successful OTP response after Guest/cancel', async () => {
    let release!: (r: Response) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const mod = await import('../src/auth/client');
    client = mod.authClient()!;
    const signedIn = vi.fn();
    const { data } = client.auth.onAuthStateChange((e) => {
      if (e === 'SIGNED_IN') signedIn();
    });
    const pending = client.auth.verifyOtp({ email: user.email, token: '654321', type: 'email' });
    for (let i = 0; i < 30 && !fetcher.mock.calls.length; i++)
      await new Promise((r) => setTimeout(r, 5));
    expect(fetcher).toHaveBeenCalledOnce();
    mod.cancelAuthRequests();
    release(response(session()));
    expect((await pending).error).not.toBeNull();
    expect(signedIn).not.toHaveBeenCalled();
    expect(localStorage.getItem(mod.AUTH_STORAGE_KEY)).toBeNull();
    data.subscription.unsubscribe();
  });
});
