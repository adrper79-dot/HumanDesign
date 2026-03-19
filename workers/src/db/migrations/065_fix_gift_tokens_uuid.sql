-- Migration 065: Fix gift_tokens FK type mismatch (UUID-2A)
--
-- Migration 062 defined practitioner_id and redeemed_by as BIGINT, but both
-- reference UUID primary-key columns (practitioners.id and users.id).
-- PostgreSQL rejects that FK type mismatch, so the table was never created.
-- This migration drops any partial state and recreates it with correct types.

DROP TABLE IF EXISTS gift_tokens;

CREATE TABLE gift_tokens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT        NOT NULL UNIQUE,
  practitioner_id UUID        NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  message         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '90 days',
  redeemed_at     TIMESTAMPTZ,
  redeemed_by     UUID        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS gift_tokens_token_idx        ON gift_tokens(token);
CREATE INDEX IF NOT EXISTS gift_tokens_practitioner_idx ON gift_tokens(practitioner_id);
CREATE INDEX IF NOT EXISTS gift_tokens_unredeemed_idx   ON gift_tokens(practitioner_id) WHERE redeemed_at IS NULL;
