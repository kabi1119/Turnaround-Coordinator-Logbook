import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
describe('encrypted sync SQL static safeguards (not live RLS acceptance)', () => {
  it('limits API access to scoped functions, preserving forced RLS and immutable cloud keys', () => {
    const sql = readFileSync('supabase/migrations/202610270001_encrypted_sync.sql', 'utf8');
    expect(sql).toContain(
      'nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls',
    );
    expect(sql.match(/force row level security/g)).toHaveLength(2);
    expect(sql).toContain(
      'revoke all on tco_sync.accounts, tco_sync.records from public, anon, authenticated',
    );
    expect(sql.match(/security definer set search_path = ''/g)).toHaveLength(3);
    expect(sql.match(/owner to tco_sync_executor/g)).toHaveLength(3);
    expect(sql).toContain('if a.revision<>p_expected');
    expect(sql).toContain('for update');
    expect(sql).not.toMatch(/update[^;]+key_envelope\s*=/i);
    expect(sql).toContain('from public, anon, authenticated;');
    expect(sql).toContain('to authenticated;');
    expect(sql).not.toMatch(/alter table public.profiles/i);
  });
  it('requires disposable test opt-in and includes SQL ownership/anonymous/revision checks', () => {
    const sql = readFileSync('supabase/tests/encrypted_sync_rls.sql', 'utf8');
    for (const marker of [
      'tco.disposable_test',
      'rollback;',
      'set local role anon',
      'set local role tco_sync_executor',
      'Ownership reassignment',
      'Foreign ciphertext',
      'Stale/empty',
      'Anonymous push',
    ])
      expect(sql).toContain(marker);
  });
});
