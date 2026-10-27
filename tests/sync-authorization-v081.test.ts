import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const original = readFileSync('supabase/migrations/202610270001_encrypted_sync.sql', 'utf8');
const patch = readFileSync('supabase/migrations/202610280001_sync_authorization.sql', 'utf8');
describe('v0.8.1 additive authorization contract (hosted acceptance separate)', () => {
  it('uses a private non-privileged helper without reaching Auth schema', () => {
    expect(patch).toContain('function tco_sync.request_user_id() returns uuid');
    expect(patch).toContain("stable security invoker set search_path = ''");
    expect(patch).toContain("current_setting('request.jwt.claims',true)");
    expect(patch).toContain("current_setting('request.jwt.claim.sub',true)");
    expect(patch).toContain("coalesce(claims->>'role',legacy_role,'')<>'authenticated'");
    expect(patch).toContain("coalesce(claims->'is_anonymous','false'::jsonb)<>'false'::jsonb");
    expect(patch).toContain('exception when invalid_text_representation then return null');
    expect(patch).not.toMatch(/auth\.(uid|jwt)\(/);
    expect(patch).not.toMatch(/^\s*grant\b[^;]*\bauth\b/im);
    expect(patch).toContain(
      'revoke all on function tco_sync.request_user_id() from public, anon, authenticated, service_role',
    );
    expect(patch).toContain(
      'grant execute on function tco_sync.request_user_id() to tco_sync_executor',
    );
  });
  it('updates every sync policy, including both sides of UPDATE, through the same request identity', () => {
    expect(patch.match(/alter policy /g)).toHaveLength(6);
    expect(patch.match(/select tco_sync.request_user_id\(\)/g)).toHaveLength(8);
    expect(patch.match(/using \(user_id=\(select tco_sync.request_user_id\(\)\)\)/g)).toHaveLength(
      4,
    );
    expect(
      patch.match(/with check \(user_id=\(select tco_sync.request_user_id\(\)\)\)/g),
    ).toHaveLength(4);
  });
  it('preserves every RPC business/revision/ciphertext operation apart from request identity resolution', () => {
    const before = [
      ...original.matchAll(/create function public\.tco_sync_[\s\S]*?end \$\$;/g),
    ].map((x) => x[0]);
    const after = [
      ...patch.matchAll(/create or replace function public\.tco_sync_[\s\S]*?end \$\$;/g),
    ].map((x) => x[0]);
    expect(before).toHaveLength(3);
    expect(after).toHaveLength(3);
    const normalize = (sql: string) => sql.replace(/\s+/g, '');
    before.forEach((sql, i) => {
      const expected = sql
        .replace('create function', 'create or replace function')
        .replace(
          /if auth\.uid\(\) is null or coalesce\(auth\.jwt\(\)->>'is_anonymous','false'\) <> 'false' then/,
          'if tco_sync.request_user_id() is null then',
        )
        .replaceAll('auth.uid()', 'tco_sync.request_user_id()');
      expect(normalize(after[i])).toBe(normalize(expected));
    });
  });
  it('retains restricted ownership, empty search paths and authenticated-only RPC execution', () => {
    for (const marker of [
      'rolcanlogin or rolinherit or rolsuper or rolbypassrls',
      'Unsafe sync executor membership',
      'Expected forced-RLS tables owned independently of executor',
      'Expected v0.8.0 RPC ownership',
    ])
      expect(patch).toContain(marker);
    expect(patch.match(/security definer set search_path = ''/g)).toHaveLength(3);
    expect(patch).toContain('from public, anon, authenticated, service_role');
    expect(patch).toContain('to authenticated;');
    expect(patch).not.toMatch(/grant\s+authenticated\s+to\s+tco_sync_executor/i);
  });
  it('updates authorization without rewriting existing key/record rows', () => {
    expect(patch.trim()).toMatch(/commit;$/);
    expect(patch).not.toMatch(/\b(drop|truncate)\b|\bdelete\s+from\b/i);
    expect(patch).not.toMatch(/update\s+tco_sync\.accounts\s+set\s+key_envelope/i);
    expect(original).toContain('grant usage on schema tco_sync to tco_sync_executor');
    expect(original).not.toMatch(/^\s*grant\b[^;]*\bauth\b/im);
  });
  it('ships disposable SQL regression cases for modern, legacy, malformed and anonymous JWT claims', () => {
    const sql = readFileSync('supabase/tests/sync_authorization_v081.sql', 'utf8');
    for (const marker of [
      'tco.disposable_test',
      'auth schema access',
      'Modern identity failed',
      'Legacy identity failed',
      'Conflicting subject',
      'Legacy anonymous',
      'RPC record ownership forgery',
      'Ciphertext was changed',
      'Stale CAS',
      'rollback;',
    ])
      expect(sql.toLowerCase()).toContain(marker.toLowerCase());
  });
});
