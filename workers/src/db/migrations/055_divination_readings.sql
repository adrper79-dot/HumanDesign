-- Divination Reading Log
-- Supports tarot, oracle, runes, iching, pendulum, and other divination types
-- Tracks readings for practitioner clients with optional AI sharing

CREATE TABLE IF NOT EXISTS divination_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reading_type TEXT NOT NULL DEFAULT 'tarot',
  spread_type TEXT,
  cards JSONB,
  interpretation TEXT NOT NULL DEFAULT '',
  share_with_ai BOOLEAN NOT NULL DEFAULT false,
  reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_divination_practitioner
  ON divination_readings(practitioner_id, client_user_id, reading_date DESC);

CREATE INDEX IF NOT EXISTS idx_divination_ai_shared
  ON divination_readings(client_user_id, share_with_ai)
  WHERE share_with_ai = true;

CREATE OR REPLACE FUNCTION update_divination_readings_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_divination_readings_updated
  BEFORE UPDATE ON divination_readings
  FOR EACH ROW EXECUTE FUNCTION update_divination_readings_timestamp();
