# Prime Self — Production Runbook & Engineering Guide

**Last Updated:** March 21, 2026
**Owner:** Engineering (on-call)
**Status:** Canonical — all on-call and deployment decisions reference this document

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Service Map & URLs](#2-service-map--urls)
3. [Deployment Procedures](#3-deployment-procedures)
4. [Rollback Procedures](#4-rollback-procedures)
5. [Monitoring & Alerting](#5-monitoring--alerting)
6. [Incident Response](#6-incident-response)
7. [Cron Jobs & Scheduled Tasks](#7-cron-jobs--scheduled-tasks)
8. [Database Operations](#8-database-operations)
9. [Secrets Management](#9-secrets-management)
10. [Known Failure Modes & Runbooks](#10-known-failure-modes--runbooks)
11. [Escalation Paths](#11-escalation-paths)
12. [CI/CD Pipeline (Target)](#12-cicd-pipeline-target)
13. [SLO Targets](#13-slo-targets)
14. [Capacity Planning](#14-capacity-planning)

---

## 1. System Overview

```
                    ┌──────────────────────────────────────┐
                    │         selfprime.net (Pages)         │
                    │    Cloudflare Pages — auto-deploy     │
                    └──────────────┬───────────────────────┘
                                   │ HTTPS
┌──────────────────────────────────▼───────────────────────────────────┐
│               prime-self-api.adrper79.workers.dev                    │
│                    Cloudflare Workers (V8 isolates)                   │
│                                                                      │
│   Middleware: CORS → Security → JWT → Rate Limit → Tier Enforce     │
│   Handlers:  53 domain-specific handler files                        │
│   Engine:    8-layer calculation (Julian → Synthesis)                 │
│   Cron:      Daily 06:00 UTC (transit snapshot + SMS digest)         │
│   DO:        LiveSession (WebSocket fan-out)                         │
└──────┬──────────┬────────────┬──────────────┬───────────────────────┘
       │          │            │              │
  ┌────▼───┐ ┌───▼────┐ ┌────▼─────┐  ┌─────▼─────┐
  │ NeonDB │ │ CF KV  │ │  CF R2   │  │ External  │
  │ Postgres│ │2 namespaces│ │ Exports │  │ Stripe    │
  │ 48 tbl │ │CACHE     │ │ KB files │  │ Anthropic │
  │ 66 mig │ │RATE_LIMIT│ │          │  │ Telnyx    │
  └────────┘ └────────┘ └──────────┘  │ Resend    │
                                        │ Sentry    │
                                        └───────────┘
```

**Key architectural decisions:**
- All computation runs at edge (CF Workers) — zero cold starts
- Calculation engine is pure JS (Jean Meeus algorithms) — no external deps
- 3-model LLM failover: Claude → Grok → Llama (per reasoning tier)
- JWT tokens: 15min access (in-memory) + 30d refresh (HttpOnly cookie)
- Secrets encrypted at rest via `wrangler secret put`

---

## 2. Service Map & URLs

| Service | URL | Health Check |
|---------|-----|-------------|
| **Frontend** | https://selfprime.net | Load in browser — verify no CSP errors |
| **API** | https://prime-self-api.adrper79.workers.dev | `GET /api/health` → `{"status":"ok"}` |
| **Staging API** | prime-self-api-staging.adrper79.workers.dev | Same health endpoint |
| **Database** | Neon Dashboard (pooled connector) | `SELECT 1` via psql |
| **Stripe Dashboard** | https://dashboard.stripe.com | Webhook events tab |
| **Sentry** | https://sentry.io (project: prime-self) | Issues dashboard |
| **Cloudflare Dashboard** | https://dash.cloudflare.com | Workers Analytics |
| **Plausible Analytics** | https://plausible.io/selfprime.net | Traffic dashboard |

### Critical Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/health` | GET | No | System health + cache stats |
| `/api/auth/register` | POST | No | User registration |
| `/api/auth/login` | POST | No | Login (returns JWT) |
| `/api/auth/me` | GET | JWT | Current user profile |
| `/api/chart/calculate` | POST | JWT | Generate chart (core product) |
| `/api/profile/generate` | POST | JWT | AI synthesis (LLM call) |
| `/api/webhook/stripe` | POST | Stripe sig | Payment events |
| `/api/admin/stats` | GET | Admin token | Internal analytics |

---

## 3. Deployment Procedures

### 3.1 Backend (Workers)

```bash
# 1. Run tests locally
npm run test:deterministic

# 2. Deploy to staging
cd workers && npx wrangler deploy --env staging

# 3. Verify staging
PROD_API=https://prime-self-api-staging.adrper79.workers.dev node verify-production.js

# 4. Deploy to production
npx wrangler deploy

# 5. Verify production
node verify-production.js

# 6. Run production gate (includes money-path canary)
cd .. && npm run verify:prod:gate
```

**Automated pipeline (single command):**
```bash
npm run deploy
# Runs: deploy:secrets → deploy:workers → verify:prod
```

### 3.2 Frontend (Pages)

Frontend auto-deploys on push to `main`:

```bash
git add frontend/
git commit -m "Deploy: [description]"
git push origin main
# Cloudflare Pages builds + deploys (~2-3 min)
```

**Verify:** Open https://selfprime.net in incognito → check DevTools console for CSP/JS errors.

### 3.3 Database Migrations

```bash
# Preview migration (dry-run)
cd workers && node src/db/migrate.js --dry-run

# Apply migration
node src/db/migrate.js

# Verify schema
psql $NEON_CONNECTION_STRING -c "\dt"
```

**Rule:** Always deploy migration BEFORE the code that depends on it. Never the reverse.

### 3.4 Pre-Deployment Checklist

- [ ] `npm run test:deterministic` — all pass, 0 failures
- [ ] `node scripts/next-issue.js --summary` — 0 P0 issues
- [ ] Database migration applied (if schema changes)
- [ ] Secrets configured (if new secrets added)
- [ ] BACKLOG.md updated with deployment note

---

## 4. Rollback Procedures

### 4.1 Worker Rollback (Code)

```bash
# Option A: Git revert + redeploy
git revert HEAD
git push origin main
cd workers && npx wrangler deploy

# Option B: Redeploy previous commit
git checkout HEAD~1 -- workers/
cd workers && npx wrangler deploy
git checkout main -- workers/   # restore working tree
```

**Time to recovery:** ~2 minutes (wrangler deploy is instant, propagation <30s).

### 4.2 Frontend Rollback

```bash
git revert HEAD
git push origin main
# Pages auto-rebuilds (~2-3 min)
```

### 4.3 Database Rollback

**There is no automated rollback.** Write inverse SQL manually:

```bash
# Example: remove a column added in error
psql $NEON_CONNECTION_STRING -c "ALTER TABLE users DROP COLUMN IF EXISTS new_column;"
```

**Prevention:** Use Neon branching for testing migrations before production:
```bash
# Create branch
neonctl branches create --name migration-test

# Test migration on branch
psql $BRANCH_CONNECTION_STRING < workers/src/db/migrations/067_new_feature.sql

# If OK, apply to main
psql $NEON_CONNECTION_STRING < workers/src/db/migrations/067_new_feature.sql

# Clean up
neonctl branches delete migration-test
```

### 4.4 Secrets Rollback

```bash
# Re-set the old secret value
echo "old-value" | npx wrangler secret put SECRET_NAME

# Redeploy to pick up the change
cd workers && npx wrangler deploy
```

---

## 5. Monitoring & Alerting

### 5.1 Real-Time Monitoring

```bash
# Live worker logs (keep open in separate terminal)
cd workers && npx wrangler tail --format pretty

# Filter for errors only
npx wrangler tail --format pretty | grep -i error
```

### 5.2 Dashboards

| Dashboard | What to Watch | URL |
|-----------|-------------|-----|
| **CF Workers Analytics** | Request count, error rate, latency p50/p99 | dash.cloudflare.com → Workers |
| **Sentry** | Unresolved exceptions, error frequency | sentry.io → Issues |
| **Plausible** | Traffic, page views, bounce rate | plausible.io/selfprime.net |
| **Stripe** | Payment failures, disputes, MRR | dashboard.stripe.com |
| **Neon** | Connection count, query latency, storage | console.neon.tech |

### 5.3 Alerting Rules (Configure in Sentry)

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Error spike | >10 errors in 5 min | P1 | Investigate immediately |
| Cron failure | `cron_fatal_error` event | P1 | Check transit snapshot + SMS |
| Stripe webhook failure | >3 failed webhook deliveries | P1 | Check webhook secret, verify endpoint |
| Auth error spike | >20 `401` responses in 5 min | P2 | Check JWT secret, token rotation |
| Slow queries | >5 queries >1000ms in 10 min | P2 | Check Neon connection pool, query plans |

### 5.4 Health Check Script

```bash
# Quick production verification (run anytime)
node workers/verify-production.js

# Full production gate (tests, canary, browser smoke)
npm run verify:prod:gate

# Vitals check (tests + CF metrics + known issues)
npm run audit:vitals
```

---

## 6. Incident Response

### 6.1 Severity Levels

| Level | Definition | Response Time | Example |
|-------|-----------|---------------|---------|
| **P0** | Service down, data loss, security breach | Immediate (<15 min) | API returns 500 on all requests, DB unreachable |
| **P1** | Major feature broken, payment processing failed | <1 hour | Chart calculation wrong, Stripe webhooks failing |
| **P2** | Minor feature degraded, non-blocking | <4 hours | SMS digests not sending, single endpoint 404 |
| **P3** | Cosmetic, non-user-facing | Next business day | Log noise, stale cache, docs outdated |

### 6.2 Incident Template

```markdown
## Incident: [TITLE]
**Severity:** P0/P1/P2/P3
**Detected:** [timestamp]
**Resolved:** [timestamp]
**Duration:** [minutes]
**Impact:** [who was affected, how many users]

### Timeline
- HH:MM — [what happened]
- HH:MM — [what action was taken]
- HH:MM — [resolution]

### Root Cause
[What broke and why]

### Resolution
[What fixed it]

### Prevention
[What changes prevent recurrence]
```

### 6.3 Incident Response Flowchart

```
Alert fires
    │
    ├─ Is the site down? (GET /api/health fails)
    │   ├─ YES → Check wrangler tail for errors
    │   │         ├─ Deploy error → Rollback (Section 4.1)
    │   │         ├─ Secret missing → Re-deploy secret (Section 9)
    │   │         └─ CF outage → Check https://www.cloudflarestatus.com
    │   └─ NO → Continue
    │
    ├─ Is payment broken? (Stripe webhooks failing)
    │   ├─ YES → Check STRIPE_WEBHOOK_SECRET → Re-set if rotated
    │   │         Test: stripe listen --forward-to $API/api/webhook/stripe
    │   └─ NO → Continue
    │
    ├─ Is auth broken? (Login returns 401/500)
    │   ├─ YES → Check JWT_SECRET → Re-set if changed
    │   │         Check Neon connectivity → psql $NEON_CONNECTION_STRING
    │   └─ NO → Continue
    │
    ├─ Is calculation wrong? (Chart data incorrect)
    │   ├─ YES → Run npm run test:deterministic locally
    │   │         Compare AP Test Vector output → identify regression
    │   └─ NO → Continue
    │
    └─ Is it an LLM failure? (Profile generation fails)
        ├─ YES → Check Anthropic status page
        │         Failover should auto-route to Grok → Llama
        │         If all 3 providers down → LLM circuit breaker trips
        └─ NO → Investigate via Sentry + wrangler tail
```

---

## 7. Cron Jobs & Scheduled Tasks

### Daily Transit Cron (06:00 UTC)

**Trigger:** `[triggers] crons = ["0 6 * * *"]` in wrangler.toml

**What it does:**
1. Calculates current transit positions (all 11 planets)
2. Saves transit snapshot to `transit_snapshots` table
3. Fetches SMS-subscribed users with birth data
4. Generates personalized transit digest for each user
5. Sends SMS via Telnyx (200ms throttle between sends)

**Monitoring:**
- Success: Sentry breadcrumb `cron_complete`
- Failure: Sentry event `cron_fatal_error` or `cron_step_timeout`

**Manual trigger (for testing):**
```bash
curl -X POST https://prime-self-api.adrper79.workers.dev/__scheduled \
  -H "Content-Type: application/json"
```

**If cron fails:**
1. Check `wrangler tail` for cron errors
2. Verify `TELNYX_API_KEY` + `TELNYX_PHONE_NUMBER` secrets are set
3. Check Neon connectivity (transit snapshot write may have failed)
4. Re-run manually if needed

---

## 8. Database Operations

### 8.1 Connection

```bash
# Direct connection (for migrations, debugging)
psql $NEON_CONNECTION_STRING

# Quick health check
psql $NEON_CONNECTION_STRING -c "SELECT COUNT(*) FROM users;"
```

### 8.2 Common Queries

```sql
-- Active user count
SELECT COUNT(*) FROM users WHERE email_verified = true;

-- Subscription breakdown by tier
SELECT tier, status, COUNT(*) FROM subscriptions GROUP BY tier, status;

-- Recent chart calculations (last 24h)
SELECT COUNT(*) FROM charts WHERE created_at > NOW() - INTERVAL '24 hours';

-- Failed payment events (last 7d)
SELECT * FROM payment_events
WHERE created_at > NOW() - INTERVAL '7 days'
AND status != 'succeeded'
ORDER BY created_at DESC;

-- Slow query log equivalent (check application logs)
-- Application logs queries >1000ms to Sentry/structured logs
```

### 8.3 Migration Workflow

```bash
# 1. Create migration file
touch workers/src/db/migrations/067_description.sql

# 2. Write SQL (always include IF NOT EXISTS / IF EXISTS guards)
cat > workers/src/db/migrations/067_description.sql << 'EOF'
-- Migration 067: Add feature_x column
ALTER TABLE users ADD COLUMN IF NOT EXISTS feature_x TEXT;
CREATE INDEX IF NOT EXISTS idx_users_feature_x ON users(feature_x);
EOF

# 3. Test on Neon branch
neonctl branches create --name test-067
psql $BRANCH_URL < workers/src/db/migrations/067_description.sql

# 4. Apply to production
cd workers && node src/db/migrate.js

# 5. Verify
psql $NEON_CONNECTION_STRING -c "\d users" | grep feature_x
```

### 8.4 Backup & Recovery

- **Neon auto-backups:** Point-in-time recovery up to 7 days (free tier) or 30 days (pro)
- **Branching:** Create a branch before destructive operations: `neonctl branches create --name pre-migration-backup`
- **Manual export:** `pg_dump $NEON_CONNECTION_STRING > backup_$(date +%Y%m%d).sql`

---

## 9. Secrets Management

### 9.1 List Current Secrets

```bash
cd workers && npx wrangler secret list
```

### 9.2 Add/Update a Secret

```bash
# Interactive (prompts for value)
npx wrangler secret put SECRET_NAME

# From pipe (CI/CD)
echo "secret-value" | npx wrangler secret put SECRET_NAME
```

### 9.3 Bulk Deploy (from .env.local)

```bash
# Dry run (shows what would deploy)
npm run deploy:secrets:dry

# Deploy with confirmation prompt
npm run deploy:secrets

# Deploy without confirmation (CI)
npm run deploy:secrets:force
```

### 9.4 Required Secrets Inventory

| Secret | Service | Required For | Impact If Missing |
|--------|---------|-------------|-------------------|
| `NEON_CONNECTION_STRING` | NeonDB | All DB operations | Full outage |
| `JWT_SECRET` | Auth | Token signing/verification | Auth completely broken |
| `ANTHROPIC_API_KEY` | Anthropic | AI synthesis | Profile generation fails (falls to Grok) |
| `GROK_API_KEY` | xAI | LLM failover | Failover to Llama |
| `GROQ_API_KEY` | Groq | LLM failover | No failover (synthesis fails) |
| `STRIPE_SECRET_KEY` | Stripe | Billing operations | Payments broken |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Webhook verification | Subscriptions won't update |
| `RESEND_API_KEY` | Resend | Transactional email | Email verification, invites broken |
| `TELNYX_API_KEY` | Telnyx | SMS delivery | Transit digests won't send |
| `TELNYX_PHONE_NUMBER` | Telnyx | SMS sender ID | SMS delivery fails |
| `SENTRY_DSN` | Sentry | Error tracking | Silent failures (no alerts) |
| `AI_GATEWAY_URL` | CF AI Gateway | LLM routing | LLM calls fail |
| `ADMIN_TOKEN` | Internal | Admin API access | Admin dashboard inaccessible |
| `GOOGLE_CLIENT_ID` | Google OAuth | Google Sign-In | Google login unavailable |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Google Sign-In | Google login unavailable |
| `APPLE_CLIENT_ID` | Apple OAuth | Apple Sign-In | Apple login unavailable |
| `APPLE_TEAM_ID` | Apple OAuth | Apple Sign-In | Apple login unavailable |
| `APPLE_KEY_ID` | Apple OAuth | Apple Sign-In | Apple login unavailable |
| `APPLE_PRIVATE_KEY` | Apple OAuth | Apple Sign-In | Apple login unavailable |

### 9.5 Secret Rotation

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# 2. Update in Cloudflare
echo "$NEW_SECRET" | npx wrangler secret put JWT_SECRET

# 3. Deploy to pick up change
npx wrangler deploy

# 4. Verify
node verify-production.js
```

**JWT_SECRET rotation:** Will invalidate all active access tokens (15min window). Refresh tokens survive because they are re-signed on use.

---

## 10. Known Failure Modes & Runbooks

### FM-001: Neon Connection Pool Exhaustion

**Symptoms:** 500 errors on all DB operations, `connection_limit_exceeded` in logs
**Cause:** Too many concurrent connections (Neon free tier: 5 connections)
**Fix:**
```bash
# Check connections
psql $NEON_CONNECTION_STRING -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
psql $NEON_CONNECTION_STRING -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND pid <> pg_backend_pid();"
```
**Prevention:** Use pooled connection string (already configured)

### FM-002: KV Cache Corruption

**Symptoms:** Stale chart data, incorrect transit positions
**Fix:**
```bash
# Clear specific cache key
npx wrangler kv key delete --binding CACHE "chart:1979-08-05:22:51:27.9506:-82.4572"

# Clear all cache (nuclear option — will cause recalculation load)
# Don't do this unless absolutely necessary
```

### FM-003: LLM Provider Outage

**Symptoms:** Profile generation returns 500, `llm_provider_error` in Sentry
**Behavior:** Auto-failover: Claude → Grok → Llama
**If all 3 down:**
- Circuit breaker trips after 5 consecutive failures
- Users see: "AI synthesis is temporarily unavailable. Your chart data is unaffected."
- Recovery: Automatic when any provider comes back online

### FM-004: Stripe Webhook Signature Mismatch

**Symptoms:** `webhook_signature_invalid` errors, subscriptions not updating
**Cause:** Webhook secret rotated in Stripe but not in Workers
**Fix:**
```bash
# Get new secret from Stripe Dashboard → Developers → Webhooks → Signing secret
echo "whsec_NEW_VALUE" | npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler deploy
```

### FM-005: Cron Job Timeout

**Symptoms:** Transit digests not sent, `cron_step_timeout` in Sentry
**Cause:** Too many SMS subscribers, SMS API slow
**Fix:** Check Telnyx status page. If Telnyx is down, digests are lost for that day (no retry queue). Users will get tomorrow's digest.

### FM-006: Frontend CSP Violation

**Symptoms:** Console errors `Content-Security-Policy blocked`, features broken
**Cause:** New CDN URL not added to CSP whitelist
**Fix:** Update CSP meta tag in `frontend/index.html`, push to main

---

## 11. Escalation Paths

| Service | Provider | Support Contact | SLA |
|---------|----------|----------------|-----|
| **Cloudflare Workers** | Cloudflare | support@cloudflare.com / Dashboard ticket | Pro: 8hr response |
| **Neon PostgreSQL** | Neon | support@neon.tech / Discord | 24hr response |
| **Stripe** | Stripe | support@stripe.com / Dashboard chat | 24hr response |
| **Anthropic (Claude)** | Anthropic | console.anthropic.com ticket | Best effort |
| **Telnyx (SMS)** | Telnyx | support@telnyx.com | 24hr response |
| **Resend (Email)** | Resend | support@resend.com | 48hr response |
| **Sentry** | Sentry | support@sentry.io | Plan-dependent |

---

## 12. CI/CD Pipeline (Live)

### Pipeline Architecture

4 GitHub Actions workflows are live and operational:

```
  Push/PR to main
       │
       ├─ workers/**, tests/** changed?
       │   └─ deploy-workers.yml
       │       ├─ npm run test:deterministic (+ coverage thresholds)
       │       ├─ P0 issue gate (blocks if any open P0 in issue-registry.json)
       │       ├─ wrangler deploy (production)
       │       ├─ Playwright browser smoke (--strict-browser)
       │       └─ Upload artifacts
       │
       ├─ frontend/**, src/** changed?
       │   └─ deploy-frontend.yml
       │       ├─ npm run test:deterministic
       │       ├─ P0 issue gate
       │       ├─ Cloudflare Pages deploy (wrangler-action@v3)
       │       ├─ Playwright browser smoke
       │       └─ Upload artifacts
       │
  Scheduled (every 4h)
       └─ prod-canary.yml
           ├─ Full verify:prod:gate --strict-browser
           └─ Upload artifacts (14-day retention)

  Scheduled (weekly Mon 7am UTC)
       └─ audit-cron.yml
           ├─ AI-powered full audit
           ├─ P0 gate check
           ├─ Commits results to dated branch (audits/YYYY-MM-DD)
           └─ Upload artifacts (90-day retention)
```

### Key CI/CD Features

| Feature | Status |
|---------|--------|
| Automated tests on push | ✅ Vitest deterministic (1,028 tests) |
| Coverage thresholds | ✅ Lines 60%, Functions 60%, Branches 50% |
| P0 issue deploy gate | ✅ Blocks deploy if any P0 open |
| Post-deploy browser smoke | ✅ Playwright against live production |
| Concurrency groups | ✅ Prevents overlapping deploys |
| Canary monitoring | ✅ Every 4 hours |
| Automated audit | ✅ Weekly + manual dispatch |

### Remaining CI/CD Gaps

| Gap | Impact | Effort |
|-----|--------|--------|
| No staging deploy pipeline | Integration issues hit production directly | 2-4 hrs |
| No PR preview deployments | Frontend changes require merge to see live | 1 hr |
| No dependency vulnerability scanning | CVEs in transitive deps go undetected | 30 min |
| No lint/format enforcement | Code style drift across contributors | 1-2 hrs |
| No auto-rollback on post-deploy gate failure | Broken deploy stays live until manual revert | 2 hrs |
| `docs:api:check` not wired to CI | API doc drift undetected | 15 min |

### GitHub Secrets Required

| Secret | Used By |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | deploy-workers.yml, deploy-frontend.yml |
| `CLOUDFLARE_ACCOUNT_ID` | deploy-frontend.yml (Pages) |
| `E2E_TEST_EMAIL` | Post-deploy smoke tests |
| `E2E_TEST_PASSWORD` | Post-deploy smoke tests |
| `AUDIT_SECRET` | audit-cron.yml (admin endpoint access) |

---

## 13. SLO Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **API Availability** | 99.9% (43min downtime/month) | CF Workers Analytics |
| **API Latency (p50)** | <100ms | CF Workers Analytics |
| **API Latency (p99)** | <2000ms | CF Workers Analytics |
| **Chart Calculation** | <500ms | Application logs |
| **AI Synthesis** | <30s | Application logs |
| **Error Rate** | <0.1% of requests | Sentry + CF Analytics |
| **Cron Success** | 100% daily | Sentry cron monitoring |
| **Test Pass Rate** | >99% | Vitest output |
| **Deploy Success** | >95% | Deploy logs |

---

## 14. Capacity Planning

### Current Limits

| Resource | Limit | Current Usage | Headroom |
|----------|-------|--------------|----------|
| **CF Workers CPU** | 50ms/req (paid) | ~5-15ms/req | 3-10x |
| **CF Workers Requests** | 10M/month (paid) | <100K/month | 100x |
| **KV Reads** | 100K/day (free) | <5K/day | 20x |
| **KV Writes** | 1K/day (free) | <200/day | 5x |
| **R2 Storage** | 10GB (free) | <1GB | 10x |
| **Neon Compute** | 300hr/month | <50hr/month | 6x |
| **Neon Storage** | 3GB (free) | <500MB | 6x |

### Scaling Triggers

| Trigger | Action |
|---------|--------|
| KV writes >800/day | Upgrade to KV paid ($5/month) |
| Neon compute >200hr | Upgrade to Pro ($19/month) |
| R2 storage >8GB | Monitor PDF export volume |
| LLM costs >$500/month | Review cache hit rates, consider longer TTLs |
| Error rate >1% | Investigate, add circuit breakers |

---

*This runbook is a living document. Update it when procedures change, failures teach us something new, or systems are added/removed.*
