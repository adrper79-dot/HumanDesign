#!/usr/bin/env node
/**
 * deploy-pipeline.js — Continuous deployment loop for Prime Self V5.
 *
 * Orchestrates the 6-phase revision plan as a sequential pipeline.
 * Each work item flows through 5 stages:
 *   1. PREP    — Gather context from current design (files, queries, patterns)
 *   2. INSTALL — Create/modify files (migration, handler, queries, routes, frontend)
 *   3. VALIDATE — Run new + existing tests, check for regressions
 *   4. OBSERVE  — Wire analytics events + error handling where applicable
 *   5. DOCUMENT — Update feature matrix, architecture, codebase map, guides
 *
 * Usage:
 *   node scripts/deploy-pipeline.js                # run next pending item
 *   node scripts/deploy-pipeline.js --status       # show pipeline status
 *   node scripts/deploy-pipeline.js --phase 0      # run all Phase 0 items
 *   node scripts/deploy-pipeline.js --item 0.1     # run specific item
 *   node scripts/deploy-pipeline.js --reset 0.1    # reset item to pending
 *   node scripts/deploy-pipeline.js --validate     # re-run all tests
 *   node scripts/deploy-pipeline.js --dry-run      # show what would run next
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const PIPELINE_PATH = resolve(ROOT, 'audits', 'deploy-pipeline.json');

// ─── ANSI Colors ────────────────────────────────────────────────────
const C = {
  green:   s => `\x1b[32m${s}\x1b[0m`,
  red:     s => `\x1b[31m${s}\x1b[0m`,
  yellow:  s => `\x1b[33m${s}\x1b[0m`,
  cyan:    s => `\x1b[36m${s}\x1b[0m`,
  bold:    s => `\x1b[1m${s}\x1b[0m`,
  dim:     s => `\x1b[2m${s}\x1b[0m`,
  magenta: s => `\x1b[35m${s}\x1b[0m`,
};

const STAGE_ICONS = {
  pending:   '⬜',
  prep:      '📋',
  install:   '🔧',
  validate:  '🧪',
  observe:   '📊',
  document:  '📝',
  complete:  '✅',
  failed:    '❌',
  skipped:   '⏭️',
};

// ─── Pipeline State ─────────────────────────────────────────────────

function readPipeline() {
  if (!existsSync(PIPELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(PIPELINE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writePipeline(pipeline) {
  writeFileSync(PIPELINE_PATH, JSON.stringify(pipeline, null, 2), 'utf8');
}

// ─── Test Runner ────────────────────────────────────────────────────

function runTests(testFiles = null) {
  const cmd = testFiles
    ? `npx vitest run --maxWorkers=1 ${testFiles.join(' ')}`
    : 'npx vitest run --maxWorkers=1';
  try {
    const output = execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
    return { ok: true, output };
  } catch (err) {
    return { ok: false, output: err.stdout || err.message };
  }
}

// ─── Validation: Check file exists ──────────────────────────────────

function validateFiles(files) {
  const missing = [];
  const found = [];
  for (const f of files) {
    const full = resolve(ROOT, f);
    if (existsSync(full)) {
      found.push(f);
    } else {
      missing.push(f);
    }
  }
  return { found, missing };
}

// ─── Status Display ─────────────────────────────────────────────────

function showStatus(pipeline) {
  console.log('\n' + C.bold('═══ Prime Self V5 — Deployment Pipeline ═══'));
  console.log(C.dim(`Updated: ${pipeline.updatedAt}\n`));

  let completed = 0, total = 0;
  for (const phase of pipeline.phases) {
    console.log(C.bold(C.cyan(`\n── Phase ${phase.id}: ${phase.name} ──`)));
    for (const item of phase.items) {
      total++;
      const icon = STAGE_ICONS[item.status] || '⬜';
      const stage = item.currentStage ? C.dim(` [${item.currentStage}]`) : '';
      const dur = item.completedAt
        ? C.dim(` (${timeDiff(item.startedAt, item.completedAt)})`)
        : '';

      if (item.status === 'complete') {
        completed++;
        console.log(`  ${icon} ${C.green(item.id)} ${item.title}${dur}`);
      } else if (item.status === 'failed') {
        console.log(`  ${icon} ${C.red(item.id)} ${item.title} — ${C.red(item.failureReason || 'unknown')}`);
      } else if (item.currentStage) {
        console.log(`  ${icon} ${C.yellow(item.id)} ${item.title}${stage}`);
      } else {
        console.log(`  ${icon} ${C.dim(item.id)} ${item.title}`);
      }
    }
  }

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const bar = progressBar(pct);
  console.log(`\n${bar} ${C.bold(`${completed}/${total}`)} items complete (${pct}%)\n`);
}

function progressBar(pct, width = 30) {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const color = pct === 100 ? C.green : pct > 50 ? C.yellow : C.red;
  return color('█'.repeat(filled)) + C.dim('░'.repeat(empty));
}

function timeDiff(start, end) {
  if (!start || !end) return '';
  const ms = new Date(end) - new Date(start);
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return `${m}m`;
}

// ─── Get Next Pending Item ──────────────────────────────────────────

function getNextItem(pipeline, opts = {}) {
  for (const phase of pipeline.phases) {
    // Check phase dependencies
    if (phase.dependsOn) {
      const depPhase = pipeline.phases.find(p => p.id === phase.dependsOn);
      if (depPhase && !depPhase.items.every(i => i.status === 'complete' || i.status === 'skipped')) {
        continue; // Skip phases whose dependencies aren't met
      }
    }

    if (opts.phase !== undefined && phase.id !== opts.phase) continue;

    for (const item of phase.items) {
      if (opts.itemId && item.id !== opts.itemId) continue;
      if (item.status === 'pending' || item.status === 'failed') {
        // Check item dependencies
        if (item.dependsOn) {
          const depItem = findItem(pipeline, item.dependsOn);
          if (depItem && depItem.status !== 'complete') continue;
        }
        return { phase, item };
      }
    }
  }
  return null;
}

function findItem(pipeline, itemId) {
  for (const phase of pipeline.phases) {
    for (const item of phase.items) {
      if (item.id === itemId) return item;
    }
  }
  return null;
}

// ─── Stage Transition ───────────────────────────────────────────────

function advanceStage(pipeline, itemId, stage, result = {}) {
  const item = findItem(pipeline, itemId);
  if (!item) return;

  item.currentStage = stage;
  item.stages = item.stages || {};
  item.stages[stage] = {
    status: result.ok !== false ? 'pass' : 'fail',
    timestamp: new Date().toISOString(),
    ...(result.details && { details: result.details }),
    ...(result.files && { files: result.files }),
    ...(result.tests && { tests: result.tests }),
  };

  if (result.ok === false) {
    item.status = 'failed';
    item.failureReason = result.reason || `Failed at ${stage}`;
  }

  pipeline.updatedAt = new Date().toISOString();
  writePipeline(pipeline);
}

function completeItem(pipeline, itemId) {
  const item = findItem(pipeline, itemId);
  if (!item) return;
  item.status = 'complete';
  item.currentStage = null;
  item.completedAt = new Date().toISOString();
  pipeline.updatedAt = new Date().toISOString();
  writePipeline(pipeline);
}

function startItem(pipeline, itemId) {
  const item = findItem(pipeline, itemId);
  if (!item) return;
  item.status = 'in-progress';
  item.startedAt = new Date().toISOString();
  pipeline.updatedAt = new Date().toISOString();
  writePipeline(pipeline);
}

// ─── Print Confirmation ─────────────────────────────────────────────

function printConfirmation(item) {
  const border = '═'.repeat(60);
  console.log('\n' + C.green(border));
  console.log(C.green(C.bold(`  ✅ ${item.id} — ${item.title}`)));
  console.log(C.green(`  Status: COMPLETE`));
  if (item.stages) {
    for (const [stage, info] of Object.entries(item.stages)) {
      const icon = info.status === 'pass' ? '✓' : '✗';
      console.log(C.green(`  ${icon} ${stage}: ${info.status}${info.details ? ' — ' + info.details : ''}`));
    }
  }
  console.log(C.green(border));
  console.log(C.green(C.bold('  → Rolling to next item...\n')));
}

function printFailure(item) {
  const border = '═'.repeat(60);
  console.log('\n' + C.red(border));
  console.log(C.red(C.bold(`  ❌ ${item.id} — ${item.title}`)));
  console.log(C.red(`  Failed at: ${item.currentStage}`));
  console.log(C.red(`  Reason: ${item.failureReason}`));
  console.log(C.red(border));
  console.log(C.yellow('  Pipeline paused. Fix and re-run to continue.\n'));
}

// ─── Context Printer (for agent consumption) ────────────────────────

function printItemContext(item) {
  console.log('\n' + C.bold(C.magenta('─── DEPLOY CONTEXT ───')));
  console.log(C.bold(`Item: ${item.id} — ${item.title}`));
  console.log(`Phase: ${item.phase}`);
  console.log(`Type: ${item.type}`);

  if (item.context) {
    console.log(C.cyan('\n📋 PREP Context:'));
    if (item.context.description) console.log(`  Description: ${item.context.description}`);
    if (item.context.backendFiles) console.log(`  Backend files: ${item.context.backendFiles.join(', ')}`);
    if (item.context.frontendFiles) console.log(`  Frontend files: ${item.context.frontendFiles.join(', ')}`);
    if (item.context.newFiles) console.log(`  New files to create: ${item.context.newFiles.join(', ')}`);
    if (item.context.queries) console.log(`  New queries: ${item.context.queries.join(', ')}`);
    if (item.context.routes) console.log(`  New routes: ${item.context.routes.join(', ')}`);
    if (item.context.migration) console.log(`  Migration: ${item.context.migration}`);
    if (item.context.testFile) console.log(`  Test file: ${item.context.testFile}`);
    if (item.context.analytics) console.log(`  Analytics events: ${item.context.analytics.join(', ')}`);
    if (item.context.docs) console.log(`  Docs to update: ${item.context.docs.join(', ')}`);
    if (item.context.dependsOnFiles) console.log(`  Read first: ${item.context.dependsOnFiles.join(', ')}`);
  }

  console.log(C.magenta('──────────────────────\n'));
}

// ─── CLI ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const pipeline = readPipeline();

if (!pipeline) {
  console.log(C.red('No pipeline found. Run deploy-pipeline-init.js first.'));
  process.exit(1);
}

if (args.includes('--status')) {
  showStatus(pipeline);
  process.exit(0);
}

if (args.includes('--validate')) {
  console.log(C.cyan('Running full test suite...'));
  const result = runTests();
  console.log(result.ok ? C.green('✅ All tests pass') : C.red('❌ Test failures detected'));
  if (!result.ok) console.log(result.output.slice(-2000));
  process.exit(result.ok ? 0 : 1);
}

if (args.includes('--reset')) {
  const itemId = args[args.indexOf('--reset') + 1];
  const item = findItem(pipeline, itemId);
  if (!item) { console.log(C.red(`Item ${itemId} not found`)); process.exit(1); }
  item.status = 'pending';
  item.currentStage = null;
  item.stages = {};
  item.startedAt = null;
  item.completedAt = null;
  item.failureReason = null;
  writePipeline(pipeline);
  console.log(C.yellow(`Reset ${itemId} to pending`));
  process.exit(0);
}

if (args.includes('--dry-run')) {
  const opts = {};
  if (args.includes('--phase')) opts.phase = parseInt(args[args.indexOf('--phase') + 1]);
  if (args.includes('--item')) opts.itemId = args[args.indexOf('--item') + 1];

  const next = getNextItem(pipeline, opts);
  if (!next) {
    console.log(C.green('🎉 All items complete — nothing to deploy!'));
  } else {
    console.log(C.cyan('Next item to deploy:'));
    printItemContext(next.item);
  }
  process.exit(0);
}

// ─── Default: Get next item and print context ───────────────────────

const opts = {};
if (args.includes('--phase')) opts.phase = parseInt(args[args.indexOf('--phase') + 1]);
if (args.includes('--item')) opts.itemId = args[args.indexOf('--item') + 1];

const next = getNextItem(pipeline, opts);
if (!next) {
  console.log(C.green('\n🎉 All pipeline items complete!'));
  showStatus(pipeline);
  process.exit(0);
}

// Print context for the agent/developer
printItemContext(next.item);

// Mark as started
startItem(pipeline, next.item.id);
console.log(C.yellow(`⏳ ${next.item.id} started — awaiting implementation...\n`));
console.log(C.dim('Pipeline stages: PREP → INSTALL → VALIDATE → OBSERVE → DOCUMENT → ✅'));
console.log(C.dim('Use deploy-pipeline.js --status to check progress.\n'));
