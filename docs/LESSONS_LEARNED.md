# Lessons Learned — Prime Self Engine

> Historical snapshot. Entries in this document are point-in-time incident notes and may include older test baselines, pricing labels, and operational assumptions that no longer match the current canonical docs.

This document catalogs key learnings from development, debugging, and production incidents. Each entry includes context, root cause, resolution, and preventive measures.

---

## Incident Log

### 2026-03-21 | Recurring Frontend Regression — Helper Alias Drift and Unsafe Device Normalization

**Context**
Users reported two recurring regressions that had both been fixed previously: city lookup failed with `escapeHTML is not defined`, and an intermittent `toLowerCase is not a function` error reappeared in live flows. A Samsung Z Flip test device was also being classified as desktop in some paths.

**Key Findings**

1. **Helper naming drift can resurrect old browser errors when cached assets survive**
   - The current app uses `escapeHtml`, but older code paths still expected `escapeHTML`
   - If a stale asset or older browser path calls the previous helper name, city lookup fails even though geocoding itself is healthy
   - Lesson: **When renaming global browser helpers, keep a compatibility alias until the service-worker cache generation that depended on the old name is gone.**

2. **Header values must be normalized before string methods in Workers code**
   - `getDeviceType()` lowercased a chained header expression directly
   - If a header adapter returned a non-string shape, the chain threw before analytics completed
   - Lesson: **Always coerce request metadata to strings before calling `toLowerCase()`, `trim()`, or regex checks.**

3. **Foldables need explicit handling in responsive heuristics**
   - Generic mobile detection did not reliably cover Samsung foldables in every runtime path
   - Lesson: **Treat foldables as an explicit mobile class in both frontend layout logic and backend analytics heuristics.**

**Resolution**
- Added an `escapeHTML` compatibility alias in the frontend runtime alongside `escapeHtml`
- Hardened backend device detection by normalizing header values before lowercasing
- Expanded frontend and backend mobile heuristics to recognize Samsung foldables more reliably
- Bumped the service-worker cache version so cached clients refresh to the fixed runtime bundle

**Preventive Measures**
- [ ] Keep compatibility aliases for renamed global helpers through at least one cache-version rollover
- [ ] Add a small normalization helper before string operations on request metadata
- [ ] Include at least one foldable-device scenario in responsive validation

### 2026-03-14 | Comprehensive Production Readiness Audit — Multi-Perspective Deep Validation

**Context**
Full codebase audit from Master Engineer, CIO/CTO, CISO, and User/Practitioner/Agency perspectives. The then-current test suite was passing at audit time. All frontend JS, backend handlers, middleware, engine, and infrastructure were reviewed. Prior audit findings were validated against actual code.

**Key Findings**

1. **Many prior audit findings were already fixed — validation step critical**
   - Subagent audits flagged `escapeAttr()` missing → confirmed FALSE POSITIVE (defined at app.js L3946)
   - Subagent flagged brute force missing → confirmed FALSE POSITIVE (KV lockout at auth.js L283, 5 attempts / 15min)
   - Subagent flagged Telnyx atob on hex → confirmed FALSE POSITIVE (signature is base64, not hex)
   - Subagent flagged Sentry not imported → confirmed FALSE POSITIVE (imported at index.js L233, used at L611)
   - Subagent flagged Plausible YOUR_DOMAIN → confirmed FALSE POSITIVE (set to `selfprime.net`)
   - Lesson: **Always validate automated audit findings against actual code before adding to backlog.** Code changes since prior audits invalidate stale findings.

2. **Secrets file exists locally but is properly gitignored**
   - `secrets` file at project root with all production credentials in plaintext
   - `.gitignore` has `secrets` on line 19 and `**/secrets` on line 25
   - `git log --all --oneline -- secrets` returns empty (never committed)
   - Lesson: **Local credential files are acceptable IF gitignored, but a secrets manager (1Password CLI, Vault, etc.) is best practice.** The file existing on disk means any machine compromise exposes everything.

3. **Service Worker CACHE_VERSION must be bumped with every CSS/JS change**
   - Current version v17, but multiple CSS/JS changes have occurred since last bump
   - PWA/mobile users may see stale layouts until SW cache expires
   - Lesson: **Add to deploy checklist: grep CACHE_VERSION, verify it matches latest change count. Better: automate hash-based cache busting.**

4. **AI Gateway URL is functional but suboptimal**
   - Set to `https://selfprime.net` instead of actual Cloudflare AI Gateway URL
   - Code gracefully falls back to direct Anthropic/Grok/Groq API calls
   - But loses: rate limiting, caching, request/response logging, model analytics
   - Lesson: **Verify operational configuration matches architectural intent. Fallback behavior masks misconfiguration.**

5. **The test suite was strong at audit time, but still had integration-testing gaps**
   - No JWT end-to-end verification tests (all mocked)
   - No load/stress tests
   - No test coverage reporting configured
   - Lesson: **Unit tests passing doesn't mean production-ready. Integration tests, E2E tests, and load tests are separate concerns that need separate investment.**

6. **Scalability ceiling is infrastructure, not code**
   - Cloudflare Workers handle 100k+ RPS per zone — not a bottleneck
   - Neon PostgreSQL serverless scales reads but has connection limits (~100 concurrent per endpoint)
   - LLM API calls are the true bottleneck: Anthropic rate limits, Grok capacity, Groq throughput
   - KV writes are eventually consistent (1s propagation), reads are edge-cached
   - Lesson: **For 50 concurrent users, the system will work fine for chart calculations and transits. LLM-dependent features (profile generation, synthesis) are the scaling constraint — rate limited by design at 3/min/user.**

7. **IP/Trademark issue remains the single largest business risk**
   - "Human Design" trademark (IHDS) and Gene Keys (Richard Rudd) terminology throughout codebase
   - Technical fix (search-and-replace) is straightforward but touches emails, meta tags, share cards, JS variables, HTML content
   - Legal fix (licensing) is separate track requiring lawyer + negotiation
   - Lesson: **IP clearance should happen BEFORE coding, not after. Retrofitting terminology into an existing codebase is expensive.**

**Preventive Measures**
- [ ] Add CACHE_VERSION bump to deploy checklist
- [ ] Configure vitest coverage reporting (`v8` provider, 80% threshold)
- [ ] Set up Cloudflare AI Gateway and update `AI_GATEWAY_URL` secret
- [ ] Replace `PRIME_SELF_API_SECRET` placeholder before Discord Worker goes live
- [ ] Investigate secrets manager integration (1Password CLI or Cloudflare Workers secrets-only approach)
- [ ] Add load testing with k6 or Artillery before scaling beyond 50 concurrent users

---

### 2026-07-18 | Phase 2 Audit Remediation — 19 Security & Business Logic Fixes

**Context**
Systematic resolution of all Critical and High findings from the Phase 2 deep audit (62 findings total). Fixes applied in strict criticality order across 10 source files.

**Fixes Applied (19 issues → ✅ Fixed)**

| Category | IDs | Fix Pattern |
|----------|-----|-------------|
| **XSS (6)** | P2-SEC-001/002/004/005/006/007 | Applied `escapeHtml()` / `escapeAttr()` to all API data rendered via innerHTML. Replaced inline `onclick` with `data-action` delegation pattern. Covered: celebrity grid, leaderboard, achievements, timing, astro chart legend. |
| **SSRF (1)** | P2-SEC-012 | Validated `new URL(endpoint).protocol === 'https:'` on push subscription registration. |
| **Open Redirect (2)** | P2-SEC-009/010 | Backend: `isSafeUrl()` validation on billing portal `returnUrl`. Frontend: hostname check `.stripe.com` before `window.open`. |
| **Data Exposure (2)** | P2-SEC-003/008 | SMS: restricted phone-based targeting to practitioner tier. Practitioner: field whitelist on client detail response. |
| **Race Condition (1)** | P2-BIZ-001 | Atomic `UPDATE ... SET reward_granted = true WHERE reward_granted = false RETURNING *` — concurrent requests get 0 rows. |
| **Billing Logic (5)** | P2-BIZ-003/004/005/006/007 | Partial refund: check `charge.refunded === true`. Account delete: cancel Stripe sub + clear cookie. Dispute: retrieve charge for customer ID. Legacy tiers: removed from validation. |
| **Idempotency (1)** | P2-BIZ-008 | Added `idempotencyKey: referral-credit-${event.id}` to Stripe balance transaction call. |
| **Engine (1)** | P2-ENGINE-001 | Added `HD_STANDARD_BODIES` filter set (13 bodies) — Chiron excluded from channel detection, still available for display. |

**Key Patterns Reinforced**
1. **escapeHtml at the render boundary** — API data is untrusted even when served from our own backend. Every innerHTML insertion of API data must use `escapeHtml()`.
2. **Atomic DB operations for financial state** — Never read-check-write for reward claims. Use `WHERE condition RETURNING *` for single-step atomic mutations.
3. **Stripe idempotency keys on all non-query API calls** — Webhook retries are guaranteed. Every `createBalanceTransaction`, `createCharge`, etc. needs an idempotency key derived from the event ID.
4. **Validate both ends of a redirect chain** — Backend validates the URL is safe before sending to Stripe; frontend validates the returned URL before opening. Defense in depth.
5. **Field whitelisting > field exclusion** — When returning user data to another user (practitioner → client), always whitelist safe fields rather than trying to exclude sensitive ones.

**Remaining Open Items** (not addressed in this sprint; see later entries for resolution)
- ~~P2-BIZ-002: Self-referral Sybil~~ → ✅ Fixed 2026-07-18. 3-layer defense: 72hr account-age gate, 3-per-domain email cap, 10-claim lifetime cap. See "Anti-Sybil Referral Defense" entry below.
- P2-SEC-011: OAuth token in URL — requires auth code flow redesign (deferred)
- P2-SEC-013: Cluster join without invite — needs product decision (deferred)
- P2-ENGINE-002: Jupiter/Saturn perturbation — research needed (deferred)

---

### 2026-07-18 | Phase 2 Audit Remediation — 28 Medium-Severity Fixes

**Context**
Continuation of Phase 2 audit remediation. After completing all 19 Critical/High items, systematically resolved all 28 Medium-severity findings across 14 source files.

**Fixes Applied (28 issues → ✅ Fixed)**

| Category | IDs | Fix Pattern |
|----------|-----|-------------|
| **XSS/Injection (3)** | P2-SEC-014/015, P2-FE-008 | `escapeHtml()` on profile pills. Protocol regex check blocks `javascript:` URLs. HTML tags stripped from non-JSON API errors before UI display. |
| **Data Exposure (3)** | P2-SEC-016/017/018 | Cluster member emails masked (prefix only). Email removed from addClient response. Notion OAuth: refuse to store unencrypted tokens (503 instead of plaintext fallback). |
| **Business Logic (7)** | P2-BIZ-009–018 | Cron downgrade wrapped in transaction. Dead agency cap removed. Missing alert tier limits added. Daily ceiling check+increment merged to narrow TOCTOU race. Welcome email: added Manifesting Generator type, filled content gap for ~33% of users. Diary date format validation. Celebrity ID length validation. |
| **Rate Limiting (3)** | P2-BIZ-014/015/017 | Added pattern-based rate limit matching via `resolveRateLimit()` for parameterized routes. New limits: cluster synthesis (3/min), share endpoints (10/min), diary (20/min), timing (10/min), composite (10/min). |
| **Frontend UX (6)** | P2-FE-001–005/007 | Promo code cleared on modal close. Diary edit mode cleared on tab switch. Referral only clears localStorage on success. Tab auto-loads guarded with loading-state Set. JWT exp decoded for proactive token refresh. Share URL validated with `new URL()` + protocol check. |
| **Engine (3)** | P2-ENGINE-003/004/005 | Gate `wraps` boolean flag for 0°/360° boundary. Life cycle dates flagged as `approximate: true`. `jdnToCalendar` now returns seconds (was only minutes). |
| **LLM (3)** | P2-LLM-001/002/003 | Groq max_tokens raised from 8000→32000. LLM failover capped at 55s wall-clock (was unbounded ~128s). Removed dead `readFileSync` + Node.js fs/path imports from Workers-deployed synthesis.js. |
| **Verification (1)** | P2-FE-006 | Confirmed backend tier enforcement is comprehensive (resolveEffectiveTier, enforceFeatureAccess, enforceUsageQuota). Client-side checks are cosmetic only — acceptable. |

**Key Patterns Reinforced**
1. **Merge check+increment for KV-based rate limiting** — KV offers no atomic increment. Co-locating read and write in one function call narrows the TOCTOU window from "handler execution time" to "KV put latency."
2. **Pattern-based rate limits needed for parameterized routes** — Exact path matching in rate limit config doesn't match `/api/cluster/:id/synthesize`. Added prefix/regex resolver alongside static map.
3. **Proactive token refresh > reactive 401-retry** — Decoding JWT `exp` and scheduling refresh 60s before expiry eliminates the user-visible 401→retry→success latency spike.
4. **Loading-state guards prevent duplicate fetches** — A `Set` of in-flight tab IDs, checked before triggering auto-load, is cheaper than debouncing and handles both rapid switching and re-entry.
5. **Remove dead Node.js imports from Workers bundles** — `import { readFileSync } from 'fs'` in a CF Workers file won't crash at runtime (falls back), but pollutes the bundle and confuses developers. Remove the dead code path entirely.
6. **Flag approximate dates rather than displaying them as exact** — Life cycle return dates use linear extrapolation (not real planetary positions). Adding `approximate: true` to the output lets consumers display appropriate uncertainty.

---

### 2026-03-13 | UI Sprint: Inline Style Cleanup (311 → 56), CSS Architecture, A11y

**Context**
Multi-session UI review sprint targeting CSS modularization, inline style elimination, and accessibility hardening across the 1,900-line `frontend/index.html` SPA.

**Key Findings**

1. **82% of inline styles were pure CSS that had never been extracted**
   - Started with 311 `style="..."` attributes; 254 were presentational CSS accidentally left as inline styles during rapid feature development
   - Remaining 57: `display:none` (JS-controlled visibility) + `width:0%` (JS-animated progress bars) — these are legitimately irreducible
   - Lesson: Do a grep count on `style=` at the end of every sprint. A number above ~10 is a warning sign.

2. **JS-driven visual state must stay in JS, not CSS**
   - `setBillingPeriod()` in app.js was toggling `style.background` and `style.color` directly
   - Correct pattern: add/remove a CSS class (`.billing-toggle-btn.active`) and drive all visual state from a single CSS rule
   - Benefit: hover/focus/active states work correctly; no specificity fights between JS styles and CSS

3. **CSS class naming for semantic grouping reduces future drift**
   - Named new classes after their role, not their style: `.card-header-row`, `.form-actions-row`, `.invite-row`, `.progress-bar-track` — not `.flex-sb-center` or `.mt-4-flex`
   - Semantic names survive design changes; utility names create churn

4. **Python inline sed-style scripts for bulk HTML transformation are safer than regex-only**
   - Running bulk replacements inside the same Python process that parses the file is more reliable than `sed -i` for multi-line attribute patterns
   - Key safety rule: always pipe through `grep -v 'display:none'` logic inside the script so JS-controlled state is never accidentally removed
   - Always print a before/after count so drift is immediately visible

5. **Service worker must be bumped for every CSS change or users see stale styles**
   - CSS changes without SW version bump = mobile users can see stale layout for hours/days
   - Establish rule: bump `CACHE_VERSION` in service-worker.js in the same commit as any CSS/HTML change

6. **A11y `aria-live="polite" role="status"` — add up front, not as an afterthought**
   - Found 7 dynamic status regions (`div` elements updated by JS after async operations) without `aria-live`
   - Screen readers announce these silently because the region was already rendered before JS updated it
   - Pattern: any `div` that receives JS `textContent` or `innerHTML` for user feedback must have `aria-live="polite" role="status"` from initial render

7. **`app.js` was missing from the Service Worker static cache**
   - The main app file was not in `STATIC_ASSETS` — so after a network-offline state, the entire app JS would 404 silently
   - Lesson: Audit SW cache list against ALL `<script src=...>` tags whenever new JS modules are added

8. **Head scripts without `defer` block first paint**
   - `explanations.js`, `hd-data.js`, `bodygraph.js`, `share-card.js` (large data files) were in `<head>` with no `defer`
   - They blocked HTML parsing until fully downloaded AND executed, delaying First Contentful Paint by hundreds of ms on slow connections
   - These are safe to defer because they define globals that `app.js` uses, and `app.js` is at bottom of body (executed after DOM parse)
   - Fix: add `defer` to all head scripts + all body scripts without it; scripts execute in document order after parse

**Resolution**
- `frontend/index.html`: 311 → 56 inline styles; `defer` added to all JS scripts in `<head>` and body
- `frontend/css/app.css`: Three new CSS blocks appended (~440 lines total) covering 80+ new semantic classes
- `frontend/js/app.js`: `setBillingPeriod()` converted from JS inline styles to `classList.toggle('active', ...)`
- `frontend/service-worker.js`: Missing JS files added to `STATIC_ASSETS`; version bumped

**Preventive Measures**
- [ ] Add pre-deploy `grep -c 'style=' frontend/index.html` check — alert if > 60
- [ ] Add SW cache audit: verify every `<script src=...>` in index.html is in STATIC_ASSETS
- [ ] Establish rule: every new dynamic status div must ship with `aria-live="polite" role="status"`
- [ ] Establish rule: every `setBillingPeriod`-style visual toggle in JS must use `classList`, never inline `style`

---

### 2026-06-26 | Grok 4 Fast Failover Upgrade

**Context**
Upgraded the LLM failover chain from `grok-3-latest` to `grok-4-fast` for Opus-equivalent tiers. The Sonnet tier remains on `grok-3-mini-latest`.

**Key Findings**
1. **Grok 4 Fast is the best failover option for Opus-tier synthesis**
   - xAI's Grok 4 Fast offers reasoning capability closer to Anthropic Opus than Grok 3 did
   - Upgrade was a single-line change in MODEL_MAP (`workers/src/lib/llm.js`)
   - Also updated `resolveModels()` fallback for unknown model IDs from `grok-3-latest` → `grok-4-fast`

2. **Failover chain architecture is resilient by design**
   - Chain: Anthropic (2-retry with exponential backoff) → Grok 4 Fast (xAI) → Groq (llama-3.3-70b)
   - MODEL_MAP makes per-model-tier mapping explicit — easy to upgrade individual providers without touching the chain
   - Lesson: Keep failover upgrades isolated to MODEL_MAP; don't restructure the chain for a provider swap

3. **KV namespace creation is idempotent but errors on duplicates**
   - `wrangler kv namespace create RATE_LIMIT_KV` returns error 10014 if namespace already exists
   - Resolution: Use `wrangler kv namespace list` to find existing ID, update `wrangler.toml` directly
   - Lesson: Always check for existing namespaces before creating

**Preventive Measures**
- Documentation updated across 30+ files to reflect current provider chain
- All tier configs verified against live `stripe.js` source of truth

---

### 2026-06-26 | Plan v4 Sprint: Deterministic Forge, Daily Ceilings, Studio Tier

**Context**
Implemented Plan v4 (Final): 4-tier pricing with Studio ($149), deterministic Forge/Knowledge scoring, daily ceiling enforcement, Anthropic retry logic, and CI test gate.

**Key Findings**
1. **hasFeatureAccess() silently blocked paid tier features**
   - `getTierConfig()` returned numeric quotas (e.g., `profileGenerations: 200`) for Guide tier
   - `hasFeatureAccess()` only returned `true` for boolean `true` or `Infinity`
   - Result: Guide users were treated as if features were disabled
   - Fix: Added `typeof value === 'number' && value > 0` check

2. **KB data access requires dual-runtime pattern**
   - Workers runtime: data injected at build time via `globalThis.__PRIME_DATA.kb[key]`
   - Node.js/test runtime: read from filesystem at `src/knowledgebase/`
   - Existing pattern in `rag.js` — adopted same `loadKB(category, file)` approach in synthesis.js
   - Lesson: Always check engine-compat.js injection map before assuming KB data is available

3. **Daily ceilings need atomic counters, not DB queries**
   - DB query per request for daily counts would create hot-path latency
   - Cloudflare KV with `expirationTtl: 172800` (48h) handles auto-cleanup without cron jobs
   - Fail-open pattern: if KV unavailable, allow the request rather than blocking paying customers
   - Key format: `daily:{userId}:{YYYY-MM-DD}:{action}` supports per-action granularity

4. **LLM Forge guessing was the #1 synthesis quality issue**
   - Previous approach: dump 5 Forge descriptions into prompt, ask LLM to "determine" which fits
   - LLM would sometimes pick based on poetic resonance rather than chart data
   - Fix: Deterministic 9-step scoring algorithm from forge_mapping.json (type weight 10, gate indicators 3, center indicators 2, motor-to-throat 4, astro signs 2, astro houses 1)
   - Result injected as `DETERMINISTIC FORGE IDENTIFICATION` with explicit `INSTRUCTION: Do NOT re-derive`

5. **Token budget matters for synthesis quality**
   - At `max_tokens: 4096`, longer charts (many gates + aspects + transits) would truncate mid-sentence
   - Increased to 6000 — fits within Anthropic's output limit
   - Added 2-retry with exponential backoff before failover to prevent one-shot failures from hitting Grok

**Preventive Measures**
- CI pipeline now runs `npm test` before deploy (was deploy-only before)
- `validateSynthesisResponse()` now validates canonical Forge names (Initiation/Mastery/Guidance/Perception/Transformation)
- Studio tier added to `getTierConfig()` with explicit daily ceilings — no more "unlimited" without caps
- wrangler.toml documents RATE_LIMIT_KV as required binding

**Key Patterns Established**
- **Deterministic > LLM for classification**: When chart data can yield a definitive answer, compute it. Use LLM only for narrative and insight.
- **Fail-open for rate limiting**: Never block a paying user due to infrastructure failure. Log the failure, allow the request.
- **Retry before failover**: Anthropic deserves 2 retries (transient errors are common) before falling back to Grok/Groq which produce lower quality synthesis.

---

### 2026-06-27 | Tier Rename Fallout: 16 Logic Bugs from Incomplete Code Sweep

**Context**
Plan v4 renamed database tier values (`seeker`→`regular`, `guide`→`practitioner`, added `white_label`). Documentation was updated across 40+ files, but source code handlers still compared against the old tier names. A systematic audit of all `.js` files revealed 16 logic bugs and 20 display bugs across 10 source files.

**Key Findings**
1. **MRR dashboard showed $0 for all tiers**
   - `analytics.js` read `m.seeker_count`/`m.guide_count` but the SQL query (`queries.js`) returned `regular_count`/`practitioner_count`/`white_label_count`
   - All three price multipliers were also wrong (1500/9700/50000 vs correct 1200/6000/14900)
   - Impact: Admin MRR dashboard was completely non-functional

2. **Tier limit maps used old keys — paid users got free-tier limits**
   - `alerts.js` `tierLimits` keyed on `seeker`/`guide` — `regular` users fell through to default (3 alerts)
   - `frontend/js/app.js` `tierLimits` keyed on `seeker`/`guide` — Explorer users saw wrong quota messaging
   - `achievements.js` `getTierRank()` returned 0 for `regular`/`white_label` — tier-upgrade achievements never fired

3. **Access control gates checked wrong tier values**
   - `analytics.js` checked `['guide', 'practitioner']` — `white_label` users blocked, nobody with `practitioner` DB value matched `guide`
   - `experiments.js` blocked `seeker` (dead value) instead of `regular` — Explorer users got unintended access
   - `notion.js` checked `guide` instead of `white_label` — Studio users blocked from Notion sync

4. **Referral rewards advertised wrong tier name and price**
   - 6 locations in `referrals.js` said "Seeker" at $15/1500 cents instead of "Explorer" at $12/1200
   - `queries.js` hardcoded reward_value 1500 in 2 SQL queries
   - Stripe balance transactions applied $15 credit instead of $12

5. **Base migration `migrate.sql` would reject new tier values on fresh setup**
   - CHECK constraint still listed `('free', 'seeker', 'guide', 'practitioner')`
   - Any fresh database deployment would fail on `INSERT ... tier = 'regular'`

**Root Cause**
Tier rename was treated as a "naming convention" change and applied only to configuration, documentation, and the Stripe layer. Runtime code that hardcoded tier string comparisons was not systematically audited. The DB migration `020_fix_subscription_constraints.sql` handled the live data migration but didn't trigger a sweep of all code that compares against tier values.

**Resolution**
Fixed 10 source files: `analytics.js`, `alerts.js`, `achievements.js`, `experiments.js`, `notion.js`, `referrals.js`, `email.js`, `queries.js`, `migrate.sql`, `frontend/js/app.js`. All 278 tests pass.

**Preventive Measures**
1. **Enum renames require a grep sweep of ALL source files** — not just config and docs. Search for every old value as a string literal.
2. **Tier values should be defined once and imported** — hardcoded string comparisons across 10+ files are a rename landmine. Consider a shared `TIER_VALUES` constant.
3. **Add revenue integration test** — the MRR dashboard was silently broken because no test verifies column name alignment between SQL queries and JS property access.
4. **Legacy alias pattern works well for gradual migration** — `practitioner.js` already had `seeker: 5, guide: 50` as legacy aliases alongside the correct keys. This pattern (canonical + legacy in the same map) prevented breakage there. Adopt it everywhere.

---

### 2026-03-10 | Launch Remediation Sprint: Route Drift, Contract Drift, and Dead-Code Risk

**Context**
Executed a multi-item launch-readiness remediation across auth, billing, security, legal pages, and docs. Most blockers were fixed quickly, but follow-up validation uncovered secondary regressions caused by route and response-contract drift.

**Key Findings**
1. **Frontend/back-end route drift caused silent feature breakage**
   - Frontend promo validation called `/api/billing/redeem/:code`
   - Router actually exposes `GET /api/promo/validate?code=...`
   - Result: promo UI looked wired but could not validate codes in production

2. **Client helper contract drift caused runtime errors**
   - `apiFetch()` returns parsed JSON, not raw `Response`
   - New `deleteAccount()` and `exportMyData()` code initially treated return values as `Response` (`res.ok`, `res.json()`, `res.blob()`)
   - Result: account/data-export actions would fail at runtime despite passing lint/tests

3. **Legacy route removal was incomplete without doc and artifact cleanup**
   - `/api/checkout/*` routes were removed from runtime router, but legacy references remained in setup docs
   - Dead handler `workers/src/handlers/checkout.js` remained in repo after routing moved to `billing.js`
   - Result: onboarding confusion and risk of accidental reintroduction of deprecated paths

**Resolution**
- Fixed promo UI endpoint to `/api/promo/validate?code=...`
- Fixed account deletion flow to use parsed JSON contract from `apiFetch()`
- Reworked export flow to use raw `fetch()` for binary download path
- Deleted dead `workers/src/handlers/checkout.js`
- Updated Stripe/setup docs to canonical billing endpoints (`/api/billing/checkout`, `/api/billing/portal`)
- Standardized touched handlers toward `Response.json(...)` and `ok: true` success semantics

**Key Learnings**
1. **Every route migration needs a compatibility matrix**
   - Update four surfaces together: router, frontend callers, tests, docs
   - Route consolidation is not complete until all four are validated

2. **Treat API helper return shape as a hard contract**
   - If helper returns parsed JSON, do not mix raw-Response methods
   - Use a separate explicit path for blob/download endpoints

3. **Dead code is an active risk, not neutral clutter**
   - Orphaned handlers and stale examples create false truths for future changes
   - Remove deprecated files in the same PR as route removal

4. **Regression checks must include user-critical flows, not only unit tests**
   - Unit suite passed while account/export and promo UX had integration issues
   - Add targeted smoke checks for login, billing, promo validation, and data export

**Preventive Measures**
- [ ] Add CI route inventory check: compare frontend `/api/...` calls against router map
- [ ] Add docs drift check for deprecated endpoints (`/api/checkout/*`, `/api/billing/webhook`)
- [ ] Add a frontend contract test for `apiFetch()` usage patterns
- [ ] Add post-change smoke script for: promo validate, checkout start, account delete (dry-run), data export

---

### 2026-03-09 | Backlog Verification Pass: False Positives & CSS Architecture

**Context**
Executed comprehensive backlog verification following the 8-phase Backlog Processing Protocol. All 39 UI defect items marked ✅ FIXED were systematically re-verified in source code before browser testing.

**Key Findings**
1. **False positive:** UI-008 (transit-row mobile grid stacking) was marked ✅ FIXED but the breakpoint code was missing
   - Backlog claimed: "Added @media (max-width: 600px) breakpoint to collapse grid to single column"
   - Reality: Only `max-width: 100%` was present; grid-template-columns was never changed
   - Fix applied: Added proper media query to mobile.css
   
2. **Dead CSS:** Found 5 unused classes with trademarked Human Design terms (.manifestor, .projector, .reflector, .generator)
   - These were never applied to DOM (JS uses forge roles instead: Power/Craft/Vision/Mirrors)
   - IP risk: Could expose codebase to trademark claims if found in code review
   - Removed from prime-self.css and app.css
   
3. **Z-index chaos:** Found 9 hardcoded integer values creating stacking context conflicts
   - Modal nav (z-index: 100) conflicted with dropdown (z-index: 100)
   - Onboarding overlay used arbitrary z-index: 9999
   - Tooltip collision possible with modal backdrop
   
**Resolution**
- Added 2 new design tokens: --z-header (90), --z-onboarding (500)
- Replaced all 9 hardcoded values with token references across app.css (7) and mobile.css (2)
- Bumped service worker v9 → v12 for cache invalidation
- Updated 9-level normalized z-index stack in design-tokens.css

**Z-Index Stack Architecture (Canonical)**
```css
/* Design Tokens — Z-Index Stack (Normalized 2026-03-09) */
--z-sticky: 20;         /* Sticky headers, scrollable sections */
--z-header: 90;         /* Main header bar */
--z-dropdown: 100;      /* Dropdowns, popovers, date pickers */
--z-mobile-nav: 150;    /* Bottom navigation (mobile only) */
--z-modal-backdrop: 200; /* Modal backdrop overlay */
--z-modal: 210;         /* Modal content windows */
--z-tooltip: 300;       /* Tooltips and hints */
--z-notification: 400;  /* Toast notifications */
--z-onboarding: 500;    /* Onboarding overlays and tutorials */
```

**Key Learnings**
1. **"Marked fixed ≠ Confirmed fixed"** — Always code-verify before browser testing. 2.6% false positive rate (1/39 items).
   
2. **Search for what should exist, not just what does** — Grep for expected patterns (e.g., `@media.*600.*transit-row`) catches missing fixes faster than reading full files.
   
3. **Dead CSS is a liability** — Unused code creates:
   - IP risk (trademarked term exposure)
   - Confusion (devs assume it's used)
   - Maintenance burden (must update when refactoring)
   
4. **Z-index needs governance** — Without a centralized design token stack:
   - Conflicts emerge as features add layers
   - Debugging requires global search for all z-index values
   - No single source of truth
   
5. **Service worker versioning is critical** — CSS changes without cache invalidation = returning users see stale styles for days/weeks.

**Preventive Measures**
- ✅ Establish z-index token-only policy (enforced via code review)
- ✅ Service worker version bumps mandatory for any CSS/JS file changes
- [ ] Add pre-commit hook to grep for hardcoded z-index integers
- [ ] Add CSS linter rule to flag IP-risky terms (manifestor, projector, reflector, generator, sacral, spleen, etc.)

---

## Incident 6 — Deep Dive Security & Logic Audit (2026-07-17)

**Context**: After completing Incident 5 (39-item backlog verification), a second-pass 8-vector deep scan was performed using parallel sub-agents covering SQL/injection, auth/authz, frontend XSS, business logic, configuration, dependency, and error-handling vectors.

**Key Findings (11 verified + 7 false positives dismissed)**

### Critical/High Issues Fixed
| ID | Issue | Root Cause | Fix Applied |
|----|-------|-----------|------------|
| BL-RACE-001 | Quota race condition (TOCTOU) | `enforceUsageQuota` reads count in one query, `recordUsage` writes in another — concurrent requests bypass quota | Replaced with atomic CTE query (`atomicQuotaCheckAndInsert`) that checks net usage and inserts in a single statement |
| BL-DAILY-001 | `enforceDailyCeiling` defined but never called | Daily spending limits existed in code but were never wired into profile generation handlers | Added `enforceDailyCeiling` + `incrementDailyCounter` calls in both `profile.js` and `profile-stream.js` |
| BL-ADMIN-001 | Timing attack on admin token | `isAdmin()` used `===` comparison — string compare leaks token length/content via timing | Replaced with constant-time XOR comparison (`constantTimeEqual`) |
| BL-RATELIMIT-001 | Rate limiter fails open | Missing KV binding returns `null`, silently disabling all rate limits | Changed to fail closed — returns 503 with `Retry-After` header |
| BL-RESET-001 | Non-atomic password reset | Password update, token mark-used, and token revocation were 3 separate queries — crash between them leaves token reusable | Wrapped all 3 mutations in a `BEGIN/COMMIT` transaction with `ROLLBACK` on error |

### Medium Issues Fixed
| ID | Issue | Fix Applied |
|----|-------|------------|
| MED-N+1-001 | N+1 query in SMS mass send | Replaced per-user `getUsageByUserAndAction` inside loop with batch `getBatchSmsUsageCounts` query using `user_id = ANY($1)` |
| MED-INLINE-SQL | Inline SQL in webhook handler | Migrated 2 inline `UPDATE users` queries to registered `QUERIES.updateTransitPassExpiry` and `QUERIES.grantLifetimeAccess` |
| MED-PROMO-RATE | Missing rate limit on promo validation | Added `/api/promo/validate: { max: 10, windowSec: 60 }` to `RATE_LIMITS` config |

### Low/Info Issues Fixed
| ID | Issue | Fix Applied |
|----|-------|------------|
| LOW-UI-DATE | Unescaped checkin data in DOM | Wrapped `d.date` and `d.alignmentScore` with `escapeHtml(String(...))` in `ui-nav.js` |

### False Positives Dismissed (7)
Sub-agents flagged these as critical; manual code verification proved them safe:
1. **JWT `alg:none` attack** — `crypto.subtle.verify` with imported HMAC key physically cannot process `alg:none`
2. **Notion OAuth CSRF** — State param is user_id-bound, 10-min expiry, single-use delete-after-read
3. **Practitioner IDOR in PDF** — Query enforces `p.user_id = $1 AND pc.client_user_id = $2` (both IDs checked)
4. **Self-referral exploit** — Explicit `if (referrer.id === user.id)` rejection at line 323 of referrals.js
5. **Promo unlimited redemptions** — SQL WHERE clause enforces both `max_redemptions` and `valid_until`
6. **Promo code expiration bypass** — Same SQL WHERE clause; double-checked in queries.js
7. **Frontend XSS via innerHTML** — All user-facing data already passes through `escapeHtml()` consistently

**Key Learnings**

1. **Sub-agent findings require manual verification** — 50% false positive rate on "critical" findings. Automated scanning without code-level verification leads to panic over non-issues and wastes remediation effort on secure code.

2. **TOCTOU races are invisible in testing** — The quota race condition passed all 292 tests because tests run single-threaded. Race conditions require concurrent request testing or atomic query design from the start.

3. **Dead code is a security liability** — `enforceDailyCeiling` was implemented correctly but never imported/called. Features that exist but aren't wired are worse than missing features — they create false confidence in the security model.

4. **Fail-open defaults are silent killers** — The rate limiter returning `null` on KV failure meant a KV outage would silently disable ALL rate limiting. Critical security middleware must fail closed.

5. **Inline SQL defeats auditability** — The 2 inline queries in webhook.js were invisible to the raw SQL audit that scanned `queries.js`. Centralizing all SQL in one registry makes audits comprehensive.

6. **Constant-time comparison is non-negotiable for secrets** — Even in serverless (sub-ms response times), `===` on secrets is a bad habit that compounds in any environment with observable timing.

**Preventive Measures**
- ✅ All quota enforcement now uses atomic CTE queries (no more check-then-act)
- ✅ All security middleware fails closed by default
- ✅ All admin/secret comparisons use constant-time functions
- ✅ All SQL queries centralized in QUERIES registry (0 inline SQL remaining)
- [ ] Add concurrent request test suite (k6 or artillery) to catch future TOCTOU races
- [ ] Add pre-commit grep for inline SQL outside queries.js (`/await query\(\`/`)
- [ ] Add integration test that simulates KV unavailability to verify fail-closed behavior
- [ ] Establish [DUP] selector cleanup sprint (52 duplicates between app.css and component files)

---

### 2026-03-03 | False Bug Report: Profile Calculation "Incorrect"

**Reported Issue**
User reported that the app calculated profile as `5/1` when the Jovian Archive reference chart showed `1/3` for the same person.

**Investigation Timeline**
1. User provided birth data entry: `08/21/1983, 5:30 PM, Naples FL`
2. App calculated:
   - Profile: **5/1**
   - Type: Manifesting Generator
   - P Sun: Gate 29 Line 5 (148.2512°)
   - D Sun: Gate 20 Line 1 (60.2512°)
3. User provided Jovian Archive PDF: `0921-Human Design Chart (1).pdf`
4. Initially suspected:
   - Wheel offset error (3.875° constant)
   - Gate boundary precision issue
   - Sun longitude calculation drift
5. Extracted PDF text revealed: **`Born: Sep, 21 1983, 17:30`**

**Root Cause**
Date entry error. The user entered **August 21** instead of **September 21**. The PDF filename `0921` indicated the birth date (September 21), not a user ID or chart number.

**Verification**
Running September 21 through the engine produced:
- Profile: **1/3** ✓ (matches Jovian)
- Type: Manifesting Generator ✓
- P Sun: Gate 46 Line 1
- D Sun: Gate 15 Line 3

The calculation engine was **100% accurate** when given correct input data.

**Key Learnings**
1. **Always verify input data first** — Before investigating algorithm accuracy issues, confirm that the user entered the correct birth date/time/location.
2. **Clues in filenames** — The PDF filename `0921-Human Design Chart (1).pdf` was the smoking gun — `0921` = September 21, not August 21.
3. **Verification methodology works** — The dual-anchor approach (AP + Jovian reference charts) immediately isolated the issue to input data rather than engine logic.
4. **Off-by-one-month errors are common** — Users may confuse date formats (MM/DD vs DD/MM) or misread handwritten dates.
5. **Near-boundary cases can be misleading** — The P Sun was at 148.2512°, just 0.0012° past the Gate 29 Line 4/5 boundary (148.25°). This made it _appear_ like a rounding error when it was actually a completely different date.

**Preventive Measures**
- [ ] Add input validation warnings for ambiguous dates (e.g., if day ≤ 12, ask user to confirm MM/DD format) — *tracked in backlog as future UX improvement*

---

### 2026-03-11 | Mobile Cache Transparency, CSS Spec Gotchas, Click-Blocking Overlay

**Context**
Multi-round mobile debugging session. User reported changes were invisible on a Samsung S25 / Dolphin Browser after multiple rounds of fixes and confirmed Cloudflare deployments.

**Key Findings**

1. **`overflow-x: clip` + `overflow-y: visible` coerces both axes to `clip`**
   - CSS spec: if either overflow axis is `clip` and the other is `visible`, the `visible` is promoted to `clip` automatically
   - Effect: the `<header>` still clipped the language-switcher dropdown even after the "fix"
   - Fix: use `overflow: visible` to allow the dropdown to bleed outside the header boundary

2. **Decorative overlay blocked all pointer events on the header**
   - `div.geometric-bg` used `position: absolute; inset: 0` with NO `pointer-events: none`
   - It sat directly in the header stacking context, intercepting all mouse/touch events
   - The hamburger button was visually present but completely unclickable
   - Fix: always add `pointer-events: none` to decorative/background elements that use full-bleed positioning

3. **"Clear Cache" in mobile browsers does NOT clear Service Worker cache**
   - Browser HTTP cache and SW `caches.open(...)` storage are two completely separate systems
   - Clearing the browser cache leaves the SW cache intact; the SW continues intercepting requests and serving stale files
   - The only reliable fixes are: bump `CACHE_VERSION` (to trigger SW reinstall), or go to browser Settings → Site Data → Clear All

4. **Service worker version bumps are useless if the SW file itself is CDN-cached**
   - Cloudflare Pages was serving `service-worker.js` with `Cache-Control: max-age=14400` (4-hour CDN cache)
   - This meant mobile browsers wouldn't even fetch the new SW for up to 4 hours after deployment
   - The browser SW spec says to bypass HTTP cache for SW scripts, but third-party browsers (Dolphin, Samsung Internet, older Webviews) may not honor this
   - Fix: add an explicit `_headers` rule: `/service-worker.js → Cache-Control: no-cache, no-store, must-revalidate`

5. **Dolphin Browser uses an older Blink fork**
   - Does not reliably honor the SW HTTP cache bypass that Chrome enforces
   - Test mobile UX with both Chrome Mobile and Dolphin/Samsung Internet before declaring fixes complete

**Key Learnings**
1. **`overflow: visible` not `overflow-x/overflow-y` when you need one axis to clip and one to overflow** — The spec coercion makes mixed values unpredictable.
2. **`pointer-events: none` is mandatory on decorative full-bleed elements** — Any `position: absolute/fixed; inset: 0` element without this is a UX landmine.
3. **Service worker must be served with `no-store`** — Add this to `_headers` on day one, not as a hotfix.
4. **Separate the 3 cache layers mentally: CDN → Browser HTTP → Service Worker** — Each layer must be explicitly managed. Only bumping SW version does nothing if the CDN is caching the SW file itself.
5. **Version bump convention: comment the SW version change inline with the fix reason** — Makes it traceable: "v16 - Mobile fixes: [description]".

**Preventive Measures**
- ✅ Added `/service-worker.js → Cache-Control: no-cache, no-store` to `frontend/_headers`
- ✅ SW version bumped to `v16` with inline comment describing reason
- [ ] Add deployment checklist item: "Bump SW version for any CSS/JS/HTML change"
- [ ] Test on Dolphin + Samsung Internet before closing any mobile UX ticket
- [ ] Display calculated birth data summary before final chart generation: "Confirm: Born on **[Day of Week], [Month Name] [Day], [Year]** at [time]?" — *tracked in backlog as future UX improvement*
- [ ] Add "Compare with Jovian Archive" feature: allow users to upload a reference PDF and auto-extract the birth data for comparison — *deferred: requires PDF parsing library*
- [ ] Show P/D Sun positions in degrees alongside gate/line for power users (helps spot gross errors) — *low effort, can add to chart response*

---

### 2026-03-03 | Full Codebase Audit — 26 Issues Found

**Trigger**
Full review of entire codebase, all documentation, tests, and data files prior to production readiness assessment.

**Findings Summary**

| Severity | Count | Key Theme |
|---|---|---|
| Critical | 6 | Broken DB driver, dead code, CORS blocks, schema drift, math bugs |
| Moderate | 14 | Missing endpoints, security gaps, data completeness, code duplication |
| Minor | 10 | Inconsistencies, hardcoded values, polish |

**Top 3 Systemic Issues Discovered**

1. **The Neon DB driver doesn't use the real Neon HTTP API** (BL-C1). `neonQuery()` in `queries.js` sends requests to an endpoint pattern that doesn't exist. Every database-dependent feature — auth, chart saving, profiles, practitioners, clusters, SMS — silently fails. This was never caught because handler tests mock the DB layer and engine tests don't touch the DB at all.

2. **Infrastructure wrappers have bugs the engine tests can't reach.** The calculation engine (Layers 1–7) is excellently tested — 190 tests, two verification anchors, boundary coverage. But the code that _wraps_ the engine (CORS, timezone parsing, data injection, chart persistence) has zero test coverage and contains real bugs: `parseToUTC` produces negative minutes (BL-C6), CORS blocks DELETE methods (BL-C4), `engine-compat.js` only injects 9 of 20+ data files (BL-M12).

3. **Spec/implementation drift.** 7 endpoints documented in API_SPEC.md don't exist in the router. 10+ endpoints in the router aren't in the spec. Rate limit values in the code don't match the spec. The health endpoint hardcodes a wrong version number. This drift happened because the spec was written up-front and not kept updated as implementation evolved.

**Key Learnings**

1. **Test the seams, not just the core** — Engine math tests are thorough, but integration seams (DB queries, timezone conversion, CORS, data injection) are where production failures actually happen. Prioritize adding integration tests for the middleware and DB layers.
2. **Spec-first only works with spec-maintenance** — API_SPEC.md drifted significantly from the actual router. Either generate the spec from the code (e.g., OpenAPI from route definitions) or add a CI check that verifies spec/route alignment.
3. **One migration source of truth** — Having both `migrate.js` and `migrate.sql` with different schemas is a time bomb. Pick one path. Ideally `migrate.sql` is the DDL source and `migrate.js` just executes it.
4. **Audit data injection for serverless** — When code runs in both Node.js (tests) and Workers (production), every data file used at runtime must be explicitly injected via `engine-compat.js`. Add a startup check that validates all expected keys exist in `globalThis.__PRIME_DATA`.

**Backlog Reference**: Full details in [BACKLOG.md](../BACKLOG.md) — items BL-C1 through BL-m10.

---

### 2026-06-25 | Sprint 17 Deep Audit — Schema Drift, Orbital Constants, and Dead Code

**Trigger**
Comprehensive audit of the full codebase and live Neon database using 3 parallel subagents, Neon MCP queries, and targeted manual review. Goal: find and fix all defects, reconcile live DB state with documentation, verify all prior-sprint fixes.

**Findings Summary**

| Severity | Count | Key Theme |
|---|---|---|
| Critical | 3 | Phantom DB columns, zero orbital rates, dead import |
| High | 4 | All verified already fixed in prior sprints |
| Medium | 3 | Test expectations, file clutter, missing sync comments |
| Low | 2 | Geocentric z-component, lifecycle approximation |

**Top 3 Root-Cause Patterns Discovered**

1. **Schema-code drift is silent and cumulative.** Three queries in `queries.js` referenced columns that never existed in the schema: `charts.chart_type`, `charts.authority`, and `profiles.status`. These phantom columns were likely copied from an early schema draft and never validated against the actual `CREATE TABLE` statements. The queries would crash at runtime, but handler tests mock the DB layer, so the failures were invisible.

2. **Zero-rate constants are invisible.** Chiron's orbital elements in `planets.js` had correct epoch values (semi-major axis, eccentricity, inclination) but zero century rates: `a: [13.64838, 0]`, `e: [0.37911, 0]`, `I: [6.93500, 0]`. This means Chiron's position was correct at J2000.0 but degraded for dates further from the epoch. The degradation was sub-degree for modern dates, so it passed all tests — but would have become noticeable for historical or far-future charts.

3. **Pre-existing test failures mask real regressions.** Two tests were already failing before Sprint 17: Mars personality gate (expected 15, actual 12 due to 88.16° being in Gate 12) and transit body count (expected 13, actual 14 after Chiron was added to OUTER_PLANETS). Because these failures predated the current sprint, they could have masked a real regression introduced by code changes. Always fix test expectations immediately when the underlying code is intentionally changed.

**Key Learnings**

1. **Query validation against live schema is essential.** The phantom column bugs would have been caught instantly by running each query against the actual Neon database. Add a CI step (or pre-deploy check) that does `EXPLAIN` on all query constants to verify they parse successfully.

2. **Orbital constants need both epoch and rate.** When adding a new body (like Chiron), don't just get the J2000.0 values — compute or look up the rate of change per century. A zero rate is almost never physically correct. Add a comment on each constant showing the source (JPL, Meeus, etc.) and the valid date range.

3. **Live DB count should be a documented constant.** The architecture doc claimed 49 tables, but the live database had 48 (`usage_tracking` from migration 003 was never created). Periodically run `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'` and update the architecture doc. Now documented with verification date.

4. **Parallel subagent audits are highly effective.** Running 3 subagents simultaneously (engine code, worker/handler code, data/config files) completed a full codebase review in one pass. Each agent returned structured findings with file/line references, enabling rapid triage without re-reading every file.

5. **File hygiene should be a sprint deliverable.** 10 obsolete files accumulated in the project root — one-off debug scripts, status reviews, temp files. A quarterly file-hygiene pass keeps the project navigable and reduces confusion for new contributors or AI agents exploring the codebase.

**Backlog Reference**: Sprint 17 items BL-S17-C1 through BL-S17-L2 in [BACKLOG.md](../BACKLOG.md) and [ARCHITECTURE.md](../ARCHITECTURE.md) §11.

---

### 2026-03-14 | Pre-Production Go/No-Go Audit — 5 Critical Defects Resolved

**Context**
Final multi-vector go/no-go audit before production launch. The then-current test suite was passing at audit start. Audit covered: route auth gaps, DB constraint vs code alignment, Stripe webhook path, env var inventory vs live Cloudflare secrets, CORS policy, error handling information leakage, frontend/API contract, and quota enforcement coverage.

**Findings Summary**

| ID | Severity | Issue |
|---|---|---|
| BL-DBCONSTRAINT-001 | 🔴 Critical | DB `CHECK` constraint blocked new paid subscriber inserts |
| BL-NOAUTH-RECTIFY | 🟠 High | `POST /api/rectify` — zero authentication |
| BL-NOAUTH-CYCLES | 🟠 High | `GET /api/cycles` — zero authentication |
| BL-SMS-KEY | 🟡 Medium | `TELNYX_PUBLIC_KEY` absent from Cloudflare live secrets |
| BL-TIER-EXPLORER | 🟡 Low | Legacy `'explorer'` tier in active conditional in `tierEnforcement.js` |

**Key Findings**

1. **DB CHECK constraint did not include new canonical tier names — new paid subscribers silently failed**
   - Migration `020_fix_subscription_constraints.sql` set `CHECK (tier IN ('free','seeker','guide','regular','practitioner','white_label'))`
   - New canonical tiers `'individual'` and `'agency'` (introduced by HD_UPDATES3) were never added
   - `webhook.js` correctly mapped Stripe price IDs → `'individual'`/`'agency'` and called `QUERIES.upsertSubscription`
   - At runtime, the upsert would fail with a DB constraint violation, leaving the user at free tier permanently
   - Fix: Created migration `030_add_individual_agency_tiers.sql` and applied directly to Neon via MCP transaction
   - **Lesson: Every tier rename must cascade to ALL DB CHECK constraints, not just the application alias map.**

2. **Compute-heavy endpoints had no authentication gate**
   - `POST /api/rectify` runs N×chart calculations (up to 48 iterations for a ±120min window at 5min step)
   - `GET /api/cycles` runs full chart + JDN + transit calculations
   - Neither had `getUserFromRequest` — any anonymous caller could hammer the compute engine
   - Both were in `EXACT_ROUTES` but NOT in `AUTH_PREFIXES`, so the middleware layer skipped them entirely
   - Fix: Added `getUserFromRequest` guard at entry of both handlers
   - **Lesson: After adding a route to `EXACT_ROUTES`, explicitly check if it needs to be in `AUTH_PREFIXES` too. Compute-heavy endpoints are more sensitive than data endpoints.**

3. **`TELNYX_PUBLIC_KEY` is distinct from `TELNYX_API_KEY`**
   - Code used `env.TELNYX_PUBLIC_KEY` for Ed25519 webhook signature verification
   - Secrets file only had `TELNYX_API_KEY` (REST API key, `KEY019C...` prefix) — a different credential entirely
   - All inbound SMS webhooks were being rejected with 401
   - The public key is found in Telnyx portal → Account Settings → Keys & Credentials → Public Key (base64 Ed25519)
   - **Lesson: Telnyx has two separate keys: API key (for outbound API calls) and Public Key (for inbound webhook signature verification). Both must be provisioned.**

4. **Test mocks must be updated when new auth guards are added to handlers**
   - Adding `getUserFromRequest` to `rectify.js` caused 6 existing handler tests to fail with 401
   - The tests called the handler directly without a JWT token
   - Fix: Added `vi.mock('../workers/src/middleware/auth.js', ...)` alongside the existing `tierEnforcement` mock
   - **Lesson: When adding auth to a handler that has direct-call tests, add the corresponding auth mock to the test file in the same commit. Auth guards break test isolation by design.**

5. **`seeker` and `regular` legacy tier names were missing from the agency seat propagation guard**
   - `tierEnforcement.js` line 56: `if (tier === 'free' || tier === 'individual' || tier === 'explorer')`
   - Users with historical `seeker` or `regular` rows in the DB would not get agency seat tier propagation
   - Fix: Expanded to include all legacy free/individual-equivalent tier names
   - **Lesson: When adding legacy alias handling anywhere in the codebase, audit ALL tier-conditional branches — not just the billing and config layers.**

6. **Frontend/API contract audit confirmed 100% coverage — 36 routes all resolve**
   - Routes appearing "MISSING" from EXACT_ROUTES match (`/api/validation/save`, `/api/psychometric/save`, `/api/share/celebrity`, `/api/timing/find-dates`) are all served via AUTH_PREFIXES prefix delegation
   - **Lesson: Route contract checks must account for both EXACT_ROUTES and PREFIX/PATTERN routes. A simple string match against EXACT_ROUTES is insufficient.**

**Resolution**
- Migration `030_add_individual_agency_tiers.sql` created and applied to live Neon DB
- `TELNYX_PUBLIC_KEY` pushed to Cloudflare via `wrangler secret put`
- Auth guards added to `rectify.js` and `cycles.js`
- Legacy tier names expanded in `tierEnforcement.js`
- Auth mock added to `handlers.test.js`
- All 302 tests passing post-fix

**Preventive Measures**
- [ ] When any tier name changes: grep ALL source files for old value as string literal AND audit all DB CHECK constraints
- [ ] New `EXACT_ROUTES` entries: check whether they need to be in `AUTH_PREFIXES` before merging
- [ ] All compute-heavy endpoints (multiple engine calls per request) must require authentication at minimum
- [ ] Telnyx checklist: provision both `TELNYX_API_KEY` (outbound) AND `TELNYX_PUBLIC_KEY` (inbound webhook signing) for any new deployment
- [ ] When adding auth guards to handlers with direct-call tests: update auth mock in same commit

---

### 2026-03-15 | Neon MCP for Migration Verification & Secret Deployment

**Context**
During launch-prep audit, 31 DB migrations needed verification. Manual DB access not required — Neon MCP tool (`mcp_neon_run_sql`) provides direct query access to production DB from the AI agent session. Similarly, two Cloudflare Workers secrets (`RESEND_API_KEY`, `SENTRY_DSN`) were confirmed missing and pushed via wrangler.

**Key Lessons**
- **Neon MCP removes "manual migration" as a blocker.** Use `SELECT * FROM schema_migrations ORDER BY id` to check applied migrations. Use `mcp_neon_run_sql_transaction` to apply missing ones atomically. No psql CLI access needed.
- **Use `printf '%s' '...'` (not `echo`) for `wrangler secret put`** when the secret value contains `+`, `=`, or other shell-special characters. `echo` can mangle these on some shells.
- **Verify wrangler output is from the right terminal.** Use non-background `run_in_terminal` with explicit `echo "EXIT:$?"` at the end to confirm success/failure. Background terminals can return stale output from previous commands.
- **Before marking a secret-related backlog item as "pending deploy":** first check if the secret upload was already done. `npx wrangler secret list` shows currently active secrets without revealing values.

**Preventive Measures**
- [ ] After any new migration SQL file is added: run `SELECT id FROM schema_migrations WHERE id = 'NNN'` via Neon MCP to confirm it applied to prod
- [ ] Store new secrets in the `secrets` file immediately after obtaining them; push to Cloudflare in same session
- [ ] When `wrangler secret put` is part of a launch checklist, run `npx wrangler secret list` afterward to confirm the key appears

---

### 2026-03-15 | Sentry Auth Token vs DSN + Try/Catch Missing Closing Brace

**Context**
Two separate issues discovered during a Sentry configuration audit: the wrong type of Sentry credential was stored as `SENTRY_DSN`, and two handlers (`analytics.js`, `onboarding.js`) had missing closing braces that caused a build failure.

**Key Lessons**
- **Sentry has two different credential types** — do not confuse them:
  - **DSN** (`https://<key>@oXXXXX.ingest.us.sentry.io/<projectId>`) — what the SDK uses to send events. Found in *Settings → Projects → SDK Setup → Client Keys (DSN)*.
  - **Auth Token** (`sntrys_...`) — for the Sentry API and CI integrations. Found in *Settings → Auth Tokens*.
  - Storing an auth token as `SENTRY_DSN` causes `new URL()` to succeed but `parseDSN()` to return wrong values, silently breaking all error capture.
- **Always add try/catch around `new URL(dsn)` in DSN parsers.** An invalid DSN that hits `parseDSN` synchronously (at module scope or during `initSentry`) will crash the entire Worker, turning a monitoring misconfiguration into a full service outage.
- **When adding try/catch to a function body, always check the closing brace count.** Adding a `try {` block inside an existing function body requires either wrapping the entire body or carefully balancing braces. In this session, try/catch was added without including the function's final `}`, leaving each function with one unclosed brace. This passed editor syntax checks but failed at esbuild time.
- **Build errors that say "Unexpected end of file" at the last line of a file** almost always mean a missing `}` — verify with `python3 -c "text=open(f).read(); print(text.count('{') - text.count('}'))"`.

**Preventive Measures**
- [ ] After adding try/catch blocks: count brace diffs with the one-liner above before committing
- [ ] Before `wrangler deploy`: run `node --input-type=module < src/handlers/file.js` to catch parse errors without waiting for esbuild
- [ ] When storing Sentry credentials: paste the value starting with `https://` — if it starts with `sntrys_` it's an auth token, not a DSN

---

### Verification Anchors

**Current Anchors**
1. **AP** (Aug 5, 1979, 22:51 UTC, Tampa FL)
   - Profile: 6/2, Type: Projector
   - Full gate verification across all 9 planets + nodes
2. **0921** (Sep 21, 1983, 21:30 UTC, Naples FL) — added post-incident
   - Profile: 1/3, Type: Manifesting Generator
   - Cross-validated against Jovian Archive

**Why Multiple Anchors Matter**
- AP is a **6-line personality Sun** (boundary test: Gate 33 Line 6)
- 0921 is a **1-line personality Sun** (start-of-gate boundary)
- Together they cover high/low line boundaries and two different types

### Gate Boundary Precision

**Critical Constants**
- `WHEEL_OFFSET = 3.875°` — Do not modify without recalibrating both anchors
- `DEG_PER_LINE = 0.9375°` — Each line spans 56.25 arcminutes

**Floating-Point Precision**
JavaScript's `Number` (IEEE 754 double) provides ~15 decimal digits of precision. For gate/line calculations:
- Sun longitude precision: ±0.0001° is sufficient (±0.36 arcseconds)
- Line boundaries: nearest 0.0001° eliminates ambiguity for all practical birth times
- Edge case: A person born during a line transition (±0.0005°) may get different results from different calculators due to rounding. This is < 2 seconds of time, which is within measurement error of most birth certificates.

### Testing Strategy

**Unit Tests**
- Each engine layer has dedicated tests (`tests/engine.test.js`)
- AP anchor verified at every layer (JDN → Sun → Planets → Gates → Chart → Astro)
- Boundary conditions: 0°, 360°, gate transitions, line transitions

**Integration Tests**
- Full chart workflow (`tests/handlers.test.js`)
- API endpoints tested with realistic payloads
- Auth, validation, error handling

**Regression Tests**
When a "bug" is reported:
1. Add the failing case as a test (even if it's actually user error)
2. Verify with reference data (Jovian, astro.com, etc.)
3. Leave the test in place as a known-good anchor

---

## Common Debugging Patterns

### Profile Mismatch
**Symptoms**: User reports profile X/Y but expects A/B

**Checklist**
1. Verify birth date (MM vs DD confusion, month off-by-one)
2. Verify birth time (12-hour vs 24-hour, AM/PM flip)
3. Verify timezone (EST vs EDT, user's stated timezone vs actual DST rules)
4. Check if user provided _local_ time but app expected UTC (or vice versa)
5. Only after input verification → check P Sun line and D Sun line separately

### Type Mismatch
**Symptoms**: Generator vs Manifesting Generator, Projector vs Manifestor

**Root Causes**
- **Sacral defined vs undefined** — Most common. Check gates 3,5,9,14,27,29,34,42,59. If any channel activates Sacral, type ≠ Projector.
- **Motor-to-Throat connection** — Determines Manifestor vs Projector (if Sacral undefined). Motors = {Heart, Solar Plexus, Root, Sacral}. Trace channels from Throat → motors.

### Cross Mismatch
**Symptoms**: Wrong cross name or cross type (Right vs Left vs Juxtaposition)

**Root Cause**
Cross type is determined solely by **P Sun line**:
- Line 1,2 → Right Angle
- Line 3 → Juxtaposition
- Line 4,5,6 → Left Angle

If cross type is wrong, the P Sun line is wrong → check P Sun gate/line → check birth date/time.

---

## Engine Accuracy Validation

### Comparison with Reference Calculators

**Primary References**
1. **Jovian Archive** — Original HD source, most trusted
2. **MyBodyGraph** — Commercial HD charts, generally accurate
3. **GeneticMatrix** — Another commercial tool

**Methodology**
1. Generate chart in Prime Self
2. Generate chart in reference tool using _identical_ birth data
3. Compare:
   - P Sun gate/line
   - D Sun gate/line (most critical for profile)
   - Type, Authority, Profile
   - Active channels (order may vary, set comparison)
4. Accept ±1 line difference only if birth time uncertainty is > 2 hours

**Known Differences**
- **Pluto ephemeris**: Some calculators use truncated VSOP87 (like ours), others use JPL DE440. Difference is ~0.02° (negligible for gate-level accuracy).
- **Moon**: Our 50-term truncated Meeus ELP2000 is accurate to ~0.3°. Professional tools may use full ELP2000-82B (±0.01°). This rarely affects gate assignment but can affect line in fast-moving Moon scenarios.
- **Wheel offset**: We use 3.875° (3°52'30"). Some tools use 3.83° or 3.9°. Verify with both AP and 0921 anchors before changing.

---

## Deployment Gotchas

### Timezone Handling
The `parseToUTC` utility uses `Intl.DateTimeFormat` to determine timezone offsets. This works in:
- Node.js (full IANA tz database)
- Cloudflare Workers (limited but includes all common zones)
- Browsers (varies — Safari, Chrome, Firefox all support IANA zones)

**Edge Case**: Historical dates before 1970 may have incorrect DST rules in some runtimes. Always confirm against an authoritative source (e.g., timeanddate.com) for births before 1970.

### KV Cache Invalidation
Geocode results are cached for 30 days in Workers KV. If a city's coordinates change (rare but possible for small towns), the cache must be manually purged:
```bash
npx wrangler kv key delete "geo:city name" --namespace-id <id>
```

---

## Future Improvements

### Input Validation Enhancements
- [ ] Add "reverse geocode" — after user enters lat/lng, show the city name to confirm
- [ ] Show day-of-week for birth date (helps catch month errors: "You were born on a Wednesday" → user can verify)
- [ ] Timezone suggestion based on geocode result
- [x] Validate IANA timezone strings before passing to `Intl.DateTimeFormat` — return 400 on invalid (BL-m7) — *Done 2026-03-04*
- [x] Basic email format validation on registration (BL-m10) — *Done 2026-03-04*

### Chart Comparison Tool
- [ ] Allow users to upload a Jovian/MyBodyGraph PDF
- [ ] Auto-extract birth data + chart results from PDF
- [ ] Highlight differences between Prime Self calculation and reference

### Enhanced Debugging
- [ ] Add `/api/debug/chart` endpoint (auth required) that returns:
  - Raw JDN, Sun longitude, all planetary positions
  - Gate index, line offset, color, tone, base for P/D Sun
  - Full channel activation logic trace
- [ ] Log every chart calculation to DB with input hash (detect repeated errors)

### Infrastructure Hardening (from 2026-03-03 audit)
- [x] Fix Neon DB driver to use official `@neondatabase/serverless` package (BL-C1) — *Done 2026-03-04*
- [ ] Add integration tests for middleware (CORS, rate limiting, auth) (backlog: test gaps)
- [ ] Add integration tests for DB query layer (backlog: test gaps)
- [x] Consolidate migration path to single source of truth (BL-C3) — *Done 2026-03-04*
- [x] Add startup validation for `globalThis.__PRIME_DATA` in Workers (BL-M12) — *Done 2026-03-04*
- [ ] Generate API spec from route definitions or add CI check for drift (BL-M1)

---

## Appendix: Reference Birth Data

### Known-Good Test Cases

| Name | Birth Date/Time | Location | Profile | Type | Notes |
|---|---|---|---|---|---|
| **AP** | Aug 5, 1979, 22:51 UTC | Tampa FL | 6/2 | Projector | Primary anchor, all tests run against this |
| **0921** | Sep 21, 1983, 21:30 UTC | Naples FL | 1/3 | MG | Jovian Archive verified, added Mar 2026 |

Both cases are committed to the repository as PDFs in the project root:
- `Ap-Human Design Chart (1).pdf` (AP anchor)
- `0921-Human Design Chart (1).pdf` (0921 case)

---

---

## 2026-03-06 | Strategic Product-Market Fit Analysis

**Trigger**
Comprehensive codebase review to identify missed opportunities and strategic gaps.

**Key Findings**

### Critical Gap: Built Engine, Not Vehicle
The platform has production-ready calculation accuracy (190 passing tests, dual verification anchors) and sophisticated AI synthesis. But monetization and distribution are entirely missing:

- **Revenue infrastructure**: Tier system exists in code but no Stripe integration, no checkout flow, no upgrade UI
- **Market presence**: Not listed on any API marketplaces despite being API-first
- **Distribution**: No mobile app, no PWA, no integrations ecosystem
- **Engagement loops**: No viral sharing, no push notifications, no retention mechanics

**Impact**: Studio tier ($149/mo) now purchasable with Plan v4 pricing. GTM execution remains the gap.

---

### Discovery: Three Products, No Primary Focus

Documentation reveals three distinct product visions:
1. **Consumer SaaS** (Prime Self philosophy, $12/mo Explorer tier)
2. **Practitioner B2B** ($60-149/mo, client roster management)
3. **API/Infrastructure** (white-label for developers)

**Problem**: Trying to serve all three dilutes execution. Each requires different acquisition, messaging, and feature priorities.

**Analysis**:
- Consumer SaaS: Crowded market (Co-Star, The Pattern), requires brand + community + viral mechanics. Capital intensive.
- Practitioner B2B: Clear willingness to pay ($200-500/session), defensible moat (calculation accuracy), lower CAC.
- API/Infrastructure: Aligns with serverless expertise, B2B economics, but requires developer marketing.

**Recommendation**: **Focus on Practitioner B2B first** for:
- Immediate revenue potential (practitioners already paying competitors)
- Lower customer acquisition cost (niche, high-intent buyers)
- Defensible moat (accurate calculation + AI synthesis = hard to replicate)
- Foundation for white-label API offering (practitioners become distributors)

After establishing practitioner revenue, layer in consumer features as viral distribution from practitioners to their clients.

---

### Mobile-First Market Reality

Astrology/self-development market is mobile-dominant:
- Co-Star: Mobile-first, 10M+ users
- The Pattern: iOS/Android only, viral through app sharing
- Sanctuary: Mobile chat interface, $30M funding

Prime Self is desktop web-only:
- No PWA (Progressive Web App)
- No native mobile apps
- No push notifications
- No offline capability

**Opportunity Cost**: Missing 70%+ of addressable market.

**Quick Win**: Convert to PWA (1-2 days) captures 80% of mobile value for 5% of native app effort. Add push notifications for daily transits = retention multiplier.

---

### Integration Ecosystem = Practitioner Automation

Practitioners manage 20-100 clients manually. Prime Self could automate their entire workflow but lacks:
- Zapier/Make.com integration (automate "new client → generate chart → send email")
- Notion/Airtable sync (CRM integration)
- Calendar integration (optimal timing for sessions)
- Embeddable widgets (chart calculator on practitioner websites)
- Webhook system (custom automation triggers)

**Market Insight**: Practitioners pay for inferior tools. Acuity Scheduling ($20-50/mo) has calendar + payments but no HD integration. MyBodyGraph ($300/yr) has charts but no client management. Prime Self could own the full workflow.

---

### Analytics Blindness

Zero visibility into:
- User behavior (which features actually get used?)
- Conversion funnels (where do people drop off?)
- Error rates (what breaks in production?)
- Feature impact (does X drive retention?)

**Result**: Flying blind on product decisions. No way to measure impact of new features. No A/B testing framework.

**Critical Need**: Add event tracking (Posthog or simple analytics table) before building more features. Only build what moves metrics.

---

### Technical Excellence, Business Naiveté

**Strengths**:
- Calculation engine: A+ (verified against Jovian Archive)
- AI synthesis: A+ (grounded, contextual, non-derivative)
- Infrastructure: A+ (serverless, edge-native, zero cold start)
- Documentation: A+ (comprehensive, well-organized)

**Gaps**:
- Monetization: F (not implemented)
- Distribution: F (no channels)
- Marketing: F (no content, no SEO, no community)
- Analytics: F (no tracking)
- Mobile: F (web-only)

**Lesson**: Engineering excellence ≠ business success. A technically perfect product with no GTM is a hobby project.

---

## Key Learnings

### 1. Build for One Customer First
**Before**: Trying to serve consumers, practitioners, and developers simultaneously.  
**After**: Pick practitioner B2B as beachhead market. Win there, then expand.  
**Rationale**: Focus wins. Diffusion fails.

### 2. Monetization is Infrastructure, Not a Feature
**Before**: Treat billing as "later" work.  
**After**: Stripe integration is Week 1 priority.  
**Rationale**: Revenue validates product-market fit. Free users validate curiosity.

### 3. Mobile is Not Optional
**Before**: "Desktop works fine, mobile can wait."  
**After**: PWA is Week 3 deliverable.  
**Rationale**: Market is mobile-first. Desktop-only = invisible to 70% of users.

### 4. Distribution > Product
**Before**: Focus on adding more calculation features.  
**After**: Focus on API marketplaces, integrations, viral loops.  
**Rationale**: Best product with no distribution loses to mediocre product with distribution.

### 5. Analytics Before Features
**Before**: Add features based on intuition.  
**After**: Track usage, run experiments, iterate on data.  
**Rationale**: Opinions are cheap. Data is expensive and accurate.

### 6. Practitioners are Distributors, Not Just Customers
**Before**: Sell to practitioners for their own use.  
**After**: Enable practitioners to serve their clients through Prime Self (white-label).  
**Rationale**: Each practitioner has 20-100 clients. 100 practitioners = 2,000-10,000 end users.

### 7. Attention is the Scarce Resource
**Before**: Long, dense profiles assumed engagement.  
**After**: Push notifications, daily digests, brief insights win attention.  
**Rationale**: Depth without frequency = forgotten. Daily touch points = habit formation.

---

## Preventive Measures & Action Items

### Immediate (Week 1-2)
- [ ] Implement Stripe checkout and subscription management (BL-REV-001 through BL-REV-004)
- [ ] Convert frontend to PWA with manifest and service worker (BL-MOB-001)
- [ ] Add basic event tracking (analytics_events table) (BL-ANA-001)
- [ ] Begin practitioner case study collection for social proof

### Short-term (Week 3-6)
- [ ] List API on RapidAPI marketplace (BL-INT-001)
- [ ] Implement push notification system (BL-MOB-002)
- [ ] Build Zapier integration (BL-INT-003)
- [ ] Create embeddable chart widget (BL-INT-004)
- [ ] Launch email drip campaigns (BL-ENG-007)

### Medium-term (Week 7-12)
- [ ] Build transit alert system (BL-ENG-001)
- [ ] Add celebrity comparison feature (BL-ENG-004)
- [ ] Implement referral program (BL-REV-007)
- [ ] Create analytics dashboard (BL-ANA-002)
- [ ] WordPress plugin development (BL-INT-005)

### Strategic
- [ ] Define primary customer segment (practitioner B2B recommended)
- [ ] Create GTM playbook based on chosen segment
- [ ] Build marketing funnel (awareness → trial → conversion)
- [ ] Establish success metrics (MRR, retention, viral coefficient)
- [ ] Develop content strategy (SEO, thought leadership)

---

## Architecture Decisions from Analysis

### ADR-007: Practitioner-First Go-to-Market Strategy
**Date**: 2026-03-06  
**Status**: Proposed  
**Context**: Three potential customer segments competing for resources.  
**Decision**: Focus on practitioner B2B as primary beachhead market.  
**Rationale**:
- Practitioners have proven willingness to pay ($200-500/session)
- Lower CAC than consumer acquisition
- Defensible moat (accurate calculation + AI synthesis)
- Each practitioner serves 20-100 clients (distribution multiplier)
- Aligns with existing white-label API infrastructure

**Consequences**:
- Positive: Clear product roadmap, focused marketing, measurable B2B metrics
- Negative: Consumer features deprioritized (may miss viral consumer opportunity)
- Mitigation: Enable practitioners to serve consumers through white-label (practitioners become distribution)

### ADR-008: PWA Before Native Mobile Apps
**Date**: 2026-03-06  
**Status**: Proposed  
**Context**: Mobile market dominance but limited engineering resources.  
**Decision**: Build Progressive Web App before investing in native iOS/Android.  
**Rationale**:
- PWA captures 80% of mobile value with 5% of native app effort
- Push notifications work on Android PWA and iOS 16.4+
- Offline capability via service workers
- No app store approval delays
- Can iterate faster than native

**Consequences**:
- Positive: Mobile-enabled in 1-2 weeks, cross-platform by default
- Negative: Slightly inferior UX vs native (no access to some device APIs)
- Future: Build native apps only if PWA adoption proves insufficient

### ADR-009: Event Tracking Before New Features
**Date**: 2026-03-06  
**Status**: Proposed  
**Context**: No visibility into user behavior or feature impact.  
**Decision**: Implement analytics infrastructure before building more features.  
**Rationale**:
- Cannot optimize what you don't measure
- Feature decisions currently based on intuition, not data
- Need to identify what drives retention, conversion, revenue
- A/B testing requires event tracking foundation

**Consequences**:
- Positive: Data-driven product decisions, faster iteration, measurable impact
- Negative: 3-5 day investment before shipping visible features
- Implementation: Simple events table + track() utility, not full analytics platform yet

---

## 2026-03-08 | Phase 3 Complete: All TODO Items Resolved

**Trigger**
Comprehensive resolution of 11 remaining TODO items across `workers/src/` that were blocking feature completeness and data accuracy.

**Work Summary**

All 11 TODO items successfully implemented and tested (190/190 test suite passing):

| # | Feature Area | Implementation Detail | User-Facing Impact |
|---|---|---|---|
| 1-3 | Achievements | Per-achievement progress `{current, target, percentage}` + push notifications | Users see tangible progress toward unlocks; real-time engagement notifications |
| 4 | Retrograde Detection | Replaced orbital period estimate with real ephemeris engine (`getAllPositions`) | Accurate retrograde status for S4 features (timing recommendations, transit alerts) |
| 5-6 | Web Push (RFC 8291) | Full VAPID implementation: ECDSA JWT + ECDH key agreement + HKDF + AES-128-GCM encryption + quiet hours | Production-ready push; respects user sleep schedules globally via timezone-aware silencing |
| 7 | Billing Failure Emails | Stripe webhook failures now send branded HTML emails with payment portal CTA | Users aware of failed payments; reduces support tickets |
| 8-9 | Referral Rewards | Stripe balance credit ($15) on conversion + push notification to referrer | Automated referral incentive; encourages word-of-mouth growth |
| 10-11 | Alert Evaluation | Aspect evaluation (angular separation + orb) + cycle evaluation (planetary returns/oppositions) | Practitioners can set precise alerts (e.g., notify when Mercury opposes natal Sun) |
| Bonus | Diary Integration | Live transit correlation: calculates full transit snapshot for diary event dates | Users discover patterns (life events ↔ planetary cycles) |

**Systemic Impact**
- **Feature completeness**: Phase 2 (security/D1→Neon migration) + Phase 3 (feature implementation) = all handlers now have active business logic rather than stubs
- **Test coverage**: Stable 190/190 (100%) across all layers
- **Code quality**: Zero TODOs remaining; all import paths corrected

---

## Technical Breakthroughs in Phase 3

### 1. Web Crypto API as Cloudflare Standard

**Evolution**
- Phase 1: Used Node.js-specific `crypto.createHmac`, `crypto.randomBytes`
- Phase 2: Migrated to Web Crypto API (`crypto.subtle.*`, `crypto.getRandomValues`)
- Phase 3: Implemented RFC 8030/8291 Web Push encryption **entirely in Web Crypto** (no external libraries)

**Key Insight**: Cloudflare Workers has first-class support for Web Crypto. All cryptographic operations should use Web Crypto, not `node:crypto`. This eliminates compatibility shims, dependency bloat, and runtime edge environment failures.

**Pattern Discovery**:
```javascript
// ✓ Fire-and-forget side effects for non-critical path
sendNotificationToUser(env, userId, 'achievement', {...})
  .catch(err => console.error('Push failed:', err));  // logged but doesn't block response

// ✗ Don't await third-party services on critical path
await sendNotificationToUser(...);  // user waits for push service ← BAD for UX
```

**Recommendation**: Add requirement to ARCHITECTURE.md: "All cryptographic operations in workers/src/ must use Web Crypto API. No Node.js crypto imports."

---

### 2. Ephemeris Engine Reuse Pattern

**Discovery**
The project has two planetary calculation systems:
- **src/engine/planets.js** — Highly accurate (60+ lines, JPL Keplerian + Meeus, verification-tested)
- **workers/src/handlers/timing.js (old)** — Simplified orbital period placeholder

**Phase 3 Unification**
Handlers now import and call engine functions directly:
- `timing.js`: Retrograde detection uses `getAllPositions(jd)` (real ephemeris)
- `diary.js`: Transits via full `getCurrentTransits(natalChart, natalAstro, jdn)`
- `alerts.js`: Aspect/cycle evaluation compares real transit planets to natal positions

**Key Insight**: Placeholder code creates silent accuracy gaps. Users discover the gaps weeks later when they file support tickets ("why did the app say Mercury is direct when it's actually retrograde?"). Never commit placeholder code. Stub to error if the feature isn't ready, not to a guess.

**Preventive Pattern**:
```javascript
// ✓ Stub to error (discoverable)
export function calculateSomething(...) {
  throw new Error('calculateSomething not yet implemented');
}

// ✗ Stub to guess (silent failure)
export function calculateSomething(...) {
  return estimate;  // User gets wrong answer; doesn't know it's wrong
}
```

---

### 3. Async Boundaries: Fire-and-Forget Pattern

**Problem Encountered**
Phase 3 added several asynchronous side effects:
- Push notifications (external service, variable latency)
- Email sends (external service, 100-500ms)
- Stripe API calls (external service, may timeout)

Risk: If awaited in request handlers, slow third-party services could cause user-facing timeouts.

**Solution Applied**
All non-blocking side effects use **fire-and-forget with error handling**:

```javascript
// Correct: Non-blocking side effects
sendNotificationToUser(env, userId, 'achievement', {...})
  .catch(err => console.error('Notification failed:', {...}));

// Risky: Blocking side effect
await sendNotificationToUser(...);  // User waits
```

**Rules of Thumb**:
1. **Critical path** (auth, validation, database writes) — must await, must handle errors
2. **Non-blocking side effects** (notifications, emails, webhooks) — fire-and-forget, log errors
3. **Audit trail** (analytics, logging) — fire-and-forget, no catch needed

**Recommendation**: Document in OPERATION.md as "Side Effect Patterns for Cloudflare Workers."

---

### 4. Timezone-Aware Features Need Comprehensive Testing

**Implementation**: Quiet hours enforcement uses `Intl.DateTimeFormat(... {timeZone: userTz})` conversion.

**Works Across**: Node.js, Cloudflare Workers, modern browsers (with variations).

**Test Coverage Needed**:
- Historical dates (DST rule changes differ by year and region)
- Time zone boundaries (e.g., crossing midnight during DST transition)
- Non-standard zones (e.g., Asia/Kolkata at +5:30, India/Keralam at +5:30)
- Fallback on invalid timezone string (should default to UTC or user pref)

**Code Pattern**:
```javascript
const userHour = parseInt(
  new Intl.DateTimeFormat('en-US', { 
    hour: 'numeric', 
    hour12: false, 
    timeZone: prefs.timezone 
  }).format(now)
);
const inQuietHours = start <= end 
  ? (userHour >= start && userHour < end) 
  : (userHour >= start || userHour < end);  // Overnight range support
```

---

### 5. Import Path Consistency is Critical

**Issue Found During Phase 3 Testing**
Five handler files imported from stale path `../db/neon.js` which doesn't exist. The correct path is `../db/queries.js`. This was a naming artifact from the D1→Neon migration (Phase 2) and caused all handler tests to fail.

**Root Cause**: D1→Neon migration renamed files but didn't update all import statements atomically.

**Files Fixed**:
- `handlers/push.js`
- `handlers/notion.js`
- `handlers/alerts.js`
- `handlers/keys.js`
- `handlers/webhooks.js`

**Prevention**:
1. Add "find unused imports" to CI (eslint-plugin-unused-imports or tsconfig strict mode)
2. Test imports by running build in clean environment (no local aliases)
3. Require zero stale imports before PR merge
4. Use `grep` to verify old patterns don't exist post-migration

**Impact**: Test suite went from **failed** → fixed imports → **190/190 passing**.

---

## Systemic Learnings from Phase 3

### Learning 1: Placeholder Code = Undetected Bugs
**Before**: Simplified orbital period calculation in `timing.js`  
**After**: Replaced with real ephemeris (`getAllPositions`)  
**Lesson**: Inaccuracy is worse than unavailability. If a feature isn't ready, throw an error (discoverable) rather than return a guess (silent failure).

### Learning 2: Complex Protocol Implementation Needs Real-World Tests
**Implementation**: RFC 8291 Web Push encryption (VAPID JWT, ECDH, HKDF, AES-GCM).  
**Discovery**: Unit tests are insufficient. Cryptographic + protocol-based features need:
- Compliance validation (does encrypted payload match RFC 8291 format?)
- Integration tests with real push services (or comprehensive mocks)
- Security audit of key derivation and nonce handling

**Lesson**: Add 2-3 real-world test cases (actual push service delivery, actual Stripe credit application) before shipping integration features.

### Learning 3: Feature Implementation Checklist

Every new feature shipped requires:
1. **Code implementation** ✓ (Phase 3 done)
2. **Test coverage** ✓ (190/190 passing)
3. **API spec update** ← Often forgotten
4. **Database schema comments** ← Often forgotten
5. **CHANGELOG entry** ← Often forgotten

**Recommendation**: Create "Feature Implementation Checklist" template in PR template.

### Learning 4: Referral Systems Need Fraud Prevention

**Phase 3 Blind Spot**: Current referral system doesn't validate that the referred user actually clicked the referral link. Theoretically:
1. User generates referral code
2. User signs up via different channel (organic, ad, direct)
3. User applies referral code retroactively  
4. User claims $15 credit

**Future Work**: Track `utm_source` or `ref_code` in signup flow. Validate that referred user actually followed referral link before allowing credit claim.

### Learning 5: Engagement Features Without Respect Mechanics = Churn

**Implementation**: Push notification system was implemented correctly.  
**Key Detail**: Quiet hours enforcement (don't spam 3 AM) was implemented in parallel.  
**Insight**: Many features prioritize engagement over UX. Respect-the-user mechanics (do not disturb, rate limiting, unsubscribe) compound into retention. Implement respect features at same time as engagement features, or lose trust.

---

## ADRs from Phase 3

### ADR-010: Web Crypto as Standard for All Cryptographic Operations

**Date**: 2026-03-08  
**Status**: Accepted  
**Context**: Phase 2/3 migrated crypto operations from Node.js `crypto` to Web Crypto API.  
**Decision**: All future cryptographic operations in `workers/src/` must use Web Crypto API exclusively.  
**Rationale**:
- Universal support (Node.js, Cloudflare Workers, browsers)
- Eliminates compatibility shims and dependency bloat
- Aligns with Edge Runtime paradigm

**Consequences**:
- Positive: Consistent patterns, reduced dependencies, edge-compatible
- Negative: Slightly more verbose (`.subtle.*` async + imports)
- Enforcement: ESLint rule + CI check

**Implementation Note**: HMAC, hashing, ECDSA signing, ECDH key agreement, random generation all work in Web Crypto. No Node.js crypto needed.

### ADR-011: Placeholder Code is Debt, Not Future Work

**Date**: 2026-03-08  
**Status**: Accepted  
**Context**: Phase 3 discovered `timing.js` orbital period placeholder was masking accuracy issues.  
**Decision**: Never commit code that returns potentially inaccurate data. If a feature is incomplete, throw an error or return null, not a guess.  
**Rationale**:
- Incorrect data compounds into false user reports weeks later
- Guesses masquerade as facts until discovered
- Errors are discoverable and fixable; guesses are silent

**Consequences**:
- Positive: Prevents silent data quality issues
- Negative: May surface "unfinished" feeling if stubs throw errors
- Mitigation: Use feature flags to hide unfinished features; stubs still throw in dev/test

**Implementation**: If a feature is 80% ready, release as feature-flag-hidden; don't ship placeholder logic.

---

## Document History

| Date | Author | Change |
|---|---|---|
| 2026-03-03 | System | Initial creation post-incident: false bug report due to date entry error |
| 2026-03-03 | Audit  | Added full codebase audit findings (26 issues); linked to BACKLOG.md; updated preventive measures with tracking notes; added infrastructure hardening section to Future Improvements |
| 2026-03-06 | System | Strategic analysis: identified monetization gaps, mobile opportunity, GTM strategy, 3 new ADRs |
| 2026-03-08 | Phase 3 | TODO resolution: 11/11 implemented; Web Crypto adoption; ephemeris integration; RFC 8291 Web Push; fire-and-forget pattern; 2 new ADRs |

---

## Nav Restructure: Dashboard UX Overhaul (2026-03-09)

### What We Did
Collapsed 14 navigable destinations (across 2 levels) down to 5 primary tabs + ⚙ overflow drawer. Redesigned the app around a Home dashboard as the default landing destination.

### Key Decisions

**1. Hick's Law in navigation is non-negotiable**
Having 14 destinations means users read every option before deciding. 5–7 items is the usable ceiling for a primary nav. Everything else belongs in a settings/more drawer.

**2. The "Home" tab must be the landing for returning users**
Previously, the Overview/Home was buried as an L2 sub-tab inside Blueprint. This meant the richest, most compelling screen — the one that rewarded the user's effort — was hidden. Smart landing logic now routes returning users directly to Home.

**3. First-run onboarding flow prevents dead-end blank states**
New users hitting a blank form feel nothing. A 3-step modal that explains what's needed and what they'll unlock sets expectations and reduces abandonment.

**4. Identity strip creates persistent context**
Once a chart is generated, the user should always know whose chart they're looking at. A persistent top strip showing type / authority / profile provides that ambient context across all tabs.

**5. Tab intro cards orient users to each section**
A single sentence at the top of Today, Connect, and Grow answering "what is this for?" reduces cognitive overhead on tab switches.

**6. File-swap replacement precision matters in large single-file SPAs**
`replace_string_in_file` on a 4,800-line file fails if there are any whitespace encoding differences between what was grep'd and what's actually in the file. Always re-read the target section immediately before replacing.

**7. Injecting missing `<div class="alert">` openers is easy to miss**
When inserting sub-tabs into a section, a prior `</div>` can swallow the opening tag of the next sibling element, leaving visible raw `style="..."` attribute text in the DOM. Always read 20+ lines after injection point to verify.

### Anti-Patterns Avoided
- Don't give every feature equal nav weight — hierarchy exists for a reason
- Don't bury the dashboard (the reward) behind the entry form (the friction)
- Don't skip onboarding for new users — they will never figure it out themselves
- Don't add nav items over time without pruning old ones

---

## 2026-03-13 | Production Bug Audit + UX Fixes

### Root Cause Analysis: One Function Crashing Every Protected Endpoint

**Discovery**
30 of 99 production test cases were failing (500s). All pointed to `resolveEffectiveTier()` in `workers/src/middleware/tierEnforcement.js`. That function is called on every tier-enforced route — so a single crash inside it takes down practitioner profile, leaderboard, checkin stats, clusters, achievements, and more simultaneously.

**Root Cause**
`resolveEffectiveTier` ran two queries against columns/tables added by pending migrations (027: `lifetime_access`/`transit_pass_expires`; 029: `agency_seats`). If these migrations hadn't been applied to production, every query threw and every endpoint 500'd.

**Fix**
Wrapped both queries in try/catch with graceful fall-through. The tier logic degrades safely rather than crashing — users are served with their base tier instead of receiving a 500.

**Lesson**: Shared middleware that queries recently-added schema columns is a silent upgrade dependency. When a new migration adds columns that a hot-path function reads, that function **must** handle their absence — either via try/catch fallback or conditional SELECT — so a missed migration run doesn't take down the entire API.

```javascript
// ✓ Migration-resilient query
let user = null;
try {
  const r = await query(`SELECT lifetime_access, transit_pass_expires FROM users WHERE id = $1`, [userId]);
  user = r.rows[0] ?? null;
} catch (colErr) {
  console.warn('[tier] migration 027 pending?', colErr.message); // degrades gracefully
}

// ✗ Hard dependency on schema version
const r = await query(`SELECT lifetime_access, transit_pass_expires FROM users WHERE id = $1`, [userId]);
// ← throws if migration not applied; crashes every tier-enforced endpoint
```

---

### Silent Data Bug: Wrong Property Key on Engine Return Value

**Discovery**
`astro_json` was always `null` in production — astrology data was never saved despite the engine returning it correctly.

**Root Cause**
`workers/src/handlers/calculate.js` read `result.westernAstrology` but the engine (`calculateFullChart`) returns `result.astrology`. The wrong key evaluated to `undefined`, `JSON.stringify(undefined)` returned `undefined`, and the DB stored null.

**Fix**: `result.westernAstrology` → `result.astrology`

**Lesson**: When an engine/library returns a response object, verify the exact key names against its actual return shape — not assumed names. A misspelled key silently stores null forever. Add an assertion or log the returned keys during development.

```javascript
// ✓ Log engine return shape during dev/test
const result = await calculateFullChart(input);
if (window.DEBUG) console.log('[engine] return keys:', Object.keys(result));

// ✓ At minimum: warn when expected key is absent
const astroJson = JSON.stringify(result.astrology || null);
if (!result.astrology) console.warn('[calculate] astrology missing from engine result');
```

---

### Pull-to-Refresh: Legacy Keys Never Matched Real Tab IDs

**Discovery**
The `touchend` refresh dispatcher (ui-nav.js) had entries like `transitsTab`, `checkinTab`, `practitionerTab` — but `document.querySelector('.tab-content.active')?.id` returns IDs like `tab-transits`, `tab-checkin`. The legacy keys never matched, so pull-to-refresh silently dispatched nothing for every tab.

**Second bug**: `loadCheckInStats` was referenced but the real function in `app.js` is `loadCheckinStats` (lowercase `i` in `Checkin`).

**Fix**: Replaced all legacy keys with canonical `tab-*` IDs; fixed the typo; added 5 missing tabs.

**Lesson**: When a dispatch map's keys are tab/DOM IDs, derive them from the actual HTML (`id="tab-*"`) rather than logic names. A map with wrong keys degrades silently — no error, no effect. Test with `console.log(activeTab)` in dev to confirm what value the code actually sees.

---

### UX Pattern: Eval Type → Preset Questions Reduces Blank-State Paralysis

**Decision**
The AI Profile form had a single optional free-text question input. Users with no prior context ("what should I ask?") hit analysis paralysis and either submitted blank or abandoned.

**Solution (UX-QUICKPICK)**
Added a 4-pill "Evaluation Type" selector (Full Blueprint / Daily Focus / Relationships / Career & Purpose) above the question input. Selecting a type reveals two pre-written question buttons that pre-fill the text input. Users can edit the pre-filled text freely.

**Key Design Choices**
- Eval type state is client-only — the API receives only the `question` string, so no backend changes were needed
- Preset buttons use `data-arg0` dynamically set by JS so the generic `data-action` dispatcher can call `setQuickPick(question)` without special-casing
- Buttons reveal lazily (hidden initially) to avoid visual clutter for users who already know their question

**Lesson**: Don't treat optional inputs as low-friction. A blank optional input that asks users to "be creative" is high cognitive load. Providing 2 opinionated presets per context dramatically lowers that bar — and users can still type anything they want.

---

## Document History (continued)

| Date | Author | Change |
|---|---|---|
| 2026-03-13 | Session | Production bug audit: systemic 500 root cause (tierEnforcement + missing migrations); astro_json null bug (wrong key); pull-to-refresh dispatch map fix; UX-QUICKPICK implementation |
| 2026-03-15 | Session | Comprehensive codebase quality audit: 7 tier-access bugs fixed, 5 handlers given try/catch, 16 dead queries removed (~100 lines), test registry updated |
| 2026-07-16 | Sprint | Backend logic sprint: 21 fixes across 10 handlers — ON CONFLICT DO NOTHING, falsy-zero, ResponseInit gotcha, open redirect, PII logging |
| 2026-07-17 | Sprint | Deep Dive Security & Logic Audit: 62 findings triaged, Critical/High/Medium issues resolved |
| 2026-07-18 | Sprint | Phase 2 Critical/High (19 fixes): XSS, SSRF, open redirect, race condition, billing logic, idempotency. Phase 2 Medium (28 fixes): rate limiting, LLM failover, engine accuracy |
| 2026-07-18 | Sprint | DB normalization migrations 032–034: tier canonicalization, composite indexes, dead view cleanup. Anti-Sybil referral defense (P2-BIZ-002): 3-layer gate |
| 2026-07-19 | Sprint | Phase 2 Low (11) + Full-Stack Audit (14): email verification flow, dead table cleanup, CAN-SPAM unsubscribe, `Object.freeze`, envelope standardization completion. 20 patterns documented |

---

### Pattern: New Canonical Tier Names Systematically Missing from Feature Gates

**Discovery (2026-03-15 Codebase Audit)**

When canonical tier names `individual` and `agency` were introduced (migration 030), all old tier-check arrays in handler code were left with legacy names only. This caused functional **access-control regressions** — `agency` users were silently blocked from analytics, Notion sync, embed features, and the upgrade-required gate in `tierEnforcement.js` reported them as needing to upgrade even when they'd already paid.

**Affected files:**
- `handlers/analytics.js` — `['practitioner', 'white_label', 'admin']` → missing `agency`
- `handlers/embed.js` — `tier === 'white_label'` → missing `agency`
- `handlers/notion.js` — `!== 'white_label'` check → missing `agency`
- `middleware/tierEnforcement.js:279` — `tier !== 'white_label'` → missing `agency`
- `handlers/experiments.js` — `tier === 'regular'` blocked individual users → missing `individual`
- `handlers/keys.js` — `TIER_ORDER` array had only old names → `individual`/`agency` users couldn't create keys
- `handlers/promo.js` — `validTiers` lacked `individual`/`agency`

**Root Cause**
Each check was updated independently. There is no single authoritative constants file that all tier-checks import. When a new canonical name was added to the DB migration, the code was not audited end-to-end.

**Fix**
Added `agency` to all `practitioner`-or-`white_label` check arrays. Added `individual` alongside `regular` in individual-tier checks. Expanded `TIER_ORDER` in keys.js to `['free', 'regular', 'individual', 'practitioner', 'white_label', 'agency']`.

**Lesson**: Every time a tier is renamed or a canonical alias is added, run:
```bash
grep -rn "'<old_tier>'" workers/src/handlers/ workers/src/lib/ workers/src/middleware/
```
against ALL affected files before closing the ticket. Tier strings are scattered across 10+ files. A centralized `TIERS` constants export (e.g., `lib/tiers.js`) would eliminate this class of bug entirely but requires a dedicated refactor.

---

### Pattern: Dead Queries Accumulate Silently in queries.js

**Discovery (2026-03-15)**
`queries.js` grew to 2017 lines. A cross-reference of all `QUERIES.xxx` call sites against defined keys found 16 dead query definitions (~100 lines of dead SQL never called):
- `getTransitSnapshot`, `getPractitionerClients` (base, superseded by `_WithCharts`), `getClustersByUser`, `getOptedInUsers`, `setSmsPref`, `logSmsMessage`, `getReferralBonusBalance`, `getUsageByUserInPeriod`, `updateSubscriptionPeriod`, `getSubscriptionUserByStripeId`, `cancelSubscriptionByStripeId`, `getCheckinStreak`, `getPromoCode`, `verifyOAuthStatePublic`, `deleteOAuthStatePublic`, `getPractitionerSynthesisStyle`

**Root Cause**
Queries were added during feature development and became orphaned when handlers were refactored to use different queries. No process existed to check for orphans.

**Fix**
Removed all 16 dead queries. queries.js reduced from 2017 → 1915 lines. Test that explicitly asserted a dead query (`getReferralBonusBalance`) was also updated.

**Lesson**: Periodically run the dead-query diff:
```bash
grep -oP "QUERIES\.\w+" workers/src/**/*.js | sort | uniq > /tmp/used.txt
grep -oP "  [a-zA-Z]\w*:" workers/src/db/queries.js | sed 's/  /QUERIES./' | sort | uniq > /tmp/defined.txt
comm -23 /tmp/defined.txt /tmp/used.txt  # Dead queries
```

---

### Best Practice: Every Exported Handler Needs try/catch

**Discovery (2026-03-15)**
Five handlers (`analytics.js`, `forecast.js`, `onboarding.js`, `timing.js`, `transits.js`) had no outer try/catch. Any DB or engine exception would surface as an unstructured Cloudflare runtime 500 with no controlled error body.

**Fix**
Added try/catch in all five. Pattern:
```javascript
export async function handleX(request, env) {
  // Cheap checks before try (auth, param validation) — safe without catch
  if (!someparam) return Response.json({ error: '...' }, { status: 400 });

  try {
    // All DB calls and engine invocations here
    return Response.json({ ok: true, data: ... });
  } catch (err) {
    console.error('[X] Unhandled error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Lesson**: Make try/catch a mandatory checklist item in the handler template. Any handler that hits a DB or calls the calculation engine MUST have a catch block. Cheap synchronous validation before the try block is fine — it doesn't need coverage.

---

### 2026-07-16 | Backend Logic Sprint — 21 Fixes Across 10 Handlers

**Context**
Systematic sweep of all handler files after the Phase 2 audit revealed 21 logic, security, and response-format bugs that were missed by prior issue-driven fixes. This was a file-by-file read of every handler, not an audit-item checklist.

**Fixes Applied (21 issues across 10 files)**

| File | Fix | Impact |
|------|-----|--------|
| `queries.js` | Added `updatePractitionerTier`; fixed `getAnalyticsMrr` tier names; fixed `getChartHistory` `->` → `->>` | Tier upgrades now persist; MRR query returns data; chart history returns text not JSON objects |
| `webhook.js` | Practitioners tier upsert: `ON CONFLICT DO NOTHING` → `DO UPDATE SET tier = EXCLUDED.tier` | Tier upgrades were silently discarded — subscription upgrades had no effect on practitioner access |
| `webhook.js` | `'cancelled'` → `'canceled'`; PII removed from `console.log` | Stripe spelling standard; serverless logs are a PII leak vector |
| `billing.js` | `successUrl`/`cancelUrl` validated against `FRONTEND_URL` | Open redirect prevention — attacker could set redirect to phishing domain |
| `promo.js` | `ok: false` moved from `ResponseInit` to JSON body; discount>100 guard; tier enum validation | `ResponseInit.ok` is HTTP-status-based, not body content — clients never saw error state |
| `share.js` | `referredUsers.total` → `.count`; full `ok:` envelope | Postgres `COUNT(*)` returns column named `count`, not `total` — referral count was always 0 |
| `checkin.js` | `energyLevel=0` bypass fixed; NaN from invalid `parseInt` fixed | `if (!energyLevel)` rejects `0` which is a valid check-in score |
| `keys.js` | Full `TIER_ORDER` index check replacing free-only guard | `tier === 'free'` only catches one denial case; ordered comparison handles all tiers |
| `diary.js` | `handleDiaryUpdate` given full validation matching `handleDiaryCreate` | Update path had no input validation — SQL injection and schema violation possible |
| `practitioner.js` | `handleRemoveClient` checks `rowCount`; email format validation in `handleAddClient` | 404 for non-existent client; blocks malformed email addresses |
| `auth.js` | Dead `delete user.refresh_token` removed | Property never existed on the object — misleading to auditors |

**Key Patterns Discovered**

11. **`ON CONFLICT DO NOTHING` silently drops state transitions.** Upserts with `DO NOTHING` are appropriate for idempotent inserts, but when the conflict row needs to be *updated* (e.g., tier upgrade), you must use `DO UPDATE SET col = EXCLUDED.col`. This is the most dangerous silent bug pattern in PostgreSQL.

12. **`ResponseInit.ok` is not the JSON body `ok`.** `new Response(JSON.stringify({error: "..."}), { ok: false })` does NOT put `ok` in the response body. The second argument is a `ResponseInit` with HTTP-status-based `ok`. Always put the envelope key in the serialized body.

13. **Falsy-zero validation is a recurring JS bug.** `if (!value)` rejects `0`, `""`, and `null` equally. For numeric inputs where 0 is valid, use explicit null/undefined checks or range validation: `if (value == null || value < 0 || value > 10)`.

14. **Postgres column naming: `COUNT(*)` returns `count`, not `total`.** SQL result columns use lowercase function names by default. Always alias: `SELECT COUNT(*) AS total` or reference `.count` in JS. This was a silent data bug returning 0 for all referral counts.

15. **Never log user PII in serverless handler code.** Cloudflare Worker logs persist in the dashboard and may be retained by third-party log aggregators. Use user IDs only. `console.log('User email:', user.email)` is a data breach waiting to happen.

---

### 2026-07-18 | DB Normalization Migrations 032–034

**Context**
Three sequential migrations to clean schema drift accumulated over 6 months of feature development. Applied after the handler logic fixes (July 16) to ensure consistency between code and data.

**Migration 032: `normalize_tier_and_status`**
- Canonicalized legacy tier names: `seeker`/`regular` → `individual`, `guide` → `practitioner`, `white_label` → `agency`
- Normalized cancellation spelling: `cancelled` → `canceled` (Stripe standard: one L)
- Tightened `CHECK` constraints to only allow canonical values going forward
- **Lesson**: Tier normalization must be a paired operation — the DB migration cleans existing data, but handler code must already accept the new names. Deploy code first, then migrate, so the transition is seamless.

**Migration 033: `composite_indexes`**
- Added 3 compound indexes: `transit_alerts(user_id, active)`, `push_subscriptions(user_id, active)`, `alert_deliveries(alert_id, trigger_date)`
- All created with `CONCURRENTLY` to avoid locking live tables
- **Lesson**: `CREATE INDEX CONCURRENTLY` is mandatory for zero-downtime index additions on live tables. Standard `CREATE INDEX` takes an `ACCESS EXCLUSIVE` lock that blocks all reads and writes for the duration of the index build.

**Migration 034: `drop_dead_views`**
- Removed 8 unused views: `subscription_analytics`, `monthly_revenue`, `user_subscription_status`, and 5 others
- Kept `checkin_streaks` materialized view — discovered it's actively refreshed by `cron.js` step 4b
- **Lesson**: Dead views create audit false positives. Auditors see `subscription_analytics` and trace non-existent query paths, wasting investigation time. Drop unused schema objects proactively. Always check cron jobs and scheduled workers — not just handlers — before declaring a view dead.

---

### 2026-07-18 | Anti-Sybil Referral Defense (P2-BIZ-002)

**Context**
The referral credit system (`handleClaimReferralReward` in `referrals.js`) had no abuse prevention. A user could create throwaway accounts to self-refer and earn unlimited Stripe balance credits ($5 each). This was rated Critical/High but deferred pending a design decision on rate limits.

**Design Decision**
Implemented a 3-layer defense — each layer is a cheap DB query, no external fraud service needed:

| Layer | Check | Threshold | Blocks |
|-------|-------|-----------|--------|
| **Account age gate** | `referrer.created_at` must be ≥72 hours old | 3 days | Fresh throwaway accounts |
| **Email domain cap** | `countReferralsByDomain(referrer_id, domain)` | Max 3 per domain | Email alias farming (`user+1@gmail.com`, `user+2@gmail.com`) |
| **Lifetime referrer cap** | `countReferrerLifetimeCredits(referrer_id)` | Max 10 claims ($50) | Worst-case financial exposure bounded |

**Key Patterns**

16. **Multi-layer abuse defense > any single gate.** Each layer catches a different attack vector. Account age stops cheap Sybils, domain cap stops alias farming, lifetime cap bounds financial exposure. An attacker must defeat all three layers simultaneously.

17. **Bound worst-case financial exposure with a hard cap.** Even if all other defenses fail, 10 × $5 = $50 maximum loss per attacker. This converts an unbounded financial risk into a fixed, acceptable cost.

18. **Domain extraction from email is a simple, effective grouping key.** `email.split('@')[1].toLowerCase()` groups `user+1@gmail.com` and `user+2@gmail.com` under `gmail.com`, catching the most common alias pattern without needing a fraud detection service.

**Files**: `workers/src/handlers/referrals.js`, `workers/src/db/queries.js` (2 new queries)

---

### 2026-07-19 | Response Envelope Full Standardization

**Context**
The response envelope migration from `{success: true/false}` to `{ok: true/false}` was declared "complete" twice before this sprint (PL-1 in March, ERR-001 in July 17). Both times, a subsequent audit found remaining instances.

**Final Sweep**
48 replacements across 7 handler files: `stats.js`, `practitioner.js`, `famous.js`, `notion.js`, `share.js`, `checkin.js`, `diary.js`. Verified with:
```bash
grep -rn "success:" workers/src/handlers/ | grep -v "// " | grep -v "ok:"
# Must return 0 results
```

19. **"Migration complete" claims require mechanical verification.** Every time a pattern migration (rename, format change) is declared done, immediately run a grep to confirm zero remaining instances. Human review misses files. This migration was "done" three times before a grep caught the stragglers.

20. **Use `jsonOk(data)` / `jsonError(msg, status)` helpers to prevent drift.** The root cause of envelope inconsistency is that 41 handlers each independently construct `Response.json({ok: true, ...})`. A shared helper would make the wrong thing impossible to type. The helpers exist in `lib/response.js` but weren't adopted in all files during the original rollout.

---

### Sprint: Phase 2 Low + Full-Stack Audit Remediation (2026-07-19)

**Scope**: 25 items resolved in one session — all 11 Phase 2 Low issues, 7 Full-Stack Audit code/security/data fixes, 7 documentation accuracy fixes.

**Key Patterns Discovered**

1. **Silent `.catch(() => {})` blocks re-appear after "fixed" sprints.** ERR-001 claimed 12 patterns fixed (2026-07-17), but 8 more were found in handlers not covered by the original sweep. **Lesson**: After a pattern fix, grep the entire codebase for the anti-pattern — don't rely on issue lists being exhaustive.

2. **Response envelope drift is insidious.** `success:` vs `ok:` discrepancy persisted across 7 handler files (48 instances) despite a prior sprint claiming full standardization. **Lesson**: Envelope format should be enforced by a shared helper (e.g., `jsonOk(data)` / `jsonError(msg, status)`) rather than relying on each handler to pick the right key. Until then, add a grep check to pre-deploy verification.

3. **Documentation claims about test counts, model names, and feature statuses rot within days.** FEATURE_CHECKLIST said 302 tests (actual: 250), bcrypt (actual: PBKDF2), share-card "empty stub" (actual: 621-line renderer), 37 handlers (actual: 41). **Lesson**: Any doc that encodes a count, version identifier, or status should cite the source command (`vitest --reporter=json | jq .numPassedTests`, `ls workers/src/handlers/*.js | wc -l`) so it can be mechanically verified.

4. **`Object.freeze()` is the minimal effective defense against `window.currentUser` mutation.** Full encapsulation would require converting app.js to an ES module or IIFE — disproportionate for a Low item. Freezing the object prevents the primary attack (tier tampering via devtools/extensions) without refactoring 9 reference sites. **Lesson**: When full remediation is too costly, freeze/seal shared objects to prevent mutation while keeping read access.

5. **CAN-SPAM compliance requires full-stack coordination.** The email unsubscribe fix touched 6 files: migration (031), queries.js (opt-out query + 5 cron filters), email.js (domain fix), index.js (new endpoint), rateLimit.js (rate limit entry), and app.js (frontend handler). A "just add a link" approach would have missed the cron drip exclusion — users would unsubscribe but still receive emails. **Lesson**: Compliance features are inherently cross-cutting; plan for full-stack impact upfront.

6. **CORS must default to production when env is falsy, not just when env === 'production'.** Cloudflare Workers with unbound ENVIRONMENT var silently enable dev origins (localhost). **Lesson**: Security-sensitive env checks should always fail closed — `if (!env || env === 'production')` not `if (env === 'production')`.

7. **All in-memory state must reset on logout.** (P2-FE-009) `_allCelebrityMatches`, `currentCluster`, `currentDiaryEdit`, `activePromoCode`, `window._lastChart` persisted across logout/login cycles, leaking personal data if a second user logged in on the same browser tab. **Lesson**: Maintain a single `clearSessionState()` function called on logout that nulls every module-level variable holding user data. Audit for new state variables after every feature sprint.

8. **Data files must appear in the engine injection map or they're invisible at runtime.** (AUDIT-CODE-003) `heresies_canonical.json` existed in `src/knowledgebase/` but was never added to `engine-compat.js`'s `globalThis.__PRIME_DATA.kb` injection. The LLM received empty context for that topic. **Lesson**: When adding a data file to the knowledge base, the file's presence in the directory is not enough — it must be imported and mapped in `engine-compat.js`.

9. **Grep for placeholder strings before every deploy.** (AUDIT-DATA-002) Plausible analytics script had `data-domain="YOUR_DOMAIN"` — a single unsubstituted placeholder silently discarded all analytics data since launch. **Lesson**: Add `grep -rn 'YOUR_\|REPLACE_WITH_\|TODO_FILL' frontend/` to the pre-deploy checklist.

## 2026-07-19 | Email Verification + Dead Table Cleanup

### Key Patterns

7. **Audit claims about "dead tables" must be independently verified.** AUDIT-DB-002 claimed 5 tables had zero queries. In reality, only 2 were dead (`alignment_trends`, `notion_pages`). The other 4 (`experiments`, `experiment_assignments`, `experiment_conversions`, `funnel_events`) are actively used by `lib/experiments.js`, `handlers/experiments.js`, and `lib/analytics.js`. Blindly dropping them would have broken the A/B testing and funnel analytics features. **Lesson**: Always `grep -rn` each table name in application code before writing a DROP migration — audit reports can over-count.

8. **Email verification is a full-stack cross-cut, not just "add a column."** The implementation touched 7 files: migration 036 (schema), queries.js (5 new queries), email.js (verification email template), auth.js (token generation in register + 2 new handlers), tierEnforcement.js (LLM gate), index.js (route registration), app.js (banner, resend, URL action handler). **Lesson**: Security features that gate access are inherently distributed — budget accordingly and trace every touchpoint before starting.

9. **Fail-open with monitoring beats fail-closed for schema migrations.** The `enforceUsageQuota` email_verified check wraps in try/catch and logs a warning if the column doesn't exist (pre-migration state). This prevents a migration ordering issue from locking out all existing users. **Lesson**: When adding enforcement that depends on a new DB column, always handle the pre-migration case gracefully — the migration and code deploy may not land atomically.

10. **Pre-existing file corruption hides in plain sight.** `index.js` had a literal `\n` string inside an import line (two imports concatenated on one line with a literal backslash-n). This passed code review in prior sprints because `wrangler` may handle it differently than Node's `--check`. **Lesson**: Run `node -c` syntax validation on all modified AND adjacent files after each batch of edits.

---

## Multi-Session Audit Retrospective (July 16–19, 2026)

### Scope
73 issues identified across 3 audit passes (Deep Dive Security Audit, Phase 2 Audit, Full-Stack Audit). All Critical, High, Medium, and Low items resolved. 20 items remain deferred (multi-day features, operational deployments, product decisions, research).

### What Worked
- **Criticality-first ordering** — Addressing XSS/SSRF/race conditions before cosmetic fixes ensured the highest-risk items were resolved first with full attention.
- **File-by-file sweeps after issue-driven passes** — The July 16 sprint (21 fixes) found bugs that all three audits missed, because it read every handler line-by-line rather than searching for known patterns.
- **grep verification after every "complete" claim** — The response envelope migration was "done" 3 times before a grep proved it wasn't. Mechanical verification is non-negotiable.
- **Fail-open for new DB columns** — The email_verified gate in tierEnforcement.js wraps in try/catch so a migration ordering issue can't lock out the entire user base.
- **Lessons learned document as living audit trail** — Capturing patterns as they emerge (not after the sprint) ensures nothing is lost and future auditors can search for precedent.

### What to Improve
- **Centralize tier constants** — Tier strings appear in 10+ files. A single `lib/tiers.js` export (`TIER_ORDER`, `isAtLeast(tier, minimum)`) would eliminate the entire class of "missing tier in access check" bugs.
- **Adopt `jsonOk()`/`jsonError()` helpers universally** — They exist in `lib/response.js` but only ~30% of handlers use them. Full adoption would make envelope drift impossible.
- **Pre-deploy grep checklist** — Codify the verification greps into a script: zero `success:` in handlers, zero `YOUR_DOMAIN` placeholders, zero `.catch(() => {})`.
- **Database migration + code deploy atomicity** — The fail-open pattern works, but a deployment pipeline that runs migrations before code deployment would be cleaner.

### By the Numbers
| Metric | Count |
|--------|-------|
| Total issues triaged | 73 |
| Issues resolved | 53 |
| Issues deferred (product/research) | 20 |
| Files modified | 30+ |
| New migrations | 7 (030–036) |
| New patterns documented | 20 |
| Security fixes (XSS, SSRF, open redirect, injection) | 15 |
| Business logic fixes | 18 |
| Frontend UX fixes | 12 |
| Documentation corrections | 8 |

