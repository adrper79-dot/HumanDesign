-- Daily Check-In & Validation Journal (BL-ENG-005)
-- Tracks daily alignment scores, strategy adherence, and streak tracking
-- Enables long-term trend analysis and transit correlation

-- Daily Check-In Entries
CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,  -- Date of check-in (user's local date)
  
  -- Alignment Tracking
  alignment_score INTEGER NOT NULL CHECK (alignment_score >= 1 AND alignment_score <= 10),  -- 1-10 scale
  followed_strategy BOOLEAN NOT NULL,  -- Did you follow your strategy today?
  followed_authority BOOLEAN NOT NULL,  -- Did you follow your authority today?
  
  -- Qualitative Data
  notes TEXT,  -- Free-text reflection
  mood TEXT,  -- 'great', 'good', 'neutral', 'challenging', 'difficult'
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),  -- Optional 1-10 scale
  
  -- Transit Context (snapshot)
  transit_snapshot JSONB,  -- Current transits at time of check-in
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate check-ins on same date
  UNIQUE(user_id, checkin_date)
);

-- Indexes
CREATE INDEX idx_daily_checkins_user_id ON daily_checkins(user_id);
CREATE INDEX idx_daily_checkins_user_date ON daily_checkins(user_id, checkin_date DESC);
CREATE INDEX idx_daily_checkins_date ON daily_checkins(checkin_date DESC);
CREATE INDEX idx_daily_checkins_alignment ON daily_checkins(user_id, alignment_score);

-- Streak Tracking (Materialized View for Performance)
-- Calculates consecutive check-in days for each user
CREATE MATERIALIZED VIEW IF NOT EXISTS checkin_streaks AS
WITH user_dates AS (
  SELECT 
    user_id,
    checkin_date,
    LAG(checkin_date) OVER (PARTITION BY user_id ORDER BY checkin_date) AS prev_date
  FROM daily_checkins
),
streak_groups AS (
  SELECT 
    user_id,
    checkin_date,
    SUM(CASE WHEN checkin_date - prev_date > 1 THEN 1 ELSE 0 END) 
      OVER (PARTITION BY user_id ORDER BY checkin_date) AS streak_group
  FROM user_dates
)
SELECT 
  user_id,
  MAX(checkin_date) AS last_checkin_date,
  COUNT(*) AS current_streak,
  MIN(checkin_date) AS streak_start_date
FROM streak_groups
WHERE streak_group = (
  SELECT MAX(streak_group) 
  FROM streak_groups sg 
  WHERE sg.user_id = streak_groups.user_id
)
GROUP BY user_id, streak_group;

-- Index on materialized view
CREATE UNIQUE INDEX idx_checkin_streaks_user ON checkin_streaks(user_id);

-- Refresh function (called after each check-in)
CREATE OR REPLACE FUNCTION refresh_checkin_streaks()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY checkin_streaks;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-refresh streaks
CREATE TRIGGER trigger_refresh_checkin_streaks
AFTER INSERT OR UPDATE OR DELETE ON daily_checkins
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_checkin_streaks();

-- Check-In Reminders (Scheduled Notifications)
CREATE TABLE IF NOT EXISTS checkin_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Reminder Settings
  enabled BOOLEAN DEFAULT true,
  reminder_time TIME NOT NULL DEFAULT '20:00:00',  -- 8 PM default
  timezone TEXT NOT NULL DEFAULT 'UTC',
  
  -- Notification Preferences
  notification_method TEXT[] DEFAULT ARRAY['push'],  -- 'push', 'email', 'sms'
  
  -- Last Sent
  last_sent_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_checkin_reminders_user_id ON checkin_reminders(user_id);
CREATE INDEX idx_checkin_reminders_enabled ON checkin_reminders(enabled);

-- Alignment Trends (Pre-aggregated for Performance)
-- Daily, weekly, monthly averages for fast chart rendering
CREATE TABLE IF NOT EXISTS alignment_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Time Period
  period_type TEXT NOT NULL,  -- 'day', 'week', 'month'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Aggregates
  avg_alignment_score NUMERIC(4,2),
  avg_energy_level NUMERIC(4,2),
  checkin_count INTEGER,
  strategy_adherence_rate NUMERIC(4,2),  -- Percentage of days followed strategy
  authority_adherence_rate NUMERIC(4,2),
  
  -- Mood Distribution
  mood_distribution JSONB,  -- {"great": 2, "good": 3, "neutral": 1, ...}
  
  -- Transit Correlation (Optional Future Enhancement)
  most_common_transits JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, period_type, period_start)
);

CREATE INDEX idx_alignment_trends_user_period ON alignment_trends(user_id, period_type, period_start DESC);

-- Function to Calculate and Store Trends (Called by Cron)
CREATE OR REPLACE FUNCTION calculate_alignment_trends(p_user_id UUID, p_period_type TEXT, p_period_start DATE, p_period_end DATE)
RETURNS VOID AS $$
BEGIN
  INSERT INTO alignment_trends (
    user_id,
    period_type,
    period_start,
    period_end,
    avg_alignment_score,
    avg_energy_level,
    checkin_count,
    strategy_adherence_rate,
    authority_adherence_rate,
    mood_distribution
  )
  SELECT 
    p_user_id,
    p_period_type,
    p_period_start,
    p_period_end,
    AVG(alignment_score),
    AVG(energy_level),
    COUNT(*),
    (COUNT(*) FILTER (WHERE followed_strategy = true) * 100.0 / COUNT(*)),
    (COUNT(*) FILTER (WHERE followed_authority = true) * 100.0 / COUNT(*)),
    jsonb_object_agg(mood, mood_count)
  FROM (
    SELECT 
      mood,
      COUNT(*) AS mood_count
    FROM daily_checkins
    WHERE user_id = p_user_id
      AND checkin_date >= p_period_start
      AND checkin_date <= p_period_end
    GROUP BY mood
  ) mood_counts
  CROSS JOIN (
    SELECT 
      alignment_score,
      energy_level,
      followed_strategy,
      followed_authority
    FROM daily_checkins
    WHERE user_id = p_user_id
      AND checkin_date >= p_period_start
      AND checkin_date <= p_period_end
  ) checkins
  ON CONFLICT (user_id, period_type, period_start) DO UPDATE SET
    period_end = EXCLUDED.period_end,
    avg_alignment_score = EXCLUDED.avg_alignment_score,
    avg_energy_level = EXCLUDED.avg_energy_level,
    checkin_count = EXCLUDED.checkin_count,
    strategy_adherence_rate = EXCLUDED.strategy_adherence_rate,
    authority_adherence_rate = EXCLUDED.authority_adherence_rate,
    mood_distribution = EXCLUDED.mood_distribution,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;
