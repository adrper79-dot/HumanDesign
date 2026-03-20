# Prime Self — Documentation Overview

**Purpose**: Canonical map of the current documentation set, directory structure, and project snapshot  
**Last Verified**: March 15, 2026  
**Note**: This file supersedes `DOCUMENTATION_INDEX.md`, `DOCUMENTATION_ORGANIZATION.md`, and `DOCUMENTATION_SUMMARY.md`

---

## Current Status

- **Canonical docs** are now separated from historical audit/process material.
- **Hardcoded status claims** should be avoided in canonical docs unless they are routinely re-verified.
- **Backlog and audit records** remain useful, but they are not the default source of truth for current product state.
- **Production status** still requires live verification before any release decision.

---

## Start Here

### Product / Stakeholders
1. [../PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md) — **read this first** — design principles, user journeys, fitness test, and canonical vocabulary that govern every build decision
2. [../README.md](../README.md) — project overview and current repo status
3. [../audits/REPOSITORY_ASSESSMENT_2026-03-09.md](../audits/REPOSITORY_ASSESSMENT_2026-03-09.md) — current assessment, ranking, neglected work
4. [../BACKLOG.md](../BACKLOG.md) — prioritized backlog with repo-audit delta
5. [PRACTITIONER_FIRST_90_DAY_ROADMAP.md](PRACTITIONER_FIRST_90_DAY_ROADMAP.md) — practitioner-first product, pricing, and GTM plan
6. [PRACTITIONER_EXECUTION_ROADMAP_2026-03-16.md](PRACTITIONER_EXECUTION_ROADMAP_2026-03-16.md) — build-validated practitioner execution plan and first-pass scope
7. [PRACTITIONER_EXPERIENCE_DESIGN_PLAN_2026-03-16.md](PRACTITIONER_EXPERIENCE_DESIGN_PLAN_2026-03-16.md) — expert-level practitioner customer workflow, screen architecture, and build design plan
8. [PRACTITIONER_IMPLEMENTATION_BACKLOG_2026-03-16.md](PRACTITIONER_IMPLEMENTATION_BACKLOG_2026-03-16.md) — P0/P1 practitioner work mapped to concrete files and handlers
9. [PRACTITIONER_LAUNCH_CHECKLIST_2026-03-16.md](PRACTITIONER_LAUNCH_CHECKLIST_2026-03-16.md) — launch gate mapped to UI practitioner test coverage
10. [../audits/UX_RERANK_2026-03-17.md](../audits/UX_RERANK_2026-03-17.md) — current open UX items re-ranked by journey impact using PRODUCT_PRINCIPLES.md
11. [../audits/FEATURE_ARCHITECTURE_SCAN_2026-03-17.md](../audits/FEATURE_ARCHITECTURE_SCAN_2026-03-17.md) — full feature-by-feature architecture scan: core vs sharpen vs bound vs hold
12. [../audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md](../audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md) — focused commercial consistency audit

### Developers
1. [../guides/SETUP_DEVELOPMENT.md](../guides/SETUP_DEVELOPMENT.md) — local setup
2. [../ARCHITECTURE.md](../ARCHITECTURE.md) — system architecture and engine model
3. [CODEBASE_MAP.md](CODEBASE_MAP.md) — current codebase inventory
4. [API.md](API.md) — quick API overview
5. [../process/BUILD_BIBLE.md](../process/BUILD_BIBLE.md) — implementation standards
6. [../process/RELIABILITY_POLICY.md](../process/RELIABILITY_POLICY.md) — active policy for tests, verification, simulation, and monitoring
7. [../process/PRIME_SELF_LOOP_V2.md](../process/PRIME_SELF_LOOP_V2.md) — **THE LOOP** enterprise build & certification cycle protocol (full specification)
8. [../process/LOOP_INVOCATION.md](../process/LOOP_INVOCATION.md) — **THE LOOP** quick invocation guide with ready-to-use prompts

### Frontend / UX
1. [../frontend/DESIGN_SYSTEM.md](../frontend/DESIGN_SYSTEM.md) — design tokens and UI rules
2. [../frontend/SUMMARY.md](../frontend/SUMMARY.md) — frontend overview
3. [../audits/FRONTEND_AUDIT.md](../audits/FRONTEND_AUDIT.md) — frontend findings
4. [../audits/UX_DEEP_REVIEW.md](../audits/UX_DEEP_REVIEW.md) — UX strategy and product-level critique

### Ops / Deployment
1. [../DEPLOY.md](../DEPLOY.md) — deployment process
2. [OPERATION.md](OPERATION.md) — operations runbook
3. [../guides/ENVIRONMENT_VARIABLES.md](../guides/ENVIRONMENT_VARIABLES.md) — configuration and secrets

---

## Canonical References

| Document | Use For | Notes |
|---|---|---|
| [../README.md](../README.md) | Project overview | Best current summary of repo state |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | System architecture | Core engine + platform overview |
| [CODEBASE_MAP.md](CODEBASE_MAP.md) | Code inventory | Most complete map of handlers and modules |
| [../BACKLOG.md](../BACKLOG.md) | Current backlog | Includes audit delta for shipped Sprint 18 items |
| [../process/RELIABILITY_POLICY.md](../process/RELIABILITY_POLICY.md) | Reliability operating policy | Canonical truth standard for testing, simulation, verification, and monitoring |
| [PRACTITIONER_FIRST_90_DAY_ROADMAP.md](PRACTITIONER_FIRST_90_DAY_ROADMAP.md) | Practitioner strategy | 90-day product, pricing, and GTM priorities |
| [PRACTITIONER_EXECUTION_ROADMAP_2026-03-16.md](PRACTITIONER_EXECUTION_ROADMAP_2026-03-16.md) | Practitioner execution roadmap | Build-validated first-pass scope, sequencing, and tool improvements |
| [PRACTITIONER_EXPERIENCE_DESIGN_PLAN_2026-03-16.md](PRACTITIONER_EXPERIENCE_DESIGN_PLAN_2026-03-16.md) | Practitioner experience design plan | Customer workflow, screen architecture, state model, and build requirements |
| [PRACTITIONER_IMPLEMENTATION_BACKLOG_2026-03-16.md](PRACTITIONER_IMPLEMENTATION_BACKLOG_2026-03-16.md) | Practitioner implementation backlog | P0/P1 work items tied to routes, handlers, and files |
| [PRACTITIONER_LAUNCH_CHECKLIST_2026-03-16.md](PRACTITIONER_LAUNCH_CHECKLIST_2026-03-16.md) | Practitioner launch checklist | Launch-readiness gate mapped to UI practitioner acceptance coverage |
| [../audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md](../audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md) | Commercial consistency audit | Tier, billing, analytics, and white-label findings |
| [API.md](API.md) | Quick API reference | Updated 2026-03-15: celebrity comparison + account management sections added |
| [API_SPEC.md](API_SPEC.md) | Detailed API spec | Updated 2026-03-15: celebrity comparison, account deletion, data export sections added |
| [OPERATION.md](OPERATION.md) | Ops runbook | Deployment, monitoring, rollback |
| [../frontend/DESIGN_SYSTEM.md](../frontend/DESIGN_SYSTEM.md) | Design system | Canonical location is `frontend/`, not `docs/` |

---

## Historical / Point-In-Time Docs

Use these for context, not as the default source of truth:

- [../audits/README.md](../audits/README.md) — point-in-time audit catalog
- [../process/README.md](../process/README.md) — build logs, changelogs, and sprint history
- [MASTER_BACKLOG_SYSTEM_V2.md](../MASTER_BACKLOG_SYSTEM_V2.md) — aggregated historical backlog and audit log
- [FEATURE_CHECKLIST.md](FEATURE_CHECKLIST.md) — working inventory, not a canonical launch/status document

---

## Directory Structure

```
HumanDesign/
├── README.md               ← project overview
├── ARCHITECTURE.md         ← system architecture
├── BACKLOG.md              ← current prioritized backlog
├── DEPLOY.md               ← deployment process
├── PRODUCT_PRINCIPLES.md   ← product principles and vocabulary
├── CONTRIBUTING.md         ← contribution guide
├── SECURITY.md             ← security policy
├── SECRETS_GUIDE.md        ← secrets management
├── docs/                   ← API, ops, strategy, product docs
├── guides/                 ← setup and integration how-tos
├── audits/                 ← point-in-time review artifacts
├── process/                ← build standards, logs, changelogs
└── frontend/               ← design system + SPA assets
```

---

## Directory Roles

### Root
High-signal project documents only. Prefer root files for overview, architecture, backlog, and documentation navigation.

### `docs/`
API references, glossary, ops, product research, and policy documents. Some files are historical or partial; verify route details against `workers/src/index.js` and [CODEBASE_MAP.md](CODEBASE_MAP.md).

### `guides/`
Setup and implementation how-to guides. `guides/advanced/` exists but is currently a placeholder directory.

### `audits/`
Point-in-time audits and remediation logs. Useful for history and risk tracking, but not always the best source for current status. Treat individual audit grades, test counts, and tactical recommendations as historical unless explicitly re-verified.

### `process/`
Build standards, testing guidance, UX changelogs, sprint verification, and implementation logs. Some process docs are historical snapshots; prefer [../process/README.md](../process/README.md) and [../BACKLOG.md](../BACKLOG.md) for current navigation.

### `frontend/`
Frontend-specific docs plus static assets and the SPA implementation. This folder contains the actual design-system document used by the project.

---

## Maintenance Rules

When updating docs:

1. Update this file (`docs/OVERVIEW.md`) if the best entry point changes.
2. Keep links pointed only at files that actually exist.
3. Treat audit reports and sprint logs as historical unless they are explicitly re-verified.
4. Prefer one canonical file per topic instead of adding new overlapping summaries.
5. Avoid hardcoded counts or pricing details in navigation docs unless they are routinely maintained.

---

## Application Snapshot

### Backend
- `workers/src/index.js` uses a table-driven router with a broad API surface across auth, charting, profiles, billing, notifications, onboarding, clusters, practitioner features, analytics, and integrations.
- The codebase contains 30+ handler modules rather than the smaller API footprint implied by older docs.
- The database and deployment story still need operational re-verification; this audit did not re-run production checks.

### Frontend
- `frontend/index.html` is still a very large single-file shell, but it now drives a materially richer UX than the older docs described.
- `frontend/js/` contains focused modules for bodygraph rendering, explanations, i18n, offline transit support, lazy loading, asset randomization, and share-card generation.
- Several Sprint 18 UX items were already implemented but never reflected back into backlog/build documentation.

### Engine
- The 8-layer core calculation model remains the architectural backbone.
- Supporting systems such as numerology, Gene Keys, Vedic, and Ogham are present in the repo and should be treated as companion subsystems in architecture docs.

---

## Remaining Gaps

These are the most important unresolved gaps after the documentation cleanup:

1. **Canonical API documentation is still split.** `docs/API.md` is useful, but the router remains the true source of truth.
2. **Production verification is still separate work.** Documentation cleanup does not replace live deployment validation.
3. **Historical docs still exist by design.** They should remain available, but they must not be mistaken for current state.
4. **Commercial language drifts easily.** Tiers, pricing, white-label, and distribution wording need periodic review.

---

## Known Caveats

- `docs/API.md` and `docs/API_SPEC.md` are both useful, but the actual router in `workers/src/index.js` is the source of truth for newer routes.
- Historical audit and sprint documents intentionally preserve point-in-time findings. Prefer the files listed above for current state.
- The `guides/advanced/` directory exists but does not currently contain published guides.
