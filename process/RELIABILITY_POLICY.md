# Prime Self Reliability Policy

**Status:** Active policy  
**Effective:** March 15, 2026  
**Scope:** Testing, simulation, verification, error handling, monitoring, reporting, and release gating

---

## 1. Purpose

Prime Self must operate as a practitioner-grade system that can be trusted with minimal human babysitting. The platform therefore treats reliability as a product requirement, not an implementation detail.

This policy exists to ensure that test results, simulations, production verification, error handling, monitoring, and reporting are:

- truthful
- deterministic where possible
- explicit about uncertainty where determinism is not possible
- actionable under failure
- suitable for release gating

No script, dashboard, or report may be treated as evidence unless it can fail on drift and produce concrete signals.

---

## 2. Core Principles

### 2.1 Truth Over Green

A passing check that tolerates drift is a defect. Verification must fail when contracts break.

### 2.2 Determinism Over Convenience

Tests must prefer deterministic inputs, deterministic assertions, deterministic fixtures, and deterministic expected outputs. Non-deterministic checks must declare their uncertainty and may not be used as sole release gates.

### 2.3 Contracts Over Logging

Printing output is not verification. A verifier must assert status, schema, invariants, and critical side effects, then exit non-zero on failure.

### 2.4 Degradation Must Be Observable

Any approved fail-open or graceful-degradation path must emit a structured, queryable signal with severity and context.

### 2.5 Release Gates Must Reflect Reality

Coverage, tests, simulations, and production verification are only valid if the underlying tooling is installed, current, and exercised in CI or pre-release workflows.

### 2.6 Monitoring Is Part of the Product

If an error can materially affect practitioner operations, billing, delivery, or customer trust, it must be captured, classified, and reportable.

---

## 3. Reliability Standards

### 3.1 Test Standards

Prime Self must maintain the following test layers:

1. Unit tests for deterministic engine logic, pure transforms, parsing, and tier logic.
2. Integration tests for Workers handlers, middleware, queries, and schema-dependent flows.
3. Contract tests for critical API endpoints with schema and status assertions.
4. Journey tests for practitioner-critical flows: auth, chart generation, profile generation, billing start, webhook fulfillment, practitioner embed validation, and health checks.
5. Migration and schema verification tests for the production DB contract.

All critical-path tests must assert:

- HTTP status
- response shape
- critical invariants
- side effects where applicable
- failure mode where applicable

### 3.2 Coverage Standards

Coverage is only valid if the coverage provider is installed and running non-interactively.

Coverage policy:

- changed-line coverage is required for critical-path modifications
- aggregate line coverage may not be used alone as proof of safety
- coverage reports must be generated in CI and locally reproducible
- a missing coverage provider is a broken gate, not a warning

### 3.3 Simulation Standards

Simulation assets must match the live API contract.

Required simulation rules:

- load tests must hit real current routes
- request bodies must match live handler expectations
- thresholds must correspond to exercised metrics
- permissive assertions such as accepting both success and failure for the same contract are prohibited unless explicitly marked exploratory
- failure-injection scenarios must be distinct from throughput scenarios

### 3.4 Verification Standards

Verification scripts must be deterministic and assertive.

Required verifier behavior:

- explicit expected status per endpoint
- payload validation for required keys and invariants
- non-zero exit on any failure
- summary output that distinguishes pass, warning, and fail
- no stale assumptions about response fields

### 3.5 Error Handling Standards

Error handling must separate:

- user-safe client responses
- structured operator-facing signals
- durable monitoring events

Rules:

- internal error detail may not leak to clients in production
- errors must be typed or classified where business impact differs
- approved fail-open paths must emit explicit degradation events
- retries must be bounded and idempotent where possible
- silent drops are prohibited on billing, practitioner delivery, auth, quota, webhook, and export paths

### 3.6 Logging Standards

Backend logs must be structured JSON for operationally significant events.

Minimum required fields for critical logs:

- event
- severity
- release
- environment
- route
- request_id
- user_id when available
- dependency when applicable
- retryable
- error_class

Console-only string logs are acceptable for local debugging but are not sufficient for production-critical workflows.

### 3.7 Monitoring Standards

Production monitoring must provide evidence for:

- uptime of critical endpoints
- error volume by route and class
- dependency failures
- webhook delivery failures and retry backlog
- billing flow regressions
- latency regression on chart and profile generation
- release-to-incident correlation

At minimum, Prime Self must maintain:

- centralized exception capture
- durable application error events
- live health and dependency checks
- synthetic journey monitoring
- alert routing for critical regressions

### 3.8 Reporting Standards

Operational reporting must answer:

- what failed
- how often
- who was affected
- whether the system self-healed
- whether alerts fired correctly

Reports must be built from system signals, not manually interpreted console output.

---

## 4. Release Gates

No production deployment may be treated as trustworthy unless the following pass:

1. unit and integration test suite
2. coverage run with functioning provider
3. contract verification for critical endpoints
4. post-deploy production verifier with non-zero fail behavior
5. canary checks for critical practitioner journeys

Blocking failures must stop release promotion.

---

## 5. Approved Exceptions

An exception to this policy requires all of the following:

- documented rationale
- explicit scope and expiry date
- named owner
- compensating control
- backlog item to remove the exception

"We will remember to check manually" is not a compensating control.

---

## 6. Immediate Execution Priorities

Priority 1:

- repair broken coverage enforcement
- convert production verification from observational to assertive
- align simulation scripts to live routes and payloads

Priority 2:

- add tests for Sentry and error pipeline behavior
- keep shared auth/user lookup helpers under focused regression coverage so safe-query guarantees do not drift
- convert critical fail-open paths into tracked degradation events
- add structured log schema and correlation IDs

Priority 3:

- add external synthetic monitoring for core journeys
- define SLOs and alert thresholds
- enforce release gates in deployment workflows

---

## 7. Definition of World Class for Prime Self

Prime Self is world class when:

- critical-path behavior is continuously proven, not inferred
- simulated traffic reflects real contracts
- degraded states are visible and alertable
- verification fails on drift immediately
- every release has reproducible evidence that charting, profiles, billing, and practitioner delivery still work

Until then, the system should be described accurately as improving reliability rather than assumed reliable.