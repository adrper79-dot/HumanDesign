# Practitioner Implementation Backlog

Date: 2026-03-16
Source of truth: docs/PRACTITIONER_EXECUTION_ROADMAP_2026-03-16.md
Scope: P0 and P1 practitioner work, tied to current files and route handlers

---

## P0 Now

### PRAC-P0-01 — Lock Note Updates To Practitioner Ownership
Status: shipped in code
Problem: note updates were previously scoped only by `noteId`, which allowed a practitioner note mutation path without practitioner ownership in SQL.
Files:
- workers/src/handlers/session-notes.js
- workers/src/db/queries.js
Handlers / queries:
- `handleUpdateNote`
- `QUERIES.updateSessionNote`
Acceptance:
- update succeeds only when `noteId` belongs to the authenticated practitioner's roster
- cross-practitioner update attempt returns 404 or 403, never mutates data
Regression:
- tests/practitioner-runtime.test.js

### PRAC-P0-02 — Complete Invite Redemption Flow
Status: shipped in code
Problem: invitation creation existed, but acceptance was not wired into a real client workflow.
Files:
- workers/src/handlers/practitioner.js
- workers/src/db/queries.js
- workers/src/index.js
- frontend/js/app.js
Handlers / queries / routes:
- `handleGetInvitationDetails`
- `handleAcceptInvitation`
- `QUERIES.getPractitionerInvitationByTokenHash`
- `QUERIES.markPractitionerInvitationAccepted`
- `GET /api/invitations/practitioner?token=...`
- `POST /api/invitations/practitioner/accept`
Acceptance:
- invite link stored from `?invite=` and survives auth
- signed-in user can accept only when their email matches invite email
- successful acceptance adds client to `practitioner_clients`
- accepted or expired invites cannot be reused
Regression:
- tests/practitioner-runtime.test.js
Progress update:
- pending invitations can now be resent from the practitioner workspace, rotating to a fresh invite link and re-sending email when delivery is configured

### PRAC-P0-03 — Canonical Public Practitioner URL
Status: shipped in code
Problem: practitioner profile save path generated `/directory/<display_name>` while the public page lived at `/practitioners/:slug`.
Files:
- frontend/js/app.js
- frontend/functions/practitioners/[slug].js
Handlers / routes:
- `saveDirectoryProfile`
- `/practitioners/:slug`
Acceptance:
- saving a public profile returns a link to `/practitioners/<slug>`
- canonical practitioner page stays usable without a broken SPA redirect
- booking CTA remains available from the public page when configured

### PRAC-P0-04 — Remove Tier Naming Drift On Practitioner Upgrade Surface
Status: shipped in code
Problem: practitioner-facing upgrade copy still referenced the legacy Guide tier.
Files:
- frontend/index.html
Acceptance:
- practitioner lock notice uses `Practitioner` consistently
- upgrade CTA matches current billing language

### PRAC-P0-05 — Verify Practitioner Data Isolation End To End
Status: in progress
Problem: the most obvious note-update hole is fixed, but the practitioner surface still needs a deliberate isolation sweep.
Files:
- workers/src/handlers/practitioner.js
- workers/src/handlers/session-notes.js
- workers/src/handlers/practitioner-directory.js
- workers/src/handlers/pdf.js
- workers/src/handlers/notion.js
Queries / handlers to verify:
- `checkPractitionerAccess`
- `handleGetClientDetail`
- `handleDeleteNote`
- `handleGetAIContext`
- `handleUpdateAIContext`
- branded PDF export path for practitioner clients
Acceptance:
- every practitioner client route is either scoped by practitioner id or guarded by `checkPractitionerAccess`
- no client detail, note, export, or context route leaks across practitioners
Recommended implementation:
- add explicit isolation tests for client detail, delete note, AI context, and branded PDF routes
Progress update:
- session notes list/create and AI context get/update now enforce roster ownership in `workers/src/handlers/session-notes.js`
- note delete now fails closed with `404` when the note does not belong to the authenticated practitioner
- client detail access is verified through the practitioner router against non-roster clients
- branded PDF export remains guarded by `checkPractitionerAccess`
- Notion profile export now supports practitioner-safe export of roster client profiles instead of only the signed-in user's own profile
- automated coverage now includes non-roster note creation, AI context access, note deletion miss, client detail rejection, branded PDF export rejection, and expired invite handling

---

## P1 Next

### PRAC-P1-01 — Guided Practitioner Empty State
Status: in progress
Problem: the practitioner tab is functional but not self-guiding enough for first activation.
Files:
- frontend/index.html
- frontend/js/app.js
Primary functions:
- `loadRoster`
- practitioner tab rendering helpers
Build:
- first-run checklist
- empty-state CTA for first client
- direct path to directory profile setup
Acceptance:
- new practitioner can understand next action without documentation
Progress update:
- practitioner portal now renders an Activation Plan card with milestone progress and next-step guidance
- activation card is driven by real workspace state: directory profile readiness, client/invite presence, chart readiness, and session-ready client state
- Stripe billing success flow now preserves a one-time post-checkout destination and routes Practitioner/Agency users back into the practitioner workspace on app restore
- remaining gap is broader UX verification of the full checkout-return journey in the browser

### PRAC-P1-02 — Productize AI Context In Client Detail
Status: shipped in code
Problem: AI context existed in backend but was not surfaced as a practitioner-grade tool.
Files:
- frontend/js/app.js
- workers/src/handlers/session-notes.js
Routes:
- `GET /api/practitioner/clients/:id/ai-context`
- `PUT /api/practitioner/clients/:id/ai-context`
Build:
- editable AI context card in client detail
- clear explanation of how context affects later synthesis
Acceptance:
- practitioner can read and update client AI context from the same workspace as notes
Progress update:
- `frontend/js/app.js` now loads AI context into the practitioner client detail panel
- practitioners can save per-client AI context directly beside notes and chart/profile context
- the detail view now explains how AI context shapes future synthesis
- the client workspace now generates a deterministic post-session follow-up brief from the latest note, AI context, and synthesis state so session continuity turns into an explicit next action

### PRAC-P1-03 — Client Lifecycle States
Status: in progress
Problem: roster rows do not clearly show where a client is in the journey.
Files:
- workers/src/handlers/practitioner.js
- frontend/js/app.js
Build:
- invited
- account created
- chart generated
- profile generated
Acceptance:
- practitioner can identify next action per client at a glance
Progress update:
- roster query now includes latest client profile metadata in addition to chart metadata
- practitioner roster rows now render lifecycle badges and next-step guidance for needs-birth-data, needs-chart, needs-profile, and session-ready states
- session-ready clients now expose a direct branded PDF quick action from the roster

### PRAC-P1-04 — Directory Conversion Quality
Problem: directory listing exists but does not yet act like a strong acquisition funnel.
Files:
- frontend/js/app.js
- frontend/functions/practitioners/[slug].js
- workers/src/handlers/practitioner-directory.js
Build:
- profile preview quality improvements
- stronger directory card CTA
- visible booking path from listing or profile
Acceptance:
- user can go from directory card to live practitioner profile to booking without confusion
Progress update:
- directory cards now expose a canonical `View Profile` CTA into `/practitioners/:slug` instead of asking users to jump straight to booking
- in-card handoff copy now makes the profile preview → chart → booking path explicit while preserving direct booking for ready buyers
- deterministic coverage now verifies the public practitioner page keeps both the referral chart entry point and the direct booking CTA intact

### PRAC-P1-05 — Practitioner Regression Suite Expansion
Problem: practitioner revenue surfaces are under-tested relative to business importance.
Files:
- tests/practitioner-runtime.test.js
- tests/CHECKOUT_TEST_SUITE.md
- UI_TESTCASES.md
Build:
- route-level tests for client isolation and invite lifecycle
- deterministic acceptance coverage for public profile URL and directory profile save path
Acceptance:
- P0 practitioner trust regressions are covered by automated tests
Progress update:
- `tests/practitioner-runtime.test.js` now covers note update ownership, non-roster note creation, non-roster AI context access, note delete miss, client detail rejection, branded PDF roster isolation, invite resend, practitioner-safe Notion export, invite expiry handling, and invite acceptance constraints
- invite revoke is now covered explicitly, including practitioner-side revocation and revoked-token preview rejection

---

## Deferred Until Core Loop Is Stable

### PRAC-P2-01 — Deep Notion Value Prop
Keep only connect, status, sync-clients, export-profile until practitioner core loop proves retention.

### PRAC-P2-02 — Agency Expansion
Do not broaden self-serve agency promises until practitioner retention and support load are measurable.

### PRAC-P2-03 — White-Label Marketing Expansion
Do not market beyond the actual bounded agency/admin functionality already shipped.

---

## P2 Future Sprint — Practitioner Workflow Expansion

Deferred until P0 isolation sweep and P1 core loop are stable. All items below have existing infrastructure to build against. Build order is priority-ranked into three sprints.

---

### PRAC-P2-04 — Session Prep Brief
Status: not started
Problem: practitioners have no single pre-session view assembling all relevant client context. Chart, AI context, recent notes, and today's transits exist separately but are never surfaced together.
Files:
- workers/src/handlers/session-notes.js
- workers/src/db/queries.js
- frontend/js/app.js
Routes / handlers / queries:
- New: `GET /api/practitioner/clients/:clientId/prep-brief`
- Reuse: `listSessionNotes` (last 3), `getClientAIContext`, `getLatestProfile`, latest transit_snapshot from transit_snapshots table
- No new DB tables — pure aggregation of existing data
Build:
- Single handler running 4 parallel DB queries: last 3 notes, AI context, latest profile, latest transit snapshot
- Return composite JSON: { notes[], aiContext, profileSummary, transitSnapshot }
- Render as "Session Prep" card in practitioner client detail view
- Card sections: Today's Transits | AI Context | Last 3 Sessions | Chart Type reminder
Acceptance:
- Practitioner can open a client and see prep brief without navigating between tabs
- All 4 sections render gracefully when data is missing (empty states per section)
- Reflects client's most recent data at time of load

---

### PRAC-P2-05 — Client Intake Link
Status: not started
Problem: practitioners must manually enter client birth data. No self-service path exists for prospective clients to submit their own data and join a roster.
Files:
- workers/src/handlers/practitioner.js
- workers/src/db/queries.js
- frontend/functions/practitioners/[slug].js
- frontend/js/app.js
Routes / handlers / queries:
- New: `GET /practitioners/:slug/intake` — public intake form (Cloudflare Pages function)
- New: `POST /api/practitioner/intake/:slug` — validate birth data, create invitation record
- Reuse: practitioner_invitations table (migration 024), `sendPractitionerInvitationEmail()`, `parseToUTC()`, `isValidEmail()`
- Practitioner must have `is_public=true` and a valid `slug`
Build:
- Public intake form at `/practitioners/:slug/intake` — collects name, email, DOB, birth time, birth city
- On submit: validate birth data via parseToUTC, check for duplicate pending invite
- Auto-create invitation record with source='intake_link'
- Send confirmation email to prospect + notification to practitioner
- Prospect follows normal invite-accept flow to complete account creation
Acceptance:
- Form accessible without login at canonical slug URL
- Submitting valid data creates an invitation and sends confirmation to both parties
- Duplicate email submissions return informative error without creating duplicate records
- Invalid birth data returns inline form validation errors

---

### PRAC-P2-06 — Batch Invite (CSV Upload)
Status: not started
Problem: practitioners onboarding a new practice must invite clients one at a time. No bulk path exists.
Files:
- workers/src/handlers/practitioner.js
- workers/src/db/queries.js
- frontend/js/app.js
Routes / handlers / queries:
- New: `POST /api/practitioner/clients/batch-invite`
- Reuse: invite token generation (`makeInviteToken`, `sha256Hex`), `sendPractitionerInvitationEmail()`, practitioner_invitations table
Build:
- Accept multipart/form-data with CSV (columns: email, name — name optional)
- Parse CSV using string split (no external library — Workers runtime constraint)
- Validate each row: email format, not already in roster, not already pending invite
- For each valid row: create invitation record, send invite email
- Rate-limit email sends: 100ms gap between sends to respect Resend throughput limits
- Return summary: `{ sent: N, skipped: M, errors: [{ row, reason }] }`
- Cap batch at 100 rows per request to respect Workers 30s CPU limit
Acceptance:
- Valid CSV of 10 emails creates 10 invitation records and sends 10 emails
- Already-invited emails skipped with reason in errors array
- Malformed rows (bad email format) skipped and reported, do not abort batch
- Response always returns summary even if some rows fail

---

### PRAC-P2-07 — Transit Alerts for Clients
Status: not started
Problem: alert system is user-scoped only. Practitioners have no visibility into client transit events and cannot set monitoring on behalf of clients.
Files:
- workers/src/handlers/alerts.js
- workers/src/cron.js
- workers/src/db/queries.js
- workers/src/db/migrations/ (new migration required)
Routes / handlers / queries:
- New migration: `042_alert_client_scoping.sql` — ADD COLUMN client_id UUID REFERENCES users(id) NULLABLE to transit_alerts
- New: `POST /api/practitioner/clients/:clientId/alerts`
- New: `GET /api/practitioner/clients/:clientId/alerts`
- Extend: existing PUT/DELETE alert routes — add practitioner ownership check via `checkPractitionerAccess()`
- Extend: `evaluateUserAlerts()` in cron.js to evaluate client-scoped alerts using the client's chart
Build:
- Migration adds nullable client_id column; all existing alerts (client_id=NULL) are unaffected
- New practitioner routes create/list alerts scoped to a specific client
- `checkPractitionerAccess()` guard on all new routes
- Cron: extend evaluation loop to run client-scoped alerts against client's transit data (not practitioner's)
- Alert delivery target: practitioner receives the notification (they are the subscriber)
- Alert config reuses existing format (gate_number, planet, threshold) and template system
Acceptance:
- Practitioner can create a transit alert for a client and receive push/email when client's gate activates
- Client-scoped alerts do not appear in the client's own alert list
- Cron evaluates using client's natal chart, not practitioner's chart
- Backward compat: existing user-scoped alerts (client_id=NULL) continue to work unchanged

---

### PRAC-P2-08 — Calendly Webhook Integration
Status: not started
Problem: session bookings in Calendly are invisible to Prime Self. Practitioners must manually create session note stubs after every booking.
Files:
- workers/src/handlers/webhooks.js
- workers/src/handlers/session-notes.js
- workers/src/db/queries.js
- workers/src/index.js
Routes / handlers / queries:
- New: `POST /api/webhooks/calendly` — public endpoint, HMAC-SHA256 signature verification required
- New Worker secret: `CALENDLY_WEBHOOK_SECRET`
- New query: `getPractitionerByEmail()` — reverse-lookup practitioner from Calendly account email
- New query: `getClientByEmailForPractitioner()` — find client in roster by invitee email
- Reuse: session note create logic from session-notes.js
Build:
- Public webhook endpoint for Calendly `invitee.created` events
- Verify HMAC-SHA256 signature using CALENDLY_WEBHOOK_SECRET — reject unsigned requests with 400
- Parse payload: `{ event.uri, event_type.name, invitee.email, invitee.name, event.start_time }`
- Reverse-lookup: find practitioner by their Calendly-associated email → find client by invitee email in roster
- If client found: auto-create session note stub (content="Calendly booking: {event_type} on {date}", session_date=event.start_time, share_with_ai=false)
- If client not found: log unmatched booking, return 200 (do not cause Calendly to retry)
- Idempotency: store Calendly event URI in note metadata to prevent duplicate stubs on webhook retry
- Practitioner settings UI: page to paste Calendly webhook URL and secret
Acceptance:
- Booking in Calendly auto-creates a session note stub in correct client's timeline within 5 seconds
- Unsigned or tampered webhook requests return 400 immediately
- Duplicate webhook deliveries do not create duplicate notes
- Unmatched invitee email logs warning but returns 200 to prevent Calendly retry loop

---

### PRAC-P2-09 — Session Summary Export
Status: not started
Problem: after a session, practitioners have no way to produce a professional branded artifact to send to the client. Notes, chart context, and transit snapshots exist but are never combined into a deliverable.
Files:
- workers/src/handlers/pdf.js
- workers/src/handlers/session-notes.js
- workers/src/lib/email.js
- workers/src/db/queries.js
- frontend/js/app.js
Routes / handlers / queries:
- New: `POST /api/practitioner/clients/:clientId/notes/:noteId/export`
- Reuse: `handleBrandedPdfExport()` pattern from pdf.js, `getPractitionerBranding()` query, `sendEmail()` from lib/email.js, R2 storage key pattern
Build:
- Endpoint fetches note by ID (ownership check), latest profile, chart hd_json, transit_snapshot from note or latest global snapshot
- Generate branded PDF with 4 sections: Session Notes | Chart Summary | Transit Context at Session | About Your Practitioner
- R2 cache key: `pdfs/session/{practitionerId}/{noteId}.pdf`
- Optional body param `send_to_client: true` triggers email to client's registered address with PDF attached via Resend
- Frontend: "Export Summary" button on each session note in client detail view
Acceptance:
- Practitioner can export any session note as a branded PDF with practitioner name/website in header
- PDF includes note content, chart type/profile line, and transit context from session date
- Email option delivers PDF attachment to client's registered email
- Re-exporting the same unedited note returns the cached R2 PDF without regenerating

---

### PRAC-P2-10 — Weekly Client Digest Email
Status: not started
Problem: practitioners have no proactive visibility into what's happening in their clients' charts. They must manually open each client to check transits.
Files:
- workers/src/cron.js
- workers/src/lib/email.js
- workers/src/db/queries.js
- workers/src/db/migrations/ (new column)
Routes / handlers / queries:
- New migration: add `weekly_digest_enabled BOOLEAN DEFAULT false` to practitioners table
- New cron step in cron.js: runs Mondays only (`if (dayOfWeek === 1)`)
- New query: `cronGetPractitionerDigestSubscribers()` — fetch practitioners with weekly_digest_enabled=true
- New query: `getPractitionerClientsWithTransits()` — batch fetch all clients + their notable transit gates for the week (single query, no N+1)
- New email template: `sendWeeklyClientDigestEmail()` in lib/email.js
Build:
- Monday-only cron step: fetch opted-in practitioners, batch-fetch all client transits per practitioner in one query
- Notable transit criteria: gate activations matching client's defined channels, or major planetary ingresses
- Email template: per-client section showing name, chart type, 2-3 notable transits with plain-language descriptions
- Opt-in toggle in practitioner settings panel: "Weekly client digest (every Monday)"
- Send at 8 AM in practitioner's stored timezone; fall back to UTC
Acceptance:
- Opted-in practitioners receive digest every Monday
- Each client section shows 2-3 most notable transits for the week
- Practitioners with empty rosters or zero notable transits receive minimal digest, not an error
- Opt-out immediately suppresses future sends

---

### PRAC-P2-11 — Practitioner Referral Link
Status: not started
Problem: practitioners with public profiles are organic growth channels but sign-ups via `/practitioners/:slug` carry no referral attribution and generate no reward for the practitioner.
Files:
- workers/src/handlers/referrals.js
- workers/src/handlers/practitioner-directory.js
- frontend/functions/practitioners/[slug].js
- frontend/js/app.js
- workers/src/db/queries.js
Routes / handlers / queries:
- New query: `getOrCreatePractitionerReferralCode()` — generate or return stable referral code tied to slug (format: `PRAC-{slug}`)
- Extend: `GET /api/directory/:slug` — include `referral_code` field in response
- Extend: practitioner public profile page — inject `?ref=PRAC-{slug}` into all signup and CTA links
- Reuse: existing referral signup attribution in auth handler, `markReferralAsConverted()`, Stripe credit issuance
Build:
- On first public profile load or directory save: generate `PRAC-{slug}` referral code and store in referrals table
- Inject referral code into all "Sign up" and "Get your chart" CTAs on `/practitioners/:slug` page
- When user registers with `?ref=PRAC-{slug}`: look up practitioner by slug, create referral record with referrer_user_id=practitioner's user_id
- Existing 25% recurring Stripe credit logic applies automatically via markReferralAsConverted()
- Practitioner dashboard shows referred-user count and conversion status
Acceptance:
- Every public practitioner profile page has at least one CTA with referral code pre-populated
- Sign-ups from practitioner profiles credit that practitioner with 25% recurring Stripe balance credit
- Practitioner can see referred-user count in their dashboard
- Existing PRIME-xxx referral codes are unaffected

---

### PRAC-P2-12 — Compatibility Pre-Screening
Status: not started
Problem: practitioners cannot quickly assess energetic compatibility with a prospective client without first adding them to the roster.
Files:
- workers/src/handlers/composite.js
- workers/src/lib/cache.js
- workers/src/db/queries.js
- frontend/js/app.js
Routes / handlers / queries:
- New: `POST /api/practitioner/screen/compatibility`
- Reuse: composite calculation logic from composite.js (`calculateFullChart()`, CHANNELS array, channel analysis)
- Reuse: `kvCache` with TTL.CHART for result caching
Build:
- Endpoint accepts prospective client birth data in body (date, time, city)
- Fetch practitioner's own natal chart from DB by authenticated user ID (no re-entry required)
- Run composite calculation: electromagnetic, dominance, compromise channels
- Return lightweight summary: { compatibilityType, activatedChannels[], compatibilityScore, forgeReading }
- compatibilityScore: linear scale from channel count (0 channels → 0, 5+ channels → 100)
- Do NOT save any data to DB — read-only, ephemeral operation
- KV cache key: `compat-screen:{practitionerChartId}:{hash(prospectBirthData)}`, TTL = 1 hour
- Frontend: "Pre-screen" button in practitioner dashboard → modal with birth data form → results card
- Results card clearly labelled "Screening — not saved" to distinguish from full composite reading
Acceptance:
- Practitioner can run compatibility screen in under 2 seconds on cache miss
- Result is not persisted and does not appear on any account
- Running same prospect twice within 1 hour returns instant cached result
- Result card clearly distinguishes this from a full composite reading

---

### PRAC-P2-13 — Client Progress Timeline
Status: not started
Problem: session history is a flat list. Practitioners cannot see a client's full journey at a glance — when they joined, when they got their chart, when key sessions happened.
Files:
- frontend/js/app.js
- workers/src/handlers/session-notes.js
- workers/src/db/queries.js
Routes / handlers / queries:
- New: `GET /api/practitioner/clients/:clientId/timeline`
- New query: `getClientTimeline()` — aggregate session notes + chart creation + profile creation + invitation acceptance into unified event list ordered by date ASC
- Event shape: `{ type, date, title, summary }` where type is one of: 'joined' | 'chart_generated' | 'profile_generated' | 'session_note'
Build:
- Backend: single aggregation query across session_notes, profiles, charts, practitioner_invitations tables
- For session_note events: include first 150 chars of content as summary
- Frontend: vertical timeline component in client detail tab (pure HTML/CSS, no new library)
- Milestones (joined, chart, profile) use distinct icons/colors from session notes
- Click session note entry → expand full note inline
- Pagination: offset/limit query params; "Load more" control for clients with 50+ sessions
Acceptance:
- Timeline shows at minimum: when client joined, when chart was generated, and all session notes in order
- Milestones are visually distinct from session entries
- Clicking a session note entry expands full content inline without navigating away
- Renders correctly with 0 session notes (milestones only)
- Large clients (50+ sessions) paginate gracefully

---

## Recommended Build Order

1. Finish the remaining P0 data-isolation sweep.
2. Ship guided practitioner onboarding and empty states.
3. Add AI context UI in client detail.
4. Add client lifecycle states and quick actions.
5. Improve directory conversion quality.
6. Expand regression coverage before broad practitioner rollout.
7. **P2 Sprint A — Core Workflow (highest value, lowest effort):**
   - PRAC-P2-04 Session Prep Brief
   - PRAC-P2-05 Client Intake Link
   - PRAC-P2-13 Client Progress Timeline
   - PRAC-P2-11 Practitioner Referral Link
8. **P2 Sprint B — Delivery & Automation:**
   - PRAC-P2-09 Session Summary Export
   - PRAC-P2-06 Batch Invite CSV
   - PRAC-P2-12 Compatibility Pre-Screening
9. **P2 Sprint C — Intelligence & Integrations (schema changes required):**
   - PRAC-P2-10 Weekly Client Digest Email
   - PRAC-P2-07 Transit Alerts for Clients
   - PRAC-P2-08 Calendly Webhook Integration
