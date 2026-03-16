-- Migration 024: Practitioner invitations
--
-- Allows practitioners to invite clients who do not yet have an account.
-- Tokens are stored as hashes for security.
--
-- Safe to run idempotently.
-- Run: node workers/run-migration.js workers/src/db/migrations/024_practitioner_invitations.sql

CREATE TABLE IF NOT EXISTS practitioner_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  client_email TEXT NOT NULL,
  client_name TEXT,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pract_inv_practitioner
  ON practitioner_invitations (practitioner_id);

CREATE INDEX IF NOT EXISTS idx_pract_inv_token_hash
  ON practitioner_invitations (token_hash);

CREATE INDEX IF NOT EXISTS idx_pract_inv_status_expires
  ON practitioner_invitations (status, expires_at);

-- One pending invite per practitioner/email pair at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pract_inv_pending_email
  ON practitioner_invitations (practitioner_id, LOWER(client_email))
  WHERE status = 'pending';
