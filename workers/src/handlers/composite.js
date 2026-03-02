/**
 * POST /api/composite
 *
 * Relationship / composite chart for two people.
 *
 * Overlays two Human Design bodygraphs to identify:
 *   - Electromagnetic connections (channels where each person provides one gate)
 *   - Dominance channels (one person activates both gates)
 *   - Compromise channels (both people activate the same gate)
 *   - Combined definition and type dynamics
 *   - Relationship Forge compatibility via Prime Self mapping
 *
 * Request body:
 * {
 *   personA: { birthDate, birthTime, birthTimezone?, lat, lng },
 *   personB: { birthDate, birthTime, birthTimezone?, lat, lng }
 * }
 */

import { calculateFullChart } from '../../../src/engine/index.js';
import { parseToUTC } from '../utils/parseToUTC.js';

// ─── Channel definitions: [gateA, gateB, centerA, centerB] ──────
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
  [47, 64, 'Ajna',        'Head'],
];

/**
 * Collect all active gates from both Personality and Design sides.
 * Returns a Set of gate numbers.
 */
function collectGates(personalityGates, designGates) {
  const gates = new Set();
  const bodies = ['sun', 'earth', 'moon', 'northNode', 'southNode',
    'mercury', 'venus', 'mars', 'jupiter', 'saturn',
    'uranus', 'neptune', 'pluto'];

  for (const body of bodies) {
    if (personalityGates.conscious?.[body]) gates.add(personalityGates.conscious[body].gate);
    if (designGates.unconscious?.[body]) gates.add(designGates.unconscious[body].gate);
  }
  return gates;
}

/**
 * Parse birth params to UTC using shared utility.
 */
function parsePerson(person) {
  const { birthDate, birthTime, birthTimezone, lat, lng } = person;
  const utc = parseToUTC(birthDate, birthTime, birthTimezone);
  return { ...utc, lat, lng };
}

/**
 * Analyze the overlay of two bodygraphs for relationship dynamics.
 */
function analyzeComposite(chartA, chartB) {
  const gatesA = collectGates(chartA.personalityGates, chartA.designGates);
  const gatesB = collectGates(chartB.personalityGates, chartB.designGates);

  // Active channels for each individual
  const channelsA = new Set(chartA.chart.activeChannels.map(c => c.channel));
  const channelsB = new Set(chartB.chart.activeChannels.map(c => c.channel));

  const electromagnetic = [];  // Each person provides one gate
  const dominanceA = [];       // Person A activates both gates (not Person B)
  const dominanceB = [];       // Person B activates both gates (not Person A)
  const companionship = [];    // Both have the full channel individually
  const compromise = [];       // Both activate the same single gate (no completion)

  for (const [gA, gB, cA, cB] of CHANNELS) {
    const channelKey = `${gA}-${gB}`;
    const aHasGA = gatesA.has(gA);
    const aHasGB = gatesA.has(gB);
    const bHasGA = gatesB.has(gA);
    const bHasGB = gatesB.has(gB);

    // Is this channel complete in the composite?
    const compositeGA = aHasGA || bHasGA;
    const compositeGB = aHasGB || bHasGB;

    if (compositeGA && compositeGB) {
      const detail = { channel: channelKey, gates: [gA, gB], centers: [cA, cB] };

      // Electromagnetic: one gives gate A, the other gives gate B
      const aOnlyGA = aHasGA && !bHasGA;
      const aOnlyGB = aHasGB && !bHasGB;
      const bOnlyGA = bHasGA && !aHasGA;
      const bOnlyGB = bHasGB && !aHasGB;

      if ((aOnlyGA && bOnlyGB) || (aOnlyGB && bOnlyGA)) {
        detail.type = 'electromagnetic';
        detail.provider = (aOnlyGA) ? { A: gA, B: gB } : { A: gB, B: gA };
        electromagnetic.push(detail);
      } else if (channelsA.has(channelKey) && channelsB.has(channelKey)) {
        detail.type = 'companionship';
        companionship.push(detail);
      } else if (channelsA.has(channelKey) && !channelsB.has(channelKey)) {
        detail.type = 'dominance_A';
        dominanceA.push(detail);
      } else if (channelsB.has(channelKey) && !channelsA.has(channelKey)) {
        detail.type = 'dominance_B';
        dominanceB.push(detail);
      } else {
        // Both contribute but with overlap
        detail.type = 'electromagnetic';
        electromagnetic.push(detail);
      }
    } else {
      // Check for compromise: both activate same gate but channel incomplete
      if ((aHasGA && bHasGA && !compositeGB) || (aHasGB && bHasGB && !compositeGA)) {
        const sharedGate = (aHasGA && bHasGA) ? gA : gB;
        compromise.push({
          channel: channelKey,
          gates: [gA, gB],
          centers: [cA, cB],
          sharedGate,
          type: 'compromise'
        });
      }
    }
  }

  // Combined definition — merge both people's defined centers
  const combinedCenters = new Set([
    ...chartA.chart.definedCenters,
    ...chartB.chart.definedCenters
  ]);

  // Add centers from electromagnetic connections
  for (const em of electromagnetic) {
    combinedCenters.add(em.centers[0]);
    combinedCenters.add(em.centers[1]);
  }

  // Determine combined definition connectivity
  const allActiveChannels = [
    ...chartA.chart.activeChannels,
    ...chartB.chart.activeChannels,
    ...electromagnetic
  ];

  // Build adjacency from all active channels
  const adj = {};
  for (const ch of allActiveChannels) {
    const [c1, c2] = ch.centers;
    if (!adj[c1]) adj[c1] = new Set();
    if (!adj[c2]) adj[c2] = new Set();
    adj[c1].add(c2);
    adj[c2].add(c1);
  }

  // BFS to find connected components
  const visited = new Set();
  let components = 0;
  for (const center of combinedCenters) {
    if (!visited.has(center) && adj[center]) {
      components++;
      const queue = [center];
      while (queue.length) {
        const cur = queue.shift();
        if (visited.has(cur)) continue;
        visited.add(cur);
        for (const neighbor of (adj[cur] || [])) {
          if (!visited.has(neighbor)) queue.push(neighbor);
        }
      }
    }
  }

  const definitions = ['None', 'Single', 'Split', 'Triple Split', 'Quadruple Split'];
  const combinedDefinition = definitions[Math.min(components, 4)] || 'None';

  // Forge compatibility analysis
  const forgeA = mapTypeToForge(chartA.chart.type, chartA.chart.authority);
  const forgeB = mapTypeToForge(chartB.chart.type, chartB.chart.authority);

  return {
    electromagnetic,
    dominanceA,
    dominanceB,
    companionship,
    compromise,
    combinedDefinition,
    combinedCenters: [...combinedCenters],
    personA: {
      type: chartA.chart.type,
      authority: chartA.chart.authority,
      profile: chartA.chart.profile,
      definition: chartA.chart.definition,
      forge: forgeA,
      definedCenters: chartA.chart.definedCenters
    },
    personB: {
      type: chartB.chart.type,
      authority: chartB.chart.authority,
      profile: chartB.chart.profile,
      definition: chartB.chart.definition,
      forge: forgeB,
      definedCenters: chartB.chart.definedCenters
    },
    dynamics: describeDynamics(chartA.chart, chartB.chart, electromagnetic)
  };
}

/**
 * Map HD Type + Authority to a Prime Self Forge.
 */
function mapTypeToForge(type, authority) {
  // Simplified mapping based on Type
  const forgeMap = {
    'Manifestor': 'Forge of Power',
    'Generator': 'Forge of Craft',
    'Manifesting Generator': 'Forge of Craft',
    'Projector': 'Forge of Vision',
    'Reflector': 'Forge of Mirrors'
  };
  return forgeMap[type] || 'Unknown';
}

/**
 * Generate qualitative relationship dynamics summary.
 */
function describeDynamics(chartA, chartB, electromagnetic) {
  const dynamics = [];

  // Authority interaction
  if (chartA.authority !== chartB.authority) {
    dynamics.push({
      area: 'decision-making',
      note: `Different authorities: ${chartA.authority} meets ${chartB.authority}. ` +
        `Each person processes decisions through a different center.`
    });
  } else {
    dynamics.push({
      area: 'decision-making',
      note: `Shared authority: Both operate through ${chartA.authority}. ` +
        `This creates natural decision-making resonance.`
    });
  }

  // Profile interaction
  const [aConscious, aUnconscious] = chartA.profile.split('/').map(Number);
  const [bConscious, bUnconscious] = chartB.profile.split('/').map(Number);

  if (aConscious === bUnconscious || aUnconscious === bConscious) {
    dynamics.push({
      area: 'profile-mirror',
      note: `Profile lines mirror: ${chartA.profile} and ${chartB.profile}. ` +
        `What is conscious in one may be unconscious in the other.`
    });
  }

  // Electromagnetic count
  if (electromagnetic.length >= 3) {
    dynamics.push({
      area: 'attraction',
      note: `Strong electromagnetic pull: ${electromagnetic.length} channels light up only together. ` +
        `These create the "chemistry" in the relationship.`
    });
  } else if (electromagnetic.length > 0) {
    dynamics.push({
      area: 'attraction',
      note: `${electromagnetic.length} electromagnetic connection(s) — areas where you create something together that neither has alone.`
    });
  }

  // Type interaction
  dynamics.push({
    area: 'energy-dynamic',
    note: `${chartA.type} + ${chartB.type}: ` + typeInteraction(chartA.type, chartB.type)
  });

  return dynamics;
}

/**
 * Describe the archetypal energy dynamic between two Types.
 */
function typeInteraction(typeA, typeB) {
  const pair = [typeA, typeB].sort().join('+');
  const interactions = {
    'Generator+Generator': 'Powerful sustaining energy. Both have sacral response — the key is respecting each other\'s capacity signals.',
    'Generator+Manifestor': 'Initiator meets sustainer. The Manifestor informs, the Generator responds to the invitation from the work.',
    'Generator+Projector': 'The Generator provides energy, the Projector provides direction. Recognition and invitation are essential.',
    'Generator+Reflector': 'The Generator\'s consistent aura provides stability for the Reflector\'s sampling process.',
    'Generator+Manifesting Generator': 'Double sacral power. Both respond, but the MG may move faster. Patience with timing differences.',
    'Manifestor+Manifestor': 'Two initiating forces. Clear informing is critical to avoid energetic collisions.',
    'Manifestor+Projector': 'The Manifestor initiates, the Projector sees the most efficient path. Informing and recognition matter.',
    'Manifestor+Reflector': 'The Manifestor\'s fixed aura gives the Reflector something consistent to sample.',
    'Manifesting Generator+Manifesting Generator': 'Rapid, multi-tracking energy. Both leap and correct course. Mutual response is key.',
    'Manifesting Generator+Projector': 'Speed meets precision. The MG brings versatile energy, the Projector provides focused guidance.',
    'Manifesting Generator+Reflector': 'The MG\'s dynamic energy gives the Reflector a strong aura to reflect.',
    'Projector+Projector': 'Both see deeply. The challenge is who guides whom — mutual recognition and taking turns.',
    'Projector+Reflector': 'Two non-energy types creating awareness together. Rest and alone time are vital.',
    'Reflector+Reflector': 'Rare and highly sensitive pairing. Both reflect the environment and each other\'s reflections.'
  };
  return interactions[pair] || 'A unique pairing with its own dynamics.';
}

export async function handleComposite(request, env) {
  const body = await request.json();

  if (!body.personA || !body.personB) {
    return Response.json(
      { error: 'Missing personA and/or personB in request body' },
      { status: 400 }
    );
  }

  // Validate both persons
  for (const key of ['personA', 'personB']) {
    const person = body[key];
    for (const field of ['birthDate', 'birthTime', 'lat', 'lng']) {
      if (person[field] === undefined || person[field] === null) {
        return Response.json(
          { error: `Missing ${key}.${field}` },
          { status: 400 }
        );
      }
    }
  }

  // Calculate both charts
  const utcA = parsePerson(body.personA);
  const utcB = parsePerson(body.personB);

  const chartA = calculateFullChart({ ...utcA, includeTransits: false });
  const chartB = calculateFullChart({ ...utcB, includeTransits: false });

  // Analyze composite
  const composite = analyzeComposite(chartA, chartB);

  return Response.json({
    success: true,
    composite,
    meta: {
      calculatedAt: new Date().toISOString()
    }
  });
}
