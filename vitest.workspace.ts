import { defineWorkspace } from 'vitest/config';

// Two projects: the node project (backend + libraries) and the jsdom web
// project. `pnpm test` at the root runs both.
export default defineWorkspace(['./vitest.config.ts', './apps/web/vitest.config.ts']);
