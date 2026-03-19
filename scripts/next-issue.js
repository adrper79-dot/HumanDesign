#!/usr/bin/env node
/**
 * next-issue.js — Resolution loop driver.
 *
 * Reads the issue registry, picks the highest-priority open issue,
 * and prints a ready-to-paste Claude Code fix prompt.
 *
 * Usage:
 *   node scripts/next-issue.js            # next open P0
 *   node scripts/next-issue.js --severity P1   # next P1
 *   node scripts/next-issue.js --all      # list all open issues
 *   node scripts/next-issue.js --summary  # counts only
 */

import { readRegistry } from './audit-state.js';

const args = process.argv.slice(2);
const showAll     = args.includes('--all');
const summaryOnly = args.includes('--summary');
const targetSev   = args.includes('--severity') ? args[args.indexOf('--severity') + 1] : null;

// ── Area fix-order priority (lower index = higher priority) ──────────────────
const AREA_PRIORITY = [
  'observability', 'logging', 'error-handling', // see first, fix first
  'rate-limiting', 'auth', 'data-isolation', 'csp', 'webhooks', // security
  'billing', 'quota', 'analytics',               // financial risk
  'feature-gap',                                  // missing features
  'retention', 'practitioner-value', 'referral',  // growth
];

// Persona fix-order (CTO/CIO observability first, CISO security, CFO billing, PRAC/CMO product)
const PERSONA_PRIORITY = ['CTO', 'CIO', 'CISO', 'CFO', 'Practitioner', 'CMO'];

const SEVERITY_ORDER = ['P0', 'P1', 'P2'];

function issueScore(issue) {
  const sev  = SEVERITY_ORDER.indexOf(issue.severity);
  const area = AREA_PRIORITY.indexOf(issue.area);
  const per  = PERSONA_PRIORITY.indexOf(issue.persona);
  return (sev === -1 ? 99 : sev) * 1000
       + (area === -1 ? 99 : area) * 10
       + (per  === -1 ? 99 : per);
}

// ── Fix prompts per issue ID (hand-tuned for Claude Code) ───────────────────
const FIX_PROMPTS = {
  'CTO-001': `Implement X-Request-ID request correlation across all Workers handlers.
Create workers/src/lib/logger.js with:
  - generateRequestId() → crypto.randomUUID() short form
  - structuredLog(level, message, fields) → JSON to console.log
  - withRequestId(handler) → middleware that attaches req-id to context
Thread the request ID through every handler response header and every log line.`,

  'CTO-002': `Replace all unstructured console.log/error/warn calls in workers/src/ with
structured JSON logging via the logger.js module (create it if needed):
  { level, timestamp, requestId, message, ...fields }
Run: node scripts/collectors/code-quality.js to verify count drops to 0.`,

  'CTO-003': `Add a withRetry(fn, { retries=3, backoff=100 }) wrapper in workers/src/lib/db.js
(or the existing query helper). Wrap all neon DB calls with it.
Handle specific Neon cold-start error codes separately from schema errors.`,

  'CTO-004': `The 13.33% production error rate root cause is unknown without Sentry.
Fix CIO-001 (Sentry) first to get stack traces, then return to this issue.`,

  'CTO-005': `Add a withTimeout(fn, ms) wrapper and use it on all external calls:
Stripe, Resend, Telnyx, push notification calls in workers/src/handlers/.
On timeout, return a structured error response; do not let the Worker hang.`,

  'CIO-001': `Integrate Sentry in workers/src/index.js using @sentry/cloudflare.
  - npm install @sentry/cloudflare --prefix workers
  - Init in the Worker fetch handler with SENTRY_DSN from env
  - Capture unhandled exceptions + manually caught errors in handlers
  - Add SENTRY_DSN to wrangler.toml vars comment and SECRETS_GUIDE.md`,

  'CIO-002': `See CTO-002. Structured logging and CIO-002 are the same remediation.`,

  'CIO-003': `See CTO-001. X-Request-ID and CIO-003 are the same remediation.`,

  'CISO-001': `Migrate JWT from localStorage to HttpOnly SameSite=Strict cookies.
  - Worker: set-cookie on login/refresh; clear on logout
  - Frontend: remove all localStorage.setItem/getItem for tokens
  - Update Auth header reads in Worker to use Cookie header
  This is a multi-file change; read auth.js and app.js fully before touching.`,

  'CISO-002': `Audit agency.js and practitioner.js for all DB queries that return client data.
Every query must include WHERE practitioner_id = $1 using the JWT sub claim.
Add integration tests proving User A cannot read User B's clients.`,

  'CISO-003': `Audit index.html Content-Security-Policy header (set in _headers or Worker).
Extract all inline <script> blocks to external .js files.
Set CSP to script-src 'self' with no unsafe-inline.`,

  'CISO-004': `Add rate limiting middleware to auth endpoints in workers/src/middleware/.
Use Cloudflare KV with sliding window: 10 login attempts / 15 min / IP.
Apply to: /api/auth/login, /api/auth/register, /api/auth/forgot-password, /api/auth/resend.`,

  'CFO-001': `Gate the Agency tier ($349/mo) behind a "Contact us" CTA instead of live checkout.
In billing.js: if priceId === AGENCY_PRICE_ID, return JSON with contactUrl instead of Stripe session.
In frontend: replace Agency checkout button with mailto/contact link.`,

  'CFO-002': `Add idempotency key checking to all Stripe webhook event handlers in billing.js.
Store processed event IDs in KV with 7-day TTL: if already seen, return 200 immediately.
Cover: checkout.session.completed, invoice.paid, customer.subscription.updated/deleted.`,

  'CFO-003': `Add quota pre-flight check before every AI call in the relevant handler.
Read user tier from JWT, look up usage from DB, compare to tier limit.
If over limit, return 402 with upgrade prompt before making the AI API call.`,

  'CFO-004': `The HTTP 401 on /api/analytics/audit means AUDIT_SECRET is not set in the Worker.
Run: cd workers && npx wrangler secret put AUDIT_SECRET
Use a rotated value (the previous one was exposed). Then re-run: npm run audit:vitals`,

  'CMO-001': `For every Human Design label displayed in the frontend (type, authority, profile,
defined centers, channels, gates): add a collapsible "What this means for you" section.
These should be personalized copy per combination, not generic definitions.
Start with the 5 most-viewed: Energy Type, Authority, Profile, Defined Heart, Defined Sacral.`,

  'CMO-002': `Practitioner directory profiles need SSR or static generation + meta tags.
Add og:title, og:description, canonical URL, and Person schema JSON-LD to profile pages.
If profiles are SPA-only, add a Cloudflare Worker route that server-renders the meta tags.`,

  'CMO-003': `Design and build a referral system:
  - DB: referral_codes table (user_id, code, uses, created_at)
  - Worker: /api/referral/generate and /api/referral/[code] endpoints
  - Frontend: share card with referral link after chart generation
  - Reward: free month credit on first referred paid conversion`,

  'PRAC-001': `Build session notes feature:
  - DB migration: session_notes(id, practitioner_id, client_user_id, content, created_at)
  - Worker handler: GET/POST/PATCH /api/practitioner/sessions
  - Frontend: notes tab/panel in the client detail view
  - Scope notes by practitioner_id (never visible to client)`,

  'PRAC-002': `Notion sync is NOT built yet. Either:
  a) Remove it from all marketing copy immediately (safe, fast), OR
  b) Build Notion OAuth + sync pipeline (Notion API, 2-3 day effort)
  Start with (a) to remove the legal/trust risk, then plan (b) as a feature sprint.`,

  'PRAC-003': `Build the practitioner public directory:
  - DB: practitioner_profiles(practitioner_id, slug, bio, specialties, booking_url, public)
  - Worker: GET /api/directory and GET /api/directory/[slug]
  - Frontend: /directory route with search, and /[slug] profile page
  - SEO: server-rendered meta tags per profile (see CMO-002)`,
};

const asBulletedList = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return value.map(item => `- ${item}`).join('\n');
  return `- ${value}`;
};

const DEFAULT_PROMPT = (issue) => {
  const fileScope = issue.file ? `\nFile scope:\n${asBulletedList(issue.file)}` : '';
  const requirements = issue.requirements ? `\nRequirements:\n${asBulletedList(issue.requirements)}` : '';
  const acceptance = issue.acceptanceCriteria ? `\nAcceptance Criteria:\n${asBulletedList(issue.acceptanceCriteria)}` : '';
  const constraints = issue.constraints ? `\nConstraints:\n${asBulletedList(issue.constraints)}` : '';
  const fixPlan = issue.fix
    ? `\nImplementation Plan:\n${asBulletedList(issue.fix)}`
    : '\nImplementation Plan:\n- Review the relevant files first\n- Implement the fix with minimal blast radius\n- Add/adjust tests for the changed behavior';

  return [
    `Fix issue ${issue.id}: ${issue.title}`,
    `Area: ${issue.area} | Severity: ${issue.severity}`,
    fixPlan,
    fileScope,
    requirements,
    acceptance,
    constraints,
    '\nVerification Steps:\n- Run npm run test:deterministic\n- Run targeted manual checks for touched user flow\n- Summarize risks and follow-up items if any gate is incomplete'
  ].join('');
};

// ─────────────────────────────────────────────────────────────────────────────

const registry = readRegistry();
const openIssues = registry.issues.filter(i => i.status === 'open');

if (summaryOnly) {
  const counts = { P0: 0, P1: 0, P2: 0 };
  for (const i of openIssues) counts[i.severity] = (counts[i.severity] || 0) + 1;
  console.log(`Open issues — P0: ${counts.P0 || 0}  P1: ${counts.P1 || 0}  P2: ${counts.P2 || 0}`);
  console.log(`Mode: ${registry.mode}`);
  process.exit(0);
}

const filtered = openIssues
  .filter(i => !targetSev || i.severity === targetSev)
  .sort((a, b) => issueScore(a) - issueScore(b));

if (filtered.length === 0) {
  const scope = targetSev || 'P0';
  console.log(`\n✓ No open ${scope} issues. Run npm run audit:vitals to confirm.\n`);
  process.exit(0);
}

if (showAll) {
  console.log(`\nOpen issues (${filtered.length} total):\n`);
  for (const issue of filtered) {
    const status = issue.status === 'open' ? '🔴' : '✓';
    console.log(`  ${status} [${issue.severity}] ${issue.id.padEnd(10)} ${issue.title}`);
  }
  console.log();
  process.exit(0);
}

// ── Show next single issue ──────────────────────────────────────────────────
const next = filtered[0];
const remaining = filtered.length;
const prompt = FIX_PROMPTS[next.id] || DEFAULT_PROMPT(next);

console.log(`
${'─'.repeat(60)}
  NEXT ISSUE  [${next.severity}] ${next.id}
${'─'.repeat(60)}
Title  : ${next.title}
Area   : ${next.area}
Persona: ${next.persona}
Status : ${next.status}  |  First seen: ${next.firstSeen}

Remaining open issues: ${remaining} (${filtered.filter(i=>i.severity==='P0').length} P0)
${'─'.repeat(60)}

FIX PROMPT (paste into Claude Code):
${'·'.repeat(60)}
${prompt}
${'·'.repeat(60)}

After fixing, verify with:
  npm run test:deterministic

Then mark resolved with:
  node scripts/mark-resolved.js ${next.id}
`);
