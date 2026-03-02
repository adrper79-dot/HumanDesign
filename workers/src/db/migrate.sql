-- Prime Self — Neon PostgreSQL Schema Migration
-- Run once against the Neon database to create all required tables.
--
-- Usage (via psql or Neon SQL Editor):
--   psql "$NEON_CONNECTION_STRING" -f migrate.sql

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE,
  phone         TEXT UNIQUE,
  password_hash TEXT,          -- PBKDF2-SHA256 hash (salt:hash base64)
  birth_date    DATE,
  birth_time    TIME,
  birth_tz      TEXT,          -- IANA timezone e.g. 'America/New_York'
  birth_lat     DOUBLE PRECISION,
  birth_lng     DOUBLE PRECISION,
  sms_opted_in  BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);

-- ─── Charts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  hd_json       JSONB NOT NULL,
  astro_json    JSONB,
  calculated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_charts_user ON charts (user_id, calculated_at DESC);

-- ─── Profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  chart_id        UUID REFERENCES charts(id) ON DELETE SET NULL,
  profile_json    JSONB NOT NULL,
  model_used      TEXT,
  grounding_audit JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles (user_id, created_at DESC);

-- ─── Transit Snapshots ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS transit_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date   DATE UNIQUE NOT NULL,
  positions_json  JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transit_date ON transit_snapshots (snapshot_date);

-- ─── Practitioners ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practitioners (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  certified BOOLEAN DEFAULT false,
  tier      TEXT DEFAULT 'free'
);

-- ─── Practitioner ↔ Client ──────────────────────────────────
CREATE TABLE IF NOT EXISTS practitioner_clients (
  practitioner_id UUID REFERENCES practitioners(id) ON DELETE CASCADE,
  client_user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (practitioner_id, client_user_id)
);

-- ─── Clusters ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clusters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  challenge   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Cluster Members ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cluster_members (
  cluster_id  UUID REFERENCES clusters(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  forge_role  TEXT,
  joined_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (cluster_id, user_id)
);

-- ─── SMS Messages ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_messages (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body      TEXT NOT NULL,
  sent_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_user ON sms_messages (user_id, sent_at DESC);

-- ─── Done ────────────────────────────────────────────────────
-- All tables use IF NOT EXISTS — safe to re-run.
