-- Migration 019: Add birth data columns to cluster_members
--
-- Stores each member's original birth data at join time so the cluster
-- synthesis endpoint can recalculate charts without requiring members
-- to re-enter birth data at synthesis time.
--
-- Safe to run idempotently (all IF NOT EXISTS / DO NOTHING paths).
-- Run: node workers/run-migration.js workers/src/db/migrations/019_cluster_member_birth_data.sql

ALTER TABLE cluster_members
  ADD COLUMN IF NOT EXISTS birth_date     DATE,
  ADD COLUMN IF NOT EXISTS birth_time     TIME,
  ADD COLUMN IF NOT EXISTS birth_timezone TEXT,
  ADD COLUMN IF NOT EXISTS birth_lat      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS birth_lng      DOUBLE PRECISION;
