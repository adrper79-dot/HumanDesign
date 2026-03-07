-- ─── Achievements & Gamification Schema (PostgreSQL) ───────────────────
-- Tracks user achievements, progress, and gamification stats

-- ─── User Achievements Table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  points_awarded INTEGER NOT NULL DEFAULT 0,
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id),
  CHECK (achievement_id IN (
    'first_chart', 'profile_generated', 'first_transit',
    'week_streak', 'month_streak', 'daily_checker',
    'transit_explorer', 'timing_master', 'cycle_tracker',
    'composite_creator', 'cluster_member', 'referral_starter', 'referral_champion',
    'chart_collector', 'profile_master',
    'upgraded_seeker', 'upgraded_guide', 'upgraded_practitioner',
    'alert_setter', 'api_developer', 'webhook_integrator',
    'points_100', 'points_500', 'points_1000', 'points_2500'
  ))
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at ON user_achievements(unlocked_at DESC);

-- ─── Event Tracking Table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS achievement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (event_type IN (
    'chart_calculated', 'profile_generated', 'transit_checked', 'timing_calculated',
    'cycles_checked:saturn', 'cycles_checked:jupiter', 'cycles_checked:uranus',
    'composite_created', 'cluster_joined', 'referral_signup',
    'daily_login', 'alert_created',
    'api_key_created', 'webhook_created'
  ))
);

CREATE INDEX IF NOT EXISTS idx_achievement_events_user_id ON achievement_events(user_id);
CREATE INDEX IF NOT EXISTS idx_achievement_events_type ON achievement_events(event_type);
CREATE INDEX IF NOT EXISTS idx_achievement_events_created_at ON achievement_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_achievement_events_user_type ON achievement_events(user_id, event_type);

-- ─── User Streaks Table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  streak_type TEXT NOT NULL CHECK (streak_type IN ('daily_login', 'transit_checked')),
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, streak_type)
);

CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_current ON user_streaks(current_streak DESC);

-- ─── User Achievement Stats Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_achievement_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  total_achievements INTEGER NOT NULL DEFAULT 0,
  achievement_percentage INTEGER NOT NULL DEFAULT 0,
  last_achievement_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_achievement_stats_points ON user_achievement_stats(total_points DESC);

-- ─── Analytics Views ────────────────────────────────────────────────────

CREATE OR REPLACE VIEW achievement_popularity AS
SELECT 
  achievement_id,
  COUNT(*) as unlock_count,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(unlocked_at) as first_unlocked,
  MAX(unlocked_at) as last_unlocked
FROM user_achievements
GROUP BY achievement_id
ORDER BY unlock_count DESC;

CREATE OR REPLACE VIEW achievement_leaderboard AS
SELECT 
  u.id as user_id,
  u.email,
  u.tier,
  uas.total_points,
  uas.total_achievements,
  uas.achievement_percentage,
  uas.last_achievement_date,
  ROW_NUMBER() OVER (ORDER BY uas.total_points DESC, uas.total_achievements DESC) as rank
FROM users u
JOIN user_achievement_stats uas ON u.id = uas.user_id
WHERE uas.total_points > 0
ORDER BY uas.total_points DESC, uas.total_achievements DESC
LIMIT 100;

CREATE OR REPLACE VIEW user_event_counts AS
SELECT 
  user_id,
  event_type,
  COUNT(*) as event_count,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event
FROM achievement_events
GROUP BY user_id, event_type;

-- ─── Trigger: Auto-update stats on achievement unlock ───────────────────

CREATE OR REPLACE FUNCTION update_achievement_stats() RETURNS trigger AS $$
BEGIN
  INSERT INTO user_achievement_stats (user_id, total_points, total_achievements, last_achievement_date, updated_at)
  VALUES (NEW.user_id, NEW.points_awarded, 1, NEW.unlocked_at, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = user_achievement_stats.total_points + EXCLUDED.total_points,
    total_achievements = user_achievement_stats.total_achievements + 1,
    last_achievement_date = EXCLUDED.last_achievement_date,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_achievement_stats ON user_achievements;
CREATE TRIGGER trg_update_achievement_stats
AFTER INSERT ON user_achievements
FOR EACH ROW EXECUTE FUNCTION update_achievement_stats();
