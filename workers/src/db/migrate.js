/**
 * Database Migration — Neon PostgreSQL
 *
 * Creates the core schema tables.
 * Run via: node workers/src/db/migrate.js
 */

import { getClient } from './queries.js';

const MIGRATIONS = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      -- Migration tracking
      CREATE TABLE IF NOT EXISTS _migrations (
        version   INT PRIMARY KEY,
        name      TEXT NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT now()
      );

      -- Users
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email         TEXT UNIQUE,
        phone         TEXT,
        birth_date    DATE NOT NULL,
        birth_time    TIME,
        birth_tz      TEXT NOT NULL,
        birth_lat     DECIMAL(9,6) NOT NULL,
        birth_lng     DECIMAL(9,6) NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT now()
      );

      -- Calculated Charts (cached)
      CREATE TABLE IF NOT EXISTS charts (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
        hd_json       JSONB NOT NULL,
        astro_json    JSONB NOT NULL,
        calculated_at TIMESTAMPTZ DEFAULT now()
      );

      -- Transit Snapshots (daily cron)
      CREATE TABLE IF NOT EXISTS transit_snapshots (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        snapshot_date DATE NOT NULL UNIQUE,
        positions_json JSONB NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT now()
      );

      -- Prime Self Profiles (generated readings)
      CREATE TABLE IF NOT EXISTS profiles (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
        chart_id      UUID REFERENCES charts(id) ON DELETE SET NULL,
        profile_json  JSONB NOT NULL,
        model_used    TEXT NOT NULL,
        grounding_audit JSONB NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT now()
      );

      -- Practitioner Rosters
      CREATE TABLE IF NOT EXISTS practitioners (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
        certified     BOOLEAN DEFAULT false,
        tier          TEXT DEFAULT 'free'
      );

      CREATE TABLE IF NOT EXISTS practitioner_clients (
        practitioner_id UUID REFERENCES practitioners(id) ON DELETE CASCADE,
        client_user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (practitioner_id, client_user_id)
      );

      -- Clusters
      CREATE TABLE IF NOT EXISTS clusters (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          TEXT NOT NULL,
        created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
        challenge     TEXT NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS cluster_members (
        cluster_id    UUID REFERENCES clusters(id) ON DELETE CASCADE,
        user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
        forge_role    TEXT,
        PRIMARY KEY (cluster_id, user_id)
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_charts_user ON charts(user_id);
      CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_transit_date ON transit_snapshots(snapshot_date);
      CREATE INDEX IF NOT EXISTS idx_cluster_members_user ON cluster_members(user_id);
    `
  },
  {
    version: 2,
    name: 'sms_support',
    sql: `
      -- Add SMS opt-in flag to users
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_opted_in BOOLEAN DEFAULT false;

      -- SMS message log for delivery tracking
      CREATE TABLE IF NOT EXISTS sms_messages (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
        direction     TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
        body          TEXT NOT NULL,
        sent_at       TIMESTAMPTZ DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_sms_user ON sms_messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_users_sms_opted ON users(sms_opted_in) WHERE sms_opted_in = true;
    `
  }
];

/**
 * Run all pending migrations.
 */
export async function migrate(connectionString) {
  const client = await getClient(connectionString);

  try {
    await client.connect();

    // Ensure migration table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version   INT PRIMARY KEY,
        name      TEXT NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Get applied versions
    const { rows } = await client.query('SELECT version FROM _migrations ORDER BY version');
    const applied = new Set(rows.map(r => r.version));

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) {
        console.log(`  ✓ Migration ${migration.version} (${migration.name}) already applied`);
        continue;
      }

      console.log(`  → Running migration ${migration.version}: ${migration.name}...`);
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO _migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name]
        );
        await client.query('COMMIT');
        console.log(`  ✓ Migration ${migration.version} applied`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('All migrations complete.');
  } finally {
    await client.end();
  }
}

// CLI runner
const connStr = process.env.NEON_CONNECT_STRING
  || process.argv[2];

if (connStr) {
  migrate(connStr).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
} else {
  console.error('Usage: NEON_CONNECT_STRING=... node workers/src/db/migrate.js');
}
