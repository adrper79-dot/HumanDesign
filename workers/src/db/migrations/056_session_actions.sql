-- Migration 056: Session Actions
-- Practitioner-assigned actions for clients (homework, exercises, follow-ups)

CREATE TABLE IF NOT EXISTS session_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  session_note_id UUID REFERENCES practitioner_session_notes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_actions_practitioner_client
  ON session_actions (practitioner_id, client_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_actions_client_pending
  ON session_actions (client_user_id, status)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION update_session_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_session_actions_updated_at
  BEFORE UPDATE ON session_actions
  FOR EACH ROW EXECUTE FUNCTION update_session_actions_updated_at();
