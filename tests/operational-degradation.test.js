import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, trackEventMock, trackOperationalDegradationMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  trackEventMock: vi.fn().mockResolvedValue(undefined),
  trackOperationalDegradationMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../workers/src/db/queries.js', async () => {
  const actual = await vi.importActual('../workers/src/db/queries.js');
  return {
    ...actual,
    createQueryFn: vi.fn(() => queryMock),
  };
});

vi.mock('../workers/src/lib/analytics.js', async () => {
  const actual = await vi.importActual('../workers/src/lib/analytics.js');
  return {
    ...actual,
    trackEvent: trackEventMock,
    trackOperationalDegradation: trackOperationalDegradationMock,
  };
});

import { EVENTS } from '../workers/src/lib/analytics.js';
import { enforceUsageQuota } from '../workers/src/middleware/tierEnforcement.js';
import { handleSubscriptionUpdated } from '../workers/src/handlers/stripe-webhook.js';

describe('operational degradation signals', () => {
  beforeEach(() => {
    queryMock.mockReset();
    trackEventMock.mockClear();
    trackOperationalDegradationMock.mockClear();
  });

  // TODO CFO-003 / CTO-003: trackOperationalDegradation not yet implemented in analytics.js
  it.skip('emits a durable degradation event when email verification check fails open', async () => {
    queryMock
      .mockRejectedValueOnce(new Error('column "email_verified" does not exist'))
      .mockResolvedValueOnce({ rows: [{ lifetime_access: false, transit_pass_expires: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ net_usage: '1', quota_exceeded: false }] });

    const request = new Request('https://api.test/api/profile/generate', { method: 'POST' });
    request._user = { sub: 'user-123' };

    const env = { NEON_CONNECTION_STRING: 'postgres://test' };
    const result = await enforceUsageQuota(request, env, 'profile_generation', 'profileGenerations');

    expect(result).toBeNull();
    expect(trackOperationalDegradationMock).toHaveBeenCalledWith(
      env,
      expect.objectContaining({
        component: 'tier_enforcement',
        condition: 'email_verification_check_failed',
        mode: 'fail_open',
        operation: 'enforce_usage_quota',
        userId: 'user-123',
        properties: expect.objectContaining({
          action: 'profile_generation',
          feature: 'profileGenerations',
        }),
      })
    );
  });

  // TODO CFO-003: quota exceeded degradation tracking not yet implemented
  it.skip('records quota exceeded as a durable analytics event', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ email_verified: true }] })
      .mockResolvedValueOnce({ rows: [{ lifetime_access: false, transit_pass_expires: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ net_usage: '5', quota_exceeded: true }] });

    const request = new Request('https://api.test/api/profile/generate', { method: 'POST' });
    request._user = { sub: 'user-456' };

    const env = { NEON_CONNECTION_STRING: 'postgres://test' };
    const response = await enforceUsageQuota(request, env, 'profile_generation', 'profileGenerations');

    expect(response.status).toBe(429);
    expect(trackEventMock).toHaveBeenCalledWith(
      env,
      EVENTS.QUOTA_EXCEEDED,
      expect.objectContaining({
        userId: 'user-456',
        properties: expect.objectContaining({
          action: 'profile_generation',
          feature: 'profileGenerations',
          current_usage: 5,
        }),
      })
    );
  });

  // TODO CFO-002: ghost subscription detection not yet implemented in handleSubscriptionUpdated
  it.skip('emits a critical degradation event for ghost subscriptions', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    await handleSubscriptionUpdated({
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_123',
          id: 'sub_123',
          items: { data: [{ price: { id: 'price_individual' } }] },
          status: 'active',
          current_period_start: 1,
          current_period_end: 2,
          cancel_at_period_end: false,
        },
      },
    }, queryMock, {
      STRIPE_PRICE_INDIVIDUAL: 'price_individual',
    });

    expect(trackOperationalDegradationMock).toHaveBeenCalledWith(
      expect.objectContaining({ STRIPE_PRICE_INDIVIDUAL: 'price_individual' }),
      expect.objectContaining({
        component: 'stripe_webhook',
        condition: 'ghost_subscription',
        mode: 'partial',
        severity: 'critical',
        operation: 'customer.subscription.updated',
        properties: expect.objectContaining({
          customerId: 'cus_123',
          subscriptionId: 'sub_123',
          tier: 'individual',
        }),
      })
    );
  });
});