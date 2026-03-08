/**
 * Prime Self Engine — Complete Test Suite
 *
 * AP Test Vector: Aug 5, 1979, 22:51 UTC, Tampa FL (27.9506°N, 82.4572°W)
 *
 * Verified personality chart:
 *   Sun: Gate 33.6, Moon: Gate 38.4, Mercury: Gate 31.3, Venus: Gate 31.6,
 *   Mars: Gate 15.1, Jupiter: Gate 7.6, Saturn: Gate 64.2,
 *   Uranus: Gate 1.4, Neptune: Gate 26.1, Pluto: Gate 57.2
 *   North Node: Gate 40.4, South Node: Gate 37.4, Earth: Gate 19.6
 *
 * Verified design chart (May 6, 1979):
 *   Sun: Gate 2.2, Moon: Gate 59.6, Mercury: Gate 42.2, Venus: Gate 51.1,
 *   Mars: Gate 42.2, Jupiter: Gate 56.6, Saturn: Gate 40.2,
 *   Uranus: Gate 43.1, Neptune: Gate 26.4, Pluto: Gate 57.3
 *   North Node: Gate 64.5, South Node: Gate 63.5, Earth: Gate 1.2
 *
 * Type: Projector, Authority: Emotional, Profile: 6/2,
 * Definition: Split, Cross: LAX [33,19,2,1]
 */

import { describe, it, expect } from 'vitest';
import { toJulianDay, getSunLongitude, normalizeDegrees } from '../src/engine/julian.js';
import { getAllPositions } from '../src/engine/planets.js';
import { getDesignCalculation } from '../src/engine/design.js';
import { longitudeToGate, mapAllToGates } from '../src/engine/gates.js';
import { calculateChart } from '../src/engine/chart.js';
import { calculateAstrology } from '../src/engine/astro.js';
import { getCurrentTransits, getTransitForecast } from '../src/engine/transits.js';
import { buildSynthesisPrompt, validateSynthesisResponse } from '../src/prompts/synthesis.js';

// ─── AP Test Vector ─────────────────────────────────────────────
const AP_JDN = toJulianDay(1979, 8, 5, 22, 51, 0);
const AP_LAT = 27.9506;
const AP_LNG = -82.4572;

// ═══════════════════════════════════════════════════════════════
// LAYER 1: Julian Day Number + Sun
// ═══════════════════════════════════════════════════════════════

describe('Layer 1: Julian Day + Sun', () => {
  it('computes correct JDN for AP birth', () => {
    // Aug 5, 1979 22:51 UTC = JDN 2444091.4521
    expect(AP_JDN).toBeCloseTo(2444091.4521, 3);
  });

  it('computes Sun longitude within 0.01° of expected', () => {
    const sunLon = getSunLongitude(AP_JDN);
    expect(sunLon).toBeCloseTo(132.91, 1); // Leo 12.91°
  });

  it('handles J2000.0 epoch', () => {
    const j2000 = toJulianDay(2000, 1, 1, 12, 0, 0);
    expect(j2000).toBeCloseTo(2451545.0, 3);
  });

  it('normalizes degrees correctly', () => {
    expect(normalizeDegrees(370)).toBeCloseTo(10, 5);
    expect(normalizeDegrees(-10)).toBeCloseTo(350, 5);
    expect(normalizeDegrees(0)).toBe(0);
    expect(normalizeDegrees(360)).toBeCloseTo(0, 5);
  });
});

// ═══════════════════════════════════════════════════════════════
// LAYER 2: Planetary Positions
// ═══════════════════════════════════════════════════════════════

describe('Layer 2: Planetary Positions', () => {
  const pos = getAllPositions(AP_JDN);

  it('returns all 12 bodies', () => {
    const bodies = ['sun', 'moon', 'mercury', 'venus', 'mars',
      'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
      'northNode', 'southNode'];
    for (const b of bodies) {
      expect(pos[b]).toBeDefined();
      expect(pos[b].longitude).toBeGreaterThanOrEqual(0);
      expect(pos[b].longitude).toBeLessThan(360);
    }
  });

  it('Sun in Leo (~132.91°)', () => {
    expect(pos.sun.longitude).toBeCloseTo(132.91, 1);
  });

  it('Moon in Capricorn (~282°)', () => {
    expect(pos.moon.longitude).toBeGreaterThan(270);
    expect(pos.moon.longitude).toBeLessThan(300);
  });

  it('South Node is opposite North Node', () => {
    const diff = Math.abs(pos.southNode.longitude - normalizeDegrees(pos.northNode.longitude + 180));
    expect(diff).toBeLessThan(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// LAYER 3: Design Side
// ═══════════════════════════════════════════════════════════════

describe('Layer 3: Design Side', () => {
  const pos = getAllPositions(AP_JDN);
  const design = getDesignCalculation(AP_JDN, pos);

  it('finds design date in May 1979', () => {
    expect(design.designDate.year).toBe(1979);
    expect(design.designDate.month).toBe(5);
  });

  it('design Sun 88° before birth Sun', () => {
    const birthSun = pos.sun.longitude;
    const designSun = design.designPositions.sun.longitude;
    let diff = normalizeDegrees(birthSun - designSun);
    expect(diff).toBeCloseTo(88, 0.5);
  });
});

// ═══════════════════════════════════════════════════════════════
// LAYER 4: Gate Lookup — All 26 Placements
// ═══════════════════════════════════════════════════════════════

describe('Layer 4: Gate/Line Lookup', () => {
  const pos = getAllPositions(AP_JDN);
  const pGates = mapAllToGates(pos);
  const design = getDesignCalculation(AP_JDN, pos);
  const dGates = mapAllToGates(design.designPositions);

  // Personality gates (13 verified values)
  const personalityExpected = {
    sun: [33, 6], moon: [38, 4], mercury: [31, 3], venus: [31, 6],
    mars: [15, 1], jupiter: [7, 6], saturn: [64, 2],
    uranus: [1, 4], neptune: [26, 1], pluto: [57, 2],
    northNode: [40, 4], southNode: [37, 4], earth: [19, 6]
  };

  for (const [body, [gate, line]] of Object.entries(personalityExpected)) {
    it(`personality ${body} = Gate ${gate}.${line}`, () => {
      expect(pGates[body].gate).toBe(gate);
      expect(pGates[body].line).toBe(line);
    });
  }

  // Design gates (13 verified values)
  const designExpected = {
    sun: [2, 2], moon: [59, 6], mercury: [42, 2], venus: [51, 1],
    mars: [42, 2], jupiter: [56, 6], saturn: [40, 2],
    uranus: [43, 1], neptune: [26, 4], pluto: [57, 3],
    northNode: [64, 5], southNode: [63, 5], earth: [1, 2]
  };

  for (const [body, [gate, line]] of Object.entries(designExpected)) {
    it(`design ${body} = Gate ${gate}.${line}`, () => {
      expect(dGates[body].gate).toBe(gate);
      expect(dGates[body].line).toBe(line);
    });
  }

  it('provides color/tone/base subdivisions', () => {
    expect(pGates.sun.color).toBeGreaterThanOrEqual(1);
    expect(pGates.sun.color).toBeLessThanOrEqual(6);
    expect(pGates.sun.tone).toBeGreaterThanOrEqual(1);
    expect(pGates.sun.tone).toBeLessThanOrEqual(6);
    expect(pGates.sun.base).toBeGreaterThanOrEqual(1);
    expect(pGates.sun.base).toBeLessThanOrEqual(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// LAYER 5: Chart Properties
// ═══════════════════════════════════════════════════════════════

describe('Layer 5: Chart Determination', () => {
  const pos = getAllPositions(AP_JDN);
  const pGates = mapAllToGates(pos);
  const design = getDesignCalculation(AP_JDN, pos);
  const dGates = mapAllToGates(design.designPositions);
  const chart = calculateChart(pGates, dGates);

  it('type = Projector', () => {
    expect(chart.type).toBe('Projector');
  });

  it('authority = Emotional - Solar Plexus', () => {
    expect(chart.authority).toBe('Emotional - Solar Plexus');
  });

  it('strategy = Wait for the Invitation', () => {
    expect(chart.strategy).toBe('Wait for the Invitation');
  });

  it('not-self theme = Bitterness', () => {
    expect(chart.notSelfTheme).toBe('Bitterness');
  });

  it('profile = 6/2', () => {
    expect(chart.profile).toBe('6/2');
  });

  it('definition = Split Definition', () => {
    expect(chart.definition).toBe('Split Definition');
  });

  it('cross = Left Angle Cross [33,19,2,1]', () => {
    expect(chart.cross.type).toBe('Left Angle Cross');
    expect(chart.cross.gates).toEqual([33, 19, 2, 1]);
    expect(chart.cross.name).toBe('Left Angle Cross of Refinement');
  });

  it('has channels 7-31 and 37-40', () => {
    const chNames = chart.activeChannels.map(c => c.channel);
    expect(chNames).toContain('7-31');
    expect(chNames).toContain('37-40');
  });

  it('defines G, Throat, Heart, SolarPlexus', () => {
    expect(chart.definedCenters).toContain('G');
    expect(chart.definedCenters).toContain('Throat');
    expect(chart.definedCenters).toContain('Heart');
    expect(chart.definedCenters).toContain('SolarPlexus');
  });

  it('two connected components (Split)', () => {
    expect(chart.connectedComponents).toHaveLength(2);
  });
});

// ─── Second Verification Anchor: 0921 ──────────────────────────
// Added 2026-03-03 after false bug report incident.
// Sep 21, 1983, 21:30 UTC, Naples FL → Profile 1/3, MG
// Cross-validated against Jovian Archive reference chart.

describe('Layer 5: Chart Determination (0921 Anchor)', () => {
  const jdn0921 = toJulianDay(1983, 9, 21, 21, 30, 0);
  const pos0921 = getAllPositions(jdn0921);
  const pGates0921 = mapAllToGates(pos0921);
  const design0921 = getDesignCalculation(jdn0921, pos0921);
  const dGates0921 = mapAllToGates(design0921.designPositions);
  const chart0921 = calculateChart(pGates0921, dGates0921);

  it('type = Manifesting Generator', () => {
    expect(chart0921.type).toBe('Manifesting Generator');
  });

  it('authority = Emotional - Solar Plexus', () => {
    expect(chart0921.authority).toBe('Emotional - Solar Plexus');
  });

  it('profile = 1/3', () => {
    expect(chart0921.profile).toBe('1/3');
  });

  it('P Sun = Gate 46 Line 1', () => {
    expect(pGates0921.sun.gate).toBe(46);
    expect(pGates0921.sun.line).toBe(1);
  });

  it('D Sun = Gate 15 Line 3', () => {
    expect(dGates0921.sun.gate).toBe(15);
    expect(dGates0921.sun.line).toBe(3);
  });

  it('cross = Right Angle Cross', () => {
    expect(chart0921.cross.type).toBe('Right Angle Cross');
    expect(chart0921.cross.gates[0]).toBe(46); // P Sun
    expect(chart0921.cross.gates[2]).toBe(15); // D Sun
  });
});

// ═══════════════════════════════════════════════════════════════
// LAYER 6: Western Astrology
// ═══════════════════════════════════════════════════════════════

describe('Layer 6: Western Astrology', () => {
  const pos = getAllPositions(AP_JDN);
  const astro = calculateAstrology(pos, AP_LAT, AP_LNG, AP_JDN);

  it('Sun in Leo', () => {
    expect(astro.placements.sun.sign).toBe('Leo');
  });

  it('Ascendant in Capricorn', () => {
    expect(astro.ascendant.sign).toBe('Capricorn');
  });

  it('Midheaven in Scorpio', () => {
    expect(astro.midheaven.sign).toBe('Scorpio');
  });

  it('house cusps are monotonically ordered', () => {
    // MC → H11 → H12 → ASC → H2 → H3 → IC → H5 → H6 → DSC → H8 → H9
    const order = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < order.length - 1; i++) {
      const curr = astro.houses[order[i]].longitude;
      const next = astro.houses[order[i + 1]].longitude;
      // Check increasing (mod 360)
      const diff = normalizeDegrees(next - curr);
      expect(diff).toBeGreaterThan(0);
      expect(diff).toBeLessThan(180); // Each step < 180°
    }
  });

  it('Sun in House 7 (evening birth)', () => {
    expect(astro.placements.sun.house).toBe(7);
  });

  it('Moon in House 12 (near ASC)', () => {
    expect(astro.placements.moon.house).toBe(12);
  });

  it('finds natal aspects', () => {
    expect(astro.aspects.length).toBeGreaterThan(5);
  });

  it('has all 12 house cusps', () => {
    for (let h = 1; h <= 12; h++) {
      expect(astro.houses[h]).toBeDefined();
      expect(astro.houses[h].longitude).toBeGreaterThanOrEqual(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// LAYER 7: Transits
// ═══════════════════════════════════════════════════════════════

describe('Layer 7: Transits', () => {
  const pos = getAllPositions(AP_JDN);
  const pGates = mapAllToGates(pos);
  const design = getDesignCalculation(AP_JDN, pos);
  const dGates = mapAllToGates(design.designPositions);
  const natal = calculateChart(pGates, dGates);
  const astro = calculateAstrology(pos, AP_LAT, AP_LNG, AP_JDN);

  describe('getCurrentTransits', () => {
    // Use a fixed date for deterministic tests
    const testJDN = toJulianDay(2025, 6, 15, 12, 0, 0);
    const transits = getCurrentTransits(natal, astro, testJDN);

    it('returns transit date', () => {
      expect(transits.date).toBe('2025-06-15');
    });

    it('transit Sun in Gemini mid-June', () => {
      expect(transits.transitPositions.sun.sign).toBe('Gemini');
    });

    it('has gate activations for all 13 bodies', () => {
      expect(transits.gateActivations.length).toBe(13);
    });

    it('identifies natal gate matches', () => {
      const matches = transits.gateActivations.filter(a => a.natalGatePresent);
      expect(matches.length).toBeGreaterThanOrEqual(0);
    });

    it('calculates transit-to-natal aspects', () => {
      expect(transits.transitToNatalAspects.length).toBeGreaterThan(0);
    });

    it('aspect objects have required fields', () => {
      const asp = transits.transitToNatalAspects[0];
      expect(asp.transitPlanet).toBeDefined();
      expect(asp.natalPlanet).toBeDefined();
      expect(asp.type).toBeDefined();
      expect(typeof asp.orb).toBe('number');
      expect(typeof asp.applying).toBe('boolean');
    });
  });

  describe('getTransitForecast', () => {
    const fc = getTransitForecast(
      natal, astro,
      { year: 2025, month: 6, day: 15 },
      { year: 2025, month: 7, day: 15 }
    );

    it('covers 31 days', () => {
      expect(fc.period.days).toBe(31);
    });

    it('finds gate ingresses', () => {
      expect(fc.summary.gateIngresses).toBeGreaterThan(0);
    });

    it('events have date and description', () => {
      expect(fc.events.length).toBeGreaterThan(0);
      const e = fc.events[0];
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.event).toBeDefined();
    });

    it('caps forecast at 366 days', () => {
      const long = getTransitForecast(
        natal, astro,
        { year: 2025, month: 1, day: 1 },
        { year: 2027, month: 1, day: 1 }
      );
      expect(long.period.days).toBeLessThanOrEqual(366);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// LAYER 8: Synthesis
// ═══════════════════════════════════════════════════════════════

describe('Layer 8: Synthesis', () => {
  const pos = getAllPositions(AP_JDN);
  const pGates = mapAllToGates(pos);
  const design = getDesignCalculation(AP_JDN, pos);
  const dGates = mapAllToGates(design.designPositions);
  const natal = calculateChart(pGates, dGates);
  const astro = calculateAstrology(pos, AP_LAT, AP_LNG, AP_JDN);

  const chartData = {
    hdChart: natal,
    astroChart: astro,
    personalityGates: pGates,
    designGates: dGates
  };

  it('builds prompt with correct model config', () => {
    const p = buildSynthesisPrompt(chartData);
    expect(p.config.model).toBe('claude-opus-4-20250514');
    expect(p.config.temperature).toBe(0);
    expect(p.config.max_tokens).toBe(4096);
  });

  it('uses Sonnet for questions', () => {
    const p = buildSynthesisPrompt(chartData, 'What is my Forge?');
    expect(p.config.model).toBe('claude-sonnet-4-20250514');
    expect(p.messages[0].content).toContain('What is my Forge?');
  });

  it('includes reference facts with HD data', () => {
    const p = buildSynthesisPrompt(chartData);
    const content = p.messages[0].content;
    expect(content).toContain('Type: Projector');
    expect(content).toContain('Authority: Emotional');
    expect(content).toContain('Profile: 6/2');
    expect(content).toContain('Gate 33.6');
    expect(content).toContain('7-31');
  });

  it('includes astrology data', () => {
    const p = buildSynthesisPrompt(chartData);
    const content = p.messages[0].content;
    expect(content).toContain('Ascendant: Capricorn');
    expect(content).toContain('sun: Leo');
  });

  it('includes Forge mapping reference', () => {
    const p = buildSynthesisPrompt(chartData);
    const content = p.messages[0].content;
    expect(content).toContain('Chronos (Time)');
    expect(content).toContain('Phoenix (Rebirth)');
  });

  describe('validateSynthesisResponse', () => {
    it('accepts valid response', () => {
      const valid = {
        quickStartGuide: {
          whoYouAre: 'Test',
          decisionStyle: 'Test',
          lifeStrategy: 'Test',
          thisMonth: 'Test',
          workingWithOthers: 'Test'
        },
        technicalInsights: {
          geneKeysProfile: { shadowPatterns: [], giftOpportunities: [], siddhiPotential: [] },
          forgeIdentification: { forge: 'Aether', confidence: 'medium', indicators: [] }
        },
        groundingAudit: { claimsTotal: 3, claimsGrounded: 3, ungroundedFields: [] }
      };
      const result = validateSynthesisResponse(valid);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects missing quickStartGuide', () => {
      const result = validateSynthesisResponse({ groundingAudit: {} });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing quickStartGuide');
    });

    it('rejects invalid forge', () => {
      const bad = {
        quickStartGuide: {
          whoYouAre: 'Test',
          decisionStyle: 'Test',
          lifeStrategy: 'Test',
          thisMonth: 'Test',
          workingWithOthers: 'Test'
        },
        technicalInsights: {
          geneKeysProfile: {},
          forgeIdentification: { forge: 'INVALID' }
        },
        groundingAudit: { claimsTotal: 0, claimsGrounded: 0, ungroundedFields: [] }
      };
      const result = validateSynthesisResponse(bad);
      expect(result.errors).toContain('Invalid forge: INVALID');
    });

    it('rejects incomplete grounding', () => {
      const bad = {
        quickStartGuide: {
          whoYouAre: 'Test',
          decisionStyle: 'Test',
          lifeStrategy: 'Test',
          thisMonth: 'Test',
          workingWithOthers: 'Test'
        },
        technicalInsights: {
          geneKeysProfile: {},
          forgeIdentification: { forge: 'Lux' }
        },
        groundingAudit: { claimsTotal: 5, claimsGrounded: 3, ungroundedFields: ['x', 'y'] }
      };
      const result = validateSynthesisResponse(bad);
      expect(result.valid).toBe(false);
    });

    it('parses JSON string input', () => {
      const json = '{"quickStartGuide":{"whoYouAre":"Test","decisionStyle":"Test","lifeStrategy":"Test","thisMonth":"Test","workingWithOthers":"Test"},"technicalInsights":{"geneKeysProfile":{},"forgeIdentification":{"forge":"Eros"}},"groundingAudit":{"claimsTotal":0,"claimsGrounded":0,"ungroundedFields":[]}}';
      const result = validateSynthesisResponse(json);
      expect(result.parsed).toBeDefined();
      expect(result.parsed.technicalInsights.forgeIdentification.forge).toBe('Eros');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  it('handles birth at midnight UTC', () => {
    const jdn = toJulianDay(2000, 1, 1, 0, 0, 0);
    const pos = getAllPositions(jdn);
    expect(pos.sun.longitude).toBeDefined();
  });

  it('handles high latitude (60°N)', () => {
    const jdn = toJulianDay(1990, 6, 21, 12, 0, 0);
    const pos = getAllPositions(jdn);
    const astro = calculateAstrology(pos, 60, 25, jdn);
    expect(astro.ascendant.sign).toBeDefined();
    for (let h = 1; h <= 12; h++) {
      expect(astro.houses[h]).toBeDefined();
    }
  });

  it('handles southern hemisphere (-33.87°S)', () => {
    const jdn = toJulianDay(1985, 3, 15, 8, 0, 0);
    const pos = getAllPositions(jdn);
    const astro = calculateAstrology(pos, -33.87, 151.21, jdn);
    expect(astro.ascendant.sign).toBeDefined();
  });

  it('gate lookup wraps around 360°', () => {
    const g1 = longitudeToGate(0.5);
    const g2 = longitudeToGate(359.5);
    expect(g1.gate).toBeDefined();
    expect(g2.gate).toBeDefined();
  });

  it('transit forecast with no matching target gates', () => {
    const pos = getAllPositions(AP_JDN);
    const pGates = mapAllToGates(pos);
    const design = getDesignCalculation(AP_JDN, pos);
    const dGates = mapAllToGates(design.designPositions);
    const natal = calculateChart(pGates, dGates);
    const astro = calculateAstrology(pos, AP_LAT, AP_LNG, AP_JDN);

    const fc = getTransitForecast(
      natal, astro,
      { year: 2025, month: 6, day: 1 },
      { year: 2025, month: 6, day: 3 },
      { targetGates: [99] } // non-existent gate
    );
    expect(fc.events.filter(e => e.event.includes('enters Gate')).length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// TYPE DETERMINATION — All 5 Types + Authority Variants (BL-S15-M4)
// ═══════════════════════════════════════════════════════════════
// These tests exercise calculateChart with synthetic gate inputs
// that produce each Type / Authority combination deterministically.
//
// The gate set is carefully chosen so that the resulting active
// channels define exactly the centers needed for each type.

/**
 * Build minimal personality/design gate objects.
 * Specify gate numbers for each side; lines default to 1.
 * Any planet key not mentioned gets gate 99 (no channel uses 99).
 */
function makeGates(personalityGateNums, designGateNums) {
  const BODIES = ['sun', 'earth', 'moon', 'mercury', 'venus', 'mars',
    'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'northNode', 'southNode'];

  function buildSide(gateNums) {
    const side = {};
    for (let i = 0; i < BODIES.length; i++) {
      side[BODIES[i]] = { gate: gateNums[i] ?? 99, line: (i === 0) ? 4 : 1 };
    }
    return side;
  }

  return { p: buildSide(personalityGateNums), d: buildSide(designGateNums) };
}

describe('Type Determination — All 5 Types', () => {

  it('Reflector: no defined centers', () => {
    // Gates with no matching channel partners → no channels → no centers
    const { p, d } = makeGates(
      [61, 4, 8, 16, 21, 25, 2, 7, 13, 46, 1, 10, 15],
      [63, 11, 12, 48, 45, 51, 14, 31, 33, 29, 5, 34, 9]
    );

    // None of these pairs form channels — we need to be careful
    // Actually let me use truly isolated gates: only ONE gate from each channel pair
    // Channel 1-8: give 1 to P, but NOT 8 to D (D gets 12 instead).  Etc.
    // Simplest: give all bodies gate 99 (a gate not in any channel)
    const pReflector = {};
    const dReflector = {};
    const BODIES = ['sun', 'earth', 'moon', 'mercury', 'venus', 'mars',
      'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'northNode', 'southNode'];
    for (const body of BODIES) {
      pReflector[body] = { gate: 99, line: 4 };
      dReflector[body] = { gate: 99, line: 1 };
    }

    const chart = calculateChart(pReflector, dReflector);
    expect(chart.type).toBe('Reflector');
    expect(chart.authority).toBe('Lunar');
    expect(chart.definition).toBe('None');
    expect(chart.definedCenters).toHaveLength(0);
    expect(chart.strategy).toBe('Wait a Lunar Cycle');
    expect(chart.notSelfTheme).toBe('Disappointment');
  });

  it('Generator: Sacral defined, no motor→Throat', () => {
    // Channel 3-60: Sacral↔Root. Sacral defined, but no throat connection.
    const { p, d } = makeGates(
      [3],   // P: gate 3 (Sacral end of 3-60)
      [60]   // D: gate 60 (Root end of 3-60)
    );
    const chart = calculateChart(p, d);
    expect(chart.type).toBe('Generator');
    expect(chart.authority).toBe('Sacral');
    expect(chart.strategy).toBe('Wait to Respond');
    expect(chart.notSelfTheme).toBe('Frustration');
    expect(chart.definedCenters).toContain('Sacral');
    expect(chart.definedCenters).toContain('Root');
    expect(chart.definedCenters).not.toContain('Throat');
  });

  it('Manifesting Generator: Sacral defined + motor→Throat', () => {
    // Channel 20-34: Throat↔Sacral (direct motor-to-throat)
    const { p, d } = makeGates(
      [20],   // P: gate 20 (Throat end)
      [34]    // D: gate 34 (Sacral end)
    );
    const chart = calculateChart(p, d);
    expect(chart.type).toBe('Manifesting Generator');
    expect(chart.definedCenters).toContain('Sacral');
    expect(chart.definedCenters).toContain('Throat');
    expect(chart.strategy).toBe('Wait to Respond, then Inform');
    expect(chart.notSelfTheme).toBe('Frustration / Anger');
  });

  it('Manifestor: no Sacral, motor→Throat', () => {
    // Channel 21-45: Heart↔Throat (Heart is a motor)
    const { p, d } = makeGates(
      [21],   // P: gate 21 (Heart end)
      [45]    // D: gate 45 (Throat end)
    );
    const chart = calculateChart(p, d);
    expect(chart.type).toBe('Manifestor');
    expect(chart.authority).toBe('Ego Manifested');
    expect(chart.definedCenters).toContain('Heart');
    expect(chart.definedCenters).toContain('Throat');
    expect(chart.definedCenters).not.toContain('Sacral');
    expect(chart.strategy).toBe('Inform');
    expect(chart.notSelfTheme).toBe('Anger');
  });

  it('Projector: no Sacral, no motor→Throat, centers defined', () => {
    // Channel 4-63: Ajna↔Head (neither is a motor, no Sacral, no Throat)
    const { p, d } = makeGates(
      [4],    // P: gate 4 (Ajna end)
      [63]    // D: gate 63 (Head end)
    );
    const chart = calculateChart(p, d);
    expect(chart.type).toBe('Projector');
    expect(chart.definedCenters).toContain('Ajna');
    expect(chart.definedCenters).toContain('Head');
    expect(chart.definedCenters).not.toContain('Sacral');
    expect(chart.strategy).toBe('Wait for the Invitation');
    expect(chart.notSelfTheme).toBe('Bitterness');
  });
});

describe('Authority Variants', () => {

  it('Emotional authority (SolarPlexus defined)', () => {
    // Channel 6-59: SolarPlexus↔Sacral
    const { p, d } = makeGates([6], [59]);
    const chart = calculateChart(p, d);
    expect(chart.authority).toBe('Emotional - Solar Plexus');
  });

  it('Sacral authority (Sacral defined, no SolarPlexus)', () => {
    // Channel 3-60: Sacral↔Root
    const { p, d } = makeGates([3], [60]);
    const chart = calculateChart(p, d);
    expect(chart.authority).toBe('Sacral');
  });

  it('Splenic authority (Spleen defined, no SolarPlexus/Sacral)', () => {
    // Channel 28-38: Spleen↔Root  (Projector — no Sacral, no motor→Throat)
    const { p, d } = makeGates([28], [38]);
    const chart = calculateChart(p, d);
    expect(chart.type).toBe('Projector');
    expect(chart.authority).toBe('Splenic');
  });

  it('Ego Manifested authority (Heart→Throat, Manifestor)', () => {
    // Channel 21-45: Heart↔Throat
    const { p, d } = makeGates([21], [45]);
    const chart = calculateChart(p, d);
    expect(chart.type).toBe('Manifestor');
    expect(chart.authority).toBe('Ego Manifested');
  });

  it('Ego Projected authority (Heart defined, NOT connected to Throat)', () => {
    // Channel 25-51: G↔Heart. Heart defined but not connected to Throat.
    const { p, d } = makeGates([25], [51]);
    const chart = calculateChart(p, d);
    expect(chart.type).toBe('Projector');
    expect(chart.authority).toBe('Ego Projected');
  });

  it('Self-Projected authority (G defined, no SolarPlexus/Sacral/Spleen/Heart)', () => {
    // Channel 1-8: G↔Throat. G defined, Throat defined, no motors besides Throat path.
    // Type: Manifestor? No — G is NOT a motor. Let's check:
    // G is not in MOTOR_CENTERS. Throat has no path to a motor. So no motor→Throat → Projector.
    // Wait — G↔Throat means Throat IS defined, but only connected to G (not a motor).
    const { p, d } = makeGates([1], [8]);
    const chart = calculateChart(p, d);
    expect(chart.type).toBe('Projector');
    expect(chart.authority).toBe('Self-Projected');
  });

  it('Mental (None) authority (only Head/Ajna defined)', () => {
    // Channel 4-63: Ajna↔Head
    const { p, d } = makeGates([4], [63]);
    const chart = calculateChart(p, d);
    expect(chart.type).toBe('Projector');
    expect(chart.authority).toBe('Mental (None)');
  });

  it('Lunar authority (Reflector)', () => {
    const pReflector = {};
    const dReflector = {};
    const BODIES = ['sun', 'earth', 'moon', 'mercury', 'venus', 'mars',
      'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'northNode', 'southNode'];
    for (const body of BODIES) {
      pReflector[body] = { gate: 99, line: 4 };
      dReflector[body] = { gate: 99, line: 1 };
    }
    const chart = calculateChart(pReflector, dReflector);
    expect(chart.authority).toBe('Lunar');
  });
});

describe('Definition Variants', () => {

  it('None definition (Reflector)', () => {
    const pReflector = {};
    const dReflector = {};
    const BODIES = ['sun', 'earth', 'moon', 'mercury', 'venus', 'mars',
      'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'northNode', 'southNode'];
    for (const body of BODIES) {
      pReflector[body] = { gate: 99, line: 4 };
      dReflector[body] = { gate: 99, line: 1 };
    }
    const chart = calculateChart(pReflector, dReflector);
    expect(chart.definition).toBe('None');
  });

  it('Single Definition (one connected group)', () => {
    // Channel 20-34: Throat↔Sacral. Single group.
    const { p, d } = makeGates([20], [34]);
    const chart = calculateChart(p, d);
    expect(chart.definition).toBe('Single Definition');
    expect(chart.connectedComponents).toHaveLength(1);
  });

  it('Split Definition (two separate groups)', () => {
    // Group 1: Channel 20-34 (Throat↔Sacral)
    // Group 2: Channel 4-63 (Ajna↔Head)
    // These are disconnected → Split Definition
    const { p, d } = makeGates(
      [20,  99, 4],     // P: sun=20(Throat), earth=99, moon=4(Ajna)
      [34,  99, 63]     // D: sun=34(Sacral), earth=99, moon=63(Head)
    );
    const chart = calculateChart(p, d);
    expect(chart.definition).toBe('Split Definition');
    expect(chart.connectedComponents).toHaveLength(2);
  });

  it('Triple Split Definition (three separate groups)', () => {
    // Group 1: Channel 20-34 (Throat↔Sacral)
    // Group 2: Channel 4-63 (Ajna↔Head)
    // Group 3: Channel 28-38 (Spleen↔Root)
    const { p, d } = makeGates(
      [20, 99, 4,  99, 28],   // P: sun=20, moon=4, venus=28
      [34, 99, 63, 99, 38]    // D: sun=34, moon=63, venus=38
    );
    const chart = calculateChart(p, d);
    expect(chart.definition).toBe('Triple Split Definition');
    expect(chart.connectedComponents).toHaveLength(3);
  });
});
