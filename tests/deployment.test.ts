import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'tco-static-check-'));
  roots.push(root);
  mkdirSync(join(root, 'dist/assets/airlines'), { recursive: true });
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'docs/AIRLINE_ASSET_INVENTORY.json'), '{}');
  for (const name of [
    '_headers',
    'robots.txt',
    'manifest.webmanifest',
    'airplane.svg',
    'THIRD_PARTY_NOTICES.txt',
    'sw.js',
  ])
    writeFileSync(join(root, 'dist', name), 'fixture');
  for (let n = 0; n < 24; n++)
    writeFileSync(join(root, `dist/assets/airlines/${n}.png`), 'fixture');
  writeFileSync(
    join(root, 'dist/index.html'),
    '<script src="/assets/app.js"></script><link href="/assets/app.css">',
  );
  writeFileSync(join(root, 'dist/assets/app.js'), '');
  writeFileSync(join(root, 'dist/assets/app.css'), '');
  return root;
}
const check = (root: string) =>
  spawnSync(process.execPath, [resolve('scripts/check-static-build.mjs')], {
    cwd: root,
    encoding: 'utf8',
  });

describe('static deployment boundary', () => {
  it('serves the existing SPA build without a Worker backend or database bindings', () => {
    const parsed = ts.parseConfigFileTextToJson(
      'wrangler.jsonc',
      readFileSync('wrangler.jsonc', 'utf8'),
    );
    expect(parsed.error).toBeUndefined();
    const config = parsed.config;
    expect(config.assets).toEqual({
      directory: './dist',
      not_found_handling: 'single-page-application',
    });
    for (const key of ['main', 'd1_databases', 'kv_namespaces', 'vars'])
      expect(config).not.toHaveProperty(key);
  });
  it('allows same-origin worker assets and layout styles but disallows inline scripts and embedding', () => {
    const headers = readFileSync('public/_headers', 'utf8');
    expect(headers).toContain("style-src 'self' 'unsafe-inline'");
    expect(headers).toContain("script-src 'self';");
    expect(headers).toContain("connect-src 'self'");
    expect(headers).toContain("worker-src 'self'");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('X-Robots-Tag: noindex');
  });
  it('accepts a complete static build', () => {
    expect(check(fixture()).status).toBe(0);
  });
  it.each(['http://localhost:5173/', 'http://192.168.1.2:5173/', 'http://172.16.0.1/'])(
    'blocks accidental development endpoint %s',
    (url) => {
      const root = fixture();
      writeFileSync(join(root, 'dist/assets/app.js'), `const endpoint=${JSON.stringify(url)}`);
      expect(check(root).status).toBe(1);
    },
  );
  it('blocks missing entry assets and source maps', () => {
    const root = fixture();
    rmSync(join(root, 'dist/assets/app.js'));
    writeFileSync(join(root, 'dist/assets/app.js.map'), '{}');
    const result = check(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Broken entry asset');
    expect(result.stderr).toContain('Unexpected publishable file');
  });
  it('detects credential patterns without printing their values', () => {
    const root = fixture();
    const credential = 'ghp_' + 'x'.repeat(36);
    writeFileSync(join(root, 'dist/assets/app.js'), credential);
    const result = check(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Possible credential');
    expect(result.stderr).not.toContain(credential);
  });
});
