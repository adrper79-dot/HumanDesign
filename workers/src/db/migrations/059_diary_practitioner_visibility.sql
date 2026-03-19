-- Item 1.11: Diary-to-Practitioner Visibility
-- Add per-relationship diary sharing consent (opt-in by client)
ALTER TABLE practitioner_clients ADD COLUMN IF NOT EXISTS share_diary BOOLEAN DEFAULT false;
