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

// Energy Blueprint knowledgebase
import typesData from '../../src/knowledgebase/hd/types.json';
import profilesData from '../../src/knowledgebase/hd/profiles.json';
import gatesData from '../../src/knowledgebase/hd/gates.json';
import channelsData from '../../src/knowledgebase/hd/channels.json';
import centersData from '../../src/knowledgebase/hd/centers.json';
import authorityData from '../../src/knowledgebase/hd/authority.json';
import definitionData from '../../src/knowledgebase/hd/definition.json';
import crossesKBData from '../../src/knowledgebase/hd/crosses.json';

// Frequency Keys knowledgebase
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

// Vedic (Jyotish) knowledgebase
import nakshatrasData from '../../src/knowledgebase/vedic/nakshatras.json';
import dashasData from '../../src/knowledgebase/vedic/dashas.json';

// Celtic Ogham knowledgebase
import oghamTreesData from '../../src/knowledgebase/ogham/trees.json';

// Mayan Tzolkin (Dreamspell) knowledgebase
import mayanSealsData from '../../src/knowledgebase/mayan/seals.json';

// BaZi (Four Pillars) knowledgebase
import baziStemsData from '../../src/knowledgebase/bazi/stems.json';
import baziBranchesData from '../../src/knowledgebase/bazi/branches.json';

// Sabian Symbols knowledgebase
import sabianSymbolsData from '../../src/knowledgebase/sabian/symbols.json';

// Chiron & Black Moon Lilith knowledgebases
import chironKBData from '../../src/knowledgebase/astro/chiron.json';
import lilithKBData from '../../src/knowledgebase/astro/lilith.json';

// Prime Self knowledgebase
import forgesData from '../../src/knowledgebase/prime_self/forges.json';
import knowledgesData from '../../src/knowledgebase/prime_self/knowledges.json';
import forgeMappingData from '../../src/knowledgebase/prime_self/forge_mapping.json';

// Prime Self canonical data (Sprint 19.1 — RAG context expansion)
import historicalFiguresData from '../../src/knowledgebase/prime_self/historical_figures.json';
import bookRecommendationsData from '../../src/knowledgebase/prime_self/book_recommendations.json';
import forgesCanonicalData from '../../src/knowledgebase/prime_self/forges_canonical.json';
import knowledgesCanonicalData from '../../src/knowledgebase/prime_self/knowledges_canonical.json';
import artsCanonicalData from '../../src/knowledgebase/prime_self/arts_canonical.json';
import sciencesCanonicalData from '../../src/knowledgebase/prime_self/sciences_canonical.json';
import defensesCanonicalData from '../../src/knowledgebase/prime_self/defenses_canonical.json';
import heresiesCanonicalData from '../../src/knowledgebase/prime_self/heresies_canonical.json';

// Library knowledgebase (Sprint 19.2 — structural philosophy integration)
import chartBridgeData from '../../src/knowledgebase/library/chart_bridge.json';
import vocabularyData from '../../src/knowledgebase/library/vocabulary.json';
import derivationChainData from '../../src/knowledgebase/library/derivation_chain.json';

globalThis.__PRIME_DATA = {
  crosses: crossesData,
  kb: {
    // Energy Blueprint
    'hd/types.json': typesData,
    'hd/profiles.json': profilesData,
    'hd/gates.json': gatesData,
    'hd/channels.json': channelsData,
    'hd/centers.json': centersData,
    'hd/authority.json': authorityData,
    'hd/definition.json': definitionData,
    'hd/crosses.json': crossesKBData,
    
    // Frequency Keys
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
    
    // Vedic (Jyotish)
    'vedic/nakshatras.json': nakshatrasData,
    'vedic/dashas.json': dashasData,
    
    // Celtic Ogham
    'ogham/trees.json': oghamTreesData,

    // Mayan Tzolkin (Dreamspell)
    'mayan/seals.json': mayanSealsData,

    // BaZi (Four Pillars)
    'bazi/stems.json': baziStemsData,
    'bazi/branches.json': baziBranchesData,

    // Sabian Symbols
    'sabian/symbols.json': sabianSymbolsData,

    // Chiron & Black Moon Lilith
    'astro/chiron.json': chironKBData,
    'astro/lilith.json': lilithKBData,
    
    // Prime Self
    'prime_self/forges.json': forgesData,
    'prime_self/knowledges.json': knowledgesData,
    'prime_self/forge_mapping.json': forgeMappingData,
    
    // Prime Self canonical data (Sprint 19.1 — enables RAG for priming recommendations, forge weapons/defenses)
    'prime_self/historical_figures.json': historicalFiguresData,
    'prime_self/book_recommendations.json': bookRecommendationsData,
    'prime_self/forges_canonical.json': forgesCanonicalData,
    'prime_self/knowledges_canonical.json': knowledgesCanonicalData,
    'prime_self/arts_canonical.json': artsCanonicalData,
    'prime_self/sciences_canonical.json': sciencesCanonicalData,
    'prime_self/defenses_canonical.json': defensesCanonicalData,
    'prime_self/heresies_canonical.json': heresiesCanonicalData,

    // Library
    'library/chart_bridge.json': chartBridgeData,
    'library/vocabulary.json': vocabularyData,
    'library/derivation_chain.json': derivationChainData
  }
};
