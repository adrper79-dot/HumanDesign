/**
 * Mayan Tzolkin / Dreamspell Engine
 *
 * Computes the Galactic Signature (Kin number) from birth date using the
 * Arguelles Dreamspell correlation — the system in widespread use among
 * contemporary practitioners and the New Age / galactic lineage community.
 *
 * The Tzolkin is a 260-day sacred calendar (13 Tones × 20 Solar Seals).
 * Each person's birthday maps to a unique Kin, revealing their Solar Seal
 * (archetype) and Galactic Tone (purpose / mode of action).
 *
 * Dreamspell correlation anchor:
 *   July 26, 1987 = Kin 34 (White Galactic Wizard)
 *   JDN at noon = 2447003
 *
 * Reference: José Argüelles & Lloydine Argüelles, "The Dreamspell" (1992);
 *            the 260-day Tzolkin and its symbolic vocabulary are drawn from
 *            the surviving Mayan codices (Dresden, Madrid, Paris).
 *
 * No additional intake data required — birth date only.
 *
 * @module mayan
 */

// ─── SOLAR SEALS ────────────────────────────────────────────────
// Sequential order of the 20 Solar Seals in the Tzolkin (Dreamspell convention)
// Index 0 = Red Dragon (Dragon/Imix), 19 = Yellow Sun (Ahau)
const SOLAR_SEALS = [
  { key: 'redDragon',        name: 'Red Dragon',         tribe: 'Dragon',       color: 'Red'    },
  { key: 'whiteWind',        name: 'White Wind',          tribe: 'Wind',         color: 'White'  },
  { key: 'blueNight',        name: 'Blue Night',          tribe: 'Night',        color: 'Blue'   },
  { key: 'yellowSeed',       name: 'Yellow Seed',         tribe: 'Seed',         color: 'Yellow' },
  { key: 'redSerpent',       name: 'Red Serpent',         tribe: 'Serpent',      color: 'Red'    },
  { key: 'whiteWorldBridger',name: 'White World-Bridger', tribe: 'World-Bridger',color: 'White'  },
  { key: 'blueHand',         name: 'Blue Hand',           tribe: 'Hand',         color: 'Blue'   },
  { key: 'yellowStar',       name: 'Yellow Star',         tribe: 'Star',         color: 'Yellow' },
  { key: 'redMoon',          name: 'Red Moon',            tribe: 'Moon',         color: 'Red'    },
  { key: 'whiteDog',         name: 'White Dog',           tribe: 'Dog',          color: 'White'  },
  { key: 'blueMonkey',       name: 'Blue Monkey',         tribe: 'Monkey',       color: 'Blue'   },
  { key: 'yellowHuman',      name: 'Yellow Human',        tribe: 'Human',        color: 'Yellow' },
  { key: 'redSkywalker',     name: 'Red Skywalker',       tribe: 'Skywalker',    color: 'Red'    },
  { key: 'whiteWizard',      name: 'White Wizard',        tribe: 'Wizard',       color: 'White'  },
  { key: 'blueEagle',        name: 'Blue Eagle',          tribe: 'Eagle',        color: 'Blue'   },
  { key: 'yellowWarrior',    name: 'Yellow Warrior',      tribe: 'Warrior',      color: 'Yellow' },
  { key: 'redEarth',         name: 'Red Earth',           tribe: 'Earth',        color: 'Red'    },
  { key: 'whiteMirror',      name: 'White Mirror',        tribe: 'Mirror',       color: 'White'  },
  { key: 'blueStorm',        name: 'Blue Storm',          tribe: 'Storm',        color: 'Blue'   },
  { key: 'yellowSun',        name: 'Yellow Sun',          tribe: 'Sun',          color: 'Yellow' },
];

// ─── GALACTIC TONES ─────────────────────────────────────────────
// 13 Galactic Tones: purpose, mode of action, harmonic quality
const GALACTIC_TONES = [
  { number: 1,  name: 'Magnetic',     action: 'Unifies',    power: 'Attract',    essence: 'Purpose'     },
  { number: 2,  name: 'Lunar',        action: 'Polarizes',  power: 'Challenge',  essence: 'Stabilize'   },
  { number: 3,  name: 'Electric',     action: 'Activates',  power: 'Service',    essence: 'Bond'        },
  { number: 4,  name: 'Self-Existing',action: 'Defines',    power: 'Form',       essence: 'Measure'     },
  { number: 5,  name: 'Overtone',     action: 'Empowers',   power: 'Radiance',   essence: 'Command'     },
  { number: 6,  name: 'Rhythmic',     action: 'Organizes',  power: 'Equality',   essence: 'Balance'     },
  { number: 7,  name: 'Resonant',     action: 'Channels',   power: 'Attunement', essence: 'Inspire'     },
  { number: 8,  name: 'Galactic',     action: 'Harmonizes', power: 'Integrity',  essence: 'Model'       },
  { number: 9,  name: 'Solar',        action: 'Pulses',     power: 'Intention',  essence: 'Realize'     },
  { number: 10, name: 'Planetary',    action: 'Manifests',  power: 'Perfection', essence: 'Produce'     },
  { number: 11, name: 'Spectral',     action: 'Liberates',  power: 'Dissolve',   essence: 'Release'     },
  { number: 12, name: 'Crystal',      action: 'Dedicates',  power: 'Cooperation',essence: 'Universalize'},
  { number: 13, name: 'Cosmic',       action: 'Endures',    power: 'Presence',   essence: 'Transcend'   },
];

// ─── CONSTANTS ──────────────────────────────────────────────────

// Dreamspell epoch: July 26, 1987 at noon = Kin 34
// JDN at noon on July 26, 1987 (Gregorian) = 2447003.0
const DREAMSPELL_EPOCH_JDN  = 2447003;
const DREAMSPELL_EPOCH_KIN  = 34;

// Wavespell: each of 20 seals anchors a 13-day wavespell; 20 wavespells = 260 kin
function wavespellFromKin(kin) {
  return Math.floor((kin - 1) / 13) + 1; // 1–20
}

// ─── CORE CALCULATION ───────────────────────────────────────────

/**
 * Calculate the Dreamspell Kin (1–260) from a Julian Day Number.
 *
 * Uses the integer Julian Day (noon) so that all birth times on the same
 * calendar date produce the same kin. The Dreamspell calendar is strictly
 * day-based; birth time is irrelevant.
 *
 * @param {number} jdn – Julian Day Number (fractional; floor gives noon day)
 * @returns {number} Kin number 1–260
 */
export function kinFromJDN(jdn) {
  const dayIndex = Math.round(jdn) - DREAMSPELL_EPOCH_JDN; // integer offset from epoch
  // ((epochKin + offset - 1) % 260 + 260) % 260 + 1  ensures positive modulo
  return ((DREAMSPELL_EPOCH_KIN + dayIndex - 1) % 260 + 260) % 260 + 1;
}

/**
 * Extract Solar Seal and Galactic Tone from a Kin number.
 *
 * @param {number} kin – Kin 1–260
 * @returns {{ seal: object, tone: object }}
 */
export function kinComponents(kin) {
  const sealIndex = (kin - 1) % 20;
  const toneIndex = (kin - 1) % 13;
  return {
    seal:  SOLAR_SEALS[sealIndex],
    tone:  GALACTIC_TONES[toneIndex],
  };
}

/**
 * Calculate the complete Mayan Galactic Signature from a Julian Day Number.
 *
 * @param {number} jdn – Julian Day Number at birth (noon)
 * @returns {object} Galactic Signature profile
 */
export function calculateMayan(jdn) {
  try {
    const kin = kinFromJDN(jdn);
    const { seal, tone } = kinComponents(kin);
    const wavespell = wavespellFromKin(kin);

    return {
      kin,
      seal: seal.key,
      sealName: seal.name,
      sealColor: seal.color,
      sealTribe: seal.tribe,
      tone: tone.number,
      toneName: tone.name,
      toneAction: tone.action,
      tonePower: tone.power,
      toneEssence: tone.essence,
      wavespell,
      signature: `${tone.name} ${seal.name}`,       // e.g. "Galactic Wizard"
      kin260: `Kin ${kin}`,
    };
  } catch (err) {
    return { error: err.message };
  }
}
