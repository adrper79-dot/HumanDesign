/**
 * Billing Handler — Stripe Integration
 * 
 * Endpoints:
 * - POST /api/billing/checkout - Create checkout session
 * - POST /api/billing/portal - Create customer portal session
 * - POST /api/billing/webhook - Handle Stripe webhooks
 * - GET /api/billing/subscription - Get current subscription
 * - POST /api/billing/cancel - Cancel subscription
 * - POST /api/billing/upgrade - Upgrade/downgrade subscription
 */

import {
  createStripeClient,
  ensureCustomer,
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  updateSubscription,
  cancelSubscription,
  verifyWebhook,
  getTierConfig,
  getTier
} from '../lib/stripe.js';

import { createQueryFn, QUERIES } from '../db/queries.js';
import { markReferralAsConverted } from './referrals.js';
import { getUserFromRequest } from '../middleware/auth.js';
import { sendEmail } from '../lib/email.js';

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
    
    // Update database
    const newStatus = immediately ? 'canceled' : 'active';
    await query(QUERIES.updateSubscriptionCancellation, [newStatus, canceledSubscription.cancel_at_period_end, subscription.id]);
    
    // If canceled immediately, downgrade user to free tier
    if (immediately) {
      await query(QUERIES.updateUserTier, ['free', user.id]);
    }
    
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
    
    // Update database
    await query(QUERIES.updateSubscriptionTier, [tier, subscription.id]);
    
    await query(QUERIES.updateUserTier, [tier, user.id]);
    
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

// ─── Webhook Handler ─────────────────────────────────────────

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events
 * 
 * Events:
 * - checkout.session.completed - New subscription created
 * - customer.subscription.updated - Subscription changed
 * - customer.subscription.deleted - Subscription canceled
 * - invoice.paid - Payment successful
 * - invoice.payment_failed - Payment failed
 */
export async function handleWebhook(request, env, ctx) {
  try {
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return new Response('Missing signature', { status: 400 });
    }
    
    const payload = await request.text();
    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    
    // Verify webhook signature
    const event = verifyWebhook(payload, signature, env.STRIPE_WEBHOOK_SECRET, stripe);
    
    console.log('Webhook event:', event.type);
    
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object, env);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, env);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, env);
        break;
        
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object, env);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object, env);
        break;
        
      default:
        console.log('Unhandled event type:', event.type);
    }
    
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Webhook processing failed', { status: 400 });
  }
}

// ─── Webhook Event Handlers ──────────────────────────────────

async function handleCheckoutCompleted(session, env) {
  const userId = session.metadata.user_id;
  const tier = session.metadata.tier;
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  
  console.log('Checkout completed:', { userId, tier, subscriptionId });
  
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Create subscription record
  await query(QUERIES.insertCheckoutSubscription, [userId, tier, subscriptionId, customerId]);
  
  // Update user tier
  await query(QUERIES.updateUserTierAndStripe, [tier, customerId, userId]);
  
  console.log('Subscription created for user:', userId);
  
  // Track referral conversion if this user was referred
  await markReferralAsConverted(env, userId);
}

async function handleSubscriptionUpdated(subscription, env) {
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  
  console.log('Subscription updated:', { subscriptionId, status });
  
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  await query(QUERIES.updateSubscriptionPeriod, [
    status,
    currentPeriodEnd,
    subscription.cancel_at_period_end,
    subscriptionId
  ]);
}

async function handleSubscriptionDeleted(subscription, env) {
  const subscriptionId = subscription.id;
  
  console.log('Subscription deleted:', subscriptionId);
  
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Get user ID from subscription
  const { rows: subRows } = await query(QUERIES.getSubscriptionUserByStripeId, [subscriptionId]);
  const sub = subRows[0] || null;
  
  if (sub) {
    // Update subscription status
    await query(QUERIES.cancelSubscriptionByStripeId, [subscriptionId]);
    
    // Downgrade user to free tier
    await query(QUERIES.updateUserTier, ['free', sub.user_id]);
    
    console.log('User downgraded to free tier:', sub.user_id);
  }
}

async function handleInvoicePaid(invoice, env) {
  const subscriptionId = invoice.subscription;
  const amountPaid = invoice.amount_paid;
  
  console.log('Invoice paid:', { subscriptionId, amountPaid });
  
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Record payment in invoices table
  await query(QUERIES.insertInvoicePaid, [invoice.id, amountPaid, subscriptionId]);
}

async function handleInvoicePaymentFailed(invoice, env) {
  const subscriptionId = invoice.subscription;
  
  console.log('Invoice payment failed:', subscriptionId);
  
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Record failed payment
  await query(QUERIES.insertInvoiceFailed, [invoice.id, subscriptionId]);
  
  // Send email notification about payment failure
  if (invoice.customer_email && env.RESEND_API_KEY) {
    const customerName = invoice.customer_name || 'there';
    const portalUrl = 'https://primeself.app/billing';
    
    sendEmail({
      to: invoice.customer_email,
      subject: 'Payment failed — action required',
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #C9A84C; }
    .logo { font-size: 24px; font-weight: 700; color: #C9A84C; }
    .content { padding: 30px 0; }
    .cta { background: #C9A84C; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: 600; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header"><div class="logo">Prime Self</div></div>
  <div class="content">
    <h2>Your payment didn't go through</h2>
    <p>Hey ${customerName},</p>
    <p>We tried to process your subscription payment but it was declined. Your access will remain active for a few days while you update your payment method.</p>
    <p><strong>What to do:</strong></p>
    <ol>
      <li>Visit your billing portal</li>
      <li>Update your payment method</li>
      <li>We'll retry the charge automatically</li>
    </ol>
    <a href="${portalUrl}" class="cta">Update Payment Method →</a>
    <p>If you have any questions, reply to this email and we'll help.</p>
    <p>— The Prime Self Team</p>
  </div>
  <div class="footer"><p>You're receiving this because your subscription payment failed.</p></div>
</body>
</html>`
    }, env.RESEND_API_KEY, env.FROM_EMAIL || 'Prime Self <hello@primeself.app>')
      .catch(err => console.error('Payment failure email error:', err));
  }
}
