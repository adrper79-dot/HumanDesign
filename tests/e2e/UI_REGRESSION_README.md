# UI Regression Test Pack — Playwright

Comprehensive end-to-end UI testing suite for HumanDesign / Prime Self. Tests cover user and practitioner experience across 11 feature categories with 70+ individual test cases.

## 📋 Overview

This test pack is designed to:
1. **Catch regressions** early before they reach production
2. **Validate workflows** across desktop, tablet, and mobile
3. **Measure coverage** across authentication, navigation, features, and accessibility
4. **Generate backlog** items automatically from test failures
5. **Enable rapid iteration** by providing quick feedback loops

## 🚀 Quick Start

### Install & Run
```bash
# Install dependencies (if not already done)
npm install

# Run all UI regression tests
npm run test:deterministic

# Or run with custom options
node scripts/run-ui-regression.js --heads --filter AUTH
```

### View Results
```bash
# Open HTML report in browser
npx playwright show-report

# Or manually open
open playwright-report/index.html  # macOS
explorer playwright-report/index.html  # Windows
```

## 📊 Test Structure

### Test File
- **Location:** `tests/e2e/ui-regression.spec.ts`
- **Size:** 1,100+ lines of test code
- **Format:** Playwright Test (TypeScript)
- **Execution:** Headless (CI-friendly), or headed (debug)

### Test Categories (11 Total)

| Category | Tests | File | Purpose |
|----------|-------|------|---------|
| **AUTH** | 4 | ui-regression.spec.ts | Login, logout, session, persistence |
| **NAV** | 3 | ui-regression.spec.ts | Sidebar, mobile nav, tab state |
| **ONBOARD** | 2 | ui-regression.spec.ts | First-run, birth data entry |
| **FEAT** | 4 | ui-regression.spec.ts | Chart, transits, check-in, composite |
| **PRAC** | 2 | ui-regression.spec.ts | Practitioner workspace, notes |
| **BILL** | 3 | ui-regression.spec.ts | Pricing, tier selection |
| **PROF** | 3 | ui-regression.spec.ts | Settings, theme, security |
| **FORM** | 3 | ui-regression.spec.ts | Validation, required fields |
| **ERROR** | 1 | ui-regression.spec.ts | Offline, network errors |
| **RESP** | 3 | ui-regression.spec.ts | Mobile, tablet, desktop viewports |
| **A11Y** | 2 | ui-regression.spec.ts | ARIA, contrast, semantics |
| **JOURNEY** | 4 | ui-regression.spec.ts | End-to-end workflows |

**Total: 32 test suites, 70+ individual tests**

## 🎯 Test Descriptions

### 1. AUTH (Authentication)

Tests sign-in, session management, and logout flows.

```typescript
test.describe('AUTH-001: Login Flow', () => {
  test('should log in with valid credentials', async ({ page }) => {
    // Pre-seed localStorage to bypass welcome modal
    // Login with credentials
    // Verify logged-in state
  });

  test('should show error on invalid email', async ({ page }) => {
    // Attempt login with non-existent email
    // Verify error message appears
  });

  test('should require email and password fields', async ({ page }) => {
    // Verify form validation enforces required fields
  });
});
```

**Covered:** Email/password validation, session tokens, tier badge display, logout state

### 2. NAV (Navigation)

Tests sidebar, mobile bottom nav, and tab switching.

```typescript
test.describe('NAV-002: Mobile Bottom Navigation', () => {
  test('should display bottom nav on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // Verify mobile nav elements
  });

  test('should navigate to tabs from mobile nav', async ({ page }) => {
    // Tap nav item and verify active state
  });

  test('should open drawer on hamburger menu', async ({ page }) => {
    // Test drawer open/close on mobile
  });
});
```

**Covered:** Desktop sidebar collapse/expand, mobile drawer, bottom nav items, active state indicators

### 3. FEAT (Core Features)

Tests main feature tabs: chart, transits, check-in, composite.

```typescript
test.describe('FEAT-001: Chart Tab Navigation', () => {
  test('should load and display chart tab content', async ({ page }) => {
    await navigateToTab(page, 'chart');
    // Verify chart-related elements appear
  });

  test('should display chart profile information', async ({ page }) => {
    // Verify profile type, authority, etc.
  });
});
```

**Covered:** Feature loading, data rendering, form interactions, modal dialogs

### 4. PRAC (Practitioner)

Tests practitioner workspace, client management, and notes.

```typescript
test.describe('PRAC-001: Practitioner Tab & Workspace', () => {
  test('should navigate to practitioner tab', async ({ page }) => {
    await navigateToTab(page, 'practitioner');
    // Verify workspace rendering
  });

  test('should display client list or workspace', async ({ page }) => {
    // Verify client cards or empty state
  });
});
```

**Covered:** Workspace UI, client list, session notes interface

### 5. RESP (Responsive Design)

Tests layouts across mobile (375px), tablet (768px), and desktop (1280px+).

```typescript
test.describe('RESP-001: Mobile Viewport (375px)', () => {
  test('should display correctly on small phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // Verify header, nav, and content are accessible
  });
});
```

**Covered:** Viewport-specific layout, touch interactions, font sizing, spacing

## 🔄 Test Execution Flow

### Single Test Run
```
1. Navigate to base URL
2. Pre-seed localStorage (bypass first-run modal)
3. Dismiss any auto-open dialogs
4. Execute test steps (login, navigation, interactions)
5. Assert expected UI state changes
6. Capture screenshot/video on failure
7. Report result
```

### Full Suite Run
```
Total Time: ~5-10 minutes (70+ tests, parallel)

Progress:
  Auth Suite ····· (4 tests)
  Nav Suite ····· (3 tests)
  Feat Suite ····· (4 tests)
  Prac Suite ····· (2 tests)
  ... (32 suites total)

Result:
  ✅ 70 passed
  Or: ⚠️ 2 failed, 68 passed
```

## 📝 Helper Functions

The test pack includes shared helpers for common operations:

### bypassFirstRun()
Pre-seeds localStorage to skip welcome modal.
```typescript
await bypassFirstRun(page);
```

### login()
Signs in with email/password.
```typescript
await login(page, 'adrper79@gmail.com', '123qweASD');
```

### navigateToTab()
Clicks a sidebar/nav item and waits for content.
```typescript
await navigateToTab(page, 'chart');
```

### dismissAnyDialog()
Closes any visible modal/dialog.
```typescript
await dismissAnyDialog(page, 3000);
```

### openMobileSidebar() / closeMobileSidebar()
Opens/closes mobile drawer.
```typescript
await openMobileSidebar(page);
await closeMobileSidebar(page);
```

## 🎯 Usage Examples

### Run All Tests
```bash
npm run test:deterministic
```

### Run Specific Test Suite
```bash
# All AUTH tests
npx playwright test tests/e2e/ui-regression.spec.ts --grep "AUTH"

# All NAV tests
npx playwright test tests/e2e/ui-regression.spec.ts --grep "NAV"

# All mobile tests
npx playwright test tests/e2e/ui-regression.spec.ts --grep "375|mobile"
```

### Run Single Test
```bash
npx playwright test tests/e2e/ui-regression.spec.ts --grep "should log in with valid"
```

### Debug Mode (Browser Visible)
```bash
npx playwright test tests/e2e/ui-regression.spec.ts --headed --debug --grep "AUTH-001"
```

### Parallel Execution
```bash
# Default (auto-detected workers)
npx playwright test tests/e2e/ui-regression.spec.ts

# 4 parallel workers
npx playwright test tests/e2e/ui-regression.spec.ts --workers=4

# Sequential (for debugging)
npx playwright test tests/e2e/ui-regression.spec.ts --workers=1
```

### Filter by Viewport
```bash
# Mobile only
npx playwright test tests/e2e/ui-regression.spec.ts --grep "375"

# Desktop only
npx playwright test tests/e2e/ui-regression.spec.ts --grep "1280"

# Journey/integration tests
npx playwright test tests/e2e/ui-regression.spec.ts --grep "JOURNEY"
```

## 🔗 Test → Backlog Integration

When tests fail, convert them to backlog issues automatically:

### Step 1: Run Tests
```bash
npm run test:deterministic
```

### Step 2: Process Failures
```bash
node scripts/test-failure-to-backlog.js
```

This generates `backlog-additions.md` with:
- Issue ID (BL-CAT-###)
- Test name and category
- Root cause analysis
- Reproduction steps
- Error details
- Affected file paths
- Suggested fixes

### Step 3: Review Issues
```bash
cat backlog-additions.md
```

### Step 4: Merge into BACKLOG.md
Copy new/unique issues from `backlog-additions.md` into `BACKLOG.md` under relevant category.

### Step 5: Fix & Verify
1. Implement fix in source code
2. Re-run specific test: `npx playwright test --grep "test-name"`
3. Mark issue as ✅ COMPLETED in BACKLOG.md

---

### Example Flow

**Test Fails:**
```
FAIL  NAV-003: Mobile drawer tabs lose active-nav context
  Expected: Mobile nav shows active state for drawer-only tabs
  Actual: All nav items gray/empty when viewing 'diary' tab
```

**Generate Backlog:**
```bash
node scripts/test-failure-to-backlog.js
```

**Output Created:**
```markdown
### BL-NAV-003 · Mobile drawer tabs lose active-nav context

Category: Navigation & Layout
Severity: HIGH
Root Cause: Missing MOBILE_TAB_GROUPS mapping for drawer-only tabs

Reproduction Steps:
1. Navigate to https://selfprime.net/
2. Login with valid credentials
3. Set viewport to mobile (375px)
4. Open drawer via hamburger menu
5. Tap "Diary" tab
6. Observe: Mobile bottom nav shows no active state

Expected: At least one nav item highlighted (active state visible)
Actual: All nav items gray, no visual feedback

File: frontend/js/ui-nav.js
Lines: 40-50 (MOBILE_TAB_GROUPS object)
```

**Fix & Close:**
```bash
# Edit source
vim frontend/js/ui-nav.js

# Test fix
npx playwright test --grep "NAV-003"

# If passes, mark COMPLETED in BACKLOG.md
```

## 📊 Report Generation

### HTML Report
```bash
# Auto-generated after each test run
npx playwright show-report

# Screenshots and videos on failure
# Located in: test-results/
```

### Markdown Summary Report
```bash
node scripts/run-ui-regression.js --report
# Generates: regression-report.md
```

## 🛠️ Configuration

### playwright.config.ts

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,  // Retry twice in CI
  workers: process.env.CI ? 1 : undefined,  // 1 worker in CI, auto elsewhere
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'https://selfprime.net',
    trace: 'on-first-retry',  // Capture trace on retry
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'], 
        viewport: { width: 1280, height: 720 } 
      },
    },
  ],
});
```

## 🔍 Debugging

### Enable Debug Output
```bash
npx playwright test --debug
```

### View Trace Files
```bash
npx playwright show-trace test-results/trace.zip
```

### Check Screenshots
```bash
open test-results/screenshot.png
```

### Review Videos
```bash
open test-results/video.webm
```

### Run with Logging
```bash
DEBUG=pw:api npx playwright test tests/e2e/ui-regression.spec.ts --grep "AUTH"
```

## 📈 Metrics & Analytics

### Track Over Time
```bash
# Run weekly and compare results
npm run test:deterministic > results-week-$(date +%Y-%m-%d).txt

# Compare
diff results-week-*.txt
```

### Generate Coverage Report
Coverage is tracked by test category (see table above).

To add a new test:
1. Identify feature/workflow
2. Create test in appropriate `describe()` block
3. Add to category count in docs
4. Run: `npm run test:deterministic`

## ⚙️ NPM Scripts

Add these to `package.json`:

```json
{
  "scripts": {
    "test:deterministic": "npx playwright test",
    "test:e2e": "npx playwright test tests/e2e/ui-regression.spec.ts",
    "test:e2e:headed": "npx playwright test tests/e2e/ui-regression.spec.ts --headed",
    "test:e2e:debug": "npx playwright test tests/e2e/ui-regression.spec.ts --headed --debug",
    "test:e2e:auth": "npx playwright test tests/e2e/ui-regression.spec.ts --grep 'AUTH'",
    "test:e2e:mobile": "npx playwright test tests/e2e/ui-regression.spec.ts --grep '375|mobile'",
    "test:e2e:report": "npx playwright show-report",
    "backlog:failures": "node scripts/test-failure-to-backlog.js"
  }
}
```

## 🤝 Contributing New Tests

### Template

```typescript
test.describe('XXX-###: Feature Name', () => {
  test('should verify specific behavior', async ({ page }) => {
    // Setup: Navigate, login, dismiss dialogs
    await bypassFirstRun(page);
    await page.goto('https://selfprime.net/');
    await dismissAnyDialog(page);
    
    // Action: Perform user interaction
    await login(page, 'adrper79@gmail.com', '123qweASD');
    
    // Assert: Verify expected outcome
    await expect(page.locator('#authStatusText')).toContainText('adrper79');
  });

  test('should handle edge case', async ({ page }) => {
    // Similar structure
  });
});
```

### Checklist
- [ ] Test has descriptive name (starts with "should")
- [ ] Test includes setup (bypassFirstRun, login if needed)
- [ ] Test includes action (user interaction)
- [ ] Test includes assertion (expect)
- [ ] Test includes cleanup if needed
- [ ] Test works in headless mode
- [ ] Test works on mobile viewport (if applicable)
- [ ] Test is deterministic (no flakiness)

## 🐛 Common Issues & Solutions

### Test Timeout
```
◾ Timeout waiting for element
```
**Solution:** Increase timeout or verify selector is correct
```typescript
await page.waitForSelector('#element', { timeout: 10000 });
```

### Element Not Visible
```
◾ Element not visible
```
**Solution:** Wait for page load or verify visibility
```typescript
await page.waitForLoadState('networkidle');
await expect(element).toBeVisible();
```

### Flaky Tests
```
◾ Test passes sometimes, fails other times
```
**Solution:** Add explicit waits, reduce parallelism
```typescript
await page.waitForTimeout(300);  // Wait for transition
await expect(element).toBeStable();  // Wait for animations
```

### Pre-seed Storage Issue
```
◾ Welcome modal still appears
```
**Solution:** Call `bypassFirstRun()` before `goto()`
```typescript
await bypassFirstRun(page);  // BEFORE goto
await page.goto('...');  // AFTER
```

## 📞 Support

For issues or questions:
1. Check test output in `playwright-report/index.html`
2. Review error message and stack trace
3. Run in debug mode: `npm run test:e2e:debug`
4. Search existing backlog issues
5. Create new backlog issue with test details

---

**Version:** 1.0
**Last Updated:** 2026-03-16
**Maintained By:** QA/Development Team
