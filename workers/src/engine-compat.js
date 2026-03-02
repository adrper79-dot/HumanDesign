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
import crossesData from '../../src/data/crosses.json';
import typesData from '../../src/knowledgebase/hd/types.json';
import profilesData from '../../src/knowledgebase/hd/profiles.json';
import gatesData from '../../src/knowledgebase/hd/gates.json';
import channelsData from '../../src/knowledgebase/hd/channels.json';
import forgesData from '../../src/knowledgebase/prime_self/forges.json';
import knowledgesData from '../../src/knowledgebase/prime_self/knowledges.json';
import forgeMappingData from '../../src/knowledgebase/prime_self/forge_mapping.json';

globalThis.__PRIME_DATA = {
  crosses: crossesData,
  kb: {
    'hd/types.json': typesData,
    'hd/profiles.json': profilesData,
    'hd/gates.json': gatesData,
    'hd/channels.json': channelsData,
    'prime_self/forges.json': forgesData,
    'prime_self/knowledges.json': knowledgesData,
    'prime_self/forge_mapping.json': forgeMappingData
  }
};
