/**
 * Viral Sharing Handler — Generate shareable content and track viral metrics
 * 
 * Endpoints:
 * - POST /api/share/celebrity - Generate celebrity match share content
 * - POST /api/share/chart - Generate chart share content
 * - POST /api/share/achievement - Generate achievement share content
 * - POST /api/share/referral - Generate referral invite content
 * - GET /api/share/stats - Get user's sharing stats and viral coefficient
 */

import {
  generateCelebrityMatchImage,
  generateChartShareImage,
  generateReferralInviteImage,
  generateAchievementShareImage,
  generateShareMetadata,
  getShareMessages
} from '../lib/shareImage.js';
import { trackEvent } from './achievements.js';
import { ACHIEVEMENTS } from '../lib/achievements.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { getUserFromRequest } from '../middleware/auth.js';
import { getCelebrityMatch } from './famous.js';
import { calculateFullChart } from '../../../src/engine/index.js';
import { parseToUTC } from '../utils/parseToUTC.js';

/**
 * POST /api/share/celebrity
 * Generate shareable content for celebrity match
 */
export async function handleShareCelebrity(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json();
    const { celebrityId, platform } = body;
    
    if (!celebrityId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Celebrity ID required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get user's birth data from users table + latest chart
    if (!user.birth_date || !user.birth_time) {
      return Response.json({ success: false, error: 'No birth data found — calculate your chart first' }, { status: 400 });
    }
    
    // Import celebrity match function
    
    
    
    const utc = parseToUTC(user.birth_date, user.birth_time, user.birth_tz);
    const userChart = calculateFullChart({
      ...utc,
      lat: user.birth_lat,
      lng: user.birth_lng,
      includeTransits: false
    });
    
    const match = await getCelebrityMatch(userChart, celebrityId);
    
    if (!match) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Celebrity not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate share image
    const imageDataUrl = generateCelebrityMatchImage(match, userChart.chart);
    
    // Generate share messages
    const messages = getShareMessages({
      type: 'celebrity',
      celebrityName: match.celebrity.name,
      percentage: match.similarity.percentage
    });
    
    // Generate metadata
    const metadata = generateShareMetadata({
      type: 'article',
      title: `I'm ${match.similarity.percentage}% like ${match.celebrity.name}!`,
      description: `Discover your Human Design celebrity match on Prime Self.`,
      imageUrl: imageDataUrl,
      url: `https://primeself.app/compare/${celebrityId}`
    });
    
    // Track sharing event
    await trackEvent(env, user.id, 'celebrity_shared', {
      celebrityId,
      celebrityName: match.celebrity.name,
      percentage: match.similarity.percentage,
      platform: platform || 'unknown'
    }, user.tier);
    
    // Record share in database
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    await query(
      `INSERT INTO share_events (user_id, share_type, share_data, platform)
       VALUES ($1, 'celebrity_match', $2, $3)`,
      [user.id, JSON.stringify({
        celebrityId,
        celebrityName: match.celebrity.name,
        percentage: match.similarity.percentage
      }), platform || 'unknown']
    );
    
    return new Response(JSON.stringify({
      success: true,
      shareContent: {
        imageUrl: imageDataUrl,
        messages: platform ? { [platform]: messages[platform] } : messages,
        metadata,
        title: `I'm ${match.similarity.percentage}% like ${match.celebrity.name}!`,
        description: `Based on my Human Design chart, I share ${match.similarity.percentage}% similarity with ${match.celebrity.name}.`
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error generating celebrity share:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to generate share content'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/share/chart
 * Generate shareable content for chart summary
 */
export async function handleShareChart(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json();
    const { platform } = body;
    
    // Get user's birth data
    if (!user.birth_date || !user.birth_time) {
      return Response.json({ success: false, error: 'No birth data found — calculate your chart first' }, { status: 400 });
    }
    
    const utc = parseToUTC(user.birth_date, user.birth_time, user.birth_tz);
    const fullChart = calculateFullChart({
      ...utc,
      lat: user.birth_lat,
      lng: user.birth_lng,
      includeTransits: false
    });
    
    // Generate share image
    const imageDataUrl = generateChartShareImage(fullChart.chart);
    
    // Generate share messages
    const messages = getShareMessages({
      type: 'chart',
      chartType: fullChart.chart.type
    });
    
    // Generate metadata
    const metadata = generateShareMetadata({
      type: 'article',
      title: `I'm a ${fullChart.chart.type} in Human Design`,
      description: `Discover your Human Design type on Prime Self.`,
      imageUrl: imageDataUrl,
      url: 'https://primeself.app'
    });
    
    // Track sharing event
    await trackEvent(env, user.id, 'chart_shared', {
      type: fullChart.chart.type,
      profile: fullChart.chart.profile,
      platform: platform || 'unknown'
    }, user.tier);
    
    // Record share
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    await query(
      `INSERT INTO share_events (user_id, share_type, share_data, platform)
       VALUES ($1, 'chart', $2, $3)`,
      [user.id, JSON.stringify({
        type: fullChart.chart.type,
        profile: fullChart.chart.profile
      }), platform || 'unknown']
    );
    
    return new Response(JSON.stringify({
      success: true,
      shareContent: {
        imageUrl: imageDataUrl,
        messages: platform ? { [platform]: messages[platform] } : messages,
        metadata,
        title: `I'm a ${fullChart.chart.type} in Human Design`,
        description: `My Human Design type is ${fullChart.chart.type} with profile ${fullChart.chart.profile}.`
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error generating chart share:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to generate share content'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/share/achievement
 * Generate shareable content for achievement unlock
 */
export async function handleShareAchievement(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json();
    const { achievementId, platform } = body;
    
    if (!achievementId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Achievement ID required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get achievement details
    const achievement = ACHIEVEMENTS[achievementId];
    
    if (!achievement) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Achievement not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify user has unlocked this achievement
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const unlockResult = await query(
      `SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2 LIMIT 1`,
      [user.id, achievementId]
    );
    
    if (!unlockResult.rows || unlockResult.rows.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Achievement not unlocked'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate share image
    const imageDataUrl = generateAchievementShareImage({
      name: achievement.name,
      icon: achievement.icon,
      tier: achievement.tier,
      points: achievement.points
    });
    
    // Generate share messages
    const messages = getShareMessages({
      type: 'achievement',
      achievementName: achievement.name
    });
    
    // Generate metadata
    const metadata = generateShareMetadata({
      type: 'article',
      title: `Achievement Unlocked: ${achievement.name}`,
      description: achievement.description,
      imageUrl: imageDataUrl,
      url: 'https://primeself.app'
    });
    
    // Track sharing event
    await trackEvent(env, user.id, 'achievement_shared', {
      achievementId,
      achievementName: achievement.name,
      platform: platform || 'unknown'
    }, user.tier);
    
    // Record share
    await query(
      `INSERT INTO share_events (user_id, share_type, share_data, platform)
       VALUES ($1, 'achievement', $2, $3)`,
      [user.id, JSON.stringify({
        achievementId,
        achievementName: achievement.name
      }), platform || 'unknown']
    );
    
    return new Response(JSON.stringify({
      success: true,
      shareContent: {
        imageUrl: imageDataUrl,
        messages: platform ? { [platform]: messages[platform] } : messages,
        metadata,
        title: `Achievement Unlocked: ${achievement.name}`,
        description: achievement.description
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error generating achievement share:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to generate share content'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/share/referral
 * Generate shareable content for referral invite
 */
export async function handleShareReferral(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json();
    const { platform } = body;
    
    // Get user's referral code
    const referralCode = user.referral_code;
    
    if (!referralCode) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No referral code found. Generate one first at /api/referrals/code'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate share image
    const imageDataUrl = generateReferralInviteImage({
      email: user.email
    }, referralCode);
    
    // Generate share messages
    const messages = getShareMessages({
      type: 'referral',
      referralCode
    });
    
    // Generate metadata
    const metadata = generateShareMetadata({
      type: 'website',
      title: 'Get Your First Month Free on Prime Self',
      description: 'Discover your Human Design chart and get your first month free.',
      imageUrl: imageDataUrl,
      url: `https://primeself.app/signup?ref=${referralCode}`
    });
    
    // Track sharing event
    await trackEvent(env, user.id, 'referral_shared', {
      referralCode,
      platform: platform || 'unknown'
    }, user.tier);
    
    // Record share
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    await query(
      `INSERT INTO share_events (user_id, share_type, share_data, platform)
       VALUES ($1, 'referral', $2, $3)`,
      [user.id, JSON.stringify({
        referralCode
      }), platform || 'unknown']
    );
    
    return new Response(JSON.stringify({
      success: true,
      shareContent: {
        imageUrl: imageDataUrl,
        messages: platform ? { [platform]: messages[platform] } : messages,
        metadata,
        referralUrl: `https://primeself.app/signup?ref=${referralCode}`,
        title: 'Join me on Prime Self — First Month Free',
        description: 'Discover your Human Design chart and get your first month free.'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error generating referral share:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to generate share content'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/share/stats
 * Get user's sharing stats and viral coefficient
 */
export async function handleGetShareStats(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get total shares by type
    const sharesByTypeResult = await query(
      `SELECT share_type, COUNT(*)::int as count
       FROM share_events
       WHERE user_id = $1
       GROUP BY share_type`,
      [user.id]
    );
    const sharesByType = sharesByTypeResult.rows || [];
    
    // Get recent shares
    const recentResult = await query(
      `SELECT share_type, platform, created_at
       FROM share_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [user.id]
    );
    const recentShares = recentResult.rows || [];
    
    // Get referral conversion rate (shares → signups)
    const referralResult = await query(
      `SELECT COUNT(*)::int as referred_count
       FROM referrals
       WHERE referrer_user_id = $1`,
      [user.id]
    );
    const referredUsers = referralResult.rows?.[0]?.referred_count || 0;
    
    const totalShares = sharesByType.reduce((sum, row) => sum + row.count, 0);

    // Calculate viral coefficient (k = shares × conversion rate)
    // Assume 5% of shares lead to signups (industry average)
    const estimatedConversionRate = 0.05;
    const viralCoefficient = totalShares * estimatedConversionRate;
    
    return new Response(JSON.stringify({
      success: true,
      stats: {
        totalShares,
        sharesByType: Object.fromEntries(sharesByType.map(r => [r.share_type, r.count])),
        referredUsers,
        viralCoefficient: viralCoefficient.toFixed(2),
        estimatedReach: totalShares * 100, // Assume 100 people see each share
        recentShares: recentShares.map(s => ({
          type: s.share_type,
          platform: s.platform,
          date: s.created_at
        }))
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error getting share stats:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get share stats'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
