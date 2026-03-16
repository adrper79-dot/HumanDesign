import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createQueryFnMock,
  createStripeClientMock,
  verifyWebhookMock,
  markReferralAsConvertedMock,
  trackEventMock,
} = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
  createStripeClientMock: vi.fn(),
  verifyWebhookMock: vi.fn(),
  markReferralAsConvertedMock: vi.fn(),
  trackEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../workers/src/lib/stripe.js', () => ({
  createStripeClient: createStripeClientMock,
  verifyWebhook: verifyWebhookMock,
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    checkEventProcessed: 'checkEventProcessed',
    markEventProcessed: 'markEventProcessed',
    releaseProcessedEvent: 'releaseProcessedEvent',
    finalizeProcessedEvent: 'finalizeProcessedEvent',
    getSubscriptionByStripeCustomerId: 'getSubscriptionByStripeCustomerId',
    getSubscriptionByStripeSubscriptionId: 'getSubscriptionByStripeSubscriptionId',
    getUserByStripeCustomerId: 'getUserByStripeCustomerId',
    getUserByEmail: 'getUserByEmail',
    getUserByEmailSafe: 'getUserByEmailSafe',
    getUserByIdSafe: 'getUserByIdSafe',
    updateUserStripeCustomerId: 'updateUserStripeCustomerId',
    upsertSubscription: 'upsertSubscription',
    updateUserTierAndStripe: 'updateUserTierAndStripe',
    updateUserTier: 'updateUserTier',
    createPractitioner: 'createPractitioner',
    updatePractitionerTier: 'updatePractitionerTier',
  },
}));

vi.mock('../workers/src/handlers/referrals.js', () => ({
  markReferralAsConverted: markReferralAsConvertedMock,
}));

vi.mock('../workers/src/lib/email.js', () => ({
  sendEmail: vi.fn(),
  sendSubscriptionConfirmationEmail: vi.fn(),
}));

vi.mock('../workers/src/lib/analytics.js', async () => {
  const actual = await vi.importActual('../workers/src/lib/analytics.js');
  return {
    ...actual,
    trackEvent: trackEventMock,
  };
});

import { handleStripeWebhook } from '../workers/src/handlers/webhook.js';

describe('webhook claim lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('releases the processing claim when downstream handling throws', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'checkEventProcessed') return { rows: [] };
      if (sql === 'markEventProcessed') return { rowCount: 1, rows: [] };
      if (sql === 'releaseProcessedEvent') return { rowCount: 1, rows: [{ stripe_event_id: 'evt_retry_1' }] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    query.transaction = vi.fn();
    createQueryFnMock.mockReturnValue(query);

    const retrieveSubscriptionMock = vi.fn().mockRejectedValue(new Error('stripe retrieve failed'));
    createStripeClientMock.mockReturnValue({
      subscriptions: { retrieve: retrieveSubscriptionMock },
    });
    verifyWebhookMock.mockResolvedValue({
      id: 'evt_retry_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_retry_1',
          customer: 'cus_123',
          subscription: 'sub_123',
          metadata: { user_id: 'user-1' },
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

    expect(response.status).toBe(500);
    expect(query).toHaveBeenCalledWith('releaseProcessedEvent', ['evt_retry_1']);
  });

  it('finalizes invoice payment events in place on the claimed payment_events row', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'checkEventProcessed') return { rows: [] };
      if (sql === 'markEventProcessed') return { rowCount: 1, rows: [] };
      if (sql === 'getSubscriptionByStripeSubscriptionId') {
        return { rows: [{ id: 'sub_db_1', user_id: 'user-1' }] };
      }
      if (sql === 'getSubscriptionByStripeCustomerId') {
        return { rows: [{ id: 'sub_db_1', user_id: 'user-1' }] };
      }
      if (sql === 'finalizeProcessedEvent') {
        return { rowCount: 1, rows: [{ stripe_event_id: 'evt_invoice_1', status: 'succeeded' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    query.transaction = vi.fn();
    createQueryFnMock.mockReturnValue(query);
    createStripeClientMock.mockReturnValue({});
    verifyWebhookMock.mockResolvedValue({
      id: 'evt_invoice_1',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_123',
          customer: 'cus_123',
          subscription: 'sub_123',
          amount_paid: 9700,
          currency: 'usd',
          status: 'paid',
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
    expect(query).toHaveBeenCalledWith('finalizeProcessedEvent', [
      'evt_invoice_1',
      'sub_db_1',
      'payment_succeeded',
      9700,
      'usd',
      'succeeded',
      null,
      JSON.stringify({
        id: 'in_123',
        customer: 'cus_123',
        subscription: 'sub_123',
        amount_paid: 9700,
        currency: 'usd',
        status: 'paid',
      }),
    ]);
  });

  it('recovers a missing local subscription row before finalizing invoice payment events', async () => {
    let subscriptionLookupCount = 0;
    const query = vi.fn(async (sql, params) => {
      if (sql === 'checkEventProcessed') return { rows: [] };
      if (sql === 'markEventProcessed') return { rowCount: 1, rows: [] };
      if (sql === 'getSubscriptionByStripeSubscriptionId') {
        subscriptionLookupCount += 1;
        if (params[0] !== 'sub_missing') {
          return { rows: [] };
        }
        return subscriptionLookupCount === 1
          ? { rows: [] }
          : { rows: [{ id: 'sub_db_recovered', user_id: 'user-1' }] };
      }
      if (sql === 'getSubscriptionByStripeCustomerId') return { rows: [] };
      if (sql === 'getUserByStripeCustomerId') return { rows: [{ id: 'user-1' }] };
      if (sql === 'finalizeProcessedEvent') {
        return { rowCount: 1, rows: [{ stripe_event_id: 'evt_invoice_recover', status: 'succeeded' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const txQuery = vi.fn(async () => ({ rowCount: 1, rows: [] }));
    query.transaction = vi.fn(async (callback) => callback(txQuery));
    createQueryFnMock.mockReturnValue(query);
    createStripeClientMock.mockReturnValue({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          items: { data: [{ price: { id: 'price_practitioner' } }] },
          status: 'active',
          current_period_start: 1,
          current_period_end: 2,
          cancel_at_period_end: false,
        }),
      },
    });
    verifyWebhookMock.mockResolvedValue({
      id: 'evt_invoice_recover',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_recover',
          customer: 'cus_missing',
          subscription: 'sub_missing',
          amount_paid: 9700,
          currency: 'usd',
          status: 'paid',
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
        STRIPE_PRICE_PRACTITIONER: 'price_practitioner',
      }
    );

    expect(response.status).toBe(200);
    expect(query.transaction).toHaveBeenCalledTimes(1);
    expect(txQuery).toHaveBeenCalledWith('upsertSubscription', [
      'user-1',
      'cus_missing',
      'sub_missing',
      'practitioner',
      'active',
      new Date(1000).toISOString(),
      new Date(2000).toISOString(),
      false,
    ]);
    expect(txQuery).toHaveBeenCalledWith('updateUserTierAndStripe', ['practitioner', 'cus_missing', 'user-1']);
    expect(txQuery).toHaveBeenCalledWith('createPractitioner', ['user-1', false, 'practitioner']);
    expect(txQuery).toHaveBeenCalledWith('updatePractitionerTier', ['user-1', 'practitioner']);
    expect(query).toHaveBeenCalledWith('finalizeProcessedEvent', [
      'evt_invoice_recover',
      'sub_db_recovered',
      'payment_succeeded',
      9700,
      'usd',
      'succeeded',
      null,
      JSON.stringify({
        id: 'in_recover',
        customer: 'cus_missing',
        subscription: 'sub_missing',
        amount_paid: 9700,
        currency: 'usd',
        status: 'paid',
      }),
    ]);
  });

  it('relinks a Stripe customer by email before rebuilding the subscription row', async () => {
    let subscriptionLookupCount = 0;
    const query = vi.fn(async (sql, params) => {
      if (sql === 'checkEventProcessed') return { rows: [] };
      if (sql === 'markEventProcessed') return { rowCount: 1, rows: [] };
      if (sql === 'getSubscriptionByStripeSubscriptionId') {
        subscriptionLookupCount += 1;
        if (params[0] !== 'sub_email_recover') {
          return { rows: [] };
        }
        return subscriptionLookupCount === 1
          ? { rows: [] }
          : { rows: [{ id: 'sub_db_email', user_id: 'user-email' }] };
      }
      if (sql === 'getSubscriptionByStripeCustomerId') return { rows: [] };
      if (sql === 'getUserByStripeCustomerId') return { rows: [] };
      if (sql === 'getUserByEmailSafe') {
        expect(params).toEqual(['email@example.com']);
        return {
          rows: [{
            id: 'user-email',
            email: 'email@example.com',
            tier: 'free',
            stripe_customer_id: null,
          }],
        };
      }
      if (sql === 'updateUserStripeCustomerId') return { rowCount: 1, rows: [] };
      if (sql === 'finalizeProcessedEvent') {
        return { rowCount: 1, rows: [{ stripe_event_id: 'evt_invoice_email_recover', status: 'succeeded' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const txQuery = vi.fn(async () => ({ rowCount: 1, rows: [] }));
    query.transaction = vi.fn(async (callback) => callback(txQuery));
    createQueryFnMock.mockReturnValue(query);
    createStripeClientMock.mockReturnValue({
      customers: {
        retrieve: vi.fn().mockResolvedValue({ email: 'Email@Example.com' }),
      },
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          items: { data: [{ price: { id: 'price_practitioner' } }] },
          status: 'active',
          current_period_start: 1,
          current_period_end: 2,
          cancel_at_period_end: false,
        }),
      },
    });
    verifyWebhookMock.mockResolvedValue({
      id: 'evt_invoice_email_recover',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_email_recover',
          customer: 'cus_email_recover',
          subscription: 'sub_email_recover',
          amount_paid: 9700,
          currency: 'usd',
          status: 'paid',
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
        STRIPE_PRICE_PRACTITIONER: 'price_practitioner',
      }
    );

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith('updateUserStripeCustomerId', ['cus_email_recover', 'user-email']);
    expect(txQuery).toHaveBeenCalledWith('upsertSubscription', [
      'user-email',
      'cus_email_recover',
      'sub_email_recover',
      'practitioner',
      'active',
      new Date(1000).toISOString(),
      new Date(2000).toISOString(),
      false,
    ]);
  });

  it('relinks ghost subscriptions by email when stripe_customer_id is missing on the user', async () => {
    const query = vi.fn(async (sql, params) => {
      if (sql === 'checkEventProcessed') return { rows: [] };
      if (sql === 'markEventProcessed') return { rowCount: 1, rows: [] };
      if (sql === 'getSubscriptionByStripeCustomerId') return { rows: [] };
      if (sql === 'getUserByStripeCustomerId') return { rows: [] };
      if (sql === 'getUserByEmailSafe') {
        expect(params).toEqual(['ghost@example.com']);
        return {
          rows: [{
            id: 'ghost-user',
            email: 'ghost@example.com',
            tier: 'free',
            stripe_customer_id: null,
          }],
        };
      }
      if (sql === 'updateUserStripeCustomerId') return { rowCount: 1, rows: [] };
      if (sql === 'finalizeProcessedEvent') return { rowCount: 1, rows: [{ stripe_event_id: 'evt_sub_ghost', status: 'active' }] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    const txQuery = vi.fn(async () => ({ rowCount: 1, rows: [] }));
    query.transaction = vi.fn(async (callback) => callback(txQuery));
    createQueryFnMock.mockReturnValue(query);
    createStripeClientMock.mockReturnValue({
      customers: {
        retrieve: vi.fn().mockResolvedValue({ email: 'ghost@example.com' }),
      },
    });
    verifyWebhookMock.mockResolvedValue({
      id: 'evt_sub_ghost',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_ghost',
          customer: 'cus_ghost',
          status: 'active',
          items: { data: [{ price: { id: 'price_practitioner' } }] },
          current_period_start: 1,
          current_period_end: 2,
          cancel_at_period_end: false,
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
        STRIPE_PRICE_PRACTITIONER: 'price_practitioner',
      }
    );

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith('updateUserStripeCustomerId', ['cus_ghost', 'ghost-user']);
    expect(txQuery).toHaveBeenCalledWith('upsertSubscription', [
      'ghost-user',
      'cus_ghost',
      'sub_ghost',
      'practitioner',
      'active',
      new Date(1000).toISOString(),
      new Date(2000).toISOString(),
      false,
    ]);
    expect(txQuery).toHaveBeenCalledWith('updateUserTier', ['practitioner', 'ghost-user']);
  });

  it('parks invoice payment events for manual review when no safe user mapping exists', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'checkEventProcessed') return { rows: [] };
      if (sql === 'markEventProcessed') return { rowCount: 1, rows: [] };
      if (sql === 'getSubscriptionByStripeSubscriptionId') return { rows: [] };
      if (sql === 'getSubscriptionByStripeCustomerId') return { rows: [] };
      if (sql === 'getUserByStripeCustomerId') return { rows: [] };
      if (sql === 'getUserByEmailSafe') return { rows: [] };
      if (sql === 'finalizeProcessedEvent') {
        return { rowCount: 1, rows: [{ stripe_event_id: 'evt_invoice_manual_review', status: 'manual_review' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    query.transaction = vi.fn();
    createQueryFnMock.mockReturnValue(query);
    createStripeClientMock.mockReturnValue({
      customers: {
        retrieve: vi.fn().mockResolvedValue({ email: 'missing@example.com' }),
      },
    });
    verifyWebhookMock.mockResolvedValue({
      id: 'evt_invoice_manual_review',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_manual_review',
          customer: 'cus_manual_review',
          subscription: 'sub_manual_review',
          amount_paid: 9700,
          currency: 'usd',
          status: 'paid',
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
    expect(query).toHaveBeenCalledWith('finalizeProcessedEvent', [
      'evt_invoice_manual_review',
      null,
      'payment_succeeded_manual_review',
      9700,
      'usd',
      'manual_review',
      'unmapped_customer',
      JSON.stringify({
        id: 'in_manual_review',
        customer: 'cus_manual_review',
        subscription: 'sub_manual_review',
        amount_paid: 9700,
        currency: 'usd',
        status: 'paid',
      }),
    ]);
  });

  it('parks ghost subscriptions for manual review when neither customer id nor email can recover the user', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'checkEventProcessed') return { rows: [] };
      if (sql === 'markEventProcessed') return { rowCount: 1, rows: [] };
      if (sql === 'getSubscriptionByStripeCustomerId') return { rows: [] };
      if (sql === 'getUserByStripeCustomerId') return { rows: [] };
      if (sql === 'getUserByEmailSafe') return { rows: [] };
      if (sql === 'finalizeProcessedEvent') {
        return { rowCount: 1, rows: [{ stripe_event_id: 'evt_sub_manual_review', status: 'manual_review' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    query.transaction = vi.fn();
    createQueryFnMock.mockReturnValue(query);
    createStripeClientMock.mockReturnValue({
      customers: {
        retrieve: vi.fn().mockResolvedValue({ email: 'missing@example.com' }),
      },
    });
    verifyWebhookMock.mockResolvedValue({
      id: 'evt_sub_manual_review',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_manual_review',
          customer: 'cus_manual_review',
          status: 'active',
          items: { data: [{ price: { id: 'price_practitioner' } }] },
          current_period_start: 1,
          current_period_end: 2,
          cancel_at_period_end: false,
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
        STRIPE_PRICE_PRACTITIONER: 'price_practitioner',
      }
    );

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith('finalizeProcessedEvent', [
      'evt_sub_manual_review',
      null,
      'subscription_manual_review',
      null,
      'usd',
      'manual_review',
      'unmapped_customer',
      JSON.stringify({
        id: 'sub_manual_review',
        customer: 'cus_manual_review',
        status: 'active',
        items: { data: [{ price: { id: 'price_practitioner' } }] },
        current_period_start: 1,
        current_period_end: 2,
        cancel_at_period_end: false,
      }),
    ]);
  });
});
