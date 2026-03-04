/**
 * Database Migration — Neon PostgreSQL
 *
 * Executes migrate.sql as the single source of truth for schema.
 * Run via: node workers/src/db/migrate.js
 */

import { getClient } from './queries.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run all migrations from migrate.sql.
 */
export async function migrate(connectionString) {
  const client = await getClient(connectionString);

  try {
    await client.connect();
    console.log('Connected to database');

    // Read migrate.sql as single source of truth
    const sqlPath = join(__dirname, 'migrate.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    console.log(`Executing schema from ${sqlPath}...`);
    await client.query(sql);
    console.log('✓ Schema migration complete');
    
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

// CLI runner
const connStr = process.env.NEON_CONNECTION_STRING
  || process.env.NEON_CONNECT_STRING
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

