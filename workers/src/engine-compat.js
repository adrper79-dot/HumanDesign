/**
 * Engine Compatibility Layer — Workers Data Injection
 *
 * Cloudflare Workers don't have filesystem access, so readFileSync
 * calls in chart.js and synthesis.js would fail silently.
 *
 * This module imports all required JSON data statically (esbuild inlines
 * them at bundle time), then injects them into globalThis.__PRIME_DATA
 * so chart.js and synthesis.js can read from there instead of the filesystem.
 *
 * MUST be imported before any engine or prompt modules.
 */

// Static JSON imports — esbuild inlines these at bundle time

// Core chart data
import crossesData from '../../src/data/crosses.json';

// Human Design knowledgebase
import typesData from '../../src/knowledgebase/hd/types.json';
import profilesData from '../../src/knowledgebase/hd/profiles.json';
import gatesData from '../../src/knowledgebase/hd/gates.json';
import channelsData from '../../src/knowledgebase/hd/channels.json';
import centersData from '../../src/knowledgebase/hd/centers.json';
import authorityData from '../../src/knowledgebase/hd/authority.json';
import definitionData from '../../src/knowledgebase/hd/definition.json';
import crossesKBData from '../../src/knowledgebase/hd/crosses.json';

// Gene Keys knowledgebase
import geneKeysData from '../../src/knowledgebase/genekeys/keys.json';

// Astrology knowledgebase
import planetsData from '../../src/knowledgebase/astro/planets.json';
import signsData from '../../src/knowledgebase/astro/signs.json';
import housesData from '../../src/knowledgebase/astro/houses.json';
import aspectsData from '../../src/knowledgebase/astro/aspects.json';

// Numerology knowledgebase
import lifePathsData from '../../src/knowledgebase/numerology/lifePaths.json';
import personalYearsData from '../../src/knowledgebase/numerology/personalYears.json';
import tarotCardsData from '../../src/knowledgebase/numerology/tarotCards.json';

// Prime Self knowledgebase
import forgesData from '../../src/knowledgebase/prime_self/forges.json';
import knowledgesData from '../../src/knowledgebase/prime_self/knowledges.json';
import forgeMappingData from '../../src/knowledgebase/prime_self/forge_mapping.json';

globalThis.__PRIME_DATA = {
  crosses: crossesData,
  kb: {
    // Human Design
    'hd/types.json': typesData,
    'hd/profiles.json': profilesData,
    'hd/gates.json': gatesData,
    'hd/channels.json': channelsData,
    'hd/centers.json': centersData,
    'hd/authority.json': authorityData,
    'hd/definition.json': definitionData,
    'hd/crosses.json': crossesKBData,
    
    // Gene Keys
    'genekeys/keys.json': geneKeysData,
    
    // Astrology
    'astro/planets.json': planetsData,
    'astro/signs.json': signsData,
    'astro/houses.json': housesData,
    'astro/aspects.json': aspectsData,
    
    // Numerology
    'numerology/lifePaths.json': lifePathsData,
    'numerology/personalYears.json': personalYearsData,
    'numerology/tarotCards.json': tarotCardsData,
    
    // Prime Self
    'prime_self/forges.json': forgesData,
    'prime_self/knowledges.json': knowledgesData,
    'prime_self/forge_mapping.json': forgeMappingData
  }
};
