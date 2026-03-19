/**
 * Calendar Events Handler — Item 3.1 + 3.4 Tier Gating
 *
 * CRUD for calendar events + iCal feed + optimal dates proxy.
 * Tier gating: Free=moon only, Individual+=transits, Practitioner+=sync+sessions+unified calendar.
 *
 * Routes (PREFIX_ROUTE at /api/calendar):
 *   GET    /events          — List events (with optional date range)
 *   POST   /events          — Create event
 *   PUT    /events/:id      — Update event
 *   DELETE /events/:id      — Delete event
 *   GET    /feed.ics        — iCal feed
 *   POST   /optimal-dates   — Proxy to timing engine
 *   GET    /practitioner/events — Unified practitioner calendar (client events)
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { trackEvent } from '../lib/analytics.js';
import { reportHandledRouteError } from '../lib/routeErrors.js';
import { enforceFeatureAccess } from '../middleware/tierEnforcement.js';

const VALID_EVENT_TYPES = ['personal', 'transit', 'moon', 'retrograde', 'session', 'reminder', 'diary'];

// Event types that require specific tier feature access
const EVENT_TYPE_TIER_MAP = {
  transit: 'calendarTransits',
  retrograde: 'calendarTransits',
  session: 'calendarSessions',
};

// Allowed event types per tier (moon/personal/reminder/diary always allowed)
function getAllowedEventTypes(request) {
  const tier = request._tier || 'free';
  const allowed = ['personal', 'moon', 'reminder', 'diary'];
  if (['individual', 'practitioner', 'agency'].includes(tier)) {
    allowed.push('transit', 'retrograde');
  }
  if (['practitioner', 'agency'].includes(tier)) {
    allowed.push('session');
  }
  return allowed;
}

export default async function handleCalendar(request, env, subpath) {
  // Google Calendar callback is unauthenticated (Google redirects browser)
  if (subpath === '/google/callback' && request.method === 'GET') {
    try {
      const { handleGoogleCalendar } = await import('./google-calendar.js');
      return await handleGoogleCalendar(request, env, '/callback', null);
    } catch (error) {
      return reportHandledRouteError({ request, env, error, source: 'calendar' });
    }
  }

  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const method = request.method;
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Resolve tier (sets request._tier for downstream use)
  // We use a lightweight resolve — calendarTransits is the base gated feature.
  // Free users still get moon/personal/reminder/diary events; no enforcement needed for those.
  // This call just populates request._tier.
  const tierCheck = await enforceFeatureAccess(request, env, 'calendarTransits');
  // If tierCheck returned 403, user is free tier — still allowed for moon events
  // so we don't return the error; just set _tier = 'free' if not already set.
  if (tierCheck && tierCheck.status === 403) {
    request._tier = 'free';
  }

  try {
    // Delegate /google/* to google-calendar handler (requires sync feature)
    if (subpath.startsWith('/google')) {
      const syncCheck = await enforceFeatureAccess(request, env, 'calendarSync');
      if (syncCheck) {
        trackEvent?.('calendar', 'calendar_tier_upgrade_prompted', 'calendarSync');
        return syncCheck;
      }
      const { handleGoogleCalendar } = await import('./google-calendar.js');
      const googleSubpath = subpath.replace(/^\/google/, '');
      return await handleGoogleCalendar(request, env, googleSubpath || '/', userId);
    }

    // GET /practitioner/events — unified practitioner calendar
    if (subpath === '/practitioner/events' && method === 'GET') {
      const practCheck = await enforceFeatureAccess(request, env, 'calendarPractitioner');
      if (practCheck) {
        trackEvent?.('calendar', 'calendar_tier_upgrade_prompted', 'calendarPractitioner');
        return practCheck;
      }
      return await handlePractitionerEvents(request, userId, query);
    }

    // GET /events or /events?from=...&to=...
    if ((subpath === '/events' || subpath === '/events/') && method === 'GET') {
      return await handleListEvents(request, userId, query);
    }

    // POST /events
    if ((subpath === '/events' || subpath === '/events/') && method === 'POST') {
      return await handleCreateEvent(request, userId, query);
    }

    // PUT /events/:id
    const updateMatch = subpath.match(/^\/events\/([a-f0-9-]+)$/i);
    if (updateMatch && method === 'PUT') {
      return await handleUpdateEvent(request, userId, updateMatch[1], query);
    }

    // DELETE /events/:id
    if (updateMatch && method === 'DELETE') {
      return await handleDeleteEvent(userId, updateMatch[1], query);
    }

    // GET /feed.ics
    if (subpath === '/feed.ics' && method === 'GET') {
      return await handleICalFeed(userId, query);
    }

    // POST /optimal-dates
    if (subpath === '/optimal-dates' && method === 'POST') {
      return await handleOptimalDates(request, env);
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  } catch (error) {
    return reportHandledRouteError({ request, env, error, source: 'calendar' });
  }
}

// Color palette for client color-coding in practitioner calendar
const CLIENT_COLORS = [
  '#6C63FF', '#2ECC71', '#E056A0', '#FFD93D', '#FF6B6B',
  '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA'
];

async function handlePractitionerEvents(request, userId, query) {
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (!from || !to) {
    return Response.json({ error: 'from and to date params are required' }, { status: 400 });
  }

  // Get own events
  const ownResult = await query(QUERIES.getCalendarEventsByDateRange, [userId, from, to]);
  const ownEvents = (ownResult.rows || []).map(e => ({
    ...e,
    is_own: true,
    client_email: null,
    client_color: null
  }));

  // Get client events with color assignment
  const clientResult = await query(QUERIES.listPractitionerClientEvents, [userId, from, to]);
  const clientEmails = [...new Set((clientResult.rows || []).map(r => r.client_email))];
  const colorMap = {};
  clientEmails.forEach((email, i) => { colorMap[email] = CLIENT_COLORS[i % CLIENT_COLORS.length]; });

  const clientEvents = (clientResult.rows || []).map(e => ({
    ...e,
    is_own: false,
    client_color: colorMap[e.client_email]
  }));

  // Merge and sort by start_date
  const all = [...ownEvents, ...clientEvents].sort(
    (a, b) => new Date(a.start_date) - new Date(b.start_date)
  );

  return Response.json({
    ok: true,
    data: all,
    client_colors: colorMap
  });
}

async function handleListEvents(request, userId, query) {
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const allowed = getAllowedEventTypes(request);

  let result;
  if (from && to) {
    result = await query(QUERIES.getCalendarEventsByDateRange, [userId, from, to]);
  } else {
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 100, 500);
    const offset = Math.max(parseInt(url.searchParams.get('offset')) || 0, 0);
    result = await query(QUERIES.listCalendarEvents, [userId, limit, offset]);
  }

  // Filter by tier-allowed event types
  const rows = (result.rows || []).filter(e => allowed.includes(e.event_type));

  return Response.json({ ok: true, data: rows, allowed_types: allowed });
}

async function handleCreateEvent(request, userId, query) {
  const body = await request.json().catch(() => null);
  if (!body?.title || !body?.start_date) {
    return Response.json({ error: 'title and start_date are required' }, { status: 400 });
  }

  if (body.title.length > 500) {
    return Response.json({ error: 'Title must be 500 characters or less' }, { status: 400 });
  }

  const eventType = VALID_EVENT_TYPES.includes(body.event_type) ? body.event_type : 'personal';

  // Enforce tier-based event type gating
  const featureKey = EVENT_TYPE_TIER_MAP[eventType];
  if (featureKey) {
    const allowed = getAllowedEventTypes(request);
    if (!allowed.includes(eventType)) {
      trackEvent?.('calendar', 'calendar_tier_upgrade_prompted', featureKey);
      return Response.json({
        error: 'Feature not available in your current tier',
        feature: featureKey,
        upgrade_required: true,
        current_tier: request._tier || 'free'
      }, { status: 403 });
    }
  }

  const result = await query(QUERIES.createCalendarEvent, [
    userId,
    body.title,
    body.description || '',
    eventType,
    body.start_date,
    body.end_date || null,
    body.all_day || false,
    body.recurrence || null,
    body.color || null,
    body.source || 'manual',
    body.external_id || null,
    JSON.stringify(body.metadata || {}),
  ]);

  trackEvent?.('calendar', 'calendar_event_created', eventType);

  return Response.json({ ok: true, data: result.rows[0] }, { status: 201 });
}

async function handleUpdateEvent(request, userId, eventId, query) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return Response.json({ error: 'Request body required' }, { status: 400 });
  }

  const result = await query(QUERIES.updateCalendarEvent, [
    eventId,
    userId,
    body.title || null,
    body.description !== undefined ? body.description : null,
    body.event_type && VALID_EVENT_TYPES.includes(body.event_type) ? body.event_type : null,
    body.start_date || null,
    body.end_date !== undefined ? body.end_date : undefined,
    body.all_day !== undefined ? body.all_day : null,
    body.recurrence !== undefined ? body.recurrence : undefined,
    body.color !== undefined ? body.color : undefined,
    body.metadata ? JSON.stringify(body.metadata) : null,
  ]);

  if (!result.rows?.length) {
    return Response.json({ error: 'Event not found' }, { status: 404 });
  }

  return Response.json({ ok: true, data: result.rows[0] });
}

async function handleDeleteEvent(userId, eventId, query) {
  const result = await query(QUERIES.deleteCalendarEvent, [eventId, userId]);
  if (!result.rows?.length) {
    return Response.json({ error: 'Event not found' }, { status: 404 });
  }
  return Response.json({ ok: true });
}

function escapeICalText(text) {
  if (!text) return '';
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toICalDate(date) {
  const d = new Date(date);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

async function handleICalFeed(userId, query) {
  const result = await query(QUERIES.listCalendarEvents, [userId, 500, 0]);
  const events = result.rows || [];

  let ical = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Prime Self//Calendar//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n';

  events.forEach(e => {
    ical += 'BEGIN:VEVENT\r\n';
    ical += `UID:${e.id}@primeself.app\r\n`;
    ical += `DTSTART:${toICalDate(e.start_date)}\r\n`;
    if (e.end_date) ical += `DTEND:${toICalDate(e.end_date)}\r\n`;
    ical += `SUMMARY:${escapeICalText(e.title)}\r\n`;
    if (e.description) ical += `DESCRIPTION:${escapeICalText(e.description)}\r\n`;
    ical += `CATEGORIES:${e.event_type || 'personal'}\r\n`;
    ical += 'END:VEVENT\r\n';
  });

  ical += 'END:VCALENDAR\r\n';

  trackEvent?.('calendar', 'calendar_feed_subscribed', `${events.length} events`);

  return new Response(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="prime-self-calendar.ics"',
    },
  });
}

async function handleOptimalDates(request, env) {
  // Proxy to the existing timing engine
  const body = await request.json().catch(() => null);
  if (!body?.intention) {
    return Response.json({ error: 'intention is required' }, { status: 400 });
  }

  trackEvent?.('calendar', 'calendar_optimal_dates_searched', body.intention);

  // Forward to timing handler's find-dates logic
  const timingReq = new Request(new URL('/api/timing/find-dates', request.url).href, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(body),
  });
  timingReq._user = request._user;

  const { default: handleTiming } = await import('./timing.js');
  return handleTiming(timingReq, env, '/find-dates');
}
