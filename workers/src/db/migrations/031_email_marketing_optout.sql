-- 031: Add email marketing opt-out column for CAN-SPAM compliance (AUDIT-SEC-005)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_marketing_opted_out BOOLEAN DEFAULT false;
