# Prime Self — Feature-by-Feature Architecture Scan

**Date:** 2026-03-17  
**Inventory source:** `FEATURE_MATRIX.md` (62 features)  
**Framework:** `PRODUCT_PRINCIPLES.md`

---

## Purpose

This scan answers a simple product-architecture question:

> **Which features belong to the core operating spine of Prime Self, which should be sharpened, which should stay bounded, and which should be deprioritized because they add complexity faster than they add strategic value?**

This is not a code-quality audit. It is a **product architecture scan**.

Each feature is assigned one of four verdicts:

- **Core** — directly supports the product's essential journeys; should be protected and improved
- **Sharpen** — belongs in the product, but needs clearer UX, tighter scope, or stronger positioning
- **Bound** — keep it, but keep it tier-gated, secondary, or clearly subordinate to the core spine
- **Hold** — not a current differentiator; do not expand until the core is tighter

---

## Executive Read

### The core spine is clear

Prime Self is strongest when it acts as:
1. a verifiably accurate chart engine
2. a cross-system synthesis engine
3. a practitioner delivery system
4. a continuity layer between sessions and between readings

### The product weakens when it behaves like:
- a generic spirituality feature bundle
- a gamified consumer app with too many secondary loops
- a platform that exposes every capability at once instead of staging depth
- a system that builds distribution mechanics faster than it clarifies the primary value exchange

### The architectural answer

The right product shape is:
- **Core engine + synthesis + practitioner workflow** at the center
- **consumer discovery and tracking loops** as bounded support layers
- **admin, experimentation, and enterprise infrastructure** behind the scenes or held behind real demand

---

## Scoring Lens

Each verdict reflects these questions:
- Does it advance Journey A or Journey B directly?
- Does it strengthen the practitioner's economic moat?
- Does it improve synthesis, delivery, or continuity?
- Does it pass the "why it matters" test without requiring extra explanation?
- Does it reduce confusion, or add another branch in the product tree?

---

## Section 1 — Core Chart Calculation

### Core
- **Chart Calculation Engine (8 Layers)** — The sacred core. Everything else depends on it.
- **Geocoding (City to Coordinates)** — Essential input-friction remover for chart generation.

### Sharpen
- **Chart Auto-Save to History** — Valuable, but should remain secondary to first successful chart + synthesis.
- **Birth Time Rectification & Sensitivity Analysis** — Strong differentiator, but advanced; should be revealed only after core chart trust is established.
- **Composite & Synastry Charts** — Valuable for practitioner delivery; should stay clearly downstream of solo chart understanding.
- **Celebrity Matching** — Useful as an acquisition/share hook, but should not displace the personal reading as the first payoff.

---

## Section 2 — User Authentication & Management

### Core
- **Email & Password Registration/Login** — Foundational account entry.
- **Email Verification & Verification Resend** — Trust and account ownership.
- **Password Reset & Recovery** — Required continuity layer.
- **User Profile Management** — Important for settings, identity, and preference persistence.

### Sharpen
- **OAuth Social Login (Google & Apple)** — Valuable friction reducer, but should support account creation rather than become the product story.
- **2FA (TOTP) Setup & Verification** — Important for practitioners and admins, but should be presented as a trust upgrade, not a broad consumer-first feature.

---

## Section 3 — Profile Generation & Display

### Core
- **AI-Powered Prime Self Profile Generation** — Primary differentiated value delivery.
- **Profile Streaming (Real-Time SSE)** — Supports perceived responsiveness for the primary value path.
- **Profile Searches & Listing** — Supports continuity and re-access.

### Sharpen
- **PDF Export of Profiles** — Essential for practitioners; keep premium and professional. Needs to remain framed as delivery infrastructure, not just a download button.

---

## Section 4 — Transits & Timing

### Core
- **Real-Time Transit Positions** — Strong continuity layer after profile generation.
- **Transit Forecast (Multi-Day Outlook)** — Strong repeat-use feature.
- **Lifecycle Events (Saturn Return, Nodes Progression)** — Important long-arc contextual layer.

### Sharpen
- **Electional Astrology (Best Dates Tool)** — Valuable, but advanced. Should be positioned as a follow-on timing tool, not part of first-use complexity.
- **Transit Alerts (User-Configurable Notifications)** — Strong retention feature if tied to user goals, weak if pushed too early.

### Bound
- **Web Push Notifications** — Keep as a service layer to support transit/check-in continuity, not as a growth gimmick.
- **SMS Delivery (Telnyx Integration)** — Strong practitioner and high-intent continuity channel; keep premium and purpose-bound.

---

## Section 5 — Practitioner Tools

### Core
- **Practitioner Directory & Public Profiles** — Central to acquisition and trust.
- **Client Roster Management** — Core operating-system behavior.
- **Session Notes (Per-Client Documentation)** — Core continuity and prep feature.
- **Scheduling Embed in Client Workspace** — Strong session-readiness infrastructure.

### Sharpen
- **Referral Link & Rewards Program** — Useful growth layer, but it must remain subordinate to session success.
- **Practitioner Analytics Instrumentation** — Needed, but should track practitioner outcomes, not vanity metrics.
- **Client Activity Email Notifications** — Useful when tuned for trust and session readiness.
- **Practitioner Metrics Dashboard** — Keep tight; surface only metrics that affect practitioner behavior.
- **Client Reminder Email** — Good support layer if it advances real readiness.
- **Weekly Practitioner Digest Email** — Useful only if it helps the practitioner act, not if it becomes summary noise.

### Bound
- **Notion Integration (Client Sync)** — Useful for some practitioners, but not the core operating spine.
- **Client Clusters/Groups** — Valuable for later-stage practitioners/agencies, but not the default product center.
- **Agency/White-Label (Enterprise Tier)** — Keep bounded until practitioner-first execution is unmistakably tight.

---

## Section 6 — Billing & Subscriptions

### Core
- **Subscription Checkout (Stripe Integration)** — Required commercial path.
- **Billing Portal & Self-Service Management** — Required trust infrastructure.
- **Stripe Webhook Processing** — Essential invisible infrastructure.

### Sharpen
- **Subscription Cancellation & Pro-Rata Refunds** — Must behave clearly and honestly; this is commercial trust, not just billing logic.
- **Promotion Codes & Discounts** — Keep narrow; do not let discount logic become a product strategy substitute.

---

## Section 7 — Community & Sharing

### Sharpen
- **Share Chart with Social Media** — Good distribution layer if it points back to the practitioner's value or the user's next meaningful step.
- **Life Diary & Journal** — Strong continuity feature if it feeds synthesis or self-understanding clearly.
- **Behavioral Validation Data Anchoring** — Strategically important because it improves synthesis specificity.

### Bound
- **Check-In Routine (Daily Habit)** — Good retention layer, but only when clearly tied to guidance and not treated as a separate product.
- **Achievements & Badges** — Keep lightweight and secondary. Gamification cannot become the product narrative.
- **Statistics Dashboard (User Metrics)** — Useful only if it explains change in behavior, not just data accumulation.

### Hold
- **A/B Testing (Experiments Framework)** — Important operationally, but not something to expand while core positioning and journeys are still tightening.

---

## Section 8 — Integrations

### Core
- **Incoming Webhooks Router** — Required infrastructure for commercial and automation flows.
- **API Keys (Developer Access)** — Valuable for advanced users and agencies; strategically real, not decorative.
- **Embed Widget Validation & Feature Flags** — Important because the embed is a practitioner distribution surface.

### Bound
- **API Keys** should remain tied to real production use cases, not novelty developer marketing.
- **Embed Widget Validation** should remain invisible infrastructure, not a consumer-facing concept.

---

## Section 9 — Admin & Observability

### Core
- **Error Tracking & Alerting (Sentry)** — Reliability is product truth.

### Sharpen
- **Admin Dashboard & Metrics** — Keep focused on operational truth, not vanity reporting.
- **Bug Reporting (In-App)** — Useful only if it routes into a disciplined repair system and does not become a substitute for actual observability.

---

## Section 10 — Frontend UI Features

### Core
- **Responsive Chart Visualization** — Core comprehension surface.
- **Form Validation & Error Messages** — Core trust and friction control.
- **Onboarding Flow (Savannah Story)** — Important orientation layer when it is clearly named and correctly staged.

### Sharpen
- **Tabbed Navigation (Chart Tabs)** — Needs progressive disclosure discipline; too much exposure creates decision paralysis.
- **Responsive Sidebar Navigation** — Must reflect the active journey, not the entire feature inventory.
- **Modal Dialogs (Auth, Settings, Onboarding)** — Useful pattern, but should not become a dumping ground for workflow complexity.
- **i18n (Internationalization)** — Keep, but maintain canonical vocabulary and positioning consistency across locales.

### Hold
- **Dark Mode / Theme Toggle** — Not a current differentiator. Do not expand unless it solves an accessibility or usability problem.

---

## Full Verdict Inventory

### Core
- Chart Calculation Engine (8 Layers)
- Geocoding (City to Coordinates)
- Email & Password Registration/Login
- Email Verification & Verification Resend
- Password Reset & Recovery
- User Profile Management
- AI-Powered Prime Self Profile Generation
- Profile Streaming (Real-Time SSE)
- Profile Searches & Listing
- Real-Time Transit Positions
- Transit Forecast (Multi-Day Outlook)
- Lifecycle Events (Saturn Return, Nodes Progression)
- Practitioner Directory & Public Profiles
- Client Roster Management
- Session Notes (Per-Client Documentation)
- Scheduling Embed in Client Workspace
- Subscription Checkout (Stripe Integration)
- Billing Portal & Self-Service Management
- Stripe Webhook Processing
- Incoming Webhooks Router
- Error Tracking & Alerting (Sentry)
- Responsive Chart Visualization
- Form Validation & Error Messages
- Onboarding Flow (Savannah Story)

### Sharpen
- Chart Auto-Save to History
- OAuth Social Login (Google & Apple)
- 2FA (TOTP) Setup & Verification
- PDF Export of Profiles
- Electional Astrology (Best Dates Tool)
- Transit Alerts (User-Configurable Notifications)
- Referral Link & Rewards Program
- Practitioner Analytics Instrumentation
- Client Activity Email Notifications
- Practitioner Metrics Dashboard
- Client Reminder Email
- Weekly Practitioner Digest Email
- Subscription Cancellation & Pro-Rata Refunds
- Share Chart with Social Media
- Life Diary & Journal
- Behavioral Validation Data Anchoring
- Admin Dashboard & Metrics
- Bug Reporting (In-App)
- Tabbed Navigation (Chart Tabs)
- Responsive Sidebar Navigation
- Modal Dialogs (Auth, Settings, Onboarding)
- i18n (Internationalization)
- Birth Time Rectification & Sensitivity Analysis
- Composite & Synastry Charts (Relationship Analysis)
- Celebrity Matching

### Bound
- SMS Delivery (Telnyx Integration)
- Web Push Notifications
- Notion Integration (Client Sync)
- Client Clusters/Groups
- Agency/White-Label (Enterprise Tier)
- Promotion Codes & Discounts
- Check-In Routine (Daily Habit)
- Achievements & Badges
- Statistics Dashboard (User Metrics)
- API Keys (Developer Access)
- Embed Widget Validation & Feature Flags

### Hold
- A/B Testing (Experiments Framework)
- Dark Mode / Theme Toggle

---

## Architecture-Level Recommendations

### 1. Protect the core spine

The product should orient around this path:

**Chart → Understand → Synthesize → Deepen → Track → Work with a practitioner / deliver to a client**

Anything that distracts from this path should be delayed, hidden, bounded, or simplified.

### 2. Convert features into layers, not menus

The product has enough features. It does not yet always stage them correctly. The architecture should express layers:
- **Layer A:** immediate value (chart, profile, one next step)
- **Layer B:** depth (transits, assessments, diary, advanced reading)
- **Layer C:** delivery and operations (PDF, practitioner workspace, billing, admin)
- **Layer D:** expansion (agency, API, advanced integrations)

### 3. Measure the right thing

For the current phase, success is not raw consumer activity. Success is:
- practitioner activation
- practitioner deliverables generated
- chart-to-profile conversion
- assessment-to-synthesis completion
- directory/embed/referral-driven acquisition

### 4. Quarantine the noise

The current highest-risk noise clusters are:
- gamification without clear explanatory value
- dashboarding without behavior change
- enterprise capability ahead of practitioner tightness
- feature toggles and experimentation before messaging and journeys stabilize

Do not delete these blindly. Keep them out of the primary product story until the core spine is unmistakably strong.

---

## Bottom Line

**Prime Self does not need more breadth right now. It needs stronger sequencing, sharper explanation, and stricter hierarchy.**

The product is already deep enough. The winning move is not feature expansion. It is making the existing system feel inevitable: accurate first, meaningful second, professional third, expansive only after the first three are undeniably true.
