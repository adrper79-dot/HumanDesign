# Prime Self Canonical Guidance Glossary

**Guide Loop:** GUIDE-004  
**Created:** 2026-03-20  
**Status:** Complete

---

## Purpose

This registry defines one source of truth for the most reused term explanations in the frontend guidance layer.

The immediate goal is to stop chart and profile surfaces from drifting between:

- raw system names
- display labels
- tooltip labels
- explainer text

The canonical registry now lives in [frontend/js/explanations.js](frontend/js/explanations.js) and is consumed by live chart/profile explanation surfaces in [frontend/js/app.js](frontend/js/app.js).

---

## Record Shape

Each canonical term record contains:

- `label`: approved display name for UI surfaces
- `plainMeaning`: short beginner-first meaning
- `whyItMatters`: why the term affects the user experience or interpretation
- `full`: deeper explanation used in live explainers
- `aliases`: approved alternate inputs that resolve back to the same canonical term

---

## Categories Introduced In GUIDE-004

- `type`
- `authority`
- `strategy`
- `definition`
- `profile`
- `concept`

These categories are intentionally limited to the terms currently causing the most drift in chart and profile flows.

---

## Approved Alias Examples

### Type

- `Generator` -> `Builder Pattern`
- `Manifesting Generator` -> `Builder-Initiator Pattern`
- `Projector` -> `Guide Pattern`
- `Manifestor` -> `Catalyst Pattern`
- `Reflector` -> `Mirror Pattern`

### Authority

- `Emotional Authority` -> `Emotional Wave Navigation`
- `Sacral Authority` -> `Life Force Response`
- `Splenic Authority` -> `Intuitive Knowing`
- `Heart` -> `Willpower Alignment`
- `None` -> `Lunar Cycle Awareness`

### Definition

- `Split Definition` -> `Bridging Pattern`
- `Triple Split Definition` -> `Triple Bridging Pattern`
- `Quad Split` -> `Quadruple Bridging Pattern`
- `No Definition` -> `Open Flow`

### Core Concepts

- `Chart`, `Energy Chart`, `Bodygraph`, `BodyGraph` -> `Energy Blueprint`
- `Profile`, `Prime Self Profile` -> `AI Profile`

---

## Live Consumers

The registry is now consumed by:

- the chart result explainer rows for type, authority, and definition
- the chart/profile quick summary surfaces that display canonical term labels
- the generic `getExplanation()` and `getShortExplanation()` helpers when they receive a mapped glossary category

That means the same source now governs both the display label and the explainer text for the chart/profile terms touched in this loop.

---

## Scope Boundaries

- This is not a rewrite of every educational string in the product.
- Gate, center, sign, and house educational corpora remain in their existing registries.
- Future loops can extend the canonical registry instead of duplicating per-tab term copy.

---

## Follow-On Work

- GUIDE-005 should adapt the amount of glossary exposure by user state, not redefine the glossary.
- GUIDE-003 can simplify navigation safely because orientation and core terms now have explicit reusable sources.
- Any future tooltip or learn-more surface should resolve through the canonical term registry before introducing a new alias.