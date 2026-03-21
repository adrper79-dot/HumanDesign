# Prime Self Launch Testing Philosophy

**Status:** Canonical launch standard  
**Date:** 2026-03-21  
**Scope:** Testing, live verification, observability, analytics calibration, and documentation truth for `https://selfprime.net`

## Core Position

Prime Self should be launched and judged against the live production site, not against mocked assumptions.

The canonical question is not "does the code seem right locally?" It is "does the live system at `https://selfprime.net` work, fail safely, emit usable telemetry, and match the docs?"

## Principles

1. **Production truth beats mock confidence.**
   Launch confidence comes primarily from live checks against `https://selfprime.net` and the production Worker, not from synthetic-only happy-path tests.

2. **Deterministic local tests are the admission gate to production testing.**
   The deterministic suite prevents obviously broken code from reaching deploy. It is necessary, but not sufficient.

3. **Negative testing is mandatory.**
   Every critical surface should prove not only success, but also failure shape, request correlation, monitoring visibility, and analytics calibration.

4. **Mocks are allowed only where live truth is impossible or irresponsible.**
   Use mocks for fast deterministic development feedback, isolated logic coverage, and third-party failure simulation that would be unsafe or flaky against production. Do not use mocks as the final proof that a launch-critical journey works.

5. **Testing, error handling, analytics, and docs ship together.**
   A feature is not complete when only the success path exists. Completion requires:
   - launch-relevant tests
   - negative-path handling
   - operator-visible telemetry
   - documentation updated to match reality

6. **Docs are part of the release surface.**
   If the matrix, checklist, deploy guide, or backlog materially misstates what is live, the system is not launch-ready.

## Canonical Gate Stack

### Layer 1 — Deterministic Development Gate

Purpose: Catch regressions before deploy.

Canonical command:

```bash
npm run test:deterministic
```

This layer should cover:
- deterministic engine behavior
- route contracts
- auth rules
- billing logic
- handled-error pipeline
- observability plumbing that can be proven locally

### Layer 2 — Focused Browser Gate

Purpose: Fast browser confidence for auth and smoke journeys.

Canonical command:

```bash
npm run test:gate
```

This is a component of launch verification, not the top-level launch proof by itself.

### Layer 3 — Live Production Gate

Purpose: Prove that the deployed production system is live, functional, and emitting the expected response contracts.

Canonical command:

```bash
npm run verify:prod:gate -- --strict-browser
```

This is the **canonical launch gate**.

It should verify, against production when credentials are present:
- public site availability
- same-origin worker health
- public API behavior
- authenticated production login/session continuity
- billing money path behavior that is safe to exercise live
- negative validation responses
- request-correlation headers on failure paths
- analytics audit visibility when `AUDIT_SECRET` is available

### Layer 4 — Scheduled Production Canary

Purpose: Detect live drift after deploy.

Canonical enforcement:
- `.github/workflows/prod-canary.yml`

The production canary is not optional polish. It is continuous proof that the launch surface is still real after release.

## Credential Classes

Production testing requires real, dedicated, non-human credentials.

### Required Today

- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`
- `TEST_BASE_URL=https://selfprime.net`
- `PROD_API=https://prime-self-api.adrper79.workers.dev`
- `AUDIT_SECRET`

### Recommended Additional Credential Sets

For complete launch confidence, production-safe accounts should exist for:

1. **Baseline consumer smoke user**
   - standard login/session/browser checks

2. **Billing-enabled user**
   - checkout/session reuse/portal checks that are safe to execute live

3. **Practitioner smoke user**
   - practitioner-only workflows, roster, notes, directory, analytics surfaces

4. **Admin operator token**
   - internal UI and operator route verification

5. **Audit token**
   - analytics and release-truth collection via `X-Audit-Token`

These must be dedicated test identities, not staff primary accounts.

## Negative Testing Standard

A launch-critical feature is not complete until its negative contract is tested.

Minimum negative checks by area:

### Response Contract
- 400 validation failures return safe JSON
- 401/403 auth failures are explicit
- no stack traces or raw provider payloads leak to users
- `X-Request-ID` is present on failure responses where supported

### Observability
- handled 5xx paths emit analytics-backed error capture and Sentry where applicable
- top-level crashes produce durable operator-visible incidents
- critical cron and webhook failures are correlated, not console-only

### Analytics Calibration
- analytics audit endpoint is reachable with `AUDIT_SECRET`
- analytics/auth gates fail correctly without the token
- high-value operator actions and core funnel events are actually emitted live

### Documentation Truth
- feature matrix reflects the real route/UI behavior
- deploy guide reflects the real launch gate
- secrets guide reflects the real credential inventory

## Mocking Policy

Mocks are acceptable for:
- deterministic unit and route logic
- isolated provider-failure simulation
- development-time speed and edge-case coverage

Mocks are not acceptable as the only proof for:
- launch readiness
- live auth/session continuity
- production billing path behavior
- production telemetry/analytics visibility
- documentation truth claims

## Definition Of Done For Launch-Critical Work

A launch-critical feature is done only when all of the following are true:

1. Success path works locally and in production.
2. Negative path is tested.
3. Errors are observable by operators.
4. Analytics are calibrated or explicitly declared absent.
5. Docs and matrix entries match the shipped behavior.
6. Production gate covers the journey directly or through a justified adjacent proof.

## What We Were Missing

The repo already had many of the right mechanisms. What was missing was a single doctrine tying them together.

The main missing pieces were:
- no canonical testing philosophy document
- mismatch between `test:gate` plan language and the real `verify:prod:gate` launch enforcement
- no explicit statement that production truth is the launch authority
- incomplete live verification for analytics audit and negative response contracts
- no documented credential matrix for multiple live access roles
- no explicit rule that docs must be updated in the same delivery loop as tests and telemetry

## Canonical Launch Rule

**Prime Self does not launch because mocks are green. Prime Self launches when the deterministic suite is green, the live production gate is green, negative contracts are verified, telemetry is observable, analytics are calibrated, and the docs tell the truth about the shipped system.**