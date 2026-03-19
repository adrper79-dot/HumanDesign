/**
 * Calendar Tier Gating Tests — Item 3.4
 *
 * Tests tier-based feature gating for calendar features:
 *   Free    → moon/personal/reminder/diary only
 *   Individual → + transit/retrograde
 *   Practitioner → + session + Google sync + unified calendar
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QUERIES } from '../workers/src/db/queries.js';

/* ───────── Query structure tests ───────── */
describe('Calendar Tier Gating — queries', () => {
  it('listPractitionerClientEvents joins clients with events', () => {
    expect(typeof QUERIES.listPractitionerClientEvents).toBe('string');
    expect(QUERIES.listPractitionerClientEvents).toContain('practitioner_clients');
    expect(QUERIES.listPractitionerClientEvents).toContain('calendar_events');
    expect(QUERIES.listPractitionerClientEvents).toContain('client_email');
    expect(QUERIES.listPractitionerClientEvents).toContain('ORDER BY');
  });

  it('listPractitionerClientEvents scopes by practitioner_id and date range', () => {
    expect(QUERIES.listPractitionerClientEvents).toContain('practitioner_id = $1');
    expect(QUERIES.listPractitionerClientEvents).toContain('start_date >= $2');
    expect(QUERIES.listPractitionerClientEvents).toContain('start_date <= $3');
  });
});

/* ───────── Stripe tier feature keys ───────── */
describe('Calendar Tier Gating — stripe features', () => {
  it('free tier has no calendar transit/sync/session/practitioner access', async () => {
    const { getTierConfig, hasFeatureAccess } = await import('../workers/src/lib/stripe.js');
    const config = getTierConfig({});
    expect(config.free.features.calendarTransits).toBe(false);
    expect(config.free.features.calendarSync).toBe(false);
    expect(config.free.features.calendarSessions).toBe(false);
    expect(config.free.features.calendarPractitioner).toBe(false);
    expect(hasFeatureAccess('free', 'calendarTransits')).toBe(false);
    expect(hasFeatureAccess('free', 'calendarSync')).toBe(false);
  });

  it('individual tier has transit access but no sync/session/practitioner', async () => {
    const { getTierConfig, hasFeatureAccess } = await import('../workers/src/lib/stripe.js');
    const config = getTierConfig({});
    expect(config.individual.features.calendarTransits).toBe(true);
    expect(config.individual.features.calendarSync).toBe(false);
    expect(config.individual.features.calendarSessions).toBe(false);
    expect(config.individual.features.calendarPractitioner).toBe(false);
    expect(hasFeatureAccess('individual', 'calendarTransits')).toBe(true);
    expect(hasFeatureAccess('individual', 'calendarSync')).toBe(false);
  });

  it('practitioner tier has all calendar features', async () => {
    const { getTierConfig, hasFeatureAccess } = await import('../workers/src/lib/stripe.js');
    const config = getTierConfig({});
    expect(config.practitioner.features.calendarTransits).toBe(true);
    expect(config.practitioner.features.calendarSync).toBe(true);
    expect(config.practitioner.features.calendarSessions).toBe(true);
    expect(config.practitioner.features.calendarPractitioner).toBe(true);
    expect(hasFeatureAccess('practitioner', 'calendarSync')).toBe(true);
  });

  it('agency tier has all calendar features', async () => {
    const { getTierConfig } = await import('../workers/src/lib/stripe.js');
    const config = getTierConfig({});
    expect(config.agency.features.calendarTransits).toBe(true);
    expect(config.agency.features.calendarSync).toBe(true);
    expect(config.agency.features.calendarSessions).toBe(true);
    expect(config.agency.features.calendarPractitioner).toBe(true);
  });
});

/* ───────── Handler tier gating tests ───────── */
describe('Calendar Tier Gating — handler', () => {
  let handleCalendar;
  let lastQuery;
  let queryRows;
  let enforceFn;

  beforeEach(async () => {
    vi.resetModules();
    lastQuery = null;
    queryRows = [];

    enforceFn = vi.fn(async () => null);

    vi.doMock('../workers/src/db/queries.js', () => ({
      QUERIES: {
        createCalendarEvent: 'INSERT cal',
        listCalendarEvents: 'SELECT cal',
        getCalendarEventsByDateRange: 'SELECT cal range',
        updateCalendarEvent: 'UPDATE cal',
        deleteCalendarEvent: 'DELETE cal',
        getCalendarEvent: 'SELECT cal one',
        listPractitionerClientEvents: 'SELECT pract cal',
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
      enforceFeatureAccess: enforceFn,
    }));

    const mod = await import('../workers/src/handlers/calendar.js');
    handleCalendar = mod.default;
  });

  it('free user only sees moon/personal/diary/reminder events', async () => {
    queryRows = [
      { id: 'e1', event_type: 'moon' },
      { id: 'e2', event_type: 'transit' },
      { id: 'e3', event_type: 'session' },
      { id: 'e4', event_type: 'personal' },
    ];
    const req = new Request('https://x.com/api/calendar/events');
    req._user = { sub: 'user-1' };
    req._tier = 'free';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/events');
    const body = await resp.json();
    expect(body.data.length).toBe(2); // moon + personal only
    expect(body.data.map(e => e.event_type).sort()).toEqual(['moon', 'personal']);
    expect(Array.isArray(body.allowed_types)).toBe(true);
    expect(body.allowed_types).toContain('moon');
    expect(body.allowed_types).toContain('personal');
    expect(body.allowed_types).not.toContain('transit');
  });

  it('individual user sees moon/personal + transit/retrograde events', async () => {
    queryRows = [
      { id: 'e1', event_type: 'moon' },
      { id: 'e2', event_type: 'transit' },
      { id: 'e3', event_type: 'session' },
      { id: 'e4', event_type: 'retrograde' },
    ];
    const req = new Request('https://x.com/api/calendar/events');
    req._user = { sub: 'user-1' };
    req._tier = 'individual';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/events');
    const body = await resp.json();
    expect(body.data.length).toBe(3); // moon + transit + retrograde (no session)
    expect(body.data.map(e => e.event_type).sort()).toEqual(['moon', 'retrograde', 'transit']);
    expect(body.allowed_types).toContain('transit');
    expect(body.allowed_types).not.toContain('session');
  });

  it('practitioner user sees all event types', async () => {
    queryRows = [
      { id: 'e1', event_type: 'moon' },
      { id: 'e2', event_type: 'transit' },
      { id: 'e3', event_type: 'session' },
      { id: 'e4', event_type: 'personal' },
    ];
    const req = new Request('https://x.com/api/calendar/events');
    req._user = { sub: 'user-1' };
    req._tier = 'practitioner';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/events');
    const body = await resp.json();
    expect(body.data.length).toBe(4); // all types
    expect(body.allowed_types).toContain('session');
    expect(body.allowed_types).toContain('transit');
  });

  it('free user cannot create transit event (403)', async () => {
    const req = new Request('https://x.com/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ title: 'Transit', start_date: '2026-04-01', event_type: 'transit' }),
    });
    req._user = { sub: 'user-1' };
    req._tier = 'free';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/events');
    expect(resp.status).toBe(403);
    const body = await resp.json();
    expect(body.upgrade_required).toBe(true);
    expect(body.feature).toBe('calendarTransits');
  });

  it('free user can create moon event', async () => {
    queryRows = [{ id: 'evt-1', title: 'Full Moon', event_type: 'moon' }];
    const req = new Request('https://x.com/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ title: 'Full Moon', start_date: '2026-04-01', event_type: 'moon' }),
    });
    req._user = { sub: 'user-1' };
    req._tier = 'free';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/events');
    expect(resp.status).toBe(201);
    const body = await resp.json();
    expect(body.data.event_type).toBe('moon');
  });

  it('individual user cannot create session event (403)', async () => {
    const req = new Request('https://x.com/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ title: 'Session', start_date: '2026-04-01', event_type: 'session' }),
    });
    req._user = { sub: 'user-1' };
    req._tier = 'individual';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/events');
    expect(resp.status).toBe(403);
    const body = await resp.json();
    expect(body.upgrade_required).toBe(true);
    expect(body.feature).toBe('calendarSessions');
  });

  it('/google/* routes return 403 for calendarSync enforcement', async () => {
    // Make the SECOND enforceFeatureAccess call (for calendarSync) return 403
    enforceFn.mockImplementation(async (req, env, feature) => {
      if (feature === 'calendarSync') {
        return Response.json({ error: 'Upgrade', feature: 'calendarSync', upgrade_required: true }, { status: 403 });
      }
      return null;
    });

    const req = new Request('https://x.com/api/calendar/google/connect', { method: 'POST' });
    req._user = { sub: 'user-1' };
    req._tier = 'free';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/google/connect');
    expect(resp.status).toBe(403);
    const body = await resp.json();
    expect(body.feature).toBe('calendarSync');
    expect(body.upgrade_required).toBe(true);
  });

  it('/practitioner/events returns 403 for calendarPractitioner enforcement', async () => {
    enforceFn.mockImplementation(async (req, env, feature) => {
      if (feature === 'calendarPractitioner') {
        return Response.json({ error: 'Upgrade', feature: 'calendarPractitioner', upgrade_required: true }, { status: 403 });
      }
      return null;
    });

    const req = new Request('https://x.com/api/calendar/practitioner/events?from=2026-04-01&to=2026-04-30');
    req._user = { sub: 'user-1' };
    req._tier = 'individual';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/practitioner/events');
    expect(resp.status).toBe(403);
    const body = await resp.json();
    expect(body.feature).toBe('calendarPractitioner');
  });

  it('/practitioner/events requires from and to params', async () => {
    const req = new Request('https://x.com/api/calendar/practitioner/events');
    req._user = { sub: 'user-1' };
    req._tier = 'practitioner';
    const resp = await handleCalendar(req, { NEON_CONNECTION_STRING: 'x' }, '/practitioner/events');
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toContain('from and to');
  });

  it('/practitioner/events returns own + client events with colors', async () => {
    let callCount = 0;
    const ownEvents = [{ id: 'own-1', event_type: 'personal', start_date: '2026-04-10' }];
    const clientEvents = [
      { id: 'cl-1', event_type: 'session', start_date: '2026-04-11', client_email: 'alice@test.com', client_added_at: '2026-01-01' },
      { id: 'cl-2', event_type: 'moon', start_date: '2026-04-12', client_email: 'bob@test.com', client_added_at: '2026-01-02' },
    ];

    vi.resetModules();

    vi.doMock('../workers/src/db/queries.js', () => ({
      QUERIES: {
        getCalendarEventsByDateRange: 'SELECT cal range',
        listPractitionerClientEvents: 'SELECT pract cal',
      },
      createQueryFn: () => async (sql) => {
        callCount++;
        if (sql === 'SELECT cal range') return { rows: ownEvents };
        if (sql === 'SELECT pract cal') return { rows: clientEvents };
        return { rows: [] };
      },
    }));

    // Need to re-import after re-mocking queries
    vi.doMock('../workers/src/middleware/tierEnforcement.js', () => ({
      enforceFeatureAccess: vi.fn(async () => null),
    }));
    vi.doMock('../workers/src/lib/analytics.js', () => ({
      trackEvent: vi.fn(),
    }));
    vi.doMock('../workers/src/lib/routeErrors.js', () => ({
      reportHandledRouteError: vi.fn(() => Response.json({ error: 'err' }, { status: 500 })),
    }));

    const mod = await import('../workers/src/handlers/calendar.js');
    const handler = mod.default;

    const req = new Request('https://x.com/api/calendar/practitioner/events?from=2026-04-01&to=2026-04-30');
    req._user = { sub: 'pract-1' };
    req._tier = 'practitioner';
    const resp = await handler(req, { NEON_CONNECTION_STRING: 'x' }, '/practitioner/events');
    expect(resp.status).toBe(200);
    const body = await resp.json();

    // 1 own + 2 client = 3 total events
    expect(body.data.length).toBe(3);
    // Own event is marked is_own: true
    const own = body.data.find(e => e.id === 'own-1');
    expect(own.is_own).toBe(true);
    // Client events have client_color assigned
    const cl1 = body.data.find(e => e.id === 'cl-1');
    expect(cl1.is_own).toBe(false);
    expect(cl1.client_color).toBeTruthy();
    // client_colors map is returned
    expect(body.client_colors).toBeTruthy();
    expect(typeof body.client_colors['alice@test.com']).toBe('string');
    expect(typeof body.client_colors['bob@test.com']).toBe('string');
    // Different clients get different colors (when there are only 2)
    expect(body.client_colors['alice@test.com']).not.toBe(body.client_colors['bob@test.com']);
  });
});
