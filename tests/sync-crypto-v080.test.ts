import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createCloudKey, unlockCloudKey, encryptRecord, decryptRecord } from '../src/sync/crypto';
import type { RecordData } from '../src/sync/types';
const A = '80000000-0000-4000-8000-000000000001',
  B = '80000000-0000-4000-8000-000000000002',
  secret = 'long unique fictional cloud passphrase';
const r: RecordData = {
  collection: 'aircraft',
  id: 'fixture',
  value: { notes: 'private fictional content' },
};
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());
describe('cloud encryption envelopes', () => {
  it('recovers a random account key on another device without remote plaintext; uses fresh IVs and non-extractable keys', async () => {
    const a = await createCloudKey(A, secret),
      b = await unlockCloudKey(a.envelope, A, secret);
    const e = await encryptRecord(a.keys, r, 1),
      e2 = await encryptRecord(a.keys, r, 2);
    expect(await decryptRecord(b, e)).toEqual(r);
    expect(e.iv).not.toBe(e2.iv);
    expect(e.recordId).toBe(e2.recordId);
    expect(JSON.stringify([e, a.envelope])).not.toContain('private');
    expect(JSON.stringify(a.envelope)).not.toContain(secret);
    expect(a.keys.encryption.extractable).toBe(false);
    expect(a.keys.identity.extractable).toBe(false);
  });
  it('rejects wrong passphrases, wrong-account wrapped keys, altered KDF parameters and future envelope versions', async () => {
    const { envelope } = await createCloudKey(A, secret);
    await expect(unlockCloudKey(envelope, A, 'wrong long passphrase')).rejects.toThrow();
    await expect(unlockCloudKey(envelope, B, secret)).rejects.toThrow();
    await expect(unlockCloudKey({ ...envelope, userId: B }, B, secret)).rejects.toThrow();
    await expect(
      unlockCloudKey({ ...envelope, iterations: 1 } as never, A, secret),
    ).rejects.toThrow();
    await expect(unlockCloudKey({ ...envelope, version: 2 } as never, A, secret)).rejects.toThrow();
  });
  it('authenticates ciphertext, user, opaque record ID, format and revision', async () => {
    const { keys } = await createCloudKey(A, secret),
      e = await encryptRecord(keys, r, 1);
    for (const patch of [
      { ciphertext: (e.ciphertext[0] === 'A' ? 'B' : 'A') + e.ciphertext.slice(1) },
      { userId: B },
      { recordId: 'a'.repeat(64) },
      { revision: 2 },
      { version: 2 },
    ])
      await expect(decryptRecord(keys, { ...e, ...patch } as never)).rejects.toThrow();
    await expect(encryptRecord(keys, { ...r, value: 'x'.repeat(300000) }, 1)).rejects.toThrow();
  });
});
