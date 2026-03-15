# Prime Self — Master Implementation Plan v4 (Final)
**Date:** March 12, 2026 | **Status:** Approved — Building

> Historical implementation snapshot. This plan predates the current practitioner-first pricing and packaging model.
> Current commercial truth lives in `workers/src/lib/stripe.js`, `docs/PRACTITIONER_FIRST_90_DAY_ROADMAP.md`, and `audits/TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md`.

---

## Vision

The Library is now one complete octave: Foundational Volume + 6 Overtones (Polarity through Heptad). The platform mirrors this — a living developmental system organized around a 4D matrix (Quaternity) with a 7-phase Heptadic growth path (6 active + 1 integration). Three signature visualizations serve as shareable identity artifacts. The synthesis engine uses deterministic Forge scoring, reconciled Knowledge systems, and existing-but-unused knowledge base libraries to achieve a 25-35% quality improvement before a single new feature is built.

Four tiers: Free / Explorer $12 / Guide $60 / Studio $149.

---

## CRITICAL REASSESSMENT — What Changed from v3

### 1. The Library Is Complete (Hexad + Heptad ingested)
- **Hexad** (5th Overtone): community architecture, complementary roles, 6-line gate structure confirmed as Hexadic, relational web diagnosis, crystallization assessment
- **Heptad** (6th Overtone): completed cycle, leading tone → resolution, 7 chakras = 7 centers, 7-year deconditioning, sabbatical principle (6:1), modal awareness, spiral memory
- **Impact**: Growth Path changes from 5 Pentadic phases to 7 Heptadic phases (6 active + 1 integration). The synthesis gains cycle recognition, leading-tone identification, and sabbatical intelligence.

### 2. Synthesis System Has Massive Low-Hanging Fruit
Audit found:
- TWO competing Forge naming systems (synthesis.js vs forges.json) — reconcile
- TWO competing Knowledge systems (hard-coded vs knowledges.json) — reconcile
- forge_mapping.json has a DETERMINISTIC scoring algorithm that isn't used (LLM guesses)
- historical_figures.json (25+ exemplars), book_recommendations.json (100+ books), savannah_narrative.json (22 chapters) — all built, barely used
- Psychometric data collected but not correlated with Gene Keys
- Token budget only 4096 — too tight for Opus
- **Estimated quality improvement from integration alone: 25-35%, ~3 hours work**

### 3. Frontend Is a Cracked Foundation
- 14 global IIFE files, no module system, no build step, no minification
- No frontend tests, no CI testing in GitHub Actions
- No error tracking (Sentry), no staging environment
- Worker bundle 2.27 MB (requires paid Cloudflare plan)
- State management is scattered globals (pre-2015 architecture)
- **Solution: weave infrastructure through feature phases, hard gate before Phase 6**

### 4. Share-as-Image Is THE Growth Mechanic and It's Broken
- Current share generates data:// SVG URLs — not HTTP-accessible
- OG meta tags can't render these — social previews are blank
- Moved to Phase 3F (earlier than v3's Phase 4)

### 5. Studio Tier Revived ($149/mo)
- API key infrastructure already built (CRUD, hashing, rate limiting, usage tracking)
- white_label tier half-removed (stripped from config but wired in webhooks, embed, practitioner)
- Revival is less work than building an add-on purchase flow

---

## PHASE 0 — FOUNDATION (Blockers + Infrastructure Minimum)

### 0A. Production P0-P1 Bugs (9 open)
- PROD-P0-001: Chart retrieval crash (GET /api/chart/:id → 500)
- PROD-P0-002: Password reset user enumeration CVE (migration 021)
- PROD-P1-004 through P1-009: Profile list, checkin, referral, leaderboard, tier gate, auth slash
Files: workers/src/handlers/ (multiple), workers/src/middleware/

### 0B. Payment Webhook Gaps
- Add charge.refunded handler → downgrade tier
- Add charge.dispute.created handler → flag account
- Fix getActiveSubscription() to include trialing + past_due
- Ghost subscription detection
Files: workers/src/handlers/webhook.js, workers/src/lib/stripe.js

### 0C. Security
- Move refresh token from localStorage to HttpOnly cookie only
- Tier-gate cluster synthesis endpoint
- Remove "Human Design" trademark from 20+ user-facing locations
Files: frontend/js/auth.js, workers/src/handlers/cluster.js, frontend/

### 0D. Pricing + Tier Reconciliation ✅ IMPLEMENTED
- Canonical pricing: Free / $12 Explorer / $60 Guide / $149 Studio
- Revive white_label tier in getTierConfig() as "Studio"
- Add daily ceilings to tierEnforcement.js
- Reconcile MONETIZATION_PLAN_2026.md
Files: workers/src/lib/stripe.js, workers/src/middleware/tierEnforcement.js

### 0E. CI/CD Minimum ✅ IMPLEMENTED
- Add `npm test` step to GitHub Actions workflow before deploy
- Add staging branch → Cloudflare Pages preview environment
Files: .github/workflows/deploy-frontend.yml

**Tier Table (Final):**

| | Free | Explorer $12 | Guide $60 | Studio $149 |
|---|---|---|---|---|
| Syntheses/month | 1 | 30 | 200 | 1,000 |
| AI questions/month | 5 | 30 | 200 | 1,000 |
| Daily synth ceiling | 1 | 10 | 20 | 50 |
| Daily question ceiling | 5 | 15 | 50 | 100 |
| API calls/month | 0 | 0 | 0 | 10,000 |
| Saved profiles | 0 | 20 | ∞ | ∞ |
| Client management | — | — | ✅ | ✅ |
| White-label embed | — | — | — | ✅ |
| Composites | — | ✅ | ✅ | ✅ |
| Practitioner dash | — | — | ✅ | ✅ |
| Clusters | — | — | ✅ | ✅ |
| Custom webhooks | — | — | — | ✅ |
| API key access | — | — | — | ✅ |

---

## PHASE 1 — SYNTHESIS QUALITY (Highest ROI, no new features) ✅ IMPLEMENTED

### 1A. Reconcile Forge Systems ✅
- Use forge_mapping.json's deterministic scoring algorithm to PRE-COMPUTE user's Forge
- Inject as fact in buildReferenceFacts ("Forge: Transformation (deterministic, confidence: 0.87)")
- Stop relying on LLM inference for Forge identity
- Reconcile naming: Initiation/Mastery/Guidance/Perception/Transformation are canonical (Chronos/Eros/Aether/Lux/Phoenix are poetic aliases used in narrative tone)
Files: src/prompts/synthesis.js, src/knowledgebase/prime_self/forge_mapping.json

### 1B. Reconcile Knowledge Systems ✅
- Replace hard-coded SIX_KNOWLEDGES with knowledges.json (Sciences/Arts/Defenses/Heresies/Connections/Mysteries) with HD circuit mappings, astro mappings, practical domains
- Deterministically derive primary Knowledge from user's defined circuits + gates
- Inject Knowledge focus with practical domains into Reference Facts
Files: src/prompts/synthesis.js, src/knowledgebase/prime_self/knowledges.json

### 1C. Inject Existing Knowledge Base ✅
- historical_figures.json: use computed Forge → pull matching exemplars with primeGift + keyLesson
- book_recommendations.json: use Knowledge focus + user's current life need → pull targeted recommendations
- savannah_narrative.json: for user's Forge, embed the matching Savannah arc chapter summary
Files: src/prompts/synthesis.js, src/knowledgebase/prime_self/*.json

### 1D. Split workingWithOthers → relationshipStyle + groupDynamics
Files: src/prompts/synthesis.js, frontend/js/app.js

### 1E. Add convergenceInsights to output schema + toggle UI
Files: src/prompts/synthesis.js, frontend/js/app.js, frontend/css/app.css

### 1F. Increase Token Budget + Add Retry Logic ✅
- Increase max_tokens from 4096 to 6000 for Opus
- Add 2-retry logic to callAnthropic() before failover to Grok
Files: src/prompts/synthesis.js, workers/src/lib/llm.js

### 1G. Correlate Psychometric Data in Prompt
Files: src/prompts/synthesis.js

---

## PHASE 2 — LIBRARY META-LAYER + MATRIX (The Differentiator)

### 2A. Derive 4D Matrix Coordinates in buildReferenceFacts
- Axis 1 — Elemental Function: HD Type → Fire/Earth/Air/Water (Quaternity)
- Axis 2 — Knowledge Domain: circuit gates → Sciences/Arts/Defenses/Heresies/Connections/Mysteries
- Axis 3 — Directional Season: profile line + Personal Year + Dasha → East/South/West/North
- Axis 4 — Relational Field: definition type + open centers → Broadcaster/Amplifier/Bridger
- Center: Forge (deterministic from 1A)
Files: src/prompts/synthesis.js

### 2B. Library Framing in SYSTEM_PROMPT (~200 words)
- Organize synthesis around Elemental function, Knowledge domain, Season, Relational Field
- Include leading-tone identification: "What is at maximum tension and pointing toward resolution?"
- Include sabbatical intelligence: "When transits suggest rest, say so explicitly."
Files: src/prompts/synthesis.js

### 2C. Cycle Recognition (Heptad methodology)
- Derive user's current Heptadic position: Do/Re/Mi/Fa/Sol/La/Ti
- Derived from transits + personal year + deconditioning position
Files: src/prompts/synthesis.js

### 2D. Matrix Compass Glyph (Visualization #1)
- SVG diamond/mandala, 4 axes from center Forge icon
- Incomplete axes: opacity 0.25 (collection mechanic)
- Entry animation: stroke-dasharray draw 1.5s, staggered
Files: frontend/js/matrix-compass.js (new), frontend/css/app.css

---

## PHASE 3 — GROWTH PATH (7 Heptadic Phases)

### 3A. Chronotype Quiz at Onboarding (Phase 1: Do — Arrival)
### 3B. Self Assessment UI (Phase 2: Re — First Movement)
### 3C. Growth Phase Engine (7 Heptadic phases with Fibonacci timing)
### 3D. Growth Spiral (Visualization #2 — 7-node Heptadic SVG)
### 3E. Re-Synthesis Trigger
### 3F. Share-as-Image (MOVED HERE — too important for Phase 4)

---

## PHASE 4 — TRUST + FEEDBACK (Growth Engine)

### 4A. "How We Calculate" Transparency Page
### 4B. Synthesis Feedback System
### 4C. Spiral Memory (Heptad concept)

---

## PHASE 5 — FULL QUIZ STACK (Content Expansion)

### 5A. Database Migration (chronotype, hsp_score, attachment, schwartz, love_languages)
### 5B. Quiz UI Components (one file per quiz)
### 5C. buildReferenceFacts Updates Per Quiz

---

## PHASE 6 — COMMUNITY + CONVERGENCE (Hexadic Features)

⚠️ GATE: Phase 7A-7B must begin before Phase 6 starts

### 6A. Convergence Web Inline (Visualization #3)
### 6B. Convergence Web Radial (Power User View)
### 6C. Composite Relationship Analysis (Hexadic)
### 6D. Wire Existing Backend Features (Famous Matches, Achievements, Electional Timing)
### 6E. Cluster Enhancement (Hexadic)

---

## PHASE 7 — INFRASTRUCTURE (Hard deadline: before Phase 6)

### 7A. Vite Build Pipeline
### 7B. Frontend Modularization (IIFEs → ES modules)
### 7C. Error Tracking (Sentry)
### 7D. Frontend Testing (Vitest + jsdom)
### 7E. Worker Bundle Optimization (<1.5 MB target)

---

## IMPLEMENTATION ORDER + DEPENDENCIES

```
Phase 0 (FOUNDATION — all parallel, do first):
  0A: Fix 9 P0-P1 bugs          │ parallel
  0B: Payment webhook gaps        │ parallel
  0C: Security fixes              │ parallel
  0D: Pricing + Studio tier       │ parallel ✅
  0E: CI/CD minimum               │ parallel ✅

Phase 1 (SYNTHESIS QUALITY — highest ROI):
  1A: Reconcile Forges            │ no deps ✅
  1B: Reconcile Knowledges        │ no deps ✅
  1C: Inject KB JSONs             │ depends on 1A, 1B ✅
  1D: Split workingWithOthers     │ no deps
  1E: Convergence insights        │ depends on 1D
  1F: Token budget + retry        │ no deps ✅
  1G: Correlate psychometric      │ no deps
  ⟶ A/B TEST: 10 profiles old vs new, blind rate

Phase 2 (LIBRARY META-LAYER):
  2A: 4D matrix derivation        │ depends on 1A, 1B
  2B: Library framing SYSTEM_PROMPT │ depends on 2A
  2C: Cycle recognition           │ depends on 2B
  2D: Compass glyph UI            │ depends on 2A (parallel with 2B-C)

Phase 3 (GROWTH PATH — 7 Heptadic phases):
  3A: Chronotype quiz             │ no deps
  3B: Self Assessment UI          │ no deps
  3C: Growth engine               │ depends on 2A
  3D: Growth Spiral viz           │ depends on 3C
  3E: Re-synthesis trigger        │ depends on 3A or 3B
  3F: Share-as-image              │ depends on 2D

Phase 4 (TRUST + FEEDBACK):
  4A: Methodology page            │ no deps
  4B: Feedback system             │ no deps
  4C: Spiral memory               │ depends on 3E + re-syntheses

Phase 5 (FULL QUIZ STACK):
  5A: DB migration                │ no deps
  5B: Quiz UIs                    │ depends on 5A
  5C: buildReferenceFacts updates │ depends on 5B

Phase 6 (COMMUNITY + CONVERGENCE):
  ⚠️ GATE: Phase 7A-7B must begin before Phase 6 starts
  6A-6E: Convergence features     │ depends on infrastructure gate

Phase 7 (INFRASTRUCTURE — weave through, hard deadline before Phase 6):
  7A: Vite build pipeline         │ no deps
  7B: Frontend modularization     │ depends on 7A
  7C: Error tracking              │ no deps
  7D: Frontend testing            │ depends on 7B
  7E: Worker optimization         │ no deps
```

---

## WORLD'S GREATEST ENGINEER PRINCIPLES

1. **Phase 1 before anything else.** The synthesis IS the product.
2. **Measure before and after.** A/B test 10 profiles old vs new, blind rate.
3. **Share-as-image ASAP.** Dead share links = dead growth loop.
4. **Don't ship Phase 6 on a monolith.** Infrastructure gate is non-negotiable.
5. **The 7th growth phase is genius.** Sabbatical Heptad = emotionally resonant.
6. **Studio tier prints money.** 90% API calls are chart calcs (no LLM cost).
7. **Deterministic before generative.** Compute facts, let LLM do narrative.
