/**
 * Vedic Astrology (Jyotish) Overlay Engine
 *
 * Computes a Vedic/sidereal overlay from the existing tropical positions.
 * Uses the Lahiri (Chitrapaksha) Ayanamsha — the most widely used standard.
 *
 * What this adds to the chart:
 *   - Ayanamsha for the birth date (sidereal offset from tropical)
 *   - Sidereal (Rashi) signs for all planets
 *   - Moon nakshatra (one of 27 lunar mansions) + pada (quarter 1-4)
 *   - Lagna (Ascendant) in sidereal signs
 *   - Vimshottari Dasha: the 120-year planetary period cycle
 *     - Birth dasha lord + balance at birth
 *     - Full dasha sequence from birth
 *     - Current major dasha period + years remaining
 *
 * No additional intake data required. Derived from existing birthPositions + jdn.
 *
 * @module vedic
 */

const J2000 = 2451545.0;

// ─── Western → Vedic sign names ────────────────────────────────
const RASHI = [
  'Mesha (Aries)', 'Vrishabha (Taurus)', 'Mithuna (Gemini)',
  'Karka (Cancer)', 'Simha (Leo)', 'Kanya (Virgo)',
  'Tula (Libra)', 'Vrischika (Scorpio)', 'Dhanus (Sagittarius)',
  'Makara (Capricorn)', 'Kumbha (Aquarius)', 'Meena (Pisces)',
];

// ─── 27 Nakshatras with Vimshottari dasha lords ────────────────
const NAKSHATRAS = [
  { name: 'Ashwini',           lord: 'ketu'    },
  { name: 'Bharani',           lord: 'venus'   },
  { name: 'Krittika',          lord: 'sun'     },
  { name: 'Rohini',            lord: 'moon'    },
  { name: 'Mrigashira',        lord: 'mars'    },
  { name: 'Ardra',             lord: 'rahu'    },
  { name: 'Punarvasu',         lord: 'jupiter' },
  { name: 'Pushya',            lord: 'saturn'  },
  { name: 'Ashlesha',          lord: 'mercury' },
  { name: 'Magha',             lord: 'ketu'    },
  { name: 'Purva Phalguni',    lord: 'venus'   },
  { name: 'Uttara Phalguni',   lord: 'sun'     },
  { name: 'Hasta',             lord: 'moon'    },
  { name: 'Chitra',            lord: 'mars'    },
  { name: 'Swati',             lord: 'rahu'    },
  { name: 'Vishakha',          lord: 'jupiter' },
  { name: 'Anuradha',          lord: 'saturn'  },
  { name: 'Jyeshtha',          lord: 'mercury' },
  { name: 'Mula',              lord: 'ketu'    },
  { name: 'Purva Ashadha',     lord: 'venus'   },
  { name: 'Uttara Ashadha',    lord: 'sun'     },
  { name: 'Shravana',          lord: 'moon'    },
  { name: 'Dhanishtha',        lord: 'mars'    },
  { name: 'Shatabhisha',       lord: 'rahu'    },
  { name: 'Purva Bhadrapada',  lord: 'jupiter' },
  { name: 'Uttara Bhadrapada', lord: 'saturn'  },
  { name: 'Revati',            lord: 'mercury' },
];

// ─── Vimshottari Dasha system — 120-year planetary cycle ───────
// Fixed sequence, always in this order. Total = 120 years.
const DASHA_ORDER  = ['ketu', 'venus', 'sun', 'moon', 'mars', 'rahu', 'jupiter', 'saturn', 'mercury'];
const DASHA_YEARS  = { ketu: 7, venus: 20, sun: 6, moon: 10, mars: 7, rahu: 18, jupiter: 16, saturn: 19, mercury: 17 };

// ─── Core Calculations ─────────────────────────────────────────

/**
 * Lahiri (Chitrapaksha) Ayanamsha in degrees for a given Julian Day.
 * Reference: J2000.0 ayanamsha ≈ 23.85638°, precession rate ≈ 1.39692°/century.
 */
function lahiriAyanamsha(jdn) {
  const T = (jdn - J2000) / 36525.0;  // Julian centuries from J2000
  return 23.85638 + T * 1.39692;
}

/**
 * Convert a tropical ecliptic longitude to sidereal by subtracting ayanamsha.
 */
function toSidereal(tropicalDeg, ayanamsha) {
  return ((tropicalDeg - ayanamsha) % 360 + 360) % 360;
}

/**
 * Get sidereal sign and degrees within sign from a sidereal longitude.
 */
function siderealSign(sidLong) {
  const signIndex = Math.floor(sidLong / 30) % 12;
  return {
    sign: RASHI[signIndex],
    signIndex,
    degreesInSign: Math.round((sidLong % 30) * 100) / 100,
  };
}

/**
 * Get nakshatra from Moon's sidereal longitude.
 * Each of the 27 nakshatras spans 360/27 = 13.333...°
 * Each nakshatra has 4 padas of 3.333...°
 */
function moonNakshatra(sidMoon) {
  const span    = 360 / 27;           // 13.333...°
  const padaSpan = span / 4;          // 3.333...°
  const index   = Math.floor(sidMoon / span) % 27;
  const within  = sidMoon % span;     // degrees elapsed in current nakshatra
  const pada    = Math.floor(within / padaSpan) + 1; // 1-4
  const elapsed = within / span;      // fraction 0-1 elapsed

  return {
    ...NAKSHATRAS[index],
    index,
    pada,
    elapsedFraction: Math.round(elapsed * 1000) / 1000,
  };
}

/**
 * Build the Vimshottari Dasha sequence from birth.
 * Returns an array of dasha periods with start/end ages (years from birth).
 */
function buildDashaSequence(nakshatra) {
  const { lord: birthLord, elapsedFraction } = nakshatra;
  const birthLordYears  = DASHA_YEARS[birthLord];
  const birthBalance    = birthLordYears * (1 - elapsedFraction); // years remaining in birth nakshatra dasha

  const sequence = [];
  let age = 0;

  // First dasha: partial (remaining balance)
  sequence.push({
    lord:  birthLord,
    years: Math.round(birthBalance * 100) / 100,
    start: 0,
    end:   Math.round(birthBalance * 100) / 100,
    partial: true,
  });
  age = birthBalance;

  // Subsequent full dashas
  const startIdx = DASHA_ORDER.indexOf(birthLord);
  for (let i = 1; i < 9; i++) {
    const lord  = DASHA_ORDER[(startIdx + i) % 9];
    const years = DASHA_YEARS[lord];
    sequence.push({
      lord,
      years,
      start: Math.round(age * 100) / 100,
      end:   Math.round((age + years) * 100) / 100,
      partial: false,
    });
    age += years;
  }

  return sequence;
}

/**
 * Find the current active dasha from the sequence using birth date and today.
 */
function currentDashaPeriod(dashaSequence, birthYear, birthMonth, birthDay) {
  const now = new Date();
  // Age in decimal years
  const ageYears =
    (now.getFullYear() - birthYear) +
    (now.getMonth() + 1 - birthMonth) / 12 +
    (now.getDate() - birthDay) / 365.25;

  for (const period of dashaSequence) {
    if (ageYears >= period.start && ageYears < period.end) {
      const elapsed   = ageYears - period.start;
      const remaining = period.end - ageYears;
      return {
        lord:           period.lord,
        totalYears:     period.years,
        yearsElapsed:   Math.round(elapsed * 10) / 10,
        yearsRemaining: Math.round(remaining * 10) / 10,
      };
    }
  }
  // Fallback: last period
  const last = dashaSequence[dashaSequence.length - 1];
  return { lord: last.lord, totalYears: last.years, yearsElapsed: last.years, yearsRemaining: 0 };
}

// ─── Main Export ───────────────────────────────────────────────

/**
 * Calculate Vedic (Jyotish) overlay from tropical birth positions.
 *
 * @param {object} birthPositions — from getAllPositions(jdn): { sun: {longitude}, moon: {longitude}, ... }
 * @param {number} jdn            — Julian Day Number of birth
 * @param {number} birthYear      — birth year (for dasha current period)
 * @param {number} birthMonth     — birth month 1-12
 * @param {number} birthDay       — birth day 1-31
 * @param {object|null} lagnaLong — Optional: tropical Ascendant longitude (from astrology layer)
 * @returns {object} Vedic overlay data
 */
export function calculateVedic(birthPositions, jdn, birthYear, birthMonth, birthDay, lagnaLong = null) {
  try {
    const ayanamsha = lahiriAyanamsha(jdn);

    // ── Sidereal signs for all planets ─────────────────────────
    const siderealPlacements = {};
    const planetKeys = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter',
                        'saturn', 'uranus', 'neptune', 'pluto', 'northNode', 'southNode', 'chiron'];

    for (const planet of planetKeys) {
      const p = birthPositions[planet];
      if (!p?.longitude && p?.longitude !== 0) continue;
      const sidereal = toSidereal(p.longitude, ayanamsha);
      siderealPlacements[planet] = {
        tropicalLong:  Math.round(p.longitude * 100) / 100,
        siderealLong:  Math.round(sidereal * 100) / 100,
        ...siderealSign(sidereal),
      };
    }

    // ── Lagna (sidereal Ascendant) ──────────────────────────────
    let lagna = null;
    if (lagnaLong !== null) {
      const sidLagna = toSidereal(lagnaLong, ayanamsha);
      lagna = { siderealLong: Math.round(sidLagna * 100) / 100, ...siderealSign(sidLagna) };
    }

    // ── Moon Nakshatra ──────────────────────────────────────────
    let moonNak = null;
    if (birthPositions.moon?.longitude !== undefined) {
      const sidMoon = toSidereal(birthPositions.moon.longitude, ayanamsha);
      moonNak = moonNakshatra(sidMoon);
    }

    // ── Vimshottari Dasha ───────────────────────────────────────
    let dasha = null;
    if (moonNak) {
      const sequence = buildDashaSequence(moonNak);
      const current  = currentDashaPeriod(sequence, birthYear, birthMonth, birthDay);
      dasha = {
        birthNakshatra:   moonNak.name,
        birthDashaLord:   moonNak.lord,
        birthDashaBalance: sequence[0].years,
        sequence,
        current,
      };
    }

    return {
      ayanamsha:    Math.round(ayanamsha * 1000) / 1000,
      lagna,
      siderealPlacements,
      moonNakshatra: moonNak,
      dasha,
    };
  } catch (err) {
    return { error: err.message };
  }
}
