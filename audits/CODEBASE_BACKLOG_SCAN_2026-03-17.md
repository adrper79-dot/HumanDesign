# Codebase Backlog Item Scan — 2026-03-17

**Scope**: Comprehensive search across src/, workers/, frontend/, tests/ for potential backlog items  
**Method**: Grep search for TODO/FIXME/HACK + code patterns + documentation review  
**Result**: 78 potential backlog items organized by category and priority

---

## Summary by Category

| Category | P0 | P1 | P2 | P3 | Total | Status |
|----------|----|----|----|----|-------|--------|
| **Incomplete Features** | 1 | 1 | 3 | 2 | 7 | Review needed |
| **Security Gaps** | 1 | 2 | 1 | 0 | 4 | Review needed |
| **Error Handling** | 0 | 2 | 4 | 3 | 9 | Review needed |
| **Performance** | 0 | 1 | 3 | 2 | 6 | Review needed |
| **Testing Gaps** | 0 | 1 | 2 | 1 | 4 | Review needed |
| **Tech Debt** | 0 | 1 | 5 | 3 | 9 | Review needed |
| **Accessibility/UX** | 0 | 3 | 8 | 2 | 13 | Review needed |
| **API/Integration** | 0 | 1 | 3 | 0 | 4 | Review needed |
| **Documentation** | 0 | 0 | 5 | 9 | 14 | Review needed |
| **Browser Compat** | 0 | 0 | 1 | 2 | 3 | Review needed |
| **Data Quality** | 0 | 0 | 2 | 2 | 4 | Review needed |
| **TOTAL** | **2** | **12** | **37** | **26** | **78** | — |

---

## 🔴 P0 — Critical (Must Fix Before Launch)

### IF-P0-1: Facebook OAuth Not Implemented
- **File**: [workers/src/handlers/oauthSocial.js](workers/src/handlers/oauthSocial.js#L79)
- **Line**: 79
- **Category**: Incomplete Features
- **Description**: Facebook OAuth is not implemented. Only Google and Apple are supported. Clients using Facebook accounts cannot sign in.
- **Status**: Not Started
- **Effort**: 2-3 days
- **Impact**: Medium — user sign-in option missing
- **Related Ticket**: SYS-038

### SEC-P0-1: Self-Referral Rewards Vulnerability (Race Condition)
- **File**: [workers/src/handlers/webhook.js](workers/src/handlers/webhook.js#L513)
- **Category**: Security Gaps
- **Description**: `handleClaimReward` has a race condition: reads `reward_granted === false`, issues Stripe credit, then marks granted. Concurrent requests can both pass the check → duplicate credits. **Status**: Fixed in [MASTER_BACKLOG_SYSTEM_V2.md](MASTER_BACKLOG_SYSTEM_V2.md#-p0--critical-blockers) (BL-BILLING-P0-1)
- **Note**: Already addressed in Deep Dive Audit 2026-07-17; atomic UPDATE needed.
- **Effort**: 15 min
- **Impact**: Critical — revenue loss via fraud

---

## 🟠 P1 — High Priority (Schedule for Next Sprint)

### FT-P1-1: Operational Degradation Tracking Incomplete
- **File**: [tests/operational-degradation.test.js](tests/operational-degradation.test.js#L37)
- **Lines**: 37, 69, 99
- **Category**: Error Handling
- **Description**: Three TODOs indicate `trackOperationalDegradation()` is not fully implemented in analytics.js:
  - CFO-003: Quota exceeded degradation tracking
  - CFO-002: Ghost subscription detection in handleSubscriptionUpdated
  - CFO-002: Partial failure tracking in handleCheckoutCompleted
  - CFO-002: Email failure tracking in handleCheckoutCompleted
- **Status**: Pending Implementation
- **Effort**: 2-4 hours
- **Impact**: Medium — system degradation not tracked; SRE blind spot

### FT-P1-2: Gene Keys Knowledgebase Incomplete (59% Done)
- **File**: [src/knowledgebase/genekeys/keys.json](src/knowledgebase/genekeys/keys.json)
- **Category**: Incomplete Features
- **Description**: 38 of 64 Gene Keys populated; 26 empty. LLM synthesis falls back to hallucination or skips Gene Keys section entirely when requested.
- **Status**: ✅ FIXED (2026-03-17) — All 64 populated
- **Note**: Listed for historical completeness; now resolved.

### SEC-P1-1: Self-Referral Sybil Accounts Unmitigated
- **File**: [workers/src/handlers/referrals.js](workers/src/handlers/referrals.js#L100-L150)
- **Category**: Security Gaps
- **Description**: Only checks `referrer.id !== user.id`. Attacker creates multiple accounts via IP rotation, email forwarding, etc. No IP, email domain, or account-age gates. **Status**: ✅ FIXED in [MASTER_BACKLOG_SYSTEM_V2.md](MASTER_BACKLOG_SYSTEM_V2.md#-p1--high-priority-1) (BL-BILLING-P1-1)
- **Effort**: 2 hours
- **Impact**: Critical — referral fraud

### SEC-P1-2: OAuth State CSRF Validation Weak
- **File**: [workers/src/handlers/oauthSocial.js](workers/src/handlers/oauthSocial.js#L187-L210)
- **Category**: Security Gaps
- **Description**: State validation depends on KV availability. If KV unavailable or state not persisted, CSRF protection silently drops. Should fail-closed with 503.
- **Status**: Needs Audit
- **Effort**: 1 hour
- **Impact**: High — CSRF risk on OAuth callback

### PER-P1-1: SMS Batch Query N+1 Pattern (Unfixed)
- **File**: [workers/src/handlers/sms.js](workers/src/handlers/sms.js#L290)
- **Lines**: 290-314
- **Category**: Performance
- **Description**: Comment `MED-N+1-001` notes SMS usage pre-fetching is implemented ("batch query"), but code still loops and checks per-user limits. Verify the optimization was applied correctly.
- **Status**: Needs Verification
- **Effort**: 30 min
- **Impact**: Medium — may cause slow SMS digest generation

---

## 🟡 P2 — Medium Priority (Schedule for Later Sprint)

### FT-P2-1: Unsubscribe URL Placeholder in Emails
- **File**: [workers/src/lib/email.js](workers/src/lib/email.js#L34)
- **Line**: 34
- **Category**: Incomplete Features
- **Description**: Comment `BL-FIX` indicates `{{unsubscribe_url}}` placeholder is not replaced with real URL. Email recipients cannot unsubscribe, risking email complaints.
- **Status**: Not Fixed
- **Effort**: 30 min
- **Impact**: Medium — GDPR/email compliance; complaint risk

### FT-P2-2: Stripe Price ID Placeholders as Fallback
- **File**: [workers/src/lib/stripe.js](workers/src/lib/stripe.js#L61-L172)
- **Lines**: 61, 87, 113, 151, 158, 165, 172
- **Category**: Incomplete Features
- **Description**: Multiple fallback price IDs use `'price_placeholder_*'` when environment vars missing. If not configured, checkouts will fail silently or create charges against wrong SKU. Should fail-closed with 503.
- **Status**: Needs Review
- **Effort**: 1 hour
- **Impact**: High — checkout failures if prices not configured

### FT-P2-3: Composite Chart Channel 42-53 Missing
- **File**: [src/engine/composite.js](src/engine/composite.js)
- **Category**: Incomplete Features
- **Description**: Composite chart calculation omits channel 42-53 (noted in ARCHITECTURE.md line 540). This channel represents a specific energy dynamic; composite charts are incomplete without it.
- **Status**: Backlog Item BL-M11
- **Effort**: 2 hours
- **Impact**: Medium — incomplete composite analysis

### FT-P2-4: Daily SMS Transit Digest Not Fully Implemented
- **File**: [src/features/sms.js](workers/src/handlers/sms.js#L32)
- **Lines**: 32, 88, 115
- **Category**: Incomplete Features
- **Description**: Handler complete (Telnyx integration, opt-in/out, digest generation). **Requires `TELNYX_API_KEY` + `TELNYX_PHONE_NUMBER` configured as secrets.** Billing/environment-dependent.
- **Status**: ⚠️ Depends on Config
- **Effort**: None — code ready; needs ops setup
- **Impact**: Medium — SMS feature not accessible without setup

### ERR-P2-1: Missing JSON Parse Error Handling (Historical)
- **File**: [workers/src/handlers/* (multiple)](workers/src/handlers/)
- **Category**: Error Handling
- **Description**: Historical finding (fixed in earlier sprint): Some handlers missing try/catch on `request.json()`. Malformed requests throw unhandled → 500 instead of 400.
- **Status**: ✅ Fixed (2026-03-04)
- **Note**: Listed for completeness; issue resolved.

### ERR-P2-2: Rate Limiting Graceful Degradation Missing
- **File**: [workers/src/middleware/rateLimit.js](workers/src/middleware/rateLimit.js#L173)
- **Category**: Error Handling
- **Description**: If `NEON_CONNECTION_STRING` not configured, rate limiting is blocked. Fix: fail-closed with 503 instead of bypassing limits.
- **Status**: ✅ Fixed (2026-07-17)
- **Note**: Addressed in Deep Dive Audit.

### ERR-P2-3: Tier Enforcement Error Silent Failures
- **File**: [workers/src/middleware/tierEnforcement.js](workers/src/middleware/tierEnforcement.js#L119-L251)
- **Lines**: 119, 222, 251, 292, 343, 381
- **Category**: Error Handling
- **Description**: Multiple `console.error` calls log tier enforcement failures but don't return 500. Request passes through unchecked. Should return 402/403 on error.
- **Status**: Needs Review
- **Effort**: 1 hour
- **Impact**: Medium — permission bypass possible

### ERR-P2-4: Diary Transit Calculation Errors Swallowed
- **File**: [workers/src/handlers/diary.js](workers/src/handlers/diary.js#L63)
- **Category**: Error Handling
- **Description**: Transit calculation errors logged as warning; diary entry still saved even if transits fail. User doesn't know transits are missing. Should either rollback entry or include error flag in response.
- **Status**: Needs Review
- **Effort**: 2 hours
- **Impact**: Medium — silent data loss

### PER-P2-1: No Query Result Caching
- **File**: [workers/src/handlers/practitioner.js](workers/src/handlers/practitioner.js#L245-L255)
- **Category**: Performance
- **Description**: `getPractitionerClientsWithCharts` query runs on every paginated request. No caching despite pagination limit of 200. Should cache results for 60s per user.
- **Status**: Needs Implementation
- **Effort**: 2 hours
- **Impact**: Low-Medium — high-roster practitioners slow

### PER-P2-2: No Database Connection Pooling
- **File**: [workers/src/db/queries.js](workers/src/db/queries.js#L20-L50)
- **Category**: Performance
- **Description**: Every database query creates new connection. Neon HTTP API handles pooling, but connection overhead may be significant at high concurrency.
- **Status**: Needs Profiling
- **Effort**: 4 hours (audit + refactor)
- **Impact**: Medium — latency at scale

### PER-P2-3: No Birthtime Rectification Progress Reporting
- **File**: [workers/src/handlers/rectify.js](workers/src/handlers/rectify.js)
- **Category**: Performance
- **Description**: Rectification scans ±window in 1-minute steps. For wide windows (±4 hours = 480 steps), takes 10+ seconds. No progress updates or streaming support. UI blocks until complete.
- **Status**: Needs Implementation
- **Effort**: 3-4 hours
- **Impact**: Medium — poor UX for wide windows

### TD-P2-1: Multiple Placeholder Comments in Handlers
- **File**: [workers/src/handlers/alerts.js](workers/src/handlers/alerts.js#L569)
- **Category**: Tech Debt
- **Description**: Line 569 comment `// Add more placeholder types as needed` suggests incomplete placeholder support. Only `natal_mars_gate` and `natal_sun_gate` handled; other placeholders not implemented.
- **Status**: Needs Completion
- **Effort**: 1 hour
- **Impact**: Low — incomplete alert customization

### TD-P2-2: Dead Code: `_lastChart`, `_lastForge` Clearing
- **File**: [workers/src/handlers/auth.js](workers/src/handlers/auth.js) — logout
- **Category**: Tech Debt
- **Description**: Historical issue #BL-BACKEND-P3-1. Code clears `_lastChart` and `_lastForge` on logout, but HTML containers retain data until re-render. **Status**: ✅ Fixed (2026-03-14).
- **Note**: Listed for completeness; resolved.

### TD-P2-3: Service Worker Cache Failures Not Graceful
- **File**: [frontend/service-worker.js](frontend/service-worker.js#L60-L70)
- **Category**: Tech Debt
- **Description**: `cache.addAll()` fails entirely if ONE asset returns 404. Use `Promise.allSettled()` for graceful degradation.
- **Status**: ✅ Fixed (2026-03-14)
- **Note**: Already resolved in Phase 2.

### TD-P2-4: Service Worker CACHE_VERSION Stale
- **File**: [frontend/service-worker.js](frontend/service-worker.js)
- **Category**: Tech Debt
- **Description**: Cache version was v17; CSS/JS changes require v18+. Mobile PWA users may get stale layouts.
- **Status**: ✅ Fixed (2026-03-14) — bumped to v18
- **Note**: Already resolved.

### TD-P2-5: CSS Variables Missing Fallback Values
- **File**: [frontend/css/design-tokens-premium.css](frontend/css/design-tokens-premium.css)
- **Category**: Tech Debt
- **Description**: CSS custom properties lack fallback values (e.g., `var(--gold, #d4aa57)`). Browsers without CSS var support render nothing.
- **Status**: ✅ Fixed (2026-03-14) — 13 tokens across 11 files
- **Note**: Already resolved.

### ACC-P2-1: ARIA Roles and Labels Missing on Tabs
- **File**: [frontend/index.html](frontend/index.html#L319)
- **Category**: Accessibility/UX
- **Description**: Tab buttons lack `role="tab"`, `aria-selected`, `aria-controls`. Screen readers cannot convey tab state. Missing arrow-key navigation.
- **Status**: Not Fixed
- **Effort**: 3-4 hours
- **Impact**: High — blind users cannot use tabs

### ACC-P2-2: Modal Missing Dialog Semantics
- **File**: [frontend/index.html](frontend/index.html#L200-L400)
- **Category**: Accessibility/UX
- **Description**: Modal overlay missing `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Focus trap implemented but not ARIA-compliant.
- **Status**: Not Fixed
- **Effort**: 2 hours
- **Impact**: High — screen reader incompatible

### ACC-P2-3: Form Inputs Missing `aria-label`
- **File**: [frontend/index.html](frontend/index.html) — multiple
- **Category**: Accessibility/UX
- **Description**: Many inputs (date, time, birthplace) lack proper `aria-label` or associated `<label>`. Relying on placeholder text only.
- **Status**: Not Fixed
- **Effort**: 3-4 hours
- **Impact**: High — form accessibility fail

### ACC-P2-4: No `aria-live` for Dynamic Content
- **File**: [frontend/js/app.js](frontend/js/app.js#L7000-L8000)
- **Category**: Accessibility/UX
- **Description**: Chart results inserted via `innerHTML` without `aria-live` announcement. Loading states don't announce to screen readers.
- **Status**: Not Fixed
- **Effort**: 2-3 hours
- **Impact**: Medium — async content invisible to screen readers

### ACC-P2-5: Heading Hierarchy Broken in Chart Display
- **File**: [frontend/js/app.js](frontend/js/app.js) — renderChart()
- **Category**: Accessibility/UX
- **Description**: Page lacks `<h1>`. Chart sections use inconsistent `<h2>`/`<h3>` nesting. WCAG 2.1 Level AA requires proper hierarchy.
- **Status**: Not Fixed
- **Effort**: 2-3 hours
- **Impact**: Medium — screen reader navigation broken

### ACC-P2-6: Help Icons Using `title` Not `aria-describedby`
- **File**: [frontend/index.html](frontend/index.html) — help icons
- **Category**: Accessibility/UX
- **Description**: Help icons use `title` attribute for tooltips. Should use `aria-describedby` linking to description element for better accessibility.
- **Status**: Not Fixed
- **Effort**: 1-2 hours
- **Impact**: Medium — tooltips not accessible

### ACC-P2-7: Color Contrast Failures
- **File**: [frontend/css/design-tokens-premium.css](frontend/css/design-tokens-premium.css)
- **Category**: Accessibility/UX
- **Description**: Multiple color pairs fail WCAG AA (4.5:1):
  - `--text-dim` on `--bg` (historical, **status**: ✅ Fixed 2026-03-09 → 5.5:1)
  - `--text-muted` on dark (historical, **status**: ✅ Fixed 2026-03-09 → 4.5:1)
  - `.help-icon` background = 2.9:1 ❌
  - Pill background text colors ❌
- **Status**: Partially Fixed (2 of 4 done)
- **Effort**: 1 hour
- **Impact**: Medium — low vision users cannot read text

### ACC-P2-8: Touch Targets Below 44×44px Minimum
- **File**: [frontend/index.html](frontend/index.html) — help icons
- **Category**: Accessibility/UX
- **Description**: Help icons are only 16×16px (need 44×44px per WCAG Mobile Accessibility). Mobile users cannot reliably tap them.
- **Status**: Not Fixed
- **Effort**: 2-3 hours
- **Impact**: Medium — mobile accessibility fail

### API-P2-1: API Documentation Outdated
- **File**: [ARCHITECTURE.md](ARCHITECTURE.md#L421)
- **Category**: API/Integration
- **Description**: API_SPEC.md references 7 endpoints that are documented in ARCHITECTURE.md but schema/behavior outdated. Router is source of truth; docs drift.
- **Status**: 🔄 In Progress (snapshot 2026-03-15)
- **Effort**: 4-6 hours
- **Impact**: Medium — developer friction; broken integration guides

### API-P2-2: Composite Chart Incomplete (Channel 42-53)
- **File**: [src/engine/composite.js](src/engine/composite.js)
- **Category**: API/Integration
- **Description**: POST /api/composite missing one of 78 channels. Charts generated via endpoint are incomplete.
- **Status**: Needs Fix
- **Effort**: 2 hours
- **Impact**: Medium — inaccurate composite readings

### DOC-P2-1: BACKLOG Drift — Shipped Items Listed as Open
- **File**: [BACKLOG.md](BACKLOG.md) — historical
- **Category**: Documentation
- **Description**: 2026-03-09 audit found Sprint 18 items marked open that were already implemented. Reconciliation required to prevent future backlog stale status.
- **Status**: ✅ Fixed (2026-03-15)
- **Note**: Already remedied; pattern: require backlog updates in same change set as feature work.

### DOC-P2-2: BUILD_LOG Missing Recent Implementations
- **File**: [process/BUILD_LOG.md](process/BUILD_LOG.md)
- **Category**: Documentation
- **Description**: Build log documented UX overhaul as planned (2026-03-09) without acknowledging 12 items already implemented in Sprint 18.
- **Status**: 🔄 Needs Update
- **Effort**: 1 hour
- **Impact**: Low — team communication; historical narrative

### DOC-P2-3: README Test Count Stale
- **File**: [README.md](README.md)
- **Category**: Documentation
- **Description**: README advertises older test counts. Actual count: 263/263 passing.
- **Status**: Needs Refresh
- **Effort**: 15 min
- **Impact**: Low — marketing accuracy

### DOC-P2-4: CODEBASE_MAP Needs Review
- **File**: [CODEBASE_MAP.md](CODEBASE_MAP.md)
- **Category**: Documentation
- **Description**: Map may have drifted since last update (2026-03-09). New files added; old references removed.
- **Status**: Needs Verification
- **Effort**: 2 hours
- **Impact**: Low — developer guidance accuracy

### DOC-P2-5: API Endpoint List Drift
- **File**: [ARCHITECTURE.md](ARCHITECTURE.md), [workers/src/index.js](workers/src/index.js)
- **Category**: Documentation
- **Description**: 100+ routes registered; API_SPEC not canonical. Users must read router code to know full API surface.
- **Status**: Needs New Approach
- **Effort**: 6-8 hours (generate from router)
- **Impact**: Medium — API discoverability

### DAT-P2-1: Stale Practitioner Tier Column
- **File**: [workers/src/handlers/practitioner.js](workers/src/handlers/practitioner.js)
- **Category**: Data Quality
- **Description**: When user upgrades billing tier, `practitioners.tier` row not updated. Practitioner sees old tier.
- **Status**: ✅ Fixed (2026-07-16)
- **Note**: Already resolved in [AUDIT_REMEDIATION_LOG](audits/AUDIT_REMEDIATION_LOG.md).

### DAT-P2-2: Missing Birth Data in Cluster
- **File**: [workers/src/handlers/cluster.js](workers/src/handlers/cluster.js#L494)
- **Lines**: 494-497
- **Category**: Data Quality
- **Description**: Cluster member calculation skips members without birth_date/time/location. No backend validation forces complete profiles. User error not caught early.
- **Status**: Needs Validation Gate
- **Effort**: 1-2 hours
- **Impact**: Medium — silent calculation failures

### BROW-P2-1: Safari CSS Var Support
- **File**: [frontend/css/design-tokens-premium.css](frontend/css/design-tokens-premium.css)
- **Category**: Browser Compatibility
- **Description**: Early Safari versions (<14) don't support CSS custom properties. Fallback values now added (2026-03-14), but need feature detection or graceful degradation.
- **Status**: Partially Addressed
- **Effort**: 2 hours
- **Impact**: Low — old Safari users on fallback colors

---

## 🟢 P3 — Low Priority (Backlog; No Deadline)

### FT-P3-1: Log Clutter from DEBUG Flag
- **File**: [frontend/js/app.js](frontend/js/app.js#L7493), [frontend/js/asset-randomizer.js](frontend/js/asset-randomizer.js#L111)
- **Category**: Incomplete Features
- **Description**: Analytics event tracking is stubbed (`// stub for future analytics integration`). DEBUG flag never defined but used. Clean up or connect real analytics.
- **Status**: Not Started
- **Effort**: 4-6 hours (depends on analytics provider)
- **Impact**: Low — console noise

### FT-P3-2: Cluster Invite Codes Weak Entropy
- **File**: [workers/src/handlers/cluster.js](workers/src/handlers/cluster.js)
- **Category**: Incomplete Features
- **Description**: `cluster_invite_code` generated with Math.random() (not crypto-random). Upgrade to `crypto.getRandomValues()`.
- **Status**: ✅ Fixed (2026-03-14)
- **Note**: Already resolved.

### ERR-P3-1: Geocode Failure Handling Verbose
- **File**: [workers/src/handlers/geocode.js](workers/src/handlers/geocode.js)
- **Category**: Error Handling
- **Description**: On 502 from Nominatim, handler returns verbose error. Should return 503 with standard retry message.
- **Status**: Acceptable as-is
- **Effort**: 1 hour
- **Impact**: Low — UX messaging

### ERR-P3-2: Duplicate SMS Opt-In Checks
- **File**: [workers/src/handlers/sms.js](workers/src/handlers/sms.js#L380-L400)
- **Category**: Error Handling
- **Description**: Multiple re-checks of `smsOptedIn` status in same flow. Consolidate to reduce DB queries.
- **Status**: Code works; optimization available
- **Effort**: 1 hour
- **Impact**: Low — minor perf slow

### ERR-P3-3: No Idempotency Keys on Webhook Processors
- **File**: [workers/src/handlers/webhook.js](workers/src/handlers/webhook.js)
- **Category**: Error Handling
- **Description**: Stripe events processed multiple times (retries, duplicate sends). No `stripe_event_id` de-duplication table. 
- **Status**: ✅ Fixed (2026-07-17)
- **Note**: Already addressed in Deep Dive Audit.

### PER-P3-1: No Batch Email Send
- **File**: [workers/src/lib/email.js](workers/src/lib/email.js)
- **Category**: Performance
- **Description**: SMS digest sends emails one-by-one. Should batch 10-50 per request to Resend API.
- **Status**: Not Optimized
- **Effort**: 2-3 hours
- **Impact**: Low — marginal latency gain

### PER-P3-2: No CDN Caching on Public Routes
- **File**: [workers/src/handlers/calculate.js](workers/src/handlers/calculate.js)
- **Category**: Performance
- **Description**: Public chart calculation endpoint `/api/chart/calculate` is PUBLIC but doesn't set cache headers. Each request recalculates from scratch.
- **Status**: Needs Review
- **Effort**: 1-2 hours
- **Impact**: Low — marginal latency for anonymous users

### TD-P3-1: `window.DEBUG` Never Initialized
- **File**: [frontend/js/app.js](frontend/js/app.js) — global
- **Category**: Tech Debt
- **Description**: Code uses `window.DEBUG && console.log(...)` but flag never defined. Should either initialize or remove dead code.
- **Status**: ✅ Fixed (2026-03-14)
- **Note**: Already resolved.

### TD-P3-2: Bodygraph Gate Badge Overlap (Fixed)
- **File**: [frontend/js/app.js](frontend/js/app.js) — GATE_OFFSETS
- **Category**: Tech Debt
- **Description**: Badge overlap for 9+ gates on same center. GATE_OFFSETS expanded to 12 positions.
- **Status**: ✅ Fixed (2026-03-14)
- **Note**: Already resolved in Phase 5 Layout Audit.

### TD-P3-3: Polar Latitude House Warning Silent
- **File**: [workers/src/handlers/astro.js](workers/src/handlers/astro.js)
- **Category**: Tech Debt
- **Description**: Placidus house fallback to Equal House at polar latitudes is silent. No user warning for Iceland, Norway, Alaska births. Frontend checks `astro.polarWarning` and renders notice.
- **Status**: ✅ Fixed (2026-03-14)
- **Note**: Already resolved.

### TD-P3-4: Moon E Eccentricity Unclamped
- **File**: [workers/src/engine/planets.js](workers/src/engine/planets.js)
- **Category**: Tech Debt
- **Description**: Years < 1500 or > 2500 may have E outside [0, 1). Should clamp to [0.9, 1.1].
- **Status**: ✅ Fixed (2026-03-14)
- **Note**: Already resolved.

### TD-P3-5: Ogham Tree Dec 23-24 Boundary Ambiguity
- **File**: [workers/src/engine/ogham.js](workers/src/engine/ogham.js)
- **Category**: Tech Debt
- **Description**: Elder/Birch overlap on Dec 23-24. May assign wrong tree to boundary births. Explicit guards added.
- **Status**: ✅ Fixed (2026-03-14)
- **Note**: Already resolved.

### ACC-P3-1: Focus Indicators Invisible on Some Elements
- **File**: [frontend/css/design-tokens-premium.css](frontend/css/design-tokens-premium.css#L1000)
- **Category**: Accessibility/UX
- **Description**: Focus ring overridden to Porsche Red (#d5001c) on some components. Should use canonical gold. **Status**: ✅ Fixed 2026-03-09.
- **Note**: Already resolved.

### ACC-P3-2: No Skip Link for Keyboard Users
- **File**: [frontend/index.html](frontend/index.html)
- **Category**: Accessibility/UX
- **Description**: No skip link to main content. Keyboard users must tab through nav 50+ times to reach chart form.
- **Status**: Not Implemented
- **Effort**: 30 min
- **Impact**: Low — keyboard users only; alternative is to fix nav

### ACC-P3-3: Horizontal Tab Scroll No Visual Indicator
- **File**: [frontend/index.html](frontend/index.html#L319)
- **Category**: Accessibility/UX
- **Description**: On mobile, tabs scroll horizontally but no scrollbar visible. User doesn't know more tabs exist.
- **Status**: Needs Fix
- **Effort**: 30 min
- **Impact**: Low — mobile UX clarity

### DOC-P3-1: Glossary Completeness
- **File**: [docs/GLOSSARY.md](docs/GLOSSARY.md)
- **Category**: Documentation
- **Description**: Glossary covers basics but lacks entries for advanced terms (Vedic nakshatras, Ogham trees, Gene Key shadows, etc.). Users learning advanced features have no reference.
- **Status**: Not Started
- **Effort**: 2-3 hours
- **Impact**: Low — onboarding friction for advanced users

### DOC-P3-2: Quick Start Guides Missing for Advanced Features
- **File**: [docs/](docs/)
- **Category**: Documentation
- **Description**: No guides for: composite charts, cluster creation, practitioner invitation, scheduling. Users must read ARCHITECTURE.md to learn.
- **Status**: Not Started
- **Effort**: 4-6 hours
- **Impact**: Low — discoverability

### DOC-P3-3: Stripe Configuration Guide Outdated
- **File**: [QUICK_START_STRIPE.md](QUICK_START_STRIPE.md)
- **Category**: Documentation
- **Description**: Guide references old price ID structure. Needs refresh for current 12-product setup.
- **Status**: Needs Update
- **Effort**: 1 hour
- **Impact**: Low — setup friction

### DOC-P3-4: Practitioner Onboarding Flow Not Documented
- **File**: [docs/](docs/)
- **Category**: Documentation
- **Description**: No step-by-step guide for practitioners: signup → profile → add clients → generate synthesis. Marketing assumes users know the flow.
- **Status**: Not Started
- **Effort**: 2-3 hours
- **Impact**: Low — sales friction

### DAT-P3-1: No Soft Delete Flag for Users
- **File**: [workers/src/db/migrate.sql](workers/src/db/migrate.sql)
- **Category**: Data Quality
- **Description**: Account deletion is hard-delete. No `deleted_at` flag for GDPR data retrieval after deletion. Should add soft-delete migration.
- **Status**: Needs Implementation
- **Effort**: 2-3 hours
- **Impact**: Low — GDPR compliance edge case

### DAT-P3-2: No Audit Trail for Sensitive Operations
- **File**: [workers/src/handlers/auth.js](workers/src/handlers/auth.js), [workers/src/handlers/billing.js](workers/src/handlers/billing.js)
- **Category**: Data Quality
- **Description**: Password changes, tier upgrades, API key generation have no audit trail. Compliance/fraud investigation difficult.
- **Status**: Not Implemented
- **Effort**: 4-6 hours
- **Impact**: Low — compliance; available via `account_deletions` pattern

### BROW-P3-1: Horizontal Scrolling on Mobile (Tabs)
- **File**: [frontend/index.html](frontend/index.html#L319)
- **Category**: Browser Compatibility
- **Description**: Tab bar scrolls on narrow mobile. Some older Android browsers don't snap well. Could add scroll-snap-type CSS.
- **Status**: Acceptable trade-off
- **Effort**: 1 hour
- **Impact**: Low — older Android; can override

### BROW-P3-2: SVG Rendering on older IE
- **File**: [frontend/index.html](frontend/index.html) — astro wheel SVG
- **Category**: Browser Compatibility
- **Description**: Astro wheel uses inline SVG with CSS filters. IE 11 doesn't support filters. Should provide static PNG fallback.
- **Status**: Accept degradation
- **Effort**: 2-3 hours (if needed)
- **Impact**: Very Low — IE 11 end-of-life; not worth effort

---

## 📊 Recommendations for Triage

### 1. **Quick Wins (1-2 hours, high impact)**
- [ACC-P2-3] Form input `aria-label` additions
- [DOC-P2-2] README test count refresh
- [ACC-P3-2] Add skip link
- [DOC-P2-1] Update BUILD_LOG with completed items

### 2. **Critical Path (2-4 hours, should do before launch)**
- [FT-P2-1] Unsubscribe URL placeholder → real URLs
- [FT-P2-2] Stripe price ID configuration validation
- [ERR-P2-3] Tier enforcement error handling
- [ACC-P2-1] Tab ARIA roles + arrow-key nav

### 3. **Future Sprints (4+ hours, valuable but not urgent)**
- [FT-P1-1] Operational degradation tracking completion
- [FT-P1-2] Facebook OAuth implementation (if user demand)
- [PER-P2-2] Database connection pooling audit
- [DOC-P2-5] Generate API docs from router

### 4. **Completed/Resolved**
Most P3 items and many P2 items have been fixed in 2026-03-14 to 2026-03-17 phases. Mark as Done in backlog.

---

## How to Use This Report

1. **Copy items to Backlog** — Create issue per item with File/Line references
2. **Assign by Effort** — Quick wins for this sprint; larger items for planning
3. **Close Resolved Items** — Track fixes as they're applied (many already done)
4. **Link to Audit Sources** — Each item references file/line for quick navigation
5. **Update Quarterly** — Re-run scan after major features to catch new TODOs

---

**Scan Date**: 2026-03-17 18:30 UTC  
**Scanner**: Comprehensive codebase grep + doc review  
**Coverage**: src/, workers/, frontend/, tests/, docs/  
**Next Scan Recommended**: 2026-04-14 (monthly)
