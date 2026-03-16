-- Migration 041: Normalize experiments.status enum
-- Migration 014 defined status with comment values ('draft', 'running', 'paused', 'completed')
-- but experiments.js has always used ('active', 'paused', 'completed') exclusively:
--   - INSERT always sets status = 'active'
--   - getActiveExperiment queries WHERE status = 'active'
--   - updateExperimentStatus allows only ['active', 'paused', 'completed']
-- 'draft' and 'running' are never written by any code path.
-- This migration normalises any stale rows, corrects the column DEFAULT,
-- and adds a CHECK constraint to prevent future drift.

BEGIN;

-- Normalize any stale rows written via direct SQL using the old comment values.
UPDATE experiments SET status = 'active'  WHERE status IN ('running', 'draft');

-- Correct the column default so bare INSERTs without explicit status match code behaviour.
ALTER TABLE experiments ALTER COLUMN status SET DEFAULT 'active';

-- Add CHECK constraint enforcing the values the codebase actually uses.
ALTER TABLE experiments
  ADD CONSTRAINT experiments_status_check
  CHECK (status IN ('active', 'paused', 'completed'));

COMMIT;
