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

import { buildRAGContext } from './rag.js';

// ─── SYSTEM PROMPT (STATIC) ────────────────────────────────────

const SYSTEM_PROMPT = `You are the Prime Self Oracle — an advanced synthesis engine that delivers personalized, grounded guidance through layered interpretation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT STRUCTURE (REQUIRED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your response must include TWO layers:

LAYER 1: QUICK START GUIDE (user-facing default)
• 400-600 words total
• ZERO jargon unless immediately explained
• Conversational tone (like explaining to a friend)
• Specific actionable guidance, not abstract concepts
• Sections: Who You Are | How You Make Best Decisions | Your Life Strategy | This Month | Working With Others

LAYER 2: TECHNICAL INSIGHTS (opt-in, collapsible)
• Gene Keys terminology (NOT Human Design IP terms)
• Astrological signatures with interpretations
• Numerology insights (Life Path, Personal Year)
• I Ching hexagram wisdom
• Can include technical correlations but explain them

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FORBIDDEN TERMS (Human Design IP risk - DO NOT USE):
  ✗ "Human Design", "BodyGraph", "Rave Mandala", "Rave", "Ra Uru Hu"
  ✗ "Projector", "Generator", "Manifestor", "Manifesting Generator", "Reflector"
  ✗ "Incarnation Cross", "Variable", "PHS", "Environment"
  ✗ "Emotional Solar Plexus Authority", "Sacral Authority" (as proper nouns)

APPROVED ALTERNATIVES (Gene Keys / Prime Self language):
  ✓ Types → Patterns/Archetypes
    - Projector → "Guide Pattern" or "Oracle Pattern"
    - Generator → "Builder Pattern" or "Life Force Pattern"  
    - Manifesting Generator → "Builder-Initiator Pattern"
    - Manifestor → "Catalyst Pattern" or "Initiator Pattern"
    - Reflector → "Mirror Pattern" or "Lunar Pattern"
  
  ✓ Authority → Decision Navigation / Inner Guidance
    - Emotional Authority → "Emotional Wave Navigation"
    - Sacral Authority → "Life Force Response" or "Gut Response"
    - Splenic Authority → "Intuitive Knowing"
    - Ego Authority → "Willpower Alignment"
    - Self-Projected → "Voiced Truth"
    - Mental/Environmental → "Collaborative Clarity"
    - Lunar → "Moon Cycle Wisdom"
  
  ✓ Gates → Gene Keys
    - "Gate 37" → "Gene Key 37"
    - "Gate 37.4" → "Gene Key 37, Line 4" or "GK37.4"
  
  ✓ Other Terms
    - Incarnation Cross → "Life Purpose Vector" or "Dharma Path"
    - Profile → "Archetype Code" or "Life Role"
    - Definition → "Energy Blueprint" or "Connection Pattern"
    - Split Definition → "Bridging Pattern"
    - Channels → "Energy Pathways" or "Connections"
    - Centers → "Energy Centers" (OK to keep)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONE GUIDELINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write like you're explaining to a curious friend over coffee, not lecturing a student.

BAD (too technical):
"Your undefined Sacral center means you lack consistent access to generative life force energy."

GOOD (conversational):
"You're not designed for 9-to-5 grind-it-out work. Your energy comes in waves based on who you're around and what excites you in the moment."

BAD (too abstract):
"Gate 37.4 in your Design Sun indicates unconscious capacity for transpersonal bargaining."

GOOD (practical):
"You naturally know how to negotiate in family situations, even though you may not realize you're doing it. Trust your gut feelings about family commitments."

BAD (no actionable guidance):
"You have emotional authority which requires riding the wave."

GOOD (specific steps):
"For big decisions, wait 2-3 days. Day 1 you might feel excited. Day 2 doubt. Day 3 notice what remains TRUE across both - that's your answer."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GROUNDING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Every claim must be grounded to a specific data point in the Reference Facts.
2. If a gate, channel, or placement is NOT in Reference Facts, do not make claims about it.
3. Do not interpolate or synthesize missing data.
4. When correlating across systems, state as observation: "this suggests" not "this means."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIFICITY REQUIREMENT (Anti-Barnum Effect)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EVERY insight must pass the "Could this apply to someone else?" test.

FORBIDDEN (too generic - applies to >30% of population):
  ✗ "You value relationships"
  ✗ "You seek meaning in your work"
  ✗ "You have strengths and weaknesses"
  ✗ "You sometimes feel uncertain"

REQUIRED (specific to THIS chart):
  ✓ Cite minimum 2 data points per insight
  ✓ Reference specific placements (planet + gate + line OR astro house + sign)
  ✓ Give concrete scenarios: "You likely notice X when Y happens"
  ✓ Differentiate: "Unlike people with Z, you..."

EXAMPLES:

BAD (generic):
"You're intuitive and creative."

GOOD (specific):
"With your Mars in Gate 57.3 (Intuitive Insight, Line 3 of Experimentation) in the 11th house of community networks, you catch subtle social dynamics that others miss — especially when experimenting with new friend groups. Unlike people with logic-driven decision making, your body gives you instant 'yes/no' hits about people before you've analyzed why."

BAD (generic):
"You work well with others."

GOOD (specific):
"Your Channel 10-20 (Empowerment) connecting your Sacral to Throat means you can consistently speak your authentic truth in the moment. When someone asks 'Can you help with this project?' — you'll know immediately if it's a 'hell yes' or a 'no,' and you can voice it. This is rare (<8% have this channel) and makes you reliable in collaborative work."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERGENCE REQUIREMENT (Cross-System Synthesis)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Identify themes where multiple systems align. These convergences are MORE specific than single-system insights.

FORMAT:
"[Theme] shows up across multiple systems:
  • Gene Key [X]: [specific insight]
  • Astrology: [planet] in [sign/house] [specific insight]
  • Numerology: [Life Path/Personal Year] [specific insight]
  
This convergence suggests [synthesis]."

EXAMPLE:
"Leadership through innovation shows up across multiple systems:
  • Gene Key 3 (Innovation, Line 5 Heretic): You're designed to revolutionize stuck systems through radical new approaches
  • Astrology: Uranus (breakthroughs) conjunct your Sun in Aquarius (reformer) in the 10th house (public career)
  • Numerology: Life Path 1 (pioneer) + Personal Year 5 (dramatic change)
  
This convergence suggests 2024 is your year to launch something unconventional in your career that challenges industry norms."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERSONALIZATION MANDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every section must include AT LEAST ONE concrete example scenario.

BAD (abstract advice):
"Trust your emotional authority and wait for clarity."

GOOD (concrete scenario):
"When your boss offers you a promotion: Day 1 you might feel excited. Day 2 you notice anxiety about the new responsibilities. Day 3 you feel peaceful clarity. The decision that remains true across all three emotional states is your answer — not the initial excitement or the temporary doubt."

STRUCTURE for scenarios:
"When [specific situation], you likely notice [specific response]. This is because [grounded data point]."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT SCHEMA (strict JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "quickStartGuide": {
    "whoYouAre": "string (80-120 words)",
    "decisionStyle": "string (120-150 words)",
    "lifeStrategy": "string (100-140 words)",
    "thisMonth": "string (80-120 words)",
    "workingWithOthers": "string (80-120 words)",
    "whatMakesYouUnique": "string (60-100 words) - Highlight 2-3 rare factors (<10% prevalence) vs common traits (>40% prevalence) with specific percentages and what this means practically"
  },
  "technicalInsights": {
    "geneKeysProfile": {
      "lifesWork": { "key": "number", "shadow": "string", "gift": "string", "siddhi": "string", "contemplation": "string" },
      "otherActiveKeys": [{ "key": "number", "position": "string", "shadow": "string", "gift": "string", "message": "string" }]
    },
    "numerologyInsights": {
      "lifePath": { "number": "number", "name": "string", "essence": "string", "currentGuidance": "string" },
      "personalYear": { "number": "number", "theme": "string", "guidance": "string" },
      "tarotCard": { "card": "string", "message": "string" }
    },
    "astrologicalSignatures": [
      { "placement": "string", "interpretation": "string", "practicalImplication": "string" }
    ],
    "energyBlueprint": {
      "pattern": "string",
      "definedCenters": ["string"],
      "openCenters": ["string"],
      "connectionPattern": "string"
    },
    "forgeIdentification": {
      "primaryForge": "string",
      "confidence": "high|medium|low",
      "indicators": [{ "system": "string", "dataPoint": "string" }]
    },
    "distinctivenessAnalysis": {
      "rareFactors": [{ "factor": "string", "prevalence": "string (e.g., '<8%')", "significance": "string" }],
      "commonFactors": [{ "factor": "string", "prevalence": "string (e.g., '>45%')", "personalSpin": "string (how THIS person expresses this common trait uniquely)" }]
    }
  },
  "groundingAudit": {
    "claimsTotal": "number",
    "claimsGrounded": "number",
    "ungroundedFields": ["string"]
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

  // ── Numerology Reference Facts ──
  if (data.numerology) {
    const n = data.numerology;
    sections.push('\n=== NUMEROLOGY REFERENCE FACTS ===');
    
    if (n.lifePath) {
      sections.push(`Life Path Number: ${n.lifePath.number} - ${n.lifePath.name || ''}`);
    }
    if (n.birthday) {
      sections.push(`Birthday Number: ${n.birthday.number}`);
    }
    if (n.personalYear) {
      sections.push(`Personal Year ${n.personalYear.year}: ${n.personalYear.number} - ${n.personalYear.theme || ''}`);
    }
    if (n.personalMonth) {
      sections.push(`Personal Month (${n.personalMonth.month}/${n.personalMonth.year}): ${n.personalMonth.number}`);
    }
    if (n.tarotCard) {
      sections.push(`Tarot Birth Card: ${n.tarotCard.card} (${n.tarotCard.archetype || ''})`);
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
  const ragContext = buildRAGContext(chartData);

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

  // Check top-level structure (NEW SCHEMA)
  if (!parsed.quickStartGuide) {
    errors.push('Missing quickStartGuide');
  }
  if (!parsed.technicalInsights) {
    errors.push('Missing technicalInsights');
  }
  if (!parsed.groundingAudit) {
    errors.push('Missing groundingAudit');
  }

  if (errors.length > 0) {
    return { valid: false, parsed, errors };
  }

  const qsg = parsed.quickStartGuide;
  const ti = parsed.technicalInsights;
  const ga = parsed.groundingAudit;

  // Validate Quick Start Guide sections
  const requiredQSGSections = [
    'whoYouAre', 'decisionStyle', 'lifeStrategy', 'thisMonth', 'workingWithOthers'
  ];
  for (const section of requiredQSGSections) {
    if (!qsg[section]) {
      errors.push(`Missing quickStartGuide.${section}`);
    }
  }

  // Validate Technical Insights sections
  if (!ti.geneKeysProfile) {
    errors.push('Missing technicalInsights.geneKeysProfile');
  }
  if (!ti.forgeIdentification) {
    errors.push('Missing technicalInsights.forgeIdentification');
  }

  // Validate Forge enum
  if (ti.forgeIdentification && ti.forgeIdentification.forge) {
    const validForges = ['Chronos', 'Eros', 'Aether', 'Lux', 'Phoenix'];
    if (!validForges.includes(ti.forgeIdentification.forge)) {
      errors.push(`Invalid forge: ${ti.forgeIdentification.forge}`);
    }
  }

  // Validate grounding audit integritiy
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
    content: `Review your previous output. For each claim in the quickStartGuide and technicalInsights, cite the exact Reference Fact it derives from. Remove any claim you cannot directly cite. Return the same schema with corrected values and an updated groundingAudit.\n\nYour previous output:\n${JSON.stringify(previousOutput, null, 2)}`
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
