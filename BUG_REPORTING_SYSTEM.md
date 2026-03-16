# Bug Reporting & Repair Automation System

Complete guide for implementing user bug reporting, triage automation, and staged deployment validation.

---

## Overview

Your users report bugs through a simple form → System auto-triages → Developer fixes → Validation runs automatically → Deploy to staging → Final validation → Merge to production.

**Key Benefits:**
- Users feel heard with direct reporting channel
- Bugs are prioritized automatically (severity + category)
- Regression detection catches repeated issues
- No manual test validation—database checks run automatically
- Clear SLA tracking (time to fix, time to triage)
- Regressions are monitored to prevent recurring bugs

---

## Architecture

### 1. Database Tables (in `050_bug_reporting.sql`)

**Core:**
- `bug_reports` — All bug reports with context, status, assignment
- `bug_comments` — Diagnostic discussion thread
- `bug_validations` — Automated tests to verify fix
- `bug_patterns` — Known issues & regression detection
- `bug_audit_log` — Immutable change history
- `bug_metrics` — SLA tracking & dashboards

**Key Fields:**
```sql
bug_reports:
  id, title, description, severity, category, status
  user_id, email, reporter_name
  browser, os, viewport_width, page_url
  error_message, error_stack, console_logs, network_logs
  assigned_to, root_cause, fix_commit, fix_branch
  reported_at, triaged_at, fixed_at, closed_at
  auto_validated, is_regression
```

### 2. Frontend (BugReportModal.tsx)

Simple form users can quickly fill out:
- Title, description, severity, category
- Steps to reproduce
- Expected vs actual behavior
- Auto-captures: browser, OS, viewport, URL, console logs, network errors
- Screenshot capture (optional)

**Placement:**
```tsx
// In navigation/header:
<button onClick={() => setShowBugReport(true)}>Report a Bug</button>

{showBugReport && (
  <BugReportModal onClose={() => setShowBugReport(false)} />
)}
```

### 3. API Routes (handlers/bugs.ts)

**Public endpoints:**
- `POST /api/bugs` — Submit a bug report (auto-triages)
- `GET /api/bugs/[id]` — View bug details

**Admin/Dev endpoints:**
- `GET /api/bugs` — List all bugs (with filters, sorting)
- `PUT /api/bugs/[id]` — Update status, assignment, fix info
- `POST /api/bugs/[id]/comments` — Add diagnostic comment
- `POST /api/bugs/[id]/validate` — Manually trigger validation
- `GET /api/bugs/metrics` — Dashboard: SLA metrics, trends

### 4. Workflow Engine (lib/bug-workflow.ts)

**Automated stages:**

```
Step 1: REPORTED (Immediate)
  └─ autoTriageBug()
     ├─ Calculate priority (severity + category)
     ├─ Suggest assignment (auth → security-lead, payment → billing-expert, etc.)
     ├─ Check for regression (error pattern matching)
     └─ Mark as 'triaged'

Step 2: ASSIGN (Developer)
  └─ Manual: dev reviews triage suggestion and assigns to themselves
  └─ Update status → 'assigned'

Step 3: PREP (Developer)
  └─ prepFixBranch()
     ├─ Generate branch name (fix/category-timestamp-summary)
     ├─ Generate template validation SQL
     └─ Create PR with [fixes #bug-id] in commit message

Step 4: FIX (Developer)
  └─ Implement fix locally
  └─ Run validation tests (manual during dev)
  └─ Commit to feature branch

Step 5: VALIDATE (Automated on Staging)
  └─ validateStagedFix()
     ├─ Fetch all validation tests for this bug
     ├─ Run SQL tests (data integrity)
     ├─ Run API tests (endpoints respond)
     ├─ Log all results
     ├─ If ALL pass → mark 'staged', ready for prod
     └─ If ANY fail → request developer review

Step 6: DEPLOY (Production)
  └─ Merge to main branch
  └─ GitHub Actions deploys to production
  └─ verifyProductionFix()
     ├─ Confirm commit is in prod
     ├─ Run final validation
     └─ Mark as 'fixed'

Step 7: CLOSE (30+ days)
  └─ autoCloseResolvedBugs()
     ├─ If bug hasn't regressed in 30 days
     └─ Mark as 'closed'

Step 8: MONITOR (Ongoing)
  └─ checkForRegression() on new bug reports
     ├─ If error pattern matches a closed bug
     ├─ Mark is_regression=true, set duplicate_of=[old bug id]
     └─ Alert original assignee
```

---

## Integration Steps

### 1. Create Migration

Run the migration to set up all tables:

```bash
# In HumanDesign project:
NEON_CONNECTION_STRING="..." node workers/run-migration.js
```

This creates:
- `bug_reports` table (primary)
- `bug_comments` (discussion thread)
- `bug_validations` (test tracking)
- `bug_patterns` (regression detection)
- `bug_audit_log` (audit trail)
- `bug_metrics` (SLA dashboard)

### 2. Add UI Button

Add "Report a Bug" button somewhere visible (navbar, footer, settings):

```tsx
'use client';

import BugReportModal from '@/components/BugReportModal';
import { useState } from 'react';

export default function NavigationBar() {
  const [showBugReport, setShowBugReport] = useState(false);

  return (
    <>
      {/* Navbar items... */}
      
      <button
        onClick={() => setShowBugReport(true)}
        className="text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
      >
        🐛 Report Bug
      </button>

      {showBugReport && (
        <BugReportModal onClose={() => setShowBugReport(false)} />
      )}
    </>
  );
}
```

### 3. API Routes

Create `/api/bugs/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { autoTriageBug, checkForRegression, redactSensitiveData } from '@/lib/bug-workflow';

export async function POST(request: Request) {
  const input = await request.json();
  
  // Validate required fields
  if (!input.title || !input.description || !input.severity || !input.category) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    // Check for regression
    const regressionId = await checkForRegression(input, sql);

    // Insert bug report
    const result = await sql`
      INSERT INTO bug_reports (
        title, description, severity, category,
        steps_to_reproduce, expected_behavior, actual_behavior,
        user_id, email, reporter_name,
        user_agent, browser, os_name, viewport_width, viewport_height,
        page_url, affected_section, error_message, error_stack,
        console_logs, network_logs, is_regression, duplicate_of,
        status
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22, $23,
        'reported'
      )
      RETURNING id, title, created_at
    `;

    const bugId = result.rows[0].id;

    // Auto-triage
    await autoTriageBug(bugId, sql);

    return NextResponse.json(
      { 
        id: bugId, 
        message: 'Bug report submitted successfully',
        isRegression: !!regressionId
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to submit bug:', error);
    return NextResponse.json({ error: 'Failed to submit bug report' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Admin only: list all bugs with filters
  // Query: /api/bugs?severity=critical&status=assigned&sortBy=priority
  
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status') || 'assigned,in_progress';
  
  const bugs = await sql`
    SELECT * FROM bug_reports 
    WHERE status = ANY(string_to_array($1, ','))
    ORDER BY priority DESC, reported_at DESC
    LIMIT 100
  `;

  return NextResponse.json(bugs.rows);
}
```

### 4. Admin Dashboard Page

Create `/admin/bugs/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function BugsAdminPage() {
  const [bugs, setBugs] = useState([]);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetch('/api/bugs?status=triaged,assigned,in_progress,staged')
      .then(r => r.json())
      .then(setBugs);

    fetch('/api/bugs/metrics')
      .then(r => r.json())
      .then(setMetrics);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Bug Reports</h1>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card label="Total Reported" value={metrics.total_reported} />
          <Card label="Fixed This Week" value={metrics.fixed_count} />
          <Card label="Critical Open" value={metrics.critical_open} color="red" />
          <Card label="Avg Fix Time" value={metrics.avg_fix_time} />
        </div>
      )}

      {/* Bug List */}
      <div className="bg-white rounded-lg border border-slate-200">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Title</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Severity</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Assigned</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Priority</th>
            </tr>
          </thead>
          <tbody>
            {bugs.map(bug => (
              <tr key={bug.id} className="border-b border-slate-200 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <a href={`/admin/bugs/${bug.id}`} className="text-blue-600 hover:underline">
                    {bug.title}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    bug.severity === 'critical' ? 'bg-red-100 text-red-800' :
                    bug.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                    bug.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {bug.severity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-600">{bug.status}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-600">{bug.assigned_to || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold">{bug.priority}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, color = 'slate' }) {
  return (
    <div className={`bg-${color}-50 border border-${color}-200 rounded-lg p-4`}>
      <div className={`text-sm text-${color}-700`}>{label}</div>
      <div className={`text-3xl font-bold text-${color}-900`}>{value}</div>
    </div>
  );
}
```

### 5. Setup Validation Tests

When a dev is fixing a bug, they should create at least one validation test:

```sql
-- Example: If user reports "chart shows wrong date", add this test:

INSERT INTO bug_validations (bug_id, test_name, test_type, test_sql)
VALUES (
  'bug-id-here',
  'Chart date calculation accuracy',
  'sql',
  'SELECT * FROM charts WHERE calculated_at > NOW() - INTERVAL 1 day ORDER BY calculated_at DESC LIMIT 5'
);
```

---

## Workflow Examples

### Example 1: Critical Payment Bug

**User Reports:**
- Title: "Stripe payment fails with 'declined' even though card is valid"
- Severity: CRITICAL
- Category: PAYMENT

**System Automatically:**
1. Triages (priority = 100+100 = 200, highest)
2. Suggests assignment to `billing-team-lead`
3. Creates branch: `fix/payment-a1b2-stripe-declined`
4. Sends alert: "⚠️ CRITICAL payment bug reported"

**Developer:**
1. Reviews triage suggestion, accepts assignment
2. Investigates Stripe webhook handler
3. Finds: webhook signature validation is missing
4. Creates test:
   ```sql
   INSERT INTO bug_validations (bug_id, test_name, test_type, test_endpoint)
   VALUES ($1, 'Stripe webhook security', 'api', '/api/webhooks/stripe');
   ```
5. Commits fix with `[fixes #bug-id]`

**Automated Staging Validation:**
1. New commit triggers deployment to staging
2. Runs all validation tests for this bug
3. API test hits `/api/webhooks/stripe` → must return 200
4. If passes → marks bug as `staged`, ready for production
5. If fails → requests developer review

**Production:**
1. Dev merges to main
2. CI/CD deploys to production
3. System marks bug as `fixed`
4. Alert: "Payment bug fixed in production ✅"

---

### Example 2: Regression Detection

**User Reports #2:**
- Title: "Chart date off by 2 hours"
- Error Message: contains "timezone calculation error"

**System Automatically:**
1. Checks `bug_patterns` table
2. Finds matching pattern: `is_regression = true` (previous bug #1: "Chart date off by 1 hour")
3. Links new bug to old bug: `duplicate_of = bug#1`
4. Alerts original dev: "⚠️ Your previous fix regressed: [link to new bug]"

This catches when a refactor introduces an old bug again.

---

## Monitoring & Alerts

### Daily Metrics Collection

```bash
# Run daily via cron:
node workers/scripts/update-bug-metrics.js

# Logs:
# [Metrics] Updated metrics for 2026-03-16
# totalReported=14, fixed=3, criticalOpen=2, avgFixTime=18.5h
```

### SLA Alerts

```typescript
const metrics = await fetch('/api/bugs/metrics').then(r => r.json());

if (metrics.critical_open > 0 && metrics.avgFixTime > 24 * 60 * 60) {
  // Alert: We're not meeting SLA on critical bugs
  sendSlackAlert({
    channel: '#engineering',
    text: `⚠️ ${metrics.critical_open} critical bugs, avg fix time ${metrics.avgFixTime}h`
  });
}
```

### Regression Monitor

```typescript
const regressions = await sql`
  SELECT count(*) FROM bug_reports 
  WHERE is_regression = true AND reported_at > NOW() - INTERVAL '7 days'
`;

if (regressions.rows[0].count > 3) {
  // Too many regressions — review recent deployments
  sendSlackAlert({ text: '🔄 High regression rate detected' });
}
```

---

## Best Practices

1. **Always add validation tests when fixing a bug**
   - SQL test: Verify data integrity before/after fix
   - API test: Verify endpoint responds correctly
   - Regression test: Prevent the same bug in future

2. **Use root cause in comments**
   ```
   Root cause: "Timezone conversion was using server time instead of user's birth_tz constant"
   ```

3. **Link related bugs**
   - If you fix a bug that caused another, mark `duplicate_of`
   - If you notice a pattern, add to `bug_patterns` table

4. **Monitor regressions**
   - If same error message reappears, auto-link to original
   - Alert original dev to prevent repeated fixes

5. **Close bugs after 30 days**
   - Auto-close after 30 days with no regression
   - Can re-open if regression detected

---

## Database Queries for Dashboards

**Open Bugs by Severity:**
```sql
SELECT severity, count(*) as count
FROM bug_reports
WHERE status != 'closed'
GROUP BY severity
ORDER BY count DESC;
```

**Average Time to Fix by Category:**
```sql
SELECT 
  category,
  AVG(EXTRACT(epoch FROM (fixed_at - reported_at)))/3600 as avg_hours
FROM bug_reports
WHERE fixed_at IS NOT NULL
GROUP BY category
ORDER BY avg_hours DESC;
```

**Regression Patterns:**
```sql
SELECT 
  pattern_name,
  occurrence_count,
  last_seen
FROM bug_patterns
WHERE occurrence_count > 2
ORDER BY occurrence_count DESC;
```

**Dev Assignment Load:**
```sql
SELECT 
  assigned_to,
  count(*) as open_bugs
FROM bug_reports
WHERE status IN ('assigned', 'in_progress')
GROUP BY assigned_to
ORDER BY open_bugs DESC;
```

---

## Summary

✅ **You now have:**
1. Database schema for bug tracking (050_bug_reporting.sql)
2. User-facing bug report form (BugReportModal.tsx)
3. API handlers for submission & management (handlers/bugs.ts)
4. Automated workflow engine (lib/bug-workflow.ts)
5. Admin dashboard (admin/bugs/page.tsx)
6. Regression detection & pattern matching
7. SLA metrics & monitoring

**Next Steps:**
1. Run migration to create tables
2. Add "Report a Bug" button to navigation
3. Create `/api/bugs` route handler
4. Create admin bug dashboard page
5. Set up daily metrics collection script
6. Configure Slack alerts for critical bugs
7. Train team on workflow: how to triage, validate, close bugs
