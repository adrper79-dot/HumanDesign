/**
 * Layer 2: All Planetary Positions
 *
 * Computes geocentric ecliptic longitudes for all bodies needed
 * by Human Design and Western Astrology:
 *   Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn,
 *   Uranus, Neptune, Pluto, North Node, South Node
 *
 * Methods:
 *   Sun:            Meeus Ch. 25 (via julian.js)
 *   Moon:           Meeus Ch. 47 (~50 periodic terms, <0.3° accuracy)
 *   Mercury–Pluto:  JPL Keplerian elements (Standish 1992) + Kepler solver
 *   North Node:     Meeus mean ascending node + major periodic corrections
 *   South Node:     North Node + 180°
 *
 * All pure JS for Cloudflare Workers (V8 isolate). No external dependencies.
 *
 * Verification anchor: AP — Aug 5, 1979, 22:51 UTC
 */

import { getSunLongitude, normalizeDegrees, degToRad, radToDeg } from './julian.js';

// ─── CONSTANTS ──────────────────────────────────────────────────

const J2000 = 2451545.0;

// ─── JPL Keplerian Elements (Standish 1992) ─────────────────────
// Valid ~1800–2050. Values at J2000.0 epoch, rates per Julian century.
// a = semi-major axis (AU), e = eccentricity, I = inclination (deg),
// L = mean longitude (deg), w = longitude of perihelion (deg),
// O = longitude of ascending node (deg).
// Each property is [value_at_J2000, rate_per_century].

const ELEMENTS = {
  // Note: Earth uses getEarthPosition() (Meeus solar theory) rather than
  // Keplerian elements — more accurate for the Earth-Sun distance and longitude.
  mercury: {
    a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906],
    I: [7.00497902, -0.00594749], L: [252.25032350, 149472.67411175],
    w: [77.45779628, 0.16047689],  O: [48.33076593, -0.12534081]
  },
  venus: {
    a: [0.72333566, 0.00000390], e: [0.00677672, -0.00004107],
    I: [3.39467605, -0.00078890], L: [181.97909950, 58517.81538729],
    w: [131.60246718, 0.00268329], O: [76.67984255, -0.27769418]
  },
  mars: {
    a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882],
    I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499],
    w: [-23.94362959, 0.44441088], O: [49.55953891, -0.29257343]
  },
  jupiter: {
    a: [5.20288700, -0.00011607], e: [0.04838624, -0.00013253],
    I: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775],
    w: [14.72847983, 0.21252668],  O: [100.47390909, 0.20469106]
  },
  saturn: {
    a: [9.53667594, -0.00125060], e: [0.05386179, -0.00050991],
    I: [2.48599187, 0.00193609],  L: [49.95424423, 1222.49362201],
    w: [92.59887831, -0.41897216], O: [113.66242448, -0.28867794]
  },
  uranus: {
    a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397],
    I: [0.77263783, -0.00242939],  L: [313.23810451, 428.48202785],
    w: [170.95427630, 0.40805281], O: [74.01692503, 0.04240589]
  },
  neptune: {
    a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105],
    I: [1.77004347, 0.00035372],  L: [-55.12002969, 218.45945325],
    w: [44.96476227, -0.32241464], O: [131.78422574, -0.00508664]
  },
  pluto: {
    a: [39.48211675, -0.00031596], e: [0.24882730, 0.00005170],
    I: [17.14001206, 0.00004818],  L: [238.92903833, 145.20780515],
    w: [224.06891629, -0.04062942], O: [110.30393684, -0.01183482]
  },
  // BL-R-M3: Chiron (2060) — centaur, ~50.7 yr orbit, needed for Chiron Return cycle
  // Elements from JPL HORIZONS at J2000.0 epoch; rates approximate for 1900–2100
  chiron: {
    a: [13.64838, 0.0],            e: [0.37911, 0.0],
    I: [6.93500, 0.0],             L: [25.94, 713.86],
    w: [339.571, 0.0132],          O: [209.253, -0.0094]
  }
};

// ─── KEPLER EQUATION SOLVER ─────────────────────────────────────

/**
 * Solve Kepler's equation  E - e·sin(E) = M  via Newton-Raphson.
 * Converges in <10 iterations for all planetary eccentricities.
 *
 * @param {number} M_rad – Mean anomaly in radians
 * @param {number} e     – Orbital eccentricity
 * @returns {number} Eccentric anomaly in radians
 */
function solveKepler(M_rad, e) {
  let E = M_rad + e * Math.sin(M_rad); // initial guess (better than E=M for high e)
  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - M_rad) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

// ─── EARTH'S HELIOCENTRIC POSITION ─────────────────────────────
// Derived from the same Meeus Ch. 25 constants used for the Sun.
// More accurate than JPL Keplerian elements for Earth because
// it matches julian.js Sun output exactly.

/**
 * Get Earth's heliocentric ecliptic rectangular coordinates.
 * Uses Meeus solar theory: Earth lon = Sun lon + 180° (geometric).
 *
 * @param {number} T – Julian centuries from J2000.0
 * @returns {{ x: number, y: number, r: number, lon: number }}
 */
function getEarthPosition(T) {
  // Geometric mean longitude of the Sun (= Earth + 180°)
  let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  L0 = normalizeDegrees(L0);

  // Mean anomaly
  let M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  M = normalizeDegrees(M);
  const Mrad = degToRad(M);

  // Equation of center
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);

  // Sun's TRUE longitude (no aberration/nutation — geometric)
  const sunTrueLon = normalizeDegrees(L0 + C);

  // Earth's eccentricity
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;

  // True anomaly
  const v = degToRad(normalizeDegrees(M + C));

  // Earth–Sun distance
  const r = 1.000001018 * (1 - e * e) / (1 + e * Math.cos(v));

  // Earth's heliocentric longitude = Sun + 180°
  const earthLon = normalizeDegrees(sunTrueLon + 180);
  const lonRad = degToRad(earthLon);

  return {
    x: r * Math.cos(lonRad),
    y: r * Math.sin(lonRad),
    r,
    lon: earthLon
  };
}

// ─── HELIOCENTRIC POSITION FROM KEPLERIAN ELEMENTS ──────────────

/**
 * Get heliocentric ecliptic rectangular coordinates for a planet.
 *
 * @param {number} T    – Julian centuries from J2000.0
 * @param {object} elem – Orbital element set from ELEMENTS
 * @returns {{ x: number, y: number, z: number, lon: number, r: number }}
 */
function getHelioPosition(T, elem) {
  const a = elem.a[0] + elem.a[1] * T;
  const e = elem.e[0] + elem.e[1] * T;
  const I = elem.I[0] + elem.I[1] * T;
  const L = normalizeDegrees(elem.L[0] + elem.L[1] * T);
  const w = normalizeDegrees(elem.w[0] + elem.w[1] * T);
  const O = normalizeDegrees(elem.O[0] + elem.O[1] * T);

  // Mean anomaly
  const M_deg = normalizeDegrees(L - w);
  const M_rad = degToRad(M_deg);

  // Solve Kepler
  const E = solveKepler(M_rad, e);

  // True anomaly
  const sinV = Math.sqrt(1 - e * e) * Math.sin(E) / (1 - e * Math.cos(E));
  const cosV = (Math.cos(E) - e) / (1 - e * Math.cos(E));
  const v = Math.atan2(sinV, cosV);

  // Heliocentric distance
  const r = a * (1 - e * Math.cos(E));

  // Argument of perihelion  (ω = ω̃ − Ω)
  const omega = degToRad(normalizeDegrees(w - O));

  // Convert from orbital plane to ecliptic coordinates
  const iRad = degToRad(I);
  const ORad = degToRad(O);

  const u = v + omega; // argument of latitude
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);
  const cosI = Math.cos(iRad);
  const cosO = Math.cos(ORad);
  const sinO = Math.sin(ORad);

  const x = r * (cosO * cosU - sinO * sinU * cosI);
  const y = r * (sinO * cosU + cosO * sinU * cosI);
  const z = r * sinU * Math.sin(iRad);

  const lon = normalizeDegrees(radToDeg(Math.atan2(y, x)));

  return { x, y, z, lon, r };
}

// ─── GEOCENTRIC CONVERSION ──────────────────────────────────────

/**
 * Convert heliocentric rectangular to geocentric ecliptic longitude.
 *
 * @param {{ x: number, y: number }} planet – heliocentric rectangular
 * @param {{ x: number, y: number }} earth  – heliocentric rectangular
 * @returns {number} Geocentric ecliptic longitude 0–360°
 */
function toGeocentric(planet, earth) {
  const dx = planet.x - earth.x;
  const dy = planet.y - earth.y;
  return normalizeDegrees(radToDeg(Math.atan2(dy, dx)));
}

// ─── MOON  (Meeus Ch. 47) ───────────────────────────────────────

/**
 * Calculate the Moon's geocentric ecliptic longitude.
 * Uses the 50 largest periodic terms from Meeus Table 47.A.
 * Accuracy: better than 0.3° — sufficient for HD line-level precision.
 *
 * @param {number} T – Julian centuries from J2000.0
 * @returns {number} Moon ecliptic longitude 0–360°
 */
function getMoonLongitude(T) {
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;

  // Fundamental arguments (Meeus eq. 47.1–47.5)
  const Lp = normalizeDegrees(
    218.3164477 + 481267.88123421 * T - 0.0015786 * T2
    + T3 / 538841 - T4 / 65194000
  );
  const D = normalizeDegrees(
    297.8501921 + 445267.1114034 * T - 0.0018819 * T2
    + T3 / 545868 - T4 / 113065000
  );
  const M = normalizeDegrees(
    357.5291092 + 35999.0502909 * T - 0.0001536 * T2
    + T3 / 24490000
  );
  const Mp = normalizeDegrees(
    134.9633964 + 477198.8675055 * T + 0.0087414 * T2
    + T3 / 69699 - T4 / 14712000
  );
  const F = normalizeDegrees(
    93.2720950 + 483202.0175233 * T - 0.0036539 * T2
    - T3 / 3526000 + T4 / 863310000
  );

  // Eccentricity correction for terms involving Sun's anomaly
  const E  = 1 - 0.002516 * T - 0.0000074 * T2;
  const E2 = E * E;

  const Dr = degToRad(D);
  const Mr = degToRad(M);
  const Mpr = degToRad(Mp);
  const Fr = degToRad(F);

  // Table 47.A — [D_mult, M_mult, Mp_mult, F_mult, sinCoeff (×10⁻⁶ °)]
  const LON_TERMS = [
    [0,  0,  1,  0,  6288774],
    [2,  0, -1,  0,  1274027],
    [2,  0,  0,  0,   658314],
    [0,  0,  2,  0,   213618],
    [0,  1,  0,  0,  -185116],
    [0,  0,  0,  2,  -114332],
    [2,  0, -2,  0,    58793],
    [2, -1, -1,  0,    57066],
    [2,  0,  1,  0,    53322],
    [2, -1,  0,  0,    45758],
    [0,  1, -1,  0,   -40923],
    [1,  0,  0,  0,   -34720],
    [0,  1,  1,  0,   -30383],
    [2,  0,  0, -2,    15327],
    [0,  0,  1,  2,   -12528],
    [0,  0,  1, -2,    10980],
    [4,  0, -1,  0,    10675],
    [0,  0,  3,  0,    10034],
    [4,  0, -2,  0,     8548],
    [2,  1, -1,  0,    -7888],
    [2,  1,  0,  0,    -6766],
    [1,  0, -1,  0,    -5163],
    [1,  1,  0,  0,     4987],
    [2, -1,  1,  0,     4036],
    [2,  0,  2,  0,     3994],
    [4,  0,  0,  0,     3861],
    [2,  0, -3,  0,     3665],
    [0,  1, -2,  0,    -2689],
    [2,  0, -1,  2,    -2602],
    [2, -1, -2,  0,     2390],
    [1,  0,  1,  0,    -2348],
    [2, -2,  0,  0,     2236],
    [0,  1,  2,  0,    -2120],
    [0,  2,  0,  0,    -2069],
    [2, -2, -1,  0,     2048],
    [2,  0,  1, -2,    -1773],
    [2,  0,  0,  2,    -1595],
    [4, -1, -1,  0,     1215],
    [0,  0,  2,  2,    -1110],
    [3,  0, -1,  0,     -892],
    [2,  1,  1,  0,     -810],
    [4, -1, -2,  0,      759],
    [0,  2, -1,  0,     -713],
    [2,  2, -1,  0,     -700],
    [2,  1, -2,  0,      691],
    [2, -1,  0, -2,      596],
    [4,  0,  1,  0,      549],
    [0,  0,  4,  0,      537],
    [4, -1,  0,  0,      520],
    [1,  0, -2,  0,     -487],
  ];

  let sumL = 0;
  for (const [d, m, mp, f, coeff] of LON_TERMS) {
    const arg = d * Dr + m * Mr + mp * Mpr + f * Fr;
    let term = coeff * Math.sin(arg);
    // E correction for solar-anomaly terms
    const absM = Math.abs(m);
    if (absM === 1) term *= E;
    else if (absM === 2) term *= E2;
    sumL += term;
  }

  // Additional corrections (Venus A1, Jupiter A2, flattening A3)
  const A1 = degToRad(normalizeDegrees(119.75 + 131.849 * T));
  const A2 = degToRad(normalizeDegrees(53.09 + 479264.290 * T));
  const A3 = degToRad(normalizeDegrees(313.45 + 481266.484 * T));

  sumL += 3958 * Math.sin(A1)
        + 1962 * Math.sin(degToRad(Lp) - Fr)
        + 318  * Math.sin(A2);

  // Final longitude (sumL is in 10⁻⁶ degrees)
  return normalizeDegrees(Lp + sumL / 1e6);
}

// ─── TRUE NORTH NODE ────────────────────────────────────────────

/**
 * Calculate the Moon's True Node longitude.
 * Mean node (Meeus eq. 47.7) with the 5 largest nutation terms.
 * Accuracy: ~0.5° — sufficient for HD gate-level precision.
 *
 * @param {number} T – Julian centuries from J2000.0
 * @returns {number} True North Node longitude 0–360°
 */
function getNorthNodeLongitude(T) {
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;

  // Mean longitude of ascending node (Meeus eq. 47.7)
  let omega = 125.0445479 - 1934.1362891 * T
    + 0.0020754 * T2 + T3 / 467441 - T4 / 60616000;

  // Periodic corrections for true node (largest terms)
  const D  = degToRad(normalizeDegrees(297.8501921 + 445267.1114034 * T));
  const Ms = degToRad(normalizeDegrees(357.5291092 + 35999.0502909 * T));
  const Mp = degToRad(normalizeDegrees(134.9633964 + 477198.8675055 * T));
  const F  = degToRad(normalizeDegrees(93.2720950 + 483202.0175233 * T));

  omega += -1.4979 * Math.sin(2 * (D - F))
         - 0.1500 * Math.sin(Ms)
         - 0.1226 * Math.sin(2 * D)
         + 0.1176 * Math.sin(2 * F)
         - 0.0801 * Math.sin(2 * (Mp - F));

  return normalizeDegrees(omega);
}

// ─── MAIN EXPORT ────────────────────────────────────────────────

/**
 * Compute geocentric ecliptic longitudes for all celestial bodies
 * used by Human Design and Western Astrology.
 *
 * @param {number} jdn – Julian Day Number (from Layer 1)
 * @returns {Object} Keyed by body name, each with { longitude: number }
 *
 * @example
 *   const pos = getAllPositions(2444091.4521);
 *   pos.sun.longitude      // ~132.91  (Gate 33 with wheel offset)
 *   pos.moon.longitude     // Aquarius range
 *   pos.jupiter.longitude  // Leo range
 */
export function getAllPositions(jdn) {
  const T = (jdn - J2000) / 36525;

  // Precession correction: convert J2000 ecliptic to ecliptic of date
  // General precession in longitude ≈ 50.29"/yr = 1.3972°/century
  const precessionCorr = 1.3972 * T;

  // Sun (Meeus Ch. 25 — already verified in Layer 1, ecliptic of date)
  const sunLon = getSunLongitude(jdn);

  // Earth's heliocentric position — Meeus solar theory (more accurate than
  // Keplerian elements for Earth because it uses the full equation of center)
  const earth = getEarthPosition(T); // BL-R-M5

  // Moon (direct geocentric — Meeus Ch. 47, ecliptic of date)
  const moonLon = getMoonLongitude(T);

  // Nodes (Meeus, ecliptic of date)
  const northNodeLon = getNorthNodeLongitude(T);
  const southNodeLon = normalizeDegrees(northNodeLon + 180);

  // Build result
  const result = {
    sun:       { longitude: sunLon },
    moon:      { longitude: moonLon },
    northNode: { longitude: northNodeLon },
    southNode: { longitude: southNodeLon }
  };

  // All Keplerian planets: Mercury through Pluto
  // Computed in J2000 frame, then precessed to ecliptic of date
  const planetNames = [
    'mercury', 'venus', 'mars', 'jupiter',
    'saturn', 'uranus', 'neptune', 'pluto', 'chiron'
  ];

  for (const name of planetNames) {
    const helio = getHelioPosition(T, ELEMENTS[name]);
    const geoLon = toGeocentric(helio, earth);
    // Apply precession correction from J2000 → ecliptic of date
    result[name] = { longitude: normalizeDegrees(geoLon + precessionCorr) };
  }

  return result;
}
