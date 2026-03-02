/**
 * POST /api/chart/calculate
 *
 * Full chart calculation — Layers 1-7.
 *
 * Request body:
 * {
 *   birthDate: "1979-08-05",
 *   birthTime: "18:51",
 *   birthTimezone: "America/New_York",
 *   lat: 27.9506,
 *   lng: -82.4572
 * }
 *
 * Response: Full chart JSON
 */

import { calculateFullChart } from '../../../src/engine/index.js';
import { parseToUTC } from '../utils/parseToUTC.js';

export async function handleCalculate(request, env) {
  const body = await request.json();

  // Validate required fields
  const required = ['birthDate', 'birthTime', 'lat', 'lng'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      return Response.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const { birthDate, birthTime, birthTimezone, lat, lng } = body;

  // Convert to UTC
  let utc;
  if (birthTimezone) {
    utc = parseToUTC(birthDate, birthTime, birthTimezone);
  } else {
    // Assume UTC if no timezone provided
    const [year, month, day] = birthDate.split('-').map(Number);
    const [hour, minute] = birthTime.split(':').map(Number);
    utc = { year, month, day, hour, minute, second: 0 };
  }

  // Run full chart calculation
  const result = calculateFullChart({
    ...utc,
    lat: parseFloat(lat),
    lng: parseFloat(lng)
  });

  return Response.json({
    success: true,
    data: result,
    meta: {
      utcInput: utc,
      calculatedAt: new Date().toISOString()
    }
  });
}
