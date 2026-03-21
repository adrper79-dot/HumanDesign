-- Migration 068: Correct FK ON DELETE policies for GDPR erasure safety (DB-001)
--
-- Push_subscriptions.user_id and transit_alerts.user_id were created with ON DELETE CASCADE
-- in migrations 009 and 010 respectively, so those are already correct.
--
-- This migration fixes the remaining two tables:
--   1. promo_codes.practitioner_id  → ON DELETE SET NULL (nullable column, practitioner deleted)
--   2. practitioner_messages.sender_id → make nullable + ON DELETE SET NULL (preserve message history)

-- ─── 1. promo_codes.practitioner_id ─────────────────────────────────────────
-- Drop old unnamed FK (added in migration 058 without explicit ON DELETE),
-- then recreate with ON DELETE SET NULL so deleting a practitioner user just
-- clears the reference rather than blocking the DELETE or cascading.

ALTER TABLE promo_codes
  DROP CONSTRAINT IF EXISTS promo_codes_practitioner_id_fkey;

ALTER TABLE promo_codes
  ADD CONSTRAINT promo_codes_practitioner_id_fkey
  FOREIGN KEY (practitioner_id) REFERENCES users(id) ON DELETE SET NULL;


-- ─── 2. practitioner_messages.sender_id ─────────────────────────────────────
-- Migration 063 defined sender_id as NOT NULL with no ON DELETE clause
-- (defaults to RESTRICT — prevents deleting a user who sent any message).
-- GDPR erasure requires being able to delete a user account. The fix is:
--   a) Drop the NOT NULL constraint so the column can hold NULL for deleted senders.
--   b) Recreate the FK with ON DELETE SET NULL — message history is preserved
--      with sender_id = NULL indicating a deleted/anonymous sender.

ALTER TABLE practitioner_messages
  ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE practitioner_messages
  DROP CONSTRAINT IF EXISTS practitioner_messages_sender_id_fkey;

ALTER TABLE practitioner_messages
  ADD CONSTRAINT practitioner_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
