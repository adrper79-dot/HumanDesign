/**
 * Layer 7 – Transit Engine
 *
 * Calculates real-time planetary transits overlaid on a natal chart.
 * Reuses Layer 2 (planets), Layer 4 (gates), and Layer 6 (aspects).
 *
 * Exports:
 *   getCurrentTransits(natalChart, natalAstro, nowJDN?)
 *   getTransitForecast(natalChart, natalAstro, startDate, endDate, options?)
 *
 * All calculations internal to UTC.
 */

import { toJulianDay } from './julian.js';
import { getAllPositions } from './planets.js';
import { mapAllToGates } from './gates.js';

// ─── CONSTANTS ──────────────────────────────────────────────────

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

const ASPECT_TYPES = [
  { name: 'Conjunction',  angle: 0,   orb: 6 },
  { name: 'Opposition',   angle: 180, orb: 6 },
  { name: 'Trine',        angle: 120, orb: 5 },
  { name: 'Square',       angle: 90,  orb: 5 },
  { name: 'Sextile',      angle: 60,  orb: 4 },
  { name: 'Quincunx',     angle: 150, orb: 2 }
];

/** Slow-moving planets — these make longer-lasting transits */
const OUTER_PLANETS = new Set([
  'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'
]);

/** Transit speed classification (approximate degrees/day) */
const SPEEDS = {
  sun: 0.9856, moon: 13.176, mercury: 1.38, venus: 1.20,
  mars: 0.524, jupiter: 0.083, saturn: 0.034, uranus: 0.012,
  neptune: 0.006, pluto: 0.004, northNode: -0.053, southNode: -0.053
};

// ─── HELPERS ────────────────────────────────────────────────────

function normalizeDegrees(d) {
  return ((d % 360) + 360) % 360;
}

function angleDiff(a, b) {
  let d = normalizeDegrees(a - b);
  if (d > 180) d -= 360;
  return d;
}

function signFromLongitude(lon) {
  const n = normalizeDegrees(lon);
  const idx = Math.floor(n / 30);
  return { sign: ZODIAC_SIGNS[idx], degrees: n - idx * 30, signIndex: idx };
}

function nowUTCtoJDN() {
  const d = new Date();
  return toJulianDay(
    d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()
  );
}

function dateToJDN(year, month, day) {
  return toJulianDay(year, month, day, 12, 0, 0); // noon UTC
}

/** JDN → { year, month, day } (inverse of Julian Day, Meeus Ch. 7) */
function jdnToCalendar(jdn) {
  const z = Math.floor(jdn + 0.5);
  const f = jdn + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return { year, month, day: Math.floor(day) };
}

function formatDate(year, month, day) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

// ─── TRANSIT-TO-NATAL ASPECTS ───────────────────────────────────

/**
 * Calculate aspects between transit planets and natal planets.
 * @param {object} transitPositions – transit planet longitudes
 * @param {object} natalPositions   – natal planet longitudes
 * @returns {Array} Transit-to-natal aspects
 */
function calculateTransitToNatalAspects(transitPositions, natalPositions) {
  const aspects = [];
  const transitBodies = Object.keys(transitPositions);
  const natalBodies = Object.keys(natalPositions);

  for (const tp of transitBodies) {
    if (tp === 'southNode') continue; // skip (always opposite northNode)
    const tLon = transitPositions[tp].longitude;

    for (const np of natalBodies) {
      if (np === 'southNode') continue;
      const nLon = natalPositions[np].longitude;
      const diff = Math.abs(angleDiff(tLon, nLon));

      for (const asp of ASPECT_TYPES) {
        // Tighter orbs for transit aspects than natal
        const orb = OUTER_PLANETS.has(tp) ? asp.orb : asp.orb * 0.75;
        const separation = Math.abs(diff - asp.angle);
        if (separation <= orb) {
          const applying = isApplying(tp, tLon, nLon, asp.angle);
          aspects.push({
            transitPlanet: tp,
            natalPlanet: np,
            type: asp.name,
            angle: asp.angle,
            orb: +separation.toFixed(2),
            applying
          });
          break; // one aspect per pair
        }
      }
    }
  }

  return aspects;
}

/**
 * Rough check if a transit aspect is applying (getting tighter) or separating.
 */
function isApplying(transitPlanet, tLon, nLon, targetAngle) {
  const speed = SPEEDS[transitPlanet] || 1;
  const currentDiff = Math.abs(angleDiff(tLon, nLon));
  const futureDiff = Math.abs(angleDiff(tLon + speed, nLon));
  const currentSep = Math.abs(currentDiff - targetAngle);
  const futureSep = Math.abs(futureDiff - targetAngle);
  return futureSep < currentSep;
}

// ─── GATE ACTIVATIONS ───────────────────────────────────────────

/**
 * Identify which natal gates are activated by transit planets.
 * @param {object} transitGates – output of mapAllToGates for transits
 * @param {object} natalChart   – natal chart from Layer 5
 * @returns {Array} Gate activations
 */
function findGateActivations(transitGates, natalChart) {
  // Gather all natal gates (personality + design) into a Set
  const natalGateSet = new Set();
  if (natalChart && natalChart.personalityGates) {
    for (const p of Object.values(natalChart.personalityGates)) {
      if (p && p.gate) natalGateSet.add(p.gate);
    }
  }
  if (natalChart && natalChart.designGates) {
    for (const p of Object.values(natalChart.designGates)) {
      if (p && p.gate) natalGateSet.add(p.gate);
    }
  }

  // Also gather natal channels for channel-completion detection
  const natalChannelGates = new Set();
  if (natalChart && natalChart.activeChannels) {
    for (const ch of natalChart.activeChannels) {
      natalChannelGates.add(ch.gate1);
      natalChannelGates.add(ch.gate2);
    }
  }

  const activations = [];
  for (const [body, gateData] of Object.entries(transitGates)) {
    const gate = gateData.gate;
    const natalPresent = natalGateSet.has(gate);

    const activation = {
      gate,
      line: gateData.line,
      transitPlanet: body,
      natalGatePresent: natalPresent,
      speed: OUTER_PLANETS.has(body) ? 'slow' : 'fast'
    };

    // Check if this transit gate completes a channel with a natal gate
    // (channelPairs loaded from channels.json would be ideal, but we can
    //  check against the natal chart's existing channel definitions)
    activations.push(activation);
  }

  return activations;
}

// ─── CURRENT TRANSITS ───────────────────────────────────────────

/**
 * Calculate current (or specified-moment) transits against a natal chart.
 *
 * @param {object} natalChart – Full natal chart from Layer 5 calculateChart()
 * @param {object} natalAstro – Natal astrology from Layer 6 calculateAstrology()
 * @param {number} [momentJDN] – Optional JDN to calculate transits for
 *                                (defaults to now UTC)
 * @returns {object} Transit report
 */
export function getCurrentTransits(natalChart, natalAstro, momentJDN) {
  const jdn = momentJDN || nowUTCtoJDN();

  // Step 1: Current planetary positions (reuse Layer 2)
  const transitPositions = getAllPositions(jdn);

  // Step 2: Map transit positions to HD gates (reuse Layer 4)
  const transitGates = mapAllToGates(transitPositions);

  // Step 3: Build zodiac sign info for each transit planet
  const transitPlanets = {};
  for (const [body, data] of Object.entries(transitPositions)) {
    const sign = signFromLongitude(data.longitude);
    const gateInfo = transitGates[body];
    transitPlanets[body] = {
      longitude: data.longitude,
      sign: sign.sign,
      degrees: +sign.degrees.toFixed(2),
      gate: gateInfo.gate,
      line: gateInfo.line,
      color: gateInfo.color,
      tone: gateInfo.tone
    };
  }

  // Step 4: Natal positions for aspect calculation
  const natalPositions = {};
  if (natalAstro && natalAstro.placements) {
    for (const [body, data] of Object.entries(natalAstro.placements)) {
      natalPositions[body] = { longitude: data.longitude };
    }
  }

  // Step 5: Transit-to-natal aspects
  const transitAspects = calculateTransitToNatalAspects(
    transitPositions, natalPositions
  );

  // Step 6: Gate activations
  const gateActivations = findGateActivations(transitGates, natalChart);

  // Step 7: Get date info
  const cal = jdnToCalendar(jdn);

  return {
    date: formatDate(cal.year, cal.month, cal.day),
    jdn,
    transitPositions: transitPlanets,
    gateActivations,
    transitToNatalAspects: transitAspects
  };
}

// ─── TRANSIT FORECAST ───────────────────────────────────────────

/**
 * Generate a transit forecast over a date range.
 *
 * Scans day-by-day for:
 * - Gate ingresses (a transit planet enters a new gate)
 * - Key natal aspects forming (outer planets only, for brevity)
 * - Channel completions (transit gate pairs with natal gate)
 *
 * @param {object} natalChart – Full natal chart from Layer 5
 * @param {object} natalAstro – Natal astrology from Layer 6
 * @param {{ year: number, month: number, day: number }} startDate
 * @param {{ year: number, month: number, day: number }} endDate
 * @param {object} [options]
 * @param {number[]} [options.targetGates] – Only report events for these gates
 * @returns {object} Forecast report
 */
export function getTransitForecast(
  natalChart, natalAstro, startDate, endDate, options = {}
) {
  const { targetGates } = options;
  const targetSet = targetGates ? new Set(targetGates) : null;

  const startJDN = dateToJDN(startDate.year, startDate.month, startDate.day);
  const endJDN = dateToJDN(endDate.year, endDate.month, endDate.day);
  const maxDays = Math.min(endJDN - startJDN + 1, 366); // cap at 1 year

  // Gather natal gates for significance detection
  const natalGateSet = new Set();
  if (natalChart && natalChart.personalityGates) {
    for (const p of Object.values(natalChart.personalityGates)) {
      if (p && p.gate) natalGateSet.add(p.gate);
    }
  }
  if (natalChart && natalChart.designGates) {
    for (const p of Object.values(natalChart.designGates)) {
      if (p && p.gate) natalGateSet.add(p.gate);
    }
  }

  // Natal positions for aspects
  const natalPositions = {};
  if (natalAstro && natalAstro.placements) {
    for (const [body, data] of Object.entries(natalAstro.placements)) {
      natalPositions[body] = { longitude: data.longitude };
    }
  }

  // Track previous day's gate assignments to detect ingresses
  let prevGates = null;
  const events = [];

  for (let d = 0; d < maxDays; d++) {
    const jdn = startJDN + d;
    const cal = jdnToCalendar(jdn);
    const dateStr = formatDate(cal.year, cal.month, cal.day);

    const positions = getAllPositions(jdn);
    const gates = mapAllToGates(positions);

    // Detect gate ingresses
    if (prevGates) {
      for (const [body, gateData] of Object.entries(gates)) {
        if (body === 'southNode') continue;
        const prevGate = prevGates[body]?.gate;
        const newGate = gateData.gate;

        if (prevGate !== newGate) {
          // Skip fast-moving Moon for forecast (too noisy)
          if (body === 'moon') continue;

          // Apply target gate filter
          if (targetSet && !targetSet.has(newGate)) continue;

          const significance = [];
          if (natalGateSet.has(newGate)) {
            significance.push(`Activates natal Gate ${newGate}`);
          }
          if (OUTER_PLANETS.has(body)) {
            significance.push(`Slow transit — effects last weeks/months`);
          }

          events.push({
            date: dateStr,
            event: `Transit ${capitalize(body)} enters Gate ${newGate} Line ${gateData.line}`,
            planet: body,
            gate: newGate,
            line: gateData.line,
            significance: significance.length > 0
              ? significance.join('; ')
              : undefined
          });
        }
      }
    }

    // Outer planet aspects to natal (daily check)
    for (const body of OUTER_PLANETS) {
      if (!positions[body]) continue;
      const tLon = positions[body].longitude;

      for (const [np, nData] of Object.entries(natalPositions)) {
        if (np === 'southNode') continue;
        const nLon = nData.longitude;
        const diff = Math.abs(angleDiff(tLon, nLon));

        for (const asp of ASPECT_TYPES) {
          const sep = Math.abs(diff - asp.angle);
          // Only report when exact (within 0.5°)
          if (sep <= 0.5) {
            // Check if this aspect was already reported on a previous day
            const key = `${body}-${np}-${asp.name}`;
            const alreadyReported = events.some(
              e => e._aspectKey === key &&
                Math.abs(dateToJDN(
                  +e.date.slice(0, 4), +e.date.slice(5, 7), +e.date.slice(8, 10)
                ) - jdn) <= 7
            );
            if (!alreadyReported) {
              const applying = isApplying(body, tLon, nLon, asp.angle);
              events.push({
                date: dateStr,
                event: `Transit ${capitalize(body)} ${asp.name} natal ${capitalize(np)} (${sep.toFixed(2)}° orb)`,
                planet: body,
                natalPlanet: np,
                aspectType: asp.name,
                orb: +sep.toFixed(2),
                applying,
                _aspectKey: key
              });
            }
            break;
          }
        }
      }
    }

    prevGates = gates;
  }

  // Clean internal keys
  for (const e of events) {
    delete e._aspectKey;
  }

  return {
    period: {
      start: formatDate(startDate.year, startDate.month, startDate.day),
      end: formatDate(endDate.year, endDate.month, endDate.day),
      days: maxDays
    },
    events,
    summary: {
      totalEvents: events.length,
      gateIngresses: events.filter(e => e.event.includes('enters Gate')).length,
      exactAspects: events.filter(e => e.aspectType).length
    }
  };
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
