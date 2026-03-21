# GAP-006 — Gene Keys Legal Review Brief

Status: Legal determination received — Outcome B (attribution + disclaimer sufficient)

Owner: Product / Legal

Related issue: GAP-006 in [audits/issue-registry.json](audits/issue-registry.json)

## Executive Summary

Prime Self has already rebranded customer-facing references from Gene Keys to Frequency Keys, but the application still contains a structured internal corpus derived from the Gene Keys framework and uses that corpus during AI synthesis.

Legal review conclusion: Outcome B. Attribution plus disclaimer is sufficient for the current commercial posture. The material correction is that the corpus is not a single block of internally authored content. It has two distinct IP layers with different risk profiles.

This brief is intended to give counsel a precise inventory and a decision framework.

## Current External Behavior

- Customer-facing product copy primarily uses Frequency Keys rather than Gene Keys.
- The synthesis pipeline can still use internal `geneKeys` data during chart/profile generation.
- Terms already contain attribution placeholders for counsel-directed language.
- The RAG pipeline already supports a counsel-supplied disclaimer flag via `globalThis.__PRIME_DATA.GENE_KEYS_DISCLAIMER`.

## Corpus Inventory

### Canonical corpus directory

Directory: `src/knowledgebase/genekeys/`

Files present:

1. `README.md`
2. `keys.json`
3. `generate-missing.js`

### Structured content volume

- `keys.json` contains 64 structured entries keyed by gate number.
- Each entry includes:
  - `name`
  - `shadow`
  - `gift`
  - `siddhi`
  - `archetype`
  - `message`
  - `shadowDescription`
  - `giftDescription`
  - `siddhiDescription`
  - `contemplation`

### Two-Layer IP Distinction

| Layer | Example | Authorship / Risk | Counsel View |
|------|---------|-------------------|--------------|
| Triad names | `Entropy / Freshness / Beauty`, `Conflict / Diplomacy / Peace` | Matches Richard Rudd's published Gene Keys corpus; medium-risk compilation gray zone | Attribution + disclaimer sufficient at current revenue / product posture; courtesy outreach recommended |
| Descriptive prose | `shadowDescription`, `giftDescription`, `siddhiDescription`, `message`, `contemplation` | Internally authored original prose | Low risk; not infringing if genuinely original |

### Classification

#### A. Triad-name layer derived from Gene Keys source material

Files:

- `src/knowledgebase/genekeys/keys.json`

Assessment:

- The gate-level `shadow`, `gift`, and `siddhi` labels are the actual Gene Keys triad assignments.
- Individual short phrases likely have thin standalone protection, but the full 64-gate assignment can plausibly be argued as a creative compilation.
- This is the actual IP gray zone and should not be described as internally authored.

#### B. Internally authored descriptive prose

Files:

- `src/knowledgebase/genekeys/keys.json`

Assessment:

- `shadowDescription`, `giftDescription`, `siddhiDescription`, `message`, and `contemplation` appear to be internally authored and materially distinct from Richard Rudd's published prose style.
- No verbatim excerpts from published Gene Keys books were identified in the reviewed prose.
- Copyright does not protect the underlying system or ideas, only expression.

#### C. Structural / implementation references only

Files:

- `src/engine/genekeys.js`
- `src/engine/index.js`
- `src/prompts/rag.js`
- `src/prompts/synthesis.js`
- `workers/src/engine-compat.js`
- `workers/src/handlers/profile.js`
- `workers/src/handlers/profile-stream.js`
- `workers/src/lib/displayNames.js`

Assessment:

- These references are internal implementation plumbing and variable names.
- They are not intended as customer-facing branding.
- They should remain documented as internal compatibility names until legal disposition is final.

#### D. Customer-facing references reviewed

Files reviewed with active customer-facing copy:

- `frontend/index.html`
- `frontend/locales/*.json`
- `frontend/terms.html`
- `workers/src/lib/email.js`
- `workers/src/handlers/practitioner-directory.js`

Assessment:

- Live product copy primarily uses Frequency Keys.
- `frontend/terms.html` contains placeholder markers for counsel-directed attribution/disclaimer text.
- Practitioner directory posture is already acceptable: certifications are whitelisted and do not expose a dedicated Gene Keys certification path; specializations use Frequency Keys.

#### E. Secondary references not core to synthesis corpus

Files:

- `src/knowledgebase/prime_self/sciences_canonical.json`
- `src/knowledgebase/prime_self/book_recommendations.json`
- `frontend/screenshots/README.md`
- `frontend/icons/README.md`

Assessment:

- These are not the primary liability source, but they show the repo still retains explicit Gene Keys references in ancillary content.
- Counsel should treat them as lower-risk references relative to the corpus itself.

## Runtime Usage Path

1. `src/engine/genekeys.js`
   - derives six profile positions from existing gate data.

2. `workers/src/engine-compat.js`
   - bundles `src/knowledgebase/genekeys/keys.json` into runtime data.

3. `src/prompts/rag.js`
   - loads `genekeys/keys.json`
   - injects up to eight Frequency Key entries into RAG context
   - already supports a future legal disclaimer append path

4. `workers/src/handlers/profile.js` and `workers/src/handlers/profile-stream.js`
   - pass `geneKeys` data into synthesis payloads
   - return `geneKeys` chart data internally in API responses

## Counsel Ruling Summary

### Q1. Does the corpus require a license?

- Triad names: gray area, but not severe enough to require immediate replacement. Attribution + disclaimer is sufficient for current use. Courtesy outreach is recommended.
- Descriptive prose: no license required if internally authored.
- Framework / position mapping: no license required; systems and methods are not copyrightable.

### Q2. If no license is required, is attribution sufficient?

Yes. Attribution plus disclaimer is sufficient for the current product posture. Outreach to Gene Keys Publishing Ltd is recommended as a relationship-management step, not as a blocker.

### Q3. Are internal `geneKeys` variable names acceptable?

Yes. Internal identifiers are not trademark use in commerce.

### Q4. Does practitioner self-identification create additional risk?

No material current risk. Certification validation already excludes Gene Keys as a dedicated system option.

### Q5. Is Frequency Keys sufficiently differentiated as branding?

Yes. The customer-facing brand separation is adequate for trademark purposes.

## Existing Mitigations Already In Repo

- Customer-facing rename from Gene Keys to Frequency Keys on primary UI surfaces.
- Content-freeze README in `src/knowledgebase/genekeys/README.md`.
- Terms placeholder block in `frontend/terms.html`.
- RAG disclaimer scaffolding in `src/prompts/rag.js`.

## Counsel Questions

Resolved by counsel ruling captured in this brief.

## Outcome Matrix

### Outcome A: Fair use / low-risk derived use

Required implementation:

- Fill `frontend/terms.html` attribution/disclaimer block with counsel-approved text.
- Set and surface `GENE_KEYS_DISCLAIMER` in synthesis output path as directed.
- Record written legal determination in repo docs and issue registry.

### Outcome B: Attribution + disclaimer sufficient

Required implementation:

- Fill `frontend/terms.html` attribution/disclaimer block with trademark and non-affiliation language.
- Activate `GENE_KEYS_DISCLAIMER` in synthesis output so technical insights carry the same disclosure.
- Preserve the current Frequency Keys customer-facing rebrand.
- Keep the corpus freeze in place unless later legal posture changes.
- Prepare courtesy outreach to Gene Keys Publishing Ltd.

### Outcome C: License required or use not defensible

Required implementation:

- Stop relying on the current corpus for commercial synthesis.
- Replace `keys.json` with an independently commissioned non-derived corpus or a licensed corpus.
- Remove or rework any synthesis features that depend on the protected framework until replacement is complete.

## Recommended Interim Policy

Post-ruling operating policy:

- Keep the corpus frozen.
- Do not expand `src/knowledgebase/genekeys/` without new legal review.
- Do not add new Gene Keys-derived content elsewhere in the repo.
- Do not revert the customer-facing Frequency Keys rebrand.
- Treat `geneKeys` variable names as internal compatibility names only.

## Internal Prep Completed In This Pass

- Corpus and runtime usage inventoried.
- Counsel brief corrected to distinguish triad names from descriptive prose.
- Freeze policy already documented in corpus README.
- Automated freeze guard added in `tests/genekeys-freeze.test.js`.
- Terms attribution/disclaimer added.
- Runtime synthesis disclaimer activated.

## External Follow-Up

- Courtesy outreach to Gene Keys Publishing Ltd remains recommended; use `docs/GAP-006_GENE_KEYS_COURTESY_OUTREACH_TEMPLATE.md` if Product wants a ready-to-send note.
- Corpus replacement is not required under the current ruling.