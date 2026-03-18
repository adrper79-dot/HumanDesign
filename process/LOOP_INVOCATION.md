# 🔁 THE LOOP — Quick Invocation Guide

## Overview

THE LOOP v2 is a comprehensive enterprise build cycle protocol. The full specification is in [PRIME_SELF_LOOP_V2.md](PRIME_SELF_LOOP_V2.md).

This document provides quick invocation prompts for different scenarios. Choose the mode that matches your situation, copy the prompt, and hand it to your agent.

**Agent Compatibility:** These prompts work with Claude Code, Claude Opus (chat), GitHub Copilot, or any agent with filesystem access. Where "subagent" hints appear (e.g., `thoroughness=thorough`), these are suggestions — agents without subagent dispatch should interpret `thoroughness=thorough` as "read every file fully" and `thoroughness=medium` as "read key sections, skim the rest."

---

## 📋 Standard Cycle Invocation

```
You are THE LOOP agent for Prime Self Engine.

Execute one complete build cycle following the protocol in:
  process/PRIME_SELF_LOOP_V2.md

Working directory: c:\Users\Ultimate Warrior\My project\HumanDesign

Current cycle number: [Check process/CYCLE_COUNTER.md and increment by 1]

CRITICAL FIRST STEP — Before ANY other action, read these files in this
exact order (each provides context for the next):

  1. ARCHITECTURE.md
  2. process/BUILD_BIBLE.md
  3. process/RELIABILITY_POLICY.md
  4. CODEBASE_MAP.md
  5. MASTER_BACKLOG_SYSTEM_V2.md
  6. FEATURE_MATRIX.md
  7. audits/issue-registry.json
  8. Most recent file in audits/ by date
  9. process/LESSONS_LEARNED.md

After reading, write a 3-sentence situational summary confirming current
state before proceeding.

Then execute PHASE 1 through PHASE 5:

PHASE 1 — INTAKE & CONSOLIDATION
  1A. Knowledge Loader (read Tier 1-5 per spec)
  1B. Issue Consolidator (grep TODO/FIXME/HACK, cross-ref all sources → issue-registry.json)
  1C. Feature Matrix Validator (handler completeness, user story walkthrough per persona)
  1D. Document Structure Validator (required docs exist, links resolve, no orphans)
  1E. Priority Resolver (select 1-5 items for THIS cycle, write to session log)

PHASE 2 — BUILD
  2A. Reuse Scanner (prove existing code was checked before writing new)
  2B. Builder (implement selected items per BUILD_BIBLE patterns)
  2C. Multi-Persona Evaluator (Practitioner, User, CTO, CISO, CFO, CMO, CEO, CIO, Engineer, Admin)
  2D. Test Writer (new code = new tests, baseline must increase)
  2E. Duplication Scanner (must be zero before Phase 3)

PHASE 3 — VERIFY & DEPLOY
  3A. Test Runner (npm test — count ≥ baseline)
  3B. Integration Verifier (full chain for whatever changed)
  3C. Commit & Deploy (atomic commits with IDs, wrangler deploy, Pages push)
  3D. Production Smoke (live API tests against https://prime-self-api.adrper79.workers.dev)

PHASE 4 — DOCUMENT & ORGANIZE
  4A. Doc Updater (API docs, ARCHITECTURE, CODEBASE_MAP, FEATURE_MATRIX)
  4B. Issue Registry Updater (audits/issue-registry.json + MASTER_BACKLOG synced)
  4C. Lessons Learned (process/LESSONS_LEARNED.md, process/BUILD_BIBLE.md, process/ERROR_DEBUGGING.md)
  4D. Coverage Auditor (every feature: tests, error handling, analytics, docs, observability)

PHASE 5 — DISCOVER & IMPROVE
  5A. Opportunity Scanner (best practice gaps, world-class upgrades, experience polish)
  5B. Code Quality Sweep (swallowed errors, hardcoded values, missing schemas)
  5C. Audit Delta Generator (compare against latest audits/SYSTEM_AUDIT_*.md)
  5D. Health Scorer (compute scorecard, determine GREEN/YELLOW/RED)

Create session log: process/SESSION_LOG_[TODAY_DATE]_CYCLE_[N].md

Begin with the critical first step (reading files), then Phase 1A.
```

For recurring product-integrity audits that must check real implementation against `PRODUCT_PRINCIPLES.md` and `FEATURE_MATRIX.md`, then sync findings into both `audits/issue-registry.json` and `MASTER_BACKLOG_SYSTEM_V2.md`, use the workspace prompt:

- `.github/prompts/prime-self-audit-sync.prompt.md`
- `.github/prompts/prime-self-practitioner-audit.prompt.md` for practitioner-only workflow audits

---

## 🚨 Hotfix Cycle (P0 Emergency)

```
HOTFIX MODE — You are THE LOOP agent in emergency mode.

A P0 issue was discovered: [DESCRIBE ISSUE]

Read process/PRIME_SELF_LOOP_V2.md Emergency Protocols section, then execute:

1. STASH current work
   git stash push -m "WIP cycle [N] before hotfix"

2. BRANCH
   git checkout -b hotfix/[issue-id]-[short-description]

3. DIAGNOSE
   Read the error. Read the file. Read the FULL function, not just the line.
   Check process/ERROR_DEBUGGING.md — has this been seen before?
   Check audits/issue-registry.json — is this a regression of a resolved item?

4. FIX (scope: this P0 ONLY, nothing else)
   Follow process/BUILD_BIBLE.md patterns. Use existing utilities.

5. TEST
   Write a regression test proving the bug is dead.
   npm test — zero new failures.

6. DEPLOY
   wrangler deploy → exit 0
   curl https://prime-self-api.adrper79.workers.dev/api/health?full=1 → all green

7. PRODUCTION SMOKE
   Test the specific flow that was broken.
   If smoke fails → ROLLBACK IMMEDIATELY:
     wrangler rollback
   Then diagnose why the fix didn't hold.

8. IF ROLLBACK TRIGGERED:
   Document: what was attempted, why it failed, what state prod is in now.
   Do NOT re-deploy until root cause is understood.
   Add to audits/issue-registry.json with status "regression" if applicable.

9. DOCUMENT
   Update audits/issue-registry.json (mark resolved or regression)
   Add to process/LESSONS_LEARNED.md
   Add to process/ERROR_DEBUGGING.md
   Log in current session log with HOTFIX tag

10. MERGE & RESUME
    git checkout main && git merge hotfix/[branch]
    git stash pop (resume original work)

Issue ID: [GENERATE OR USE EXISTING]
Issue severity: P0
Issue area: [backend|frontend|engine|security|billing|auth]
```

---

## 🔍 Audit-Only Cycle (No Build, No Deploy)

```
You are THE LOOP agent in AUDIT-ONLY mode.

Execute PHASE 1 and PHASE 5 ONLY (no build, no deploy):

FIRST — Read these files in order:
  ARCHITECTURE.md → MASTER_BACKLOG_SYSTEM_V2.md → FEATURE_MATRIX.md →
  audits/issue-registry.json → most recent file in audits/ by date

PHASE 1 — INTAKE & CONSOLIDATION
  1A. Knowledge Loader
  1B. Issue Consolidator (full scan: grep codebase + all audit files + backlog + matrix)
  1C. Feature Matrix Validator (completeness + user story walkthrough)
  1D. Document Structure Validator (required docs, links, orphans)
  1E. Priority Resolver (generate prioritized recommendations — do NOT build)

PHASE 5 — DISCOVER & IMPROVE
  5A. Opportunity Scanner (best practice, world-class, experience polish)
  5B. Code Quality Sweep (full codebase)
  5C. Audit Delta Generator (compare against latest audits/SYSTEM_AUDIT_*.md)
  5D. Health Scorer (compute scorecard)

Output:
  - Updated audits/issue-registry.json (new issues added, statuses synced)
  - Updated FEATURE_MATRIX.md (gaps flagged)
  - Updated DOCUMENTATION_INDEX.md (links validated)
  - Session log with all findings
  - Recommended top 10 work items for next BUILD cycle (prioritized)

Do NOT modify application code.
Do NOT deploy.
```

---

## 🧹 Cleanup Cycle (RED Health Protocol)

```
You are THE LOOP agent in CLEANUP mode.

Health status is RED. Execute cleanup cycle per RED Health Protocol
in process/PRIME_SELF_LOOP_V2.md.

CONSTRAINTS:
  - NO new features
  - NO enhancements
  - NO P2/P3 work
  - ONLY: Fix regressions, restore test count, resolve P0/P1, close stale items

FIRST — Read: audits/issue-registry.json, MASTER_BACKLOG_SYSTEM_V2.md,
most recent process/SESSION_LOG_*.md, process/LESSONS_LEARNED.md

SELECTION (Phase 1E override):
  1. Open P0 issues (must resolve all)
  2. Test failures (must fix all)
  3. Deploy blockers (must fix all)
  4. Regressions from recent cycles (must fix all)
  5. P1 with workarounds available (defer if possible)
  6. Stale backlog items > 30 days (close, defer with reason, or resolve)

Execute all 5 phases with RED health constraints enforced.

GOAL: Restore to YELLOW or GREEN health within this cycle.
If still RED after cycle → next cycle is also CLEANUP.
```

---

## 🔄 Regression Cycle (User-Reported Issue)

```
You are THE LOOP agent in REGRESSION mode.

A user or practitioner reported a broken flow: [DESCRIBE WHAT'S BROKEN]

This is different from a Hotfix (root cause unknown) and different from
Cleanup (health may still be YELLOW/GREEN).

STEP 1 — REPRODUCE
  Attempt to reproduce the exact scenario described.
  Use the production API if possible (curl against live endpoints).
  If reproducible → document the exact steps and response.
  If not reproducible → document what you tried, ask for more info, STOP.

STEP 2 — DIAGNOSE
  Is this a regression from a recent cycle?
  Check: git log --oneline -20 → did a recent commit touch the affected files?
  Check: audits/issue-registry.json → was this issue previously resolved and has re-opened?
  Check: process/SESSION_LOG_*.md → did a recent cycle modify this flow?

  If regression: status in registry → "regression", link to the cycle that broke it.
  If new bug: add to registry as new issue.

STEP 3 — FIX
  Follow standard Phase 2 (Reuse Scanner → Builder → Persona Evaluator → Test Writer)
  Write a regression test that reproduces the EXACT user-reported scenario.
  The test must fail before the fix and pass after.

STEP 4 — VERIFY THE REPORTER'S FLOW
  Don't just run npm test. Walk through the COMPLETE flow the user described,
  step by step, against production after deploy.
  Document: "User reported [X]. After fix, the flow now produces [Y]."

STEP 5 — DEPLOY & CONFIRM
  Standard Phase 3 (commit → deploy → smoke).
  Additional: test the reporter's specific flow against live production.

STEP 6 — DOCUMENT
  Update audits/issue-registry.json.
  Add to process/ERROR_DEBUGGING.md (this is a known failure pattern now).
  Add to process/LESSONS_LEARNED.md if root cause was non-obvious.
  If regression: add a note to the session log of the cycle that introduced it.

Create session log with REGRESSION tag.
```

---

## 📊 Status Check (No Cycle)

```
You are THE LOOP agent in STATUS CHECK mode.

Read current project status from:
  - process/CYCLE_COUNTER.md
  - audits/issue-registry.json
  - FEATURE_MATRIX.md
  - MASTER_BACKLOG_SYSTEM_V2.md
  - 3 most recent process/SESSION_LOG_*.md files

Provide:
  1. Current cycle number
  2. Test count (passing / skipped / failing)
  3. Health status (GREEN / YELLOW / RED) with scorecard
  4. Open issue counts: P0 / P1 / P2 / P3
  5. Issue velocity: avg items resolved per cycle (last 5 cycles)
  6. Last cycle date
  7. Items completed in last 3 cycles
  8. Test count trend (last 5 cycles — up, flat, or down)
  9. Top 5 priority items for next cycle (with IDs and rationale)
  10. Launch readiness: met / not met for each termination criterion
  11. Estimated cycles to launch (based on velocity)

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

FIRST — Verify this item:
  [ ] Exists in audits/issue-registry.json (if not, add it first)
  [ ] Has no duplicates in registry (search by title keywords)
  [ ] Dependencies are resolved (check "notes" or "dependencies" fields)

Execute abbreviated cycle:

PHASE 1E: Confirm this item's priority position. If a higher-priority
          item exists, flag it and ask whether to switch.
PHASE 2:  Build (2A Reuse Scanner → 2B Builder → 2C Persona Evaluator → 2D Test Writer → 2E Duplication check)
PHASE 3:  Verify & Deploy (3A Tests → 3B Integration chain → 3C Commit & Deploy → 3D Production smoke)
PHASE 4:  Document (4A Docs → 4B Registry update: mark resolved with evidence)
PHASE 5D: Health Score only

Create abbreviated session log: process/SESSION_LOG_[DATE]_CYCLE_[N]_TARGETED.md
Update process/CYCLE_COUNTER.md (increment, note targeted item)
```

---

## 🚀 Launch Readiness Assessment

```
You are THE LOOP agent in LAUNCH ASSESSMENT mode.

Evaluate ALL termination criteria from process/PRIME_SELF_LOOP_V2.md.
This is a read-only assessment. Do NOT modify code. Do NOT deploy.

ISSUE HEALTH:
  [ ] audits/issue-registry.json: count items where status != "resolved" and severity = "P0" → must be 0
  [ ] audits/issue-registry.json: count items where status != "resolved" and severity = "P1" → must be ≤ 3
  [ ] For each open P1: does it have a documented workaround? List them.

FEATURE COMPLETENESS:
  [ ] FEATURE_MATRIX.md: walk each persona's user story end-to-end
      Free User story complete?
      Individual story complete?
      Practitioner story complete?
      Admin story complete?
  [ ] docs/PRACTITIONER_LAUNCH_CHECKLIST.md: all items ✅?

CYCLE HEALTH:
  [ ] process/CYCLE_COUNTER.md: last 3 cycles all GREEN?
  [ ] process/SESSION_LOG_*.md: test count trend UP for last 3 cycles?
  [ ] process/SESSION_LOG_*.md: deploy success 100% for last 5 cycles?
  [ ] process/SESSION_LOG_*.md: zero regressions in last 3 cycles?

GATE CHECKS:
  [ ] Most recent audits/GATE_CHECK_*.md: verdict = LAUNCH or remediated?
  [ ] Most recent audits/BACKEND_GATE_CHECK_*.md: verdict = UNCONDITIONAL LAUNCH?
  [ ] Most recent audits/SYSTEM_AUDIT_*.md: P0 count = 0?

PRODUCTION VERIFICATION:
  [ ] curl https://prime-self-api.adrper79.workers.dev/api/health?full=1 → all green?
  [ ] https://selfprime.net loads without console errors?
  [ ] Registration → chart → profile flow works end-to-end?
  [ ] Stripe checkout creates valid session?

Output: audits/LAUNCH_READINESS_ASSESSMENT_[DATE].md

  Structure:
  - Checklist with ✅ or ❌ per criterion
  - Blockers (what prevents launch)
  - Risk register (open P1s with workarounds)
  - Estimated cycles to launch
  - VERDICT: READY / NOT READY / CONDITIONALLY READY
```

For a reusable workspace launch-readiness assessment that checks actual repository evidence and syncs concrete blockers into both `audits/issue-registry.json` and `MASTER_BACKLOG_SYSTEM_V2.md`, use:

- `.github/prompts/prime-self-launch-readiness.prompt.md`

---

## 🎪 Demo Readiness Prompt

For a reusable workspace demo-readiness assessment that is separate from true launch readiness, use:

- `.github/prompts/prime-self-demo-readiness.prompt.md`

Use this when you need to decide what is safe to show live, what requires prepared data, what should not be clicked, and how to script around known rough edges.

---

## 🎪 Pre-Investor Demo Prep

```
You are THE LOOP agent in DEMO PREP mode.

An investor demo is scheduled. The product must be flawless for the
specific flows that will be shown.

DEMO FLOWS TO VERIFY (modify this list for your demo):
  1. Landing page loads fast, looks professional, no console errors
  2. Registration → immediate chart generation → chart looks impressive
  3. Profile generation → AI output is personalized, no raw markdown artifacts
  4. Celebrity compare → search → match → share card renders
  5. Practitioner dashboard → add client → view their chart → session note
  6. Billing → tier comparison → checkout flow initiates
  7. Mobile responsive → all above flows work at 375px

FOR EACH DEMO FLOW:
  [ ] Walk through in a real browser (not just curl)
  [ ] Screenshot or record each step
  [ ] Note any: slow loads (>3s), visual glitches, confusing labels,
      placeholder text, broken images, error flashes, console warnings
  [ ] Note any flow where you'd say "ignore that" to the investor

KNOWN LIMITATIONS TO AVOID DURING DEMO:
  [ ] List features that are backend-only (no UI) — don't navigate there
  [ ] List features that are partially built — don't click those buttons
  [ ] List any endpoint that returns 500 — avoid triggering it

DEMO SCRIPT:
  Generate a step-by-step demo script with:
  - Exact URLs to visit (use https://selfprime.net)
  - Exact data to enter (use prepared test accounts, not live registration)
  - Talking points per screen
  - "Don't click" warnings for known rough edges

PRODUCTION HARDENING:
  [ ] Clear any test data that would look unprofessional
  [ ] Verify demo account exists with impressive chart data
  [ ] Verify celebrity database has recognizable names
  [ ] Verify practitioner directory has at least one profile

Output: docs/DEMO_SCRIPT_[DATE].md

Do NOT fix bugs in this mode (use Targeted Fix or Standard Cycle for that).
This mode IDENTIFIES what needs to look good and SCRIPTS around what doesn't.
```

---

## 🔄 Resume Interrupted Cycle

```
You are THE LOOP agent resuming an INTERRUPTED cycle.

FIND THE BREADCRUMB — check these in order:

  1. process/SESSION_LOG_[most recent date]_CYCLE_[N].md
     → If exists: read it to determine last completed phase.

  2. If no session log exists for current cycle:
     git log --oneline -10
     → Look for commits with cycle references (e.g., "feat: [BL-xxx]")
     → The most recent commit tells you what was last completed.

  3. If no commits reference the current cycle:
     git stash list
     → If stash exists with cycle reference, work was in progress.

  4. If none of the above yield info:
     process/CYCLE_COUNTER.md → tells you what cycle number you're on
     audits/issue-registry.json → check for items with today's date as resolvedAt
     These together reconstruct partial state.

RESUME LOGIC:

  If Phase 1 was in progress:
    → Restart Phase 1 (it's read-only, safe to re-run)

  If Phase 2 (Build) was interrupted:
    → git status: check for uncommitted changes
    → Review changed files — are they in a working state?
    → If yes: continue remaining selected items → Phase 3
    → If no: git checkout -- [broken files] and rebuild that item

  If Phase 3 (Verify & Deploy) was interrupted:
    → Re-run npm test (state may have changed)
    → Check: was deploy attempted? (wrangler deploy history or CF dashboard)
    → If deployed but not smoke-tested → run smoke tests
    → If not deployed → deploy now

  If Phase 4+ was interrupted:
    → Complete documentation updates
    → Finish discovery phase
    → Close session log

Do NOT start a new cycle. Resume the current one.
Append "[RESUMED]" to the session log header.
```

---

## 📝 Custom Cycle (Advanced)

```
You are THE LOOP agent in CUSTOM mode.

Execute a custom cycle with these modifications:

SKIP PHASES: [e.g., "Skip 1B, 1C, 1D"]
FOCUS AREAS: [e.g., "Practitioner features only" or "Security items only"]
CUSTOM CONSTRAINTS: [e.g., "No deploy — local testing only"]
SELECTION OVERRIDE: [e.g., "Build SYS-019, SYS-022, ACC-P2-1 specifically"]

Read process/PRIME_SELF_LOOP_V2.md for full phase specifications.
Execute non-skipped phases per spec with modifications above.

Log custom cycle parameters in session log header:
  ## Custom Cycle Parameters
  - Skipped: [phases]
  - Focus: [areas]
  - Constraints: [list]
  - Selection: [override items or "standard priority ladder"]
```

---

## 💡 Operational Guide

### Agent Compatibility

| Agent | Context Handling | Recommendation |
|-------|-----------------|----------------|
| **Claude Code** | Large context, filesystem access | Best for full Standard Cycles |
| **Claude Opus (chat)** | Large context, needs file uploads | Good for Audit-Only and Status Check |
| **GitHub Copilot** | Limited context, workspace access | Best for Targeted Fix; split Standard Cycles across sessions |
| **Any agent via API** | Varies | Include file contents inline if no filesystem access |

### Managing Long Cycles

For agents with limited context, split the cycle:

**Session 1:** Phase 1 (Intake & Consolidation)
- Run 1A-1E, produce the prioritized item list
- Save session log with Phase 1 results

**Session 2:** Phase 2 (Build) — one item at a time
- Start with: "Resume cycle [N]. Phase 1 complete. Selected items: [list]. Build item [first]."
- Repeat for each item if needed

**Session 3:** Phase 3-5 (Verify, Document, Discover)
- Start with: "Resume cycle [N]. All items built. Run Phase 3 through 5."

### Cycle Frequency Guide

| Situation | Recommended Mode | Frequency |
|-----------|-----------------|-----------|
| Active development | Standard Cycle | Daily |
| Bug reported by user | Regression Cycle | Immediately |
| Production down | Hotfix Cycle | Immediately |
| Health is RED | Cleanup Cycle | Until GREEN |
| Week start | Status Check | Monday morning |
| Pre-launch | Launch Readiness | Before any launch decision |
| Pre-demo | Demo Prep | Day before demo |
| No active work | Audit-Only | Weekly to prevent drift |

### Tracking Progress

After EVERY cycle, these must be updated:

| File | Updated By | Contains |
|------|-----------|----------|
| `process/CYCLE_COUNTER.md` | Phase 5D (Health Scorer) | Cycle number, date, health, test count |
| `audits/issue-registry.json` | Phase 4B (Registry Updater) | All issue statuses, resolution notes |
| `process/SESSION_LOG_*.md` | End of cycle | Complete work record |
| `FEATURE_MATRIX.md` | Phase 4A (Doc Updater) | Feature status changes |
| `MASTER_BACKLOG_SYSTEM_V2.md` | Phase 4B (Registry Updater) | Synced with registry |

### Running The Prompt Set

Workspace prompts currently available:

- `.github/prompts/prime-self-audit-sync.prompt.md`
- `.github/prompts/prime-self-practitioner-audit.prompt.md`
- `.github/prompts/prime-self-launch-readiness.prompt.md`
- `.github/prompts/prime-self-demo-readiness.prompt.md`
- `.github/prompts/prime-self-assessment-pack.prompt.md`

How to run all 4:

1. In VS Code chat, prompts are typically run one at a time.
2. If you want all four at once, the practical approach is to open 4 separate chat sessions and run one prompt in each.
3. If you want a single command experience, create a fifth orchestration prompt that tells the agent to execute the four assessments in sequence and return one combined report.
4. If you want the cleanest workflow today, run them in this order:
  - Audit Sync
  - Practitioner Audit
  - Launch Readiness
  - Demo Readiness

Single-command option now available:

- `.github/prompts/prime-self-assessment-pack.prompt.md`

Recommended note:

- Run the first two before the readiness prompts so newly discovered issues are already synchronized before launch or demo verdicts are computed.

---

## 📂 Related Files

| Document | Purpose |
|----------|---------|
| [PRIME_SELF_LOOP_V2.md](PRIME_SELF_LOOP_V2.md) | Full protocol specification |
| [CYCLE_COUNTER.md](CYCLE_COUNTER.md) | Cycle history + health trend |
| [../audits/issue-registry.json](../audits/issue-registry.json) | Machine-readable issue lifecycle |
| [../FEATURE_MATRIX.md](../FEATURE_MATRIX.md) | 57-feature inventory |
| [../MASTER_BACKLOG_SYSTEM_V2.md](../MASTER_BACKLOG_SYSTEM_V2.md) | System-organized work queue |
| [BUILD_BIBLE.md](BUILD_BIBLE.md) | Coding standards (the law) |
| [RELIABILITY_POLICY.md](RELIABILITY_POLICY.md) | Testing and verification policy |
| [LESSONS_LEARNED.md](LESSONS_LEARNED.md) | Institutional knowledge |
| [ERROR_DEBUGGING.md](ERROR_DEBUGGING.md) | Known failure patterns |

---

## 🎬 Quick Start

**First time using THE LOOP?**
1. Run **Status Check** to understand current state
2. Run **Audit-Only Cycle** to prime the issue registry
3. Run your first **Standard Cycle**

**Returning for a regular session?**
1. `cat process/CYCLE_COUNTER.md` — check current cycle + health
2. If health GREEN or YELLOW → **Standard Cycle**
3. If health RED → **Cleanup Cycle**
4. If user reported a bug → **Regression Cycle**

**Preparing for a milestone?**
1. Run **Launch Readiness Assessment**
2. Address blockers via **Standard** or **Targeted Fix** cycles
3. Run **Pre-Investor Demo Prep** the day before

---

**Good hunting. 🎯**
