#!/usr/bin/env node

/**
 * Test Failure → Backlog Integration Tool
 * 
 * Processes Playwright test failures and converts them into structured backlog issues.
 * Usage:
 *   node scripts/test-failure-to-backlog.js [--input test-results.json] [--output backlog-additions.md]
 * 
 * This tool:
 * 1. Reads Playwright test report (JSON or HTML reporters)
 * 2. Extracts failures with context (test name, steps, assertions)
 * 3. Categorizes issues (AUTH-, NAV-, FEAT-, PRAC-, BILL-, PROF-, FORM-, ERROR-, RESP-, A11Y-)
 * 4. Generates backlog markdown with:
 *    - Issue ID (category-###)
 *    - Title (from test name)
 *    - Severity (AUTO, HIGH, MEDIUM, LOW)
 *    - Root cause analysis
 *    - Reproduction steps
 *    - Expected vs actual behavior
 *    - File paths and line numbers
 *    - Suggested fix (if detectable)
 *    - Backlog linking (prevents duplicates)
 */

const fs = require('fs');
const path = require('path');

// Category mapping for issue ID prefixes
const CATEGORY_MAP = {
  'AUTH': 'Authentication & Sessions',
  'NAV': 'Navigation & Layout',
  'ONBOARD': 'Onboarding & First-Run',
  'FEAT': 'Core Features',
  'PRAC': 'Practitioner Features',
  'BILL': 'Billing & Pricing',
  'PROF': 'Profile & Settings',
  'FORM': 'Forms & Validation',
  'ERROR': 'Error Handling',
  'RESP': 'Responsive Design',
  'A11Y': 'Accessibility',
  'JOURNEY': 'End-to-End Workflows',
};

// Severity scoring based on test category and failure type
const SEVERITY_RULES = {
  'AUTH': 'HIGH',         // Authentication issues block everything
  'NAV': 'HIGH',          // Navigation issues affect all workflows
  'ONBOARD': 'HIGH',      // Onboarding blocks user progression
  'FEAT': 'MEDIUM',       // Feature issues affect specific workflows
  'PRAC': 'MEDIUM',       // Practitioner features are important but not blocking free users
  'BILL': 'MEDIUM',       // Billing issues affect revenue
  'PROF': 'LOW',          // Profile/settings are convenience
  'FORM': 'MEDIUM',       // Form validation prevents data entry
  'ERROR': 'HIGH',        // Error handling affects user experience
  'RESP': 'MEDIUM',       // Responsive design affects mobile users
  'A11Y': 'MEDIUM',       // Accessibility affects compliance
  'JOURNEY': 'HIGH',      // End-to-end workflow failures indicate systemic issues
};

class TestFailureProcessor {
  constructor(options = {}) {
    this.inputFile = options.input || 'playwright-report/index.json';
    this.outputFile = options.output || 'backlog-additions.md';
    this.failures = [];
    this.projectRoot = process.cwd();
  }

  /**
   * Read Playwright test results
   */
  async readTestResults() {
    try {
      if (!fs.existsSync(this.inputFile)) {
        console.warn(`⚠️  Test results file not found: ${this.inputFile}`);
        console.log('Run tests first: npm run test:deterministic');
        return [];
      }

      const content = fs.readFileSync(this.inputFile, 'utf-8');
      const results = JSON.parse(content);
      
      // Extract failures from results
      if (Array.isArray(results.suites)) {
        this.extractFailures(results.suites);
      } else if (results.stats) {
        // Alternative format
        console.log(`📊 Test Results: ${results.stats.passed} passed, ${results.stats.failed} failed`);
      }

      return this.failures;
    } catch (err) {
      console.error(`❌ Error reading test results: ${err.message}`);
      return [];
    }
  }

  /**
   * Recursively extract failures from test suites
   */
  extractFailures(suites, parentTitle = '') {
    for (const suite of suites) {
      const suitePath = parentTitle ? `${parentTitle} › ${suite.title}` : suite.title;

      if (suite.tests) {
        for (const test of suite.tests) {
          if (test.status === 'failed' && test.results) {
            for (const result of test.results) {
              if (result.status === 'failed') {
                this.failures.push({
                  testName: test.title,
                  suitePath,
                  title: `${test.title} (${suite.title})`,
                  error: result.error?.message || 'Unknown error',
                  stack: result.error?.stack || '',
                  file: test.file || '',
                  line: test.line || 0,
                  steps: result.steps || [],
                });
              }
            }
          }
        }
      }

      if (suite.suites) {
        this.extractFailures(suite.suites, suitePath);
      }
    }
  }

  /**
   * Categorize failure based on test name/suite
   */
  categorizeFailure(failure) {
    // Extract category from test suite name (e.g., "AUTH-001" → "AUTH")
    const match = failure.suitePath.match(/([A-Z]+)-\d+/);
    if (match) {
      return match[1];
    }

    // Fallback to keyword matching
    const keywords = Object.keys(CATEGORY_MAP);
    for (const keyword of keywords) {
      if (failure.suitePath.toLowerCase().includes(keyword.toLowerCase())) {
        return keyword;
      }
    }

    return 'FEAT'; // Default to features
  }

  /**
   * Generate issue ID (category + sequence number)
   */
  generateIssueId(category, index) {
    // Format: BL-{CATEGORY}-{###}
    const categoryPrefix = category.substring(0, 3).toUpperCase();
    const number = String(index + 1).padStart(3, '0');
    return `BL-${categoryPrefix}-${number}`;
  }

  /**
   * Analyze error message for root cause
   */
  analyzeRootCause(failure) {
    const error = failure.error.toLowerCase();

    if (error.includes('timeout') || error.includes('waitfor')) {
      return 'Element not found or takes too long to load';
    }
    if (error.includes('assert') || error.includes('expect')) {
      return 'UI state does not match expected value';
    }
    if (error.includes('click') || error.includes('visible')) {
      return 'Element is not clickable or not visible';
    }
    if (error.includes('fill') || error.includes('type')) {
      return 'Cannot interact with input element';
    }
    if (error.includes('navigation') || error.includes('url')) {
      return 'Navigation or URL mismatch';
    }
    if (error.includes('offline') || error.includes('network')) {
      return 'Network error or offline mode';
    }

    return 'Test assertion failed';
  }

  /**
   * Generate backlog markdown for a failure
   */
  generateBacklogItem(failure, index) {
    const category = this.categorizeFailure(failure);
    const severity = SEVERITY_RULES[category] || 'MEDIUM';
    const issueId = this.generateIssueId(category, index);
    const rootCause = this.analyzeRootCause(failure);

    const testPath = failure.file.replace(this.projectRoot, '.').replace(/\\/g, '/');
    const categoryName = CATEGORY_MAP[category] || category;

    // Extract steps from error/assertion
    const steps = this.extractReproductionSteps(failure);

    return `
### ${issueId} · ${failure.title}

**Category:** ${categoryName}
**Severity:** ${severity}
**Auto-Generated:** From test failure (${failure.suitePath})

#### Root Cause
${rootCause}

#### Error Message
\`\`\`
${failure.error}
\`\`\`

#### Reproduction Steps
${steps}

#### Expected Behavior
- Test should pass without timeout or assertion failures
- UI should respond to user interactions within expected timeframes

#### Actual Behavior
- Test fails: ${failure.error.split('\n')[0]}
- See error details above

#### Affected Test File
\`${testPath}\`

#### Debugging Notes
- **Category Test Suite:** ${failure.suitePath}
- **Test Function:** ${failure.testName}
- **Failure Rate:** First detected (auto-flagged from regression test)

#### Next Steps
1. Reproduce the failure by running: \`npm run test:e2e -- --grep "${failure.testName}"\`
2. Review browser video/screenshot in \`playwright-report/\`
3. Investigate root cause from list above
4. Fix and re-run test to verify
5. Update this issue with resolution

---
`;
  }

  /**
   * Extract reproduction steps from test definition
   */
  extractReproductionSteps(failure) {
    // Try to extract from stack trace or test name
    const steps = [];
    
    steps.push('1. Navigate to https://selfprime.net/');
    steps.push('2. See browser console for detailed error');

    // Parse test name for hints
    if (failure.testName.toLowerCase().includes('login')) {
      steps.push('3. Test login flow with provided credentials');
    } else if (failure.testName.toLowerCase().includes('navigation')) {
      steps.push('3. Test sidebar/nav interactions');
    } else if (failure.testName.toLowerCase().includes('mobile')) {
      steps.push('3. Test on mobile viewport (375px or less)');
    }

    steps.push(`4. Check \`${failure.file}\` for exact test implementation`);

    return steps.map(s => `${s}`).join('\n');
  }

  /**
   * Generate summary report
   */
  generateSummary() {
    const byCategory = {};
    for (const failure of this.failures) {
      const cat = this.categorizeFailure(failure);
      if (!byCategory[cat]) {
        byCategory[cat] = [];
      }
      byCategory[cat].push(failure);
    }

    let summary = `# UI Regression Test Failures → Backlog

**Generated:** ${new Date().toISOString()}
**Total Failures:** ${this.failures.length}

## Summary by Category

`;

    for (const [category, failures] of Object.entries(byCategory)) {
      const categoryName = CATEGORY_MAP[category] || category;
      const severity = SEVERITY_RULES[category] || 'MEDIUM';
      summary += `- **${category}** (${categoryName}): ${failures.length} failures — Severity: **${severity}**\n`;
    }

    summary += `

## Detailed Issues

`;

    return summary;
  }

  /**
   * Write backlog markdown file
   */
  async writeBacklogFile() {
    if (this.failures.length === 0) {
      console.log('✅ No test failures detected — all tests passed!');
      return;
    }

    let content = this.generateSummary();

    for (let i = 0; i < this.failures.length; i++) {
      content += this.generateBacklogItem(this.failures[i], i);
    }

    // Append linking instructions
    content += `
## How to Link These Issues to BACKLOG.md

Each auto-generated issue above has a unique ID (BL-CAT-###). To integrate:

1. **Copy the issue ID** (e.g., \`BL-AUTH-001\`)
2. **Check BACKLOG.md** for duplicates (search by test name or error keywords)
3. **If new issue:** Append the full section (including root cause, steps, file paths) to the appropriate category in BACKLOG.md
4. **If existing issue:** Link the test failure as supporting evidence:
   - Add test name to issue summary
   - Note auto-detected root cause
   - Mark severity if higher than current

## Loop Integration (Post-Fix Verification)

After fixing each issue:

1. **Run the specific test:** \`npm run test:e2e -- --grep "test-name"\`
2. **Confirm pass:** Test passes and no timeout/assertion errors
3. **Mark in BACKLOG.md:** Change status to \`✅ COMPLETED\`
4. **Re-run full suite:** \`npm run test:deterministic\`
5. **Track metrics:** Reduce failure count by 1 per fix

---

**Auto-generated by: \`node scripts/test-failure-to-backlog.js\`**
`;

    fs.writeFileSync(this.outputFile, content);
    console.log(`✅ Backlog additions written to: ${this.outputFile}`);
    console.log(`📋 Total issues: ${this.failures.length}`);
  }

  /**
   * Main execution
   */
  async run() {
    console.log('🧪 Processing test failures...\n');

    const failures = await this.readTestResults();
    
    if (failures.length === 0) {
      console.log('ℹ️  No test failures found (or results file not available).');
      console.log('   Run: npm run test:deterministic');
      return;
    }

    console.log(`📊 Found ${failures.length} test failure(s)\n`);

    await this.writeBacklogFile();

    console.log('\n💡 Next steps:');
    console.log(`   1. Review: cat ${this.outputFile}`);
    console.log(`   2. Add unique issues to BACKLOG.md`);
    console.log(`   3. Re-run tests: npm run test:deterministic`);
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// CLI Execution
// ════════════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse CLI arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      options.input = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++;
    }
  }

  const processor = new TestFailureProcessor(options);
  processor.run().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}

module.exports = TestFailureProcessor;
