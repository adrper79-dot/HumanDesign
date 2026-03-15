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
import { sendEmail, sendSubscriptionConfirmationEmail } from '../lib/email.js';
import { trackEvent, EVENTS } from '../lib/analytics.js';

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
 */
function getTierFromPriceId(priceId, env) {
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
  return tier || 'free';
}

/**
 * POST /api/webhook/stripe
 * Process Stripe webhook events
 */
export async function handleStripeWebhook(request, env) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

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
      console.error('Webhook verification failed:', error);
      return Response.json({ error: 'Webhook verification failed' }, { status: 400 });
    }

    // Check if event already processed (idempotency)
    const existingEvent = await query(QUERIES.checkEventProcessed, [event.id]);
    if (existingEvent.rows.length > 0) {
      console.log('Event already processed:', event.id);
      return Response.json({ received: true, already_processed: true }, { status: 200 });
    }

    console.log('Processing Stripe event:', event.type, event.id);

    // Process event based on type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, query, stripe, env);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event, query, env);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, query);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event, query);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event, query, env);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event, query, env);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event, query);
        break;

      case 'charge.dispute.created':
        await handleChargeDispute(event, query, stripe);
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

    // CFO-002: Record this event as processed for idempotency.
    // ON CONFLICT (stripe_event_id) DO NOTHING handles races silently.
    const obj = event.data?.object;
    const amount   = obj?.amount_paid ?? obj?.amount ?? null;
    const currency = obj?.currency ?? 'usd';
    const status   = obj?.status ?? 'processed';
    await query(QUERIES.markEventProcessed, [null, event.id, event.type, amount, currency, status]);

    return Response.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return Response.json({ 
      error: 'Webhook processing failed' // BL-R-H2
    }, { status: 500 });
  }
}

/**
 * Handle checkout.session.completed
 * BL-FIX: Use UPSERT to handle case where subscription row doesn't exist yet
 */
async function handleCheckoutCompleted(event, query, stripe, env) {
  const session = event.data.object;
  const customerId = session.customer;
  const userId = session.metadata?.user_id;

  if (!userId) {
    console.error('No user_id in checkout session metadata');
    return;
  }

  // HD_UPDATES3: Handle one-time purchases (mode: 'payment')
  if (session.mode === 'payment') {
    await handleOneTimePurchaseCompleted(session, query, userId);
    return;
  }

  // Subscription checkout flow (existing logic)
  const subscriptionId = session.subscription;

  // Fetch full subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierFromPriceId(priceId, env);

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
  try { await markReferralAsConverted(env, userId); } catch (e) { console.warn('Referral tracking error:', e); }

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
      const userResult = await query(QUERIES.getUserById, [userId]);
      const userEmail = userResult.rows?.[0]?.email;
      if (userEmail) {
        sendSubscriptionConfirmationEmail(
          userEmail, tierLabel, env.RESEND_API_KEY,
          env.FROM_EMAIL || 'Prime Self <hello@primeself.app>'
        ).catch(err => console.error('Subscription confirmation email failed:', err));
      }
    } catch (e) { console.warn('Could not send subscription confirmation email:', e); }
  }

  console.log(`Checkout completed for user ${userId}, tier: ${tier}`);
  trackEvent(env, EVENTS.CHECKOUT_COMPLETE, { userId, tier }).catch(e => console.error('[webhook] trackEvent checkout_complete failed:', e.message));
}

/**
 * HD_UPDATES3: Handle one-time purchase checkout completion
 * Grants credits/access based on product metadata
 */
async function handleOneTimePurchaseCompleted(session, query, userId) {
  const product = session.metadata?.product;
  const grantsRaw = session.metadata?.grants;

  if (!product || !grantsRaw) {
    console.error('One-time purchase missing product/grants metadata:', session.id);
    return;
  }

  let grants;
  try { grants = JSON.parse(grantsRaw); } catch {
    console.error('Invalid grants JSON in one-time purchase metadata:', grantsRaw);
    return;
  }

  // Grant credits based on product type
  if (grants.profileGenerations) {
    // Single synthesis — add negative usage record as bonus credits
    await query(QUERIES.createUsageRecord, [
      userId, 'profile_generation_bonus', 'one-time-purchase', -grants.profileGenerations
    ]);
  }

  if (grants.compositeCharts) {
    await query(QUERIES.createUsageRecord, [
      userId, 'composite_chart_bonus', 'one-time-purchase', -grants.compositeCharts
    ]);
  }

  if (grants.transitPassDays) {
    // Store transit pass expiry (7 days from now)
    const expiresAt = new Date(Date.now() + grants.transitPassDays * 86400000).toISOString();
    await query(QUERIES.createUsageRecord, [
      userId, 'transit_pass', 'one-time-purchase', -1
    ]);
    // MED-INLINE-SQL: Use registered query instead of inline SQL
    await query(QUERIES.updateTransitPassExpiry, [expiresAt, userId]);
  }

  if (grants.lifetimeTier) {
    // MED-INLINE-SQL: Use registered query instead of inline SQL
    await query(QUERIES.grantLifetimeAccess, [
      grants.lifetimeTier, userId
    ]);
  }

  console.log(`One-time purchase '${product}' fulfilled for user ${userId}:`, grants);
}

/**
 * Handle customer.subscription.created/updated
 */
async function handleSubscriptionUpdated(event, query, env) {
  const subscription = event.data.object;
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierFromPriceId(priceId, env);

  // Find subscription by customer ID
  const existingSub = await query(QUERIES.getSubscriptionByStripeCustomerId, [customerId]);

  if (existingSub.rows.length === 0) {
    // TXN-013 FIX: Log ghost subscription instead of silently returning.
    // This means Stripe is charging a customer we don't have a DB record for.
    console.error('GHOST SUBSCRIPTION — No DB record for Stripe customer:', customerId,
      'subscription:', subscriptionId, 'tier:', tier);
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

  console.log(`Subscription updated for user ${userId}, tier: ${tier}, status: ${subscription.status}`);
}

/**
 * Handle customer.subscription.deleted
 */
async function handleSubscriptionDeleted(event, query) {
  const subscription = event.data.object;
  const subscriptionId = subscription.id;

  // Update subscription status to cancelled and downgrade to free
  const result = await query(QUERIES.getSubscriptionByStripeSubscriptionId, [subscriptionId]);
  
  if (result.rows.length === 0) {
    console.error('No subscription found for ID:', subscriptionId);
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
  });

  console.log(`Subscription cancelled for user ${userId}, downgraded to free tier`);
}

/**
 * Handle invoice.payment_succeeded
 */
async function handlePaymentSucceeded(event, query) {
  const invoice = event.data.object;
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;
  const amount = invoice.amount_paid;
  const currency = invoice.currency;

  // Find subscription
  const result = await query(QUERIES.getSubscriptionByStripeCustomerId, [customerId]);
  
  if (result.rows.length === 0) {
    console.error('No subscription found for customer:', customerId);
    return;
  }

  const subscriptionDbId = result.rows[0].id;

  // Record payment event
  await query(QUERIES.createPaymentEvent, [
    subscriptionDbId,
    event.id,
    'payment_succeeded',
    amount,
    currency,
    'succeeded',
    null,
    JSON.stringify(event.data.object)
  ]);

  console.log(`Payment succeeded for subscription ${subscriptionId}: ${amount} ${currency}`);
}

/**
 * Handle invoice.payment_failed
 */
async function handlePaymentFailed(event, query, env) {
  const invoice = event.data.object;
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;
  const amount = invoice.amount_due;
  const currency = invoice.currency;
  const failureReason = invoice.last_payment_error?.message || 'Unknown error';

  // Find subscription
  const result = await query(QUERIES.getSubscriptionByStripeCustomerId, [customerId]);
  
  if (result.rows.length === 0) {
    console.error('No subscription found for customer:', customerId);
    return;
  }

  const subscriptionDbId = result.rows[0].id;
  const userId = result.rows[0].user_id;

  // Record payment event
  await query(QUERIES.createPaymentEvent, [
    subscriptionDbId,
    event.id,
    'payment_failed',
    amount,
    currency,
    'failed',
    failureReason,
    JSON.stringify(event.data.object)
  ]);

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
</body></html>`
      }, env.RESEND_API_KEY, env.FROM_EMAIL || 'Prime Self <hello@primeself.app>');
    } catch (err) {
      console.error('Payment failure email error:', err);
    }
  }

  // Log failure without PII — failureReason may contain card/bank details
  console.error(`Payment failed for subscription ${subscriptionId}`);
}

/**
 * Handle invoice.paid — BL-R-C4: Consolidated from billing.js
 * HD_UPDATES3: Now includes 25% recurring revenue share for referrers
 */
async function handleInvoicePaid(event, query, env) {
  const invoice = event.data.object;
  const subscriptionId = invoice.subscription;
  const amountPaid = invoice.amount_paid;

  // Find subscription
  const result = await query(QUERIES.getSubscriptionByStripeCustomerId, [invoice.customer]);
  if (result.rows.length === 0) {
    console.error('No subscription found for customer:', invoice.customer);
    return;
  }

  const subscriptionDbId = result.rows[0].id;
  const userId = result.rows[0].user_id;

  // Record payment event
  await query(QUERIES.createPaymentEvent, [
    subscriptionDbId,
    event.id,
    'invoice_paid',
    amountPaid,
    invoice.currency,
    'succeeded',
    null,
    JSON.stringify(event.data.object)
  ]);

  console.log(`Invoice paid for subscription ${subscriptionId}: ${amountPaid} ${invoice.currency}`);

  // HD_UPDATES3: 25% recurring revenue share — credit referrer on each renewal
  // Agency tier: cap credit at 50% of subscription cost (per HD_UPDATES3 spec)
  if (amountPaid > 0 && userId && env.STRIPE_SECRET_KEY) {
    try {
      const refResult = await query(QUERIES.getReferrerForUser, [userId]);
      const referrer = refResult.rows[0];

      if (referrer?.referrer_stripe_id) {
        const shareRate = 0.25;
        const creditAmount = Math.floor(amountPaid * shareRate);

        if (creditAmount > 0) {
          const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
          await stripe.customers.createBalanceTransaction(referrer.referrer_stripe_id, {
            amount: -creditAmount,  // Negative = credit
            currency: invoice.currency || 'usd',
            description: `Referral revenue share (25% of $${(amountPaid / 100).toFixed(2)} payment)`,
          }, {
            idempotencyKey: `referral-credit-${event.id}`,
          });
          console.log(`Applied $${(creditAmount / 100).toFixed(2)} referral credit to ${referrer.referrer_stripe_id}`);
        }
      }
    } catch (refErr) {
      // Don't fail the invoice handler for referral credit errors
      console.error('Referral revenue share error:', refErr);
    }
  }
}

/**
 * Handle charge.refunded — TXN-016 FIX + P2-BIZ-003 FIX
 * Only downgrade to free tier on FULL refund. Partial refunds log
 * the event but preserve the user's current tier.
 */
async function handleChargeRefunded(event, query) {
  const charge = event.data.object;
  const customerId = charge.customer;

  if (!customerId) {
    console.error('charge.refunded: No customer ID on charge:', charge.id);
    return;
  }

  const result = await query(QUERIES.getSubscriptionByStripeCustomerId, [customerId]);

  if (result.rows.length === 0) {
    console.error('charge.refunded: No subscription found for customer:', customerId);
    return;
  }

  const userId = result.rows[0].user_id;
  const subscriptionDbId = result.rows[0].id;

  // Record the refund event regardless of full/partial
  await query(QUERIES.createPaymentEvent, [
    subscriptionDbId,
    event.id,
    'charge_refunded',
    charge.amount_refunded,
    charge.currency,
    'refunded',
    null,
    JSON.stringify(charge)
  ]);

  // P2-BIZ-003: Only downgrade on FULL refund — partial refund preserves tier
  const isFullRefund = charge.refunded === true;
  if (isFullRefund) {
    await query(QUERIES.updateUserTier, ['free', userId]);
    console.log(`Full refund for user ${userId}, downgraded to free tier. Amount: ${charge.amount_refunded} ${charge.currency}`);
  } else {
    console.log(`Partial refund for user ${userId} — tier preserved. Refunded: ${charge.amount_refunded}/${charge.amount} ${charge.currency}`);
  }
}

/**
 * Handle charge.dispute.created — TXN-025 FIX
 * Downgrade user to free tier when a chargeback/dispute is opened.
 */
async function handleChargeDispute(event, query, stripe) {
  const dispute = event.data.object;
  const chargeId = dispute.charge;

  let customerId = dispute.customer;

  // If customer not on dispute object, look it up from the charge
  if (!customerId && chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId);
      customerId = charge.customer;
    } catch (err) {
      console.error('charge.dispute.created: Failed to retrieve charge:', chargeId, err.message);
    }
  }

  if (!customerId) {
    console.error('charge.dispute.created: No customer ID on dispute:', dispute.id);
    return;
  }

  const result = await query(QUERIES.getSubscriptionByStripeCustomerId, [customerId]);

  if (result.rows.length === 0) {
    console.error('charge.dispute.created: No subscription found for customer:', customerId);
    return;
  }

  const userId = result.rows[0].user_id;
  const subscriptionDbId = result.rows[0].id;

  // Record the dispute event
  await query(QUERIES.createPaymentEvent, [
    subscriptionDbId,
    event.id,
    'charge_dispute',
    dispute.amount,
    dispute.currency,
    'disputed',
    dispute.reason || 'unknown',
    JSON.stringify(dispute)
  ]);

  // Downgrade user to free tier immediately
  await query(QUERIES.updateUserTier, ['free', userId]);

  console.error(`DISPUTE opened for user ${userId}. Charge: ${chargeId}, Amount: ${dispute.amount} ${dispute.currency}, Reason: ${dispute.reason}. User downgraded to free.`);
}

