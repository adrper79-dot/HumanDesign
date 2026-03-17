# 🔬 Deep Codebase Scan

**Purpose:** Surgical read-only scan of actual source code to surface defects,
silent failures, and improvement opportunities not yet tracked in the registry.

**Usage:** Copy the prompt below and hand it to your agent.

---

```
You are THE LOOP agent in DEEP SCAN mode.

Working directory: c:\Users\Ultimate Warrior\My project\HumanDesign

Do NOT deploy. Do NOT modify application code. Scan and report only.

─────────────────────────────────────────────────
STEP 0 — CALIBRATE
─────────────────────────────────────────────────

Load your quality standards. Read these files before touching any source code:

  process/BUILD_BIBLE.md         → coding patterns, what "correct" looks like here
  process/RELIABILITY_POLICY.md  → testing, error handling, verification contracts
  process/LESSONS_LEARNED.md     → known failure patterns already resolved
  audits/issue-registry.json     → already-tracked issues (deduplicate against these)
  ARCHITECTURE.md                → system boundaries, expected data flows
  CODEBASE_MAP.md                → file inventory and responsibilities

After reading, output one sentence: the current defect density trend based on
issue-registry.json (e.g. "51 open / 70 resolved — density trending down").

─────────────────────────────────────────────────
STEP 1 — BACKEND SCAN  (workers/src/)
─────────────────────────────────────────────────

Read every file in workers/src/ and its subdirectories.
For each file, apply every check below.

  ERRORS & DEFECTS
  ────────────────
  [ ] Swallowed errors — catch blocks that log but return 200 or nothing
  [ ] Missing await — async calls without await that silently skip
  [ ] Unchecked nulls — values used after a DB/fetch call without a null guard
  [ ] Wrong HTTP status — errors returned as 200, success returned as 500
  [ ] Missing DB transaction — multiple writes that must be atomic but aren't
  [ ] Raw SQL bypass — strings built with template literals instead of parameterized queries
        (cross-check against audits/RAW_SQL_AUDIT.md for already-known ones)
  [ ] Hardcoded secrets — API keys, tokens, or passwords in source
  [ ] Auth gap — routes that should require a valid JWT but don't call verifyToken
  [ ] Missing input validation — user-supplied strings used without sanitization
  [ ] Missing CORS or auth headers on endpoints that touch sensitive data

  CODE QUALITY
  ────────────
  [ ] Dead code — exported functions with no callers in workers/src/index.js routing
  [ ] Duplicate logic — the same transformation written in two or more handlers
  [ ] TODO / FIXME / HACK / XXX comments left in source
  [ ] console.log in production code — should use workers/src/lib/logger.js
  [ ] Magic numbers — hardcoded tier IDs, Stripe price IDs, plan names, quota limits
  [ ] Missing rate limiting on expensive endpoints (AI calls, chart generation, email send)
  [ ] Response envelope inconsistency — some handlers return {data:...}, others return flat

  RELIABILITY
  ───────────
  [ ] No retry logic on Neon DB calls (cold-start connection timeouts)
  [ ] KV reads with no fallback when key is missing or expired
  [ ] R2 read/write with no error handling
  [ ] Resend or Telnyx calls not wrapped in try/catch
  [ ] Cron handlers with no structured log on entry and exit (silent pass/fail)

─────────────────────────────────────────────────
STEP 2 — FRONTEND SCAN  (frontend/js/app.js)
─────────────────────────────────────────────────

Read frontend/js/app.js in full. Apply every check below.

  ERRORS & DEFECTS
  ────────────────
  [ ] fetch() calls with no .catch() or error branch
  [ ] Token read from localStorage — must be in-memory module-level variable only
        (correct pattern: module-level `let token = null` — NOT localStorage)
  [ ] Loading state that can get stuck — spinner triggered with no timeout or cancel path
  [ ] DOM writes on elements that may not exist — no null check before .innerHTML or .textContent
  [ ] Event listeners registered inside functions called repeatedly — attaches multiple times
  [ ] Form submit handlers that don't call e.preventDefault() before async work begins
  [ ] Hardcoded API base URL — must be https://prime-self-api.adrper79.workers.dev everywhere

  UX DEFECTS
  ──────────
  [ ] Empty states with no message or call-to-action (blank screen = user confusion)
  [ ] Error messages that expose raw JSON, stack traces, or internal IDs to the user
  [ ] Success flows that don't visibly update the UI (user gets no feedback)
  [ ] Flows where browser back-navigation would break in-memory state
  [ ] New UI sections without mobile breakpoints (target: 375px minimum)

  OPPORTUNITIES
  ─────────────
  [ ] Repeated fetch patterns that could be a shared fetchWithAuth() helper
  [ ] Inconsistent loading state — some sections show a spinner, others go blank
  [ ] Missing analytics events on key conversion actions:
        registration complete, chart generated, upgrade clicked,
        practitioner added client, session note saved, invitation redeemed

─────────────────────────────────────────────────
STEP 3 — TEST COVERAGE SCAN  (tests/)
─────────────────────────────────────────────────

Read all test files in tests/ — exclude tests/e2e/ (E2E has a separate runner).

  [ ] List every handler in workers/src/handlers/ with ZERO test coverage
  [ ] List every utility in workers/src/lib/ with ZERO test coverage
  [ ] Identify tests that cover only the happy path (no error or edge case assertions)
  [ ] Identify tests that mock the Neon DB connection
        (violates process/RELIABILITY_POLICY.md — tests must hit a real DB)
  [ ] Identify test files that import from paths that no longer exist in the codebase

─────────────────────────────────────────────────
STEP 4 — FEATURE COMPLETENESS SCAN
─────────────────────────────────────────────────

Cross-reference FEATURE_MATRIX.md against the actual codebase.

  For each feature marked "complete":
  [ ] Route handler exists in workers/src/?
  [ ] UI section exists in frontend/js/app.js?
  [ ] At least one test covers the happy path?
  [ ] Wired into the router in workers/src/index.js?

  For each feature marked "partial" or "not started":
  [ ] Is there more code than the matrix shows? (matrix may be stale)
  [ ] Is there a hard dependency blocking it? (document if so)

─────────────────────────────────────────────────
STEP 5 — SCHEMA INTEGRITY SCAN
─────────────────────────────────────────────────

Read workers/src/db/migrations/ (all .sql files in order).

  [ ] Every table referenced in handlers is defined in a migration
  [ ] No column name used in JS is absent from the schema
  [ ] No migration alters a column in a way that breaks existing queries
  [ ] No foreign key column is missing an index
  [ ] No field collected in the UI is never persisted to the DB

─────────────────────────────────────────────────
OUTPUT
─────────────────────────────────────────────────

Write one file: audits/DEEP_SCAN_[TODAY_DATE].md

  ## Executive Summary
  - Files scanned: [list]
  - Total new findings: [N]  (P0: X  P1: X  P2: X  P3: X)
  - Already-known issues skipped: [N]  (deduped against issue-registry.json)

  ## P0 — Production Risk (fix before next deploy)
  ### [SCAN-001] Short title
  - File: path/to/file.js:line
  - What's wrong: [concrete description]
  - Evidence: [exact code or behavior that proves it]
  - Fix direction: [what to change — not a full implementation]

  ## P1 — Important (fix within 2 cycles)
  [same structure]

  ## P2 — Quality / Polish
  [same structure]

  ## P3 — Opportunities / Nice-to-Have
  [same structure]

  ## Test Coverage Gaps
  [untested handlers and utilities, one per line]

  ## Feature Matrix Drift
  [features where matrix status ≠ actual code state]

  ## Schema Issues
  [schema integrity findings, one per line]

Then update audits/issue-registry.json:
  - Add every P0 and P1 finding as a new issue (skip exact duplicates)
  - Add P2 and P3 findings with status "open"
  - Do not re-add issues already in the registry

Close with one line: "Scan complete. [N] new issues added to registry."
```
