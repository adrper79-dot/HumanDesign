# Prime Self — Comprehensive Codebase Map

**Generated:** March 8, 2026  
**Project:** Prime Self — Human Design + Astrology personal development platform  
**Runtime:** Cloudflare Workers (Edge compute) + Neon PostgreSQL (Serverless)  
**Version:** API v0.2.0, Engine v0.1.0

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [workers/src/ — API & Backend](#workerssrc--api--backend)
3. [src/ — Calculation Engine & Knowledgebase](#src--calculation-engine--knowledgebase)
4. [tests/ — Test Suite](#tests--test-suite)
5. [integrations/ — Third-Party Integrations](#integrations--third-party-integrations)
6. [wordpress-plugin/ — WordPress Embeddable Widget](#wordpress-plugin--wordpress-embeddable-widget)
7. [scripts/ — Build & Deploy Tooling](#scripts--build--deploy-tooling)
8. [Configuration Files](#configuration-files)
9. [Database Schema](#database-schema)
10. [Environment Variables](#environment-variables)
11. [Architectural Patterns](#architectural-patterns)
12. [Issues & Observations](#issues--observations)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers Edge                       │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────────┐ │
│  │  Router   │→│ Middleware  │→│ Handlers  │→│   Libraries   │ │
│  │ index.js  │  │ auth/cors/ │  │ 53 route │  │ llm/stripe/  │ │
│  │ (3-tier   │  │ rate/tier/ │  │ handlers │  │ cache/email/ │ │
│  │  routing) │  │ cache/apiKey│  │          │  │ analytics/   │ │
│  └──────────┘  └────────────┘  └──────────┘  └──────────────┘ │
│         │              │             │              │            │
│         ▼              ▼             ▼              ▼            │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────────┐ │
│  │   Cron    │  │ DB Queries │  │  Engine   │  │  Prompts/RAG │ │
│  │  (daily)  │  │ (Neon PG)  │  │ Layers1-8│  │  (synthesis) │ │
│  └──────────┘  └────────────┘  └──────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────────────┘
         │                │              │
         ▼                ▼              ▼
   ┌──────────┐    ┌──────────┐   ┌──────────────┐
   │ KV Cache │    │ Neon DB  │   │ External APIs │
   │(Cloudflare)│  │(Postgres)│   │ Anthropic/    │
   │           │    │          │   │ Stripe/Telnyx │
   └──────────┘    └──────────┘   │ Resend/Notion │
                                   └──────────────┘
```

### Layered Calculation Engine (src/engine/)
```
Layer 1: julian.js      → JDN + Sun longitude (Meeus algorithms)
Layer 2: planets.js      → All planetary positions (JPL Keplerian + Meeus)
Layer 3: design.js       → Design (unconscious) -88° solar arc calculation
Layer 4: gates.js        → Rave Mandala longitude→gate/line mapping
Layer 5: chart.js        → Type, Authority, Profile, Definition, Cross
Layer 6: astro.js        → Western astrology (signs, houses, aspects)
Layer 7: transits.js     → Real-time transits overlay on natal chart
Layer 8: synthesis.js    → LLM prompt builder for Prime Self Profile
```

---

## workers/src/ — API & Backend

### `index.js` (540 lines) — **Worker Entry Point & Router**
- **Purpose:** HTTP request entry, routing, CORS, auth orchestration, cron scheduling
- **Exports:** `default { fetch, scheduled }` (Cloudflare Worker standard)
- **Routing Architecture (BL-R-M9):** Three-tier route resolution:
  1. **EXACT_ROUTES** — `Map<"METHOD /path", handler>` for O(1) lookups (~60 exact routes)
  2. **PREFIX_ROUTES** — Array of `[prefix, handler, stripPrefix]` for sub-routers (~14 prefixes)
  3. **PATTERN_ROUTES** — Array of `[regex, method, paramIndex, handler]` for dynamic segments (~6 patterns)
- **Auth:** Checks `requiresAuth(path)` against AUTH_ROUTES + AUTH_PREFIXES sets, exempts PUBLIC_ROUTES
- **Middleware pipeline:** CORS → Auth → Rate Limit → Handler → Rate Limit Headers → Cache Headers → Analytics
- **Cron:** `scheduled()` delegates to `runDailyTransitCron()` + `aggregateDaily()`
- **~120 API endpoints** across chart, profile, transits, auth, billing, achievements, webhooks, push, alerts, API keys, timing, celebrities, sharing, Notion, check-ins, analytics, experiments
- **Env vars used:** ENVIRONMENT, NEON_CONNECTION_STRING, JWT_SECRET, STRIPE_SECRET_KEY, TELNYX_API_KEY

### `cron.js` (475 lines) — **Scheduled Daily Task Runner**
- **Purpose:** Daily 6 AM UTC cron (Cloudflare Cron Triggers)
- **Steps:**
  0. Purge expired rate limit counters (`rate_limit_counters` table)
  1. Calculate today's transit positions (engine Layers 2+4)
  2. Save snapshot to `transit_snapshots` table
  3. SMS digest delivery to opted-in users (via Telnyx)
  4. Webhook retry processing (failed deliveries)
  4b. Refresh check-in streaks materialized view
  5. Push notifications for daily transit digest
  6. Evaluate all active user transit alerts
  7. Email drip campaigns (welcome series, re-engagement, upgrade nudges)
  8. Purge expired/revoked refresh tokens
  9. Downgrade expired cancel-at-period-end subscriptions
  10. *(reserved)*
  11. Monday-only (`getUTCDay() === 1`) practitioner weekly digest — queries `getPractitionerWeeklyDigestList`, loops active practitioners, fires `sendPractitionerWeeklyDigest` per practitioner; wrapped in `withTimeout(..., 60000)`
- **DB tables:** transit_snapshots, users, push_subscriptions, notification_preferences, transit_alerts, alert_deliveries, refresh_tokens, rate_limit_counters, practitioners, practitioner_clients, practitioner_session_notes, charts
- **Env vars:** NEON_CONNECTION_STRING, RESEND_API_KEY, FROM_EMAIL
- **Imports from:** engine (julian, planets, gates), handlers (sms, push, alerts), lib (webhookDispatcher, email)

### `engine-compat.js` (~85 lines) — **Workers Data Injection Layer**
- **Purpose:** Bridges filesystem-dependent engine code to Workers runtime
- **Mechanism:** Imports all JSON data files statically (esbuild inlines them at bundle time), injects into `globalThis.__PRIME_DATA`
- **Data injected:** crosses, HD knowledgebase (types, profiles, gates, channels, centers, authority, definition, crosses), Gene Keys, astrology (planets, signs, houses, aspects), numerology (lifePaths, personalYears, tarotCards), Prime Self (forges, knowledges, forge_mapping)
- **Critical:** Must be first import in index.js

### `utils/parseToUTC.js` (~75 lines) — **Timezone Conversion**
- **Purpose:** Converts local birth date+time+IANA timezone to UTC components
- **Uses:** Intl.DateTimeFormat for offset detection (zero external deps)
- **Exports:** `parseToUTC(birthDate, birthTime, timezone)`
- **Handles:** Day boundary crossings, month/year rollovers

### `data/celebrities.json` (433 lines)
- **Purpose:** Celebrity birth data for chart comparison feature
- **Contains:** ~20 celebrities with id, name, category, birthDate, birthTime, birthTimezone, lat, lng, location, bio, achievements, tags
- **Categories:** media, tech, music, politics, sports, science, arts, activism

---

### workers/src/handlers/ (53 files)

#### Core Chart & Profile
| File | Lines | Purpose | Key Exports | DB Tables |
|------|-------|---------|-------------|-----------|
| `calculate.js` | 172 | Chart calculation endpoint | `handleCalculate`, `handleGetChart` | charts (read) |
| `chart-save.js` | 129 | Save/list chart history | `handleSaveChart`, `handleChartHistory` | charts, users |
| `profile.js` | 303 | LLM profile generation | `handleProfile`, `handleGetProfile`, `handleListProfiles` | profiles, charts, validation_data, psychometric_data |
| `profile-stream.js` | 310 | SSE streaming profile generation (BL-OPT-004) | `handleProfileStream` | profiles, charts |
| `pdf.js` | 331 | PDF export of profiles | `handlePdfExport` | profiles, charts |
| `composite.js` | 401 | Relationship/composite chart | `handleComposite` | None (compute only) |
| `rectify.js` | 259 | Birth-time sensitivity analysis | `handleRectify` | None (compute only) |

#### Transits & Timing
| File | Lines | Purpose | Key Exports | DB Tables |
|------|-------|---------|-------------|-----------|
| `transits.js` | 75 | Current transit positions | `handleTransits` | None (uses KV cache) |
| `forecast.js` | 72 | Multi-day transit forecast | `handleForecast` | None (compute) |
| `cycles.js` | 108 | Life cycles (Saturn return, etc.) | `handleCycles` | charts |
| `timing.js` | 536 | Electional astrology (best dates) | `handleTiming`, `listIntentionTemplates` | charts, users |

#### Auth & User Management
| File | Lines | Purpose | Key Exports | DB Tables |
|------|-------|---------|-------------|-----------|
| `auth.js` | 470 | Register/login/refresh/logout | `handleAuth` | users, refresh_tokens |
| `geocode.js` | 125 | City→lat/lng+timezone | `handleGeocode` | None (external API + KV cache) |
| `onboarding.js` | 323 | Savannah story onboarding flow | `handleOnboarding` | users |
| `validation.js` | 130 | Behavioral validation data | `handleValidation` → `handleValidationSave`, `handleValidationGet` | validation_data |
| `psychometric.js` | 207 | Big Five + VIA assessments | `handlePsychometric` | psychometric_data |
| `diary.js` | 337 | Life event journal CRUD | `handleDiary` | diary_entries, transit_snapshots |
| `checkin.js` | 538 | Daily check-in system | `handleCheckinCreate`, `handleCheckinToday`, `handleCheckinHistory`, `handleCheckinStats`, `handleCheckinStreak`, `handleSetCheckinReminder`, `handleGetCheckinReminder` | daily_checkins, checkin_reminders, alignment_trends |

#### Billing & Commerce
| File | Lines | Purpose | Key Exports | DB Tables |
|------|-------|---------|-------------|-----------|
| `checkout.js` | 170 | Stripe checkout session creation | `handleCreateCheckout`, `handleCustomerPortal` | subscriptions, users |
| `billing.js` | 623 | Full billing lifecycle | `handleCheckout`, `handlePortal`, `handleGetSubscription`, `handleCancelSubscription`, `handleUpgradeSubscription` | subscriptions, users, invoices |
| `webhook.js` | 381 | Stripe webhook event processing | `handleStripeWebhook` | subscriptions, payment_events, users, invoices, referrals |
| `referrals.js` | 627 | Referral/affiliate system | `handleGenerateCode`, `handleGetStats`, `handleGetHistory`, `handleValidateCode`, `handleApplyCode`, `handleGetRewards`, `handleClaimReward` | referrals, users |

#### Social & Engagement
| File | Lines | Purpose | Key Exports | DB Tables |
|------|-------|---------|-------------|-----------|
| `achievements.js` | 467 | Gamification badges & milestones | `handleGetAchievements`, `handleGetProgress`, `handleGetLeaderboard`, `handleTrackEvent` | user_achievements, achievement_events, user_streaks, user_achievement_stats |
| `famous.js` | 385 | Celebrity chart comparison | `handleGetCelebrityMatches`, `handleGetCelebrityMatchById`, `handleGetCategories`, `handleGetCelebritiesByCategory`, `handleSearchCelebrities`, `handleGetAllCelebrities` | charts, users |
| `share.js` | 507 | Social sharing (chart, celebrity, achievement, referral) | `handleShareCelebrity`, `handleShareChart`, `handleShareAchievement`, `handleShareReferral`, `handleGetShareStats` | share_events |
| `stats.js` | 103 | Public activity stats & leaderboard | `handleGetActivityStats`, `handleGetLeaderboard` | analytics_events, profiles, charts, user_achievement_stats |

#### Practitioner & Cluster
| File | Lines | Purpose | Key Exports | DB Tables |
|------|-------|---------|-------------|-----------|
| `practitioner.js` | 836 | Practitioner registration, client management, analytics, stats, reminders | `handlePractitioner` (router), `handleGetReferralLink`, `handleAcceptInvitation`, `handleGetInvitationDetails` | practitioners, practitioner_clients, users, charts |
| `practitioner-directory.js` | 310 | Public directory, profile edit, view tracking, scheduling embed | `handleListDirectory`, `handleGetPublicProfile`, `handleGetDirectoryProfile`, `handleUpdateDirectoryProfile`, `handleGetDirectoryStats` | practitioners, users, analytics_events |
| `session-notes.js` | 277 | Per-client session notes + AI context | `handleListNotes`, `handleCreateNote`, `handleUpdateNote`, `handleDeleteNote`, `handleGetAIContext`, `handleUpdateAIContext` | practitioner_session_notes, practitioner_clients (ai_context column) |
| `client-portal.js` | 150 | Client-facing reverse view of practitioner relationship | `handleGetClientPractitioners`, `handleGetClientPortal`, `handleGetClientSharedNotes` | practitioner_clients, practitioners, practitioner_session_notes, charts, profiles |
| `cluster.js` | 514 | Group/cluster management + synthesis | `handleCluster` | clusters, cluster_members, charts, users |

#### Communication
| File | Lines | Purpose | Key Exports | DB Tables |
|------|-------|---------|-------------|-----------|
| `sms.js` | 508 | Telnyx SMS webhook + digest delivery | `handleSMS`, `generateDigestForUser`, `sendSMS` | users, sms_messages |
| `push.js` | 752 | Web Push notifications (VAPID) | `handlePush`, `sendNotificationToUser` | push_subscriptions, push_notifications, notification_preferences |
| `alerts.js` | 763 | Transit alert system | `handleAlerts`, `evaluateUserAlerts` | transit_alerts, alert_deliveries, alert_templates |

#### Developer Platform
| File | Lines | Purpose | Key Exports | DB Tables |
|------|-------|---------|-------------|-----------|
| `webhooks.js` | 362 | User-defined webhook management | `handleWebhooks` | webhooks, webhook_deliveries |
| `keys.js` | 388 | API key management | `handleApiKeys` | api_keys, api_usage |
| `notion.js` | 453 | Notion OAuth + sync | `handleNotionAuth`, `handleNotionCallback`, `handleNotionStatus`, `handleSyncClients`, `handleExportProfile`, `handleNotionDisconnect` | oauth_states, notion_connections, notion_syncs, notion_pages |

#### Analytics & Experimentation
| File | Lines | Purpose | Key Exports | DB Tables |
|------|-------|---------|-------------|-----------|
| `analytics.js` | 337 | Admin analytics dashboard | `handleAnalytics` | analytics_events, analytics_daily, funnel_events, subscriptions, users |
| `experiments.js` | 192 | A/B test management | `handleExperiments` | experiments, experiment_assignments, experiment_conversions |

---

### workers/src/lib/ (17 files)

| File | Purpose | Key Exports | External APIs |
|------|---------|-------------|---------------|
| `achievements.js` | Achievement definitions (gamification criteria) | `ACHIEVEMENTS` (object of ~20 badge definitions with criteria) | None |
| `analytics.js` | Non-blocking event tracking (BL-ANA-001) | `trackEvent`, `trackError`, `trackFunnel`, `aggregateDaily`, `EVENTS` | None (DB only) |
| `cache.js` | Unified KV caching (BL-OPT-003) | `kvCache` (getOrSet, get, put, del, invalidatePrefix), `keys`, `TTL`, `getCacheMetrics`, `recordCacheAccess` | Cloudflare KV |
| `celebrityMatch.js` | Chart similarity scoring algorithm | `calculateSimilarity(userChart, celebChart)` | None |
| `email.js` | Transactional email via Resend (BL-ENG-007) | `sendEmail`, `sendWelcomeEmail2/3/4`, `sendReengagementEmail`, `sendUpgradeNudgeEmail`, `sendPractitionerClientChartReady`, `sendPractitionerClientSessionReady`, `sendClientReminder`, `sendPractitionerWeeklyDigest` | Resend API |
| `errorMessages.js` | User-friendly error translation | `translateError(error)`, `errorResponse(err, status, env)` | None |
| `experiments.js` | A/B testing framework (BL-ANA-005) | `getVariant`, `trackConversion`, `getResults` | None (DB only) |
| `i18n.js` | Server-side internationalization (BL-OPT-006) | `detectLocale`, `t`, `formatDate`, `formatNumber`, `SUPPORTED_LOCALES` | Cloudflare KV |
| `jwt.js` | HS256 JWT sign/verify | `signJWT`, `verifyHS256` | None (Web Crypto API) |
| `llm.js` | Multi-provider LLM with failover | `callLLM(promptPayload, env)` — Anthropic (2-retry) → Grok 4 Fast (xAI) → Groq chain. All providers route through CF AI Gateway via `resolveEndpoint()` | Anthropic API, xAI API, Groq API (via AI Gateway) |
| `notion.js` | Notion API v1 client wrapper | `NotionClient` class (request, createDatabase, createPage, etc.) | Notion API |
| `queryPerf.js` | Query timing + slow query logging (BL-OPT-002) | `createMonitoredQueryFn(env)` | None |
| `sentry.js` | Lightweight Sentry error tracking (BL-ANA-004) | `initSentry(env)` → `{ captureException, addBreadcrumb }` | Sentry envelope API |
| `shareImage.js` | SVG-based social share image generation | `generateCelebrityMatchImage`, `generateChartShareImage`, etc. | None |
| `stripe.js` | Stripe SDK wrapper + tier config | `createStripeClient`, `verifyWebhook`, `getTierConfig`, `getTier`, `hasFeatureAccess`, `isQuotaExceeded` | Stripe API |
| `tokenCrypto.js` | AES-GCM token encryption at rest (BL-R-H3) | `importEncryptionKey`, `encryptToken`, `decryptToken`, `isEncryptedToken` | None (Web Crypto API) |
| `webhookDispatcher.js` | HMAC-signed webhook delivery + retry | `dispatchWebhookEvent`, `processWebhookRetries` | User webhook URLs |

---

### workers/src/middleware/ (6 files)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `apiKey.js` | X-API-Key header authentication for external API access | `authenticateApiKey(request, env)` — validates against api_keys table, tracks usage, enforces rate limits per tier (Free: 100/day, Basic: 1K, Pro: 10K, Enterprise: unlimited) |
| `auth.js` | JWT Bearer token verification | `authenticate(request, env)` — verifies HS256 token, checks iss/aud/exp, ensures type=access, attaches `request._user` |
| `cache.js` | HTTP Cache-Control headers (BL-OPT-001) | `applyCacheHeaders`, `cacheControl`, `applyCacheForPublicAPI`, `CACHE_PRESETS` (HTML, IMMUTABLE, STATIC, IMAGES, API_NO_STORE, API_SHORT, API_MEDIUM, SW) |
| `cors.js` | CORS with origin whitelisting + CSRF model (BL-R-H14) | `corsHeaders`, `getCorsHeaders`, `handleOptions` — Production origins: selfprime.net, prime-self-ui.pages.dev; Dev origins gated by ENVIRONMENT |
| `rateLimit.js` | KV-backed fixed-window rate limiter | `rateLimit(request, env)`, `addRateLimitHeaders` — per-route limits (auth: 10/min, chart: 60/min, profile: 5/min, geocode: 30/min) |
| `tierEnforcement.js` | Subscription tier feature gating | `enforceFeatureAccess(request, env, feature)` — checks subscription tier against feature matrix |

---

### workers/src/db/ — Database Layer

#### `queries.js` (2,411 lines) — **Query Repository**
- **Purpose:** All prepared SQL queries + connection management
- **Exports:** `createQueryFn(connectionString)`, `getClient(connectionString)`, `QUERIES` object
- **Connection:** Singleton `Pool` per connection string (Neon serverless driver), WebSocket-backed transactions
- **Query count:** ~145 named queries organized by domain
- **DB tables referenced:** users, charts, profiles, transit_snapshots, practitioners, practitioner_clients, practitioner_session_notes, practitioner_ai_context, practitioner_invitations, clusters, cluster_members, sms_messages, validation_data, psychometric_data, diary_entries, subscriptions, payment_events, usage_records, share_events, refresh_tokens, user_achievements, achievement_events, user_streaks, user_achievement_stats, webhooks, webhook_deliveries, push_subscriptions, push_notifications, notification_preferences, transit_alerts, alert_deliveries, alert_templates, api_keys, api_usage, oauth_states, notion_connections, notion_syncs, referrals, invoices, daily_checkins, checkin_reminders, analytics_events, analytics_daily, funnel_events, experiments, experiment_assignments, experiment_conversions
- **Notable new queries (practitioner sprint):** `getPractitionersForClient`, `updatePractitionerNotificationPrefs`, `getPractitionerStats`, `getPractitionerDirectoryViewStats`, `getPractitionerClientForReminder`, `getPractitionerWeeklyDigestList`

#### `migrate.js` (~125 lines) — **Migration Runner**
- **Purpose:** Runs base schema + numbered migrations, tracks in `schema_migrations`
- **Mechanism:** Base schema from `migrate.sql` (idempotent CREATE IF NOT EXISTS), then numbered `.sql` files in `migrations/` sorted by prefix
- **Checksum tracking:** SHA-256 of migration content to detect file modifications

#### `migrate.sql` (~300 lines) — **Base Schema**
- **Tables created (17):** users, charts, profiles, transit_snapshots, practitioners, practitioner_clients, clusters, cluster_members, sms_messages, validation_data, psychometric_data, diary_entries, subscriptions, payment_events, usage_records, share_events, refresh_tokens + schema_migrations
- **Key design:** UUID primary keys (gen_random_uuid()), JSONB for chart/profile data, IANA timezone storage, Stripe customer/subscription IDs

#### `migrations/` (45 migration files)
| Migration | Purpose |
|-----------|---------|
| `000_migration_tracking.sql` | Create schema_migrations table |
| `003_billing.sql` | Invoices, usage_tracking, promo_codes tables |
| `004_achievements.sql` | user_achievements, achievement_events, user_streaks, user_achievement_stats |
| `008_webhooks.sql` | webhooks, webhook_deliveries tables |
| `009_push_subscriptions.sql` | push_subscriptions, push_notifications, notification_preferences |
| `010_transit_alerts.sql` | transit_alerts, alert_deliveries, alert_templates |
| `011_api_keys.sql` | api_keys, api_usage tables |
| `012_notion.sql` | oauth_states, notion_connections, notion_syncs, notion_pages |
| `013_daily_checkins.sql` | daily_checkins, checkin_reminders, alignment_trends |
| `014_analytics.sql` | analytics_events, analytics_daily, funnel_events |
| `015_query_optimization.sql` | Index optimizations |
| `016_fix_checkin_streak_trigger.sql` | Fix for streak calculation |
| `017_standardize_uuid_gen.sql` | Standardize UUID generation |
| `018_drop_usage_tracking.sql` | Drop deprecated usage_tracking table |
| `019_cluster_member_birth_data.sql` | Birth data columns for cluster members |
| `020_fix_subscription_constraints.sql` | Subscription constraint fixes |
| `021_password_reset_tokens.sql` | Password reset token flow |
| `022_social_auth.sql` | Google/Apple OAuth tables |
| `023_discord_integration.sql` | Discord bot integration |
| `024_atomic_limit_counters.sql` | rate_limit_counters table (atomic window counters) |
| `024b_practitioner_invitations.sql` | Practitioner invitation flow |
| `025_session_notes.sql` | Session notes for practitioners |
| `026_practitioner_directory.sql` | Public practitioner directory |
| `027_one_time_purchase_columns.sql` | One-time purchase support |
| `028_grandfather_subscriptions.sql` | Grandfather existing subscriptions |
| `029_agency_seats.sql` | Agency seat management |
| `030_add_individual_agency_tiers.sql` | Individual + agency tier support |
| `031_email_marketing_optout.sql` | Email marketing opt-out |
| `032_normalize_tier_and_status.sql` | Canonical tier/status normalization |
| `033_composite_indexes.sql` | Composite index optimizations |
| `034_drop_dead_views.sql` | Remove unused views |
| `035_drop_dead_tables.sql` | Remove deprecated tables |
| `036_email_verification.sql` | Email verification flow |
| `037_cluster_invite_codes.sql` | Cluster invitation codes |
| `038_totp_2fa.sql` | TOTP two-factor authentication |
| `039_account_deletions_audit.sql` | Account deletion audit trail |
| `040_add_last_login_at.sql` | Add last_login_at to users |
| `041_experiments_status_enum.sql` | Experiments status enum |
| `042_add_stripe_indexes.sql` | Stripe lookup index optimizations |
| `043_hash_deletion_audit_ip.sql` | Hash IP addresses in account deletion audit |
| `044_gdpr_consent_fields.sql` | GDPR consent fields on users |
| `045_referral_signups.sql` | Referral signup attribution table |
| `050_bug_reporting.sql` | Bug reporting tables (bug_reports, bug_comments) |
| `051_practitioner_notification_prefs.sql` | `notification_preferences JSONB` column on `practitioners` (clientChartReady, clientSessionReady); default true for all tiers |
| `052_practitioner_scheduling_embed.sql` | `scheduling_embed_url TEXT` column on `practitioners`; hostname-whitelisted to cal.com/calendly.com |

---

## src/ — Calculation Engine & Knowledgebase

### src/engine/ (9 files) — **Pure JavaScript Astronomical Engine**

All files are pure JS with zero external dependencies — designed for both Node.js and Cloudflare Workers V8 isolate runtime.

| File | Lines | Layer | Purpose | Key Exports |
|------|-------|-------|---------|-------------|
| `julian.js` | ~100 | L1 | Julian Day Number + Sun longitude | `toJulianDay`, `getSunLongitude`, `normalizeDegrees`, `degToRad`, `radToDeg` — Meeus Ch. 7+25 |
| `planets.js` | ~400 | L2 | All planetary positions (12 bodies) | `getAllPositions(jdn)` — Sun (Meeus), Moon (Ch.47 ~50 terms), Mercury–Pluto (JPL Keplerian/Standish 1992), North/South Node |
| `design.js` | ~150 | L3 | Design (unconscious) calculation | `getDesignCalculation(jdn)` — Newton-Raphson root-finding for Sun at -88° solar arc, `jdnToCalendar` |
| `gates.js` | ~100 | L4 | Ecliptic longitude → Gate/Line | `longitudeToGate(lon)`, `mapAllToGates(positions)` — Rave Mandala with 3.875° wheel offset, 64 gates × 6 lines × 6 colors × 6 tones × 5 bases |
| `chart.js` | ~300 | L5 | Chart determination | `calculateChart(persGates, desGates)` — derives Type, Authority, Profile, Definition, Incarnation Cross from gate/channel analysis |
| `astro.js` | ~400 | L6 | Western astrology | `calculateAstrology(positions, lat, lng, jdn)` — Zodiac signs, Placidus houses, aspects (conjunction–quincunx), Ascendant, Midheaven |
| `transits.js` | ~350 | L7 | Real-time transit engine | `getCurrentTransits(natalChart, natalAstro, nowJDN?)`, `getTransitForecast(natal, astro, start, end, opts)` — transit gates, aspects, ingresses |
| `numerology.js` | ~200 | — | Pythagorean numerology | `lifePathNumber`, `birthdayNumber`, `personalYear/Month/Day`, `tarotBirthCard`, `calculateNumerologyFromBirthData` |
| `index.js` | ~100 | — | Engine orchestrator | `calculateFullChart({ year, month, day, hour, minute, second, lat, lng })` — runs all layers in sequence, includes input validation |

**Verification anchor:** AP — Aug 5, 1979, 22:51 UTC, Tampa FL. Type: Projector, Authority: Emotional, Profile: 6/2, Definition: Split, Cross: LAX [33,19,2,1].

### src/data/ (5 JSON files) — **Static Chart Data**

| File | Purpose |
|------|---------|
| `centers.json` | 9 energy center definitions (Head, Ajna, Throat, G, Ego, Sacral, Spleen, SolarPlexus, Root) with gates list |
| `channels.json` | 36 channel definitions (gate pairs + center connections) |
| `crosses.json` | 768 incarnation cross definitions (4-gate combinations + names) |
| `gate_wheel.json` | 64-gate sequence around the ecliptic wheel |
| `type_rules.json` | Type determination rules based on center definitions and motor connections |

### src/knowledgebase/ — **Content Corpus for RAG**

#### `generate.js` (447 lines) — KB Content Generator
- Uses Claude API to generate gate/channel/cross descriptions from I Ching + HD structural logic
- CLI: `ANTHROPIC_API_KEY=... node src/knowledgebase/generate.js [--gates|--channels|--crosses|--audit]`

#### Subfolders (8 categories, ~20 JSON files)

| Category | Files | Content |
|----------|-------|---------|
| `hd/` | types.json, profiles.json, gates.json, channels.json, centers.json, authority.json, definition.json, crosses.json | Human Design interpretive content for all 64 gates, 36 channels, 5 types, 12 profiles, 9 centers, 7 authorities, 4 definitions |
| `astro/` | planets.json, signs.json, houses.json, aspects.json | Astrological meanings for 12 planets, 12 signs, 12 houses, 6 aspect types |
| `genekeys/` | keys.json, generate-missing.js | Gene Keys interpretations for 64 keys (shadow → gift → siddhi) |
| `numerology/` | lifePaths.json, personalYears.json, tarotCards.json | Numerology life path meanings (1-9, 11, 22, 33), personal year themes, Tarot birth cards |
| `prime_self/` | forges_canonical.json, knowledges_canonical.json, sciences_canonical.json, arts_canonical.json, defenses_canonical.json, heresies_canonical.json, historical_figures.json, book_recommendations.json | Canonical Prime Self philosophy — Five Forges (Initiation, Mastery, Guidance, Perception, Transformation; aliases: Chronos, Eros, Aether, Lux, Phoenix), Six Knowledges (Sciences, Arts, Defenses, Heresies, Connections, Mysteries), plus historical figure & book recommendation libraries |
| `assessments/` | bigfive.json, via_strengths.json | Big Five personality assessment + VIA character strengths rubrics |
| `combined/` | verified_correlations.json | Cross-system verified correlations (HD×Astro×Numerology) |

### src/prompts/ (3 files) — **LLM Prompt Engineering**

| File | Lines | Purpose | Key Exports |
|------|-------|---------|-------------|
| `synthesis.js` | 760 | Prime Self Profile prompt builder (Layer 8) | `buildSynthesisPrompt(chartData, question?)`, `validateSynthesisResponse(response)`, `buildReprompt(previousOutput)` — Constructs system prompt (forbidden HD IP terms, approved Gene Keys alternatives, tone guidelines) + user message with chart data + RAG context |
| `rag.js` | 599 | RAG context retrieval | `buildRAGContext(chartData)` — Pulls relevant KB entries for specific chart, contextualizes gate interpretations by planet placement, house, line themes. Defines PLANET_CONTEXTS, LINE_THEMES, HOUSE_THEMES |
| `digest.js` | 180 | SMS/email digest prompts | `buildDigestPrompt(chartData, transitData, options)`, `buildWeeklyDigestPrompt(chartData, forecastData, options)` — Produces compact transit SMS (<320 chars) and weekly email digests |

---

## tests/ — Test Suite

### Framework: Vitest (vmForks pool, 30s timeout)

| File | Lines | Coverage |
|------|-------|----------|
| `engine.test.js` | ~500 | **Comprehensive engine test** — Layers 1-7+synthesis. AP test vector (Aug 5, 1979). Tests: JDN calculation, Sun longitude, all planetary positions, design calculation, gate/line mapping, chart determination (Type, Authority, Profile, Definition, Cross), astrology (signs, houses, aspects), transits, numerology, synthesis prompt building |
| `handlers.test.js` | ~300 | **Handler integration tests** — Tests compute-only handlers (calculate, composite, rectify) with mock Request/env, validates request parsing, error paths, missing fields |
| `numerology.test.js` | ~200 | **Numerology test suite** — Tests reduceToDigit, lifePathNumber (with master numbers 11/22/33), birthdayNumber, personalYear/Month/Day, tarotBirthCard. Test vectors: AP, Steve Jobs, master number cases |
| `canonical.test.js` | ~550 | **Canonical philosophy test suite** — 56 tests validating alignment with Sacred Texts. Tests: Five Forges (Initiation, Mastery, Guidance, Perception, Transformation), Six Knowledges (Sciences, Arts, Defenses, Heresies, Connections, Mysteries), Six Sciences, Six Arts, Six Defenses, Six Heresies, Historical Figures library, Book Recommendations library, Synthesis prompt integration, Cross-reference validation |
| `api-smoke.js` | ~200 | **Production smoke test** — Node.js script (not Vitest) that calls live API endpoints sequentially. Tests auth, chart, profile, transits, geocode endpoints against production URL |
| `security-fixes.test.js` | ~200 | **Security & rate limit tests** — QUERIES registry validation, rateLimit DB-backed counter, promo endpoint rate limiting |
| `error-paths.test.js` | ~300 | **Error path coverage** — 14 tests covering auth bypass, handler error paths, audit token bypass |
| `handler-validation.test.js` | ~200 | **Handler validation** — Auth and input validation for agency, checkin, achievements, notes handlers |
| `jwt.test.js` | ~200 | **JWT test suite** — HS256 sign/verify, token expiry, claims validation |
| `sentry.test.js` | ~100 | **Sentry integration** — Error capture pipeline tests |
| `tier-billing-runtime.test.js` | ~200 | **Tier & billing runtime** — Subscription entitlement, revenue reporting, API key validation |
| `billing-retention-runtime.test.js` | ~100 | **Billing retention** — Retention preview and downgrade flows |
| `daily-ceiling-runtime.test.js` | ~100 | **Daily ceiling** — DB-backed atomic daily limit counter |
| `one-time-billing-runtime.test.js` | ~100 | **One-time billing** — Checkout session reuse, one-time grant fulfillment |
| `observability-runtime.test.js` | ~200 | **Observability pipeline** — Unhandled error capture via analytics and Sentry |
| `webhook-claim-runtime.test.js` | ~300 | **Webhook lifecycle** — Claim/release, invoice processing, ghost subscription recovery |
| `discord/src/index.test.js` | ~200 | **Discord worker** — Command routing, rate limiting, geocode/chart API error handling |

---

## integrations/ — Third-Party Integrations

### integrations/zapier/ — **Zapier Integration**

| File | Purpose |
|------|---------|
| `index.js` | App definition — registers authentication, triggers, actions. Uses `zapier-platform-core` |
| `authentication.js` | Custom auth via JWT/API key, tests against `/api/auth/me` |
| `package.json` | zapier-platform-core 15.x, zapier-platform-cli 15.x |

#### Triggers (4)
| File | Trigger Key | Polling Endpoint |
|------|-------------|-----------------|
| `triggers/chartCreated.js` | `chartCreated` | `GET /api/chart/history` — fires when new chart is calculated |
| `triggers/transitAlert.js` | `transitAlert` | `GET /api/alerts/history` — fires on transit alert |
| `triggers/clientAdded.js` | `clientAdded` | `GET /api/practitioner/clients` — fires when practitioner adds client |
| `triggers/cycleApproaching.js` | `cycleApproaching` | `GET /api/cycles` — fires when major cycle approaches |

#### Actions (3)
| File | Action Key | API Endpoint |
|------|-----------|--------------|
| `actions/calculateChart.js` | `calculateChart` | `POST /api/chart/calculate` — calculates HD chart from birth data |
| `actions/generateProfile.js` | `generateProfile` | `POST /api/profile/generate` — creates LLM-synthesized profile |
| `actions/sendTransitDigest.js` | `sendTransitDigest` | `POST /api/sms/send-digest` — triggers transit digest delivery |

---

## wordpress-plugin/ — WordPress Embeddable Widget

**Plugin Name:** Prime Self - Human Design Chart Calculator  
**Version:** 1.0.0 | **Requires:** WordPress 5.0+, PHP 7.4+

| File | Purpose |
|------|---------|
| `primeself-chart.php` | Main plugin file — singleton class, hooks registration, shortcode `[primeself_chart]` |
| `readme.txt` | WordPress.org plugin readme |
| `includes/class-admin.php` | Admin panel — API key validation, cache clearing, admin notices |
| `includes/class-api.php` | API client — `PrimeSelf_API_Client` class wrapping `wp_remote_request()` to Prime Self API |
| `includes/class-widget.php` | WP_Widget subclass for sidebar/footer chart calculator widget |
| `admin/settings.php` | Settings page (API key, display options) |
| `admin/stats.php` | Statistics dashboard page |
| `admin/docs.php` | Documentation page with shortcode reference |
| `assets/css/admin.css` | Admin panel styles |
| `assets/css/widget.css` | Frontend widget styles |
| `assets/js/admin.js` | Admin panel JavaScript |
| `assets/js/widget.js` | Frontend chart calculator JavaScript |

**Architecture:** Uses X-API-Key authentication (not JWT) against the API. Caches charts in a `wp_primeself_charts` table with expiry.

---

## scripts/ — Build & Deploy Tooling

| File | Purpose |
|------|---------|
| `deploy.sh` | Bash deploy: git add/commit/push, `wrangler deploy`, `verify-production.js` |
| `deploy.ps1` | PowerShell equivalent of deploy.sh |
| `generate-assets.cjs` | Extract logo frame from video, generate all PWA icons (sharp + ffmpeg-static) |
| `generate-assets-v2.cjs` | Same as above for v2 video source |
| `finish-assets.cjs` | Complete remaining asset generation (WebM VP8 encoding) |
| `kill-wsl.bat` | Kill zombie WSL processes, restart LxssManager service |
| `repair-wsl.ps1` | WSL diagnostic and repair script (check LxssManager, distro health) |

### workers/ root utility scripts

| File | Purpose |
|------|---------|
| `check-secrets.js` | Verify Worker secrets presence via `/api/health?full=1` |
| `run-migration.js` | Standalone migration runner (Node.js, uses pg directly) with `--status` and `--file` flags |
| `verify-production.js` | Smoke test production endpoints (health, geocode, auth) |
| `verify-setup.js` | Verify Stripe integration tables exist in DB |

---

## Configuration Files

### `package.json` (root)
- **Name:** prime-self-engine v0.1.0
- **Type:** ES modules
- **Scripts:** test (vitest), deploy:workers (wrangler deploy), verify:prod, deploy (combined)
- **Dev deps:** @cloudflare/mcp-server-cloudflare, ffmpeg-static, sharp, vitest 3.2.1
- **Node:** >=20.0.0

### `workers/package.json`
- **Name:** prime-self-api v0.2.0
- **Scripts:** dev (wrangler dev), deploy (wrangler deploy), migrate, tail
- **Runtime deps:** @neondatabase/serverless 1.x, nanoid 5.x, stripe 17.x
- **Dev deps:** pg 8.x, wrangler 3.x

### `wrangler.toml`
- **Worker name:** prime-self-api
- **Entry:** src/index.js
- **Compat date:** 2024-12-01
- **Flags:** nodejs_compat
- **KV namespace:** CACHE (binding for rate limiting + chart cache)
- **R2 bucket:** R2 → prime-self-exports (PDF exports + KB corpus)
- **Cron:** `0 6 * * *` (daily 6 AM UTC)
- **Vars:** ENVIRONMENT=production, STRIPE_PRICE_INDIVIDUAL/PRACTITIONER/AGENCY (legacy aliases still supported in code where needed)
- **Secrets:** NEON_CONNECTION_STRING, ANTHROPIC_API_KEY, TELNYX_API_KEY, TELNYX_PHONE_NUMBER, JWT_SECRET, AI_GATEWAY_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

### `vitest.config.js`
- Pool: vmForks
- Timeouts: 30s (test + hook)

---

## Database Schema

### Total Tables: ~47

**Base schema (17):** users, charts, profiles, transit_snapshots, practitioners, practitioner_clients, clusters, cluster_members, sms_messages, validation_data, psychometric_data, diary_entries, subscriptions, payment_events, usage_records, share_events, refresh_tokens

**Migration-added (30):** invoices, promo_codes, referrals, user_achievements, achievement_events, user_streaks, user_achievement_stats, webhooks, webhook_deliveries, push_subscriptions, push_notifications, notification_preferences, transit_alerts, alert_deliveries, alert_templates, api_keys, api_usage, oauth_states, notion_connections, notion_syncs, notion_pages, daily_checkins, checkin_reminders, alignment_trends, analytics_events, analytics_daily, funnel_events, experiments, experiment_assignments, experiment_conversions

### Key Design Patterns
- **UUIDs everywhere:** `gen_random_uuid()` (Postgres 13+ built-in)
- **JSONB for complex data:** hd_json, astro_json, profile_json, transit_snapshot, config, properties
- **Stripe integration:** stripe_customer_id, stripe_subscription_id on subscriptions
- **4-tier subscription model:** free, individual, practitioner, agency — each with daily ceilings via RATE_LIMIT_KV and legacy alias compatibility where required
- **Cascade deletes:** Most child tables ON DELETE CASCADE from users
- **Indexes:** Composite indexes on (user_id, date DESC) patterns, GIN indexes on JSONB where needed

---

## Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `NEON_CONNECTION_STRING` | queries.js, migrate.js, all handlers | Neon PostgreSQL connection string |
| `JWT_SECRET` | jwt.js, auth middleware | HS256 signing key for access/refresh tokens |
| `ANTHROPIC_API_KEY` | llm.js | Claude API key for profile synthesis |
| `AI_GATEWAY_URL` | llm.js | Cloudflare AI Gateway URL (optional proxy) |
| `STRIPE_SECRET_KEY` | stripe.js, billing handlers | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | webhook.js | Stripe webhook signature verification |
| `STRIPE_PRICE_REGULAR/PRACTITIONER/WHITE_LABEL` | wrangler.toml vars, stripe.js | Stripe Price IDs per tier |
| `TELNYX_API_KEY` | sms.js | Telnyx SMS API key |
| `TELNYX_PHONE_NUMBER` | sms.js | Outbound SMS sender number |
| `RESEND_API_KEY` | email.js | Resend transactional email API key |
| `FROM_EMAIL` | email.js | Sender email address |
| `SENTRY_DSN` | sentry.js | Sentry error tracking DSN |
| `SENTRY_RELEASE` | sentry.js | Release tag for Sentry |
| `VAPID_PUBLIC_KEY` | push.js | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | push.js | Web Push VAPID private key |
| `NOTION_CLIENT_ID` | notion.js handler | Notion OAuth app client ID |
| `NOTION_CLIENT_SECRET` | notion.js handler | Notion OAuth app secret |
| `NOTION_REDIRECT_URI` | notion.js handler | Notion OAuth callback URL |
| `NOTION_TOKEN_ENCRYPTION_KEY` | tokenCrypto.js | AES-256-GCM key (base64 32-byte) for encrypting Notion tokens at rest |
| `GROK_API_KEY` | llm.js | xAI Grok API key (failover) |
| `GROQ_API_KEY` | llm.js | Groq API key (failover) |
| `ENVIRONMENT` | cors.js, wrangler.toml | "production" gates dev origins in CORS |

---

## Architectural Patterns

### 1. **Edge-First Architecture**
Everything runs on Cloudflare Workers (V8 isolates). No origin server. The entire API is edge-deployed with <50ms cold start. Database (Neon) is serverless PostgreSQL accessed via HTTP WebSocket driver.

### 2. **Table-Driven Routing (BL-R-M9)**
Three-tier routing system replaces a monolithic if/else chain: exact map lookup (O(1)) → prefix delegation → regex pattern matching. Clean separation between routing and business logic.

### 3. **Engine Data Injection Pattern**
The calculation engine (src/engine/) uses filesystem reads in Node.js but Cloudflare Workers lack filesystem access. `engine-compat.js` imports all JSON data at build time (esbuild inlines them) and injects into `globalThis.__PRIME_DATA`. The engine modules check this global first, falling back to `readFileSync` for Node.js test runs.

### 4. **Layered Calculation Pipeline**
Eight deterministic calculation layers (L1-L8) process birth data through astronomical computation, gate mapping, chart determination, astrology, transits, and finally LLM synthesis. Each layer has a single responsibility and can be tested independently.

### 5. **RAG-Grounded LLM Synthesis**
Profile generation uses Retrieval-Augmented Generation: the RAG module pulls personalized knowledgebase entries for the specific chart data, injects them as grounding material into the synthesis prompt. Includes IP protection (forbidden Human Design terms → Gene Keys alternatives).

### 6. **Multi-Provider LLM Failover**
LLM calls chain through Anthropic (2-retry with exponential backoff) → Grok 4 Fast (xAI) → Groq with automatic model mapping via MODEL_MAP. Opus-tier uses `grok-4-fast`, Sonnet-tier uses `grok-3-mini-latest`. Each provider failure transparently falls through to the next.

### 7. **Fire-and-Forget Analytics**
All analytics tracking uses `ctx.waitUntil()` (Cloudflare) for non-blocking capture. Failures never impact user requests. Separate aggregation in the daily cron job.

### 8. **Singleton Pool Caching**
Database connections use a module-level `Map<connectionString, Pool>` for connection reuse across requests within the same V8 isolate.

### 9. **Cache-Aside with KV + In-Memory LRU**
Two-tier caching: per-isolate in-memory LRU for ultra-hot data, Cloudflare KV for distributed cache. `kvCache.getOrSet()` handles the full cache-aside pattern with configurable TTLs.

### 10. **Comprehensive Middleware Stack**
Six middleware layers: CORS (origin whitelisting), Auth (JWT/API key), Rate Limiting (KV fixed-window), Tier Enforcement (feature gating by subscription), Cache Control (HTTP headers), and API Key auth (for external integrations).

### 11. **Subscription Tier Model**
Four canonical tiers (free → individual → practitioner → agency) with Stripe integration, feature gating, daily ceilings (RATE_LIMIT_KV), usage quotas, and webhook-based lifecycle management. Legacy aliases still exist in compatibility paths and historical migrations.

### 12. **Event-Driven Engagement**
Achievement system with ~20 badges, streak tracking, leaderboards. Daily cron sends transit digests (SMS/push/email), evaluates custom transit alerts, runs email drip campaigns.

---

## Issues & Observations

### Potential Issues
1. **Duplicated Stripe handling:** Both `checkout.js` and `billing.js` handlers exist with overlapping checkout/portal functionality. Comment in index.js notes `handleWebhook removed` from billing.js, but there's still duplication between the two billing-related handlers.

2. **ASPECT_TYPES duplication:** `transits.js` explicitly notes a TODO that `ASPECT_TYPES` is duplicated from `astro.js` with potentially different orb values. Should be refactored to a shared module.

3. **Cron queries reference non-existent columns:** `cronGetWelcome2Users` and `cronGetWelcome3Users` have `BL-FIX` comments noting workarounds for `email_verified`, `last_login_at`, `tier` columns on the users table that aren't in the base schema (migrate.sql). These may have been added in a migration or may cause runtime errors.

4. **Celebrity birth times:** Some celebrity times appear estimated (e.g., "12:00" for Marie Curie — a common fallback when exact time is unknown). This affects chart accuracy for comparison scoring.

5. **WordPress plugin API URL mismatch:** `class-api.php` uses `https://api.primeself.app` while the actual worker URL is `https://prime-self-api.adrper79.workers.dev`. This needs a custom domain or configuration update.

6. **Zapier integration hardcoded URL:** `authentication.js` uses `https://primeself.app/api/auth/me` — may not match the actual API domain.

7. **No automated migration for new columns:** The base schema and migrations create core tables, but columns referenced in handler code (like `referral_code`, `tier`, `email_verified`, `last_login_at`, `stripe_customer_id` on users) may require additional migrations not yet present.

8. **LLM failover model mapping:** `llm.js` maps Anthropic models to Grok 4 Fast / Groq equivalents via MODEL_MAP. Grok 4 Fast is closer in quality to Claude Opus than the previous Grok 3. The Groq Llama fallback still represents a quality drop. Anthropic gets 2 retries before failover.

9. **Missing test coverage:** No tests for billing/payment flows, webhook handlers, push notifications, alerts, diary, check-in system, achievements, or any DB-dependent handlers.

10. **Rate limit bypass risk:** Rate limiting uses `CF-Connecting-IP` for unauthenticated users, which can be spoofed behind certain proxy configurations.

### Dead Code / TODOs
- `webhooks.js` and `webhook.js` are separate files (user-defined webhooks vs. Stripe webhook) — naming could be clearer
- `usage_tracking` table was created then dropped in migration 018 — dead migration chain
- `promo_codes` table is created in migration 003 but no handler uses it
- The `R2` bucket binding (prime-self-exports) is configured in wrangler.toml but only referenced in the PDF handler

### Code Quality Highlights
- Consistent error handling patterns across handlers
- Strong separation of concerns (engine vs. API vs. data)
- Good use of Cloudflare primitives (KV, R2, Cron Triggers, ctx.waitUntil)
- Comprehensive inline documentation (BL-* ticket references throughout)
- IP-conscious language mapping (HD terms → Gene Keys alternatives)
- Security-conscious design (token encryption at rest, CSRF via Bearer tokens, HMAC webhook signatures)
