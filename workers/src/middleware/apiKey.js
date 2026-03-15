/**
 * API Key Authentication Middleware
 * 
 * Enables external access to Prime Self API via API keys.
 * Used for RapidAPI marketplace, Zapier, Make.com, and direct API customers.
 * 
 * Authentication Flow:
 * 1. Check for X-API-Key header
 * 2. Validate against api_keys table
 * 3. Check key status (active, rate limits, expiration)
 * 4. Attach user context to request
 * 5. Track usage for billing/analytics
 * 
 * Rate Limiting:
 * - Free tier: 100 requests/day
 * - Basic tier: 1,000 requests/day
 * - Pro tier: 10,000 requests/day
 * - Enterprise tier: Unlimited
 */

import { createQueryFn } from '../db/queries.js';

/**
 * Middleware to authenticate API key from X-API-Key header
 * @param {Request} request - Incoming request
 * @param {Object} env - Environment bindings
 * @returns {Object} { user, apiKey, error } - Authentication result
 */
export async function authenticateApiKey(request, env) {
  // Extract API key from headers
  const apiKeyHeader = request.headers.get('X-API-Key');
  
  if (!apiKeyHeader) {
    return {
      error: {
        status: 401,
        message: 'Missing API key. Include X-API-Key header with your request.',
        code: 'API_KEY_MISSING'
      }
    };
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Query API key from database
    const { rows } = await query(`
      SELECT 
        k.id as key_id,
        k.user_id,
        k.name as key_name,
        k.key_hash,
        k.scopes,
        k.tier,
        k.rate_limit_per_day,
        k.rate_limit_per_hour,
        k.active,
        k.expires_at,
        k.created_at,
        k.last_used_at,
        u.id as user_id,
        u.email,
        u.tier as user_tier
      FROM api_keys k
      INNER JOIN users u ON k.user_id = u.id
      WHERE k.key_hash = $1
      LIMIT 1
    `, [await hashApiKey(apiKeyHeader)]);

    const result = rows[0] || null;

    if (!result) {
      return {
        error: {
          status: 401,
          message: 'Invalid API key. Check your key and try again.',
          code: 'API_KEY_INVALID'
        }
      };
    }

    // Check if key is active
    if (!result.active) {
      return {
        error: {
          status: 403,
          message: 'API key has been deactivated. Generate a new key in Settings.',
          code: 'API_KEY_DEACTIVATED'
        }
      };
    }

    // Check if key is expired
    if (result.expires_at && new Date(result.expires_at) < new Date()) {
      return {
        error: {
          status: 403,
          message: 'API key has expired. Generate a new key in Settings.',
          code: 'API_KEY_EXPIRED'
        }
      };
    }

    // Check rate limits
    const rateLimitResult = await checkRateLimit(env, result.key_id, result.rate_limit_per_hour, result.rate_limit_per_day);
    if (!rateLimitResult.allowed) {
      return {
        error: {
          status: 429,
          message: `Rate limit exceeded. ${rateLimitResult.limit} requests per ${rateLimitResult.window}. Resets in ${rateLimitResult.resetIn} seconds.`,
          code: 'RATE_LIMIT_EXCEEDED',
          limit: rateLimitResult.limit,
          window: rateLimitResult.window,
          resetIn: rateLimitResult.resetIn,
          upgrade: result.tier === 'free' ? 'Upgrade to Basic tier for 1,000 requests/day' : null
        }
      };
    }

    // Parse scopes (JSON array)
    const scopes = typeof result.scopes === 'string' ? JSON.parse(result.scopes || '["read"]') : (result.scopes || ['read']);

    // Update last_used_at timestamp (async, don't await)
    query(`
      UPDATE api_keys 
      SET last_used_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [result.key_id]).catch(err => {
      console.error('Failed to update API key last_used_at:', err);
    });

    // Track API usage (async, don't await)
    trackApiUsage(env, result.key_id, request.url, request.method).catch(err => {
      console.error('Failed to track API usage:', err);
    });

    // Return authenticated user and API key info
    return {
      user: {
        id: result.user_id,
        email: result.email,
        tier: result.user_tier
      },
      apiKey: {
        id: result.key_id,
        name: result.key_name,
        scopes: scopes,
        tier: result.tier,
        rateLimitPerDay: result.rate_limit_per_day,
        rateLimitPerHour: result.rate_limit_per_hour
      }
    };

  } catch (error) {
    console.error('API key authentication error:', error);
    return {
      error: {
        status: 500,
        message: 'Internal server error during authentication',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

/**
 * Check if API key has exceeded rate limits
 * @param {Object} env - Environment bindings
 * @param {string} keyId - API key ID
 * @param {number} hourlyLimit - Requests per hour limit
 * @param {number} dailyLimit - Requests per day limit
 * @returns {Promise<Object>} { allowed, limit, window, resetIn }
 */
async function checkRateLimit(env, keyId, hourlyLimit, dailyLimit) {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Check hourly limit
  const { rows: hourlyRows } = await query(`
    SELECT COUNT(*)::int as count
    FROM api_usage
    WHERE key_id = $1 AND created_at > $2
  `, [keyId, hourAgo.toISOString()]);

  const hourlyResult = hourlyRows[0] || { count: 0 };

  if (hourlyResult.count >= hourlyLimit) {
    const { rows: oldestRows } = await query(`
      SELECT created_at
      FROM api_usage
      WHERE key_id = $1 AND created_at > $2
      ORDER BY created_at ASC
      LIMIT 1
    `, [keyId, hourAgo.toISOString()]);

    const oldestRequest = oldestRows[0] || null;

    const resetIn = oldestRequest 
      ? Math.ceil((new Date(oldestRequest.created_at).getTime() + 60 * 60 * 1000 - now.getTime()) / 1000)
      : 3600;

    return {
      allowed: false,
      limit: hourlyLimit,
      window: 'hour',
      resetIn: resetIn
    };
  }

  // Check daily limit
  const { rows: dailyRows } = await query(`
    SELECT COUNT(*)::int as count
    FROM api_usage
    WHERE key_id = $1 AND created_at > $2
  `, [keyId, dayAgo.toISOString()]);

  const dailyResult = dailyRows[0] || { count: 0 };

  if (dailyResult.count >= dailyLimit) {
    const { rows: oldestDailyRows } = await query(`
      SELECT created_at
      FROM api_usage
      WHERE key_id = $1 AND created_at > $2
      ORDER BY created_at ASC
      LIMIT 1
    `, [keyId, dayAgo.toISOString()]);

    const oldestRequest = oldestDailyRows[0] || null;

    const resetIn = oldestRequest
      ? Math.ceil((new Date(oldestRequest.created_at).getTime() + 24 * 60 * 60 * 1000 - now.getTime()) / 1000)
      : 86400;

    return {
      allowed: false,
      limit: dailyLimit,
      window: 'day',
      resetIn: resetIn
    };
  }

  return { allowed: true };
}

/**
 * Track API usage for analytics and billing
 * @param {Object} env - Environment bindings
 * @param {string} keyId - API key ID
 * @param {string} url - Request URL
 * @param {string} method - HTTP method
 * @returns {Promise<void>}
 */
async function trackApiUsage(env, keyId, url, method) {
  const path = new URL(url).pathname;
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  
  await query(`
    INSERT INTO api_usage (key_id, endpoint, method, created_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
  `, [keyId, path, method]);
}

/**
 * Hash API key for secure storage
 * Uses SHA-256 to hash the key before database lookup
 * @param {string} apiKey - Raw API key string
 * @returns {string} Hex-encoded hash
 */
/**
 * Hash API key for secure storage using SHA-256 via Web Crypto API
 * @param {string} apiKey - Raw API key string
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
async function hashApiKey(apiKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a new API key (for /api/keys/generate endpoint)
 * @param {Object} env - Environment bindings
 * @param {number} userId - User ID
 * @param {string} name - Key name/description
 * @param {Object} options - { tier, scopes, expiresInDays }
 * @returns {Promise<Object>} { key, keyId, hash }
 */
export async function generateApiKey(env, userId, name, options = {}) {
  const {
    tier = 'free',
    scopes = ['read'],
    expiresInDays = null
  } = options;

  // Generate random API key (32 bytes = 64 hex chars)
  const keyBytes = new Uint8Array(32);
  crypto.getRandomValues(keyBytes);
  const apiKey = 'ps_' + Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  // Hash the key for storage
  const keyHash = await hashApiKey(apiKey);

  // Calculate rate limits based on tier
  const rateLimits = {
    free: { perHour: 10, perDay: 100 },
    basic: { perHour: 100, perDay: 1000 },
    pro: { perHour: 1000, perDay: 10000 },
    enterprise: { perHour: 10000, perDay: 100000 }
  };

  const limits = rateLimits[tier] || rateLimits.free;

  // Calculate expiration date
  const expiresAt = expiresInDays 
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Insert into database
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows } = await query(`
    INSERT INTO api_keys (
      user_id, 
      name, 
      key_hash, 
      scopes, 
      tier, 
      rate_limit_per_hour, 
      rate_limit_per_day, 
      active, 
      expires_at, 
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, CURRENT_TIMESTAMP)
    RETURNING id
  `, [
    userId,
    name,
    keyHash,
    JSON.stringify(scopes),
    tier,
    limits.perHour,
    limits.perDay,
    expiresAt
  ]);

  const result = rows[0];

  return {
    key: apiKey, // Only returned once during generation
    keyId: result.id,
    hash: keyHash,
    tier: tier,
    scopes: scopes,
    rateLimitPerHour: limits.perHour,
    rateLimitPerDay: limits.perDay,
    expiresAt: expiresAt
  };
}

/**
 * Check if API key has specific scope
 * @param {Object} apiKey - API key object from authenticateApiKey
 * @param {string} requiredScope - Required scope (e.g., 'write', 'admin')
 * @returns {boolean} True if has scope
 */
export function hasScope(apiKey, requiredScope) {
  if (!apiKey || !apiKey.scopes) return false;
  return apiKey.scopes.includes(requiredScope) || apiKey.scopes.includes('admin');
}

/**
 * Middleware wrapper for routes that require API key authentication
 * @param {Function} handler - Route handler function
 * @param {Object} options - { requireScopes: ['read', 'write'] }
 * @returns {Function} Wrapped handler
 */
function requireApiKey(handler, options = {}) {
  return async (request, env, ...args) => {
    const auth = await authenticateApiKey(request, env);
    
    if (auth.error) {
      return new Response(JSON.stringify({
        error: auth.error.message,
        code: auth.error.code,
        ...auth.error
      }), {
        status: auth.error.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check required scopes
    if (options.requireScopes) {
      const hasRequiredScope = options.requireScopes.some(scope => 
        hasScope(auth.apiKey, scope)
      );

      if (!hasRequiredScope) {
        return new Response(JSON.stringify({
          error: 'Insufficient permissions. Required scopes: ' + options.requireScopes.join(', '),
          code: 'INSUFFICIENT_SCOPE',
          requiredScopes: options.requireScopes,
          yourScopes: auth.apiKey.scopes
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Call handler with authenticated user and API key context
    return handler(request, env, auth.user, auth.apiKey, ...args);
  };
}
