# Accessibility Audit — WCAG 2.1 AA Compliance
**Date:** 2026-03-18
**Status:** Assessment & Remediation Planning
**Target:** WCAG 2.1 Level AA compliance

---

## Executive Summary

Prime Self frontend has **8 open accessibility issues** blocking WCAG 2.1 AA compliance. These issues affect:
- **Modal dialogs** (semantic roles, focus management)
- **Form inputs** (accessible labels, descriptions)
- **Content updates** (live region announcements)
- **Heading structure** (hierarchical flow)
- **Color contrast** (visual sufficiency)
- **Touch targets** (mobile usability)
- **Keyboard navigation** (skip links, overflow indicators)

**Total Effort:** 8-12 hours
**Priority:** Post-launch Phase 2, before public beta

---

## Issue Breakdown

### 🔴 P2 — High Priority (6 issues, 6-8 hours)

#### 1. ACC-P2-2: Modal Dialogs Missing ARIA Semantics
**File:** `frontend/js/modal.js`, `frontend/index.html`
**Impact:** Screen readers cannot identify dialogs or manage focus trap

**Current State:**
```html
<div id="profile-modal" style="...">  <!-- No role -->
  <div class="modal-panel">           <!-- No semantics -->
    <h2>Profile Settings</h2>
    ...
  </div>
</div>
```

**Fix (30 min per modal, ~6 modals):**
```html
<div id="profile-modal" role="dialog" aria-labelledby="profile-modal-title" aria-modal="true">
  <div class="modal-panel">
    <h2 id="profile-modal-title">Profile Settings</h2>
    <!-- Focus trap: first focusable ↔ last focusable -->
    ...
  </div>
</div>
```

**Action Items:**
- [ ] Add `role="dialog"` to all modal containers
- [ ] Add `aria-labelledby` pointing to heading
- [ ] Add `aria-modal="true"`
- [ ] Implement focus trap (first/last focusable elements wrap)
- [ ] Restore focus on close
- [ ] Test with NVDA, JAWS

**Checklist:** Practitioner directory modal, profile modal, check-in editor, etc.

---

#### 2. ACC-P2-3: Form Inputs Lack aria-labels
**File:** `frontend/index.html`, `frontend/js/app.js`
**Impact:** Screen reader users cannot understand input purpose

**Current State:**
```html
<label style="display:block;...">Your name</label>  <!-- Label visually hidden by style -->
<input type="text" placeholder="e.g. Jana Moreau" />  <!-- No connection to label -->
```

**Fix (15 min per input, ~30 inputs):**
```html
<label for="practitioner-name" style="display:block;...">Your name</label>
<input id="practitioner-name" type="text" placeholder="e.g. Jana Moreau"
       aria-label="Your full name or practice name" />
<!-- OR for hidden labels: -->
<input type="text" aria-label="Your name" placeholder="..." />
```

**Action Items:**
- [ ] Audit all `<input>`, `<textarea>`, `<select>` elements
- [ ] Either use `<label>` with `for=` OR `aria-label`
- [ ] Add `aria-required` for mandatory fields
- [ ] Add `aria-describedby` for validation error messages
- [ ] Test with screen readers in form submission flow

**Files to Update:**
- `frontend/index.html` — onboarding forms, profile forms
- `frontend/js/app.js` — dynamically rendered forms

---

#### 3. ACC-P2-4: Dynamic Content Updates Lack aria-live Announcements
**File:** `frontend/js/app.js` (notification system, roster updates)
**Impact:** Screen reader users miss status changes, achievements, roster updates

**Current State:**
```javascript
// When roster updates:
const rosterDiv = document.getElementById('cluster-roster');
rosterDiv.innerHTML = newRosterHTML;  // Screen reader doesn't know to announce
```

**Fix (20 min per update location, ~4 locations):**
```html
<!-- Add aria-live containers to page: -->
<div role="status" aria-live="polite" aria-atomic="true" id="roster-update-region"></div>
<div role="alert" aria-live="assertive" id="validation-error-region"></div>

<!-- JS updates: -->
const rosterRegion = document.getElementById('roster-update-region');
rosterRegion.textContent = 'Roster updated: 3 members now active';
```

**Action Items:**
- [ ] Add `<div role="status" aria-live="polite">` containers for notifications
- [ ] Add `<div role="alert" aria-live="assertive">` for errors
- [ ] Update JS: push new content to these regions, not to silent DOM areas
- [ ] Locations: achievements unlocked, roster changes, check-in saved, synthesis complete

**Pattern:**
```javascript
// Instead of: DOM.innerHTML = content
// Do this:
const announceRegion = document.getElementById('announce');
announceRegion.textContent = 'Achievement unlocked: First Chart';
```

---

#### 4. ACC-P2-5: Heading Hierarchy Broken (h3 → h5 jumps)
**File:** `frontend/index.html`, `frontend/js/app.js`
**Impact:** Screen reader users lose document structure, headings don't form outline

**Current State:**
```html
<section id="profile-tab">
  <h2>Profile</h2>  <!-- Tab heading -->
  <h3>Key Insights</h3>  <!-- OK -->
  <div class="insight-box">
    <h5>Authority</h5>  <!-- ❌ Jump from h3 → h5 -->
  </div>
</section>
```

**Fix (15 min audit + 10 min per section):**
```html
<h2>Profile</h2>
<h3>Key Insights</h3>
  <h4>Authority</h4>  <!-- Sequential: h3 → h4 ✅ -->
  <h4>Strategy</h4>
  <h4>Profile Line</h4>
```

**Action Items:**
- [ ] Audit all pages: run heading outline in DevTools (F12 → Accessibility)
- [ ] Fix jumps: use CSS classes for visual styling, not wrong heading levels
  - `<h5 class="heading-level-4">Authority</h5>` uses CSS to style h5 as appearance of h4
  - OR use correct `<h4>` tags
- [ ] Test with screen reader heading list navigation
- [ ] Common problem areas: modal titles, tabs, cards, insight boxes

---

#### 5. ACC-P2-6: Help Icons Use title= (should use aria-describedby)
**File:** `frontend/index.html`, `frontend/js/app.js`
**Impact:** Screen readers don't announce help text; `title=` only shows on hover (keyboard users miss it)

**Current State:**
```html
<h4>Purpose Vector
  <span class="icon-info help-icon" title="Your purpose emerges from Frequency Keys..."></span>
</h4>
```

**Fix (5 min per help icon, ~15 help icons):**
```html
<div id="pv-help-text" class="help-text" hidden>
  Your purpose emerges from your 4 main Frequency Keys activations...
</div>

<h4>Purpose Vector
  <span class="icon-info help-icon" aria-describedby="pv-help-text"
        aria-expanded="false" role="button" tabindex="0"></span>
</h4>

<!-- JS: toggle aria-expanded on click/enter -->
```

**Action Items:**
- [ ] Find all `<span class="help-icon" title="...">`
- [ ] Create matching `<div id="...">` with description content
- [ ] Add `aria-describedby` to icon span
- [ ] Make icon keyboard-interactive: `role="button"`, `tabindex="0"`
- [ ] Show/hide help text on click or on hover+focus
- [ ] Update aria-expanded when shown/hidden

---

#### 6. ACC-P2-7: Color Contrast Too Low in Chart Legend
**File:** `frontend/css/app.css`, `frontend/js/bodygraph.js`
**Impact:** Low vision users cannot distinguish chart elements

**Current State:**
```css
.gate-label {
  color: #666;  /* 2.5:1 contrast on white — BELOW AA 4.5:1 */
  font-size: 0.75rem;
}
```

**Fix (10 min audit + 5 min per element):**
```css
.gate-label {
  color: #333;  /* Darken: 4.8:1 contrast on white — MEETS AA ✅ */
  font-size: 0.75rem;  /* Keep readable */
}

/* Or for small text (< 18px): need 3:1 ratio */
.small-text {
  color: #666;  /* 2.5:1 works for small text if >= 18px */
  font-size: 14px;  /* Not small enough — needs darker */
}
```

**Action Items:**
- [ ] Run axe DevTools or WebAIM contrast checker on every page
- [ ] Identify all text < WCAG AA 4.5:1 (7:1 for AAA)
- [ ] Darken text OR lighten background
- [ ] Test with color-blind simulator (Chrome DevTools)
- [ ] Common areas: legend, labels, hints, disabled buttons

**Resources:**
- WebAIM: https://webaim.org/resources/contrastchecker/
- axe DevTools Chrome extension

---

#### 7. ACC-P2-8: Touch Targets Below 44×44px
**File:** `frontend/css/app.css`
**Impact:** Mobile users with low dexterity cannot tap small buttons

**Current State:**
```css
.icon-button {
  width: 20px;
  height: 20px;  /* Too small */
  padding: 2px;
}
```

**Fix (5 min audit + 10 min per component):**
```css
.icon-button {
  min-width: 44px;
  min-height: 44px;
  padding: 10px;  /* Use padding, not fixed dimensions */
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Icon inside can stay 20×20, button wrapper is 44×44 */
.icon-button svg {
  width: 20px;
  height: 20px;
}
```

**Action Items:**
- [ ] Audit all interactive elements: buttons, links, icon buttons, close buttons
- [ ] Ensure minimum 44×44px touch target (WCAG 2.1 Level AAA)
- [ ] Use padding to scale targets without stretching content
- [ ] Test on real mobile device: can thumb-tap each button?
- [ ] Check: form inputs, close buttons, navigation icons, checkboxes

---

### ⚪ P3 — Lower Priority (2 issues, 1-2 hours)

#### 8. ACC-P3-1: No Skip Link for Keyboard Users
**File:** `frontend/index.html`
**Impact:** Keyboard-only users tab through logo/nav before reaching main content

**Fix (20 min):**
```html
<a href="#main-content" class="skip-link">Skip to main content</a>

<style>
.skip-link {
  position: absolute;
  left: -999px;
  z-index: 999;
}

.skip-link:focus {
  left: 0;
  top: 0;
  background: var(--accent);
  color: white;
  padding: 8px 16px;
}
</style>

<main id="main-content">
  <!-- Main content here -->
</main>
```

---

#### 9. ACC-P3-2: Tab Scroll Has No Overflow Indicator
**File:** `frontend/js/chart.js`, `frontend/css/app.css`
**Impact:** Keyboard users don't know more tabs exist beyond screen edge

**Fix (30 min):**
```css
.tab-scroll-container {
  overflow-x: auto;
  position: relative;
}

.tab-scroll-container::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 20px;
  background: linear-gradient(to right, transparent, rgba(0,0,0,0.1));
  pointer-events: none;
}
```

**Or with buttons:**
```html
<button class="tab-scroll-left" aria-label="Scroll tabs left">←</button>
<div class="tab-container" id="tabs"></div>
<button class="tab-scroll-right" aria-label="Scroll tabs right">→</button>
```

---

## Implementation Roadmap

### Week 1: Foundation (4 hours)
- [ ] ACC-P2-2: Add modal ARIA semantics + focus trap
- [ ] ACC-P2-3: Link all form inputs with labels
- [ ] ACC-P3-1: Add skip link

### Week 2: Interactivity (3 hours)
- [ ] ACC-P2-4: Add aria-live regions for updates
- [ ] ACC-P2-6: Convert help icons to aria-describedby
- [ ] ACC-P3-2: Add tab overflow indicator

### Week 3: Polish (2 hours)
- [ ] ACC-P2-5: Fix heading hierarchy
- [ ] ACC-P2-7: Fix color contrast
- [ ] ACC-P2-8: Increase touch targets to 44×44px

### Week 4: Testing (2 hours)
- [ ] Full audit with axe DevTools
- [ ] Test with NVDA (Windows screen reader)
- [ ] Test with JAWS (if available)
- [ ] Keyboard-only navigation (Tab, Shift+Tab, Enter, Escape)
- [ ] Mobile touch targets on real device

---

## Testing Checklist

**Automated Tools:**
- [ ] axe DevTools (Chrome extension)
- [ ] WebAIM Color Contrast Checker
- [ ] WAVE (WebAIM Web Accessibility Evaluation Tool)

**Manual Testing:**
- [ ] Navigate entire site using only keyboard (no mouse)
- [ ] Navigate using screen reader (NVDA, JAWS, or VoiceOver)
- [ ] Check tab order is logical
- [ ] Check focus is always visible
- [ ] Verify all modals have proper focus trap

**Mobile Testing:**
- [ ] Test touch targets with thumb on real phone
- [ ] Test with screen reader enabled (iOS VoiceOver, Android TalkBack)

---

## Reference: WCAG 2.1 AA Success Criteria

| Criterion | Issue | Required Fix |
|-----------|-------|--------------|
| **1.4.3** Color Contrast | ACC-P2-7 | 4.5:1 for normal text |
| **2.1.1** Keyboard | All | All interactive elements keyboard accessible |
| **2.4.1** Bypass Blocks | ACC-P3-1 | Skip links |
| **2.4.3** Focus Order | ACC-P2-2 | Logical, visible focus |
| **2.4.7** Visible Focus | ACC-P2-3 | Outline always visible |
| **3.2.4** Consistent Identification | ACC-P2-6 | Help text consistently presented |
| **3.3.1** Error Labels | ACC-P2-4 | All form errors announced |
| **3.3.2** Labels | ACC-P2-3 | All inputs have labels |
| **4.1.2** Name/Role/Value | ACC-P2-2 | Modal semantics correct |

---

## Success Criteria (Post-Implementation)

- [ ] axe DevTools scan: **0 violations**
- [ ] WAVE scan: **0 errors, ≤ 2 warnings**
- [ ] Keyboard navigation fully functional
- [ ] Screen reader announces all content
- [ ] Color contrast ≥ 4.5:1 (or 3:1 for large text)
- [ ] Touch targets ≥ 44×44px
- [ ] All modals have proper focus management

---

**Assigned to:** Product team
**Estimated completion:** Phase 2 (post-launch, ~2 weeks effort)
**Compliance target:** WCAG 2.1 Level AA ✅
