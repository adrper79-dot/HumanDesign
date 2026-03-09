# CHANGELOG — UX Improvements

**Generated from:** UX Deep Review (March 8, 2026)  
**Status Legend:** 🔴 Critical | 🟡 Important | 🟢 Enhancement  

---

## [2026-03-08] — Brand Identity & Media Assets ✅

### ✅ COMPLETED — Logo Video Asset Pipeline

- [x] **Generated v1 asset library** from `HumanDesign_LogoMovie.mp4` (464×688, 6s): 40 files — PWA icons (8 sizes + maskable + badge + shortcuts + favicons), social images (OG/Twitter/Pinterest), 11 Apple splash screens, video variants (MP4/WebM/GIF/loop/poster/audio), marketing assets (app-store/email-header/embed-logo)
- [x] **Generated v2 asset library** from `HD_LOGOVID2.mp4` (784×1168, 10s): 40 files — same categories, all suffixed `-v2`
- [x] **Created `frontend/js/asset-randomizer.js`** — per-session (sessionStorage) random variant picker (50/50 v1/v2), updates favicons, apple-touch-icons, splash screens, MS tile, video sources, poster images
- [x] **Updated `manifest.json`** with full PWA icon array (11 entries: SVG + 8 PNG sizes + 2 maskable), screenshot placeholders, shortcut icons
- [x] **Updated `service-worker.js`** v5→v6: precaches `asset-randomizer.js` + key v1/v2 assets (icon-192, favicon-32, logo-poster, MP4, WebM)
- [x] **Updated `index.html` CSP** — added `media-src 'self'` for video playback
- [x] **Added logo animation to auth overlay** — `<video data-logo-video>` with WebM + MP4 sources, autoplay muted loop
- [x] **Replaced header SVG icon** with actual logo image `<img data-logo-poster>` for randomization support
- [x] **Added `og:image:alt` meta tag** for social sharing accessibility
- [x] **Created asset generation scripts** — `scripts/generate-assets.cjs` (v1) and `scripts/generate-assets-v2.cjs` (v2) using `sharp` + `ffmpeg-static`

---

## [Unreleased] — UX Overhaul

### 🔴 CRITICAL — Color & Contrast ✅

- [x] **REMOVE inline `:root` variables** from `index.html` lines 62-77 (consolidate into `design-tokens.css`)
- [x] **Resolve gold conflict:** `--gold: #c9a84c` (inline) vs `--color-gold: #d4af37` (premium) — pick ONE. NOTE: `design-tokens-premium.css` still defined `--color-gold: #d4af37` (overriding canonical) until 2026-03-09 audit removed it. Also removed `--border-focus: Porsche Red` from premium.css (was making ALL focus rings red `#d5001c`)
- [x] **Resolve font base:** `base.css:32 html { font-size: 15px }` vs `index.html:76 html { font-size: 16px }` — set to `16px` in tokens only
- [x] **Fix `--text-dim`:** change `#b0acc8` → `#c4c0d8` (ratio: 4.2:1 → 5.5:1 on `#1a1a24`)
- [x] **Fix `--text-muted`:** change `#7a76a0` → `#918db0` (ratio: 3.1:1 → 4.5:1 on `#0a0a0f`)
- [x] **Remove `design-tokens-premium.css` Porsche Red override** of `--interactive-primary` or make it conditional to premium tier only
- [ ] **Audit all `border-color`** usages: `--border: #32324a` vs `--border-primary: rgba(255,255,255,0.15)` — unify

### 🔴 CRITICAL — Missing Explanations ✅

- [x] **Add type descriptions** to `renderChart()` — via `getExplanation(TYPE_EXPLANATIONS, chart.type)` from explanations.js
- [x] **Add authority descriptions** — via `getExplanation(AUTHORITY_EXPLANATIONS, chart.authority)`
- [x] **Add strategy descriptions** — via `getExplanation(STRATEGY_EXPLANATIONS, chart.strategy)`
- [x] **Add profile descriptions** — via `getExplanation(PROFILE_EXPLANATIONS, chart.profile)`
- [x] **Add center descriptions** — governs label, defined/open explanation, bio correlate tooltip, MOTOR badge
- [x] **Add channel meanings** — channel name + description + circuit badge + I Ching hex name tags
- [x] **Add gate meanings to transits** — `getGateName()` + `getGateHex()` in both natal hits and collective positions
- [ ] **Add Gene Keys journey context:** For each Gene Key in technical section, explain the Shadow→Gift→Siddhi progression as a transformational journey

### 🔴 CRITICAL — Trust & Credibility ✅

- [x] **Remove or replace testimonials section** — replaced with honest value proposition banner
- [x] **Fix fallback social proof stats** — `loadSocialProofStats()` now hides on API failure instead of showing fake numbers
- [x] **Fix mobile nav labels:** "Chart"→"Blueprint", "Keys"→"Profile", "Astro"→"Deepen"
- [x] **Remove un-implemented features from pricing tiers:** $500/mo Practitioner card removed 2026-03-09. $97 Guide tier retains "practitioner dashboard" language — feature IS implemented (`practitionerTools:true` in JS tier limits)

### 🟡 IMPORTANT — Structure & Navigation ✅

- [x] **Merge tabs to reduce from 13 → 4:** Blueprint (Chart+Profile), Today (Transits+Check-In), Relate (Composite), Grow (Enhance+Diary) + Tools dropdown
- [x] **Store birth data in `localStorage`** — `saveBirthData()`/`restoreBirthData()` auto-populate all forms
- [ ] **Convert onboarding from tab to default new-user experience:** If no birth data stored, show onboarding flow automatically
- [ ] **Make the step guide (lines 1042-1060) persistent:** Show as breadcrumb/progress bar, extend to 5 steps

### 🟡 IMPORTANT — CSS Architecture ✅

- [x] **Extract all inline `<style>` CSS** — 490 lines moved to `frontend/css/app.css` with [DUP]/[UNIQUE] annotations
- [ ] **Remove duplicate definitions:** ~50 [DUP] selectors in app.css still need cleanup vs component files
- [ ] **Replace all hardcoded px values** (20px, 24px, 14px, 18px) with design token spacing variables (`--space-4`, `--space-6`, etc.)
- [ ] **Reduce font sizes to token scale only:** Replace 15+ arbitrary sizes (0.65rem, 0.68rem, 0.72rem…) with `--font-size-xs`, `--font-size-sm`, `--font-size-base`, `--font-size-md`, `--font-size-lg`

### 🟡 IMPORTANT — Loading & Performance ✅

- [x] **Add skeleton loading screens** — skeletonChart(), skeletonProfile(), skeletonTransits() with CSS shimmer animation in app.css
- [x] **Lazy-load tab content:** Big Five + VIA questions now deferred to first Enhance tab activation via window.onTabActivated
- [x] **Reduce artwork.css animations:** Removed lava blobs (4) + floating orbs (3); kept stars + crescent moon; reduced particles 30→10
- [ ] **Conditionally apply premium artwork** based on user tier (don't render for free users)

### 🟡 IMPORTANT — Accessibility

- [x] **Fix focus trap** in `auth-overlay` modal: confirmed at index.html lines 1132, 1152 via `authModalKeydownHandler`
- [x] **Add `aria-label`** to alignment buttons (1-10 scale): added `aria-label="Alignment level X out of 10"` to all 10 buttons 2026-03-09
- [ ] **Add heading hierarchy** to chart results: use `<h2>` for section titles, `<h3>` for subsections (open — DEF-15)
- [ ] **Add `role="img"` and `aria-label`** to astro chart wheel SVG (open — only gate badge done so far)
- [ ] **Increase mobile touch targets** to minimum 44×44px (currently 40×40px on alignment buttons)
- [ ] **Fix tab order:** ensure hidden `.tab-content[style="display:none"]` elements don't receive focus

### 🟢 ENHANCEMENT — Content Depth ✅

- [x] **Create explanations.js module** — 320 lines: TYPE/AUTHORITY/STRATEGY/PROFILE/CENTER/CHANNEL/GATE explanations + helpers
- [x] **Load gate data from `src/data/gate_wheel.json`** — HD_HEX_NAMES (64 I Ching names) in hd-data.js
- [x] **Load center data from `src/data/centers.json`** — HD_CENTERS with bio correlates, motor flags, gate lists
- [x] **Load channel data from `src/data/channels.json`** — HD_CHANNELS_META with circuit info + HD_CHANNEL_MAP
- [x] **Add "What This Means For You" section** — synthesis summary block at bottom of renderChart()

### 🟢 ENHANCEMENT — Engagement ✅

- [x] **Add shareable profile card generator:** share-card.js — Canvas-based 600×800 card with download PNG, native share, clipboard fallback
- [x] **Add interactive bodygraph:** bodygraph.js — SVG with 9 clickable centers, 36 channel lines, info panel on click
- [x] **Add transit timeline view:** Horizontal duration bars sorted by speed (gold=natal hits, accent=others) with time labels
- [x] **Add "Your Overview" synthesis tab:** updateOverview() populates quick stats, strategy/authority, cross, mini bodygraph, not-self alert, nav links

### 🟢 ENHANCEMENT — Pricing

- [ ] **Add $7/mo tier** ("Explorer") between Free and $15: 3 charts/month, basic transit alerts, no AI profile
- [x] **Remove $500/mo tier** — removed 2026-03-09 (Practitioner pricing card removed from pricing modal)
- [ ] **Rename $97 tier** to "Practitioner Pro" and list only features that currently work
- [ ] **Move pricing to its own page/tab** — not a modal overlay on landing

---

## [2026-03-09] — Re-Audit Fixes (Automated Repair Pass)

### ✅ Fixes Applied

- [x] **Removed `--border-focus: Porsche Red`** override from `design-tokens-premium.css` — all users were receiving red (`#d5001c`) focus rings despite this being loaded globally
- [x] **Aligned gold token** in `design-tokens-premium.css` — removed conflicting `--color-gold: #d4af37`; `--interactive-primary` now uses canonical `var(--color-gold-500)` (#c9a84c)
- [x] **Removed $500/mo Practitioner tier** from pricing modal — was advertising unbuilt white-label API and custom integrations
- [x] **Fixed IP-unsafe HD terminology in tooltips** — "Projector/Reflector" → "Guide Pattern/Mirror" in check-in tooltip (line 751); "Reflector" → "Mirror" in energy blueprint tooltip (line 1783)
- [x] **Fixed social proof `...` placeholder** — initial value cleared to empty string; only shows when API returns confirmed data
- [x] **Fixed asset-randomizer.js crash** in Safari private browsing — sessionStorage calls now wrapped in try/catch with `v1` fallback
- [x] **Fixed manifest.json screenshots** — removed non-existent `/screenshots/home.png` and `/screenshots/chart.png` entries
- [x] **Fixed DOCUMENTATION_INDEX.md broken paths** — corrected 3 missing-file references
- [x] **Added gate badge `role="img"` + `aria-label`** to gate-badge div in JS template string
- [x] **Added `padding-bottom: var(--space-8)`** to `.tab-content.active` (desktop bottom clip)

### ⚠️ Items Marked ✅ in Backlog But Not Verified (Found During Re-Audit)

- `UI-028` Alignment button aria-labels — claimed ✅ FIXED but buttons had NO aria-labels in code; added 2026-03-09
- `UI-029` Gate badge aria-labels — claimed ✅ FIXED but element had only `title` attribute, no `aria-label`; fixed 2026-03-09
- `UI-030` 5-step guide — claimed ✅ FIXED "expanded to 5-step breadcrumb"; code shows 3-step guide (`display:none` after complete). Status: UNVERIFIED.
- Gold conflict — CHANGELOG marked `[x]` but `design-tokens-premium.css` still had conflicting `--color-gold: #d4af37` and Porsche Red focus ring override

### 🔴 Remaining Open (Terminology)

- `explanations.js` uses original HD type names as keys (Generator, Projector, Manifestor, Reflector) in the TYPE_EXPLANATIONS object and display text ("As a Reflector..."). These are user-visible in chart explanations. Needs product decision: fully rename to PS terms or keep as-is. Adding to DEF-16.
- `hd-data.js` and `share-card.js` use "Incarnation Cross" — check if this is a licensed term or generic astrology

---

## Implementation Order

| Phase | Tasks | Est. Effort | Impact |
|-------|-------|-------------|--------|
| **Phase 1** | Color fixes, contrast bumps, remove fake testimonials | 1-2 days | Trust + readability |
| **Phase 2** | Add type/authority/strategy/profile explanations | 2-3 days | User comprehension |
| **Phase 3** | Tab restructure + birth data persistence | 3-5 days | Navigation clarity |
| **Phase 4** | CSS extraction + font standardization | 2-3 days | Maintainability |
| **Phase 5** | Load data files, center/gate/channel descriptions | 3-5 days | Content depth |
| **Phase 6** | Skeleton loading, lazy loading, artwork reduction | 2-3 days | Performance | ✅ |
| **Phase 7** | Interactive bodygraph, share cards, overview tab | 5-10 days | Differentiation | ✅ |
