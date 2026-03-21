# Prime Self Guidance Component System

**Guide Loop:** GUIDE-002  
**Created:** 2026-03-20  
**Status:** Complete  
**Reference plan:** [docs/GUIDANCE_INTEGRITY_LOOP_PLAN_2026-03-20.md](docs/GUIDANCE_INTEGRITY_LOOP_PLAN_2026-03-20.md)

---

## Purpose

This document defines the reusable guidance surfaces introduced for the chart and profile flows so future UI cleanup can preserve guidance coverage without recreating one-off callouts.

The system is intentionally small:

- `GuidanceStrip` for always-visible orientation
- `GuidancePanel` for contextual explanation
- `InlineHint` for field and section help that does not rely on hover
- `TermExplainer` for plain-language definitions and why-it-matters context
- `NextStepCard` for explicit recommended action
- `LearnMoreDisclosure` for optional deeper educational content

---

## Component Contract

### GuidanceStrip

- **Job:** Answer what this screen is for in one glance.
- **Usage:** Place once near the top of the workflow.
- **Must include:** short eyebrow, title, plain-language sentence.
- **Should not include:** dense marketing language or multiple competing CTAs.

### GuidancePanel

- **Job:** Expand the local workflow explanation without becoming a promo banner.
- **Usage:** Pair near the primary form or result area.
- **Must include:** why the screen exists and how the current action affects later steps.

### InlineHint

- **Job:** Explain a field or control in-line, visible on keyboard and touch.
- **Usage:** Connect with `aria-describedby` where the hint explains a specific control.
- **Must include:** completion-relevant information only.

### TermExplainer

- **Job:** Define one core term and explain why it matters.
- **Usage:** Pair with guidance panels where unfamiliar language would otherwise create friction.
- **Must include:** term, plain-language meaning, why-it-matters sentence.

### NextStepCard

- **Job:** Tell the user what to do next after reading the surrounding guidance.
- **Usage:** Before or after a milestone, depending on the workflow.
- **Must include:** one clear action path.

### LearnMoreDisclosure

- **Job:** Hold deeper educational content without hiding core meaning behind hover.
- **Usage:** Use for optional nuance, caveats, or advanced explanation.
- **Must include:** summary text that explains what will open.

---

## Reference Implementation

### Chart flow

- `GuidanceStrip` introduces the chart as the source for every later reading.
- `GuidancePanel` explains why date, time, and location matter.
- `TermExplainer` defines `Energy Blueprint`.
- `NextStepCard` gives a single recommended action.
- `InlineHint` is attached to time, location, and timezone fields with `aria-describedby`.
- `LearnMoreDisclosure` provides optional precision guidance.

### Profile flow

- `GuidanceStrip` replaces the previous one-off synthesis callout.
- `GuidancePanel` explains default vs advanced usage.
- `TermExplainer` defines `AI Profile`.
- `NextStepCard` replaces the custom advanced-toggle explainer block.
- `InlineHint` supports timezone, systems, and question targeting.
- `LearnMoreDisclosure` is used for synthesis grounding and optional depth systems.

---

## Accessibility Rules

- Core meaning must be visible without hover.
- Field-level hints should use `aria-describedby` when tied to a specific input.
- Disclosure content should use native `details/summary` where practical.
- Summary text must describe the value of expanding the content.

---

## Reuse Rules For Later Loops

- Use `data-guidance-context="personal"` or `data-guidance-context="practitioner"` to switch accent treatment without creating a new component family.
- Do not create a new feature-callout variant when one of the six guidance components fits.
- If a future tab needs marketing copy and workflow guidance together, separate them into distinct surfaces.
- If a deeper explanation becomes canonical product language, move the meaning into the glossary/source layer in GUIDE-004 rather than duplicating it in markup.

---

## Migration Notes

- Existing feature callouts outside chart and profile are not yet migrated; they remain candidates for GUIDE-003 and later loops.
- Existing tooltip help remains available, but chart/profile now expose the core field meaning in visible inline hints so those workflows are no longer tooltip-dependent for primary completion guidance.