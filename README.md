# Prime Self

> **Discover your unique energy blueprint.**  
> Combine ancient wisdom (Energy Blueprint + Astrology + Numerology) with modern AI to reveal your decision-making style, life purpose, and optimal strategies for success.

**What is Prime Self?** A personal insight platform that analyzes your exact birth time and location to create a detailed map of your energy patterns. Get clear, actionable guidance about how you're designed to make decisions, interact with others, and fulfill your purpose—all in plain language, powered by AI.

---

## 🚨 Current Status (Updated March 9, 2026)

**Code Quality**: ✅ Excellent (263/263 tests passing locally)  
**Production Deployment**: ⚠️ Not re-verified in this repo-only audit  
**UX Status**: 🔄 Sprint 18 partially shipped; backlog and build docs were reconciled with the current frontend

**Repository Audit Highlights**:
- Table-driven Workers API with a broad handler surface and 100+ route registrations
- Frontend already includes grouped sidebar navigation, mobile bottom nav, onboarding, PDF export, composite charts, practitioner tools, share-card export, and plain-language explanations
- Documentation drift was the biggest repo problem: broken links, obsolete file names, stale test counts, and backlog items left open after implementation

**See**: [audits/REPOSITORY_ASSESSMENT_2026-03-09.md](audits/REPOSITORY_ASSESSMENT_2026-03-09.md) for the current assessment and [BACKLOG.md](BACKLOG.md) for the updated backlog status.

---

## ✨ Try It Now

**Live Demo:** [https://selfprime.net](https://selfprime.net)  
**API Status:** [Health Check](https://prime-self-api.adrper79.workers.dev/api/health)

*(Deployment health should be verified separately before marketing or release use.)*

---

## What You Get

### 🎯 Personal Energy Blueprint
Discover your **Pattern** (how you operate), **Decision Style** (how to make aligned choices), **Life Role** (your personality archetype), and **Purpose Vector** (your unique life theme). Understand why certain strategies work for you and others don't.

### 🌟 AI-Powered Full Profile
Get a comprehensive 8-layer synthesis combining:
- Energy Blueprint core design
- Western Astrology placements
- Gene Keys wisdom
- Numerology life path
- Your Forge archetype (Artisan, Scientist, Councilor, or Oracle)
- Current planetary activations
- Personalized practice recommendations
- Relatable narrative context

### 🌙 Daily Transit Insights
See how today's planetary positions interact with your birth chart. Know when to initiate, when to wait, and when key opportunities or challenges are emerging.

### 📱 Social Sharing
Share your energy blueprint beautifully across all major platforms:
- **Instagram-ready images** — 1080x1080 bodygraph cards with your key insights
- **Twitter/X** — Pre-filled tweets with chart highlights and referral link
- **Facebook** — Rich Open Graph previews for engaging shares
- **TikTok** — Vertical format exports optimized for mobile video
- **Threads & Bluesky** — Text-optimized posts for emerging platforms
- **Share analytics** — Track which platforms drive the most conversions

### 💑 Relationship Compatibility
Generate composite charts to understand the energy dynamics between you and anyone else. See where you complement each other and where challenges might arise.

### 📱 SMS Daily Digest
Subscribe to receive your daily transit brief via text message. Stay aligned with the cosmic weather without checking apps.

### 👥 Professional Tools
For practitioners: manage client rosters, run batch calculations, generate detailed synthesis reports, and export professional-quality PDFs.

---

## Key Concepts

New to Energy Blueprints? Here are the core terms explained simply:

| Term | Meaning |
|---|---|
| **Energy Blueprint** | Your personal energy map based on exact birth time/place. Shows how you're designed to operate in the world. |
| **Pattern** | Your energy type: **Builder** (sustainable energy), **Guide** (recognition-based), **Initiator** (self-starting), **Builder-Initiator** (multi-passionate hybrid), or **Reflector** (lunar mirror). |
| **Decision Style** | How you make aligned decisions: **Emotional Wave** (wait through emotional clarity), **Sacral Response** (gut yes/no), **Splenic Instinct** (in-the-moment knowing), **Heart Will** (self-direction), etc. |
| **Life Role** | Your personality archetype as two numbers (e.g., 6/2, 1/3). First = how others see you, second = how you see yourself. |
| **Gene Keys** | The 64 energy points in your chart (numbered 1-64). Each represents a life theme and skill. |
| **Centers** | Nine bio-energy hubs. **Defined** (colored) = consistent energy. **Open** (white) = flexible, amplifies others. |
| **Purpose Vector** | Your life's thematic purpose (e.g., "Cross of Refinement"). Formed by your four main gene key activations. |
| **Transits** | Current planetary positions and how they activate your chart today. Your "cosmic weather forecast." |
| **Forge** | Your Prime Self archetype: **Artisan** (hands-on creator), **Scientist** (systematic researcher), **Councilor** (community weaver), or **Oracle** (pattern seer). |

📖 **See full glossary:** [docs/GLOSSARY.md](docs/GLOSSARY.md)

---

## How It Works

1. **Enter Your Birth Data** — Date, time (as exact as possible), and location
2. **Instant Chart Calculation** — Planetary positions computed using astronomical algorithms
3. **AI Synthesis** — Claude AI weaves your energy blueprint, astrology, and numerology into a readable profile
4. **Actionable Insights** — Get specific strategies for decision-making, relationships, career, and personal growth
5. **Track Transits** — See daily updates on how current planetary positions affect your unique design

All calculations are deterministic (same input = same output) and verified against professional reference charts.

---

---

## 🔧 For Developers

Everything below this line is for developers who want to run, modify, or deploy Prime Self.

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
# Expected: 263 tests passing (4 test files)
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

Note: To enable the Cloudflare MCP server integration (used by some development workflows), copy `.vscode/mcp.example.json` to `.vscode/mcp.json` and ensure your OS environment provides `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (do not commit these secrets).

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
│       ├── index.js          # Worker entry point & table-driven router
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
│   ├── index.html       # Main SPA shell with sidebar + mobile navigation
│   └── js/              # Frontend modules (bodygraph, explanations, offline, share card, i18n)
│
├── tests/
│   ├── canonical.test.js # Canonical framework tests (56 tests)
│   ├── engine.test.js   # Engine unit tests (103 tests)
│   ├── handlers.test.js # Handler integration tests (41 tests)
│   └── numerology.test.js # Numerology tests (63 tests)
│
├── docs/                # Extended documentation
└── wrangler.toml        # Cloudflare Worker config (KV, R2, cron)
```

---

## Verification Anchors

All chart calculations verified against two reference charts:

**AP** (Aug 5, 1979, 18:51 EST, Tampa FL)
- Pattern: **Guide** (Oracle Pattern) | Life Role: **6/2** (Role Model / Hermit) | Decision Style: **Emotional Wave Navigation**
- Purpose Vector: Left Angle Cross of Refinement (33/19 | 2/1)
- P Sun: Gene Key 33 Line 6 (high-line boundary test)

**0921** (Sep 21, 1983, 5:30 PM EDT, Naples FL)
- Pattern: **Builder-Initiator** | Life Role: **1/3** (Investigator / Experimenter) | Decision Style: **Emotional Wave Navigation**
- Purpose Vector: Right Angle Cross of the Vessel of Love (46/25 | 15/10)
- P Sun: Gene Key 46 Line 1 (low-line boundary test)
- Verified against professional reference chart

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
| Tests | Vitest (263 tests across 4 test files) |
| Frontend | Vanilla HTML/CSS/JS (no build step) |
| Geocoding | OpenStreetMap Nominatim + BigDataCloud (free, no API keys) |

---

## Documentation

- [Architecture overview](ARCHITECTURE.md) — system design and data flow
- [Documentation index](DOCUMENTATION_INDEX.md) — current documentation map
- [API reference overview](docs/API.md) — quick API reference
- [Detailed API spec](docs/API_SPEC.md) — historical detailed spec; verify against router for newer routes
- [Operations runbook](docs/OPERATION.md) — deployment, secrets, monitoring, rollback
- [Lessons learned](docs/LESSONS_LEARNED.md) — debugging cases, audit findings, preventive measures
- [Backlog](BACKLOG.md) — all known issues by severity, sprint plan

```
HumanDesign/
├── ARCHITECTURE.md              # System architecture — the WHY
├── process/BUILD_BIBLE.md       # Prompting documentation — the HOW
├── PLan-convo                   # Original planning conversation (reference)
├── Secrets.txt                  # API keys (⚠️ in .gitignore)
├── prime_self_manifesto.docx    # Canonical doc: The Manifesto
├── prime_self_canonical_framework.docx  # Canonical doc: Full system
├── prime_self_hd_astro_integration.docx # Canonical doc: HD/Astro bridge
├── docs/                        # Additional documentation
├── guides/                      # Implementation how-to guides
├── audits/                      # Audit reports and analysis
├── process/                     # Development process & standards
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
2. Read `process/BUILD_BIBLE.md` for layer-by-layer execution prompts
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
- Pattern: Guide (Oracle) | Life Role: 6/2 | Decision Style: Emotional Wave Navigation
- Purpose Vector: Left Angle Cross of Refinement (33/19 | 2/1)

## Tech Stack

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Database**: Neon (serverless PostgreSQL)
- **Calculation**: Pure JS (Jean Meeus algorithms)
- **LLM**: Claude Opus 4.6 (synthesis) / Sonnet 4.6 (structured) / Haiku 4.5 (volume)
- **SMS**: Telnyx
