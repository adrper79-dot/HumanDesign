# Prime Self — Documentation Index

**Purpose**: Canonical map of the current documentation set  
**Last Verified**: March 9, 2026  
**Audit Basis**: Repo structure, current code, and local test run (`263/263` passing)

---

## Current Status

- **Code baseline**: 263 tests passing locally
- **Documentation cleanup**: broken references and stale status claims removed from canonical docs
- **Backlog hygiene**: Sprint 18 was partially out of date; 11 items were already implemented in code
- **Production status**: not re-verified in this repo-only audit

---

## Start Here

### Product / Stakeholders
1. [README.md](README.md) — project overview and current repo status
2. [audits/REPOSITORY_ASSESSMENT_2026-03-09.md](audits/REPOSITORY_ASSESSMENT_2026-03-09.md) — current assessment, ranking, neglected work
3. [BACKLOG.md](BACKLOG.md) — prioritized backlog with repo-audit delta

### Developers
1. [guides/SETUP_DEVELOPMENT.md](guides/SETUP_DEVELOPMENT.md) — local setup
2. [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture and engine model
3. [CODEBASE_MAP.md](CODEBASE_MAP.md) — current codebase inventory
4. [docs/API.md](docs/API.md) — quick API overview
5. [process/BUILD_BIBLE.md](process/BUILD_BIBLE.md) — implementation standards

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
| [DOCUMENTATION_ORGANIZATION.md](DOCUMENTATION_ORGANIZATION.md) | Documentation structure | Lists current canonical locations only |
| [docs/API.md](docs/API.md) | Quick API reference | Helpful overview, but not exhaustive |
| [docs/API_SPEC.md](docs/API_SPEC.md) | Detailed API spec | Historical and partially stale; verify against router |
| [docs/OPERATION.md](docs/OPERATION.md) | Ops runbook | Deployment, monitoring, rollback |
| [frontend/DESIGN_SYSTEM.md](frontend/DESIGN_SYSTEM.md) | Design system | Canonical location is `frontend/`, not `docs/` |

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
