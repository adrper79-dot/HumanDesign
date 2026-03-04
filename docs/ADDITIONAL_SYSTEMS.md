# Additional Systems Integration Guide

**How to layer in Numerology, Chinese Astrology, I Ching, Gene Keys, Tarot, and Mayan systems WITHOUT adding any intake fields.**

All calculations use: **birth date, birth time, birth location** (already collected).

---

## 1. Numerology (Pythagorean)

### What You Get
- Life Path Number (1-9, 11, 22, 33)
- Birthday Number (day of month)
- Personal Year/Month/Day (current cycles)
- Tarot Birth Card (derived from Life Path)

### Implementation

**File**: `src/engine/numerology.js`

```javascript
/**
 * Reduce a number to single digit (or master number 11, 22, 33)
 */
function reduceToDigit(num) {
  while (num > 9 && num !== 11 && num !== 22 && num !== 33) {
    num = String(num).split('').reduce((sum, digit) => sum + parseInt(digit), 0);
  }
  return num;
}

/**
 * Calculate Life Path Number from birth date
 * @param {number} year - 4-digit year
 * @param {number} month - 1-12
 * @param {number} day - 1-31
 * @returns {number} Life Path (1-9, 11, 22, 33)
 */
export function lifePathNumber(year, month, day) {
  const yearSum = reduceToDigit(year);
  const monthSum = reduceToDigit(month);
  const daySum = reduceToDigit(day);
  return reduceToDigit(yearSum + monthSum + daySum);
}

/**
 * Birthday Number (just the day of month)
 */
export function birthdayNumber(day) {
  return day;
}

/**
 * Personal Year Number (changes Jan 1)
 */
export function personalYear(birthMonth, birthDay, currentYear) {
  const sum = birthMonth + birthDay + currentYear;
  return reduceToDigit(sum);
}

/**
 * Personal Month Number
 */
export function personalMonth(birthMonth, birthDay, currentYear, currentMonth) {
  const pYear = personalYear(birthMonth, birthDay, currentYear);
  return reduceToDigit(pYear + currentMonth);
}

/**
 * Tarot Birth Card mapping (Life Path → Major Arcana)
 */
const TAROT_MAPPING = {
  1: { card: "The Magician", archetype: "Creator" },
  2: { card: "The High Priestess", archetype: "Intuitive" },
  3: { card: "The Empress", archetype: "Nurturer" },
  4: { card: "The Emperor", archetype: "Builder" },
  5: { card: "The Hierophant", archetype: "Teacher" },
  6: { card: "The Lovers", archetype: "Harmonizer" },
  7: { card: "The Chariot", archetype: "Warrior" },
  8: { card: "Strength", archetype: "Mastery" },
  9: { card: "The Hermit", archetype: "Seeker" },
  11: { card: "Justice", archetype: "Truth-Teller" },
  22: { card: "The Fool", archetype: "Visionary" },
  33: { card: "The World", archetype: "Master Teacher" },
};

export function tarotBirthCard(lifePath) {
  return TAROT_MAPPING[lifePath] || TAROT_MAPPING[9]; // Default to Hermit
}

/**
 * Full numerology profile
 */
export function calculateNumerology(birthDate) {
  const year = birthDate.getFullYear();
  const month = birthDate.getMonth() + 1; // JS months are 0-indexed
  const day = birthDate.getDate();
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const lifePath = lifePathNumber(year, month, day);
  
  return {
    lifePath,
    lifePathName: LIFE_PATH_NAMES[lifePath],
    birthday: birthdayNumber(day),
    personalYear: personalYear(month, day, currentYear),
    personalMonth: personalMonth(month, day, currentYear, currentMonth),
    tarotCard: tarotBirthCard(lifePath),
  };
}

const LIFE_PATH_NAMES = {
  1: "The Leader",
  2: "The Peacemaker",
  3: "The Communicator",
  4: "The Builder",
  5: "The Freedom Seeker",
  6: "The Nurturer",
  7: "The Seeker",
  8: "The Powerhouse",
  9: "The Humanitarian",
  11: "The Visionary",
  22: "The Master Builder",
  33: "The Master Teacher",
};
```

### Knowledge Base

**File**: `src/knowledgebase/numerology/lifePaths.json`

```json
{
  "1": {
    "name": "The Leader",
    "essence": "Independence, innovation, pioneering spirit",
    "gifts": ["Natural leadership", "Originality", "Courage", "Self-reliance"],
    "challenges": ["Impatience", "Ego", "Domination", "Isolation"],
    "career": ["Entrepreneur", "Inventor", "Executive", "Freelancer"],
    "relationships": "Needs independence, struggles with compromise",
    "growth": "Learn to collaborate without losing self"
  },
  "2": {
    "name": "The Peacemaker",
    "essence": "Diplomacy, partnership, intuition, sensitivity",
    "gifts": ["Cooperation", "Empathy", "Mediation", "Detail-oriented"],
    "challenges": ["Over-sensitivity", "Indecision", "Dependency", "Passive-aggression"],
    "career": ["Counselor", "Diplomat", "Teacher", "Artist"],
    "relationships": "Natural partner, needs harmony",
    "growth": "Develop assertiveness and boundaries"
  },
  // ... 3-9, 11, 22, 33
}
```

**File**: `src/knowledgebase/numerology/personalYears.json`

```json
{
  "1": {
    "theme": "New Beginnings",
    "energy": "Initiation, fresh starts, planting seeds",
    "guidance": "This is your year to START new projects. Don't wait for perfection - act on inspiration.",
    "avoid": "Staying stuck in old patterns, waiting for others' permission"
  },
  "2": {
    "theme": "Patience & Partnership",
    "energy": "Gestation, cooperation, details emerging",
    "guidance": "Seeds planted last year are germinating - be patient. Focus on relationships and collaboration.",
    "avoid": "Forcing outcomes, impatience, isolation"
  },
  // ... 3-9
}
```

### Integration into Synthesis

Add to `buildReferenceFactsBlock()`:

```javascript
// In synthesis.js
if (data.numerology) {
  const n = data.numerology;
  sections.push(`\n=== NUMEROLOGY ===`);
  sections.push(`Life Path ${n.lifePath}: ${n.lifePathName}`);
  sections.push(`Birthday Number: ${n.birthday}`);
  sections.push(`Personal Year ${n.personalYear.year}: ${n.personalYear.theme}`);
  sections.push(`Tarot Birth Card: ${n.tarotCard.card} (${n.tarotCard.archetype})`);
}
```

---

## 2. Chinese Astrology (Four Pillars / BaZi)

### What You Get
- Year Pillar (animal + element)
- Month Pillar
- Day Pillar (Day Master)
- Hour Pillar
- Five Elements balance
- Favorable/unfavorable elements

### Implementation

**File**: `src/engine/bazi.js`

```javascript
/**
 * Chinese Astrology Four Pillars Calculator
 */

const ANIMALS = [
  'Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake',
  'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'
];

const HEAVENLY_STEMS = [
  '甲 Yang Wood', '乙 Yin Wood',
  '丙 Yang Fire', '丁 Yin Fire',
  '戊 Yang Earth', '己 Yin Earth',
  '庚 Yang Metal', '辛 Yin Metal',
  '壬 Yang Water', '癸 Yin Water'
];

const EARTHLY_BRANCHES = [
  '子 Rat', '丑 Ox', '寅 Tiger', '卯 Rabbit',
  '辰 Dragon', '巳 Snake', '午 Horse', '未 Goat',
  '申 Monkey', '酉 Rooster', '戌 Dog', '亥 Pig'
];

/**
 * Calculate Chinese New Year date for a given Western year
 * Approximation: between Jan 21 and Feb 20
 */
function chineseNewYearDate(westernYear) {
  // Simplified calculation - for production use a lookup table
  // CNY cycles roughly every 19 years (Metonic cycle)
  const knownCNY = { 2000: new Date(2000, 1, 5) }; // Feb 5, 2000
  
  // Estimate (actual calculation requires lunar calendar library)
  const daysSince = Math.round((westernYear - 2000) * 365.25);
  const lunarYears = Math.round(daysSince / 354); // Lunar year ~354 days
  const offset = lunarYears * 11; // Drift ~11 days/year
  
  const estimated = new Date(westernYear, 0, 25); // Rough estimate: Jan 25
  return estimated;
}

/**
 * Year Pillar (animal + element)
 */
export function yearPillar(birthDate) {
  const year = birthDate.getFullYear();
  const cny = chineseNewYearDate(year);
  
  // If birth is before CNY, use previous year
  const adjustedYear = birthDate < cny ? year - 1 : year;
  
  const stemIndex = (adjustedYear - 4) % 10;
  const branchIndex = (adjustedYear - 4) % 12;
  
  return {
    stem: HEAVENLY_STEMS[stemIndex],
    branch: EARTHLY_BRANCHES[branchIndex],
    animal: ANIMALS[branchIndex],
    element: stemToElement(stemIndex),
  };
}

/**
 * Month Pillar (based on solar terms, not lunar months)
 */
export function monthPillar(birthDate) {
  const month = birthDate.getMonth(); // 0-11
  const year = birthDate.getFullYear();
  
  // Solar month starts ~5th of each month
  const adjustedMonth = birthDate.getDate() < 5 ? month : month + 1;
  
  // Complex calculation - simplified here
  const stemIndex = (year * 12 + adjustedMonth + 2) % 10;
  const branchIndex = (adjustedMonth + 2) % 12;
  
  return {
    stem: HEAVENLY_STEMS[stemIndex],
    branch: EARTHLY_BRANCHES[branchIndex],
    element: stemToElement(stemIndex),
  };
}

/**
 * Day Pillar (Day Master - most important)
 */
export function dayPillar(birthDate) {
  // Requires accurate Julian Day calculation
  const jdn = julianDayNumber(birthDate); // Import from your julian.js
  
  const stemIndex = (jdn - 12) % 10; // 60-day cycle
  const branchIndex = (jdn - 12) % 12;
  
  return {
    stem: HEAVENLY_STEMS[stemIndex],
    branch: EARTHLY_BRANCHES[branchIndex],
    element: stemToElement(stemIndex),
    dayMaster: HEAVENLY_STEMS[stemIndex], // This is the person's "self"
  };
}

/**
 * Hour Pillar
 */
export function hourPillar(birthDate) {
  const hour24 = birthDate.getHours();
  
  // Chinese hours are 2-hour blocks
  const hourBranch = Math.floor((hour24 + 1) / 2) % 12;
  
  // Hour stem depends on day stem (complex lookup)
  const dayStem = dayPillar(birthDate).stem;
  const hourStem = calculateHourStem(dayStem, hourBranch); // Helper function
  
  return {
    stem: HEAVENLY_STEMS[hourStem],
    branch: EARTHLY_BRANCHES[hourBranch],
    element: stemToElement(hourStem),
  };
}

/**
 * Five Elements balance
 */
export function fiveElementsBalance(yearP, monthP, dayP, hourP) {
  const elements = {
    Wood: 0,
    Fire: 0,
    Earth: 0,
    Metal: 0,
    Water: 0,
  };
  
  // Count elements from all four pillars (stems + branches)
  [yearP, monthP, dayP, hourP].forEach(pillar => {
    elements[pillar.element.split(' ')[1]]++; // Extract element from "Yang Wood"
  });
  
  // Determine strongest/weakest
  const total = Object.values(elements).reduce((a, b) => a + b, 0);
  const percentages = {};
  for (const [elem, count] of Object.entries(elements)) {
    percentages[elem] = Math.round((count / total) * 100);
  }
  
  return {
    counts: elements,
    percentages,
    strongest: Object.keys(elements).reduce((a, b) => elements[a] > elements[b] ? a : b),
    weakest: Object.keys(elements).reduce((a, b) => elements[a] < elements[b] ? a : b),
  };
}

/**
 * Helper: Stem index to element
 */
function stemToElement(stemIndex) {
  const elems = ['Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth', 'Metal', 'Metal', 'Water', 'Water'];
  const yinYang = stemIndex % 2 === 0 ? 'Yang' : 'Yin';
  return `${yinYang} ${elems[stemIndex]}`;
}

/**
 * Full BaZi chart
 */
export function calculateBaZi(birthDate) {
  const year = yearPillar(birthDate);
  const month = monthPillar(birthDate);
  const day = dayPillar(birthDate);
  const hour = hourPillar(birthDate);
  const balance = fiveElementsBalance(year, month, day, hour);
  
  return {
    year,
    month,
    day, // Day Master = person's "self"
    hour,
    balance,
    favorableElements: calculateFavorableElements(day.element, balance),
  };
}

function calculateFavorableElements(dayMaster, balance) {
  // Simplified: if element is too strong, need controlling element
  // If too weak, need producing element
  // Complex rules - this is just a stub
  
  const elem = dayMaster.split(' ')[1]; // "Yang Wood" → "Wood"
  
  // Production cycle: Wood→Fire→Earth→Metal→Water→Wood
  // Control cycle: Wood→Earth, Earth→Water, Water→Fire, Fire→Metal, Metal→Wood
  
  if (balance.percentages[elem] > 40) {
    return ["Control cycle elements needed"];
  } else if (balance.percentages[elem] < 15) {
    return ["Production cycle elements needed"];
  }
  return ["Balanced"];
}
```

**Note**: Accurate BaZi requires complex solar term calculations. Recommend using an existing library like `bazi` (npm) or `chinese-calendar` and wrapping it.

### Knowledge Base

**File**: `src/knowledgebase/bazi/animals.json`

```json
{
  "Rat": {
    "traits": ["Clever", "Quick-witted", "Resourceful", "Versatile"],
    "strengths": "Adaptability, charm, creativity",
    "challenges": "Restlessness, tendency to hoard, trust issues",
    "career": ["Writer", "Critic", "Entrepreneur", "Lawyer"],
    "compatibility": "Best: Dragon, Monkey, Ox | Challenging: Horse, Rooster"
  },
  "Ox": {
    "traits": ["Diligent", "Dependable", "Strong", "Determined"],
    "strengths": "Reliability, patience, methodical approach",
    "challenges": "Stubbornness, rigidity, slow to adapt",
    "career": ["Engineer", "Accountant", "Surgeon", "Farmer"],
    "compatibility": "Best: Rat, Snake, Rooster | Challenging: Goat, Horse"
  },
  // ... all 12 animals
}
```

---

## 3. I Ching Hexagram Focus

**You already have this!** Each HD Gate = I Ching Hexagram.

### Implementation

**File**: `src/knowledgebase/iching/hexagrams.json`

Extract hexagram data from existing `gates.json` or use public domain translations:

```json
{
  "46": {
    "number": 46,
    "chineseName": "升",
    "englishName": "Pushing Upward / Ascending",
    "trigrams": {
      "upper": "Earth (坤)",
      "lower": "Wood (巽)"
    },
    "judgment": "PUSHING UPWARD has supreme success. One must see the great man. Fear not. Departure toward the south brings good fortune.",
    "image": "Within the earth, wood grows: the image of PUSHING UPWARD. Thus the superior man of devoted character heaps up small things in order to achieve something high and great.",
    "lines": {
      "1": {
        "text": "Pushing upward that meets with confidence brings great good fortune.",
        "interpretation": "Confidence in the process of ascent. Even small steps taken with trust compound into significant progress."
      },
      "2": {
        "text": "If one is sincere, it furthers one to bring even a small offering. No blame.",
        "interpretation": "Sincerity matters more than scale. Humble offerings given genuinely are accepted."
      },
      // ... lines 3-6
    },
    "wisdom": "Like a tree growing toward heaven, your progress is natural, persistent, and incremental. Do not force rapid advancement. Trust the organic process of growth through small, consistent efforts.",
    "shadow": "Impatience, forcing outcomes, comparing yourself to others' speed",
    "gift": "Patient persistence, trust in process, compounding growth"
  }
}
```

**Sources** (Public Domain):
- James Legge translation (1882)
- Richard Wilhelm (pre-1928 editions)

### User-Facing Output

```markdown
## YOUR I CHING CORE PATTERNS

**Primary Hexagram 46: Pushing Upward (升)**

*"The tree grows toward heaven through persistent, patient effort."*

**Ancient Wisdom**:
Within the earth, wood grows naturally upward. This is your pattern - advancement 
through steady, organic growth rather than forcing outcomes.

**Your Line: Line 1 - Confidence in Pushing Upward**
You advance through trust in the process, even when you can't see the summit yet. 
Your growth is like roots deepening before the shoot breaks ground. Small 
consistent steps compound into major transformation.

**Shadow**: Impatience, comparing your timeline to others, needing visible results immediately  
**Gift**: Patient persistence, deep trust in process, compounding growth over time

**How to Work With This**:
• Focus on daily habits, not dramatic leaps
• Trust that underground work (learning, practicing) will eventually show fruit
• When you feel "behind," remember: the tree doesn't rush
```

---

## 4. Gene Keys Integration

### What You Get
- Shadow → Gift → Siddhi spectrum for each active key
- Life's Work, Evolution, Radiance, Purpose (4 prime keys)
- Venus Sequence, Pearl Sequence (advanced)

**Advantage**: Less IP restricted than HD, more poetic/spiritual language.

### Implementation

**File**: `src/knowledgebase/genekeys/keys.json`

```json
{
  "46": {
    "name": "Seriousness / Delight / Ecstasy",
    "shadow": "Seriousness",
    "gift": "Delight",
    "siddhi": "Ecstasy",
    "archetype": "The Ascender",
    "message": "Life is meant to be enjoyed, not endured",
    "shadowDescription": "Trapped in heavy responsibility, forgetting joy in the journey. Life becomes a burden to shoulder rather than an adventure to savor.",
    "giftDescription": "Finding genuine delight in the process of growth itself. The climb becomes the reward. You discover pleasure in each small step upward.",
    "siddhiDescription": "Complete surrender to the upward flow of life. Existence becomes perpetual ecstasy - not because circumstances are perfect, but because you're fully aligned with your ascent.",
    "contemplation": "What if the point of your ambition isn't the summit, but the aliveness you feel while climbing?"
  },
  // ... all 64 Gene Keys
}
```

**Source**: Compile from Richard Rudd's Gene Keys book + synthesis. His framework is well-documented and he encourages derivative works.

### User-Facing Output

```markdown
## YOUR GENE KEY PATH

**Life's Work: Gene Key 46 - Seriousness → Delight → Ecstasy**

**Shadow: SERIOUSNESS**
Getting trapped in heavy responsibility, forgetting joy in the journey. Your 
ambition becomes a weight instead of a thrill.

**Gift: DELIGHT**
Finding genuine pleasure in the process of growth itself. The climb becomes the 
reward, not just reaching the top.

**Siddhi: ECSTASY**  
Complete surrender to the upward flow of life. You're so aligned with your path 
that existence itself becomes joyful.

**This Month's Contemplation**:
"What if the point of your goals isn't achieving them, but who you become while 
climbing toward them?"
```

---

## 5. Tarot Birth Cards

Already covered in Numerology section - just a lookup table based on Life Path Number.

---

## 6. Mayan Astrology (Tzolkin / Dreamspell)

### What You Get
- Galactic Signature (Kin 1-260)
- Solar Seal (20 archetypes)
- Galactic Tone (1-13 frequencies)
- Power Animal, Chakra, Action

### Implementation

**File**: `src/engine/mayan.js`

```javascript
/**
 * Mayan Tzolkin (260-day sacred calendar) calculator
 */

const SOLAR_SEALS = [
  'Red Dragon', 'White Wind', 'Blue Night', 'Yellow Seed', 'Red Serpent',
  'White World-Bridger', 'Blue Hand', 'Yellow Star', 'Red Moon', 'White Dog',
  'Blue Monkey', 'Yellow Human', 'Red Skywalker', 'White Wizard', 'Blue Eagle',
  'Yellow Warrior', 'Red Earth', 'White Mirror', 'Blue Storm', 'Yellow Sun'
];

const GALACTIC_TONES = [
  'Magnetic', 'Lunar', 'Electric', 'Self-Existing', 'Overtone',
  'Rhythmic', 'Resonant', 'Galactic', 'Solar', 'Planetary',
  'Spectral', 'Crystal', 'Cosmic'
];

/**
 * Calculate Kin number (1-260) from Julian Day Number
 * Dreamspell correlation: July 26, 1987 = Kin 34 (White Galactic Wizard)
 */
export function calculateKin(birthDate) {
  const jdn = julianDayNumber(birthDate); // From your julian.js
  
  // Dreamspell epoch: July 26, 1987 (JDN 2447032) = Kin 34
  const dreamspellEpoch = 2447032;
  const epochKin = 34;
  
  const daysSinceEpoch = jdn - dreamspellEpoch;
  const rawKin = (epochKin + daysSinceEpoch - 1) % 260 + 1;
  const kin = rawKin <= 0 ? rawKin + 260 : rawKin;
  
  return kin;
}

/**
 * Extract Seal and Tone from Kin
 */
export function kinComponents(kin) {
  const seal = SOLAR_SEALS[(kin - 1) % 20];
  const tone = GALACTIC_TONES[(kin - 1) % 13];
  const toneNumber = ((kin - 1) % 13) + 1;
  
  return { kin, seal, tone, toneNumber };
}

/**
 * Full Mayan profile
 */
export function calculateMayan(birthDate) {
  const kin = calculateKin(birthDate);
  const { seal, tone, toneNumber } = kinComponents(kin);
  
  return {
    kin,
    seal,
    tone,
    toneNumber,
    wavespell: Math.floor((kin - 1) / 13) + 1, // 1-20 (which wavespell)
    signature: `${tone} ${seal}`,
  };
}
```

### Knowledge Base

**File**: `src/knowledgebase/mayan/seals.json`

```json
{
  "White Mirror": {
    "element": "Wind",
    "action": "Reflects",
    "power": "Endlessness",
    "essence": "Order",
    "archetype": "The Mirror",
    "chakra": "Crown",
    "powerAnimal": "Owl",
    "description": "You reflect back what others cannot see in themselves. Your gift is showing people their true nature through perfect mirroring.",
    "challenge": "Not getting lost in reflection without action. Mirrors receive but don't initiate."
  }
}
```

---

## 7. Vedic Astrology (Sidereal Zodiac)

### What You Get
- Sidereal Sun/Moon/Ascendant signs
- Nakshatra (lunar mansion) for Moon
- Vedic house placements
- Dasha periods (planetary periods)

### Implementation

**File**: `src/engine/vedic.js`

```javascript
/**
 * Convert tropical longitude to sidereal (Vedic)
 */
export function tropicalToSidereal(tropicalDegrees, year) {
  const ayanamsa = calculateAyanamsa(year);
  const sidereal = (tropicalDegrees - ayanamsa + 360) % 360;
  return sidereal;
}

/**
 * Calculate Lahiri Ayanamsa (most common)
 * Ayanamsa = ~24° in 2026, increases ~50" per year
 */
function calculateAyanamsa(year) {
  // Simplified formula (for accuracy use Swiss Ephemeris)
  const baseYear = 2000;
  const baseAyanamsa = 23.85; // degrees at year 2000
  const yearlyIncrease = 0.0139; // ~50 arcseconds/year
  
  return baseAyanamsa + (year - baseYear) * yearlyIncrease;
}

/**
 * Nakshatra (lunar mansion) from Moon's sidereal longitude
 */
const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
];

export function nakshatra(siderealMoonLongitude) {
  // Each nakshatra is 13.333° (360° / 27)
  const index = Math.floor(siderealMoonLongitude / 13.333);
  const pada = Math.floor((siderealMoonLongitude % 13.333) / 3.333) + 1; // 1-4
  
  return {
    name: NAKSHATRAS[index],
    pada,
    ruler: nakshatraRuler(index),
  };
}

function nakshatraRuler(index) {
  const rulers = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
  return rulers[index % 9];
}
```

---

## Summary: Zero-Intake Expansion

| System | Uses | Adds to Profile |
|--------|------|-----------------|
| **Numerology** | Birth date | Life Path, Personal Year, Tarot Birth Card |
| **Chinese Astrology** | Date/time | Year/Month/Day/Hour Pillars, Five Elements |
| **I Ching** | Already have (gates) | Hexagram wisdom, line interpretations |
| **Gene Keys** | Same as HD gates | Shadow/Gift/Siddhi spectrum |
| **Tarot** | Derived from numerology | Birth Card archetype |
| **Mayan** | Birth date | Galactic Signature (Kin), Solar Seal, Tone |
| **Vedic** | Already have positions | Sidereal signs, Nakshatras |

**Total new intake fields required**: **ZERO**

All systems derive from: `birthDate`, `birthTime`, `birthLocation` (already collected).

---

## Implementation Priority

**Phase 1** (Quick wins - 1 week):
1. Numerology ✓ (simple math)
2. I Ching rebranding ✓ (already have data)
3. Gene Keys layer ✓ (reframe existing gates)

**Phase 2** (Medium effort - 2 weeks):
4. Tarot Birth Cards ✓ (lookup table)
5. Vedic/Sidereal ✓ (simple coordinate shift)

**Phase 3** (Heavier lift - 3-4 weeks):
6. Chinese BaZi ✓ (complex calendar math - use library)
7. Mayan Tzolkin ✓ (260-day cycle calculations)

**Phase 4** (Advanced):
8. Dasha periods (Vedic), progressed charts, solar returns

---

## Final Output Structure

```
┌─ QUICK START GUIDE (Prime Self branding)
├─ GENE KEYS PROFILE (Shadow/Gift/Siddhi - replaces HD terminology)
├─ I CHING WISDOM (Hexagram interpretations)
├─ NUMEROLOGY CODES (Life Path, Personal Year, Tarot)
├─ CHINESE ASTROLOGY (Four Pillars, Elements)
├─ MAYAN SIGNATURE (Kin, Seal, Tone)
├─ VEDIC INSIGHTS (Sidereal positions, Nakshatras)
└─ TECHNICAL CHART (HD data - practitioners only, separate page)
```

Users get a **rich, multi-layered profile** from ONE set of intake data.
