import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openVault, vaultKey, hasVault, emptyAccountDatabase } from '../src/workspaces/vault';
import { CHOICE_KEY, GUEST_OWNER_KEY, guestReturning, chooseGuest } from '../src/workspaces/store';
import { STORAGE_KEY } from '../src/lib/storage';
import { seedDatabase } from '../src/data/seed';
import { createBackup, parseBackup } from '../src/lib/backup';
const A = '70000000-0000-4000-8000-000000000001',
  B = '70000000-0000-4000-8000-000000000002';
const secret = 'long unique local vault passphrase';
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());
describe('Guest ownership and encrypted account persistence', () => {
  it('assigns legacy records/settings/relationships to Guest in place and is idempotent', () => {
    const raw = JSON.stringify(seedDatabase());
    localStorage.setItem(STORAGE_KEY, raw);
    expect(guestReturning()).toBe(true);
    const owner = localStorage.getItem(GUEST_OWNER_KEY);
    chooseGuest();
    expect(guestReturning()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(localStorage.getItem(GUEST_OWNER_KEY)).toBe(owner);
    expect(localStorage.getItem(CHOICE_KEY)).toBe('guest');
  });
  it('preserves unreadable legacy data for the existing recovery UI without replacing it', () => {
    localStorage.setItem(STORAGE_KEY, 'damaged original');
    expect(guestReturning()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('damaged original');
    expect(localStorage.getItem(GUEST_OWNER_KEY)).toBeNull();
  });
  it('starts empty, encrypts the whole account payload, keeps Guest bytes and separates A from B', async () => {
    const guest = JSON.stringify(seedDatabase());
    localStorage.setItem(STORAGE_KEY, guest);
    const a = await openVault(A, secret, true),
      b = await openVault(B, secret, true);
    expect(a.read().db).toEqual(emptyAccountDatabase());
    const db = seedDatabase();
    db.aircraft[0].notes = 'private A operational note';
    const result = await a.write(db, a.snapshot());
    expect(result.ok).toBe(true);
    const raw = a.snapshot()!;
    expect(raw).not.toContain('private A');
    expect(raw).not.toContain('Cathay');
    expect(raw).not.toContain(secret);
    const envelope = JSON.parse(raw);
    expect(Object.keys(envelope).sort()).toEqual([
      'ciphertext',
      'iterations',
      'iv',
      'salt',
      'userId',
      'version',
    ]);
    expect(envelope.iterations).toBe(600000);
    expect(b.read().db.aircraft).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(guest);
    a.lock();
    b.lock();
    const again = await openVault(A, secret);
    expect(again.read().db).toEqual(db);
    expect(again.current(db)).toBe(true);
    again.lock();
  });
  it('rejects wrong secrets, tampering, account-envelope swapping and unsupported versions', async () => {
    const store = await openVault(A, secret, true),
      original = store.snapshot()!;
    store.lock();
    await expect(openVault(A, 'a different wrong passphrase')).rejects.toThrow();
    let e = JSON.parse(original);
    e.ciphertext = 'A' + e.ciphertext.slice(1);
    if (e.ciphertext === JSON.parse(original).ciphertext)
      e.ciphertext = 'B' + e.ciphertext.slice(1);
    localStorage.setItem(vaultKey(A), JSON.stringify(e));
    await expect(openVault(A, secret)).rejects.toThrow();
    localStorage.setItem(vaultKey(B), original);
    await expect(openVault(B, secret)).rejects.toThrow();
    e = { ...JSON.parse(original), userId: B };
    localStorage.setItem(vaultKey(B), JSON.stringify(e));
    await expect(openVault(B, secret)).rejects.toThrow();
    localStorage.setItem(vaultKey(A), JSON.stringify({ ...JSON.parse(original), version: 2 }));
    await expect(openVault(A, secret)).rejects.toThrow();
    expect(hasVault(A)).toBe(true);
  });
  it('uses fresh IVs, detects stale writes and refuses writes after locking or during encryption', async () => {
    const store = await openVault(A, secret, true),
      db = store.read().db,
      old = store.snapshot();
    expect((await store.write(db, old)).ok).toBe(true);
    const next = store.snapshot();
    expect(JSON.parse(next!).iv).not.toBe(JSON.parse(old!).iv);
    expect(await store.write(db, old)).toMatchObject({ ok: false, reason: 'conflict' });
    const pending = store.write(db, next);
    store.lock();
    expect(await pending).toMatchObject({ ok: false });
    expect(store.snapshot()).toBe(next);
    expect(() => store.read()).toThrow('Vault locked');
    expect(await store.write(db, next)).toMatchObject({ ok: false });
  });
  it('never reports success or partially replaces ciphertext on quota failure', async () => {
    const store = await openVault(A, secret, true),
      before = store.snapshot(),
      db = store.read().db;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(await store.write({ ...db, journals: seedDatabase().journals }, before)).toMatchObject({
      ok: false,
      reason: 'unavailable',
    });
    expect(store.snapshot()).toBe(before);
    expect(store.read().db).toEqual(db);
    spy.mockRestore();
    store.lock();
  });
  it('fails closed without Web Crypto and rejects invalid account IDs or creation over an existing vault', async () => {
    const store = await openVault(A, secret, true);
    const raw = store.snapshot();
    store.lock();
    await expect(openVault(A, secret, true)).rejects.toThrow();
    expect(() => vaultKey('../guest')).toThrow();
    vi.stubGlobal('crypto', {});
    await expect(openVault(A, secret)).rejects.toThrow('Secure context');
    expect(localStorage.getItem(vaultKey(A))).toBe(raw);
  });
  it('keeps existing reviewed JSON backup format usable without including auth tokens or vault secrets', async () => {
    const store = await openVault(A, secret, true),
      db = seedDatabase();
    await store.write(db, store.snapshot());
    const backup = createBackup(store.read().db),
      raw = JSON.stringify(backup);
    expect(parseBackup(raw).data).toEqual(db);
    expect(raw).not.toContain(secret);
    expect(raw).not.toContain('ciphertext');
    store.lock();
  });
});
