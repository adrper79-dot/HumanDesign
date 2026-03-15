import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  queryMock,
  transactionMock,
  retrieveSubscriptionMock,
  markReferralAsConvertedMock,
  sendSubscriptionConfirmationEmailMock,
  trackOperationalDegradationMock,
  trackEventMock,
} = vi.hoisted(() => ({
  queryMock: vi.fn(),
  transactionMock: vi.fn(),
  retrieveSubscriptionMock: vi.fn(),
  markReferralAsConvertedMock: vi.fn(),
  sendSubscriptionConfirmationEmailMock: vi.fn().mockResolvedValue(undefined),
  trackOperationalDegradationMock: vi.fn().mockResolvedValue(undefined),
  trackEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../workers/src/handlers/referrals.js', () => ({
  markReferralAsConverted: markReferralAsConvertedMock,
}));

vi.mock('../workers/src/lib/email.js', () => ({
  sendEmail: vi.fn(),
  sendSubscriptionConfirmationEmail: sendSubscriptionConfirmationEmailMock,
}));

vi.mock('../workers/src/lib/analytics.js', async () => {
  const actual = await vi.importActual('../workers/src/lib/analytics.js');
  return {
    ...actual,
    trackOperationalDegradation: trackOperationalDegradationMock,
    trackEvent: trackEventMock,
  };
});

import { handleCheckoutCompleted } from '../workers/src/handlers/webhook.js';

describe('webhook checkout degradation signals', () => {
  beforeEach(() => {
    queryMock.mockReset();
    transactionMock.mockReset();
    retrieveSubscriptionMock.mockReset();
    markReferralAsConvertedMock.mockReset();
    sendSubscriptionConfirmationEmailMock.mockReset();
    trackOperationalDegradationMock.mockClear();
    trackEventMock.mockClear();

    queryMock.transaction = transactionMock;
    transactionMock.mockImplementation(async (callback) => callback(vi.fn()));
    sendSubscriptionConfirmationEmailMock.mockResolvedValue(undefined);
    retrieveSubscriptionMock.mockResolvedValue({
      items: { data: [{ price: { id: 'price_practitioner' } }] },
      status: 'active',
      current_period_start: 1,
      current_period_end: 2,
      cancel_at_period_end: false,
    });
  });

  // TODO CFO-002: handleCheckoutCompleted needs trackOperationalDegradation for partial failure tracking
  it.skip('emits a durable event when referral conversion fails after successful checkout persistence', async () => {
    markReferralAsConvertedMock.mockRejectedValue(new Error('referral row lock timeout'));
    queryMock.mockResolvedValueOnce({ rows: [{ email: 'user@example.com' }] });

    await handleCheckoutCompleted({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          customer: 'cus_123',
          subscription: 'sub_123',
          metadata: { user_id: 'user-123' },
        },
      },
    }, queryMock, {
      subscriptions: { retrieve: retrieveSubscriptionMock },
    }, {
      STRIPE_PRICE_PRACTITIONER: 'price_practitioner',
      RESEND_API_KEY: 're_test',
    });

    expect(trackOperationalDegradationMock).toHaveBeenCalledWith(
      expect.objectContaining({ STRIPE_PRICE_PRACTITIONER: 'price_practitioner' }),
      expect.objectContaining({
        component: 'stripe_webhook',
        condition: 'referral_conversion_failed',
        mode: 'partial',
        operation: 'checkout.session.completed',
        userId: 'user-123',
        properties: expect.objectContaining({
          customerId: 'cus_123',
          subscriptionId: 'sub_123',
          tier: 'practitioner',
        }),
      })
    );
  });

  // TODO CFO-002: handleCheckoutCompleted needs trackOperationalDegradation for email failure tracking
  it.skip('emits a durable event when confirmation email delivery fails', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ email: 'user@example.com' }] });
    sendSubscriptionConfirmationEmailMock.mockRejectedValue(new Error('email provider timeout'));

    await handleCheckoutCompleted({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_456',
          customer: 'cus_456',
          subscription: 'sub_456',
          metadata: { user_id: 'user-456' },
        },
      },
    }, queryMock, {
      subscriptions: { retrieve: retrieveSubscriptionMock },
    }, {
      STRIPE_PRICE_PRACTITIONER: 'price_practitioner',
      RESEND_API_KEY: 're_test',
      FROM_EMAIL: 'Prime Self <hello@primeself.app>',
    });

    await Promise.resolve();

    expect(trackOperationalDegradationMock).toHaveBeenCalledWith(
      expect.objectContaining({ STRIPE_PRICE_PRACTITIONER: 'price_practitioner' }),
      expect.objectContaining({
        component: 'stripe_webhook',
        condition: 'subscription_confirmation_email_failed',
        mode: 'partial',
        operation: 'checkout.session.completed',
        userId: 'user-456',
        properties: expect.objectContaining({
          customerId: 'cus_456',
          subscriptionId: 'sub_456',
          email: 'user@example.com',
          tier: 'practitioner',
        }),
      })
    );
  });
});