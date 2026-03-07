-- Migration 010: Transit Alert System
-- Enables users to subscribe to custom transit alerts (gate activations, aspects, life cycles)
-- Alerts are evaluated daily by cron and trigger push notifications + webhook events


-- Transit alerts table
-- Stores user-defined alert conditions to monitor
CREATE TABLE transit_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Alert type determines how to evaluate the condition
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'gate_activation',   -- Transit planet enters specific gate
    'aspect',            -- Transit planet forms aspect with natal planet
    'cycle',             -- Major life cycle approaching
    'gate_deactivation'  -- Transit planet leaves specific gate
  )),
  
  -- Alert configuration (varies by type)
  -- gate_activation: {"gate": 34, "planet": "Mars"}
  -- aspect: {"planet": "Sun", "natalPlanet": "Mars", "aspect": "conjunction", "orb": 2}
  -- cycle: {"cycle": "saturn_return", "daysBeforeAlert": 30}
  -- gate_deactivation: {"gate": 34, "planet": "Venus"}
  config JSONB NOT NULL,
  
  -- Alert metadata
  name TEXT,                    -- User-friendly name (e.g., "Mars Energy Boost")
  description TEXT,             -- Optional description
  active BOOLEAN DEFAULT true,
  
  -- Delivery preferences
  notify_push BOOLEAN DEFAULT true,
  notify_webhook BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_alerts_user_id ON transit_alerts(user_id);
CREATE INDEX idx_alerts_active ON transit_alerts(active) WHERE active = true;
CREATE INDEX idx_alerts_type ON transit_alerts(alert_type);


-- Alert delivery history
-- Tracks when alerts were triggered and delivered to prevent duplicate notifications
CREATE TABLE alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES transit_alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Trigger context
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  trigger_date DATE NOT NULL,  -- Date the alert condition was met
  
  -- Alert details
  alert_type TEXT NOT NULL,
  config JSONB NOT NULL,       -- Snapshot of alert config at trigger time
  
  -- Transit context (what actually triggered the alert)
  transit_data JSONB,  -- e.g., {"planet": "Mars", "gate": 34, "position": 234.5}
  
  -- Delivery tracking
  push_sent BOOLEAN DEFAULT false,
  push_sent_at TIMESTAMPTZ,
  webhook_sent BOOLEAN DEFAULT false,
  webhook_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for querying delivery history
CREATE INDEX idx_alert_deliveries_alert ON alert_deliveries(alert_id);
CREATE INDEX idx_alert_deliveries_user ON alert_deliveries(user_id);
CREATE INDEX idx_alert_deliveries_triggered ON alert_deliveries(triggered_at DESC);
CREATE INDEX idx_alert_deliveries_trigger_date ON alert_deliveries(trigger_date);

-- Prevent duplicate deliveries for same alert on same date
CREATE UNIQUE INDEX idx_alert_deliveries_unique ON alert_deliveries(alert_id, trigger_date);


-- Pre-configured alert templates
-- Suggested alerts based on user's chart (e.g., "When Mars enters your Power gate")
CREATE TABLE alert_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template metadata
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('power', 'activation', 'challenge', 'cycle', 'lunar')),
  
  -- Template configuration
  alert_type TEXT NOT NULL,
  config_template JSONB NOT NULL,  -- Template with placeholders like {{natal_mars_gate}}
  
  -- Recommendation logic
  recommended_for JSONB,  -- Conditions for recommendation (e.g., {"type": "Generator"})
  tier_required TEXT,     -- 'free', 'seeker', 'practitioner'
  
  -- Metadata
  popularity INTEGER DEFAULT 0,  -- How many users have enabled this template
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example templates
INSERT INTO alert_templates (name, description, category, alert_type, config_template, tier_required) VALUES
(
  'Mars in Your Power Gate',
  'Get notified when Mars activates your strongest gate for action and energy',
  'power',
  'gate_activation',
  '{"gate": "{{natal_mars_gate}}", "planet": "Mars"}',
  'free'
),
(
  'Sun-Mars Activation',
  'Alert when transit Sun conjuncts your natal Mars (high energy day)',
  'activation',
  'aspect',
  '{"planet": "Sun", "natalPlanet": "Mars", "aspect": "conjunction", "orb": 2}',
  'seeker'
),
(
  'Full Moon Awareness',
  'Monthly full moon notification for emotional culmination',
  'lunar',
  'aspect',
  '{"planet": "Moon", "natalPlanet": "Sun", "aspect": "opposition", "orb": 5}',
  'free'
),
(
  'Saturn Return Approaching',
  'Alert 30 days before your Saturn return begins',
  'cycle',
  'cycle',
  '{"cycle": "saturn_return", "daysBeforeAlert": 30}',
  'free'
),
(
  'Jupiter Return Window',
  'Alert when your Jupiter return window opens (prosperity cycle)',
  'cycle',
  'cycle',
  '{"cycle": "jupiter_return", "daysBeforeAlert": 7}',
  'seeker'
);


-- Comments for documentation
COMMENT ON TABLE transit_alerts IS 'User-defined alerts for transit events (gate activations, aspects, cycles)';
COMMENT ON COLUMN transit_alerts.alert_type IS 'Type of alert determines evaluation logic (gate_activation, aspect, cycle, gate_deactivation)';
COMMENT ON COLUMN transit_alerts.config IS 'JSONB configuration specific to alert_type. See migration comments for schemas.';
COMMENT ON COLUMN transit_alerts.notify_push IS 'Send push notification when alert triggers';
COMMENT ON COLUMN transit_alerts.notify_webhook IS 'Fire webhook event when alert triggers';

COMMENT ON TABLE alert_deliveries IS 'Audit log of triggered alerts with delivery confirmation';
COMMENT ON COLUMN alert_deliveries.trigger_date IS 'Date the alert condition was met (prevents duplicate triggers)';
COMMENT ON COLUMN alert_deliveries.transit_data IS 'Snapshot of transit data when alert triggered';

COMMENT ON TABLE alert_templates IS 'Pre-configured alert templates for quick setup';
COMMENT ON COLUMN alert_templates.config_template IS 'Alert config with placeholders filled from user chart (e.g., {{natal_mars_gate}})';
COMMENT ON COLUMN alert_templates.recommended_for IS 'Conditions for recommending this template (e.g., specific type or authority)';


-- Alert config schemas (for reference):
/*
gate_activation:
{
  "gate": 34,           // Gate number (1-64)
  "planet": "Mars"      // Transit planet to watch (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, NN, SN)
}

aspect:
{
  "planet": "Sun",            // Transit planet
  "natalPlanet": "Mars",      // Natal planet to aspect
  "aspect": "conjunction",    // conjunction, opposition, trine, square, sextile
  "orb": 2                    // Orb in degrees (default 2)
}

cycle:
{
  "cycle": "saturn_return",   // Cycle name (saturn_return, jupiter_return, uranus_opposition, etc.)
  "daysBeforeAlert": 30       // Days before cycle to trigger alert
}

gate_deactivation:
{
  "gate": 34,           // Gate number
  "planet": "Venus"     // Transit planet leaving the gate
}
*/
