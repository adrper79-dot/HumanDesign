-- Migration 026: Practitioner Directory & AI Style
-- HD_UPDATES4: Public practitioner profiles, synthesis style, payment links

-- Add public profile fields to practitioners table
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slug VARCHAR(100),
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(150) DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bio VARCHAR(250) DEFAULT '',
  ADD COLUMN IF NOT EXISTS specializations TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certification VARCHAR(100) DEFAULT '',
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{English}',
  ADD COLUMN IF NOT EXISTS session_format VARCHAR(50) DEFAULT 'Remote',
  ADD COLUMN IF NOT EXISTS session_info VARCHAR(200) DEFAULT '',
  ADD COLUMN IF NOT EXISTS booking_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_links JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS synthesis_style VARCHAR(250) DEFAULT '';

-- Unique slug for public profile URLs: selfprime.net/p/jane-doe
CREATE UNIQUE INDEX IF NOT EXISTS idx_practitioners_slug
  ON practitioners(slug) WHERE slug IS NOT NULL AND slug <> '';

-- Index for directory browsing/filtering
CREATE INDEX IF NOT EXISTS idx_practitioners_public
  ON practitioners(is_public) WHERE is_public = true;

-- GIN index for specialization filtering
CREATE INDEX IF NOT EXISTS idx_practitioners_specializations
  ON practitioners USING GIN(specializations) WHERE is_public = true;
