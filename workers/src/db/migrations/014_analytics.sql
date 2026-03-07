-- Migration 014: Analytics & Event Tracking Infrastructure (BL-ANA-001)
-- Provides event capture, session tracking, and aggregation for analytics dashboard.

-- ─── Analytics Events ─────────────────────────────────────────────────
-- High-volume append-only table for all trackable user actions.
-- Design: narrow columns, no JOINs on write path, partition-friendly by date.

CREATE TABLE IF NOT EXISTS analytics_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name      TEXT NOT NULL,                -- e.g. 'chart_calculate', 'signup', 'upgrade', 'page_view'
  user_id         UUID,                         -- NULL for anonymous events
  session_id      TEXT,                         -- Client-generated session identifier
  properties      JSONB DEFAULT '{}',           -- Flexible key-value payload (page, referrer, tier, etc.)
  device_type     TEXT,                         -- 'mobile', 'tablet', 'desktop'
  country         TEXT,                         -- ISO 3166-1 alpha-2 from CF headers
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Write-path index: user lookups for per-user analytics
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events (user_id) WHERE user_id IS NOT NULL;

-- Read-path indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created ON analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events (session_id) WHERE session_id IS NOT NULL;

-- ─── Daily Aggregates ─────────────────────────────────────────────────
-- Pre-computed daily rollups to avoid scanning analytics_events for dashboard.
-- Populated by cron job or on-demand aggregation.

CREATE TABLE IF NOT EXISTS analytics_daily (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date      DATE NOT NULL,
  event_name      TEXT NOT NULL,
  event_count     INTEGER DEFAULT 0,
  unique_users    INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  properties_agg  JSONB DEFAULT '{}',           -- e.g. { "tier_breakdown": { "free": 80, "seeker": 15 } }
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_date, event_name)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily (event_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_name ON analytics_daily (event_name, event_date DESC);

-- ─── Conversion Funnel Steps ──────────────────────────────────────────
-- Tracks user progression through defined funnels (signup → chart → profile → upgrade).

CREATE TABLE IF NOT EXISTS funnel_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  funnel_name     TEXT NOT NULL,                -- e.g. 'onboarding', 'upgrade'
  step_name       TEXT NOT NULL,                -- e.g. 'signup', 'first_chart', 'first_profile', 'upgrade'
  step_order      INTEGER NOT NULL,
  completed_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, funnel_name, step_name)
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_funnel ON funnel_events (funnel_name, step_order);
CREATE INDEX IF NOT EXISTS idx_funnel_events_user ON funnel_events (user_id, funnel_name);

-- ─── Experiments (A/B Testing) ────────────────────────────────────────
-- BL-ANA-005 schema (created now so migration is consolidated)

CREATE TABLE IF NOT EXISTS experiments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,          -- e.g. 'pricing_page_v2', 'onboarding_flow_b'
  description     TEXT,
  status          TEXT DEFAULT 'draft',          -- 'draft', 'running', 'paused', 'completed'
  variants        JSONB NOT NULL DEFAULT '["control","treatment"]',
  traffic_pct     INTEGER DEFAULT 100,           -- % of eligible users enrolled (0-100)
  start_date      TIMESTAMPTZ,
  end_date        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiment_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  variant         TEXT NOT NULL,                 -- 'control' or 'treatment'
  assigned_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (experiment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_exp_assignments_exp ON experiment_assignments (experiment_id, variant);
CREATE INDEX IF NOT EXISTS idx_exp_assignments_user ON experiment_assignments (user_id);

CREATE TABLE IF NOT EXISTS experiment_conversions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  variant         TEXT NOT NULL,
  conversion_name TEXT NOT NULL,                 -- e.g. 'signup', 'upgrade', 'chart_generate'
  converted_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exp_conversions_exp ON experiment_conversions (experiment_id, variant, conversion_name);

-- ─── Materialized Views for Dashboard ─────────────────────────────────

-- DAU/WAU/MAU (run daily via cron or on-demand)
CREATE OR REPLACE VIEW v_active_users AS
SELECT
  COUNT(DISTINCT CASE WHEN created_at >= CURRENT_DATE THEN user_id END) AS dau,
  COUNT(DISTINCT CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN user_id END) AS wau,
  COUNT(DISTINCT CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN user_id END) AS mau
FROM analytics_events
WHERE user_id IS NOT NULL;

-- Event counts per day (last 30 days)
CREATE OR REPLACE VIEW v_event_trends AS
SELECT
  DATE(created_at) AS event_date,
  event_name,
  COUNT(*) AS event_count,
  COUNT(DISTINCT user_id) AS unique_users
FROM analytics_events
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), event_name
ORDER BY event_date DESC, event_count DESC;
