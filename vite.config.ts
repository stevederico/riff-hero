import { defineConfig } from 'vitest/config';

const DEV_PORT = 5187;

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: DEV_PORT, strictPort: true },
  preview: { host: '127.0.0.1', port: DEV_PORT + 1, strictPort: true },
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
