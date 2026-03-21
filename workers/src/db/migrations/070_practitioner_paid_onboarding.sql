-- Migration 070: paid practitioner onboarding email log
-- GTM-012: prevent duplicate post-purchase onboarding sends.

CREATE TABLE IF NOT EXISTS practitioner_paid_onboarding_emails (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id  UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  email_day        INTEGER NOT NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (practitioner_id, email_day)
);

CREATE INDEX IF NOT EXISTS idx_practitioner_paid_onboarding_practitioner_id
  ON practitioner_paid_onboarding_emails (practitioner_id);