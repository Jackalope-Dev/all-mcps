import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

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
    // configDefaults covers node_modules etc.; .worktrees holds other
    // sessions' full checkouts, whose tests would otherwise run twice.
    exclude: [...configDefaults.exclude, '.worktrees/**'],
    environment: 'node',
    passWithNoTests: true,
  },
});
