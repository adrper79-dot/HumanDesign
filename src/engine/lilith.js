import { getSignFromLongitude } from './astro.js';
import lilithKB from '../knowledgebase/astro/lilith.json' assert { type: 'json' };

/**
 * Mean apogee of the Moon (Black Moon Lilith) using Meeus Astronomical
 * Algorithms, Chapter 22.
 *
 * ω' = 83.3530513 + 4069.01372866 * T   (degrees)
 * Apogee direction = ω' + 180°
 *
 * @param {number} jdn – Julian Day Number (noon-based)
 * @returns {number} Mean Lilith longitude in degrees [0, 360)
 */
function meanLilithLongitude(jdn) {
  const T       = (jdn - 2451545.0) / 36525;
  const apogee  = (83.3530513 + 180 + 4069.01372866 * T) % 360;
  return ((apogee % 360) + 360) % 360;
}

/**
 * Determine which house (1-12) a given longitude falls in.
 * Houses object is keyed 1-12 with cusp longitudes.
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
      if (lon >= start || lon < end) return h;
    }
  }
  return 1;
}

/**
 * Calculate Black Moon Lilith (mean apogee) placement.
 *
 * @param {number} jdn           – Julian Day Number of birth
 * @param {object|null} houses   – house cusps keyed 1-12, or null
 * @returns {object} Lilith longitude, sign, house, and KB archetypes
 */
export function calculateLilith(jdn, houses) {
  try {
    if (jdn == null) return { error: 'JDN not provided' };

    const lon                        = meanLilithLongitude(jdn);
    const { sign, signIndex, degrees } = getSignFromLongitude(lon);
    const house                      = houses ? getHouseForLongitude(lon, houses) : null;
    const signSlug                   = sign.toLowerCase();
    const kb                         = lilithKB[signSlug] || null;

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
