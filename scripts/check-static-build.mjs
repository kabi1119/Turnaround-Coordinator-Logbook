import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import process from 'node:process';

const root = resolve('dist');
const required = [
  'index.html',
  '_headers',
  'robots.txt',
  'manifest.webmanifest',
  'airplane.svg',
  'THIRD_PARTY_NOTICES.txt',
];
const failures = [];
for (const path of required) {
  if (!existsSync(resolve(root, path))) failures.push(`Missing ${path}`);
}
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      scan(path);
      continue;
    }
    if (entry.name.startsWith('.') || /\.(?:map|pem|key|pfx)$/i.test(entry.name))
      failures.push(`Unexpected publishable file: ${relative(root, path)}`);
    if (!/\.(?:html|js|css|json|txt|webmanifest|svg)$/i.test(entry.name)) continue;
    const content = readFileSync(path, 'utf8');
    if (
      /https?:\/\/(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?=[:/"'\s]|$)/i.test(
        content,
      )
    )
      failures.push(`Development URL: ${relative(root, path)}`);
    if (
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}|\bAKIA[A-Z0-9]{16}\b/.test(
        content,
      )
    )
      failures.push(`Possible credential: ${relative(root, path)}`);
  }
}
if (existsSync(root)) scan(root);
else failures.push('Build dist first');
if (existsSync(resolve(root, 'index.html'))) {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)].map((match) => match[1]);
  for (const asset of assets)
    if (!existsSync(resolve(root, `.${asset}`))) failures.push(`Broken entry asset: ${asset}`);
  if (
    !assets.some((asset) => asset.endsWith('.js')) ||
    !assets.some((asset) => asset.endsWith('.css'))
  )
    failures.push('Missing compiled entry assets');
}
const inventory = JSON.parse(readFileSync('docs/AIRLINE_ASSET_INVENTORY.json', 'utf8'));
// The integrity test validates checksums; this gate also checks the deployable file count.
const logos = existsSync(resolve(root, 'assets/airlines'))
  ? readdirSync(resolve(root, 'assets/airlines')).filter((name) => name.endsWith('.png'))
  : [];
if (logos.length !== 24) failures.push(`Expected 24 retained airline PNGs, got ${logos.length}`);
if (!inventory || statSync('docs/AIRLINE_ASSET_INVENTORY.json').size === 0)
  failures.push('Missing asset provenance inventory');
if (failures.length) {
  globalThis.console.error(failures.join('\n'));
  process.exitCode = 1;
} else
  globalThis.console.log(
    'Static build checks passed: entry assets, headers, notices, 24 logos, no detected development URLs or credential patterns. This is not a complete security audit.',
  );
