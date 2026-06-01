import { defineConfig } from 'vitest/config';

// Root Vitest config. Tests live next to source as *.test.ts across the
// workspace. Workspace packages resolve to their TypeScript source (each
// package's "exports" points at src/index.ts), so no build step is needed
// to run the suite.
export default defineConfig({
  test: {
    globals: false,
    include: ['{apps,packages}/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['{apps,packages}/*/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
