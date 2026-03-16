# UI Regression Testing Strategy & Continuous Improvement

## Overview

This document outlines the strategy for using the Playwright UI regression test pack to continuously validate and improve the Prime Self application. It covers:

1. **Test Execution** — When and how to run tests
2. **Backlog Integration** — Converting failures to actionable issues
3. **Iteration Loop** — Fix → Test → Verify → Close cycle
4. **Expansion** — Adding new tests for discovered issues
5. **Metrics** — Tracking quality over time

---

## 1. Test Execution Strategy

### Daily/Before Deployment
```bash
# Full regression suite (all 70+ tests)
npm run test:deterministic

# Time: 5-10 minutes
# Expected: All green
```

### Per-Feature During Development
```bash
# Focus on affected area
npm run test:e2e:auth        # When changing auth
npm run test:e2e:mobility     # When changing nav

# Or by test category
npx playwright test --grep "NAV-"     # Navigation
npx playwright test --grep "FEAT-"    # Features
npx playwright test --grep "PRAC-"    # Practitioner
```

### Debug a Failing Test
```bash
# Run with browser visible + debugger
npm run test:e2e:debug --grep "test-name"

# Or step through in browser
npx playwright test --headed --debug tests/e2e/ui-regression.spec.ts
```

### Mobile/Responsive Validation
```bash
# Test all mobile viewports
npm run test:e2e -- --grep "375|RESP"

# Or specific device
npx playwright test --grep "mobile|tablet"
```

---

## 2. Test Failure → Backlog Loop

### When Tests Fail

```
┌─────────────────────────────────────────┐
│  1. Run Regression Suite                │
│     npm run test:deterministic          │
├─────────────────────────────────────────┤
│  2. Some Tests Fail                     │
│     View: playwright-report/index.html  │
├─────────────────────────────────────────┤
│  3. Process Failures → Backlog          │
│     node scripts/test-failure-to-backlog.js
├─────────────────────────────────────────┤
│  4. Review Auto-Generated Issues        │
│     cat backlog-additions.md            │
├─────────────────────────────────────────┤
│  5. Merge New Issues to BACKLOG.md      │
│     Copy unique issues from additions   │
├─────────────────────────────────────────┤
│  6. Fix + Verify                        │
│     npm run test:e2e:debug              │
├─────────────────────────────────────────┤
│  7. Mark COMPLETED                      │
│     Update BACKLOG.md                   │
└─────────────────────────────────────────┘
```

### Auto-Generated Issue Format

```markdown
### BL-NAV-005 · Mobile drawer tabs lose active-nav context

**Category:** Navigation & Layout
**Severity:** HIGH
**Status:** Open
**Test Source:** NAV-003

#### Root Cause
Missing MOBILE_TAB_GROUPS mapping for drawer-only tabs

#### Reproduction Steps
1. Navigate to https://selfprime.net/
2. Login: adrper79@gmail.com / 123qweASD
3. Set viewport to mobile (375px)
4. Open drawer (hamburger button)
5. Tap "Diary" tab
6. Observe: Mobile bottom nav is empty (no active state)

#### Expected
Mobile nav shows which section user is in (at least one item highlighted)

#### Actual
All nav items gray/empty, no visual feedback about current location

#### File Affected
- `frontend/js/ui-nav.js` (MOBILE_TAB_GROUPS mapping)
- `frontend/index.html` (mobile nav markup)
- `frontend/js/app.js` (switchTab function)

#### Debug Notes
- Chart, profile, transits all work (have group mappings)
- Enhance, diary, practitioner, history all fail (no mappings)
- Bottom nav active state should sync with tab content

#### Suggested Fix
1. Add missing entries to MOBILE_TAB_GROUPS:
   ```javascript
   enhance: 'deepen',
   diary: 'deepen',
   practitioner: 'practitioner',
   // etc.
   ```
2. Test each drawer-only tab on mobile
3. Verify active state updates

#### Test to Verify Fix
- Run: `npm run test:e2e -- --grep "NAV-003"`
- Should pass without timeout/assertion errors
```

---

## 3. Fix & Verify Iteration

### Workflow: From Failure to Completion

#### Step 1: Understand the Test
```bash
# Read the test code
cat tests/e2e/ui-regression.spec.ts | grep -A 30 "NAV-003"

# Review test output
npx playwright show-report

# Watch video/screenshot of failure
open test-results/NAV-003-failure.webm
```

#### Step 2: Reproduce Locally
```bash
# Run test in debug mode
npx playwright test --headed --debug --grep "NAV-003"

# Or manually:
# 1. Open https://selfprime.net/ on 375px viewport
# 2. Login
# 3. Open drawer
# 4. Tap "diary" tab
# 5. Check mobile nav for active state
```

#### Step 3: Identify Root Cause
```bash
# Check current code
cat frontend/js/ui-nav.js | grep MOBILE_TAB_GROUPS

# Output:
# const MOBILE_TAB_GROUPS = {
#   overview: 'home',
#   chart: 'blueprint',
#   // ... missing 'diary', 'enhance', etc.
# };
```

#### Step 4: Implement Fix
```bash
# Edit source file
vim frontend/js/ui-nav.js

# Make changes:
# - Add 'diary: "deepen"'
# - Add 'enhance: "deepen"'
# - Add 'practitioner: "practitioner"'
# - Test locally
```

#### Step 5: Verify Fix (Re-run Test)
```bash
# Run specific test in headless mode
npm run test:e2e -- --grep "NAV-003"

# Expected output:
# ✅ NAV-003 should not lose nav orientation...

# If still fails, repeat steps 2-4
# If passes, proceed to step 6
```

#### Step 6: Run Full Regression Suite
```bash
# Make sure no side effects
npm run test:deterministic

# Expected: All tests pass
# If new failures, debug before proceeding
```

#### Step 7: Mark Completed in Backlog
```bash
# Edit BACKLOG.md
# Find the issue entry (BL-NAV-005)
# Change status to ✅ COMPLETED
# Add date and commit reference

# Example:
# ✅ BL-NAV-005 · Mobile drawer tabs lose active-nav context
#    Fixed: 2026-03-16 | Commit: c7d3e9f | PR: #123
```

---

## 4. Expanding Test Coverage

### When to Add New Tests

Add tests when:
1. A new feature is launched
2. A user reports a bug (prevent regression)
3. An edge case is discovered
4. A platform needs validation (new viewport)

### Adding a Test

#### Example: "Check-in submission"

```typescript
test.describe('FEAT-005: Check-In Submission', () => {
  test('should save check-in entry successfully', async ({ page }) => {
    await bypassFirstRun(page);
    await page.goto('https://selfprime.net/');
    await dismissAnyDialog(page);

    // Login
    await login(page, 'adrper79@gmail.com', '123qweASD');

    // Navigate to check-in
    await navigateToTab(page, 'checkin');

    // Find form
    const textarea = page.locator('textarea[placeholder*="check"]');
    const submitBtn = page.locator('button:has-text(/submit|save/i)');

    // Fill and submit
    await textarea.fill('Today felt aligned with my design');
    await submitBtn.click();

    // Verify success (toast, redirect, etc.)
    await page.waitForLoadState('networkidle');
    const successMsg = page.locator('text=/saved|submitted/i');
    await expect(successMsg).toBeVisible({ timeout: 3000 });
  });
});
```

#### Checklist Before Committing

- [ ] Test has descriptive name starting with "should"
- [ ] Test includes setup (bypassFirstRun, login)
- [ ] Test includes action (user interaction)
- [ ] Test includes assertion (expect)
- [ ] Test is deterministic (always passes/fails consistently)
- [ ] Test works headless (CI-friendly)
- [ ] Test works on mobile viewport (if applicable)
- [ ] Test uses existing helper functions
- [ ] Test has clear timeout values
- [ ] Test cleans up any side effects

---

## 5. Metrics & Quality Tracking

### Track These Metrics

#### Test Pass Rate
```bash
# After each run, calculate:
# Pass Rate = Passed / (Passed + Failed)

# Good: >95% (only known issues failing)
# Acceptable: 80-95% (some regressions being fixed)
# Poor: <80% (systemic issues, pause deployment)
```

#### Category Performance
```
Category      Passed  Failed  Pass Rate
─────────────────────────────────────
AUTH          4       0       100% ✅
NAV           3       0       100% ✅
ONBOARD       2       0       100% ✅
FEAT          4       1       75%  ⚠️  (FEAT-003 check-in)
PRAC          2       0       100% ✅
BILL          3       0       100% ✅
PROF          3       0       100% ✅
FORM          3       0       100% ✅
ERROR         1       0       100% ✅
RESP          3       1       67%  ⚠️  (RESP-001 375px)
A11Y          2       0       100% ✅
JOURNEY       4       0       100% ✅
─────────────────────────────────────
TOTAL         34      2       94%  ✅
```

#### Issue Resolution Rate
```bash
# Weekly report
Total Issues Created (tests failed):     5
Issues Fixed:                            3
Issues in Progress:                      2
Resolution Time (average):               2 days
Target: 100% within 3 days

Trend: ↗️ Improving (last week: 1 fixed)
```

#### Coverage by Feature
```
Feature       Tests  Coverage  Status
─────────────────────────────────
Auth          4      ✅ 100%   Mature
Navigation    3      ✅ 100%   Mature
Core          4      ⚠️  75%   Growing
Practitioner  2      ⚠️  50%   Emerging
Mobile        6      ✅ 100%   Comprehensive
```

### Monthly Health Report

```markdown
# March 2026 - UI Test Health Report

## Executive Summary
- **Overall Pass Rate:** 94% (68/72 tests)
- **Critical Failures:** 0
- **High Severity Issues:** 2
- **Issues Resolved:** 5
- **Deployment Status:** ✅ Ready

## Trend Analysis
- Last Month (Feb): 88% pass rate
- This Month (Mar): 94% pass rate
- **Improvement:** +6% (fixing backlog issues)

## Category Health
- AUTH: ✅ 100% (no regression)
- NAV: ✅ 100% (stable)
- FEAT: ⚠️ 78% (1 check-in issue)
- PRAC: ✅ 100% (new suite added)
- RESP: ⚠️ 67% (mobile viewport needs work)

## Action Items
1. [ ] Fix FEAT-003 check-in submission (owned by @dev1)
2. [ ] Investigate RESP-001 mobile font sizing (owned by @dev2)
3. [ ] Add E2E tests for practitioner invitations
4. [ ] Update accessibility tests for new modal

## Metrics
- Average Issue Resolution: 1.5 days (target: <3 days)
- Test Execution Time: 8 minutes (target: <10 minutes)
- Coverage: 70+ tests across 11 categories
- Regression Prevention: 5 issues caught before production

## Recommendation
**Ready for deployment.** All HIGH severity issues resolved.
Monitor new practitioner features closely.
```

---

## 6. Continuous Deployment (CD) Integration

### Pre-Deployment Checklist

```bash
#!/bin/bash
# Before deploying to production:

echo "🧪 Running UI regression tests..."
npm run test:deterministic

if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Cannot deploy."
  echo "Process failures: node scripts/test-failure-to-backlog.js"
  exit 1
fi

echo "✅ All tests passed."
echo "🚀 Proceeding with deployment..."

# Deploy
npm run build && npm run deploy
```

### CI/CD Pipeline (GitHub Actions)

```yaml
name: UI Regression Tests

on:
  pull_request:
    paths:
      - 'frontend/**'
      - 'tests/e2e/**'
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npx playwright install --with-deps
      
      - name: Run UI Regression Tests
        run: npm run test:deterministic
      
      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
      
      - name: Process Failures
        if: failure()
        run: node scripts/test-failure-to-backlog.js
      
      - name: Comment on PR
        if: failure()
        run: |
          cat backlog-additions.md >> $GITHUB_STEP_SUMMARY
```

---

## 7. Test Maintenance

### Weekly
```bash
# Run full suite
npm run test:deterministic

# Review results
npx playwright show-report

# Fix any flaky tests
# Update test selectors if UI changed
```

### Monthly
```bash
# Generate health report (see template above)
# Update test documentation
# Review and consolidate duplicate tests
# Plan new tests for upcoming features
```

### Quarterly
```bash
# Audit test coverage against features
# Identify gaps (untested features)
# Plan expansion (new categories)
# Review tool versions (Playwright, Node)
# Benchmark performance (execution time)
```

---

## 8. Common Patterns

### Testing a Form
```typescript
test('should submit form successfully', async ({ page }) => {
  // Navigate to form
  await navigateToTab(page, 'checkin');
  
  // Fill fields
  const input = page.locator('input[name="field"]');
  await input.fill('value');
  
  // Submit
  const submitBtn = page.locator('button:has-text(/submit/i)');
  await submitBtn.click();
  
  // Verify result
  await expect(page.locator('text=/saved|success/i')).toBeVisible();
  
  // Optional: verify network request
  const response = await page.waitForResponse(r => 
    r.url().includes('/api/submit')
  );
  expect(response.status()).toBe(200);
});
```

### Testing Mobile Navigation
```typescript
test('should navigate on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  
  // Open drawer
  const hamburger = page.locator('#hamburgerBtn');
  await hamburger.click();
  
  // Tap nav item
  const navItem = page.locator('[data-tab="chart"]');
  await navItem.click();
  
  // Verify navigation
  await expect(navItem).toHaveClass(/active/);
});
```

### Testing Error Handling
```typescript
test('should show error message', async ({ page }) => {
  await page.context().setOffline(true);
  
  // Try action
  await page.click('button[type="submit"]');
  
  // Verify error shown
  await expect(page.locator('[role="alert"]')).toContainText(/error|failed/i);
  
  await page.context().setOffline(false);
});
```

---

## 9. Resources

### Documentation
- [tests/e2e/UI_REGRESSION_README.md](./UI_REGRESSION_README.md) — Full reference
- [Playwright Documentation](https://playwright.dev) — Official docs
- [BACKLOG.md](../../BACKLOG.md) — Known issues and tracking

### Scripts
- `npm run test:deterministic` — Run all tests
- `npm run test:e2e:debug` — Debug mode
- `node scripts/test-failure-to-backlog.js` — Process failures

### Artifacts
- `playwright-report/index.html` — HTML report
- `test-results/` — Screenshots, videos, traces
- `backlog-additions.md` — Auto-generated issues

---

## 10. FAQ

### Q: Test runs slow, how to speed up?
**A:** Run with more workers: `npx playwright test --workers=4`

### Q: Test is flaky (passes sometimes)
**A:** Add explicit waits: `await page.waitForLoadState('networkidle')`

### Q: How to skip a test temporarily?
**A:** Change `test(` to `test.skip(` or `test.todo(`

### Q: Can I run tests on real device?
**A:** Playwright doesn't support devices directly, but `@browser/mobile` port exists

### Q: How to debug a timeout?
**A:** Run with `--debug` flag and use Playwright Inspector

### Q: When should I increase timeout?
**A:** Only if the action genuinely takes time (slow network). Otherwise, fix the underlying issue.

---

**Version:** 1.0  
**Last Updated:** 2026-03-16  
**Maintained By:** QA / Dev Team  
**Next Review:** 2026-04-16
