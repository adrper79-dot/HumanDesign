# Prime Self — Future State Kanban

**Created:** 2026-03-09  
**Purpose:** Track canonical philosophy features that have DATA created but need INTEGRATION  
**Reference:** Sacred Texts alignment session — several "nuggets" were documented but not fully wired up

---

### KANBAN-008 | Enhanced At-A-Glance Dashboard Cards
**Priority:** MEDIUM  
**Type:** Feature Enhancement  
**Status:** NOT STARTED — Requires design review  

**What was planned:**
During 2026-03-09 UX overhaul session, tab intro cards were added but kept minimal (1-2 sentences). The original vision included richer at-a-glance cards with contextual data:

**Missing components:**
- ❌ **Today tab:** Mini transits summary — show 2-3 most impactful transits with gate activation count
- ❌ **Connect tab:** Active relationship insights — if composite exists, show last generated date + key insight snippet
- ❌ **Grow tab:** Recommended practices — suggest 1-2 priority actions (from assessments or latest check-in)

**Why it matters:**
- Users scan tabs before clicking into them
- Reduces CTA friction by showing relevance upfront
- Increases engagement with underused tabs

**Proposed card structure:**
```html
<div class="tab-card-enhanced">
  <div class="card-header">
    <h4>{{ title }}</h4>
    <time>{{ date }}</time>
  </div>
  <div class="card-stat">{{ primary_datum }}</div>
  <p class="card-insight">{{ actionable_snippet }}</p>
  <a class="card-cta">See full details →</a>
</div>
```

**Example output:**
```
Today's Energy
Updated 16 min ago

3 gates activated
Mars in Pisces hitting gate 39 (challenge), Saturn return window active

See full transits →
```

---

### KANBAN-009 | Onboarding Path Branching
**Priority:** MEDIUM  
**Type:** Feature Enhancement  
**Status:** NOT STARTED — Modal exists but is linear  

**What was done:**
- ✅ First-run 3-step modal implemented (Welcome → What You'll Unlock → Ready)

**What's missing:**
- ❌ No branching logic for different user personas:
  - **Returning user (has chart, no profile):** Skip welcome, show "Next: Create your profile synthesis"
  - **Experienced user (mentions familiarity):** Skip explanation, jump to advanced options
  - **Mobile user:** Simplified 2-step mobile version
  - **Free user:** Mention upgrade path after 1st profile
- ❌ No conditional CTAs based on user state
- ❌ No detection of whether user is on mobile (affects complexity level)

**Why it matters:**
- Experienced users abandon linear onboarding  
- Mobile users need 60% less content than desktop
- Conversion optimization requires matching onboarding to user readiness level

**Proposed branching:**
```
[No birth data] → frmShowOnboarding()
  ├─ [First time ever] → 3-step welcome flow
  ├─ [Has prev. chart] → Skip welcome, go to profile step
  └─ [Mobile] → Compress to 2 steps

[Has birth data] → skipOnboarding()
  └─ Land on Home dashboard
```

---

### KANBAN-010 | Mobile-First CTA Persistence
**Priority:** MEDIUM  
**Type:** Mobile Optimization  
**Status:** NOT STARTED  

**What was planned:**
During nav restructure, mobile nav was created but primary "Generate Chart" CTA lacks persistence while scrolling.

**Issue:**
- User scrolls through info on My Chart tab
- CTA disappears above fold
- User must scroll back up to generate, friction increases

**Solution:**
- Add sticky/floating CTA for chart generation on mobile only
- Follows Material Design: 56px FAB (floating action button)
- Visible when form is not in viewport, hidden when focused
- Similar to: Stripe, Airbnb mobile experiences

**Implementation:**
```css
@media (max-width: 768px) {
  .sticky-chart-cta {
    position: sticky;
    bottom: 84px; /* Above mobile nav (60px) + padding */
    z-index: 80;
    width: 100%;
    padding: 8px;
    box-shadow: 0 -2px 8px rgba(0,0,0,0.15);
  }
}
```

---

### KANBAN-011 | Enhanced Transits Digest & Daily Practices
**Priority:** MEDIUM  
**Type:** Feature Gap  
**Status:** NOT STARTED  

**What was planned:**
Tab intro cards mention "Daily Transits" and "Recommended Practices" but no integration exists.

**What exists:**
- ✅ Transits calculated server-side (in `handleTransits()`)
- ✅ Check-In sub-tab exists for mood tracking
- ✅ SMS Alerts implemented (via AWS SNS)

**What's missing:**
- ❌ **Daily Digest:** Email or in-app notification with today's top 3 transits
- ❌ **Suggested Practices:** Based on user's Forge + current transits, suggest 1-2 daily practices (Forge Arts/Sciences/Defenses)
- ❌ **Integration with Diary:** Connect mood check-ins to transits for pattern detection
- ❌ **Streak tracking:** Show user "Days of consistent practice" (Grow tab motivation)

**Why it matters:**
- Users want actionable guidance (per Reddit UX research)
- Transits are calculated but not surfaced daily
- Personalization increases retention by 3-5x per product analytics

**Mockup:**
```
Daily Practices for [Name]
Based on Transits + [Forge] Energy

📍 Top Transits Today:
   • Moon in Aquarius (Gate 39) — challenge, vulnerability
   • Mars in Pisces waning — wind down intensity

⭐ Recommended for Chronos Forge:
   1. Movement: 15min walking meditation (grounding)
   2. Science: Read about historical cycles (Saturn ref.)

✓ Your 23-day consistency streak
```

---

### KANBAN-012 | Composite Relationship Quick-Compare
**Priority:** MEDIUM  
**Type:** Feature Gap  
**Status:** NOT STARTED  

**What was planned:**
Connect tab (Composite) exists but requires manual entry of partner's birth data every time.

**What's missing:**
- ❌ **"Compare with..."** quick-select interface
  - Show recently-compared charts  
  - Search saved charts in same account
  - One-click compare (if user has multiple profiles)
- ❌ **Suggested comparisons** based on profile context
  - If user mentions: "partner", "colleague", "family" during assessment
  - Prompt to add their birth data for automatic composite
- ❌ **Compare mode persistence** across tabs
  - User generates composite, switches to Today tab → still shows transits for the **pair** not individual
  - Reset button to return to personal view

**Why it matters:**
- Friction in entering data 2x for every composite reduces usage by 60%+
- Users with partners are more engaged (stickier cohort)
- Suggested comparisons surface the feature to unaware users

---

### KANBAN-013 | Background Video Mobile Optimization
**Priority:** MEDIUM  
**Type:** Performance / Mobile  
**Status:** NOT STARTED  

**What was planned:**
Background video exists but loads regardless of device connection speed/bandwidth.

**What's missing:**
- ❌ **Conditional loading** based on `navigator.connection.effectiveType`
- ❌ **Fallback:** Gradient animation on slow connections (≤3G)
- ❌ **Battery-aware:** Disable on low power mode (via `navigator.getBattery()`)
- ❌ **Data saver mode:** Detect and skip video on data-saver networks

**Why it matters:**
- 30% of users on mobile have slow connections  
- Video kills battery on mobile
- Graceful fallback prevents CLS (Cumulative Layout Shift) failures  
- Improves Core Web Vitals score

**Implementation:**
```javascript
// In DOMContentLoaded or before video init
if (navigator.connection?.effectiveType === '4g') {
  loadBackgroundVideo(); // ~2MB
} else if (navigator.connection?.effectiveType === '3g') {
  loadGradientAnimation(); // 0KB, smooth fallback
} else {
  skipVideo();
}
```

---

### KANBAN-014 | Practitioner Client Dashboard (Pending Architecture)
**Priority:** HIGH (blocked by product decision)  
**Type:** Feature Roadmap  
**Status:** BLOCKED — Waiting for $500 tier resurrection  

**What was planned:**
White-label practitioner features were removed from $500/mo tier, blocking implementation.

**What's needed:**
- ❌ **Client list view** — Shows all clients + their chart status
- ❌ **Compare clients** — See patterns across multiple clients (anonymized)
- ❌ **Annotate profiles** — Add practitioner notes to client profiles (private)
- ❌ **Export for session** — Generate client-specific PDF for in-person session
- ❌ **Client invite links** — Generate shareable links for clients to add their birth data
- ❌ **API for white-label** — Embed Prime Self into practitioner's own platform

**Blockers:**
- Pricing tier was removed (UI-026 in backlog) pending feature implementation timeline  
- Product decision needed: Should this tier return in 2026-Q2?
- UX unknown: What's the minimum practitioner can do to be valuable?

**If approved, effort estimate:** 15-20 days (new DB schema + API endpoints + UI)

---

### KANBAN-015 | Smart Recommendations Feed
**Priority:** LOW  
**Type:** Feature Enhancement  
**Status:** NOT STARTED  

**What was planned:**
During session planning, discussion of "contextual recommendations" for next steps.

**What's missing:**
- ❌ **Personalized feed** based on user state:
  - New user → "Complete your profile synthesis"
  - Has profile, no diary → "Start tracking daily energy"
  - Active diarist → "Share your chart with a friend"
  - Not upgraded → "Unlock historical exemplar guidance"
- ❌ **Smart "next step" detection**
  - Check: Has user completed each feature? (chart, profile, diary, composite)
  - Suggest the next highest-value action based on research
  - Show incentives (e.g., "48% of users find their partner's chart more useful")

**Why it matters:**
- Users don't know the optimal learning path
- Friction between features (chart → profile → composite → diary) causes drop-off
- Personalized nudges increase engagement by 20-40%

---

## 🔴 BLOCKED / NOT STARTED



### KANBAN-001 | Priming Recommendations UI Rendering
**Priority:** HIGH  
**Type:** Feature Gap  
**Status:** Schema exists, data exists, UI missing  

**What was done:**
- ✅ Schema added to `synthesis.js` → `primingRecommendations` object
- ✅ Historical figures data in `src/knowledgebase/prime_self/historical_figures.json` (25+ figures)
- ✅ Book recommendations data in `src/knowledgebase/prime_self/book_recommendations.json` (60+ books)

**What's missing:**
- ❌ Frontend rendering of `primingRecommendations` section in profile output
- ❌ UI card for "Historical Exemplar" with:
  - `name`, `relevance`, `keyLesson`, `invocationContext`
- ❌ UI for "Alternate Exemplars" (2-3 backup figures)
- ❌ UI for "Book Recommendations" with fiction + non-fiction
- ❌ UI for "Current Knowledge Focus" (which of Six Knowledges to prioritize)

**Files to modify:**
- `frontend/index.html` — Add rendering in `renderProfile()` function around line 2370

**Mockup:**
```
┌─────────────────────────────────────────────────────────┐
│ 📚 Your Priming Guide                                   │
├─────────────────────────────────────────────────────────┤
│ HISTORICAL EXEMPLAR                                     │
│ Marie Curie (1867-1934)                                 │
│ "Generator persistence in the face of obstacles..."     │
│                                                         │
│ Key Lesson: Trust your sustained response even when     │
│ the world doesn't recognize your work yet.              │
│                                                         │
│ When to invoke: When facing long-term projects that     │
│ require patience and endurance.                         │
├─────────────────────────────────────────────────────────┤
│ ALSO CONSIDER: Carl Jung, Albert Einstein               │
├─────────────────────────────────────────────────────────┤
│ READING RECOMMENDATIONS                                 │
│ 📖 Fiction: "Siddhartha" by Hermann Hesse               │
│    → The path of patient response and surrender         │
│                                                         │
│ 📘 Non-Fiction: "Deep Work" by Cal Newport              │
│    → Sustained focus and Generator energy management    │
├─────────────────────────────────────────────────────────┤
│ CURRENT FOCUS: Knowledge of Self                        │
│ → Right now, prioritize understanding your own design   │
└─────────────────────────────────────────────────────────┘
```

---

### KANBAN-002 | Forge Weapon/Defense/Shadow UI Rendering
**Priority:** HIGH  
**Type:** Feature Gap  
**Status:** Schema exists, data exists, UI incomplete  

**What was done:**
- ✅ Schema added to `synthesis.js` → `forgeIdentification.forgeWeapon`, `forgeDefense`, `shadowWarning`
- ✅ Forge data with weapons/defenses in `src/prompts/synthesis.js` FORGE_MAPPING
- ✅ Forge canonical data in `src/knowledgebase/prime_self/forges_canonical.json`

**What's missing:**
- ❌ UI rendering of `forgeWeapon` field
- ❌ UI rendering of `forgeDefense` field  
- ❌ UI rendering of `shadowWarning` field
- Current UI only shows: primaryForge, confidence, indicators

**Files to modify:**
- `frontend/index.html` — Extend Forge Identification card (line ~2357)

**Expected output enhancement:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔥 Forge Identification                                 │
├─────────────────────────────────────────────────────────┤
│ ✦ Chronos Forge [high confidence]                       │
│                                                         │
│ YOUR WEAPON: Patience — the ability to outlast any     │
│ obstacle through strategic endurance                    │
│                                                         │
│ YOUR DEFENSE: Historical Memory — learning from the    │
│ collective past to avoid repetition of mistakes         │
│                                                         │
│ ⚠️ SHADOW WARNING: The Anachronist — being paralyzed   │
│ by reverence for the past or fear of the future        │
├─────────────────────────────────────────────────────────┤
│ INDICATORS                                              │
│ • HD: Defined Ajna, Gates 61, 63, 64                   │
│ • Astro: Saturn dominant, strong Capricorn             │
└─────────────────────────────────────────────────────────┘
```

---

### KANBAN-003 | Six Knowledges Surfacing
**Priority:** MEDIUM  
**Type:** Feature Gap  
**Status:** Data complete, not surfaced  

**What was done:**
- ✅ Complete data in `src/knowledgebase/prime_self/knowledges_canonical.json`
- ✅ Six Knowledges documented:
  1. Knowledge of Self
  2. Knowledge of Ancestors  
  3. Knowledge of The One
  4. Constructive Knowledge
  5. Destructive Knowledge
  6. Knowledge of Healing

**What's missing:**
- ❌ Educational content in profile explaining what the Six Knowledges are
- ❌ UI section showing user's current Knowledge focus
- ❌ Progress/journey tracker for Knowledge exploration
- ❌ Actionable guidance for each Knowledge

**Note:** `primingRecommendations.currentKnowledgeFocus` addresses this partially, but a dedicated section could expand on WHY this knowledge and HOW to pursue it.

---

### KANBAN-004 | Six Heresies Integration
**Priority:** LOW  
**Type:** Feature Gap — Advanced/Dark Mode  
**Status:** Data complete, not surfaced  

**What was done:**
- ✅ Complete data in `src/knowledgebase/prime_self/heresies_canonical.json`
- ✅ Six Heresies documented (shadow powers):
  1. Chrono-Heresy (Dark Time manipulation)
  2. Ero-Heresy (Dark Passion)
  3. Aether-Heresy (Dark Connection)
  4. Lux-Heresy (Dark Illumination)
  5. Phoenix-Heresy (Dark Transformation)
  6. Meta-Heresy (Philosophical corruption)

**What's missing:**
- ❌ No UI or profile section for Heresies
- ❌ No "shadow work" feature that explores the user's potential dark paths
- ❌ Could be premium/advanced feature for users wanting deeper shadow exploration

**Note:** This is intentionally lower priority — may be more appropriate as a future "Shadow Work" module for mature users.

---

### KANBAN-005 | Six Arts / Six Sciences / Six Defenses Deep Integration
**Priority:** LOW  
**Type:** Feature Enhancement  
**Status:** Data complete, minimal integration  

**What was done:**
- ✅ Complete data files:
  - `src/knowledgebase/prime_self/arts_canonical.json` (Aromatherapy, Music, Movement, Visualization, Crystals, Ritual)
  - `src/knowledgebase/prime_self/sciences_canonical.json` (Astronomy, Physics, Chemistry, Biology, Psychology, Philosophy)
  - `src/knowledgebase/prime_self/defenses_canonical.json` (Physical, Mental, Emotional, Spiritual, Social, Environmental)

**What's missing:**
- ❌ No rendering of personalized art/science/defense recommendations
- ❌ No "daily practice" suggestions based on user's design
- ❌ No integration with transits (e.g., "Moon in Pisces — today try aromatherapy with frankincense")

**Future vision:** A "Daily Practice" dashboard that suggests Forge-appropriate arts, sciences, and defenses based on current transits and user progress.

---

## � CONFIRMED GAPS

### KANBAN-006 | RAG Context Missing Canonical Data (VERIFIED)
**Priority:** HIGH ⬆️ (upgraded from MEDIUM)  
**Type:** Backend Bug  
**Status:** CONFIRMED missing — verified 2026-03-09

**Verified Missing:**
- ❌ `historical_figures.json` NOT loaded into RAG context
- ❌ `book_recommendations.json` NOT loaded into RAG context
- ❌ `forges_canonical.json` NOT loaded (uses old `forge_mapping.json`)
- ❌ `knowledges_canonical.json` NOT loaded
- ❌ Other canonical files NOT loaded

**Impact:** The AI is told to output `primingRecommendations` (historical figures, books) but doesn't have access to the data! It must currently hallucinate or skip these fields.

**Files to modify:**
- `src/prompts/rag.js` — Add imports and context building
- `workers/src/engine-compat.js` — Add to `__PRIME_DATA` injection (critical for Workers)

**Fix approach:**
```javascript
// In engine-compat.js, add:
import historicalFigures from '../../src/knowledgebase/prime_self/historical_figures.json';
import bookRecommendations from '../../src/knowledgebase/prime_self/book_recommendations.json';
import forgesCanonical from '../../src/knowledgebase/prime_self/forges_canonical.json';
import knowledgesCanonical from '../../src/knowledgebase/prime_self/knowledges_canonical.json';

// Then add to __PRIME_DATA object
```

---

## 🟡 RESEARCH / FUTURE CONSIDERATIONS

### KANBAN-007 | Matching Algorithm for Historical Figures
**Priority:** MEDIUM  
**Type:** Backend Enhancement  

**What was documented in Sacred Texts:**
> "Recommending historical figures who align with the user" (rated 9.5/10)

**What's missing:**
- ❌ No dedicated matching algorithm to find best-fit historical figures
- ❌ Currently relies on AI inference rather than deterministic matching
- ❌ Could improve by adding `matchHistoricalFigure(chartData)` function

**Proposed approach:**
1. Score each figure by HD type match
2. Score by Forge alignment
3. Score by domain/interest overlap
4. Return top 3 matches with confidence scores

---

## 🟢 COMPLETED (For Reference)

### ✅ Canonical JSON Files Created
- `forges_canonical.json` — Five Forges with full metadata
- `knowledges_canonical.json` — Six Knowledges
- `sciences_canonical.json` — Six Sciences
- `arts_canonical.json` — Six Arts
- `defenses_canonical.json` — Six Defenses
- `heresies_canonical.json` — Six Heresies
- `historical_figures.json` — 25+ figures by Type/Forge
- `book_recommendations.json` — 60+ books by Type/Forge/Knowledge

### ✅ Synthesis Prompt Updated
- FORGE_MAPPING constant with HD/astro triggers
- SIX_KNOWLEDGES constant
- Output schema includes `primingRecommendations` and enhanced `forgeIdentification`

### ✅ Canonical Test Suite
- `tests/canonical.test.js` — 56 tests validating all canonical data structures

### ✅ Documentation Updated
- ARCHITECTURE.md, CODEBASE_MAP.md, DOCUMENTATION_INDEX.md, GLOSSARY.md, BUILD_LOG.md

---

## Priority Matrix

| ID | Item | Priority | Effort | Impact |
|----|------|----------|--------|--------|
| 001 | Priming Recommendations UI | HIGH | Medium | High — directly surfaces AI-generated recommendations |
| 002 | Forge Weapon/Defense UI | HIGH | Low | High — completes the Forge experience |
| 014 | Practitioner Dashboard | HIGH | High | High — $500 tier revenue unlock (blocked) |
| 003 | Six Knowledges Surfacing | MEDIUM | Medium | Medium — educational enhancement |
| 006 | RAG Context Verification | MEDIUM | Low | High — ensures AI has data access |
| 007 | Matching Algorithm | MEDIUM | Medium | Medium — improves recommendation quality |
| 008 | Enhanced Dashboard Cards | MEDIUM | Medium | High — reduces friction, increases tab engagement |
| 009 | Onboarding Branching | MEDIUM | Medium | High — improves conversion by ~15% (estimated) |
| 010 | Mobile CTA Persistence | MEDIUM | Low | High — increases chart generation on mobile |
| 011 | Daily Practices Digest | MEDIUM | High | High — increases retention + feature differentiation |
| 012 | Composite Quick-Compare | MEDIUM | Medium | High — reduces friction in key feature |
| 013 | Background Video Mobile Opt | MEDIUM | Low | Medium — improves Core Web Vitals + battery life |
| 015 | Smart Recommendations Feed | LOW | Medium | Medium — increases user onboarding flow clarity |
| 004 | Six Heresies Integration | LOW | High | Low — advanced feature |
| 005 | Arts/Sciences/Defenses | LOW | High | Medium — "nice to have" |

**Added 2026-03-09:** Items 008-015 from nav restructure session debrief

---

## Next Steps

**Immediate (High-ROI, Low-Effort):**
1. **KANBAN-010** (Mobile CTA Persistence) — 1-2 hours
2. **KANBAN-013** (Background Video Mobile) — 1-2 hours  
3. **KANBAN-006** (RAG Context Verify) — 2 hours

**Sprint 1 (This week):**
1. **KANBAN-002** (Forge Weapon/Defense UI) — small UI change, big impact
2. **KANBAN-008** (Enhanced Dashboard Cards) — fold into existing card components

**Sprint 2 (Next 1-2 weeks):**
1. **KANBAN-001** (Priming Recommendations UI) — surfaces rich historical figure + book data
2. **KANBAN-009** (Onboarding Branching) — improves first-time user experience
3. **KANBAN-012** (Composite Quick-Compare) — removes friction from key feature

**Product Decision Needed:**
- **KANBAN-014** — Resurrect $500 practitioner tier? If yes → 15-20 day build

---

*This document tracks the gap between "data exists" and "feature is live," and now includes user-facing ideas from the 2026-03-09 dash board UX session. The canonical alignment work established the philosophical foundation — these items complete the user-facing experience.*
