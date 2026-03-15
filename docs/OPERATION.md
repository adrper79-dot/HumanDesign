# Operations Runbook — Prime Self

## Prerequisites

- Node.js 18+
- Wrangler CLI: `npm install -g wrangler` (or use `npx wrangler`)
- Authenticated with Cloudflare: `npx wrangler login`
- All required secrets configured (see below)

---

## Secrets Management

All secrets are stored as Cloudflare Worker secrets — never in source control.

### Set a secret

```bash
cd workers
npx wrangler secret put SECRET_NAME
# Prompts for value on stdin
```

### List secrets (names only, not values)

```bash
npx wrangler secret list
```

### Required secrets

| Name | Description |
|---|---|
| `NEON_CONNECTION_STRING` | Neon PostgreSQL pooled connection string |
| `JWT_SECRET` | Random 32+ byte string for signing JWTs |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key (primary LLM) |
| `GROK_API_KEY` | xAI Grok 4 Fast API key (failover LLM 2) |
| `GROQ_API_KEY` | Groq API key (failover LLM 3) |
| `TELNYX_API_KEY` | Telnyx API key for SMS |
| `TELNYX_PHONE_NUMBER` | Outbound SMS number (E.164 format) |
| `TELNYX_CONNECTION_ID` | Telnyx connection / messaging profile ID |
| `AI_GATEWAY_URL` | Cloudflare AI Gateway URL (optional — adds caching + observability) |
| `SENTRY_DSN` | Sentry DSN for error tracking (optional — errors silently no-op without it) |
| `SENTRY_RELEASE` | Release tag for Sentry error grouping (optional — e.g. git SHA or date) |

---

## Deploying the Worker

```bash
cd workers
npx wrangler deploy
```

Wrangler builds `src/index.js` (ESM), bundles dependencies, and uploads to the `prime-self-api` Worker. The Worker is live within seconds.

**Verify deployment:**
```bash
curl https://prime-self-api.adrper79.workers.dev/api/health
# Expected: {"status":"ok","version":"0.2.0"}
```

---

## Deploying the Frontend

The frontend is a single static file deployed to Cloudflare Pages.

### First-time setup (do once)

```bash
cd workers
npx wrangler pages project create prime-self-ui --production-branch main
```

### Deploy

```bash
cd workers
npx wrangler pages deploy ../frontend --project-name prime-self-ui --branch main --commit-dirty=true
```

Pages propagates globally within ~30 seconds.

**Live URL:** `https://prime-self-ui.pages.dev`

---

## Database Migrations

Schema changes are managed by `workers/src/db/migrate.js`.

### Run migrations

Migrations run automatically on the first request after a deploy if the Worker detects unapplied migrations in `_migrations`. To run manually (requires database access):

```bash
cd workers
node src/db/migrate.js
```

### Migration file convention

Each migration is a SQL file in `workers/src/db/migrations/`. File names follow the pattern `NNN_description.sql` (e.g. `001_initial_schema.sql`). Applied migrations are tracked in the `_migrations` table.

---

## Running Tests

```bash
# From repo root
npx vitest run
# Expected: 263 tests passing (56 canonical + 103 engine + 41 handler + 63 numerology)
```

Run in watch mode during development:
```bash
npx vitest
```

---

## Local Development

### Worker (API)

```bash
cd workers
npx wrangler dev
# Runs at http://localhost:8787
```

Wrangler injects secrets from `.dev.vars` — copy `workers/.dev.vars.example` to `workers/.dev.vars` and fill in values. **Never commit `.dev.vars`.**

### Frontend

```bash
cd frontend
python3 -m http.server 4200
# Open http://localhost:4200
```

To target the local Worker instead of production, change the `const API` constant at the top of `frontend/index.html`:
```javascript
const API = 'http://localhost:8787'; // local
// const API = 'https://prime-self-api.adrper79.workers.dev'; // production
```

---

## Monitoring

### Real-time log tail

```bash
cd workers
npx wrangler tail
# Streams all Worker invocations + console.log / console.error output
```

### Cloudflare dashboard

- Workers & Pages > `prime-self-api` > Metrics — request volume, CPU time, errors
- Workers & Pages > KV — key counts, size per namespace
- Workers & Pages > R2 — object counts, bandwidth

### Neon dashboard

`console.neon.tech` — query statistics, connection counts, branch management.

### Sentry Error Tracking

Sentry captures all unhandled Worker exceptions with full stack traces, request context, and user tier.

#### Setup (one-time)

```bash
# 1. Create account at sentry.io → New Project → JavaScript (Node/Cloudflare Workers)
# 2. Copy the DSN from Project Settings → Client Keys
cd workers
npx wrangler secret put SENTRY_DSN
# Paste your DSN: https://<key>@<org>.ingest.sentry.io/<project-id>

# Optional: pin a release tag to Sentry errors
npx wrangler secret put SENTRY_RELEASE
# e.g. "2026-03-13" or a git SHA
```

#### Daily workflow

1. `sentry.io` → Issues → sort by **Frequency** — triage new errors
2. Assign issues to yourself, add context in comments
3. Mark resolved once the fix is deployed
4. Set up **Alert Rules** (Sentry → Alerts → Create Alert):
   - New issue → notify via email/Slack immediately
   - Error rate spike (>10 errors/min) → urgent notification
   - First occurrence of new error type → email

#### What gets captured automatically

| Trigger | What Sentry receives |
|---------|----------------------|
| Unhandled Worker exception | Stack trace, request URL/method, user ID + tier |
| Any 5xx response path | Via `sentry.captureException()` in `index.js` global error handler |
| Manually instrumented | Call `sentry.captureMessage()` or `sentry.captureException()` in any handler |

#### Adding breadcrumbs in a handler (optional)

```javascript
// In index.js or any handler, after initSentry(env):
sentry.addBreadcrumb({ category: 'billing', message: 'Checkout started', data: { tier } });
// ... later if an error occurs, Sentry includes this trail
```

### Stripe Integration Monitoring

**Dashboard:** `dashboard.stripe.com`

#### Daily Health Checks

1. **Webhooks → Endpoints**  
   - Check delivery success rate (should be >95%)
   - Failed events show error details (500, timeout, etc.)
   - Click "Resend" to retry failed webhooks

2. **Home → Analytics**  
   - Monitor Monthly Recurring Revenue (MRR) trends
   - Check subscriber growth rate
   - Review churn rate (cancellations)

3. **Payments → Disputed payments**  
   - Handle chargebacks within 7 days
   - Respond with evidence (invoice, subscription terms)

4. **Customers → Subscriptions**  
   - Review recent cancellations
   - Check cancellation reasons (Stripe collects feedback)
   - Identify patterns (e.g., "too expensive" spike)

#### Webhook Health Queries

Check webhook processing in worker logs:

```bash
cd workers
npx wrangler tail --format pretty | grep "Webhook"
```

Expected output:
```
Webhook verified: checkout.session.completed
Subscription created for user: 123e4567-e89b-12d3-a456-426614174000
```

Check database consistency:

```sql
-- Count subscriptions by status
SELECT status, COUNT(*) 
FROM subscriptions 
GROUP BY status;

-- Expected: mostly 'active', some 'cancelled'

-- Recently failed payments
SELECT u.email, pe.event_type, pe.failure_reason, pe.created_at
FROM payment_events pe
JOIN subscriptions s ON pe.subscription_id = s.id
JOIN users u ON s.user_id = u.id
WHERE pe.status = 'failed'
ORDER BY pe.created_at DESC
LIMIT 10;

-- Users in grace period (past_due but still have access)
SELECT u.email, s.tier, s.status, s.current_period_end
FROM subscriptions s
JOIN users u ON s.user_id = u.id
WHERE s.status = 'past_due';
```

#### Alert Thresholds

Set up alerts for:

- **Webhook failure rate > 5%** (investigate handler errors)
- **Payment failure rate > 10%** (card declines spiking)
- **Monthly churn > 5%** (investigate product issues)
- **Checkout abandonment > 40%** (checkout friction)

#### Common Stripe Incidents

**Incident: User reports upgrade didn't work**

1. Get user email
2. Query database:
   ```sql
   SELECT u.email, s.tier, s.status, s.stripe_subscription_id
   FROM users u
   LEFT JOIN subscriptions s ON u.id = s.user_id
   WHERE u.email = 'user@example.com';
   ```
3. Check Stripe Dashboard → Customers → Search by email
4. Verify subscription status in Stripe
5. If mismatch between Stripe and database:
   - Option A: Manually trigger webhook (Stripe → Events → Find event → Resend)
   - Option B: Update database manually (emergency only)
6. Instruct user to log out and log back in (refreshes tier in UI)

**Incident: Webhook signature verification failing**

Symptom: All webhooks showing 400 errors

1. Check worker logs: `npx wrangler tail | grep "signature"`
2. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard → Webhooks → Endpoint signing secret
3. Update secret if needed:
   ```bash
   cd workers
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   # Paste secret from Stripe Dashboard
   ```
4. Resend failed webhooks from Stripe Dashboard

**Incident: Refund request from user**

1. Go to Stripe Dashboard → Payments → Search by user email
2. Click payment → "Refund"
3. Select full or partial refund
4. Stripe sends `charge.refunded` webhook (auto-downgrades tier if full refund)
5. Verify tier updated in database:
   ```sql
   SELECT tier, status FROM subscriptions 
   WHERE user_id = (SELECT id FROM users WHERE email = 'user@example.com');
   ```
6. Email user confirmation

**Incident: High failed payment rate**

Cause: Usually expired cards at month-end

1. Stripe automatically emails users to update payment method
2. Check Stripe → More → Email history
3. If user doesn't update card within 7 days, subscription auto-cancels
4. User can resubscribe anytime (no data loss)

---

## Rollback

### Worker

```bash
# List recent deployments
npx wrangler deployments list

# Rollback to a previous deployment
npx wrangler rollback <deployment-id>
```

### Frontend (Pages)

1. Go to `dash.cloudflare.com` → Workers & Pages → `prime-self-ui`
2. Select a previous deployment → **Rollback to this deployment**

---

## KV Namespaces

Defined in `wrangler.toml`:

| Binding | Namespace | Purpose |
|---|---|---|
| `CACHE` | `prime-self-cache` | Chart & geocode results |

### Inspect / delete a KV key

```bash
cd workers
# Read
npx wrangler kv key get "geo:tampa, fl, usa" --namespace-id <id>

# Delete
npx wrangler kv key delete "geo:tampa, fl, usa" --namespace-id <id>

# List keys matching prefix
npx wrangler kv key list --prefix "geo:" --namespace-id <id>
```

Find the namespace ID in `wrangler.toml` or `npx wrangler kv namespace list`.

---

## R2 Bucket

Bucket name: `prime-self-pdfs`

```bash
# List objects
npx wrangler r2 object list prime-self-pdfs

# Download a PDF
npx wrangler r2 object get prime-self-pdfs profiles/42/3.pdf --file ./3.pdf
```

---

## Cron / Scheduled Tasks

The daily transit snapshot runs at **06:00 UTC** every day. Defined in `wrangler.toml`:

```toml
[triggers]
crons = ["0 6 * * *"]
```

### Manually trigger the cron

```bash
curl -X POST https://prime-self-api.adrper79.workers.dev/__scheduled \
  -H "x-cf-cron: 0 6 * * *"
```

*(Only works in `wrangler dev` mode; production scheduled events are triggered by Cloudflare internally.)*

---

## Common Incidents

### LLM profile generation times out

1. Check `npx wrangler tail` for which provider failed.
2. Verify the failing API key secret is set: `npx wrangler secret list`.
3. The failover chain (Anthropic → Grok → Groq) should absorb a single provider outage automatically. If all three fail, the Worker returns `502`.

### Geocode returns 404 for a known city

1. The Nominatim query might be too short or ambiguous — try a more specific string.
2. Check if Nominatim is rate-limiting the Worker IP (unlikely on CF edge but possible during a burst). The Worker returns `502` in that case.
3. Force-delete the stale KV cache key if needed.

### Database connection errors

1. Check Neon dashboard for the project's status (auto-suspend after inactivity is expected; the first request after suspend adds ~500 ms).
2. Verify `NEON_CONNECTION_STRING` secret includes `?sslmode=require`.
3. Check connection pool limits on the Neon free tier (max 3 concurrent connections).

### Frontend shows CORS error

1. Verify the `ALLOWED_ORIGINS` list in `workers/src/middleware/cors.js` includes the Pages domain.
2. After updating the list, redeploy the Worker: `npx wrangler deploy`.

---

## Version History

> Note: This table is a high-level historical summary and may not reflect exact route counts in the current router.

| Version | Notes |
|---|---|
| v0.5.0 | Historical phase: geocode lookup replaced manual lat/lng flow; cron transit snapshots; PDF exports; practitioner tools |
| v0.4.x | Auth, KV caching, R2 PDF, LLM failover chain |
| v0.3.x | Transit forecast, cluster API |
| v0.2.x | Profile generation, history endpoints |
| v0.1.0 | Chart calculation, basic auth |
