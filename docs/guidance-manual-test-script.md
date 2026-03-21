# Guidance Manual Test Script

Use this deterministic script after guidance-related shell or copy changes.

## Preconditions

- Start from a clean browser session.
- Use one fresh personal-user flow and one practitioner flow.
- If needed, clear the journey keys used by the shell state machine:
  - `chartGenerated`
  - `profileGenerated`
  - first-run onboarding state

## Flow 1: First-Time Personal User

1. Open Overview.
2. Confirm the page still explains that the chart is the starting point.
3. Open Chart.
4. Confirm the shared journey guide is visible.
5. Confirm Chart still shows:
   - orientation
   - why the chart matters
   - a visible next step
6. Generate a chart.
7. Confirm the shell no longer shows stale pre-chart messaging.
8. Open Profile.
9. Confirm Profile guidance explains why synthesis comes after the chart.
10. Confirm a visible next step points toward generating the profile.

## Flow 2: Returning Personal User

1. Use a state with chart and profile already generated.
2. Open Chart, Profile, and Transits.
3. Confirm guidance is compressed compared with first-time state.
4. Confirm deeper explanation is still reachable.
5. Confirm the shared journey guide remains visible on the core path.
6. Confirm Transits points toward Check-In rather than showing generic placeholder copy.

## Flow 3: Practitioner User

1. Sign in as a practitioner-tier account.
2. Open Overview and Practitioner.
3. Confirm the shell and practitioner surfaces use workflow-first language.
4. Confirm the next action is operational, not promotional.
5. If setup is already in motion, confirm the checklist is compressed behind disclosure while the next step remains visible.
6. If setup is fresh, confirm the full activation checklist is still visible.

## Flow 4: Relationship And Tracking Path

1. Open Composite.
2. Confirm the shell explains what comparison is for and what to do next.
3. Open Check-In.
4. Confirm the shell explains pattern tracking and gives one concrete logging action.
5. Save a check-in.
6. Confirm the next-step guidance updates away from the empty-state instruction.

## Pass Criteria

- Every touched workflow answers what this section is, why it matters, and what to do next.
- No visible guidance block is obviously stale after a milestone change.
- Practitioner guidance remains operational.
- The chart -> profile -> transits path is still obvious without needing repo archaeology.