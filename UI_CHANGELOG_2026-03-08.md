# UI Audit & Change Log — 2026-03-08

## Scope

Full UI review of `frontend/index.html`, CSS components, and JavaScript for both web (desktop) and mobile. Focus on navigation issues, broken interactions, accessibility, and best-practice alignment.

---

## Bugs Found & Fixed

### BUG-01 — Malformed HTML `data-i18n-placeholder` attributes (Critical)

**Files:** `frontend/index.html` lines 390, 464  
**Issue:** A stray `— e.g. Tampa, FL, USA"` sits outside the attribute value in both the chart and profile location inputs:
```html
data-i18n-placeholder="chart.birthLocationPlaceholder" — e.g. Tampa, FL, USA"
```
This is invalid HTML. Browsers parse it unpredictably, potentially injecting visible text or breaking the input element.  
**Fix:** Merged the example text into the placeholder attribute value and removed the malformed fragment.

---

### BUG-02 — `window.onTabActivated` overwritten — lazy.js tab init system dead (Critical)

**Files:** `frontend/index.html` ~line 3655, `frontend/js/lazy.js` line 85  
**Issue:** `lazy.js` defines `window.onTabActivated` as the entry point for `registerTabInit()`. The inline script later overwrites it:
```js
window.onTabActivated = function(tabId) {
  if (tabId === 'enhance') loadEnhanceQuestions();
};
```
This silently destroys all lazy-loaded tab initializers registered via `registerTabInit()`.  
**Fix:** Changed to use `registerTabInit('enhance', loadEnhanceQuestions)` so the `lazy.js` system stays intact and the enhance tab still lazy-loads.

---

### BUG-03 — `MOBILE_TAB_GROUPS` missing `overview` entry (Medium)

**Files:** `frontend/index.html` ~line 4110  
**Issue:** Desktop `TAB_GROUPS` includes `overview: 'btn-blueprint'`, but mobile's `MOBILE_TAB_GROUPS` omits it. When the Overview tab is active on mobile, no bottom nav icon is highlighted.  
**Fix:** Added `overview: 'blueprint'` to `MOBILE_TAB_GROUPS`.

---

### BUG-04 — Pull-to-refresh uses wrong CSS selector (Low)

**Files:** `frontend/index.html` ~line 4195  
**Issue:** `document.querySelector('.tab-content:not(.hidden)')` — but tab panels use `.active`, not `.hidden`. Pull-to-refresh never identifies the active tab for conditional reload.  
**Fix:** Changed selector to `.tab-content.active`.

---

### BUG-05 — Step guide onclick references non-existent element IDs (Low)

**Files:** `frontend/index.html` lines 356–370  
**Issue:** Step guide clicks pass `document.getElementById('btn-chart')`, `getElementById('btn-profile')`, and `getElementById('btn-transits')` — none of these IDs exist. The actual buttons are `btn-blueprint`, `btn-blueprint`, and `btn-today`. Works by accident via `TAB_GROUPS` fallback, but passes `null`.  
**Fix:** Updated to use correct IDs: `btn-blueprint` and `btn-today`.

---

### BUG-06 — `aria-labelledby` mismatch on composite tab (Accessibility)

**Files:** `frontend/index.html` line 869  
**Issue:** `aria-labelledby="btn-composite"` — but the button's actual ID is `btn-relationships`. Screen readers cannot associate the tab panel with its controlling button.  
**Fix:** Changed to `aria-labelledby="btn-relationships"`.

---

### BUG-07 — Mobile "More" tools don't highlight nav (UX)

**Files:** `frontend/index.html` ~line 4115  
**Issue:** When any "More" tool tab (history, rectify, practitioner, clusters, sms, onboarding) is active via the mobile drawer, no bottom nav icon is highlighted. The "More" button should show active state.  
**Fix:** Added fallback in `updateMobileNavForTab()` to highlight `#mobileMoreBtn` when the tab isn't in `MOBILE_TAB_GROUPS` and has no direct match in the nav bar.

---

### BUG-08 — Fragile `.tab-btn` index selector in history empty state (Low)

**Files:** `frontend/index.html` ~line 2370  
**Issue:** `document.querySelectorAll('.tab-btn')[1]` targets the second `.tab-btn` in DOM order — fragile, and currently resolves to the wrong button. Works by accident via `TAB_GROUPS`.  
**Fix:** Changed to `document.getElementById('btn-blueprint')`.

---

### BUG-09 — Typo: "yourfirst" in empty history state (Cosmetic)

**Files:** `frontend/index.html` ~line 2369  
**Issue:** `Generate yourfirst Prime Self Profile` — missing space.  
**Fix:** Changed to `Generate your first Prime Self Profile`.

---

## UX Improvements Implemented

### UX-01 — PWA install banner overlaps mobile bottom nav

**Files:** `frontend/index.html` ~line 4505  
**Issue:** Install banner uses `position: fixed; bottom: 20px` — directly overlaps the mobile nav bar (64px tall). On mobile, the banner is obscured or covers navigation.  
**Fix:** Changed to `bottom: 84px` so the banner sits above the mobile nav.

---

### UX-02 — Auto-detect timezone on page load

**Files:** `frontend/index.html` — new init block  
**Issue:** Timezone dropdowns default to America/New_York. Users in other timezones must manually change it. The geocoder adds timezones dynamically, but users who skip geocoding get a limited list with a wrong default.  
**Fix:** Added auto-detection via `Intl.DateTimeFormat().resolvedOptions().timeZone` on DOMContentLoaded, setting all tz selects (`c-tz`, `p-tz`) to the user's browser timezone.

---

### UX-03 — Logout and Unsubscribe SMS lack confirmation dialogs

**Files:** `frontend/index.html` `logout()`, `unsubscribeSMS()`  
**Issue:** `logout()` and `unsubscribeSMS()` execute immediately without warning. Users can accidentally sign out (losing unsaved state) or unsubscribe from SMS.  
**Fix:** Added `if (!confirm(...)) return;` guards to both functions.

---

### UX-04 — Transit info grid doesn't stack on mobile

**Files:** `frontend/css/app.css`  
**Issue:** The 3-column transit type info grid (`grid-template-columns: 1fr 1fr 1fr`) and the transit row grid (`130px 1fr auto`) don't collapse on small screens, causing overflow or cramped layouts.  
**Fix:** Added mobile media queries to stack both grids to single columns at ≤600px.

---

### UX-05 — Empty result areas show blank space

**Files:** `frontend/index.html`  
**Issue:** `#chartResult`, `#transitResult`, `#compResult`, `#historyResult` are empty divs that show nothing before first interaction. Users see blank space below buttons with no context.  
**Fix:** Added inviting empty-state placeholder content to each result div with icons and helpful prompts.

---

### UX-06 — Social share buttons lack minimum touch targets

**Files:** `frontend/css/app.css`  
**Issue:** Social share buttons in the share modal use inline `padding:10px` which often falls below the 44px WCAG minimum touch target size.  
**Fix:** Added `.btn-social` class rule enforcing `min-height: 44px; min-width: 44px;` touch target sizing.

---

### UX-07 — `* { max-width: 100% }` in mobile CSS breaks SVG/fixed elements

**Files:** `frontend/css/components/mobile.css`  
**Issue:** The universal `* { max-width: 100%; }` rule inside the 768px media query breaks SVG charts, fixed-position elements, and anything that legitimately needs to overflow.  
**Fix:** Changed to targeted selectors: `img, video, canvas, table, pre, .card` only.

---

## Known Issues Deferred (Recommendations for Future Sprints)

| ID | Issue | Impact | Effort |
|-----|-------|--------|--------|
| DEF-01 | Sub-tab bars duplicated 7 times in HTML | Maintenance burden | Medium — extract to JS-generated component |
| DEF-02 | All 4600 lines of JS inline in index.html | No caching, no testing, no tree-shaking | High — split into auth.js, chart.js, profile.js, etc. |
| DEF-03 | 20+ CSS selectors duplicated between app.css and component files | Cascade conflicts, large payload | Medium — audit and remove from app.css |
| DEF-04 | Heavy inline styles throughout HTML | Inconsistent theming, non-responsive | High — extract to CSS classes |
| DEF-05 | Background video on mobile consumes bandwidth/GPU | Poor mobile performance | Low — conditionally load based on `navigator.connection` |
| DEF-06 | No keyboard navigation for "More" dropdown | Fails WCAG 2.1 AA keyboard access | Medium — add ARIA menu keyboard patterns |
| DEF-07 | Form data sync between tabs is one-directional | Profile → Chart doesn't sync | Low — use shared JS state object |
| DEF-08 | Profile timezone select has fewer options than chart | UX inconsistency | Low — unify both selects |
| DEF-09 | Sticky CTA button for chart generation on mobile | Users must scroll up to submit | Low — add position:sticky wrapper |
| DEF-10 | Back-to-top button when deep in results | No quick way to return to form | Low — add floating button |

---

## Files Modified

- `frontend/index.html` — 14 fixes across HTML, inline JS
- `frontend/css/app.css` — 2 fixes (transit mobile stacking, social button touch targets)
- `frontend/css/components/mobile.css` — 1 fix (targeted max-width instead of universal)
- `UI_CHANGELOG_2026-03-08.md` — this file (created)
