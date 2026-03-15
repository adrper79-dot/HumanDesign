/**
 * Audit State Machine
 * Manages the issue registry and determines audit mode/schedule.
 *
 * Registry file: audits/issue-registry.json
 * Modes: ACTIVE (daily) → MAINTENANCE (weekly) → STABLE (monthly)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const REGISTRY_PATH = resolve(process.cwd(), 'audits', 'issue-registry.json');

const EMPTY_REGISTRY = {
  version: new Date().toISOString().slice(0, 10),
  mode: 'ACTIVE',
  consecutiveCleanRuns: 0,
  issues: [],
  history: [],
};

// ─── Read / Write ────────────────────────────────────────────────────

export function readRegistry() {
  if (!existsSync(REGISTRY_PATH)) return { ...EMPTY_REGISTRY };
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  } catch {
    return { ...EMPTY_REGISTRY };
  }
}

export function writeRegistry(registry) {
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8');
}

// ─── Mode Determination ──────────────────────────────────────────────

/**
 * Determine current operating mode based on open issues and clean run history.
 */
export function determineMode(registry) {
  const openP0 = registry.issues.filter(i => i.severity === 'P0' && i.status === 'open');
  if (openP0.length > 0) return 'ACTIVE';

  // STABLE: no P0/P1 and 4+ consecutive clean runs
  const openP1 = registry.issues.filter(i => i.severity === 'P1' && i.status === 'open');
  if (openP1.length === 0 && registry.consecutiveCleanRuns >= 4) return 'STABLE';

  return 'MAINTENANCE';
}

/**
 * Decide whether to run the full AI audit today.
 * - ACTIVE: always
 * - MAINTENANCE: Mondays only
 * - STABLE: first Monday of the month only
 */
export function shouldRunFullAudit(mode, forceFlag = false) {
  if (forceFlag) return true;
  if (mode === 'ACTIVE') return true;

  const now = new Date();
  const day = now.getDay(); // 0=Sunday, 1=Monday

  if (mode === 'MAINTENANCE') {
    return day === 1;
  }

  if (mode === 'STABLE') {
    // First Monday of the month: Monday AND date ≤ 7
    return day === 1 && now.getDate() <= 7;
  }

  return false;
}

// ─── Issue Merging ───────────────────────────────────────────────────

/**
 * Merge new AI-identified issues into the existing registry.
 * Identifies new, resolved, and regressed issues.
 *
 * @param {Array} existingIssues - Current registry.issues
 * @param {Array} newIssues - Issues from this run: [{id, persona, severity, area, title}]
 * @param {string} today - YYYY-MM-DD
 * @returns {{ merged: Array, delta: {new: number, resolved: number, regressions: number} }}
 */
export function mergeIssues(existingIssues, newIssues, today) {
  const delta = { new: 0, resolved: 0, regressions: 0 };
  const newIds = new Set(newIssues.map(i => i.id));
  const existingIds = new Set(existingIssues.map(i => i.id));

  // Mark previously-open issues as resolved if not in new run
  const updated = existingIssues.map(issue => {
    if (issue.status === 'open' && !newIds.has(issue.id)) {
      delta.resolved++;
      return { ...issue, status: 'resolved', resolvedAt: today };
    }
    // Regression: was resolved/closed, now re-appears
    if (issue.status === 'resolved' && newIds.has(issue.id)) {
      delta.regressions++;
      return { ...issue, status: 'open', resolvedAt: null, lastSeen: today };
    }
    if (issue.status === 'open') {
      return { ...issue, lastSeen: today };
    }
    return issue;
  });

  // Add genuinely new issues
  for (const issue of newIssues) {
    if (!existingIds.has(issue.id)) {
      delta.new++;
      updated.push({
        ...issue,
        status: 'open',
        firstSeen: today,
        lastSeen: today,
        resolvedAt: null,
      });
    }
  }

  return { merged: updated, delta };
}

// ─── History ─────────────────────────────────────────────────────────

/**
 * Append a run record to history and update consecutiveCleanRuns.
 */
export function appendHistory(registry, runRecord) {
  const isClean = runRecord.P0 === 0 && runRecord.P1 === 0 && runRecord.regressions === 0;
  const consecutiveCleanRuns = isClean ? (registry.consecutiveCleanRuns || 0) + 1 : 0;

  return {
    ...registry,
    consecutiveCleanRuns,
    history: [...(registry.history || []).slice(-52), runRecord], // keep 1 year of weekly data
  };
}

// ─── Scoring ─────────────────────────────────────────────────────────

export function countBySeverity(issues, status = 'open') {
  const filtered = issues.filter(i => i.status === status);
  return {
    P0: filtered.filter(i => i.severity === 'P0').length,
    P1: filtered.filter(i => i.severity === 'P1').length,
    P2: filtered.filter(i => i.severity === 'P2').length,
  };
}
