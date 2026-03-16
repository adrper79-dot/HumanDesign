import { test, expect } from '@playwright/test';

async function bypassFirstRun(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('hasSeenWelcome', 'true');
      localStorage.setItem('prime_self_first_run', 'false');
      localStorage.setItem('ps_session', '1');
    } catch {
      // ignore storage failures in hardened browsers
    }
  });
}

async function dismissAnyDialog(page) {
  try {
    const dialog = page.getByRole('dialog');
    const dismiss = dialog.getByRole('button', { name: /skip|continue|close|maybe later/i });
    if (await dismiss.isVisible({ timeout: 1000 }).catch(() => false)) {
      await dismiss.click();
    }
  } catch {
    // no modal present
  }
}

test('directory listing routes into public profile and exposes chart plus booking handoff', async ({ page, request }) => {
  const apiResponse = await request.get('https://prime-self-api.adrper79.workers.dev/api/directory?limit=10');
  expect(apiResponse.ok()).toBeTruthy();

  const apiPayload = await apiResponse.json();
  const practitioners = Array.isArray(apiPayload?.practitioners) ? apiPayload.practitioners : [];
  const practitioner = practitioners.find((entry: any) => typeof entry?.slug === 'string' && entry.slug && typeof entry?.display_name === 'string');

  test.skip(!practitioner, 'No public practitioner with a slug is available to verify the live directory journey.');

  await bypassFirstRun(page);
  await page.goto('https://selfprime.net/');
  await dismissAnyDialog(page);

  await page.locator('[data-tab="directory"]').click();
  await page.locator('#directoryResults').waitFor({ state: 'visible', timeout: 15000 });

  const viewProfileLink = page.locator(`#directoryResults a[href="/practitioners/${practitioner.slug}"]`).first();
  await expect(viewProfileLink).toBeVisible({ timeout: 15000 });
  await viewProfileLink.click();

  await expect(page).toHaveURL(new RegExp(`/practitioners/${practitioner.slug}$`), { timeout: 15000 });
  await expect(page.getByText(practitioner.display_name, { exact: false })).toBeVisible({ timeout: 15000 });

  const chartEntry = page.locator(`a[href*="/?ref=${practitioner.slug}"]`).first();
  await expect(chartEntry).toBeVisible({ timeout: 15000 });

  if (typeof practitioner.booking_url === 'string' && /^https?:\/\//i.test(practitioner.booking_url)) {
    const bookingLink = page.locator(`a[href="${practitioner.booking_url}"]`).first();
    await expect(bookingLink).toBeVisible({ timeout: 15000 });
  }
});