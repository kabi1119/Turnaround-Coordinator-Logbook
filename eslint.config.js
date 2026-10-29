import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';
export default ts.config(
  { ignores: ['dist', 'node_modules', '.wrangler', '.checkpoints'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: [
      'scripts/check-sync-isolation.mjs',
      'scripts/check-sync-migrations.mjs',
      'scripts/check-account-migrations.mjs',
      'scripts/check-account-isolation.mjs',
      'tests/account-rest-guards-v090.test.mjs',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': hooks, 'react-refresh': refresh },
    rules: {
      ...hooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
