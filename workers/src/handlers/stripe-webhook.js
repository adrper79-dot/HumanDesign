/**
 * Webhook Handler — Stripe Event Processing
 * 
 * POST /api/webhook/stripe — Process Stripe webhook events
 * 
 * Handles events:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 * - checkout.session.completed
 */

import { createStripeClient, verifyWebhook } from '../lib/stripe.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { markReferralAsConverted } from './referrals.js';
import { sendEmail, sendSubscriptionConfirmationEmail, sendRenewalConfirmationEmail, sendDisputeNotificationEmail } from '../lib/email.js';
import { trackEvent, EVENTS } from '../lib/analytics.js';
import { createLogger } from '../lib/logger.js';

/**
 * Map Stripe subscription status to our internal status
 * BL-FIX: Use 'canceled' (American spelling) to match DB enum/constraints
 */
function mapStripeStatus(stripeStatus) {
  const statusMap = {
    'active': 'active',
    'canceled': 'canceled',
    'past_due': 'past_due',
    'unpaid': 'unpaid',
    'incomplete': 'unpaid',
    'incomplete_expired': 'canceled',
    'trialing': 'trialing'
  };
  
  return statusMap[stripeStatus] || 'active';
}

/**
 * Determine tier from Stripe price ID
 * 
 * BL-AUDIT-H3: Added observability for unknown price IDs.
 * If a price ID isn't found in the configured price map (e.g., new Stripe price
 * created via dashboard but not added to wrangler.toml), we log an error instead
 * of silently downgrading to 'free'. This prevents undetected customer downgrades.
 */
function getTierFromPriceId(priceId, env, { log, eventType } = {}) {
  // Accept both new canonical names and legacy env var aliases so existing
  // subscribers and new subscribers both resolve correctly.
  const priceIdMap = {
    [env.STRIPE_PRICE_INDIVIDUAL]:   'individual',   // canonical new name
    [env.STRIPE_PRICE_REGULAR]:      'individual',   // legacy alias → individual
    [env.STRIPE_PRICE_PRACTITIONER]: 'practitioner',
    [env.STRIPE_PRICE_AGENCY]:       'agency',        // canonical new name
    [env.STRIPE_PRICE_WHITE_LABEL]:  'agency',        // legacy alias → agency
  };

  // Filter out undefined keys (unset env vars) before lookup
  const tier = priceIdMap[priceId];
  
  if (!tier) {
    // Log error with context so ops is notified of misconfiguration
    if (log) {
      log.error({
        action: 'unknown_stripe_price_id',
        priceId,
        eventType,
        message: 'Price ID not found in STRIPE_PRICE_* env vars. Check wrangler.toml and Stripe Dashboard.',
      });
    }
    return 'free';
  }
  
  return tier;
}

async function finalizeEventRecord(query, event, details = {}) {
  const obj = event.data?.object;
  await query(QUERIES.finalizeProcessedEvent, [
    event.id,
    details.subscriptionId || null,
    details.eventType || event.type,
    details.amount ?? obj?.amount_paid ?? obj?.amount ?? null,
    details.currency ?? obj?.currency ?? 'usd',
    details.status || obj?.status || 'processed',
    details.failureReason || null,
    JSON.stringify(details.rawEvent || obj || null),
  ]);
}

async function parkEventForManualReview(query, event, log, failureReason, details = {}) {
  await finalizeEventRecord(query, event, {
    ...details,
    status: 'manual_review',
    failureReason,
    rawEvent: details.rawEvent || event.data?.object || null,
  });

  log.error({
    action: 'billing_event_manual_review',
    eventId: event.id,
    eventType: event.type,
    failureReason,
    ...details.logContext,
  });
}

async function resolveUserForStripeCustomer(query, stripe, customerId, { customerEmail, eventType, log }) {
  if (!customerId) {
    return null;
  }

  const userLookup = await query(QUERIES.getUserByStripeCustomerId, [customerId]);
  const directUser = userLookup.rows?.[0] || null;
  if (directUser) {
    return directUser;
  }

  let normalizedEmail = customerEmail?.trim().toLowerCase() || null;

  if (!normalizedEmail) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      normalizedEmail = customer?.email?.trim().toLowerCase() || null;
    } catch (error) {
      log.error({ action: 'billing_event_customer_lookup_failed', customerId, eventType, error: error.message });
      return null;
    }
  }

  if (!normalizedEmail) {
    log.error({ action: 'billing_event_missing_customer_email', customerId, eventType });
    return null;
  }

  const byEmail = await query(QUERIES.getUserByEmailSafe, [normalizedEmail]);
  const emailUser = byEmail.rows?.[0] || null;
  if (!emailUser) {
    log.error({ action: 'billing_event_unrecoverable_user', customerId, customerEmail: normalizedEmail, eventType });
    return null;
  }

  if (emailUser.stripe_customer_id && emailUser.stripe_customer_id !== customerId) {
    log.error({
      action: 'billing_event_customer_conflict',
      customerId,
      customerEmail: normalizedEmail,
      existingStripeCustomerId: emailUser.stripe_customer_id,
      userId: emailUser.id,
      eventType,
    });
    return null;
  }

  await query(QUERIES.updateUserStripeCustomerId, [customerId, emailUser.id]);
  log.warn({ action: 'billing_event_customer_relinked', customerId, customerEmail: normalizedEmail, userId: emailUser.id, eventType });

  return {
    id: emailUser.id,
    email: emailUser.email,
    tier: emailUser.tier,
    stripe_customer_id: customerId,
  };
}

async function resolveSubscriptionForBillingEvent(query, stripe, env, { customerId, subscriptionId, eventType, log }) {
  if (subscriptionId) {
    const bySubscriptionId = await query(QUERIES.getSubscriptionByStripeSubscriptionId, [subscriptionId]);
    if (bySubscriptionId.rows.length > 0) {
      return bySubscriptionId.rows[0];
    }
  }

  if (customerId) {
    const byCustomerId = await query(QUERIES.getSubscriptionByStripeCustomerId, [customerId]);
    if (byCustomerId.rows.length > 0) {
      return byCustomerId.rows[0];
    }
  }

  if (!customerId) {
    log.error({ action: 'billing_event_missing_customer_id', subscriptionId, eventType });
    return null;
  }

  const recoveredUser = await resolveUserForStripeCustomer(query, stripe, customerId, { eventType, log });
  const userId = recoveredUser?.id;
  if (!userId) {
    return null;
  }

  if (!subscriptionId) {
    log.error({ action: 'billing_event_missing_subscription_id', customerId, eventType, userId });
    return null;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    log.error({ action: 'billing_missing_price_id', subscriptionId, customerId, eventType });
    return null;
  }
  const tier = getTierFromPriceId(priceId, env, { log, eventType });
  const status = mapStripeStatus(subscription.status);

  await query.transaction(async (q) => {
    await q(QUERIES.upsertSubscription, [
      userId,
      customerId,
      subscriptionId,
      tier,
      status,
      new Date(subscription.current_period_start * 1000).toISOString(),
      new Date(subscription.current_period_end * 1000).toISOString(),
      subscription.cancel_at_period_end || false,
    ]);
    await q(QUERIES.updateUserTierAndStripe, [tier, customerId, userId]);

    if (tier === 'practitioner' || tier === 'agency' || tier === 'white_label') {
      await q(QUERIES.createPractitioner, [userId, false, tier]);
      await q(QUERIES.updatePractitionerTier, [userId, tier]);
    }
  });

  const recovered = await query(QUERIES.getSubscriptionByStripeSubscriptionId, [subscriptionId]);
  if (recovered.rows.length > 0) {
    log.info({ action: 'billing_event_subscription_recovered', customerId, subscriptionId, userId, eventType, tier });
    return recovered.rows[0];
  }

  log.error({ action: 'billing_event_recovery_failed', customerId, subscriptionId, userId, eventType });
  return null;
}

/**
 * POST /api/webhook/stripe
 * Process Stripe webhook events
 */
export async function handleStripeWebhook(request, env) {
  const log = request._log || createLogger(request._reqId || 'webhook');
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  let claimedEventId = null;

  try {
    // Get raw body and signature
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return Response.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    // Verify webhook signature
    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    let event;
    
    try {
      event = await verifyWebhook(body, signature, env.STRIPE_WEBHOOK_SECRET, stripe);
    } catch (error) {
      log.warn({ action: 'webhook_verify_failed', error: error.message });
      return Response.json({ error: 'Webhook verification failed' }, { status: 400 });
    }

    // Check if event already processed (idempotency)
    const existingEvent = await query(QUERIES.checkEventProcessed, [event.id]);
    if (existingEvent.rows.length > 0) {
      log.info({ action: 'webhook_event_duplicate', eventId: event.id });
      return Response.json({ received: true, already_processed: true }, { status: 200 });
    }

    // CFO-002: Mark event as processing BEFORE handling to prevent concurrent
    // webhook retries from double-processing. Uses ON CONFLICT DO NOTHING
    // so only the first INSERT succeeds — all concurrent attempts are no-ops.
    const obj = event.data?.object;
    const amount   = obj?.amount_paid ?? obj?.amount ?? null;
    const currency = obj?.currency ?? 'usd';
    const inserted = await query(QUERIES.markEventProcessed, [null, event.id, event.type, amount, currency, 'processing']);
    if (inserted.rowCount === 0) {
      // Another worker already claimed this event
      return Response.json({ received: true, already_processed: true }, { status: 200 });
    }
    claimedEventId = event.id;

    log.info({ action: 'webhook_event_processing', type: event.type, eventId: event.id });

    // Process event based on type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, query, stripe, env, log);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event, query, env, log);
        break;

      case 'customer.subscription.paused':
        await handleSubscriptionPaused(event, query, log);
        break;

      case 'customer.subscription.resumed':
        await handleSubscriptionUpdated(event, query, env, log);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, query, log);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event, query, stripe, env, log);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event, query, stripe, env, log);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event, query, stripe, env, log);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event, query, log);
        break;

      case 'charge.dispute.created':
        await handleChargeDispute(event, query, stripe, env, log);
        break;

      default:
        log.info({ action: 'webhook_event_unhandled', type: event.type });
        await finalizeEventRecord(query, event, { status: 'ignored' });
    }

    return Response.json({ received: true }, { status: 200 });

  } catch (error) {
    if (claimedEventId) {
      try {
        await query(QUERIES.releaseProcessedEvent, [claimedEventId]);
      } catch (releaseError) {
        log.error({ action: 'webhook_release_claim_failed', eventId: claimedEventId, error: releaseError.message });
      }
    }
    log.error({ action: 'webhook_processing_error', error: error.message, stack: error.stack });
    return Response.json({ 
      error: 'Webhook processing failed' // BL-R-H2
    }, { status: 500 });
  }
}

/**
 * Handle checkout.session.completed
 * BL-FIX: Use UPSERT to handle case where subscription row doesn't exist yet
 */
export async function handleCheckoutCompleted(event, query, stripe, env, log) {
  const session = event.data.object;
  const customerId = session.customer;
  const userId = session.metadata?.user_id;

  if (!userId) {
    log.error({ action: 'checkout_missing_user_id', sessionId: session.id });
    return;
  }

  // HD_UPDATES3: Handle one-time purchases (mode: 'payment')
  if (session.mode === 'payment') {
    await handleOneTimePurchaseCompleted(session, query, userId, log);
    await finalizeEventRecord(query, event, { status: 'succeeded' });
    return;
  }

  // Subscription checkout flow (existing logic)
  const subscriptionId = session.subscription;

  // Fetch full subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    log.error({ action: 'checkout_missing_price_id', subscriptionId, sessionId: session.id });
    return Response.json({ received: true, warning: 'subscription has no price' }, { status: 200 });
  }
  const tier = getTierFromPriceId(priceId, env, { log, eventType: event.type });

  // Atomic: upsert subscription + update user tier together
  await query.transaction(async (q) => {
    // BL-FIX: Use upsertSubscription instead of updateSubscription
    // This handles the case when this is a new subscription (no row exists)
    await q(QUERIES.upsertSubscription, [
      userId,
      customerId,
      subscriptionId,
      tier,
      mapStripeStatus(subscription.status),
      new Date(subscription.current_period_start * 1000).toISOString(),
      new Date(subscription.current_period_end * 1000).toISOString(),
      subscription.cancel_at_period_end || false
    ]);

    // BL-R-C4: Also update users.tier and stripe_customer_id (was only in billing.js)
    await q(QUERIES.updateUserTierAndStripe, [tier, customerId, userId]);
  });

  // Track referral conversion
  try { await markReferralAsConverted(env, userId); } catch (e) { log.warn({ action: 'referral_tracking_error', userId, error: e.message }); }

  // Send subscription confirmation email (fire and forget)
  if (env.RESEND_API_KEY) {
    const TIER_LABELS = {
      individual: 'Explorer', regular: 'Explorer',
      practitioner: 'Practitioner',
      agency: 'Studio', white_label: 'Studio'
    };
    const tierLabel = TIER_LABELS[tier] || tier;
    // Look up user email
    try {
      const userResult = await query(QUERIES.getUserByIdSafe, [userId]);
      const userEmail = userResult.rows?.[0]?.email;
      if (userEmail) {
        sendSubscriptionConfirmationEmail(
          userEmail, tierLabel, env.RESEND_API_KEY,
          env.FROM_EMAIL || 'Prime Self <hello@primeself.app>',
          env.COMPANY_ADDRESS || ''
        ).catch(err => log.warn({ action: 'subscription_email_failed', error: err.message }));
      }
    } catch (e) { log.warn({ action: 'subscription_email_lookup_failed', error: e.message }); }
  }

  log.info({ action: 'checkout_completed', userId, tier });
  trackEvent(env, EVENTS.CHECKOUT_COMPLETE, { userId, tier }).catch(e => log.warn({ action: 'track_event_failed', event: 'checkout_complete', error: e.message }));
  await finalizeEventRecord(query, event, {
    subscriptionId,
    status: 'succeeded',
  });
}

/**
 * HD_UPDATES3: Handle one-time purchase checkout completion
 * Grants credits/access based on product metadata
 */
async function handleOneTimePurchaseCompleted(session, query, userId, log) {
  const product = session.metadata?.product;
  const grantsRaw = session.metadata?.grants;

  if (!product || !grantsRaw) {
    log.error({ action: 'onetime_missing_metadata', sessionId: session.id });
    return;
  }

  let grants;
  try { grants = JSON.parse(grantsRaw); } catch {
    log.error({ action: 'onetime_invalid_grants_json', sessionId: session.id });
    return;
  }

  // Use the session ID as the endpoint to enable dedup
  const dedupEndpoint = `one-time:${session.id}`;

  const applied = await query.transaction(async (q) => {
    // Re-check inside the transaction so partial prior fulfillment cannot
    // leave a second attempt applying another subset of grants.
    const existingGrant = await q(
      `SELECT 1 FROM usage_records WHERE endpoint = $1 LIMIT 1`,
      [dedupEndpoint]
    );
    if (existingGrant.rows.length > 0) {
      return false;
    }

    if (grants.profileGenerations) {
      await q(QUERIES.createUsageRecord, [
        userId, 'profile_generation_bonus', dedupEndpoint, -grants.profileGenerations
      ]);
    }

    if (grants.compositeCharts) {
      await q(QUERIES.createUsageRecord, [
        userId, 'composite_chart_bonus', dedupEndpoint, -grants.compositeCharts
      ]);
    }

    if (grants.transitPassDays) {
      const expiresAt = new Date(Date.now() + grants.transitPassDays * 86400000).toISOString();
      await q(QUERIES.createUsageRecord, [
        userId, 'transit_pass', dedupEndpoint, -1
      ]);
      await q(QUERIES.updateTransitPassExpiry, [expiresAt, userId]);
    }

    if (grants.lifetimeTier) {
      await q(QUERIES.grantLifetimeAccess, [
        grants.lifetimeTier, userId
      ]);
    }

    return true;
  });

  if (!applied) {
    log.info({ action: 'onetime_dedup_skip', sessionId: session.id });
    return;
  }

  log.info({ action: 'onetime_fulfilled', product, userId, grants });
}

/**
 * Handle customer.subscription.created/updated
 */
export async function handleSubscriptionUpdated(event, query, env, log) {
  const subscription = event.data.object;
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    log.error({ action: 'subscription_update_missing_price_id', subscriptionId, customerId });
    return Response.json({ received: true, warning: 'subscription has no price' }, { status: 200 });
  }
  const tier = getTierFromPriceId(priceId, env, { log, eventType: event.type });

  // Find subscription by customer ID
  const existingSub = await query(QUERIES.getSubscriptionByStripeCustomerId, [customerId]);

  if (existingSub.rows.length === 0) {
    // CFO-009 FIX: Instead of silently returning, create the missing DB record.
    // This handles the case where checkout.session.completed webhook failed
    // but Stripe still created the subscription.
    log.warn({ action: 'ghost_subscription_detected', customerId, subscriptionId, tier });

    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    const recoveredUser = await resolveUserForStripeCustomer(query, stripe, customerId, {
      customerEmail: subscription.customer_email,
      eventType: event.type,
      log,
    });
    const ghostUserId = recoveredUser?.id;
    if (!ghostUserId) {
      await parkEventForManualReview(
        query,
        event,
        log,
        'unmapped_customer',
        {
          eventType: 'subscription_manual_review',
          rawEvent: subscription,
          logContext: { customerId, subscriptionId },
        }
      );
      return;
    }

    // Create the missing subscription record
    await query.transaction(async (q) => {
      await q(QUERIES.upsertSubscription, [
        ghostUserId, customerId, subscriptionId, tier,
        mapStripeStatus(subscription.status),
        new Date(subscription.current_period_start * 1000).toISOString(),
        new Date(subscription.current_period_end * 1000).toISOString(),
        subscription.cancel_at_period_end || false
      ]);
      await q(QUERIES.updateUserTier, [tier, ghostUserId]);
    });
    log.info({ action: 'ghost_subscription_resolved', userId: ghostUserId, tier });
    await finalizeEventRecord(query, event, {
      subscriptionId: subscriptionId,
      status: mapStripeStatus(subscription.status),
    });
    return;
  }

  const userId = existingSub.rows[0].user_id;

  // Atomic: update subscription + user tier together
  await query.transaction(async (q) => {
    await q(QUERIES.updateSubscription, [
      userId,
      subscriptionId,
      tier,
      mapStripeStatus(subscription.status),
      new Date(subscription.current_period_start * 1000).toISOString(),
      new Date(subscription.current_period_end * 1000).toISOString(),
      subscription.cancel_at_period_end
    ]);

    // BL-R-C4: Also sync users.tier to match subscription state
    await q(QUERIES.updateUserTier, [tier, userId]);

    // Ensure a practitioners row exists + keep practitioners.tier in sync.
    // createPractitioner uses ON CONFLICT DO NOTHING, so we follow it with an
    // explicit UPDATE to ensure the tier is current for existing practitioners.
    if (tier === 'practitioner' || tier === 'agency' || tier === 'white_label') {
      await q(QUERIES.createPractitioner, [userId, false, tier]);
      await q(QUERIES.updatePractitionerTier, [userId, tier]);
    }
  });

  log.info({ action: 'subscription_updated', userId, tier, status: subscription.status });
  await finalizeEventRecord(query, event, {
    subscriptionId,
    status: mapStripeStatus(subscription.status),
  });
}

/**
 * Handle customer.subscription.deleted
 */
async function handleSubscriptionDeleted(event, query, log) {
  const subscription = event.data.object;
  const subscriptionId = subscription.id;

  // Update subscription status to cancelled and downgrade to free
  const result = await query(QUERIES.getSubscriptionByStripeSubscriptionId, [subscriptionId]);
  
  if (result.rows.length === 0) {
    log.error({ action: 'subscription_delete_not_found', subscriptionId });
    return;
  }

  const userId = result.rows[0].user_id;

  // Atomic: cancel subscription + downgrade user tier
  await query.transaction(async (q) => {
    await q(QUERIES.updateSubscription, [
      userId,
      subscriptionId,
      'free',
      'canceled',
      null,
      null,
      false
    ]);

    // BL-R-C4: Also downgrade user tier in users table
    await q(QUERIES.updateUserTier, ['free', userId]);
    // Sync practitioners.tier so cancelled practitioners lose feature access immediately
    await q(QUERIES.updatePractitionerTier, [userId, 'free']);
  });

  log.info({ action: 'subscription_cancelled', userId });
  await finalizeEventRecord(query, event, {
    subscriptionId,
    status: 'canceled',
  });
}

/**
 * Handle customer.subscription.paused
 * Sets status to paused and downgrades tier to free until resumed.
 */
async function handleSubscriptionPaused(event, query, log) {
  const subscription = event.data.object;
  const subscriptionId = subscription.id;

  const result = await query(QUERIES.getSubscriptionByStripeSubscriptionId, [subscriptionId]);
  if (result.rows.length === 0) {
    log.error({ action: 'subscription_pause_not_found', subscriptionId });
    return;
  }

  const userId = result.rows[0].user_id;

  await query.transaction(async (q) => {
    await q(QUERIES.updateSubscriptionStatus, [subscriptionId, 'paused']);
    await q(QUERIES.updateUserTier, ['free', userId]);
    // Sync practitioners.tier so paused practitioners lose feature access immediately
    await q(QUERIES.updatePractitionerTier, [userId, 'free']);
  });

  log.info({ action: 'subscription_paused', userId, subscriptionId });
  await finalizeEventRecord(query, event, { subscriptionId, status: 'paused' });
}

/**
 * Handle invoice.payment_succeeded
 */
async function handlePaymentSucceeded(event, query, stripe, env, log) {
  const invoice = event.data.object;
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;
  const amount = invoice.amount_paid;
  const currency = invoice.currency;

  const subscriptionRow = await resolveSubscriptionForBillingEvent(query, stripe, env, {
    customerId,
    subscriptionId,
    eventType: 'invoice.payment_succeeded',
    log,
  });

  if (!subscriptionRow) {
    await parkEventForManualReview(
      query,
      event,
      log,
      'unmapped_customer',
      {
        eventType: 'payment_succeeded_manual_review',
        amount,
        currency,
        rawEvent: invoice,
        logContext: { customerId, subscriptionId },
      }
    );
    return;
  }

  const subscriptionDbId = subscriptionRow.id;

  await finalizeEventRecord(query, event, {
    subscriptionId: subscriptionDbId,
    eventType: 'payment_succeeded',
    amount,
    currency,
    status: 'succeeded',
  });

  log.info({ action: 'payment_succeeded', subscriptionId, amount, currency });
}

/**
 * Handle invoice.payment_failed
 */
async function handlePaymentFailed(event, query, stripe, env, log) {
  const invoice = event.data.object;
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;
  const amount = invoice.amount_due;
  const currency = invoice.currency;
  const failureReason = invoice.last_payment_error?.message || 'Unknown error';

  const subscriptionRow = await resolveSubscriptionForBillingEvent(query, stripe, env, {
    customerId,
    subscriptionId,
    eventType: 'invoice.payment_failed',
    log,
  });

  if (!subscriptionRow) {
    await parkEventForManualReview(
      query,
      event,
      log,
      'unmapped_customer',
      {
        eventType: 'payment_failed_manual_review',
        amount,
        currency,
        rawEvent: invoice,
        logContext: { customerId, subscriptionId },
      }
    );
    return;
  }

  const subscriptionDbId = subscriptionRow.id;
  const userId = subscriptionRow.user_id;

  await finalizeEventRecord(query, event, {
    subscriptionId: subscriptionDbId,
    eventType: 'payment_failed',
    amount,
    currency,
    status: 'failed',
    failureReason,
  });

  // Update subscription status to past_due
  await query(QUERIES.updateSubscriptionStatus, [subscriptionId, 'past_due']);

  // BL-R-C4: Send payment failure email (was only in billing.js)
  if (invoice.customer_email && env.RESEND_API_KEY) {
    const customerName = invoice.customer_name || 'there';
    try {
      await sendEmail({
        to: invoice.customer_email,
        subject: 'Payment failed — action required',
        html: `
<!DOCTYPE html><html><head><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}
.header{text-align:center;padding:20px 0;border-bottom:2px solid #C9A84C}.logo{font-size:24px;font-weight:700;color:#C9A84C}
.content{padding:30px 0}.cta{background:#C9A84C;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;display:inline-block;margin:20px 0;font-weight:600}
.footer{border-top:1px solid #eee;padding-top:20px;margin-top:30px;font-size:12px;color:#666}
</style></head><body>
<div class="header"><div class="logo">Prime Self</div></div>
<div class="content"><h2>Your payment didn't go through</h2>
<p>Hey ${customerName},</p>
<p>We tried to process your subscription payment but it was declined. Your access will remain active for a few days while you update your payment method.</p>
<p><strong>What to do:</strong></p><ol><li>Visit your billing portal</li><li>Update your payment method</li><li>We'll retry the charge automatically</li></ol>
<a href="https://primeself.app/billing" class="cta">Update Payment Method →</a>
<p>If you have any questions, reply to this email and we'll help.</p><p>— The Prime Self Team</p></div>
<div class="footer"><p>You're receiving this because your subscription payment failed.</p></div>
</body></html>`,
        companyAddress: env.COMPANY_ADDRESS || ''
      }, env.RESEND_API_KEY, env.FROM_EMAIL || 'Prime Self <hello@primeself.app>');
    } catch (err) {
      log.warn({ action: 'payment_failure_email_error', error: err.message });
    }
  }

  log.error({ action: 'payment_failed', subscriptionId });
}

/**
 * Handle invoice.paid — BL-R-C4: Consolidated from billing.js
 * HD_UPDATES3: Now includes 25% recurring revenue share for referrers
 */
async function handleInvoicePaid(event, query, stripe, env, log) {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;
  const amountPaid = invoice.amount_paid;

  const subscriptionRow = await resolveSubscriptionForBillingEvent(query, stripe, env, {
    customerId: invoice.customer,
    subscriptionId,
    eventType: 'invoice.paid',
    log,
  });
  if (!subscriptionRow) {
    await parkEventForManualReview(
      query,
      event,
      log,
      'unmapped_customer',
      {
        eventType: 'invoice_paid_manual_review',
        amount: amountPaid,
        currency: invoice.currency,
        rawEvent: invoice,
        logContext: { customerId: invoice.customer, subscriptionId },
      }
    );
    return;
  }

  const subscriptionDbId = subscriptionRow.id;
  const userId = subscriptionRow.user_id;

  await finalizeEventRecord(query, event, {
    subscriptionId: subscriptionDbId,
    eventType: 'invoice_paid',
    amount: amountPaid,
    currency: invoice.currency,
    status: 'succeeded',
  });

  log.info({ action: 'invoice_paid', subscriptionId, amount: amountPaid, currency: invoice.currency });

  // HD_UPDATES3: 25% recurring revenue share — credit referrer on each renewal
  // SYS-008: All tiers get 25% share; Agency tier has additional 50% credit cap (max $174/mo on $349 plan)
  if (amountPaid > 0 && userId && env.STRIPE_SECRET_KEY) {
    try {
      const refResult = await query(QUERIES.getReferrerForUser, [userId]);
      const referrer = refResult.rows[0];

      if (referrer?.referrer_stripe_id) {
        // All tiers: 25% base share
        let creditAmount = Math.floor(amountPaid * 0.25);
        
        // Agency tier: cap credit at 50% of subscription cost (financial boundary per spec)
        if (subscriptionRow.tier === 'agency') {
          const agencyCap = Math.floor(amountPaid * 0.50);
          creditAmount = Math.min(creditAmount, agencyCap);
        }

        if (creditAmount > 0) {
          const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
          await stripe.customers.createBalanceTransaction(referrer.referrer_stripe_id, {
            amount: -creditAmount,  // Negative = credit
            currency: invoice.currency || 'usd',
            description: `Referral revenue share (25% of $${(amountPaid / 100).toFixed(2)} payment${subscriptionRow.tier === 'agency' ? ', capped at 50%' : ''})`,
          }, {
            idempotencyKey: `referral-credit-${event.id}`,
          });
          log.info({ 
            action: 'referral_credit_applied', 
            amount: creditAmount, 
            referrerStripeId: referrer.referrer_stripe_id,
            tier: subscriptionRow.tier,
            baseCreditBefore: Math.floor(amountPaid * 0.25),
          });
        }
      }
    } catch (refErr) {
      // Don't fail the invoice handler for referral credit errors
      log.warn({ action: 'referral_share_error', error: refErr.message });
    }
  }

  // SYS-017: Send renewal confirmation email (fire-and-forget)
  if (env.RESEND_API_KEY && subscriptionRow.user_email) {
    sendRenewalConfirmationEmail(
      subscriptionRow.user_email,
      null,
      subscriptionRow.tier,
      amountPaid,
      new Date(Date.now() + 30 * 86400000).toLocaleDateString(),
      env.RESEND_API_KEY,
      env.FROM_EMAIL,
      env.COMPANY_ADDRESS || ''
    ).catch(() => {});
  }
}

/**
 * Handle charge.refunded — TXN-016 FIX + P2-BIZ-003 FIX
 * Only downgrade to free tier on FULL refund. Partial refunds log
 * the event but preserve the user's current tier.
 */
async function handleChargeRefunded(event, query, log) {
  const charge = event.data.object;
  const customerId = charge.customer;

  if (!customerId) {
    log.error({ action: 'refund_no_customer_id', chargeId: charge.id });
    return;
  }

  const result = await query(QUERIES.getSubscriptionByStripeCustomerId, [customerId]);

  if (result.rows.length === 0) {
    log.error({ action: 'refund_no_subscription', customerId });
    return;
  }

  const userId = result.rows[0].user_id;
  const subscriptionDbId = result.rows[0].id;

  await finalizeEventRecord(query, event, {
    subscriptionId: subscriptionDbId,
    eventType: 'charge_refunded',
    amount: charge.amount_refunded,
    currency: charge.currency,
    status: 'refunded',
    rawEvent: charge,
  });

  // P2-BIZ-003: Only downgrade on FULL refund — partial refund preserves tier
  const isFullRefund = charge.refunded === true;
  if (isFullRefund) {
    await query(QUERIES.updateUserTier, ['free', userId]);
    log.info({ action: 'full_refund_downgrade', userId, amount: charge.amount_refunded, currency: charge.currency });
  } else {
    log.info({ action: 'partial_refund_preserved', userId, refunded: charge.amount_refunded, total: charge.amount, currency: charge.currency });
  }
}

/**
 * Handle charge.dispute.created — TXN-025 FIX
 * Downgrade user to free tier when a chargeback/dispute is opened.
 */
async function handleChargeDispute(event, query, stripe, env, log) {
  const dispute = event.data.object;
  const chargeId = dispute.charge;

  let customerId = dispute.customer;

  // If customer not on dispute object, look it up from the charge
  if (!customerId && chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId);
      customerId = charge.customer;
    } catch (err) {
      log.error({ action: 'dispute_charge_lookup_failed', chargeId, error: err.message });
    }
  }

  if (!customerId) {
    log.error({ action: 'dispute_no_customer_id', disputeId: dispute.id });
    return;
  }

  const result = await query(QUERIES.getSubscriptionByStripeCustomerId, [customerId]);

  if (result.rows.length === 0) {
    log.error({ action: 'dispute_no_subscription', customerId });
    return;
  }

  const userId = result.rows[0].user_id;
  const subscriptionDbId = result.rows[0].id;

  await finalizeEventRecord(query, event, {
    subscriptionId: subscriptionDbId,
    eventType: 'charge_dispute',
    amount: dispute.amount,
    currency: dispute.currency,
    status: 'disputed',
    failureReason: dispute.reason || 'unknown',
    rawEvent: dispute,
  });

  // Downgrade user to free tier immediately
  await query(QUERIES.updateUserTier, ['free', userId]);

  log.error({ action: 'dispute_opened', userId, chargeId, amount: dispute.amount, currency: dispute.currency, reason: dispute.reason });

  // SYS-017: Notify user of dispute via email (fire-and-forget)
  if (env?.RESEND_API_KEY) {
    try {
      const userResult = await query(QUERIES.getUserByIdSafe, [userId]);
      const userEmail = userResult.rows[0]?.email;
      if (userEmail) {
        sendDisputeNotificationEmail(
          userEmail, dispute.amount, dispute.currency, dispute.reason || 'unknown',
          env.RESEND_API_KEY, env.FROM_EMAIL, env.COMPANY_ADDRESS || ''
        ).catch(() => {});
      }
    } catch (emailErr) {
      log.warn({ action: 'dispute_email_error', error: emailErr.message });
    }
  }
}

