-- Migration 008: Webhook System for Custom Events
-- Created: March 6, 2026
-- Purpose: Allow users (especially practitioners) to receive real-time notifications
--          when events occur in Prime Self (chart created, profile generated, etc.)

-- Webhooks table: Stores user webhook subscriptions
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- Array of event names: ['chart.created', 'profile.generated']
  secret TEXT NOT NULL, -- HMAC secret for signature verification
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);

-- Index for active webhooks (used by dispatcher)
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active) WHERE active = true;

-- Webhook deliveries table: Audit log of webhook POST attempts
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for webhook history lookup
CREATE INDEX IF NOT EXISTS idx_deliveries_webhook_id ON webhook_deliveries(webhook_id);

-- Index for retry queue (find failed deliveries to retry)
CREATE INDEX IF NOT EXISTS idx_deliveries_retry ON webhook_deliveries(next_retry_at) 
WHERE next_retry_at IS NOT NULL AND response_status IS NULL;

-- Index for event type analytics
CREATE INDEX IF NOT EXISTS idx_deliveries_event_type ON webhook_deliveries(event_type);

-- Comments for documentation
COMMENT ON TABLE webhooks IS 'User-configured webhook endpoints for real-time event notifications';
COMMENT ON TABLE webhook_deliveries IS 'Audit log of webhook delivery attempts with retry tracking';

COMMENT ON COLUMN webhooks.url IS 'HTTPS endpoint to POST events to (must be https://)';
COMMENT ON COLUMN webhooks.events IS 'Array of subscribed event types (e.g., [''chart.created'', ''profile.generated''])';
COMMENT ON COLUMN webhooks.secret IS 'HMAC secret for X-Prime-Signature header verification';

COMMENT ON COLUMN webhook_deliveries.attempts IS 'Number of delivery attempts (max 3)';
COMMENT ON COLUMN webhook_deliveries.next_retry_at IS 'When to retry failed delivery (exponential backoff)';
COMMENT ON COLUMN webhook_deliveries.response_status IS 'HTTP status code from webhook endpoint (null = not yet delivered)';
