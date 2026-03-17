/**
 * Famous People Comparison Handler
 * 
 * Endpoints:
 * - GET /api/compare/celebrities - Get top celebrity matches for user
 * - GET /api/compare/celebrities/:id - Get specific celebrity match details
 * - GET /api/compare/celebrities/category/:category - Get celebrities by category
 * - GET /api/compare/celebrities/search?q=query - Search celebrities
 */

import {
  findCelebrityMatches,
  getCelebrityMatch,
  getCelebritiesByCategory,
  searchCelebrities
} from '../lib/celebrityMatch.js';
import { calculateFullChart } from '../../../src/engine/index.js';
import { parseToUTC } from '../utils/parseToUTC.js';
import celebsData from '../data/celebrities.json' with { type: 'json' };
import { trackEvent } from './achievements.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { getUserFromRequest } from '../middleware/auth.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';

/**
 * GET /api/compare/celebrities
 * Get top celebrity matches for authenticated user
 * 
 * Query params:
 * - limit: number of matches to return (default: 10, max: 30)
 * - includeChart: whether to include full chart data (default: false)
 */
export async function handleGetCelebrityMatches(request, env, ctx) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) return Response.json({ ok: false, error: 'Authentication required' }, { status: 401 });

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 30);
    const includeChart = url.searchParams.get('includeChart') === 'true';
    
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get user's most recent chart
    const { rows: charts } = await query(QUERIES.getUserChartWithBirthData, [user.id]);
    
    if (charts.length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'No chart found. Please calculate your chart first.'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const chart = charts[0];
    
    // Use cached chart or calculate fresh
    let userChart;
    if (chart.hd_json) {
      const raw = typeof chart.hd_json === 'string' ? JSON.parse(chart.hd_json) : chart.hd_json;
      // hd_json may be stored as bare chart object (result.chart) or as full result ({ chart: {...} }).
      // Normalize to always have the { chart: {...} } wrapper that findCelebrityMatches expects.
      userChart = raw.chart ? raw : { chart: raw };
    } else {
      const utc = parseToUTC(chart.birth_date, chart.birth_time, chart.birth_tz);
      userChart = calculateFullChart({
        ...utc,
        lat: chart.birth_lat,
        lng: chart.birth_lng,
        includeTransits: false
      });
    }

    // Find celebrity matches
    const matches = await findCelebrityMatches(userChart, limit);
    
    // Track event for achievements
    await trackEvent(env, user.id, 'celebrity_compared', {
      matchesCount: matches.length,
      topMatch: matches[0]?.celebrity.name
    }, user.tier, request._ctx);
    
    // Format response
    const response = {
      ok: true,
      matches: matches.map(match => ({
        celebrity: match.celebrity,
        similarity: {
          percentage: match.similarity.percentage,
          score: match.similarity.score
        },
        ...(includeChart && { chart: match.chart }),
        highlights: getMatchHighlights(match.similarity.breakdown)
      })),
      userType: userChart.chart.type,
      userProfile: userChart.chart.profile,
      totalCelebrities: celebsData.metadata.totalCelebrities,
      categories: celebsData.metadata.categories
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return reportHandledRouteError({
      request, env, error,
      source: 'handleGetCelebrityMatches',
      fallbackMessage: 'Failed to find celebrity matches',
      status: 500,
    });
  }
}

/**
 * GET /api/compare/celebrities/:id
 * Get detailed match information for specific celebrity
 */
export async function handleGetCelebrityMatchById(request, env, celebrityId) {
  try {
    // P2-BIZ-018: Validate celebrity ID format (UUID or short slug, max 50 chars)
    if (!celebrityId || celebrityId.length > 50) {
      return Response.json({ ok: false, error: 'Invalid celebrity ID' }, { status: 400 });
    }

    const user = await getUserFromRequest(request, env);
    if (!user) return Response.json({ ok: false, error: 'Authentication required' }, { status: 401 });

    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get user's most recent chart
    const { rows: charts } = await query(QUERIES.getUserChartWithBirthData, [user.id]);
    
    if (charts.length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'No chart found. Please calculate your chart first.'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const chart = charts[0];
    
    // Use cached chart or calculate fresh
    let userChart;
    if (chart.hd_json) {
      const raw = typeof chart.hd_json === 'string' ? JSON.parse(chart.hd_json) : chart.hd_json;
      userChart = raw.chart ? raw : { chart: raw };
    } else {
      const utc = parseToUTC(chart.birth_date, chart.birth_time, chart.birth_tz);
      userChart = calculateFullChart({
        ...utc,
        lat: chart.birth_lat,
        lng: chart.birth_lng,
        includeTransits: false
      });
    }

    // Get celebrity match
    const match = await getCelebrityMatch(userChart, celebrityId);
    
    if (!match) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Celebrity not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Track event
    await trackEvent(env, user.id, 'celebrity_viewed', {
      celebrityId,
      celebrityName: match.celebrity.name,
      similarity: match.similarity.percentage
    }, user.tier, request._ctx);
    
    return new Response(JSON.stringify({
      ok: true,
      match,
      userChart: {
        type: userChart.chart.type,
        profile: userChart.chart.profile,
        authority: userChart.chart.authority,
        definition: userChart.chart.definition,
        definedCenters: userChart.chart.definedCenters
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return reportHandledRouteError({
      request, env, error,
      source: 'handleGetCelebrityMatchById',
      fallbackMessage: 'Failed to get celebrity match',
      status: 500,
    });
  }
}

/**
 * GET /api/compare/categories
 * List all valid celebrity categories (no auth required - public endpoint)
 */
export async function handleGetCategories(request, env, ctx) {
  try {
    const categories = celebsData.metadata.categories;
    const counts = {};
    for (const c of celebsData.celebrities) {
      counts[c.category] = (counts[c.category] || 0) + 1;
    }
    return Response.json({
      ok: true,
      categories: categories.map(cat => ({ name: cat, count: counts[cat] || 0 })),
      total: categories.length
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Failed to get categories'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/compare/celebrities/category/:category
 * Get all celebrities in a category (no auth required - public endpoint)
 */
export async function handleGetCelebritiesByCategory(request, env, category) {
  try {
    const celebrities = getCelebritiesByCategory(category);
    
    if (celebrities.length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Category not found or empty'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      ok: true,
      category,
      celebrities: celebrities.map(c => ({
        id: c.id,
        name: c.name,
        bio: c.bio,
        achievements: c.achievements,
        tags: c.tags,
        location: c.location
      })),
      total: celebrities.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'famous-get-by-category' });
  }
}

/**
 * GET /api/compare/celebrities/search?q=query
 * Search celebrities by name, tags, or bio (no auth required - public endpoint)
 */
export async function handleSearchCelebrities(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    
    if (!query || query.trim().length < 2) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Query must be at least 2 characters'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const celebrities = searchCelebrities(query);
    
    return new Response(JSON.stringify({
      ok: true,
      query,
      celebrities: celebrities.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        bio: c.bio,
        achievements: c.achievements,
        tags: c.tags
      })),
      total: celebrities.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return reportHandledRouteError({
      request, env, error,
      source: 'handleSearchCelebrities',
      fallbackMessage: 'Failed to search celebrities',
      status: 500,
    });
  }
}

/**
 * GET /api/compare/list
 * Get all available celebrities (metadata only) (no auth required - public endpoint)
 */
export async function handleGetAllCelebrities(request, env, ctx) {
  try {
    return new Response(JSON.stringify({
      ok: true,
      celebrities: celebsData.celebrities.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        tags: c.tags,
        location: c.location,
        achievements: c.achievements.slice(0, 2) // First 2 achievements only
      })),
      metadata: celebsData.metadata,
      total: celebsData.celebrities.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return reportHandledRouteError({
      request, env, error,
      source: 'handleGetAllCelebrities',
      fallbackMessage: 'Failed to get all celebrities',
      status: 500,
    });
  }
}

/**
 * Helper: Get match highlights (top 3 strongest matches)
 */
function getMatchHighlights(breakdown) {
  const highlights = [];
  
  if (breakdown.type?.match) {
    highlights.push({
      area: 'Type',
      value: breakdown.type.detail,
      score: breakdown.type.score
    });
  }
  
  if (breakdown.profile?.match) {
    highlights.push({
      area: 'Profile',
      value: breakdown.profile.detail,
      score: breakdown.profile.score
    });
  }
  
  if (breakdown.authority?.match) {
    highlights.push({
      area: 'Authority',
      value: breakdown.authority.detail,
      score: breakdown.authority.score
    });
  }
  
  if (breakdown.gates?.matchCount >= 5) {
    highlights.push({
      area: 'Gates',
      value: `${breakdown.gates.matchCount} gates in common`,
      score: breakdown.gates.score
    });
  }
  
  if (breakdown.definition?.match) {
    highlights.push({
      area: 'Definition',
      value: breakdown.definition.detail,
      score: breakdown.definition.score
    });
  }
  
  // Return top 3 by score
  return highlights
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
