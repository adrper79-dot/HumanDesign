# CHANGELOG — UX Improvements

**Generated from:** UX Deep Review (March 8-9, 2026)  
**Status Legend:** 🔴 Critical | 🟡 Important | 🟢 Enhancement  
**Sprint 18:** 40 items total (9 Critical, 14 High, 10 Medium, 7 Low)  
**Reference:** [UX_DEEP_REVIEW.md](UX_DEEP_REVIEW.md) | [BACKLOG.md](BACKLOG.md) Sprint 18  

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

- [x] **Add $7/mo tier** ("Explorer") between Free and $15: 3 charts/month, basic transit alerts, no AI profile — **RESOLVED by Plan v4**: Explorer $12/mo, Guide $60/mo, Studio $149/mo
- [x] **Remove $500/mo tier** — removed 2026-03-09 (Practitioner pricing card removed from pricing modal)
- [x] **Rename $97 tier** to "Practitioner Pro" and list only features that currently work — **RESOLVED by Plan v4**: Guide tier ($60/mo) with practitioner features
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

---

## [2026-03-09] Dashboard Navigation Overhaul

### Summary
Collapsed 14 navigable destinations to 5 primary tabs + ⚙ overflow. Added persistent identity strip, first-run onboarding modal, smart landing logic, and tab intro cards.

### Changes

**Navigation — Desktop**
- Added **Home** (✦) as primary tab 1 → routes to Overview/dashboard
- Renamed Blueprint → **My Chart** (btn-blueprint)
- Renamed Relationships → **Connect** (btn-connect)
- Moved Clusters tab from Tools drawer → Connect group (sub-tab "⬢ Groups")
- Tools drawer renamed to ⚙, reduced from 6 → 5 items (Clusters removed, Onboarding renamed Restart Onboarding)

**Navigation — Mobile**
- Added **Home** (✦) as first mobile nav item
- Renamed Blueprint → My Chart
- Renamed Relate → Connect (data-group="connect")
- Renamed ☰ More → ⚙ More

**Tab Groups**
- TAB_GROUPS updated: overview→btn-home, composite/clusters→btn-connect
- MOBILE_TAB_GROUPS updated: overview→'home', composite/clusters→'connect', removed relationships

**Overview Tab**
- Elevated to top-level Home dashboard landing
- Removed L2 sub-tabs (was nested under Blueprint)
- Improved empty-state text for new users

**Chart / Profile Sub-Tabs**
- Removed redundant "✦ Overview" sub-tab (now top-level Home)
- Simplified to: ⊙ Chart | ⬡ AI Profile

**Identity Strip** (new)
- Persistent bar above nav showing: human design type · authority · profile
- Populates after calculateChart() success or on page reload (from window._lastChart)
- Edit (✎) button navigates back to My Chart tab

**First-Run Onboarding Modal** (new)
- 3-step modal for new users: Welcome → What You'll Unlock → You're Ready
- Triggered on DOMContentLoaded when no birth data and no `ps_hasSeenOnboarding` flag
- Progress dots, frmNext/frmBack/frmClose controller

**Smart Landing Logic** (new)
- New user (no birth data, no onboarding seen): show first-run modal
- Returning user (has birth data): auto-navigate to Home dashboard
- Default (seen onboarding, no birth data): stay on My Chart entry form

**Tab Intro Cards** (new)
- Today tab: "☽ Today's Energy" — 1-sentence orientation card
- Connect tab: "⊕ Connect" — 1-sentence orientation card
- Grow tab: "★ Grow & Deepen" — 1-sentence orientation card

**After Chart Generation**
- App now auto-navigates to Home dashboard after first calculateChart() success

### CSS Added (app.css)
- `#identity-strip`, `.identity-strip-inner`, `.identity-strip-avatar`, `.identity-strip-info`, `.identity-edit-btn`
- `.first-run-overlay`, `.first-run-panel`, `.frm-step`, `.frm-step-icon`, `.frm-step-title`, `.frm-step-body`
- `.frm-btn-next`, `.frm-back-btn`, `.frm-skip-btn`, `.frm-what-you-need`, `.frm-need-item`, `.frm-check`
- `.frm-unlock-grid`, `.frm-unlock-item`, `.frm-unlock-icon`, `.frm-progress`, `.frm-dot`
- `.tab-intro-card`, `.tab-intro-icon`, `.tab-intro-body`

---

## [Sprint 18] — UX Overhaul & Social Media Integration (March 9, 2026)

### 🔴 CRITICAL — Planned for This Week

- [ ] **BL-UX-C1: Color token consolidation** — Remove ALL inline :root variables from index.html (lines ~62-77), consolidate to design-tokens.css as single source of truth, delete conflicting premium overrides
- [ ] **BL-UX-C2: WCAG contrast fixes** — Bump `--color-neutral-400` from `#a8a2c0` → `#c4c0d8` (5.5:1 contrast), `--text-muted` from `#7a76a0` → `#918db0` (4.5:1)
- [ ] **BL-UX-C3: "Why it matters" explanations** — Add 1-2 sentence context for Type ("Generator: consistent renewable energy..."), Authority ("Emotional: never decide in the moment..."), Strategy, Profile
- [ ] **BL-UX-C4: Remove fake testimonials** — Delete lines ~869-1014 OR replace with real testimonials + disclaimer
- [ ] **BL-UX-C5: Consolidate birth data entry** — Store in localStorage (`ps-birth-data`), auto-populate all forms, show "Using your birth data: [details] [Change]" banner
- [ ] **BL-UX-C6: Navigation restructure** — Reduce 13 tabs → 4 primary: My Blueprint (Chart+Profile), Today's Energy (Transits+Check-In), Relationships (Composite), Deepen (Enhance) + More dropdown
- [ ] **BL-UX-C7: Mobile nav label fixes** — Rename "Keys" → "Profile", "Astro" → "Deepen" OR restructure tabs to match labels
- [ ] **BL-UX-C8: Center pill explanations** — Add tooltips: "Sacral (defined): Consistent life force energy", "Sacral (open): Must manage energy carefully"
- [ ] **BL-UX-C9: Extract inline CSS** — Move ~600 lines from index.html <style> blocks to component files (app.css, buttons.css, cards.css)

### 🟡 HIGH — Planned for This Month

- [ ] **BL-UX-H1: Load gate data** — Wire `src/data/gate_wheel.json` into frontend, show gate names ("Gate 44: The Coming to Meet"), add tooltips with keywords
- [ ] **BL-UX-H2: Channel descriptions** — Load `src/data/channels.json`, show channel names ("Channel of Charisma: Busy-ness that looks effortless")
- [ ] **BL-UX-H3: Skeleton loading** — Replace spinner with animated skeleton placeholders (chart data rows, profile blocks, transit list)
- [ ] **BL-UX-H4: Gene Keys journey** — Add intro: "You evolve from Shadow (unconscious) → Gift (mastery) → Siddhi (transcendent). This is your growth path."
- [ ] **BL-UX-H5: Transit natal hits personalization** — When transit hits natal gate, show: "Sun activating YOUR Gate 44 (Coming to Meet) — connects Spleen to Heart, spotting patterns this week"
- [ ] **BL-UX-H6: Fix spacing inconsistencies** — Replace hardcoded pixels with design tokens (`margin-bottom: 20px` → `var(--space-5)`)
- [ ] **BL-UX-H7: Font size consolidation** — Reduce 15+ sizes to 6-token scale (xs, sm, base, lg, xl, 2xl)
- [ ] **BL-UX-H8: Optimize lava lamp** — Keep stars + moon, remove blobs/orbs, reduce particles 30→10
- [ ] **BL-UX-H9: Persistent step guide** — Keep visible as breadcrumb, add step 4 "Explore transits", step 5 "Track alignment"
- [ ] **BL-UX-H10: Card visual hierarchy** — Primary action cards get gold border-top, results get elevated shadow, info stays flat
- [ ] **BL-UX-H11: Code splitting** — Extract ~3000 lines inline JS to modules: app.js, chart.js, profile.js, transits.js, enhance.js (lazy load per tab)
- [ ] **BL-UX-H12: Keyboard navigation** — `display: none` on inactive tabs, focus trap in modals, tabindex on all interactive elements
- [ ] **BL-UX-H13: Screen reader accessibility** — Proper heading hierarchy (h2/h3/h4), semantic markup (dl/table), aria-label on badges, role="img" on SVG
- [ ] **BL-UX-H14: Touch target sizing** — Bump all interactive elements to 44px minimum (WCAG), increase tab padding to 16px

### 🟢 MEDIUM — Planned for This Quarter

- [ ] **BL-UX-M1: Interactive bodygraph** — Click centers/gates/channels to see explanations, highlight connections
- [ ] **BL-UX-M2: Share-ready images** — Generate 1080x1080 PNG: bodygraph + name + type + profile + tagline
- [ ] **BL-UX-M3: Real social proof** — API endpoint for live stats (users who generated charts this week, total profiles)
- [x] **BL-UX-M4: Simplify pricing** — **RESOLVED by Plan v4**: Free $0 / Explorer $12 / Guide $60 / Studio $149. Daily ceilings via KV.
- [ ] **BL-UX-M5: Transit timeline** — 30-day forward view with intensity curves, "Peaks March 15, fades March 22"
- [ ] **BL-UX-M6: Progressive onboarding** — Make onboarding default for new users, guided tour: birth data → chart → type explanation → transits
- [ ] **BL-UX-M7: Remove fake features** — Delete "coming soon" features from pricing OR add "(Coming Soon)" with roadmap dates
- [ ] **BL-UX-M8: Beautiful chart wheel** — Ensure astrology wheel is competitive quality (smooth gradients, clear aspects, responsive)
- [ ] **BL-UX-M9: Aspect explanations** — "Sun square Saturn: Obstacles that build resilience. Success through discipline."
- [ ] **BL-UX-M10: Daily forecast** — "Today's Moon in Gate 5 brings patience for timing. Venus in Gate 37 supports family connections."

### 📱 SOCIAL MEDIA INTEGRATION

#### High Priority
- [ ] **BL-SOCIAL-H1: Twitter/X sharing** — Pre-filled tweets with chart insights + referral link
  - Template: "Just discovered I'm a {Type} {Profile} ✨ My decision style: {Authority}. Check out your energy blueprint at {link}"
  - Implementation: `frontend/js/social-share.js` (create), Twitter share intent URL, track clicks
- [ ] **BL-SOCIAL-H2: Instagram image export** — 1080x1080 PNG with bodygraph + user info + Prime Self branding
  - Format: Bodygraph visual, "Type: Generator 3/5", "Authority: Emotional", primeself.net watermark
  - Implementation: Canvas/SVG export, download button, clipboard copy for mobile
- [ ] **BL-SOCIAL-H3: Facebook sharing** — Open Graph meta tags + share dialog with rich preview
  - Add: og:title, og:description, og:image (1200x630), og:url, fb:app_id
  - Implementation: Share dialog API, pre-filled text, uses og-image-1200x630.png

#### Medium Priority
- [ ] **BL-SOCIAL-M1: TikTok sharing** — Vertical 9:16 format chart images, mobile share sheet, caption with hashtags
  - Caption: "POV: You're a {Type} {Profile} ✨ #HumanDesign #Astrology #EnergyBlueprint #SelfDiscovery"
- [ ] **BL-SOCIAL-M2: Threads integration** — Meta's Twitter alternative, 500-char optimized posts
  - Template: "Energy update: I'm a {Type} with {Authority} 🌙 My strategy: {Strategy}. Wild how accurate… {link}"
- [ ] **BL-SOCIAL-M3: Bluesky integration** — Decentralized network, share intent using their API
  - Template: "Just found out I'm a {Type} {Profile} ✨ Makes so much sense. What's yours? {link}"
- [ ] **BL-SOCIAL-M4: Share analytics dashboard** — Track shares and conversions by platform
  - Schema: `social_shares (id, user_id, platform, shared_at, referral_code, utm_source, converted)`
  - Admin view: "Instagram: 245 shares, 12 conversions (4.9%)"

### Competitive Position Analysis

**Unique Strength**: Only tool combining HD + Gene Keys + Western Astrology + Numerology  
**Critical Weaknesses**: 
1. Plain language (Co-Star/Chani excellent, Prime Self needs work)
2. Visual polish (competitors have native apps, Prime Self PWA needs refinement)

**Fix these two and we own the market.**

