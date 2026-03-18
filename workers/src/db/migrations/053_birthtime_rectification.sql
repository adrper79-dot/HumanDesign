-- Migration 053: Birthtime Rectification Progress Tracking (API-P2-1)
-- Stores rectification requests with progress tracking for long-running analyses

CREATE TABLE IF NOT EXISTS birthtime_rectifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Input parameters
  birth_date DATE NOT NULL,
  birth_time TIME NOT NULL,
  birth_timezone TEXT NOT NULL,
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  window_minutes INT NOT NULL DEFAULT 30,
  step_minutes INT NOT NULL DEFAULT 5,

  -- Progress tracking
  total_steps INT NOT NULL,
  completed_steps INT NOT NULL DEFAULT 0,
  percent_complete INT NOT NULL DEFAULT 0,

  -- Result storage
  result JSONB,

  -- Meta
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- Index for user queries (get their rectifications)
CREATE INDEX IF NOT EXISTS idx_birthtime_rectifications_user_id
  ON birthtime_rectifications(user_id, created_at DESC);

-- Index for cleanup (expired results)
CREATE INDEX IF NOT EXISTS idx_birthtime_rectifications_expires_at
  ON birthtime_rectifications(expires_at) WHERE status != 'completed';
