# Prime Self Workers — Comprehensive Codebase Audit

**Date:** 2025-01-XX  
**Scope:** All source files in `workers/src/` (~80 files)  
**Runtime:** Cloudflare Workers + Neon PostgreSQL  
**Severity Levels:** CRITICAL · HIGH · MEDIUM · LOW

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [CRITICAL: Phantom Tables & Missing Columns](#3-critical-phantom-tables--missing-columns)
4. [HIGH: Security Issues](#4-high-security-issues)
5. [HIGH: Code Quality & Logic Bugs](#5-high-code-quality--logic-bugs)
6. [MEDIUM: Inconsistencies & Dead Code](#6-medium-inconsistencies--dead-code)
7. [MEDIUM: Missing Features & Gaps](#7-medium-missing-features--gaps)
8. [LOW: Style, Performance & Minor Issues](#8-low-style-performance--minor-issues)
9. [File-by-File Summary](#9-file-by-file-summary)
10. [Remediation Roadmap](#10-remediation-roadmap)

---

## 1. Executive Summary

The Prime Self API (`workers/src/`) contains **~80 source files** implementing an edge-first Human Design + Astrology platform. The codebase is ambitious in scope, with 120+ API endpoints covering chart calculation, AI profile synthesis, billing, gamification, notifications, SMS, practitioner tools, and more.

**The single most critical finding** is that the majority of the codebase references database tables and columns that **do not exist in the live production database**. Out of ~47 tables referenced in code, only **15 exist** in production. This means **32 tables are phantom references** — any request that touches these tables will throw a runtime SQL error.

### Severity Breakdown

| Severity | Count | Summary |
|----------|-------|---------|
| CRITICAL | 7 | Phantom tables, missing columns, data loss risk |
| HIGH | 9 | Duplicate logic, signature mismatches, security gaps |
| MEDIUM | 12 | Dead code, template bugs, inconsistencies |
| LOW | 8 | Style, performance optimizations, minor issues |

---

## 2. Architecture Overview

### Stack
- **Runtime:** Cloudflare Workers (compatibility_date 2024-12-01, `nodejs_compat`)
- **Database:** Neon PostgreSQL via `@neondatabase/serverless` v1.0.2
- **Payments:** Stripe v17.4.0 (3 tiers: Seeker $15, Guide $97, Practitioner $500)
- **Auth:** JWT HS256 (24h access + 30d refresh tokens with rotation)
- **Cache:** Workers KV (`CACHE` binding) + in-memory LRU
- **Storage:** R2 (`prime-self-exports` bucket) for PDFs
- **AI:** Anthropic Claude → Grok → Groq failover chain
- **Email:** Resend API
- **SMS:** Telnyx
- **Cron:** Daily at 06:00 UTC (8 tasks)

### Live Database Tables (15 confirmed)
1. `users` — User accounts
2. `charts` — Calculated HD/astro charts (JSONB)
3. `profiles` — AI-generated profile syntheses
4. `transit_snapshots` — Daily transit position cache
5. `practitioners` — Practitioner registrations
6. `practitioner_clients` — Practitioner ↔ client relationships
7. `clusters` — Group clusters
8. `cluster_members` — Cluster membership
9. `sms_messages` — SMS log
10. `validation_data` — Behavioral validation
11. `psychometric_data` — Big Five + VIA assessments
12. `diary_entries` — Life event journal
13. `subscriptions` — Stripe subscription records
14. `payment_events` — Payment event log
15. `usage_records` — API usage tracking

---

## 3. CRITICAL: Phantom Tables & Missing Columns

### 3.1 — CRITICAL: 32 Phantom Tables Referenced in Code

The `queries.js` file (1571 lines) and handler files reference **32 tables that do not exist** in the production database. These tables are defined in numbered migration files (`003`–`015`) that have **never been applied** to the live database.

Every API endpoint that touches these tables will **crash at runtime** with a PostgreSQL error.

#### Phantom Tables and Affected Files

| # | Phantom Table | Migration | Handler(s) | Impact |
|---|--------------|-----------|------------|--------|
| 1 | `refresh_tokens` | base schema | `auth.js` | **All refresh token operations fail** — login works but refresh/rotation is broken |
| 2 | `share_events` | base schema | `share.js` | Share tracking crashes |
| 3 | `referrals` | 003_billing | `referrals.js` | Entire referral system non-functional |
| 4 | `invoices` | 003_billing | `billing.js`, `webhook.js` | Invoice recording fails (webhook still returns 200) |
| 5 | `promo_codes` | 003_billing | `billing.js` | Promo code system non-functional |
| 6 | `user_achievements` | 004_achievements | `achievements.js` | Gamification system non-functional |
| 7 | `achievement_events` | 004_achievements | `achievements.js` | Achievement tracking broken |
| 8 | `user_streaks` | 004_achievements | `achievements.js` | Streak tracking broken |
| 9 | `user_achievement_stats` | 004_achievements | `achievements.js` | Stats aggregation broken |
| 10 | `webhooks` | 008_webhooks | `webhooks.js` | User-managed webhooks broken |
| 11 | `webhook_deliveries` | 008_webhooks | `webhooks.js`, `webhookDispatcher.js` | Delivery log broken |
| 12 | `push_subscriptions` | 009_push | `push.js` | Web Push system broken |
| 13 | `push_notifications` | 009_push | `push.js` | Push notification log broken |
| 14 | `notification_preferences` | 009_push | `push.js` | Notification prefs broken |
| 15 | `transit_alerts` | 010_alerts | `alerts.js` | Transit alert system broken |
| 16 | `alert_deliveries` | 010_alerts | `alerts.js` | Alert delivery log broken |
| 17 | `alert_templates` | 010_alerts | `alerts.js` | Alert templates broken |
| 18 | `api_keys` | 011_api_keys | `keys.js`, `apiKey.js` middleware | API key system broken |
| 19 | `api_usage` | 011_api_keys | `keys.js`, `apiKey.js` middleware | API usage tracking broken |
| 20 | `oauth_states` | 012_notion | `notion.js` | Notion OAuth broken |
| 21 | `notion_connections` | 012_notion | `notion.js` | Notion sync broken |
| 22 | `notion_syncs` | 012_notion | `notion.js` | Notion sync log broken |
| 23 | `notion_pages` | 012_notion | `notion.js` | Notion page mapping broken |
| 24 | `daily_checkins` | 013_checkins | `checkin.js` | Check-in system broken |
| 25 | `checkin_reminders` | 013_checkins | `checkin.js` | Check-in reminders broken |
| 26 | `alignment_trends` | 013_checkins | `checkin.js` | Alignment trends broken |
| 27 | `analytics_events` | 014_analytics | `analytics.js`, `stats.js`, `lib/analytics.js` | All analytics broken |
| 28 | `analytics_daily` | 014_analytics | `analytics.js` | Daily aggregation broken |
| 29 | `funnel_events` | 014_analytics | `analytics.js`, `lib/analytics.js` | Funnel tracking broken |
| 30 | `experiments` | 014_analytics | `experiments.js`, `lib/experiments.js` | A/B testing broken |
| 31 | `experiment_assignments` | 014_analytics | `lib/experiments.js` | Experiment assignment broken |
| 32 | `experiment_conversions` | 014_analytics | `lib/experiments.js` | Conversion tracking broken |

> **Note:** The base `migrate.sql` does define `refresh_tokens` and `share_events` with `CREATE TABLE IF NOT EXISTS`, but they are **not in the user's confirmed 15 live tables**. Either the base migration was partially applied, or these tables were dropped. Either way, they're phantom in production.

### 3.2 — CRITICAL: Missing Columns on `users` Table

The live `users` table (per `migrate.sql` base schema) has these columns:
`id, email, phone, password_hash, birth_date, birth_time, birth_tz, birth_lat, birth_lng, sms_opted_in, created_at, updated_at`

Code references these **non-existent columns**:

| Column | Referenced By | Impact |
|--------|--------------|--------|
| `tier` | `billing.js` (`updateUserTier`), `cron.js`, `tierEnforcement.js` | User tier never persisted on users table. Billing tier changes fail. |
| `stripe_customer_id` | `billing.js` (`updateUserTierAndStripe`), `webhook.js` | Stripe customer linkage fails |
| `email_verified` | `cron.js` (email drip campaign query) | Drip campaign query crashes |
| `last_login_at` | `cron.js` (token cleanup query) | Token cleanup query crashes |
| `referral_code` | `referrals.js` (multiple queries) | Referral code generation/lookup fails |

These columns would be added by migration `003_billing.sql` which has **not been applied**.

### 3.3 — CRITICAL: Missing Columns on `charts` Table

The live `charts` table has: `id, user_id, hd_json, astro_json, calculated_at`

Code references these **non-existent columns**:

| Column | Referenced By | Impact |
|--------|--------------|--------|
| `chart_type` | `cron.js` (SMS digest query) | Cron SMS digest task crashes |
| `authority` | `cron.js` (SMS digest query) | Same crash |
| `type` | `chart-save.js` (`handleChartHistory`) | Chart history response returns `undefined` for type |

### 3.4 — CRITICAL: `schema_migrations` Table Ambiguity

The base `migrate.sql` creates `schema_migrations`, but it appears the numbered migrations (`003`–`018`) were never applied. The migration runner (`migrate.js`) uses Node.js `fs` and `crypto` modules — it **cannot run inside Cloudflare Workers**. It must be run locally or in CI with `NEON_CONNECTION_STRING`. If it has never been run, all 32 phantom tables remain phantom.

---

## 4. HIGH: Security Issues

### 4.1 — HIGH: Duplicate Stripe Webhook Processing

**Files:** `handlers/webhook.js` + `handlers/billing.js`

Both files implement Stripe webhook handlers for the **same events** (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`).

- `webhook.js` — Uses `query.transaction()` for atomic operations, writes to `payment_events` table, has the `BL-R-C4` audit comments
- `billing.js` — No transactions, writes to phantom `invoices` table, uses `markReferralAsConverted()`

**Risk:** If both are registered as webhook endpoints, every Stripe event is processed twice, causing duplicate DB writes and potential race conditions. If only one is wired, the other is dead code.

**Router check:** In `index.js`, the route `/api/billing/webhook` → `billing.js` and `/api/webhook/stripe` → `webhook.js`. Both are active routes.

### 4.2 — HIGH: `enforceFeatureAccess` Signature Mismatch

**File:** `middleware/tierEnforcement.js` exports `enforceFeatureAccess(request, env, feature)`

**File:** `handlers/webhooks.js` calls `enforceFeatureAccess(user, 'practitionerTools')` — passing `user` where `request` is expected, and missing the `env` parameter entirely.

**File:** `handlers/practitioner.js` calls `enforceFeatureAccess(request, env, 'practitionerTools')` — correct.

**Impact:** In `webhooks.js`, the function receives `user` as `request`, tries to access `request._user` which doesn't exist on a user object, causing the middleware to silently fail or crash.

### 4.3 — HIGH: Stripe Webhook Secret Shared Between Two Handlers

Both `webhook.js` and `billing.js` use `env.STRIPE_WEBHOOK_SECRET` to verify webhooks. Stripe sends each event to **one** endpoint URL. If there's a single Stripe webhook endpoint configured, one handler is dead code. If there are two endpoints configured with the same secret, events are double-processed.

### 4.4 — HIGH: No CSRF Protection on Auth Endpoints

`handlers/auth.js` processes `POST /api/auth/register`, `/api/auth/login`, `/api/auth/refresh` without any CSRF token validation. While these are API endpoints (not form submissions), the CORS middleware allows `localhost:5173` and `localhost:3000` in development — any local page could make credentialed requests.

### 4.5 — HIGH: `trackEvent` in achievements.js Silently Swallows All Errors

`handlers/achievements.js` exports `trackEvent()` which is called from **every major handler** (calculate.js, transits.js, composite.js, famous.js, timing.js, cluster.js, etc.). If the `user_achievements` table doesn't exist (it doesn't), **every call to `trackEvent` throws a SQL error** which is caught and silently ignored. This means every request to these handlers makes at least one **unnecessary failing DB round-trip**.

### 4.6 — HIGH: `cron.js` References Non-Existent Tables and Columns

The daily cron (06:00 UTC) runs 8 tasks. **At least 5 will crash** every day:

| Cron Task | Phantom Dependency | Result |
|-----------|-------------------|--------|
| Transit snapshot | `transit_snapshots` (exists) | ✅ Works |
| SMS digests | `charts.chart_type`, `charts.authority` | ❌ Crashes |
| Webhook retries | `webhook_deliveries`, `webhooks` | ❌ Crashes |
| Check-in streak refresh | `daily_checkins` | ❌ Crashes |
| Push notifications | `push_notifications`, `push_subscriptions` | ❌ Crashes |
| Alert evaluation | `transit_alerts` | ❌ Crashes |
| Email drip campaigns | `users.email_verified` | ❌ Crashes |
| Token cleanup | `refresh_tokens`, `users.last_login_at` | ❌ Crashes |

Each failure is caught independently (each cron step has try/catch), so the transit snapshot likely works, but 7 of 8 cron tasks silently fail every day.

---

## 5. HIGH: Code Quality & Logic Bugs

### 5.1 — HIGH: Pool Singleton Keyed by Connection String

**File:** `db/queries.js`

```js
const pools = {};
export function createQueryFn(connectionString) {
  if (!pools[connectionString]) {
    pools[connectionString] = new Pool({ connectionString });
  }
  // ...
}
```

The `pools` object is module-level. In Cloudflare Workers, each isolate gets its own module scope. The Pool object persists across requests **within the same isolate** but is recreated on cold start. This is acceptable for Workers, but:

- The connection string is used as the **Map key** — this means `env.NEON_CONNECTION_STRING` (a secret) is stored as an object key in plain text in memory.
- No pool cleanup or error handling for stale connections.

### 5.2 — HIGH: `billing.js` handleCheckoutCompleted Calls `markReferralAsConverted`

**File:** `handlers/billing.js`, line ~519

```js
await markReferralAsConverted(env, userId);
```

This function is imported from `referrals.js` and writes to the `referrals` table — which doesn't exist. Every successful checkout session triggers a failing DB call.

### 5.3 — MEDIUM: `parseToUTC` Logic Bug at Month Boundaries

**File:** `utils/parseToUTC.js`

The day overflow logic has a bug:
```js
if (utcDay > daysInMonth) { utcDay = 1; utcMonth++; }
if (utcDay < 1) { utcMonth--; utcDay = new Date(year, utcMonth, 0).getDate(); }
```

When decrementing month (e.g., from January), `utcMonth` becomes 0, and `new Date(year, 0, 0)` returns December 31 of the previous year — but `utcYear` is never decremented in this branch. The subsequent year overflow/underflow check only handles `utcMonth > 12` and `utcMonth < 1`, which would catch this — but the `utcDay` is already set using the wrong year context.

**Impact:** Birth times near midnight UTC on January 1st could produce incorrect Julian Day calculations.

### 5.4 — MEDIUM: `handleChartHistory` Returns Undefined `type` Field

**File:** `handlers/chart-save.js`

```js
const charts = (result?.rows || []).map(row => ({
  id: row.id,
  type: row.type,  // charts table has no 'type' column
  calculatedAt: row.calculated_at
}));
```

The `charts` table only has `id, user_id, hd_json, astro_json, calculated_at`. The `type` field will always be `undefined`.

### 5.5 — MEDIUM: `findCelebrityMatches` Recalculates All Celebrity Charts on Every Call

**File:** `lib/celebrityMatch.js`

The `findCelebrityMatches()` function iterates over every celebrity in `celebrities.json`, calling `calculateFullChart()` for each one on every request. No caching is applied. If the celebrities dataset has 100+ entries, this is a very expensive operation per request.

### 5.6 — MEDIUM: `handleSendDigest` in sms.js References Charts Columns That Don't Exist

The SMS digest flow queries for `charts.chart_type` and `charts.authority` via the cron query `QUERIES.getUsersForSMSDigest`. These columns don't exist on the `charts` table, so the digest generation will fail.

---

## 6. MEDIUM: Inconsistencies & Dead Code

### 6.1 — MEDIUM: Two Different Tier Systems

**`handlers/practitioner.js`** uses a 4-tier system: `free, standard, professional, enterprise`
**`handlers/billing.js`** and `lib/stripe.js` use a 3-tier system: `seeker, guide, practitioner`
**`subscriptions` table constraint:** `CHECK (tier IN ('free', 'seeker', 'guide', 'practitioner'))`

The practitioner module's `standard`/`professional`/`enterprise` tiers are incompatible with the billing tiers. The `practitioners` table has its own `tier` column, but the mismatch creates confusion about which tier system governs feature access.

### 6.2 — MEDIUM: Email Template Has Unprocessed `{{unsubscribe_url}}`

**File:** `lib/email.js`

The welcome email HTML contains the literal string `{{unsubscribe_url}}` which is never replaced via template interpolation. The rendered email will show the raw placeholder text or a broken link.

### 6.3 — MEDIUM: `getDiaryEntries` Called with Wrong Param Count

**File:** `handlers/profile-stream.js`, line ~161

```js
query(QUERIES.getDiaryEntries, [userId]).catch(() => ({ rows: [] })),
```

But in `handlers/diary.js`, `getDiaryEntries` is called with `[userId, limit, offset]` (3 params). If the SQL expects 3 parameters, the profile-stream call with only 1 parameter will fail. The `.catch()` suppresses the error, causing diary entries to silently not be included in profile synthesis.

**File:** `handlers/profile.js` correctly passes `[userId, 50, 0]`.

### 6.4 — MEDIUM: `stats.js` Returns Weekly Active Users from Phantom Table

**File:** `handlers/stats.js`

The `/api/stats` endpoint queries `analytics_events` for weekly active users. Since this table doesn't exist, the stats endpoint either crashes or returns 0/null values.

### 6.5 — MEDIUM: `experiments.js` Uses Raw SQL Instead of QUERIES Object

**File:** `lib/experiments.js`

Unlike every other file which uses `QUERIES.someQueryName`, the experiments library embeds raw SQL strings directly:
```js
const result = await query(
  `SELECT id, name, description, status, variants...
   FROM experiments WHERE status = 'active'...`,
  []
);
```

This breaks the codebase convention and makes SQL auditing harder. The queries also reference the phantom `experiments`, `experiment_assignments`, and `experiment_conversions` tables.

### 6.6 — MEDIUM: `onboarding.js` Uses KV But Forge Data is Inline

**File:** `handlers/onboarding.js`

The onboarding system stores progress in KV (not a database table), which is fine. However, it contains a large inline `FORGE_DATA` object that duplicates data from the knowledgebase JSON files already loaded by `engine-compat.js`. This creates a maintenance risk where forge descriptions could diverge.

### 6.7 — LOW: Dead Route Handlers

Several handlers registered in `index.js` will never work because they depend entirely on phantom tables:
- All `/api/referral/*` routes → `referrals.js`
- All `/api/achievements/*` routes → `achievements.js`
- All `/api/webhooks/*` routes → `webhooks.js`
- All `/api/push/*` routes → `push.js`
- All `/api/alerts/*` routes → `alerts.js`
- All `/api/keys/*` routes → `keys.js`
- All `/api/notion/*` routes → `notion.js`
- All `/api/checkin/*` routes → `checkin.js`
- All `/api/analytics/*` routes → `analytics.js`
- All `/api/experiments/*` routes → `experiments.js`

That's approximately **60+ dead routes** out of 120+.

---

## 7. MEDIUM: Missing Features & Gaps

### 7.1 — MEDIUM: No Password Reset Flow

The auth system has register, login, refresh, and logout — but no "forgot password" or password reset endpoint. Users who forget their password have no recovery path.

### 7.2 — MEDIUM: No Email Verification

Users can register with any email address. There's no email verification flow. The `email_verified` column is referenced in code but doesn't exist on the live `users` table.

### 7.3 — MEDIUM: No Admin Authentication

Routes like `/api/analytics/*`, `/api/experiments/*`, and `/api/stats/admin` are meant for admin use but have no admin role check. They rely on standard JWT auth with no role elevation.

### 7.4 — LOW: No Pagination on Several List Endpoints

- `handleChartHistory` returns all charts with no limit
- `handleListClients` returns all practitioner clients with no limit
- `handleCluster` list returns all clusters with no limit

### 7.5 — LOW: No Input Sanitization on Cluster Name/Challenge

`handlers/cluster.js` validates length (200/2000 chars) but doesn't sanitize against XSS. Since responses are JSON API (not HTML), this is low risk, but stored data could be exploited if rendered in a different context.

---

## 8. LOW: Style, Performance & Minor Issues

### 8.1 — LOW: Inconsistent Error Response Shapes

Some handlers return `{ error: 'message' }`, others return `{ success: false, error: 'message' }`, others return `{ ok: false, error: 'message' }`. There's no standard error envelope.

### 8.2 — LOW: Mixed `Response.json()` vs `new Response(JSON.stringify())`

Newer handlers use the ergonomic `Response.json()` while older handlers construct responses manually. Both work but style is inconsistent.

### 8.3 — LOW: `celebrities.json` Import Assert Syntax

**File:** `lib/celebrityMatch.js` and `handlers/famous.js`

```js
import celebsData from '../data/celebrities.json' assert { type: 'json' };
```

The `assert` syntax is Stage 3 and may be replaced with `with` in future ES spec. Cloudflare Workers currently supports both, but this should be modernized.

### 8.4 — LOW: `sentry.js` Never Imported in Main Router

The Sentry integration library (`lib/sentry.js`) is well-implemented but is never imported or called in `index.js` or any handler. It's completely unused dead code.

### 8.5 — LOW: `queryPerf.js` Never Used

The monitored query function (`lib/queryPerf.js`) wraps queries with timing/slow-query logging but is never imported by any handler. All handlers use `createQueryFn` directly from `db/queries.js`.

### 8.6 — LOW: R2 PDF Caching Race Condition

**File:** `handlers/pdf.js`

The PDF handler checks R2 for a cached PDF, then generates and uploads if not found — but it doesn't `await` the R2 upload:
```js
env.R2.put(r2Key, pdfBytes, {...}).catch(() => { /* non-fatal */ });
```

This is intentional (non-blocking), but if two concurrent requests for the same PDF arrive, both will generate and upload, with the last write winning. Low severity since PDF generation is deterministic.

### 8.7 — LOW: `cors.js` Hardcodes Production Domain

**File:** `middleware/cors.js`

Production origins are hardcoded: `selfprime.net`, `prime-self-ui.pages.dev`. If the domain changes, this requires a code deploy rather than an env var change.

### 8.8 — LOW: `timing.js` Hardcodes Tier Check Instead of Using Middleware

**File:** `handlers/timing.js`

```js
if (user.tier === 'free') {
  return new Response(JSON.stringify({
    error: 'Upgrade required', ...
  }), { status: 403 });
}
```

This duplicates the logic in `tierEnforcement.js` middleware. Other handlers use `enforceFeatureAccess()`.

---

## 9. File-by-File Summary

### Handlers (36 files)

| File | Purpose | Status | Key Issues |
|------|---------|--------|------------|
| `auth.js` | Register, login, refresh, logout | ⚠️ Partial | Refresh tokens → phantom `refresh_tokens` table |
| `billing.js` | Stripe checkout, portal, cancel, upgrade, webhook | ⚠️ Partial | Duplicate webhook handler; `invoices` table phantom; references missing user columns |
| `webhook.js` | Stripe webhook (consolidated) | ⚠️ Partial | References `payment_events` (exists) but duplicate of billing.js |
| `calculate.js` | Chart calculation + caching | ✅ Working | Core flow works; `trackEvent` fails silently |
| `chart-save.js` | Save chart, chart history | ⚠️ Minor | `type` field undefined in history response |
| `cluster.js` | Group clusters + LLM synthesis | ✅ Working | Core CRUD works against existing tables |
| `composite.js` | Relationship/composite charts | ✅ Working | Pure computation, no phantom deps |
| `cycles.js` | Life cycle calculation | ✅ Working | Pure computation |
| `diary.js` | Life event journal | ✅ Working | Uses `diary_entries` (exists) |
| `famous.js` | Celebrity comparison | ✅ Working | Expensive — recalculates all celeb charts per request |
| `forecast.js` | Multi-day transit forecast | ✅ Working | Pure computation |
| `geocode.js` | Location → lat/lng/timezone | ✅ Working | Good external API fallback |
| `pdf.js` | PDF export via R2 | ✅ Working | Minimal PDF builder, R2 caching works |
| `practitioner.js` | Practitioner dashboard | ✅ Working | Uses existing tables; tier mismatch with billing |
| `profile.js` | AI profile generation | ✅ Working | Core LLM flow works |
| `profile-stream.js` | SSE streaming profile gen | ⚠️ Minor | `getDiaryEntries` wrong param count (silently caught) |
| `psychometric.js` | Big Five + VIA assessments | ✅ Working | Uses `psychometric_data` (exists) |
| `rectify.js` | Birth time sensitivity analysis | ✅ Working | Pure computation |
| `sms.js` | Telnyx SMS integration | ⚠️ Partial | Inbound works; digest query references phantom columns |
| `timing.js` | Electional astrology dates | ✅ Working | Hardcoded tier check |
| `transits.js` | Current transit positions | ✅ Working | Good caching strategy |
| `validation.js` | Behavioral validation data | ✅ Working | Uses `validation_data` (exists) |
| `achievements.js` | Gamification system | ❌ Broken | All 4 phantom tables |
| `alerts.js` | Transit alerts | ❌ Broken | All 3 phantom tables |
| `analytics.js` | Admin analytics | ❌ Broken | All 3 phantom tables |
| `checkin.js` | Daily check-ins | ❌ Broken | All 3 phantom tables |
| `experiments.js` | A/B testing admin | ❌ Broken | All 3 phantom tables |
| `keys.js` | API key management | ❌ Broken | Both phantom tables |
| `notion.js` | Notion OAuth + sync | ❌ Broken | All 4 phantom tables |
| `onboarding.js` | Savannah narrative | ✅ Working | Uses KV, no phantom deps |
| `push.js` | Web Push notifications | ❌ Broken | All 3 phantom tables |
| `referrals.js` | Referral/viral system | ❌ Broken | Phantom table + missing user columns |
| `share.js` | Social sharing | ❌ Broken | Phantom `share_events` table |
| `stats.js` | Public stats | ❌ Broken | References phantom `analytics_events` |
| `webhooks.js` | User-managed webhooks | ❌ Broken | Both phantom tables + signature mismatch |

### Middleware (6 files)

| File | Purpose | Status |
|------|---------|--------|
| `auth.js` | JWT verification + `getUserFromRequest` | ✅ Working |
| `tierEnforcement.js` | Feature gating + usage quotas | ⚠️ Signature mismatch when called from `webhooks.js` |
| `rateLimit.js` | KV fixed-window rate limiter | ✅ Working |
| `cors.js` | Dynamic CORS | ✅ Working (hardcoded domains) |
| `apiKey.js` | X-API-Key authentication | ❌ Broken (phantom `api_keys` table) |
| `cache.js` | Cache-Control headers | ✅ Working |

### Libraries (17 files)

| File | Purpose | Status |
|------|---------|--------|
| `analytics.js` | Event tracking | ❌ Broken (phantom `analytics_events`) |
| `achievements.js` | Achievement definitions | ❌ Broken (phantom tables) |
| `cache.js` | KV + LRU caching | ✅ Working |
| `celebrityMatch.js` | Celebrity similarity scoring | ✅ Working (expensive) |
| `email.js` | Resend email integration | ⚠️ `{{unsubscribe_url}}` bug |
| `errorMessages.js` | Error translation layer | ✅ Working (never used) |
| `experiments.js` | A/B testing framework | ❌ Broken (phantom tables) |
| `i18n.js` | Internationalization | ✅ Working |
| `jwt.js` | HS256 JWT sign/verify | ✅ Working |
| `llm.js` | Anthropic→Grok→Groq failover | ✅ Working |
| `notion.js` | Notion API client | ✅ Working (but handler is broken) |
| `queryPerf.js` | Slow query monitoring | ✅ Working (never used) |
| `sentry.js` | Error tracking | ✅ Working (never used) |
| `shareImage.js` | SVG social share images | ✅ Working |
| `stripe.js` | Stripe client + tier config | ✅ Working |
| `tokenCrypto.js` | AES-GCM encryption | ✅ Working |
| `webhookDispatcher.js` | HMAC webhook delivery | ❌ Broken (phantom tables) |

### Other

| File | Purpose | Status |
|------|---------|--------|
| `utils/parseToUTC.js` | Timezone conversion | ⚠️ Edge case bug at January 1 boundary |
| `db/queries.js` | Query definitions + pool | ⚠️ References 32 phantom tables |
| `db/migrate.js` | Migration runner | ✅ Working (Node.js only, not Workers) |
| `db/migrate.sql` | Base schema (18 tables) | ✅ Applied (mostly) |
| `engine-compat.js` | Knowledgebase injection | ✅ Working |
| `cron.js` | 8 daily tasks | ⚠️ 7 of 8 tasks crash silently |
| `index.js` | Main router (120+ routes) | ⚠️ ~60 routes lead to broken handlers |

---

## 10. Remediation Roadmap

### Phase 1: Database Schema (CRITICAL — Do First)

**Estimated effort:** 1–2 hours

1. **Run the migration runner** against production Neon:
   ```bash
   cd workers
   NEON_CONNECTION_STRING="your_connection_string" node src/db/migrate.js
   ```
   This applies `migrate.sql` (base schema) + all numbered migrations (`003`–`018`), creating the 32 missing tables and adding missing columns to `users` and `charts`.

2. **Verify** with:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
   ```

3. **Add missing columns** if migrations don't cover them:
   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free';
   ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
   ```

### Phase 2: Critical Bug Fixes (HIGH — Week 1)

1. **Resolve duplicate Stripe webhook handlers** — Choose one (`webhook.js` is better: uses transactions, proper `payment_events` table). Remove or disable the billing.js webhook handler. Update `index.js` routing.

2. **Fix `enforceFeatureAccess` call in `webhooks.js`** — Change from `enforceFeatureAccess(user, 'practitionerTools')` to `enforceFeatureAccess(request, env, 'practitionerTools')`.

3. **Fix `getDiaryEntries` param count** in `profile-stream.js` — Change from `[userId]` to `[userId, 50, 0]`.

4. **Fix `charts.chart_type` references** in cron SMS digest query — Either add the column or extract from `hd_json` JSONB: `hd_json->>'type'`.

5. **Fix email `{{unsubscribe_url}}` template** — Replace with actual unsubscribe link or remove placeholder.

### Phase 3: Dead Code Cleanup (MEDIUM — Week 2)

1. **Wire up `sentry.js`** in the main error handler in `index.js`, or remove it.
2. **Wire up `queryPerf.js`** in hot-path handlers, or remove it.
3. **Wire up `errorMessages.js`** in handlers, or remove it.
4. **Resolve practitioner vs billing tier mismatch** — Standardize on one tier system.
5. **Add caching to `celebrityMatch.js`** — Pre-compute or cache celebrity charts on deploy.

### Phase 4: Feature Completion (LOW — Ongoing)

1. Add password reset flow
2. Add email verification flow
3. Add admin role enforcement
4. Add pagination to unbounded list endpoints
5. Standardize error response envelope
6. Move CORS origins to environment variables
7. Modernize JSON import syntax (`with` instead of `assert`)

---

## Appendix: Query-to-Table Cross Reference

Phantom table queries in `db/queries.js` (line numbers approximate):

| Query Name | Table(s) | Line |
|------------|----------|------|
| `insertRefreshToken` | `refresh_tokens` | ~162 |
| `getRefreshToken` | `refresh_tokens` | ~169 |
| `revokeRefreshToken` | `refresh_tokens` | ~176 |
| `revokeTokenFamily` | `refresh_tokens` | ~183 |
| `deleteExpiredTokens` | `refresh_tokens` | ~189 |
| `createReferral` | `referrals` | ~400+ |
| `getReferralByCode` | `referrals` | ~410+ |
| `getUserReferrals` | `referrals` | ~420+ |
| `markReferralConverted` | `referrals` | ~430+ |
| `insertInvoicePaid` | `invoices` | ~500+ |
| `insertInvoiceFailed` | `invoices` | ~510+ |
| `getUserAchievements` | `user_achievements` | ~600+ |
| `insertAchievementEvent` | `achievement_events` | ~620+ |
| `updateUserStreak` | `user_streaks` | ~640+ |
| `insertAnalyticsEvent` | `analytics_events` | ~800+ |
| `insertFunnelEvent` | `funnel_events` | ~820+ |
| `getWeeklyActiveUsers` | `analytics_events` | ~900+ |
| `createWebhook` | `webhooks` | ~1000+ |
| `getPushSubscriptions` | `push_subscriptions` | ~1100+ |
| `getTransitAlerts` | `transit_alerts` | ~1200+ |
| `createApiKey` | `api_keys` | ~1300+ |
| `createOAuthState` | `oauth_states` | ~1400+ |
| `createDailyCheckin` | `daily_checkins` | ~1500+ |
| `insertShareEvent` | `share_events` | ~1550+ |

---

*End of audit report. All findings are based on static code analysis of the `workers/src/` directory. Runtime verification is recommended after applying migrations.*
