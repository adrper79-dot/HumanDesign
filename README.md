# Prime Self — XPElevator

A movement-first platform delivering the Prime Self philosophy through personalized Human Design + Western Astrology calculations, powered by a serverless edge architecture.

## Repository Structure

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
