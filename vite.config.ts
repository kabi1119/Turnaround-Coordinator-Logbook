import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync } from 'node:fs';
export default defineConfig({
  server: { watch: { ignored: ['**/.checkpoints/**', '**/.wrangler/**'] } },
  define: {
    __LOCAL_AIRLINE_FILES__: JSON.stringify(
      readdirSync(new URL('./public/assets/airlines/', import.meta.url)).filter((name) =>
        /^[A-Z0-9]{2}\.png$/.test(name),
      ),
    ),
  },
  plugins: [
    react(),
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
});
