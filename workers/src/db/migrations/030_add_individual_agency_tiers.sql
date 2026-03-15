-- Migration 030: Add 'individual' and 'agency' to subscriptions.tier CHECK constraint
--
-- Problem: Migration 020 set CHECK (tier IN ('free','seeker','guide','regular','practitioner','white_label'))
--          but the new canonical tier names from HD_UPDATES3 are 'individual' and 'agency'.
--          Any Stripe webhook upsert with tier='individual' or tier='agency' triggers a constraint
--          violation, silently preventing tier provisioning for new paid subscribers.
--
-- Fix: Drop and recreate the constraint to include all current + legacy tier names.
--      Legacy aliases (seeker, guide, regular, white_label) are retained for historical rows.

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN (
    'free',
    'individual',     -- HD_UPDATES3 canonical (replaces 'regular')
    'practitioner',
    'agency',         -- HD_UPDATES3 canonical (replaces 'white_label')
    'seeker',         -- legacy alias — retained for historical rows
    'guide',          -- legacy alias — retained for historical rows
    'regular',        -- legacy alias — retained for historical rows
    'white_label'     -- legacy alias — retained for historical rows
  ));
