---
name: "Prime Self — Final Checkout (Multi-Pass)"
description: "Run a structured multi-pass final checkout of the Prime Self codebase. Evaluates security, code quality, DB schema, performance, compliance, architecture, new code, and C-suite business risk. Syncs blockers into the issue registry. Use when: final checkout, pre-launch review, code audit, improvement pass, C-suite review, design standards check, best practices audit."
argument-hint: "Optional: limit to one pass (e.g. 'security', 'db-schema', 'performance', 'c-suite') or 'all' for full checkout"
agent: "agent"
---

You are the Prime Self final-checkout agent.

You will run a structured, evidence-based multi-pass audit of the Prime Self codebase. Each pass
has a technical lens AND a C-suite translation. At the end you produce a single verdict and sync
any new blockers into both tracking systems.

User scope override (leave blank for all passes):

${input}

---

## PRIME SELF CONTEXT

Product: **Prime Self** (`selfprime.net`) — practitioner-first B2B2C SaaS.
Stack: Cloudflare Workers · Neon PostgreSQL · Stripe · Discord Worker · Capacitor (PWA/mobile)
Tiers: Free → Individual ($19/mo) → Practitioner ($97/mo) → Agency ($349/mo)
Current verdict: CONDITIONAL GO (7.6/10) from `docs/WORLD_CLASS_ASSESSMENT_2026-03-21.md`

**Do not re-derive known context from scratch** — build on what is already documented.

---

## REQUIRED BOOTSTRAP READS

Read these before any pass:

1. `PRODUCT_PRINCIPLES.md` — product truth filter
2. `audits/issue-registry.json` — canonical open issues (check `openCount` and existing IDs)
3. `MASTER_BACKLOG_SYSTEM_V2.md` — current work priority, Quick Summary open count
4. `docs/WORLD_CLASS_ASSESSMENT_2026-03-21.md` — last composite score and C-suite verdicts
5. `workers/wrangler.toml` — all env vars and bindings deployed to production
6. `discord/wrangler.toml` — Discord Worker config

---

## PASS DEFINITIONS

Run the passes in order unless the user has scoped to a specific pass.
For each pass, read the listed files, grep the listed patterns, evaluate the criteria,
output a findings table, then write a C-suite translation block.

---

### PASS 1 — SECURITY (OWASP Top 10 + Secrets)

**Primary readers:** CISO, CEO
**Files to read:**
- `workers/src/middleware/auth.js` or `workers/src/lib/jwt.js`
- `workers/src/handlers/auth.js`
- `workers/src/handlers/billing.js`
- `workers/src/handlers/stripe-webhook.js`
- `workers/src/lib/tokenCrypto.js`
- `discord/src/index.js`
- `workers/wrangler.toml`
- `.github/workflows/` (any CI files)

**Grep checks to run:**
```
# Hardcoded credentials or tokens in tracked files
grep -r "sk_live\|pk_live\|whsec_\|npg_\|Bearer " workers/src/ frontend/js/ discord/src/ --include="*.js" --include="*.ts"

# SQL without parameterization
grep -r "SELECT\|INSERT\|UPDATE\|DELETE" workers/src/db/ --include="*.js" | grep -v "\$[0-9]\|db\." | grep "'"

# Sensitive fields returned to client
grep -r "totp_secret\|password_hash\|refresh_token" workers/src/handlers/ --include="*.js"

# console.log with sensitive context
grep -rn "console\.log\|console\.warn\|console\.error" workers/src/handlers/ --include="*.js" | grep -i "email\|token\|password\|secret\|key"

# CSRF exposure: state-changing GET requests
grep -rn "router\.get\|app\.get" workers/src/ --include="*.js" | grep -i "delete\|remove\|cancel\|update\|create"

# Missing webhook HMAC validation
grep -rn "stripe-webhook\|webhook" workers/src/handlers/ --include="*.js" | grep -v "hmac\|signature\|verify"

# Password reset token in URL (Referer leak)
grep -rn "reset.*token\|token.*reset" workers/src/handlers/ --include="*.js" | grep "params\|query\|url"
```

**Evaluate for:**
- [ ] OWASP A01 Broken Access Control — tier enforcement, practitioner isolation, admin-only gates
- [ ] OWASP A02 Cryptographic Failures — JWT alg, token storage, password hashing, TOTP secret exposure
- [ ] OWASP A03 Injection — SQL parameterization, no string interpolation into queries
- [ ] OWASP A05 Security Misconfiguration — CSP headers, HSTS, X-Frame-Options, SRI on CDN scripts
- [ ] OWASP A07 Auth Failures — refresh token rotation, family revocation, session fixation
- [ ] OWASP A08 Integrity Failures — webhook HMAC, Stripe signature, Discord Ed25519 verification
- [ ] OWASP A10 SSRF — any `fetch(userInput)` or dynamic URL construction from user data
- [ ] Discord rate limiting — KV namespace wired, enforced before AI call
- [ ] Secrets in tracked files — none should appear in any .js or .toml
- [ ] `npm audit` result — note any high/critical CVEs in package.json dependencies

**Output format:**
| Finding | Severity | File:Line | OWASP ID | Fix |
|---------|----------|-----------|----------|-----|

**C-Suite Translation (CISO + CEO):**
- What is the blast radius if each unfixed item is exploited?
- Which items create customer data liability (GDPR, PCI-DSS)?
- Are there any items that would pause a due-diligence review from a Series A investor?

---

### PASS 2 — CODE QUALITY & DESIGN STANDARDS

**Primary readers:** CTO, VP Engineering
**Files to read:**
- `workers/src/index.js` (router, middleware chain)
- `workers/src/handlers/auth.js` (~1100 lines — flag structural issues)
- `frontend/js/app.js` (~7500 lines — the known monolith)
- `frontend/js/controllers/` (all 7 controllers)
- `workers/src/lib/routeErrors.js`
- `workers/src/lib/logger.js`

**Design standards to enforce:**
1. **Error handling**: every route must use `routeErrors.js` pattern — no bare `catch(e) { return Response.json({error: e.message}) }`
2. **Request ID**: every error response should include `requestId`
3. **Logger vs console**: `workers/src/lib/logger.js` must be used; raw `console.log` is a violation
4. **Return await**: in async route dispatchers, handlers must be `return await fn()`, not `return fn()`
5. **Parameterized queries**: all SQL must use `$1, $2` placeholders — never string concatenation
6. **42P01 resilience**: queries against new/optional tables must have phantom-table guard pattern (`catch err.code === '42P01'`)
7. **JSONB serialization guard**: any handler returning JSONB columns must do JSON.stringify/parse round-trip
8. **Frontend architecture**: new logic in `app.js` must be extracted to an appropriate controller or module — `app.js` must not grow
9. **CSS tokens**: only `frontend/css/tokens.css` is canonical — no magic values in component CSS
10. **Naming conventions**: Energy Blueprint terminology throughout UI — no residual "Human Design", "BodyGraph", "Gene Keys", "Siddhi" in user-facing copy

**Grep checks:**
```
# Raw console.log in worker handlers
grep -rn "console\." workers/src/handlers/ --include="*.js"

# Bare catch returning error.message
grep -rn "return Response.json.*error.*message\|return new Response.*error.*message" workers/src/handlers/ --include="*.js" | grep -v "routeErrors"

# Missing return await in async dispatch
grep -rn "return handler\.\|return dispatch\." workers/src/ --include="*.js" | grep "async"

# Residual Human Design terminology in UI copy
grep -rn "Human Design\|BodyGraph\|Gene Keys\|Siddhi\|bodygraph" frontend/ --include="*.html" --include="*.js" | grep -v "// internal\|/* internal"

# Magic CSS values (not var(--)
grep -rn "#[0-9a-fA-F]\{3,6\}\|rgba\?\(" frontend/css/components/ --include="*.css" | grep -v "tokens.css\|/* ok"
```

**Evaluate for:**
- [ ] All route handlers follow routeErrors pattern
- [ ] No raw `console.log` in production worker handlers
- [ ] `app.js` grew or shrank since last audit — flag any additions
- [ ] New discord code follows same error-handling standards
- [ ] Controller extraction is progressing (7 controllers exist — are more needed?)
- [ ] Dead code, unreachable branches, or TODO/FIXME flags in shipped code

**Output format:**
| Finding | Category | File:Line | Standard Violated | Effort | Priority |
|---------|----------|-----------|------------------|--------|----------|

**C-Suite Translation (CTO):**
- Weighted debt score: low/medium/high (relative to last audit)
- Is technical debt growing or shrinking?
- Top 3 debt items that block velocity
- Estimated engineering hours to pay down critical items

---

### PASS 3 — DATABASE SCHEMA & DATA MODEL

**Primary readers:** CTO, CFO
**Files to read:**
- All 66 migration files in `workers/src/db/migrations/` — scan for schema patterns
- `workers/src/db/` — any query files, schema.js
- `workers/src/handlers/billing.js` — subscription state machine
- `workers/src/handlers/agency.js` — agency seat management
- `workers/src/handlers/practitioner.js`, `practitioner-profile.js`

**Evaluate for:**
- [ ] Migration gaps — are there gaps in the numeric sequence? (e.g. 001, 002 missing — could indicate removed migrations)
- [ ] Foreign key consistency — do all reference columns have ON DELETE CASCADE or ON DELETE SET NULL?
- [ ] INDEX coverage — do all foreign keys have indexes? Are there query patterns without indexes?
- [ ] UUID vs serial — check for inconsistent primary key types across tables (migration 017 standardized these)
- [ ] Subscription state machine completeness — `normalize_tier_and_status` migration ran? No orphaned subscription states?
- [ ] GDPR columns — `044_gdpr_consent_fields.sql` ran? consent fields present on users table?
- [ ] Soft delete vs hard delete — does `064_cascade_user_delete.sql` cover all user-owned tables?
- [ ] Phantom tables — list any tables referenced in handlers that do NOT have a corresponding migration
- [ ] New Discord migrations — `023_discord_integration.sql` — does the Discord integration handler query against this table?
- [ ] Gift tokens UUID fix — `065_fix_gift_tokens_uuid.sql` and `066_fix_practitioner_messages_uuid_pk.sql` — handlers updated to match?

**Grep checks:**
```
# Tables referenced in handlers but not in migrations
grep -rn "\.query\|db\." workers/src/handlers/ --include="*.js" | grep "FROM\|INTO\|UPDATE\|JOIN" | grep -oP "(?<=FROM |INTO |UPDATE |JOIN )\w+" | sort | uniq

# Unguarded phantom table queries (missing 42P01 catch)
grep -rn "daily_checkins\|user_achievement_stats\|agency_seats" workers/src/handlers/ --include="*.js" | grep -v "42P01\|catch"
```

**Output format:**
| Table/Migration | Finding | Risk | Fix |
|-----------------|---------|------|-----|

**C-Suite Translation (CTO + CFO):**
- Data integrity risk: what business process breaks if the identified schema gaps are hit?
- GDPR gap = legal/regulatory exposure (quantify)
- Missing indexes = cost (DB query time = Neon compute credits = $)
- Subscription state drift = revenue leakage (uncollected or double-billed)

---

### PASS 4 — PERFORMANCE & SCALABILITY

**Primary readers:** CTO, COO
**Files to read:**
- `workers/src/handlers/calculate.js` — the heaviest computation path
- `workers/src/handlers/profile.js` — likely triggers multiple DB queries
- `workers/src/lib/cache.js` — KV caching layer
- `workers/src/lib/llm.js` — LLM call patterns
- `workers/src/lib/circuitBreaker.js` — degradation paths
- `frontend/js/app.js` — bundle size and lazy loading

**Evaluate for:**
- [ ] N+1 queries — any loop that issues one DB query per item (use `WHERE id = ANY($1)` instead)
- [ ] LLM calls inside request path with no timeout guard
- [ ] Missing KV cache for expensive repeated reads (e.g. public chart lookups, famous charts)
- [ ] R2 usage for large blobs — are PDFs and share images going to R2 or inline in response?
- [ ] Durable Objects for live sessions — is the DO handler invoked correctly or is it bypassed for solo sessions?
- [ ] `app.js` dynamic import usage — are heavy modules (bodygraph, synthesis) lazy-loaded?
- [ ] Service worker — does `frontend/service-worker.js` cache static assets correctly?
- [ ] Bundle size — any single import that pulls in a large dep not needed at load time?

**Grep checks:**
```
# Potential N+1: query inside a loop
grep -rn "for\|forEach\|map\|while" workers/src/handlers/ --include="*.js" -A2 | grep "\.query\|db\."

# LLM calls without timeout
grep -rn "llm\.\|generateText\|streamText\|fetch.*anthropic\|fetch.*groq" workers/src/ --include="*.js" | grep -v "timeout\|AbortSignal"

# Dynamic imports in frontend
grep -rn "import(" frontend/js/ --include="*.js"

# Large static imports (potential bundle bloat)
grep -rn "^import " frontend/js/app.js | head -30
```

**Output format:**
| Finding | Impact (ms/req or $/mo) | File:Line | Fix |
|---------|------------------------|-----------|-----|

**C-Suite Translation (CTO + COO):**
- What is the cost at 1K, 10K, 100K users for each unresolved performance issue?
- Are there any paths where a single slow query = SLA breach?
- LLM quota risk — what happens if Anthropic rate-limits us at scale?

---

### PASS 5 — COMPLIANCE (WCAG · GDPR · PCI-DSS)

**Primary readers:** CISO, COO, CMO
**Files to read:**
- `frontend/index.html` — meta tags, ARIA roles, landmark coverage
- `frontend/pricing.html` — payment-adjacent surface
- `frontend/css/tokens.css` — color contrast
- `workers/src/handlers/billing.js`, `stripe-webhook.js`
- `workers/src/lib/email.js`
- `workers/src/db/migrations/044_gdpr_consent_fields.sql`
- `workers/src/db/migrations/039_account_deletions_audit.sql`

**Evaluate for:**
- [ ] **WCAG 2.2 AA**: color contrast ≥4.5:1 for text, focus indicators present, ARIA roles on modals/tabs, skip link to main content, alt text on all images
- [ ] **GDPR**: explicit consent capture before analytics, right-to-deletion path (`account_deletions_audit` table), data minimization (no unnecessary PII in logs), privacy policy link in footer
- [ ] **PCI-DSS**: no payment card data touches the application server (Stripe.js handles card), webhook signature validated, audit log of billing events, no raw card numbers in logs
- [ ] **COPPA**: no user age collected; if age-gate needed, is it present?
- [ ] **CAN-SPAM / CASL**: unsubscribe link in all marketing emails, `031_email_marketing_optout.sql` migration applied
- [ ] **Apple App Store / Google Play**: if Capacitor mobile is shipped, store-compliance review needed
- [ ] **GDPR data processing agreement**: Stripe, Anthropic, Telnyx, Resend, Sentry — are DPAs documented?

**Output format:**
| Compliance Area | Finding | Standard | Severity | Fix |
|----------------|---------|----------|----------|-----|

**C-Suite Translation (CISO + CMO):**
- Which gaps require a legal/compliance review before public launch?
- GDPR non-compliance risk: EU users = fines up to 4% of annual revenue
- WCAG failures = lawsuits in US (ADA Title III precedent), lost users with disabilities
- PCI-DSS scope: are we in scope? What's our SAQ level?

---

### PASS 6 — ARCHITECTURE & BEST PRACTICES

**Primary readers:** CTO, VP Engineering
**Files to read:**
- `workers/src/index.js` — router, middleware chain, request lifecycle
- `workers/src/middleware/` — all middleware files
- `workers/src/durable-objects/` — DO architecture
- `ARCHITECTURE.md` — stated architecture vs reality
- `workers/src/lib/webhookDispatcher.js` — event dispatch pattern
- `workers/src/lib/circuitBreaker.js` — resilience pattern
- `workers/src/cron.js` — scheduled jobs

**Evaluate for:**
- [ ] **Middleware order** — auth → rate-limit → tier-enforce → handler. Is this order correct and consistent?
- [ ] **Route namespace conflicts** — no two routes resolve to the same path with different HTTP methods without explicit handling
- [ ] **Fan-out on webhook** — Stripe webhook fan-out is idempotent (each event type processed once, retried safely)
- [ ] **Circuit breaker coverage** — is the circuit breaker applied to all external calls (Anthropic, Telnyx, Resend, Stripe, Neon)?
- [ ] **Cron job resilience** — scheduled jobs have try/catch and emit metrics on failure
- [ ] **Durable Object concurrency** — live session DO uses proper `this.state.blockConcurrencyWhile()` pattern
- [ ] **Return type consistency** — all routes return `Response` objects (not plain objects that Cloudflare might mishandle)
- [ ] **API versioning** — are there `/v1/` or `/v2/` conventions? If not, is breaking change strategy documented?
- [ ] **Dependency injection** — are DB, logger, and config injected into handlers or pulled from global scope? (worker env == acceptable pattern)
- [ ] **Rate limiting completeness** — KV-based rate limiting applied to all high-cost endpoints (LLM calls, chart generation, PDF export)

**Output format:**
| Pattern | Current State | Best Practice | Gap | Priority |
|---------|--------------|---------------|-----|----------|

**C-Suite Translation (CTO):**
- Architecture grade: has it improved or regressed since the last assessment?
- Top 3 architectural risks that would require a rewrite at scale
- Which gaps block the ability to onboard a second engineer without a 2-week ramp?

---

### PASS 7 — NEW CODE REVIEW (Discord Worker + GTM Changes)

**Primary readers:** CMO, CPO, CTO
**Files to read:**
- `discord/src/index.js` — full file
- `discord/wrangler.toml` — bindings, env vars, KV namespace
- `workers/wrangler.toml` — STRIPE_TRIAL_DAYS and new env vars
- `docs/GTM_PLAN_2026-03-21.md` — decisions resolved, channel strategy
- `audits/issue-registry.json` — GTM-001 through GTM-009 entries

**Evaluate for (Discord Worker):**
- [ ] Ed25519 signature verification is the FIRST check — no processing before `verifyKey()`
- [ ] Rate limit check uses the wired KV namespace (`DISCORD_RATE_LIMIT`) and correct binding name in code
- [ ] All user-facing strings use `selfprime.net` domain (no residual `primeselfengine.com`)
- [ ] Error paths return valid Discord interaction responses (not raw CF error pages)
- [ ] The `/primself` command response is deferred (interaction ACK) before calling the API, to avoid Discord's 3-second timeout
- [ ] API secret (`PRIME_SELF_API_SECRET`) is validated on the worker-to-worker call, never logged
- [ ] Rate limit ceiling is 5/day (raised from 3) and enforced per user ID (not per guild)
- [ ] Embed construction handles null/undefined chart fields without crashing

**Evaluate for (GTM + Stripe trial):**
- [ ] `STRIPE_TRIAL_DAYS = "14"` is present in deployed `workers/wrangler.toml`
- [ ] The billing handler reads `STRIPE_TRIAL_DAYS` and passes it to Stripe checkout session creation
- [ ] Trial-to-paid conversion is tracked (event fired to analytics on trial start, on trial end, on convert)
- [ ] GTM plan decisions (7) are all reflected in code or docs — no orphaned OPEN decisions remain
- [ ] Discord/Reddit channel strategy replaces Facebook/Instagram everywhere in code and docs

**Output format:**
| File | Finding | Category | Severity | Fix |
|------|---------|----------|----------|-----|

**C-Suite Translation (CMO + CPO):**
- Is the Discord Worker ready for public community use?
- Does the GTM plan have complete implementation coverage (decisions → code)?
- Is the 14-day trial properly wired end-to-end (Stripe → analytics → conversion tracking)?

---

### PASS 8 — UI / UX AUDIT

**Primary readers:** CPO, CMO, CTO
**Files to read:**
- `frontend/index.html` — full structure: semantic HTML, landmark regions, ARIA, form patterns
- `frontend/pricing.html` — conversion-critical page structure
- `frontend/js/app.js` — state management, view transitions, error display to user
- `frontend/js/ui-nav.js` — navigation UX
- `frontend/js/state.js` — shared state model
- `frontend/js/core.js` — core UX helpers
- `frontend/css/tokens.css` — design system tokens (colors, spacing, type scale)
- `frontend/css/base.css` — base resets and global styles
- `frontend/css/components/buttons.css` — button system
- `frontend/css/components/mobile.css` — responsive overrides
- `frontend/css/share-card.css` — share surface
- `frontend/js/controllers/billing-controller.js` — billing UX flow
- `frontend/js/controllers/practitioner-management.js` — practitioner dashboard UX
- `frontend/js/first-run.js` — onboarding UX
- `frontend/js/bodygraph.js` — chart rendering UX

**Grep checks to run:**
```
# Missing alt text on images
grep -rn "<img" frontend/ --include="*.html" | grep -v "alt="

# Inline styles (should use tokens)
grep -rn "style=" frontend/ --include="*.html" | grep -v "<!-- ok\|display:none\|visibility"

# Hard-coded colors not using CSS vars
grep -rn "color:\|background:" frontend/css/components/ --include="*.css" | grep -v "var(--\|inherit\|transparent\|currentColor"

# Empty error states: catch blocks with no user-facing message
grep -rn "catch\|\.catch" frontend/js/ --include="*.js" | grep -v "console\|showError\|notify\|toast\|message\|alert"

# Loading states: async calls without spinner/skeleton
grep -rn "await fetch\|apiFetch" frontend/js/ --include="*.js" | grep -v "setLoading\|spinner\|skeleton\|loadingState\|isLoading"

# Focus traps in modals
grep -rn "modal\|dialog\|overlay" frontend/js/ --include="*.js" | grep -v "focusTrap\|focus\|trapFocus\|addEventListener.*keydown"

# Buttons without accessible labels
grep -rn "<button" frontend/ --include="*.html" | grep -v "aria-label\|aria-labelledby\|>[^<]"

# Viewport meta (critical for mobile)
grep -rn "viewport" frontend/ --include="*.html"
```

**Evaluate for:**

**Visual Design System**
- [ ] Single source of truth for tokens — only `tokens.css` defines colors, spacing, type scale; no magic values in components
- [ ] Type scale is harmonious (no arbitrary font-size values outside the scale)
- [ ] Spacing follows an 8px grid or defined scale
- [ ] Brand consistency — gold/dark premium palette used consistently; no off-brand grays or greens leaking in
- [ ] Button hierarchy — primary / secondary / tertiary / destructive are visually distinct, use token variables
- [ ] Icon system — consistent icon library; no mixed icon styles (Heroicons + FontAwesome + inline SVG)

**Interaction & Motion**
- [ ] Loading states — every async action has a skeleton/spinner; no "blank flash" while fetching
- [ ] Error states — every form field has inline error messaging; API errors surface human-readable copy, not JSON blobs
- [ ] Empty states — charts, client lists, diary, transit views all have designed empty states (not blank space)
- [ ] Success feedback — actions (save, purchase, schedule) confirm completion with toast/notification
- [ ] Destructive actions — delete/cancel flows have a confirmation step
- [ ] Optimistic UI — does any state update optimistically (before server confirm), and is rollback handled?

**Navigation & Information Architecture**
- [ ] Primary nav is consistent across all pages/views
- [ ] Mobile navigation — hamburger or bottom bar pattern used correctly for <768px
- [ ] Breadcrumbs or back-navigation available on nested views (client detail, session notes)
- [ ] Active state clearly indicated on nav items
- [ ] Tab order is logical — keyboard navigation follows visual flow
- [ ] No orphaned pages — every view is reachable from navigation

**Forms & Data Entry**
- [ ] All form inputs have visible labels (not placeholder-only)
- [ ] Birth date/time entry (core UX) — is the date picker accessible and mobile-friendly?
- [ ] Timezone detection — does the UI detect or prompt for timezone on birth data entry?
- [ ] Field validation — inline validation fires on blur, not only on submit
- [ ] Required field indicators present (`*` or aria-required)
- [ ] Form submission disabled while in-flight (no double-submit)

**Mobile / Responsive UX**
- [ ] Viewport meta tag `width=device-width, initial-scale=1` present
- [ ] Touch targets ≥44×44px (WCAG 2.5.5)
- [ ] No horizontal scroll on any view at 375px width
- [ ] Practitioner dashboard usable on tablet (768px)
- [ ] Bodygraph/Energy Chart renders correctly at mobile width
- [ ] Share card optimized for mobile preview (OG dimensions)

**Practitioner-Specific UX**
- [ ] Client list is scannable — avatar, name, last session, tier visible at a glance
- [ ] Session notes editor has autosave or explicit save indicator
- [ ] PDF export preview before download
- [ ] Scheduling embed is embeddable without auth (public-safe iframe)
- [ ] Practitioner directory card shows the right trust signals (cert badges, reading count, specialties)
- [ ] Onboarding for new practitioner has a clear "next step" at each gate

**First-Run / Onboarding UX**
- [ ] New user lands on a clear call-to-action (not inside the app immediately)
- [ ] Birth data entry is the first meaningful action — friction is minimal
- [ ] Chart generation is near-instant with a delightful loading state
- [ ] First synthesis paragraph creates a "that's me" moment within 10 seconds of reading
- [ ] Upgrade prompt appears at the natural value moment (not before it)
- [ ] Practitioner invite flow is distinct from self-signup (no confusion about account type)

**Output format:**
| Finding | Category | Severity | File | Fix | Effort |
|---------|----------|----------|------|-----|--------|
*(Use: Critical = breaks user flow | High = significant friction | Medium = polish gap | Low = minor)*

**C-Suite Translation (CPO + CMO):**
- What is the conversion impact of the top 3 UX gaps? (Quantify as "% of users likely to drop")
- Are any gaps directly preventing practitioner activation?
- What is the impression a new visitor gets in the first 10 seconds?
- Which UX improvements have the highest ROI (fix in <1 day, high conversion impact)?

---

### PASS 9 — C-SUITE EXECUTIVE SYNTHESIS

After completing all other passes, produce the executive synthesis.

**Do not repeat finding details** — reference Pass numbers instead.

#### CEO Perspective
- **3-sentence product thesis:** Does the current build validate the product thesis?
- **Top 3 risks** that could kill the company (legal, technical, competitive)
- **Top 3 opportunities** to accelerate growth in the next 30 days
- **Soft launch verdict:** GO / CONDITIONAL GO / NO-GO with one-sentence rationale

#### CFO Perspective
- **Burn rate impact:** What is the monthly cost forecast at current scale? At 10× users?
- **Revenue leakage:** Any billing, trial, or quota enforcement gaps that lose money?
- **Unit economics:** MRR potential vs operating cost at target practitioner count
- **Financial risk items** from audit passes that have a dollar value attached

#### CTO Perspective
- **Architecture debt trajectory:** Is the codebase getting better or worse per sprint?
- **Top 3 items** that block the second engineer from being productive in week 1
- **CI/CD gap:** What is the cost of the current manual deploy process (time, risk)?
- **Time to world-class engineering:** Revised estimate based on this audit

#### CMO Perspective
- **GTM coverage:** Are all 7 resolved GTM decisions reflected in shipped code?
- **Conversion funnel:** Where are the biggest drop-off risks in the current UX?
- **Community readiness:** Is Discord bot launch-ready for public community use?
- **Top 3 marketing levers** available in the current build

#### CPO Perspective
- **Feature completeness vs launch bar:** What is ships vs nice-to-have at soft launch?
- **Practitioner activation friction:** Top 3 barriers in the practitioner onboarding flow
- **Product differentiation:** Is the AI synthesis actually differentiated in UX?
- **Missing instrumentation:** What user behavior are we flying blind on?

#### CISO / COO Perspective
- **Security posture score:** 1-10 vs last assessment (8.5 from World-Class report)
- **Compliance gaps:** Which items require action before EU customers can pay?
- **Incident response readiness:** Can we detect, contain, and communicate a breach?
- **Operational maturity:** How many manual steps per deployment, and what is the failure blast radius?

#### Overall Verdict

Format as:

```
VERDICT: [WORLD CLASS | LAUNCH READY | CONDITIONAL GO | NOT READY]
COMPOSITE SCORE: X.X / 10 (delta from 7.6 baseline)
BLOCKER COUNT: P0=X  P1=X  P2=X
ESTIMATED TIME TO LAUNCH READY: X days / weeks
```

---

## SYNC PROCEDURE

After all passes are complete:

### 1. New Issues to Registry

For any finding that is:
- Not already tracked in `audits/issue-registry.json`, AND
- Severity P0, P1, or P2

Create a new registry entry using the next available ID in the relevant series (e.g., `SEC-XXX`, `PERF-XXX`, `COMP-XXX`) with fields:
- `id`, `persona`, `severity`, `area`, `title`, `status: "open"`, `firstSeen`, `lastSeen`, `file[]`, `fix[]`, `requirements[]`, `acceptanceCriteria[]`

Then update `openCount` and `lastAuditDate`.

### 2. Backlog Sync

Add new P0/P1 items to `MASTER_BACKLOG_SYSTEM_V2.md` in the appropriate section with:
- Status: `❌ Not Started` or `🔄 In Progress`
- Effort estimate
- Source link to this audit

### 3. Resolved Items

If any previously-open issue is now resolved, update both `issue-registry.json` and `MASTER_BACKLOG_SYSTEM_V2.md` with `resolvedAt` and `resolutionNote`.

---

## QUALITY BAR FOR THIS PROMPT

A complete checkout pass is only valid if:

1. Every pass has a populated findings table (even if the table says "No findings — PASS ✅")
2. Every pass has a C-suite translation block
3. The executive synthesis (Pass 8) covers all 6 C-suite roles
4. The issue registry is updated before the session ends
5. The verdict statement is explicit and unambiguous

Do not produce aspirational language. Every claim must be backed by file evidence or grep output.
Do not mark a pass as clean unless you have actually read the relevant files.
