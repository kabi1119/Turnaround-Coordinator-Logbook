/* global self, caches, fetch, Request, Response, URL, crypto */
// Build substitutes these constants with a bounded, content-verified asset list.
// eslint-disable-next-line no-undef -- build-time placeholder
const CACHE_NAME = __TCO_CACHE_NAME__;
// eslint-disable-next-line no-undef -- build-time placeholder
const ASSETS = __TCO_ASSETS__;
const CACHE_PREFIX = 'tco-logbook-shell-v1-';
const entries = new Map(ASSETS.map((asset) => [asset.url, asset]));

async function verifiedAsset(asset) {
  const response = await fetch(
    new Request(asset.url, { cache: 'reload', credentials: 'same-origin' }),
  );
  if (!response.ok || response.type === 'opaque') throw new Error('Offline asset unavailable');
  const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  if (hash !== asset.sha256) throw new Error('Offline asset version mismatch');
  // Static hosting can redirect /index.html to /. A redirected Response cannot
  // satisfy every navigation's redirect mode; preserve verified bytes/headers
  // while removing that transport-only flag before caching it.
  return response.redirected
    ? new Response(response.body, { status: response.status, headers: response.headers })
    : response;
}
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        // Bound concurrent downloads; a partial installation never becomes active.
        for (let i = 0; i < ASSETS.length; i += 4) {
          await Promise.all(
            ASSETS.slice(i, i + 4).map(async (asset) => {
              await cache.put(asset.url, await verifiedAsset(asset));
            }),
          );
        }
      } catch (error) {
        await caches.delete(CACHE_NAME);
        throw error;
      }
    })(),
  );
  // Deliberately no skipWaiting: never replace a page with an unfinished edit.
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
      }
    })(),
  );
  // No clients.claim or forced reload. New navigations adopt the active generation.
});
async function serve(asset) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(asset.url);
    if (hit) return hit;
    // Repair an evicted entry only if it is this exact generation, never mixed HTML/JS.
    const response = await verifiedAsset(asset);
    await cache.put(asset.url, response.clone());
    return response;
  } catch {
    return new Response(
      'Offline copy unavailable. Reconnect and reopen the app.\n離線副本無法使用，請連線後重新開啟。',
      {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      },
    );
  }
}
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/sw.js')
    return;
  const asset =
    request.mode === 'navigate' ? entries.get('/index.html') : entries.get(url.pathname);
  if (asset) event.respondWith(serve(asset));
  // No runtime cache of arbitrary requests, APIs, blobs, downloads or user data.
});
