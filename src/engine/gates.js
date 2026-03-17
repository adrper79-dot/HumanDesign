/**
 * Layer 4: Gate/Line Lookup
 *
 * Converts ecliptic longitudes to Energy Blueprint gates and lines
 * using the gate wheel mapping.
 *
 * The wheel maps 360° of ecliptic longitude to 64 I Ching hexagrams.
 * Each gate = 5.625° (360/64). Each line = 0.9375° (5.625/6).
 *
 * A wheel offset of 3.875° (3°52'30") aligns the gate positions to
 * the astronomical ecliptic. All longitudes are adjusted by this
 * offset before lookup.
 *
 * Pure JS for Cloudflare Workers. No external dependencies.
 */

// ─── WHEEL OFFSET ───────────────────────────────────────────────
// The gate wheel is rotated 3°52'30" from 0° Aries.
// Subtract this from ecliptic longitude before position lookup.
// Calibrated: Gate 41 Line 1 starts at ~302° (New Year point).
export const WHEEL_OFFSET = 3.875;

// ─── GATE SEQUENCE ──────────────────────────────────────────────
// 64 gates arranged around the 360° ecliptic, starting from 0° Aries
// (after offset adjustment). Index 0 = first gate after the offset point.
// NOTE: This sequence is also defined in src/data/gate_wheel.json.
// This inline copy is the authoritative source for the calculation engine
// (avoids async import in hot path). Keep both in sync if ever modified.
export const GATE_WHEEL = [
  17, 21, 51, 42,  3, 27, 24,  2, 23,  8, 20, 16, 35, 45, 12, 15,
  52, 39, 53, 62, 56, 31, 33,  7,  4, 29, 59, 40, 64, 47,  6, 46,
  18, 48, 57, 32, 50, 28, 44,  1, 43, 14, 34,  9,  5, 26, 11, 10,
  58, 38, 54, 61, 60, 41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25
];

// ─── CONSTANTS ──────────────────────────────────────────────────
const DEG_PER_GATE = 5.625;   // 360 / 64
const DEG_PER_LINE = 0.9375;  // 5.625 / 6

// ─── MAIN LOOKUP ────────────────────────────────────────────────

/**
 * Convert an ecliptic longitude to an HD gate and line.
 *
 * @param {number} longitude – Ecliptic longitude 0–360°
 * @returns {{ gate: number, line: number, color: number, tone: number, base: number }}
 *
 * Gate:  1–64 (I Ching hexagram number)
 * Line:  1–6
 * Color: 1–6 (sub-line division, 6 per line)
 * Tone:  1–6 (sub-color division, 6 per color)
 * Base:  1–5 (sub-tone division, 5 per tone)
 */
export function longitudeToGate(longitude) {
  // Apply wheel offset
  const adjusted = ((longitude - WHEEL_OFFSET) % 360 + 360) % 360;

  // Gate position (0–63)
  const position = Math.floor(adjusted / DEG_PER_GATE);
  const gate = GATE_WHEEL[position];

  // Offset within the gate (0–5.625°)
  const gateOffset = adjusted - position * DEG_PER_GATE;

  // Line (1–6)
  const line = Math.floor(gateOffset / DEG_PER_LINE) + 1;

  // Color (1–6) — sub-division of each line
  const lineOffset = gateOffset - (line - 1) * DEG_PER_LINE;
  const degPerColor = DEG_PER_LINE / 6; // 0.15625°
  const color = Math.floor(lineOffset / degPerColor) + 1;

  // Tone (1–6) — sub-division of each color
  const colorOffset = lineOffset - (color - 1) * degPerColor;
  const degPerTone = degPerColor / 6; // 0.02604°
  const tone = Math.floor(colorOffset / degPerTone) + 1;

  // Base (1–5) — sub-division of each tone
  const toneOffset = colorOffset - (tone - 1) * degPerTone;
  const degPerBase = degPerTone / 5; // 0.005208°
  const base = Math.floor(toneOffset / degPerBase) + 1;

  return {
    gate,
    line: Math.min(line, 6),
    color: Math.min(color, 6),
    tone: Math.min(tone, 6),
    base: Math.min(base, 5)
  };
}

/**
 * Get the ecliptic longitude range for a specific gate.
 * NOTE: When a gate spans the 0°/360° boundary, `end` will be less than `start`.
 * Consumers should check: `start <= end ? (lon >= start && lon < end) : (lon >= start || lon < end)`.
 *
 * @param {number} gateNumber – Gate number (1–64)
 * @returns {{ start: number, end: number, position: number, wraps: boolean } | null}
 */
export function gateToLongitudeRange(gateNumber) {
  const position = GATE_WHEEL.indexOf(gateNumber);
  if (position === -1) return null;

  const rawStart = position * DEG_PER_GATE;
  const rawEnd = rawStart + DEG_PER_GATE;

  const start = (rawStart + WHEEL_OFFSET) % 360;
  const end = (rawEnd + WHEEL_OFFSET) % 360;

  return {
    start,
    end,
    position,
    wraps: end < start  // P2-ENGINE-003: flag when gate spans 0°/360° boundary
  };
}

/**
 * Map all planetary positions to gates and lines.
 *
 * @param {object} positions – Planet positions from Layer 2
 *   { sun: { longitude }, moon: { longitude }, ... }
 * @returns {object} Same keys, each with { gate, line, color, tone, base }
 */
export function mapAllToGates(positions) {
  const result = {};

  for (const [body, data] of Object.entries(positions)) {
    result[body] = longitudeToGate(data.longitude);
  }

  // Add Earth (opposite Sun) if not present
  if (positions.sun && !positions.earth) {
    const earthLon = (positions.sun.longitude + 180) % 360;
    result.earth = longitudeToGate(earthLon);
  }

  return result;
}
