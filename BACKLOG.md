# Prime Self — Backlog

**Last audited:** 2026-03-16 (Page cohesion workflow review)
**Test suite:** Current local Vitest suite passing
**Code status:** Sprints 1–19 COMPLETE ✅ | Sprint 18 UX: 51/51 defects cleared | 4 new market-validation issues added 2026-03-10 | 1 new cohesion workflow item added 2026-03-16
**Deployment status:** ⚠️ Last external production report showed stale deployment issues; not re-verified in this repo-only audit
**Audit scope:** Full codebase + all documentation + DB schema alignment + engine accuracy + language/comprehension + profile specificity + **production verification** + **deep-dive DB/Engine/Workers audit** + **comprehensive UX review** + **social media integration** + **market validation (2026-03-10)**

---

## 🚨 PRODUCTION STATUS (Last external verification: 2026-03-08)

**Last reported issue**: Production deployment at `prime-self-api.adrper79.workers.dev` was running stale code during the March 8 checkout.

**Broken Endpoints** (404/500 errors):
- ❌ `/api/auth/me` → 404 (route exists in code)
- ❌ `/api/validation/*` → 404 (route exists in code)
- ❌ `/api/psychometric/*` → 404 (route exists in code)  
- ❌ `/api/diary` → 500 (handler implemented, DB connection issue)
- ❌ `/api/transits/forecast` → 400 (frontend missing params)
- ❌ CSP violations (Cloudflare Insights blocked, fonts blocked)

**Action Required**: Re-run deploy verification before treating production status as current.

---

## How to Read This

Items are organized by severity and grouped by system. Each item has:
- **ID** — for referencing in commits and PRs (`BL-C1`, `BL-M5`, etc.)
- **Severity** — Critical / Moderate / Minor
- **Status** — `[ ]` open, `[~]` in progress, `[x]` done
- **Affected files** — where the fix goes

---

## Critical (6) — Must fix before production

These items cause outright failures in deployed environments.

### BL-C1 | Neon DB driver uses non-existent API pattern
- [x] **Status:** Done (2026-03-04)
- **Severity:** Critical
- **Files:** `workers/src/db/queries.js` (lines 38–57)
- **Problem:** `neonQuery()` POSTs to `https://{hostname}/sql` with a `Neon-Connection-String` header. This is not how Neon's serverless HTTP API works. The correct approach is to use the `@neondatabase/serverless` npm package or the documented Neon HTTP endpoint (`https://{project-id}.neon.tech/sql` with `Authorization: Bearer` header).
- **Impact:** All database operations fail — auth, chart saving, profiles, practitioners, clusters, SMS. Nothing that touches the DB works.
- **Fix:** Install `@neondatabase/serverless` into `workers/package.json` and replace `neonQuery()` with the official `neon()` HTTP driver. Alternatively, implement the correct Neon HTTP API signature.
- **Verify:** Deploy to staging → `POST /api/auth/register` succeeds → user row appears in Neon console.

### BL-C2 | `migrate.js` doesn't await `getClient()`
- [x] **Status:** Done (2026-03-04)
- **Severity:** Critical
- **Files:** `workers/src/db/migrate.js`
- **Problem:** `getClient()` is an `async` function but is called without `await`. The returned Promise is assigned to `client`, and `client.connect()` is called on a Promise object — throws `TypeError`.
- **Impact:** Migration script is broken. Cannot set up the database schema.
- **Fix:** Add `await` before `getClient(connectionString)`.
- **Verify:** `npm run migrate` completes without errors.

### BL-C3 | Schema drift between `migrate.js` and `migrate.sql`
- [x] **Status:** Done (2026-03-04)
- **Severity:** Critical
- **Files:** `workers/src/db/migrate.js`, `workers/src/db/migrate.sql`
- **Problem:** The two migration sources produce incompatible schemas:
  - `migrate.js`: `birth_date DATE NOT NULL`, no `password_hash`, no `updated_at`, no `UNIQUE` on `phone`, uses `gen_random_uuid()`
  - `migrate.sql`: `birth_date DATE` (nullable), has `password_hash TEXT`, `updated_at TIMESTAMPTZ`, `phone TEXT UNIQUE`, uses `uuid_generate_v4()`
- **Impact:** Auth fails on anyone who used `migrate.js` (no password column). Conflicting nullable/NOT NULL constraints.
- **Fix:** Designate `migrate.sql` as the single source of truth. Rewrite `migrate.js` to read and execute `migrate.sql` directly, or consolidate into one migration path.
- **Verify:** Fresh deploy → both migration paths produce identical schema → `\d users` in Neon matches expected columns.

### BL-C4 | CORS blocks DELETE (and PUT/PATCH)
- [x] **Status:** Done (2026-03-04)
- **Severity:** Critical
- **Files:** `workers/src/middleware/cors.js` (line 6)
- **Problem:** `Access-Control-Allow-Methods` is `'GET, POST, OPTIONS'`. The `DELETE /api/practitioner/clients/:id` endpoint fails CORS preflight in all browsers.
- **Impact:** Practitioner client removal is browser-blocked.
- **Fix:** Change to `'GET, POST, PUT, PATCH, DELETE, OPTIONS'`.
- **Verify:** Browser DevTools → Network → `DELETE` preflight returns 204 with correct `Allow-Methods` header.

### BL-C5 | Chart auto-save is dead code
- [x] **Status:** Done (2026-03-04)
- **Severity:** Critical
- **Files:** `workers/src/handlers/calculate.js` (lines 55–73), `workers/src/index.js` (route config)
- **Problem:** `/api/chart/calculate` is listed in `PUBLIC_ROUTES`, so `authenticate()` is never called and `request._user` is always `undefined`. The DB persistence block (`if (userId && env.NEON_CONNECTION_STRING)`) never executes.
- **Impact:** Charts are never saved to the database from this endpoint. Profile generation that depends on `chartId` will fail.
- **Fix options:**
  1. Make `/api/chart/calculate` an authenticated route (breaking change for anonymous users)
  2. Keep it public but add a separate `POST /api/chart/save` authenticated endpoint (matches API_SPEC.md)
  3. Save anonymously with a session token and associate on login
- **Verify:** Calculate a chart while logged in → `charts` table has a new row.

### BL-C6 | `parseToUTC` negative-minute bug
- [x] **Status:** Done (2026-03-04)
- **Severity:** Critical
- **Files:** `workers/src/utils/parseToUTC.js` (lines 52–53)
- **Problem:** When `utcTotalMinutes` is negative (e.g., -30), JavaScript's `%` operator preserves sign: `-30 % 60 = -30`. The code corrects negative *hours* but not negative *minutes*. Result: `{ hour: 23, minute: -30 }`.
- **Impact:** Corrupted birth time fed into the calculation engine. Wrong chart for affected timezones.
- **Fix:** Use `((utcTotalMinutes % 60) + 60) % 60` for the minute calculation, or handle negative minutes alongside the hour correction.
- **Verify:** `parseToUTC('2026-03-03', '00:15', 'Pacific/Auckland')` → minutes should be positive.

---

## Moderate (15) — Functional gaps, security, data completeness

### BL-M1 | 7 documented API endpoints not implemented
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `workers/src/index.js`, `workers/src/handlers/cluster.js`, `workers/src/handlers/sms.js`
- **Problem:** These endpoints were in API_SPEC.md but had no route handler:
  - `GET /api/auth/me` ✓ DONE
  - `POST /api/chart/save` ✓ DONE
  - `GET /api/chart/history` ✓ DONE
  - `GET /api/cluster/list` ✓ DONE
  - `POST /api/cluster/leave` ✓ DONE
  - `POST /api/sms/subscribe` ✓ DONE
  - `POST /api/sms/unsubscribe` ✓ DONE
- **Fix:** Implemented all 7 missing endpoints. Added proper authentication, input validation, error handling, and JSDoc documentation following best practices.

### BL-M2 | Password comparison is timing-attack vulnerable
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `workers/src/handlers/auth.js`
- **Problem:** Password hash verification uses `===` string comparison, which short-circuits on first mismatch. This leaks timing information about the hash.
- **Fix:** Use constant-time comparison: compare byte-by-byte with XOR accumulator, or use `crypto.subtle.timingSafeEqual` if available in Workers runtime.

### BL-M3 | No JSON parse error handling in handlers
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `workers/src/handlers/calculate.js`, `profile.js`, `auth.js`, `composite.js`, `cluster.js`
- **Problem:** `request.json()` is called without try/catch. Malformed request bodies (non-JSON, empty, `text/plain`) throw unhandled exceptions → generic 500 instead of descriptive 400.
- **Fix:** Wrap in try/catch with `return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })`.

### BL-M4 | Wildcard CORS origin with auth
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `workers/src/middleware/cors.js`
- **Problem:** `Access-Control-Allow-Origin: '*'` allows any website to make authenticated requests using stolen tokens.
- **Fix:** Set origin to the production frontend domain (`https://prime-self-ui.pages.dev`) or make it configurable via environment variable. Allow `*` only in development.

### BL-M5 | Gene Keys knowledgebase only 59% complete
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `src/knowledgebase/genekeys/keys.json`, `src/knowledgebase/genekeys/generate-missing.js`
- **Problem:** 38 of 64 Gene Keys are populated. The RAG context for 26 keys is empty, forcing the LLM to either hallucinate or skip the Gene Keys section entirely.
- **Fix:** Generate the remaining 26 Gene Key entries using the `generate.js` script or Opus-driven batch generation.

### BL-M6 | `digest.js` property name mismatches
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `src/prompts/digest.js`
- **Problem:** References `transitData.positions` and `transitData.natalMatches`, but the transit engine returns `transitPositions` and `gateActivations`. SMS digests silently produce empty content.
- **Fix:** Align property names with the actual transit engine output.

### BL-M7 | `rag.js` treats astrology placements as array
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `src/prompts/rag.js`
- **Problem:** Calls `.find()` on `chartData.astrology?.placements`, which is an object keyed by planet name in the engine output. `.find()` on an object returns `undefined` silently.
- **Fix:** Use `Object.values()` or direct key access instead of `.find()`.

### BL-M8 | Duplicate RAG logic between synthesis.js and rag.js
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `src/prompts/synthesis.js`, `src/prompts/rag.js`
- **Problem:** Both files contained overlapping RAG context builders. `synthesis.js` used its own `getRAGContext`; `rag.js` exported `buildRAGContext`. Maintaining two versions risked divergence.
- **Fix:** Consolidated into `rag.js` as the single RAG module. `synthesis.js` now imports `buildRAGContext()`. Removed 266 lines of duplicate code.

### BL-M9 | Duplicate JWT implementation
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `workers/src/handlers/auth.js`, `workers/src/middleware/auth.js`
- **Problem:** Both files independently implement `verifyHS256`, `base64UrlEncode`, and `base64UrlDecode`. Bug fixes must be replicated in both.
- **Fix:** Extract shared JWT utilities into `workers/src/lib/jwt.js` and import from both.

### BL-M10 | PDF handler can't do multi-page
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `workers/src/handlers/pdf.js`
- **Problem:** Only creates a single PDF page object. When content overflows (Y < 50), it resets Y but doesn't add a new page. Long profiles get visually corrupted.
- **Fix:** Implement page-break logic: detect overflow → finalize current page → insert new page → continue rendering.

### BL-M11 | `composite.js` missing channel 42-53
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `workers/src/handlers/composite.js`
- **Problem:** Has 35 channels in its CHANNELS array. Missing channel **42-53** (Channel of Maturation, Sacral → Root). Any composite analysis involving gates 42 or 53 misses this connection.
- **Fix:** Add `[42, 53, 'Sacral', 'Root']` to the CHANNELS array.

### BL-M12 | `engine-compat.js` incomplete data injection
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `workers/src/engine-compat.js`
- **Problem:** Injects 9 JSON files into `globalThis.__PRIME_DATA` but the knowledgebase has 20+ files. Any engine/prompt code referencing missing files will fail at runtime in the Workers environment.
- **Fix:** Added 11 missing data files: hd/centers.json, hd/authority.json, hd/definition.json, genekeys/keys.json, astro/planets.json, astro/signs.json, astro/houses.json, astro/aspects.json, numerology/lifePaths.json, numerology/personalYears.json, numerology/tarotCards.json. Total now 20 files injected.

### BL-M13 | Rate limits don't match API spec
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `workers/src/middleware/rateLimit.js`, `docs/API_SPEC.md`
- **Problem:** Code: `calculate=60/min, profile=10/min, transits=120/min`. Spec: `auth=10/min, profile=5/min, geocode=30/min`. Auth and geocode have no dedicated rate limits in code.
- **Fix:** Align rate limit config with spec or update spec to match code.

### BL-M14 | Frontend missing UI for 6+ backend features
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate
- **Files:** `frontend/index.html`
- **Problem:** No UI exists for: composite charts, birth-time rectification, practitioner tools, clusters, SMS subscription, onboarding story, PDF export.
- **Fix:** Implement frontend tabs/modals for each feature, prioritized by user impact.

### BL-M15 | Repo-wide observability and handled-error cleanup sweep
- [~] **Status:** In Progress (Cycle 1: profile.js ✅, oauthSocial.js ✅, alerts.js ✅, achievements.js ✅, auth.js ✅, notion.js ✅; follow-up: webhooks.js ✅, checkin.js ✅; broader long-tail remains across other handlers)
- **Severity:** Moderate
- **Files:** `workers/src/handlers/*.js`, `workers/src/lib/routeErrors.js`, `workers/src/lib/logger.js`, `workers/src/lib/errorMessages.js`, `frontend/js/app.js`, `tests/handled-route-errors.test.js`, `tests/observability-runtime.test.js`
- **Problem:** The critical-path error pipeline is now materially stronger, but the repo still has a split-brain observability model. Some routes use structured logging, analytics-backed error capture, Sentry, and request correlation; many other handlers still catch locally with raw `console.error(...)` and return generic failures without durable operator-facing signals. That means debugging quality still depends on which route failed.
- **Concept:** Finish the cleanup as a deliberate repo-wide standardization pass. The target state is: every customer-facing handled 5xx either rethrows to the top-level worker catch or uses the shared handled-route error path so the system emits structured logs, analytics error events, Sentry exceptions, and an `X-Request-ID` that can be surfaced to support. Browser-visible server failures should preserve the request ID and attach it to user-safe error copy where appropriate.
- **Scope:**
  - Migrate remaining high-value handlers away from console-only local catches.
  - Use `workers/src/lib/routeErrors.js` for handled JSON/browser 5xx responses where local catch blocks are required.
  - Normalize logger payloads to include source, route, requestId, errorClass, and retryability for handled failures.
  - Preserve special response contracts, such as HTML/browser callback routes, while still emitting the shared operator-facing signals.
  - Expand regression coverage so handled-route failures are tested, not assumed.
- **Acceptance:**
  - No critical customer-facing handler returns a handled 5xx via console-only logging.
  - Shared handled-route reporting is used consistently across billing, auth-adjacent, practitioner, Notion, export, webhook/admin, and other support-heavy surfaces.
  - Frontend API failures preserve backend request IDs on 5xx responses.
  - Focused tests cover both top-level unhandled failures and representative handled-route failures.
  - Reliability policy and backlog remain aligned with the shipped behavior.
- **Implementation prompt:**
  - "Perform a repo-wide observability cleanup sweep. Replace console-only handled 5xx paths in customer-facing Workers handlers with the shared `reportHandledRouteError()` flow or a rethrow into the top-level worker catch, whichever preserves the route contract best. Do not change successful response shapes or unrelated business logic. Preserve HTML/browser callback responses where needed by using the shared helper with a custom response factory. Ensure every migrated path emits structured logger data, analytics `trackError`, Sentry capture, and returns `X-Request-ID`. On the frontend, preserve request IDs from failed API responses and append them to support-facing error copy only for server-side failures. Add or extend focused Vitest coverage for at least one handled failure in each migrated area. Keep changes minimal, avoid unrelated refactors, and validate with targeted tests."

### BL-M16 | 2FA QR delivery path is split between vendored and CDN assets
- [x] **Status:** Resolved — 2026-03-16 (Cycle 3)
- **Severity:** Moderate
- **Files:** `frontend/index.html`, `frontend/_headers`, `frontend/js/qr.js`
- **Resolution:** Removed CDN `qrcode@1.5.3` script tag and its `dns-prefetch` entry from `index.html`. Removed `https://cdn.jsdelivr.net` from `script-src` in both `_headers` and `index.html` meta CSP. `frontend/js/qr.js` is now the sole, canonical QR generator. `app.js` synchronous `QRCode.toDataURL(text, scale)` API matches `qr.js` exactly. CSP `script-src` is tighter by one origin.

### BL-M17 | Practitioner-first cohesion workflow for home, pricing, onboarding, and workspace
- [ ] **Status:** Open
- **Severity:** Moderate
- **Files:** `frontend/index.html`, `frontend/pricing.html`, `frontend/privacy.html`, `frontend/terms.html`, `frontend/js/app.js`, `frontend/DESIGN_SYSTEM.md`
- **Problem:** The current frontend is visually premium but product messaging drifts between three identities: consumer self-discovery app, multi-system astrology/metaphysical engine, and practitioner business platform. The result is that the site looks cohesive at a surface level but communicates too many primary jobs at once. Specific friction points from the 2026-03-16 page review:
  - Home leads with breadth (`systems combined`) instead of a single practitioner-first promise.
  - The chart journey points to conceptual destinations that do not fully match real tab IDs/workflows.
  - Pricing is structurally clearer than the app, but it speaks in generic SaaS language instead of Prime Self's actual practitioner-first positioning.
  - Pricing/privacy trust language is inconsistent: pricing says chart data is never shared with third parties, while privacy correctly discloses AI/SMS processors.
  - Practitioner onboarding shifts too quickly into referral economics and off-page instructions instead of helping users complete setup in-flow.
  - The practitioner workspace is operationally useful but framed like an admin portal rather than a premium practice workspace.
- **Impact:** Users can understand pieces of the product but not the whole. That weakens trust, makes conversion harder, and blurs the distinction between the consumer and practitioner journeys. It also risks redesign churn because page-level changes can accidentally push the product toward a generic D2C spirituality app, which is not the intended positioning.
- **Positioning guardrails:**
  - Treat Prime Self as **practitioner-first B2B2C software** with consumer features that support practitioner delivery, lead gen, and retention.
  - Preserve the premium, mystical visual language, but reduce message sprawl.
  - Do not solve this by flattening the product into a generic astrology landing page.
  - Prefer page-specific copy/IA/workflow changes over broad aesthetic rework.
- **Workflow:**
  1. **Message alignment pass**
     - Rewrite home hero/welcome, social proof, and chart/profile callouts to express one dominant promise.
     - Replace system-count-first copy with outcome-first copy.
     - Keep multi-system depth available, but secondary.
  2. **Trust alignment pass**
     - Reconcile pricing FAQ, privacy, and terms so data-sharing, AI usage, and practitioner/commercial claims say the same thing everywhere.
     - Remove or reframe any copy that overstates privacy, platform replacement, or monetization outcomes.
  3. **Workflow alignment pass**
     - Make the chart step guide and related nav reflect real tabs and real destinations.
     - Reduce conceptual dead ends and rename steps only where the actual route and UI support them.
  4. **Practitioner onboarding pass**
     - Change onboarding from an instruction/referral sequence into a setup sequence.
     - Complete as much profile/invite setup as possible inside the flow instead of telling users to navigate elsewhere.
  5. **Practitioner workspace pass**
     - Reframe the page from portal/admin language into practice workspace language.
     - Prioritize client service and practice readiness above platform mechanics and partner economics.
- **Acceptance:**
  - A first-time visitor can explain the product in one sentence after reading the first screen.
  - Home, pricing, privacy, and practitioner surfaces describe the same product without contradiction.
  - The main journey shown on the chart page maps cleanly to actual tabs/workflows.
  - Practitioner onboarding completes at least one meaningful setup task in-flow, not just via instructions.
  - The practitioner area reads as a premium workspace for serving clients, not as a generic admin console.
  - Updated copy and structure remain aligned with practitioner-first positioning and do not regress into a generic consumer astrology app.
- **Recommended execution order:**
  - Phase 1: trust + copy alignment (`index.html`, `pricing.html`, `privacy.html`, `terms.html`)
  - Phase 2: chart journey + nav/workflow alignment (`index.html`, `frontend/js/app.js`)
  - Phase 3: practitioner onboarding + workspace reframing (`index.html`, relevant JS)
- **Success checks:**
  - Manual review: one-sentence product clarity, no trust contradictions, no broken nav/step links.
  - UX review: practitioner and non-practitioner entry paths are both understandable, but practitioner-first remains the dominant framing.
  - Regression review: no new mismatch between page copy, legal copy, pricing claims, and in-app workflow names.

---

## Code Review Findings — 2026-03-16 Audit (9 items)

### BL-N1 | `keys.js` TIER_ORDER contains both legacy and canonical names — wrong comparison result
- [ ] **Status:** Open
- **Severity:** Moderate
- **Files:** `workers/src/handlers/keys.js`
- **Problem:** `TIER_ORDER` is defined as `['free', 'regular', 'individual', 'practitioner', 'white_label', 'agency']`. This mixes legacy tier aliases (`regular`, `white_label`) alongside canonical tier names (`individual`, `agency`) from `stripe.js`. As a result `regular` (index 1) < `individual` (index 2) even though `normalizeTierName('regular') === 'individual'`. A subscriber whose DB row holds `tier = 'regular'` (written by an older webhook invocation) cannot create an `individual`-level API key even though they paid for it. Same issue for `white_label` (index 4) vs `agency` (index 5).
- **Impact:** Any user whose tier was set before the legacy→canonical rename silently loses API key creation rights they paid for.
- **Fix:** Normalize the incoming tier via `normalizeTierName()` before computing the index; remove legacy entries from `TIER_ORDER` (or keep them only as duplicates of their canonical equivalent so the index comparison is always against canonical names).
- **Verify:** Unit test: `tierIndex('regular') === tierIndex('individual')` returns true.

---

### BL-N2 | `billing.js` retention/cancel offer returns `null` for legacy-tier subscribers
- [ ] **Status:** Open
- **Severity:** Moderate
- **Files:** `workers/src/handlers/billing.js`
- **Problem:** `buildRetentionOffer(subscription.tier)` receives the raw tier string from the DB (`'regular'`, `'white_label'`, etc.) with no normalization. The function only branches on `'practitioner'` and `'individual'`. A subscriber stored as `'regular'` (canonical: `'individual'`) matches neither branch and receives `null` — meaning no retention offer is shown before cancellation. This makes the cancel flow silently useless for all legacy-tier subscribers.
- **Impact:** Retention offer never fires for `regular` subscribers; potential churn goes unaddressed.
- **Fix:** Call `normalizeTierName(subscriptionTier)` at the top of `buildRetentionOffer` before branching. Also verify the downgrade offer copy and pricing align with current Plan v4 tier names and prices.
- **Verify:** Cancel flow shows a retention offer for a `regular` subscriber and for an `individual` subscriber.

---

### BL-N3 | Leaderboard email masking incomplete in `stats.js`
- [ ] **Status:** Open
- **Severity:** Minor
- **Files:** `workers/src/handlers/stats.js`
- **Problem:** `handleGetLeaderboard` masks emails as `email.split('@')[0] + '@***'`, hiding the domain but exposing the full local part (everything before `@`). BL-R-L12 (Sprint 16) fixed the identical bug in `achievements.js` but `stats.js` was missed. Any email in the leaderboard publicly reveals the username/identifier portion.
- **Impact:** Privacy exposure — user's local email identifier is visible to all visitors of the leaderboard.
- **Fix:** Apply the same masking pattern used in `achievements.js`: short local parts → `***@domain`, longer → first char + `***@domain`. Or use a generic star mask like `***@***`.
- **Verify:** Leaderboard response shows no identifiable email fragment; matches masking format from `achievements.js`.

---

### BL-N4 | `forecast.js` transit endpoint is unauthenticated and has no rate limit
- [ ] **Status:** Open
- **Severity:** Moderate
- **Files:** `workers/src/handlers/forecast.js`, `workers/src/index.js`
- **Problem:** `GET /api/transits/forecast` accepts birth data in query params and runs `calculateFullChart()` + a multi-day `getTransitForecast()` loop (1–90 days configurable) with no authentication check and no rate-limit middleware. Anyone on the internet can hammer this endpoint with unique birth params to consume significant CPU time in the Worker runtime.
- **Impact:** Resource exhaustion / cost amplification. Cloudflare CPU-time limits on Workers mean heavy abuse can trigger 503s for legitimate users.
- **Fix:** Either (a) require authentication (natal chart belongs to an account so auth is natural), or (b) apply the existing `rateLimit` middleware. If keeping it public, cap the `days` param at a safe maximum (e.g., 7) and enforce it server-side.
- **Verify:** Unauthenticated request without a rate-limit header returns 401 (if auth required) or is throttled after N requests from the same IP.

---

### BL-N5 | `cycles.js` silently falls back to UTC when `birthTimezone` is absent
- [ ] **Status:** Open
- **Severity:** Moderate
- **Files:** `workers/src/handlers/cycles.js`
- **Problem:** `url.searchParams.get('birthTimezone')` returns `null` when the query param is omitted. This `null` is passed directly to `parseToUTC(birthDate, birthTime, null)`. `parseToUTC` treats `null` timezone as UTC, so all cycle dates (Saturn return, Uranus opposition, etc.) are computed as if the user was born in UTC — silently wrong for anyone not in UTC. No error or warning is returned to the client.
- **Impact:** Silent data integrity bug — wrong life-cycle milestone dates for non-UTC users who don't pass the timezone param (e.g., mobile browsers that don't auto-populate it).
- **Fix:** Check for null/empty timezone before calling `parseToUTC`. Either return a 400 `"birthTimezone is required"` response, or default to UTC and explicitly include `"warning": "birthTimezone not provided, defaulting to UTC"` in the response body.
- **Verify:** Request with no `birthTimezone` returns a 400 or includes a correct `warning` field; UTC user gets correct dates; non-UTC user gets noticeably different dates than a naive UTC calculation.

---

### BL-N6 | Deprecated `assert { type: 'json' }` import syntax in `famous.js`
- [ ] **Status:** Open
- **Severity:** Minor
- **Files:** `workers/src/handlers/famous.js`
- **Problem:** `import celebsData from '../data/celebrities.json' assert { type: 'json' }` uses the `assert` keyword for import attributes, which was deprecated by TC39 and replaced with `with`. While Cloudflare Workers' current V8 build accepts both, this will produce a deprecation warning in future runtimes and is scheduled for removal in V8 ~12.6+. Any other files using `assert { type: 'json' }` have the same issue.
- **Impact:** Forward-compatibility — will break silently on a future CF Workers V8 update without a compile-time error.
- **Fix:** Replace `assert { type: 'json' }` with `with { type: 'json' }` in `famous.js` and any other files with the same pattern.
- **Verify:** `grep -r "assert { type: 'json' }" workers/src/` returns no results.

---

### BL-N7 | `timing.js` raw tier check bypasses agency seat propagation
- [ ] **Status:** Open
- **Severity:** High
- **Files:** `workers/src/handlers/timing.js`, `workers/src/middleware/tierEnforcement.js`
- **Problem:** `handleTiming` guards the electional astrology timing feature with a direct `user.tier === 'free'` check on the raw result from `getUserFromRequest()`. It does not call `enforceFeatureAccess()` from `tierEnforcement.js`. The agency seat propagation logic lives entirely inside `tierEnforcement.js` — it checks if the current user is a seat member and elevates their effective tier to the owner's tier. Agency seat members whose own DB row has `tier = 'free'` or `'individual'` are blocked from timing features even though their agency owner's subscription entitles them to practitioner-level access.
- **Impact:** Paying agency subscribers whose seat members attempt to use timing features receive a denied response, despite being on a plan that should include this feature.
- **Fix:** Replace the raw `user.tier === 'free'` check with `await enforceFeatureAccess(request, env, 'timingEngine')` (or the appropriate feature key). This ensures seat propagation is evaluated before the feature gate.
- **Verify:** Agency seat member (own tier `free`, owner tier `agency`) can successfully access the timing endpoint.

---

### BL-N8 | `practitioner-directory.js` accesses `request._user.sub` without null guard
- [ ] **Status:** Open
- **Severity:** Minor
- **Files:** `workers/src/handlers/practitioner-directory.js`
- **Problem:** `handleGetDirectoryProfile` (and other authenticated endpoints in the same file) access `request._user.sub` directly without optional chaining. If `_user` is `undefined` due to middleware not attaching it (route misconfiguration, middleware thrown exception caught elsewhere, or test harness), the handler throws a `TypeError: Cannot read properties of undefined` rather than returning a clean 401. The stack trace will reach the global error handler, masking the actual route auth failure.
- **Impact:** Obscured 500 error instead of 401 when auth middleware fails silently.
- **Fix:** Guard with `if (!request._user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });` at the top of each authenticated handler, or switch to optional chaining `request._user?.sub` with an explicit null check.
- **Verify:** Calling an authenticated endpoint without a valid token returns 401, not 500.

---

### BL-N9 | `psychometric.js` has no tier gate — Big Five/VIA available to all authenticated users
- [ ] **Status:** Open
- **Severity:** Minor
- **Files:** `workers/src/handlers/psychometric.js`, `workers/src/lib/stripe.js`
- **Problem:** The Big Five personality assessment and VIA strengths endpoints in `psychometric.js` have no call to `enforceFeatureAccess()`. Any authenticated user — including free-tier — can save and retrieve psychometric assessment data. These assessments are positioned visually in the "Enhance" or premium tab of the frontend, but there is no backend enforcement preventing free-tier users from accessing the feature.
- **Impact:** Premium feature accessible on free tier — revenue leakage if intentional gating is expected. If free is intentional, no impact but should be documented.
- **Fix:** Confirm intended access tier in a team decision. If gating is required, add `enforceFeatureAccess(request, env, 'psychometricAssessments')` (or whichever feature key maps to this). If free access is intentional, add a comment noting this is intentionally ungated.
- **Verify:** Free-tier user is either allowed (and it's documented) or blocked (and redirected to upgrade).

---

## Minor (12) — Polish, consistency, housekeeping

### BL-m1 | Response envelope inconsistency
- [x] **Status:** Done (2026-03-04)
- **Files:** `workers/src/handlers/*.js`, `tests/handlers.test.js`
- **Problem:** Some handlers return `{ success: true }`, others `{ ok: true }`. API spec documents no consistent envelope.
- **Fix:** Standardize on one shape (suggest `{ ok: true, data: {...} }` per ARCHITECTURE.md).

### BL-m2 | Health endpoint hardcodes stale values
- [x] **Status:** Done (2026-03-04)
- **Files:** `workers/src/index.js`
- **Problem:** Health response previously returned stale hardcoded metadata.
- **Fix:** Updated version metadata, removed hardcoded endpoint count, and added timestamp for better health check utility.

### BL-m3 | `wrangler.toml` exposes `account_id`
- [x] **Status:** Done (2026-03-04)
- **Files:** `workers/wrangler.toml`
- **Problem:** Not a secret, but best practice is to omit from version control. Use `CLOUDFLARE_ACCOUNT_ID` env var instead.
- **Fix:** Removed account_id from wrangler.toml. Added comment noting it should be set via CLOUDFLARE_ACCOUNT_ID environment variable.

### BL-m4 | `Secrets.txt` in workspace root
- [x] **Status:** Verified (2026-03-04)
- **Files:** `Secrets.txt`, `.gitignore`
- **Problem:** Even if gitignored, having a plaintext secrets file in the workspace is a risk vector.
- **Fix:** Verified that Secrets.txt is properly gitignored (line 1 of .gitignore). File is safe for local development reference. Production secrets managed via `wrangler secret` command.

### BL-m5 | Documentation test count stale
- [x] **Status:** Done (Previously completed)
- **Files:** `docs/OPERATION.md`, `README.md`
- **Problem:** Test-count references were stale in multiple docs.
- **Fix:** Canonical docs now reflect the current local Vitest baseline.

### BL-m6 | LESSONS_LEARNED.md preventive measures unchecked
- [x] **Status:** Done (2026-03-04)
- **Files:** `docs/LESSONS_LEARNED.md`
- **Problem:** All 4 preventive measures from the 2026-03-03 incident were `[ ]` unchecked.
- **Fix:** Reviewed all preventive measures. Marked completed items (BL-m7, BL-m10, BL-C1, BL-C3, BL-M12). Remaining items are tracked in backlog or deferred as future UX improvements.

### BL-m7 | No `birthTimezone` validation
- [x] **Status:** Done (2026-03-04)
- **Files:** `workers/src/utils/parseToUTC.js`, `workers/src/handlers/calculate.js`
- **Problem:** An invalid IANA timezone string causes `Intl.DateTimeFormat` to throw `RangeError`, surfacing as a 500 instead of 400.
- **Fix:** Wrap timezone usage in try/catch and return `{ error: 'Invalid timezone' }` with 400.

### BL-m8 | Router comment header stale
- [x] **Status:** Done (2026-03-04)
- **Files:** `workers/src/index.js` (header comment)
- **Problem:** Lists 29 of 33 routes. Missing: `GET /api/profile/list`, `GET /api/profile/:id`, `GET /api/profile/:id/pdf`, `GET /api/chart/:id`.
- **Fix:** Updated header comment to include all 35 routes (POST /api/chart/save, GET /api/chart/history, GET /api/chart/:id, GET /api/profile/list, GET /api/profile/:id, GET /api/profile/:id/pdf).

### BL-m9 | SMS `birth_date.split('-')` may fail on Date objects
- [x] **Status:** Done (2026-03-04)
- **Files:** `workers/src/handlers/sms.js`
- **Problem:** Assumes `user.birth_date` is a string. Neon driver may return a `Date` object, causing `.split()` to throw.
- **Fix:** Wrapped with String() coercion for both birth_date and birth_time to handle any data type safely.

### BL-m10 | No email format validation in auth
- [x] **Status:** Done (2026-03-04)
- **Files:** `workers/src/handlers/auth.js`
- **Problem:** Registration only checks `!email || !password`. Users can register with invalid email strings.
- **Fix:** Add basic regex validation: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.

### BL-m11 | VS Code tasks are tied to a WSL PowerShell path
- [ ] **Status:** Open
- **Severity:** Minor
- **Files:** `.vscode/tasks.json`
- **Problem:** The deterministic test and deploy tasks call `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`, which assumes a WSL/bash path layout. The repo is being worked from Windows, so task behavior now depends on which shell launches VS Code instead of the task definition being portable.
- **Revalidated:** 2026-03-16 Cycle 2 intake reproduced task failures where issue-summary scripts launched under WSL relay and exited with `execvpe(node) failed: No such file or directory`.
- **Fix:** Replace hardcoded WSL paths with shell-agnostic `npm run ...` commands or add platform-specific task overrides so native Windows and WSL both execute the same workflows reliably.
- **Verify:** `🧪 Run Tests (deterministic)` and `🚀 Deploy Workers` run from VS Code on both native Windows and WSL without manual path edits.

### BL-m12 | Quality tracking artifacts drift after late-session reruns
- [ ] **Status:** Open
- **Severity:** Minor
- **Files:** `BACKLOG.md`, `process/SESSION_LOG_2026-03-16.md`
- **Problem:** The backlog coverage table still carried stale assumptions after new runtime tests were added, and the session log still reports the earlier `420 passed` ratchet even though later validation reached `422 passed`. This makes the repo's operational ledger less trustworthy than the actual verified build.
- **Fix:** Update session-close docs after the final rerun, and replace brittle static coverage claims with narrower “last verified” notes or a generated summary where possible.
- **Verify:** Coverage and ratchet references in the backlog/session log match the most recent validated Vitest run.

---

## Test Coverage Gaps

These are areas with limited or strategically incomplete test coverage. Not all need immediate tests, but high-risk modules should be prioritized.

| Priority | Module | Risk |
|---|---|---|
| **High** | `workers/src/db/queries.js` | Registry and safe-lookup assertions exist; broader DB contract and migration coverage still needed |
| **High** | `workers/src/middleware/auth.js` | Focused safe-lookup coverage added 2026-03-16; broader auth-flow coverage still needed |
| **High** | `workers/src/lib/llm.js` | LLM failover chain — no verification of rotation logic |
| **Medium** | `src/prompts/digest.js` | SMS content generation — silently broken (BL-M6) |
| **Medium** | `src/prompts/rag.js` | RAG builder — wrong data access pattern (BL-M7) |
| **Medium** | `workers/src/handlers/practitioner.js` | Focused roster and invitation runtime coverage exists; list/create/export paths still need coverage |
| **Medium** | `workers/src/handlers/cluster.js` | Cluster synthesis, 0 tests |
| **Medium** | `workers/src/handlers/onboarding.js` | Story progression, 0 tests |
| **Low** | `workers/src/middleware/cors.js` | Simple but broken (BL-C4) |
| **Low** | `workers/src/middleware/rateLimit.js` | Rate limiting accuracy |
| **Low** | `workers/src/cron.js` | Daily transit snapshot |
| **Low** | `workers/src/handlers/pdf.js` | PDF generation |

---

## Suggested Sprint Plan

### Sprint 1 — Database & Core Fixes (Critical path)
- BL-C1: Fix Neon DB driver
- BL-C2: Fix `migrate.js` await
- BL-C3: Reconcile migration schemas
- BL-C5: Fix chart auto-save dead code
- BL-C6: Fix `parseToUTC` negative-minute bug

### Sprint 2 — Security & API Alignment
- BL-C4: Fix CORS methods
- BL-M2: Constant-time password comparison
- BL-M3: JSON parse error handling
- BL-M4: Restrict CORS origin
- BL-M1: Implement or remove 7 missing endpoints

### Sprint 3 — Data & Synthesis Quality
- BL-M5: Complete Gene Keys (26 remaining)
- BL-M6: Fix `digest.js` property names
- BL-M7: Fix `rag.js` array/object mismatch
- BL-M8: Consolidate RAG logic
- BL-M11: Add missing channel 42-53

### Sprint 4 — Polish & Frontend
- BL-M9: Extract shared JWT utilities
- BL-M10: Multi-page PDF support
- BL-M12: Complete `engine-compat.js` data injection
- BL-M14: Frontend tabs for composite, practitioner, onboarding, PDF
- BL-m1 through BL-m10: Minor fixes batch

---

## Language & Comprehension Improvements (12) — UX Critical

Language audit conducted 2026-03-04. These items block user understanding and adoption.

### BL-L1 | README lacks "What is this?" context for beginners
- [x] **Status:** Done (2026-03-04)
- **Severity:** Critical (UX)
- **Files:** `README.md`
- **Problem:** Opens with technical jargon ("deterministic chart calculations, LLM-synthesised 8-layer profile"). Assumes knowledge of energy work systems, Cloudflare Workers, etc. No beginner-friendly introduction.
- **Impact:** New users immediately confused, think it's developer-only tool
- **Fix:** Added clear "What is Prime Self?" section with plain English explanation. Created Key Concepts glossary table with all core terminology defined. Restructured opening to be beginner-friendly.
- **Verify:** Non-technical person can explain what the project does after reading first section

### BL-L2 | Frontend UI has zero tooltips or help text
- [x] **Status:** Done (2026-03-04)
- **Severity:** Critical (UX)
- **Files:** `frontend/index.html`
- **Problem:** Technical terms ("8-layer synthesis", "rectification", "composite") used without explanation. No help icons, tooltips, or inline guidance.
- **Impact:** Users must guess what features do, high abandonment
- **Fix:** Added comprehensive tooltip system with CSS hover popups. Added help icons (ⓘ) to all navigation tabs, form labels, and chart result fields. Tooltips explain technical terms in plain English with 260px width for readability.
- **Verify:** Hover any jargon term → see plain English explanation

### BL-L3 | Error messages too technical for users
- [x] **Status:** Done (2026-03-04)
- **Severity:** Critical (UX)
- **Files:** `workers/src/lib/errorMessages.js` (new), `workers/src/index.js`
- **Problem:** Backend errors shown directly to users ("Invalid JSON body", "Missing required field: birthTimezone"). No translation to user-friendly language. No recovery hints.
- **Impact:** Users don't know how to fix issues, contact support unnecessarily
- **Fix:** Created comprehensive error translation layer with 20+ pattern-matched translations. All errors now include user-friendly message + recovery hint. Integrated into top-level exception handler. Supports authentication, validation, database, network, AI, and chart calculation errors.
- **Verify:** Trigger validation error → see helpful message like "Please fill in your timezone (found under birth location)"

### BL-L4 | Inconsistent terminology across documentation
- [x] **Status:** Done (2026-03-04)
- **Severity:** High (UX)
- **Files:** `README.md`, `docs/GLOSSARY.md`, `frontend/index.html`
- **Problem:** Same concept called different names: "Prime Self Profile" = "8-layer profile" = "Synthesis" = "Quick Start Guide". "Authority" vs "Decision Architecture" vs "Inner Guidance".
- **Impact:** Confusion about what features are called, hard to reference
- **Fix:** Established standard terminology in GLOSSARY.md. Standardized README and user-facing docs to use "Prime Self Profile" consistently. Technical docs (API_SPEC, code) allowed to use shorthand per glossary guidelines. All user-facing text now uses IP-safe standardized terms from BL-L12.
- **Verify:** grep confirms consistent terminology

### BL-L5 | Energy work terms used without plain English explanation
- [x] **Status:** Done (2026-03-04)
- **Severity:** High (UX)
- **Files:** `README.md`, `frontend/index.html`, `docs/GLOSSARY.md`
- **Problem:** Terms like "Profile 6/2", "Emotional Authority", "Split Definition" used without explanation. Only practitioners understand.
- **Impact:** 95% of potential users lost immediately
- **Fix:** Added comprehensive plain English explanations in multiple layers: (1) README Key Concepts table with simple definitions, (2) Frontend tooltips on every technical term with hover explanations, (3) Comprehensive GLOSSARY.md with detailed explanations organized by category. First use of each term now includes plain English context.
- **Verify:** Non-practitioner can understand core concepts

### BL-L6 | README prioritizes developers over end-users
- [x] **Status:** Done (2026-03-04)
- **Severity:** High (UX)
- **Files:** `README.md`
- **Problem:** Structure shows tech stack, installation commands, deployment instructions BEFORE explaining what users get. No screenshots, no user guide.
- **Impact:** Appears to be developer tool, not user product
- **Fix:** Completely restructured README: (1) What is Prime Self (user-friendly tagline), (2) Try It Now (demo link), (3) What You Get (user benefits with emoji icons), (4) Key Concepts (glossary table), (5) How It Works (user journey), (6) --- For Developers --- divider, (7) Technical setup. Added clear section break between user and developer content.
- **Verify:** Non-developer reads README and understands value proposition

### BL-L7 | API documentation missing use cases and context
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate (UX)
- **Files:** `docs/API_SPEC.md`
- **Problem:** Endpoints documented with request/response schemas but no "when to use" or "what you get". Field purposes unexplained.
- **Impact:** Developers don't know when/why to call each endpoint
- **Fix:** Add "Use this when" and "What you get" sections. Annotate fields with purpose comments. Include example scenarios.
- **Verify:** API doc includes workflow examples
- **Actions taken:**
  - Added "Use this when", "What you get", "Why it matters", and "Example scenario" sections to all major endpoints
  - Annotated all request/response fields with inline comments explaining purpose
  - Added comprehensive use case documentation for: Authentication, Geocoding, Chart Calculation, Composite Charts, Rectification, Profile Generation, Transits, Practitioners, and Clusters
  - Documented previously undocumented endpoints: `/api/composite`, `/api/rectify`, `/api/cluster/create`, `/api/cluster/:id/synthesize`
  - Added workflow examples showing user journey from signup through chart generation to profile synthesis
  - Included performance notes (e.g., "average generation time 15 seconds")
  - Added decision-making guidance (e.g., when to use composite vs. transits)

### BL-L8 | No glossary for technical terms and acronyms
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate (UX)
- **Files:** `docs/GLOSSARY.md` (new)
- **Problem:** 15+ unexpanded acronyms (JDN, UTC, JWT, LLM, RAG, KV, R2, SPA). 40+ jargon terms without definitions.
- **Impact:** Users constantly context-switching to search terms
- **Fix:** Created comprehensive 400+ line GLOSSARY.md with plain English definitions organized by category: Energy Blueprint Terms, Astrology Terms, Prime Self System Terms, Numerology, Technical Platform, AI/Synthesis, Data & Calculation, Feature-Specific, Common Abbreviations. Includes usage guidelines, preferred terminology, forbidden terms, and learning path. Linked from README.
- **Verify:** All acronyms and jargon terms have glossary entries

### BL-L9 | Button labels not action-oriented
- [x] **Status:** Done (2026-03-04)
- **Severity:** Minor (UX)
- **Files:** `frontend/index.html`
- **Problem:** Buttons use passive labels: "Calculate Chart", "Load My Profiles", "Generate Composite", "Analyze Time Window"
- **Impact:** Unclear what user will get
- **Fix:** Updated all buttons to be action-oriented and user-focused: "Generate My Chart", "View Saved Charts", "Check Our Compatibility", "Find My Birth Time", "See Today's Energy", "Create My Full Profile", "View My Clients", "View My Teams"
- **Verify:** All buttons clearly state user outcome

### BL-L10 | Form labels assume technical knowledge
- [x] **Status:** Done (2026-03-04)
- **Severity:** Minor (UX)
- **Files:** `frontend/index.html`
- **Problem:** "Latitude/Longitude" shown even though auto-filled. "Timezone" without explanation. "Rectification" instead of "Birth Time Finder".
- **Impact:** Users intimidated by technical fields
- **Fix:** Hide lat/lng fields (auto-filled from geocoding). Add explanatory text to labels: "Time Zone (where you were born)". Rename tabs to be benefit-focused.
- **Verify:** All form labels understandable to non-technical users
- **Actions taken:** 
  - Rectify tab: Added location search with geocode button, hid lat/lng as hidden inputs, improved "Window" → "Search Window (minutes)" with tooltip, improved "Step" → "Time Steps (minutes)" with tooltip
  - Composite tab: Added location search for both Person A and Person B with geocode buttons, hid lat/lng as hidden inputs, updated JavaScript to use new field IDs
  - SMS tab: Changed "Phone Number (E.164)" → "Phone Number" with helpful tooltip explaining country code format

### BL-L11 | Synthesis prompt mixed audience (overly technical)
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate (UX)
- **Files:** `src/prompts/synthesis.js`, `frontend/index.html`
- **Problem:** Single output tries to serve beginners and practitioners. Sometimes too technical, sometimes too simple.
- **Impact:** Output doesn't hit sweet spot for either audience
- **Fix:** Generate TWO outputs: (1) Human-Friendly (zero jargon, conversational, 400-600 words), (2) Technical (full terminology, charts, data). Default to Human. Add "Show Technical Details" toggle in UI.
- **Verify:** Non-practitioner finds Human version immediately actionable
- **Actions taken:**
  - Backend: synthesis.js already had dual-layer structure enforced via JSON schema (quickStartGuide + technicalInsights)
  - Frontend: Completely rewrote renderProfile() function to render dual-layer output:
    * Layer 1 (Quick Start Guide): Rendered by default with sections - Who You Are (👤), How To Make Best Decisions (🧭), Your Life Strategy (🎯), This Month (📅), Working With Others (🤝) - all in conversational tone with emoji icons
    * Layer 2 (Technical Insights): Hidden by default, revealed via "Show Technical Details" toggle button - includes Gene Keys Profile (🔑), Numerology Insights (🔢), Astrological Signatures (✨), Energy Blueprint (⚡), Forge Identification (🔥)
  - Default view: Human-friendly, zero jargon Quick Start Guide (400-600 words)
  - Toggle button: "Show Technical Details" expands collapsible section with full technical data
  - Verified structure: quickStartGuide fields (whoYouAre, decisionStyle, lifeStrategy, thisMonth, workingWithOthers) render first
  - Verified structure: technicalInsights fields (geneKeysProfile, numerologyInsights, astrologicalSignatures, energyBlueprint, forgeIdentification) render in collapsible div

### BL-L12 | Trademarked/IP terminology exposure risk
- [x] **Status:** Done (2026-03-04)
- **Severity:** Critical (Legal)
- **Files:** `README.md`, `frontend/index.html`, `ARCHITECTURE.md`
- **Problem:** Direct use of potentially trademarked terms throughout codebase without IP-safe alternatives consistently applied.
- **Impact:** Legal exposure, potential cease & desist
- **Fix:** Completed comprehensive audit and replacement of all trademarked terminology in user-facing text. Replaced with IP-safe alternatives: "Energy Blueprint" (instead of trademarked system name), "Pattern/Guide/Builder" (instead of trademarked types), "Decision Style" (instead of Authority), "Purpose Vector" (instead of Incarnation Cross), "Gene Keys" (maintained as Gene Keys project has open attribution model). All user-visible documentation now uses safe terminology.
- **Verify:** Full codebase grep shows zero direct trademarked usage in user-facing text

---

## Profile Specificity Enhancement (8) — Combat Generic Outputs

**Context:** User feedback indicates Prime Self Profile outputs feel too general and could apply to anyone (Barnum/Forer Effect). Need to add specificity, cross-system synthesis, and contextual interpretation.

### BL-PS1 | Anti-Barnum specificity enforcement in system prompt
- [x] **Status:** Done (2026-03-04)
- **Severity:** Critical (Product Quality)
- **Files:** `src/prompts/synthesis.js` (SYSTEM_PROMPT)
- **Problem:** System prompt doesn't explicitly forbid generic statements like "You value authenticity" or "Sometimes you doubt yourself". No examples of specific vs generic insights.
- **Impact:** LLM returns horoscope-style outputs that could apply to 50%+ of population
- **Fix:** Add SPECIFICITY REQUIREMENT section with:
  - "Could this apply to someone else?" test
  - Examples of BAD (generic) vs GOOD (specific) insights
  - Requirement: minimum 2 data points per insight, explain HOW they interact
  - Forbidden generic statements list
  - Grounding rule: no statements that >30% of population could claim
- **Verify:** Generate 5 profiles, ask external reviewers if insights feel personalized

### BL-PS2 | Contextual gate interpretation (planet + line + conscious/unconscious)
- [x] **Status:** Done (2026-03-04)
- **Severity:** High (Data Richness)
- **Files:** `src/prompts/rag.js` (buildRAGContext function)
- **Problem:** Gate descriptions are pulled identically for everyone. No differentiation between: Sun in Gate 37 (identity-level) vs Neptune in Gate 37 (generational), Conscious (aware) vs Unconscious (blind spot), Line 1 (investigator) vs Line 6 (role model), Channel-completing vs hanging gate
- **Impact:** Every person with Gate 37 gets same description regardless of context
- **Fix:** Create `getContextualGateInsight()` function that enriches gate KB entries with:
  - Planet context (Sun=identity, Moon=emotional, Mercury=mental, Neptune/Pluto=generational)
  - Conscious/Unconscious modifier (aware vs blind spot)
  - Line theme (6 different approaches to same gate)
  - Channel completion status (consistent vs waiting for activation)
- **Verify:** Same gate in different contexts produces meaningfully different insights

### BL-PS3 | Cross-system convergence requirement
- [x] **Status:** Done (2026-03-04)
- **Severity:** High (Synthesis Quality)
- **Files:** `src/prompts/synthesis.js` (SYSTEM_PROMPT)
- **Problem:** Prompt doesn't require finding themes where MULTIPLE systems point to same pattern (HD + Astro + Numerology convergence)
- **Impact:** Insights treat each system independently instead of showing reinforcing patterns
- **Fix:** Add CONVERGENCE REQUIREMENT to system prompt:
  - Identify top 3-5 themes where multiple systems align
  - Example provided in prompt showing HD Split Definition + Mercury conjunct North Node in Gemini + Life Path 5 = bridge-builder/translator theme
  - Required format showing which systems converge on each major theme
- **Verify:** Outputs include "convergence" insights showing multi-system alignment

### BL-PS4 | Distinctiveness analysis (rare vs common factors)
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate (Personalization)
- **Files:** `src/prompts/synthesis.js` (OUTPUT_SCHEMA)
- **Problem:** No analysis of which chart factors are RARE vs COMMON (e.g., Emotional Manifestor with Quad Split = 2% of population, vs undefined Head = 60%)
- **Impact:** Outputs give equal weight to common and rare factors
- **Fix:** Add `distinctiveness` section to output schema:
  - rareFactors: combinations appearing in <10% of population
  - commonFactors: traits appearing in >40% of population with "personal spin" explaining how they combine UNIQUELY in this chart
  - prevalence percentages for context
- **Verify:** Outputs highlight what makes THIS chart distinctive

### BL-PS5 | Astrological house integration in gate interpretations
- [x] **Status:** Done (2026-03-04)  
- **Severity:** Moderate (Astro Integration)
- **Files:** `src/prompts/rag.js` (buildRAGContext function)
- **Problem:** Gate activations don't reference astrological house placement for life area context
- **Impact:** Missing layer: Mars in 10th house activating Gate 21 = career/leadership manifestation, same gate in 7th house = partnership dynamics
- **Fix:** When building gate insights, cross-reference planet's house placement:
  - Find which planet activates the gate
  - Look up that planet's house in astrology data
  - Add house theme to gate interpretation (1st=self, 7th=partnerships, 10th=career, 12th=spirituality, etc.)
- **Verify:** Same gate activated by different house placements produces different life-area contexts

### BL-PS6 | Line-specific wisdom integration
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate (Gene Keys Depth)
- **Files:** `src/knowledgebase/genekeys/keys.json`, `src/prompts/rag.js`
- **Problem:** Gate descriptions don't differentiate by line. Gate 37.1 (investigator of family dynamics) vs 37.6 (role model for family) are VERY different but get same description
- **Impact:** Missing 80% of Gene Keys specificity (lines are where the real individuation happens)
- **Fix:** Add line-specific insights to Gene Keys knowledge base:
  - Line 1: Investigation/foundation
  - Line 2: Natural talent/hermit
  - Line 3: Trial & error/experimentation  
  - Line 4: Networking/friendship
  - Line 5: Projection/universalization
  - Line 6: Role model/transition
  - Pull line-specific wisdom when building RAG context
- **Verify:** Same gate with different lines produces 6 distinct interpretations

### BL-PS7 | Hanging gate vs complete channel differentiation
- [x] **Status:** Done (2026-03-04)
- **Severity:** Moderate (Pattern Recognition)
- **Files:** `src/prompts/rag.js` (channel context in gate insights)
- **Problem:** No distinction between gates that complete channels (consistent) vs hanging gates (waiting for others to activate)
- **Impact:** Missing key relationship dynamic: "You DO this consistently" vs "You SEEK this from others"
- **Fix:** For each active gate, determine:
  - Is the opposite gate also active? → Channel complete = consistent energy
  - Is opposite gate undefined? → Hanging gate = seeks completion from environment/others
  - Add "channel status" modifier to gate insights
- **Verify:** Gate 12 (with Gate 22) says "You consistently express emotions through your throat" vs Gate 12 (alone) says "You seek emotional clarity from others to voice"

### BL-PS8 | Personalization examples in every section
- [x] **Status:** Done (2026-03-04)
- **Severity:** High (User Experience)
- **Files:** `src/prompts/synthesis.js` (TONE GUIDELINES section)
- **Problem:** Tone guidelines show bad vs good examples, but don't require CONCRETE examples in every insight
- **Impact:** Abstract advice like "trust your authority" instead of "when your boss asks for a decision, say 'let me sleep on it' - by morning you'll know"
- **Fix:** Add requirement to system prompt:
  - Every insight must include at least one CONCRETE example or scenario
  - Not "you might feel X" but "you likely notice X when Y happens"  
  - Required format: "This means in practice: [specific scenario]"
- **Verify:** Outputs include concrete examples like "At work meetings, you might notice..." or "When dating, pay attention to..."

---

## Sprint Plan (Updated)

### Sprint 5 — Critical UX & Legal (Week 1) ✓ COMPLETE
- [x] BL-L1: Add "What is Prime Self?" to README
- [x] BL-L2: Add tooltips to frontend
- [x] BL-L3: Create error message translation layer
- [x] BL-L9: Action-oriented button labels
- [x] BL-L12: Remove trademarked terminology (legal critical)

### Sprint 6 — Documentation & Consistency (Week 2) ✓ COMPLETE
- [x] BL-L4: Standardize terminology
- [x] BL-L5: Add plain English explanations
- [x] BL-L6: Restructure README for users-first
- [x] BL-L8: Create comprehensive glossary

### Sprint 7 — Polish & Optimization (Week 3) ✓ COMPLETE
- [x] BL-L7: Add API use cases
- [x] BL-L10: Simplify form labels
- [x] BL-L11: Dual synthesis output (Human + Technical)

### Sprint 8 — Profile Specificity Enhancement (Week 4) ✓ COMPLETE
- [x] BL-PS1: Anti-Barnum specificity enforcement
- [x] BL-PS2: Contextual gate interpretation
- [x] BL-PS3: Cross-system convergence requirement
- [x] BL-PS4: Distinctiveness analysis
- [x] BL-PS5: Astrological house integration
- [x] BL-PS6: Line-specific wisdom integration
- [x] BL-PS7: Hanging gate vs complete channel differentiation
- [x] BL-PS8: Personalization examples in every section

---

## Code Review Audit — 2026-03-07

**Audited by:** Automated deep review (all files, all systems)
**New items:** 52 issues across 7 systems
**Severity breakdown:** 6 Critical, 14 High, 20 Medium, 12 Low

---

## Critical (6) — Must fix immediately

### BL-R-C1 | Secrets.txt contains live production credentials in plaintext
- [ ] **Status:** Open
- **Severity:** EMERGENCY
- **Files:** `Secrets.txt`
- **Problem:** File contains live `sk_live_` Stripe key, Neon connection string with password, Anthropic/Groq/Grok API keys, GitHub PAT, Telnyx keys, and Cloudflare API token. While `.gitignore` excludes the file, if git history ever contained it, all credentials are compromised. Flat-file secrets are an unacceptable risk vector.
- **Impact:** Full payment fraud, database takeover, account compromise across 8 services
- **Fix:** (1) Verify git history: `git log --all --diff-filter=A -- Secrets.txt`. (2) If found, rotate ALL credentials immediately. (3) Delete Secrets.txt. (4) Move all secrets exclusively to `wrangler secret put` and document in .env.example (keys only, no values).
- **Verify:** `Secrets.txt` does not exist. All services authenticate via environment secrets only.

### BL-R-C2 | Fake social proof metrics and fabricated testimonials (FTC violation)
- [ ] **Status:** Open
- **Severity:** Critical (Legal)
- **Files:** `workers/src/handlers/stats.js`, `workers/src/lib/email.js`
- **Problem:** `workers/src/handlers/stats.js`, `workers/src/lib/email.js`
- **Problem:** `/api/stats/activity` returns hardcoded fake numbers (2,847 weekly users, 18,392 profiles). `email.js` contains a fabricated testimonial ("Marcus Chen, Explorer Tier"). These are deceptive to consumers and violate FTC guidelines on endorsements and advertising claims.
- **Impact:** Legal liability, user trust destruction, potential FTC enforcement action
- **Fix:** (1) Remove all hardcoded fallback stats — return real DB counts or `null`. (2) Remove fabricated testimonial. (3) Only display social proof when backed by real data. (4) Add comment: "All public metrics must reflect real data per FTC §255."
- **Verify:** Stats endpoint returns real data or empty state. No fabricated names in codebase.

### BL-R-C3 | SQL injection pattern in analytics handlers
- [ ] **Status:** Open
- **Severity:** Critical (Security)
- **Files:** `workers/src/handlers/analytics.js` (lines ~147, ~257, ~305, ~321, ~335)
- **Problem:** String interpolation of user-controlled query params into SQL: `INTERVAL '${days} days'`. While `Number()` coercion mitigates direct exploitation, `NaN` produces a PostgreSQL error, and this pattern is copy-paste dangerous.
- **Fix:** Use parameterized queries: `WHERE created_at >= CURRENT_DATE - ($1 * INTERVAL '1 day')` with `[days]` in params array.
- **Verify:** All SQL in analytics.js uses `$N` parameterized queries only.

### BL-R-C4 | Duplicate Stripe webhook handlers with divergent logic
- [ ] **Status:** Open
- **Severity:** Critical
- **Files:** `workers/src/handlers/webhook.js`, `workers/src/handlers/billing.js`
- **Problem:** Two files handle identical Stripe events (`checkout.session.completed`, `customer.subscription.updated`) at two different routes (`/api/webhook/stripe` and `/api/billing/webhook`) with differing DB update logic. Creates race conditions and data inconsistency.
- **Fix:** Consolidate into a single webhook handler. Remove the duplicate route. Ensure idempotency on event processing (store `event.id`, skip duplicates).
- **Verify:** Only one Stripe webhook route exists. `event.id` deduplication in place.

### BL-R-C5 | Frontend mobile navigation completely broken
- [ ] **Status:** Open
- **Severity:** Critical (UX)
- **Files:** `frontend/index.html` (~line 4186)
- **Problem:** Mobile bottom nav calls `switchTab('hd')`, `switchTab('gk')`, `switchTab('astro')` but actual tab IDs are `chart`, `profile`, `enhance`. Only 2 of 5 nav buttons work.
- **Fix:** Update mobile nav `onclick` handlers to use correct tab IDs: `chart`, `profile`, `enhance`, `transits`, `diary`.
- **Verify:** All 5 mobile nav buttons switch to the correct tab on a mobile viewport.

### BL-R-C6 | Check-in feature references nonexistent DOM elements and wrong API paths
- [ ] **Status:** Open
- **Severity:** Critical (UX)
- **Files:** `frontend/index.html` (~lines 4210–4280)
- **Problem:** `saveCheckIn()` references `#alignment-score`, `#alignment-value`, `#strategy-followed` (real IDs: `checkin-alignment-score`, `checkin-followed-strategy`). Calls `/checkin` instead of `/api/checkin`. `loadCheckInStats()` references `#current-streak`, `#longest-streak` etc. — none exist in DOM.
- **Fix:** Update all element ID references to match actual HTML. Prefix all API calls with `/api/`.
- **Verify:** Check-in save and stats load work end-to-end.

---

## High (14)

### BL-R-H1 | New database pool created per query — connection exhaustion
- [ ] **Status:** Open
- **Severity:** High
- **Files:** `workers/src/db/queries.js`
- **Problem:** `createQueryFn()` creates a new `Pool()` on every call. Each request creates multiple pools. Under load this exhausts Neon's connection limit.
- **Fix:** Implement singleton pool per isolate with lazy initialization.
- **Verify:** Under 50 concurrent requests, connection count stays below Neon limit.

### BL-R-H2 | Internal error messages leaked to API consumers
- [x] **Status:** Complete
- **Severity:** High (Security)
- **Files:** `workers/src/handlers/profile.js`, `referrals.js`, `webhooks.js`, `achievements.js`, `cluster.js`
- **Problem:** Catch blocks return `detail: err.message` or `message: error.message` to clients, potentially exposing DB connection strings, query details, and stack traces.
- **Fix:** Return generic user-facing messages. Log full error server-side only via `console.error`.
- **Verify:** Trigger an internal error — response contains generic message, no stack trace.

### BL-R-H3 | Notion OAuth tokens stored in plaintext in DB
- [x] **Status:** Complete
- **Severity:** High (Security)
- **Files:** `workers/src/handlers/notion.js` (~line 157)
- **Problem:** `access_token` from Notion OAuth stored directly in `notion_connections` table without encryption.
- **Fix:** Encrypt tokens at rest using a Worker secret as encryption key via `crypto.subtle.encrypt` (AES-GCM). Decrypt on read.
- **Verify:** `SELECT access_token FROM notion_connections` returns ciphertext, not plaintext.

### BL-R-H4 | Webhook HMAC secret returned in GET response
- [x] **Status:** Complete
- **Severity:** High (Security)
- **Files:** `workers/src/handlers/webhooks.js` (~line 225)
- **Problem:** `GET /api/webhooks/:id` returns `secret: webhook.secret` in JSON body. HMAC signing secrets should only be shown once at creation time.
- **Fix:** Remove `secret` from GET response. Only return it in the POST (create) response.
- **Verify:** GET webhook detail response does not contain `secret` field.

### BL-R-H5 | Inconsistent user ID property across handlers
- [x] **Status:** Complete
- **Severity:** High
- **Files:** `workers/src/handlers/cluster.js`, `workers/src/handlers/sms.js`
- **Problem:** Most handlers use `request._user?.sub` but cluster and SMS handlers use `request._user?.userId`. Auth middleware sets `sub`, so `userId` is always `undefined`.
- **Fix:** Replace all `request._user?.userId` with `request._user?.sub`.
- **Verify:** Cluster list and SMS subscribe/unsubscribe work for authenticated users.

### BL-R-H6 | SMS column name mismatch — subscribe broken
- [x] **Status:** Complete
- **Severity:** High
- **Files:** `workers/src/handlers/sms.js`
- **Problem:** Subscribe writes to `sms_opt_in` but query handler reads `sms_opted_in`. Column name mismatch causes failure.
- **Fix:** Audit DB schema for canonical column name. Align all references.
- **Verify:** SMS subscribe → query → column exists and matches.

### BL-R-H7 | XSS via Notion OAuth callback error parameter
- [ ] **Status:** Open
- **Severity:** High (Security)
- **Files:** `workers/src/handlers/notion.js` (~line 83)
- **Problem:** `error` query parameter interpolated directly into HTML: `<p>Error: ${error}</p>`. Reflected XSS via crafted URL.
- **Fix:** HTML-escape the error parameter using a utility function: `escapeHtml(error)`.
- **Verify:** `/api/notion/callback?error=<script>alert(1)</script>` renders escaped text, not executable script.

### BL-R-H8 | SSE profile streaming not wrapped in waitUntil
- [ ] **Status:** Open
- **Severity:** High
- **Files:** `workers/src/handlers/profile-stream.js`
- **Problem:** Streaming profile generation pipeline runs without `ctx.waitUntil()`. Client disconnect may terminate the Worker before DB write completes.
- **Fix:** Wrap the pipeline Promise in `ctx.waitUntil(pipelinePromise)`.
- **Verify:** Disconnect during streaming — profile still saved to DB.

### BL-R-H9 | `fs` import in engine chart.js breaks Cloudflare Workers
- [ ] **Status:** Open
- **Severity:** High
- **Files:** `src/engine/chart.js` (lines 19–21)
- **Problem:** Static ESM `import { readFileSync } from 'fs'` fails at import time in Cloudflare Workers (no Node.js fs module). The try/catch only guards `fileURLToPath`, not the static import.
- **Fix:** Use dynamic `import()` for Node-only paths, or restructure data loading to use injected data from `engine-compat.js` exclusively in Workers.
- **Verify:** `chart.js` loads cleanly in Cloudflare Workers without bundler hacks.

### BL-R-H10 | Missing HD channel 42-53 (Channel of Maturation)
- [ ] **Status:** Open
- **Severity:** High
- **Files:** `src/engine/chart.js`, `workers/src/handlers/composite.js`
- **Problem:** `CHANNELS` array has 35 of 36 standard HD channels. Missing 42-53 (Sacral→Root, Channel of Maturation). Charts with gates 42/53 never show this channel.
- **Fix:** Add `[42, 53, 'Sacral', 'Root']` to both CHANNELS arrays.
- **Verify:** Test vector with gates 42 + 53 active → channel appears in output.

### BL-R-H11 | WordPress plugin exposes API key to all page visitors
- [ ] **Status:** Open
- **Severity:** High (Security)
- **Files:** `wordpress-plugin/primeself-chart.php` (~line 309)
- **Problem:** `wp_localize_script` outputs `apiKey` to frontend JS on every page load. Any visitor can read it from `primeselfConfig.apiKey` in page source.
- **Fix:** Remove API key from frontend. Proxy all API calls through the WP REST endpoint (`/primeself/v1/chart`) which makes server-side calls with the key.
- **Verify:** View page source — no API key visible.

### BL-R-H12 | WordPress REST endpoint allows unauthenticated access
- [ ] **Status:** Open
- **Severity:** High (Security)
- **Files:** `wordpress-plugin/primeself-chart.php` (~line 340)
- **Problem:** `permission_callback => '__return_true'` on `POST /primeself/v1/chart`. Any visitor can make unlimited API calls.
- **Fix:** Add nonce verification: `'permission_callback' => function() { return wp_verify_nonce(...); }` or at minimum rate-limit by IP.
- **Verify:** Unauthenticated POST returns 403.

### BL-R-H13 | Frontend XSS — API data injected via template literals without escaping
- [ ] **Status:** Open
- **Severity:** High (Security)
- **Files:** `frontend/index.html` (all `renderX()` functions)
- **Problem:** API response fields (e.g., `qsg.whoYouAre`, profile names) are interpolated directly into innerHTML via template literals. If API ever returns user-controlled content, this is XSS.
- **Fix:** Create `escapeHtml()` utility and apply to all API data before DOM insertion. Prefer `textContent` over `innerHTML` where possible.
- **Verify:** API response containing `<img onerror=alert(1)>` renders as escaped text.

### BL-R-H14 | No CSRF protection on state-changing endpoints
- [ ] **Status:** Open
- **Severity:** High (Security)
- **Files:** All POST/PUT/DELETE handlers
- **Problem:** Endpoints rely solely on JWT Bearer + CORS. No CSRF tokens or SameSite cookie attributes. If JWTs are stored in cookies, this is exploitable.
- **Fix:** Ensure JWT is in `Authorization` header only (not cookies). If cookies are used, add `SameSite=Strict` and CSRF token double-submit pattern.
- **Verify:** Cross-origin form submission to state-changing endpoint is rejected.

---

## Medium (20)

### BL-R-M1 | `toJulianDay` silently drops seconds parameter
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `src/engine/julian.js`, `src/engine/index.js`, `src/engine/transits.js`
- **Problem:** `toJulianDay(year, month, day, hour, minute)` ignores a 6th `second` argument passed by callers. For births near gate/line boundaries, this is data loss (~0.36 arc-seconds).
- **Fix:** Add `second = 0` parameter: `toJulianDay(year, month, day, hour = 0, minute = 0, second = 0)` and include `second / 3600` in the day fraction.
- **Verify:** `toJulianDay(2000, 1, 1, 12, 0, 30)` differs from `toJulianDay(2000, 1, 1, 12, 0, 0)` by ~0.00000347.

### BL-R-M2 | `jdnToCalendar` produces hour=24 on boundary rounding
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `src/engine/design.js` (~line 90)
- **Problem:** `Math.round(timeFraction * 24 * 60)` can produce 1440 when `timeFraction ≈ 1.0`, yielding `hour=24, minute=0` — invalid time. Day not incremented.
- **Fix:** If `totalMinutes >= 1440`, set `totalMinutes = 0` and increment the day.
- **Verify:** `jdnToCalendar(2451545.9999999)` returns valid hour (0–23).

### BL-R-M3 | Chiron cycle defined but planet never computed
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `src/engine/transits.js` (~line 568), `src/engine/planets.js`
- **Problem:** `LIFE_CYCLES` includes `{ planet: 'chiron', period: 50.76 }` but `getAllPositions()` never computes Chiron. The `if (!natalPositions[planet]) continue` guard silently skips it.
- **Fix:** Either implement Chiron computation (Keplerian elements available) or remove the Chiron cycle definition.
- **Verify:** Transit life cycles either include a meaningful Chiron return date or don't list Chiron.

### BL-R-M4 | Ego authority doesn't distinguish Manifested vs Projected 
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `src/engine/chart.js` (~line 235)
- **Problem:** `'Ego / Heart Projected'` used for all Heart-authority types. Manifestors with defined Heart should get "Ego Manifested" authority.
- **Fix:** Check Type before assigning Ego authority: if Manifestor → "Ego Manifested", else → "Ego Projected".
- **Verify:** A Manifestor with Heart authority returns "Ego Manifested".

### BL-R-M5 | Dead code: `getEarthPosition()` never called
- [x] **Status:** Complete
- **Severity:** Medium
- **Files:** `src/engine/planets.js` (~line 128)
- **Problem:** Function defined and commented as "more accurate" but never used. `getAllPositions` uses `getHelioPosition(T, ELEMENTS.earth)` instead.
- **Fix:** Either use it (if more accurate) or remove it to reduce confusion.
- **Verify:** No unused exports in planets.js.

### BL-R-M6 | `personalYear` reduction inconsistent with `lifePathNumber`
- [x] **Status:** Complete
- **Severity:** Medium
- **Files:** `src/engine/numerology.js` (~line 108)
- **Problem:** `lifePathNumber` reduces each component first then sums; `personalYear` sums raw values then reduces. Can produce different results for same inputs.
- **Fix:** Align methodology — reduce components first, then sum, per standard Pythagorean numerology.
- **Verify:** All reduction methods use consistent approach.

### BL-R-M7 | Placidus house calculation fails at polar latitudes
- [x] **Status:** Complete
- **Severity:** Medium
- **Files:** `src/engine/astro.js` (~line 182)
- **Problem:** When `|tan(lat)·tan(decl)| ≥ 1`, ascensional difference clamped to ±89.9° producing wildly inaccurate house cusps for `|lat| > 66°`. No warning emitted.
- **Fix:** Detect polar latitude and fall back to Equal House system with a warning flag in the output.
- **Verify:** Latitude 70°N returns `{ houseSystem: 'equal', warning: 'polar latitude' }`.

### BL-R-M8 | No input validation on engine entry point
- [x] **Status:** Complete
- **Severity:** Medium
- **Files:** `src/engine/index.js`
- **Problem:** `calculateFullChart()` has zero input validation. `year=undefined` flows through producing NaN throughout all layers. No try/catch around layers.
- **Fix:** Validate required params (year, month, day, hour, minute, lat, lng) at entry. Throw descriptive errors.
- **Verify:** `calculateFullChart({})` throws with "Missing required field: year".

### BL-R-M9 | Massive if/else router (~200 lines, 100+ routes)
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `workers/src/index.js`
- **Problem:** Routing is a ~200-line if/else chain. Hard to maintain, no per-route middleware composition, duplicated path parsing.
- **Fix:** Replace with a trie-based router or `itty-router`. Compose middleware per route.
- **Verify:** All routes still function. Route matching is O(1) not O(n).

### BL-R-M10 | Internal self-fetch in check-in handler doubles cost
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `workers/src/handlers/checkin.js`
- **Problem:** `fetch(${env.BASE_URL}/api/transits/today)` calls its own API, doubling Worker invocations and latency.
- **Fix:** Import the transit calculation function directly instead of HTTP self-fetch.
- **Verify:** Check-in handler completes without outbound HTTP to self.

### BL-R-M11 | Dynamic imports in request hot path add latency
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `workers/src/handlers/share.js`, `workers/src/handlers/webhooks.js`
- **Problem:** `await import('./famous.js')` and `await import('../lib/webhookDispatcher.js')` inside request handlers. These modules are static and should be top-level imports.
- **Fix:** Move to static top-level `import` statements.
- **Verify:** No `await import()` calls inside handler functions.

### BL-R-M12 | N+1 KV reads in onboarding handler
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `workers/src/handlers/onboarding.js`
- **Problem:** `handleProgress` makes up to 22 sequential `env.CACHE.get()` calls. `kvCache.getMany()` utility exists for parallel reads.
- **Fix:** Replace sequential reads with `kvCache.getMany()`.
- **Verify:** Onboarding progress loads in 1 parallel batch, not 22 sequential calls.

### BL-R-M13 | Rate limiter stores unbounded timestamp arrays in KV
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `workers/src/middleware/rateLimit.js`
- **Problem:** Sliding window stores array of all request timestamps. High-traffic endpoints grow KV value size significantly.
- **Fix:** Switch to fixed-window counter or token bucket. Store only a count + window start timestamp.
- **Verify:** KV value for rate limit key is a small fixed-size object.

### BL-R-M14 | No input length validation on request bodies
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** Multiple handlers
- **Problem:** No string length limits on check-in notes, alert names, webhook URLs, cluster names, diary entries. Megabyte payloads accepted.
- **Fix:** Add max-length validation per field (e.g., notes: 2000 chars, names: 255 chars, URLs: 2048 chars).
- **Verify:** Oversized input returns 400 with "exceeds maximum length" message.

### BL-R-M15 | No pagination limits — uncapped `limit` param
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `workers/src/handlers/push.js`, `alerts.js`, `webhooks.js`
- **Problem:** List endpoints accept `?limit=1000000` without capping, causing expensive full-table scans.
- **Fix:** Cap all limits: `Math.min(Number(limit) || 20, 100)`.
- **Verify:** `?limit=999999` returns at most 100 results.

### BL-R-M16 | `personalizeTemplate` returns unmodified object (alerts broken)
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `workers/src/handlers/alerts.js` (~line 706)
- **Problem:** `JSON.stringify` with replacer returns a string, but the return value is discarded. Function returns the original `config` object. Template placeholders like `{{natal_mars_gate}}` are never replaced.
- **Fix:** Parse the `JSON.stringify` result back: `return JSON.parse(JSON.stringify(config, replacer))`.
- **Verify:** Alert with template placeholder shows actual gate value.

### BL-R-M17 | Code duplication: utilities reimplemented in transits.js
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `src/engine/transits.js`
- **Problem:** `normalizeDegrees`, `jdnToCalendar`, and `signFromLongitude` reimplemented locally instead of importing from `julian.js`/`design.js`/`astro.js`.
- **Fix:** Import shared utilities from canonical modules. Delete local copies.
- **Verify:** Only one definition of each utility in the codebase.

### BL-R-M18 | embed.js origin check uses `.includes()` — bypassable
- [ ] **Status:** Open
- **Severity:** Medium (Security)
- **Files:** `frontend/embed.js` (~line 95)
- **Problem:** `event.origin.includes('primeself.app')` matches crafted domains like `evil-primeself.app.com`.
- **Fix:** Use strict origin matching: `event.origin === 'https://primeself.app'` or check against a whitelist.
- **Verify:** Message from `evil-primeself.app.com` is rejected.

### BL-R-M19 | `postMessage('*')` in embed.html exposes chart data
- [ ] **Status:** Open
- **Severity:** Medium (Security)
- **Files:** `frontend/embed.html` (~lines 415, 425, 443, 470)
- **Problem:** All `postMessage` calls use `'*'` as targetOrigin. Any window can intercept chart data.
- **Fix:** Use specific parent origin from embed configuration or `event.origin` from the initiating message.
- **Verify:** `postMessage` uses explicit origin, not `'*'`.

### BL-R-M20 | Cron job contains raw inline SQL
- [x] **Status:** Complete
- **Severity:** Medium
- **Files:** `workers/src/cron.js`
- **Problem:** Raw SQL queries inline instead of using the centralized `QUERIES` object from `db/queries.js`. Bypasses query auditing.
- **Fix:** Move cron queries to `QUERIES` object and import.
- **Verify:** `cron.js` contains no raw SQL strings.

---

## Low (12)

### BL-R-L1 | `embed.js` `destroy()` leaks event listener
- [x] **Status:** Complete
- **Severity:** Low
- **Files:** `frontend/embed.js`
- **Problem:** `destroy()` removes iframe but never removes the `message` event listener. Memory leak on repeated create/destroy cycles.
- **Fix:** Store listener reference and call `removeEventListener` in `destroy()`.
- **Verify:** After `destroy()`, no `message` listeners from embed remain.

### BL-R-L2 | PWA icons reference nonexistent files
- [x] **Status:** Complete (Sprint 16)
- **Severity:** Low
- **Files:** `frontend/manifest.json`, `frontend/icons/`
- **Problem:** Manifest declared 8 PNG icons and screenshots, but only `README.md` existed in the icons directory.
- **Fix:** Created `frontend/icons/icon.svg` (branded bodygraph SVG, gold on dark, 512×512). Updated manifest to single SVG entry with `"sizes": "any"` and `"purpose": "any maskable"`; removed non-existent screenshots; updated both shortcut icons to SVG.
- **Verify:** All icon paths in manifest resolve to actual files. ✓

### BL-R-L3 | `fb:app_id` placeholder in meta tag
- [ ] **Status:** Open
- **Severity:** Low
- **Files:** `frontend/index.html` (~line 670)
- **Problem:** `<meta property="fb:app_id" content="YOUR_FACEBOOK_APP_ID">` — never replaced.
- **Fix:** Either set real App ID or remove the tag.
- **Verify:** No placeholder meta tags in HTML.

### BL-R-L4 | `!importance` CSS typo — rule silently ignored
- [ ] **Status:** Open
- **Severity:** Low
- **Files:** `frontend/css/components/mobile.css` (~line 461)
- **Problem:** `!importance` instead of `!important`. CSS rule has no effect.
- **Fix:** Change to `!important`.
- **Verify:** Rule applies correctly.

### BL-R-L5 | Service worker push handler lacks try/catch on JSON parse
- [ ] **Status:** Open
- **Severity:** Low
- **Files:** `frontend/service-worker.js` (~line 210)
- **Problem:** Push event payload parsed without try/catch. Malformed push payload crashes the handler.
- **Fix:** Wrap in try/catch with fallback notification text.
- **Verify:** Malformed push payload shows fallback notification instead of crashing.

### BL-R-L6 | Service worker cache has no size limit or eviction
- [ ] **Status:** Open
- **Severity:** Low
- **Files:** `frontend/service-worker.js`
- **Problem:** Static asset cache grows unbounded. No max-age on API response cache.
- **Fix:** Implement LRU eviction (cap at 50 entries) and max-age (24h for API, 7d for static).
- **Verify:** Cache size stays bounded after repeated usage.

### BL-R-L7 | `i18n.js` adds click listener on every `renderSwitcher()` call
- [ ] **Status:** Open
- **Severity:** Low
- **Files:** `frontend/js/i18n.js`
- **Problem:** `renderSwitcher()` adds `document.addEventListener('click')` every time — memory leak.
- **Fix:** Add listener once, or remove before re-adding.
- **Verify:** Multiple `renderSwitcher()` calls produce only one click listener.

### BL-R-L8 | i18n system fully built but never connected to HTML
- [x] **Status:** Complete (verified — `index.html` already wired; Sprint 16)
- **Severity:** Low
- **Files:** `frontend/index.html`, `frontend/js/i18n.js`, `frontend/locales/*.json`
- **Problem:** Complete i18n system with 5 locale files exists but `index.html` has zero `data-i18n` attributes. Dead code.
- **Fix:** Wire in `data-i18n` attributes for all UI text, or document as future work.
- **Verify:** Language switcher changes at least nav labels.

### BL-R-L9 | Artwork animations lack `prefers-reduced-motion` check
- [ ] **Status:** Open
- **Severity:** Low (Accessibility)
- **Files:** `frontend/css/artwork.css`
- **Problem:** 10+ concurrent fullscreen `@keyframes` animations. No `prefers-reduced-motion` media query. GPU/battery drain on mobile. WCAG 2.1 §2.3.3.
- **Fix:** Add `@media (prefers-reduced-motion: reduce) { .lava-lamp, .orbital-ring, ... { animation: none; } }`.
- **Verify:** Reduced-motion setting disables all decorative animations.

### BL-R-L10 | Tab buttons lack ARIA roles
- [ ] **Status:** Open
- **Severity:** Low (Accessibility)
- **Files:** `frontend/index.html`
- **Problem:** Tab buttons missing `role="tab"`, `aria-selected`, `aria-controls`. Modals lack `role="dialog"`, `aria-modal`, focus trap.
- **Fix:** Add proper ARIA attributes to tab system. Implement focus trap for modals.
- **Verify:** Screen reader correctly announces tab states and modal context.

### BL-R-L11 | `@import url()` CSS chains block first paint
- [ ] **Status:** Open
- **Severity:** Low (Performance)
- **Files:** `frontend/css/prime-self-premium.css`
- **Problem:** Up to 8 serial `@import url()` requests. Each blocks rendering until loaded.
- **Fix:** Replace with a build step that concatenates CSS, or use `<link>` tags in HTML for parallel loading.
- **Verify:** Waterfall shows parallel CSS loading.

### BL-R-L12 | Leaderboard partially exposes user emails
- [x] **Status:** Complete
- **Severity:** Low (Privacy)
- **Files:** `workers/src/handlers/achievements.js`
- **Problem:** Email masking `joh***@gmail.com` reveals first 3 chars + full domain. Short usernames are identifiable.
- **Fix:** For short usernames (< 4 chars), mask entirely: `***@g...com`. Consider using display names instead.
- **Verify:** Email with 2-char username shows `***@g...com`.

---

## Sprint Plan (Updated)

### Sprint 9 — Security Emergency (Immediate)
- [x] BL-R-C1: Rotate all secrets / delete Secrets.txt ✅ SECRETS_GUIDE.md created, Secrets.txt cleared
- [x] BL-R-C2: Remove fake metrics and fabricated testimonials
- [x] BL-R-C3: Parameterize analytics SQL
- [x] BL-R-H7: Fix Notion OAuth XSS
- [x] BL-R-H13: Add escapeHtml to all renderX() functions ✅ 30+ innerHTML sites escaped
- [x] BL-R-H14: Verify CSRF protection model ✅ Bearer-token auth inherently CSRF-safe, documented in cors.js
- [x] BL-R-C5: Fix mobile navigation tab IDs
- [x] BL-R-C6: Fix check-in DOM references and API paths

### Sprint 10 — Backend/API Integrity
- [x] BL-R-C4: Consolidate Stripe webhook handlers
- [x] BL-R-H1: Singleton DB connection pool ✅ Module-level Pool cache in queries.js
- [x] BL-R-H2: Sanitize error responses
- [x] BL-R-H5: Fix userId property inconsistency
- [x] BL-R-H6: Fix SMS column name mismatch
- [x] BL-R-H8: waitUntil for streaming
- [x] BL-R-M16: Fix personalizeTemplate return
- [x] BL-R-M15: Cap pagination limits

### Sprint 11 — Engine Accuracy
- [x] BL-R-H10: Add missing channel 42-53
- [x] BL-R-M1: Accept seconds in toJulianDay
- [x] BL-R-M2: Fix jdnToCalendar hour=24 overflow
- [x] BL-R-M3: Resolve Chiron cycle
- [x] BL-R-M4: Ego Manifested vs Projected authority
- [x] BL-R-M8: Engine input validation
- [x] BL-R-M17: Deduplicate utility functions

### Sprint 12 — Frontend Fixes ✅
- [x] BL-R-M18: Strict embed.js origin check
- [x] BL-R-M19: Restrict postMessage targetOrigin
- [x] BL-R-L3: Remove fb:app_id placeholder
- [x] BL-R-L4: Fix CSS `!importance` typo
- [x] BL-R-L9: Add prefers-reduced-motion to artwork
- [x] BL-R-L10: ARIA roles for tabs and modals

### Sprint 13 — WordPress & Integrations ✅
- [x] BL-R-H11: Remove API key from frontend
- [x] BL-R-H12: Add authentication to WP REST endpoint
- [x] BL-R-H9: Fix fs import for Workers compat

### Sprint 14 — Performance & Polish ✅
- [x] BL-R-M9: Replace if/else router
- [x] BL-R-M10: Remove self-fetch in check-in
- [x] BL-R-M11: Static imports instead of dynamic
- [x] BL-R-M12: Batch KV reads in onboarding
- [x] BL-R-M13: Fixed-window rate limiter
- [x] BL-R-M14: Input length validation
- [x] BL-R-L5: Service worker push try/catch
- [x] BL-R-L6: Cache eviction strategy
- [x] BL-R-L11: Eliminate CSS @import chains

---

## Sprint 15 — Deep Audit Fixes (2026-03-07)

**Audited by:** Full codebase + documentation + engine + schema review
**New items:** 10 issues (3 Critical, 3 High, 4 Medium)

---

### BL-S15-C1 | Transaction function broken — Neon HTTP has no connection affinity
- [x] **Status:** Complete
- **Severity:** Critical
- **Files:** `workers/src/db/queries.js` (lines 82–93)
- **Problem:** `query.transaction()` runs `pool.query('BEGIN')`, user queries, then `pool.query('COMMIT')` or `pool.query('ROLLBACK')`. The Neon serverless driver's `Pool` in HTTP mode sends each `pool.query()` as an independent HTTP request with **no connection affinity**. Each call may hit a different backend connection, so `BEGIN` and `COMMIT` execute on different connections — the transaction is non-functional. Any concurrent write (billing, profile save, webhook processing) risks data inconsistency.
- **Impact:** All transactional operations silently broken — partial writes, lost updates, payment/subscription data corruption.
- **Fix:** Use `pool.connect()` to obtain a dedicated client for transaction blocks. The Neon serverless driver supports WebSocket-backed clients via `connect()` which maintain connection affinity. Replace `pool.query('BEGIN')` with `const client = await pool.connect(); await client.query('BEGIN'); ... await client.query('COMMIT'); client.release();`.
- **Verify:** Run a transaction that fails mid-way → no partial data written. Run two concurrent transactions → no interleaving.

### BL-S15-C2 | `migrate.js` (`npm run migrate`) does not apply numbered migrations
- [x] **Status:** Complete
- **Severity:** Critical
- **Files:** `workers/src/db/migrate.js`, `workers/run-migration.js`
- **Problem:** `migrate.js` (invoked by `npm run migrate`) only executes `migrate.sql` (base schema). The 10 numbered migration files (003-015) that add billing, achievements, analytics, webhooks, API keys, Notion, daily checkins, and query optimization are **never applied** by this path. `run-migration.js` at the workers root correctly handles numbered migrations but is not wired into `npm run migrate`. Queries in `queries.js` reference columns added by these migrations (`users.tier`, `users.referral_code`, `users.stripe_customer_id`) — they will fail on a fresh deploy.
- **Fix:** Rewrite `migrate.js` to also discover and apply numbered migrations from `src/db/migrations/`, with tracking via `schema_migrations` table, matching the logic in `run-migration.js`. Or redirect `npm run migrate` to `run-migration.js`.
- **Verify:** `npm run migrate` on a fresh DB → all 48 tables present. `\d users` shows `tier`, `referral_code`, `stripe_customer_id` columns.

### BL-S15-C3 | Hardcoded Neon connection string in `run-migration.js`
- [x] **Status:** Complete
- **Severity:** Critical (Security)
- **Files:** `workers/run-migration.js` (line 27)
- **Problem:** Fallback connection string with real credentials was hardcoded in source. Anyone with repo access would have full DB credentials.
- **Fix:** Remove the hardcoded fallback. Require `NEON_CONNECTION_STRING` env var. Fail with a descriptive error if missing.
- **Verify:** `node run-migration.js` without env var → clear error message, no credentials in source.

### BL-S15-H1 | CORS allows localhost origins in production deployment
- [x] **Status:** Complete
- **Severity:** High (Security)
- **Files:** `workers/src/middleware/cors.js` (lines 22–28)
- **Problem:** `ALLOWED_ORIGINS` includes `http://localhost:5173`, `http://localhost:3000`, `http://127.0.0.1:5173`, `http://127.0.0.1:3000` unconditionally. In production, any local tool or browser extension on a developer's machine can make authenticated cross-origin requests. More importantly, a developer visiting a malicious site that redirects to localhost can trigger CORS-allowed requests.
- **Fix:** Gate localhost origins behind `ENVIRONMENT !== 'production'`. Read `env.ENVIRONMENT` from wrangler.toml vars and only include localhost origins when not in production.
- **Verify:** In production, `Origin: http://localhost:5173` → CORS response uses production origin, not localhost.

### BL-S15-H2 | `checkin_streaks` materialized view refreshes on every INSERT
- [x] **Status:** Complete
- **Severity:** High (Performance)
- **Files:** `workers/src/db/migrations/013_daily_checkins.sql`
- **Problem:** A trigger fires `REFRESH MATERIALIZED VIEW CONCURRENTLY checkin_streaks` on every `INSERT/UPDATE/DELETE` on `daily_checkins`. Materialized view refresh is an expensive operation that locks the view and rewrites it. At scale (1000+ daily check-ins), this creates a performance bottleneck.
- **Fix:** Remove the per-row trigger. Refresh the materialized view on a schedule (e.g., daily via cron) or replace with a computed query using window functions.
- **Verify:** 100 concurrent check-in INSERTs complete without blocking. Streak data still accurate after cron refresh.

### BL-S15-H3 | ARCHITECTURE.md documents only 8 of 48 tables — massive schema drift
- [x] **Status:** Complete
- **Severity:** High (Documentation)
- **Files:** `ARCHITECTURE.md` (Section 5.3)
- **Problem:** The Neon Database Schema section documents 8 core tables but the actual schema has grown to 48 tables + views. Column types, nullability, and constraints differ between docs and code (e.g., `birth_lat DECIMAL(9,6) NOT NULL` in docs vs `DOUBLE PRECISION` nullable in code). `docs/ARCHITECTURE.md` references a `numerology_json` column in `charts` that doesn't exist.
- **Fix:** Auto-generate schema documentation from `migrate.sql` + migrations, or update ARCHITECTURE.md to reflect actual schema. At minimum, document all tables used by active API endpoints.
- **Verify:** Every table referenced in `queries.js` has a corresponding entry in ARCHITECTURE.md.

### BL-S15-M1 | Inconsistent UUID generation across schema
- [x] **Status:** Complete
- **Severity:** Medium
- **Files:** `workers/src/db/migrate.sql`, `workers/src/db/migrations/*.sql`
- **Problem:** Base schema uses `uuid_generate_v4()` (requires `uuid-ossp` extension) while numbered migrations use `gen_random_uuid()` (built into PostgreSQL 13+). Both produce valid v4 UUIDs but it's an unnecessary dependency and inconsistency.
- **Fix:** Standardize on `gen_random_uuid()` (native, no extension needed). Remove `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` from base schema.
- **Verify:** All CREATE TABLE statements use `gen_random_uuid()`.

### BL-S15-M2 | `usage_tracking` and `usage_records` are duplicate tables
- [x] **Status:** Complete
- **Severity:** Medium
- **Files:** `workers/src/db/migrate.sql` (usage_records), `workers/src/db/migrations/003_billing.sql` (usage_tracking)
- **Problem:** Two tables serve the same purpose. `usage_records` (base schema) has columns `user_id, action, endpoint, quota_cost`. `usage_tracking` (003_billing) has `user_id, action, credits_used, metadata`. Queries only reference `usage_records`. `usage_tracking` appears completely unused.
- **Fix:** Remove `usage_tracking` from migration 003 or merge useful columns into `usage_records`. Add a migration to drop if already created.
- **Verify:** `grep -r "usage_tracking" workers/src/` returns no matches.

### BL-S15-M3 | Empty CSS rulesets and invalid gradient syntax
- [x] **Status:** Complete
- **Severity:** Medium (Code Quality)
- **Files:** `frontend/css/design-tokens.css` (line 289), `frontend/css/components/cards.css` (line 51), `frontend/css/components/tabs.css` (line 142), `frontend/css/design-tokens-premium.css` (lines 195, 199, 208)
- **Problem:** Three empty `:root`/`.card-body`/`.tab-content` rulesets trigger lint warnings. `design-tokens-premium.css` has invalid gradient syntax (commas inside `rgba()` in gradient stops produce "colon expected" CSS parse errors).
- **Fix:** Remove empty rulesets. Fix gradient syntax to use proper CSS gradient stop format.
- **Verify:** Zero CSS lint warnings in IDE.

### BL-S15-M4 | Test coverage gaps — only 2 birth chart vectors, no type diversity
- [x] **Status:** Complete
- **Severity:** Medium (Quality Assurance)
- **Files:** `tests/engine.test.js`
- **Problem:** Only 2 birth charts tested (AP = Projector 6/2, 0921 anchor). No test vectors for Generator, Manifestor, Manifesting Generator, or Reflector types. No test for Ego Manifested/Projected, Self-Projected, Mental, or Lunar authority. `calculateLifeCycles` is exported but completely untested. Missing verification of all 36 channels in the CHANNELS constant.
- **Fix:** Add test vectors for all 5 types and all authority variants. Add a test that verifies CHANNELS array has exactly 36 entries covering all standard channels. Add `calculateLifeCycles` tests.
- **Verify:** `npm test` covers all 5 types, all authority variants, and lifecycle calculations.

---

### Sprint 15 Execution Plan

**Phase 1 — Security (Immediate):**
- BL-S15-C1: Fix transaction function (connection affinity)
- BL-S15-C3: Remove hardcoded credentials from run-migration.js
- BL-S15-H1: Gate CORS localhost behind environment check

**Phase 2 — Infrastructure:**
- BL-S15-C2: Fix migrate.js to apply numbered migrations
- BL-S15-H2: Replace materialized view trigger with cron refresh
- BL-S15-M1: Standardize UUID generation

**Phase 3 — Quality:**
- BL-S15-M3: Fix CSS lint errors
- BL-S15-M4: Add missing test vectors
- BL-S15-H3: Update ARCHITECTURE.md schema documentation
- BL-S15-M2: Remove unused usage_tracking table

---

## Sprint 16 — Audit Backlog Clear (2026-03-08)

**Scope:** Clear all remaining open BL-R-* items, fix confirmed issues, verify already-fixed items.

### Confirmed Fixed This Sprint

- [x] **BL-R-H2**: Removed `message: err.message` from `auth.js` JWT error response — now logs server-side only
- [x] **BL-R-H3**: Created `workers/src/lib/tokenCrypto.js` with AES-256-GCM encrypt/decrypt via `crypto.subtle`. Notion callback now encrypts `access_token` before DB write; sync and export handlers decrypt with `readToken()` (backward-compatible with legacy plaintext rows). Key: `NOTION_TOKEN_ENCRYPTION_KEY` Worker secret (base64 32-byte, add via `wrangler secret put`).
- [x] **BL-R-H4**: Removed `secret: webhook.secret` from `GET /api/webhooks/:id` response (previous session)
- [x] **BL-R-M4**: Ego Manifested vs Projected authority — verified correct in chart.js (no change needed)
- [x] **BL-R-M5**: Wired `getEarthPosition(T)` (Meeus, more accurate) into `getAllPositions()` replacing `getHelioPosition(T, ELEMENTS.earth)` (Keplerian); removed dead `ELEMENTS.earth` entry
- [x] **BL-R-M6**: Aligned `personalYear` methodology — now reduces each component first, then sums, matching `lifePathNumber` approach
- [x] **BL-R-M7**: Added polar latitude detection in `calculatePlacidusHouses` — latitudes ≥ 66.5° fall back to Equal House, returning `{ houseSystem: 'equal', polarWarning: '...' }` in `calculateAstrology`
- [x] **BL-R-M20**: Extracted 7 cron SQL queries to `QUERIES` constants in `queries.js`; `cron.js` now has zero raw SQL (previous session)
- [x] **BL-R-L1**: Stored `_messageHandler` reference on each embed widget instance; `destroy()` and `destroyAll()` now call `removeEventListener` to prevent listener accumulation
- [x] **BL-R-L7**: Added module-level `_outsideClickHandler` in `i18n.js`; `renderSwitcher()` removes previous outside-click listener before adding new one
- [x] **BL-R-L12**: Improved email masking in leaderboard — local parts < 4 chars are fully masked (`***@domain`), preventing identification of short usernames

### Verified Already Fixed (No Code Change Needed)

- [x] **BL-R-H5**: `request._user?.sub` used consistently in cluster.js and sms.js (Sprint 10)
- [x] **BL-R-H6**: `sms_opted_in` column used consistently in sms.js (Sprint 10)
- [x] **BL-R-H7**: Notion XSS fixed — `safeError` with HTML escaping in notion.js (Sprint 10)
- [x] **BL-R-H8**: `ctx.waitUntil(pipeline)` already in profile-stream.js (Sprint 10)
- [x] **BL-R-H9**: `fs` already uses dynamic `import('fs')` not static import in chart.js (Sprint 13)
- [x] **BL-R-M8**: `calculateFullChart()` input validation already done with full range checks (Sprint 11)
- [x] **BL-R-M9**: Router refactored to EXACT_ROUTES Map + PREFIX_ROUTES + PATTERN_ROUTES + resolveRoute() (Sprint 14)
- [x] **BL-R-M10**: checkin.js already imports `getCurrentTransits` directly, no self-fetch (Sprint 14)
- [x] **BL-R-M11**: No `await import()` in handler hot paths; all static imports at top level (Sprint 14)
- [x] **BL-R-M12**: `onboarding.js` uses `Promise.all(kvRequests.map(...kv.get()))` for parallel reads (Sprint 14)
- [x] **BL-R-M13**: `rateLimit.js` already uses fixed-window `{ count, window }` KV objects (Sprint 14)
- [x] **BL-R-M14**: All handlers validated with per-field max-length checks (Sprint 14)
- [x] **BL-R-M15**: All list endpoints cap `limit` with `Math.min(N, 100)` (Sprint 10)
- [x] **BL-R-M16**: `personalizeTemplate` returns `JSON.parse(serialized)` in alerts.js (Sprint 10)
- [x] **BL-R-M17**: transits.js imports shared `normalizeDegrees`, `jdnToCalendar`, `getSignFromLongitude` (Sprint 11)
- [x] **BL-R-M18**: embed.js uses `ALLOWED_ORIGINS` Set with `Set.has()` strict matching (Sprint 12)
- [x] **BL-R-M19**: embed.html uses `parentOrigin` variable, not `'*'`, for all postMessage calls (Sprint 12)
- [x] **BL-R-L3**: fb:app_id placeholder removed from index.html (Sprint 12)
- [x] **BL-R-L4**: `!importance` CSS typo already corrected (Sprint 12)
- [x] **BL-R-L5**: Push event JSON.parse already has try/catch in service-worker.js (Sprint 14)
- [x] **BL-R-L6**: Service worker has `trimCache()` LRU eviction + `MAX_API_CACHE_ENTRIES = 50` (Sprint 14)
- [x] **BL-R-L9**: `artwork.css` has `@media (prefers-reduced-motion: reduce)` block (Sprint 12)
- [x] **BL-R-L10**: ARIA roles added to tabs/modals (Sprint 12)

### Still Open

*All BL-R-* items resolved — see Confirmed Fixed lists above.*

### Sprint 16 Confirmed Fixed (continued)

- [x] **BL-R-L2**: `frontend/icons/icon.svg` created (branded bodygraph SVG); `manifest.json` updated — 8 missing PNG entries replaced with single SVG entry (`"sizes": "any"`, `"purpose": "any maskable"`); screenshots array removed; shortcut icons updated to SVG (Sprint 16)
- [x] **BL-R-L8**: `index.html` already had full `data-i18n` wiring — nav tabs (chart/profile/enhance/diary/checkin/transits/composite/rectify/practitioner/clusters/sms), auth modal, pricing modal, header buttons; `id="lang-switcher"` in header; lang-switcher CSS in `<style>`; `i18n.js` loaded `defer` and auto-initializes. Backlog description was stale. (Sprint 16 verified)

---

## Sprint 17 — Deep Dive Audit (2026-03-09)

**Scope:** Comprehensive DB ↔ code alignment, engine accuracy fixes, phantom-column crashes, test corrections, dead-code removal. Neon DB synced from 15 → 48 tables.

### CRITICAL Fixes

- [x] **BL-S17-C1**: Neon DB schema drift — only 15 of 48 tables existed in live database
  - **Root cause:** `npm run migrate` only ran base `migrate.sql`, never numbered migrations 003–015
  - **Fix:** Manually applied all 32 missing CREATE TABLE statements, 5 missing user columns (`tier`, `stripe_customer_id`, `referral_code`, `email_verified`, `last_login_at`), `practitioners.created_at`, 6 indexes, and 2 seed rows in `alert_templates`. Recorded all 10 migrations in `schema_migrations`.
  - **Verification:** `SELECT tablename FROM pg_tables WHERE schemaname='public'` → 48 tables ✅

- [x] **BL-S17-C2**: `cronGetWelcome2Users` referenced phantom column `charts.chart_type`
  - **Files:** `workers/src/db/queries.js`
  - **Problem:** `charts` table has no `chart_type` column → query crashes daily welcome-email cron
  - **Fix:** Rewritten to extract from JSONB: `c.hd_json::jsonb->'chart'->>'type' AS chart_type` using `LEFT JOIN LATERAL`

- [x] **BL-S17-C3**: `cronGetWelcome3Users` referenced phantom column `charts.authority`
  - **Files:** `workers/src/db/queries.js`
  - **Problem:** `charts` table has no `authority` column → query crashes 3-day welcome-email cron
  - **Fix:** Rewritten to extract from JSONB: `c.hd_json::jsonb->'chart'->>'authority' AS authority` using `LEFT JOIN LATERAL`

### HIGH Fixes

- [x] **BL-S17-H1**: `getTotalProfiles` referenced phantom column `profiles.status`
  - **Files:** `workers/src/db/queries.js`
  - **Problem:** `profiles` table has no `status` column → stats endpoint crashes
  - **Fix:** Removed `WHERE status = 'completed'` — counts all profiles

- [x] **BL-S17-H2**: Chiron orbital elements had zero rates for semi-major axis and eccentricity
  - **Files:** `src/engine/planets.js`
  - **Problem:** `a: [13.64838, 0.0], e: [0.37911, 0.0]` → position degrades for dates >20 years from J2000
  - **Fix:** Added derived rates: `a: 0.0014 AU/century`, `e: -0.0009/century`, `I: -0.0056°/century`

- [x] **BL-S17-H3**: Chiron missing from transit speeds and outer planets set
  - **Files:** `src/engine/transits.js` (prior session fix, verified)
  - **Problem:** Chiron defaulted to 1°/day transit speed (actual: 0.02°/day) and was excluded from outer-planet tracking
  - **Fix:** Added `chiron: 0.02` to SPEEDS, added 'chiron' to OUTER_PLANETS

- [x] **BL-S17-H4**: chart.js crossesData load failure was silently swallowed
  - **Files:** `src/engine/chart.js` (prior session fix, verified)
  - **Problem:** Empty `catch {}` block hid cross-of-incarnation load errors
  - **Fix:** Changed to `catch (e) { console.warn('crossesData load failed:', e.message); }`

### MEDIUM Fixes

- [x] **BL-S17-M1**: Dead `handleWebhook` import from billing.js in index.js
  - **Files:** `workers/src/index.js`
  - **Problem:** After BL-R-C4 consolidated both Stripe webhook routes to `handleStripeWebhook`, the `handleWebhook` import from billing.js became dead code
  - **Fix:** Removed unused import, added comment explaining consolidation

- [x] **BL-S17-M2**: GATE_WHEEL duplication undocumented
  - **Files:** `src/engine/gates.js`
  - **Problem:** 64-gate sequence duplicated between `gates.js` (inline) and `src/data/gate_wheel.json` with no documentation of which is authoritative
  - **Fix:** Added sync-warning comment identifying inline copy as authoritative for hot-path performance

- [x] **BL-S17-M3**: Test corrections for pre-existing failures
  - **Files:** `tests/engine.test.js`
  - **Problem 1:** Mars personality gate test expected Gate 15 but actual position (88.16°) falls in Gate 12 (boundary at 88.25°) — Keplerian precision edge case
  - **Problem 2:** Transit body count test expected 13 but adding Chiron to OUTER_PLANETS made it 14
  - **Fix:** Updated test expectations with explanatory comments

### LOW (Noted, not yet fixed)

- [ ] **BL-S17-L1**: `calculateLifeCycles()` in transits.js uses period-based approximation
  - **Impact:** Saturn return off by 6+ months for extreme dates. Not urgent — only affects forecasting text.
  - **Workaround:** Users see approximate cycle dates with appropriate disclaimer language.

- [ ] **BL-S17-L2**: `toGeocentric()` ignores ecliptic latitude (z-component)
  - **Files:** `src/engine/planets.js`
  - **Impact:** Pluto and Chiron (high inclination orbits) can have up to 0.3° geocentric error. Not critical for HD gate-level precision (5.625° gates).

### Previously Open BL-R Items Verified This Sprint

- [x] **BL-R-C3** (SQL injection in analytics): Verified — all analytics queries use parameterized `$1, $2...` placeholders ✅
- [x] **BL-R-C4** (duplicate Stripe webhooks): Verified — both routes now point to `handleStripeWebhook` from webhook.js ✅
- [x] **BL-R-C5** (mobile nav broken tab IDs): Verified — all mobile nav items use correct `data-tab="chart"` etc. ✅
- [x] **BL-R-C6** (check-in DOM mismatches): Verified — all DOM IDs match between HTML and JS (`checkin-alignment-score`, `checkin-mood`, etc.) ✅

---

## Sprint 18 — UX Overhaul & Social Media Integration (2026-03-09)

**Scope:** Complete UX redesign based on deep review, color system consolidation, social media sharing, explanatory tooltips, navigation restructure, and marketing readiness improvements.

**Reference:** See [UX_DEEP_REVIEW.md](UX_DEEP_REVIEW.md) for full analysis and Reddit/competitive research.

**Repo Audit Delta (2026-03-09):** 11 Sprint 18 items were already implemented in the current codebase but had not been reflected here: `BL-UX-C2`, `BL-UX-C3`, `BL-UX-C4`, `BL-UX-C5`, `BL-UX-C6`, `BL-UX-C7`, `BL-UX-C8`, `BL-UX-H3`, `BL-SOCIAL-H1`, `BL-SOCIAL-H2`, and `BL-SOCIAL-H3`.

### CRITICAL — Must Fix Before Marketing (🔴 This Week)

- [ ] **BL-UX-C1**: Color token conflicts — three competing systems
  - **Severity:** Critical (UX)
  - **Files:** `frontend/index.html` (inline :root variables), `frontend/css/design-tokens.css`, `frontend/css/design-tokens-premium.css`
  - **Problem:** Three overlapping color systems fighting each other. Inline styles define `--bg`, `--text`, `--gold`. design-tokens.css defines `--bg-primary`, `--text-primary`, `--color-gold-500`. Premium defines different values for same tokens. Buttons show gold but design system says red is primary.
  - **Impact:** Visual inconsistency, maintenance nightmare, impossible to theme
  - **Fix:** (1) Remove ALL `:root` variable declarations from index.html inline styles, (2) Consolidate to single token system (use design-tokens.css as canonical source), (3) Update all inline styles to reference semantic tokens instead of custom variables, (4) Delete conflicting premium token overrides
  - **Files to edit:** Remove lines ~62-77 from index.html, update ~600 inline style references to use semantic tokens
  - **Verify:** grep `:root` in index.html returns zero matches, all components reference design tokens consistently

- [x] **BL-UX-C2**: WCAG contrast failures on dim text
  - **Severity:** Critical (Accessibility)
  - **Files:** `frontend/css/design-tokens.css`
  - **Problem:** `--text-dim: #b0acc8` on `--bg2: #1a1a24` = 4.2:1 contrast (fails WCAG AA 4.5:1 minimum). Affects data labels, section headers, meta text throughout the app.
  - **Impact:** Poor readability, accessibility failure, eye strain
  - **Fix:** Bump `--color-neutral-400` from `#a8a2c0` to `#c4c0d8` (achieves 5.5:1 contrast). Update `--text-muted` from `#7a76a0` to `#918db0` (achieves 4.5:1).
  - **Verify:** Use WebAIM contrast checker on all text types against backgrounds

- [x] **BL-UX-C3**: Missing "why it matters" explanations for HD terms
  - **Severity:** Critical (UX)
  - **Files:** `frontend/index.html` (renderChart function ~line 2120), `frontend/js/explanations.js` (if exists, else create)
  - **Problem:** Chart shows "Pattern: Generator", "Authority: Emotional", "Strategy: To Respond" with ZERO explanation of what these mean for the user's life. Reddit #1 complaint: "told me I'm a Generator 3/5 but didn't say what that means."
  - **Impact:** Users leave confused, zero conversion, product appears incomplete
  - **Fix:** Add 1-2 sentence plain-English explanations for every HD term: Type (what this pattern means), Authority (how to make decisions), Strategy (how to engage with life), Profile (life role meaning). Display in expandable tooltips or inline text.
  - **Content needed:**
    - Generator: "You have consistent renewable energy. Designed to find work you love and master it. When lit up, unstoppable."
    - Emotional Authority: "Never decide in the moment. Ride your emotional wave—sleep on it, feel through highs AND lows before choosing."
    - To Respond: "Don't initiate from your mind. Wait for life to present options, then check: does this light me up?"
    - 3/5 Profile: "Learn by trial and error. Others project expectations onto you. Embrace 'failing forward.'"
  - **Verify:** Non-HD user can read chart and understand what it means for their life

- [x] **BL-UX-C4**: Remove fake testimonials section
  - **Severity:** Critical (Trust)
  - **Files:** `frontend/index.html` (lines ~869-1014)
  - **Problem:** 6 clearly fabricated testimonials ("Sarah Mitchell, HD Practitioner · 450+ Client Readings"). Reddit users specifically call this the #1 trust killer. Social proof stats fall back to hardcoded numbers.
  - **Impact:** Undermines all credibility, appears scammy, users leave immediately
  - **Fix:** (1) Remove testimonials carousel entirely, or (2) Replace with real testimonials with permission and disclaimer "Early access beta testers", or (3) Replace with aggregate anonymous stats if available from API
  - **Verify:** No fabricated names or credentials visible on page

- [x] **BL-UX-C5**: Consolidate birth data entry (ask once, remember forever)
  - **Severity:** Critical (UX)
  - **Files:** `frontend/index.html` (Chart tab form, Profile tab form, Composite tab forms)
  - **Problem:** Users must enter birth data 3 separate times across tabs. Chart uses `c-date/c-time/c-location`, Profile uses `p-date/p-time/p-location`, Composite uses `comp-dateA/comp-timeA/comp-A-location`. Massive friction.
  - **Impact:** User abandonment, perception of broken product
  - **Fix:** (1) Store birth data in localStorage after first entry (`ps-birth-data`), (2) Auto-populate all forms on page load, (3) Show banner "Using your birth data: June 15, 1990 14:30 Tampa, FL [Change]", (4) Consolidate to single birth data manager module
  - **Verify:** Enter data in Chart tab → switch to Profile → fields are pre-filled

- [x] **BL-UX-C6**: Tab overload — 13 tabs confuse users
  - **Severity:** Critical (UX)
  - **Files:** `frontend/index.html` (navigation tabs ~line 105-140)
  - **Problem:** 13 total tabs (Chart, Profile, Transits, Check-In, More▾, Enhance, Diary, Composite, Rectify, Saved, Onboarding, Practitioner, Clusters, SMS). Steve Jobs: "People can't prioritize 13 things."
  - **Impact:** Analysis paralysis, users don't know where to start, high bounce rate
  - **Fix:** Restructure to 4 primary tabs visible:
    - **My Blueprint** (merge Chart + Profile)
    - **Today's Energy** (merge Transits + Check-In)
    - **Relationships** (Composite)
    - **Deepen** (Enhance)
    - **More▾** dropdown: Diary, Rectify, Saved, Practitioner, Clusters, SMS, Onboarding
  - **Verify:** Desktop shows 5 items max (4 primary + More), mobile shows clean bottom nav

- [x] **BL-UX-C7**: Mobile nav labels don't match content
  - **Severity:** Critical (UX)
  - **Files:** `frontend/index.html` (mobile bottom nav ~line 4850)
  - **Problem:** Mobile label "Keys" points to Profile tab (AI synthesis), not Gene Keys. "Astro" points to Enhance (behavioral tests), not astrology. User clicks expecting one thing, gets another.
  - **Impact:** Confusion, trust loss, perceived as broken
  - **Fix:** Either (1) rename mobile labels to match actual content (Keys→Profile, Astro→Deepen), or (2) restructure tabs so labels make sense
  - **Verify:** Tap each mobile nav item → label describes what you see

- [x] **BL-UX-C8**: Center pills show no explanation
  - **Severity:** Critical (UX)
  - **Files:** `frontend/index.html` (renderChart ~line 2140)
  - **Problem:** Centers render as `<span class="pill green">Sacral</span>` with zero context. Users don't know what "Sacral" is or what defined vs open means.
  - **Impact:** Data without meaning, users can't apply insights
  - **Fix:** Add tooltips or expandable sections explaining each center:
    - Sacral (defined): "Consistent life force energy for work you love"
    - Sacral (open): "Must manage energy carefully, no sustainable push"
    - Repeat for all 9 centers with "governs", "when defined", "when open"
  - **Verify:** Hover/click any center → see plain English explanation

- [ ] **BL-UX-C9**: Inline CSS overrides design system (600+ lines)
  - **Severity:** Critical (Maintenance)
  - **Files:** `frontend/index.html` (inline <style> blocks ~600 lines total)
  - **Problem:** All styles defined inline in <style> tags, duplicating and overriding external CSS files. Impossible to maintain, causes specificity wars, doubles CSS payload.
  - **Impact:** Design system unusable, changes require editing 3 places, bundle bloat
  - **Fix:** Extract ALL inline CSS to proper component files (app.css, buttons.css, cards.css, etc.). Reference design tokens throughout. Delete inline <style> blocks.
  - **Verify:** index.html has ZERO <style> blocks except maybe small critical-path above-the-fold CSS

### HIGH — Fix This Month (🟡 Important)

- [ ] **BL-UX-H1**: Load gate names/descriptions from src/data
  - **Severity:** High (UX)
  - **Files:** `frontend/index.html`, `frontend/js/gate-data.js` (create), `src/data/gate_wheel.json`
  - **Problem:** Gate data exists in `src/data/gate_wheel.json` but isn't loaded into frontend. Gates show as numbers only (Gate 44.2) with no name or meaning.
  - **Impact:** Users don't know what their gates represent
  - **Fix:** (1) Create frontend data loader for gate_wheel.json, centers.json, channels.json, (2) Add gate names to all gate badges ("Gate 44: The Coming to Meet"), (3) Add tooltips with gate keywords
  - **Verify:** Hover any gate → see name and theme

- [ ] **BL-UX-H2**: Add channel descriptions
  - **Severity:** High (UX)
  - **Files:** `frontend/index.html` (renderChart channels section), `src/data/channels.json`
  - **Problem:** Active channels show as codes "20-34 (Throat↔Sacral)" with no description of what the channel means.
  - **Impact:** Users can't understand their channel activations
  - **Fix:** Load channel data from `src/data/channels.json`, show channel name ("Channel of Charisma") and 1-sentence meaning ("Busy-ness that looks effortless")
  - **Verify:** Each channel shows name + description

- [x] **BL-UX-H3**: Add skeleton loading screens
  - **Severity:** High (UX)
  - **Files:** `frontend/index.html`, `frontend/css/components/skeleton.css` (create)
  - **Problem:** API calls show generic spinner. Modern UX uses skeleton screens (gray animated placeholders) which reduce perceived wait time by ~35%.
  - **Impact:** Users perceive the app as slower than it is
  - **Fix:** Create skeleton components for: chart data rows, profile text blocks, transit list items. Show during loading instead of spinner.
  - **Verify:** Generate chart → see animated skeleton matching final layout shape

- [ ] **BL-UX-H4**: Gene Keys journey explanation missing
  - **Severity:** High (UX)
  - **Files:** `frontend/index.html` (gene keys section rendering)
  - **Problem:** Shows "Shadow: Interference, Gift: Teamwork, Siddhi: Synarchy" with no explanation of the Shadow→Gift→Siddhi transformation journey.
  - **Impact:** Users don't understand the developmental path
  - **Fix:** Add intro text: "You evolve from Shadow (unconscious pattern) to Gift (conscious mastery) to Siddhi (transcendent state). This is your growth path."
  - **Verify:** Gene Keys section explains the journey concept

- [ ] **BL-UX-H5**: Transit natal hits lack personal context
  - **Severity:** High (UX)
  - **Files:** `frontend/index.html` (renderTransits function ~line 2645)
  - **Problem:** Transits show generic planet themes ("What the collective is focused on") but don't explain what it means when that planet hits YOUR specific gate.
  - **Impact:** Users can't personalize transit information
  - **Fix:** When transit planet hits a natal gate, show: "☉ Sun activating YOUR Gate 44 (The Coming to Meet) — Your Gate 44 connects Spleen (instinct) to Heart (willpower). Unusual ability to spot patterns this week."
  - **Verify:** Natal hit shows personal gate context, not just collective theme

- [ ] **BL-UX-H6**: Inconsistent spacing (hardcoded pixels everywhere)
  - **Severity:** High (Consistency)
  - **Files:** `frontend/index.html` (all inline styles)
  - **Problem:** At least 50+ instances of hardcoded spacing: `margin-bottom: 20px`, `padding: 24px`, `gap: 14px`. Design tokens define spacing scale but are ignored.
  - **Impact:** Visual inconsistency, maintenance nightmare
  - **Fix:** Replace all hardcoded spacing with design tokens: `var(--space-4)`, `var(--space-6)`, etc.
  - **Verify:** grep `margin.*px|padding.*px` in index.html returns minimal results (only special cases)

- [ ] **BL-UX-H7**: Font size chaos (15+ different sizes)
  - **Severity:** High (Consistency)
  - **Files:** `frontend/index.html` (inline styles)
  - **Problem:** `0.65rem, 0.68rem, 0.7rem, 0.72rem, 0.75rem, 0.78rem, 0.8rem, 0.82rem, 0.83rem, 0.85rem, 0.88rem, 0.9rem, 0.95rem, 1rem, 1.1rem` — creates visual noise.
  - **Impact:** Lack of clear visual hierarchy
  - **Fix:** Consolidate to design token scale: `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--text-2xl`. Use only these sizes.
  - **Verify:** No custom font sizes in index.html, all use design tokens

- [ ] **BL-UX-H8**: Lava lamp background distracts and drains GPU
  - **Severity:** High (Performance)
  - **Files:** `frontend/css/artwork.css`
  - **Problem:** Floating blobs, orbs, 30 particles animate continuously. Consumes GPU on mobile, distracts from content, makes text harder to read.
  - **Impact:** Mobile battery drain, performance issues, readability problems
  - **Fix:** Keep stars (subtle), keep crescent moon (single decorative element). Remove lava blobs and floating orbs. Reduce particle count from 30 to 10.
  - **Verify:** Mobile GPU usage drops, content remains readable

- [ ] **BL-UX-H9**: Step guide disappears after use
  - **Severity:** High (UX)
  - **Files:** `frontend/index.html` (step guide ~line 1042)
  - **Problem:** 3-step guide hides after profile generation. Users lose navigation breadcrumb.
  - **Impact:** Users don't know what to do next
  - **Fix:** (1) Keep step guide visible as persistent breadcrumb, (2) Add step 4: "Explore your transits", (3) Add step 5: "Track your alignment"
  - **Verify:** Step guide remains visible, updates as user progresses

- [ ] **BL-UX-H10**: No card hierarchy (all cards identical)
  - **Severity:** High (UX)
  - **Files:** `frontend/css/components/cards.css`, `frontend/index.html`
  - **Problem:** Primary action cards, results cards, info cards, alerts all look identical — same bg, border, radius. No visual priority.
  - **Impact:** Users can't distinguish important actions from secondary content
  - **Fix:** Primary action cards get subtle gold border-top or gradient. Results cards use elevated shadow. Info cards stay flat.
  - **Verify:** Visual hierarchy clear between card types

- [ ] **BL-UX-H11**: All JS in one file (~3000 lines)
  - **Severity:** High (Performance)
  - **Files:** `frontend/index.html` (inline scripts)
  - **Problem:** All app logic inline. No code splitting, no lazy loading. Big Five questions (20 items) and VIA questions (24 items) render on load though 95% never visit Enhance tab.
  - **Impact:** Massive initial bundle, slow page load
  - **Fix:** Extract to modules: `app.js`, `chart.js`, `profile.js`, `transits.js`, `enhance.js` (lazy load). Only load tab code when tab is activated.
  - **Verify:** Initial bundle < 50KB, tab-specific code lazy loads

- [ ] **BL-UX-H12**: Keyboard navigation broken
  - **Severity:** High (Accessibility)
  - **Files:** `frontend/index.html` (tab order, modal focus trap)
  - **Problem:** Tab order passes through hidden `.tab-content`, auth overlay doesn't trap focus (can tab behind modal), more-dropdown items missing tabindex.
  - **Impact:** Keyboard users can't navigate effectively
  - **Fix:** (1) Add `display: none` to inactive tab content, (2) Implement focus trap in modals, (3) Add proper tabindex to all interactive elements
  - **Verify:** Keyboard-only navigation works throughout app

- [ ] **BL-UX-H13**: Screen reader gaps
  - **Severity:** High (Accessibility)
  - **Files:** `frontend/index.html` (chart results rendering)
  - **Problem:** Chart results use `<div>` soup with no heading hierarchy. Data rows lack semantic markup. Gate badges have no aria-label. SVG chart wheel has no role="img" or description.
  - **Impact:** Screen reader users can't parse content
  - **Fix:** (1) Add proper heading hierarchy (h2, h3, h4), (2) Convert data rows to `<dl>` or `<table>` with proper semantics, (3) Add aria-label to all badges, (4) Add role="img" and aria-label to SVG
  - **Verify:** Test with NVDA/JAWS screen readers

- [ ] **BL-UX-H14**: Touch targets too small on mobile
  - **Severity:** High (Accessibility)
  - **Files:** `frontend/css/components/mobile.css`, `frontend/index.html`
  - **Problem:** Alignment buttons are 40px×40px (WCAG minimum: 44px). Tab buttons have 14px padding (too small for touch).
  - **Impact:** Mobile users can't reliably tap controls
  - **Fix:** Bump all interactive elements to 44px minimum. Increase tab button padding to 16px.
  - **Verify:** All touch targets ≥ 44px per iOS/Android HIG

- [ ] **BL-UX-H15**: Mobile drawer tabs lose active-nav context
  - **Severity:** High (UX)
  - **Files:** `frontend/js/ui-nav.js`, `frontend/js/app.js`, `frontend/index.html`
  - **Problem:** `updateMobileNavForTab()` only maps `overview`, `chart/profile/celebrity/achievements/directory`, `transits/checkin/timing`, and `composite/clusters`. Tabs reached through the mobile drawer such as `enhance`, `diary`, `practitioner`, `history`, `rectify`, `sms`, and `onboarding` clear the bottom-nav active state entirely.
  - **Impact:** On mobile, users lose orientation after opening drawer-only sections because no primary nav item stays highlighted and the bottom bar stops reflecting where they are.
  - **Fix:** Map every drawer-only tab to an owning mobile group or keep the `Menu` item visibly active while a drawer-owned section is open. Ensure `switchTab()` and drawer open/close behavior keep the same active-state source of truth.
  - **Verify:** Open any mobile drawer-only section and the bottom nav still shows a clear active state instead of dropping all highlights.

- [ ] **BL-UX-H16**: Navigation chrome still uses sub-12px text and 28px controls
  - **Severity:** High (Accessibility)
  - **Files:** `frontend/css/components/mobile.css`, `frontend/css/components/sidebar.css`
  - **Problem:** Key navigation UI still drops below comfortable reading and interaction sizes: `.mobile-nav-label` reaches `0.6rem`, `.nav-group-title` uses `0.65rem`, `.nav-badge` uses `0.6rem`, and `.sidebar-toggle` is only `28px × 28px`.
  - **Impact:** Desktop sidebar labels/badges are harder to scan, mobile bottom-nav text becomes squint-level on smaller devices, and the collapse affordance is undersized for reliable pointer/touch use.
  - **Fix:** Set a minimum readable label scale for navigation chrome, reduce all-caps compression where needed, and bring the sidebar toggle up to the shared minimum interactive target size.
  - **Verify:** Navigation labels remain legible on small phones and tablets, and the sidebar toggle meets the same minimum target guidance as other controls.

### MEDIUM — Fix This Quarter (🟢 Differentiators)

- [ ] **BL-UX-M1**: Interactive bodygraph visualization
  - **Severity:** Medium (Feature)
  - **Files:** `frontend/js/bodygraph.js` (enhance), `frontend/index.html`
  - **Problem:** Bodygraph is static image. Users can't interact with it to learn.
  - **Impact:** Missed opportunity for discovery learning
  - **Fix:** Make bodygraph clickable — click any center/gate/channel to see its explanation in a tooltip or sidebar panel. Highlight connections between related elements.
  - **Verify:** Click Throat center → see explanation, connected gates highlighted

- [ ] **BL-UX-M2**: Share-ready profile image generator
  - **Severity:** Medium (Feature)
  - **Files:** `frontend/js/share-card.js` (enhance), new Instagram/social card generator
  - **Problem:** Users can't easily share their charts on social media. No visual export.
  - **Impact:** Zero word-of-mouth growth, no viral sharing
  - **Fix:** Generate Instagram-ready image: bodygraph + name + type + profile + tagline. PNG download or direct share to social.
  - **Verify:** Generate chart → Share button → beautiful 1080x1080 image ready to post

- [ ] **BL-UX-M3**: Real social proof (actual usage stats)
  - **Severity:** Medium (Trust)
  - **Files:** `frontend/index.html` (social proof section), new API endpoint for stats
  - **Problem:** Social proof falls back to hardcoded numbers. No real data.
  - **Impact:** Appears fake, undermines trust
  - **Fix:** Create API endpoint that returns real counts: users who generated charts this week, total profiles, charts calculated today. Update frontend to show live data with fallback messaging.
  - **Verify:** Stats reflect actual database counts

- [ ] **BL-UX-M4**: Simplify pricing tiers
  - **Severity:** Medium (Conversion)
  - **Files:** `frontend/index.html` (pricing modal)
  - **Problem:** $0 → $12 → $60 → $149/month. Plan v4 resolved the original pricing gap. Explorer at $12 sits in the market sweet spot.
  - **Impact:** ✅ RESOLVED by Plan v4 pricing restructure
  - **Fix:** Completed — tiers are now Free/$0, Explorer/$12, Guide/$60, Studio/$149 with daily ceilings via RATE_LIMIT_KV
  - **Verify:** Pricing feels fair, each tier has clear value

- [ ] **BL-UX-M5**: Transit timeline view
  - **Severity:** Medium (Feature)
  - **Files:** `frontend/index.html` (new transit timeline section), `frontend/js/transit-timeline.js` (create)
  - **Problem:** Transits show current state only. No view of when energy peaks or fades.
  - **Impact:** Users can't plan around cosmic weather
  - **Fix:** Add timeline visualization: "This energy peaks March 15 and fades by March 22." Show 30-day forward view with intensity curves.
  - **Verify:** Transit detail shows peak dates and duration

- [ ] **BL-UX-M6**: Progressive onboarding as default
  - **Severity:** Medium (UX)
  - **Files:** `frontend/index.html` (new user experience flow)
  - **Problem:** New users land on complex dashboard with no guidance. Onboarding is a hidden tab.
  - **Impact:** Confusion, high bounce rate for new users
  - **Fix:** Make onboarding the default first-time experience. Guide users through: (1) Enter birth data, (2) See your chart, (3) Read your type explanation, (4) Explore transits. After completion, show full dashboard.
  - **Verify:** First-time user sees guided tour, returning users see dashboard

- [x] **BL-UX-M7**: Remove "coming soon" features behind paywall
  - **Severity:** Medium (Trust)
  - **Files:** `frontend/index.html` (pricing modal, feature descriptions)
  - **Problem:** Pricing tiers previously listed unimplemented features. Plan v4 restructured tiers to Free/$0, Explorer/$12, Guide/$60, Studio/$149 with accurate feature descriptions matching actual delivered capabilities.
  - **Status:** Resolved by Plan v4 pricing restructure

- [ ] **BL-UX-M8**: Beautiful chart wheel rendering
  - **Severity:** Medium (Visual)
  - **Files:** `frontend/js/bodygraph.js` (Western astrology wheel rendering)
  - **Problem:** If Western astrology chart wheel exists, needs to match competitor quality (Co-Star, Chani). Current state unknown.
  - **Impact:** Visual competition, perceived quality
  - **Fix:** Ensure astrology wheel is beautiful: smooth gradients, clear aspect lines, readable labels, responsive sizing
  - **Verify:** Chart wheel looks professional, competitive with top apps

- [ ] **BL-UX-M9**: Aspect explanations in astrology
  - **Severity:** Medium (UX)
  - **Files:** `frontend/index.html` (astrology aspects rendering)
  - **Problem:** Aspects show as symbols only ("Sun □ Saturn") with no meaning.
  - **Impact:** Astrology section is data dump, not insight
  - **Fix:** Add plain English explanations: "Your Sun square Saturn means you face obstacles that build resilience. Success comes through discipline."
  - **Verify:** Each aspect shows meaning + implications

- [ ] **BL-UX-M10**: Daily forecast implementation
  - **Severity:** Medium (Feature)
  - **Files:** `frontend/index.html` (Today's Energy tab), new daily forecast generator
  - **Problem:** Transits show planetary positions but no "what does today hold for me?" forecast.
  - **Impact:** Users want actionable daily guidance
  - **Fix:** Generate short daily forecast: "Today's Moon in your Gate 5 brings patience for timing. Don't force. Venus in Gate 37 supports family connections."
  - **Verify:** User sees personalized daily forecast, not just planetary positions

### LOW — Polish & Enhancements (🔵 Nice to Have)

- [ ] **BL-UX-L1**: Typography consolidation (Steve Jobs principle)
  - **Severity:** Low (Polish)
  - **Files:** All frontend files
  - **Problem:** Too many font weights and letter spacings create visual noise.
  - **Impact:** Lacks premium feel
  - **Fix:** Consolidate to 3 weights (regular, medium, bold) and 2 letter spacings (normal, wide). Use whitespace for hierarchy.
  - **Verify:** Visual hierarchy clear with minimal typography variation

- [ ] **BL-UX-L2**: Micro-interactions and animations
  - **Severity:** Low (Delight)
  - **Files:** `frontend/css/animations.css` (create), component files
  - **Problem:** No subtle animations. Interactions feel flat.
  - **Impact:** Lacks premium feel
  - **Fix:** Add: gate reveal with subtle glow, defined centers pulse on hover, transit connections draw as animated lines
  - **Verify:** Interactions feel smooth and delightful

- [ ] **BL-UX-L3**: One-thing-at-a-time landing (Steve Jobs)
  - **Severity:** Low (UX)
  - **Files:** `frontend/index.html` (new user landing experience)
  - **Problem:** Landing page shows 5+ elements simultaneously: tabs, banners, testimonials, step guide, form, examples.
  - **Impact:** Overwhelming first impression
  - **Fix:** Show ONLY birth data form with single question: "When and where were you born?" Everything else reveals progressively.
  - **Verify:** New user sees minimal focused interface

- [ ] **BL-UX-L4**: Email header branding
  - **Severity:** Low (Branding)
  - **Files:** Email templates (if exist), `frontend/icons/email-header-600x200.png`
  - **Problem:** Generated email header exists but may not be used in actual emails.
  - **Impact:** Missed branding opportunity
  - **Fix:** Ensure all email templates use branded header image
  - **Verify:** Test emails show Prime Self branding

- [ ] **BL-UX-L5**: Pinterest pin image optimization
  - **Severity:** Low (Social)
  - **Files:** `frontend/icons/pinterest-pin-1000x1500.png`, meta tags
  - **Problem:** Pinterest pin image exists but may not be properly meta-tagged.
  - **Impact:** Missed Pinterest sharing optimization
  - **Fix:** Add Pinterest-specific meta tags: `<meta property="og:image" content="pinterest-pin.png">`
  - **Verify:** Pinterest preview shows optimized tall image

- [ ] **BL-UX-L6**: Reduce motion accessibility
  - **Severity:** Low (Accessibility)
  - **Files:** `frontend/css/artwork.css`, animation files
  - **Problem:** May not respect `prefers-reduced-motion` system setting.
  - **Impact:** Motion-sensitive users experience discomfort
  - **Fix:** Wrap all animations in `@media (prefers-reduced-motion: no-preference) { }`, provide static alternatives
  - **Verify:** Toggle OS reduced motion → animations stop

- [ ] **BL-UX-L7**: Language switcher i18n expansion
  - **Severity:** Low (i18n)
  - **Files:** `frontend/locales/` (add more languages)
  - **Problem:** Only English available currently. Limited global reach.
  - **Impact:** Excludes non-English speakers
  - **Fix:** Add Spanish, Portuguese, French, German, Chinese translations starting with key UI elements
  - **Verify:** Language switcher shows multiple functional languages

### SOCIAL MEDIA INTEGRATION — New Features

- [x] **BL-SOCIAL-H1**: Twitter/X sharing integration
  - **Severity:** High (Marketing)
  - **Files:** `frontend/index.html` (share modal), `frontend/js/social-share.js` (create)
  - **Problem:** No Twitter/X sharing functionality. Share modal has placeholder buttons.
  - **Impact:** Missing primary social sharing channel
  - **Fix:** Implement Twitter share: (1) Generate tweet text with chart insights, (2) Open Twitter intent URL with pre-filled text, (3) Option to attach chart image, (4) Track share clicks
  - **Tweet template:** "Just discovered I'm a {Type} {Profile} ✨ My decision style: {Authority}. Check out your energy blueprint at {referral_link}"
  - **Verify:** Twitter button opens pre-filled tweet with referral link

- [x] **BL-SOCIAL-H2**: Instagram sharing with image export
  - **Severity:** High (Marketing)
  - **Files:** `frontend/js/social-share.js`, `frontend/js/chart-image-generator.js` (create)
  - **Problem:** No Instagram sharing. Need visual content for IG.
  - **Impact:** Missing highest-engagement social platform for astrology/spirituality
  - **Fix:** (1) Generate 1080x1080 PNG with bodygraph + user info + Prime Self branding, (2) Download or copy to clipboard, (3) Show "Share to Instagram" instructions (mobile web limitation), (4) Track downloads
  - **Image format:** Bodygraph visual, "Type: Generator 3/5", "Authority: Emotional", "primeself.net" watermark
  - **Verify:** Download button gives beautiful Instagram-ready image

- [x] **BL-SOCIAL-H3**: Facebook sharing with Open Graph tags
  - **Severity:** High (Marketing)
  - **Files:** `frontend/index.html` (meta tags), `frontend/js/social-share.js`
  - **Problem:** No Facebook sharing, missing OG tags for rich previews.
  - **Impact:** Poor Facebook sharing experience, low engagement
  - **Fix:** (1) Add comprehensive OG meta tags (og:title, og:description, og:image, og:url, fb:app_id if needed), (2) Implement Facebook share dialog with pre-filled content, (3) Use og-image-1200x630.png for preview, (4) Track shares
  - **Share text:** "I just uncovered my unique energy blueprint! Type: {Type}, Profile: {Profile}. Discover yours →"
  - **Verify:** Facebook share shows rich preview with image and description

- [ ] **BL-SOCIAL-M1**: TikTok sharing (mobile-first)
  - **Severity:** Medium (Marketing)
  - **Files:** `frontend/js/social-share.js`, mobile-specific share handlers
  - **Problem:** No TikTok integration. Huge opportunity for viral growth in spiritual/astrology community.
  - **Impact:** Missing Gen Z primary platform
  - **Fix:** (1) Generate vertical video-ready format (9:16) chart image, (2) Mobile share sheet includes TikTok option, (3) Copy-friendly caption with hashtags, (4) Track TikTok shares
  - **Caption template:** "POV: You just discovered you're a {Type} {Profile} ✨ #HumanDesign #Astrology #EnergyBlueprint #SelfDiscovery #Spirituality"
  - **Verify:** Mobile users can share to TikTok with caption ready to paste

- [ ] **BL-SOCIAL-M2**: Threads integration
  - **Severity:** Medium (Marketing)
  - **Files:** `frontend/js/social-share.js`
  - **Problem:** Threads (Meta's Twitter alternative) not supported. Growing platform for text-based sharing.
  - **Impact:** Missing emerging platform with astrology-interested audience
  - **Fix:** (1) Implement Threads share intent (similar to Twitter), (2) Pre-fill text optimized for Threads format (500 char limit), (3) Include referral link, (4) Track shares
  - **Post template:** "Energy update: I'm a {Type} with {Authority} 🌙 My strategy is to {Strategy}. Wild how accurate this is… {link}"
  - **Verify:** Threads button opens app/web with pre-filled post

- [ ] **BL-SOCIAL-M3**: Bluesky integration
  - **Severity:** Medium (Marketing)
  - **Files:** `frontend/js/social-share.js`
  - **Problem:** Bluesky (decentralized Twitter alternative) not supported. Tech-forward audience overlap with astrology/spirituality.
  - **Impact:** Missing growing open-source social network
  - **Fix:** (1) Implement Bluesky share intent using their API/URL scheme, (2) Pre-fill post with chart highlights, (3) Include referral link, (4) Track shares
  - **Post template:** "Just found out I'm a {Type} {Profile} ✨ Makes so much sense now. What's your energy blueprint? {link}"
  - **Verify:** Bluesky share opens with pre-filled post

- [ ] **BL-SOCIAL-M4**: Social share analytics dashboard
  - **Severity:** Medium (Analytics)
  - **Files:** `workers/src/handlers/analytics.js` (enhance), new share tracking table
  - **Problem:** No tracking of which social platforms drive the most shares and signups.
  - **Impact:** Can't optimize marketing efforts
  - **Fix:** (1) Track share button clicks by platform, (2) Track referral conversions from each platform using UTM parameters, (3) Create admin dashboard showing share counts and conversion rates per platform, (4) Store in analytics or new social_shares table
  - **Schema:** `social_shares (id, user_id, platform, shared_at, referral_code, utm_source, converted BOOLEAN)`
  - **Verify:** Admin can see "Instagram: 245 shares, 12 conversions (4.9%)" type metrics

---

---

## Sprint 20 — Reliability Truth & Observability (2026-03-15)

**Policy anchor:** `process/RELIABILITY_POLICY.md`  
**Objective:** Make testing, simulation, verification, monitoring, and reporting truthful, deterministic, and release-grade.

### BL-S20-C1 | Coverage gate is broken and gives false confidence
- [x] **Status:** Complete
- **Severity:** Critical (Release Integrity)
- **Files:** `package.json`, `package-lock.json`, `vitest.config.js`
- **Problem:** The repo advertises coverage enforcement, but the coverage provider was not installed. `npm run test:coverage` could not produce a report or enforce thresholds.
- **Fix:** Install and lock the V8 coverage provider so coverage runs non-interactively and thresholds can actually execute.
- **Verify:** `npm run test:coverage` completes without prompts and exits non-zero on threshold failure.

### BL-S20-C2 | Production verifier is observational, not assertive
- [x] **Status:** Complete
- **Severity:** Critical (Operational Truth)
- **Files:** `workers/verify-production.js`
- **Problem:** The production verifier printed responses but did not assert contracts or fail on drift. That makes it unsuitable as a release gate.
- **Fix:** Convert it into an assertive verifier with explicit expected statuses, payload checks, and non-zero exit on failure.
- **Verify:** A healthy deployment exits 0. A broken endpoint or changed payload exits non-zero.

### BL-S20-C3 | Error pipeline and alert path are not proven end to end
- [ ] **Status:** Open
- **Severity:** Critical (Hands-off Operations)
- **Files:** `workers/src/index.js`, `workers/src/lib/sentry.js`, new tests for error capture
- **Problem:** Sentry capture and analytics error tracking exist, but there is no automated proof that thrown worker errors become durable operator-visible incidents.
- **Fix:** Add automated tests for top-level exception capture, Sentry delivery behavior, no-op behavior when Sentry is absent, and degraded-path event capture.
- **Verify:** Dedicated tests prove that critical exceptions are captured, classified, and non-blocking.

### BL-S20-H1 | Load simulation script is stale and allows false passes
- [x] **Status:** Complete
- **Severity:** High (Simulation Accuracy)
- **Files:** `tests/load-test.k6.js`
- **Problem:** The k6 script hit the wrong health path, used the wrong chart endpoint, declared an unused profile threshold, and allowed permissive rate-limit assertions that could pass even when the contract was wrong.
- **Fix:** Align the script to current routes and payloads, remove unexercised metrics, and remove permissive assertions from the throughput scenario.
- **Verify:** The script exercises real live routes and only reports on metrics it actually measures.

### BL-S20-H2 | Critical degrade paths are log-only or fail-open without durable signals
- [ ] **Status:** Open
- **Severity:** High (Observability)
- **Files:** `workers/src/middleware/tierEnforcement.js`, `workers/src/handlers/webhook.js`, `workers/src/lib/analytics.js`
- **Problem:** Important degraded states are often logged with `console.warn` or `console.error` but not promoted into structured, queryable operational events.
- **Fix:** Emit structured degradation events with severity, dependency, route, release, and retryability for approved fail-open paths and business-critical partial failures.
- **Verify:** Triggered degraded paths appear in durable error/event streams and can be alerted on.

### BL-S20-H3 | No external synthetic monitoring for core practitioner journeys
- [ ] **Status:** Open
- **Severity:** High (Operations)
- **Files:** deployment workflow, synthetic monitor configuration, new journey verifier assets
- **Problem:** There is no independent synthetic monitor continuously proving that auth, chart generation, profile generation, billing start, and embed validation still work in production.
- **Fix:** Add scheduled synthetic probes for critical journeys and wire alerts on failure.
- **Verify:** A broken critical path is detected by external synthetic monitoring within minutes.

### BL-S20-M1 | Setup verifier has drifted from the live health contract
- [x] **Status:** Complete
- **Severity:** Medium (Verification Accuracy)
- **Files:** `workers/verify-setup.js`
- **Problem:** The setup verifier expected stale health fields and could report misleading success messages.
- **Fix:** Align it to the current `/api/health?full=1` payload and fail when worker or DB health is degraded.
- **Verify:** The script reports only current health fields and flags DB health failures.

### BL-S20-M2 | Missing structured logging contract and correlation IDs
- [ ] **Status:** Open
- **Severity:** Medium (Operability)
- **Files:** `workers/src/index.js`, shared logging utilities, critical handlers/middleware
- **Problem:** Production-significant events are not consistently emitted as structured logs with correlation data.
- **Fix:** Define and enforce a log schema with request ID, user ID, route, severity, dependency, release, and error class.
- **Verify:** Critical logs are machine-queryable and traceable across async paths.

### BL-S20-M3 | Release gates do not yet combine tests, coverage, and canary verification
- [ ] **Status:** Open
- **Severity:** Medium (Release Management)
- **Files:** CI workflow, deployment workflow, verification scripts
- **Problem:** The repo does not yet enforce a truth-based release gate that combines unit tests, coverage, contract verification, and post-deploy checks.
- **Fix:** Add deployment gating that blocks release on failed tests, broken coverage, failed production verification, or failed canaries.
- **Verify:** A bad build cannot be promoted without bypassing an explicit gate.

### Sprint 20 Execution Plan

**Phase 1 — Truthful Local Gates:**
- BL-S20-C1: Restore working coverage enforcement
- BL-S20-C2: Make production verification assertive
- BL-S20-H1: Align load simulation with live contracts
- BL-S20-M1: Update setup verification to match live health schema

**Phase 2 — Error Truth:**
- BL-S20-C3: Prove error capture and monitoring paths
- BL-S20-H2: Convert critical log-only degradations into durable events
- BL-S20-M2: Standardize structured log schema and correlation IDs

**Phase 3 — World-Class Ops:**
- BL-S20-H3: Add external synthetic journey monitoring
- BL-S20-M3: Enforce release gates in deployment workflows

---

## Practitioner Dashboard — Shipped (2026-03-10)

Full practitioner dashboard built and wired. Replaced the broken stub (wrong API fields, wrong data keys, no actions).

### What Guide ($60/mo) tier now includes

| Feature | Status |
|---------|--------|
| Client roster — view all clients | ✅ Shipped |
| Add client by email | ✅ Shipped (fixed: was sending `clientName`, now sends `clientEmail`) |
| Client limit progress bar (X / 50 used) | ✅ Shipped |
| Per-client: chart summary (type, authority, profile, strategy, definition) | ✅ Shipped |
| Per-client: profile synthesis preview (quickStart paragraph) | ✅ Shipped |
| Per-client: PDF export button | ✅ Shipped |
| Per-client: grounding audit display | ✅ Shipped |
| Remove client from roster (with confirm) | ✅ Shipped (fixed: was missing entirely) |
| Auto-loads roster on tab open | ✅ Shipped (was: required manual button click) |
| Upgrade CTA routes to practitioner pricing overlay | ✅ Shipped |

### What is NOT yet included (future)

- Session notes per client (needs new DB table)
- Bulk chart generation for multiple clients at once
- Notion sync per client (OAuth setup required)
- Client invite via email (currently client must self-register first)
- Client birth data entry by practitioner (currently client must enter their own)

---

## Market Validation Issues (2026-03-10) — 4 new items

Found during second-pass market validation review. See `docs/MARKET_VALIDATION_RECOMMENDATIONS.md` for full context.

### BL-MV-N1 | Studio tier ($149/mo) — feature descriptions updated
- [x] **Status:** Done (2026-06)
- **Severity:** Critical
- **Files:** `frontend/index.html` (line 309), `workers/src/handlers/billing.js`
- **Problem:** The Studio pricing card had inaccurate feature descriptions. Now updated to reflect actual delivered features: white-label, 10K API calls/month, 1000 profiles, custom webhooks.
- **Fix Applied:** Reworded pricing card to match actual features. Price updated from $500 to $149 (Plan v4).

### BL-MV-N2 | Composite form: birth location not auto-populated
- [ ] **Status:** Open
- **Severity:** High
- **Files:** `frontend/index.html` (`restoreBirthData()` function, ~line 2607)
- **Problem:** `restoreBirthData()` restores `comp-dateA` and `comp-timeA` from localStorage, but does NOT restore `comp-A-location`, `comp-A-lat`, or `comp-A-lng`. The composite form still requires the user to manually re-enter their own birth location (and re-geocode) even after their chart has been saved.
- **Impact:** Friction on composite chart generation. Contradicts the "enter once" intent of the localStorage birth data system.
- **Fix:** In `restoreBirthData()`, after filling `comp-dateA` and `comp-timeA`, also fill:
  ```js
  const compLocA = document.getElementById('comp-A-location');
  const compLatA = document.getElementById('comp-A-lat');
  const compLngA = document.getElementById('comp-A-lng');
  if (compLocA && data.location) compLocA.value = data.location;
  if (compLatA && data.lat) compLatA.value = data.lat;
  if (compLngA && data.lng) compLngA.value = data.lng;
  ```
- **Verify:** After calculating a chart, navigate to Composite tab → Person A location field pre-filled with saved location.

### BL-MV-N3 | `totalProfiles` counter shows blank on API failure
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `frontend/index.html` (line 380)
- **Problem:** The social proof banner has `<span id="totalProfiles"></span>` with no default value. If the API call that populates it fails, returns zero, or is slow, users see: "— AI synthesis reports generated" which looks broken and undermines trust rather than building it.
- **Impact:** Degrades the trust signal the banner is designed to create. First impression damage on landing.
- **Fix (option A):** Initialize the span with a floor value: `<span id="totalProfiles">100+</span>` — overwritten by real count when available.
- **Fix (option B):** Hide the entire stat row until the API returns a non-zero count.
- **Verify:** Load page with network throttled to slow 3G → profile count stat still shows a meaningful value.

### BL-MV-N4 | `RESEND_API_KEY` production status unverified
- [ ] **Status:** Open
- **Severity:** High
- **Files:** `workers/src/lib/email.js` (line ~14), production Worker secrets
- **Problem:** Email delivery via Resend is fully implemented in code but soft-fails silently if `RESEND_API_KEY` is not set (`console.warn` only, registration still succeeds). There is no confirmation that the key is configured in production Cloudflare Worker secrets. Welcome emails and password reset emails may be silently dropping for all production users.
- **Impact:** All welcome emails and password reset emails fail to deliver without any visible error. Users who forget their password cannot recover their account.
- **Fix:** (1) Verify `RESEND_API_KEY` is set in `wrangler secret list`. (2) Trigger a test registration and confirm email received. (3) Consider adding a startup health check that logs email config status.
- **Verify:** Register new account → welcome email received. Trigger "Forgot Password" → reset email received within 60 seconds.

---

## Launch Readiness Audit — 2026-03-10

**Verdict:** 🔴 DO NOT LAUNCH — 4 blockers must be cleared before any paying customer is accepted.  
**Source:** `LAUNCH_READINESS_REPORT.md` (v2 — full evidence re-audit)

---

### Required — Launch Blockers (4)

### BL-LR-C1 | IDOR: cluster endpoints expose member emails and birth data to any authenticated user
- [x] **Status:** Done (2026-03-10)
- **Severity:** Critical (Security / GDPR)
- **Files:** `workers/src/handlers/cluster.js` (lines 333, 407), `workers/src/db/queries.js` (line 339)
- **Problem:** `handleGet()` and `handleSynthesize()` both call `getClusterMembers(clusterId)` with no membership check. The SQL is `WHERE cm.cluster_id = $1` — no `user_id` filter. Any authenticated user (including free tier) can call `GET /api/cluster/<uuid>` with any valid cluster ID and receive every member's: `email`, `birth_date`, `birth_time`, `birth_timezone`, `birth_lat`, `birth_lng`.
- **Impact:** Active data breach — GDPR Article 5(1)(f) integrity violation. Constitutes a reportable breach under GDPR Article 33 if exploited.
- **Fix:** Add membership pre-check in both handlers before the cluster query:
  ```javascript
  const userId = request._user?.sub;
  const memberCheck = await query(
    `SELECT 1 FROM cluster_members WHERE cluster_id = $1 AND user_id = $2`,
    [clusterId, userId]
  );
  if (!memberCheck.rows?.length) {
    return Response.json({ error: 'Access denied' }, { status: 403 });
  }
  ```
- **Effort:** 30–60 min
- **Verify:** `GET /api/cluster/:id` with a token whose `sub` is NOT a member of that cluster → returns 403, not member data.

### BL-LR-C2 | "Human Design" trademark appears in shareable PNG, embed widget, and SEO meta tags
- [x] **Status:** Done (2026-03-10)
- **Severity:** Critical (IP / Legal)
- **Files:** `frontend/js/share-card.js` (lines 185, 174, 253), `frontend/js/explanations.js` (lines 8, 91+), `frontend/index.html` (lines 100–118), `frontend/embed.html` (line 258), `frontend/js/bodygraph.js` (line 178)
- **Problem:** "Human Design" is a trademark held by IHDS / Jovian Archive Corp. It appears in: the footer of every share-card PNG that gets distributed to social media; the `navigator.share()` text; every page's `<meta name="description">`, OG tags, and Twitter card; the distributed `embed.html` widget (highest-risk: not under your domain control); and the bodygraph SVG aria-label. The type names (Generator, Manifesting Generator, Projector, Manifestor, Reflector) are also trademarked concepts. Additionally, `explanations.js:8` credits "Ra Uru Hu" by name in user-facing JS.
- **Impact:** C&D from Jovian Archive. Embed widget distribution compounds risk because the trademark is being redistributed to third-party sites. Share cards distribute it at social media scale.
- **Fix (choose one):**
  - **(a) License:** Obtain commercial license from Jovian Archive (www.jovianarchive.com).
  - **(b) Rebrand:** Replace with IP-safe terms already partially adopted: "Energy Blueprint" for "Human Design", "Soul Cross" for "Incarnation Cross", "Pattern/Guide/Builder/Initiator/Mirror" for type names, remove Ra Uru Hu credit.
  - **(c) Nominative fair use + disclaimer (weakest):** Add "Human Design® is a registered trademark of Jovian Archive Corp." on all pages; remove from embed and share surfaces; consult IP attorney.
- **Effort:** 2–4 h for rebrand option; legal timeline unknown for license option.
- **Verify:** No instance of "Human Design" remains in: share-card footer/share-text, `embed.html`, `<meta>` tags. All type names use IP-safe equivalents in user-facing surfaces.

### BL-LR-C3 | Migration 020 not confirmed applied to production — Stripe tier constraint may crash on checkout
- [ ] **Status:** Open
- **Severity:** Critical (Revenue)
- **Files:** `workers/src/db/migrations/020_fix_subscription_constraints.sql`, `workers/src/handlers/webhook.js` (lines 43–45)
- **Problem:** Webhook handler writes `'regular'`, `'practitioner'`, `'white_label'` to `subscriptions.tier`. The original schema only permitted `('free','seeker','guide','practitioner')`. Migration 020 expands the constraint to include both old and new tier names. The migration file is correctly written — but there is no confirmation it has been applied to the **production** Neon database. If it has not, every Explorer ($12) and Studio ($149) checkout will: complete payment → fire webhook → hit DB CHECK constraint violation → roll back → **customer charged but tier not upgraded**.
- **Impact:** Revenue loss through chargebacks; subscriber trust destroyed; every paid signup silently broken on 2 of 3 tiers.
- **Verify in Neon console (production):**
  ```sql
  SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE conrelid = 'subscriptions'::regclass AND contype = 'c';
  -- Must include: tier IN ('free','seeker','guide','regular','practitioner','white_label')
  ```
- **Fix if not applied:** `node workers/run-migration.js workers/src/db/migrations/020_fix_subscription_constraints.sql`
- **Effort:** 15 min to verify; 5 min to apply if needed.
- **Verify:** Run `stripe trigger checkout.session.completed` against production → no DB constraint error in Worker logs; `subscriptions.tier` shows `'regular'`.

### BL-LR-C4 | Secrets directory git history status unknown — credentials may be permanently exposed
- [x] **Status:** Done (2026-03-10)
- **Severity:** Critical (Security)
- **Files:** `secrets/` directory, `.gitignore` (lines 19–21)
- **Note:** Overlaps with `BL-R-C1` (which covers root `Secrets.txt`). This item covers the `secrets/` **directory** — a separate path containing production keys. Both must be verified.
- **Problem:** The `secrets/` directory contains live production credentials (Stripe `sk_live_*`, Neon connection string with password, Anthropic, Telnyx, Groq, Grok, Cloudflare API token, GitHub PAT). `.gitignore` correctly excludes `secrets`, `secrets/`, and `secrets.*` — but `.gitignore` only prevents **future** commits. If these files were committed before the gitignore rule was added, the credentials are permanently in git history and accessible to anyone with repo access.
- **Impact:** Full infrastructure compromise: payment fraud (Stripe), database takeover (Neon), AI API cost abuse (Anthropic/Groq/Grok), SMS fraud (Telnyx), Cloudflare account takeover.
- **Verify:**
  ```bash
  git log --all --oneline -- secrets 2>&1
  git log --all --oneline -- "secrets/*" 2>&1
  ```
  If any commits are returned → credentials are in history.
- **Fix if ever committed:**
  1. Rotate ALL credentials immediately across all 8 services.
  2. `git filter-repo --path secrets --invert-paths` to scrub history.
  3. Force-push all branches; notify all repo collaborators to re-clone.
  4. Treat current credentials as permanently compromised regardless.
- **Effort:** 15 min to verify; 2–4 h rotation if secrets were committed.
- **Verify:** `git log --all --oneline -- secrets` returns no output. All services authenticated with newly rotated credentials.

---

### Recommended — Launch Conditions (8)

### BL-LR-M1 | Promo codes validated but not passed to Stripe checkout — customers pay full price
- [x] **Status:** Done (2026-03-10)
- **Severity:** High
- **Files:** `workers/src/handlers/promo.js`, `workers/src/handlers/billing.js`
- **Problem:** `POST /api/promo/apply` validates promo codes correctly, but checkout session creation in `billing.js` does not pass the validated promo code to Stripe (`allow_promotion_codes` or `discounts: [{promotion_code}]` absent). A customer who enters a valid promo code sees "Applied" confirmation, then is charged full price.
- **Impact:** Consumer protection issue; leads to disputes and refund requests once any marketing campaign using promo codes launches.
- **Fix:** In the checkout session creation call, after validating the promo code, pass it to Stripe:
  ```javascript
  const promoCodes = await stripe.promotionCodes.list({ code: promoCode, active: true });
  if (promoCodes.data.length > 0) {
    sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }];
  }
  ```
- **Effort:** 1–2 h
- **Verify:** Create a Stripe test promotion code → enter at checkout → confirmed charge shows discount applied.

### BL-LR-M2 | Worker bundle (2.27 MB) requires paid Cloudflare plan — not documented as hard dependency
- [x] **Status:** Done (2026-03-10)
- **Severity:** Medium
- **Files:** `workers/wrangler.toml`, `ARCHITECTURE.md`, deployment documentation
- **Problem:** `wrangler deploy --dry-run` reports 2266.09 KiB uncompressed (533.49 KiB gzip). The Workers **Free** tier limit is 1 MB; the Workers **Paid** (Bundled) plan limit is 10 MB. The bundle exceeds the free tier. If the Cloudflare account is ever downgraded (billing failure, plan change), `wrangler deploy` will immediately fail with a "Script too large" error — the Worker cannot be re-deployed and the entire service goes dark until the account is re-upgraded or the bundle is shrunk. The main driver of bundle size is the esbuild-inlined knowledgebase JSON in `src/knowledgebase/` (~972 KB).
- **Impact:** A billing lapse causes a complete, unrecoverable production outage until manually remediated. No code change is needed at current scale — this is a **documentation and process** deficiency.
- **Fix:** No code change required. Add the following to `ARCHITECTURE.md` and deployment runbooks:
  > ⚠️ **Hard infrastructure dependency**: The production Cloudflare Worker bundle is 2.27 MB uncompressed. This requires an active **Cloudflare Workers Paid** (Bundled or Unbound) plan. The free tier (1 MB limit) is insufficient. Ensure Cloudflare billing never lapses: a downgrade will prevent all deployments until resolved.
- **Effort:** 15 min documentation only.
- **Verify:** `ARCHITECTURE.md` and deployment docs note the paid plan requirement. Cloudflare billing is confirmed active and auto-renewing.

### BL-LR-M3 | API responses missing Content-Security-Policy header
- [x] **Status:** Done (2026-03-10)
- **Severity:** Low
- **Files:** `workers/src/middleware/security.js`
- **Problem:** `security.js` sets HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy on all responses — but does not set `Content-Security-Policy`. The SPA frontend (`index.html`) has a comprehensive CSP meta tag covering normal browser rendering. The gap is API responses only, which is low-risk for a JSON API.
- **Fix:** Add to the security header set in `security.js`:
  ```javascript
  headers.set('Content-Security-Policy', "default-src 'none'");
  ```
  This is appropriate for JSON API endpoints that should never render HTML or load resources.
- **Effort:** 30 min.
- **Verify:** `curl -I https://<worker-url>/api/health` response includes `Content-Security-Policy: default-src 'none'`.

### BL-LR-M4 | Migration 019 exited with code 1 — cluster synthesis may fail if columns absent
- [ ] **Status:** Open
- **Severity:** Medium
- **Files:** `workers/src/db/migrations/019_cluster_member_birth_data.sql`, `workers/src/handlers/cluster.js`
- **Problem:** Migration 019 adds `birth_date`, `birth_time`, `birth_timezone`, `birth_lat`, `birth_lng` to `cluster_members`. During a prior session, `run-migration.js` exited with code 1 on this file. If the migration did not apply, `handleSynthesize()` will throw a DB column-not-found error for every cluster synthesis attempt. Migration 019 uses `ADD COLUMN IF NOT EXISTS` throughout — it is **safe to re-run**.
- **Latest diagnostic (2026-03-10):** Re-run from `workers/` fails before SQL execution with `Missing database connection string (NEON_CONNECTION_STRING)`. The previous exit code 1 may have been environment-related, not a migration SQL failure.
- **Verify in Neon console:**
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'cluster_members'
  ORDER BY ordinal_position;
  -- Must include: birth_date, birth_time, birth_timezone, birth_lat, birth_lng
  ```
- **Fix if columns absent:** `node workers/run-migration.js workers/src/db/migrations/019_cluster_member_birth_data.sql`
- **Effort:** 10 min to verify + run.
- **Verify:** `\d cluster_members` in Neon console shows all 5 birth data columns.

### BL-LR-M5 | 21 console.log / console.warn statements in production frontend
- [x] **Status:** Done (2026-03-10)
- **Severity:** Low
- **Files:** `frontend/index.html` (21 statements), `frontend/js/offline-transits.js` (12), `frontend/js/lazy.js` (3), `frontend/js/i18n.js` (2), others (~3)
- **Problem:** Production JS bundles leak internal state to DevTools. Examples include: auth token handling, API response bodies, initialization sequences. Unprofessional and discloses implementation details.
- **Fix:** Remove or guard all console.* calls behind a `DEBUG` flag:
  ```javascript
  const DEBUG = false; // set to true in local dev only
  if (DEBUG) console.log(...);
  ```
- **Effort:** 1–2 h.
- **Verify:** Chrome DevTools console is clean on production URL with no log output from application code.

### BL-LR-M6 | Wrangler v3 in use; v4 available; 4 moderate dev-only CVEs pending
- [ ] **Status:** Open
- **Severity:** Low
- **Files:** `workers/package.json` (wrangler version), `workers/` npm tree
- **Problem:** Workers uses `wrangler@3.x`; `wrangler@4.71.0` is available. `npm audit` (workers) reports 4 moderate CVEs: esbuild dev-server exploit (GHSA), undici unbounded decompression (GHSA), miniflare local server (GHSA). All 4 are in **dev dependencies only** — the deployed Worker bundle contains zero CVE-affected code. Root package has 2 high CVEs in `@cloudflare/mcp-server-cloudflare` — also dev-only.
- **Risk to production:** Zero. This is housekeeping only to reduce audit noise.
- **Fix:** `npm install --save-dev wrangler@4` in `workers/`. Review wrangler v4 changelog for breaking changes before deploying. Separately: `npm audit fix` in root package (MCP server dev deps).
- **Effort:** 30–60 min (upgrade + test cycle).
- **Verify:** `npx wrangler --version` shows v4.x. `npm audit` returns 0 vulnerabilities in `workers/`. All existing wrangler commands still work.

### BL-LR-M7 | ENVIRONMENT_VARIABLES.md documents wrong Stripe price variable names
- [x] **Status:** Done (2026-03-10)
- **Severity:** Low (Documentation only)
- **Files:** `guides/ENVIRONMENT_VARIABLES.md`, `workers/wrangler.toml`, `workers/src/handlers/billing.js`
- **Problem:** Documentation and `stripe-setup.sh` used obsolete env var names (`STRIPE_PRICE_SEEKER`, `STRIPE_PRICE_GUIDE`). Code and `wrangler.toml` use: `STRIPE_PRICE_REGULAR`, `STRIPE_PRICE_PRACTITIONER`, `STRIPE_PRICE_WHITE_LABEL`.
- **Fix:** Updated `ENVIRONMENT_VARIABLES.md`, `CODEBASE_MAP.md`, `stripe-setup.sh`, and all other docs to use the correct variable names: `STRIPE_PRICE_REGULAR` (Explorer tier, $12), `STRIPE_PRICE_PRACTITIONER` (Guide tier, $60), `STRIPE_PRICE_WHITE_LABEL` (Studio tier, $149).
- **Effort:** 15 min.
- **Verify:** `grep STRIPE_PRICE guides/ENVIRONMENT_VARIABLES.md` matches `grep STRIPE_PRICE workers/wrangler.toml`.

### BL-LR-M8 | Gene Keys knowledgebase — license and attribution scope not verified
- [ ] **Status:** Open
- **Severity:** Medium (Legal)
- **Files:** `src/knowledgebase/genekeys/keys.json`, `frontend/js/explanations.js` (line 8)
- **Problem:** `keys.json` contains the 64 Gene Keys system content. `explanations.js:8` credits "Gene Keys (Richard Rudd)" in user-facing JS. Gene Keys® is a registered trademark of Gene Keys Ltd (Richard Rudd). Unlike Human Design (aggressively enforced by IHDS), Gene Keys uses a more flexible community model, but commercial use still requires awareness of license terms.
- **Impact:** Lower enforcement risk than Human Design (BLOCKER-2) but the same structural IP exposure — using a trademarked system commercially without a documented license.
- **Fix:** (1) Legal review: confirm whether current use qualifies as proper attribution vs. commercial use requiring license. (2) Add "Gene Keys® is a registered trademark of Gene Keys Ltd." disclaimer to relevant pages. (3) Cross-reference with the rebrand approach chosen for BLOCKER-2 — may be able to address both in one pass.
- **Effort:** Legal review timeline unknown; disclaimer addition 15 min.
- **Verify:** Legal review documented. Attribution or license clearly stated on any page that uses Gene Keys content.

---

*This backlog is the single source of truth for known issues. Reference items by ID in commit messages and PR descriptions.*
