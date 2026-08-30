import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Coverage is opt-in for now (`npm run test:coverage`, used by CI);
    // thresholds land in Phase 3. lcov output feeds the Codecov upload.
    coverage: {
      include: ['src/**/*.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
