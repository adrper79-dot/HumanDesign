# World-Class Market Remediation Issue Set (2026-03-18)

This issue set is designed for agentic execution and aligns to:
- PRODUCT_PRINCIPLES.md (especially Principles 4, 8, 9, 10)
- FEATURE_MATRIX.md (shipped capabilities first, no speculative rebuild)

Registry IDs added:
- WC-P0-1
- WC-P0-2
- WC-P0-3
- WC-P1-1
- WC-P1-2
- WC-P1-3
- WC-P1-4
- WC-P1-5
- WC-P2-1

## Agentic Flow Contract (applies to every issue)

1. Read issue object from audits/issue-registry.json.
2. Map issue to journey gate/job in PRODUCT_PRINCIPLES.md.
3. Validate no conflict with Non-Negotiables.
4. Implement smallest measurable slice first.
5. Add/adjust tests and telemetry checks.
6. Verify acceptance criteria from issue fields.
7. Update issue status + resolution note.

## Execution Order

1. WC-P0-1 (claim hygiene)
2. WC-P0-2 (referral trust contract)
3. WC-P0-3 (landing focus)
4. WC-P1-1 (practitioner-hosted client workflow v1)
5. WC-P1-2 (viral loop instrumentation)
6. WC-P1-3 (push activation)
7. WC-P1-5 (proof block)
8. WC-P1-4 (iOS wrapper plan)
9. WC-P2-1 (editorial engine)

## Practitioner Hosting Answer

Do we need to beef up the practitioner side to host clients?
- Yes, but as workflow hosting, not infrastructure hosting.
- Build client journey hosting inside existing practitioner surfaces (invites, lifecycle states, booking embed, branded handoff).
- Do not build arbitrary content hosting, custom tenant infra, or full white-label platform in this phase.

This is captured directly in WC-P1-1.

## Out-of-Scope for This Set

- Full native app rewrite.
- Full in-app social network/community platform.
- Full agency white-label platform with custom tenant infra.
- Net-new external payout provider integration in the first referral contract pass.
