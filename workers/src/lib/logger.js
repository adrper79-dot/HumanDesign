/**
 * Structured JSON Logger for Cloudflare Workers
 *
 * Every log line is a single JSON object — searchable via Cloudflare Logpush
 * and Tail Workers. No plain-text console.log() in production code.
 *
 * Format:
 *   { level, ts, reqId, msg, ...fields }
 *
 * Usage:
 *   import { createLogger, generateRequestId } from '../lib/logger.js';
 *
 *   // In the fetch handler (index.js):
 *   const reqId = generateRequestId();
 *   const log   = createLogger(reqId);
 *   request._reqId = reqId;
 *   request._log   = log;
 *
 *   // In any handler:
 *   request._log.info('Chart calculated', { userId, durationMs: 42 });
 *   request._log.error('DB query failed', { error: err.message, query: 'getChart' });
 *
 * Levels: debug < info < warn < error
 * In production, only info/warn/error are typically captured by Logpush.
 */

/**
 * Truncate a UUID or Stripe/Neon ID for inclusion in log fields.
 *
 * Policy (CTO-012/CISO-008): User IDs and subscription IDs must NOT appear
 * in full in Cloudflare Tail Workers / Logpush output, as log retention
 * creates a GDPR-adjacent audit trail. The first 8 characters of a UUID are
 * sufficient for log correlation without enabling PII re-identification.
 *
 * Full IDs remain in the DB, never in log lines.
 *
 * @param {string|null|undefined} id
 * @returns {string} — first 8 chars + "…", e.g. "a3b4c5d6…"
 */
export function sanitizeId(id) {
  if (!id || typeof id !== 'string') return id;
  return id.length > 8 ? id.slice(0, 8) + '\u2026' : id;
}

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Generate a short, URL-safe request correlation ID.
 * 12 hex chars = 48 bits of entropy — sufficient for per-request deduplication.
 *
 * @returns {string} e.g. "a3f1c9e20b4d"
 */
export function generateRequestId() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a request-scoped logger.
 * All methods emit a single-line JSON object to stdout (console.log).
 *
 * @param {string} reqId - correlation ID from generateRequestId()
 * @param {string} [minLevel='debug'] - suppress levels below this
 * @returns {{ debug, info, warn, error }}
 */
export function createLogger(reqId, minLevel = 'debug') {
  const minLevelNum = LOG_LEVELS[minLevel] ?? 0;

  function emit(level, msg, fields = {}) {
    if ((LOG_LEVELS[level] ?? 0) < minLevelNum) return;
    // Single-line JSON — Cloudflare Logpush parses line-by-line
    console.log(JSON.stringify({
      level,
      ts: new Date().toISOString(),
      reqId,
      msg,
      ...fields,
    }));
  }

  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info:  (msg, fields) => emit('info',  msg, fields),
    warn:  (msg, fields) => emit('warn',  msg, fields),
    error: (msg, fields) => emit('error', msg, fields),

    /**
     * Convenience: log a DB call duration.
     * @param {string} query - query name or summary
     * @param {number} durationMs
     * @param {object} [extra]
     */
    db: (query, durationMs, extra = {}) => emit('info', 'db_query', { query, durationMs, ...extra }),

    /**
     * Convenience: log an external service call.
     * @param {string} service - 'stripe' | 'resend' | 'telnyx' | 'anthropic' | ...
     * @param {string} operation
     * @param {number} durationMs
     * @param {string} [status] - 'ok' | 'error' | 'timeout'
     */
    external: (service, operation, durationMs, status = 'ok', extra = {}) =>
      emit('info', 'external_call', { service, operation, durationMs, status, ...extra }),
  };
}

/**
 * No-op logger for use when request context is unavailable (e.g. cron jobs
 * that don't have a request ID). Still emits structured JSON with reqId='cron'.
 *
 * @param {string} [tag='cron']
 */
export function createCronLogger(tag = 'cron') {
  return createLogger(tag);
}
