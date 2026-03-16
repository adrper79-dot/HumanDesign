-- Migration 040: Add last_login_at to users
-- Referenced in 13 places in queries.js (getUserBy*, updateLastLoginAt,
-- cronGetReengagementUsers, admin analytics) and updated on every login
-- in auth.js. Was missing from all prior migrations — column may have been
-- added manually to production. IF NOT EXISTS makes this safe to apply either way.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill from updated_at as best available proxy for existing rows.
-- Only sets it where it is currently NULL so we don't overwrite real data.
UPDATE users
  SET last_login_at = updated_at
  WHERE last_login_at IS NULL
    AND updated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_last_login_at
  ON users (last_login_at)
  WHERE last_login_at IS NOT NULL;

COMMIT;
