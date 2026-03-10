# Quick Start: Stripe Integration

**Time: 15-20 minutes**

Follow these steps in order to get Stripe payments working.

---

## Step 1: Run Database Migration (5 minutes)

### Option A: Via Neon Console (Easiest)

1. Go to: https://console.neon.tech
2. Select your project: **HumanDesign**
3. Click **SQL Editor** (left sidebar)
4. Copy and paste this SQL:

```sql
-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT UNIQUE NOT NULL,
  stripe_subscription_id  TEXT UNIQUE,
  tier                    TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'seeker', 'guide', 'practitioner')),
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'unpaid', 'trialing')),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions (tier);

-- Payment events table
CREATE TABLE IF NOT EXISTS payment_events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id     UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_event_id     TEXT UNIQUE NOT NULL,
  event_type          TEXT NOT NULL,
  amount              INTEGER,
  currency            TEXT DEFAULT 'usd',
  status              TEXT,
  failure_reason      TEXT,
  raw_event           JSONB,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_subscription ON payment_events (subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_stripe ON payment_events (stripe_event_id);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_records (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  endpoint      TEXT,
  quota_cost    INTEGER DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_records (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_action ON usage_records (action, created_at DESC);
```

5. Click **Run** (or press Ctrl+Enter)
6. You should see: "Success" with "3 tables created" or "0 rows affected" if already exists

✅ **Verify:** Run `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('subscriptions', 'payment_events', 'usage_records');` - should return 3 rows

---

## Step 2: Create Stripe Webhook (3 minutes)

1. Go to: https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"**
3. Fill in:
   - **Endpoint URL**: `https://prime-self-api.adrper79.workers.dev/api/webhook/stripe`
   - **Description**: Prime Self subscription webhooks
   - **Events to send**: Click "Select events" and choose these 6:
     - [x] `checkout.session.completed`
     - [x] `customer.subscription.created`
     - [x] `customer.subscription.updated`
     - [x] `customer.subscription.deleted`
     - [x] `invoice.payment_succeeded`
     - [x] `invoice.payment_failed`
4. Click **"Add endpoint"**
5. On the endpoint details page, click **"Reveal"** next to "Signing secret"
6. Copy the secret (starts with `whsec_...`)
7. Open terminal and run:
   ```bash
   cd workers
   echo "PASTE_YOUR_WHSEC_SECRET_HERE" | npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

✅ **Verify:** Run `npx wrangler secret list` - should see `STRIPE_WEBHOOK_SECRET` in the list

---

## Step 3: Create Stripe Products (5 minutes)

Go to: https://dashboard.stripe.com/products

### Product 1: Seeker Tier

1. Click **"Add product"**
2. Fill in:
   - **Name**: `Prime Self - Seeker`
   - **Description**: `Unlimited charts, 10 profiles/month, SMS digests`
   - **Pricing model**: Standard pricing
   - **Price**: `15.00 USD`
   - **Billing period**: Monthly
3. Click **"Add product"**
4. **IMPORTANT:** Copy the **Price ID** (looks like `price_1A2B3C4D...`)
   - You'll find it under "Pricing" section or in the URL
5. Save it somewhere (you need it for Step 4)

### Product 2: Guide Tier

1. Click **"Add product"** again
2. Fill in:
   - **Name**: `Prime Self - Guide`
   - **Description**: `Everything unlimited, practitioner tools, 1K API calls/month`
   - **Price**: `97.00 USD`
   - **Billing period**: Monthly
3. Click **"Add product"**
4. **Copy the Price ID**

### Product 3: Practitioner Tier

1. Click **"Add product"** again
2. Fill in:
   - **Name**: `Prime Self - Practitioner`
   - **Description**: `White-label, 10K API calls/month, everything unlimited`
   - **Price**: `500.00 USD`
   - **Billing period**: Monthly
3. Click **"Add product"**
4. **Copy the Price ID**

✅ **Verify:** You should have 3 price IDs that look like: `price_ABC123XYZ...`

---

## Step 4: Update Worker Config (2 minutes)

1. Open `workers/wrangler.toml` in your editor
2. Find these lines:
   ```toml
   STRIPE_PRICE_SEEKER = "price_placeholder_seeker"
   STRIPE_PRICE_GUIDE = "price_placeholder_guide"
   STRIPE_PRICE_PRACTITIONER = "price_placeholder_practitioner"
   ```
3. Replace with your actual Price IDs:
   ```toml
   STRIPE_PRICE_SEEKER = "price_YOUR_SEEKER_ID"
   STRIPE_PRICE_GUIDE = "price_YOUR_GUIDE_ID"
   STRIPE_PRICE_PRACTITIONER = "price_YOUR_PRACTITIONER_ID"
   ```
4. Save the file
5. Deploy:
   ```bash
   cd workers
   npx wrangler deploy
   ```

✅ **Verify:** Deployment should succeed with no errors

---

## Step 5: Test It! (5 minutes)

### Register a test user

```bash
curl -X POST https://prime-self-api.adrper79.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-stripe@example.com",
    "password": "testpass123",
    "birthDate": "1990-01-01",
    "birthTime": "12:00",
    "birthTz": "America/New_York",
    "birthLat": 40.7128,
    "birthLng": -74.0060
  }'
```

Save the `accessToken` from the response.

### Create a checkout session

```bash
curl -X POST https://prime-self-api.adrper79.workers.dev/api/billing/checkout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "seeker",
    "successUrl": "https://primeself.app/success",
    "cancelUrl": "https://primeself.app/pricing"
  }'
```

You should get a response with a Stripe checkout `url`.

### Complete the checkout

1. Open the `url` in your browser
2. Use test card: `4242 4242 4242 4242`
3. Expiry: `12/25`
4. CVC: `123`
5. Click **"Subscribe"**
6. You should be redirected to the success URL

### Verify tier upgraded

```bash
curl https://prime-self-api.adrper79.workers.dev/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

Response should show: `"tier": "seeker"`

✅ **Success!** You can now process subscriptions!

---

## Step 6: Verify Webhook Processing

1. Go to Stripe Dashboard → Webhooks → Your endpoint
2. Click on the endpoint
3. Check **"Events"** tab
4. You should see 3 events delivered recently:
   - `checkout.session.completed` ✓
   - `customer.subscription.created` ✓
   - `invoice.payment_succeeded` ✓
5. All should have status: **Succeeded** (green checkmark)

If any failed, click on the event to see error details, then:
- Check worker logs: `cd workers && npx wrangler tail`
- Resend the failed event from Stripe Dashboard

---

## ⚠️ Important: You're Using LIVE Mode

Your Stripe keys are **LIVE MODE** - real money will be charged!

To switch to **TEST MODE** for safe testing:

1. In Stripe Dashboard, toggle to **"Test mode"** (top right)
2. Repeat Steps 2-4 with test mode keys
3. Get test mode secret key from Developers → API keys
4. Update secret:
   ```bash
   echo "sk_test_YOUR_TEST_KEY" | npx wrangler secret put STRIPE_SECRET_KEY
   ```
5. Use test cards: https://docs.stripe.com/testing

---

## Troubleshooting

**"Price ID not configured" error**
- Check wrangler.toml has correct price IDs
- Redeploy: `npx wrangler deploy`

**"Webhook signature verification failed"**
- Check webhook secret is set: `npx wrangler secret list`
- Verify secret matches Stripe Dashboard → Webhooks → Signing secret

**Tier not updating after checkout**
- Check webhook was delivered: Stripe Dashboard → Webhooks → Events
- Check worker logs: `npx wrangler tail`
- Manually resend webhook from Stripe Dashboard

**Database errors**
- Verify tables exist: In Neon SQL Editor, run `\dt`
- Re-run migration SQL from Step 1

---

## Next Steps

Once everything is working:

1. **Test all tiers**: Try upgrading to Guide and Practitioner
2. **Test downgrade**: Use billing portal to downgrade
3. **Test cancellation**: Cancel subscription and verify tier reverts to free
4. **Monitor webhooks**: Check Stripe Dashboard daily for failed deliveries
5. **Switch to live mode**: When ready for real customers

---

**Full test scenarios**: See [docs/UPGRADE_FLOW_TESTING.md](docs/UPGRADE_FLOW_TESTING.md)

**Monitoring guide**: See [docs/OPERATION.md](docs/OPERATION.md)

**Questions?** Check the docs or Stripe Dashboard for detailed error messages.
