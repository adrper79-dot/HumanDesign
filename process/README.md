# Process & Standards Documentation

Team processes, development standards, and historical execution logs for Prime Self.

This directory contains useful engineering history, but it is not the default source of truth for current product status, pricing, or launch posture.

## 📋 Process Documentation

### Development Process
- **[BUILD_BIBLE.md](BUILD_BIBLE.md)** — Layer-by-layer implementation reference guide
  - How to execute builds systematically
  - Prompt templates for each layer
  - Architecture patterns and standards
  - Status: Comprehensive documentation

- **[BUILD_LOG.md](BUILD_LOG.md)** — Complete implementation history
  - Task tracking (40/41 tasks, 97% complete)
  - Build identifiers (BL-R-M9, BL-MOB-001, etc.)
  - Sprints 1-14 detailed activity log
  - Status: Comprehensive historical record

### Testing & Quality Assurance

- **[RELIABILITY_POLICY.md](RELIABILITY_POLICY.md)** — reliability, verification, simulation, and monitoring policy
  - Truth-first testing and verification standards
  - Deterministic release-gate requirements
  - Structured observability and reporting expectations
  - Status: Active policy

- **[TEST_PLAN.md](TEST_PLAN.md)** — Comprehensive test strategy
  - Current test strategy and verification guidance
  - Integration test recommendations
  - End-to-end test scenarios
  - Performance benchmarks
  - Security testing checklist
  - Status: Complete testing framework

- **[UPGRADE_FLOW_TESTING.md](UPGRADE_FLOW_TESTING.md)** — Upgrade scenario testing guide
  - Test cases for upgrade workflows
  - Data migration validation
  - Rollback procedures
  - Status: Reference document

### Change & Release Management

- **[CHANGELOG_UX.md](CHANGELOG_UX.md)** — UX improvement tracking
  - UI/UX fixes and enhancements
  - Feature additions (tracking list)
  - Deprecations and removals
  - Status: Active tracking

- **[UI_CHANGELOG_2026-03-08.md](UI_CHANGELOG_2026-03-08.md)** — UI audit and changelog
  - Combined UI audit findings
  - Change tracking by component
  - Severity assessment
  - Status: Current reference

### Sprint & Defect Tracking

- **[BACKLOG_VERIFICATION_SPRINT_2026-03-09.md](BACKLOG_VERIFICATION_SPRINT_2026-03-09.md)** — Sprint verification process
  - Sprint definition and scope
  - Verification methodology
  - Status checklist (97% confidence)
  - Status: Recent completion

- **[UI_DEFECT_BACKLOG.md](UI_DEFECT_BACKLOG.md)** — Defect backlog tracking
  - Critical, high, medium, low severity defects
  - UI/UX specific issues
  - Deferred items from backlogs
  - Status: Curated defect list

### Learning & Retrospectives

- **[LESSONS_LEARNED.md](LESSONS_LEARNED.md)** — Debugging patterns and insights
  - Debugging methodology
  - Common gotchas and solutions
  - Verification techniques
  - Development patterns
  - Status: Knowledge base

---

## 🎯 Manual by Role

### Software Engineers
**Start here**: [BUILD_BIBLE.md](BUILD_BIBLE.md) → [BUILD_LOG.md](BUILD_LOG.md)
- Architecture patterns and standards
- Implementation procedures
- Historical build context

### QA & Test Engineers
**Start here**: [TEST_PLAN.md](TEST_PLAN.md)
- Testing strategy and coverage
- Test scenarios
- Verification procedures

### Project Managers
**Start here**: [BACKLOG_VERIFICATION_SPRINT_2026-03-09.md](BACKLOG_VERIFICATION_SPRINT_2026-03-09.md)
- Sprint scope and verification
- Completion status
- Issue tracking

### Product/UX Teams
**Start here**: [CHANGELOG_UX.md](CHANGELOG_UX.md) + [UI_DEFECT_BACKLOG.md](UI_DEFECT_BACKLOG.md)
- Change tracking
- Known issues
- Defect severity

---

## 📊 Document Overview

| Document | Type | Lines | Status |
|----------|------|-------|--------|
| BUILD_BIBLE.md | Reference | 1,200+ | Complete |
| BUILD_LOG.md | Historical Log | large | Historical reference |
| TEST_PLAN.md | Strategy | 800+ | Complete |
| CHANGELOG_UX.md | Tracking | 200+ | Active |
| UI_CHANGELOG_2026-03-08.md | Reference | 173 | Current |
| BACKLOG_VERIFICATION_SPRINT_2026-03-09.md | Verification | 250+ | Recent |
| UI_DEFECT_BACKLOG.md | Tracking | 400+ | Curated |
| LESSONS_LEARNED.md | Knowledge Base | 300+ | Reference |
| UPGRADE_FLOW_TESTING.md | Reference | 200+ | Reference |

**Total**: 9 documents of mixed current standards and historical execution records

---

## 🔄 Document Relationships

### Development Workflow
```
BUILD_BIBLE (standards)
    ↓
BUILD_LOG (execution history)
    ↓
TEST_PLAN (quality verification)
    ↓
CHANGELOG (release tracking)
```

### Issue Management
```
BACKLOG (product issues)
    ↓
UI_DEFECT_BACKLOG (UI issues)
    ↓
SPRINT VERIFICATION (completion check)
    ↓
LESSONS_LEARNED (future improvements)
```

---

## 🔗 Related Documentation

- **Root Level**: [../BACKLOG.md](../BACKLOG.md) — Product backlog (kept at root)
- **Audits**: See [../audits/](../audits/) for analysis and findings
- **Guides**: See [../guides/](../guides/) for implementation how-to guides
- **Architecture**: See [../ARCHITECTURE.md](../ARCHITECTURE.md)

For current documentation navigation, use [../DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md).

---

## Contributing to Process Documentation

When updating process documents:

1. **BUILD_BIBLE**: Update when architectural patterns change
   - Keep implementation procedures current
   - Document new standards as they emerge

2. **BUILD_LOG**: Append new tasks with BL-* identifier
   - Format: `BL-[CATEGORY]-[NUMBER]`
   - Examples: `BL-R-M9`, `BL-MOB-001`, `BL-INT-003`

3. **TEST_PLAN**: Add tests for new features
   - Maintain unit test coverage at 100%
   - Add integration tests as new features added

4. **CHANGELOG_UX**: Track all UI changes
   - Log all UX improvements and fixes
   - Mark items as `[x]` when complete

5. **LESSONS_LEARNED**: Add insights after major work
   - Document debugging patterns
   - Record common gotchas
   - Share verification techniques

6. **Backlog Documents**: Keep daily/weekly updated
   - Prioritize defects by severity
   - Track sprint progress
   - Update status regularly

---

**Last Updated**: March 2026  
**Maintainer**: Engineering Team

