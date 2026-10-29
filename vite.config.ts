import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { authConfig } from './src/auth/config';
import { writeAuthHeaders, explicitAuthEndpoint } from './scripts/auth-headers.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { buildOffline } from './scripts/build-offline.mjs';
import { productionConfig } from './scripts/production-account.mjs';
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const production = command === 'build' && mode === 'production' ? productionConfig(env) : null;
  const auth = authConfig(env);
  return {
    server: { watch: { ignored: ['**/.checkpoints/**', '**/.wrangler/**'] } },
    define: {
      ...(production ? { 'import.meta.env.VITE_ACCOUNT_CLOUD_V2': JSON.stringify('preview') } : {}),
      __LOCAL_AIRLINE_FILES__: JSON.stringify(
        readdirSync(new URL('./public/assets/airlines/', import.meta.url)).filter((name) =>
          /^[A-Z0-9]{2}\.png$/.test(name),
        ),
      ),
    },
    plugins: [
      react(),
      {
        name: 'verified-production-release',
        apply: 'build',
        generateBundle() {
          if (production)
            this.emitFile({
              type: 'asset',
              fileName: 'release.json',
              source: JSON.stringify({
                version: JSON.parse(readFileSync('package.json', 'utf8')).version,
                ...production,
              }),
            });
        },
      },
      { name: 'explicit-supabase-endpoint', apply: 'build', transform: explicitAuthEndpoint },
      {
        name: 'offline-shell',
        apply: 'build',
        closeBundle() {
          writeAuthHeaders(auth?.url);
          buildOffline();
        },
      },
      {
        name: 'third-party-notices',
        apply: 'build',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'THIRD_PARTY_NOTICES.txt',
            source: readFileSync(new URL('./THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8'),
          });
        },
      },
    ],
    test: { environment: 'jsdom', setupFiles: './tests/setup.ts', css: false },
  };
});
