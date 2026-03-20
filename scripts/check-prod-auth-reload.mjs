import { writeFileSync } from 'fs';
import { chromium } from 'playwright';
import { loadLocalEnv } from './load-local-env.js';

loadLocalEnv();

const baseUrl = process.env.TEST_BASE_URL || 'https://selfprime.net';
const email = process.env.E2E_TEST_EMAIL || '';
const password = process.env.E2E_TEST_PASSWORD || '';

if (!email || !password) {
  const result = { ok: false, error: 'Missing E2E credentials' };
  writeFileSync('prod-auth-reload-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}

async function dismissClosableDialog(page) {
  const firstRunModal = page.locator('#first-run-modal');
  if (await firstRunModal.isVisible({ timeout: 1500 }).catch(() => false)) {
    const dismiss = firstRunModal.getByRole('button', { name: /skip for now|skip|close|maybe later|continue/i });
    if (await dismiss.isVisible({ timeout: 1500 }).catch(() => false)) {
      await dismiss.click();
      await firstRunModal.waitFor({ state: 'hidden', timeout: 5000 });
      return;
    }

    throw new Error('First-run modal is visible without a dismiss action');
  }
}

async function textOrEmpty(locator) {
  return ((await locator.textContent().catch(() => '')) || '').trim();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
let loginResponse = null;
const consoleMessages = [];
const pageErrors = [];

page.on('console', (message) => {
  consoleMessages.push({ type: message.type(), text: message.text() });
});

page.on('pageerror', (error) => {
  pageErrors.push(error.message);
});

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await dismissClosableDialog(page);

  await page.click('#authBtn');
  await page.fill('#authEmail', email);
  await page.fill('#authPassword', password);
  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
    { timeout: 15000 }
  ).catch(() => null);
  await page.click('#authSubmit');
  const loginResponseRaw = await loginResponsePromise;
  if (loginResponseRaw) {
    let loginBody = null;
    try {
      loginBody = await loginResponseRaw.json();
    } catch {
      loginBody = await loginResponseRaw.text().catch(() => null);
    }
    loginResponse = {
      url: loginResponseRaw.url(),
      status: loginResponseRaw.status(),
      ok: loginResponseRaw.ok(),
      body: loginBody,
    };
  }

  const authStatus = page.locator('#authStatusText');
  await page.waitForFunction(() => {
    const el = document.querySelector('#authStatusText');
    return el && !/not signed in/i.test(el.textContent || '');
  }, { timeout: 15000 });

  const beforeReload = await textOrEmpty(authStatus);
  await page.reload({ waitUntil: 'networkidle' });

  await page.waitForTimeout(2000);
  const afterReload = await textOrEmpty(authStatus);
  const logoutVisible = await page.locator('#logoutBtn').isVisible().catch(() => false);

  const ok = !!beforeReload && !!afterReload && !/not signed in/i.test(afterReload) && logoutVisible;
  const result = {
    ok,
    loginResponse,
    beforeReload,
    afterReload,
    logoutVisible,
    url: page.url(),
    authErrorText: await textOrEmpty(page.locator('#authError')),
    pageErrors,
    consoleMessages,
  };
  writeFileSync('prod-auth-reload-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  process.exit(ok ? 0 : 1);
} catch (error) {
  const result = {
    ok: false,
    error: error.message,
    loginResponse,
    url: page.url(),
    authStatusText: await textOrEmpty(page.locator('#authStatusText')),
    authErrorText: await textOrEmpty(page.locator('#authError')),
    pageErrors,
    consoleMessages,
  };
  writeFileSync('prod-auth-reload-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
} finally {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}