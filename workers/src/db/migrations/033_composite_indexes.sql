-- AUDIT-DB-005: Add missing composite indexes for compound WHERE queries
-- These tables are queried with multi-column WHERE clauses but only have single-column indexes
-- NOTE: CONCURRENTLY removed so this runs safely inside the migration runner transaction.

CREATE INDEX IF NOT EXISTS idx_transit_alerts_user_active
  ON transit_alerts (user_id, active);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active
  ON push_subscriptions (user_id, active);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_alert_trigger
  ON alert_deliveries (alert_id, trigger_date);
