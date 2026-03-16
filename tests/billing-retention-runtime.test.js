import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getUserFromRequestMock,
  createQueryFnMock,
  cancelSubscriptionMock,
  createStripeClientMock,
  withCircuitBreakerMock,
  trackEventMock,
  updateSubscriptionMock,
} = vi.hoisted(() => ({
  getUserFromRequestMock: vi.fn(),
  createQueryFnMock: vi.fn(),
  cancelSubscriptionMock: vi.fn(),
  createStripeClientMock: vi.fn(),
  withCircuitBreakerMock: vi.fn(async (_name, operation) => operation()),
  trackEventMock: vi.fn().mockResolvedValue(undefined),
  updateSubscriptionMock: vi.fn(),
}));

vi.mock('../workers/src/middleware/auth.js', () => ({
  getUserFromRequest: getUserFromRequestMock,
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    getActiveSubscription: 'getActiveSubscription',
    updateSubscriptionCancellation: 'updateSubscriptionCancellation',
    updateUserTier: 'updateUserTier',
    updateSubscriptionTier: 'updateSubscriptionTier',
  },
}));

vi.mock('../workers/src/lib/stripe.js', () => ({
  createStripeClient: createStripeClientMock,
  ensureCustomer: vi.fn(),
  createCheckoutSession: vi.fn(),
  createOneTimeCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  getSubscription: vi.fn(),
  updateSubscription: updateSubscriptionMock,
  cancelSubscription: cancelSubscriptionMock,
  getTierConfig: vi.fn(),
  getTier: vi.fn((tier, env) => ({
    name: tier,
    priceId: env?.STRIPE_PRICE_INDIVIDUAL || 'price_individual',
  })),
  getOneTimeProducts: vi.fn(),
}));

vi.mock('../workers/src/lib/circuitBreaker.js', () => ({
  withCircuitBreaker: withCircuitBreakerMock,
}));

vi.mock('../workers/src/lib/analytics.js', async () => {
  const actual = await vi.importActual('../workers/src/lib/analytics.js');
  return {
    ...actual,
    trackEvent: trackEventMock,
    EVENTS: { CANCEL: 'cancel', UPGRADE: 'upgrade' },
  };
});

import { handleCancelSubscription, handleUpgradeSubscription } from '../workers/src/handlers/billing.js';

describe('billing retention runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserFromRequestMock.mockResolvedValue({ id: 'user-1' });
  });

  it('returns a retention preview without calling Stripe cancel', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getActiveSubscription') {
        return {
          rows: [{
            id: 'sub_db_1',
            tier: 'practitioner',
            status: 'active',
            stripe_subscription_id: 'sub_stripe_1',
            current_period_end: '2026-04-01T00:00:00.000Z',
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    query.transaction = vi.fn();
    createQueryFnMock.mockReturnValue(query);

    const response = await handleCancelSubscription(
      new Request('https://api.test/api/billing/cancel', {
        method: 'POST',
        body: JSON.stringify({ previewOnly: true }),
      }),
      { NEON_CONNECTION_STRING: 'postgresql://test', STRIPE_SECRET_KEY: 'sk_test' }
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.previewOnly).toBe(true);
    expect(json.retentionOffer).toMatchObject({ targetTier: 'individual', targetPrice: 19 });
    expect(cancelSubscriptionMock).not.toHaveBeenCalled();
  });

  it('downgrades a subscription through the upgrade endpoint', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getActiveSubscription') {
        return {
          rows: [{
            id: 'sub_db_1',
            tier: 'practitioner',
            stripe_subscription_id: 'sub_stripe_1',
          }],
        };
      }
      return { rows: [], rowCount: 1 };
    });
    query.transaction = vi.fn(async (callback) => callback(vi.fn(async () => ({ rows: [], rowCount: 1 }))));
    createQueryFnMock.mockReturnValue(query);
    createStripeClientMock.mockReturnValue({});
    updateSubscriptionMock.mockResolvedValue({ status: 'active', current_period_end: 1 });

    const response = await handleUpgradeSubscription(
      new Request('https://api.test/api/billing/upgrade', {
        method: 'POST',
        body: JSON.stringify({ tier: 'individual' }),
      }),
      {
        NEON_CONNECTION_STRING: 'postgresql://test',
        STRIPE_SECRET_KEY: 'sk_test',
        STRIPE_PRICE_INDIVIDUAL: 'price_individual',
      }
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(updateSubscriptionMock).toHaveBeenCalledWith({}, 'sub_stripe_1', 'price_individual');
  });
});