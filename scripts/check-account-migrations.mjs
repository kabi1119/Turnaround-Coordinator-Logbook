/** v0.9.0 embedded PostgreSQL only. Accepts a module path, NEVER a DB URL/token. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { syntheticRecord } from './check-account-isolation.mjs';
if (!process.env.TCO_PGLITE_MODULE)
  throw new Error('Set TCO_PGLITE_MODULE to the optional temporary PostgreSQL test module.');
const { PGlite } = await import(pathToFileURL(resolve(process.env.TCO_PGLITE_MODULE)).href);
const db = new PGlite();
const A = '90000000-0000-4000-8000-000000000001',
  B = '90000000-0000-4000-8000-000000000002',
  C = '90000000-0000-4000-8000-000000000003';
const sql = (file) =>
  readFileSync(new URL('../' + file, import.meta.url), 'utf8').replace(/^\uFEFF/, '');
// Reuse the baseline's non-superuser hosted-role simulation; fail if that harness changes.
const bootstrap = sql('scripts/check-sync-migrations.mjs').match(
  /const bootstrap = \x60([\s\S]*?)\x60;/,
)?.[1];
if (!bootstrap) throw new Error('Baseline PostgreSQL fixture unavailable');
const privacy = {
  collection: 'privacy',
  id: 'settings',
  value: {
    registration: true,
    flights: true,
    bay: true,
    gateTimes: true,
    statuses: true,
    disruptionNotes: true,
  },
};
async function asUser(id, query, args = [], role = 'authenticated', anonymous = false) {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: id, role, is_anonymous: anonymous }),
    ]);
    await db.exec('set local role ' + role);
    const r = await db.query(query, args);
    await db.exec('commit');
    return r;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}
async function rpc(id, name, parameters) {
  const placeholders = parameters.map((_, i) => '$' + (i + 1)).join(',');
  return (
    await asUser(id, 'select public.' + name + '(' + placeholders + ') as result', parameters)
  ).rows[0].result;
}
const pull = (id) => rpc(id, 'tco_account_pull', [0]);
const initialize = (
  id,
  op = randomUUID(),
  rows = [privacy],
  legacy = null,
  consent = true,
  manifest = null,
) =>
  rpc(id, 'tco_account_initialize', [
    op,
    consent,
    JSON.stringify(rows),
    legacy,
    manifest && JSON.stringify(manifest),
  ]);
const push = (id, expected, op, rows, purpose = 'edit') =>
  rpc(id, 'tco_account_push', [expected, op, JSON.stringify(rows), purpose]);
let checks = 0;
async function check(label, fn) {
  await fn();
  checks++;
  console.log('PASS ' + label);
}
const draft = (id = 'aircraft') => ({
  collection: 'aircraft',
  id,
  value: {
    id,
    date: '',
    dutyId: '',
    airline: '',
    variant: '',
    family: '',
    icao: '',
    handling: '',
    role: '',
    registration: '',
    bay: '',
    disruption: 'Unknown',
    notes: 'fictional note',
    status: 'Draft',
    createdAt: '',
    updatedAt: '',
    actualHandling: false,
    arrival: {
      flight: '',
      status: 'Not Recorded',
      origin: 'Self-reported',
      scheduled: '',
      actual: '',
    },
    departure: {
      flight: '',
      status: 'Not Recorded',
      origin: 'Self-reported',
      scheduled: '',
      actual: '',
    },
    events: [],
    revisions: [],
  },
});
try {
  await db.exec(bootstrap);
  for (const id of [A, B, C])
    await db.query('insert into auth.users(id,email) values($1,$2)', [id, 'fixture@example.test']);
  for (const file of [
    '202610200001_profiles.sql',
    '202610270001_encrypted_sync.sql',
    '202610280001_sync_authorization.sql',
    '202610280002_cloud_accounts.sql',
  ])
    await db.exec(sql('supabase/migrations/' + file));
  const upgradeOwner = '90000000-0000-4000-8000-000000000004';
  await db.query('insert into auth.users(id,email) values($1,$2)', [
    upgradeOwner,
    'upgrade@example.test',
  ]);
  await initialize(upgradeOwner);
  await push(upgradeOwner, 1, randomUUID(), [draft('upgrade-existing')], 'guest-merge');
  const upgradeBefore = await pull(upgradeOwner);
  await db.exec(sql('supabase/migrations/202610290001_guest_merge_recovery.sql'));
  await db.exec(sql('supabase/migrations/202610290002_mixed_queue_recovery.sql'));
  await check(
    'additive Guest recovery upgrade preserves a populated prior v0.9.0 workspace',
    async () => {
      assert.deepEqual(await pull(upgradeOwner), upgradeBefore);
    },
  );
  await check('fresh sequential migrations as non-superuser postgres', async () => {
    const r = (
      await db.query(
        'select current_user,session_user,(select rolsuper from pg_roles where rolname=current_user) as super',
      )
    ).rows[0];
    assert.equal(r.current_user, 'postgres');
    assert.equal(r.session_user, 'postgres');
    assert.equal(r.super, false);
  });
  await check('four forced-RLS independent-owner tables and restricted RPC owners', async () => {
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='tco_cloud' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity and c.relowner<>'tco_sync_executor'::regrole",
        )
      ).rows[0].n,
      4,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from pg_proc where proname in ('tco_account_pull','tco_account_initialize','tco_account_push','tco_account_history','tco_account_verify_conversion','tco_account_prepare_archive','tco_account_archive','tco_account_merge_outcome','tco_account_edit_outcome') and proowner='tco_sync_executor'::regrole and prosecdef",
        )
      ).rows[0].n,
      9,
    );
  });
  await check('temporary schema CREATE and SET/INHERIT grants removed', async () => {
    const grants = (
      await db.query(
        "select count(*)::int as n from pg_proc where proname like 'tco_account_%' and (has_function_privilege('anon',oid,'EXECUTE') or has_function_privilege('service_role',oid,'EXECUTE') or not has_function_privilege('authenticated',oid,'EXECUTE'))",
      )
    ).rows[0];
    assert.equal(grants.n, 0);
    const r = (
      await db.query(
        "select has_schema_privilege('tco_sync_executor','public','CREATE') as create,exists(select 1 from pg_auth_members where roleid='tco_sync_executor'::regrole and member='postgres'::regrole and (set_option or inherit_option)) as membership",
      )
    ).rows[0];
    assert.equal(r.create, false);
    assert.equal(r.membership, false);
  });
  await check('anonymous gateway and anonymous Auth users rejected', async () => {
    await assert.rejects(
      asUser(A, 'select public.tco_account_pull(0)', [], 'anon'),
      /permission denied/,
    );
    await assert.rejects(
      asUser(A, 'select public.tco_account_pull(0)', [], 'authenticated', true),
      /account_auth/,
    );
  });
  await check('browser direct private table reads/writes denied', async () => {
    for (const relation of ['accounts', 'records', 'operations', 'history'])
      await assert.rejects(asUser(A, 'select * from tco_cloud.' + relation), /permission denied/);
    await assert.rejects(
      asUser(
        A,
        'insert into tco_cloud.records(user_id,collection,record_id,revision) values($1,$2,$3,1)',
        [B, 'aircraft', 'forged'],
      ),
      /permission denied/,
    );
  });
  await check('new workspace state is authoritative and consent mandatory', async () => {
    assert.equal((await pull(A)).established, false);
    await assert.rejects(initialize(A, randomUUID(), [privacy], null, false), /account_invalid/);
    assert.equal((await pull(A)).workspaceId, null);
    await initialize(A);
    const p = await pull(A);
    assert.equal(p.established, true);
    assert.equal(p.records.length, 1);
    assert.equal(p.revision, 1);
    assert.equal(p.records[0].collection, 'privacy');
  });
  await initialize(B);
  await check('two established empty accounts isolate settings and records', async () => {
    await push(A, 1, randomUUID(), [draft()]);
    assert.equal((await pull(A)).records.length, 2);
    assert.equal((await pull(B)).records.length, 1);
    await assert.rejects(push(B, 2, randomUUID(), [draft('forged')]), /account_conflict/);
    assert.equal((await pull(A)).records.length, 2);
  });
  await check('revision-guarded updates reject stale writes without side effects', async () => {
    const before = await pull(A);
    await assert.rejects(push(A, 1, randomUUID(), [draft('stale')]), /account_conflict/);
    assert.deepEqual(await pull(A), before);
  });
  await check(
    'lost-ack retry is idempotent and reused operation cannot change payload',
    async () => {
      const op = randomUUID(),
        before = await pull(A),
        change = draft('idempotent');
      const one = await push(A, before.revision, op, [change]),
        two = await push(A, before.revision, op, [change]);
      assert.deepEqual(two, one);
      await assert.rejects(push(A, before.revision, op, [draft('different')]), /account_conflict/);
      assert.equal((await pull(A)).revision, one.revision);
    },
  );
  await check('replacement preserves exact prior version under owner-only history', async () => {
    const before = await pull(A),
      change = draft();
    change.value.notes = 'new fictional version';
    await push(A, before.revision, randomUUID(), [change], 'guest-merge');
    const history = await rpc(A, 'tco_account_history', ['aircraft', 'aircraft']);
    assert.equal(history.userId, A);
    assert.equal(history.records[0].value.notes, 'fictional note');
    assert.deepEqual((await rpc(B, 'tco_account_history', ['aircraft', 'aircraft'])).records, []);
  });
  await check(
    'reviewed history restoration writes a new CAS revision and preserves the displaced version',
    async () => {
      const before = await pull(A);
      const history = await rpc(A, 'tco_account_history', ['aircraft', 'aircraft']);
      const selected = history.records[0];
      const restored = { collection: 'aircraft', id: 'aircraft', value: selected.value };
      await assert.rejects(
        push(A, before.revision - 1, randomUUID(), [restored], 'history-restore'),
        /account_conflict/,
      );
      const receipt = await push(A, before.revision, randomUUID(), [restored], 'history-restore');
      assert.equal(receipt.revision, before.revision + 1);
      assert.equal(
        (await pull(A)).records.find((r) => r.id === 'aircraft').value.notes,
        'fictional note',
      );
      const after = await rpc(A, 'tco_account_history', ['aircraft', 'aircraft']);
      assert.equal(after.records[0].value.notes, 'new fictional version');
      assert.deepEqual((await rpc(B, 'tco_account_history', ['aircraft', 'aircraft'])).records, []);
    },
  );
  await check('tombstone propagation does not permit stale offline resurrection', async () => {
    const before = await pull(A);
    await push(A, before.revision, randomUUID(), [
      { collection: 'aircraft', id: 'idempotent', value: null },
    ]);
    assert.equal((await pull(A)).records.find((r) => r.id === 'idempotent').value, null);
    await assert.rejects(
      push(A, before.revision, randomUUID(), [draft('idempotent')]),
      /account_conflict/,
    );
  });
  await check('invalid linkage rolls back records, receipt and revision atomically', async () => {
    const before = await pull(A),
      bad = draft('bad-link');
    bad.value.dutyId = 'not-present';
    await assert.rejects(push(A, before.revision, randomUUID(), [bad]), /account_invalid/);
    assert.deepEqual(await pull(A), before);
  });
  await check('rejects malformed fields, duplicate row keys and unsafe payloads', async () => {
    const r = (await pull(A)).revision,
      bad = draft('malformed');
    bad.value.status = 'Pending';
    for (const rows of [
      [bad],
      [privacy, privacy],
      [{ collection: 'privacy', id: 'settings', value: null }],
      [{ collection: 'aircraft', id: 'x', value: JSON.parse('{"__proto__":{"polluted":true}}') }],
    ])
      await assert.rejects(push(A, r, randomUUID(), rows), /account_invalid/);
    const big = draft('oversize');
    big.value.notes = 'x'.repeat(270000);
    await assert.rejects(push(A, r, randomUUID(), [big]), /account_invalid/);
  });
  await check('hosted REST runner fixture passes the actual SQL validator', async () => {
    const row = syntheticRecord('runner-synthetic');
    const before = await pull(B);
    await push(B, before.revision, randomUUID(), [row]);
    assert.deepEqual((await pull(B)).records.find((r) => r.id === row.id).value, row.value);
  });
  const key = {
    version: 1,
    userId: C,
    keyId: randomUUID(),
    iterations: 600000,
    salt: randomBytes(16).toString('base64'),
    iv: randomBytes(12).toString('base64'),
    ciphertext: randomBytes(48).toString('base64'),
  };
  await rpc(C, 'tco_sync_initialize', [JSON.stringify(key)]);
  const cipher = {
    version: 1,
    userId: C,
    keyId: key.keyId,
    recordId: randomBytes(32).toString('hex'),
    revision: 1,
    iv: randomBytes(12).toString('base64'),
    ciphertext: randomBytes(32).toString('base64'),
  };
  await rpc(C, 'tco_sync_push', [0, randomUUID(), JSON.stringify([cipher])]);
  const old = await rpc(C, 'tco_sync_pull', [0]);
  await check(
    'legacy settings-only account is established and cannot be treated as new',
    async () => {
      const p = await pull(C);
      assert.equal(p.established, true);
      assert.equal(p.workspaceId, null);
      assert.equal(p.legacyRevision, 1);
      await assert.rejects(initialize(C), /account_legacy_review/);
      assert.deepEqual(await rpc(C, 'tco_sync_pull', [0]), old);
    },
  );
  await check(
    'legacy conversion requires exact old revision and preserves all ciphertext/keys',
    async () => {
      await assert.rejects(initialize(C, randomUUID(), [privacy], 0), /account_legacy_review/);
      const op = randomUUID(),
        manifest = {
          version: 1,
          operationId: op,
          revision: 1,
          keyId: key.keyId,
          recordCount: 1,
          backupDigest: 'a'.repeat(64),
          localVaultDigest: null,
          entries: [
            { opaqueId: cipher.recordId, collection: 'privacy', id: 'settings', revision: 1 },
          ],
        },
        result = await initialize(C, op, [privacy], 1, true, manifest);
      assert.equal(result.revision, 1);
      assert.deepEqual(await initialize(C, op, [privacy], 1, true, manifest), result);
      assert.deepEqual(await rpc(C, 'tco_sync_pull', [0]), old);
      const pending = await pull(C);
      assert.equal(pending.conversionState, 'verifying');
      await assert.rejects(push(C, 1, randomUUID(), [privacy]), /account_conversion_pending/);
      await assert.rejects(
        rpc(C, 'tco_account_verify_conversion', [op, 1, '0'.repeat(64)]),
        /account_legacy_review/,
      );
      await rpc(C, 'tco_account_verify_conversion', [op, 1, pending.snapshotDigest]);
      assert.equal((await pull(C)).conversionState, 'active');
    },
  );
  await check('migrated account rejects old-client writes but retains recovery pulls', async () => {
    await assert.rejects(
      rpc(C, 'tco_sync_push', [1, randomUUID(), JSON.stringify([{ ...cipher, revision: 2 }])]),
      /account_legacy_readonly/,
    );
    assert.deepEqual(await rpc(C, 'tco_sync_pull', [0]), old);
    assert.equal((await pull(C)).records.length, 1);
  });
  await check('legacy keys cannot be reinitialized after new-mode onboarding', async () => {
    await assert.rejects(
      rpc(C, 'tco_sync_initialize', [JSON.stringify({ ...key, keyId: randomUUID() })]),
      /account_legacy_readonly/,
    );
    assert.deepEqual(await rpc(C, 'tco_sync_pull', [0]), old);
  });
  await check(
    'manual archive requires exact export, confirmation and unchanged revision',
    async () => {
      const before = await pull(A),
        file = await rpc(A, 'tco_account_prepare_archive', []);
      assert.equal(file.userId, A);
      assert.equal(file.revision, before.revision);
      const body = JSON.parse(file.text);
      assert.equal(body.records.length, before.total);
      assert.ok(body.history.length > 0);
      assert.ok(body.receipts.length > 1);
      await assert.rejects(
        rpc(A, 'tco_account_archive', [file.revision, file.digest, false]),
        /account_invalid/,
      );
      await assert.rejects(
        rpc(A, 'tco_account_archive', [file.revision, '0'.repeat(64), true]),
        /account_conflict/,
      );
      await assert.rejects(
        rpc(B, 'tco_account_archive', [file.revision, file.digest, true]),
        /account_conflict/,
      );
      await push(A, before.revision, randomUUID(), [privacy]);
      await assert.rejects(
        rpc(A, 'tco_account_archive', [file.revision, file.digest, true]),
        /account_conflict/,
      );
    },
  );
  await check(
    'archive preserves records, tombstones and initialization receipt, fences old offline operations',
    async () => {
      const before = await pull(A),
        file = await rpc(A, 'tco_account_prepare_archive', []),
        payload = JSON.parse(file.text);
      const receipt = await rpc(A, 'tco_account_archive', [before.revision, file.digest, true]);
      assert.equal(receipt.replayFloor, before.revision);
      assert.deepEqual(
        await rpc(A, 'tco_account_archive', [before.revision, file.digest, true]),
        receipt,
      );
      const after = await pull(A);
      assert.deepEqual(after.records, before.records);
      assert.equal(after.capacity.historyRows, 0);
      assert.equal(after.capacity.receipts, 1);
      assert.equal(JSON.parse(file.text).history.length, payload.history.length);
      await assert.rejects(
        push(A, before.revision - 1, randomUUID(), [privacy]),
        /account_archived_review/,
      );
      await assert.rejects(rpc(A, 'tco_account_pull', [1]), /account_archived_review/);
      assert.equal(
        (await push(A, before.revision, randomUUID(), [privacy])).revision,
        before.revision + 1,
      );
      assert.deepEqual(await rpc(C, 'tco_sync_pull', [0]), old);
    },
  );
  await check(
    'capacity failure is atomic and a reviewed archive restores write capacity',
    async () => {
      const before = await pull(B);
      await db.exec('set session authorization test_bootstrap');
      await db.query(
        `insert into tco_cloud.operations(user_id,operation_id,request_hash,revision,purpose)
      select $1,gen_random_uuid(),sha256(convert_to(i::text,'UTF8')),1,'edit' from generate_series(1,20000-(select count(*)::int from tco_cloud.operations where user_id=$1)) i`,
        [B],
      );
      await db.exec('set session authorization postgres');
      const atLimit = await pull(B);
      assert.equal(atLimit.capacity.receipts, 20000);
      await assert.rejects(push(B, before.revision, randomUUID(), [privacy]), /account_capacity/);
      assert.deepEqual((await pull(B)).records, before.records);
      assert.equal((await pull(B)).revision, before.revision);
      const file = await rpc(B, 'tco_account_prepare_archive', []);
      assert.equal(JSON.parse(file.text).receipts.length, 20000);
      await rpc(B, 'tco_account_archive', [before.revision, file.digest, true]);
      assert.equal(
        (await push(B, before.revision, randomUUID(), [privacy])).revision,
        before.revision + 1,
      );
    },
  );
  await check(
    'Guest receipt inspection is owner-scoped, read-only and rejects anonymous callers',
    async () => {
      const before = await pull(A),
        operation = randomUUID(),
        rows = [draft('guest-receipt')];
      const inspect = (owner, retire = false, body = rows) =>
        rpc(owner, 'tco_account_merge_outcome', [
          before.revision,
          operation,
          JSON.stringify(body),
          retire,
        ]);
      assert.equal((await inspect(A)).outcome, 'missing');
      assert.deepEqual(await pull(A), before);
      await assert.rejects(
        asUser(
          A,
          'select public.tco_account_merge_outcome($1,$2,$3,false)',
          [before.revision, operation, JSON.stringify(rows)],
          'anon',
        ),
        /permission denied/,
      );
      await assert.rejects(
        asUser(
          A,
          'select public.tco_account_merge_outcome($1,$2,$3,false)',
          [before.revision, operation, JSON.stringify(rows)],
          'authenticated',
          true,
        ),
        /account_auth/,
      );
      const committed = await push(A, before.revision, operation, rows, 'guest-merge');
      const outcome = await inspect(A);
      assert.equal(outcome.outcome, 'committed');
      assert.equal(outcome.operationRevision, committed.revision);
      // B cannot query A's receipt, even if the operation UUID and exact body are known.
      const other = await pull(B);
      const hidden = await rpc(B, 'tco_account_merge_outcome', [
        other.revision,
        operation,
        JSON.stringify(rows),
        false,
      ]);
      assert.equal(hidden.outcome, 'missing');
      assert.equal((await inspect(A)).operationRevision, committed.revision);
    },
  );
  await check(
    'Guest retirement atomically fences delayed writes without deleting Cloud records',
    async () => {
      const before = await pull(A),
        operation = randomUUID(),
        rows = [draft('never-commit')];
      const args = [before.revision, operation, JSON.stringify(rows), true];
      const result = await rpc(A, 'tco_account_merge_outcome', args);
      assert.equal(result.outcome, 'retired');
      assert.deepEqual(await rpc(A, 'tco_account_merge_outcome', args), result);
      await assert.rejects(
        push(A, before.revision, operation, rows, 'guest-merge'),
        /account_operation_retired/,
      );
      await assert.rejects(
        rpc(A, 'tco_account_merge_outcome', [
          before.revision,
          operation,
          JSON.stringify([draft('changed-payload')]),
          false,
        ]),
        /account_conflict/,
      );
      assert.deepEqual((await pull(A)).records, before.records);
      assert.equal((await pull(A)).revision, before.revision);
    },
  );
  await check(
    'committed Guest operations cannot be retired or duplicated by recovery',
    async () => {
      const before = await pull(A),
        operation = randomUUID(),
        rows = [draft('already-committed')];
      const first = await push(A, before.revision, operation, rows, 'guest-merge');
      assert.equal(
        (
          await rpc(A, 'tco_account_merge_outcome', [
            before.revision,
            operation,
            JSON.stringify(rows),
            true,
          ])
        ).outcome,
        'committed',
      );
      assert.deepEqual(await push(A, before.revision, operation, rows, 'guest-merge'), first);
      assert.equal((await pull(A)).revision, first.revision);
    },
  );
  await check(
    'manual archive retains same-floor retirement fences and reports older missing receipts as expired',
    async () => {
      const before = await pull(A),
        operation = randomUUID(),
        rows = [draft('archive-fence')];
      await rpc(A, 'tco_account_merge_outcome', [
        before.revision,
        operation,
        JSON.stringify(rows),
        true,
      ]);
      const archive = await rpc(A, 'tco_account_prepare_archive', []);
      assert.ok(
        JSON.parse(archive.text).receipts.some(
          (r) => r.operationId === operation && r.outcome === 'retired',
        ),
      );
      await rpc(A, 'tco_account_archive', [before.revision, archive.digest, true]);
      assert.equal(
        (
          await rpc(A, 'tco_account_merge_outcome', [
            before.revision,
            operation,
            JSON.stringify(rows),
            false,
          ])
        ).outcome,
        'retired',
      );
      await assert.rejects(
        push(A, before.revision, operation, rows, 'guest-merge'),
        /account_operation_retired/,
      );
      await push(A, before.revision, randomUUID(), [privacy]);
      const later = await rpc(A, 'tco_account_prepare_archive', []);
      await rpc(A, 'tco_account_archive', [later.revision, later.digest, true]);
      const expired = await rpc(A, 'tco_account_merge_outcome', [
        before.revision,
        operation,
        JSON.stringify(rows),
        true,
      ]);
      assert.equal(expired.outcome, 'expired');
      assert.equal(expired.operationRevision, null);
      await assert.rejects(
        push(A, before.revision, operation, rows, 'guest-merge'),
        /account_archived_review/,
      );
    },
  );
  await check(
    'later Account receipt RPC is owner-scoped, purpose-bound and rejects anonymous callers',
    async () => {
      const before = await pull(A),
        operation = randomUUID(),
        rows = [draft('recorded-account-edit')];
      const args = [before.revision, operation, JSON.stringify(rows), false];
      assert.equal((await rpc(A, 'tco_account_edit_outcome', args)).outcome, 'missing');
      assert.deepEqual(await pull(A), before);
      await assert.rejects(
        asUser(
          A,
          'select public.tco_account_edit_outcome($1,$2,$3,false)',
          args.slice(0, 3),
          'anon',
        ),
        /permission denied/,
      );
      await assert.rejects(
        asUser(
          A,
          'select public.tco_account_edit_outcome($1,$2,$3,false)',
          args.slice(0, 3),
          'authenticated',
          true,
        ),
        /account_auth/,
      );
      const receipt = await push(A, before.revision, operation, rows, 'edit');
      assert.equal(
        (await rpc(A, 'tco_account_edit_outcome', [...args.slice(0, 3), true])).operationRevision,
        receipt.revision,
      );
      await assert.rejects(rpc(A, 'tco_account_merge_outcome', args), /account_conflict/);
      await assert.rejects(
        rpc(A, 'tco_account_edit_outcome', [
          before.revision,
          operation,
          JSON.stringify([privacy]),
          false,
        ]),
        /account_conflict/,
      );
      const other = await pull(B);
      assert.equal(
        (
          await rpc(B, 'tco_account_edit_outcome', [
            other.revision,
            operation,
            JSON.stringify(rows),
            false,
          ])
        ).outcome,
        'missing',
      );
    },
  );
  await check(
    'uncommitted later Account UUID is fenced without changing current records or Guest receipts',
    async () => {
      const before = await pull(A),
        operation = randomUUID(),
        rows = [draft('retired-account-edit')];
      const args = [before.revision, operation, JSON.stringify(rows), true];
      const one = await rpc(A, 'tco_account_edit_outcome', args);
      assert.equal(one.outcome, 'retired');
      assert.deepEqual(await rpc(A, 'tco_account_edit_outcome', args), one);
      await assert.rejects(
        push(A, before.revision, operation, rows, 'edit'),
        /account_operation_retired/,
      );
      assert.deepEqual((await pull(A)).records, before.records);
      const file = await rpc(A, 'tco_account_prepare_archive', []);
      await rpc(A, 'tco_account_archive', [before.revision, file.digest, true]);
      assert.equal((await rpc(A, 'tco_account_edit_outcome', args)).outcome, 'retired');
      await push(A, before.revision, randomUUID(), [privacy]);
      const newer = await rpc(A, 'tco_account_prepare_archive', []);
      await rpc(A, 'tco_account_archive', [newer.revision, newer.digest, true]);
      assert.equal((await rpc(A, 'tco_account_edit_outcome', args)).outcome, 'expired');
      await assert.rejects(
        push(A, before.revision, operation, rows, 'edit'),
        /account_archived_review/,
      );
    },
  );
  await check(
    'repeated recovery migration preserves records, history, receipts and legacy ciphertext',
    async () => {
      const before = await Promise.all([pull(A), pull(B), pull(C)]);
      const archive = await rpc(A, 'tco_account_prepare_archive', []);
      const ciphertext = await rpc(C, 'tco_sync_pull', [0]);
      await db.exec(sql('supabase/migrations/202610290001_guest_merge_recovery.sql'));
      await db.exec(sql('supabase/migrations/202610290002_mixed_queue_recovery.sql'));
      assert.deepEqual(await Promise.all([pull(A), pull(B), pull(C)]), before);
      assert.deepEqual(await rpc(A, 'tco_account_prepare_archive', []), archive);
      assert.deepEqual(await rpc(C, 'tco_sync_pull', [0]), ciphertext);
      const cleanup = (
        await db.query(
          "select has_schema_privilege('tco_sync_executor','public','CREATE') as create,exists(select 1 from pg_auth_members where roleid='tco_sync_executor'::regrole and member='postgres'::regrole and (set_option or inherit_option)) as membership",
        )
      ).rows[0];
      assert.equal(cleanup.create, false);
      assert.equal(cleanup.membership, false);
    },
  );
  console.log(
    'Passed ' +
      checks +
      ' embedded PostgreSQL account-storage scenarios. NOT hosted JWT/RLS or physical-device acceptance.',
  );
} finally {
  await db.close();
}
