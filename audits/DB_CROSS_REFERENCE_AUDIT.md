# Database ↔ Codebase Cross-Reference Audit

**Generated:** 2026-03-09  
**Live Neon DB:** 48 tables  
**Schema sources:** `migrate.sql` (17 base tables) + 14 migration files (30+ migration-only tables)  
**Code sources:** `queries.js` (1578 lines), 36 handlers, 5 lib files, 3 middleware files, `cron.js`

---

## 1. ORPHANED TABLES — In Live DB But NOT Referenced in Application Code

These tables exist in the live Neon database and are created by migrations, but **no handler, lib, middleware, or cron code queries them**.

| # | Table | Created By | Issue | Severity |
|---|-------|-----------|-------|----------|
| 1 | `promo_codes` | 003_billing.sql | Table created but **zero queries** in `queries.js`, zero references in any handler or lib file. No promo code API exists. | **HIGH** — Dead table, wasting schema space |
| 2 | `notion_pages` | 012_notion.sql | Table created but **zero INSERT/SELECT** in any `.js` file. The `notion.js` handler exports profiles to Notion but never writes to `notion_pages`. The page ID tracking feature was designed but never implemented. | **HIGH** — Dead table |
| 3 | `alignment_trends` | 013_daily_checkins.sql | Table created with `calculate_alignment_trends()` DB function, but **zero queries** in `queries.js` or any handler. The checkin handler returns stats by querying `daily_checkins` directly — the pre-aggregation table is never populated or read by the app. | **MEDIUM** — Dead table (DB function exists but is never called from app code) |

### Summary
- **3 orphaned tables** with zero code references: `promo_codes`, `notion_pages`, `alignment_trends`
- All 3 have schema/indexes consuming DB storage with no application value

---

## 2. PHANTOM TABLES — Referenced in Code But NOT in Live DB

| # | Table | Referenced Where | Issue |
|---|-------|-----------------|-------|
| — | *(none found)* | — | All table names referenced in application SQL map to the 48 live tables. |

**No phantom tables detected.** Every table referenced in queries, handlers, and lib files exists in the live DB.

> **Note:** `usage_tracking` was created by `003_billing.sql` and dropped by `018_drop_usage_tracking.sql`. It is NOT in the live DB and NOT referenced in code. Clean removal.

---

## 3. MISSING COLUMN DEFINITIONS — Columns Used in Code But NOT in Base Schema

These columns on the `users` table are referenced in `queries.js` but are **NOT defined in `migrate.sql`** (base schema). They must be added by migrations — verified status below.

| # | Column | Referenced In | Migration That Adds It | Status |
|---|--------|--------------|----------------------|--------|
| 1 | `users.stripe_customer_id` | `queries.js`: getUserStripeCustomerId, updateUserStripeCustomerId, updateUserTierAndStripe; `webhook.js` | `003_billing.sql` — `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT` | **OK** — added by migration |
| 2 | `users.referral_code` | `queries.js`: getUserByReferralCode, setUserReferralCode, validateReferralCode | `003_billing.sql` — `ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE` | **OK** — added by migration |
| 3 | `users.tier` | `queries.js`: cronGetUpgradeNudgeUsers, getAnalyticsTierDistribution; `tierEnforcement.js`; `webhook.js` | `015_query_optimization.sql` — `ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'` | **OK** — added by migration |
| 4 | `users.email_verified` | `queries.js`: cronGetWelcome2/3/4Users, cronGetReengagementUsers, cronGetUpgradeNudgeUsers (5 queries) | **NO MIGRATION FOUND** | **CRITICAL** — Column referenced in 5 cron queries but never created by any migration. Queries will fail unless column was added manually to live DB. |
| 5 | `users.last_login_at` | `queries.js`: cronGetReengagementUsers | **NO MIGRATION FOUND** | **CRITICAL** — Column referenced in re-engagement query but never created by any migration. Query will fail at runtime. |

### Action Required
- `users.email_verified` — Needs a migration: `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT NULL;`
- `users.last_login_at` — Needs a migration: `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;`
- Without these columns, all email drip campaign cron queries (welcome 2/3/4, re-engagement, upgrade nudge) will throw `column does not exist` errors.

---

## 4. SUSPICIOUS/WRONG SQL QUERIES

| # | Query Name | File | Issue | Severity |
|---|-----------|------|-------|----------|
| 1 | `cronGetWelcome2Users` | queries.js:1527 | References `u.email_verified` — column doesn't exist in any migration | **CRITICAL** — Runtime error |
| 2 | `cronGetWelcome3Users` | queries.js:1541 | References `u.email_verified` — column doesn't exist | **CRITICAL** — Runtime error |
| 3 | `cronGetWelcome4Users` | queries.js:1553 | References `u.email_verified` — column doesn't exist | **CRITICAL** — Runtime error |
| 4 | `cronGetReengagementUsers` | queries.js:1559 | References `u.last_login_at` and `u.email_verified` — neither column exists | **CRITICAL** — Runtime error |
| 5 | `cronGetUpgradeNudgeUsers` | queries.js:1570 | References `u.tier` (OK, from 015) and `u.email_verified` (missing) | **CRITICAL** — Runtime error |
| 6 | `getCheckinStreak` | queries.js | Calls `get_user_streak($1)` — a DB function created by `016_fix_checkin_streak_trigger.sql`. Will fail if migration 016 hasn't been applied. | **LOW** — OK if migrations are current |
| 7 | `webhookDispatcher.js` inline SQL | webhookDispatcher.js:43 | Uses `$2 = ANY(events)` — valid PostgreSQL syntax for `TEXT[]`, but parameter binding may fail with some drivers if `$2` is not explicitly cast to TEXT. Monitor for type mismatch errors. | **LOW** — Works with neon serverless driver |
| 8 | `experiments.js` inline SQL | lib/experiments.js:56 | `WHERE status = 'active'` — the `experiments` migration creates status as `TEXT DEFAULT 'draft'` but the code checks for `'active'`. The valid statuses per experiments handler include `'running'` not `'active'`. Possible status value mismatch. | **MEDIUM** — Experiment queries may return 0 rows if status is set to 'running' instead of 'active'. Verify status enum consistency. |

---

## 5. COMPLETE PER-HANDLER ENDPOINT ↔ TABLE MAP

| Handler | Endpoints | Tables Read | Tables Written |
|---------|-----------|-------------|----------------|
| **auth.js** | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` | `users`, `refresh_tokens` | `users`, `refresh_tokens` |
| **calculate.js** | `POST /api/chart/calculate`, `GET /api/chart/:id` | `users`, `charts`, `usage_records` | `users`, `charts`, `usage_records` |
| **chart-save.js** | `POST /api/chart/save`, `GET /api/chart/history` | `charts` | `users`, `charts` |
| **profile.js** | `POST /api/profile/generate` | `users`, `charts`, `profiles`, `validation_data`, `psychometric_data`, `diary_entries` | `users`, `charts`, `profiles` |
| **profile-stream.js** | `POST /api/profile/generate/stream` | `users`, `charts`, `validation_data`, `psychometric_data`, `diary_entries` | `users`, `charts`, `profiles`, `analytics_events`, `funnel_events`, `usage_records` |
| **checkin.js** | `POST /api/checkin`, `GET /api/checkin`, `GET /api/checkin/history`, `GET /api/checkin/stats`, `GET /api/checkin/streak`, `POST /api/checkin/reminder`, `GET /api/checkin/reminder` | `daily_checkins`, `checkin_reminders` | `daily_checkins`, `checkin_reminders` |
| **diary.js** | `POST /api/diary`, `GET /api/diary`, `GET/PUT/DELETE /api/diary/:id` | `diary_entries`, `charts` | `diary_entries` |
| **transits.js** | `GET /api/transits/today` | *(none — KV cache + calculation)* | *(none)* |
| **composite.js** | `POST /api/composite` | *(none — pure calculation)* | *(none)* |
| **forecast.js** | `GET /api/transits/forecast` | *(none — pure calculation)* | *(none)* |
| **cycles.js** | `GET /api/cycles` | *(none — pure calculation)* | *(none)* |
| **timing.js** | `POST /api/timing/find-dates` | `charts`, `users` | *(none)* |
| **rectify.js** | `POST /api/rectify` | *(none — pure calculation)* | *(none)* |
| **geocode.js** | `GET /api/geocode` | *(none — external API + KV)* | *(none)* |
| **famous.js** | `GET /api/compare/celebrities`, `GET /api/compare/celebrities/:id`, `GET /api/compare/celebrities/category/:cat`, `GET /api/compare/celebrities/search` | `charts`, `users` | *(none)* |
| **share.js** | `POST /api/share/celebrity`, `POST /api/share/chart`, `POST /api/share/achievement`, `POST /api/share/referral`, `GET /api/share/stats` | `share_events`, `users`, `charts` | `share_events` |
| **stats.js** | `GET /api/stats/activity`, `GET /api/stats/leaderboard` | `analytics_events`, `profiles`, `charts`, `user_achievement_stats`, `users` | *(none)* |
| **billing.js** | `POST /api/billing/checkout`, `POST /api/billing/portal`, `POST /api/billing/cancel`, `POST /api/billing/upgrade`, `GET /api/billing/subscription` | `users`, `subscriptions`, `payment_events` | `subscriptions`, `payment_events`, `users` |
| **checkout.js** | `POST /api/checkout/create`, `POST /api/checkout/portal` | `subscriptions`, `users` | *(none — Stripe redirect)* |
| **webhook.js** (Stripe) | `POST /api/webhook/stripe` | `payment_events`, `subscriptions`, `users` | `payment_events`, `subscriptions`, `users`, `invoices` |
| **referrals.js** | `POST /api/referrals/code`, `POST /api/referrals/validate`, `POST /api/referrals/apply`, `POST /api/referrals/claim`, `GET /api/referrals`, `GET /api/referrals/history`, `GET /api/referrals/rewards` | `users`, `referrals` | `users`, `referrals` |
| **practitioner.js** | `POST /api/practitioner/register`, `GET /api/practitioner/profile`, `GET /api/practitioner/clients`, `POST /api/practitioner/clients/add`, `DELETE /api/practitioner/clients/:id` | `practitioners`, `practitioner_clients`, `users`, `charts` | `practitioners`, `practitioner_clients` |
| **cluster.js** | `POST /api/cluster/create`, `POST /api/cluster/:id/join`, `POST /api/cluster/:id/leave`, `POST /api/cluster/:id/synthesize`, `GET /api/cluster/list`, `GET /api/cluster/:id` | `clusters`, `cluster_members`, `users`, `charts` | `clusters`, `cluster_members` |
| **sms.js** | `POST /api/sms/webhook`, `POST /api/sms/send-digest`, `POST /api/sms/subscribe`, `POST /api/sms/unsubscribe` | `users`, `sms_messages` | `users`, `sms_messages` |
| **validation.js** | `POST /api/validation/save`, `GET /api/validation` | `validation_data` | `validation_data` |
| **psychometric.js** | `POST /api/psychometric/save`, `GET /api/psychometric` | `psychometric_data` | `psychometric_data` |
| **achievements.js** | `GET /api/achievements`, `GET /api/achievements/progress`, `GET /api/achievements/leaderboard`, `POST /api/achievements/track` | `user_achievements`, `achievement_events`, `user_streaks`, `user_achievement_stats`, `users` | `achievement_events`, `user_achievements`, `user_streaks`, `user_achievement_stats` |
| **alerts.js** | `GET/POST /api/alerts`, `GET/PUT/DELETE /api/alerts/:id`, `GET /api/alerts/templates`, `POST /api/alerts/from-template/:id`, `GET /api/alerts/history` | `transit_alerts`, `alert_deliveries`, `alert_templates` | `transit_alerts`, `alert_deliveries` |
| **push.js** | `POST /api/push/subscribe`, `POST /api/push/test`, `DELETE /api/push/unsubscribe`, `GET /api/push/vapid-key`, `GET /api/push/preferences`, `PUT /api/push/preferences`, `GET /api/push/history` | `push_subscriptions`, `notification_preferences`, `push_notifications` | `push_subscriptions`, `notification_preferences`, `push_notifications` |
| **keys.js** | `POST /api/keys`, `GET /api/keys`, `DELETE /api/keys/:id`, `GET /api/keys/:id/usage` | `api_keys`, `api_usage` | `api_keys` |
| **webhooks.js** | `POST /api/webhooks`, `GET /api/webhooks`, `DELETE /api/webhooks/:id`, `POST /api/webhooks/:id/test`, `GET /api/webhooks/:id/deliveries` | `webhooks`, `webhook_deliveries` | `webhooks` |
| **notion.js** | `GET /api/notion/auth`, `GET /api/notion/callback`, `GET /api/notion/status`, `POST /api/notion/sync/clients`, `POST /api/notion/export/profile/:id`, `DELETE /api/notion/disconnect` | `oauth_states`, `notion_connections`, `notion_syncs`, `profiles`, `charts`, `users`, `practitioner_clients` | `oauth_states`, `notion_connections`, `notion_syncs` |
| **analytics.js** | `GET /api/analytics/overview`, `GET /api/analytics/events`, `GET /api/analytics/funnel/:name`, `GET /api/analytics/retention`, `GET /api/analytics/errors`, `GET /api/analytics/revenue` | `analytics_events`, `funnel_events`, `subscriptions`, `users` | *(none — read-only dashboard)* |
| **experiments.js** (handler) | `GET/POST /api/experiments`, `GET /api/experiments/:name`, `PATCH /api/experiments/:name/status` | `experiments`, `experiment_assignments`, `experiment_conversions` | `experiments` |
| **onboarding.js** | `GET /api/onboarding/intro`, `GET /api/onboarding/forge`, `GET /api/onboarding/progress`, `POST /api/onboarding/advance` | `profiles` | *(KV only)* |
| **pdf.js** | `GET /api/profile/:id/pdf` | `profiles`, `charts`, `practitioner_clients`, `practitioners` | *(none — read-only)* |

### Non-Handler Code Table Access

| Module | Tables Read | Tables Written |
|--------|-------------|----------------|
| **lib/analytics.js** | `analytics_events` | `analytics_events`, `analytics_daily`, `funnel_events` |
| **lib/experiments.js** | `experiments`, `experiment_assignments`, `experiment_conversions` | `experiment_assignments`, `experiment_conversions`, `experiments` |
| **lib/webhookDispatcher.js** | `webhooks`, `webhook_deliveries` | `webhook_deliveries` |
| **middleware/auth.js** | `users` | *(none)* |
| **middleware/tierEnforcement.js** | `subscriptions`, `usage_records` | `usage_records` |
| **cron.js** | `users`, `transit_snapshots`, `transit_alerts`, `push_subscriptions`, `notification_preferences`, `refresh_tokens` | `transit_snapshots`, `analytics_events`, `funnel_events` |

---

## 6. COMPLETE TABLE COVERAGE MAP

All 48 live DB tables mapped to their code usage status:

| # | Table | Defined In | Queried In Code | Status |
|---|-------|-----------|----------------|--------|
| 1 | `achievement_events` | 004_achievements.sql | queries.js, achievements.js | **ACTIVE** |
| 2 | `alert_deliveries` | 010_transit_alerts.sql | queries.js, alerts.js, cron.js | **ACTIVE** |
| 3 | `alert_templates` | 010_transit_alerts.sql | queries.js, alerts.js | **ACTIVE** |
| 4 | `alignment_trends` | 013_daily_checkins.sql | *(none)* | **ORPHANED** — DB function `calculate_alignment_trends()` exists but is never called |
| 5 | `analytics_daily` | 014_analytics.sql | lib/analytics.js (`aggregateDaily`) | **ACTIVE** — but only written by `aggregateDaily()`, never directly read by handlers. Cron job calls it. |
| 6 | `analytics_events` | 014_analytics.sql | queries.js, analytics.js, lib/analytics.js, cron.js | **ACTIVE** |
| 7 | `api_keys` | 011_api_keys.sql | queries.js, keys.js | **ACTIVE** |
| 8 | `api_usage` | 011_api_keys.sql | queries.js, keys.js | **ACTIVE** |
| 9 | `charts` | migrate.sql | queries.js, many handlers | **ACTIVE** |
| 10 | `checkin_reminders` | 013_daily_checkins.sql | queries.js, checkin.js | **ACTIVE** |
| 11 | `cluster_members` | migrate.sql | queries.js, cluster.js | **ACTIVE** |
| 12 | `clusters` | migrate.sql | queries.js, cluster.js | **ACTIVE** |
| 13 | `daily_checkins` | 013_daily_checkins.sql | queries.js, checkin.js | **ACTIVE** |
| 14 | `diary_entries` | migrate.sql | queries.js, diary.js, profile.js | **ACTIVE** |
| 15 | `experiment_assignments` | 014_analytics.sql | lib/experiments.js | **ACTIVE** |
| 16 | `experiment_conversions` | 014_analytics.sql | lib/experiments.js | **ACTIVE** |
| 17 | `experiments` | 014_analytics.sql | lib/experiments.js, experiments.js (handler) | **ACTIVE** |
| 18 | `funnel_events` | 014_analytics.sql | queries.js, lib/analytics.js | **ACTIVE** |
| 19 | `invoices` | 003_billing.sql | queries.js, webhook.js (Stripe) | **ACTIVE** |
| 20 | `notification_preferences` | 009_push_subscriptions.sql | queries.js, push.js, cron.js | **ACTIVE** |
| 21 | `notion_connections` | 012_notion.sql | queries.js, notion.js | **ACTIVE** |
| 22 | `notion_pages` | 012_notion.sql | *(none)* | **ORPHANED** — Created but never inserted into or queried |
| 23 | `notion_syncs` | 012_notion.sql | queries.js, notion.js | **ACTIVE** |
| 24 | `oauth_states` | 012_notion.sql | queries.js, notion.js | **ACTIVE** |
| 25 | `payment_events` | migrate.sql | queries.js, billing.js, webhook.js | **ACTIVE** |
| 26 | `practitioner_clients` | migrate.sql | queries.js, practitioner.js, pdf.js, notion.js | **ACTIVE** |
| 27 | `practitioners` | migrate.sql | queries.js, practitioner.js, pdf.js | **ACTIVE** |
| 28 | `profiles` | migrate.sql | queries.js, profile.js, profile-stream.js, pdf.js, onboarding.js, notion.js | **ACTIVE** |
| 29 | `promo_codes` | 003_billing.sql | *(none)* | **ORPHANED** — Created but never queried |
| 30 | `psychometric_data` | migrate.sql | queries.js, psychometric.js, profile.js | **ACTIVE** |
| 31 | `push_notifications` | 009_push_subscriptions.sql | queries.js, push.js, cron.js | **ACTIVE** |
| 32 | `push_subscriptions` | 009_push_subscriptions.sql | queries.js, push.js, cron.js | **ACTIVE** |
| 33 | `referrals` | 003_billing.sql | queries.js, referrals.js | **ACTIVE** |
| 34 | `refresh_tokens` | migrate.sql | queries.js, auth.js, cron.js | **ACTIVE** |
| 35 | `schema_migrations` | 000_migration_tracking.sql + migrate.sql | migrate.js | **ACTIVE** (system table) |
| 36 | `share_events` | migrate.sql | queries.js, share.js | **ACTIVE** |
| 37 | `sms_messages` | migrate.sql | queries.js, sms.js | **ACTIVE** |
| 38 | `subscriptions` | migrate.sql | queries.js, billing.js, checkout.js, webhook.js, tierEnforcement.js, analytics.js | **ACTIVE** |
| 39 | `transit_alerts` | 010_transit_alerts.sql | queries.js, alerts.js, cron.js | **ACTIVE** |
| 40 | `transit_snapshots` | migrate.sql | queries.js, cron.js | **ACTIVE** |
| 41 | `usage_records` | migrate.sql | queries.js, tierEnforcement.js, calculate.js | **ACTIVE** |
| 42 | `user_achievement_stats` | 004_achievements.sql | queries.js, achievements.js, stats.js | **ACTIVE** |
| 43 | `user_achievements` | 004_achievements.sql | queries.js, achievements.js | **ACTIVE** |
| 44 | `user_streaks` | 004_achievements.sql | queries.js, achievements.js | **ACTIVE** |
| 45 | `users` | migrate.sql | queries.js, auth.js, many handlers, middleware, cron.js | **ACTIVE** |
| 46 | `validation_data` | migrate.sql | queries.js, validation.js, profile.js | **ACTIVE** |
| 47 | `webhook_deliveries` | 008_webhooks.sql | queries.js, webhooks.js, lib/webhookDispatcher.js | **ACTIVE** |
| 48 | `webhooks` | 008_webhooks.sql | queries.js, webhooks.js, lib/webhookDispatcher.js | **ACTIVE** |

---

## 7. DB OBJECTS BEYOND TABLES

### Database Functions

| Function | Created By | Called From Code | Status |
|----------|-----------|-----------------|--------|
| `get_user_streak(UUID)` | 016_fix_checkin_streak_trigger.sql | queries.js `getCheckinStreak` | **ACTIVE** |
| `refresh_checkin_streaks()` | 013 (trigger) → 016 (reworked) | cron.js (Step 4b) | **ACTIVE** |
| `update_achievement_stats()` | 004_achievements.sql | Trigger on `user_achievements` INSERT | **ACTIVE** (auto) |
| `calculate_alignment_trends()` | 013_daily_checkins.sql | *(none)* | **ORPHANED** — Never called from app code |

### Materialized Views

| View | Created By | Refreshed By | Status |
|------|-----------|-------------|--------|
| `checkin_streaks` | 013_daily_checkins.sql | cron.js via `refresh_checkin_streaks()` | **ACTIVE** |

### Regular Views

| View | Created By | Status |
|------|-----------|--------|
| `subscription_analytics` | 003_billing.sql | **UNUSED** — Not queried by any handler |
| `monthly_revenue` | 003_billing.sql | **UNUSED** — Not queried by any handler |
| `user_subscription_status` | 003_billing.sql | **UNUSED** — Not queried by any handler |
| `achievement_popularity` | 004_achievements.sql | **UNUSED** — Not queried by any handler |
| `achievement_leaderboard` | 004_achievements.sql | **UNUSED** — Not queried by any handler |
| `user_event_counts` | 004_achievements.sql | **UNUSED** — Not queried by any handler |
| `v_active_users` | 014_analytics.sql | **UNUSED** — Not queried by any handler |
| `v_event_trends` | 014_analytics.sql | **UNUSED** — Not queried by any handler |

> All 8 views exist in the DB but are never queried by application code. They may be used for manual admin queries or Neon console dashboards. Not harmful, but add schema clutter.

---

## 8. PRIORITY ACTION ITEMS

### CRITICAL (will cause runtime errors)

1. **Create migration for `users.email_verified` column**
   - 5 cron queries reference this column
   - All email drip campaigns (welcome 2/3/4, re-engagement, upgrade nudge) will fail
   - Fix: `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT NULL;`

2. **Create migration for `users.last_login_at` column**
   - Re-engagement email query (`cronGetReengagementUsers`) will fail
   - Fix: `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;`
   - Also need to add `UPDATE users SET last_login_at = NOW() WHERE id = $1` to the login flow in `auth.js`

### HIGH (dead code / wasted resources)

3. **Decide on `promo_codes` table** — Drop it or build the promo code handler
4. **Decide on `notion_pages` table** — Drop it or implement page tracking in `notion.js` handler
5. **Decide on `alignment_trends` table** — Drop it or wire up the `calculate_alignment_trends()` function to the cron job

### MEDIUM (potential logic bugs)

6. **Experiment status enum mismatch** — `lib/experiments.js` filters `WHERE status = 'active'` but the migration schema default is `'draft'` with documented values `'draft', 'running', 'paused', 'completed'`. If the handler sets status to `'running'`, the lib query will never match. Verify `'active'` vs `'running'` consistency.

### LOW (cleanup)

7. **8 unused database views** — Consider dropping `subscription_analytics`, `monthly_revenue`, `user_subscription_status`, `achievement_popularity`, `achievement_leaderboard`, `user_event_counts`, `v_active_users`, `v_event_trends` if not used for admin purposes.
8. **`calculate_alignment_trends()` orphaned function** — Either wire it into the cron or drop it.

---

## 9. QUICK STATS

| Metric | Count |
|--------|-------|
| Live DB tables | 48 |
| Tables actively used in code | **44** |
| Orphaned tables (in DB, not in code) | **3** (`promo_codes`, `notion_pages`, `alignment_trends`) |
| Phantom tables (in code, not in DB) | **0** |
| Missing user columns (critical) | **2** (`email_verified`, `last_login_at`) |
| Broken cron queries | **5** (all email drip campaigns) |
| Unused DB views | **8** |
| Orphaned DB functions | **1** (`calculate_alignment_trends`) |
| System/tracking table | **1** (`schema_migrations`) |
