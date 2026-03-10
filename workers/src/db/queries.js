/**
 * Database Queries — Neon PostgreSQL
 *
 * Prepared queries for all core operations.
 * Uses @neondatabase/serverless for Workers compatibility.
 *
 * In Workers context, use createQueryFn() which uses Neon serverless driver.
 * In Node context (migration), use getClient() which uses pg.
 */

import { neonConfig, Pool } from '@neondatabase/serverless';

/**
 * Get a pg Client for migration scripts (Node.js only).
 * NOT available in Workers runtime — use createQueryFn instead.
 */
export async function getClient(connectionString) {
  // Use string concatenation to prevent esbuild from resolving at bundle time
  const moduleName = 'p' + 'g';
  const pg = await import(moduleName);
  const Client = pg.default?.Client || pg.Client;
  return new Client({ connectionString, ssl: { rejectUnauthorized: false } });
}

/**
 * Singleton pool cache — keyed by connection string.
 * In Cloudflare Workers each isolate is single-threaded and reused across
 * requests, so a module-level Map lets us reuse the same Pool instead of
 * creating a new one on every handler call (~100+ sites).
 * @type {Map<string, Pool>}
 */
const _pools = new Map();

/**
 * Return (or create) a singleton Pool for the given connection string.
 * @param {string} connectionString
 * @returns {Pool}
 */
function getPool(connectionString) {
  let pool = _pools.get(connectionString);
  if (!pool) {
    neonConfig.fetchFunction = fetch;
    pool = new Pool({ connectionString });
    _pools.set(connectionString, pool);
  }
  return pool;
}

/**
 * Create a serverless query function for Workers runtime.
 * Uses Neon's serverless driver optimized for edge compute.
 * Pool instances are cached per-isolate (singleton) so repeated calls
 * within the same request or across requests reuse the same connection.
 *
 * @param {string} connectionString — Neon connection string
 * @returns {Function} query function (sql, params) => Promise<{rows}>
 */
export function createQueryFn(connectionString) {
  if (!connectionString) {
    throw new Error('NEON_CONNECTION_STRING is not configured. Add it via: `npx wrangler secret put NEON_CONNECTION_STRING`');
  }
  const pool = getPool(connectionString);

  async function query(sqlText, params = []) {
    try {
      const result = await pool.query(sqlText, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Run multiple queries inside a single transaction.
   *
   * BL-S15-C1: Uses pool.connect() to obtain a dedicated client with
   * connection affinity. Neon's serverless Pool in HTTP mode sends each
   * pool.query() as an independent request with no connection guarantee,
   * so BEGIN/COMMIT/ROLLBACK via pool.query() would execute on different
   * connections — making the transaction non-functional. A connected client
   * (WebSocket-backed) maintains a single connection for the entire block.
   *
   * @param {(q: Function) => Promise<T>} fn — receives a query function bound to the transaction client
   * @returns {Promise<T>}
   */
  query.transaction = async function transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Provide a query function bound to this specific client
      const txQuery = async (sqlText, params = []) => {
        try {
          return await client.query(sqlText, params);
        } catch (error) {
          console.error('Transaction query error:', error);
          throw error;
        }
      };

      const result = await fn(txQuery);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Transaction rollback failed:', rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }
  };

  return query;
}

// ─── User Queries ────────────────────────────────────────────

export const QUERIES = {
  // Users
  createUser: `
    INSERT INTO users (email, phone, birth_date, birth_time, birth_tz, birth_lat, birth_lng)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, created_at
  `,

  createUserWithPassword: `
    INSERT INTO users (email, phone, password_hash, birth_date, birth_time, birth_tz, birth_lat, birth_lng)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, created_at
  `,

  // Upsert user by ID — ensures foreign keys succeed even if user row is missing.
  // Caller passes: id, email, phone, birth_date, birth_time, birth_tz, birth_lat, birth_lng
  ensureUser: `
    INSERT INTO users (id, email, phone, birth_date, birth_time, birth_tz, birth_lat, birth_lng)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET updated_at = now()
    RETURNING id
  `,

  getUserById: `
    SELECT id, email, phone, password_hash, birth_date, birth_time, birth_tz, birth_lat, birth_lng, sms_opted_in, tier, stripe_customer_id, referral_code, email_verified, last_login_at, created_at, updated_at
    FROM users WHERE id = $1
  `,

  getUserByEmail: `
    SELECT id, email, phone, password_hash, birth_date, birth_time, birth_tz, birth_lat, birth_lng, sms_opted_in, tier, stripe_customer_id, referral_code, email_verified, last_login_at, created_at, updated_at
    FROM users WHERE email = $1
  `,

  getUserByPhone: `
    SELECT id, email, phone, password_hash, birth_date, birth_time, birth_tz, birth_lat, birth_lng, sms_opted_in, tier, stripe_customer_id, referral_code, email_verified, last_login_at, created_at, updated_at
    FROM users WHERE phone = $1
  `,

  // BL-FIX: Add query to update last_login_at on successful login
  updateLastLogin: `
    UPDATE users SET last_login_at = NOW(), updated_at = NOW()
    WHERE id = $1
  `,

  // ─── Refresh Tokens ─────────────────────────────────────────
  insertRefreshToken: `
    INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
    VALUES ($1, $2, $3, to_timestamp($4))
    RETURNING id
  `,

  getRefreshTokenByHash: `
    SELECT id, user_id, token_hash, family_id, expires_at, revoked_at, created_at
    FROM refresh_tokens
    WHERE token_hash = $1
  `,

  revokeRefreshToken: `
    UPDATE refresh_tokens SET revoked_at = now()
    WHERE id = $1 AND revoked_at IS NULL
  `,

  revokeRefreshTokenFamily: `
    UPDATE refresh_tokens SET revoked_at = now()
    WHERE family_id = $1 AND revoked_at IS NULL
  `,

  revokeAllUserRefreshTokens: `
    UPDATE refresh_tokens SET revoked_at = now()
    WHERE user_id = $1 AND revoked_at IS NULL
  `,

  deleteExpiredRefreshTokens: `
    DELETE FROM refresh_tokens
    WHERE expires_at < now() OR (revoked_at IS NOT NULL AND revoked_at < now() - INTERVAL '7 days')
  `,

  // Charts
  saveChart: `
    INSERT INTO charts (user_id, hd_json, astro_json)
    VALUES ($1, $2, $3)
    RETURNING id, calculated_at
  `,

  getLatestChart: `
    SELECT id, user_id, hd_json, astro_json, calculated_at
    FROM charts
    WHERE user_id = $1
    ORDER BY calculated_at DESC
    LIMIT 1
  `,

  getChartById: `
    SELECT id, user_id, hd_json, astro_json, calculated_at
    FROM charts WHERE id = $1
  `,

  // Profiles
  saveProfile: `
    INSERT INTO profiles (user_id, chart_id, profile_json, model_used, grounding_audit)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, created_at
  `,

  getLatestProfile: `
    SELECT id, user_id, chart_id, profile_json, model_used, grounding_audit, created_at
    FROM profiles
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `,

  getProfilesByUser: `
    SELECT id, chart_id, model_used, created_at
    FROM profiles
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 50
  `,

  getProfileById: `
    SELECT id, user_id, chart_id, profile_json, model_used, grounding_audit, created_at
    FROM profiles WHERE id = $1
  `,

  checkPractitionerAccess: `
    SELECT 1 FROM practitioner_clients pc
    JOIN practitioners p ON p.id = pc.practitioner_id
    WHERE p.user_id = $1 AND pc.client_user_id = $2
    LIMIT 1
  `,

  // Transit Snapshots
  saveTransitSnapshot: `
    INSERT INTO transit_snapshots (snapshot_date, positions_json)
    VALUES ($1, $2)
    ON CONFLICT (snapshot_date) DO UPDATE
    SET positions_json = EXCLUDED.positions_json
    RETURNING id
  `,

  getTransitSnapshot: `
    SELECT id, snapshot_date, positions_json, created_at
    FROM transit_snapshots
    WHERE snapshot_date = $1
  `,

  // Practitioners
  createPractitioner: `
    INSERT INTO practitioners (user_id, certified, tier)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, certified, tier, created_at
  `,

  getPractitionerByUserId: `
    SELECT id, user_id, certified, tier
    FROM practitioners WHERE user_id = $1
  `,

  countPractitionerClients: `
    SELECT COUNT(*) AS count FROM practitioner_clients
    WHERE practitioner_id = $1
  `,

  addClient: `
    INSERT INTO practitioner_clients (practitioner_id, client_user_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
  `,

  removeClient: `
    DELETE FROM practitioner_clients
    WHERE practitioner_id = $1 AND client_user_id = $2
  `,

  getPractitionerClients: `
    SELECT u.id, u.email, u.phone, u.birth_date, u.birth_time, u.birth_tz, u.birth_lat, u.birth_lng, u.created_at
    FROM users u
    JOIN practitioner_clients pc ON pc.client_user_id = u.id
    WHERE pc.practitioner_id = $1
  `,

  getPractitionerClientsWithCharts: `
    SELECT
      u.id, u.email, u.phone, u.birth_date, u.created_at AS joined_at,
      pc.created_at AS added_at,
      c.id AS chart_id, c.calculated_at AS chart_date
    FROM users u
    JOIN practitioner_clients pc ON pc.client_user_id = u.id
    LEFT JOIN LATERAL (
      SELECT id, calculated_at FROM charts
      WHERE user_id = u.id
      ORDER BY calculated_at DESC LIMIT 1
    ) c ON true
    WHERE pc.practitioner_id = $1
    ORDER BY pc.created_at DESC
  `,

  // Clusters
  createCluster: `
    INSERT INTO clusters (name, created_by, challenge)
    VALUES ($1, $2, $3)
    RETURNING id, created_at
  `,

  addClusterMember: `
    INSERT INTO cluster_members (cluster_id, user_id, forge_role, birth_date, birth_time, birth_timezone, birth_lat, birth_lng)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (cluster_id, user_id) DO UPDATE SET
      forge_role      = EXCLUDED.forge_role,
      birth_date      = EXCLUDED.birth_date,
      birth_time      = EXCLUDED.birth_time,
      birth_timezone  = EXCLUDED.birth_timezone,
      birth_lat       = EXCLUDED.birth_lat,
      birth_lng       = EXCLUDED.birth_lng
  `,

  getClusterMembers: `
    SELECT u.id, u.email, cm.forge_role,
           cm.birth_date, cm.birth_time, cm.birth_timezone, cm.birth_lat, cm.birth_lng
    FROM users u
    JOIN cluster_members cm ON cm.user_id = u.id
    WHERE cm.cluster_id = $1
  `,

  getClustersByUser: `
    SELECT c.id, c.name, c.created_by, c.challenge, c.created_at
    FROM clusters c
    JOIN cluster_members cm ON cm.cluster_id = c.id
    WHERE cm.user_id = $1
  `,

  // SMS
  getOptedInUsers: `
    SELECT id, phone, birth_date, birth_time, birth_tz, birth_lat, birth_lng
    FROM users
    WHERE sms_opted_in = true AND phone IS NOT NULL
  `,

  setSmsPref: `
    UPDATE users SET sms_opted_in = $2 WHERE phone = $1
    RETURNING id, sms_opted_in
  `,

  logSmsMessage: `
    INSERT INTO sms_messages (user_id, direction, body)
    VALUES ($1, $2, $3)
    RETURNING id
  `,

  // Behavioral Validation
  saveValidationData: `
    INSERT INTO validation_data (user_id, decision_pattern, energy_pattern, current_focus)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id) DO UPDATE SET
      decision_pattern = EXCLUDED.decision_pattern,
      energy_pattern = EXCLUDED.energy_pattern,
      current_focus = EXCLUDED.current_focus,
      updated_at = now()
    RETURNING id, created_at, updated_at
  `,

  getValidationData: `
    SELECT id, user_id, decision_pattern, energy_pattern, current_focus, created_at, updated_at
    FROM validation_data WHERE user_id = $1
  `,

  // Psychometric Assessments
  savePsychometricData: `
    INSERT INTO psychometric_data (user_id, big_five_scores, via_strengths)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id) DO UPDATE SET
      big_five_scores = EXCLUDED.big_five_scores,
      via_strengths = EXCLUDED.via_strengths,
      updated_at = now()
    RETURNING id, completed_at, updated_at
  `,

  getPsychometricData: `
    SELECT id, user_id, big_five_scores, via_strengths, completed_at, updated_at
    FROM psychometric_data WHERE user_id = $1
  `,

  // Diary Entries
  createDiaryEntry: `
    INSERT INTO diary_entries (user_id, event_date, event_title, event_description, event_type, significance, transit_snapshot)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, created_at
  `,

  updateDiaryEntry: `
    UPDATE diary_entries
    SET event_date = $2,
        event_title = $3,
        event_description = $4,
        event_type = $5,
        significance = $6,
        updated_at = now()
    WHERE id = $1 AND user_id = $7
    RETURNING id, updated_at
  `,

  deleteDiaryEntry: `
    DELETE FROM diary_entries
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `,

  getDiaryEntries: `
    SELECT id, user_id, event_date, event_title, event_description, event_type, significance, transit_snapshot, created_at, updated_at
    FROM diary_entries
    WHERE user_id = $1
    ORDER BY event_date DESC, created_at DESC
    LIMIT $2 OFFSET $3
  `,

  getDiaryEntry: `
    SELECT id, user_id, event_date, event_title, event_description, event_type, significance, transit_snapshot, created_at, updated_at
    FROM diary_entries
    WHERE id = $1 AND user_id = $2
  `,

  getDiaryEntriesInRange: `
    SELECT id, user_id, event_date, event_title, event_description, event_type, significance, transit_snapshot, created_at, updated_at
    FROM diary_entries
    WHERE user_id = $1
      AND event_date >= $2
      AND event_date <= $3
    ORDER BY event_date DESC
  `,

  // ─── Subscriptions ────────────────────────────────────────

  createSubscription: `
    INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, tier, status, current_period_start, current_period_end)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, created_at
  `,

  // BL-FIX: UPSERT subscription to handle checkout.session.completed when no row exists
  upsertSubscription: `
    INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, tier, status, current_period_start, current_period_end, cancel_at_period_end)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      tier = EXCLUDED.tier,
      status = EXCLUDED.status,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      updated_at = NOW()
    RETURNING id, created_at, updated_at
  `,

  getSubscriptionByUserId: `
    SELECT id, user_id, stripe_customer_id, stripe_subscription_id, tier, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at
    FROM subscriptions WHERE user_id = $1
  `,

  getSubscriptionByStripeCustomerId: `
    SELECT id, user_id, stripe_customer_id, stripe_subscription_id, tier, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at
    FROM subscriptions WHERE stripe_customer_id = $1
  `,

  getSubscriptionByStripeSubscriptionId: `
    SELECT id, user_id, stripe_customer_id, stripe_subscription_id, tier, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at
    FROM subscriptions WHERE stripe_subscription_id = $1
  `,

  updateSubscription: `
    UPDATE subscriptions
    SET stripe_subscription_id = $2,
        tier = $3,
        status = $4,
        current_period_start = $5,
        current_period_end = $6,
        cancel_at_period_end = $7,
        updated_at = now()
    WHERE user_id = $1
    RETURNING id, updated_at
  `,

  updateSubscriptionStatus: `
    UPDATE subscriptions
    SET status = $2,
        updated_at = now()
    WHERE stripe_subscription_id = $1
    RETURNING id, updated_at
  `,

  // ─── Payment Events ───────────────────────────────────────

  createPaymentEvent: `
    INSERT INTO payment_events (subscription_id, stripe_event_id, event_type, amount, currency, status, failure_reason, raw_event)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, created_at
  `,

  getPaymentEventsBySubscription: `
    SELECT id, subscription_id, stripe_event_id, event_type, amount, currency, status, failure_reason, raw_event, created_at
    FROM payment_events
    WHERE subscription_id = $1
    ORDER BY created_at DESC
  `,

  checkEventProcessed: `
    SELECT id FROM payment_events WHERE stripe_event_id = $1
  `,

  // ─── Usage Tracking ───────────────────────────────────────

  createUsageRecord: `
    INSERT INTO usage_records (user_id, action, endpoint, quota_cost)
    VALUES ($1, $2, $3, $4)
    RETURNING id, created_at
  `,

  getUsageByUserAndAction: `
    SELECT COUNT(*) as count, SUM(quota_cost) as total_cost
    FROM usage_records
    WHERE user_id = $1
      AND action = $2
      AND created_at >= $3
  `,

  getUsageByUserInPeriod: `
    SELECT action, COUNT(*) as count, SUM(quota_cost) as total_cost
    FROM usage_records
    WHERE user_id = $1
      AND created_at >= $2
      AND created_at <= $3
    GROUP BY action
    ORDER BY total_cost DESC
  `,

  // ─── Achievements ─────────────────────────────────────────

  getUserUnlockedAchievements: `
    SELECT achievement_id, unlocked_at, points_awarded
    FROM user_achievements
    WHERE user_id = $1
    ORDER BY unlocked_at DESC
  `,

  getAchievementEventCounts: `
    SELECT event_type, COUNT(*)::int as count
    FROM achievement_events
    WHERE user_id = $1
    GROUP BY event_type
  `,

  getUserStreaks: `
    SELECT streak_type, current_streak
    FROM user_streaks
    WHERE user_id = $1
  `,

  getUserStreaksFull: `
    SELECT streak_type, current_streak, longest_streak, last_activity_date
    FROM user_streaks
    WHERE user_id = $1
  `,

  getUserAchievementStats: `
    SELECT total_points FROM user_achievement_stats WHERE user_id = $1
  `,

  getUserAchievementStatsFull: `
    SELECT user_id, total_points, total_achievements, achievement_percentage, last_achievement_date, updated_at
    FROM user_achievement_stats WHERE user_id = $1
  `,

  getLeaderboard: `
    SELECT 
      u.id as user_id, u.email, u.tier,
      uas.total_points, uas.total_achievements, uas.achievement_percentage,
      uas.last_achievement_date,
      ROW_NUMBER() OVER (ORDER BY uas.total_points DESC, uas.total_achievements DESC) as rank
    FROM users u
    JOIN user_achievement_stats uas ON u.id = uas.user_id
    WHERE uas.total_points > 0
    ORDER BY uas.total_points DESC, uas.total_achievements DESC
    LIMIT $1 OFFSET $2
  `,

  getUserRank: `
    SELECT 
      user_id, total_points, total_achievements, achievement_percentage,
      (SELECT COUNT(*)::int + 1 FROM user_achievement_stats
       WHERE total_points > (SELECT total_points FROM user_achievement_stats WHERE user_id = $1)
      ) as rank
    FROM user_achievement_stats
    WHERE user_id = $1
  `,

  insertAchievementEvent: `
    INSERT INTO achievement_events (user_id, event_type, event_data)
    VALUES ($1, $2, $3)
  `,

  getUserUnlockedIds: `
    SELECT achievement_id FROM user_achievements WHERE user_id = $1
  `,

  insertUserAchievement: `
    INSERT INTO user_achievements (user_id, achievement_id, points_awarded)
    VALUES ($1, $2, $3)
  `,

  checkAchievementUnlocked: `
    SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2
  `,

  getStreakByType: `
    SELECT id, user_id, streak_type, current_streak, longest_streak, last_activity_date, created_at, updated_at
    FROM user_streaks WHERE user_id = $1 AND streak_type = $2
  `,

  insertStreak: `
    INSERT INTO user_streaks (user_id, streak_type, current_streak, longest_streak, last_activity_date)
    VALUES ($1, $2, 1, 1, $3)
  `,

  updateStreakIncrement: `
    UPDATE user_streaks
    SET current_streak = $1, longest_streak = $2, last_activity_date = $3
    WHERE id = $4
  `,

  resetStreak: `
    UPDATE user_streaks
    SET current_streak = 1, last_activity_date = $1
    WHERE id = $2
  `,

  // ─── Transit Alerts ───────────────────────────────────────

  listUserAlerts: `
    SELECT 
      id, alert_type, config, name, description, active, 
      notify_push, notify_webhook, created_at,
      (SELECT COUNT(*)::int FROM alert_deliveries WHERE alert_id = transit_alerts.id) as trigger_count,
      (SELECT MAX(triggered_at) FROM alert_deliveries WHERE alert_id = transit_alerts.id) as last_triggered
    FROM transit_alerts
    WHERE user_id = $1
    ORDER BY created_at DESC
  `,

  countUserAlerts: `
    SELECT COUNT(*)::int as count FROM transit_alerts WHERE user_id = $1
  `,

  insertAlert: `
    INSERT INTO transit_alerts (
      user_id, alert_type, config, name, description,
      notify_push, notify_webhook, active
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, true)
    RETURNING id, alert_type, config, name, description,
              notify_push, notify_webhook, active, created_at
  `,

  getAlertById: `
    SELECT id, user_id, alert_type, config, name, description, active, notify_push, notify_webhook, created_at, updated_at
    FROM transit_alerts WHERE id = $1 AND user_id = $2
  `,

  deleteAlert: `
    DELETE FROM transit_alerts WHERE id = $1 AND user_id = $2
    RETURNING id
  `,

  getUserActiveAlerts: `
    SELECT id, user_id, alert_type, config, name, description, active, notify_push, notify_webhook, created_at, updated_at
    FROM transit_alerts WHERE user_id = $1 AND active = true
  `,

  checkAlertDeliveredToday: `
    SELECT id FROM alert_deliveries
    WHERE alert_id = $1 AND trigger_date = $2
  `,

  insertAlertDelivery: `
    INSERT INTO alert_deliveries (
      alert_id, user_id, trigger_date, alert_type, config, transit_data
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `,

  markAlertDeliveryPush: `
    UPDATE alert_deliveries SET push_sent = true, push_sent_at = NOW()
    WHERE id = $1
  `,

  markAlertDeliveryWebhook: `
    UPDATE alert_deliveries SET webhook_sent = true, webhook_sent_at = NOW()
    WHERE id = $1
  `,

  getAlertDeliveryHistory: `
    SELECT 
      ad.id, ad.triggered_at, ad.trigger_date, ad.alert_type,
      ad.config, ad.transit_data, ad.push_sent, ad.webhook_sent,
      ta.name as alert_name
    FROM alert_deliveries ad
    LEFT JOIN transit_alerts ta ON ad.alert_id = ta.id
    WHERE ad.user_id = $1
    ORDER BY ad.triggered_at DESC
    LIMIT $2 OFFSET $3
  `,

  countAlertDeliveries: `
    SELECT COUNT(*)::int as count FROM alert_deliveries WHERE user_id = $1
  `,

  getAlertTemplates: `
    SELECT id, name, description, category, alert_type, config_template, recommended_for, tier_required, popularity, active, created_at
    FROM alert_templates
    WHERE active = true
      AND (tier_required = 'free' OR tier_required = $1)
    ORDER BY popularity DESC, category
  `,

  getAlertTemplateById: `
    SELECT id, name, description, category, alert_type, config_template, recommended_for, tier_required, popularity, active, created_at
    FROM alert_templates WHERE id = $1 AND active = true
  `,

  incrementTemplatePopularity: `
    UPDATE alert_templates SET popularity = popularity + 1 WHERE id = $1
  `,

  // ─── Push Notifications ───────────────────────────────────

  getPushSubscriptionByEndpoint: `
    SELECT id FROM push_subscriptions WHERE endpoint = $1
  `,

  updatePushSubscriptionLastUsed: `
    UPDATE push_subscriptions SET last_used = NOW(), updated_at = NOW()
    WHERE endpoint = $1
  `,

  insertPushSubscription: `
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, active)
    VALUES ($1, $2, $3, $4, $5, true)
    RETURNING id, endpoint, active, subscription_time
  `,

  getNotificationPrefsById: `
    SELECT user_id FROM notification_preferences WHERE user_id = $1
  `,

  insertDefaultNotificationPrefs: `
    INSERT INTO notification_preferences (user_id) VALUES ($1)
  `,

  deletePushSubscription: `
    DELETE FROM push_subscriptions
    WHERE user_id = $1 AND endpoint = $2
    RETURNING id
  `,

  getActivePushSubscriptions: `
    SELECT id, endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_id = $1 AND active = true
  `,

  getNotificationPreferences: `
    SELECT user_id, transit_daily, gate_activation, cycle_approaching, transit_alert, weekly_digest,
           quiet_hours_start, quiet_hours_end, timezone, daily_digest_time, weekly_digest_day, created_at, updated_at
    FROM notification_preferences WHERE user_id = $1
  `,

  deactivatePushSubscription: `
    UPDATE push_subscriptions SET active = false WHERE id = $1
  `,

  insertPushNotification: `
    INSERT INTO push_notifications (
      subscription_id, user_id, notification_type, title, body,
      response_status, response_body, success
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `,

  insertPushNotificationFull: `
    INSERT INTO push_notifications (
      subscription_id, user_id, notification_type, title, body, icon, badge, tag,
      data, response_status, response_body, success
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `,

  getPushNotificationHistory: `
    SELECT id, notification_type, title, body, sent_at, success
    FROM push_notifications
    WHERE user_id = $1
    ORDER BY sent_at DESC
    LIMIT $2 OFFSET $3
  `,

  countPushNotifications: `
    SELECT COUNT(*)::int as count FROM push_notifications WHERE user_id = $1
  `,

  getActivePushSubscriptionsFull: `
    SELECT id, user_id, endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_id = $1 AND active = true
  `,

  // ─── Referrals ────────────────────────────────────────────

  getUserByReferralCode: `
    SELECT id FROM users WHERE referral_code = $1
  `,

  setUserReferralCode: `
    UPDATE users SET referral_code = $1, updated_at = NOW() WHERE id = $2
  `,

  countReferrals: `
    SELECT COUNT(*)::int as count FROM referrals WHERE referrer_user_id = $1
  `,

  countConvertedReferrals: `
    SELECT COUNT(*)::int as count
    FROM referrals
    WHERE referrer_user_id = $1 AND converted = true
  `,

  getReferralRewardStats: `
    SELECT 
      COUNT(*)::int as rewards_count,
      COALESCE(SUM(reward_value), 0)::int as total_value
    FROM referrals
    WHERE referrer_user_id = $1 AND reward_granted = true
  `,

  countPendingReferralRewards: `
    SELECT COUNT(*)::int as count
    FROM referrals
    WHERE referrer_user_id = $1 AND converted = true AND reward_granted = false
  `,

  getRecentReferrals: `
    SELECT 
      r.id, u.email as referred_email, r.converted, r.conversion_date,
      r.reward_granted, r.reward_type, r.reward_value, r.created_at
    FROM referrals r
    JOIN users u ON r.referred_user_id = u.id
    WHERE r.referrer_user_id = $1
    ORDER BY r.created_at DESC
    LIMIT 10
  `,

  getReferralHistory: `
    SELECT 
      r.id, u.email as referred_email, r.referral_code, r.converted,
      r.conversion_date, r.reward_granted, r.reward_type, r.reward_value, r.created_at
    FROM referrals r
    JOIN users u ON r.referred_user_id = u.id
    WHERE r.referrer_user_id = $1
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3
  `,

  validateReferralCode: `
    SELECT id, email, referral_code FROM users WHERE referral_code = $1
  `,

  checkExistingReferral: `
    SELECT id FROM referrals WHERE referred_user_id = $1
  `,

  insertReferral: `
    INSERT INTO referrals (
      referrer_user_id, referred_user_id, referral_code, converted, reward_granted
    ) VALUES ($1, $2, $3, false, false)
  `,

  getPendingReferralRewards: `
    SELECT 
      r.id, u.email as referred_email, r.conversion_date,
      'free_month' as reward_type, 1500 as reward_value
    FROM referrals r
    JOIN users u ON r.referred_user_id = u.id
    WHERE r.referrer_user_id = $1 AND r.converted = true AND r.reward_granted = false
    ORDER BY r.conversion_date DESC
  `,

  getReferralById: `
    SELECT id, referrer_user_id, referred_user_id, referral_code, converted, conversion_date, reward_granted, reward_type, reward_value, created_at, updated_at
    FROM referrals WHERE id = $1 AND referrer_user_id = $2
  `,

  claimReferralReward: `
    UPDATE referrals 
    SET reward_granted = true, reward_type = 'free_month', reward_value = 1500, updated_at = NOW()
    WHERE id = $1
  `,

  getUserStripeCustomerId: `
    SELECT stripe_customer_id FROM users WHERE id = $1
  `,

  getUnconvertedReferral: `
    SELECT id, referrer_user_id
    FROM referrals
    WHERE referred_user_id = $1 AND converted = false
  `,

  markReferralConverted: `
    UPDATE referrals
    SET converted = true, conversion_date = NOW(), updated_at = NOW()
    WHERE id = $1
  `,

  // ─── Billing ──────────────────────────────────────────────

  updateUserStripeCustomerId: `
    UPDATE users SET stripe_customer_id = $1 WHERE id = $2
  `,

  getActiveSubscription: `
    SELECT id, user_id, stripe_customer_id, stripe_subscription_id, tier, status,
           current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at
    FROM subscriptions
    WHERE user_id = $1 AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `,

  updateSubscriptionStatus2: `
    UPDATE subscriptions 
    SET status = $1, updated_at = NOW()
    WHERE id = $2
  `,

  updateSubscriptionCancellation: `
    UPDATE subscriptions 
    SET status = $1, cancel_at_period_end = $2, updated_at = NOW()
    WHERE id = $3
  `,

  updateUserTier: `
    UPDATE users SET tier = $1, updated_at = NOW() WHERE id = $2
  `,

  updateSubscriptionTier: `
    UPDATE subscriptions SET tier = $1, updated_at = NOW() WHERE id = $2
  `,

  insertCheckoutSubscription: `
    INSERT INTO subscriptions (
      user_id, tier, stripe_subscription_id, stripe_customer_id,
      status, current_period_start, current_period_end,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 'active', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW())
  `,

  updateUserTierAndStripe: `
    UPDATE users 
    SET tier = $1, stripe_customer_id = $2, updated_at = NOW()
    WHERE id = $3
  `,

  updateSubscriptionPeriod: `
    UPDATE subscriptions 
    SET status = $1, current_period_end = $2, cancel_at_period_end = $3, updated_at = NOW()
    WHERE stripe_subscription_id = $4
  `,

  getSubscriptionUserByStripeId: `
    SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1
  `,

  cancelSubscriptionByStripeId: `
    UPDATE subscriptions SET status = 'canceled', updated_at = NOW()
    WHERE stripe_subscription_id = $1
  `,

  insertInvoicePaid: `
    INSERT INTO invoices (subscription_id, stripe_invoice_id, amount_paid, status, paid_at, created_at)
    SELECT id, $1, $2, 'paid', NOW(), NOW()
    FROM subscriptions WHERE stripe_subscription_id = $3
  `,

  insertInvoiceFailed: `
    INSERT INTO invoices (subscription_id, stripe_invoice_id, amount_paid, status, created_at)
    SELECT id, $1, 0, 'failed', NOW()
    FROM subscriptions WHERE stripe_subscription_id = $2
  `,

  // ─── Notion Integration ───────────────────────────────────

  insertOAuthState: `
    INSERT INTO oauth_states (user_id, provider, state, expires_at)
    VALUES ($1, 'notion', $2, $3)
  `,

  verifyOAuthState: `
    SELECT user_id, expires_at FROM oauth_states
    WHERE provider = 'notion' AND state = $1 AND expires_at > NOW()
  `,

  deleteOAuthState: `
    DELETE FROM oauth_states WHERE provider = 'notion' AND state = $1
  `,

  upsertNotionConnection: `
    INSERT INTO notion_connections (user_id, access_token, workspace_id, workspace_name, bot_id, owner_type, owner_user_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = excluded.access_token,
      workspace_id = excluded.workspace_id,
      workspace_name = excluded.workspace_name,
      bot_id = excluded.bot_id,
      owner_type = excluded.owner_type,
      owner_user_id = excluded.owner_user_id,
      updated_at = NOW()
  `,

  getNotionConnection: `
    SELECT workspace_id, workspace_name, created_at, updated_at
    FROM notion_connections WHERE user_id = $1
  `,

  getNotionAccessToken: `
    SELECT access_token, workspace_id FROM notion_connections WHERE user_id = $1
  `,

  getNotionSyncRecord: `
    SELECT notion_database_id FROM notion_syncs
    WHERE user_id = $1 AND sync_type = 'clients'
  `,

  insertNotionSync: `
    INSERT INTO notion_syncs (user_id, sync_type, notion_database_id, created_at)
    VALUES ($1, 'clients', $2, NOW())
  `,

  updateNotionSyncTime: `
    UPDATE notion_syncs SET last_synced_at = NOW()
    WHERE user_id = $1 AND sync_type = 'clients'
  `,

  getNotionExportProfile: `
    SELECT p.profile_json, c.hd_json, u.email
    FROM profiles p
    JOIN charts c ON p.chart_id = c.id
    JOIN users u ON p.user_id = u.id
    WHERE p.id = $1 AND p.user_id = $2
  `,

  getNotionAccessTokenOnly: `
    SELECT access_token FROM notion_connections WHERE user_id = $1
  `,

  deleteNotionConnection: `
    DELETE FROM notion_connections WHERE user_id = $1
  `,

  deleteNotionSyncs: `
    DELETE FROM notion_syncs WHERE user_id = $1
  `,

  getPractitionerClients2: `
    SELECT 
      pc.client_user_id, u.email, u.birth_date, u.created_at as joined_at,
      c.id as chart_id, c.hd_json
    FROM practitioner_clients pc
    JOIN users u ON pc.client_user_id = u.id
    LEFT JOIN charts c ON c.user_id = u.id
    WHERE pc.practitioner_id = $1
    ORDER BY c.calculated_at DESC
  `,

  // ─── Webhooks Management ──────────────────────────────────

  insertWebhook: `
    INSERT INTO webhooks (user_id, url, events, secret, active)
    VALUES ($1, $2, $3, $4, true)
    RETURNING id, url, events, secret, active, created_at
  `,

  listWebhooks: `
    SELECT id, url, events, active, created_at,
           (SELECT COUNT(*)::int FROM webhook_deliveries WHERE webhook_id = webhooks.id) as delivery_count,
           (SELECT COUNT(*)::int FROM webhook_deliveries 
            WHERE webhook_id = webhooks.id AND response_status >= 200 AND response_status < 300) as successful_count
    FROM webhooks
    WHERE user_id = $1
    ORDER BY created_at DESC
  `,

  getWebhookById: `
    SELECT id, url, events, secret, active, created_at
    FROM webhooks WHERE id = $1 AND user_id = $2
  `,

  deleteWebhook: `
    DELETE FROM webhooks WHERE id = $1 AND user_id = $2
    RETURNING id
  `,

  getWebhookForTest: `
    SELECT id, url, events, secret
    FROM webhooks WHERE id = $1 AND user_id = $2
  `,

  checkWebhookOwnership: `
    SELECT id FROM webhooks WHERE id = $1 AND user_id = $2
  `,

  getWebhookDeliveries: `
    SELECT id, event_type, response_status, delivered_at, attempts, created_at
    FROM webhook_deliveries
    WHERE webhook_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `,

  countWebhookDeliveries: `
    SELECT COUNT(*)::int as count FROM webhook_deliveries WHERE webhook_id = $1
  `,

  // ─── API Keys ─────────────────────────────────────────────

  countActiveApiKeys: `
    SELECT COUNT(*)::int as count FROM api_keys WHERE user_id = $1 AND active = true
  `,

  listApiKeys: `
    SELECT 
      k.id, k.name, k.scopes, k.tier,
      k.rate_limit_per_hour, k.rate_limit_per_day,
      k.active, k.expires_at, k.last_used_at, k.created_at,
      COUNT(u.id)::int as total_requests,
      COUNT(CASE WHEN u.created_at > NOW() - INTERVAL '1 day' THEN 1 END)::int as requests_today,
      COUNT(CASE WHEN u.response_status >= 400 THEN 1 END)::int as error_count
    FROM api_keys k
    LEFT JOIN api_usage u ON k.id = u.key_id
    WHERE k.user_id = $1
    GROUP BY k.id
    ORDER BY k.created_at DESC
  `,

  getApiKeyById: `
    SELECT 
      id, name, scopes, tier,
      rate_limit_per_hour, rate_limit_per_day,
      active, expires_at, last_used_at, created_at
    FROM api_keys WHERE id = $1 AND user_id = $2
  `,

  checkApiKeyOwnership: `
    SELECT id FROM api_keys WHERE id = $1 AND user_id = $2
  `,

  deactivateApiKey: `
    UPDATE api_keys SET active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1
  `,

  getApiKeyForUsage: `
    SELECT id, name, tier, rate_limit_per_day
    FROM api_keys WHERE id = $1 AND user_id = $2
  `,

  getApiKeyUsageStats: `
    SELECT 
      COUNT(*)::int as total_requests,
      COUNT(CASE WHEN response_status >= 400 THEN 1 END)::int as error_count,
      COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END)::int as requests_last_hour,
      COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 day' THEN 1 END)::int as requests_last_day,
      AVG(response_time_ms) as avg_response_time,
      MAX(created_at) as last_request_at
    FROM api_usage
    WHERE key_id = $1 AND created_at > NOW() - ($2 * INTERVAL '1 day')
  `,

  getApiKeyTopEndpoints: `
    SELECT endpoint, COUNT(*)::int as count
    FROM api_usage
    WHERE key_id = $1 AND created_at > NOW() - ($2 * INTERVAL '1 day')
    GROUP BY endpoint
    ORDER BY count DESC
    LIMIT 10
  `,

  getApiKeyDailyUsage: `
    SELECT 
      created_at::date as date,
      COUNT(*)::int as requests,
      COUNT(CASE WHEN response_status >= 400 THEN 1 END)::int as errors
    FROM api_usage
    WHERE key_id = $1 AND created_at > NOW() - ($2 * INTERVAL '1 day')
    GROUP BY created_at::date
    ORDER BY date DESC
  `,

  // ─── Daily Check-ins ──────────────────────────────────────

  upsertCheckin: `
    INSERT INTO daily_checkins (
      user_id, checkin_date, alignment_score, followed_strategy, followed_authority,
      notes, mood, energy_level, transit_snapshot
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (user_id, checkin_date) DO UPDATE SET
      alignment_score = EXCLUDED.alignment_score,
      followed_strategy = EXCLUDED.followed_strategy,
      followed_authority = EXCLUDED.followed_authority,
      notes = EXCLUDED.notes,
      mood = EXCLUDED.mood,
      energy_level = EXCLUDED.energy_level,
      transit_snapshot = EXCLUDED.transit_snapshot,
      updated_at = NOW()
    RETURNING id, user_id, checkin_date, alignment_score, followed_strategy, followed_authority, notes, mood, energy_level, transit_snapshot, created_at, updated_at
  `,

  getCheckinByDate: `
    SELECT id, user_id, checkin_date, alignment_score, followed_strategy, followed_authority, notes, mood, energy_level, transit_snapshot, created_at, updated_at
    FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2
  `,

  getCheckinHistory: `
    SELECT id, user_id, checkin_date, alignment_score, followed_strategy, followed_authority, notes, mood, energy_level, transit_snapshot, created_at, updated_at
    FROM daily_checkins
    WHERE user_id = $1
    ORDER BY checkin_date DESC
    LIMIT $2 OFFSET $3
  `,

  countCheckins: `
    SELECT COUNT(*)::int as total FROM daily_checkins WHERE user_id = $1
  `,

  getCheckinStatsForPeriod: `
    SELECT 
      alignment_score, followed_strategy, followed_authority,
      mood, energy_level, checkin_date
    FROM daily_checkins
    WHERE user_id = $1 AND checkin_date >= $2
    ORDER BY checkin_date ASC
  `,

  getCheckinStreak: `
    SELECT current_streak, last_checkin_date, streak_start_date
    FROM get_user_streak($1)
  `,

  getCheckinDatesOrdered: `
    SELECT checkin_date FROM daily_checkins
    WHERE user_id = $1 ORDER BY checkin_date ASC
  `,

  upsertCheckinReminder: `
    INSERT INTO checkin_reminders (user_id, enabled, reminder_time, timezone, notification_method)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      reminder_time = EXCLUDED.reminder_time,
      timezone = EXCLUDED.timezone,
      notification_method = EXCLUDED.notification_method,
      updated_at = NOW()
    RETURNING id, user_id, enabled, reminder_time, timezone, notification_method, last_sent_at, created_at, updated_at
  `,

  getCheckinReminder: `
    SELECT id, user_id, enabled, reminder_time, timezone, notification_method, last_sent_at, created_at, updated_at
    FROM checkin_reminders WHERE user_id = $1
  `,

  // ─── Share Events ─────────────────────────────────────────

  insertShareEvent: `
    INSERT INTO share_events (user_id, share_type, share_data, platform)
    VALUES ($1, $2, $3, $4)
  `,

  getSharesByType: `
    SELECT share_type, COUNT(*)::int as count
    FROM share_events WHERE user_id = $1
    GROUP BY share_type
  `,

  getRecentShares: `
    SELECT share_type, platform, created_at
    FROM share_events WHERE user_id = $1
    ORDER BY created_at DESC LIMIT 10
  `,

  // ─── Stats ────────────────────────────────────────────────

  getWeeklyActiveUsers: `
    SELECT COUNT(DISTINCT user_id) as count
    FROM analytics_events
    WHERE event_name = 'chart_calculate'
      AND created_at >= NOW() - INTERVAL '7 days'
  `,

  // BL-FIX: profiles table has no status column — count all profiles
  getTotalProfiles: `
    SELECT COUNT(*) as count FROM profiles
  `,

  getTotalCharts: `
    SELECT COUNT(*) as count FROM charts
  `,

  getStatsLeaderboard: `
    SELECT u.email, uas.total_points, uas.total_achievements
    FROM user_achievement_stats uas
    JOIN users u ON u.id = uas.user_id
    ORDER BY uas.total_points DESC
    LIMIT 10
  `,

  // ─── Famous/Celebrity ─────────────────────────────────────

  getUserChartWithBirthData: `
    SELECT c.id, c.hd_json, c.calculated_at,
           u.birth_date, u.birth_time, u.birth_tz, u.birth_lat, u.birth_lng
    FROM charts c
    JOIN users u ON u.id = c.user_id
    WHERE c.user_id = $1
    ORDER BY c.calculated_at DESC
    LIMIT 1
  `,

  // ─── Analytics Dashboard ──────────────────────────────────

  getAnalyticsActiveUsers: `
    SELECT
      COUNT(DISTINCT CASE WHEN created_at >= CURRENT_DATE THEN user_id END) AS dau,
      COUNT(DISTINCT CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN user_id END) AS wau,
      COUNT(DISTINCT CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN user_id END) AS mau
    FROM analytics_events
    WHERE user_id IS NOT NULL
  `,
  getAnalyticsEventsToday: `
    SELECT COUNT(*) AS count
    FROM analytics_events
    WHERE created_at >= CURRENT_DATE
  `,
  getAnalyticsSignupComparison: `
    SELECT
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS this_week,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '14 days'
                       AND created_at < CURRENT_DATE - INTERVAL '7 days') AS last_week
    FROM analytics_events
    WHERE event_name = 'signup'
  `,
  getAnalyticsTopEvents: `
    SELECT event_name, COUNT(*) AS count, COUNT(DISTINCT user_id) AS unique_users
    FROM analytics_events
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY event_name
    ORDER BY count DESC
    LIMIT 15
  `,
  getAnalyticsFunnelSteps: `
    SELECT
      step_name,
      step_order,
      COUNT(DISTINCT user_id) AS users
    FROM funnel_events
    WHERE funnel_name = $1
    GROUP BY step_name, step_order
    ORDER BY step_order ASC
  `,
  getAnalyticsRetention: `
    WITH cohorts AS (
      SELECT
        user_id,
        DATE_TRUNC('week', MIN(created_at)) AS cohort_week
      FROM analytics_events
      WHERE event_name = 'signup' AND user_id IS NOT NULL
      GROUP BY user_id
    ),
    activity AS (
      SELECT DISTINCT
        c.user_id,
        c.cohort_week,
        DATE_TRUNC('week', ae.created_at) AS activity_week
      FROM cohorts c
      JOIN analytics_events ae ON ae.user_id = c.user_id
      WHERE ae.created_at >= c.cohort_week
        AND ae.created_at < c.cohort_week + ($1 * INTERVAL '1 week')
    )
    SELECT
      cohort_week,
      EXTRACT(WEEK FROM activity_week - cohort_week)::INT AS week_offset,
      COUNT(DISTINCT user_id) AS active_users
    FROM activity
    GROUP BY cohort_week, week_offset
    ORDER BY cohort_week DESC, week_offset ASC
  `,
  getAnalyticsErrorRate: `
    SELECT
      COUNT(*) FILTER (WHERE event_name = 'error') AS errors,
      COUNT(*) AS total,
      ROUND(COUNT(*) FILTER (WHERE event_name = 'error') * 100.0 / GREATEST(COUNT(*), 1), 2) AS error_rate_pct
    FROM analytics_events
    WHERE created_at >= CURRENT_DATE - ($1 * INTERVAL '1 day')
  `,
  getAnalyticsTopErrors: `
    SELECT
      properties->>'message' AS error_message,
      properties->>'endpoint' AS endpoint,
      properties->>'severity' AS severity,
      COUNT(*) AS count
    FROM analytics_events
    WHERE event_name = 'error'
      AND created_at >= CURRENT_DATE - ($1 * INTERVAL '1 day')
    GROUP BY properties->>'message', properties->>'endpoint', properties->>'severity'
    ORDER BY count DESC
    LIMIT 20
  `,
  getAnalyticsErrorTrend: `
    SELECT
      DATE(created_at) AS date,
      COUNT(*) AS count
    FROM analytics_events
    WHERE event_name = 'error'
      AND created_at >= CURRENT_DATE - ($1 * INTERVAL '1 day')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `,
  getAnalyticsMrr: `
    SELECT
      COUNT(*) FILTER (WHERE tier = 'seeker' AND status = 'active') AS seeker_count,
      COUNT(*) FILTER (WHERE tier = 'guide' AND status = 'active') AS guide_count,
      COUNT(*) FILTER (WHERE tier = 'practitioner' AND status = 'active') AS practitioner_count,
      COUNT(*) FILTER (WHERE status = 'active') AS total_active,
      COUNT(*) FILTER (WHERE status = 'canceled' AND updated_at >= CURRENT_DATE - INTERVAL '30 days') AS recent_churn
    FROM subscriptions
  `,
  getAnalyticsTierDistribution: `
    SELECT tier, COUNT(*) AS count
    FROM users
    GROUP BY tier
    ORDER BY count DESC
  `,
  getAnalyticsMonthlyChurn: `
    SELECT
      DATE_TRUNC('month', updated_at) AS month,
      COUNT(*) AS churned_count
    FROM subscriptions
    WHERE status = 'canceled'
      AND updated_at >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY DATE_TRUNC('month', updated_at)
    ORDER BY month DESC
  `,

  // ─── SMS ──────────────────────────────────────────────────

  smsOptOut: `UPDATE users SET sms_opted_in = false WHERE phone = $1`,
  smsOptIn: `UPDATE users SET sms_opted_in = true WHERE phone = $1`,
  getSmsSubscribedUsers: `SELECT id, phone, birth_date, birth_time, birth_tz, birth_lat, birth_lng FROM users WHERE sms_opted_in = true AND phone IS NOT NULL`,
  smsSubscribeByUserId: `UPDATE users SET phone = $1, sms_opted_in = true WHERE id = $2`,
  getUserPhone: `SELECT phone FROM users WHERE id = $1`,
  smsUnsubscribeByUserId: `UPDATE users SET sms_opted_in = false WHERE id = $1`,

  // ─── Clusters ─────────────────────────────────────────────

  listUserClusters: `
    SELECT c.id, c.name, c.challenge, c.created_at, cm.joined_at
    FROM cluster_members cm
    JOIN clusters c ON c.id = cm.cluster_id
    WHERE cm.user_id = $1
    ORDER BY cm.joined_at DESC
  `,
  leaveCluster: `
    DELETE FROM cluster_members
    WHERE cluster_id = $1 AND user_id = $2
    RETURNING cluster_id
  `,

  // ─── Chart History ────────────────────────────────────────

  getChartHistory: `
    SELECT id, calculated_at, hd_json::jsonb->'chart'->'type' as type
    FROM charts
    WHERE user_id = $1
    ORDER BY calculated_at DESC
    LIMIT 50
  `,

  // ─── Diary ────────────────────────────────────────────────

  getLatestChartWithAstro: `
    SELECT hd_json, astro_json FROM charts
    WHERE user_id = $1
    ORDER BY calculated_at DESC LIMIT 1
  `,

  // ─── Timing Engine ────────────────────────────────────────

  getChartWithBirthDataAndAstro: `
    SELECT c.id, c.hd_json, c.astro_json, c.calculated_at,
           u.birth_date, u.birth_time, u.birth_tz, u.birth_lat, u.birth_lng
    FROM charts c
    JOIN users u ON u.id = c.user_id
    WHERE c.user_id = $1
    ORDER BY c.calculated_at DESC
    LIMIT 1
  `,

  // ─── Cron Queries (BL-R-M20) ─────────────────────────────

  cronGetPushUsers: `
    SELECT DISTINCT u.id, u.birth_date
    FROM users u
    INNER JOIN push_subscriptions ps ON u.id = ps.user_id
    LEFT JOIN notification_preferences np ON u.id = np.user_id
    WHERE ps.active = true
      AND u.birth_date IS NOT NULL
      AND (np.transit_daily IS NULL OR np.transit_daily = true)
  `,

  cronGetAlertUsers: `
    SELECT DISTINCT u.id, u.birth_date
    FROM users u
    INNER JOIN transit_alerts ta ON u.id = ta.user_id
    WHERE ta.active = true AND u.birth_date IS NOT NULL
  `,

  // BL-FIX: charts table has no chart_type column — extract from hd_json JSONB
  cronGetWelcome2Users: `
    SELECT u.id, u.email, u.created_at,
           c.hd_json::jsonb->'chart'->>'type' AS chart_type
    FROM users u
    LEFT JOIN LATERAL (
      SELECT hd_json FROM charts WHERE user_id = u.id ORDER BY calculated_at DESC LIMIT 1
    ) c ON true
    WHERE u.created_at >= NOW() - INTERVAL '25 hours'
      AND u.created_at <= NOW() - INTERVAL '23 hours'
      AND u.email_verified != false
  `,

  // BL-FIX: charts table has no authority column — extract from hd_json JSONB
  cronGetWelcome3Users: `
    SELECT u.id, u.email, u.created_at,
           c.hd_json::jsonb->'chart'->>'authority' AS authority
    FROM users u
    LEFT JOIN LATERAL (
      SELECT hd_json FROM charts WHERE user_id = u.id ORDER BY calculated_at DESC LIMIT 1
    ) c ON true
    WHERE u.created_at >= NOW() - INTERVAL '73 hours'
      AND u.created_at <= NOW() - INTERVAL '71 hours'
      AND u.email_verified != false
  `,

  cronGetWelcome4Users: `
    SELECT u.id, u.email, u.created_at
    FROM users u
    WHERE u.created_at >= NOW() - INTERVAL '7 days 1 hour'
      AND u.created_at <= NOW() - INTERVAL '6 days 23 hours'
      AND u.email_verified != false
  `,

  cronGetReengagementUsers: `
    SELECT u.id, u.email, u.last_login_at,
           EXTRACT(DAY FROM (NOW() - u.last_login_at)) AS days_inactive
    FROM users u
    WHERE u.last_login_at IS NOT NULL
      AND u.last_login_at >= NOW() - INTERVAL '8 days'
      AND u.last_login_at <= NOW() - INTERVAL '6 days'
      AND u.email_verified != false
      AND u.created_at < NOW() - INTERVAL '14 days'
  `,

  cronGetUpgradeNudgeUsers: `
    SELECT u.id, u.email, u.created_at
    FROM users u
    WHERE u.tier = 'free'
      AND u.created_at >= NOW() - INTERVAL '31 days'
      AND u.created_at <= NOW() - INTERVAL '29 days'
      AND u.email_verified != false
  `,

  // ─── Promo Codes ──────────────────────────────────────────

  getPromoCode: `
    SELECT id, code, discount_type, discount_value, max_redemptions, redemptions,
           valid_until, applicable_tiers, active
    FROM promo_codes
    WHERE code = $1 AND active = TRUE
  `,

  validatePromoCode: `
    SELECT id, code, discount_type, discount_value, max_redemptions, redemptions,
           valid_until, applicable_tiers
    FROM promo_codes
    WHERE code = $1
      AND active = TRUE
      AND (valid_until IS NULL OR valid_until > NOW())
      AND (max_redemptions IS NULL OR redemptions < max_redemptions)
  `,

  redeemPromoCode: `
    UPDATE promo_codes
    SET redemptions = redemptions + 1
    WHERE code = $1
      AND active = TRUE
      AND (valid_until IS NULL OR valid_until > NOW())
      AND (max_redemptions IS NULL OR redemptions < max_redemptions)
    RETURNING id, code, discount_type, discount_value
  `,

  createPromoCode: `
    INSERT INTO promo_codes (code, discount_type, discount_value, max_redemptions, valid_until, applicable_tiers, active)
    VALUES ($1, $2, $3, $4, $5, $6, TRUE)
    RETURNING id, code, discount_type, discount_value, max_redemptions, valid_until, applicable_tiers, active
  `,

  listPromoCodes: `
    SELECT id, code, discount_type, discount_value, max_redemptions, redemptions,
           valid_until, applicable_tiers, active, created_at
    FROM promo_codes
    ORDER BY created_at DESC
  `
};
