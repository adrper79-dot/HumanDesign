# Prime Self — Documentation Index

**Purpose**: Canonical map of the current documentation set  
**Last Verified**: March 15, 2026  
**Audit Basis**: Repo structure, current code, and targeted documentation cleanup

---

## Current Status

- **Canonical docs** are now separated from historical audit/process material.
- **Hardcoded status claims** should be avoided in canonical docs unless they are routinely re-verified.
- **Backlog and audit records** remain useful, but they are not the default source of truth for current product state.
- **Production status** still requires live verification before any release decision.

---

## Start Here

### Product / Stakeholders
1. [PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md) — **read this first** — design principles, user journeys, fitness test, and canonical vocabulary that govern every build decision
2. [README.md](README.md) — project overview and current repo status
3. [audits/REPOSITORY_ASSESSMENT_2026-03-09.md](audits/REPOSITORY_ASSESSMENT_2026-03-09.md) — current assessment, ranking, neglected work
4. [BACKLOG.md](BACKLOG.md) — prioritized backlog with repo-audit delta
5. [docs/PRACTITIONER_FIRST_90_DAY_ROADMAP.md](docs/PRACTITIONER_FIRST_90_DAY_ROADMAP.md) — practitioner-first product, pricing, and GTM plan
6. [docs/PRACTITIONER_EXECUTION_ROADMAP_2026-03-16.md](docs/PRACTITIONER_EXECUTION_ROADMAP_2026-03-16.md) — build-validated practitioner execution plan and first-pass scope
7. [docs/PRACTITIONER_EXPERIENCE_DESIGN_PLAN_2026-03-16.md](docs/PRACTITIONER_EXPERIENCE_DESIGN_PLAN_2026-03-16.md) — expert-level practitioner customer workflow, screen architecture, and build design plan
8. [docs/PRACTITIONER_IMPLEMENTATION_BACKLOG_2026-03-16.md](docs/PRACTITIONER_IMPLEMENTATION_BACKLOG_2026-03-16.md) — P0/P1 practitioner work mapped to concrete files and handlers
9. [docs/PRACTITIONER_LAUNCH_CHECKLIST_2026-03-16.md](docs/PRACTITIONER_LAUNCH_CHECKLIST_2026-03-16.md) — launch gate mapped to UI practitioner test coverage
10. [audits/UX_RERANK_2026-03-17.md](audits/UX_RERANK_2026-03-17.md) — current open UX items re-ranked by journey impact using PRODUCT_PRINCIPLES.md
11. [audits/FEATURE_ARCHITECTURE_SCAN_2026-03-17.md](audits/FEATURE_ARCHITECTURE_SCAN_2026-03-17.md) — full feature-by-feature architecture scan: core vs sharpen vs bound vs hold
12. [audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md](audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md) — focused commercial consistency audit

### Developers
1. [guides/SETUP_DEVELOPMENT.md](guides/SETUP_DEVELOPMENT.md) — local setup
2. [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture and engine model
3. [CODEBASE_MAP.md](CODEBASE_MAP.md) — current codebase inventory
4. [docs/API.md](docs/API.md) — quick API overview
5. [process/BUILD_BIBLE.md](process/BUILD_BIBLE.md) — implementation standards
6. [process/RELIABILITY_POLICY.md](process/RELIABILITY_POLICY.md) — active policy for tests, verification, simulation, and monitoring
7. [process/PRIME_SELF_LOOP_V2.md](process/PRIME_SELF_LOOP_V2.md) — **THE LOOP** enterprise build & certification cycle protocol (full specification)
8. [process/LOOP_INVOCATION.md](process/LOOP_INVOCATION.md) — **THE LOOP** quick invocation guide with ready-to-use prompts

### Frontend / UX
1. [frontend/DESIGN_SYSTEM.md](frontend/DESIGN_SYSTEM.md) — design tokens and UI rules
2. [frontend/SUMMARY.md](frontend/SUMMARY.md) — frontend overview
3. [audits/FRONTEND_AUDIT.md](audits/FRONTEND_AUDIT.md) — frontend findings
4. [UX_DEEP_REVIEW.md](UX_DEEP_REVIEW.md) — UX strategy and product-level critique

### Ops / Deployment
1. [DEPLOY.md](DEPLOY.md) — deployment process
2. [docs/OPERATION.md](docs/OPERATION.md) — operations runbook
3. [guides/ENVIRONMENT_VARIABLES.md](guides/ENVIRONMENT_VARIABLES.md) — configuration and secrets

---

## Canonical References

| Document | Use For | Notes |
|---|---|---|
| [README.md](README.md) | Project overview | Best current summary of repo state |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture | Core engine + platform overview |
| [CODEBASE_MAP.md](CODEBASE_MAP.md) | Code inventory | Most complete map of handlers and modules |
| [BACKLOG.md](BACKLOG.md) | Current backlog | Includes audit delta for shipped Sprint 18 items |
| [process/RELIABILITY_POLICY.md](process/RELIABILITY_POLICY.md) | Reliability operating policy | Canonical truth standard for testing, simulation, verification, and monitoring |
| [docs/PRACTITIONER_FIRST_90_DAY_ROADMAP.md](docs/PRACTITIONER_FIRST_90_DAY_ROADMAP.md) | Practitioner strategy | 90-day product, pricing, and GTM priorities |
| [docs/PRACTITIONER_EXECUTION_ROADMAP_2026-03-16.md](docs/PRACTITIONER_EXECUTION_ROADMAP_2026-03-16.md) | Practitioner execution roadmap | Build-validated first-pass scope, sequencing, and tool improvements |
| [docs/PRACTITIONER_EXPERIENCE_DESIGN_PLAN_2026-03-16.md](docs/PRACTITIONER_EXPERIENCE_DESIGN_PLAN_2026-03-16.md) | Practitioner experience design plan | Customer workflow, screen architecture, state model, and build requirements |
| [docs/PRACTITIONER_IMPLEMENTATION_BACKLOG_2026-03-16.md](docs/PRACTITIONER_IMPLEMENTATION_BACKLOG_2026-03-16.md) | Practitioner implementation backlog | P0/P1 work items tied to routes, handlers, and files |
| [docs/PRACTITIONER_LAUNCH_CHECKLIST_2026-03-16.md](docs/PRACTITIONER_LAUNCH_CHECKLIST_2026-03-16.md) | Practitioner launch checklist | Launch-readiness gate mapped to UI practitioner acceptance coverage |
| [audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md](audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md) | Commercial consistency audit | Tier, billing, analytics, and white-label findings |
| [DOCUMENTATION_ORGANIZATION.md](DOCUMENTATION_ORGANIZATION.md) | Documentation structure | Lists current canonical locations only |
| [docs/API.md](docs/API.md) | Quick API reference | Updated 2026-03-15: celebrity comparison + account management sections added |
| [docs/API_SPEC.md](docs/API_SPEC.md) | Detailed API spec | Updated 2026-03-15: celebrity comparison, account deletion, data export sections added. Error format includes `ok: false` |
| [docs/OPERATION.md](docs/OPERATION.md) | Ops runbook | Deployment, monitoring, rollback |
| [frontend/DESIGN_SYSTEM.md](frontend/DESIGN_SYSTEM.md) | Design system | Canonical location is `frontend/`, not `docs/` |

---

## Historical / Point-In-Time Docs

Use these for context, not as the default source of truth:

- [audits/README.md](audits/README.md) — point-in-time audit catalog
- [process/README.md](process/README.md) — build logs, changelogs, and sprint history
- [MASTER_BACKLOG.md](MASTER_BACKLOG.md) — aggregated historical backlog and audit log
- [FEATURE_CHECKLIST.md](FEATURE_CHECKLIST.md) — working inventory, not a canonical launch/status document

---

## Directory Guide

| Directory | Contains |
|---|---|
| [docs](docs) | API, glossary, operations, research, tiering |
| [guides](guides) | Setup and integration guides |
| [audits](audits) | Review artifacts and audit reports |
| [process](process) | Build standards, logs, changelogs, test plans |
| [frontend](frontend) | Frontend docs plus static app assets |

---

## Known Caveats

- `docs/API.md` and `docs/API_SPEC.md` are both useful, but the actual router in `workers/src/index.js` is the source of truth for newer routes.
- Historical audit and sprint documents intentionally preserve point-in-time findings. Prefer the files listed above for current state.
- The `guides/advanced/` directory exists but does not currently contain published guides.
