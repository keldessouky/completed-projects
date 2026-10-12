import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { target: 'es2022' },
  server: { port: 5180 },
  preview: { port: 4180 },
  test: { environment: 'node', testTimeout: 60_000 },
});
