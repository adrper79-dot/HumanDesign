/**
 * Tier Enforcement Middleware
 * 
 * Checks user's subscription tier and enforces feature access and usage quotas.
 * Supports both monthly quotas and daily ceilings via DB-backed atomic counters.
 * Used in conjunction with auth middleware to gate features by tier.
 * 
 * Tier resolution priority:
 * 1. lifetime_access === true → at least 'individual' tier
 * 2. Active subscription tier from subscriptions table
 * 3. Active transit pass → transient feature grants (transit snapshots)
 * 4. Default: 'free'
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { getTier, hasFeatureAccess, isQuotaExceeded, normalizeTierName } from '../lib/stripe.js';
import { emitDegradeEvent } from '../lib/analytics.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('tierEnforcement');

/**
 * Resolve effective tier considering lifetime access + subscription status.
 * Also checks active transit pass for transient feature grants.
 *
 * @param {Function} query - DB query function
 * @param {string} userId - User ID (from JWT sub)
 * @returns {Promise<{tier: string, hasActiveTransitPass: boolean}>}
 */
async function resolveEffectiveTier(query, userId) {
  // Get user's lifetime/transit status
  const userResult = await query(
    `SELECT lifetime_access, transit_pass_expires FROM users WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];
  const hasActiveTransitPass = user?.transit_pass_expires
    ? new Date(user.transit_pass_expires) > new Date()
    : false;

  // Lifetime access overrides everything — minimum individual tier
  if (user?.lifetime_access) {
    return { tier: 'individual', hasActiveTransitPass };
  }

  // Use the same active/grace-period lookup as billing so entitlement follows
  // the current billable subscription record.
  const subscription = await query(QUERIES.getActiveSubscription, [userId]);

  let tier = 'free';
  if (subscription.rows.length > 0) {
    const sub = subscription.rows[0];
    tier = normalizeTierName(sub.tier);
  }

  // Agency seat propagation: if this user is a member of an Agency plan,
  // they inherit at least 'practitioner' tier capabilities from the owner.
  // Guard against missing agency_seats table (migration not yet applied) — 42P01.
  if (tier === 'free' || tier === 'individual') {
    try {
      const seatResult = await query(QUERIES.getAgencyOwnerForMember, [userId]);
      if (seatResult.rows?.length) {
        const ownerTier = normalizeTierName(seatResult.rows[0].owner_tier);
        // Seat members get practitioner access regardless of owner tier,
        // as long as the owner has an active agency subscription.
        if (ownerTier === 'agency') {
          tier = 'practitioner';
        }
      }
    } catch (seatErr) {
      // 42P01 = undefined_table — agency_seats not yet migrated; treat as no seat
      if (seatErr.code !== '42P01') throw seatErr;
    }
  }

  return { tier, hasActiveTransitPass };
}

/**
 * Check if user has access to a feature based on their subscription tier
 * Returns null if authorized, or a Response if unauthorized
 * 
 * @param {Request} request - Request object (should have _user from auth middleware)
 * @param {Object} env - Environment bindings
 * @param {string} feature - Feature name to check (e.g., 'profileGenerations', 'practitionerTools')
 * @returns {Promise<Response|null>} Error response or null if authorized
 */
export async function enforceFeatureAccess(request, env, feature) {
  const user = request._user;
  
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const { tier, hasActiveTransitPass } = await resolveEffectiveTier(query, user.sub);

    // Transit pass grants transitSnapshots access even for free users
    let effectiveAccess = hasFeatureAccess(tier, feature);
    if (!effectiveAccess && hasActiveTransitPass && feature === 'transitSnapshots') {
      effectiveAccess = true;
    }

    if (!effectiveAccess) {
      return Response.json({
        error: 'Feature not available in your current tier',
        current_tier: tier,
        feature: feature,
        upgrade_required: true
      }, { status: 403 });
    }

    // Attach tier info to request for downstream handlers
    request._tier = tier;
    request._hasActiveTransitPass = hasActiveTransitPass;
    return null; // Authorized

  } catch (error) {
    log.error('tier_enforcement_error', { error: error.message });
    // BL-S-MW4: Don't leak internal error details to client
    return Response.json({
      error: 'Failed to verify subscription'
    }, { status: 500 });
  }
}

/**
 * Check if user has exceeded usage quota for a feature
 * Returns null if within quota, or a Response if quota exceeded
 * 
 * @param {Request} request - Request object (should have _user from auth middleware)
 * @param {Object} env - Environment bindings
 * @param {string} action - Action type (e.g., 'chart_calculation', 'profile_generation')
 * @param {string} feature - Feature name for quota check (e.g., 'chartCalculations', 'profileGenerations')
 * @returns {Promise<Response|null>} Error response or null if within quota
 */
export async function enforceUsageQuota(request, env, action, feature) {
  const user = request._user;
  
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // AUDIT-SEC-003: Gate LLM-consuming actions behind email verification.
  // Users can browse the app but cannot use quota-limited features until verified.
  try {
    const verifiedResult = await query(QUERIES.getEmailVerifiedStatus, [user.sub]);
    const verified = verifiedResult.rows?.[0]?.email_verified;
    if (!verified) {
      return Response.json({
        error: 'Please verify your email address to use this feature.',
        email_verification_required: true
      }, { status: 403 });
    }
  } catch (err) {
    // If the column doesn't exist yet (pre-migration), fail open to avoid
    // breaking existing users. Emit degradation event for alerting.
    log.warn('email_verified_check_failed', { error: err.message, failOpen: true });
    emitDegradeEvent(env, {
      dependency: 'db',
      route: 'enforceUsageQuota/email_verified',
      severity: 'high',
      reason: err.message,
      failOpen: true,
      userId: user.sub,
    });
  }

  try {
    const { tier, hasActiveTransitPass } = await resolveEffectiveTier(query, user.sub);

    const tierConfig = getTier(tier);
    const limit = tierConfig.features[feature];

    // Unlimited features skip quota check entirely
    if (limit === Infinity || limit === true) {
      request._tier = tier;
      request._usage = 0;
      return null;
    }

    // BL-RACE-001: Atomic quota enforcement — single query that checks + inserts
    // in one statement, eliminating the TOCTOU race between read and write.
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const result = await query(QUERIES.atomicQuotaCheckAndInsert, [
      user.sub,
      action,
      periodStart.toISOString(),
      `${action}_bonus`,
      limit
    ]);

    const { net_usage, quota_exceeded } = result.rows[0];
    const netUsage = parseInt(net_usage);

    if (quota_exceeded) {
      log.warn('quota_exceeded', { userId: user.sub, tier, feature, limit, current_usage: netUsage });
      return Response.json({
        error: 'Usage quota exceeded',
        current_tier: tier,
        feature: feature,
        limit: limit,
        current_usage: netUsage,
        upgrade_required: true
      }, { status: 429 });
    }

    // Attach tier and usage info to request
    request._tier = tier;
    request._usage = netUsage;
    
    return null; // Within quota — usage already recorded atomically

  } catch (error) {
    log.error('usage_quota_enforcement_error', { error: error.message });
    // BL-S-MW4: Don't leak internal error details to client
    return Response.json({
      error: 'Failed to verify usage quota'
    }, { status: 500 });
  }
}

/**
 * Record usage of a feature (call after successful operation)
 * 
 * @param {Object} env - Environment bindings
 * @param {string} userId - User ID
 * @param {string} action - Action type (e.g., 'chart_calculation', 'profile_generation')
 * @param {string} endpoint - API endpoint called (optional)
 * @param {number} quotaCost - Cost in quota units (default 1)
 */
export async function recordUsage(env, userId, action, endpoint = null, quotaCost = 1) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    await query(QUERIES.createUsageRecord, [
      userId,
      action,
      endpoint,
      quotaCost
    ]);
  } catch (error) {
    // Don't fail the request if usage recording fails, just log it
    log.error('record_usage_failed', { error: error.message, userId });
    emitDegradeEvent(env, {
      dependency: 'db',
      route: 'recordUsage',
      severity: 'medium',
      reason: error.message,
      failOpen: true,
      userId,
    });
  }
}

// ─── Daily Ceiling Enforcement ───────────────────────────────

/**
 * Get today's date as YYYY-MM-DD string for KV key construction.
 * @returns {string}
 */
function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Check if user has exceeded their daily ceiling for an action.
 * Uses a DB-backed atomic counter so cross-isolate requests cannot overshoot.
 * 
 * @param {Request} request - Request object (should have _user from auth middleware)
 * @param {Object} env - Environment bindings (must include NEON_CONNECTION_STRING)
 * @param {string} action - 'synthesis' or 'question'
 * @returns {Promise<Response|null>} Error response or null if within ceiling
 */
export async function enforceDailyCeiling(request, env, action) {
  const user = request._user;
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // CFO-003: DB access is REQUIRED for quota enforcement.
  // Fail closed — if DB is not available, deny the request rather than
  // allowing unlimited free access.
  if (!env.NEON_CONNECTION_STRING) {
    log.error('daily_ceiling_neon_missing', { action: 'enforceDailyCeiling' });
    return Response.json(
      { error: 'Service temporarily unavailable — please try again shortly' },
      { status: 503, headers: { 'Retry-After': '30' } }
    );
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const tier = request._tier || 'free';
  const tierConfig = getTier(tier);

  // Map action to the daily limit feature key
  const limitKey = action === 'synthesis' ? 'dailySynthesisLimit' : 'dailyQuestionLimit';
  const dailyLimit = tierConfig.features[limitKey];

  // No daily limit configured for this tier/action
  if (!dailyLimit || dailyLimit === Infinity) {
    return null;
  }

  const counterKey = `daily:${user.sub}:${getTodayKey()}:${action}`;
  const windowStart = `${getTodayKey()}T00:00:00.000Z`;
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  const windowEnd = tomorrow.toISOString();

  try {
    const result = await query(QUERIES.atomicWindowCounterIncrement, [
      counterKey,
      windowStart,
      windowEnd,
    ]);
    const current = parseInt(result.rows[0]?.count || '0', 10);

    if (current > dailyLimit) {
      return Response.json({
        error: 'Daily limit reached',
        current_tier: tier,
        action: action,
        daily_limit: dailyLimit,
        daily_usage: Math.max(0, current - 1),
        resets_at: `${getTodayKey()}T00:00:00Z (next day)`,
        upgrade_required: tier !== 'white_label' && tier !== 'agency'
      }, { status: 429 });
    }

    return null; // Within daily ceiling
  } catch (error) {
    // CFO-003: Fail closed — DB failure should block the request
    // to prevent unlimited free access during storage outages.
    log.error('daily_ceiling_check_failed', { error: error.message });
    return Response.json(
      { error: 'Service temporarily unavailable — please try again shortly' },
      { status: 503, headers: { 'Retry-After': '30' } }
    );
  }
}

/**
 * Increment the daily counter for an action (call after successful operation).
 * Sets TTL to 48 hours so keys auto-expire.
 *
 * @param {Object} env - Environment bindings
 * @param {string} userId - User ID
 * @param {string} action - 'synthesis' or 'question'
 */
export async function incrementDailyCounter(env, userId, action) {
  // Increment now happens atomically inside enforceDailyCeiling.
  // This remains a compatibility no-op for existing handlers.
  void env;
  void userId;
  void action;
}

/**
 * Get user's current subscription tier
 * 
 * @param {Object} env - Environment bindings
 * @param {string} userId - User ID
 * @returns {Promise<string>} Tier name (free, seeker, guide, practitioner)
 */
export async function getUserTier(env, userId) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const { tier } = await resolveEffectiveTier(query, userId);
    return tier;
  } catch (error) {
    log.error('get_user_tier_failed', { error: error.message, userId });
    return 'free'; // Default to free on error
  }
}
