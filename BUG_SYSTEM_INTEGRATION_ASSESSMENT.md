# Bug System Integration Assessment

**Date:** 2026-03-16  
**Scope:** Evaluate integration opportunities between bug reporting system and existing analytics/error logging systems  
**Status:** ✅ Assessment Complete — Ready for backlog incorporation

---

## Executive Summary

The bug reporting system (completed 2026-03-16) operates in isolation from the existing analytics, error logging, and session tracking systems. This assessment identifies **8 major integration opportunities** that would dramatically improve insights, automation, and system reliability.

**Key Findings:**
- ✅ System is architecturally sound (6 tables, normalized schema, workflow automation)
- ❌ Bug data is siloed (no link to sessions, no correlation with errors, no analytics integration)
- ❌ Error logging is scattered (console.log only, no Sentry/observability, no auto-capture)
- ⚠️ Analytics dashboard only tracks scores (no error trends, no severity distribution, no regression tracking)
- 🔥 Opportunities exist for 100% automated error capture + correlation analysis

---

## 1. Session Integration Gap

### Problem
Bug reports are created in isolation—no link to `simulation_sessions` table.

**Current State:**
- `bug_reports` has: title, severity, category, error_stack, console_logs
- Missing: `session_id`, `job_title_id`, `scenario_id`, `user_id` links
- Impact: Cannot answer "which scenarios have most bugs?" or "did this trainee trigger the bug?"

### Opportunity
Link every bug to the session that triggered it.

**Value:**
- Identify bug-prone scenarios (e.g., "Payment form has 40% bug rate")
- Calculate "bug impact score" = bugs / completions per scenario
- Detect if specific trinees trigger more bugs (training gap vs environment issue)
- Enable root cause: "Bug happens in product-return role, not customer-service"

**Implementation:**
```sql
ALTER TABLE bug_reports ADD COLUMN session_id UUID REFERENCES simulation_sessions(id);
ALTER TABLE bug_reports ADD COLUMN job_title_id UUID REFERENCES job_titles(id);
ALTER TABLE bug_reports ADD COLUMN scenario_id UUID REFERENCES scenarios(id);

-- Index for performance
CREATE INDEX idx_bugs_session ON bug_reports(session_id);
CREATE INDEX idx_bugs_scenario ON bug_reports(scenario_id);
CREATE INDEX idx_bugs_job_title ON bug_reports(job_title_id);
```

**Backend Logic:**
- When bug is submitted via form, capture `window.location.href` and cross-reference with active sessions
- Or: Pass `sessionId` from `BugReportModal` component prop
- Store session metadata at bug creation time (immutable record)

**Queries Enabled:**
```sql
-- Top 10 bug-prone scenarios
SELECT scenario_id, COUNT(*) as bug_count, 
  ROUND(COUNT(*)::numeric / (
    SELECT COUNT(*) FROM simulation_sessions ss 
    WHERE ss.scenario_id = br.scenario_id
  ), 3) as bug_rate
FROM bug_reports br
GROUP BY scenario_id
ORDER BY bug_count DESC
LIMIT 10;
```

---

## 2. Analytics Dashboard Integration

### Problem
Current analytics dashboard (`/api/analytics`) only tracks **scores**. No visibility into:
- Bug trends (bugs per day, severity distribution over time)
- Error patterns (which categories fail most)
- Correlation: "Sessions with bugs score 2.3 points lower on average"
- Regression trends: "Chart calculation bugs appeared again in 3 sessions—regression detected"

### Current Analytics Available
- Score trend (60-day rolling average)
- Breakdowns by job title, criteria, type
- No error/bug visibility whatsoever

### Opportunity
Add bug metrics to the analytics dashboard.

**Value:**
- DevOps sees: bugs per day → can detect quality degradation
- Product sees: which scenarios are most problematic
- Trainers see: correlation between bugs and low scores (indicates environmental issues)
- Everyone sees: regression detection (pattern X appeared 3+ times in 7 days)

**New Analytics Queries:**
```sql
-- Daily bug metrics (similar to bug_metrics table)
SELECT metric_date, 
  COUNT(*) as total_bugs,
  COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
  COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (fixed_at - reported_at))/3600)::numeric, 2) as avg_fix_hours,
  COUNT(CASE WHEN is_regression THEN 1 END) as regression_count
FROM bug_reports
WHERE reported_at >= NOW() - INTERVAL '60 days'
GROUP BY metric_date
ORDER BY metric_date DESC;

-- Bug impact on score correlation
SELECT 
  COUNT(DISTINCT ss.id) as session_count,
  COUNT(DISTINCT CASE WHEN br.id IS NOT NULL THEN ss.id END) as sessions_with_bugs,
  ROUND(AVG(CASE WHEN br.id IS NULL 
    THEN (SELECT AVG(score) FROM scores s WHERE s.session_id = ss.id)
    ELSE (SELECT AVG(score) FROM scores s WHERE s.session_id = ss.id)
  END)::numeric, 2) as avg_score_no_bug,
  ROUND(AVG(CASE WHEN br.id IS NOT NULL 
    THEN (SELECT AVG(score) FROM scores s WHERE s.session_id = ss.id)
    ELSE NULL
  END)::numeric, 2) as avg_score_with_bug
FROM simulation_sessions ss
LEFT JOIN bug_reports br ON br.session_id = ss.id
WHERE ss.status = 'COMPLETED'
  AND ss.ended_at >= NOW() - INTERVAL '60 days';

-- Regression detection: patterns that recurred
SELECT pattern_id, name, COUNT(*) as occurrence_count, 
  MAX(bug_id) as latest_bug_id, 
  MAX(reported_at) as latest_occurrence
FROM bug_patterns p
JOIN bug_reports br ON br.error_message ~ p.regex_error
WHERE reported_at >= NOW() - INTERVAL '7 days'
GROUP BY pattern_id, name
HAVING COUNT(*) >= 3
ORDER BY occurrence_count DESC;
```

**Frontend Changes:**
- Add new "Bug Trends" section to analytics page
- New cards: "Critical Bugs Open", "Avg Fix Time (hours)", "Regression Count (7d)"
- New chart: "Bugs per day (30-day trend)" with color coding (green safe, red alarming)
- New table: "Top bug-prone scenarios" with bug count + rate

---

## 3. Error Logging & Capture Integration

### Problem
Error logging is **scattered and manual:**
- Route handlers: `console.error()` only (not stored, not queryable)
- Debug endpoint: `/api/debug/groq` returns error details but doesn't persist
- Health check: Only env var validation, no operational metrics
- No Sentry/New Relic integration
- Bug capture: Users must manually type the error

**Impact:**
- Errors disappear—no historical record unless searched in logs
- No correlation: "Did Groq API fail 50 times today?"
- No alerting: Critical errors silently logged to console
- No auto-capture: Errors discovered days later via user report

### Opportunity
Implement structured error logging + auto-capture + correlation.

**Value:**
```
Today: User encounters error → waits days to understand why → files manual bug report
After: Error logged automatically → auto-triaged → developer notified → fix deployed
                                                                        (before user notices)
```

**Implementation Strategy:**

**Phase 1: Structured Logging (Weeks 1-2)**
```python
# Create error_logs table
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type VARCHAR(255),           -- JS error, network error, timeout, etc.
  error_message TEXT,
  error_stack TEXT,
  source_endpoint VARCHAR(255),      -- /api/chat, /api/telnyx/webhook, etc.
  severity VARCHAR(50),              -- warning, error, critical
  session_id UUID REFERENCES simulation_sessions(id),
  user_id TEXT,
  context JSONB,                     -- {method, statusCode, durationMs, ...}
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  INDEX idx_error_logs_type (error_type),
  INDEX idx_error_logs_endpoint (source_endpoint),
  INDEX idx_error_logs_occurred (occurred_at DESC)
);
```

**Phase 2: Error Capture Middleware (Weeks 2-3)**
```ts
// Create error capture middleware
// src/lib/error-capture.ts
export async function captureError(error: Error, context: {
  endpoint: string,
  sessionId?: string,
  userId?: string,
  method: string,
  statusCode: number,
  durationMs: number
}) {
  // 1. Store in error_logs table
  // 2. Check if matches any bug_patterns
  // 3. If pattern matches, increment occurrence count
  // 4. If occurrence >= 3 in 7 days, mark as regression
  // 5. If critical, post Slack alert
  // 6. Return error_log_id for frontend correlation
}

// Apply to all route handlers
export async function GET(request: Request) {
  const start = Date.now();
  try {
    // handler logic
  } catch (error) {
    await captureError(error as Error, {
      endpoint: '/api/chat',
      sessionId: req.session?.id,
      method: 'GET',
      statusCode: 500,
      durationMs: Date.now() - start
    });
    return NextResponse.json({error: 'Internal error'}, {status: 500});
  }
}
```

**Phase 3: Browser Error Capture (Weeks 3-4)**
```ts
// src/lib/browser-error-capture.ts
export function setupErrorCapture() {
  // 1. Capture unhandled JS errors
  window.addEventListener('error', (event) => {
    captureError(event.error, {endpoint: 'browser', context: 'uncaught'});
  });
  
  // 2. Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, {endpoint: 'browser', context: 'unhandled-promise'});
  });
  
  // 3. Wrap fetch to capture network errors
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const start = Date.now();
    const res = await originalFetch(...args);
    if (!res.ok) {
      captureError(new Error(`HTTP ${res.status}`), {
        endpoint: args[0],
        statusCode: res.status,
        durationMs: Date.now() - start
      });
    }
    return res;
  };
}
```

**Phase 4: Sentry Integration (Optional—Week 5)**
```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.Replay({maskAllText: true, blockAllMedia: true}),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

**Queries Enabled:**
```sql
-- Top errors in last 24 hours
SELECT error_type, error_message, COUNT(*) as count, 
  COUNT(DISTINCT source_endpoint) as endpoint_count
FROM error_logs
WHERE occurred_at >= NOW() - INTERVAL '24 hours'
GROUP BY error_type, error_message
ORDER BY count DESC
LIMIT 20;

-- Which endpoints are most error-prone
SELECT source_endpoint, COUNT(*) as error_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (next_error.occurred_at - el.occurred_at)))::numeric, 0) as avg_time_between_errors_sec
FROM error_logs el
LEFT JOIN error_logs next_error ON next_error.source_endpoint = el.source_endpoint 
  AND next_error.occurred_at > el.occurred_at
WHERE el.occurred_at >= NOW() - INTERVAL '7 days'
GROUP BY source_endpoint
ORDER BY error_count DESC;

-- Regressions detected (same error 3+ times in 7 days)
SELECT el.error_message, COUNT(*) as occurrence_count, 
  MIN(el.occurred_at) as first_seen, MAX(el.occurred_at) as latest_seen
FROM error_logs el
WHERE occurred_at >= NOW() - INTERVAL '7 days'
GROUP BY el.error_message
HAVING COUNT(*) >= 3
ORDER BY occurrence_count DESC;
```

---

## 4. Groq API Observability

### Problem
Groq API errors are only captured in:
- `/api/debug/groq` (debug endpoint only, not production traffic)
- Console logs in webhook
- No correlation: "Did Groq timeout cause this chat session to fail?"

### Opportunity
Track Groq API performance + failures + model version changes.

**New table:**
```sql
CREATE TABLE groq_api_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES simulation_sessions(id),
  model VARCHAR(255),        -- llama3-70b-8192, etc.
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  response_time_ms INT,
  status VARCHAR(50),        -- success, timeout, rate_limit, invalid_key, etc.
  error_message TEXT,
  attempt_number INT,        -- retry attempt
  temperature NUMERIC(3,2),
  called_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_groq_session (session_id),
  INDEX idx_groq_called (called_at DESC),
  INDEX idx_groq_status (status)
);

-- Alert threshold: if failure_rate > 5% in last hour
SELECT 
  COUNT(CASE WHEN status = 'success' THEN 1 END)::numeric / 
  COUNT(*)::numeric as success_rate
FROM groq_api_calls
WHERE called_at >= NOW() - INTERVAL '1 hour';
```

**Value:**
- Detect Groq API degradation (response time spike)
- Link failed simulations to Groq failures
- Track model performance (new model = latency spike?)
- Alert when rate limits approached

---

## 5. Telnyx Webhook Observability

### Problem
Telnyx webhooks are processed via `waitUntil()` with errors silently logged.

**Risk:**
- Webhook events are dropped if handler times out (no retry)
- Error correlation: "Why did 3 phone sessions fail simultaneously?"
- No alerting: Critical call failures go unnoticed

### Opportunity
Track webhook events + correlate with bug reports.

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50),      -- telnyx, stripe, etc.
  event_type VARCHAR(255),   -- call.answered, call.speak.ended, etc.
  session_id UUID REFERENCES simulation_sessions(id),
  payload JSONB,
  status VARCHAR(50),        -- received, processing, completed, failed
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_webhook_provider (provider),
  INDEX idx_webhook_session (session_id),
  INDEX idx_webhook_status (status)
);

-- Alert: if webhook processing fails > 2x for same event type in 1 hour
SELECT event_type, COUNT(*) as failure_count, NOW() - MIN(received_at) as duration
FROM webhook_events
WHERE status = 'failed'
  AND received_at >= NOW() - INTERVAL '1 hour'
GROUP BY event_type
HAVING COUNT(*) > 2;
```

---

## 6. Stripe Payment Observability

### Problem
Payment bugs (failed transactions, webhook misses, refund failures) are discovered days after occurrence.

### Opportunity
```sql
CREATE TABLE stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id VARCHAR(255) UNIQUE,
  event_type VARCHAR(255),   -- payment_intent.succeeded, charge.failed, etc.
  session_id UUID REFERENCES simulation_sessions(id),
  amount INT,                -- cents
  status VARCHAR(50),        -- success, failed, pending
  error_code VARCHAR(255),
  payload JSONB,
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Detect payment failures
SELECT event_type, COUNT(*) as failure_count, SUM(amount) as total_amount_failed
FROM stripe_events
WHERE status = 'failed'
  AND received_at >= NOW() - INTERVAL '24 hours'
GROUP BY event_type;
```

---

## 7. Automate Bug-to-Fix Workflow via Git

### Problem
Bug repair workflow is currently manual:
1. Dev triages the issue
2. Dev creates fix branch manually
3. Dev creates PR manually
4. Validation tests are manual setup

### Opportunity
Auto-create PR + branch + validation template when bug is assigned.

```ts
// workers/src/handlers/bugs.ts
export async function autoCreateFixBranch(bugId: string, bugReport: BugReport) {
  // 1. Create branch: git checkout -b fix/category-timestamp-summary
  // 2. Generate validation SQL template based on bug_patterns + error_stack
  // 3. Create PR with:
  //    - Title: "[BUG-{id}] {bugReport.title}"
  //    - Body: Error stack + reproduction steps + validation SQL template
  //    - Labels: [bug, regression] (if is_regression=true)
  //    - Milestone: Sprint N
  // 4. Link to bug_reports.fix_branch + fix_pr_url
  
  const octokit = new Octokit({auth: githubToken});
  
  // Create branch
  const newBranch = `fix/bug-${bugId}-${Date.now()}`;
  await octokit.git.createRef({
    owner, repo,
    ref: `refs/heads/${newBranch}`,
    sha: current_commit_sha
  });
  
  // Create PR
  const pr = await octokit.pulls.create({
    owner, repo,
    head: newBranch,
    base: 'main',
    title: `[BUG-${bugId}] ${bugReport.title}`,
    body: generatePRBody(bugReport),
    draft: true  // Wait for dev to mark ready
  });
  
  // Update bug record
  await sql`UPDATE bug_reports SET fix_branch = ${newBranch}, fix_pr_url = ${pr.html_url} WHERE id = ${bugId}`;
}
```

---

## 8. Dashboard: Unified System Health

### Problem
No single view of system health—must check multiple places:
- Console logs (errors)
- Vitest output (test failures)
- Deployments (CI/CD status)
- Analytics (score trends)
- Bug system (severity distribution)

### Opportunity
Create `/admin/system-health` dashboard that aggregates all signals.

**Sections:**
1. **Right Now** — Last 1 hour
   - Error rate (errors/100 requests)
   - Groq API status (latency p50/p99)
   - Webhook success rate (Telnyx, Stripe)
   - Bug count (critical open)

2. **Trend (7 days)**
   - Error count + trend
   - Session completion rate
   - Average bug fix time
   - Regression count

3. **Alerts**
   - Critical bugs (open > 4 hours)
   - Error spike (> 5% in last 30 min)
   - Groq rate limit approaching
   - Failed webhooks (> 2 on same type)

4. **Performance**
   - Endpoint response times (p50, p99)
   - Database query slow log
   - Which scenarios have bugs

---

## Summary: Integration Roadmap

| Integration | Current State | Ideal State | Impact | Est. Effort |
|---|---|---|---|---|
| Session linkage | Bug isolated | Bug linked to session | Know which scenarios break | 1–2 days |
| Analytics dashboard | Score-only | Score + bugs + errors + trends | End-to-end visibility | 2–3 days |
| Error logging | Console.log | Structured DB table + middleware | Historical record, alerts | 3–4 days |
| Groq observability | Debug endpoint | Full tracking table + alerts | Detect API degradation | 1 day |
| Telnyx observability | Logs only | Tracking table + correlation | Know which calls fail | 1 day |
| Stripe observability | Webhook silent | Full tracking + alerts | Know payment issues immediately | 1–2 days |
| Auto fix workflow | Manual PR | Auto-generate branch + PR + tests | Faster fix deployment | 2–3 days |
| System health dashboard | Multiple views | Single unified dashboard | At-a-glance status | 1–2 days |

**Total: 12–18 days** to fully integrate all systems into cohesive observability stack.

---

## Priority Ranking

**Must Do (Week 1):**
1. Session integration (enables correlation)
2. Error logging infrastructure (foundation for everything)
3. Analytics dashboard add bugs section

**Should Do (Week 2):**
4. Groq observability
5. System health dashboard
6. Auto fix workflow

**Nice to Have (Week 3+):**
7. Telnyx observability
8. Stripe observability
9. Sentry integration (optional)

