import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Coverage is opt-in for now (`npm run test:coverage`, used by CI).
    // lcov output feeds the Codecov upload. `src/types.ts` is declarations
    // only and cannot accumulate runtime coverage.
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
  },
});
