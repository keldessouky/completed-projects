import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built bundle works from any static host or subdirectory.
  base: './',
  build: {
    target: 'es2020',
    // Keep the audio sprite as a real file (streamed decode) rather than a
    // multi-megabyte base64 inline; everything else small stays inlined.
    assetsInlineLimit: 8192,
    chunkSizeWarningLimit: 1600,
  },
  server: { host: true },
  preview: { host: true },
});
