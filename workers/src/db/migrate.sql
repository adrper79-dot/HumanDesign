-- Prime Self — Neon PostgreSQL Schema Migration
-- Base schema: core tables required for the platform.
-- Run via `node run-migration.js` which applies this file PLUS
-- all numbered migrations in src/db/migrations/ (003–015).
--
-- Base tables (17): users, charts, profiles, transit_snapshots, practitioners,
--   practitioner_clients, clusters, cluster_members, sms_messages,
--   validation_data, psychometric_data, diary_entries, subscriptions,
--   payment_events, usage_records, share_events, schema_migrations.
--
-- Migration-only tables (30): invoices, usage_tracking, promo_codes, referrals,
--   user_achievements, achievement_events, user_streaks, user_achievement_stats,
--   webhooks, webhook_deliveries, push_subscriptions, push_notifications,
--   notification_preferences, transit_alerts, alert_deliveries, alert_templates,
--   api_keys, api_usage, oauth_states, notion_connections, notion_syncs,
--   notion_pages, daily_checkins, checkin_reminders, alignment_trends,
--   analytics_events, analytics_daily, funnel_events, experiments,
--   experiment_assignments, experiment_conversions.
--
-- Usage:
--   NEON_CONNECTION_STRING="..." node run-migration.js
--   node run-migration.js --status   # Show applied migrations

-- ─── Extensions ──────────────────────────────────────────────
-- uuid-ossp removed: gen_random_uuid() is built into PostgreSQL 13+

-- ─── Migration Tracking ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  id              SERIAL PRIMARY KEY,
  migration_name  TEXT UNIQUE NOT NULL,
  applied_at      TIMESTAMPTZ DEFAULT now(),
  checksum        TEXT
);

CREATE INDEX IF NOT EXISTS idx_migrations_name ON schema_migrations (migration_name);

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE,
  phone         TEXT UNIQUE,
  password_hash TEXT,          -- PBKDF2-SHA256 hash (salt:hash base64)
  birth_date    DATE,
  birth_time    TIME,
  birth_tz      TEXT,          -- IANA timezone e.g. 'America/New_York'
  birth_lat     DOUBLE PRECISION,
  birth_lng     DOUBLE PRECISION,
  sms_opted_in  BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);

-- ─── Charts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  hd_json       JSONB NOT NULL,
  astro_json    JSONB,
  calculated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_charts_user ON charts (user_id, calculated_at DESC);

-- ─── Profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  chart_id        UUID REFERENCES charts(id) ON DELETE SET NULL,
  profile_json    JSONB NOT NULL,
  model_used      TEXT,
  grounding_audit JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles (user_id, created_at DESC);

-- ─── Transit Snapshots ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS transit_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date   DATE UNIQUE NOT NULL,
  positions_json  JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transit_date ON transit_snapshots (snapshot_date);

-- ─── Practitioners ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practitioners (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  certified BOOLEAN DEFAULT false,
  tier      TEXT DEFAULT 'free'
);

-- ─── Practitioner ↔ Client ──────────────────────────────────
CREATE TABLE IF NOT EXISTS practitioner_clients (
  practitioner_id UUID REFERENCES practitioners(id) ON DELETE CASCADE,
  client_user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (practitioner_id, client_user_id)
);

-- ─── Clusters ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clusters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  challenge   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Cluster Members ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cluster_members (
  cluster_id  UUID REFERENCES clusters(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  forge_role  TEXT,
  joined_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (cluster_id, user_id)
);

-- ─── SMS Messages ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_messages (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body      TEXT NOT NULL,
  sent_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_user ON sms_messages (user_id, sent_at DESC);

-- ─── Behavioral Validation Data ─────────────────────────────
CREATE TABLE IF NOT EXISTS validation_data (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  decision_pattern    TEXT,   -- How they make decisions (validates Authority)
  energy_pattern      TEXT,   -- Energy mechanics (validates Type)
  current_focus       TEXT,   -- Current challenge/question (personalization)
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validation_user ON validation_data (user_id);

-- ─── Psychometric Assessment Data ───────────────────────────
CREATE TABLE IF NOT EXISTS psychometric_data (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  big_five_scores     JSONB,  -- { openness: 4.2, conscientiousness: 3.8, ... }
  via_strengths       JSONB,  -- [{ rank: 1, strength: 'Curiosity', score: 4.8 }, ...]
  completed_at        TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psychometric_user ON psychometric_data (user_id);

-- ─── Diary / Life Events Journal ────────────────────────────
CREATE TABLE IF NOT EXISTS diary_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  event_date          DATE NOT NULL,
  event_title         TEXT NOT NULL,
  event_description   TEXT,
  event_type          TEXT,   -- 'career', 'relationship', 'health', 'spiritual', 'other'
  significance        TEXT,   -- 'major', 'moderate', 'minor'
  transit_snapshot    JSONB,  -- Auto-captured transits at event_date (for correlation)
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diary_user ON diary_entries (user_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_diary_date ON diary_entries (event_date);

-- ─── Subscriptions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT UNIQUE NOT NULL,
  stripe_subscription_id  TEXT UNIQUE,
  tier                    TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'seeker', 'guide', 'practitioner')),
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'unpaid', 'trialing')),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions (tier);

-- ─── Payment Events ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_event_id     TEXT UNIQUE NOT NULL,
  event_type          TEXT NOT NULL,
  amount              INTEGER,           -- Amount in cents
  currency            TEXT DEFAULT 'usd',
  status              TEXT,              -- 'succeeded', 'failed', 'pending'
  failure_reason      TEXT,
  raw_event           JSONB,             -- Full Stripe event for debugging
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_subscription ON payment_events (subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_stripe ON payment_events (stripe_event_id);

-- ─── Usage Tracking ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,  -- 'chart_calculation', 'profile_generation', 'api_call', 'sms_sent'
  endpoint      TEXT,           -- API endpoint called
  quota_cost    INTEGER DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_records (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_action ON usage_records (action, created_at DESC);

-- ─── Share Events ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS share_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  share_type    TEXT NOT NULL,  -- 'celebrity_match', 'chart', 'achievement', 'referral'
  share_data    JSONB,          -- Context data (celebrity name, achievement ID, etc.)
  platform      TEXT,           -- 'twitter', 'facebook', 'linkedin', 'whatsapp', 'email', 'unknown'
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_events_user ON share_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_events_type ON share_events (share_type, created_at DESC);

-- ─── Refresh Tokens ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,       -- SHA-256 hash of the JWT
  family_id   UUID NOT NULL,              -- rotation family — shared across a refresh chain
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,               -- set when rotated or explicitly revoked
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash   ON refresh_tokens (token_hash) WHERE revoked_at IS NULL;

-- ─── Done ────────────────────────────────────────────────────
-- All tables use IF NOT EXISTS — safe to re-run.
