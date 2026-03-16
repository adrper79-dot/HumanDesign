/**
 * Daily Check-In & Validation Journal (BL-ENG-005)
 * 
 * Endpoints:
 *   POST /api/checkin                - Create/update today's check-in
 *   GET  /api/checkin                - Get today's check-in status
 *   GET  /api/checkin/history        - Get check-in history (with date range)
 *   GET  /api/checkin/stats          - Get alignment stats, trends, adherence rates
 *   GET  /api/checkin/streak         - Get current streak info
 *   POST /api/checkin/reminder       - Set/update reminder preferences
 *   GET  /api/checkin/reminder       - Get reminder settings
 */

import { trackEvent } from './achievements.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { getUserFromRequest } from '../middleware/auth.js';
import { getCurrentTransits } from '../../../src/engine/transits.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';

/**
 * Compute the current streak from an ordered array of checkin-date rows.
 * Returns an object compatible with the former get_user_streak stored proc result.
 * @param {Array<{checkin_date: string|Date}>} rows - Ascending ordered checkin dates
 * @param {string|null} todayOverride - Optional ISO date string for "today" (used in POST path)
 */
function computeCurrentStreak(rows, todayOverride) {
  if (!rows || rows.length === 0) {
    return { current_streak: 0, last_checkin_date: null, streak_start_date: null };
  }

  // Work backwards from the most-recent checkin
  const today = todayOverride
    ? new Date(todayOverride)
    : new Date(new Date().toISOString().split('T')[0]);

  const lastDate = new Date(rows[rows.length - 1].checkin_date);
  // If last checkin is more than 1 day before today the streak is broken
  const gapFromToday = Math.floor((today - lastDate) / 86400000);
  if (gapFromToday > 1) {
    return { current_streak: 0, last_checkin_date: lastDate, streak_start_date: null };
  }

  let streak = 1;
  let streakStart = lastDate;
  for (let i = rows.length - 2; i >= 0; i--) {
    const cur = new Date(rows[i + 1].checkin_date);
    const prev = new Date(rows[i].checkin_date);
    if (Math.floor((cur - prev) / 86400000) === 1) {
      streak++;
      streakStart = prev;
    } else {
      break;
    }
  }

  return {
    current_streak: streak,
    last_checkin_date: lastDate,
    streak_start_date: streakStart
  };
}

/**
 * Get user's local date (from timezone or default to UTC).
 * Returns YYYY-MM-DD format.
 */
function getUserLocalDate(timezone = 'UTC') {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {  // en-CA gives YYYY-MM-DD format
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now);
}

/**
 * POST /api/checkin
 * Create or update today's daily check-in.
 */
export async function handleCheckinCreate(request, env, ctx) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    alignmentScore,
    followedStrategy,
    followedAuthority,
    notes,
    mood,
    energyLevel,
    timezone = 'UTC'
  } = body;

  // Validation
  if (notes && typeof notes === 'string' && notes.length > 2000) {
    return Response.json({ error: 'notes exceeds maximum length of 2000 characters' }, { status: 400 });
  }

  if (!alignmentScore || alignmentScore < 1 || alignmentScore > 10) {
    return Response.json({ error: 'alignmentScore must be between 1 and 10' }, { status: 400 });
  }

  if (typeof followedStrategy !== 'boolean') {
    return Response.json({ error: 'followedStrategy must be boolean' }, { status: 400 });
  }

  if (typeof followedAuthority !== 'boolean') {
    return Response.json({ error: 'followedAuthority must be boolean' }, { status: 400 });
  }

  const validMoods = ['great', 'good', 'neutral', 'challenging', 'difficult'];
  if (mood && !validMoods.includes(mood)) {
    return Response.json({ error: `mood must be one of: ${validMoods.join(', ')}` }, { status: 400 });
  }

  if (energyLevel != null && (energyLevel < 1 || energyLevel > 10)) {
    return Response.json({ error: 'energyLevel must be between 1 and 10' }, { status: 400 });
  }

  // Get user's local date
  const checkinDate = getUserLocalDate(timezone);

  // Get current transits as snapshot (direct import, avoids self-fetch doubling Worker cost)
  let transitSnapshot = null;
  try {
    const transits = getCurrentTransits(null, null);
    transitSnapshot = {
      transitPositions: transits.transitPositions || {},
      gateActivations: transits.gateActivations || [],
      aspects: transits.transitToNatalAspects || []
    };
  } catch (error) {
    console.warn('Failed to compute transit snapshot:', error);
    // Continue without transit data
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Insert or update today's check-in
    const { rows: results } = await query(QUERIES.upsertCheckin, [
      user.id,
      checkinDate,
      alignmentScore,
      followedStrategy,
      followedAuthority,
      notes || null,
      mood || null,
      energyLevel || null,
      transitSnapshot ? JSON.stringify(transitSnapshot) : null
    ]);

    const checkin = results[0];

    // Track achievement event
    await trackEvent(env, user.id, 'daily_checkin', {
      checkinDate,
      alignmentScore,
      followedStrategy,
      followedAuthority,
      mood
    }, user.tier, request._ctx);

    // Get updated streak info (computed in JS — avoids dependency on get_user_streak stored proc)
    const { rows: allStreakDates } = await query(QUERIES.getCheckinDatesOrdered, [user.id]);
    const streak = computeCurrentStreak(allStreakDates, checkinDate);

    return Response.json({
      ok: true,
      checkin: {
        id: checkin.id,
        checkinDate: checkin.checkin_date,
        alignmentScore: checkin.alignment_score,
        followedStrategy: !!checkin.followed_strategy,
        followedAuthority: !!checkin.followed_authority,
        notes: checkin.notes,
        mood: checkin.mood,
        energyLevel: checkin.energy_level,
        transitSnapshot: checkin.transit_snapshot || null,
        createdAt: checkin.created_at,
        updatedAt: checkin.updated_at
      },
      streak: {
        current: streak.current_streak,
        lastCheckinDate: streak.last_checkin_date,
        streakStartDate: streak.streak_start_date
      }
    });
  } catch (error) {
    return reportHandledRouteError({
      request,
      env,
      error,
      source: 'checkin_create',
      fallbackMessage: 'Failed to save check-in',
      extra: { userId: user.id, checkinDate },
    });
  }
}

/**
 * GET /api/checkin
 * Get today's check-in status (completed or not).
 */
export async function handleCheckinToday(request, env, ctx) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const url = new URL(request.url);
  const timezone = url.searchParams.get('timezone') || 'UTC';
  const today = getUserLocalDate(timezone);

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows: results } = await query(QUERIES.getCheckinByDate, [user.id, today]);

    if (results.length === 0) {
      return Response.json({
        ok: true,
        completed: false,
        checkinDate: today,
        message: 'No check-in for today yet'
      });
    }

    const checkin = results[0];

    return Response.json({
      ok: true,
      completed: true,
      checkin: {
        id: checkin.id,
        checkinDate: checkin.checkin_date,
        alignmentScore: checkin.alignment_score,
        followedStrategy: !!checkin.followed_strategy,
        followedAuthority: !!checkin.followed_authority,
        notes: checkin.notes,
        mood: checkin.mood,
        energyLevel: checkin.energy_level,
        transitSnapshot: checkin.transit_snapshot || null,
        createdAt: checkin.created_at,
        updatedAt: checkin.updated_at
      }
    });
  } catch (error) {
    return reportHandledRouteError({
      request,
      env,
      error,
      source: 'checkin_today',
      fallbackMessage: 'Failed to retrieve today\'s check-in',
      extra: { userId: user.id, date: today },
    });
  }
}

/**
 * GET /api/checkin/history?days=30&offset=0
 * Get check-in history with pagination.
 */
export async function handleCheckinHistory(request, env, ctx) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = Math.min(parseInt(url.searchParams.get('days')) || 30, 365);  // Max 1 year
  const offset = Math.min(parseInt(url.searchParams.get('offset')) || 0, 10000);  // BL-R-M15

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get check-in history
    const { rows: checkins } = await query(QUERIES.getCheckinHistory, [user.id, days, offset]);

    // Get total count
    const { rows: countResults } = await query(QUERIES.countCheckins, [user.id]);

    const total = countResults[0]?.total || 0;

    return Response.json({
      ok: true,
      checkins: checkins.map(c => ({
        id: c.id,
        checkinDate: c.checkin_date,
        alignmentScore: c.alignment_score,
        followedStrategy: !!c.followed_strategy,
        followedAuthority: !!c.followed_authority,
        notes: c.notes,
        mood: c.mood,
        energyLevel: c.energy_level,
        transitSnapshot: c.transit_snapshot || null,
        createdAt: c.created_at
      })),
      pagination: {
        total,
        days,
        offset,
        hasMore: offset + days < total
      }
    });
  } catch (error) {
    return reportHandledRouteError({
      request,
      env,
      error,
      source: 'checkin_history',
      fallbackMessage: 'Failed to retrieve check-in history',
      extra: { userId: user.id, days, offset },
    });
  }
}

/**
 * GET /api/checkin/stats?period=30
 * Get alignment stats, trends, adherence rates.
 */
export async function handleCheckinStats(request, env, ctx) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const url = new URL(request.url);
  const period = Math.min(parseInt(url.searchParams.get('period')) || 30, 365);  // Days

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get period start date (period days ago)
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - period);
    const periodStartStr = periodStart.toISOString().split('T')[0];

    // Get check-ins for period
    const { rows: checkins } = await query(QUERIES.getCheckinStatsForPeriod, [user.id, periodStartStr]);

    if (checkins.length === 0) {
      return Response.json({
        ok: true,
        period: { days: period, startDate: periodStartStr, endDate: new Date().toISOString().split('T')[0] },
        stats: {
          totalCheckins: 0,
          avgAlignmentScore: null,
          avgEnergyLevel: null,
          strategyAdherenceRate: null,
          authorityAdherenceRate: null,
          moodDistribution: {},
          dailyScores: []
        }
      });
    }

    // Calculate stats
    const totalCheckins = checkins.length;
    const avgAlignmentScore = checkins.reduce((sum, c) => sum + c.alignment_score, 0) / totalCheckins;
    
    const energyCheckins = checkins.filter(c => c.energy_level !== null);
    const avgEnergyLevel = energyCheckins.length > 0
      ? energyCheckins.reduce((sum, c) => sum + c.energy_level, 0) / energyCheckins.length
      : null;

    const strategyFollowedCount = checkins.filter(c => c.followed_strategy).length;
    const authorityFollowedCount = checkins.filter(c => c.followed_authority).length;
    const strategyAdherenceRate = (strategyFollowedCount / totalCheckins) * 100;
    const authorityAdherenceRate = (authorityFollowedCount / totalCheckins) * 100;

    // Mood distribution
    const moodDistribution = checkins.reduce((dist, c) => {
      if (c.mood) {
        dist[c.mood] = (dist[c.mood] || 0) + 1;
      }
      return dist;
    }, {});

    // Daily scores for chart (last 30 days or period, whichever is smaller)
    const chartDays = Math.min(period, 30);
    const dailyScores = checkins.slice(-chartDays).map(c => ({
      date: c.checkin_date,
      alignmentScore: c.alignment_score,
      energyLevel: c.energy_level,
      followedStrategy: !!c.followed_strategy,
      followedAuthority: !!c.followed_authority,
      mood: c.mood
    }));

    return Response.json({
      ok: true,
      period: {
        days: period,
        startDate: periodStartStr,
        endDate: new Date().toISOString().split('T')[0]
      },
      stats: {
        totalCheckins,
        avgAlignmentScore: parseFloat(avgAlignmentScore.toFixed(2)),
        avgEnergyLevel: avgEnergyLevel ? parseFloat(avgEnergyLevel.toFixed(2)) : null,
        strategyAdherenceRate: parseFloat(strategyAdherenceRate.toFixed(1)),
        authorityAdherenceRate: parseFloat(authorityAdherenceRate.toFixed(1)),
        moodDistribution,
        dailyScores
      }
    });
  } catch (error) {
    // 42P01 = undefined_table — daily_checkins not yet migrated; return empty stats
    if (error.code === '42P01') {
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - period);
      return Response.json({
        ok: true,
        period: {
          days: period,
          startDate: periodStart.toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        },
        stats: {
          totalCheckins: 0,
          avgAlignmentScore: null,
          avgEnergyLevel: null,
          strategyAdherenceRate: null,
          authorityAdherenceRate: null,
          moodDistribution: {},
          dailyScores: []
        }
      });
    }
    return reportHandledRouteError({
      request,
      env,
      error,
      source: 'checkin_stats',
      fallbackMessage: 'Failed to retrieve check-in stats',
      extra: { userId: user.id, period },
    });
  }
}

/**
 * GET /api/checkin/streak
 * Get current check-in streak info.
 */
export async function handleCheckinStreak(request, env, ctx) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Compute streak directly from checkin dates — avoids get_user_streak stored proc dependency
    const { rows: allCheckins } = await query(QUERIES.getCheckinDatesOrdered, [user.id]);

    if (allCheckins.length === 0) {
      return Response.json({
        ok: true,
        streak: {
          current: 0,
          longest: 0,
          lastCheckinDate: null,
          streakStartDate: null,
          message: 'Start your first check-in today!'
        }
      });
    }

    const streak = computeCurrentStreak(allCheckins, null);
    // allCheckins also used below for longest streak calc

    let longestStreak = 0;
    let currentStreak = 0;
    let prevDate = null;

    allCheckins.forEach(c => {
      const date = new Date(c.checkin_date);
      if (prevDate) {
        const daysDiff = Math.floor((date - prevDate) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) {
          currentStreak++;
        } else {
          longestStreak = Math.max(longestStreak, currentStreak);
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      prevDate = date;
    });
    longestStreak = Math.max(longestStreak, currentStreak);

    return Response.json({
      ok: true,
      streak: {
        current: streak.current_streak,
        longest: longestStreak,
        lastCheckinDate: streak.last_checkin_date,
        streakStartDate: streak.streak_start_date,
        message: streak.current_streak >= 3
          ? `🔥 ${streak.current_streak} days in a row! Keep going!`
          : `You're on a ${streak.current_streak}-day streak!`
      }
    });
  } catch (error) {
    // 42P01 = undefined_table — daily_checkins not yet migrated; return empty streak
    if (error.code === '42P01') {
      return Response.json({
        ok: true,
        streak: {
          current: 0,
          longest: 0,
          lastCheckinDate: null,
          streakStartDate: null,
          message: 'Start your first check-in today!'
        }
      });
    }
    return reportHandledRouteError({
      request,
      env,
      error,
      source: 'checkin_streak',
      fallbackMessage: 'Failed to retrieve streak info',
      extra: { userId: user.id },
    });
  }
}


/**
 * POST /api/checkin/reminder
 * Set or update check-in reminder preferences.
 */
export async function handleSetCheckinReminder(request, env, ctx) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    enabled = true,
    reminderTime = '20:00:00',
    timezone = 'UTC',
    notificationMethod = ['push']
  } = body;

  // Validate time format (HH:MM:SS)
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
  if (!timeRegex.test(reminderTime)) {
    return Response.json({ error: 'reminderTime must be in HH:MM:SS format' }, { status: 400 });
  }

  // Validate notification methods
  const validMethods = ['push', 'email', 'sms'];
  if (!Array.isArray(notificationMethod) || !notificationMethod.every(m => validMethods.includes(m))) {
    return Response.json({ error: `notificationMethod must be array of: ${validMethods.join(', ')}` }, { status: 400 });
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows: results } = await query(QUERIES.upsertCheckinReminder, [
      user.id,
      enabled,
      reminderTime,
      timezone,
      JSON.stringify(notificationMethod)
    ]);

    const reminder = results[0];

    return Response.json({
      ok: true,
      reminder: {
        enabled: !!reminder.enabled,
        reminderTime: reminder.reminder_time,
        timezone: reminder.timezone,
        notificationMethod: reminder.notification_method || [],
        lastSentAt: reminder.last_sent_at,
        updatedAt: reminder.updated_at
      }
    });
  } catch (error) {
    return reportHandledRouteError({
      request,
      env,
      error,
      source: 'checkin_reminder_set',
      fallbackMessage: 'Failed to set reminder',
      extra: { userId: user.id, reminderTime, timezone },
    });
  }
}

/**
 * GET /api/checkin/reminder
 * Get check-in reminder settings.
 */
export async function handleGetCheckinReminder(request, env, ctx) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const { rows: results } = await query(QUERIES.getCheckinReminder, [user.id]);

    if (results.length === 0) {
      return Response.json({
        ok: true,
        reminder: null,
        message: 'No reminder set. Use POST /api/checkin/reminder to create one.'
      });
    }

    const reminder = results[0];

    return Response.json({
      ok: true,
      reminder: {
        enabled: !!reminder.enabled,
        reminderTime: reminder.reminder_time,
        timezone: reminder.timezone,
        notificationMethod: reminder.notification_method || [],
        lastSentAt: reminder.last_sent_at,
        createdAt: reminder.created_at,
        updatedAt: reminder.updated_at
      }
    });
  } catch (error) {
    return reportHandledRouteError({
      request,
      env,
      error,
      source: 'checkin_reminder_get',
      fallbackMessage: 'Failed to retrieve reminder settings',
      extra: { userId: user.id },
    });
  }
}
