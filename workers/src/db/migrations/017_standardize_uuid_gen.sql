-- Migration 017: Standardize UUID generation to gen_random_uuid()
-- Removes dependency on uuid-ossp extension.
-- gen_random_uuid() is built into PostgreSQL 13+ (no extension needed).
--
-- BL-S15-M1

-- Alter defaults on base schema tables (from migrate.sql)
ALTER TABLE users              ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE charts             ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE profiles           ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE transit_snapshots  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE practitioners      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE clusters           ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE sms_messages       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE validation_data    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE psychometric_data  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE diary_entries      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE subscriptions      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE payment_events     ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE usage_records      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE share_events       ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE refresh_tokens     ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Alter defaults on 012_notion.sql tables
ALTER TABLE oauth_states        ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE notion_connections  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE notion_syncs        ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE notion_pages        ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Alter defaults on 013_daily_checkins.sql tables
ALTER TABLE daily_checkins      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE checkin_reminders   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE alignment_trends    ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Drop the extension (no longer needed)
DROP EXTENSION IF EXISTS "uuid-ossp";
