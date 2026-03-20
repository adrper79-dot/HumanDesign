# Gene Keys Knowledgebase — CONTENT FREEZE

> **STATUS: FROZEN — pending legal determination**
>
> Do NOT add, modify, or remove files in this directory until legal counsel
> has issued a written determination on the Gene Keys IP scope.
> See GAP-006 in `audits/issue-registry.json` for tracking.

## Corpus Contents

| File | Size | Description |
|------|------|-------------|
| `keys.json` | 72 KB | 64 structured Gene Keys entries (Shadow/Gift/Mastery/Siddhi + descriptions) |
| `generate-missing.js` | 4.5 KB | Generator script for filling corpus gaps — do not run while freeze is active |

## How It's Used

- **`src/engine/genekeys.js`** — maps personality/design chart gates to 6 key positions (Life's Work, Evolution, Radiance, Purpose, Attraction, IQ/Pearl)
- **`src/prompts/rag.js`** — injects up to 8 gate entries into the RAG context as "Frequency Keys Wisdom" section
- **`workers/src/engine-compat.js`** — bundles `keys.json` for the Cloudflare Workers runtime

## Content Classification (for counsel)

The 64 entries in `keys.json` each contain:
- `name` — the triad title (e.g., "Entropy / Freshness / Beauty")
- `shadow` / `gift` / `siddhi` — archetype labels (1–5 words each)
- `archetype` — single epithet (e.g., "The Creator")
- `message` — one-sentence aphorism (~12 words, original voice)
- `shadowDescription` / `giftDescription` / `siddhiDescription` — 2–4 sentence descriptions (~100–150 words each, original voice)
- `contemplation` — one reflective question (original voice)

**Classification:** All descriptive text was authored internally using the Gene Keys framework as conceptual source material. No verbatim passages from published Gene Keys books are included. The Shadow/Gift/Siddhi triad names are the core IP under review.

## Freeze Policy

- This directory is flagged as frozen in CI (see `.github/workflows/` if applicable).
- Any PR that modifies `src/knowledgebase/genekeys/` must be reviewed by a project lead and flagged for legal review until GAP-006 is closed.
