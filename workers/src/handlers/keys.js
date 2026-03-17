/**
 * API Keys Management Handler
 * 
 * Endpoints for users to generate and manage API keys for external access.
 * Used for RapidAPI marketplace, Zapier, Make.com, and direct API access.
 * 
 * Routes:
 * - POST /api/keys - Generate new API key
 * - GET /api/keys - List user's API keys
 * - GET /api/keys/:id - Get API key details
 * - DELETE /api/keys/:id - Deactivate/delete API key
 * - GET /api/keys/:id/usage - Get usage statistics
 */

import { generateApiKey } from '../middleware/apiKey.js';
import { getUserFromRequest } from '../middleware/auth.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { normalizeTierName } from '../lib/stripe.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';

/**
 * Main handler for /api/keys routes
 * @param {Request} request - Incoming request
 * @param {Object} env - Environment bindings
 * @param {string} path - Subpath after /api/keys
 * @returns {Response} JSON response
 */
export async function handleApiKeys(request, env, path) {
  const method = request.method;

  // All routes require authentication
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return Response.json({ 
      error: 'Unauthorized',
      message: 'Authentication required' 
    }, { status: 401 });
  }

  // POST /api/keys - Generate new API key
  if (method === 'POST' && path === '/') {
    return generateKey(request, env, user);
  }

  // GET /api/keys - List all keys
  if (method === 'GET' && path === '/') {
    return listKeys(request, env, user);
  }

  // GET /api/keys/:id - Get key details
  if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
    const keyId = path.substring(1);
    return getKey(request, env, user, keyId);
  }

  // DELETE /api/keys/:id - Delete key
  if (method === 'DELETE' && path.match(/^\/[a-f0-9-]+$/)) {
    const keyId = path.substring(1);
    return deleteKey(request, env, user, keyId);
  }

  // GET /api/keys/:id/usage - Get usage stats
  if (method === 'GET' && path.match(/^\/[a-f0-9-]+\/usage$/)) {
    const keyId = path.split('/')[1];
    return getUsageStats(request, env, user, keyId);
  }

  return Response.json({
    error: 'Not Found',
    message: 'API endpoint not found'
  }, { status: 404 });
}

/**
 * Generate new API key
 * POST /api/keys
 * Body: { name, tier?, scopes?, expiresInDays? }
 */
async function generateKey(request, env, user) {
  try {
    const body = await request.json();
    const { name, tier, scopes, expiresInDays } = body;

    // Validate name
    if (!name || name.trim().length === 0) {
      return Response.json({
        error: 'Name is required',
        message: 'Please provide a name for your API key'
      }, { status: 400 });
    }

    // Determine tier based on user's subscription
    // BL-N1: Use canonical-only TIER_ORDER and normalize both sides before comparison
    // to prevent legacy aliases ('regular', 'white_label') from producing wrong index results.
    const TIER_ORDER = ['free', 'individual', 'practitioner', 'agency'];
    const effectiveTier = normalizeTierName(user.tier || 'free');
    let keyTier = normalizeTierName(tier || 'free');

    // Reject unknown tier values outright
    if (!TIER_ORDER.includes(keyTier)) {
      return Response.json({
        error: 'Invalid tier',
        message: 'Key tier must be one of: free, individual, practitioner, agency'
      }, { status: 400 });
    }

    const userTierIdx = TIER_ORDER.indexOf(effectiveTier);
    const keyTierIdx  = TIER_ORDER.indexOf(keyTier);
    if (keyTierIdx > (userTierIdx === -1 ? 0 : userTierIdx)) {
      return Response.json({
        error: 'Upgrade required',
        message: 'Cannot create an API key with a higher tier than your subscription',
        upgradeUrl: '/app/pricing'
      }, { status: 403 });
    }

    // Check key limit (free users: 2 keys, paid users: 10 keys)
    const keyLimit = effectiveTier === 'free' ? 2 : 10;
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows: countRows } = await query(QUERIES.countActiveApiKeys, [user.id]);
    const existingKeysResult = countRows[0];

    if (existingKeysResult.count >= keyLimit) {
      return Response.json({
        error: 'Key limit reached',
        message: `You have reached the maximum of ${keyLimit} active API keys. Delete an existing key to create a new one.`,
        limit: keyLimit,
        current: existingKeysResult.count
      }, { status: 403 });
    }

    // Generate the API key
    const result = await generateApiKey(env, user.id, name, {
      tier: keyTier,
      scopes: scopes || ['read'],
      expiresInDays: expiresInDays
    });

    return Response.json({
      ok: true,
      message: 'API key generated successfully. Save it now - it will not be shown again!',
      apiKey: result.key,  // Only shown once
      keyId: result.keyId,
      name: name,
      tier: result.tier,
      scopes: result.scopes,
      rateLimitPerHour: result.rateLimitPerHour,
      rateLimitPerDay: result.rateLimitPerDay,
      expiresAt: result.expiresAt,
      createdAt: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'keys-generate' });
  }
}

/**
 * List user's API keys
 * GET /api/keys
 */
async function listKeys(request, env, user) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.listApiKeys, [user.id]);

    const keys = rows.map(key => ({
      id: key.id,
      name: key.name,
      scopes: typeof key.scopes === 'string' ? JSON.parse(key.scopes) : key.scopes,
      tier: key.tier,
      rateLimitPerHour: key.rate_limit_per_hour,
      rateLimitPerDay: key.rate_limit_per_day,
      active: !!key.active,
      expiresAt: key.expires_at,
      lastUsedAt: key.last_used_at,
      createdAt: key.created_at,
      usage: {
        totalRequests: key.total_requests || 0,
        requestsToday: key.requests_today || 0,
        errorCount: key.error_count || 0
      }
    }));

    return Response.json({
      ok: true,
      keys: keys,
      total: keys.length
    });

  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'keys-list' });
  }
}

/**
 * Get API key details
 * GET /api/keys/:id
 */
async function getKey(request, env, user, keyId) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.getApiKeyById, [keyId, user.id]);
    const result = rows[0] || null;

    if (!result) {
      return Response.json({
        error: 'Not found',
        message: 'API key not found'
      }, { status: 404 });
    }

    return Response.json({
      ok: true,
      key: {
        id: result.id,
        name: result.name,
        scopes: typeof result.scopes === 'string' ? JSON.parse(result.scopes) : result.scopes,
        tier: result.tier,
        rateLimitPerHour: result.rate_limit_per_hour,
        rateLimitPerDay: result.rate_limit_per_day,
        active: !!result.active,
        expiresAt: result.expires_at,
        lastUsedAt: result.last_used_at,
        createdAt: result.created_at
      }
    });

  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'keys-get' });
  }
}

/**
 * Delete (deactivate) API key
 * DELETE /api/keys/:id
 */
async function deleteKey(request, env, user, keyId) {
  try {
    // Check ownership
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows } = await query(QUERIES.checkApiKeyOwnership, [keyId, user.id]);
    const result = rows[0] || null;

    if (!result) {
      return Response.json({
        error: 'Not found',
        message: 'API key not found'
      }, { status: 404 });
    }

    // Soft delete (deactivate instead of actual delete to preserve usage history)
    await query(QUERIES.deactivateApiKey, [keyId]);

    return Response.json({
      ok: true,
      message: 'API key deactivated successfully'
    });

  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'keys-delete' });
  }
}

/**
 * Get usage statistics for an API key
 * GET /api/keys/:id/usage
 * Query params: ?days=30 (default: 7)
 */
async function getUsageStats(request, env, user, keyId) {
  try {
    // Check ownership
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows: keyRows } = await query(QUERIES.getApiKeyForUsage, [keyId, user.id]);
    const keyResult = keyRows[0] || null;

    if (!keyResult) {
      return Response.json({
        error: 'Not found',
        message: 'API key not found'
      }, { status: 404 });
    }

    // Parse query params
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '7');

    // Get overall stats
    const { rows: statsRows } = await query(QUERIES.getApiKeyUsageStats, [keyId, days]);
    const statsResult = statsRows[0];

    // Get top endpoints
    const { rows: endpointRows } = await query(QUERIES.getApiKeyTopEndpoints, [keyId, days]);

    // Get daily usage (for chart)
    const { rows: dailyRows } = await query(QUERIES.getApiKeyDailyUsage, [keyId, days]);

    return Response.json({
      ok: true,
      keyName: keyResult.name,
      tier: keyResult.tier,
      rateLimitPerDay: keyResult.rate_limit_per_day,
      period: {
        days: days,
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      },
      summary: {
        totalRequests: statsResult.total_requests || 0,
        errorCount: statsResult.error_count || 0,
        requestsLastHour: statsResult.requests_last_hour || 0,
        requestsLastDay: statsResult.requests_last_day || 0,
        avgResponseTime: Math.round(statsResult.avg_response_time || 0),
        lastRequestAt: statsResult.last_request_at
      },
      topEndpoints: endpointRows.map(e => ({
        endpoint: e.endpoint,
        requests: e.count
      })),
      dailyUsage: dailyRows.map(d => ({
        date: d.date,
        requests: d.requests,
        errors: d.errors
      }))
    });

  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'keys-usage-stats' });
  }
}
