# Prime Self — Guidance Surface Map
**Guide Loop:** GUIDE-001  
**Created:** 2026-03-20  
**Status:** Complete  
**Scope:** Main SPA guidance surfaces in the current frontend shell

---

## Purpose

This document inventories the user-guidance surfaces currently present in the main Prime Self SPA so future UI simplification work does not silently remove meaning.

The key distinction is:

- **Guidance is not just copy.** It includes orientation, helper text, explanatory interpretation, next-step prompting, and deeper educational content.
- **Guidance coverage must survive layout cleanup.** A guidance node may move or compress, but its meaning must not disappear unless its replacement is explicit.

This map is the source artifact for the guidance integrity workstream defined in [docs/GUIDANCE_INTEGRITY_LOOP_PLAN_2026-03-20.md](docs/GUIDANCE_INTEGRITY_LOOP_PLAN_2026-03-20.md).

---

## Classification Model

Every guidance node in this map is classified as one of:

- **orientation**: answers what this screen is for
- **inline-help**: helps the user complete a local action or understand a field/control
- **interpretation**: translates data into meaning in plain language
- **next-step**: tells the user what to do after a milestone or when blocked
- **deep-dive**: optional or advanced educational context beyond the default interaction

### Source Status Labels

- **canonical**: appears to be backed by a central or intentional source
- **duplicated**: meaning exists in multiple places with overlap
- **conditional**: only appears in specific states, which makes it easy to miss
- **drifting**: wording, terminology, or source ownership is unstable

---

## Files Reviewed

- [frontend/index.html](frontend/index.html)
- [frontend/js/app.js](frontend/js/app.js)
- [frontend/js/explanations.js](frontend/js/explanations.js)
- [frontend/js/tooltip.js](frontend/js/tooltip.js)
- [frontend/locales/en.json](frontend/locales/en.json)
- [PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md)

---

## Source-Of-Truth Candidates

| Candidate | Current Role | Strength | Risk |
|---|---|---|---|
| [frontend/js/explanations.js](frontend/js/explanations.js) | Central explanatory registry for chart concepts, centers, gates, channels, signs, houses | Best current explanation source | English-only, partly overlapping with display mappings in app logic |
| [frontend/locales/en.json](frontend/locales/en.json) | UI labels and short strings | i18n-ready and structured | Does not yet hold most core explanatory meaning |
| [frontend/js/app.js](frontend/js/app.js) | Live render and state orchestration | Knows user state and journey transitions | Guidance logic mixed with rendering and workflow logic |
| [PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md) | Product-level language and guidance constraints | Canonical product filter | Not wired into runtime surfaces |

### Current Recommendation

- Treat [frontend/js/explanations.js](frontend/js/explanations.js) as the current explanation source of truth.
- Treat [frontend/locales/en.json](frontend/locales/en.json) as the future localization layer for those explanations.
- Do not add more per-tab one-off definitions before GUIDE-004 creates a canonical glossary model.

---

## Workflow Coverage Summary

| Workflow | Guidance Coverage | Main Surfaces | Source Status |
|---|---|---|---|
| Overview | Strong | welcome card, persona-specific overview messaging, CTA | conditional + partly drifting |
| Chart | Very strong | form hints, help icons, explanation blocks, bodygraph guidance, gate/channel/center interpretation | mostly canonical, but tooltip-heavy |
| Profile | Moderate | intro callout, optional question help, synthesis output | mixed; generated interpretation plus static orientation |
| Transits | Moderate | interpretive callouts, transit context notes | partly canonical, partly scattered render-time copy |
| Check-In | Strong | score helper, strategy/authority help, streak/tracking framing | mixed; tooltip-heavy |
| Composite | Moderate | relationship help icons, missing-field prompts, relational interpretation | mixed; partially accessible via aria-describedby, partially drifting |
| Practitioner | Moderate | welcome messaging, workflow checklist, session-oriented next steps | conditional and workflow-driven |
| Onboarding | Strong | step-based wizard, quick picks, progression cues | canonical |
| Diary | Moderate | transit context, filter guidance, journaling prompts | conditional |
| Enhance | Light-to-moderate | assessment explainer callout | partly duplicated/promo-style |
| Clusters | Moderate | feature labels, help icons, shared challenge guidance | mixed |
| Timing | Light-to-moderate | intro callout and field-level orientation | partly promo-style |
| Celebrity | Light | intro callout | promo-style |
| Achievements | Light | intro callout | promo-style |
| Directory | Light | intro callout | promo-style |

---

## Workflow Inventory

### Overview

| Surface | Class | Location | Purpose | Source Status |
|---|---|---|---|---|
| Welcome card | orientation | [frontend/index.html](frontend/index.html#L853) and [frontend/js/app.js](frontend/js/app.js#L196) | Explains what the dashboard/workspace is for | conditional |
| Persona-specific overview message | orientation | [frontend/js/app.js](frontend/js/app.js#L196) | Switches consumer vs practitioner framing | duplicated |
| Primary CTA | next-step | [frontend/index.html](frontend/index.html#L857) and runtime overview rendering in [frontend/js/app.js](frontend/js/app.js#L211) | Pushes user into chart or practitioner workflow | canonical |
| Practitioner-plan link in consumer path | next-step | [frontend/js/app.js](frontend/js/app.js#L214) | Upgrade or practitioner exploration | drifting |

### Chart

| Surface | Class | Location | Purpose | Source Status |
|---|---|---|---|---|
| Step guide banner | orientation | [frontend/index.html](frontend/index.html#L871) | Explains the 5-step activation journey | canonical |
| Birth time/location/timezone help icons | inline-help | [frontend/index.html](frontend/index.html#L907), [frontend/index.html](frontend/index.html#L912), [frontend/index.html](frontend/index.html#L924) | Explains why accurate birth inputs matter | canonical but tooltip-only |
| Chart form summary | inline-help | [frontend/index.html](frontend/index.html#L970) | Condenses birth data after calculation | conditional |
| Identity strip | interpretation | [frontend/index.html](frontend/index.html#L834) | Persistent summary of type/authority/profile after chart generation | conditional |
| Type explanation block | interpretation | Rendered from [frontend/js/explanations.js](frontend/js/explanations.js#L10) | Explains energy type in plain language | canonical |
| Authority explanation block | interpretation | Rendered from [frontend/js/explanations.js](frontend/js/explanations.js#L35) | Explains decision-making style | canonical but duplicated with display remaps |
| Strategy explanation block | interpretation | Rendered from [frontend/js/explanations.js](frontend/js/explanations.js#L93) | Explains interaction strategy | canonical |
| Profile explanation block | interpretation | Rendered from [frontend/js/explanations.js](frontend/js/explanations.js#L114) | Explains archetype/life-role profile | canonical |
| Definition / circuit explanation block | interpretation | Rendered from [frontend/js/explanations.js](frontend/js/explanations.js) | Explains connectedness / split patterns | drifting terminology |
| Not-self / signature explanation blocks | interpretation | Rendered in chart result logic | Explains alignment and misalignment signals | canonical but context-linking is weak |
| Cross / purpose vector explanation | deep-dive | Rendered from chart result logic + explanation data | Explains larger life-theme framing | canonical |
| Center explanations | interpretation | [frontend/js/explanations.js](frontend/js/explanations.js#L168) | Explains each center and defined/open state | canonical |
| Center help icons and hover content | inline-help | chart render + [frontend/js/tooltip.js](frontend/js/tooltip.js) | Local meanings and biological context | tooltip-heavy |
| Channel descriptions | interpretation | [frontend/js/explanations.js](frontend/js/explanations.js#L206) | Explains activated channels | canonical |
| Natal gates explanation section | deep-dive | chart result render + gate registry in [frontend/js/explanations.js](frontend/js/explanations.js) | Provides per-gate plain-English themes | canonical |
| Astrology signs/houses explanations | deep-dive | explanation module + chart result rendering | Bridges astrology layer into plain language | canonical |
| Share/download controls | next-step | chart result actions | Moves user into export/share workflow | canonical |
| Polar warning | inline-help | conditional chart warning path | Explains house-system fallback for polar births | conditional canonical |

### Profile

| Surface | Class | Location | Purpose | Source Status |
|---|---|---|---|---|
| AI-Powered Synthesis callout | orientation | [frontend/index.html](frontend/index.html#L1008) | Explains what the profile does and what systems it combines | duplicated / promo-style |
| Default summary / advanced panel messaging | inline-help | [frontend/index.html](frontend/index.html#L1080) onward | Guides question targeting and optional configuration | canonical |
| Optional question placeholder and hints | inline-help | profile form fields in [frontend/index.html](frontend/index.html) | Helps user ask a useful synthesis question | canonical |
| Generated profile sections | interpretation | runtime synthesis rendering in [frontend/js/app.js](frontend/js/app.js) | Converts raw chart data into actionable synthesis | user/data-generated |
| Share profile button | next-step | [frontend/index.html](frontend/index.html#L1144) | Guides post-synthesis sharing | conditional |

### Transits

| Surface | Class | Location | Purpose | Source Status |
|---|---|---|---|---|
| Transit result descriptions | interpretation | transit render logic in [frontend/js/app.js](frontend/js/app.js) | Explains what current transits mean | canonical but render-scattered |
| Natal-hit callouts | inline-help | transit result render logic | Explains why a transit is more personal when it hits natal data | canonical |
| Gate context notes | interpretation | transit render logic | Turns gate activations into experiential language | canonical but scattered |

### Check-In

| Surface | Class | Location | Purpose | Source Status |
|---|---|---|---|---|
| Daily Alignment Tracking callout | orientation | [frontend/index.html](frontend/index.html#L1433) | Explains why the check-in exists | duplicated / promo-style |
| Alignment score help icon | inline-help | [frontend/index.html](frontend/index.html#L1454) | Explains the 1–10 scale | canonical but tooltip-only |
| Strategy help icon | inline-help | [frontend/index.html](frontend/index.html#L1473) | Explains how to assess whether strategy was followed | canonical but tooltip-only |
| Authority help icon | inline-help | [frontend/index.html](frontend/index.html#L1480) | Explains how to assess decision-making alignment | canonical but tooltip-only |
| Energy level help icon | inline-help | [frontend/index.html](frontend/index.html#L1497) | Explains optional energy rating | canonical but tooltip-only |
| Completed/streak messaging | next-step | check-in completion surfaces in [frontend/index.html](frontend/index.html#L1445) and app logic | Encourages continuity and tracking | conditional |

### Composite

| Surface | Class | Location | Purpose | Source Status |
|---|---|---|---|---|
| Relationship form labels and helper affordances | orientation | composite tab in [frontend/index.html](frontend/index.html) | Frames the workflow as a two-person compatibility tool | canonical |
| Help icons using aria-describedby | inline-help | [frontend/index.html](frontend/index.html#L1680), [frontend/index.html](frontend/index.html#L1701), [frontend/index.html](frontend/index.html#L1741), [frontend/index.html](frontend/index.html#L1756), [frontend/index.html](frontend/index.html#L1762) | Explains compatibility concepts and inputs | canonical |
| Missing-data messages | next-step | composite form / app logic | Tells users what still needs to be entered | conditional canonical |
| Relationship synthesis blocks | interpretation | composite render logic in [frontend/js/app.js](frontend/js/app.js) | Explains electromagnetic, compromise, dominance, companionship patterns | canonical but render-scattered |

### Practitioner

| Surface | Class | Location | Purpose | Source Status |
|---|---|---|---|---|
| Practitioner welcome card | orientation | overview runtime in [frontend/js/app.js](frontend/js/app.js#L202) | Explains practitioner workspace value | conditional |
| Roster / empty-state workflow framing | orientation | practitioner tab render logic | Frames the practitioner workflow | conditional |
| Client workflow checklist | next-step | practitioner detail rendering in [frontend/js/app.js](frontend/js/app.js) and related controllers | Shows operational progress and recommended next action | canonical |
| Session note / AI context help | inline-help | practitioner views and forms | Explains what notes and AI context are for | conditional |
| Follow-up brief | deep-dive | practitioner client workflow | Converts session information into actionable follow-up artifact | canonical |

### Onboarding

| Surface | Class | Location | Purpose | Source Status |
|---|---|---|---|---|
| Welcome step | orientation | [frontend/index.html](frontend/index.html#L564) | Frames the product promise for new users | canonical |
| Birth detail step | orientation | [frontend/index.html](frontend/index.html#L577) onward | Explains the minimal setup needed | canonical |
| Eval type cards | orientation | onboarding step 3 in [frontend/index.html](frontend/index.html#L641) | Helps user choose blueprint vs daily focus | canonical |
| Quick-pick prompts | inline-help | onboarding step 4 in [frontend/index.html](frontend/index.html#L662) | Helps user ask a useful question without writing one from scratch | canonical |
| Dot progress indicator | inline-help | [frontend/index.html](frontend/index.html#L672) | Reinforces step progress | canonical |
| Completion behavior | next-step | onboarding flow in [frontend/js/app.js](frontend/js/app.js#L6897) | Moves user into chart/profile flow | canonical |

### Diary

| Surface | Class | Location | Purpose | Source Status |
|---|---|---|---|---|
| Chart Confirmation Log callout | orientation | [frontend/index.html](frontend/index.html#L1321) | Explains why logging life events matters | duplicated / promo-style |
| Transit context card | deep-dive | [frontend/index.html](frontend/index.html#L1329) and diary load logic | Connects current transits to diary entries | conditional |
| Filter and export affordances | inline-help | [frontend/index.html](frontend/index.html#L1382), [frontend/index.html](frontend/index.html#L1403) | Helps with diary retrieval and management | canonical |

### Enhance

| Surface | Class | Location | Purpose | Source Status |
|---|---|---|---|---|
| Deepen Your AI Reading callout | orientation | [frontend/index.html](frontend/index.html#L1235) | Explains why assessments improve synthesis | duplicated |
| Assessment labels/descriptions | inline-help | enhance tab in [frontend/index.html](frontend/index.html) | Explains what each assessment contributes | canonical |

### Clusters

| Surface | Class | Location | Purpose | Source Status |
|---|---|---|---|---|
| Group Dynamics help icon | orientation | [frontend/index.html](frontend/index.html#L2071) | Frames the group-analysis feature | canonical but tooltip-only |
| Cluster Name / Shared Challenge help icons | inline-help | [frontend/index.html](frontend/index.html#L2087), [frontend/index.html](frontend/index.html#L2091) | Guides group setup | canonical but tooltip-only |
| Cluster synthesis outputs | interpretation | cluster render logic | Explains group-level energy patterns | conditional |

### Lighter Guidance Surfaces

| Workflow | Surface | Class | Status |
|---|---|---|---|
| Celebrity | Feature callout at [frontend/index.html](frontend/index.html#L2164) | orientation | duplicated / promo-style |
| Achievements | Feature callout at [frontend/index.html](frontend/index.html#L2194) | orientation | duplicated / promo-style |
| Directory | Feature callout at [frontend/index.html](frontend/index.html#L2226) | orientation | duplicated / promo-style |
| Timing | Feature callout at [frontend/index.html](frontend/index.html#L2274) | orientation | duplicated / promo-style |

---

## Guidance Delivered Primarily Through Tooltip / Hover Patterns

These surfaces are high-risk because meaning is easy to miss on touch, keyboard, or quick-scan usage.

| Surface | Location | Risk |
|---|---|---|
| Type help icon | chart result render | Meaning depends on tooltip visibility |
| Authority help icon | chart result render | Same risk |
| Strategy help icon | chart result render | Same risk |
| Profile help icon | chart result render | Same risk |
| Definition help icon | chart result render | Same risk |
| Not-self help icon | chart result render | Same risk |
| Signature help icon | chart result render | Same risk |
| Purpose vector help icon | chart result render | Same risk |
| Energy centers help icon | chart result render | Same risk |
| Active channels help icon | chart result render | Same risk |
| Natal gates help icon | chart result render | Same risk |
| Check-in score / strategy / authority / energy icons | [frontend/index.html](frontend/index.html#L1454), [frontend/index.html](frontend/index.html#L1473), [frontend/index.html](frontend/index.html#L1480), [frontend/index.html](frontend/index.html#L1497) | Same risk |
| Cluster setup help icons | [frontend/index.html](frontend/index.html#L2071), [frontend/index.html](frontend/index.html#L2087), [frontend/index.html](frontend/index.html#L2091) | Same risk |

### Note

[frontend/js/tooltip.js](frontend/js/tooltip.js) is competent positioning logic, but it still relies on `.help-icon[title]` for many core meaning surfaces. That is a delivery risk, not a content-quality risk.

---

## Top 20 Drift / Duplication Risks

| ID | Risk | Evidence | Why It Matters |
|---|---|---|---|
| DRIFT-001 | Type labels are remapped in app state and explained separately elsewhere | [frontend/js/app.js](frontend/js/app.js#L89) vs [frontend/js/explanations.js](frontend/js/explanations.js#L10) | Display names and explanations can diverge |
| DRIFT-002 | Authority names exist both as raw and remapped terms | [frontend/js/app.js](frontend/js/app.js#L94) vs [frontend/js/explanations.js](frontend/js/explanations.js#L35) | Users can see different labels for the same concept |
| DRIFT-003 | Emotional/Sacral/etc authority entries are duplicated with and without “Authority” suffix | [frontend/js/explanations.js](frontend/js/explanations.js#L35) | Redundant registry entries increase maintenance risk |
| DRIFT-004 | Definition terminology is inconsistent: split labels vs “connection pattern” framing | chart explanations + render logic | Concept can feel renamed depending on surface |
| DRIFT-005 | Most chart help is still tooltip-first | chart result surfaces + [frontend/js/tooltip.js](frontend/js/tooltip.js) | Meaning is easy to miss on touch/quick scan |
| DRIFT-006 | Center keys may not always match rendered labels exactly | [frontend/js/explanations.js](frontend/js/explanations.js#L168) | Lookup drift risk if naming changes |
| DRIFT-007 | Profile explanations contain short and full variants with no clear display standard | [frontend/js/explanations.js](frontend/js/explanations.js#L114) | Future surfaces may choose different variants arbitrarily |
| DRIFT-008 | Gate explanations are centralized but not normalized for tone/depth | gate explanation registry in [frontend/js/explanations.js](frontend/js/explanations.js) | Uneven user experience across gates |
| DRIFT-009 | Channel interactivity promise appears stronger than the actual interaction model | chart help copy vs render behavior | Guidance promise can exceed capability |
| DRIFT-010 | Not-self/signature meanings are not always explicitly tied back to type | chart interpretation sections | Users may miss why a signal belongs to them |
| DRIFT-011 | Overview guidance mixes product guidance with upgrade or practitioner promotion | [frontend/js/app.js](frontend/js/app.js#L211) | Workflow guidance and marketing are blurred |
| DRIFT-012 | Feature callouts repeat a similar explanatory pattern across many tabs | [frontend/index.html](frontend/index.html#L1008), [frontend/index.html](frontend/index.html#L1235), [frontend/index.html](frontend/index.html#L1321), [frontend/index.html](frontend/index.html#L1433), [frontend/index.html](frontend/index.html#L2164), [frontend/index.html](frontend/index.html#L2194), [frontend/index.html](frontend/index.html#L2226), [frontend/index.html](frontend/index.html#L2274) | Guidance exists, but visual emphasis is duplicated everywhere |
| DRIFT-013 | Core explanatory content is not localized | [frontend/js/explanations.js](frontend/js/explanations.js) vs [frontend/locales/en.json](frontend/locales/en.json) | Internationalization cannot scale cleanly |
| DRIFT-014 | Guided navigation and orientation logic live in app logic, not in a documented source map | [frontend/js/app.js](frontend/js/app.js#L1839) | Shell cleanup can break orientation sequencing |
| DRIFT-015 | Next-step guidance is strong in some flows and weak in others | chart/profile/practitioner stronger than celebrity/timing/directory | Journey quality varies by tab |
| DRIFT-016 | Practitioner guidance is heavily conditional on runtime state | overview/practitioner runtime rendering in [frontend/js/app.js](frontend/js/app.js) | Harder to audit and easier to regress |
| DRIFT-017 | Some help moved to aria-describedby in composite, but most other flows still use title tooltips | [frontend/index.html](frontend/index.html#L1680) and surrounding composite fields | Two guidance delivery patterns coexist |
| DRIFT-018 | Success-state guidance is not yet cataloged centrally | notifications, completion messages, streak updates in [frontend/js/app.js](frontend/js/app.js#L6263) | Hard to ensure users always know what changed |
| DRIFT-019 | Empty-state guidance is uneven across workflows | practitioner, diary, directory, achievements | Some surfaces teach the next action better than others |
| DRIFT-020 | Explanation ownership is implicit, not documented | logic split across runtime rendering, explanation registry, and localized labels | Future loops require rediscovery unless this map is maintained |

---

## Repeated Promo-Style Guidance Surfaces

These are not bad content. The risk is that they perform orientation using the same high-emphasis visual treatment across too many tabs.

- AI Profile callout in [frontend/index.html](frontend/index.html#L1008)
- Enhance callout in [frontend/index.html](frontend/index.html#L1235)
- Diary callout in [frontend/index.html](frontend/index.html#L1321)
- Check-In callout in [frontend/index.html](frontend/index.html#L1433)
- Celebrity callout in [frontend/index.html](frontend/index.html#L2164)
- Achievements callout in [frontend/index.html](frontend/index.html#L2194)
- Directory callout in [frontend/index.html](frontend/index.html#L2226)
- Timing callout in [frontend/index.html](frontend/index.html#L2274)

### Recommendation

These should migrate to a reusable guidance system in GUIDE-002, then be resized by state and workflow criticality in GUIDE-005 and GUIDE-003.

---

## Current Preservation Rules For Future Loops

Before any UI cleanup proceeds:

1. No guidance node may be removed unless its destination surface is identified in this map.
2. If a tooltip carries core meaning, that meaning must gain a non-hover fallback before simplification ships.
3. If a repeated feature callout is compressed, the replacement must still answer:
   - what this screen is for
   - why it matters
   - what to do next
4. Any terminology change must update both display mappings and explanation sources.
5. New guidance surfaces should prefer reusable components over per-tab one-off HTML.

---

## Recommended Next Loop Inputs

### GUIDE-002 should use this map to:

- replace high-emphasis repeated callouts with reusable guidance surfaces
- standardize orientation / inline-help / next-step rendering patterns
- reduce tooltip-only dependence for chart and check-in concepts

### GUIDE-004 should use this map to:

- unify display mappings in [frontend/js/app.js](frontend/js/app.js) and explanatory meaning in [frontend/js/explanations.js](frontend/js/explanations.js)
- define a canonical glossary source for terms and aliases

### GUIDE-003 should use this map to:

- simplify navigation only after replacement orientation surfaces are in place
- preserve the chart-to-profile-to-transits path as the most explicit first-time-user sequence

---

## Completion Notes

GUIDE-001 is complete when:

- the workflows above remain the reference inventory
- drift risks are used as a constraint in later loops
- future guidance work references this map rather than rediscovering guidance placement from scratch