/**
 * Social Proof & Activity Stats (BL-ENG-008)
 * 
 * Endpoints:
 *   GET /api/stats/activity - Public activity statistics for social proof
 */

import { createQueryFn, QUERIES } from '../db/queries.js';

/**
 * GET /api/stats/activity - Get public activity statistics
 * 
 * Returns aggregated stats for social proof display:
 * - Weekly active users (users who calculated charts in last 7 days)
 * - Total profiles generated (all-time AI synthesis count)
 * - Total charts calculated (all-time)
 * 
 * This is a PUBLIC endpoint (no auth required) for homepage social proof
 */
export async function handleGetActivityStats(request, env, ctx) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    // Get weekly active users (users with charts calculated in last 7 days)
    const weeklyUsersResult = await query(
      QUERIES.getWeeklyActiveUsers,
      []
    );
    const weeklyUsers = parseInt(weeklyUsersResult.rows[0]?.count || 0);

    // Get total profiles generated (all-time synthesis count)
    const totalProfilesResult = await query(
      QUERIES.getTotalProfiles,
      []
    );
    const totalProfiles = parseInt(totalProfilesResult.rows[0]?.count || 0);

    // Get total charts calculated (all-time)
    const totalChartsResult = await query(
      QUERIES.getTotalCharts,
      []
    );
    const totalCharts = parseInt(totalChartsResult.rows[0]?.count || 0);

    // BL-R-C2: Return real data only. Never fabricate metrics (FTC compliance).
    // If no data exists yet, return zeros — the frontend should handle the empty state.

    return Response.json({
      success: true,
      stats: {
        weeklyUsers,
        totalProfiles,
        totalCharts
      }
    });

  } catch (error) {
    console.error('Get activity stats error:', error);
    
    // BL-FIX: Return success: false so monitoring can detect DB outages
    return Response.json({
      success: false,
      stats: {
        weeklyUsers: 0,
        totalProfiles: 0,
        totalCharts: 0
      },
      note: 'Stats temporarily unavailable'
    }, { status: 503 });
  }
}

/**
 * GET /api/stats/leaderboard - Get top users by achievements (future)
 * 
 * Optional endpoint for future gamification feature
 */
export async function handleGetLeaderboard(request, env, ctx) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const result = await query(
      QUERIES.getStatsLeaderboard,
      []
    );

    return Response.json({
      success: true,
      leaderboard: result.rows.map(row => ({
        email: row.email.split('@')[0] + '@***', // Anonymize
        points: row.total_points,
        achievements: row.total_achievements
      }))
    });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    return Response.json({
      success: false,
      error: 'Failed to retrieve leaderboard'
    }, { status: 500 });
  }
}
