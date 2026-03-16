# Developer Onboarding Guide

Welcome to Prime Self. This guide gets a new contributor to a running local dev environment in one sitting.

---

## Prerequisites

| Tool | Min version | Notes |
|---|---|---|
| Node.js | 20 LTS | `node -v` to verify |
| npm | 10+ | comes with Node 20 |
| Wrangler | 3.x | `npm i -g wrangler` |
| PostgreSQL | 15+ | or use Neon (cloud) |
| Git | any | — |

---

## 1 — Clone and install

```bash
git clone <repo-url>
cd HumanDesign

# Root workspace deps (Vitest, Playwright config, scripts)
npm install

# Worker deps
cd workers && npm install && cd ..
```

---

## 2 — Cloudflare auth

```bash
wrangler login
# Opens browser → authorise Cloudflare account
```

---

## 3 — Database setup

Prime Self uses **Neon** (serverless Postgres) in production.  
For local dev you can use any Postgres 15+ instance.

```bash
# Point to your DB
export DATABASE_URL="postgresql://user:pass@localhost:5432/primeself"

# Apply schema (all migrations are idempotent)
psql $DATABASE_URL -f workers/src/db/schema.sql
```

Schema file: [workers/src/db/schema.sql](../workers/src/db/schema.sql)

---

## 4 — Required secrets

Set each secret for the `dev` environment via Wrangler:

```bash
cd workers

# Core
wrangler secret put DATABASE_URL
wrangler secret put JWT_SECRET               # any 32+ char random string for local
wrangler secret put SESSION_SECRET           # any 32+ char random string

# Stripe (use Stripe test-mode keys)
wrangler secret put STRIPE_SECRET_KEY        # sk_test_...
wrangler secret put STRIPE_WEBHOOK_SECRET    # whsec_... (from stripe listen)

# Email — Resend (free tier is fine for dev)
wrangler secret put RESEND_API_KEY           # re_...
wrangler secret put FROM_EMAIL               # "Prime Self <hello@example.com>"

# OpenAI / LLM (required for profile generation)
wrangler secret put OPENAI_API_KEY           # sk-...
```

Full reference: [guides/ENVIRONMENT_VARIABLES.md](../guides/ENVIRONMENT_VARIABLES.md)

Optional secrets (SMS, push, OAuth, Sentry, Notion) can be skipped during initial setup — the relevant features will degrade gracefully.

---

## 5 — KV namespaces (local dev)

Wrangler provides a local KV store by default for `wrangler dev`. No setup needed — it uses `.wrangler/state/` automatically.

For staging/production KV namespaces, see the TODO comments in [workers/wrangler.toml](../workers/wrangler.toml#L149).

---

## 6 — Start the dev server

```bash
cd workers
wrangler dev --local
# Worker available at http://localhost:8787
```

The frontend is static HTML — open `frontend/index.html` directly in a browser, or serve it:

```bash
npx serve frontend -p 3000
# Visit http://localhost:3000
# API calls go to http://localhost:8787 (configure BASE_URL if needed)
```

---

## 7 — Running tests

All tests are deterministic (no network, no real DB):

```bash
# From repo root
npm run test:deterministic

# Watch mode
npm run test:deterministic -- --watch

# Coverage
npm run test:deterministic -- --coverage
```

Test files live in `tests/`. Configuration: [vitest.config.js](../vitest.config.js).

Target baseline: **473 passing / 0 failing**. Never merge if this drops.

---

## 8 — Project structure

```
workers/
  src/
    handlers/       # One file per feature area (auth, billing, chart…)
    db/
      queries.js    # All SQL — QUERIES object (never inline SQL elsewhere)
      schema.sql    # DDL
    lib/
      email.js      # All email templates
      stripe.js     # Stripe client helpers
      sentry.js     # Error tracking
    cron.js         # Scheduled job (daily digest, dunning, drip campaigns)
    index.js        # Router + middleware (source of truth for all routes)
frontend/
  index.html        # SPA shell
  js/
    app.js          # Main application logic
tests/              # Vitest unit tests
docs/               # Guides and API reference
audits/
  issue-registry.json  # Bug/issue tracker (check before starting work)
```

---

## 9 — Issue workflow

Before writing any code, check the issue registry:

```bash
node scripts/next-issue.js           # Next P0 issue
node scripts/next-issue.js --all     # All open issues
node scripts/next-issue.js --summary # Counts by severity
```

Mark resolved after fixing:

```bash
node scripts/mark-resolved.js <issue-id>
```

---

## 10 — Deployment

```bash
# Staging
cd workers && wrangler deploy --env staging

# Production (requires team approval)
cd workers && wrangler deploy
```

CI runs on GitHub Actions. See `.github/workflows/` for pipeline details.

---

## 11 — Common gotchas

- **Request-scoped DB pool**: `createQueryFn` in `queries.js` creates a new Pool per request. This is intentional — Cloudflare V8 isolates cannot reuse I/O handles across requests. See the comment at the top of `queries.js`.
- **No `async` in Workers top-level**: All async code must be inside `fetch`/`scheduled` handlers.
- **KV is eventually consistent**: Don't use KV for things that require strong consistency (use DB instead).
- **Stripe webhook signature**: `STRIPE_WEBHOOK_SECRET` must match the endpoint secret from the Stripe dashboard. Use `stripe listen --forward-to localhost:8787/api/webhook/stripe` for local testing.
- **Email templates**: All email functions are in `workers/src/lib/email.js`. Follow the existing dark-theme HTML pattern. Always guard with `if (env.RESEND_API_KEY)`.

---

*Last updated: Cycle 6 — 2026-03-16*
