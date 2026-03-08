-- Notion Integration Tables
-- Supports OAuth, database sync, and page export

-- ─── OAuth State Tokens ──────────────────────────────────────
-- Temporary storage for OAuth state tokens (CSRF protection)
CREATE TABLE IF NOT EXISTS oauth_states (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,  -- 'notion', 'google', etc.
  state         TEXT UNIQUE NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_user ON oauth_states (user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states (state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states (expires_at);

-- ─── Notion Connections ───────────────────────────────────────
-- Store Notion OAuth access tokens and workspace info
CREATE TABLE IF NOT EXISTS notion_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  access_token      TEXT NOT NULL,
  workspace_id      TEXT NOT NULL,
  workspace_name    TEXT,
  bot_id            TEXT,
  owner_type        TEXT,  -- 'user' or 'workspace'
  owner_user_id     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notion_connections_user ON notion_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_notion_connections_workspace ON notion_connections (workspace_id);

-- ─── Notion Syncs ─────────────────────────────────────────────
-- Track synced databases and last sync time
CREATE TABLE IF NOT EXISTS notion_syncs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  sync_type           TEXT NOT NULL,  -- 'clients', 'profiles', etc.
  notion_database_id  TEXT NOT NULL,
  last_synced_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notion_syncs_user ON notion_syncs (user_id);
CREATE INDEX IF NOT EXISTS idx_notion_syncs_type ON notion_syncs (sync_type);

-- ─── Notion Pages ─────────────────────────────────────────────
-- Track exported pages for reference
CREATE TABLE IF NOT EXISTS notion_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  profile_id        UUID REFERENCES profiles(id) ON DELETE CASCADE,
  notion_page_id    TEXT NOT NULL,
  notion_page_url   TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notion_pages_user ON notion_pages (user_id);
CREATE INDEX IF NOT EXISTS idx_notion_pages_profile ON notion_pages (profile_id);
CREATE INDEX IF NOT EXISTS idx_notion_pages_notion_id ON notion_pages (notion_page_id);

-- ─── Done ─────────────────────────────────────────────────────
