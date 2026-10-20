import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authConfig } from '../src/auth/config';
import { explicitAuthEndpoint, writeAuthHeaders } from '../scripts/auth-headers.mjs';
describe('v0.7.0 configuration/security contracts (SQL not live-verified)', () => {
  it('allows only explicit HTTPS public configuration, rejecting privileged keys and injection', () => {
    expect(authConfig({})).toBeNull();
    expect(
      authConfig({
        VITE_SUPABASE_URL: 'https://fixture.example.test',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_key',
      }),
    ).toEqual({ url: 'https://fixture.example.test', key: 'sb_publishable_synthetic_key' });
    const jwt = (role: string) => 'header.' + btoa(JSON.stringify({ role })) + '.signature';
    expect(
      authConfig({
        VITE_SUPABASE_URL: 'https://fixture.example.test',
        VITE_SUPABASE_PUBLISHABLE_KEY: jwt('anon'),
      }),
    ).not.toBeNull();
    for (const key of ['sb_secret_synthetic', jwt('service_role'), ''])
      expect(() =>
        authConfig({
          VITE_SUPABASE_URL: 'https://fixture.example.test',
          VITE_SUPABASE_PUBLISHABLE_KEY: key,
        }),
      ).toThrow();
    for (const url of [
      'http://fixture.example.test',
      'https://user:pass@fixture.example.test',
      'https://fixture.example.test/?inject=x',
    ])
      expect(() =>
        authConfig({
          VITE_SUPABASE_URL: url,
          VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_key',
        }),
      ).toThrow();
  });
  it('generates narrowly scoped CSP without changing the source headers or weakening static URL checks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tco-auth-header-'));
    const original = readFileSync('public/_headers', 'utf8');
    try {
      writeAuthHeaders('https://fixture.example.test', dir);
      let headers = readFileSync(join(dir, '_headers'), 'utf8');
      expect(headers).toContain("connect-src 'self' https://fixture.example.test;");
      expect(headers).not.toContain('*.supabase.co');
      expect(headers).toContain("script-src 'self';");
      writeAuthHeaders(undefined, dir);
      headers = readFileSync(join(dir, '_headers'), 'utf8');
      expect(headers).toBe(original);
    } finally {
      rmSync(dir, { recursive: true });
    }
    const id = '/node_modules/@supabase/auth-js/dist/module/lib/constants.js';
    expect(
      explicitAuthEndpoint("export const GOTRUE_URL = 'http://localhost:9999';", id),
    ).toContain('https://unconfigured.invalid');
    expect(explicitAuthEndpoint('ordinary module', '/src/App.tsx')).toBeNull();
    expect(() => explicitAuthEndpoint('SDK changed', id)).toThrow();
  });
  it('prepares ownership RLS for every profile operation, no operational tables, disabled signup and OTP/invite templates', () => {
    const sql = readFileSync('supabase/migrations/202610200001_profiles.sql', 'utf8');
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toContain('from anon, authenticated');
    for (const operation of ['select', 'insert', 'update', 'delete'])
      expect(sql).toContain(`for ${operation} to authenticated`);
    expect(sql.match(/with check \(\(select auth.uid\(\)\) = id\)/g)).toHaveLength(2);
    expect(sql.match(/create table/g)).toHaveLength(1);
    expect(
      readFileSync('supabase/config.toml', 'utf8').match(/enable_signup = false/g),
    ).toHaveLength(2);
    expect(readFileSync('supabase/templates/otp.html', 'utf8')).toContain('{{ .Token }}');
    expect(readFileSync('supabase/templates/invite.html', 'utf8')).toContain(
      '/#invite_token_hash={{ .TokenHash }}',
    );
    const test = readFileSync('supabase/tests/profiles_rls.sql', 'utf8');
    expect(test).toContain('insufficient_privilege');
    expect(test).toContain('rollback;');
  });
});
