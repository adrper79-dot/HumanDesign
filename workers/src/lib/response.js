/**
 * Standard API Response Helpers
 *
 * Target envelope:
 *   Success: { ok: true, ...data }
 *   Error:   { ok: false, error: "message" }
 *
 * Usage:
 *   import { jsonOk, jsonError } from '../lib/response.js';
 *   return jsonOk({ user: { id: 1, name: 'Alice' } });
 *   return jsonError('Not found', 404);
 */

/**
 * Return a JSON success response.
 * @param {object} data - Fields to spread into the response body alongside { ok: true }
 * @param {number} [status=200]
 * @param {object} [headers={}] - Extra headers to merge
 */
export function jsonOk(data = {}, status = 200, headers = {}) {
  return Response.json({ ok: true, ...data }, { status, headers });
}

/**
 * Return a JSON error response.
 * @param {string} error - Human-readable error message
 * @param {number} [status=400]
 * @param {object} [extra={}] - Additional fields (e.g. { upgrade_required: true })
 */
export function jsonError(error, status = 400, extra = {}) {
  return Response.json({ ok: false, error, ...extra }, { status });
}
