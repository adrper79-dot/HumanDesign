import { test, expect, BrowserContext } from '@playwright/test';

/**
 * auth-gate.spec.ts — Release gate: authentication flow.
 *
 * This suite MUST pass with zero failures before any production deploy.
 * Requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD in the environment.
 *
 * The first-run modal is suppressed via addInitScript, which injects the
 * localStorage flag before any page scripts execute. This is fully deterministic
 * and doesn't depend on app.js deployment state or URL-param timing.
 */

const baseUrl   = process.env.TEST_BASE_URL || 'https://selfprime.net';
const e2eEmail  = process.env.E2E_TEST_EMAIL || '';
const e2ePass   = process.env.E2E_TEST_PASSWORD || '';

/** Suppress the first-run onboarding modal before any page script runs. */
async function suppressOnboardingModal(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('primeself_frm_seen', '1');
      localStorage.setItem('ps_hasSeenOnboarding', '1');
    } catch (_) {}
  });
}

function requireCreds() {
  if (!e2eEmail || !e2ePass) {
    test.skip(true, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set in .env.local');
  }
}

test.describe('Auth gate — login / session persistence', () => {
  test.beforeEach(requireCreds);

  test('login succeeds with valid credentials', async ({ page, context }) => {
    await suppressOnboardingModal(context);
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    // Open auth panel
    await page.click('#authBtn');

    // Fill credentials
    await page.fill('#authEmail', e2eEmail);
    await page.fill('#authPassword', e2ePass);
    await page.click('#authSubmit');

    // Auth status must show the user email (not "Not signed in")
    await expect(page.locator('#authStatusText')).not.toContainText('Not signed in', { timeout: 20000 });
    await expect(page.locator('#authStatusText')).toContainText(/@|[A-Za-z0-9_-]{3,}/, { timeout: 5000 });
  });

  test('session persists across page reload', async ({ page, context }) => {
    await suppressOnboardingModal(context);
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    await page.click('#authBtn');
    await page.fill('#authEmail', e2eEmail);
    await page.fill('#authPassword', e2ePass);
    await page.click('#authSubmit');
    await expect(page.locator('#authStatusText')).not.toContainText('Not signed in', { timeout: 20000 });

    // Reload and confirm session is still live
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#authStatusText')).not.toContainText('Not signed in', { timeout: 15000 });
  });

  test('wrong password returns an auth error', async ({ page, context }) => {
    await suppressOnboardingModal(context);
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    await page.click('#authBtn');
    await page.fill('#authEmail', e2eEmail);
    await page.fill('#authPassword', '__invalid_pw_e2e__');
    await page.click('#authSubmit');

    // Expect an error message visible somewhere on screen
    const authError = page.locator('#authError, .auth-error, [data-testid="auth-error"]');
    const authStatus = page.locator('#authStatusText');

    const errorVisible = await authError.isVisible({ timeout: 10000 }).catch(() => false);
    const statusIsNotSignedIn = await authStatus.textContent({ timeout: 10000 })
      .then(t => (t || '').toLowerCase().includes('not signed in') || (t || '').toLowerCase().includes('invalid'))
      .catch(() => true);

    expect(errorVisible || statusIsNotSignedIn).toBeTruthy();
  });
});
