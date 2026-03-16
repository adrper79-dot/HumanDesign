-- Migration 039: Account Deletions Audit Log
-- Creates a persistent audit trail for account deletions (GDPR Article 17 compliance).
-- Stores a SHA-256 hash of the email (not plaintext) so deletion can be proven
-- without retaining PII. The user row is deleted after this record is inserted.

BEGIN;

CREATE TABLE IF NOT EXISTS account_deletions (
  id            SERIAL PRIMARY KEY,
  user_id       UUID        NOT NULL,
  email_hash    TEXT        NOT NULL,
  tier          TEXT,
  ip_address    TEXT,
  deleted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletions_user_id ON account_deletions (user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletions_deleted_at ON account_deletions (deleted_at);

COMMIT;
