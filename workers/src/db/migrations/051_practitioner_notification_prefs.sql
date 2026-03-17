-- 051_practitioner_notification_prefs.sql
-- Adds notification_preferences JSONB column to practitioners table.
-- Keys: clientChartReady (boolean), clientSessionReady (boolean).
-- Default: both enabled.

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL
    DEFAULT '{"clientChartReady":true,"clientSessionReady":true}'::jsonb;
