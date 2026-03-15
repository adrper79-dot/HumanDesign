/**
 * collectors/code-quality.js
 * Static analysis of the workers/src directory using Node.js fs + regex.
 * Cross-platform — no shell grep dependency.
 *
 * Returns: { summary, findings }
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, join, extname } from 'path';

const WORKERS_SRC = resolve(process.cwd(), 'workers', 'src');

/** Recursively collect all .js files under a directory. */
function walk(dir) {
  const files = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return files; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      files.push(...walk(full));
    } else if (extname(full) === '.js') {
      files.push(full);
    }
  }
  return files;
}

/** Search a file's lines for a regex, return { file, line, snippet } matches. */
function scanFile(filePath, pattern) {
  let content;
  try { content = readFileSync(filePath, 'utf8'); } catch { return []; }
  const lines = content.split('\n');
  const matches = [];
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      matches.push({
        file: filePath.replace(process.cwd(), '').replace(/\\/g, '/'),
        line: i + 1,
        snippet: lines[i].trim().slice(0, 120),
      });
    }
  }
  return matches;
}

export async function collectCodeQuality() {
  const files = walk(WORKERS_SRC);
  const findings = [];

  for (const file of files) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const lines = content.split('\n');
    const relPath = file.replace(process.cwd(), '').replace(/\\/g, '/');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const snippet = line.trim().slice(0, 120);

      // ── 1. Unstructured console.log/error/warn ──
      if (/console\.(log|error|warn|debug)\(/.test(line)) {
        // Skip if already structured (contains requestId or JSON.stringify)
        if (!line.includes('requestId') && !line.includes('JSON.stringify')) {
          findings.push({ file: relPath, line: lineNum, snippet, type: 'unstructured-log', severity: 'P2' });
        }
      }

      // ── 2. Hardcoded secrets ──
      if (/sk_live_|sk_test_|whsec_/.test(line)) {
        findings.push({ file: relPath, line: lineNum, snippet, type: 'hardcoded-secret', severity: 'P0' });
      }
      // Hardcoded Bearer JWT (eyJ = base64 start of a JWT header)
      if (/Bearer\s+eyJ/.test(line)) {
        findings.push({ file: relPath, line: lineNum, snippet, type: 'hardcoded-secret', severity: 'P0' });
      }

      // ── 3. TODO / FIXME / HACK comments ──
      if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(line) && findings.filter(f => f.type === 'tech-debt-comment').length < 20) {
        findings.push({ file: relPath, line: lineNum, snippet, type: 'tech-debt-comment', severity: 'P2' });
      }
    }

    // ── 4. Empty catch blocks (multi-line pattern) ──
    const emptyCatch = /catch\s*\([^)]*\)\s*\{\s*\}/g;
    let m;
    while ((m = emptyCatch.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split('\n').length;
      findings.push({
        file: relPath, line: lineNum,
        snippet: m[0].trim().slice(0, 120),
        type: 'empty-catch', severity: 'P1',
      });
    }
  }

  // ── Summary ──
  const byType = findings.reduce((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {});

  return {
    summary: {
      totalFindings:    findings.length,
      hardcodedSecrets: byType['hardcoded-secret']  || 0,
      emptyCatchBlocks: byType['empty-catch']        || 0,
      unstructuredLogs: byType['unstructured-log']   || 0,
      techDebtComments: byType['tech-debt-comment']  || 0,
      filesScanned:     files.length,
    },
    findings: findings.slice(0, 100),
  };
}
