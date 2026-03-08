/**
 * Layer 6: Western Astrology
 *
 * Converts planetary longitudes into:
 *   1. Zodiac sign placements (sign, degrees within sign)
 *   2. House placements (Placidus house system)
 *   3. Aspects between planets (conjunction through quincunx)
 *   4. Ascendant and Midheaven
 *
 * Uses Meeus Ch. 12 (Sidereal Time) and standard Placidus formulas.
 * Pure JS for Cloudflare Workers. No external dependencies.
 *
 * Verification anchor: AP — Aug 5, 1979, 22:51 UTC, Tampa FL (27.95°N, 82.46°W)
 *   Sun in Leo ~12-13°
 *   Ascendant in Sagittarius-Capricorn range
 */

import { normalizeDegrees, degToRad, radToDeg } from './julian.js';

// ─── ZODIAC SIGNS ───────────────────────────────────────────────

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

/**
 * Convert ecliptic longitude to zodiac sign placement.
 *
 * @param {number} longitude – Ecliptic longitude 0–360°
 * @returns {{ sign: string, degrees: number, signIndex: number }}
 */
export function getSignFromLongitude(longitude) {
  const lon = normalizeDegrees(longitude);
  const signIndex = Math.floor(lon / 30);
  const degrees = lon - signIndex * 30;
  return {
    sign: SIGNS[signIndex],
    degrees: Math.round(degrees * 100) / 100,
    signIndex
  };
}

// ─── SIDEREAL TIME (Meeus Ch. 12) ──────────────────────────────

/**
 * Calculate Greenwich Mean Sidereal Time (GMST) at a given JDN.
 *
 * @param {number} jdn – Julian Day Number
 * @returns {number} GMST in degrees (0–360)
 */
function getGMST(jdn) {
  // Julian centuries from J2000.0 at 0h UT
  const jd0 = Math.floor(jdn - 0.5) + 0.5; // JDN at preceding 0h UT
  const T0 = (jd0 - 2451545.0) / 36525;

  // GMST at 0h UT (Meeus eq. 12.4) — in seconds of time
  let gmst0 = 100.46061837 + 36000.770053608 * T0
    + 0.000387933 * T0 * T0
    - T0 * T0 * T0 / 38710000;

  // Add the sidereal rotation since 0h UT
  const utHours = (jdn - jd0) * 24;
  // Earth's sidereal rotation rate: ~360.98564736629° per solar day
  gmst0 += utHours * 15.04106864; // degrees per hour of UT

  return normalizeDegrees(gmst0);
}

/**
 * Calculate Local Sidereal Time.
 *
 * @param {number} jdn – Julian Day Number
 * @param {number} lng – Geographic longitude (+ East, − West)
 * @returns {number} LST in degrees
 */
function getLST(jdn, lng) {
  return normalizeDegrees(getGMST(jdn) + lng);
}

// ─── OBLIQUITY OF THE ECLIPTIC ─────────────────────────────────

/**
 * Obliquity of the ecliptic (Meeus eq. 22.2).
 *
 * @param {number} jdn
 * @returns {number} Obliquity in degrees
 */
function getObliquity(jdn) {
  const T = (jdn - 2451545.0) / 36525;
  // Mean obliquity (Meeus eq. 22.2)
  const eps0 = 23.4392911 - 0.0130042 * T
    - 1.64e-7 * T * T + 5.04e-7 * T * T * T;
  return eps0;
}

// ─── ASCENDANT AND MIDHEAVEN ────────────────────────────────────

/**
 * Calculate the Midheaven (MC) longitude.
 * MC is the ecliptic longitude at the meridian.
 *
 * @param {number} lst  – Local Sidereal Time in degrees
 * @param {number} eps  – Obliquity of ecliptic in degrees
 * @returns {number} MC longitude 0–360°
 */
function calculateMC(lst, eps) {
  const lstRad = degToRad(lst);
  const epsRad = degToRad(eps);

  // MC = atan2(sin(LST), cos(LST) * cos(eps))
  const mc = radToDeg(Math.atan2(
    Math.sin(lstRad),
    Math.cos(lstRad) * Math.cos(epsRad)
  ));

  return normalizeDegrees(mc);
}

/**
 * Calculate the Ascendant (ASC) longitude.
 *
 * @param {number} lst  – Local Sidereal Time in degrees
 * @param {number} eps  – Obliquity of ecliptic in degrees
 * @param {number} lat  – Geographic latitude in degrees
 * @returns {number} ASC longitude 0–360°
 */
function calculateASC(lst, eps, lat) {
  const lstRad = degToRad(lst);
  const epsRad = degToRad(eps);
  const latRad = degToRad(lat);

  // Standard formula gives Descendant with original sign convention.
  // Negate both atan2 args to rotate 180° → gives true Ascendant (Eastern horizon).
  const asc = radToDeg(Math.atan2(
    Math.cos(lstRad),
    -(Math.sin(epsRad) * Math.tan(latRad) + Math.cos(epsRad) * Math.sin(lstRad))
  ));

  return normalizeDegrees(asc);
}

// ─── PLACIDUS HOUSES ────────────────────────────────────────────

/**
 * Calculate Placidus house cusps.
 *
 * Uses iterative Placidus method: find the ecliptic longitude where
 * the right-ascension-based fraction of the semi-arc matches the target.
 *
 * For above-horizon cusps (H11, H12): fraction of diurnal semi-arc from MC.
 * For below-horizon cusps (H2, H3): fraction into nocturnal semi-arc past ASC.
 *
 * @param {number} lst  – Local Sidereal Time in degrees (= RAMC)
 * @param {number} eps  – Obliquity in degrees
 * @param {number} lat  – Geographic latitude in degrees
 * @returns {Object<number, number>} House cusps 1–12, each as ecliptic longitude
 */
function calculatePlacidusHouses(lst, eps, lat) {
  const epsRad = degToRad(eps);
  const latRad = degToRad(lat);
  const ramc = lst; // RAMC = LST

  const asc = calculateASC(lst, eps, lat);
  const mc = calculateMC(lst, eps);
  const ic = normalizeDegrees(mc + 180);
  const dsc = normalizeDegrees(asc + 180);

  // BL-R-M7: Placidus is undefined for polar latitudes (±>66.5°) because the
  // Placidus semi-arc calculation requires tan(lat)*tan(decl) < 1. If that
  // condition is violated, fall back to Equal House and emit a warning flag.
  const POLAR_LAT = 66.5; // degrees — inside the polar circle
  if (Math.abs(lat) >= POLAR_LAT) {
    const houses = { 1: asc, 4: ic, 7: dsc, 10: mc };
    for (let h = 2; h <= 12; h++) {
      if (h === 4 || h === 7 || h === 10) continue;
      houses[h] = normalizeDegrees(asc + (h - 1) * 30);
    }
    houses._system  = 'equal';
    houses._warning = 'polar latitude — Placidus undefined; Equal House used';
    return houses;
  }

  const houses = { 1: asc, 4: ic, 7: dsc, 10: mc };

  /**
   * Iteratively solve for a Placidus house cusp.
   *
   * @param {string} cuspType – 'H11' | 'H12' | 'H2' | 'H3'
   * @returns {number} Ecliptic longitude of the cusp
   */
  function solveCusp(cuspType) {
    // Initial RA guess (rough equidistant spacing)
    let ra;
    switch (cuspType) {
      case 'H11': ra = normalizeDegrees(ramc + 30); break;
      case 'H12': ra = normalizeDegrees(ramc + 60); break;
      case 'H2':  ra = normalizeDegrees(ramc + 120); break;
      case 'H3':  ra = normalizeDegrees(ramc + 150); break;
    }

    for (let i = 0; i < 50; i++) {
      // Convert RA to ecliptic longitude
      const raRad = degToRad(ra);
      const lambda = normalizeDegrees(radToDeg(Math.atan2(
        Math.sin(raRad),
        Math.cos(raRad) * Math.cos(epsRad)
      )));

      // Declination of this ecliptic point
      const decl = Math.asin(
        Math.sin(epsRad) * Math.sin(degToRad(lambda))
      );

      // Ascensional difference
      const tanProd = Math.tan(latRad) * Math.tan(decl);
      const ad = Math.abs(tanProd) < 1
        ? radToDeg(Math.asin(tanProd))
        : (tanProd > 0 ? 89.9 : -89.9);

      const dsa = 90 + ad; // diurnal semi-arc
      const nsa = 90 - ad; // nocturnal semi-arc

      // Target RA for this cusp type
      let targetRA;
      switch (cuspType) {
        case 'H11': targetRA = ramc + dsa / 3; break;
        case 'H12': targetRA = ramc + 2 * dsa / 3; break;
        case 'H2':  targetRA = ramc + dsa + nsa / 3; break;
        case 'H3':  targetRA = ramc + dsa + 2 * nsa / 3; break;
      }
      targetRA = normalizeDegrees(targetRA);

      // Convert target RA to ecliptic longitude
      const targetRARad = degToRad(targetRA);
      const newLambda = normalizeDegrees(radToDeg(Math.atan2(
        Math.sin(targetRARad),
        Math.cos(targetRARad) * Math.cos(epsRad)
      )));

      if (Math.abs(normalizeDiffSigned(newLambda, lambda)) < 0.001) {
        return newLambda;
      }

      // Use the target RA for the next iteration
      ra = targetRA;
    }

    // Best estimate from last iteration
    const raRad = degToRad(ra);
    return normalizeDegrees(radToDeg(Math.atan2(
      Math.sin(raRad),
      Math.cos(raRad) * Math.cos(epsRad)
    )));
  }

  // Intermediate cusps
  houses[11] = solveCusp('H11');
  houses[12] = solveCusp('H12');
  houses[2]  = solveCusp('H2');
  houses[3]  = solveCusp('H3');

  // Opposite houses
  houses[5] = normalizeDegrees(houses[11] + 180);
  houses[6] = normalizeDegrees(houses[12] + 180);
  houses[8] = normalizeDegrees(houses[2] + 180);
  houses[9] = normalizeDegrees(houses[3] + 180);

  return houses;
}

// Helpers for angular differences
function normalizeDiff(a, b) {
  let d = a - b;
  if (d < 0) d += 360;
  return d;
}

function normalizeDiffSigned(a, b) {
  let d = a - b;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

// ─── ASPECTS ────────────────────────────────────────────────────

const ASPECT_TYPES = [
  { name: 'Conjunction',  angle: 0,   orbLum: 8, orbPlan: 6 },
  { name: 'Opposition',   angle: 180, orbLum: 8, orbPlan: 6 },
  { name: 'Trine',        angle: 120, orbLum: 8, orbPlan: 6 },
  { name: 'Square',       angle: 90,  orbLum: 7, orbPlan: 5 },
  { name: 'Sextile',      angle: 60,  orbLum: 5, orbPlan: 4 },
  { name: 'Quincunx',     angle: 150, orbLum: 2, orbPlan: 2 },
];

const LUMINARIES = new Set(['sun', 'moon']);

/**
 * Calculate all aspects between planets.
 *
 * @param {object} positions – { sun: { longitude }, moon: { longitude }, ... }
 * @returns {Array<{ planet1, planet2, type, angle, orb, applying }>}
 */
function calculateAspects(positions) {
  const aspects = [];
  const bodies = Object.keys(positions).filter(
    k => k !== 'northNode' && k !== 'southNode' // skip nodes for aspects
  );

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const p1 = bodies[i];
      const p2 = bodies[j];
      const lon1 = positions[p1].longitude;
      const lon2 = positions[p2].longitude;

      let diff = Math.abs(lon1 - lon2);
      if (diff > 180) diff = 360 - diff;

      const isLuminary = LUMINARIES.has(p1) || LUMINARIES.has(p2);

      for (const aspect of ASPECT_TYPES) {
        const maxOrb = isLuminary ? aspect.orbLum : aspect.orbPlan;
        const orb = Math.abs(diff - aspect.angle);

        if (orb <= maxOrb) {
          aspects.push({
            planet1: p1,
            planet2: p2,
            type: aspect.name,
            angle: Math.round(diff * 100) / 100,
            orb: Math.round(orb * 100) / 100,
          });
          break; // Only the closest aspect match per pair
        }
      }
    }
  }

  return aspects;
}

// ─── HOUSE PLACEMENT ────────────────────────────────────────────

/**
 * Determine which house a planet is in.
 *
 * @param {number} longitude – Planet longitude
 * @param {Object<number, number>} houses – House cusps 1–12
 * @returns {number} House number 1–12
 */
function getHouseForPlanet(longitude, houses) {
  const lon = normalizeDegrees(longitude);

  for (let h = 1; h <= 12; h++) {
    const nextH = h === 12 ? 1 : h + 1;
    const start = houses[h];
    const end = houses[nextH];

    // Handle wrap-around at 360°
    if (start <= end) {
      if (lon >= start && lon < end) return h;
    } else {
      if (lon >= start || lon < end) return h;
    }
  }
  return 1; // fallback
}

// ─── MAIN EXPORT ────────────────────────────────────────────────

/**
 * Calculate full Western Astrology chart.
 *
 * @param {object} positions – Planetary longitudes from Layer 2
 * @param {number} lat       – Birth latitude (+ North, − South)
 * @param {number} lng       – Birth longitude (+ East, − West)
 * @param {number} jdn       – Birth Julian Day Number
 * @returns {object} Complete astrology chart
 */
export function calculateAstrology(positions, lat, lng, jdn) {
  const eps = getObliquity(jdn);
  const lst = getLST(jdn, lng);

  // Houses
  const houses = calculatePlacidusHouses(lst, eps, lat);
  const ascendant = getSignFromLongitude(houses[1]);
  const midheaven = getSignFromLongitude(houses[10]);

  // Placements: zodiac sign + house for each planet
  const placements = {};
  for (const [body, data] of Object.entries(positions)) {
    const sign = getSignFromLongitude(data.longitude);
    const house = getHouseForPlanet(data.longitude, houses);
    placements[body] = { ...sign, house, longitude: data.longitude };
  }

  // Aspects
  const aspects = calculateAspects(positions);

  // House cusps with sign info
  const houseCusps = {};
  for (let h = 1; h <= 12; h++) {
    houseCusps[h] = {
      longitude: houses[h],
      ...getSignFromLongitude(houses[h])
    };
  }

  return {
    placements,
    houses: houseCusps,
    aspects,
    ascendant: { ...ascendant, longitude: houses[1] },
    midheaven: { ...midheaven, longitude: houses[10] },
    houseSystem: houses._system  || 'placidus',
    polarWarning: houses._warning || undefined
  };
}
