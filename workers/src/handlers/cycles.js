/**
 * GET /api/cycles
 * 
 * Calculate major life cycles (Saturn return, Uranus opposition, etc.)
 * for a given birthdate.
 * 
 * Query params:
 *   birthDate — YYYY-MM-DD (required)
 *   birthTime — HH:MM (required for accurate cycle timing)
 *   lat, lng — Birth location (required for JDN calculation)
 *   lookAheadYears — How many years to forecast (default: 5)
 * 
 * Returns:
 *   {
 *     ok: true,
 *     currentAge: 34.2,
 *     cycles: [
 *       {
 *         planet: 'saturn',
 *         cycle: 'Saturn Return',
 *         type: 'return',
 *         date: '2026-05-15',
 *         ageAtCycle: 29.5,
 *         yearsUntil: 2.3,
 *         status: 'approaching',
 *         intensity: 'transformative',
 *         description: '...',
 *         guidance: '...'
 *       },
 *       ...
 *     ],
 *     summary: {
 *       upcomingCycles: 3,
 *       activeCycles: 1,
 *       nextMajorCycle: {...}
 *     }
 *   }
 */

import { calculateFullChart } from '../../../src/engine/index.js';
import { calculateLifeCycles } from '../../../src/engine/transits.js';
import { parseToUTC } from '../utils/parseToUTC.js';
import { toJulianDay } from '../../../src/engine/julian.js';
import { getUserFromRequest } from '../middleware/auth.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';

export async function handleCycles(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const url = new URL(request.url);
  const birthDate = url.searchParams.get('birthDate');
  const birthTime = url.searchParams.get('birthTime');
  const lat = parseFloat(url.searchParams.get('lat')) || 0;
  const lng = parseFloat(url.searchParams.get('lng')) || 0;
  const lookAheadYears = parseInt(url.searchParams.get('lookAheadYears')) || 5;

  // Validate required params
  if (!birthDate || !birthTime) {
    return Response.json({
      ok: false,
      error: 'Missing required parameters: birthDate, birthTime'
    }, { status: 400 });
  }

  try {
    // BL-N5: Require birthTimezone — passing null silently computes cycles in UTC,
    // producing wrong milestone dates for non-UTC users.
    const birthTimezone = url.searchParams.get('birthTimezone');
    if (!birthTimezone) {
      return Response.json({
        ok: false,
        error: 'birthTimezone is required. Please provide a valid IANA timezone (e.g. "America/New_York").'
      }, { status: 400 });
    }

    // Parse birth data to UTC
    const utc = parseToUTC(birthDate, birthTime, birthTimezone);

    // Calculate natal chart (we need natal planet positions)
    const chart = calculateFullChart({
      ...utc,
      lat,
      lng
    });

    // Calculate birth JDN
    const birthJDN = toJulianDay(
      utc.year,
      utc.month,
      utc.day,
      utc.hour,
      utc.minute,
      utc.second
    );

    // Calculate life cycles
    const {summary, cycles} = calculateLifeCycles(
      chart.astrology,
      birthJDN,
      { lookAheadYears }
    );

    return Response.json({
      ok: true,
      currentAge: summary.currentAge,
      cycles,
      summary: {
        upcomingCycles: summary.upcomingCycles,
        activeCycles: summary.activeCycles,
        recentCycles: summary.recentCycles,
        nextMajorCycle: summary.nextMajorCycle
      }
    });

  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'cycles' });
  }
}
