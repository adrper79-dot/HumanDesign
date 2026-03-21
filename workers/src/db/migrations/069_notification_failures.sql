-- Migration 069: notification_failures table
-- Tracks native push (APNs / FCM) delivery failures for cron-driven retry.
-- Created by: WC-004 implementation

CREATE TABLE IF NOT EXISTS notification_failures (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint      VARCHAR(2048),
  reason        TEXT,
  retry_count   INT          NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_retry_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notif_failures_user
  ON notification_failures (user_id);

-- Cron retry query scans by (retry_count, created_at) with a 24-hour window
CREATE INDEX IF NOT EXISTS idx_notif_failures_retry
  ON notification_failures (retry_count, created_at);
