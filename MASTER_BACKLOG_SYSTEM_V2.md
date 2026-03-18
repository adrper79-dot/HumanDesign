# MASTER BACKLOG — System-Based Organization (Option C)

> **Version:** 2.0 — System-based consolidation (2026-03-17)  
> **Purpose:** Single source of truth for all backlog items across sprints, audits, and defects  
> **Organization:** By system/domain, then by priority and status  
> **Update Frequency:** Daily during active sprints; weekly otherwise  
> **Last Updated:** 2026-03-18

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
12. [How to Update This Document](#how-to-update-this-document)

---

## Quick Summary

| Category | P0 | P1 | P2 | P3 | Total | Status |
|----------|----|----|----|----|-------|--------|
| Backend API | ✅ 1 | ✅ 2 | ✅ 4 | 2 | 9 | ✅ All fixed |
| Frontend | 0 | ✅ 5 + 🔄 2 | ✅ 3 + ⚠️ 4 | 2 | 16 | 🔄 Two activation follow-through items remain partial |
| Engine | 0 | ✅ 1 | ✅ 2 | 1 | 4 | ✅ All closed |
| Database | 0 | 0 | ✅ 2 | 1 | 3 | ✅ Schema complete |
| Billing | ✅ 1 | 1 | 1 | 0 | 3 | ⚠️ 1 pending |
| Practitioners | 0 | ✅ 2 | ✅ 2 | 1 | 5 | ✅ Core handoff restored |
| Security | 🔴 1 | ✅ 3 | ✅ 2 | 0 | 7 | 🔴 1 blocker (trademark) |
| Operations | ✅ 1 | ✅ 2 | ✅ 3 | 2 | 7 | ✅ All fixed |
| Testing | 0 | ✅ 1 | ✅ 3 | 1 | 5 | ✅ Good coverage |
| Documentation | 0 | 1 | 2 | 1 | 4 | 🔄 Ongoing |
| **TOTAL** | **3/4** | **18/20** | **24/28** | **11** | **63** | **56/63 = 89% complete** |

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

### 🟠 P1 — High Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-BILLING-P1-1** | **Self-referral via Sybil accounts unmitigated** — Only checks `referrer.id !== user.id`. Attacker creates Account A (gets code) → Account B (applies code) → Account A claims $5. No IP, email domain, or account-age gates. | ✅ Fixed (2026-07-17) — Added IP/email domain/age checks | 2 hrs | [Deep Dive Audit 2026-07-18](audits/AUDIT_REMEDIATION_LOG.md) |

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

### 🟡 P2 — Medium Priority

| ID | Item | Status | Effort | Source |
|----|------|--------|--------|--------|
| **BL-OPS-P2-1** | **2FA not implemented** — No TOTP/SMS 2FA. Birth data + psychometric scores protected only by password. | ⚠️ Deferred (Phase 2+) | 2 days | MASTER_BACKLOG (PRA-OPS-004) |
| **BL-OPS-P2-2** | **No error rate dashboards** — No Sentry, DataDog, or centralized error tracking. Production bugs are invisible until user reports. | ✅ Fixed (2026-03-17) — Sentry integration captures all errors with dashboard visibility | 1 day | [Scan 2026-03-17](audits/SCAN_2026-03-17-FRESH.md) |
| **BL-OPS-P2-3** | **Service Worker out of sync detection missing** — App may serve stale code after deploy until user refreshes cache. No "update available" prompt. | ⚠️ Deferred (Phase 2+) | 4 hrs | — |

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

**Document Version:** 2.0  
**Last Updated:** 2026-03-17 @ 14:22 UTC  
**Maintained By:** Agent  
**Sync:** Automatically from audit discoveries; manual review recommended weekly
