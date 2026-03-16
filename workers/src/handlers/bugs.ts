/**
 * Bug Reporting API Routes
 * 
 * POST   /api/bugs                  — Submit a bug report
 * GET    /api/bugs                  — List bugs (admin/dev only)
 * GET    /api/bugs/[id]             — Get bug details
 * PUT    /api/bugs/[id]             — Update bug status/assignment
 * POST   /api/bugs/[id]/comments    — Add diagnostic comment
 * POST   /api/bugs/[id]/validate    — Run validation tests
 * GET    /api/bugs/metrics          — Bug metrics & trends (admin)
 */

export interface BugReportInput {
  // Core report
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'chart_calc' | 'profile' | 'auth' | 'payment' | 'transit' | 'ui' | 'api' | 'other';
  
  // Reproduction
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  
  // Reporter (if not logged in)
  reporterEmail?: string;
  reporterName?: string;
  
  // Auto-captured
  userAgent?: string;
  browser?: string;
  osName?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  pageUrl?: string;
  affectedSection?: string;
  errorMessage?: string;
  errorStack?: string;
  consoleLogs?: any[];
  networkLogs?: any[];
  
  // Context
  sessionId?: string;
  chartId?: string;
  screenshotUrl?: string;
}

export interface BugReport {
  id: string;
  title: string;
  severity: string;
  status: string;
  category: string;
  reportedAt: string;
  userId?: string;
  email?: string;
  assignedTo?: string;
  rootCause?: string;
  fixCommit?: string;
  triageNotes?: string;
  closedAt?: string;
}

// ─── Helper: Auto-detect regression patterns ────────────────────────────────
async function checkForRegression(report: BugReportInput, db: any): Promise<string | null> {
  const patterns = await db.query(`
    SELECT id, name, regex_description, solution 
    FROM bug_patterns 
    WHERE 
      regex_error IS NOT NULL AND
      (description ~* $1 OR title ~* $2)
    LIMIT 1
  `, [report.errorMessage || '', report.description || '']);
  
  if (patterns.rows.length > 0) {
    const pattern = patterns.rows[0];
    console.log(`[BugReport] Detected regression: ${pattern.name}`);
    return pattern.id;
  }
  return null;
}

// ─── Helper: Redact sensitive data from logs ────────────────────────────────
function redactSensitiveData(obj: any): any {
  if (!obj) return obj;
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'stripe', 'auth', 'ssn'];
  
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        return '[REDACTED]';
      }
      return value;
    })
  );
}

// ─── Helper: Extract user context (redacted) ──────────────────────────────────
async function getUserContext(userId: string, db: any): Promise<any> {
  const user = await db.query(`
    SELECT id, tier, created_at, has_chart, is_premium
    FROM (
      SELECT 
        u.id,
        s.tier,
        u.created_at,
        (COUNT(c.id) > 0) as has_chart,
        (s.tier != 'free') as is_premium
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      LEFT JOIN charts c ON u.id = c.user_id
      WHERE u.id = $1
      GROUP BY u.id, s.tier, u.created_at
    ) sub
  `, [userId]);
  
  return user.rows[0] || null;
}

// ─── Helper: Capture environment & session data ────────────────────────────
function normalizeInput(input: BugReportInput): BugReportInput {
  return {
    ...input,
    consoleLogs: (input.consoleLogs || []).slice(-10),    // Last 10 logs
    networkLogs: (input.networkLogs || []).slice(-5),      // Last 5 calls
    errorStack: input.errorStack ? input.errorStack.substring(0, 2000) : undefined,  // Truncate
  };
}

export { 
  checkForRegression, 
  redactSensitiveData,
  getUserContext,
  normalizeInput
};
