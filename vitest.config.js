import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'vmForks',
    testTimeout: 30000,
    hookTimeout: 30000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html'],
    thresholds: { lines: 80 },
  },
});
