/**
 * Referrals Handler — Viral Growth & Affiliate Program
 * 
 * Endpoints:
 * - POST /api/referrals/code - Generate unique referral code
 * - GET /api/referrals - Get user's referral stats
 * - GET /api/referrals/history - Get referral conversion history
 * - POST /api/referrals/validate - Validate referral code (public)
 * - POST /api/referrals/apply - Apply referral code to signup
 * - GET /api/referrals/rewards - Get unclaimed rewards
 * - POST /api/referrals/claim - Claim referral reward
 */

import { nanoid } from 'nanoid';
import { trackEvent } from './achievements.js';
import { createQueryFn } from '../db/queries.js';
import { getUserFromRequest } from '../middleware/auth.js';
import { sendNotificationToUser } from './push.js';
import { createStripeClient } from '../lib/stripe.js';

// ─── Generate Referral Code ──────────────────────────────────

/**
 * POST /api/referrals/code
 * Generate or retrieve user's unique referral code
 */
export async function handleGenerateCode(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user already has a referral code
    if (user.referral_code) {
      return new Response(JSON.stringify({
        success: true,
        code: user.referral_code,
        url: `${env.FRONTEND_URL}/signup?ref=${user.referral_code}`,
        existing: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Generate unique code (e.g., "PRIME-xyz123")
    let code;
    let exists = true;
    let attempts = 0;
    
    while (exists && attempts < 10) {
      code = `PRIME-${nanoid(8)}`.toUpperCase();
      
      // Check if code already exists
      const { rows: existingRows } = await query(
        'SELECT id FROM users WHERE referral_code = $1',
        [code]
      );
      
      exists = existingRows.length > 0;
      attempts++;
    }
    
    if (exists) {
      return new Response(JSON.stringify({
        error: 'Failed to generate unique code',
        message: 'Please try again'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update user with referral code
    await query(
      'UPDATE users SET referral_code = $1, updated_at = NOW() WHERE id = $2',
      [code, user.id]
    );
    
    return new Response(JSON.stringify({
      success: true,
      code: code,
      url: `${env.FRONTEND_URL}/signup?ref=${code}`,
      existing: false
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Generate code error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate referral code' // BL-R-H2
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ─── Get Referral Stats ──────────────────────────────────────

/**
 * GET /api/referrals
 * Get user's referral statistics and performance
 */
export async function handleGetStats(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get total referrals
    const { rows: totalRows } = await query(`
      SELECT COUNT(*)::int as count
      FROM referrals
      WHERE referrer_user_id = $1
    `, [user.id]);
    const totalReferrals = totalRows[0];
    
    // Get converted referrals (paid subscriptions)
    const { rows: convertedRows } = await query(`
      SELECT COUNT(*)::int as count
      FROM referrals
      WHERE referrer_user_id = $1 AND converted = true
    `, [user.id]);
    const convertedReferrals = convertedRows[0];
    
    // Get total rewards earned
    const { rows: rewardsRows } = await query(`
      SELECT 
        COUNT(*)::int as rewards_count,
        COALESCE(SUM(reward_value), 0)::int as total_value
      FROM referrals
      WHERE referrer_user_id = $1 AND reward_granted = true
    `, [user.id]);
    const rewardsEarned = rewardsRows[0];
    
    // Get pending rewards (converted but not yet granted)
    const { rows: pendingRows } = await query(`
      SELECT COUNT(*)::int as count
      FROM referrals
      WHERE referrer_user_id = $1 AND converted = true AND reward_granted = false
    `, [user.id]);
    const pendingRewards = pendingRows[0];
    
    // Get recent referrals with details
    const { rows: recentReferrals } = await query(`
      SELECT 
        r.id,
        u.email as referred_email,
        r.converted,
        r.conversion_date,
        r.reward_granted,
        r.reward_type,
        r.reward_value,
        r.created_at
      FROM referrals r
      JOIN users u ON r.referred_user_id = u.id
      WHERE r.referrer_user_id = $1
      ORDER BY r.created_at DESC
      LIMIT 10
    `, [user.id]);
    
    const conversionRate = totalReferrals.count > 0 
      ? (convertedReferrals.count / totalReferrals.count * 100).toFixed(1)
      : 0;
    
    return new Response(JSON.stringify({
      success: true,
      stats: {
        referralCode: user.referral_code,
        referralUrl: user.referral_code ? `${env.FRONTEND_URL}/signup?ref=${user.referral_code}` : null,
        totalReferrals: totalReferrals.count,
        convertedReferrals: convertedReferrals.count,
        conversionRate: parseFloat(conversionRate),
        rewardsEarned: rewardsEarned.rewards_count || 0,
        totalRewardValue: rewardsEarned.total_value || 0,
        pendingRewards: pendingRewards.count
      },
      recentReferrals: recentReferrals.map(ref => ({
        id: ref.id,
        email: ref.referred_email.replace(/(.{3}).*(@.*)/, '$1***$2'),  // Mask email for privacy
        converted: !!ref.converted,
        conversionDate: ref.conversion_date,
        rewardGranted: !!ref.reward_granted,
        rewardType: ref.reward_type,
        rewardValue: ref.reward_value,
        createdAt: ref.created_at
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Get referral stats error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get referral stats'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ─── Get Referral History ────────────────────────────────────

/**
 * GET /api/referrals/history
 * Get full referral conversion history with pagination
 */
export async function handleGetHistory(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const url = new URL(request.url);
    const page = Math.max(1, Math.min(parseInt(url.searchParams.get('page') || '1'), 1000));  // BL-R-M15
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);  // BL-R-M15
    const offset = (page - 1) * limit;
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get total count
    const { rows: totalRows } = await query(`
      SELECT COUNT(*)::int as count
      FROM referrals
      WHERE referrer_user_id = $1
    `, [user.id]);
    const totalCount = totalRows[0];
    
    // Get paginated history
    const { rows: referrals } = await query(`
      SELECT 
        r.id,
        u.email as referred_email,
        r.referral_code,
        r.converted,
        r.conversion_date,
        r.reward_granted,
        r.reward_type,
        r.reward_value,
        r.created_at
      FROM referrals r
      JOIN users u ON r.referred_user_id = u.id
      WHERE r.referrer_user_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [user.id, limit, offset]);
    
    return new Response(JSON.stringify({
      success: true,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / limit)
      },
      referrals: referrals.map(ref => ({
        id: ref.id,
        email: ref.referred_email.replace(/(.{3}).*(@.*)/, '$1***$2'),
        referralCode: ref.referral_code,
        converted: !!ref.converted,
        conversionDate: ref.conversion_date,
        rewardGranted: !!ref.reward_granted,
        rewardType: ref.reward_type,
        rewardValue: ref.reward_value,
        signupDate: ref.created_at
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Get referral history error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get referral history'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ─── Validate Referral Code ──────────────────────────────────

/**
 * POST /api/referrals/validate
 * Validate referral code (public endpoint for signup flow)
 * 
 * Body:
 * {
 *   "code": "PRIME-ABC123"
 * }
 */
export async function handleValidateCode(request, env, ctx) {
  try {
    const body = await request.json();
    const { code } = body;
    
    if (!code) {
      return new Response(JSON.stringify({
        error: 'Missing code',
        message: 'Referral code is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Find user with referral code
    const { rows: referrerRows } = await query(`
      SELECT id, email, referral_code
      FROM users
      WHERE referral_code = $1
    `, [code.toUpperCase()]);
    const referrer = referrerRows[0] || null;
    
    if (!referrer) {
      return new Response(JSON.stringify({
        valid: false,
        error: 'Invalid referral code'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      valid: true,
      code: referrer.referral_code,
      referrerEmail: referrer.email.replace(/(.{3}).*(@.*)/, '$1***$2'),  // Masked
      discount: {
        type: 'first_month_free',
        description: 'First month free on Seeker tier',
        value: 1500  // $15 in cents
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Validate code error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to validate referral code'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ─── Apply Referral Code ─────────────────────────────────────

/**
 * POST /api/referrals/apply
 * Apply referral code to user account (called during signup)
 * 
 * Body:
 * {
 *   "code": "PRIME-ABC123"
 * }
 */
export async function handleApplyCode(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const { code } = body;
    
    if (!code) {
      return new Response(JSON.stringify({
        error: 'Missing code',
        message: 'Referral code is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Find referrer
    const { rows: referrerRows } = await query(`
      SELECT id, email, referral_code
      FROM users
      WHERE referral_code = $1
    `, [code.toUpperCase()]);
    const referrer = referrerRows[0] || null;
    
    if (!referrer) {
      return new Response(JSON.stringify({
        error: 'Invalid referral code'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user already has a referral
    const { rows: existingRows } = await query(`
      SELECT id FROM referrals WHERE referred_user_id = $1
    `, [user.id]);
    
    if (existingRows.length > 0) {
      return new Response(JSON.stringify({
        error: 'Referral already applied',
        message: 'You have already used a referral code'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Cannot refer yourself
    if (referrer.id === user.id) {
      return new Response(JSON.stringify({
        error: 'Invalid referral',
        message: 'You cannot use your own referral code'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create referral record
    await query(`
      INSERT INTO referrals (
        referrer_user_id, referred_user_id, referral_code,
        converted, reward_granted
      ) VALUES ($1, $2, $3, false, false)
    `, [referrer.id, user.id, code.toUpperCase()]);
    
    // Track achievement event for the referrer (they got a new referral)
    await trackEvent(env, referrer.id, 'referral_signup', { referredUserId: user.id }, 'free');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Referral code applied successfully',
      discount: {
        type: 'first_month_free',
        description: 'First month free on Seeker tier',
        value: 1500
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Apply code error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to apply referral code'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ─── Get Unclaimed Rewards ───────────────────────────────────

/**
 * GET /api/referrals/rewards
 * Get unclaimed referral rewards
 */
export async function handleGetRewards(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get pending rewards (converted but not granted)
    const { rows: pendingRewards } = await query(`
      SELECT 
        r.id,
        u.email as referred_email,
        r.conversion_date,
        'free_month' as reward_type,
        1500 as reward_value
      FROM referrals r
      JOIN users u ON r.referred_user_id = u.id
      WHERE r.referrer_user_id = $1 
        AND r.converted = true 
        AND r.reward_granted = false
      ORDER BY r.conversion_date DESC
    `, [user.id]);
    
    const totalPendingValue = pendingRewards.reduce((sum, r) => sum + r.reward_value, 0);
    
    return new Response(JSON.stringify({
      success: true,
      pendingRewards: pendingRewards.map(r => ({
        id: r.id,
        referredEmail: r.referred_email.replace(/(.{3}).*(@.*)/, '$1***$2'),
        conversionDate: r.conversion_date,
        rewardType: r.reward_type,
        rewardValue: r.reward_value,
        rewardDescription: 'One month free Seeker subscription'
      })),
      totalPending: pendingRewards.length,
      totalValue: totalPendingValue
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Get rewards error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get rewards'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ─── Claim Referral Reward ───────────────────────────────────

/**
 * POST /api/referrals/claim
 * Claim a referral reward (applies discount to next billing cycle)
 * 
 * Body:
 * {
 *   "referralId": 123
 * }
 */
export async function handleClaimReward(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const { referralId } = body;
    
    if (!referralId) {
      return new Response(JSON.stringify({
        error: 'Missing referralId'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get referral
    const { rows: refRows } = await query(`
      SELECT * FROM referrals 
      WHERE id = $1 AND referrer_user_id = $2
    `, [referralId, user.id]);
    const referral = refRows[0] || null;
    
    if (!referral) {
      return new Response(JSON.stringify({
        error: 'Referral not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!referral.converted) {
      return new Response(JSON.stringify({
        error: 'Referral not converted',
        message: 'Referred user must upgrade to paid tier first'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (referral.reward_granted) {
      return new Response(JSON.stringify({
        error: 'Reward already claimed'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Mark reward as granted
    await query(`
      UPDATE referrals 
      SET reward_granted = true,
          reward_type = 'free_month',
          reward_value = 1500,
          updated_at = NOW()
      WHERE id = $1
    `, [referralId]);
    
    // Apply $15 credit to referrer's Stripe account (covers one month of Seeker)
    if (env.STRIPE_SECRET_KEY) {
      try {
        const { rows: userRows } = await query(`
          SELECT stripe_customer_id FROM users WHERE id = $1
        `, [user.id]);
        const stripeCustomerId = userRows[0]?.stripe_customer_id;
        
        if (stripeCustomerId) {
          const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
          await stripe.customers.createBalanceTransaction(stripeCustomerId, {
            amount: -1500,  // Negative = credit (in cents)
            currency: 'usd',
            description: 'Referral reward: one month free Seeker subscription'
          });
          console.log(`Applied $15 credit to customer ${stripeCustomerId} for referral ${referralId}`);
        }
      } catch (stripeError) {
        console.error('Stripe credit application error:', stripeError);
        // Don't fail the claim — reward is already marked as granted in DB
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Reward claimed successfully',
      reward: {
        type: 'free_month',
        value: 1500,
        description: 'One month free Seeker subscription applied to your account'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Claim reward error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to claim reward'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ─── Mark Referral as Converted ──────────────────────────────

/**
 * Internal function called from billing webhook when referred user upgrades
 * @param {Object} env - Cloudflare environment
 * @param {string} userId - User who just converted to paid
 */
export async function markReferralAsConverted(env, userId) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Find referral record for this user
    const { rows: refRows } = await query(`
      SELECT id, referrer_user_id
      FROM referrals
      WHERE referred_user_id = $1 AND converted = false
    `, [userId]);
    const referral = refRows[0] || null;
    
    if (!referral) {
      console.log('No referral record found for user:', userId);
      return;
    }
    
    // Mark as converted
    await query(`
      UPDATE referrals
      SET converted = true,
          conversion_date = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [referral.id]);
    
    console.log('Referral marked as converted:', {
      referralId: referral.id,
      referrerId: referral.referrer_user_id,
      referredId: userId
    });
    
    // Notify referrer about the successful conversion
    sendNotificationToUser(env, referral.referrer_user_id, 'achievement', {
      title: 'Referral Converted!',
      body: 'Someone you referred just upgraded to a paid plan! Claim your reward.',
      icon: '🎉',
      data: { type: 'referral_conversion', referralId: referral.id }
    }).catch(err => console.error('Referral conversion notification failed:', err));
    
  } catch (error) {
    console.error('Error marking referral as converted:', error);
  }
}
