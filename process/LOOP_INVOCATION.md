# 🔁 THE LOOP — Quick Invocation Guide

## Overview

THE LOOP v2 is a comprehensive enterprise build cycle protocol. The full specification is in [PRIME_SELF_LOOP_V2.md](PRIME_SELF_LOOP_V2.md).

This document provides quick invocation prompts for different scenarios.

---

## 📋 Standard Cycle Invocation

Copy and paste this into your AI assistant:

```
You are THE LOOP agent for Prime Self Engine.

Execute one complete build cycle following the protocol in:
  process/PRIME_SELF_LOOP_V2.md

Working directory: c:\Users\Ultimate Warrior\My project\HumanDesign

Current cycle number: [Check process/CYCLE_COUNTER.md and increment by 1]

Execute PHASE 1 through PHASE 5:

PHASE 1 — INTAKE & CONSOLIDATION
  1A. Knowledge Loader (Subagent: Explore, thoroughness=medium)
  1B. Issue Consolidator (Subagent: Explore, thoroughness=thorough)
  1C. Feature Matrix Validator (Subagent: Explore, thoroughness=medium)
  1D. Document Structure Validator
  1E. Priority Resolver (select 1-5 items for THIS cycle)

PHASE 2 — BUILD
  2A. Reuse Scanner
  2B. Builder (implement selected items)
  2C. Multi-Persona Evaluator
  2D. Test Writer
  2E. Duplication Scanner

PHASE 3 — VERIFY & DEPLOY
  3A. Test Runner (npm test)
  3B. Integration Verifier
  3C. Commit & Deploy (wrangler deploy)
  3D. Production Smoke (live API tests)

PHASE 4 — DOCUMENT & ORGANIZE
  4A. Doc Updater
  4B. Issue Registry Updater (audits/issue-registry.json)
  4C. Lessons Learned
  4D. Coverage Auditor

PHASE 5 — DISCOVER & IMPROVE
  5A. Opportunity Scanner
  5B. Code Quality Sweep
  5C. Audit Delta Generator
  5D. Health Scorer

Create session log: process/SESSION_LOG_[TODAY_DATE]_CYCLE_[N].md

Begin with Phase 1A.
```

---

## 🚨 Hotfix Cycle (Mid-Cycle P0)

```
HOTFIX MODE — You are THE LOOP agent in emergency mode.

A P0 issue was discovered mid-cycle: [DESCRIBE ISSUE]

Execute Hotfix Protocol from process/PRIME_SELF_LOOP_V2.md:

1. Stash current work (git stash)
2. Create hotfix branch (git checkout -b hotfix/[issue-id])
3. Fix P0 issue ONLY (no scope expansion)
4. Run tests (npm test)
5. Deploy (wrangler deploy)
6. Production smoke test
7. Document fix in current session log
8. Return to original work (git checkout + git stash pop)

Issue ID: [GENERATE OR USE EXISTING]
Issue severity: P0
Issue area: [backend|frontend|engine|security|etc.]

Proceed with hotfix ONLY. Do not resume normal cycle until hotfix is deployed and verified.
```

---

## 🔍 Audit-Only Cycle (No Build)

```
You are THE LOOP agent in AUDIT-ONLY mode.

Execute PHASE 1 and PHASE 5 ONLY (no build, no deploy):

PHASE 1 — INTAKE & CONSOLIDATION
  1A. Knowledge Loader
  1B. Issue Consolidator
  1C. Feature Matrix Validator
  1D. Document Structure Validator
  1E. Priority Resolver (generate recommendations, do not build)

PHASE 5 — DISCOVER & IMPROVE
  5A. Opportunity Scanner
  5B. Code Quality Sweep
  5C. Audit Delta Generator
  5D. Health Scorer

Output:
  - Session log with audit findings
  - Updated audits/issue-registry.json
  - Updated process/CYCLE_COUNTER.md (audit cycle)
  - Recommended work items for next BUILD cycle

Do NOT modify code.
Do NOT deploy.
```

---

## 🧹 Cleanup Cycle (RED Health Protocol)

```
You are THE LOOP agent in CLEANUP mode.

Health status is RED. Execute cleanup cycle following RED Health Protocol in process/PRIME_SELF_LOOP_V2.md.

CONSTRAINTS:
  - NO new features
  - NO enhancements
  - NO P2/P3 work
  - Focus: Fix regressions, restore test count, resolve P0/P1

SELECTION CRITERIA (Phase 1E):
  1. All open P0 (must fix)
  2. Test failures (must fix)
  3. Deploy blockers (must fix)
  4. P1 with workarounds (defer if possible)

GOAL: Restore to YELLOW or GREEN health within this cycle.

Execute all 5 phases with RED health constraints enforced.
```

---

## 📊 Status Check (No Cycle)

```
Read current project status from:
  - process/CYCLE_COUNTER.md
  - audits/issue-registry.json
  - FEATURE_MATRIX.md
  - MASTER_BACKLOG_SYSTEM_V2.md

Provide:
  1. Current cycle number
  2. Test count (passing/skipped)
  3. Health status (GREEN/YELLOW/RED)
  4. Open P0 count
  5. Open P1 count
  6. Last cycle date
  7. Items completed in last 3 cycles
  8. Top 5 priority items for next cycle
  9. Launch readiness assessment

Do NOT execute a cycle. Report status only.
```

---

## 🎯 Targeted Fix (Single Item)

```
You are THE LOOP agent in TARGETED mode.

Execute a focused build cycle for ONE specific item:

Item ID: [ISSUE_ID]
Item title: [TITLE]
Item severity: [P0|P1|P2|P3]
Item area: [area]

Execute abbreviated cycle:

PHASE 1E: Confirm this item is highest priority
PHASE 2: Build (2A-2E)
PHASE 3: Verify & Deploy (3A-3D)
PHASE 4: Document (4A-4B)
PHASE 5: Health Score only (5D)

Update:
  - audits/issue-registry.json (mark resolved)
  - process/SESSION_LOG_[DATE]_CYCLE_[N].md (abbreviated format)
  - process/CYCLE_COUNTER.md (increment, record item)

Skip:
  - Issue consolidation (assume already done)
  - Feature matrix validation
  - Document structure validation
  - Opportunity scanning
  - Code quality sweep

This is a surgical fix, not a full cycle.
```

---

## 🚀 Launch Readiness Assessment

```
You are THE LOOP agent in LAUNCH ASSESSMENT mode.

Evaluate termination criteria from process/PRIME_SELF_LOOP_V2.md:

ISSUE HEALTH:
  [ ] Check audits/issue-registry.json: P0 count = 0?
  [ ] Check audits/issue-registry.json: P1 count ≤ 3 with workarounds?

FEATURE COMPLETENESS:
  [ ] Check FEATURE_MATRIX.md: All user stories complete end-to-end?
  [ ] Check docs/PRACTITIONER_LAUNCH_CHECKLIST: All items ✅?

CYCLE HEALTH:
  [ ] Check process/CYCLE_COUNTER.md: Health = GREEN for last 3 cycles?
  [ ] Check process/CYCLE_COUNTER.md: Test count trend = up for last 3 cycles?
  [ ] Check SESSION_LOGs: Deploy success = 100% for last 5 cycles?

GATE CHECKS:
  [ ] Check audits/SYSTEM_AUDIT_*.md: Latest verdict = LAUNCH?
  [ ] Check audits/BACKEND_GATE_CHECK_*.md: Latest verdict = LAUNCH?

Output:
  1. Checklist with ✅ or ❌ for each criterion
  2. Blockers list (what prevents launch)
  3. Estimated cycles to launch (based on velocity)
  4. Recommended actions

Generate audits/LAUNCH_READINESS_ASSESSMENT_[DATE].md with findings.

Do NOT execute a build cycle.
```

---

## 🔄 Resume Interrupted Cycle

```
You are THE LOOP agent resuming an INTERRUPTED cycle.

Last session log: process/SESSION_LOG_[DATE]_CYCLE_[N].md

Read the session log to determine:
  1. Which phase was in progress
  2. Which items were selected
  3. Which items were completed
  4. What remains

Resume from the last completed phase.

If Phase 2 (Build) was interrupted:
  - Check git status for uncommitted changes
  - Review work in progress
  - Complete remaining selected items
  - Proceed to Phase 3

If Phase 3 (Verify & Deploy) was interrupted:
  - Re-run tests
  - Attempt deploy again
  - Complete remaining verification

If Phase 4+ was interrupted:
  - Complete documentation updates
  - Finish discovery
  - Close session log

Do NOT start a new cycle. Resume the current one.
```

---

## 📝 Custom Cycle (Advanced)

```
You are THE LOOP agent in CUSTOM mode.

Execute a custom cycle with these modifications:

SKIP PHASES:
  [List phases to skip, e.g., "Skip Phase 1B, 1C"]

FOCUS AREAS:
  [Specify focus, e.g., "Focus on practitioner features only"]

CUSTOM CONSTRAINTS:
  [Add constraints, e.g., "Do not deploy, local testing only"]

SELECTION OVERRIDE:
  [Provide specific items to build instead of priority ladder]

Execute remaining phases per process/PRIME_SELF_LOOP_V2.md with modifications above.

Log custom cycle parameters in session log header.
```

---

## 💡 Tips for Effective Loop Execution

### For GitHub Copilot Chat

1. **Start each session fresh** — Copilot has limited context. Copy the full invocation prompt each time.

2. **Reference the spec** — Always include: "Follow protocol in process/PRIME_SELF_LOOP_V2.md"

3. **Use subagents** — For Phase 1A, 1B, 1C: Explicitly ask for Explore subagent to be used.

4. **Checkpoint frequently** — After each phase, ask for a summary before proceeding.

5. **Provide context** — If resuming work, include: "Last cycle was [N], test count was [X], health was [STATUS]"

### For Managing Long Cycles

- Run Phase 1 in one session (intake & consolidation)
- Run Phase 2 in separate sessions per item (build one at a time)
- Run Phase 3-5 in final session (verify, document, discover)

### For Tracking Progress

Always update:
- `process/CYCLE_COUNTER.md` — After cycle completion
- `audits/issue-registry.json` — After each item resolved
- `process/SESSION_LOG_*.md` — Throughout the cycle

---

## 📂 Related Files

- **Full Protocol:** [PRIME_SELF_LOOP_V2.md](PRIME_SELF_LOOP_V2.md)
- **Cycle Counter:** [CYCLE_COUNTER.md](CYCLE_COUNTER.md)
- **Issue Registry:** [../audits/issue-registry.json](../audits/issue-registry.json)
- **Build Bible:** [BUILD_BIBLE.md](BUILD_BIBLE.md)
- **Reliability Policy:** [RELIABILITY_POLICY.md](RELIABILITY_POLICY.md)

---

## 🎬 Quick Start

**For your next cycle:**

1. Check current cycle: `cat process/CYCLE_COUNTER.md`
2. Check health: Look at last entry in CYCLE_COUNTER.md
3. Choose invocation template above
4. Increment cycle number
5. Copy prompt to Copilot
6. Let THE LOOP execute

**First time using THE LOOP?**

Start with "Status Check" to understand current state, then run "Audit-Only Cycle" to prime the issue registry.

---

**Good hunting. 🎯**
