-- Migration 054: Add share_with_client column to practitioner_session_notes
-- Enables practitioners to share specific notes with their clients via Client Portal

ALTER TABLE practitioner_session_notes
  ADD COLUMN IF NOT EXISTS share_with_client BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient client portal queries
CREATE INDEX IF NOT EXISTS idx_session_notes_client_shared
  ON practitioner_session_notes (client_user_id, share_with_client)
  WHERE share_with_client = true;

COMMENT ON COLUMN practitioner_session_notes.share_with_client
  IS 'When true, this note is visible to the client in their portal view';
