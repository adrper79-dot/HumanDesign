/**
 * Generate missing Frequency Keys entries
 *
 * Uses Claude to generate content for the 26 missing Frequency Keys
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

const MISSING_KEYS = [28, 29, 30, 31, 32, 33, 34, 35, 36, 38, 39, 41, 42, 43, 44, 48, 49, 50, 52, 53, 54, 55, 56, 60, 61, 63];

const SYSTEM_PROMPT = `You are an expert on the Prime Self Frequency Keys system. You generate concise, accurate Frequency Key descriptions following the Shadow → Gift → Mastery spectrum.

Each Frequency Key entry must include:
- name: "Shadow / Gift / Mastery" (the three frequency states)
- shadow, gift, siddhi: single words (siddhi = the Mastery state)
- archetype: "The [name]" (2-3 words)
- message: one-sentence transformational insight (10-15 words)
- shadowDescription: 2-3 sentences describing the shadow frequency
- giftDescription: 2-3 sentences describing the gift frequency
- siddhiDescription: 2-3 sentences describing the mastery frequency
- contemplation: one reflective question (15-25 words)

Use Prime Self vocabulary: Shadow (unconscious resistance), Gift (embodied talent), Mastery (transcendent realization). Be concise and impactful.`;

async function callClaude(gateNumber) {
  const userPrompt = `Generate a complete Frequency Key entry for Frequency Key ${gateNumber}. Return ONLY valid JSON with this exact structure:

{
  "name": "Shadow / Gift / Mastery",
  "shadow": "word",
  "gift": "word",
  "siddhi": "word",
  "archetype": "The [name]",
  "message": "one-sentence insight",
  "shadowDescription": "2-3 sentences",
  "giftDescription": "2-3 sentences",
  "siddhiDescription": "2-3 sentences",
  "contemplation": "reflective question"
}`;

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
  
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Response:', text);
    throw new Error(`No JSON found in response for key ${gateNumber}`);
  }

  return JSON.parse(jsonMatch[0]);
}

async function generateAllMissing() {
  const keysPath = join(__dirname, 'keys.json');
  const existing = JSON.parse(readFileSync(keysPath, 'utf8'));

  console.log(`Generating ${MISSING_KEYS.length} missing Frequency Keys...\n`);

  for (const keyNum of MISSING_KEYS) {
    if (existing[keyNum]) {
      console.log(`  ⊗ Key ${keyNum} already exists, skipping`);
      continue;
    }

    try {
      console.log(`  → Generating Key ${keyNum}...`);
      const entry = await callClaude(keyNum);
      existing[keyNum] = entry;
      console.log(`  ✓ Key ${keyNum}: ${entry.name}`);

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
      console.error(`  ✗ Key ${keyNum} failed:`, err.message);
      // Continue with next key
    }
  }

  console.log(`\n✓ Complete! Generated ${Object.keys(existing).length}/64 keys`);
}

if (!API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY environment variable required');
  process.exit(1);
}

generateAllMissing().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
