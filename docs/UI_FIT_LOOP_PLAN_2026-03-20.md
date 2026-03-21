# Prime Self — UI Fit Loop Plan
**Created:** 2026-03-20
**Source:** repo-grounded UI review after guidance architecture completion
**Owner:** Product + Frontend Engineering
**Status:** Completed

---

## Objective

Bring the shell into a cleaner, more trustworthy, more product-fit state **without weakening first-time-user comprehension or practitioner workflow clarity**.

This plan assumes the guidance architecture already exists. The remaining job is not to add more explanation. The remaining job is to make the current explanation land through better hierarchy, fewer duplicate workflows, and less competing chrome.

---

## Current-State Diagnosis

The current codebase has already solved the hardest guidance problem: users are no longer abandoned inside unexplained jargon. The remaining fit problems are structural.

### 1. Arrival is split across conflicting entry stories

- Overview fallback in `frontend/index.html` still defaults to a practitioner-first pitch.
- Runtime overview in `frontend/js/app.js` pushes a chart-first personal journey for non-practitioners.
- First-run onboarding is chart-first but still acts like a separate entry product.

**Consequence:** the user sees multiple valid "start here" stories before understanding what the primary path is.

### 2. Birth data is still collected in three places

- Onboarding collects it.
- Chart collects it.
- Profile still visually collects it again, even though app.js auto-syncs Chart -> Profile.

**Consequence:** the code already treats chart data as canonical, but the UI still asks the user to re-evaluate the same identity object.

### 3. Shell chrome still competes with itself

- Sidebar + journey guide + section orientation + local chart/profile sub-tabs + header actions all stack in the same viewport.
- Mobile simplifies some of this, but through a second navigation model rather than a single coherent one.

**Consequence:** meaning is preserved, but hierarchy is not. The product feels busier than it needs to.

### 4. Account controls are visually overweight in the header

- Billing, logout, export, security, delete, notifications, language, theme, and upgrade all coexist in the top bar.

**Consequence:** account-management chrome competes with the user's real job.

---

## Product Constraints

These loops must comply with `PRODUCT_PRINCIPLES.md`:

- Principle 2: Synthesis Over Information
- Principle 3: Plain Language First, Depth on Demand
- Principle 4: Earn the Next Step
- Principle 6: One Truth, One Source
- Principle 8: The Practitioner's Commercial Integrity is the Product's Commercial Integrity

Additional fit constraints:

- Do not reduce guidance availability in order to reduce visual density.
- Do not keep duplicate workflow entry purely because the backend can tolerate it.
- Do not add a new navigation surface when one of the existing ones can become canonical.
- Do not allow signed-out fallback UI to disagree with hydrated runtime UI.

---

## Loop Order

| Loop | ID | Goal | Outcome |
|------|----|------|---------|
| 0 | FIT-EPIC | Canonical UI fit workstream | Deep plan, validation contract, and loop ordering |
| 1 | FIT-001 | Unify arrival model | One canonical chart-first start for personal users, practitioner route still visible but secondary until intent or tier makes it primary |
| 2 | FIT-002 | Remove profile birth-data duplication | Profile reads from chart as the canonical source; duplicate entry is removed from visible UX |
| 3 | FIT-003 | Simplify shell chrome | Remove redundant local nav and collapse account controls behind one account surface |
| 4 | FIT-004 | Add UI-fit regression gate | Prevent reintroduction of duplicate entry paths or header/nav overgrowth |

---

## Loop Definitions

## FIT-001 — Unify Arrival Model

**User Story:** As a first-time user landing on Prime Self, when I decide whether I am here for my own reading or for practice work, I need the product to present one primary starting path and one clearly secondary route, so that I do not have to interpret the product architecture before using it.

### Work

1. Make signed-out fallback overview match the hydrated runtime story.
2. Keep personal arrival chart-first.
3. Keep practitioner entry explicit, but not as the default signed-out hero unless the user is already a practitioner-tier user.
4. Align first-run onboarding tone with the same arrival contract.

### Done Definition

- Fallback overview and hydrated overview no longer contradict each other.
- The product has one clear primary action for first-time personal users.
- Practitioner route remains visible without hijacking first-time personal arrival.

---

## FIT-002 — Single-Source Birth Data For Profile

**User Story:** As a user moving from chart into synthesis, when I open AI Profile, I need it to use the chart data I already provided instead of asking me to enter it again, so that the workflow feels continuous and trustworthy.

### Work

1. Treat Chart as the visible source-of-truth editor for birth data.
2. Keep `p-*` fields populated in the DOM for compatibility, but remove them from the visible profile workflow.
3. Replace duplicate visible entry with a compact summary surface and an `Edit chart data` route back to Chart.
4. Disable profile generation when chart context is missing.

### Done Definition

- Profile no longer shows a second visible birth-data form.
- Profile generation still works with the existing request payload.
- Users can clearly see which chart data the synthesis is using.

---

## FIT-003 — Shell Chrome Consolidation

**User Story:** As a user navigating the product, when I move between chart, profile, daily, and practitioner workflows, I need one dominant navigation model and one clearly subordinate guidance model, so that the interface feels intentional instead of layered by history.

### Work

1. Remove redundant chart/profile local sub-tabs.
2. Keep the step guide and sidebar as the canonical navigation pair for the core journey.
3. Collapse signed-in account-management controls into one account surface.
4. Preserve notifications, upgrade, and auth state visibility without letting the header become an admin toolbar.

### Done Definition

- Chart/profile no longer carry a redundant local tab bar.
- The header has fewer simultaneous controls.
- The user can still reach billing, security, export, and delete actions through one explicit account surface.

---

## FIT-004 — UI Fit Regression Gate

**User Story:** As a maintainer iterating on the shell, when a future cleanup lands, I need deterministic checks for duplicated entry paths and redundant shell chrome, so that the interface does not drift back into overlap after this pass.

### Work

1. Add a lightweight Vitest guard for:
	- unified arrival copy anchors
	- profile birth-data summary shell
	- account menu shell
	- removal of local chart/profile sub-tabs
2. Add a package script for the guard.

### Done Definition

- Future changes can detect regression of the specific fit problems addressed in this plan.

---

## Validation Protocol

Every loop must pass both:

1. Code validation
	- no diagnostics in touched files
	- targeted regression tests pass

2. Product validation
	- first-time personal user sees one obvious start
	- profile clearly depends on chart, not duplicate input
	- shell has fewer competing controls than before
	- account actions are still reachable, but no longer dominate the header

---

## Execution Standard

The loops should be executed in order and closed only when the rendered UX, runtime behavior, and regression coverage all agree.

This is a product-fit pass, not a visual restyle pass.

---

## Completion Notes

**Completed:** 2026-03-20

### Closed Loops

- `FIT-001` closed by aligning signed-out fallback overview, first-run onboarding copy, and the chart-first personal journey in the shell.
- `FIT-002` closed by treating Chart as the visible source of truth for Profile, hiding duplicate profile birth-data fields, and rendering a chart-source summary with a direct route back to Chart.
- `FIT-003` closed by removing redundant Chart/Profile local sub-tabs and consolidating billing, export, security, delete, and sign-out actions into one account menu surface.
- `FIT-004` closed by extending the guidance regression harness to cover chart-first arrival anchors, account-menu shell anchors, and the profile chart-source shell.

### Validation Result

- Diagnostics: no errors in touched JS, CSS, or test files.
- Regression check: `npm run test:guidance` passed.
- Runtime contract preserved: Profile still submits the existing `p-*` payload fields while reading them from the chart-synced source.

### Notes

- Existing guidance architecture was preserved; this pass reduced overlap rather than adding more explanation surfaces.
- The `test:guidance` package script already existed, so FIT-004 was satisfied by strengthening the harness instead of creating another script alias.
