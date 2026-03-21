/**
 * Frequency Keys Profile Engine
 *
 * Derives the Frequency Keys profile from existing chart gate data.
 * No additional intake fields required — all positions come from
 * personalityGates and designGates already computed in Layers 3-4.
 *
 * Frequency Keys Profile Positions (based on I Ching gate framework):
 *   Life's Work  = Personality (Conscious) Sun gate  — your visible purpose
 *   Evolution    = Personality (Conscious) Earth gate — how you ground yourself
 *   Radiance     = Design (Unconscious) Earth gate    — your essence, others feel it
 *   Purpose      = Design (Unconscious) Sun gate      — your deeper mission
 *   Attraction   = Personality (Conscious) Moon gate  — what you draw toward you
 *   IQ / Pearl   = Design (Unconscious) Moon gate     — unconscious intelligence
 *
 * Each gate maps to a Noise/Signal/Frequency triad in the knowledgebase.
 * The knowledgebase lookup (Noise → Signal → Frequency) happens in rag.js.
 *
 * @module genekeys
 */

/**
 * Build the Frequency Keys profile from gate data.
 *
 * @param {object} personalityGates — Layer 4 output: { sun: {gate, line}, earth: {gate, line}, moon: {gate, line}, ... }
 * @param {object} designGates      — Layer 4 output: same structure for design/unconscious side
 * @returns {object} Frequency Keys profile with six key positions
 */
export function calculateGeneKeys(personalityGates, designGates) {
  function pos(gateData, label, planet) {
    if (!gateData?.gate) return null;
    return {
      gate: gateData.gate,
      line: gateData.line || null,
      label,
      planet,
    };
  }

  const profile = {
    lifesWork:  pos(personalityGates?.sun,   "Life's Work",  "Personality Sun"),
    evolution:  pos(personalityGates?.earth, "Evolution",    "Personality Earth"),
    radiance:   pos(designGates?.earth,      "Radiance",     "Design Earth"),
    purpose:    pos(designGates?.sun,        "Purpose",      "Design Sun"),
    attraction: pos(personalityGates?.moon,  "Attraction",   "Personality Moon"),
    iq:         pos(designGates?.moon,       "IQ / Pearl",   "Design Moon"),
  };

  // Collect all unique active gates across both sides for broader context
  const allGates = new Set();
  for (const side of [personalityGates, designGates]) {
    if (!side) continue;
    for (const val of Object.values(side)) {
      if (val?.gate) allGates.add(val.gate);
    }
  }
  profile.allActiveGates = [...allGates].sort((a, b) => a - b);

  return profile;
}
