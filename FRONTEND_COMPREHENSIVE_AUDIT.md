# Prime Self — Frontend Comprehensive Audit

**Date:** 2026-03-09  
**Scope:** `index.html` (4 659 lines), `embed.html` (521), `embed.js` (208), `service-worker.js` (327), `manifest.json` (120), `app.css` (595)  
**Categories:** UI Validation (1.7) · UI State & Flow (1.9) · Security · Code Quality

---

## Legend

| Severity | Meaning |
|----------|---------|
| **CRITICAL** | Exploitable security flaw or data-loss risk — fix immediately |
| **HIGH** | Functional bug that directly impacts users or leaves a clear attack surface |
| **MEDIUM** | Usability / defense-in-depth gap; degrades UX or weakens security posture |
| **LOW** | Best-practice deviation or minor polish issue |

---

## 1  UI Validation (1.7)

### 1.1  Profile form fields missing `required` & ARIA attributes

| Detail | |
|---|---|
| **File + Line** | `index.html` L456–476 |
| **Category** | UI Validation |
| **Severity** | HIGH |
| **Description** | The Profile tab inputs (`p-date`, `p-time`, `p-location`, `p-tz`) have no `required`, `aria-required`, or `aria-describedby` attributes. The Chart tab equivalents (`c-date`, `c-time`, `c-location`) have all three. |
| **User Impact** | Users can submit a blank profile form; screen-reader users receive no "required" announcement; browser native validation is skipped. |
| **Recommended Fix** | Add `required aria-required="true"` to each input and an `aria-describedby` pointing to the status element. |

### 1.2  Composite form fields missing `required` & ARIA attributes

| Detail | |
|---|---|
| **File + Line** | `index.html` L881–903 |
| **Category** | UI Validation |
| **Severity** | HIGH |
| **Description** | All six composite inputs (`comp-dateA`, `comp-timeA`, `comp-locationA`, `comp-dateB`, `comp-timeB`, `comp-locationB`) lack `required`, `aria-required`, and `aria-describedby`. |
| **User Impact** | Same as 1.1. Empty composite submissions silently hit the API, which returns a cryptic error. |
| **Recommended Fix** | Mirror the chart form pattern: `required aria-required="true" aria-describedby="compositeError"`. |

### 1.3  Embed widget form missing `aria-required` / `aria-describedby`

| Detail | |
|---|---|
| **File + Line** | `embed.html` L263–273 |
| **Category** | UI Validation |
| **Severity** | MEDIUM |
| **Description** | `embed.html` uses `required` on `birthdate` and `location` but omits `aria-required` and `aria-describedby`. Birth time has no `required` at all. |
| **User Impact** | Assistive-technology users in third-party embeds get incomplete validation cues. |
| **Recommended Fix** | Add `aria-required="true" aria-describedby="embedError"` and add a visible error container with that ID. |

### 1.4  Diary form relies on JS-only validation

| Detail | |
|---|---|
| **File + Line** | `index.html` L3546–3552 (`saveDiaryEntry`) |
| **Category** | UI Validation |
| **Severity** | MEDIUM |
| **Description** | `diary-date` and `diary-title` are validated only in `saveDiaryEntry()` JavaScript. Neither input has `required` in the HTML. |
| **User Impact** | If JS fails to load or the user submits via Enter key before the handler binds, blank data reaches the API. |
| **Recommended Fix** | Add `required aria-required="true"` to both inputs. |

### 1.5  Check-in form has no HTML-level validation

| Detail | |
|---|---|
| **File + Line** | `index.html` L3823–3828 (`saveCheckIn`) |
| **Category** | UI Validation |
| **Severity** | MEDIUM |
| **Description** | Alignment score is validated only in JS (`alignmentScore < 1 || alignmentScore > 10`). The hidden `checkin-alignment-score` input and the visible alignment buttons have no `required` / `aria-required`. |
| **User Impact** | Accessibility gap; no native browser validation hint. |
| **Recommended Fix** | After a button is pressed, mark an `aria-live="polite"` region and add `aria-invalid` feedback when no score is selected. |

### 1.6  SMS phone field has minimal pattern validation

| Detail | |
|---|---|
| **File + Line** | `index.html` ~L3020 (`subscribeSMS`) |
| **Category** | UI Validation |
| **Severity** | LOW |
| **Description** | The phone number is checked only with `str.startsWith('+')`. No `pattern`, `minlength`, or `type="tel"` on the input. |
| **User Impact** | Invalid phone numbers (e.g., "+x") pass client validation and waste an API call. |
| **Recommended Fix** | Use `<input type="tel" pattern="^\+[1-9]\d{6,14}$" minlength="8">` and corresponding JS fallback. |

### 1.7  Practitioner "Add Client" uses native `alert()` for validation

| Detail | |
|---|---|
| **File + Line** | `index.html` L2620 |
| **Category** | UI Validation |
| **Severity** | LOW |
| **Description** | `if (!name) { alert('Client name required'); return; }` — native alert blocks the thread and is jarring; inconsistent with the inline `showEnhanceStatus` / `showAlert` pattern used elsewhere. |
| **User Impact** | Breaks visual consistency; focus management is lost after alert dismissal. |
| **Recommended Fix** | Replace with `showAlert('practitionerStatus', 'Client name required', 'error')`. |

---

## 2  UI State & Flow (1.9)

### 2.1  `saveCheckIn()` has no button disable / spinner

| Detail | |
|---|---|
| **File + Line** | `index.html` L3823 |
| **Category** | UI State & Flow |
| **Severity** | HIGH |
| **Description** | Unlike every other save function, `saveCheckIn()` never disables the submit button or shows a spinner during the fetch. |
| **User Impact** | Users can double-submit the daily check-in, creating duplicate records and inflating streak counts. |
| **Recommended Fix** | Add the same `btn.disabled = true; spinner.style.display = '';` / `finally` pattern used in `saveDiaryEntry` et al. |

### 2.2  Big Five & VIA assessments don't reset form after save

| Detail | |
|---|---|
| **File + Line** | `index.html` L3481 (`saveBigFive`), L3536 (`saveVIA`) |
| **Category** | UI State & Flow |
| **Severity** | MEDIUM |
| **Description** | After a successful save, radio selections remain checked. The success status auto-clears after 5 s, but the user may think they haven't saved and save again. |
| **User Impact** | Confusion; redundant API calls. |
| **Recommended Fix** | On success, reset all radio buttons: `document.querySelectorAll('[name^="bigfive-"]').forEach(r => r.checked = false)` (and similarly for VIA). |

### 2.3  Geocode status shows raw HTML to user

| Detail | |
|---|---|
| **File + Line** | `index.html` L1569 |
| **Category** | UI State & Flow |
| **Severity** | MEDIUM |
| **Description** | `s.textContent = '<span class="icon-check">...</span> Located: ...'` — `textContent` does not render HTML; the user sees literal `<span class=...>` text. |
| **User Impact** | After geocoding, the status bar shows ugly raw HTML instead of the intended checkmark icon. |
| **Recommended Fix** | Switch to `s.innerHTML = escapeHtml(locationText)` with the icon prepended, or build via `createElement`. |

### 2.4  Multiple alert() dialogs for Stripe checkout errors

| Detail | |
|---|---|
| **File + Line** | `index.html` L1273, L1289, L1292, L1296, L1312, L1320 |
| **Category** | UI State & Flow |
| **Severity** | MEDIUM |
| **Description** | Six different `alert()` calls inside `startCheckout()` and `openBillingPortal()`. These block the thread, break IME input, and clash with the app's inline-error pattern. |
| **User Impact** | Jarring UX during a payment-critical flow. |
| **Recommended Fix** | Replace with `showNotification(msg, 'error')` or a dedicated payment-error banner. |

### 2.5  Practitioner "Add Client" uses `alert()` for success & error

| Detail | |
|---|---|
| **File + Line** | `index.html` L2630, L2634 |
| **Category** | UI State & Flow |
| **Severity** | LOW |
| **Description** | `alert(data.message || 'Client added')` and `alert('Error: ' + e.message)`. |
| **User Impact** | Inconsistent with the inline status pattern; loses focus context. |
| **Recommended Fix** | Use `showAlert('practitionerStatus', ...)`. |

### 2.6  Pull-to-refresh only logs to console

| Detail | |
|---|---|
| **File + Line** | `index.html` L4399 |
| **Category** | UI State & Flow |
| **Severity** | LOW |
| **Description** | When the pull-to-refresh threshold is exceeded, the code only runs `console.log('🔄 Refreshing transit data...')` instead of actually reloading data. |
| **User Impact** | Mobile users see a refresh animation but data doesn't update. |
| **Recommended Fix** | Call the appropriate data-reload function (e.g., `loadTransits()`) if the active tab warrants it. |

---

## 3  Security

### 3.1  JWT stored in `localStorage` — XSS-exfiltrable

| Detail | |
|---|---|
| **File + Line** | `index.html` L1103 (`submitAuth`), L1208 |
| **Category** | Security |
| **Severity** | CRITICAL |
| **Description** | `localStorage.setItem('ps_token', token)` stores the JWT where any XSS payload can read it with `localStorage.getItem('ps_token')`. Combined with `unsafe-inline` CSP (finding 3.2), a single XSS vector exfiltrates the session. |
| **User Impact** | Full account takeover if any XSS is found. |
| **Recommended Fix** | Migrate to `HttpOnly`, `SameSite=Strict`, `Secure` cookies set by the Workers API. Remove token from localStorage. Update `apiFetch` to rely on credentials: `'include'`. |

### 3.2  CSP allows `unsafe-inline` for scripts

| Detail | |
|---|---|
| **File + Line** | `index.html` L9 |
| **Category** | Security |
| **Severity** | HIGH |
| **Description** | `script-src 'self' 'unsafe-inline' ...` permits execution of any inline script or event handler, negating most CSP XSS protection. |
| **User Impact** | Injected `<script>` tags or `onerror=` attributes bypass CSP entirely. |
| **Recommended Fix** | Extract all inline JS to external files, use nonce-based CSP (`'nonce-<random>'`) generated per page load from the Workers edge. Remove `'unsafe-inline'`. |

### 3.3  CSP allows `unsafe-inline` for styles

| Detail | |
|---|---|
| **File + Line** | `index.html` L10 |
| **Category** | Security |
| **Severity** | LOW |
| **Description** | `style-src 'self' 'unsafe-inline'` allows CSS-based data exfiltration (e.g., `background:url(...)` attribute selector attacks). Less critical than script-inline but still weakens defense-in-depth. |
| **User Impact** | Limited practical exploit, but violates strictest CSP guidelines. |
| **Recommended Fix** | Move remaining inline `style=""` attributes to classes; use nonce or hash for `<style>` blocks. |

### 3.4  Overview synthesis injects API data without escaping

| Detail | |
|---|---|
| **File + Line** | `index.html` L3210–3290 (`renderOverviewSynthesis`) |
| **Category** | Security |
| **Severity** | MEDIUM |
| **Description** | Template literals insert `chart.type`, `chart.profile`, `chart.strategy`, `chart.authority`, `crossName`, and `chart.notSelfTheme` directly into innerHTML without `escapeHtml()`. By contrast, `renderChart()` properly escapes all these values. |
| **User Impact** | If the API ever returns malicious content (compromised backend, supply-chain attack), it executes in the user's browser. |
| **Recommended Fix** | Wrap every dynamic value with `escapeHtml()`: `${escapeHtml(chart.type || '—')}`. |

### 3.5  `showAlert` type parameter interpolated into class without sanitisation

| Detail | |
|---|---|
| **File + Line** | `index.html` L3683 (`showEnhanceStatus`) |
| **Category** | Security |
| **Severity** | LOW |
| **Description** | `` `alert-${type}` `` is inserted into `class="alert ${alertClass}"`. All current call sites pass hardcoded strings, but if a future caller passes user input, it could inject attributes. |
| **User Impact** | No current exploit; latent risk. |
| **Recommended Fix** | Whitelist allowed types: `const safe = ['info','error','success','warning'].includes(type) ? type : 'info';` |

### 3.6  `embed.html` has no CSP meta tag

| Detail | |
|---|---|
| **File + Line** | `embed.html` L1 |
| **Category** | Security |
| **Severity** | MEDIUM |
| **Description** | The embeddable widget page has no Content-Security-Policy at all. It runs inside a third-party iframe and communicates via `postMessage`. |
| **User Impact** | A compromised host page cannot inject scripts into the iframe (same-origin blocks that), but the widget itself has no CSP defense against any of its own code paths. |
| **Recommended Fix** | Add a CSP meta tag mirroring `index.html` but tightened to the embed's needs (no Stripe, no fonts, `frame-ancestors` via HTTP header). |

### 3.7  Service worker caches API responses without token validation on replay

| Detail | |
|---|---|
| **File + Line** | `service-worker.js` L85–120 (network-first API strategy) |
| **Category** | Security |
| **Severity** | LOW |
| **Description** | Authenticated API responses are cached and served from cache on network failure. If the user logs out but the cache is not purged, stale authenticated data may appear for another user on a shared device. |
| **User Impact** | Minor data leakage on shared devices. |
| **Recommended Fix** | On logout message (`postMessage` from main page), call `caches.delete(API_CACHE)` to clear sensitive data. |

---

## 4  Code Quality

### 4.1  Monolithic 4 659-line single-file SPA

| Detail | |
|---|---|
| **File + Line** | `index.html` (entire file) |
| **Category** | Code Quality |
| **Severity** | HIGH |
| **Description** | All HTML markup, ~3 500 lines of JavaScript, and several `<style>` blocks live in a single file. This makes code review, testing, tree-shaking, and caching impossible at module granularity. |
| **User Impact** | Every minor JS change invalidates the entire cached page. Contributor velocity is low due to merge conflicts. |
| **Recommended Fix** | Extract JS into `js/app.js` (or multiple modules). Use a bundler (Vite, esbuild) for code-splitting by tab. Move remaining inline styles to CSS files. |

### 4.2  All functions pollute the global `window` scope

| Detail | |
|---|---|
| **File + Line** | `index.html` throughout |
| **Category** | Code Quality |
| **Severity** | MEDIUM |
| **Description** | Every function (`switchTab`, `calculateChart`, `shareProfile`, etc.) is defined at the top level of a `<script>` block, making them global. Name collisions with third-party scripts or future modules are likely. |
| **User Impact** | Debugging difficulty; accidental overwrite risk. |
| **Recommended Fix** | Wrap in an IIFE or ES module. Expose only the API needed by `onclick` handlers via a namespace (e.g., `window.PrimeSelf = { switchTab, ... }`). |

### 4.3  Duplicate CSS selectors across `app.css` and component files

| Detail | |
|---|---|
| **File + Line** | `app.css` throughout (marked `[DUP]`) |
| **Category** | Code Quality |
| **Severity** | LOW |
| **Description** | `app.css` contains 20+ selectors explicitly marked `[DUP]` that also exist in component files (`header.css`, `tabs.css`, `buttons.css`, etc.). This makes it unclear which file is authoritative. |
| **User Impact** | Risk of one file overriding the other unexpectedly; larger CSS payload. |
| **Recommended Fix** | Consolidate: keep each selector in exactly one file and delete the duplicate. The `[DUP]` markers make this straightforward. |

### 4.4  Hardcoded API base URL

| Detail | |
|---|---|
| **File + Line** | `index.html` ~L1095 (`const API = 'https://prime-self-api.adrper79.workers.dev'`) |
| **Category** | Code Quality |
| **Severity** | MEDIUM |
| **Description** | The API URL is baked into the HTML. Switching between staging and production requires editing the monolith. |
| **User Impact** | Deployment friction; risk of shipping staging URL to production. |
| **Recommended Fix** | Inject via a build-time env variable or derive from `window.location` conventions. |

### 4.5  Inconsistent error-display patterns

| Detail | |
|---|---|
| **File + Line** | Various (see 2.4, 2.5, 1.7) |
| **Category** | Code Quality |
| **Severity** | MEDIUM |
| **Description** | Four different error-display mechanisms coexist: native `alert()`, `showEnhanceStatus()`, `showAlert()`, and `showNotification()`. Some auto-dismiss; some do not. |
| **User Impact** | Inconsistent UX; harder to add a global error interceptor or analytics tracker. |
| **Recommended Fix** | Converge on a single `showNotification(msg, type)` utility (already implemented). Retire `alert()` calls and unify `showEnhanceStatus`/`showAlert` into it. |

### 4.6  `typeof` guards suggest fragile load order

| Detail | |
|---|---|
| **File + Line** | `index.html` L3203, L3243, L3247 |
| **Category** | Code Quality |
| **Severity** | LOW |
| **Description** | Checks like `typeof getExplanation === 'function'`, `typeof isMotorCenter === 'function'`, `typeof getCrossName === 'function'` imply these helpers may or may not exist at runtime, suggesting a fragile dependency graph. |
| **User Impact** | Silent degradation: features silently vanish without an error if a dependency fails to load. |
| **Recommended Fix** | Define stubs or guarantee load order. When functions are truly optional, log a warning. |

### 4.7  `embed.js` auto-init may fire before DOM is ready

| Detail | |
|---|---|
| **File + Line** | `embed.js` L204–208 |
| **Category** | Code Quality |
| **Severity** | LOW |
| **Description** | The auto-init block `document.querySelectorAll('[data-primeself-widget]').forEach(...)` runs immediately at script parse time. If the script tag is in `<head>`, widgets in `<body>` won't be found. |
| **User Impact** | Third-party integrators placing `<script>` in `<head>` get no widget. |
| **Recommended Fix** | Wrap in `DOMContentLoaded` listener or document the `defer` / end-of-body requirement. |

### 4.8  `service-worker.js` STATIC_ASSETS list may drift from actual files

| Detail | |
|---|---|
| **File + Line** | `service-worker.js` L13–55 |
| **Category** | Code Quality |
| **Severity** | LOW |
| **Description** | 40+ file paths are hardcoded in the `STATIC_ASSETS` array. Adding or renaming a file without updating this list causes it to be uncached (or the SW install to fail if a removed file is listed). |
| **User Impact** | Broken offline experience for newly added assets; failed SW install blocks all caching. |
| **Recommended Fix** | Generate the asset list at build time (e.g., `workbox-precaching` or a custom script). |

---

## 5  Accessibility (supplementary findings)

### 5.1  Tooltip `[title]` on help icons not accessible

| Detail | |
|---|---|
| **File + Line** | `app.css` L420 (`.help-icon::after { content: attr(data-tooltip) }`) |
| **Category** | Accessibility |
| **Severity** | MEDIUM |
| **Description** | Tooltips are rendered via CSS `::after` pseudo-element and `title` attribute. Screen readers announce `title` inconsistently; `::after` content is not announced by most readers. |
| **User Impact** | Screen-reader users miss explanatory tooltips. |
| **Recommended Fix** | Use `aria-describedby` pointing to a visually-hidden `<span>` containing the tooltip text, or use a JavaScript tooltip component with `role="tooltip"`. |

### 5.2  Mobile "More" drawer missing focus trap

| Detail | |
|---|---|
| **File + Line** | `index.html` L4346 (`toggleMobileMore`) |
| **Category** | Accessibility |
| **Severity** | MEDIUM |
| **Description** | The "More" overflow drawer sets `role="dialog"` but does not trap focus inside the panel. Keyboard users can Tab behind the drawer into hidden content. |
| **User Impact** | Keyboard and screen-reader users get lost behind the modal overlay. |
| **Recommended Fix** | Add a focus-trap: on open, focus the first interactive element; on Tab past the last element, cycle back to the first. Restore focus to the trigger on close. |

### 5.3  Assessment radio groups lack `fieldset`/`legend`

| Detail | |
|---|---|
| **File + Line** | `index.html` L3420 (`renderBigFiveQuestions`), L3502 (`renderVIAQuestions`) |
| **Category** | Accessibility |
| **Severity** | LOW |
| **Description** | Each question's radio group is rendered as a `<div>` with `<label>` elements. Proper grouping requires `<fieldset>` with a `<legend>` containing the question text. |
| **User Impact** | Screen readers don't associate the radio buttons with the question. |
| **Recommended Fix** | Wrap each question in `<fieldset><legend>Q text</legend>...radios...</fieldset>`. |

---

## Summary Dashboard

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| UI Validation (1.7) | 0 | 2 | 3 | 2 | **7** |
| UI State & Flow (1.9) | 0 | 1 | 3 | 2 | **6** |
| Security | 1 | 1 | 3 | 3 | **8** |
| Code Quality | 0 | 1 | 3 | 4 | **8** |
| Accessibility | 0 | 0 | 2 | 1 | **3** |
| **Totals** | **1** | **5** | **14** | **12** | **32** |

---

## Prioritised Fix Order

1. **3.1** JWT → HttpOnly cookie (CRITICAL)
2. **3.2** Remove `unsafe-inline` from script-src (HIGH)
3. **1.1 + 1.2** Add `required` / ARIA to profile & composite forms (HIGH)
4. **2.1** Add double-submit protection to `saveCheckIn` (HIGH)
5. **4.1** Begin extracting JS from monolith (HIGH — enables 3.2)
6. **3.4** Escape API data in overview synthesis (MEDIUM)
7. **2.3** Fix geocode raw-HTML display bug (MEDIUM)
8. **2.4** Replace `alert()` in checkout flow (MEDIUM)
9. **3.6** Add CSP to `embed.html` (MEDIUM)
10. Remaining MEDIUM and LOW findings in parallel
