-- Migration 020: Fix subscription CHECK constraints
--
-- Problem: subscriptions.tier CHECK allows ('free','seeker','guide','practitioner')
-- but webhook.js and stripe.js write ('regular','practitioner','white_label').
-- Also: subscriptions.status CHECK uses 'cancelled' (British) but webhook.js
-- writes 'canceled' (American, matching Stripe's API).
--
-- Fix: Accept both old and new tier names + both cancelled/canceled spellings.
-- Migrate existing rows from old names to new names for consistency.
--
-- Safe to run idempotently.
-- Run: node workers/run-migration.js workers/src/db/migrations/020_fix_subscription_constraints.sql

-- Step 1: Drop old tier constraint and add expanded one
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('free', 'seeker', 'guide', 'regular', 'practitioner', 'white_label'));

-- Step 2: Drop old status constraint and add one accepting both spellings
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'canceled', 'cancelled', 'past_due', 'unpaid', 'trialing'));

-- Step 3: Migrate existing rows from old tier names to new names
UPDATE subscriptions SET tier = 'regular'      WHERE tier = 'seeker';
UPDATE subscriptions SET tier = 'practitioner' WHERE tier = 'guide';

-- Step 4: Normalize status spelling to American (matches Stripe API + webhook code)
UPDATE subscriptions SET status = 'canceled' WHERE status = 'cancelled';
