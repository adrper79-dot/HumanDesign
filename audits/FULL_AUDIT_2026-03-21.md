# Full Audit — 2026-03-21
**Mode:** MAINTENANCE | **Full AI Audit:** Yes
**Tests:** 1025/1033 passing
**Browser Smoke:** passed
**Open Issues:** P0: 0 | P1: 0 | P2: 0

---
## Test Results
```json
{
  "total": 1033,
  "passed": 1025,
  "failed": 0,
  "skipped": 8,
  "failures": []
}
```

## Release Gate Status
```json
{
  "ok": true,
  "baseUrl": "https://selfprime.net",
  "prodApi": "https://prime-self-api.adrper79.workers.dev",
  "apiOnly": false,
  "strictBrowser": true,
  "allowSkipBrowser": false,
  "hasBrowserCreds": true,
  "results": [
    {
      "name": "worker verification",
      "ok": true,
      "code": 0,
      "stdout": "Verifying production endpoints against https://prime-self-api.adrper79.workers.dev\nPASS health -> 200\nPASS geocode -> 200\nPASS register validation -> 400\nPASS forecast validation -> 400\nVerification complete: 4/4 passed\n",
      "stderr": ""
    },
    {
      "name": "public canary",
      "ok": true,
      "code": 0,
      "stdout": "Running public canary against https://selfprime.net and https://prime-self-api.adrper79.workers.dev\nPASS frontend home -> 200\nPASS frontend pricing -> 200\nPASS frontend embed -> 200\nPASS api health -> 200\nPASS api geocode -> 200\nPASS api register validation -> 400\nPASS api chart calculate -> 200\nCanary complete: 7/7 passed\n",
      "stderr": ""
    },
    {
      "name": "money path canary",
      "ok": true,
      "code": 0,
      "stdout": "{\n  \"apiBase\": \"https://prime-self-api.adrper79.workers.dev\",\n  \"frontendBase\": \"https://selfprime.net\",\n  \"authMode\": \"login\",\n  \"email\": \"testadmin10@blackkryptonians.com\",\n  \"individualSessionId\": \"cs_live_b1oME5RQ1GmwSXTgCUkAAINvkva8BgwLtxlXOEZtD6xztnHbyNNSsnQadz\",\n  \"individualSessionReused\": true,\n  \"practitionerSessionId\": \"cs_live_b1SyRBleMyauppfHNwwd0AXpeModp10Atd1Hg8pS3XXMu3HLylE7dQXJEf\",\n  \"agencyContactRequired\": true,\n  \"portalStatus\": 200,\n  \"portalOk\": true,\n  \"portalBody\": {\n    \"ok\": true,\n    \"url\": \"https://billing.stripe.com/p/session/live_YWNjdF8xU2xDY0ZBVzEyMjlUWnRlLF9VQmRvNVZVWFJib1UxYkVlOWhxY1RsdUdKZ0puZ0xp01006KJwG62T\"\n  },\n  \"cyclesParamValidation\": {\n    \"status\": 400,\n    \"errorCorrect\": true\n  },\n  \"rectifyParamValidation\": {\n    \"status\": 400,\n    \"errorCorrect\": true,\n    \"error\": \"Validation failed\"\n  }\n}\n",
      "stderr": ""
    },
    {
      "name": "browser smoke",
      "ok": true,
      "code": 0,
      "stdout": "\nRunning 5 tests using 2 workers\n\n\u001b[1A\u001b[2K[1/5] [chromium] › tests\\e2e\\prod-smoke.spec.ts:67:3 › Production smoke › same-origin worker health responds from production\n\u001b[1A\u001b[2K[2/5] [chromium] › tests\\e2e\\prod-smoke.spec.ts:56:3 › Production smoke › public homepage renders on the live site\n\u001b[1A\u001b[2K[3/5] [chromium] › tests\\e2e\\prod-smoke.spec.ts:76:3 › Production smoke › login works on production and can recover after reload\n\u001b[1A\u001b[2K[4/5] [chromium] › tests\\e2e\\prod-smoke.spec.ts:90:3 › Production smoke › directory can drill into a live practitioner profile\n\u001b[1A\u001b[2K[5/5] [chromium] › tests\\e2e\\prod-smoke.spec.ts:119:3 › Production smoke › mobile viewport renders primary navigation on production\n\u001b[1A\u001b[2K  1 skipped\n  4 passed (13.8s)\n",
      "stderr": ""
    }
  ]
}
```

## Code Quality Findings
```json
{
  "totalFindings": 65,
  "hardcodedSecrets": 0,
  "emptyCatchBlocks": 0,
  "unstructuredLogs": 64,
  "techDebtComments": 1,
  "filesScanned": 93
}
```

### Top Findings

- `/workers/src/db/migrate.js:57` [unstructured-log] — console.log('Connected to database');
- `/workers/src/db/migrate.js:62` [unstructured-log] — console.log(`Executing base schema from ${sqlPath}...`);
- `/workers/src/db/migrate.js:64` [unstructured-log] — console.log('✓ Base schema applied');
- `/workers/src/db/migrate.js:78` [unstructured-log] — console.log('⚠  No migrations directory found. Skipping numbered migrations.');
- `/workers/src/db/migrate.js:91` [unstructured-log] — console.warn(`⚠  ${name}: CHECKSUM MISMATCH (file changed since applied). Skipping.`);
- `/workers/src/db/migrate.js:93` [unstructured-log] — console.log(`  ⏭  ${name} — already applied`);
- `/workers/src/db/migrate.js:98` [unstructured-log] — console.log(`  🚀 ${name} — applying...`);
- `/workers/src/db/migrate.js:107` [unstructured-log] — console.log(`  ✓ ${name} — done`);
- `/workers/src/db/migrate.js:111` [unstructured-log] — console.error(`  ✗ ${name} — FAILED: ${err.message}`);
- `/workers/src/db/migrate.js:116` [unstructured-log] — console.log(`\n✓ Migration complete! ${newCount} new migration(s) applied.`);
- `/workers/src/db/migrate.js:119` [unstructured-log] — console.error('Migration failed:', err);
- `/workers/src/db/migrate.js:132` [unstructured-log] — console.error('Migration failed:', err);
- `/workers/src/db/migrate.js:136` [unstructured-log] — console.error('Usage: NEON_CONNECTION_STRING=... node workers/src/db/migrate.js');
- `/workers/src/handlers/achievements.js:324` [unstructured-log] — console.log(`Achievement unlocked:`, {
- `/workers/src/handlers/achievements.js:462` [unstructured-log] — console.log(`Milestone unlocked:`, {
- `/workers/src/handlers/auth.js:329` [unstructured-log] — console.warn('[auth] Referral capture failed (non-fatal):', err.message);
- `/workers/src/handlers/checkin.js:144` [unstructured-log] — console.warn('Failed to compute transit snapshot:', error);
- `/workers/src/handlers/google-calendar.js:151` [unstructured-log] — console.error('Google Calendar callback error:', err.message);
- `/workers/src/handlers/push.js:212` [tech-debt-comment] — * Delivery to APNs/FCM is a TODO — see ADR-001 build step 9.
- `/workers/src/handlers/rectify.js:155` [unstructured-log] — console.warn('Rectification DB storage unavailable, proceeding with calculation only', err.message);

## Current Open Issues (Registry)
```json
[]
```

## Historical Findings Reference
```json
[
  {
    "id": "PRODUC-001",
    "title": "Severity: P1 (functional) / P0 (IDOR cannot be confirmed)",
    "severity": "P0",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-002",
    "title": "Severity: P1 (functional breaking) — multiple features unusable",
    "severity": "P1",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-003",
    "title": "Severity: P1 (security)",
    "severity": "P1",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-004",
    "title": "Severity: P1 (security/functionality)",
    "severity": "P1",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-005",
    "title": "Severity: P1",
    "severity": "P1",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-006",
    "title": "Severity: P1 (should be 402/403)",
    "severity": "P1",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-008",
    "title": "Severity: P1 (public endpoint, no auth required)",
    "severity": "P1",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-010",
    "title": "Severity: P2",
    "severity": "P2",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-014",
    "title": "Severity: P2 (by design, but should be documented)",
    "severity": "P2",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-016",
    "title": "P1 sprint | BUG-001 (GET chart 500) | Investigate handleGetChart, add error boundary |",
    "severity": "P1",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-017",
    "title": "P1 sprint | BUG-003/004 (password reset) | Apply migration 021_password_reset_tokens.sql to production |",
    "severity": "P1",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-018",
    "title": "P1 sprint | BUG-005 (profile list 500) | Investigate handleProfileList |",
    "severity": "P1",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-019",
    "title": "P1 sprint | BUG-006 (practitioner 500) | Add tier gate handling in handleGetPractitionerProfile |",
    "severity": "P1",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-020",
    "title": "P1 sprint | BUG-007 (check-in 500) | Investigate check-in streak/stats handlers after auth fix deployed |",
    "severity": "P1",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-021",
    "title": "P1 sprint | BUG-008 (leaderboard 500) | Investigate achievements leaderboard handler |",
    "severity": "P1",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "PRODUC-022",
    "title": "P2 | BUG-009/010/011/012/013 | Investigate individually |",
    "severity": "P2",
    "status": "open",
    "source": "PRODUCTION_BUG_REPORT"
  },
  {
    "id": "WORKER-023",
    "title": "Severity Levels: CRITICAL · HIGH · MEDIUM · LOW",
    "severity": "P0",
    "status": "open",
    "source": "WORKERS_AUDIT"
  },
  {
    "id": "WORKER-024",
    "title": "CRITICAL | 7 | Phantom tables, missing columns, data loss risk |",
    "severity": "P0",
    "status": "open",
    "source": "WORKERS_AUDIT"
  },
  {
    "id": "WORKER-025",
    "title": "HIGH | 9 | Duplicate logic, signature mismatches, security gaps |",
    "severity": "P1",
    "status": "open",
    "source": "WORKERS_AUDIT"
  },
  {
    "id": "WORKER-026",
    "title": "MEDIUM | 12 | Dead code, template bugs, inconsistencies |",
    "severity": "P2",
    "status": "open",
    "source": "WORKERS_AUDIT"
  },
  {
    "id": "BACKLO-027",
    "title": "> Order of Operations: Make release gates deterministic → verify browser smoke path → rerun vitals → close the final P1",
    "severity": "P1",
    "status": "open",
    "source": "BACKLOG"
  }
]
```

## Cloudflare Metrics (7d)
```json
{
  "available": false,
  "reason": "missing credentials"
}
```

## App Analytics
```json
{
  "available": false,
  "reason": "missing credentials"
}
```

## Flow Analysis

*Vitals-only run — AI audit not executed.*

## CTO Synopsis

*Vitals-only run — AI audit not executed.*

## CISO Synopsis

*Vitals-only run — AI audit not executed.*

## CFO Synopsis

*Vitals-only run — AI audit not executed.*

## CMO Synopsis

*Vitals-only run — AI audit not executed.*

## CIO Synopsis

*Vitals-only run — AI audit not executed.*

## Practitioner UX Journey

*Vitals-only run — AI audit not executed.*

## CEO Executive Summary

*Vitals-only run — AI audit not executed.*

## Master Issue Registry

```json
[]
```

## Delta Summary
```json
{
  "new": 0,
  "resolved": 0,
  "regressions": 0
}
```

---
*Generated by Prime Self Audit Bot on 2026-03-21T03:49:29.436Z*
