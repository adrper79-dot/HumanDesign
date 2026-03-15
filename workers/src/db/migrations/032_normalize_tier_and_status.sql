-- AUDIT-DB-003: Canonicalize legacy tier names
-- Map: seeker → individual, regular → individual, guide → practitioner, white_label → agency
UPDATE users SET tier = 'individual' WHERE tier IN ('seeker', 'regular');
UPDATE users SET tier = 'practitioner' WHERE tier = 'guide';
UPDATE users SET tier = 'agency' WHERE tier = 'white_label';

UPDATE subscriptions SET tier = 'individual' WHERE tier IN ('seeker', 'regular');
UPDATE subscriptions SET tier = 'practitioner' WHERE tier = 'guide';
UPDATE subscriptions SET tier = 'agency' WHERE tier = 'white_label';

-- Tighten CHECK constraint to canonical values only
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tier_check;
ALTER TABLE users ADD CONSTRAINT users_tier_check CHECK (tier IN ('free', 'individual', 'practitioner', 'agency'));

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tier_check CHECK (tier IN ('individual', 'practitioner', 'agency'));

-- AUDIT-DB-004: Normalize canceled/cancelled spelling to Stripe standard
UPDATE subscriptions SET status = 'canceled' WHERE status = 'cancelled';

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete', 'trialing', 'paused'));
