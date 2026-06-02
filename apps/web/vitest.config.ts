import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Web test project: jsdom + React. Tests are named *.test.tsx so the root
// (node) Vitest project, which only matches *.test.ts, never picks them up.
export default defineConfig({
  plugins: [react()],
  test: {
    name: 'web',
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.tsx'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
