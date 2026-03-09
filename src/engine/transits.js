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

import { toJulianDay, normalizeDegrees } from './julian.js';  // BL-R-M17: import shared utility
import { getAllPositions } from './planets.js';
import { mapAllToGates } from './gates.js';
import { jdnToCalendar } from './design.js';                  // BL-R-M17: import shared utility
import { getSignFromLongitude } from './astro.js';             // BL-R-M17: import shared utility
import { ASPECT_TYPES, OUTER_PLANETS, PLANET_SPEEDS } from './constants.js';  // BL-S18-H1: shared constants

// ─── CONSTANTS ──────────────────────────────────────────────────
// ASPECT_TYPES, OUTER_PLANETS, PLANET_SPEEDS imported from constants.js

// Alias for backward compatibility
const SPEEDS = PLANET_SPEEDS;

// ─── HELPERS ────────────────────────────────────────────────────

function angleDiff(a, b) {
  let d = normalizeDegrees(a - b);
  if (d > 180) d -= 360;
  return d;
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
      // BL-FIX: Use ch.gates[0]/ch.gates[1] per chart.js structure, not ch.gate1/ch.gate2
      natalChannelGates.add(ch.gates?.[0]);
      natalChannelGates.add(ch.gates?.[1]);
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
    const sign = getSignFromLongitude(data.longitude);
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
// ─── LONG-ARC LIFE CYCLES ───────────────────────────────────────

/**
 * Calculate major life cycles for a given natal chart.
 * Returns upcoming cycle events (returns, oppositions, squares).
 * 
 * @param {object} natalPositions - Natal planet positions (from chart.astrology)
 * @param {number} natalJDN - Natal Julian Day Number
 * @param {object} options - { lookAheadYears: number }
 * @returns {Array} Cycle events with dates and descriptions
 */
export function calculateLifeCycles(natalPositions, natalJDN, options = {}) {
  const lookAheadYears = options.lookAheadYears || 5; // Default 5-year window
  const nowJDN = nowUTCtoJDN();
  const ageYears = (nowJDN - natalJDN) / 365.25;
  
  const cycles = [];

  // Define major cycle periods (in years)
  const CYCLE_DEFINITIONS = [
    // Saturn Cycle (~29.5 years)
    {
      planet: 'saturn',
      name: 'Saturn Return',
      period: 29.46,
      type: 'return',
      description: 'Major life restructuring, maturity milestone, career evaluation',
      intensity: 'transformative',
      orb: 2 // years before/after to show "approaching"
    },
    {
      planet: 'saturn',
      name: 'Saturn Square',
      period: 29.46,
      type: 'square',
      phase: [7.365, 14.73, 22.095], // quarters of cycle
      description: 'Challenge period, course corrections needed',
      intensity: 'challenging',
      orb: 1
    },
    {
      planet: 'saturn',
      name: 'Saturn Opposition',
      period: 29.46,
      type: 'opposition',
      phase: [14.73],
      description: 'Mid-cycle crisis, reevaluation of life direction',
      intensity: 'pivotal',
      orb: 1.5
    },

    // Jupiter Cycle (~11.86 years)
    {
      planet: 'jupiter',
      name: 'Jupiter Return',
      period: 11.86,
      type: 'return',
      description: 'Expansion cycle, new opportunities, growth phase',
      intensity: 'opportunistic',
      orb: 0.5
    },

    // Uranus Opposition (~42 years - "Mid-life Crisis")
    {
      planet: 'uranus',
      name: 'Uranus Opposition',
      period: 84,
      type: 'opposition',
      phase: [42],
      description: 'Mid-life awakening, radical life changes, authenticity push',
      intensity: 'revolutionary',
      orb: 2
    },
    {
      planet: 'uranus',
      name: 'Uranus Square',
      period: 84,
      type: 'square',
      phase: [21, 63],
      description: 'Breakthrough or breakdown, rebellion against constraints',
      intensity: 'disruptive',
      orb: 1.5
    },

    // Chiron Return (~50 years - "Wounded Healer")
    {
      planet: 'chiron',
      name: 'Chiron Return',
      period: 50.76,
      type: 'return',
      description: 'Healing mastery, teaching others from your wounds, spiritual maturity',
      intensity: 'healing',
      orb: 2
    },

    // Neptune (slower cycles - less common)
    {
      planet: 'neptune',
      name: 'Neptune Square',
      period: 164,
      type: 'square',
      phase: [41],
      description: 'Spiritual disillusionment or awakening, dissolving old dreams',
      intensity: 'mystical',
      orb: 2
    },

    // Pluto Square (~40-45 years depending on orbit)
    {
      planet: 'pluto',
      name: 'Pluto Square',
      period: 248,
      type: 'square',
      phase: [40],
      description: 'Deep transformation, power struggles, rebirth',
      intensity: 'transformative',
      orb: 2
    }
  ];

  // Calculate each cycle
  for (const cycleDef of CYCLE_DEFINITIONS) {
    const { planet, name, period, type, phase, description, intensity, orb } = cycleDef;
    
    // Skip if natal chart doesn't have this planet
    if (!natalPositions[planet]) continue;

    const natalLon = natalPositions[planet].longitude;

    // Calculate cycle occurrences
    if (type === 'return') {
      // Returns happen every 'period' years
      const numReturns = Math.ceil((ageYears + lookAheadYears) / period);
      
      for (let i = 1; i <= numReturns; i++) {
        const returnAge = period * i;
        const returnJDN = natalJDN + (returnAge * 365.25);
        const returnDate = jdnToCalendar(returnJDN);
        const yearsUntil = returnAge - ageYears;

        // Only show if within lookAhead window or recently passed
        if (yearsUntil >= -0.5 && yearsUntil <= lookAheadYears) {
          const status = yearsUntil < 0 
            ? 'recent'
            : yearsUntil < orb 
              ? 'approaching' 
              : 'upcoming';

          cycles.push({
            planet,
            cycle: name,
            type: 'return',
            occurrence: i,
            date: formatDate(returnDate.year, returnDate.month, returnDate.day),
            ageAtCycle: Math.round(returnAge * 10) / 10,
            yearsUntil: Math.round(yearsUntil * 10) / 10,
            status,
            intensity,
            description,
            guidance: getCycleGuidance(planet, type, status)
          });
        }
      }
    } 
    else if (type === 'opposition' || type === 'square') {
      // These happen at specific phases of the cycle
      const phases = phase || [];
      
      for (const phaseAge of phases) {
        // Calculate how many full cycles until this phase
        const cycleNumber = Math.floor(ageYears / period);
        const nextPhaseAge = (cycleNumber * period) + phaseAge;
        const followingPhaseAge = ((cycleNumber + 1) * period) + phaseAge;

        for (const targetAge of [nextPhaseAge, followingPhaseAge]) {
          const phaseJDN = natalJDN + (targetAge * 365.25);
          const phaseDate = jdnToCalendar(phaseJDN);
          const yearsUntil = targetAge - ageYears;

          if (yearsUntil >= -0.5 && yearsUntil <= lookAheadYears) {
            const status = yearsUntil < 0 
              ? 'recent'
              : yearsUntil < orb 
                ? 'approaching' 
                : 'upcoming';

            cycles.push({
              planet,
              cycle: name,
              type,
              date: formatDate(phaseDate.year, phaseDate.month, phaseDate.day),
              ageAtCycle: Math.round(targetAge * 10) / 10,
              yearsUntil: Math.round(yearsUntil * 10) / 10,
              status,
              intensity,
              description,
              guidance: getCycleGuidance(planet, type, status)
            });
          }
        }
      }
    }
  }

  // Sort by yearsUntil (soonest first)
  cycles.sort((a, b) => a.yearsUntil - b.yearsUntil);

  // Add current age context
  const summary = {
    currentAge: Math.round(ageYears * 10) / 10,
    upcomingCycles: cycles.filter(c => c.status === 'approaching' || c.status === 'upcoming').length,
    activeCycles: cycles.filter(c => c.status === 'approaching').length,
    recentCycles: cycles.filter(c => c.status === 'recent').length,
    nextMajorCycle: cycles.find(c => c.intensity === 'transformative' || c.intensity === 'revolutionary') || null
  };

  return {
    summary,
    cycles
  };
}

/**
 * Get actionable guidance for each cycle type
 */
function getCycleGuidance(planet, type, status) {
  const guidance = {
    saturn: {
      return: {
        approaching: 'Prepare for major life restructuring. Review commitments, release what no longer serves.',
        upcoming: 'A 2-3 year period of maturation and responsibility consolidation is ahead.',
        recent: 'Integrate lessons learned. New structures are forming.'
      },
      opposition: {
        approaching: 'Mid-cycle evaluation time. What needs to change?',
        upcoming: 'A pivotal reassessment of life direction approaches.',
        recent: 'Course corrections are being implemented.'
      },
      square: {
        approaching: 'Tension building. Address unresolved issues now.',
        upcoming: 'A challenging period requiring persistence and discipline.',
        recent: 'Obstacles were growth opportunities in disguise.'
      }
    },
    jupiter: {
      return: {
        approaching: 'Expansion phase beginning. Say yes to opportunities.',
        upcoming: 'A year of growth, learning, and new possibilities.',
        recent: 'Integrate new wisdom and experiences gained.'
      }
    },
    uranus: {
      opposition: {
        approaching: 'Mid-life awakening approaching. Embrace authentic self.',
        upcoming: 'Prepare for radical changes. Freedom vs. security themes.',
        recent: 'Life has been revolutionized. Find new stability.'
      },
      square: {
        approaching: 'Breakthrough moment coming. Question everything.',
        upcoming: 'Rebellion against constraints. Innovation required.',
        recent: 'Liberation achieved. Integrate sudden changes.'
      }
    },
    chiron: {
      return: {
        approaching: 'Your wounds become your medicine. Prepare to teach.',
        upcoming: 'A period of deep healing and spiritual maturity.',
        recent: 'You are now the wounded healer. Share your gifts.'
      }
    },
    neptune: {
      square: {
        approaching: 'Spiritual crossroads ahead. Surrender or confusion?',
        upcoming: 'Dreams dissolve or transform. Trust the process.',
        recent: 'Illusions cleared. New vision emerging.'
      }
    },
    pluto: {
      square: {
        approaching: 'Transformation accelerating. Release control.',
        upcoming: 'Death and rebirth cycle. Power dynamics shift.',
        recent: 'You are reborn. Claim your power.'
      }
    }
  };

  return guidance[planet]?.[type]?.[status] || 'Navigate this cycle with awareness and intention.';
}