/**
 * Analytics Dashboard Handler (BL-ANA-002)
 *
 * Admin endpoints for viewing analytics data:
 *   GET /api/analytics/overview    – DAU/WAU/MAU + key metrics
 *   GET /api/analytics/events      – Event trends over time
 *   GET /api/analytics/funnel/:name – Conversion funnel analysis
 *   GET /api/analytics/retention   – Cohort retention curves (BL-ANA-003)
 *   GET /api/analytics/errors      – Error rate + top errors
 *   GET /api/analytics/revenue     – Revenue metrics (MRR, churn)
 *
 * Access: Requires authentication + practitioner/admin tier.
 * All queries read from analytics_daily when possible to minimize DB load.
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { FUNNELS } from '../lib/analytics.js';
import { getTier, normalizeTierName } from '../lib/stripe.js';
import { getUserTier } from '../middleware/tierEnforcement.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';

/**
 * Main analytics router.
 */
export async function handleAnalytics(request, env, subpath) {
  const method = request.method;
  const url = new URL(request.url);

  // Audit token auth — allows GH Actions audit runner to pull metrics without a user JWT.
  // /api/analytics/audit is in PUBLIC_ROUTES so this fires before auth middleware blocks it.
  const auditToken = request.headers.get('X-Audit-Token');
  if (auditToken && env.AUDIT_SECRET && auditToken === env.AUDIT_SECRET) {
    return handleAuditMetrics(env);
  }

  // CIO-006: JWT payload only contains sub/email/type — tier is in DB.
  // Resolve the user's effective tier from the subscriptions table.
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const userTier = await getUserTier(env, userId);
  if (!['practitioner', 'agency', 'admin'].includes(userTier)) {
    return Response.json(
      { error: 'Analytics access requires Practitioner tier or above', upgrade_required: true },
      { status: 403 }
    );
  }

  try {
    if (subpath === '/overview' && method === 'GET') {
      return getOverview(env, url);
    }
    if (subpath === '/events' && method === 'GET') {
      return getEventTrends(env, url);
    }
    if (subpath.startsWith('/funnel/') && method === 'GET') {
      const funnelName = subpath.replace('/funnel/', '');
      return getFunnelAnalysis(env, funnelName);
    }
    if (subpath === '/retention' && method === 'GET') {
      return getRetention(env, url);
    }
    if (subpath === '/errors' && method === 'GET') {
      return getErrorAnalytics(env, url);
    }
    if (subpath === '/revenue' && method === 'GET') {
      return getRevenueMetrics(env);
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    return reportHandledRouteError({ request, env, error: err, source: 'analytics' });
  }
}

// ─── Overview ────────────────────────────────────────────────────────

async function getOverview(env, url) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Parallel queries for dashboard panels
  const [activeUsers, todayEvents, signups, topEvents] = await Promise.all([
    // DAU / WAU / MAU
    query(QUERIES.getAnalyticsActiveUsers),

    // Events today
    query(QUERIES.getAnalyticsEventsToday),

    // Signups this week vs last week
    query(QUERIES.getAnalyticsSignupComparison),

    // Top events (last 7 days)
    query(QUERIES.getAnalyticsTopEvents),
  ]);

  const au = activeUsers.rows[0] || { dau: 0, wau: 0, mau: 0 };
  const signupData = signups.rows[0] || { this_week: 0, last_week: 0 };
  const signupGrowth = signupData.last_week > 0
    ? ((signupData.this_week - signupData.last_week) / signupData.last_week * 100).toFixed(1)
    : null;

  return Response.json({
    ok: true,
    data: {
      activeUsers: {
        daily: Number(au.dau),
        weekly: Number(au.wau),
        monthly: Number(au.mau),
        stickinessRatio: au.mau > 0 ? (au.dau / au.mau * 100).toFixed(1) + '%' : 'N/A',
      },
      eventsToday: Number(todayEvents.rows[0]?.count || 0),
      signups: {
        thisWeek: Number(signupData.this_week),
        lastWeek: Number(signupData.last_week),
        growthPct: signupGrowth ? `${signupGrowth}%` : 'N/A',
      },
      topEvents: topEvents.rows.map(r => ({
        event: r.event_name,
        count: Number(r.count),
        uniqueUsers: Number(r.unique_users),
      })),
    },
  });
}

// ─── Event Trends ────────────────────────────────────────────────────

async function getEventTrends(env, url) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const days = Math.min(Number(url.searchParams.get('days') || 30), 90);
  const eventFilter = url.searchParams.get('event');

  // DYNAMIC: builds WHERE clause at runtime (optional event filter) — cannot centralise into QUERIES
  // BL-R-C3: Use parameterized queries only — never interpolate into SQL
  const validDays = Number.isFinite(days) ? days : 30;
  let sql = `
    SELECT
      DATE(created_at) AS date,
      event_name,
      COUNT(*) AS count,
      COUNT(DISTINCT user_id) AS unique_users
    FROM analytics_events
    WHERE created_at >= CURRENT_DATE - ($1 * INTERVAL '1 day')
  `;
  const params = [validDays];

  if (eventFilter) {
    sql += ` AND event_name = $2`;
    params.push(eventFilter);
  }

  sql += ` GROUP BY DATE(created_at), event_name ORDER BY date DESC, count DESC`;

  const result = await query(sql, params);

  // Group by date for time-series chart
  const byDate = {};
  for (const row of result.rows) {
    const d = row.date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push({
      event: row.event_name,
      count: Number(row.count),
      uniqueUsers: Number(row.unique_users),
    });
  }

  return Response.json({
    ok: true,
    data: {
      period: `${days} days`,
      trends: byDate,
    },
  });
}

// ─── Funnel Analysis ─────────────────────────────────────────────────

async function getFunnelAnalysis(env, funnelName) {
  const funnelDef = Object.values(FUNNELS).find(f => f.name === funnelName);
  if (!funnelDef) {
    return Response.json(
      { error: `Unknown funnel: ${funnelName}. Available: ${Object.values(FUNNELS).map(f => f.name).join(', ')}` },
      { status: 400 }
    );
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const result = await query(QUERIES.getAnalyticsFunnelSteps, [funnelName]);

  const steps = funnelDef.steps.map(s => {
    const match = result.rows.find(r => r.step_name === s.name);
    return {
      step: s.name,
      order: s.order,
      users: Number(match?.users || 0),
    };
  });

  // Calculate conversion rates between steps
  const stepsWithConversion = steps.map((step, i) => ({
    ...step,
    conversionFromPrevious: i === 0
      ? '100%'
      : steps[i - 1].users > 0
        ? ((step.users / steps[i - 1].users) * 100).toFixed(1) + '%'
        : '0%',
    conversionFromFirst: steps[0].users > 0
      ? ((step.users / steps[0].users) * 100).toFixed(1) + '%'
      : '0%',
  }));

  return Response.json({
    ok: true,
    data: {
      funnel: funnelName,
      steps: stepsWithConversion,
      overallConversion: steps.length > 1 && steps[0].users > 0
        ? ((steps[steps.length - 1].users / steps[0].users) * 100).toFixed(1) + '%'
        : 'N/A',
    },
  });
}

// ─── Cohort Retention (BL-ANA-003) ───────────────────────────────────

async function getRetention(env, url) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const weeks = Math.min(Number(url.searchParams.get('weeks') || 12), 24);
  // BL-R-C3: Use parameterized queries only
  const validWeeks = Number.isFinite(weeks) ? weeks : 12;

  // Signup cohorts and their return activity
  const result = await query(QUERIES.getAnalyticsRetention, [validWeeks]);

  // Build cohort matrix
  const cohorts = {};
  for (const row of result.rows) {
    const key = row.cohort_week;
    if (!cohorts[key]) cohorts[key] = {};
    cohorts[key][row.week_offset] = Number(row.active_users);
  }

  // Calculate retention percentages
  const retentionMatrix = Object.entries(cohorts).map(([week, offsets]) => {
    const week0 = offsets[0] || 1;
    const retention = {};
    for (const [offset, users] of Object.entries(offsets)) {
      retention[`week_${offset}`] = {
        users,
        pct: ((users / week0) * 100).toFixed(1) + '%',
      };
    }
    return { cohortWeek: week, ...retention };
  });

  return Response.json({
    ok: true,
    data: {
      periodWeeks: weeks,
      cohorts: retentionMatrix,
    },
  });
}

// ─── Error Analytics ─────────────────────────────────────────────────

async function getErrorAnalytics(env, url) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const days = Math.min(Number(url.searchParams.get('days') || 7), 30);
  // BL-R-C3: Use parameterized queries only — never interpolate into SQL
  const validDays = Number.isFinite(days) ? days : 7;

  const [errorRate, topErrors, errorTrend] = await Promise.all([
    // Error rate (errors / total events)
    query(QUERIES.getAnalyticsErrorRate, [validDays]),

    // Top errors by message
    query(QUERIES.getAnalyticsTopErrors, [validDays]),

    // Error count per day
    query(QUERIES.getAnalyticsErrorTrend, [validDays]),
  ]);

  const rate = errorRate.rows[0] || { errors: 0, total: 0, error_rate_pct: 0 };

  return Response.json({
    ok: true,
    data: {
      period: `${days} days`,
      errorRate: `${rate.error_rate_pct}%`,
      totalErrors: Number(rate.errors),
      totalEvents: Number(rate.total),
      topErrors: topErrors.rows.map(r => ({
        message: r.error_message,
        endpoint: r.endpoint,
        severity: r.severity,
        count: Number(r.count),
      })),
      dailyTrend: errorTrend.rows.map(r => ({
        date: r.date,
        count: Number(r.count),
      })),
    },
  });
}

// ─── Audit Metrics (X-Audit-Token auth) ──────────────────────────────

/**
 * Combined metrics endpoint for the GH Actions audit runner.
 * Called with X-Audit-Token header — no user JWT required.
 * Returns overview + error analytics + revenue in one response.
 */
async function handleAuditMetrics(env) {
  const fakeUrl = new URL('https://x/api/analytics/overview?days=7');
  try {
    const [overviewRes, errorsRes, revenueRes] = await Promise.all([
      getOverview(env, fakeUrl),
      getErrorAnalytics(env, fakeUrl),
      getRevenueMetrics(env),
    ]);

    const [overview, errors, revenue] = await Promise.all([
      overviewRes.json(),
      errorsRes.json(),
      revenueRes.json(),
    ]);

    return Response.json({
      ok: true,
      activeUsers:      overview.data?.activeUsers    || {},
      topErrors:        errors.data?.topErrors        || [],
      errorRate:        errors.data?.errorRate        || '0%',
      mrr:              revenue.data?.mrr             || null,
      tierDistribution: revenue.data?.tierDistribution || [],
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ─── Revenue Metrics ─────────────────────────────────────────────────

async function getRevenueMetrics(env) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const [mrr, tierBreakdown, churn] = await Promise.all([
    // Current MRR from active subscriptions
    query(QUERIES.getAnalyticsMrr).catch(() => ({ rows: [{}] })),

    // Tier distribution
    query(QUERIES.getAnalyticsTierDistribution).catch(() => ({ rows: [] })),

    // Monthly churned revenue
    query(QUERIES.getAnalyticsMonthlyChurn).catch(() => ({ rows: [] })),
  ]);

  const m = mrr.rows[0] || {};
  const individualPrice = getTier('individual', env).price;
  const practitionerPrice = getTier('practitioner', env).price;
  const agencyPrice = getTier('agency', env).price;
  const individualRevenue = Number(m.individual_count || 0) * individualPrice;
  const practitionerRevenue = Number(m.practitioner_count || 0) * practitionerPrice;
  const agencyRevenue = Number(m.agency_count || 0) * agencyPrice;
  const totalMrrCents = individualRevenue + practitionerRevenue + agencyRevenue;

  return Response.json({
    ok: true,
    data: {
      mrr: {
        totalCents: totalMrrCents,
        totalUsd: `$${(totalMrrCents / 100).toFixed(2)}`,
        breakdown: {
          individual: { count: Number(m.individual_count || 0), revenueCents: individualRevenue },
          practitioner: { count: Number(m.practitioner_count || 0), revenueCents: practitionerRevenue },
          agency: { count: Number(m.agency_count || 0), revenueCents: agencyRevenue },
        },
      },
      totalActiveSubscriptions: Number(m.total_active || 0),
      recentChurn30d: Number(m.recent_churn || 0),
      tierDistribution: tierBreakdown.rows.map(r => ({
        tier: r.tier || 'free',
        count: Number(r.count),
      })),
      monthlyChurn: churn.rows.map(r => ({
        month: r.month,
        churned: Number(r.churned_count),
      })),
    },
  });
}
