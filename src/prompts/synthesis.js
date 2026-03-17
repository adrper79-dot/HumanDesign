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

// ─── KB LOADER (same pattern as rag.js) ────────────────────────

const _kbCache = {};
function loadKB(category, file) {
  const key = `${category}/${file}`;
  if (!_kbCache[key]) {
    try {
      _kbCache[key] = globalThis.__PRIME_DATA?.kb?.[key] || {};
    } catch {
      _kbCache[key] = {};
    }
  }
  return _kbCache[key];
}

// ─── SYSTEM PROMPT (STATIC) ────────────────────────────────────

const SYSTEM_PROMPT = `You are the Prime Self Oracle — an advanced synthesis engine that delivers personalized, grounded guidance through layered interpretation. This synthesis is the 6th Forge in operation — the Forge of Self. You are not producing a report about the person. You are constructing the mirror in which they recognize what they already are.

SYNTHESIS VOICE: The quickStartGuide.whoYouAre field is the user's FIRST impression of Prime Self. Write it as if you have known this person for years and are finally able to tell them what you see. It must land emotionally before it lands intellectually. Every other field can be technical — this one must be human.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRUCTURAL FRAMEWORK (The Library Integration)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your structural explanations draw from a cross-validated perennial philosophy framework organized by the harmonic series. Each level is formally derived from the previous — these are not metaphors but structural necessities proven from information theory, type theory, Euclidean topology, graph topology, circle packing, and harmonic mathematics. Use these principles when explaining WHY chart elements interact, not just WHAT they mean:

POLARITY DYNAMICS (for defined/undefined center pairs — First Overtone, Octave 2:1):
  Polarity is the first necessary structure of manifestation: two mutually defining, mutually requiring aspects that cannot collapse into identity.
  • P1 Wave — any continuous process in the chart alternates between two states. Emotional waves, sacral on/off, splenic alerts — all are polarity dynamics.
  • P2 Charge — what consistent charge does a defined center hold? What charge does the undefined center receive and amplify from the environment?
  • P3 Phase — wave polarity extended across time: constructive interference (aligned energy) or destructive interference (conflicting energy) between chart activations across a period.
  • P4 Field — what field does the defined center generate? How does it structure the person's relational space?
  • P5 Threshold — the membrane between defined and undefined. The most dynamically active zone — both most susceptible to conditioning AND most productive for relational exchange.

TRINITY (for Type + Strategy + Authority — Second Overtone, Perfect Fifth 3:2):
  Trinity is the minimum structure of dynamic stability: three terms whose mutual interaction generates emergence that neither term possesses alone.
  • T1 Dynamic Stability — Type + Strategy + Authority = minimum terms for a self-sustaining decision system. Remove any one and it destabilizes.
  • T2 Process Trinity — generation (impulse/invitation) → sustaining (strategy execution) → dissolution (cycle completion). Every decision follows this trinity.
  • T3 Mediating Trinity — Authority mediates between Type and Strategy. It is the Third that enables exchange without collapsing either pole.
  • T4 Hierarchical Trinity — Type → Strategy → Authority = increasing interiority: what you are → how you move → how you know.
  • T5 Temporal Trinity — Design (inherited past) + Personality (conscious present) + Synthesis (integrated future).
  • Name the Third — the emergent behavior that neither Strategy nor Authority predicts alone.

CO-ARISING (Principle F4 — for chart contradictions):
  • Nothing pre-exists its relations. When two chart elements appear to contradict, name the contradiction explicitly: both are real, both require each other, the tension between them is where the person's most distinctive quality lives. Chart contradictions are structural features, not errors.

EMERGENCE (Principle F6 — for channel synthesis):
  • A channel is not the sum of its gates. It is an emergent property neither gate possesses alone. Name what the channel produces that neither gate can produce by itself.

QUATERNITY → PENTAD TRANSITION (for channel completion — Fourth Overtone, Major Third 5:4):
  • When four elements form a star-graph (K₁,₄), Phi cannot emerge — no cycles exist. When a channel completes, the topology shifts to C₅ — a ring. Phi becomes structurally necessary. This is why channel completion is categorical, not gradual: it is a topological shift, not accumulation of energy. Name the shift: before completion, two hanging gates reach toward each other (acyclic star). After completion, they form a ring and Phi-governed self-similar growth becomes possible in that domain.

HEXAD CLOSURE (for circuit group completions — Fifth Overtone, Minor Third 6:5):
  • Circuit completion is harmonic closure — the same principle as the perfect fifth (3:2). When an Individual/Tribal/Collective circuit closes, it generates a frequency the open circuit cannot. Name what closes, not just what connects. A closed Individual circuit generates mutation that a single Individual gate cannot; a closed Tribal circuit generates resource flow that scattered Tribal gates cannot.

HEPTAD OVERFLOW (for full chart integration — Sixth Overtone, Major Seventh 15:8):
  • When the full chart is treated as a unified system, its complexity exceeds what any single level can contain — analogous to the 7th harmonic which overflows the diatonic scale. This overflow is not a problem; it is self-awareness: the chart becoming aware of itself as a system. Name the overflow — the quality that emerges from the total system that no subsystem predicts. The synthesis itself is the Heptad moment: Ti resolving to Do.

CHROMATIC COMPLETION (architectural frame):
  • 5 Forges (pentatonic) + 7 Library levels (diatonic) = 12 (chromatic). Neither system alone covers the complete territory. The Library provides structural WHY (deductive). Prime Self provides experiential WHAT and WHERE (inductive). Together they triangulate the full chromatic scale of human self-knowledge. Self = the 12th position, the return Do.

GUARD: Every Library-derived structural claim must still pass the Anti-Barnum test and cite specific Reference Facts. If adding the structural vocabulary does not make the claim more specific and accurate than the simpler version, use the simpler version. The framework explains the person, not itself.

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
• Frequency Keys terminology (NOT Human Design IP terms)
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

APPROVED ALTERNATIVES (Frequency Keys / Prime Self language):
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
  
  ✓ Gates → Frequency Keys
    - "Gate 37" → "Frequency Key 37"
    - "Gate 37.4" → "Frequency Key 37, Line 4" or "FK37.4"
  
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
  • Frequency Key [X]: [specific insight]
  • Astrology: [planet] in [sign/house] [specific insight]
  • Numerology: [Life Path/Personal Year] [specific insight]
  • Vedic: Nakshatra [name] / [current dasha lord] dasha [specific insight] — include ONLY when present in Reference Facts
  • Ogham: Birth Tree [name] [specific insight] — include ONLY when present in Reference Facts
  • Mayan: Kin [number] Seal [sealName] Tone [toneName] [specific insight] — include ONLY when present in Reference Facts
  • BaZi: Day Master [element] [nature] [specific insight] — include ONLY when present in Reference Facts
  • Sabian: [point] degree symbol [specific insight] — include ONLY when present in Reference Facts
  • Chiron: [sign/house] wound [specific insight] — include ONLY when present in Reference Facts
  • Lilith: [sign/house] archetype [specific insight] — include ONLY when present in Reference Facts
  
This convergence suggests [synthesis]."

NOTE: Vedic, Ogham, Mayan, BaZi, Sabian, Chiron and Lilith data will only appear in Reference Facts when available. When present, integrate them as additional convergence points. When absent, omit.

EXAMPLE:
"Leadership through innovation shows up across multiple systems:
  • Frequency Key 3 (Innovation, Line 5 Heretic): You're designed to revolutionize stuck systems through radical new approaches
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
    "whoYouAre": "FELT OPENER — 2-3 sentences, second person, present tense. STRUCTURE: (1) IDENTITY — name the core quality that makes them distinct, stated as fact not label. (2) LIVED PATTERN — the specific tension or dynamic this creates in their daily life, relationships, or decisions. (3) ACTIONABLE CLOSE — one sentence that reframes this pattern as design, not flaw, and points toward what to do with it. NO jargon, no type names, no gate numbers. Start with the experience, not the system. EXAMPLES: 'You are wired to initiate things others won't — and then watch in frustration as the world catches up to what you already knew. The pattern that looks like impatience from the outside is actually intelligence working faster than the room. Stop explaining yourself before you act — your job is to move first, not to convince.' / 'You carry other people's emotional weather as if it were your own, and you have spent years wondering why you feel exhausted in crowds. This is not a flaw — it is a form of perception most people do not have. The practice is learning which feelings are yours before you respond to anything.',",
    "decisionStyle": "string (120-150 words)",
    "lifeStrategy": "string (100-140 words)",
    "thisMonth": "string (80-120 words)",
    "workingWithOthers": "string (80-120 words)",
    "whatMakesYouUnique": "string (60-100 words) - Highlight 2-3 rare factors (<10% prevalence) vs common traits (>40% prevalence) with specific percentages and what this means practically"
  },
  "technicalInsights": {
    "geneKeysProfile": {
      "lifesWork": { "key": "number", "shadow": "string", "gift": "string", "mastery": "string", "contemplation": "string" },
      "otherActiveKeys": [{ "key": "number", "position": "string", "shadow": "string", "gift": "string", "message": "string" }],
      "_sources": "List the specific gates/Frequency Keys and their positions (e.g., 'Gate 36 conscious Sun, Gate 22 unconscious Earth') that generated these Frequency Keys interpretations. Be specific — cite the actual chart data points."
    },
    "numerologyInsights": {
      "lifePath": { "number": "number", "name": "string", "essence": "string", "currentGuidance": "string" },
      "personalYear": { "number": "number", "theme": "string", "guidance": "string" },
      "tarotCard": { "card": "string", "message": "string" },
      "_sources": "List the specific birth date calculations used (e.g., 'Life Path from 08/05/1979 = 3, Personal Year 2024 = 7')."
    },
    "vedicOverlay": {
      "moonNakshatra": "string (name + pada + lord — e.g., 'Hasta Pada 3, Moon-ruled')",
      "nakshatraGift": "string (specific gift pattern from this nakshatra)",
      "currentDasha": "string (dasha lord + years remaining + what this period activates)",
      "siderealSun": "string (sidereal Sun sign if notably different from tropical)",
      "_sources": "List the sidereal positions used (e.g., 'Moon at 14° Aquarius = Shatabhisha nakshatra, Ketu dasha active')."
    },
    "celticOghamTree": {
      "tree": "string (name)",
      "period": "string",
      "gift": "string (1 sentence specific to this person's chart context)",
      "shadow": "string (1 sentence)",
      "convergence": "string (how the birth tree resonates with other chart elements)",
      "_sources": "List the birth date and tree correspondence used (e.g., 'Birth date 08/05 = Oak tree, July 7 – August 4 Ogham calendar')."
    },
    "mayanTzolkin": {
      "kin": "number",
      "seal": "string (sealName)",
      "tone": "string (toneName — toneAction)",
      "archetype": "string (seal archetype)",
      "gift": "string (seal gift applied to this chart)",
      "convergence": "string (1 sentence — include ONLY when present in Reference Facts)",
      "_sources": "List the Tzolkin calculation (e.g., 'Birth date 08/05/1979 = Kin 197, Red Solar Earth, Tone 9')."
    },
    "baziProfile": {
      "dayMaster": "string (element nature)",
      "elementBalance": "string (dominant element and what this means)",
      "convergence": "string (1 sentence — include ONLY when present in Reference Facts)",
      "_sources": "List the Four Pillars used (e.g., 'Day Master: Yin Fire, Year Pillar: Earth Goat, Month Pillar: Metal Monkey')."
    },
    "sabianHighlights": [
      { "point": "string (Sun/Moon/ASC/MC)", "symbol": "string", "insight": "string" }
    ],
    "sabianSources": "List the degree positions used (e.g., 'Sun at 13° Leo = Sabian 13 Leo, Moon at 22° Aries = Sabian 22 Aries').",
    "chironWound": {
      "sign": "string",
      "house": "number",
      "archetype": "string",
      "wound": "string (1 sentence)",
      "gift": "string (1 sentence)",
      "convergence": "string (how Chiron theme echoes in other chart areas — include ONLY when present in Reference Facts)",
      "_sources": "List the Chiron position (e.g., 'Chiron at 8° Taurus, 2nd house')."
    },
    "lilithPlacement": {
      "sign": "string",
      "house": "number",
      "archetype": "string",
      "shadow": "string (1 sentence)",
      "gift": "string (1 sentence)",
      "convergence": "string (how Lilith theme echoes in other chart areas — include ONLY when present in Reference Facts)",
      "_sources": "List the Lilith position (e.g., 'Black Moon Lilith at 23° Scorpio, 8th house')."
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
      "forge": "Initiation|Mastery|Guidance|Perception|Transformation (USE the deterministic result from DETERMINISTIC FORGE IDENTIFICATION section)",
      "archetype": "string (Chronos|Eros|Aether|Lux|Phoenix — the mythic alias)",
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
    },
    "selfReflection": {
      "nativeEpistemology": "string (how this person knows what they know — their Authority type as cognitive architecture, 2-3 sentences)",
      "forgeOfSelf": "string (what this person's specific pattern of self-recognition looks like, given their dominant Forge + Authority, 1-2 sentences)"
    }
  },
  "groundingAudit": {
    "claimsTotal": "number",
    "claimsGrounded": "number",
    "ungroundedFields": ["string"]
  }
}

Respond ONLY with valid JSON matching this schema. No markdown, no code fences.`;


// ─── DETERMINISTIC FORGE SCORING (from forge_mapping.json) ──────

/**
 * Compute primary and secondary Forge using the deterministic scoring
 * algorithm from forge_mapping.json. Replaces LLM guessing.
 *
 * @param {object} data - Chart data with hdChart, astroChart
 * @returns {{ primary: string, secondary: string|null, confidence: number, scores: object, indicators: string[] }}
 */
function computeForge(data) {
  const forgeMap = loadKB('prime_self', 'forge_mapping.json');
  if (!forgeMap.primaryRules) {
    return { primary: 'Mastery', secondary: null, confidence: 0.5, scores: {}, indicators: ['fallback — forge_mapping.json unavailable'] };
  }

  const scores = { Initiation: 0, Mastery: 0, Guidance: 0, Perception: 0, Transformation: 0 };
  const indicators = [];
  const hd = data.hdChart || {};
  const astro = data.astroChart || {};

  // Step 1: Type base weight (10)
  const typeMap = forgeMap.primaryRules.byType;
  const hdType = hd.type || '';
  // Normalize type: strip spaces for matching
  const typeKey = hdType.replace(/\s+/g, ' ');
  if (typeMap[typeKey]) {
    scores[typeMap[typeKey].forge] += typeMap[typeKey].weight;
    indicators.push(`Type ${typeKey} → ${typeMap[typeKey].forge} (+${typeMap[typeKey].weight})`);
  }

  // Collect all active gates from personality + design
  const activeGates = new Set();
  if (data.personalityGates) {
    for (const g of Object.values(data.personalityGates)) {
      if (g?.gate) activeGates.add(g.gate);
    }
  }
  if (data.designGates) {
    for (const g of Object.values(data.designGates)) {
      if (g?.gate) activeGates.add(g.gate);
    }
  }

  // Step 2: Gate indicators
  const si = forgeMap.secondaryIndicators || {};
  if (si.hdGateIndicators) {
    for (const ind of si.hdGateIndicators) {
      const matchedGates = ind.gates.filter(g => activeGates.has(g));
      if (matchedGates.length > 0) {
        scores[ind.forge] += ind.weight;
        indicators.push(`Gates [${matchedGates.join(',')}] → ${ind.forge} (+${ind.weight})`);
      }
    }
  }

  // Step 3: Center indicators
  const definedCenters = new Set((hd.definedCenters || []).map(c => c.toLowerCase()));
  if (si.hdCenterIndicators) {
    for (const ind of si.hdCenterIndicators) {
      if (ind.defined && definedCenters.has(ind.center.toLowerCase())) {
        scores[ind.forge] += ind.weight;
        indicators.push(`Defined ${ind.center} → ${ind.forge} (+${ind.weight})`);
      }
    }
  }

  // Step 4: Motor-to-Throat check
  if (si.hdMotorToThroat && hd.activeChannels) {
    const motorCenters = ['heart', 'solarplexus', 'root', 'sacral'];
    const hasMotorToThroat = hd.activeChannels.some(ch => {
      const centers = (ch.centers || []).map(c => c.toLowerCase());
      return centers.includes('throat') && centers.some(c => motorCenters.includes(c));
    });
    if (hasMotorToThroat) {
      scores[si.hdMotorToThroat.forge] += si.hdMotorToThroat.weight;
      indicators.push(`Motor→Throat → ${si.hdMotorToThroat.forge} (+${si.hdMotorToThroat.weight})`);
    }
  }

  // Step 5: Astro sign indicators
  if (si.astroSignIndicators && astro.placements) {
    for (const ind of si.astroSignIndicators) {
      for (const planet of ind.planets) {
        const placement = astro.placements[planet.toLowerCase()] || astro.placements[planet];
        if (placement && ind.signs.includes(placement.sign)) {
          scores[ind.forge] += ind.weight;
          indicators.push(`${planet} in ${placement.sign} → ${ind.forge} (+${ind.weight})`);
        }
      }
    }
  }

  // Step 6: Astro house indicators
  if (si.astroHouseIndicators && astro.placements) {
    for (const ind of si.astroHouseIndicators) {
      for (const [planet, placement] of Object.entries(astro.placements)) {
        if (placement.house && ind.houses.includes(placement.house)) {
          scores[ind.forge] += ind.weight;
          indicators.push(`${planet} in H${placement.house} → ${ind.forge} (+${ind.weight})`);
        }
      }
    }
  }

  // Step 7-8: Determine primary + secondary
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][0];
  const primaryScore = sorted[0][1];
  const secondary = sorted[1][1] > 5 ? sorted[1][0] : null;
  const maxPossible = 10 + 15 + 10 + 4 + 10 + 5; // rough max
  const confidence = Math.min(primaryScore / maxPossible, 1.0);

  return { primary, secondary, confidence: Math.round(confidence * 100) / 100, scores, indicators };
}

// ─── DETERMINISTIC KNOWLEDGE SCORING (from knowledges.json) ────

/**
 * Compute primary Knowledge domain from chart data using HD circuit
 * and gate mappings from knowledges.json.
 *
 * @param {object} data - Chart data
 * @returns {{ primary: string, secondary: string|null, scores: object }}
 */
function computeKnowledge(data) {
  const knowledgesData = loadKB('prime_self', 'knowledges.json');
  if (!knowledgesData.sciences) {
    return { primary: 'Sciences', secondary: null, scores: {} };
  }

  const scores = {};
  const hd = data.hdChart || {};
  const astro = data.astroChart || {};

  // Collect active gates
  const activeGates = new Set();
  if (data.personalityGates) {
    for (const g of Object.values(data.personalityGates)) {
      if (g?.gate) activeGates.add(g.gate);
    }
  }
  if (data.designGates) {
    for (const g of Object.values(data.designGates)) {
      if (g?.gate) activeGates.add(g.gate);
    }
  }

  // Gate-to-Knowledge mapping derived from knowledges.json hdMapping
  const gateMap = {
    Sciences:    [63, 4, 17, 62, 16, 48, 18, 58], // Logic/Understanding circuit
    Arts:        [1, 8, 56, 35, 36, 22, 12, 45],   // Sensing/Abstract circuit expression
    Defenses:    [44, 50, 32, 28, 26, 21, 40, 37],  // Tribal/Defense circuit
    Heresies:    [43, 23, 61, 24, 38, 39, 28, 3],   // Individual/Knowing circuit
    Connections: [37, 40, 6, 59, 19, 49, 13, 33],   // Tribal/Community circuit
    Mysteries:   [61, 64, 63, 47, 57, 20, 34, 10]   // Individual/Knowing + awareness
  };

  // Score from active gates
  for (const [knowledge, gates] of Object.entries(gateMap)) {
    scores[knowledge] = 0;
    for (const gate of gates) {
      if (activeGates.has(gate)) scores[knowledge] += 3;
    }
  }

  // Score from defined centers
  const definedCenters = new Set((hd.definedCenters || []).map(c => c.toLowerCase()));
  const centerMap = {
    Sciences:    ['ajna'],
    Arts:        ['throat'],
    Defenses:    ['spleen', 'heart'],
    Heresies:    ['head', 'ajna'],
    Connections: ['solarplexus'],
    Mysteries:   ['head']
  };
  for (const [knowledge, centers] of Object.entries(centerMap)) {
    for (const c of centers) {
      if (definedCenters.has(c)) scores[knowledge] += 2;
    }
  }

  // Score from astro sign emphasis
  const signMap = {
    Sciences:    ['Virgo', 'Aquarius'],
    Arts:        ['Leo', 'Pisces'],
    Defenses:    ['Aries', 'Scorpio'],
    Heresies:    ['Aquarius', 'Sagittarius'],
    Connections: ['Cancer', 'Libra'],
    Mysteries:   ['Pisces', 'Scorpio']
  };
  if (astro.placements) {
    const keyPlanets = ['sun', 'moon', 'mercury', 'venus', 'mars'];
    for (const [knowledge, signs] of Object.entries(signMap)) {
      for (const planet of keyPlanets) {
        const p = astro.placements[planet] || astro.placements[planet.charAt(0).toUpperCase() + planet.slice(1)];
        if (p && signs.includes(p.sign)) scores[knowledge] += 2;
      }
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return {
    primary: sorted[0][0],
    secondary: sorted[1]?.[1] > 3 ? sorted[1][0] : null,
    scores: Object.fromEntries(sorted)
  };
}

// ─── FORGE ARCHETYPE DETAILS (for narrative reference) ─────────

const FORGE_ARCHETYPES = {
  Initiation: { archetype: 'Chronos', element: 'Fire', keyword: 'Begin', weapon: 'Patience — the ability to outlast any obstacle', defense: 'Historical Memory', masterForm: 'The Eternal', shadowForm: 'The Anachronist' },
  Mastery:    { archetype: 'Eros',    element: 'Earth', keyword: 'Build', weapon: 'Creative Fire — transforming raw desire into beautiful form', defense: 'Heart Coherence', masterForm: 'The Lover', shadowForm: 'The Addict' },
  Guidance:   { archetype: 'Aether',  element: 'Air',   keyword: 'Direct', weapon: 'Empathy — feeling the truth of others\' experience', defense: 'Sacred Boundaries', masterForm: 'The Connector', shadowForm: 'The Martyr' },
  Perception: { archetype: 'Lux',     element: 'Water', keyword: 'Mirror', weapon: 'Clarity — cutting through confusion to essential truth', defense: 'Discernment', masterForm: 'The Illuminator', shadowForm: 'The Blinder' },
  Transformation: { archetype: 'Phoenix', element: 'Void', keyword: 'Dissolve', weapon: 'Transmutation — turning any experience into wisdom', defense: 'Resilience', masterForm: 'The Transformer', shadowForm: 'The Destroyer' },
  Self:       { archetype: 'Mirror', element: 'All', keyword: 'Recognize', weapon: 'Integration — the capacity to hold all patterns as one', defense: 'Presence', masterForm: 'The Return', shadowForm: 'The Performer', activation: 'Not scored. Present in every chart. Activated by the act of genuine self-inquiry.' }
};


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

  // ── Frequency Keys Profile Reference Facts ──
  if (data.geneKeys) {
    const gk = data.geneKeys;
    sections.push('\n=== FREQUENCY KEYS PROFILE REFERENCE FACTS ===');
    sections.push('(Shadow → Gift → Mastery triad for each active gate position)');
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

  // ── Mayan Tzolkin (Dreamspell) Reference Facts ──
  if (data.mayan && !data.mayan.error) {
    const m = data.mayan;
    sections.push('\n=== MAYAN TZOLKIN (DREAMSPELL) REFERENCE FACTS ===');
    sections.push(`Kin: ${m.kin} | Seal: ${m.sealName} (${m.sealColor} ${m.sealTribe})`);
    sections.push(`Tone: ${m.toneName} (${m.toneAction} / ${m.tonePower})`);
    sections.push(`Wavespell: ${m.wavespell} | Signature: ${m.signature}`);
    const mayanSeals = loadKB('mayan', 'seals.json');
    const sealData = mayanSeals ? (mayanSeals[m.seal] || null) : null;
    if (sealData) {
      if (sealData.archetype)    sections.push(`Archetype: ${sealData.archetype}`);
      if (sealData.shadow)       sections.push(`Shadow: ${sealData.shadow}`);
      if (sealData.gift)         sections.push(`Gift: ${sealData.gift}`);
      if (sealData.primeInsight) sections.push(`Prime Insight: ${sealData.primeInsight}`);
    }
  }

  // ── BaZi Four Pillars Reference Facts ──
  if (data.bazi && !data.bazi.error) {
    const b = data.bazi;
    sections.push('\n=== BAZI — FOUR PILLARS OF DESTINY REFERENCE FACTS ===');
    if (b.dayMaster) {
      sections.push(`Day Master: ${b.dayMaster.name} (${b.dayMaster.elementDisplay || b.dayMaster.element})`);
    }
    const pillars = ['yearPillar', 'monthPillar', 'dayPillar', 'hourPillar'];
    for (const p of pillars) {
      const pillar = b[p];
      if (pillar) {
        const stemName = pillar.stem?.name || pillar.stem;
        const branchName = pillar.branch?.name || pillar.branch;
        const stemEl = pillar.stem?.elementDisplay || pillar.stem?.element || '';
        const branchEl = pillar.branch?.elementDisplay || pillar.branch?.element || '';
        sections.push(`${p.replace('Pillar', '')} Pillar: ${stemName}/${branchName} (${stemEl} over ${branchEl})`);
      }
    }
    if (b.elementBalance) {
      const eb = b.elementBalance;
      const c = eb.counts || eb;
      sections.push(`Element Balance: Wood ${c.Wood}  Fire ${c.Fire}  Earth ${c.Earth}  Metal ${c.Metal}  Water ${c.Water}`);
      if (eb.dominant) sections.push(`Dominant Element: ${eb.dominant} | Lacking: ${eb.lacking}`);
    }
  }

  // ── Sabian Symbols Reference Facts ──
  if (data.sabian && !data.sabian.error) {
    const s = data.sabian;
    sections.push('\n=== SABIAN SYMBOLS REFERENCE FACTS ===');
    const sabianPoints = ['sun', 'moon', 'ascendant', 'midheaven'];
    for (const point of sabianPoints) {
      const sp = s[point];
      if (sp && sp.symbol) {
        sections.push(`${point.charAt(0).toUpperCase() + point.slice(1)} (${sp.sign} ${sp.degree}°): "${sp.symbol}"`);
        if (sp.keynote) sections.push(`  Keynote: ${sp.keynote}`);
      }
    }
  }

  // ── Chiron Reference Facts ──
  if (data.chiron && !data.chiron.error) {
    const c = data.chiron;
    sections.push('\n=== CHIRON — WOUND & GIFT REFERENCE FACTS ===');
    sections.push(`Chiron: ${c.sign} ${c.degrees?.toFixed(1)}°${c.house ? ` (House ${c.house})` : ''}`);
    if (c.archetype)    sections.push(`Archetype: ${c.archetype}`);
    if (c.shadow)       sections.push(`Wound/Shadow: ${c.shadow}`);
    if (c.gift)         sections.push(`Gift: ${c.gift}`);
    if (c.primeInsight) sections.push(`Prime Insight: ${c.primeInsight}`);
  }

  // ── Black Moon Lilith Reference Facts ──
  if (data.lilith && !data.lilith.error) {
    const l = data.lilith;
    sections.push('\n=== BLACK MOON LILITH REFERENCE FACTS ===');
    sections.push(`Lilith: ${l.sign} ${l.degrees?.toFixed(1)}°${l.house ? ` (House ${l.house})` : ''}`);
    if (l.archetype)    sections.push(`Archetype: ${l.archetype}`);
    if (l.shadow)       sections.push(`Shadow: ${l.shadow}`);
    if (l.gift)         sections.push(`Gift: ${l.gift}`);
    if (l.primeInsight) sections.push(`Prime Insight: ${l.primeInsight}`);
  }

  // ── Deterministic Forge Identification ──
  const forgeResult = computeForge(data);
  const forgeArch = FORGE_ARCHETYPES[forgeResult.primary] || {};
  sections.push('\n=== DETERMINISTIC FORGE IDENTIFICATION ===');
  sections.push(`Primary Forge: ${forgeResult.primary} (${forgeArch.archetype || '?'}, ${forgeArch.element || '?'})`);
  sections.push(`  Confidence: ${(forgeResult.confidence * 100).toFixed(0)}%`);
  sections.push(`  Weapon: ${forgeArch.weapon || 'N/A'}`);
  sections.push(`  Defense: ${forgeArch.defense || 'N/A'}`);
  sections.push(`  Master Form: ${forgeArch.masterForm || 'N/A'}`);
  sections.push(`  Shadow Form: ${forgeArch.shadowForm || 'N/A'}`);
  if (forgeResult.secondary) {
    const secArch = FORGE_ARCHETYPES[forgeResult.secondary] || {};
    sections.push(`Secondary Forge: ${forgeResult.secondary} (${secArch.archetype || '?'})`);
  }
  sections.push('Scoring indicators:');
  for (const ind of forgeResult.indicators) {
    sections.push(`  • ${ind}`);
  }
  sections.push('INSTRUCTION: Use the Primary Forge above as the definitive forgeIdentification.forge value. Do NOT re-derive it — it has been deterministically computed from the chart data.');
  sections.push('NOTE: The 6th Forge (Self) is present in every chart and is not scored. It is the container of all other Forges — the moment of recognition that makes the synthesis itself an act of self-knowledge. Reference it in the synthesis closing.');

  // ── Deterministic Knowledge Identification ──
  const knowledgeResult = computeKnowledge(data);
  const knowledgesData = loadKB('prime_self', 'knowledges.json');
  sections.push('\n=== DETERMINISTIC KNOWLEDGE IDENTIFICATION ===');
  sections.push(`Primary Knowledge: ${knowledgeResult.primary}`);
  if (knowledgeResult.secondary) {
    sections.push(`Secondary Knowledge: ${knowledgeResult.secondary}`);
  }
  // Inject practical domains from knowledges.json
  const primaryKB = knowledgesData[knowledgeResult.primary.toLowerCase()];
  if (primaryKB) {
    if (primaryKB.practicalDomains) {
      sections.push(`Practical Domains: ${primaryKB.practicalDomains.join(', ')}`);
    }
    if (primaryKB.primeQuestion) {
      sections.push(`Prime Question: ${primaryKB.primeQuestion}`);
    }
  }
  sections.push('INSTRUCTION: Reference this Knowledge domain in the synthesis. Ground recommendations in user\'s specific chart gates and centers.');
  sections.push('NOTE: The 7th Knowledge (Self) is the meta-knowledge of knowing one\'s own nature — the container that makes all other Knowledges coherent. Include a brief closing reflection on how this person\'s Authority type constitutes their native epistemology — how they know what they know.');

  // ── Filtered Historical Figures ──
  const figures = loadKB('prime_self', 'historical_figures.json');
  if (figures && Array.isArray(figures)) {
    const forgeFigures = figures.filter(f =>
      f.forge === forgeResult.primary || f.forge === forgeResult.secondary
    ).slice(0, 5);
    if (forgeFigures.length > 0) {
      sections.push('\n=== HISTORICAL EXEMPLARS (Forge-matched) ===');
      for (const fig of forgeFigures) {
        sections.push(`  ${fig.name} (${fig.forge}) — ${fig.hdType || 'unknown type'}: ${fig.lesson || fig.description || ''}`);
      }
      sections.push('INSTRUCTION: Select the most resonant exemplar for this user\'s Type + Forge combination.');
    }
  }

  // ── Filtered Book Recommendations ──
  const books = loadKB('prime_self', 'book_recommendations.json');
  if (books && Array.isArray(books)) {
    const knowledgeBooks = books.filter(b =>
      b.knowledge === knowledgeResult.primary || b.forge === forgeResult.primary
    ).slice(0, 6);
    if (knowledgeBooks.length > 0) {
      sections.push('\n=== BOOK RECOMMENDATIONS (Knowledge/Forge-matched) ===');
      for (const b of knowledgeBooks) {
        sections.push(`  "${b.title}" by ${b.author} (${b.type || 'book'}) — ${b.reason || ''}`);
      }
      sections.push('INSTRUCTION: Recommend 1 fiction + 1 non-fiction from this list or similar works matching the user\'s Knowledge focus.');
    }
  }

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
        sections.push(`   → Cross-correlate with Frequency Keys gifts/mastery levels and astrological aspects`);
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


// ─── PROMPT INJECTION SANITIZATION (PROMPT-001) ────────────────

/**
 * Sanitize user-provided text before injecting into LLM prompt.
 * Strips delimiter-like patterns that could break prompt structure
 * and enforces a character length cap.
 */
function sanitizePromptInput(text, maxLen = 2000) {
  if (!text || typeof text !== 'string') return '';
  // Strip anything that looks like our internal delimiters
  let clean = text.replace(/---\s*(BEGIN|END)\s+[A-Z ]+---/gi, '');
  // Strip system/assistant role injection attempts
  clean = clean.replace(/\b(system|assistant)\s*:/gi, '');
  // Truncate to maxLen
  return clean.slice(0, maxLen).trim();
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
 * @param {object}  [practitionerContext]     – HD_UPDATES4 practitioner AI vectors
 * @param {string}  [practitionerContext.synthesisStyle] – Vector 2: practitioner lens
 * @param {string}  [practitionerContext.clientAiContext] – Vector 3: per-client brief
 * @param {array}   [practitionerContext.sharedNotes]    – Vector 1: session notes (share_with_ai)
 * @param {string}  [userTier]               – HD_UPDATES3: user tier for deferral CTA
 * @returns {object} LLM prompt payload
 */
export function buildSynthesisPrompt(chartData, question, practitionerContext, userTier) {
  const referenceFacts = buildReferenceFacts(chartData);
  const ragContext = buildRAGContext(chartData);

  let userContent = `---BEGIN REFERENCE FACTS---\n${referenceFacts}\n---END REFERENCE FACTS---\n`;

  if (ragContext) {
    userContent += `\n---BEGIN KNOWLEDGEBASE CONTEXT---\n${ragContext}\n---END KNOWLEDGEBASE CONTEXT---\n`;
  }

  // HD_UPDATES4: Inject practitioner context vectors
  if (practitionerContext) {
    const sections = [];

    // Vector 2: Practitioner synthesis style lens
    if (practitionerContext.synthesisStyle) {
      const safeStyle = sanitizePromptInput(practitionerContext.synthesisStyle, 1000);
      sections.push(
        `PRACTITIONER SYNTHESIS LENS:\n` +
        `The practitioner working with this client has requested the following emphasis in readings:\n` +
        `"${safeStyle}"\n` +
        `Incorporate this lens naturally into your synthesis without breaking grounding rules.`
      );
    }

    // Vector 3: Per-client AI context brief
    if (practitionerContext.clientAiContext) {
      const safeContext = sanitizePromptInput(practitionerContext.clientAiContext, 1000);
      sections.push(
        `CLIENT CONTEXT (from practitioner):\n` +
        `The following context has been provided by the client's practitioner to inform this synthesis:\n` +
        `"${safeContext}"`
      );
    }

    // Vector 1: Shared session notes
    if (practitionerContext.sharedNotes?.length > 0) {
      const notesSummary = practitionerContext.sharedNotes
        .map(n => `[${n.session_date}] ${sanitizePromptInput(n.content, 500)}`)
        .join('\n');
      sections.push(
        `PRACTITIONER SESSION NOTES (shared for AI context):\n` +
        `The following session observations have been flagged by the practitioner as relevant:\n` +
        notesSummary
      );
    }

    if (sections.length > 0) {
      userContent += `\n---BEGIN PRACTITIONER CONTEXT---\n${sections.join('\n\n')}\n---END PRACTITIONER CONTEXT---\n`;
    }
  }

  // HD_UPDATES3: Practitioner deferral CTA for free/individual tier users
  if (userTier && (userTier === 'free' || userTier === 'individual')) {
    userContent += `\n---GUIDANCE NOTE---\n` +
      `When the user asks complex relational, therapeutic, or deep interpretive questions ` +
      `(e.g., "How do I heal my relationship with my mother?", "What's causing my career block?"), ` +
      `you should still provide helpful, grounded guidance. However, at the end of your response, ` +
      `include a brief, warm suggestion: "For deeper exploration of this topic, consider working with ` +
      `a certified practitioner who can provide personalized session guidance. ` +
      `Find practitioners at primeself.app/directory" — only include this for genuinely complex questions, ` +
      `NOT for basic profile requests or simple factual questions about their chart.\n---END GUIDANCE NOTE---\n`;
  }

  if (question) {
    const safeQuestion = sanitizePromptInput(question, 2000);
    userContent += `\n---USER QUESTION---\n${safeQuestion}\n---END USER QUESTION---\n`;
    userContent += `\nGenerate a Prime Self Profile addressing the user's question. Ground every claim in the Reference Facts above.`;
  } else {
    userContent += `\nGenerate a complete Prime Self Profile for this individual. Ground every claim in the Reference Facts above.`;
    userContent += `\n\n---SYNTHESIS FRAMING (6th Forge / 7th Knowledge)---`;
    userContent += `\nThis synthesis is the Forge of Self in operation. Frame the opening not as "here is a report about you" but as "here is the mirror." Use structural vocabulary (Polarity, Trinity, Emergence, Co-arising) where it makes the explanation more specific — never where it merely sounds profound.`;
    userContent += `\nClose the synthesis with a 7th Knowledge reflection: a brief statement of how this person knows what they know. Name their Authority type as their native epistemology — the specific way their body/mind/field registers truth before it can be argued with. This is not a rule to follow. It is the recognition of their own cognitive architecture.`;
    userContent += `\n---END SYNTHESIS FRAMING---`;
  }

  return {
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userContent }
    ],
    config: {
      model: question ? 'claude-sonnet-4-20250514' : 'claude-opus-4-20250514',
      temperature: 0,
      max_tokens: 6000
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

  // Validate Forge enum (canonical names)
  if (ti.forgeIdentification && ti.forgeIdentification.forge) {
    const validForges = ['Initiation', 'Mastery', 'Guidance', 'Perception', 'Transformation'];
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

// Six Knowledges (the 7th — Self — is derived, not scored)
const SIX_KNOWLEDGES = ['Sciences', 'Arts', 'Defenses', 'Heresies', 'Connections', 'Mysteries'];

// Forge mapping: the 5 scored forges (Self is the 6th, always present, not scored)
const FORGE_MAPPING = {
  Initiation: FORGE_ARCHETYPES.Initiation,
  Mastery: FORGE_ARCHETYPES.Mastery,
  Guidance: FORGE_ARCHETYPES.Guidance,
  Perception: FORGE_ARCHETYPES.Perception,
  Transformation: FORGE_ARCHETYPES.Transformation
};

export { buildReferenceFacts, FORGE_MAPPING, SIX_KNOWLEDGES };
