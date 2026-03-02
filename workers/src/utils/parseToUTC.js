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

  // Use Intl to determine the UTC offset for this timezone at this date
  const testDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(testDate);
  const getPart = (type) => parseInt(parts.find(p => p.type === type)?.value || '0');

  const tzHour = getPart('hour');
  const tzMinute = getPart('minute');
  const tzDay = getPart('day');

  // Offset = timezone time - UTC time
  const utcMinutes = hour * 60 + minute;
  const tzMinutes = tzHour * 60 + tzMinute;
  let offsetMinutes = tzMinutes - utcMinutes;

  // Handle day boundary crossings
  if (tzDay > day) offsetMinutes += 24 * 60;
  else if (tzDay < day) offsetMinutes -= 24 * 60;

  // Compute actual UTC time for the local input
  const localTotalMinutes = hour * 60 + minute;
  const utcTotalMinutes = localTotalMinutes - offsetMinutes;

  let utcHour = Math.floor(utcTotalMinutes / 60);
  let utcMinuteVal = utcTotalMinutes % 60;
  let utcDay = day, utcMonth = month, utcYear = year;

  if (utcHour >= 24) { utcHour -= 24; utcDay++; }
  if (utcHour < 0) { utcHour += 24; utcDay--; }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (utcDay > daysInMonth) { utcDay = 1; utcMonth++; }
  if (utcDay < 1) { utcMonth--; utcDay = new Date(year, utcMonth, 0).getDate(); }
  if (utcMonth > 12) { utcMonth = 1; utcYear++; }
  if (utcMonth < 1) { utcMonth = 12; utcYear--; }

  return {
    year: utcYear, month: utcMonth, day: utcDay,
    hour: utcHour, minute: utcMinuteVal, second: 0
  };
}
