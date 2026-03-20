# Stripe Integration Guide

> Historical integration guide. The setup flow remains useful, but tier names, price labels, and some billing examples below refer to an older pricing model.
> Use `workers/src/lib/stripe.js` and the current documentation index as the live source of truth.

Complete guide to setting up Stripe payments for Prime Self.

**Time to complete**: 30 minutes  
**Complexity**: Medium  
**Includes**: Database setup, Stripe products, webhook configuration, testing

---

## Overview

This guide covers:
1. ✅ Database migration (creates subscription tables)
2. ✅ Stripe account & product setup
3. ✅ Webhook configuration
4. ✅ Environment variable setup
5. ✅ Testing the checkout flow
6. ✅ Monitoring subscriptions

---

## Prerequisites

- Stripe account (free): https://stripe.com
- Neon database provisioned (see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md))
- Worker redeployed with secrets (see step 3 below)

---

## Step 1: Database Migration

Create subscription and payment tables.

### Option A: Via Neon Console (Easiest)

1. Go to: https://console.neon.tech
2. Select your **HumanDesign** project
3. Click **SQL Editor** (left sidebar)
4. Copy and run this SQL:

```sql
-- Subscriptions (user → Stripe)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'regular', 'practitioner', 'white_label')),
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Payment events (webhook log)
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  amount_paid NUMERIC(10, 2),
  status TEXT DEFAULT 'succeeded',
  raw_event JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Usage tracking
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  endpoint TEXT,
  quota_cost INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_payment_events_subscription ON payment_events(subscription_id);
CREATE INDEX idx_usage_records_user ON usage_records(user_id);
```

**Verify**: Run this query — should return 3 rows:
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname='public' 
  AND tablename IN ('subscriptions', 'payment_events', 'usage_records');
```

### Option B: Via Node.js Migration Script

Alternatively, run from command line:

```bash
cd workers
NEON_CONNECTION_STRING="postgresql://..." node run-migration.js
```

---

## Step 2: Create Stripe Account & Products

### Create Account

1. Go to https://stripe.com
2. Sign up with email
3. Verify business (takes 5-30 minutes)
4. Enable **Test Mode** for development

### Create Products (3 Tiers)

In Stripe Dashboard → **Products**:

#### Product 1: Explorer Tier
- **Name**: `Prime Self — Explorer`
- **Price**: `$12.00 USD` / month
- **Billing interval**: Monthly
- Click **Save**
- Copy **Price ID** (e.g., `price_1AbC123xyz`)

#### Product 2: Guide Tier
- **Name**: `Prime Self — Guide`
- **Price**: `$60.00 USD` / month
- **Billing interval**: Monthly
- Copy **Price ID**

#### Product 3: Studio Tier
- **Name**: `Prime Self — Studio`
- **Price**: `$149.00 USD` / month
- **Billing interval**: Monthly
- Copy **Price ID**

You now have 3 Price IDs. We'll use them in Step 3.

---

## Step 3: Configure Secrets & Environment

### Get Stripe Keys

1. Go to https://dashboard.stripe.com
2. Click **Developers** > **API Keys** (top right)
3. Copy your **Secret Key** (starts with `sk_live_` or `sk_test_`)

### Set Worker Secrets

```bash
npx wrangler secret put STRIPE_SECRET_KEY
# Paste: sk_test_...

npx wrangler secret put STRIPE_WEBHOOK_SECRET
# Leave empty for now (create webhook first)
```

### Update Price IDs in wrangler.toml

Edit `workers/wrangler.toml`:

```toml
# Add these lines in [vars]
STRIPE_PRICE_REGULAR = "price_YOUR_EXPLORER_ID"
STRIPE_PRICE_PRACTITIONER = "price_YOUR_GUIDE_ID"
STRIPE_PRICE_WHITE_LABEL = "price_YOUR_STUDIO_ID"
```

Replace with your actual Price IDs from Step 2.

**Example**:
```toml
STRIPE_PRICE_REGULAR = "price_1AbC123def456"
STRIPE_PRICE_PRACTITIONER = "price_2XyZ789ghi012"
STRIPE_PRICE_WHITE_LABEL = "price_3MnO345jkl678"
```

---

## Step 4: Create Webhook Endpoint

Webhooks notify Prime Self when payments succeed/fail.

### Create Endpoint

1. Go to https://dashboard.stripe.com/webhooks
2. Click **Add endpoint**
3. Enter URL: `https://prime-self-api.adrper79.workers.dev/api/webhook/stripe` (or your Worker URL)
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**

### Get Webhook Secret

1. Click the endpoint you just created
2. Copy **Signing secret** (starts with `whsec_`)
3. Set in Worker:
   ```bash
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   # Paste: whsec_...
   ```

---

## Step 5: Deploy Worker

```bash
cd workers
npx wrangler deploy
```

Expected output:
```
✨ Successfully deployed to:
https://prime-self-api.adrper79.workers.dev
```

---

## Step 6: Test the Flow

### Create Test User

```bash
curl -X POST https://prime-self-api.adrper79.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!SecurePassword",
    "birthDate": "1990-01-01",
    "birthTime": "12:00:00",
    "birthTz": "America/New_York",
    "birthLat": 40.7128,
    "birthLng": -74.0060
  }'
```

Copy the `accessToken` from response.

### Create Checkout Session

```bash
curl -X POST https://prime-self-api.adrper79.workers.dev/api/stripe/checkout \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"tier": "regular"}'
```

Response:
```json
{
  "ok": true,
  "data": {
    "checkout_url": "https://checkout.stripe.com/pay/cs_test_..."
  }
}
```

### Complete Payment in Stripe

1. Open the `checkout_url` in browser
2. Enter test card details:
   - **Card**: `4242 4242 4242 4242`
   - **Exp**: `12/25`
   - **CVC**: `123`
3. Complete checkout
4. Check database — subscription should be created

**Verify in Neon**:
```sql
SELECT id, user_id, tier, status FROM subscriptions LIMIT 1;
```

---

## Step 7: Monitor Webhooks

### Check Webhook Logs

1. Go to https://dashboard.stripe.com/webhooks
2. Click your endpoint
3. View **Events** to confirm:
   - ✅ `checkout.session.completed` fired
   - ✅ `customer.subscription.created` fired

### Troubleshooting Webhook Failures

If webhooks show red ❌:

1. **Endpoint unreachable**: Check Worker is deployed
   ```bash
   curl https://prime-self-api.adrper79.workers.dev/api/health
   ```

2. **Webhook secret wrong**: Get new one from endpoint settings
   ```bash
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

3. **Database error**: Check Neon connection string in Worker
   ```bash
   npx wrangler secret list | grep NEON
   ```

---

## Common Test Cases

| Scenario | How to Test | Expected |
|----------|-------------|----------|
| **Successful payment** | Use card `4242 4242 4242 4242` | User tier updates to "regular" (Explorer) |
| **Failed payment** | Use card `4000 0000 0000 0002` | Error shown; subscription not created |
| **Upgrade mid-cycle** | Create subscription, then upgrade | Prorated charge calculated |
| **Cancel subscription** | Cancel in Stripe dashboard | User tier reverts to "free" |

---

## Next Steps

- **Testing upgrades**: See [../docs/UPGRADE_FLOW_TESTING.md](../docs/UPGRADE_FLOW_TESTING.md)
- **Operations**: See [../docs/OPERATION.md](../docs/OPERATION.md)
- **Tier enforcement**: See [../docs/TIER_ENFORCEMENT.md](../docs/TIER_ENFORCEMENT.md)

---

## Troubleshooting

### "Webhook endpoint unreachable"
- Verify Worker is deployed: `npx wrangler deploy --force`
- Check URL in Stripe dashboard matches your Worker URL
- Check firewall/CORS not blocking Stripe

### "Subscribe button doesn't work"
- Verify `STRIPE_SECRET_KEY` is set: `npx wrangler secret list`
- Check `/api/webhook/stripe` endpoint exists in `workers/src/index.js`
- Review Worker logs: `npx wrangler tail --format=pretty`

### "Tier doesn't update after payment"
- Check webhook is being received (Stripe dashboard)
- Verify webhook secret matches: `npx wrangler secret list`
- Check webhook signature validation in `handlers/webhook.js`

---

## Historical Implementation Notes

Captured from initial Stripe integration (March 2026):

### What Was Completed in Initial Setup

1. **Worker deployed** — `https://prime-self-api.adrper79.workers.dev` (Version `0f68d6e5-84d6-4bb5-9e9d-23c6551f0626`)
2. **Stripe Secret Key configured** — `STRIPE_SECRET_KEY` set in Cloudflare Workers
3. **Code fixes applied:**
   - `stripe.js` updated to use env-based price IDs (not `process.env`)
   - `checkout.js` updated to use `getTierConfig()`
   - Price ID placeholders added to `wrangler.toml`
   - Import error in `diary.js` fixed

### Current Canonical Pricing (as of March 2026)

> Always verify against `workers/src/lib/stripe.js` for the live price IDs.

| Tier | Price | Internal Key |
|------|-------|--------------|
| Free | $0 | `free` |
| Individual | $19 / month | `regular` |
| Practitioner | $97 / month | `practitioner` |
| Agency | $349 / month | `white_label` |

Historical product names `Explorer / Guide / Studio` at older price points (`$12 / $60 / $149`) appear in earlier setup docs but are superseded by the above. See `docs/TIER_ENFORCEMENT.md` and `audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md` for commercial consistency audit.

### "Test mode vs. Live mode confusion"
- Always use **Test Mode** for development (Stripe dashboard: `test data` toggle)
- Use test card numbers (4242 4242 4242 4242)
- Webhooks are separate for test vs. live — set up both if going live

---

## See Also

- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) — All secrets reference
- [SETUP_DEVELOPMENT.md](SETUP_DEVELOPMENT.md) — Development setup
- [../docs/UPGRADE_FLOW_TESTING.md](../docs/UPGRADE_FLOW_TESTING.md) — Test scenarios
- [../DEPLOY.md](../DEPLOY.md) — Production deployment

