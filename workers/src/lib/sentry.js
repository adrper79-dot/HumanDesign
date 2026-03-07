/**
 * Sentry Error Tracking Integration (BL-ANA-004)
 *
 * Lightweight Sentry client for Cloudflare Workers.
 * Uses Sentry's envelope API directly — no SDK dependency needed.
 *
 * Features:
 *   - Structured error capture with stack traces
 *   - Request context (URL, method, headers)
 *   - User context (user_id, tier)
 *   - Release tracking via SENTRY_RELEASE env var
 *   - Error fingerprinting for deduplication
 *   - Breadcrumb support for context trail
 *
 * Usage:
 *   import { captureException, addBreadcrumb, initSentry } from '../lib/sentry.js';
 *
 *   const sentry = initSentry(env);
 *   sentry.addBreadcrumb({ message: 'User clicked checkout' });
 *   sentry.captureException(error, { request, user: request._user });
 */

/**
 * Initialize Sentry context for the current request.
 * Returns a scoped Sentry instance with breadcrumbs.
 *
 * @param {object} env - Worker environment bindings
 * @returns {object} Sentry instance with captureException, addBreadcrumb
 */
export function initSentry(env) {
  const dsn = env?.SENTRY_DSN;
  const release = env?.SENTRY_RELEASE || env?.ENVIRONMENT || 'unknown';
  const breadcrumbs = [];

  if (!dsn) {
    // Return no-op instance when Sentry is not configured
    return {
      captureException: () => Promise.resolve(),
      captureMessage: () => Promise.resolve(),
      addBreadcrumb: () => {},
    };
  }

  const { projectId, publicKey, host } = parseDSN(dsn);

  return {
    /**
     * Add a breadcrumb for context trail.
     * @param {{ category?: string, message: string, level?: string, data?: object }} crumb
     */
    addBreadcrumb(crumb) {
      breadcrumbs.push({
        timestamp: Date.now() / 1000,
        category: crumb.category || 'default',
        message: crumb.message,
        level: crumb.level || 'info',
        data: crumb.data,
      });
      // Keep only last 20 breadcrumbs
      if (breadcrumbs.length > 20) breadcrumbs.shift();
    },

    /**
     * Capture an exception and send to Sentry.
     * Fire-and-forget — never blocks the request.
     *
     * @param {Error} error
     * @param {{ request?: Request, user?: object, tags?: object, extra?: object }} context
     */
    async captureException(error, context = {}) {
      try {
        const event = buildEvent(error, {
          ...context,
          breadcrumbs,
          release,
          environment: env.ENVIRONMENT || 'production',
        });

        await sendToSentry(host, projectId, publicKey, event);
      } catch (sendErr) {
        console.error('[Sentry] Failed to send event:', sendErr.message);
      }
    },

    /**
     * Capture a message (non-error) event.
     *
     * @param {string} message
     * @param {string} [level='info'] - 'info', 'warning', 'error'
     * @param {{ tags?: object, extra?: object }} context
     */
    async captureMessage(message, level = 'info', context = {}) {
      try {
        const event = {
          event_id: generateEventId(),
          timestamp: Date.now() / 1000,
          platform: 'javascript',
          level,
          message: { formatted: message },
          release,
          environment: env.ENVIRONMENT || 'production',
          tags: context.tags || {},
          extra: context.extra || {},
          breadcrumbs: { values: [...breadcrumbs] },
        };

        await sendToSentry(host, projectId, publicKey, event);
      } catch (sendErr) {
        console.error('[Sentry] Failed to send message:', sendErr.message);
      }
    },
  };
}

// ─── DSN Parsing ─────────────────────────────────────────────────────

function parseDSN(dsn) {
  // Format: https://<public_key>@<host>/<project_id>
  const url = new URL(dsn);
  return {
    publicKey: url.username,
    host: `${url.protocol}//${url.host}`,
    projectId: url.pathname.replace('/', ''),
  };
}

// ─── Event Building ──────────────────────────────────────────────────

function buildEvent(error, context = {}) {
  const event = {
    event_id: generateEventId(),
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    release: context.release,
    environment: context.environment,
    exception: {
      values: [{
        type: error?.constructor?.name || 'Error',
        value: error?.message || String(error),
        stacktrace: error?.stack ? parseStackTrace(error.stack) : undefined,
      }],
    },
    tags: {
      runtime: 'cloudflare-workers',
      ...context.tags,
    },
    extra: context.extra || {},
    breadcrumbs: {
      values: context.breadcrumbs || [],
    },
  };

  // Add request context
  if (context.request) {
    const req = context.request;
    const url = new URL(req.url);
    event.request = {
      url: url.toString(),
      method: req.method,
      headers: sanitizeHeaders(req.headers),
      query_string: url.search,
    };
    event.tags.path = url.pathname;
    event.tags.method = req.method;
  }

  // Add user context
  if (context.user) {
    event.user = {
      id: context.user.sub || context.user.id,
      email: context.user.email,
    };
    if (context.user.tier) {
      event.tags.tier = context.user.tier;
    }
  }

  // Fingerprint for deduplication
  event.fingerprint = [
    error?.constructor?.name || 'Error',
    error?.message?.replace(/[0-9a-f-]{36}/g, '<uuid>').replace(/\d+/g, '<n>') || 'unknown',
    context.request ? new URL(context.request.url).pathname : 'no-request',
  ];

  return event;
}

// ─── Stack Trace Parsing ─────────────────────────────────────────────

function parseStackTrace(stack) {
  if (!stack) return undefined;

  const frames = stack
    .split('\n')
    .slice(1) // Skip the error message line
    .map(line => {
      const match = line.match(/at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):(\d+)\)?/);
      if (!match) return null;
      return {
        function: match[1] || '<anonymous>',
        filename: match[2],
        lineno: parseInt(match[3], 10),
        colno: parseInt(match[4], 10),
      };
    })
    .filter(Boolean)
    .reverse(); // Sentry expects oldest frame first

  return { frames };
}

// ─── Envelope Transport ──────────────────────────────────────────────

async function sendToSentry(host, projectId, publicKey, event) {
  const envelope = buildEnvelope(event, publicKey, projectId);
  const url = `${host}/api/${projectId}/envelope/`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}`,
    },
    body: envelope,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Sentry] API error:', response.status, text);
  }
}

function buildEnvelope(event, publicKey, projectId) {
  const header = JSON.stringify({
    event_id: event.event_id,
    dsn: `https://${publicKey}@sentry.io/${projectId}`,
    sent_at: new Date().toISOString(),
  });
  const itemHeader = JSON.stringify({
    type: 'event',
    content_type: 'application/json',
  });
  const payload = JSON.stringify(event);

  return `${header}\n${itemHeader}\n${payload}`;
}

// ─── Utilities ───────────────────────────────────────────────────────

function generateEventId() {
  // 32 hex chars, no dashes
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeHeaders(headers) {
  const safe = {};
  const allowList = ['content-type', 'accept', 'user-agent', 'referer', 'origin', 'cf-ipcountry'];
  for (const key of allowList) {
    const val = headers.get(key);
    if (val) safe[key] = val;
  }
  return safe;
}
