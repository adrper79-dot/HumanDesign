/**
 * Druidic Ogham (Celtic Tree Astrology) Engine
 *
 * Maps birth date to a birth tree from the Beth-Luis-Nion Celtic tree calendar —
 * the 13-month lunar framework used in modern Druidic practice.
 *
 * Each tree period corresponds to a letter in the Ogham alphabet (ancient Irish
 * tree script), a set of qualities, a planetary or deity correspondence, and a
 * Shadow/Gift/Prime pattern consistent with the rest of the Prime Self framework.
 *
 * No additional intake data required — uses birth month + day only.
 *
 * Reference: Robert Graves' "The White Goddess" via the Neo-Druidic adaptation
 * popularized by Colin and Liz Murray and later Phyllis Vega.
 *
 * @module ogham
 */

/**
 * Celtic tree calendar periods.
 * Stored as [month, day] pairs for start of each period.
 * The 13th month (Elder) ends Dec 22; Dec 23 is the unnamed "nameless day"
 * and Dec 24 begins Birch again (new year).
 */
const TREE_CALENDAR = [
  // [month (1-12), start_day, tree_key]
  { month: 12, day: 24, key: 'birch'     },  // Dec 24 – Jan 20
  { month:  1, day: 21, key: 'rowan'     },  // Jan 21 – Feb 17
  { month:  2, day: 18, key: 'ash'       },  // Feb 18 – Mar 17
  { month:  3, day: 18, key: 'alder'     },  // Mar 18 – Apr 14
  { month:  4, day: 15, key: 'willow'    },  // Apr 15 – May 12
  { month:  5, day: 13, key: 'hawthorn'  },  // May 13 – Jun 9
  { month:  6, day: 10, key: 'oak'       },  // Jun 10 – Jul 7
  { month:  7, day:  8, key: 'holly'     },  // Jul 8 – Aug 4
  { month:  8, day:  5, key: 'hazel'     },  // Aug 5 – Sep 1
  { month:  9, day:  2, key: 'vine'      },  // Sep 2 – Sep 29
  { month:  9, day: 30, key: 'ivy'       },  // Sep 30 – Oct 27
  { month: 10, day: 28, key: 'reed'      },  // Oct 28 – Nov 24
  { month: 11, day: 25, key: 'elder'     },  // Nov 25 – Dec 22
  { month: 12, day: 23, key: 'nameless'  },  // Dec 23 — the nameless day
];

/**
 * Find the birth tree key from month and day.
 * Works by walking backward through the sorted calendar to find the current period.
 *
 * @param {number} month — birth month 1-12
 * @param {number} day   — birth day 1-31
 * @returns {string} tree key
 */
function findBirthTree(month, day) {
  // Explicit boundary guards for the year-end transition — matches both src traditions:
  // Dec 23 = the "Nameless Day" (outside the 13-month calendar)
  // Dec 24 = first day of Birch (new year begins)
  // Both checked explicitly to avoid any ambiguity from MMDD integer comparison.
  if (month === 12 && day === 23) return 'nameless';
  if (month === 12 && day >= 24) return 'birch';

  // Convert to a simple day-of-year approximation for comparison (leap-year agnostic)
  // We work through the list in reverse: first period whose start ≤ birth date wins.

  // Represent date as comparable integer (MMDD)
  const birthMMDD = month * 100 + day;

  // Build sorted list: each entry as { mmdd, key }
  // Note: Dec 24 wraps to the next year — treat specially
  const entries = TREE_CALENDAR.map(t => ({ mmdd: t.month * 100 + t.day, key: t.key }))
    .sort((a, b) => a.mmdd - b.mmdd);

  let result = 'birch'; // default (Jan 1–20 wraps from Dec 24)

  for (let i = entries.length - 1; i >= 0; i--) {
    if (birthMMDD >= entries[i].mmdd) {
      result = entries[i].key;
      break;
    }
  }

  // Dec 24-31 guard is now handled up top; this redundant check is removed.

  return result;
}

/**
 * Calculate the Ogham birth tree profile from birth date.
 *
 * @param {number} birthMonth — 1-12
 * @param {number} birthDay   — 1-31
 * @returns {object} Birth tree profile with key, name, ogham letter, qualities
 */
export function calculateOgham(birthMonth, birthDay) {
  try {
    const treeKey = findBirthTree(birthMonth, birthDay);
    return {
      treeKey,
      birthMonth,
      birthDay,
    };
  } catch (err) {
    return { error: err.message };
  }
}
