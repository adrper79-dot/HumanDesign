/**
 * RAG Context Builder — Knowledgebase Retrieval
 *
 * Pulls relevant knowledgebase entries for a specific chart
 * and injects them into the synthesis prompt as grounding material.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Workers runtime: import.meta.url may be undefined — guard fileURLToPath
let __dirname_resolved = '';
try {
  if (import.meta.url) {
    __dirname_resolved = dirname(fileURLToPath(import.meta.url));
  }
} catch { /* Workers runtime */ }
const KB_ROOT = __dirname_resolved ? join(__dirname_resolved, '..', 'knowledgebase') : '';

// ─── Lazy-loaded KB cache ────────────────────────────────────

let _cache = {};

function loadKB(category, file) {
  const key = `${category}/${file}`;
  if (!_cache[key]) {
    try {
      if (globalThis.__PRIME_DATA?.kb?.[key]) {
        _cache[key] = globalThis.__PRIME_DATA.kb[key];
      } else if (KB_ROOT) {
        const path = join(KB_ROOT, category, file);
        _cache[key] = JSON.parse(readFileSync(path, 'utf8'));
      } else {
        _cache[key] = {};
      }
    } catch {
      _cache[key] = {};
    }
  }
  return _cache[key];
}

/**
 * Build RAG context for a specific chart.
 * Pulls only the knowledgebase entries relevant to this person's
 * active gates, channels, type, profile, signs, and Forge.
 *
 * @param {object} chartData — full chart from calculateFullChart()
 * @returns {string} — formatted RAG context for prompt injection
 */
export function buildRAGContext(chartData) {
  const sections = [];

  // 1. Type description
  const types = loadKB('hd', 'types.json');
  const typeKey = chartData.chart?.type?.toLowerCase().replace(/\s+/g, '_');
  if (types[typeKey]) {
    sections.push(formatSection('YOUR TYPE', types[typeKey]));
  }

  // 2. Profile description
  const profiles = loadKB('hd', 'profiles.json');
  const profileKey = chartData.chart?.profile;
  if (profiles[profileKey]) {
    sections.push(formatSection('YOUR PROFILE', profiles[profileKey]));
  }

  // 3. Active gate descriptions
  const gates = loadKB('hd', 'gates.json');
  if (!gates._meta) {  // Has actual gate content
    const activeGates = collectActiveGates(chartData);
    const gateLines = [];
    for (const gateNum of activeGates.slice(0, 10)) {  // Cap at 10 for token budget
      if (gates[gateNum]) {
        gateLines.push(`Gate ${gateNum} (${gates[gateNum].theme}): ${gates[gateNum].description?.slice(0, 200)}...`);
      }
    }
    if (gateLines.length) {
      sections.push(`### ACTIVE GATES\n${gateLines.join('\n\n')}`);
    }
  }

  // 4. Active channel descriptions
  const channels = loadKB('hd', 'channels.json');
  if (!channels._meta && chartData.chart?.activeChannels) {
    const chLines = [];
    for (const ch of chartData.chart.activeChannels.slice(0, 6)) {
      const key = ch.channel || `${ch.gates?.[0]}-${ch.gates?.[1]}`;
      if (channels[key]) {
        chLines.push(`Channel ${key} (${channels[key].theme}): ${channels[key].description?.slice(0, 200)}...`);
      }
    }
    if (chLines.length) {
      sections.push(`### ACTIVE CHANNELS\n${chLines.join('\n\n')}`);
    }
  }

  // 5. Center descriptions (defined + undefined)
  const centers = loadKB('hd', 'centers.json');
  if (chartData.chart?.definedCenters) {
    const centerLines = [];
    for (const c of chartData.chart.definedCenters) {
      const key = c.toLowerCase().replace(/\s+/g, '').replace('identity', 'g').replace('self', 'g');
      if (centers[key]) {
        centerLines.push(`${c} (Defined): ${centers[key].definedTheme}`);
      }
    }
    for (const c of (chartData.chart.undefinedCenters || [])) {
      const key = c.toLowerCase().replace(/\s+/g, '').replace('identity', 'g').replace('self', 'g');
      if (centers[key]) {
        centerLines.push(`${c} (Open): ${centers[key].undefinedTheme}`);
      }
    }
    if (centerLines.length) {
      sections.push(`### CENTER CONFIGURATION\n${centerLines.join('\n')}`);
    }
  }

  // 6. Zodiac sign info for key placements
  const signs = loadKB('astro', 'signs.json');
  if (chartData.astrology?.placements) {
    const signLines = [];
    const keyPlanets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'];
    for (const p of keyPlanets) {
      const placement = chartData.astrology.placements[p];
      if (placement) {
        const signKey = placement.sign?.toLowerCase();
        if (signs[signKey]) {
          signLines.push(`${p} in ${placement.sign}: ${signs[signKey].primeInsight}`);
        }
      }
    }
    if (signLines.length) {
      sections.push(`### ASTROLOGICAL CONTEXT\n${signLines.join('\n\n')}`);
    }
  }

  // 7. Planet meanings for key placements
  const planets = loadKB('astro', 'planets.json');
  if (chartData.astrology?.placements) {
    const planetLines = [];
    const outerPlanets = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
    for (const p of outerPlanets) {
      const placement = chartData.astrology.placements[p];
      if (placement && planets[p.toLowerCase()]) {
        planetLines.push(`${p} (${placement.sign} ${placement.degrees?.toFixed(1)}°): ${planets[p.toLowerCase()].hdRole}`);
      }
    }
    if (planetLines.length) {
      sections.push(`### OUTER PLANET THEMES\n${planetLines.join('\n')}`);
    }
  }

  // 8. Forge mapping
  const forges = loadKB('prime_self', 'forges.json');
  if (chartData.chart?.type) {
    const forgeKey = getForgeForType(chartData.chart.type);
    if (forges[forgeKey]) {
      sections.push(formatSection('PRIMARY FORGE', {
        forge: forges[forgeKey].forge,
        essence: forges[forgeKey].essence,
        primeQuestion: forges[forgeKey].primeQuestion,
        practicalExpression: forges[forgeKey].practicalExpression
      }));
    }
  }

  // 9. Knowledge mapping
  const knowledges = loadKB('prime_self', 'knowledges.json');
  const relevantKnowledges = getRelevantKnowledges(chartData);
  if (relevantKnowledges.length) {
    const kLines = relevantKnowledges.map(k => {
      const kb = knowledges[k];
      return kb ? `${kb.knowledge}: ${kb.essence}` : '';
    }).filter(Boolean);
    if (kLines.length) {
      sections.push(`### RELEVANT KNOWLEDGES\n${kLines.join('\n')}`);
    }
  }

  if (sections.length === 0) {
    return '(No knowledgebase entries available for this chart configuration)';
  }

  return `## KNOWLEDGEBASE CONTEXT (RAG)\n\n${sections.join('\n\n---\n\n')}`;
}

// ─── Helpers ─────────────────────────────────────────────────

function collectActiveGates(chartData) {
  const gates = new Set();
  if (chartData.personalityGates) {
    for (const [, val] of Object.entries(chartData.personalityGates)) {
      if (val?.gate) gates.add(val.gate);
    }
  }
  if (chartData.designGates) {
    for (const [, val] of Object.entries(chartData.designGates)) {
      if (val?.gate) gates.add(val.gate);
    }
  }
  return [...gates].sort((a, b) => a - b);
}

function getForgeForType(type) {
  const map = {
    'Manifestor': 'initiation',
    'Generator': 'mastery',
    'Manifesting Generator': 'mastery',
    'Projector': 'guidance',
    'Reflector': 'perception'
  };
  return map[type] || 'mastery';
}

function getRelevantKnowledges(chartData) {
  const knowledges = new Set();
  // Map circuits to knowledges
  if (chartData.chart?.activeChannels) {
    for (const ch of chartData.chart.activeChannels) {
      const circuit = ch.circuit?.toLowerCase();
      if (circuit?.includes('logic') || circuit?.includes('understanding')) {
        knowledges.add('sciences');
      }
      if (circuit?.includes('abstract') || circuit?.includes('sensing') || circuit?.includes('experiential')) {
        knowledges.add('arts');
      }
      if (circuit?.includes('tribal') || circuit?.includes('ego') || circuit?.includes('defense')) {
        knowledges.add('defenses');
      }
      if (circuit?.includes('individual') || circuit?.includes('knowing')) {
        knowledges.add('heresies');
      }
      if (circuit?.includes('community')) {
        knowledges.add('connections');
      }
    }
  }
  // Add mysteries for strong Head/Ajna/12th house emphasis
  if (chartData.chart?.definedCenters?.includes('Head') || chartData.chart?.definedCenters?.includes('Ajna')) {
    knowledges.add('mysteries');
  }
  return [...knowledges];
}

function formatSection(title, data) {
  const lines = [`### ${title}`];
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('_')) continue;
    if (typeof value === 'string') {
      lines.push(`**${key}:** ${value}`);
    } else if (Array.isArray(value)) {
      lines.push(`**${key}:** ${value.join(', ')}`);
    }
  }
  return lines.join('\n');
}
