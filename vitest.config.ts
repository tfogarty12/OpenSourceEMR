import { defineConfig } from 'vitest/config';

// Root Vitest config. Tests live next to source as *.test.ts across the
// workspace. Workspace packages resolve to their TypeScript source (each
// package's "exports" points at src/index.ts), so no build step is needed
// to run the suite.
export default defineConfig({
  test: {
    name: 'node',
    environment: 'node',
    globals: false,
    // Backend/library tests only (*.test.ts). The web project (jsdom) owns
    // *.test.tsx — see vitest.workspace.ts.
    include: ['{apps,packages}/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['{apps,packages}/*/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
