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

const LEGACY_TIER_MAP = {
  regular: 'individual',
  explorer: 'individual',
  seeker: 'individual',
  guide: 'practitioner',
  white_label: 'agency',
  studio: 'agency',
};

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
      annualPriceId: null,
      features: {
        chartCalculations: Infinity,   // HD_UPDATES3: unlimited chart gen free
        profileGenerations: 1,         // 1 synthesis/month (the hook)
        aiQuestions: 5,                // 5 AI questions/month
        dailySynthesisLimit: 1,
        dailyQuestionLimit: 5,
        transitSnapshots: 1,
        apiCallsPerMonth: 0,
        smsDigests: false,
        smsMonthlyLimit: 0,
        practitionerTools: false,
        clientManagement: false,
        pdfExport: false,
        compositeCharts: false,        // Gated: practitioner+ or $29 one-time
        diaryEntriesPerMonth: Infinity,
        savedProfilesMax: 0,
        whiteLabel: false,
        agencySeats: false,
        customWebhooks: false
      }
    },
    individual: {
      name: 'Individual',
      price: 1900,  // $19.00/mo — HD_UPDATES3 pricing
      priceId: env.STRIPE_PRICE_INDIVIDUAL || env.STRIPE_PRICE_REGULAR || 'price_placeholder_individual',
      annualPriceId: env.STRIPE_PRICE_INDIVIDUAL_ANNUAL || null,
      features: {
        chartCalculations: Infinity,
        profileGenerations: 10,        // HD_UPDATES3: 10/month (daily-practice tier)
        aiQuestions: Infinity,         // HD_UPDATES3: unlimited (drives engagement)
        dailySynthesisLimit: 5,
        dailyQuestionLimit: Infinity,
        transitSnapshots: Infinity,
        apiCallsPerMonth: 0,
        smsDigests: true,
        smsMonthlyLimit: 30,
        practitionerTools: false,
        clientManagement: false,
        pdfExport: true,
        compositeCharts: false,        // Composites removed from individual tier
        diaryEntriesPerMonth: Infinity,
        savedProfilesMax: Infinity,    // HD_UPDATES3: unlimited saved profiles
        whiteLabel: false,
        agencySeats: false,
        customWebhooks: false
      }
    },
    practitioner: {
      name: 'Practitioner',
      price: 9700,  // $97.00/mo — HD_UPDATES3 pricing
      priceId: env.STRIPE_PRICE_PRACTITIONER || 'price_placeholder_practitioner',
      annualPriceId: env.STRIPE_PRICE_PRACTITIONER_ANNUAL || null,
      features: {
        chartCalculations: Infinity,
        profileGenerations: 500,       // HD_UPDATES3: 500/month (25 clients × 20)
        aiQuestions: 500,              // Matching synth quota
        dailySynthesisLimit: 30,
        dailyQuestionLimit: 100,
        transitSnapshots: Infinity,
        apiCallsPerMonth: 0,
        smsDigests: true,
        smsMonthlyLimit: Infinity,
        practitionerTools: true,
        clientManagement: true,
        pdfExport: true,
        compositeCharts: true,         // Full composite access
        diaryEntriesPerMonth: Infinity,
        savedProfilesMax: Infinity,
        whiteLabel: false,
        agencySeats: false,
        customWebhooks: false
      }
    },
    agency: {
      name: 'Agency',
      price: 34900,  // $349.00/mo — HD_UPDATES3 pricing
      priceId: env.STRIPE_PRICE_AGENCY || env.STRIPE_PRICE_WHITE_LABEL || 'price_placeholder_agency',
      annualPriceId: env.STRIPE_PRICE_AGENCY_ANNUAL || null,
      features: {
        chartCalculations: Infinity,
        profileGenerations: 2000,      // HD_UPDATES3: 2,000/month
        aiQuestions: 2000,             // Matching synth quota
        dailySynthesisLimit: 100,
        dailyQuestionLimit: 200,
        transitSnapshots: Infinity,
        apiCallsPerMonth: 10000,       // 10K API calls/month
        smsDigests: true,
        smsMonthlyLimit: Infinity,
        practitionerTools: true,
        clientManagement: true,
        pdfExport: true,
        compositeCharts: true,         // Full composite access
        diaryEntriesPerMonth: Infinity,
        savedProfilesMax: Infinity,
        whiteLabel: true,
        agencySeats: true,             // HD_UPDATES3: up to 5 sub-account seats
        customWebhooks: true
      }
    }
  };
}

// ─── One-Time Product Configuration (HD_UPDATES3) ────────────

/**
 * Get one-time purchase product configuration
 * @param {Object} env - Cloudflare Worker environment
 * @returns {Object} Product configuration keyed by product slug
 */
export function getOneTimeProducts(env) {
  return {
    single_synthesis: {
      name: 'Single Synthesis',
      price: 1900,  // $19
      priceId: env.STRIPE_PRICE_SINGLE_SYNTHESIS || 'price_placeholder_single_synthesis',
      description: 'One AI-powered Prime Self synthesis',
      grants: { profileGenerations: 1 },
    },
    composite_reading: {
      name: 'Composite Reading',
      price: 2900,  // $29
      priceId: env.STRIPE_PRICE_COMPOSITE_READING || 'price_placeholder_composite_reading',
      description: 'One relationship composite chart synthesis',
      grants: { compositeCharts: 1 },
    },
    transit_pass: {
      name: '30-Day Transit Pass',
      price: 1200,  // $12 — HD_UPDATES3: "30-day transit journal + AI synthesis"
      priceId: env.STRIPE_PRICE_TRANSIT_PASS || 'price_placeholder_transit_pass',
      description: '30 days of full transit insights + AI synthesis (try before you subscribe)',
      grants: { transitPassDays: 30 },
    },
    lifetime_individual: {
      name: 'Lifetime Individual',
      price: 29900,  // $299
      priceId: env.STRIPE_PRICE_LIFETIME_INDIVIDUAL || 'price_placeholder_lifetime',
      description: 'Lifetime access to Individual tier features',
      grants: { lifetimeTier: 'individual' },
    },
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
    httpClient: Stripe.createFetchHttpClient(),  // Use fetch for Cloudflare Workers
    timeout: 10000,  // CTO-005: 10s cap — prevents Worker hanging on Stripe latency
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
  metadata = {},
  trialDays = 0
}) {
  const params = {
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
  };
  if (trialDays > 0) {
    params.subscription_data.trial_period_days = trialDays;
  }
  return await stripe.checkout.sessions.create(params);
}

/**
 * Create a checkout session for one-time purchase (HD_UPDATES3)
 * @param {Stripe} stripe - Stripe client
 * @param {Object} params - Checkout parameters
 * @returns {Promise<Object>} Checkout session
 */
export async function createOneTimeCheckoutSession(stripe, {
  customerId,
  priceId,
  successUrl,
  cancelUrl,
  metadata = {}
}) {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    billing_address_collection: 'auto',
    payment_intent_data: {
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
  const resolvedName = normalizeTierName(tierName);
  const tier = tiers[resolvedName];
  if (!tier) {
    throw new Error(`Invalid tier: ${tierName}`);
  }
  return tier;
}

/**
 * Normalize a tier or legacy alias to the canonical commercial tier name.
 * @param {string|null|undefined} tierName
 * @returns {string}
 */
export function normalizeTierName(tierName) {
  const normalized = tierName ? String(tierName).toLowerCase() : 'free';
  return LEGACY_TIER_MAP[normalized] || normalized;
}

/**
 * Check if user has access to feature based on tier
 * Numeric values (quotas) mean access is granted but rate-limited.
 * @param {string} tierName - User's tier
 * @param {string} feature - Feature name
 * @returns {boolean} Whether user has access
 */
export function hasFeatureAccess(tierName, feature) {
  const tier = getTier(tierName);
  const value = tier.features[feature];
  // Access granted if feature is true, Infinity, or a positive number (quota-limited)
  if (value === true || value === Infinity) return true;
  if (typeof value === 'number' && value > 0) return true;
  return false;
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
function getPriceId(tierName) {
  const tier = getTier(tierName);
  return tier.priceId;
}
