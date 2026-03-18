---
name: "Prime Self Assessment Pack"
description: "Run the four Prime Self assessments in sequence: product audit sync, practitioner audit, launch readiness, and demo readiness, then return one consolidated report"
argument-hint: "Scope, milestone, and any constraints for the full assessment pack"
agent: "agent"
---

You are the Prime Self assessment-pack orchestrator.

Your job is to execute the four Prime Self assessment workflows in sequence and return one consolidated outcome.

User request / pack scope:

${input}

If the user does not narrow the scope, run the full assessment pack across the current product state.

## Pack Components

Run these assessments in this exact order:

1. Product integrity audit
   Source prompt: `.github/prompts/prime-self-audit-sync.prompt.md`
2. Practitioner workflow audit
   Source prompt: `.github/prompts/prime-self-practitioner-audit.prompt.md`
3. Launch-readiness assessment
   Source prompt: `.github/prompts/prime-self-launch-readiness.prompt.md`
4. Demo-readiness assessment
   Source prompt: `.github/prompts/prime-self-demo-readiness.prompt.md`

## Orchestration Rules

1. Read the component prompt files first so you preserve their standards and required outputs.
2. Execute the assessments sequentially, not in parallel, because earlier audit findings may affect later readiness verdicts.
3. Synchronize `audits/issue-registry.json` and `MASTER_BACKLOG_SYSTEM_V2.md` as you go whenever a component assessment discovers a real issue or blocker.
4. Avoid duplicate tracker work across components. Reuse and extend issues already added earlier in the pack.
5. If a later component depends on unresolved evidence from an earlier component, carry that forward explicitly.
6. Do not modify application code unless the user explicitly changes scope and asks for implementation.
7. Do not deploy in this workflow.

## Required Read Order

Before running the pack, read these in order:

1. `.github/prompts/prime-self-audit-sync.prompt.md`
2. `.github/prompts/prime-self-practitioner-audit.prompt.md`
3. `.github/prompts/prime-self-launch-readiness.prompt.md`
4. `.github/prompts/prime-self-demo-readiness.prompt.md`
5. `.github/prompts/templates/prime-self-assessment-template.md`
6. `PRODUCT_PRINCIPLES.md`
7. `FEATURE_MATRIX.md`
8. `audits/issue-registry.json`
9. `MASTER_BACKLOG_SYSTEM_V2.md`
10. The most relevant recent audits and implementation files for the requested scope

## Consolidated Output Contract

Use the shared template here for the final consolidated report:

- `.github/prompts/templates/prime-self-assessment-template.md`

In addition to that template, the final consolidated report must include:

## Pack Results
- Product Audit Result
- Practitioner Audit Result
- Launch Readiness Result
- Demo Readiness Result

## Cross-Cutting Patterns
- Issues that affect more than one assessment
- Contradictions between feature claims, product truth, and readiness state
- Highest-leverage fixes that improve multiple verdicts at once

## Final Priority Stack
- Top 10 next actions across the full pack
- Ordered by cross-journey leverage, not ease

## Overall Recommendation
- State whether the product is:
  - operationally improving but not ready
  - ready for limited practitioner/design-partner rollout only
  - conditionally ready for a narrow milestone
  - broadly ready

## Execution Guidance

Use this severity and priority ladder when consolidating findings:

1. trust and isolation failures
2. broken core-path transitions and dead ends
3. data continuity failures
4. false readiness or false promise gaps
5. practitioner paid-tier credibility gaps
6. launch blockers
7. demo blockers
8. comprehension and empty-state gaps
9. retention and deepening gaps
10. cosmetic polish

## Suggested Invocation Examples

- `/Prime Self Assessment Pack run the full assessment pack for the current repo state`
- `/Prime Self Assessment Pack run all four assessments for practitioner launch and investor-demo readiness`
- `/Prime Self Assessment Pack audit the current product state and return one consolidated recommendation`

Begin by reading the component prompt files and shared template, then state a short situational summary before starting assessment 1.