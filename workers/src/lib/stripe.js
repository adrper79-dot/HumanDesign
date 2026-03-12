/**
 * Stripe Service — Payment & Subscription Management
 * 
 * Handles:
 * - Price tier configuration
 * - Checkout session creation
 * - Subscription management
 * - Customer portal sessions
 * - Webhook event processing
 */

import Stripe from 'stripe';

// ─── Tier Configuration ──────────────────────────────────────

/**
 * Get tier configuration with env-specific price IDs
 * @param {Object} env - Cloudflare Worker environment
 * @returns {Object} Tier configuration
 */
export function getTierConfig(env) {
  return {
    free: {
      name: 'Free',
      price: 0,
      priceId: null,
      features: {
        chartCalculations: 1,
        profileGenerations: 1,
        transitSnapshots: 1,
        apiCallsPerMonth: 0,
        smsDigests: false,
        practitionerTools: false,
        whiteLabel: false
      }
    },
    regular: {
      name: 'Explorer',
      price: 1200,  // $12.00 in cents
      priceId: env.STRIPE_PRICE_REGULAR || 'price_placeholder_regular',
      features: {
        chartCalculations: Infinity,
        profileGenerations: 10,
        transitSnapshots: Infinity,
        apiCallsPerMonth: 0,
        smsDigests: true,
        practitionerTools: false,
        whiteLabel: false
      }
    },
    practitioner: {
      name: 'Guide',
      price: 6000,  // $60.00 in cents
      priceId: env.STRIPE_PRICE_PRACTITIONER || 'price_placeholder_practitioner',
      features: {
        chartCalculations: Infinity,
        profileGenerations: Infinity,
        transitSnapshots: Infinity,
        apiCallsPerMonth: 1000,
        smsDigests: true,
        practitionerTools: true,
        whiteLabel: false
      }
    },
    white_label: {
      name: 'Studio',
      price: 50000,  // $500.00 in cents
      priceId: env.STRIPE_PRICE_WHITE_LABEL || 'price_placeholder_white_label',
      features: {
        chartCalculations: Infinity,
        profileGenerations: Infinity,
        transitSnapshots: Infinity,
        apiCallsPerMonth: 10000,
        smsDigests: true,
        practitionerTools: true,
        whiteLabel: true
      }
    }
  };
}

// ─── Stripe Client ───────────────────────────────────────────

/**
 * Create Stripe client instance
 * @param {string} secretKey - Stripe secret key from env
 * @returns {Stripe} Stripe client
 */
export function createStripeClient(secretKey) {
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required');
  }
  
  return new Stripe(secretKey, {
    apiVersion: '2024-12-18.acacia',
    httpClient: Stripe.createFetchHttpClient()  // Use fetch for Cloudflare Workers
  });
}

// ─── Customer Management ─────────────────────────────────────

/**
 * Create or retrieve Stripe customer
 * @param {Stripe} stripe - Stripe client
 * @param {Object} user - User object with email
 * @param {string} stripeCustomerId - Existing Stripe customer ID (optional)
 * @returns {Promise<string>} Stripe customer ID
 */
export async function ensureCustomer(stripe, user, stripeCustomerId = null) {
  if (stripeCustomerId) {
    try {
      await stripe.customers.retrieve(stripeCustomerId);
      return stripeCustomerId;
    } catch (error) {
      console.warn('Stripe customer not found, creating new:', stripeCustomerId);
    }
  }
  
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      user_id: user.id,
      created_by: 'prime-self-api'
    }
  });
  
  return customer.id;
}

// ─── Checkout Sessions ───────────────────────────────────────

/**
 * Create a checkout session for subscription
 * @param {Stripe} stripe - Stripe client
 * @param {Object} params - Checkout parameters
 * @param {string} params.customerId - Stripe customer ID
 * @param {string} params.priceId - Stripe price ID for tier
 * @param {string} params.successUrl - URL to redirect on success
 * @param {string} params.cancelUrl - URL to redirect on cancel
 * @param {Array<Object>} [params.discounts] - Optional Stripe discounts array
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<Object>} Checkout session
 */
export async function createCheckoutSession(stripe, {
  customerId,
  priceId,
  successUrl,
  cancelUrl,
  discounts,
  metadata = {}
}) {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    discounts,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    subscription_data: {
      metadata
    }
  });
}

/**
 * Create a customer portal session
 * @param {Stripe} stripe - Stripe client
 * @param {string} customerId - Stripe customer ID
 * @param {string} returnUrl - URL to return to after portal
 * @returns {Promise<Object>} Portal session
 */
export async function createPortalSession(stripe, customerId, returnUrl) {
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl
  });
}

// ─── Subscription Management ─────────────────────────────────

/**
 * Get subscription by ID
 * @param {Stripe} stripe - Stripe client
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Object>} Subscription object
 */
export async function getSubscription(stripe, subscriptionId) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Update subscription (upgrade/downgrade)
 * @param {Stripe} stripe - Stripe client
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {string} newPriceId - New price ID
 * @returns {Promise<Object>} Updated subscription
 */
export async function updateSubscription(stripe, subscriptionId, newPriceId) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  return await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId
      }
    ],
    proration_behavior: 'create_prorations'
  });
}

/**
 * Cancel subscription
 * @param {Stripe} stripe - Stripe client
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {boolean} immediately - Cancel immediately vs at period end
 * @returns {Promise<Object>} Cancelled subscription
 */
export async function cancelSubscription(stripe, subscriptionId, immediately = false) {
  if (immediately) {
    return await stripe.subscriptions.cancel(subscriptionId);
  } else {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });
  }
}

// ─── Webhook Verification ────────────────────────────────────

/**
 * Verify and construct webhook event
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe signature header
 * @param {string} webhookSecret - Stripe webhook secret
 * @param {Stripe} stripe - Stripe client
 * @returns {Promise<Object>} Verified Stripe event
 */
export async function verifyWebhook(payload, signature, webhookSecret, stripe) {
  try {
    return await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
  } catch (error) {
    console.error('Webhook verification failed:', error);
    throw new Error(`Webhook verification failed: ${error.message}`);
  }
}

// ─── Tier Helpers ────────────────────────────────────────────

/**
 * Get tier configuration by name
 * @param {string} tierName - Tier name (free, regular, practitioner, white_label)
 * @param {Object} env - Cloudflare Worker environment (optional)
 * @returns {Object} Tier configuration
 */
export function getTier(tierName, env = {}) {
  const tiers = getTierConfig(env);
  const normalized = tierName ? tierName.toLowerCase() : 'free';
  // Support legacy tier names for backwards compatibility with existing DB rows
  const LEGACY_MAP = { seeker: 'regular', guide: 'practitioner' };
  const resolvedName = LEGACY_MAP[normalized] || normalized;
  const tier = tiers[resolvedName];
  if (!tier) {
    throw new Error(`Invalid tier: ${tierName}`);
  }
  return tier;
}

/**
 * Check if user has access to feature based on tier
 * @param {string} tierName - User's tier
 * @param {string} feature - Feature name
 * @returns {boolean} Whether user has access
 */
export function hasFeatureAccess(tierName, feature) {
  const tier = getTier(tierName);
  return tier.features[feature] === true || tier.features[feature] === Infinity;
}

/**
 * Check if user has exceeded quota for a feature
 * @param {string} tierName - User's tier
 * @param {string} feature - Feature name
 * @param {number} currentUsage - Current usage count
 * @returns {boolean} Whether quota is exceeded
 */
export function isQuotaExceeded(tierName, feature, currentUsage) {
  const tier = getTier(tierName);
  const limit = tier.features[feature];
  
  if (limit === Infinity || limit === true) {
    return false;
  }
  
  return currentUsage >= limit;
}

/**
 * Get price ID for tier
 * @param {string} tierName - Tier name
 * @returns {string|null} Stripe price ID
 */
export function getPriceId(tierName) {
  const tier = getTier(tierName);
  return tier.priceId;
}
