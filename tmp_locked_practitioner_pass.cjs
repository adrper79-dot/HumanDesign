const { chromium } = require('playwright');

(async () => {
  const pageErrors = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('https://selfprime.net', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);

  const firstRunModal = page.locator('#first-run-modal');
  if (await firstRunModal.isVisible({ timeout: 1500 }).catch(() => false)) {
    const skip = firstRunModal.locator('button:has-text("Skip"), [data-action="closeFirstRunModal"], button:has-text("Continue")').first();
    if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skip.click();
    }
  }

  await page.click('#authBtn', { timeout: 10000 });
  await page.fill('#authEmail', 'adrper79@gmail.com');
  await page.fill('#authPassword', '123qweASD');
  await page.click('#authSubmit');
  await page.waitForTimeout(3000);

  const practitionerTab = page.locator('[data-tab="practitioner"], [data-action="switchTab"][data-arg0="practitioner"]').first();
  const compositeTab = page.locator('[data-tab="composite"], [data-action="switchTab"][data-arg0="composite"]').first();
  const result = {
    pageErrors,
    authStatusText: ((await page.locator('#authStatusText').textContent().catch(() => '')) || '').trim(),
    practitionerTabVisible: await practitionerTab.isVisible().catch(() => false),
    practitionerUpgradeNoticeText: ((await page.locator('#practitionerUpgradeNotice').textContent().catch(() => '')) || '').trim(),
    compositeTabVisible: await compositeTab.isVisible().catch(() => false)
  };

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
