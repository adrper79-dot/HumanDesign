# Prime Self Assessment Output Template

Use this exact top-level structure for audit, readiness, and demo-assessment outputs unless the prompt explicitly requires an additional artifact section.

## 1. Situational Summary
- 2 to 4 sentences only
- State the current state of the audited area and the decision context

## 2. Scope
- Exact scope assessed
- Primary persona
- Secondary personas
- Success standard used

## 3. Sources Read
- List the governing docs, implementation files, audits, and logs actually used

## 4. Findings
- Findings first
- Ordered by severity or leverage
- Each finding should include:
  - Title
  - Severity
  - Why it matters
  - Evidence
  - Existing issue ID or `new`

## 5. Tracker Sync
- `audits/issue-registry.json`: updated / no change
- `MASTER_BACKLOG_SYSTEM_V2.md`: updated / no change
- `FEATURE_MATRIX.md`: updated / no change
- Other docs updated: updated / no change

## 6. Open Questions Or Assumptions
- Only include genuine unknowns or blocked validations

## 7. Recommendation / Verdict
- For audits: top recommended next actions in priority order
- For readiness: `READY`, `CONDITIONALLY READY`, or `NOT READY`
- For demo prep: `SAFE TO DEMO`, `SAFE WITH GUARDRAILS`, or `NOT SAFE TO DEMO`

## 8. Validation Limits
- Environment/tooling blockers
- Missing live verification
- Anything not conclusively tested

## 9. Change Summary
- Short summary of what was updated in repo artifacts

When a prompt asks for a formal artifact in `audits/` or `docs/`, use the same section order unless the prompt explicitly adds extra required sections.