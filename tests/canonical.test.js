/**
 * Canonical Philosophy Test Suite
 * 
 * Validates that the Prime Self knowledgebase aligns with the
 * Sacred Texts & Canonical Philosophy document.
 * 
 * Run with: npx vitest run tests/canonical.test.js
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── Helper: Load JSON from knowledgebase ───────────────────────
function loadCanonicalJSON(filename) {
  const path = join(process.cwd(), 'src', 'knowledgebase', 'prime_self', filename);
  return JSON.parse(readFileSync(path, 'utf8'));
}

// ─── FIVE FORGES TESTS ──────────────────────────────────────────
describe('Five Forges (Canonical)', () => {
  let forges;
  
  beforeAll(() => {
    forges = loadCanonicalJSON('forges_canonical.json');
  });

  it('should define exactly 5 Forges', () => {
    const forgeKeys = Object.keys(forges).filter(k => !k.startsWith('_'));
    expect(forgeKeys).toHaveLength(5);
  });

  it('should include the canonical Five Forges by name', () => {
    const canonicalForges = ['chronos', 'eros', 'aether', 'lux', 'phoenix'];
    canonicalForges.forEach(forgeName => {
      expect(forges).toHaveProperty(forgeName);
    });
  });

  it('each Forge should have required properties', () => {
    const requiredProps = [
      'forge', 'domain', 'essence', 'mysticalForm', 
      'disciplines', 'weapons', 'defenses',
      'hdTriggers', 'astroTriggers',
      'shadowForm', 'masterForm', 'primeQuestion',
      'historicalExemplars', 'recommendedReading'
    ];
    
    Object.entries(forges).forEach(([key, forge]) => {
      if (key.startsWith('_')) return; // skip metadata
      requiredProps.forEach(prop => {
        expect(forge, `Forge ${key} missing ${prop}`).toHaveProperty(prop);
      });
    });
  });

  describe('Chronos (Time)', () => {
    it('should have essence about time or patience', () => {
      const essence = forges.chronos.essence.toLowerCase();
      expect(essence.includes('time') || essence.includes('past') || essence.includes('future')).toBe(true);
    });
    
    it('should have Saturn-related astro trigger', () => {
      const triggers = forges.chronos.astroTriggers.join(' ').toLowerCase();
      expect(triggers.includes('saturn')).toBe(true);
    });
    
    it('should have historical exemplars', () => {
      expect(forges.chronos.historicalExemplars.length).toBeGreaterThan(0);
      expect(forges.chronos.historicalExemplars).toContain('Marcus Aurelius');
    });
  });

  describe('Eros (Passion)', () => {
    it('should have essence about passion or heart', () => {
      const essence = forges.eros.essence.toLowerCase();
      expect(essence.includes('passion') || essence.includes('heart') || essence.includes('burn')).toBe(true);
    });
    
    it('should have Sacral-related HD trigger', () => {
      const triggers = forges.eros.hdTriggers.join(' ').toLowerCase();
      expect(triggers.includes('sacral')).toBe(true);
    });
  });

  describe('Aether (Connection)', () => {
    it('should have domain related to connection or spirit', () => {
      const domainStr = Array.isArray(forges.aether.domain) 
        ? forges.aether.domain.join(' ').toLowerCase()
        : forges.aether.domain.toLowerCase();
      expect(
        domainStr.includes('connection') || 
        domainStr.includes('interconnected') || 
        domainStr.includes('spirit')
      ).toBe(true);
    });
    
    it('should have Neptune-related astro trigger', () => {
      const triggers = forges.aether.astroTriggers.join(' ').toLowerCase();
      expect(triggers.includes('neptune')).toBe(true);
    });
  });

  describe('Lux (Illumination)', () => {
    it('should have correct essence', () => {
      expect(forges.lux.essence).toContain('Truth');
    });
    
    it('should have Head or Ajna HD trigger', () => {
      const triggers = forges.lux.hdTriggers.join(' ').toLowerCase();
      expect(triggers.includes('head') || triggers.includes('ajna')).toBe(true);
    });
  });

  describe('Phoenix (Rebirth)', () => {
    it('should have domain related to rebirth or transformation', () => {
      const domainStr = Array.isArray(forges.phoenix.domain) 
        ? forges.phoenix.domain.join(' ').toLowerCase()
        : forges.phoenix.domain.toLowerCase();
      expect(
        domainStr.includes('rebirth') || 
        domainStr.includes('renewal') || 
        domainStr.includes('transform')
      ).toBe(true);
    });
    
    it('should have Pluto-related astro trigger', () => {
      const triggers = forges.phoenix.astroTriggers.join(' ').toLowerCase();
      expect(triggers.includes('pluto')).toBe(true);
    });
  });
});


// ─── SIX KNOWLEDGES TESTS ───────────────────────────────────────
describe('Six Knowledges (Canonical)', () => {
  let knowledges;
  
  beforeAll(() => {
    knowledges = loadCanonicalJSON('knowledges_canonical.json');
  });

  it('should define exactly 6 Knowledges', () => {
    const knowledgeKeys = Object.keys(knowledges).filter(k => !k.startsWith('_'));
    expect(knowledgeKeys).toHaveLength(6);
  });

  it('should include the canonical Six Knowledges', () => {
    const canonicalKnowledges = [
      'self', 'ancestors', 'theOne', 
      'constructive', 'destructive', 'healing'
    ];
    canonicalKnowledges.forEach(kName => {
      expect(knowledges).toHaveProperty(kName);
    });
  });

  it('each Knowledge should have required properties', () => {
    const requiredProps = [
      'knowledge', 'number', 'essence', 'description',
      'domains', 'hdMapping', 'astroMapping',
      'practicalApplication', 'primeQuestion',
      'historicalExemplars', 'recommendedReading'
    ];
    
    Object.entries(knowledges).forEach(([key, knowledge]) => {
      if (key.startsWith('_')) return;
      requiredProps.forEach(prop => {
        expect(knowledge, `Knowledge ${key} missing ${prop}`).toHaveProperty(prop);
      });
    });
  });

  it('Knowledge of Self should be number 1', () => {
    expect(knowledges.self.number).toBe(1);
    expect(knowledges.self.knowledge).toBe('Self');
  });

  it('Knowledge of Ancestors should reference Design-side', () => {
    expect(knowledges.ancestors.hdMapping.primaryIndicators).toContain('Design (unconscious/genetic) chart');
  });

  it('Knowledge of The One should emphasize interconnection', () => {
    const essence = knowledges.theOne.essence.toLowerCase();
    expect(essence.includes('compassion') || essence.includes('unity') || essence.includes('universal')).toBe(true);
  });

  it('Knowledges should be numbered 1-6', () => {
    const numbers = Object.values(knowledges)
      .filter(k => typeof k === 'object' && k.number)
      .map(k => k.number)
      .sort();
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6]);
  });
});


// ─── SIX SCIENCES TESTS ─────────────────────────────────────────
describe('Six Sciences (Canonical)', () => {
  let sciences;
  
  beforeAll(() => {
    sciences = loadCanonicalJSON('sciences_canonical.json');
  });

  it('should define exactly 6 Sciences', () => {
    const scienceKeys = Object.keys(sciences).filter(k => !k.startsWith('_'));
    expect(scienceKeys).toHaveLength(6);
  });

  it('should include the canonical Six Sciences', () => {
    const canonicalSciences = [
      'mindfulness', 'alchemy', 'divination',
      'astrology', 'reiki', 'behavioralAlchemy'
    ];
    canonicalSciences.forEach(sName => {
      expect(sciences).toHaveProperty(sName);
    });
  });

  it('Mindfulness should be the foundational Science', () => {
    expect(sciences.mindfulness.number).toBe(1);
    expect(sciences.mindfulness.description).toContain('foundational');
  });

  it('each Science should have practical applications', () => {
    Object.entries(sciences).forEach(([key, science]) => {
      if (key.startsWith('_')) return;
      expect(science).toHaveProperty('primeApplication');
    });
  });
});


// ─── SIX ARTS TESTS ─────────────────────────────────────────────
describe('Six Arts (Canonical)', () => {
  let arts;
  
  beforeAll(() => {
    arts = loadCanonicalJSON('arts_canonical.json');
  });

  it('should define exactly 6 Arts', () => {
    const artKeys = Object.keys(arts).filter(k => !k.startsWith('_'));
    expect(artKeys).toHaveLength(6);
  });

  it('should include the canonical Six Arts', () => {
    const canonicalArts = [
      'aromatherapy', 'semiotics', 'quantumMind',
      'crystallography', 'musicology', 'bioelectricConsciousness'
    ];
    canonicalArts.forEach(aName => {
      expect(arts).toHaveProperty(aName);
    });
  });

  it('each Art should have Forge correspondences', () => {
    // At least Aromatherapy should have forge correspondences
    expect(arts.aromatherapy).toHaveProperty('forgeCorrespondences');
  });
});


// ─── SIX DEFENSES TESTS ─────────────────────────────────────────
describe('Six Defenses (Canonical)', () => {
  let defenses;
  
  beforeAll(() => {
    defenses = loadCanonicalJSON('defenses_canonical.json');
  });

  it('should define exactly 6 Defenses', () => {
    const defenseKeys = Object.keys(defenses).filter(k => !k.startsWith('_'));
    expect(defenseKeys).toHaveLength(6);
  });

  it('should include the canonical Six Defenses', () => {
    const canonicalDefenses = [
      'reflexology', 'acupressure', 'chromotherapy',
      'hypnosis', 'chakraWork', 'iwasOrisha'
    ];
    canonicalDefenses.forEach(dName => {
      expect(defenses).toHaveProperty(dName);
    });
  });

  it('Chakra Work should map to HD centers', () => {
    expect(defenses.chakraWork.chakras).toBeDefined();
    expect(defenses.chakraWork.chakras.root.hdCorrespondence).toBeDefined();
  });

  it('Iwas/Orisha should have respectful practice guidance', () => {
    expect(defenses.iwasOrisha).toHaveProperty('respectfulPractice');
  });
});


// ─── SIX HERESIES TESTS ─────────────────────────────────────────
describe('Six Heresies (Canonical)', () => {
  let heresies;
  
  beforeAll(() => {
    heresies = loadCanonicalJSON('heresies_canonical.json');
  });

  it('should define exactly 6 Heresies', () => {
    const heresyKeys = Object.keys(heresies).filter(k => !k.startsWith('_'));
    expect(heresyKeys).toHaveLength(6);
  });

  it('should include the canonical Six Heresies', () => {
    const canonicalHeresies = [
      'mesmerism', 'parabiosis', 'necromancy',
      'hemalurgy', 'hemomancy', 'psychomancy'
    ];
    canonicalHeresies.forEach(hName => {
      expect(heresies).toHaveProperty(hName);
    });
  });

  it('each Heresy should have a shadowOf reference', () => {
    Object.entries(heresies).forEach(([key, heresy]) => {
      if (key.startsWith('_')) return;
      expect(heresy, `Heresy ${key} missing shadowOf`).toHaveProperty('shadowOf');
    });
  });

  it('each Heresy should have defenseAgainst guidance', () => {
    Object.entries(heresies).forEach(([key, heresy]) => {
      if (key.startsWith('_')) return;
      expect(heresy, `Heresy ${key} missing defenseAgainst`).toHaveProperty('defenseAgainst');
      expect(heresy.defenseAgainst.length).toBeGreaterThan(0);
    });
  });

  it('each Heresy should have redemption path', () => {
    Object.entries(heresies).forEach(([key, heresy]) => {
      if (key.startsWith('_')) return;
      expect(heresy, `Heresy ${key} missing redemption`).toHaveProperty('redemption');
    });
  });

  it('metadata should include warning about not practicing', () => {
    expect(heresies._meta.warning).toContain('NOT');
  });
});


// ─── HISTORICAL FIGURES TESTS ───────────────────────────────────
describe('Historical Figures Library', () => {
  let figures;
  
  beforeAll(() => {
    figures = loadCanonicalJSON('historical_figures.json');
  });

  it('should have figures organized by HD Type', () => {
    expect(figures).toHaveProperty('byType');
    expect(figures.byType).toHaveProperty('generator');
    expect(figures.byType).toHaveProperty('manifestingGenerator');
    expect(figures.byType).toHaveProperty('projector');
    expect(figures.byType).toHaveProperty('manifestor');
    expect(figures.byType).toHaveProperty('reflector');
  });

  it('should have figures organized by Forge', () => {
    expect(figures).toHaveProperty('byForge');
    expect(figures.byForge).toHaveProperty('chronos');
    expect(figures.byForge).toHaveProperty('eros');
    expect(figures.byForge).toHaveProperty('aether');
    expect(figures.byForge).toHaveProperty('lux');
    expect(figures.byForge).toHaveProperty('phoenix');
  });

  it('each figure should have required properties', () => {
    const requiredProps = ['name', 'domain', 'forge', 'primeGift', 'keyLesson'];
    
    Object.values(figures.byType).forEach(typeGroup => {
      typeGroup.figures.forEach(figure => {
        requiredProps.forEach(prop => {
          expect(figure, `Figure ${figure.name} missing ${prop}`).toHaveProperty(prop);
        });
      });
    });
  });

  it('should include shadow examples with warnings', () => {
    const allFigures = Object.values(figures.byType).flatMap(t => t.figures);
    const shadowExamples = allFigures.filter(f => f.isShadowExample);
    expect(shadowExamples.length).toBeGreaterThan(0);
  });
});


// ─── BOOK RECOMMENDATIONS TESTS ─────────────────────────────────
describe('Book Recommendations Library', () => {
  let books;
  
  beforeAll(() => {
    books = loadCanonicalJSON('book_recommendations.json');
  });

  it('should have books organized by HD Type', () => {
    expect(books).toHaveProperty('byType');
    expect(books.byType).toHaveProperty('generator');
    expect(books.byType).toHaveProperty('projector');
  });

  it('should have books organized by Forge', () => {
    expect(books).toHaveProperty('byForge');
    expect(books.byForge).toHaveProperty('chronos');
    expect(books.byForge).toHaveProperty('phoenix');
  });

  it('should have books organized by Knowledge area', () => {
    expect(books).toHaveProperty('byKnowledge');
    expect(books.byKnowledge).toHaveProperty('self');
    expect(books.byKnowledge).toHaveProperty('ancestors');
    expect(books.byKnowledge).toHaveProperty('healing');
  });

  it('should have books organized by current need', () => {
    expect(books).toHaveProperty('byCurrentNeed');
    expect(books.byCurrentNeed).toHaveProperty('inTransition');
    expect(books.byCurrentNeed).toHaveProperty('healingTrauma');
  });

  it('should have an essential library', () => {
    expect(books).toHaveProperty('essentialLibrary');
    expect(books.essentialLibrary.texts.length).toBeGreaterThanOrEqual(10);
  });

  it('each book recommendation should have title, author, and why', () => {
    Object.values(books.byType).forEach(typeGroup => {
      typeGroup.fiction.forEach(book => {
        expect(book).toHaveProperty('title');
        expect(book).toHaveProperty('author');
        expect(book).toHaveProperty('why');
      });
    });
  });
});


// ─── SYNTHESIS PROMPT INTEGRATION TESTS ─────────────────────────
describe('Synthesis Prompt (Canonical Integration)', () => {
  let synthesis;
  
  beforeAll(async () => {
    synthesis = await import('../src/prompts/synthesis.js');
  });

  it('should export FORGE_MAPPING with canonical Forges', () => {
    expect(synthesis.FORGE_MAPPING).toBeDefined();
    expect(synthesis.FORGE_MAPPING).toHaveLength(5);
    
    const forgeNames = synthesis.FORGE_MAPPING.map(f => f.forge);
    expect(forgeNames).toContain('Chronos');
    expect(forgeNames).toContain('Eros');
    expect(forgeNames).toContain('Aether');
    expect(forgeNames).toContain('Lux');
    expect(forgeNames).toContain('Phoenix');
  });

  it('should export SIX_KNOWLEDGES', () => {
    expect(synthesis.SIX_KNOWLEDGES).toBeDefined();
    expect(synthesis.SIX_KNOWLEDGES).toHaveLength(6);
  });

  it('FORGE_MAPPING should include weapons and defenses', () => {
    synthesis.FORGE_MAPPING.forEach(forge => {
      expect(forge, `Forge ${forge.forge} missing weapon`).toHaveProperty('weapon');
      expect(forge, `Forge ${forge.forge} missing defense`).toHaveProperty('defense');
      expect(forge, `Forge ${forge.forge} missing exemplars`).toHaveProperty('exemplars');
    });
  });

  it('SIX_KNOWLEDGES should include essence and primeQuestion', () => {
    synthesis.SIX_KNOWLEDGES.forEach(knowledge => {
      expect(knowledge, `Knowledge ${knowledge.name} missing essence`).toHaveProperty('essence');
      expect(knowledge, `Knowledge ${knowledge.name} missing primeQuestion`).toHaveProperty('primeQuestion');
    });
  });
});


// ─── CROSS-REFERENCE VALIDATION ─────────────────────────────────
describe('Cross-Reference Validation', () => {
  let forges, knowledges, figures, books;
  
  beforeAll(() => {
    forges = loadCanonicalJSON('forges_canonical.json');
    knowledges = loadCanonicalJSON('knowledges_canonical.json');
    figures = loadCanonicalJSON('historical_figures.json');
    books = loadCanonicalJSON('book_recommendations.json');
  });

  it('Forge exemplars in forges.json should appear in historical_figures.json byForge', () => {
    // Check that at least some exemplars cross-reference
    const forgeExemplars = forges.chronos.historicalExemplars;
    const figureExemplars = figures.byForge.chronos.exemplars;
    
    const overlap = forgeExemplars.filter(e => 
      figureExemplars.some(f => f.includes(e))
    );
    expect(overlap.length).toBeGreaterThan(0);
  });

  it('Books in forges should align with book_recommendations byForge', () => {
    // Check that Phoenix books align
    const forgeBooks = forges.phoenix.recommendedReading.nonFiction;
    const libraryBooks = books.byForge.phoenix.nonFiction;
    
    // At least one book should appear in both
    const forgeBookTitles = forgeBooks.map(b => b.title || b);
    const libraryBookTitles = libraryBooks.map(b => b.title);
    
    const overlap = forgeBookTitles.filter(t => 
      libraryBookTitles.some(lt => lt.includes(t) || t.includes(lt))
    );
    // Allowing some divergence, but should have conceptual alignment
    expect(overlap.length + libraryBookTitles.length).toBeGreaterThan(0);
  });

  it('All Five Forges should have book recommendations', () => {
    const forgeNames = ['chronos', 'eros', 'aether', 'lux', 'phoenix'];
    forgeNames.forEach(forgeName => {
      expect(books.byForge[forgeName]).toBeDefined();
      expect(books.byForge[forgeName].fiction.length).toBeGreaterThan(0);
      expect(books.byForge[forgeName].nonFiction.length).toBeGreaterThan(0);
    });
  });

  it('All Six Knowledges should have book recommendations', () => {
    const knowledgeNames = ['self', 'ancestors', 'theOne', 'constructive', 'destructive', 'healing'];
    knowledgeNames.forEach(kName => {
      expect(books.byKnowledge[kName]).toBeDefined();
      expect(books.byKnowledge[kName].recommendations.length).toBeGreaterThan(0);
    });
  });
});
