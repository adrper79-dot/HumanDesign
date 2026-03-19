-- Migration 057: Practitioner Reviews
-- Client-submitted, practitioner-approved testimonials for directory profiles

CREATE TABLE IF NOT EXISTS practitioner_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden')),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (practitioner_id, client_user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_practitioner_approved
  ON practitioner_reviews (practitioner_id, status, created_at DESC)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_reviews_client
  ON practitioner_reviews (client_user_id);

CREATE OR REPLACE FUNCTION update_practitioner_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_practitioner_reviews_updated_at
  BEFORE UPDATE ON practitioner_reviews
  FOR EACH ROW EXECUTE FUNCTION update_practitioner_reviews_updated_at();
