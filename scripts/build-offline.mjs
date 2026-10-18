import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function buildOffline(directory = 'dist') {
  const root = resolve(directory);
  const assets = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      const name = relative(root, path).replaceAll('\\', '/');
      if (
        ['index.html', 'manifest.webmanifest', 'airplane.svg', 'THIRD_PARTY_NOTICES.txt'].includes(
          name,
        ) ||
        (/^assets\//.test(name) && /\.(?:js|css|png|svg|woff2?)$/.test(name))
      ) {
        assets.push({ url: '/' + name, sha256: hash(readFileSync(path)) });
      }
    }
  }
  walk(root);
  assets.sort((a, b) => a.url.localeCompare(b.url, 'en'));
  if (!assets.some((a) => a.url === '/index.html') || !assets.some((a) => a.url.endsWith('.js')))
    throw Error('Offline shell is incomplete');
  const template = readFileSync('src/pwa/service-worker.js', 'utf8');
  const revision = hash(
    JSON.stringify(assets) + template + readFileSync('public/_headers', 'utf8'),
  );
  const source = template
    .replace('__TCO_CACHE_NAME__', JSON.stringify('tco-logbook-shell-v1-' + revision))
    .replace('__TCO_ASSETS__', JSON.stringify(assets));
  writeFileSync(resolve(root, 'sw.js'), source);
}
