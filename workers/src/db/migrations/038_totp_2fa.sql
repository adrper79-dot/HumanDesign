-- Migration 038: TOTP 2FA (PRA-OPS-004 / AUDIT-UX-006)
-- Adds TOTP two-factor authentication columns to users.
-- The secret is stored as a base32-encoded 20-byte random value (RFC 6238).
-- totp_enabled is set to false until the user confirms a valid TOTP code
-- during setup (to prevent lockout from misconfigured authenticator apps).

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret  TEXT    DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;

COMMIT;
