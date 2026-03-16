# Practitioner Execution Roadmap

Date: 2026-03-16
Scope: Practitioner and Agency surfaces in Prime Self
Goal: Maximize first-pass practitioner success by shipping the smallest credible, trustworthy, revenue-safe practitioner operating system.

---

## Executive Summary

Prime Self has enough practitioner infrastructure to build a strong paid product, but it is not yet a coherent practitioner operating system.

What is already materially present:

- practitioner account model and tier gating
- client roster and client detail retrieval
- invitation creation and email sending
- session notes backend
- per-client AI context backend
- practitioner directory backend and basic UI
- branded PDF export path
- Notion backend integration
- agency seat foundations

What prevents the current practitioner product from feeling complete:

- trust-breaking authorization and routing defects remain in the practitioner path
- several high-value practitioner features are only partially surfaced or are surfaced without a complete workflow
- onboarding is too weak for a $97 per month professional tier
- the public profile, invitation, and directory flows are not yet a clean acquisition funnel
- success instrumentation is incomplete, so even a functional ship would be hard to tune

The right first pass is not “finish every practitioner idea.” The right first pass is to ship a reliable practitioner core loop:

1. practitioner upgrades
2. practitioner lands in a guided workspace
3. practitioner invites or adds a client
4. client completes birth data
5. practitioner can view chart, profile, notes, AI context, and export a deliverable
6. practitioner can publish a profile and receive discovery traffic
7. practitioner can retain value through follow-up and lightweight practice ops

That first pass is enough to support design partners, justify price, and produce real usage evidence. Agency and advanced automations should remain constrained until the practitioner motion is stable.

---

## Current State Validation

This roadmap is based on validated repository state as of 2026-03-16.

Validated in code:

- practitioner handler exists with register, profile, clients, invitations, detail, and remove flows
- session notes backend exists with CRUD routes
- per-client AI context backend exists
- practitioner directory backend exists with public list and slug profile endpoints
- Pages function exists for public practitioner pages
- Notion status, auth, sync, export, and disconnect flows exist in backend
- practitioner UI exists for roster, directory profile, invites, branded PDF, agency seats, and basic client detail

Validated concerns still affecting execution quality:

- session note update is not ownership-scoped in SQL and handler wiring
- invitation creation exists, but acceptance/redemption flow is not clearly implemented in the visible route surface
- practitioner public-profile routing is inconsistent across saved URL, Pages function, and SPA redirect target
- AI context exists in backend but is not exposed in the practitioner UI
- current UI still has tier-language drift in places
- practitioner-specific automated coverage is thin relative to business importance

Implication:

The practitioner product is no longer a stub. It is a partially connected system with enough code to support a serious first pass, but only if we tighten the trust layer and deliberately cut scope.

---

## Product Standard For First Pass

The first pass is successful if a real practitioner can do all of the following without assistance:

1. understand what the practitioner plan gives them
2. activate their workspace in under 10 minutes
3. invite or add a client without confusion
4. get a client from invitation to usable chart/profile with minimal friction
5. prepare for a session using notes, AI context, and prior outputs
6. export and share a professional artifact
7. publish a public profile that can plausibly convert discovery into booking

The first pass is not required to deliver all agency promises, full white-label, or every integration surface.

---

## First-Pass Strategy

### Build for trust first

If practitioners feel exposed, confused, or misled, the product will fail even if the feature count looks strong.

Therefore the first pass must prioritize:

- correct scoping and authorization
- complete workflows over partial features
- explicit onboarding and empty states
- reliable live URLs and discoverable public surfaces
- accurate billing and plan language

### Build for one hero outcome

The hero outcome is not “manage a roster.”
The hero outcome is: “I can run a better client session faster and look more professional doing it.”

Everything in the first pass should reinforce that outcome.

### Build for design-partner proof, not theoretical completeness

The goal of the first pass is to win with 10 to 20 practitioners who actually use it in client work. That means:

- fewer features, more polish
- fewer promises, more delivery
- fewer admin abstractions, more session utility

---

## Phase Plan

## Phase 0: Trust And Core Integrity

Timeline: immediate
Priority: P0
Outcome: practitioner data is safe, route semantics are coherent, and upgrade messaging is accurate.

### Must ship

- Scope session note updates by practitioner ownership.
- Verify and fix practitioner client-data isolation across all practitioner endpoints.
- Implement or expose a real invitation acceptance flow.
- Unify practitioner public profile routing to one canonical URL shape.
- Remove remaining Guide and legacy tier copy from practitioner-facing UI and docs on the upgrade path.
- Add focused regression coverage for:
  - practitioner A cannot mutate practitioner B note
  - practitioner A cannot access practitioner B client
  - invite token creation and redemption
  - directory profile save returns usable live URL

### Why this matters

Without this phase, the rest of the practitioner roadmap sits on unstable trust boundaries. This is the minimum bar before pushing harder on paid practitioner adoption.

### Exit criteria

- practitioner authorization flows return 403 where expected
- invite link works end to end
- saved public profile link opens a real profile page
- no practitioner-facing tier language drift on the critical upgrade and dashboard paths

---

## Phase 1: First-Pass Practitioner Workspace

Timeline: first sprint after Phase 0
Priority: P0
Outcome: a new practitioner can activate and run their first client workflow without assistance.

### Must ship

- guided practitioner empty state with a clear first-run checklist:
  - complete public profile
  - invite first client
  - view first client chart
  - add first note
  - export first branded report
- success state after practitioner checkout that routes directly into the practitioner workspace
- improved client add/invite experience with clear outcomes:
  - existing user linked immediately
  - non-user gets invite with clear next step
  - fallback if email delivery is unavailable
- client detail workspace that includes:
  - chart snapshot
  - latest profile summary
  - branded PDF export
  - session notes panel
  - per-client AI context editor
- concise in-product explanations of practitioner value, not just raw labels

### Should ship if capacity allows

- client status badges:
  - invited
  - account created
  - birth data complete
  - chart generated
  - profile generated
- quick actions in roster rows:
  - view profile
  - add note
  - export branded PDF

### Why this matters

This phase turns the practitioner dashboard into a working professional tool rather than a feature index.

### Exit criteria

- first-run practitioner can complete the full checklist in one session
- session notes and AI context are both usable from the client-detail surface
- invite outcome is unambiguous
- empty states feel guided, not blank

---

## Phase 2: Professional Session Prep

Timeline: second major sprint
Priority: P1
Outcome: practitioners save time before and after sessions.

### Must ship

- session prep card for each client with:
  - latest profile summary
  - recent notes
  - AI context summary
  - suggested focus points for next session
- post-session flow:
  - add note
  - optionally share note with AI
  - generate follow-up summary or recommended next steps
- compatibility/composite entry point from the client detail view if supported by tier

### Should ship if capacity allows

- timeline view for session notes and profile events
- practitioner-authored “working hypothesis” field per client
- client tags or goals

### Why this matters

This is where the product starts to justify recurring spend. Practitioners do not pay long term for storage; they pay for preparation speed, confidence, and client-facing quality.

### Exit criteria

- practitioner can prep for a session from one screen
- notes and AI context visibly influence future synthesis workflows
- follow-up artifacts feel professional and repeatable

---

## Phase 3: Discovery Funnel And Public Profile

Timeline: parallel with Phase 2 or immediately after
Priority: P1
Outcome: directory and public profile become a plausible acquisition channel.

### Must ship

- canonical public profile route and page behavior
- post-save “view my public profile” confirmation using real slug, not display name
- stronger public profile content blocks:
  - bio
  - specialties
  - session format
  - booking link
  - certifications
  - languages
- directory cards with stronger conversion cues and clearer booking CTA

### Should ship if capacity allows

- practitioner photo upload guidance or validation
- SEO and social preview verification for public profiles
- lightweight proof elements such as years practicing, session count, or verified badge rules if truthful data exists

### Why this matters

If the directory exists, it should help acquisition. If it does not convert, it is maintenance overhead.

### Exit criteria

- practitioner can publish a profile and verify it publicly
- user can search directory, open a profile, and reach a booking path cleanly
- shared public profile links render correctly in social previews

---

## Phase 4: Notion And Lightweight Practice Ops

Timeline: after practitioner core is stable
Priority: P2
Outcome: practitioners who already run external systems can connect Prime Self to their workflow.

### Must ship before marketing it hard

- validated Notion connect flow in the actual practitioner UI
- clear status, connect, sync, export, and disconnect states
- correct error handling when connection is absent, revoked, or rate-limited

### Should defer until proven necessary

- deep two-way sync
- heavy queueing/orchestration for Notion retries
- multi-database templates

### Why this matters

Notion is a retention amplifier for power users, not the core first-pass differentiator. It should not displace core workspace quality.

### Exit criteria

- practitioner can connect Notion from the UI
- practitioner can sync clients and export a profile successfully
- failures are explicit and recoverable

---

## Phase 5: Agency As Controlled Expansion

Timeline: after practitioner retention signals are healthy
Priority: P2
Outcome: agency becomes a supportable expansion path instead of a premature complexity trap.

### Must ship

- clearly bounded agency promise:
  - seat count
  - seat capabilities
  - owner capabilities
  - white-label boundaries
  - API and webhook boundaries
- agency seat lifecycle clarity in the UI
- agency help and admin states that are auditable

### Must not ship self-serve until stable

- anything implying fully generalized white-label when the experience is still partially manual
- open-ended agency automation promises

### Why this matters

Agency complexity multiplies support burden. It should be unlocked only after the practitioner core loop is stable and measurable.

---

## Deep Build Requirements Validation

## Stream A: Backend Integrity

### Required now

- practitioner note mutation authorization
- invite redemption handler and token lifecycle
- route and query validation for all practitioner CRUD
- correct practitioner-client isolation across detail, note, AI context, export, and agency surfaces

### Required for first pass

- stable note CRUD
- stable AI context CRUD
- stable practitioner directory CRUD
- stable branded PDF export for rostered clients

### Can wait

- advanced queueing for integrations
- broad agency automation orchestration

## Stream B: Frontend Workflow Completeness

### Required now

- empty-state onboarding
- session notes UI with create, edit, delete, and share-with-AI affordance
- AI context UI for each client
- public profile confirmation and canonical URL handling

### Required for first pass

- checkout success to practitioner workspace
- roster quick actions
- working invitation feedback
- coherent directory and public profile UX

### Can wait

- complex keyboard shortcuts
- high-end bulk actions
- extensive mobile-specific practitioner optimizations beyond core usability

## Stream C: Data And Schema

### Required now

- confirm production schema includes all practitioner migrations
- confirm invite table lifecycle semantics
- confirm note, directory, and practitioner fields are present in production

### Required for first pass

- data needed for activation and retention analytics
- safe migration path for any practitioner-profile routing or note authorization fix

### Can wait

- data warehouse or extensive BI layering

## Stream D: Billing And Commercial Readiness

### Required now

- accurate practitioner plan language everywhere
- accurate success and retention path for practitioner tier
- removal of any paid feature claims that are not truly available in UI

### Required for first pass

- practitioner checkout and portal work reliably
- retention offer appears before full churn where appropriate

### Can wait

- annual plan optimization experiments
- advanced discount strategy

## Stream E: QA And Observability

### Required now

- practitioner regression tests on the highest-risk flows
- validation of all practitioner acceptance criteria already outlined in UI_TESTCASES
- synthetic smoke for practitioner core loop

### Required for first pass

- core funnel events:
  - practitioner activated
  - client invited
  - invite accepted
  - first chart available
  - first note created
  - first branded PDF exported
  - public profile published

### Can wait

- deep funnel experimentation
- advanced cohort dashboards

---

## What To Ship In The First Pass

This is the recommended first-pass package.

### Include

- practitioner upgrade path with accurate plan language
- onboarding checklist and empty states
- invite or add client flow with clear outcomes
- client detail workspace
- session notes UI
- per-client AI context UI
- branded PDF export
- directory profile editor with canonical public URL
- basic public directory and public practitioner pages
- core practitioner event tracking
- regression coverage for auth and workflow integrity

### Exclude or constrain

- full agency self-serve beyond bounded seat management
- complex Notion value propositions beyond connect, status, sync clients, export profile
- broad white-label marketing claims
- heavy workflow automation not directly tied to session preparation or delivery

### Why this package wins

It creates a credible paid professional product without drowning the team in agency complexity or long-tail integrations.

---

## Tooling Improvements Needed

Yes. The tools themselves need meaningful improvement if the goal is “great,” not just “present.”

## Practitioner tools that need improvement

### 1. Session notes

Current state:

- backend exists
- UI exists only at a basic note list and CRUD level in the client detail view
- no real session timeline or prep utility

Needed:

- notes sorted and grouped as a working timeline
- visible session date and status
- prep summary generated from note history
- explicit AI-share semantics and consent clarity
- ability to link notes to outcomes, themes, or follow-up tasks

### 2. AI context

Current state:

- backend exists
- not productized as a visible, practitioner-grade tool

Needed:

- dedicated editor in client detail
- clear explanation of how AI context affects future outputs
- guardrails around what should and should not be stored
- surfacing of last-updated status and usage in synthesis

### 3. Client management

Current state:

- roster exists
- invitation exists
- no full lifecycle state model

Needed:

- client status progression
- clear next action prompts
- client search and filtering for larger rosters
- bulk practicality once design partners exceed a handful of clients

### 4. Public profile and directory

Current state:

- enough exists to be visible
- routing and confirmation are not clean enough

Needed:

- canonical URL system
- trustworthy confirmation after save
- stronger conversion structure
- polished public profile preview

### 5. Notion sync

Current state:

- backend exists
- practitioner utility is not obvious in-product

Needed:

- clear connect and sync states
- visible success outcomes
- explicit failure handling
- avoid overpromising before sync quality is proven

### 6. Retention tooling

Current state:

- backend retention offer exists in billing logic
- practitioner-facing experience does not capitalize on it

Needed:

- downgrade-aware retention UX
- save offer presentation before churn
- follow-up communications for churn-risk practitioners

---

## Success Plan

## Product success

- make one practitioner look excellent in front of one client
- optimize for the first 5 clients, not the first 500
- use empty states and setup guidance aggressively

## Commercial success

- stop claiming features until the UI is real and usable
- use the first pass to generate real design-partner proof, not broad launch volume
- keep agency constrained until support burden is known

## Execution success

- finish complete workflows before starting adjacent features
- put tests on practitioner workflows proportional to revenue importance
- measure activation and session-use events from day one

## Team success

- define a practitioner owner journey and build to that persona
- use a pass/fail ship checklist instead of a loose “feature complete” feeling
- keep docs, pricing, UI, and billing semantics synchronized every sprint

---

## First-Pass Acceptance Checklist

- practitioner can upgrade and immediately access the workspace
- dashboard first load shows a useful guided path
- practitioner can add or invite a client with clear result states
- client detail shows chart, profile, notes, AI context, and export path
- session notes are safe, editable, and practitioner-scoped
- AI context is editable and clearly connected to future synthesis
- practitioner can save and open a working public profile
- directory can route to a real practitioner page
- billing copy and feature claims match the real UI
- practitioner regression tests cover trust-critical flows

---

## Recommended Execution Order

1. Fix trust and routing defects.
2. Build the first-run practitioner workspace.
3. Productize session notes and AI context.
4. Clean up public profile and directory conversion flow.
5. Add lightweight session-prep intelligence.
6. Add Notion only after the core loop feels solid.
7. Expand agency only after practitioner retention proves real value.

---

## Final Recommendation

Do not try to “finish practitioner and agency” in one pass.

Ship a narrow, high-trust practitioner operating system first:

- invite clients
- prep sessions
- record notes
- guide AI context
- export deliverables
- publish a profile

That is the highest-probability path to successful design-partner adoption, lower refund risk, better retention, and a foundation strong enough to justify agency expansion later.