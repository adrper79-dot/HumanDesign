# Prime Self — System Architecture

## 1. Vision

**Prime Self** is a movement-first platform that delivers a proprietary personal-development philosophy—grounded in Human Design (HD), Western Astrology (Astro), and the Prime Self Forge framework—through a serverless, API-first technology stack.

The technology exists to serve the philosophy. Every architectural decision flows from one constraint: *the calculation must be verifiably accurate, the interpretation must be honestly grounded, and the philosophy must be faithfully delivered.*

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
│  │  Layer 2: Planetary Positions (10 planets + nodes)          │   │
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
│  │  Neon (D1)   │  │  KV (Cloudflare) │  │  R2 (Object Storage)  │  │
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
| **Cache / KV** | Cloudflare KV | Transit position caching, session state |
| **Object Store** | Cloudflare R2 | PDF exports, knowledgebase corpus files |
| **SMS / Voice** | Telnyx | Daily transit digests, appointment reminders |
| **LLM – Reasoning** | Claude Opus 4.6 (via Groq or direct) | Deep synthesis, Prime Self profile generation |
| **LLM – Structured** | Claude Sonnet 4.6 | Chart reading generation, JSON schema adherence |
| **LLM – High Volume** | Claude Haiku 4.5 / Groq Llama | Daily SMS transit digests |
| **Calculation** | Pure JS (Jean Meeus algorithms) | No WASM, no external deps, runs natively in Workers |
| **AI Gateway** | Cloudflare AI Gateway | Rate limiting, caching, model routing, observability |

---

## 4. Calculation Engine — The 8 Layers

Each layer is an independent, testable JS module. Layers build on each other sequentially. Every layer is verified against the **AP Test Vector** before moving forward.

### AP Test Vector (Verification Anchor)
```
Name:       AP
Birth Date: August 5, 1979
Birth Time: 18:51 EDT (22:51 UTC)
Location:   Tampa, Florida, USA
Lat/Lng:    27.9506° N, 82.4572° W

Known Outputs:
  Type:           Projector
  Profile:        6/2
  Definition:     Split Definition
  Authority:      Emotional – Solar Plexus
  Strategy:       Wait for the Invitation
  Not-Self:       Bitterness
  Cross:          Left Angle Cross of Refinement (33/19 | 2/1)

  Personality Sun:  Gate 33, Line 6
  Design Sun:       Gate 2, Line 2
```

### Layer Descriptions

| Layer | Module | Input | Output | Failure Mode |
|-------|--------|-------|--------|-------------|
| **1** | `julian.js` | year, month, day, hour, minute (UTC) | Julian Day Number | Wrong epoch, calendar boundary |
| **2** | `planets.js` | JDN | 10 planet longitudes + nodes (0–360°) | Wrong constants, coordinate error |
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
  "hd": {
    "type": "Projector",
    "strategy": "Wait for the Invitation",
    "authority": "Emotional - Solar Plexus",
    "profile": "6/2",
    "definition": "Split",
    "notSelf": "Bitterness",
    "definedCenters": ["Throat", "G", "SolarPlexus", "Root"],
    "undefinedCenters": ["Head", "Ajna", "Sacral", "Spleen", "Heart"],
    "gates": {
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

```
src/knowledgebase/
  hd/
    gates.json          64 gates — original content derived from I Ching (Legge)
    channels.json       36 channels — synthesized from gate pair descriptions
    centers.json        9 centers — biological/energetic function
    crosses.json        192 incarnation crosses — synthesized from component gates
    types.json          5 types — structural descriptions
    profiles.json       12 profiles — line combination descriptions
  astro/
    signs.json          12 zodiac signs
    planets.json        10 planets + nodes
    aspects.json        Major aspects and orb definitions
    houses.json         12 houses
  prime_self/
    forges.json         5 Forges — full descriptions from Canonical Framework
    knowledges.json     6 Knowledges
    sciences.json       6 Sciences
    arts.json           6 Arts
    defenses.json       6 Defenses
    heresies.json       6 Heresies
    forge_mapping.json  Forge ↔ HD/Astro correlations (from Integration doc)
  combined/
    (nearly empty at launch — add only VERIFIED cross-system correlations)
```

### 5.3 Neon Database Schema (Core Tables)

```sql
-- Users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE,
  phone         TEXT,
  birth_date    DATE NOT NULL,
  birth_time    TIME,
  birth_tz      TEXT NOT NULL,         -- IANA timezone
  birth_lat     DECIMAL(9,6) NOT NULL,
  birth_lng     DECIMAL(9,6) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Calculated Charts (cached)
CREATE TABLE charts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  hd_json       JSONB NOT NULL,       -- Stream 1
  astro_json    JSONB NOT NULL,       -- Stream 2
  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Transit Snapshots (daily cron)
CREATE TABLE transit_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,
  positions_json JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Prime Self Profiles (generated readings)
CREATE TABLE profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  chart_id      UUID REFERENCES charts(id),
  profile_json  JSONB NOT NULL,
  model_used    TEXT NOT NULL,
  grounding_audit JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Practitioner Rosters
CREATE TABLE practitioners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  certified     BOOLEAN DEFAULT false,
  tier          TEXT DEFAULT 'free'
);

CREATE TABLE practitioner_clients (
  practitioner_id UUID REFERENCES practitioners(id),
  client_user_id  UUID REFERENCES users(id),
  PRIMARY KEY (practitioner_id, client_user_id)
);

-- Clusters
CREATE TABLE clusters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  created_by    UUID REFERENCES users(id),
  challenge     TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cluster_members (
  cluster_id    UUID REFERENCES clusters(id),
  user_id       UUID REFERENCES users(id),
  forge_role    TEXT,
  PRIMARY KEY (cluster_id, user_id)
);
```

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
    "model": "claude-sonnet-4.6",
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
| **Calculation Verifier** | Sonnet 4.6 | Post-build — validates each layer against test vectors |
| **Knowledgebase Generator** | Opus 4.6 | One-time — generates 64 gates, 36 channels, 192 crosses from I Ching source |
| **Profile Synthesizer** | Opus 4.6 | Per-request — reasons across HD + Astro + Transits + Prime Self |
| **Transit Digest Writer** | Haiku 4.5 | Daily cron — short, structured SMS/push messages |
| **Quality Auditor** | Sonnet 4.6 | Post-generation — checks for ungrounded claims, IP derivation |
| **Build Agent** | Sonnet 4.6 (Claude Code) | Development — layer-by-layer implementation with inline verification |

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

### Phase 1: Foundation (Current)
- [x] Prime Self Manifesto
- [x] Canonical Framework
- [x] HD/Astro Integration Layer
- [ ] Architecture Plan (this document)
- [ ] Build Bible / Prompting Documentation
- [ ] Gate Wheel Lookup Table (`src/data/gate_wheel.json`)
- [ ] Supporting data files (centers, channels, type rules)

### Phase 2: Calculation Engine (Layers 1–7)
- [ ] Layer 1: Julian Day Number + Sun longitude
- [ ] Layer 2: All planets + nodes
- [ ] Layer 3: Design side (-88 days)
- [ ] Layer 4: Gate/line lookup from longitude
- [ ] Layer 5: Centers, channels, type, authority, profile, cross
- [ ] Layer 6: Astrology (signs, houses, aspects)
- [ ] Layer 7: Transit engine

### Phase 3: Data Layer
- [ ] Neon schema migration
- [ ] Knowledgebase generation pipeline (Opus 4.6)
- [ ] Quality audit pass on generated content
- [ ] R2 bucket setup for corpus storage

### Phase 4: Synthesis Layer (Layer 8)
- [ ] System prompt engineering for Prime Self profile synthesis
- [ ] Grounding audit validation logic
- [ ] Dual-pass re-prompt for low-confidence outputs
- [ ] API endpoint wiring

### Phase 5: Distribution
- [ ] Telnyx SMS integration for daily transit digests
- [ ] Practitioner dashboard
- [ ] Composite/relationship charts
- [ ] Clustering feature
- [ ] PDF export

### Phase 6: Narrative Integration
- [ ] Savannah onboarding narrative mapped to Forge journey
- [ ] In-app story progression tied to user's Prime Self development

---

## 9. Security Notes

- All API keys stored in Cloudflare Worker secrets (never in code)
- Neon connection uses SSL + channel binding
- Birth data is PII — encrypt at rest, minimize retention
- Practitioner access to client charts requires explicit consent records
- Rate limiting via Cloudflare AI Gateway for LLM endpoints

---

## 10. Revenue Model

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Basic chart + Forge identification |
| **Seeker** | $15/mo | Full forge activations, daily transit guidance, practice protocols |
| **Adept** | $97/mo | Clustering sessions, practitioner access, advanced timing, composites |
| **Practitioner** | $500+ | Certification path, client roster, bulk charts, white-label API |

---

*This document is the single source of truth for all architectural decisions. All implementation work references this document and the Build Bible for execution details.*
