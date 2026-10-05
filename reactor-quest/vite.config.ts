import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { pwa } from './tools/pwa.mjs';

export default defineConfig({
  plugins: [react(), pwa()],
  base: './',
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 12_000, // the TypeScript compiler is one big, lazily loaded chunk
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
