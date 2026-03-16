import { test, expect } from '@playwright/test';

test('prod login test account', async ({ page }) => {
  // Pre-seed localStorage before the page loads so the first-run modal
  // never appears — this is the most reliable way to bypass it.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('hasSeenWelcome', 'true');
      localStorage.setItem('prime_self_first_run', 'false');
      localStorage.setItem('ps_session', '1');
    } catch { /* ignore — sandboxed environments may block storage */ }
  });

  await page.goto('https://selfprime.net/');

  // Dismiss the welcome dialog if it appears (app may ignore the localStorage flags above).
  // Use getByRole for robustness — the modal is a semantic <dialog> element.
  const skipBtn = page.getByRole('dialog').getByRole('button', { name: /skip/i });
  await skipBtn.click({ timeout: 5000 }).catch(() => { /* modal did not appear — that's fine */ });
  // Ensure any open dialog is closed before proceeding
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

  await page.click('#authBtn');
  await page.fill('#authEmail', 'adrper79@gmail.com');
  await page.fill('#authPassword', '123qweASD');
  await page.click('#authSubmit');
  await expect(page.locator('#authStatusText')).toContainText('adrper79');
});
