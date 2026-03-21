# Implementation Guide — WC-002: Full WCAG 2.1 AA Accessibility

**Status:** Implementation Guide (Ready to Execute)  
**Effort:** 2-3 days  
**Owner:** Frontend Engineer  
**Priority:** P1

---

## Overview

The application needs a complete WCAG 2.1 Level AA accessibility skeleton including ARIA roles, landmarks, semantic HTML, keyboard navigation, and screen reader optimization. This affects all major UI components and requires both markup and scripting changes.

---

## Component-by-Component Checklist

###1. **Navigation & Tab System**

**Current State:**
- Tabs implemented as divs with JS event handlers
- No `role="tablist"` or semantic tab roles
- No keyboard navigation (arrow keys, Home, End)
- Focus not managed; tab order not maintained

**Required Changes:**

```html
<!-- FROM: <div id="tabs"> -->
<!-- TO: -->
<nav aria-label="Main content tabs" role="tablist">
  <button role="tab" 
          id="tab-chart" 
          aria-selected="true" 
          aria-controls="panel-chart"
          data-tab="chart">
    Chart
  </button>
  <button role="tab" 
          aria-selected="false" 
          aria-controls="panel-profile">
    Profile
  </button>
</nav>

<div id="panel-chart" 
     role="tabpanel" 
     aria-labelledby="tab-chart"
     tabindex="-1">
  <!-- content -->
</div>
```

**JavaScript Keyboard Handling:**
```javascript
// In frontendjs/app.js or new accessibility-helpers.js module
function setupTabKeyboardNav(tablist) {
  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
  
  tablist.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    
    e.preventDefault();
    const currentIndex = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
    let nextIndex;
    
    if (e.key === 'ArrowLeft' || e.key === 'Home') {
      nextIndex = e.key === 'Home' ? 0 : (currentIndex - 1 + tabs.length) % tabs.length;
    } else {
      nextIndex = e.key === 'End' ? tabs.length - 1 : (currentIndex + 1) % tabs.length;
    }
    
    // Deactivate current, activate next
    tabs[currentIndex].setAttribute('aria-selected', 'false');
    tabs[nextIndex].setAttribute('aria-selected', 'true');
    tabs[nextIndex].focus();
    
    // Show corresponding panel
    const panelId = tabs[nextIndex].getAttribute('aria-controls');
    document.getElementById(panelId).style.display = 'block';
  });
}
```

**Files to Update:**
- [frontend/index.html](frontend/index.html) — add nav landmarks
- [frontend/js/app.js](frontend/js/app.js#L288-L600) — add keyboard event handlers to tab switching
- [frontend/css/components/tabs.css](frontend/css/components/tabs.css) — add focus styles

---

### 2. **Modal Dialogs & Overlays**

**Current State:**
- Modals are divs with click handlers on overlay
- No `role="dialog"` or `aria-modal="true"`
- No focus trapping (keyboard focus can escape)
- No escape key handling

**Required Changes:**

```html
<!-- Update .auth-overlay -->
<div id="auth-modal"
     role="dialog"
     aria-modal="true"
     aria-labelledby="auth-title"
     class="auth-overlay">
  <div class="auth-box">
    <h2 id="auth-title">Sign In</h2>
    <!-- form content -->
  </div>
</div>
```

**JavaScript Focus Trap:**
```javascript
function setupModalFocusTrap(modal) {
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  });
  
  // Also handle Escape key
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(modal);
    }
  });
}
```

**Files to Update:**
- [frontend/js/app.js](frontend/js/app.js#L946-L1200) — auth overlay modal handling
- [frontend/css/app.css](frontend/css/app.css#L270-L290) — modal focus styles

---

### 3. **Form Labels & Inputs**

**Current State:**
- Input fields exist but many lack explicit `<label>` associations
- No `aria-required`, `aria-invalid`, or `aria-describedby` attributes
- Error messages not linked to fields

**Required Changes:**

```html
<!-- FROM: -->
<input type="email" placeholder="Email" class="auth-input">
<span class="error-msg">Invalid email</span>

<!-- TO: -->
<label for="email-input">Email Address</label>
<input type="email" 
       id="email-input"
       aria-required="true"
       aria-describedby="email-error"
       aria-invalid="false"
       class="auth-input">
<span id="email-error" role="alert" class="error-msg">Invalid email format</span>
```

**Search for & Update:**
- [frontend/js/app.js](frontend/js/app.js#L250-L280) — form building code
- [frontend/css/app.css](frontend/css/app.css#L260-L300) — label styling

---

### 4. **Landmark Regions & Skip Links**

**Current State:**
- No `<header>`, `<main>`, `<footer>` semantic landmarks
- No skip-to-content link for keyboard users

**Required Changes:**

```html
<!-- Add to top of body -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<header role="banner">
  <nav aria-label="Primary navigation">
    <!-- nav items -->
  </nav>
</header>

<main id="main-content" role="main">
  <!-- page content -->
</main>

<footer role="contentinfo">
  <!-- footer content -->
</footer>
```

**CSS for Skip Link:**
```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #c9a84c;
  color: #000;
  padding: 8px;
  z-index: 100;
  text-decoration: none;
}

.skip-link:focus {
  top: 0;
}
```

**Files to Update:**
- [frontend/index.html](frontend/index.html) — add skip link + semantic tags

---

### 5. **Screen Reader Text & Icon Alternatives**

**Current State:**
- Icons without alt text or aria-labels
- Status messages not announced to screen readers
- Chart visualization not described

**Required Changes:**

```html
<!-- Icon buttons -->
<button aria-label="Open settings" class="icon-btn">
  <svg aria-hidden="true"><!-- icon svg --></svg>
</button>

<!-- SVG with description -->
<svg role="img" aria-label="Your energy chart for today">
  <title>Birth Chart</title>
  <desc>Visualization of celestial positions...</desc>
  <!-- chart content -->
</svg>

<!-- Status messages -->
<div role="status" aria-live="polite" aria-atomic="true">
  Chart loaded successfully
</div>
```

**Files to Update:**
- [frontend/js/app.js](frontend/js/app.js) — add aria-labels to icon buttons
- [frontend/index.html](frontend/index.html) — SVG descriptions

---

### 6. **Touch Targets & Interactive Element Size**

**Current State:**
- Some buttons and links may be <44px minimum touch target

**Required Changes:**

```css
/* Ensure all interactive elements meet 44x44px minimum */
button, a, input[type="checkbox"] {
  min-height: 44px;
  min-width: 44px;
  padding: 8px 16px;  /* increase as needed */
}

/* Mobile: all buttons full-width or spaced adequately */
@media (max-width: 640px) {
  button, .btn {
    min-height: 48px;
  }
}
```

---

### 7. **Text Contrast Review**

Already addressed in GAP-003 (completed). Verify:
- All text meets 4.5:1 contrast (normal text) and 3:1 (large text)
- Links are distinguished (no color-only distinction)

---

## Testing Protocol

### Automated Testing
```bash
# 1. Install axe DevTools extension (or axe-core in tests)
npm install --save-dev @axe-core/react

# 2. Add accessibility test file
```

### Manual Testing
1. **Keyboard Navigation:** Tab through entire UI, verify logical tab order
2. **Screen Reader:** Use NVDA (Windows), JAWS, or VoiceOver (Mac)
   - Verify all form labels announced
   - Verify landmarks & navigation announced
   - Verify chart description readable
3. **Color Contrast:** Use WAVE, Lighthouse, or contrast checker
4. **Touch/Mobile:** Verify 44px+ touch targets

### Lighthouse Audit
```bash
npm run test:prod:smoke  # includes Lighthouse accessibility score
```

---

## Implementation Order

**Day 1: Markup Changes**
1. Add semantic HTML (`<header>`, `<main>`, `<footer>`)
2. Add skip link
3. Add ARIA labels & descriptions to existing elements
4. Update form inputs with labels & aria attributes

**Day 2: Interaction Changes**
1. Add keyboard handlers to tabs, modals, menus
2. Add focus trapping to modals
3. Add escape key handling
4. Update touch target sizes in CSS

**Day 3: Testing & Review**
1. Manual keyboard navigation testing
2. Screen reader testing with NVDA/VoiceOver
3. Lighthouse accessibility audit (target: 90+)
4. Fix any contrast issues (GAP-003 should help)

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| [frontend/index.html](frontend/index.html) | Skip link, semantic tags, ARIA | P1 |
| [frontend/css/app.css](frontend/css/app.css) | Touch targets, focus styles | P2 |
| [frontend/css/components/tabs.css](frontend/css/components/tabs.css) | Tab focus states | P2 |
| [frontend/js/app.js](frontend/js/app.js) | Keyboard nav, focus mgmt | P1 |
| [frontend/js/accessibility-helpers.js](frontend/js/accessibility-helpers.js) | NEW: Reusable a11y functions | P2 |

---

## Success Criteria

- [ ] All interactive elements keyboard-navigable
- [ ] All form inputs have associated labels
- [ ] All images/icons have alt text or aria-label
- [ ] Modal focus trap working (can't tab outside)
- [ ] Escape key closes modals
- [ ] Tab order logical & visible
- [ ] Screen reader announces: landmarks, tab roles, form requirements, alerts
- [ ] Lighthouse accessibility score ≥90
- [ ] WCAG 2.1 AA Level compliance verified with axe DevTools

---

## Estimated Timeline

- **Development:** 2-3 days
- **Testing:** 1 day (concurrent with dev)
- **Fixes:** 1 day
- **Total:** 3-4 calendar days
