# Contributing to Prime Self

## Prerequisites

- **Node.js 22** — required (CI runs Node 22; use `nvm use 22` or install from nodejs.org)
- **Wrangler CLI** — `npm install -g wrangler` (Cloudflare Workers local dev + deploy)
- **Git** — standard version control

## Local Setup

```bash
# 1. Install root-level dependencies (tests, scripts)
npm install

# 2. Install Worker dependencies
cd workers && npm install
```

## Running Tests

```bash
# From project root — runs all vitest unit tests
npm test
```

Tests live in `tests/`. E2E tests under `tests/e2e/` are excluded from the default run (they require a live environment). See `vitest.config.js` for exclusion rules.

Runtime smoke tests (e.g. `tests/observability-runtime.test.js`) require real environment variables — they are skipped automatically when env vars are absent.

## Running the Worker Locally

```bash
cd workers
wrangler dev
```

The Worker starts on `http://localhost:8787`. You'll need secrets available — copy them from `SECRETS_GUIDE.md` and set them via `wrangler secret put` or a `.dev.vars` file (not committed).

## Environment Variables & Secrets

All Worker secrets (API keys, DB connection string, JWT secret, etc.) are documented in [`SECRETS_GUIDE.md`](./SECRETS_GUIDE.md).

Set secrets with:

```bash
cd workers
npx wrangler secret put SECRET_NAME
```

Public config (Stripe price IDs, environment name) lives in `workers/wrangler.toml` under `[vars]`.

## DB Migrations

Migrations are plain SQL files in `workers/src/db/migrations/`. To apply a migration:

```bash
NEON_CONNECTION_STRING="postgresql://..." node run-migration.js
```

Name new migrations with the next sequential prefix: `042_description.sql`, etc.

## Code Structure

| Path | Purpose |
|------|---------|
| `workers/src/handlers/` | One file per API feature (auth, billing, profile, practitioner, etc.) |
| `workers/src/middleware/` | Auth, rate limiting, input validation |
| `workers/src/lib/` | Shared utilities: logger, analytics, password hashing, Sentry |
| `workers/src/db/` | Query constants (`queries.js`) and SQL migrations |
| `src/engine/` | Pure-JS chart calculation engine (Human Design, astrology) |
| `frontend/` | Vanilla JS PWA — `index.html` + `js/app.js` (no build step) |
| `tests/` | Vitest unit and integration tests |
| `scripts/` | Audit runners and metric collectors |
| `audits/` | Issue registry and generated audit reports |

## Deployment

**Worker (backend):**

```bash
cd workers
wrangler deploy              # deploy to production
wrangler deploy --env staging  # deploy to staging
```

**Frontend:**

Deploys automatically via CI on every push to `main` (GitHub Actions → `deploy-frontend.yml`). To deploy manually:

```bash
npx wrangler pages deploy frontend --project-name=prime-self-ui
```

## Testing Strategy

- **Unit tests** (`tests/*.test.js`): Run with `npm test`. Mock DB/KV where possible.
- **Runtime smoke tests** (`tests/*-runtime.test.js`): Require live env vars (`NEON_CONNECTION_STRING`, etc.). Skipped in CI unless env vars are present.
- **E2E tests** (`tests/e2e/`): Playwright. Run with `E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npx playwright test`.

## Issue Tracking

- Issue registry: `audits/issue-registry.json` — tracks all P0/P1/P2 issues by ID and status.
- Run the full audit: `npm run audit`
- Run vitals only: `npm run audit:vitals`
- Run full suite: `npm run audit:full`
- P0 gate (exits 1 if any open P0s): `node scripts/count-issues.js --severity P0 --status open`

## Branch Naming

```
fix/short-description       # bug fix
feat/short-description      # new feature
chore/short-description     # tooling, deps, docs, refactors
```

## Commit Message Style

Follow the [Conventional Commits](https://www.conventionalcommits.org/) style used throughout this repo:

```
fix: brief description of what was fixed
feat: brief description of new feature
chore: dependency update / tooling change
refactor: code restructure without behavior change
test: add or update tests
docs: documentation only
```

Examples from this repo's history:

```
fix: error management, analytics hardening + docs update
fix: resolve P1/P2 issues, handler signature bugs, add test coverage
ci: upgrade Node.js from 20 to 22 in all workflows
```

Keep the subject line under 72 characters. Add a body if context is needed.
