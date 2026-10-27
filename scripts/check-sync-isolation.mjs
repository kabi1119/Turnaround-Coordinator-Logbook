/** Owner-run only against TWO EMPTY synthetic accounts in a disposable project. Never production. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
const {
  TCO_SYNC_DISPOSABLE,
  TCO_SYNC_TEST_URL,
  TCO_SYNC_TEST_KEY,
  TCO_SYNC_TEST_A_TOKEN,
  TCO_SYNC_TEST_B_TOKEN,
} = process.env;
if (TCO_SYNC_DISPOSABLE !== 'yes')
  throw new Error('Disposable test opt-in required. No requests sent.');
const origin = new URL(TCO_SYNC_TEST_URL || '');
if (
  origin.protocol !== 'https:' ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
)
  throw new Error('Explicit HTTPS test origin required.');
if (!TCO_SYNC_TEST_KEY || !TCO_SYNC_TEST_A_TOKEN || !TCO_SYNC_TEST_B_TOKEN)
  throw new Error('Test publishable key and two user tokens required.');
async function request(token, path, body, extra = {}) {
  const response = await fetch(origin.origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      apikey: TCO_SYNC_TEST_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}
const rpc = (token, name, body) => request(token, '/rest/v1/rpc/tco_sync_' + name, body);
const a = TCO_SYNC_TEST_A_TOKEN,
  b = TCO_SYNC_TEST_B_TOKEN;
const userA = await request(a, '/auth/v1/user'),
  userB = await request(b, '/auth/v1/user');
assert(
  userA.ok && userB.ok && userA.data.id !== userB.data.id,
  'Two valid, distinct authenticated test accounts required',
);
for (const token of [a, b]) {
  const result = await rpc(token, 'pull', { p_cursor: 0 });
  assert(
    result.ok && result.data.envelope === null && result.data.total === 0,
    'Refusing non-empty or unconfigured test accounts',
  );
}
const tokenParts = a.split('.');
assert(tokenParts.length === 3, 'A signed Supabase test access JWT is required');
const forgedClaims = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString('utf8'));
forgedClaims.sub = userB.data.id;
const forgedToken = [
  tokenParts[0],
  Buffer.from(JSON.stringify(forgedClaims)).toString('base64url'),
  tokenParts[2],
].join('.');
assert(
  !(await rpc(forgedToken, 'pull', { p_cursor: 0 })).ok,
  'Gateway must reject modified JWT claims with an invalid signature',
);
const envelope = (userId) => ({
  version: 1,
  userId,
  keyId: randomUUID(),
  iterations: 600000,
  salt: randomBytes(16).toString('base64'),
  iv: randomBytes(12).toString('base64'),
  ciphertext: randomBytes(48).toString('base64'),
});
// Random opaque fixture bytes test API authorization, not decryption. Unit tests exercise actual AEAD.
const keyA = envelope(userA.data.id),
  keyB = envelope(userB.data.id);
assert(!(await rpc(b, 'initialize', { p_envelope: keyA })).ok, 'Forged key owner must be rejected');
assert((await rpc(a, 'initialize', { p_envelope: keyA })).ok, 'A key creation');
assert((await rpc(b, 'initialize', { p_envelope: keyB })).ok, 'B key creation');
assert(
  !(await rpc(a, 'initialize', { p_envelope: keyA })).ok,
  'Immutable key replacement must fail',
);
const record = {
  version: 1,
  userId: userA.data.id,
  keyId: keyA.keyId,
  recordId: randomBytes(32).toString('hex'),
  revision: 1,
  iv: randomBytes(12).toString('base64'),
  ciphertext: randomBytes(64).toString('base64'),
};
assert(
  (await rpc(a, 'push', { p_expected: 0, p_operation: randomUUID(), p_records: [record] })).ok,
  'A first revision',
);
assert(
  !(await rpc(b, 'push', { p_expected: 0, p_operation: randomUUID(), p_records: [record] })).ok,
  'B must not write A ciphertext or tombstones',
);
assert(
  !(await rpc(a, 'push', { p_expected: 0, p_operation: randomUUID(), p_records: [record] })).ok,
  'Stale revision must fail',
);
const ownA = await rpc(a, 'pull', { p_cursor: 0 });
assert(
  ownA.ok &&
    ownA.data.envelope.userId === userA.data.id &&
    ownA.data.records[0].ciphertext === record.ciphertext,
  'Authenticated owner must recover its unchanged cloud key/record without executor Auth schema grants',
);
assert(
  !(await rpc(a, 'pull', { p_cursor: 0, p_user_id: userB.data.id })).ok,
  'RPC must reject a client-supplied ownership argument',
);
const isolated = await rpc(b, 'pull', { p_cursor: 0 });
assert(
  isolated.ok && isolated.data.total === 0 && isolated.data.envelope.userId === userB.data.id,
  'B must see only its own key and no A records',
);
const direct = await request(a, '/rest/v1/records?select=*', undefined, {
  'Accept-Profile': 'tco_sync',
});
assert(!direct.ok, 'Private schema must not be exposed');
const anonymous = await fetch(origin.origin + '/rest/v1/rpc/tco_sync_pull', {
  method: 'POST',
  headers: { apikey: TCO_SYNC_TEST_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_cursor: 0 }),
  signal: AbortSignal.timeout(15000),
});
assert(!anonymous.ok, 'Anonymous RPC must be denied');
const incremental = await rpc(a, 'pull', { p_cursor: 1 });
assert(
  incremental.ok && incremental.data.count === 0 && incremental.data.total === 1,
  'Incremental read must not repeat unchanged records',
);
console.log(
  'PASS: disposable REST own-account access, key/record isolation, tampered-JWT rejection, ownership-argument rejection, revision guards, anonymous denial and private-schema restrictions.',
);
console.log(
  'Synthetic fixture rows remain in these two disposable accounts. Remove the disposable project/accounts using the owner test administration workflow.',
);
