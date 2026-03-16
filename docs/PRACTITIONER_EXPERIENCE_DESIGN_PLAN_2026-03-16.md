# Practitioner Experience Design Plan

Date: 2026-03-16
Scope: Practitioner and Agency practitioner-facing experience in Prime Self
Standard: first-pass practitioner operating system that is trustworthy, session-centric, and commercially legible
Companion docs:
- docs/PRACTITIONER_EXECUTION_ROADMAP_2026-03-16.md
- docs/PRACTITIONER_IMPLEMENTATION_BACKLOG_2026-03-16.md
- docs/PRACTITIONER_LAUNCH_CHECKLIST_2026-03-16.md

---

## Purpose

This document translates the practitioner product recommendation into a build-ready design plan.

It is not a marketing brief and not a loose roadmap. It defines:

- the desired customer workflow
- the screens and states required to support that workflow
- the product rules that make the experience trustworthy
- the backend, frontend, data, and QA requirements needed to ship it cleanly

The target outcome is simple:

Prime Self should feel less like a collection of practitioner tools and more like a focused operating system for running a better client session.

---

## Product Thesis

Practitioners do not primarily buy software to store charts.

They buy software to:

1. get clients into a usable workspace quickly
2. prepare for sessions faster
3. deliver a more professional artifact
4. preserve continuity between sessions
5. look credible enough to win the next client

Therefore the practitioner experience should optimize for one hero outcome:

"I can run a better client session faster, with more continuity and a more professional delivery."

Every practitioner screen should support one of four jobs:

1. activate the practice
2. move a client toward session readiness
3. help the practitioner prepare and deliver
4. help the practitioner retain and grow

---

## Customer Model

## Primary customer

Independent Human Design practitioner who:

- has paying or soon-to-be-paying clients
- needs a simple operating workflow, not enterprise admin software
- values trust, polish, and continuity more than automation volume
- may use Notion or another system, but does not want Prime Self to depend on it

## Secondary customer

Small agency or collective owner who wants:

- a practitioner seat model
- shared commercial umbrella
- bounded sub-account management

Agency is an expansion layer, not the design center for first pass.

---

## Experience Principles

## 1. Session-first, not admin-first

The home experience should orient around preparing for and following up from client sessions.

## 2. One client workspace

Chart review, profile synthesis, notes, AI context, and export actions should live in one coherent client detail experience, not across disconnected tabs.

## 3. Explicit next action

Every empty or partial state should answer: what should the practitioner do next?

## 4. Visible trust boundaries

Every client-owned surface must be scoped to the authenticated practitioner's roster. Silent success and ambiguous errors are not acceptable.

## 5. Professional output matters

The product must help the practitioner look more prepared and more credible, not just more organized.

## 6. Discovery must be real or it should stay quiet

If the directory exists, it should plausibly convert to booking. If it cannot, it should not be treated as a hero feature.

---

## Desired Customer Workflow

The desired practitioner workflow is:

1. Discover and understand value
2. Upgrade to Practitioner
3. Land in a guided activation workspace
4. Complete public profile and booking setup
5. Invite or add a first client
6. Track that client to session readiness
7. Prepare from one client workspace
8. Run session and capture notes/context
9. Export or deliver a professional follow-up artifact
10. Return for future continuity and use directory/profile to generate more demand

This is the product loop that should drive design decisions.

---

## Workflow Detail

## Stage 1: Upgrade And Activation

### User goal

Understand what the practitioner plan does and become operational quickly.

### Required product behavior

- post-checkout lands directly in Practitioner Portal
- first-run activation card appears until the core setup is complete
- setup is framed as a short, finite checklist

### Required checklist

- complete public practitioner profile
- add booking link
- invite first client
- open first client workspace
- add first session note
- export first branded deliverable

### Success definition

A practitioner can become operational in under 10 minutes without documentation or support.

---

## Stage 2: Client Intake And Invitation

### User goal

Get a real client into the system with no ambiguity.

### Required product behavior

- adding an email yields one of three explicit outcomes:
  - existing account linked to roster
  - invitation sent
  - invite blocked with a clear reason
- pending invitations are visible and manageable
- revoked, expired, and accepted invite states are distinguishable
- practitioner can resend or copy an invite link when needed

### Required practitioner-facing states

- invited
- accepted account
- birth details incomplete
- chart ready
- profile ready

### Success definition

The practitioner always knows whether the client is blocked on account creation, birth data, chart generation, or nothing.

---

## Stage 3: Session Readiness

### User goal

Open a client and know whether the workspace is ready for a meaningful session.

### Required product behavior

The client detail screen should expose a session-readiness frame using these signals:

- chart available
- latest synthesis available
- session history exists
- AI context tailored

### Required outputs in the client workspace

- chart snapshot
- latest profile summary
- notes timeline
- AI context editor
- branded PDF export action
- compatibility/composite entry point when available

### Success definition

The practitioner can prepare for a session from one screen in under 3 minutes.

---

## Stage 4: Session Execution And Follow-Up

### User goal

Capture what happened and turn it into continuity.

### Required product behavior

- practitioner can add, edit, and delete session notes easily
- practitioner can mark what should be shared with AI
- saved AI context acts as durable practitioner guidance for future synthesis
- follow-up action feels native, not improvised

### Missing first-pass capability to add

The current build has note storage and AI context editing, but it still needs a deliberate post-session follow-up workflow:

- session note saved confirmation tied to next action
- generate follow-up synthesis entry point
- prompt to export or share a deliverable
- visible record of last interaction and next recommended step

### Success definition

After a session, the practitioner can leave the product with a preserved working thread and a clear follow-up path.

---

## Stage 5: Retention And Discovery

### User goal

Use Prime Self repeatedly, not once.

### Required product behavior

- practitioner can re-enter any client and immediately recover context
- directory profile has enough quality to support conversion
- directory click-through to public profile to booking path is clean

### Success definition

Prime Self improves preparation quality, session continuity, and lead conversion often enough to justify recurring spend.

---

## Screen Architecture

## 1. Practitioner Home

This should be the operational dashboard, not a static tab.

### Purpose

Answer two questions immediately:

- what should I do next?
- which clients need attention?

### Sections

- activation checklist card for first-run users
- roster summary and usage bar
- pending invitations module
- clients needing action module
- quick links:
  - edit public profile
  - invite client
  - view directory page
  - check Notion status

### Required states

- first-time practitioner
- active practitioner with no clients
- active practitioner with pending invites
- active practitioner with ready clients

---

## 2. Invite Client Flow

### Purpose

Reduce ambiguity and drop-off during client intake.

### UX requirements

- inline result after submission
- explicit outcome label:
  - client added
  - invitation sent
  - invite already pending
  - roster limit reached
- immediate next-step guidance after each result

### Needed controls

- resend invite
- copy invite link
- revoke invite

---

## 3. Roster View

### Purpose

Turn the roster into an operations board rather than a contact list.

### Required row content

- client email or name
- lifecycle status badge
- date added
- latest chart/profile milestone
- quick actions:
  - open workspace
  - add note
  - export branded PDF when eligible

### Required sorting views

- newest
- needs setup
- session ready
- follow-up needed

---

## 4. Client Workspace

This is the most important screen in the practitioner product.

### Purpose

Support session prep, in-session reference, and post-session continuity from one place.

### Required modules

- session-readiness card
- chart summary card
- latest profile synthesis card
- AI context card
- session notes timeline
- deliverables/actions rail

### Required actions

- save AI context
- add note
- edit note
- delete note
- export PDF
- export branded PDF
- generate compatibility chart when available
- trigger follow-up synthesis when supported

### Design rule

The client workspace should never feel like a read-only inspector. It should feel operational.

---

## 5. Public Profile Editor

### Purpose

Help a practitioner publish a credible discovery surface.

### Required fields

- display name
- certification
- short bio
- specializations
- languages
- session format
- session info
- booking link
- visibility toggle

### Required post-save output

- canonical public URL
- preview/open link action
- visibility confirmation

### Needed quality improvements

- guidance on what makes a high-converting profile
- better field confidence copy
- stronger preview quality before publish

---

## 6. Public Practitioner Profile

### Purpose

Convert discovery into a booking action.

### Required content blocks

- headline identity
- trust markers
- specialties
- format and session info
- booking CTA

### Conversion rule

The page should answer:

- who is this practitioner?
- who are they for?
- how do I book?

---

## 7. Notion Integration Surface

### Purpose

Support power users without becoming core-path complexity.

### Required states

- not connected
- connected
- syncing
- sync success
- sync failed
- disconnected

### Product rule

Notion must remain an optional extension of the core workflow, never a prerequisite for using the practitioner product.

---

## System State Model

The practitioner experience needs a visible lifecycle model. Without that, the UI cannot communicate what is happening.

## Practitioner lifecycle states

- registered but not upgraded
- upgraded but not activated
- activated with no clients
- active with clients in progress
- active with session-ready clients

## Client lifecycle states

- invited
- invite accepted
- account exists but birth data incomplete
- chart generated
- profile generated
- session ready
- follow-up due

## Invitation lifecycle states

- pending
- accepted
- revoked
- expired

Each visible state should map to a next recommended action.

---

## Data And API Requirements

## Frontend requirements

- activation checklist visibility logic
- status badge rendering in roster rows
- practitioner home summary modules
- invite action affordances for resend, revoke, and copy link
- client workspace actions tied to current state
- directory save confirmation and profile preview path

## Backend requirements

- all practitioner client routes guarded by practitioner ownership
- invitation management supports list, revoke, preview, accept, and resend semantics
- client detail response includes enough data to derive lifecycle status cleanly
- follow-up capable endpoints should expose deterministic success/error states

## Data requirements

Minimum data needed to support the design cleanly:

- invitation status and timestamps
- client created-at and linked-at timestamps
- chart availability signal
- profile availability signal
- session note presence and last note timestamp
- AI context presence and updated-at timestamp

If the current handlers cannot derive these from existing queries reliably, add explicit fields in query outputs rather than burying UI logic in heuristics.

---

## Build Workstreams

## Workstream 1: Guided Activation

### Goal

Turn upgrade into a working setup flow.

### Deliverables

- practitioner first-run checklist card
- post-checkout routing into practitioner workspace
- completion rules for activation checklist

### Acceptance

- new practitioner sees a clear first action within 3 seconds
- first-run checklist can be completed without reading docs

---

## Workstream 2: Client Lifecycle Visibility

### Goal

Make client state legible at a glance.

### Deliverables

- roster badges
- next-step labels
- filtered roster sections or sort modes

### Acceptance

- practitioner can tell what each client needs next without opening each row

---

## Workstream 3: Session-Prep Workspace

### Goal

Make the client detail view the operational center of the product.

### Deliverables

- stronger session-readiness card
- notes timeline quality improvements
- AI context visibility and confidence copy
- follow-up synthesis entry point
- last interaction and next-step indicators

### Acceptance

- practitioner can prepare and follow up from one workspace without needing external notes

---

## Workstream 4: Invite And Conversion Flow

### Goal

Close intake ambiguity and reduce invite drop-off.

### Deliverables

- resend/copy/revoke actions
- explicit invite outcome states
- clearer acceptance messaging for invited clients

### Acceptance

- practitioner understands the outcome of every invite action immediately

---

## Workstream 5: Directory And Booking Funnel

### Goal

Turn the directory from a presence feature into a conversion path.

### Deliverables

- stronger public profile structure
- cleaner directory card click-through
- booking CTA quality improvements
- save-to-preview feedback loop

### Acceptance

- user can go from directory list to public profile to booking link without confusion

---

## Workstream 6: Trust And Regression Coverage

### Goal

Protect revenue surfaces and trust boundaries.

### Deliverables

- remaining practitioner isolation sweep
- invite revoke and lifecycle coverage
- directory click-through verification
- AI context influence acceptance test when synthesis wiring exists

### Acceptance

- no known cross-practitioner access path remains
- core practitioner flow has deterministic regression coverage

---

## Recommended Build Sequence

Build in this order:

1. Guided activation and post-checkout routing
2. Client lifecycle badges and roster next actions
3. Invite management controls and clearer invite states
4. Client workspace follow-up flow
5. Directory conversion upgrades
6. Notion polish after the core loop is stable

This ordering preserves the core commercial loop:

upgrade -> activate -> invite -> prepare -> deliver -> retain -> acquire

---

## Acceptance Criteria By Experience Layer

## Activation layer

- practitioner lands in the correct workspace after purchase
- first-run checklist is visible and actionable
- first value is reachable in one session

## Operations layer

- roster status is intelligible
- client workspace supports prep and follow-up in one place
- session notes and AI context both feel like live tools, not stored text fields

## Trust layer

- every client route is ownership-scoped
- invite lifecycle is deterministic
- practitioner errors are explicit and recoverable

## Discovery layer

- directory card to profile to booking path is clear
- public profile looks credible enough to share publicly

## Retention layer

- practitioner can recover prior context quickly
- follow-up workflow encourages repeat use

---

## What Not To Overbuild Yet

Do not over-invest in these before the core loop is stable:

- advanced agency administration
- deep two-way Notion orchestration
- broad white-label marketing promises
- bulk practitioner CRM features
- complex analytics dashboards with no operational action

The first-pass goal is not comprehensive practice management. It is practitioner session excellence with enough continuity and discovery to justify recurring spend.

---

## Design Decision Summary

The practitioner experience should be designed as a workflow product, not a feature collection.

That means:

- the home screen becomes an operations board
- the roster becomes a lifecycle view
- the client detail becomes a true working workspace
- the profile becomes a real conversion surface
- the trust layer becomes explicit and heavily tested

If built this way, the practitioner tier becomes much easier to sell, easier to retain, and easier to expand later into agency.