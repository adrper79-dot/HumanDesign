-- Migration 036: Email verification (AUDIT-SEC-003)
-- Adds email_verified column and verification token table.
-- Gates LLM usage behind verified email to prevent abuse.

BEGIN;

-- Column may already exist on live DB (added manually).
-- ADD COLUMN IF NOT EXISTS is safe / idempotent.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- Verification tokens — stores SHA-256 hash, not raw token.
-- Pattern mirrors password_reset_tokens.
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup by token hash (verification endpoint)
CREATE INDEX IF NOT EXISTS idx_evt_token_hash
  ON email_verification_tokens(token_hash);

-- Fast lookup by user (resend / cleanup)
CREATE INDEX IF NOT EXISTS idx_evt_user_id
  ON email_verification_tokens(user_id);

COMMIT;
