#!/usr/bin/env node
/**
 * mark-resolved.js — Mark an issue as resolved in the issue registry.
 *
 * Usage:
 *   node scripts/mark-resolved.js CTO-001
 *   node scripts/mark-resolved.js CTO-001 CTO-002   (multiple)
 *   node scripts/mark-resolved.js --list             (show open issues)
 */

import { readRegistry, writeRegistry } from './audit-state.js';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
Usage:
  node scripts/mark-resolved.js <ISSUE-ID> [ISSUE-ID ...]
  node scripts/mark-resolved.js --list

Examples:
  node scripts/mark-resolved.js CTO-001
  node scripts/mark-resolved.js CTO-001 CTO-002 CIO-001
`);
  process.exit(0);
}

const registry = readRegistry();

if (args.includes('--list')) {
  const open = registry.issues.filter(i => i.status === 'open');
  if (open.length === 0) {
    console.log('\n✓ No open issues.\n');
  } else {
    console.log(`\nOpen issues (${open.length}):\n`);
    for (const i of open) {
      console.log(`  [${i.severity}] ${i.id.padEnd(12)} ${i.title}`);
    }
    console.log();
  }
  process.exit(0);
}

const ids = args.filter(a => !a.startsWith('--'));
const today = new Date().toISOString().slice(0, 10);
let resolved = 0;
const notFound = [];

for (const id of ids) {
  const issue = registry.issues.find(i => i.id === id);
  if (!issue) {
    notFound.push(id);
    continue;
  }
  if (issue.status === 'resolved') {
    console.log(`  ℹ  ${id} — already resolved (${issue.resolvedAt})`);
    continue;
  }
  issue.status = 'resolved';
  issue.resolvedAt = today;
  console.log(`  ✓  ${id} — marked resolved`);
  resolved++;
}

if (notFound.length > 0) {
  console.error(`\nNot found in registry: ${notFound.join(', ')}`);
  console.error('Run --list to see valid issue IDs.\n');
}

if (resolved > 0) {
  writeRegistry(registry);

  const remaining = registry.issues.filter(i => i.status === 'open');
  const p0 = remaining.filter(i => i.severity === 'P0').length;
  const p1 = remaining.filter(i => i.severity === 'P1').length;
  const p2 = remaining.filter(i => i.severity === 'P2').length;

  console.log(`
Registry updated.
Remaining open: P0=${p0}  P1=${p1}  P2=${p2}

Next steps:
  node scripts/next-issue.js          ← next P0 to fix
  npm run audit:vitals                ← confirm fix didn't break anything
  git add audits/ && git commit -m "fix: resolve ${ids.join(', ')}"
`);
}

process.exit(notFound.length > 0 ? 1 : 0);
