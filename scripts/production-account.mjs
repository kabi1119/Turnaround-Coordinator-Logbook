import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
/** Reviewed public deployment identity. No API credential is stored here. Rotation requires review. */
export const productionAccount = Object.freeze({
  url: 'https://ajcaauaxrtrcktdbocaf.supabase.co',
  publishableKeySha256: 'f86cef23e3d7c4935f60a96af233342e5342507d5ca0e0a052ac0895493ab895',
});
const hash = (value) => createHash('sha256').update(value).digest('hex');
export function productionConfig(env, target = productionAccount) {
  if (
    env.VITE_ACCOUNT_CLOUD_V2 !== undefined &&
    env.VITE_ACCOUNT_CLOUD_V2 !== '' &&
    env.VITE_ACCOUNT_CLOUD_V2 !== 'preview'
  )
    throw Error('Production Account Cloud cannot be disabled.');
  if (
    env.VITE_SUPABASE_URL?.replace(/\/$/, '') !== target.url ||
    !/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(env.VITE_SUPABASE_PUBLISHABLE_KEY || '') ||
    hash(env.VITE_SUPABASE_PUBLISHABLE_KEY) !== target.publishableKeySha256
  )
    throw Error('Production project/publishable key mismatch or missing. No build allowed.');
  return {
    accountCloud: true,
    projectUrl: target.url,
    publishableKeySha256: target.publishableKeySha256,
  };
}
export function verifyProductionBuild(directory = 'dist') {
  const manifest = JSON.parse(readFileSync(resolve(directory, 'release.json'), 'utf8'));
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  if (
    manifest.version !== version ||
    manifest.accountCloud !== true ||
    manifest.projectUrl !== productionAccount.url ||
    manifest.publishableKeySha256 !== productionAccount.publishableKeySha256
  )
    throw Error('Production release manifest mismatch.');
  const js = readdirSync(resolve(directory, 'assets'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(resolve(directory, 'assets', f), 'utf8'))
    .join('\n');
  const origins = [...new Set(js.match(/https:\/\/[a-z0-9]{20}\.supabase\.co/g) || [])];
  const keys = [...new Set(js.match(/sb_publishable_[A-Za-z0-9_-]{10,}/g) || [])];
  if (
    origins.length !== 1 ||
    origins[0] !== productionAccount.url ||
    keys.length !== 1 ||
    hash(keys[0]) !== productionAccount.publishableKeySha256 ||
    !/VITE_ACCOUNT_CLOUD_V2["']?\s*:\s*["']preview["']/.test(js) ||
    !js.includes('v' + version)
  )
    throw Error('Production bundle does not match enabled Cloud Account release.');
  if (
    !readFileSync(resolve(directory, '_headers'), 'utf8').includes(
      "connect-src 'self' " + productionAccount.url + ';',
    )
  )
    throw Error('Production CSP mismatch.');
  return manifest;
}
