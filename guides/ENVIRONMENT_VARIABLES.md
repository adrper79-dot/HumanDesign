# Environment Variables & Configuration

Reference guide for all required secrets, environment variables, and configuration options.

**Time to configure**: 5–15 minutes (depending on features)

---

## Overview

Prime Self requires secrets for:
- **Database**: Neon PostgreSQL connection
- **LLM**: Anthropic Claude API for synthesis
- **SMS**: Telnyx API for daily digests
- **Payments**: Stripe (optional, for subscriptions)
- **Authentication**: JWT signing key

All secrets are stored in **Cloudflare Worker Secrets** (not in code).

---

## How Secrets Work

### For Local Development
Secrets are set via Wrangler CLI and stored in Cloudflare's secure vault:
```bash
npx wrangler secret put <NAME>
# Paste value, press Ctrl+D (or Cmd+D)
```

### For Production
Secrets are set the same way and deployed with the Worker.

---

## Required Secrets

| Secret | Service | Priority | How to Get |
|--------|---------|----------|-----------|
| `NEON_CONNECTION_STRING` | Database | 🔴 Critical | [Neon Console](https://console.neon.tech) |
| `ANTHROPIC_API_KEY` | LLM (Claude) | 🔴 Critical | [Anthropic Console](https://console.anthropic.com) |
| `JWT_SECRET` | Auth | 🔴 Critical | Generate: `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | Payments | 🟡 Optional | [Stripe Dashboard](https://dashboard.stripe.com) |
| `STRIPE_WEBHOOK_SECRET` | Payments | 🟡 Optional | [Stripe Webhooks](https://dashboard.stripe.com/webhooks) |
| `TELNYX_API_KEY` | SMS | 🟢 Optional | [Telnyx Dashboard](https://portal.telnyx.com) |
| `TELNYX_PHONE_NUMBER` | SMS | 🟢 Optional | [Telnyx Numbers](https://portal.telnyx.com/phone-numbers) |

---

## Detailed Configuration

### Database — Neon PostgreSQL

**Step 1**: Create Neon account
- Go to https://neon.tech
- Sign up with GitHub
- Create a new project

**Step 2**: Get connection string
1. Open project dashboard
2. Click **Connection string** (top right)
3. Select **Pooled** (recommended for Workers)
4. Copy the full string: `postgresql://user:pass@host/db`

**Step 3**: Set in Worker
```bash
npx wrangler secret put NEON_CONNECTION_STRING
# Paste: postgresql://user:pass@host/db
```

**Verify**:
```bash
npx wrangler secret list
# Should show: NEON_CONNECTION_STRING
```

---

### LLM API — Anthropic Claude

**Step 1**: Create Anthropic account
- Go to https://console.anthropic.com
- Sign up with email or Google

**Step 2**: Create API key
1. Click **API keys** (left sidebar)
2. Click **Create key**
3. Copy the key (starts with `sk-ant-`)

**Step 3**: Set in Worker
```bash
npx wrangler secret put ANTHROPIC_API_KEY
# Paste: sk-ant-...
```

**Note**: You'll be charged per token used. Monitor usage in [Anthropic Console](https://console.anthropic.com/account/usage).

---

### Authentication — JWT Secret

Generate a random 64-character hex string:

```bash
# macOS / Linux
openssl rand -hex 32

# Windows (PowerShell)
[Convert]::ToHexString([byte[]](1..32 | ForEach-Object { Get-Random -Max 256 }))
```

Set in Worker:
```bash
npx wrangler secret put JWT_SECRET
# Paste: your-random-hex-string
```

This key signs all JWT tokens. **Keep it secret and don't commit to git**.

---

### Payments — Stripe (Optional)

See full guide: **[STRIPE_INTEGRATION.md](STRIPE_INTEGRATION.md)**

If you skip Stripe:
- App still works (users start on Free tier)
- Checkout will fail (error message shown to users)
- You can add Stripe later without re-deploying frontend

**If you want Stripe now**:

1. Create Stripe account: https://stripe.com
2. Get keys:
   - Secret key: https://dashboard.stripe.com/apikeys
   - Webhook secret: https://dashboard.stripe.com/webhooks (after creating endpoint)

3. Set secrets:
   ```bash
   npx wrangler secret put STRIPE_SECRET_KEY
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

4. Create products (3 tiers):
   - **Seeker**: $15/month
   - **Guide**: $97/month
   - **Practitioner**: $500/month

5. Copy Price IDs and set in `workers/wrangler.toml`:
   ```toml
   STRIPE_PRICE_SEEKER = "price_..."
   STRIPE_PRICE_GUIDE = "price_..."
   STRIPE_PRICE_PRACTITIONER = "price_..."
   ```

---

### SMS — Telnyx (Optional)

If you want to send SMS digests of daily transits:

**Step 1**: Create Telnyx account
- Go to https://telnyx.com
- Sign up
- Add payment method

**Step 2**: Get phone number
- Click **Phone Numbers** (left sidebar)
- Click **Browse Numbers**
- Select a number (e.g., `+1-555-0123`)
- Copy the number

**Step 3**: Get API key
- Click **Auth** > **API Keys**
- Copy your API key

**Step 4**: Set in Worker
```bash
npx wrangler secret put TELNYX_API_KEY
npx wrangler secret put TELNYX_PHONE_NUMBER
```

**Note**: SMS costs ~$0.004 per message. Monitor usage in Telnyx dashboard.

---

## Check Installed Secrets

```bash
npx wrangler secret list
```

**Output should include**:
```
NEON_CONNECTION_STRING
ANTHROPIC_API_KEY
JWT_SECRET
[STRIPE_SECRET_KEY] (if payments enabled)
[TELNYX_API_KEY] (if SMS enabled)
```

---

## Configuration Checklist

Before deploying, verify:

- [ ] `NEON_CONNECTION_STRING` is set and database exists
- [ ] `ANTHROPIC_API_KEY` is set and valid (test with `curl`)
- [ ] `JWT_SECRET` is set to a strong random value
- [ ] Stripe keys are set (if using payments)
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `STRIPE_PRICE_SEEKER`, `GUIDE`, `PRACTITIONER` in `wrangler.toml`
- [ ] Telnyx keys are set (if using SMS)
  - [ ] `TELNYX_API_KEY`
  - [ ] `TELNYX_PHONE_NUMBER`

---

## Troubleshooting

### "Secret not found" error
Make sure you set it:
```bash
npx wrangler secret put NEON_CONNECTION_STRING
```

### "Invalid API key" when deploying
- Check the secret is copied correctly (no extra spaces)
- Re-set it: `npx wrangler secret put <NAME>`
- Verify in console: `npx wrangler secret list`

### Database connection fails
- Test connection locally with `psql` command
- Check pooled vs. non-pooled string (use pooled for Workers)
- Ensure Neon database is running (check Neon dashboard)

### SMS not sending
- Ensure phone number is formatted correctly: `+1-555-0123`
- Check Telnyx has credits (add payment method)
- Verify webhook endpoint is set in Telnyx console

---

## See Also

- [SETUP_DEVELOPMENT.md](SETUP_DEVELOPMENT.md) — Full development setup
- [STRIPE_INTEGRATION.md](STRIPE_INTEGRATION.md) — Stripe setup details
- [../SECRETS_GUIDE.md](../SECRETS_GUIDE.md) — Security best practices
- [../DEPLOY.md](../DEPLOY.md) — Production deployment

