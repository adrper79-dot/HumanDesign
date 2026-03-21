# Prime Self — Full Feature Checklist

> **Authoritative current-state document.** See [MASTER_BACKLOG_SYSTEM_V2.md](MASTER_BACKLOG_SYSTEM_V2.md) for tracked work items and [audits/issue-registry.json](audits/issue-registry.json) for open issues.

**Last Updated:** 2026-03-21 (World-Class Market Assessment corrections applied)  
**Deployment:** Cloudflare Workers (API) + Cloudflare Pages (frontend)

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

| Feature | Status | Notes |
|---------|--------|-------|
| Human Design chart calculation | ✅ | Full ephemeris engine — Keplerian + Meeus JPL accuracy. Gates, channels, type, authority, profile, centers, incarnation cross |
| Astrology (Western) | ✅ | 10 planets + Ascendant/MC. Sign, house, degree |
| Numerology | ✅ | Life path, expression number, soul urge, personality number |
| Gene Keys (Frequency Keys) | ✅ | All 64 keys populated with Gift/Shadow/Siddhi/archetype/message/contemplation |
| Vedic astrology | ✅ | Jyotish chart with Vedic placements and nakshatra assignments |
| Ogham (Celtic) | ✅ | Seasonal/elemental Celtic tree calendar overlay |
| Retrograde detection | ✅ | Real ephemeris via `getAllPositions(jd)` |
| Birth time rectification | ✅ | `POST /api/rectify` — runs chart at ±window in steps |
| Geocoding | ✅ | `GET /api/geocode` — Nominatim, returns lat/lng/timezone |
| Chart save to profile | ✅ | `POST /api/chart/save` |
| Chart retrieval | ✅ | `GET /api/chart/:id` |
| Chart history | ✅ | `GET /api/chart/history` |
| Transit forecast | ✅ | `GET /api/transits/forecast` — 1–90 day forward |
| Life cycles | ✅ | `GET /api/cycles` — Saturn return, Uranus opposition, Chiron return, etc. |

---

## 2. AI Synthesis (Profile)

| Feature | Status | Notes |
|---------|--------|-------|
| Full AI profile generation | ✅ | `POST /api/profile/generate` — Claude/Grok/Llama 3-provider failover |
| Streaming profile | ✅ | `POST /api/profile/generate/stream` — SSE streaming |
| Saved profile list | ✅ | `GET /api/profile/list` |
| Evaluation type quick picks | ✅ | 4 pill buttons (Full Blueprint / Daily Focus / Relationships / Career) |
| Practitioner context injection | ✅ | synthesis_style + client ai_context + shared notes injected into prompt |
| Deferral CTA | ✅ | Free users see "Work with a practitioner" after output |
| Library vocabulary in prompt | ✅ | Polarity/Trinity/Co-arising/Emergence from `vocabulary.json` |
| 7 Forges (archetypes) | ✅ | 6 scored Forges + "Self" Forge (always present) |
| 7th Knowledge synthesis | ✅ | nativeEpistemology + forgeOfSelf section in output |
| Synthesis opening/closing frames | ✅ | Opening as mirror; closing as 7th Knowledge reflection |
| Composite chart AI reading | ✅ | `POST /api/composite` — two charts synthesized; practitioner+ tier |
| AI-generated chart deep interpretations | 📐 | Gate-by-gate AI narrative. ~1 week effort. Not started |

---

## 3. Today's Transits & Daily Features

| Feature | Status | Notes |
|---------|--------|-------|
| Today's transits | ✅ | `GET /api/transits/today` — real-time planetary positions vs natal gates |
| Offline transit cache | ✅ | 7-day prefetch via `offline-transits.js` Service Worker |
| Daily check-in | ✅ | `POST /api/checkin` — mood, alignment, strategy, note |
| Check-in history | ✅ | `GET /api/checkin/history` |
| Check-in stats | ✅ | `GET /api/checkin/stats` — 7-day stats, gate frequencies |
| Check-in streak | ✅ | `GET /api/checkin/streak` |
| Check-in reminders | ✅ | `POST/GET /api/checkin/reminder` |
| Diary / life events | ✅ | Full CRUD with optional transit correlation |
| Transit alerts | ✅ | User-defined alert conditions; push notification delivery |
| Timing tool | ✅ | `POST /api/timing/find-dates` — 20+ intention templates |
| SMS transit digest | ⚠️ | Handler complete. `TELNYX_API_KEY` + `TELNYX_PHONE_NUMBER` not yet deployed as Workers secrets. See [WC-008](audits/issue-registry.json) → [BL-OPS-P2-7](MASTER_BACKLOG_SYSTEM_V2.md) |
| Push notifications (Web Push / VAPID) | ✅ | Full RFC 8030/8291 implementation. Quiet hours (timezone-aware). Subscribe/unsubscribe via `/api/push` |
| Push notifications (APNs/FCM native) | ⚠️ | Token registration works; delivery to iOS/Android is a TODO in `push.js`. See [WC-004](audits/issue-registry.json) → [BL-OPS-P1-4](MASTER_BACKLOG_SYSTEM_V2.md) |

---

## 4. Authentication & Accounts

| Feature | Status | Notes |
|---------|--------|-------|
| Email/password registration | ✅ | PBKDF2 hash (100k iterations SHA-256), JWT issued, HttpOnly refresh cookie |
| Email/password login | ✅ | `POST /api/auth/login` |
| Silent token refresh | ✅ | `POST /api/auth/refresh` — HttpOnly cookie exchange |
| Logout | ✅ | `POST /api/auth/logout` — clears refresh cookie |
| Get current user | ✅ | `GET /api/auth/me` |
| Forgot password | ✅ | Enumeration-safe (always 200); email delivery via Resend active |
| Reset password | ✅ | Token-wrapping transaction prevents reuse |
| Delete account | ✅ | Cascades user data; audit trail in `account_deletions` table |
| Data export (GDPR) | ✅ | `GET /api/auth/export` — full user data as JSON |
| Google OAuth | ⚠️ | Handler complete (`oauthSocial.js`). `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` not deployed as Workers secrets. See [WC-006](audits/issue-registry.json) → [BL-OPS-P2-5](MASTER_BACKLOG_SYSTEM_V2.md) |
| Apple Sign-In | ⚠️ | Handler complete. `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` not deployed as Workers secrets. See [WC-007](audits/issue-registry.json) → [BL-OPS-P2-6](MASTER_BACKLOG_SYSTEM_V2.md) |
| TOTP 2FA (backend) | ✅ | Setup, enable, disable, verify endpoints implemented |
| TOTP 2FA (frontend enrollment UI) | ❌ | No frontend screen to enroll or manage TOTP. Backend is ready. Deferred → [BL-OPS-P2-1](MASTER_BACKLOG_SYSTEM_V2.md) |
| Rate limiting (brute force protection) | ✅ | KV-backed 60 req/min on auth endpoints. Fails closed (503) |
| JWT/session security | ✅ | HttpOnly SameSite=Strict refresh cookie; short-lived access tokens |

---

## 5. Billing & Subscriptions

| Feature | Status | Notes |
|---------|--------|-------|
| Stripe checkout | ✅ | `POST /api/billing/checkout` — 4 subscription tiers |
| Annual billing | ✅ | `billingPeriod='annual'` routes to annual price IDs |
| One-time purchases | ✅ | Single Synthesis ($19), Composite Reading ($29), Transit Pass ($12), Lifetime ($299) |
| Billing portal | ✅ | `POST /api/billing/portal` — Stripe-hosted portal |
| Get subscription | ✅ | `GET /api/billing/subscription` |
| Cancel / upgrade subscription | ✅ | Both implemented and tested |
| Stripe webhooks | ✅ | checkout.session.completed, invoice.paid, subscription.deleted, payment_intent.payment_failed |
| Tier enforcement | ✅ | `resolveEffectiveTier()` gates all protected endpoints |
| Free tier quotas | ✅ | 3 profiles/month tracked in `user_usage` table |
| Lifetime access | ✅ | `lifetime_access` column elevates to 'individual' tier permanently |
| Transit pass | ✅ | `transit_pass_expires` column gates `transitSnapshots` access |
| Stripe Price IDs | ✅ | All 12 production Price IDs configured in `wrangler.toml` (verified 2026-03-21). Test env uses `price_test_*` placeholders by design |
| Promo codes | ✅ | Validate/apply with admin-created codes, discount/free-tier grants |
| Referral program | ✅ | 25% recurring revenue share as Stripe credit; frontend wired |
| Webhook replay protection | ✅ | `stripe_event_id` idempotency check (BL-BILLING-P2-1) |

---

## 6. Practitioner Features

| Feature | Status | Notes |
|---------|--------|-------|
| Client management | ✅ | Add/list/remove clients; client detail with AI context |
| Session notes | ✅ | Full CRUD; `share_with_ai` toggle injects into synthesis |
| AI context per client | ✅ | Free-text AI context stored per client |
| Practitioner directory | ✅ | Browsable with specialization/cert/format filters + pagination |
| Public practitioner profile | ✅ | `GET /api/directory/:slug` |
| Edit directory profile | ✅ | display_name, bio, specializations, booking_url, is_public |
| Practitioner invitations | ✅ | Email invite to client |
| Agency seats | ✅ | Invite/list/remove sub-accounts under Agency tier |
| Branded PDF export | ✅ | Practitioner-branded PDF with name/website in header |
| Compatibility composite (from client record) | ✅ | Launch composite chart prefilled from practitioner client panel |
| Live session (real-time co-view) | 📐 | Not started. Chart sync + real-time notes via Cloudflare Durable Objects. See [BL-PRACTITIONERS-P1-3](MASTER_BACKLOG_SYSTEM_V2.md) |

---

## 7. Achievements & Gamification

| Feature | Status | Notes |
|---------|--------|-------|
| Achievement badges | ✅ | 30+ unlockable across categories |
| Achievement progress | ✅ | Per-achievement `{current, target, percentage}` |
| Leaderboard | ✅ | Ranked by achievement points |
| Push notification on unlock | ✅ | Fire-and-forget on achievement unlock |
| Activity stats | ✅ | Streaks, profile count, last active |

---

## 8. Social & Sharing

| Feature | Status | Notes |
|---------|--------|-------|
| Celebrity chart comparison | ✅ | Match user chart to celebrity DB by type/authority/profile |
| Celebrity search / browse | ✅ | Search by name, browse by category |
| Share chart card | ✅ | Generates shareable link/card |
| Share achievement / celebrity match / referral | ✅ | All wired |
| Share-as-image (social card) | ✅ | Canvas-based 600×800 + 1080×1920 Blueprint card |
| Cluster (community groups) | ✅ | Full CRUD — create, join, leave, post, react |
| Referral code + tracking | ✅ | Generate code, track signups, welcome bonus |

---

## 9. Integrations

| Feature | Status | Notes |
|---------|--------|-------|
| Notion sync | ✅ | OAuth flow + sync clients + export profile |
| Discord bot | ✅ | `/primself` slash command — Quick Start Guide embed, rate-limited |
| WordPress plugin | ✅ | `[primself_chart]` shortcode, widget, admin settings |
| Embed widget | ✅ | `/api/embed/validate` + API key guard |
| API keys | ✅ | Create/revoke developer API keys for white-label embed |
| Background video delivery | ✅ | Cloudflare R2 + range-request serving, adaptive quality |
| Discord deep features | 📐 | Daily digests, practitioner commands — spec exists, not built |
| Zapier / Make integration | 📐 | Planned in `docs/API_MARKETPLACE.md` — not built |
| X/Twitter messaging | 📐 | Blocked by $100/mo X Basic API tier |

---

## 10. Psychometric / Enhance Tab

| Feature | Status | Notes |
|---------|--------|-------|
| Big Five personality assessment | ✅ | 44-question IPIP-style → O/C/E/A/N scores |
| VIA Character Strengths | ✅ | 24-strength survey; top 5 returned |
| Cross-validation with HD | ✅ | Results injected into profile synthesis context |
| Enhance tab UI | ✅ | Frontend tab with both assessments, result display, rescore |

---

## 11. Analytics & Experiments

| Feature | Status | Notes |
|---------|--------|-------|
| Event tracking | ✅ | `POST /api/analytics/track` |
| Plausible analytics | ✅ | `window.plausible()` fires on profile generate, chart calculate, tab switch |
| A/B experiments | ✅ | Create experiments, record variant assignments, statistical significance results |
| CF Metrics (production observability) | ⚠️ | `CF_API_TOKEN` + `CF_ACCOUNT_ID` not set — analytics blind spot. See [WC-005](audits/issue-registry.json) → [BL-OPS-P2-4](MASTER_BACKLOG_SYSTEM_V2.md) |

---

## 12. PWA / Mobile

| Feature | Status | Notes |
|---------|--------|-------|
| Progressive Web App | ✅ | Service worker, manifest, install prompt. iOS 16.4+ push support |
| Offline mode | ✅ | 7-day transit cache; static assets cached by service worker |
| Pull-to-refresh | ✅ | Touch gesture reloads active tab data |
| Mobile nav | ✅ | Bottom bar + sidebar drawer; 5-item primary nav |
| Background video | ✅ | Adaptive quality (720p/480p/240p) by network speed |
| Web push notifications | ✅ | VAPID RFC 8291 with quiet hours |
| Native iOS/Android push (APNs/FCM) | ⚠️ | Token registration done; delivery not yet implemented. See [WC-004](audits/issue-registry.json) |
| Native iOS/Android app (Capacitor) | 📐 | Not started. ~6–10 weeks. See [BL-MOBILE-P1-1](MASTER_BACKLOG_SYSTEM_V2.md) |
| i18n / localization | ✅ | `i18n.js` infrastructure + translations for EN/FR/ES/DE/PT (21 keys each) |

---

## 13. Security

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication (JWT + HttpOnly cookie) | ✅ | Short-lived access token + HttpOnly SameSite=Strict refresh cookie |
| CSRF protection | ✅ | SameSite cookie + Origin header validation |
| Content Security Policy | ✅ | Comprehensive CSP in `frontend/_headers` (Cloudflare Pages). script-src allows only Stripe/Plausible/CF Insights. frame-ancestors: none |
| Password hashing | ✅ | Web Crypto PBKDF2 (100,000 iterations SHA-256) |
| Rate limiting | ✅ | KV-backed 60 req/min; fails closed (503) |
| SQL injection prevention | ✅ | All queries parameterized via Neon `query(sql, params)` |
| XSS prevention | ✅ | `escapeHtml()` on all user content; CSP blocks inline scripts |
| Constant-time auth comparison | ✅ | Password and admin token comparisons use constant-time function |
| Race condition quota bypass prevention | ✅ | Atomic DB check prevents concurrent request bypass |
| Webhook signature verification | ✅ | Stripe (HMAC-SHA256), Telnyx (Ed25519), Discord (Ed25519) |
| Sentry error tracking | ✅ | `SENTRY_DSN` configured; error capture active |
| Admin token memory-only (no localStorage) | ✅ | Admin token is cleared on refresh/sign-out |

---

## 14. Onboarding

| Feature | Status | Notes |
|---------|--------|-------|
| First-run modal | ✅ | 3-step modal for new users |
| Forge onboarding | ✅ | `GET/POST /api/onboarding` — KV-backed progress through 6 Forge arcs |
| Step guide / progress indicator | ✅ | Sidebar progress |
| Guidance state machine | ✅ | Deterministic guidance by persona (new user / returning / practitioner) |
| Wizard flow (single-form) | 📐 | Unified birth data → eval type → question → result flow. Not started |

---

## 15. Frontend UI System

| Feature | Status | Notes |
|---------|--------|-------|
| Design token system | ⚠️ | Three competing `:root {}` systems (`design-tokens.css`, `design-tokens-premium.css`, inline `index.html`). Needs consolidation → [BL-FRONTEND-P1-9](MASTER_BACKLOG_SYSTEM_V2.md) |
| Premium dark gold theme | ✅ | `prime-self-premium.css` + `design-tokens-premium.css` |
| Light mode | ✅ | `html[data-theme="light"]` overrides |
| Bodygraph SVG | ✅ | `bodygraph.js` — defined/undefined centers, channels, gates |
| Explanations / tooltips | ✅ | `explanations.js` — gate/channel/center explanations. Canonical glossary in `frontend/js/explanations.js` |
| Lazy loading | ✅ | `lazy.js` + `window.onTabActivated` — defers non-active tab JS |
| Accessibility (WCAG contrast) | ⚠️ | 6 selectors fail 4.5:1 minimum contrast. 2-hour fix pending → [BL-FRONTEND-P2-8](MASTER_BACKLOG_SYSTEM_V2.md) |
| Accessibility (WCAG ARIA) | ⚠️ | Missing: tab roles, modal roles, form aria-labels, landmarks, skip link, arrow-key nav, touch targets ≥44px, SVG alt text → [BL-FRONTEND-P1-14](MASTER_BACKLOG_SYSTEM_V2.md) / [WC-002](audits/issue-registry.json) |
| app.js modularization | ⚠️ | 416KB single-file monolith. Split into tab controllers not yet started → [BL-FRONTEND-P1-8](MASTER_BACKLOG_SYSTEM_V2.md) |
| Share card generator | ✅ | `share-card.js` Canvas renderer |
| Guidance regression harness | ✅ | `tests/guidance-regression.test.js` — automated checks for guidance surface contracts |

---

## 16. Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| Cloudflare Workers (API) | ✅ | Deployed. 57 route handlers |
| Cloudflare Pages (frontend) | ✅ | Deployed. SPA with `_headers` CSP + cache rules |
| Neon PostgreSQL | ✅ | 54 tables, 39+ migration files. All applied to production |
| Cloudflare KV | ✅ | Rate limiting, transit cache, onboarding progress |
| Cloudflare R2 | ✅ | PDFs, corpus, background video |
| Cloudflare AI Gateway | ✅ | `prime-self` gateway configured; LLM calls routed through it |
| Health endpoint | ✅ | `GET /api/health?full=1` — checks DB, KV, R2, secrets presence |
| Cron jobs | ✅ | `cron.js` — scheduled transit digest, push notifications, leaderboard refresh |
| Sentry error logging | ✅ | Structured error capture with dashboard |
| CF Metrics / Analytics | ⚠️ | Not configured in `.env.local` or Workers secrets. Audit output shows "unavailable" → [WC-005](audits/issue-registry.json) |
| CI/CD pipelines | ✅ | 4 GitHub Actions workflows: deploy-workers, deploy-frontend, prod-canary, audit-cron |
| E2E release gate | ✅ | `tests/e2e/` + `playwright.gate.config.ts`; money-path canary + browser smoke |

---

## 17. Known Gaps (Not Yet Started)

| Gap | Severity | Backlog Ref |
|-----|----------|-------------|
| WCAG 2.1 AA full ARIA compliance | P1 | [BL-FRONTEND-P1-14](MASTER_BACKLOG_SYSTEM_V2.md) / [WC-002](audits/issue-registry.json) |
| WCAG AA contrast (6 element fix) | P1-adjacent | [BL-FRONTEND-P2-8](MASTER_BACKLOG_SYSTEM_V2.md) |
| APNs/FCM native push delivery | P1 | [BL-OPS-P1-4](MASTER_BACKLOG_SYSTEM_V2.md) / [WC-004](audits/issue-registry.json) |
| Split app.js (416KB monolith) | P1 | [BL-FRONTEND-P1-8](MASTER_BACKLOG_SYSTEM_V2.md) |
| Consolidate CSS token systems | P1 | [BL-FRONTEND-P1-9](MASTER_BACKLOG_SYSTEM_V2.md) |
| Machine-generated API docs | P1 | [BL-DOCS-P1-3](MASTER_BACKLOG_SYSTEM_V2.md) |
| CF Metrics env configuration | P2 | [BL-OPS-P2-4](MASTER_BACKLOG_SYSTEM_V2.md) / [WC-005](audits/issue-registry.json) |
| Google OAuth Workers secrets | P2 | [BL-OPS-P2-5](MASTER_BACKLOG_SYSTEM_V2.md) / [WC-006](audits/issue-registry.json) |
| Apple Sign-In Workers secrets | P2 | [BL-OPS-P2-6](MASTER_BACKLOG_SYSTEM_V2.md) / [WC-007](audits/issue-registry.json) |
| Telnyx SMS Workers secrets | P2 | [BL-OPS-P2-7](MASTER_BACKLOG_SYSTEM_V2.md) / [WC-008](audits/issue-registry.json) |
| TOTP 2FA frontend enrollment UI | P2 (deferred) | [BL-OPS-P2-1](MASTER_BACKLOG_SYSTEM_V2.md) |
| Real-time collaborative live sessions | P1 (large) | [BL-PRACTITIONERS-P1-3](MASTER_BACKLOG_SYSTEM_V2.md) |
| Native iOS/Android app (Capacitor) | P1 (large) | [BL-MOBILE-P1-1](MASTER_BACKLOG_SYSTEM_V2.md) |

---

*Maintained by: Agent. Cross-check against [MASTER_BACKLOG_SYSTEM_V2.md](MASTER_BACKLOG_SYSTEM_V2.md) and [audits/issue-registry.json](audits/issue-registry.json) after any significant change.*
