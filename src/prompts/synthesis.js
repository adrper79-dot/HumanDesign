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
  • Vedic: Nakshatra [name] / [current dasha lord] dasha [specific insight] — include ONLY when present in Reference Facts
  • Ogham: Birth Tree [name] [specific insight] — include ONLY when present in Reference Facts
  
This convergence suggests [synthesis]."

NOTE: Vedic and Ogham data will only appear in Reference Facts when available. When present, integrate them as additional convergence points. When absent, omit.

EXAMPLE:
"Leadership through innovation shows up across multiple systems:
  • Gene Key 3 (Innovation, Line 5 Heretic): You're designed to revolutionize stuck systems through radical new approaches
  • Astrology: Uranus (breakthroughs) conjunct your Sun in Aquarius (reformer) in the 10th house (public career)
  • Numerology: Life Path 1 (pioneer) + Personal Year 5 (dramatic change)
  • Vedic: Ardra nakshatra (intensity and storm that precedes breakthrough, Rahu lord) in a Rahu dasha — a period of amplified disruptive innovation
  • Ogham: Birch birth tree (the pioneer who colonizes new ground before others dare arrive)
  
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
    "vedicOverlay": {
      "moonNakshatra": "string (name + pada + lord — e.g., 'Hasta Pada 3, Moon-ruled')",
      "nakshatraGift": "string (specific gift pattern from this nakshatra)",
      "currentDasha": "string (dasha lord + years remaining + what this period activates)",
      "siderealSun": "string (sidereal Sun sign if notably different from tropical)"
    },
    "celticOghamTree": {
      "tree": "string (name)",
      "period": "string",
      "gift": "string (1 sentence specific to this person's chart context)",
      "shadow": "string (1 sentence)",
      "convergence": "string (how the birth tree resonates with other chart elements)"
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
      "indicators": [{ "system": "string", "dataPoint": "string" }],
      "forgeWeapon": "string (the weapon this person wields from their Forge)",
      "forgeDefense": "string (their natural defensive gift)",
      "shadowWarning": "string (what happens when this Forge goes dark)"
    },
    "distinctivenessAnalysis": {
      "rareFactors": [{ "factor": "string", "prevalence": "string (e.g., '<8%')", "significance": "string" }],
      "commonFactors": [{ "factor": "string", "prevalence": "string (e.g., '>45%')", "personalSpin": "string (how THIS person expresses this common trait uniquely)" }]
    },
    "primingRecommendations": {
      "historicalExemplar": {
        "name": "string",
        "relevance": "string (why this figure resonates with the user's design)",
        "keyLesson": "string (what the user can learn from this figure)",
        "invocationContext": "string (when to invoke this figure's wisdom)"
      },
      "alternateExemplars": ["string (2-3 other relevant historical figures)"],
      "bookRecommendations": {
        "fiction": { "title": "string", "author": "string", "why": "string (how this book serves the user now)" },
        "nonFiction": { "title": "string", "author": "string", "why": "string (how this book supports their development)" }
      },
      "currentKnowledgeFocus": "string (which of the Six Knowledges to prioritize right now)"
    }
  },
  "groundingAudit": {
    "claimsTotal": "number",
    "claimsGrounded": "number",
    "ungroundedFields": ["string"]
  }
}

Respond ONLY with valid JSON matching this schema. No markdown, no code fences.`;


// ─── FORGE MAPPING REFERENCE (CANONICAL) ────────────────────────

const FORGE_MAPPING = [
  {
    forge: 'Chronos',
    domain: 'Time',
    essence: 'The one who conquers time conquers all.',
    hdTriggers: ['defined Ajna', 'gates 61,63,64', 'Abstract/Logical circuitry', 'profile lines 1,2', 'strong Design-side definition'],
    astroTriggers: ['Saturn dominant', 'South Node emphasis', '12th house stellium', 'strong Capricorn/Cancer'],
    weapon: 'Patience — the ability to outlast any obstacle',
    defense: 'Historical Memory — learning from collective past to avoid repetition',
    masterForm: 'The Eternal — one whose work transcends their lifespan',
    shadowForm: 'The Anachronist — paralyzed by reverence for past or fear of future',
    exemplars: ['Marcus Aurelius', 'Marie Curie', 'Warren Buffett', 'H.G. Wells']
  },
  {
    forge: 'Eros',
    domain: 'Passion',
    essence: 'Passion is the engine of creation.',
    hdTriggers: ['defined Sacral', 'Generator/MG type', 'Gate 34 active', 'Integration circuit channels', 'emotional authority'],
    astroTriggers: ['Mars/Venus dominant', 'strong 5th house', 'Scorpio/Aries emphasis', 'Pluto aspects to personal planets'],
    weapon: 'Creative Fire — transforming raw desire into beautiful form',
    defense: 'Heart Coherence — emotional intelligence as protective force',
    masterForm: 'The Lover — whose passion becomes devotional art',
    shadowForm: 'The Addict — consumed by passion rather than channeling it',
    exemplars: ['Frida Kahlo', 'Rumi', 'Freddie Mercury', 'Beethoven']
  },
  {
    forge: 'Aether',
    domain: 'Universal Connection',
    essence: 'The bridge between souls cannot be broken by distance.',
    hdTriggers: ['open/undefined Head,Ajna,Spleen', 'Gate 57 active', 'Projector/Reflector type', 'individual circuitry'],
    astroTriggers: ['Neptune dominant', 'strong Pisces/12th house', 'prominent North Node', 'Jupiter-Neptune aspects'],
    weapon: 'Empathy — feeling the truth of others\' experience',
    defense: 'Sacred Boundaries — protecting openness without closing',
    masterForm: 'The Connector — who facilitates genuine communion',
    shadowForm: 'The Martyr — dissolving self completely in service of others',
    exemplars: ['Thich Nhat Hanh', 'The Dalai Lama', 'Carl Rogers', 'Mother Teresa']
  },
  {
    forge: 'Lux',
    domain: 'Illumination',
    essence: 'Truth, once seen, cannot be unseen.',
    hdTriggers: ['defined Head + Ajna', 'gates 43,23 (Channel of Structuring)', 'Projector type', 'Collective circuitry'],
    astroTriggers: ['Sun/Mercury dominant', 'strong 9th house', 'Sagittarius/Aquarius emphasis', 'Jupiter aspects'],
    weapon: 'Clarity — cutting through confusion to essential truth',
    defense: 'Discernment — knowing what is true from what merely appears true',
    masterForm: 'The Illuminator — whose clarity serves collective awakening',
    shadowForm: 'The Blinder — using light to dazzle rather than enlighten',
    exemplars: ['Nikola Tesla', 'Albert Einstein', 'Ra Uru Hu', 'Steven Spielberg']
  },
  {
    forge: 'Phoenix',
    domain: 'Rebirth',
    essence: 'What rises from ashes carries the wisdom of the fire.',
    hdTriggers: ['profile lines 3,5,6', 'Gate 25 (Spirit of Self)', 'Cross of Planning/Sleeping Phoenix incarnation cross'],
    astroTriggers: ['Pluto dominant', 'strong 8th house', 'Scorpio emphasis', 'major Pluto transits'],
    weapon: 'Transmutation — turning any experience into wisdom',
    defense: 'Resilience — the deep knowing that you have survived before',
    masterForm: 'The Transformer — who guides others through death/rebirth',
    shadowForm: 'The Destroyer — addicted to burning without rebuilding',
    exemplars: ['Nelson Mandela', 'Carl Jung', 'Maya Angelou', 'Malcolm X']
  }
];

const SIX_KNOWLEDGES = [
  { 
    name: 'Knowledge of Self',
    number: 1,
    essence: 'The practitioner who knows themselves cannot be surprised by themselves in battle.',
    hdMapping: 'HD Type + Authority + Profile',
    primeQuestion: 'Who am I when no one is watching and nothing is at stake?'
  },
  { 
    name: 'Knowledge of Ancestors',
    number: 2,
    essence: 'To know your ancestors is to multiply your intelligence across generations.',
    hdMapping: 'Unconscious/Design-side gates + Incarnation Cross',
    primeQuestion: 'What wisdom did my ancestors earn that I can inherit through deliberate practice?'
  },
  { 
    name: 'Knowledge of The One',
    number: 3,
    essence: 'Compassion is the highest form of intelligence, because it sees reality as it is.',
    hdMapping: 'Channel connections, electromagnetic potential, open centers',
    primeQuestion: 'How is what I see in others a reflection of what exists in me?'
  },
  { 
    name: 'Knowledge of Constructive Behaviors',
    number: 4,
    essence: 'These are not rigidly good traits — they are contextually appropriate behaviors chosen with consciousness.',
    hdMapping: 'Defined centers — reliable access, consistent gifts',
    primeQuestion: 'What constructive action is mine to take in this moment?'
  },
  { 
    name: 'Knowledge of Destructive Behaviors',
    number: 5,
    essence: 'Destruction is not inherently negative — sometimes things must be torn down for growth.',
    hdMapping: 'Undefined centers — amplification, vulnerability, wisdom through experience',
    primeQuestion: 'What must I end or destroy so that something better can emerge?'
  },
  { 
    name: 'Knowledge of Healing and Reparation',
    number: 6,
    essence: 'No Prime can be fully reached while carrying unprocessed wounds.',
    hdMapping: 'Profile line wound/gift dynamic, Chiron placement',
    primeQuestion: 'What wound am I carrying that, if healed, would liberate my full power?'
  }
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
 * @param {object} data.validationData – Behavioral validation (optional)
 * @param {object} data.psychometricData – Big Five + VIA (optional)
 * @param {array}  data.diaryEntries – Life events (optional)
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

  // ── Gene Keys Profile Reference Facts ──
  if (data.geneKeys) {
    const gk = data.geneKeys;
    sections.push('\n=== GENE KEYS PROFILE REFERENCE FACTS ===');
    sections.push('(Shadow → Gift → Siddhi triad for each active gate position)');
    const gkPositions = [
      { key: 'lifesWork',  label: "Life's Work (Personality Sun)" },
      { key: 'evolution',  label: 'Evolution (Personality Earth)' },
      { key: 'radiance',   label: 'Radiance (Design Earth — unconscious essence)' },
      { key: 'purpose',    label: 'Purpose (Design Sun — unconscious mission)' },
      { key: 'attraction', label: 'Attraction (Personality Moon — what you draw)' },
      { key: 'iq',         label: 'IQ / Pearl (Design Moon — unconscious intelligence)' },
    ];
    for (const { key, label } of gkPositions) {
      const pos = gk[key];
      if (pos) sections.push(`  ${label}: Gate ${pos.gate}${pos.line ? `.${pos.line}` : ''}`);
    }
  }

  // ── Vedic Astrology Reference Facts ──
  if (data.vedic && !data.vedic.error) {
    const v = data.vedic;
    sections.push('\n=== VEDIC ASTROLOGY (JYOTISH) REFERENCE FACTS ===');
    sections.push(`Ayanamsha (Lahiri): ${v.ayanamsha}°`);

    if (v.moonNakshatra) {
      const nak = v.moonNakshatra;
      sections.push(`Moon Nakshatra: ${nak.name} (Pada ${nak.pada}, lord: ${nak.lord})`);
    }

    if (v.siderealPlacements) {
      const key3 = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'northNode'];
      sections.push('Sidereal Planetary Positions (Rashi):');
      for (const planet of key3) {
        const p = v.siderealPlacements[planet];
        if (p) sections.push(`  ${planet}: ${p.sign} ${p.degreesInSign}°`);
      }
    }

    if (v.dasha) {
      const d = v.dasha;
      sections.push(`Birth Dasha: ${d.birthDashaLord} (${d.birthDashaBalance} yrs remaining at birth)`);
      if (d.current) {
        sections.push(`Current Dasha: ${d.current.lord} — ${d.current.yearsRemaining} yrs remaining`);
      }
    }
  }

  // ── Ogham Birth Tree Reference Facts ──
  if (data.ogham && !data.ogham.error) {
    const og = data.ogham;
    sections.push('\n=== CELTIC OGHAM BIRTH TREE REFERENCE FACTS ===');
    sections.push(`Birth Tree: ${og.treeKey ? og.treeKey.charAt(0).toUpperCase() + og.treeKey.slice(1) : 'Unknown'}`);
  }

  // ── Forge Mapping Reference ──
  sections.push('\n=== FORGE MAPPING REFERENCE (CANONICAL) ===');
  for (const f of FORGE_MAPPING) {
    sections.push(`\n${f.forge} (${f.domain}): "${f.essence}"`);
    sections.push(`  HD indicators: ${f.hdTriggers.join(', ')}`);
    sections.push(`  Astro indicators: ${f.astroTriggers.join(', ')}`);
    sections.push(`  Weapon: ${f.weapon}`);
    sections.push(`  Defense: ${f.defense}`);
    sections.push(`  Master Form: ${f.masterForm}`);
    sections.push(`  Shadow Form: ${f.shadowForm}`);
    sections.push(`  Historical Exemplars: ${f.exemplars.join(', ')}`);
  }

  // ── Knowledge Mapping Reference ──
  sections.push('\n=== SIX KNOWLEDGES REFERENCE (CANONICAL) ===');
  for (const k of SIX_KNOWLEDGES) {
    sections.push(`\n${k.number}. ${k.name}: "${k.essence}"`);
    sections.push(`  HD Mapping: ${k.hdMapping}`);
    sections.push(`  Prime Question: ${k.primeQuestion}`);
  }

  // ── Priming Guidance ──
  sections.push('\n=== PRIMING RECOMMENDATIONS GUIDANCE ===');
  sections.push('For each reading, recommend:');
  sections.push('1. A historical exemplar whose design resonates with the user\'s Forge and Type');
  sections.push('2. One fiction and one non-fiction book matched to their current life focus');
  sections.push('3. Which of the Six Knowledges they should prioritize developing now');
  sections.push('Match historical figures by: HD Type, Forge, and current challenges');
  sections.push('Match books by: Forge, Knowledge area, and stated current focus');

  // ── Behavioral Validation Data ──
  if (data.validationData) {
    const v = data.validationData;
    sections.push('\n=== BEHAVIORAL VALIDATION (LIVED EXPERIENCE) ===');
    
    if (v.decision_pattern) {
      const patternLabels = {
        gut_impulse: 'Gut Impulse (immediate yes/no, can\'t explain why)',
        sleep_on_it: 'Sleep On It (reassess in morning)',
        emotional_wave: 'Emotional Wave (needs 3+ days to ride the wave)',
        wait_invitation: 'Wait for Invitation (needs to be asked/invited)',
        discuss_others: 'Discuss with Others (sounding board, external clarity)',
        environmental: 'Environmental Clarity (depends on location/energy)'
      };
      sections.push(`Decision Pattern: ${patternLabels[v.decision_pattern] || v.decision_pattern}`);
      sections.push('  → Use this to VALIDATE Authority type through actual behavior');
    }
    
    if (v.energy_pattern) {
      const energyLabels = {
        steady_renewing: 'Steady & Self-Renewing (consistent energy all day)',
        bursts_rest: 'Bursts of Power, Then Rest (intense → depleted cycles)',
        mirrors_others: 'Mirrors Others (energy depends on who I\'m with)',
        environment_dependent: 'Environment Dependent (energy changes by location)',
        discerning_sampling: 'Discerning/Sampling (taste before committing)',
        experimental_surprise: 'Experimental (surprises myself, unpredictable)'
      };
      sections.push(`Energy Pattern: ${energyLabels[v.energy_pattern] || v.energy_pattern}`);
      sections.push('  → Use this to VALIDATE Type and defined/open centers');
    }
    
    if (v.current_focus) {
      sections.push(`Current Focus/Challenge: "${v.current_focus}"`);
      sections.push('  → Make synthesis ACTIONABLE by addressing this directly');
    }
  }

  // ── Psychometric Data (Big Five + VIA Strengths) ──
  if (data.psychometricData) {
    const p = data.psychometricData;
    
    if (p.big_five_scores) {
      sections.push('\n=== BIG FIVE PERSONALITY (OCEAN) ===');
      const scores = typeof p.big_five_scores === 'string' 
        ? JSON.parse(p.big_five_scores) 
        : p.big_five_scores;
      
      const scoreLabels = score => {
        if (score >= 4.5) return 'Very High';
        if (score >= 4.0) return 'High';
        if (score >= 3.0) return 'Moderate';
        if (score >= 2.0) return 'Low';
        return 'Very Low';
      };
      
      if (scores.openness !== null) {
        sections.push(`Openness to Experience: ${scores.openness.toFixed(1)} (${scoreLabels(scores.openness)})`);
        sections.push('  → Cross-correlate with: defined Ajna, Gate 64, Uranus aspects');
      }
      if (scores.conscientiousness !== null) {
        sections.push(`Conscientiousness: ${scores.conscientiousness.toFixed(1)} (${scoreLabels(scores.conscientiousness)})`);
        sections.push('  → Cross-correlate with: defined Root, Gate 60, Saturn aspects');
      }
      if (scores.extraversion !== null) {
        sections.push(`Extraversion: ${scores.extraversion.toFixed(1)} (${scoreLabels(scores.extraversion)})`);
        sections.push('  → Cross-correlate with: defined Throat/Sacral, Generator type');
      }
      if (scores.agreeableness !== null) {
        sections.push(`Agreeableness: ${scores.agreeableness.toFixed(1)} (${scoreLabels(scores.agreeableness)})`);
        sections.push('  → Cross-correlate with: Tribal circuitry, Venus aspects');
      }
      if (scores.neuroticism !== null) {
        sections.push(`Emotional Stability: ${(6 - scores.neuroticism).toFixed(1)} (reverse of ${scores.neuroticism.toFixed(1)} Neuroticism)`);
        sections.push('  → Cross-correlate with: undefined Solar Plexus, Pluto/Neptune aspects');
      }
    }
    
    if (p.via_strengths) {
      sections.push('\n=== VIA CHARACTER STRENGTHS (TOP 5 SIGNATURE) ===');
      const strengths = typeof p.via_strengths === 'string' 
        ? JSON.parse(p.via_strengths) 
        : p.via_strengths;
      
      const topFive = strengths.filter(s => s.isSignature || s.rank <= 5).slice(0, 5);
      topFive.forEach((s, i) => {
        sections.push(`${i + 1}. ${s.strength} (score: ${s.score.toFixed(1)})`);
        sections.push(`   → Cross-correlate with Gene Keys gifts/siddhis and astrological aspects`);
      });
    }
  }

  // ── Life Events Diary ──
  if (data.diaryEntries && data.diaryEntries.length > 0) {
    sections.push('\n=== LIFE EVENTS TIMELINE (DIARY) ===');
    sections.push('User-reported major life events for retroactive validation:');
    
    // Sort by date descending (most recent first)
    const sorted = [...data.diaryEntries].sort((a, b) => 
      new Date(b.event_date) - new Date(a.event_date)
    );
    
    // Show up to 10 most significant events
    const majorEvents = sorted
      .filter(e => e.significance === 'major' || e.significance === 'moderate')
      .slice(0, 10);
    
    majorEvents.forEach(e => {
      sections.push(`\n${e.event_date} - ${e.event_title} (${e.event_type}, ${e.significance})`);
      if (e.event_description) {
        sections.push(`  Details: ${e.event_description}`);
      }
      if (e.transit_snapshot) {
        sections.push(`  → VALIDATE: Correlate this event with transits active on ${e.event_date}`);
        sections.push(`     Use this to prove chart accuracy through retroactive pattern matching`);
      }
    });
    
    sections.push('\n→ CRITICAL: Reference these events in synthesis to demonstrate:');
    sections.push('  1. Chart predicted pattern that user actually lived');
    sections.push('  2. Specific transit activated specific behavior/event');
    sections.push('  3. User\'s chart = accurate via retroactive validation');
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
 * @param {object}  [chartData.validationData] – Behavioral validation
 * @param {object}  [chartData.psychometricData] – Big Five + VIA
 * @param {array}   [chartData.diaryEntries] – Life events
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
