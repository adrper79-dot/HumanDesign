const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://selfprime.net';
const EMAIL = 'adrper79@gmail.com';
const PASSWORD = '123qweASD';

async function text(locator) {
  try { return ((await locator.textContent({ timeout: 3000 })) || '').trim(); } catch { return ''; }
}
async function vis(locator) {
  try { return await locator.isVisible({ timeout: 1500 }); } catch { return false; }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const result = { ok: true, steps: [], pageErrors: [], consoleMessages: [], failedRequests: [], apiResponses: [] };

  page.on('pageerror', (err) => result.pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') result.consoleMessages.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('requestfailed', (req) => result.failedRequests.push({ url: req.url(), error: req.failure()?.errorText }));
  page.on('response', async (res) => {
    const url = res.url();
    if (/\/api\/(auth\/me|billing\/subscription|practitioner\/)/.test(url)) {
      let body = null;
      try { body = await res.json(); } catch {}
      result.apiResponses.push({ url, status: res.status(), body });
    }
  });

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 });
  result.steps.push('loaded-home');

  const firstRunModal = page.locator('#first-run-modal');
  if (await vis(firstRunModal)) {
    const skip = firstRunModal.locator('button:has-text("Skip"), [data-action="closeFirstRunModal"], button:has-text("Continue")').first();
    if (await vis(skip)) {
      await skip.click();
      result.steps.push('dismissed-first-run');
    }
  }

  await page.click('#authBtn', { timeout: 10000 });
  await page.fill('#authEmail', EMAIL);
  await page.fill('#authPassword', PASSWORD);
  await page.click('#authSubmit');
  await page.waitForTimeout(3000);
  result.authStatusText = await text(page.locator('#authStatusText'));
  result.steps.push('submitted-login');

  const practitionerTab = page.locator('[data-tab="practitioner"], [data-action="switchTab"][data-arg0="practitioner"]').first();
  if (await vis(practitionerTab)) {
    await practitionerTab.click();
    await page.waitForTimeout(1500);
    result.steps.push('opened-practitioner-tab');
  } else {
    result.steps.push('practitioner-tab-not-found');
  }

  result.practitioner = {
    tabVisible: await vis(page.locator('#tab-practitioner')),
    upgradeNoticeVisible: await vis(page.locator('#practitionerUpgradeNotice')),
    upgradeNoticeText: await text(page.locator('#practitionerUpgradeNotice')),
    reviewsCardVisible: await vis(page.locator('#reviewsModerationCard')),
    referralStatsVisible: await vis(page.locator('#pracReferralStats')),
    metricsCardVisible: await vis(page.locator('#pracMetricsCard')),
    directoryCardVisible: await vis(page.locator('#pracDirectoryCard'))
  };

  const upgradeButton = page.locator('[data-action="openPractitionerPricingModal"]').first();
  if (await vis(upgradeButton)) {
    await upgradeButton.click();
    await page.waitForTimeout(700);
    result.practitioner.pricingModalVisible = await vis(page.locator('#practitionerPricingOverlay'));
    result.practitioner.pricingModalHeadline = await text(page.locator('#upgradeContextHeadline'));
    result.steps.push('opened-practitioner-pricing');
  } else {
    result.practitioner.pricingModalVisible = false;
    result.practitioner.pricingModalHeadline = '';
    result.steps.push('practitioner-upgrade-button-not-found');
  }

  const compositeTab = page.locator('[data-tab="composite"], [data-action="switchTab"][data-arg0="composite"]').first();
  if (await vis(compositeTab)) {
    await compositeTab.click();
    await page.waitForTimeout(1200);
    result.steps.push('opened-composite-tab');
  } else {
    result.steps.push('composite-tab-not-found');
  }

  result.composite = {
    tabVisible: await vis(page.locator('#tab-composite')),
    pricingModalVisible: await vis(page.locator('#practitionerPricingOverlay')),
    pricingModalHeadline: await text(page.locator('#upgradeContextHeadline')),
    activeTabText: await text(page.locator('#tab-composite'))
  };

  await browser.close();
  fs.writeFileSync('postdeploy_locked_practitioner_browser_pass.json', JSON.stringify(result, null, 2));
})();
