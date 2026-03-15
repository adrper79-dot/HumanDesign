-- Migration 029: Agency sub-accounts + practitioner branding columns
-- Adds branded PDF branding fields to practitioners
-- Adds agency_seats table for multi-seat Agency tier (up to 5 seats per agency owner)

-- ── Branded PDF columns ─────────────────────────────────────────────────────
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS website_url  TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand_color  CHAR(7) DEFAULT '#C9A84C',
  ADD COLUMN IF NOT EXISTS logo_url     TEXT    DEFAULT '';

-- ── Agency seats ────────────────────────────────────────────────────────────
-- Each row represents one sub-account seat granted by an Agency-tier owner.
-- A user may only belong to ONE agency at a time (UNIQUE(member_user_id)).
-- The agency owner is responsible for seat count enforcement (max 5).
CREATE TABLE IF NOT EXISTS agency_seats (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_email   TEXT        NOT NULL,          -- email used for the invite (audit trail)
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at     TIMESTAMPTZ,                   -- NULL until the invitee accepts
  UNIQUE(owner_user_id, member_user_id),
  UNIQUE(member_user_id)                         -- one agency owner at a time per member
);

CREATE INDEX IF NOT EXISTS idx_agency_seats_owner  ON agency_seats(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_seats_member ON agency_seats(member_user_id);
