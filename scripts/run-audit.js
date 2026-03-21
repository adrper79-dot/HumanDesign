#!/usr/bin/env node
/**
 * run-audit.js — Prime Self Automated Audit Orchestrator
 *
 * Modes:
 *   node scripts/run-audit.js              → scheduled run (respects mode/day rules)
 *   node scripts/run-audit.js --vitals-only → tests + CF metrics + code scan only (no AI, no cost)
 *   node scripts/run-audit.js --force-full  → always run full AI audit regardless of mode
 *
 * Output:
 *   audits/FULL_AUDIT_YYYY-MM-DD.md   (full AI audit)
 *   audits/VITALS_YYYY-MM-DD.md       (vitals-only run)
 *   audits/issue-registry.json        (live issue state, committed each run)
 *
 * Exit codes:
 *   0 — clean (or vitals pass, no P0)
 *   1 — P0 issues detected (blocks deploy in GH Actions)
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, join }    from 'path';

import { collectTestResults }       from './collectors/test-results.js';
import { collectReleaseGate }       from './collectors/release-gate.js';
import { collectCloudflareMetrics } from './collectors/cloudflare-metrics.js';
import { collectAppMetrics }        from './collectors/app-metrics.js';
import { collectCodeQuality }       from './collectors/code-quality.js';
import { collectKnownIssues }       from './collectors/known-issues.js';
import {
  readRegistry,
  writeRegistry,
  determineMode,
  shouldRunFullAudit,
  mergeIssues,
  appendHistory,
  countBySeverity,
} from './audit-state.js';
import { loadLocalEnv } from './load-local-env.js';

const AUDITS_DIR   = resolve(process.cwd(), 'audits');
const TODAY        = new Date().toISOString().slice(0, 10);
const VITALS_ONLY  = process.argv.includes('--vitals-only');
const FORCE_FULL   = process.argv.includes('--force-full');

// ─── Prompt size budget constants ────────────────────────────────────
const MAX_HANDLER_LINES           = 200;  // lines of handler code to include per file
const MAX_KNOWN_ISSUES_IN_PROMPT  = 20;   // known issues to include in the AI prompt
const MAX_REGISTRY_ISSUES_IN_PROMPT = 30; // open registry issues to include in the AI prompt

// ─── Ensure output directory ─────────────────────────────────────────

mkdirSync(resolve(AUDITS_DIR, '../tests/results'), { recursive: true });
mkdirSync(AUDITS_DIR, { recursive: true });
loadLocalEnv();

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n[Audit] Starting run — ${TODAY}  (vitals-only: ${VITALS_ONLY}, force-full: ${FORCE_FULL})\n`);

  // ── Read current registry + determine mode ──
  const registry = readRegistry();
  const mode     = determineMode(registry);
  const runFull  = !VITALS_ONLY && shouldRunFullAudit(mode, FORCE_FULL);

  console.log(`[Audit] Mode: ${mode} | Full audit: ${runFull}`);

  // ── Collect all data in parallel ──
  console.log('[Audit] Collecting data...');
  const [testResults, releaseGate, cfMetrics, appMetrics, codeQuality, knownIssues] = await Promise.all([
    collectTestResults()       .catch(e => ({ error: e.message })),
    collectReleaseGate()       .catch(e => ({ ok: false, error: e.message, results: [] })),
    collectCloudflareMetrics() .catch(e => ({ available: false, reason: e.message })),
    collectAppMetrics()        .catch(e => ({ available: false, reason: e.message })),
    collectCodeQuality()       .catch(e => ({ error: e.message })),
    collectKnownIssues()       .catch(e => ({ issues: [], error: e.message })),
  ]);

  const handlerContent = collectHandlerFiles();

  console.log(`[Audit] Tests: ${testResults.passed}/${testResults.total} passed, ${testResults.failed} failed`);
  const browserSmoke = releaseGate?.results?.find(r => r.name === 'browser smoke');
  const browserSmokeSummary = browserSmoke
    ? browserSmoke.ok
      ? browserSmoke.skipped
        ? 'skipped'
        : 'passed'
      : `failed${browserSmoke.stderr ? ` — ${browserSmoke.stderr}` : ''}`
    : 'unknown';
  console.log(`[Audit] Browser Smoke: ${browserSmokeSummary}`);
  console.log(`[Audit] CF Metrics: ${cfMetrics.available ? `${cfMetrics.totalRequests} reqs, ${cfMetrics.errorRatePct}% errors` : 'unavailable'}`);
  console.log(`[Audit] App Metrics: ${appMetrics.available ? `DAU=${appMetrics.dau}` : 'unavailable'}`);
  console.log(`[Audit] Code Quality: ${codeQuality.summary?.totalFindings ?? 'error'} findings`);
  console.log(`[Audit] Current Open Issues: ${knownIssues.currentIssues?.length ?? 0} from issue registry`);
  console.log(`[Audit] Historical Issue References: ${knownIssues.historicalIssues?.length ?? 0}`);

  let auditReport = null;
  let newIssues   = [];

  // ── Full AI audit ──
  if (runFull) {
    console.log('[Audit] Running full AI audit (calling Anthropic API)...');
    const result = await runFullAudit({ testResults, cfMetrics, appMetrics, codeQuality, knownIssues, handlerContent, registry, mode });
    auditReport = result.report;
    newIssues   = result.issues;
  }

  // ── Update issue registry ──
  // Vitals-only runs do not produce a fresh AI issue set, so they must not
  // auto-resolve existing open issues by merging against an empty array.
  const { merged, delta } = runFull
    ? mergeIssues(registry.issues, newIssues, TODAY)
    : { merged: registry.issues, delta: { new: 0, resolved: 0, regressions: 0 } };
  const counts = countBySeverity(merged, 'open');

  const runRecord = {
    date: TODAY,
    mode,
    fullAudit: runFull,
    P0: counts.P0,
    P1: counts.P1,
    P2: counts.P2,
    new: delta.new,
    resolved: delta.resolved,
    regressions: delta.regressions,
    testsPassed: testResults.passed  || 0,
    testsFailed: testResults.failed  || 0,
    cfErrorRatePct: cfMetrics.available ? parseFloat(cfMetrics.errorRatePct) : null,
  };

  const updatedRegistry = appendHistory(
    { ...registry, mode: determineMode({ ...registry, issues: merged }), issues: merged },
    runRecord
  );
  writeRegistry(updatedRegistry);

  // ── Write output file ──
  const filename = runFull
    ? `FULL_AUDIT_${TODAY}.md`
    : `VITALS_${TODAY}.md`;

  const outputPath = resolve(AUDITS_DIR, filename);
  const outputMd   = buildMarkdown({
    runFull, mode, TODAY, testResults, releaseGate, cfMetrics, appMetrics, codeQuality,
    knownIssues, auditReport, counts, delta, runRecord,
  });

  writeFileSync(outputPath, outputMd, 'utf8');
  console.log(`[Audit] Report written → ${outputPath}`);

  // ── Summary ──
  console.log(`\n[Audit] ─────────────────────────────────`);
  console.log(`[Audit] P0 open: ${counts.P0} | P1: ${counts.P1} | P2: ${counts.P2}`);
  console.log(`[Audit] Delta: +${delta.new} new, ✓${delta.resolved} resolved, ↩${delta.regressions} regressions`);
  console.log(`[Audit] Mode: ${updatedRegistry.mode} | Consecutive clean runs: ${updatedRegistry.consecutiveCleanRuns}`);

  // Log P0 summary — exit 0 so the commit step always runs.
  // Deploy gating uses count-issues.js in deploy-workers.yml separately.
  if (counts.P0 > 0) {
    console.error(`\n[Audit] ⚠ ${counts.P0} P0 issue(s) open. Review issue-registry.json.`);
  }

  process.exit(0);
}

// ─── Full AI Audit ───────────────────────────────────────────────────

async function runFullAudit({ testResults, cfMetrics, appMetrics, codeQuality, knownIssues, handlerContent, registry, mode }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[Audit] ANTHROPIC_API_KEY not set — skipping AI personas.');
    return { report: null, issues: [] };
  }

  const prompt = buildAuditPrompt({ testResults, cfMetrics, appMetrics, codeQuality, knownIssues, handlerContent, registry, mode });

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (err) {
    console.error('[Audit] Anthropic API call failed:', err.message);
    return { report: null, issues: [] };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[Audit] Anthropic API error:', res.status, text.slice(0, 300));
    return { report: null, issues: [] };
  }

  const json    = await res.json();
  const content = json.content?.[0]?.text || '';

  // Parse issue registry JSON block from the response
  const issues = extractIssueRegistry(content);

  return { report: content, issues };
}

function extractIssueRegistry(text) {
  // Match all JSON array blocks in the response
  const matches = [...text.matchAll(/```json\s*(\[[\s\S]*?\])\s*```/g)];
  if (!matches.length) return [];

  // Find the last JSON array that looks like an issue registry
  // (contains objects with id, persona, severity fields)
  const issueArrayMatches = matches.filter(m => {
    try {
      const parsed = JSON.parse(m[1]);
      return Array.isArray(parsed) && parsed.length > 0 &&
        parsed[0] && typeof parsed[0] === 'object' &&
        'id' in parsed[0] && 'severity' in parsed[0];
    } catch {
      return false;
    }
  });

  const target = issueArrayMatches.length > 0
    ? issueArrayMatches[issueArrayMatches.length - 1]
    : matches[matches.length - 1];

  try {
    const parsed = JSON.parse(target[1]);
    if (!Array.isArray(parsed)) return [];
    // Ensure every issue has status: "open" if AI omitted it
    return parsed.map(issue => ({
      ...issue,
      status: issue.status || 'open',
    }));
  } catch {
    return [];
  }
}

// ─── Handler File Reader ─────────────────────────────────────────────

/**
 * Read key handler and middleware files for AI flow analysis.
 * Truncates each file to keep prompt size manageable.
 */
function collectHandlerFiles() {
  const targets = [
    { key: 'billing',         path: 'workers/src/handlers/billing.js' },
    { key: 'auth',            path: 'workers/src/handlers/auth.js' },
    { key: 'webhook',         path: 'workers/src/handlers/webhook.js' },
    { key: 'tierEnforcement', path: 'workers/src/middleware/tierEnforcement.js' },
    { key: 'rateLimit',       path: 'workers/src/middleware/rateLimit.js' },
  ];

  const files = {};
  for (const { key, path: relPath } of targets) {
    const fullPath = resolve(process.cwd(), relPath);
    if (existsSync(fullPath)) {
      try {
        // Truncate at MAX_HANDLER_LINES lines to keep context window manageable
        const content = readFileSync(fullPath, 'utf8')
          .split('\n').slice(0, MAX_HANDLER_LINES).join('\n');
        files[key] = content;
      } catch {
        files[key] = `/* Error reading ${relPath} */`;
      }
    } else {
      files[key] = `/* File not found: ${relPath} */`;
    }
  }
  return files;
}

function buildAuditPrompt({ testResults, cfMetrics, appMetrics, codeQuality, knownIssues, handlerContent, registry, mode, releaseGate }) {
  const prevIssues = registry.issues.filter(i => i.status === 'open').slice(0, MAX_REGISTRY_ISSUES_IN_PROMPT);

  // Summarise known issues for the prompt (keep size in check)
  const knownIssuesSummary = (knownIssues?.historicalIssues || []).slice(0, MAX_KNOWN_ISSUES_IN_PROMPT)
    .map(i => `- [${i.severity}] ${i.title} (${i.source})`)
    .join('\n') || '(none)';

  // Summarise handler content (billing + webhook most critical)
  const handlerSummary = Object.entries(handlerContent || {})
    .map(([k, v]) => `\n### ${k}.js\n\`\`\`js\n${v}\n\`\`\``)
    .join('\n');

  return `You are conducting a full-spectrum audit of Prime Self — a Cloudflare Workers API + vanilla JS PWA.
Product: Personal development SaaS using Human Design synthesis. Tiers: Free, Individual ($19/mo), Guide/Practitioner ($97/mo), Agency ($349/mo).
API: https://prime-self-api.adrper79.workers.dev | Frontend: https://selfprime.net
Current audit mode: ${mode}

## COLLECTED DATA

### Test Results
${JSON.stringify(testResults, null, 2)}

### Release Gate Status
${JSON.stringify(releaseGate, null, 2)}

### Cloudflare Worker Metrics (last 7 days)
${JSON.stringify(cfMetrics, null, 2)}

### App Analytics
${JSON.stringify(appMetrics, null, 2)}

### Code Quality Scan
${JSON.stringify(codeQuality?.summary, null, 2)}

### Historical Findings Reference
${knownIssuesSummary}

### Currently Open Issues from Registry
${JSON.stringify(prevIssues, null, 2)}

### Handler & Middleware Source (for flow analysis)
${handlerSummary}

## YOUR TASK

Produce a structured audit report with these EXACT section names and order.
Use ## (H2) for every section header below.

## Flow Analysis
Analyze billing.js, auth.js, webhook.js, tierEnforcement.js, rateLimit.js provided above.
Identify for each file:
- Race conditions
- Missing idempotency keys
- Incorrect HTTP error codes
- Quota enforcement gaps
- Any path that could result in a charge without delivery or delivery without a charge
Be specific with file:function references.

## CTO Synopsis
Analyze: architecture soundness, handler complexity, missing error handling patterns (no structured logging, no request IDs, no retry wrapper on DB calls), test coverage gaps, tech debt that blocks scaling. Rate each area GREEN/YELLOW/RED. 300 words max.

## CISO Synopsis
Analyze: JWT in localStorage (known gap — HttpOnly cookies pending), CSP unsafe-inline, OAuth flow, practitioner data isolation (can User A see User B?), Stripe webhook signature verification, SQL injection surface, rate limiting gaps. Rate each area GREEN/YELLOW/RED. 300 words max.

## CFO Synopsis
Analyze: Studio tier checkout active but features not built (BL-MV-N1 CRIT), Stripe webhook idempotency (double-charge risk), subscription state sync, quota enforcement before AI calls, free tier abuse vectors, revenue recognition. Rate each area GREEN/YELLOW/RED. 300 words max.

## CMO Synopsis
Analyze: registration-to-profile funnel drop points, "why it matters" explanations (#1 churn driver — every data point shows raw labels without life implications), onboarding Savannah arc quality, practitioner dashboard discoverability, referral mechanics, social share hooks. Rate each area GREEN/YELLOW/RED. 300 words max.

## CIO Synopsis
Analyze: structured logging coverage (is X-Request-ID present? durationMs logged?), Sentry integration, health endpoint depth (/api/health?full=1), KV cache strategy, Worker CPU efficiency from CF metrics, deployment pipeline, cron job reliability. Rate each area GREEN/YELLOW/RED. 300 words max.

## Practitioner UX Journey
Walk through steps 1-10:
1. Discovery → signup → Guide tier checkout
2. Dashboard first load
3. Adding a client by email
4. Viewing client chart + profile
5. Session notes creation
6. AI context per client
7. Directory profile setup
8. Public profile discoverability
9. Notion sync
10. Billing portal / cancel flow
For each: complete? gaps? friction points? Rate 1 (broken) to 5 (seamless).

## CEO Executive Summary
200 words max. Overall health. Top 5 issues that would cause a practitioner to churn. Top 3 legal/financial risks. Readiness rating: NOT READY / SOFT LAUNCH READY / LAUNCH READY.

## Master Issue Registry
Output a JSON array of ALL issues identified across all personas. Use this EXACT format including the status field:

\`\`\`json
[
  {
    "id": "CTO-001",
    "persona": "CTO",
    "severity": "P0",
    "area": "logging",
    "title": "No request correlation IDs — undebuggable in production",
    "status": "open"
  }
]
\`\`\`

Severity rules:
- P0: Would cause data loss, billing error, security breach, or complete feature failure
- P1: Degrades experience significantly or blocks a user journey step
- P2: Polish, performance, or nice-to-have improvement

Use sequential IDs per persona: CTO-001, CTO-002, CISO-001, CFO-001, etc.
Every issue MUST include "status": "open".`;
}

// ─── Markdown Builder ────────────────────────────────────────────────

function buildMarkdown({ runFull, mode, TODAY, testResults, releaseGate, cfMetrics, appMetrics,
                         codeQuality, knownIssues, auditReport, counts, delta, runRecord }) {
  const browserSmoke = releaseGate?.results?.find(r => r.name === 'browser smoke');
  const browserSmokeStatus = browserSmoke
    ? browserSmoke.ok
      ? browserSmoke.skipped
        ? `skipped${browserSmoke.stderr ? ` — ${browserSmoke.stderr}` : ''}`
        : 'passed'
      : `failed${browserSmoke.stderr ? ` — ${browserSmoke.stderr}` : ''}`
    : releaseGate?.error
      ? `error — ${releaseGate.error}`
      : 'unknown';

  const header = `# Full Audit — ${TODAY}
**Mode:** ${mode} | **Full AI Audit:** ${runFull ? 'Yes' : 'No'}
**Tests:** ${testResults.passed}/${testResults.total} passing${testResults.failed > 0 ? ` — ⚠ ${testResults.failed} FAILING` : ''}
**Browser Smoke:** ${browserSmokeStatus}
**Open Issues:** P0: ${counts.P0} | P1: ${counts.P1} | P2: ${counts.P2}

---
`;

  // ── Static data sections ──

  const testSection = `## Test Results
\`\`\`json
${JSON.stringify(testResults, null, 2)}
\`\`\`

`;

  const releaseGateSection = `## Release Gate Status
\`\`\`json
${JSON.stringify(releaseGate, null, 2)}
\`\`\`

`;

  const topFindings = (codeQuality?.findings || []).slice(0, 20)
    .map(f => `- \`${f.file}:${f.line}\` [${f.type}] — ${f.snippet}`)
    .join('\n');

  const codeQualitySection = `## Code Quality Findings
\`\`\`json
${JSON.stringify(codeQuality?.summary, null, 2)}
\`\`\`
${topFindings ? '\n### Top Findings\n\n' + topFindings + '\n' : ''}
`;

  const currentIssuesSection = `## Current Open Issues (Registry)
\`\`\`json
${JSON.stringify(knownIssues?.currentIssues || [], null, 2)}
\`\`\`

`;

  const historicalIssuesSection = `## Historical Findings Reference
\`\`\`json
${JSON.stringify(knownIssues?.historicalIssues || [], null, 2)}
\`\`\`

`;

  const cfSection = `## Cloudflare Metrics (7d)
\`\`\`json
${JSON.stringify(cfMetrics, null, 2)}
\`\`\`

## App Analytics
\`\`\`json
${JSON.stringify(appMetrics, null, 2)}
\`\`\`

`;

  // ── AI sections (Flow Analysis → Master Issue Registry) ──
  const aiContent = runFull && auditReport
    ? auditReport + '\n\n'
    : [
        '## Flow Analysis',
        '',
        '*Vitals-only run — AI audit not executed.*',
        '',
        '## CTO Synopsis',
        '',
        '*Vitals-only run — AI audit not executed.*',
        '',
        '## CISO Synopsis',
        '',
        '*Vitals-only run — AI audit not executed.*',
        '',
        '## CFO Synopsis',
        '',
        '*Vitals-only run — AI audit not executed.*',
        '',
        '## CMO Synopsis',
        '',
        '*Vitals-only run — AI audit not executed.*',
        '',
        '## CIO Synopsis',
        '',
        '*Vitals-only run — AI audit not executed.*',
        '',
        '## Practitioner UX Journey',
        '',
        '*Vitals-only run — AI audit not executed.*',
        '',
        '## CEO Executive Summary',
        '',
        '*Vitals-only run — AI audit not executed.*',
        '',
        '## Master Issue Registry',
        '',
        '```json',
        '[]',
        '```',
        '',
      ].join('\n') + '\n';

  // ── Delta Summary ──
  const deltaSection = `## Delta Summary
\`\`\`json
${JSON.stringify({ new: delta.new, resolved: delta.resolved, regressions: delta.regressions }, null, 2)}
\`\`\`

`;

  const footer = `---
*Generated by Prime Self Audit Bot on ${new Date().toISOString()}*
`;

  return header + testSection + releaseGateSection + codeQualitySection + currentIssuesSection + historicalIssuesSection + cfSection + aiContent + deltaSection + footer;
}

// ─── Run ─────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('[Audit] Fatal error:', err);
  process.exit(1);
});
