/**
 * Sabian Symbols Engine
 *
 * The 360 Sabian Symbols are a set of symbolic images, one for each degree of
 * the zodiac. Channelled by psychic Elsie Wheeler in 1925 under the direction
 * of astrologer Marc Edmund Jones, they were later organised and interpreted
 * by Dane Rudhyar in "An Astrological Mandala" (1973). The symbols constitute
 * a coherent system of archetypal images that can illuminate the quality of
 * any planet, point, or cusp plotted against the 360-degree wheel.
 *
 * Degree lookup logic:
 *   A planet at ecliptic longitude L is said to occupy the Nth degree of its
 *   sign where N = floor(L mod 30) + 1 (1-based, Aries 1° to Pisces 30°).
 *   The symbol index (0-based) = signIndex * 30 + floor(degreesInSign),
 *   where degreesInSign = L mod 30 in the range [0, 30).
 *
 * This engine reports Sabian symbols for:
 *   - Natal Sun
 *   - Natal Moon
 *   - Ascendant
 *   - Optional: Midheaven (MC)
 *
 * The symbols are loaded from src/knowledgebase/sabian/symbols.json (360 entries).
 *
 * @module sabian
 */

import symbols from '../knowledgebase/sabian/symbols.json' assert { type: 'json' };

// ─── SIGN LIST (matches astro.js SIGNS order) ────────────────────
const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

// ─── HELPERS ─────────────────────────────────────────────────────

function normalise(lon) {
  return ((lon % 360) + 360) % 360;
}

/**
 * Look up the Sabian symbol for an ecliptic longitude.
 *
 * @param {number} longitude – Ecliptic longitude 0–360°
 * @returns {object} { degree, sign, signIndex, symbol, keynote, absoluteDegree }
 */
export function symbolForLongitude(longitude) {
  const lon       = normalise(longitude);
  const signIndex = Math.floor(lon / 30);
  const degInSign = lon - signIndex * 30;
  const degFloor  = Math.floor(degInSign);           // 0–29
  const idx       = signIndex * 30 + degFloor;       // 0–359

  const entry = symbols[idx] || symbols[0]; // safety fallback

  return {
    absoluteDegree: entry.absolute,
    sign:           entry.sign,
    signIndex:      entry.signIndex,
    degree:         entry.degree,
    degreesInSign:  Math.round(degInSign * 100) / 100,
    symbol:         entry.symbol,
    keynote:        entry.keynote,
    display:        `${SIGNS[signIndex]} ${entry.degree}° — ${entry.symbol}`,
  };
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────

/**
 * Calculate Sabian symbols for key chart points.
 *
 * @param {object} birthPositions – Planetary longitudes from Layer 2
 *   Expected: { sun: { longitude }, moon: { longitude }, ... }
 * @param {object} astroChart – Astrology chart from Layer 6
 *   Expected: { ascendant: { longitude }, midheaven: { longitude }, ... }
 * @returns {object} Sabian symbol data for Sun, Moon, Ascendant, Midheaven
 */
export function calculateSabian(birthPositions, astroChart) {
  try {
    const sun = birthPositions?.sun?.longitude != null
      ? symbolForLongitude(birthPositions.sun.longitude)
      : null;

    const moon = birthPositions?.moon?.longitude != null
      ? symbolForLongitude(birthPositions.moon.longitude)
      : null;

    const ascendant = astroChart?.ascendant?.longitude != null
      ? symbolForLongitude(astroChart.ascendant.longitude)
      : null;

    const midheaven = astroChart?.midheaven?.longitude != null
      ? symbolForLongitude(astroChart.midheaven.longitude)
      : null;

    return { sun, moon, ascendant, midheaven };
  } catch (err) {
    return { error: err.message };
  }
}
