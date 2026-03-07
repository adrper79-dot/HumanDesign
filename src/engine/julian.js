/**
 * Layer 1: Julian Day Number + Sun Longitude Calculation
 *
 * Pure JS implementation of Jean Meeus' "Astronomical Algorithms" (2nd ed.)
 * for Cloudflare Workers (V8 isolate). No external dependencies.
 *
 * Verification anchor: AP — Aug 5, 1979, 22:51 UTC, Tampa FL
 *   Expected JDN: ~2444091.4521
 *   Expected Sun longitude: within Gate 33 range (123.75° – 129.375°)
 */

/**
 * Convert a calendar date + time (UTC) to Julian Day Number.
 *
 * Uses Meeus Ch. 7 algorithm. Handles the Gregorian calendar boundary
 * (dates on or after Oct 15, 1582 use Gregorian; before = Julian).
 * JDN 0.0 = noon, not midnight. The fractional part encodes time-of-day.
 *
 * @param {number} year  – 4-digit year
 * @param {number} month – 1–12
 * @param {number} day   – 1–31
 * @param {number} hour  – 0–23 (UTC)
 * @param {number} minute – 0–59 (UTC)
 * @param {number} second – 0–59 (UTC)
 * @returns {number} Julian Day Number (with decimal)
 */
export function toJulianDay(year, month, day, hour = 0, minute = 0, second = 0) {
  // Meeus Ch. 7: if month <= 2, treat as month+12 of preceding year
  let Y = year;
  let M = month;
  if (M <= 2) {
    Y -= 1;
    M += 12;
  }

  // Day fraction (JDN starts at noon, so 0h UT = -0.5 from JDN integer)
  const dayFraction = day + (hour + minute / 60 + second / 3600) / 24;  // BL-R-M1: include seconds

  // Gregorian calendar correction
  let B = 0;
  const isGregorian =
    year > 1582 ||
    (year === 1582 && month > 10) ||
    (year === 1582 && month === 10 && day >= 15);
  if (isGregorian) {
    const A = Math.floor(Y / 100);
    B = 2 - A + Math.floor(A / 4);
  }

  // Meeus equation 7.1
  const jdn =
    Math.floor(365.25 * (Y + 4716)) +
    Math.floor(30.6001 * (M + 1)) +
    dayFraction +
    B -
    1524.5;

  return jdn;
}

/**
 * Calculate the Sun's apparent ecliptic longitude for a given JDN.
 *
 * Uses Meeus Ch. 25 (Solar Coordinates) with low-accuracy method
 * sufficient for Human Design gate-level precision (~0.01° accuracy).
 *
 * Steps:
 *   1. Julian centuries T from J2000.0
 *   2. Geometric mean longitude L0
 *   3. Mean anomaly M
 *   4. Equation of center C
 *   5. Sun true longitude
 *   6. Apparent longitude (corrected for nutation + aberration)
 *
 * @param {number} jdn – Julian Day Number
 * @returns {number} Apparent ecliptic longitude, 0–360°
 */
export function getSunLongitude(jdn) {
  // Step 1: Julian centuries from J2000.0 (Meeus eq. 25.1)
  const T = (jdn - 2451545.0) / 36525.0;

  // Step 2: Geometric mean longitude of the Sun (Meeus eq. 25.2)
  let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  L0 = normalizeDegrees(L0);

  // Step 3: Mean anomaly of the Sun (Meeus eq. 25.3)
  let M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  M = normalizeDegrees(M);
  const Mrad = degToRad(M);

  // Step 4: Equation of center (Meeus Ch. 25)
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);

  // Step 5: Sun's true longitude
  const sunTrueLong = L0 + C;

  // Step 6: Sun's true anomaly (not used directly, but for reference)
  // const v = M + C;

  // Step 7: Longitude of the ascending node of the Moon's orbit (Ω)
  // Used for nutation + aberration correction
  const omega = 125.04 - 1934.136 * T;
  const omegaRad = degToRad(omega);

  // Step 8: Apparent longitude (corrected for nutation and aberration)
  // Meeus eq. 25.8 (low-accuracy nutation + aberration)
  const apparentLong =
    sunTrueLong - 0.00569 - 0.00478 * Math.sin(omegaRad);

  return normalizeDegrees(apparentLong);
}

/**
 * Normalize an angle to the range [0, 360).
 * @param {number} deg – angle in degrees
 * @returns {number} normalized angle 0–360°
 */
export function normalizeDegrees(deg) {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/**
 * Convert degrees to radians.
 * @param {number} deg
 * @returns {number}
 */
export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Convert radians to degrees.
 * @param {number} rad
 * @returns {number}
 */
export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

/**
 * Convenience: compute both JDN and Sun longitude in one call.
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {number} hour  – UTC
 * @param {number} minute – UTC
 * @param {number} second – UTC
 * @returns {{ jdn: number, sunLongitude: number }}
 */
export function computeSun(year, month, day, hour, minute, second) {
  const jdn = toJulianDay(year, month, day, hour, minute, second);
  const sunLongitude = getSunLongitude(jdn);
  return { jdn, sunLongitude };
}
