-- AUDIT-DB-001: Drop dead database views never queried by application code
-- All queries use base tables directly; these views add schema maintenance burden
-- NOTE: checkin_streaks MV is kept — actively refreshed by cron.js step 4b

DROP VIEW IF EXISTS subscription_analytics CASCADE;
DROP VIEW IF EXISTS monthly_revenue CASCADE;
DROP VIEW IF EXISTS user_subscription_status CASCADE;
DROP VIEW IF EXISTS achievement_popularity CASCADE;
DROP VIEW IF EXISTS achievement_leaderboard CASCADE;
DROP VIEW IF EXISTS user_event_counts CASCADE;
DROP VIEW IF EXISTS v_active_users CASCADE;
DROP VIEW IF EXISTS v_event_trends CASCADE;
