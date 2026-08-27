import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './'),
    },
  },
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    environment: 'node',
    passWithNoTests: true,
  },
});
