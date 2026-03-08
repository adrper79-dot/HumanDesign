# Prime Self — Backlog

**Last audited:** 2026-03-07 (Sprint 15 deep audit)
**Test suite:** 190/190 passing (vitest 3.2.4)
**Completion status:** Sprints 1–14 COMPLETE ✅ | Sprint 15: 10 new items (3 Critical, 3 High, 4 Medium)
**Audit scope:** Full codebase + all documentation + DB schema alignment + engine accuracy + language/comprehension + profile specificity

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

## Moderate (14) — Functional gaps, security, data completeness

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

---

## Minor (10) — Polish, consistency, housekeeping

### BL-m1 | Response envelope inconsistency
- [x] **Status:** Done (2026-03-04)
- **Files:** `workers/src/handlers/*.js`, `tests/handlers.test.js`
- **Problem:** Some handlers return `{ success: true }`, others `{ ok: true }`. API spec documents no consistent envelope.
- **Fix:** Standardize on one shape (suggest `{ ok: true, data: {...} }` per ARCHITECTURE.md).

### BL-m2 | Health endpoint hardcodes stale values
- [x] **Status:** Done (2026-03-04)
- **Files:** `workers/src/index.js`
- **Problem:** Returns `version: '0.5.0'` (actual package.json: `0.2.0`) and `endpoints: 32` (actual: 33).
- **Fix:** Updated version to '0.2.0', removed stale endpoint count, added timestamp for better health check utility.

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
- **Problem:** States "121 tests" in multiple places. Actual count: 190.
- **Fix:** All documentation already shows 190 tests correctly.

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

---

## Test Coverage Gaps

These are areas with zero test coverage. Not all need immediate tests, but high-risk modules should be prioritized.

| Priority | Module | Risk |
|---|---|---|
| **High** | `workers/src/db/queries.js` | DB layer — currently broken (BL-C1) |
| **High** | `workers/src/middleware/auth.js` | Auth bypass risk |
| **High** | `workers/src/lib/llm.js` | LLM failover chain — no verification of rotation logic |
| **Medium** | `src/prompts/digest.js` | SMS content generation — silently broken (BL-M6) |
| **Medium** | `src/prompts/rag.js` | RAG builder — wrong data access pattern (BL-M7) |
| **Medium** | `workers/src/handlers/practitioner.js` | 6 endpoints, 0 tests |
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
- **Files:** `README.md`, `frontend/index.html`, `ARCHITECTURE.md`, `docs/ARCHITECTURE.md`
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
- **Problem:** `/api/stats/activity` returns hardcoded fake numbers (2,847 weekly users, 18,392 profiles). `email.js` contains a fabricated testimonial ("Marcus Chen, Seeker Tier"). These are deceptive to consumers and violate FTC guidelines on endorsements and advertising claims.
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
- **Problem:** Fallback connection string with real credentials (`neondb_owner:npg_FlB3I6JYdboV@ep-rapid-bird...`) is hardcoded in source. Anyone with repo access has full DB credentials.
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
- **Files:** `ARCHITECTURE.md` (Section 5.3), `docs/ARCHITECTURE.md`
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

*This backlog is the single source of truth for known issues. Reference items by ID in commit messages and PR descriptions.*
