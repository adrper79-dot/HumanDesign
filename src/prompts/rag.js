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

// ─── CONTEXTUAL INTERPRETATION HELPERS (BL-PS2, BL-PS5, BL-PS6, BL-PS7) ─────

/**
 * Planet context for gate interpretation - what role does this placement play?
 */
const PLANET_CONTEXTS = {
  sun: { role: 'Core Identity', theme: 'who you are at your essence', prevalence: 'unique to birth time' },
  earth: { role: 'Grounding Force', theme: 'how you ground your purpose', prevalence: 'unique to birth time' },
  moon: { role: 'Emotional Driver', theme: 'what motivates you emotionally', prevalence: 'changes monthly' },
  mercury: { role: 'Communication Style', theme: 'how you think and communicate', prevalence: 'unique to birth period' },
  venus: { role: 'Values & Relationships', theme: 'what you value and how you relate', prevalence: 'unique to birth period' },
  mars: { role: 'Action & Energy', theme: 'how you take action and assert yourself', prevalence: 'unique to birth period' },
  jupiter: { role: 'Growth & Expansion', theme: 'where you grow and find opportunity', prevalence: 'generational (12-year cycle)' },
  saturn: { role: 'Structure & Discipline', theme: 'where you build mastery through discipline', prevalence: 'generational (29-year cycle)' },
  uranus: { role: 'Innovation & Rebellion', theme: 'where you break patterns and innovate', prevalence: 'generational (84-year cycle)' },
  neptune: { role: 'Dreams & Spirituality', theme: 'where you dissolve boundaries and dream', prevalence: 'generational (165-year cycle)' },
  pluto: { role: 'Transformation & Power', theme: 'where you transform and claim power', prevalence: 'generational (248-year cycle)' },
  northnode: { role: 'Life Direction', theme: 'where you\'re growing toward', prevalence: 'unique (18.6-year cycle)' },
  southnode: { role: 'Past Patterns', theme: 'what you\'re releasing', prevalence: 'unique (18.6-year cycle)' },
  chiron: { role: 'Wounded Healer', theme: 'where your wounds become wisdom', prevalence: 'unique (50-year cycle)' }
};

/**
 * Line themes (I Ching hexagram line meanings)
 */
const LINE_THEMES = {
  1: { name: 'Investigator/Foundation', theme: 'researching, building foundation, introspection', gift: 'deep knowledge through investigation', challenge: 'insecurity without thorough research' },
  2: { name: 'Hermit/Natural', theme: 'innate talent, waiting to be called', gift: 'natural genius when called forth', challenge: 'shyness, hiding talents' },
  3: { name: 'Martyr/Experimenter', theme: 'learning through trial and error', gift: 'resilience, practical wisdom from experience', challenge: 'repeated mistakes, chaos' },
  4: { name: 'Opportunist/Networker', theme: 'building networks, opportunity through connection', gift: 'bridging people and resources', challenge: 'exhausting friendships, superficiality' },
  5: { name: 'Heretic/Universalizer', theme: 'practical solutions, projection from others', gift: 'solving problems at scale', challenge: 'seduction/betrayal dynamic, unrealistic expectations' },
  6: { name: 'Role Model/Objectivity', theme: 'wisdom from experience, teaching by example', gift: 'embodied wisdom, objectivity', challenge: 'pessimism, detachment' }
};

/**
 * House themes - which life area is this gate/planet expressed in?
 */
const HOUSE_THEMES = {
  1: 'self-identity and appearance',
  2: 'money and values',
  3: 'communication and siblings',
  4: 'home and family',
  5: 'creativity and romance',
  6: 'health and daily work',
  7: 'relationships and partnerships',
  8: 'transformation and shared resources',
  9: 'higher learning and travel',
  10: 'career and public life',
  11: 'community and friendships',
  12: 'spirituality and hidden matters'
};

/**
 * Get contextual interpretation for a specific gate activation.
 * Enriches generic gate description with planet context, line specificity, house placement, and channel status.
 * 
 * @param {number} gateNumber - Gate number (1-64)
 * @param {string} planet - Planet name (sun, moon, mercury, etc.)
 * @param {number} line - Line number (1-6)
 * @param {boolean} isDesignSide - True if from designGates (unconscious), false if from personalityGates (conscious)
 * @param {number} house - Astrological house (1-12) - optional
 * @param {boolean} isChannelComplete - True if this gate completes a channel (not hanging)
 * @param {string} baseDescription - Base gate description from KB
 * @returns {string} Enriched contextual interpretation
 */
function getContextualGateInterpretation(gateNumber, planet, line, isDesignSide, house, isChannelComplete, baseDescription) {
  const parts = [];
  
  // Base description
  parts.push(baseDescription);
  
  // Planet context
  const planetContext = PLANET_CONTEXTS[planet.toLowerCase()];
  if (planetContext) {
    const consciousnessNote = isDesignSide ? 'unconscious design' : 'conscious personality';
    parts.push(`\n**Planet Context (${planet.toUpperCase()}):** ${planetContext.role} — ${planetContext.theme}. This is your ${consciousnessNote} placement (${isDesignSide ? 'what you don\'t see in yourself but others do' : 'what you\'re aware of'}). Prevalence: ${planetContext.prevalence}.`);
  }
  
  // Line specificity
  const lineTheme = LINE_THEMES[line];
  if (lineTheme) {
    parts.push(`\n**Line ${line} (${lineTheme.name}):** ${lineTheme.theme}. ${lineTheme.gift} | Challenge: ${lineTheme.challenge}.`);
  }
  
  // House placement (life area)
  if (house && HOUSE_THEMES[house]) {
    parts.push(`\n**House ${house}:** This energy expresses in the realm of ${HOUSE_THEMES[house]}. Unlike same gate in different houses, yours plays out specifically here.`);
  }
  
  // Channel completion status
  if (isChannelComplete !== undefined) {
    if (isChannelComplete) {
      parts.push(`\n**Channel Status:** COMPLETE — This gate connects to form a full channel. You have CONSISTENT, RELIABLE access to this energy. This is rarer than hanging gates (~8-15% of people have each specific channel).`);
    } else {
      parts.push(`\n**Channel Status:** HANGING — This gate is active but doesn't complete a channel. You SEEK this energy from others or experience it inconsistently. This is actually more common than complete channels.`);
    }
  }
  
  return parts.join('');
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

    // Active gates WITH CONTEXTUAL INTERPRETATION (BL-PS2, BL-PS5, BL-PS6, BL-PS7)
    const gates = loadKB('hd', 'gates.json');
    if (!gates._meta) {
      const gateLines = [];
      const activeChannelGates = new Set();
      
      // Build set of gates that complete channels
      if (chartData.hdChart?.activeChannels && Array.isArray(chartData.hdChart.activeChannels)) {
        chartData.hdChart.activeChannels.forEach(ch => {
          if (ch.gates && Array.isArray(ch.gates)) {
            ch.gates.forEach(g => activeChannelGates.add(g));
          }
        });
      }
      
      // Helper to find house for a planet
      // BL-FIX: placements is an Object keyed by body name, not an Array - use direct access
      const getHouseForPlanet = (planetName) => {
        if (!chartData.astrology?.placements) return null;
        // placements is { sun: {...}, moon: {...}, ... } not an array
        const placements = chartData.astrology.placements;
        // Try direct key lookup first (most efficient)
        const directMatch = placements[planetName] || placements[planetName.toLowerCase()];
        if (directMatch) return directMatch.house || null;
        // Fallback: search Object.entries for case-insensitive match
        for (const [key, p] of Object.entries(placements)) {
          if (key.toLowerCase() === planetName.toLowerCase()) {
            return p?.house || null;
          }
        }
        return null;
      };
      
      // Process personality gates (conscious)
      if (chartData.personalityGates) {
        for (const [planet, gateData] of Object.entries(chartData.personalityGates)) {
          if (!gateData?.gate || !gates[gateData.gate]) continue;
          
          const baseDesc = gates[gateData.gate].description?.slice(0, 150) || gates[gateData.gate].theme || '';
          const house = getHouseForPlanet(planet);
          const isComplete = activeChannelGates.has(gateData.gate);
          
          const enriched = getContextualGateInterpretation(
            gateData.gate,
            planet,
            gateData.line || 1,
            false, // personality = conscious
            house,
            isComplete,
            `**Gate ${gateData.gate} (${gates[gateData.gate].name || ''})** — ${baseDesc}`
          );
          
          gateLines.push(`**PERSONALITY ${planet.toUpperCase()} — Gate ${gateData.gate}.${gateData.line || 1}**\n${enriched}`);
        }
      }
      
      // Process design gates (unconscious)
      if (chartData.designGates) {
        for (const [planet, gateData] of Object.entries(chartData.designGates)) {
          if (!gateData?.gate || !gates[gateData.gate]) continue;
          
          const baseDesc = gates[gateData.gate].description?.slice(0, 150) || gates[gateData.gate].theme || '';
          const house = getHouseForPlanet(planet);
          const isComplete = activeChannelGates.has(gateData.gate);
          
          const enriched = getContextualGateInterpretation(
            gateData.gate,
            planet,
            gateData.line || 1,
            true, // design = unconscious
            house,
            isComplete,
            `**Gate ${gateData.gate} (${gates[gateData.gate].name || ''})** — ${baseDesc}`
          );
          
          gateLines.push(`**DESIGN ${planet.toUpperCase()} — Gate ${gateData.gate}.${gateData.line || 1}**\n${enriched}`);
        }
      }
      
      // Limit to top 12 most significant (prioritize Sun, Moon, Mercury, Venus, Mars > others)
      const priorityOrder = ['sun', 'moon', 'mercury', 'venus', 'mars', 'earth', 'jupiter', 'saturn', 'northnode', 'southnode', 'uranus', 'neptune', 'pluto'];
      gateLines.sort((a, b) => {
        const planetA = a.match(/(?:PERSONALITY|DESIGN)\s+(\w+)/)?.[1]?.toLowerCase() || '';
        const planetB = b.match(/(?:PERSONALITY|DESIGN)\s+(\w+)/)?.[1]?.toLowerCase() || '';
        const idxA = priorityOrder.indexOf(planetA);
        const idxB = priorityOrder.indexOf(planetB);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });
      
      if (gateLines.length) sections.push(`### ACTIVE GATES (Contextual Interpretations)\n\n${gateLines.slice(0, 12).join('\n\n---\n\n')}`);
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

    // Gene Keys for active gates WITH LINE-SPECIFIC WISDOM (BL-PS6)
    const geneKeys = loadKB('genekeys', 'keys.json');
    if (Object.keys(geneKeys).length > 0) {
      const keyLines = [];
      
      // Collect gates with their line info from personality and design
      const gatesWithLines = [];
      
      if (chartData.personalityGates) {
        for (const [planet, gateData] of Object.entries(chartData.personalityGates)) {
          if (gateData?.gate && geneKeys[gateData.gate]) {
            gatesWithLines.push({ gate: gateData.gate, line: gateData.line || 1, planet, isDesign: false });
          }
        }
      }
      
      if (chartData.designGates) {
        for (const [planet, gateData] of Object.entries(chartData.designGates)) {
          if (gateData?.gate && geneKeys[gateData.gate]) {
            // Avoid duplicates if same gate in personality and design
            const alreadyAdded = gatesWithLines.some(g => g.gate === gateData.gate && g.line === (gateData.line || 1));
            if (!alreadyAdded) {
              gatesWithLines.push({ gate: gateData.gate, line: gateData.line || 1, planet, isDesign: true });
            }
          }
        }
      }
      
      // Sort by planet priority and limit to 8
      const priorityOrder = ['sun', 'moon', 'mercury', 'venus', 'mars', 'earth', 'jupiter', 'saturn'];
      gatesWithLines.sort((a, b) => {
        const idxA = priorityOrder.indexOf(a.planet.toLowerCase());
        const idxB = priorityOrder.indexOf(b.planet.toLowerCase());
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });
      
      // Generate Gene Key entries with line themes
      for (const { gate, line, planet, isDesign } of gatesWithLines.slice(0, 8)) {
        const key = geneKeys[gate];
        if (!key) continue;
        
        const lineTheme = LINE_THEMES[line];
        const sideLabel = isDesign ? 'Design (unconscious)' : 'Personality (conscious)';
        
        let entry = `**Gene Key ${gate}.${line} — ${key.name}** (${planet.toUpperCase()} ${sideLabel})\n`;
        entry += `  **Shadow:** ${key.shadow} — ${key.shadowDescription?.slice(0, 120) || ''}\n`;
        entry += `  **Gift:** ${key.gift} — ${key.giftDescription?.slice(0, 120) || ''}\n`;
        entry += `  **Siddhi:** ${key.siddhi}\n`;
        
        if (lineTheme) {
          entry += `  **Line ${line} Theme (${lineTheme.name}):** ${lineTheme.theme}. Your ${lineTheme.gift.toLowerCase()}.`;
        }
        
        if (key.contemplation) {
          entry += `\n  **Contemplation:** ${key.contemplation}`;
        }
        
        keyLines.push(entry);
      }
      
      if (keyLines.length) sections.push(`### GENE KEYS WISDOM (with Line Themes)\n\n${keyLines.join('\n\n')}`);
    }

    // Astrology: Major Planets in Signs
    const planets = loadKB('astro', 'planets.json');
    const signs = loadKB('astro', 'signs.json');
    const houses = loadKB('astro', 'houses.json');
    if (chartData.astrology?.placements) {
      const planetLines = [];
      const majorPlanets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'];
      
      for (const planetName of majorPlanets) {
        // BL-FIX: placements is an Object keyed by body name (lowercase), not an Array
        const planetKey = planetName.toLowerCase();
        const placement = chartData.astrology.placements[planetKey];
        if (placement) {
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

    // Vedic Astrology Overlay
    if (chartData.vedic && !chartData.vedic.error) {
      const v = chartData.vedic;
      const nakshatras = loadKB('vedic', 'nakshatras.json');
      const dashas     = loadKB('vedic', 'dashas.json');
      const vedSections = [];

      // Moon nakshatra depth
      if (v.moonNakshatra) {
        const nak = v.moonNakshatra;
        // Key in JSON uses name lowercased + spaces → underscores
        const nakKey = nak.name.toLowerCase().replace(/\s+/g, '_');
        const nakData = nakshatras[nakKey];
        if (nakData) {
          vedSections.push(
            `**Moon Nakshatra: ${nak.name}** (Pada ${nak.pada}, lord: ${nak.lord})\n` +
            `  ${nakData.meaning}\n` +
            `  **Shadow:** ${nakData.shadow}\n` +
            `  **Gift:** ${nakData.gift}\n` +
            `  **Prime Insight:** ${nakData.primeInsight}`
          );
        } else {
          vedSections.push(`**Moon Nakshatra: ${nak.name}** (Pada ${nak.pada}, lord: ${nak.lord})`);
        }
      }

      // Current Vimshottari Dasha
      if (v.dasha?.current) {
        const lord = v.dasha.current.lord;
        const dashaData = dashas[lord];
        if (dashaData) {
          vedSections.push(
            `**Current Dasha: ${lord.charAt(0).toUpperCase() + lord.slice(1)}** — ${v.dasha.current.yearsRemaining} yrs remaining\n` +
            `  Theme: ${dashaData.theme}\n` +
            `  **Shadow:** ${dashaData.shadow}\n` +
            `  **Gift:** ${dashaData.gift}\n` +
            `  **Practical Guidance:** ${dashaData.practicalGuidance}`
          );
        }
      }

      // Sidereal Sun sign (if meaningfully different from tropical)
      if (v.siderealPlacements?.sun) {
        const sidSun = v.siderealPlacements.sun;
        vedSections.push(`**Sidereal Sun: ${sidSun.sign}** (${sidSun.degreesInSign}°) — Vedic solar identity layer`);
      }

      if (vedSections.length) sections.push(`### VEDIC ASTROLOGY (JYOTISH) OVERLAY\n\n${vedSections.join('\n\n')}`);
    }

    // Celtic Ogham Birth Tree
    if (chartData.ogham && !chartData.ogham.error) {
      const og = chartData.ogham;
      const trees = loadKB('ogham', 'trees.json');
      if (og.treeKey && trees[og.treeKey]) {
        const tree = trees[og.treeKey];
        sections.push(
          `### CELTIC OGHAM BIRTH TREE: ${tree.name.toUpperCase()}\n\n` +
          `**${tree.name}** (${tree.letter}) — ${tree.period}\n` +
          `${tree.meaning}\n\n` +
          `**Qualities:** ${tree.qualities.join(', ')}\n\n` +
          `**Shadow:** ${tree.shadow}\n\n` +
          `**Gift:** ${tree.gift}\n\n` +
          `**Prime Insight:** ${tree.primeInsight}\n\n` +
          `**Prime Self Alignment:** ${tree.primeSelfAlignment}`
        );
      }
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
