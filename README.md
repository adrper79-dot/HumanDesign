# Prime Self

**Human Design + Astrology synthesis platform** — deterministic chart calculations, AI-powered personality profiling, transit tracking, and practitioner tools, all running as a Cloudflare Worker API with a lightweight SPA frontend.

---

## What It Does

| Feature | Description |
|---|---|
| **Chart calculation** | Full Human Design chart (type, authority, profile, centers, channels, cross) + Western Astrology placements from birth data |
| **Prime Self Profile** | LLM-synthesised 8-layer profile: Forge archetype, Knowledge Profile, Decision Architecture, Current Activation, Practice Recommendations |
| **Transits** | Live planetary positions mapped to HD gates/lines; transit-to-natal aspects |
| **Transit forecast** | Day-by-day gate ingresses and key aspect windows over a date range |
| **Geocoding** | City/location → lat/lng + IANA timezone (free, no API key) |
| **Auth** | Email + password registration; 24-hour JWT access + 30-day refresh |
| **History** | Saved charts and profiles per user, retrievable by ID |
| **Practitioner tools** | Register as practitioner, manage clients, access client charts |
| **Onboarding** | Savannah story arc personalised per Forge archetype |
| **SMS digest** | Daily transit brief delivered via Telnyx SMS |

---

## Quick Start

### Prerequisites
- Node.js 18+
- A Cloudflare account (free tier is sufficient for development)

### Install

```bash
git clone https://github.com/adrper79-dot/HumanDesign.git
cd HumanDesign
npm install
```

### Run Tests

```bash
npx vitest run
# Expected: 121 tests passing
```

### Serve the Frontend Locally

```bash
cd frontend
python3 -m http.server 4200
# Open http://localhost:4200
```

The frontend points to the live production Worker. To target a local Worker instead, change `const API` in `frontend/index.html`.

### Run the Worker Locally

```bash
cd workers
npx wrangler dev
# Worker listens at http://localhost:8787
```

---

## Deployment

### Deploy the Worker API

```bash
cd workers
npx wrangler deploy
```

### Deploy the Frontend to Cloudflare Pages

```bash
# First time only — create the Pages project:
cd workers
npx wrangler pages project create prime-self-ui --production-branch main

# Every subsequent deploy:
npx wrangler pages deploy ../frontend --project-name prime-self-ui --branch main --commit-dirty=true
```

**Live URLs**
- API: `https://prime-self-api.adrper79.workers.dev`
- Frontend: `https://prime-self-ui.pages.dev`

---

## Required Worker Secrets

Set via `npx wrangler secret put <NAME>` from inside the `workers/` directory.

| Secret | Description |
|---|---|
| `NEON_CONNECTION_STRING` | Neon PostgreSQL connection string (pooled) |
| `JWT_SECRET` | Random 32+ byte string for signing JWTs |
| `ANTHROPIC_API_KEY` | Primary LLM provider (Claude) |
| `GROK_API_KEY` | Failover LLM provider 2 (xAI Grok) |
| `GROQ_API_KEY` | Failover LLM provider 3 (Groq) |
| `TELNYX_API_KEY` | SMS delivery via Telnyx |
| `TELNYX_PHONE_NUMBER` | Outbound SMS number |
| `TELNYX_CONNECTION_ID` | Telnyx connection ID |
| `AI_GATEWAY_URL` | Cloudflare AI Gateway URL (optional but recommended) |

---

## Project Structure

```
HumanDesign/
├── src/
│   ├── engine/          # Deterministic astrology + HD calculation engines
│   │   ├── index.js     # calculateFullChart() — main entry point
│   │   ├── transits.js  # getCurrentTransits(), forecastTransits()
│   │   └── ...          # Layers 1–7: positions, gates, aspects, etc.
│   ├── data/            # Static reference data (gate_wheel, centers, channels)
│   └── prompts/         # LLM prompt templates (Layer 8 synthesis)
│
├── workers/
│   └── src/
│       ├── index.js          # Worker entry point & router (32 endpoints)
│       ├── handlers/         # One file per endpoint group
│       │   ├── calculate.js  # POST /api/chart/calculate
│       │   ├── profile.js    # POST /api/profile/generate, GET /api/profile/*
│       │   ├── transits.js   # GET /api/transits/today
│       │   ├── forecast.js   # GET /api/transits/forecast
│       │   ├── geocode.js    # GET /api/geocode
│       │   ├── auth.js       # /api/auth/*
│       │   ├── cluster.js    # /api/cluster/*
│       │   ├── sms.js        # /api/sms/*
│       │   ├── practitioner.js
│       │   └── onboarding.js
│       ├── db/
│       │   ├── queries.js    # All SQL queries
│       │   └── migrate.js    # Schema migrations
│       ├── lib/
│       │   └── llm.js        # Multi-provider LLM failover (Anthropic→Grok→Groq)
│       ├── middleware/
│       │   ├── auth.js       # JWT verification
│       │   ├── cors.js       # CORS headers
│       │   └── rateLimit.js  # Per-route rate limits
│       └── utils/
│           └── parseToUTC.js
│
├── frontend/
│   └── index.html       # Single-file SPA (Chart, Profile, Transits, History tabs)
│
├── tests/
│   ├── engine.test.js   # Engine unit tests
│   └── handlers.test.js # Handler integration tests
│
├── docs/                # Extended documentation
└── wrangler.toml        # Cloudflare Worker config (KV, R2, cron)
```

---

## Verification Anchor

All chart calculations verified against **AP's natal chart** (Aug 5, 1979, 18:51 EST, Tampa FL):
- Type: **Projector** | Profile: **6/2** | Authority: **Emotional – Solar Plexus**
- Cross: Left Angle Cross of Refinement (33/19 | 2/1)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers (V8 isolates, global edge) |
| Database | Neon PostgreSQL (serverless, pooled) |
| Cache | Workers KV (chart cache, geocode cache — 30-day TTL) |
| File storage | Cloudflare R2 (PDF exports) |
| LLM | Anthropic Claude → xAI Grok → Groq (automatic failover) |
| Auth | PBKDF2-SHA256 passwords, HS256 JWT |
| SMS | Telnyx |
| Tests | Vitest (121 tests) |
| Frontend | Vanilla HTML/CSS/JS (no build step) |
| Geocoding | OpenStreetMap Nominatim + BigDataCloud (free, no API keys) |

---

## Documentation

- [Architecture overview](docs/ARCHITECTURE.md) — system design and data flow
- [API reference](docs/API_SPEC.md) — all 32 endpoints with examples
- [Operations runbook](docs/OPERATION.md) — deployment, secrets, monitoring, rollback

```
HumanDesign/
├── ARCHITECTURE.md              # System architecture — the WHY
├── BUILD_BIBLE.md               # Prompting documentation — the HOW
├── PLan-convo                   # Original planning conversation (reference)
├── Secrets.txt                  # API keys (⚠️ in .gitignore)
├── prime_self_manifesto.docx    # Canonical doc: The Manifesto
├── prime_self_canonical_framework.docx  # Canonical doc: Full system
├── prime_self_hd_astro_integration.docx # Canonical doc: HD/Astro bridge
├── docs/                        # Additional documentation
├── src/
│   ├── data/                    # Static reference data
│   │   ├── gate_wheel.json      # 64-gate mandala wheel lookup (CRITICAL)
│   │   ├── centers.json         # 9 centers + gate assignments
│   │   ├── channels.json        # 36 channels + center connections
│   │   └── type_rules.json      # Type/Authority determination logic
│   ├── engine/                  # Calculation engine (Layers 1-7)
│   ├── knowledgebase/           # Generated interpretive content
│   └── prompts/                 # LLM prompt templates (Layer 8)
└── workers/                     # Cloudflare Workers deployment
```

## Quick Start — Build Sequence

1. Read `ARCHITECTURE.md` for system overview
2. Read `BUILD_BIBLE.md` for layer-by-layer execution prompts
3. Execute Layer 1 prompt → verify against AP test vector
4. Continue through Layer 8, verifying each layer before proceeding

## Canonical Documents (Do Not Modify Without Review)

| Document | Purpose |
|----------|---------|
| **Manifesto** | The philosophical declaration — what Prime Self IS |
| **Canonical Framework** | Complete system — Forges, Knowledges, Sciences, Arts, Defenses, Heresies |
| **HD/Astro Integration** | How birth data personalizes the Prime Self journey |
| **Architecture** | Technical architecture and stack decisions |
| **Build Bible** | All 8 layer prompts, verification anchors, file structure |

## Verification Anchor

All calculations verified against **AP's natal chart** (Aug 5, 1979, 22:51 UTC, Tampa FL):
- Type: Projector | Profile: 6/2 | Authority: Emotional – Solar Plexus
- Cross: Left Angle Cross of Refinement (33/19 | 2/1)

## Tech Stack

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Database**: Neon (serverless PostgreSQL)
- **Calculation**: Pure JS (Jean Meeus algorithms)
- **LLM**: Claude Opus 4.6 (synthesis) / Sonnet 4.6 (structured) / Haiku 4.5 (volume)
- **SMS**: Telnyx
