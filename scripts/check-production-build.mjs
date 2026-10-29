import { verifyProductionBuild } from './production-account.mjs';
import process from 'node:process';
try {
  const manifest = verifyProductionBuild();
  globalThis.console.log(
    'Production release verified: v' +
      manifest.version +
      ', Account Cloud enabled, matching Production project/key fingerprint and CSP.',
  );
} catch {
  globalThis.console.error(
    'FAIL: Production artifact identity/Account Cloud verification failed. Do not deploy. No credentials logged.',
  );
  process.exitCode = 1;
}
