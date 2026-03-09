/**
 * Tier Enforcement Middleware
 * 
 * Checks user's subscription tier and enforces feature access and usage quotas.
 * Used in conjunction with auth middleware to gate features by tier.
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { getTier, hasFeatureAccess, isQuotaExceeded } from '../lib/stripe.js';

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
    // Get user's subscription
    const subscription = await query(QUERIES.getSubscriptionByUserId, [user.sub]);
    
    let tier = 'free';
    if (subscription.rows.length > 0) {
      tier = subscription.rows[0].tier;
    }

    // Check if user has access to this feature
    if (!hasFeatureAccess(tier, feature)) {
      const tierConfig = getTier(tier);
      return Response.json({
        error: 'Feature not available in your current tier',
        current_tier: tier,
        feature: feature,
        upgrade_required: true
      }, { status: 403 });
    }

    // Attach tier info to request for downstream handlers
    request._tier = tier;
    return null; // Authorized

  } catch (error) {
    console.error('Tier enforcement error:', error);
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

  try {
    // Get user's subscription
    const subscription = await query(QUERIES.getSubscriptionByUserId, [user.sub]);
    
    let tier = 'free';
    if (subscription.rows.length > 0) {
      tier = subscription.rows[0].tier;
      
      // If subscription is not active, treat as free tier
      if (subscription.rows[0].status !== 'active' && subscription.rows[0].status !== 'trialing') {
        tier = 'free';
      }
    }

    // Get current period start (beginning of current month)
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    // Get usage for this action in current period
    const usageResult = await query(QUERIES.getUsageByUserAndAction, [
      user.sub,
      action,
      periodStart.toISOString()
    ]);

    const currentUsage = usageResult.rows.length > 0 ? parseInt(usageResult.rows[0].count) : 0;

    // Check if quota exceeded
    if (isQuotaExceeded(tier, feature, currentUsage)) {
      const tierConfig = getTier(tier);
      const limit = tierConfig.features[feature];
      
      return Response.json({
        error: 'Usage quota exceeded',
        current_tier: tier,
        feature: feature,
        limit: limit,
        current_usage: currentUsage,
        upgrade_required: true
      }, { status: 429 });
    }

    // Attach tier and usage info to request
    request._tier = tier;
    request._usage = currentUsage;
    
    return null; // Within quota

  } catch (error) {
    console.error('Usage quota enforcement error:', error);
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
    console.error('Failed to record usage:', error);
  }
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
    const subscription = await query(QUERIES.getSubscriptionByUserId, [userId]);
    
    if (subscription.rows.length === 0) {
      return 'free';
    }

    const sub = subscription.rows[0];
    
    // If subscription is not active, treat as free tier
    if (sub.status !== 'active' && sub.status !== 'trialing') {
      return 'free';
    }

    return sub.tier;
  } catch (error) {
    console.error('Failed to get user tier:', error);
    return 'free'; // Default to free on error
  }
}
