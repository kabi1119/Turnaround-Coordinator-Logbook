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
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
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
afterEach(() => {
  client?.auth.stopAutoRefresh();
  client = null;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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
