/**
 * Google Calendar 2-Way Sync Handler — Item 3.2
 *
 * Separate OAuth consent flow for Google Calendar scope (independent of login).
 * Encrypted refresh token storage via tokenCrypto.js.
 *
 * Routes (delegated from calendar.js on /google/* subpaths):
 *   POST   /google/connect      — Initiate Google Calendar OAuth
 *   GET    /google/callback     — Handle OAuth callback
 *   POST   /google/sync         — 2-way sync (push + pull)
 *   POST   /google/import       — One-way pull from Google
 *   DELETE /google/disconnect   — Remove tokens + synced events
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { importEncryptionKey, encryptToken, decryptToken } from '../lib/tokenCrypto.js';
import { trackEvent } from '../lib/analytics.js';
import { createLogger } from '../lib/logger.js';

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/**
 * Main dispatcher — called from calendar.js when subpath starts with /google.
 * @param {Request} request
 * @param {Object} env
 * @param {string} subpath — e.g. '/connect', '/callback', '/sync', '/import', '/disconnect'
 * @param {string|null} userId — null for callback (recovered from state)
 */
export async function handleGoogleCalendar(request, env, subpath, userId) {
  const method = request.method;

  if (subpath === '/connect' && method === 'POST') {
    return handleConnect(request, env, userId);
  }
  if (subpath === '/callback' && method === 'GET') {
    // Callback is unauthenticated — user ID recovered from state
    return handleCallback(request, env);
  }
  if (subpath === '/sync' && method === 'POST') {
    return handleSync(request, env, userId);
  }
  if (subpath === '/import' && method === 'POST') {
    return handleImport(request, env, userId);
  }
  if (subpath === '/disconnect' && method === 'DELETE') {
    return handleDisconnect(env, userId);
  }

  return Response.json({ error: 'Not Found' }, { status: 404 });
}

// ─── Connect: Initiate Google Calendar OAuth ──────────────────

async function handleConnect(request, env, userId) {
  if (!env.GOOGLE_CLIENT_ID) {
    return Response.json({ error: 'Google integration not configured' }, { status: 503 });
  }

  const workerBase = env.BASE_URL || 'https://prime-self-api.adrper79.workers.dev';
  const redirectUri = `${workerBase}/api/calendar/google/callback`;
  const state = crypto.randomUUID();

  // Store state → userId mapping in KV (10-min TTL)
  if (env.CACHE) {
    await env.CACHE.put(`gcal_state:${state}`, userId, { expirationTtl: 600 });
  }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_CALENDAR_SCOPE);
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');

  return Response.json({ ok: true, url: url.toString() });
}

// ─── Callback: Exchange code, store encrypted tokens ──────────

async function handleCallback(request, env) {
  const frontendUrl = env.FRONTEND_URL || 'https://selfprime.net';
  const workerBase = env.BASE_URL || 'https://prime-self-api.adrper79.workers.dev';
  const redirectUri = `${workerBase}/api/calendar/google/callback`;

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return Response.redirect(`${frontendUrl}/?gcal=error&reason=${encodeURIComponent(error)}`, 302);
    }
    if (!code || !state) {
      return Response.redirect(`${frontendUrl}/?gcal=error&reason=missing_params`, 302);
    }

    // Recover userId from state
    let userId = null;
    if (env.CACHE) {
      userId = await env.CACHE.get(`gcal_state:${state}`);
      await env.CACHE.delete(`gcal_state:${state}`).catch(() => {});
    }
    if (!userId) {
      return Response.redirect(`${frontendUrl}/?gcal=error&reason=invalid_state`, 302);
    }

    // Exchange code for tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();

    if (tokens.error) {
      return Response.redirect(`${frontendUrl}/?gcal=error&reason=token_exchange_failed`, 302);
    }

    if (!tokens.refresh_token) {
      return Response.redirect(`${frontendUrl}/?gcal=error&reason=no_refresh_token`, 302);
    }

    // Encrypt tokens before storing
    const encKey = await getEncryptionKey(env);
    const encAccess = await encryptToken(tokens.access_token, encKey);
    const encRefresh = await encryptToken(tokens.refresh_token, encKey);

    const expiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    await query(QUERIES.storeGoogleCalendarToken, [
      userId, encAccess, encRefresh, expiry, 'primary',
    ]);

    trackEvent?.('calendar', 'google_calendar_connected', userId);

    return Response.redirect(`${frontendUrl}/?gcal=success`, 302);
  } catch (err) {
    createLogger('google-calendar').error('callback_error', { error: err.message });
    return Response.redirect(`${frontendUrl}/?gcal=error&reason=internal`, 302);
  }
}

// ─── Sync: 2-way sync (push local → Google, pull Google → local) ──

async function handleSync(request, env, userId) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const accessToken = await getValidAccessToken(userId, env, query);
  if (!accessToken) {
    return Response.json({ error: 'Google Calendar not connected. Please connect first.' }, { status: 400 });
  }

  const tokenRow = (await query(QUERIES.getGoogleCalendarToken, [userId])).rows[0];
  const calendarId = tokenRow.calendar_id || 'primary';

  // 1. Push local manual events to Google
  const localEvents = await query(QUERIES.listCalendarEvents, [userId, 500, 0]);
  const pushable = (localEvents.rows || []).filter(e => e.source === 'manual' && !e.external_id);
  let pushed = 0;

  for (const evt of pushable) {
    const gcalEvent = toGoogleEvent(evt);
    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gcalEvent),
    });
    if (res.ok) {
      const created = await res.json();
      // Mark with external_id so we don't push again
      await query(QUERIES.updateCalendarEvent, [
        evt.id, userId,
        null, null, null, null, null, null, null, null,
        JSON.stringify({ ...JSON.parse(evt.metadata || '{}'), google_event_id: created.id }),
      ]);
      pushed++;
    }
  }

  // 2. Pull Google events to local
  const imported = await pullGoogleEvents(userId, accessToken, calendarId, query, tokenRow.sync_token);

  trackEvent?.('calendar', 'google_calendar_synced', `pushed:${pushed},pulled:${imported.count}`);

  // Save sync token for incremental sync next time
  if (imported.nextSyncToken) {
    await query(QUERIES.updateGoogleCalSyncToken, [userId, imported.nextSyncToken]);
  }

  return Response.json({
    ok: true,
    pushed,
    pulled: imported.count,
    lastSynced: new Date().toISOString(),
  });
}

// ─── Import: One-way pull from Google ─────────────────────────

async function handleImport(request, env, userId) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const accessToken = await getValidAccessToken(userId, env, query);
  if (!accessToken) {
    return Response.json({ error: 'Google Calendar not connected' }, { status: 400 });
  }

  const tokenRow = (await query(QUERIES.getGoogleCalendarToken, [userId])).rows[0];
  const calendarId = tokenRow.calendar_id || 'primary';
  const imported = await pullGoogleEvents(userId, accessToken, calendarId, query, null);

  if (imported.nextSyncToken) {
    await query(QUERIES.updateGoogleCalSyncToken, [userId, imported.nextSyncToken]);
  }

  trackEvent?.('calendar', 'google_calendar_imported', `${imported.count} events`);

  return Response.json({ ok: true, imported: imported.count });
}

// ─── Disconnect: Remove tokens + synced events ───────────────

async function handleDisconnect(env, userId) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  await query(QUERIES.deleteGoogleCalendarToken, [userId]);

  trackEvent?.('calendar', 'google_calendar_disconnected', userId);

  return Response.json({ ok: true });
}

// ─── Internal helpers ─────────────────────────────────────────

async function getEncryptionKey(env) {
  const secret = env.GOOGLE_TOKEN_ENCRYPTION_KEY || env.NOTION_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error('Token encryption key not configured');
  return importEncryptionKey(secret);
}

/**
 * Get a valid access token, refreshing if expired.
 */
async function getValidAccessToken(userId, env, query) {
  const result = await query(QUERIES.getGoogleCalendarToken, [userId]);
  if (!result.rows?.length) return null;

  const row = result.rows[0];
  const encKey = await getEncryptionKey(env);

  // Check if token is expired (with 5-min buffer)
  const isExpired = row.token_expiry && new Date(row.token_expiry) < new Date(Date.now() + 5 * 60000);

  if (!isExpired) {
    return decryptToken(row.encrypted_access_token, encKey);
  }

  // Refresh the access token
  const refreshToken = await decryptToken(row.encrypted_refresh_token, encKey);
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tokens = await tokenRes.json();

  if (tokens.error) {
    // Refresh token revoked or expired — user must reconnect
    await query(QUERIES.deleteGoogleCalendarToken, [userId]);
    return null;
  }

  // Store updated access token
  const encAccess = await encryptToken(tokens.access_token, encKey);
  const encRefresh = tokens.refresh_token
    ? await encryptToken(tokens.refresh_token, encKey)
    : row.encrypted_refresh_token; // Google doesn't always return new refresh token

  const expiry = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  await query(QUERIES.storeGoogleCalendarToken, [
    userId, encAccess, encRefresh, expiry, row.calendar_id,
  ]);

  return tokens.access_token;
}

/**
 * Pull events from Google Calendar into local calendar_events.
 */
async function pullGoogleEvents(userId, accessToken, calendarId, query, syncToken) {
  const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('maxResults', '250');
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  if (syncToken) {
    url.searchParams.set('syncToken', syncToken);
  } else {
    // Initial sync: get events from the past 30 days to 1 year ahead
    const timeMin = new Date(Date.now() - 30 * 86400000).toISOString();
    const timeMax = new Date(Date.now() + 365 * 86400000).toISOString();
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return { count: 0, nextSyncToken: null };
  }

  const data = await res.json();
  const events = data.items || [];
  let count = 0;

  for (const gcalEvent of events) {
    if (gcalEvent.status === 'cancelled') continue;

    const startDate = gcalEvent.start?.dateTime || gcalEvent.start?.date;
    const endDate = gcalEvent.end?.dateTime || gcalEvent.end?.date;
    const allDay = !gcalEvent.start?.dateTime;

    if (!startDate) continue;

    // Upsert: check if we already have this event
    const existing = await query(
      `SELECT id FROM calendar_events WHERE user_id = $1 AND source = 'google_calendar' AND external_id = $2`,
      [userId, gcalEvent.id]
    );

    if (existing.rows?.length) {
      // Update existing
      await query(QUERIES.updateCalendarEvent, [
        existing.rows[0].id, userId,
        (gcalEvent.summary || 'Untitled').slice(0, 500),
        gcalEvent.description || null,
        null, // keep existing event_type
        startDate,
        endDate || null,
        allDay,
        null, null, null,
      ]);
    } else {
      // Create new
      await query(QUERIES.createCalendarEvent, [
        userId,
        (gcalEvent.summary || 'Untitled').slice(0, 500),
        gcalEvent.description || '',
        'personal',
        startDate,
        endDate || null,
        allDay,
        null, // recurrence
        null, // color
        'google_calendar',
        gcalEvent.id,
        JSON.stringify({ google_calendar_id: calendarId }),
      ]);
      count++;
    }
  }

  return { count, nextSyncToken: data.nextSyncToken || null };
}

/**
 * Map a local calendar event to a Google Calendar event object.
 */
function toGoogleEvent(evt) {
  const event = {
    summary: evt.title,
    description: evt.description || '',
  };

  if (evt.all_day) {
    // All-day events use date (YYYY-MM-DD) format
    event.start = { date: evt.start_date.slice(0, 10) };
    event.end = { date: (evt.end_date || evt.start_date).slice(0, 10) };
  } else {
    event.start = { dateTime: evt.start_date };
    event.end = { dateTime: evt.end_date || evt.start_date };
  }

  return event;
}
