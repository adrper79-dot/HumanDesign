/**
 * Migration: API Keys and Usage Tracking
 * 
 * Creates tables for external API access via API keys.
 * Supports RapidAPI marketplace, direct API customers, and integrations.
 * 
 * Tables:
 * - api_keys: Stores user API keys with scopes and rate limits
 * - api_usage: Tracks all API requests for billing and analytics
 */

-- ============================================================================
-- API Keys Table
-- ============================================================================
-- Stores API keys for external access to Prime Self API
-- Used by RapidAPI, Zapier, Make.com, and direct API customers

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- User-friendly name (e.g., "Production API", "Development")
  key_hash TEXT NOT NULL UNIQUE,         -- SHA-256 hash of the API key (for secure lookup)
  scopes JSONB NOT NULL DEFAULT '["read"]',  -- Permissions array: ["read", "write", "admin"]
  tier TEXT NOT NULL DEFAULT 'free',     -- Rate limit tier: free, basic, pro, enterprise
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 10,   -- Requests per hour
  rate_limit_per_day INTEGER NOT NULL DEFAULT 100,   -- Requests per day
  active BOOLEAN NOT NULL DEFAULT true,  -- Key can be deactivated without deletion
  expires_at TIMESTAMPTZ,                -- Optional expiration date (NULL = never expires)
  last_used_at TIMESTAMPTZ,              -- Last time key was used (updated on each request)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);  -- Fast lookup on auth
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Comment on API key scopes
COMMENT ON COLUMN api_keys.scopes IS 'JSON array of permissions: ["read"] (public data), ["read", "write"] (mutations), ["admin"] (all access)';
COMMENT ON COLUMN api_keys.tier IS 'Rate limit tier: free (100/day), basic (1k/day), pro (10k/day), enterprise (100k/day)';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of API key. Actual key shown only once during generation.';

-- ============================================================================
-- API Usage Table
-- ============================================================================
-- Tracks every API request for billing, analytics, and rate limiting

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,                -- Request path (e.g., "/api/chart/calculate")
  method TEXT NOT NULL,                  -- HTTP method (GET, POST, PUT, DELETE)
  response_status INTEGER,               -- HTTP response status (200, 400, 500, etc.)
  response_time_ms INTEGER,              -- Request duration in milliseconds
  ip_address TEXT,                       -- Client IP address (for abuse detection)
  user_agent TEXT,                       -- Client User-Agent header
  error_message TEXT,                    -- Error message if request failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for usage analytics and rate limiting
CREATE INDEX IF NOT EXISTS idx_api_usage_key_id ON api_usage(key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at);  -- Time-based queries
CREATE INDEX IF NOT EXISTS idx_api_usage_key_created ON api_usage(key_id, created_at);  -- Rate limit check
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);  -- Endpoint analytics
CREATE INDEX IF NOT EXISTS idx_api_usage_status ON api_usage(response_status);  -- Error tracking

-- Partial index for failed requests (faster error analysis)
CREATE INDEX IF NOT EXISTS idx_api_usage_errors ON api_usage(key_id, created_at) 
  WHERE response_status >= 400;

-- Comment on usage tracking
COMMENT ON TABLE api_usage IS 'Tracks all API requests for billing, rate limiting, and analytics. Retention policy: 90 days.';
COMMENT ON COLUMN api_usage.created_at IS 'Request timestamp. Used for rate limiting (hourly/daily) and billing calculations.';

-- ============================================================================
-- Materialized View: API Key Statistics (Optional - for dashboard)
-- ============================================================================
-- Pre-computed statistics for API key usage dashboard

-- (Skip for now - can add later if needed for performance)
-- CREATE MATERIALIZED VIEW api_key_stats AS
-- SELECT 
--   k.id as key_id,
--   k.name,
--   k.user_id,
--   COUNT(u.id) as total_requests,
--   COUNT(CASE WHEN u.created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as requests_last_hour,
--   COUNT(CASE WHEN u.created_at > NOW() - INTERVAL '1 day' THEN 1 END) as requests_last_day,
--   COUNT(CASE WHEN u.response_status >= 400 THEN 1 END) as error_count,
--   AVG(u.response_time_ms) as avg_response_time,
--   MAX(u.created_at) as last_request_at
-- FROM api_keys k
-- LEFT JOIN api_usage u ON k.id = u.key_id
-- GROUP BY k.id, k.name, k.user_id;

-- ============================================================================
-- Cleanup Function: Delete old API usage records (retention policy)
-- ============================================================================
-- Run this periodically via cron to prevent table growth
-- Keeps last 90 days of usage data

-- To be called from cron.js:
-- DELETE FROM api_usage WHERE created_at < NOW() - INTERVAL '90 days';

-- ============================================================================
-- Default API Key Tiers (Reference data)
-- ============================================================================
-- Not stored in database - configured in apiKey.js middleware
-- 
-- Free tier:       10 req/hour,    100 req/day     (default for new keys)
-- Basic tier:     100 req/hour,  1,000 req/day     ($9/month via RapidAPI)
-- Pro tier:     1,000 req/hour, 10,000 req/day     ($29/month via RapidAPI)
-- Enterprise: 10,000 req/hour, 100,000 req/day     (Custom pricing)

-- ============================================================================
-- Sample Queries
-- ============================================================================

-- Get user's API keys with usage stats
-- SELECT 
--   k.id,
--   k.name,
--   k.tier,
--   k.active,
--   k.expires_at,
--   k.last_used_at,
--   COUNT(u.id) as total_requests,
--   COUNT(CASE WHEN u.created_at > NOW() - INTERVAL '1 day' THEN 1 END) as requests_today
-- FROM api_keys k
-- LEFT JOIN api_usage u ON k.id = u.key_id
-- WHERE k.user_id = $user_id
-- GROUP BY k.id;

-- Check current rate limit usage for a key
-- SELECT COUNT(*) as hourly_usage
-- FROM api_usage
-- WHERE key_id = $key_id 
--   AND created_at > NOW() - INTERVAL '1 hour';

-- Get top endpoints by request count
-- SELECT endpoint, COUNT(*) as requests
-- FROM api_usage
-- WHERE created_at > NOW() - INTERVAL '7 days'
-- GROUP BY endpoint
-- ORDER BY requests DESC
-- LIMIT 10;
