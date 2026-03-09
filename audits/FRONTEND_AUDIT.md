# Prime Self — Comprehensive Frontend Audit

**Auditor:** Automated Code Audit  
**Date:** 2025-01-20  
**Scope:** All files under `frontend/` — index.html (4,636 lines), 12 CSS files, 3 JS modules, manifest.json, service-worker.js, embed.html, embed.js, 5 locale JSONs  
**Overall Grade: C+**

---

## 1. Tab Inventory

| # | Tab ID | Label | Route/Hash | JS Functions | Mobile Nav | Grade |
|---|--------|-------|------------|-------------|------------|-------|
| 1 | `tab-chart` | Chart | — | `calculateChart`, `renderChart`, `renderAstroChart` | ✅ "Chart" | **A** |
| 2 | `tab-profile` | Profile | — | `generateProfile`, `renderProfile`, `shareProfile`, `openShareModal` | ✅ "Keys" ⚠ | **A-** |
| 3 | `tab-enhance` | Enhance | — | `saveValidation`, `saveBigFive`, `saveVIA`, `renderBigFiveQuestions`, `renderVIAQuestions` | ✅ "Astro" ⚠ | **B+** |
| 4 | `tab-diary` | Diary | — | `saveDiaryEntry`, `loadDiaryEntries`, `editDiaryEntry`, `deleteDiaryEntry` | ✅ "Diary" | **A-** |
| 5 | `tab-checkin` | Check-In | — | `saveCheckIn`, `loadCheckInStats`, `selectAlignment`, `renderAlignmentChart` | ❌ | **B** |
| 6 | `tab-transits` | Transits | — | `loadTransits`, `renderTransits` | ✅ "Transits" | **B+** |
| 7 | `tab-composite` | Composite | — | `generateComposite`, `renderComposite` | ❌ | **B** |
| 8 | `tab-rectify` | Rectify | — | `runRectification`, `renderRectification` | ❌ | **B** |
| 9 | `tab-practitioner` | Practitioner | — | `addClient`, `loadRoster`, `renderRoster` | ❌ | **B-** |
| 10 | `tab-clusters` | Clusters | — | `createCluster`, `loadClusters`, `viewClusterDetail`, `addMemberToCluster`, `synthesizeCluster` (stub), `leaveCluster` | ❌ | **C+** |
| 11 | `tab-sms` | SMS | — | `subscribeSMS`, `unsubscribeSMS` | ❌ | **C** |
| 12 | `tab-onboarding` | Onboarding | — | `startOnboarding`, `renderOnboardingStep` | ❌ | **B-** |
| 13 | `tab-saved` | Saved | — | `loadHistory`, `renderHistory`, `loadSingleProfile` | ❌ | **B** |

### Tab Summary
- **13 tabs total** — only **5 accessible via mobile bottom nav** (38%)
- **0 hash routes** — no deep linking, no browser back/forward, no shareable URLs
- **2 mislabeled** on mobile nav: Profile → "Keys", Enhance → "Astro"
- `synthesizeCluster()` is a **stub** that shows "Coming soon!"
- `shareChartImage()` and `downloadChart()` are **stubs**

---

## 2. Responsive Design — Grade: B

### Strengths
- Dedicated `mobile.css` with 44px touch targets, iOS zoom prevention (16px font), bottom nav, landscape mode, high-contrast mode, and `prefers-reduced-motion` support
- Inline CSS provides breakpoints at 768px, 600px, 480px
- Form grids collapse on mobile (2-col → 1-col)
- Pull-to-refresh gesture with visual indicator
- Tab bar scrolls horizontally on narrow screens

### Issues
| ID | Severity | Issue |
|----|----------|-------|
| RES-1 | **High** | 8 of 13 tabs unreachable on mobile (no nav item) — Check-In, Composite, Rectify, Practitioner, Clusters, SMS, Onboarding, Saved |
| RES-2 | Medium | Mobile nav label mismatch: "Keys" ≠ "Profile", "Astro" ≠ "Enhance" |
| RES-3 | Medium | Pull-to-refresh only triggers console.log, doesn't actually refresh data |
| RES-4 | Low | Share modal has `border-radius: 0` on mobile — loses visual polish |
| RES-5 | Low | No responsive image strategy (`srcset`, `<picture>`, WebP) |

---

## 3. Accessibility — Grade: C

### Strengths
- Tab bar uses `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`
- Auth overlay has `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- `base.css` defines `.sr-only` utility class
- `:focus-visible` styles on buttons and inputs (design-tokens.css line 199)
- `forms.css` has `.form-live-region` with `aria-live="polite"`
- Language switcher uses `role="listbox"`, `aria-expanded`
- `mobile.css` includes `prefers-reduced-motion` and high-contrast support

### Issues
| ID | Severity | Issue |
|----|----------|-------|
| A11Y-1 | **Critical** | **No focus trap** on modals (auth overlay, pricing modal, share modal) — keyboard users can Tab behind overlays |
| A11Y-2 | **Critical** | `<a href="#" onclick="...">` in mobile nav — uses anchor without meaningful href; should be `<button>` |
| A11Y-3 | **High** | `alert()` and `confirm()` used for user interaction (addClient, deleteDiaryEntry, leaveCluster, subscribeSMS) — not styleable, not fully accessible, blocks screen readers |
| A11Y-4 | **High** | Skip-to-content link defined in `base.css` (`.skip-link`) but **no `<a class="skip-link">` exists in HTML** |
| A11Y-5 | **High** | Tab panels lack consistent `role="tabpanel"` and `aria-labelledby` attributes |
| A11Y-6 | Medium | Big Five radio buttons have `style="width:auto"` overriding touch target sizing |
| A11Y-7 | Medium | Testimonial carousel has no pause button, no `aria-roledescription="carousel"`, no live region announcements |
| A11Y-8 | Medium | Alignment score buttons (1-10) lack `aria-pressed` or `role="radio"` |
| A11Y-9 | Low | Icon-only buttons (close modal, dismiss install) lack `aria-label` |
| A11Y-10 | Low | Canvas chart (`alignmentChart`) has no text alternative |

---

## 4. CSS Architecture & Design System — Grade: C+

### Strengths
- Comprehensive design token system in `design-tokens.css` (~310 lines): color palette, semantic tokens, fluid typography with `clamp()`, spacing scale, layout breakpoints, shadows, transitions, component-specific tokens
- 8 well-structured component CSS files using token references
- `prime-self.css` serves as a single-import aggregator with `@import`
- Custom icon system (`icons.css`) with inline SVG data URIs — eliminates external icon font dependency
- `artwork.css` (762 lines) provides decorative art elements

### Issues
| ID | Severity | Issue |
|----|----------|-------|
| CSS-1 | **Critical** | **~500 lines of inline `<style>` in index.html** duplicate and override component CSS files — creates specificity conflicts and maintenance debt |
| CSS-2 | **Critical** | **Two competing token files**: `design-tokens.css` (gold/purple theme) vs `design-tokens-premium.css` (Porsche red/Apple theme) define the **same custom properties with different values** (e.g., `--interactive-primary` = gold vs Porsche red, `--font-body` = system-ui vs SF Pro). Which theme is active depends on load order. |
| CSS-3 | **High** | **Z-index scale mismatch**: `design-tokens.css` uses 0–70; `design-tokens-premium.css` uses 0–700; inline CSS uses raw values (100, 200, 250, 1000, 2000, 10000) |
| CSS-4 | **High** | JS render functions contain **hardcoded color values**: `#d4af37`, `#555`, `#888`, `#333`, `#90c890`, `rgba(201,168,76,0.08)`, `rgba(106,79,200,0.1)` — bypasses token system entirely |
| CSS-5 | **High** | `prime-self.css` imports 7 files via `@import url()` but **excludes** `design-tokens-premium.css`, `mobile.css`, `artwork.css`, `icons.css` — incomplete aggregator |
| CSS-6 | Medium | JS-generated notifications use **inline styles created dynamically** (`style.cssText = ...`) instead of CSS classes |
| CSS-7 | Medium | PWA install banner is 100% inline styles — no reusable class |
| CSS-8 | Medium | `design-tokens.css` defines fluid `clamp()` typography; `design-tokens-premium.css` overrides with **fixed pixel sizes** — responsiveness degraded when premium loads |
| CSS-9 | Low | `@import url()` in `prime-self.css` creates waterfall requests — 7 sequential HTTP requests |

### Design System Adherence Score: **52/100**

Breakdown:
- Token usage in CSS files: **85%** (component CSS consistently uses tokens)
- Token usage in inline `<style>`: **40%** (mixed raw values and tokens)
- Token usage in JS-rendered HTML: **15%** (mostly hardcoded colors/sizes)
- Premium/base token conflict resolution: **0%** (no clear hierarchy)
- Single source of truth: **30%** (dual token files, inline overrides)

---

## 5. PWA Correctness — Grade: B

### Strengths
- `manifest.json` complete: name, short_name, description, start_url, scope, display:standalone, 8 icon sizes (72–512 incl. maskable), screenshots, shortcuts, categories
- `service-worker.js` (~230 lines): cache-first for static assets, network-first for API, push notification support, background sync, periodic transit sync
- `offline-transits.js` (583 lines): IndexedDB with 3 stores, 7-day prefetch, offline fallback with sync queue, 24h cache age, 14-day cleanup
- Install prompt captured and custom banner shown

### Issues
| ID | Severity | Issue |
|----|----------|-------|
| PWA-1 | **High** | SW cache list (22 assets) **misses**: `artwork.css`, `icons.css`, `prime-self.css`, `prime-self-premium.css` — app may lose styling offline |
| PWA-2 | Medium | No offline fallback page — failed network requests for HTML return generic browser error |
| PWA-3 | Medium | Cache busting relies on manually incrementing `CACHE_VERSION` — no content-hash filenames |
| PWA-4 | Medium | `orientation: "portrait-primary"` in manifest — restricts tablet landscape |
| PWA-5 | Low | Install banner `<style>` injected via JS (`@keyframes slideUp`) — duplicated on every page load |
| PWA-6 | Low | SW update check interval (1 hour) may delay critical updates |

---

## 6. JavaScript Quality — Grade: C

### Strengths
- `escapeHtml()` used consistently in most render functions
- `apiFetch()` centralizes API calls with Bearer token, handles 401 (re-auth), 429 (rate limit), 403 (upgrade prompt)
- Consistent loading pattern: disable button → show spinner → try/catch → re-enable
- IIFE modules (`i18n.js`, `lazy.js`, `offline-transits.js`) avoid global namespace pollution
- `embed.js` has strict origin validation for postMessage

### Issues
| ID | Severity | Issue |
|----|----------|-------|
| JS-1 | **Critical** | **~2,500+ lines of JS in a single inline `<script>` block** — no modules, no bundling, no code splitting; every function is a window global |
| JS-2 | **High** | `onclick="viewClusterDetail('${c.id}')"` — string interpolation in HTML attribute. If `c.id` contains `'`, it breaks the handler. If API is compromised, it's XSS. |
| JS-3 | **High** | `renderComposite()` renders `d.area` and `d.note` **without `escapeHtml()`** — XSS from API response |
| JS-4 | **High** | `showAlert()` renders `message` parameter **as raw HTML** — any caller passing unsanitized input creates XSS |
| JS-5 | **High** | `JSON.parse(localStorage.getItem('user') || '{}')` in `shareToSocial()` — no try/catch; corrupted localStorage crashes the function |
| JS-6 | Medium | `switchTab` monkey-patching in second `<script>` block references `originalSwitchTab` — function must be fully defined before that script runs; fragile ordering |
| JS-7 | Medium | `escapeHtml()` uses DOM-based approach (createElement → textContent → innerHTML) — ~10x slower than string replacement; called hundreds of times in render loops |
| JS-8 | Medium | Pull-to-refresh `touchend` calculates `pullDistance = pullStartY - clientY` — **direction is inverted** from the `touchmove` handler |
| JS-9 | Medium | `setInterval` for testimonial carousel (7s) runs permanently — no cleanup on visibility change or navigation |
| JS-10 | Low | Social proof stats fall back to **hardcoded fake numbers** ("2,847" / "18,392") on API failure — misleading to users |
| JS-11 | Low | No TypeScript, no JSDoc (except share functions), no linting config |
| JS-12 | Low | `exportPDF()` uses `window.open(url, '_blank')` — no auth header passed; relies on public endpoint or cookies |

---

## 7. Security — Grade: C-

| ID | Severity | Issue |
|----|----------|-------|
| SEC-1 | **Critical** | **No Content Security Policy** (CSP) — neither meta tag nor header. Allows inline scripts, inline styles, and arbitrary resource loading. |
| SEC-2 | **Critical** | XSS in `renderComposite()` — API fields `d.area` and `d.note` rendered as HTML without escaping |
| SEC-3 | **Critical** | XSS in `showAlert()` — `message` parameter injected as innerHTML without escaping |
| SEC-4 | **High** | String interpolation in `onclick` attributes with API-sourced IDs (`c.id`, `p.id`, `entry.id`) — quote-breaking → arbitrary JS execution |
| SEC-5 | **High** | Auth token stored as plaintext in `localStorage` — accessible to any XSS payload |
| SEC-6 | Medium | `socialProof` API call uses raw `fetch()` instead of `apiFetch()` — no auth, no error handling |
| SEC-7 | Medium | Install banner uses `innerHTML` to create UI — DOM injection point |
| SEC-8 | Medium | No CSRF token or SameSite cookie strategy evident |
| SEC-9 | Low | Secrets.txt at repo root (not in frontend, but worth flagging) |

---

## 8. Internationalization (i18n) — Grade: D+

### Strengths
- `i18n.js` is well-architected: locale detection chain (localStorage → URL → navigator → default), async JSON loading with cache, dot-path key resolution, `{{placeholder}}` interpolation, DOM translation via `data-i18n*` attributes, `Intl.DateTimeFormat` and `Intl.NumberFormat`
- 5 locale files (en, es, pt, de, fr) with language switcher

### Issues
| ID | Severity | Issue |
|----|----------|-------|
| I18N-1 | **Critical** | **All JS-rendered content is hardcoded English** — none of the 20+ render functions use `t()` or `data-i18n`. Only static HTML elements can be translated. |
| I18N-2 | **High** | Assessment questions (20 Big Five + 24 VIA = 44 questions) are hardcoded English strings in JS constants |
| I18N-3 | **High** | Mobile nav labels ("Chart", "Keys", "Astro", "Transits", "Diary") are hardcoded |
| I18N-4 | **High** | Notification messages, alert texts, share text, pricing modal content — all hardcoded |
| I18N-5 | Medium | No RTL support anywhere — `dir="ltr"` in manifest, no `[dir="rtl"]` CSS rules |
| I18N-6 | Medium | `en.json` has only ~186 keys — likely covers <20% of visible text |
| I18N-7 | Low | Date formatting (`toLocaleDateString('en-US', ...)`) hardcoded to `en-US` in multiple functions |

---

## 9. Performance — Grade: C-

| ID | Severity | Issue |
|----|----------|-------|
| PERF-1 | **Critical** | **Single 4,636-line HTML file** (~180KB+ unminified) — no code splitting, no lazy loading of JS, no bundling, no minification, no compression strategy |
| PERF-2 | **High** | All 13 tab panels rendered in DOM at page load — even hidden tabs create hundreds of DOM nodes |
| PERF-3 | **High** | Big Five (100 radio inputs) + VIA (120 radio inputs) rendered on `DOMContentLoaded` — 220 interactive elements created whether or not users visit Enhance tab |
| PERF-4 | **High** | 80 star divs + 30 particle divs created on page load for ambient art — 110 animated elements |
| PERF-5 | **High** | `@import url()` chain in `prime-self.css` creates 7 sequential HTTP requests (waterfall) |
| PERF-6 | Medium | Font references (`SF Pro Display`) with no `@font-face`, no `preload`, no fallback loading strategy — invisible text flash (FOIT) risk |
| PERF-7 | Medium | `testimonialInterval` runs every 7s permanently — even when carousel is off-screen |
| PERF-8 | Medium | Multiple inline `<style>` elements injected dynamically for notifications, share modal, install banner |
| PERF-9 | Medium | No image optimization: no `srcset`, no `loading="lazy"` (lazy.js handles this but only for `data-src` images), no WebP/AVIF |
| PERF-10 | Low | `escapeHtml()` DOM method called in tight loops (transit rows, history items, cluster members) — slower than string regex |

---

## 10. UX & Visual Balance — Grade: B-

### Strengths
- Consistent card-based layout across all tabs
- Loading states with spinners and descriptive text
- Empty states with icons, titles, and descriptive copy
- Cosmic dark theme with gold/purple accents creates distinctive brand
- Testimonials carousel with auto-rotation and dot navigation
- Social proof stats with animated number counting
- Tiered pricing modal with clear feature breakdown
- Share modal with social platform options
- Diary entry types with emoji indicators

### Issues
| ID | Severity | Issue |
|----|----------|-------|
| UX-1 | **High** | **13 tabs is overwhelming** — no grouping, no progressive disclosure, no secondary navigation |
| UX-2 | **High** | 8 features completely **inaccessible on mobile** (no nav path to Composite, Rectify, Practitioner, Clusters, SMS, Onboarding, Saved, Check-In) |
| UX-3 | **High** | Long assessment forms (20 + 24 questions) with **no progress indicator**, no save-as-you-go, no pagination |
| UX-4 | Medium | Tab label mismatch between desktop and mobile (Profile/Keys, Enhance/Astro) — confuses user mental model |
| UX-5 | Medium | Fake fallback stats ("2,847 weekly users", "18,392 profiles") displayed on API failure — erodes trust if users notice |
| UX-6 | Medium | "Coming soon" stubs (synthesizeCluster, shareChartImage, downloadChart) visible to users with no disable state |
| UX-7 | Medium | No dark/light mode toggle — dark theme hardcoded; premium CSS defines some light mode rules but no user control |
| UX-8 | Low | No breadcrumb navigation within nested views (cluster detail → back to list exists, but no global pattern) |
| UX-9 | Low | No onboarding for first-time users before they reach the Onboarding tab |

---

## Priority Remediation Roadmap

### Phase 1 — Security & Accessibility Fixes (Week 1-2)
1. Add CSP meta tag: `<meta http-equiv="Content-Security-Policy" content="...">`
2. Escape `d.area`, `d.note` in `renderComposite()`; escape `message` in `showAlert()`
3. Replace `onclick="fn('${id}')"` patterns with `data-*` attributes + event delegation
4. Implement focus trap for all modals (auth, pricing, share)
5. Add skip-to-content `<a>` in HTML body
6. Replace `alert()`/`confirm()` with accessible modal dialogs

### Phase 2 — Architecture & Performance (Week 3-4)
7. Extract inline `<style>` to CSS file; remove duplicates
8. Resolve token conflict: pick ONE token file as canonical, remove the other or namespace it (e.g., `data-theme="premium"`)
9. Normalize z-index scale across all files
10. Move inline JS to external module files; introduce ES module `import/export`
11. Lazy-render tab content (mount on first activation, not on page load)
12. Defer Big Five/VIA question rendering to Enhance tab activation

### Phase 3 — i18n & UX (Week 5-6)
13. Wrap all render function text in `t()` calls
14. Translate assessment questions (use JSON key arrays)
15. Group tabs: Core (Chart, Profile, Transits) | Growth (Enhance, Diary, Check-In) | Analysis (Composite, Rectify, Clusters) | Settings (SMS, Practitioner, Onboarding, Saved)
16. Add tab grouping or "More" overflow menu on mobile
17. Add progress bar to Big Five / VIA assessments
18. Remove fake fallback stats; show "—" on API failure

### Phase 4 — PWA & Polish (Week 7-8)
19. Add missing CSS files to SW cache list
20. Create offline fallback page
21. Add content-hash filenames for cache busting
22. Convert `@import` chain to parallel `<link>` tags (already partially done)
23. Add `Intersection Observer` pause for testimonial carousel when off-screen
24. Implement hash-based routing (`#tab=profile`) for deep linking

---

## File Inventory

| File | Lines | Role | Token Usage | Issues |
|------|-------|------|-------------|--------|
| `index.html` | 4,636 | Monolith SPA (HTML + CSS + JS) | Mixed | Inline CSS, global JS, no modules |
| `css/design-tokens.css` | ~310 | Foundation tokens (gold/purple) | — | Conflicts with premium |
| `css/design-tokens-premium.css` | ~250 | Premium tokens (Porsche red) | — | Overrides base tokens |
| `css/base.css` | ~310 | Reset + typography + utilities | ✅ Good | — |
| `css/prime-self.css` | ~270 | Import aggregator + app components | ✅ Good | Missing 4 CSS files |
| `css/prime-self-premium.css` | 438 | Premium component overrides | ✅ Good | Conflicts with base components |
| `css/artwork.css` | 762 | Decorative art elements | ✅ Good | — |
| `css/icons.css` | 242 | SVG icon system | ✅ Good | — |
| `css/components/buttons.css` | ~130 | Button system | ✅ Excellent | — |
| `css/components/cards.css` | ~180 | Card system | ✅ Excellent | — |
| `css/components/forms.css` | ~200 | Form system | ✅ Excellent | — |
| `css/components/tabs.css` | ~120 | Tab system | ✅ Excellent | — |
| `css/components/modals.css` | ~140 | Modal system | ✅ Excellent | No focus trap logic |
| `css/components/alerts.css` | ~130 | Alert + toast system | ✅ Excellent | — |
| `css/components/layout.css` | ~170 | Layout utilities | ✅ Excellent | — |
| `css/components/mobile.css` | ~300 | Mobile optimizations | ✅ Good | Good coverage |
| `js/i18n.js` | ~280 | Internationalization | N/A | Well-architected but unused in JS renders |
| `js/lazy.js` | ~175 | Lazy loading + perf metrics | N/A | Good IntersectionObserver usage |
| `js/offline-transits.js` | 583 | IndexedDB + offline cache | N/A | Excellent offline strategy |
| `service-worker.js` | ~230 | Service Worker | N/A | Missing CSS files in cache |
| `manifest.json` | 107 | PWA manifest | N/A | Complete |
| `embed.html` | 511 | Embeddable chart widget | Partial | Standalone with its own styles |
| `embed.js` | ~170 | Embed iframe wrapper | N/A | Good origin validation |

---

## Score Summary

| Category | Grade | Weight | Weighted |
|----------|-------|--------|----------|
| Tab Completeness | B- | 10% | 2.7 |
| Responsive Design | B | 10% | 3.0 |
| Accessibility | C | 15% | 3.0 |
| CSS Architecture | C+ | 10% | 2.3 |
| PWA | B | 10% | 3.0 |
| JavaScript Quality | C | 15% | 3.0 |
| Security | C- | 15% | 2.6 |
| Internationalization | D+ | 5% | 0.7 |
| Performance | C- | 5% | 0.9 |
| UX & Visual Balance | B- | 5% | 1.4 |
| **Weighted Total** | | **100%** | **22.5/40 → C+** |

**Design System Adherence Score: 52/100**

---

## Key Takeaways

1. **The CSS design system is well-crafted** — component files are excellent, token system is comprehensive. But it's undermined by a competing premium token file and ~500 lines of inline overrides.

2. **The monolithic index.html is the core problem.** It blocks every improvement: code splitting, tree shaking, lazy loading, linting, testing, and team collaboration all require extracting JS to modules.

3. **Security is the most urgent concern.** Missing CSP, multiple XSS vectors via unsanitized API data and onclick interpolation, and plaintext token storage need immediate attention.

4. **i18n infrastructure exists but is essentially unused.** The translation system is well-built but only applied to static HTML — none of the JS-rendered content (which is the majority of what users see) passes through it.

5. **Mobile experience is incomplete.** Users on phones can only reach 5 of 13 features via the bottom nav bar.
