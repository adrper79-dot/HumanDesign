/**
 * Billing Cancel — Deterministic Unit Tests  (SYS-021)
 *
 * Covers all code paths in handleCancelSubscription that were untested:
 *  - 401 when no authenticated user
 *  - 400 when user has no active subscription
 *  - 400 when body is invalid JSON
 *  - 200 period-end cancel  (immediately: false)
 *  - 200 immediate cancel   (immediately: true) + tier downgrade
 *  - 200 empty body         (defaults to period-end)
 *  - 500 when Stripe throws (error path → reportHandledRouteError)
 *
 * The previewOnly path is already covered in billing-retention-runtime.test.js.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const {
  getUserFromRequestMock,
  createQueryFnMock,
  cancelSubscriptionMock,
  createStripeClientMock,
  withCircuitBreakerMock,
  trackEventMock,
  reportHandledRouteErrorMock,
} = vi.hoisted(() => ({
  getUserFromRequestMock:    vi.fn(),
  createQueryFnMock:         vi.fn(),
  cancelSubscriptionMock:    vi.fn(),
  createStripeClientMock:    vi.fn(),
  withCircuitBreakerMock:    vi.fn(async (_name, op) => op()),
  trackEventMock:            vi.fn().mockResolvedValue(undefined),
  reportHandledRouteErrorMock: vi.fn(({ error }) =>
    Response.json({ error: error?.message || 'Internal error' }, { status: 500 })
  ),
}));

vi.mock('../workers/src/middleware/auth.js', () => ({
  getUserFromRequest: getUserFromRequestMock,
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    getActiveSubscription:         'getActiveSubscription',
    updateSubscriptionCancellation: 'updateSubscriptionCancellation',
    updateUserTier:                 'updateUserTier',
  },
}));

vi.mock('../workers/src/lib/stripe.js', () => ({
  createStripeClient:           createStripeClientMock,
  cancelSubscription:           cancelSubscriptionMock,
  ensureCustomer:               vi.fn(),
  createCheckoutSession:        vi.fn(),
  createOneTimeCheckoutSession: vi.fn(),
  createPortalSession:          vi.fn(),
  getSubscription:              vi.fn(),
  updateSubscription:           vi.fn(),
  getTierConfig:                vi.fn(),
  getTier:                      vi.fn(),
  getOneTimeProducts:           vi.fn(),
}));

vi.mock('../workers/src/lib/circuitBreaker.js', () => ({
  withCircuitBreaker: withCircuitBreakerMock,
}));

vi.mock('../workers/src/lib/analytics.js', async () => {
  const actual = await vi.importActual('../workers/src/lib/analytics.js');
  return { ...actual, trackEvent: trackEventMock, EVENTS: { CANCEL: 'cancel' } };
});

vi.mock('../workers/src/lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('../workers/src/lib/routeErrors.js', () => ({
  reportHandledRouteError: reportHandledRouteErrorMock,
}));

import { handleCancelSubscription } from '../workers/src/handlers/billing.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ENV = { NEON_CONNECTION_STRING: 'postgresql://test', STRIPE_SECRET_KEY: 'sk_test' };

const ACTIVE_SUB = {
  id: 'sub_db_1',
  tier: 'practitioner',
  status: 'active',
  stripe_subscription_id: 'sub_stripe_1',
  current_period_end: Math.floor(Date.now() / 1000) + 86_400,
  cancel_at_period_end: false,
};

function makeRequest(body = null) {
  return new Request('https://api.test/api/billing/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : undefined,
  });
}

/** Build a query mock pre-loaded with ACTIVE_SUB and a working .transaction() */
function makeQueryMock(sub = ACTIVE_SUB) {
  const q = vi.fn(async (sql) => {
    if (sql === 'getActiveSubscription') return { rows: sub ? [sub] : [] };
    return { rows: [], rowCount: 1 };
  });
  q.transaction = vi.fn(async (cb) => cb(vi.fn(async () => ({ rows: [], rowCount: 1 }))));
  return q;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('handleCancelSubscription — unit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createStripeClientMock.mockReturnValue({});
  });

  // ── Auth guard ───────────────────────────────────────────────────────────
  it('returns 401 when user is not authenticated', async () => {
    getUserFromRequestMock.mockResolvedValue(null);

    const res = await handleCancelSubscription(makeRequest({}), ENV);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toMatchObject({ error: 'Unauthorized' });
  });

  // ── Subscription guard ───────────────────────────────────────────────────
  it('returns 400 when user has no active subscription', async () => {
    getUserFromRequestMock.mockResolvedValue({ id: 'user-1' });
    const q = makeQueryMock(null); // no sub row
    createQueryFnMock.mockReturnValue(q);

    const res = await handleCancelSubscription(makeRequest({}), ENV);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: 'No active subscription' });
  });

  // ── Body validation ──────────────────────────────────────────────────────
  it('returns 400 for malformed JSON body', async () => {
    getUserFromRequestMock.mockResolvedValue({ id: 'user-1' });
    createQueryFnMock.mockReturnValue(makeQueryMock());

    const req = new Request('https://api.test/api/billing/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ bad json {{',
    });
    const res = await handleCancelSubscription(req, ENV);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: 'Invalid JSON body' });
  });

  // ── Period-end cancel ────────────────────────────────────────────────────
  it('cancels at period end when immediately is false', async () => {
    getUserFromRequestMock.mockResolvedValue({ id: 'user-1' });
    createQueryFnMock.mockReturnValue(makeQueryMock());

    const stripeCanceledSub = {
      cancel_at_period_end: true,
      current_period_end: ACTIVE_SUB.current_period_end,
    };
    cancelSubscriptionMock.mockResolvedValue(stripeCanceledSub);

    const res = await handleCancelSubscription(makeRequest({ immediately: false }), ENV);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.message).toBe('Subscription will cancel at period end');
    expect(json.cancelAtPeriodEnd).toBe(true);
    // Stripe called with immediately=false
    expect(cancelSubscriptionMock).toHaveBeenCalledWith({}, 'sub_stripe_1', false);
  });

  // ── Empty body defaults to period-end ────────────────────────────────────
  it('defaults to period-end cancel when body is empty', async () => {
    getUserFromRequestMock.mockResolvedValue({ id: 'user-1' });
    createQueryFnMock.mockReturnValue(makeQueryMock());

    cancelSubscriptionMock.mockResolvedValue({
      cancel_at_period_end: true,
      current_period_end: ACTIVE_SUB.current_period_end,
    });

    const res = await handleCancelSubscription(
      new Request('https://api.test/api/billing/cancel', { method: 'POST' }),
      ENV
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cancelAtPeriodEnd).toBe(true);
    // immediately defaults to false
    expect(cancelSubscriptionMock).toHaveBeenCalledWith({}, 'sub_stripe_1', false);
  });

  // ── Immediate cancel + tier downgrade ────────────────────────────────────
  it('cancels immediately and downgrades user to free tier', async () => {
    getUserFromRequestMock.mockResolvedValue({ id: 'user-1' });

    const innerQ = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const q = vi.fn(async (sql) => {
      if (sql === 'getActiveSubscription') return { rows: [ACTIVE_SUB] };
      return { rows: [], rowCount: 1 };
    });
    q.transaction = vi.fn(async (cb) => cb(innerQ));
    createQueryFnMock.mockReturnValue(q);

    cancelSubscriptionMock.mockResolvedValue({
      cancel_at_period_end: false,
      current_period_end: ACTIVE_SUB.current_period_end,
    });

    const res = await handleCancelSubscription(makeRequest({ immediately: true }), ENV);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.message).toBe('Subscription canceled immediately');
    // Stripe called with immediately=true
    expect(cancelSubscriptionMock).toHaveBeenCalledWith({}, 'sub_stripe_1', true);
    // Transaction ran; second call inside transaction updates user tier to 'free'
    expect(innerQ).toHaveBeenCalledWith('updateUserTier', ['free', 'user-1']);
  });

  // ── Error path ───────────────────────────────────────────────────────────
  it('delegates to reportHandledRouteError when Stripe throws', async () => {
    getUserFromRequestMock.mockResolvedValue({ id: 'user-1' });
    createQueryFnMock.mockReturnValue(makeQueryMock());

    cancelSubscriptionMock.mockRejectedValue(new Error('stripe_down'));

    const res = await handleCancelSubscription(makeRequest({ immediately: false }), ENV);

    expect(reportHandledRouteErrorMock).toHaveBeenCalledOnce();
    expect(res.status).toBe(500);
  });
});
