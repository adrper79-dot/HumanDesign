#!/usr/bin/env node
/**
 * deploy-stage.js — Advances a pipeline item through its current stage.
 *
 * Called by the orchestrating agent after completing work for a stage.
 * Records stage result, advances to next stage or marks complete/failed.
 *
 * Usage:
 *   node scripts/deploy-stage.js <itemId> prep    [--ok|--fail "reason"]
 *   node scripts/deploy-stage.js <itemId> install [--ok|--fail "reason"] [--files f1,f2]
 *   node scripts/deploy-stage.js <itemId> validate [--ok|--fail "reason"] [--tests "3 pass, 0 fail"]
 *   node scripts/deploy-stage.js <itemId> observe [--ok|--skip]
 *   node scripts/deploy-stage.js <itemId> document [--ok|--skip] [--docs d1,d2]
 *   node scripts/deploy-stage.js <itemId> complete
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
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
};

const STAGES = ['prep', 'install', 'validate', 'observe', 'document'];

function readPipeline() {
  return JSON.parse(readFileSync(PIPELINE_PATH, 'utf8'));
}

function writePipeline(pipeline) {
  pipeline.updatedAt = new Date().toISOString();
  writeFileSync(PIPELINE_PATH, JSON.stringify(pipeline, null, 2), 'utf8');
}

function findItem(pipeline, itemId) {
  for (const phase of pipeline.phases) {
    for (const item of phase.items) {
      if (item.id === itemId) return item;
    }
  }
  return null;
}

// ─── Parse CLI ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
const itemId = args[0];
const stage = args[1];

if (!itemId || !stage) {
  console.log('Usage: node scripts/deploy-stage.js <itemId> <stage> [--ok|--fail "reason"] [--files f1,f2] [--tests "summary"]');
  console.log('Stages:', STAGES.join(', '), '+ complete');
  process.exit(1);
}

const pipeline = readPipeline();
const item = findItem(pipeline, itemId);

if (!item) {
  console.log(C.red(`Item ${itemId} not found in pipeline`));
  process.exit(1);
}

const isFail = args.includes('--fail');
const isOk = args.includes('--ok');
const isSkip = args.includes('--skip');

const failReason = isFail ? args[args.indexOf('--fail') + 1] : null;
const files = args.includes('--files')
  ? args[args.indexOf('--files') + 1]?.split(',')
  : null;
const tests = args.includes('--tests')
  ? args[args.indexOf('--tests') + 1]
  : null;
const docs = args.includes('--docs')
  ? args[args.indexOf('--docs') + 1]?.split(',')
  : null;

// ─── Stage: complete ────────────────────────────────────────────────

if (stage === 'complete') {
  // Verify all stages passed
  const requiredStages = ['prep', 'install', 'validate'];
  const missing = requiredStages.filter(s => !item.stages?.[s] || item.stages[s].status !== 'pass');

  if (missing.length > 0) {
    console.log(C.yellow(`Warning: stages not passed: ${missing.join(', ')}`));
  }

  item.status = 'complete';
  item.currentStage = null;
  item.completedAt = new Date().toISOString();
  writePipeline(pipeline);

  // Print green confirmation
  const border = '═'.repeat(60);
  console.log('\n' + C.green(border));
  console.log(C.green(C.bold(`  ✅ ITEM ${item.id} COMPLETE — ${item.title}`)));
  console.log(C.green(`  Phase: ${item.phase}`));
  console.log(C.green(`  Duration: ${timeDiff(item.startedAt, item.completedAt)}`));
  if (item.stages) {
    for (const [s, info] of Object.entries(item.stages)) {
      const icon = info.status === 'pass' ? '✓' : info.status === 'skip' ? '⏭' : '✗';
      const detail = info.details ? ` — ${info.details}` : '';
      const fileCount = info.files ? ` (${info.files.length} files)` : '';
      console.log(C.green(`    ${icon} ${s}${detail}${fileCount}`));
    }
  }
  console.log(C.green(border));

  // Count remaining
  let remaining = 0, completed = 0;
  for (const phase of pipeline.phases) {
    for (const i of phase.items) {
      if (i.status === 'complete') completed++;
      else remaining++;
    }
  }
  const total = completed + remaining;
  const pct = Math.round((completed / total) * 100);
  console.log(C.green(C.bold(`\n  Progress: ${completed}/${total} (${pct}%)`)));
  console.log(C.green(C.bold('  → Rolling to next item...\n')));
  process.exit(0);
}

// ─── Regular stage recording ────────────────────────────────────────

if (!STAGES.includes(stage)) {
  console.log(C.red(`Unknown stage: ${stage}. Valid: ${STAGES.join(', ')}, complete`));
  process.exit(1);
}

// Initialize
if (!item.stages) item.stages = {};
if (!item.startedAt) item.startedAt = new Date().toISOString();
if (item.status === 'pending') item.status = 'in-progress';

item.currentStage = stage;

const stageResult = {
  status: isFail ? 'fail' : isSkip ? 'skip' : 'pass',
  timestamp: new Date().toISOString(),
};

if (failReason) stageResult.details = failReason;
if (files) stageResult.files = files;
if (tests) stageResult.details = tests;
if (docs) stageResult.docs = docs;

// Record specific details per stage
if (stage === 'prep' && !isFail) {
  stageResult.details = stageResult.details || 'Context gathered';
}
if (stage === 'install' && !isFail) {
  stageResult.details = stageResult.details || `${files?.length || 0} files modified`;
}
if (stage === 'validate' && !isFail) {
  stageResult.details = stageResult.details || tests || 'Tests passed';
}
if (stage === 'observe') {
  stageResult.details = stageResult.details || (isSkip ? 'No analytics needed' : 'Analytics wired');
}
if (stage === 'document') {
  stageResult.details = stageResult.details || (isSkip ? 'No doc updates needed' : `Updated: ${docs?.join(', ') || 'docs'}`);
}

item.stages[stage] = stageResult;

if (isFail) {
  item.status = 'failed';
  item.failureReason = failReason || `Failed at ${stage}`;
  writePipeline(pipeline);

  console.log(C.red(`❌ ${item.id} — ${stage} FAILED: ${item.failureReason}`));
  console.log(C.yellow('Pipeline paused. Fix and re-run to continue.'));
  process.exit(1);
}

writePipeline(pipeline);

const stageIcon = isSkip ? '⏭️' : '✅';
console.log(`${stageIcon} ${C.cyan(item.id)} ${stage}: ${C.green(stageResult.status)}${stageResult.details ? ' — ' + stageResult.details : ''}`);

// Suggest next stage
const currentIdx = STAGES.indexOf(stage);
if (currentIdx < STAGES.length - 1) {
  const nextStage = STAGES[currentIdx + 1];
  console.log(C.dim(`  Next: ${nextStage}`));
} else {
  console.log(C.yellow(`  All stages done — run: node scripts/deploy-stage.js ${itemId} complete`));
}

function timeDiff(start, end) {
  if (!start || !end) return 'unknown';
  const ms = new Date(end) - new Date(start);
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h ${m % 60}m`;
}
