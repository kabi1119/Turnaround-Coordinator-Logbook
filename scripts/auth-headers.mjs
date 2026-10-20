import { URL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
/** Preserve base headers; allow only this build's explicit HTTPS Auth/REST origin. */
export function writeAuthHeaders(origin, directory = 'dist') {
  let headers = readFileSync('public/_headers', 'utf8');
  if (origin) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin)
      throw new Error('Invalid auth CSP origin');
    headers = headers.replace("connect-src 'self';", `connect-src 'self' ${url.origin};`);
  }
  writeFileSync(resolve(directory, '_headers'), headers);
}
/** The SDK's unused development default must not enter a production static bundle. */
export function explicitAuthEndpoint(code, id) {
  if (!id.replaceAll('\\', '/').endsWith('/@supabase/auth-js/dist/module/lib/constants.js'))
    return null;
  const original = "export const GOTRUE_URL = 'http://localhost:9999';";
  if (!code.includes(original))
    throw new Error('Review Supabase default endpoint after SDK update');
  return code.replace(original, "export const GOTRUE_URL = 'https://unconfigured.invalid';");
}
