// Flat ESLint config for the monorepo.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // Clinical code should be explicit; unused vars usually signal a mistake.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` erodes the type guarantees we rely on for safety. Warn, don't block,
      // while the skeleton is young; tighten to "error" as the codebase matures.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // The web app runs in the browser, not Node.
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
);
