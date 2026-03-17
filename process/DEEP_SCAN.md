# 🔬 Deep Codebase Scan

**Purpose:** Surgical read-only scan of the actual source code and content layer to
surface defects, silent failures, product principle violations, and improvement
opportunities not yet tracked in the registry.

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

  PRODUCT_PRINCIPLES.md          → the filter for every product and build decision
  process/BUILD_BIBLE.md         → coding patterns, what "correct" looks like here
  process/RELIABILITY_POLICY.md  → testing, error handling, verification contracts
  process/LESSONS_LEARNED.md     → known failure patterns already resolved
  audits/issue-registry.json     → already-tracked issues (deduplicate against these)
  ARCHITECTURE.md                → system boundaries, expected data flows
  CODEBASE_MAP.md                → file inventory and responsibilities

After reading, output two sentences:
  1. Current defect density trend (open vs resolved count in issue-registry.json)
  2. Which product principle has the most open violations currently

─────────────────────────────────────────────────
STEP 1 — VOCABULARY & BRAND SCAN
─────────────────────────────────────────────────

This is the highest-priority scan. Forbidden terms in user-facing output are P0.

Scan: frontend/js/app.js, frontend/index.html, workers/src/handlers/, and any
file that constructs AI prompts.

For each file, search for EVERY term in the left column of this table.
Each occurrence in user-visible text, AI prompts, or display strings is a violation.

  ❌ Forbidden            → ✅ Required
  ─────────────────────────────────────────────
  "Human Design"          → "Energy Blueprint"
  "Gene Keys"             → "Frequency Keys"
  "Siddhi"                → "Mastery"
  "Shadow"                → "Shadow Pattern"  (except in The Library context)
  "Bodygraph"             → "Energy Chart"
  "Incarnation Cross"     → "Life Purpose Vector" or "Soul Cross"
  "Generator"             → "Builder Pattern"
  "Manifesting Generator" → "Builder-Initiator Pattern"
  "Projector"             → "Guide Pattern"
  "Manifestor"            → "Catalyst Pattern"
  "Reflector"             → "Mirror Pattern"
  "Sacral Authority"      → "Life Force Response"
  "Splenic Authority"     → "Intuitive Knowing"
  "Ego Authority"         → "Willpower Alignment"
  "Heart Authority"       → "Willpower Alignment"
  "Self-Projected"        → "Voiced Truth"
  "Emotional Authority"   → "Emotional Wave Navigation"
  "Not-Self Theme"        → "Not-Self Signal"
  "Split Definition"      → "Bridging Pattern"

NOTE: Internal variable names, DB column names, and value="" attributes in
HTML forms are EXEMPT from this check — only visible text and prompt strings matter.

Report each violation as:
  - File: path/to/file.js:line
  - Forbidden term found: "..."
  - Context: [the surrounding sentence or label]
  - Severity: P0 if in any user-facing string or AI prompt; P1 if in a comment or dev-facing label

─────────────────────────────────────────────────
STEP 2 — AI OUTPUT FRAMING SCAN (Non-Negotiable 2)
─────────────────────────────────────────────────

The AI must never present interpretation as fact about a person's life.
Output must be framed as a lens ("your data shows a pattern consistent with X"),
never as a verdict ("you are X" or "you will X").

Scan all files that construct AI prompts or display AI output:
  workers/src/handlers/ (look for prompt construction)
  frontend/js/app.js (look for how AI response text is rendered)

Check for:
  [ ] Prompts that instruct the AI to state facts about the user's life or destiny
  [ ] Prompts that use "you are" framing without qualifying it as pattern-based
  [ ] UI copy that introduces AI output as a verdict ("Your reading reveals you are...")
      rather than a lens ("Your data shows a consistent pattern of...")
  [ ] Any synthesis output that substitutes for practitioner guidance on life decisions
      ("you should leave your job", "you are destined for leadership", etc.)
  [ ] Prompts that don't ground claims in specific chart data points
      (generic horoscope copy vs. "based on your Gate 33.6 / Gate 2.2...")
  [ ] AI Profile labeled or described in ways that imply prophecy rather than pattern

Each finding is P0 — framing synthesis as fact is a Non-Negotiable violation.

─────────────────────────────────────────────────
STEP 3 — CALCULATION INTEGRITY SCAN (Non-Negotiable 1)
─────────────────────────────────────────────────

The engine is sacred. No approximations, rounding, or shortcuts in the math layer.

Scan workers/src/ for the calculation engine (Layer 1–8 as described in BUILD_BIBLE.md).

  [ ] Any planetary position rounded or approximated for display speed
  [ ] Transit data served from cache beyond its stated validity window
  [ ] Design-side offset (-88 days) approximated rather than exact
  [ ] Gate/Line lookup tables not validated against the AP Test Vector
        (AP Test Vector: Guide, 6/2, Split Definition, Emotional Wave Navigation,
         Gate 33.6 / Gate 2.2 — August 5, 1979, Tampa FL)
  [ ] Any code path that displays a chart before all 8 layers are verified
  [ ] Any feature that bypasses the full calculation to return a "partial" result
  [ ] Engine functions that catch errors silently and return fallback/stub data
      instead of surfacing the failure to the caller

Each finding is P0 — the calculation is never compromised.

─────────────────────────────────────────────────
STEP 4 — SYNTHESIS QUALITY SCAN (Principle 2 + Principle 3)
─────────────────────────────────────────────────

Every data point shown to a user must answer: What is this? What does it mean
in my life? What should I do with it? Plain language before depth. Depth on demand.

Scan frontend/js/app.js and frontend/index.html for how chart data is rendered:

  SYNTHESIS GAPS (Principle 2)
  [ ] Chart fields rendered as bare labels with no explanation
      e.g. "Split Definition" as a heading with no description below it
  [ ] Gate/Line codes displayed without a plain-language meaning
      e.g. "Gate 64 / Gate 47" with no "here's what this means for you"
  [ ] Astrology placements shown without a "why it matters" sentence
  [ ] Channel names listed with no behavioral translation
  [ ] Any section that is a list of data points with no synthesis layer on top

  PLAIN LANGUAGE FAILURES (Principle 3)
  [ ] Technical jargon used as a heading before any plain-language explanation
      e.g. "Emotional Solar Plexus Authority" as a title above the description
  [ ] Tooltips that contain system vocabulary without a prior plain-language sentence
  [ ] Onboarding copy that assumes familiarity with Energy Blueprint, Frequency Keys,
      Numerology, or Astrology frameworks
  [ ] Any copy that would fail the dinner party test:
      "Would you say this to a smart friend who knows nothing about these systems?"

  THREE-LAYER ARCHITECTURE CHECK
  Each major chart section must have all three layers available (or planned):
  [ ] Quick Start: archetype name + plain-language behavior + practical implication
  [ ] Technical: system term + mechanism + cross-system connection
  [ ] Raw: full data, for practitioners and developers
  Note any section where one or more layers are missing.

─────────────────────────────────────────────────
STEP 5 — EARN THE NEXT STEP SCAN (Principle 4)
─────────────────────────────────────────────────

After every major milestone, the product must give the user a clear signal
of what happened and where to go next. Dead ends are retention failures.

Scan frontend/js/app.js for the completion state of each major flow:

  [ ] Chart calculated → is there an immediate, specific AI Profile CTA?
  [ ] AI Profile generated → is there an Enhance tab CTA surfaced?
  [ ] Subscriber upgrade completed → is new tier content highlighted immediately?
  [ ] Behavioral assessment saved → does the user see what changes next?
  [ ] Diary/check-in entry saved → is there a next-step or reflection surface?
  [ ] Practitioner adds a client → is there a clear "generate chart" next action?
  [ ] Practitioner generates synthesis → is there a "deliver to client" path visible?
  [ ] Invitation redeemed → does the new user land somewhere meaningful?

For each flow: does the completion state end with a blank screen or a forward direction?
Flag any flow that terminates without a CTA as a violation of Principle 4.

─────────────────────────────────────────────────
STEP 6 — PRACTITIONER TIER INTEGRITY SCAN (Non-Negotiable 3 + Principle 8)
─────────────────────────────────────────────────

Consumer features are bounded by personal discovery. Practitioner features
are defined by professional delivery. The gap is intentional and commercial.

Scan workers/src/lib/stripe.js (getTierConfig), workers/src/handlers/, and
frontend/js/app.js for tier-gating logic:

  [ ] Any practitioner-first feature (PDF export, composite charts, cluster synthesis,
      multi-client profiles, session notes, practitioner directory listing) that is
      accessible without a Practitioner tier check
  [ ] Consumer tier having access to flows that replicate what the Practitioner tier provides
      (e.g. a "practitioner mode" for free/individual users)
  [ ] Deferral CTA removed, hidden, or de-emphasized in the personal user journey
      (it must appear after AI Profile generation and connect to the practitioner directory)
  [ ] Practitioner directory not shown as the destination for the Deferral CTA
  [ ] Composite charts or multi-chart flows accessible at Individual tier or below
  [ ] Any feature that was recently moved from Practitioner to Individual/Free without
      a documented product decision (cross-check against MASTER_BACKLOG_SYSTEM_V2.md)

─────────────────────────────────────────────────
STEP 7 — ONE TRUTH, ONE SOURCE SCAN (Principle 6)
─────────────────────────────────────────────────

Every data point traces back to one canonical source. Parallel definitions are defects.

  TIER / PRICING DUPLICATION
  [ ] Tier names, price points, or quota limits defined anywhere other than
      workers/src/lib/stripe.js → getTierConfig()
      (hardcoded strings in handlers, frontend, or prompts = violation)

  VOCABULARY DUPLICATION
  [ ] Approved brand terms defined in multiple places instead of one canonical source
  [ ] AI prompts that define type names inline instead of referencing the knowledgebase

  DESIGN TOKEN DUPLICATION
  [ ] CSS custom properties (--color, --font, etc.) defined inline in index.html
      when a design token system exists elsewhere
  [ ] Any --gold, --primary, or brand color defined in more than one place

  CONTENT DUPLICATION
  [ ] Knowledge base content (gate meanings, type descriptions, channel interpretations)
      duplicated in prompt strings instead of referenced from src/knowledgebase/
  [ ] The same "how it works" explanation written differently in onboarding vs UI vs docs

─────────────────────────────────────────────────
STEP 8 — PROGRESSIVE DISCLOSURE SCAN (Principle 9)
─────────────────────────────────────────────────

The user should see one focal point, one immediate action, one clear reason to care.

Scan frontend/js/app.js and frontend/index.html:

  [ ] Any screen presenting three or more equally-prominent next actions simultaneously
  [ ] Navigation that exposes the full feature inventory instead of the active journey
  [ ] Chart screen that presents all systems, codes, and tools before the user has
      seen their Pattern and Decision Style in plain language
  [ ] Hero/landing section that leads with system count or feature list instead of
      the one reason a visitor would stay
  [ ] Mobile view (375px target) where multiple tabs or panels compete equally
  [ ] Any onboarding step that answers more than one question at a time

─────────────────────────────────────────────────
STEP 9 — ANTI-PATTERN SCAN
─────────────────────────────────────────────────

Five patterns have already hurt the product. Check for recurrence.

  Anti-Pattern 1 — The Feature Factory
  [ ] Recent additions to workers/src/ or frontend/js/app.js that have no corresponding
      user story in issue-registry.json or MASTER_BACKLOG_SYSTEM_V2.md
  [ ] Handlers that exist but are unreachable from the router (dead feature code)

  Anti-Pattern 2 — Copy Silos
  [ ] Frontend landing copy that describes the product differently from the pricing page
  [ ] Onboarding copy that uses different terms than in-app labels for the same concepts
  [ ] AI Profile section copy that contradicts the chart section copy for the same trait

  Anti-Pattern 3 — The False Upgrade
  [ ] Any pricing or marketing copy (frontend/index.html) advertising a feature that
      is not fully implemented in workers/src/handlers/
  [ ] Agency tier copy promising capabilities the code does not support
      (Agency checkout currently returns contactRequired: true — verify copy matches this)

  Anti-Pattern 4 — Deferred Clarity
  [ ] Features that render output but provide no explanation of what it means
  [ ] Completed flows that have no "why it matters" sentence visible to the user
  [ ] Items in issue-registry.json marked "resolved" where the resolution was
      technically functional but the UX explanation was never added

  Anti-Pattern 5 — Parallel Truths
  [ ] Multiple definitions of what constitutes a "Practitioner" or "Individual" user
      in different parts of the codebase
  [ ] Tier names spelled inconsistently across handlers, frontend, and email templates
  [ ] Design token values that differ between CSS and JS constants for the same concept

─────────────────────────────────────────────────
STEP 10 — TECHNICAL DEFECTS SCAN
─────────────────────────────────────────────────

Standard code quality and reliability checks.

  BACKEND (workers/src/)
  ── Errors & Defects ──
  [ ] Swallowed errors — catch blocks that log but return 200 or nothing
  [ ] Missing await — async calls without await that silently skip
  [ ] Unchecked nulls — values used after a DB/fetch call without a null guard
  [ ] Wrong HTTP status — errors returned as 200, success returned as 500
  [ ] Missing DB transaction — multiple writes that must be atomic but aren't
  [ ] Raw SQL — template literal strings instead of parameterized queries
  [ ] Hardcoded secrets — API keys or tokens in source (not in env/Worker secrets)
  [ ] Auth gap — routes that should require a valid JWT but don't call verifyToken
  [ ] Missing input validation on user-supplied strings
  [ ] Missing CORS or auth headers on sensitive endpoints

  ── Code Quality ──
  [ ] Dead code — exported functions with no callers in workers/src/index.js routing
  [ ] Duplicate logic — same transformation written in two or more handlers
  [ ] TODO / FIXME / HACK / XXX comments
  [ ] console.log in production code (must use workers/src/lib/logger.js)
  [ ] Magic numbers — hardcoded tier IDs, Stripe price IDs, quota limits
  [ ] Missing rate limiting on AI calls, chart generation, email send endpoints
  [ ] Response envelope inconsistency — some handlers return {data:...}, others flat

  ── Reliability ──
  [ ] No retry logic on Neon DB calls (cold-start timeouts)
  [ ] KV reads with no fallback when key is missing or expired
  [ ] R2 read/write with no error handling
  [ ] Resend / Telnyx calls not wrapped in try/catch
  [ ] Cron handlers with no structured log on entry and exit

  FRONTEND (frontend/js/app.js)
  [ ] fetch() calls with no .catch() or error branch
  [ ] Token read from localStorage (must be module-level `let token = null` only)
  [ ] Loading state that can get stuck — no timeout or cancel path
  [ ] DOM writes without null check before .innerHTML or .textContent
  [ ] Event listeners registered inside functions called repeatedly
  [ ] Form submit without e.preventDefault() before async work
  [ ] Hardcoded API URL ≠ https://prime-self-api.adrper79.workers.dev
  [ ] Error messages exposing raw JSON, stack traces, or internal IDs to the user
  [ ] Missing analytics events on: registration, chart generation, upgrade click,
      practitioner add-client, session note saved, invitation redeemed

─────────────────────────────────────────────────
STEP 11 — TEST COVERAGE SCAN (tests/)
─────────────────────────────────────────────────

Read all test files in tests/ — exclude tests/e2e/.

  [ ] Every handler in workers/src/handlers/ with ZERO test coverage
  [ ] Every utility in workers/src/lib/ with ZERO test coverage
  [ ] Tests that cover only the happy path (no error or edge case assertions)
  [ ] Tests that mock the Neon DB connection (violates RELIABILITY_POLICY.md)
  [ ] Test files importing from paths that no longer exist

─────────────────────────────────────────────────
STEP 12 — FEATURE COMPLETENESS SCAN
─────────────────────────────────────────────────

Cross-reference FEATURE_MATRIX.md against the actual codebase.

  For each feature marked "complete":
  [ ] Route handler exists in workers/src/?
  [ ] UI section exists in frontend/js/app.js?
  [ ] At least one test covers the happy path?
  [ ] Wired into the router in workers/src/index.js?
  [ ] Passes the Four-Question Fitness Test (PRODUCT_PRINCIPLES.md §4)?
      Q1: Which journey and gate does it advance?
      Q2: What is the measurable signal that it worked?
      Q3: Is the implementation the simplest version that delivers the value?
      Q4: Does it violate any Non-Negotiable?
      Q5: Is the "why it matters" sentence visible to the user?

  For each feature marked "partial" or "not started":
  [ ] Is there more code than the matrix shows? (matrix may be stale)
  [ ] Is there a hard blocking dependency? (document it)

─────────────────────────────────────────────────
STEP 13 — SCHEMA INTEGRITY SCAN
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
  - Product principles most violated: [top 3 by finding count]

  ## P0 — Non-Negotiable Violations & Production Risk (fix before next deploy)
  ### [SCAN-001] Short title
  - Principle/Rule violated: [e.g. Non-Negotiable 2 / Vocabulary / Auth Gap]
  - File: path/to/file.js:line
  - What's wrong: [concrete description]
  - Evidence: [exact code, string, or behavior that proves it]
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

  ## Fitness Test Failures
  [features that exist in code but cannot answer Q1-Q5 from PRODUCT_PRINCIPLES.md §4]

Then update audits/issue-registry.json:
  - Add every P0 and P1 finding as a new issue (skip exact duplicates)
  - Add P2 and P3 findings with status "open"
  - Tag each new issue with the principle it violates
    (e.g. "area": "vocabulary", "principle": "P6-OneTruth")

Close with one line: "Scan complete. [N] new issues added to registry."
```
