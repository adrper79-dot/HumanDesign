-- Migration 021: Add password reset tokens table
--
-- Supports the forgot-password / reset-password flow (BLOCKER-4).
-- Tokens are hashed (SHA-256) before storage. Each token expires after 1 hour.
-- Only one active token per user at a time (UNIQUE on user_id, prevents abuse).
--
-- Safe to run idempotently.
-- Run: node workers/run-migration.js workers/src/db/migrations/021_password_reset_tokens.sql

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_hash ON password_reset_tokens (token_hash);
