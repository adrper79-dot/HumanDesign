/**
 * Knowledgebase Generation Script
 *
 * Generates HD gate, channel, and cross descriptions using Claude Opus 4.6
 * via the Anthropic API. Follows the Build Bible Section 12 prompts.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node src/knowledgebase/generate.js [--gates|--channels|--crosses|--audit]
 *
 * Each generation run appends to the corresponding JSON file.
 * Use --audit to run quality checks on generated content.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-20250514'; // Use Sonnet for generation speed; Opus for final quality pass
const MAX_TOKENS = 4096;

// ─── Data Loaders ────────────────────────────────────────────

function loadJSON(relativePath) {
  const fullPath = join(__dirname, '..', relativePath);
  return JSON.parse(readFileSync(fullPath, 'utf8'));
}

function saveJSON(relativePath, data) {
  const fullPath = join(__dirname, relativePath);
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  ✓ Saved ${fullPath}`);
}

function loadExisting(relativePath) {
  const fullPath = join(__dirname, relativePath);
  if (existsSync(fullPath)) {
    return JSON.parse(readFileSync(fullPath, 'utf8'));
  }
  return {};
}

// ─── API Call ────────────────────────────────────────────────

async function callClaude(systemPrompt, userPrompt) {
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
      system: systemPrompt,
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
  if (!jsonMatch) throw new Error('No JSON found in response');

  return JSON.parse(jsonMatch[0]);
}

// ─── Gate Generation ─────────────────────────────────────────

const GATE_SYSTEM = `You are a scholar of the I Ching, Human Design structural logic,
and Western Astrology. You write original interpretive content grounded in
primary sources. You never use Ra Uru Hu's specific phrases or proprietary
terminology beyond standard HD structural terms.`;

async function generateGate(gateNum, wheelData, centersData, channelsData) {
  // Find gate info
  const gateEntry = wheelData.gates.find(g => g.gate === gateNum);
  if (!gateEntry) throw new Error(`Gate ${gateNum} not found in wheel data`);

  // Find center
  let center = 'Unknown';
  for (const [name, info] of Object.entries(centersData)) {
    if (info.gates && info.gates.includes(gateNum)) {
      center = name;
      break;
    }
  }

  // Find channel partner
  let partner = null;
  let circuit = 'Unknown';
  for (const ch of channelsData) {
    const gates = ch.gates || [ch.gate1, ch.gate2];
    if (gates.includes(gateNum)) {
      partner = gates.find(g => g !== gateNum);
      circuit = ch.circuit || 'Unknown';
      break;
    }
  }

  const userPrompt = `For Gate ${gateNum} (Hexagram ${gateNum}):

HD structural facts (observable, not interpreted):
- Center: ${center}
- Circuit: ${circuit}
- Channel partner: Gate ${partner || 'unknown'}
- Wheel position: starts at ${gateEntry.startDegree}° ecliptic

Write an original interpretation that:
1. Is grounded in the hexagram's actual meaning
2. Reflects the center's biological/energetic function in HD
3. Describes the gate's role in its circuit
4. Uses empowering, practical language accessible to the Prime Self audience
5. Is entirely your own original expression

Also write 6 line descriptions (one per line), each reflecting the line's positional theme.

Output as JSON:
{
  "gate": ${gateNum},
  "center": "${center}",
  "circuit": "${circuit}",
  "channelPartner": ${partner || 'null'},
  "description": "string (2-3 paragraphs)",
  "theme": "string (one phrase)",
  "lines": {
    "1": { "name": "string", "description": "string" },
    "2": { "name": "string", "description": "string" },
    "3": { "name": "string", "description": "string" },
    "4": { "name": "string", "description": "string" },
    "5": { "name": "string", "description": "string" },
    "6": { "name": "string", "description": "string" }
  }
}`;

  return callClaude(GATE_SYSTEM, userPrompt);
}

async function generateAllGates() {
  const wheelData = loadJSON('data/gate_wheel.json');
  const centersData = loadJSON('data/centers.json');
  const channelsData = loadJSON('data/channels.json');

  const existing = loadExisting('hd/gates.json');
  const gates = { ...existing };

  for (let i = 1; i <= 64; i++) {
    if (gates[i]) {
      console.log(`  ✓ Gate ${i} already exists, skipping`);
      continue;
    }

    console.log(`  → Generating Gate ${i}...`);
    try {
      gates[i] = await generateGate(i, wheelData, centersData, channelsData);
      // Save after each to preserve progress
      saveJSON('hd/gates.json', gates);
      // Rate limit: ~300ms between calls
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`  ✗ Gate ${i} failed: ${err.message}`);
    }
  }

  return gates;
}

// ─── Channel Generation ──────────────────────────────────────

async function generateChannel(channelData, gateDescriptions) {
  const gates = channelData.gates || [channelData.gate1, channelData.gate2];
  const [gA, gB] = gates;
  const centers = channelData.centers || [channelData.center1, channelData.center2];

  const gateADesc = gateDescriptions[gA]?.description || `Gate ${gA}`;
  const gateBDesc = gateDescriptions[gB]?.description || `Gate ${gB}`;

  const userPrompt = `Given these two gate descriptions:

Gate ${gA}: ${gateADesc}
Gate ${gB}: ${gateBDesc}

This channel connects the ${centers[0]} center to the ${centers[1]} center.
Circuit: ${channelData.circuit || 'Unknown'}

Write an original synthesis describing what this channel represents
when both gates are active. Ground in the gate meanings and center functions.

Output as JSON:
{
  "channel": "${gA}-${gB}",
  "gates": [${gA}, ${gB}],
  "centers": ["${centers[0]}", "${centers[1]}"],
  "circuit": "${channelData.circuit || 'Unknown'}",
  "name": "string (original name)",
  "description": "string (2 paragraphs)",
  "theme": "string"
}`;

  return callClaude(GATE_SYSTEM, userPrompt);
}

async function generateAllChannels() {
  const channelsData = loadJSON('data/channels.json');
  const gateDescriptions = loadExisting('hd/gates.json');

  if (Object.keys(gateDescriptions).length < 64) {
    console.warn('  ⚠ Not all gates generated yet. Run --gates first.');
  }

  const existing = loadExisting('hd/channels.json');
  const channels = { ...existing };

  // Deduplicate channels (handle 23-43 / 43-23 duplicates)
  const seen = new Set();
  const uniqueChannels = channelsData.filter(ch => {
    const gates = ch.gates || [ch.gate1, ch.gate2];
    const key = gates.sort((a, b) => a - b).join('-');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const ch of uniqueChannels) {
    const gates = ch.gates || [ch.gate1, ch.gate2];
    const key = gates.sort((a, b) => a - b).join('-');

    if (channels[key]) {
      console.log(`  ✓ Channel ${key} already exists, skipping`);
      continue;
    }

    console.log(`  → Generating Channel ${key}...`);
    try {
      channels[key] = await generateChannel(ch, gateDescriptions);
      saveJSON('hd/channels.json', channels);
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`  ✗ Channel ${key} failed: ${err.message}`);
    }
  }

  return channels;
}

// ─── Cross Generation ────────────────────────────────────────

async function generateCross(crossName, crossType, gates, quarter, gateDescriptions) {
  const gateDescs = gates.map(g => {
    const desc = gateDescriptions[g];
    return `Gate ${g}: ${desc?.description || desc?.theme || `Gate ${g}`}`;
  }).join('\n');

  const userPrompt = `The Incarnation Cross "${crossName}" is defined by Gates ${gates.join(', ')}.

Given these gate descriptions:
${gateDescs}

Quarter: ${quarter}
Cross type: ${crossType}

Write an original synthesis describing the life theme of this cross.
The cross represents the overarching purpose visible from a distance —
not what the person does, but the field of experience they're here to explore.

Output as JSON:
{
  "cross": "${crossName}",
  "type": "${crossType}",
  "gates": [${gates.join(', ')}],
  "quarter": "${quarter}",
  "description": "string (2 paragraphs)",
  "lifeTheme": "string (one sentence)"
}`;

  return callClaude(GATE_SYSTEM, userPrompt);
}

async function generateAllCrosses() {
  const gateDescriptions = loadExisting('hd/gates.json');

  if (Object.keys(gateDescriptions).length < 64) {
    console.warn('  ⚠ Not all gates generated yet. Run --gates first for best results.');
  }

  // Load crosses data reference
  const crossesRef = loadJSON('data/crosses.json');
  const existing = loadExisting('hd/crosses.json');
  const crosses = { ...existing };

  // Quarter assignments based on gate number ranges in the mandala
  const QUARTER_MAP = {
    'Initiation': [13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24],
    'Civilization': [2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33],
    'Duality': [7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44],
    'Mutation': [1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60, 41, 19],
  };

  function getQuarter(gateNum) {
    for (const [q, gates] of Object.entries(QUARTER_MAP)) {
      if (gates.includes(gateNum)) return q;
    }
    return 'Unknown';
  }

  const variants = ['right', 'juxta', 'left'];
  const variantTypes = {
    right: 'Right Angle',
    juxta: 'Juxtaposition',
    left: 'Left Angle'
  };

  for (const [gateStr, crossEntry] of Object.entries(crossesRef)) {
    if (gateStr === '_meta') continue;
    const gateNum = parseInt(gateStr);
    const quarter = getQuarter(gateNum);

    for (const variant of variants) {
      if (!crossEntry[variant]) continue;

      const { name, gates } = crossEntry[variant];
      const key = `${gateStr}_${variant}`;

      if (crosses[key]) {
        console.log(\`  ✓ Cross \${name} already exists, skipping\`);
        continue;
      }

      console.log(\`  → Generating Cross: \${name}...\`);
      try {
        crosses[key] = await generateCross(name, variantTypes[variant], gates, quarter, gateDescriptions);
        saveJSON('hd/crosses.json', crosses);
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error(\`  ✗ Cross \${name} failed: \${err.message}\`);
      }
    }
  }

  return crosses;
}

// ─── Quality Audit ───────────────────────────────────────────

const AUDIT_SYSTEM = `You are a quality auditor for Human Design content.
Your task is to check that interpretive content is original, grounded,
and does not borrow from proprietary sources.`;

async function auditContent(content) {
  const userPrompt = `Review this gate/channel description. Check against these criteria:

1. Does it contain any phrases that appear to be directly borrowed from
   Ra Uru Hu's proprietary HD teachings?
2. Is every claim grounded in either the I Ching source text or
   observable HD structural logic?
3. Does the language feel original vs derivative?
4. Rate originality 1-10.
5. Flag any sentences that should be rewritten.

Content to audit:
${JSON.stringify(content, null, 2)}

Return:
{
  "originality": number,
  "flaggedSentences": ["string"],
  "suggestedRewrites": ["string"],
  "pass": boolean
}`;

  return callClaude(AUDIT_SYSTEM, userPrompt);
}

// ─── CLI ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0] || '--help';

if (!API_KEY && command !== '--help') {
  console.error('Set ANTHROPIC_API_KEY environment variable');
  process.exit(1);
}

switch (command) {
  case '--gates':
    console.log('Generating 64 gate descriptions...');
    generateAllGates().then(() => console.log('Done.'));
    break;

  case '--channels':
    console.log('Generating 36 channel descriptions...');
    generateAllChannels().then(() => console.log('Done.'));
    break;

  case '--crosses':
    console.log('Generating 192 incarnation cross descriptions...');
    generateAllCrosses().then(() => console.log('Done.'));
    break;

  case '--audit':
    console.log('Auditing generated content...');
    const gates = loadExisting('hd/gates.json');
    const sampleGate = gates[Object.keys(gates)[0]];
    if (sampleGate) {
      auditContent(sampleGate).then(result => {
        console.log('Audit result:', JSON.stringify(result, null, 2));
      });
    } else {
      console.log('No gates to audit. Run --gates first.');
    }
    break;

  default:
    console.log(`
Knowledgebase Generator — Prime Self

Usage:
  ANTHROPIC_API_KEY=sk-... node src/knowledgebase/generate.js <command>

Commands:
  --gates      Generate 64 gate descriptions
  --channels   Generate 36 channel descriptions (requires gates)
  --crosses    Generate 192 incarnation cross descriptions (requires gates)
  --audit      Run quality audit on generated content
  --help       Show this help
`);
}
