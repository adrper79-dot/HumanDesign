# Lessons Learned — Prime Self Engine

This document catalogs key learnings from development, debugging, and production incidents. Each entry includes context, root cause, resolution, and preventive measures.

---

## Incident Log

### 2026-03-03 | False Bug Report: Profile Calculation "Incorrect"

**Reported Issue**
User reported that the app calculated profile as `5/1` when the Jovian Archive reference chart showed `1/3` for the same person.

**Investigation Timeline**
1. User provided birth data entry: `08/21/1983, 5:30 PM, Naples FL`
2. App calculated:
   - Profile: **5/1**
   - Type: Manifesting Generator
   - P Sun: Gate 29 Line 5 (148.2512°)
   - D Sun: Gate 20 Line 1 (60.2512°)
3. User provided Jovian Archive PDF: `0921-Human Design Chart (1).pdf`
4. Initially suspected:
   - Wheel offset error (3.875° constant)
   - Gate boundary precision issue
   - Sun longitude calculation drift
5. Extracted PDF text revealed: **`Born: Sep, 21 1983, 17:30`**

**Root Cause**
Date entry error. The user entered **August 21** instead of **September 21**. The PDF filename `0921` indicated the birth date (September 21), not a user ID or chart number.

**Verification**
Running September 21 through the engine produced:
- Profile: **1/3** ✓ (matches Jovian)
- Type: Manifesting Generator ✓
- P Sun: Gate 46 Line 1
- D Sun: Gate 15 Line 3

The calculation engine was **100% accurate** when given correct input data.

**Key Learnings**
1. **Always verify input data first** — Before investigating algorithm accuracy issues, confirm that the user entered the correct birth date/time/location.
2. **Clues in filenames** — The PDF filename `0921-Human Design Chart (1).pdf` was the smoking gun — `0921` = September 21, not August 21.
3. **Verification methodology works** — The dual-anchor approach (AP + Jovian reference charts) immediately isolated the issue to input data rather than engine logic.
4. **Off-by-one-month errors are common** — Users may confuse date formats (MM/DD vs DD/MM) or misread handwritten dates.
5. **Near-boundary cases can be misleading** — The P Sun was at 148.2512°, just 0.0012° past the Gate 29 Line 4/5 boundary (148.25°). This made it _appear_ like a rounding error when it was actually a completely different date.

**Preventive Measures**
- [ ] Add input validation warnings for ambiguous dates (e.g., if day ≤ 12, ask user to confirm MM/DD format) — *tracked in backlog as future UX improvement*
- [ ] Display calculated birth data summary before final chart generation: "Confirm: Born on **[Day of Week], [Month Name] [Day], [Year]** at [time]?" — *tracked in backlog as future UX improvement*
- [ ] Add "Compare with Jovian Archive" feature: allow users to upload a reference PDF and auto-extract the birth data for comparison — *deferred: requires PDF parsing library*
- [ ] Show P/D Sun positions in degrees alongside gate/line for power users (helps spot gross errors) — *low effort, can add to chart response*

---

### 2026-03-03 | Full Codebase Audit — 26 Issues Found

**Trigger**
Full review of entire codebase, all documentation, tests, and data files prior to production readiness assessment.

**Findings Summary**

| Severity | Count | Key Theme |
|---|---|---|
| Critical | 6 | Broken DB driver, dead code, CORS blocks, schema drift, math bugs |
| Moderate | 14 | Missing endpoints, security gaps, data completeness, code duplication |
| Minor | 10 | Inconsistencies, hardcoded values, polish |

**Top 3 Systemic Issues Discovered**

1. **The Neon DB driver doesn't use the real Neon HTTP API** (BL-C1). `neonQuery()` in `queries.js` sends requests to an endpoint pattern that doesn't exist. Every database-dependent feature — auth, chart saving, profiles, practitioners, clusters, SMS — silently fails. This was never caught because handler tests mock the DB layer and engine tests don't touch the DB at all.

2. **Infrastructure wrappers have bugs the engine tests can't reach.** The calculation engine (Layers 1–7) is excellently tested — 190 tests, two verification anchors, boundary coverage. But the code that _wraps_ the engine (CORS, timezone parsing, data injection, chart persistence) has zero test coverage and contains real bugs: `parseToUTC` produces negative minutes (BL-C6), CORS blocks DELETE methods (BL-C4), `engine-compat.js` only injects 9 of 20+ data files (BL-M12).

3. **Spec/implementation drift.** 7 endpoints documented in API_SPEC.md don't exist in the router. 10+ endpoints in the router aren't in the spec. Rate limit values in the code don't match the spec. The health endpoint hardcodes a wrong version number. This drift happened because the spec was written up-front and not kept updated as implementation evolved.

**Key Learnings**

1. **Test the seams, not just the core** — Engine math tests are thorough, but integration seams (DB queries, timezone conversion, CORS, data injection) are where production failures actually happen. Prioritize adding integration tests for the middleware and DB layers.
2. **Spec-first only works with spec-maintenance** — API_SPEC.md drifted significantly from the actual router. Either generate the spec from the code (e.g., OpenAPI from route definitions) or add a CI check that verifies spec/route alignment.
3. **One migration source of truth** — Having both `migrate.js` and `migrate.sql` with different schemas is a time bomb. Pick one path. Ideally `migrate.sql` is the DDL source and `migrate.js` just executes it.
4. **Audit data injection for serverless** — When code runs in both Node.js (tests) and Workers (production), every data file used at runtime must be explicitly injected via `engine-compat.js`. Add a startup check that validates all expected keys exist in `globalThis.__PRIME_DATA`.

**Backlog Reference**: Full details in [BACKLOG.md](../BACKLOG.md) — items BL-C1 through BL-m10.

---

## Development Best Practices

### Verification Anchors

**Current Anchors**
1. **AP** (Aug 5, 1979, 22:51 UTC, Tampa FL)
   - Profile: 6/2, Type: Projector
   - Full gate verification across all 9 planets + nodes
2. **0921** (Sep 21, 1983, 21:30 UTC, Naples FL) — added post-incident
   - Profile: 1/3, Type: Manifesting Generator
   - Cross-validated against Jovian Archive

**Why Multiple Anchors Matter**
- AP is a **6-line personality Sun** (boundary test: Gate 33 Line 6)
- 0921 is a **1-line personality Sun** (start-of-gate boundary)
- Together they cover high/low line boundaries and two different types

### Gate Boundary Precision

**Critical Constants**
- `WHEEL_OFFSET = 3.875°` — Do not modify without recalibrating both anchors
- `DEG_PER_LINE = 0.9375°` — Each line spans 56.25 arcminutes

**Floating-Point Precision**
JavaScript's `Number` (IEEE 754 double) provides ~15 decimal digits of precision. For gate/line calculations:
- Sun longitude precision: ±0.0001° is sufficient (±0.36 arcseconds)
- Line boundaries: nearest 0.0001° eliminates ambiguity for all practical birth times
- Edge case: A person born during a line transition (±0.0005°) may get different results from different calculators due to rounding. This is < 2 seconds of time, which is within measurement error of most birth certificates.

### Testing Strategy

**Unit Tests**
- Each engine layer has dedicated tests (`tests/engine.test.js`)
- AP anchor verified at every layer (JDN → Sun → Planets → Gates → Chart → Astro)
- Boundary conditions: 0°, 360°, gate transitions, line transitions

**Integration Tests**
- Full chart workflow (`tests/handlers.test.js`)
- API endpoints tested with realistic payloads
- Auth, validation, error handling

**Regression Tests**
When a "bug" is reported:
1. Add the failing case as a test (even if it's actually user error)
2. Verify with reference data (Jovian, astro.com, etc.)
3. Leave the test in place as a known-good anchor

---

## Common Debugging Patterns

### Profile Mismatch
**Symptoms**: User reports profile X/Y but expects A/B

**Checklist**
1. Verify birth date (MM vs DD confusion, month off-by-one)
2. Verify birth time (12-hour vs 24-hour, AM/PM flip)
3. Verify timezone (EST vs EDT, user's stated timezone vs actual DST rules)
4. Check if user provided _local_ time but app expected UTC (or vice versa)
5. Only after input verification → check P Sun line and D Sun line separately

### Type Mismatch
**Symptoms**: Generator vs Manifesting Generator, Projector vs Manifestor

**Root Causes**
- **Sacral defined vs undefined** — Most common. Check gates 3,5,9,14,27,29,34,42,59. If any channel activates Sacral, type ≠ Projector.
- **Motor-to-Throat connection** — Determines Manifestor vs Projector (if Sacral undefined). Motors = {Heart, Solar Plexus, Root, Sacral}. Trace channels from Throat → motors.

### Cross Mismatch
**Symptoms**: Wrong cross name or cross type (Right vs Left vs Juxtaposition)

**Root Cause**
Cross type is determined solely by **P Sun line**:
- Line 1,2 → Right Angle
- Line 3 → Juxtaposition
- Line 4,5,6 → Left Angle

If cross type is wrong, the P Sun line is wrong → check P Sun gate/line → check birth date/time.

---

## Engine Accuracy Validation

### Comparison with Reference Calculators

**Primary References**
1. **Jovian Archive** — Original HD source, most trusted
2. **MyBodyGraph** — Commercial HD charts, generally accurate
3. **GeneticMatrix** — Another commercial tool

**Methodology**
1. Generate chart in Prime Self
2. Generate chart in reference tool using _identical_ birth data
3. Compare:
   - P Sun gate/line
   - D Sun gate/line (most critical for profile)
   - Type, Authority, Profile
   - Active channels (order may vary, set comparison)
4. Accept ±1 line difference only if birth time uncertainty is > 2 hours

**Known Differences**
- **Pluto ephemeris**: Some calculators use truncated VSOP87 (like ours), others use JPL DE440. Difference is ~0.02° (negligible for gate-level accuracy).
- **Moon**: Our 50-term truncated Meeus ELP2000 is accurate to ~0.3°. Professional tools may use full ELP2000-82B (±0.01°). This rarely affects gate assignment but can affect line in fast-moving Moon scenarios.
- **Wheel offset**: We use 3.875° (3°52'30"). Some tools use 3.83° or 3.9°. Verify with both AP and 0921 anchors before changing.

---

## Deployment Gotchas

### Timezone Handling
The `parseToUTC` utility uses `Intl.DateTimeFormat` to determine timezone offsets. This works in:
- Node.js (full IANA tz database)
- Cloudflare Workers (limited but includes all common zones)
- Browsers (varies — Safari, Chrome, Firefox all support IANA zones)

**Edge Case**: Historical dates before 1970 may have incorrect DST rules in some runtimes. Always confirm against an authoritative source (e.g., timeanddate.com) for births before 1970.

### KV Cache Invalidation
Geocode results are cached for 30 days in Workers KV. If a city's coordinates change (rare but possible for small towns), the cache must be manually purged:
```bash
npx wrangler kv key delete "geo:city name" --namespace-id <id>
```

---

## Future Improvements

### Input Validation Enhancements
- [ ] Add "reverse geocode" — after user enters lat/lng, show the city name to confirm
- [ ] Show day-of-week for birth date (helps catch month errors: "You were born on a Wednesday" → user can verify)
- [ ] Timezone suggestion based on geocode result
- [ ] Validate IANA timezone strings before passing to `Intl.DateTimeFormat` — return 400 on invalid (BL-m7)
- [ ] Basic email format validation on registration (BL-m10)

### Chart Comparison Tool
- [ ] Allow users to upload a Jovian/MyBodyGraph PDF
- [ ] Auto-extract birth data + chart results from PDF
- [ ] Highlight differences between Prime Self calculation and reference

### Enhanced Debugging
- [ ] Add `/api/debug/chart` endpoint (auth required) that returns:
  - Raw JDN, Sun longitude, all planetary positions
  - Gate index, line offset, color, tone, base for P/D Sun
  - Full channel activation logic trace
- [ ] Log every chart calculation to DB with input hash (detect repeated errors)

### Infrastructure Hardening (from 2026-03-03 audit)
- [ ] Fix Neon DB driver to use official `@neondatabase/serverless` package (BL-C1)
- [ ] Add integration tests for middleware (CORS, rate limiting, auth) (backlog: test gaps)
- [ ] Add integration tests for DB query layer (backlog: test gaps)
- [ ] Consolidate migration path to single source of truth (BL-C3)
- [ ] Add startup validation for `globalThis.__PRIME_DATA` in Workers (BL-M12)
- [ ] Generate API spec from route definitions or add CI check for drift (BL-M1)

---

## Appendix: Reference Birth Data

### Known-Good Test Cases

| Name | Birth Date/Time | Location | Profile | Type | Notes |
|---|---|---|---|---|---|
| **AP** | Aug 5, 1979, 22:51 UTC | Tampa FL | 6/2 | Projector | Primary anchor, all tests run against this |
| **0921** | Sep 21, 1983, 21:30 UTC | Naples FL | 1/3 | MG | Jovian Archive verified, added Mar 2026 |

Both cases are committed to the repository as PDFs in the project root:
- `Ap-Human Design Chart (1).pdf` (AP anchor)
- `0921-Human Design Chart (1).pdf` (0921 case)

---

## Document History

| Date | Author | Change |
|---|---|---|
| 2026-03-03 | System | Initial creation post-incident: false bug report due to date entry error |
| 2026-03-03 | Audit  | Added full codebase audit findings (26 issues); linked to BACKLOG.md; updated preventive measures with tracking notes; added infrastructure hardening section to Future Improvements |
