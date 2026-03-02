/**
 * GET /api/transits/today?lat=27.9506&lng=-82.4572
 *
 * Returns current transit positions, gate activations,
 * and transit-to-natal aspects for a stored chart.
 * If no stored chart, returns raw transit positions only.
 *
 * Query params:
 *   lat, lng — observer location (optional, for house calc)
 *   chartId  — ID of stored natal chart (optional)
 *   birthDate, birthTime, birthTimezone — inline natal data (alternative to chartId)
 */

import { calculateFullChart } from '../../../src/engine/index.js';
import { getCurrentTransits } from '../../../src/engine/transits.js';

export async function handleTransits(request, env) {
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get('lat')) || 0;
  const lng = parseFloat(url.searchParams.get('lng')) || 0;

  // Inline birth data for natal comparison
  const birthDate = url.searchParams.get('birthDate');
  const birthTime = url.searchParams.get('birthTime');

  let natalChart = null;
  let natalAstro = null;

  if (birthDate && birthTime) {
    const [year, month, day] = birthDate.split('-').map(Number);
    const [hour, minute] = birthTime.split(':').map(Number);

    const chart = calculateFullChart({
      year, month, day, hour, minute, second: 0,
      lat, lng
    });

    natalChart = chart.chart;
    natalAstro = chart.astrology;
  }

  // Calculate current transits
  const transits = getCurrentTransits(natalChart, natalAstro);

  return Response.json({
    success: true,
    date: new Date().toISOString().slice(0, 10),
    transits: {
      positions: transits.positions,
      gateActivations: transits.gateActivations,
      aspects: transits.transitAspects || [],
      natalMatches: transits.natalMatches || []
    }
  });
}
