-- ─────────────────────────────────────────────────────────────
-- Migration 015: Database Query Optimization (BL-OPT-002)
-- ─────────────────────────────────────────────────────────────
-- Adds missing indexes for foreign keys, composite indexes for
-- common query patterns, and partial indexes for filtered lookups.
--
-- Safe to run idempotently (all IF NOT EXISTS).
-- Run: node workers/run-migration.js workers/src/db/migrations/015_query_optimization.sql

-- ─── Missing Foreign Key Indexes ─────────────────────────────

-- profiles.chart_id — FK cascade performance when charts are deleted
CREATE INDEX IF NOT EXISTS idx_profiles_chart_id
  ON profiles (chart_id);

-- practitioner_clients.client_user_id — reverse lookup for checkPractitionerAccess
CREATE INDEX IF NOT EXISTS idx_pc_client_user_id
  ON practitioner_clients (client_user_id);

-- clusters.created_by — lookup by cluster creator
CREATE INDEX IF NOT EXISTS idx_clusters_created_by
  ON clusters (created_by);

-- cluster_members.user_id — covers getClustersByUser JOIN
CREATE INDEX IF NOT EXISTS idx_cluster_members_user_id
  ON cluster_members (user_id);

-- experiment_conversions.user_id — per-user conversion lookups
CREATE INDEX IF NOT EXISTS idx_exp_conversions_user_id
  ON experiment_conversions (user_id);

-- ─── Composite Indexes for Common Query Patterns ─────────────

-- P1: usage_records — covers getUsageByUserAndAction (quota check on every API call)
-- Query: WHERE user_id = $1 AND action = $2 AND created_at >= $3
CREATE INDEX IF NOT EXISTS idx_usage_user_action_created
  ON usage_records (user_id, action, created_at DESC);

-- P2: subscriptions — covers revenue analytics & churn queries
-- Query: WHERE status = 'canceled' AND updated_at >= ...
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_updated
  ON subscriptions (status, updated_at DESC);

-- P3: subscriptions — covers getSubscriptionByStripeSubscriptionId
-- Query: WHERE stripe_subscription_id = $1
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id
  ON subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ─── Partial Indexes for Filtered Lookups ────────────────────

-- P4: users — cron daily SMS digest (eliminates full table scan)
-- Query: WHERE sms_opted_in = true AND phone IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_users_sms_opted_phone
  ON users (id)
  WHERE sms_opted_in = true AND phone IS NOT NULL;

-- P5: webhooks — dispatch lookup
-- Query: WHERE user_id = ? AND active = true
CREATE INDEX IF NOT EXISTS idx_webhooks_user_active
  ON webhooks (user_id)
  WHERE active = true;

-- ─── GIN Indexes for JSONB Columns ──────────────────────────

-- P6: analytics_events.properties — covers error analytics GROUP BY on properties->>'message'
-- Using jsonb_path_ops for smaller index size (supports @> operator)
CREATE INDEX IF NOT EXISTS idx_ae_properties_gin
  ON analytics_events USING GIN (properties jsonb_path_ops);

-- ─── Add Missing 'tier' Column to Users ─────────────────────
-- Handlers reference users.tier but no migration adds it.
-- Default 'free' matches the tier system design.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'tier'
  ) THEN
    ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'free';
    CREATE INDEX idx_users_tier ON users (tier);
  END IF;
END $$;

-- ─── Cleanup: Drop Redundant Single-Column Indexes ──────────
-- These are covered by composite/unique indexes and waste write I/O.
-- Only drop if the covering index exists.

-- user_achievements.user_id is covered by UNIQUE(user_id, achievement_id)
-- DROP INDEX IF EXISTS idx_user_achievements_user_id;  -- Uncomment after verifying UNIQUE exists

-- user_streaks.user_id is covered by UNIQUE(user_id, streak_type)
-- DROP INDEX IF EXISTS idx_user_streaks_user_id;  -- Uncomment after verifying UNIQUE exists

-- ─── Add Summary Comment ────────────────────────────────────
COMMENT ON INDEX idx_usage_user_action_created IS 'BL-OPT-002: Composite index for quota checks (getUsageByUserAndAction)';
COMMENT ON INDEX idx_users_sms_opted_phone IS 'BL-OPT-002: Partial index for daily SMS digest cron';
COMMENT ON INDEX idx_ae_properties_gin IS 'BL-OPT-002: GIN index for analytics error property lookups';
