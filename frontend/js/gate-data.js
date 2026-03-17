/**
 * Gate Data Loader (BL-UX-H1 / BL-UX-C3)
 * Source: src/data/gate_wheel.json — hexName field for all 64 I Ching gates.
 * Used by renderChart() to show "Gate 17: Following" instead of just "Gate 17.2".
 */

const GATE_NAMES = Object.freeze({
  1: 'The Creative',
  2: 'The Receptive',
  3: 'Difficulty at the Beginning',
  4: 'Youthful Folly',
  5: 'Waiting',
  6: 'Conflict',
  7: 'The Army',
  8: 'Holding Together',
  9: 'The Taming Power of the Small',
  10: 'Treading',
  11: 'Peace',
  12: 'Standstill',
  13: 'Fellowship with Men',
  14: 'Possession in Great Measure',
  15: 'Modesty',
  16: 'Enthusiasm',
  17: 'Following',
  18: 'Work on the Decayed',
  19: 'Approach',
  20: 'Contemplation',
  21: 'Biting Through',
  22: 'Grace',
  23: 'Splitting Apart',
  24: 'Return',
  25: 'Innocence',
  26: 'The Taming Power of the Great',
  27: 'Nourishment',
  28: 'Preponderance of the Great',
  29: 'The Abysmal',
  30: 'The Clinging',
  31: 'Influence',
  32: 'Duration',
  33: 'Retreat',
  34: 'The Power of the Great',
  35: 'Progress',
  36: 'Darkening of the Light',
  37: 'The Family',
  38: 'Opposition',
  39: 'Obstruction',
  40: 'Deliverance',
  41: 'Decrease',
  42: 'Increase',
  43: 'Breakthrough',
  44: 'Coming to Meet',
  45: 'Gathering Together',
  46: 'Pushing Upward',
  47: 'Oppression',
  48: 'The Well',
  49: 'Revolution',
  50: 'The Caldron',
  51: 'The Arousing',
  52: 'Keeping Still',
  53: 'Development',
  54: 'The Marrying Maiden',
  55: 'Abundance',
  56: 'The Wanderer',
  57: 'The Gentle',
  58: 'The Joyous',
  59: 'Dispersion',
  60: 'Limitation',
  61: 'Inner Truth',
  62: 'Preponderance of the Small',
  63: 'After Completion',
  64: 'Before Completion',
});

/**
 * Get the I Ching hexagram name for an Energy Blueprint gate number.
 * @param {number|string} gate
 * @returns {string} e.g. "Following" or "" if not found
 */
function getGateName(gate) {
  return GATE_NAMES[parseInt(gate, 10)] || '';
}

/**
 * Format a gate with its name: "Gate 17: Following"
 * @param {number|string} gate
 * @returns {string}
 */
function formatGate(gate) {
  const name = getGateName(gate);
  return name ? `Gate ${gate}: ${name}` : `Gate ${gate}`;
}

window.GATE_NAMES = GATE_NAMES;
window.getGateName = getGateName;
window.formatGate = formatGate;
