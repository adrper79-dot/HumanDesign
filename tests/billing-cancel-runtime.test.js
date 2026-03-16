/**
 * Billing Cancel — Runtime Smoke Tests
 *
 * These tests hit the real API. They are skipped unless BILLING_TEST_TOKEN is set.
 * Run with:
 *   BILLING_TEST_TOKEN=<bearer_token> npx vitest run tests/billing-cancel-runtime.test.js
 */

import { describe, it, expect } from 'vitest';

const API = 'https://prime-self-api.adrper79.workers.dev';

describe.skipIf(!process.env.BILLING_TEST_TOKEN)('billing cancel — runtime smoke tests', () => {
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.BILLING_TEST_TOKEN}`,
  };

  it('cancel preview returns retention offer without canceling', async () => {
    const res = await fetch(`${API}/api/billing/cancel`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ previewOnly: true }),
    });

    // 200 if user has an active subscription, 400 if user has none — both are valid
    expect([200, 400]).toContain(res.status);

    if (res.status === 200) {
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.previewOnly).toBe(true);
      // retentionOffer is null for free-tier users, object for paid
      expect(json).toHaveProperty('retentionOffer');
      expect(json).toHaveProperty('subscription');
    }
  });

  it('unauthenticated cancel returns 401', async () => {
    const res = await fetch(`${API}/api/billing/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previewOnly: true }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });

  it('invalid JSON body returns 400', async () => {
    const res = await fetch(`${API}/api/billing/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BILLING_TEST_TOKEN}`,
      },
      // Send malformed JSON
      body: 'not-valid-json{{',
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });
});
