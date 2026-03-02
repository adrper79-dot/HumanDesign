/**
 * Database Queries — Neon PostgreSQL
 *
 * Prepared queries for all core operations.
 * Uses the @neondatabase/serverless driver for Workers compatibility.
 *
 * In Workers context, use neon() HTTP driver.
 * In Node context (migration), use Client from pg.
 */

/**
 * Get a pg Client for migration scripts (Node.js only).
 */
export function getClient(connectionString) {
  // Dynamic import — only used in migration CLI
  const { Client } = require('pg');
  return new Client({ connectionString, ssl: { rejectUnauthorized: false } });
}

/**
 * Create a serverless query function for Workers runtime.
 * Uses @neondatabase/serverless neon() driver over HTTP.
 *
 * @param {string} connectionString — Neon pooled connection string
 */
export function createQueryFn(connectionString) {
  // @neondatabase/serverless must be bundled or imported
  // For now, use fetch-based driver
  return async function query(sql, params = []) {
    const response = await neonQuery(connectionString, sql, params);
    return response;
  };
}

/**
 * HTTP-based Neon query (no WebSocket needed).
 * Uses the Neon serverless HTTP API.
 */
async function neonQuery(connectionString, sql, params) {
  const url = new URL(connectionString);
  const httpUrl = `https://${url.hostname}/sql`;

  const response = await fetch(httpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': connectionString
    },
    body: JSON.stringify({
      query: sql,
      params: params
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Neon query failed: ${response.status} ${text}`);
  }

  return response.json();
}

// ─── User Queries ────────────────────────────────────────────

export const QUERIES = {
  // Users
  createUser: `
    INSERT INTO users (email, phone, birth_date, birth_time, birth_tz, birth_lat, birth_lng)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
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
    SELECT id, model_used, created_at
    FROM profiles
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
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
    RETURNING id
  `,

  addClient: `
    INSERT INTO practitioner_clients (practitioner_id, client_user_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
  `,

  getPractitionerClients: `
    SELECT u.* FROM users u
    JOIN practitioner_clients pc ON pc.client_user_id = u.id
    WHERE pc.practitioner_id = $1
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
