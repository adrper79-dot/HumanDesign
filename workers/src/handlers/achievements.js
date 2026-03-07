/**
 * Achievements Handler — Gamification & Milestones API
 * 
 * Endpoints:
 * - GET /api/achievements — Get all achievements with unlock status
 * - GET /api/achievements/progress — Get user progress & stats
 * - GET /api/achievements/leaderboard — Get top achievers
 * - POST /api/achievements/track — Track event (internal use)
 * 
 * Helper: trackEvent() — Updates progress, checks achievements, awards badges
 */

import {
  ACHIEVEMENTS,
  CATEGORIES,
  TIERS,
  getNewlyUnlockedAchievements,
  calculateTotalPoints,
  getAchievementProgress,
  calculateIndividualProgress
} from '../lib/achievements.js';
import { createQueryFn } from '../db/queries.js';
import { getUserFromRequest } from '../middleware/auth.js';
import { sendNotificationToUser } from './push.js';

// ─── GET /api/achievements ───────────────────────────────────────────────
// Returns all achievements with user's unlock status

export async function handleGetAchievements(request, env, ctx) {
  const user = await getUserFromRequest(request, env);
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get user's unlocked achievements
    const { rows: unlockedRows } = await query(`
      SELECT achievement_id, unlocked_at, points_awarded
      FROM user_achievements
      WHERE user_id = $1
      ORDER BY unlocked_at DESC
    `, [user.id]);
    
    const unlockedSet = new Set(unlockedRows.map(r => r.achievement_id));
    const unlockedMap = new Map(unlockedRows.map(r => [r.achievement_id, r]));
    
    // Get user's event counts for progress calculation
    const { rows: eventRows } = await query(`
      SELECT event_type, COUNT(*)::int as count
      FROM achievement_events
      WHERE user_id = $1
      GROUP BY event_type
    `, [user.id]);
    const events = {};
    for (const row of eventRows) events[row.event_type] = row.count;

    // Get user's streaks
    const { rows: streakRows } = await query(`
      SELECT streak_type, current_streak
      FROM user_streaks
      WHERE user_id = $1
    `, [user.id]);
    const streaks = {};
    for (const row of streakRows) streaks[row.streak_type] = row.current_streak;

    // Get total points
    const { rows: statsRows } = await query(`
      SELECT total_points FROM user_achievement_stats WHERE user_id = $1
    `, [user.id]);
    
    const userProgress = {
      events,
      streaks,
      tier: user.tier || 'free',
      totalPoints: statsRows[0]?.total_points || 0
    };
    
    // Build response with all achievements and individual progress
    const achievementsList = Object.entries(ACHIEVEMENTS).map(([id, achievement]) => {
      const unlocked = unlockedMap.get(id);
      const isUnlocked = unlockedSet.has(id);
      
      return {
        id,
        name: achievement.name,
        description: achievement.description,
        category: achievement.category,
        icon: achievement.icon,
        tier: achievement.tier,
        points: achievement.points,
        unlocked: isUnlocked,
        unlockedAt: unlocked?.unlocked_at || null,
        progress: calculateIndividualProgress(achievement, userProgress, isUnlocked)
      };
    });
    
    // Group by category
    const byCategory = {};
    for (const [categoryId, categoryInfo] of Object.entries(CATEGORIES)) {
      byCategory[categoryId] = {
        ...categoryInfo,
        achievements: achievementsList.filter(a => a.category === categoryId)
      };
    }
    
    return Response.json({
      success: true,
      achievements: achievementsList,
      byCategory,
      categories: CATEGORIES,
      tiers: TIERS
    });
    
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return Response.json({
      error: 'Failed to fetch achievements' // BL-R-H2
    }, { status: 500 });
  }
}

// ─── GET /api/achievements/progress ──────────────────────────────────────
// Returns user's achievement progress and stats

export async function handleGetProgress(request, env, ctx) {
  const user = await getUserFromRequest(request, env);
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get unlocked achievements
    const { rows: unlockedRows } = await query(`
      SELECT achievement_id, unlocked_at, points_awarded
      FROM user_achievements
      WHERE user_id = $1
      ORDER BY unlocked_at DESC
    `, [user.id]);
    
    const unlockedSet = new Set(unlockedRows.map(r => r.achievement_id));
    
    // Get stats
    const { rows: statsRows } = await query(`
      SELECT * FROM user_achievement_stats WHERE user_id = $1
    `, [user.id]);
    const stats = statsRows[0] || null;
    
    // Get streaks
    const { rows: streaks } = await query(`
      SELECT streak_type, current_streak, longest_streak, last_activity_date
      FROM user_streaks
      WHERE user_id = $1
    `, [user.id]);
    
    const streaksMap = {};
    for (const streak of streaks) {
      streaksMap[streak.streak_type] = {
        current: streak.current_streak,
        longest: streak.longest_streak,
        lastActivity: streak.last_activity_date
      };
    }
    
    // Calculate progress
    const progress = getAchievementProgress(unlockedSet);
    
    // Get recent unlocks
    const recentUnlocks = unlockedRows.slice(0, 5).map(row => ({
      id: row.achievement_id,
      name: ACHIEVEMENTS[row.achievement_id]?.name,
      icon: ACHIEVEMENTS[row.achievement_id]?.icon,
      points: row.points_awarded,
      unlockedAt: row.unlocked_at
    }));
    
    return Response.json({
      success: true,
      progress: {
        totalAchievements: progress.totalAchievements,
        unlockedCount: progress.unlockedCount,
        percentage: progress.percentage,
        totalPoints: stats?.total_points || 0,
        lastAchievement: stats?.last_achievement_date || null,
        categoryProgress: progress.categoryProgress
      },
      streaks: streaksMap,
      recentUnlocks
    });
    
  } catch (error) {
    console.error('Error fetching achievement progress:', error);
    return Response.json({
      error: 'Failed to fetch progress'
    }, { status: 500 });
  }
}

// ─── GET /api/achievements/leaderboard ───────────────────────────────────
// Returns top achievers

export async function handleGetLeaderboard(request, env, ctx) {
  const user = await getUserFromRequest(request, env);
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100);  // BL-R-M15
    const offset = Math.min(parseInt(url.searchParams.get('offset')) || 0, 10000);  // BL-R-M15
    
    // Get leaderboard (top users by points)
    const { rows: leaderboard } = await query(`
      SELECT 
        u.id as user_id,
        u.email,
        u.tier,
        uas.total_points,
        uas.total_achievements,
        uas.achievement_percentage,
        uas.last_achievement_date,
        ROW_NUMBER() OVER (ORDER BY uas.total_points DESC, uas.total_achievements DESC) as rank
      FROM users u
      JOIN user_achievement_stats uas ON u.id = uas.user_id
      WHERE uas.total_points > 0
      ORDER BY uas.total_points DESC, uas.total_achievements DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    // Get user's own rank
    const { rows: userRankRows } = await query(`
      SELECT 
        user_id,
        total_points,
        total_achievements,
        achievement_percentage,
        (
          SELECT COUNT(*)::int + 1
          FROM user_achievement_stats
          WHERE total_points > (SELECT total_points FROM user_achievement_stats WHERE user_id = $1)
        ) as rank
      FROM user_achievement_stats
      WHERE user_id = $1
    `, [user.id]);
    const userRank = userRankRows[0] || null;
    
    // Mask emails for privacy (show first 3 chars + domain)
    const maskedLeaderboard = leaderboard.map((entry, index) => ({
      rank: offset + index + 1,
      email: entry.user_id === user.id 
        ? entry.email  // Show full email for current user
        : entry.email.replace(/(.{3}).*(@.*)/, '$1***$2'),
      tier: entry.tier,
      totalPoints: entry.total_points,
      totalAchievements: entry.total_achievements,
      percentage: entry.achievement_percentage,
      lastAchievement: entry.last_achievement_date,
      isCurrentUser: entry.user_id === user.id
    }));
    
    return Response.json({
      success: true,
      leaderboard: maskedLeaderboard,
      userRank: userRank ? {
        rank: userRank.rank,
        totalPoints: userRank.total_points,
        totalAchievements: userRank.total_achievements,
        percentage: userRank.achievement_percentage
      } : null,
      pagination: {
        limit,
        offset,
        total: maskedLeaderboard.length
      }
    });
    
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return Response.json({
      error: 'Failed to fetch leaderboard'
    }, { status: 500 });
  }
}

// ─── POST /api/achievements/track ────────────────────────────────────────
// Track an event and check for newly unlocked achievements
// This is called by other handlers (calculate, billing, etc.)

export async function handleTrackEvent(request, env, ctx) {
  const user = await getUserFromRequest(request, env);
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const { eventType, eventData } = await request.json();
  
  if (!eventType) {
    return Response.json({ error: 'eventType is required' }, { status: 400 });
  }
  
  try {
    const newlyUnlocked = await trackEvent(env, user.id, eventType, eventData, user.tier);
    
    return Response.json({
      success: true,
      eventType,
      newlyUnlocked: newlyUnlocked.map(a => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        points: a.points,
        message: a.unlockMessage
      }))
    });
    
  } catch (error) {
    console.error('Error tracking achievement event:', error);
    return Response.json({
      error: 'Failed to track event'
    }, { status: 500 });
  }
}

// ─── Helper: Track Event & Check Achievements ────────────────────────────
// This is the core function called by other handlers

/**
 * Track an event and check for newly unlocked achievements
 * @param {Object} env - Cloudflare env with DB
 * @param {string} userId - User ID
 * @param {string} eventType - Event type (chart_calculated, profile_generated, etc.)
 * @param {Object} eventData - Optional event data (JSON)
 * @param {string} userTier - User's current tier (free, seeker, guide, practitioner)
 * @returns {Array} Newly unlocked achievements
 */
export async function trackEvent(env, userId, eventType, eventData = null, userTier = 'free') {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // 1. Insert event
    await query(`
      INSERT INTO achievement_events (user_id, event_type, event_data)
      VALUES ($1, $2, $3)
    `, [userId, eventType, JSON.stringify(eventData)]);
    
    // 2. Update streaks if applicable
    if (eventType === 'daily_login' || eventType === 'transit_checked') {
      await updateStreak(env, userId, eventType);
    }
    
    // 3. Get user's current progress
    const userProgress = await getUserProgress(env, userId, userTier);
    
    // 4. Get already unlocked achievements
    const { rows: unlockedRows } = await query(`
      SELECT achievement_id FROM user_achievements WHERE user_id = $1
    `, [userId]);
    const unlockedSet = new Set(unlockedRows.map(r => r.achievement_id));
    
    // 5. Check for newly unlocked achievements
    const newlyUnlocked = getNewlyUnlockedAchievements(unlockedSet, userProgress);
    
    // 6. Award newly unlocked achievements
    for (const achievement of newlyUnlocked) {
      await query(`
        INSERT INTO user_achievements (user_id, achievement_id, points_awarded)
        VALUES ($1, $2, $3)
      `, [userId, achievement.id, achievement.points]);
      
      console.log(`Achievement unlocked:`, {
        userId,
        achievementId: achievement.id,
        points: achievement.points
      });
      
      // Send push notification (fire-and-forget to avoid blocking)
      sendNotificationToUser(env, userId, 'achievement', {
        title: 'Achievement Unlocked!',
        body: achievement.unlockMessage,
        icon: achievement.icon,
        data: { type: 'achievement', achievementId: achievement.id }
      }).catch(err => console.error('Achievement push notification failed:', err));
    }
    
    // 7. Check for point milestone achievements
    if (newlyUnlocked.length > 0) {
      await checkPointMilestones(env, userId, userProgress);
    }
    
    return newlyUnlocked;
    
  } catch (error) {
    console.error('Error in trackEvent:', error);
    // Don't throw - achievement tracking should never break core functionality
    return [];
  }
}

/**
 * Update user's streak for daily activities
 */
async function updateStreak(env, userId, streakType) {
  const today = new Date().toISOString().split('T')[0];  // YYYY-MM-DD
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  
  // Get existing streak
  const { rows: streakRows } = await query(`
    SELECT * FROM user_streaks WHERE user_id = $1 AND streak_type = $2
  `, [userId, streakType]);
  const streak = streakRows[0] || null;
  
  if (!streak) {
    // Create new streak
    await query(`
      INSERT INTO user_streaks (user_id, streak_type, current_streak, longest_streak, last_activity_date)
      VALUES ($1, $2, 1, 1, $3)
    `, [userId, streakType, today]);
    return;
  }
  
  const lastActivity = streak.last_activity_date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  // If already logged today, do nothing
  if (lastActivity === today) {
    return;
  }
  
  // If logged yesterday, increment streak
  if (lastActivity === yesterdayStr) {
    const newStreak = streak.current_streak + 1;
    const newLongest = Math.max(newStreak, streak.longest_streak);
    
    await query(`
      UPDATE user_streaks
      SET current_streak = $1, longest_streak = $2, last_activity_date = $3
      WHERE id = $4
    `, [newStreak, newLongest, today, streak.id]);
    
  } else {
    // Streak broken, reset to 1
    await query(`
      UPDATE user_streaks
      SET current_streak = 1, last_activity_date = $1
      WHERE id = $2
    `, [today, streak.id]);
  }
}

/**
 * Get user's current progress for achievement checking
 */
async function getUserProgress(env, userId, userTier) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Get event counts
  const { rows: eventRows } = await query(`
    SELECT event_type, COUNT(*)::int as count
    FROM achievement_events
    WHERE user_id = $1
    GROUP BY event_type
  `, [userId]);
  
  const events = {};
  for (const row of eventRows) {
    events[row.event_type] = row.count;
  }
  
  // Get streaks
  const { rows: streakRows } = await query(`
    SELECT streak_type, current_streak
    FROM user_streaks
    WHERE user_id = $1
  `, [userId]);
  
  const streaks = {};
  for (const row of streakRows) {
    streaks[row.streak_type] = row.current_streak;
  }
  
  // Get total points
  const { rows: statsRows } = await query(`
    SELECT total_points FROM user_achievement_stats WHERE user_id = $1
  `, [userId]);
  const stats = statsRows[0] || null;
  
  return {
    events,
    streaks,
    tier: userTier,
    totalPoints: stats?.total_points || 0
  };
}

/**
 * Check for point milestone achievements (100, 500, 1000, 2500)
 */
async function checkPointMilestones(env, userId, userProgress) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const { rows: statsRows } = await query(`
    SELECT total_points FROM user_achievement_stats WHERE user_id = $1
  `, [userId]);
  
  const totalPoints = statsRows[0]?.total_points || 0;
  
  // Check each milestone
  const milestones = [
    { id: 'points_100', threshold: 100 },
    { id: 'points_500', threshold: 500 },
    { id: 'points_1000', threshold: 1000 },
    { id: 'points_2500', threshold: 2500 }
  ];
  
  for (const milestone of milestones) {
    if (totalPoints >= milestone.threshold) {
      // Check if already unlocked
      const { rows: existingRows } = await query(`
        SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2
      `, [userId, milestone.id]);
      
      if (!existingRows[0]) {
        // Unlock milestone
        const achievement = ACHIEVEMENTS[milestone.id];
        await query(`
          INSERT INTO user_achievements (user_id, achievement_id, points_awarded)
          VALUES ($1, $2, $3)
        `, [userId, milestone.id, achievement.points]);
        
        console.log(`Milestone unlocked:`, {
          userId,
          milestoneId: milestone.id,
          totalPoints
        });
        
        // Send milestone notification (fire-and-forget)
        sendNotificationToUser(env, userId, 'achievement', {
          title: 'Milestone Reached!',
          body: achievement.unlockMessage,
          icon: achievement.icon,
          data: { type: 'milestone', milestoneId: milestone.id, totalPoints }
        }).catch(err => console.error('Milestone push notification failed:', err));
      }
    }
  }
}

// ─── Export for use in other handlers ────────────────────────────────────

// Other handlers can import and call this directly:
//   import { trackEvent } from './handlers/achievements.js';
//   await trackEvent(env, user.id, 'chart_calculated', { chartId: chart.id }, user.tier);
