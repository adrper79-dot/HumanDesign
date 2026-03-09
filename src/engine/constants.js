/**
 * Shared constants for the Prime Self calculation engine.
 * 
 * BL-S18-H1: Consolidate duplicated ASPECT_TYPES from astro.js and transits.js.
 * 
 * @module engine/constants
 */

// ─── ASPECT DEFINITIONS ─────────────────────────────────────────
// 
// - `orbLum`: Orb allowance when at least one body is a luminary (Sun/Moon)
// - `orbPlan`: Orb allowance for planet-to-planet aspects  
// - `orb`: Default single orb for transit calculations (average of orbLum/orbPlan)
//
export const ASPECT_TYPES = [
  { name: 'Conjunction',  angle: 0,   orbLum: 8, orbPlan: 6, orb: 6 },
  { name: 'Opposition',   angle: 180, orbLum: 8, orbPlan: 6, orb: 6 },
  { name: 'Trine',        angle: 120, orbLum: 8, orbPlan: 6, orb: 5 },
  { name: 'Square',       angle: 90,  orbLum: 7, orbPlan: 5, orb: 5 },
  { name: 'Sextile',      angle: 60,  orbLum: 5, orbPlan: 4, orb: 4 },
  { name: 'Quincunx',     angle: 150, orbLum: 2, orbPlan: 2, orb: 2 },
];

// ─── CELESTIAL BODY CLASSIFICATIONS ─────────────────────────────

/** Sun and Moon — receive larger orbs in aspect calculations */
export const LUMINARIES = new Set(['sun', 'moon']);

/** Outer/slow-moving planets — make longer-lasting transits */
export const OUTER_PLANETS = new Set([
  'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron'
]);

/** Transit speed classification (approximate degrees/day) */
export const PLANET_SPEEDS = {
  sun: 0.9856, moon: 13.176, mercury: 1.38, venus: 1.20,
  mars: 0.524, jupiter: 0.083, saturn: 0.034, uranus: 0.012,
  neptune: 0.006, pluto: 0.004, chiron: 0.02, northNode: -0.053, southNode: -0.053
};
