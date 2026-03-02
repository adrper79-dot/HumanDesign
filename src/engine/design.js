/**
 * Layer 3: Design Side Calculation (Unconscious / -88 Solar Degrees)
 *
 * Human Design uses TWO chart calculations:
 *   Personality (Conscious):  planetary positions at birth moment
 *   Design (Unconscious):    planetary positions at the moment the Sun
 *                            was 88° earlier in the ecliptic
 *
 * This is NOT simply "birth date minus 88 days." The algorithm:
 *   1. Get Sun longitude at birth
 *   2. Target longitude = (birthSunLon - 88°) mod 360°
 *   3. Find the EXACT JDN when the Sun was at that longitude
 *      (root-finding via Newton-Raphson)
 *   4. Compute all planetary positions at that moment
 *
 * Pure JS for Cloudflare Workers. No external dependencies.
 *
 * Verification anchor: AP — Aug 5, 1979, 22:51 UTC
 *   Design date ≈ May 8–10, 1979
 *   Design Sun → Gate 2, Line 2
 *   Design Earth → Gate 1, Line 2
 */

import { toJulianDay, getSunLongitude, normalizeDegrees } from './julian.js';
import { getAllPositions } from './planets.js';

/**
 * Find the JDN when the Sun occupied a target ecliptic longitude,
 * searching backwards from a starting JDN.
 *
 * Uses Newton-Raphson iteration. The Sun moves ~0.9856° per day,
 * so the derivative dλ/dt ≈ 0.9856 °/day.
 *
 * @param {number} targetLon  – Target Sun longitude (0–360°)
 * @param {number} startJDN   – Starting JDN (birth JDN)
 * @param {number} tolerance  – Convergence tolerance in degrees (default 0.0001°)
 * @param {number} maxIter    – Maximum iterations (default 20)
 * @returns {number} JDN when Sun was at targetLon
 */
function findSunAtLongitude(targetLon, startJDN, tolerance = 0.0001, maxIter = 50) {
  // Initial estimate: ~88 days before birth (Sun moves ~1°/day)
  let jdn = startJDN - 88;

  for (let i = 0; i < maxIter; i++) {
    const currentLon = getSunLongitude(jdn);

    // Angular difference (handle wrap-around at 0°/360°)
    let diff = currentLon - targetLon;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    if (Math.abs(diff) < tolerance) {
      return jdn;
    }

    // Sun moves ~0.9856°/day. Correct by the angular difference.
    jdn -= diff / 0.9856;
  }

  // If we didn't converge, return best estimate (should never happen
  // for well-formed inputs within the 1800–2100 range)
  return jdn;
}

/**
 * Convert a JDN back to a calendar date (UTC).
 *
 * Inverse of toJulianDay. Uses Meeus Ch. 7 inverse algorithm.
 *
 * @param {number} jdn – Julian Day Number (with decimal)
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number }}
 */
function jdnToCalendar(jdn) {
  const z = Math.floor(jdn + 0.5);
  const f = (jdn + 0.5) - z;

  let A;
  if (z < 2299161) {
    A = z;
  } else {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    A = z + 1 + alpha - Math.floor(alpha / 4);
  }

  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);

  const dayDecimal = B - D - Math.floor(30.6001 * E) + f;
  const day = Math.floor(dayDecimal);

  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;

  // Extract time from fractional day
  const timeFraction = dayDecimal - day;
  const totalMinutes = Math.round(timeFraction * 24 * 60);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return { year, month, day, hour, minute };
}

/**
 * Calculate the Design (Unconscious) side of a Human Design chart.
 *
 * Finds the moment when the Sun was 88° earlier in the ecliptic,
 * then computes all planetary positions at that moment.
 *
 * @param {number} birthJDN       – Birth Julian Day Number
 * @param {object} birthPositions – Birth planetary positions from Layer 2
 * @returns {{
 *   designJDN: number,
 *   designDate: { year, month, day, hour, minute },
 *   designPositions: object
 * }}
 */
export function getDesignCalculation(birthJDN, birthPositions) {
  // Step 1: Get birth Sun longitude
  const birthSunLon = birthPositions.sun.longitude;

  // Step 2: Target = birth Sun - 88°
  const targetLon = normalizeDegrees(birthSunLon - 88);

  // Step 3: Find the exact JDN when Sun was at target longitude
  const designJDN = findSunAtLongitude(targetLon, birthJDN);

  // Step 4: Compute all planetary positions at the Design moment
  const designPositions = getAllPositions(designJDN);

  // Step 5: Convert Design JDN to calendar date
  const designDate = jdnToCalendar(designJDN);

  return {
    designJDN,
    designDate,
    designPositions
  };
}

// Also export utilities for testing
export { findSunAtLongitude, jdnToCalendar };
