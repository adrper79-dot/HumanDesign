import { test, expect } from '@playwright/test';

test('prod login test account', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars required');

  await page.goto('https://selfprime.net/');
  await page.click('#authBtn');
  await page.fill('#authEmail', email);
  await page.fill('#authPassword', password);
  await page.click('#authSubmit');
  await expect(page.locator('#authStatusText')).toContainText(email.split('@')[0]);
});
