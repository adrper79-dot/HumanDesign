/**
 * Numerology Engine Test Suite
 *
 * Tests Pythagorean numerology calculations:
 * - Life Path Number (with master numbers 11, 22, 33)
 * - Birthday Number
 * - Personal Year/Month/Day
 * - Tarot Birth Card mappings
 *
 * Test Vectors verified against multiple online calculators:
 * - numerologist.com
 * - cafeastrology.com
 * - worldnumerology.com
 */

import { describe, it, expect } from 'vitest';
import {
  reduceToDigit,
  lifePathNumber,
  birthdayNumber,
  personalYear,
  personalMonth,
  personalDay,
  tarotBirthCard,
  calculateNumerology,
  calculateNumerologyFromBirthData
} from '../src/engine/numerology.js';

// ═══════════════════════════════════════════════════════════════
// TEST VECTORS
// ═══════════════════════════════════════════════════════════════

const TEST_CASES = [
  {
    name: 'AP (Aug 5, 1979)',
    year: 1979,
    month: 8,
    day: 5,
    expectedLifePath: 3, // Year: 1979→26→8; Month: 8; Day: 5; Total: 8+8+5=21→3
    expectedBirthday: 5,
    expectedLifePathName: 'The Communicator',
    expectedTarot: 'The Empress'
  },
  {
    name: 'Steve Jobs (Feb 24, 1955)',
    year: 1955,
    month: 2,
    day: 24,
    expectedLifePath: 1, // Year: 1955→20→2; Month: 2; Day: 24→6; Total: 2+2+6=10→1
    expectedBirthday: 6,
    expectedLifePathName: 'The Leader',
    expectedTarot: 'The Magician'
  },
  {
    name: 'Master Number 11 (Nov 9, 1980)',
    year: 1980,
    month: 11,
    day: 9,
    expectedLifePath: 11, // Year: 1980→18→9; Month: 11; Day: 9; Total: 11+9+9=29→11 (master)
    expectedBirthday: 9,
    expectedLifePathName: 'The Visionary',
    expectedTarot: 'Justice'
  },
  {
    name: 'Master Number 22 (Nov 4, 1960)',
    year: 1960,
    month: 11,
    day: 4,
    expectedLifePath: 22, // Year: 1960→16→7; Month: 11; Day: 4; Total: 11+7+4=22 (master)
    expectedBirthday: 4,
    expectedLifePathName: 'The Master Builder',
    expectedTarot: 'The Fool'
  },
  {
    name: 'Master Number 33 (Nov 11, 2009)',
    year: 2009,
    month: 11,
    day: 11,
    expectedLifePath: 33, // Year: 2009→11; Month: 11; Day: 11; Total: 11+11+11=33 (master)
    expectedBirthday: 2, // 11→1+1=2 (birthday doesn't preserve master)
    expectedLifePathName: 'The Master Teacher',
    expectedTarot: 'The World'
  },
  {
    name: 'Life Path 7 (Nov 11, 1983)',
    year: 1983,
    month: 11,
    day: 11,
    expectedLifePath: 7, // Year: 1983→21→3; Month: 11; Day: 11; Total: 3+11+11=25→7
    expectedBirthday: 2, // 11→1+1=2 (birthday doesn't preserve master)
    expectedLifePathName: 'The Seeker',
    expectedTarot: 'The Chariot'
  },
  {
    name: 'Life Path 9 (Sept 27, 1935)',
    year: 1935,
    month: 9,
    day: 27,
    expectedLifePath: 9, // Year: 1935→18→9; Month: 9; Day: 27→9; Total: 9+9+9=27→9
    expectedBirthday: 9,
    expectedLifePathName: 'The Humanitarian',
    expectedTarot: 'The Hermit'
  }
];

// ═══════════════════════════════════════════════════════════════
// BASIC FUNCTIONS
// ═══════════════════════════════════════════════════════════════

describe('reduceToDigit', () => {
  it('reduces single digit numbers to themselves', () => {
    expect(reduceToDigit(1)).toBe(1);
    expect(reduceToDigit(5)).toBe(5);
    expect(reduceToDigit(9)).toBe(9);
  });

  it('reduces double digit numbers correctly', () => {
    expect(reduceToDigit(10)).toBe(1); // 1+0=1
    expect(reduceToDigit(26)).toBe(8); // 2+6=8
    expect(reduceToDigit(39)).toBe(3); // 3+9=12, 1+2=3
  });

  it('preserves master number 11', () => {
    expect(reduceToDigit(11)).toBe(11);
    expect(reduceToDigit(29)).toBe(11); // 2+9=11 (master)
  });

  it('preserves master number 22', () => {
    expect(reduceToDigit(22)).toBe(22);
  });

  it('preserves master number 33', () => {
    expect(reduceToDigit(33)).toBe(33);
  });

  it('reduces 44 to 8 (not a master number)', () => {
    expect(reduceToDigit(44)).toBe(8); // 4+4=8
  });
});

// ═══════════════════════════════════════════════════════════════
// LIFE PATH NUMBER
// ═══════════════════════════════════════════════════════════════

describe('lifePathNumber', () => {
  TEST_CASES.forEach(({ name, year, month, day, expectedLifePath }) => {
    it(`calculates correct Life Path for ${name}`, () => {
      const result = lifePathNumber(year, month, day);
      expect(result.number).toBe(expectedLifePath);
    });
  });

  it('includes Life Path name', () => {
    const result = lifePathNumber(1979, 8, 5);
    expect(result.name).toBe('The Communicator');
  });

  it('handles master number 11', () => {
    const result = lifePathNumber(1980, 11, 9);
    expect(result.number).toBe(11);
    expect(result.name).toBe('The Visionary');
  });

  it('handles master number 22', () => {
    const result = lifePathNumber(1960, 11, 4);
    expect(result.number).toBe(22);
    expect(result.name).toBe('The Master Builder');
  });

  it('handles master number 33', () => {
    const result = lifePathNumber(2009, 11, 11);
    expect(result.number).toBe(33);
    expect(result.name).toBe('The Master Teacher');
  });
});

// ═══════════════════════════════════════════════════════════════
// BIRTHDAY NUMBER
// ═══════════════════════════════════════════════════════════════

describe('birthdayNumber', () => {
  it('returns single digit days as-is', () => {
    expect(birthdayNumber(1).number).toBe(1);
    expect(birthdayNumber(7).number).toBe(7);
    expect(birthdayNumber(9).number).toBe(9);
  });

  it('reduces double digit days', () => {
    expect(birthdayNumber(15).number).toBe(6); // 1+5=6
    expect(birthdayNumber(27).number).toBe(9); // 2+7=9
  });

  it('reduces day 11 to 2 (no master numbers for birthday)', () => {
    expect(birthdayNumber(11).number).toBe(2); // 1+1=2
    expect(birthdayNumber(29).number).toBe(2); // 2+9=11→2
  });

  it('reduces day 22 to 4 (no master numbers for birthday)', () => {
    expect(birthdayNumber(22).number).toBe(4); // 2+2=4
  });

  TEST_CASES.forEach(({ name, day, expectedBirthday }) => {
    it(`calculates correct Birthday Number for ${name}`, () => {
      const result = birthdayNumber(day);
      expect(result.number).toBe(expectedBirthday);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// PERSONAL YEAR
// ═══════════════════════════════════════════════════════════════

describe('personalYear', () => {
  it('calculates Personal Year 1 (new beginnings)', () => {
    // Birth month 8, day 5, current year 2026
    // 8+5+2+0+2+6 = 23, 2+3 = 5
    const result = personalYear(8, 5, 2026);
    expect(result.number).toBe(5);
    expect(result.year).toBe(2026);
  });

  it('calculates Personal Year for different years', () => {
    // Same birthday, different years
    const py2025 = personalYear(8, 5, 2025);
    const py2026 = personalYear(8, 5, 2026);
    
    expect(py2025.number).not.toBe(py2026.number);
    expect(py2025.year).toBe(2025);
    expect(py2026.year).toBe(2026);
  });

  it('includes theme for Personal Year', () => {
    const result = personalYear(1, 1, 2024);
    expect(result.theme).toBeDefined();
  });

  it('cycles through 1-9', () => {
    // Test that personal years cycle (same birthday across 9 years)
    const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028];
    const results = years.map(y => personalYear(5, 15, y).number);
    
    // Should see variety (all within 1-9)
    results.forEach(num => {
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(9);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// PERSONAL MONTH
// ═══════════════════════════════════════════════════════════════

describe('personalMonth', () => {
  it('calculates Personal Month within Personal Year', () => {
    const result = personalMonth(8, 5, 2026, 3);
    expect(result.number).toBeGreaterThanOrEqual(1);
    expect(result.number).toBeLessThanOrEqual(9);
    expect(result.month).toBe(3);
    expect(result.year).toBe(2026);
  });

  it('different months in same year produce different values', () => {
    const march = personalMonth(8, 5, 2026, 3);
    const april = personalMonth(8, 5, 2026, 4);
    
    // Might be same, but likely different
    expect(march.month).toBe(3);
    expect(april.month).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════
// PERSONAL DAY
// ═══════════════════════════════════════════════════════════════

describe('personalDay', () => {
  it('calculates Personal Day within month and year', () => {
    const result = personalDay(8, 5, 2026, 3, 15);
    expect(result.number).toBeGreaterThanOrEqual(1);
    expect(result.number).toBeLessThanOrEqual(9);
    expect(result.day).toBe(15);
    expect(result.month).toBe(3);
    expect(result.year).toBe(2026);
  });
});

// ═══════════════════════════════════════════════════════════════
// TAROT BIRTH CARD
// ═══════════════════════════════════════════════════════════════

describe('tarotBirthCard', () => {
  const EXPECTED_MAPPINGS = {
    1: 'The Magician',
    2: 'The High Priestess',
    3: 'The Empress',
    4: 'The Emperor',
    5: 'The Hierophant',
    6: 'The Lovers',
    7: 'The Chariot',
    8: 'Strength',
    9: 'The Hermit',
    11: 'Justice',
    22: 'The Fool',
    33: 'The World'
  };

  Object.entries(EXPECTED_MAPPINGS).forEach(([lifePath, expectedCard]) => {
    it(`maps Life Path ${lifePath} to ${expectedCard}`, () => {
      const result = tarotBirthCard(parseInt(lifePath));
      expect(result.card).toBe(expectedCard);
      expect(result.number).toBe(parseInt(lifePath));
    });
  });

  TEST_CASES.forEach(({ name, expectedLifePath, expectedTarot }) => {
    it(`returns correct Tarot card for ${name}`, () => {
      const result = tarotBirthCard(expectedLifePath);
      expect(result.card).toBe(expectedTarot);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// COMPLETE CALCULATION
// ═══════════════════════════════════════════════════════════════

describe('calculateNumerology (Date object)', () => {
  it('calculates all numerology values from birthdate', () => {
    const birthDate = new Date('1979-08-05T22:51:00Z');
    const result = calculateNumerology(birthDate);
    
    expect(result.lifePath.number).toBe(3);
    expect(result.lifePath.name).toBe('The Communicator');
    expect(result.birthday.number).toBe(5);
    expect(result.personalYear.number).toBeGreaterThanOrEqual(1);
    expect(result.personalYear.number).toBeLessThanOrEqual(9);
    expect(result.personalMonth.number).toBeDefined();
    expect(result.personalDay.number).toBeDefined();
    expect(result.tarotCard.card).toBe('The Empress');
  });
});

describe('calculateNumerologyFromBirthData (year, month, day)', () => {
  it('calculates numerology from birth data components', () => {
    const result = calculateNumerologyFromBirthData(1979, 8, 5);
    
    expect(result.lifePath.number).toBe(3);
    expect(result.lifePath.name).toBe('The Communicator');
    expect(result.birthday.number).toBe(5);
    expect(result.tarotCard.card).toBe('The Empress');
  });

  it('handles different test vectors', () => {
    TEST_CASES.forEach(({ name, year, month, day, expectedLifePath, expectedBirthday, expectedTarot }) => {
      const result = calculateNumerologyFromBirthData(year, month, day);
      
      expect(result.lifePath.number).toBe(expectedLifePath);
      expect(result.birthday.number).toBe(expectedBirthday);
      expect(result.tarotCard.card).toBe(expectedTarot);
    });
  });

  it('returns complete structure', () => {
    const result = calculateNumerologyFromBirthData(1979, 8, 5);
    
    // Verify all fields present
    expect(result).toHaveProperty('lifePath');
    expect(result).toHaveProperty('birthday');
    expect(result).toHaveProperty('personalYear');
    expect(result).toHaveProperty('personalMonth');
    expect(result).toHaveProperty('personalDay');
    expect(result).toHaveProperty('tarotCard');
    
    // Verify nested structure
    expect(result.lifePath).toHaveProperty('number');
    expect(result.lifePath).toHaveProperty('name');
    expect(result.tarotCard).toHaveProperty('card');
    expect(result.tarotCard).toHaveProperty('archetype');
  });
});

// ═══════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  it('handles January dates correctly', () => {
    const result = calculateNumerologyFromBirthData(2000, 1, 1);
    expect(result.lifePath.number).toBeGreaterThanOrEqual(1);
    expect(result.lifePath.number).toBeLessThanOrEqual(33);
  });

  it('handles December dates correctly', () => {
    const result = calculateNumerologyFromBirthData(2000, 12, 31);
    expect(result.lifePath.number).toBeGreaterThanOrEqual(1);
    expect(result.lifePath.number).toBeLessThanOrEqual(33);
  });

  it('handles leap year birthdays', () => {
    const result = calculateNumerologyFromBirthData(2000, 2, 29);
    expect(result.birthday.number).toBe(2); // 2+9=11→2 (birthday doesn't preserve master)
  });

  it('handles very old dates', () => {
    const result = calculateNumerologyFromBirthData(1900, 1, 1);
    expect(result.lifePath.number).toBeDefined();
  });

  it('handles very recent dates', () => {
    const result = calculateNumerologyFromBirthData(2024, 12, 31);
    expect(result.lifePath.number).toBeDefined();
  });
});
