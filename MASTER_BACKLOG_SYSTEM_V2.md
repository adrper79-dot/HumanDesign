# MASTER BACKLOG — System-Based Organization (Option C)

> **Version:** 2.0 — System-based consolidation (2026-03-17)  
> **Purpose:** Single source of truth for all backlog items across sprints, audits, and defects  
> **Organization:** By system/domain, then by priority and status  
> **Update Frequency:** Daily during active sprints; weekly otherwise  
> **Last Updated:** 2026-03-19

---

## 📋 Table of Contents

1. [Quick Summary](#quick-summary)
2. [Backend API & Workers](#backend-api--workers)
3. [Frontend UI & Client](#frontend-ui--client)
4. [Engine & Calculations](#engine--calculations)
5. [Database & Schema](#database--schema)
6. [Billing & Payments](#billing--payments)
7. [Practitioner Tools & Collaboration](#practitioner-tools--collaboration)
8. [Security & Authentication](#security--authentication)
9. [Operations & Infrastructure](#operations--infrastructure)
10. [Testing & Quality Assurance](#testing--quality-assurance)
11. [Documentation & Guides](#documentation--guides)
12. [Discord Bot & Community](#discord-bot--community)
13. [GTM & Growth Engineering](#gtm--growth-engineering)
14. [How to Update This Document](#how-to-update-this-document)

---

## Quick Summary

| Category | P0 | P1 | P2 | P3 | Total | Status |
|----------|----|----|----|----|-------|--------|
| Backend API | ✅ 1 | ✅ 2 | ✅ 4 | 2 | 9 | ✅ All fixed |
| Frontend | 0 | ✅ 5 + 🔄 2 + ❌ 5 | ✅ 3 + ⚠️ 4 + ❌ 4 | 2 | 25 | ❌ Guidance + gap workstream open |
| Engine | 0 | ✅ 1 | ✅ 2 | 1 | 4 | ✅ All closed |
| Database | 0 | 0 | ✅ 2 | 1 | 3 | ✅ Schema complete |
| Billing | ✅ 2 | 1 | 1 | 0 | 4 | ✅ P0 closed — Stripe IDs confirmed real |
| Practitioners | 0 | ✅ 2 + ❌ 1 | ✅ 2 | 1 | 6 | ❌ 1 new gap item open |
| Security | ✅ 1 | ✅ 6 | ✅ 2 | 0 | 9 | ✅ All P1 closed — CSP confirmed via _headers |
| Operations | ✅ 1 | ✅ 3 + ❌ 1 | ✅ 3 + ❌ 4 | 2 | 12 | ❌ 5 config/infra items open |
| Testing | 0 | ✅ 1 + ❌ 1 | ✅ 3 | 1 | 6 | ❌ 1 new gap item open |
| Documentation | 0 | 1 + ❌ 1 | 2 | 1 | 5 | ❌ 1 new gap item open |
| **Mobile** | 0 | ❌ 1 | 0 | 0 | 1 | ❌ New section — not started |
| **Discord Bot** | ✅ 1 + ❌ 1 | ✅ 1 + ❌ 2 | ❌ 1 | 0 | 6 | ❌ 4 open — domain + rate limit fixed; KV namespace + 3 enhancements pending |
| **GTM & Growth** | 0 | ✅ 2 + ❌ 4 | ❌ 8 | ❌ 3 | 17 | ❌ 15 open — annual pricing + trial days resolved; 4 P1 launch blockers remain |
| **TOTAL** | **5/7** | **25/53** | **27/57** | **11** | **117** | ❌ 35 items open — 5 resolved 2026-03-21 (Discord domain, rate limit, KV namespace/deploy, annual pricing, trial days) |

**New Open Items (2026-03-20 World-Class Gap Assessment):**
- ❌ **GAP-001** `BL-FRONTEND-P1-8` — Split app.js into modules + lazy-load tabs
- ❌ **GAP-002** `BL-FRONTEND-P1-9` — Consolidate to one CSS token system
- ❌ **GAP-003** `BL-FRONTEND-P2-8` — Fix WCAG AA contrast on 6 elements
- ✅ **GAP-004** `BL-TEST-P1-3` — Deterministic browser gate implemented; canonical launch enforcement now uses live `verify:prod:gate` against production
- ❌ **GAP-005** `BL-MOBILE-P1-1` — Native iOS + Android app (Capacitor)
- ✅ **GAP-006** `BL-SEC-P1-5` — Gene Keys legal closure
- ❌ **GAP-007** `BL-DOCS-P1-3` — Machine-generated API docs from router
- ❌ **GAP-008** `BL-PRACTITIONERS-P1-3` — Real-time collaborative practitioner sessions
- ✅ **GAP-009** `BL-FRONTEND-P1-10` — Guidance integrity architecture + loop plan for UI simplification without guidance loss

**New Open Items (2026-03-21 GTM Plan + Discord Evaluation):**
- ✅ **GTM-BL-1** `BL-DISCORD-P0-1` — Fix KV namespace ID placeholder (rate limiting broken)
- ✅ **GTM-BL-2** `BL-DISCORD-P0-2` — Replace primeselfengine.com → selfprime.net (9 occurrences fixed 2026-03-21)
- ✅ **GTM-BL-3** `BL-DISCORD-P1-1` — Raise rate limit 3 → 5/day (fixed 2026-03-21)
- ❌ **GTM-BL-4** `BL-DISCORD-P1-2` — Add /primself-start signup command
- ❌ **GTM-BL-5** `BL-DISCORD-P1-3` — Add GUILD_MEMBER_ADD welcome message
- ❌ **GTM-BL-6** `BL-DISCORD-P2-1` — Wire PRIME_SELF_API_SECRET for Phase 2
- ❌ **GTM-BL-7** `BL-GTM-P1-1` — Deploy Google OAuth + Apple Sign-In secrets
- ❌ **GTM-BL-8** `BL-GTM-P1-2` — Deploy Telnyx SMS secrets
- ✅ **GTM-BL-9** `BL-GTM-P1-3` — Annual Price IDs already in wrangler.toml (verified 2026-03-21)
- ✅ **GTM-BL-10** `BL-GTM-P1-4` — STRIPE_TRIAL_DAYS="14" added to wrangler.toml (2026-03-21)
- ❌ **GTM-BL-11** `BL-GTM-P1-5` — Implement practitioner_activated analytics event (2-part gate)
- ❌ **GTM-BL-12** `BL-GTM-P1-6` — Gate 1→Gate 2 drop-off email nudge (3-day delay)
- ❌ **GTM-BL-13** `BL-GTM-P2-1` — Hide Individual tier from marketing surfaces
- ❌ **GTM-BL-14** `BL-GTM-P2-2` — Add social proof section to landing page
- ❌ **GTM-BL-15** `BL-GTM-P2-3` — Set up UTM parameter tracking in Plausible
- ❌ **GTM-BL-16** `BL-GTM-P2-4` — Validate all 5 promo codes end-to-end
- ❌ **GTM-BL-17** `BL-GTM-P2-5` — Email nurture sequence setup (7 emails, 14-day trial arc)
- ❌ **GTM-BL-18** `BL-GTM-P2-6` — Post-purchase practitioner onboarding email sequence
- ❌ **GTM-BL-19** `BL-GTM-P2-7` — In-app bug/error submission form
- ❌ **GTM-BL-20** `BL-GTM-P2-8` — support@selfprime.net email alias + auto-responder
- ❌ **GTM-BL-21** `BL-GTM-P3-1` — /blog route for content marketing
- ❌ **GTM-BL-22** `BL-GTM-P3-2` — Reddit one-click share draft UI
- ❌ **GTM-BL-23** `BL-GTM-P3-3` — AI chatbot for in-app help

**New Issue Registry Entries (2026-03-21 GTM + Discord):**
- ❌ **GTM-001** — Discord KV namespace ID placeholder (P0 bug — requires wrangler CLI)
- ✅ **GTM-002** — Discord domain hardcoded to wrong domain (P0 bug — resolved 2026-03-21)
- ✅ **GTM-003** — Annual Stripe Price IDs (already in wrangler.toml — verified 2026-03-21)
- ✅ **GTM-004** — 14-day trial (STRIPE_TRIAL_DAYS="14" added to wrangler.toml 2026-03-21)
- ❌ **GTM-005** — practitioner_activated event missing (P1)
- ✅ **GTM-006** — robots.txt + sitemap.xml (already exist — verified 2026-03-21)
- ❌ **GTM-007** — Individual tier visible on marketing (P2)
- ❌ **GTM-008** — 5 promo codes not validated (P2)
- ❌ **GTM-009** — Trial nurture email sequence not configured (P2)
- ✅ **WC-001** `BL-BILLING-P0-2` — FALSE POSITIVE: Stripe Price IDs already configured (production wrangler.toml)
- ❌ **WC-002** `BL-FRONTEND-P1-14` — Implement full WCAG 2.1 AA ARIA skeleton
- ✅ **WC-003** `BL-SEC-P1-6` — FALSE POSITIVE: CSP fully implemented via frontend/_headers
- ❌ **WC-004** `BL-OPS-P1-4` — Implement APNs/FCM native push delivery
- ❌ **WC-005** `BL-OPS-P2-4` — Set CF_API_TOKEN + CF_ACCOUNT_ID for observability
- ❌ **WC-006** `BL-OPS-P2-5` — Configure Google OAuth secrets in Workers
- ❌ **WC-007** `BL-OPS-P2-6` — Configure Apple Sign-In secrets in Workers
- ❌ **WC-008** `BL-OPS-P2-7` — Set Telnyx SMS secrets in Workers

**Blocking Issues (MUST FIX before launch):**
- ✅ **BL-BACKEND-P0-1**: FIXED — Sentry error tracking now captures all register errors
- ✅ **BL-SEC-P0-1**: RESOLVED (2026-03-17) — Full rebrand to Energy Blueprint / Frequency Keys; all trademark references removed from live codebase
- ✅ **BL-OPS-P0-1**: AI Gateway URL was placeholder (FIXED 2026-03-14)

---

## Backend API & Workers

### 🔴 P0 — Critical Blockers

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-BACKEND-P0-1** | **Register endpoint returns 500 "Registration failed"** — Money-path canary failing; production deployment blocked. Enhanced error logging deployed (commit 0f02b5c); awaiting detailed error visibility from Cloudflare Worker logs. Issue flagged 2026-03-17 in fresh scan. | ✅ Fixed (2026-03-17) — Sentry integration captures all register errors with full context + stack traces | 15 min–02 days (depends on error details) | [Fresh Scan 2026-03-17](audits/SCAN_2026-03-17-FRESH.md) |

### 🟠 P1 — High Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-BACKEND-P1-1** | **`/api/cycles` returns 401 instead of 400 for missing params** — Marked PUBLIC but enforces auth in handler; param validation happens AFTER auth check. Same pattern as forecast (now fixed). Returns confusing 401 when params missing. | ✅ Fixed (2026-03-17) — Reordered: param validation BEFORE auth check | 30 min | [Finding: PUBLIC-AUTH-MISMATCH](audits/FINDING_2026-03-17-PUBLIC-AUTH-MISMATCH-REVISED.md) |
| **BL-BACKEND-P1-2** | **`/api/rectify` returns 401 instead of 400 for missing params** — Identical pattern to cycles. Auth check before param validation. | ✅ Fixed (2026-03-17) — Reordered: param validation BEFORE auth check | 30 min | [Finding: PUBLIC-AUTH-MISMATCH](audits/FINDING_2026-03-17-PUBLIC-AUTH-MISMATCH-REVISED.md) |

### 🟡 P2 — Medium Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-BACKEND-P2-1** | **Enhanced error logging may leak sensitive info in development mode** — Commit 0f02b5c added detailed error messages to register response when `ENVIRONMENT === 'development'`. Risk: if env var misconfigured, DB connection strings leak. Should use error code mapping instead. | ✅ Fixed (2026-03-17) — Safe error code mapping replaces raw error details | 30 min | [Scan 2026-03-17](audits/SCAN_2026-03-17-FRESH.md#item-2) |
| **BL-BACKEND-P2-2** | **Missing error telemetry for register failures** — No Sentry/error tracking integration. Can't categorize register errors (DB, hashing, duplicate email, etc.). Affects debugging ability. | ✅ Fixed (2026-03-17) — Sentry integration + error categorization in register handler | 1 day | [Scan 2026-03-17](audits/SCAN_2026-03-17-FRESH.md#item-3) |
| **BL-BACKEND-P2-3** | **No JSON parse error handling in handlers** — 5 handlers missing try/catch on `request.json()`. Malformed requests throw unhandled exceptions → 500 instead of 400. | ✅ Fixed (2026-03-04) | — | BACKLOG.md |
| **BL-BACKEND-P2-4** | **Rate limiting silently disabled when KV unavailable** — If `env.CACHE` unbound or KV outage, `rateLimit()` returns null. All limits gone including login brute-force. Fix: fail closed with 503. | ✅ Fixed (2026-07-17) | — | [Deep Dive Audit](audits/AUDIT_REMEDIATION_LOG.md) |

### 🟢 P3 — Low Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-BACKEND-P3-1** | **Dead code: `_lastChart` and `_lastForge` in logout** — Cleared on logout but chart/profile HTML containers retain previous data until re-render. | ✅ Fixed (2026-03-14) | — | MASTER_BACKLOG |
| **BL-BACKEND-P3-2** | **7 API endpoints implemented but documentation outdated** — `/api/auth/me`, `/api/chart/save`, `/api/chart/history`, `/api/cluster/list`, `/api/cluster/leave`, `/api/sms/subscribe`, `/api/sms/unsubscribe`. All working; docs need refresh. | 🔄 In Progress | 2 hrs | BACKLOG.md (BL-M1) |

---

## Frontend UI & Client

### 🟠 P1 — High Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-FRONTEND-P1-1** | **Birth data entered in Chart tab is now carried into AI Profile generation on tab handoff** — The core `Calculate → Synthesize` handoff is implemented non-destructively in the live tab switch flow. | ✅ Fixed (Cycle 17) | — | [Issue Registry: UX-005](audits/issue-registry.json) · [UX Re-Rank](audits/UX_RERANK_2026-03-17.md) |
| **BL-FRONTEND-P1-2** | **Post-chart CTA into AI Profile is live** — Chart results now earn the next step with an explicit "What's next?" card that moves the user into synthesis. | ✅ Fixed (Cycle 17) | — | [Issue Registry: UX-006](audits/issue-registry.json) · [UX Re-Rank](audits/UX_RERANK_2026-03-17.md) |
| **BL-FRONTEND-P1-3** | **Overview/welcome messaging is split by persona, but the static overview shell still needs alignment with the live dynamic state** — The runtime helper is present, but the first-load experience still depends on practitioner-first markup that can leak the wrong story before state settles. | ✅ Fixed (2026-03-18, Cycle 20) | — | [Issue Registry: UX-007](audits/issue-registry.json) · updateWelcomeMessage() now called on overview tab activation |
| **BL-FRONTEND-P1-4** | **Leaderboard still hides saved value behind a manual load button** — Diary, check-in stats, and achievements auto-load, but the leaderboard still needs an extra click that creates a false-negative impression about whether the tracking loop is working. | ✅ Fixed (2026-03-18, Cycle 20) | — | [Issue Registry: UX-008](audits/issue-registry.json) · loadLeaderboard() now auto-loads with achievements tab |
| **BL-FRONTEND-P1-5** | **Step-guide banner now routes to the real tracking and relationship flows** — The chart journey guide points to the live `checkin` and `composite` tabs again, so the guided activation path no longer dead-ends. | ✅ Fixed (2026-03-18) | — | [Issue Registry: UX-013](audits/issue-registry.json) |
| **BL-FRONTEND-P1-6** | **AI Profile and composite flows no longer ship with seeded sample birth defaults** — The profile handoff can now carry real chart data into synthesis, and practitioner compatibility no longer starts from stale example inputs. | ✅ Fixed (2026-03-18) | — | [Issue Registry: UX-014](audits/issue-registry.json) |
| **BL-FRONTEND-P1-7** | **AI Profile first-run experience now defaults to one obvious action** — Evaluation type, optional systems, and question targeting remain available, but they are staged behind an optional customize control instead of blocking the first synthesis. | ✅ Fixed (2026-03-18) | — | [Issue Registry: UX-015](audits/issue-registry.json) |
| **BL-FRONTEND-P1-8** | **Split `app.js` (11,819 lines) into tab controllers + lazy loading** — The 11,819-line monolith blocks code-splitting, makes per-tab changes risky, and forces every tab to parse and execute on first load. Extract 10 tab/domain controllers (auth, chart, profile, transit, practitioner, diary, billing, achievements, settings), create `state.js` and `core.js` as orchestrators, implement tab-activation lazy loading, and switch `index.html` to `<script type="module">`. Target: first-load JS payload reduced ≥25%; each controller < 1000 lines. See full plan at [docs/GAP_INTEGRATION_PLAN_2026-03-20.md](docs/GAP_INTEGRATION_PLAN_2026-03-20.md#gap-001). | ❌ Not Started | 3–5 days | [GAP-001](docs/GAP_INTEGRATION_PLAN_2026-03-20.md) |
| **BL-FRONTEND-P1-9** | **Consolidate three competing CSS token systems into one** — `design-tokens.css`, `design-tokens-premium.css`, and an inline `<style>` in `index.html` all define `:root {}` variables that override each other unpredictably. Create a single `frontend/css/tokens.css`, remove the other two files, strip the `:root {}` block from `index.html`, and update all 8 CSS component files to reference canonical token names. Simultaneously bump `--text-dim` to `#c4c0d8` and `--text-muted` to `#918db0` for WCAG compliance. See plan: [docs/GAP_INTEGRATION_PLAN_2026-03-20.md](docs/GAP_INTEGRATION_PLAN_2026-03-20.md#gap-002). | ❌ Not Started | 1 day | [GAP-002](docs/GAP_INTEGRATION_PLAN_2026-03-20.md) |
| **BL-FRONTEND-P1-10** | **Guidance integrity architecture must exist before broader UI simplification** — The product relies on dense explanatory surfaces because users are often unfamiliar with the domain. Before simplifying the shell, create a formal guidance architecture that separates persistent orientation, inline help, interpretation, next-step prompting, and deep-dive education so UI cleanup does not delete meaning. Deliver loop plan, source-of-truth rules, and migration protocol. See [docs/GUIDANCE_INTEGRITY_LOOP_PLAN_2026-03-20.md](docs/GUIDANCE_INTEGRITY_LOOP_PLAN_2026-03-20.md#gap-009--guidance-integrity-architecture). | ✅ Fixed (2026-03-21) — loop plan, reusable guidance system, glossary source, state machine, shell simplification, and regression harness are all in place; future UI cleanup can now use the documented guidance architecture safely | 1 sprint | [GAP-009](docs/GUIDANCE_INTEGRITY_LOOP_PLAN_2026-03-20.md) |
| **BL-FRONTEND-P1-11** | **Inventory all guidance surfaces and map every explanation to a source of truth** — Guidance currently lives in feature callouts, helper text, tooltips, banners, and result blocks across the SPA shell. Build a classification map so no future cleanup removes explanatory coverage accidentally. Deliver `docs/guidance-surface-map.md`, classify each node (`orientation`, `inline-help`, `interpretation`, `next-step`, `deep-dive`), and identify duplicates or drift. | ✅ Fixed (2026-03-20) — guidance surface map created at `docs/guidance-surface-map.md`; workflows, tooltip-only risks, source candidates, and top 20 drift areas documented for downstream loops | 1–2 days | [Issue Registry: GUIDE-001](audits/issue-registry.json) · [Loop Plan](docs/GUIDANCE_INTEGRITY_LOOP_PLAN_2026-03-20.md#guide-001--guidance-inventory--source-map) |
| **BL-FRONTEND-P1-12** | **Replace one-off explanatory blocks with reusable guidance components** — Create reusable UI surfaces for persistent orientation, compact helper text, term explanation, next-step cards, and optional deeper education. The chart and profile flows should adopt the new patterns first so future shell cleanup removes duplication without reducing support for unfamiliar users. | ✅ Fixed (2026-03-20) — chart and profile now use reusable guidance surfaces; component contract documented in `docs/guidance-component-system.md`; core field guidance no longer depends on tooltip-only delivery in these flows | 2–3 days | [Issue Registry: GUIDE-002](audits/issue-registry.json) · [Loop Plan](docs/GUIDANCE_INTEGRITY_LOOP_PLAN_2026-03-20.md#guide-002--reusable-guidance-surface-system) |
| **BL-FRONTEND-P1-13** | **Simplify navigation chrome without losing persistent guidance** — Reduce competing shell elements only after orientation is preserved by explicit guidance surfaces. Make the step guide contextual, consolidate account/admin chrome, and keep one always-visible answer to what this section is, why it matters, and what to do next. | ✅ Fixed (2026-03-21) — shared shell orientation strip added for guidance-light workflows, social proof limited to overview, and the core journey guide now follows chart/profile/transits/check-in/composite instead of living only in the chart tab | 2 days | [Issue Registry: GUIDE-003](audits/issue-registry.json) · [Loop Plan](docs/GUIDANCE_INTEGRITY_LOOP_PLAN_2026-03-20.md#guide-003--navigation-simplification-without-guidance-loss) |

### 🟡 P2 — Medium Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-FRONTEND-P2-1** | **Service Worker CACHE_VERSION stale (was v17)** — Multiple CSS/JS changes. Mobile/PWA users get stale layouts. | ✅ Fixed (2026-03-14) — bumped to v18 | — | MASTER_BACKLOG |
| **BL-FRONTEND-P2-2** | **Service Worker cache.addAll fails entirely if ONE asset 404s** — Use `Promise.allSettled()` for graceful degradation. | ✅ Fixed (2026-03-14) | — | MASTER_BACKLOG |
| **BL-FRONTEND-P2-3** | **CSS custom properties lack fallback values** — Browsers without CSS var support render nothing. Add `var(--gold, #d4aa57)` fallbacks. | ✅ Fixed (2026-03-14) — 13 tokens across 11 files | — | MASTER_BACKLOG |
| **BL-FRONTEND-P2-4** | **Chart results still expose key Prime Self terms without plain-language explanation** — Users can reach their chart and still not know what Soul Cross, Not-Self Theme, Split Definition, or Connection Pattern mean. | ✅ Fixed (2026-03-18, Cycle 22) — Enhanced `.explanation-text` CSS: darker text, thicker gold border, subtle background for improved visibility | 15 min | [Issue Registry: UX-009](audits/issue-registry.json) · CSS enhancement applied to frontend/css/app.css |
| **BL-FRONTEND-P2-5** | **Enhance tab asks for effort without clearly explaining the return** — Assessments materially improve synthesis quality, but the current copy does not make that exchange obvious. | ✅ Fixed (2026-03-18, Cycle 23) — Intro paragraph updated to explain assessments feed behavioral data into AI Profile synthesis | 30 min | [Issue Registry: UX-010](audits/issue-registry.json) |
| **BL-FRONTEND-P2-6** | **Check-in tooltips still contain outdated or inconsistent authority terminology** — Compliance and clarity issue; should be cleaned up without displacing activation-path work. | ✅ Fixed (2026-03-18, Cycle 23) — Tooltips updated with current Energy Blueprint terminology (Emotional Wave Navigation, Life Force Response, etc) | 15 min | [Issue Registry: UX-011](audits/issue-registry.json) |
| **BL-FRONTEND-P2-7** | **Onboarding naming and intro copy still undersell the feature and confuse first-time users** — `Restart Onboarding` implies prior use and the current intro hides the actual story structure. | ✅ Fixed (2026-03-18, Cycle 23) — Renamed to "The Savannah Arc", updated intro copy, changed nav icon (🧭→⊙), synced i18n across 5 locales | 30 min | [Issue Registry: UX-012](audits/issue-registry.json) |
| **BL-FRONTEND-P1-14** | **Implement WCAG 2.1 AA ARIA skeleton — tab roles, modal roles, form labels, landmarks, skip link, arrow-key nav, touch targets, SVG alt all missing** — The current frontend has no `role="tab"` on tab buttons, no `role="dialog"` on modals, no `aria-label` on form inputs, no `<main>/<nav>/<aside>` landmarks, no skip-to-main link, no arrow-key navigation on tab panels, touch targets on help icons under 44px, and the bodygraph SVG has no `role="img"` or `aria-label`. This is the single largest gap between current state and WCAG 2.1 AA compliance. Fix (8 sub-tasks): (1) Add `role="tab"`, `aria-selected`, `aria-controls` to tab buttons; (2) Add `role="dialog"`, `aria-modal`, `aria-labelledby` to modals + implement focus trap; (3) Add `aria-label` or `<label>` to all form inputs; (4) Add landmark elements to `index.html`; (5) Add visually-hidden skip-to-main link; (6) Implement arrow-key navigation per ARIA APG; (7) Expand touch targets to 44×44px; (8) Add `role="img"` + `aria-label` to SVG wheel. Acceptance: axe-core 0 critical/serious. Linked: [Issue WC-002](audits/issue-registry.json). Pre-req: ship BL-FRONTEND-P2-8 (contrast) concurrently. | ❌ Not Started | 2–3 days | [WC Assessment 2026-03-21](audits/issue-registry.json) |
| **BL-FRONTEND-P2-8** | **WCAG AA contrast failures on 6 core UI elements** — Six selectors fail the 4.5:1 minimum: `.data-label` (~4.2:1), `.data-block h4` (~4.2:1), `.text-muted` (~3.1:1), `.history-meta` (~2.4:1), `.raw-toggle` (~2.6:1), and transit planet labels (~4.2:1). Fix: bump `--text-dim` from `#b0acc8` → `#c4c0d8`; bump `--text-muted` from `#7a76a0` → `#918db0`. See [docs/GAP_INTEGRATION_PLAN_2026-03-20.md](docs/GAP_INTEGRATION_PLAN_2026-03-20.md#gap-003). Prerequisite for BL-FRONTEND-P1-9 (CSS consolidation). **Can ship independently in 2 hours.** | ❌ Not Started | 2 hours | [GAP-003](docs/GAP_INTEGRATION_PLAN_2026-03-20.md) |
| **BL-FRONTEND-P2-9** | **Canonical glossary and term explainer source of truth is missing** — Terms like type, authority, centers, channels, timing concepts, and practitioner workflow labels are explained in multiple ways across the product. Create one canonical term registry with plain-language meaning, why-it-matters sentence, deeper explanation, and approved aliases so guidance compounds instead of drifting by tab. | ✅ Fixed (2026-03-20) — canonical term registry and alias resolution added in `frontend/js/explanations.js`; live chart/profile explanation surfaces now consume the shared glossary source; registry documented in `docs/guidance-glossary-registry.md` | 1 day | [Issue Registry: GUIDE-004](audits/issue-registry.json) · [Loop Plan](docs/GUIDANCE_INTEGRITY_LOOP_PLAN_2026-03-20.md#guide-004--canonical-glossary--term-explainer-source-of-truth) |
| **BL-FRONTEND-P2-10** | **Guidance is not yet state-aware by persona and journey stage** — First-time personal users, returning users, and practitioners should not all receive the same expanded surfaces. Define deterministic rules for when guidance is expanded, compressed, or replaced with a summary-plus-expand affordance, without ever removing access to meaning or next-step coaching. | ✅ Fixed (2026-03-21) — deterministic guidance state machine now drives overview, chart, profile, and practitioner surfaces; returning practitioners get compressed checklist disclosure; state model documented in `docs/guidance-state-machine.md` | 1–2 days | [Issue Registry: GUIDE-005](audits/issue-registry.json) · [Loop Plan](docs/GUIDANCE_INTEGRITY_LOOP_PLAN_2026-03-20.md#guide-005--state-aware-guidance-by-persona--journey-stage) |
| **BL-FRONTEND-P2-11** | **No guidance regression harness exists for repeated UI cleanup loops** — Layout changes can currently ship without any check that users still know what a screen is for, what unfamiliar terms mean, or what to do next. Create a guidance regression checklist and deterministic validation protocol for core journeys before the UI cleanup loop expands. | ✅ Fixed (2026-03-21) — added checklist, deterministic manual script, and automated Vitest guard in `tests/guidance-regression.test.js`; validated with `npm run test:guidance` | 1 day | [Issue Registry: GUIDE-006](audits/issue-registry.json) · [Loop Plan](docs/GUIDANCE_INTEGRITY_LOOP_PLAN_2026-03-20.md#guide-006--guidance-regression-harness) |

### 🟢 P3 — Low Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-FRONTEND-P3-1** | **`window.DEBUG` flag never defined but used in logging** — Dead code; should either define flag or remove debug statements. | ✅ Fixed (2026-03-14) | — | MASTER_BACKLOG |
| **BL-FRONTEND-P3-2** | **Bodygraph gate badge overlap for 9+ gates on same center** — `GATE_OFFSETS` expanded to 12 positions to cover all 11 Throat gates. | ✅ Fixed (2026-03-14) | — | MASTER_BACKLOG |

---

## Engine & Calculations

### 🟠 P1 — High Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-ENGINE-P1-1** | **Jupiter/Saturn mutual perturbation missing** — Simple Keplerian has no perturbation terms. Saturn position error up to ~1° in some epochs. Fix: Standish 1992 Table 2 perturbation coefficients. | ✅ Fixed (2026-03-14) — Implemented Standish model; error now <0.1° | Research | MASTER_BACKLOG |

### 🟡 P2 — Medium Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-ENGINE-P2-1** | **Placidus house fallback to Equal House at polar latitudes is silent** — No user warning for high-latitude births (Iceland, Norway, Alaska). Frontend now checks `astro.polarWarning` and renders notice. | ✅ Fixed (2026-03-14) | — | MASTER_BACKLOG |
| **BL-ENGINE-P2-2** | **`parseToUTC` negative-minute bug** — When UTC offset < 1 hour, minute calculation fails: `-30 % 60 = -30`. Use `((utcTotalMinutes % 60) + 60) % 60`. | ✅ Fixed (2026-03-04) | — | BACKLOG.md (BL-C6) |

### 🟢 P3 — Low Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-ENGINE-P3-1** | **Ogham tree calendar Dec 23-24 boundary ambiguity** — Elder/Birch overlap. Birth on Dec 23-24 may map to wrong tree. | ✅ Fixed (2026-03-14) — explicit guards | — | MASTER_BACKLOG |
| **BL-ENGINE-P3-2** | **Moon E eccentricity unclamped for extreme dates** — Years < 1500 or > 2500 may have E outside [0, 1). Clamp to [0.9, 1.1]. | ✅ Fixed (2026-03-14) | — | MASTER_BACKLOG |

---

## Database & Schema

### 🟡 P2 — Medium Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-DATABASE-P2-1** | **Schema drift between `migrate.js` and `migrate.sql`** — Two migration sources produce incompatible schemas. Designate `migrate.sql` as source of truth. | ✅ Fixed (2026-03-04) — consolidated on `migrate.sql` | — | BACKLOG.md (BL-C3) |
| **BL-DATABASE-P2-2** | **Dead tables/views cleanup** — 5 unused tables identified; drop from schema and migration. Reduces cognitive load and improves schema hygiene. | ✅ Fixed (2026-03-14) — 37 migrations applied; all 54 tables needed | — | MASTER_BACKLOG |

### 🟢 P3 — Low Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-DATABASE-P3-1** | **Composite indexes missing for common queries** — Some high-frequency queries lack supporting indexes. Add indexes on (user_id, created_at), (practitioner_id, active), etc. | ✅ Fixed (2026-03-14) — migration 034 | — | MASTER_BACKLOG |

---

## Billing & Payments

### 🔴 P0 — Critical Blockers

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-BILLING-P0-1** | **Referral claim race condition (double-spend)** — `handleClaimReward` reads `reward_granted === false`, issues Stripe credit, then marks granted. Two concurrent requests both pass → duplicate credits. Fix: atomic `UPDATE ... SET reward_granted = true WHERE reward_granted = false`. | ✅ Fixed (2026-07-17) | — | [Deep Dive Audit 2026-07-18](audits/AUDIT_REMEDIATION_LOG.md) |
| **BL-BILLING-P0-2** | ~~**Stripe Price IDs are placeholder strings — no subscription or one-time purchase can complete**~~ **— CLOSED: FALSE POSITIVE (2026-03-21)** Production `wrangler.toml` (lines 19–41) already has real Stripe Price IDs (`price_1T9DC4...` format) for all tiers. Test environment intentionally uses `price_test_*` placeholders. — All price env vars in `workers/wrangler.toml` (STRIPE_PRICE_INDIVIDUAL_MONTHLY etc.) are placeholders. Stripe checkout will return a 400 error until real Price IDs are created and configured. Fix: (1) Create 4 subscription Price objects ($19/$97/$349 monthly + annual) and 4 one-time products ($19/$29/$12/$299) in Stripe Dashboard. (2) Paste the resulting Price IDs into the corresponding env vars. (3) Redeploy. Linked: [Issue WC-001](audits/issue-registry.json). | ❌ Not Started | 20 min | [WC Assessment 2026-03-21](audits/issue-registry.json) |

### 🟠 P1 — High Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-BILLING-P1-1** | **Self-referral via Sybil accounts unmitigated** — Only checks `referrer.id !== user.id`. Attacker creates Account A (gets code) → Account B (applies code) → Account A claims $5. No IP, email domain, or account-age gates. | ✅ Fixed (2026-07-17) — Added IP/email domain/age checks | 2 hrs | [Deep Dive Audit 2026-07-18](audits/AUDIT_REMEDIATION_LOG.md) |
| **BL-BILLING-P1-2** | **Pricing truth mismatch between visible page and structured data** — The Agency JSON-LD description now matches the live pricing page by marking white-label portal, API access, custom webhooks, and dedicated support as coming soon instead of currently included. | ✅ Fixed (2026-03-19) | 1 hr | World-class hardening intake (2026-03-19) |

### 🟡 P2 — Medium Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-BILLING-P2-1** | **Billing webhook replay vulnerability** — Stripe events processed multiple times if webhook delivered twice (network retry, duplicate send). No idempotency check. Fix: track `stripe_event_id` in DB, skip if seen before. | ✅ Fixed (2026-07-17) | — | [Deep Dive Audit 2026-07-17](audits/AUDIT_REMEDIATION_LOG.md) |

---

## Practitioner Tools & Collaboration

### 🟠 P1 — High Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-PRACTITIONERS-P1-1** | **Gene Keys knowledgebase only 59% complete** — 38 of 64 Gene Keys populated; 26 empty. RAG context forces LLM to hallucinate or skip section. Generate remaining 26 using Opus batch. | ✅ Fixed (2026-03-17) — All 64 Gene Keys fully populated with shadow/gift/siddhi/archetype/message/contemplation | 4 hrs | BACKLOG.md (BL-M5) |
| **BL-PRACTITIONERS-P1-2** | **Compatibility launch from a client record now carries the practitioner/client handoff into the composite flow** — Launching from the practitioner workspace prefills available birth data for both sides and points directly to whichever fields are still missing. | ✅ Fixed (2026-03-18) | — | [Issue Registry: PRAC-016](audits/issue-registry.json) |
| **BL-PRACTITIONERS-P1-3** | **Real-time collaborative live session (practitioner + client co-view)** — Practitioners currently deliver readings async via PDF or screen share. Build a native live session feature using Cloudflare Durable Objects: practitioner opens a session from the client detail panel, shares a join link (8-hour TTL), client joins and sees the same chart tab the practitioner is viewing. Phase 1: chart sync + real-time note display. Phase 2: bodygraph pointer overlay, live AI synthesis streaming, session transcript auto-saved to `practitioner_session_notes`. New files: `workers/src/handlers/live-session.js`, `workers/src/durable-objects/LiveSession.js`, `frontend/js/live-session-client.js`. See plan: [docs/GAP_INTEGRATION_PLAN_2026-03-20.md](docs/GAP_INTEGRATION_PLAN_2026-03-20.md#gap-008). | ❌ Not Started | 4–6 weeks | [GAP-008](docs/GAP_INTEGRATION_PLAN_2026-03-20.md) |

### 🟡 P2 — Medium Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-PRACTITIONERS-P2-1** | **Practitioner tier never updated on upgrade** — When user upgrades tier via billing, `practitioners.tier` row not updated. Practitioner still sees old tier. | ✅ Fixed (2026-07-16) | — | [AUDIT_REMEDIATION_LOG](audits/AUDIT_REMEDIATION_LOG.md) |
| **BL-PRACTITIONERS-P2-2** | **Practitioner isolation not enforced in some endpoints** — Some endpoints accept `practitioner_id` param without verifying user owns it (IDOR). Audit to identify all affected endpoints. | ✅ Fixed (2026-03-17) — Verified in 2026-03-16 audit: note delete, AI context, client detail, PDF export all scoped to practitioner ownership | 4 hrs | [Practitioner Isolation Followup](audits/../memories/repo/practitioner-isolation-followup-2026-03-16.md) |

### 🟢 P3 — Low Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-PRACTITIONERS-P3-1** | **Cluster invite codes weak entropy** — `cluster_invite_code` generated with Math.random() (not crypto-random). Upgrade to `crypto.getRandomValues()`. | ✅ Fixed (2026-03-14) | — | MASTER_BACKLOG |
| **BL-PRACTITIONERS-P3-2** | **Admin cluster reassignment lacks audit log** — When admin moves practitioner to another cluster, no log entry. Practitioners can't trace when/why reassignment happened. | ⚠️ Deferred (Phase 2+) | — | — |

---

## Security & Authentication

### 🔴 P0 — Critical Blockers

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-SEC-P0-1** | **IP/Trademark resolved** — Rebranded all user-facing "Human Design" → "Energy Blueprint" and "Gene Keys" → "Frequency Keys" across 20+ files. Internal code identifiers and practitioner certification fields unchanged. | ✅ Resolved (2026-03-17) | Legal | MASTER_BACKLOG; [Launch Readiness](LAUNCH_READINESS_REPORT_2026.md) |
| **BL-SEC-P0-2** | **XSS in `renderCelebrityGrid()` — unescaped API data in innerHTML** — `celeb.name`, `celeb.field`, `celeb.type`, `celeb.authority`, `celeb.description` injected raw into template literals. Compromised API response = arbitrary script execution. | ✅ Fixed (2026-07-18) | — | [Deep Dive Phase 2 2026-07-18](audits/AUDIT_REMEDIATION_LOG.md) |

### 🟠 P1 — High Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-SEC-P1-1** | **Wildcard CORS origin with auth** — `Access-Control-Allow-Origin: '*'` allows any website to make authenticated requests with stolen tokens. Set origin to production domain or env var (allow `*` in dev only). | ✅ Fixed (2026-03-04) | — | BACKLOG.md (BL-M4) |
| **BL-SEC-P1-2** | **Password comparison is timing-attack vulnerable** — Uses `===` string comparison which short-circuits on first mismatch. Leaks timing information about hash. Use constant-time comparison. | ✅ Fixed (2026-07-17) | — | [Deep Dive Audit](audits/AUDIT_REMEDIATION_LOG.md) |
| **BL-SEC-P1-3** | **Admin token timing-attack vulnerable** — `provided === adminToken` in `promo.js` enables timing side-channel enumeration. Fix: constant-time comparison. | ✅ Fixed (2026-07-17) | — | [Deep Dive 2026-07-17](audits/AUDIT_REMEDIATION_LOG.md) |
| **BL-SEC-P1-4** | **Admin console persists a long-lived admin token in localStorage** — The admin token is now memory-only in the browser, cleared on refresh and sign-out, and the login UI explicitly documents the shorter-lived session model. The server-side constant-time admin checks remain unchanged. | ✅ Fixed (2026-03-19) | 1 day | World-class hardening intake (2026-03-19) |
| **BL-SEC-P1-6** | ~~**Content-Security-Policy (CSP) header missing from all frontend responses**~~ **— CLOSED: FALSE POSITIVE (2026-03-21)** CSP is fully implemented in `frontend/_headers` Cloudflare Pages header file with a comprehensive policy (script-src for Stripe/Plausible/CF Insights, connect-src, frame-ancestors: none, etc.). This is the correct location for CSP on a Cloudflare Pages-deployed SPA. — The Workers security-header middleware (`workers/src/index.js`) sets `X-Frame-Options`, `X-Content-Type-Options`, and `Strict-Transport-Security` but no `Content-Security-Policy`. Without CSP, the browser has no directive-level protection against injected scripts or stylesheets. Fix: add `Content-Security-Policy` header with: `default-src 'self'; script-src 'self' https://js.stripe.com https://browser.sentry-cdn.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://prime-self-api.adrper79.workers.dev; frame-ancestors 'none'`. Tighten `unsafe-inline` on style-src after BL-FRONTEND-P1-9 lands. Acceptance: `curl -I https://selfprime.net` returns CSP header; SecurityHeaders.com scores A. Linked: [Issue WC-003](audits/issue-registry.json). | ❌ Not Started | 4 hrs | [WC Assessment 2026-03-21](audits/issue-registry.json) |
| **BL-SEC-P1-5** | **Gene Keys IP/trademark legal closure** — The frontend rebrand replaced "Gene Keys" with "Frequency Keys" on customer-facing surfaces (BL-SEC-P0-1 resolved). However the knowledgebase corpus (`src/knowledgebase/genekeys/`) and internal synthesis prompts still reference Gene Keys methodology. Three possible outcomes from legal review: (1) fair use — add attribution to Terms; (2) disclaimer sufficient — add footer in synthesis output; (3) license required — negotiate or replace corpus. While review is pending, no additional Gene Keys content should be added. See plan: [docs/GAP_INTEGRATION_PLAN_2026-03-20.md](docs/GAP_INTEGRATION_PLAN_2026-03-20.md#gap-006). | ✅ Fixed (2026-03-21) — Outcome B implemented: legal brief corrected to separate triad-name exposure from internally authored prose, Terms attribution added, runtime disclaimer activated, freeze guard validated, and courtesy outreach template prepared | External | [GAP-006](docs/GAP_INTEGRATION_PLAN_2026-03-20.md) |

### 🟡 P2 — Medium Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-SEC-P2-1** | **Secrets file contains plaintext credentials** — `secrets` file at project root has Neon, Stripe (live), Anthropic, Groq, Telnyx, Discord, GitHub, Cloudflare keys. Gitignored (never committed) but unencrypted on disk. Use 1Password/Vault; rotate if machine compromised. | ⚠️ Pending | 2 hrs | MASTER_BACKLOG (PRA-SEC-001) |
| **BL-SEC-P2-2** | **JWT issuer/audience hardcoded** — Both staging and production use same issuer/audience, allowing cross-environment token replay. | ✅ Fixed (2026-03-14) — env-specific via jwtClaims(env) | — | MASTER_BACKLOG (PRA-SEC-002) |
| **BL-SEC-P2-3** | **Unescaped API data in checkin history** — `d.date` and `d.alignmentScore` in `ui-nav.js` innerHTML lack `escapeHtml()`. Safe in practice but inconsistent. | ✅ Fixed (2026-07-17) | — | [Deep Dive 2026-07-17](audits/AUDIT_REMEDIATION_LOG.md) |

---

## Operations & Infrastructure

### 🔴 P0 — Critical Blockers

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-OPS-P0-1** | **AI Gateway URL was placeholder** — `AI_GATEWAY_URL=https://selfprime.net` did NOT point to Cloudflare AI Gateway. LLM calls bypassed all rate limiting/caching/observability. | ✅ Fixed (2026-03-14) — Gateway `prime-self` created; URL is `https://gateway.ai.cloudflare.com/v1/a1c8a33cbe8a3c9e260480433a0dbb06/prime-self` | 30 min | MASTER_BACKLOG (PRA-OPS-001) |

### 🟠 P1 — High Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-OPS-P1-1** | **No admin dashboard** — Promo codes, experiments, analytics, user management require raw API calls. No internal tools UI. | ✅ Fixed (2026-03-14) — `/admin.html` with stats, user search, promo CRUD; backend `admin.js` handler | — | MASTER_BACKLOG (PRA-OPS-003) |
| **BL-OPS-P1-2** | **PRIME_SELF_API_SECRET is placeholder** — Value literally `REPLACE_WITH_STRONG_RANDOM_SECRET_...`. Discord Worker ↔ Main API auth uses this. | ✅ Fixed (2026-03-14) — Real secret generated and deployed | 15 min | MASTER_BACKLOG (PRA-OPS-002) |
| **BL-OPS-P1-4** | **APNs and FCM native push delivery unimplemented — iOS and Android devices receive no push notifications** — `workers/src/handlers/push.js` contains a TODO comment at the APNs/FCM dispatch point. Web push via VAPID works for PWA/browser users. Native iOS and Android devices (required by BL-MOBILE-P1-1) need APNs JWT-signed HTTP/2 delivery and FCM v1 HTTP delivery respectively. Fix: implement both delivery paths inside the existing `sendPushNotification()` function, detect device type from the subscription record, add dead-token cleanup on 410 responses, and configure `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `FCM_SERVER_KEY` as Workers secrets. Acceptance: iOS and Android test devices receive transit digest notification. Linked: [Issue WC-004](audits/issue-registry.json). Dependency: BL-MOBILE-P1-1 (native app) for end-to-end device delivery. | ❌ Not Started | 1–2 days | [WC Assessment 2026-03-21](audits/issue-registry.json) |
| **BL-OPS-P1-3** | **Operational status signals disagree across vitals, known-issues baseline, and summary scripts** — The audit output now separates live registry issues from historical references, and vitals-only runs no longer auto-resolve registry items. Summary counts, current-open sections, and loop scripts now agree on active issue totals. | ✅ Fixed (2026-03-19) | 2 hrs | World-class hardening intake (2026-03-19) |

### 🟡 P2 — Medium Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-OPS-P2-1** | **2FA not implemented** — No TOTP/SMS 2FA. Birth data + psychometric scores protected only by password. | ⚠️ Deferred (Phase 2+) | 2 days | MASTER_BACKLOG (PRA-OPS-004) |
| **BL-OPS-P2-2** | **No error rate dashboards** — No Sentry, DataDog, or centralized error tracking. Production bugs are invisible until user reports. | ✅ Fixed (2026-03-17) — Sentry integration captures all errors with dashboard visibility | 1 day | [Scan 2026-03-17](audits/SCAN_2026-03-17-FRESH.md) |
| **BL-OPS-P2-3** | **Service Worker out of sync detection missing** — App may serve stale code after deploy until user refreshes cache. No "update available" prompt. | ⚠️ Deferred (Phase 2+) | 4 hrs | — |
| **BL-OPS-P2-4** | **CF_API_TOKEN and CF_ACCOUNT_ID not configured — Cloudflare analytics metrics unavailable in audit output** — The audit vitals script calls the Cloudflare Analytics API, but neither `CF_API_TOKEN` nor `CF_ACCOUNT_ID` is set in `.env.local` or Workers secrets. This leaves production request rates, error rates, and Workers CPU metrics invisible. Fix: create a Cloudflare API token with Analytics:Read + Workers Analytics Engine:Read, add to both `.env.local` and as Workers secrets via `wrangler secret put`. Acceptance: `npm run audit:vitals` reports CF Metrics with real values. Linked: [Issue WC-005](audits/issue-registry.json). | ❌ Not Started | 15 min | [WC Assessment 2026-03-21](audits/issue-registry.json) |
| **BL-OPS-P2-5** | **Google OAuth secrets not configured in Workers production environment — Google Sign-In non-functional** — `workers/src/handlers/oauthSocial.js` handler is complete and tested. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not deployed as Workers secrets. Fix: create OAuth 2.0 credentials in Google Cloud Console, add authorized redirect URIs (selfprime.net + worker origin), run `wrangler secret put GOOGLE_CLIENT_ID` and `wrangler secret put GOOGLE_CLIENT_SECRET`. Acceptance: Google Sign-In completes OAuth flow in production; new users appear with `provider=google`. Linked: [Issue WC-006](audits/issue-registry.json). | ❌ Not Started | 30 min | [WC Assessment 2026-03-21](audits/issue-registry.json) |
| **BL-OPS-P2-6** | **Apple Sign-In secrets not configured in Workers production environment — Apple Sign-In non-functional** — `workers/src/handlers/oauthSocial.js` handler is complete. `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` are not deployed as Workers secrets. Fix: create a Sign In with Apple Service ID at developer.apple.com, generate a .p8 private key, verify the domain, then `wrangler secret put` each secret. APPLE_PRIVATE_KEY must preserve newlines. Acceptance: Apple Sign-In completes in production. Linked: [Issue WC-007](audits/issue-registry.json). | ❌ Not Started | 1 hr | [WC Assessment 2026-03-21](audits/issue-registry.json) |
| **BL-OPS-P2-7** | **TELNYX_API_KEY and TELNYX_PHONE_NUMBER not set as Workers secrets — SMS delivery non-functional in production** — `workers/src/handlers/sms.js` is fully implemented. Keys exist in `.env.local` but have never been deployed to Workers secrets. Fix: `wrangler secret put TELNYX_API_KEY` and `wrangler secret put TELNYX_PHONE_NUMBER` using values from `.env.local`, then redeploy. Acceptance: SMS opt-in confirmation and transit digest delivery work in production. Linked: [Issue WC-008](audits/issue-registry.json). | ❌ Not Started | 20 min | [WC Assessment 2026-03-21](audits/issue-registry.json) |

### 🟢 P3 — Low Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-OPS-P3-1** | **CSP missing `frame-ancestors` directive** — X-Frame-Options: DENY present but CSP should include frame-ancestors. | ✅ Fixed (2026-03-14) | — | MASTER_BACKLOG (PRA-SEC-004) |
| **BL-OPS-P3-2** | **HSTS missing `preload` directive** — Cannot submit to browser preload lists. | ✅ Confirmed (already set) | — | MASTER_BACKLOG (PRA-SEC-003) |

---

## Testing & Quality Assurance

### 🟠 P1 — High Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-TEST-P1-1** | **Production gate tests incomplete** — Only 15/17 checks passing (register 500 blocker). Once fixed, should add cycles + rectify param validation tests. | ✅ Fixed (2026-03-17) — Added cycles + rectify param validation tests to `verify-money-path.js` | 20 min | [Scan 2026-03-17](audits/SCAN_2026-03-17-FRESH.md) |
| **BL-TEST-P1-2** | **Release gate not trustworthy — onboarding timing and Playwright auth smoke are out of sync** — The app delays first-run modal display while the end-to-end pack relies on timing-sensitive dismissal around login. Release-safe auth coverage should be deterministic, env-backed, and explicitly part of the gate. | ⚠️ Superseded by BL-TEST-P1-3 (2026-03-20) | 1 day | World-class hardening intake (2026-03-19) |
| **BL-TEST-P1-3** | **Implement deterministic E2E release gate with `?e2e=1` bypass and dedicated gate config** — Create `tests/e2e/auth-gate.spec.ts` and `tests/e2e/smoke-gate.spec.ts` using env-backed credentials (`E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`) and a `?e2e=1` URL param that skips the first-run modal. Create `playwright.gate.config.ts` (runs only the two gate specs; no retries). Add `npm run test:gate` script. Wire CI to block deploy when gate fails. Closes BL-TEST-P1-2. See plan: [docs/GAP_INTEGRATION_PLAN_2026-03-20.md](docs/GAP_INTEGRATION_PLAN_2026-03-20.md#gap-004). | ✅ Fixed (2026-03-21) — Browser gate specs/config/script exist; production deploy and canary workflows enforce the broader live `npm run verify:prod:gate -- --strict-browser` standard against `https://selfprime.net`; analytics audit checks now join the live gate when `AUDIT_SECRET` is present. | 1–2 days | [GAP-004](docs/GAP_INTEGRATION_PLAN_2026-03-20.md) |

### 🟡 P2 — Medium Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-TEST-P2-1** | **No test coverage reporting** — vitest.config.js lacks `coverage` configuration. No visibility into untested code paths. | ✅ Fixed (2026-03-14) | — | MASTER_BACKLOG (PRA-TEST-001) |
| **BL-TEST-P2-2** | **JWT verification not tested end-to-end** — All auth tests mock `getUserFromRequest`. Real JWT expiry, invalid signature, claim validation untested. | ✅ Fixed (2026-03-14) — 18 tests added | 1 day | MASTER_BACKLOG (PRA-TEST-002) |
| **BL-TEST-P2-3** | **No load/stress testing infrastructure** — No k6, Artillery, or concurrent user simulation. | ✅ Fixed (2026-03-14) — `tests/load-test.k6.js` created | 1 day | MASTER_BACKLOG (PRA-TEST-003) |

### 🟢 P3 — Low Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-TEST-P3-1** | **i18n translation quality unverified** — 5 locale files exist (EN, FR, ES, DE, PT). Non-English translations may be machine-generated. | ✅ Audited (2026-03-14) — All 4 non-EN locales: 21/21 keys, correct terminology | 2 days | MASTER_BACKLOG (PRA-OPS-005) |

---

## Documentation & Guides

### 🟠 P1 — High Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-DOCS-P1-1** | **API documentation outdated** — 7 endpoints implemented but docs not refreshed. Coverage: 87% (46/53 documented). Gap: chart operations, SMS API. | 🔄 In Progress | 2 hrs | BACKLOG.md (BL-M1 cont.) |
| **BL-DOCS-P1-3** | **Machine-generate API docs from the router as single source of truth** — `docs/API.md` and `docs/openapi.json` drift from `workers/src/index.js` within days of any handler addition. Create `scripts/generate-api-docs.js` that parses the router and outputs `docs/API_GENERATED.md` (Markdown table: Method / Path / Auth / Tier / Handler) and `docs/openapi-generated.json` (OpenAPI 3.0.3 skeleton). Add `npm run docs:api` and `npm run docs:api:check` scripts. Wire `docs:api:check` to CI so out-of-sync docs fail the build. Closes BL-DOCS-P1-1. See plan: [docs/GAP_INTEGRATION_PLAN_2026-03-20.md](docs/GAP_INTEGRATION_PLAN_2026-03-20.md#gap-007). | ❌ Not Started | 1 day | [GAP-007](docs/GAP_INTEGRATION_PLAN_2026-03-20.md) |
| **BL-DOCS-P1-2** | **Public terminology and legal plan naming drift remain in active customer copy** — Referral, share, gift, and Terms copy now use Energy Blueprint and Agency naming on the audited customer-facing surfaces that were still drifting. | ✅ Fixed (2026-03-19) | 2 hrs | World-class hardening intake (2026-03-19) |

### 🟡 P2 — Medium Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-DOCS-P2-1** | **Deployment guide assumes Vercel** — References `vercel deploy` but actual deployment is Cloudflare Workers. Confusing for new team members. | ✅ Fixed (2026-03-17) — DEPLOY.md correctly documents Cloudflare Workers (no Vercel references) | 1 hr | — |
| **BL-DOCS-P2-2** | **Gene Keys descriptions incomplete** — 26 of 64 keys missing custom descriptions. RAG fallback works but less targeted. | ✅ Fixed (2026-03-17) — Duplicate of BL-PRACTITIONERS-P1-1 (all 64 keys complete) | 4 hrs | BACKLOG.md (BL-M5) |

### 🟢 P3 — Low Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-DOCS-P3-1** | **Architecture diagram out of sync** — References old database schema, Stripe integration flow needs update post-2FA. | ⚠️ Deferred (Phase 2+) | 2 hrs | — |

---

---

## Mobile & Distribution

### 🟠 P1 — High Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-MOBILE-P1-1** | **Native iOS + Android app via Capacitor** — Prime Self competes with Co-Star and Pattern for the D2C spiritual wellness audience — both of which grow primarily through App Store discovery. Build a Capacitor wrapper around the existing SPA: `npx cap init`, add iOS + Android platforms, configure `primeself://` deep links for OAuth, replace VAPID web push with native APNs/FCM via `@capacitor/push-notifications`, integrate RevenueCat for IAP subscriptions (maps to existing 4 tiers), submit to App Store + Google Play. No rewrite needed — Capacitor wraps the current web app in a WebView. Phased: scaffold (wk1-2) → native features (wk2-3) → IAP (wk3-4) → beta with practitioners (wk5-6) → store submission (wk7-8) → launch (wk9-10). New files: `capacitor.config.json`, `frontend/js/native-bridge.js`, `workers/src/handlers/revenuecat-webhook.js`. ADR: [docs/ADR-001-mobile-distribution-v1.md](docs/ADR-001-mobile-distribution-v1.md). See plan: [docs/GAP_INTEGRATION_PLAN_2026-03-20.md](docs/GAP_INTEGRATION_PLAN_2026-03-20.md#gap-005). | ❌ Not Started | 6–10 weeks | [GAP-005](docs/GAP_INTEGRATION_PLAN_2026-03-20.md) |

---

## Discord Bot & Community

> **Context:** Prime Self has a deployed Cloudflare Worker-based Discord bot at `discord/`. The bot handles the `/primself` slash command, generates chart embeds, enforces rate limiting via KV, and links users back to selfprime.net. Social strategy is Discord-first (X and Facebook dropped). Bot is deployed independently via `wrangler deploy` from the `discord/` directory.

### 🔴 P0 — Critical Blockers

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-DISCORD-P0-1** | **Discord Worker KV namespace ID is a placeholder — rate limiting completely broken in production** — `discord/wrangler.toml` has `id = "REPLACE_WITH_KV_NAMESPACE_ID"` under the `RATE_LIMITS` KV binding. Without a real namespace ID, the Worker cannot read or write rate limit counters. Every user can fire unlimited `/primself` requests with no throttling. Fix: run `wrangler kv:namespace create RATE_LIMITS` from `discord/`, paste the resulting namespace ID into `wrangler.toml`, redeploy. **Journey/Job:** Discord community user → run chart command within fair-use limits. **Signal:** Rate limit embed appears after 3 uses instead of generating infinite charts. **Why It Matters:** Unlimited requests expose the API to abuse and incur unbounded Cloudflare AI Gateway costs. **Linked Issue:** [GTM-001](audits/issue-registry.json). | ✅ Resolved 2026-03-21 | 15 min | [Discord Evaluation 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-DISCORD-P0-2** | **All Discord bot CTAs and embeds hard-coded to `primeselfengine.com` — wrong domain in production** — `discord/src/index.js` has 4 occurrences of `primeselfengine.com`: `EMBED_FOOTER` text (~line 55), `THUMBNAIL_URL` (~line 57), `ctaUrl` builder (~line 316), and error message fallback. The live domain is `selfprime.net`. Every embed the bot sends drives users to a non-existent domain. Fix: global replace `primeselfengine.com` → `selfprime.net` in `discord/src/index.js`, redeploy. **Journey/Job:** Discord community user → click embed CTA → land on selfprime.net. **Signal:** New Discord-attributed signups appear in Plausible with `utm_source=discord`. **Why It Matters:** Zero conversions from Discord until domain is correct. **Linked Issue:** [GTM-002](audits/issue-registry.json). | ✅ Resolved 2026-03-21 | 15 min | [Discord Evaluation 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |

### 🟠 P1 — High Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-DISCORD-P1-1** | **Rate limit of 3 uses per user per day is too restrictive for viral community growth** — `RATE_LIMIT_MAX = 3` in `discord/src/index.js`. Best-in-class community bots allow 5–10 daily uses. A new user discovering the bot may want to run their chart plus a partner's and a friend's in one session. Bump to 5/day. **Journey/Job:** Discord community user → run multiple charts in one session without hitting a wall. **Signal:** Rate-limit complaint rate drops; average uses-per-new-user increases. **Why It Matters:** Early community members who hit the wall immediately will churn and not return. | ✅ Resolved 2026-03-21 | 5 min | [Discord Evaluation 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-DISCORD-P1-2** | **No `/primself-start` slash command — no direct signup CTA from within Discord** — The bot only has `/primself` (run a chart). A second command `/primself-start` would acknowledge intent, drop a personalized invite link with `utm_source=discord&utm_campaign=slash_signup`, and direct the user to the Prime Self onboarding flow. Implementation: add command to `discord/scripts/register-commands.js`, handle in `discord/src/index.js` to return an embed with signup URL + 14-day trial messaging. **Journey/Job:** Discord community user (already engaged with bot) → convert to paid trial subscriber. **Signal:** UTM-attributed signups from `utm_campaign=slash_signup` appear in analytics. **Why It Matters:** Without a signup command, Discord traffic is top-of-funnel with no conversion on-ramp inside the platform. | ❌ Not Started | 2 hrs | [Discord Evaluation 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-DISCORD-P1-3** | **No GUILD_MEMBER_ADD welcome message — new server joiners receive no orientation** — When a new user joins a server where the bot is installed, no welcome message is sent. A `GUILD_MEMBER_ADD` event handler in `discord/src/index.js` should send a DM or channel message introducing the bot: what it does, how to use `/primself`, and a link to selfprime.net with a welcome UTM. **Journey/Job:** New Discord community member → discover Prime Self within 60 seconds of joining. **Signal:** Increase in chart runs within 1 hour of server join. **Why It Matters:** First impression in a new server defines whether users explore or ignore the bot. | ❌ Not Started | 3 hrs | [Discord Evaluation 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |

### 🟡 P2 — Medium Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-DISCORD-P2-1** | **`PRIME_SELF_API_SECRET` not wired for Phase 2 practitioner commands** — `discord/wrangler.toml` defines `PRIME_SELF_API_URL` but the `PRIME_SELF_API_SECRET` wrangler secret must be set via `wrangler secret put` before any authenticated API calls (e.g., a future `/primself-portal` practitioner command that fetches client data). Currently unused in Phase 1 (chart generation is anonymous), but Phase 2 practitioner features depend on it. Set the secret now while deployment is fresh. **Journey/Job:** Phase 2 — Practitioner → fetch their client chart from Discord for a live reading session. **Signal:** Future authenticated Discord commands complete without 401 errors. **Why It Matters:** Prevents having to revisit secrets wiring during a time-critical Phase 2 sprint. | ❌ Not Started | 10 min | [Discord Evaluation 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |

---

## GTM & Growth Engineering

> **Context:** Based on the GTM Plan created 2026-03-21 (`docs/GTM_PLAN_2026-03-21.md`). 7 strategic decisions resolved: self-serve support, 14-day trial, Individual tier hidden from marketing, 2-part activation gate, Discord+Reddit social channels, 20% annual discount available Day 1, Product Hunt launch at Week 12.

### 🟠 P1 — High Priority (Blockers for Launch)

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-GTM-P1-1** | **Google OAuth and Apple Sign-In secrets not deployed — social login buttons are non-functional** — `workers/src/handlers/oauthSocial.js` handler is complete. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` are not deployed as Workers secrets. Social sign-in is a GTM Day 1 friction reducer for new practitioner signups. Fix: create OAuth 2.0 credentials in Google Cloud Console + Apple Developer portal, run `wrangler secret put` for each. **Signal:** New users completing signup via Google/Apple button instead of email/password; lower registration abandonment rate. **Linked Issues:** [WC-006](audits/issue-registry.json), [WC-007](audits/issue-registry.json). | ❌ Not Started | 1 hr | [WC Assessment 2026-03-21](audits/issue-registry.json) |
| **BL-GTM-P1-2** | **Telnyx SMS secrets not deployed — SMS transit digests and opt-in confirmation non-functional** — `TELNYX_API_KEY` and `TELNYX_PHONE_NUMBER` exist in `.env.local` but have never been deployed to Workers secrets. SMS is a retention feature in the GTM plan: practitioners subscribe to receive daily transit digests. Fix: `wrangler secret put TELNYX_API_KEY` and `wrangler secret put TELNYX_PHONE_NUMBER` from the `workers/` directory, then redeploy. **Signal:** SMS opt-in completions and daily digest sends tracked in analytics. **Linked Issue:** [WC-008](audits/issue-registry.json). | ❌ Not Started | 20 min | [WC Assessment 2026-03-21](audits/issue-registry.json) |
| **BL-GTM-P1-3** | **Stripe Annual Price IDs not created — annual subscription plan is not purchasable at launch** — Annual pricing (20% off monthly) is a GTM Day 1 decision. Practitioner annual = $933.60/yr; Agency annual = $3,350.40/yr. Both must be Stripe `interval=year` Price objects. Add `STRIPE_PRICE_PRACTITIONER_ANNUAL` and `STRIPE_PRICE_AGENCY_ANNUAL` to `workers/wrangler.toml`. Billing handler already supports `billingPeriod='annual'` path. **Signal:** Annual checkout sessions created successfully; first annual subscriber converts. **Linked Issue:** [GTM-003](audits/issue-registry.json). | ✅ Resolved 2026-03-21 | 30 min | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-GTM-P1-4** | **14-day free trial not configured in Stripe — trial period is not enforced for new subscribers** — The GTM decision specifies a 14-day free trial as the primary acquisition mechanic. Stripe checkout must pass `trial_period_days: 14` in session creation. User gets full access immediately; billing starts Day 15. Must track `trial_end` date in user record for in-app countdown messaging. **Signal:** Stripe subscriptions show `status=trialing` for first 14 days; Day 14 conversion rate becomes measurable. **Linked Issue:** [GTM-004](audits/issue-registry.json). | ✅ Resolved 2026-03-21 | 2 hrs | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-GTM-P1-5** | **`practitioner_activated` analytics event missing — 2-part activation gate is untracked** — The GTM activation definition: Gate 1 = paid subscription active, Gate 2 = at least 1 client added and confirmed. Fire `practitioner_gate1_completed`, `practitioner_gate2_completed`, and `practitioner_activated` to Plausible. Store `activated_at` in DB. Gate 1→Gate 2 drop-off rate is the primary retention KPI in the GTM plan. **Signal:** Plausible goals dashboard shows activation funnel with Gate 1/Gate 2 events; drop-off rate visible within 48 hours of launch. **Linked Issue:** [GTM-005](audits/issue-registry.json). | ❌ Not Started | 4 hrs | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-GTM-P1-6** | **Gate 1→Gate 2 drop-off email nudge not implemented — practitioners who pay but never add a client receive no prompt** — If a practitioner completes Gate 1 (paid) but has not completed Gate 2 (first client added) after 3 days, trigger an email: "You're in — now bring your first client." Include a direct deep-link to the practitioner workspace's "Add Client" flow. Trigger via a Cloudflare scheduled task or Resend delayed send on the `subscription.activated` webhook event. **Signal:** Gate 1→Gate 2 conversion rate improves by ≥10% vs no-nudge baseline. **Why It Matters:** The dead zone between signup and first use is the highest churn risk in the GTM funnel. | ❌ Not Started | 3 hrs | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |

### 🟡 P2 — Medium Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-GTM-P2-1** | **Individual tier ($19/mo) visible on marketing landing page — violates GTM positioning decision** — GTM decision: Individual tier hidden from marketing to enforce practitioner-first narrative. The Practitioner ($97) and Agency ($349) tiers should be the only prominently displayed plans. Individual tier remains accessible at `/pricing` for users who navigate directly. Remove Individual card from landing page pricing grid and any marketing email templates. **Signal:** Marketing page shows 2 plans only; no user feedback asking "what happened to the $19 plan." **Linked Issue:** [GTM-007](audits/issue-registry.json). | ❌ Not Started | 1 hr | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-GTM-P2-2** | **No social proof section on landing page — no testimonials, user counts, or practitioner quotes** — The GTM plan identifies social proof as a Week 2 deliverable. Landing page needs: practitioner count (even if small), 2–3 beta practitioner quotes, and the "used in X sessions" stat from analytics. Placeholder section to be populated as real data arrives. Build the section shell now; copy ships when data is available. **Signal:** Time-on-page and CTA click rate improve when social proof section added above the fold. **Why It Matters:** First impressions without proof signal unproven risk to prospective practitioners. | ❌ Not Started | 2 hrs | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-GTM-P2-3** | **UTM parameter tracking not confirmed in Plausible — Discord/Reddit attribution may be lost** — Prime Self uses Plausible Analytics (privacy-first). UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`) must pass through the SPA router and be captured in Plausible's goal events. Verify the current integration captures UTMs on signup and checkout events. If not, add explicit `plausible('signup', {props: {utm_source: ...}})` calls at key conversion points. **Signal:** Plausible shows source breakdown for signups (Discord, Reddit, direct) within 24 hours of launch. **Why It Matters:** Zero attribution = zero ability to optimize spend or double down on what works. | ❌ Not Started | 2 hrs | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-GTM-P2-4** | **5 launch promo codes not validated end-to-end in Stripe — codes may fail silently at checkout** — GTM promo strategy uses 5 codes: EARLYBIRD30 (30% off, Practitioner, first 100 users), LAUNCH25 (25% off, any tier), WAITLIST20 (20% off, first month), STARTUP30 (30% annual, Practitioner), AGENCY15 (15% off, Agency ongoing). Each must exist as a Stripe Promotion Code, apply the correct discount, and be tested in Stripe test mode before launch. **Signal:** All 5 codes pass verify-money-path.js promo validation step. **Linked Issue:** [GTM-008](audits/issue-registry.json). | ❌ Not Started | 2 hrs | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-GTM-P2-5** | **14-day trial email nurture sequence not built — activation guidance emails will not send** — 7-email sequence triggered by `subscription.trial_started` webhook: Day 0 welcome, Day 1 first-session guide, Day 3 Gate 2 nudge (conditional on client not yet added), Day 5 feature deep-dive, Day 7 mid-trial check-in, Day 11 final reminder, Day 14 trial-end upgrade CTA. Build in Resend with sequence triggers. Separate from post-purchase 5-email arc for paid converts. **Signal:** Trial-to-paid conversion rate measurably higher vs no-email baseline after 30 days. **Linked Issue:** [GTM-009](audits/issue-registry.json). | ❌ Not Started | 1 day | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-GTM-P2-6** | **Post-purchase practitioner onboarding email sequence not configured** — After a practitioner converts from trial to paid, a 5-email 30-day arc should fire: Day 0 welcome-to-paid, Day 7 intermediate tips, Day 14 advanced usage, Day 21 referral program intro, Day 30 retention check-in + success stories. Configure in Resend as a separate sequence from the trial nurture arc. **Signal:** 30-day practitioner retention rate improves; referral code activations tracked from Day 21 email. | ❌ Not Started | 1 day | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-GTM-P2-7** | **No in-app bug/error submission form — user-reported issues go unreported** — When users encounter errors, there is no in-app mechanism to report them. Add a floating feedback widget (bottom-right) that captures: description, screenshot (optional), and current page. Submit to the support email alias (`support@selfprime.net`) or a Cloudflare Worker endpoint that creates a support ticket. **Signal:** Support email receives structured bug reports within 24 hours of launch vs zero-report baseline. **Why It Matters:** Real bugs will exist at launch; self-serve reporting keeps the founder informed without requiring 1:1 contact for every issue. | ❌ Not Started | 4 hrs | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-GTM-P2-8** | **Support email alias and auto-responder not configured — no self-serve support channel at launch** — `support@selfprime.net` must exist as an email alias that routes to the founder inbox. An auto-responder should acknowledge every inbound email with: "Received — typical reply time is 24 hours" + link to FAQ. Keeps expectations set and stops users from assuming their message was lost. Configure via Cloudflare Email Routing (free). **Signal:** First support email routed and acknowledged within 24 hours of going live. | ❌ Not Started | 30 min | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |

### 🟢 P3 — Lower Priority (Post-Launch)

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-GTM-P3-1** | **No `/blog` route or content marketing infrastructure** — GTM plan includes a content marketing pillar (SEO + thought leadership). Needs a `/blog` route in the SPA that renders markdown articles from a `frontend/content/blog/` directory. Initial content: 3 posts about Energy Blueprint, design-compatible decision-making, and Human Design basics (renamed). **Signal:** Blog route accessible at selfprime.net/blog; first article indexed in Google Search Console within 2 weeks. | ❌ Not Started | 1 day | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-GTM-P3-2** | **Reddit one-click draft UI not implemented** — GTM social strategy includes Reddit (r/HumanDesign, r/spirituality, r/selfimprovement). A "Share to Reddit" button in the chart results view should pre-populate a Reddit submit URL with the post title, body, and UTM-tagged link. Button: generates the text → opens `https://reddit.com/submit?url=...&title=...` in a new tab. One-line implementation using `encodeURIComponent`. **Signal:** Reddit-attributed UTM traffic appears in Plausible within first week. | ❌ Not Started | 2 hrs | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |
| **BL-GTM-P3-3** | **No AI chatbot for in-app help — users rely entirely on static tooltips** — An in-app FAQ-backed AI assistant would reduce founder support burden for common questions. Build a floating chat widget that queries a curated FAQ corpus via the existing Claude AI integration. Corpus: 30 most common onboarding questions. Phase 1: FAQ-backed response only; Phase 2: escalate to human support. **Signal:** Support email volume decreases by ≥20% after chatbot launch vs pre-chatbot baseline. | ❌ Not Started | 2–3 days | [GTM Plan 2026-03-21](docs/GTM_PLAN_2026-03-21.md) |

---

## How to Update This Document

### Tagging Schema

Each item uses:
- **ID Format:** `BL-{SYSTEM}-{PRIORITY}-{NUMBER}` (e.g., `BL-BACKEND-P0-1`, `BL-FRONTEND-P2-3`)
- **Status Symbols:**
  - ✅ `Fixed` — Issue resolved and deployed
  - 🔄 `In Progress` — Currently being worked on
  - ⚠️ `Pending` — Lined up for next sprint
  - ❌ `Not Started` — Backlog; no work yet
  - 🔬 `Blocked` — Waiting on external dependency
- **Source Links:** Every item links to the audit/document that identified it

### When to Update

1. **Daily During Active Sprints:**
   - Update status for active items
   - Add new findings from daily scans
   - Close items when PR merged

2. **Weekly Otherwise:**
   - Consolidate new audit findings into sections
   - Deduplicate if same issue found in multiple audits
   - Update source links

3. **After Each Major Deployment:**
   - Mark fixed items with ✅ and commit hash
   - Update Quick Summary table
   - Archive related audit files if complete

### Adding a New Item

1. **Identify Correct Section** — Which system does it affect? (Backend API, Frontend, Engine, etc.)
2. **Assess Priority** — P0 (blocker), P1 (high), P2 (medium), P3 (low)
3. **Create ID** — Next available number in that section
4. **Write the intake fields first** — Do not add the item until these are explicit:
   - **Journey / Job:** Which journey does this serve? (`Practitioner` or `Personal User`) and which step/job?
   - **Signal:** What user or practitioner behavior should change if this fix works?
   - **Simplest Version:** What is the smallest implementation that proves value?
   - **Why It Matters:** One sentence in plain language explaining why the user should care.
   - **Principle Tags:** Which product principles govern this item? (e.g. `Earn the Next Step`, `Plain Language First`)
5. **Format:**
   ```markdown
   | **BL-SECTION-P#-N** | **Title** — Brief description with implications. Include file names and line numbers if available. | Status | Effort | [Source](link-to-audit) |
   ```
6. **Link Source** — Always cite where the issue was found (audit file, GitHub issue, user report, etc.)

### Required Issue Intake Template

Use this template before creating either a backlog item or an issue-registry entry:

```markdown
Journey / Job:
- Practitioner or Personal User
- Exact gate/job supported

Signal:
- What measurable behavior should change?

Simplest Version:
- Smallest implementation that proves value

Why It Matters:
- One sentence in plain language

Principle Tags:
- Which items from PRODUCT_PRINCIPLES.md apply?
```

### Example Backlog Intake

```markdown
Journey / Job:
- Personal User
- Gate 2 -> Gate 4 (`Calculate` -> `Synthesize`)

Signal:
- More users who calculate a chart reach profile generation without abandoning the form

Simplest Version:
- Pre-fill profile birth-data fields from chart fields when the profile tab opens

Why It Matters:
- Users should not have to re-enter the same birth data to get the product's main reading

Principle Tags:
- Earn the Next Step
- No Feature Without a Story
```

If these fields cannot be written clearly, the item is not ready for the backlog.

### Deduplication

If same issue appears in multiple audits:
1. Keep the entry in the section where it belongs
2. Mark others as `[DUPE of BL-BACKEND-P0-1]`
3. Link to original entry

### Example Format

```markdown
| **BL-BACKEND-P1-3** | **Rate limiting edge case in webhook validation** — If body parsing fails before rate limit check, request bypasses all limits. Should apply rate limit first. File: `workers/src/middleware/rateLimit.js` L35-40. | ⚠️ Pending | 15 min | [Code Review 2026-03-17](audits/CODE_QUALITY_AUDIT.md#L456) |
```

---

## Archive & Historical References

Detailed audit findings and full context available in:
- `audits/SCAN_2026-03-17-FRESH.md` — Latest comprehensive scan (4 findings, metrics)
- `audits/FINDING_2026-03-17-PUBLIC-AUTH-MISMATCH-REVISED.md` — Detailed public/auth pattern analysis
- `audits/AUDIT_REMEDIATION_LOG.md` — Complete remediation history from all deep dives
- `audits/FULL_AUDIT_2026-03-15-v2.md` — Previous comprehensive audit
- See `audits/archive/` for older audit files (pre-2026-03-15)

---

## Next Steps

### Immediate (Today)
- [ ] **DEBUG REGISTER ERROR** — Check Cloudflare Worker logs for detailed error message (awaiting visibility from commit 0f02b5c 2-hour-old logging)
- [ ] **Fix cycles endpoint** (30 min) — Apply same param validation reordering as forecast
- [ ] **Fix rectify endpoint** (30 min) — Apply same fix as cycles

### This Week
- [ ] Update production gate tests to include cycles + rectify param validation (20 min)
- [ ] Re-run prod gate for 17/17 passing (target 100%)
- [ ] Update API documentation for 7 newly implemented endpoints (2 hrs)
- [ ] Review ENVIRONMENT variable configuration in all environments

### Next Sprint
- [ ] Implement error code mapping to prevent sensitive info leaks (30 min)
- [ ] Add error telemetry integration (1 day)
- [ ] Complete remaining 26 Gene Keys descriptions (4 hrs)
- [ ] Audit all PUBLIC_ROUTES for similar auth/param ordering patterns (15 min)

---

**Document Version:** 2.3  
**Last Updated:** 2026-03-21 v2 — 4 items resolved: Discord domain fix (BL-DISCORD-P0-2), rate limit raised (BL-DISCORD-P1-1), annual pricing verified in config (BL-GTM-P1-3), 14-day trial wired (BL-GTM-P1-4). GTM Decision Log all 7 decisions marked RESOLVED. 4 registry entries marked resolved (GTM-002, GTM-003, GTM-004, GTM-006).  
**Maintained By:** Agent  
**Sync:** Automatically from audit discoveries; manual review recommended weekly
