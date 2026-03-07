# Stripe Integration - Next Steps

## ✅ What's Been Completed

1. **Worker Deployed**: Updated Stripe configuration and deployed to Cloudflare
   - URL: https://prime-self-api.adrper79.workers.dev
   - Version ID: 0f68d6e5-84d6-4bb5-9e9d-23c6551f0626

2. **Stripe Secret Key Set**: Your live Stripe secret key is configured in Cloudflare Workers
   - Secret: STRIPE_SECRET_KEY ✓

3. **Code Updates**:
   - Fixed `stripe.js` to use env-based price IDs (not process.env)
   - Updated `checkout.js` to use getTierConfig()
   - Added price ID placeholders to `wrangler.toml`
   - Fixed import error in `diary.js`

4. **Documentation Created**:
   - `docs/UPGRADE_FLOW_TESTING.md` - Comprehensive test scenarios
   - `docs/OPERATION.md` - Updated with Stripe monitoring procedures
   - `stripe-setup.sh` - Interactive setup script

---

## 🔧 What You Need to Do Next

### 1. Create Webhook Endpoint (5 minutes)

Go to: https://dashboard.stripe.com/webhooks

**Steps**:
1. Click **"Add endpoint"**
2. **Endpoint URL**: `https://prime-self-api.adrper79.workers.dev/api/webhook/stripe`
3. **Select events to listen to**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Click **"Add endpoint"**
5. Copy the **"Signing secret"** (starts with `whsec_...`)
6. Set it in Cloudflare:
   ```bash
   cd workers
   echo "whsec_YOUR_SECRET_HERE" | npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

---

### 2. Create Stripe Products (10 minutes)

Go to: https://dashboard.stripe.com/products

**Product 1: Prime Self - Seeker**
- Click **"Add product"**
- Name: `Prime Self - Seeker`
- Description: `∞ charts, 10 profiles/month, SMS digests`
- Pricing model: **Recurring**
- Price: `$15.00` per month
- Click **"Save product"**
- **Copy the Price ID** (looks like `price_1ABC123XYZ...`)

**Product 2: Prime Self - Guide**
- Name: `Prime Self - Guide`
- Description: `∞ charts, ∞ profiles, practitioner tools, 1K API calls/month`
- Price: `$97.00` per month
- **Copy the Price ID**

**Product 3: Prime Self - Practitioner**
- Name: `Prime Self - Practitioner`
- Description: `Everything unlimited, white-label, 10K API calls/month`
- Price: `$500.00` per month
- **Copy the Price ID**

---

### 3. Update wrangler.toml with Price IDs

Edit `workers/wrangler.toml` and replace the price ID placeholders:

```toml
[vars]
ENVIRONMENT = "production"
STRIPE_PRICE_SEEKER = "price_1ABC123..."        # <- Your Seeker Price ID
STRIPE_PRICE_GUIDE = "price_1DEF456..."         # <- Your Guide Price ID
STRIPE_PRICE_PRACTITIONER = "price_1GHI789..." # <- Your Practitioner Price ID
```

Then redeploy:
```bash
cd workers
npx wrangler deploy
```

---

### 4. Run Database Migration

**Option A: Using psql**

Install PostgreSQL client:
```bash
# Ubuntu/Debian/WSL
sudo apt update && sudo apt install postgresql-client

# macOS
brew install postgresql
```

Run migration:
```bash
cd workers
psql "postgresql://neondb_owner:npg_FlB3I6JYdboV@ep-rapid-bird-aicgk9v2-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require" -f src/db/migrate.sql
```

**Option B: Using Neon Console**

1. Go to https://console.neon.tech
2. Select your project
3. Open **SQL Editor**
4. Copy contents of `workers/src/db/migrate.sql`
5. Paste and run

**Option C: Use the automated script**

```bash
chmod +x stripe-setup.sh
./stripe-setup.sh
```

This will guide you through all steps interactively.

---

### 5. Verify Setup

**Check secrets are configured:**
```bash
cd workers
npx wrangler secret list
```

Expected output:
```json
[
  { "name": "STRIPE_SECRET_KEY", "type": "secret_text" },
  { "name": "STRIPE_WEBHOOK_SECRET", "type": "secret_text" },
  ...
]
```

**Check database tables created:**
```bash
psql "postgresql://neondb_owner:..." -c "\dt"
```

Expected to see:
- `subscriptions`
- `payment_events`
- `usage_records`

**Test health endpoint:**
```bash
curl https://prime-self-api.adrper79.workers.dev/api/health
```

---

### 6. Test Upgrade Flow

Follow the test scenarios in `docs/UPGRADE_FLOW_TESTING.md`:

**Quick Test (T-001: Free → Seeker):**

1. Register a new user:
   ```bash
   curl -X POST https://prime-self-api.adrper79.workers.dev/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "testpass123",
       "birthDate": "1990-01-01",
       "birthTime": "12:00",
       "birthTz": "America/New_York",
       "birthLat": 40.7128,
       "birthLng": -74.0060
     }'
   ```

2. Save the `accessToken` from response

3. Create checkout session:
   ```bash
   curl -X POST https://prime-self-api.adrper79.workers.dev/api/checkout/create \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json" \
     -d '{
       "tier": "seeker",
       "successUrl": "https://primeself.app/success",
       "cancelUrl": "https://primeself.app/pricing"
     }'
   ```

4. Open the `url` from response in browser

5. Use test card: `4242 4242 4242 4242`, Exp: `12/25`, CVC: `123`

6. Complete checkout

7. Verify webhook received in Stripe Dashboard → Webhooks → Logs

8. Verify tier updated:
   ```bash
   curl https://prime-self-api.adrper79.workers.dev/api/auth/me \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```
   
   Should show `"tier": "seeker"`

---

## 📊 Monitoring

### Stripe Dashboard Daily Checks

1. **Webhooks → Endpoints**
   - Check delivery success rate (should be >95%)
   - Resend any failed events

2. **Home → Analytics**
   - Monitor MRR (Monthly Recurring Revenue)
   - Track subscriber growth

3. **Payments**
   - Handle any failed payments or chargebacks

### Database Health Queries

```sql
-- Count subscriptions by status
SELECT status, COUNT(*) 
FROM subscriptions 
GROUP BY status;

-- Recent failed payments
SELECT u.email, pe.failure_reason, pe.created_at
FROM payment_events pe
JOIN subscriptions s ON pe.subscription_id = s.id
JOIN users u ON s.user_id = u.id
WHERE pe.status = 'failed'
ORDER BY pe.created_at DESC
LIMIT 10;

-- Monthly revenue snapshot
SELECT 
  tier,
  COUNT(*) as subscribers,
  CASE 
    WHEN tier = 'seeker' THEN COUNT(*) * 15
    WHEN tier = 'guide' THEN COUNT(*) * 97
    WHEN tier = 'practitioner' THEN COUNT(*) * 500
  END as monthly_revenue
FROM subscriptions
WHERE status = 'active'
GROUP BY tier;
```

---

## 🚨 Important Notes

### ⚠️ You're Using LIVE Mode Keys

Your Stripe keys are in **LIVE MODE** (pk_live_, sk_live_). This means:
- Real money will be charged
- Real customers will be created
- All transactions are production transactions

**For testing**, consider:
1. Switching to **Test Mode** in Stripe Dashboard (toggle top right)
2. Using test mode keys: `pk_test_...` and `sk_test_...`
3. After testing, switch back to live mode

### Test Mode Switch

To use test mode:
1. Toggle to "Test mode" in Stripe Dashboard
2. Get test API keys from Developers → API keys
3. Update Cloudflare secret:
   ```bash
   echo "sk_test_YOUR_KEY" | npx wrangler secret put STRIPE_SECRET_KEY
   ```
4. Create test products (same process as above)
5. Use test cards: https://docs.stripe.com/testing

---

## 📚 Reference Documentation

- [UPGRADE_FLOW_TESTING.md](docs/UPGRADE_FLOW_TESTING.md) - All test scenarios
- [OPERATION.md](docs/OPERATION.md) - Stripe monitoring procedures
- [STRIPE_SETUP.md](docs/STRIPE_SETUP.md) - Original setup guide
- [TIER_ENFORCEMENT.md](docs/TIER_ENFORCEMENT.md) - Tier enforcement details

---

## ✅ Completion Checklist

- [ ] Webhook endpoint created in Stripe
- [ ] Webhook secret set in Cloudflare Workers
- [ ] 3 products created in Stripe (Seeker, Guide, Practitioner)
- [ ] Price IDs updated in wrangler.toml
- [ ] Worker redeployed with new price IDs
- [ ] Database migration run (subscriptions, payment_events, usage_records tables created)
- [ ] Test upgrade flow completed (Free → Seeker)
- [ ] Webhook delivery verified in Stripe Dashboard
- [ ] Tier update verified in database
- [ ] Health endpoint returns 200 OK

Once all checked, you're ready for production! 🎉

---

**Questions or Issues?** Check `docs/OPERATION.md` for troubleshooting runbooks.
