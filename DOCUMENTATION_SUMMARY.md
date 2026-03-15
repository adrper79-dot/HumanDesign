# Prime Self — Documentation Summary

**Last Verified**: March 14, 2026  
**Scope**: Current canonical documentation set, not point-in-time historical audits or sprint logs

---

## Executive Summary

Prime Self is materially broader than the older documentation implied. The calculation engine, practitioner tooling, agency/white-label surfaces, and integration layer are all real. The main documentation problem was drift: too many old pricing labels, stale status claims, and historical records that looked canonical.

Current documentation baseline:

- **Canonical docs** now prioritize current product, deployment, pricing, and architecture references.
- **Historical docs** remain in place, but they are explicitly treated as point-in-time records.
- **Practitioner-first positioning** is now reflected in the roadmap and audit set.
- **Documentation drift** remains something to manage continuously, especially around tiers, pricing, analytics, and white-label language.

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

## Documentation State After Cleanup

The following canonical docs are the current starting points:

- [README.md](README.md)
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
- [DOCUMENTATION_ORGANIZATION.md](DOCUMENTATION_ORGANIZATION.md)
- [docs/PRACTITIONER_FIRST_90_DAY_ROADMAP.md](docs/PRACTITIONER_FIRST_90_DAY_ROADMAP.md)
- [audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md](audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md)
- [BACKLOG.md](BACKLOG.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/OPERATION.md](docs/OPERATION.md)
- [process/README.md](process/README.md)
- [audits/README.md](audits/README.md)

Primary cleanup themes:

- Broken links to non-existent files removed from the documentation map.
- Fragile hardcoded counts and stale tier names removed from canonical navigation docs.
- Historical material is now distinguished from current-state documentation.
- The design-system location corrected to `frontend/DESIGN_SYSTEM.md`.

---

## Remaining Gaps

These are the most important unresolved gaps after the documentation cleanup:

1. **Canonical API documentation is still split.** `docs/API.md` is useful, but the router remains the true source of truth.
2. **Production verification is still separate work.** Documentation cleanup does not replace live deployment validation.
3. **Historical docs still exist by design.** They should remain available, but they must not be mistaken for current state.
4. **Commercial language drifts easily.** Tiers, pricing, white-label, and distribution wording need periodic review.

---

## Best Current Entry Points

- [README.md](README.md) for project overview
- [audits/REPOSITORY_ASSESSMENT_2026-03-09.md](audits/REPOSITORY_ASSESSMENT_2026-03-09.md) for current ranking and neglected work
- [CODEBASE_MAP.md](CODEBASE_MAP.md) for code inventory
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) for navigation
