-- Migration 018: Drop unused usage_tracking table
-- The usage_tracking table (003_billing) duplicates usage_records (base schema).
-- No queries, handlers, or routes reference usage_tracking.
-- usage_records is the canonical usage log.
--
-- BL-S15-M2

DROP TABLE IF EXISTS usage_tracking;
