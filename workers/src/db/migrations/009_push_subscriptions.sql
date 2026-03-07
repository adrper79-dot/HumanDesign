-- Migration 009: Push Notification Infrastructure
-- This enables Web Push notifications for transit alerts, daily digests, and cycle approaching notifications
-- Uses Web Push API with VAPID authentication


-- Push subscriptions table
-- Stores endpoint configurations from browsers/PWAs subscribing to push notifications
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Web Push API endpoint (unique per browser/device)
  endpoint TEXT NOT NULL UNIQUE,
  
  -- Encryption keys for sending push messages
  p256dh TEXT NOT NULL,  -- Client public key for encryption
  auth TEXT NOT NULL,     -- Authentication secret
  
  -- Metadata
  user_agent TEXT,        -- Browser/device info
  subscription_time TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ,  -- Last time a notification was successfully sent
  
  -- Preferences
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_push_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_active ON push_subscriptions(active) WHERE active = true;
CREATE INDEX idx_push_endpoint ON push_subscriptions(endpoint);


-- Push notification log
-- Tracks all sent notifications for debugging and analytics
CREATE TABLE push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Notification content
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'transit_daily',      -- Daily transit digest
    'gate_activation',    -- Specific gate activated by transit
    'cycle_approaching',  -- Major life cycle within 30 days
    'transit_alert',      -- Custom user-defined alert
    'weekly_digest',      -- Weekly summary
    'test'                -- Test notification
  )),
  
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon TEXT,             -- URL to notification icon
  badge TEXT,            -- URL to badge icon
  tag TEXT,              -- Notification tag for grouping
  data JSONB,            -- Custom data payload
  
  -- Delivery tracking
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  response_status INTEGER,  -- HTTP status from push service
  response_body TEXT,       -- Error message if failed
  success BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics and debugging
CREATE INDEX idx_push_notif_subscription ON push_notifications(subscription_id);
CREATE INDEX idx_push_notif_user ON push_notifications(user_id);
CREATE INDEX idx_push_notif_type ON push_notifications(notification_type);
CREATE INDEX idx_push_notif_sent ON push_notifications(sent_at DESC);
CREATE INDEX idx_push_notif_success ON push_notifications(success);


-- User notification preferences
-- Allows users to control which notifications they receive
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification types enabled (defaults all true)
  transit_daily BOOLEAN DEFAULT true,
  gate_activation BOOLEAN DEFAULT true,
  cycle_approaching BOOLEAN DEFAULT true,
  transit_alert BOOLEAN DEFAULT true,
  weekly_digest BOOLEAN DEFAULT true,
  
  -- Quiet hours (local time)
  quiet_hours_start TIME,    -- e.g., 22:00 (10pm)
  quiet_hours_end TIME,      -- e.g., 08:00 (8am)
  timezone TEXT DEFAULT 'UTC',
  
  -- Digest timing
  daily_digest_time TIME DEFAULT '06:00',  -- 6am local time
  weekly_digest_day INTEGER DEFAULT 1,     -- 1=Monday, 7=Sunday
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- Comments for documentation
COMMENT ON TABLE push_subscriptions IS 'Web Push API subscriptions from browsers/PWAs for each user';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'Unique push service endpoint for this browser/device';
COMMENT ON COLUMN push_subscriptions.p256dh IS 'Client public key for encrypting push messages (base64)';
COMMENT ON COLUMN push_subscriptions.auth IS 'Authentication secret for push encryption (base64)';

COMMENT ON TABLE push_notifications IS 'Audit log of all push notifications sent';
COMMENT ON COLUMN push_notifications.notification_type IS 'Category of notification for analytics and filtering';
COMMENT ON COLUMN push_notifications.tag IS 'Groups related notifications (e.g., "transit-mars-gate-34")';

COMMENT ON TABLE notification_preferences IS 'Per-user settings for which notifications to receive and when';
COMMENT ON COLUMN notification_preferences.quiet_hours_start IS 'Start of quiet period (no notifications) in user local time';
COMMENT ON COLUMN notification_preferences.daily_digest_time IS 'Preferred time for daily transit digest in user local time';
