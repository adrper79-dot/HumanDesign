import { test, expect } from '@playwright/test';

/**
 * onboarding.spec.ts — First-run onboarding modal coverage.
 *
 * Isolated from auth smoke. Tests modal show/hide behaviour for a fresh
 * visitor (no localStorage), Skip flow, and Begin flow. Does not require
 * authenticated credentials.
 */

const baseUrl = process.env.TEST_BASE_URL || 'https://selfprime.net';

test.describe('First-run onboarding modal', () => {
  test.beforeEach(async ({ context }) => {
    // Ensure localStorage is empty — fresh visitor state.
    // (Playwright uses a fresh context per test by default; this is explicit.)
    await context.clearCookies();
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('primeself_frm_seen');
        localStorage.removeItem('ps_hasSeenOnboarding');
      } catch (_) {}
    });
  });

  test('modal appears for a fresh visitor after 1 second', async ({ page }) => {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    // Modal starts hidden; waits 800 ms before showing.
    const modal = page.locator('#first-run-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(modal).toContainText('Welcome to Prime Self');
  });

  test('"Skip for now" closes the modal and marks it seen', async ({ page }) => {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const modal = page.locator('#first-run-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Click skip
    await page.click('[data-action="frmClose"], .frm-skip-btn');

    // Modal must be hidden
    await expect(modal).toBeHidden({ timeout: 3000 });

    // localStorage must now have the seen flag so it won't re-appear on reload
    const seen = await page.evaluate(() => localStorage.getItem('primeself_frm_seen'));
    expect(seen).toBe('1');
  });

  test('"Begin my reading" advances to step 2', async ({ page }) => {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const modal = page.locator('#first-run-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });

    await page.click('[data-action="frmNext"], .frm-btn-next');

    // Step 2 contains a birth-date input
    await expect(page.locator('#w-date, #frm-step-2')).toBeVisible({ timeout: 3000 });
  });

  test('modal does NOT reappear on page reload after being dismissed', async ({ page }) => {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const modal = page.locator('#first-run-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await page.click('[data-action="frmClose"], .frm-skip-btn');
    await expect(modal).toBeHidden({ timeout: 3000 });

    // Reload — modal must stay hidden
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Wait briefly past the 800ms show-delay to confirm it's still hidden
    await page.waitForTimeout(1500);
    await expect(modal).toBeHidden();
  });
});
