-- Bug Reporting & Issue Tracking System
-- Supports user-submitted bugs, internal issue tracking, automated validation, and repair staging

CREATE TABLE IF NOT EXISTS bug_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Report metadata
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  severity          TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  category          TEXT NOT NULL CHECK (category IN ('chart_calc', 'profile', 'auth', 'payment', 'transit', 'ui', 'api', 'other')),
  status            TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'triaged', 'assigned', 'in_progress', 'staged', 'fixed', 'closed', 'rejected')),
  
  -- Reporter info
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  email             TEXT,                    -- If user not logged in
  reporter_name     TEXT,                    -- If user not logged in
  
  -- Environment context (auto-captured from frontend)
  user_agent        TEXT,
  browser           TEXT,
  os_name           TEXT,
  viewport_width    INTEGER,
  viewport_height   INTEGER,
  page_url          TEXT,
  affected_section  TEXT,                   -- e.g. 'chart_display', 'checkout_form', 'transit_snapshot'
  
  -- Session & data context
  session_id        UUID,                   -- Session UUID if applicable (null for non-session bugs)
  chart_id          UUID REFERENCES charts(id) ON DELETE SET NULL,
  user_data         JSONB,                  -- Redacted user context (e.g. { "tier": "free", "has_chart": true })
  
  -- Reproduction context
  steps_to_reproduce TEXT,                  -- User's description of how to trigger bug
  expected_behavior TEXT,
  actual_behavior   TEXT,
  error_message     TEXT,                   -- Browser error/exception (if available)
  error_stack       TEXT,                   -- Stack trace (truncated, no secrets)
  
  -- Attachments & logs
  screenshot_url    TEXT,                   -- URL to uploaded screenshot (if provided)
  console_logs      JSONB,                  -- Last 10 browser console messages
  network_logs      JSONB,                  -- Last 5 failed API calls (redacted)
  
  -- Triage & assignment
  assigned_to       UUID REFERENCES users(id) ON DELETE SET NULL,    -- Developer assigned
  priority          INTEGER DEFAULT 0,      -- 1-100 for queue ordering
  root_cause        TEXT,                   -- Developer notes on root cause
  
  -- Fix info
  fix_description   TEXT,                   -- What will be changed
  fix_commit        TEXT,                   -- Git commit SHA when fixed
  fix_branch        TEXT,                   -- Branch where fix will be staged
  validation_script TEXT,                   -- SQL/script to verify fix
  
  -- Timestamps & workflow
  reported_at       TIMESTAMPTZ DEFAULT now(),
  triaged_at        TIMESTAMPTZ,
  assigned_at       TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  staged_at         TIMESTAMPTZ,
  fixed_at          TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  
  -- Automation tracking
  auto_validated    BOOLEAN DEFAULT false,  -- true if automated tests passed
  is_regression     BOOLEAN DEFAULT false,  -- true if this matches a known pattern
  duplicate_of      UUID REFERENCES bug_reports(id) ON DELETE SET NULL,
  
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON bug_reports (user_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports (status, priority DESC, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_severity ON bug_reports (severity, status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_category ON bug_reports (category, status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_assigned ON bug_reports (assigned_to, status) WHERE status IN ('assigned', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_bug_reports_chart ON bug_reports (chart_id) WHERE chart_id IS NOT NULL;

-- ─── Bug Comments / Discussion ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bug_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id            UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name       TEXT,                   -- If user_id is null
  author_role       TEXT,                   -- 'reporter', 'developer', 'admin'
  comment_type      TEXT DEFAULT 'note' CHECK (comment_type IN ('note', 'diagnostic', 'fix', 'question', 'status_update')),
  content           TEXT NOT NULL,
  mentions          TEXT[],                 -- Array of @mentioned user IDs
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_comments_bug ON bug_comments (bug_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_comments_author ON bug_comments (user_id);

-- ─── Validation Rules / Test Cases ────────────────────────────────────
CREATE TABLE IF NOT EXISTS bug_validations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id            UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  
  test_name         TEXT NOT NULL,
  test_type         TEXT NOT NULL CHECK (test_type IN ('sql', 'api', 'ui_snapshot', 'custom_script')),
  test_sql          TEXT,                   -- For SQL validation
  test_endpoint     TEXT,                   -- For API validation
  test_method       TEXT,                   -- GET, POST, etc.
  test_body         JSONB,
  expected_result   JSONB,                  -- For comparison
  
  passes            BOOLEAN,
  output            JSONB,                  -- Actual result
  run_at            TIMESTAMPTZ DEFAULT now(),
  
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bug_validations_bug ON bug_validations (bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_validations_result ON bug_validations (bug_id, passes, run_at DESC);

-- ─── Known Bug Patterns / Regression Detection ─────────────────────────
CREATE TABLE IF NOT EXISTS bug_patterns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name              TEXT NOT NULL,          -- "Stripe webhook timeout", "HDC calc precision"
  description       TEXT,
  
  -- Pattern matching
  regex_error       TEXT,                   -- Regex to match error messages
  affected_category TEXT[],                 -- Categories it affects
  
  -- Auto-detection
  regex_title       TEXT,                   -- Regex to auto-tag incoming reports
  regex_description TEXT,
  
  solution          TEXT,                   -- Generic solution / link to fix
  first_seen        TIMESTAMPTZ,
  last_seen         TIMESTAMPTZ,
  occurrence_count  INTEGER DEFAULT 1,
  
  fix_applied       BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_patterns_category ON bug_patterns USING GIN (affected_category);

-- ─── Bug Statistics & Metrics ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bug_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  metric_date       DATE NOT NULL,
  
  total_reported    INTEGER DEFAULT 0,
  fixed_count       INTEGER DEFAULT 0,
  avg_triage_time   INTERVAL,               -- Time from reported to triaged
  avg_fix_time      INTERVAL,               -- Time from reported to fixed
  critical_open     INTEGER DEFAULT 0,
  regression_count  INTEGER DEFAULT 0,
  
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bug_metrics_date ON bug_metrics (metric_date);

-- ─── Mutation Log (for audit trail) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS bug_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id            UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  changed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  change_type       TEXT NOT NULL,         -- 'status_change', 'assignment', 'comment_added', 'validation_run'
  
  old_value         TEXT,
  new_value         TEXT,
  reason            TEXT,
  
  timestamp         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_audit_bug ON bug_audit_log (bug_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bug_audit_user ON bug_audit_log (changed_by, timestamp DESC);
