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
import { sendEmail } from '../lib/email.js';

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
  const priceIdMap = {
    [env.STRIPE_PRICE_SEEKER]: 'seeker',
    [env.STRIPE_PRICE_GUIDE]: 'guide',
    [env.STRIPE_PRICE_PRACTITIONER]: 'practitioner',
    'price_seeker': 'seeker',
    'price_guide': 'guide',
    'price_practitioner': 'practitioner'
  };
  
  return priceIdMap[priceId] || 'free';
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
      event = verifyWebhook(body, signature, env.STRIPE_WEBHOOK_SECRET, stripe);
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
        await handleInvoicePaid(event, query);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event, query, env);
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

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
  const subscriptionId = session.subscription;
  const userId = session.metadata?.user_id;

  if (!userId) {
    console.error('No user_id in checkout session metadata');
    return;
  }

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

  console.log(`Checkout completed for user ${userId}, tier: ${tier}`);
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
    console.error('No subscription found for customer:', customerId);
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
      'cancelled',
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

  console.error(`Payment failed for user ${userId}, subscription ${subscriptionId}: ${failureReason}`);
}

/**
 * Handle invoice.paid — BL-R-C4: Consolidated from billing.js
 */
async function handleInvoicePaid(event, query) {
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
}

