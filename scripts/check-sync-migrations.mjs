/** Local-only migration regression. PGlite always runs in memory; no database URL/token is accepted. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
if (!process.env.TCO_PGLITE_MODULE)
  throw new Error(
    'Set TCO_PGLITE_MODULE to a temporary PGlite module path. No application dependency is required.',
  );
const { PGlite } = await import(pathToFileURL(resolve(process.env.TCO_PGLITE_MODULE)).href);
const root = new URL('../', import.meta.url);
const sql = (path) => readFileSync(new URL(path, root), 'utf8').replace(/^\uFEFF/, '');
const profiles = sql('supabase/migrations/202610200001_profiles.sql');
const initial = sql('supabase/migrations/202610270001_encrypted_sync.sql');
const authorization = sql('supabase/migrations/202610280001_sync_authorization.sql');
const membership =
  /^grant tco_sync_executor to postgres with admin false, inherit false, set true granted by postgres;\n/gm;
const bootstrap = `
create role test_bootstrap login superuser;
set session authorization test_bootstrap;
alter role postgres rename to supabase_admin;
create role postgres login nosuperuser createdb createrole inherit nobypassrls;
alter database postgres owner to postgres;
create role anon nologin; create role authenticated nologin;
create role service_role nologin bypassrls; create role authenticator nologin;
grant anon,authenticated,service_role,authenticator to postgres with inherit false, set true;
create schema auth authorization supabase_admin;
revoke all on schema auth from public;
grant usage on schema auth to postgres,authenticated;
create table auth.users(id uuid primary key,email text);
grant select,insert,references on auth.users to postgres;
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
set session authorization postgres;
`;
async function admin(db, fn) {
  await db.exec('set session authorization supabase_admin;');
  try {
    return await fn();
  } finally {
    await db.exec('rollback; set session authorization postgres;');
  }
}
async function identity(db) {
  const row = (
    await db.query(
      'select current_user, session_user, (select rolsuper from pg_roles where rolname=current_user) as superuser',
    )
  ).rows[0];
  assert.deepEqual(
    row,
    { current_user: 'postgres', session_user: 'postgres', superuser: false },
    'A genuine non-superuser migration session is required',
  );
}
async function cleanup(db) {
  await identity(db);
  const row = (
    await db.query(`select
    pg_has_role('postgres','tco_sync_executor','SET') as can_set,
    pg_has_role('postgres','tco_sync_executor','USAGE') as can_inherit,
    has_schema_privilege('tco_sync_executor','public','CREATE') as can_create,
    (select count(*)::integer from pg_auth_members where roleid='tco_sync_executor'::regrole and member='postgres'::regrole and grantor='postgres'::regrole) as temporary_grants,
    (select count(*)::integer from pg_auth_members where roleid='tco_sync_executor'::regrole and member='postgres'::regrole and grantor='supabase_admin'::regrole and admin_option and not set_option and not inherit_option) as bootstrap_admin`)
  ).rows[0];
  assert.deepEqual(
    row,
    {
      can_set: false,
      can_inherit: false,
      can_create: false,
      temporary_grants: 0,
      bootstrap_admin: 1,
    },
    'Temporary privileges must be absent; bootstrap ADMIN-only membership must remain',
  );
}
async function snapshot(db) {
  return admin(
    db,
    async () =>
      (
        await db.query(`select jsonb_build_object(
    'accounts',(select coalesce(jsonb_agg(to_jsonb(a) order by user_id),'[]') from tco_sync.accounts a),
    'records',(select coalesce(jsonb_agg(to_jsonb(r) order by user_id,record_id),'[]') from tco_sync.records r))::text as value`)
      ).rows[0].value,
  );
}
async function seed(db) {
  await admin(db, () =>
    db.exec(`insert into auth.users(id,email) values('82000000-0000-4000-8000-000000000001','retained@example.test');
    insert into tco_sync.accounts(user_id,key_envelope,revision) values('82000000-0000-4000-8000-000000000001',jsonb_build_object('version',1,'userId','82000000-0000-4000-8000-000000000001','keyId','82000000-0000-4000-8000-000000000011','iterations',600000,'salt',repeat('A',22)||'==','iv',repeat('A',16),'ciphertext',repeat('B',64)),1);
    insert into tco_sync.records(user_id,record_id,revision,envelope) values('82000000-0000-4000-8000-000000000001',repeat('b',64),1,jsonb_build_object('version',1,'userId','82000000-0000-4000-8000-000000000001','keyId','82000000-0000-4000-8000-000000000011','recordId',repeat('b',64),'revision',1,'iv',repeat('A',16),'ciphertext',repeat('B',32)));`),
  );
}
async function fails(db, text, expected) {
  let error;
  try {
    await db.exec(text);
  } catch (e) {
    error = e;
    await db.exec('rollback;');
  }
  assert(error, 'Expected regression/preflight failure');
  assert.match(error.message, expected);
  return error;
}
for (const scenario of [
  'fresh-after-failed-v080',
  'existing-v080-data',
  'existing-v081-data',
  'interrupted-replacement',
]) {
  const db = new PGlite();
  try {
    await db.exec(bootstrap);
    await identity(db);
    await db.exec(profiles);
    if (scenario === 'fresh-after-failed-v080') {
      const error = await fails(db, initial.replace(membership, ''), /must be able to SET ROLE/);
      assert.equal(error.code, '42501');
      assert.equal(
        (await db.query("select to_regclass('tco_sync.accounts') as value")).rows[0].value,
        null,
        'Failed v0.8.0 must roll back entirely',
      );
    }
    await db.exec(initial);
    await cleanup(db);
    if (scenario !== 'fresh-after-failed-v080') await seed(db);
    const before = await snapshot(db);
    if (scenario === 'existing-v080-data') {
      const oldReplacement = authorization
        .replace(membership, '')
        .replace(/^set local role tco_sync_executor;\n/gm, '');
      const error = await fails(db, oldReplacement, /must be owner of function/);
      assert.equal(error.code, '42501');
      assert.equal(await snapshot(db), before);
    }
    await db.exec(authorization);
    await cleanup(db);
    assert.equal(
      await snapshot(db),
      before,
      'Migration must preserve all key/ciphertext/revision/timestamp bytes',
    );
    if (scenario === 'existing-v081-data') {
      await db.exec(authorization);
      await cleanup(db);
      assert.equal(await snapshot(db), before);
      await db.exec(
        'grant tco_sync_executor to postgres with admin false, inherit false, set true granted by postgres;',
      );
      await fails(db, authorization, /Existing postgres-issued executor membership/);
      await db.exec('revoke tco_sync_executor from postgres granted by postgres;');
      await cleanup(db);
    }
    if (scenario === 'interrupted-replacement') {
      const interrupted = authorization.replace(
        'set local role tco_sync_executor;',
        () =>
          "set local role tco_sync_executor; do $$ begin raise exception 'synthetic interruption'; end $$;",
      );
      await fails(db, interrupted, /synthetic interruption/);
      await cleanup(db);
      assert.equal(await snapshot(db), before);
    }
    await db.exec(sql('supabase/tests/sync_role_ownership_v082.sql'));
    await admin(db, async () => {
      await db.exec("set tco.disposable_test='yes';");
      await db.exec(sql('supabase/tests/encrypted_sync_rls.sql'));
      await db.exec(sql('supabase/tests/sync_authorization_v081.sql'));
    });
    assert.equal(await snapshot(db), before);
    await cleanup(db);
    console.log(
      'PASS: ' +
        scenario +
        ' — restricted migration, cleanup, RLS/RPC and ciphertext preservation.',
    );
  } catch (e) {
    console.error('FAIL: ' + scenario + ' ? ' + e.code + ' ' + e.message);
    process.exitCode = 1;
    break;
  } finally {
    await db.close();
  }
}
if (!process.exitCode)
  console.log('PASS: 4 isolated PostgreSQL migration scenarios. No hosted database contacted.');
