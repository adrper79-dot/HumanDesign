-- Migration 052: Add scheduling_embed_url to practitioners (PRAC-015)
-- Stores an optional Cal.com or Calendly embed URL for practitioner scheduling

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS scheduling_embed_url TEXT NOT NULL DEFAULT '';
