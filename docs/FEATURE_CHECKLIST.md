# Prime Self — Full Feature Checklist
> Working inventory document. Use [README.md](README.md), [BACKLOG.md](BACKLOG.md), and [CODEBASE_MAP.md](CODEBASE_MAP.md) for current canonical state. This checklist may include point-in-time status notes.

**Last updated**: 2026-03-15  
**Deployment**: Cloudflare Workers (API) + Cloudflare Pages (frontend)

---

## Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ | **Functional** — code exists, tested, works end-to-end |
| ⚠️ | **Partially functional** — code exists but blocked by config, migration, or unverified in prod |
| 🔶 | **Backend only** — API handler exists; no frontend UI wired |
| 🖥️ | **Frontend only** — UI exists; no backend call (static/demo) |
| 📐 | **Design only** — spec/doc exists, not started in code |
| ❌ | **Not functional** — known broken in production |

---

## 1. Core Chart Engine

| Feature | Status | Summary |
|---------|--------|---------|
| Human Design chart calculation | ✅ | Full ephemeris engine (`src/engine/`) — Keplerian + Meeus JPL accuracy. Calculates gates, channels, type, authority, profile, centers, incarnation cross |
| Astrology (Western) | ✅ | Calculates placements for 10 planets + Ascendant/MC. Returns sign, house, degree. Bug fixed 2026-03-13: `result.astrology` (was `westernAstrology` — data stored null) |
| Numerology | ✅ | Life path, expression number, soul urge, personality number from birth date + name |
| Gene Keys | ✅ | 64 Gene Keys mapped from HD gates — includes Gift, Shadow, Siddhi per gate |
| Vedic astrology | ✅ | Jyotish chart with Vedic placements and nakshatra assignments |
| Ogham (Celtic) | ✅ | Seasonal/elemental Celtic tree calendar overlay |
| Retrograde detection | ✅ | Real ephemeris via `getAllPositions(jd)` — not estimated. Replaced placeholder in Phase 3 |
| Birth time rectification | ✅ | `POST /api/rectify` — runs chart at ±window in steps; shows what elements change (type, authority, profile, cross, channels, ascendant) |
| Geocoding | ✅ | `GET /api/geocode` — Nominatim query, returns lat/lng/timezone. Auto-fills on location blur |
| Chart save to profile | ✅ | `POST /api/chart/save` — saves natal chart JSON to `user_profiles` table |
| Chart retrieval | ✅ | `GET /api/chart/:id` — DB tables confirmed healthy in prod. All blocking migrations applied 2026-03-15. tierEnforcement has graceful try/catch fallback |
| Chart history | ✅ | `GET /api/chart/history` — lists saved charts for authenticated user |
| Transit forecast | ✅ | `GET /api/transits/forecast` — 1–90 day forward forecast with gate ingresses and outer-planet aspects against natal |
| Life cycles | ✅ | `GET /api/cycles` — Saturn return, Uranus opposition, Chiron return, etc. with age/dates/guidance |

---

## 2. AI Synthesis (Profile)

| Feature | Status | Summary |
|---------|--------|---------|
| Full AI profile generation | ✅ | `POST /api/profile/generate` — sends full chart data + question to Claude/Anthropic; synthesizes gates, Gene Keys, astrology, numerology into one narrative |
| Streaming profile | ✅ | `POST /api/profile/generate/stream` — SSE stream variant for progressive rendering |
| Saved profile list | ✅ | `GET /api/profile/list` — handler complete; all blocking migrations (020, 021, 027, 029, 030) applied in prod 2026-03-15 |
| Evaluation type quick picks | ✅ | Frontend: 4 pill buttons (Full Blueprint / Daily Focus / Relationships / Career) reveal 2 preset question buttons that pre-fill the question input (UX-QUICKPICK, 2026-03-13) |
| Practitioner context injection | ✅ | If requesting user has a practitioner, their synthesis_style + client ai_context + shared notes are injected as 3 context vectors into the prompt |
| Deferral CTA | ✅ | Free/individual users see "Work with a practitioner" CTA after profile output |
| Library vocabulary in prompt | ✅ | Structural vocabulary (Polarity/Trinity/Co-arising/Emergence) injected into SYSTEM_PROMPT from `vocabulary.json` |
| 7 Forges (archetypes) | ✅ | 6 scored Forges + 6th Forge "Self" (unscored, always present) in synthesis output |
| 7 Knowledges | ✅ | 7th Knowledge "Self" — `nativeEpistemology` + `forgeOfSelf` section in profile output |
| Synthesis opening/closing frames | ✅ | Opening as mirror, closing as 7th Knowledge reflection |
| AI-generated chart interpretations (deep) | 📐 | `BL-MV-1.1-DEEP` — Gate-by-gate AI narrative beyond theme names. Not started, ~1 week effort |
| Composite chart AI reading | ✅ | `POST /api/composite` — two charts synthesized; gated to practitioner+ tier |

---

## 3. Today's Transits & Daily Features

| Feature | Status | Summary |
|---------|--------|---------|
| Today's transits | ✅ | `GET /api/transits/today` — real-time planetary positions vs natal gates. Shows transit gate, natal gate, alignment type, bodypart, description |
| Offline transit cache | ✅ | `offline-transits.js` — Service Worker caches 7 days of transit data; prefetches on wake |
| Daily check-in | ✅ | `POST /api/checkin` — saves mood, alignment score, strategy, note. Migration 013 applied in prod |
| Check-in history | ✅ | Migration 013 applied. Re-tested 2026-03-15 |
| Check-in stats | ✅ | `GET /api/checkin/stats` — 7-day stats, gate frequencies. Migration 013 applied |
| Check-in streak | ✅ | `GET /api/checkin/streak` — consecutive days. Migration 013 applied |
| Check-in reminders | ✅ | `POST/GET /api/checkin/reminder` — stores reminder time preference per user |
| Diary / life events | ✅ | `POST/GET/PUT/DELETE /api/diary` — CRUD journal with optional transit correlation: calculates full transit snapshot for the event date |
| Transit alerts | ✅ | `GET/POST/DELETE /api/alerts` — user-defined alert conditions (aspect, cycle, gate ingress). Push notification delivery |
| Timing tool | ✅ | `POST /api/timing/find-dates` — finds optimal calendar dates for an intention using transit scoring against natal. Includes 20+ pre-defined intention templates |
| Timing templates | ✅ | `GET /api/timing/templates` — returns list of intention templates (launch, romance, travel, healing, etc.) |
| SMS transit digest | ⚠️ | Handler fully implemented (Telnyx, opt-in/out, digest generation). Requires `TELNYX_API_KEY` + `TELNYX_PHONE_NUMBER` configured as secrets |
| Push notifications (Web Push) | ✅ | Full RFC 8030/8291 implementation — VAPID ECDSA JWT + ECDH + HKDF + AES-128-GCM. Quiet hours (timezone-aware). Subscribe/unsubscribe via `/api/push` |

---

## 4. Authentication & Accounts

| Feature | Status | Summary |
|---------|--------|---------|
| Email/password registration | ✅ | `POST /api/auth/register` — PBKDF2 hash (100k iterations, SHA-256), JWT issued, refresh cookie set |
| Email/password login | ✅ | `POST /api/auth/login` |
| Silent token refresh | ✅ | `POST /api/auth/refresh` — exchanges HttpOnly refresh cookie for new access token |
| Logout | ✅ | `POST /api/auth/logout` — clears refresh cookie |
| Get current user | ✅ | `GET /api/auth/me` |
| Forgot password | ⚠️ | `POST /api/auth/forgot-password` — always returns 200 (enumeration-safe). Email delivery blocked until migration 021 applied in prod. Code is correct and deployed |
| Reset password | ⚠️ | `POST /api/auth/reset-password` — returns 400 (not 500) when migration not applied. Token-wrapping transaction in place (BL-RESET-001). Fully functional once migration 021 applied |
| Delete account | ✅ | `DELETE /api/auth/delete-account` — cascades user data. Audit trail in `account_deletions` table (migration 039). Rate limited 3/min. Analytics event tracked |
| Data export (GDPR) | ✅ | `GET /api/auth/export` — returns all user data as JSON. Fault-tolerant with try/catch |
| Google OAuth | ⚠️ | Handler complete (`oauthSocial.js`). Requires `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` secrets configured. Migration 022 required |
| Apple Sign-In | ⚠️ | Handler complete. Requires `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` secrets configured |
| Rate limiting (login brute force) | ✅ | KV-backed 60 req/min limiter on auth endpoints. Fails closed (503) if KV unavailable |
| JWT/session security | ✅ | HttpOnly SameSite=Strict refresh cookie; short-lived access tokens |

---

## 5. Billing & Subscriptions

| Feature | Status | Summary |
|---------|--------|---------|
| Stripe checkout | ✅ | `POST /api/billing/checkout` — creates Stripe checkout session for Free/Individual/Practitioner/Agency tiers |
| Annual billing | ✅ | `billingPeriod='annual'` param routes to annual price IDs in wrangler.toml |
| One-time purchases | ✅ | `POST /api/billing/checkout-one-time` — 4 products: Single Synthesis ($19), Composite Reading ($29), Transit Pass ($12), Lifetime Individual ($299) |
| Billing portal | ✅ | `POST /api/billing/portal` — Stripe-hosted manage/cancel portal |
| Get subscription | ✅ | `GET /api/billing/subscription` — returns current plan, status, renewal date |
| Cancel subscription | ✅ | `POST /api/billing/cancel` |
| Upgrade subscription | ✅ | `POST /api/billing/upgrade` — prorated upgrade mid-cycle |
| Stripe webhooks | ✅ | Handles: checkout.session.completed, invoice.paid, customer.subscription.deleted, payment_intent.payment_failed |
| Tier enforcement | ✅ | `tierEnforcement.js` — `resolveEffectiveTier()` gates all protected endpoints. Migration-resilient (try/catch, 2026-03-13). `agency`/`individual` tier access bug fixed 2026-03-15 across analytics, embed, notion, experiments, keys, promo handlers |
| Free tier quotas | ✅ | 3 profiles/month for free users; tracked in `user_usage` table |
| Lifetime access | ✅ | `lifetime_access` column (migration 027) — elevates to minimum 'individual' tier forever |
| Transit pass | ✅ | `transit_pass_expires` column (migration 027) — grants `transitSnapshots` access until expiry |
| Grandfather subscriptions | ✅ | Migration 028 — 90-day grace period for legacy subscribers at price lock |
| Stripe price IDs | ✅ | All 12 price IDs configured in `wrangler.toml` (individual, practitioner, agency, annual variants, 4 one-time products) |
| Promo codes | ✅ | `GET /api/promo/validate`, `POST /api/promo/apply` — admin-created codes with discount/free-tier grants |
| Admin promo management | 🔶 | `POST/GET /api/admin/promo` — create and list codes. No admin UI exists |

---

## 6. Practitioner Features

| Feature | Status | Summary |
|---------|--------|---------|
| Client management | ✅ | `handlePractitioner` — add/list/remove clients; client detail view with AI context |
| Session notes | ✅ | `GET/POST/PUT/DELETE /api/practitioner/notes` — full CRUD. `share_with_ai` toggle includes notes in synthesis prompt |
| AI context per client | ✅ | `GET/PUT /api/practitioner/ai-context` — free-text AI context stored per client, injected into profile synthesis |
| Practitioner directory | ✅ | `GET /api/directory` — public browsable list with specialization/certification/format filters + pagination |
| Public practitioner profile | ✅ | `GET /api/directory/:slug` — public view with booking link |
| Edit directory profile | ✅ | `GET/PUT /api/practitioner/directory-profile` — display_name, bio, specializations, certification, booking_url, is_public toggle |
| Practitioner invitations | ✅ | `POST /api/practitioner/invite` — sends email invite to client (migration 024) |
| Roster / client list | ✅ | `GET /api/practitioner/roster` |
| Agency seats | ✅ | `handleAgency` — invite/list/remove sub-accounts under Agency tier. Migration 029 |
| Branded PDF export | ✅ | `POST /api/practitioner/clients/:id/pdf` — generates practitioner-branded PDF with their name/website in header |
| Practitioner 500 fix | ✅ | Non-practitioners visiting practitioner routes now get 402/403 instead of 500 (tierEnforcement fix, 2026-03-13) |

---

## 7. Achievements & Gamification

| Feature | Status | Summary |
|---------|--------|---------|
| Achievement badges | ✅ | `GET /api/achievements` — 30+ unlockable achievements across categories (charts, profiles, check-ins, streaks, social) |
| Achievement progress | ✅ | `GET /api/achievements/progress` — per-achievement `{current, target, percentage}` |
| Leaderboard | ✅ | `GET /api/achievements/leaderboard` — ranks users by achievement points. `user_achievement_stats` table (migration 004) confirmed present in prod |
| Achievement track event | ✅ | `POST /api/achievements/track` — records events that unlock achievements |
| Push notification on unlock | ✅ | Achievement unlock triggers push notification fire-and-forget |
| Activity stats | ✅ | `GET /api/stats/activity` — streaks, profile count, last active |

---

## 8. Social & Sharing

| Feature | Status | Summary |
|---------|--------|---------|
| Celebrity chart comparison | ✅ | `GET /api/compare/celebrities` — matches user chart to database of celebrity charts by type/authority/profile alignment |
| Celebrity search | ✅ | `GET /api/compare/search` — search by name |
| Celebrity categories | ✅ | `GET /api/compare/categories` — lists all categories with counts. `GET /api/compare/category/:category` — browse by category |
| Celebrity list | ✅ | `GET /api/compare/list` — all celebrities browsable |
| Celebrity detail | ✅ | `GET /api/compare/celebrities/:id` — detailed comparison between user and specific celebrity |
| Share chart card | ✅ | `POST /api/share/chart` — generates shareable link/card |
| Share achievement | ✅ | `POST /api/share/achievement` |
| Share celebrity match | ✅ | `POST /api/share/celebrity` |
| Share referral | ✅ | `POST /api/share/referral` |
| Share stats | ✅ | `GET /api/share/stats` — click/view counts for shared content |
| Share-as-image (social card) | ✅ | `UX-SHARE` — branded Instagram/Twitter card image. `share-card.js` Canvas renderer (600×800 + 1080×1920 Blueprint). Buttons wired in chart + profile render functions |
| Cluster (community groups) | ✅ | Full CRUD for user-created HDtype-based groups — create, join, leave, list members, post, react |
| Referral program | ✅ | Generate code, track signups, $5 welcome bonus on conversion, 25% recurring revenue share as Stripe credit. Frontend wired (FEAT-REF) |

---

## 9. Integrations

| Feature | Status | Summary |
|---------|--------|---------|
| Notion sync | ✅ | OAuth flow + sync clients to Notion database + export profile to Notion |
| Discord bot | ✅ | `discord/` worker — `/primself date time city` slash command returns Quick Start Guide embed. Rate-limited (3/user/day), signature-verified |
| Discord deep features | 📐 | Daily transit digests, practitioner commands, community features — designed in `discord/DISCORD_USER_GUIDE.md`, not built |
| WordPress plugin | ✅ | Full plugin at `wordpress-plugin/` — shortcode `[primeself_chart]`, widget, admin settings panel, API client class |
| Embed widget | ✅ | `/api/embed/validate` + API key guard. Documentation in `EMBED_WIDGET_GUIDE.md` |
| API keys | ✅ | `GET/POST/DELETE /api/keys` — create/revoke developer API keys for white-label embed |
| Zapier / Make integration | 📐 | Planned in `docs/API_MARKETPLACE.md` — not built |
| RapidAPI listing | 📐 | Planned — not built |
| X/Twitter messaging | ⛔ | `FEAT-X` — blocked by $100/mo X Basic API tier. Not started |
| Background video delivery | ✅ | Cloudflare R2 + range-request serving. See `BACKGROUND_VIDEO_DELIVERY.md` |

---

## 10. Psychometric / Enhance Tab

| Feature | Status | Summary |
|---------|--------|---------|
| Big Five personality assessment | ✅ | 44-question IPIP-style assessment → O/C/E/A/N scores. Results saved to `user_psychometric` table |
| VIA Character Strengths | ✅ | 24-strength survey. Top 5 strengths returned |
| Cross-validation with HD | ✅ | Results injected into profile synthesis context — "your HD Gate 47 aligns with Big Five Openness score of 82%" |
| Enhance tab UI | ✅ | Frontend tab with both assessments, result display, rescore button |

---

## 11. Analytics & Experiments

| Feature | Status | Summary |
|---------|--------|---------|
| Event tracking | ✅ | `POST /api/analytics/track` — custom events via `analytics_events` table (migration 014) |
| Plausible analytics | ✅ | `window.plausible()` wired in `trackEvent()` — fires on profile generate, chart calculate, tab switch |
| A/B experiments | ✅ | `GET/POST/PATCH /api/experiments` — create experiments, record variant assignments, get results with statistical significance |
| Analytics admin UI | 📐 | No dashboard UI. Experiments admin endpoint exists but no frontend panel |

---

## 12. PWA / Mobile

| Feature | Status | Summary |
|---------|--------|---------|
| Progressive Web App | ✅ | Service worker (`pwa.js`), manifest, install prompt. iOS 16.4+ push notification support |
| Offline mode | ✅ | 7-day transit cache via `offline-transits.js`. Static assets cached by service worker |
| Pull-to-refresh | ✅ | Touch gesture on mobile reloads active tab data. Fixed 2026-03-13 (was silently doing nothing for all tabs) |
| Mobile nav | ✅ | Bottom bar + sidebar drawer. 5-item primary nav with overflow drawer |
| Background video | ✅ | Adaptive quality (720p/480p/240p) by network speed. Mobile gets 480p max |
| Push notifications | ✅ | Web Push RFC 8291 with VAPID. Quiet hours respect user timezone. Subscribe/manage in settings |
| i18n / localization | 🔶 | `i18n.js` infrastructure built with `window.t()` helper and `data-i18n` attributes on HTML elements. Translation strings only in English currently |

---

## 13. Security

| Feature | Status | Summary |
|---------|--------|---------|
| Authentication (JWT + refresh cookie) | ✅ | Short-lived access token + HttpOnly SameSite=Strict refresh cookie |
| CSRF protection | ✅ | SameSite cookie + Origin header validation |
| Content Security Policy | ✅ | No `unsafe-inline` — all scripts external. CSP enforced via `frontend/_headers` on Cloudflare Pages |
| Password hashing | ✅ | Web Crypto PBKDF2 (100,000 iterations) |
| Rate limiting | ✅ | KV-backed 60 req/min. Fails closed (503) if KV down (fixed BL-RATELIMIT-001) |
| SQL injection prevention | ✅ | All queries parameterized via Neon `query(sql, params)` |
| XSS prevention | ✅ | `escapeHtml()` on all user content renders; CSP blocks inline scripts |
| Race condition quota bypass | ✅ | Fixed BL-RACE-001 (2026-07-17) — atomic DB check prevents concurrent request bypass |
| Password reset token reuse | ✅ | Fixed BL-RESET-001 (2026-07-17) — single transaction wraps token invalidation + password update |
| Password reset user enumeration | ✅ | Fixed (2026-03-15) — `handleForgotPassword` always returns identical 200 response. DB errors caught and swallowed. No enumeration possible. Email delivery blocked until migration 021 applied |
| Sentry error tracking | ✅ | `SENTRY_DSN` configured in Cloudflare Workers (2026-03-15). Error capture active |
| Webhook signature verification | ✅ | Stripe (HMAC-SHA256), Telnyx (Ed25519), Discord (Ed25519) all verified |

---

## 14. Onboarding

| Feature | Status | Summary |
|---------|--------|---------|
| First-run modal | ✅ | `first-run.js` — 3-step modal for new users (what it is, what you need, what you'll get) |
| Forge onboarding | ✅ | `GET/POST /api/onboarding` — KV-backed progress through 6 Forge arcs. Each Forge has chapters with personalized AI context |
| Step guide | ✅ | Sidebar progress indicator showing completed onboarding steps |
| Wizard flow (single-form) | 📐 | `UX-WIZARD` — unified birth data → eval type → question → result flow replacing two separate forms. Not started |

---

## 15. Frontend UI System

| Feature | Status | Summary |
|---------|--------|---------|
| Design tokens | ✅ | CSS custom properties for color, spacing, typography, elevation (`design-tokens.css`) |
| Premium theme | ✅ | `prime-self-premium.css` + `design-tokens-premium.css` — dark gold aesthetic |
| Light mode | ✅ | `html[data-theme="light"]` overrides |
| Bodygraph SVG | ✅ | `bodygraph.js` — generates HD bodygraph SVG with defined/undefined centers, channels, gates |
| Explanations / tooltips | ✅ | `explanations.js` — gate/channel/center hover/tap explanations |
| Lazy loading | ✅ | `lazy.js` + `window.onTabActivated` — defers non-active tab JS |
| Inline style cleanup | ✅ | 311 → 56 inline styles (82% reduction). All `data-action` delegation |
| Accessibility | ✅ | `aria-live`, `role="status"` on 7 dynamic regions. Full keyboard tab navigation |
| Share card generator | ✅ | `share-card.js` — Canvas-based card renderer for share feature. Fully wired with `openBlueprintCard` and `openLastShareCard` actions |
| Blueprint / Wizard UX merge | 📐 | `UX-BLUEPRINT` — merge Chart + AI Profile tabs into single Blueprint page. Not started |

---

## 16. Infrastructure

| Feature | Status | Summary |
|---------|--------|---------|
| Cloudflare Workers (API) | ✅ | Deployed. Last deploy exit 0 |
| Cloudflare Pages (frontend) | ✅ | Deployed |
| Neon PostgreSQL | ✅ | 39 migrations (000–041). All applied to production DB. Verified 2026-03-15 via MCP |
| Cloudflare KV | ✅ | Rate limiting, offline transit cache, onboarding progress |
| Cloudflare R2 | ✅ | PDF cache, background video delivery |
| Health endpoint | ✅ | `GET /api/health?full=1` — checks DB, KV, R2, secrets presence |
| Cron jobs | ✅ | `cron.js` — scheduled transit digest, push notification, leaderboard refresh |
| Error logging | ✅ | `console.error` with structured context in all handlers. Sentry DSN configured (2026-03-15) |

---

## 17. Missing / Should-Have (Not in Codebase or Design)

These are gaps identified by comparing current build against best-in-class apps in the space:

| Gap | Impact | Notes |
|-----|--------|-------|
| **Email verification on signup** | 🔴 High | No email confirmation step — any email address can register without verification. Enables spam accounts and lost-password deadends |
| **Admin dashboard** | 🔴 High | No internal UI for user management, promo codes, experiment results, revenue metrics. Currently operator-only via API |
| **Transactional email flows** | 🔶 Medium | `RESEND_API_KEY` active in prod (2026-03-15). Billing failure emails functional. No welcome email, no onboarding drip, no digest email |
| **In-app notification feed** | ✅ Done | Notification bell in header + slide-out drawer with `GET /api/push/history` integration |
| **Search across saved profiles** | ✅ Done | `GET /api/profile/search?q=` endpoint with ILIKE search + debounced frontend search input |
| **Chart versioning / diff** | ✅ Done | Charts table uses INSERT (not UPSERT) — all versions preserved. Chart history UI + `loadChartById` added |
| **Two-factor authentication (2FA)** | ✅ Done | TOTP 2FA: setup, enable, disable, verify endpoints + client-side QR code generation (qr.js). No SMS 2FA |
| **User preference settings page** | 🔶 Medium | Only quiet hours/timezone stored. No notification preferences UI, theme toggle persistence, or language selection |
| **Stripe Customer Portal custom branding** | 🔶 Low | Portal is Stripe-hosted with default branding |
| **Terms of Service / Privacy Policy** | ✅ | `frontend/terms.html` and `frontend/privacy.html` exist and are linked in footer and auth form |
| **Cookie consent / GDPR banner** | ✅ | Plausible analytics is cookieless + GDPR-compliant; only auth cookies (strictly necessary, exempt). Registration form links ToS/Privacy |
| **Mobile app (native iOS/Android)** | 📐 Design | ADR-008 decides PWA first. Native blocked until PWA proves insufficient |
| **Zapier/Make automation** | 📐 Design | Designed in `API_MARKETPLACE.md`. Not started |
| **RapidAPI marketplace listing** | 📐 Design | Designed. Not started |
| **Full HD gate library (64 gates × deep content)** | 📐 Design | `BL-MV-1.1-DEEP` — AI-generated per-gate narrative interpretations. Currently gate name + theme only |
| **Gene Keys activation sequence** | 📐 Design | Product concept only — no implementation |
| **Pricing page (public)** | ✅ Done | `frontend/pricing.html` — standalone SEO page with JSON-LD, all 4 tiers, FAQ section |
| **Onboarding email sequence** | 📐 Design | Planned in monetization plan — not built |
| **Affiliate / white-label portal** | 📐 Design | Revenue share designed but no practitioner-facing dashboard for tracking referrals + payouts |
| **Multi-language support** | 🔶 Medium | i18n infrastructure (`window.t()`, `data-i18n`) exists but zero non-English strings |

---

## 18. Production Blockers (Action Required)

| ID | Issue | Severity | Fix |
|----|-------|----------|-----|
| ~~BLOCKER-DB~~ | ~~Apply all pending migrations~~ | ✅ Resolved 2026-03-15 | All 31 migrations (000–030) applied via Neon MCP |
| PROD-P0-001 | Chart retrieval (`GET /api/chart/:id`) — verify in prod after deploy | 🟡 Verify | Deploy latest code + smoke test |
| PROD-P0-002 | Password reset email delivery (code fixed, migration 021 applied, RESEND_API_KEY active) | ✅ Resolved 2026-03-15 | `RESEND_API_KEY` pushed to Cloudflare. Email delivery unblocked |
| BL-MV-N4 | Verify `RESEND_API_KEY` active in prod | ✅ Resolved 2026-03-15 | Secret pushed. `GET /api/health?full=1` → `secrets.hasResend` should be true |
| PROD-P1-009 | AUTH_PREFIXES trailing slash bug | 🟠 High | Verify fix deployed — test `/api/checkin/` with valid token |
| SENTRY | Sentry DSN not configured | ✅ Resolved 2026-03-15 | `SENTRY_DSN` pushed to Cloudflare Workers |
| TOS | No Terms of Service or Privacy Policy | ✅ Resolved | `frontend/terms.html` and `frontend/privacy.html` exist and are live |

---

## Document History

| Date | Change |
|------|--------|
| 2026-03-14 | Initial creation — full inventory of 18 feature categories, 130+ items |
| 2026-03-15 | Codebase audit session 5: 7 tier access bugs fixed (agency/individual silently blocked in analytics, embed, notion, experiments, keys, promo, tierEnforcement); try/catch added to 5 handlers (forecast, transits, onboarding, timing, analytics); 16 dead queries removed from queries.js (2017→1915 lines); build status updated 292→250 |
| 2026-03-15 | All 31 DB migrations confirmed applied via Neon MCP. BLOCKER-DB cleared. Daily check-ins, leaderboard, saved profiles, chart retrieval all unblocked. Registration form ToS/Privacy consent notice added. Multiple stale ❌/⚠️ statuses corrected |
| 2026-03-15 | `RESEND_API_KEY` and `SENTRY_DSN` pushed to Cloudflare Workers. BL-MV-N4, PROD-P0-002, SENTRY rows resolved. Error tracking and email delivery fully active |
| 2026-03-15 | Error management + analytics hardening: try/catch on delete-account/getMe/exportData/getCategories, audit INSERT fault-tolerance (GDPR), `ok: false` on all error responses, `ACCOUNT_DELETE` + `RATE_LIMITED` analytics events wired, LLM structured logging, account deletion rate limit (3/min). API docs updated with celebrity comparison + account management sections. Migrations list updated (39 files, 000–041) |
