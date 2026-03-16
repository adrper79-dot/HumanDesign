-- SYS-015: Hash IP address in account_deletions (GDPR — IP is PII)
-- Replace plaintext ip_address with a SHA-256 hash of the IP.
-- Existing rows have their IP set to NULL (cannot retroactively hash).

ALTER TABLE account_deletions
  RENAME COLUMN ip_address TO ip_address_hash;

ALTER TABLE account_deletions
  ALTER COLUMN ip_address_hash TYPE TEXT;

-- Note: application code must hash IP before INSERT going forward.
-- Use: SHA256(ip_address || SALT) where SALT = a fixed Worker secret.
COMMENT ON COLUMN account_deletions.ip_address_hash IS 'SHA-256 hash of client IP (GDPR compliance). Not reversible.';
