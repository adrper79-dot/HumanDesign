/**
 * Generate Prime Self Frequency Keys vocabulary replacement
 *
 * Replaces Gene Keys triad names (Entropy/Freshness/Beauty, etc.) with original 
 * Prime Self vocabulary (Noise/Signal/Frequency) to complete GAP-006 corpus replacement.
 * 
 * Processes ALL 64 gates to replace field names:
 * - shadow → noise
 * - gift → signal  
 * - siddhi → frequency
 * - shadowDescription → noiseDescription
 * - giftDescription → signalDescription
 * - siddhiDescription → frequencyDescription
 * 
 * Usage: ANTHROPIC_API_KEY=sk-... node generate-missing.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-opus-4-20250514';
const MAX_TOKENS = 2048;

// Process ALL 64 gates for vocabulary replacement
const ALL_GATES = Array.from({ length: 64 }, (_, i) => i + 1);

const SYSTEM_PROMPT = `You are an expert on Prime Self's Frequency Keys system and its native three-tier consciousness model.

Your task: Replace Gene Keys triad names with original Prime Self vocabulary derived from the existing descriptions.

The three-tier consciousness model in Prime Self uses:
- NOISE: The gate quality when distorted by conditioning — contraction, blocking, misdirection, static
- SIGNAL: The gate quality in authentic expression — alignment, flow, clarity, gift realized  
- FREQUENCY: The gate quality at peak coherence — transcendence, luminance, highest expression

Vocabulary standards:
- Noise words: Armor, Blockage, Collapse, Compression, Contamination, Contraction, Corrosion, Deflection, Depletion, Diffusion, Dislocation, Distortion, Drift, Erosion, Exhaustion, Fixation, Fracture, Fragmentation, Freeze, Friction, Grip, Interference, Inversion, Isolation, Leak, Obstruction, Opacity, Paralysis, Pressure, Reactivity, Regression, Resistance, Rigidity, Scatter, Sedimentation, Shutdown, Siege, Stagnation, Static, Strain, Suppression, Turbulence, Withdrawal
- Signal words: Alignment, Amplification, Attunement, Calibration, Channeling, Clarity, Coherence, Convergence, Crystallization, Discernment, Embodiment, Emergence, Expression, Facilitation, Flow, Focus, Grounding, Guidance, Harmonization, Incubation, Integrity, Mediation, Momentum, Navigation, Origination, Precision, Presence, Reception, Refinement, Resilience, Resolution, Resourcefulness, Responsiveness, Sensitivity, Stabilization, Stewardship, Synthesis, Translation, Transmission, Transparency, Vitality, Weaving
- Frequency words: Accord, Actualization, Amplitude, Benediction, Brilliance, Clarity, Coherence, Communion, Completion, Consecration, Convergence, Emanation, Embodiment, Emergence, Equanimity, Grace, Illumination, Integration, Liberation, Luminance, Luminosity, Majesty, Manifestation, Maturation, Omnipresence, Openness, Perfection, Presence, Radiance, Realization, Revelation, Sovereignty, Stillness, Transcendence, Transmission, Unity, Wholeness

Requirements:
1. Each label must be 1-2 words maximum
2. Each label must be meaningfully different from the existing Gene Keys triad name (not synonymous)
3. Each label must capture the SPECIFIC quality of that gate, not generic tier language
4. All labels must feel native to Prime Self's voice (resonant, embodied, grounded - not mystical jargon)
5. Return ONLY the three labels (Noise | Signal | Frequency) as a pipe-separated string`;

async function callClaude(gateNumber, entry) {
  const userPrompt = `Generate replacement Noise/Signal/Frequency labels for Frequency Key ${gateNumber}.

Currently:
- name: "${entry.name}"
- shadow (→ noise): "${entry.shadow}"  
- gift (→ signal): "${entry.gift}"
- siddhi (→ frequency): "${entry.siddhi}"

Current descriptions (these will not change, but use them to identify the gate-specific quality):
- shadowDescription: "${entry.shadowDescription}"
- giftDescription: "${entry.giftDescription}"
- siddhiDescription: "${entry.siddhiDescription}"

Generate three replacement words that:
1. Are meaningfully different from the current triad names: ${entry.shadow} / ${entry.gift} / ${entry.siddhi}
2. Capture the SPECIFIC quality of this gate (not generic tier language)
3. Match the three-tier consciousness model: contraction→flow→luminance
4. Feel native to Prime Self's vocabulary (resonant, grounded, embodied)

Return ONLY: Noise_word | Signal_word | Frequency_word
Example: Stagnation | Origination | Luminance`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  
  // Extract labels from response (format: Noise | Signal | Frequency)
  const labelMatch = text.match(/([^\|]+)\s*\|\s*([^\|]+)\s*\|\s*([^\|]+)/);
  if (!labelMatch) {
    console.error('Response:', text);
    throw new Error(`No valid labels found in response for key ${gateNumber}`);
  }

  const [_, noise, signal, frequency] = labelMatch;
  
  return {
    noise: noise.trim(),
    signal: signal.trim(),
    frequency: frequency.trim()
  };
}

async function generateAllVocabulary() {
  const keysPath = join(__dirname, 'keys.json');
  const existing = JSON.parse(readFileSync(keysPath, 'utf8'));

  console.log(`Generating Prime Self Noise/Signal/Frequency labels for all 64 gates...\n`);
  console.log(`This will replace Gene Keys vocabulary with original Prime Self terminology.\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const gateNum of ALL_GATES) {
    if (!existing[gateNum]) {
      console.log(`  ⊗ Gate ${gateNum} does not exist in corpus, skipping`);
      continue;
    }

    try {
      const entry = existing[gateNum];
      console.log(`  → Gate ${gateNum}: Generating labels...`);
      
      const labels = await callClaude(gateNum, entry);
      
      // Update field names and values
      // Old fields → New fields
      existing[gateNum].noise = labels.noise;
      existing[gateNum].signal = labels.signal;
      existing[gateNum].frequency = labels.frequency;
      
      // Update description field names (keep content unchanged)
      existing[gateNum].noiseDescription = entry.shadowDescription;
      existing[gateNum].signalDescription = entry.giftDescription;
      existing[gateNum].frequencyDescription = entry.siddhiDescription;
      
      // Update name field to new format
      existing[gateNum].name = `${labels.noise} / ${labels.signal} / ${labels.frequency}`;
      
      // Remove old field names (can use object destructuring delete pattern later if needed)
      delete existing[gateNum].shadow;
      delete existing[gateNum].gift;
      delete existing[gateNum].siddhi;
      delete existing[gateNum].shadowDescription;
      delete existing[gateNum].giftDescription;
      delete existing[gateNum].siddhiDescription;
      
      console.log(`  ✓ Gate ${gateNum}: ${labels.noise} / ${labels.signal} / ${labels.frequency}`);
      successCount++;

      // Save after each successful generation
      const sorted = Object.keys(existing)
        .map(k => parseInt(k))
        .sort((a, b) => a - b)
        .reduce((acc, k) => {
          acc[k] = existing[k];
          return acc;
        }, {});

      writeFileSync(keysPath, JSON.stringify(sorted, null, 2), 'utf8');

      // Rate limiting: 1 second between calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`  ✗ Gate ${gateNum} failed:`, err.message);
      errorCount++;
      // Continue with next gate
    }
  }

  console.log(`\n✓ Complete! Successfully generated vocabulary for ${successCount}/64 gates`);
  if (errorCount > 0) {
    console.log(`⚠ ${errorCount} gates had errors — review above for details`);
  }
}

if (!API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY environment variable required');
  process.exit(1);
}

generateAllVocabulary().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
