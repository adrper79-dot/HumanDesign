/**
 * parseToUTC — Shared timezone conversion utility
 *
 * Converts a local date/time + IANA timezone to UTC components.
 * Uses the Intl API for timezone offset detection (no external deps).
 */

/**
 * Parse a local birth date/time string into UTC components.
 *
 * @param {string} birthDate  — "YYYY-MM-DD"
 * @param {string} birthTime  — "HH:MM"
 * @param {string} [timezone] — IANA timezone (e.g. "America/New_York"). Omit for UTC.
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number }}
 */
export function parseToUTC(birthDate, birthTime, timezone) {
  const [year, month, day] = birthDate.split('-').map(Number);
  const [hour, minute] = birthTime.split(':').map(Number);

  if (!timezone) {
    return { year, month, day, hour, minute, second: 0 };
  }

  try {
    // Probe: create a UTC instant from the input and format it in the target
    // timezone. Comparing the two Date.UTC representations gives exact offset
    // — correct across all month/year boundaries (fixes BL-C6).
    const probeUTC = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(probeUTC);
    const getPart = (type) => parseInt(parts.find(p => p.type === type)?.value || '0');

    const tzYear   = getPart('year');
    const tzMonth  = getPart('month');
    const tzDay    = getPart('day');
    const tzHour   = getPart('hour') % 24; // Intl may return 24 for midnight
    const tzMinute = getPart('minute');

    // Build Date.UTC for the timezone-local representation and the UTC input.
    // The difference is the exact offset in ms — works across month/year edges.
    const tzAsUTC   = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0);
    const inputUTC  = Date.UTC(year, month - 1, day, hour, minute, 0);
    const offsetMs  = tzAsUTC - inputUTC;

    // Apply: "local = UTC + offset"  →  "UTC = local - offset"
    const localMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const resultDate = new Date(localMs - offsetMs);

    return {
      year:   resultDate.getUTCFullYear(),
      month:  resultDate.getUTCMonth() + 1,
      day:    resultDate.getUTCDate(),
      hour:   resultDate.getUTCHours(),
      minute: resultDate.getUTCMinutes(),
      second: 0
    };
  } catch (error) {
    // Invalid timezone string causes Intl.DateTimeFormat to throw RangeError
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}
