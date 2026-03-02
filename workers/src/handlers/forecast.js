/**
 * GET /api/transits/forecast
 *
 * Returns a multi-day transit forecast with gate ingresses
 * and outer-planet exact aspects against a natal chart.
 *
 * Query params:
 *   birthDate, birthTime — natal birth data (required)
 *   lat, lng             — birth location (required)
 *   days                 — forecast window 1-90 (default 30)
 *   startDate            — forecast start date YYYY-MM-DD (default today)
 */

import { calculateFullChart } from '../../../src/engine/index.js';
import { getTransitForecast } from '../../../src/engine/transits.js';

export async function handleForecast(request, env) {
  const url = new URL(request.url);

  const birthDate = url.searchParams.get('birthDate');
  const birthTime = url.searchParams.get('birthTime');
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));

  if (!birthDate || !birthTime || isNaN(lat) || isNaN(lng)) {
    return Response.json(
      { error: 'Required params: birthDate, birthTime, lat, lng' },
      { status: 400 }
    );
  }

  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '30', 10)));
  const startDateStr = url.searchParams.get('startDate');

  // Start date
  const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00Z') : new Date();
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + days);

  // Calculate natal chart
  const [year, month, day] = birthDate.split('-').map(Number);
  const [hour, minute] = birthTime.split(':').map(Number);

  const chart = calculateFullChart({
    year, month, day, hour, minute, second: 0,
    lat, lng
  });

  // Generate forecast
  const forecast = getTransitForecast(
    chart.chart,
    chart.astrology,
    startDate,
    endDate
  );

  return Response.json({
    success: true,
    range: {
      start: startDate.toISOString().slice(0, 10),
      end: endDate.toISOString().slice(0, 10),
      days
    },
    events: forecast.events,
    summary: {
      totalEvents: forecast.events.length,
      ingresses: forecast.events.filter(e => e.type === 'gate_ingress').length,
      aspects: forecast.events.filter(e => e.type === 'exact_aspect').length
    }
  });
}
