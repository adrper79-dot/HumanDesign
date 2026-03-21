# Prime Self — Guidance Integrity Loop Plan
**Created:** 2026-03-20  
**Source:** UI review + product-principles follow-up  
**Owner:** Product + Frontend Engineering  
**Status:** Active — loop intake approved, backlog/registry items open

---

## Objective

Improve the app shell, navigation, and UI system **without reducing explanatory guidance for unfamiliar users**.

This plan treats guidance as a first-class product surface rather than as incidental copy. The implementation standard is:

- Keep plain-language-first support available at all times.
- Reduce visual noise, not instructional integrity.
- Move guidance into reusable, state-aware components.
- Preserve one source of truth for terms, definitions, and next-step prompts.
- Make each delivery loop small enough for an agent to execute safely in one cycle.

---

## Product Constraints

These loops must comply with [PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md):

- **Principle 2: Synthesis Over Information** — guidance must explain meaning, not just expose labels.
- **Principle 3: Plain Language First, Depth on Demand** — default guidance is always understandable by a first-time user.
- **Principle 4: Earn the Next Step** — every major state must tell the user what happened and where to go next.
- **Principle 6: One Truth, One Source** — terms and definitions cannot drift across tabs.
- **Practitioner-first rule** — consumer guidance must not obscure practitioner workflows or commercial integrity.

---

## Loop Order

| Loop | Issue | Backlog ID | Priority | Outcome |
|------|-------|------------|----------|---------|
| 0 | GAP-009 | BL-FRONTEND-P1-10 | P1 | Epic: guidance integrity architecture + delivery loops |
| 1 | GUIDE-001 | BL-FRONTEND-P1-11 | P1 | Inventory all guidance surfaces and map them to one source of truth |
| 2 | GUIDE-002 | BL-FRONTEND-P1-12 | P1 | Introduce reusable guidance UI surfaces (orientation, inline help, next-step, deep-dive) |
| 3 | GUIDE-003 | BL-FRONTEND-P1-13 | P1 | Simplify navigation chrome while preserving persistent orientation |
| 4 | GUIDE-004 | BL-FRONTEND-P2-9 | P2 | Build canonical glossary / term explainer system |
| 5 | GUIDE-005 | BL-FRONTEND-P2-10 | P2 | Make guidance state-aware by persona and journey state |
| 6 | GUIDE-006 | BL-FRONTEND-P2-11 | P2 | Add guidance regression checklist and release gate |

---

## Agentic Build Standard

Every loop must be executable by an agent without re-discovering product intent from scratch.

### Required Structure For Every Loop

1. **User story sentence**
   - One sentence only.
   - Must name persona, moment, capability, and outcome.

2. **Scope boundary**
   - Files in scope.
   - Explicit non-goals.
   - No opportunistic redesign beyond the loop definition.

3. **Guidance preservation rule**
   - No explanatory block may be removed unless its meaning is remapped to another guidance surface.
   - Every removed guidance node must have a destination component or canonical data source.

4. **Verification rule**
   - Verify that the user still knows:
     - what this screen is for
     - what unfamiliar terms mean
     - what to do next
     - what changed after completing the action

5. **Completion artifact**
   - Each loop must leave behind either:
     - a reusable component
     - a canonical data source
     - a regression check
     - or a documented state machine

### Agent Prompt Contract

When an agent executes a loop, the prompt should include:

- the exact loop ID
- the user story sentence
- files in scope
- acceptance criteria
- constraints
- required validation steps
- instruction to preserve all guidance coverage even when simplifying layout

### Global Non-Negotiables

- Do not delete first-time-user guidance and rely only on tooltips.
- Do not collapse core meaning behind hover-only interactions.
- Do not introduce ad hoc terminology.
- Do not mix marketing copy and workflow guidance in the same component unless both jobs are explicit.
- Do not ship a navigation cleanup that removes orientation cues before replacement cues exist.

---

## GAP-009 — Guidance Integrity Architecture

**Backlog ID:** BL-FRONTEND-P1-10  
**Issue Registry ID:** GAP-009  
**Impact:** UI simplification becomes safe because explanatory coverage is preserved by design  
**Effort:** 1 sprint  
**Files in Scope:** `frontend/index.html`, `frontend/js/app.js`, `frontend/css/app.css`, `frontend/js/explanations.js`, `frontend/js/tooltip.js`, `PRODUCT_PRINCIPLES.md`, `frontend/locales/en.json`

### Why

The current UI carries guidance in many forms at once: feature callouts, helper text, tooltips, intro cards, banners, step guides, and result explanations. That preserves instructional depth, but it also creates visual competition and makes shell simplification risky. The solution is not to reduce explanation. The solution is to create a guidance architecture that separates persistent orientation from inline help, interpretive explanation, and on-demand depth.

### Done Definition

- A canonical guidance model exists and is referenced by the loop items below.
- The UI can be simplified without any guidance regression.
- Each subsequent loop can be executed independently by an agent.

---

## GUIDE-001 — Guidance Inventory + Source Map

**Backlog ID:** BL-FRONTEND-P1-11  
**Issue Registry ID:** GUIDE-001  
**User Story:** As a first-time user entering an unfamiliar system, when I land on any major workflow, I need the product's guidance surfaces to be classified and traceable, so that future UI cleanup does not silently remove meaning.

### Work

1. Inventory every guidance surface in the primary SPA shell:
   - tab intro blocks
   - feature callouts
   - form helper text
   - tooltips/help icons
   - glossary-style explanations
   - next-step cards
   - empty-state coaching
   - success-state guidance
2. Classify each surface as one of:
   - `orientation`
   - `inline-help`
   - `interpretation`
   - `next-step`
   - `deep-dive`
3. Record the canonical source for each meaning.
4. Mark duplicates and drift risks.

### Deliverables

- `docs/guidance-surface-map.md`
- A source-of-truth table for high-risk terms and guidance nodes.

### Non-Goals

- No UI redesign in this loop.
- No term rewriting unless a duplicate or contradiction blocks classification.

### Done Definition

- Every primary workflow has a guidance map.
- No major explanatory block is unclassified.
- Top 20 guidance risks are documented with source ownership.

---

## GUIDE-002 — Reusable Guidance Surface System

**Backlog ID:** BL-FRONTEND-P1-12  
**Issue Registry ID:** GUIDE-002  
**User Story:** As a user moving across tabs, when I need help understanding what a screen or result means, I need consistent guidance components, so that explanations feel trustworthy and familiar rather than improvised.

### Work

Create reusable UI patterns for:

- `GuidanceStrip` — always-visible orientation line
- `GuidancePanel` — expanded contextual explanation
- `InlineHint` — compact field/section helper text
- `TermExplainer` — definition + plain-language interpretation
- `NextStepCard` — explicit recommended action after a result or milestone
- `LearnMoreDisclosure` — optional deeper educational content

### Requirements

- Components must support both personal-user and practitioner contexts.
- Components must be style-consistent with the existing premium system.
- Guidance surfaces must support keyboard and screen-reader access.
- No component may require hover as the only way to access core meaning.

### Done Definition

- At least the chart and profile flows use the new guidance components.
- Existing one-off feature callouts are replaced or formally marked for later migration.
- CSS and DOM patterns are reusable across tabs.

---

## GUIDE-003 — Navigation Simplification Without Guidance Loss

**Backlog ID:** BL-FRONTEND-P1-13  
**Issue Registry ID:** GUIDE-003  
**User Story:** As a new user trying to find my way through the product, when the shell is simplified, I need persistent orientation to remain obvious, so that fewer nav controls do not make the app harder to understand.

### Work

1. Simplify navigation chrome while preserving guidance through explicit orientation surfaces.
2. Keep one persistent answer to:
   - What is this section?
   - Why does it matter?
   - What do I do next?
3. Make the step guide contextual rather than universally persistent.
4. Consolidate account/admin actions so workflow guidance stays primary.

### Requirements

- Navigation simplification must not remove access to explanatory context.
- Mobile and desktop must share the same orientation logic even if surfaces differ.
- Any removed banner/callout must map to `GuidanceStrip`, `GuidancePanel`, or `NextStepCard`.

### Done Definition

- Core shell uses fewer competing navigation surfaces.
- The chart-to-profile-to-transits path remains explicit.
- First-time users still get persistent orientation without repeated promo-style banners.

---

## GUIDE-004 — Canonical Glossary + Term Explainer Source Of Truth

**Backlog ID:** BL-FRONTEND-P2-9  
**Issue Registry ID:** GUIDE-004  
**User Story:** As a user unfamiliar with Energy Blueprint terminology, when I encounter a system term, I need one consistent plain-language explanation everywhere, so that my understanding compounds instead of resetting on each tab.

### Work

1. Create canonical term records for the major concepts surfaced in UI.
2. Each record must include:
   - system term
   - plain-language meaning
   - why-it-matters sentence
   - optional deeper technical explanation
   - approved terminology aliases
3. Route help icons and explainer components to this source.

### Done Definition

- Term explanations no longer drift between tabs.
- New guidance surfaces pull from one canonical source.
- Approved terminology aligns with product principles and rebrand rules.

---

## GUIDE-005 — State-Aware Guidance By Persona + Journey Stage

**Backlog ID:** BL-FRONTEND-P2-10  
**Issue Registry ID:** GUIDE-005  
**User Story:** As either a first-time personal user or a practitioner returning to work, when I revisit the product, I need guidance that matches my state, so that I am supported without being buried in repeated instruction.

### Work

Define rules for guidance expansion/compression based on:

- first-time vs returning
- no-chart vs chart-generated vs profile-generated
- practitioner vs personal user
- locked vs unlocked feature state

### Requirements

- First-time users get expanded guidance by default.
- Returning users get compressed summaries with on-demand expansion.
- Practitioner workflows prioritize operational next steps, not consumer education banners.
- State logic must be deterministic and inspectable.

### Done Definition

- Guidance state machine documented.
- At least overview, chart, profile, and practitioner surfaces respond to user state.
- No workflow is left with blank or generic next-step guidance after compression.

---

## GUIDE-006 — Guidance Regression Harness

**Backlog ID:** BL-FRONTEND-P2-11  
**Issue Registry ID:** GUIDE-006  
**User Story:** As a maintainer shipping UI changes in loops, when guidance surfaces move or compress, I need a regression harness, so that layout cleanup cannot silently break user comprehension.

### Work

Create a guidance regression checklist and lightweight automated coverage for:

- orientation exists on each key workflow
- next-step guidance exists after each key milestone
- term explainers remain reachable
- first-time users retain a plain-language entry path
- practitioner workflows retain operational coaching

### Deliverables

- `docs/guidance-regression-checklist.md`
- deterministic manual test script for core journeys
- optional grep/lint rules for missing guidance anchors

### Done Definition

- Guidance regression becomes a release criterion for UI loops.
- Agents can validate guidance quality without redoing the entire product review.
- Future UI cleanup can be run safely in repeated cycles.

---

## Recommended Execution Protocol

Run the loops in order. Do not start GUIDE-003 before GUIDE-001 and GUIDE-002 are complete enough to preserve meaning. Do not start GUIDE-005 before GUIDE-004 establishes canonical terms. Do not close the workstream until GUIDE-006 exists and has been applied to at least one completed loop.

### Safe Loop Sequence

1. GAP-009 — approve architecture and working rules
2. GUIDE-001 — inventory and classification
3. GUIDE-002 — component system
4. GUIDE-004 — glossary source of truth
5. GUIDE-005 — state-aware orchestration
6. GUIDE-003 — shell simplification using new guidance infrastructure
7. GUIDE-006 — regression gate and release checklist

### Definition Of Success

The product becomes visually cleaner **and** more instructional at the same time:

- less repeated visual weight
- more consistent explanation
- stronger next-step guidance
- less terminology drift
- safer repeated agent loops