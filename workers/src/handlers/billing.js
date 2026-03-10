/**
 * Billing Handler — Stripe Integration
 * 
 * Endpoints:
 * - POST /api/billing/checkout - Create checkout session
 * - POST /api/billing/portal - Create customer portal session
 * - GET /api/billing/subscription - Get current subscription
 * - POST /api/billing/cancel - Cancel subscription
 * - POST /api/billing/upgrade - Upgrade/downgrade subscription
 * 
 * Note: Webhook handling is in webhook.js (with idempotency + transactions)
 */

import {
  createStripeClient,
  ensureCustomer,
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  updateSubscription,
  cancelSubscription,
  getTierConfig,
  getTier
} from '../lib/stripe.js';

import { createQueryFn, QUERIES } from '../db/queries.js';
import { getUserFromRequest } from '../middleware/auth.js';

// ─── Checkout Session ────────────────────────────────────────

/**
 * POST /api/billing/checkout
 * Create Stripe checkout session for subscription upgrade
 * 
 * Body:
 * {
 *   "tier": "regular" | "practitioner" | "white_label",
 *   "successUrl": "https://primeself.app/success",
 *   "cancelUrl": "https://primeself.app/cancel"
 * }
 */
export async function handleCheckout(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { tier, successUrl, cancelUrl, promoCode } = body;
    
    // Validate tier
    if (!tier || !['regular', 'practitioner', 'white_label'].includes(tier)) {
      return Response.json({ error: 'Invalid tier. Must be regular, practitioner, or white_label' }, { status: 400 });
    }
    
    // Get tier configuration
    const tierConfig = getTier(tier, env);
    
    // Create Stripe client
    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    
    // Ensure customer exists
    const customerId = await ensureCustomer(stripe, user, user.stripe_customer_id);
    
    // Update user with customer ID if new
    if (!user.stripe_customer_id) {
      const query = createQueryFn(env.NEON_CONNECTION_STRING);
      await query(
        QUERIES.updateUserStripeCustomerId,
        [customerId, user.id]
      );
    }
    
    let discounts;
    if (promoCode) {
      const normalizedPromoCode = String(promoCode).trim().toUpperCase();
      if (!/^[A-Z0-9_-]{1,64}$/.test(normalizedPromoCode)) {
        return Response.json({ error: 'Invalid promo code format' }, { status: 400 });
      }

      const promoResult = await stripe.promotionCodes.list({
        code: normalizedPromoCode,
        active: true,
        limit: 1
      });

      if (!promoResult.data?.length) {
        return Response.json({ error: 'Invalid or expired promo code' }, { status: 400 });
      }

      discounts = [{ promotion_code: promoResult.data[0].id }];
    }

    // Create checkout session
    const session = await createCheckoutSession(stripe, {
      customerId,
      priceId: tierConfig.priceId,
      successUrl: successUrl || `${env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: cancelUrl || `${env.FRONTEND_URL}/billing/cancel`,
      discounts,
      metadata: {
        user_id: user.id,
        tier: tier
      }
    });
    
    return Response.json({ ok: true, sessionId: session.id, url: session.url });
    
  } catch (error) {
    console.error('Checkout error:', error);
    return Response.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}

// ─── Customer Portal ─────────────────────────────────────────

/**
 * POST /api/billing/portal
 * Create Stripe customer portal session for subscription management
 * 
 * Body:
 * {
 *   "returnUrl": "https://primeself.app/settings"
 * }
 */
export async function handlePortal(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!user.stripe_customer_id) {
      return Response.json({ error: 'No active subscription' }, { status: 400 });
    }
    
    const body = await request.json();
    const { returnUrl } = body;
    
    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    
    const session = await createPortalSession(
      stripe,
      user.stripe_customer_id,
      returnUrl || `${env.FRONTEND_URL}/settings/billing`
    );
    
    return Response.json({ ok: true, url: session.url });
    
  } catch (error) {
    console.error('Portal error:', error);
    return Response.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}

// ─── Get Subscription ────────────────────────────────────────

/**
 * GET /api/billing/subscription
 * Get current subscription details
 */
export async function handleGetSubscription(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get subscription from database
    const { rows: subRows } = await query(QUERIES.getActiveSubscription, [user.id]);
    const subscription = subRows[0] || null;
    
    if (!subscription) {
      return Response.json({ ok: true, subscription: null, tier: 'free' });
    }
    
    // Get latest status from Stripe
    if (subscription.stripe_subscription_id) {
      const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
      const stripeSubscription = await getSubscription(stripe, subscription.stripe_subscription_id);
      
      // Update local status if changed
      if (stripeSubscription.status !== subscription.status) {
        await query(QUERIES.updateSubscriptionStatus2, [stripeSubscription.status, subscription.id]);
      }
      
      return Response.json({
        ok: true,
        subscription: {
          id: subscription.id,
          tier: subscription.tier,
          status: stripeSubscription.status,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : null
        }
      });
    }
    
    return Response.json({
      ok: true,
      subscription: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end
      }
    });
    
  } catch (error) {
    console.error('Get subscription error:', error);
    return Response.json({ error: 'Failed to get subscription' }, { status: 500 });
  }
}

// ─── Cancel Subscription ─────────────────────────────────────

/**
 * POST /api/billing/cancel
 * Cancel current subscription
 * 
 * Body:
 * {
 *   "immediately": false
 * }
 */
export async function handleCancelSubscription(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    const { rows: subRows } = await query(QUERIES.getActiveSubscription, [user.id]);
    const subscription = subRows[0] || null;
    
    if (!subscription) {
      return Response.json({ error: 'No active subscription' }, { status: 400 });
    }
    
    const body = await request.json();
    const { immediately } = body;
    
    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    const canceledSubscription = await cancelSubscription(
      stripe,
      subscription.stripe_subscription_id,
      immediately || false
    );
    
    // Update database — BL-FIX: wrap in transaction so cancellation and tier downgrade stay atomic
    const newStatus = immediately ? 'canceled' : 'active';
    await query.transaction(async (q) => {
      await q(QUERIES.updateSubscriptionCancellation, [newStatus, canceledSubscription.cancel_at_period_end, subscription.id]);
      // If canceled immediately, downgrade user to free tier
      if (immediately) {
        await q(QUERIES.updateUserTier, ['free', user.id]);
      }
    });
    
    return Response.json({
      ok: true,
      message: immediately ? 'Subscription canceled immediately' : 'Subscription will cancel at period end',
      cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
      periodEnd: new Date(canceledSubscription.current_period_end * 1000).toISOString()
    });
    
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return Response.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}

// ─── Upgrade/Downgrade Subscription ──────────────────────────

/**
 * POST /api/billing/upgrade
 * Upgrade or downgrade subscription tier
 * 
 * Body:
 * {
 *   "tier": "regular" | "practitioner" | "white_label"
 * }
 */
export async function handleUpgradeSubscription(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    const { rows: subRows } = await query(QUERIES.getActiveSubscription, [user.id]);
    const subscription = subRows[0] || null;
    
    if (!subscription) {
      return Response.json({ error: 'No active subscription' }, { status: 400 });
    }
    
    const body = await request.json();
    const { tier } = body;
    
    if (!tier || !['regular', 'practitioner', 'white_label'].includes(tier)) {
      return Response.json({ error: 'Invalid tier. Must be regular, practitioner, or white_label' }, { status: 400 });
    }
    
    if (tier === subscription.tier) {
      return Response.json({ error: 'You are already on this tier' }, { status: 400 });
    }
    
    const tierConfig = getTier(tier, env);
    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    
    const updatedSubscription = await updateSubscription(
      stripe,
      subscription.stripe_subscription_id,
      tierConfig.priceId
    );
    
    // Update database — BL-FIX: wrap in transaction so subscription and user tier stay in sync
    await query.transaction(async (q) => {
      await q(QUERIES.updateSubscriptionTier, [tier, subscription.id]);
      await q(QUERIES.updateUserTier, [tier, user.id]);
    });
    
    return Response.json({
      ok: true,
      message: `Subscription updated to ${tier}`,
      subscription: {
        tier: tier,
        status: updatedSubscription.status,
        currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString()
      }
    });
    
  } catch (error) {
    console.error('Upgrade subscription error:', error);
    return Response.json({ error: 'Failed to upgrade subscription' }, { status: 500 });
  }
}

// ─── DEAD CODE REMOVED ──────────────────────────────────────
// BL-FIX: The handleWebhook function and its local handlers
// (handleCheckoutCompleted, handleSubscriptionUpdated, handleSubscriptionDeleted,
//  handleInvoicePaid, handleInvoicePaymentFailed) were dead code.
// The active webhook handler lives in webhook.js with proper idempotency
// and transaction support. Removed to prevent accidental re-enablement.
