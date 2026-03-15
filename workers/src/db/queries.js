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

  // CTO-003: Classify errors as retriable (cold-start, transient network) vs
  // non-retriable (schema errors, constraint violations, auth failures).
  function isRetriable(error) {
    if (!error) return false;
    // Neon "endpoint is in idle state" — cold-start wake-up; first query always fails
    if (error.message?.includes('endpoint is in idle state')) return true;
    // Network-level transient codes
    const TRANSIENT = new Set([
      'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'EAI_AGAIN',
      '57P01', // admin_shutdown
      '57P03', // cannot_connect_now (server starting up)
      '08006', '08001', '08004', // connection_failure variants
    ]);
    if (TRANSIENT.has(error.code)) return true;
    // Neon HTTP responses: 503 Service Unavailable, 504 Gateway Timeout
    if (error.status === 503 || error.status === 504) return true;
    return false;
  }

  // CTO-010: Threshold above which a query is flagged as slow in structured logs.
  const SLOW_QUERY_MS = 1000;

  async function query(sqlText, params = []) {
    const MAX_RETRIES = 3;
    const t0 = Date.now();
    let lastError;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await pool.query(sqlText, params);
        const durationMs = Date.now() - t0;
        // CTO-010: Surface slow queries so they can be indexed/optimised.
        if (durationMs > SLOW_QUERY_MS) {
          console.warn(JSON.stringify({ event: 'slow_query', durationMs, attempt }));
        }
        return result;
      } catch (error) {
        lastError = error;
        if (!isRetriable(error) || attempt === MAX_RETRIES - 1) {
          // CTO-010: Include durationMs so trace shows how long before failure.
          console.error(JSON.stringify({
            event: 'db_query_error',
            durationMs: Date.now() - t0,
            attempt,
            code: error.code,
            message: error.message,
          }));
          throw error;
        }
        // Exponential backoff: 100ms, 200ms, 400ms
        await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt)));
      }
    }
    throw lastError;
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
        const t0 = Date.now();
        try {
          const result = await client.query(sqlText, params);
          const durationMs = Date.now() - t0;
          if (durationMs > SLOW_QUERY_MS) {
            console.warn(JSON.stringify({ event: 'slow_txn_query', durationMs }));
          }
          return result;
        } catch (error) {
          console.error(JSON.stringify({
            event: 'txn_query_error',
            durationMs: Date.now() - t0,
            code: error.code,
            message: error.message,
          }));
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
        // CTO-011: Structured log so rollback failures are searchable in CF logs.
        console.error(JSON.stringify({
          event: 'txn_rollback_failed',
          code: rollbackError.code,
          message: rollbackError.message,
        }));
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
    SELECT id, email, phone, password_hash, birth_date, birth_time, birth_tz, birth_lat, birth_lng, sms_opted_in, tier, stripe_customer_id, referral_code, email_verified, last_login_at, transit_pass_expires, lifetime_access, totp_enabled, totp_secret, created_at, updated_at
    FROM users WHERE id = $1
  `,

  getUserByEmail: `
    SELECT id, email, phone, password_hash, birth_date, birth_time, birth_tz, birth_lat, birth_lng, sms_opted_in, tier, stripe_customer_id, referral_code, email_verified, last_login_at, transit_pass_expires, lifetime_access, totp_enabled, totp_secret, created_at, updated_at
    FROM users WHERE email = $1
  `,

  getUserByPhone: `
    SELECT id, email, phone, password_hash, birth_date, birth_time, birth_tz, birth_lat, birth_lng, sms_opted_in, tier, stripe_customer_id, referral_code, email_verified, last_login_at, transit_pass_expires, lifetime_access, created_at, updated_at
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

  searchProfilesByUser: `
    SELECT id, chart_id, model_used, created_at
    FROM profiles
    WHERE user_id = $1
      AND (model_used ILIKE '%' || $2 || '%'
           OR profile_json::text ILIKE '%' || $2 || '%')
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

  // Practitioners
  createPractitioner: `
    INSERT INTO practitioners (user_id, certified, tier)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING id, user_id, certified, tier, created_at
  `,

  // Update practitioners.tier when subscription upgrades/downgrades.
  // Used by the Stripe webhook handler — createPractitioner uses ON CONFLICT DO NOTHING
  // so existing rows are never updated by that query alone.
  updatePractitionerTier: `
    UPDATE practitioners
    SET tier = $2
    WHERE user_id = $1
  `,

  getPractitionerByUserId: `
    -- Keep this query compatible with older production schemas that may not
    -- yet include Discord integration columns.
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

  expirePendingPractitionerInvitationsByEmail: `
    UPDATE practitioner_invitations
    SET status = 'expired'
    WHERE practitioner_id = $1
      AND LOWER(client_email) = LOWER($2)
      AND status = 'pending'
  `,

  createPractitionerInvitation: `
    INSERT INTO practitioner_invitations (
      practitioner_id,
      client_email,
      client_name,
      token_hash,
      message,
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, practitioner_id, client_email, client_name, status, expires_at, created_at
  `,

  listPractitionerInvitations: `
    SELECT id, practitioner_id, client_email, client_name, status, message, expires_at, accepted_at, created_at
    FROM practitioner_invitations
    WHERE practitioner_id = $1
      AND status = 'pending'
    ORDER BY created_at DESC
  `,

  deletePractitionerInvitation: `
    DELETE FROM practitioner_invitations
    WHERE id = $1 AND practitioner_id = $2
  `,

  // Clusters
  createCluster: `
    INSERT INTO clusters (name, created_by, challenge, invite_code)
    VALUES ($1, $2, $3, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)))
    RETURNING id, created_at, invite_code
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

  // P2-SEC-019: Moved inline SQL to QUERIES registry
  checkClusterMembership: `SELECT 1 FROM cluster_members WHERE cluster_id = $1 AND user_id = $2 LIMIT 1`,

  // SMS
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

  // ─── Subscriptions ────────────────────────────────────────

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

  checkEventProcessed: `
    SELECT id FROM payment_events WHERE stripe_event_id = $1
  `,

  // CFO-002: Record processed event for idempotency. ON CONFLICT DO NOTHING so
  // concurrent duplicate deliveries are silently ignored after the first wins.
  markEventProcessed: `
    INSERT INTO payment_events (subscription_id, stripe_event_id, event_type, amount, currency, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (stripe_event_id) DO NOTHING
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

  // BL-RACE-001: Atomic quota check + insert in a single statement.
  // Uses a CTE to count current usage and bonus credits, then only inserts
  // a new usage_records row if the net usage is within the tier limit.
  // Returns current net_usage and whether the quota was exceeded.
  atomicQuotaCheckAndInsert: `
    WITH usage AS (
      SELECT COALESCE(COUNT(*), 0) AS raw_count
      FROM usage_records
      WHERE user_id = $1 AND action = $2 AND created_at >= $3
    ),
    bonus AS (
      SELECT COALESCE(SUM(quota_cost), 0) AS total_bonus
      FROM usage_records
      WHERE user_id = $1 AND action = $4
    ),
    net AS (
      SELECT GREATEST(0, (SELECT raw_count FROM usage) - ABS((SELECT total_bonus FROM bonus))) AS net_usage
    ),
    inserted AS (
      INSERT INTO usage_records (user_id, action, endpoint, quota_cost)
      SELECT $1, $2, 'atomic-quota', 1
      WHERE (SELECT net_usage FROM net) < $5
      RETURNING id
    )
    SELECT
      (SELECT net_usage FROM net) AS net_usage,
      CASE WHEN EXISTS (SELECT 1 FROM inserted) THEN false ELSE true END AS quota_exceeded
  `,

  // Count how many profiles a user has saved (for savedProfilesMax enforcement)
  countSavedProfilesByUser: `
    SELECT COUNT(*) as count FROM profiles WHERE user_id = $1
  `,

  // MED-INLINE-SQL: Webhook queries migrated from inline SQL
  updateTransitPassExpiry: `
    UPDATE users SET transit_pass_expires = $1 WHERE id = $2
  `,

  grantLifetimeAccess: `
    UPDATE users SET tier = $1, lifetime_access = true WHERE id = $2
  `,

  // MED-N+1-001: Batch query for SMS usage counts — eliminates per-user query in loop
  getBatchSmsUsageCounts: `
    SELECT user_id, COUNT(*) AS count
    FROM usage_records
    WHERE user_id = ANY($1)
      AND action = 'sms_digest'
      AND created_at >= $2
    GROUP BY user_id
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
      'revenue_share' as reward_type, 500 as reward_value
    FROM referrals r
    JOIN users u ON r.referred_user_id = u.id
    WHERE r.referrer_user_id = $1 AND r.converted = true AND r.reward_granted = false
    ORDER BY r.conversion_date DESC
  `,

  getReferralById: `
    SELECT id, referrer_user_id, referred_user_id, referral_code, converted, conversion_date, reward_granted, reward_type, reward_value, created_at, updated_at
    FROM referrals WHERE id = $1 AND referrer_user_id = $2
  `,

  // P2-BIZ-001: Atomic claim — only succeeds if reward_granted is still false
  // Concurrent requests will get 0 rows returned, preventing double-spend
  claimReferralReward: `
    UPDATE referrals 
    SET reward_granted = true, reward_type = 'revenue_share', reward_value = 500, updated_at = NOW()
    WHERE id = $1 AND reward_granted = false
    RETURNING *
  `,

  getUserStripeCustomerId: `
    SELECT stripe_customer_id FROM users WHERE id = $1
  `,

  getUnconvertedReferral: `
    SELECT id, referrer_user_id
    FROM referrals
    WHERE referred_user_id = $1 AND converted = false
  `,

  /** HD_UPDATES3: Get referrer for recurring revenue share credits */
  getReferrerForUser: `
    SELECT r.id AS referral_id, r.referrer_user_id, u.stripe_customer_id AS referrer_stripe_id
    FROM referrals r
    JOIN users u ON u.id = r.referrer_user_id
    WHERE r.referred_user_id = $1 AND r.converted = true
    LIMIT 1
  `,

  markReferralConverted: `
    UPDATE referrals
    SET converted = true, conversion_date = NOW(), updated_at = NOW()
    WHERE id = $1
  `,

  // P2-BIZ-002: Anti-Sybil queries
  countReferrerLifetimeCredits: `
    SELECT COUNT(*)::int AS count FROM referrals
    WHERE referrer_user_id = $1 AND reward_granted = true
  `,

  countReferralsByDomain: `
    SELECT COUNT(*)::int AS count FROM referrals r
    JOIN users u ON u.id = r.referred_user_id
    WHERE r.referrer_user_id = $1
      AND LOWER(SPLIT_PART(u.email, '@', 2)) = LOWER($2)
  `,

  // ─── Billing ──────────────────────────────────────────────

  updateUserStripeCustomerId: `
    UPDATE users SET stripe_customer_id = $1 WHERE id = $2
  `,

  getActiveSubscription: `
    SELECT id, user_id, stripe_customer_id, stripe_subscription_id, tier, status,
           current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at
    FROM subscriptions
    WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due')
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

  updateUserTierAndStripe: `
    UPDATE users 
    SET tier = $1, stripe_customer_id = $2, updated_at = NOW()
    WHERE id = $3
  `,

  // TXN-014: Find subscriptions marked for cancellation whose period has expired
  getExpiredCancelledSubscriptions: `
    SELECT s.id, s.user_id, s.stripe_subscription_id, s.tier
    FROM subscriptions s
    WHERE s.cancel_at_period_end = true
      AND s.status IN ('active', 'trialing', 'past_due')
      AND s.current_period_end < NOW()
  `,

  // CFO-005: Conditional UPDATE — only cancels if still in a live state.
  // Returns the user_id if the row was actually changed, empty if webhook
  // already processed it. Eliminates the cron/webhook double-fire race.
  cancelExpiredSubscription: `
    UPDATE subscriptions
    SET status = 'canceled'
    WHERE id = $1
      AND status IN ('active', 'trialing', 'past_due')
    RETURNING user_id
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
    WITH normalized_subscriptions AS (
      SELECT
        CASE
          WHEN LOWER(COALESCE(tier, 'free')) IN ('individual', 'regular', 'explorer', 'seeker') THEN 'individual'
          WHEN LOWER(COALESCE(tier, 'free')) IN ('practitioner', 'guide') THEN 'practitioner'
          WHEN LOWER(COALESCE(tier, 'free')) IN ('agency', 'white_label', 'studio') THEN 'agency'
          ELSE LOWER(COALESCE(tier, 'free'))
        END AS canonical_tier,
        status,
        updated_at
      FROM subscriptions
    )
    SELECT
      COUNT(*) FILTER (WHERE canonical_tier = 'individual' AND status = 'active') AS individual_count,
      COUNT(*) FILTER (WHERE canonical_tier = 'practitioner' AND status = 'active') AS practitioner_count,
      COUNT(*) FILTER (WHERE canonical_tier = 'agency' AND status = 'active') AS agency_count,
      COUNT(*) FILTER (WHERE status = 'active') AS total_active,
      COUNT(*) FILTER (WHERE status = 'canceled' AND updated_at >= CURRENT_DATE - INTERVAL '30 days') AS recent_churn
    FROM normalized_subscriptions
  `,
  getAnalyticsTierDistribution: `
    SELECT
      CASE
        WHEN LOWER(COALESCE(tier, 'free')) IN ('individual', 'regular', 'explorer', 'seeker') THEN 'individual'
        WHEN LOWER(COALESCE(tier, 'free')) IN ('practitioner', 'guide') THEN 'practitioner'
        WHEN LOWER(COALESCE(tier, 'free')) IN ('agency', 'white_label', 'studio') THEN 'agency'
        ELSE LOWER(COALESCE(tier, 'free'))
      END AS tier,
      COUNT(*) AS count
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

  // ─── Email Marketing Opt-out (AUDIT-SEC-005: CAN-SPAM) ────
  emailMarketingOptOut: `UPDATE users SET email_marketing_opted_out = true WHERE email = $1 RETURNING id`,
  emailMarketingOptIn: `UPDATE users SET email_marketing_opted_out = false WHERE id = $1`,

  // ─── Clusters ─────────────────────────────────────────────

  listUserClusters: `
    SELECT c.id, c.name, c.challenge, c.created_at, c.invite_code, c.created_by, cm.joined_at
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
  getClusterByInviteCode: `
    SELECT id, name, challenge, created_by, invite_code, created_at
    FROM clusters WHERE invite_code = $1
  `,
  regenerateClusterInviteCode: `
    UPDATE clusters
    SET invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    WHERE id = $1 AND created_by = $2
    RETURNING invite_code
  `,
  getClusterOwner: `
    SELECT created_by FROM clusters WHERE id = $1
  `,

  // ─── Chart History ────────────────────────────────────────

  getChartHistory: `
    SELECT id, calculated_at, hd_json::jsonb->'chart'->>'type' as type
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
      AND u.email_marketing_opted_out != true
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
      AND u.email_marketing_opted_out != true
  `,

  cronGetWelcome4Users: `
    SELECT u.id, u.email, u.created_at
    FROM users u
    WHERE u.created_at >= NOW() - INTERVAL '7 days 1 hour'
      AND u.created_at <= NOW() - INTERVAL '6 days 23 hours'
      AND u.email_verified != false
      AND u.email_marketing_opted_out != true
  `,

  cronGetReengagementUsers: `
    SELECT u.id, u.email, u.last_login_at,
           EXTRACT(DAY FROM (NOW() - u.last_login_at)) AS days_inactive
    FROM users u
    WHERE u.last_login_at IS NOT NULL
      AND u.last_login_at >= NOW() - INTERVAL '8 days'
      AND u.last_login_at <= NOW() - INTERVAL '6 days'
      AND u.email_verified != false
      AND u.email_marketing_opted_out != true
      AND u.created_at < NOW() - INTERVAL '14 days'
  `,

  cronGetUpgradeNudgeUsers: `
    SELECT u.id, u.email, u.created_at
    FROM users u
    WHERE u.tier = 'free'
      AND u.created_at >= NOW() - INTERVAL '31 days'
      AND u.created_at <= NOW() - INTERVAL '29 days'
      AND u.email_verified != false
      AND u.email_marketing_opted_out != true
  `,

  // ─── Promo Codes ──────────────────────────────────────────

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
  `,

  // ─── Password Reset ──────────────────────────────────────────
  createPasswordResetToken: `
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id
  `,

  getPasswordResetToken: `
    SELECT id, user_id, expires_at, used_at
    FROM password_reset_tokens
    WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
  `,

  markPasswordResetUsed: `
    UPDATE password_reset_tokens SET used_at = now()
    WHERE id = $1
  `,

  invalidatePasswordResetTokens: `
    UPDATE password_reset_tokens SET used_at = now()
    WHERE user_id = $1 AND used_at IS NULL
  `,

  updatePasswordHash: `
    UPDATE users SET password_hash = $2, updated_at = NOW()
    WHERE id = $1
  `,

  // ─── Email Verification ──────────────────────────────────────
  createEmailVerificationToken: `
    INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id
  `,

  getEmailVerificationToken: `
    SELECT id, user_id, expires_at
    FROM email_verification_tokens
    WHERE token_hash = $1 AND expires_at > now()
  `,

  // AUDIT-SEC-001: Atomic single-use token consumption.
  // DELETE ... RETURNING ensures the token is consumed exactly once even under
  // concurrent requests — no SELECT+DELETE race condition.
  atomicVerifyEmailToken: `
    DELETE FROM email_verification_tokens
    WHERE token_hash = $1 AND expires_at > now()
    RETURNING id, user_id
  `,

  deleteEmailVerificationTokens: `
    DELETE FROM email_verification_tokens
    WHERE user_id = $1
  `,

  markEmailVerified: `
    UPDATE users SET email_verified = true, updated_at = NOW()
    WHERE id = $1
  `,

  getEmailVerifiedStatus: `
    SELECT email_verified FROM users WHERE id = $1
  `,

  // ─── Account Deletion ────────────────────────────────────────
  deleteUserAccount: `
    DELETE FROM users WHERE id = $1
  `,

  // ─── GDPR Data Export ──────────────────────────────────────
  exportUserData: `
    SELECT id, email, phone, birth_date, birth_time, birth_tz, birth_lat, birth_lng,
           sms_opted_in, tier, referral_code, email_verified, last_login_at, created_at, updated_at
    FROM users WHERE id = $1
  `,
  exportUserCharts: `
    SELECT id, hd_json, astro_json, calculated_at FROM charts WHERE user_id = $1 ORDER BY calculated_at DESC
  `,
  exportUserProfiles: `
    SELECT id, chart_id, profile_json, model_used, created_at FROM profiles WHERE user_id = $1 ORDER BY created_at DESC
  `,
  exportUserCheckins: `
    SELECT checkin_date, alignment_score, followed_strategy, followed_authority, mood, energy_level, notes, created_at
    FROM daily_checkins WHERE user_id = $1 ORDER BY checkin_date DESC
  `,
  exportUserDiary: `
    SELECT event_date, event_title, event_description, event_type, significance, transit_snapshot, created_at
    FROM diary_entries WHERE user_id = $1 ORDER BY event_date DESC
  `,
  exportUserSubscription: `
    SELECT tier, status, current_period_start, current_period_end, cancel_at_period_end, created_at
    FROM subscriptions WHERE user_id = $1
  `,
  exportUserAlerts: `
    SELECT alert_type, config, name, active, created_at FROM transit_alerts WHERE user_id = $1
  `,
  exportUserSMS: `
    SELECT direction, body, sent_at FROM sms_messages WHERE user_id = $1 ORDER BY sent_at DESC
  `,

  // ─── Social Auth (migration 022) ──────────────────────────

  getSocialAccount: `
    SELECT sa.user_id, u.email, u.tier, u.email_verified
    FROM social_accounts sa
    JOIN users u ON u.id = sa.user_id
    WHERE sa.provider = $1 AND sa.provider_user_id = $2
    LIMIT 1
  `,

  insertSocialAccount: `
    INSERT INTO social_accounts (user_id, provider, provider_user_id, provider_email, display_name, avatar_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (provider, provider_user_id) DO UPDATE SET
      provider_email = EXCLUDED.provider_email,
      display_name   = EXCLUDED.display_name,
      avatar_url     = EXCLUDED.avatar_url
  `,

  insertOAuthStatePublic: `
    INSERT INTO oauth_states (provider, state, expires_at)
    VALUES ($1, $2, $3)
  `,

  // ─── Session Notes (HD_UPDATES4) ──────────────────────────────

  createSessionNote: `
    INSERT INTO practitioner_session_notes
      (practitioner_id, client_user_id, content, share_with_ai, transit_snapshot, session_date)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `,

  updateSessionNote: `
    UPDATE practitioner_session_notes
    SET content = $2, share_with_ai = $3, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,

  deleteSessionNote: `
    DELETE FROM practitioner_session_notes WHERE id = $1 AND practitioner_id = $2
  `,

  listSessionNotes: `
    SELECT id, content, share_with_ai, transit_snapshot, session_date, created_at, updated_at
    FROM practitioner_session_notes
    WHERE practitioner_id = $1 AND client_user_id = $2
    ORDER BY session_date DESC, created_at DESC
    LIMIT 50
  `,

  getAISharedNotes: `
    SELECT content, session_date
    FROM practitioner_session_notes
    WHERE client_user_id = $1 AND share_with_ai = true
    ORDER BY session_date DESC
    LIMIT 10
  `,

  // ─── Per-Client AI Context (HD_UPDATES4 Vector 3) ─────────────

  updateClientAIContext: `
    UPDATE practitioner_clients SET ai_context = $3
    WHERE practitioner_id = $1 AND client_user_id = $2
  `,

  getClientAIContext: `
    SELECT ai_context FROM practitioner_clients
    WHERE practitioner_id = $1 AND client_user_id = $2
  `,

  // ─── Practitioner Directory (HD_UPDATES4) ─────────────────────

  updatePractitionerProfile: `
    UPDATE practitioners SET
      is_public = $2,
      slug = $3,
      display_name = $4,
      photo_url = $5,
      bio = $6,
      specializations = $7,
      certification = $8,
      languages = $9,
      session_format = $10,
      session_info = $11,
      booking_url = $12,
      payment_links = $13,
      synthesis_style = $14
    WHERE id = $1
    RETURNING *
  `,

  getPractitionerBySlug: `
    SELECT p.id, p.display_name, p.photo_url, p.bio, p.specializations,
           p.certification, p.languages, p.session_format, p.session_info,
           p.booking_url, p.payment_links, p.slug,
           (SELECT COUNT(*) FROM practitioner_clients pc WHERE pc.practitioner_id = p.id) AS client_count
    FROM practitioners p
    WHERE p.slug = $1 AND p.is_public = true
  `,

  listPublicPractitioners: `
    SELECT p.id, p.display_name, p.photo_url, p.bio, p.specializations,
           p.certification, p.languages, p.session_format, p.session_info,
           p.booking_url, p.slug,
           (SELECT COUNT(*) FROM practitioner_clients pc WHERE pc.practitioner_id = p.id) AS client_count
    FROM practitioners p
    WHERE p.is_public = true
    ORDER BY client_count DESC, p.display_name ASC
    LIMIT $1 OFFSET $2
  `,

  searchPublicPractitioners: `
    SELECT p.id, p.display_name, p.photo_url, p.bio, p.specializations,
           p.certification, p.languages, p.session_format, p.session_info,
           p.booking_url, p.slug,
           (SELECT COUNT(*) FROM practitioner_clients pc WHERE pc.practitioner_id = p.id) AS client_count
    FROM practitioners p
    WHERE p.is_public = true
      AND ($1::text IS NULL OR p.specializations && ARRAY[$1::text])
      AND ($2::text IS NULL OR p.certification = $2)
      AND ($3::text IS NULL OR $3 = ANY(p.languages))
      AND ($4::text IS NULL OR p.session_format = $4)
    ORDER BY client_count DESC, p.display_name ASC
    LIMIT $5 OFFSET $6
  `,

  getPractitionerDirectoryProfile: `
    SELECT id, is_public, slug, display_name, photo_url, bio,
           specializations, certification, languages, session_format,
           session_info, booking_url, payment_links, synthesis_style
    FROM practitioners
    WHERE user_id = $1
  `,

  // ─── Combined Practitioner AI Context for Client (HD_UPDATES4) ─

  /** Fetch all 3 AI vectors for a client in a single query */
  getPractitionerAIContext: `
    SELECT
      p.synthesis_style,
      pc.ai_context
    FROM practitioner_clients pc
    JOIN practitioners p ON p.id = pc.practitioner_id
    WHERE pc.client_user_id = $1
    LIMIT 1
  `,

  // ─── Branded PDF branding (Migration 029) ──────────────────────

  getPractitionerBranding: `
    SELECT display_name, website_url, booking_url, brand_color, logo_url
    FROM practitioners
    WHERE user_id = $1
  `,

  // ─── Agency Seats (Migration 029) ──────────────────────────────

  getAgencySeats: `
    SELECT
      s.id, s.member_user_id, s.invited_email,
      s.invited_at, s.accepted_at,
      u.email AS member_email
    FROM agency_seats s
    LEFT JOIN users u ON u.id = s.member_user_id
    WHERE s.owner_user_id = $1
    ORDER BY s.invited_at ASC
  `,

  countAgencySeats: `
    SELECT COUNT(*) AS count FROM agency_seats WHERE owner_user_id = $1
  `,

  addAgencySeat: `
    INSERT INTO agency_seats (owner_user_id, member_user_id, invited_email)
    VALUES ($1, $2, $3)
    ON CONFLICT (member_user_id) DO NOTHING
    RETURNING id, member_user_id, invited_email, invited_at
  `,

  removeAgencySeat: `
    DELETE FROM agency_seats
    WHERE owner_user_id = $1 AND member_user_id = $2
    RETURNING id
  `,

  /** Returns the agency owner's user_id for a seat member — used in tier propagation */
  getAgencyOwnerForMember: `
    SELECT s.owner_user_id, sub.tier AS owner_tier
    FROM agency_seats s
    LEFT JOIN subscriptions sub
      ON sub.user_id = s.owner_user_id
      AND (sub.status = 'active' OR sub.status = 'trialing')
    WHERE s.member_user_id = $1
    LIMIT 1
  `,

  /** Look up a user id by email — used when inviting a seat member */
  // Note: getUserByEmail already exists above with full user columns

  // ─── Admin ────────────────────────────────────────────────

  adminListUsers: `
    SELECT id, email, tier, email_verified, created_at, last_login_at,
           stripe_customer_id, lifetime_access, transit_pass_expires
    FROM users
    WHERE ($1::text IS NULL OR email ILIKE '%' || $1 || '%')
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `,

  adminCountUsers: `
    SELECT COUNT(*) AS total FROM users
    WHERE ($1::text IS NULL OR email ILIKE '%' || $1 || '%')
  `,

  adminGetUser: `
    SELECT id, email, phone, tier, email_verified, email_marketing_opted_out,
           stripe_customer_id, referral_code, created_at, last_login_at,
           transit_pass_expires, lifetime_access
    FROM users WHERE id = $1
  `,

  adminSetTier: `
    UPDATE users SET tier = $1, updated_at = NOW() WHERE id = $2
    RETURNING id, email, tier
  `,

  adminSetEmailVerified: `
    UPDATE users SET email_verified = $1, updated_at = NOW() WHERE id = $2
    RETURNING id, email, email_verified
  `,

  adminDeactivatePromo: `
    UPDATE promo_codes SET active = false WHERE id = $1
    RETURNING id, code, active
  `,

  adminGetOverviewStats: `
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours') AS new_users_24h,
      (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days') AS new_users_7d,
      (SELECT COUNT(*) FROM users WHERE email_verified = true) AS verified_users,
      (SELECT COUNT(*) FROM users WHERE tier = 'individual') AS individual_users,
      (SELECT COUNT(*) FROM users WHERE tier = 'practitioner') AS practitioner_users,
      (SELECT COUNT(*) FROM users WHERE tier = 'agency') AS agency_users,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') AS active_subscriptions,
      (SELECT COUNT(*) FROM charts WHERE calculated_at >= NOW() - INTERVAL '24 hours') AS charts_24h,
      (SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '24 hours') AS profiles_24h
  `,

  // ─── 2FA / TOTP (migration 038) ─────────────────────────────
  setTOTPSecret: `
    UPDATE users SET totp_secret = $1, totp_enabled = false, updated_at = NOW()
    WHERE id = $2
    RETURNING id, email, totp_enabled
  `,

  enableTOTP: `
    UPDATE users SET totp_enabled = true, updated_at = NOW()
    WHERE id = $1
    RETURNING id, email, totp_enabled
  `,

  disableTOTP: `
    UPDATE users SET totp_secret = NULL, totp_enabled = false, updated_at = NOW()
    WHERE id = $1
    RETURNING id, email, totp_enabled
  `,
};

