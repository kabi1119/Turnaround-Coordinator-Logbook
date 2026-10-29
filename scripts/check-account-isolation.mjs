/** Owner-run only: NEW disposable Supabase Test Project, two EMPTY invited users.
 * No .env loading, no default URL/credentials, no real records, no cleanup/reset API.
 * Opt-in is an operator assertion; software cannot prove a project is disposable.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
export function testConfiguration(env) {
  const ref = env.TCO_ACCOUNT_TEST_PROJECT_REF;
  if (
    !ref ||
    !/^[a-z0-9]{20}$/.test(ref) ||
    env.TCO_ACCOUNT_DISPOSABLE !== 'yes' ||
    env.TCO_ACCOUNT_TEST_CONFIRM !== 'DISPOSABLE:' + ref
  )
    throw new Error('Explicit disposable project opt-in required. No requests sent.');
  const origin = new URL(env.TCO_ACCOUNT_TEST_URL || '');
  if (
    origin.href !== 'https://' + ref + '.supabase.co/' ||
    !/^[a-z0-9]{20}$/.test(env.TCO_ACCOUNT_PRODUCTION_PROJECT_REF || '') ||
    env.TCO_ACCOUNT_PRODUCTION_PROJECT_REF === ref
  )
    throw new Error(
      'Exact independently confirmed Test Project origin required. No requests sent.',
    );
  for (const field of [
    'TCO_ACCOUNT_TEST_KEY',
    'TCO_ACCOUNT_TEST_A_TOKEN',
    'TCO_ACCOUNT_TEST_B_TOKEN',
    'TCO_ACCOUNT_TEST_A_ID',
    'TCO_ACCOUNT_TEST_B_ID',
  ])
    if (!env[field])
      throw new Error(
        'Test publishable key, two invited user JWTs and their expected IDs required. No requests sent.',
      );
  if (
    env.TCO_ACCOUNT_TEST_A_ID === env.TCO_ACCOUNT_TEST_B_ID ||
    ![env.TCO_ACCOUNT_TEST_A_ID, env.TCO_ACCOUNT_TEST_B_ID].every((id) =>
      /^[0-9a-f-]{36}$/.test(id),
    )
  )
    throw new Error('Two distinct test identities required.');
  // Unverified claim inspection is only a local rejection gate. The Auth endpoint
  // below must still validate each token with the selected project's server.
  for (const [token, id] of [
    [env.TCO_ACCOUNT_TEST_A_TOKEN, env.TCO_ACCOUNT_TEST_A_ID],
    [env.TCO_ACCOUNT_TEST_B_TOKEN, env.TCO_ACCOUNT_TEST_B_ID],
  ]) {
    try {
      if (token.split('.').length !== 3) throw new Error();
      const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      if (
        claims.role !== 'authenticated' ||
        claims.sub !== id ||
        claims.is_anonymous === true ||
        !Number.isFinite(claims.exp) ||
        claims.exp * 1000 <= Date.now()
      )
        throw new Error();
    } catch {
      throw new Error(
        'Fresh authenticated test-user JWTs required; privileged credentials forbidden. No requests sent.',
      );
    }
  }
  const key = env.TCO_ACCOUNT_TEST_KEY;
  if (key.startsWith('sb_secret_')) throw new Error('Privileged keys forbidden.');
  if (!key.startsWith('sb_publishable_')) {
    try {
      if (JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'anon')
        throw new Error();
    } catch {
      throw new Error('Publishable or legacy anon key required; never service_role.');
    }
  }
  return {
    origin: origin.origin,
    key,
    a: env.TCO_ACCOUNT_TEST_A_TOKEN,
    b: env.TCO_ACCOUNT_TEST_B_TOKEN,
    idA: env.TCO_ACCOUNT_TEST_A_ID,
    idB: env.TCO_ACCOUNT_TEST_B_ID,
  };
}
export async function verifyDisposableAccounts(config, request) {
  for (const [token, id] of [
    [config.a, config.idA],
    [config.b, config.idB],
  ]) {
    const identity = await request(token, '/auth/v1/user');
    assert(
      identity.ok &&
        identity.data?.id === id &&
        identity.data.email_confirmed_at &&
        identity.data.is_anonymous !== true,
      'Invited, confirmed, distinct test users required',
    );
    const state = await request(token, '/rest/v1/rpc/tco_account_pull', { p_cursor: 0 });
    assert(
      state.ok &&
        state.data?.version === 2 &&
        state.data.userId === id &&
        state.data.workspaceId === null &&
        state.data.established === false &&
        state.data.revision === 0 &&
        state.data.count === 0 &&
        Array.isArray(state.data.records) &&
        state.data.records.length === 0 &&
        state.data.total === 0 &&
        state.data.legacyRevision === null,
      'Refusing established/unconfigured account; use TWO NEW test users. No writes attempted.',
    );
    const legacy = await request(token, '/rest/v1/rpc/tco_sync_pull', { p_cursor: 0 });
    assert(
      legacy.ok &&
        legacy.data?.version === 1 &&
        legacy.data.userId === id &&
        legacy.data.revision === 0 &&
        legacy.data.envelope === null &&
        legacy.data.total === 0 &&
        legacy.data.count === 0 &&
        Array.isArray(legacy.data.records) &&
        legacy.data.records.length === 0,
      'Refusing legacy records or keys. No writes attempted.',
    );
  }
}
export function syntheticRecord(id) {
  return {
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
      notes: 'Fictional disposable authorization fixture',
      status: 'Draft',
      createdAt: '2026-10-28T00:00:00Z',
      updatedAt: '2026-10-28T00:00:00Z',
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
  };
}
async function main() {
  const config = testConfiguration(process.env);
  async function request(token, path, body, extra = {}) {
    const response = await fetch(config.origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'error',
      cache: 'no-store',
      headers: {
        apikey: config.key,
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        'Content-Type': 'application/json',
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      /* Only generic assertion failures are reported. */
    }
    return { ok: response.ok, status: response.status, data };
  }
  await verifyDisposableAccounts(config, request);
  const rpc = (token, name, body) => request(token, '/rest/v1/rpc/tco_account_' + name, body),
    a = config.a,
    b = config.b;
  let checks = 0;
  async function check(label, fn) {
    await fn();
    checks++;
    process.stdout.write('PASS ' + label + '\n');
  }
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
  await check('anonymous gateway and tampered signed JWT rejected', async () => {
    assert(!(await rpc(null, 'pull', { p_cursor: 0 })).ok);
    const parts = a.split('.');
    assert.equal(parts.length, 3);
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    claims.sub = config.idB;
    const forged =
      parts[0] + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.' + parts[2];
    assert(!(await rpc(forged, 'pull', { p_cursor: 0 })).ok);
  });
  const initA = randomUUID(),
    initB = randomUUID();
  await check('explicit consent, own initialization and initialization retry', async () => {
    const args = {
      p_operation: initA,
      p_consent: false,
      p_records: [privacy],
      p_legacy_revision: null,
      p_manifest: null,
    };
    assert(!(await rpc(a, 'initialize', args)).ok);
    args.p_consent = true;
    const first = await rpc(a, 'initialize', args);
    assert(first.ok && first.data.userId === config.idA && first.data.revision === 1);
    assert.deepEqual((await rpc(a, 'initialize', args)).data, first.data);
    assert((await rpc(b, 'initialize', { ...args, p_operation: initB })).ok);
  });
  const row = syntheticRecord('synthetic-' + randomUUID());
  const push = { p_expected: 1, p_operation: randomUUID(), p_records: [row], p_purpose: 'edit' };
  await check('CAS upload, exact retry and changed-body operation reuse', async () => {
    const first = await rpc(a, 'push', push);
    assert(first.ok && first.data.userId === config.idA && first.data.revision === 2);
    assert.deepEqual((await rpc(a, 'push', push)).data, first.data);
    assert(!(await rpc(a, 'push', { ...push, p_records: [privacy] })).ok);
    assert(!(await rpc(a, 'push', { ...push, p_operation: randomUUID() })).ok);
  });
  await check('A/B records, history and owner-argument forgery isolated', async () => {
    const own = await rpc(a, 'pull', { p_cursor: 0 }),
      other = await rpc(b, 'pull', { p_cursor: 0 });
    assert(own.ok && own.data.userId === config.idA && own.data.total === 2);
    assert(
      other.ok &&
        other.data.userId === config.idB &&
        other.data.total === 1 &&
        !other.data.records.some((r) => r.id === row.id),
    );
    assert(!(await rpc(b, 'push', { ...push, p_user_id: config.idA })).ok);
    assert(!(await rpc(b, 'pull', { p_cursor: 0, p_user_id: config.idA })).ok);
    const direct = await request(a, '/rest/v1/records?select=*', undefined, {
      'Accept-Profile': 'tco_cloud',
    });
    assert(!direct.ok);
  });
  await check(
    'reviewed replacement preserves prior content; B cannot retrieve A history',
    async () => {
      const changed = structuredClone(row);
      changed.value.notes = 'Second fictional test version';
      assert(
        (
          await rpc(a, 'push', {
            ...push,
            p_expected: 2,
            p_operation: randomUUID(),
            p_records: [changed],
          })
        ).ok,
      );
      const history = await rpc(a, 'history', { p_collection: 'aircraft', p_id: row.id }),
        other = await rpc(b, 'history', { p_collection: 'aircraft', p_id: row.id });
      assert(
        history.ok &&
          history.data.records.length === 1 &&
          history.data.records[0].value.notes === row.value.notes,
      );
      assert(other.ok && other.data.records.length === 0);
    },
  );
  await check(
    'invalid graph is atomic and tombstone cannot be resurrected by stale revision',
    async () => {
      const broken = structuredClone(row);
      broken.value.dutyId = 'missing-duty';
      assert(
        !(
          await rpc(a, 'push', {
            ...push,
            p_expected: 3,
            p_operation: randomUUID(),
            p_records: [broken],
          })
        ).ok,
      );
      assert.equal((await rpc(a, 'pull', { p_cursor: 0 })).data.revision, 3);
      assert(
        (
          await rpc(a, 'push', {
            ...push,
            p_expected: 3,
            p_operation: randomUUID(),
            p_records: [{ ...row, value: null }],
          })
        ).ok,
      );
      assert(!(await rpc(a, 'push', { ...push, p_expected: 3, p_operation: randomUUID() })).ok);
      const deleted = await rpc(a, 'pull', { p_cursor: 0 });
      assert.equal(deleted.data.records.find((r) => r.id === row.id).value, null);
    },
  );
  await check(
    'archive is account-scoped, exact hash is verifiable, false confirmation never deletes history',
    async () => {
      const exported = await rpc(a, 'prepare_archive', {});
      assert(exported.ok && exported.data.userId === config.idA);
      assert.equal(
        createHash('sha256').update(exported.data.text).digest('hex'),
        exported.data.digest,
      );
      const data = JSON.parse(exported.data.text);
      assert.equal(data.records.length, 2);
      assert.equal(data.history.length, 2);
      assert(
        !(
          await rpc(a, 'archive', {
            p_expected: 4,
            p_digest: exported.data.digest,
            p_confirmation: false,
          })
        ).ok,
      );
      const other = await rpc(b, 'prepare_archive', {});
      assert.equal(JSON.parse(other.data.text).history.length, 0);
      assert.equal(
        (await rpc(a, 'history', { p_collection: 'aircraft', p_id: row.id })).data.records.length,
        2,
      );
    },
  );
  await check(
    'Guest operation receipts isolate owners and recover exact lost-response submissions',
    async () => {
      const guest = syntheticRecord('guest-recovery-' + randomUUID());
      const original = {
        p_expected: 4,
        p_operation: randomUUID(),
        p_records: [guest],
        p_retire: false,
      };
      assert(!(await rpc(null, 'merge_outcome', original)).ok);
      assert.equal((await rpc(a, 'merge_outcome', original)).data.outcome, 'missing');
      const submitted = {
        p_expected: 4,
        p_operation: original.p_operation,
        p_records: [guest],
        p_purpose: 'guest-merge',
      };
      const receipt = await rpc(a, 'push', submitted);
      assert(receipt.ok && receipt.data.revision === 5);
      assert.equal(
        (await rpc(a, 'merge_outcome', { ...original, p_retire: true })).data.outcome,
        'committed',
      );
      assert.deepEqual((await rpc(a, 'push', submitted)).data, receipt.data);
      assert(!(await rpc(a, 'merge_outcome', { ...original, p_records: [privacy] })).ok);
      assert.equal(
        (await rpc(b, 'merge_outcome', { ...original, p_expected: 1 })).data.outcome,
        'missing',
      );
      assert(
        !(await rpc(b, 'merge_outcome', { ...original, p_expected: 1, p_user_id: config.idA })).ok,
      );
    },
  );
  await check(
    'Guest operation retirement blocks delayed writes while retaining current Cloud records',
    async () => {
      const before = (await rpc(a, 'pull', { p_cursor: 0 })).data;
      const original = {
        p_expected: 5,
        p_operation: randomUUID(),
        p_records: [syntheticRecord('unsent-' + randomUUID())],
        p_retire: true,
      };
      assert.equal((await rpc(a, 'merge_outcome', original)).data.outcome, 'retired');
      assert.equal(
        (await rpc(a, 'merge_outcome', { ...original, p_retire: false })).data.outcome,
        'retired',
      );
      const { p_retire, ...payload } = original;
      assert.equal(p_retire, true);
      assert(!(await rpc(a, 'push', { ...payload, p_purpose: 'guest-merge' })).ok);
      const after = (await rpc(a, 'pull', { p_cursor: 0 })).data;
      assert.equal(after.revision, before.revision);
      assert.deepEqual(after.records, before.records);
    },
  );
  await check(
    'recorded later Account receipts are purpose-bound and independently owner-scoped',
    async () => {
      const args = {
        p_expected: push.p_expected,
        p_operation: push.p_operation,
        p_records: push.p_records,
        p_retire: false,
      };
      assert(!(await rpc(null, 'edit_outcome', args)).ok);
      const known = await rpc(a, 'edit_outcome', args);
      assert(known.ok && known.data.outcome === 'committed' && known.data.operationRevision === 2);
      assert.equal((await rpc(b, 'edit_outcome', args)).data.outcome, 'missing');
      assert(!(await rpc(a, 'merge_outcome', args)).ok);
      const retired = {
        p_expected: 5,
        p_operation: randomUUID(),
        p_records: [syntheticRecord('later-unsent-' + randomUUID())],
        p_retire: true,
      };
      assert.equal((await rpc(a, 'edit_outcome', retired)).data.outcome, 'retired');
      const { p_retire, ...body } = retired;
      assert.equal(p_retire, true);
      assert(!(await rpc(a, 'push', { ...body, p_purpose: 'edit' })).ok);
      assert.equal((await rpc(a, 'pull', { p_cursor: 0 })).data.revision, 5);
    },
  );
  process.stdout.write(
    'Passed ' +
      checks +
      ' hosted disposable RPC scenarios. No data cleanup performed; keep the Test Project for review. Legacy conversion, near-limit archival and physical-device acceptance require separate tests.\n',
  );
}
if (
  process.argv[1] &&
  new URL(import.meta.url).pathname
    .toLowerCase()
    .endsWith('/' + process.argv[1].replaceAll('\\', '/').split('/').at(-1).toLowerCase())
) {
  main().catch(() => {
    process.stderr.write(
      'FAIL: disposable account verification stopped. Inspect the Test Project safely; no reset/cleanup attempted. Provider payloads and credentials were not logged.\n',
    );
    process.exitCode = 1;
  });
}
