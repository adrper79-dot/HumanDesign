-- Migration 066: Fix practitioner_messages PK type (UUID-2A)
--
-- Migration 063 defined id as BIGSERIAL. All FK columns are correctly UUID but
-- the PK should be UUID for consistency and to avoid exposing sequential IDs.
-- This migration safely swaps in a UUID primary key whether or not the table
-- already has rows.

DO $$
BEGIN
  -- Only alter if the id column is still integer (bigint)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'practitioner_messages'
      AND column_name = 'id'
      AND data_type IN ('bigint', 'integer')
  ) THEN
    -- 1. Add new UUID column (non-null, auto-populated)
    ALTER TABLE practitioner_messages
      ADD COLUMN id_new UUID NOT NULL DEFAULT gen_random_uuid();

    -- 2. Backfill any existing rows
    UPDATE practitioner_messages SET id_new = gen_random_uuid() WHERE id_new IS NULL;

    -- 3. Drop the old integer PK constraint
    ALTER TABLE practitioner_messages DROP CONSTRAINT practitioner_messages_pkey;

    -- 4. Drop the old sequence-backed column
    ALTER TABLE practitioner_messages DROP COLUMN id;

    -- 5. Promote the UUID column
    ALTER TABLE practitioner_messages RENAME COLUMN id_new TO id;
    ALTER TABLE practitioner_messages ADD PRIMARY KEY (id);
  END IF;

  -- If table doesn't exist at all, create it from scratch with UUID PK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'practitioner_messages'
  ) THEN
    CREATE TABLE practitioner_messages (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      practitioner_id UUID        NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
      client_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_id       UUID        NOT NULL REFERENCES users(id),
      body            TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
      is_read         BOOLEAN     NOT NULL DEFAULT false,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS pm_thread_idx
      ON practitioner_messages (practitioner_id, client_user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS pm_unread_idx
      ON practitioner_messages (practitioner_id, client_user_id)
      WHERE is_read = false;

    CREATE INDEX IF NOT EXISTS pm_sender_idx
      ON practitioner_messages (sender_id);
  END IF;
END $$;

-- Recreate indexes (idempotent — IF NOT EXISTS is safe to run either way)
CREATE INDEX IF NOT EXISTS pm_thread_idx
  ON practitioner_messages (practitioner_id, client_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pm_unread_idx
  ON practitioner_messages (practitioner_id, client_user_id)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS pm_sender_idx
  ON practitioner_messages (sender_id);
