# Prime Self — Future State Kanban

**Created:** 2026-03-09  
**Purpose:** Track canonical philosophy features that have DATA created but need INTEGRATION  
**Reference:** Sacred Texts alignment session — several "nuggets" were documented but not fully wired up

> Historical working kanban. This file preserves earlier feature ideation and pricing context.
> Use `BACKLOG.md` for active prioritization and `DOCUMENTATION_INDEX.md` for the current documentation path.

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
**Status:** ✅ COMPLETE (Sprint 19)

**What was done:**
- ✅ Schema added to `synthesis.js` → `primingRecommendations` object
- ✅ Historical figures data in `src/knowledgebase/prime_self/historical_figures.json` (48 figures)
- ✅ Book recommendations data in `src/knowledgebase/prime_self/book_recommendations.json` (60+ books)
- ✅ Frontend rendering of `primingRecommendations` section in profile output (Sprint 19)
- ✅ UI card for "Historical Exemplar" with name, relevance, keyLesson, invocationContext
- ✅ UI for "Alternate Exemplars" (2-3 backup figures)
- ✅ UI for "Book Recommendations" with fiction + non-fiction  
- ✅ UI for "Current Knowledge Focus" (which of Six Knowledges to prioritize)
- ✅ CSS styling in `app.css` (.exemplar-card, .exemplar-name, .book-recs, .knowledge-focus-badge)

**Files modified:**
- `frontend/index.html` — Added rendering in Priming Recommendations section (~line 2232)

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
│ CURRENT FOCUS: Knowledge of Sciences                    │
│ → Right now, prioritize understanding your own design   │
└─────────────────────────────────────────────────────────┘
```

---

### KANBAN-002 | Forge Weapon/Defense/Shadow UI Rendering
**Priority:** HIGH  
**Type:** Feature Gap  
**Status:** ✅ COMPLETE (Sprint 19)

**What was done:**
- ✅ Schema added to `synthesis.js` → `forgeIdentification.forgeWeapon`, `forgeDefense`, `shadowWarning`
- ✅ Forge data with weapons/defenses in `src/prompts/synthesis.js` FORGE_MAPPING
- ✅ Forge canonical data in `src/knowledgebase/prime_self/forges_canonical.json`
- ✅ UI rendering of `forgeWeapon` field (Sprint 19)
- ✅ UI rendering of `forgeDefense` field (Sprint 19)
- ✅ UI rendering of `shadowWarning` field (Sprint 19)
- ✅ CSS styling in `app.css` (.forge-weapon, .forge-defense, .forge-shadow, .forge-icon)

**Files modified:**
- `frontend/index.html` — Extended Forge Identification card rendering
- `frontend/css/app.css` — Added forge weapon/defense/shadow styling

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
  1. Knowledge of Sciences
  2. Knowledge of Arts  
  3. Knowledge of Defenses
  4. Knowledge of Heresies
  5. Knowledge of Connections
  6. Knowledge of Mysteries

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
**Status:** ✅ COMPLETE (Sprint 19) — verified fix deployed

**Verified Fixed (Sprint 19):**
- ✅ `historical_figures.json` loaded into RAG context
- ✅ `book_recommendations.json` loaded into RAG context
- ✅ `forges_canonical.json` loaded (canonical, not old forge_mapping)
- ✅ `knowledges_canonical.json` loaded
- ✅ `arts_canonical.json` loaded
- ✅ `sciences_canonical.json` loaded
- ✅ `defenses_canonical.json` loaded

**Resolution:**
Added 7 static imports to `workers/src/engine-compat.js` with corresponding entries in `globalThis.__PRIME_DATA.kb` object. AI synthesis now has full access to canonical Prime Self data.

**Files modified:**
- `workers/src/engine-compat.js` — Added 7 imports and kb entries

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

## 🎨 UX DEEP REVIEW IDEAS (Not in Sprint 18)

### KANBAN-016 | Hero Bodygraph — Make Chart the Product
**Priority:** MEDIUM  
**Type:** UX Philosophy Shift  
**Status:** Design concept only  
**Source:** UX_DEEP_REVIEW.md Steve Jobs Principle #3

**What was recommended:**
> "Make bodygraph visualization the HERO of the page — giant, interactive, beautiful. The data serves the visual, not the other way around. Think Apple product pages: product image dominates, specs are secondary."

**Current state:**
- Chart renders as data table with small bodygraph SVG on side
- Desktop: ~400px bodygraph, Mobile: ~300px
- Data dump emphasized over visual

**Proposed redesign:**
- Increase bodygraph to 800px on desktop, 100% width mobile
- Show giant bodygraph FIRST, data details below fold
- "Your Pattern: Generator" appears as overlay on chart, not separate section

**Files to modify:**
- `frontend/js/bodygraph.js` — Increase render size
- `frontend/index.html` — Restructure chart results layout (~line 2100)
- `frontend/css/app.css` — New `.bodygraph-hero` class

**Related:** BL-UX-M1 (Interactive bodygraph) should implement this philosophy

---

### KANBAN-017 | Click-to-Learn Interactive Bodygraph
**Priority:** HIGH  
**Type:** Feature Enhancement  
**Status:** Aligns with BL-UX-M1 but more specific  
**Source:** UX_DEEP_REVIEW.md Part 3.2, Part 7, r/humandesign sentiment

**What users want:**
> "r/humandesign says: 'My chart but interactive — Click on a center/gate to learn about it'"

**Proposed interaction:**
1. **Hover:** Center or gate glows subtly
2. **Click center:** Modal shows what the center governs + defined vs open meaning
3. **Click gate:** Shows gate name, I Ching hexagram, meaning, your line
4. **Click channel:** Shows both gates + circuitry type + flow

**Example modal:**
```
┌────────────────────────────────────┐
│ 🟢 Sacral Center (DEFINED)         │
├────────────────────────────────────┤
│ The Life Force Engine              │
│                                    │
│ WHAT IT IS: Sustainable energy for │
│ work you love. Your gut response.  │
│                                    │
│ WHEN DEFINED: You have consistent  │
│ energy. Wait for things to respond │
│ to. Your "uh-huh/uh-uh" is truth. │
│                                    │
│ YOUR GATES: 5, 14, 29, 59          │
│ [Click to see each gate]           │
└────────────────────────────────────┘
```

**Data source:**
- `src/data/centers.json`
- `src/data/gate_wheel.json`
- `src/data/channels.json`

**Files to create:**
- `frontend/js/bodygraph-interactions.js`

**Files to modify:**
- `frontend/js/bodygraph.js` — Add event listeners to SVG elements
- `frontend/index.html` — Add modal template
- `frontend/css/components/modals.css` — Style info modals

**Impact:** Transforms chart from "confusing diagram" to "interactive learning tool"

---

### KANBAN-018 | Animated Transit Connections (Visual Lines)
**Priority:** MEDIUM  
**Type:** Visual Enhancement  
**Status:** Concept only  
**Source:** UX_DEEP_REVIEW.md Part 8, Principle 5

**What was recommended:**
> "Steve Jobs would: Transit connections drawn as visible lines between your chart and the sky."

**Current state:**
- Transits show as badge list: "☉ Sun → Gate 44"
- No visualization of HOW transits touch natal chart

**Proposed visualization:**
```
  YOUR NATAL CHART       CURRENT TRANSITS
 ┌──────────────┐       ┌──────────────┐
 │              │       │              │
 │   Gate 44 ●──┼──────→☉ Sun         │
 │   (natal)    │ gold  │ (today)      │
 │              │       │              │
 │   Gate 48 ●──┼──────→♃ Jupiter     │
 │              │purple │              │
 └──────────────┘       └──────────────┘

Animation: Lines draw when transit hits natal gate
```

**Technical approach:**
1. Render two mini bodygraphs side-by-side (natal + transit)
2. When transit activates natal gate, draw SVG `<line>` connecting them
3. Animate with `stroke-dasharray` (draw effect)
4. Color code by planet (Sun=gold, Moon=silver, Mars=red)

**Files to create:**
- `frontend/js/transit-connections.js`
- `frontend/css/transit-lines.css`

**Files to modify:**
- `frontend/index.html` — Transits tab (~line 2600) add dual chart view

**Impact:** Makes transits FEEL real — you see sky touching YOUR chart

---

### KANBAN-019 | Real Social Proof (Database-Driven Stats)
**Priority:** HIGH  
**Type:** Trust & Authenticity  
**Status:** Currently using fake hardcoded numbers  
**Source:** UX_DEEP_REVIEW.md Part 2.2, Reddit sentiment

**Current implementation (index.html ~line 862):**
```javascript
// ALWAYS shows fake numbers:
document.getElementById('weeklyUsers').textContent = '2,847';
document.getElementById('totalProfiles').textContent = '18,392';
```

**Reddit says:**
> "Fake testimonials are the #1 trust-killer"

**Fix approach:**
```javascript
// Fetch real stats from database
const stats = await fetch('/api/stats/public').then(r => r.json());
document.getElementById('weeklyUsers').textContent = stats.activeUsersLast7Days;
document.getElementById('totalProfiles').textContent = stats.profilesGenerated;
```

**Backend work needed:**
- Add `/api/stats/public` endpoint
- Query Neon: `SELECT COUNT(DISTINCT user_id) WHERE created_at > NOW() - 7 days`

**Alternative if numbers are small:**
- Remove social proof banner entirely (Steve Jobs: "Remove until it breaks")
- OR use qualitative: "Join others exploring their blueprint" (no number)

**Impact:** Builds trust, shows real product traction

**Related:** BL-UX-M3 (Real social proof) in Sprint 18

---

### KANBAN-020 | $7-9/mo Casual Tier Pricing
**Priority:** MEDIUM  
**Type:** Monetization Strategy  
**Status:** Missing pricing tier  
**Source:** UX_DEEP_REVIEW.md Part 2.3, Reddit pricing research

**Current pricing (Plan v4):**
- Free ($0) → Explorer ($12) → Guide ($60) → Studio ($149)

**Note:** This kanban item is now RESOLVED. Plan v4 implemented $12/$60/$149 tiers with daily ceilings via RATE_LIMIT_KV. The pricing gap from free→$12 is within the $7-15 sweet spot identified by Reddit research.

**Competitor pricing:**
- Co-Star: Free + $3/mo
- Chani: Free + $12/mo
- The Pattern: Free + $5/mo
- TimePassages: $60/year (~$5/mo)

**Status: ✅ RESOLVED** — Plan v4 pricing addresses the core feedback. Current $12 Explorer tier sits squarely in the market sweet spot.

---

### KANBAN-021 | SMS Digest Opt-In UI (Frontend Missing)
**Priority:** MEDIUM  
**Type:** Feature Gap (Backend exists, no UI)  
**Status:** Backend implemented in `cron.js`, no frontend  

**Backend verified (workers/src/cron.js ~line 45):**
```javascript
async function sendSMSDigests(env) {
  const users = await db.query(`
    SELECT phone FROM users WHERE sms_enabled = true
  `);
  // Sends daily transit digest via Telnyx
}
```

**What's missing:**
- ❌ No UI toggle for `sms_enabled`
- ❌ No form to enter phone number
- ❌ No SMS verification flow
- ❌ No visibility in Settings or any tab

**Where it should appear:**
Settings/Profile section:
```
┌───────────────────────────────────┐
│ 📱 Daily SMS Digest               │
├───────────────────────────────────┤
│ Get morning transit alerts        │
│                                   │
│ Phone: +1 [___] [___]-[____]      │
│        [Send verification code]   │
│                                   │
│ Sample message:                   │
│ "Good morning! Today's transits:  │
│  ☉ Sun in your Gate 44 (Alert)   │
│  → Watch for pattern flashes"     │
│                                   │
│ [ ] Enable daily SMS              │
└───────────────────────────────────┘
```

**Files to modify:**
- `frontend/index.html` — Add SMS settings section
- `workers/src/handlers/sms.js` — Add subscribe/verify endpoints (may exist)

**Impact:** Surface existing feature, enable viral potential

---

### KANBAN-022 | Aspect Orbs Display in Astrology
**Priority:** LOW  
**Type:** Feature Detail  
**Status:** Missing detail  
**Source:** UX_DEEP_REVIEW.md Part 7 (r/astrology wants)

**Current display:**
```
Sun □ Saturn
```

**What astrology users expect:**
```
Sun □ Saturn (4°23' orb — applying)
"Your Sun square Saturn means obstacles build resilience.
This aspect is EXACT on March 15 (peak intensity)."
```

**Missing data to show:**
- Orb degree (how far from exact)
- Applying vs separating (getting tighter or weaker)
- Date of exactness
- Aspect strength indicator (tight orbs = stronger)

**Files to modify:**
- `frontend/index.html` — Astrology aspects section
- May need backend to calculate orbs if not already done

**Related:** BL-UX-M9 (Aspect explanations) in Sprint 18 — this adds ORBS to that

---

### KANBAN-023 | Data Table Semantic HTML
**Priority:** LOW  
**Type:** Accessibility Fix  
**Status:** Structural improvement  
**Source:** UX_DEEP_REVIEW.md Part 5.2

**Problem:**
Chart data rows use `<div>` soup:
```html
<div class="data-row">
  <div class="data-label">Pattern:</div>
  <div class="data-value">Generator</div>
</div>
```

Screen readers can't navigate this as a table.

**Fix:**
```html
<table class="data-table" role="table">
  <tbody>
    <tr>
      <th scope="row">Pattern:</th>
      <td>Generator</td>
    </tr>
    <tr>
      <th scope="row">Strategy:</th>
      <td>To Respond</td>
    </tr>
  </tbody>
</table>
```

**Files to modify:**
- `frontend/index.html` — All data row rendering functions
- `frontend/css/app.css` — Style tables to look like current design

**Impact:** Screen reader users can navigate chart data properly

**Related:** BL-UX-H13 (Screen reader gaps) in Sprint 18

---

### KANBAN-024 | Focus Trap in Auth Modal
**Priority:** MEDIUM  
**Type:** Accessibility Fix  
**Status:** Keyboard navigation broken  
**Source:** UX_DEEP_REVIEW.md Part 5.1

**Problem:**
When auth modal is open, keyboard users can tab behind it to hidden elements.

**Fix:**
1. Capture first and last focusable elements in modal
2. On Tab from last element → focus first element
3. On Shift+Tab from first → focus last element
4. Trap focus until modal closes

**Standard implementation:**
```javascript
function trapFocus(modal) {
  const focusable = modal.querySelectorAll('button, input, a[href]');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}
```

**Files to modify:**
- `frontend/index.html` — Auth overlay functions (~line 4200)

**Related:** BL-UX-H12 (Keyboard navigation) in Sprint 18

---

### KANBAN-025 | Composite Connection Type Labels
**Priority:** LOW  
**Type:** UX Enhancement  
**Status:** Missing labels  
**Source:** UX_DEEP_REVIEW.md Part 3.1

**Current composite output:**
Shows channel activations but doesn't label the TYPE of connection:
- Electromagnetic (one person has gate 1, other has gate 8 → creates channel)
- Companionship (both have same gates)
- Compromise (both have same channel but different lines)
- Dominance (one person's definition overrides/blocks other)

**Proposed enhancement:**
```
Channel 1-8 (Throat ↔ G Center)
⚡ ELECTROMAGNETIC CONNECTION
You bring Gate 1 (Creative self-expression)
They bring Gate 8 (Contribution through example)
Together you form: Channel of Inspiration

Chemistry: You complete each other's circuit.
This creates magnetic attraction — you feel
"finished" in each other's presence.
```

**Files to modify:**
- `frontend/index.html` — Composite rendering (~line 2800)
- May need backend logic to classify connection types

**Impact:** Helps users understand WHY they're attracted to certain people

---

### KANBAN-026 | Embed Widget Deployment & Promotion
**Priority:** MEDIUM  
**Type:** Distribution Strategy  
**Status:** Built but not promoted  

**What exists:**
- `frontend/embed.html` — Standalone calculator widget
- `frontend/embed.js` — Widget JavaScript
- Documentation: `EMBED_WIDGET_GUIDE.md`

**What's missing:**
- ❌ Not mentioned in docs or marketing
- ❌ No embed code generator in app
- ❌ No "Add to your website" CTA
- ❌ Not tracked in analytics

**Opportunity:**
Practitioners, bloggers, and HD educators can embed calculator on their sites → drives traffic back to Prime Self.

**Proposed promotion:**
1. Add "Embed on your site" button in Share menu
2. Generate iframe code: `<iframe src="https://primeself.app/embed" width="400" height="600"></iframe>`
3. Track embed installations (referer analytics)
4. Add "Powered by Prime Self" footer to embeds (backlink)

**Files to modify:**
- `frontend/index.html` — Add embed code generator
- `DOCUMENTATION_INDEX.md` — Promote embed widget
- Website/marketing materials

**Impact:** Viral distribution channel, practitioner partnerships

---

## Priority Matrix (Updated)

| ID | Item | Priority | Effort | Impact |
|----|------|----------|--------|--------|
| 017 | Click-to-Learn Bodygraph | HIGH | Medium | High — transforms chart into learning tool |
| 019 | Real Social Proof | HIGH | Low | High — builds trust |
| 021 | SMS Opt-In UI | MEDIUM | Low | Medium — surfaces existing feature |
| 016 | Hero Bodygraph | MEDIUM | Medium | High — visual positioning |
| 018 | Transit Connections | MEDIUM | Medium | Medium | — makes transits visual |
| 020 | $7-9 Casual Tier | MEDIUM | Low | High — monetization gap |
| 024 | Focus Trap Modal | MEDIUM | Low | Medium — accessibility |
| 026 | Embed Widget Promo | MEDIUM | Low | Medium — distribution |
| 022 | Aspect Orbs | LOW | Low | Low — nice detail |
| 023 | Table Semantics | LOW | Medium | Low — accessibility polish |
| 025 | Composite Labels | LOW | Low | Low — education enhancement |

**Added 2026-03-09:** Items 016-026 from UX_DEEP_REVIEW.md audit — ideas not captured in Sprint 18

---

### KANBAN-027 | Interactive Bodygraph Visualization
**Priority:** HIGH  
**Type:** Feature Enhancement  
**Status:** NOT STARTED — Requires SVG integration  

**What was planned:**
During UX deep review, the bodygraph was identified as the "product hero" but currently shows as static data. Users want to click centers and gates to learn about them.

**What's missing:**
- ❌ **Clickable centers:** Hover/focus states with tooltips showing what each center governs
- ❌ **Gate interactions:** Click any gate badge to see its meaning and how it connects to user's life
- ❌ **Channel explanations:** Click channel labels to understand the energy flow between centers
- ❌ **Visual feedback:** Defined centers pulse/glow, open centers show different state
- ❌ **Progressive disclosure:** Start with overview, drill down to specific gates/channels

**Why it matters:**
- Users don't understand HD terminology without context
- Interactive learning increases engagement by 40% (per UX research)
- Makes the complex system accessible to beginners
- Differentiates from static chart competitors

**Implementation approach:**
```javascript
// Add to renderChart() function
function makeBodygraphInteractive(svgElement) {
  // Center click handlers
  centers.forEach(center => {
    const element = svgElement.querySelector(`#${center.id}`);
    element.addEventListener('click', () => showCenterModal(center));
  });
  
  // Gate click handlers  
  gates.forEach(gate => {
    const element = svgElement.querySelector(`#gate-${gate.number}`);
    element.addEventListener('click', () => showGateExplanation(gate));
  });
}
```

---

### KANBAN-028 | Enhanced Transit Personalization
**Priority:** MEDIUM  
**Type:** UX Enhancement  
**Status:** NOT STARTED — Data exists but not contextualized  

**What was planned:**
Transits show generic planet themes but don't explain what the transit means for the specific user's activated gates.

**What's missing:**
- ❌ **Gate-specific context:** When Sun hits Gate 44, explain what Gate 44 means to the user
- ❌ **Personal impact:** "This transit is activating YOUR Gate 44 (Coming to Meet) — you may notice increased alertness to opportunities"
- ❌ **Duration clarity:** Show when transit peaks and fades, not just "changes weekly"
- ❌ **Actionable guidance:** "During this transit, focus on pattern recognition in your work/life"

**Why it matters:**
- Generic transit info doesn't help users understand personal relevance
- Users want to know "what should I DO during this transit?"
- Personalization increases retention (per Reddit UX research)
- Makes complex astrological data actionable

**Mockup:**
```
☉ Sun → your Gate 44 (The Coming to Meet)
"The collective spotlight activates YOUR pattern recognition gate. 
You may notice unusual ability to spot opportunities this week.

⏱ Peaks: March 15-18, fades by March 22
💡 Focus: Trust those 'aha' moments about timing and opportunities"
```

---

### KANBAN-029 | Center & Channel Meaning Explanations
**Priority:** MEDIUM  
**Type:** Educational Enhancement  
**Status:** NOT STARTED — Core data exists in src/data/  

**What was planned:**
Centers and channels show as pills/codes but users don't understand what they govern or mean.

**What's missing:**
- ❌ **Center explanations:** Each center needs 1-sentence description of what energy it governs
- ❌ **Defined vs Open:** Explain the difference (defined = consistent energy, open = amplifies others)
- ❌ **Channel meanings:** What does Channel 20-34 (Charisma) actually mean in daily life?
- ❌ **Gate connections:** How do the two gates in a channel interact?

**Why it matters:**
- Users see "Head Center" but don't know it governs inspiration and mental pressure
- Without context, the chart feels like meaningless jargon
- Educational content prevents user drop-off at the "what does this mean?" stage

**Example explanations:**
- **Head Center (Defined):** You have consistent mental inspiration and pressure — ideas come reliably
- **Head Center (Open):** You amplify others' mental energy — can feel overwhelmed by group thinking
- **Channel 20-34 (Charisma):** Makes busy-ness look effortless — you get energy from starting projects

---

### KANBAN-030 | Gene Keys Shadow→Gift→Siddhi Journey
**Priority:** MEDIUM  
**Type:** Educational Enhancement  
**Status:** NOT STARTED — Shows static labels only  

**What was planned:**
Gene Keys show Shadow/Gift/Siddhi but don't explain the transformative journey between them.

**What's missing:**
- ❌ **Journey context:** Explain that Shadow→Gift→Siddhi is a developmental path
- ❌ **Current phase:** Show where user is on their journey for each Key
- ❌ **Practical guidance:** How to move from Shadow to Gift in daily life
- ❌ **Integration with transits:** How planetary movements support this evolution

**Why it matters:**
- Users see "Shadow: Interference" but don't understand it's the starting point of growth
- Without journey context, Gene Keys feel like judgment rather than roadmap
- Transformational tools should show the path forward

**Enhanced display:**
```
Gene Key 44: Coming to Meet

🎭 Shadow Phase (Current): Interference
"You begin by blocking flow — micromanaging, controlling outcomes"

✨ Gift Phase (Next): Teamwork  
"Through awareness, you develop collaborative synergy"

👑 Siddhi Phase (Highest): Synarchy
"Leadership through surrender, unity consciousness"
```

---

### KANBAN-031 | Daily Practice Recommendations Engine
**Priority:** MEDIUM  
**Type:** Feature Enhancement  
**Status:** NOT STARTED — Requires Forge + transit integration  

**What was planned:**
Six Arts, Six Sciences, Six Defenses exist as data but no personalized daily suggestions.

**What's missing:**
- ❌ **Forge-based practices:** Chronos Forge gets movement + science recommendations
- ❌ **Transit-aligned:** Moon in Pisces suggests aromatherapy or visualization
- ❌ **Personalized feed:** "Today's practices for your [Forge] during [transit]"
- ❌ **Progress tracking:** Streak counter for consistent practice

**Why it matters:**
- Users want actionable guidance beyond just data
- Daily practices create habit formation and retention
- Personalization makes recommendations feel valuable
- Differentiates from apps that just show charts

**Mockup:**
```
Daily Practices for Chronos Forge
During Moon in Pisces transit

⭐ Movement: 15min walking meditation (grounding)
🔬 Science: Read about historical cycles (Saturn reference)
🛡️ Defense: Aromatherapy with frankincense (Pisces oil)

Your 23-day consistency streak 🔥
```

---

### KANBAN-032 | Skeleton Loading States
**Priority:** LOW  
**Type:** Performance / UX Enhancement  
**Status:** NOT STARTED — Reduces perceived wait time  

**What was planned:**
API calls show generic spinner but modern UX uses skeleton screens that match content shape.

**What's missing:**
- ❌ **Chart skeleton:** Animated placeholders showing bodygraph outline + data cards
- ❌ **Profile skeleton:** Text blocks and card shapes matching synthesis layout
- ❌ **Transit skeleton:** Timeline structure with placeholder transit rows
- ❌ **Composite skeleton:** Two chart placeholders with relationship insights shape

**Why it matters:**
- Reduces perceived wait time by 35% (per UX research)
- Prevents layout shift (CLS) issues
- Makes loading feel faster and more polished
- Professional UX expectation in 2026

**Implementation:**
```css
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-chart { /* Matches bodygraph dimensions */ }
.skeleton-card { /* Matches data card layout */ }
```

---

### KANBAN-033 | Progressive Onboarding Experience
**Priority:** HIGH  
**Type:** UX Enhancement  
**Status:** NOT STARTED — Currently linear 3-step modal  

**What was planned:**
Onboarding should adapt to user type and context rather than showing everyone the same 3 steps.

**What's missing:**
- ❌ **User type detection:** Different flows for returning users, mobile users, experienced users
- ❌ **Context awareness:** Skip steps based on what user has already done
- ❌ **Progressive disclosure:** Start simple, unlock complexity as user engages
- ❌ **Branching logic:** "Have you heard of Human Design?" → different paths

**Why it matters:**
- Experienced users abandon linear onboarding (per UX research)
- Mobile users need simpler flows (60% less content)
- Personalization increases conversion by 15-20%
- One-size-fits-all onboarding fails modern UX standards

**Proposed flow:**
```
New user → 3-step welcome
Returning user → Skip welcome, go to profile step  
Mobile user → Compress to 2 steps
Experienced user → Skip explanation, jump to advanced options
```

---

### KANBAN-034 | Share-Ready Chart Images
**Priority:** MEDIUM  
**Type:** Social Feature  
**Status:** NOT STARTED — Canvas generation stub exists  

**What was planned:**
Users want to share their charts on social media but current share is text-only.

**What's missing:**
- ❌ **Canvas generation:** Render bodygraph to PNG/JPG for sharing
- ❌ **Social templates:** Instagram-ready layouts with user's key info
- ❌ **Branding:** Include Prime Self logo and clean typography
- ❌ **Privacy controls:** Option to anonymize or share specific elements

**Why it matters:**
- Social sharing drives viral growth
- Visual charts are more engaging than text
- Users want to show their "personality type" to friends
- Missing feature compared to astrology apps

**Implementation approach:**
```javascript
// Build on existing shareImage.js
async function generateChartImage(chartData, style = 'instagram') {
  const canvas = document.createElement('canvas');
  // Render bodygraph SVG to canvas
  // Add user info overlay
  // Apply social media template
  return canvas.toDataURL('image/png');
}
```

---

### KANBAN-035 | Transit Timeline Visualization
**Priority:** MEDIUM  
**Type:** Feature Enhancement  
**Status:** NOT STARTED — Shows duration but not intensity curve  

**What was planned:**
Transits show "changes gate weekly" but users want to know when energy peaks and fades.

**What's missing:**
- ❌ **Intensity curves:** Visual timeline showing when transit is strongest
- ❌ **Peak dates:** "Peaks March 15-18, fades by March 22"
- ❌ **Multiple transit overlay:** See how transits combine over time
- ❌ **Personal impact:** How transit intensity affects user's specific gates

**Why it matters:**
- Users plan around transit energies (per Reddit research)
- Timeline view makes abstract concepts concrete
- Helps users understand "when should I act on this?"
- Differentiates from apps showing only current transits

**Mockup:**
```
Mars in Pisces Transit Timeline
Affects your Gates: 39, 44, 57

Week 1 (Mar 10-16): Building intensity → 30%
Week 2 (Mar 17-23): Peak energy → 80% ⚡
Week 3 (Mar 24-30): Waning → 40%
Week 4 (Mar 31-Apr 6): Fading → 10%
```

---

### KANBAN-014 | "Why It Matters" Context Explanations
**Priority:** HIGH  
**Type:** UX Enhancement  
**Status:** NOT STARTED — Data exists but not surfaced  

**What was planned:**
During UX deep review (2026-03-08), every data point was identified as needing 1-sentence context. Users arrive knowing nothing about HD terms.

**What's missing:**
- ❌ **Type explanations:** Generator/Manifestor/Projector/Reflector with what it means for life
- ❌ **Authority explanations:** Emotional/Sacral/Mental/None with decision-making guidance  
- ❌ **Strategy explanations:** To Respond/Initiate/Inform with practical application
- ❌ **Profile explanations:** 1/3, 2/4, 3/5, etc. with life role context
- ❌ **Center explanations:** What each center governs when defined vs open
- ❌ **Channel descriptions:** What each active channel means and how gates interact
- ❌ **Gate meanings in transits:** Personal context for natal gate activations

**Why it matters:**
- #1 complaint on r/humandesign: "App told me I'm a Generator 3/5 but didn't explain what that means"
- Prevents user drop-off after seeing raw labels
- Makes complex system accessible (competitor advantage)

**Example transformation:**
```
Current: Pattern: Generator
New: Pattern: Generator → You have consistent, renewable life force energy. You're designed to find work you love and master it. When you're lit up, you're unstoppable.
```

---

### KANBAN-015 | Information Architecture Restructure
**Priority:** HIGH  
**Type:** UX Restructure  
**Status:** NOT STARTED — 13 tabs causing overload  

**What was planned:**
UX review identified 13 visible tabs as overwhelming. Steve Jobs: "People can't prioritize 13 things. They can prioritize 3."

**What's missing:**
- ❌ **4 primary tabs instead of 13:** Blueprint (chart+profile), Energy (transits+check-in), Relationships (composite), Growth (enhance+diary+practices)
- ❌ **Progressive disclosure:** Hide advanced tabs until user progresses through journey
- ❌ **Mobile nav alignment:** Labels must match what users find (Chart→Blueprint, Keys→Profile, Astro→Deepen)

**Why it matters:**
- Current: Land → see 13 tabs → confusion → leave
- Target: Land → see 3 things → guided journey → unlock more
- Increases engagement with underused tabs by 3-5x

---

### KANBAN-016 | Birth Data Persistence & Auto-Fill
**Priority:** HIGH  
**Type:** UX Friction Reduction  
**Status:** NOT STARTED — Users enter data 3x  

**What was planned:**
UX audit found users must enter birth data in Chart, Profile, and Composite tabs separately.

**What's missing:**
- ❌ **localStorage persistence:** Store birth data after first entry
- ❌ **Auto-populate all forms:** Show "Using your birth data: June 15, 1990 14:30 Tampa, FL" with "Change" link
- ❌ **Form validation:** Prevent invalid dates/times/locations
- ❌ **Timezone handling:** Convert to UTC for calculations, show local time to user

**Why it matters:**
- Steve Jobs: "Ask once, remember forever"
- Reduces friction in key user journey
- Prevents data entry errors that break calculations

---

### KANBAN-017 | Social Proof Authenticity
**Priority:** HIGH  
**Type:** Trust Building  
**Status:** NOT STARTED — Fake testimonials identified  

**What was planned:**
UX review found 6 clearly fabricated testimonials that hurt credibility.

**What's missing:**
- ❌ **Remove fake testimonials:** Replace with real aggregate stats or disclaimer
- ❌ **Real usage metrics:** Show actual "X profiles created, Y daily active users"
- ❌ **Social validation:** "Join X people who've explored their blueprint" with real count
- ❌ **Beta disclaimer:** If using early testimonials, clearly mark as "from beta testers"

**Why it matters:**
- Reddit consensus: Fake testimonials are #1 trust-killer
- r/astrology users specifically call out "those fake review carousels"
- Real social proof increases conversion by 15-20%

---

### KANBAN-018 | Pricing Optimization
**Priority:** HIGH  
**Type:** Revenue Optimization  
**Status:** NOT STARTED — $0→$97 jump feels like scam  

**What was planned:**
UX review found pricing shock: free → $15 → $97 → $500 creates trust issues.

**What's missing:**
- ❌ **Add intermediate tier:** $7-9/month between free and $15 for casual users
- ❌ **Remove $500 tier:** Lists features that don't exist (full practitioner dashboard, client management)
- ❌ **Feature parity check:** All listed features must be implemented or clearly marked "(Coming Soon)"
- ❌ **Value communication:** Explain what each tier unlocks beyond just feature lists

**Why it matters:**
- Reddit consensus: $5-15/mo sweet spot for astrology apps
- $97 jump from free feels predatory
- Unimplemented features in pricing erode trust

---

### KANBAN-019 | Design System Consolidation
**Priority:** MEDIUM  
**Type:** Technical Debt  
**Status:** NOT STARTED — Three competing color systems  

**What was planned:**
UX audit found inline styles bypass design tokens, creating unpredictable overrides.

**What's missing:**
- ❌ **Single token system:** Remove inline `:root` variables from `index.html`
- ❌ **Consistent spacing:** Use `--space-1` through `--space-24` instead of hardcoded pixels
- ❌ **Font scale enforcement:** Use only `xs, sm, base, md, lg, xl, 2xl, 3xl, 4xl`
- ❌ **Color conflict resolution:** Premium tokens override base but inline styles override both

**Why it matters:**
- Creates visual inconsistency and maintenance burden
- Makes responsive design impossible
- Violates design system principles

---

### KANBAN-020 | Visual Hierarchy & Card System
**Priority:** MEDIUM  
**Type:** Visual Design  
**Status:** NOT STARTED — All cards look identical  

**What was planned:**
UX review found no visual distinction between primary actions, results, information, and alerts.

**What's missing:**
- ❌ **Card type variants:** Different backgrounds/borders for action vs info vs status cards
- ❌ **Primary CTA prominence:** Birth data entry card should be most prominent
- ❌ **Result card styling:** Generated charts should have success styling
- ❌ **Alert card system:** Clear visual distinction for warnings/errors/success

**Why it matters:**
- Users can't distinguish between different content types
- Reduces scannability and user confidence
- Makes interface feel amateurish

---

### KANBAN-021 | Step Guide Persistence
**Priority:** MEDIUM  
**Type:** UX Enhancement  
**Status:** NOT STARTED — Guide disappears after generation  

**What was planned:**
UX review praised 3-step guide but noted it disappears too soon.

**What's missing:**
- ❌ **Breadcrumb persistence:** Keep guide visible as progress indicator
- ❌ **Step 4 addition:** "Explore your transits" after profile generation
- ❌ **Step 5 addition:** "Track your alignment" (check-in integration)
- ❌ **Progress indication:** Show completion status for each step

**Why it matters:**
- Users lose context of where they are in the journey
- Reduces perceived value of multi-step process
- Good UX pattern that's half-implemented

---

### KANBAN-022 | Transit Personal Context
**Priority:** MEDIUM  
**Type:** Feature Enhancement  
**Status:** NOT STARTED — Generic planet themes only  

**What was planned:**
UX review found transit explanations are generic, not personalized to user's natal gates.

**What's missing:**
- ❌ **Gate-specific context:** "Sun activating YOUR Gate 44 (Coming to Meet) — alertness to patterns"
- ❌ **Personal meaning:** Explain how transit affects user's specific configuration
- ❌ **Load gate data:** Frontend needs access to `gate_wheel.json`, `centers.json`, `channels.json`
- ❌ **Connection explanations:** How transit gates connect to user's defined centers

**Why it matters:**
- Users want to know "what does this mean FOR ME?"
- Generic explanations feel impersonal and less valuable
- Data exists in backend but not surfaced in UI

---

### KANBAN-023 | Gene Keys Journey Context
**Priority:** MEDIUM  
**Type:** Content Enhancement  
**Status:** NOT STARTED — Shows shadow/gift/siddhi as static list  

**What was planned:**
UX review found Gene Keys presented as judgment rather than journey roadmap.

**What's missing:**
- ❌ **Shadow→Gift→Siddhi progression:** Explain the evolutionary path
- ❌ **Personal context:** "You begin in Interference (micromanaging), develop Teamwork (synergy), reach Synarchy (surrendered leadership)"
- ❌ **Practical guidance:** How to move from shadow to gift in daily life
- ❌ **Integration with transits:** How current transits support this evolution

**Why it matters:**
- Transforms judgment ("you have Interference") into empowerment ("you're evolving toward Synarchy")
- Aligns with Prime Self philosophy of growth through awareness
- Makes advanced content accessible rather than intimidating

---

### KANBAN-024 | Micro-Interactions & Animations
**Priority:** LOW  
**Type:** Polish Enhancement  
**Status:** NOT STARTED — Generic spinners only  

**What was planned:**
UX review suggested gate reveals with glows, center pulses, transit connection lines.

**What's missing:**
- ❌ **Gate reveal animations:** Subtle glow when gates are shown
- ❌ **Center pulse effects:** Defined centers pulse or highlight
- ❌ **Transit connections:** Visual lines between chart and sky positions
- ❌ **Loading states:** Skeleton screens instead of generic spinners
- ❌ **Success feedback:** Satisfying animations for completed actions

**Why it matters:**
- Makes complex system feel magical rather than intimidating
- Increases perceived value and engagement
- Differentiates from competitors with static interfaces

---

### KANBAN-025 | Background Video Performance
**Priority:** MEDIUM  
**Type:** Performance Optimization  
**Status:** NOT STARTED — Loads regardless of connection  

**What was planned:**
Background video exists but doesn't consider device capabilities or bandwidth.

**What's missing:**
- ❌ **Bandwidth detection:** Skip video on slow connections
- ❌ **Mobile optimization:** Different video for mobile (smaller file, no particles)
- ❌ **Battery awareness:** Reduce animations on low battery
- ❌ **Progressive loading:** Load poster first, video second
- ❌ **GPU optimization:** Reduce particle count from 30 to 10 on mobile

**Why it matters:**
- Video hurts Core Web Vitals scores
- Drains battery and data on mobile
- Makes text harder to read when elements pass behind content
- Steve Jobs: "Design is not how it looks. Design is how it works"

---

## Priority Matrix (Updated)

| ID | Item | Priority | Effort | Impact |
|----|------|----------|--------|--------|
| 001 | Priming Recommendations UI | HIGH | Medium | High — directly surfaces AI-generated recommendations |
| 002 | Forge Weapon/Defense UI | HIGH | Low | High — completes the Forge experience |
| 014 | "Why It Matters" Context Explanations | HIGH | Medium | High — prevents user drop-off with raw labels |
| 015 | Information Architecture Restructure | HIGH | High | High — reduces 13-tab overload to 4 primary tabs |
| 016 | Birth Data Persistence & Auto-Fill | HIGH | Medium | High — eliminates 3x data entry friction |
| 017 | Social Proof Authenticity | HIGH | Medium | High — removes fake testimonials trust-killer |
| 018 | Pricing Optimization | HIGH | Medium | High — fixes $0→$97 pricing shock |
| 027 | Interactive Bodygraph | HIGH | High | High — makes complex system accessible |
| 033 | Progressive Onboarding | HIGH | Medium | High — improves conversion by 15-20% |
| 003 | Six Knowledges Surfacing | MEDIUM | Medium | Medium — educational enhancement |
| 006 | RAG Context Verification | MEDIUM | Low | High — ensures AI has data access |
| 007 | Matching Algorithm | MEDIUM | Medium | Medium — improves recommendation quality |
| 008 | Enhanced Dashboard Cards | MEDIUM | Medium | High — reduces friction, increases tab engagement |
| 009 | Onboarding Branching | MEDIUM | Medium | High — improves first-time user experience |
| 010 | Mobile CTA Persistence | MEDIUM | Low | High — increases chart generation on mobile |
| 011 | Daily Practices Digest | MEDIUM | High | High — increases retention + feature differentiation |
| 012 | Composite Quick-Compare | MEDIUM | Medium | High — reduces friction in key feature |
| 013 | Background Video Mobile Opt | MEDIUM | Low | Medium — improves Core Web Vitals + battery life |
| 019 | Design System Consolidation | MEDIUM | Medium | High — eliminates visual inconsistency |
| 020 | Visual Hierarchy & Card System | MEDIUM | Medium | High — improves scannability and trust |
| 021 | Step Guide Persistence | MEDIUM | Low | High — maintains user journey context |
| 022 | Transit Personal Context | MEDIUM | Medium | High — makes transits actionable for user |
| 030 | Gene Keys Journey Context | MEDIUM | Medium | Medium — transforms judgment to roadmap |
| 031 | Daily Practice Engine | MEDIUM | High | High — creates habit formation |
| 034 | Share-Ready Images | MEDIUM | Medium | Medium — enables viral growth |
| 035 | Transit Timeline | MEDIUM | Medium | Medium — helps users plan around energies |
| 015 | Smart Recommendations Feed | LOW | Medium | Medium — increases user onboarding flow clarity |
| 032 | Skeleton Loading | LOW | Low | Low — polish enhancement |
| 004 | Six Heresies Integration | LOW | High | Low — advanced feature |
| 005 | Arts/Sciences/Defenses | LOW | High | Medium — "nice to have" |

**Added 2026-03-10:** Items 014-025 from comprehensive UX deep review — critical user-facing improvements that were discussed but never implemented despite being identified during the 2026-03-08 audit process

---

## 🆕 NEW GAPS IDENTIFIED (2026-03-09 Audit)

### KANBAN-036 | Console.log Cleanup for Production
**Priority:** MEDIUM  
**Type:** Code Quality  
**Status:** NOT STARTED — 20+ instances found  

**Problem:**
Production code contains debug console.log statements that should be removed:
- Line 1574: `console.log('[Chart] renderAstroChart called'...)`
- Line 1803: `console.log('[BirthData] Saved to localStorage')`
- Line 1847: `console.log('[BirthData] Restored from localStorage')`
- Line 1871: `console.log('[Chart] renderChart called with data:'...)`
- Lines 2152-2173: Multiple `console.log` in `renderProfile()`
- Line 3948: `console.log('✅ Share successful')`
- Line 4139: `console.log('📊 Event:...')` in trackEvent (analytics stub)
- Line 4417: `console.log('🔄 Refreshing transit data...')`

**Fix:**
- Remove all debug logging or wrap in `if (window.DEBUG)` conditional
- Keep error logging for production diagnostics

**Effort:** 1 hour

---

### KANBAN-037 | "Coming Soon" Stub Removal
**Priority:** HIGH  
**Type:** UX Trust  
**Status:** NOT STARTED  

**Problem:**
Production has visible "Coming soon!" messages that hurt credibility:
- Line 4023: `shareChartImage()` → "Chart image sharing coming soon!"
- Line 4050: `downloadChart()` → "Chart download coming soon!"
- Line 3125: Cluster synthesis → "Coming soon!"

**Fix Options:**
1. Remove feature buttons until implemented (recommended)
2. Implement features (shareChartImage requires Canvas rendering ~ 12 hours)
3. Update messaging with expected dates

**Effort:** 1 hour (removal) or 12 hours (implementation)

---

### KANBAN-038 | Error Handling Consolidation
**Priority:** LOW  
**Type:** Code Quality  
**Status:** NOT STARTED  

**Problem:**
Four different error display patterns exist:
- `alert()` in addClient(), exportPDF() — jarring native dialog
- `showAlert()` in cluster functions
- `showEnhanceStatus()` in diary functions
- `innerHTML` with alert classes elsewhere

**Fix:**
Consolidate to single `showNotification(message, type)` pattern across all handlers.

**Effort:** 4 hours

---

### KANBAN-039 | Form Validation Gaps
**Priority:** LOW  
**Type:** Data Quality  
**Status:** NOT STARTED  

**Missing validation:**
- SMS phone input (line 1142): No international format pattern
- Cluster name (line 1109): No min/max length validation
- Diary title (line 741): No max length validation

**Fix:**
Add HTML5 validation patterns and JavaScript validation with user-friendly messages.

**Effort:** 2 hours

---

### KANBAN-040 | Accessibility Fixes (New Findings)
**Priority:** MEDIUM  
**Type:** Accessibility  
**Status:** NOT STARTED  

**Issues identified:**
- Video without text alternative: Background video lacks screen reader fallback
- Missing focus indicators: Dynamic pill badges and dropdown items lack :focus-visible styles
- Color-only natal hit indicator: Transit gates use gold color only — no icon for colorblind users
- Hidden content focusable: Tab panels with display:none may still receive focus

**Fix:**
- Add aria-hidden="true" to video, provide fallback text
- Add :focus-visible styles to .pill, dropdown-item classes
- Add ★ icon alongside gold color for natal hit gates
- Add tabindex="-1" to hidden tab panels

**Effort:** 4 hours

---

### KANBAN-041 | Analytics Stub Implementation
**Priority:** LOW  
**Type:** Feature Gap  
**Status:** NOT STARTED  

**Problem:**
`trackEvent()` function (line 4138) only logs to console — no analytics integration:
```javascript
// Future: Send to Google Analytics, Mixpanel, etc.
// if (window.gtag) { ... }
```

**Fix:**
Integrate with GA4 or Mixpanel for production analytics.

**Effort:** 4 hours

---

### KANBAN-042 | Memory Leak Prevention
**Priority:** LOW  
**Type:** Performance  
**Status:** NOT STARTED  

**Potential leaks:**
- Line 4723: `setInterval()` for transit refresh runs forever
- Line 4675: `setInterval()` for number animation could accumulate

**Fix:**
- Add cleanup on page unload/tab switch
- Use `requestAnimationFrame` instead of setInterval where appropriate

**Effort:** 2 hours

---

## Updated Priority Matrix (2026-03-09)

| ID | Item | Priority | Effort | Impact |
|----|------|----------|--------|--------|
| 006 | RAG Context Fix | HIGH→CRITICAL | Low | High — blocks AI priming recommendations |
| 037 | Coming Soon Stub Removal | HIGH | Low | High — trust/credibility issue |
| 001 | Priming Recommendations UI | HIGH | Medium | High — surfaces AI data |
| 002 | Forge Weapon/Defense UI | HIGH | Low | High — completes Forge |
| 036 | Console.log Cleanup | MEDIUM | Low | Medium — production hygiene |
| 040 | Accessibility Fixes | MEDIUM | Low | Medium — compliance |
| 038 | Error Handling Consolidation | LOW | Medium | Low — code quality |
| 039 | Form Validation Gaps | LOW | Low | Low — data quality |
| 041 | Analytics Integration | LOW | Low | Low — insights |
| 042 | Memory Leak Prevention | LOW | Low | Low — performance |

---

## Verification Notes (2026-03-09)

### ✅ CONFIRMED FIXED (from UX_DEEP_REVIEW.md)
- Testimonials replaced with value proposition banner
- Social proof shows real data or hides (no fake fallbacks)
- TYPE_EXPLANATIONS, AUTHORITY_EXPLANATIONS, STRATEGY_EXPLANATIONS implemented
- CENTER_EXPLANATIONS, CHANNEL_DESCRIPTIONS, PROFILE_EXPLANATIONS implemented
- GATE_NAMES implemented in explanations.js
- NOT_SELF_EXPLANATIONS, DEFINITION_EXPLANATIONS implemented

### ⚠️ STILL OUTSTANDING (from UX_DEEP_REVIEW.md)
- Interactive bodygraph click-to-learn not implemented
- Transit personal context (gate-specific meaning) not implemented
- Priming recommendations UI not rendered
- Forge weapon/defense/shadow UI not rendered
- RAG context missing canonical files

---

*Updated 2026-03-09: Added KANBAN-036 through KANBAN-042 from codebase audit. See IMPLEMENTATION_PLAN_2026-03-09.md for sprint planning.*
