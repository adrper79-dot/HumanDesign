#!/usr/bin/env node
/**
 * count-issues.js — CLI for the GH Actions P0 launch gate.
 *
 * Usage:
 *   node scripts/count-issues.js --severity P0 --status open
 *
 * Exits with code 1 if matching count > 0 (blocks deploy).
 * Exits with code 0 otherwise.
 * Prints the count to stdout.
 */

import { readRegistry } from './audit-state.js';

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const severity = getArg('severity');  // P0, P1, P2, or null (all)
const status   = getArg('status');    // open, resolved, or null (all)

const registry = readRegistry();

const filtered = registry.issues.filter(issue => {
  if (severity && issue.severity !== severity) return false;
  if (status   && issue.status   !== status)   return false;
  return true;
});

const count = filtered.length;
process.stdout.write(String(count) + '\n');

// Exit 1 if any issues match — used by GH Actions to fail the build
process.exit(count > 0 ? 1 : 0);
