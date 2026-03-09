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
 *   "tier": "seeker" | "guide" | "practitioner",
 *   "successUrl": "https://primeself.app/success",
 *   "cancelUrl": "https://primeself.app/cancel"
 * }
 */
export async function handleCheckout(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const { tier, successUrl, cancelUrl } = body;
    
    // Validate tier
    if (!tier || !['seeker', 'guide', 'practitioner'].includes(tier)) {
      return new Response(JSON.stringify({ error: 'Invalid tier' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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
    
    // Create checkout session
    const session = await createCheckoutSession(stripe, {
      customerId,
      priceId: tierConfig.priceId,
      successUrl: successUrl || `${env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: cancelUrl || `${env.FRONTEND_URL}/billing/cancel`,
      metadata: {
        user_id: user.id,
        tier: tier
      }
    });
    
    return new Response(JSON.stringify({
      success: true,
      sessionId: session.id,
      url: session.url
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create checkout session' // BL-R-H2
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!user.stripe_customer_id) {
      return new Response(JSON.stringify({
        error: 'No active subscription',
        message: 'You must have an active subscription to access the portal'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const { returnUrl } = body;
    
    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    
    const session = await createPortalSession(
      stripe,
      user.stripe_customer_id,
      returnUrl || `${env.FRONTEND_URL}/settings/billing`
    );
    
    return new Response(JSON.stringify({
      success: true,
      url: session.url
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Portal error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create portal session'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get subscription from database
    const { rows: subRows } = await query(QUERIES.getActiveSubscription, [user.id]);
    const subscription = subRows[0] || null;
    
    if (!subscription) {
      return new Response(JSON.stringify({
        success: true,
        subscription: null,
        tier: 'free'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get latest status from Stripe
    if (subscription.stripe_subscription_id) {
      const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
      const stripeSubscription = await getSubscription(stripe, subscription.stripe_subscription_id);
      
      // Update local status if changed
      if (stripeSubscription.status !== subscription.status) {
        await query(QUERIES.updateSubscriptionStatus2, [stripeSubscription.status, subscription.id]);
      }
      
      return new Response(JSON.stringify({
        success: true,
        subscription: {
          id: subscription.id,
          tier: subscription.tier,
          status: stripeSubscription.status,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : null
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      subscription: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Get subscription error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get subscription'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    const { rows: subRows } = await query(QUERIES.getActiveSubscription, [user.id]);
    const subscription = subRows[0] || null;
    
    if (!subscription) {
      return new Response(JSON.stringify({
        error: 'No active subscription',
        message: 'You do not have an active subscription to cancel'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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
    
    return new Response(JSON.stringify({
      success: true,
      message: immediately ? 'Subscription canceled immediately' : 'Subscription will cancel at period end',
      cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
      periodEnd: new Date(canceledSubscription.current_period_end * 1000).toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to cancel subscription'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ─── Upgrade/Downgrade Subscription ──────────────────────────

/**
 * POST /api/billing/upgrade
 * Upgrade or downgrade subscription tier
 * 
 * Body:
 * {
 *   "tier": "seeker" | "guide" | "practitioner"
 * }
 */
export async function handleUpgradeSubscription(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    const { rows: subRows } = await query(QUERIES.getActiveSubscription, [user.id]);
    const subscription = subRows[0] || null;
    
    if (!subscription) {
      return new Response(JSON.stringify({
        error: 'No active subscription',
        message: 'You must have an active subscription to upgrade/downgrade'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const { tier } = body;
    
    if (!tier || !['seeker', 'guide', 'practitioner'].includes(tier)) {
      return new Response(JSON.stringify({ error: 'Invalid tier' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (tier === subscription.tier) {
      return new Response(JSON.stringify({
        error: 'Same tier',
        message: 'You are already on this tier'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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
    
    return new Response(JSON.stringify({
      success: true,
      message: `Subscription updated to ${tier}`,
      subscription: {
        tier: tier,
        status: updatedSubscription.status,
        currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Upgrade subscription error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to upgrade subscription'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ─── DEAD CODE REMOVED ──────────────────────────────────────
// BL-FIX: The handleWebhook function and its local handlers
// (handleCheckoutCompleted, handleSubscriptionUpdated, handleSubscriptionDeleted,
//  handleInvoicePaid, handleInvoicePaymentFailed) were dead code.
// The active webhook handler lives in webhook.js with proper idempotency
// and transaction support. Removed to prevent accidental re-enablement.
