# Stripe Integration Setup Guide

**Created**: March 6, 2026  
**Status**: Implementation Complete — Configuration Pending  
**Related Tasks**: BL-REV-001, BL-REV-002

---

## ✅ What's Been Implemented

### Backend Infrastructure
- ✅ Stripe SDK integration (`stripe@^17.4.0`)
- ✅ Checkout session creation (POST /api/checkout/create)
- ✅ Customer portal access (POST /api/checkout/portal)
- ✅ Webhook event processing (POST /api/webhook/stripe)
- ✅ Database schema (subscriptions, payment_events, usage_records)
- ✅ Tier enforcement middleware
- ✅ Usage quota tracking

### Stripe Event Handlers
- ✅ `checkout.session.completed` - Subscription activation
- ✅ `customer.subscription.created` - New subscription
- ✅ `customer.subscription.updated` - Plan changes
- ✅ `customer.subscription.deleted` - Cancellations
- ✅ `invoice.payment_succeeded` - Successful payments
- ✅ `invoice.payment_failed` - Failed payments

### Tier Configuration
| Tier | Price | Chart Calc | Profile Gen | API Calls/mo | Features |
|------|-------|------------|-------------|--------------|----------|
| Free | $0 | 1 | 1 | 0 | Basic |
| Seeker | $15 | ∞ | 10 | 0 | +SMS Digests |
| Guide | $97 | ∞ | ∞ | 1,000 | +Practitioner Tools |
| Practitioner | $500 | ∞ | ∞ | 10,000 | +White Label |

---

## 🔧 Setup Steps

### 1. Database Migration

Run the migration to create subscription tables:

```bash
cd workers
npm run migrate
```

This creates:
- `subscriptions` - User subscription records
- `payment_events` - Payment history and failures
- `usage_records` - API usage tracking

**Verify**:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('subscriptions', 'payment_events', 'usage_records');
```

### 2. Stripe Account Setup

#### Create Stripe Account
1. Sign up at [stripe.com](https://stripe.com)
2. Complete business verification
3. Enable test mode for development

#### Create Products & Prices

In Stripe Dashboard → Products:

**Seeker Tier**
- Product: "Prime Self — Seeker"
- Price: $15.00 USD / month
- Recurring billing
- Copy Price ID (e.g., `price_1AbC123xyz`)

**Guide Tier**
- Product: "Prime Self — Guide"
- Price: $97.00 USD / month
- Recurring billing
- Copy Price ID (e.g., `price_2DeF456xyz`)

**Practitioner Tier**
- Product: "Prime Self — Practitioner"
- Price: $500.00 USD / month
- Recurring billing
- Copy Price ID (e.g., `price_3GhI789xyz`)

### 3. Configure Environment Variables

Set environment variables for Stripe price IDs:

```bash
# Development (optional - defaults to 'price_seeker', 'price_guide', 'price_practitioner')
export STRIPE_PRICE_SEEKER="price_1AbC123xyz"
export STRIPE_PRICE_GUIDE="price_2DeF456xyz"
export STRIPE_PRICE_PRACTITIONER="price_3GhI789xyz"
```

Or add to `wrangler.toml`:
```toml
[vars]
STRIPE_PRICE_SEEKER = "price_1AbC123xyz"
STRIPE_PRICE_GUIDE = "price_2DeF456xyz"
STRIPE_PRICE_PRACTITIONER = "price_3GhI789xyz"
```

### 4. Set Stripe API Keys

#### For Development (Test Mode)
```bash
cd workers
wrangler secret put STRIPE_SECRET_KEY
# Paste: sk_test_... (from Stripe Dashboard → Developers → API Keys)

wrangler secret put STRIPE_WEBHOOK_SECRET
# Temporary: can use any string for local dev without webhooks
# For webhook testing: use value from Stripe CLI or Dashboard webhook endpoint
```

#### For Production
```bash
cd workers
wrangler secret put STRIPE_SECRET_KEY
# Paste: sk_live_... (from Stripe Dashboard → Developers → API Keys)

wrangler secret put STRIPE_WEBHOOK_SECRET
# Paste: whsec_... (from Stripe Dashboard → Developers → Webhooks → your endpoint)
```

**Security Note**: NEVER commit API keys to git. Always use `wrangler secret put`.

### 5. Configure Stripe Webhook Endpoint

#### Development (Stripe CLI)
```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to http://localhost:8787/api/webhook/stripe

# Copy webhook signing secret (whsec_...) and set:
wrangler secret put STRIPE_WEBHOOK_SECRET
```

#### Production (Stripe Dashboard)
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://your-worker.your-subdomain.workers.dev/api/webhook/stripe`
4. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy "Signing secret" (whsec_...) and set via `wrangler secret put STRIPE_WEBHOOK_SECRET`

### 6. Enable Stripe Customer Portal

In Stripe Dashboard → Settings → Billing:
1. Enable Customer Portal
2. Configure allowed actions:
   - ✅ Update payment method
   - ✅ View invoices
   - ✅ Cancel subscription
3. Set branding (logo, colors, terms of service URL)

### 7. Deploy to Production

```bash
cd workers
wrangler deploy
```

**Verify**:
```bash
# Check health endpoint
curl https://your-worker.your-subdomain.workers.dev/api/health

# Should return:
# {"status":"ok","version":"0.2.0","timestamp":"2026-03-06T..."}
```

---

## 🧪 Testing

### Test Checkout Flow

```bash
# 1. Register a test user
curl -X POST https://your-worker.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "birthDate": "1990-01-01",
    "birthTime": "12:00:00",
    "birthTz": "America/New_York",
    "birthLat": 40.7128,
    "birthLng": -74.0060
  }'

# Response: {"token": "eyJ...", "user": {...}}

# 2. Create checkout session
curl -X POST https://your-worker.workers.dev/api/checkout/create \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "seeker",
    "successUrl": "https://primeself.app/success",
    "cancelUrl": "https://primeself.app/pricing"
  }'

# Response: {"sessionId": "cs_...", "url": "https://checkout.stripe.com/...", ...}

# 3. Visit checkout URL in browser, complete test payment
# Use Stripe test card: 4242 4242 4242 4242, any future expiry, any CVC

# 4. Verify subscription created
# Check database: SELECT * FROM subscriptions WHERE user_id = '...';
# Should show tier='seeker', status='active'
```

### Test Customer Portal

```bash
curl -X POST https://your-worker.workers.dev/api/checkout/portal \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "returnUrl": "https://primeself.app/account"
  }'

# Response: {"url": "https://billing.stripe.com/..."}
# Visit URL to manage subscription
```

### Test Tier Enforcement

```javascript
// In workers/src/handlers/profile.js (example integration)
import { enforceUsageQuota, recordUsage } from '../middleware/tierEnforcement.js';

export async function handleProfile(request, env) {
  // Check quota before generating profile
  const quotaCheck = await enforceUsageQuota(request, env, 'profile_generation', 'profileGenerations');
  if (quotaCheck) return quotaCheck; // Return 429 if quota exceeded

  // ... generate profile ...

  // Record usage after success
  await recordUsage(env, request._user.sub, 'profile_generation', '/api/profile/generate');
  
  return Response.json({ profile: ... });
}
```

---

## 📊 Monitoring

### Check Subscription Status
```sql
-- Active subscriptions by tier
SELECT tier, COUNT(*) as count, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
FROM subscriptions
GROUP BY tier;

-- Recent payment events
SELECT pe.event_type, pe.status, pe.amount, pe.currency, pe.created_at, s.tier
FROM payment_events pe
JOIN subscriptions s ON pe.subscription_id = s.id
ORDER BY pe.created_at DESC
LIMIT 10;

-- User usage by action (current month)
SELECT action, COUNT(*) as count
FROM usage_records
WHERE created_at >= date_trunc('month', CURRENT_DATE)
GROUP BY action
ORDER BY count DESC;
```

### Stripe Dashboard Metrics
- **MRR** (Monthly Recurring Revenue): Dashboard → Home
- **Churn Rate**: Dashboard → Billing → Subscriptions
- **Failed Payments**: Dashboard → Payments → Declined

---

## 🚨 Troubleshooting

### Webhooks Not Receiving Events
1. Check webhook endpoint status in Stripe Dashboard
2. Verify STRIPE_WEBHOOK_SECRET is set correctly
3. Check worker logs: `wrangler tail`
4. Test webhook signature with Stripe CLI: `stripe trigger checkout.session.completed`

### Checkout Session Creation Fails
- Verify STRIPE_SECRET_KEY is set
- Check Stripe price IDs match configured environment variables
- Ensure user has valid email (required for Stripe customer creation)

### Tier Not Updating After Payment
- Check webhook is receiving `checkout.session.completed` event
- Verify `user_id` is in session metadata
- Check database: `SELECT * FROM subscriptions WHERE stripe_subscription_id = 'sub_...'`
- Look for errors in webhook processing logs

### Usage Quota Not Enforcing
- Verify tier enforcement middleware is called before handler logic
- Check `usage_records` table has entries: `SELECT * FROM usage_records WHERE user_id = '...'`
- Confirm tier configuration in `workers/src/lib/stripe.js` matches expected limits

---

## 📋 Next Steps

### Phase 1 Remaining Tasks
- [ ] **BL-REV-003**: Apply tier gates to existing handlers (profile, practitioner, chart)
- [ ] **BL-REV-004**: Build upgrade/downgrade UI flows in frontend
- [ ] **BL-REV-005**: Implement usage tracking dashboard
- [ ] **BL-REV-006**: Add payment failure recovery flows
- [ ] **BL-REV-007**: Create referral/affiliate system
- [ ] **BL-REV-008**: Build billing portal integration in UI

### Frontend Integration
Create checkout UI in `frontend/index.html`:
```javascript
// Example: Trigger checkout
async function upgradeToSeeker() {
  const response = await fetch('/api/checkout/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tier: 'seeker',
      successUrl: window.location.origin + '/success',
      cancelUrl: window.location.origin + '/pricing'
    })
  });
  
  const { url } = await response.json();
  window.location.href = url; // Redirect to Stripe Checkout
}
```

---

## 📚 Reference

- [Stripe API Docs](https://stripe.com/docs/api)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Cloudflare Workers Stripe Example](https://developers.cloudflare.com/workers/examples/stripe-checkout/)

**Files Created**:
- `workers/src/lib/stripe.js`
- `workers/src/handlers/checkout.js`
- `workers/src/handlers/webhook.js`
- `workers/src/middleware/tierEnforcement.js`

**Database Tables**:
- `subscriptions`
- `payment_events`
- `usage_records`

**API Endpoints**:
- POST `/api/checkout/create`
- POST `/api/checkout/portal`
- POST `/api/webhook/stripe`
