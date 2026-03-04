/**
 * RAG Context Builder — Knowledgebase Retrieval
 *
 * Consolidated RAG module - single source of truth for knowledgebase context.
 * Pulls relevant knowledgebase entries for a specific chart
 * and injects them into synthesis prompts as grounding material.
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
      // Workers runtime — data injected by engine-compat.js
      if (globalThis.__PRIME_DATA?.kb?.[key]) {
        _cache[key] = globalThis.__PRIME_DATA.kb[key];
      } else if (KB_ROOT) {
        // Node.js runtime — read from filesystem
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
 * 
 * Comprehensive knowledgebase context including:
 * - HD Type, Profile, Authority, Definition
 * - Centers (defined/undefined)
 * - Active Gates and Channels
 * - Forge mapping
 * - Incarnation Cross
 * - Gene Keys wisdom
 * - Astrology (planets, signs, houses, aspects)
 * - Numerology (life path, personal year, tarot)
 * - Six Knowledges (Prime Self framework)
 *
 * @param {object} chartData — combined chart data from calculateFullChart()
 * @returns {string} — formatted RAG context for prompt injection
 */
export function buildRAGContext(chartData) {
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

    // Authority (how to make decisions)
    const authority = loadKB('hd', 'authority.json');
    const authRaw = chartData.hdChart?.authority || '';
    // Map authority names to KB keys
    const authMap = {
      'Emotional': 'emotional',
      'Solar Plexus': 'emotional',
      'Emotional Solar Plexus': 'emotional',
      'Sacral': 'sacral',
      'Splenic': 'splenic',
      'Ego Manifested': 'ego_manifested',
      'Ego Projected': 'ego_projected',
      'Self Projected': 'self_projected',
      'Mental Projector': 'mental_projector',
      'Lunar': 'lunar_cycle',
      'Lunar Cycle': 'lunar_cycle'
    };
    const authKey = authMap[authRaw] || authRaw.toLowerCase().replace(/\s+/g, '_');
    if (authority[authKey]) {
      const auth = authority[authKey];
      sections.push(`### AUTHORITY: ${auth.authority}\n${auth.description}\n\n**How It Works:** ${auth.howItWorks}\n\n**Strategy:** ${auth.strategy}\n\n**Prime Insight:** ${auth.primeInsight}`);
    }

    // Definition (energy flow pattern)
    const definition = loadKB('hd', 'definition.json');
    const defRaw = chartData.hdChart?.definition || '';
    // Map definition names to KB keys
    const defMap = {
      'Single Definition': 'single',
      'Split Definition': 'split',
      'Triple Split Definition': 'triple_split',
      'Quadruple Split Definition': 'quadruple_split',
      'No Definition': 'none',
      'None': 'none'
    };
    const defKey = defMap[defRaw] || defRaw.toLowerCase().replace(/\s+definition/i, '').replace(/\s+/g, '_');
    if (definition[defKey]) {
      const def = definition[defKey];
      sections.push(`### DEFINITION: ${def.name}\n${def.description}\n\n**Theme:** ${def.theme}\n\n**Prime Insight:** ${def.primeInsight}`);
    }

    // Centers (defined and undefined energy mechanics)
    const centers = loadKB('hd', 'centers.json');
    const centerLines = [];
    
    // Defined centers
    if (chartData.hdChart?.definedCenters && Array.isArray(chartData.hdChart.definedCenters)) {
      chartData.hdChart.definedCenters.forEach(centerName => {
        const centerKey = centerName.toLowerCase().replace(/\s+/g, '_');
        const center = centers[centerKey];
        if (center) {
          centerLines.push(`**${centerName} (Defined):** ${center.definedTheme}`);
        }
      });
    }
    
    // Undefined centers
    if (chartData.hdChart?.undefinedCenters && Array.isArray(chartData.hdChart.undefinedCenters)) {
      chartData.hdChart.undefinedCenters.forEach(centerName => {
        const centerKey = centerName.toLowerCase().replace(/\s+/g, '_');
        const center = centers[centerKey];
        if (center) {
          centerLines.push(`**${centerName} (Undefined):** ${center.undefinedTheme}`);
        }
      });
    }
    
    if (centerLines.length) {
      const definedCount = chartData.hdChart?.definedCenters?.length || 0;
      sections.push(`### CENTERS (${definedCount} defined, ${9 - definedCount} undefined)\n${centerLines.join('\n')}`);
    }

    // Active gates (cap at 10)
    const gates = loadKB('hd', 'gates.json');
    if (!gates._meta) {
      const active = collectActiveGates(chartData);
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

    // Incarnation Cross
    const crossesKB = loadKB('hd', 'crosses.json');
    const crossName = chartData.hdChart?.cross?.name || (typeof chartData.hdChart?.cross === 'string' ? chartData.hdChart.cross : null);
    if (crossName) {
      const crossEntry = Object.values(crossesKB).find(v => v && v.cross === crossName);
      if (crossEntry) {
        sections.push(`### INCARNATION CROSS: ${crossName}\n${crossEntry.description?.slice(0, 300) || ''}\n${crossEntry.lifeTheme ? `Life Theme: ${crossEntry.lifeTheme}` : ''}`);
      }
    }

    // Gene Keys for active gates
    const geneKeys = loadKB('genekeys', 'keys.json');
    const activeGates = collectActiveGates(chartData);
    if (activeGates.length > 0 && Object.keys(geneKeys).length > 0) {
      const keyLines = activeGates.slice(0, 8).map(g => {
        const key = geneKeys[g];
        if (!key) return '';
        return `Gene Key ${g} - ${key.name}\n  Shadow: ${key.shadow} - ${key.shadowDescription?.slice(0, 150) || ''}\n  Gift: ${key.gift} - ${key.giftDescription?.slice(0, 150) || ''}\n  Siddhi: ${key.siddhi}\n  Contemplation: ${key.contemplation || ''}`;
      }).filter(Boolean);
      if (keyLines.length) sections.push(`### GENE KEYS WISDOM\n${keyLines.join('\n\n')}`);
    }

    // Astrology: Major Planets in Signs
    const planets = loadKB('astro', 'planets.json');
    const signs = loadKB('astro', 'signs.json');
    const houses = loadKB('astro', 'houses.json');
    if (chartData.astrology?.placements) {
      const planetLines = [];
      const majorPlanets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'];
      
      for (const planetName of majorPlanets) {
        const placement = chartData.astrology.placements.find(
          pl => pl.planet === planetName || pl.body === planetName
        );
        if (placement) {
          const planetKey = planetName.toLowerCase();
          const signKey = placement.sign?.toLowerCase();
          const planetInfo = planets[planetKey];
          const signInfo = signs[signKey];
          
          if (planetInfo && signInfo) {
            const planetDesc = planetInfo.description?.slice(0, 180) || planetInfo.astroRole;
            const signDesc = signInfo.primeExpression || signInfo.description?.slice(0, 120);
            let houseSuffix = '';
            
            if (placement.house && houses[placement.house]) {
              const houseInfo = houses[placement.house];
              houseSuffix = `\n  House ${placement.house} (${houseInfo.name}): ${houseInfo.primeInsight}`;
            }
            
            planetLines.push(`**${planetName} in ${placement.sign}** (${placement.degrees?.toFixed(1)}°)${placement.house ? ` — House ${placement.house}` : ''}\n  Planet: ${planetDesc}\n  Sign: ${signDesc}${houseSuffix}\n  **Prime Insight:** ${planetInfo.primeInsight}`);
          }
        }
      }
      
      if (planetLines.length) {
        sections.push(`### PLANETARY ARCHETYPES\n${planetLines.join('\n\n')}`);
      }
    }

    // Astrology: Major Aspects
    const aspectsKB = loadKB('astro', 'aspects.json');
    if (chartData.astrology?.aspects && Array.isArray(chartData.astrology.aspects)) {
      const topAspects = chartData.astrology.aspects
        .filter(a => a.aspect && a.planet1 && a.planet2)
        .sort((a, b) => (Math.abs(a.orb || 10) - Math.abs(b.orb || 10)))
        .slice(0, 6);
      
      const aspectLines = topAspects.map(a => {
        const aspectKey = a.aspect?.toLowerCase();
        const aspectInfo = aspectsKB[aspectKey];
        if (aspectInfo) {
          return `**${a.planet1} ${a.aspect} ${a.planet2}** (orb ${Math.abs(a.orb || 0).toFixed(1)}°)\n  ${aspectInfo.description?.slice(0, 180)}\n  **Prime Insight:** ${aspectInfo.primeInsight}`;
        }
        return '';
      }).filter(Boolean);
      
      if (aspectLines.length) {
        sections.push(`### MAJOR ASPECTS\n${aspectLines.join('\n\n')}`);
      }
    }

    // Numerology insights
    if (chartData.numerology) {
      const n = chartData.numerology;
      const lifePaths = loadKB('numerology', 'lifePaths.json');
      const personalYears = loadKB('numerology', 'personalYears.json');
      const tarotCards = loadKB('numerology', 'tarotCards.json');

      const numSections = [];
      
      if (n.lifePath && lifePaths[n.lifePath.number]) {
        const lp = lifePaths[n.lifePath.number];
        numSections.push(`Life Path ${n.lifePath.number}: ${lp.name}\n  ${lp.description?.slice(0, 200) || lp.essence || ''}`);
      }

      if (n.personalYear && personalYears[n.personalYear.number]) {
        const py = personalYears[n.personalYear.number];
        numSections.push(`Personal Year ${n.personalYear.number}: ${py.theme}\n  ${py.guidance?.slice(0, 200) || py.description?.slice(0, 200) || ''}`);
      }

      if (n.tarotCard && tarotCards[n.lifePath?.number]) {
        const tc = tarotCards[n.lifePath.number];
        numSections.push(`Tarot Birth Card: ${tc.card}\n  ${tc.description?.slice(0, 150) || ''}`);
      }

      if (numSections.length) sections.push(`### NUMEROLOGY INSIGHTS\n${numSections.join('\n\n')}`);
    }

    // Prime Self: Six Knowledges
    const knowledges = loadKB('prime_self', 'knowledges.json');
    if (Object.keys(knowledges).length > 1) {
      const knowledgeLines = [];
      const relevantKnowledges = [];
      
      // Sciences: Ajna defined, Logic circuit active
      if (chartData.hdChart?.definedCenters?.some(c => c === 'Ajna' || c.includes('Ajna'))) {
        relevantKnowledges.push('sciences');
      }
      
      // Arts: Throat defined, creative expression gates (1, 8, 56, 62)
      const activeGates = collectActiveGates(chartData);
      if (chartData.hdChart?.definedCenters?.some(c => c === 'Throat' || c.includes('Throat')) || 
          activeGates.some(g => [1, 8, 56, 62].includes(g))) {
        relevantKnowledges.push('arts');
      }
      
      // Defenses: Spleen/Heart/Ego defined
      if (chartData.hdChart?.definedCenters?.some(c => c === 'Spleen' || c === 'Heart' || c === 'Ego' || 
          c.includes('Spleen') || c.includes('Heart') || c.includes('Ego'))) {
        relevantKnowledges.push('defenses');
      }
      
      // Heresies: Individual circuit gates (43, 23, 61, 24)
      if (activeGates.some(g => [43, 23, 61, 24].includes(g))) {
        relevantKnowledges.push('heresies');
      }
      
      // Connections: Solar Plexus defined, Tribal gates (37, 40, 6, 59)
      if (chartData.hdChart?.definedCenters?.some(c => c === 'Solar Plexus' || c.includes('Solar Plexus')) ||
          activeGates.some(g => [37, 40, 6, 59].includes(g))) {
        relevantKnowledges.push('connections');
      }
      
      // Mysteries: Head defined, gates 61, 64, 63
      if (chartData.hdChart?.definedCenters?.some(c => c === 'Head' || c.includes('Head')) ||
          activeGates.some(g => [61, 64, 63].includes(g))) {
        relevantKnowledges.push('mysteries');
      }
      
      // Fallback if no matches
      if (relevantKnowledges.length === 0) {
        relevantKnowledges.push('sciences', 'arts', 'connections');
      }
      
      // Take top 3 most relevant Knowledges
      const topKnowledges = relevantKnowledges.slice(0, 3);
      
      for (const kKey of topKnowledges) {
        const k = knowledges[kKey];
        if (k && k.knowledge) {
          knowledgeLines.push(`**${k.knowledge}** — ${k.essence}\n  ${k.description?.slice(0, 200) || ''}\n  **Prime Question:** ${k.primeQuestion}`);
        }
      }
      
      if (knowledgeLines.length) {
        sections.push(`### PRIME SELF: SIX KNOWLEDGES\n${knowledgeLines.join('\n\n')}`);
      }
    }

    return sections.length ? `## KNOWLEDGEBASE CONTEXT (RAG)\n\n${sections.join('\n\n---\n\n')}` : '';
  } catch {
    return '';
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function collectActiveGates(chartData) {
  const gates = new Set();
  for (const side of ['personalityGates', 'designGates']) {
    if (chartData[side]) {
      for (const val of Object.values(chartData[side])) {
        if (val?.gate) gates.add(val.gate);
      }
    }
  }
  return [...gates].sort((a, b) => a - b);
}
