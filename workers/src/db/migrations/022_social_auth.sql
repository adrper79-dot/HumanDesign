-- Social Auth Accounts
-- Links users to third-party OAuth providers (Google, Apple, Facebook, etc.)
-- One user can have multiple social logins linked to the same account.

CREATE TABLE IF NOT EXISTS social_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,           -- 'google' | 'apple' | 'facebook'
  provider_user_id TEXT NOT NULL,           -- provider's stable unique user ID
  provider_email   TEXT,                    -- email returned by provider (may differ from account email)
  display_name     TEXT,                    -- full name from provider
  avatar_url       TEXT,                    -- profile picture URL from provider
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user     ON social_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_lookup   ON social_accounts (provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_email    ON social_accounts (provider_email);
