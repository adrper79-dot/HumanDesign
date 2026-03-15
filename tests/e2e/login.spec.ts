import { test, expect } from '@playwright/test';

test('prod login test account', async ({ page }) => {
  await page.goto('https://selfprime.net/');
  await page.keyboard.press('Escape'); // dismiss first-run modal
  await page.click('#authBtn');
  await page.fill('#authEmail', 'adrper79@gmail.com');
  await page.fill('#authPassword', '123qweASD');
  await page.click('#authSubmit');
  await expect(page.locator('#authStatusText')).toContainText('adrper79');
});
