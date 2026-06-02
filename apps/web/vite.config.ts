import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies API paths to the backend so the SPA can call same-origin
// paths (and tokens/headers pass straight through).
const apiTarget = process.env.API_URL ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/fhir': apiTarget,
      '/auth': apiTarget,
      '/admin': apiTarget,
      '/health': apiTarget,
    },
  },
});
