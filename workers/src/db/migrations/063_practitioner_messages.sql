-- Migration 063: Practitioner-client async messaging thread (item 5.1)
-- Practitioners and clients can exchange messages. Each row belongs to
-- the (practitioner_id, client_user_id) relationship.

CREATE TABLE IF NOT EXISTS practitioner_messages (
  id              BIGSERIAL PRIMARY KEY,
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  client_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id),
  body            TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Efficient thread listing ordered by time
CREATE INDEX IF NOT EXISTS pm_thread_idx
  ON practitioner_messages (practitioner_id, client_user_id, created_at DESC);

-- Unread badge count
CREATE INDEX IF NOT EXISTS pm_unread_idx
  ON practitioner_messages (practitioner_id, client_user_id)
  WHERE is_read = false;

-- Sender reverse-lookup
CREATE INDEX IF NOT EXISTS pm_sender_idx
  ON practitioner_messages (sender_id);
