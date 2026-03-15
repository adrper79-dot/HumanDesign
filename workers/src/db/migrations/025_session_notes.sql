-- Migration 025: Practitioner Session Notes
-- HD_UPDATES4 Vector 1: Session notes with share_with_ai flag for AI context injection
-- HD_UPDATES4 Vector 3: Per-client AI context field

-- Session notes table — practitioners write notes per client per session
CREATE TABLE IF NOT EXISTS practitioner_session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  share_with_ai BOOLEAN NOT NULL DEFAULT false,
  transit_snapshot JSONB,          -- snapshot of client's transits at session time
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_session_notes_practitioner
  ON practitioner_session_notes(practitioner_id, client_user_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_session_notes_ai_shared
  ON practitioner_session_notes(client_user_id, share_with_ai)
  WHERE share_with_ai = true;

-- Per-client AI context — standing brief from practitioner (HD_UPDATES4 Vector 3)
ALTER TABLE practitioner_clients
  ADD COLUMN IF NOT EXISTS ai_context TEXT DEFAULT '';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_session_notes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_session_notes_updated
  BEFORE UPDATE ON practitioner_session_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_session_notes_timestamp();
