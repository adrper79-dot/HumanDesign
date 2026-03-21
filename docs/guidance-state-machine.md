# Guidance State Machine

This document defines the deterministic rules used to expand, compress, and retarget guidance without removing meaning.

## Source Signals

- `currentUser?.tier`
- `readJourneyFlag('chartGenerated')`
- `readJourneyFlag('profileGenerated')`
- `hasSeenFirstRunOnboarding()`

No timing-based heuristics or inferred behavior scores are used.

## Personas

- Personal: all non-practitioner tiers
- Practitioner: `practitioner`, `guide`, `agency`, `white_label`

## Stages

- `no-chart`: no saved chart milestone
- `chart-generated`: chart exists, profile does not
- `profile-generated`: chart and profile both exist

These states are exposed on `document.body.dataset` as:

- `data-guidance-stage`
- `data-guidance-persona`

## Display Rules

### Overview

- First-time personal users: expanded orientation plus explicit chart-first next step
- Returning personal users without chart: compressed orientation plus visible resume path
- Personal users with chart but no profile: expanded post-chart guidance to push profile generation
- Personal users with profile: summary guidance plus next practice layer
- Practitioners without chart: expanded operational orientation
- Practitioners with chart but no profile: expanded push to finish practitioner baseline
- Practitioners with profile: summary guidance focused on operational next step

### Chart

- First-time users: show expanded explanation panel and open learn-more disclosure by default
- Returning users: keep strip and next-step visible, collapse deeper panel by default
- After chart generation: retitle the strip and next-step content to point toward profile or refinement

### Profile

- No chart: keep guidance visible and explain why chart is required first
- Chart but no profile: expanded guidance and open learn-more disclosure by default
- Existing profile: compress default guidance and shift summary copy toward refinement or targeted reruns
- Advanced controls default open for power users and first-time no-profile users; otherwise closed

### Practitioner

- Early setup: show full activation checklist
- Returning practitioners with setup already in motion: show visible next step and collapse full checklist into disclosure
- Intro copy stays workflow-first and never falls back to consumer education framing

## Refresh Triggers

Guidance refreshes when any of these occur:

- auth/profile hydration completes
- a journey milestone is marked
- a tab switch occurs
- overview rendering runs after chart generation
- profile advanced UI recomputes
- practitioner activation plan renders

## Non-Negotiables

- Every compressed state still shows a visible next step
- Deeper explanation remains reachable through disclosure or surface retention
- Personalization/synthesis logic is separate from this state machine
- Anti-Barnum safeguards remain in the synthesis pipeline, not in guidance orchestration