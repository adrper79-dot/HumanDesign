-- Migration 035: Drop dead tables (AUDIT-DB-002)
-- Tables created in migrations but never referenced in application code.
--
-- alignment_trends (created in 013) — zero INSERT/SELECT/UPDATE in codebase
-- notion_pages     (created in 012) — zero INSERT/SELECT/UPDATE in codebase
--
-- NOTE: experiments, experiment_assignments, experiment_conversions, and
-- funnel_events are NOT dropped — they are actively used by
-- lib/experiments.js, lib/analytics.js, and handlers/experiments.js.

BEGIN;

DROP TABLE IF EXISTS alignment_trends CASCADE;
DROP TABLE IF EXISTS notion_pages CASCADE;

COMMIT;
