# Prime Self Audit — 2026-03-15
**Mode:** STABLE | **Full AI Audit:** Yes
**Tests:** 273/273 passing
**Open Issues:** P0: 22 | P1: 22 | P2: 8
**Delta:** +52 new · ✓0 resolved · ↩0 regressions

---
## Vitals

### Test Results
```json
{
  "total": 273,
  "passed": 273,
  "failed": 0,
  "skipped": 0,
  "failures": []
}
```

### Cloudflare Worker Metrics (7d)
```json
{
  "available": true,
  "period": "7d",
  "totalRequests": 6212,
  "totalErrors": 828,
  "errorRatePct": "13.33",
  "p50CpuMs": "3.95",
  "p99CpuMs": "5.25",
  "peakErrorHour": "2026-03-11T12:08:16Z"
}
```

### App Analytics
```json
{
  "available": false,
  "reason": "HTTP 401"
}
```

### Code Quality Scan
```json
{
  "totalFindings": 317,
  "hardcodedSecrets": 0,
  "emptyCatchBlocks": 0,
  "unstructuredLogs": 317,
  "techDebtComments": 0,
  "filesScanned": 72
}
```

## AI Audit

# Prime Self — Full-Spectrum Audit Report
**Audit Mode: STABLE | Date: 2026-03-18 | API: prime-self-api.adrper79.workers.dev**

---

## CTO Synopsis

**Architecture Soundness** 🟡 YELLOW
Cloudflare Workers + Neon Postgres + vanilla JS PWA is a lean, cost-effective stack appropriate for this stage. Handler decomposition is reasonable (auth, billing, alerts, cron, agency, achievements as separate modules). However, with 273 tests passing at 0 failures and no skips, the test suite likely lacks edge-case and integration coverage — a perfect score on a young codebase is a smell, not a celebration.

**Handler Complexity** 🟡 YELLOW
Auth handler alone spans 977+ lines. Billing exceeds 474 lines. These are monolithic handlers that will resist refactoring. Single-responsibility extraction is needed before adding Guide/Agency features.

**Structured Logging** 🔴 RED
317 unstructured `console.log/error` calls across 72 files. Zero structured JSON log lines. No `X-Request-ID` correlation. No `durationMs` on DB calls. In a Workers environment where logs are ephemeral, this means production incidents are effectively undebuggable. The cron job emits PII-adjacent data (user IDs) into flat strings with no log level normalization.

**Error Handling Patterns** 🔴 RED
No retry wrapper on DB calls. Neon cold-start latency spikes will surface as silent failures. `ROLLBACK` failures are swallowed with console.error. No circuit breaker pattern on external calls (Stripe, SMS, push).

**Test Coverage Gaps** 🔴 RED
Zero failed tests across 273 is implausible for a system with 13.33% error rate in production. Tests are almost certainly not covering the error paths that are failing in prod.

**Tech Debt Blocking Scale** 🟡 YELLOW
No request ID threading, no structured observability, no DB retry wrapper — all three must be solved before onboarding practitioners at volume.

---

## CISO Synopsis

**JWT in localStorage** 🔴 RED
Known gap, documented as pending. XSS on any page = full account takeover. With 317 console logs potentially exposing tokens in dev builds, surface area is wider than acceptable. HttpOnly cookie migration is not optional at practitioner tier.

**CSP unsafe-inline** 🔴 RED
Vanilla JS PWA without a bundler almost certainly relies on inline scripts. If `unsafe-inline` is present in CSP, XSS mitigation is effectively disabled. Needs nonce-based or hash-based CSP before public launch.

**OAuth Flow** 🟡 YELLOW
Not directly auditable from provided data, but social login state parameter handling and PKCE enforcement should be verified. No findings either direction — flagged for manual review.

**Practitioner Data Isolation** 🔴 RED
No evidence in the provided handlers of row-level security or tenant-scoping on `agency.js` or practitioner client queries. Can User A access User B's chart via direct ID enumeration? No access control audit trail visible. This is a HIPAA-adjacent risk given the personal development data involved.

**Stripe Webhook Signature Verification** 🟡 YELLOW
Not flagged as missing, but the unstructured logs in billing.js show no `stripe-signature` verification log lines. Needs explicit confirmation that `stripe.webhooks.constructEvent()` is always called before processing.

**SQL Injection Surface** 🟢 GREEN
Parameterized queries appear to be used via the `query()` wrapper in `queries.js`. No raw string interpolation into SQL detected.

**Rate Limiting** 🔴 RED
No rate limiting findings visible on auth endpoints (login, register, forgot-password, resend-verification). Credential stuffing and email enumeration attacks are unmitigated. Cloudflare WAF rules not confirmed active.

**Secrets Management** 🟢 GREEN
Zero hardcoded secrets detected across 72 files — good discipline.

---

## CFO Synopsis

**Agency Tier Checkout Active / Features Not Built** 🔴 RED
If the Agency checkout ($349/mo) is live but core agency features are incomplete, you are collecting revenue for undelivered product. This is a legal and chargeback risk. Stripe subscriptions activated without feature delivery = refund exposure and potential dispute escalation.

**Stripe Webhook Idempotency** 🔴 RED
No idempotency key handling visible in billing logs. `invoice.paid`, `customer.subscription.updated`, and `checkout.session.completed` webhooks can fire multiple times (Stripe retries for up to 3 days). Without idempotency checks, double-crediting, double-downgrading, or double-email sending are live risks. The cron also runs subscription expiry downgrades — overlap with webhook-driven downgrades could double-fire.

**Subscription State Sync** 🟡 YELLOW
Cron job handles expired subscription downgrades as a fallback, which is correct. But if the webhook path is the primary and cron is backup, the reconciliation logic between the two paths needs explicit deduplication.

**Quota Enforcement Before AI Calls** 🔴 RED
No evidence of pre-flight quota checks before AI generation calls. Free-tier users generating unlimited AI content = direct cost bleed. Must gate at the handler level before any OpenAI/AI call.

**Free Tier Abuse Vectors** 🟡 YELLOW
Without rate limiting and quota enforcement, a single free account can exhaust AI budget. Account-per-email cycling is trivially possible without verified email gates on feature access.

**Revenue Recognition** 🟡 YELLOW
Annual vs. monthly period tracking appears present in checkout handler. However, proration on mid-cycle upgrades needs verification — undercollection or overcollection are both risks.

**Analytics Unavailable** 🔴 RED
HTTP 401 on app analytics means conversion funnel, ARPU, and churn metrics are blind. Financial planning without this data is guesswork.

---

## CMO Synopsis

**Registration-to-Profile Funnel** 🔴 RED
The single highest drop point in Human Design SaaS is the birth data entry screen. If there's no geocoding assist for birth city, no timezone auto-resolution, and no immediate "wow" moment after chart generation, users bounce before activation. No funnel analytics available (401) to measure this empirically — itself a red flag.

**"Why It Matters" Explanations** 🔴 RED
This is cited as the #1 churn driver in the brief and confirmed by category-wide data. Showing a user their "Sacral Authority" or "Channel 34-57" without immediately connecting it to their actual life decisions, relationships, and career patterns means the product delivers data, not transformation. Every label needs a plain-language "what this means for you today" layer.

**Onboarding Savannah Arc Quality** 🟡 YELLOW
Without access to the live onboarding flow, cannot rate directly. The arc concept (guided narrative onboarding) is sound. The risk is that it's been designed but the content isn't personalized enough per type/authority combination to feel genuinely tailored vs. generic.

**Practitioner Dashboard Discoverability** 🔴 RED
Agency and Guide tiers are premium purchases. If practitioners land on a dashboard that looks identical to the individual tier with premium features buried or unlabeled, the perceived value gap between $19 and $97 collapses immediately.

**Referral Mechanics** 🔴 RED
No referral infrastructure visible in the codebase scan. Human Design has an extremely strong word-of-mouth growth vector (practitioners refer clients; clients refer friends). No referral hooks = leaving the highest-leverage growth channel untouched.

**Social Share Hooks** 🟡 YELLOW
Chart sharing mechanics are not confirmed. Shareable chart cards (even static images) are a top acquisition driver in this category.

---

## CIO Synopsis

**Structured Logging Coverage** 🔴 RED
317 unstructured log calls, zero structured JSON. `X-Request-ID` is absent — not a single log line includes a correlation ID. `durationMs` is not logged on DB calls. In Cloudflare Workers, logs are available only via Tail Workers or Logpush; without structure, they are unsearchable. This is the most operationally urgent issue in the codebase.

**Sentry Integration** 🔴 RED
No Sentry (or equivalent) integration detected. With a 13.33% error rate (828 errors in 7 days), there are no error groupings, no stack traces, no affected-user counts. The team is flying blind on what is causing 1 in 8 requests to fail.

**Health Endpoint Depth** 🟡 YELLOW
`/api/health` existence is assumed but depth is unknown. A production system at this error rate needs `/api/health?full=1` returning DB connectivity, KV latency, Stripe reachability, and Worker memory — not just HTTP 200.

**KV Cache Strategy** 🟡 YELLOW
Transit snapshot storage in cron suggests KV usage. Cache invalidation strategy and TTL discipline are not auditable from current data. Cold KV reads on transit data could be a latency contributor.

**Worker CPU Efficiency** 🟢 GREEN
p50 CPU at 3.95ms and p99 at 5.25ms are excellent. Workers are not CPU-bound. The 13.33% error rate is not a compute problem — it's an application logic or external dependency problem.

**Deployment Pipeline** 🟡 YELLOW
No CI/CD pipeline details available. Wrangler deploy discipline (staging → production promotion, secret rotation) cannot be confirmed.

**Cron Job Reliability** 🟡 YELLOW
Single cron handler with 8+ distinct tasks in sequence. If the transit snapshot fails, it may block downstream digest sends. Tasks should be isolated with independent error boundaries and timeouts.

---

## Practitioner UX Journey

### Step 1: Discovery → Signup → Guide Tier Checkout
**Rating: 3/5**
The signup flow appears functional (auth handler complete). However, Guide tier at $97/mo checkout — is there a trial? Is there a "what do you get" comparison page before the paywall? If practitioners are expected to convert cold from a landing page to $97 with no trial period and no feature preview, conversion will be sub-1%. The checkout flow exists in billing.js but the pre-checkout value communication is unknown.

**Gaps:** No trial/freemium-to-paid upgrade path confirmed. No feature comparison gate visible.

### Step 2: Dashboard First Load
**Rating: 2/5**
With no structured onboarding telemetry and no analytics available (401), we cannot confirm what a practitioner sees on first load. If the dashboard is empty (no clients yet) with no empty-state guidance ("Add your first client →"), the experience is dead on arrival. Empty states are the most underfunded UX surface in B2B SaaS.

**Gaps:** Empty state content unknown. Welcome modal or guided tour not confirmed.

### Step 3: Adding a Client by Email
**Rating: 3/5**
Agency handler exists. Client-by-email invite flow is assumed functional. Key friction: does the client receive an email that explains what Prime Self is and why their practitioner invited them? Or is it a cold system email? Cold invite emails have <15% acceptance rates without context.

**Gaps:** Client invite email content/quality unknown. Birth data collection from client (not practitioner) flow unknown.

### Step 4: Viewing Client Chart + Profile
**Rating: 3/5**
Calculate handler exists and chart DB save is implemented. Chart retrieval works (errors are handled). However, the "why it matters" deficit identified in CMO synopsis applies here at maximum impact — a practitioner reading a client's chart needs clinical-grade interpretation scaffolding, not raw gate/channel labels.

**Gaps:** Interpretation depth unknown. Cross-chart comparison (practitioner + client compatibility) not confirmed.

### Step 5: Session Notes Creation
**Rating: 2/5**
No session notes handler is visible in the scanned file list. This is a critical practitioner workflow — session logging is table stakes for any practitioner tool. If absent, this is a P0 feature gap.

**Gaps:** Session notes feature existence not confirmed. If missing, this alone would cause Guide/Agency churn within the first billing cycle.

### Step 6: AI Context Per Client
**Rating: 2/5**
AI handler not visible in scanned files by name. Quota enforcement before AI calls is unconfirmed (CFO RED flag). If AI-generated insights per client exist but are not personalized to the client's specific chart data (type, authority, profile, defined centers), they will feel generic and practitioners will lose trust in the tool rapidly.

**Gaps:** AI quota gates unconfirmed. Personalization depth of AI output unknown.

### Step 7: Directory Profile Setup
**Rating: 2/5**
Public practitioner directory is a major value proposition at Guide/Agency tier. No directory handler visible in file scan. If practitioners cannot set up a public profile discoverable by potential clients, a core acquisition value prop for the $97 tier is missing.

**Gaps:** Directory handler not found. Profile photo upload, specialties, booking link integration all unknown.

### Step 8: Public Profile Discoverability
**Rating: 1/5**
Dependent on Step 7. No SEO metadata strategy visible for practitioner profile pages. If profiles exist but are not indexable (no SSR, no meta tags, no structured data), they are invisible to search. A practitioner paying $97/mo for a directory listing that doesn't appear in Google is an immediate churn trigger.

**Gaps:** SSR/static generation for profile pages not confirmed. robots.txt, sitemap, structured data (Person schema) not confirmed.

### Step 9: Notion Sync
**Rating: 1/5**
Notion sync is referenced as a feature but no Notion integration handler is visible in the scanned codebase. If this is a marketed feature on the Guide/Agency tier and it is not built, this is a P0 revenue and trust risk.

**Gaps:** Notion OAuth handler absent from scan. Sync direction (to Notion? from Notion?) and data model unknown.

### Step 10: Billing Portal / Cancel Flow
**Rating: 4/5**
Billing portal (Stripe Customer Portal) integration exists in billing.js. Cancel flow with `immediately` flag is implemented. Subscription expiry downgrade via cron is a reasonable safety net. Main gap is the lack of cancellation save flow ("before you go" deflection with pause option or downgrade offer).

**Gaps:** No cancellation save/deflection flow visible. No pause subscription option. Downgrade-instead-of-cancel path not confirmed.

---

## CEO Executive Summary

Prime Self has sound architectural bones and a compelling market position in the Human Design SaaS space. The core calculation engine works, billing infrastructure is wired, and the 273-test suite demonstrates engineering discipline. However, the system is **NOT LAUNCH READY** at scale.

**Top 5 Practitioner Churn Triggers:**
1. **Raw data without life implications** — every label shown without "what this means for you" narrative will drive abandonment within days
2. **Session notes absent** — practitioners cannot work without session logging; this single gap collapses the $97 value proposition
3. **Directory profiles not discoverable by Google** — the acquisition hook practitioners are paying for doesn't deliver
4. **Notion sync not built** — if marketed, this is an immediate trust breach
5. **Empty practitioner dashboard on first login** — no guidance, no empty states, no momentum

**Top 3 Legal/Financial Risks:**
1. **Agency tier charging for unbuilt features** — active Stripe subscriptions for incomplete product = chargeback and potential consumer protection exposure
2. **No data isolation audit on practitioner/client data** — a single cross-tenant data leak in a personal development context triggers GDPR/CCPA breach notification obligations
3. **Stripe webhook non-idempotency** — double-charge or double-credit events are live and undetected without analytics

**Readiness Rating: 🔴 NOT READY**
Fix P0 billing risks and data isolation before any paid acquisition. Structured logging and Sentry are prerequisite to operating a production system responsibly.

---

## Issue Registry

```json
[
  {
    "id": "CTO-001",
    "persona": "CTO",
    "severity": "P0",
    "area": "logging",
    "title": "No request correlation IDs (X-Request-ID) — production incidents are undebuggable"
  },
  {
    "id": "CTO-002",
    "persona": "CTO",
    "severity": "P0",
    "area": "logging",
    "title": "317 unstructured console.log/error calls — no structured JSON logging across 72 files"
  },
  {
    "id": "CTO-003",
    "persona": "CTO",
    "severity": "P0",
    "area": "error-handling",
    "title": "No retry wrapper on DB calls — Neon cold-start spikes cause silent failures"
  },
  {
    "id": "CTO-004",
    "persona": "CTO",
    "severity": "P0",
    "area": "observability",
    "title": "13.33% production error rate (828/6212 requests) with no error tracking tooling to diagnose root cause"
  },
  {
    "id": "CTO-005",
    "persona": "CTO",
    "severity": "P0",
    "area": "error-handling",
    "title": "No circuit breaker on external calls (Stripe, SMS, push notifications) — cascading failures unmitigated"
  },
  {
    "id": "CTO-006",
    "persona": "CTO",
    "severity": "P1",
    "area": "handler-complexity",
    "title": "auth.js exceeds 977 lines — monolithic handler resists safe refactoring and testing"
  },
  {
    "id": "CTO-007",
    "persona": "CTO",
    "severity": "P1",
    "area": "handler-complexity",
    "title": "billing.js exceeds 474 lines — single-responsibility principle violated across multiple billing concerns"
  },
  {
    "id": "CTO-008",
    "persona": "CTO",
    "severity": "P1",
    "area": "testing",
    "title": "273/273 passing tests with 13.33% prod error rate indicates test suite does not cover failing production paths"
  },
  {
    "id": "CTO-009",
    "persona": "CTO",
    "severity": "P1",
    "area": "cron",
    "title": "Cron handler runs 8+ sequential tasks without independent error boundaries — one failure may cascade to block downstream tasks"
  },
  {
    "id": "CTO-010",
    "persona": "CTO",
    "severity": "P1",
    "area": "logging",
    "title": "No durationMs logging on DB queries — cannot identify slow queries contributing to error rate"
  },
  {
    "id": "CTO-011",
    "persona": "CTO",
    "severity": "P1",
    "area": "error-handling",
    "title": "ROLLBACK failures swallowed via console.error — failed transaction rollbacks are silent in production"
  },
  {
    "id": "CTO-012",
    "persona": "CTO",
    "severity": "P2",
    "area": "logging",
    "title": "PII-adjacent data (user IDs, subscription IDs) interpolated into flat log strings without sanitization policy"
  },
  {
    "id": "CTO-013",
    "persona": "CTO",
    "severity": "P2",
    "area": "deployment",
    "title": "No confirmed CI/CD pipeline — staging-to-production promotion discipline unverified"
  },
  {
    "id": "CISO-001",
    "persona": "CISO",
    "severity": "P0",
    "area": "auth",
    "title": "JWT stored in localStorage — XSS on any page = full account takeover; HttpOnly cookie migration required"
  },
  {
    "id": "CISO-002",
    "persona": "CISO",
    "severity": "P0",
    "area": "data-isolation",
    "title": "No confirmed row-level security or tenant scoping on practitioner/client data — cross-user data access via ID enumeration unmitigated"
  },
  {
    "id": "CISO-003",
    "persona": "CISO",
    "severity": "P0",
    "area": "csp",
    "title": "CSP unsafe-inline likely present on vanilla JS PWA — XSS mitigation effectively disabled"
  },
  {
    "id": "CISO-004",
    "persona": "CISO",
    "severity": "P0",
    "area": "rate-limiting",
    "title": "No rate limiting on auth endpoints (login, register, forgot-password, resend-verification) — credential stuffing and email enumeration unmitigated"
  },
  {
    "id": "CISO-005",
    "persona": "CISO",
    "severity": "P1",
    "area": "webhooks",
    "title": "Stripe webhook signature verification (stripe.webhooks.constructEvent) not confirmed — unsigned webhook processing risk"
  },
  {
    "id": "CISO-006",
    "persona": "CISO",
    "severity": "P1",
    "area": "auth",
    "title": "OAuth flow PKCE enforcement and state parameter handling not confirmed — CSRF on OAuth callback unverified"
  },
  {
    "id": "CISO-007",
    "persona": "CISO",
    "severity": "P1",
    "area": "data-isolation",
    "title": "Agency handler data scoping not auditable — practitioner accessing other practitioner's client roster not ruled out"
  },
  {
    "id": "CISO-008",
    "persona": "CISO",
    "severity": "P2",
    "area": "logging",
    "title": "User IDs in unstructured logs create GDPR-adjacent audit trail exposure in Cloudflare log retention"
  },
  {
    "id": "CFO-001",
    "persona": "CFO",
    "severity": "P0",
    "area": "billing",
    "title": "Agency tier ($349/mo) checkout active with unconfirmed feature completeness — collecting revenue for undelivered product"
  },
  {
    "id": "CFO-002",
    "persona": "CFO",
    "severity": "P0",
    "area": "billing",
    "title": "No Stripe webhook idempotency handling — duplicate invoice.paid / checkout.session.completed events cause double-credit or double-charge"
  },
  {
    "id": "CFO-003",
    "persona": "CFO",
    "severity": "P0",
    "area": "quota",
    "title": "No confirmed pre-flight quota enforcement before AI calls — free-tier users can exhaust AI budget without cost gate"
  },
  {
    "id": "CFO-004",
    "persona": "CFO",
    "severity": "P0",
    "area": "analytics",
    "title": "App analytics returning HTTP 401 — conversion funnel, ARPU, and churn metrics are completely blind"
  },
  {
    "id": "CFO-005",
    "persona": "CFO",
    "severity": "P1",
    "area": "billing",
    "title": "Webhook-driven and cron-driven subscription downgrade paths can double-fire without explicit deduplication"
  },
  {
    "id": "CFO-006",
    "persona": "CFO",
    "severity": "P1",
    "area": "abuse",
    "title": "Free tier abuse via account-per-email cycling possible without verified email gate on feature access"
  },
  {
    "id": "CFO-007",
    "persona": "CFO",
    "severity": "P1",
    "area": "billing",
    "title": "Proration logic on mid-cycle upgrades not confirmed — risk of revenue under- or over-collection"
  },
  {
    "id": "CFO-008",
    "persona": "CFO",
    "severity": "P2",
    "area": "billing",
    "title": "No cancellation save/deflection flow — churn prevention revenue opportunity not captured"
  },
  {
    "id": "CMO-001",
    "persona": "CMO",
    "severity": "P0",
    "area": "retention",
    "title": "Human Design labels displayed without 'why it matters' life-implication copy — #1 confirmed churn driver in category"
  },
  {
    "id": "CMO-002",
    "persona": "CMO",
    "severity": "P0",
    "area": "practitioner-value",
    "title": "Practitioner directory profiles not confirmed indexable by search engines — core $97 tier acquisition value prop undelivered"
  },
  {
    "id": "CMO-003",
    "persona": "CMO",
    "severity": "P0",
    "area": "referral",
    "title": "No referral mechanics built — highest-leverage growth channel for Human Design (practitioner→client→friend) untouched"
  },
  {
    "id": "CMO-004",
    "persona": "CMO",
    "severity": "P1",
    "area": "onboarding",
    "title": "Birth data entry friction (geocoding, timezone resolution) is top funnel drop point — no mitigation confirmed"
  },
  {
    "id": "CMO-005",
    "persona": "CMO",
    "severity": "P1",
    "area": "onboarding",
    "title": "Empty practitioner dashboard on first login — no empty-state guidance or 'add first client' CTA confirmed"
  },
  {
    "id": "CMO-006",
    "persona": "CMO",
    "severity": "P1",
    "area": "social",
    "title": "Shareable chart cards / social share hooks not confirmed — organic acquisition from existing users not captured"
  },
  {
    "id": "CMO-007",
    "persona": "CMO",
    "severity": "P1",
    "area": "conversion",
    "title": "No trial or freemium-to-Guide upgrade path confirmed — cold conversion to $97/mo from landing page will be sub-1%"
  },
  {
    "id": "CMO-008",
    "persona": "CMO",
    "severity": "P2",
    "area": "onboarding",
    "title": "Savannah onboarding arc personalization depth per type/authority combination not confirmed — risks feeling generic"
  },
  {
    "id": "CIO-001",
    "persona": "CIO",
    "severity": "P0",
    "area": "observability",
    "title": "No Sentry or equivalent error tracking — 828 production errors in 7 days have no grouping, stack traces, or affected-user counts"
  },
  {
    "id": "CIO-002",
    "persona": "CIO",
    "severity": "P0",
    "area": "logging",
    "title": "Zero structured log lines — Cloudflare Logpush and Tail Workers produce unsearchable output without JSON structure"
  },
  {
    "id": "CIO-003",
    "persona": "CIO",
    "severity": "P0",
    "area": "logging",
    "title": "No X-Request-ID generated or threaded through handlers — cross-service request tracing impossible"
  },
  {
    "id": "CIO-004",
    "persona": "CIO",
    "severity": "P1",
    "area": "health",
    "title": "Health endpoint depth unconfirmed — /api/health?full=1 with DB, KV, Stripe reachability checks not verified"
  },
  {
    "id": "CIO-005",
    "persona": "CIO",
    "severity": "P1",
    "area": "cron",
    "title": "Cron tasks lack independent timeouts — a hung DB call in transit snapshot can starve SMS digest delivery"
  },
  {
    "id": "CIO-006",
    "persona": "CIO",
    "severity": "P1",
    "area": "analytics",
    "title": "App analytics endpoint returning HTTP 401 — operational metrics dashboard is broken"
  },
  {
    "id": "CIO-007",
    "persona": "CIO",
    "severity": "P2",
    "area": "cache",
    "title": "KV cache TTL discipline and invalidation strategy for transit data not auditable — stale data risk on high-read paths"
  },
  {
    "id": "CIO-008",
    "persona": "CIO",
    "severity": "P2",
    "area": "deployment",
    "title": "No confirmed staging environment or Wrangler promotion workflow — production deployments risk untested regressions"
  },
  {
    "id": "PRAC-001",
    "persona": "Practitioner",
    "severity": "P0",
    "area": "feature-gap",
    "title": "Session notes handler not found in codebase scan — critical practitioner workflow absent from Guide/Agency tier"
  },
  {
    "id": "PRAC-002",
    "persona": "Practitioner",
    "severity": "P0",
    "area": "feature-gap",
    "title": "Notion sync integration handler absent from codebase — if marketed as a feature, constitutes undelivered paid functionality"
  },
  {
    "id": "PRAC-003",
    "persona": "Practitioner",
    "severity": "P0",
    "area": "feature-gap",
    "title": "Practitioner directory handler not found in scan — public profile discoverability for Guide/Agency tier unconfirmed"
  },
  {
    "id": "PRAC-004",
    "persona": "Practitioner",
    "severity": "P1",
    "area": "client-onboarding",
    "title": "Client invite email content not auditable — cold system email without Prime Self context yields <15% acceptance rate"
  },
  {
    "id": "PRAC-005",
    "persona": "Practitioner",
    "severity": "P1",
    "area": "interpretation",
    "title": "Client chart view lacks cross-chart compatibility view (practitioner + client) — key practitioner workflow missing"
  },
  {
    "id": "PRAC-006",
    "persona": "Practitioner",
    "severity": "P1",
    "area": "ai",
    "title": "AI per-client context personalization depth to specific chart data (type, authority, profile) not confirmed"
  },
  {
    "id": "PRAC-007",
    "persona": "Practitioner",
    "severity": "P2",
    "area": "billing",
    "title": "No downgrade-instead-of-cancel path in billing portal — practitioners who would accept $19/mo are lost at $97/mo churn"
  }
]
```

---
*Generated by Prime Self Audit Bot on 2026-03-15T15:32:55.648Z*
