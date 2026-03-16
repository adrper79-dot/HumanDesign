-- Atomic counters for route rate limits and daily ceilings.
-- Eliminates cross-isolate KV read/check/write races by moving fixed-window
-- counters to a single-row Postgres upsert path.

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  counter_key    TEXT PRIMARY KEY,
  window_start   TIMESTAMPTZ NOT NULL,
  window_end     TIMESTAMPTZ NOT NULL,
  count          INTEGER NOT NULL DEFAULT 1,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_window_end
  ON rate_limit_counters (window_end);