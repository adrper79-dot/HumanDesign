#!/usr/bin/env node
/**
 * lint-trust-proof.js — WC-P1-5 content lint
 *
 * Validates trust proof items against the required metadata schema.
 * Run as: node scripts/lint-trust-proof.js
 *
 * Items must be defined in frontend/js/trust-proof-content.js
 * (or passed via --file <path>) as:
 *
 *   window.TRUST_PROOF_ITEMS = [
 *     {
 *       role: "Practitioner · Sydney",      // required — role/title/location
 *       outcome: "...",                     // required — specific result, no hype claims
 *       consentStatus: "confirmed",         // required — must be "confirmed"
 *       date: "2026-01",                    // required — YYYY-MM format
 *       name: "Alex T.",                    // optional — can omit if anonymised by request
 *     },
 *     ...
 *   ];
 *
 * Exit codes:
 *   0 — all items pass, minimum count met
 *   1 — validation errors found or minimum count not met
 */

const fs   = require('fs');
const path = require('path');

const MIN_ITEMS = 5;
const REQUIRED_FIELDS = ['role', 'outcome', 'consentStatus', 'date'];
const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /placeholder/i,
  /todo/i,
  /tbd/i,
  /\[.*?\]/,           // [Client Name], [Outcome Here]
  /OUTCOME_HERE/i,
  /ROLE_HERE/i,
];

// Locate content file
const args = process.argv.slice(2);
const fileArg = args.indexOf('--file');
const contentFile = fileArg !== -1
  ? path.resolve(args[fileArg + 1])
  : path.resolve(__dirname, '../frontend/js/trust-proof-content.js');

if (!fs.existsSync(contentFile)) {
  console.log(`[trust-proof] Content file not found: ${contentFile}`);
  console.log('[trust-proof] Create frontend/js/trust-proof-content.js with window.TRUST_PROOF_ITEMS array.');
  console.log('[trust-proof] See docs/ADR-001-mobile-distribution-v1.md for format.');
  process.exit(1);
}

// Extract items from the JS file (simple eval in a sandbox-like context)
let items;
try {
  const src = fs.readFileSync(contentFile, 'utf8');
  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', src)(window);
  items = window.TRUST_PROOF_ITEMS;
} catch (e) {
  console.error(`[trust-proof] Failed to parse ${contentFile}: ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(items)) {
  console.error('[trust-proof] window.TRUST_PROOF_ITEMS must be an array.');
  process.exit(1);
}

let errors = 0;
let warnings = 0;

console.log(`[trust-proof] Checking ${items.length} item(s)...\n`);

items.forEach((item, idx) => {
  const label = `Item [${idx}]${item.name ? ` (${item.name})` : ''}`;

  // Required fields
  REQUIRED_FIELDS.forEach(field => {
    if (!item[field] || String(item[field]).trim().length === 0) {
      console.error(`  ERROR ${label}: missing required field "${field}"`);
      errors++;
    }
  });

  // Consent must be confirmed
  if (item.consentStatus && item.consentStatus !== 'confirmed') {
    console.error(`  ERROR ${label}: consentStatus must be "confirmed", got "${item.consentStatus}"`);
    errors++;
  }

  // Date format YYYY-MM
  if (item.date && !/^\d{4}-\d{2}$/.test(item.date)) {
    console.warn(`  WARN  ${label}: date should be YYYY-MM format, got "${item.date}"`);
    warnings++;
  }

  // Placeholder text check
  PLACEHOLDER_PATTERNS.forEach(pattern => {
    ['outcome', 'role'].forEach(field => {
      if (item[field] && pattern.test(String(item[field]))) {
        console.error(`  ERROR ${label}: field "${field}" contains placeholder text: "${item[field]}"`);
        errors++;
      }
    });
  });

  // Outcome minimum length (20 chars)
  if (item.outcome && String(item.outcome).trim().length < 20) {
    console.warn(`  WARN  ${label}: outcome is very short (<20 chars). Ensure it describes a real outcome.`);
    warnings++;
  }

  // Valid items summary
  if (errors === 0) {
    console.log(`  OK    ${label}: ${item.role} · ${item.date}`);
  }
});

console.log('');

// Minimum count check (only confirmed+valid items)
const validCount = items.filter(item =>
  REQUIRED_FIELDS.every(f => item[f] && String(item[f]).trim()) &&
  item.consentStatus === 'confirmed'
).length;

if (validCount < MIN_ITEMS) {
  console.error(`ERROR: Only ${validCount} valid item(s). Minimum required: ${MIN_ITEMS}.`);
  errors++;
} else {
  console.log(`OK: ${validCount} valid item(s) — minimum ${MIN_ITEMS} met.`);
}

if (warnings > 0) console.log(`\n${warnings} warning(s).`);
if (errors > 0) {
  console.error(`\n${errors} error(s). Fix before publishing trust proof block.`);
  process.exit(1);
} else {
  console.log('\nAll checks passed. Trust proof block is ready to publish.');
  process.exit(0);
}
