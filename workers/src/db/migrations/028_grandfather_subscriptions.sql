-- Migration 028: Add grandfathered_until column for price migration grace period
-- When new pricing goes live, existing subscribers get 90 days at their old rate.
-- After grandfathered_until passes, a scheduled job can migrate them to the new price.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS grandfathered_until TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient batch queries by scheduled migration job
CREATE INDEX IF NOT EXISTS idx_subscriptions_grandfathered
  ON subscriptions (grandfathered_until)
  WHERE grandfathered_until IS NOT NULL;

-- Stamp all current active subscriptions with a 90-day grace period from migration date
UPDATE subscriptions
SET grandfathered_until = NOW() + INTERVAL '90 days'
WHERE status = 'active'
  AND grandfathered_until IS NULL;
