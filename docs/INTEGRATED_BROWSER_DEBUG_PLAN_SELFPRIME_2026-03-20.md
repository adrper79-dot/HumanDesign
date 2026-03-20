# Integrated Browser Debug Plan — selfprime.net

Date: 2026-03-20
Target: https://selfprime.net
Account: adrper79@gmail.com

## Confirmed Live Access Before Planning

- Login succeeds for the supplied account.
- Public routes confirmed reachable: homepage, `/api/health`, practitioner directory list, celebrity list, daily transits.
- Authenticated routes confirmed reachable: `/api/auth/me`, `/api/billing/subscription`, `/api/client/my-practitioners`.
- Live entitlement mismatch observed before fixes in code: `auth/me` exposed `user.tier = practitioner`, while billing and backend feature enforcement resolved the account as active `individual`.
- Practitioner core APIs were not truly accessible for this account: `/api/practitioner/profile`, `/api/practitioner/clients`, and `/api/practitioner/stats` returned practitioner feature gating responses.
- Practitioner-adjacent exact routes showed inconsistent behavior before fixes: reviews, directory profile, and referral link returned 500 in production for this downgraded account.

## Current Test Scope

The reachable and testable browser scope for this account is:

- Public browsing
- Individual-tier authenticated features
- Locked or gated practitioner surfaces
- Error-handling and upgrade-prompt behavior for unreachable practitioner features

The plan does not treat full practitioner workflows as accessible for this account unless entitlement changes.

## Environment Setup

1. Open selfprime.net in the integrated browser.
2. Open DevTools.
3. Enable Preserve log in Network.
4. Disable cache while DevTools is open.
5. Capture Console, Network, and failed requests for each defect.
6. Run the core pass twice:
   - Desktop: 1440x900
   - Mobile: 375x812

## Pre-Login Checks

1. Verify homepage renders without blocking console errors.
2. Verify sign-in button is visible.
3. Open the auth overlay.
4. Verify these reachable elements:
   - Email input
   - Password input
   - Sign In button
   - Forgot password link
   - Google sign-in button
   - Apple sign-in button
   - Auth mode toggle
   - Continue without signing in link

## Login and Session

1. Sign in with the supplied account.
2. Verify signed-in state appears in the auth bar.
3. Reload the page.
4. Verify session survives reload.
5. Verify logout returns the app to signed-out state.
6. Sign back in and continue the remaining checks.

## Global Navigation

1. Verify desktop sidebar navigation.
2. Verify active-state changes when switching tabs.
3. Verify sidebar collapse/expand works.
4. Verify mobile drawer opens and closes.
5. Verify mobile bottom navigation switches tabs correctly.

## Reachable Public and Individual-Tier Surfaces

### Overview

1. Verify overview loads after login.
2. Verify welcome card renders without JS errors.
3. Verify primary CTA routes correctly.

### Chart

1. Open Chart.
2. Verify birth data fields render and accept input.
3. Generate a chart with valid data.
4. Verify loading, success state, and result rendering.
5. Verify invalid input produces validation.

### Celebrity / Compare

1. Open Celebrity.
2. Verify list render.
3. Verify search.
4. Verify category or filter controls.
5. Verify detail or comparison view when selecting a result.

### Directory

1. Open Directory.
2. Verify filters and search controls.
3. Verify list rendering.
4. Record blank or incomplete public cards if present.
5. If a valid slugged practitioner appears, verify drill-down to the practitioner profile page.
6. If no valid slugged profile appears, mark drill-down as blocked by production data quality.

### Achievements

1. Open Achievements.
2. Verify cards, counters, or empty state render.
3. Verify any refresh or filter controls.

### Transits

1. Open Transits.
2. Verify daily transit data loads.
3. Verify date navigation or expand/collapse behavior if present.

### Check-In

1. Open Check-In.
2. Verify score input, checkboxes, text fields, and submit control.
3. Submit a valid check-in.
4. Verify success feedback and saved state.

### Timing

1. Open Timing.
2. Verify template or intention controls.
3. Run a valid timing query.
4. Verify results render.

### Calendar

1. Open Calendar.
2. Verify personal calendar view loads.
3. Verify date navigation.
4. Verify practitioner-only calendar affordances stay hidden or locked.

### Enhance

1. Open Enhance.
2. Verify editor or prompt input renders.
3. Submit a minimal valid request if available.
4. Verify result rendering and failure handling.

### Diary

1. Open Diary.
2. Verify entry list or empty state.
3. Create a new entry if enabled.
4. Verify save and reload behavior.

### History

1. Open History.
2. Verify saved items list or empty state.
3. Open an existing saved item if present.

### Rectify

1. Open Rectify.
2. Verify input form.
3. Submit valid input.
4. Verify results or validation.

### SMS

1. Open SMS.
2. Verify preferences render.
3. Only make state changes if production-safe for this account.

### Onboarding Replay

1. Open Onboarding.
2. Verify replay modal or walkthrough behavior.
3. Verify close and return flow.

### My Practitioner

1. Verify nav item visibility matches the empty `/api/client/my-practitioners` response.
2. If visible unexpectedly, verify the tab shows a stable empty state.

## Locked and Failure-State Surfaces

These are still in scope because they are reachable in the UI and should degrade correctly.

### Practitioner Tab

1. Open Practitioner.
2. Verify locked or upgrade state is shown.
3. Verify no uncaught exception occurs when practitioner APIs deny access.

### Composite

1. Open Composite.
2. Verify upgrade or one-time purchase prompt behavior.
3. Verify no silent failure.

### Clusters

1. Open Clusters.
2. Verify create or join actions are gated correctly for non-practitioner entitlement.
3. Verify no JS crash.

### Practitioner-Adjacent Exact Routes

If the UI surfaces these actions, verify they fail cleanly rather than returning generic broken states:

- Directory profile management
- Referral link generation
- Reviews management
- Practitioner directory stats

## Mobile Regression Pass

Repeat these on mobile width:

- Login
- Overview
- Chart
- Celebrity
- Directory
- Transits
- Check-In
- Timing
- Calendar
- Practitioner locked state
- Composite locked state

Verify:

- No off-screen critical controls
- No dead taps
- No stuck overlays
- No duplicate navigation chrome

## Defect Capture Template

For each failure, record:

- Surface or tab
- Action taken
- Expected result
- Actual result
- Network route
- HTTP status
- Console error
- Screenshot

## Highest-Priority Debug Targets

1. Any stale practitioner UI rendered for individual entitlement.
2. Any practitioner-adjacent surface that still 500s instead of showing a controlled locked state.
3. Directory data quality defects that make profile drill-down impossible.
4. Mobile navigation regressions across reachable tabs.