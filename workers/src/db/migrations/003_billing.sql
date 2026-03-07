-- Migration 003: Billing & Subscriptions (PostgreSQL)
-- Tables for Stripe integration, subscription management, and payment tracking
-- NOTE: The primary subscriptions table is in migrate.sql. This migration adds
-- supplementary billing tables (invoices, usage_tracking, promo_codes, referrals).

-- ─── Invoices Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('paid', 'open', 'draft', 'uncollectible', 'void', 'failed')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ─── Usage Tracking Table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  last_incremented_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_feature ON usage_tracking(feature);

-- ─── Promo Codes Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  stripe_promo_code_id TEXT UNIQUE,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  max_redemptions INTEGER,
  redemptions INTEGER DEFAULT 0,
  applicable_tiers JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(active) WHERE active = true;

-- ─── Referrals Table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  converted BOOLEAN DEFAULT false,
  conversion_date TIMESTAMPTZ,
  reward_granted BOOLEAN DEFAULT false,
  reward_type TEXT,
  reward_value INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_converted ON referrals(converted) WHERE converted = true;

-- ─── Update Users Table ──────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- ─── Analytics Views ─────────────────────────────────────────

CREATE OR REPLACE VIEW subscription_analytics AS
SELECT 
  tier,
  COUNT(*) as total_subscriptions,
  COUNT(*) FILTER (WHERE status = 'active') as active_subscriptions,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_subscriptions,
  COUNT(*) FILTER (WHERE cancel_at_period_end = true) as pending_cancellations
FROM subscriptions
GROUP BY tier;

CREATE OR REPLACE VIEW monthly_revenue AS
SELECT 
  to_char(paid_at, 'YYYY-MM') as month,
  COUNT(*) as invoices_paid,
  SUM(amount_paid) as total_revenue_cents,
  ROUND(SUM(amount_paid) / 100.0, 2) as total_revenue_usd
FROM invoices
WHERE status = 'paid'
GROUP BY to_char(paid_at, 'YYYY-MM')
ORDER BY month DESC;

CREATE OR REPLACE VIEW user_subscription_status AS
SELECT 
  u.id as user_id,
  u.email,
  u.tier,
  u.stripe_customer_id,
  s.stripe_subscription_id,
  s.status as subscription_status,
  s.current_period_end,
  s.cancel_at_period_end,
  COUNT(i.id) as total_invoices,
  SUM(CASE WHEN i.status = 'paid' THEN i.amount_paid ELSE 0 END) as lifetime_value_cents
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
LEFT JOIN invoices i ON s.id = i.subscription_id
GROUP BY u.id, u.email, u.tier, u.stripe_customer_id,
         s.stripe_subscription_id, s.status, s.current_period_end, s.cancel_at_period_end;
