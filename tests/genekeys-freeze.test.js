import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('GAP-006 corpus freeze guard', () => {
  it('keeps the Gene Keys corpus directory frozen to the expected files', () => {
    const dir = path.join(ROOT, 'src/knowledgebase/genekeys');
    const files = fs.readdirSync(dir).sort();

    expect(files).toEqual(['README.md', 'generate-missing.js', 'keys.json']);
  });

  it('keeps the corpus freeze notice and counsel hooks in place', () => {
    const kbReadme = read('src/knowledgebase/genekeys/README.md');
    const rag = read('src/prompts/rag.js');
    const terms = read('frontend/terms.html');
    const engineCompat = read('workers/src/engine-compat.js');

    expect(kbReadme).toContain('STATUS: FROZEN');
    expect(kbReadme).toContain('GAP-006');
    expect(rag).toContain('GENE_KEYS_DISCLAIMER');
    expect(engineCompat).toContain('GENE_KEYS_DISCLAIMER');
    expect(terms).toContain('Third-Party Framework Notice');
    expect(terms).toContain('Gene Keys is a registered trademark of Gene Keys Publishing Ltd.');
  });

  it('documents the legal review packet for counsel', () => {
    const brief = read('docs/GAP-006_GENE_KEYS_LEGAL_REVIEW_BRIEF_2026-03-20.md');

    expect(brief).toContain('Two-Layer IP Distinction');
    expect(brief).toContain('Outcome B: Attribution + disclaimer sufficient');
    expect(brief).toContain('triad names');
    expect(brief).toContain('Courtesy outreach to Gene Keys Publishing Ltd remains recommended');
  });
});