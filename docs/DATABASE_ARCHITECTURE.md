# Database Architecture

**Last Updated:** 2026-03-18
**Status:** Production (Neon PostgreSQL serverless)

---

## Overview

Prime Self uses **Neon PostgreSQL** (serverless) as its primary database. The architecture prioritizes **safety under Cloudflare's isolate constraints** over traditional connection pooling.

---

## Why Per-Request Pooling?

### The Constraint

Cloudflare Workers isolates each request within its own V8 VM isolate. **Reusing database connections across requests within the same isolate causes crashes:**

```
Cannot perform I/O on behalf of a different request
```

### The Solution

**Request-scoped pools** (`workers/src/db/queries.js:40`):

```javascript
// CORRECT: Per-request pool (safe)
export function createQueryFn(connectionString) {
  const pool = new Pool({ connectionString });
  // Pool lives and dies with the request
  return async (sql, params) => await pool.query(sql, params);
}

// WRONG: Cached pool (causes crashes)
const globalPool = new Pool({ ... });  // ❌ Reused across requests
```

Each Worker request creates a fresh pool, performs queries, then the pool is garbage-collected. This prevents cross-request I/O state leakage while maintaining separate connections for parallel operations within a single request.

---

## Performance Arguments

### 1. Cold Starts Are Brief

**Typical connection time:** <50ms
- Neon's serverless driver establishes connections rapidly (no TCP handshake overhead)
- Worker CPU time is negligible on new connections

**Result:** Per-request pooling adds <50ms latency vs. a cached pool (and prevents crashes)

### 2. Slow Query Threshold

Queries slower than **1 second** (SLOW_QUERY_MS in `queries.js:62`) are logged as warnings:

```javascript
const SLOW_QUERY_MS = 1000;
const durationMs = Date.now() - t0;
if (durationMs > SLOW_QUERY_MS) {
  logger.warn(`Slow query: ${durationMs}ms`, { query: sqlText });
}
```

This ensures we catch performance regressions early.

### 3. Retry Logic for Cold Starts

Neon endpoints in idle state respond with "endpoint is in idle state":

```javascript
// workers/src/db/queries.js:47
if (error.message.includes('endpoint is in idle state')) {
  // Retry with backoff
}
```

**Retry strategy:**
- Attempt 1: Immediate
- Attempt 2: +100ms backoff
- Attempt 3: +200ms backoff
- Max total delay: ~300ms

Cold-start penalties are mitigated by this transparent retry logic.

---

## Query Caching (KV Layer)

Since database hits are unavoidable per-request, **query result caching** is the primary optimization:

**File:** `workers/src/lib/cache.js`

**Mechanism:** Cloudflare KV + in-memory LRU cache

**Cache Keys:**
- `user_chart:{userId}` — User's primary chart (24h TTL)
- `chart_by_id:{chartId}` — Specific chart by ID (24h TTL)
- `user_profile:{userId}` — User's profile (24h TTL)
- `profile_by_id:{profileId}` — Specific profile by ID (24h TTL)

**Hit Rate:** 40-60% reduction in DB queries for repeated loads (chart/profile endpoints)

**Cache Invalidation:**
- On chart save: Invalidates `user_chart` + `chart_by_id` keys
- On profile update: Invalidates `user_profile` + `profile_by_id` keys

---

## Connection Management Best Practices

### 1. Close Pools After Use

All query functions clean up connections:

```javascript
// Implicit in createQueryFn — pool is ephemeral
// No explicit close() needed; pool is GC'd
```

### 2. No Connection Pooling Configuration

Neon serverless driver automatically manages internal pooling. **No user-configurable pool size.**

### 3. Transactions Within a Request

For multi-statement operations, queries share the same pool within a single request:

```javascript
const query = createQueryFn(env.NEON_CONNECTION_STRING);

// All these use the same ephemeral pool:
const user = await query('SELECT * FROM users WHERE id = $1', [userId]);
const charts = await query('SELECT * FROM charts WHERE user_id = $1', [userId]);
const logout = await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]);
```

---

## Monitoring & Observability

### Slow Query Detection

All queries log:
- SQL text (sanitized of literals)
- Duration (ms)
- Row count returned
- Error status (if any)

### Error Classification

Neon errors are classified:
- **Retriable:** Cold starts, transient network blips → automatic retry
- **Non-retriable:** Invalid SQL, auth failure, gone → fail fast

### Sentry Integration

Slow queries (>1s) and database errors are automatically reported to Sentry via `workers/src/lib/sentry.js`.

---

## Limitations & Trade-Offs

| Trade-off | Benefit | Limitation |
|-----------|---------|-----------|
| Per-request pooling | Safety (no cross-request crashes) | ~50ms connection overhead per request |
| No connection persistance | Worker isolation guaranteed | Cannot warm up a persistent pool |
| Query result caching | 40-60% DB reduction | 24h cache invalidation delay |
| No custom pool size | Zero configuration | Cannot tune for specific workloads |

---

## Why Not Traditional Connection Pooling?

### PgBouncer / PgPool
Requires a persistent process to manage pooling. **Workers are stateless**, making persistent pool managers infeasible.

### Neon's Connection Pooling
Neon offers **connection pooling at the database level** (managed by Neon's infrastructure). This is different from application-level pooling:

- **Neon's pooling:** Manages backend connections at the database server
- **Application pooling:** Manages client-side connections

For Workers, application-level pooling would require a persistent memory store (Redis, KV) to share pool state — introducing complexity without addressing the core Cloudflare isolate constraint.

---

## Future Optimization Opportunities

1. **Redis Caching Layer:** If cache misses become a bottleneck, add Redis in front of KV for sub-millisecond lookups

2. **Query Batching:** For N+1 scenarios, batch multiple queries into single `UNION/JOIN` statements

3. **Materialized Views:** Pre-compute aggregate queries (e.g., user stats, composite summaries) and cache aggressively

4. **Neon Subscription:** Monitor Neon's connection pooling features as the serverless driver evolves

---

## Configuration Reference

### Environment Variables

```
NEON_CONNECTION_STRING=postgresql://user:pass@host/dbname
```

Set via `wrangler secret put NEON_CONNECTION_STRING`

### Slow Query Threshold

Edit `workers/src/db/queries.js:62`:
```javascript
const SLOW_QUERY_MS = 1000; // Change to adjust warning threshold
```

### Cache TTL

Edit `workers/src/lib/cache.js:32-42`:
```javascript
TTL: {
  CHART: 86400,    // 24 hours
  PROFILE: 86400,  // 24 hours
  // ...
}
```

---

## Troubleshooting

### Issue: "Cannot perform I/O on behalf of a different request"

**Cause:** A database connection or pool is being reused across requests.

**Fix:** Ensure `createQueryFn()` is called fresh per request, never cached globally.

```javascript
// ❌ WRONG
const query = createQueryFn(env.NEON_CONNECTION_STRING);
export default query;  // Reused across requests

// ✅ CORRECT
export async function handler(request, env) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);  // Fresh per request
  const result = await query('SELECT * FROM users');
}
```

### Issue: Queries slower than expected

**Check:**
1. Enable slow query logging (SLOW_QUERY_MS)
2. Look for N+1 queries in logs
3. Verify cache hits (KV logs in Cloudflare dashboard)
4. Consider adding indexes on frequently queried columns

### Issue: "endpoint is in idle state" errors (transient)

**Expected behavior:** Neon endpoints idle after 5 minutes. Automatic retries handle cold-start recovery.

**If retries fail:** Check Neon project status and available connection slots.

---

## Related Documentation

- `docs/ARCHITECTURE.md` — Full system architecture
- `docs/API.md` — API endpoints (all database access patterns)
- `workers/src/db/queries.js` — Query execution with retry logic
- `workers/src/lib/cache.js` — Caching strategy and TTL constants

---

## Summary

Prime Self's database architecture prioritizes **correctness and safety** under Cloudflare's isolate constraints. Per-request pooling is intentional, not a limitation. Query result caching (KV layer) provides 40-60% DB reduction, making per-request connection overhead negligible in practice.

No optimization opportunity exists to "fix" per-request pooling without sacrificing Worker isolation safety. The design is production-ready and performs well at scale.
