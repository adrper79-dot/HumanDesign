# Practitioner Implementation Backlog

Date: 2026-03-16
Source of truth: docs/PRACTITIONER_EXECUTION_ROADMAP_2026-03-16.md
Scope: P0 and P1 practitioner work, tied to current files and route handlers

---

## P0 Now

### PRAC-P0-01 — Lock Note Updates To Practitioner Ownership
Status: shipped in code
Problem: note updates were previously scoped only by `noteId`, which allowed a practitioner note mutation path without practitioner ownership in SQL.
Files:
- workers/src/handlers/session-notes.js
- workers/src/db/queries.js
Handlers / queries:
- `handleUpdateNote`
- `QUERIES.updateSessionNote`
Acceptance:
- update succeeds only when `noteId` belongs to the authenticated practitioner's roster
- cross-practitioner update attempt returns 404 or 403, never mutates data
Regression:
- tests/practitioner-runtime.test.js

### PRAC-P0-02 — Complete Invite Redemption Flow
Status: shipped in code
Problem: invitation creation existed, but acceptance was not wired into a real client workflow.
Files:
- workers/src/handlers/practitioner.js
- workers/src/db/queries.js
- workers/src/index.js
- frontend/js/app.js
Handlers / queries / routes:
- `handleGetInvitationDetails`
- `handleAcceptInvitation`
- `QUERIES.getPractitionerInvitationByTokenHash`
- `QUERIES.markPractitionerInvitationAccepted`
- `GET /api/invitations/practitioner?token=...`
- `POST /api/invitations/practitioner/accept`
Acceptance:
- invite link stored from `?invite=` and survives auth
- signed-in user can accept only when their email matches invite email
- successful acceptance adds client to `practitioner_clients`
- accepted or expired invites cannot be reused
Regression:
- tests/practitioner-runtime.test.js

### PRAC-P0-03 — Canonical Public Practitioner URL
Status: shipped in code
Problem: practitioner profile save path generated `/directory/<display_name>` while the public page lived at `/practitioners/:slug`.
Files:
- frontend/js/app.js
- frontend/functions/practitioners/[slug].js
Handlers / routes:
- `saveDirectoryProfile`
- `/practitioners/:slug`
Acceptance:
- saving a public profile returns a link to `/practitioners/<slug>`
- canonical practitioner page stays usable without a broken SPA redirect
- booking CTA remains available from the public page when configured

### PRAC-P0-04 — Remove Tier Naming Drift On Practitioner Upgrade Surface
Status: shipped in code
Problem: practitioner-facing upgrade copy still referenced the legacy Guide tier.
Files:
- frontend/index.html
Acceptance:
- practitioner lock notice uses `Practitioner` consistently
- upgrade CTA matches current billing language

### PRAC-P0-05 — Verify Practitioner Data Isolation End To End
Status: in progress
Problem: the most obvious note-update hole is fixed, but the practitioner surface still needs a deliberate isolation sweep.
Files:
- workers/src/handlers/practitioner.js
- workers/src/handlers/session-notes.js
- workers/src/handlers/practitioner-directory.js
- workers/src/handlers/pdf.js
- workers/src/handlers/notion.js
Queries / handlers to verify:
- `checkPractitionerAccess`
- `handleGetClientDetail`
- `handleDeleteNote`
- `handleGetAIContext`
- `handleUpdateAIContext`
- branded PDF export path for practitioner clients
Acceptance:
- every practitioner client route is either scoped by practitioner id or guarded by `checkPractitionerAccess`
- no client detail, note, export, or context route leaks across practitioners
Recommended implementation:
- add explicit isolation tests for client detail, delete note, AI context, and branded PDF routes
Progress update:
- session notes list/create and AI context get/update now enforce roster ownership in `workers/src/handlers/session-notes.js`
- note delete now fails closed with `404` when the note does not belong to the authenticated practitioner
- client detail access is verified through the practitioner router against non-roster clients
- branded PDF export remains guarded by `checkPractitionerAccess`
- automated coverage now includes non-roster note creation, AI context access, note deletion miss, client detail rejection, branded PDF export rejection, and expired invite handling

---

## P1 Next

### PRAC-P1-01 — Guided Practitioner Empty State
Problem: the practitioner tab is functional but not self-guiding enough for first activation.
Files:
- frontend/index.html
- frontend/js/app.js
Primary functions:
- `loadRoster`
- practitioner tab rendering helpers
Build:
- first-run checklist
- empty-state CTA for first client
- direct path to directory profile setup
Acceptance:
- new practitioner can understand next action without documentation

### PRAC-P1-02 — Productize AI Context In Client Detail
Status: shipped in code
Problem: AI context existed in backend but was not surfaced as a practitioner-grade tool.
Files:
- frontend/js/app.js
- workers/src/handlers/session-notes.js
Routes:
- `GET /api/practitioner/clients/:id/ai-context`
- `PUT /api/practitioner/clients/:id/ai-context`
Build:
- editable AI context card in client detail
- clear explanation of how context affects later synthesis
Acceptance:
- practitioner can read and update client AI context from the same workspace as notes
Progress update:
- `frontend/js/app.js` now loads AI context into the practitioner client detail panel
- practitioners can save per-client AI context directly beside notes and chart/profile context
- the detail view now explains how AI context shapes future synthesis

### PRAC-P1-03 — Client Lifecycle States
Problem: roster rows do not clearly show where a client is in the journey.
Files:
- workers/src/handlers/practitioner.js
- frontend/js/app.js
Build:
- invited
- account created
- chart generated
- profile generated
Acceptance:
- practitioner can identify next action per client at a glance

### PRAC-P1-04 — Directory Conversion Quality
Problem: directory listing exists but does not yet act like a strong acquisition funnel.
Files:
- frontend/js/app.js
- frontend/functions/practitioners/[slug].js
- workers/src/handlers/practitioner-directory.js
Build:
- profile preview quality improvements
- stronger directory card CTA
- visible booking path from listing or profile
Acceptance:
- user can go from directory card to live practitioner profile to booking without confusion

### PRAC-P1-05 — Practitioner Regression Suite Expansion
Problem: practitioner revenue surfaces are under-tested relative to business importance.
Files:
- tests/practitioner-runtime.test.js
- tests/CHECKOUT_TEST_SUITE.md
- UI_TESTCASES.md
Build:
- route-level tests for client isolation and invite lifecycle
- deterministic acceptance coverage for public profile URL and directory profile save path
Acceptance:
- P0 practitioner trust regressions are covered by automated tests
Progress update:
- `tests/practitioner-runtime.test.js` now covers note update ownership, non-roster note creation, non-roster AI context access, note delete miss, client detail rejection, branded PDF roster isolation, invite expiry handling, and invite acceptance constraints

---

## Deferred Until Core Loop Is Stable

### PRAC-P2-01 — Deep Notion Value Prop
Keep only connect, status, sync-clients, export-profile until practitioner core loop proves retention.

### PRAC-P2-02 — Agency Expansion
Do not broaden self-serve agency promises until practitioner retention and support load are measurable.

### PRAC-P2-03 — White-Label Marketing Expansion
Do not market beyond the actual bounded agency/admin functionality already shipped.

---

## Recommended Build Order

1. Finish the remaining P0 data-isolation sweep.
2. Ship guided practitioner onboarding and empty states.
3. Add AI context UI in client detail.
4. Add client lifecycle states and quick actions.
5. Improve directory conversion quality.
6. Expand regression coverage before broad practitioner rollout.
