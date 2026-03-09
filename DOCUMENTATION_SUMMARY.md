# Prime Self — Comprehensive Documentation Summary

**Generated**: Based on full reading of all 42 design/architecture/standards documents  
**Last Updated**: March 9, 2026  
**Scope**: Architecture, API Design, Database, Frontend, Security, Deployment, UX/Design System, Social Media Integration  
**Sprint Status**: Sprint 18 — UX Overhaul & Social Media (40 items in progress)

---

## 1. ARCHITECTURE

### Key Design Decisions
- **Edge-first serverless**: Cloudflare Workers (V8 isolates, zero cold start) + Neon PostgreSQL (serverless pooled) + KV (cache/rate-limit) + R2 (PDF storage)
- **8-layer calculation engine**: Pure JS implementation of Jean Meeus astronomical algorithms — `julian.js → planets.js → design.js → gates.js → chart.js → astro.js → transits.js → synthesis.js`. No external dependencies.
- **3-stream data separation**: Energy Blueprint, Western Astrology, and Transits kept independent until synthesis layer
- **LLM failover chain**: Anthropic Claude (primary) → xAI Grok (failover 2) → Groq (failover 3), optionally routed through Cloudflare AI Gateway for caching/observability
- **Model routing**: Opus for KB/synthesis, Sonnet for code/structured extraction, Haiku for digests/simple tasks
- **All crypto via Web Crypto API** — no Node.js `crypto` module (Workers constraint)
- **IP-safe terminology**: Human Design terms replaced with Gene Keys / Prime Self equivalents in all user-facing output (e.g., "Projector" → "Guide Pattern", "Gate" → "Gene Key", "Incarnation Cross" → "Life Purpose Vector")

### Standards & Patterns
- **Verification anchors**: Two known-good test vectors — AP (Aug 5 1979, 22:51 UTC, Tampa FL → 6/2 Projector) and 0921 (Sep 21 1983, 21:30 UTC, Naples FL → 1/3 MG) — verified against Jovian Archive
- **Accuracy guarantees**: Sun ±0.01°, Moon ±0.3°, inner planets ±0.05°, outer ±0.5°. Wheel offset = 3.875° (immutable constant)
- **Geocoding**: OpenStreetMap Nominatim → BigDataCloud fallback, KV cached 30 days
- **Cron**: Daily 06:00 UTC — transit snapshot + SMS digest dispatch
- **Knowledge base**: 18 sources across `src/knowledgebase/` — HD (types, profiles, authority, definition, centers, gates, channels, crosses, gene keys), Astrology (planets, signs, aspects, houses), Numerology (life paths, personal years, tarot), Prime Self (forges, six knowledges)

### Gaps & Contradictions
- **Two ARCHITECTURE.md files**: Root (576 lines, comprehensive) and docs/ (condensed subset). Claims vary: root says 48 tables, docs/ says 49
- **Phantom tables**: 32 tables referenced in code but never created in production. Migrations 003–015 never applied. Only ~15–18 tables exist in the live Neon database
- **migrate.js uses Node.js fs/crypto** — cannot run inside Workers. Must run locally against Neon
- **No migration tracking enforced** — `schema_migrations` table exists in DDL but no tooling validates which migrations have been applied

---

## 2. API DESIGN

### Key Design Decisions
- **120+ route registrations** in `workers/src/index.js` using a table-driven router
- **35+ distinct endpoint groups**: auth, chart, profile, transits, composite, rectify, practitioner, cluster, sms, onboarding, billing/checkout, webhook, diary, validation, psychometric, celebrities, forecast, cycles, timing, keys, referrals, achievements, push, alerts, analytics, experiments, notion, share, stats
- **Auth model**: Public endpoints (health, geocode, chart/calculate) vs. authenticated endpoints (JWT Bearer token required)
- **Rate limiting**: KV fixed-window rate limiter in `middleware/rateLimit.js`
- **Tier enforcement**: `enforceFeatureAccess()` for boolean gates, `enforceUsageQuota()` for monthly quotas (usage resets 1st of month)
- **Streaming**: SSE endpoint for profile generation (`POST /api/profile/generate/stream`)

### API Specification Status
- **Two competing spec documents**: `docs/API_SPEC.md` and `docs/API.md` with different field names (`birthTimezone` vs `timezone`) and different response shapes
- **Spec drift**: 7 endpoints documented in API_SPEC.md don't exist in the router; 11+ implemented endpoints aren't documented
- **API Marketplace**: `docs/API_MARKETPLACE.md` describes a RapidAPI listing and direct API key access (`X-API-Key` header) with separate rate limit tiers ($0/$9/$29/custom) — this is aspirational; the marketplace listing doesn't exist yet

### Response Envelope Inconsistency
- Some handlers return `{ success: true }`, others `{ ok: true }`, others `{ data: {...} }`, others return unwrapped objects
- No standard error envelope — mix of `{ error: 'message' }`, `{ success: false, error: ... }`, `{ ok: false, error: ... }`
- Rate limit headers (`X-RateLimit-Limit/Remaining/Reset`) not returned in responses

### Dead Routes
- ~60 of 120+ registered routes lead to broken handlers that depend on phantom database tables (achievements, alerts, analytics, checkin, experiments, keys, notion, push, referrals, share, stats, webhooks)

### Environment Variables Referenced
- `NEON_CONNECTION_STRING`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `GROK_API_KEY`, `GROQ_API_KEY`
- `TELNYX_API_KEY`, `TELNYX_PHONE_NUMBER`, `TELNYX_CONNECTION_ID`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `AI_GATEWAY_URL`, `SENTRY_DSN`, `RESEND_API_KEY`
- `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`
- `STRIPE_PRICE_SEEKER`, `STRIPE_PRICE_GUIDE`, `STRIPE_PRICE_PRACTITIONER` (wrangler.toml [vars])
- `ENVIRONMENT` (wrangler.toml [vars])

---

## 3. DATABASE

### Key Design Decisions
- **Neon PostgreSQL** (serverless, pooled via `@neondatabase/serverless` v1.0.2)
- **UUID primary keys** throughout (gen_random_uuid())
- **TIMESTAMPTZ** for all timestamps
- **JSONB** for chart data (`hd_json`, `astro_json`, `numerology_json`, chart data)
- **Base schema** in `migrate.sql` (18 tables) + numbered migrations `003`–`018`

### Core Tables (exist in production)
1. `schema_migrations` — migration tracking
2. `users` — auth + birth data (email, password_hash, salt, birth_date/time/tz/lat/lng)
3. `charts` — calculated charts (user_id, birth data, hd_json, astro_json, numerology_json)
4. `profiles` — AI-generated profiles (user_id, chart_id, profile_json)
5. `transit_snapshots` — daily transit cache
6. `practitioners` — pro accounts
7. `practitioner_clients` — client rosters
8. `clusters` / `cluster_members` — group challenges
9. `sms_messages` — SMS digest log
10. `validation_data` — self-validation surveys
11. `psychometric_data` — Big 5 personality
12. `diary_entries` — life events journal
13. `subscriptions` — Stripe tier tracking (user_id, tier, status, stripe_subscription_id, current_period_end, cancel_at_period_end)
14. `payment_events` — invoice history
15. `usage_records` — API quota tracking
16. `share_events` — referral tracking
17. `refresh_tokens` — JWT refresh tokens

### Migration Tables (may not exist in production)
Migrations 003–018 define: `subscriptions`, `payment_events`, `usage_records`, `usage_tracking`, `user_achievements`, `achievement_events`, `user_streaks`, `achievement_stats` (view), `referrals`, `referral_rewards`, `referral_stats` (view), `webhooks`, `webhook_deliveries`, `push_subscriptions`, `push_notifications`, `notification_preferences`, `transit_alerts`, `alert_deliveries`, `api_keys`, `api_key_usage`, `invoices`, `analytics_events`, `funnel_events`, `experiment_assignments`, `experiments`, `experiment_conversions`, `daily_checkins`, `check_in_stats` (view), `share_events`, `oauth_states`, `notion_connections`

### Critical Schema Issues
- **32 phantom tables** — code references tables from migrations that were never applied to production

---

## 4. UX & DESIGN SYSTEM (Sprint 18)

### Critical UX Issues Identified (March 9, 2026)
**Source**: [UX_DEEP_REVIEW.md](UX_DEEP_REVIEW.md) — Comprehensive audit with Reddit sentiment analysis and competitive research

#### Color System Conflicts (BL-UX-C1)
- **Problem**: Three competing color systems override each other unpredictably
  - `design-tokens.css` defines `--bg-primary: #0a0a0f`, `--text-primary: #e8e6f0`
  - `design-tokens-premium.css` overrides with `--text-primary: #ffffff`, `--interactive-primary: #d5001c` (Porsche Red)
  - `index.html` inline styles define THIRD system: `--bg: #0a0a0f`, `--text: #eceaf4`, `--gold: #c9a84c`
- **Impact**: Buttons show gold but design system defines red as primary. Impossible to maintain.
- **Fix**: Consolidate to single token system, remove all inline :root variables

#### WCAG Accessibility Failures (BL-UX-C2)
- **Contrast failures**: `--text-dim: #b0acc8` on `--bg2: #1a1a24` = 4.2:1 (fails AA 4.5:1 minimum)
- **Affects**: Data labels, section headers, meta text, history items, planet explanations
- **Fix**: Bump `--color-neutral-400` to `#c4c0d8` (5.5:1), `--text-muted` to `#918db0` (4.5:1)

#### Missing "Why It Matters" Explanations (BL-UX-C3)
- **Problem**: Chart shows "Generator 3/5" with ZERO explanation of what this means for user's life
- **Reddit #1 complaint**: "App told me I'm a Generator but didn't explain what that means"
- **Fix**: Add 1-2 sentence plain-English explanations for every HD term
  - Generator: "Consistent renewable energy. Designed to find work you love and master it."
  - Emotional Authority: "Never decide in the moment. Ride your emotional wave first."
  - To Respond: "Don't initiate from your mind. Wait for life to present options."

#### Tab Overload (BL-UX-C6)
- **Problem**: 13 total tabs (Chart, Profile, Transits, Check-In, More▾ + 8 hidden tabs)
- **Steve Jobs principle**: "People can't prioritize 13 things"
- **Fix**: Restructure to 4 primary tabs:
  - My Blueprint (merge Chart + Profile)
  - Today's Energy (merge Transits + Check-In)
  - Relationships (Composite)
  - Deepen (Enhance)
  - More▾ (Diary, Rectify, Saved, Practitioner, Clusters, SMS, Onboarding)

#### Fake Testimonials (BL-UX-C4)
- **Problem**: 6 fabricated testimonials with fake names ("Sarah Mitchell, HD Practitioner · 450+ Client Readings")
- **Reddit feedback**: Fake testimonials are the #1 trust killer
- **Fix**: Remove entirely OR replace with real testimonials + "Early access beta testers" disclaimer

#### Birth Data Duplication (BL-UX-C5)
- **Problem**: Users enter birth data 3 separate times (Chart tab, Profile tab, Composite tab)
- **Fix**: Store in localStorage after first entry, auto-populate all forms, show "Using your birth data: [details] [Change]" banner

### Social Media Integration Roadmap

#### High Priority (BL-SOCIAL-H1, H2, H3)
1. **Twitter/X Sharing** — Pre-filled tweets with chart insights and referral link
   - Template: "Just discovered I'm a {Type} {Profile} ✨ My decision style: {Authority}. Check out your energy blueprint at {link}"
2. **Instagram Image Export** — 1080x1080 PNG with bodygraph + user info + Prime Self branding
   - Format: Bodygraph visual, "Type: Generator 3/5", "Authority: Emotional", watermark
3. **Facebook Sharing** — Open Graph meta tags + share dialog with rich preview
   - Uses og-image-1200x630.png, pre-filled share text

#### Medium Priority (BL-SOCIAL-M1, M2, M3, M4)
1. **TikTok** — Vertical 9:16 format chart images, caption with hashtags ready to paste
2. **Threads** — Meta's Twitter alternative, 500-char optimized posts
3. **Bluesky** — Decentralized network integration, share intent API
4. **Analytics Dashboard** — Track share counts and conversion rates per platform
   - Schema: `social_shares (id, user_id, platform, shared_at, referral_code, utm_source, converted)`

### Design System Status
- **Actual files**: `design-tokens.css`, `design-tokens-premium.css`, `base.css`, `app.css`
- **Target architecture** (not yet implemented): `css/components/` directory with buttons.css, cards.css, forms.css, tabs.css, modals.css, alerts.css, layout.css
- **Token canonical source**: `design-tokens.css` defines `--color-gold-500: #c9a84c` as single source of truth
- **Premium tokens**: Porsche/Apple-inspired overlay, but conflicting gold definitions cause issues

### Competitive Analysis

| Feature | myBodyGraph | Co-Star | Chani | **Prime Self** |
|---------|------------|---------|-------|----------------|
| HD Chart | ✅ Deep | ❌ | ❌ | ✅ Deep |
| Gene Keys | ❌ | ❌ | ❌ | ✅ **Unique** |
| Western Astrology | ❌ | ✅ | ✅ | ✅ |
| Numerology | ❌ | ❌ | ❌ | ✅ **Unique** |
| Multi-system synthesis | ❌ | ❌ | ❌ | ✅ **Only one** |
| Plain language | ❌ | ✅ Good | ✅ Great | ⚠️ **Needs work** |
| Visual design | ⚠️ Dated | ✅ Excellent | ✅ Beautiful | ⚠️ Good bones |
| Mobile UX | ❌ Poor | ✅ Native app | ✅ Native app | ⚠️ PWA, needs polish |
| Price | Free-$50 | Free-$3 | Free-$12 | Free-$500 |

**Prime Self's moat**: Multi-system synthesis — only tool combining HD + Gene Keys + Astrology + Numerology  
**Critical weakness**: Plain language explanations and visual polish — must fix before marketing

### Sprint 18 Implementation Priority

**🔴 This Week (Critical — Must fix before marketing)**:
1. Color token consolidation — single source of truth
2. WCAG contrast fixes
3. Add plain-English explanations for Type, Authority, Strategy, Profile
4. Center descriptions (defined vs open)
5. Remove fake testimonials
6. Consolidate birth data entry (localStorage)
7. Fix mobile nav label mismatches
8. Extract inline CSS to design system
9. Add center pill explanations

**🟡 This Month (Important)**:
1. Load gate names/descriptions from `src/data/`
2. Add channel descriptions
3. Skeleton loading screens
4. Gene Keys journey explanations
5. Transit natal hit personalization
6. Fix spacing/font size inconsistencies
7. Optimize lava lamp background
8. Persistent step guide
9. Card visual hierarchy
10. Code splitting (extract inline JS)
11. Keyboard navigation fixes
12. Screen reader accessibility
13. Touch target sizing (44px minimum)

**🟢 This Quarter (Differentiators)**:
1. Interactive bodygraph (click to learn)
2. Share-ready image generator
3. Real social proof stats
4. Simplified pricing tiers
5. Transit timeline view
6. Progressive onboarding
7. Remove "coming soon" features
8. Beautiful chart wheel
9. Aspect explanations
10. Daily forecast

**Social Media** (7 items across High/Medium priority):
- Twitter, Instagram, Facebook (High)
- TikTok, Threads, Bluesky, Analytics (Medium)
- **Missing columns on `users`**: `tier`, `stripe_customer_id`, `email_verified`, `last_login_at`, `referral_code`
- **Missing columns on `charts`**: `chart_type`, `authority`, `type`
- **SQLite syntax in early migrations** (003, 004) — rewritten to PostgreSQL in deep-dive audit but must be re-applied
- **user_id type mismatch**: Migrations 008–011 originally used `INTEGER` instead of `UUID` — fixed in audit
- **No foreign key on `profiles.status`** — column doesn't exist in live schema

### Remediation Path
1. Run `node workers/src/db/migrate.js` locally with production `NEON_CONNECTION_STRING`
2. Manually verify with `SELECT tablename FROM pg_tables WHERE schemaname='public'`
3. Add missing columns to `users` and `charts` tables

---

## 4. FRONTEND

### Key Design Decisions
- **Vanilla SPA**: Single `index.html` (~4,650 lines) — HTML + inline CSS (~500 lines) + inline JS (~2,500 lines). No framework, no build step.
- **Deployed to Cloudflare Pages** at `selfprime.net` — auto-deploy on git push to main
- **PWA infrastructure**: `manifest.json`, `service-worker.js` (cache-first static, network-first API), offline transit support via IndexedDB (`offline-transits.js`)
- **Dark cosmic theme**: Gold (#c9a84c) + purple accents on deep dark background (#0a0a0f)
- **13 tabs**: Chart, Profile, Enhance, Diary, Check-In, Transits, Composite, Rectify, Practitioner, Clusters, SMS, Onboarding, Saved — only 5 accessible on mobile bottom nav

### Design System
- **Component CSS library** created: `design-tokens.css` (310 lines), `base.css`, 7 component files (buttons, cards, forms, tabs, modals, alerts, layout), aggregated by `prime-self.css`
- **Semantic token system**: `--bg-primary`, `--text-primary`, `--interactive-primary`, `--status-success`, etc.
- **Spacing scale**: 4px base unit (space-1 through space-12)
- **Typography**: Fluid responsive via `clamp()` (text-xs through text-2xl)
- **Design System Adherence Score**: 52/100 — token usage is 85% in component CSS, 40% in inline styles, 15% in JS-rendered HTML

### Critical Frontend Issues
- **Three competing color systems**: `design-tokens.css` (gold/purple), `design-tokens-premium.css` (Porsche red/Apple), inline `<style>` overrides. Same CSS custom properties defined with different values.
- **Z-index chaos**: design-tokens uses 0–70, premium uses 0–700, inline uses raw values (100, 200, 1000, 10000)
- **~500 lines of inline `<style>`** that duplicate and override component CSS — creates specificity conflicts
- **~2,500 lines of inline `<script>`** — all functions are window globals, no modules, no code splitting
- **JS-rendered content uses hardcoded colors**: `#d4af37`, `#555`, `#888`, `#333`, etc. — bypasses token system
- **8 of 13 tabs unreachable on mobile** (no nav path to Check-In, Composite, Rectify, Practitioner, Clusters, SMS, Onboarding, Saved)
- **Mobile nav label mismatch**: "Keys" ≠ "Profile", "Astro" ≠ "Enhance"
- **SW cache list missing**: `artwork.css`, `icons.css`, `prime-self.css`, `prime-self-premium.css` — offline styling breaks

### Accessibility (WCAG 2.1 AA gaps)
- **No focus trap** on modals (auth, pricing, share overlays)
- **Color contrast failures**: `--text-dim: #8882a0` = 3.8:1 (needs 4.5:1). Fix: `#a8a2c0` or `#b0acc8`
- **Missing ARIA**: tab panels lack `role="tabpanel"`, `aria-labelledby`; skip-link defined in CSS but absent from HTML; no `aria-live` regions for dynamic content
- **Touch targets**: help icons 16×16px (needs 44×44px minimum)
- **70+ individually enumerated issues** across 10 audit categories (RES, A11Y, CSS, PWA, JS, SEC, I18N, PERF, UX)
- **8-week remediation roadmap** defined in `FRONTEND_AUDIT.md`

### i18n Status
- Architecture exists (`i18n.js` with locale detection, `t()` function, 5 locale files)
- **All JS-rendered content is hardcoded English** — none of the 20+ render functions use `t()`
- Assessment questions (44 total), mobile nav labels, notifications, share text — all hardcoded
- `en.json` has ~186 keys (covers <20% of visible text)
- No RTL support

### Implementation Roadmap (from IMPLEMENTATION_GUIDE.md)
- Phase 1: CSS migration (✅ complete — design system created)
- Phase 2: HTML integration (defined — ARIA attributes, skip links, semantic HTML)
- Phase 3: JavaScript refactoring (defined — modular ES6 structure)
- Phase 4: Testing (Lighthouse, axe, WAVE, manual KB/screen reader)

---

## 5. SECURITY

### Key Design Decisions
- **Passwords**: PBKDF2-SHA256, 100,000 iterations, 32-byte random salt, 64-byte derived key
- **JWT**: HS256 signing, 24h access token, 30d refresh token
- **CORS**: Dynamic origin checking against whitelist (`selfprime.net`, `prime-self-ui.pages.dev`), hardcoded in `middleware/cors.js`
- **Stripe webhooks**: `crypto.timingSafeEqual` for webhook signature verification
- **Token encryption**: AES-GCM via Web Crypto API (`lib/tokenCrypto.js`)

### Vulnerabilities Found & Fixed (in audits)
- **XSS in `showAlert()`** — was `innerHTML`, now passes through `escapeHtml()`
- **XSS in `renderComposite()`** — `d.area` and `d.note` unescaped, now wrapped
- **9 `onclick="fn('${id}')"` patterns** — attribute-breaking XSS. Fixed with `escapeAttr()` utility
- **Identity spoofing in `cluster.js`** — used `body.createdBy` instead of JWT `request._user.sub`. Fixed.
- **Mass SMS unprotected** — `body.all=true` was accessible to any tier. Fixed with practitioner/admin gate.
- **Timing-safe password comparison** added

### Remaining Security Concerns
- **Telnyx webhook signature verification not implemented** — inbound SMS webhooks accepted unverified
- **Auth token in `localStorage`** — accessible to any XSS payload (no HttpOnly cookie alternative in SPA)
- **No CSRF protection** — API relies solely on Bearer token
- **No password reset flow** — users who forget passwords have no recovery
- **No email verification** — `email_verified` column referenced in code but doesn't exist on table
- **No admin role** — admin-level endpoints (`analytics`, `experiments`, `stats/admin`) use standard JWT with no role elevation
- **HS256 JWT** — symmetric signing; RS256 asymmetric would be more secure (low priority)
- **`Secrets.txt` in repo root** — git history needs cleanup via `filter-branch` or BFG
- **No CSP meta tag in production** (fixed in code but not deployed)

---

## 6. DEPLOYMENT

### Key Design Decisions
- **Backend**: `cd workers && npx wrangler deploy` → `https://prime-self-api.adrper79.workers.dev`
- **Frontend**: Auto-deploy on `git push origin main` via Cloudflare Pages → `https://selfprime.net` (also `prime-self-ui.pages.dev`)
- **12 secrets** configured via `npx wrangler secret put <NAME>`
- **Local dev**: `npx wrangler dev` (Workers at localhost:8787) + `python3 -m http.server 4200` (frontend) + `.dev.vars` for local secrets

### Production Status: BROKEN
- **Stale code deployed** — routes that exist in the codebase return 404 in production (`/api/auth/me`, `/api/validation/*`, `/api/psychometric/*`)
- **CSP violations** blocking Cloudflare Insights and SVG fonts — fixed in code but not deployed
- **Database connection failures** — `/api/diary` returns 500
- **Frontend missing API params** — `/api/transits/forecast` returns 400

### Deployment Hygiene Gaps
- **No automated post-deploy verification** — `verify-production.js` recommended but not implemented
- **No monitoring** — console logs exist but no way to view them without `wrangler tail`
- **Sentry integration coded but never wired** — `lib/sentry.js` never imported
- **Version endpoint** hardcodes stale version number
- **Documentation claims "complete"** but production is broken — documents need "Deployed" vs "Implemented" distinction

### Recommended Fix Sequence
1. `cd workers && npx wrangler deploy --force`
2. `git add frontend/index.html && git commit -m "Fix CSP" && git push origin main`
3. Verify `NEON_CONNECTION_STRING` secret exists; run migrations
4. Test critical endpoints: `/api/health`, `/api/auth/login`, `/api/chart/calculate`, `/api/diary`
5. Create `verify-production.js` automated smoke test

### Operations
- **Monitoring**: `wrangler tail --format pretty` for real-time logs; Cloudflare dashboard for metrics; Neon dashboard for DB
- **Rollback**: `git revert HEAD && git push && wrangler deploy --force`
- **KV cache purge**: `npx wrangler kv key delete "geo:city" --namespace-id <id>`
- **Secret rotation**: All secrets rotatable via `wrangler secret put`; JWT_SECRET rotation invalidates all sessions

---

## 7. UX / DESIGN SYSTEM

### Key Design Decisions
- **Three-layer output architecture**:
  - Layer 1: Quick Start Guide (400-600 words, ZERO jargon, conversational tone — default view)
  - Layer 2: Technical Insights (Gene Keys, astrology, I Ching — opt-in collapsible)
  - Layer 3: Full Technical Chart (HD-specific data for practitioners — separate page)
- **IP-safe rebranding**: Projector → "Guide Pattern", Generator → "Builder Pattern", etc. Comprehensive forbidden/approved term lists in SYNTHESIS_PROMPT_V2.md and GLOSSARY.md
- **Additional systems from existing birth data (zero new intake)**: Numerology (implemented — 63 tests passing), Chinese Astrology/BaZi (planned), I Ching hexagrams (reframing of existing gate data), Mayan Astrology (planned), Vedic/Sidereal (planned), Tarot Birth Cards (derived from Life Path)
- **Pricing tiers**: Free $0 → Seeker $15/mo → Guide $97/mo → Practitioner $500/mo

### UX Research Findings (Reddit synthesis)
- **#1 complaint**: "I got my chart and don't know what any of this means" — jargon overload
- **#1 rage topic**: Paywalls hiding content after data entry
- Users want: plain-language explanations, personalization ("for ME specifically"), cross-referencing between data points, clear visual hierarchy, mobile-first design, dark themes done right (not #000, suggest #121212–#1a1a24), educational progressive disclosure, calming premium aesthetics, affordability transparency, trustworthiness (no fake testimonials, no countdown timers)
- Competitors studied: Co-Star (minimalist), The Pattern (storytelling), Sanctuary (conversational)

### UX Improvements Completed
- **Brand identity assets**: Logo videos, PWA icons, `asset-randomizer.js`
- **Tab restructure**: 13 → 4 proposal (but still 13 in code)
- **Trust fixes**: Fake testimonials removed, social proof fixed (but fallback still shows hardcoded "2,847 weekly users")
- **Missing explanations added**: Type, authority, strategy, profile, center, channel, gate
- **Skeleton loading**, lazy-load, artwork optimizations
- **Interactive bodygraph**, transit timeline, overview tab
- **Share card system** (`share-card.js`, `shareImage.js`)

### UX Issues Remaining
- 13 tabs still overwhelming — no grouping or progressive disclosure implemented
- Assessment forms (44 questions) with no progress indicator or save-as-you-go
- "Coming soon" stubs visible to users (`synthesizeCluster`, `shareChartImage`, `downloadChart`)
- Dark/light mode toggle missing — dark hardcoded, premium CSS defines light rules but no user control
- Birth data entered 3x across different tabs (duplicate form problem)
- No hash-based routing — no deep linking, no browser back/forward, no shareable URLs
- Pricing shock: $0 → $15 → $97 → $500 with no $5-10 entry tier
- $500/mo tier lists features (white label) that don't fully exist
- Gene Keys knowledgebase 58% complete (37/64 keys)
- No "What is this?" tooltips on technical terms
- Loading states use generic spinners instead of branded animations

### Knowledge Base Enhancement Status
- Phase 1 ✅: Authority, Centers, Definition (+40% synthesis accuracy)
- Phase 2 ✅: Planets in signs, Major aspects (+30% synthesis depth)
- Phase 3 ✅: Six Knowledges epistemological framework (+15% wisdom depth)
- Phase 4 ✅: Houses + expanded Gene Keys 37/64 (+10-15% synthesis subtlety)
- Phase 5 (optional): I Ching hexagrams, complete Gene Keys 64/64
- **Total enhancement**: +90-95% synthesis robustness from original baseline
- **RAG context size**: ~5,800-7,200 words per synthesis (~7,500-9,400 tokens)

---

## 8. CROSS-CUTTING: KEY GAPS, CONTRADICTIONS & AMBIGUITIES

### Critical Contradictions
1. **Documentation says "complete" but production is broken** — BACKLOG.md shows "Sprints 1-14 COMPLETE ✅", BUILD_LOG shows "97% completion (40/41 tasks)", but multiple production endpoints return 404/500
2. **Two tier systems**: `practitioner.js` uses `free/standard/professional/enterprise`; `billing.js` / `stripe.js` uses `free/seeker/guide/practitioner`
3. **Two API spec documents** with different field names and response shapes
4. **Three competing CSS color systems** — design-tokens.css, design-tokens-premium.css, inline styles define the same custom properties with different values
5. **Duplicate Stripe webhook handlers** — both `webhook.js` and `billing.js` process Stripe events (webhook.js is preferred: uses transactions)
6. **Table count disagreement**: Root ARCHITECTURE.md says 48; docs/ARCHITECTURE.md says 49; live DB has ~15-18; Sprint 17 audit found 48 with `usage_tracking` never created

### Critical Gaps
1. **No production deployment of current code** — all audits confirm stale code is running
2. **32 phantom database tables** — half the codebase is dead code until migrations run
3. **~60 dead API routes** that will crash at runtime
4. **No password reset flow**
5. **No email verification**
6. **No admin role system**
7. **7 of 8 cron tasks crash daily** (reference phantom tables)
8. **No automated deployment verification**
9. **No production monitoring/alerting** (Sentry coded but not wired)
10. **i18n architecture exists but <20% of text is translatable**

### Ambiguities
1. **Which design token file is canonical?** `design-tokens.css` (gold/purple) or `design-tokens-premium.css` (Porsche red)? No documentation resolves this.
2. **Frontend URL**: Different docs reference `selfprime.net`, `primeself.app`, `prime-self-ui.pages.dev` — unclear which is the canonical production URL
3. **API base URL in marketplace docs** uses `api.primeself.app` which doesn't appear to be configured
4. **Pricing tier structure**: UX research docs suggest adding a $5-10 tier and removing $500; current code still has the original 4-tier structure
5. **Embed widget pricing**: EMBED_WIDGET_GUIDE.md says Practitioner tier at "$19/mo" which doesn't match any tier definition elsewhere

---

## 9. DOCUMENT INVENTORY BY TOPIC

### Architecture (6 docs)
- `ARCHITECTURE.md` (root) — Master architecture reference
- `docs/ARCHITECTURE.md` — Condensed version
- `BUILD_BIBLE.md` — Layer-by-layer implementation reference
- `BUILD_LOG.md` — Complete implementation history (7,424 lines)
- `docs/LESSONS_LEARNED.md` — Debugging patterns, verification methodology, common gotchas
- `WORKERS_AUDIT_REPORT.md` — Comprehensive worker/handler audit with file-by-file status

### API Design (4 docs)
- `docs/API_SPEC.md` — Formal API specification (with known drift)
- `docs/API.md` — Alternative API reference
- `docs/TIER_ENFORCEMENT.md` — Middleware integration patterns for tier gating
- `docs/API_MARKETPLACE.md` — API marketplace listing guide (aspirational)

### Database (2 docs)
- `RAW_SQL_AUDIT.md` — Audit of centralized vs inline SQL (52 QUERIES keys, ~150 raw SQL statements)
- `docs/AUDIT_2025-01.md` — Deep-dive re-audit including DB schema phase (SQLite→PostgreSQL rewrites)

### Frontend (7 docs)
- `frontend/DESIGN_SYSTEM.md` — Component library documentation (tokens, components, accessibility)
- `frontend/IMPLEMENTATION_GUIDE.md` — Step-by-step migration from monolith to component architecture
- `frontend/SUMMARY.md` — UI modernization summary with roadmap
- `frontend/ACCESSIBILITY_AUDIT.md` — WCAG 2.1 AA compliance audit (10 critical issues)
- `docs/FRONTEND_AUDIT.md` — Comprehensive 341-line frontend audit (13-tab inventory, 50+ issues)
- `EMBED_WIDGET_GUIDE.md` — Embeddable chart widget for external sites
- `docs/LANGUAGE_AUDIT.md` — User-facing language clarity audit

### Security (2 docs)
- `SECRETS_GUIDE.md` — Secret rotation and management procedures
- `docs/AUDIT_2026-03-08.md` — Production audit revealing stale deployment, XSS, CSP issues

### Deployment (3 docs)
- `DEPLOY.md` — Step-by-step deployment procedures
- `docs/OPERATION.md` — Operations runbook (deploy, migrate, monitor, Stripe incident response)
- `SETUP_COMPLETE.md` — Stripe integration setup verification

### UX / Design System (10 docs)
- `UX_DEEP_REVIEW.md` — Deep UX review with Steve Jobs principles
- `CHANGELOG_UX.md` — UX improvement tracking
- `docs/UX_IMPROVEMENTS.md` — Three-layer output architecture + additional systems design
- `docs/UX_EXPANSION_README.md` — Implementation guide for UX expansion
- `docs/REDDIT_UX_RESEARCH_SYNTHESIS.md` — Reddit community sentiment analysis (10 themes)
- `docs/SYNTHESIS_PROMPT_V2.md` — Revised LLM system prompt (drop-in replacement)
- `docs/ADDITIONAL_SYSTEMS.md` — Numerology, BaZi, Mayan, Vedic integration code
- `docs/KNOWLEDGE_BASE_ENHANCEMENT.md` — RAG context expansion (Phases 1-4 complete)
- `docs/GLOSSARY.md` — Comprehensive term definitions + IP-safe language guide
- `MOBILE_OPTIMIZATIONS.md` — PWA + mobile UX improvements

### Cross-cutting (7 docs)
- `README.md` — Project overview and quick start
- `BACKLOG.md` — Known issues, technical debt, sprint planning
- `DOCUMENTATION_INDEX.md` — Master documentation index
- `TEST_PLAN.md` — Comprehensive test plan
- `PWA_SETUP_GUIDE.md` — Progressive Web App setup
- `docs/STRIPE_SETUP.md` — Stripe integration setup guide
- `docs/UPGRADE_FLOW_TESTING.md` — Subscription upgrade test scenarios (10 test cases)
