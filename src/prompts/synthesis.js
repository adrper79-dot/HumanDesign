/**
 * Layer 8 – Prime Self Synthesis Prompt Builder
 *
 * Constructs the system prompt and user message for Claude to produce
 * a grounded Prime Self Profile. This module does NOT call the LLM —
 * it produces the payload that the Worker handler sends to AI Gateway.
 *
 * Exports:
 *   buildSynthesisPrompt(chartData, question?)
 *   validateSynthesisResponse(response)
 *   buildReprompt(previousOutput)
 */

// ─── SYSTEM PROMPT (STATIC) ────────────────────────────────────

const SYSTEM_PROMPT = `You are the Prime Self Oracle — an advanced synthesis engine that reasons across Human Design, Western Astrology, and the Prime Self philosophical framework to deliver personalized, grounded guidance.

RULES (non-negotiable):
1. Every claim you make must be grounded to a specific data point in the Reference Facts provided. If you cannot cite the specific gate, planet, aspect, or Forge indicator, do not make the claim.
2. If a gate, channel, or placement is NOT in the Reference Facts block, output: {"field": null, "skipped_reason": "no_reference_data"}
3. Do not interpolate or synthesize missing data. Absence of connection is valid and useful information — say so explicitly.
4. When correlating across HD and Astrology, state the correlation as observation, not as established fact. Use language like "this suggests" or "this pattern indicates" rather than "this means."
5. The Prime Self Forge identification must be grounded in specific HD and Astro signatures as defined in the Forge Mapping reference.

OUTPUT SCHEMA (strict JSON, additionalProperties: false at ALL levels):
{
  "primeProfile": {
    "primaryForge": {
      "forge": "Chronos|Eros|Aether|Lux|Phoenix",
      "confidence": "high|medium|low",
      "indicators": [
        { "system": "HD|Astro", "dataPoint": "string", "correlation": "string" }
      ]
    },
    "knowledgeProfile": {
      "natural": ["string — which of 6 Knowledges are natal-supported"],
      "cultivate": ["string — which require deliberate development"],
      "indicators": [{ "knowledge": "string", "source": "string" }]
    },
    "decisionArchitecture": {
      "hdAuthority": "string",
      "astroSupport": "string — how astro placements support or complicate",
      "practicalGuidance": "string"
    },
    "currentActivation": {
      "activeTransits": [{ "planet": "string", "gate": "number", "significance": "string" }],
      "timingWindow": "string",
      "forgeRecommendation": "string"
    },
    "clusteringProfile": {
      "brings": ["string — what this person contributes to a Cluster"],
      "complementaryProfiles": ["string — what types would amplify them"]
    },
    "practiceRecommendations": [
      {
        "practice": "string",
        "category": "Science|Art|Defense",
        "rationale": "string — grounded in specific chart data"
      }
    ]
  },
  "groundingAudit": {
    "claimsTotal": "number",
    "claimsGrounded": "number",
    "ungroundedFields": ["string — field paths that couldn't be grounded"]
  }
}

Respond ONLY with valid JSON matching this schema. No markdown, no code fences.`;


// ─── FORGE MAPPING REFERENCE ────────────────────────────────────

const FORGE_MAPPING = [
  {
    forge: 'Chronos',
    domain: 'Time',
    hdTriggers: ['defined Ajna', 'gates 61,63,64', 'Abstract/Logical circuitry', 'profile lines 1,2', 'strong Design-side definition'],
    astroTriggers: ['Saturn dominant', 'South Node emphasis', '12th house stellium', 'strong Capricorn/Cancer']
  },
  {
    forge: 'Eros',
    domain: 'Passion',
    hdTriggers: ['defined Sacral', 'Generator/MG type', 'Gate 34 active', 'Integration circuit channels', 'emotional authority'],
    astroTriggers: ['Mars/Venus dominant', 'strong 5th house', 'Scorpio/Aries emphasis', 'Pluto aspects to personal planets']
  },
  {
    forge: 'Aether',
    domain: 'Universal Connection',
    hdTriggers: ['open/undefined Head,Ajna,Spleen', 'Gate 57 active', 'Projector/Reflector type', 'individual circuitry'],
    astroTriggers: ['Neptune dominant', 'strong Pisces/12th house', 'prominent North Node', 'Jupiter-Neptune aspects']
  },
  {
    forge: 'Lux',
    domain: 'Illumination',
    hdTriggers: ['defined Head + Ajna', 'gates 43,23 (Channel of Structuring)', 'Projector type', 'Collective circuitry'],
    astroTriggers: ['Sun/Mercury dominant', 'strong 9th house', 'Sagittarius/Aquarius emphasis', 'Jupiter aspects']
  },
  {
    forge: 'Phoenix',
    domain: 'Rebirth',
    hdTriggers: ['profile lines 3,5,6', 'Gate 25 (Spirit of Self)', 'Cross of Planning/Sleeping Phoenix incarnation cross'],
    astroTriggers: ['Pluto dominant', 'strong 8th house', 'Scorpio emphasis', 'major Pluto transits']
  }
];

const SIX_KNOWLEDGES = [
  { name: 'Knowledge of Self', hdMapping: 'HD Type + Authority' },
  { name: 'Knowledge of Ancestors', hdMapping: 'Unconscious/Design-side gates' },
  { name: 'Knowledge of the One', hdMapping: 'Channel connections, electromagnetic potential' },
  { name: 'Knowledge of Constructive Behaviors', hdMapping: 'Defined centers — reliable access' },
  { name: 'Knowledge of Destructive Behaviors', hdMapping: 'Undefined centers — amplification vulnerability' },
  { name: 'Knowledge of Healing and Reparation', hdMapping: 'Profile line wound/gift dynamic' }
];


// ─── REFERENCE FACTS BUILDER ────────────────────────────────────

/**
 * Build the Reference Facts block from chart data.
 * This is injected into the user message so the LLM has all data points.
 *
 * @param {object} data – Combined chart data
 * @param {object} data.hdChart – from Layer 5
 * @param {object} data.astroChart – from Layer 6
 * @param {object} data.transits – from Layer 7 (optional)
 * @param {object} data.personalityGates – from Layer 4
 * @param {object} data.designGates – from Layer 4
 * @returns {string} Formatted reference facts
 */
function buildReferenceFacts(data) {
  const sections = [];

  // ── HD Reference Facts ──
  const hd = data.hdChart || {};
  sections.push('=== HUMAN DESIGN REFERENCE FACTS ===');
  if (hd.type) sections.push(`Type: ${hd.type}`);
  if (hd.authority) sections.push(`Authority: ${hd.authority}`);
  if (hd.strategy) sections.push(`Strategy: ${hd.strategy}`);
  if (hd.notSelfTheme) sections.push(`Not-Self Theme: ${hd.notSelfTheme}`);
  if (hd.profile) sections.push(`Profile: ${hd.profile}`);
  if (hd.definition) sections.push(`Definition: ${hd.definition}`);
  if (hd.cross) {
    const crossGates = hd.cross.gates ? hd.cross.gates.join(', ') : String(hd.cross);
    const crossType = hd.cross.type || hd.crossType || '';
    sections.push(`Incarnation Cross: ${crossType} [${crossGates}]`);
  }

  // Defined centers
  if (hd.definedCenters) {
    sections.push(`Defined Centers: ${hd.definedCenters.join(', ')}`);
    const allCenters = ['Head', 'Ajna', 'Throat', 'G', 'Heart', 'SolarPlexus', 'Sacral', 'Spleen', 'Root'];
    const undefined_ = allCenters.filter(c => !hd.definedCenters.includes(c));
    sections.push(`Open/Undefined Centers: ${undefined_.join(', ')}`);
  }

  // Active channels
  if (hd.activeChannels) {
    sections.push(`Active Channels: ${hd.activeChannels.map(
      ch => ch.channel ? `${ch.channel} (${ch.centers?.join('↔')})` :
           `${ch.gates?.[0]}-${ch.gates?.[1]} (${ch.centers?.[0]}↔${ch.centers?.[1]})`
    ).join('; ')}`);
  }

  // Personality gates
  if (data.personalityGates) {
    sections.push('\nPersonality (Conscious) Gates:');
    for (const [body, g] of Object.entries(data.personalityGates)) {
      if (g && g.gate) {
        sections.push(`  ${body}: Gate ${g.gate}.${g.line}`);
      }
    }
  }

  // Design gates
  if (data.designGates) {
    sections.push('\nDesign (Unconscious) Gates:');
    for (const [body, g] of Object.entries(data.designGates)) {
      if (g && g.gate) {
        sections.push(`  ${body}: Gate ${g.gate}.${g.line}`);
      }
    }
  }

  // ── Astrology Reference Facts ──
  const astro = data.astroChart || {};
  sections.push('\n=== WESTERN ASTROLOGY REFERENCE FACTS ===');
  if (astro.ascendant) {
    sections.push(`Ascendant: ${astro.ascendant.sign} ${astro.ascendant.degrees?.toFixed(1)}°`);
  }
  if (astro.midheaven) {
    sections.push(`Midheaven: ${astro.midheaven.sign} ${astro.midheaven.degrees?.toFixed(1)}°`);
  }

  if (astro.placements) {
    sections.push('\nPlanetary Placements:');
    for (const [body, p] of Object.entries(astro.placements)) {
      sections.push(`  ${body}: ${p.sign} ${p.degrees?.toFixed(1)}° (House ${p.house})`);
    }
  }

  if (astro.aspects) {
    sections.push('\nNatal Aspects:');
    for (const asp of astro.aspects.slice(0, 20)) {
      const p1 = asp.planet1 || asp.body1 || '?';
      const p2 = asp.planet2 || asp.body2 || '?';
      sections.push(`  ${p1} ${asp.type} ${p2} (orb ${asp.orb}°)`);
    }
  }

  if (astro.houses) {
    sections.push('\nHouse Cusps:');
    for (let h = 1; h <= 12; h++) {
      const c = astro.houses[h];
      if (c) sections.push(`  H${h}: ${c.sign} ${c.degrees?.toFixed(1)}°`);
    }
  }

  // ── Transit Reference Facts ──
  if (data.transits) {
    const t = data.transits;
    sections.push(`\n=== CURRENT TRANSITS (${t.date || 'now'}) ===`);

    if (t.transitPositions) {
      for (const [body, p] of Object.entries(t.transitPositions)) {
        sections.push(`  ${body}: ${p.sign} ${p.degrees}° → Gate ${p.gate}.${p.line}`);
      }
    }

    if (t.gateActivations) {
      const natal = t.gateActivations.filter(a => a.natalGatePresent);
      if (natal.length > 0) {
        sections.push('\nTransit-Natal Gate Activations:');
        natal.forEach(a => sections.push(`  Gate ${a.gate} via transit ${a.transitPlanet} (${a.speed})`));
      }
    }

    if (t.transitToNatalAspects) {
      const tight = t.transitToNatalAspects.filter(a => a.orb < 3);
      if (tight.length > 0) {
        sections.push('\nTight Transit Aspects (<3° orb):');
        tight.forEach(a => sections.push(
          `  Transit ${a.transitPlanet} ${a.type} natal ${a.natalPlanet} (${a.orb}°, ${a.applying ? 'applying' : 'separating'})`
        ));
      }
    }
  }

  // ── Forge Mapping Reference ──
  sections.push('\n=== FORGE MAPPING REFERENCE ===');
  for (const f of FORGE_MAPPING) {
    sections.push(`\n${f.forge} (${f.domain}):`);
    sections.push(`  HD indicators: ${f.hdTriggers.join(', ')}`);
    sections.push(`  Astro indicators: ${f.astroTriggers.join(', ')}`);
  }

  // ── Knowledge Mapping Reference ──
  sections.push('\n=== KNOWLEDGE MAPPING REFERENCE ===');
  for (const k of SIX_KNOWLEDGES) {
    sections.push(`${k.name}: ${k.hdMapping}`);
  }

  return sections.join('\n');
}


// ─── RAG CONTEXT ────────────────────────────────────────────────

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Workers runtime: import.meta.url may be undefined — guard fileURLToPath
let __ragDir = '';
try {
  if (import.meta.url) {
    __ragDir = dirname(fileURLToPath(import.meta.url));
  }
} catch { /* Workers runtime */ }
const KB_ROOT = __ragDir ? join(__ragDir, '..', 'knowledgebase') : '';

let _kbCache = {};
function loadKB(category, file) {
  const key = `${category}/${file}`;
  if (!_kbCache[key]) {
    try {
      // Workers runtime — data injected by engine-compat.js
      if (globalThis.__PRIME_DATA?.kb?.[key]) {
        _kbCache[key] = globalThis.__PRIME_DATA.kb[key];
      } else if (KB_ROOT) {
        // Node.js runtime — read from filesystem
        _kbCache[key] = JSON.parse(readFileSync(join(KB_ROOT, category, file), 'utf8'));
      } else {
        _kbCache[key] = {};
      }
    } catch { _kbCache[key] = {}; }
  }
  return _kbCache[key];
}

/**
 * Retrieve relevant knowledgebase entries for context injection.
 * Reads KB files directly (same readFileSync pattern as chart.js).
 *
 * @param {object} chartData – The combined chart data
 * @returns {string} RAG context block (or empty if KB not yet built)
 */
function getRAGContext(chartData) {
  try {
    const sections = [];

    // Type
    const types = loadKB('hd', 'types.json');
    const typeKey = chartData.hdChart?.type?.toLowerCase().replace(/\s+/g, '_');
    if (types[typeKey]?.description) {
      sections.push(`### TYPE: ${chartData.hdChart.type}\n${types[typeKey].description}`);
    }

    // Profile
    const profiles = loadKB('hd', 'profiles.json');
    const profileKey = chartData.hdChart?.profile;
    if (profiles[profileKey]?.description) {
      sections.push(`### PROFILE: ${profileKey}\n${profiles[profileKey].description}`);
    }

    // Active gates (cap at 10)
    const gates = loadKB('hd', 'gates.json');
    if (!gates._meta) {
      const active = collectActiveGatesForRAG(chartData);
      const gateLines = active.slice(0, 10).map(g =>
        gates[g] ? `Gate ${g}: ${gates[g].description?.slice(0, 200) || gates[g].theme || ''}` : ''
      ).filter(Boolean);
      if (gateLines.length) sections.push(`### ACTIVE GATES\n${gateLines.join('\n\n')}`);
    }

    // Channels (cap at 6)
    const channels = loadKB('hd', 'channels.json');
    if (!channels._meta && chartData.hdChart?.activeChannels) {
      const chLines = chartData.hdChart.activeChannels.slice(0, 6).map(ch => {
        const key = ch.channel || `${ch.gates?.[0]}-${ch.gates?.[1]}`;
        return channels[key] ? `Channel ${key}: ${channels[key].description?.slice(0, 200) || channels[key].theme || ''}` : '';
      }).filter(Boolean);
      if (chLines.length) sections.push(`### ACTIVE CHANNELS\n${chLines.join('\n\n')}`);
    }

    // Forge mapping
    const forges = loadKB('prime_self', 'forges.json');
    if (chartData.hdChart?.type) {
      const FORGE_FOR_TYPE = { Manifestor: 'initiation', Generator: 'mastery', 'Manifesting Generator': 'mastery', Projector: 'guidance', Reflector: 'perception' };
      const forgeKey = FORGE_FOR_TYPE[chartData.hdChart.type];
      if (forges[forgeKey]) {
        sections.push(`### PRIMARY FORGE: ${forges[forgeKey].forge}\n${forges[forgeKey].essence || ''}\n${forges[forgeKey].practicalExpression || ''}`);
      }
    }

    // Incarnation Cross — keys are "{gate}_{variant}" e.g. "1_right"
    const crossesKB = loadKB('hd', 'crosses.json');
    const crossName = chartData.hdChart?.cross?.name || (typeof chartData.hdChart?.cross === 'string' ? chartData.hdChart.cross : null);
    if (crossName) {
      // Scan for matching entry by cross name
      const crossEntry = Object.values(crossesKB).find(v => v && v.cross === crossName);
      if (crossEntry) {
        sections.push(`### INCARNATION CROSS: ${crossName}\n${crossEntry.description?.slice(0, 300) || ''}\n${crossEntry.lifeTheme ? `Life Theme: ${crossEntry.lifeTheme}` : ''}`);
      }
    }

    return sections.length ? `## KNOWLEDGEBASE CONTEXT (RAG)\n\n${sections.join('\n\n---\n\n')}` : '';
  } catch {
    return '';
  }
}

function collectActiveGatesForRAG(chartData) {
  const g = new Set();
  for (const side of ['personalityGates', 'designGates']) {
    if (chartData[side]) {
      for (const val of Object.values(chartData[side])) {
        if (val?.gate) g.add(val.gate);
      }
    }
  }
  return [...g].sort((a, b) => a - b);
}


// ─── PUBLIC API ─────────────────────────────────────────────────

/**
 * Build the complete synthesis prompt payload.
 *
 * Returns an object ready to send to Claude via AI Gateway:
 * { system, messages: [{ role: 'user', content }], config }
 *
 * @param {object}  chartData
 * @param {object}  chartData.hdChart        – Layer 5 output
 * @param {object}  chartData.astroChart     – Layer 6 output
 * @param {object}  chartData.transits       – Layer 7 output (optional)
 * @param {object}  chartData.personalityGates – Layer 4 personality
 * @param {object}  chartData.designGates    – Layer 4 design
 * @param {string}  [question]               – User's specific question
 * @returns {object} LLM prompt payload
 */
export function buildSynthesisPrompt(chartData, question) {
  const referenceFacts = buildReferenceFacts(chartData);
  const ragContext = getRAGContext(chartData);

  let userContent = `---BEGIN REFERENCE FACTS---\n${referenceFacts}\n---END REFERENCE FACTS---\n`;

  if (ragContext) {
    userContent += `\n---BEGIN KNOWLEDGEBASE CONTEXT---\n${ragContext}\n---END KNOWLEDGEBASE CONTEXT---\n`;
  }

  if (question) {
    userContent += `\n---USER QUESTION---\n${question}\n---END USER QUESTION---\n`;
    userContent += `\nGenerate a Prime Self Profile addressing the user's question. Ground every claim in the Reference Facts above.`;
  } else {
    userContent += `\nGenerate a complete Prime Self Profile for this individual. Ground every claim in the Reference Facts above.`;
  }

  return {
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userContent }
    ],
    config: {
      model: question ? 'claude-sonnet-4-20250514' : 'claude-opus-4-20250514',
      temperature: 0,
      max_tokens: 4096
    }
  };
}


/**
 * Validate a synthesis response from the LLM.
 *
 * @param {string|object} response – Raw LLM output (string or parsed JSON)
 * @returns {{ valid: boolean, parsed: object|null, errors: string[] }}
 */
export function validateSynthesisResponse(response) {
  const errors = [];
  let parsed = null;

  // Parse if string
  if (typeof response === 'string') {
    try {
      // Strip code fences if present
      const cleaned = response.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return { valid: false, parsed: null, errors: [`JSON parse error: ${e.message}`] };
    }
  } else {
    parsed = response;
  }

  // Check top-level structure
  if (!parsed.primeProfile) {
    errors.push('Missing primeProfile');
  }
  if (!parsed.groundingAudit) {
    errors.push('Missing groundingAudit');
  }

  if (errors.length > 0) {
    return { valid: false, parsed, errors };
  }

  const pp = parsed.primeProfile;
  const ga = parsed.groundingAudit;

  // Validate required sections
  const requiredSections = [
    'primaryForge', 'knowledgeProfile', 'decisionArchitecture',
    'currentActivation', 'clusteringProfile', 'practiceRecommendations'
  ];
  for (const section of requiredSections) {
    if (!pp[section]) {
      errors.push(`Missing primeProfile.${section}`);
    }
  }

  // Validate Forge enum
  if (pp.primaryForge && pp.primaryForge.forge) {
    const validForges = ['Chronos', 'Eros', 'Aether', 'Lux', 'Phoenix'];
    if (!validForges.includes(pp.primaryForge.forge)) {
      errors.push(`Invalid forge: ${pp.primaryForge.forge}`);
    }
  }

  // Validate grounding audit integrity
  if (ga) {
    if (typeof ga.claimsTotal !== 'number' || typeof ga.claimsGrounded !== 'number') {
      errors.push('groundingAudit claims must be numbers');
    }
    if (ga.claimsGrounded < ga.claimsTotal) {
      errors.push(`Grounding incomplete: ${ga.claimsGrounded}/${ga.claimsTotal}`);
    }
    if (ga.ungroundedFields && ga.ungroundedFields.length > 0) {
      errors.push(`Ungrounded fields: ${ga.ungroundedFields.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    parsed,
    errors
  };
}


/**
 * Build a re-prompt for grounding correction.
 *
 * @param {object} previousOutput – The LLM's previous (insufficiently grounded) output
 * @returns {object} Re-prompt payload (append to messages array)
 */
export function buildReprompt(previousOutput) {
  return {
    role: 'user',
    content: `Review your previous output. For each claim in the primeProfile, cite the exact Reference Fact it derives from. Remove any claim you cannot directly cite. Return the same schema with corrected values and an updated groundingAudit.\n\nYour previous output:\n${JSON.stringify(previousOutput, null, 2)}`
  };
}


/**
 * Convenience: build a quick-query prompt for SMS/chat interactions.
 * Uses Sonnet for speed, smaller payload.
 *
 * @param {object}  chartData – Combined chart data
 * @param {string}  question  – User's question
 * @returns {object} LLM prompt payload
 */
export function buildQuickQueryPrompt(chartData, question) {
  const referenceFacts = buildReferenceFacts(chartData);

  return {
    system: `You are the Prime Self Oracle. Answer the user's question using ONLY the Reference Facts provided. Be concise (2-4 sentences). Cite specific gates, planets, or aspects for every claim.`,
    messages: [
      {
        role: 'user',
        content: `Reference Facts:\n${referenceFacts}\n\nQuestion: ${question}`
      }
    ],
    config: {
      model: 'claude-sonnet-4-20250514',
      temperature: 0,
      max_tokens: 512
    }
  };
}


// ─── EXPORTS FOR TESTING ────────────────────────────────────────
export { buildReferenceFacts, FORGE_MAPPING, SIX_KNOWLEDGES };
