/**
 * Embed Widget Validation Handler
 *
 * GET /api/embed/validate?apiKey=ps_xxx
 *
 * Called cross-origin from embed.html inside third-party iframes.
 * Returns feature flags for the supplied API key without consuming
 * any rate-limit credits — it only validates tier eligibility.
 *
 * Response shape:
 *   { valid: true,  tier: "agency", features: { hideAttribution: true } }
 *   { valid: false, reason: "..." }
 *
 * Security notes:
 * - API key is hashed (SHA-256) before the DB lookup, never stored plain.
 * - Only Agency / white-label-capable users may hide attribution.
 * - Failure mode is safe: embed.html shows attribution on any error or false response.
 * - CORS is wide-open on this endpoint intentionally — it only exposes boolean flags,
 *   no PII, and requires a valid key to return any useful data.
 */

import { createQueryFn } from '../db/queries.js';
import { hasFeatureAccess, normalizeTierName } from '../lib/stripe.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';

/** Re-implement the same SHA-256 hash used in middleware/apiKey.js */
async function hashApiKey(apiKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

/**
 * GET /api/embed/validate?apiKey=ps_xxx
 *
 * Validates an API key and returns the feature flags the owning user is
 * entitled to use inside an embedded widget.
 */
export async function handleEmbedValidate(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'GET') {
    return json({ valid: false, reason: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const apiKey = url.searchParams.get('apiKey');

  if (!apiKey || !apiKey.startsWith('ps_')) {
    return json({ valid: false, reason: 'Missing or malformed apiKey' }, 400);
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const keyHash = await hashApiKey(apiKey);

    const { rows } = await query(
      `SELECT
         k.active,
         k.expires_at,
         u.tier AS user_tier
       FROM api_keys k
       INNER JOIN users u ON k.user_id = u.id
       WHERE k.key_hash = $1
       LIMIT 1`,
      [keyHash]
    );

    const result = rows[0] || null;

    if (!result) {
      return json({ valid: false, reason: 'Invalid API key' });
    }

    if (!result.active) {
      return json({ valid: false, reason: 'API key is inactive' });
    }

    if (result.expires_at && new Date(result.expires_at) < new Date()) {
      return json({ valid: false, reason: 'API key has expired' });
    }

    const tier = normalizeTierName(result.user_tier);
    const canHideAttribution = hasFeatureAccess(tier, 'whiteLabel');

    return json({
      valid: true,
      tier,
      features: {
        hideAttribution: canHideAttribution,
      },
    });

  } catch (err) {
    // Fail safe — do not expose error details cross-origin
    return reportHandledRouteError({
      request, env, error: err, source: 'embed-validate',
      responseFactory: () => json({ valid: false, reason: 'Service error' }, 500)
    });
  }
}
