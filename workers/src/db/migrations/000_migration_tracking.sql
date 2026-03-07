-- Migration Tracking Table
-- Records which migrations have been applied and when.
-- This migration is idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS schema_migrations (
  id              SERIAL PRIMARY KEY,
  migration_name  TEXT UNIQUE NOT NULL,        -- e.g. '003_billing'
  applied_at      TIMESTAMPTZ DEFAULT now(),
  checksum        TEXT                          -- optional: SHA-256 of migration file for drift detection
);

CREATE INDEX IF NOT EXISTS idx_migrations_name ON schema_migrations (migration_name);
