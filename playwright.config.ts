import { defineConfig, devices } from '@playwright/test';
import { loadLocalEnv } from './scripts/load-local-env.js';

loadLocalEnv();

const wsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT;
const baseURL = process.env.TEST_BASE_URL || 'https://selfprime.net';
const shouldStartWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...(wsEndpoint ? { connectOptions: { wsEndpoint } } : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],
  ...(shouldStartWebServer ? {
    webServer: {
      command: 'npx serve frontend -l 3000',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
    },
  } : {}),
});