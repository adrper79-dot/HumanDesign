/**
 * Engine Orchestrator — Runs Layers 1-7 in sequence.
 *
 * Single entry point for full chart calculation.
 *
 * Exports:
 *   calculateFullChart({ year, month, day, hour, minute, second, lat, lng })
 */

import { toJulianDay } from './julian.js';
import { getAllPositions } from './planets.js';
import { getDesignCalculation } from './design.js';
import { mapAllToGates } from './gates.js';
import { calculateChart } from './chart.js';
import { calculateAstrology } from './astro.js';
import { getCurrentTransits } from './transits.js';
import { calculateNumerologyFromBirthData } from './numerology.js';

/**
 * Calculate the full Prime Self chart for a given birth.
 *
 * All times must be in UTC. The caller is responsible for
 * converting local time + timezone → UTC before calling.
 *
 * @param {object} params
 * @param {number} params.year  – Birth year (UTC)
 * @param {number} params.month – Birth month 1-12 (UTC)
 * @param {number} params.day   – Birth day 1-31 (UTC)
 * @param {number} params.hour  – Birth hour 0-23 (UTC)
 * @param {number} params.minute – Birth minute 0-59 (UTC)
 * @param {number} [params.second=0] – Birth second 0-59 (UTC)
 * @param {number} params.lat   – Birth latitude (+N/-S)
 * @param {number} params.lng   – Birth longitude (+E/-W)
 * @param {boolean} [params.includeTransits=true] – Include current transits
 * @returns {object} Complete chart data
 */
export function calculateFullChart(params) {
  const {
    year, month, day, hour, minute,
    second = 0, lat, lng,
    includeTransits = true
  } = params;

  // BL-R-M8: Validate inputs before calculation
  if (!Number.isFinite(year) || year < 1 || year > 2200) {
    throw new Error('Invalid year: must be 1–2200');
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error('Invalid month: must be 1–12');
  }
  const maxDay = new Date(year, month, 0).getDate(); // last day of the given month
  if (!Number.isFinite(day) || day < 1 || day > maxDay) {
    throw new Error(`Invalid day: must be 1–${maxDay} for month ${month}`);
  }
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    throw new Error('Invalid hour: must be 0–23');
  }
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) {
    throw new Error('Invalid minute: must be 0–59');
  }
  if (!Number.isFinite(second) || second < 0 || second > 59) {
    throw new Error('Invalid second: must be 0–59');
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('Invalid latitude: must be -90 to 90');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('Invalid longitude: must be -180 to 180');
  }

  // Layer 1: Julian Day Number
  const jdn = toJulianDay(year, month, day, hour, minute, second);

  // Layer 2: Planetary positions at birth
  const birthPositions = getAllPositions(jdn);

  // Layer 3: Design side (88° solar arc before birth)
  const design = getDesignCalculation(jdn, birthPositions);

  // Layer 4: Gate/Line lookup for both sides
  const personalityGates = mapAllToGates(birthPositions);
  const designGates = mapAllToGates(design.designPositions);

  // Layer 5: Chart properties (Type, Authority, Profile, etc.)
  const chart = calculateChart(personalityGates, designGates);

  // Layer 6: Western Astrology (signs, houses, aspects)
  const astrology = calculateAstrology(birthPositions, lat, lng, jdn);

  // Layer 7: Current transits (optional)
  let transits = null;
  if (includeTransits) {
    transits = getCurrentTransits(chart, astrology);
  }

  // Layer 8: Numerology (Life Path, Personal Year, Tarot)
  const numerology = calculateNumerologyFromBirthData(year, month, day);

  return {
    birth: { year, month, day, hour, minute, second, lat, lng, jdn },
    design: {
      date: design.designDate,
      jdn: design.designJDN
    },
    personalityGates,
    designGates,
    chart,
    astrology,
    transits,
    numerology
  };
}
