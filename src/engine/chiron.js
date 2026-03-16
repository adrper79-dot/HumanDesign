import { getSignFromLongitude } from './astro.js';
import chironKB from '../knowledgebase/astro/chiron.json' assert { type: 'json' };

/**
 * Determine which house (1-12) a given longitude falls in.
 * Houses object is keyed 1-12 with cusp longitudes.
 * Handles wrap-around at 360°.
 */
function getHouseForLongitude(longitude, houses) {
  const lon = ((longitude % 360) + 360) % 360;
  for (let h = 1; h <= 12; h++) {
    const nextH = h === 12 ? 1 : h + 1;
    // houses[h] may be a raw number OR an object with a .longitude field
    const rawStart  = houses[h]?.longitude ?? houses[h];
    const rawEnd    = houses[nextH]?.longitude ?? houses[nextH];
    const start = ((rawStart % 360) + 360) % 360;
    const end   = ((rawEnd   % 360) + 360) % 360;
    if (start <= end) {
      if (lon >= start && lon < end) return h;
    } else {
      // Cusp wraps past 0°
      if (lon >= start || lon < end) return h;
    }
  }
  return 1;
}

/**
 * Calculate Chiron placement from birth positions already computed by Layer 2.
 *
 * @param {object} birthPositions  – output of getAllPositions(); must include chiron.longitude
 * @param {object|null} houses     – house cusps object keyed 1-12 (from astrology.houses), or null
 * @returns {object} Chiron sign/house data enriched with KB archetypes
 */
export function calculateChiron(birthPositions, houses) {
  try {
    const lon = birthPositions?.chiron?.longitude;
    if (lon == null) return { error: 'Chiron longitude not available' };

    const { sign, signIndex, degrees } = getSignFromLongitude(lon);
    const house = houses ? getHouseForLongitude(lon, houses) : null;
    const signSlug = sign.toLowerCase();
    const kb = chironKB[signSlug] || null;

    return {
      longitude:    lon,
      sign,
      signIndex,
      degrees,
      house,
      archetype:    kb?.archetype    ?? null,
      description:  kb?.description  ?? null,
      shadow:       kb?.shadow       ?? null,
      gift:         kb?.gift         ?? null,
      primeInsight: kb?.primeInsight ?? null,
    };
  } catch (err) {
    return { error: err.message };
  }
}
