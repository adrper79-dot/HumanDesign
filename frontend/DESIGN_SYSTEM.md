# Prime Self Design System Documentation

**Version**: 3.0  
**Date**: March 4, 2026 (Updated March 9, 2026)  
**Status**: Active

> ⚠️ **2026-03-09 Correction — Actual vs Aspirational File Structure**  
> The file structure documented in this file under "Architecture" describes the **target** component architecture. The **actual current** CSS structure is:
> ```
> frontend/css/
>   design-tokens.css          # Canonical source of truth: colors, spacing, z-index, typography  
>   design-tokens-premium.css  # Premium theme overrides (loaded globally, not conditionally)  
>   base.css                   # Reset + global typography  
>   app.css                    # Extracted inline styles; ~50 [DUP] selectors remain (DEF-03)
> ```
> There is no `css/components/` directory. All components are defined in `app.css` or inline in `index.html`.
>
> **Token canonical resolution confirmed 2026-03-09:**  
> - Gold: `--color-gold-500: #c9a84c` is the single source of truth (design-tokens.css)  
> - `design-tokens-premium.css` now correctly uses `var(--color-gold-500)` not `#d4af37`  
> - Focus rings: `--border-focus` inherits from design-tokens.css gold (premium.css override removed)  
> - Z-index stack (9 levels): sticky(20) → header(90) → dropdown(100) → mobile-nav(150) → modal-backdrop(200) → modal(210) → tooltip(300) → notification(400) → onboarding(500)
> - All hardcoded z-index integers replaced with design tokens (2026-03-09 normalization pass)

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Design Tokens](#design-tokens)
- [Components](#components)
- [Accessibility](#accessibility)
- [Best Practices](#best-practices)
- [Migration Guide](#migration-guide)

---

## Overview

The Prime Self Design System is a modern, accessible, component-based UI framework built on industry best practices. It provides:

✅ **WCAG 2.1 AA Compliant** - All components meet accessibility standards  
✅ **Design Tokens** - Consistent, maintainable color and spacing system  
✅ **Modular Architecture** - Import only what you need  
✅ **Responsive** - Mobile-first, works on all devices  
✅ **Dark Mode** - Beautiful dark theme by default  
✅ **Type-safe** - Clear naming conventions and documentation

---

## Architecture

### File Structure

```
frontend/
├── css/
│   ├── design-tokens.css    # Color, spacing, typography tokens
│   ├── base.css              # Reset, global styles
│   └── components/
│       ├── buttons.css       # Button variants
│       ├── cards.css         # Card layouts
│       ├── forms.css         # Form inputs, validation
│       ├── tabs.css          # Tab navigation
│       ├── modals.css        # Modal dialogs
│       ├── alerts.css        # Alerts, toasts, spinners
│       └── layout.css        # Header, grid, utilities
├── js/
│   ├── app.js                # Main application
│   └── components/
│       ├── tabs.js           # Tab component logic
│       ├── modal.js          # Modal component logic
│       └── form-validation.js
└── index.html                # Main HTML file
```

### Loading Order

**Critical** - Load in this order:

```html
<!-- 1. Design tokens first -->
<link rel="stylesheet" href="css/design-tokens.css">

<!-- 2. Base styles -->
<link rel="stylesheet" href="css/base.css">

<!-- 3. Components (order doesn't matter) -->
<link rel="stylesheet" href="css/components/layout.css">
<link rel="stylesheet" href="css/components/buttons.css">
<link rel="stylesheet" href="css/components/cards.css">
<!-- ... other components -->
```

---

## Design Tokens

### Color System

#### Semantic Tokens (Use These!)

```css
/* Backgrounds */
var(--bg-primary)       /* Main page background */
var(--bg-secondary)     /* Cards, secondary surfaces */
var(--bg-tertiary)      /* Inputs, nested elements */

/* Text */
var(--text-primary)     /* Main body text */
var(--text-secondary)   /* Labels, secondary text */
var(--text-tertiary)    /* Placeholders, disabled */

/* Interactive */
var(--interactive-primary)        /* Primary action buttons */
var(--interactive-primary-hover)  /* Hover state */
var(--border-focus)               /* Focus outline */

/* Status */
var(--status-success)   /* Success messages */
var(--status-error)     /* Errors */
var(--status-warning)   /* Warnings */
var(--status-info)      /* Info messages */
```

#### Why Semantic Tokens?

❌ **Don't do this:**
```css
.my-button {
  background: #c9a84c;  /* Hard-coded color */
}
```

✅ **Do this:**
```css
.my-button {
  background: var(--interactive-primary);
}
```

**Benefits:**
- Theme changes in one place
- Consistent across app
- Automatic dark/light mode support
- Named by purpose, not appearance

### Spacing Scale

Based on **4px** increments:

```css
var(--space-1)   /* 4px */
var(--space-2)   /* 8px */
var(--space-3)   /* 12px */
var(--space-4)   /* 16px */
var(--space-6)   /* 24px */
var(--space-8)   /* 32px */
var(--space-12)  /* 48px */
```

### Typography

```css
/* Font Sizes (fluid, responsive) */
var(--text-xs)    /* 11-12px */
var(--text-sm)    /* 13-14px */
var(--text-base)  /* 14-16px */
var(--text-lg)    /* 16-18px */
var(--text-xl)    /* 18-20px */
var(--text-2xl)   /* 20-24px */

/* Font Weights */
var(--font-light)      /* 300 */
var(--font-normal)     /* 400 */
var(--font-medium)     /* 500 */
var(--font-semibold)   /* 600 */
var(--font-bold)       /* 700 */
```

---

## Components

### Buttons

#### Variants

```html
<!-- Primary action -->
<button class="btn btn-primary">Save Changes</button>

<!-- Secondary action -->
<button class="btn btn-secondary">Cancel</button>

<!-- Destructive action -->
<button class="btn btn-danger">Delete Account</button>

<!-- Ghost (subtle) -->
<button class="btn btn-ghost">Learn More</button>

<!-- Link-style -->
<button class="btn btn-link">View Details</button>
```

#### Sizes

```html
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary">Default</button>
<button class="btn btn-primary btn-lg">Large</button>
```

#### States

```html
<!-- Loading -->
<button class="btn btn-primary" disabled>
  <span class="spinner"></span>
  Loading...
</button>

<!-- Disabled -->
<button class="btn btn-primary" disabled>
  Can't Click Me
</button>

<!-- Icon + Text -->
<button class="btn btn-primary">
  <span>⚡</span>
  Generate Chart
</button>
```

#### Accessibility

✅ All buttons meet **44×44px minimum** touch target  
✅ Clear focus indicators  
✅ Disabled state with `aria-disabled`  
✅ Loading state with `aria-busy="true"`

### Cards

```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Chart Calculator</h3>
    <p class="card-subtitle">Generate your energy blueprint</p>
  </div>
  
  <div class="card-body">
    <!-- Card content -->
  </div>
  
  <div class="card-footer">
    <button class="btn btn-secondary">Cancel</button>
    <button class="btn btn-primary">Calculate</button>
  </div>
</div>
```

#### Card Variants

```html
<!-- Elevated (more shadow) -->
<div class="card card-elevated">...</div>

<!-- Interactive (clickable) -->
<div class="card card-interactive" onclick="...">...</div>

<!-- Flat (no shadow) -->
<div class="card card-flat">...</div>
```

### Forms

#### Basic Form

```html
<form class="form">
  <div class="form-group">
    <label for="email">Email Address</label>
    <input 
      type="email" 
      id="email" 
      placeholder="you@example.com"
      autocomplete="email"
      aria-describedby="email-hint"
    >
    <div id="email-hint" class="form-hint">
      We'll never share your email
    </div>
  </div>
  
  <button type="submit" class="btn btn-primary">
    Submit
  </button>
</form>
```

#### Form Grid

```html
<div class="form-grid">
  <div class="form-group">
    <label for="first">First Name</label>
    <input type="text" id="first">
  </div>
  
  <div class="form-group">
    <label for="last">Last Name</label>
    <input type="text" id="last">
  </div>
  
  <div class="form-group form-field-full">
    <label for="bio">Bio</label>
    <textarea id="bio"></textarea>
  </div>
</div>
```

#### Validation States

```html
<!-- Error state -->
<div class="form-group has-error">
  <label for="password">Password</label>
  <input 
    type="password" 
    id="password"
    aria-invalid="true"
    aria-describedby="password-error"
  >
  <div id="password-error" class="form-error">
    Password must be at least 8 characters
  </div>
</div>

<!-- Success state -->
<div class="form-group has-success">
  <label for="username">Username</label>
  <input type="text" id="username">
  <div class="form-success">
    Username is available!
  </div>
</div>
```

### Tabs

#### Markup Structure

```html
<nav class="tabs" role="tablist">
  <div class="tab-list">
    <button 
      role="tab"
      aria-selected="true"
      aria-controls="panel-chart"
      id="tab-chart"
      class="tab-btn active"
    >
      Chart Calculator
    </button>
    
    <button 
      role="tab"
      aria-selected="false"
      aria-controls="panel-profile"
      id="tab-profile"
      class="tab-btn"
    >
      Profile
    </button>
  </div>
</nav>

<div class="tab-panels">
  <div 
    role="tabpanel"
    id="panel-chart"
    aria-labelledby="tab-chart"
    class="tab-panel active"
  >
    Chart content...
  </div>
  
  <div 
    role="tabpanel"
    id="panel-profile"
    aria-labelledby="tab-profile"
    aria-hidden="true"
    class="tab-panel"
  >
    Profile content...
  </div>
</div>
```

#### JavaScript (See js/components/tabs.js)

```javascript
import { TabComponent } from './components/tabs.js';

const tabs = new TabComponent('#tab-container', {
  defaultTab: 0,
  onChange: (tabId) => {
    console.log('Changed to:', tabId);
  }
});
```

### Modals

```html
<div 
  class="modal-overlay" 
  role="dialog" 
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <div class="modal modal-md">
    <div class="modal-header">
      <h2 id="modal-title" class="modal-title">
        Confirm Action
      </h2>
      <button 
        class="modal-close" 
        aria-label="Close dialog"
        onclick="closeModal()"
      >
        ×
      </button>
    </div>
    
    <div class="modal-body">
      Are you sure you want to continue?
    </div>
    
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">
        Cancel
      </button>
      <button class="btn btn-primary">
        Confirm
      </button>
    </div>
  </div>
</div>
```

### Alerts

```html
<!-- Info -->
<div class="alert alert-info" role="status">
  <span class="alert-icon"></span>
  <div class="alert-content">
    Your profile has been updated successfully.
  </div>
</div>

<!-- Error -->
<div class="alert alert-error" role="alert">
  <span class="alert-icon"></span>
  <div class="alert-content">
    <div class="alert-title">Error</div>
    Something went wrong. Please try again.
  </div>
  <button class="alert-close" aria-label="Dismiss">×</button>
</div>

<!-- Loading -->
<div class="alert alert-loading" role="status" aria-live="polite">
  <span class="alert-icon"></span>
  <div class="alert-content">
    Generating your chart...
  </div>
</div>
```

---

## Accessibility

### Keyboard Navigation

✅ **Tab** - Move forward through interactive elements  
✅ **Shift+Tab** - Move backward  
✅ **Enter/Space** - Activate buttons  
✅ **Arrow Keys** - Navigate tabs (when focused)  
✅ **Escape** - Close modals

### Screen Reader Support

All components include:
- Proper ARIA roles
- `aria-label` for icon-only buttons
- `aria-describedby` for help text
- `aria-invalid` for form errors
- `aria-live` regions for dynamic content

### Focus Management

```css
/* Visible focus indicator */
:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
```

### Color Contrast

All text meets **WCAG AA standards** (4.5:1 ratio):

- `--text-primary` on `--bg-primary`: **12.8:1** ✅
- `--text-secondary` on `--bg-primary`: **4.5:1** ✅
- Buttons meet **3:1 for UI components** ✅

---

## Best Practices

### Do's ✅

1. **Use semantic HTML**
   ```html
   <button>Click Me</button>  <!-- Not <div onclick> -->
   ```

2. **Use design tokens**
   ```css
   color: var(--text-primary);  /* Not #e8e6f0 */
   ```

3. **Include labels**
   ```html
   <label for="name">Name</label>
   <input id="name" type="text">
   ```

4. **Add ARIA when needed**
   ```html
   <button aria-label="Close menu">×</button>
   ```

### Don'ts ❌

1. **Don't use inline styles** (unless dynamic)
2. **Don't rely on color alone** (use icons + text)
3. **Don't skip heading levels** (h1 → h2, not h1 → h3)
4. **Don't forget focus states**

---

## Migration Guide

### From Old System to New

#### 1. Update HTML Head

**Replace:**
```html
<style>
  /* Inline styles */
</style>
```

**With:**
```html
<link rel="stylesheet" href="css/design-tokens.css">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/components/buttons.css">
<!-- etc -->
```

#### 2. Update Class Names

| Old | New |
|-----|-----|
| `.btn-primary` (with inline background) | `.btn.btn-primary` |
| `style="color: #8882a0"` | `class="text-secondary"` |
| Custom spinners | `.spinner` |

#### 3. Add ARIA Attributes

```html
<!-- Before -->
<button onclick="closeModal()">×</button>

<!-- After -->
<button 
  onclick="closeModal()" 
  aria-label="Close dialog"
>
  ×
</button>
```

#### 4. Convert Tabs

See `ACCESSIBILITY_AUDIT.md` for full tab conversion example.

---

## Resources

- **WCAG 2.1 Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Authoring Practices**: https://www.w3.org/WAI/ARIA/apg/
- **Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **MDN Web Docs**: https://developer.mozilla.org/en-US/docs/Web/Accessibility

---

## Support

For questions or contributions:
- **GitHub Issues**: Report bugs or request features
- **Documentation**: This file is the source of truth
- **Code Examples**: See `examples/` directory

---

**Last Updated**: March 4, 2026  
**Maintained By**: Prime Self Development Team
