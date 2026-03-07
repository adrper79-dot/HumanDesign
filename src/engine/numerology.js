/**
 * Numerology Engine - Pythagorean System
 * 
 * Calculates Life Path, Birthday, Personal Year/Month/Day numbers
 * plus Tarot Birth Card correspondences.
 * 
 * All calculations use ONLY birth date (no name required).
 * Zero additional intake fields needed.
 */

/**
 * Reduce a number to single digit or master number (11, 22, 33)
 * @param {number} num - Number to reduce
 * @returns {number} Reduced number (1-9, 11, 22, 33)
 */
export function reduceToDigit(num) {
  while (num > 9 && num !== 11 && num !== 22 && num !== 33) {
    num = String(num)
      .split('')
      .reduce((sum, digit) => sum + parseInt(digit, 10), 0);
  }
  return num;
}

/**
 * Reduce a number to single digit 1-9 only (no master numbers)
 * Used for Birthday and Personal Year/Month/Day calculations
 * 
 * @param {number} num - Number to reduce
 * @returns {number} Reduced number (1-9 only)
 */
function reduceToSingleDigit(num) {
  while (num > 9) {
    num = String(num)
      .split('')
      .reduce((sum, digit) => sum + parseInt(digit, 10), 0);
  }
  return num;
}

/**
 * Calculate Life Path Number from birth date
 * Method: Reduce year, month, day separately, then combine
 * 
 * Example: August 5, 1979
 *   Year: 1979 → 1+9+7+9 = 26 → 2+6 = 8
 *   Month: 8
 *   Day: 5
 *   Sum: 8 + 8 + 5 = 21 → 2+1 = 3
 * 
 * @param {number} year - 4-digit year
 * @param {number} month - 1-12
 * @param {number} day - 1-31
 * @returns {object} Life Path object with number and name
 */
export function lifePathNumber(year, month, day) {
  // Standard Pythagorean method: reduce each component, then add and reduce total
  // This preserves master numbers (11, 22, 33) at each reduction step
  const yearSum = reduceToDigit(year);
  const monthSum = reduceToDigit(month);
  const daySum = reduceToDigit(day);
  const number = reduceToDigit(yearSum + monthSum + daySum);
  
  return {
    number,
    name: LIFE_PATH_NAMES[number] || 'Unknown'
  };
}

/**
 * Life Path Number name/archetype mapping
 */
const LIFE_PATH_NAMES = {
  1: 'The Leader',
  2: 'The Peacemaker',
  3: 'The Communicator',
  4: 'The Builder',
  5: 'The Freedom Seeker',
  6: 'The Nurturer',
  7: 'The Seeker',
  8: 'The Powerhouse',
  9: 'The Humanitarian',
  11: 'The Visionary',
  22: 'The Master Builder',
  33: 'The Master Teacher',
};

/**
 * Birthday Number - reduced day of month (always 1-9)
 * @param {number} day - Day of month (1-31)
 * @returns {object} Birthday number object
 */
export function birthdayNumber(day) {
  const number = reduceToSingleDigit(day);
  return { number };
}

/**
 * Personal Year Number - changes January 1
 * Formula: birth month + birth day + current year, reduced
 * 
 * @param {number} birthMonth - 1-12
 * @param {number} birthDay - 1-31
 * @param {number} currentYear - 4-digit year
 * @returns {object} Personal Year object
 */
export function personalYear(birthMonth, birthDay, currentYear) {
  const sum = birthMonth + birthDay + currentYear;
  const number = reduceToSingleDigit(sum);
  const theme = PERSONAL_YEAR_THEMES[number] || 'Unknown';
  return { number, theme, year: currentYear };
}

/**
 * Personal Year theme names
 */
const PERSONAL_YEAR_THEMES = {
  1: 'New Beginnings',
  2: 'Patience & Partnership',
  3: 'Creative Expression',
  4: 'Foundation Building',
  5: 'Change & Freedom',
  6: 'Responsibility & Love',
  7: 'Inner Work & Wisdom',
  8: 'Power & Abundance',
  9: 'Completion & Release',
};

/**
 * Personal Month Number
 * Formula: personal year + current month, reduced
 * 
 * @param {number} birthMonth - 1-12
 * @param {number} birthDay - 1-31
 * @param {number} currentYear - 4-digit year
 * @param {number} currentMonth - 1-12
 * @returns {object} Personal Month object
 */
export function personalMonth(birthMonth, birthDay, currentYear, currentMonth) {
  const pYear = personalYear(birthMonth, birthDay, currentYear);
  const number = reduceToSingleDigit(pYear.number + currentMonth);
  return { number, month: currentMonth, year: currentYear };
}

/**
 * Personal Day Number
 * Formula: personal month + current day, reduced
 * 
 * @param {number} birthMonth - 1-12
 * @param {number} birthDay - 1-31
 * @param {number} currentYear - 4-digit year
 * @param {number} currentMonth - 1-12
 * @param {number} currentDay - 1-31
 * @returns {object} Personal Day object
 */
export function personalDay(birthMonth, birthDay, currentYear, currentMonth, currentDay) {
  const pMonth = personalMonth(birthMonth, birthDay, currentYear, currentMonth);
  const number = reduceToSingleDigit(pMonth.number + currentDay);
  return { number, day: currentDay, month: currentMonth, year: currentYear };
}

/**
 * Tarot Birth Card mapping - derived from Life Path Number
 * Each Life Path corresponds to a Major Arcana card
 */
const TAROT_MAPPING = {
  1: { card: 'The Magician', number: 1, archetype: 'The Creator' },
  2: { card: 'The High Priestess', number: 2, archetype: 'The Intuitive' },
  3: { card: 'The Empress', number: 3, archetype: 'The Nurturer' },
  4: { card: 'The Emperor', number: 4, archetype: 'The Builder' },
  5: { card: 'The Hierophant', number: 5, archetype: 'The Teacher' },
  6: { card: 'The Lovers', number: 6, archetype: 'The Harmonizer' },
  7: { card: 'The Chariot', number: 7, archetype: 'The Warrior' },
  8: { card: 'Strength', number: 8, archetype: 'The Master' },
  9: { card: 'The Hermit', number: 9, archetype: 'The Seeker' },
  11: { card: 'Justice', number: 11, archetype: 'The Truth-Teller' },
  22: { card: 'The Fool', number: 22, archetype: 'The Visionary' },
  33: { card: 'The World', number: 33, archetype: 'The Master Teacher' },
};

/**
 * Get Tarot Birth Card from Life Path Number
 * @param {number} lifePath - Life Path Number (1-9, 11, 22, 33)
 * @returns {object} Tarot card object
 */
export function tarotBirthCard(lifePath) {
  return TAROT_MAPPING[lifePath] || TAROT_MAPPING[9]; // Default to Hermit if not found
}

/**
 * Calculate complete numerology profile from birth date
 * 
 * @param {Date} birthDate - JavaScript Date object
 * @param {Date} [currentDate] - Current date (defaults to now)
 * @returns {object} Complete numerology profile
 */
export function calculateNumerology(birthDate, currentDate = new Date()) {
  const year = birthDate.getFullYear();
  const month = birthDate.getMonth() + 1; // JS months are 0-indexed
  const day = birthDate.getDate();
  
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentDay = currentDate.getDate();
  
  const lifePath = lifePathNumber(year, month, day);
  const birthday = birthdayNumber(day);
  const pYear = personalYear(month, day, currentYear);
  const pMonth = personalMonth(month, day, currentYear, currentMonth);
  const pDay = personalDay(month, day, currentYear, currentMonth, currentDay);
  
  return {
    lifePath,
    birthday,
    personalYear: pYear,
    personalMonth: pMonth,
    personalDay: pDay,
    tarotCard: tarotBirthCard(lifePath.number),
  };
}

/**
 * Calculate numerology from birth data input (matches engine interface)
 * 
 * @param {number} year - Birth year (4 digits)
 * @param {number} month - Birth month (1-12)
 * @param {number} day - Birth day (1-31)
 * @returns {object} Numerology profile
 */
export function calculateNumerologyFromBirthData(year, month, day) {
  const birthDate = new Date(year, month - 1, day); // JS months are 0-indexed
  birthDate.setFullYear(year); // force correct year for years 0-99 (JS maps 0-99 → 1900-1999)
  return calculateNumerology(birthDate);
}
