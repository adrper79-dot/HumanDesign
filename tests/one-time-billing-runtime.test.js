import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getUserFromRequestMock,
  createCheckoutSessionMock,
  createOneTimeCheckoutSessionMock,
  ensureCustomerMock,
  createStripeClientMock,
  getTierMock,
  getOneTimeProductsMock,
  createQueryFnMock,
  withCircuitBreakerMock,
  verifyWebhookMock,
} = vi.hoisted(() => ({
  getUserFromRequestMock: vi.fn(),
  createCheckoutSessionMock: vi.fn(),
  createOneTimeCheckoutSessionMock: vi.fn(),
  ensureCustomerMock: vi.fn(),
  createStripeClientMock: vi.fn(),
  getTierMock: vi.fn(),
  getOneTimeProductsMock: vi.fn(),
  createQueryFnMock: vi.fn(),
  withCircuitBreakerMock: vi.fn(async (_name, operation) => operation()),
  verifyWebhookMock: vi.fn(),
}));

vi.mock('../workers/src/middleware/auth.js', () => ({
  getUserFromRequest: getUserFromRequestMock,
}));

vi.mock('../workers/src/lib/stripe.js', () => ({
  createStripeClient: createStripeClientMock,
  ensureCustomer: ensureCustomerMock,
  createCheckoutSession: createCheckoutSessionMock,
  createOneTimeCheckoutSession: createOneTimeCheckoutSessionMock,
  createPortalSession: vi.fn(),
  getSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  getTierConfig: vi.fn(),
  getTier: getTierMock,
  getOneTimeProducts: getOneTimeProductsMock,
  verifyWebhook: verifyWebhookMock,
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    updateUserStripeCustomerId: 'updateUserStripeCustomerId',
    createUsageRecord: 'createUsageRecord',
    updateTransitPassExpiry: 'updateTransitPassExpiry',
    grantLifetimeAccess: 'grantLifetimeAccess',
    checkEventProcessed: 'checkEventProcessed',
    markEventProcessed: 'markEventProcessed',
    finalizeProcessedEvent: 'finalizeProcessedEvent',
    releaseProcessedEvent: 'releaseProcessedEvent',
  },
}));

vi.mock('../workers/src/lib/analytics.js', async () => {
  const actual = await vi.importActual('../workers/src/lib/analytics.js');
  return { ...actual, trackEvent: vi.fn().mockResolvedValue(undefined) };
});

vi.mock('../workers/src/lib/circuitBreaker.js', () => ({
  withCircuitBreaker: withCircuitBreakerMock,
}));

vi.mock('../workers/src/handlers/referrals.js', () => ({
  markReferralAsConverted: vi.fn(),
}));

vi.mock('../workers/src/lib/email.js', () => ({
  sendEmail: vi.fn(),
  sendSubscriptionConfirmationEmail: vi.fn(),
}));

import { handleCheckout, handleOneTimeCheckout } from '../workers/src/handlers/billing.js';
import { handleStripeWebhook } from '../workers/src/handlers/webhook.js';

describe('one-time billing runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getUserFromRequestMock.mockResolvedValue({
      id: 'user-1',
      tier: 'free',
      stripe_customer_id: 'cus_123',
    });

    ensureCustomerMock.mockResolvedValue('cus_123');
    getTierMock.mockImplementation((tier) => ({
      priceId: `price_${tier}`,
      annualPriceId: null,
    }));
    getOneTimeProductsMock.mockReturnValue({
      single_synthesis: {
        priceId: 'price_single',
        grants: { profileGenerations: 1 },
      },
      transit_pass: {
        priceId: 'price_transit',
        grants: { transitPassDays: 30 },
      },
    });
  });

  it('reuses an open one-time checkout session for the same product', async () => {
    const stripe = {
      checkout: {
        sessions: {
          list: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'cs_existing',
                url: 'https://stripe.test/existing',
                metadata: { user_id: 'user-1', product: 'single_synthesis' },
              },
            ],
          }),
        },
      },
    };
    createStripeClientMock.mockReturnValue(stripe);

    const response = await handleOneTimeCheckout(
      new Request('https://api.test/api/billing/checkout-one-time', {
        method: 'POST',
        body: JSON.stringify({
          product: 'single_synthesis',
          successUrl: 'https://selfprime.net/billing/success',
          cancelUrl: 'https://selfprime.net/billing/cancel',
        }),
      }),
      {
        STRIPE_SECRET_KEY: 'sk_test',
        FRONTEND_URL: 'https://selfprime.net',
      }
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, sessionId: 'cs_existing', url: 'https://stripe.test/existing' });
    expect(createOneTimeCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it('reuses an open subscription checkout session for the same tier and billing period', async () => {
    const stripe = {
      checkout: {
        sessions: {
          list: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'cs_existing_subscription',
                url: 'https://stripe.test/existing-subscription',
                metadata: {
                  user_id: 'user-1',
                  tier: 'individual',
                  billing_period: 'monthly',
                },
              },
            ],
          }),
        },
      },
    };
    createStripeClientMock.mockReturnValue(stripe);

    const response = await handleCheckout(
      new Request('https://api.test/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          tier: 'individual',
          successUrl: 'https://selfprime.net/billing/success.html',
          cancelUrl: 'https://selfprime.net/billing/cancel.html',
        }),
      }),
      {
        STRIPE_SECRET_KEY: 'sk_test',
        FRONTEND_URL: 'https://selfprime.net',
        NEON_CONNECTION_STRING: 'postgresql://test',
      }
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      sessionId: 'cs_existing_subscription',
      url: 'https://stripe.test/existing-subscription',
    });
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it('applies one-time grants inside a single transaction', async () => {
    const topLevelQuery = vi.fn(async (sql) => {
      if (sql === 'checkEventProcessed') return { rows: [] };
      if (sql === 'markEventProcessed') return { rowCount: 1, rows: [] };
      if (sql === 'finalizeProcessedEvent') return { rowCount: 1, rows: [{ stripe_event_id: 'evt_onetime_1' }] };
      throw new Error(`Unexpected top-level query: ${sql}`);
    });

    const txQuery = vi.fn(async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT 1 FROM usage_records')) {
        return { rows: [] };
      }
      return { rows: [], rowCount: 1 };
    });

    topLevelQuery.transaction = vi.fn(async (callback) => callback(txQuery));
    createQueryFnMock.mockReturnValue(topLevelQuery);
    createStripeClientMock.mockReturnValue({});
    verifyWebhookMock.mockResolvedValue({
      id: 'evt_onetime_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_onetime_1',
          mode: 'payment',
          metadata: {
            user_id: 'user-1',
            product: 'transit_pass',
            grants: JSON.stringify({ profileGenerations: 2, transitPassDays: 30 }),
          },
        },
      },
    });

    const response = await handleStripeWebhook(
      new Request('https://api.test/api/webhook/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig_test' },
        body: 'raw-body',
      }),
      {
        STRIPE_SECRET_KEY: 'sk_test',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
        NEON_CONNECTION_STRING: 'postgresql://test',
      }
    );

    expect(response.status).toBe(200);
    expect(topLevelQuery.transaction).toHaveBeenCalledTimes(1);
    expect(txQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT 1 FROM usage_records'),
      ['one-time:cs_onetime_1']
    );
    expect(txQuery).toHaveBeenCalledWith('createUsageRecord', [
      'user-1', 'profile_generation_bonus', 'one-time:cs_onetime_1', -2,
    ]);
    expect(txQuery).toHaveBeenCalledWith('createUsageRecord', [
      'user-1', 'transit_pass', 'one-time:cs_onetime_1', -1,
    ]);
    expect(txQuery).toHaveBeenCalledWith('updateTransitPassExpiry', [
      expect.any(String),
      'user-1',
    ]);
    expect(topLevelQuery).toHaveBeenCalledWith('finalizeProcessedEvent', [
      'evt_onetime_1',
      null,
      'checkout.session.completed',
      null,
      'usd',
      'succeeded',
      null,
      JSON.stringify({
        id: 'cs_onetime_1',
        mode: 'payment',
        metadata: {
          user_id: 'user-1',
          product: 'transit_pass',
          grants: JSON.stringify({ profileGenerations: 2, transitPassDays: 30 }),
        },
      }),
    ]);
  });
});