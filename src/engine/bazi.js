/**
 * BaZi (Four Pillars of Destiny) Engine — Chinese Astrology
 *
 * Computes the Four Pillars (Year, Month, Day, Hour) from birth data.
 * Each Pillar contains a Heavenly Stem (天干, Tiān Gān) and an Earthly Branch
 * (地支, Dì Zhī), together forming the Sexagenary Cycle (干支, Gān Zhī) of 60
 * unique combinations.
 *
 * Calendar system:
 *   - Year Pillar: changes at Lì Chūn (立春, ~Feb 4), NOT Chinese New Year
 *   - Month Pillar: determined by 12 solar terms (節氣, Jié Qì), one per month
 *   - Day Pillar: 60-day sexagenary cycle calibrated from a known reference date
 *   - Hour Pillar: 12 double-hours (時辰, Shí Chén) covering 2 hours each
 *
 * Five Elements (五行, Wǔ Xíng): Wood, Fire, Earth, Metal, Water
 * Each Stem and Branch carries an elemental nature; the balance of elements
 * across the Four Pillars shapes character, health tendencies, and life themes.
 *
 * Reference:
 *   Evelyn Lip, "The Fundamentals of Chinese Astrology" (1992);
 *   Joey Yap, "BaZi — The Destiny Code" (2006);
 *   Traditional Ganzhi system as documented in the Chinese Imperial almanac (萬年曆)
 *
 * No additional intake data required — birth year, month, day, and hour (UTC).
 *
 * @module bazi
 */

// ─── HEAVENLY STEMS (天干) ───────────────────────────────────────
const STEMS = [
  { key: 'jia',  chinese: '甲', name: 'Jiǎ', element: 'yang_wood',  elementDisplay: 'Yang Wood'  },
  { key: 'yi',   chinese: '乙', name: 'Yǐ',  element: 'yin_wood',   elementDisplay: 'Yin Wood'   },
  { key: 'bing', chinese: '丙', name: 'Bǐng',element: 'yang_fire',  elementDisplay: 'Yang Fire'  },
  { key: 'ding', chinese: '丁', name: 'Dīng',element: 'yin_fire',   elementDisplay: 'Yin Fire'   },
  { key: 'wu',   chinese: '戊', name: 'Wù',  element: 'yang_earth', elementDisplay: 'Yang Earth' },
  { key: 'ji',   chinese: '己', name: 'Jǐ',  element: 'yin_earth',  elementDisplay: 'Yin Earth'  },
  { key: 'geng', chinese: '庚', name: 'Gēng',element: 'yang_metal', elementDisplay: 'Yang Metal' },
  { key: 'xin',  chinese: '辛', name: 'Xīn', element: 'yin_metal',  elementDisplay: 'Yin Metal'  },
  { key: 'ren',  chinese: '壬', name: 'Rén', element: 'yang_water', elementDisplay: 'Yang Water' },
  { key: 'gui',  chinese: '癸', name: 'Guǐ', element: 'yin_water',  elementDisplay: 'Yin Water'  },
];

// ─── EARTHLY BRANCHES (地支) ─────────────────────────────────────
const BRANCHES = [
  { key: 'zi',        chinese: '子', name: 'Zǐ',   animal: 'Rat',    element: 'yang_water',  elementDisplay: 'Water'  },
  { key: 'chou',      chinese: '丑', name: 'Chǒu', animal: 'Ox',     element: 'yin_earth',   elementDisplay: 'Earth'  },
  { key: 'yin',       chinese: '寅', name: 'Yín',  animal: 'Tiger',  element: 'yang_wood',   elementDisplay: 'Wood'   },
  { key: 'mao',       chinese: '卯', name: 'Mǎo',  animal: 'Rabbit', element: 'yin_wood',    elementDisplay: 'Wood'   },
  { key: 'chen',      chinese: '辰', name: 'Chén', animal: 'Dragon', element: 'yang_earth',  elementDisplay: 'Earth'  },
  { key: 'si',        chinese: '巳', name: 'Sì',   animal: 'Snake',  element: 'yin_fire',    elementDisplay: 'Fire'   },
  { key: 'wu_horse',  chinese: '午', name: 'Wǔ',   animal: 'Horse',  element: 'yang_fire',   elementDisplay: 'Fire'   },
  { key: 'wei',       chinese: '未', name: 'Wèi',  animal: 'Goat',   element: 'yin_earth',   elementDisplay: 'Earth'  },
  { key: 'shen',      chinese: '申', name: 'Shēn', animal: 'Monkey', element: 'yang_metal',  elementDisplay: 'Metal'  },
  { key: 'you',       chinese: '酉', name: 'Yǒu',  animal: 'Rooster',element: 'yin_metal',   elementDisplay: 'Metal'  },
  { key: 'xu',        chinese: '戌', name: 'Xū',   animal: 'Dog',    element: 'yang_earth',  elementDisplay: 'Earth'  },
  { key: 'hai',       chinese: '亥', name: 'Hài',  animal: 'Pig',    element: 'yin_water',   elementDisplay: 'Water'  },
];

// ─── MONTH STEMS TABLE ───────────────────────────────────────────
// Month stem index = MONTH_STEM_OFFSET[yearStemIndex % 5] + (monthBranchIndex - 2 + 12) % 12
// Where monthBranchIndex: Yin (Tiger, index 2) = first solar month
// Offsets map year stem group → starting stem for Yin month
//   Group 0 (Jia=0, Ji=5)  → Bing (2)
//   Group 1 (Yi=1, Geng=6) → Wù (4)
//   Group 2 (Bing=2,Xin=7) → Gēng (6)
//   Group 3 (Ding=3,Ren=8) → Rén (8)
//   Group 4 (Wu=4, Gui=9)  → Jiǎ (0)
const MONTH_STEM_BASE = [2, 4, 6, 8, 0];

// ─── SOLAR TERM MONTH BOUNDARIES ────────────────────────────────
// Approximate Gregorian date for the start of each Chinese solar month.
// Format: [month(1-12), day]: start of new Chinese month branch
// Yin (Tiger, branch index 2) starts at Lì Chūn (~Feb 4)
// These are fixed approximations accurate to ±1-2 days for most years.
const SOLAR_TERMS = [
  { month: 1,  day:  6, branchIndex: 1  }, // Xiǎo Hán → Chǒu (Ox)
  { month: 2,  day:  4, branchIndex: 2  }, // Lì Chūn  → Yín (Tiger) — also year change
  { month: 3,  day:  6, branchIndex: 3  }, // Jīng Zhé → Mǎo (Rabbit)
  { month: 4,  day:  5, branchIndex: 4  }, // Qīng Míng → Chén (Dragon)
  { month: 5,  day:  6, branchIndex: 5  }, // Lì Xià   → Sì (Snake)
  { month: 6,  day:  6, branchIndex: 6  }, // Máng Zhòng → Wǔ (Horse)
  { month: 7,  day:  7, branchIndex: 7  }, // Xiǎo Shǔ → Wèi (Goat)
  { month: 8,  day:  7, branchIndex: 8  }, // Lì Qiū   → Shēn (Monkey)
  { month: 9,  day:  8, branchIndex: 9  }, // Bái Lù   → Yǒu (Rooster)
  { month: 10, day:  8, branchIndex: 10 }, // Hán Lù   → Xū (Dog)
  { month: 11, day:  7, branchIndex: 11 }, // Lì Dōng  → Hài (Pig)
  { month: 12, day:  7, branchIndex: 0  }, // Dà Xuě   → Zǐ (Rat)
];

// ─── DAY PILLAR CALIBRATION ──────────────────────────────────────
// Calibration anchored to a known Jiǎ-Zǐ (甲子) day:
//   Dec 29, 1999 (Gregorian) = Jiǎ-Zǐ day (Stem 0, Branch 0)
//   JDN at noon = 2451542
const DAY_CALIBRATION_JDN  = 2451542; // Dec 29, 1999 = Jia-Zi (stem=0, branch=0)
// Verification: Jan 1, 2000 = JDN 2451545 → (2451545 - 2451542) % 10 = 3 (Ding), % 12 = 3 (Mao) = 丁卯 ✓

// ─── FIVE ELEMENTS DISPLAY ───────────────────────────────────────
const ELEMENT_DISPLAY = {
  yang_wood: 'Yang Wood (甲乙)',
  yin_wood:  'Yin Wood (甲乙)',
  yang_fire: 'Yang Fire (丙丁)',
  yin_fire:  'Yin Fire (丙丁)',
  yang_earth:'Yang Earth (戊己)',
  yin_earth: 'Yin Earth (戊己)',
  yang_metal:'Yang Metal (庚辛)',
  yin_metal: 'Yin Metal (庚辛)',
  yang_water:'Yang Water (壬癸)',
  yin_water: 'Yin Water (壬癸)',
};

const BASE_ELEMENT = {
  yang_wood: 'Wood', yin_wood: 'Wood',
  yang_fire: 'Fire', yin_fire: 'Fire',
  yang_earth:'Earth',yin_earth:'Earth',
  yang_metal:'Metal',yin_metal:'Metal',
  yang_water:'Water',yin_water:'Water',
};

// ─── HELPERS ─────────────────────────────────────────────────────

function mod(n, m) {
  return ((n % m) + m) % m;
}

/**
 * Determine which solar month (Chinese) a birth date falls in.
 * Returns the Earthly Branch index (0–11) for the current Chinese solar month.
 *
 * @param {number} month – Gregorian birth month (1-12)
 * @param {number} day   – Gregorian birth day (1-31)
 * @returns {number} Branch index 0–11
 */
function getMonthBranchIndex(month, day) {
  // Scan solar terms in reverse order: first term whose month/day ≤ birth date wins
  let result = 1; // default: Chou (Ox, Dec–Jan period)
  for (let i = SOLAR_TERMS.length - 1; i >= 0; i--) {
    const t = SOLAR_TERMS[i];
    const birthMMDD = month * 100 + day;
    const termMMDD  = t.month * 100 + t.day;
    if (birthMMDD >= termMMDD) {
      result = t.branchIndex;
      break;
    }
  }
  return result;
}

/**
 * Build a Pillar object from stem index and branch index.
 */
function buildPillar(stemIdx, branchIdx) {
  const stem   = STEMS[stemIdx];
  const branch = BRANCHES[branchIdx];
  return {
    stem: {
      index:   stemIdx,
      key:     stem.key,
      chinese: stem.chinese,
      name:    stem.name,
      element: stem.element,
      elementDisplay: stem.elementDisplay,
    },
    branch: {
      index:   branchIdx,
      key:     branch.key,
      chinese: branch.chinese,
      name:    branch.name,
      animal:  branch.animal,
      element: branch.element,
      elementDisplay: branch.elementDisplay,
    },
    display: `${stem.name}-${branch.name}`,
    chinese: `${stem.chinese}${branch.chinese}`,
  };
}

// ─── FOUR PILLARS CALCULATORS ────────────────────────────────────

/**
 * Year Pillar
 * The "BaZi year" changes at Lì Chūn (≈ Feb 4), not on Chinese New Year.
 * For simplicity we use Feb 4 as a fixed boundary.
 *
 * @param {number} year  – Gregorian year
 * @param {number} month – Gregorian month (1-12)
 * @param {number} day   – Gregorian day
 * @returns {object} Year Pillar
 */
function yearPillar(year, month, day) {
  // Adjust year for Lì Chūn: if Jan 1 – Feb 3, use previous solar year
  let solarYear = year;
  if (month < 2 || (month === 2 && day < 4)) {
    solarYear = year - 1;
  }
  // Year stem: (year - 4) % 10 (Jia=0)
  // Year branch: (year - 4) % 12 (Rat=0)
  const stemIdx   = mod(solarYear - 4, 10);
  const branchIdx = mod(solarYear - 4, 12);
  return buildPillar(stemIdx, branchIdx);
}

/**
 * Month Pillar
 * Determined by Chinese solar month (solar term boundaries).
 * Month stem cycles depend on the year stem.
 *
 * @param {number} year  – Gregorian year
 * @param {number} month – Gregorian month (1-12)
 * @param {number} day   – Gregorian day
 * @returns {object} Month Pillar
 */
function monthPillar(year, month, day) {
  const yPillar      = yearPillar(year, month, day);
  const yearStemIdx  = yPillar.stem.index;
  const branchIdx    = getMonthBranchIndex(month, day);

  // Month stem: depends on year stem group
  // Yin month (branch 2 = Tiger = first month) starts at MONTH_STEM_BASE[yearStemIdx % 5]
  const baseStem   = MONTH_STEM_BASE[yearStemIdx % 5];
  // Each subsequent branch adds one to the stem (cycling mod 10)
  const monthOffset = mod(branchIdx - 2, 12); // offset from Tiger month (index 2)
  const stemIdx    = mod(baseStem + monthOffset, 10);

  return buildPillar(stemIdx, branchIdx);
}

/**
 * Day Pillar
 * Uses the 60-day sexagenary cycle anchored to Dec 29, 1999 = Jia-Zi.
 *
 * @param {number} jdn – Julian Day Number (fractional; rounded to integer noon day)
 * @returns {object} Day Pillar
 */
function dayPillar(jdn) {
  const dayOffset = Math.round(jdn) - DAY_CALIBRATION_JDN;
  const stemIdx   = mod(dayOffset, 10);
  const branchIdx = mod(dayOffset, 12);
  return buildPillar(stemIdx, branchIdx);
}

/**
 * Hour Pillar
 * 12 double-hours: Zi (23:00-00:59), Chou (01:00-02:59), ..., Hai (21:00-22:59)
 * Hour stem depends on day stem (same pattern as month stem on year stem).
 *
 * @param {number} hour     – Birth hour 0-23 (UTC)
 * @param {number} dayStemIdx – Day Pillar stem index
 * @returns {object} Hour Pillar
 */
function hourPillar(hour, dayStemIdx) {
  // Zi (Rat) hour: 23:00-00:59 → branchIndex 0
  // Map: 23 → 0, 1 → 1, 3 → 2, ... using (hour+1)/2 % 12
  const branchIdx = hour === 23 ? 0 : Math.floor((hour + 1) / 2) % 12;
  // Hour stem follows same formula as month stem: depends on day stem group
  const baseStem  = MONTH_STEM_BASE[dayStemIdx % 5];
  const stemIdx   = mod(baseStem + branchIdx, 10);
  return buildPillar(stemIdx, branchIdx);
}

// ─── ELEMENT BALANCE ─────────────────────────────────────────────

/**
 * Count element occurrences across all four pillars (8 stem+branch positions).
 * Returns { Wood: n, Fire: n, Earth: n, Metal: n, Water: n }
 */
function countElements(pillars) {
  const counts = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  for (const pillar of pillars) {
    counts[BASE_ELEMENT[pillar.stem.element]]++;
    counts[BASE_ELEMENT[pillar.branch.element]]++;
  }
  return counts;
}

/**
 * Identify the dominant element (most frequent) and lacking element (least frequent).
 */
function elementBalance(pillars) {
  const counts      = countElements(pillars);
  const sorted      = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const dominant    = sorted[0][0];
  const lacking     = sorted[sorted.length - 1][0];
  return { counts, dominant, lacking };
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────

/**
 * Calculate the complete Four Pillars (BaZi) chart from birth data.
 *
 * @param {number} year  – Birth year (Gregorian)
 * @param {number} month – Birth month 1-12
 * @param {number} day   – Birth day 1-31
 * @param {number} hour  – Birth hour 0-23 (UTC)
 * @param {number} jdn   – Julian Day Number (from Layer 1)
 * @returns {object} Four Pillars profile
 */
export function calculateBazi(year, month, day, hour, jdn) {
  try {
    const yearP   = yearPillar(year, month, day);
    const monthP  = monthPillar(year, month, day);
    const dayP    = dayPillar(jdn);
    const hourP   = hourPillar(hour, dayP.stem.index);
    const pillars = [yearP, monthP, dayP, hourP];
    const balance = elementBalance(pillars);

    // Day Master (日元, Rì Yuán): the Day Pillar stem defines the person's core nature
    const dayMaster = dayP.stem;

    return {
      yearPillar:  yearP,
      monthPillar: monthP,
      dayPillar:   dayP,
      hourPillar:  hourP,
      dayMaster: {
        key:     dayMaster.key,
        chinese: dayMaster.chinese,
        name:    dayMaster.name,
        element: dayMaster.element,
        elementDisplay: dayMaster.elementDisplay,
      },
      elementBalance: balance,
      chartDisplay: `${yearP.chinese} ${monthP.chinese} ${dayP.chinese} ${hourP.chinese}`,
    };
  } catch (err) {
    return { error: err.message };
  }
}
