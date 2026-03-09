# Prime Self — Build Bible

## Execution Reference for Layer-by-Layer Implementation

This document is self-contained. Every prompt, verification anchor, data reference, and decision needed to build the Prime Self platform is here. Execute in order. Do not skip layers. Do not proceed until the current layer passes verification.

---

## Table of Contents

1. [Verification Anchor](#1-verification-anchor)
2. [Model Routing](#2-model-routing)
3. [Environment Setup](#3-environment-setup)
4. [Layer 1 Prompt: Julian Day Number + Sun Position](#4-layer-1-julian-day-number--sun-position)
5. [Layer 2 Prompt: All Planets + Nodes](#5-layer-2-all-planets--nodes)
6. [Layer 3 Prompt: Design Side (-88 Days)](#6-layer-3-design-side--88-days)
7. [Layer 4 Prompt: Gate/Line Lookup Table](#7-layer-4-gateline-lookup)
8. [Layer 5 Prompt: Centers / Channels / Type / Authority](#8-layer-5-centers--channels--type--authority)
9. [Layer 6 Prompt: Astrology Layer](#9-layer-6-astrology-layer)
10. [Layer 7 Prompt: Transit Engine](#10-layer-7-transit-engine)
11. [Layer 8 Prompt: Prime Self Synthesis](#11-layer-8-prime-self-synthesis)
12. [Knowledgebase Generation Prompts](#12-knowledgebase-generation-prompts)
13. [Worker Architecture](#13-worker-architecture)
14. [Testing Protocol](#14-testing-protocol)
15. [File Map](#15-file-map)

---

## 1. Verification Anchor

**Every layer must be tested against this data before proceeding to the next layer.**

```
Subject:        AP
Birth Date:     August 5, 1979
Birth Time:     18:51 EDT → 22:51 UTC
Location:       Tampa, Florida, USA
Latitude:       27.9506° N
Longitude:      82.4572° W

KNOWN CORRECT OUTPUTS:

HD Profile:
  Type:           Projector
  Profile:        6/2
  Definition:     Split Definition
  Authority:      Emotional – Solar Plexus
  Strategy:       Wait for the Invitation
  Not-Self Theme: Bitterness
  Incarnation Cross: Left Angle Cross of Refinement (33/19 | 2/1)

Personality (Conscious) Planetary Gates:
  Sun:      Gate 33, Line 6
  Earth:    Gate 19, Line 6
  Moon:     Gate 38, Line 4
  N.Node:   Gate 40, Line 4
  S.Node:   Gate 37, Line 4
  Mercury:  Gate 31, Line 3
  Venus:    Gate 31, Line 6
  Mars:     Gate 15, Line 1
  Jupiter:  Gate 7, Line 6
  Saturn:   Gate 64, Line 2
  Uranus:   Gate 1, Line 4
  Neptune:  Gate 26, Line 1
  Pluto:    Gate 57, Line 2

Design (Unconscious) Planetary Gates:
  Sun:      Gate 2, Line 2
  Earth:    Gate 1, Line 2
  Moon:     Gate 59, Line 6
  N.Node:   Gate 64, Line 5
  S.Node:   Gate 63, Line 5
  Mercury:  Gate 42, Line 2
  Venus:    Gate 51, Line 1
  Mars:     Gate 42, Line 2
  Jupiter:  Gate 56, Line 6
  Saturn:   Gate 40, Line 2
  Uranus:   Gate 43, Line 1
  Neptune:  Gate 26, Line 4
  Pluto:    Gate 57, Line 3

Design Date: approximately 88 solar degrees before birth
  ≈ May 9, 1979 (verify: Design Sun must land in Gate 2, Line 2)
```

---

## 2. Model Routing

| Task | Model | Reason |
|------|-------|--------|
| Layer 1–7 code generation | **Sonnet 4.6** (via Claude Code) | Algorithm accuracy, self-verification, inline test execution |
| Knowledgebase corpus generation | **Opus 4.6** | Depth, nuance, original synthesis from I Ching source |
| Layer 8 synthesis prompt | **Opus 4.6** | Cross-system reasoning, Prime Self interpretation |
| Daily transit digests | **Haiku 4.5** or **Groq Llama** | Short, structured, high volume, cost-efficient |
| Code review / cleanup | **Sonnet 4.6** | Fast, accurate refactoring |
| Quality audit of KB | **Sonnet 4.6** | Flag derivative language, check grounding |

---

## 3. Environment Setup

Before starting Layer 1, ensure:

```bash
# Initialize Node.js project in workers/ directory
cd workers/
npm init -y

# No external dependencies for the calculation engine
# The engine is pure JS — no npm packages

# For local testing only:
npm install --save-dev vitest   # test runner

# Cloudflare Workers tooling:
npm install --save-dev wrangler
```

### Wrangler Configuration (`workers/wrangler.toml`)
```toml
name = "prime-self-engine"
main = "src/index.js"
compatibility_date = "2026-03-01"

[vars]
ENVIRONMENT = "development"

# Secrets are set via: wrangler secret put NEON_CONNECT_STRING
# Never put secrets in this file

[[d1_databases]]
binding = "DB"
database_name = "prime-self"
database_id = "TBD"

[[kv_namespaces]]
binding = "CACHE"
id = "TBD"

[[r2_buckets]]
binding = "KB_STORE"
bucket_name = "prime-self-kb"
```

---

## 4. Layer 1: Julian Day Number + Sun Position

### Prompt (copy-paste into Claude Code / Sonnet 4.6)

```
CONTEXT:
I am building a Human Design + Astrology calculation engine in pure JavaScript
for Cloudflare Workers. This is Layer 1 of 8. The engine must produce verifiably
accurate planetary positions. No external dependencies. No npm packages. Pure JS
that runs in the Cloudflare Workers runtime (V8 isolate).

This layer must accomplish two things:
1. Convert a birth datetime (UTC) to a Julian Day Number (JDN)
2. Calculate the Sun's ecliptic longitude from that JDN

INPUTS:
{
  year: number,      // 4-digit year
  month: number,     // 1-12
  day: number,       // 1-31
  hour: number,      // 0-23 UTC
  minute: number     // 0-59 UTC
}

OUTPUTS:
{
  jdn: number,           // Julian Day Number with decimal
  sunLongitude: number   // Ecliptic longitude 0-360°
}

ALGORITHM REQUIREMENTS:
Use Jean Meeus "Astronomical Algorithms" 2nd edition methods.

For JDN:
- Standard astronomical Julian Day Number formula
- Handle Gregorian/Julian calendar boundary (after Oct 15, 1582 = Gregorian)
- Decimal portion = time of day (0.0 = noon, not midnight)
- JDN epoch: noon January 1, 4713 BC

For Sun longitude:
- T = (JDN - 2451545.0) / 36525  (Julian centuries from J2000.0)
- Calculate geometric mean longitude L0
- Calculate mean anomaly M
- Calculate equation of center C
- Calculate apparent longitude with aberration and nutation correction
- Return normalized to 0-360°

VERIFICATION — MUST PASS BEFORE RETURNING CODE:

Input:
  year: 1979, month: 8, day: 5
  hour: 22, minute: 51  (UTC — Tampa EDT 18:51 converted)

Expected:
  JDN: approximately 2444091.45 (verify to 2 decimal places)
  Sun longitude: must fall between 132° and 134° (Leo ~12-13°)

This must be consistent with Human Design Gate 33 for the Personality Sun.
Gate 33 occupies approximately 132.1875° to 137.8125° on the HD wheel.
Sun longitude MUST land in this range.

Show your calculated JDN, then your Sun longitude, then confirm the HD gate
range before returning final code.

CONSTRAINTS:
- Pure JavaScript, no imports, no require
- Runs in Cloudflare Workers (V8 isolate, no Node.js APIs)
- Export as ES module: export function toJulianDay(year, month, day, hour, minute)
- Export as ES module: export function getSunLongitude(jdn)
- JSDoc comments explaining each formula step
- All intermediate values calculable for debugging

FILE: src/engine/julian.js

After verification passes, also provide:
1. A test file (src/engine/__tests__/julian.test.js) using vitest
2. A note on accuracy expectations (arc-minutes vs arc-seconds)
```

### What to verify when you get the output:
- The model MUST show intermediate values (JDN, T, L0, M, C, apparent longitude) before giving code
- Sun longitude must be between 132° and 134°
- If it shows anything like 312° or 43°, the formula has a fundamental error — reject and re-prompt

---

## 5. Layer 2: All Planets + Nodes

### Prompt

```
CONTEXT:
This is Layer 2 of the Prime Self calculation engine. Layer 1 (julian.js) is
complete and verified — it provides toJulianDay() and getSunLongitude().

Layer 2 extends the engine to calculate ecliptic longitudes for ALL celestial
bodies needed for Human Design and Western Astrology:

  Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto,
  North Node (True Node), South Node (= North Node + 180°)

EXISTING CODE:
[PASTE Layer 1 julian.js here]

ALGORITHM REQUIREMENTS:
Use Jean Meeus "Astronomical Algorithms" chapter-appropriate methods for each body.

For the Moon:
- Use the full lunar theory (Meeus Ch. 47) — at minimum the major periodic terms
- Accuracy target: within 0.5° (sufficient for HD gate-level precision)

For Mercury through Saturn:
- Use the VSOP87 abridged series or Meeus planetary position algorithms
- Include orbital elements, equation of center, and ecliptic conversion
- Accuracy target: within 0.1° for inner planets, 0.2° for outer

For Uranus, Neptune, Pluto:
- These move slowly — simplified position formulas are acceptable
- Accuracy target: within 0.5°

For True North Node:
- Use the standard lunar node calculation (Meeus Ch. 47)
- South Node = North Node + 180° (mod 360)

INPUTS:
{
  jdn: number  // Julian Day Number from Layer 1
}

OUTPUTS:
{
  sun:       { longitude: number },  // 0-360°
  moon:      { longitude: number },
  mercury:   { longitude: number },
  venus:     { longitude: number },
  mars:      { longitude: number },
  jupiter:   { longitude: number },
  saturn:    { longitude: number },
  uranus:    { longitude: number },
  neptune:   { longitude: number },
  pluto:     { longitude: number },
  northNode: { longitude: number },
  southNode: { longitude: number }
}

VERIFICATION — MUST PASS:

Input: JDN for August 5, 1979, 22:51 UTC (JDN ≈ 2444091.4521)

The longitudes must produce these HD gates when mapped through the gate wheel:

  Personality side planets:
    Sun → Gate 33    Moon → Gate 38    Mercury → Gate 31
    Venus → Gate 31  Mars → Gate 15    Jupiter → Gate 7
    Saturn → Gate 64  Uranus → Gate 1   Neptune → Gate 26
    Pluto → Gate 57   N.Node → Gate 40  S.Node → Gate 37

Note: The gate-to-longitude mapping will be confirmed in Layer 4. For now,
verify that your calculated longitudes are in astronomically reasonable ranges
for August 1979. Cross-reference against any available ephemeris data.

At minimum, verify:
- Sun: ~132-134° (Leo 12-13°)
- Moon: should be in Aquarius range (~300-330°)
- Jupiter: should be in Leo range (~130-160°)

CONSTRAINTS:
- Pure JS, no imports or require
- Single file: src/engine/planets.js
- Export: getAllPositions(jdn) → returns the full object above
- Must run in Cloudflare Workers (V8 isolate)
- Reuse toJulianDay from julian.js via import if needed, but keep
  all planetary math self-contained in this file

Provide test file: src/engine/__tests__/planets.test.js
```

---

## 6. Layer 3: Design Side (-88 Days)

### Prompt

```
CONTEXT:
Layer 3 of the Prime Self calculation engine. Layers 1-2 are complete.

Human Design uses TWO chart calculations:
1. Personality (Conscious): planetary positions at birth moment
2. Design (Unconscious): planetary positions at a point ~88 solar degrees
   BEFORE birth

The Design calculation is NOT simply "birth date minus 88 days." It is:
  - Find the Sun's longitude at birth
  - Subtract 88° from that longitude
  - Find the EXACT moment in time when the Sun was at that longitude
  - Calculate ALL planetary positions at THAT moment

This is a root-finding problem: given a target Sun longitude, find the JDN
when the Sun occupied that position.

EXISTING CODE:
[PASTE julian.js and planets.js here]

ALGORITHM:
1. Get birth Sun longitude from Layer 2
2. Target longitude = (birthSunLongitude - 88°) mod 360°
3. Use iterative refinement (Newton-Raphson or bisection):
   - Start with JDN estimate = birthJDN - 88 (days, rough approximation)
   - Calculate Sun longitude at estimate
   - Refine until Sun longitude matches target within 0.001°
4. Once design JDN is found, run getAllPositions(designJDN) for all planets

INPUTS:
{
  birthJDN: number,       // from Layer 1
  birthPositions: object  // from Layer 2 (need Sun longitude)
}

OUTPUTS:
{
  designJDN: number,
  designDate: { year, month, day, hour, minute },  // human-readable
  designPositions: {
    sun: { longitude }, moon: { longitude }, ...    // same structure as Layer 2
  }
}

VERIFICATION:

Birth JDN: 2444091.4521 (Aug 5, 1979, 22:51 UTC)
Birth Sun longitude: ~132-133° (calculated in Layer 2)
Target Design Sun longitude: ~44-45° (birth Sun - 88°)

The Design date should be approximately May 8-10, 1979.

CRITICAL CHECK — Design planets must produce these HD gates:
  Design Sun → Gate 2, Line 2
  Design Earth → Gate 1, Line 2
  Design Moon → Gate 59, Line 6

If Design Sun does not land in Gate 2 range, the 88° offset or the
root-finding algorithm has an error. Debug and fix before returning.

CONSTRAINTS:
- Pure JS, no imports
- File: src/engine/design.js
- Export: getDesignCalculation(birthJDN, birthPositions)
- Must converge within 20 iterations
- Must run in Cloudflare Workers

Provide test file: src/engine/__tests__/design.test.js
```

---

## 7. Layer 4: Gate/Line Lookup

### Prompt

```
CONTEXT:
Layer 4 of the Prime Self calculation engine. Layers 1-3 produce planetary
longitudes. This layer converts those longitudes into Human Design gates and lines.

The HD wheel maps 360° of ecliptic longitude to 64 I Ching hexagrams (gates).
Each gate occupies exactly 5.625° (360/64). Each gate has 6 lines, each
occupying 0.9375° (5.625/6).

CRITICAL: The gates are NOT sequentially arranged around the wheel. Gate 1 does
not start at 0°. There is a specific, fixed mapping that must be encoded exactly.

The gate wheel starts at the Rave New Year point (approximately 0° Aries on the
astronomical ecliptic, which is the vernal equinox point).

I am providing the COMPLETE gate wheel lookup table. Encode this EXACTLY.
Do not attempt to derive or calculate the gate order — use this table verbatim.

GATE WHEEL TABLE (in order around the 360° ecliptic, starting from 0°):

Position 1 (0.0000° – 5.6250°):     Gate 17
Position 2 (5.6250° – 11.2500°):    Gate 21
Position 3 (11.2500° – 16.8750°):   Gate 51
Position 4 (16.8750° – 22.5000°):   Gate 42
Position 5 (22.5000° – 28.1250°):   Gate 3
Position 6 (28.1250° – 33.7500°):   Gate 27
Position 7 (33.7500° – 39.3750°):   Gate 24
Position 8 (39.3750° – 45.0000°):   Gate 2
Position 9 (45.0000° – 50.6250°):   Gate 23
Position 10 (50.6250° – 56.2500°):  Gate 8
Position 11 (56.2500° – 61.8750°):  Gate 20
Position 12 (61.8750° – 67.5000°):  Gate 16
Position 13 (67.5000° – 73.1250°):  Gate 35
Position 14 (73.1250° – 78.7500°):  Gate 45
Position 15 (78.7500° – 84.3750°):  Gate 12
Position 16 (84.3750° – 90.0000°):  Gate 15
Position 17 (90.0000° – 95.6250°):  Gate 52
Position 18 (95.6250° – 101.2500°): Gate 39
Position 19 (101.2500° – 106.8750°): Gate 53
Position 20 (106.8750° – 112.5000°): Gate 62
Position 21 (112.5000° – 118.1250°): Gate 56
Position 22 (118.1250° – 123.7500°): Gate 31
Position 23 (123.7500° – 129.3750°): Gate 33
Position 24 (129.3750° – 135.0000°): Gate 7
Position 25 (135.0000° – 140.6250°): Gate 4
Position 26 (140.6250° – 146.2500°): Gate 29
Position 27 (146.2500° – 151.8750°): Gate 59
Position 28 (151.8750° – 157.5000°): Gate 40
Position 29 (157.5000° – 163.1250°): Gate 64
Position 30 (163.1250° – 168.7500°): Gate 47
Position 31 (168.7500° – 174.3750°): Gate 6
Position 32 (174.3750° – 180.0000°): Gate 46
Position 33 (180.0000° – 185.6250°): Gate 18
Position 34 (185.6250° – 191.2500°): Gate 48
Position 35 (191.2500° – 196.8750°): Gate 57
Position 36 (196.8750° – 202.5000°): Gate 32
Position 37 (202.5000° – 208.1250°): Gate 50
Position 38 (208.1250° – 213.7500°): Gate 28
Position 39 (213.7500° – 219.3750°): Gate 44
Position 40 (219.3750° – 225.0000°): Gate 1
Position 41 (225.0000° – 230.6250°): Gate 43
Position 42 (230.6250° – 236.2500°): Gate 14
Position 43 (236.2500° – 241.8750°): Gate 34
Position 44 (241.8750° – 247.5000°): Gate 9
Position 45 (247.5000° – 253.1250°): Gate 5
Position 46 (253.1250° – 258.7500°): Gate 26
Position 47 (258.7500° – 264.3750°): Gate 11
Position 48 (264.3750° – 270.0000°): Gate 10
Position 49 (270.0000° – 275.6250°): Gate 58
Position 50 (275.6250° – 281.2500°): Gate 38
Position 51 (281.2500° – 286.8750°): Gate 54
Position 52 (286.8750° – 292.5000°): Gate 61
Position 53 (292.5000° – 298.1250°): Gate 60
Position 54 (298.1250° – 303.7500°): Gate 41
Position 55 (303.7500° – 309.3750°): Gate 19
Position 56 (309.3750° – 315.0000°): Gate 13
Position 57 (315.0000° – 320.6250°): Gate 49
Position 58 (320.6250° – 326.2500°): Gate 30
Position 59 (326.2500° – 331.8750°): Gate 55
Position 60 (331.8750° – 337.5000°): Gate 37
Position 61 (337.5000° – 343.1250°): Gate 63
Position 62 (343.1250° – 348.7500°): Gate 22
Position 63 (348.7500° – 354.3750°): Gate 36
Position 64 (354.3750° – 360.0000°): Gate 25

IMPLEMENTATION:
1. Store this as a constant array of 64 gate numbers (index 0 = gate at 0°)
2. Given a longitude, calculate: position = floor(longitude / 5.625)
3. Gate = WHEEL[position]
4. Offset within gate = longitude - (position * 5.625)
5. Line = floor(offset / 0.9375) + 1  (lines are 1-6)

VERIFICATION:

AP's Personality Sun longitude (~132-133°):
  Position = floor(132.5 / 5.625) = 23 (0-indexed)
  WHEEL[23] = Gate 7... wait.

  Actually let me clarify: At position 23 (index 23, which is the 24th slot),
  the gate is 7. At position 22 (index 22), the gate is 33.

  If Sun is at 132.5°: floor(132.5 / 5.625) = 23
  But AP's Personality Sun should be Gate 33, not Gate 7.

  Gate 33 occupies Position 23 (123.75° – 129.375°).
  Gate 7 occupies Position 24 (129.375° – 135.0°).

  THIS IS THE CRITICAL VERIFICATION: the Sun longitude from Layer 2 must
  land in 123.75° – 129.375° to produce Gate 33.

  If it lands in 129.375° – 135.0°, it maps to Gate 7 — which would be wrong.

  Use this to validate that Layer 2's Sun longitude is accurate enough.
  If there's a gate boundary issue, document it and check which gate
  the known chart shows.

CONSTRAINTS:
- Pure JS, no imports
- File: src/engine/gates.js
- Export: longitudeToGate(longitude) → { gate: number, line: number }
- Export: GATE_WHEEL as a constant for debugging
- Include reverse lookup: gateToLongitudeRange(gate) → { start: number, end: number }

Provide test file: src/engine/__tests__/gates.test.js
Test cases should include boundary conditions (0°, 360°, gate transitions)
```

### Critical Note on Gate Wheel Verification
The gate wheel table above is the standard Rave Mandala mapping. However, there are known variations in some sources regarding the exact starting offset. The table above assumes 0° ecliptic longitude = start of the first gate position. Some HD implementations apply a small offset. **If Layer 4 verification fails at gate boundaries, the issue is likely a 0.5°–1° offset in the wheel starting point.** Document any offset needed and apply consistently.

---

## 8. Layer 5: Centers / Channels / Type / Authority

### Prompt

```
CONTEXT:
Layer 5 of the Prime Self calculation engine. Layers 1-4 produce gate + line
assignments for all planets on both Personality and Design sides.

This layer takes ALL active gates and determines:
- Which channels are activated (gate pairs)
- Which centers are defined (have at least one complete channel running through them)
- Type (from defined centers pattern)
- Authority (from hierarchy of defined centers)
- Profile (from Personality Sun line + Design Sun line)
- Definition type (Single, Split, Triple Split, Quadruple Split)
- Incarnation Cross

CHANNEL DEFINITIONS (all 36 channels):
Format: Gate A - Gate B : Center A → Center B : Channel Name

1-8:    G Center → Throat : Creative Role Model
2-14:   G Center → Sacral : The Beat
3-60:   Sacral → Root : Mutation
4-63:   Ajna → Head : Logic
5-15:   Sacral → G Center : Rhythms
6-59:   Solar Plexus → Sacral : Intimacy
7-31:   G Center → Throat : The Alpha
9-52:   Sacral → Root : Determination
10-20:  G Center → Throat : Awakening
10-34:  G Center → Sacral : Exploration
10-57:  G Center → Spleen : Perfected Form
11-56:  Ajna → Throat : Curiosity
12-22:  Throat → Solar Plexus : Openness
13-33:  G Center → Throat : The Prodigal
14-2:   Sacral → G Center : The Beat (same as 2-14)
16-48:  Throat → Spleen : The Wavelength
17-62:  Ajna → Throat : Acceptance
18-58:  Spleen → Root : Judgment
19-49:  Root → Solar Plexus : Synthesis
20-34:  Throat → Sacral : Charisma
20-57:  Throat → Spleen : The Brainwave
21-45:  Throat → Heart : The Money Line
23-43:  Throat → Ajna : Structuring
24-61:  Ajna → Head : Awareness
25-51:  G Center → Heart : Initiation
26-44:  Heart → Spleen : Surrender
27-50:  Sacral → Spleen : Preservation
28-38:  Spleen → Root : Struggle
29-46:  Sacral → G Center : Discovery
30-41:  Solar Plexus → Root : Recognition
34-57:  Sacral → Spleen : Power
35-36:  Throat → Solar Plexus : Transitoriness
37-40:  Solar Plexus → Heart : Community
39-55:  Root → Solar Plexus : Emoting
47-64:  Ajna → Head : Abstraction
54-32:  Root → Spleen : Transformation

CENTER DEFINITIONS (9 centers):
- Head: Gates 61, 63, 64
- Ajna: Gates 4, 11, 17, 24, 43, 47
- Throat: Gates 8, 12, 16, 20, 23, 31, 33, 35, 45, 56, 62
- G Center: Gates 1, 2, 7, 10, 13, 15, 25, 46
- Heart (Will/Ego): Gates 21, 26, 40, 51
- Solar Plexus: Gates 6, 22, 30, 36, 37, 49, 55
- Sacral: Gates 3, 5, 9, 14, 27, 29, 34, 42, 59
- Spleen: Gates 18, 28, 32, 44, 48, 50, 57
- Root: Gates 19, 38, 39, 41, 52, 53, 54, 58, 60

TYPE DETERMINATION:
1. If Sacral is defined AND Throat is defined AND there's a motor-to-throat
   connection → Manifesting Generator
2. If Sacral is defined → Generator
3. If Sacral is NOT defined AND there IS a motor-to-throat connection
   → Manifestor
   (Motors = Sacral, Solar Plexus, Heart, Root)
4. If Sacral is NOT defined AND NO motor-to-throat connection AND
   at least one center is defined → Projector
5. If NO centers are defined → Reflector

AUTHORITY HIERARCHY (first match wins):
1. Solar Plexus defined → Emotional Authority
2. Sacral defined → Sacral Authority
3. Spleen defined → Splenic Authority
4. Heart defined → Ego/Heart Authority
5. G Center defined → Self-Projected Authority
6. Head/Ajna defined → Mental Authority (technically "none" — mental projector)
7. Nothing defined → Lunar Authority (Reflector)

PROFILE:
- Personality Sun Line / Design Sun Line
- AP: Personality Sun = Gate 33 Line 6, Design Sun = Gate 2 Line 2 → Profile 6/2

INCARNATION CROSS:
- Composed of: Personality Sun gate, Personality Earth gate,
                Design Sun gate, Design Earth gate
- AP: Gates 33, 19, 2, 1 → Left Angle Cross of Refinement

DEFINITION TYPE:
- Count connected groups of defined centers
- 1 group = Single Definition
- 2 groups = Split Definition
- 3 groups = Triple Split
- 4 groups = Quadruple Split
- 0 groups = No Definition (Reflector)

VERIFICATION — AP's chart:

Must produce:
  Type: Projector
  Authority: Emotional – Solar Plexus
  Profile: 6/2
  Definition: Split
  Cross: Left Angle Cross of Refinement (33/19|2/1)

Implementation note: The "motor-to-throat" check for Manifestor requires
tracing channel connections, not just checking if both a motor and Throat
are independently defined. There must be a CONNECTED PATH from a motor
center to the Throat through active channels.

CONSTRAINTS:
- Pure JS
- File: src/engine/chart.js
- Exports: calculateChart(personalityGates, designGates)
  Returns: { type, authority, profile, definition, cross,
             definedCenters, undefinedCenters, activeChannels, allGates }
- Import channel/center definitions from src/data/channels.json and src/data/centers.json

Provide test file: src/engine/__tests__/chart.test.js
```

---

## 9. Layer 6: Astrology Layer

### Prompt

```
CONTEXT:
Layer 6 adds Western Astrology calculations on top of the existing planetary
positions from Layer 2.

This layer converts ecliptic longitudes into:
1. Zodiac sign placements (which sign, degrees within sign)
2. House placements (requires birth latitude/longitude + house system)
3. Aspects between planets (conjunction, opposition, trine, square, sextile)

ZODIAC SIGNS (fixed, 30° each):
  Aries:       0° – 30°
  Taurus:      30° – 60°
  Gemini:      60° – 90°
  Cancer:       90° – 120°
  Leo:         120° – 150°
  Virgo:       150° – 180°
  Libra:       180° – 210°
  Scorpio:     210° – 240°
  Sagittarius: 240° – 270°
  Capricorn:   270° – 300°
  Aquarius:    300° – 330°
  Pisces:      330° – 360°

HOUSE SYSTEMS:
Implement Placidus (most common in Western Astrology).
This requires:
- Local Sidereal Time at birth
- Geographic latitude
- Obliquity of the ecliptic

Use Meeus Ch. 13 for sidereal time calculation.

ASPECTS (with standard orbs):
  Conjunction:  0°   (orb: 8° for luminaries, 6° for planets)
  Opposition:   180° (orb: 8° for luminaries, 6° for planets)
  Trine:        120° (orb: 8° for luminaries, 6° for planets)
  Square:       90°  (orb: 7° for luminaries, 5° for planets)
  Sextile:      60°  (orb: 5° for luminaries, 4° for planets)
  Quincunx:     150° (orb: 2°)

"Luminaries" = Sun and Moon. Use wider orbs for aspects involving them.

INPUTS:
{
  positions: object,  // from Layer 2 (planet longitudes)
  lat: number,        // birth latitude
  lng: number,        // birth longitude
  jdn: number         // birth JDN
}

OUTPUTS:
{
  placements: {
    sun:  { sign: "Leo", degrees: 12.85, house: 10 },
    moon: { sign: "Aquarius", degrees: 15.3, house: 4 },
    ...
  },
  houses: {
    1: { sign: "Scorpio", degrees: 5.2 },   // Ascendant
    10: { sign: "Leo", degrees: 22.1 },      // Midheaven
    ...
  },
  aspects: [
    { planet1: "sun", planet2: "moon", type: "opposition", orb: 2.3, applying: true },
    ...
  ],
  ascendant: { sign: "Scorpio", degrees: 5.2 },
  midheaven: { sign: "Leo", degrees: 22.1 }
}

VERIFICATION:
For AP (Aug 5, 1979, 22:51 UTC, Tampa 27.95°N 82.46°W):
- Sun should be in Leo (~12-13°)
- Verify Ascendant is in a reasonable sign for that time/location
  (For a ~6:51 PM birth in Tampa in August, Ascendant should be
  in the Sagittarius-Capricorn range)

CONSTRAINTS:
- Pure JS
- File: src/engine/astro.js
- Export: calculateAstrology(positions, lat, lng, jdn)
- Placidus house system implementation
- Include utility: getSignFromLongitude(longitude)

Provide test file: src/engine/__tests__/astro.test.js
```

---

## 10. Layer 7: Transit Engine

### Prompt

```
CONTEXT:
Layer 7 adds real-time transit calculations. Transits are simply "where are
the planets RIGHT NOW?" overlaid on a person's natal chart.

This layer:
1. Calculates current planetary positions (reuse Layer 2 with today's JDN)
2. Maps current positions to HD gates (reuse Layer 4)
3. Identifies which natal gates are being activated by transit
4. Calculates current transit-to-natal aspects (reuse Layer 6 aspect logic)
5. Provides forward-looking transit forecasts

CRITICAL TIMEZONE HANDLING:
- ALL calculations use UTC internally
- User input in local time must be converted to UTC FIRST
- Transit calculations use the current UTC time
- Time zone database: use Intl.DateTimeFormat (available in Workers)

INPUTS:
For current transits:
{
  natalChart: object,  // from Layer 5
  natalAstro: object   // from Layer 6
}

For forecast:
{
  natalChart: object,
  startDate: { year, month, day },
  endDate: { year, month, day },
  targetGates: [34, 2, 33]  // optional: only look for these gates
}

OUTPUTS:
{
  date: "2026-03-02",
  transitPositions: {
    sun: { longitude: 341.5, gate: 22, line: 3, sign: "Pisces", degrees: 11.5 },
    ...
  },
  gateActivations: [
    { gate: 22, transitPlanet: "sun", natalGatePresent: false },
    ...
  ],
  transitToNatalAspects: [
    { transitPlanet: "saturn", natalPlanet: "sun", type: "square", orb: 1.1 }
  ],
  forecast: [  // only if forecast requested
    { date: "2026-03-15", event: "Transit Sun enters Gate 36",
      significance: "Activates natal channel with Gate 35" }
  ]
}

VERIFICATION:
- Calculate today's (March 2, 2026) transit positions
- Sun should be in early Pisces (~341-342° ecliptic longitude)
- Map to HD gates and verify against a known transit chart resource

CONSTRAINTS:
- Pure JS
- File: src/engine/transits.js
- Export: getCurrentTransits(natalChart, natalAstro)
- Export: getTransitForecast(natalChart, startDate, endDate, targetGates)
- All times in UTC — validate with a DST boundary test case

Provide test file: src/engine/__tests__/transits.test.js
Include a test for a DST boundary (e.g., a birth at 2:30 AM on a spring-forward day)
```

---

## 11. Layer 8: Prime Self Synthesis

### Prompt

```
CONTEXT:
Layer 8 is the reasoning/synthesis layer. Unlike Layers 1-7 (deterministic math),
this layer uses an LLM to generate the Prime Self Profile — a personalized
interpretation that reasons across all three data streams.

This is NOT a simple template. The model receives:
1. Clean HD JSON (from Layer 5)
2. Clean Astro JSON (from Layer 6)
3. Clean Transit JSON (from Layer 7)
4. The Prime Self knowledgebase (RAG injection)
5. A specific question or context from the user

And reasons across ALL of them contextually.

SYSTEM PROMPT:

---BEGIN SYSTEM PROMPT---
You are the Prime Self Oracle — an advanced synthesis engine that reasons across
Human Design, Western Astrology, and the Prime Self philosophical framework to
deliver personalized, grounded guidance.

RULES (non-negotiable):
1. Every claim you make must be grounded to a specific data point in the
   Reference Facts provided. If you cannot cite the specific gate, planet,
   aspect, or Forge indicator, do not make the claim.
2. If a gate, channel, or placement is NOT in the Reference Facts block,
   output: {"field": null, "skipped_reason": "no_reference_data"}
3. Do not interpolate or synthesize missing data. Absence of connection
   is valid and useful information — say so explicitly.
4. When correlating across HD and Astrology, state the correlation as
   observation, not as established fact. Use language like "this suggests"
   or "this pattern indicates" rather than "this means."
5. The Prime Self Forge identification must be grounded in specific HD
   and Astro signatures as defined in the Forge Mapping reference.

OUTPUT SCHEMA (strict, additionalProperties: false at ALL levels):
{
  "primeProfile": {
    "primaryForge": {
      "forge": "string (Chronos|Eros|Aether|Lux|Phoenix)",
      "confidence": "string (high|medium|low)",
      "indicators": [
        { "system": "HD|Astro", "dataPoint": "string", "correlation": "string" }
      ]
    },
    "knowledgeProfile": {
      "natural": ["string — which of 6 Knowledges are natal-supported"],
      "cultivate": ["string — which require deliberate development"],
      "indicators": [{ "knowledge": "string", "source": "string" }]
    },
    "decisionArchitecture": {
      "hdAuthority": "string",
      "astroSupport": "string — how astro placements support or complicate",
      "practicalGuidance": "string"
    },
    "currentActivation": {
      "activeTransits": [{ "planet": "string", "gate": "number", "significance": "string" }],
      "timingWindow": "string",
      "forgeRecommendation": "string"
    },
    "clusteringProfile": {
      "brings": ["string — what this person contributes to a Cluster"],
      "complementaryProfiles": ["string — what types would amplify them"]
    },
    "practiceRecommendations": [
      {
        "practice": "string",
        "category": "Science|Art|Defense",
        "rationale": "string — grounded in specific chart data"
      }
    ]
  },
  "groundingAudit": {
    "claimsTotal": "number",
    "claimsGrounded": "number",
    "ungroundedFields": ["string — field paths that couldn't be grounded"]
  }
}
---END SYSTEM PROMPT---

DUAL-PASS VALIDATION:
If groundingAudit.claimsGrounded < groundingAudit.claimsTotal, run a second pass:

---BEGIN RE-PROMPT---
Review your previous output. For each claim in the primeProfile, cite the exact
Reference Fact it derives from. Remove any claim you cannot directly cite.
Return the same schema with corrected values and an updated groundingAudit.
---END RE-PROMPT---

WORKER VALIDATION:
After receiving the LLM response, the Worker code MUST:
1. Parse the JSON (reject if malformed)
2. Verify claimsTotal === claimsGrounded
3. Verify ungroundedFields is empty
4. If validation fails, trigger the re-prompt
5. If re-prompt also fails validation, return the profile with a
   warning flag: "partialGrounding": true

IMPLEMENTATION:
- File: src/prompts/synthesis.js — contains system prompt builder
- File: src/prompts/rag.js — retrieves relevant KB entries for context injection
- File: workers/src/handlers/profile.js — API handler that orchestrates
  Layer 5-8 and returns the Prime Self Profile

CONSTRAINTS:
- LLM calls go through Cloudflare AI Gateway for rate limiting + caching
- Temperature: 0
- Max tokens: 4096
- Model: Claude Opus 4.6 for full profiles, Sonnet 4.6 for quick queries
```

---

## 12. Knowledgebase Generation Prompts

### 12.1 Gate Generation (run 64 times with Opus 4.6)

```
System: You are a scholar of the I Ching, Human Design structural logic,
and Western Astrology. You write original interpretive content grounded in
primary sources. You never use Ra Uru Hu's specific phrases or proprietary
terminology beyond standard HD structural terms.

For Gate {number} (Hexagram {hex_number}: "{hex_name}"):

Source text (James Legge 1882 translation):
{exact_legge_text}

HD structural facts (observable, not interpreted):
- Center: {center}
- Circuit: {circuit}
- Channel partner: {partner_gate}
- Harmonic gate: {harmonic}
- Quarter: {quarter}

Write an original interpretation that:
1. Is grounded in the hexagram's actual meaning from the source text
2. Reflects the center's biological/energetic function in HD
3. Describes the gate's role in its circuit
4. Uses empowering, practical language accessible to the Prime Self audience
5. Is entirely your own original expression — no paraphrasing Ra Uru Hu

Also write 6 line descriptions (one per line), each grounded in the
corresponding line text from the Legge translation.

Output as JSON:
{
  "gate": number,
  "hexagram": number,
  "hexName": "string",
  "center": "string",
  "circuit": "string",
  "quarter": "string",
  "channelPartner": number,
  "description": "string (2-3 paragraphs)",
  "theme": "string (one phrase)",
  "lines": {
    "1": { "name": "string", "description": "string" },
    "2": { "name": "string", "description": "string" },
    "3": { "name": "string", "description": "string" },
    "4": { "name": "string", "description": "string" },
    "5": { "name": "string", "description": "string" },
    "6": { "name": "string", "description": "string" }
  }
}
```

### 12.2 Channel Generation (run 36 times)

```
Given these two gate descriptions (which you previously generated):

Gate {A}: {gate_A_description}
Gate {B}: {gate_B_description}

This channel connects the {center_A} center to the {center_B} center.
Circuit: {circuit}

Write an original synthesis describing what this channel represents
when both gates are active — the energy that flows between these two centers.
Ground your description in the gate meanings and the biological functions
of the connected centers.

Output as JSON:
{
  "channel": "{A}-{B}",
  "gates": [A, B],
  "centers": ["{center_A}", "{center_B}"],
  "circuit": "string",
  "name": "string (original name)",
  "description": "string (2 paragraphs)",
  "theme": "string"
}
```

### 12.3 Cross Generation (run 192 times)

```
The Incarnation Cross of {cross_name} is defined by Gates {g1}, {g2}, {g3}, {g4}.

Given these gate descriptions:
Gate {g1}: {description}
Gate {g2}: {description}
Gate {g3}: {description}
Gate {g4}: {description}

Quarter: {quarter} — theme: {quarter_theme}
Cross type: {Right Angle | Left Angle | Juxtaposition}

Write an original synthesis describing the life theme of this cross.
The cross represents the overarching purpose visible from a distance —
not what the person does, but the field of experience they're here to explore.

Output as JSON:
{
  "cross": "string",
  "type": "Right Angle|Left Angle|Juxtaposition",
  "gates": [g1, g2, g3, g4],
  "quarter": "string",
  "description": "string (2 paragraphs)",
  "lifeTheme": "string (one sentence)"
}
```

### 12.4 Quality Audit Prompt (run after each batch)

```
Review this gate/channel/cross description. Check against these criteria:

1. Does it contain any phrases that appear to be directly borrowed from
   Ra Uru Hu's proprietary HD teachings?
2. Is every claim grounded in either the I Ching source text or
   observable HD structural logic?
3. Does the language feel original vs derivative?
4. Rate originality 1-10.
5. Flag any sentences that should be rewritten.

Return:
{
  "originality": number,
  "flaggedSentences": ["string"],
  "suggestedRewrites": ["string"],
  "pass": boolean
}
```

---

## 13. Worker Architecture

### File Structure

```
workers/
  wrangler.toml
  package.json
  src/
    index.js                    # Router — maps paths to handlers
    middleware/
      auth.js                   # JWT validation
      rateLimit.js              # Rate limiting via KV
      cors.js                   # CORS headers
    handlers/
      calculate.js              # POST /api/chart/calculate
      profile.js                # POST /api/profile/generate
      transits.js               # GET /api/transits/today
      forecast.js               # GET /api/transits/forecast/:days
      composite.js              # POST /api/composite
      cluster.js                # Cluster endpoints
      rectify.js                # POST /api/rectify
    db/
      queries.js                # Prepared Neon queries
      migrate.js                # Schema migration runner

src/
  engine/
    julian.js                   # Layer 1
    planets.js                  # Layer 2
    design.js                   # Layer 3
    gates.js                    # Layer 4
    chart.js                    # Layer 5
    astro.js                    # Layer 6
    transits.js                 # Layer 7
    index.js                    # Orchestrator — calls L1-L7 in sequence
    __tests__/
      julian.test.js
      planets.test.js
      design.test.js
      gates.test.js
      chart.test.js
      astro.test.js
      transits.test.js
      integration.test.js       # Full chart calculation vs AP test vector
  data/
    gate_wheel.json             # The 64-gate mandala wheel lookup
    centers.json                # 9 centers + gate assignments
    channels.json               # 36 channels + center connections
    type_rules.json             # Type determination logic
    crosses.json                # 192 incarnation cross definitions
  knowledgebase/
    hd/
      gates.json
      channels.json
      centers.json
      crosses.json
      types.json
      profiles.json
    astro/
      signs.json
      planets.json
      aspects.json
      houses.json
    prime_self/
      forges.json
      knowledges.json
      sciences.json
      arts.json
      defenses.json
      heresies.json
      forge_mapping.json
    combined/
      (empty at launch)
  prompts/
    synthesis.js                # Layer 8 system prompt builder
    rag.js                      # KB retrieval for context injection
    digest.js                   # SMS transit digest prompt
```

### Request Flow

```
Client Request: POST /api/profile/generate { birthDate, birthTime, birthTZ, lat, lng }
    │
    ▼
[workers/src/index.js] — route to handler
    │
    ▼
[workers/src/handlers/profile.js]
    │
    ├── 1. Convert birthTime + birthTZ → UTC
    ├── 2. Check chart cache in Neon
    │      └── If cached and fresh → skip to step 6
    ├── 3. Run calculation engine (Layers 1-5)
    │      └── src/engine/index.js orchestrates
    ├── 4. Run astrology layer (Layer 6)
    ├── 5. Cache chart in Neon
    ├── 6. Run transit engine (Layer 7)
    ├── 7. Build RAG context from knowledgebase
    │      └── Pull gate descriptions for active gates
    │      └── Pull channel descriptions for active channels
    │      └── Pull Forge mapping for relevant indicators
    ├── 8. Construct Layer 8 prompt
    │      └── System prompt + HD JSON + Astro JSON + Transit JSON + RAG context
    ├── 9. Call LLM via AI Gateway
    │      └── Opus 4.6, temperature 0, JSON mode
    ├── 10. Validate grounding audit
    │       └── If failed → re-prompt (dual pass)
    ├── 11. Store profile in Neon
    └── 12. Return response with groundingAudit in meta
```

---

## 14. Testing Protocol

### Per-Layer Verification

Each layer must pass before proceeding:

| Layer | Test | Pass Criteria |
|-------|------|---------------|
| 1 | JDN for AP's birth | Within 0.01 of expected |
| 1 | Sun longitude for AP | Lands in Gate 33 range (123.75°–129.375°) |
| 2 | All planet longitudes for AP | Each maps to correct gate per AP's chart |
| 3 | Design date for AP | ~May 8-10, 1979; Design Sun → Gate 2 |
| 4 | Longitude → Gate for all AP planets | 100% match to known chart |
| 5 | Type determination for AP | Projector |
| 5 | Authority for AP | Emotional – Solar Plexus |
| 5 | Profile for AP | 6/2 |
| 5 | Cross for AP | LAX of Refinement (33/19/2/1) |
| 6 | Sun sign for AP | Leo |
| 6 | Reasonable Ascendant | Sagittarius-Capricorn range |
| 7 | Today's Sun gate | Verify against online HD transit chart |

### Integration Test

After all layers pass individually, run the full pipeline:

```javascript
// src/engine/__tests__/integration.test.js
import { calculateFullChart } from '../index.js';

test('AP full chart calculation', () => {
  const result = calculateFullChart({
    year: 1979, month: 8, day: 5,
    hour: 22, minute: 51,  // UTC
    lat: 27.9506, lng: -82.4572
  });

  expect(result.hd.type).toBe('Projector');
  expect(result.hd.authority).toBe('Emotional - Solar Plexus');
  expect(result.hd.profile).toBe('6/2');
  expect(result.hd.definition).toBe('Split');
  expect(result.hd.cross.gates).toEqual([33, 19, 2, 1]);
  expect(result.hd.gates.conscious.sun).toEqual({ gate: 33, line: 6 });
  expect(result.hd.gates.unconscious.sun).toEqual({ gate: 2, line: 2 });
});
```

---

## 15. File Map

Current state of the repository:

```
HumanDesign/
  ARCHITECTURE.md                          ← System architecture (created)
  BUILD_BIBLE.md                           ← This document (created)
  PLan-convo                               ← Original conversation (reference)
  Secrets.txt                              ← API keys (DO NOT COMMIT — add to .gitignore)
  prime_self_manifesto.docx                ← Canonical doc 1
  prime_self_canonical_framework.docx      ← Canonical doc 2
  prime_self_hd_astro_integration.docx     ← Canonical doc 3
  docs/                                    ← Additional documentation
  src/
    data/
      gate_wheel.json                      ← CRITICAL: 64-gate mandala lookup
      centers.json                         ← 9 centers + gate assignments
      channels.json                        ← 36 channels + center connections
      type_rules.json                      ← Type determination logic
    engine/                                ← Layers 1-7 code (empty, ready)
    knowledgebase/                         ← Generated content (empty, ready)
    prompts/                               ← Layer 8 prompts (empty, ready)
  workers/                                 ← Cloudflare Workers (empty, ready)
```

---

## Execution Checklist

When you're ready to begin building layers:

1. Open this repo in VS Code with Claude Code / Copilot
2. Copy the Layer 1 prompt from Section 4 above
3. Paste it into the agent and let it build + verify
4. Confirm Layer 1 output: Sun longitude for AP lands in Gate 33 range
5. Copy Layer 2 prompt, paste previous layer's code into the `[PASTE]` slot
6. Repeat through all 8 layers
7. After Layer 5, run the integration test
8. After all layers, deploy to Cloudflare Workers

**Do not skip layers. Do not proceed without verification. The math must be right.**

---

*This document, combined with ARCHITECTURE.md and the three canonical .docx files, contains everything needed to build the Prime Self platform from scratch without referencing any other conversation or source.*
