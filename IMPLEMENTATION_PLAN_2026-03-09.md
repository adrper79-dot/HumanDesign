# Prime Self — Senior Engineering Implementation Plan

**Date:** 2026-03-09  
**Status:** DRAFT FOR REVIEW  
**Prepared by:** Engineering Team Audit  
**Scope:** Gap analysis from UX_DEEP_REVIEW.md + FUTURE_STATE_KANBAN.md + codebase verification  
**Objective:** Production-ready system with complete feature parity, code quality, and UX excellence

---

## Executive Summary

After comprehensive analysis of the UX_DEEP_REVIEW.md, FUTURE_STATE_KANBAN.md, and codebase verification, this plan outlines the remaining work required to achieve production readiness.

**Key Findings:**
- ✅ Many UX review items already addressed (explanations.js has comprehensive TYPE/AUTHORITY/STRATEGY/CENTER explanations)
- ✅ Fake testimonials replaced with value proposition banner
- ✅ Social proof now shows real data or hides (no fake fallbacks)
- ⚠️ ~35 KANBAN items NOT STARTED across UI, backend, and data integration
- ⚠️ RAG context missing critical canonical data (historical_figures, book_recommendations)
- ⚠️ Several "coming soon" stubs in production code
- ⚠️ Console.log statements need removal for production
- ⚠️ Priming recommendations and Forge Weapon/Defense UI not rendering

---

## Phase 1: Critical Backend Data Integration (Week 1)

### 1.1 RAG Context Gap — KANBAN-006 (VERIFIED CRITICAL)

**Problem:** The AI synthesis engine cannot access canonical Prime Self data because `engine-compat.js` doesn't load the required JSON files.

**Current State (workers/src/engine-compat.js):**
```javascript
// LOADED:
'prime_self/forges.json': forgesData,
'prime_self/knowledges.json': knowledgesData,
'prime_self/forge_mapping.json': forgeMappingData

// MISSING (but files exist):
// historical_figures.json    ← AI outputs primingRecommendations without this!
// book_recommendations.json  ← for book suggestions
// forges_canonical.json      ← enhanced Forge data with weapons/defenses
// knowledges_canonical.json  ← enhanced Six Knowledges
// arts_canonical.json        ← Six Arts data
// sciences_canonical.json    ← Six Sciences data
// defenses_canonical.json    ← Six Defenses data
```

**Fix Required:**
```javascript
// Add to workers/src/engine-compat.js
import historicalFigures from '../../src/knowledgebase/prime_self/historical_figures.json';
import bookRecommendations from '../../src/knowledgebase/prime_self/book_recommendations.json';
import forgesCanonical from '../../src/knowledgebase/prime_self/forges_canonical.json';
import knowledgesCanonical from '../../src/knowledgebase/prime_self/knowledges_canonical.json';
import artsCanonical from '../../src/knowledgebase/prime_self/arts_canonical.json';
import sciencesCanonical from '../../src/knowledgebase/prime_self/sciences_canonical.json';
import defensesCanonical from '../../src/knowledgebase/prime_self/defenses_canonical.json';

// Add to globalThis.__PRIME_DATA.kb object
'prime_self/historical_figures.json': historicalFigures,
'prime_self/book_recommendations.json': bookRecommendations,
'prime_self/forges_canonical.json': forgesCanonical,
'prime_self/knowledges_canonical.json': knowledgesCanonical,
'prime_self/arts_canonical.json': artsCanonical,
'prime_self/sciences_canonical.json': sciencesCanonical,
'prime_self/defenses_canonical.json': defensesCanonical,
```

**Impact:** HIGH — Without this fix, AI profile synthesis cannot output historical figures, book recommendations, or complete Forge analysis.

**Effort:** 2 hours  
**Owner:** Backend Lead  
**Verification:** Generate profile → `primingRecommendations.historicalExemplar` populated

---

### 1.2 Production Code Cleanup — NEW FINDING

**Console.log Statements (20+ instances):**
Located in frontend/index.html at lines: 1574, 1803, 1847, 1871, 2152-2173, 3948, 4139, 4417

**Fix Required:**
- Remove all `console.log` statements from production code
- Replace with conditional logging: `if (window.DEBUG) console.log(...)`
- Or remove entirely for production build

**Effort:** 1 hour  
**Owner:** Frontend Lead

---

## Phase 2: UI Feature Completeness (Week 1-2)

### 2.1 Priming Recommendations UI — KANBAN-001 (HIGH PRIORITY)

**Problem:** Schema and data exist but frontend doesn't render `primingRecommendations` from profile synthesis.

**Expected Output from AI:**
```json
{
  "primingRecommendations": {
    "historicalExemplar": {
      "name": "Marie Curie",
      "relevance": "Generator persistence...",
      "keyLesson": "Trust your sustained response...",
      "invocationContext": "When facing long-term projects..."
    },
    "alternateExemplars": ["Carl Jung", "Albert Einstein"],
    "bookRecommendations": {
      "fiction": { "title": "Siddhartha", "author": "Hermann Hesse", "relevance": "..." },
      "nonFiction": { "title": "Deep Work", "author": "Cal Newport", "relevance": "..." }
    },
    "currentKnowledgeFocus": "Knowledge of Self"
  }
}
```

**Fix Required (frontend/index.html in renderProfile()):**
```javascript
// After Quick Start Guide section (~line 2230)
if (ti?.primingRecommendations) {
  const pr = ti.primingRecommendations;
  html += `<div class="card">
    <div class="card-title"><span class="icon-book"></span> Your Priming Guide</div>`;
  
  if (pr.historicalExemplar) {
    html += `<div class="profile-section">
      <h4>Historical Exemplar</h4>
      <div class="exemplar-card">
        <div class="exemplar-name">${escapeHtml(pr.historicalExemplar.name)}</div>
        <p>${escapeHtml(pr.historicalExemplar.relevance)}</p>
        <div class="exemplar-lesson"><strong>Key Lesson:</strong> ${escapeHtml(pr.historicalExemplar.keyLesson)}</div>
        <div class="exemplar-invoke"><strong>When to invoke:</strong> ${escapeHtml(pr.historicalExemplar.invocationContext)}</div>
      </div>
    </div>`;
  }
  
  // ... book recommendations, alternate exemplars, current knowledge focus
  html += `</div>`;
}
```

**Effort:** 4 hours  
**Owner:** Frontend Lead  
**CSS Required:** New `.exemplar-card`, `.exemplar-name`, `.exemplar-lesson` styles

---

### 2.2 Forge Weapon/Defense/Shadow UI — KANBAN-002 (HIGH PRIORITY)

**Problem:** Forge section shows `primaryForge` and `confidence` but not `forgeWeapon`, `forgeDefense`, or `shadowWarning`.

**Current Render (frontend/index.html ~line 2357):**
```javascript
// Only shows:
// - primaryForge name
// - confidence level
// - indicators
```

**Fix Required:**
```javascript
// Extend Forge Identification card
if (fi.forgeWeapon) {
  html += `<div class="forge-weapon">
    <span class="icon-sword"></span> <strong>Your Weapon:</strong> ${escapeHtml(fi.forgeWeapon)}
  </div>`;
}
if (fi.forgeDefense) {
  html += `<div class="forge-defense">
    <span class="icon-shield"></span> <strong>Your Defense:</strong> ${escapeHtml(fi.forgeDefense)}
  </div>`;
}
if (fi.shadowWarning) {
  html += `<div class="forge-shadow alert-warn">
    <span class="icon-warning"></span> <strong>Shadow Warning:</strong> ${escapeHtml(fi.shadowWarning)}
  </div>`;
}
```

**Effort:** 2 hours  
**Owner:** Frontend Lead

---

### 2.3 Coming Soon Stub Cleanup — NEW FINDING

**Problem:** Production code has "Coming soon!" messages that hurt credibility.

**Locations:**
- Line 4023: `shareChartImage()` → "Chart image sharing coming soon!"
- Line 4050: `downloadChart()` → "Chart download coming soon!"
- Line 3125: Cluster synthesis → "Coming soon!"

**Fix Options:**
1. **Remove feature buttons entirely** until implemented
2. **Implement features** (share image requires Canvas rendering, estimated 8-12 hours)
3. **Update messaging** to be less jarring ("Not yet available" with expected date)

**Recommendation:** Remove buttons until features are implemented.

**Effort:** 1 hour (removal) or 12 hours (implementation)  
**Owner:** Product + Frontend

---

## Phase 3: Interactive UX Enhancements (Week 2-3)

### 3.1 Interactive Bodygraph — KANBAN-027 (HIGH VALUE)

**Current State:** Bodygraph renders via `renderBodygraph()` but lacks click interactions.

**Planned Behavior:**
- Click center → Modal with center explanation (defined vs open meaning)
- Click gate → Modal with gate name, meaning, user's line
- Click channel → Modal with both gates, circuit type, flow description

**Implementation Approach:**
```javascript
// frontend/js/bodygraph-interactions.js
function enableBodygraphInteractions(svgId, chartData) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  
  // Add click handlers to center elements
  const centerIds = ['head', 'ajna', 'throat', 'g', 'heart', 'solarplexus', 'sacral', 'spleen', 'root'];
  centerIds.forEach(id => {
    const el = svg.querySelector(`#center-${id}`);
    if (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => showCenterModal(id, chartData));
    }
  });
  
  // Add click handlers to channel lines
  chartData.activeChannels?.forEach(ch => {
    const line = svg.querySelector(`#channel-${ch.channel || ch.gates?.join('-')}`);
    if (line) {
      line.style.cursor = 'pointer';
      line.addEventListener('click', () => showChannelModal(ch, chartData));
    }
  });
}
```

**Effort:** 8-12 hours  
**Owner:** Frontend Lead  
**Dependencies:** Modal component, CENTER_EXPLANATIONS (already exists), CHANNEL_DESCRIPTIONS (already exists)

---

### 3.2 Transit Personal Context — KANBAN-028 (MEDIUM VALUE)

**Problem:** Transits show generic planet themes but not personalized gate meaning.

**Current:** "☉ Sun → your Gate 44" + generic Sun description  
**Target:** "☉ Sun → your Gate 44 (The Coming to Meet) — The collective spotlight activates YOUR pattern recognition gate..."

**Data Available:**
- `GATE_NAMES` in explanations.js ✅
- `src/data/gate_wheel.json` has gate details ✅

**Fix:** Enhance renderTransits() to include gate name and personalized context.

**Effort:** 4 hours  
**Owner:** Frontend Lead

---

### 3.3 Background Video Mobile Optimization — KANBAN-013

**Problem:** Video loads regardless of connection speed.

**Fix Required (frontend/index.html):**
```javascript
// Before video init
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const shouldLoadVideo = connection?.effectiveType === '4g' || !connection;

if (shouldLoadVideo && !document.body.classList.contains('reduce-motion')) {
  document.getElementById('bgVideo')?.play();
} else {
  // Hide video, show gradient fallback
  document.getElementById('bgVideo')?.remove();
  document.body.classList.add('bg-gradient-fallback');
}
```

**Effort:** 2 hours  
**Owner:** Frontend Lead

---

## Phase 4: UX Architecture Improvements (Week 3-4)

### 4.1 Birth Data Persistence — KANBAN-016

**Problem:** Users enter birth data 3 times (Chart, Profile, Composite tabs).

**Current State:** localStorage save/restore implemented but not auto-filling Composite forms.

**Fix Required:**
1. On chart generation → store birth data in localStorage ✅ (already done)
2. On Profile tab focus → auto-fill from localStorage ✅ (already done)
3. On Composite tab focus → auto-fill "Person A" from localStorage ❌ (needs implementation)
4. Show "Using your saved birth data" banner with "Change" link

**Effort:** 3 hours  
**Owner:** Frontend Lead

---

### 4.2 Mobile CTA Persistence — KANBAN-010

**Problem:** "Generate Chart" CTA disappears when scrolling on mobile.

**Fix Required (frontend/css/components/mobile.css):**
```css
@media (max-width: 768px) {
  .sticky-chart-cta {
    position: sticky;
    bottom: 84px; /* Above mobile nav (60px) + padding */
    z-index: var(--z-dropdown);
    width: 100%;
    padding: var(--space-2);
    background: var(--bg-elevated);
    box-shadow: var(--shadow-lg);
    display: none; /* Show only when form not visible */
  }
  
  .sticky-chart-cta.visible {
    display: block;
  }
}
```

**JavaScript:** IntersectionObserver to detect when form is out of viewport.

**Effort:** 3 hours  
**Owner:** Frontend Lead

---

### 4.3 SMS Opt-In UI — KANBAN-021

**Problem:** Backend SMS digest implemented but no frontend UI to enable it.

**Backend Status:** `workers/src/cron.js` has `sendSMSDigests()` that queries `sms_enabled` column.

**Frontend Missing:**
- Phone number input with validation
- SMS verification flow
- Toggle to enable/disable digests
- Preview of what the SMS will contain

**Effort:** 8 hours  
**Owner:** Full Stack

---

## Phase 5: Quality & Polish (Week 4+)

### 5.1 Error Handling Consolidation — NEW FINDING

**Problem:** 4 different patterns for showing errors (alert(), showAlert(), showEnhanceStatus(), innerHTML).

**Fix:** Consolidate to single `showNotification(message, type)` function.

**Effort:** 4 hours  
**Owner:** Frontend Lead

---

### 5.2 Form Validation Gaps — NEW FINDING

**Missing Validation:**
- SMS phone input: No international format pattern
- Cluster name: No min/max length
- Diary title: No max length

**Fix:** Add HTML5 validation patterns and JavaScript validation.

**Effort:** 2 hours  
**Owner:** Frontend Lead

---

### 5.3 Accessibility Fixes — NEW FINDINGS

| Issue | Location | Fix |
|-------|----------|-----|
| Video without text alternative | Background video | Add aria-hidden="true" + descriptive fallback text |
| Missing focus indicators | Dynamic pill badges | Add :focus-visible styles to .pill class |
| Color-only natal hit indicator | Transit gates | Add icon (★) alongside gold color |
| Hidden content focusable | Tab panels | Add tabindex="-1" to display:none panels |

**Effort:** 4 hours  
**Owner:** Frontend Lead

---

### 5.4 Skeleton Loading States — KANBAN-032

**Problem:** Generic spinners instead of skeleton screens for loading states.

**Priority:** LOW (nice-to-have polish)

**Implementation:** Create skeleton CSS classes matching content shape, show during API calls.

**Effort:** 6 hours  
**Owner:** Frontend Lead

---

## Priority Matrix Summary

| Priority | Items | Total Effort | Sprint |
|----------|-------|--------------|--------|
| 🔴 CRITICAL | RAG Context Fix, Console.log cleanup | 3 hours | Sprint 19.1 |
| 🟠 HIGH | Priming UI, Forge Weapon/Defense UI, Coming Soon stubs | 8 hours | Sprint 19.2 |
| 🟡 MEDIUM | Interactive bodygraph, Transit context, Birth data persistence, Mobile CTA, SMS UI | 28 hours | Sprint 19-20 |
| 🟢 LOW | Error consolidation, Form validation, Accessibility, Skeleton loading | 16 hours | Sprint 20-21 |

---

## Sprint 19 Recommended Scope

**Duration:** 2 weeks  
**Theme:** Data Integration + Critical UI Gaps

### Sprint 19.1 (Days 1-3)
1. ✅ RAG Context Fix (engine-compat.js) — 2 hours
2. ✅ Console.log cleanup — 1 hour
3. ✅ Coming Soon stub removal — 1 hour

### Sprint 19.2 (Days 4-10)
4. ✅ Priming Recommendations UI — 4 hours
5. ✅ Forge Weapon/Defense/Shadow UI — 2 hours
6. ✅ Transit Personal Context — 4 hours
7. ✅ Birth Data Auto-Fill Composite — 3 hours

### Sprint 19.3 (Days 11-14)
8. ✅ Mobile CTA Persistence — 3 hours
9. ✅ Background Video Mobile Opt — 2 hours
10. ✅ Error Handling Consolidation — 4 hours

**Total Sprint 19 Effort:** ~26 hours (comfortable 2-week sprint for 1 engineer)

---

## Sprint 20 Recommended Scope

**Duration:** 2 weeks  
**Theme:** Interactivity + Polish

1. Interactive Bodygraph — 12 hours
2. SMS Opt-In UI — 8 hours
3. Form Validation Gaps — 2 hours
4. Accessibility Fixes — 4 hours
5. Skeleton Loading States — 6 hours

**Total Sprint 20 Effort:** ~32 hours

---

## Verification Checklist

Before declaring production-ready:

- [ ] All console.log statements removed
- [ ] No "Coming soon" messages in production
- [ ] RAG context includes all canonical data
- [ ] Priming recommendations render in profile
- [ ] Forge weapon/defense/shadow render in profile
- [ ] Transits show personalized gate meaning
- [ ] Birth data auto-fills across all forms
- [ ] Mobile CTA visible when scrolling
- [ ] Background video conditional on connection speed
- [ ] Error handling uses single pattern
- [ ] All form inputs validated
- [ ] Accessibility audit passes (aXe DevTools)
- [ ] No TypeScript/ESLint errors in Workers build
- [ ] Test suite passes (207/207)
- [ ] Staging deployment verified
- [ ] Production deployment successful

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| RAG context fix breaks synthesis | Low | High | Test with specific prompts before deploy |
| Interactive bodygraph causes performance issues | Medium | Medium | Lazy-load interactions after render |
| Mobile video detection unreliable | Medium | Low | Fallback to always-off on unknown connection |
| SMS verification flow complexity | Medium | Medium | Start with manual verification, automate later |

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Profile completion includes priming data | 0% | 90%+ | Check for historicalExemplar in profiles |
| Transit personalization | Generic | Gate-specific | User feedback, time on transits tab |
| Mobile bounce rate | Unknown | <40% | Analytics (when implemented) |
| Form validation errors | Unknown | <5% | Error tracking |
| Accessibility score | Unknown | 90+ | aXe DevTools |

---

*This plan prioritizes the highest-impact, lowest-effort items first while maintaining a clear path to full feature completeness. Each phase builds on the previous, ensuring stable incremental progress.*

