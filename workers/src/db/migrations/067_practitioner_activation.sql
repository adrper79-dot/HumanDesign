-- Migration 067: Practitioner activation lifecycle columns + nurture email log
-- GTM-005: Add activated_at to track first-time full activation (Gate1 + Gate2)
-- GTM-009: Add trial_started_at for nurture email scheduling
-- GTM-009: Create practitioner_nurture_emails to prevent duplicate sends

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS activated_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS practitioner_nurture_emails (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id  UUID        NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  email_day        INTEGER     NOT NULL CHECK (email_day IN (0, 1, 3, 5, 7, 11, 14)),
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (practitioner_id, email_day)
);

CREATE INDEX IF NOT EXISTS idx_practitioner_nurture_practitioner_id
  ON practitioner_nurture_emails (practitioner_id);
