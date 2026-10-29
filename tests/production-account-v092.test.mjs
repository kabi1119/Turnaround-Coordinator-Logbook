import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { productionAccount, productionConfig } from '../scripts/production-account.mjs';
const key = 'sb_publishable_synthetic_only_key',
  target = {
    url: productionAccount.url,
    publishableKeySha256: createHash('sha256').update(key).digest('hex'),
  };
const env = { VITE_SUPABASE_URL: target.url, VITE_SUPABASE_PUBLISHABLE_KEY: key };
describe('fail-closed Production Cloud Account build policy', () => {
  it('pins the reviewed Production project and public-key fingerprint without storing credentials', () => {
    expect(productionAccount.url).toBe('https://ajcaauaxrtrcktdbocaf.supabase.co');
    expect(productionAccount.publishableKeySha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('enables Cloud Account when the optional preview flag was forgotten', () => {
    expect(productionConfig(env, target)).toMatchObject({
      accountCloud: true,
      projectUrl: target.url,
    });
    expect(productionConfig({ ...env, VITE_ACCOUNT_CLOUD_V2: 'preview' }, target)).toEqual(
      productionConfig(env, target),
    );
  });
  it.each(['false', 'true', 'disabled'])('refuses an explicit downgrade flag %s', (flag) => {
    expect(() => productionConfig({ ...env, VITE_ACCOUNT_CLOUD_V2: flag }, target)).toThrow(
      'cannot be disabled',
    );
  });
  it.each([
    {},
    { ...env, VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' },
    { ...env, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' },
    { ...env, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_different_public_key' },
  ])('rejects missing, Test, privileged and mismatched credentials', (values) => {
    expect(() => productionConfig(values, target)).toThrow();
  });
});
