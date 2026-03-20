import { test, expect } from '@playwright/test';

/**
 * smoke-gate.spec.ts — Browser smoke checks for the release gate.
 *
 * These tests require NO credentials and perform NO login. They verify that
 * the public-facing deployment is working: page loads, API health endpoint,
 * and key navigation elements are present. All must pass before every deploy.
 *
 * Auth coverage lives in auth-gate.spec.ts.
 * Onboarding coverage lives in onboarding.spec.ts.
 */

const baseUrl    = process.env.TEST_BASE_URL || 'https://selfprime.net';
const workerBase = process.env.PROD_API       || 'https://prime-self-api.adrper79.workers.dev';

test.describe('Browser smoke — no auth required', () => {
  test('public homepage loads with correct title', async ({ page, context }) => {
    // Suppress modal so snapshot is clean regardless of localStorage state.
    await context.addInitScript(() => {
      try { localStorage.setItem('primeself_frm_seen', '1'); } catch (_) {}
    });

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle(/Prime Self/i);
    await expect(page.locator('body')).toContainText(/Prime Self/i);
  });

  test('API health endpoint returns 200 + ok status', async ({ request }) => {
    const res = await request.get(`${workerBase}/api/health`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.version).toBe('string');
  });

  test('same-origin health endpoint is reachable via the frontend domain', async ({ request }) => {
    const res = await request.get(`${baseUrl}/api/health`);
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('navigation header is visible on page load', async ({ page, context }) => {
    await context.addInitScript(() => {
      try { localStorage.setItem('primeself_frm_seen', '1'); } catch (_) {}
    });

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    // Main header / nav must be present — confirms core HTML rendered correctly.
    const header = page.locator('header, [role="banner"]');
    await expect(header).toBeVisible({ timeout: 5000 });
  });

  test('Sign In button is reachable without authentication', async ({ page, context }) => {
    await context.addInitScript(() => {
      try { localStorage.setItem('primeself_frm_seen', '1'); } catch (_) {}
    });

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const signInBtn = page.locator('#authBtn, button:text("Sign In")').first();
    await expect(signInBtn).toBeVisible({ timeout: 5000 });
  });
});
