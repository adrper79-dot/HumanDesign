/**
 * Database Queries — Neon PostgreSQL
 *
 * Prepared queries for all core operations.
 * Uses the @neondatabase/serverless driver for Workers compatibility.
 *
 * In Workers context, use neon() HTTP driver.
 * In Node context (migration), use Client from pg.
 */

import { neon } from '@neondatabase/serverless';

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
 * Create a serverless query function for Workers runtime.
 * Uses @neondatabase/serverless neon() driver over HTTP.
 *
 * @param {string} connectionString — Neon pooled connection string
 */
export function createQueryFn(connectionString) {
  // Use official Neon serverless driver
  const sql = neon(connectionString);
  
  return async function query(sqlText, params = []) {
    try {
      const rows = await sql(sqlText, params);
      // Neon returns array of rows directly, wrap to match pg interface
      return { rows };
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  };
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
    SELECT * FROM users WHERE id = $1
  `,

  getUserByEmail: `
    SELECT * FROM users WHERE email = $1
  `,

  getUserByPhone: `
    SELECT * FROM users WHERE phone = $1
  `,

  // Charts
  saveChart: `
    INSERT INTO charts (user_id, hd_json, astro_json)
    VALUES ($1, $2, $3)
    RETURNING id, calculated_at
  `,

  getLatestChart: `
    SELECT * FROM charts
    WHERE user_id = $1
    ORDER BY calculated_at DESC
    LIMIT 1
  `,

  getChartById: `
    SELECT * FROM charts WHERE id = $1
  `,

  // Profiles
  saveProfile: `
    INSERT INTO profiles (user_id, chart_id, profile_json, model_used, grounding_audit)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, created_at
  `,

  getLatestProfile: `
    SELECT * FROM profiles
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
    SELECT * FROM profiles WHERE id = $1
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
    SELECT * FROM transit_snapshots
    WHERE snapshot_date = $1
  `,

  // Practitioners
  createPractitioner: `
    INSERT INTO practitioners (user_id, certified, tier)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, certified, tier, created_at
  `,

  getPractitionerByUserId: `
    SELECT * FROM practitioners WHERE user_id = $1
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
    SELECT u.* FROM users u
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
    SELECT c.* FROM clusters c
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
  `
};
