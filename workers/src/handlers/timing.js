/**
 * Best Timing Engine — Electional Astrology
 * 
 * Helps users find the best dates for important life actions based on:
 * - Personal Human Design strategy
 * - Favorable planetary transits
 * - Challenging aspects to avoid
 * - Moon phases and Lunar cycles
 * 
 * Endpoint: POST /api/timing/find-dates
 */

import { getUserFromRequest } from '../middleware/auth.js';
import { createQueryFn, QUERIES } from '../db/queries.js';
import { trackEvent } from './achievements.js';
import { getAllPositions } from '../../../src/engine/planets.js';

// Intention templates with astrological preferences
const INTENTION_TEMPLATES = {
  launch_project: {
    name: 'Launch Project/Business',
    category: 'career',
    preferredPlanets: ['Sun', 'Mars', 'Jupiter'],  // Power, action, expansion
    preferredAspects: ['trine', 'sextile', 'conjunction'],
    avoidAspects: ['opposition', 'square'],
    moonPhase: 'new',  // New beginnings
    description: 'Ideal for product launches, business starts, big announcements'
  },
  start_relationship: {
    name: 'Start Relationship',
    category: 'relationship',
    preferredPlanets: ['Venus', 'Moon', 'Jupiter'],  // Love, emotion, growth
    preferredAspects: ['trine', 'sextile', 'conjunction'],
    avoidAspects: ['square', 'opposition'],
    moonPhase: 'waxing',  // Growth
    description: 'Favorable for first dates, asking someone out, commitment'
  },
  sign_contract: {
    name: 'Sign Contract/Agreement',
    category: 'legal',
    preferredPlanets: ['Mercury', 'Sun', 'Jupiter'],  // Communication, clarity, fortune
    preferredAspects: ['trine', 'sextile'],
    avoidAspects: ['opposition', 'square'],
    moonPhase: 'full',  // Culmination
    avoidRetrograde: ['Mercury'],  // Never sign during Mercury Rx
    description: 'Best for signing leases, employment contracts, major agreements'
  },
  relocate: {
    name: 'Move/Relocate',
    category: 'home',
    preferredPlanets: ['Moon', 'Venus', 'Jupiter'],  // Home, comfort, expansion
    preferredAspects: ['trine', 'sextile'],
    avoidAspects: ['square', 'opposition'],
    moonPhase: 'waxing',  // Building
    description: 'Favorable for moving homes, relocating cities, new residence'
  },
  career_change: {
    name: 'Career Change',
    category: 'career',
    preferredPlanets: ['Sun', 'Mars', 'Saturn'],  // Identity, action, commitment
    preferredAspects: ['trine', 'sextile', 'conjunction'],
    avoidAspects: ['opposition', 'square'],
    moonPhase: 'new',  // Fresh start
    description: 'Ideal for starting new job, changing fields, big career pivot'
  },
  surgery_medical: {
    name: 'Surgery/Medical Procedure',
    category: 'health',
    preferredPlanets: ['Sun', 'Jupiter'],  // Vitality, healing
    preferredAspects: ['trine', 'sextile'],
    avoidAspects: ['square', 'opposition'],
    avoidPlanets: ['Mars'],  // Mars = inflammation/bleeding
    moonPhase: 'waning',  // Removal/reduction
    description: 'Best timing for elective surgeries, medical procedures'
  },
  travel: {
    name: 'Long-Distance Travel',
    category: 'travel',
    preferredPlanets: ['Jupiter', 'Sun', 'Venus'],  // Expansion, joy, pleasure
    preferredAspects: ['trine', 'sextile'],
    avoidAspects: ['square', 'opposition'],
    avoidRetrograde: ['Mercury'],  // Travel delays
    description: 'Favorable for vacation starts, international trips'
  },
  creative_work: {
    name: 'Start Creative Project',
    category: 'creativity',
    preferredPlanets: ['Venus', 'Neptune', 'Moon'],  // Art, inspiration, emotion
    preferredAspects: ['trine', 'sextile', 'conjunction'],
    avoidAspects: ['square'],
    moonPhase: 'waxing',  // Growth
    description: 'Ideal for starting art, music, writing projects'
  }
};

/**
 * Main handler for /api/timing/find-dates
 */
export async function handleTiming(request, env) {
  // Require authentication
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      message: 'Authentication required'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Tier enforcement: Timing engine requires Seeker tier
  if (user.tier === 'free') {
    return new Response(JSON.stringify({
      error: 'Upgrade required',
      message: 'Best Timing Engine requires Seeker tier or higher',
      upgrade_required: true,
      feature: 'timingEngine',
      upgradeUrl: '/app/pricing'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get user's saved chart
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const chartResult = await query(
    `SELECT c.id, c.hd_json, c.astro_json, c.calculated_at,
            u.birth_date, u.birth_time, u.birth_tz, u.birth_lat, u.birth_lng
     FROM charts c
     JOIN users u ON u.id = c.user_id
     WHERE c.user_id = $1
     ORDER BY c.calculated_at DESC
     LIMIT 1`,
    [user.id]
  );

  const chartRow = chartResult.rows?.[0];
  if (!chartRow) {
    return new Response(JSON.stringify({
      error: 'No chart found',
      message: 'Please calculate your chart first at /app/chart'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const natalChart = typeof chartRow.hd_json === 'string'
    ? JSON.parse(chartRow.hd_json)
    : chartRow.hd_json;

  // Parse request body
  const body = await request.json();
  const { 
    intention = 'launch_project',
    windowDays = 90,
    minScore = 60,
    includeWeekends = true
  } = body;

  // Validate intention template
  const template = INTENTION_TEMPLATES[intention];
  if (!template) {
    return new Response(JSON.stringify({
      error: 'Invalid intention',
      message: `Intention must be one of: ${Object.keys(INTENTION_TEMPLATES).join(', ')}`,
      available: Object.keys(INTENTION_TEMPLATES).map(key => ({
        id: key,
        name: INTENTION_TEMPLATES[key].name,
        category: INTENTION_TEMPLATES[key].category
      }))
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Calculate optimal dates
  const optimalDates = await findOptimalDates(
    natalChart,
    template,
    windowDays,
    minScore,
    includeWeekends
  );

  // Track achievement event
  if (user?.id) {
    await trackEvent(env, user.id, 'timing_calculated', { intention }, user.tier || 'free');
  }

  return Response.json({
    success: true,
    intention: {
      id: intention,
      name: template.name,
      category: template.category,
      description: template.description
    },
    natalChart: {
      type: natalChart.chart.type,
      strategy: natalChart.chart.strategy,
      authority: natalChart.chart.authority
    },
    searchWindow: {
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      days: windowDays
    },
    optimalDates: optimalDates.slice(0, 10),  // Top 10
    totalCandidates: optimalDates.length
  });
}

/**
 * Find optimal dates within window
 */
async function findOptimalDates(natalChart, template, windowDays, minScore, includeWeekends) {
  const today = new Date();
  const candidates = [];

  // Evaluate each day in the window
  for (let dayOffset = 0; dayOffset < windowDays; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);

    // Skip weekends if requested
    if (!includeWeekends && (date.getDay() === 0 || date.getDay() === 6)) {
      continue;
    }

    // Calculate transits for this date
    const transits = calculateTransitsForDate(date);

    // Score the date
    const score = scoreDate(date, transits, natalChart, template);

    // Only include dates above minimum score
    if (score.total >= minScore) {
      candidates.push({
        date: date.toISOString().split('T')[0],
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()],
        score: score.total,
        scoreBreakdown: score.breakdown,
        highlights: score.highlights,
        warnings: score.warnings,
        moonPhase: score.moonPhase,
        recommendation: score.recommendation
      });
    }
  }

  // Sort by score (highest first)
  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}

/**
 * Calculate transits for a specific date using the real ephemeris engine
 */
function calculateTransitsForDate(date) {
  // Calculate Julian Day for the date
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = 12;  // Use noon for transit calculations

  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;

  let jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4);
  jd = jd - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  jd = jd + (hour - 12) / 24;

  return getCurrentTransits(jd);
}

/**
 * Get current planetary transits using the real ephemeris engine
 */
function getCurrentTransits(jd) {
  const positions = getAllPositions(jd);
  const positionsNext = getAllPositions(jd + 1);

  // Map engine keys to display names
  const planetMap = {
    sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus',
    mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn'
  };

  const transits = {};
  for (const [key, display] of Object.entries(planetMap)) {
    const lon = positions[key].longitude;
    const lonNext = positionsNext[key].longitude;

    // Detect retrograde: if apparent daily motion is negative
    // Account for 360° wrap (normal forward motion near 360→0 would show a large negative diff)
    let dailyMotion = lonNext - lon;
    if (dailyMotion > 180) dailyMotion -= 360;
    if (dailyMotion < -180) dailyMotion += 360;

    transits[display] = {
      planet: display,
      longitude: lon,
      retrograde: dailyMotion < 0 && key !== 'sun' && key !== 'moon'  // Sun & Moon never retrograde
    };
  }

  return transits;
}

/**
 * Score a date based on transits and natal chart
 */
function scoreDate(date, transits, natalChart, template) {
  let totalScore = 0;
  const breakdown = {};
  const highlights = [];
  const warnings = [];

  // 1. Strategy alignment (20 points)
  const strategyScore = scoreStrategy(natalChart.chart.strategy, date);
  totalScore += strategyScore;
  breakdown.strategy = strategyScore;
  if (strategyScore >= 15) {
    highlights.push(`Aligned with your ${natalChart.chart.strategy} strategy`);
  }

  // 2. Favorable planetary aspects (40 points)
  const aspectsScore = scorePlanetaryAspects(transits, natalChart, template);
  totalScore += aspectsScore.score;
  breakdown.aspects = aspectsScore.score;
  highlights.push(...aspectsScore.highlights);
  warnings.push(...aspectsScore.warnings);

  // 3. Moon phase alignment (20 points)
  const moonPhaseScore = scoreMoonPhase(transits.Moon.longitude, transits.Sun.longitude, template.moonPhase);
  totalScore += moonPhaseScore.score;
  breakdown.moonPhase = moonPhaseScore.score;
  breakdown.moonPhaseName = moonPhaseScore.phase;
  if (moonPhaseScore.score >= 15) {
    highlights.push(`${moonPhaseScore.phase} — ideal for ${template.name.toLowerCase()}`);
  }

  // 4. Avoid challenging transits (20 points deduction if present)
  const challengeScore = scoreChallengingTransits(transits, natalChart, template);
  totalScore += challengeScore.score;  // Negative score
  breakdown.challenges = challengeScore.score;
  warnings.push(...challengeScore.warnings);

  // Cap total at 100
  totalScore = Math.min(100, Math.max(0, totalScore));

  // Generate recommendation
  let recommendation = 'Consider this date';
  if (totalScore >= 85) recommendation = 'Highly recommended';
  else if (totalScore >= 70) recommendation = 'Favorable';
  else if (totalScore >= 60) recommendation = 'Good option';

  return {
    total: Math.round(totalScore),
    breakdown,
    highlights,
    warnings,
    moonPhase: moonPhaseScore.phase,
    recommendation
  };
}

/**
 * Score based on HD strategy
 */
function scoreStrategy(strategy, date) {
  const dayOfWeek = date.getDay();

  // Manifestors: Better on Mars days (Tuesday, better energy for informing)
  if (strategy === 'Inform before acting' && dayOfWeek === 2) return 20;

  // Generators: Better on Sacral days (Wednesday, responding energy)
  if (strategy === 'Wait to respond' && dayOfWeek === 3) return 20;

  // Projectors: Better on recognition days (Monday, visibility)
  if (strategy === 'Wait for invitation' && dayOfWeek === 1) return 20;

  // Reflectors: Better on lunar significant days (full/new moon)
  // This would be calculated with moon phase
  if (strategy === 'Wait 28 days') return 15;

  return 10;  // Neutral
}

/**
 * Score planetary aspects
 */
function scorePlanetaryAspects(transits, natalChart, template) {
  let score = 0;
  const highlights = [];
  const warnings = [];

  // Check each preferred planet
  for (const planet of template.preferredPlanets) {
    const transitLongitude = transits[planet].longitude;

    // Find corresponding natal planet
    const natalPlanet = natalChart.astrology[planet.toLowerCase()];
    if (!natalPlanet) continue;

    const natalLongitude = natalPlanet.degree + (getSignNumber(natalPlanet.sign) * 30);

    // Calculate aspect
    const angle = Math.abs(transitLongitude - natalLongitude) % 360;
    const aspect = getAspect(angle);

    if (aspect && template.preferredAspects.includes(aspect.name)) {
      score += aspect.score;
      highlights.push(`Transit ${planet} ${aspect.name} natal ${planet} — ${aspect.meaning}`);
    }
  }

  return { score, highlights, warnings };
}

/**
 * Get aspect type from angle
 */
function getAspect(angle) {
  const orb = 5;  // 5-degree orb

  if (Math.abs(angle - 0) <= orb || Math.abs(angle - 360) <= orb) {
    return { name: 'conjunction', score: 15, meaning: 'powerful alignment' };
  }
  if (Math.abs(angle - 120) <= orb || Math.abs(angle - 240) <= orb) {
    return { name: 'trine', score: 12, meaning: 'harmonious flow' };
  }
  if (Math.abs(angle - 60) <= orb || Math.abs(angle - 300) <= orb) {
    return { name: 'sextile', score: 10, meaning: 'opportunity' };
  }
  if (Math.abs(angle - 180) <= orb) {
    return { name: 'opposition', score: 0, meaning: 'tension' };
  }
  if (Math.abs(angle - 90) <= orb || Math.abs(angle - 270) <= orb) {
    return { name: 'square', score: 0, meaning: 'challenge' };
  }

  return null;
}

/**
 * Convert zodiac sign to number (0-11)
 */
function getSignNumber(sign) {
  const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 
                 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  return signs.indexOf(sign);
}

/**
 * Score moon phase
 */
function scoreMoonPhase(moonLongitude, sunLongitude, preferredPhase) {
  const angle = (moonLongitude - sunLongitude + 360) % 360;

  // Determine phase
  let phase = 'New Moon';
  let phaseScore = 0;

  if (angle < 45) {
    phase = 'New Moon';
    phaseScore = preferredPhase === 'new' ? 20 : 10;
  } else if (angle < 90) {
    phase = 'Waxing Crescent';
    phaseScore = preferredPhase === 'waxing' ? 20 : 12;
  } else if (angle < 135) {
    phase = 'First Quarter';
    phaseScore = preferredPhase === 'waxing' ? 18 : 12;
  } else if (angle < 180) {
    phase = 'Waxing Gibbous';
    phaseScore = preferredPhase === 'waxing' ? 20 : 14;
  } else if (angle < 225) {
    phase = 'Full Moon';
    phaseScore = preferredPhase === 'full' ? 20 : 10;
  } else if (angle < 270) {
    phase = 'Waning Gibbous';
    phaseScore = preferredPhase === 'waning' ? 20 : 12;
  } else if (angle < 315) {
    phase = 'Last Quarter';
    phaseScore = preferredPhase === 'waning' ? 18 : 12;
  } else {
    phase = 'Waning Crescent';
    phaseScore = preferredPhase === 'waning' ? 20 : 10;
  }

  return { phase, score: phaseScore };
}

/**
 * Score challenging transits (negative points)
 */
function scoreChallengingTransits(transits, natalChart, template) {
  let score = 0;
  const warnings = [];

  // Check for Mercury retrograde if template avoids it
  if (template.avoidRetrograde?.includes('Mercury') && transits.Mercury.retrograde) {
    score -= 20;
    warnings.push('Mercury is retrograde — avoid contracts and communication-heavy tasks');
  }

  // Check for Mars challenges if template avoids Mars
  if (template.avoidPlanets?.includes('Mars')) {
    // Check for Mars-Sun hard aspect
    const marsLongitude = transits.Mars.longitude;
    const sunLongitude = transits.Sun.longitude;
    const angle = Math.abs(marsLongitude - sunLongitude) % 360;
    
    if (Math.abs(angle - 90) <= 5 || Math.abs(angle - 180) <= 5) {
      score -= 15;
      warnings.push('Mars challenging aspect — avoid surgery/medical procedures');
    }
  }

  return { score, warnings };
}

/**
 * List available intention templates
 */
export async function listIntentionTemplates() {
  return Response.json({
    success: true,
    templates: Object.keys(INTENTION_TEMPLATES).map(key => ({
      id: key,
      name: INTENTION_TEMPLATES[key].name,
      category: INTENTION_TEMPLATES[key].category,
      description: INTENTION_TEMPLATES[key].description
    }))
  });
}
