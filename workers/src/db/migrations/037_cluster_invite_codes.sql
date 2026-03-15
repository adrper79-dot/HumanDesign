-- Migration 037: Cluster invite codes (P2-SEC-013)
-- Clusters now require an invite code to join. The creator can regenerate it.
-- Prevents UUID-guessing attacks that allow unauthorized cluster access.

ALTER TABLE clusters ADD COLUMN IF NOT EXISTS invite_code TEXT;
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Generate unique invite codes for existing clusters
UPDATE clusters SET invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE invite_code IS NULL;

ALTER TABLE clusters ALTER COLUMN invite_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clusters_invite_code ON clusters (invite_code);
