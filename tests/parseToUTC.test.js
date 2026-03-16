import { describe, it, expect } from 'vitest';
import { parseToUTC } from '../workers/src/utils/parseToUTC.js';

describe('parseToUTC', () => {
  it('returns input unchanged when no timezone is given', () => {
    const result = parseToUTC('2026-06-15', '14:30');
    expect(result).toEqual({ year: 2026, month: 6, day: 15, hour: 14, minute: 30, second: 0 });
  });

  it('converts EST (UTC-5) correctly', () => {
    // 2026-06-15 14:30 America/New_York (EDT = UTC-4 in June)
    // UTC should be 18:30
    const result = parseToUTC('2026-06-15', '14:30', 'America/New_York');
    expect(result).toEqual({ year: 2026, month: 6, day: 15, hour: 18, minute: 30, second: 0 });
  });

  it('converts positive offset (UTC+5:30) correctly', () => {
    // 2026-06-15 14:30 Asia/Kolkata (UTC+5:30)
    // UTC should be 09:00
    const result = parseToUTC('2026-06-15', '14:30', 'Asia/Kolkata');
    expect(result).toEqual({ year: 2026, month: 6, day: 15, hour: 9, minute: 0, second: 0 });
  });

  // ─── BL-C6: Month-boundary regression tests ─────────────────

  it('handles month boundary: Jan 1 00:30 in UTC-5 → Dec 31 UTC+?', () => {
    // 2026-01-01 00:30 America/New_York (EST = UTC-5 in January)
    // UTC should be 2026-01-01 05:30
    const result = parseToUTC('2026-01-01', '00:30', 'America/New_York');
    expect(result).toEqual({ year: 2026, month: 1, day: 1, hour: 5, minute: 30, second: 0 });
  });

  it('handles month boundary: Dec 31 23:30 in UTC-5 → Jan 1 next year', () => {
    // 2025-12-31 23:30 America/New_York (EST = UTC-5)
    // UTC should be 2026-01-01 04:30
    const result = parseToUTC('2025-12-31', '23:30', 'America/New_York');
    expect(result).toEqual({ year: 2026, month: 1, day: 1, hour: 4, minute: 30, second: 0 });
  });

  it('handles month boundary: Jan 1 01:00 in UTC+9 → Dec 31 previous year', () => {
    // 2026-01-01 01:00 Asia/Tokyo (UTC+9)
    // UTC should be 2025-12-31 16:00
    const result = parseToUTC('2026-01-01', '01:00', 'Asia/Tokyo');
    expect(result).toEqual({ year: 2025, month: 12, day: 31, hour: 16, minute: 0, second: 0 });
  });

  it('handles month boundary: Mar 1 00:30 in UTC-5 (non-leap year)', () => {
    // 2026-03-01 00:30 America/New_York (EST = UTC-5)
    // UTC should be 2026-03-01 05:30
    const result = parseToUTC('2026-03-01', '00:30', 'America/New_York');
    expect(result).toEqual({ year: 2026, month: 3, day: 1, hour: 5, minute: 30, second: 0 });
  });

  it('handles month boundary: Feb 28 23:30 in UTC-5 → Mar 1', () => {
    // 2026-02-28 23:30 America/New_York (EST = UTC-5)
    // UTC should be 2026-03-01 04:30
    const result = parseToUTC('2026-02-28', '23:30', 'America/New_York');
    expect(result).toEqual({ year: 2026, month: 3, day: 1, hour: 4, minute: 30, second: 0 });
  });

  it('handles positive offset day rollback: Aug 1 02:00 in UTC+5:30', () => {
    // 2026-08-01 02:00 Asia/Kolkata (UTC+5:30)
    // UTC should be 2026-07-31 20:30
    const result = parseToUTC('2026-08-01', '02:00', 'Asia/Kolkata');
    expect(result).toEqual({ year: 2026, month: 7, day: 31, hour: 20, minute: 30, second: 0 });
  });

  // ─── Edge cases ──────────────────────────────────────────────

  it('handles midnight exactly', () => {
    // 2026-06-15 00:00 America/New_York (EDT = UTC-4)
    // UTC should be 04:00
    const result = parseToUTC('2026-06-15', '00:00', 'America/New_York');
    expect(result).toEqual({ year: 2026, month: 6, day: 15, hour: 4, minute: 0, second: 0 });
  });

  it('handles UTC timezone as identity', () => {
    const result = parseToUTC('2026-06-15', '14:30', 'UTC');
    expect(result).toEqual({ year: 2026, month: 6, day: 15, hour: 14, minute: 30, second: 0 });
  });

  it('throws on invalid timezone', () => {
    expect(() => parseToUTC('2026-06-15', '14:30', 'Invalid/Zone')).toThrow('Invalid timezone');
  });
});
