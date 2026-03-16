# Practitioner Launch Checklist

Date: 2026-03-16
Purpose: turn the practitioner roadmap into a ship checklist mapped against existing practitioner acceptance coverage in UI_TESTCASES.md
Status key:
- Done: code exists and was revalidated in the current review
- Partial: code exists but workflow, routing, or UX is incomplete
- Open: not sufficiently built or not surfaced in-product

---

## Core Loop Gate

### 1. Upgrade And Access
- [x] Practitioner upgrade copy uses current tier naming
Map: UI_TESTCASES.md Section 6.1, billing language dependencies in roadmap
Evidence: frontend/index.html practitioner upgrade notice now uses Practitioner tier
- [x] Post-checkout practitioner lands in a guided workspace
Map: roadmap first-pass activation requirement
Evidence: frontend/js/billing-success.js and frontend/js/app.js now preserve a post-checkout destination and route Practitioner/Agency users back into the practitioner workspace with activation guidance

### 2. Client Add / Invite
- [x] `POST /api/practitioner/clients/invite` creates invite or links existing account
Map: UI_TESTCASES.md Section 6.1, `Add client who doesn't have account → invitation flow`
Evidence: workers/src/handlers/practitioner.js
- [x] Invitation link can now be redeemed end to end
Map: UI_TESTCASES.md Section 6.1, `Invitation tokens expire after acceptance; revocable`
Evidence: workers/src/handlers/practitioner.js, workers/src/index.js, frontend/js/app.js
- [x] Pending invite can be resent from practitioner workspace
Map: roadmap first-pass invite-management requirement
Evidence: workers/src/handlers/practitioner.js and frontend/js/app.js now support invitation resend with fresh-link rotation
- [ ] Invitation expiry and revoke behavior fully regression-tested
Map: UI_TESTCASES.md Section 6.1
Status: Partial

### 3. Client Detail Workspace
- [x] `GET /api/practitioner/clients/:id` returns scoped client detail
Map: UI_TESTCASES.md Section 6.1
Evidence: workers/src/handlers/practitioner.js
- [x] Client detail shows chart and latest profile summary in UI
Map: UI_TESTCASES.md Section 6.1
Evidence: frontend/js/app.js
- [x] Branded PDF export is available from client detail
Map: roadmap first-pass export requirement
Evidence: frontend/js/app.js and branded PDF route in workers/src/index.js
- [x] Client detail includes AI context editor
Map: UI_TESTCASES.md Section 6.3, roadmap first-pass client workspace
Evidence: frontend/js/app.js practitioner client detail now loads and saves per-client AI context

### 3A. Roster Readiness Visibility
- [x] Practitioner roster exposes lifecycle guidance for client readiness
Map: roadmap Phase 1 client lifecycle requirement
Evidence: frontend/js/app.js and workers/src/db/queries.js now render lifecycle badges and next-step guidance from birth-data, chart, and profile readiness signals

---

## Trust And Isolation Gate

### 4. Practitioner Data Isolation
- [x] Practitioner cannot update another practitioner's note through the known update path
Map: UI_TESTCASES.md Section 6.2 plus isolation expectations in Section 6.1
Evidence: workers/src/handlers/session-notes.js and workers/src/db/queries.js
- [ ] Practitioner cannot access another practitioner's client across all adjacent routes
Map: UI_TESTCASES.md Section 6.1 `Practitioner CANNOT access another practitioner's clients → 403`
Status: Partial
Needs revalidation on:
- client detail
- notion export paths where practitioner-client linkage matters
Current verified state:
- note delete now fails closed with `404` when the practitioner does not own the note
- AI context get/update enforce roster ownership
- client detail route rejects non-roster practitioners
- branded PDF export rejects non-roster practitioners
- Notion export now allows practitioner export of roster client profiles without widening access outside the roster

### 5. Public Profile Routing
- [x] Public practitioner save confirmation uses canonical slug route
Map: UI_TESTCASES.md Section 6.4 `Public profile URL accessible`
Evidence: frontend/js/app.js saveDirectoryProfile
- [x] `/practitioners/:slug` is a working public page, not a broken SPA redirect
Map: UI_TESTCASES.md Section 6.4 and 6.5
Evidence: frontend/functions/practitioners/[slug].js
- [ ] Directory listing links cleanly into the public practitioner page in the in-app UI
Map: UI_TESTCASES.md Section 6.5 `Click practitioner → view their public profile`
Status: Partial

---

## Practitioner Workflow Gate

### 6. Session Notes
- [x] Create note
Map: UI_TESTCASES.md Section 6.2 `POST /api/session-notes`
Evidence: workers/src/handlers/session-notes.js and frontend/js/app.js
- [x] Update note
Map: UI_TESTCASES.md Section 6.2 `PUT /api/session-notes/:id`
Evidence: workers/src/handlers/session-notes.js and frontend/js/app.js
- [x] Delete note
Map: UI_TESTCASES.md Section 6.2 `DELETE /api/session-notes/:id`
Evidence: workers/src/handlers/session-notes.js and frontend/js/app.js
- [x] Notes list sorted newest first
Map: UI_TESTCASES.md Section 6.2
Evidence: QUERIES.listSessionNotes
- [ ] Share-with-AI behavior is verified all the way into synthesis
Map: UI_TESTCASES.md Section 6.2 and 6.3
Status: Partial
- [x] Client workspace exposes a post-session follow-up action
Map: roadmap Phase 2 post-session flow requirement
Evidence: frontend/js/app.js now composes a follow-up brief from notes, AI context, and synthesis state with a copy action for practitioner workflows

### 7. Per-Client AI Context
- [x] Backend read/update routes exist
Map: UI_TESTCASES.md Section 6.3
Evidence: workers/src/handlers/session-notes.js
- [x] Frontend practitioner workflow exposes AI context editing
Map: UI_TESTCASES.md Section 6.3
Evidence: frontend/js/app.js client detail panel renders AI context editor and save action
- [ ] AI context visibly influences future synthesis in an acceptance-tested flow
Map: UI_TESTCASES.md Section 6.3 and PRAC-006 in tests/CHECKOUT_TEST_SUITE.md
Status: Open

---

## Directory And Discovery Gate

### 8. Directory Profile
- [x] `PUT /api/practitioner/directory-profile` updates public-facing fields
Map: UI_TESTCASES.md Section 6.4
Evidence: workers/src/handlers/practitioner-directory.js
- [x] Public profile page resolves by slug
Map: UI_TESTCASES.md Section 6.4
Evidence: workers/src/handlers/practitioner-directory.js and frontend/functions/practitioners/[slug].js
- [ ] Long-form profile quality is strong enough for conversion
Map: roadmap discovery funnel criteria
Status: Partial

### 9. Directory Listing
- [x] `GET /api/directory` is public and paginated
Map: UI_TESTCASES.md Section 6.5
Evidence: workers/src/handlers/practitioner-directory.js
- [x] Directory page loads in the current frontend
Map: UI_TESTCASES.md Section 6.5
Evidence: frontend/js/app.js searchDirectory/loadDirectoryPage
- [ ] Search-by-specialty and click-through journey need explicit end-to-end verification
Map: UI_TESTCASES.md Section 6.5
Status: Partial

---

## Integration Gate

### 10. Notion
- [x] OAuth, status, sync, export, and disconnect routes exist
Map: UI_TESTCASES.md Section 8
Evidence: workers/src/handlers/notion.js and workers/src/index.js
- [x] Basic practitioner UI for Notion exists
Map: roadmap current-state validation
Evidence: frontend/js/app.js
- [x] Practitioner client workspace can export a client profile to Notion
Map: practitioner workflow integration requirement
Evidence: frontend/js/app.js now surfaces Notion export from client detail, and workers/src/db/queries.js scopes Notion export to own or roster-client profiles
- [ ] Real practitioner-grade UX and failure handling need final validation
Map: UI_TESTCASES.md Section 8.2 and 8.3
Status: Partial

---

## Regression Gate

### 11. Automated Coverage Required Before Broad Rollout
- [x] Note update ownership regression test added
Map: roadmap Phase 0 exit criteria
Evidence: tests/practitioner-runtime.test.js
- [x] Invite acceptance regression test added
Map: roadmap Phase 0 exit criteria
Evidence: tests/practitioner-runtime.test.js
- [ ] Add explicit tests for expired/revoked invite and remaining client isolation on detail routes
Map: UI_TESTCASES.md Section 6.1 and 6.2
Status: Open
- Current verified additions:
- client detail rejection test added
- note delete miss test added
- branded PDF non-roster rejection test added
- expired invite preview test added
- [x] Run deterministic practitioner regression suite successfully in the local environment
Map: release validation
Evidence: direct Vitest execution from repo root passes on `tests/practitioner-runtime.test.js` with 11 passing tests

---

## Ship Decision Rule

Practitioner rollout is ready for a broader first-pass launch only when all of the following are true:
- invite creation and acceptance are verified in a real user journey
- client detail, notes, and export flow are stable
- no known practitioner cross-tenant access path remains
- public profile save and public slug page work cleanly
- practitioner onboarding and AI context UI are no longer missing from the first-pass core loop

Current assessment:
- Trust layer: improved materially, not fully certified yet
- Core workflow: usable and materially stronger after AI context UI/productization
- Discovery layer: functional, needs stronger click-through validation
- Rollout recommendation: limited design-partner release after the remaining client-detail isolation checks and directory click-through validation
