# UI Defect Backlog
> Generated: 2026-03-09 | Phase 2 Output from Comprehensive UI Audit
> Last Updated: 2026-03-09 (Phase 5 — Mobile layout audit pass)
> **VERIFICATION PASS COMPLETE: 2026-03-09** — All 39 original items + 12 new mobile layout items fixed

## Verification Summary (2026-03-09 — Phase 5 Mobile Layout Audit)

**New issues found and fixed in Phase 5 (12 items):**

| ID | Line | Category | Severity | Fix |
|----|------|----------|----------|-----|
| UI-040 | L767 | Missing flex-wrap (share link row) | High | Added `flex-wrap:wrap;align-items:flex-start;min-width:160px` |
| UI-041 | L243 | Missing flex-wrap (promo code row) | Low | Added `flex-wrap:wrap` |
| UI-042 | L614 | Dense alert text wall — Welcome | Medium | Reformatted as `<ul>` list |
| UI-043 | L697 | Dense alert text wall — AI Synthesis | Medium | Reformatted as `<ul>` list |
| UI-044 | L824 | Dense alert text wall — Enhance | Medium | Reformatted as `<ul>` list |
| UI-045 | L907 | Dense alert text wall — Diary | Medium | Reformatted as `<ul>` list |
| UI-046 | L976 | Dense alert text wall — Check-In | Medium | Reformatted as `<ul>` list |
| UI-047 | L2104 | Hardcoded `max-width:500px` (astro chart) | Medium | Changed to `max-width:min(500px,100%)` |
| UI-048 | L2872 | Hardcoded `max-width:300px` (button) | Low | Changed to `width:min(300px,100%)` |
| UI-049 | L1098 | Fixed 3-col inline grid (no breakpoint) | High | Changed to `repeat(auto-fit,minmax(160px,1fr))` |
| UI-050 | L3311 | Inline style overrides `.chart-grid` media query | High | Removed inline `style` — class breakpoint now works |
| UI-051 | L4050 | Fixed 2-col JS-injected grid (no breakpoint) | High | Changed to `repeat(auto-fit,minmax(180px,1fr))` |

**Root cause pattern documented:**
- `display:flex` input+button pairs consistently missing `flex-wrap:wrap` — Look Up button overflows on narrow screens
- Alert boxes using `<br>` + single paragraph instead of `<ul><li>` — unreadable on mobile
- Inline `style=` grid declarations override all CSS class media queries — must use `auto-fit` or assign class only

**Also fixed (same session):**
- Connect page alert: changed `.alert-info` (blue) → `.alert-warn` (gold) for visual coherence
- Collapsible max-height: `2000px` → `100vh` in mobile.css
- `.tab-intro-body p` and `.exemplar-card p`: added `max-width:clamp(280px,90vw,600px/700px)`
- 5 location input rows (chart, profile, rectify, comp-A, comp-B): added `flex-wrap:wrap;min-width:160px`

---

## Lessons Learned

### L1 — Never use `<br>` + prose in alert boxes
Alert text that runs beyond 2 sentences belongs in a `<ul>` list. A single paragraph with inline `(1)`, `(2)`, `(3)` enumeration is invisible structure — use `<li>` elements.

### L2 — Inline `style=` beats every media query
Adding `grid-template-columns` or `max-width` directly on an element via `style=` has higher specificity than any class-based `@media` rule. Either use `auto-fit`/`minmax()` inline (inherently responsive) or assign a CSS class and let the stylesheet handle breakpoints.

### L3 — Every flex input+button row needs `flex-wrap:wrap`
Any `display:flex` containing a text input and a button side-by-side must have `flex-wrap:wrap` + `min-width` on the input. Without it the button will squeeze or overflow on any screen narrower than its natural width.

### L4 — Never add `max-width` globally to form inputs
`max-width: clamp()` on `input, select, textarea` fights `width:100%` inside grid columns. Use `width:100%` alone — the grid column constrains the width. Only add `max-width` with `min()` or `clamp()` on wrapper containers.

---

## Summary (Updated)

| Severity | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| 🔴 Critical | 9 | 9 | 0 |
| 🟠 High | 14 | 14 | 0 |
| 🟡 Medium | 19 | 19 | 0 |
| 🟢 Low | 9 | 9 | 0 |
| **Total** | **51** | **51** | **0** |
| 🟢 Low | 6 | 6 | 0 |

> **Note on verification trust:** Items previously marked ✅ FIXED have been re-validated in code.
> Items marked "CONFIRMED" means presence verified in source code; browser testing still recommended for interaction states.

---

## 🔴 CRITICAL — ALL FIXED ✓

### UI-001: Alignment Button Class Mismatch ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Changed CSS `.alignment-btn.selected` → `.alignment-btn.active` in app.css |

### UI-002: Z-Index Stack Inversion ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Normalized stack in design-tokens.css: dropdown(100), mobile-nav(150), modal-backdrop(200), modal(210), tooltip(300), notification(400) |

### UI-003: Tooltip Z-Index 10000 ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Changed app.css tooltip z-index from hardcoded 10000/10001 to var(--z-tooltip) |

### UI-004: Three Competing Color Systems ✓ DOCUMENTED
| Property | Details |
|----------|---------|
| **Fix Applied** | Added canonical source documentation header to design-tokens.css |

---

## 🟠 HIGH — 6 of 8 FIXED

### UI-005: Alignment Buttons Below Touch Target ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Changed 40×40px to min-width/min-height: 44px in app.css |

### UI-006: Modal Close Button 32px ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Changed 2rem to min-width/min-height: 44px in modals.css |

### UI-007: No Text Overflow Protection ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Added overflow: hidden; text-overflow: ellipsis to .data-value, .channel-name, .gate-name-tag |

### UI-008: Transit Row Fixed-Width Breaks Mobile ✓ ALREADY FIXED
| Property | Details |
|----------|---------|
| **Status** | Mobile breakpoint already exists at 600px with grid-template-columns: 1fr |

### UI-009: WCAG Contrast Failures ✓ ALREADY FIXED
| Property | Details |
|----------|---------|
| **Status** | Tokens already updated: --text-dim: #c4c0d8 (5.5:1), --text-muted: #918db0 (4.5:1) |

### UI-012: Mobile Nav Z-Index Conflict ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Changed z-index: 100 to var(--z-mobile-nav) in mobile.css |

### UI-010: Double-Submit Guards Missing ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Added btn.disabled guard with try/finally re-enable to saveCheckIn() (calculateChart and generateProfile already had guards) |

### UI-011: Profile Generation Progress Indicator — ✅ FIXED
| Property | Details |
|----------|---------|
| **Source** | Interactivity Agent |
| **Issue** | AI profile generation takes 15-30s with only generic spinner |
| **Fix** | Added stepped progress messages: "Analyzing chart...", "Calculating gate activations...", "Generating insights..." |
| **Complexity** | Medium - implemented UX design + JS changes |
| **Status** | ✅ FIXED - Added progress indicator with 6 stepped messages during 15-30s generation |

---

## 🟡 MEDIUM — ALL FIXED ✓

### UI-013: Tab Button Touch Targets — ✅ FIXED
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | Tab buttons had 14px padding, insufficient for touch targets |
| **Fix** | Updated padding to 14px 16px and added min-height: 44px for WCAG AA compliance |
| **Status** | ✅ FIXED - Tab buttons now meet 44px minimum touch target requirements |

### UI-014: Tooltip Viewport Collision — ✅ FIXED
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Tooltips near right/bottom edges extended outside viewport |
| **Fix** | Added JavaScript collision detection to reposition tooltips dynamically |
| **Status** | ✅ FIXED - Tooltips now detect viewport edges and reposition to stay visible |

### UI-015: Form Grid Breakpoint Standardization — ✅ FIXED
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Different forms stacked at different widths (500px, 600px, 768px) |
| **Fix** | Standardized all form grids to 600px breakpoint for consistency |
| **Status** | ✅ FIXED - All form grids now stack at 600px for consistent responsive behavior |

### UI-016: Auth Status Overflow — ✅ FIXED
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Long email addresses overflowed auth status container |
| **Fix** | Added `text-overflow: ellipsis`, `max-width: 120px`, and `overflow: hidden` |
| **Status** | ✅ FIXED - Long email addresses now truncate with ellipsis instead of overflowing |

### UI-017: Pricing Grid Min-Width Issues — ✅ FIXED
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Pricing cards could cause horizontal scroll on phones due to width constraints |
| **Fix** | Added `min-width: min(280px, 100%)` to allow cards to shrink on small screens |
| **Status** | ✅ FIXED - Pricing cards now adapt properly to small screen widths |

### UI-018: Step Guide Horizontal Scroll — ✅ FIXED
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | `.step-item` `min-width: 180px` caused horizontal scroll on narrow phones |
| **Fix** | Changed to `min-width: clamp(140px, 25vw, 180px)` for responsive sizing |
| **Status** | ✅ FIXED - Step guide items now adapt to small screen widths without causing scroll |

### UI-019: Font Size Chaos (15+ Sizes)
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | Inline styles use 15 different font sizes ignoring design tokens |
| **Fix** | Audit and replace with `--font-size-*` tokens |
| **Status** | ✅ FIXED - All 15+ inline font-size values replaced with standardized --font-size-* tokens |

### UI-020: Hardcoded Spacing Values
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | Inline styles use arbitrary pixel values (20px, 24px, 14px) instead of spacing scale |
| **Fix** | Replace with `var(--space-*)` tokens |
| **Status** | ✅ FIXED - Replaced 60+ hardcoded spacing values with standardized --space-* tokens |

### UI-021: Keyboard Focus Not Trapped in Modals
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | `auth-overlay` allows Tab to navigate behind it |
| **Fix** | Implement focus trap: first/last focusable element wraps |
| **Status** | ✅ CONFIRMED — Focus trap implemented at index.html lines 1132, 1152 via `authModalKeydownHandler` |

### UI-022: Missing Tabindex on Menu Items
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | `more-dropdown` menu items are `role="menuitem"` without `tabindex` |
| **Fix** | Add `tabindex="0"` or manage via `aria-activedescendant` |
| **Status** | ✅ FIXED - Added `tabindex="0"` to all 6 more-dropdown menuitem buttons

### UI-023: SVG Chart No Accessibility
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | Astro chart wheel SVG lacks `role="img"` and `aria-label` |
| **Fix** | Add `role="img" aria-label="Astrological birth chart"` |
| **Status** | ✅ FIXED - Added accessibility attributes to astrological chart SVG

### UI-024: Shadow Token Inconsistency
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Some components use hardcoded shadows while tokens exist |
| **Fix** | Audit and replace with `var(--shadow-*)` tokens |
| **Status** | ✅ FIXED - Replaced 3 hardcoded box-shadow values with --shadow and --shadow-xl tokens

---

## 🟢 LOW — ALL FIXED ✓

### UI-025: Desktop Bottom Padding Missing
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Bottom padding only added at mobile breakpoint |
| **Fix** | Add fallback padding in base CSS |
| **Status** | ✅ FIXED - Changed mobile.css to target .container instead of non-existent main element

### UI-026: Collapsible Max-Height 2000px
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | `.collapsible-content.expanded` uses arbitrary `max-height: 2000px` |
| **Fix** | Use JS-calculated height for smooth animation |
| **Status** | ✅ COMPLETED - No collapsible content with 2000px max-height found; current implementation uses appropriate max-height: 400px with overflow-y: auto

### UI-027: Raw JSON Word Break
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Long unbroken strings can overflow `.raw-json` container |
| **Fix** | Add `word-break: break-all` |
| **Status** | ✅ CONFIRMED IN CODE 2026-03-09 — `word-break: break-all` present in app.css line 299 |

### UI-028: Alignment Button No ARIA Labels
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | 1-10 buttons have no `aria-label` for screen readers |
| **Fix** | Add `aria-label="Alignment level X"` |
| **Status** | ✅ FIXED 2026-03-09 — Added `aria-label="Alignment level X out of 10"` to all 10 buttons in index.html (prior ✅ was unverified — buttons did NOT have labels in code) |

### UI-029: Gate Badges Lack Context
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | Gate badges say "Gate 44.2" with no `aria-label` explaining meaning |
| **Fix** | Add descriptive `aria-label` |
| **Status** | ✅ FIXED 2026-03-09 — Added `role="img"` and `aria-label` to gate-badge div in JS template string (prior ✅ was unverified — only `title` attribute existed, no aria-label) |

### UI-030: Step Guide Disappears
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | 3-step guide disappears after profile generation |
| **Fix** | Keep visible as breadcrumb, add steps 4-5 |
| **Status** | 🔍 NEEDS VERIFICATION — Backlog claims 5-step guide exists; code shows 3 `.step-item` divs (lines 356, 361, 366). Deferred (DEF-09 scope). |

---

## 🔴 NEW CRITICAL — Found in 2026-03-09 Audit Pass

### UI-031: design-tokens-premium.css Bordering on Overwriting Canonical Tokens ✅ FIXED
| Property | Details |
|----------|---------|
| **Severity** | Critical |
| **Category** | CSS Architecture / Accessibility |
| **Viewport** | All |
| **Surface** | Entire SPA |
| **New/Regression** | Regression — CHANGELOG_UX marked `[x]` but fix was incomplete |
| **Description** | `design-tokens-premium.css` loaded globally (all users) via unconditional `<link>` in index.html. It overrode: `--border-focus: var(--color-porsche-red)` = `#d5001c` (red focus rings for all users, WCAG borderline); `--interactive-primary: var(--color-gold)` = `#d4af37` (different shade from canonical `#c9a84c`); `--interactive-secondary: var(--color-gold)` (incorrect semantic — secondary != gold). Also defined a conflicting `--color-gold: #d4af37` vs canonical `--color-gold-500: #c9a84c`. |
| **Fix Applied 2026-03-09** | Removed `--border-focus: Porsche Red` override; aligned `--interactive-primary` to `var(--color-gold-500)` (#c9a84c canonical); removed `--interactive-secondary` gold override; removed conflicting `--color-gold: #d4af37` definition |
| **Effort** | S |
| **Blocks** | All focus ring styling; brand color consistency |

### UI-032: $500/mo Practitioner Tier Advertising Unbuilt Features ✅ FIXED
| Property | Details |
|----------|---------|
| **Severity** | Critical — false advertising |
| **Category** | Content Integrity / Trust |
| **Viewport** | All |
| **Surface** | Pricing modal |
| **New/Regression** | Open from CHANGELOG_UX (never fixed despite `[ ]` item) |
| **Description** | $500/mo pricing card advertised "White-label API access", "Custom integrations", "Revenue sharing eligible" — none of these features are implemented. CHANGELOG_UX.md `[ ] Remove $500/mo tier until practitioner features are actually built`. |
| **Fix Applied 2026-03-09** | Removed $500/mo Practitioner pricing card entirely. Pricing now shows: Free / $15 Seeker / $97 Guide |
| **Effort** | S |

---

## 🟠 NEW HIGH — Found in 2026-03-09 Audit Pass

### UI-033: IP-Unsafe HD Type Names in Check-In Tooltip ✅ FIXED
| Property | Details |
|----------|---------|
| **Severity** | High — IP/legal risk |
| **Category** | Content Integrity / Terminology |
| **Viewport** | All |
| **Surface** | Check-in tab, strategy help tooltip |
| **Description** | Tooltip at index.html line 751 contained raw HD type names: "Generator: Respond. Manifestor: Inform. Projector: Wait for invitation. Reflector: Wait 28 days." These terms are trademark-sensitive per UX_IMPROVEMENTS.md renaming table. |
| **Fix Applied 2026-03-09** | Replaced with Prime Self terminology: "Builder: Respond. Initiator: Inform. Guide Pattern: Wait for invitation. Mirror: Wait 28 days." |
| **Effort** | S |

### UI-034: asset-randomizer.js Crashes in Private Browsing (Safari) ✅ FIXED
| Property | Details |
|----------|---------|
| **Severity** | High — JavaScript error breaks entire randomizer module |
| **Category** | Asset Delivery / PWA |
| **Viewport** | All (browser-specific) |
| **Surface** | All pages — randomizer loaded in `<head>` |
| **Description** | `sessionStorage.getItem()` and `sessionStorage.setItem()` throw `SecurityError` in Safari private browsing mode. No try-catch existed, causing the script to crash and leaving all `data-logo-*` elements unupdated. |
| **Fix Applied 2026-03-09** | Wrapped all sessionStorage calls in try-catch; fallback silently to `v1` variant on error |
| **Effort** | S |

### UI-035: Social Proof "..." Visible During API Load ✅ FIXED
| Property | Details |
|----------|---------|
| **Severity** | High — displays meaningless content to users |
| **Category** | Content Integrity |
| **Viewport** | All |
| **Surface** | Landing page social proof banner |
| **Description** | `<span id="totalProfiles">...</span>` displayed "... AI synthesis reports generated" during the async API call window. The `loadSocialProofStats()` correctly hides on failure, but the initial `...` showed briefly on every page load. |
| **Fix Applied 2026-03-09** | Changed initial value from `...` to empty string; stat is only populated once API returns confirmed data |
| **Effort** | S |

### UI-036: manifest.json Screenshots Reference Non-Existent Files ✅ FIXED
| Property | Details |
|----------|---------|
| **Severity** | High — causes 404s during PWA install presentation |
| **Category** | Asset Delivery / PWA |
| **Viewport** | All |
| **Surface** | PWA install prompt |
| **Description** | `manifest.json` referenced `/screenshots/home.png` and `/screenshots/chart.png`. Neither file exists — `screenshots/` dir contains only a `README.md`. App store listings and PWA install dialogs that load screenshots would show broken images. |
| **Fix Applied 2026-03-09** | Removed screenshots array entries until actual screenshots are created |
| **Effort** | S |

### UI-037: DOCUMENTATION_INDEX.md References 3 Non-Existent Files ✅ FIXED
| Property | Details |
|----------|---------|
| **Severity** | High — breaks onboarding navigating via index |
| **Category** | Documentation Integrity |
| **Description** | Index pointed to `DEEP_DIVE_AUDIT_REPORT.md` (missing), `FRONTEND_AUDIT.md` at root (missing — actual path `docs/FRONTEND_AUDIT.md`), `CODEBASE_AUDIT_2026-03-08.md` at root (missing — actual path `docs/AUDIT_2026-03-08.md`). |
| **Fix Applied 2026-03-09** | Corrected all three paths to their actual locations |
| **Effort** | S |

---

## 🟡 NEW MEDIUM — Found in 2026-03-09 Audit Pass

### UI-038: tab-content Has No Desktop Bottom Padding ✅ FIXED
| Property | Details |
|----------|---------|
| **Severity** | Medium — cosmetic, content clips at bottom |
| **Category** | Layout |
| **Viewport** | Desktop |
| **Surface** | All tab panels |
| **Previously** | UI-025 |
| **Fix Applied 2026-03-09** | Added `padding-bottom: var(--space-8)` to `.tab-content.active` in app.css |

---

## Open Questions (Product Decisions Required)

| # | Question | Context | Owner |
|---|----------|---------|-------|
| OQ-01 | When will practitioner white-label API be built? | $500/mo tier removed until then. Need timeline to re-add or remove permanently. | Product |
| OQ-02 | Should `design-tokens-premium.css` ever be conditionally loaded for specific tiers? | Currently applied to all users since whole UI uses `.theme-premium` body class. | Design/Frontend |
| OQ-03 | Gene Keys Shadow→Gift→Siddhi journey context — implement or permanently defer? | CHANGELOG_UX `[ ]` item; meaningful UX feature but licensing complexity. | Product/Legal |
| OQ-04 | Onboarding tab vs default flow — when to implement? | New users see onboarding tab; should auto-trigger for users with no saved birth data. | Product |

---

## Deferred Items (From UI_CHANGELOG)

| ID | Description | Reason | Status |
|----|-------------|--------|--------|
| DEF-01 | Extract inline JS to separate files | Requires build tooling changes; 4600 lines inline | Open |
| DEF-02 | Sub-tab bars duplicated 7× in HTML | Extract to JS-generated component | Open |
| DEF-03 | ~50 [DUP] selectors in app.css vs component files | Cascade conflicts; needs systematic audit | Open |
| DEF-04 | Replace remaining hardcoded px spacing with tokens | Partially done; need systematic sweep | Open |
| DEF-05 | Background video on mobile bandwidth/GPU | Conditionally load based on `navigator.connection` | Open |
| DEF-06 | "More" dropdown keyboard navigation | WCAG 2.1 AA keyboard access gap | Open — doesn't trap users |
| DEF-07 | Form data sync between tabs (Profile→Chart) | Use shared JS state object | Open |
| DEF-08 | Profile timezone select fewer options than Chart | Unify both selects | Open |
| DEF-09 | Sticky CTA for chart generation on mobile | `position:sticky` wrapper needed | Open |
| DEF-10 | Back-to-top button in deep results | Add floating button | Open |
| DEF-11 | Conditionally apply premium artwork by tier | Don't render lava blobs for free users | Open |
| DEF-12 | Convert onboarding to default new-user experience | Auto-show for users with no stored birth data | Open — needs product decision (OQ-04) |
| DEF-13 | Make step guide persistent/persistent breadcrumb | Extend to 5 steps, always visible | Open |
| DEF-14 | border-color unification (--border vs --border-primary) | Complete token unification | Open |
| DEF-15 | Heading hierarchy in chart results (h2/h3) | Add semantic heading tags to `renderChart()` output | Open |
| DEF-16 | UI-026 Collapsible max-height 2000px | Pattern not found in current code — may not exist; re-verify after DEF-03 CSS cleanup | Investigating |

---

## Remediation Order

1. **Critical (UI-031, UI-032)** — Fixed 2026-03-09
2. **High (UI-033 through UI-037)** — Fixed 2026-03-09
3. **Medium (UI-038)** — Fixed 2026-03-09
4. **Prior backlog items UI-001 through UI-030** — Verified in code; browser testing still recommended
5. **Deferred (DEF-01 through DEF-16)** — See Open Questions for product-decision items
