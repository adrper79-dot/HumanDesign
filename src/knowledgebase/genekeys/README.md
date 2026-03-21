# Gene Keys Knowledgebase — CONTENT REPLACEMENT COMPLETE

> **STATUS: REPLACEMENT COMPLETE (2026-03-20)**
>
> Corpus vocabulary has been replaced with original Prime Self terminology (Noise/Signal/Frequency).
> GAP-006 IP exposure has been closed. See `audits/issue-registry.json` for tracking.
> Structural rename (directory/engine file) pending completion of all phases.

## Corpus Contents

| File | Size | Description |
|------|------|-------------|
| `keys.json` | 72 KB | 64 structured Frequency Keys entries (Noise/Signal/Frequency + descriptions) |
| `generate-missing.js` | 4.5 KB | Vocabulary replacement script — last run completed 2026-03-20 |

## How It's Used

- **`src/engine/genekeys.js`** — maps personality/design chart gates to 6 key positions (Life's Work, Evolution, Radiance, Purpose, Attraction, IQ/Pearl)
- **`src/prompts/rag.js`** — injects up to 8 gate entries into the RAG context as "Frequency Keys Wisdom" section
- **`workers/src/engine-compat.js`** — bundles `keys.json` for the Cloudflare Workers runtime

## Content Classification

The 64 entries in `keys.json` each contain:
- `name` — the triad title (e.g., "Stagnation / Origination / Radiance") — NEW Prime Self original vocabulary
- `noise` / `signal` / `frequency` — archetype labels (1–2 words each) — NEW Prime Self original vocabulary
- `archetype` — single epithet (e.g., "The Creator") — original internally authored content
- `message` — one-sentence aphorism (~12 words) — original internally authored content
- `noiseDescription` / `signalDescription` / `frequencyDescription` — 2–4 sentence descriptions (~100–150 words each) — original internally authored content, preserved unchanged during vocabulary replacement
- `contemplation` — one reflective question — original internally authored content

**Classification:** 
- All descriptive prose (noiseDescription, signalDescription, frequencyDescription, message, contemplation, archetype) is 100% original Prime Self intellectual property
- The three-word vocabulary labels (Noise/Signal/Frequency for all 192 instances) are original Prime Self creations derived from the Alchemy Science framework
- The corpus is now entirely original Prime Self IP with no borrowed content
- **Legal Status:** GAP-006 closed via Outcome A (no license required, full original vocabulary replacement complete)

## Freeze Policy

- The content freeze has been lifted (vocabulary replacement completed 2026-03-20)
- Commit: c3fd70e (feat: replace Gene Keys triad names with native Prime Self vocabulary)
- No further restrictions on this directory for content purposes
- Future changes (e.g., structural renames) should follow standard PR review process
