# Raw SQL Audit Report

**Scope:** `workers/src/handlers/*.js`  
**Centralized queries:** `workers/src/db/queries.js` (`QUERIES` object)  
**Date:** Auto-generated audit  

---

## 1. QUERIES Keys (52 total)

| Category | Key |
|---|---|
| **Users** | `createUser`, `createUserWithPassword`, `ensureUser`, `getUserById`, `getUserByEmail`, `getUserByPhone` |
| **Charts** | `saveChart`, `getLatestChart`, `getChartById` |
| **Profiles** | `saveProfile`, `getLatestProfile`, `getProfilesByUser`, `getProfileById`, `checkPractitionerAccess` |
| **Transit Snapshots** | `saveTransitSnapshot`, `getTransitSnapshot` |
| **Practitioners** | `createPractitioner`, `getPractitionerByUserId`, `countPractitionerClients`, `addClient`, `removeClient`, `getPractitionerClients`, `getPractitionerClientsWithCharts` |
| **Clusters** | `createCluster`, `addClusterMember`, `getClusterMembers`, `getClustersByUser` |
| **SMS** | `getOptedInUsers`, `setSmsPref`, `logSmsMessage` |
| **Validation** | `saveValidationData`, `getValidationData` |
| **Psychometric** | `savePsychometricData`, `getPsychometricData` |
| **Diary** | `createDiaryEntry`, `updateDiaryEntry`, `deleteDiaryEntry`, `getDiaryEntries`, `getDiaryEntry`, `getDiaryEntriesInRange` |
| **Subscriptions** | `createSubscription`, `getSubscriptionByUserId`, `getSubscriptionByStripeCustomerId`, `getSubscriptionByStripeSubscriptionId`, `updateSubscription`, `updateSubscriptionStatus` |
| **Payment Events** | `createPaymentEvent`, `getPaymentEventsBySubscription`, `checkEventProcessed` |
| **Usage Tracking** | `createUsageRecord`, `getUsageByUserAndAction`, `getUsageByUserInPeriod` |

---

## 2. Summary

| Metric | Count |
|---|---|
| Handler files scanned | 36 |
| Files with raw inline SQL | **20** |
| Files using only `QUERIES.*` | 16 |
| Total raw SQL statements | **~150** |
| SIMPLE (no params) | ~8 |
| PARAMETERIZED ($1, $2, …) | ~138 |
| DYNAMIC (built at runtime) | **2** |

---

## 3. Files with NO raw SQL (QUERIES-only or no DB calls)

`auth.js`, `calculate.js`, `checkout.js`, `composite.js`, `cycles.js`, `experiments.js`, `forecast.js`, `geocode.js`, `onboarding.js`, `pdf.js`, `practitioner.js`, `profile.js`, `profile-stream.js`, `psychometric.js`, `rectify.js`, `validation.js`, `webhook.js`

> **webhook.js** uses `QUERIES.*` for all 10 of its query calls — well-centralized.

---

## 4. Raw SQL by File

### 4.1 achievements.js — 20 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 37 | PARAM | `SELECT * FROM user_achievements WHERE user_id = $1 ORDER BY unlocked_at DESC` |
| 48 | PARAM | `SELECT event_type, COUNT(*)::int as count FROM achievement_events WHERE user_id = $1 GROUP BY event_type` |
| 58 | PARAM | `SELECT * FROM user_streaks WHERE user_id = $1` |
| 67 | PARAM | `SELECT * FROM user_achievement_stats WHERE user_id = $1` |
| 133 | PARAM | `SELECT achievement_id FROM user_achievements WHERE user_id = $1` |
| 143 | PARAM | `SELECT * FROM user_achievement_stats WHERE user_id = $1` |
| 149 | PARAM | `SELECT * FROM user_streaks WHERE user_id = $1` |
| 212 | PARAM | `SELECT uas.*, u.email FROM user_achievement_stats uas JOIN users u ON u.id = uas.user_id ORDER BY uas.total_points DESC LIMIT $1` |
| 230 | PARAM | `SELECT rank FROM (SELECT user_id, RANK() OVER (ORDER BY total_points DESC) ... FROM user_achievement_stats) ... WHERE user_id = $1` |
| 338 | PARAM | `INSERT INTO achievement_events (user_id, event_type, event_data) VALUES ($1, $2, $3)` |
| 352 | PARAM | `SELECT achievement_id FROM user_achievements WHERE user_id = $1` |
| 362 | PARAM | `INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *` |
| 404 | PARAM | `SELECT * FROM user_streaks WHERE user_id = $1` |
| 411 | PARAM | `INSERT INTO user_streaks (user_id, streak_type, current_count, ...) VALUES ($1, $2, 1, ...) ON CONFLICT ... DO UPDATE ...` |
| 433 | PARAM | `UPDATE user_streaks SET current_count = current_count + 1, last_event_at = NOW(), ... WHERE user_id = $1 AND streak_type = $2` |
| 441 | PARAM | `UPDATE user_streaks SET current_count = 1, last_event_at = NOW(), ... WHERE user_id = $1 AND streak_type = $2` |
| 456 | PARAM | `SELECT event_type, COUNT(*)::int as count FROM achievement_events WHERE user_id = $1 GROUP BY event_type` |
| 469 | PARAM | `SELECT * FROM user_streaks WHERE user_id = $1` |
| 481 | PARAM | `INSERT INTO user_achievement_stats (user_id, total_points, ...) VALUES ($1, $2, ...) ON CONFLICT (user_id) DO UPDATE SET ...` |
| 500 | PARAM | `SELECT * FROM user_achievement_stats WHERE user_id = $1` |
| 517 | PARAM | `SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2` |
| 524 | PARAM | `INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *` |

**Tables:** `user_achievements`, `achievement_events`, `user_streaks`, `user_achievement_stats`, `users`  
**Note:** No QUERIES keys exist for any achievement table. Entire module is raw SQL.

---

### 4.2 analytics.js — 13 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 66 | SIMPLE | `SELECT COUNT(DISTINCT CASE WHEN ...) AS dau, ... AS wau, ... AS mau FROM analytics_events` |
| 76 | SIMPLE | `SELECT COUNT(*) AS count FROM analytics_events WHERE created_at >= CURRENT_DATE` |
| 83 | SIMPLE | `SELECT COUNT(*) FILTER (WHERE ...) AS this_week, ... AS last_week FROM analytics_events WHERE event_name = 'signup'` |
| 93 | SIMPLE | `SELECT event_name, COUNT(*) AS count, COUNT(DISTINCT user_id) ... FROM analytics_events ... GROUP BY event_name ORDER BY count DESC LIMIT 15` |
| 145–160 | DYNAMIC | Event trends query — conditionally appends `AND event_name = $2` then `GROUP BY + ORDER BY`. Uses `sql += ...` pattern with `params` array. |
| 196 | PARAM | `SELECT step_name, step_order, COUNT(DISTINCT user_id) ... FROM funnel_events WHERE funnel_name = $1 GROUP BY ...` |
| 250 | PARAM | Cohort retention CTE — `WITH cohorts AS (...) SELECT cohort_week, week_offset, COUNT(DISTINCT user_id) ... FROM activity GROUP BY ...` ($1 = weeks) |
| 318 | PARAM | `SELECT COUNT(*) FILTER (WHERE event_name = 'error') AS errors, COUNT(*) AS total, ... FROM analytics_events WHERE created_at >= ...` ($1 = days) |
| 328 | PARAM | `SELECT properties->>'message' AS error_message, ... FROM analytics_events WHERE event_name = 'error' AND created_at >= ... GROUP BY ... LIMIT 20` ($1 = days) |
| 343 | PARAM | `SELECT DATE(created_at) AS date, COUNT(*) AS count FROM analytics_events WHERE event_name = 'error' AND created_at >= ...` ($1 = days) |
| 385 | SIMPLE | `SELECT COUNT(*) FILTER (WHERE tier = 'seeker' AND status = 'active') AS seeker_count, ... FROM subscriptions` |
| 396 | SIMPLE | `SELECT tier, COUNT(*) AS count FROM users GROUP BY tier ORDER BY count DESC` |
| 404 | SIMPLE | `SELECT DATE_TRUNC('month', updated_at) AS month, COUNT(*) AS churned_count FROM subscriptions WHERE status = 'canceled' AND updated_at >= ... GROUP BY ...` |

**Tables:** `analytics_events`, `funnel_events`, `subscriptions`, `users`  
**Note:** Lines 145–160 is a **DYNAMIC** query (conditionally appends WHERE clause based on `eventFilter`).

---

### 4.3 alerts.js — 20 raw SQL (incl. 1 DYNAMIC)

| Line | Type | Snippet |
|---|---|---|
| 71 | PARAM | `SELECT * FROM transit_alerts WHERE user_id = $1 ORDER BY ...` |
| 153 | PARAM | `SELECT COUNT(*)::int as count FROM transit_alerts WHERE user_id = $1` |
| 171 | PARAM | `INSERT INTO transit_alerts (user_id, alert_type, ...) VALUES ($1, $2, ...) RETURNING *` |
| 221 | PARAM | `SELECT * FROM transit_alerts WHERE id = $1 AND user_id = $2` |
| 308 | **DYNAMIC** | `UPDATE transit_alerts SET ${fields.join(', ')} WHERE id = $N AND user_id = $N RETURNING id` — builds SET clause dynamically with `paramIdx++` |
| 343 | PARAM | `DELETE FROM transit_alerts WHERE id = $1 AND user_id = $2 RETURNING id` |
| 377 | PARAM | `SELECT hd_json, astro_json FROM charts WHERE user_id = $1 ORDER BY calculated_at DESC LIMIT 1` |
| 389 | PARAM | `SELECT * FROM alert_templates WHERE alert_type = $1` |
| 425 | PARAM | `SELECT * FROM alert_templates WHERE alert_type = $1` |
| 452 | PARAM | `SELECT hd_json, astro_json FROM charts WHERE user_id = $1 ORDER BY ... LIMIT 1` |
| 475 | PARAM | `INSERT INTO alert_deliveries (alert_id, gate, channel, ...) VALUES ($1, $2, $3, ...) RETURNING *` |
| 492 | PARAM | `UPDATE transit_alerts SET last_triggered_at = NOW() WHERE id = $1` |
| 528 | PARAM | `SELECT ad.*, ta.alert_type FROM alert_deliveries ad JOIN transit_alerts ta ON ta.id = ad.alert_id WHERE ta.user_id = $1 ORDER BY ad.delivered_at DESC LIMIT $2 OFFSET $3` |
| 546 | PARAM | `SELECT COUNT(*)::int as total FROM alert_deliveries ad JOIN transit_alerts ta ... WHERE ta.user_id = $1` |
| 654 | PARAM | `SELECT ta.*, ... FROM transit_alerts ta WHERE ta.enabled = true AND (ta.last_triggered_at IS NULL OR ta.last_triggered_at < NOW() - INTERVAL '1 hour')` |
| 686 | PARAM | `SELECT hd_json, astro_json FROM charts WHERE user_id = $1 ORDER BY ... LIMIT 1` |
| 729 | PARAM | `SELECT hd_json, astro_json FROM charts WHERE user_id = $1 ORDER BY ... LIMIT 1` |
| 768 | PARAM | `SELECT id FROM alert_deliveries WHERE alert_id = $1 AND gate = $2 AND delivered_at > NOW() - INTERVAL '24 hours'` |
| 776 | PARAM | `INSERT INTO alert_deliveries (alert_id, gate, channel, ...) VALUES ($1, $2, $3, ...) RETURNING *` |
| 826 | PARAM | `UPDATE alert_deliveries SET status = $1 WHERE id = $2` |
| 847 | PARAM | `UPDATE transit_alerts SET last_triggered_at = NOW() WHERE id = $1` |

**Tables:** `transit_alerts`, `alert_deliveries`, `alert_templates`, `charts`  
**Note:** Line 308 is a **DYNAMIC** query — builds `SET` clause at runtime from user-supplied field names using `paramIdx`.

---

### 4.4 billing.js — 16 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 195 | PARAM | `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active'` |
| 221 | PARAM | `UPDATE users SET tier = $1 WHERE id = $2` |
| 293 | PARAM | `SELECT * FROM subscriptions WHERE user_id = $1` |
| 323 | PARAM | `UPDATE subscriptions SET status = 'canceled', cancel_at_period_end = true, updated_at = NOW() WHERE user_id = $1` |
| 333 | PARAM | `UPDATE users SET tier = 'free' WHERE id = $1` |
| 385 | PARAM | `SELECT * FROM subscriptions WHERE user_id = $1 AND status IN ('active', 'trialing')` |
| 433 | PARAM | `UPDATE subscriptions SET tier = $1, status = 'active', ... WHERE user_id = $2` |
| 439 | PARAM | `UPDATE users SET tier = $1 WHERE id = $2` |
| 546 | PARAM | `INSERT INTO invoices (user_id, stripe_invoice_id, amount, currency, status, ...) VALUES ($1, $2, ...) ON CONFLICT ... DO UPDATE ...` |
| 555 | PARAM | `UPDATE subscriptions SET status = $1, current_period_start = $2, current_period_end = $3, updated_at = NOW() WHERE stripe_subscription_id = $4` |
| 576 | PARAM | `INSERT INTO payment_events (subscription_id, stripe_event_id, event_type, amount, currency, status, ...) VALUES ((SELECT id FROM subscriptions WHERE stripe_subscription_id = $1), $2, ...)` |
| 599 | PARAM | `SELECT * FROM subscriptions WHERE stripe_subscription_id = $1` |
| 606 | PARAM | `UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2` |
| 613 | PARAM | `UPDATE users SET tier = 'free' WHERE id = $1` |
| 632 | PARAM | `INSERT INTO payment_events (...) VALUES ((SELECT id FROM subscriptions WHERE stripe_subscription_id = $1), ...)` |
| 651 | PARAM | `INSERT INTO payment_events (...) VALUES ((SELECT id FROM subscriptions WHERE stripe_subscription_id = $1), ...)` |

**Tables:** `subscriptions`, `users`, `invoices`, `payment_events`  
**Note:** Some of these overlap with `QUERIES.updateSubscription` / `QUERIES.createPaymentEvent` but use different SQL (e.g., different WHERE clauses or sub-selects).

---

### 4.5 checkin.js — 10 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 108 | PARAM | `INSERT INTO daily_checkins (user_id, checkin_date, ...) VALUES ($1, $2, ...) ON CONFLICT (user_id, checkin_date) DO UPDATE SET ... RETURNING *` |
| 148 | PARAM | `SELECT current_streak, last_checkin_date, streak_start_date FROM checkin_streaks WHERE user_id = $1` |
| 199 | PARAM | `SELECT * FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2` |
| 254 | PARAM | `SELECT * FROM daily_checkins WHERE user_id = $1 ORDER BY checkin_date DESC LIMIT $2 OFFSET $3` |
| 262 | PARAM | `SELECT COUNT(*)::int as total FROM daily_checkins WHERE user_id = $1` |
| 317 | PARAM | `SELECT alignment_score, followed_strategy, ... FROM daily_checkins WHERE user_id = $1 AND checkin_date >= $2 ORDER BY checkin_date ASC` |
| 416 | PARAM | `SELECT current_streak, last_checkin_date, streak_start_date FROM checkin_streaks WHERE user_id = $1` |
| 437 | PARAM | `SELECT checkin_date FROM daily_checkins WHERE user_id = $1 ORDER BY checkin_date ASC` |
| 520 | PARAM | `INSERT INTO checkin_reminders (user_id, enabled, reminder_time, ...) VALUES ($1, $2, ...) ON CONFLICT (user_id) DO UPDATE SET ... RETURNING *` |
| 569 | PARAM | `SELECT * FROM checkin_reminders WHERE user_id = $1` |

**Tables:** `daily_checkins`, `checkin_streaks`, `checkin_reminders`  
**Note:** No QUERIES keys exist for any checkin table. Entire module is raw SQL.

---

### 4.6 famous.js — 2 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 44 | PARAM | `SELECT c.id, c.hd_json, c.calculated_at, u.birth_date, u.birth_time, u.birth_tz, u.birth_lat, u.birth_lng FROM charts c JOIN users u ON u.id = c.user_id WHERE c.user_id = $1 ORDER BY c.calculated_at DESC LIMIT 1` |
| 136 | PARAM | Same query as line 44 (duplicate in `handleGetCelebrityMatchById`) |

**Tables:** `charts`, `users`  
**Note:** `QUERIES.getLatestChart` exists but does NOT include the JOIN to `users` for birth data. These queries need a new QUERIES key.

---

### 4.7 keys.js — 9 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 116 | PARAM | `SELECT COUNT(*)::int as count FROM api_keys WHERE user_id = $1 AND active = true` |
| 178 | PARAM | `SELECT k.id, k.name, ..., COUNT(u.id)::int as total_requests, ... FROM api_keys k LEFT JOIN api_usage u ON k.id = u.key_id WHERE k.user_id = $1 GROUP BY k.id ORDER BY k.created_at DESC` |
| 246 | PARAM | `SELECT id, name, scopes, tier, ... FROM api_keys WHERE id = $1 AND user_id = $2` |
| 305 | PARAM | `SELECT id FROM api_keys WHERE id = $1 AND user_id = $2` |
| 322 | PARAM | `UPDATE api_keys SET active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1` |
| 357 | PARAM | `SELECT id, name, tier, rate_limit_per_day FROM api_keys WHERE id = $1 AND user_id = $2` |
| 379 | PARAM | `SELECT COUNT(*)::int as total_requests, ... AVG(response_time_ms), MAX(created_at) FROM api_usage WHERE key_id = $1 AND created_at > NOW() - ($2 * INTERVAL '1 day')` |
| 393 | PARAM | `SELECT endpoint, COUNT(*)::int as count FROM api_usage WHERE key_id = $1 AND ... GROUP BY endpoint ORDER BY count DESC LIMIT 10` |
| 403 | PARAM | `SELECT created_at::date as date, COUNT(*)::int as requests, ... FROM api_usage WHERE key_id = $1 AND ... GROUP BY created_at::date ORDER BY date DESC` |

**Tables:** `api_keys`, `api_usage`  
**Note:** No QUERIES keys exist for API key tables. Entire module is raw SQL.

---

### 4.8 notion.js — 16 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 32 | PARAM | `INSERT INTO oauth_states (state, user_id, provider, expires_at) VALUES ($1, $2, 'notion', ...) ON CONFLICT (state) DO UPDATE SET ...` |
| 103 | PARAM | `SELECT * FROM oauth_states WHERE state = $1 AND provider = 'notion' AND expires_at > NOW()` |
| 115 | PARAM | `DELETE FROM oauth_states WHERE state = $1` |
| 146 | PARAM | `INSERT INTO notion_connections (user_id, access_token, workspace_id, ...) VALUES ($1, $2, ...) ON CONFLICT (user_id) DO UPDATE SET ...` |
| 209 | PARAM | `SELECT * FROM notion_connections WHERE user_id = $1` |
| 263 | PARAM | `SELECT * FROM notion_connections WHERE user_id = $1` |
| 280 | PARAM | `SELECT * FROM notion_syncs WHERE connection_id = $1 ORDER BY synced_at DESC LIMIT 1` |
| 293 | PARAM | `INSERT INTO notion_syncs (connection_id, page_count, status) VALUES ($1, $2, $3) RETURNING *` |
| 303 | PARAM | `SELECT * FROM practitioners WHERE user_id = $1` |
| 317 | PARAM | `SELECT pc.*, u.email, u.birth_date FROM practitioner_clients pc JOIN users u ON u.id = pc.client_user_id WHERE pc.practitioner_id = $1` |
| 359 | PARAM | `UPDATE notion_syncs SET page_count = $1, status = 'completed', synced_at = NOW() WHERE id = $2` |
| 393 | PARAM | `SELECT * FROM notion_connections WHERE user_id = $1` |
| 407 | PARAM | `SELECT p.*, c.hd_json FROM profiles p JOIN charts c ON c.id = p.chart_id WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT 1` |
| 469 | PARAM | `DELETE FROM notion_connections WHERE user_id = $1 RETURNING *` |
| 474 | PARAM | `DELETE FROM notion_syncs WHERE connection_id = $1` |

**Tables:** `oauth_states`, `notion_connections`, `notion_syncs`, `practitioners`, `practitioner_clients`, `users`, `profiles`, `charts`  
**Note:** No QUERIES keys exist for Notion tables. Entire module is raw SQL.

---

### 4.9 push.js — 17 raw SQL (incl. 1 DYNAMIC)

| Line | Type | Snippet |
|---|---|---|
| 235 | PARAM | `SELECT id FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2` |
| 242 | PARAM | `UPDATE push_subscriptions SET p256dh_key = $1, auth_key = $2, updated_at = NOW() WHERE user_id = $3 AND endpoint = $4` |
| 255 | PARAM | `INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key) VALUES ($1, $2, $3, $4) RETURNING *` |
| 263 | PARAM | `SELECT * FROM notification_preferences WHERE user_id = $1` |
| 268 | PARAM | `INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING` |
| 309 | PARAM | `SELECT * FROM push_subscriptions WHERE user_id = $1` |
| 344 | PARAM | `SELECT * FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2` |
| 402 | PARAM | `SELECT * FROM notification_preferences WHERE user_id = $1` |
| 516 | **DYNAMIC** | `INSERT INTO notification_preferences (user_id) VALUES ($N) ON CONFLICT (user_id) DO UPDATE SET ${fields.join(', ')}` — builds SET clause dynamically with `paramIdx++` |
| 548 | PARAM | `SELECT * FROM push_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3` |
| 562 | PARAM | `SELECT COUNT(*)::int as total FROM push_notifications WHERE user_id = $1` |
| 617 | PARAM | `INSERT INTO push_notifications (user_id, title, body, ..., status) VALUES ($1, ..., 'sent') RETURNING *` |
| 664 | PARAM | `INSERT INTO push_notifications (user_id, title, body, ..., status) VALUES ($1, ..., 'failed') RETURNING *` |
| 671 | PARAM | `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2` |
| 698 | PARAM | `INSERT INTO push_notifications (user_id, title, body, ..., status) VALUES ($1, ..., 'sent') RETURNING *` |
| 733 | PARAM | `SELECT * FROM notification_preferences WHERE user_id = $1` |
| 781 | PARAM | `SELECT * FROM push_subscriptions WHERE user_id = $1` |

**Tables:** `push_subscriptions`, `notification_preferences`, `push_notifications`  
**Note:** No QUERIES keys exist for push tables. Line 516 is a **DYNAMIC** query.

---

### 4.10 referrals.js — 18 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 126 | PARAM | `SELECT COUNT(*)::int as total FROM referrals WHERE referrer_user_id = $1` |
| 134 | PARAM | `SELECT COUNT(*)::int as converted FROM referrals WHERE referrer_user_id = $1 AND status = 'converted'` |
| 142 | PARAM | `SELECT COALESCE(SUM(reward_amount), 0)::int as total_rewards FROM referrals WHERE referrer_user_id = $1 AND reward_claimed = true` |
| 152 | PARAM | `SELECT * FROM referrals WHERE referrer_user_id = $1 AND status = 'pending' ORDER BY created_at DESC` |
| 160 | PARAM | `SELECT r.*, u.email as referred_email FROM referrals r LEFT JOIN users u ON u.id = r.referred_user_id WHERE r.referrer_user_id = $1 ORDER BY r.created_at DESC LIMIT $2 OFFSET $3` |
| 243 | PARAM | `SELECT COUNT(*)::int as total FROM referrals WHERE referrer_user_id = $1` |
| 251 | PARAM | `SELECT r.*, u.email as referred_email FROM referrals r LEFT JOIN users u ON ... WHERE r.referrer_user_id = $1 ORDER BY r.created_at DESC LIMIT $2 OFFSET $3` |
| 333 | PARAM | `SELECT id FROM users WHERE referral_code = $1` (checks code uniqueness) |
| 412 | PARAM | `SELECT id, referral_code FROM users WHERE referral_code = $1` |
| 429 | PARAM | `SELECT id FROM referrals WHERE referrer_user_id = $1 AND referred_user_id = $2` (prevents duplicates) |
| 455 | PARAM | `INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status) VALUES ($1, $2, $3, 'pending') RETURNING *` |
| 508 | PARAM | `SELECT * FROM referrals WHERE referred_user_id = $1 AND status = 'pending'` |
| 589 | PARAM | `SELECT * FROM referrals WHERE id = $1 AND referrer_user_id = $2 AND reward_claimed = false` |
| 624 | PARAM | `UPDATE referrals SET reward_claimed = true, reward_claimed_at = NOW() WHERE id = $1 RETURNING *` |
| 636 | PARAM | `SELECT tier FROM users WHERE id = $1` |
| 692 | PARAM | `SELECT * FROM referrals WHERE referrer_user_id = $1 AND status = 'converted' AND reward_claimed = false ORDER BY created_at ASC LIMIT $2` |
| 705 | PARAM | `UPDATE referrals SET reward_claimed = true, reward_claimed_at = NOW() WHERE id = $1` |

**Tables:** `referrals`, `users`  
**Note:** Also uses an inline `UPDATE users SET referral_code = $1 WHERE id = $2` (around line 340). No QUERIES keys for referrals table.

---

### 4.11 share.js — 8 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 109 | PARAM | `INSERT INTO share_events (user_id, share_type, share_data, platform) VALUES ($1, 'celebrity_match', $2, $3)` |
| 198 | PARAM | `INSERT INTO share_events (user_id, share_type, share_data, platform) VALUES ($1, 'chart', $2, $3)` |
| 271 | PARAM | `SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2 LIMIT 1` |
| 317 | PARAM | `INSERT INTO share_events (user_id, share_type, share_data, platform) VALUES ($1, 'achievement', $2, $3)` |
| 406 | PARAM | `INSERT INTO share_events (user_id, share_type, share_data, platform) VALUES ($1, 'referral', $2, $3)` |
| 455 | PARAM | `SELECT share_type, COUNT(*)::int as count FROM share_events WHERE user_id = $1 GROUP BY share_type` |
| 465 | PARAM | `SELECT share_type, platform, created_at FROM share_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10` |
| 476 | PARAM | `SELECT COUNT(*)::int as referred_count FROM referrals WHERE referrer_user_id = $1` |

**Tables:** `share_events`, `user_achievements`, `referrals`  
**Note:** No QUERIES keys for `share_events` table.

---

### 4.12 sms.js — 6 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 191 | PARAM | `UPDATE users SET sms_opted_in = false WHERE phone = $1` |
| 205 | PARAM | `UPDATE users SET sms_opted_in = true WHERE phone = $1` |
| 278 | SIMPLE | `SELECT * FROM users WHERE sms_opted_in = true AND phone IS NOT NULL` |
| 414 | PARAM | `UPDATE users SET phone = $1, sms_opted_in = true WHERE id = $2` |
| 469 | PARAM | `SELECT phone FROM users WHERE id = $1` |
| 477 | PARAM | `UPDATE users SET sms_opted_in = false WHERE id = $1` |

**Tables:** `users`  
**Note:** `QUERIES.setSmsPref` exists (uses `phone` as key) but these inline variants use `id` as key or combine multiple SET fields. `QUERIES.getOptedInUsers` covers line 278's logic but handler uses `SELECT *` instead.

---

### 4.13 stats.js — 4 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 27 | SIMPLE | `SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE event_name = 'chart_calculate' AND created_at >= NOW() - INTERVAL '7 days'` |
| 36 | SIMPLE | `SELECT COUNT(*) as count FROM profiles WHERE status = 'completed'` |
| 43 | SIMPLE | `SELECT COUNT(*) as count FROM charts` |
| 97 | SIMPLE | `SELECT u.email, uas.total_points, uas.total_achievements FROM user_achievement_stats uas JOIN users u ON u.id = uas.user_id ORDER BY uas.total_points DESC LIMIT 10` |

**Tables:** `analytics_events`, `profiles`, `charts`, `user_achievement_stats`, `users`

---

### 4.14 webhooks.js — 8 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 136 | PARAM | `INSERT INTO webhooks (user_id, name, url, events, secret, ...) VALUES ($1, $2, ...) RETURNING *` |
| 176 | PARAM | `SELECT * FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC` |
| 219 | PARAM | `SELECT * FROM webhooks WHERE id = $1 AND user_id = $2` |
| 260 | PARAM | `UPDATE webhooks SET name = COALESCE($1, name), url = COALESCE($2, url), ... WHERE id = $N AND user_id = $N RETURNING *` |
| 293 | PARAM | `DELETE FROM webhooks WHERE id = $1 AND user_id = $2 RETURNING *` |
| 341 | PARAM | `SELECT * FROM webhooks WHERE id = $1 AND user_id = $2` |
| 357 | PARAM | `SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3` |
| 365 | PARAM | `SELECT COUNT(*)::int as total FROM webhook_deliveries WHERE webhook_id = $1` |

**Tables:** `webhooks`, `webhook_deliveries`  
**Note:** No QUERIES keys for webhook tables. Entire module is raw SQL.

---

### 4.15 billing.js (continued — see 4.4 above)

*(Already covered in section 4.4)*

---

### 4.16 chart-save.js — 1 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 106 | PARAM | `SELECT id, calculated_at, hd_json::jsonb->'chart'->'type' as type FROM charts WHERE user_id = $1 ORDER BY calculated_at DESC LIMIT 50` |

**Tables:** `charts`  
**Note:** `QUERIES.getLatestChart` exists but does not support JSONB path extraction or LIMIT 50.

---

### 4.17 cluster.js — 2 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 188 | PARAM | `SELECT c.id, c.name, c.challenge, c.created_at, cm.joined_at FROM cluster_members cm JOIN clusters c ON c.id = cm.cluster_id WHERE cm.user_id = $1 ORDER BY cm.joined_at DESC` |
| 238 | PARAM | `DELETE FROM cluster_members WHERE cluster_id = $1 AND user_id = $2 RETURNING cluster_id` |

**Tables:** `cluster_members`, `clusters`  
**Note:** `QUERIES.getClustersByUser` exists but uses a different JOIN direction (clusters → cluster_members). The handlers duplicate/extend that logic.

---

### 4.18 diary.js — 1 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 40 | PARAM | `SELECT hd_json, astro_json FROM charts WHERE user_id = $1 ORDER BY calculated_at DESC LIMIT 1` |

**Tables:** `charts`  
**Note:** Nearly identical to `QUERIES.getLatestChart` but selects only `hd_json, astro_json` instead of all columns.

---

### 4.19 timing.js — 1 raw SQL

| Line | Type | Snippet |
|---|---|---|
| 128 | PARAM | `SELECT c.id, c.hd_json, c.astro_json, c.calculated_at, u.birth_date, u.birth_time, u.birth_tz, u.birth_lat, u.birth_lng FROM charts c JOIN users u ON u.id = c.user_id WHERE c.user_id = $1 ORDER BY c.calculated_at DESC LIMIT 1` |

**Tables:** `charts`, `users`  
**Note:** Same pattern as famous.js — needs a `getLatestChartWithBirth` QUERIES key.

---

## 5. DYNAMIC Query Location Summary

Only **3** dynamic queries exist in the codebase:

| File | Line | Pattern | Risk |
|---|---|---|---|
| alerts.js | ~308 | Builds `SET` clause with `paramIdx++` from allowed field names | **LOW** — field names are hardcoded in handler, not from user input |
| push.js | ~516 | Builds `SET` clause with `paramIdx++` for notification preferences | **LOW** — same safe pattern |
| analytics.js | ~145–160 | Appends optional `AND event_name = $2` based on query param | **LOW** — parameterized value only |

---

## 6. Tables With No QUERIES Coverage

These tables have **zero** representation in the centralized `QUERIES` object:

| Table | Used In |
|---|---|
| `user_achievements` | achievements.js, share.js |
| `achievement_events` | achievements.js |
| `user_streaks` | achievements.js |
| `user_achievement_stats` | achievements.js, stats.js |
| `daily_checkins` | checkin.js |
| `checkin_streaks` | checkin.js |
| `checkin_reminders` | checkin.js |
| `analytics_events` | analytics.js, stats.js |
| `funnel_events` | analytics.js |
| `transit_alerts` | alerts.js |
| `alert_deliveries` | alerts.js |
| `alert_templates` | alerts.js |
| `push_subscriptions` | push.js |
| `notification_preferences` | push.js |
| `push_notifications` | push.js |
| `webhooks` | webhooks.js |
| `webhook_deliveries` | webhooks.js |
| `api_keys` | keys.js |
| `api_usage` | keys.js |
| `oauth_states` | notion.js |
| `notion_connections` | notion.js |
| `notion_syncs` | notion.js |
| `referrals` | referrals.js, share.js |
| `share_events` | share.js |
| `invoices` | billing.js |

---

## 7. Priority Centralization Targets

Ranked by frequency of raw SQL usage:

| Priority | File | Raw SQL Count | Effort |
|---|---|---|---|
| 1 | achievements.js | 20 | HIGH — need ~12 new QUERIES keys |
| 2 | alerts.js | 20 | HIGH — includes 1 dynamic query |
| 3 | referrals.js | 18 | HIGH — need ~10 new QUERIES keys |
| 4 | push.js | 17 | HIGH — includes 1 dynamic query |
| 5 | billing.js | 16 | MEDIUM — some overlap with existing QUERIES |
| 6 | notion.js | 16 | MEDIUM — need ~12 new QUERIES keys |
| 7 | analytics.js | 13 | MEDIUM — mostly dashboard/reporting queries |
| 8 | checkin.js | 10 | MEDIUM — need ~6 new QUERIES keys |
| 9 | keys.js | 9 | MEDIUM — need ~7 new QUERIES keys |
| 10 | webhooks.js | 8 | LOW — need ~5 new QUERIES keys |
| 11 | share.js | 8 | LOW — repeated INSERT pattern |
| 12 | sms.js | 6 | LOW — partially covered by existing QUERIES |
| 13 | stats.js | 4 | LOW — simple aggregate queries |
| 14 | famous.js | 2 | LOW — need 1 new QUERIES key |
| 15 | cluster.js | 2 | LOW — partially covered |
| 16 | timing.js | 1 | LOW — same as famous.js pattern |
| 17 | chart-save.js | 1 | LOW — variant of getLatestChart |
| 18 | diary.js | 1 | LOW — variant of getLatestChart |

**Estimated new QUERIES keys needed:** ~80–90 to fully centralize.
