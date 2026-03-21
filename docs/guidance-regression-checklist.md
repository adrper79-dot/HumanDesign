# Guidance Regression Checklist

Use this checklist before closing any UI cleanup loop that touches shell chrome, orientation surfaces, glossary reachability, or next-step messaging.

## Release Gate

A loop is not complete until all items below pass or have a written exception with follow-up ownership.

## Automated Gate

Run:

```bash
npm run test:guidance
```

This verifies the required guidance anchors and orchestration hooks still exist in the shell.

## Manual Gate

Run the deterministic journey script in [docs/guidance-manual-test-script.md](docs/guidance-manual-test-script.md).

## Checklist

### Orientation

- Each touched workflow still answers what this section is for in visible plain language.
- Desktop and mobile rely on the same orientation logic, even if the layout differs.
- No workflow depends on hover-only help for the primary meaning of the screen.

### Next Step

- Each touched workflow still shows a visible next action after major milestones.
- Post-action states change the next-step guidance instead of leaving stale pre-action copy behind.
- Returning-user compression never removes the next-step answer.

### Terminology

- Touched terms still resolve through the canonical glossary or an approved mapped surface.
- Plain-language meaning is still reachable without needing a tooltip.
- No new tab-specific aliases were introduced without documentation.

### Journey Flow

- The chart -> profile -> transits path remains explicit.
- The core journey guide appears on the core path and does not leak into unrelated sections.
- Practitioner workflows stay operational and do not regress into consumer marketing banners.

### Shell Chrome

- Competing shell surfaces were reduced or consolidated, not duplicated.
- Any removed banner or callout was replaced by a guidance strip, panel, next-step card, or shell orientation surface.
- No section becomes a dead end after shell cleanup.

## Applied In This Workstream

- GUIDE-003 — Navigation simplification without guidance loss
- GUIDE-005 — State-aware guidance by persona and journey stage

## Failure Rule

If any checklist item fails, do not mark the loop resolved. Either fix the regression or log the gap in the issue registry before shipping.