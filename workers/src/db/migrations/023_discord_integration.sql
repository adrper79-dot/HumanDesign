-- Migration 023: Discord Guild Integration — Phase 2 foundation
--
-- Adds the discord_guild_ids column to practitioners so the
-- practitioner server licensing tier (Phase 2) can gate which
-- Discord guilds a practitioner's branded bot instance serves.
--
-- Also creates the discord_accounts table for account linking
-- (Phase 2: /primself with no arguments for linked users).
--
-- Phase 1 does NOT require these tables — the bot works without them.
-- Run this migration before building Phase 2 features.

-- ─── Practitioner Discord Guild IDs ──────────────────────────
-- Array of Discord guild IDs the practitioner has licensed.
-- Billing handler sets this when the practitioner Stripe subscription
-- activates. Discord Worker reads this to allow server-specific
-- white-labeling in Phase 2.
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS discord_guild_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS discord_bot_accent_color TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discord_brand_name TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_practitioners_discord_guilds
  ON practitioners USING GIN (discord_guild_ids);

-- ─── Discord Account Linking ──────────────────────────────────
-- Links a Prime Self user account to their Discord user ID.
-- Required for Phase 2: /primself with no arguments returns profile
-- for the linked account without re-entering birth data.
CREATE TABLE IF NOT EXISTS discord_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  guild_id        TEXT,                   -- NULL = linked globally, set = linked via specific server
  linked_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(discord_user_id)               -- one Discord account per Prime Self account
);

CREATE INDEX IF NOT EXISTS idx_discord_accounts_user    ON discord_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_discord_accounts_discord ON discord_accounts (discord_user_id);

-- ─── Discord Command Usage ────────────────────────────────────
-- Tracks /primself command runs for analytics, conversion attribution,
-- and practitioner usage reporting (monthly Resend email).
CREATE TABLE IF NOT EXISTS discord_command_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL,
  guild_id        TEXT,
  command         TEXT NOT NULL DEFAULT 'primself',
  birth_date      TEXT,                   -- stored opaque — no PII enrichment
  city_input      TEXT,                   -- raw user input, not geocoded result
  success         BOOLEAN DEFAULT true,
  error_type      TEXT,                   -- 'geocode_fail' | 'chart_fail' | 'rate_limit' | null
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discord_events_guild   ON discord_command_events (guild_id);
CREATE INDEX IF NOT EXISTS idx_discord_events_created ON discord_command_events (created_at);
