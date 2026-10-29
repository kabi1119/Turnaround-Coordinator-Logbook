import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { seedDatabase } from '../src/data/seed';
import { readDatabase as loadDatabase, persistDatabase, STORAGE_KEY } from '../src/lib/storage';
import { createBackup, parseBackup } from '../src/lib/backup';
import BackupManager from '../src/features/BackupManager';

describe('offline local-data safety', () => {
  it('preserves an unreadable stored copy and prevents writes after a failed read', () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    const loaded = loadDatabase();
    expect(loaded.error).not.toBe('');
    expect(loaded.snapshot).toBe('{broken');
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw Error('blocked');
    });
    expect(loadDatabase().snapshot).toBeUndefined();
    get.mockRestore();
    expect(persistDatabase(loaded.db, undefined).ok).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
  });
  it('blocks a stale tab without replacing newer records or IDs', () => {
    const db = seedDatabase();
    const first = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, first);
    const loaded = loadDatabase();
    db.aircraft[0].notes = 'A newer tab edit';
    const newer = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, newer);
    expect(persistDatabase(loaded.db, loaded.snapshot)).toEqual({ ok: false, reason: 'conflict' });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(newer);
  });
  it('keeps storage intact for quota failure, invalid payload and duplicate IDs', () => {
    const db = seedDatabase(),
      original = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, original);
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw Error('quota');
    });
    expect(persistDatabase(db, original).ok).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
    set.mockRestore();
    db.aircraft.push(db.aircraft[0]);
    expect(persistDatabase(db, original)).toEqual({ ok: false, reason: 'invalid' });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
  });
  it('round-trips supported backups with IDs/links/settings, rejecting malformed files before writes', () => {
    const db = seedDatabase(),
      original = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, original);
    expect(() => parseBackup('{')).toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
    const incoming = parseBackup(JSON.stringify(createBackup(db)));
    expect(persistDatabase(incoming.data, original).ok).toBe(true);
    expect(loadDatabase().db).toEqual(db);
  });
  it('refuses to export a fallback view as a backup of corrupted browser data', async () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    render(<BackupManager db={loadDatabase().db} restore={() => false} />);
    fireEvent.click(screen.getByText('Export Full Backup (JSON)'));
    fireEvent.click(screen.getByText('Download unencrypted backup'));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('No backup was created'),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
    expect(screen.queryByRole('status')).toBeNull();
  });
});

function workerHarness(badHash = false) {
  const origin = 'https://offline.test';
  const files = new Map([
    ['/index.html', '<html>generation-one</html>'],
    ['/assets/app.js', 'generation-one'],
  ]);
  const assets = [...files].map(([url, content]) => ({
    url,
    sha256: createHash('sha256').update(content).digest('hex'),
  }));
  const stores = new Map<string, Map<string, Response>>();
  const cachedRedirects: boolean[] = [];
  const key = (url: string) => new URL(url, origin).pathname;
  const cache = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      put: async (url: string, response: Response) => {
        cachedRedirects.push(response.redirected);
        store.set(key(url), response.clone());
      },
      match: async (url: string) => store.get(key(url))?.clone(),
    };
  };
  const caches = {
    open: cache,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const handlers = new Map<string, (event: unknown) => void>();
  const network = vi.fn(async (request: Request) => {
    const response = new Response(badHash ? 'wrong deployment' : files.get(key(request.url)), {
      headers: { 'Content-Security-Policy': "default-src 'self'" },
    });
    if (key(request.url) === '/index.html')
      Object.defineProperty(response, 'redirected', { value: true });
    return response;
  });
  class RelativeRequest extends Request {
    constructor(url: string, options?: RequestInit) {
      super(new URL(url, origin), options);
    }
  }
  const template = readFileSync('src/pwa/service-worker.js', 'utf8')
    .replace('__TCO_CACHE_NAME__', JSON.stringify('tco-logbook-shell-v1-test'))
    .replace('__TCO_ASSETS__', JSON.stringify(assets));
  const self = {
    location: { origin },
    addEventListener: (name: string, handler: (event: unknown) => void) =>
      handlers.set(name, handler),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  runInNewContext(template, {
    self,
    caches,
    fetch: network,
    Request: RelativeRequest,
    Response,
    URL,
    crypto: webcrypto,
    Uint8Array,
    Map,
    Error,
  });
  async function lifecycle(name: string) {
    let pending: Promise<unknown> | undefined;
    handlers.get(name)!({
      waitUntil: (value: Promise<unknown>) => {
        pending = value;
      },
    });
    await pending;
  }
  async function request(path: string, mode = 'cors', method = 'GET') {
    let answer: Promise<Response> | undefined;
    handlers.get('fetch')!({
      request: { url: new URL(path, origin).href, mode, method },
      respondWith: (value: Promise<Response>) => {
        answer = value;
      },
    });
    return answer;
  }
  return { stores, caches, network, self, lifecycle, request, cachedRedirects };
}
describe('bounded service-worker lifecycle', () => {
  it('serves the installed generation offline and never caches arbitrary/API/private requests', async () => {
    const h = workerHarness();
    await h.lifecycle('install');
    expect(h.cachedRedirects).toEqual([false, false]);
    h.network.mockRejectedValue(new Error('offline'));
    const navigation = (await h.request('/deep/path', 'navigate'))!;
    expect(await navigation.text()).toContain('generation-one');
    expect(navigation.headers.get('Content-Security-Policy')).toBe("default-src 'self'");
    expect(await (await h.request('/assets/app.js'))!.text()).toBe('generation-one');
    expect(await h.request('/api/private')).toBeUndefined();
    expect(await h.request('/assets/app.js', 'cors', 'POST')).toBeUndefined();
    expect(await h.request('https://third-party.test/image.png')).toBeUndefined();
    expect(h.self.skipWaiting).not.toHaveBeenCalled();
    expect(h.self.clients.claim).not.toHaveBeenCalled();
  });
  it('rejects mixed-version installation without deleting active or unrelated caches', async () => {
    const h = workerHarness(true);
    await h.caches.open('tco-logbook-shell-v1-old');
    await h.caches.open('another-app');
    await expect(h.lifecycle('install')).rejects.toThrow('version mismatch');
    expect([...h.stores.keys()]).toEqual(['tco-logbook-shell-v1-old', 'another-app']);
  });
  it('cleans only owned obsolete caches and returns an explicit failure for an evicted offline shell', async () => {
    const h = workerHarness();
    await h.lifecycle('install');
    await h.caches.open('tco-logbook-shell-v1-old');
    await h.caches.open('another-app');
    await h.lifecycle('activate');
    expect([...h.stores.keys()]).toEqual(['tco-logbook-shell-v1-test', 'another-app']);
    h.stores.get('tco-logbook-shell-v1-test')!.delete('/index.html');
    h.network.mockRejectedValue(new Error('offline'));
    expect((await h.request('/', 'navigate'))!.status).toBe(503);
  });
});
