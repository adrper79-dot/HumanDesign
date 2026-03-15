# Production Checkout Report — Prime Self

> Historical checkout audit snapshot. Hardcoded test counts, placeholder IDs, and environment findings below reflect the repo state at the time of the audit and are not the current canonical baseline.
> Use `DOCUMENTATION_INDEX.md` for current navigation and the latest audits for active readiness work.

**Date**: Generated during audit session  
**Auditor**: Automated Pre-Production Checkout (Claude Opus 4.6)  
**Test Suite**: 263/263 passing (vitest 3.2.4) — 4 test files, 7.03s  
**Codebase Size**: ~491 KB frontend bundle (index.html 256 KB, CSS 82 KB, JS 65 KB)

---

## 1. SHOW STOPPERS (Must Fix Before Deploy)

### SS-1: Stripe Price IDs Are Placeholders
- **File**: `workers/wrangler.toml` lines 10–12
- **Finding**: All three Stripe price environment variables are set to `"price_placeholder_regular"`, `"price_placeholder_practitioner"`, `"price_placeholder_white_label"`
- **Impact**: ANY checkout attempt will fail — Stripe will reject invalid price IDs
- **Fix**: Replace with real Stripe price IDs from the Stripe Dashboard before deploy
- **Severity**: BLOCKING — no revenue possible

### SS-2: Missing Environment Secrets (13+ Not in wrangler.toml)
- **Files**: Various handlers reference env vars not listed in wrangler.toml secrets
- **Missing from secrets list**:
  - `GROK_API_KEY` — LLM failover provider 2 (callGrok will throw)
  - `GROQ_API_KEY` — LLM failover provider 3 (callGroq will throw)
  - `RESEND_API_KEY` — Email delivery
  - `BASE_URL`, `FROM_EMAIL`, `FRONTEND_URL` — Email links
  - `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_TOKEN_ENCRYPTION_KEY` — Notion integration
  - `TELNYX_CONNECTION_ID`, `TELNYX_PUBLIC_KEY` — SMS (partial — TELNYX_API_KEY and TELNYX_PHONE_NUMBER ARE listed)
  - `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` — Push notifications
- **Impact**: All three LLM failover providers need keys set. Email, Notion, and Push features will fail silently
- **Fix**: Add all missing secrets via `wrangler secret put <NAME>` for each
- **Severity**: BLOCKING for LLM failover, email, Notion, and push notification features

### SS-3: Env Var Naming Inconsistency — `NEON_CONNECT_STRING` vs `NEON_CONNECTION_STRING`
- **File**: `workers/src/db/migrate.js` line 128 references `NEON_CONNECT_STRING`
- **Everywhere else**: `NEON_CONNECTION_STRING` (correct)
- **Impact**: Migration runner silently fails to connect if run standalone
- **Fix**: Change `NEON_CONNECT_STRING` to `NEON_CONNECTION_STRING` in migrate.js (one-line fix)
- **Severity**: BLOCKING for any migration execution

---

## 2. TRUST DEFECTS (User-Visible Wrong Behavior)

### TD-1: IP-Unsafe Terminology in Frontend Code
- **Files & Lines**:
  - `frontend/index.html` lines 2062, 3507 — "incarnation cross" in user-visible code paths
  - `frontend/js/hd-data.js` line 95 — "Incarnation Crosses" section header
  - `frontend/js/share-card.js` line 174 — `dataRow('Incarnation Cross', crossName)`
  - `frontend/js/explanations.js` lines 17, 21, 25 — "Manifesting Generator", "Projector", "Manifestor" as object keys
- **Impact**: Human Design IP terms visible to users in share cards, explanations, and chart output — contradicts the synthesis prompt's FORBIDDEN TERMS list
- **Note**: The LLM synthesis prompt (synthesis.js) has a comprehensive forbidden terms list and approved alternatives, but the frontend hardcoded renderer bypasses this by using raw HD terms directly
- **Fix**: Replace with approved Prime Self alternatives (e.g., "Life Purpose Vector" for Incarnation Cross, "Builder-Initiator Pattern" for Manifesting Generator)

### TD-2: "Coming Soon" Stub in Production UI
- **File**: `frontend/index.html` line 3222
- **Finding**: Cluster synthesis section displays "Coming soon!" text
- **Impact**: User clicks feature and sees placeholder — trust-damaging
- **Fix**: Either implement or hide the UI element for this feature

### TD-3: heresies_canonical.json Not Loaded in Engine Compat
- **File**: `workers/src/engine-compat.js`
- **Finding**: `src/knowledgebase/prime_self/heresies_canonical.json` is not imported — this is the ONLY canonical prime_self file missing
- **Impact**: Shadow powers / heresies knowledgebase data unavailable to AI synthesis at runtime. The RAG builder references `prime_self/knowledges.json` (which IS loaded) but cannot pull from the heresies KB file itself
- **Fix**: Add import line to engine-compat.js:
  ```js
  import heresies_canonical from '../src/knowledgebase/prime_self/heresies_canonical.json';
  ```
  And add to the KB injection block

### TD-4: savannah_narrative.json Not Loaded
- **File**: `workers/src/engine-compat.js`
- **Finding**: `src/knowledgebase/prime_self/savannah_narrative.json` not imported. `workers/src/handlers/onboarding.js` line 23 references it as a KB source
- **Impact**: Onboarding narrative data unavailable at runtime
- **Fix**: Add import + injection in engine-compat.js

---

## 3. FUNCTIONAL GAPS (Feature Incomplete / Broken Path)

### FG-1: Stripe Checkout Pipeline Untestable Without Real Keys
- **Finding**: `getTierConfig()` in `workers/src/lib/stripe.js` falls back to `'price_1234_regular'` etc. when env vars are missing — these are also invalid
- **Impact**: The entire subscription → checkout → billing → tier enforcement chain cannot function until real Stripe products/prices are created
- **Status**: Tier enforcement middleware exists and is well-structured (enforceFeatureAccess, enforceUsageQuota, recordUsage, getUserTier). Blocked only by Stripe config.

### FG-2: Migration State Unknown
- **Finding**: 11 migration files exist (000, 003, 004, 008–018). Base schema defines 18 tables. Migrations add ~26 more tables. Cannot verify which migrations have been applied to production without live DB access.
- **Tables from migrations that handlers depend on**: achievement_events, alert_deliveries, alert_templates, analytics_events, api_keys, api_usage, checkin_reminders, daily_checkins, funnel_events, invoices, notion_connections, notion_syncs, oauth_states, push_notifications, push_subscriptions, referrals, transit_alerts, user_achievement_stats, user_achievements, user_streaks, webhook_deliveries, webhooks
- **Impact**: If any migration hasn't been applied, the corresponding feature will throw 500 errors
- **Fix**: Run migration runner against production DB and verify `schema_migrations` table, OR add startup self-check

### FG-3: LLM Failover — Groq max_tokens Capped at 8000
- **File**: `workers/src/lib/llm.js` line 122
- **Finding**: `max_tokens: Math.min(promptPayload.config.max_tokens, 8000)` — synthesis prompt requests 6000, which is fine. But if Groq is the only surviving provider and a future prompt requests >8000, it will be silently truncated
- **Impact**: Low risk currently (6000 < 8000). Defensive code that could cause confusion if limits change.

---

## 4. TECHNICAL DEBT (Won't Break Now, Will Hurt Later)

### D-1: 16 console.log Statements in Frontend
- **File**: `frontend/index.html` — 16 occurrences
- **Impact**: User-visible in browser console. Unprofessional in production.

### D-2: 70 innerHTML Assignments (XSS Surface)
- **File**: `frontend/index.html` — 70 innerHTML assignments
- **Mitigating Factor**: `escapeHtml()` function exists (line 3252) and IS used for error messages and user-supplied data (e.g., `escapeHtml(e.message)`, `escapeHtml(data.message)`, `escapeHtml(data.location)`)
- **Risk Areas**: Template literal innerHTML assignments at lines 3150, 3534, 3659, 3730, 3878, 4558, 4611, 4653 — these construct HTML from API response data. If API is compromised, XSS possible.
- **Assessment**: Moderate risk — CSP `script-src 'unsafe-inline'` weakens protection. Most assignments use `render*()` functions that should escape, but no systematic audit of render function internals was done.

### D-3: 35 console.log in Backend Workers
- **Files**: `alerts.js` (5), `push.js` (8), `referrals.js` (3), `webhook.js` (8), `webhookDispatcher.js` (7), `analytics.js` (1), `email.js` (1), `achievements.js` (2)
- **Impact**: Workers logs will be noisy. Use `console.warn` or structured logging selectively.

### D-4: z-index Inconsistency
- **File**: `frontend/css/app.css`
- **Finding**: Mix of hardcoded z-index values (90, 100, 200, 250, 9999) and one `var(--z-tooltip)` token. No z-index scale defined in design-tokens.css.
- **Impact**: Stacking context conflicts likely as UI grows. Line 808 uses `z-index: 9999` (sledgehammer).

### D-5: 12 `!important` Declarations in CSS
- **Files**: `base.css` (9), `app.css` (3), `design-tokens.css` (0)
- **Impact**: Specificity wars. Manageable but should be tracked.

### D-6: CSP Allows `'unsafe-inline'` for Scripts
- **File**: `frontend/index.html` line 9
- **Finding**: `script-src 'self' 'unsafe-inline'` — required because index.html has ~4600 lines of inline JS
- **Impact**: Reduces XSS protection benefit of CSP. Long-term should extract inline JS to external files.

### D-7: JWT Token in localStorage
- **File**: `frontend/index.html` lines 1194, 1329
- **Finding**: `localStorage.getItem('ps_token')` / `localStorage.setItem('ps_token', token)`
- **Impact**: Vulnerable to XSS token theft. Standard for SPAs, but combined with `unsafe-inline` CSP, risk is elevated. Consider HttpOnly cookies if auth refactored.

---

## 5. POLISH (Non-Blocking Quality Items)

### P-1: Accessibility Baseline
- **Findings**: 93 aria attributes (decent), 2 alt-text instances (low), 6 tabindex, 2 semantic HTML tags (`<main>`, `<nav>` or similar)
- **Impact**: Fails basic accessibility standards. Missing alt-text on images, minimal semantic HTML for screen readers.

### P-2: Frontend Bundle Not Minified
- **Finding**: index.html is 256 KB with whitespace, comments, and readable code
- **Impact**: 30-50% size savings available with minification. Cloudflare does auto-minify if enabled.

### P-3: Background Video Not in Precache
- **Finding**: Intentionally excluded from service-worker.js precache (too large). Correctly handled.

### P-4: Service Worker Version v13
- **Finding**: `CACHE_VERSION = 'v13'`. All 40+ STATIC_ASSETS entries verified to exist on filesystem. All 13 manifest.json icon paths verified to exist.
- **Status**: Clean — no 404 risk for precached resources.

---

## 6. CONFIRMED WORKING

| Component | Status | Evidence |
|-----------|--------|----------|
| **Test Suite** | 263/263 PASS | vitest run completes in 7.03s, 4 test files |
| **Engine (8 layers)** | ✅ | 103 engine tests pass. Calculation pipeline Julian→Planets→Design→Gates→Chart→Astro→Transits→Synthesis verified |
| **Canonical KB data** | ✅ | 56 canonical tests pass. JSON knowledgebase integrity verified |
| **Numerology** | ✅ | 63 numerology tests pass |
| **Handler routing** | ✅ | 41 handler tests pass. Route table enumerated (~120 routes) |
| **CORS (BL-C4)** | ✅ | DELETE method included, origin-specific headers, no wildcard |
| **LLM Failover Chain** | ✅ | Clean Anthropic→Grok→Groq chain with model mapping, error aggregation, console.warn on fallback |
| **Auth Boundary** | ✅ | PUBLIC_ROUTES, AUTH_ROUTES, AUTH_PREFIXES well-defined. requiresAuth() checks in correct order |
| **Tier Enforcement** | ✅ | Full middleware (enforceFeatureAccess, enforceUsageQuota, recordUsage, getUserTier) exists with proper 401/403/429 responses |
| **CSP Header** | ✅ | Present with default-src, script-src, connect-src, object-src, base-uri, form-action |
| **Service Worker** | ✅ | v13, all precache files exist, icons verified |
| **Manifest.json** | ✅ | 13 icons, all paths verified to exist |
| **Design Tokens** | ✅ | Single `:root` in design-tokens.css (line 17), no inline `:root` in index.html. Gold color uses `var(--gold)` consistently (no hardcoded hex for primary gold) |
| **Migration 018** | ✅ | Correctly drops phantom `usage_tracking` table |
| **escapeHtml utility** | ✅ | Exists at line 3252, used for error messages |
| **escapeAttr utility** | ✅ | Exists for HTML attribute sanitization |
| **Synthesis Prompt** | ✅ | Comprehensive forbidden-terms list, approved alternatives, anti-Barnum grounding rules, convergence requirements, JSON output schema with validation |
| **RAG Context Builder** | ✅ | Loads 21+ KB categories, contextual gate interpretation with planet/line/house/channel enrichment |
| **No hardcoded secrets** | ✅ | Zero instances of API keys, tokens, or credentials in source code |
| **No eval()** | ✅ | Zero occurrences in frontend |
| **No var declarations** | ✅ | All const/let in frontend |
| **No alert()** | ✅ | Zero occurrences in frontend |

---

## 7. UNVERIFIABLE (Require Live Environment)

| Item | What's Needed | Risk if Broken |
|------|--------------|----------------|
| **Stripe webhook signature verification** | Live Stripe webhook event | Billing pipeline fails |
| **Neon DB table state** | `SELECT * FROM schema_migrations` on production | Features 500 if migrations not applied |
| **AI Gateway routing** | Live request with `AI_GATEWAY_URL` set | Anthropic calls route wrong |
| **Telnyx SMS delivery** | Live phone number + credits | SMS digests fail silently |
| **Push notification delivery** | VAPID keys + browser subscription | Push alerts never arrive |
| **Notion OAuth flow** | Real Notion client credentials | Notion sync broken |
| **Email delivery (Resend)** | `RESEND_API_KEY` set | All transactional email fails |
| **Cloudflare KV** | Live KV namespace (ID present in wrangler.toml) | Cache/rate-limit breaks |
| **R2 bucket access** | `prime-self-exports` bucket exists | PDF export fails |
| **Cron trigger** | `0 6 * * *` — needs live deployment | Scheduled tasks don't run |
| **Worker size limit** | Need `wrangler deploy --dry-run` | Might exceed 1MB compressed limit with all KB JSON |

---

## 8. DEPLOYMENT SEQUENCE

Execute in this exact order:

### Pre-Deploy (Developer Machine)
1. **Fix SS-3**: Change `NEON_CONNECT_STRING` → `NEON_CONNECTION_STRING` in `workers/src/db/migrate.js`
2. **Fix SS-1**: Create Stripe products/prices in Dashboard, get real price IDs
3. **Set SS-2 secrets**: Run `wrangler secret put` for all 13+ missing env vars
4. **Fix TD-3/TD-4**: Add `heresies_canonical.json` and `savannah_narrative.json` imports to engine-compat.js
5. **Run tests**: `npx vitest run` — verify 263/263 pass after fixes

### Deploy
6. **Run migrations**: Execute migration runner against production Neon DB
7. **Verify schema**: `SELECT name FROM schema_migrations ORDER BY name` — confirm all 000-018 present
8. **Deploy Worker**: `wrangler deploy` (or deploy.sh)
9. **Deploy Frontend**: Push to Cloudflare Pages (deploy-frontend.sh)

### Post-Deploy Verification
10. **Health check**: `GET /api/health` — verify 200
11. **Chart calculation**: Submit birth data — verify engine returns
12. **Profile generation**: Generate AI profile — verify LLM responds
13. **Stripe checkout**: Test with Stripe test keys — verify session creates
14. **Service worker**: Visit PWA, verify offline capability

### Deferred (Sprint Backlog)
15. Replace HD IP terms in frontend renderers (TD-1)
16. Remove or implement "Coming soon" stub (TD-2)
17. Strip console.log from frontend and reduce in backend (D-1, D-3)
18. Establish z-index scale in design-tokens.css (D-4)
19. Accessibility pass: alt-text, semantic HTML, focus management (P-1)

---

## 9. LESSONS LEARNED

### What This Audit Confirmed
1. **The engine is solid.** 263 tests, 8 layers, pure computation — no external dependencies in the calculation pipeline. This is the product's moat.
2. **The LLM failover chain is well-designed.** Clean separation, model mapping table, graceful degradation with error aggregation.
3. **The synthesis prompt is best-in-class.** Anti-Barnum grounding, forbidden terms, convergence requirements, JSON schema — this is serious IP.
4. **Auth boundaries are correct.** The route-level auth model (PUBLIC_ROUTES → AUTH_ROUTES → AUTH_PREFIXES) is clear and defensive.
5. **The tier enforcement middleware is complete** but untested in production (depends on Stripe integration).

### What This Audit Exposed
1. **Configuration drift is real.** The code references 27+ env vars but only 8 are in wrangler.toml secrets. A secrets manifest should exist.
2. **The frontend IP leakage contradicts backend IP protection.** The LLM prompt carefully avoids HD terms, but the frontend renderer uses them freely. This creates legal inconsistency.
3. **Migration state is opaque.** Without a startup self-check or migration status endpoint, there's no way to know if the DB matches the code.
4. **Documentation links are aspirational.** 6 documents referenced in DOCUMENTATION_INDEX.md don't exist: `docs/API_REFERENCE.md`, `docs/GETTING_STARTED.md`, `docs/DESIGN_SYSTEM.md`, `docs/OPERATIONS.md`, `audits/UX_AUDIT_2026-03-09.md`, `process/SPRINT_STATUS.md`.
5. **The monolithic index.html (256 KB, ~4600 lines inline JS)** makes systematic security auditing difficult and forces `'unsafe-inline'` in CSP.

### Recommendations for Next Sprint
- Create `SECRETS_MANIFEST.md` listing every env var, which handler uses it, and whether it's set
- Add `/api/migration-status` endpoint (admin-only) that reports applied migrations
- Extract inline JS from index.html into modules (enables removing `'unsafe-inline'` from CSP)
- Implement automated IP terminology scanning in CI

---

**VERDICT**: 3 show-stoppers, 4 trust defects, 3 functional gaps. The engine and architecture are production-grade. Deployment is blocked by configuration (Stripe keys, missing secrets, one env var typo) not by code quality. Fix the 3 show-stoppers and deploy.
