/**
 * collectors/known-issues.js
 * Reads previous audit files and extracts open/unresolved issues as a
 * structured baseline for the Known Issues section.
 *
 * Returns: { issues: Array<{ id, title, severity, status, source }> }
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const AUDITS_DIR = resolve(process.cwd(), 'audits');

const MAX_KNOWN_ISSUES  = 50;   // cap before deduplication
const DEDUP_KEY_LENGTH  = 60;   // characters used for title-based dedup key

/** Read a file if it exists, returning '' otherwise. */
function readSafe(filePath, maxLines = Infinity) {
  if (!existsSync(filePath)) return '';
  try {
    const content = readFileSync(filePath, 'utf8');
    if (maxLines === Infinity) return content;
    return content.split('\n').slice(0, maxLines).join('\n');
  } catch {
    return '';
  }
}

/**
 * Extract issues from the issue-registry.json (open ones only).
 */
function extractFromRegistry() {
  const registryPath = resolve(AUDITS_DIR, 'issue-registry.json');
  if (!existsSync(registryPath)) return [];
  try {
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    return (registry.issues || [])
      .filter(i => i.status === 'open')
      .map(i => ({
        id:       i.id,
        title:    i.title,
        severity: i.severity,
        status:   'open',
        source:   'issue-registry.json',
      }));
  } catch {
    return [];
  }
}

/**
 * Extract bullet-point issues from a markdown file.
 * Looks for lines matching severity keywords (CRITICAL, HIGH, MEDIUM, LOW, P0, P1).
 * Uses a shared counter for globally unique IDs across all source files.
 */
function extractFromMarkdown(content, sourceName, counter) {
  const issues = [];
  const lines = content.split('\n');
  const sourceKey = sourceName.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match lines that look like issue bullets: "- **CRITICAL**:" or "| CRITICAL |" etc.
    const critMatch = /CRITICAL|P0/.test(line);
    const highMatch = /\bHIGH\b|P1/.test(line);
    const medMatch  = /\bMEDIUM\b|P2/.test(line);

    if (!critMatch && !highMatch && !medMatch) continue;

    // Skip table-of-contents lines or header anchors
    if (line.startsWith('#') || line.includes('](')) continue;

    const severity = critMatch ? 'P0' : highMatch ? 'P1' : 'P2';

    // Extract the issue title — strip markdown bold, leading dashes, etc.
    const title = line
      .replace(/^[-*#|\s]+/, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .trim()
      .slice(0, 160);

    if (title.length < 10) continue;

    counter.value += 1;
    issues.push({
      id:       `${sourceKey}-${String(counter.value).padStart(3, '0')}`,
      title,
      severity,
      status:   'open',
      source:   sourceName,
    });
  }

  return issues;
}

export async function collectKnownIssues() {
  const issues = [];
  const counter = { value: 0 };  // shared counter for unique IDs across all sources

  // 1. Primary source — live issue registry
  const registryIssues = extractFromRegistry();
  issues.push(...registryIssues);

  // 2. Production Bug Report
  const bugReport = readSafe(resolve(AUDITS_DIR, 'PRODUCTION_BUG_REPORT_2026-03-11.md'));
  if (bugReport) {
    issues.push(...extractFromMarkdown(bugReport, 'PRODUCTION_BUG_REPORT', counter));
  }

  // 3. Tier / Billing / White-Label Audit
  const tierAudit = readSafe(resolve(AUDITS_DIR, 'TIER_BILLING_WHITE_LABEL_AUDIT_2026-03-14.md'));
  if (tierAudit) {
    issues.push(...extractFromMarkdown(tierAudit, 'TIER_BILLING_AUDIT', counter));
  }

  // 4. Workers Audit Report (first 80 lines)
  const workersAudit = readSafe(resolve(AUDITS_DIR, 'WORKERS_AUDIT_REPORT.md'), 80);
  if (workersAudit) {
    issues.push(...extractFromMarkdown(workersAudit, 'WORKERS_AUDIT', counter));
  }

  // 5. Root BACKLOG.md (first 100 lines) if it exists
  const backlog = readSafe(resolve(process.cwd(), 'BACKLOG.md'), 100);
  if (backlog) {
    issues.push(...extractFromMarkdown(backlog, 'BACKLOG', counter));
  }

  // Deduplicate by title (keep first occurrence)
  const seen = new Set();
  const deduped = issues.filter(i => {
    const key = i.title.slice(0, DEDUP_KEY_LENGTH).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    issues: deduped.slice(0, MAX_KNOWN_ISSUES),
    totalRaw: issues.length,
    sources: {
      registry:    registryIssues.length,
      bugReport:   bugReport  ? '✓' : 'not found',
      tierAudit:   tierAudit  ? '✓' : 'not found',
      workersAudit: workersAudit ? '✓' : 'not found',
      backlog:     backlog     ? '✓' : 'not found',
    },
  };
}

