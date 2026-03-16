# Full Audit — 2026-03-15

> Generated against the current `main` workspace on 2026-03-15.
> Delta baseline: `audits/FULL_AUDIT_2026-03-15-v2.md`.
> Delta methodology: prior unresolved items with status `open`, `new`, or `regression` were treated as carry-forward issues for comparison.

## Delta Summary

```json
{
  "previousAudit": "audits/FULL_AUDIT_2026-03-15-v2.md",
  "new": 2,
  "resolved": 14,
  "regressions": 7
}
```

## Test Results

```json
{
  "command": "npm test",
  "total": 361,
  "passed": 356,
  "failed": 0,
  "skipped": 5,
  "failures": []
}
```

Notes:
- The current `npm test` path is healthy again. Vitest discovered and executed the suite successfully.
- Test stderr still contains expected negative-path logging for error-pipeline and rate-limit scenarios, but no failing assertions were produced.
- This is a material improvement over the prior audit, which reported a broken runner state.

## Code Quality Findings

1. `workers/src/middleware/rateLimit.js` now uses a DB-backed atomic fixed-window counter instead of KV read/check/write, but the middleware still logs plain text on critical storage misconfiguration instead of going through the structured request logger.
2. `workers/src/middleware/tierEnforcement.js:136-148` fails open when the `email_verified` lookup errors. That protects old deployments from migration drift, but it also weakens the email-verification gate for paid AI actions.
3. `workers/src/middleware/tierEnforcement.js` now uses the same DB-backed atomic counter for daily ceilings, which closes the prior concurrency leak, but `console.error` / `console.warn` logging remains unstructured.
4. `workers/src/handlers/billing.js:71-117` validates `tier`, URLs, and promo format, but the main subscription checkout path still leaves malformed JSON to the generic 500 path.
5. `workers/src/handlers/billing.js:220-276` now reuses open one-time checkout sessions and rejects malformed JSON with 400, but the reuse strategy is still Stripe-list based and therefore remains TOCTOU under parallel requests.
6. `workers/src/handlers/webhook.js:78-122` now claims Stripe events atomically, releases the claim on downstream failure, and finalizes the claimed row in place instead of trying to insert a duplicate payment-event record.
7. `workers/src/handlers/webhook.js` now repairs missing Stripe customer mappings by exact email fallback before rebuilding local subscription state for invoice and ghost-subscription events, and unrecoverable billing events are finalized into a durable `manual_review` state instead of being left as opaque processing rows.
8. `workers/src/handlers/auth.js:544-598` and `workers/src/handlers/auth.js:607-663` show stronger auth hardening than the historical docs: forgot-password now returns constant success, and invalid reset-token DB failures return 400 instead of 500.
9. `workers/src/lib/cache.js:177-214` still swallows cache read/write/delete failures and collapses cache errors into cache misses.
10. `workers/src/middleware/apiKey.js:128`, `workers/src/handlers/profile.js:242`, and `workers/src/handlers/push.js:635` still rely on best-effort accounting updates that can fail silently after the user-facing action succeeds.

## Known Issues Baseline

Historical baseline extracted from `BACKLOG.md` (first 100 lines), `audits/PRODUCTION_BUG_REPORT_2026-03-11.md`, `audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md`, and `audits/WORKERS_AUDIT_REPORT.md` (first 80 lines):

```json
[
  { "id": "BL-PROD-001", "title": "Production endpoints returning 404/500 errors", "severity": "Critical", "status": "open" },
  { "id": "BL-PROD-002", "title": "GET /api/auth/me returns 404 (route exists in code)", "severity": "Critical", "status": "open" },
  { "id": "BL-PROD-003", "title": "GET /api/validation/* returns 404 (route exists in code)", "severity": "Critical", "status": "open" },
  { "id": "BL-PROD-004", "title": "GET /api/psychometric/* returns 404 (route exists in code)", "severity": "Critical", "status": "open" },
  { "id": "BL-PROD-005", "title": "GET /api/diary returns 500 (handler implemented, DB connection issue)", "severity": "High", "status": "open" },
  { "id": "BL-PROD-006", "title": "GET /api/transits/forecast returns 400 (frontend missing params)", "severity": "High", "status": "open" },
  { "id": "BL-PROD-007", "title": "CSP violations (Cloudflare Insights blocked, fonts blocked)", "severity": "High", "status": "open" },
  { "id": "BUG-001", "title": "GET /api/chart/:id crashes (Cloudflare HTML 500)", "severity": "P1", "status": "open" },
  { "id": "BUG-002", "title": "AUTH_PREFIXES missing base routes (auth bypass for valid tokens)", "severity": "P1", "status": "open" },
  { "id": "BUG-003", "title": "POST /api/auth/forgot-password — user enumeration (CVE)", "severity": "P1", "status": "open" },
  { "id": "BUG-004", "title": "POST /api/auth/reset-password with invalid token returns 500", "severity": "P1", "status": "open" },
  { "id": "BUG-005", "title": "GET /api/profile/list returns 500", "severity": "P1", "status": "open" },
  { "id": "BUG-006", "title": "GET /api/practitioner/profile returns 500 for non-practitioners", "severity": "P1", "status": "open" },
  { "id": "BUG-007", "title": "GET /api/checkin/streak and /api/checkin/stats return 500", "severity": "P1", "status": "open" },
  { "id": "BUG-008", "title": "GET /api/achievements/leaderboard returns 500", "severity": "P1", "status": "open" },
  { "id": "BUG-009", "title": "POST /api/alerts — create alert returns 500", "severity": "P1", "status": "open" },
  { "id": "BUG-010", "title": "GET /api/notion/status returns 500", "severity": "P2", "status": "open" },
  { "id": "BUG-011", "title": "GET /api/cluster-status returns 500", "severity": "P2", "status": "open" },
  { "id": "BUG-012", "title": "TC-REF-001/004 referral endpoints return 404", "severity": "P2", "status": "open" },
  { "id": "BUG-013", "title": "TC-VALID-002, TC-PSYCH-002 return 404", "severity": "P2", "status": "open" },
  { "id": "DESIGN-001", "title": "Logout does not invalidate access token (stateless JWT)", "severity": "P2", "status": "open" },
  { "id": "DESIGN-002", "title": "Admin role not set on production account", "severity": "P2", "status": "open" },
  { "id": "TIER-001", "title": "Billing and entitlement logic disagree on past_due subscriptions", "severity": "High", "status": "open" },
  { "id": "TIER-002", "title": "Admin revenue analytics use legacy tier names and obsolete prices", "severity": "High", "status": "open" },
  { "id": "TIER-003", "title": "White-label embed entitlement is ambiguous across code and docs", "severity": "High", "status": "open" },
  { "id": "TIER-004", "title": "Public docs still describe outdated tier names and channel strategy", "severity": "Medium", "status": "open" },
  { "id": "TIER-005", "title": "Frontend pricing logic still exposes legacy naming in core UI code", "severity": "Medium", "status": "open" },
  { "id": "TIER-006", "title": "Practitioner and Agency docs mix old and new commercial semantics", "severity": "Medium", "status": "open" },
  { "id": "WORKERS-CRIT-001", "title": "32 phantom tables referenced in code that do not exist in production database", "severity": "Critical", "status": "open" }
]
```

Baseline caveat:
- The historical documents are stale in a few places. Current code review shows that the old `BUG-003` and `BUG-004` auth findings are now fixed in `workers/src/handlers/auth.js`, even though they remain marked open in older audit documents.

## Flow Analysis

### `workers/src/handlers/billing.js`

- Subscription checkout is materially improved. It now:
  - blocks Agency checkout with a contact gate,
  - validates promo-code format,
  - offers a 7-day practitioner trial for new free users,
  - wraps Stripe cancellation in a circuit breaker.
- Remaining issues:
  - The duplicate-session reuse check is still TOCTOU. Two concurrent requests can both list open sessions before either creates a new one.
  - Customer creation in Stripe and persistence of `stripe_customer_id` are still separate operations.
  - The retention flow is now surfaced in-app before the Stripe portal fallback, but it still relies on `confirm()` dialogs rather than a first-class billing-management UI.

### `workers/src/handlers/auth.js`

- The auth surface is stronger than the prior audit lineage suggested.
  - Forgot-password now always returns a constant success response.
  - Invalid reset-token lookup failures now return 400 instead of 500.
  - Logout revokes refresh tokens and clears the refresh cookie.
- Remaining issue:
  - Access tokens are now memory-only on the frontend, but logout still cannot revoke already-issued access tokens server-side until they expire. The historical `DESIGN-001` concern is reduced, not eliminated.

### `workers/src/handlers/webhook.js`

- Stripe signature verification is present.
- Event claiming is atomic: the handler inserts the Stripe event id before processing, concurrent deliveries become no-ops, downstream failures release the claim for retry, and successful handlers finalize the claimed row in place.
- Ghost-subscription handling is better: if the local subscription row is missing, the handler now first tries `stripe_customer_id` and then exact email-based Stripe customer relinking before recreating the subscription row and tier. The same recovery path now covers invoice payment events before they are finalized.
- Remaining issues:
  - Ghost-subscription repair still cannot auto-heal if the `users` table lacks both a valid `stripe_customer_id` mapping and a safe exact email match, but those events now land in `payment_events` with `manual_review` status instead of disappearing into logs.

### `workers/src/middleware/tierEnforcement.js`

- Monthly usage quota enforcement is now database-backed and atomic for the main `atomicQuotaCheckAndInsert` path.
- Daily ceilings now use the same DB-backed atomic counter path as route rate limiting.
- Missing database configuration now fails closed with 503, which preserves the earlier cost-leak fix without relying on KV.
- The email-verification gate still fails open on DB lookup error.

### `workers/src/middleware/rateLimit.js`

- Route rate limiting is now backed by a DB atomic upsert counter instead of KV mutation.
- Missing database configuration now fails closed with a 503 and `Retry-After`, which preserves the earlier safety improvement.
- Route coverage is broad and includes auth, AI, promo, and cost-sensitive endpoints.
- The remaining problem is observability polish and storage dependency clarity rather than cross-isolate correctness.

## CTO Synopsis

Prime Self is in a better technical state than the last audit implied. The current test runner works, route rate limiting and daily ceilings are now backed by atomic database counters, and some previously alarming auth findings are fixed. The architecture remains workable for a Cloudflare Workers product, but its weakest layer is now billing-state reconciliation rather than rate-limit correctness.

Ratings:

| Area | Rating |
|------|--------|
| Architecture soundness | YELLOW |
| Handler complexity | YELLOW |
| Middleware layering | YELLOW |
| Missing abstractions | YELLOW |
| DB query patterns | YELLOW |
| Retry / circuit-breaker / graceful degradation | YELLOW |
| Test coverage gaps | YELLOW |
| Technical debt blocking scale | RED |

The dominant scaling debt is state coordination across Stripe and Neon. The worker now has better protection around quota counters, Stripe cancellation, and webhook event claiming, but it still mixes transactional and non-transactional state in a way that can leave one-time checkout reuse and payment recovery paths inconsistent. `billing.js` and `webhook.js` are not unmanageably large, but they still combine validation, remote IO, persistence, and user-facing response construction in a single pass. That makes the remaining bugs hard to isolate and even harder to prove away through tests.

The biggest positive change is that the green test surface now includes both the atomic counter path and the Stripe relink path: route limits and daily ceilings are no longer relying on KV race-prone mutation, webhook recovery can now repair some missing customer mappings automatically, and the remaining unrecoverable cases are durably parked for review. The biggest remaining negative is still Stripe-to-local reconciliation at the outer edge. Recovery now falls back from `stripe_customer_id` to exact email repair, but it still cannot auto-heal when neither signal can safely identify the user, and one-time checkout session reuse is still list-based rather than claim-based. The codebase is not launch-blocked by missing features anymore; it is launch-constrained by the few places where money, access, and fulfillment can still diverge.

Prioritized CTO issues:
- P0: add an operator-facing review/replay workflow for `manual_review` Stripe events that still cannot be auto-mapped.
- P1: make one-time checkout session reuse claim-based instead of list-based.
- P1: unify JSON body parsing and error envelopes so malformed input does not fall into generic 500s.
- P1: migrate remaining middleware/helper `console.*` calls to the request logger.

## CISO Synopsis

The security posture is materially improved relative to the last audit. Two historical red flags are no longer true in current code: access tokens are not stored in localStorage anymore, and the forgot-password / reset-password flows now behave in a safer, enumeration-resistant way. That is real progress, not cosmetic drift.

Ratings:

| Area | Rating |
|------|--------|
| JWT storage | GREEN |
| CSP policy | YELLOW |
| OAuth flow security | YELLOW |
| Secret management | GREEN |
| SQL injection surface | GREEN |
| Practitioner data isolation | YELLOW |
| Stripe webhook verification | GREEN |
| Rate limiting bypass resistance | YELLOW |
| CORS policy correctness | GREEN |

The most important remaining security weakness is no longer the core rate-limit primitive. Auth and paid endpoints now use an atomic database-backed counter, which closes the previous cross-isolate overrun problem. The remaining security work is narrower: storage failures still rely on coarse fail-closed behavior, CSP still allows inline styles, and practitioner/client isolation still needs a tighter proof pass.

The second live issue is CSP drift. The frontend still ships `style-src 'unsafe-inline'` in `frontend/index.html`. That is a deliberate tradeoff, and the comment acknowledges it, but it still weakens the blast-radius reduction you would otherwise get from the now-improved token storage model.

The third concern is practitioner isolation confidence. The codebase clearly includes access checks and sanitized public-profile handling, but this audit did not produce a full endpoint-by-endpoint proof that every practitioner/client read path is equally constrained. That is better framed as an assurance gap than a confirmed breach.

Prioritized CISO issues:
- P1: tighten CSP so inline style exceptions are minimized or nonce-based.
- P1: replace remaining plain-text or unstructured middleware error logging with structured request logging.
- P1: complete a targeted IDOR/RLS audit across practitioner and client retrieval routes.

## CFO Synopsis

The billing surface is healthier than the previous audit registry suggested. Agency checkout is no longer live for self-serve purchase, webhook-event claiming is atomic, and quota enforcement no longer fails open when KV is missing. Those are meaningful financial-control wins.

Ratings:

| Area | Rating |
|------|--------|
| Checkout session creation | YELLOW |
| Webhook idempotency | YELLOW |
| Subscription state sync | YELLOW |
| Quota enforcement before AI calls | YELLOW |
| Free tier abuse resistance | YELLOW |
| Studio / Agency gating | GREEN |
| Revenue recognition correctness | YELLOW |
| Refund / cancel flow | YELLOW |

The remaining financial risk is concentrated in two places. First, one-time checkout reuse is still list-based rather than claim-based, so parallel requests can still race into multiple open sessions. Second, the ghost-subscription fix is conditional, not complete. If Stripe events arrive out of order and the code cannot recover a user from either `stripe_customer_id` or a safe exact email match, the event is now parked for manual review instead of being lost, but application access still depends on a human or follow-up workflow to resolve it.

The cancel flow is improved. The frontend now previews the retention offer, allows an in-app downgrade, and allows scheduled cancellation before falling back to the Stripe portal. The remaining gap is product polish rather than missing logic: this is still a modal-confirm flow, not a dedicated retention experience with pricing comparison, consequences, and recovery messaging.

Prioritized CFO issues:
- P0: close the remaining ghost-subscription recovery hole when neither stored customer id nor exact email can safely recover the user.
- P1: build an explicit operator workflow to inspect and replay `manual_review` billing events.
- P1: replace the current `confirm()`-driven retention flow with a first-class billing-management UI.

## CMO Synopsis

The marketing and product story are closer to the app than the old audits suggested, but the language and meaning layer are still uneven. Several practitioner-facing surfaces now exist in the UI, including session notes and Notion sync, so the narrative that the practitioner product is purely backend-only is no longer current. The remaining problem is less “missing tabs” and more “incomplete promise translation.”

Ratings:

| Area | Rating |
|------|--------|
| Registration → chart → profile funnel | YELLOW |
| Onboarding narrative quality | YELLOW |
| Practitioner dashboard discoverability | YELLOW |
| Referral mechanics | YELLOW |
| Social share hooks | YELLOW |
| Email/SMS digest engagement | YELLOW |
| Achievement/gamification loop | YELLOW |
| “Why it matters” explanation layer | RED |
| Celebrity compare as acquisition hook | YELLOW |

The current app still leans too hard on structured output and not enough on personal meaning. Practitioner client detail shows chart facts, synthesis summary, PDF exports, notes, and compatibility navigation, but it still under-explains why the chart matters in real-life coaching terms. That affects retention more than raw feature count.

There is also a trust-and-copy issue around tier messaging. The primary pricing overlays use “Practitioner” and “Agency”, but the practitioner upgrade notice still tells users that client management requires a “Guide” tier. That breaks confidence at the moment of conversion.

Prioritized CMO issues:
- P0: deepen the “why it matters” interpretation layer in profile and practitioner views.
- P1: eliminate Guide/Practitioner naming drift across upgrade CTAs and docs.
- P1: expose more explicit post-upgrade guidance so new practitioners land on the right workflow immediately.

## CIO Synopsis

Operationally, the repo looks less broken than the latest prior audit file claimed. The test runner is working again, the rate limiter now fails closed when database configuration is absent, and the current worker code shows more deliberate handling around Stripe cancellation and degraded states. This is not an observability vacuum anymore.

Ratings:

| Area | Rating |
|------|--------|
| Observability coverage | YELLOW |
| Sentry integration completeness | YELLOW |
| Health endpoint depth | YELLOW |
| KV cache hit strategy | YELLOW |
| Worker CPU / memory efficiency | YELLOW |
| Deployment pipeline | YELLOW |
| Rollback capability | YELLOW |
| Environment parity | YELLOW |
| Secrets hygiene | GREEN |
| Cron reliability | YELLOW |

The remaining CIO problem is consistency, not absence. Some paths use a structured request logger; others still log raw text from middleware and helpers. Some revenue-sensitive flows have circuit breakers; others still rely on best-effort `.catch()` logging. Some controls fail closed now; others still fail open for migration compatibility. This unevenness matters more than any single red flag because it makes operational behavior difficult to predict under incident load.

Recent repo-memory notes also matter here: secrets are externalized, but historical secret contamination still exists in old Git history and still requires credential rotation and history purge outside the tip commit. That is a governance task, not a code correctness task, but it remains part of launch operations.

Prioritized CIO issues:
- P1: finish migrating remaining middleware/helper logging to structured logger fields.
- P1: document and rehearse rollback and incident-response steps around billing/webhook faults.
- P1: add concurrency-focused load tests for rate-limit and quota behavior so green unit tests map to production behavior.

## Practitioner UX Journey

1. Discovery → signup → Practitioner checkout
The pricing surface is live, clear, and significantly better than prior audits suggested. Practitioner and Agency plans are visible, session notes are no longer phantom features, and Agency purchase is correctly routed to contact instead of blind checkout. The main friction is naming drift: the pricing UI says “Practitioner”, while the practitioner upgrade notice still says “Guide”.

2. Dashboard first load
The practitioner tab is no longer empty. It contains client roster tools, directory profile controls, Notion sync, invitation history, and agency seats. The main problem is orientation: the app does not strongly steer a new practitioner into the highest-value first action.

3. Adding a client by email
This flow appears workable. Invitation tools and status refresh are present. The residual UX gap is visibility into client state after invitation, especially who has completed chart/profile setup.

4. Viewing client chart + profile
This is substantially more complete than the prior audit suggested. Client detail loads chart traits, synthesis summary, PDF downloads, notes, and a compatibility-chart entry point. The main UX weakness is that compatibility still requires manual re-entry in the composite tab.

5. Session notes creation
Implemented. CRUD UI exists in the practitioner client-detail surface and supports “share with AI synthesis”.

6. AI context for that client
This remains incomplete. The backend exposes dedicated AI-context endpoints, but the frontend does not expose a dedicated editor or viewer for that context.

7. Practitioner directory profile setup
Implemented and improved. The save flow now returns a live-profile confirmation link.

8. Public profile discoverability
Implemented. There is a public practitioner directory tab and server-rendered practitioner pages.

9. Notion sync
Implemented in the frontend and backend. The prior “backend only” finding is stale.

10. Billing portal / cancel flow
The billing portal handoff still exists, but the app now intercepts cancellation with an in-app retention preview, downgrade option, and scheduled-cancel path before sending the user to Stripe.

Practitioner UX issue list:
- 5/5: No dedicated per-client AI-context editor despite backend support.
- 3/5: Billing retention is functional but still presented through browser confirm dialogs instead of a first-class settings UI.
- 3/5: Guide/Practitioner naming drift undermines trust at upgrade time.
- 3/5: Compatibility flow is a redirect, not a prefilled guided experience.
- 2/5: Directory “View my profile” confirmation may build a broken URL when `display_name` differs from the saved slug.

## CEO Executive Summary

Prime Self is healthier than the most recent audit file suggested, but it is not cleanly launch-ready for practitioner scale yet. The important story is not “everything is broken”; it is “several high-profile historical defects are fixed, but a small set of payment and concurrency bugs remain concentrated in the exact places that can create churn, chargebacks, and support pain.” Tests are green, auth token handling is safer, Agency self-serve checkout is blocked correctly, and practitioner features such as notes and Notion sync are now present in the UI. Those are real readiness improvements.

The remaining blockers sit in three clusters: incomplete Stripe-to-local recovery semantics, one-time billing edge-case coordination, and practitioner conversion friction around retention and messaging. None of these suggest a total rewrite. They do suggest that paid practitioner growth would magnify a few correctness issues faster than the current operational tooling can explain them.

### Top 5 issues that would prevent a paying practitioner from staying subscribed

1. Stripe recovery still needs operator intervention when a paid customer cannot be matched by either stored `stripe_customer_id` or an exact email fallback.
2. Per-client AI context exists in the backend but is still missing as an explicit frontend workflow.
3. One-time checkout reuse is still list-based, so concurrent purchase attempts can create duplicate open sessions.
4. Guide/Practitioner naming drift makes the paid tier feel inconsistent and unfinished.
5. Billing retention is functional, but the current confirm-dialog UX is too thin for a polished downgrade/save experience.

### Top 3 risks that could cause a legal or financial problem

1. Ghost-subscription recovery still requires manual intervention if the application cannot map Stripe customer state back to a user by either stored customer id or exact email.
2. Billing events now park in `manual_review` when Stripe customer state exists but cannot be mapped back through either `stripe_customer_id` or a safe exact email match.
3. One-time checkout reuse can still create duplicate open sessions under parallel purchase attempts.

### Readiness rating

`SOFT LAUNCH READY`

Reasoning:
- The app no longer looks launch-blocked by broad missing functionality.
- It is not safe enough yet for aggressive paid growth without fixing the concentrated billing and concurrency defects.

## Master Issue Registry

```json
[
  {
    "id": "CTO-014",
    "persona": "CTO",
    "severity": "P0",
    "area": "concurrency",
    "title": "KV-backed rate limiting and daily ceilings remain non-atomic across isolates",
    "status": "resolved"
  },
  {
    "id": "CTO-016",
    "persona": "CTO",
    "severity": "P1",
    "area": "error-handling",
    "title": "Silent catch-and-log patterns still hide cache, accounting, and helper failures",
    "status": "regression"
  },
  {
    "id": "CISO-001",
    "persona": "CISO",
    "severity": "P0",
    "area": "auth",
    "title": "JWT access token stored in localStorage — XSS = full account takeover",
    "status": "resolved"
  },
  {
    "id": "CISO-003",
    "persona": "CISO",
    "severity": "P1",
    "area": "csp",
    "title": "Frontend CSP still allows inline styles via style-src unsafe-inline",
    "status": "regression"
  },
  {
    "id": "CISO-004",
    "persona": "CISO",
    "severity": "P0",
    "area": "rate-limiting",
    "title": "Auth and paid endpoints still rely on non-atomic KV counters under concurrency",
    "status": "resolved"
  },
  {
    "id": "CISO-009",
    "persona": "CISO",
    "severity": "P1",
    "area": "auth",
    "title": "Forgot-password flow leaked user existence",
    "status": "resolved"
  },
  {
    "id": "CISO-010",
    "persona": "CISO",
    "severity": "P1",
    "area": "auth",
    "title": "Invalid reset-token lookup returned 500 instead of 400",
    "status": "resolved"
  },
  {
    "id": "CFO-001",
    "persona": "CFO",
    "severity": "P0",
    "area": "billing",
    "title": "Agency tier accepted self-serve checkout despite incomplete delivery scope",
    "status": "resolved"
  },
  {
    "id": "CFO-002",
    "persona": "CFO",
    "severity": "P0",
    "area": "billing",
    "title": "Webhook event deduplication was non-atomic",
    "status": "resolved"
  },
  {
    "id": "CFO-003",
    "persona": "CFO",
    "severity": "P0",
    "area": "quota",
    "title": "Quota enforcement depended on KV availability and failed open",
    "status": "resolved"
  },
  {
    "id": "CFO-009",
    "persona": "CFO",
    "severity": "P0",
    "area": "billing",
    "title": "Ghost subscriptions remain unrecoverable when Stripe customer state cannot be mapped by stored customer id or exact email fallback",
    "status": "regression"
  },
  {
    "id": "CFO-010",
    "persona": "CFO",
    "severity": "P0",
    "area": "billing",
    "title": "One-time purchase grants are not transaction-safe and can leave partial fulfillment",
    "status": "resolved"
  },
  {
    "id": "CFO-012",
    "persona": "CFO",
    "severity": "P1",
    "area": "billing",
    "title": "One-time checkout still lacks duplicate-session reuse protection",
    "status": "resolved"
  },
  {
    "id": "CFO-013",
    "persona": "CFO",
    "severity": "P1",
    "area": "billing",
    "title": "Webhook events are claimed before downstream fulfillment completes, so transient failures require explicit replay handling",
    "status": "resolved"
  },
  {
    "id": "CMO-001",
    "persona": "CMO",
    "severity": "P1",
    "area": "retention",
    "title": "Profile and practitioner views still under-deliver the why-it-matters interpretation layer",
    "status": "regression"
  },
  {
    "id": "CIO-002",
    "persona": "CIO",
    "severity": "P1",
    "area": "logging",
    "title": "Structured logging adoption remains incomplete in middleware and helper paths",
    "status": "regression"
  },
  {
    "id": "PRAC-001",
    "persona": "Practitioner",
    "severity": "P0",
    "area": "session-notes",
    "title": "Session notes backend existed without usable frontend UI",
    "status": "resolved"
  },
  {
    "id": "PRAC-002",
    "persona": "Practitioner",
    "severity": "P0",
    "area": "notion",
    "title": "Notion sync backend existed without usable frontend UI",
    "status": "resolved"
  },
  {
    "id": "PRAC-003",
    "persona": "Practitioner",
    "severity": "P0",
    "area": "ai-context",
    "title": "Per-client AI context endpoints exist but still have no dedicated frontend editor",
    "status": "regression"
  },
  {
    "id": "PRAC-007",
    "persona": "Practitioner",
    "severity": "P0",
    "area": "billing",
    "title": "Retention offer exists in the billing API but the current cancel journey never surfaces it before portal handoff",
    "status": "resolved"
  },
  {
    "id": "PRAC-009",
    "persona": "Practitioner",
    "severity": "P1",
    "area": "labeling",
    "title": "Tier naming still conflicts: Practitioner pricing vs Guide upgrade notice",
    "status": "regression"
  },
  {
    "id": "PRAC-011",
    "persona": "Practitioner",
    "severity": "P2",
    "area": "directory",
    "title": "Directory profile save lacked a live-profile confirmation link",
    "status": "resolved"
  },
  {
    "id": "PRAC-012",
    "persona": "Practitioner",
    "severity": "P2",
    "area": "directory",
    "title": "Directory success link is built from display_name instead of the saved slug and can produce broken public URLs",
    "status": "new"
  },
  {
    "id": "PRAC-013",
    "persona": "Practitioner",
    "severity": "P2",
    "area": "compatibility",
    "title": "Compatibility action opens the composite tab but does not prefill practitioner and client birth data",
    "status": "new"
  }
]
```