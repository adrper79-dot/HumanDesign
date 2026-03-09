# Frontend Defect Discovery Audit

**Scope:** `frontend/` — All HTML, CSS, JS, and locale files  
**Date:** 2025-01-15  
**Auditor:** Automated deep-scan  
**Severity scale:** Critical > High > Medium > Low  

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 10 |
| Medium | 16 |
| Low | 8 |
| **Total** | **38** |

---

## Critical Defects

### C-1: Broken HTML attributes on location inputs — malformed `data-i18n-placeholder`

| Field | Value |
|---|---|
| **Severity** | Critical |
| **Category** | Logic & Correctness |
| **File** | `frontend/index.html` lines 390, 464 |
| **Description** | The two location `<input>` elements have a malformed attribute. The attribute string reads `data-i18n-placeholder="chart.birthLocationPlaceholder" — e.g. Tampa, FL, USA"` — the em-dash (`—`) prematurely closes the attribute value at the first `"` after `birthLocationPlaceholder`, and the remainder (`— e.g. Tampa, FL, USA"`) becomes bare text/invalid attributes in the DOM. This corrupts the element's attribute list and may break subsequent attributes on the same tag (e.g. `style="flex:1"`), potentially mis-rendering the input. |
| **Recommended Fix** | Remove the trailing text after the key or move it to the `placeholder` attribute only: `data-i18n-placeholder="chart.birthLocationPlaceholder"` |
| **Effort** | 5 min |

---

### C-2: `startCheckout()` uses implicit `event` global — fails in strict mode and Firefox

| Field | Value |
|---|---|
| **Severity** | Critical |
| **Category** | Logic & Correctness |
| **File** | `frontend/index.html` line 1210 |
| **Description** | `startCheckout(tier)` references `event.target` on line 1210, but the function signature only declares `tier` as a parameter. It relies on the implicit `window.event` global, which is `undefined` in Firefox and in strict-mode contexts. This causes a `TypeError` when users click any "Upgrade to …" button, completely blocking Stripe checkout. |
| **Recommended Fix** | Change the function signature to `startCheckout(tier, event)` and update the three `onclick` callsites to pass `event`: `onclick="startCheckout('seeker', event)"` (lines 224, 239, 254). Alternatively, derive the button from `document.querySelector` instead of `event.target`. |
| **Effort** | 10 min |

---

### C-3: `offline-transits.js` — `.ok` check on parsed JSON objects always fails

| Field | Value |
|---|---|
| **Severity** | Critical |
| **Category** | Logic & Correctness |
| **File** | `frontend/js/offline-transits.js` lines 147, 191, 243 |
| **Description** | The offline module wraps `apiFetch()` and checks `resp.ok` on the result. However, `apiFetch()` (defined in index.html) already parses the response and returns a plain JS object — not a `Response`. Plain objects never have `.ok`, so every condition evaluates to `falsy`, causing: (1) transit prefetching to silently never cache, (2) user auth check to always think the user is logged out, (3) chart caching to silently fail. The offline feature is effectively non-functional. |
| **Recommended Fix** | Replace `resp.ok` checks with truthiness checks on the returned data: `if (resp && !resp.error)` or `if (resp && resp.success)`, matching the actual API response shape. |
| **Effort** | 15 min |

---

### C-4: XSS via unescaped API data in `saveCheckIn()` and `loadCheckInStats()`

| Field | Value |
|---|---|
| **Severity** | Critical |
| **Category** | Security |
| **File** | `frontend/index.html` lines 4241, 4265, 4332–4340 |
| **Description** | `saveCheckIn()` inserts `result.message` and `result.error` directly into `innerHTML` without escaping. If the API returns a crafted message containing HTML/JS, it executes in the user's session. Similarly, `loadCheckInStats()` inserts `d.date`, `d.alignmentScore`, and `d.mood` from API data into the DOM unescaped. While the app uses `escapeHtml()` elsewhere, these paths skip it entirely. |
| **Recommended Fix** | Wrap every dynamic value with `escapeHtml()`: `${escapeHtml(result.message || 'Check-in saved!')}`, `${escapeHtml(d.date)}`, `${escapeHtml(String(d.alignmentScore))}`, `${escapeHtml(d.mood)}`. |
| **Effort** | 15 min |

---

## High Defects

### H-1: `.textContent` used with HTML content — renders raw tags to user

| Field | Value |
|---|---|
| **Severity** | High |
| **Category** | Logic & Correctness |
| **File** | `frontend/index.html` lines 1505, 1535 |
| **Description** | `prefillExample()` (line 1505) and `geocodeLocation()` (line 1535) set `.textContent` with strings containing `<span class="icon-check">`. Since `.textContent` does not parse HTML, users see the literal tag text `<span class="icon-check"></span> Tampa, Florida…` instead of the rendered icon. |
| **Recommended Fix** | Change `.textContent` to `.innerHTML` on these two lines, since the strings are constructed from trusted data and already escaped where needed. |
| **Effort** | 5 min |

---

### H-2: JWT stored in `localStorage` — vulnerable to XSS token theft

| Field | Value |
|---|---|
| **Severity** | High |
| **Category** | Security |
| **File** | `frontend/index.html` lines 1102–1103, 1169–1170 |
| **Description** | The JWT (`ps_token`) and user email (`ps_email`) are stored in `localStorage`, which is accessible to any JS running on the page. If any XSS vector exists (and the CSP includes `unsafe-inline`), an attacker can exfiltrate the token. |
| **Recommended Fix** | Move token storage to an `HttpOnly`, `Secure`, `SameSite=Strict` cookie set by the backend. If that's not feasible, use `sessionStorage` and add a short token expiry. |
| **Effort** | 2–4 hours (requires backend changes) |

---

### H-3: CSP allows `'unsafe-inline'` for scripts and styles

| Field | Value |
|---|---|
| **Severity** | High |
| **Category** | Security |
| **File** | `frontend/index.html` lines 9–10 |
| **Description** | The Content-Security-Policy meta tag includes `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline'`. This completely negates CSP protection against injected inline scripts, which is the primary XSS defense CSP provides. |
| **Recommended Fix** | Extract all inline `<script>` blocks into external `.js` files, replace `'unsafe-inline'` with nonce-based CSP (`'nonce-<random>'`), and use external stylesheets. This is a significant refactor since index.html has ~3000 lines of inline JS. |
| **Effort** | 1–2 days |

---

### H-4: `alert()` used for checkout/billing errors — poor UX + can leak info

| Field | Value |
|---|---|
| **Severity** | High |
| **Category** | Logic & Correctness / Security |
| **File** | `frontend/index.html` lines 1221, 1248, 2566 |
| **Description** | `startCheckout()` and `openBillingPortal()` display errors via `alert('Checkout failed: ' + result.error)`. The `alert()` message includes unescaped backend error text that may contain internal details (stack traces, DB errors). Additionally, `alert()` blocks the UI thread and is untranslatable. |
| **Recommended Fix** | Replace `alert()` calls with the existing `showNotification()` function and escape the error text: `showNotification('Checkout failed: ' + escapeHtml(result.error), 'error')`. |
| **Effort** | 10 min |

---

### H-5: Duplicate channel entries in `bodygraph.js` CHANNEL_LINES

| Field | Value |
|---|---|
| **Severity** | High |
| **Category** | Logic & Correctness |
| **File** | `frontend/js/bodygraph.js` (CHANNEL_LINES object) |
| **Description** | The `CHANNEL_LINES` map contains reversed duplicates for several channels: `"48-16"` and `"16-48"`, `"36-35"` and `"35-36"`, `"44-26"` and `"26-44"`, `"57-20"` and `"20-57"`. When the code iterates channels from chart data, both the original and reversed key may be present, causing double-rendering of channel lines in the SVG bodygraph. |
| **Recommended Fix** | Normalize channel keys to always use `min-max` order (e.g. `"16-48"` not `"48-16"`) and remove the duplicates. Add a lookup normalization function: `const key = [a,b].sort((x,y)=>x-y).join('-');` |
| **Effort** | 20 min |

---

### H-6: `loadSocialProofStats()` uses raw `fetch()` instead of `apiFetch()`

| Field | Value |
|---|---|
| **Severity** | High |
| **Category** | Logic & Correctness |
| **File** | `frontend/index.html` line 4396 |
| **Description** | `loadSocialProofStats()` calls `fetch(API + '/api/stats/activity')` directly, bypassing the `apiFetch()` wrapper that handles auth headers, 401 auto-logout, and JSON parsing. If this endpoint requires auth, the call will silently fail. Additionally, the raw `fetch` does not set `Content-Type` headers or handle non-JSON responses safely (no `.ok` check before `.json()`). |
| **Recommended Fix** | Replace with `apiFetch('/api/stats/activity')` or add proper error handling: check `response.ok` before calling `.json()`. |
| **Effort** | 10 min |

---

### H-7: Pull-to-refresh doesn't actually refresh anything

| Field | Value |
|---|---|
| **Severity** | High |
| **Category** | Logic & Correctness |
| **File** | `frontend/index.html` lines 4156–4185 |
| **Description** | The pull-to-refresh handler detects the gesture and shows a spinner animation, but only logs `'🔄 Refreshing transit data...'` to the console. It never actually reloads transit data or any other tab content. The feature is purely cosmetic. |
| **Recommended Fix** | Dispatch actual refresh logic based on the active tab: call `loadTransits()`, `loadDiaryEntries()`, `loadCheckInStats()`, etc. depending on which tab is visible. |
| **Effort** | 30 min |

---

### H-8: `shareToSocial()` reads non-existent `localStorage.user` key

| Field | Value |
|---|---|
| **Severity** | High |
| **Category** | Logic & Correctness |
| **File** | `frontend/index.html` lines 3823, 3913 |
| **Description** | `shareToSocial()` and `openShareModal()` read `localStorage.getItem('user')`, but the app stores user data under `ps_email` and `ps_token` — there is no `user` key ever written. This means `JSON.parse('{}')` always runs, the referral `ref` parameter is never set, and share URL is always generic. |
| **Recommended Fix** | Use `apiFetch('/api/auth/me')` (already used in `shareProfile()`) or read from `ps_email` to build the share URL. |
| **Effort** | 15 min |

---

### H-9: Service worker caches API responses without cache-busting or auth awareness

| Field | Value |
|---|---|
| **Severity** | High |
| **Category** | Security / Performance |
| **File** | `frontend/service-worker.js` lines 71–120 |
| **Description** | The service worker uses a network-first strategy for API calls but caches the full response including potentially auth-gated data. If a user logs out, stale cached API responses (profile data, chart data) may still be served to the next user on the same device. There is no cache invalidation on logout. |
| **Recommended Fix** | Clear the API cache on logout events (e.g., via `postMessage` from the main page to the service worker). Add user-specific cache keys or skip caching for auth-gated endpoints. |
| **Effort** | 1–2 hours |

---

### H-10: Canvas `fillText` uses CSS variable `var(--text-dim)` which doesn't resolve

| Field | Value |
|---|---|
| **Severity** | High |
| **Category** | Logic & Correctness |
| **File** | `frontend/index.html` line 4322 |
| **Description** | In `loadCheckInStats()`, the canvas fallback message sets `ctx.fillStyle = 'var(--text-dim)'`. Canvas API does not resolve CSS custom properties — `fillStyle` only accepts resolved color values. The text will render as black (default) or may be invisible on the dark background. |
| **Recommended Fix** | Use `getComputedStyle(document.documentElement).getPropertyValue('--text-dim')` or hardcode a hex color like `'#8882a0'`. |
| **Effort** | 5 min |

---

## Medium Defects

### M-1: Missing `escapeHtml()` on `result.error` in `startCheckout()` alert

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Security |
| **File** | `frontend/index.html` lines 1221, 1248 |
| **Description** | Backend error messages are concatenated directly into `alert()` calls. While `alert()` doesn't parse HTML, this establishes a pattern of trusting server error text that could be harmful if the code is later refactored to use innerHTML-based notifications. |
| **Recommended Fix** | Always escape: `alert('Checkout failed: ' + escapeHtml(result.error))` or switch to `showNotification()`. |
| **Effort** | 5 min |

---

### M-2: `embed.js` origin validation is insufficient

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Security |
| **File** | `frontend/embed.js` lines 130–165 |
| **Description** | The embed widget's `postMessage` listener checks `event.origin` against the iframe's `src` origin, but the origin comparison is done after the widget is already initialized. If an attacker embeds the widget and sends crafted messages, the `resize` handler could be exploited to inject CSS heights. The `destroy()` method removes the iframe but doesn't remove the message listener until GC. |
| **Recommended Fix** | Validate `event.origin` strictly, limit accepted message types, and explicitly remove the event listener in `destroy()`. |
| **Effort** | 30 min |

---

### M-3: No rate limiting on auth form submission — enables brute-force

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Security |
| **File** | `frontend/index.html` (submitAuth function) |
| **Description** | The `submitAuth()` function has no client-side rate limiting or CAPTCHA. A malicious script could call it in a tight loop to brute-force email/password combinations. While the backend should enforce rate limits, the frontend offers no defense-in-depth. |
| **Recommended Fix** | Add a client-side cooldown (e.g., disable submit for 2s after each attempt, exponential backoff after 5 failures). Consider adding a CAPTCHA after 3 failed attempts. |
| **Effort** | 1 hour |

---

### M-4: `switchTab()` doesn't update `aria-selected` on tab buttons

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Accessibility (WCAG 2.1 AA) |
| **File** | `frontend/index.html` (`switchTab` function, ~line 1312) |
| **Description** | While tab buttons have `role="tab"` and initial `aria-selected` attributes, the `switchTab()` function toggles `.active` CSS class but does not update `aria-selected="true/false"` on the corresponding tab buttons. Screen readers will not announce which tab is currently selected. |
| **Recommended Fix** | In `switchTab()`, after toggling classes, set `aria-selected="false"` on all tab buttons, then `aria-selected="true"` on the active one. |
| **Effort** | 15 min |

---

### M-5: Modals lack focus trap — keyboard focus escapes to background

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Accessibility (WCAG 2.1 AA) |
| **File** | `frontend/index.html` (auth overlay, pricing overlay, share modal) |
| **Description** | The auth overlay, pricing modal, and share modal have `role="dialog"` and `aria-modal="true"`, but there is no JavaScript focus trap. Keyboard users can Tab through the modal and focus elements behind it. Additionally, pressing Escape doesn't close any of these modals. |
| **Recommended Fix** | Add a focus trap utility that cycles focus within the modal's focusable elements. Add `keydown` listener for Escape to close the modal. Restore focus to the trigger element on close. |
| **Effort** | 1 hour |

---

### M-6: Radio buttons in Big Five / VIA assessments have no visible focus indicator

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Accessibility (WCAG 2.1 AA) |
| **File** | `frontend/index.html` (BF/VIA question rendering, lines ~3350–3450) |
| **Description** | The Big Five and VIA assessment radio buttons use `style="width:auto"` but have no `:focus-visible` styling defined. The global `input:focus` only sets `border-color` which doesn't apply to radio buttons in most browsers. Keyboard users cannot see which radio button has focus. |
| **Recommended Fix** | Add CSS: `input[type="radio"]:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }` |
| **Effort** | 5 min |

---

### M-7: `showEnhanceStatus()` escapes then wraps in HTML — double-encoding risk

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Logic & Correctness |
| **File** | `frontend/index.html` line 3617 |
| **Description** | `showEnhanceStatus()` calls `escapeHtml(message)` and injects the result into an innerHTML template. However, some callers like `showEnhanceStatus('enhanceStatus1', 'Behavioral validation saved! Your next profile will include this data.', 'success')` pass plain text that was never HTML. If a caller passes a string with `&amp;` already escaped, it will be double-escaped as `&amp;amp;`. This isn't exploitable but causes visual corruption. |
| **Recommended Fix** | Standardize: either always pass raw text and escape in the function (current approach is correct), or document that callers must not pre-escape. Verify no caller passes pre-escaped HTML. |
| **Effort** | 10 min |

---

### M-8: Massive inline `<script>` block (~3200 lines) hurts parse time and cacheability

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Performance |
| **File** | `frontend/index.html` lines ~1095–4140 |
| **Description** | The main `<script>` block contains ~3000+ lines of JavaScript inline in the HTML. This prevents the browser from caching JS independently of the HTML, blocks HTML parsing until the script is fully parsed, and makes CSP nonce-based protection impractical. Any HTML change invalidates the entire cached resource. |
| **Recommended Fix** | Extract the inline script into `js/app.js` (or split by feature) and load with `<script src="js/app.js" defer>`. This enables independent caching, parallel downloads, and eventual CSP hardening. |
| **Effort** | 2–4 hours |

---

### M-9: No `<noscript>` fallback

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Accessibility |
| **File** | `frontend/index.html` |
| **Description** | The entire app requires JavaScript but provides no `<noscript>` message informing users. Users with JS disabled see a blank page. |
| **Recommended Fix** | Add `<noscript><div style="padding:2rem;text-align:center;color:#fff">Prime Self requires JavaScript to run. Please enable JavaScript in your browser settings.</div></noscript>` inside `<body>`. |
| **Effort** | 5 min |

---

### M-10: CSS `@import url()` chains in `prime-self.css` cause sequential loading

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Performance |
| **File** | `frontend/css/prime-self.css` lines 18–36 |
| **Description** | `prime-self.css` uses `@import url('design-tokens.css')`, `@import url('base.css')`, and 7 component imports. Each `@import` is sequential — the browser must download and parse each file before discovering the next import. This creates a waterfall of 9 sequential CSS requests. |
| **Recommended Fix** | Replace `@import` with parallel `<link>` tags in `index.html` (the HTML already loads `app.css` and other files via `<link>`), or use a CSS bundler to concatenate files at build time. |
| **Effort** | 30 min |

---

### M-11: Duplicate CSS rule declarations between `app.css` and component files

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Code Quality |
| **File** | `frontend/css/app.css` (throughout — marked `[DUP]`) |
| **Description** | `app.css` acknowledges 15+ duplicated selectors via `[DUP]` comments (buttons, tabs, cards, forms, alerts, layout, spinners, etc.) that also exist in component files. This increases CSS payload by ~30%, causes specificity conflicts, and makes maintenance error-prone — changes must be made in two places. |
| **Recommended Fix** | Systematically remove duplicate rules from `app.css`, keeping only the `[UNIQUE]` selectors. Let component files be the single source of truth. Test visually after each removal. |
| **Effort** | 2–3 hours |

---

### M-12: `design-tokens.css` and `design-tokens-premium.css` redefine same custom properties

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Code Quality |
| **File** | `frontend/css/design-tokens.css`, `frontend/css/design-tokens-premium.css` |
| **Description** | Both files define `:root` with overlapping custom property names (`--bg-primary`, `--text-primary`, `--font-sans`/`--font-body`, `--space-*`, `--radius-*`, etc.). If both are loaded, the premium tokens always win due to source order, making the base tokens dead code. The naming is inconsistent (base uses `--font-sans`, premium uses `--font-body`/`--font-display`). |
| **Recommended Fix** | Scope premium tokens under `.theme-premium` (they're already scoped in `prime-self-premium.css`). Remove the redundant `:root` declarations from `design-tokens-premium.css` or gate loading to only one token file. |
| **Effort** | 1 hour |

---

### M-13: `icons.css` uses `content: url()` in `::before` pseudo-elements — inaccessible

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Accessibility (WCAG 2.1 AA) |
| **File** | `frontend/css/icons.css` (all `::before` rules) |
| **Description** | All icon pseudo-elements use `content: url("data:image/svg+xml,...")` which is not announced by screen readers and has no alt text. Icons used as the sole content of buttons (e.g. in tab bar) convey no meaning to assistive technology. |
| **Recommended Fix** | Add `aria-hidden="true"` to icon spans and ensure the parent element has sufficient text or `aria-label`. For icon-only buttons, add `aria-label` to the button itself. |
| **Effort** | 30 min |

---

### M-14: `i18n.js` doesn't handle missing translation keys gracefully

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | i18n |
| **File** | `frontend/js/i18n.js` |
| **Description** | The `window.t(key)` function returns the key itself (e.g. `"checkin.selectScore"`) when a translation is missing. HTML elements using `data-i18n` then display raw keys like `checkin.selectScore` to the user. There is no fallback to English when a non-English locale is missing a key. |
| **Recommended Fix** | Implement English fallback: if the current locale doesn't have the key, look it up in the cached English locale before returning the raw key. Log missing keys in development. |
| **Effort** | 30 min |

---

### M-15: Non-English locales missing keys that exist in `en.json`

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | i18n |
| **File** | `frontend/locales/es.json`, `fr.json`, `de.json`, `pt.json` |
| **Description** | All locale files have 272 lines (identical structure), but the `en.json` has keys used in inline JS (e.g. `checkin.saving`, `checkin.selectScore`, `diary.noEvents`) that are referenced via `window.t()`. If these keys are missing in non-English locales, users see raw English keys as fallback text. A full key audit is needed to verify parity. |
| **Recommended Fix** | Write a script that compares all locale files against `en.json` and flags missing keys. Add missing translations or at least copy English values as placeholder. |
| **Effort** | 1–2 hours |

---

### M-16: `embed.html` hardcodes API endpoint — different from main app

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Category** | Logic & Correctness |
| **File** | `frontend/embed.html` line ~375 |
| **Description** | The embed widget hardcodes its API endpoint (`const apiEndpoint = 'https://prime-self-api.adrper79.workers.dev'`), duplicating the URL from `index.html`. If the API URL changes, both files must be updated independently. The embed does not share the `API` constant from the main page. |
| **Recommended Fix** | Allow the embed to accept the API endpoint as a config parameter in the embed script URL or `data-` attribute, with a sensible default. |
| **Effort** | 20 min |

---

## Low Defects

### L-1: Notification animation styles injected dynamically create duplicate `<style>` tags

| Field | Value |
|---|---|
| **Severity** | Low |
| **Category** | Performance / Code Quality |
| **File** | `frontend/index.html` lines 3952–3983, 4503–4510 |
| **Description** | The notification system and PWA install banner both inject `<style>` elements into `<head>` at runtime. The notification system checks for an existing `#notificationStyles` element before injecting, but the PWA install banner does not — it unconditionally creates a `<style>` for `@keyframes slideUp`. The share modal styles are also injected conditionally. This leads to inconsistent patterns and potential duplicate `<style>` tags. |
| **Recommended Fix** | Move all animation keyframes into `app.css` or `artwork.css` and remove the dynamic `<style>` injection. |
| **Effort** | 15 min |

---

### L-2: `trackEvent()` is a no-op stub

| Field | Value |
|---|---|
| **Severity** | Low |
| **Category** | Code Quality |
| **File** | `frontend/index.html` line 3889 |
| **Description** | `trackEvent()` only logs to `console.log`. Called from multiple share functions, it creates false confidence that analytics are being tracked. |
| **Recommended Fix** | Either implement actual analytics (Google Analytics, Plausible, etc.) or remove the `trackEvent` calls to avoid dead code. |
| **Effort** | 15 min (to remove) or 1 hour (to implement) |

---

### L-3: Hardcoded colors in inline `style` attributes bypass design tokens

| Field | Value |
|---|---|
| **Severity** | Low |
| **Category** | Code Quality |
| **File** | `frontend/index.html` (throughout — hundreds of inline styles) |
| **Description** | Many elements use `style="background:rgba(106,79,200,0.15)"` and similar hardcoded colors instead of design token references. This undermines the design token system and makes theme switching (e.g. `.theme-premium`) impossible for these elements. |
| **Recommended Fix** | Replace hardcoded colors with CSS custom properties. For common patterns, create utility classes. This is a large incremental refactor. |
| **Effort** | 4–8 hours (incremental) |

---

### L-4: `exportPDF()` function is a stub that shows "coming soon" alert

| Field | Value |
|---|---|
| **Severity** | Low |
| **Category** | Code Quality |
| **File** | `frontend/index.html` (exportPDF function) |
| **Description** | The Export PDF button is visible in the UI but `exportPDF()` only shows a notification. This confuses users who expect actual functionality. |
| **Recommended Fix** | Either implement PDF export (using html2canvas + jsPDF or similar) or hide the button until the feature is ready: `style="display:none"`. |
| **Effort** | 5 min (to hide) or 4+ hours (to implement) |

---

### L-5: `downloadChart()` and `shareChartImage()` are stubs

| Field | Value |
|---|---|
| **Severity** | Low |
| **Category** | Code Quality |
| **File** | `frontend/index.html` lines 3804, 3783 |
| **Description** | These functions only show "coming soon" messages but may be referenced in UI buttons, creating dead-end user experiences. |
| **Recommended Fix** | Hide or disable the UI elements that trigger these until implementation is complete. |
| **Effort** | 5 min |

---

### L-6: `service-worker.js` cache version (`v9`) requires manual updating

| Field | Value |
|---|---|
| **Severity** | Low |
| **Category** | Code Quality |
| **File** | `frontend/service-worker.js` line 1 |
| **Description** | The cache version string is hardcoded as `'ps-cache-v9'`. Forgetting to increment it during deployment means users get stale cached assets. |
| **Recommended Fix** | Auto-generate the cache version from a build hash, git commit, or timestamp during deployment. |
| **Effort** | 30 min |

---

### L-7: Mobile "More" drawer uses `document.body.style.overflow = 'hidden'` — can conflict

| Field | Value |
|---|---|
| **Severity** | Low |
| **Category** | Logic & Correctness |
| **File** | `frontend/index.html` line 4100 |
| **Description** | `toggleMobileMore()` directly sets `body.style.overflow`. If a modal is also open, closing the drawer resets overflow to `''`, allowing background scrolling behind the modal. |
| **Recommended Fix** | Use a counter or class-based approach: `document.body.classList.toggle('no-scroll')`. The CSS class can be managed by all overlays/modals collaboratively. |
| **Effort** | 15 min |

---

### L-8: `manifest.json` screenshots are not sized per PWA spec

| Field | Value |
|---|---|
| **Severity** | Low |
| **Category** | Code Quality |
| **File** | `frontend/manifest.json` |
| **Description** | The manifest includes screenshot entries for app store listings, but if the referenced images don't exist or aren't properly sized, the PWA install experience degrades. No build validation ensures these assets exist. |
| **Recommended Fix** | Verify all referenced icon and screenshot files exist and meet minimum size requirements (512×512 for icons, recommended 1080×1920 for screenshots). |
| **Effort** | 30 min |

---

## Appendix: Files Audited

| File | Lines | Category |
|------|-------|----------|
| `frontend/index.html` | 4578 | HTML + inline JS |
| `frontend/embed.html` | 511 | HTML + inline JS |
| `frontend/embed.js` | 208 | JS |
| `frontend/service-worker.js` | 308 | JS |
| `frontend/manifest.json` | 120 | Config |
| `frontend/js/asset-randomizer.js` | ~50 | JS |
| `frontend/js/i18n.js` | 350 | JS |
| `frontend/js/lazy.js` | 211 | JS |
| `frontend/js/offline-transits.js` | 622 | JS |
| `frontend/js/share-card.js` | 277 | JS |
| `frontend/js/bodygraph.js` | 222 | JS |
| `frontend/js/explanations.js` | 320 | JS |
| `frontend/js/hd-data.js` | ~200 | JS |
| `frontend/css/app.css` | 575 | CSS |
| `frontend/css/base.css` | 436 | CSS |
| `frontend/css/design-tokens.css` | 350 | CSS |
| `frontend/css/design-tokens-premium.css` | 234 | CSS |
| `frontend/css/prime-self.css` | 322 | CSS |
| `frontend/css/prime-self-premium.css` | 449 | CSS |
| `frontend/css/artwork.css` | 817 | CSS |
| `frontend/css/icons.css` | 242 | CSS |
| `frontend/css/components/mobile.css` | 567 | CSS |
| `frontend/css/components/*.css` | ~7 files | CSS |
| `frontend/locales/*.json` | 5×272 | i18n |
