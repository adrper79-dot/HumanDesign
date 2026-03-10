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
import { createQueryFn, QUERIES } from '../db/queries.js';
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
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user already has a referral code
    if (user.referral_code) {
      return Response.json({
        ok: true,
        code: user.referral_code,
        url: `${env.FRONTEND_URL}/signup?ref=${user.referral_code}`,
        existing: true
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
        QUERIES.getUserByReferralCode,
        [code]
      );
      
      exists = existingRows.length > 0;
      attempts++;
    }
    
    if (exists) {
      return Response.json({
        error: 'Failed to generate unique code',
        message: 'Please try again'
      }, { status: 500 });
    }
    
    // Update user with referral code
    await query(
      QUERIES.setUserReferralCode,
      [code, user.id]
    );
    
    return Response.json({
      ok: true,
      code: code,
      url: `${env.FRONTEND_URL}/signup?ref=${code}`,
      existing: false
    });
    
  } catch (error) {
    console.error('Generate code error:', error);
    return Response.json({
      error: 'Failed to generate referral code' // BL-R-H2
    }, { status: 500 });
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
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get total referrals
    const { rows: totalRows } = await query(QUERIES.countReferrals, [user.id]);
    const totalReferrals = totalRows[0];
    
    // Get converted referrals (paid subscriptions)
    const { rows: convertedRows } = await query(QUERIES.countConvertedReferrals, [user.id]);
    const convertedReferrals = convertedRows[0];
    
    // Get total rewards earned
    const { rows: rewardsRows } = await query(QUERIES.getReferralRewardStats, [user.id]);
    const rewardsEarned = rewardsRows[0];
    
    // Get pending rewards (converted but not yet granted)
    const { rows: pendingRows } = await query(QUERIES.countPendingReferralRewards, [user.id]);
    const pendingRewards = pendingRows[0];
    
    // Get recent referrals with details
    const { rows: recentReferrals } = await query(QUERIES.getRecentReferrals, [user.id]);
    
    const conversionRate = totalReferrals.count > 0 
      ? (convertedReferrals.count / totalReferrals.count * 100).toFixed(1)
      : 0;
    
    return Response.json({
      ok: true,
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
    });
    
  } catch (error) {
    console.error('Get referral stats error:', error);
    return Response.json({
      error: 'Failed to get referral stats'
    }, { status: 500 });
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
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const page = Math.max(1, Math.min(parseInt(url.searchParams.get('page') || '1'), 1000));  // BL-R-M15
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);  // BL-R-M15
    const offset = (page - 1) * limit;
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get total count
    const { rows: totalRows } = await query(QUERIES.countReferrals, [user.id]);
    const totalCount = totalRows[0];
    
    // Get paginated history
    const { rows: referrals } = await query(QUERIES.getReferralHistory, [user.id, limit, offset]);
    
    return Response.json({
      ok: true,
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
    });
    
  } catch (error) {
    console.error('Get referral history error:', error);
    return Response.json({
      error: 'Failed to get referral history'
    }, { status: 500 });
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
      return Response.json({
        error: 'Missing code',
        message: 'Referral code is required'
      }, { status: 400 });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Find user with referral code
    const { rows: referrerRows } = await query(QUERIES.validateReferralCode, [code.toUpperCase()]);
    const referrer = referrerRows[0] || null;
    
    if (!referrer) {
      return Response.json({
        valid: false,
        error: 'Invalid referral code'
      });
    }
    
    return Response.json({
      valid: true,
      code: referrer.referral_code,
      referrerEmail: referrer.email.replace(/(.{3}).*(@.*)/, '$1***$2'),  // Masked
      discount: {
        type: 'first_month_free',
        description: 'First month free on Seeker tier',
        value: 1500  // $15 in cents
      }
    });
    
  } catch (error) {
    console.error('Validate code error:', error);
    return Response.json({
      error: 'Failed to validate referral code'
    }, { status: 500 });
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
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { code } = body;
    
    if (!code) {
      return Response.json({
        error: 'Missing code',
        message: 'Referral code is required'
      }, { status: 400 });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Find referrer
    const { rows: referrerRows } = await query(QUERIES.validateReferralCode, [code.toUpperCase()]);
    const referrer = referrerRows[0] || null;
    
    if (!referrer) {
      return Response.json({
        error: 'Invalid referral code'
      }, { status: 400 });
    }
    
    // Check if user already has a referral
    const { rows: existingRows } = await query(QUERIES.checkExistingReferral, [user.id]);
    
    if (existingRows.length > 0) {
      return Response.json({
        error: 'Referral already applied',
        message: 'You have already used a referral code'
      }, { status: 400 });
    }
    
    // Cannot refer yourself
    if (referrer.id === user.id) {
      return Response.json({
        error: 'Invalid referral',
        message: 'You cannot use your own referral code'
      }, { status: 400 });
    }
    
    // Create referral record
    await query(QUERIES.insertReferral, [referrer.id, user.id, code.toUpperCase()]);
    
    // Track achievement event for the referrer (they got a new referral)
    await trackEvent(env, referrer.id, 'referral_signup', { referredUserId: user.id }, 'free');
    
    return Response.json({
      ok: true,
      message: 'Referral code applied successfully',
      discount: {
        type: 'first_month_free',
        description: 'First month free on Seeker tier',
        value: 1500
      }
    });
    
  } catch (error) {
    console.error('Apply code error:', error);
    return Response.json({
      error: 'Failed to apply referral code'
    }, { status: 500 });
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
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get pending rewards (converted but not granted)
    const { rows: pendingRewards } = await query(QUERIES.getPendingReferralRewards, [user.id]);
    
    const totalPendingValue = pendingRewards.reduce((sum, r) => sum + r.reward_value, 0);
    
    return Response.json({
      ok: true,
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
    });
    
  } catch (error) {
    console.error('Get rewards error:', error);
    return Response.json({
      error: 'Failed to get rewards'
    }, { status: 500 });
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
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { referralId } = body;
    
    if (!referralId) {
      return Response.json({
        error: 'Missing referralId'
      }, { status: 400 });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get referral
    const { rows: refRows } = await query(QUERIES.getReferralById, [referralId, user.id]);
    const referral = refRows[0] || null;
    
    if (!referral) {
      return Response.json({
        error: 'Referral not found'
      }, { status: 404 });
    }
    
    if (!referral.converted) {
      return Response.json({
        error: 'Referral not converted',
        message: 'Referred user must upgrade to paid tier first'
      }, { status: 400 });
    }
    
    if (referral.reward_granted) {
      return Response.json({
        error: 'Reward already claimed'
      }, { status: 400 });
    }
    
    // Mark reward as granted
    await query(QUERIES.claimReferralReward, [referralId]);
    
    // Apply $15 credit to referrer's Stripe account (covers one month of Seeker)
    if (env.STRIPE_SECRET_KEY) {
      try {
        const { rows: userRows } = await query(QUERIES.getUserStripeCustomerId, [user.id]);
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
    
    return Response.json({
      ok: true,
      message: 'Reward claimed successfully',
      reward: {
        type: 'free_month',
        value: 1500,
        description: 'One month free Seeker subscription applied to your account'
      }
    });
    
  } catch (error) {
    console.error('Claim reward error:', error);
    return Response.json({
      error: 'Failed to claim reward'
    }, { status: 500 });
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
    const { rows: refRows } = await query(QUERIES.getUnconvertedReferral, [userId]);
    const referral = refRows[0] || null;
    
    if (!referral) {
      console.log('No referral record found for user:', userId);
      return;
    }
    
    // Mark as converted
    await query(QUERIES.markReferralConverted, [referral.id]);
    
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
