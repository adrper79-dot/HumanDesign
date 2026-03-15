/**
 * Circuit Breaker — CTO-005
 *
 * Prevents cascading failures from external services (Stripe, SMS, push).
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery).
 *
 * Uses in-memory state (per-isolate). Each CF Worker isolate starts CLOSED,
 * which is safe because isolate lifespan is short (~30s after last request).
 */

const STATES = { CLOSED: 0, OPEN: 1, HALF_OPEN: 2 };

const breakers = new Map();

/**
 * @param {string} name    - Service identifier (e.g. 'stripe', 'sms', 'push')
 * @param {Object} [opts]
 * @param {number} [opts.threshold=5]    - Failures before opening
 * @param {number} [opts.resetMs=30000]  - Time before trying again
 */
function getBreaker(name, opts = {}) {
  if (breakers.has(name)) return breakers.get(name);
  const b = {
    state: STATES.CLOSED,
    failures: 0,
    lastFailure: 0,
    threshold: opts.threshold || 5,
    resetMs: opts.resetMs || 30_000,
  };
  breakers.set(name, b);
  return b;
}

/**
 * Wrap an async operation with circuit breaker protection.
 *
 * @param {string}   name - Service name
 * @param {Function} fn   - Async operation to protect
 * @param {Object}   [opts] - Breaker options
 * @returns {Promise<*>} Result from fn
 * @throws {Error} CircuitBreakerOpen if circuit is open
 */
export async function withCircuitBreaker(name, fn, opts) {
  const b = getBreaker(name, opts);

  if (b.state === STATES.OPEN) {
    if (Date.now() - b.lastFailure >= b.resetMs) {
      b.state = STATES.HALF_OPEN;
    } else {
      const err = new Error(`Circuit breaker OPEN for ${name}`);
      err.code = 'CIRCUIT_BREAKER_OPEN';
      throw err;
    }
  }

  try {
    const result = await fn();
    // Success — reset breaker
    b.failures = 0;
    b.state = STATES.CLOSED;
    return result;
  } catch (error) {
    b.failures++;
    b.lastFailure = Date.now();
    if (b.failures >= b.threshold) {
      b.state = STATES.OPEN;
    }
    throw error;
  }
}

/** Check if service circuit is currently open. */
export function isCircuitOpen(name) {
  const b = breakers.get(name);
  return b ? b.state === STATES.OPEN : false;
}
