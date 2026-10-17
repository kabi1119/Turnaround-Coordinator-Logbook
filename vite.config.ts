import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
export default defineConfig({
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
