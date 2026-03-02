import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'vmForks',
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
