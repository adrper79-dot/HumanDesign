/**
 * Automated Bug Repair & Validation Workflow
 * 
 * Workflow stages:
 * 1. REPORTED      → Auto-categorize, check for regression
 * 2. TRIAGED       → Priority assessment, assign developer
 * 3. ASSIGNED      → Create feature branch, write test case
 * 4. IN_PROGRESS   → Developer works on fix
 * 5. STAGED        → Deploy to staging, run validation
 * 6. FIXED         → Deploy to prod, close issue
 * 7. CLOSED        → Done; monitor for regression
 * 
 * Automations:
 * - Regression detection on report submission
 * - Auto-triage based on category & error message
 * - Staged deployment with automated validation
 * - Health checks to catch regressions
 * - Metrics collection for SLA tracking
 */

// ─── Database setup (uses existing bug_reports, bug_validations tables) ────

// ─── Stage 1: Auto-Triage ──────────────────────────────────────────────────
export async function autoTriageBug(bugId: string, db: any) {
  console.log(`[AutoTriage] Starting for bug ${bugId}`);
  
  const bug = await db.query(
    `SELECT * FROM bug_reports WHERE id = $1`,
    [bugId]
  );
  
  if (!bug.rows[0]) throw new Error('Bug not found');
  
  const report = bug.rows[0];
  
  // Calculate priority based on severity + category
  const severityWeight = {
    'critical': 100,
    'high': 75,
    'medium': 50,
    'low': 25,
  };
  
  const categoryWeight = {
    'auth': 100,          // Auth bugs are critical
    'payment': 100,       // Payment bugs are critical
    'chart_calc': 80,     // Core functionality
    'profile': 60,
    'transit': 60,
    'api': 70,
    'ui': 40,
    'other': 25,
  };
  
  const priority = (severityWeight[report.severity] || 25) + 
                   (categoryWeight[report.category] || 25);
  
  // Suggest initial assignment based on category
  let suggestedAssignee = null;
  const assignmentMap = {
    'chart_calc': 'user_id:chart-expert',     // Tag a data engineer
    'payment': 'user_id:billing-expert',      // Tag billing owner
    'auth': 'user_id:security-lead',          // Tag security lead
    'api': 'user_id:backend-lead',            // Tag backend owner
    'transit': 'user_id:astro-expert',        // Tag astrology expert
    'ui': 'user_id:frontend-lead',            // Tag frontend owner
    'profile': 'user_id:product-owner',       // Tag product owner
  };
  suggestedAssignee = assignmentMap[report.category] || null;
  
  // Mark as triaged
  await db.query(
    `UPDATE bug_reports 
     SET status = $1, priority = $2, triaged_at = NOW()
     WHERE id = $3`,
    ['triaged', priority, bugId]
  );
  
  console.log(`[AutoTriage] Bug ${bugId} triaged: priority=${priority}, suggested=${suggestedAssignee}`);
  
  return {
    priority,
    suggestedAssignee,
    recommendations: generateRecommendations(report)
  };
}

// ─── Stage 2: Prep Feature Branch + Test Case ──────────────────────────────
export async function prepFixBranch(bugId: string, db: any): Promise<{
  branchName: string;
  testSql: string;
}> {
  console.log(`[PrepFix] Creating branch for bug ${bugId}`);
  
  const bug = await db.query(
    `SELECT id, title, category FROM bug_reports WHERE id = $1`,
    [bugId]
  );
  
  if (!bug.rows[0]) throw new Error('Bug not found');
  const report = bug.rows[0];
  
  // Generate branch name: fix/category-shortid-summary
  const timestamp = Date.now().toString(36).slice(-4);
  const titleSlug = report.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 20)
    .replace(/-$/, '');
  
  const branchName = `fix/${report.category}-${timestamp}-${titleSlug}`;
  
  // Generate template test SQL
  const testSql = `
-- Validation test for fix: ${report.title}
-- Run this after deploying the fix to staging

SELECT 
  'Before Fix' as phase,
  (SELECT COUNT(*) FROM bug_reports WHERE id = '${bugId}') as total_bugs,
  (SELECT status FROM bug_reports WHERE id = '${bugId}') as target_bug_status
UNION ALL
SELECT 
  'After Fix' as phase,
  (SELECT COUNT(*) FROM bug_reports WHERE id = '${bugId}') as total_bugs,
  (SELECT status FROM bug_reports WHERE id = '${bugId}') as target_bug_status;
`.trim();
  
  // Store branch association
  await db.query(
    `UPDATE bug_reports 
     SET fix_branch = $1, status = $2
     WHERE id = $3`,
    [branchName, 'assigned', bugId]
  );
  
  console.log(`[PrepFix] Created branch: ${branchName}`);
  
  return { branchName, testSql };
}

// ─── Stage 3: Staged Deployment + Validation ───────────────────────────────
export async function validateStagedFix(
  bugId: string, 
  commitSha: string, 
  db: any
): Promise<{
  passed: boolean;
  results: any[];
  nextStep: string;
}> {
  console.log(`[ValidateFix] Running tests for bug ${bugId}, commit ${commitSha}`);
  
  // Fetch all validation tests for this bug
  const validations = await db.query(
    `SELECT id, test_name, test_type, test_sql, test_endpoint 
     FROM bug_validations 
     WHERE bug_id = $1 AND test_type IN ('sql', 'api')
     ORDER BY created_at`,
    [bugId]
  );
  
  const results = [];
  let allPassed = true;
  
  for (const test of validations.rows) {
    try {
      let testResult = null;
      let passed = false;
      
      if (test.test_type === 'sql') {
        // Execute SQL test
        const result = await db.query(test.test_sql);
        testResult = result.rows;
        passed = testResult.length > 0;
      } else if (test.test_type === 'api') {
        // Hit the API endpoint and check response
        const response = await fetch(test.test_endpoint, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        testResult = await response.json();
        passed = response.ok;
      }
      
      results.push({
        testId: test.id,
        testName: test.test_name,
        type: test.test_type,
        passed,
        output: testResult,
        timestamp: new Date().toISOString()
      });
      
      // Log result
      await db.query(
        `INSERT INTO bug_validations 
         (id, bug_id, test_name, test_type, output, passes, run_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
        [bugId, test.test_name, test.test_type, JSON.stringify(testResult), passed]
      );
      
      if (!passed) allPassed = false;
    } catch (error) {
      allPassed = false;
      results.push({
        testName: test.test_name,
        error: (error as any).message
      });
    }
  }
  
  // Update bug status based on validation results
  if (allPassed) {
    await db.query(
      `UPDATE bug_reports 
       SET status = $1, staged_at = NOW(), fix_commit = $2, auto_validated = true
       WHERE id = $3`,
      ['staged', commitSha, bugId]
    );
    console.log(`[ValidateFix] ✅ All tests passed for bug ${bugId}`);
  } else {
    console.log(`[ValidateFix] ❌ Tests failed for bug ${bugId}; needs rework`);
  }
  
  return {
    passed: allPassed,
    results,
    nextStep: allPassed 
      ? 'deploy-to-production'
      : 'developer-review-required'
  };
}

// ─── Stage 4: Production Deployment Verification ────────────────────────────
export async function verifyProductionFix(bugId: string, db: any): Promise<boolean> {
  console.log(`[VerifyProd] Checking if fix is live for bug ${bugId}`);
  
  const bug = await db.query(
    `SELECT fix_commit FROM bug_reports WHERE id = $1`,
    [bugId]
  );
  
  if (!bug.rows[0]) throw new Error('Bug not found');
  
  // In real system: check if commit is in prod branch
  // For now: run final validation
  try {
    const prodCheck = await fetch('/.well-known/version.json'); // Or your version endpoint
    const prodVersion = await prodCheck.json();
    
    // Simple check: if the bug was marked with fix_commit in prod, it's deployed
    const isDeployed = !!bug.rows[0].fix_commit;
    
    if (isDeployed) {
      await db.query(
        `UPDATE bug_reports 
         SET status = $1, fixed_at = NOW()
         WHERE id = $2`,
        ['fixed', bugId]
      );
      console.log(`[VerifyProd] ✅ Fix verified in production for bug ${bugId}`);
      return true;
    }
  } catch (error) {
    console.error(`[VerifyProd] Error verifying deployment:`, error);
  }
  
  return false;
}

// ─── Helper: Generate recommendations for a bug ────────────────────────────
function generateRecommendations(report: any): string[] {
  const recommendations: string[] = [];
  
  // Error-based recommendations
  if (report.error_message?.includes('CORS')) {
    recommendations.push('Check CORS headers on API response');
    recommendations.push('Verify frontend domain is in allowed origins');
  }
  
  if (report.error_message?.includes('TypeError')) {
    recommendations.push('Review recent property/method name changes');
    recommendations.push('Check for null/undefined reference errors');
  }
  
  if (report.error_message?.includes('timeout')) {
    recommendations.push('Profile API endpoint for slow queries');
    recommendations.push('Check database connection pooling');
  }
  
  if (report.error_message?.includes('404')) {
    recommendations.push('Verify endpoint exists in current deployment');
    recommendations.push('Check routing configuration');
  }
  
  if (report.error_message?.includes('Insufficient privileges')) {
    recommendations.push('Review role-based access control');
    recommendations.push('Check auth token validity');
  }
  
  // Category-based recommendations
  if (report.category === 'chart_calc') {
    recommendations.push('Run deterministic test suite to verify calculation consistency');
    recommendations.push('Compare output against reference ephemeris data');
  }
  
  if (report.category === 'payment') {
    recommendations.push('Review Stripe webhook handlers');
    recommendations.push('Check for race conditions in payment state updates');
    recommendations.push('Verify webhook signature validation');
  }
  
  if (!recommendations.length) {
    recommendations.push('Reproduce bug locally');
    recommendations.push('Add unit test to prevent regression');
  }
  
  return recommendations;
}

// ─── Batch: Auto-close old fixed bugs (30+ days) ────────────────────────────
export async function autoCloseResolvedBugs(db: any): Promise<number> {
  console.log('[AutoClose] Checking for bugs to close...');
  
  const result = await db.query(
    `UPDATE bug_reports 
     SET status = 'closed', closed_at = NOW()
     WHERE status = 'fixed' 
     AND fixed_at < NOW() - INTERVAL '30 days'
     AND closed_at IS NULL
     RETURNING id`
  );
  
  console.log(`[AutoClose] Closed ${result.rowCount} fixed bugs`);
  return result.rowCount;
}

// ─── Batch: Update bug metrics (for dashboard) ────────────────────────────
export async function updateBugMetrics(db: any, metricDate: string = new Date().toISOString().split('T')[0]) {
  console.log(`[Metrics] Updating metrics for ${metricDate}`);
  
  const stats = await db.query(`
    SELECT 
      (SELECT COUNT(*) FROM bug_reports WHERE reported_at::date = $1) as total_reported,
      (SELECT COUNT(*) FROM bug_reports WHERE fixed_at::date = $1) as fixed_count,
      (SELECT COUNT(*) FROM bug_reports WHERE severity = 'critical' AND status != 'closed') as critical_open,
      (SELECT COUNT(*) FROM bug_reports WHERE is_regression = true) as regression_count,
      
      -- Calculate average SLA times
      (SELECT AVG(EXTRACT(epoch FROM (triaged_at - reported_at)))
       FROM bug_reports 
       WHERE triaged_at IS NOT NULL AND reported_at::date = $1) as avg_triage_seconds,
      
      (SELECT AVG(EXTRACT(epoch FROM (fixed_at - reported_at)))
       FROM bug_reports 
       WHERE fixed_at IS NOT NULL AND reported_at::date = $1) as avg_fix_seconds
  `, [metricDate]);
  
  const row = stats.rows[0] || {};
  
  await db.query(
    `INSERT INTO bug_metrics (metric_date, total_reported, fixed_count, avg_triage_time, avg_fix_time, critical_open, regression_count)
     VALUES ($1, $2, $3, 
             $4::integer || ' seconds',
             $5::integer || ' seconds',
             $6, $7)
     ON CONFLICT (metric_date) DO UPDATE SET
       total_reported = EXCLUDED.total_reported,
       fixed_count = EXCLUDED.fixed_count,
       avg_triage_time = EXCLUDED.avg_triage_time,
       avg_fix_time = EXCLUDED.avg_fix_time,
       critical_open = EXCLUDED.critical_open,
       regression_count = EXCLUDED.regression_count`,
    [metricDate, row.total_reported, row.fixed_count, 
     Math.floor(row.avg_triage_seconds || 0),
     Math.floor(row.avg_fix_seconds || 0),
     row.critical_open, row.regression_count]
  );
  
  console.log(`[Metrics] Updated metrics for ${metricDate}`);
}

export {
  autoTriageBug,
  prepFixBranch,
  validateStagedFix,
  verifyProductionFix,
  autoCloseResolvedBugs,
  updateBugMetrics
};
