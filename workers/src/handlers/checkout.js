/**
 * Checkout Handler — Stripe Payment & Subscription Checkout
 * 
 * POST /api/checkout/create — Create checkout session for subscription
 * POST /api/checkout/portal — Create customer portal session
 */

import { createStripeClient, createCheckoutSession, createPortalSession, ensureCustomer, getTierConfig } from '../lib/stripe.js';
import { createQueryFn, QUERIES } from '../db/queries.js';

/**
 * POST /api/checkout/create
 * Create a Stripe checkout session for subscription
 * 
 * Request body:
 * {
 *   "tier": "seeker" | "guide" | "practitioner",
 *   "successUrl": "https://primeself.app/success",
 *   "cancelUrl": "https://primeself.app/pricing"
 * }
 */
export async function handleCreateCheckout(request, env) {
  const user = request._user;
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const body = await request.json();
    const { tier, successUrl, cancelUrl } = body;

    // Get tier configuration
    const TIERS = getTierConfig(env);

    // Validate tier
    if (!tier || !TIERS[tier.toLowerCase()]) {
      return Response.json({ error: 'Invalid tier. Must be seeker, guide, or practitioner' }, { status: 400 });
    }

    if (tier.toLowerCase() === 'free') {
      return Response.json({ error: 'Cannot checkout for free tier' }, { status: 400 });
    }

    // Validate URLs
    if (!successUrl || !cancelUrl) {
      return Response.json({ error: 'successUrl and cancelUrl are required' }, { status: 400 });
    }

    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    
    // Get or create subscription record to retrieve customer ID
    let subscription = await query(QUERIES.getSubscriptionByUserId, [user.sub]);
    let stripeCustomerId;

    if (subscription.rows.length > 0) {
      stripeCustomerId = subscription.rows[0].stripe_customer_id;
    } else {
      // Get user info for customer creation
      const userResult = await query(QUERIES.getUserById, [user.sub]);
      if (userResult.rows.length === 0) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }
      const userData = userResult.rows[0];

      // Create new Stripe customer and subscription record
      stripeCustomerId = await ensureCustomer(stripe, userData);
      
      await query(QUERIES.createSubscription, [
        user.sub,
        stripeCustomerId,
        null,  // No subscription ID yet
        'free',
        'active',
        null,
        null
      ]);
    }

    // Get tier configuration
    const tierConfig = TIERS[tier.toLowerCase()];
    const priceId = tierConfig.priceId;

    if (!priceId) {
      return Response.json({ error: 'Price ID not configured for this tier' }, { status: 500 });
    }

    // Create checkout session
    const session = await createCheckoutSession(stripe, {
      customerId: stripeCustomerId,
      priceId,
      successUrl,
      cancelUrl,
      metadata: {
        user_id: user.sub,
        tier: tier.toLowerCase()
      }
    });

    return Response.json({
      sessionId: session.id,
      url: session.url,
      tier: tier.toLowerCase(),
      price: tierConfig.price
    }, { status: 200 });

  } catch (error) {
    console.error('Checkout creation error:', error);
    return Response.json({ 
      error: 'Failed to create checkout session' // BL-R-H2
    }, { status: 500 });
  }
}

/**
 * POST /api/checkout/portal
 * Create a Stripe customer portal session for subscription management
 * 
 * Request body:
 * {
 *   "returnUrl": "https://primeself.app/account"
 * }
 */
export async function handleCustomerPortal(request, env) {
  const user = request._user;
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const body = await request.json();
    const { returnUrl } = body;

    if (!returnUrl) {
      return Response.json({ error: 'returnUrl is required' }, { status: 400 });
    }

    // Get subscription record
    const subscription = await query(QUERIES.getSubscriptionByUserId, [user.sub]);

    if (subscription.rows.length === 0) {
      return Response.json({ error: 'No subscription found' }, { status: 404 });
    }

    const stripeCustomerId = subscription.rows[0].stripe_customer_id;
    
    if (!stripeCustomerId) {
      return Response.json({ error: 'No Stripe customer ID found' }, { status: 404 });
    }

    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    
    // Create portal session
    const session = await createPortalSession(stripe, stripeCustomerId, returnUrl);

    return Response.json({
      url: session.url
    }, { status: 200 });

  } catch (error) {
    console.error('Customer portal error:', error);
    return Response.json({ 
      error: 'Failed to create portal session'
    }, { status: 500 });
  }
}

