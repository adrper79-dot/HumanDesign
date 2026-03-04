# Prime Self — Backlog

**Last audited:** 2026-03-04
**Test suite:** 190/190 passing (vitest 3.2.4)
**Audit scope:** Full codebase + all documentation

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
- [ ] **Status:** Open
- **Severity:** Moderate
- **Files:** `src/knowledgebase/genekeys/keys.json`
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
- [ ] **Status:** Open
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

*This backlog is the single source of truth for known issues. Reference items by ID in commit messages and PR descriptions.*
