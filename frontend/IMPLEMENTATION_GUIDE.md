# Implementation Guide - Migrating to the New Design System

**Date**: March 4, 2026  
**Goal**: Gradually migrate from the monolithic `index.html` to the new component-based architecture

---

## 📋 Migration Strategy

### Phase 1: CSS Migration (Week 1) ✅ COMPLETE

**Status**: Design system created  
**Next**: Integrate into HTML

1. ✅ Design tokens created (`design-tokens.css`)
2. ✅ Base styles created (`base.css`)
3. ✅ Component styles created (buttons, cards, forms, etc.)
4. ✅ Master file created (`prime-self.css`)

### Phase 2: HTML Integration (Week 2)

**Goal**: Update `index.html` to use new CSS without breaking functionality

#### Step 1: Add CSS Links

Replace inline `<style>` block with:

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prime Self — Energy Blueprint & Astrology</title>
  
  <!-- NEW: Design System -->
  <link rel="stylesheet" href="css/prime-self.css">
  
  <!-- Keep existing favicon -->
  <link rel="icon" href="...">
</head>
```

#### Step 2: Update Header HTML

**Before:**
```html
<header>
  <div class="logo">✦ Prime Self <span>Energy Blueprint + Astrology</span></div>
  <div class="auth-bar">...</div>
</header>
```

**After:**
```html
<header class="site-header">
  <a href="/" class="site-logo">
    <span class="logo-icon">✦</span>
    <div class="logo-text">
      <span>Prime Self</span>
      <span class="logo-subtitle">Energy Blueprint + Astrology</span>
    </div>
    <span class="logo-version">v3.0</span>
  </a>
  
  <div class="auth-bar">
    <div class="auth-status" id="authStatusText">Not signed in</div>
    <button class="btn btn-secondary btn-sm" id="authBtn" onclick="openAuthOverlay()">
      Sign In
    </button>
    <button class="btn btn-danger btn-sm" id="logoutBtn" style="display:none" onclick="logout()">
      Sign Out
    </button>
  </div>
</header>
```

#### Step 3: Add Skip Link (Accessibility)

Add immediately after `<body>`:

```html
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  
  <!-- Rest of page -->
</body>
```

#### Step 4: Update Tabs with ARIA

**Before:**
```html
<div class="tabs">
  <button class="tab-btn active" onclick="switchTab('chart', this)">
    ⊕ Chart Calculator
  </button>
</div>
```

**After:**
```html
<nav class="tabs" role="tablist" aria-label="Main navigation">
  <div class="tab-list">
    <button 
      role="tab"
      aria-selected="true"
      aria-controls="panel-chart"
      id="tab-chart"
      class="tab-btn active"
      onclick="switchTab('chart', this)"
    >
      <span class="tab-icon">⊕</span>
      Chart Calculator
      <span class="help-icon" aria-label="Help" title="Generate your personal Energy Blueprint"></span>
    </button>
    <!-- Repeat for other tabs -->
  </div>
</nav>
```

#### Step 5: Update Tab Panels

**Before:**
```html
<div class="tab-content active" id="tab-chart">
  <!-- content -->
</div>
```

**After:**
```html
<main id="main-content" class="site-main">
  <div class="container">
    
    <div 
      role="tabpanel"
      id="panel-chart"
      aria-labelledby="tab-chart"
      class="tab-panel active"
    >
      <!-- content -->
    </div>
    
  </div>
</main>
```

#### Step 6: Update Modal

**Before:**
```html
<div class="auth-overlay hidden" id="authOverlay">
  <div class="auth-box">
    <h2 id="authTitle">Sign In</h2>
    <!-- content -->
  </div>
</div>
```

**After:**
```html
<div 
  class="modal-overlay" 
  id="authOverlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="authTitle"
  aria-hidden="true"
>
  <div class="modal modal-sm">
    <div class="modal-header">
      <div>
        <h2 id="authTitle" class="modal-title">Sign In</h2>
        <p class="modal-subtitle">Access your Prime Self profile</p>
      </div>
      <button 
        class="modal-close" 
        onclick="closeAuthOverlay()"
        aria-label="Close dialog"
      >
        ×
      </button>
    </div>
    
    <div class="modal-body">
      <form onsubmit="submitAuth(); return false;">
        <!-- form fields -->
      </form>
    </div>
  </div>
</div>
```

#### Step 7: Update Forms

**Before:**
```html
<div class="form-group">
  <label>Birth Date</label>
  <input type="date" id="c-date" value="1990-06-15">
</div>
```

**After:**
```html
<div class="form-group">
  <label for="c-date">Birth Date</label>
  <input 
    type="date" 
    id="c-date" 
    value="1990-06-15"
    autocomplete="bday"
    aria-required="true"
  >
</div>
```

#### Step 8: Update Help Icons

**Before:**
```html
<span class="help-icon" title="Help text">ⓘ</span>
```

**After:**
```html
<span class="tooltip">
  <span class="help-icon" aria-label="Help"></span>
  <span class="tooltip-content" role="tooltip">
    Help text goes here
  </span>
</span>
```

### Phase 3: JavaScript Refactoring (Week 3)

#### Current State
All JavaScript is inline in `<script>` tag in HTML.

#### Target State
Modular ES6 modules in separate files.

**File Structure:**
```
js/
├── app.js                  # Main entry point
├── config.js               # API endpoint, constants
├── utils/
│   ├── api.js              # API fetch wrapper
│   └── validation.js       # Form validation
├── components/
│   ├── tabs.js             # Tab component
│   ├── modal.js            # Modal with focus trap
│   └── auth.js             # Authentication
└── features/
    ├── chart.js            # Chart calculator
    ├── profile.js          # Profile generation
    └── transits.js         # Transit display
```

**Example: `js/components/tabs.js`**

```javascript
/**
 * Accessible Tab Component
 * Implements ARIA Authoring Practices for tabs
 */

export class TabComponent {
  constructor(containerSelector, options = {}) {
    this.container = document.querySelector(containerSelector);
    this.tabs = this.container.querySelectorAll('[role="tab"]');
    this.panels = this.container.querySelectorAll('[role="tabpanel"]');
    this.onChange = options.onChange || (() => {});
    
    this.init();
  }
  
  init() {
    this.tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => this.switchTab(index));
      tab.addEventListener('keydown', (e) => this.handleKeydown(e, index));
    });
  }
  
  switchTab(index) {
    // Deactivate all tabs
    this.tabs.forEach(tab => {
      tab.setAttribute('aria-selected', 'false');
      tab.classList.remove('active');
    });
    
    // Hide all panels
    this.panels.forEach(panel => {
      panel.setAttribute('aria-hidden', 'true');
      panel.classList.remove('active');
    });
    
    // Activate selected tab and panel
    const activeTab = this.tabs[index];
    const activePanel = this.panels[index];
    
    activeTab.setAttribute('aria-selected', 'true');
    activeTab.classList.add('active');
    
    activePanel.setAttribute('aria-hidden', 'false');
    activePanel.classList.add('active');
    
    // Focus the tab
    activeTab.focus();
    
    // Callback
    this.onChange(activePanel.id);
  }
  
  handleKeydown(event, currentIndex) {
    let newIndex = currentIndex;
    
    switch(event.key) {
      case 'ArrowLeft':
        newIndex = currentIndex === 0 ? this.tabs.length - 1 : currentIndex - 1;
        break;
      case 'ArrowRight':
        newIndex = currentIndex === this.tabs.length - 1 ? 0 : currentIndex + 1;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = this.tabs.length - 1;
        break;
      default:
        return;
    }
    
    event.preventDefault();
    this.switchTab(newIndex);
  }
}
```

**Example: `js/components/modal.js`**

```javascript
/**
 * Accessible Modal Component with Focus Trap
 */

export class Modal {
  constructor(modalId) {
    this.modal = document.getElementById(modalId);
    this.overlay = this.modal?.closest('.modal-overlay');
    this.closeButtons = this.modal?.querySelectorAll('[data-close-modal]');
    this.focusableElements = null;
    this.firstFocusable = null;
    this.lastFocusable = null;
    
    this.init();
  }
  
  init() {
    if (!this.modal) return;
    
    // Close button handlers
    this.closeButtons?.forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
    
    // Close on overlay click
    this.overlay?.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }
  
  open() {
    this.overlay?.setAttribute('aria-hidden', 'false');
    this.overlay?.classList.remove('hidden');
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Set up focus trap
    this.setupFocusTrap();
    
    // Focus first element
    this.firstFocusable?.focus();
  }
  
  close() {
    this.overlay?.setAttribute('aria-hidden', 'true');
    this.overlay?.classList.add('hidden');
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Return focus to trigger element
    this.returnFocus();
  }
  
  isOpen() {
    return this.overlay?.getAttribute('aria-hidden') === 'false';
  }
  
  setupFocusTrap() {
    const focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    
    this.focusableElements = this.modal.querySelectorAll(focusableSelector);
    this.firstFocusable = this.focusableElements[0];
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1];
    
    // Trap focus
    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === this.firstFocusable) {
            e.preventDefault();
            this.lastFocusable.focus();
          }
        } else {
          if (document.activeElement === this.lastFocusable) {
            e.preventDefault();
            this.firstFocusable.focus();
          }
        }
      }
    });
  }
  
  returnFocus() {
    // Store trigger in data attribute when opening
    // this.triggerElement?.focus();
  }
}
```

**Example: `js/app.js`** (Main entry)

```javascript
import { TabComponent } from './components/tabs.js';
import { Modal } from './components/modal.js';
import { initAuth } from './components/auth.js';

// Initialize components
document.addEventListener('DOMContentLoaded', () => {
  
  // Tabs
  const tabs = new TabComponent('.tabs', {
    onChange: (panelId) => {
      console.log('Switched to:', panelId);
      
      // Update URL without reload
      const tabName = panelId.replace('panel-', '');
      history.pushState({}, '', `#${tabName}`);
    }
  });
  
  // Modals
  const authModal = new Modal('authModal');
  
  // Auth initialization
  initAuth();
  
  // Check URL hash on load
  if (window.location.hash) {
    const tabId = window.location.hash.substr(1);
    // Switch to that tab
  }
});
```

**Update index.html:**

```html
<!-- At end of body -->
<script type="module" src="js/app.js"></script>
```

### Phase 4: Testing & Validation (Week 4)

#### Automated Testing

1. **Lighthouse Audit**
   ```bash
   # Run in Chrome DevTools
   # Target scores:
   # - Performance: 90+
   # - Accessibility: 100
   # - Best Practices: 95+
   # - SEO: 90+
   ```

2. **axe DevTools**
   - Install extension
   - Scan each page
   - Fix all critical/serious issues

3. **WAVE**
   - Scan at wave.webaim.org
   - Check for contrast errors
   - Verify ARIA usage

#### Manual Testing

1. **Keyboard Navigation**
   - [ ] Can navigate entire app with Tab
   - [ ] All interactive elements reachable
   - [ ] Focus visible on all elements
   - [ ] Modals trap focus correctly
   - [ ] Escape closes modals
   - [ ] Arrow keys work in tabs

2. **Screen Reader** (NVDA/VoiceOver)
   - [ ] All content announced
   - [ ] Form labels read correctly
   - [ ] Errors announced in forms
   - [ ] Live regions work for dynamic content
   - [ ] Buttons have clear labels

3. **Responsive Design**
   - [ ] Test on mobile (375px)
   - [ ] Test on tablet (768px)
   - [ ] Test on desktop (1440px)
   - [ ] No horizontal scroll at any size
   - [ ] Touch targets 44px minimum

4. **Browser Testing**
   - [ ] Chrome
   - [ ] Firefox
   - [ ] Safari
   - [ ] Edge
   - [ ] Mobile Safari
   - [ ] Mobile Chrome

---

## Quick Wins (Implement First)

### 1. Color Contrast Fix (5 minutes)

Replace in existing CSS:
```css
/* Old */
--text-dim: #8882a0;

/* New */
--text-dim: #a8a2c0;  /* Now 4.5:1 contrast! */
```

### 2. Add Skip Link (2 minutes)

```html
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <!-- rest of page -->
</body>
```

### 3. Fix Button Focus (1 minute)

Add to CSS:
```css
button:focus-visible,
.btn:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
```

### 4. Add Form Labels (10 minutes)

Replace:
```html
<input type="email" id="authEmail">
```

With:
```html
<label for="authEmail">Email Address</label>
<input type="email" id="authEmail" autocomplete="email">
```

---

## Rollback Plan

If issues arise:

1. **Keep old index.html as `index.legacy.html`**
2. **Test new version on staging first**
3. **Deploy gradually** (A/B test with 10% traffic)
4. **Monitor error logs** for issues
5. **Easy rollback**: Just rename files

---

## Success Metrics

- ✅ Lighthouse Accessibility score: 100
- ✅ WCAG 2.1 AA compliance
- ✅ 0 axe errors
- ✅ All components modular
- ✅ 50% reduction in CSS size (with tree-shaking)
- ✅ Improved developer experience

---

## Next Steps

1. Review this guide
2. Make backups
3. Start with Phase 2, Step 1 (Add CSS links)
4. Test each change
5. Commit frequently
6. Celebrate progress! 🎉
