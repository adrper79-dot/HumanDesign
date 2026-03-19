/**
 * Calendar Events Tests — Item 3.1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/* ───────── Query structure tests ───────── */
describe('Calendar — queries', () => {
  it('createCalendarEvent inserts with RETURNING', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.createCalendarEvent).toBe('string');
    expect(QUERIES.createCalendarEvent).toContain('INSERT INTO calendar_events');
    expect(QUERIES.createCalendarEvent).toContain('RETURNING');
  });

  it('listCalendarEvents orders by start_date with LIMIT/OFFSET', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.listCalendarEvents).toContain('ORDER BY start_date');
    expect(QUERIES.listCalendarEvents).toContain('LIMIT');
    expect(QUERIES.listCalendarEvents).toContain('OFFSET');
  });

  it('getCalendarEventsByDateRange filters between two timestamps', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.getCalendarEventsByDateRange).toContain('start_date >=');
    expect(QUERIES.getCalendarEventsByDateRange).toContain('start_date <=');
  });

  it('updateCalendarEvent uses COALESCE for partial updates', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.updateCalendarEvent).toContain('COALESCE');
    expect(QUERIES.updateCalendarEvent).toContain('RETURNING');
  });

  it('deleteCalendarEvent enforces user ownership', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.deleteCalendarEvent).toContain('user_id');
    expect(QUERIES.deleteCalendarEvent).toContain('DELETE');
  });

  it('getCalendarEvent scopes by user_id', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.getCalendarEvent).toContain('user_id');
  });
});

/* ───────── Handler tests ───────── */
describe('Calendar — handler', () => {
  let handleCalendar;
  let lastQuery;
  let queryRows;

  beforeEach(async () => {
    vi.resetModules();
    lastQuery = null;
    queryRows = [];

    vi.doMock('../workers/src/db/queries.js', () => ({
      QUERIES: {
        createCalendarEvent: 'INSERT cal',
        listCalendarEvents: 'SELECT cal',
        getCalendarEventsByDateRange: 'SELECT cal range',
        updateCalendarEvent: 'UPDATE cal',
        deleteCalendarEvent: 'DELETE cal',
        getCalendarEvent: 'SELECT cal one',
      },
      createQueryFn: () => async (sql, params) => {
        lastQuery = { sql, params };
        return { rows: queryRows };
      },
    }));
    vi.doMock('../workers/src/lib/analytics.js', () => ({
      trackEvent: vi.fn(),
    }));
    vi.doMock('../workers/src/lib/routeErrors.js', () => ({
      reportHandledRouteError: vi.fn(() => Response.json({ error: 'err' }, { status: 500 })),
    }));
    vi.doMock('../workers/src/middleware/tierEnforcement.js', () => ({
      enforceFeatureAccess: vi.fn(async () => null),
    }));

    const mod = await import('../workers/src/handlers/calendar.js');
    handleCalendar = mod.default;
  });

  it('rejects unauthenticated requests with 401', async () => {
    const req = new Request('https://x.com/api/calendar/events');
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/events');
    expect(resp.status).toBe(401);
  });

  it('returns 400 when creating event without title', async () => {
    const req = new Request('https://x.com/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ start_date: '2026-04-01' }),
    });
    req._user = { sub: 'user-1' };
    req._tier = 'individual';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/events');
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain('title');
  });

  it('returns 400 when title exceeds 500 characters', async () => {
    const req = new Request('https://x.com/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ title: 'A'.repeat(501), start_date: '2026-04-01' }),
    });
    req._user = { sub: 'user-1' };
    req._tier = 'individual';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/events');
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain('500');
  });

  it('creates event with 201 and returns data', async () => {
    queryRows = [{ id: 'evt-1', title: 'Test', event_type: 'personal' }];
    const req = new Request('https://x.com/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', start_date: '2026-04-01' }),
    });
    req._user = { sub: 'user-1' };
    req._tier = 'individual';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/events');
    expect(resp.status).toBe(201);
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe('evt-1');
    expect(Array.isArray(lastQuery.params)).toBe(true);
    expect(lastQuery.params[0]).toBe('user-1');
    expect(lastQuery.params[1]).toBe('Test');
  });

  it('lists events with default limit/offset', async () => {
    queryRows = [{ id: 'e1', event_type: 'personal' }, { id: 'e2', event_type: 'moon' }];
    const req = new Request('https://x.com/api/calendar/events');
    req._user = { sub: 'user-1' };
    req._tier = 'individual';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/events');
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    // Default limit = 100, offset = 0
    expect(lastQuery.params[1]).toBe(100);
    expect(lastQuery.params[2]).toBe(0);
  });

  it('lists events by date range when from/to given', async () => {
    queryRows = [{ id: 'e1', event_type: 'moon' }];
    const req = new Request('https://x.com/api/calendar/events?from=2026-04-01&to=2026-04-30');
    req._user = { sub: 'user-1' };
    req._tier = 'individual';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/events');
    expect(resp.status).toBe(200);
    expect(lastQuery.sql).toBe('SELECT cal range');
    expect(lastQuery.params[1]).toBe('2026-04-01');
    expect(lastQuery.params[2]).toBe('2026-04-30');
  });

  it('returns 404 when deleting non-existent event', async () => {
    queryRows = []; // no rows returned means event not found
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const req = new Request(`https://x.com/api/calendar/events/${id}`, { method: 'DELETE' });
    req._user = { sub: 'user-1' };
    req._tier = 'individual';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, `/events/${id}`);
    expect(resp.status).toBe(404);
  });

  it('returns iCal feed with correct Content-Type', async () => {
    queryRows = [
      { id: 'e1', title: 'Full Moon', start_date: '2026-04-15T12:00:00Z', event_type: 'moon' },
    ];
    const req = new Request('https://x.com/api/calendar/feed.ics');
    req._user = { sub: 'user-1' };
    req._tier = 'individual';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/feed.ics');
    expect(resp.headers.get('Content-Type')).toContain('text/calendar');
    const text = await resp.text();
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('END:VCALENDAR');
    expect(text).toContain('Full Moon');
  });

  it('returns 404 for unknown subpath', async () => {
    const req = new Request('https://x.com/api/calendar/unknown');
    req._user = { sub: 'user-1' };
    req._tier = 'individual';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/unknown');
    expect(resp.status).toBe(404);
  });

  it('defaults invalid event_type to personal on create', async () => {
    queryRows = [{ id: 'evt-2', title: 'T', event_type: 'personal' }];
    const req = new Request('https://x.com/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ title: 'T', start_date: '2026-04-01', event_type: 'INVALID' }),
    });
    req._user = { sub: 'user-1' };
    req._tier = 'individual';
    await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/events');
    // event_type param is index 3 (0-based)
    expect(lastQuery.params[3]).toBe('personal');
  });
});

/* ───────── Migration file test ───────── */
describe('Calendar — migration', () => {
  it('060_calendar_events.sql exists with correct schema', () => {
    const migPath = resolve(__dirname, '../workers/src/db/migrations/060_calendar_events.sql');
    expect(existsSync(migPath)).toBe(true);
    const sql = readFileSync(migPath, 'utf-8');
    expect(sql).toContain('calendar_events');
    expect(sql).toContain('user_id');
    expect(sql).toContain('start_date');
    expect(sql).toContain('event_type');
    expect(sql).toContain('idx_calendar_events_user_date');
  });
});
