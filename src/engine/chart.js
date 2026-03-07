/**
 * Layer 5: Chart Determination — Type, Authority, Profile, Definition, Cross
 *
 * Takes gate/line assignments from both Personality and Design sides
 * and determines the full Human Design chart:
 *   - Active channels (gate pairs where both gates are present)
 *   - Defined centers (centers with at least one active channel)
 *   - Type (Manifestor, Generator, MG, Projector, Reflector)
 *   - Authority (Emotional, Sacral, Splenic, Ego, Self, Mental, Lunar)
 *   - Profile (Personality Sun line / Design Sun line)
 *   - Definition (Single, Split, Triple Split, Quadruple, None)
 *   - Incarnation Cross (4 gate numbers + name)
 *
 * Pure JS for Cloudflare Workers. No external dependencies.
 *
 * Verification anchor: AP = Projector, 6/2, Split, Emotional, LAX Refinement
 */

// Node.js fs/path/url loaded dynamically to avoid breaking Cloudflare Workers
// (static `import 'fs'` fails at import time in Workers — no Node.js compat)

let crossesData = {};
try {
  if (globalThis.__PRIME_DATA?.crosses) {
    // Workers runtime — data injected by engine-compat.js
    crossesData = globalThis.__PRIME_DATA.crosses;
  } else if (typeof import.meta.url === 'string') {
    // Node.js runtime — dynamic import avoids Workers breakage
    const { readFileSync } = await import('fs');
    const { dirname, join } = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname_resolved = dirname(__filename);
    crossesData = JSON.parse(readFileSync(join(__dirname_resolved, '..', 'data', 'crosses.json'), 'utf8'));
  }
} catch {
  // Falls back gracefully if crosses.json is unavailable
}

// ─── CHANNEL DEFINITIONS ────────────────────────────────────────
// Each channel: [gateA, gateB, centerA, centerB]
const CHANNELS = [
  [1,  8,  'G',           'Throat'],
  [2,  14, 'G',           'Sacral'],
  [3,  60, 'Sacral',      'Root'],
  [4,  63, 'Ajna',        'Head'],
  [5,  15, 'Sacral',      'G'],
  [6,  59, 'SolarPlexus', 'Sacral'],
  [7,  31, 'G',           'Throat'],
  [9,  52, 'Sacral',      'Root'],
  [10, 20, 'G',           'Throat'],
  [10, 34, 'G',           'Sacral'],
  [10, 57, 'G',           'Spleen'],
  [11, 56, 'Ajna',        'Throat'],
  [12, 22, 'Throat',      'SolarPlexus'],
  [13, 33, 'G',           'Throat'],
  [16, 48, 'Throat',      'Spleen'],
  [17, 62, 'Ajna',        'Throat'],
  [18, 58, 'Spleen',      'Root'],
  [19, 49, 'Root',        'SolarPlexus'],
  [20, 34, 'Throat',      'Sacral'],
  [20, 57, 'Throat',      'Spleen'],
  [21, 45, 'Heart',       'Throat'],
  [23, 43, 'Throat',      'Ajna'],
  [24, 61, 'Ajna',        'Head'],
  [25, 51, 'G',           'Heart'],
  [26, 44, 'Heart',       'Spleen'],
  [27, 50, 'Sacral',      'Spleen'],
  [28, 38, 'Spleen',      'Root'],
  [29, 46, 'Sacral',      'G'],
  [30, 41, 'SolarPlexus', 'Root'],
  [32, 54, 'Spleen',      'Root'],
  [34, 57, 'Sacral',      'Spleen'],
  [35, 36, 'Throat',      'SolarPlexus'],
  [37, 40, 'SolarPlexus', 'Heart'],
  [39, 55, 'Root',        'SolarPlexus'],
  [42, 53, 'Sacral',      'Root'],        // BL-R-H10: was missing
  [47, 64, 'Ajna',        'Head'],
];

// ─── CENTER → GATE MAPPING ──────────────────────────────────────
const CENTER_GATES = {
  Head:         [61, 63, 64],
  Ajna:         [4, 11, 17, 24, 43, 47],
  Throat:       [8, 12, 16, 20, 23, 31, 33, 35, 45, 56, 62],
  G:            [1, 2, 7, 10, 13, 15, 25, 46],
  Heart:        [21, 26, 40, 51],
  SolarPlexus:  [6, 22, 30, 36, 37, 49, 55],
  Sacral:       [3, 5, 9, 14, 27, 29, 34, 42, 59],
  Spleen:       [18, 28, 32, 44, 48, 50, 57],
  Root:         [19, 38, 39, 41, 52, 53, 54, 58, 60],
};

const MOTOR_CENTERS = new Set(['Heart', 'SolarPlexus', 'Sacral', 'Root']);

// ─── AUTHORITY HIERARCHY ────────────────────────────────────────
const AUTHORITY_ORDER = [
  ['SolarPlexus', 'Emotional - Solar Plexus'],
  ['Sacral',      'Sacral'],
  ['Spleen',      'Splenic'],
  ['Heart',       'Ego'],  // BL-R-M4: split resolved in determineAuthority()
  ['G',           'Self-Projected'],
];

/**
 * Check if Heart center is connected to Throat through channels.
 * @param {Map} graph – Center adjacency map
 * @returns {boolean}
 */
function isHeartConnectedToThroat(graph) {
  if (!graph || !graph.has('Heart')) return false;
  return graph.get('Heart')?.has('Throat') || false;
}

// ─── CROSS TYPE PREFIXES ────────────────────────────────────────
const CROSS_PREFIX = {
  '1': 'Right Angle Cross',
  '2': 'Right Angle Cross',
  '3': 'Juxtaposition Cross',
  '4': 'Left Angle Cross',
  '5': 'Left Angle Cross',
  '6': 'Left Angle Cross',
};

// ─── HELPERS ────────────────────────────────────────────────────

/**
 * Find all active channels from a set of active gate numbers.
 * A channel is active when BOTH gates in the pair are present.
 *
 * @param {Set<number>} activeGates – Set of all active gate numbers
 * @returns {Array<{ channel: string, gates: [number, number], centers: [string, string] }>}
 */
function findActiveChannels(activeGates) {
  const active = [];
  for (const [gA, gB, cA, cB] of CHANNELS) {
    if (activeGates.has(gA) && activeGates.has(gB)) {
      active.push({
        channel: `${gA}-${gB}`,
        gates: [gA, gB],
        centers: [cA, cB]
      });
    }
  }
  return active;
}

/**
 * Find all defined centers from active channels.
 *
 * @param {Array} activeChannels – From findActiveChannels
 * @returns {Set<string>}
 */
function findDefinedCenters(activeChannels) {
  const defined = new Set();
  for (const ch of activeChannels) {
    defined.add(ch.centers[0]);
    defined.add(ch.centers[1]);
  }
  return defined;
}

/**
 * Build adjacency graph of defined centers connected by active channels.
 *
 * @param {Array} activeChannels
 * @returns {Map<string, Set<string>>}
 */
function buildCenterGraph(activeChannels) {
  const graph = new Map();
  for (const ch of activeChannels) {
    const [cA, cB] = ch.centers;
    if (!graph.has(cA)) graph.set(cA, new Set());
    if (!graph.has(cB)) graph.set(cB, new Set());
    graph.get(cA).add(cB);
    graph.get(cB).add(cA);
  }
  return graph;
}

/**
 * Find connected components in the center graph.
 * Each component is a set of connected defined centers.
 *
 * @param {Map} graph – Adjacency map
 * @returns {Array<Set<string>>}
 */
function findConnectedComponents(graph) {
  const visited = new Set();
  const components = [];

  for (const center of graph.keys()) {
    if (visited.has(center)) continue;

    // BFS from this center
    const component = new Set();
    const queue = [center];
    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      component.add(current);

      for (const neighbor of (graph.get(current) || [])) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  return components;
}

/**
 * Check if there is a path from any motor center to the Throat
 * through active channels.
 *
 * @param {Map} graph – Center adjacency map
 * @returns {boolean}
 */
function hasMotorToThroatConnection(graph) {
  if (!graph.has('Throat')) return false;

  // BFS from Throat, see if we reach any motor
  const visited = new Set();
  const queue = ['Throat'];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    if (current !== 'Throat' && MOTOR_CENTERS.has(current)) {
      return true;
    }

    for (const neighbor of (graph.get(current) || [])) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return false;
}

/**
 * Determine Human Design Type.
 *
 * @param {Set<string>} definedCenters
 * @param {Map} graph
 * @returns {string}
 */
function determineType(definedCenters, graph) {
  const sacralDefined = definedCenters.has('Sacral');
  const motorToThroat = hasMotorToThroatConnection(graph);

  if (sacralDefined && motorToThroat) return 'Manifesting Generator';
  if (sacralDefined) return 'Generator';
  if (!sacralDefined && motorToThroat) return 'Manifestor';
  if (definedCenters.size > 0) return 'Projector';
  return 'Reflector';
}

/**
 * Determine Authority.
 *
 * @param {Set<string>} definedCenters
 * @param {string} type
 * @param {Map} graph – Center adjacency map (for Heart→Throat check)
 * @returns {string}
 */
function determineAuthority(definedCenters, type, graph) {
  if (type === 'Reflector') return 'Lunar';

  for (const [center, authority] of AUTHORITY_ORDER) {
    if (definedCenters.has(center)) {
      // BL-R-M4: Distinguish Ego Manifested vs Ego Projected
      if (center === 'Heart') {
        return isHeartConnectedToThroat(graph) ? 'Ego Manifested' : 'Ego Projected';
      }
      return authority;
    }
  }

  // If only Head and/or Ajna are defined (Mental Projector)
  if (definedCenters.has('Ajna') || definedCenters.has('Head')) {
    return 'Mental (None)';
  }

  return 'None';
}

/**
 * Determine Strategy based on Type.
 *
 * @param {string} type
 * @returns {string}
 */
function determineStrategy(type) {
  switch (type) {
    case 'Manifestor':           return 'Inform';
    case 'Generator':            return 'Wait to Respond';
    case 'Manifesting Generator': return 'Wait to Respond, then Inform';
    case 'Projector':            return 'Wait for the Invitation';
    case 'Reflector':            return 'Wait a Lunar Cycle';
    default:                     return 'Unknown';
  }
}

/**
 * Determine Not-Self Theme based on Type.
 *
 * @param {string} type
 * @returns {string}
 */
function determineNotSelfTheme(type) {
  switch (type) {
    case 'Manifestor':           return 'Anger';
    case 'Generator':            return 'Frustration';
    case 'Manifesting Generator': return 'Frustration / Anger';
    case 'Projector':            return 'Bitterness';
    case 'Reflector':            return 'Disappointment';
    default:                     return 'Unknown';
  }
}

/**
 * Determine Definition type.
 *
 * @param {Array<Set<string>>} components
 * @returns {string}
 */
function determineDefinition(components) {
  switch (components.length) {
    case 0: return 'None';
    case 1: return 'Single Definition';
    case 2: return 'Split Definition';
    case 3: return 'Triple Split Definition';
    default: return 'Quadruple Split Definition';
  }
}

/**
 * Determine Profile.
 *
 * @param {number} personalitySunLine – Personality Sun line (1–6)
 * @param {number} designSunLine      – Design Sun line (1–6)
 * @returns {string}
 */
function determineProfile(personalitySunLine, designSunLine) {
  return `${personalitySunLine}/${designSunLine}`;
}

/**
 * Determine Incarnation Cross.
 *
 * @param {number} pSunGate    – Personality Sun gate
 * @param {number} pEarthGate  – Personality Earth gate (Sun + 180°)
 * @param {number} dSunGate    – Design Sun gate
 * @param {number} dEarthGate  – Design Earth gate (Design Sun + 180°)
 * @param {number} personalitySunLine
 * @returns {{ gates: number[], type: string }}
 */
function determineCross(pSunGate, pEarthGate, dSunGate, dEarthGate, personalitySunLine) {
  const lineStr = String(personalitySunLine);
  const type = CROSS_PREFIX[lineStr] || 'Unknown Cross';

  // Look up cross name from data
  let name = type;
  const crossEntry = crossesData[String(pSunGate)];
  if (crossEntry) {
    const variant = lineStr === '3' ? 'juxta'
      : (lineStr === '1' || lineStr === '2') ? 'right'
      : 'left';
    if (crossEntry[variant]) {
      name = crossEntry[variant].name;
    }
  }

  return {
    gates: [pSunGate, pEarthGate, dSunGate, dEarthGate],
    type,
    name
  };
}

// ─── MAIN EXPORT ────────────────────────────────────────────────

/**
 * Calculate the complete Human Design chart from gate assignments.
 *
 * @param {object} personalityGates – Personality gate/line map
 *   { sun: { gate, line }, earth: { gate, line }, moon: {...}, ... }
 * @param {object} designGates – Design gate/line map (same structure)
 * @returns {object} Complete chart
 */
export function calculateChart(personalityGates, designGates) {
  // Collect all active gates (union of personality + design)
  const allGateNumbers = new Set();
  const personalityGateNumbers = new Set();
  const designGateNumbers = new Set();

  for (const data of Object.values(personalityGates)) {
    allGateNumbers.add(data.gate);
    personalityGateNumbers.add(data.gate);
  }
  for (const data of Object.values(designGates)) {
    allGateNumbers.add(data.gate);
    designGateNumbers.add(data.gate);
  }

  // Find active channels
  const activeChannels = findActiveChannels(allGateNumbers);

  // Find defined centers
  const definedCenters = findDefinedCenters(activeChannels);

  // Build center graph + connected components
  const graph = buildCenterGraph(activeChannels);
  const components = findConnectedComponents(graph);

  // Determine chart properties
  const type = determineType(definedCenters, graph);
  const authority = determineAuthority(definedCenters, type, graph);
  const strategy = determineStrategy(type);
  const notSelfTheme = determineNotSelfTheme(type);
  const definition = determineDefinition(components);
  const profile = determineProfile(
    personalityGates.sun.line,
    designGates.sun.line
  );
  const cross = determineCross(
    personalityGates.sun.gate,
    personalityGates.earth.gate,
    designGates.sun.gate,
    designGates.earth.gate,
    personalityGates.sun.line
  );

  // All 9 centers with defined status
  const allCenters = {};
  const ALL_CENTER_NAMES = [
    'Head', 'Ajna', 'Throat', 'G', 'Heart',
    'SolarPlexus', 'Sacral', 'Spleen', 'Root'
  ];
  for (const name of ALL_CENTER_NAMES) {
    allCenters[name] = {
      defined: definedCenters.has(name),
      gates: CENTER_GATES[name],
      activeGates: CENTER_GATES[name].filter(g => allGateNumbers.has(g))
    };
  }

  // Gate activation details (which side activated each gate)
  const gateActivations = {};
  for (const gateNum of allGateNumbers) {
    gateActivations[gateNum] = {
      personality: personalityGateNumbers.has(gateNum),
      design: designGateNumbers.has(gateNum),
    };
  }

  return {
    type,
    authority,
    strategy,
    notSelfTheme,
    profile,
    definition,
    cross,
    definedCenters: [...definedCenters].sort(),
    undefinedCenters: ALL_CENTER_NAMES.filter(c => !definedCenters.has(c)).sort(),
    activeChannels,
    centers: allCenters,
    gateActivations,
    connectedComponents: components.map(c => [...c].sort()),
    personalityGates,
    designGates
  };
}
