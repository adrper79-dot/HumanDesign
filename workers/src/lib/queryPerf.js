/**
 * Query Performance Utilities (BL-OPT-002)
 *
 * Wraps the standard query function with timing, slow query logging,
 * and optional EXPLAIN ANALYZE support.
 *
 * Usage:
 *   import { createMonitoredQueryFn } from '../lib/queryPerf.js';
 *
 *   const query = createMonitoredQueryFn(env);
 *   const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
 *   // Automatically logs queries > 100ms
 *
 *   // Or use EXPLAIN:
 *   const plan = await explainQuery(env, 'SELECT ...', [params]);
 */

import { createQueryFn } from '../db/queries.js';
import { trackEvent, EVENTS } from './analytics.js';

// Slow query threshold (ms)
const SLOW_QUERY_THRESHOLD_MS = 100;

/**
 * Create a monitored query function that logs slow queries.
 *
 * @param {object} env - Worker env bindings
 * @param {object} [opts]
 * @param {number} [opts.slowThreshold=100] - Threshold in ms to log as slow
 * @param {boolean} [opts.trackAnalytics=false] - Also send slow queries to analytics
 * @returns {Function} Monitored query function
 */
export function createMonitoredQueryFn(env, opts = {}) {
  const threshold = opts.slowThreshold ?? SLOW_QUERY_THRESHOLD_MS;
  const baseQuery = createQueryFn(env.NEON_CONNECTION_STRING);

  return async function monitoredQuery(sqlText, params = []) {
    const start = performance.now();

    try {
      const result = await baseQuery(sqlText, params);
      const elapsed = performance.now() - start;

      if (elapsed > threshold) {
        const queryPreview = sqlText.trim().substring(0, 120).replace(/\s+/g, ' ');
        console.warn(
          `[SLOW QUERY] ${elapsed.toFixed(1)}ms | ${queryPreview}${sqlText.length > 120 ? '...' : ''}`
        );

        // Optionally track slow queries in analytics
        if (opts.trackAnalytics) {
          trackEvent(env, 'slow_query', {
            properties: {
              duration_ms: Math.round(elapsed),
              query_preview: queryPreview,
              params_count: params.length,
              row_count: result.rows?.length ?? 0,
            },
          }).catch(() => {}); // Fire-and-forget
        }
      }

      return result;
    } catch (error) {
      const elapsed = performance.now() - start;
      const queryPreview = sqlText.trim().substring(0, 120).replace(/\s+/g, ' ');
      console.error(`[QUERY ERROR] ${elapsed.toFixed(1)}ms | ${queryPreview} | ${error.message}`);
      throw error;
    }
  };
}

/**
 * Run EXPLAIN ANALYZE on a query and return the execution plan.
 * For diagnostic / admin use only — do not call in production hot paths.
 *
 * @param {object} env - Worker env bindings
 * @param {string} sqlText - The SQL query to explain
 * @param {any[]} [params] - Query parameters
 * @returns {Promise<object>} Execution plan details
 */
export async function explainQuery(env, sqlText, params = []) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  const result = await query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sqlText}`,
    params
  );

  const plan = result.rows?.[0]?.['QUERY PLAN']?.[0] || result.rows?.[0];

  return {
    plan,
    summary: extractPlanSummary(plan),
  };
}

/**
 * Extract key metrics from an EXPLAIN ANALYZE JSON plan.
 *
 * @param {object} plan - EXPLAIN output
 * @returns {object} Summary metrics
 */
function extractPlanSummary(plan) {
  if (!plan) return { error: 'No plan available' };

  const planning = plan['Planning Time'] ?? null;
  const execution = plan['Execution Time'] ?? null;
  const node = plan['Plan'] || plan;

  return {
    planningTimeMs: planning,
    executionTimeMs: execution,
    totalTimeMs: (planning ?? 0) + (execution ?? 0),
    nodeType: node['Node Type'] ?? 'unknown',
    actualRows: node['Actual Rows'] ?? null,
    actualLoops: node['Actual Loops'] ?? null,
    startupCost: node['Startup Cost'] ?? null,
    totalCost: node['Total Cost'] ?? null,
    sharedBuffersHit: node['Shared Hit Blocks'] ?? null,
    sharedBuffersRead: node['Shared Read Blocks'] ?? null,
    // Flag sequential scans on large tables
    hasSeqScan: JSON.stringify(plan).includes('"Seq Scan"'),
    // Flag any sort operations
    hasSort: JSON.stringify(plan).includes('"Sort"'),
  };
}

/**
 * Batch query optimizer — combines multiple single-row lookups
 * into a single IN() query to eliminate N+1 patterns.
 *
 * @param {object} env - Worker env bindings
 * @param {string} table - Table name
 * @param {string} column - Column to match
 * @param {any[]} values - Values to look up
 * @param {string[]} [selectColumns=['*']] - Columns to return
 * @returns {Promise<Map<any, object>>} Map of column value → row
 */
export async function batchLookup(env, table, column, values, selectColumns = ['*']) {
  if (!values || values.length === 0) return new Map();

  // Sanitize table/column names (prevent SQL injection)
  if (!/^[a-z_]+$/.test(table) || !/^[a-z_]+$/.test(column)) {
    throw new Error('Invalid table or column name');
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const select = selectColumns.join(', ');
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

  const result = await query(
    `SELECT ${select} FROM ${table} WHERE ${column} IN (${placeholders})`,
    values
  );

  const map = new Map();
  for (const row of result.rows || []) {
    map.set(row[column], row);
  }

  return map;
}
