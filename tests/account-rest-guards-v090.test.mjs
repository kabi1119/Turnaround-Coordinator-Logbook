import { describe, expect, it, vi } from 'vitest';
import {
  testConfiguration,
  verifyDisposableAccounts,
} from '../scripts/check-account-isolation.mjs';
const ref = 'abcdefghijklmnopqrst',
  A = '90000000-0000-4000-8000-000000000001',
  B = '90000000-0000-4000-8000-000000000002';
const token = (id, role = 'authenticated') =>
  'header.' +
  Buffer.from(JSON.stringify({ sub: id, role, exp: Math.floor(Date.now() / 1000) + 900 })).toString(
    'base64url',
  ) +
  '.synthetic-signature';
const env = {
  TCO_ACCOUNT_PRODUCTION_PROJECT_REF: 'zyxwvutsrqponmlkjihg',
  TCO_ACCOUNT_TEST_PROJECT_REF: ref,
  TCO_ACCOUNT_DISPOSABLE: 'yes',
  TCO_ACCOUNT_TEST_CONFIRM: 'DISPOSABLE:' + ref,
  TCO_ACCOUNT_TEST_URL: 'https://' + ref + '.supabase.co/',
  TCO_ACCOUNT_TEST_KEY: 'sb_publishable_synthetic',
  TCO_ACCOUNT_TEST_A_TOKEN: token(A),
  TCO_ACCOUNT_TEST_B_TOKEN: token(B),
  TCO_ACCOUNT_TEST_A_ID: A,
  TCO_ACCOUNT_TEST_B_ID: B,
};
describe('hosted runner guards (mocked only, no hosted requests)', () => {
  it('has no production defaults and requires independent exact disposable confirmation', () => {
    expect(() => testConfiguration({})).toThrow();
    for (const override of [
      { TCO_ACCOUNT_DISPOSABLE: 'no' },
      { TCO_ACCOUNT_TEST_CONFIRM: 'yes' },
      { TCO_ACCOUNT_TEST_URL: 'https://app.tcologbook.workers.dev/' },
      { TCO_ACCOUNT_TEST_URL: 'https://' + ref + '.supabase.co.evil.test/' },
      { TCO_ACCOUNT_TEST_URL: 'http://' + ref + '.supabase.co/' },
      { TCO_ACCOUNT_PRODUCTION_PROJECT_REF: ref },
      { TCO_ACCOUNT_PRODUCTION_PROJECT_REF: '' },
      { TCO_ACCOUNT_TEST_A_ID: B },
    ])
      expect(() => testConfiguration({ ...env, ...override })).toThrow();
    expect(testConfiguration(env).origin).toBe('https://' + ref + '.supabase.co');
  });
  it('rejects privileged API keys before any networking', () => {
    const privileged = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
    for (const key of ['sb_secret_forbidden', 'header.' + privileged + '.signature', 'malformed'])
      expect(() => testConfiguration({ ...env, TCO_ACCOUNT_TEST_KEY: key })).toThrow();
  });
  it('rejects privileged, foreign, malformed and expired user tokens before networking', () => {
    for (const bad of [
      token(A, 'service_role'),
      token(A, 'anon'),
      token(B),
      'sb_secret_forbidden',
      'header.' +
        Buffer.from(JSON.stringify({ sub: A, role: 'authenticated', exp: 1 })).toString(
          'base64url',
        ) +
        '.signature',
    ])
      expect(() => testConfiguration({ ...env, TCO_ACCOUNT_TEST_A_TOKEN: bad })).toThrow();
  });
  it('requires two independently verified empty users and checks both legacy and new storage', async () => {
    const config = testConfiguration(env),
      request = vi.fn(async (token, path) => {
        const id = token === config.a ? A : B;
        return {
          ok: true,
          data:
            path === '/auth/v1/user'
              ? { id, email_confirmed_at: '2026-10-28', is_anonymous: false }
              : path.endsWith('tco_sync_pull')
                ? {
                    version: 1,
                    userId: id,
                    revision: 0,
                    envelope: null,
                    total: 0,
                    count: 0,
                    records: [],
                  }
                : {
                    version: 2,
                    revision: 0,
                    count: 0,
                    records: [],
                    userId: id,
                    workspaceId: null,
                    established: false,
                    total: 0,
                    legacyRevision: null,
                  },
        };
      });
    await verifyDisposableAccounts(config, request);
    expect(request).toHaveBeenCalledTimes(6);
    expect(
      request.mock.calls.every(([, path]) => path === '/auth/v1/user' || path.endsWith('_pull')),
    ).toBe(true);
  });
  it('refuses established, legacy or anonymous data without attempting mutation', async () => {
    const config = testConfiguration(env);
    for (const scenario of ['established', 'legacy', 'anonymous', 'inconsistent']) {
      const request = vi.fn(async (token, path) => ({
        ok: true,
        data:
          path === '/auth/v1/user'
            ? {
                id: token === config.a ? A : B,
                email_confirmed_at: '2026-10-28',
                is_anonymous: scenario === 'anonymous',
              }
            : path.endsWith('tco_sync_pull')
              ? {
                  version: 1,
                  userId: token === config.a ? A : B,
                  revision: 1,
                  envelope: {},
                  total: 1,
                  count: 1,
                  records: [{}],
                }
              : {
                  version: 2,
                  revision: 0,
                  count: scenario === 'inconsistent' ? 1 : 0,
                  records: [],
                  userId: A,
                  workspaceId: scenario === 'established' ? A : null,
                  established: scenario === 'established',
                  total: 0,
                  legacyRevision: null,
                },
      }));
      await expect(verifyDisposableAccounts(config, request)).rejects.toThrow();
      if (scenario === 'legacy')
        expect(request.mock.calls.some(([, path]) => path.endsWith('tco_sync_pull'))).toBe(true);
      expect(
        request.mock.calls.every(
          ([, path]) => !path.includes('initialize') && !path.includes('push'),
        ),
      ).toBe(true);
    }
  });
});
