import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const initial = readFileSync('supabase/migrations/202610270001_encrypted_sync.sql', 'utf8');
const authorization = readFileSync(
  'supabase/migrations/202610280001_sync_authorization.sql',
  'utf8',
);
const temporary =
  'grant tco_sync_executor to postgres with admin false, inherit false, set true granted by postgres;';
const revoke = 'revoke tco_sync_executor from postgres granted by postgres;';
describe('v0.8.2 restricted migration ownership', () => {
  it('grants SET without inheritance before transferring RPC ownership', () => {
    expect(initial).toContain(temporary);
    expect(initial.indexOf(temporary)).toBeLessThan(
      initial.indexOf('alter function public.tco_sync_pull(bigint) owner to tco_sync_executor'),
    );
    expect(initial).toContain('grant usage, create on schema public to tco_sync_executor;');
    expect(initial.indexOf('set local role tco_sync_executor;')).toBeLessThan(
      initial.indexOf('revoke all on function public.tco_sync_pull'),
    );
  });
  it('replaces existing RPCs as their restricted owner with temporary schema CREATE', () => {
    const first = authorization.indexOf('create or replace function public.tco_sync_pull');
    expect(
      authorization.indexOf('grant create on schema public to tco_sync_executor;'),
    ).toBeLessThan(first);
    expect(authorization.indexOf(temporary)).toBeLessThan(first);
    expect(authorization.indexOf('set local role tco_sync_executor;')).toBeLessThan(first);
    expect(authorization.indexOf('set local role postgres;')).toBeGreaterThan(
      authorization.indexOf('grant execute on function public.tco_sync_pull'),
    );
  });
  it('revokes only its own membership and schema CREATE before transaction completion', () => {
    for (const text of [initial, authorization]) {
      expect(text.match(/grant tco_sync_executor to postgres/g)).toHaveLength(1);
      expect(text).toContain(revoke);
      expect(text.indexOf(revoke)).toBeGreaterThan(text.indexOf('set local role postgres;'));
      expect(text.indexOf(revoke)).toBeLessThan(text.indexOf('commit;'));
      expect(text).toContain('Temporary executor SET/INHERIT permission was not fully removed');
      expect(text).toContain('Temporary executor schema CREATE permission was not fully removed');
      expect(text).not.toMatch(/granted by supabase_admin/i);
    }
  });
  it('refuses to overwrite an existing administrator-issued membership', () => {
    expect(authorization).toContain("and grantor='postgres'::regrole");
    expect(authorization).toContain(
      'Existing postgres-issued executor membership requires owner review',
    );
    expect(authorization.indexOf('Existing postgres-issued')).toBeLessThan(
      authorization.indexOf(temporary),
    );
    expect(authorization).toContain('Existing executor SET/INHERIT access requires owner review');
  });
  it('keeps the migration role narrow and never adds broad Auth or browser membership grants', () => {
    for (const text of [initial, authorization]) {
      expect(text).not.toMatch(/^\s*grant\b[^;]*\bauth\b/im);
      expect(text).not.toMatch(
        /grant\s+tco_sync_executor\s+to\s+(authenticated|anon|authenticator|service_role)\b/i,
      );
      expect(text).toContain("if current_user<>'postgres'");
    }
    expect(initial).toContain(
      'nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls',
    );
    expect(authorization.match(/security definer set search_path = ''/g)).toHaveLength(3);
    expect(authorization).toContain('stable security invoker');
  });
  it('verifies cleanup without operational data access and runs migration tests as a genuine non-superuser', () => {
    const verification = readFileSync('supabase/tests/sync_role_ownership_v082.sql', 'utf8');
    expect(verification).toContain("pg_has_role('postgres','tco_sync_executor','SET')");
    expect(verification).not.toMatch(/^\s*(insert|update|delete|truncate|grant|revoke|alter)\b/im);
    const runner = readFileSync('scripts/check-sync-migrations.mjs', 'utf8');
    expect(runner).toContain('new PGlite()');
    expect(runner).toMatch(/session_user:\s*'postgres',[\s\S]*?superuser:\s*false/);
    expect(runner).toContain('not set_option and not inherit_option');
    expect(runner).toMatch(/bootstrap_admin:\s*1/);
    expect(runner).toContain('must be able to SET ROLE');
    expect(runner).toContain('must be owner of function');
    expect(runner).toContain('interrupted-replacement');
  });
});
