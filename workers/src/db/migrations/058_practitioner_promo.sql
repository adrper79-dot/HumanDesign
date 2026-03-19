-- Migration 058: Add practitioner_id to promo_codes for practitioner-scoped promos
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS practitioner_id UUID REFERENCES users(id);

-- Index for looking up a practitioner's active promo
CREATE INDEX IF NOT EXISTS idx_promo_codes_practitioner
  ON promo_codes(practitioner_id) WHERE practitioner_id IS NOT NULL AND active = true;
