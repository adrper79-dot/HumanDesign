import { defineConfig, devices } from '@playwright/test';
import { loadLocalEnv } from './scripts/load-local-env.js';

loadLocalEnv();

/**
 * playwright.gate.config.ts — Deterministic release-gate suite.
 *
 * Runs only auth-gate.spec.ts and smoke-gate.spec.ts.
 * Zero retries, single worker — a flap here blocks deploy.
 *
 * Usage:
 *   npx playwright test --config playwright.gate.config.ts
 *   npm run test:gate
 *
 * Required env vars (.env.local):
 *   E2E_TEST_EMAIL    — test account email
 *   E2E_TEST_PASSWORD — test account password
 *   TEST_BASE_URL     — (optional) override; defaults to https://selfprime.net
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/auth-gate.spec.ts', '**/smoke-gate.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'gate-results.json' }],
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://selfprime.net',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],
});
