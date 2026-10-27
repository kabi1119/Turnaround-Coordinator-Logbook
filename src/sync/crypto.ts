import type { CipherRecord, KeyEnvelope, RecordData } from './types';
import { SyncError } from './types';
import { uuidV4 } from '../lib/uuid';
const utf8 = new TextEncoder();
const decode = new TextDecoder('utf-8', { fatal: true });
const MAX = 262144;
export const b64 = (a: Uint8Array) => btoa(Array.from(a, (b) => String.fromCharCode(b)).join(''));
function bytes(s: unknown, length?: number) {
  if (typeof s !== 'string' || s.length > MAX * 2 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s))
    throw new SyncError('invalid');
  const a = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  if (a.length > MAX || b64(a) !== s || (length !== undefined && a.length !== length))
    throw new SyncError('invalid');
  return a;
}
const identity = (s: unknown) =>
  typeof s === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
export function validateKey(e: KeyEnvelope, userId: string) {
  if (
    !e ||
    e.version !== 1 ||
    e.userId !== userId ||
    !identity(userId) ||
    !identity(e.keyId) ||
    e.iterations !== 600000 ||
    Object.keys(e).length !== 7
  )
    throw new SyncError('invalid');
  bytes(e.salt, 16);
  bytes(e.iv, 12);
  bytes(e.ciphertext, 48);
}
async function wrapping(secret: string, salt: Uint8Array<ArrayBuffer>) {
  if (secret.length < 12 || secret.length > 1024) throw new SyncError('invalid');
  const material = await crypto.subtle.importKey('raw', utf8.encode(secret), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
export type CloudKeys = {
  encryption: CryptoKey;
  identity: CryptoKey;
  userId: string;
  keyId: string;
};
async function keys(
  root: Uint8Array<ArrayBuffer>,
  userId: string,
  keyId: string,
): Promise<CloudKeys> {
  const material = await crypto.subtle.importKey('raw', root, 'HKDF', false, ['deriveKey']);
  const derive = (info: string) => ({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: utf8.encode(userId),
    info: utf8.encode(`tco:cloud:1:${keyId}:${info}`),
  });
  return {
    userId,
    keyId,
    encryption: await crypto.subtle.deriveKey(
      derive('records'),
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    ),
    identity: await crypto.subtle.deriveKey(
      derive('opaque-ids'),
      material,
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      false,
      ['sign'],
    ),
  };
}
const keyAAD = (e: KeyEnvelope) =>
  utf8.encode(JSON.stringify(['tco-cloud-key', 1, e.userId, e.keyId, e.salt, e.iterations]));
export async function createCloudKey(userId: string, secret: string) {
  if (!identity(userId)) throw new SyncError('invalid');
  const root = crypto.getRandomValues(new Uint8Array(32)),
    salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const envelope: KeyEnvelope = {
    version: 1,
    userId,
    keyId: uuidV4(),
    salt: b64(salt),
    iterations: 600000,
    iv: b64(iv),
    ciphertext: '',
  };
  try {
    envelope.ciphertext = b64(
      new Uint8Array(
        await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv, additionalData: keyAAD(envelope) },
          await wrapping(secret, salt),
          root,
        ),
      ),
    );
    return { envelope, keys: await keys(root, userId, envelope.keyId) };
  } finally {
    root.fill(0);
  }
}
export async function unlockCloudKey(e: KeyEnvelope, userId: string, secret: string) {
  validateKey(e, userId);
  const root = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes(e.iv), additionalData: keyAAD(e) },
      await wrapping(secret, bytes(e.salt)),
      bytes(e.ciphertext),
    ),
  );
  try {
    return await keys(root, userId, e.keyId);
  } finally {
    root.fill(0);
  }
}
export const recordKey = (r: RecordData) => JSON.stringify([r.collection, r.id]);
export async function opaqueId(k: CloudKeys, r: RecordData) {
  const hash = await crypto.subtle.sign('HMAC', k.identity, utf8.encode(recordKey(r)));
  return Array.from(new Uint8Array(hash), (x) => x.toString(16).padStart(2, '0')).join('');
}
const recordAAD = (e: CipherRecord) =>
  utf8.encode(
    JSON.stringify(['tco-cloud-record', e.version, e.userId, e.keyId, e.recordId, e.revision]),
  );
export async function encryptRecord(
  k: CloudKeys,
  r: RecordData,
  revision: number,
): Promise<CipherRecord> {
  const plain = utf8.encode(JSON.stringify(r));
  if (plain.length > MAX - 16 || !Number.isSafeInteger(revision) || revision < 1)
    throw new SyncError('capacity');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const e: CipherRecord = {
    version: 1,
    userId: k.userId,
    keyId: k.keyId,
    recordId: await opaqueId(k, r),
    revision,
    iv: b64(iv),
    ciphertext: '',
  };
  e.ciphertext = b64(
    new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: recordAAD(e) },
        k.encryption,
        plain,
      ),
    ),
  );
  return e;
}
export async function decryptRecord(k: CloudKeys, e: CipherRecord): Promise<RecordData> {
  if (
    !e ||
    e.version !== 1 ||
    e.userId !== k.userId ||
    e.keyId !== k.keyId ||
    !/^[0-9a-f]{64}$/.test(e.recordId) ||
    !Number.isSafeInteger(e.revision) ||
    e.revision < 1 ||
    Object.keys(e).length !== 7
  )
    throw new SyncError('invalid');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(e.iv, 12), additionalData: recordAAD(e) },
    k.encryption,
    bytes(e.ciphertext),
  );
  const r = JSON.parse(decode.decode(plain)) as RecordData;
  if (
    !r ||
    !['aircraft', 'duties', 'journals', 'privacy'].includes(r.collection) ||
    typeof r.id !== 'string' ||
    !r.id.trim() ||
    !Object.hasOwn(r, 'value') ||
    Object.keys(r).length !== 3 ||
    (r.collection === 'privacy' && (r.id !== 'settings' || r.value === null)) ||
    (await opaqueId(k, r)) !== e.recordId
  )
    throw new SyncError('invalid');
  return r;
}
