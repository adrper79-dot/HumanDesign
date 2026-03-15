# Documentation Organization

**Last Verified:** 2026-03-14  
**Purpose:** Describe the current documentation layout, define the canonical set, and distinguish it from historical records

---

## Current Structure

```
HumanDesign/
├── README.md
├── ARCHITECTURE.md
├── BACKLOG.md
├── CODEBASE_MAP.md
├── DOCUMENTATION_INDEX.md
├── DOCUMENTATION_ORGANIZATION.md
├── DOCUMENTATION_SUMMARY.md
├── UX_DEEP_REVIEW.md
├── DEPLOY.md
├── /docs
├── /guides
├── /audits
├── /process
└── /frontend
```

---

## Canonical Files

| Topic | Canonical File | Notes |
|---|---|---|
| Project overview | [README.md](README.md) | Best current summary of repo state |
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md) | Core system and engine overview |
| Code inventory | [CODEBASE_MAP.md](CODEBASE_MAP.md) | Most complete map of handlers and modules |
| Backlog | [BACKLOG.md](BACKLOG.md) | Includes repo-audit status delta |
| Product strategy | [docs/PRACTITIONER_FIRST_90_DAY_ROADMAP.md](docs/PRACTITIONER_FIRST_90_DAY_ROADMAP.md) | Current practitioner-first roadmap |
| Commercial consistency | [audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md](audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md) | Tier, billing, analytics, and white-label audit |
| Ops / deployment | [DEPLOY.md](DEPLOY.md), [docs/OPERATION.md](docs/OPERATION.md) | Deployment plus runbook |
| API docs | [docs/API.md](docs/API.md) and [docs/API_SPEC.md](docs/API_SPEC.md) | Router remains the source of truth for newer routes |
| Design system | [frontend/DESIGN_SYSTEM.md](frontend/DESIGN_SYSTEM.md) | Canonical location is under `frontend/` |
| Process docs | [process/README.md](process/README.md) | Entry point for build/test/change docs |
| Audit docs | [audits/README.md](audits/README.md) | Entry point for review artifacts |

---

## Directory Roles

### Root

- High-signal project documents only.
- Prefer root files for overview, architecture, backlog, and documentation navigation.

### `docs/`

- API references, glossary, ops, product research, and policy documents.
- Some files are historical or partial; verify route details against `workers/src/index.js` and [CODEBASE_MAP.md](CODEBASE_MAP.md).

### `guides/`

- Setup and implementation how-to guides.
- `guides/advanced/` exists but is currently a placeholder directory.

### `audits/`

- Point-in-time audits and remediation logs.
- Useful for history and risk tracking, but not always the best source for current status.
- Treat individual audit grades, test counts, and tactical recommendations as historical unless explicitly re-verified.

### `process/`

- Build standards, testing guidance, UX changelogs, sprint verification, and implementation logs.
- Some process docs are historical snapshots; prefer [process/README.md](process/README.md) and [BACKLOG.md](BACKLOG.md) for current navigation.

### `frontend/`

- Frontend-specific docs plus static assets and the SPA implementation.
- This folder contains the actual design-system document used by the project.

---

## What Was Cleaned Up

- Removed broken references from the documentation index and organization docs.
- Replaced non-existent file names such as `docs/API_REFERENCE.md`, `docs/OPERATIONS.md`, and `docs/DESIGN_SYSTEM.md` with real paths.
- Removed references to non-existent process dashboards such as `process/SPRINT_STATUS.md`, `process/DEFECT_BACKLOG.md`, and `process/FEATURE_BACKLOG.md`.
- Marked the API documentation split as a caveat instead of pretending a missing canonical spec exists.

---

## Maintenance Rules

When updating docs:

1. Update [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) if the best entry point changes.
2. Keep links pointed only at files that actually exist.
3. Treat audit reports and sprint logs as historical unless they are explicitly re-verified.
4. Prefer one canonical file per topic instead of adding new overlapping summaries.
5. Avoid hardcoded counts or pricing details in navigation docs unless they are routinely maintained.
