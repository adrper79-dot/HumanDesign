/**
 * A/B Testing Framework — Experiment Library (BL-ANA-005)
 *
 * Consistent, deterministic experiment assignment and conversion tracking.
 *
 * Design principles:
 *   1. Deterministic hashing — same user always gets same variant
 *   2. Sticky assignments — once assigned, stored in DB for auditability
 *   3. Traffic splitting — experiments can target a % of eligible users
 *   4. Statistical significance — chi-squared test for conversion comparison
 *   5. Fire-and-forget conversions — never blocks user request
 *
 * Usage:
 *   import { getVariant, trackConversion, getResults } from '../lib/experiments.js';
 *
 *   // Assign user to a variant:
 *   const variant = await getVariant(env, userId, 'pricing_page_v2');
 *   // → 'control' | 'treatment' | null (if experiment inactive or user excluded)
 *
 *   // Track a conversion:
 *   ctx.waitUntil(trackConversion(env, userId, 'pricing_page_v2', 'upgrade'));
 *
 *   // Get experiment results (admin):
 *   const results = await getResults(env, 'pricing_page_v2');
 */

import { createQueryFn } from '../db/queries.js';
import { createLogger } from './logger.js';

const log = createLogger('experiments');

// ─── Cache ──────────────────────────────────────────────────────────
// In-memory experiment config cache (per-isolate, cleared on cold start).
// Avoids DB roundtrip on every getVariant() call.
let _experimentCache = new Map();
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get all active experiments (cached).
 * @param {object} env - Worker env bindings
 * @returns {Promise<Map<string, object>>} experiment name → config
 */
async function getActiveExperiments(env) {
  const now = Date.now();
  if (_experimentCache.size > 0 && now - _cacheTimestamp < CACHE_TTL_MS) {
    return _experimentCache;
  }

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    const result = await query(
      `SELECT id, name, description, status, variants, traffic_pct, start_date, end_date
       FROM experiments
       WHERE status = 'active'
         AND (start_date IS NULL OR start_date <= NOW())
         AND (end_date IS NULL OR end_date > NOW())`,
      []
    );

    const cache = new Map();
    for (const row of result.rows || []) {
      cache.set(row.name, {
        id: row.id,
        name: row.name,
        description: row.description,
        variants: typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants,
        trafficPct: row.traffic_pct ?? 100,
        startDate: row.start_date,
        endDate: row.end_date,
      });
    }

    _experimentCache = cache;
    _cacheTimestamp = now;
    return cache;
  } catch (err) {
    log.warn('load_active_experiments_failed', { error: err.message });
    _experimentCache._stale = true;
    return _experimentCache; // Return stale cache on failure
  }
}

// ─── Deterministic Hashing ──────────────────────────────────────────

/**
 * FNV-1a 32-bit hash for deterministic variant assignment.
 * Fast, well-distributed, zero-dependency.
 *
 * @param {string} input - String to hash (userId + experimentName)
 * @returns {number} Unsigned 32-bit integer
 */
function fnv1a32(input) {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0; // Ensure unsigned
}

/**
 * Determine if a user should be included in an experiment
 * based on traffic percentage.
 *
 * @param {string} userId
 * @param {string} experimentName
 * @param {number} trafficPct - 0-100
 * @returns {boolean}
 */
function isUserEligible(userId, experimentName, trafficPct) {
  if (trafficPct >= 100) return true;
  if (trafficPct <= 0) return false;
  // Use a different seed than variant assignment to avoid correlation
  const hash = fnv1a32(`eligibility:${userId}:${experimentName}`);
  return (hash % 100) < trafficPct;
}

/**
 * Deterministically assign a variant to a user.
 * Same user + same experiment always returns the same variant.
 *
 * @param {string} userId
 * @param {string} experimentName
 * @param {string[]} variants - e.g. ['control', 'treatment']
 * @returns {string} The assigned variant name
 */
function assignVariant(userId, experimentName, variants) {
  const hash = fnv1a32(`variant:${userId}:${experimentName}`);
  return variants[hash % variants.length];
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Get the variant for a user in a given experiment.
 *
 * If the user is already assigned, returns their existing variant (sticky).
 * If the experiment is active and the user is eligible, assigns a new variant.
 * Returns null if the experiment doesn't exist, is inactive, or user is excluded.
 *
 * @param {object} env - Worker env bindings
 * @param {string} userId - User UUID
 * @param {string} experimentName - Experiment identifier
 * @returns {Promise<string|null>} Variant name or null
 */
export async function getVariant(env, userId, experimentName) {
  if (!userId || !experimentName) return null;

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // 1. Check for existing assignment (sticky)
    const existing = await query(
      `SELECT ea.variant
       FROM experiment_assignments ea
       JOIN experiments e ON e.id = ea.experiment_id
       WHERE e.name = $1 AND ea.user_id = $2`,
      [experimentName, userId]
    );

    if (existing.rows?.length > 0) {
      return existing.rows[0].variant;
    }

    // 2. Load experiment config
    const experiments = await getActiveExperiments(env);
    const experiment = experiments.get(experimentName);
    if (!experiment) return null;

    // 3. Check eligibility (traffic %)
    if (!isUserEligible(userId, experimentName, experiment.trafficPct)) {
      return null;
    }

    // 4. Assign variant deterministically
    const variant = assignVariant(userId, experimentName, experiment.variants);

    // 5. Persist assignment
    await query(
      `INSERT INTO experiment_assignments (experiment_id, user_id, variant)
       VALUES ($1, $2, $3)
       ON CONFLICT (experiment_id, user_id) DO NOTHING`,
      [experiment.id, userId, variant]
    );

    return variant;
  } catch (err) {
    log.warn('get_variant_error', { error: err.message });
    return null; // Graceful degradation — default behavior (no experiment)
  }
}

/**
 * Track a conversion event for an experiment.
 * Fire-and-forget — never blocks the user request.
 *
 * @param {object} env - Worker env bindings
 * @param {string} userId - User UUID
 * @param {string} experimentName - Experiment identifier
 * @param {string} conversionName - e.g. 'signup', 'upgrade', 'chart_generate'
 * @returns {Promise<void>}
 */
export async function trackConversion(env, userId, experimentName, conversionName) {
  if (!userId || !experimentName || !conversionName) return;

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Look up user's assignment for this experiment
    const assignment = await query(
      `SELECT ea.variant, e.id AS experiment_id
       FROM experiment_assignments ea
       JOIN experiments e ON e.id = ea.experiment_id
       WHERE e.name = $1 AND ea.user_id = $2`,
      [experimentName, userId]
    );

    if (!assignment.rows?.length) return; // Not enrolled in this experiment

    const { variant, experiment_id } = assignment.rows[0];

    // Record conversion (idempotent — same user can only convert once per experiment+conversion)
    await query(
      `INSERT INTO experiment_conversions (experiment_id, user_id, variant, conversion_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [experiment_id, userId, variant, conversionName]
    );
  } catch (err) {
    log.error('track_conversion_error', { error: err.message });
    // Silent fail — analytics should never break the app
  }
}

/**
 * Get experiment results with statistical analysis.
 *
 * Returns per-variant counts, conversion rates, and chi-squared
 * significance test result.
 *
 * @param {object} env - Worker env bindings
 * @param {string} experimentName - Experiment identifier
 * @returns {Promise<object|null>} Results object or null
 */
export async function getResults(env, experimentName) {
  if (!experimentName) return null;

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    // Get experiment metadata
    const expResult = await query(
      `SELECT id, name, description, status, variants, traffic_pct, start_date, end_date, created_at
       FROM experiments WHERE name = $1`,
      [experimentName]
    );

    if (!expResult.rows?.length) return null;

    const experiment = expResult.rows[0];
    const experimentId = experiment.id;
    const variants = typeof experiment.variants === 'string'
      ? JSON.parse(experiment.variants)
      : experiment.variants;

    // Get per-variant assignment counts
    const assignmentResult = await query(
      `SELECT variant, COUNT(*) AS total_assigned
       FROM experiment_assignments
       WHERE experiment_id = $1
       GROUP BY variant`,
      [experimentId]
    );

    // Get per-variant conversion counts (grouped by conversion_name)
    const conversionResult = await query(
      `SELECT variant, conversion_name, COUNT(*) AS total_converted
       FROM experiment_conversions
       WHERE experiment_id = $1
       GROUP BY variant, conversion_name`,
      [experimentId]
    );

    // Build results per variant
    const assignmentMap = {};
    for (const row of assignmentResult.rows || []) {
      assignmentMap[row.variant] = parseInt(row.total_assigned, 10);
    }

    const conversionMap = {};
    for (const row of conversionResult.rows || []) {
      if (!conversionMap[row.variant]) conversionMap[row.variant] = {};
      conversionMap[row.variant][row.conversion_name] = parseInt(row.total_converted, 10);
    }

    // Compute per-variant metrics
    const variantResults = variants.map((v) => {
      const assigned = assignmentMap[v] || 0;
      const conversions = conversionMap[v] || {};
      const totalConverted = Object.values(conversions).reduce((a, b) => a + b, 0);

      return {
        variant: v,
        assigned,
        conversions,
        totalConverted,
        conversionRate: assigned > 0 ? +(totalConverted / assigned).toFixed(4) : 0,
      };
    });

    // Statistical significance (chi-squared goodness of fit for 2-variant case)
    const significance = computeSignificance(variantResults);

    return {
      experiment: {
        name: experiment.name,
        description: experiment.description,
        status: experiment.status,
        variants,
        trafficPct: experiment.traffic_pct,
        startDate: experiment.start_date,
        endDate: experiment.end_date,
        createdAt: experiment.created_at,
      },
      results: variantResults,
      significance,
      totalAssigned: variantResults.reduce((a, v) => a + v.assigned, 0),
      totalConverted: variantResults.reduce((a, v) => a + v.totalConverted, 0),
    };
  } catch (err) {
    log.error('get_results_error', { error: err.message });
    return null;
  }
}

/**
 * List all experiments with summary counts.
 *
 * @param {object} env - Worker env bindings
 * @param {string} [status] - Filter by status ('active', 'paused', 'completed')
 * @returns {Promise<object[]>}
 */
export async function listExperiments(env, status = null) {
  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    const result = await query(
      `SELECT e.*,
              COUNT(DISTINCT ea.user_id) AS total_assigned,
              COUNT(DISTINCT ec.user_id) AS total_converted
       FROM experiments e
       LEFT JOIN experiment_assignments ea ON ea.experiment_id = e.id
       LEFT JOIN experiment_conversions ec ON ec.experiment_id = e.id
       WHERE ($1::text IS NULL OR e.status = $1)
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [status]
    );

    return (result.rows || []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      variants: typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants,
      trafficPct: row.traffic_pct,
      startDate: row.start_date,
      endDate: row.end_date,
      totalAssigned: parseInt(row.total_assigned, 10),
      totalConverted: parseInt(row.total_converted, 10),
      conversionRate: row.total_assigned > 0
        ? +(parseInt(row.total_converted, 10) / parseInt(row.total_assigned, 10)).toFixed(4)
        : 0,
      createdAt: row.created_at,
    }));
  } catch (err) {
    log.error('list_experiments_error', { error: err.message });
    return [];
  }
}

/**
 * Create a new experiment.
 *
 * @param {object} env
 * @param {object} opts
 * @param {string} opts.name - Unique experiment identifier
 * @param {string} [opts.description]
 * @param {string[]} [opts.variants] - Default: ['control', 'treatment']
 * @param {number} [opts.trafficPct] - % of users to enroll (0-100)
 * @param {string} [opts.startDate] - ISO timestamp
 * @param {string} [opts.endDate] - ISO timestamp
 * @returns {Promise<object|null>} Created experiment or null
 */
export async function createExperiment(env, opts) {
  const { name, description, variants, trafficPct, startDate, endDate } = opts || {};
  if (!name) return null;

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    const result = await query(
      `INSERT INTO experiments (name, description, variants, traffic_pct, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING *`,
      [
        name,
        description || null,
        JSON.stringify(variants || ['control', 'treatment']),
        Math.min(100, Math.max(0, trafficPct ?? 100)),
        startDate || null,
        endDate || null,
      ]
    );

    if (!result.rows?.length) return null;

    // Invalidate cache so new experiment is picked up
    _cacheTimestamp = 0;

    return result.rows[0];
  } catch (err) {
    log.error('create_experiment_error', { error: err.message });
    return null;
  }
}

/**
 * Update experiment status (pause, resume, complete).
 *
 * @param {object} env
 * @param {string} experimentName
 * @param {string} newStatus - 'active' | 'paused' | 'completed'
 * @returns {Promise<boolean>}
 */
export async function updateExperimentStatus(env, experimentName, newStatus) {
  const validStatuses = ['active', 'paused', 'completed'];
  if (!validStatuses.includes(newStatus)) return false;

  try {
    const query = createQueryFn(env.NEON_CONNECTION_STRING);

    const result = await query(
      `UPDATE experiments SET status = $1, updated_at = NOW() WHERE name = $2 RETURNING id`,
      [newStatus, experimentName]
    );

    // Invalidate cache
    _cacheTimestamp = 0;

    return result.rows?.length > 0;
  } catch (err) {
    log.error('update_experiment_status_error', { error: err.message });
    return false;
  }
}

// ─── Statistical Significance ───────────────────────────────────────

/**
 * Compute chi-squared test for independence between variants.
 *
 * For a 2-variant experiment (control vs treatment), tests whether
 * the difference in conversion rates is statistically significant.
 *
 * @param {object[]} variantResults - Array of { variant, assigned, totalConverted }
 * @returns {object} { chiSquared, pValue, significant, confidence, recommendation }
 */
function computeSignificance(variantResults) {
  if (!variantResults || variantResults.length < 2) {
    return { chiSquared: 0, pValue: 1, significant: false, confidence: 0, recommendation: 'Insufficient data' };
  }

  const totalAssigned = variantResults.reduce((a, v) => a + v.assigned, 0);
  const totalConverted = variantResults.reduce((a, v) => a + v.totalConverted, 0);

  if (totalAssigned === 0 || totalConverted === 0) {
    return { chiSquared: 0, pValue: 1, significant: false, confidence: 0, recommendation: 'No conversions yet' };
  }

  // Expected conversion rate (pooled)
  const pooledRate = totalConverted / totalAssigned;

  // Chi-squared statistic
  let chiSquared = 0;
  for (const v of variantResults) {
    if (v.assigned === 0) continue;

    const expectedConverted = v.assigned * pooledRate;
    const expectedNotConverted = v.assigned * (1 - pooledRate);

    if (expectedConverted > 0) {
      chiSquared += Math.pow(v.totalConverted - expectedConverted, 2) / expectedConverted;
    }
    const notConverted = v.assigned - v.totalConverted;
    if (expectedNotConverted > 0) {
      chiSquared += Math.pow(notConverted - expectedNotConverted, 2) / expectedNotConverted;
    }
  }

  // Approximate p-value from chi-squared (1 degree of freedom for 2 variants)
  // Using Wilson-Hilferty approximation for chi-squared CDF
  const pValue = chiSquaredPValue(chiSquared, variantResults.length - 1);
  const significant = pValue < 0.05;
  const confidence = +((1 - pValue) * 100).toFixed(1);

  // Find winning variant
  let recommendation = 'No clear winner';
  if (significant && variantResults.length >= 2) {
    const sorted = [...variantResults].sort((a, b) => b.conversionRate - a.conversionRate);
    const winner = sorted[0];
    const runnerUp = sorted[1];
    const lift = runnerUp.conversionRate > 0
      ? +(((winner.conversionRate - runnerUp.conversionRate) / runnerUp.conversionRate) * 100).toFixed(1)
      : 0;
    recommendation = `"${winner.variant}" wins with ${lift}% lift (${confidence}% confidence)`;
  }

  // Minimum sample size recommendation
  const minSamplePerVariant = 100;
  const needsMoreData = variantResults.some((v) => v.assigned < minSamplePerVariant);

  return {
    chiSquared: +chiSquared.toFixed(4),
    pValue: +pValue.toFixed(6),
    significant,
    confidence,
    recommendation,
    needsMoreData,
    minSamplePerVariant,
  };
}

/**
 * Approximate p-value for chi-squared distribution.
 * Uses the regularized incomplete gamma function approximation.
 *
 * @param {number} x - Chi-squared statistic
 * @param {number} df - Degrees of freedom
 * @returns {number} Approximate p-value (0-1)
 */
function chiSquaredPValue(x, df) {
  if (x <= 0 || df <= 0) return 1;

  // For df=1 (most common case in A/B tests), use direct approximation
  if (df === 1) {
    // P(X > x) for chi-squared with df=1 ≈ 2 * (1 - Φ(√x))
    // where Φ is the standard normal CDF
    return 2 * (1 - normalCDF(Math.sqrt(x)));
  }

  // General case: use Abramowitz & Stegun approximation
  // (1 - 2/(9*df) + z*sqrt(2/(9*df)))^3 where z = ((x/df)^(1/3) - (1 - 2/(9*df))) / sqrt(2/(9*df))
  const k = df / 2;
  const xHalf = x / 2;

  // Simple series approximation for regularized incomplete gamma function
  let sum = Math.exp(-xHalf) * Math.pow(xHalf, k) / gamma(k + 1);
  let term = sum;
  for (let i = 1; i < 100; i++) {
    term *= xHalf / (k + i);
    sum += term;
    if (Math.abs(term) < 1e-10) break;
  }

  return Math.max(0, Math.min(1, 1 - sum));
}

/**
 * Standard normal CDF approximation (Abramowitz & Stegun 26.2.17).
 * Accurate to ~1.5e-7.
 *
 * @param {number} x
 * @returns {number}
 */
function normalCDF(x) {
  if (x < -8) return 0;
  if (x > 8) return 1;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1 + sign * y);
}

/**
 * Gamma function approximation (Stirling's approximation for n > 1,
 * exact for small integers).
 *
 * @param {number} n
 * @returns {number}
 */
function gamma(n) {
  if (n <= 0) return Infinity;
  if (Number.isInteger(n) && n <= 20) {
    // Exact factorial for small integers: Γ(n) = (n-1)!
    let result = 1;
    for (let i = 2; i < n; i++) result *= i;
    return result;
  }
  // Stirling's approximation
  const x = n - 1;
  return Math.sqrt(2 * Math.PI / x) * Math.pow(x / Math.E, x) *
    (1 + 1 / (12 * x) + 1 / (288 * x * x));
}

/**
 * Invalidate the in-memory experiment cache.
 * Call after creating/updating experiments.
 */
export function invalidateCache() {
  _cacheTimestamp = 0;
  _experimentCache = new Map();
}
