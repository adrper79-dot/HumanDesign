-- SYS-044: GDPR Article 7 — record consent timestamp and version at registration
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tos_accepted_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tos_version      VARCHAR(20)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN users.tos_accepted_at    IS 'GDPR Art.7: Timestamp when user accepted Terms of Service';
COMMENT ON COLUMN users.tos_version        IS 'Version of ToS accepted (e.g. "2026-01-01")';
COMMENT ON COLUMN users.privacy_accepted_at IS 'Timestamp when user accepted Privacy Policy';
