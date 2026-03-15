-- Migration 027: One-Time Purchase Support Columns
-- HD_UPDATES3: Support transit passes, lifetime access, and revenue share tracking

-- Transit pass: expiry date for one-time transit pass purchases
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS transit_pass_expires TIMESTAMPTZ DEFAULT NULL;

-- Lifetime access flag: set when user purchases lifetime individual tier
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS lifetime_access BOOLEAN NOT NULL DEFAULT false;

-- Index for transit pass enforcement (find active passes efficiently)
CREATE INDEX IF NOT EXISTS idx_users_transit_pass_active
  ON users (transit_pass_expires)
  WHERE transit_pass_expires IS NOT NULL;
