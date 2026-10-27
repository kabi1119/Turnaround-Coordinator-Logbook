import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { transport } from '../src/sync/transport';
const A = '80000000-0000-4000-8000-000000000001';
function client() {
  const auth = {
    getUser: vi.fn(async () => ({
      data: {
        user: {
          id: A,
          email: 'synthetic@example.test',
          email_confirmed_at: '2026-01-01',
          is_anonymous: false,
        },
      },
      error: null,
    })),
    getSession: vi.fn(async () => ({
      data: { session: { user: { id: A }, expires_at: Math.floor(Date.now() / 1000) + 300 } },
      error: null,
    })),
  };
  const response = { data: { version: 1 }, error: null as unknown };
  const abortSignal = vi.fn(async () => response),
    rpc = vi.fn(() => ({ abortSignal }));
  return {
    auth,
    rpc,
    abortSignal,
    response,
    remote: transport({ auth, rpc } as unknown as SupabaseClient, A),
  };
}
describe('cloud transport authentication and failures', () => {
  it('verifies identity and expiry before every RPC regardless of the browser online hint', async () => {
    const c = client(),
      controller = new AbortController();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await c.remote.pull(0, controller.signal);
    await c.remote.pull(1, controller.signal);
    expect(c.auth.getUser).toHaveBeenCalledTimes(2);
    expect(c.auth.getSession).toHaveBeenCalledTimes(2);
    expect(c.abortSignal).toHaveBeenCalledWith(controller.signal);
  });
  it('rejects switched, expired, anonymous or revoked sessions before sending a payload', async () => {
    for (const mode of ['switched', 'expired', 'anonymous', 'revoked']) {
      const c = client();
      if (mode === 'switched')
        c.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: 'other' }, expires_at: Date.now() / 1000 + 300 } },
          error: null,
        });
      if (mode === 'expired')
        c.auth.getSession.mockResolvedValue({
          data: { session: { user: { id: A }, expires_at: 1 } },
          error: null,
        });
      if (mode === 'anonymous')
        c.auth.getUser.mockResolvedValue({
          data: {
            user: {
              id: A,
              email: 'a@example.test',
              email_confirmed_at: '2026',
              is_anonymous: true,
            },
          },
          error: null,
        });
      if (mode === 'revoked')
        c.auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } } as never);
      await expect(c.remote.pull(0, new AbortController().signal)).rejects.toMatchObject({
        code: 'auth',
      });
      expect(c.rpc).not.toHaveBeenCalled();
    }
  });
  it('fences an aborted request during identity verification', async () => {
    const c = client(),
      controller = new AbortController();
    c.auth.getSession.mockImplementation(async () => {
      controller.abort();
      return {
        data: { session: { user: { id: A }, expires_at: Date.now() / 1000 + 300 } },
        error: null,
      };
    });
    await expect(c.remote.pull(0, controller.signal)).rejects.toMatchObject({ code: 'locked' });
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ['PGRST202', 'setup'],
    ['42501', 'auth'],
    ['53100', 'capacity'],
    ['23505', 'conflict'],
    ['429', 'network'],
  ])('maps %s safely to %s', async (code, expected) => {
    const c = client();
    c.response.error = { code, message: 'sensitive provider detail' };
    await expect(c.remote.pull(0, new AbortController().signal)).rejects.toMatchObject({
      code: expected,
      message: expected,
    });
  });
});
