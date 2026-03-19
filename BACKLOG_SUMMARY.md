# Backlog Summary — March 19, 2026

## Current State: **1 Open Item**

| Status | Count | Details |
|--------|-------|---------|
| **Open** | **1** | Release-gate reliability in Playwright auth/onboarding coverage |
| **Resolved** | 11 | Completed in Cycle 11 (9) + Cycle 12 (2) |
| **Deferred** | 13 | P3 architecture (8) + ops/infra (5) |
| **Total** | 25 | |

---

## Open Items (1)

1. **BL-TEST-P1-2** — Release gate drift between onboarding timing and Playwright auth smoke

---

## Resolved This Intake

1. **BL-OPS-P1-3** — Vitals output now separates current registry issues from historical references, and vitals-only runs no longer auto-resolve open issues
2. **BL-SEC-P1-4** — Admin token persistence removed from browser storage; admin session is now memory-only in the frontend
3. **BL-BILLING-P1-2** — Agency JSON-LD now matches the visible pricing page and marks unfinished capabilities as coming soon
4. **BL-DOCS-P1-2** — Audited public referral, gift, share, and Terms copy now uses Energy Blueprint and Agency naming

---

## Resolved Items (11)

### Cycle 11 (9 items)
1. **BL-SOCIAL-C1** — Twitter intent + clipboard share buttons in chart render
2. **BL-UX-M1** — Mobile drawer nav tab context via MOBILE_TAB_GROUPS mapping
3. **BL-EXC-P2-1** — Unified skeleton loading states via `showSkeleton()` utility
4. **BL-EXC-P2-2** — Actionable error messages via ERROR_COPY map + `showError()` function
5. **BL-S20-H2** — Structured degradation events via `emitDegradeEvent()` in analytics.js
6. **BL-MV-N4** — RESEND_API_KEY visibility verified in health endpoint
7. **BL-UX-C5** — Birth data banner + `clearBirthData()` in restoreBirthData()
8. **BL-UX-H1** — gate-data.js loader created (64 I Ching names)
9. **BL-UX-C3** — Gate names now display in chart via getGateName()

### Cycle 12 (2 items)
10. **BL-M17** — Practitioner-first messaging across home, pricing, onboarding, workspace
11. **BL-MV-N4 (verified as resolved via health endpoint already exposed)**

---

## Deferred Items (13) — P3/Ops Scope

### UI/CSS Refactoring (5 items)
- **BL-UX-C6** — 13 tabs consolidation (IA restructuring required)
- **BL-UX-H2** — app.js module extraction (~3000 lines)
- **BL-UX-H3** — CSS module extraction (~600 lines)
- **BL-UX-H4** — Design token refactor (spacing)
- **BL-UX-H5** — Typography token refactor (font sizes)

### Operations/Infrastructure (5 items)
- **BL-S20-H3** — External synthetic monitoring for critical journeys
- **BL-S20-M2** — Structured logging contract + correlation IDs
- **BL-S20-M3** — Release gates (tests + coverage + canary checks)
- **BL-EXC-P3-2** — Per-tier API rate limiting (global rate limiting exists)
- **BL-EXC-P3-3** — Neon connection pooling configuration

### Architecture/Deployment (3 items)
- **BL-EXC-P3-4** — API versioning (currently frontend + worker deploy as unit)
- **BL-S20-C1** — Coverage enforcement restoration
- **BL-S20-C2** — Production verification assertiveness

---

## Tests: 480 Passing | 8 Skipped

Baseline maintained throughout all cycles. No regressions on UI/UX changes.

---

## Next Steps

1. **Close the final gate issue**: verify BL-TEST-P1-2 with browser execution using env-backed auth credentials
2. **Rerun vitals after Playwright verification**: leave the backlog at zero open items only after the final browser gate passes cleanly

---

**Status**: 🟠 **Hardening loop active** — deployment should remain gated until the final release-gate issue is verified and closed.
