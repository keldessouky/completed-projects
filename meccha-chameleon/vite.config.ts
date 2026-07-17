import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Client lives in client/. We build it to client/dist, which the server serves.
// In dev, the client connects to the socket server on :3000 (see client/src/net.ts).
export default defineConfig({
  root: 'client',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
