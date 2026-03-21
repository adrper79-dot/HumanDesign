import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('GAP-006 Frequency Keys corpus — vocabulary replacement completion', () => {
  it('maintains corpus structure: keys.json, generate-missing.js, and README', () => {
    const dir = path.join(ROOT, 'src/knowledgebase/genekeys');
    const files = fs.readdirSync(dir).sort();

    expect(files).toEqual(['README.md', 'generate-missing.js', 'keys.json']);
  });

  it('documents that vocabulary replacement is complete and freeze is lifted', () => {
    const kbReadme = read('src/knowledgebase/genekeys/README.md');
    
    expect(kbReadme).toContain('REPLACEMENT COMPLETE');
    expect(kbReadme).toContain('GAP-006');
    expect(kbReadme).toContain('Noise/Signal/Frequency');
    expect(kbReadme).toContain('no borrowed content');
  });

  it('maintains GENE_KEYS_DISCLAIMER scaffold as inert infrastructure', () => {
    const rag = read('src/prompts/rag.js');
    const engineCompat = read('workers/src/engine-compat.js');

    expect(rag).toContain('GENE_KEYS_DISCLAIMER');
    expect(engineCompat).toContain('GENE_KEYS_DISCLAIMER');
  });

  it('updates terms.html attribution to reflect original Prime Self system', () => {
    const terms = read('frontend/terms.html');

    expect(terms).toContain('Framework Attribution');
    expect(terms).toContain('Frequency Keys');
    expect(terms).toContain('Noise, Signal, Frequency');
    expect(terms).not.toContain('Third-Party Framework Notice');
    expect(terms).not.toContain('inspired by the Gene Keys');
  });

  it('documents the corpus replacement process', () => {
    const brief = read('docs/GAP-006_FREQUENCY_KEYS_CORPUS_REPLACEMENT_PLAN_2026-03-20.md');

    expect(brief).toContain('Noise / Signal / Frequency');
    expect(brief).toContain('Prime Self Philosophical Foundation');
    expect(brief).toContain('192 replacement labels');
    expect(brief).toContain('Vocabulary Standard Reference');
  });
});