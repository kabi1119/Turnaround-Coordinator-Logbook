import type { Database } from '../domain/model';
import { restrictivePrivacy } from '../domain/model';
import { validDatabase } from '../lib/storage';
import type { WorkspaceStore, WriteResult } from './store';
const PREFIX = 'tco-account-vault-v1:';
const ITERATIONS = 600_000;
const encoder = new TextEncoder();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function vaultKey(userId: string) {
  if (!uuid.test(userId)) throw new Error('Invalid account identity');
  return PREFIX + userId;
}
type Envelope = {
  version: 1;
  userId: string;
  salt: string;
  iv: string;
  ciphertext: string;
  iterations: number;
};
const base64 = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
function bytes(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
function parse(raw: string, userId: string): Envelope {
  const e = JSON.parse(raw);
  if (
    !e ||
    Object.keys(e).sort().join(',') !== 'ciphertext,iterations,iv,salt,userId,version' ||
    e.version !== 1 ||
    e.userId !== userId ||
    e.iterations !== ITERATIONS ||
    typeof e.salt !== 'string' ||
    typeof e.iv !== 'string' ||
    typeof e.ciphertext !== 'string' ||
    bytes(e.salt).length !== 16 ||
    bytes(e.iv).length !== 12 ||
    bytes(e.ciphertext).length < 16
  )
    throw new Error('Unsupported or damaged vault');
  return e;
}
export function hasVault(userId: string) {
  return localStorage.getItem(vaultKey(userId)) !== null;
}
export function vaultAvailable() {
  return Boolean(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues);
}
export function emptyAccountDatabase(language: Database['settings']['language'] = 'en'): Database {
  return {
    version: 1,
    aircraft: [],
    duties: [],
    journals: [],
    settings: { language, privacy: { ...restrictivePrivacy } },
  };
}
/** Secret and non-extractable CryptoKey live only in this unlocked instance, never in storage. */
export async function openVault(
  userId: string,
  secret: string,
  create = false,
): Promise<WorkspaceStore> {
  if (!vaultAvailable()) throw new Error('Secure context required');
  if (secret.length < 12 || secret.length > 1024)
    throw new Error('Use a passphrase of 12–1024 characters');
  const storageKey = vaultKey(userId);
  const raw = localStorage.getItem(storageKey);
  if ((raw === null) !== create) throw new Error('Vault state changed');
  const envelope = raw === null ? null : parse(raw, userId);
  const salt = envelope ? bytes(envelope.salt) : crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, [
    'deriveKey',
  ]);
  let key: CryptoKey | null = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const aad = encoder.encode(`tco-logbook:vault:1:${userId}`);
  let db: Database | null = envelope
    ? JSON.parse(
        new TextDecoder().decode(
          await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: bytes(envelope.iv), additionalData: aad },
            key,
            bytes(envelope.ciphertext),
          ),
        ),
      )
    : emptyAccountDatabase();
  if (!validDatabase(db)) throw new Error('Invalid vault data');
  let snapshot = raw;
  let locked = false;
  let writing = false;
  const store: WorkspaceStore = {
    key: storageKey,
    kind: 'account',
    read: () => {
      if (locked || !db) throw new Error('Vault locked');
      return { db, snapshot, error: '' };
    },
    snapshot: () => localStorage.getItem(storageKey),
    current: (value) =>
      !locked &&
      JSON.stringify(value) === JSON.stringify(db) &&
      localStorage.getItem(storageKey) === snapshot,
    lock: () => {
      locked = true;
      key = null;
      db = null;
    },
    write: async (value, expected): Promise<WriteResult> => {
      if (locked || !key || writing) return { ok: false, reason: 'unavailable' };
      writing = true;
      try {
        const serialized = JSON.stringify(value),
          decoded = JSON.parse(serialized);
        if (
          !validDatabase(decoded) ||
          [decoded.aircraft, decoded.duties, decoded.journals].some(
            (rows) =>
              rows.some((row) => !row.id.trim()) ||
              new Set(rows.map((row) => row.id)).size !== rows.length,
          )
        )
          return { ok: false, reason: 'invalid' };
        if (expected === undefined || localStorage.getItem(storageKey) !== expected)
          return { ok: false, reason: 'conflict' };
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv, additionalData: aad },
          key,
          encoder.encode(serialized),
        );
        // Sign-out/switch and stale-tab checks run again after asynchronous encryption.
        if (locked || !key) return { ok: false, reason: 'unavailable' };
        if (localStorage.getItem(storageKey) !== expected) return { ok: false, reason: 'conflict' };
        const next = JSON.stringify({
          version: 1,
          userId,
          iterations: ITERATIONS,
          salt: base64(salt),
          iv: base64(iv),
          ciphertext: base64(new Uint8Array(ciphertext)),
        });
        localStorage.setItem(storageKey, next);
        snapshot = next;
        db = decoded;
        return { ok: true, snapshot: next };
      } catch {
        return { ok: false, reason: 'unavailable' };
      } finally {
        writing = false;
      }
    },
  };
  if (create) {
    const result = await store.write(db, null);
    if (!result.ok) {
      store.lock();
      throw new Error('Could not create encrypted vault');
    }
  }
  return store;
}
