# Environment Variables & Configuration

Reference guide for all secrets, environment variables, bindings, and configuration options.

**Time to configure**: 10–20 minutes (depending on features enabled)

---

## Overview

Prime Self uses three kinds of configuration:

1. **Secrets** — sensitive values stored via `wrangler secret put` (never in code)
2. **Wrangler `[vars]`** — non-sensitive config set in `workers/wrangler.toml`
3. **Bindings** — Cloudflare KV / R2 resources defined in `workers/wrangler.toml`

---

## How Secrets Work

### Setting Secrets
```bash
npx wrangler secret put <NAME>
# Paste value, press Ctrl+D (or Cmd+D on Mac)
```

### Listing Secrets
```bash
npx wrangler secret list
```

---

## Complete Reference

### Core Secrets (Required)

| Secret | Service | Used In | How to Get |
|--------|---------|---------|-----------|
| `NEON_CONNECTION_STRING` | Database | All handlers, cron, middleware | [Neon Console](https://console.neon.tech) — use **pooled** connection string |
| `ANTHROPIC_API_KEY` | LLM (Claude) | `lib/llm.js` | [Anthropic Console](https://console.anthropic.com) |
| `JWT_SECRET` | Auth | `handlers/auth.js`, `middleware/auth.js` | Generate: `openssl rand -hex 32` |
| `RESEND_API_KEY` | Email (Resend) | `handlers/auth.js`, `handlers/webhook.js`, `cron.js` | [Resend Dashboard](https://resend.com) |
| `FROM_EMAIL` | Email sender address | `handlers/auth.js`, `handlers/webhook.js`, `cron.js` | Your verified Resend domain, e.g. `hello@primeself.app` |
| `FRONTEND_URL` | App base URL | `handlers/auth.js`, `handlers/billing.js`, `handlers/referrals.js` | e.g. `https://primeself.app` |

### Stripe Secrets (Required for payments)

| Secret | Used In | How to Get |
|--------|---------|-----------|
| `STRIPE_SECRET_KEY` | `handlers/billing.js`, `handlers/webhook.js`, `handlers/referrals.js` | [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | `handlers/webhook.js` | [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) |

### Stripe Price IDs (wrangler.toml `[vars]`)

Set in `workers/wrangler.toml` under `[vars]`:

Legacy variable names are still used in config for compatibility, but they map to the current plan names below.

| Variable | Used In | Description |
|----------|---------|-------------|
| `STRIPE_PRICE_REGULAR` | `lib/stripe.js`, `handlers/webhook.js` | Legacy variable name retained for the current Individual tier price ID ($19/mo) |
| `STRIPE_PRICE_PRACTITIONER` | `lib/stripe.js`, `handlers/webhook.js` | Current Practitioner tier price ID ($97/mo) |
| `STRIPE_PRICE_WHITE_LABEL` | `lib/stripe.js`, `handlers/webhook.js` | Legacy variable name retained for the current Agency tier price ID ($349/mo) |

### SMS — Telnyx (Required for SMS digests)

| Secret | Used In | How to Get |
|--------|---------|-----------|
| `TELNYX_API_KEY` | `handlers/sms.js` | [Telnyx → Auth → API Keys](https://portal.telnyx.com) |
| `TELNYX_PHONE_NUMBER` | `handlers/sms.js` | [Telnyx → Phone Numbers](https://portal.telnyx.com/phone-numbers) |
| `TELNYX_PUBLIC_KEY` | `handlers/sms.js` | [Telnyx → Auth → Public Key](https://portal.telnyx.com) — Ed25519 key for webhook signature verification. **Required** — webhooks are rejected without it. |
| `TELNYX_CONNECTION_ID` | `handlers/sms.js` | Your Telnyx Messaging Profile ID |

### LLM Fallback Keys (Optional)

| Secret | Used In | Description |
|--------|---------|-------------|
| `GROK_API_KEY` | `lib/llm.js` | xAI Grok 4 Fast API key — LLM fallback provider 2 |
| `GROQ_API_KEY` | `lib/llm.js` | Groq API key — LLM fallback provider 3 |
| `AI_GATEWAY_URL` | `lib/llm.js` | Cloudflare AI Gateway URL — optional proxy for LLM calls |

### Push Notifications — VAPID (Required for web push)

| Secret | Used In | How to Get |
|--------|---------|-----------|
| `VAPID_PUBLIC_KEY` | `handlers/push.js` | Generate with `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | `handlers/push.js` | Same command as above |
| `VAPID_SUBJECT` | `handlers/push.js` | e.g. `mailto:admin@primeself.app` |

### Social OAuth — Google & Apple (Required for OAuth login)

| Secret | Used In | How to Get |
|--------|---------|-----------|
| `GOOGLE_CLIENT_ID` | `handlers/oauthSocial.js` | [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client |
| `GOOGLE_CLIENT_SECRET` | `handlers/oauthSocial.js` | Same page as above |
| `APPLE_CLIENT_ID` | `handlers/oauthSocial.js` | [Apple Developer](https://developer.apple.com) → Certificates → Services IDs |
| `APPLE_TEAM_ID` | `handlers/oauthSocial.js` | Apple Developer membership page (10-char ID) |
| `APPLE_KEY_ID` | `handlers/oauthSocial.js` | Apple Developer → Keys → Key ID from the `.p8` filename |
| `APPLE_PRIVATE_KEY` | `handlers/oauthSocial.js` | Full contents of the `.p8` file — newlines as `\n` |

> Without these secrets, OAuth endpoints return 503. Email/password auth is unaffected.

### Error Tracking — Sentry (Optional but recommended)

| Secret | Used In | How to Get |
|--------|---------|-----------|
| `SENTRY_DSN` | `lib/sentry.js`, `index.js` | [sentry.io](https://sentry.io) → New Project → JavaScript → Copy DSN |
| `SENTRY_RELEASE` | `lib/sentry.js` | Optional — set to a git SHA or date stamp for error grouping |

> Without `SENTRY_DSN`, all errors are silently no-op (no crash, no tracking). See `docs/OPERATION.md` → Sentry Error Tracking for daily workflow.

### Notion Integration (Required for Notion export)

| Secret | Used In | How to Get |
|--------|---------|-----------|
| `NOTION_CLIENT_ID` | `handlers/notion.js` | [Notion Integrations](https://www.notion.so/my-integrations) |
| `NOTION_CLIENT_SECRET` | `handlers/notion.js` | Same page as above |
| `NOTION_TOKEN_ENCRYPTION_KEY` | `handlers/notion.js`, `lib/tokenCrypto.js` | Generate: `openssl rand -hex 32` — encrypts stored OAuth tokens |

### Discord Bot — `discord/` Worker (Required for Discord integration)

> These secrets are set in the **`discord/` Worker**, not the main `workers/` Worker.
> Run all `wrangler` commands from the `discord/` directory.

| Secret | Used In | How to Get |
|--------|---------|-----------|
| `DISCORD_APPLICATION_ID` | `discord/src/index.js` | [Discord Developer Portal](https://discord.com/developers/applications) → Your App → General Information |
| `DISCORD_PUBLIC_KEY` | `discord/src/index.js` | Discord Developer Portal → Your App → General Information |
| `DISCORD_BOT_TOKEN` | `discord/src/index.js` | Discord Developer Portal → Your App → Bot → Reset Token |
| `PRIME_SELF_API_SECRET` | `discord/src/index.js` | Generate: `openssl rand -base64 48` — guards internal API calls (Phase 2+) |

| Binding | Type | Used In | Description |
|---------|------|---------|-------------|
| `DISCORD_RATE_LIMIT` | KV Namespace | `discord/src/index.js` | Per-user rate limiting (3 requests/24h) |
| `PRIME_SELF_API_URL` | `[vars]` | `discord/src/index.js` | Deployed Prime Self Worker URL — set in `discord/wrangler.toml [vars]` |

**Setup commands (from `discord/` directory):**
```bash
# Create KV namespace (paste the generated id into discord/wrangler.toml)
npx wrangler kv namespace create DISCORD_RATE_LIMIT

# Set secrets
npx wrangler secret put DISCORD_APPLICATION_ID
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler secret put PRIME_SELF_API_SECRET

# Deploy
npx wrangler deploy
```

---

### Admin & Misc

| Secret/Var | Used In | Description |
|------------|---------|-------------|
| `ADMIN_TOKEN` | `handlers/promo.js` | Token for admin-only promo code management endpoints |
| `BASE_URL` | `handlers/notion.js` | Worker's base URL, e.g. `https://prime-self-api.workers.dev` |
| `ENVIRONMENT` | `index.js`, `lib/sentry.js`, `middleware/cors.js` | Set in wrangler.toml `[vars]`: `"production"` or `"development"` |

### Cloudflare Bindings (wrangler.toml)

| Binding | Type | Used In | Description |
|---------|------|---------|-------------|
| `CACHE` | KV Namespace | `lib/cache.js`, `middleware/rateLimit.js`, `handlers/auth.js` | Rate limiting, brute force tracking, general caching |
| `RATE_LIMIT_KV` | KV Namespace | `middleware/tierEnforcement.js` | Daily ceiling counters per user/action. Key format: `daily:{userId}:{YYYY-MM-DD}:{action}`, TTL 48h. |
| `R2` | R2 Bucket | `handlers/pdf.js` | PDF export storage |

---

## Quick Setup (All Secrets)

```bash
# Core (required)
npx wrangler secret put NEON_CONNECTION_STRING
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put JWT_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put FROM_EMAIL
npx wrangler secret put FRONTEND_URL

# Stripe (required for payments)
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET

# Telnyx (required for SMS)
npx wrangler secret put TELNYX_API_KEY
npx wrangler secret put TELNYX_PHONE_NUMBER
npx wrangler secret put TELNYX_PUBLIC_KEY
npx wrangler secret put TELNYX_CONNECTION_ID

# Push notifications
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT

# Notion integration
npx wrangler secret put NOTION_CLIENT_ID
npx wrangler secret put NOTION_CLIENT_SECRET
npx wrangler secret put NOTION_TOKEN_ENCRYPTION_KEY

# Social OAuth — Google
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# Social OAuth — Apple
npx wrangler secret put APPLE_CLIENT_ID
npx wrangler secret put APPLE_TEAM_ID
npx wrangler secret put APPLE_KEY_ID
npx wrangler secret put APPLE_PRIVATE_KEY

# Error tracking
npx wrangler secret put SENTRY_DSN
npx wrangler secret put SENTRY_RELEASE

# LLM fallbacks (optional)
npx wrangler secret put GROK_API_KEY
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put AI_GATEWAY_URL

# Admin
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put BASE_URL
```

### wrangler.toml `[vars]` (non-secret config)

```toml
[vars]
ENVIRONMENT = "production"
STRIPE_PRICE_REGULAR = "price_..."
STRIPE_PRICE_PRACTITIONER = "price_..."
STRIPE_PRICE_WHITE_LABEL = "price_..."
```

### wrangler.toml Bindings

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-rate-limit-kv-namespace-id"

[[r2_buckets]]
binding = "R2"
bucket_name = "your-r2-bucket-name"
```

---

## Configuration Checklist

Before deploying, verify:

**Core (always required):**
- [ ] `NEON_CONNECTION_STRING` — pooled connection string from Neon Console
- [ ] `ANTHROPIC_API_KEY` — valid Claude API key
- [ ] `JWT_SECRET` — random 64-char hex string (`openssl rand -hex 32`)
- [ ] `RESEND_API_KEY` — Resend email service key
- [ ] `FROM_EMAIL` — verified sender email
- [ ] `FRONTEND_URL` — your app URL (e.g. `https://primeself.app`)
- [ ] `ENVIRONMENT` — set to `production` in wrangler.toml `[vars]`
- [ ] `CACHE` KV binding — created and bound in wrangler.toml

**Payments (Stripe):**
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_PRICE_REGULAR`, `STRIPE_PRICE_PRACTITIONER`, `STRIPE_PRICE_WHITE_LABEL` in wrangler.toml with current Individual / Practitioner / Agency mappings

**SMS (Telnyx):**
- [ ] `TELNYX_API_KEY`
- [ ] `TELNYX_PHONE_NUMBER`
- [ ] `TELNYX_PUBLIC_KEY` — Ed25519 public key for webhook verification
- [ ] `TELNYX_CONNECTION_ID` — messaging profile ID

**Push Notifications:**
- [ ] `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

**Notion Export:**
- [ ] `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_TOKEN_ENCRYPTION_KEY`

**Social OAuth (Google & Apple login):**
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [ ] `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`

**Error Tracking:**
- [ ] `SENTRY_DSN` — without this, all errors are silently discarded

**Optional:**
- [ ] `GROK_API_KEY`, `GROQ_API_KEY` — LLM fallback providers
- [ ] `AI_GATEWAY_URL` — if using Cloudflare AI Gateway
- [ ] `ADMIN_TOKEN` — for promo code management
- [ ] `R2` bucket binding — for PDF export storage

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

