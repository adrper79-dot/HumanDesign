-- 045_referral_signups.sql
-- Track which practitioner referred each user signup

CREATE TABLE IF NOT EXISTS referral_signups (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practitioner_id INTEGER NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)  -- one referral source per user
);

CREATE INDEX IF NOT EXISTS idx_referral_signups_practitioner
  ON referral_signups(practitioner_id);
