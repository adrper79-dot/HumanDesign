-- BL-S15-H2: Replace per-statement materialized view refresh with cron-based approach
--
-- Problem: The trigger_refresh_checkin_streaks trigger fires
-- REFRESH MATERIALIZED VIEW CONCURRENTLY on every INSERT/UPDATE/DELETE
-- on daily_checkins. This is expensive and creates a bottleneck at scale.
--
-- Fix: Drop the trigger. The materialized view will be refreshed by the
-- daily cron job (scheduled handler) instead. Streak data may be up to
-- 24h stale, but this is acceptable for the check-in streak use case.
-- For real-time streak display, use a direct query with window functions.

-- Drop the per-statement trigger
DROP TRIGGER IF EXISTS trigger_refresh_checkin_streaks ON daily_checkins;

-- Keep the function for manual or cron-based refresh
-- (called from Workers cron.js instead of per-row trigger)
CREATE OR REPLACE FUNCTION refresh_checkin_streaks()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY checkin_streaks;
END;
$$ LANGUAGE plpgsql;

-- Create a fast inline query alternative for real-time streak lookups
-- (use this in the checkin handler instead of the materialized view)
CREATE OR REPLACE FUNCTION get_user_streak(p_user_id UUID)
RETURNS TABLE(current_streak INT, last_checkin_date DATE) AS $$
  WITH ordered_checkins AS (
    SELECT
      checkin_date,
      checkin_date - (ROW_NUMBER() OVER (ORDER BY checkin_date DESC))::INT AS grp
    FROM daily_checkins
    WHERE user_id = p_user_id
  )
  SELECT 
    COUNT(*)::INT AS current_streak,
    MAX(checkin_date) AS last_checkin_date
  FROM ordered_checkins
  WHERE grp = (
    SELECT grp FROM ordered_checkins ORDER BY checkin_date DESC LIMIT 1
  );
$$ LANGUAGE sql STABLE;
