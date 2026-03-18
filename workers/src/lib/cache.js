/**
 * Caching Strategy (BL-OPT-003)
 *
 * Unified caching layer for Prime Self — wraps Cloudflare KV with:
 * - Cache-aside pattern (getOrSet)
 * - Key builders for every cacheable entity
 * - TTL constants
 * - Per-isolate in-memory LRU for ultra-hot data
 * - Batch operations
 * - Explicit invalidation
 *
 * All methods are fail-safe — cache errors never break the caller.
 *
 * Usage:
 *   import { kvCache, keys, TTL } from '../lib/cache.js';
 *
 *   // Cache-aside (most common)
 *   const chart = await kvCache.getOrSet(env, keys.chart(birth), TTL.CHART, () => {
 *     return calculateFullChart(birth);
 *   });
 *
 *   // Manual get / put / delete
 *   await kvCache.put(env, 'my:key', data, 3600);
 *   const val = await kvCache.get(env, 'my:key');
 *   await kvCache.del(env, 'my:key');
 */

// ─── TTL Constants (seconds) ────────────────────────────────────────────

export const TTL = Object.freeze({
  /** Natal chart (deterministic, invalidated on engine updates) */
  CHART: 86_400,          // 24 hours
  /** Geocoding results (external API, rarely changes) */
  GEO: 2_592_000,         // 30 days
  /** Today's transit positions (same for all users, changes daily) */
  TRANSIT_DAY: 3_600,     // 1 hour (cron refreshes daily)
  /** Celebrity chart data (static JSON, never changes) */
  CELEBRITY: 604_800,     // 7 days
  /** Public stats / leaderboard aggregations */
  STATS: 300,             // 5 minutes
  /** Profile AI synthesis (expensive LLM call) */
  PROFILE: 86_400,        // 24 hours
  /** Composite / synastry overlay */
  COMPOSITE: 86_400,      // 24 hours
  /** Onboarding progress (persistent, rarely changes) */
  ONBOARDING: 31_536_000, // 365 days
});


// ─── Key Builders ───────────────────────────────────────────────────────

export const keys = Object.freeze({
  /**
   * Natal chart key — deterministic by birth params.
   * @param {string} birthDate - YYYY-MM-DD
   * @param {string} birthTime - HH:MM
   * @param {number} lat
   * @param {number} lng
   */
  chart: (birthDate, birthTime, lat, lng) =>
    `chart:${birthDate}:${birthTime}:${lat}:${lng}`,

  /** Geocoding result by query string */
  geo: (query) => `geo:${query.toLowerCase().trim()}`,

  /** Today's transit snapshot (global, keyed by date) */
  transit: (dateStr) => `transit:${dateStr}`,

  /** Celebrity natal chart by ID */
  celebrity: (celebId) => `celeb:${celebId}`,

  /** Composite / synastry overlay (sorted pair for dedup) */
  composite: (paramsA, paramsB) => {
    const a = `${paramsA.birthDate}:${paramsA.birthTime}:${paramsA.lat}:${paramsA.lng}`;
    const b = `${paramsB.birthDate}:${paramsB.birthTime}:${paramsB.lat}:${paramsB.lng}`;
    // Sort to ensure A+B === B+A
    return a < b ? `composite:${a}|${b}` : `composite:${b}|${a}`;
  },

  /** Public stats cache by stat type */
  stats: (statType) => `stats:${statType}`,

  /** Onboarding progress — single compound key per user */
  onboarding: (userId) => `onboarding:${userId}`,

  /** User's most recent chart (for /api/chart/history or profile generation handoff) */
  userChart: (userId) => `user_chart:${userId}`,

  /** User's most recent AI profile (for re-access without re-synthesis) */
  userProfile: (userId) => `user_profile:${userId}`,

  /** Specific chart by ID (database-backed) */
  chartById: (chartId) => `chart_by_id:${chartId}`,

  /** Specific profile by ID (database-backed) */
  profileById: (profileId) => `profile_by_id:${profileId}`,



  /** Rate limit (existing pattern preserved) */
  rateLimit: (clientId, path) => `rl:${clientId}:${path}`,
});


// ─── In-Memory LRU Cache (per-isolate) ─────────────────────────────────

const MEM_MAX_SIZE = 50;       // Max entries per isolate
const MEM_DEFAULT_TTL = 30_000; // 30 seconds default

/** @type {Map<string, { value: any, expires: number }>} */
const memCache = new Map();

/**
 * Per-isolate in-memory cache for ultra-hot data.
 * Uses Map insertion order for LRU eviction.
 */
export const mem = Object.freeze({
  /**
   * Get from in-memory cache.
   * @param {string} key
   * @returns {any|undefined}
   */
  get(key) {
    const entry = memCache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expires) {
      memCache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    memCache.delete(key);
    memCache.set(key, entry);
    return entry.value;
  },

  /**
   * Put into in-memory cache.
   * @param {string} key
   * @param {any} value
   * @param {number} [ttlMs=30000] - TTL in milliseconds
   */
  set(key, value, ttlMs = MEM_DEFAULT_TTL) {
    // Evict oldest if at capacity
    if (memCache.size >= MEM_MAX_SIZE && !memCache.has(key)) {
      const oldest = memCache.keys().next().value;
      memCache.delete(oldest);
    }

    memCache.set(key, {
      value,
      expires: Date.now() + ttlMs,
    });
  },

  /** Delete a specific key */
  delete(key) {
    memCache.delete(key);
  },

  /** Clear all in-memory entries */
  clear() {
    memCache.clear();
  },

  /** Current size */
  get size() {
    return memCache.size;
  },
});


// ─── KV Cache Operations ────────────────────────────────────────────────

export const kvCache = Object.freeze({
  /**
   * Get a value from KV cache.
   * Returns undefined on miss or error (fail-safe).
   *
   * @param {object} env - Worker env with CACHE binding
   * @param {string} key
   * @returns {Promise<any|undefined>}
   */
  async get(env, key) {
    if (!env?.CACHE) return undefined;

    try {
      const raw = await env.CACHE.get(key, 'json');
      return raw ?? undefined;
    } catch {
      return undefined;
    }
  },

  /**
   * Store a value in KV cache.
   * Silently fails on error (fire-and-forget safe).
   *
   * @param {object} env
   * @param {string} key
   * @param {any} value - Must be JSON-serializable
   * @param {number} ttlSeconds
   */
  async put(env, key, value, ttlSeconds) {
    if (!env?.CACHE) return;

    try {
      await env.CACHE.put(key, JSON.stringify(value), {
        expirationTtl: ttlSeconds,
      });
    } catch {
      // Fail-safe: never break caller over cache write
    }
  },

  /**
   * Delete a specific key from KV cache.
   *
   * @param {object} env
   * @param {string} key
   */
  async del(env, key) {
    if (!env?.CACHE) return;

    try {
      await env.CACHE.delete(key);
    } catch {
      // Fail-safe
    }
  },

  /**
   * Cache-aside pattern: get from cache, or compute + store.
   * This is the primary caching method — use it everywhere.
   *
   * @param {object} env
   * @param {string} key
   * @param {number} ttlSeconds
   * @param {() => Promise<any>} fetchFn - Async function to compute on miss
   * @param {object} [opts]
   * @param {boolean} [opts.memCache=false] - Also cache in per-isolate memory
   * @param {number} [opts.memTtlMs=30000] - Memory cache TTL in ms
   * @returns {Promise<{ data: any, cached: boolean }>}
   */
  async getOrSet(env, key, ttlSeconds, fetchFn, opts = {}) {
    // 1. Check in-memory cache first (fastest)
    if (opts.memCache) {
      const memHit = mem.get(key);
      if (memHit !== undefined) {
        return { data: memHit, cached: true };
      }
    }

    // 2. Check KV cache
    const kvHit = await this.get(env, key);
    if (kvHit !== undefined) {
      // Populate memory cache on KV hit
      if (opts.memCache) {
        mem.set(key, kvHit, opts.memTtlMs);
      }
      return { data: kvHit, cached: true };
    }

    // 3. Cache miss — compute value
    const data = await fetchFn();

    // 4. Store in KV (fire-and-forget)
    this.put(env, key, data, ttlSeconds).catch(e => {
      console.warn(JSON.stringify({ event: 'cache_put_failed', key, error: e.message }));
    });

    // 5. Store in memory
    if (opts.memCache) {
      mem.set(key, data, opts.memTtlMs);
    }

    return { data, cached: false };
  },

  /**
   * Batch get multiple keys from KV.
   * Useful for eliminating N+1 KV lookups (e.g., onboarding progress).
   *
   * Note: Cloudflare KV has no native batch-get API, so this runs
   * concurrent individual gets with Promise.allSettled. Still much
   * faster than sequential gets due to parallelism.
   *
   * @param {object} env
   * @param {string[]} cacheKeys
   * @returns {Promise<Map<string, any>>} Map of key → value (misses excluded)
   */
  async getMany(env, cacheKeys) {
    if (!env?.CACHE || !cacheKeys.length) return new Map();

    const results = await Promise.allSettled(
      cacheKeys.map(async (key) => {
        const val = await env.CACHE.get(key, 'json');
        return { key, val };
      })
    );

    const map = new Map();
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.val != null) {
        map.set(r.value.key, r.value.val);
      }
    }

    return map;
  },

  /**
   * Delete all keys matching a prefix using KV list API.
   * Useful for cache invalidation (e.g., bust all "chart:*" after engine update).
   *
   * @param {object} env
   * @param {string} prefix - Key prefix to match
   * @param {number} [limit=100] - Max keys to delete per call
   * @returns {Promise<number>} Number of keys deleted
   */
  async invalidatePrefix(env, prefix, limit = 100) {
    if (!env?.CACHE) return 0;

    try {
      const list = await env.CACHE.list({ prefix, limit });
      const deletes = list.keys.map((k) => env.CACHE.delete(k.name));
      await Promise.allSettled(deletes);
      return list.keys.length;
    } catch {
      return 0;
    }
  },
});


// ─── Cache Tracking / Metrics ───────────────────────────────────────────

/** Simple hit/miss counters (per-isolate, reset on cold start) */
const counters = { hits: 0, misses: 0 };

/**
 * Record a cache hit or miss for metrics.
 * @param {boolean} hit
 */
export function recordCacheAccess(hit) {
  if (hit) counters.hits++;
  else counters.misses++;
}

/**
 * Get current cache metrics.
 * @returns {{ hits: number, misses: number, hitRate: number }}
 */
export function getCacheMetrics() {
  const total = counters.hits + counters.misses;
  return {
    hits: counters.hits,
    misses: counters.misses,
    hitRate: total > 0 ? +(counters.hits / total).toFixed(3) : 0,
    memSize: mem.size,
  };
}
