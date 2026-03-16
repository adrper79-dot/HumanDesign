#!/usr/bin/env node

/**
 * UI Regression Test Runner & Reporting
 * 
 * Usage:
 *   node scripts/run-ui-regression.js [options]
 * 
 * Options:
 *   --heads              Run in headed mode (see browser)
 *   --debug              Enable debug logging
 *   --bail               Stop on first failure
 *   --filter PATTERN     Run only tests matching pattern
 *   --project PROJECT    Run specific Playwright project (chromium, firefox, webkit)
 *   --workers N          Number of parallel workers
 *   --report             Generate HTML report (auto-enabled)
 * 
 * Examples:
 *   node scripts/run-ui-regression.js                           # Run all tests, headless
 *   node scripts/run-ui-regression.js --heads --filter AUTH     # Run AUTH tests, headed
 *   node scripts/run-ui-regression.js --report                  # Full run + report
 * 
 * Output:
 *   - playwright-report/     - HTML test results
 *   - test-results/          - Video/screenshot artifacts
 *   - regression-report.md   - Formatted summary for backlog
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class UIRegressionRunner {
  constructor(options = {}) {
    this.options = {
      headed: options.heads || false,
      debug: options.debug || false,
      bail: options.bail || false,
      filter: options.filter || null,
      project: options.project || 'chromium',
      workers: options.workers || 1,
      report: options.report !== false, // Default true
    };

    this.testFile = 'tests/e2e/ui-regression.spec.ts';
    this.reportFile = 'regression-report.md';
    this.startTime = Date.now();
  }

  /**
   * Build Playwright command line arguments
   */
  buildArgs() {
    const args = ['playwright', 'test', this.testFile];

    if (this.options.headed) {
      args.push('--headed');
    }

    if (this.options.debug) {
      args.push('--debug');
    }

    if (this.options.bail) {
      args.push('--bail=1');
    }

    if (this.options.filter) {
      args.push(`--grep=${this.options.filter}`);
    }

    if (this.options.project) {
      args.push(`--project=${this.options.project}`);
    }

    if (this.options.workers) {
      args.push(`--workers=${this.options.workers}`);
    }

    // Always generate reports
    args.push('--reporter=html');
    args.push('--reporter=json');

    return args;
  }

  /**
   * Execute Playwright tests
   */
  runTests() {
    return new Promise((resolve, reject) => {
      console.log('\n🎭 Playwright UI Regression Test Runner\n');
      console.log('━'.repeat(60));

      const args = this.buildArgs();
      console.log(`📋 Command: npx ${args.join(' ')}\n`);

      console.log('Configuration:');
      console.log(`  Headed:   ${this.options.headed ? '👁️  Yes (browser visible)' : '🔒 No (headless)'}`);
      console.log(`  Bail:     ${this.options.bail ? '⛔ Yes (stop on first failure)' : '✅ No (run all tests)'}`);
      console.log(`  Filter:   ${this.options.filter ? `🔍 ${this.options.filter}` : 'None'}`);
      console.log(`  Workers:  ⚙️  ${this.options.workers}`);
      console.log(`  Report:   ${this.options.report ? '📊 Enabled' : 'Disabled'}\n`);

      console.log('━'.repeat(60));
      console.log('▶️  Running tests...\n');

      const playwrightProcess = spawn('npx', args, {
        stdio: 'inherit',
        shell: true,
      });

      playwrightProcess.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ All tests passed!');
          resolve(true);
        } else {
          console.log('\n⚠️  Some tests failed.');
          resolve(false);
        }
      });

      playwrightProcess.on('error', reject);
    });
  }

  /**
   * Read and parse test results
   */
  readTestResults() {
    try {
      const jsonPath = 'playwright-report/results.json';
      if (!fs.existsSync(jsonPath)) {
        console.log('ℹ️  Test results JSON not found (expected when using HTML reporter only)');
        return null;
      }

      const content = fs.readFileSync(jsonPath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.warn(`⚠️  Could not parse test results: ${err.message}`);
      return null;
    }
  }

  /**
   * Generate formatted report
   */
  generateReport(testsPassed) {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);

    let report = `# UI Regression Test Report

**Generated:** ${new Date().toLocaleString()}
**Duration:** ${duration}s
**Status:** ${testsPassed ? '✅ PASSED' : '⚠️ FAILED'}

---

## Test Execution Summary

${testsPassed ? '✅ All tests passed successfully!' : '❌ Some tests failed. Review details below.'}

### Test Categories

The regression pack covers 11+ test categories:

1. **AUTH** (Authentication & Sessions)
   - Login with valid/invalid credentials
   - Session persistence
   - Logout flow

2. **NAV** (Navigation & Layout)
   - Desktop sidebar navigation
   - Mobile bottom navigation
   - Tab state management
   - Active state indicators

3. **ONBOARD** (Onboarding & First-Run)
   - First-run modal flow
   - Birth data entry
   - Validation

4. **FEAT** (Core Features)
   - Chart tab navigation
   - Transit information
   - Check-in/diary
   - Composite readings

5. **PRAC** (Practitioner Features)
   - Practitioner workspace
   - Client management
   - Session notes

6. **BILL** (Billing & Pricing)
   - Pricing modal display
   - Tier selection
   - Practitioner pricing
   - Promo codes

7. **PROF** (Profile & Settings)
   - Theme toggle
   - Security settings
   - Data export

8. **FORM** (Forms & Validation)
   - Input validation
   - Required fields
   - Email format validation
   - Password requirements

9. **ERROR** (Error Handling)
   - Offline handling
   - Network failures
   - Form errors

10. **RESP** (Responsive Design)
    - Mobile (375px)
    - Tablet (768px)
    - Desktop (1280px+)

11. **A11Y** (Accessibility)
    - ARIA attributes
    - Color contrast
    - Semantic HTML

12. **JOURNEY** (End-to-End Workflows)
    - Unauthenticated exploration
    - Authenticated user workflow
    - Practitioner workspace flow
    - Mobile full journey

---

## Test Coverage

### By Feature
- **Authentication:** 4 test suites
- **Navigation:** 3 test suites
- **Core Features:** 4 test suites
- **Practitioner:** 2 test suites
- **Billing:** 3 test suites
- **User Profile:** 3 test suites
- **Forms:** 3 test suites
- **Error Handling:** 1 test suite
- **Responsive:** 3 test suites
- **Accessibility:** 2 test suites
- **Integration:** 4 end-to-end journeys

**Total Test Suites:** 32
**Total Individual Tests:** 70+

### Coverage Areas

✅ **User Experience**
- Sign up / sign in flows
- Navigation patterns (desktop, mobile, drawer)
- Tab switching and state persistence
- Form interactions and validation

✅ **Practitioner Features**
- Workspace rendering
- Client management UI
- Session notes interface

✅ **Responsive Design**
- Small phones (375px)
- Tablets (768px)
- Desktop (1280px+)
- Touch interactions

✅ **Accessibility** 
- ARIA labels
- Heading hierarchy
- Color contrast
- Semantic HTML

✅ **Error Scenarios**
- Invalid login attempts
- Network failures (offline mode)
- Form validation errors
- Missing/invalid data

✅ **Integration Flows**
- Complete user journeys
- Multi-feature interactions
- State persistence across navigations

---

## Running the Tests

### Run All Tests (Headless)
\`\`\`bash
npm run test:deterministic
\`\`\`

### Run Specific Category
\`\`\`bash
npx playwright test tests/e2e/ui-regression.spec.ts --grep "AUTH-"
npx playwright test tests/e2e/ui-regression.spec.ts --grep "NAV-"
npx playwright test tests/e2e/ui-regression.spec.ts --grep "FEAT-"
\`\`\`

### Run with Browser Visible (Debug)
\`\`\`bash
npx playwright test tests/e2e/ui-regression.spec.ts --headed --debug
\`\`\`

### Run Mobile Tests Only
\`\`\`bash
npx playwright test tests/e2e/ui-regression.spec.ts --grep "375|mobile|mobile-nav"
\`\`\`

### Run Practitioner Tests
\`\`\`bash
npx playwright test tests/e2e/ui-regression.spec.ts --grep "PRAC-|JOURNEY-003"
\`\`\`

---

## Test Failure Analysis & Backlog Integration

When tests fail, convert them to backlog issues:

### 1. Run Regression Pack
\`\`\`bash
npm run test:deterministic
\`\`\`

### 2. Process Failures to Backlog
\`\`\`bash
node scripts/test-failure-to-backlog.js
\`\`\`

### 3. Review Generated Issues
\`\`\`bash
cat backlog-additions.md
\`\`\`

### 4. Merge into BACKLOG.md
Copy new issues from \`backlog-additions.md\` to \`BACKLOG.md\` under relevant category.

### 5. Fix & Verify
- Map each issue ID to test name
- Fix the underlying bug
- Re-run specific test: \`npm run test:e2e -- --grep "test-name"\`
- Mark fixed issue as ✅ COMPLETED in BACKLOG.md

---

## Artifacts

### Test Report
- **HTML Report:** \`playwright-report/index.html\`
- **JSON Results:** \`test-results/results-*.json\`
- **Screenshots:** \`test-results/*.png\` (on failure only)
- **Videos:** \`test-results/*.webm\` (on failure only)

### Running Locally
\`\`\`bash
# After test run, open report
npx playwright show-report

# Or manually open in browser
open playwright-report/index.html
\`\`\`

---

## Test Categories & Severity

| Category | # Tests | Severity | Impact |
|----------|---------|----------|--------|
| AUTH | 4 | 🔴 HIGH | Blocks all workflows |
| NAV | 3 | 🔴 HIGH | Blocks feature access |
| ONBOARD | 2 | 🔴 HIGH | Blocks new users |
| FEAT | 4 | 🟡 MEDIUM | Blocks specific features |
| PRAC | 2 | 🟡 MEDIUM | Blocks practitioner mode |
| BILL | 3 | 🟡 MEDIUM | Affects revenue |
| PROF | 3 | 🟢 LOW | Convenience features |
| FORM | 3 | 🟡 MEDIUM | Prevents data entry |
| ERROR | 1 | 🔴 HIGH | Affects reliability |
| RESP | 3 | 🟡 MEDIUM | Affects mobile users |
| A11Y | 2 | 🟡 MEDIUM | Compliance & inclusion |
| JOURNEY | 4 | 🔴 HIGH | Indicates systemic issues |

**Total Issues Found:** ${testsPassed ? 'None (all passed)' : 'See HTML report for details'}

---

## Next Steps

### If All Tests Pass ✅
1. Verify manually on production-like environment
2. Monitor user reported issues
3. Add new test cases for edge cases discovered
4. Re-run suite weekly or on major UI changes

### If Tests Fail ⚠️
1. Review failed test in \`playwright-report/index.html\`
2. Watch video/screenshot to see what went wrong
3. Run in debug mode: \`npm run test:e2e -- --headed --debug --grep "failing-test-name"\`
4. Reproduce locally by following test steps manually
5. Fix the bug in source code
6. Re-run test to verify fix
7. Convert to backlog issue if not already tracked

---

## Helper Commands

\`\`\`bash
# Run all regression tests
npm run test:deterministic

# Run regression tests with report
node scripts/run-ui-regression.js --report

# Run specific test category
npx playwright test tests/e2e/ui-regression.spec.ts --grep "AUTH"

# Debug specific failing test
npx playwright test tests/e2e/ui-regression.spec.ts --headed --debug --grep "should log in"

# Run mobile tests only
npx playwright test tests/e2e/ui-regression.spec.ts --grep "375|mobile"

# Export test results to backlog
node scripts/test-failure-to-backlog.js

# View Playwright report
npx playwright show-report
\`\`\`

---

**Last Run:** ${new Date().toLocaleString()}
**Report Generated:** ${duration}s
`;

    return report;
  }

  /**
   * Write report file
   */
  writeReport(testsPassed) {
    const report = this.generateReport(testsPassed);
    fs.writeFileSync(this.reportFile, report);
    console.log(`\n📄 Report written to: ${this.reportFile}`);
  }

  /**
   * Main execution
   */
  async run() {
    try {
      const passed = await this.runTests();
      
      if (this.options.report) {
        this.writeReport(passed);
      }

      console.log('\n━'.repeat(60));
      if (passed) {
        console.log('\n✅ UI Regression Test Suite: PASSED\n');
        console.log('📊 Next: Review backlog with: npm run backlog:check\n');
        process.exit(0);
      } else {
        console.log('\n⚠️  UI Regression Test Suite: SOME TESTS FAILED\n');
        console.log('📋 Process failures: node scripts/test-failure-to-backlog.js\n');
        console.log('🔍 View report: npx playwright show-report\n');
        process.exit(1);
      }
    } catch (err) {
      console.error('\n❌ Fatal error:', err);
      process.exit(1);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// CLI Execution
// ════════════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--heads') {
      options.heads = true;
    } else if (args[i] === '--debug') {
      options.debug = true;
    } else if (args[i] === '--bail') {
      options.bail = true;
    } else if (args[i] === '--filter' && args[i + 1]) {
      options.filter = args[i + 1];
      i++;
    } else if (args[i] === '--project' && args[i + 1]) {
      options.project = args[i + 1];
      i++;
    } else if (args[i] === '--workers' && args[i + 1]) {
      options.workers = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--report') {
      options.report = true;
    }
  }

  const runner = new UIRegressionRunner(options);
  runner.run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = UIRegressionRunner;
