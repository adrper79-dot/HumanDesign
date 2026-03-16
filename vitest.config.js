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
      '.claude/worktrees/**',
    ],
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html'],
    thresholds: {
      lines: 60,
      functions: 60,
      branches: 50,
    },
    exclude: ['tests/e2e/**', 'frontend/**', 'scripts/**'],
  },
});
