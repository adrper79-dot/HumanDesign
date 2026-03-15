/**
 * collectors/test-results.js
 * Runs the vitest suite and returns structured pass/fail data.
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const OUTPUT_FILE = resolve(process.cwd(), 'tests', 'results', 'latest.json');

export async function collectTestResults() {
  let stdout = '';
  let exitCode = 0;

  try {
    stdout = execSync(
      'npx vitest run --reporter=json --outputFile=tests/results/latest.json 2>&1 || true',
      { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (err) {
    stdout = err.stdout || '';
    exitCode = err.status || 1;
  }

  // Parse JSON output file written by vitest --reporter=json
  if (existsSync(OUTPUT_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'));
      return parseVitestJson(raw);
    } catch {
      // Fall through to stdout parsing
    }
  }

  // Fallback: parse vitest text output for summary line
  return parseVitestText(stdout, exitCode);
}

function parseVitestJson(raw) {
  const failures = [];

  for (const file of (raw.testResults || [])) {
    for (const result of (file.assertionResults || [])) {
      if (result.status === 'failed') {
        failures.push({
          name: result.fullName || result.title,
          file: file.testFilePath?.replace(process.cwd(), '').replace(/\\/g, '/'),
          error: result.failureMessages?.[0]?.split('\n')[0] || 'Unknown error',
        });
      }
    }
  }

  return {
    total:   raw.numTotalTests    || 0,
    passed:  raw.numPassedTests   || 0,
    failed:  raw.numFailedTests   || 0,
    skipped: raw.numPendingTests  || 0,
    failures,
  };
}

function parseVitestText(stdout, exitCode) {
  // Extract summary line: "Tests  263 passed (263)"
  const passMatch  = stdout.match(/(\d+)\s+passed/);
  const failMatch  = stdout.match(/(\d+)\s+failed/);
  const totalMatch = stdout.match(/Tests\s+(\d+)/);

  const passed  = passMatch  ? parseInt(passMatch[1])  : 0;
  const failed  = failMatch  ? parseInt(failMatch[1])  : 0;
  const total   = totalMatch ? parseInt(totalMatch[1]) : passed + failed;

  return {
    total,
    passed,
    failed,
    skipped: Math.max(0, total - passed - failed),
    failures: failed > 0 ? [{ name: 'See raw output', file: 'stdout', error: 'Could not parse individual failures' }] : [],
    rawOutput: stdout.slice(0, 2000),
  };
}
