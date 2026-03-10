#!/usr/bin/env node
/**
 * Database Migration Runner
 * 
 * Runs migrate.sql (base schema) + numbered migrations from src/db/migrations/.
 * Tracks applied migrations in schema_migrations table to avoid re-running.
 * 
 * Usage:
 *   NEON_CONNECTION_STRING="..." node run-migration.js
 *   node run-migration.js --status          # Show applied migrations
 *   node run-migration.js --file 003        # Run a specific migration
 */

import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rawArgs = process.argv.slice(2);
const positionalSqlArg = rawArgs.find(a => a.endsWith('.sql'));

// Support both env names used across scripts/docs.
const CONNECTION_STRING =
  process.env.NEON_CONNECTION_STRING ||
  process.env.NEON_CONNECT_STRING ||
  // Backward-compatible fallback: if first arg looks like a URL, treat it as connection string.
  (rawArgs[0] && /^postgres(ql)?:\/\//.test(rawArgs[0]) ? rawArgs[0] : undefined);

if (!CONNECTION_STRING) {
  console.error('❌ Missing database connection string.');
  console.error('   Set NEON_CONNECTION_STRING (or NEON_CONNECT_STRING) environment variable, or pass a connection URL as argument:');
  console.error('   NEON_CONNECTION_STRING="postgresql://..." node run-migration.js');
  process.exit(1);
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

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

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT migration_name, applied_at, checksum FROM schema_migrations ORDER BY migration_name');
  return new Map(result.rows.map(r => [r.migration_name, r]));
}

async function runMigration() {
  const args = rawArgs;
  const statusOnly = args.includes('--status');
  const specificFile = args.find((a, i) => args[i - 1] === '--file');
  // Operator-friendly mode: allow `node run-migration.js path/to/019_foo.sql`
  // and infer --file 019_foo from it.
  const inferredSpecificFile = !specificFile && positionalSqlArg
    ? positionalSqlArg.split('/').pop().split('\\').pop().replace('.sql', '')
    : undefined;

  console.log('🔄 Prime Self Migration Runner\n');

  const client = new Client({ connectionString: CONNECTION_STRING });

  try {
    console.log('📡 Connecting to Neon database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Ensure tracking table exists
    await ensureTrackingTable(client);
    const applied = await getAppliedMigrations(client);

    if (statusOnly) {
      console.log(`📋 Applied migrations (${applied.size}):\n`);
      for (const [name, info] of applied) {
        console.log(`  ✅ ${name} — ${new Date(info.applied_at).toISOString()} — ${info.checksum?.slice(0, 8) || 'no checksum'}`);
      }
      if (applied.size === 0) console.log('  (none)');
      return;
    }

    // 1. Run base schema (migrate.sql) — always idempotent (CREATE IF NOT EXISTS)
    const basePath = join(__dirname, 'src', 'db', 'migrate.sql');
    const baseSql = readFileSync(basePath, 'utf8');
    console.log('📄 Running base schema (migrate.sql)...');
    await client.query(baseSql);
    console.log('✅ Base schema applied.\n');

    // 2. Discover migration files
    const migrationsDir = join(__dirname, 'src', 'db', 'migrations');
    let files;
    try {
      files = readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Alphabetical = numeric order for NNN_ prefix files
    } catch {
      console.log('⚠️  No migrations directory found. Skipping numbered migrations.');
      files = [];
    }

    if (specificFile || inferredSpecificFile) {
      const target = specificFile || inferredSpecificFile;
      files = files.filter(f => f.startsWith(target));
      if (files.length === 0) {
        console.error(`❌ No migration file matching "${target}" found.`);
        process.exit(1);
      }
    }

    // 3. Run each unapplied migration
    let newCount = 0;
    for (const file of files) {
      const name = file.replace('.sql', '');
      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, 'utf8');
      const checksum = sha256(sql);

      if (applied.has(name)) {
        const prev = applied.get(name);
        if (prev.checksum && prev.checksum !== checksum) {
          console.warn(`⚠️  ${name}: CHECKSUM MISMATCH (file changed since applied). Skipping.`);
        } else {
          console.log(`  ⏭️  ${name} — already applied`);
        }
        continue;
      }

      console.log(`  🚀 ${name} — applying...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_name, checksum) VALUES ($1, $2)',
          [name, checksum]
        );
        await client.query('COMMIT');
        console.log(`  ✅ ${name} — done`);
        newCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌ ${name} — FAILED: ${err.message}`);
        console.error('  Halting migration run. Fix the error and re-run.\n');
        process.exit(1);
      }
    }

    console.log(`\n🎉 Migration complete! ${newCount} new migration(s) applied.`);

    // 4. Verify key tables
    console.log('\n🔍 Verifying core tables...');
    const result = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    console.log(`  ${result.rows.length} tables found:`);
    result.rows.forEach(row => console.log(`    - ${row.tablename}`));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) console.error(`  Error code: ${error.code}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
