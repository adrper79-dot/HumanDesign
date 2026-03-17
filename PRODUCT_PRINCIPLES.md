# Prime Self — Product Principles

> **This document outlines the principled constraints that govern every product and build decision.**
> It is not a vision deck or a roadmap. It is a filter.
> If a feature, fix, or UX change cannot pass the tests in this document, it is not ready to build.
>
> Read this before adding to the backlog. Read this before opening a file.
> Maintained alongside `ARCHITECTURE.md` as a living source of truth.

**Author:** Product Council  
**Date:** March 17, 2026  
**Status:** Canonical — supersedes scattered positioning statements across historical docs

---

## 1. The Mission

**Prime Self turns verified personal-energy data into synthesis a practitioner can deliver and a client can act on.**

Every word of that sentence matters:
- *Verified* — the math is always right. Full stop.
- *Personal-energy data* — Energy Blueprint, Astrology, Frequency Keys, Numerology, and Transits. Not one system. All of them together.
- *Synthesis* — cross-system reasoning, not a list of data points.
- *A practitioner can deliver* — professional enough to hand to a client, sharp enough to save prep time.
- *A client can act on* — plain language, life-area relevance, a clear next step.

---

## 2. Who We Serve

Prime Self has two customers. They are not the same person and their needs pull in different directions. We must hold both without collapsing into either.

---

### Customer A — The Practitioner

**Who they are:** An independent Human Design reader, coach, or energy-systems practitioner. They have paying or soon-to-be-paying clients. They value trust, polish, and continuity over enterprise admin features. Time is their scarcest resource.

**Their job-to-be-done:**
> *"I need to understand a client's design faster and more deeply than I could alone, then deliver that understanding in a way that builds the client's trust in me and makes them want to come back."*

**The four practitioner jobs** — every practitioner screen supports one of these, or it does not belong:

| Job | What it looks like |
|-----|--------------------|
| **Activate** | Onboard, build profile, get listed in the directory, set up practice surface |
| **Ready a client** | Add client record, generate chart, generate synthesis, add session notes |
| **Deliver** | Export PDF, share link, embed widget, send SMS digest |
| **Retain and grow** | Track client arc over time, transit alerts, referral to other practitioners |

**The practitioner experience is an operating system for better client sessions — not a client database, not a CRM, not a substitute for the practitioner's own skill.** Prime Self handles the research layer; the practitioner handles the relationship.

---

### Customer B — The Personal User

**Who they are:** Someone who wants to understand why they operate the way they do. They may discover the product through a practitioner, via social sharing, or on their own. They arrive with curiosity and leave when they hit confusion or blankness.

**Their job-to-be-done:**
> *"I want to understand something specific and true about how I work — and get something concrete I can actually use."*

**The personal journey has seven gates** — a feature either helps them pass through one of these gates or it is friction:

| Gate | The experience |
|------|---------------|
| **1. Arrive** | Land on the product; understand in 30 seconds what it is and what they'll get |
| **2. Calculate** | Enter birth data; get their chart immediately, no friction |
| **3. Understand** | Read their chart in plain language; at least one "that's me" moment |
| **4. Synthesize** | Generate their AI Profile; cross-system reasoning illuminates what the chart alone could not |
| **5. Deepen** | Complete behavioral assessments; feed real data into future synthesis |
| **6. Track** | Check in, diary, transit awareness; the product becomes a living companion |
| **7. Share** | Tell someone else; the referral loop activates |

**Personal users do not arrive as permanent subscribers. They arrive with one question. We earn their return by answering the first question better than anything else they've tried.**

---

### The Relationship Between A and B

Consumer surfaces exist to extend practitioner reach — not to compete with it. The personal user experience is a distribution and discovery layer. When a personal user hits a ceiling in their self-guided journey, the natural answer is a practitioner. Prime Self should facilitate that handoff, not bury it.

The `Deferral CTA` (shown to personal users after synthesis) is not a sales funnel trick. It is the product acting in the user's genuine interest: *"You've gotten everything self-guided synthesis can give you. There's a professional who can go further."*

---

## 3. Design Principles

These are not aspirations. They are constraints. A build decision that violates one of these is not a judgment call — it is a defect to be corrected.

---

### Principle 1: Calculation Before Everything

**The engine is sacred. No UX decision, performance optimization, or feature request modifies the math.**

The AP Test Vector (Guide, 6/2, Split Definition, Emotional Wave Navigation, Gate 33.6 / Gate 2.2 — August 5, 1979, Tampa FL) is the immovable verification anchor. Every engine change must pass it. No chart can be displayed until all 8 layers are verified.

**Corollary:** If building a feature requires relaxing precision in the calculation layer, the feature is not ready to be built. Build the engine more efficiently; do not round the output.

**Violation looks like:** "We'll approximate the design-side offset so the page loads faster." No. Never.

---

### Principle 2: Synthesis Over Information

**A data point without context is a failure of the product. The value is cross-system reasoning, not data display.**

Listing "Gate 33, Line 6" to a user who doesn't know what Gate 33 means is not insight — it's indirection with extra steps. Every field rendered to a user must answer at least one of: *What is this? What does it mean in my life? What should I do with it?*

**The synthesis standard:**
- Quick Start layer: archetype name + plain-language behavior + practical implication. Zero jargon.
- Technical layer: system term + mechanism + cross-system connection.
- Raw layer: full JSON, for developers and practitioners who need the source.

This 3-layer architecture is not optional. It is the product's core interaction contract.

**Corollary:** The AI Profile is not the product's AI feature — it is the product's primary value delivery. Every other feature exists to feed it or to act on what it produces.

**Violation looks like:** Rendering `Split Definition` as a label with no explanation. Listing `Gate 64 / Gate 47` as a channel code with no meaning. Showing astrology house placements without a "why it matters" sentence.

---

### Principle 3: Plain Language First, Depth on Demand

**The default state is always plain language. Technical depth is unlocked by the user, not forced on them.**

The Reddit research is clear: the single highest-friction moment across all competitive products is the user arriving at their chart and understanding nothing. Prime Self's differentiation is not that it shows more data — it is that it makes data *land*.

**The "dinner party test":** Would you say this to a smart friend at dinner who knows nothing about these systems? If not, it is not Layer 1 copy.

- ❌ "Your emotional solar plexus authority modulates decision-making through wave mechanics"
- ✅ "You make your best calls when you sleep on it. Never decide when you're at an emotional peak or a low."

**Corollary:** Jargon is only appropriate when it *teaches*. Introduce the system term after the plain-language explanation, not before. "You're a Guide (this is what Human Design calls a Projector) — here's what that means for how you actually work."

**Violation looks like:** Technical labels as the heading with explanations as the footnote. Tooltips full of system vocabulary. Onboarding that assumes familiarity with the underlying frameworks.

---

### Principle 4: Earn the Next Step

**Every screen must earn the user's attention before asking for their next action. No orphaned results. No dead ends.**

A completed action that deposits a user on a blank screen is a retention failure. After every major milestone in either journey — chart calculated, AI Profile generated, behavioral assessment saved, diary entry posted — the product must give the user a clear signal: *"Here's what happened, here's what it means, here's where to go next."*

**The three moments where this is most critical:**
1. Chart calculated → surface the AI Profile CTA immediately and specifically
2. AI Profile generated → surface the Enhance tab as the path to deeper accuracy
3. Subscriber upgrade → immediately unlock and highlight what is now available

**Corollary:** The 5-step journey banner is right in concept but passive in practice. Progress indicators must do more than track — they must guide.

**Violation looks like:** Chart result renders, user stares at data, no CTA. Profile generated, page ends, user closes the tab. Upgrade complete, landing on the same screen they were on before.

---

### Principle 5: Appropriate Authority at Each Layer

**AI reads patterns. Practitioners read clients. Users read themselves. No layer substitutes for its proper role.**

The synthesis engine is interpreted — not prophetic. It is a reasoning layer across verified data, not a life coach. It identifies patterns and creates a framework for reflection. The practitioner brings the relational intelligence. The user brings the lived experience that only they can validate.

**This has concrete implications for copy and AI output:**
- Never present synthesis as fact about the person's life, only as a pattern in their data.
- Never generate advice that substitutes for practitioner guidance on serious life decisions.
- The AI Profile is a starting point for a session — not a replacement for one.

**Corollary:** The `Deferral CTA` is not a failure state — it is the product correctly acknowledging its limits. A user who sees it and books a practitioner has had a successful product experience.

**Violation looks like:** AI output saying "You are destined for leadership" rather than "Your profile shows consistent indicators of leadership energy across [specific data points]." Framing synthesis as a verdict rather than a lens.

---

### Principle 6: One Truth, One Source

**Every data point in the product traces back to a single source of truth. No contradicting systems, no parallel definitions, no redundant canonical files.**

This principle was learned by observing the damage done when it was violated: two competing Forge naming systems, two Knowledge systems, three CSS token systems, and a feature matrix that didn't match the code. Every one of those required a repair cycle.

**The hierarchy of truth:**
- Engine behavior: the test suite + the AP test vector
- Pricing and tiers: `workers/src/lib/stripe.js` → `getTierConfig()`
- Design vocabulary: `frontend/locales/en.json` + `PRODUCT_PRINCIPLES.md`
- Knowledgebase content: `src/knowledgebase/` (the canonical source; prompts reference it, never duplicate it)

**Corollary:** Before adding a new constant, mapping, or content block — search for the existing one. If one exists, update it. If it doesn't, create a single canonical location and reference it everywhere else.

**Violation looks like:** Hard-coding a type name in a prompt that is already defined in `types.json`. Defining `--gold` inline in `index.html` while a design token system exists. Writing "Projector" in UI copy while the canonical term is "Guide Pattern."

---

### Principle 7: No Feature Without a Story

**Before a ticket is written, the user story is written. If the story cannot be written in one sentence, the feature is not understood well enough to build.**

Format: *"As a [specific persona], when [specific moment in their journey], I need [specific capability], so that [specific measurable outcome]."*

If any of the four brackets cannot be filled without vagueness, stop. Clarify the job first. The job defines the feature, never the reverse.

**Examples of stories that passed:**
- "As a practitioner, when generating a client's profile, I need practitioner context (synthesis style, shared notes) injected into the prompt, so that the synthesis reflects my client relationship, not just their birth data."
- "As a personal user, after my chart is calculated, I need birth data automatically carried to the AI Profile form, so that I don't have to re-enter everything to generate my reading."

**Examples of stories that fail, and why:**
- "As a user, I want a better dashboard." → *Which user? What is better? What will they do differently?* Rewrite before building.
- "Add tooltip explanations to chart terms." → *Which terms? Which users need them? What change in behavior do we expect?* Specificity required.

**Corollary:** The four-question fitness test (Section 4) is the structured version of this principle. Run it on every backlog item.

---

### Principle 8: The Practitioner's Commercial Integrity is the Product's Commercial Integrity

**Prime Self succeeds commercially when practitioners succeed commercially. Any feature that cannibalizes practitioner value delivery is a product failure, not a product win.**

Practitioners pay the highest tier prices. Their clients generate the largest referral volume. Their professional reputation is on the line every time Prime Self output is handed to a real person. If Prime Self makes the practitioner look less needed, it has removed the economic engine of the product.

**This means:**
- The consumer AI Profile is intentionally bounded — it gives the user enough to be genuinely valuable, never so much that it replaces the practitioner session.
- The `Deferral CTA` connects to the practitioner directory — the product's own practitioners, prioritizing those with the user's energy type in their specialty.
- Features that go to practitioners first (PDF export, composite charts, cluster synthesis, multi-client profiles) stay practitioner-first in perpetuity unless a compelling, specific case is made for the consumer tier.
- Consumer-side growth mechanics must justify themselves through practitioner outcomes: higher referral rate, more directory engagement, more booked sessions, or higher practitioner retention. Raw consumer signups alone are not a success metric during practitioner-first phases.

**Violation looks like:** Making composite charts free-tier features because "users want them." Removing the Deferral CTA because it "interrupts the personal user experience." Building a consumer-facing "practitioner mode" that mimics what the actual Practitioner tier provides.

---

### Principle 9: One Point of Focus, One Click at a Time

**Information is disclosed progressively. The user should know the one most important thing to do on a screen within a few seconds.**

Prime Self is a deep product. Depth is an asset only when the interface stages it correctly. The user should encounter one focal point, one immediate action, and one clear reason to care. Secondary options are grouped and one layer removed. Tertiary options are hidden behind another layer or revealed only after progress.

**This means:**
- The first screen answers one question, not five.
- The default state of any feature is the simplest version that still delivers value.
- Navigation should expose the active journey, not the full feature inventory.
- When depth is needed, reveal it in layers: Quick Start → Technical → Raw.

**Corollary:** If a screen presents three or more equally-prominent next actions, the architecture has failed. Reduce, reorder, or delay disclosure.

**Violation looks like:** A 13-tab mobile interface where every feature competes at once. A chart screen that presents all systems, codes, and tools before the user understands their Pattern and Decision Style. A hero section that leads with system count instead of the one reason to keep reading.

---

### Principle 10: Honest Grounding Is the Product

**Prime Self earns trust through verified calculation, faithful interpretation, transparent attribution, and truthful claims about what is actually built.**

This product sits in a domain where users are already skeptical of vague claims, plagiarized spiritual content, and pseudo-personalization. The advantage is not mystique. The advantage is integrity. If the product cannot honestly explain where a claim came from, what system it belongs to, or whether a feature is actually available, it should not say it.

**This means:**
- Interpretation must be grounded in specific chart data, not generic horoscope copy.
- Frameworks and source systems are attributed in the right places: documentation, onboarding, legal copy, and the knowledge base.
- Marketing and pricing copy may not advertise features that are not fully supportable in the product.
- Canonical replacement terms are used in user-facing copy without pretending the source traditions do not exist.

**Corollary:** Attribution belongs in the correct layer. Layer 1 prioritizes comprehension. Documentation, onboarding, and legal copy provide provenance. We do not overload every UI label with source-history, but we do not erase origins either.

**Violation looks like:** Unattributed source material in the knowledge base. Trademarked language surfacing in user-facing output after the approved vocabulary changed. A pricing page promising an Agency capability the code does not support.

---

## 4. The Four-Question Fitness Test

**Run every backlog item through these four questions before it is accepted into the registry.**
If any question cannot be answered clearly, the item is not ready.

---

**Q1. Which journey does this advance, and at which step?**

Map the item to Journey A (Practitioner) or Journey B (Personal User) and name the specific gate or job it supports. Items that do not advance either journey do not belong in the product.

*If the answer is "it's useful in general" or "users might want it" — reject until the story is clearer.*

---

**Q2. What is the signal that it worked?**

Name a thing the user will do differently — measurably — after this feature exists. Not a feeling. Not a metric we hope goes up. A specific action.

Examples:
- "Users who land on the Profile tab with a chart already calculated will have the birth data pre-filled — the number of users who reach profile generation without abandoning the form will increase."
- "Practitioners will export a PDF within the same session that they generate a synthesis — time from synthesis to delivery drops."

*If the signal is "they'll be happier" or "the UX will feel better" — name the upstream action that better UX enables, or reject.*

---

**Q3. What is the simplest version that delivers the value?**

Name the minimum implementation. Not the full vision — the smallest thing that makes the signal measurable. Build that. Add complexity only after the simple version proves the signal is real.

*If the simplest version requires touching 4 files and 3 backend handlers on the first pass — the scope has drifted. Decompose it.*

---

**Q4. Does it violate any of the Three Non-Negotiables?**

> See Section 5 below.

*If yes — do not build. Raise the conflict with the product council before proceeding.*

---

**Q5. What is the sentence that makes this matter?**

Before an item ships, write the one-sentence explanation the user will actually read or feel. If that sentence cannot clearly say what the thing is, why it matters, and what changes because it exists, the implementation is incomplete even if the code works.

Examples:
- "Your chart is ready. Now generate your AI Profile to see how your Energy Blueprint, Frequency Keys, Astrology, and Numerology fit together in one reading."
- "This assessment improves your next synthesis because it adds your real behavioral patterns, not just birth-chart data."

*If the sentence sounds like internal jargon, product thinking has not been translated into user value yet.*

---

## 5. The Three Non-Negotiables

These are the only true absolutes in the product. Everything else is a principle that can be debated in context. These cannot.

---

### Non-Negotiable 1: The Calculation Is Never Compromised

The engine produces verifiably correct output or it produces nothing. There is no "close enough" in ephemeris math. If a feature requires the engine to produce approximate results, the feature waits until it can be built on top of exact results.

This includes: rounding planetary positions for display speed, caching stale transit data past its validity window, approximating the design-side offset, or using lookup tables that haven't been validated against the AP Test Vector.

---

### Non-Negotiable 2: The AI Never Presents Interpretation as Fact

The synthesis layer is a structured reasoning process over verifiable data. It produces interpretations — patterns, tendencies, resonances. It never produces diagnoses, predictions, or verdicts about a person's life.

Every AI output is presented as a lens, not a mirror. "Your data shows a pattern consistent with X" — not "You are X."

This applies to prompt engineering, UI copy framing how AI output is displayed, and any marketing copy that describes what the AI does.

---

### Non-Negotiable 3: Practitioner Revenue Is Never Cannibalized

Consumer features are bounded by what is useful for personal discovery. Practitioner features are defined by what is necessary for professional delivery. These are not the same, and the gap between them is intentional.

No consumer-tier expansion closes that gap without an explicit product decision that accounts for the commercial impact on practitioner subscribers and the platform's primary revenue model.

---

## 6. Release Gates

**A feature is not shippable because the code exists. It is shippable when product truth, technical truth, and operational truth all agree.**

A change is ready to ship only when all of the following are true:

1. It maps cleanly to Journey A or Journey B in Section 2.
2. It satisfies the relevant Design Principles in Section 3.
3. It does not violate any Non-Negotiable in Section 5.
4. It passes the Fitness Test in Section 4.
5. The contracts that matter are asserted, not merely logged.
6. Failure states are user-safe, observable, and actionable.
7. Any deferred work is explicitly named with a blocker, not hand-waved as "later."

**Operational rules:**
- A passing check that tolerates drift is a defect, not evidence.
- Printing output is not verification; assertions are verification.
- Graceful degradation is only acceptable when it emits a structured, queryable signal.
- Missing tooling for tests or coverage means the gate is broken, not optional.

**Corollary:** "Mostly working" is not a release state for practitioner-critical workflows. A feature used in billing, session prep, client delivery, auth, or profile generation must either meet the gate or stay out of the release.

---

## 7. How to Use This Document

### For the build loop (Haiku agent or human implementer):

Before implementing any item from the issue registry:

1. Read the item's `fix` field carefully.
2. Locate it in Journey A or Journey B (Section 2). If it doesn't fit either journey, flag it before implementing.
3. Confirm the fix respects the relevant Design Principle(s). Each issue in the registry maps to one or more principles — check for conflicts.
4. Confirm the fix does not touch the calculation engine without explicit approval and AP test vector re-verification.
5. When the fix involves UI copy or AI prompts, apply Principle 3 (Plain Language First) and Principle 10 (Honest Grounding) together.
6. Before closing the work, write the "why it matters" sentence from Q5 and verify the UI actually communicates it.

### For backlog additions (product council or audit agent):

1. Run the Four-Question Fitness Test (Section 4) before writing the registry entry.
2. Map the item to a Journey and Gate in Section 2. Include this in the registry `context` field.
3. If the item is a trademark/IP fix, it is automatically P0 — no fitness test required, but the fix must respect Principle 6 (canonical vocabulary source) and Principle 10 (Honest Grounding).
4. If the item touches the AI output or prompt layer, note which Non-Negotiable applies in the `fix` field.

### For architecture decisions (technical design):

1. Principle 1 (Calculation Before Everything) governs all engine changes.
2. Principle 6 (One Truth, One Source) governs all data model and knowledge base changes.
3. Principle 5 (Appropriate Authority) governs all AI prompt, grounding, and output framing decisions.
4. Principle 8 (Practitioner Commercial Integrity) governs all tier access and feature gate decisions.
5. Principle 9 (One Point of Focus) governs navigation, IA, and progressive disclosure decisions.
6. Principle 10 (Honest Grounding) governs source attribution, legal copy, and product claims.


---

## 8. Approved Vocabulary (Canonical Brand Terms)

These are the only terms used in user-facing copy, UI labels, AI prompts, and code-level display strings. System-internal variable names may use legacy terms where changing them would risk data integrity, but no term below may appear verbatim in any content a user or practitioner reads.

| ❌ Do Not Use | ✅ Use Instead | Context |
|--------------|----------------|---------|
| Human Design | Energy Blueprint | All user-facing contexts |
| Gene Keys | Frequency Keys | All user-facing contexts |
| Siddhi | Mastery | Display labels, AI output |
| Shadow | Shadow Pattern | Display labels (Shadow alone is acceptable in The Library context) |
| Bodygraph | Energy Chart | All user-facing contexts |
| Incarnation Cross | Life Purpose Vector / Soul Cross | Display labels |
| Generator | Builder Pattern | Directory, profile, UI labels |
| Manifesting Generator | Builder-Initiator Pattern | Directory, profile, UI labels |
| Projector | Guide Pattern | Directory, profile, UI labels |
| Manifestor | Catalyst Pattern | Directory, profile, UI labels |
| Reflector | Mirror Pattern | Directory, profile, UI labels |
| Sacral Authority | Life Force Response | Check-in, profile display |
| Splenic Authority | Intuitive Knowing | Check-in, profile display |
| Ego / Heart Authority | Willpower Alignment | Check-in, profile display |
| Self-Projected Authority | Voiced Truth | Check-in, profile display |
| Emotional Authority | Emotional Wave Navigation | Check-in, profile display |
| Not-Self Theme | Not-Self Signal | User-facing explanations |
| Split Definition | Bridging Pattern | Chart result display |

**Rule:** When in doubt, use the approved term plus a parenthetical on first use. "Your Bridging Pattern (what Energy Blueprint calls Split Definition) means..."

**Exception for DB and code:** The `value=""` attributes in HTML form elements, database columns, and internal API field names are NOT changed unless a full migration is planned. Only the visible label text changes. This prevents breaking stored data.

---

## 9. Common Anti-Patterns

These patterns have already hurt the product. If one starts to appear again, stop and correct course before adding more code.

### Anti-Pattern 1: The Feature Factory

Adding work because it sounds useful, trendy, or requested in isolation without mapping it to a journey or measurable job.

**Result:** The product becomes a junk drawer. Navigation expands, copy fragments, and the core promise weakens.

### Anti-Pattern 2: Copy Silos

Homepage, pricing, onboarding, privacy, and in-app copy each describe a slightly different product.

**Result:** Users understand fragments but not the whole. Trust drops because the product sounds like three companies wearing one skin.

### Anti-Pattern 3: The False Upgrade

Advertising capability, transformation, or entitlement that the product does not fully support.

**Result:** Commercial trust is destroyed faster than any UX improvement can rebuild it.

### Anti-Pattern 4: Deferred Clarity

Shipping something technically functional while postponing the sentence that explains why it matters, where it belongs, or what the next step is.

**Result:** Users see output but cannot orient themselves. The feature exists in code and fails in reality.

### Anti-Pattern 5: Parallel Truths

Allowing multiple definitions of tiers, vocabulary, prompts, or design tokens to coexist because "we'll clean it up later."

**Result:** Silent breakage, documentation drift, and repair cycles that cost more than the original shortcut saved.

---

## 10. The Product Hierarchy

When principles conflict — and they will — here is the hierarchy:

```
1. Calculation integrity (Non-Negotiable 1)
2. The AI does not mislead (Non-Negotiable 2)
3. Practitioner commercial integrity (Non-Negotiable 3)
4. Honest grounding (Principle 10)
5. Plain language over depth (Principle 3)
6. Synthesis over information (Principle 2)
7. Earn the next step (Principle 4)
8. One truth, one source (Principle 6)
9. No feature without a story (Principle 7)
10. Session-first for practitioners (Principle 8 extended)
11. Appropriate authority at each layer (Principle 5)
12. Progressive disclosure and focus (Principle 9)
```

Lower items yield to higher items. A feature that creates extraordinary synthesis value (item 5) but requires misleading AI framing (item 2) is rejected until the framing is corrected. A UX improvement that earns the next step (item 6) but introduces a second definition of a canonical term (item 7) is rejected until the vocabulary conflict is resolved.

**Example arbitrations:**
- If a new synthesis layer deepens interpretation but delays chart calculation materially, item 1 wins. The synthesis must become asynchronous or optional.
- If a tooltip preserves system fidelity but fails the dinner party test, item 5 wins over item 11. Rewrite it in plain language first, then expose the technical wording one layer deeper.
- If a consumer feature improves standalone engagement but weakens practitioner differentiation, item 3 wins. Re-scope the feature around practitioner lead-gen or keep it tier-gated.

---

*"The technology exists to serve the philosophy. The philosophy exists to serve the person."*

*— Prime Self, Architecture.md opening principle, restated here as product truth.*
