-- Migration 064: Fix ON DELETE CASCADE for user-linked notification tables
--
-- GDPR / Right-to-Erasure fix (AUDIT-P0-003)
--
-- push_notifications.user_id and alert_deliveries.user_id were created WITHOUT
-- ON DELETE CASCADE.  When deleteUserAccount runs DELETE FROM users WHERE id = $1
-- PostgreSQL raises a FK violation for any user who has notification history,
-- making account deletion fail with a 500 for any active user.
--
-- This migration drops and re-creates both FK constraints with ON DELETE CASCADE
-- so that deleting a user automatically removes their notification records.

ALTER TABLE push_notifications
  DROP CONSTRAINT IF EXISTS push_notifications_user_id_fkey;

ALTER TABLE push_notifications
  ADD CONSTRAINT push_notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE alert_deliveries
  DROP CONSTRAINT IF EXISTS alert_deliveries_user_id_fkey;

ALTER TABLE alert_deliveries
  ADD CONSTRAINT alert_deliveries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
