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
   * @param {(q: Function) => Promise<T>} fn — receives the same query function
   * @returns {Promise<T>}
   */
  query.transaction = async function transaction(fn) {
    await pool.query('BEGIN');
    try {
      const result = await fn(query);
      await pool.query('COMMIT');
      return result;
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
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
    SELECT id, email, phone, password_hash, birth_date, birth_time, birth_tz, birth_lat, birth_lng, sms_opted_in, created_at, updated_at
    FROM users WHERE id = $1
  `,

  getUserByEmail: `
    SELECT id, email, phone, password_hash, birth_date, birth_time, birth_tz, birth_lat, birth_lng, sms_opted_in, created_at, updated_at
    FROM users WHERE email = $1
  `,

  getUserByPhone: `
    SELECT id, email, phone, password_hash, birth_date, birth_time, birth_tz, birth_lat, birth_lng, sms_opted_in, created_at, updated_at
    FROM users WHERE phone = $1
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
    INSERT INTO cluster_members (cluster_id, user_id, forge_role)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
  `,

  getClusterMembers: `
    SELECT u.id, u.email, cm.forge_role
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
  `
};
