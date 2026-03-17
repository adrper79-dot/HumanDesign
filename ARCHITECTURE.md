# Prime Self — System Architecture

## 1. Vision

**Prime Self** is a movement-first platform that delivers a proprietary personal-development philosophy—grounded in Energy Blueprint patterns, Western Astrology (Astro), and the Prime Self Forge framework—through a serverless, API-first technology stack.

The technology exists to serve the philosophy. Every architectural decision flows from one constraint: *the calculation must be verifiably accurate, the interpretation must be honestly grounded, and the philosophy must be faithfully delivered.*

> **Companion document:** [PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md) defines the product-level design principles, user journeys, fitness test, and canonical vocabulary that govern every build decision. Architecture decisions flow from product principles — read both together.

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                 │
│   Web App  ·  SMS (Telnyx)  ·  Practitioner Dashboard  ·  API      │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS / WebSocket
┌────────────────────────────▼────────────────────────────────────────┐
│                   CLOUDFLARE WORKERS (Edge)                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │  API Gateway  │  │  Auth Worker  │  │  Transit Cron (Scheduled) │ │
│  └──────┬───────┘  └──────────────┘  └───────────────────────────┘ │
│         │                                                           │
│  ┌──────▼──────────────────────────────────────────────────────┐   │
│  │              CALCULATION ENGINE (Pure JS)                    │   │
│  │  Layer 1: Julian Day Number                                 │   │
│  │  Layer 2: Planetary Positions (11 planets + nodes + Chiron)  │   │
│  │  Layer 3: Design Side (-88 day offset)                      │   │
│  │  Layer 4: Gate/Line Lookup (I Ching wheel mapping)          │   │
│  │  Layer 5: Centers / Channels / Type / Authority / Profile   │   │
│  │  Layer 6: Astrology (signs, houses, aspects)                │   │
│  │  Layer 7: Transit Engine (current positions overlay)        │   │
│  └──────┬──────────────────────────────────────────────────────┘   │
│         │                                                           │
│  ┌──────▼──────────────────────────────────────────────────────┐   │
│  │            REASONING / SYNTHESIS LAYER                       │   │
│  │  Layer 8: Prime Self Profile Synthesis                       │   │
│  │  • Receives 3 clean JSON streams (HD, Astro, Transits)      │   │
│  │  • RAG injection from knowledgebase                          │   │
│  │  • Contextual cross-system reasoning                         │   │
│  │  • Grounding audit on every claim                            │   │
│  └──────┬──────────────────────────────────────────────────────┘   │
│         │                                                           │
└─────────┼───────────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────────────┐
│                       DATA LAYER                                     │
│                                                                      │
│  ┌─────────────┐  ┌─────────────────┐  ┌────────────────────────┐  │
│  │  Neon (PostgreSQL) │ │  KV (Cloudflare) │ │  R2 (Object Storage) │ │
│  │  User charts │  │  Session cache    │  │  Generated PDFs       │  │
│  │  Practitioner│  │  Transit cache    │  │  Knowledgebase corpus │  │
│  │  Clusters    │  │  Rate limiting    │  │  Savannah narrative   │  │
│  └─────────────┘  └─────────────────┘  └────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| **Runtime** | Cloudflare Workers (V8 isolates) | Edge-first, zero cold start, aligns with The Factory |
| **Database** | Neon (PostgreSQL) | Already provisioned, serverless Postgres, branching for dev |
| **Cache / KV** | Cloudflare KV | Transit position caching, session state, daily ceiling counters (RATE_LIMIT_KV) |
| **Object Store** | Cloudflare R2 | PDF exports, knowledgebase corpus files |
| **SMS / Voice** | Telnyx | Daily transit digests, appointment reminders |
| **LLM – Reasoning** | claude-opus-4-20250514 → grok-4-fast → llama-3.3-70b-versatile | Deep synthesis, Prime Self profile generation (3-provider failover with 2-retry on Anthropic) |
| **LLM – Structured** | claude-sonnet-4-20250514 → grok-3-mini-latest → llama-3.1-70b-versatile | Chart reading generation, JSON schema adherence |
| **LLM – High Volume** | claude-3-haiku-20240307 → grok-3-mini-latest → llama-3.1-8b-instant | Daily SMS transit digests |
| **Calculation** | Pure JS (Jean Meeus algorithms) | No WASM, no external deps, runs natively in Workers |
| **AI Gateway** | Cloudflare AI Gateway | Rate limiting, caching, model routing, observability |

### 3.1 Deployment Constraint (Cloudflare Plan Dependency)

- The production Worker bundle is approximately `2.27 MB` uncompressed (`wrangler deploy --dry-run`), with transport gzip around `533 KB`.
- Cloudflare Workers **Free** tier has a `1 MB` script-size limit and cannot deploy this bundle.
- Cloudflare Workers **Paid** plan (Bundled/Unbound) supports this bundle (`10 MB` limit).
- This is a hard infrastructure dependency: if billing lapses or the account is downgraded, deployments will fail with script-size errors until the plan is restored or the bundle is reduced.

---

## 4. Calculation Engine — The 8 Core Layers

Each core layer is an independent, testable JS module. Layers build on each other sequentially. Supporting interpretation modules such as numerology, Gene Keys, Vedic, and Ogham live alongside the core engine rather than replacing the 8-layer flow. Every layer is verified against the **AP Test Vector** before moving forward.

### AP Test Vector (Verification Anchor)
```
Name:       AP
Birth Date: August 5, 1979
Birth Time: 18:51 EDT (22:51 UTC)
Location:   Tampa, Florida, USA
Lat/Lng:    27.9506° N, 82.4572° W

Known Outputs:
  Pattern:        Guide (Oracle Pattern)
  Life Role:      6/2 (Role Model / Hermit)
  Connection:     Split (Bridging Pattern)
  Decision Style: Emotional Wave Navigation
  Strategy:       Wait for Recognition
  Not-Self:       Bitterness
  Purpose Vector: Left Angle Cross of Refinement (33/19 | 2/1)

  Personality Sun:  Gate 33, Line 6
  Design Sun:       Gate 2, Line 2
```

### Layer Descriptions

| Layer | Module | Input | Output | Failure Mode |
|-------|--------|-------|--------|-------------|
| **1** | `julian.js` | year, month, day, hour, minute (UTC) | Julian Day Number | Wrong epoch, calendar boundary |
| **2** | `planets.js` | JDN | 11 planet longitudes + nodes (0–360°) incl. Chiron | Wrong constants, coordinate error |
| **3** | `design.js` | Birth JDN | Design-side JDN (-88 days), Design planet positions | Incorrect solar arc offset |
| **4** | `gates.js` | Longitude (0–360°) | Gate number (1–64), Line number (1–6) | Wrong lookup table mapping |
| **5** | `chart.js` | All gates (conscious + unconscious) | Centers, channels, type, authority, profile, cross | Logic errors in center activation |
| **6** | `astro.js` | Planet longitudes + lat/lng | Signs, houses, aspects | House system ambiguity, orb tolerance |
| **7** | `transits.js` | Current date/time | Transit positions, activated HD gates, notable aspects | Timezone errors |
| **8** | `synthesis.js` | HD JSON + Astro JSON + Transit JSON + KB | Prime Self Profile | Hallucination, ungrounded claims |

---

## 5. Data Architecture

### 5.1 Three Separate Data Streams (Never Merged at Data Layer)

```json
{
  "energyBlueprint": {
    "pattern": "Guide",
    "strategy": "Wait for Recognition",
    "decisionStyle": "Emotional Wave Navigation",
    "lifeRole": "6/2",
    "connectionPattern": "Split (Bridging)",
    "notSelf": "Bitterness",
    "definedCenters": ["Throat", "G", "SolarPlexus", "Root"],
    "undefinedCenters": ["Head", "Ajna", "Sacral", "Spleen", "Heart"],
    "geneKeys": {
      "conscious": { "sun": {"gate":33,"line":6}, "earth": {"gate":19,"line":6}, "...": "..." },
      "unconscious": { "sun": {"gate":2,"line":2}, "earth": {"gate":1,"line":2}, "...": "..." }
    },
    "channels": ["33-13", "19-49"],
    "cross": { "name": "Left Angle Cross of Refinement", "gates": [33,19,2,1] }
  },
  "astro": {
    "natal": {
      "sun": { "sign": "Leo", "degrees": 12.85, "house": 10 },
      "moon": { "sign": "Aquarius", "degrees": "...", "house": 4 }
    },
    "aspects": [
      { "planet1": "Sun", "planet2": "Moon", "type": "opposition", "orb": 2.3 }
    ]
  },
  "transits": {
    "date": "2026-03-02",
    "positions": { "sun": { "longitude": 341.5, "gate": 22, "line": 3 } },
    "activatedHDGates": [22, 36, 55],
    "notableAspects": [
      { "transitPlanet": "Saturn", "natalPlanet": "Sun", "type": "square", "orb": 1.1 }
    ]
  }
}
```

### 5.2 Knowledgebase (RAG Corpus) — Separated by System

> **Sprint 19 Update**: All files marked with ✅ are injected into Cloudflare Workers via `workers/src/engine-compat.js` and available at runtime in `globalThis.__PRIME_DATA.kb[key]`.

```
src/knowledgebase/
  hd/
    ✅ gates.json          64 gates — original content derived from I Ching (Legge)
    ✅ channels.json       36 channels — synthesized from gate pair descriptions
    ✅ centers.json        9 centers — biological/energetic function
    ✅ crosses.json        192 purpose vectors — synthesized from component gene keys
    ✅ types.json          5 types — structural descriptions
    ✅ profiles.json       12 profiles — line combination descriptions
  astro/
    ✅ signs.json          12 zodiac signs
    ✅ planets.json        10 planets + nodes
    ✅ aspects.json        Major aspects and orb definitions
    ✅ houses.json         12 houses
  prime_self/
    ✅ forges_canonical.json       5 Forges — canonical: Initiation, Mastery, Guidance, Perception, Transformation (aliases: Chronos, Eros, Aether, Lux, Phoenix)
    ✅ knowledges_canonical.json   6 Knowledges — canonical: Sciences, Arts, Defenses, Heresies, Connections, Mysteries
    ✅ sciences_canonical.json     6 Sciences (Mindfulness, Alchemy, Divination, Astrology, Reiki, Behavioral)
    ✅ arts_canonical.json         6 Arts (Aromatherapy, Semiotics, Quantum Mind, Crystallography, etc.)
    ✅ defenses_canonical.json     6 Defenses (Reflexology, Acupressure, Chromotherapy, etc.)
       heresies_canonical.json     6 Heresies (shadow powers with warnings)
    ✅ historical_figures.json     48 figures organized by Forge/Line with life lessons
    ✅ book_recommendations.json   60+ books by Type, Forge, Knowledge, Need
  combined/
    (nearly empty at launch — add only VERIFIED cross-system correlations)
```

### 5.3 Neon Database Schema

> **48 tables · 1 materialized view · 8 views · 4 functions · 1 active trigger**
>
> Live-verified 2026-06-25 via `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'` → **48**.
> `usage_tracking` (defined in migration 003) was never materialized in production — all other
> migration-defined tables are present.
>
> Base schema in `workers/src/db/migrate.sql`. Numbered migrations in `workers/src/db/migrations/`.
> Applied via `npm run migrate` which tracks each migration in `schema_migrations`.
> **39 migration files (000–041)** currently on disk. All applied to production DB.

#### Base Schema (`migrate.sql`) — 18 tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `schema_migrations` | Migration tracking | `migration_name TEXT UNIQUE`, `checksum TEXT` |
| `users` | User accounts | `id UUID PK`, `email`, `phone`, `birth_date/time/tz/lat/lng`, `stripe_customer_id`, `referral_code`, `tier` |
| `charts` | Cached HD+Astro calculations | `user_id FK→users`, `hd_json JSONB`, `astro_json JSONB` |
| `profiles` | Generated Prime Self readings | `user_id`, `chart_id`, `profile_json JSONB`, `model_used`, `grounding_audit JSONB` |
| `transit_snapshots` | Daily cron transit snapshots | `snapshot_date DATE UNIQUE`, `positions_json JSONB` |
| `practitioners` | Practitioner accounts | `user_id UNIQUE FK→users`, `certified`, `tier` |
| `practitioner_clients` | Practitioner↔client roster | CPK(`practitioner_id`, `client_user_id`) |
| `clusters` | Forge cluster sessions | `name`, `created_by FK→users`, `challenge` |
| `cluster_members` | Cluster membership | CPK(`cluster_id`, `user_id`), `forge_role` |
| `sms_messages` | SMS conversation log | `user_id`, `direction CHECK(inbound/outbound)`, `body` |
| `validation_data` | User self-assessment data | `user_id UNIQUE`, `decision_pattern`, `energy_pattern`, `current_focus` |
| `psychometric_data` | Big Five / VIA scores | `user_id UNIQUE`, `big_five_scores JSONB`, `via_strengths JSONB` |
| `diary_entries` | Life event diary | `user_id`, `event_date`, `event_type`, `transit_snapshot JSONB` |
| `subscriptions` | Stripe subscription state | `user_id UNIQUE`, `stripe_subscription_id UNIQUE`, `tier`, `status` |
| `payment_events` | Stripe webhook events | `subscription_id FK`, `stripe_event_id UNIQUE`, `amount`, `raw_event JSONB` |
| `usage_records` | Per-request usage log | `user_id`, `action`, `endpoint`, `quota_cost` |
| `share_events` | Social sharing events | `user_id`, `share_type`, `platform`, `share_data JSONB` |
| `refresh_tokens` | JWT refresh token families | `user_id`, `token_hash UNIQUE`, `family_id UUID`, `expires_at` |

#### Migration 003 — Billing (`003_billing.sql`) — 4 tables + 3 views

| Table | Purpose |
|-------|---------|
| `invoices` | Stripe invoice records (`stripe_invoice_id UNIQUE`, `amount_paid`, `status`) |
| `usage_tracking` | Feature usage counters per billing period — **⚠️ not materialized in production** |
| `promo_codes` | Discount codes with Stripe sync |
| `referrals` | Referral tracking (`referrer_user_id`, `referred_user_id`, `converted`) |

Views: `subscription_analytics`, `monthly_revenue`, `user_subscription_status`

#### Migration 004 — Achievements (`004_achievements.sql`) — 4 tables + 3 views

| Table | Purpose |
|-------|---------|
| `user_achievements` | Unlocked achievements with points |
| `achievement_events` | Raw event stream for achievement evaluation |
| `user_streaks` | Daily login / transit checked streaks |
| `user_achievement_stats` | Aggregated points & percentages (trigger-maintained) |

Views: `achievement_popularity`, `achievement_leaderboard`, `user_event_counts`

#### Migration 008 — Webhooks (`008_webhooks.sql`) — 2 tables

| Table | Purpose |
|-------|---------|
| `webhooks` | User-configured webhook URLs + event subscriptions |
| `webhook_deliveries` | Delivery log with retry tracking |

#### Migration 009 — Push Notifications (`009_push_subscriptions.sql`) — 3 tables

| Table | Purpose |
|-------|---------|
| `push_subscriptions` | Web Push subscriptions (`endpoint`, `p256dh`, `auth`) |
| `push_notifications` | Delivery log per notification type |
| `notification_preferences` | Per-user notification toggles + quiet hours |

#### Migration 010 — Transit Alerts (`010_transit_alerts.sql`) — 3 tables

| Table | Purpose |
|-------|---------|
| `transit_alerts` | User-defined alert rules (gate activation, aspects, cycles) |
| `alert_deliveries` | Per-day delivery tracking |
| `alert_templates` | Curated alert presets by category |

#### Migration 011 — API Keys (`011_api_keys.sql`) — 2 tables

| Table | Purpose |
|-------|---------|
| `api_keys` | Developer API keys with scopes & rate limits |
| `api_usage` | Per-request API usage telemetry |

#### Migration 012 — Notion Integration (`012_notion.sql`) — 4 tables

| Table | Purpose |
|-------|---------|
| `oauth_states` | OAuth CSRF state tokens |
| `notion_connections` | User Notion workspace auth tokens |
| `notion_syncs` | Sync job tracking per database |
| `notion_pages` | Synced page IDs & URLs |

#### Migration 013 — Daily Check-ins (`013_daily_checkins.sql`) — 3 tables + 1 mat. view

| Table | Purpose |
|-------|---------|
| `daily_checkins` | Daily alignment/energy/strategy tracking |
| `checkin_reminders` | Per-user reminder preferences |
| `alignment_trends` | Aggregated alignment data by period |

Materialized view: `checkin_streaks` — consecutive check-in streak calculation.
Refreshed by cron (trigger dropped in migration 016).

#### Migration 014 — Analytics (`014_analytics.sql`) — 5 tables + 2 views

| Table | Purpose |
|-------|---------|
| `analytics_events` | Raw event stream (page views, actions) |
| `analytics_daily` | Daily rollup aggregates |
| `funnel_events` | Conversion funnel step tracking |
| `experiments` | A/B experiment definitions |
| `experiment_assignments` | User ↔ variant assignments |
| `experiment_conversions` | Conversion events per experiment |

Views: `v_active_users` (DAU/WAU/MAU), `v_event_trends` (30-day trends)

#### Migration 015 — Query Optimization (`015_query_optimization.sql`)

No new tables. Adds `tier` column to `users` + performance indexes across all major tables.

#### Migration 016 — Streak Trigger Fix (`016_fix_checkin_streak_trigger.sql`)

No new tables. Drops per-statement trigger on `daily_checkins`. Adds `get_user_streak()` function for real-time streak lookup. `refresh_checkin_streaks()` converted to standalone cron-callable function.

#### Migrations 017–041 (subsequent)

| Migration | Purpose |
|---|---|
| 017 | Standardize UUID generation |
| 018 | Drop deprecated `usage_tracking` table |
| 019 | `cluster_member_birth_data` — birth data on cluster members |
| 020 | Fix subscription constraints |
| 021 | `password_reset_tokens` — secure reset flow |
| 022 | `social_auth` — OAuth (Google/Apple) |
| 023 | Discord integration |
| 024a | Atomic rate-limit counters |
| 024b | Practitioner invitations |
| 025 | Session notes |
| 026 | Practitioner directory |
| 027 | One-time purchase columns |
| 028 | Grandfather subscriptions |
| 029 | Agency seats |
| 030 | Add individual/agency tiers |
| 031 | Email marketing opt-out |
| 032 | Normalize tier and status |
| 033 | Composite indexes |
| 034 | Drop dead views |
| 035 | Drop dead tables |
| 036 | Email verification |
| 037 | Cluster invite codes |
| 038 | TOTP 2FA |
| 039 | `account_deletions` — GDPR deletion audit trail |
| 040 | Add `last_login_at` to users |
| 041 | Experiments status enum |

---

## 6. API Design

### 6.1 Core Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chart/calculate` | Calculate HD + Astro chart from birth data |
| GET | `/api/chart/:id` | Retrieve cached chart |
| POST | `/api/profile/generate` | Generate Prime Self profile from chart |
| GET | `/api/transits/today` | Current transit positions + HD gates |
| GET | `/api/transits/forecast/:days` | Forward-looking transit activations |
| POST | `/api/composite` | Composite/relationship chart for two users |
| POST | `/api/cluster/create` | Create a cluster session |
| POST | `/api/cluster/:id/synthesize` | Run cluster intelligence synthesis |
| POST | `/api/rectify` | Birth-time sensitivity analysis |
| GET | `/api/compare/categories` | List celebrity categories (public) |
| GET | `/api/compare/celebrities` | Celebrity matches by chart similarity 🔒 |
| GET | `/api/compare/celebrities/:id` | Detailed celebrity comparison 🔒 |
| DELETE | `/api/auth/account` | Delete account (GDPR) 🔒 |
| GET | `/api/auth/export` | Export all user data (GDPR) 🔒 |

### 6.2 Response Envelope

```json
{
  "ok": true,
  "data": { "..." },
  "groundingAudit": {
    "claimsTotal": 5,
    "claimsGrounded": 5,
    "ungroundedFields": []
  },
  "meta": {
    "model": "claude-sonnet-4-20250514",
    "calculationMs": 42,
    "synthesisMs": 1200
  }
}
```

---

## 7. Agent / MCP Architecture

### 7.1 Agent Routing

| Agent Role | Model | When Used |
|------------|-------|-----------|
| **Calculation Verifier** | claude-sonnet-4-20250514 | Post-build — validates each layer against test vectors |
| **Knowledgebase Generator** | claude-opus-4-20250514 | One-time — generates 64 gene keys, 36 channels, 192 purpose vectors from I Ching source |
| **Profile Synthesizer** | claude-opus-4-20250514 | Per-request — reasons across HD + Astro + Transits + Prime Self |
| **Transit Digest Writer** | claude-3-haiku-20240307 | Daily cron — short, structured SMS/push messages |
| **Quality Auditor** | claude-sonnet-4-20250514 | Post-generation — checks for ungrounded claims, IP derivation |
| **Build Agent** | claude-sonnet-4-20250514 (Claude Code) | Development — layer-by-layer implementation with inline verification |

### 7.2 MCP (Model Context Protocol) Integrations

| MCP Server | Purpose |
|------------|---------|
| **Neon MCP** | Direct DB operations — schema migrations, query execution, branch management |
| **GitHub MCP** | PR creation, code review, issue tracking for build progress |
| **Cloudflare MCP** (if available) | Worker deployment, KV/R2 management |
| **Telnyx MCP** (custom) | SMS send, phone number management, delivery status |

### 7.3 Subagent Workflow for Build

```
ORCHESTRATOR (you, in VS Code with Copilot)
    │
    ├── Subagent: "Build Layer N"
    │     └── Claude Code / Sonnet 4.6
    │     └── Writes code, runs tests inline, verifies against AP chart
    │
    ├── Subagent: "Generate KB Batch"
    │     └── Opus 4.6
    │     └── Generates gate/channel/cross descriptions from I Ching + seed JSON
    │
    ├── Subagent: "Validate KB Entry"
    │     └── Sonnet 4.6
    │     └── Checks for originality, grounding, Ra Uru Hu language avoidance
    │
    ├── MCP: Neon
    │     └── Run migrations, seed data, query charts
    │
    └── MCP: GitHub
          └── Commit layers, create PRs, track progress
```

---

## 8. Build Sequence

### Phase 1: Foundation (Complete ✅)
- [x] Prime Self Manifesto
- [x] Canonical Framework
- [x] HD/Astro Integration Layer
- [x] Architecture Plan (this document)
- [x] Build Bible / Prompting Documentation
- [x] Gate Wheel Lookup Table (`src/data/gate_wheel.json`)
- [x] Supporting data files (centers, channels, type rules, crosses)

### Phase 2: Calculation Engine (Complete ✅)
- [x] Layer 1: Julian Day Number + Sun longitude
- [x] Layer 2: All planets + nodes
- [x] Layer 3: Design side (-88 days)
- [x] Layer 4: Gate/line lookup from longitude
- [x] Layer 5: Centers, channels, type, authority, profile, cross
- [x] Layer 6: Astrology (signs, houses, aspects)
- [x] Layer 7: Transit engine
- [x] Numerology engine (Life Path, Personal Year, Tarot Birth Card)
- [x] Current local Vitest suite passing — canonical, engine, handler, and numerology coverage in place

### Phase 3: Data Layer (Complete ✅)
- [x] Neon schema migration (48 tables live + indexes, verified 2026-06-25)
- [x] Knowledgebase authored: types, profiles, centers, forges, knowledges,
      sciences, arts, defenses, heresies, forge_mapping, signs, planets, aspects, houses
- [x] R2 bucket provisioned (prime-self-exports, binding: R2)
- [x] gates.json — 64/64 complete via generate.js --gates (Claude Sonnet)
- [x] channels.json — 35/35 unique source channels complete
- [x] crosses.json — 192/192 complete (64 × 3 types: Right Angle, Left Angle, Juxtaposition)
- [x] Quality audit pass — originality 7/10, pass: true, 3 minor flagged sentences (non-blocking)
- [x] combined/ directory — verified_correlations.json (10 HD/Astro entries, policy: no interpolation)

### Phase 4: Synthesis Layer (Complete ✅)
- [x] System prompt engineering (synthesis.js — SYSTEM_PROMPT, deterministic computeForge())
- [x] Reference facts builder (buildReferenceFacts)
- [x] RAG injection (getRAGContext — reads gates, channels, types, forges)
- [x] Grounding audit validation logic (validateSynthesisResponse)
- [x] Dual-pass re-prompt logic (buildReprompt, second LLM call in profile.js)
- [x] API endpoint wired (/api/profile/generate)
- [x] Direct Anthropic API fallback (callLLM in profile.js)

### Phase 5: Distribution (Complete ✅)
- [x] Telnyx SMS handler (sms.js — webhook + send-digest)
- [x] Composite/relationship chart endpoint (/api/composite)
- [x] Clustering feature (/api/cluster/*)
- [x] PDF export with R2 caching (/api/profile/:id/pdf)
- [x] Auth endpoints (register/login/refresh with PBKDF2 + JWT)
- [x] Practitioner dashboard (6 endpoints — register/profile/clients CRUD)
- [x] TELNYX_PHONE_NUMBER + TELNYX_CONNECTION_ID wired to SMS outbound
- [x] Telnyx connection ID set as Worker secret (2887319279378629637)

### Phase 6: Narrative Integration (Complete ✅)
- [x] Savannah onboarding narrative mapped to all 5 Forges (Initiation/Mastery/Guidance/Perception/Transformation)
- [x] savannah_narrative.json — 22-chapter story with per-Forge arcs, teachings, and user messages
- [x] Onboarding handler — 5 routes: intro (public), forge, forge/:key, progress (KV), advance
- [x] Progress tracking via KV namespace (no schema migration required)
- [x] In-app story progression tied to user's primary Forge (from generated profile)
- [x] Deployed live — `GET /api/onboarding/intro` returns 5-Forge structure ✅
### Phase 7: Hardening & Production Readiness (In Progress)
*Full backlog: [BACKLOG.md](BACKLOG.md)*

**Sprint 17 Audit (2026-06-25) — Completed items:**
- [x] Fix `queries.js` phantom columns: `cronGetWelcome2Users` (chart_type), `cronGetWelcome3Users` (authority), `getTotalProfiles` (status) — BL-S17-C1
- [x] Fix `planets.js` Chiron orbital rates (were zero, now derived from JPL HORIZONS) — BL-S17-C2
- [x] Remove dead `handleWebhook` import from `index.js` — BL-S17-C3
- [x] Verify analytics SQL injection safety (all parameterized `$1…$N`) — BL-S17-H1
- [x] Verify embed.js origin allowlist (ALLOWED_ORIGINS Set) — BL-S17-H2
- [x] Verify mobile nav tab IDs match JS selectors — BL-S17-H3
- [x] Verify check-in DOM IDs match handlers — BL-S17-H4
- [x] Add `gates.js` GATE_WHEEL sync-warning comment — BL-S17-M1
- [x] Fix pre-existing test failures: Mars gate boundary (15→12), transit count (13→14) — BL-S17-M2
- [x] Clean up 10 obsolete root files, move 4 docs → `docs/` — BL-S17-M3
- [x] Update BACKLOG.md with Sprint 17 section — BL-S17-L1

**Remaining Phase 7 items (prior sprints):**
- [ ] Fix Neon DB driver to use official API (BL-C1)
- [ ] Fix `migrate.js` await + reconcile schema drift (BL-C2, BL-C3)
- [ ] Fix CORS to allow DELETE/PUT/PATCH methods (BL-C4)
- [ ] Fix chart auto-save dead code (BL-C5)
- [ ] Fix `parseToUTC` negative-minute bug (BL-C6)
- [ ] Implement 7 missing documented endpoints or update spec (BL-M1)
- [ ] Constant-time password comparison (BL-M2)
- [ ] JSON parse error handling in all handlers (BL-M3)
- [ ] Restrict CORS origin to production domain (BL-M4)
- [ ] Complete Gene Keys knowledgebase (38/64 → 64/64) (BL-M5)
- [ ] Fix `digest.js` property name mismatches (BL-M6)
- [ ] Fix `rag.js` array/object mismatch (BL-M7)
- [ ] Consolidate duplicate RAG and JWT code (BL-M8, BL-M9)
- [ ] Add missing channel 42-53 in composite.js (BL-M11)
- [x] Complete `engine-compat.js` data injection (BL-M12) — Sprint 19: Added 7 Prime Self canonical files
- [ ] Frontend for composite, practitioner, onboarding, PDF features (BL-M14)
- [ ] Add integration tests for middleware, DB, LLM failover
---

## 9. Security Notes

- All API keys stored in Cloudflare Worker secrets (never in code)
- Neon connection uses SSL + channel binding
- Birth data is PII — encrypt at rest, minimize retention
- Practitioner access to client charts requires explicit consent records
- Rate limiting via Cloudflare AI Gateway for LLM endpoints

**Audit findings (2026-03-03):**
- ⚠️ CORS origin is wildcard `*` — should be restricted to production domain (BL-M4)
- ⚠️ Password comparison uses `===` instead of constant-time compare (BL-M2)
- ✅ `Secrets.txt` removed from workspace (Sprint 17 cleanup); `.gitignore` updated
- ✅ Analytics SQL uses parameterized queries — no injection risk (verified Sprint 17)
- ⚠️ No email format validation on registration (BL-m10)
- ⚠️ Token stored in `localStorage` in frontend — XSS-vulnerable

---

## 10. Revenue Model

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Basic chart + Forge identification |
| **Individual** | $19/mo | Personal AI guidance, full transit tools, saved profiles, PDF export |
| **Practitioner** | $97/mo | Client management, practitioner workflows, branded reports, composites |
| **Agency** | $349/mo | Multi-seat practitioner operations, white-label distribution, API and webhook access |

---

## 11. Sprint 17 Audit Summary (2026-06-25)

### Scope
Full codebase and live-DB audit using 3 parallel subagents + Neon MCP + targeted manual review.

### Critical Fixes Applied
| ID | File | Issue | Resolution |
|----|------|-------|-----------|
| BL-S17-C1a | `workers/src/db/queries.js` | `cronGetWelcome2Users` referenced non-existent `c.chart_type` column | Replaced with `c.hd_json::jsonb->'chart'->>'type' AS chart_type` using LEFT JOIN LATERAL |
| BL-S17-C1b | `workers/src/db/queries.js` | `cronGetWelcome3Users` referenced non-existent `c.authority` column | Replaced with `c.hd_json::jsonb->'chart'->>'authority' AS authority` using LEFT JOIN LATERAL |
| BL-S17-C1c | `workers/src/db/queries.js` | `getTotalProfiles` filtered on non-existent `status` column | Removed `WHERE status = 'completed'` clause |
| BL-S17-C2 | `src/engine/planets.js` | Chiron orbital element rates (a, e, I) were all zero → position degradation away from J2000 | Set derived century rates: `a: 0.0014`, `e: -0.0009`, `I: -0.0056` from JPL HORIZONS |
| BL-S17-C3 | `workers/src/index.js` | Dead `handleWebhook` import from `billing.js` after webhook consolidation (BL-R-C4) | Removed unused import |

### Verifications (No Code Change Needed)
| ID | Area | Finding |
|----|------|---------|
| BL-S17-H1 | SQL injection (analytics) | All analytics queries use parameterized `$1…$N` — safe |
| BL-S17-H2 | embed.js origin allowlist | Uses `ALLOWED_ORIGINS` Set with strict `has()` check — safe |
| BL-S17-H3 | Mobile nav tab IDs | `data-tab="chart"` matches `querySelector('[data-tab="chart"]')` — correct |
| BL-S17-H4 | Check-in DOM | All `getElementById('checkin-…')` IDs match HTML element IDs — correct |

### Code Quality Improvements
- Added GATE_WHEEL sync-warning comment in `src/engine/gates.js` about duplication with `src/data/gate_wheel.json`
- Fixed 2 pre-existing test failures (Mars gate boundary precision 88.16° → Gate 12 not 15; transit body count 14 with Chiron not 13)
- Cleaned up 10 obsolete root files (`fix-cloudflare.js`, `quick-test.js`, `test-results.txt`, `RUN_MCP_FIX.js`, `CLOUFLARE_MCP_FIX.md`, `CLOUDFLARE_STATUS_REVIEW.md`, `REVIEW_SUMMARY_2026-03-08.md`, `nul`, `Secrets.txt`, `PLan-convo/`)
- Reorganized 4 files: `CODEBASE_AUDIT_2026-03-08.md` → `audits/AUDIT_2026-03-08.md`, `DEEP_DIVE_AUDIT_REPORT.md` → `audits/archive/AUDIT_2025-01.md`, `FRONTEND_AUDIT.md` → `audits/FRONTEND_AUDIT.md`, `test-api.js` → `tests/api-smoke.js`
- Updated `.gitignore` with `test-results.txt` and `nul` entries

### Database Reconciliation
- Live table count: **48** (verified via Neon MCP)
- `usage_tracking` from migration 003 — defined but never materialized in production
- All other 48 tables match migration definitions
- `practitioners.created_at` column confirmed present (added by migration)

### Test Suite
- Current local Vitest baseline is passing
- Local coverage includes canonical framework tests in addition to engine, handler, and numerology suites

### Known Remaining Low-Priority Items
| ID | Description |
|----|-------------|
| BL-S17-L2 | `toGeocentric()` in `planets.js` ignores z-component — sub-arcminute impact for outer planets |
| BL-S17-L1 | Chiron orbital elements use 50-year lifecycle approximation — accurate ±0.5° for 1900–2100 |

---

*This document is the single source of truth for all architectural decisions. All implementation work references this document and the Build Bible for execution details.*
