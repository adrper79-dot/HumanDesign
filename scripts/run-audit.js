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
import { resolve }    from 'path';

import { collectTestResults }       from './collectors/test-results.js';
import { collectCloudflareMetrics } from './collectors/cloudflare-metrics.js';
import { collectAppMetrics }        from './collectors/app-metrics.js';
import { collectCodeQuality }       from './collectors/code-quality.js';
import {
  readRegistry,
  writeRegistry,
  determineMode,
  shouldRunFullAudit,
  mergeIssues,
  appendHistory,
  countBySeverity,
} from './audit-state.js';

const AUDITS_DIR   = resolve(process.cwd(), 'audits');
const TODAY        = new Date().toISOString().slice(0, 10);
const VITALS_ONLY  = process.argv.includes('--vitals-only');
const FORCE_FULL   = process.argv.includes('--force-full');

// ─── Ensure output directory ─────────────────────────────────────────

mkdirSync(resolve(AUDITS_DIR, '../tests/results'), { recursive: true });
mkdirSync(AUDITS_DIR, { recursive: true });

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
  const [testResults, cfMetrics, appMetrics, codeQuality] = await Promise.all([
    collectTestResults()       .catch(e => ({ error: e.message })),
    collectCloudflareMetrics() .catch(e => ({ available: false, reason: e.message })),
    collectAppMetrics()        .catch(e => ({ available: false, reason: e.message })),
    collectCodeQuality()       .catch(e => ({ error: e.message })),
  ]);

  console.log(`[Audit] Tests: ${testResults.passed}/${testResults.total} passed, ${testResults.failed} failed`);
  console.log(`[Audit] CF Metrics: ${cfMetrics.available ? `${cfMetrics.totalRequests} reqs, ${cfMetrics.errorRatePct}% errors` : 'unavailable'}`);
  console.log(`[Audit] App Metrics: ${appMetrics.available ? `DAU=${appMetrics.dau}` : 'unavailable'}`);
  console.log(`[Audit] Code Quality: ${codeQuality.summary?.totalFindings ?? 'error'} findings`);

  let auditReport = null;
  let newIssues   = [];

  // ── Full AI audit ──
  if (runFull) {
    console.log('[Audit] Running full AI audit (calling Anthropic API)...');
    const result = await runFullAudit({ testResults, cfMetrics, appMetrics, codeQuality, registry, mode });
    auditReport = result.report;
    newIssues   = result.issues;
  }

  // ── Update issue registry ──
  const { merged, delta } = mergeIssues(registry.issues, newIssues, TODAY);
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
    runFull, mode, TODAY, testResults, cfMetrics, appMetrics, codeQuality,
    auditReport, counts, delta, runRecord,
  });

  writeFileSync(outputPath, outputMd, 'utf8');
  console.log(`[Audit] Report written → ${outputPath}`);

  // ── Summary ──
  console.log(`\n[Audit] ─────────────────────────────────`);
  console.log(`[Audit] P0 open: ${counts.P0} | P1: ${counts.P1} | P2: ${counts.P2}`);
  console.log(`[Audit] Delta: +${delta.new} new, ✓${delta.resolved} resolved, ↩${delta.regressions} regressions`);
  console.log(`[Audit] Mode: ${updatedRegistry.mode} | Consecutive clean runs: ${updatedRegistry.consecutiveCleanRuns}`);

  // Exit 1 if P0s open — blocks deploy in GH Actions
  if (counts.P0 > 0) {
    console.error(`\n[Audit] ⚠ ${counts.P0} P0 issue(s) open. Review issue-registry.json.`);
    process.exit(1);
  }

  process.exit(0);
}

// ─── Full AI Audit ───────────────────────────────────────────────────

async function runFullAudit({ testResults, cfMetrics, appMetrics, codeQuality, registry, mode }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[Audit] ANTHROPIC_API_KEY not set — skipping AI personas.');
    return { report: null, issues: [] };
  }

  const prompt = buildAuditPrompt({ testResults, cfMetrics, appMetrics, codeQuality, registry, mode });

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
  const match = text.match(/```json\s*\[[\s\S]*?\]\s*```/);
  if (!match) return [];
  try {
    return JSON.parse(match[0].replace(/```json\s*/, '').replace(/\s*```/, ''));
  } catch {
    return [];
  }
}

// ─── Prompt Builder ──────────────────────────────────────────────────

function buildAuditPrompt({ testResults, cfMetrics, appMetrics, codeQuality, registry, mode }) {
  const prevIssues = registry.issues.filter(i => i.status === 'open').slice(0, 30);

  return `You are conducting a full-spectrum audit of Prime Self — a Cloudflare Workers API + vanilla JS PWA.
Product: Personal development SaaS using Human Design synthesis. Tiers: Free, Individual ($19/mo), Guide/Practitioner ($97/mo), Agency ($349/mo).
API: https://prime-self-api.adrper79.workers.dev | Frontend: https://selfprime.net
Current audit mode: ${mode}

## COLLECTED DATA

### Test Results
${JSON.stringify(testResults, null, 2)}

### Cloudflare Worker Metrics (last 7 days)
${JSON.stringify(cfMetrics, null, 2)}

### App Analytics
${JSON.stringify(appMetrics, null, 2)}

### Code Quality Scan
${JSON.stringify(codeQuality, null, 2)}

### Currently Open Issues from Previous Run
${JSON.stringify(prevIssues, null, 2)}

## YOUR TASK

Produce a structured audit report with these EXACT sections in this order:

### CTO Synopsis
Analyze: architecture soundness, handler complexity, missing error handling patterns (no structured logging, no request IDs, no retry wrapper on DB calls), test coverage gaps, tech debt that blocks scaling. Rate each area GREEN/YELLOW/RED. 300 words max.

### CISO Synopsis
Analyze: JWT in localStorage (known gap — HttpOnly cookies pending), CSP unsafe-inline, OAuth flow, practitioner data isolation (can User A see User B?), Stripe webhook signature verification, SQL injection surface, rate limiting gaps. Rate each area GREEN/YELLOW/RED. 300 words max.

### CFO Synopsis
Analyze: Studio tier checkout active but features not built (BL-MV-N1 CRIT), Stripe webhook idempotency (double-charge risk), subscription state sync, quota enforcement before AI calls, free tier abuse vectors, revenue recognition. Rate each area GREEN/YELLOW/RED. 300 words max.

### CMO Synopsis
Analyze: registration-to-profile funnel drop points, "why it matters" explanations (#1 churn driver — every data point shows raw labels without life implications), onboarding Savannah arc quality, practitioner dashboard discoverability, referral mechanics, social share hooks. Rate each area GREEN/YELLOW/RED. 300 words max.

### CIO Synopsis
Analyze: structured logging coverage (is X-Request-ID present? durationMs logged?), Sentry integration, health endpoint depth (/api/health?full=1), KV cache strategy, Worker CPU efficiency from CF metrics, deployment pipeline, cron job reliability. Rate each area GREEN/YELLOW/RED. 300 words max.

### Practitioner UX Journey
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

### CEO Executive Summary
200 words max. Overall health. Top 5 issues that would cause a practitioner to churn. Top 3 legal/financial risks. Readiness rating: NOT READY / SOFT LAUNCH READY / LAUNCH READY.

### Issue Registry
Output a JSON array of ALL issues identified across all personas. Use this exact format:

\`\`\`json
[
  {
    "id": "CTO-001",
    "persona": "CTO",
    "severity": "P0",
    "area": "logging",
    "title": "No request correlation IDs — undebuggable in production"
  }
]
\`\`\`

Severity rules:
- P0: Would cause data loss, billing error, security breach, or complete feature failure
- P1: Degrades experience significantly or blocks a user journey step
- P2: Polish, performance, or nice-to-have improvement

Use sequential IDs per persona: CTO-001, CTO-002, CISO-001, CFO-001, etc.`;
}

// ─── Markdown Builder ────────────────────────────────────────────────

function buildMarkdown({ runFull, mode, TODAY, testResults, cfMetrics, appMetrics,
                         codeQuality, auditReport, counts, delta, runRecord }) {
  const header = `# Prime Self Audit — ${TODAY}
**Mode:** ${mode} | **Full AI Audit:** ${runFull ? 'Yes' : 'No'}
**Tests:** ${testResults.passed}/${testResults.total} passing${testResults.failed > 0 ? ` — ⚠ ${testResults.failed} FAILING` : ''}
**Open Issues:** P0: ${counts.P0} | P1: ${counts.P1} | P2: ${counts.P2}
**Delta:** +${delta.new} new · ✓${delta.resolved} resolved · ↩${delta.regressions} regressions

---
`;

  const vitalsSection = `## Vitals

### Test Results
\`\`\`json
${JSON.stringify(testResults, null, 2)}
\`\`\`

### Cloudflare Worker Metrics (7d)
\`\`\`json
${JSON.stringify(cfMetrics, null, 2)}
\`\`\`

### App Analytics
\`\`\`json
${JSON.stringify(appMetrics, null, 2)}
\`\`\`

### Code Quality Scan
\`\`\`json
${JSON.stringify(codeQuality?.summary, null, 2)}
\`\`\`

`;

  const aiSection = runFull && auditReport
    ? `## AI Audit\n\n${auditReport}\n\n`
    : `## AI Audit\n\n*Vitals-only run — AI audit not executed.*\n\n`;

  const footer = `---
*Generated by Prime Self Audit Bot on ${new Date().toISOString()}*
`;

  return header + vitalsSection + aiSection + footer;
}

// ─── Run ─────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('[Audit] Fatal error:', err);
  process.exit(1);
});
