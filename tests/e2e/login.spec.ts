import { test, expect } from '@playwright/test';

test('prod login test account', async ({ page }) => {
  await page.goto('https://selfprime.net/');

  // Dismiss first-run modal if it appears
  const skipBtn = page.locator('#first-run-modal button:has-text("Skip")');
  await skipBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await skipBtn.isVisible()) {
    await skipBtn.click();
    await page.locator('#first-run-modal').waitFor({ state: 'hidden', timeout: 3000 });
  }

  await page.click('#authBtn');
  await page.fill('#authEmail', 'adrper79@gmail.com');
  await page.fill('#authPassword', '123qweASD');
  await page.click('#authSubmit');
  await expect(page.locator('#authStatusText')).toContainText('adrper79');
});
