import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './'),
    },
  },
  test: {
    // .mjs is included so the plain-Node scripts in scripts/ can be tested;
    // they cannot import the TS libs, so their logic would otherwise be uncovered.
    include: ['**/*.test.ts', '**/*.test.tsx', '**/*.test.mjs'],
    environment: 'node',
    passWithNoTests: true,
  },
});
