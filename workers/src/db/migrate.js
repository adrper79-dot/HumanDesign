/**
 * Database Migration — Neon PostgreSQL
 *
 * BL-S15-C2: Runs migrate.sql (base schema) AND numbered migrations
 * from src/db/migrations/. Tracks applied migrations in schema_migrations
 * table to avoid re-running. This is the single migration entry point.
 *
 * Run via: npm run migrate (from workers/)
 *   or:   NEON_CONNECTION_STRING="..." node workers/src/db/migrate.js
 */

import { getClient } from './queries.js';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Ensure the migration tracking table exists.
 */
async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id              SERIAL PRIMARY KEY,
      migration_name  TEXT UNIQUE NOT NULL,
      applied_at      TIMESTAMPTZ DEFAULT now(),
      checksum        TEXT
    );
  `);
}

/**
 * Get list of already-applied migrations from the tracking table.
 */
async function getAppliedMigrations(client) {
  const result = await client.query(
    'SELECT migration_name, checksum FROM schema_migrations ORDER BY migration_name'
  );
  return new Map(result.rows.map(r => [r.migration_name, r]));
}

/**
 * Run base schema + all numbered migrations.
 */
export async function migrate(connectionString) {
  const client = await getClient(connectionString);

  try {
    await client.connect();
    console.log('Connected to database');

    // 1. Run migrate.sql as base schema (idempotent — uses CREATE IF NOT EXISTS)
    const sqlPath = join(__dirname, 'migrate.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    console.log(`Executing base schema from ${sqlPath}...`);
    await client.query(sql);
    console.log('✓ Base schema applied');

    // 2. Ensure migration tracking table exists
    await ensureTrackingTable(client);
    const applied = await getAppliedMigrations(client);

    // 3. Discover and apply numbered migrations
    const migrationsDir = join(__dirname, 'migrations');
    let files = [];
    try {
      files = readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Alphabetical = numeric order for NNN_ prefix
    } catch {
      console.log('⚠  No migrations directory found. Skipping numbered migrations.');
    }

    let newCount = 0;
    for (const file of files) {
      const name = file.replace('.sql', '');
      const filePath = join(migrationsDir, file);
      const migrationSql = readFileSync(filePath, 'utf-8');
      const checksum = sha256(migrationSql);

      if (applied.has(name)) {
        const prev = applied.get(name);
        if (prev.checksum && prev.checksum !== checksum) {
          console.warn(`⚠  ${name}: CHECKSUM MISMATCH (file changed since applied). Skipping.`);
        } else {
          console.log(`  ⏭  ${name} — already applied`);
        }
        continue;
      }

      console.log(`  🚀 ${name} — applying...`);
      await client.query('BEGIN');
      try {
        await client.query(migrationSql);
        await client.query(
          'INSERT INTO schema_migrations (migration_name, checksum) VALUES ($1, $2)',
          [name, checksum]
        );
        await client.query('COMMIT');
        console.log(`  ✓ ${name} — done`);
        newCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${name} — FAILED: ${err.message}`);
        throw err;
      }
    }

    console.log(`\n✓ Migration complete! ${newCount} new migration(s) applied.`);

  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

// CLI runner
const connStr = process.env.NEON_CONNECTION_STRING
  || process.argv[2];

if (connStr) {
  migrate(connStr).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
} else {
  console.error('Usage: NEON_CONNECTION_STRING=... node workers/src/db/migrate.js');
  process.exit(1);
}

