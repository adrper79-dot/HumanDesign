import { test, expect } from '@playwright/test';

const testBaseUrl = process.env.TEST_BASE_URL || 'https://selfprime.net';
const e2eEmail = process.env.E2E_TEST_EMAIL || '';
const e2ePassword = process.env.E2E_TEST_PASSWORD || '';

test('prod login test account', async ({ page }) => {
  test.skip(!e2eEmail || !e2ePassword, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD are required for live login smoke tests.');

  // Pre-seed localStorage before the page loads so the first-run modal
  // never appears — this is the most reliable way to bypass it.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('hasSeenWelcome', 'true');
      localStorage.setItem('prime_self_first_run', 'false');
      localStorage.setItem('ps_session', '1');
    } catch { /* ignore — sandboxed environments may block storage */ }
  });

  await page.goto(testBaseUrl);

  // Dismiss the welcome dialog if it appears (app may ignore the localStorage flags above).
  // Use getByRole for robustness — the modal is a semantic <dialog> element.
  const skipBtn = page.getByRole('dialog').getByRole('button', { name: /skip/i });
  await skipBtn.click({ timeout: 5000 }).catch(() => { /* modal did not appear — that's fine */ });
  // Ensure any open dialog is closed before proceeding
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

  await page.click('#authBtn');
  await page.fill('#authEmail', e2eEmail);
  await page.fill('#authPassword', e2ePassword);
  await page.click('#authSubmit');
  await expect(page.locator('#authStatusText')).not.toContainText('Not signed in');
});
