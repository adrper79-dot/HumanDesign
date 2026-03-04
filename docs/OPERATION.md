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
| `GROK_API_KEY` | xAI Grok API key (failover LLM 2) |
| `GROQ_API_KEY` | Groq API key (failover LLM 3) |
| `TELNYX_API_KEY` | Telnyx API key for SMS |
| `TELNYX_PHONE_NUMBER` | Outbound SMS number (E.164 format) |
| `TELNYX_CONNECTION_ID` | Telnyx connection / messaging profile ID |
| `AI_GATEWAY_URL` | Cloudflare AI Gateway URL (optional — adds caching + observability) |

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
# Expected: {"status":"ok","endpoints":32,"version":"0.5.0"}
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
# Expected: 190 tests passing (86 engine + 41 handler + 63 numerology)
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

| Version | Notes |
|---|---|
| v0.5.0 | 32 endpoints; geocode lookup replaces lat/lng inputs; cron transit snapshots; PDF exports; practitioner tools |
| v0.4.x | Auth, KV caching, R2 PDF, LLM failover chain |
| v0.3.x | Transit forecast, cluster API |
| v0.2.x | Profile generation, history endpoints |
| v0.1.0 | Chart calculation, basic auth |
