/**
 * Promo Code Handler
 *
 * Routes:
 *   GET  /api/promo/validate?code=... — Validate a promo code (user-facing)
 *   POST /api/promo/apply             — Apply promo to checkout (records redemption)
 *   POST /api/admin/promo            — Create a promo code (admin only)
 *   GET  /api/admin/promo            — List all promo codes (admin only)
 *
 * Admin routes require the X-Admin-Token header to match ADMIN_TOKEN env var.
 * User routes require a valid JWT.
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { getUserFromRequest } from '../middleware/auth.js';

// ─── Admin Guard ─────────────────────────────────────────────

function isAdmin(request, env) {
  const adminToken = env.ADMIN_TOKEN;
  if (!adminToken) return false; // Admin token not configured — block all admin ops
  const provided = request.headers.get('X-Admin-Token');
  if (!provided) return false;
  // BL-ADMIN-001: Constant-time comparison to prevent timing side-channel attacks
  const result = constantTimeEqual(provided, adminToken);
  if (!result) {
    console.warn(JSON.stringify({
      event: 'admin_auth_fail', ip: request.headers.get('CF-Connecting-IP') || 'unknown', path: new URL(request.url).pathname
    }));
  }
  return result;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Always compares all bytes regardless of where a mismatch occurs.
 */
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ─── User-Facing: Validate Promo Code ────────────────────────

/**
 * GET /api/promo/validate?code=...
 * Validates a promo code without consuming a redemption.
 * Returns discount info so the frontend can show the user what they'll save.
 */
export async function handleValidatePromo(request, env, code) {
  if (!code || typeof code !== 'string' || code.length > 64) {
    return Response.json({ valid: false, error: 'Invalid code format' }, { status: 400 });
  }

  // Sanitize: only alphanumeric and hyphens
  if (!/^[A-Z0-9_-]+$/i.test(code)) {
    return Response.json({ valid: false, error: 'Invalid code format' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows } = await query(QUERIES.validatePromoCode, [code.toUpperCase()]);

  if (!rows || rows.length === 0) {
    return Response.json({ valid: false, error: 'Code not found or expired' }, { status: 404 });
  }

  const promo = rows[0];
  const savings = promo.discount_type === 'percentage'
    ? `${promo.discount_value}% off`
    : `$${(promo.discount_value / 100).toFixed(2)} off`;

  return Response.json({
    valid: true,
    code: promo.code,
    discount_type: promo.discount_type,
    discount_value: promo.discount_value,
    savings,
    applicable_tiers: promo.applicable_tiers,
    redemptions_remaining: promo.max_redemptions
      ? promo.max_redemptions - promo.redemptions
      : null
  });
}

// ─── User-Facing: Apply Promo at Checkout ────────────────────

/**
 * POST /api/promo/apply
 * Body: { code: "PROMO20", tier: "regular" }
 * Records a redemption and returns a Stripe coupon ID (if applicable_tiers match).
 * Called from billing.js before creating the Stripe checkout session.
 */
export async function handleApplyPromo(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { code, tier } = body;
  if (!code || typeof code !== 'string') {
    return Response.json({ error: 'code is required' }, { status: 400 });
  }
  if (!/^[A-Z0-9_-]+$/i.test(code) || code.length > 64) {
    return Response.json({ error: 'Invalid code format' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows } = await query(QUERIES.redeemPromoCode, [code.toUpperCase()]);

  if (!rows || rows.length === 0) {
    return Response.json({ ok: false, error: 'Code not found or already exhausted' }, { status: 404 });
  }

  const promo = rows[0];

  // Check tier restriction
  if (promo.applicable_tiers && promo.applicable_tiers.length > 0 && tier) {
    if (!promo.applicable_tiers.includes(tier)) {
      return Response.json({
        ok: false,
        error: `Code "${promo.code}" is not valid for the ${tier} plan`
      }, { status: 422 });
    }
  }

  return Response.json({
    ok: true,
    code: promo.code,
    discount_type: promo.discount_type,
    discount_value: promo.discount_value
  });
}

// ─── Admin: Create Promo Code ─────────────────────────────────

/**
 * POST /api/admin/promo
 * Body: { code, discount_type, discount_value, max_redemptions?, valid_until?, applicable_tiers? }
 */
export async function handleCreatePromo(request, env) {
  if (!isAdmin(request, env)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { code, discount_type, discount_value, max_redemptions, valid_until, applicable_tiers } = body;

  if (!code || !discount_type || discount_value == null) {
    return Response.json({ error: 'code, discount_type, discount_value are required' }, { status: 400 });
  }
  if (!['percentage', 'fixed_amount'].includes(discount_type)) {
    return Response.json({ error: 'discount_type must be percentage or fixed_amount' }, { status: 400 });
  }
  if (typeof discount_value !== 'number' || discount_value <= 0) {
    return Response.json({ error: 'discount_value must be a positive number' }, { status: 400 });
  }
  if (discount_type === 'percentage' && discount_value > 100) {
    return Response.json({ error: 'Percentage discount_value cannot exceed 100' }, { status: 400 });
  }
  if (!/^[A-Z0-9_-]+$/i.test(code) || code.length > 64) {
    return Response.json({ error: 'Invalid code format (alphanumeric, hyphens, underscores, max 64 chars)' }, { status: 400 });
  }
  const validTiers = ['free', 'regular', 'individual', 'practitioner', 'white_label', 'agency'];
  if (applicable_tiers && (!Array.isArray(applicable_tiers) || !applicable_tiers.every(t => validTiers.includes(t)))) {
    return Response.json({ error: `applicable_tiers must be array of: ${validTiers.join(', ')}` }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  try {
    const { rows } = await query(QUERIES.createPromoCode, [
      code.toUpperCase(),
      discount_type,
      discount_value,
      max_redemptions || null,
      valid_until || null,
      applicable_tiers ? JSON.stringify(applicable_tiers) : null
    ]);
    return Response.json({ ok: true, promo: rows[0] }, { status: 201 });
  } catch (err) {
    if (err.message?.includes('unique')) {
      return Response.json({ error: `Code "${code.toUpperCase()}" already exists` }, { status: 409 });
    }
    throw err;
  }
}

// ─── Admin: List Promo Codes ──────────────────────────────────

/**
 * GET /api/admin/promo
 */
export async function handleListPromos(request, env) {
  if (!isAdmin(request, env)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const { rows } = await query(QUERIES.listPromoCodes, []);
  return Response.json({ promos: rows || [] });
}
