# Prime Self — Secrets Rotation Guide

> **CRITICAL**: After configuring all secrets via `wrangler secret put`, **delete `Secrets.txt`** from the repository. It contains live credentials in plain text.

---

## How Secrets Work in Cloudflare Workers

Secrets are stored encrypted in Cloudflare's edge network. They are injected into your Worker as `env.SECRET_NAME` at runtime. They never appear in source code or build output.

**To set a secret:**
```bash
cd workers
npx wrangler secret put SECRET_NAME
# Paste the value when prompted
```

**To list existing secrets:**
```bash
npx wrangler secret list
```

**To delete a secret:**
```bash
npx wrangler secret delete SECRET_NAME
```

---

## Secret Inventory

### 1. `NEON_CONNECTION_STRING`

| Field | Value |
|-------|-------|
| **Service** | [Neon](https://console.neon.tech) — Serverless PostgreSQL |
| **Used by** | Every handler that calls `createQueryFn(env.NEON_CONNECTION_STRING)` (~100+ call sites across all handler files) |
| **Format** | `postgresql://<user>:<password>@<host>/<database>?sslmode=require` |
| **Where to rotate** | Neon Console → Project → Connection Details → Reset Password |
| **wrangler command** | `npx wrangler secret put NEON_CONNECTION_STRING` |

**Steps to rotate:**
1. Go to [Neon Console](https://console.neon.tech) → your project
2. Click **Connection Details** → **Reset Password**
3. Copy the new connection string (use the **Pooler** endpoint for best Workers performance)
4. Run `npx wrangler secret put NEON_CONNECTION_STRING` and paste the new string

---

### 2. `ANTHROPIC_API_KEY`

| Field | Value |
|-------|-------|
| **Service** | [Anthropic](https://console.anthropic.com) — Claude AI (LLM synthesis) |
| **Used by** | `workers/src/handlers/profile.js`, `profile-stream.js`, `cluster.js` (AI synthesis), `onboarding.js` |
| **Format** | `sk-ant-api03-...` |
| **Where to rotate** | Anthropic Console → Settings → API Keys → Create Key → Revoke old key |
| **wrangler command** | `npx wrangler secret put ANTHROPIC_API_KEY` |

**Steps to rotate:**
1. Go to [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Click **Create Key** → name it `prime-self-production`
3. Copy the key, run `npx wrangler secret put ANTHROPIC_API_KEY`
4. Verify a profile generation works, then **revoke the old key**

---

### 3. `JWT_SECRET`

| Field | Value |
|-------|-------|
| **Service** | Internal — JSON Web Token signing |
| **Used by** | `workers/src/middleware/auth.js` (token verification), `workers/src/handlers/auth.js` (token issuance) |
| **Format** | Any random string, minimum 32 characters. Use `openssl rand -base64 48` |
| **Where to rotate** | Self-generated — no external service |
| **wrangler command** | `npx wrangler secret put JWT_SECRET` |

**⚠️ Impact of rotation:** All existing user sessions will be invalidated. Users must re-login. Plan for off-peak hours.

**Steps to rotate:**
1. Generate a new secret: `openssl rand -base64 48`
2. Run `npx wrangler secret put JWT_SECRET` and paste
3. All users' tokens will become invalid — they'll need to sign in again

---

### 4. `STRIPE_SECRET_KEY`

| Field | Value |
|-------|-------|
| **Service** | [Stripe](https://dashboard.stripe.com) — Payments |
| **Used by** | `workers/src/handlers/billing.js`, `webhook.js`, `referrals.js` |
| **Format** | `sk_live_...` (live) or `sk_test_...` (test) |
| **Where to rotate** | Stripe Dashboard → Developers → API Keys → Roll Key |
| **wrangler command** | `npx wrangler secret put STRIPE_SECRET_KEY` |

**Steps to rotate:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Click **Roll key** on the Secret key — Stripe gives you 24h where both old and new work
3. Copy new key, run `npx wrangler secret put STRIPE_SECRET_KEY`
4. Verify a checkout works, then expire the old key in Stripe

---

### 5. `STRIPE_WEBHOOK_SECRET`

| Field | Value |
|-------|-------|
| **Service** | [Stripe](https://dashboard.stripe.com) — Webhook signature verification |
| **Used by** | `workers/src/handlers/webhook.js` (Stripe webhook signature verification) |
| **Format** | `whsec_...` |
| **Where to rotate** | Stripe Dashboard → Developers → Webhooks → Your endpoint → Reveal signing secret |
| **wrangler command** | `npx wrangler secret put STRIPE_WEBHOOK_SECRET` |

**Steps to rotate:**
1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click your endpoint → **Roll secret**
3. Copy new secret, run `npx wrangler secret put STRIPE_WEBHOOK_SECRET`

---

### 6. `TELNYX_API_KEY`

| Field | Value |
|-------|-------|
| **Service** | [Telnyx](https://portal.telnyx.com) — SMS messaging |
| **Used by** | `workers/src/handlers/sms.js` |
| **Format** | `KEY...` |
| **Where to rotate** | Telnyx Portal → Auth V2 → API Keys → Create Key → Delete old key |
| **wrangler command** | `npx wrangler secret put TELNYX_API_KEY` |

---

### 7. `TELNYX_PHONE_NUMBER`

| Field | Value |
|-------|-------|
| **Service** | Telnyx — The sending phone number |
| **Used by** | `workers/src/handlers/sms.js` |
| **Format** | `+1XXXXXXXXXX` (E.164) |
| **Where to rotate** | Only if you change your Telnyx number |
| **wrangler command** | `npx wrangler secret put TELNYX_PHONE_NUMBER` |

---

### 8. `AI_GATEWAY_URL`

| Field | Value |
|-------|-------|
| **Service** | Cloudflare AI Gateway — Routes AI API calls through CF for logging/caching |
| **Used by** | Profile generation (AI synthesis calls) |
| **Format** | `https://<domain>` |
| **Where to rotate** | Cloudflare Dashboard → AI → AI Gateway |
| **wrangler command** | `npx wrangler secret put AI_GATEWAY_URL` |

---

### 9. `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET`

| Field | Value |
|-------|-------|
| **Service** | [Notion](https://www.notion.so/my-integrations) — OAuth integration |
| **Used by** | `workers/src/handlers/notion.js` (OAuth flow) |
| **Format** | Notion integration credentials |
| **Where to rotate** | Notion → My Integrations → Your integration → Secrets |
| **wrangler commands** | `npx wrangler secret put NOTION_CLIENT_ID` and `npx wrangler secret put NOTION_CLIENT_SECRET` |

---

### 10. `RESEND_API_KEY` (if configured)

| Field | Value |
|-------|-------|
| **Service** | [Resend](https://resend.com) — Email delivery |
| **Used by** | `workers/src/handlers/email.js` (transactional email) |
| **Format** | `re_...` |
| **Where to rotate** | Resend Dashboard → API Keys |
| **wrangler command** | `npx wrangler secret put RESEND_API_KEY` |

---

## Frontend Environment Variables (wrangler.toml `[vars]`)

These are **not secrets** — they are public config baked into the Worker:

| Variable | Purpose | File |
|----------|---------|------|
| `ENVIRONMENT` | `"production"` or `"staging"` | `wrangler.toml` |
| `STRIPE_PRICE_REGULAR` | Stripe Price ID for Explorer tier ($12/mo) | `wrangler.toml` |
| `STRIPE_PRICE_PRACTITIONER` | Stripe Price ID for Guide tier ($60/mo) | `wrangler.toml` |
| `STRIPE_PRICE_WHITE_LABEL` | Stripe Price ID for Studio tier ($149/mo) | `wrangler.toml` |

These are set in `workers/wrangler.toml` under `[vars]` and are safe to commit.

---

## Stripe Publishable Key (Frontend)

The **publishable key** (`pk_live_...`) is embedded in the frontend HTML and is safe to expose — it can only create tokens, not charge cards. It's in:
- `frontend/index.html` (JavaScript section, Stripe.js initialization)

No rotation needed unless you create a new Stripe account.

---

## KV Namespace & R2 Bucket (wrangler.toml)

| Binding | ID/Name | Purpose |
|---------|---------|---------|
| `CACHE` | KV namespace `a4869245...` | Rate limiting, chart cache |
| `R2` | Bucket `prime-self-exports` | PDF exports, knowledgebase corpus |

These are infrastructure bindings, not secrets.

---

## Rotation Checklist

```
□ Generate new JWT_SECRET:         openssl rand -base64 48
□ Set NEON_CONNECTION_STRING:      npx wrangler secret put NEON_CONNECTION_STRING
□ Set ANTHROPIC_API_KEY:           npx wrangler secret put ANTHROPIC_API_KEY
□ Set JWT_SECRET:                  npx wrangler secret put JWT_SECRET
□ Set STRIPE_SECRET_KEY:           npx wrangler secret put STRIPE_SECRET_KEY
□ Set STRIPE_WEBHOOK_SECRET:       npx wrangler secret put STRIPE_WEBHOOK_SECRET
□ Set TELNYX_API_KEY:              npx wrangler secret put TELNYX_API_KEY
□ Set TELNYX_PHONE_NUMBER:         npx wrangler secret put TELNYX_PHONE_NUMBER
□ Set AI_GATEWAY_URL:              npx wrangler secret put AI_GATEWAY_URL
□ Set NOTION_CLIENT_ID:            npx wrangler secret put NOTION_CLIENT_ID
□ Set NOTION_CLIENT_SECRET:        npx wrangler secret put NOTION_CLIENT_SECRET
□ Set RESEND_API_KEY:              npx wrangler secret put RESEND_API_KEY
□ Set AUDIT_SECRET (Worker):       npx wrangler secret put AUDIT_SECRET
□ Set AUDIT_SECRET (GitHub):       repo → Settings → Secrets → Actions → AUDIT_SECRET
□ Deploy:                          npx wrangler deploy
□ Test: auth, checkout, SMS, profile generation, Notion sync
□ DELETE Secrets.txt:              git rm Secrets.txt && git commit -m "chore: remove plaintext secrets"
□ Revoke old API keys in Anthropic, Stripe, Telnyx, Notion dashboards
```

---

### 11. Social OAuth — Google

| Field | Value |
|-------|-------|
| **Service** | [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials |
| **Used by** | `workers/src/handlers/oauthSocial.js` |
| **Setup** | Create an OAuth 2.0 Client ID (Web Application). Add `https://prime-self-api.adrper79.workers.dev/api/auth/oauth/google/callback` to Authorized Redirect URIs. Enable Google+ API and People API. |
| **wrangler commands** | `npx wrangler secret put GOOGLE_CLIENT_ID` and `npx wrangler secret put GOOGLE_CLIENT_SECRET` |

---

### 12. Social OAuth — Facebook (disabled)

| Field | Value |
|-------|-------|
| **Status** | Removed from production auth flow on 2026-03-10 |
| **Used by** | No active auth route. Kept only as historical note. |
| **Setup** | Not required. `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` are no longer needed unless Facebook login is reintroduced. |

---

### 13. Social OAuth — Apple Sign In

| Field | Value |
|-------|-------|
| **Service** | [Apple Developer Portal](https://developer.apple.com/) → Certificates, IDs & Profiles |
| **Used by** | `workers/src/handlers/oauthSocial.js` |
| **Setup (multi-step)** | 1. Create a Services ID (Identifiers → +). Set identifier (e.g. `net.selfprime.web`). Enable Sign In with Apple. Configure Web Authentication → add `prime-self-api.adrper79.workers.dev` as domain and `https://prime-self-api.adrper79.workers.dev/api/auth/oauth/apple/callback` as return URL. 2. Create a Key (Keys → +). Enable Sign In with Apple. Download the `.p8` file — **you can only download it once**. Note the Key ID from the filename. 3. Find your Team ID in the top-right corner of the developer portal. |
| **Secrets required** | `APPLE_CLIENT_ID` = your Services ID (e.g. `net.selfprime.web`) |
| | `APPLE_TEAM_ID` = 10-char team ID (e.g. `ABC1234XYZ`) |
| | `APPLE_KEY_ID` = 10-char key ID from .p8 filename |
| | `APPLE_PRIVATE_KEY` = full contents of .p8 file with real newlines (not `\n` literal) |
| **wrangler commands** | `npx wrangler secret put APPLE_CLIENT_ID` |
| | `npx wrangler secret put APPLE_TEAM_ID` |
| | `npx wrangler secret put APPLE_KEY_ID` |
| | `npx wrangler secret put APPLE_PRIVATE_KEY` |
| **Note** | Apple Sign In callback is a `POST` (not GET). The handler supports both. Apple only sends the user's name on first authorization — it's captured and stored immediately. |

---

### 14. `AUDIT_SECRET`

| Field | Value |
|-------|-------|
| **Service** | Internal — no external provider |
| **Used by** | `workers/src/handlers/analytics.js` · `scripts/collectors/app-metrics.js` · `.github/workflows/audit-cron.yml` |
| **Purpose** | Allows the GH Actions automated audit runner to call `/api/analytics/audit` without a user JWT. Must be a long random string (≥ 32 bytes). |
| **Format** | Random hex or base64 string — generate with `openssl rand -hex 32` |
| **Where to set (Worker)** | `npx wrangler secret put AUDIT_SECRET` |
| **Where to set (GitHub)** | Repository → Settings → Secrets → Actions → New secret → `AUDIT_SECRET` |
| **Rotation** | Rotate both the Worker secret and the GitHub secret together |

**Generate a value:**
```bash
openssl rand -hex 32
```

**Set in both places:**
```bash
# Worker (Cloudflare)
cd workers && npx wrangler secret put AUDIT_SECRET

# GitHub Actions — via GitHub UI:
# Repository → Settings → Secrets and variables → Actions → New repository secret
```

---

## Git History Warning

Even after deleting `Secrets.txt`, the credentials remain in git history. After rotating all secrets above:

```bash
# Remove Secrets.txt from all git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch Secrets.txt' \
  --prune-empty --tag-name-filter cat -- --all

# Force push (coordinate with team)
git push origin --force --all
```

Or use [BFG Repo Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) for faster cleanup:
```bash
bfg --delete-files Secrets.txt
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```
