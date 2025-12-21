// vitest.config.unit.ts
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['test/unit/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./test/setup.unit.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
