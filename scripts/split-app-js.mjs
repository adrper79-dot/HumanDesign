/**
 * split-app-js.mjs  — GAP-001: Split app.js into controller modules.
 *
 * Extracts defined line ranges from frontend/js/app.js into separate
 * controller files under frontend/js/controllers/.  Replaces each
 * extracted block in app.js with a 1-line comment stub so the line
 * numbers shift predictably and the file can be diffed cleanly.
 *
 * Usage:
 *   node scripts/split-app-js.mjs [--dry-run]
 *
 * --dry-run  Print what would be extracted without writing files.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, '..');
const APP_JS     = resolve(ROOT, 'frontend/js/app.js');
const CTRL_DIR   = resolve(ROOT, 'frontend/js/controllers');
const DRY_RUN    = process.argv.includes('--dry-run');

// ─── Controller extraction plan ──────────────────────────────────────────────
//
// Each entry defines:
//   file:    output filename under frontend/js/controllers/
//   start:   first line to extract (1-based, inclusive)
//   end:     last line to extract  (1-based, inclusive)
//   stub:    replacement comment left in app.js at the extraction site
//   windowExports: functions that need window.X = X assignments (for onclick handlers).
//                  Only needed for functions NOT already assigned in the extracted block.
//
// Line numbers verified against app.js structural map (2026-03-20).
// ─────────────────────────────────────────────────────────────────────────────
const CONTROLLERS = [
  {
    file:  'billing-controller.js',
    start: 1537,
    end:   1983,
    stub:  '// ── Billing / Pricing — extracted to controllers/billing-controller.js ──────',
    desc:  'Pricing modals, Stripe checkout, billing portal, upgrade prompts',
  },
  // Practitioner is split into 4 sub-controllers to keep each under 1,000 lines.
  // All 4 are loaded together when the practitioner tab is first activated.
  {
    file:  'practitioner-clients.js',
    start: 5124,
    end:   5718,
    stub:  '// ── Practitioner Clients — extracted to controllers/practitioner-clients.js ──',
    desc:  'Client roster load/render, client portal, practitioner messages, invitations, referral stats',
  },
  {
    file:  'practitioner-marketing.js',
    start: 5719,
    end:   6543,
    stub:  '// ── Practitioner Marketing — extracted to controllers/practitioner-marketing.js',
    desc:  'Referral performance, marketing kit, gifts, earnings, promo codes, metrics, agency seats',
  },
  {
    file:  'practitioner-management.js',
    start: 6544,
    end:   7068,
    stub:  '// ── Practitioner Management — extracted to controllers/practitioner-management.js',
    desc:  'Activation plan, lifecycle badge, roster rendering, client detail view, reminder, checklist',
  },
  {
    file:  'practitioner-notes.js',
    start: 7069,
    end:   7829,
    stub:  '// ── Practitioner Notes — extracted to controllers/practitioner-notes.js ───────',
    desc:  'Session notes CRUD, note templates, divination readings, session actions, AI context, directory profile, reviews, CSV, Notion, remove client',
  },
  {
    file:  'clustering-controller.js',
    start: 7831,
    end:   8386,
    stub:  '// ── Clusters — extracted to controllers/clustering-controller.js ─────────────',
    desc:  'Group clusters, cluster synthesis, member management',
  },
  {
    file:  'achievements-controller.js',
    // celebrity + achievements share a tab so extract together
    start: 11553,
    end:   11798,
    stub:  '// ── Celebrity / Achievements — extracted to controllers/achievements-controller.js ──',
    desc:  'Celebrity matches, achievement badges, leaderboard',
  },
];

// ─── File-level header added to every controller ────────────────────────────
function controllerHeader(file, desc) {
  return `/**
 * ${file}
 * Auto-extracted from frontend/js/app.js by scripts/split-app-js.mjs (GAP-001).
 *
 * ${desc}
 *
 * Depends on globals defined in app.js (always loaded first):
 *   apiFetch, token, currentUser, escapeHtml, showNotification,
 *   openAuthOverlay, switchTab, showUpgradePrompt, writeJourneyFlag, readJourneyFlag
 *
 * This file is loaded lazily via _loadController() in app.js when the
 * relevant tab is first activated.  Do not add <script> tags for this
 * file to index.html — the loader handles it.
 */
`;
}

// ─── Main ────────────────────────────────────────────────────────────────────
const appLines = readFileSync(APP_JS, 'utf8').split('\n');
const totalLines = appLines.length;

console.log(`[split-app-js] app.js: ${totalLines} lines`);

if (!DRY_RUN) {
  mkdirSync(CTRL_DIR, { recursive: true });
}

// Process extractions from BOTTOM to TOP so line numbers stay valid after
// each splice (each extraction shrinks the array).
const sorted = [...CONTROLLERS].sort((a, b) => b.start - a.start);

const extractions = [];

for (const ctrl of sorted) {
  const { file, start, end, stub, desc } = ctrl;
  // Convert to 0-based indices
  const s = start - 1;
  const e = end - 1;

  if (e >= totalLines) {
    console.error(`[split-app-js] ERROR: ${file} end line ${end} exceeds file length ${totalLines}`);
    process.exit(1);
  }

  const extracted = appLines.slice(s, e + 1);
  extractions.push({ file, extracted, desc });

  console.log(`[split-app-js] Extracting ${file}: lines ${start}-${end} (${extracted.length} lines)`);

  if (!DRY_RUN) {
    // Write the controller file
    const outPath = resolve(CTRL_DIR, file);
    const content = controllerHeader(file, desc) + extracted.join('\n') + '\n';
    writeFileSync(outPath, content, 'utf8');
    console.log(`  → wrote ${outPath}`);
  }

  // Replace extracted lines in the array with the stub comment
  appLines.splice(s, extracted.length, stub);
}

if (!DRY_RUN) {
  // Write trimmed app.js
  const trimmed = appLines.join('\n');
  writeFileSync(APP_JS, trimmed, 'utf8');
  const newLines = trimmed.split('\n').length;
  console.log(`\n[split-app-js] app.js trimmed: ${totalLines} → ${newLines} lines (removed ${totalLines - newLines} lines)`);

  // Summary
  console.log('\nExtracted controllers:');
  for (const { file, extracted } of extractions) {
    console.log(`  controllers/${file}  (${extracted.length} lines)`);
  }
  const pct = (((totalLines - newLines) / totalLines) * 100).toFixed(1);
  console.log(`\nFirst-load payload reduction: ~${pct}% of app.js excluded from initial parse`);
} else {
  console.log('\n[split-app-js] DRY RUN — no files written.');
  for (const { file, extracted } of extractions) {
    console.log(`  Would create controllers/${file}  (${extracted.length} lines)`);
  }
}
