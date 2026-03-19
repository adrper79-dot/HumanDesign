-- Migration 061: Google Calendar Tokens — Item 3.2
-- Stores encrypted OAuth tokens for Google Calendar 2-way sync

CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_access_token  TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  token_expiry            TIMESTAMPTZ,
  calendar_id             TEXT DEFAULT 'primary',
  sync_token              TEXT,
  last_synced_at          TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_google_cal_tokens_user ON google_calendar_tokens(user_id);
