#!/usr/bin/env node

/**
 * Comprehensive Codebase Security & Quality Scanner
 * 
 * This script performs all scans recommended in REVIEW_AND_IMPROVEMENT_PLAN.md
 * and categorizes findings by severity.
 * 
 * Usage:
 *   node scripts/scan-codebase.js [--category NAME] [--export json]
 *   node scripts/scan-codebase.js                    # All scans
 *   node scripts/scan-codebase.js --category security # Security only
 *   node scripts/scan-codebase.js --export json      # JSON report
 * 
 * Categories:
 *   - security    (Hardcoded credentials, SQL injection, CSRF, etc.)
 *   - quality     (Monoliths, missing error handling, etc.)
 *   - compliance  (WCAG, GDPR, PCI-DSS)
 *   - integration (Webhooks, rate limiting, caching)
 *   - performance (N+1 queries, large imports, etc.)
 *   - docs        (Missing JSDoc, outdated comments, etc.)
 *   - all         (Run all categories)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command) {
  try {
    return execSync(command, {
      cwd: rootDir,
      encoding: 'utf-8',
      timeout: 30000,
    }).trim();
  } catch (error) {
    return error.stdout || '';
  }
}

// Scanner definitions
const scans = {
  security: [
    {
      name: 'Hardcoded Credentials in Code',
      pattern: 'grep -r "api_key\\|secret\\|password=\\"\\|token=" --include="*.js" --include="*.ts" src/ workers/ frontend/ 2>/dev/null | grep -v "env\\." | grep -v "NEON_CONNECTION" | head -20',
      severity: 'CRITICAL',
      help: 'Credentials should never be hardcoded; use environment variables',
    },
    {
      name: 'Sensitive Data in Logs',
      pattern: 'grep -r "console\\.log\\|console\\.error\\|console\\.warn" workers/src/handlers/ workers/src/middleware/ 2>/dev/null | grep -E "user|email|auth|token|password|key" | grep -v "user_id\\|public" | head -15',
      severity: 'HIGH',
      help: 'Remove sensitive data from log output',
    },
    {
      name: 'SQL Injection Vulnerabilities',
      pattern: 'grep -r "SELECT\\|INSERT\\|UPDATE\\|DELETE" workers/src/db/ 2>/dev/null | grep -v "db\\." | grep -v "\\$\\|\\?" | head -10',
      severity: 'CRITICAL',
      help: 'Use parameterized queries with placeholders ($1, $2, ?)',
    },
    {
      name: 'Missing PKCE in OAuth Flows',
      pattern: 'grep -r "code_challenge\\|code_verifier" workers/src/handlers/ 2>/dev/null | wc -l',
      severity: 'HIGH',
      help: 'OAuth should use PKCE for code exchange',
    },
    {
      name: 'Unvalidated User Input (POST handlers)',
      pattern: 'grep -r "req\\.body\\|req\\.json\\|req\\.query" workers/src/handlers/ 2>/dev/null | wc -l',
      severity: 'CRITICAL',
      help: 'Validate all user input before processing',
    },
    {
      name: 'Unsafe Redirects',
      pattern: 'grep -r "redirect(\\|location\\|Location" workers/src/handlers/ 2>/dev/null | grep "req\\." | grep -v "whitelist\\|redirect_uri.*===\\|allowed" | head -10',
      severity: 'HIGH',
      help: 'Validate redirect targets against whitelist',
    },
    {
      name: 'Exposed Environment Variables in Frontend',
      pattern: 'grep -r "process\\.env\\|import\\.meta\\.env" frontend/js/ 2>/dev/null | grep -v "test\\|debug" | head -10',
      severity: 'CRITICAL',
      help: 'Never expose secrets in frontend code; use backend endpoints',
    },
    {
      name: 'Missing Webhook Signature Validation',
      pattern: 'grep -r "webhook" workers/src/handlers/ 2>/dev/null | xargs grep -l "verify\\|signature" 2>/dev/null | wc -l',
      severity: 'CRITICAL',
      help: 'All webhooks must validate signatures (Stripe: HMAC-SHA256)',
    },
    {
      name: 'Unencrypted Sensitive Storage (localStorage)',
      pattern: 'grep -r "localStorage\\|sessionStorage" frontend/js/ 2>/dev/null | grep -E "token|key|secret|password" | head -10',
      severity: 'HIGH',
      help: 'Don\'t store secrets in localStorage; use HttpOnly cookies',
    },
    {
      name: 'Missing Rate Limiting on Public Endpoints',
      pattern: 'grep -r "POST.*register\\|POST.*login" workers/src/handlers/ 2>/dev/null | xargs grep -l "rateLimit" 2>/dev/null | wc -l',
      severity: 'HIGH',
      help: 'Public endpoints need rate limiting (register, login, password reset)',
    },
  ],

  quality: [
    {
      name: 'TODO/FIXME Comments (Technical Debt)',
      pattern: 'grep -r "TODO\\|FIXME\\|HACK\\|XXX\\|BUG" --include="*.js" --include="*.ts" src/ workers/ frontend/ 2>/dev/null | head -20',
      severity: 'MEDIUM',
      help: 'Convert TODOs to tracked issues + remove from code',
    },
    {
      name: 'Monolithic Functions (>300 LOC)',
      pattern: 'find workers/src/handlers -name "*.js" 2>/dev/null | while read f; do lines=$(wc -l < "$f"); [ "$lines" -gt 300 ] && echo "$f: $lines lines"; done',
      severity: 'HIGH',
      help: 'Break large functions into smaller, testable units',
    },
    {
      name: 'Missing Error Handling (try/catch)',
      pattern: 'grep -r "await\\|.then(" workers/src/handlers 2>/dev/null | grep -v "try\\|catch\\|Sentry\\.captureException" | wc -l',
      severity: 'HIGH',
      help: 'Wrap async operations in try/catch or promise .catch()',
    },
    {
      name: 'Missing JSDoc Comments',
      pattern: 'grep -r "^function\\|^const.*function\\|^exports\\." workers/src/handlers/ 2>/dev/null | grep -v -B 1 "/\\*\\*" | wc -l',
      severity: 'MEDIUM',
      help: 'Add JSDoc block comments to all public functions',
    },
    {
      name: 'Console.log in Production Code',
      pattern: 'grep -r "console\\." --include="*.js" workers/src/ frontend/js/ 2>/dev/null | grep -v "test\\|debug\\|warn\\|error" | wc -l',
      severity: 'LOW',
      help: 'Use proper logging framework; remove console.log()',
    },
    {
      name: 'Dead Code (Commented Out)',
      pattern: 'grep -r "^[[:space:]]*//" workers/src/ 2>/dev/null | wc -l',
      severity: 'LOW',
      help: 'Remove commented-out code; use Git history instead',
    },
    {
      name: 'Magic Numbers (Hardcoded Values)',
      pattern: 'grep -r "[0-9]\\{4,\\}" workers/src/ 2>/dev/null | grep -v "2026\\|2025\\|date\\|port\\|timeout.*[0-9]\\{3,\\}" | head -15',
      severity: 'MEDIUM',
      help: 'Extract magic numbers into named constants',
    },
    {
      name: 'Long Parameter Lists (>5 params)',
      pattern: 'grep -r "function.*(" workers/src/handlers/ 2>/dev/null | grep -E "\\(\\w+,.*,.*,.*,.*," | head -10',
      severity: 'MEDIUM',
      help: 'Reduce parameters using config objects or dependency injection',
    },
    {
      name: 'Unused Variables/Imports',
      pattern: 'grep -r "const\\|let\\|import" workers/src/handlers/ 2>/dev/null | grep -v ".*=.*;\\|.*=.*{\\|.*from" | head -10',
      severity: 'LOW',
      help: 'Remove unused variables and imports',
    },
    {
      name: 'Database N+1 Queries',
      pattern: 'grep -r "for.*{\\|forEach(" workers/src/handlers/ 2>/dev/null | xargs grep -l "db\\." 2>/dev/null | head -5',
      severity: 'HIGH',
      help: 'Use batch queries or JOINs instead of looping queries',
    },
  ],

  compliance: [
    {
      name: 'WCAG: Missing Alt Text on Images',
      pattern: 'grep -r "<img" frontend/ 2>/dev/null | grep -v "alt=\\"\\|aria-label" | head -15',
      severity: 'HIGH',
      help: 'All images need descriptive alt attributes',
    },
    {
      name: 'WCAG: Missing Fieldset/Legend (Radio Groups)',
      pattern: 'grep -r "type=\\"radio\\"" frontend/ 2>/dev/null | grep -v -B 5 "fieldset\\|legend" | head -10',
      severity: 'MEDIUM',
      help: 'Group radio buttons with <fieldset> + <legend>',
    },
    {
      name: 'WCAG: Color-Only Indicators',
      pattern: 'grep -r "class.*red\\|class.*green\\|class.*yellow" frontend/css/ 2>/dev/null | grep -v "aria-hidden\\|icon\\|color-blind" | head -10',
      severity: 'MEDIUM',
      help: 'Don\'t use color alone; add icons, patterns, or text',
    },
    {
      name: 'WCAG: Missing Keyboard Navigation',
      pattern: 'grep -r "onclick\\|onmouseover" frontend/js/ 2>/dev/null | grep -v "onkeydown\\|onchange\\|onkeyup" | head -10',
      severity: 'MEDIUM',
      help: 'Support keyboard navigation for all interactive elements',
    },
    {
      name: 'GDPR: Sensitive Data in localStorage',
      pattern: 'grep -r "localStorage\\|sessionStorage" frontend/js/ 2>/dev/null | grep -E "user|email|phone|ssn|identity" | head -10',
      severity: 'CRITICAL',
      help: 'Don\'t store PII in localStorage; use secure server-side storage',
    },
    {
      name: 'PCI-DSS: Payment Data Handling',
      pattern: 'grep -r "card\\|cvv\\|ccn\\|pan" --include="*.js" 2>/dev/null | grep -v "stripe\\|test" | head -10',
      severity: 'CRITICAL',
      help: 'Never handle raw payment data; use Stripe tokenization',
    },
    {
      name: 'Password Policy Compliance',
      pattern: 'grep -r "password.*length\\|strength" workers/src/handlers/ 2>/dev/null | grep -v "8\\|12\\|entropy" | head -10',
      severity: 'HIGH',
      help: 'Enforce minimum 12-character passwords with entropy checks',
    },
    {
      name: 'Missing ARIA Labels',
      pattern: 'grep -r "<input\\|<select\\|<textarea" frontend/ 2>/dev/null | grep -v "aria-label\\|aria-describedby\\|<label" | head -15',
      severity: 'MEDIUM',
      help: 'All form fields need associated labels (visible or aria-label)',
    },
    {
      name: 'Missing HTTP Security Headers',
      pattern: 'grep -r "Content-Security-Policy\\|X-Frame-Options\\|X-Content-Type-Options" workers/src/ 2>/dev/null | wc -l',
      severity: 'HIGH',
      help: 'Add security headers: CSP, X-Frame-Options, X-Content-Type-Options',
    },
    {
      name: 'Audit Logging Missing',
      pattern: 'grep -r "audit\\|log.*action" workers/src/handlers/ 2>/dev/null | wc -l',
      severity: 'MEDIUM',
      help: 'Log all security-relevant actions (login, access, changes)',
    },
  ],

  integration: [
    {
      name: 'Webhook Validation Status',
      pattern: 'grep -r "webhook" workers/src/handlers/ 2>/dev/null | xargs grep -l "verify\\|signature\\|validate" 2>/dev/null | wc -l',
      severity: 'CRITICAL',
      help: 'All webhooks (Stripe, Telnyx) must validate signatures',
    },
    {
      name: 'OAuth Token Storage',
      pattern: 'grep -r "access_token\\|refresh_token" workers/src/ frontend/js/ 2>/dev/null | grep -v "env\\.\\|Bearer" | head -10',
      severity: 'HIGH',
      help: 'Store tokens in secure, HttpOnly cookies (backend only)',
    },
    {
      name: 'Rate Limiting Configuration',
      pattern: 'grep -r "X-RateLimit\\|rateLimit\\|RATE_LIMIT" workers/src/middleware/ 2>/dev/null | wc -l',
      severity: 'HIGH',
      help: 'Implement rate limiting on all public endpoints',
    },
    {
      name: 'Cache Validation (KV/Redis)',
      pattern: 'grep -r "env\\.CACHE\\|KV\\|cache" workers/src/ 2>/dev/null | wc -l',
      severity: 'MEDIUM',
      help: 'Validate cache entries; implement TTL and invalidation',
    },
    {
      name: 'Database Connection Pooling',
      pattern: 'grep -r "NEON_CONNECTION\\|connection.*pool\\|PostgreSQL" workers/src/ 2>/dev/null | wc -l',
      severity: 'MEDIUM',
      help: 'Use connection pooling for database (Neon pooler endpoint)',
    },
    {
      name: 'Health Check Endpoints',
      pattern: 'grep -r "GET.*health\\|GET.*status\\|GET.*ping" workers/src/handlers/ 2>/dev/null | wc -l',
      severity: 'MEDIUM',
      help: 'Expose /health endpoint for monitoring and load balancers',
    },
    {
      name: 'Timeout Configuration',
      pattern: 'grep -r "timeout\\|Timeout\\|setTimeout" workers/src/ 2>/dev/null | grep -v "test\\|jest" | wc -l',
      severity: 'MEDIUM',
      help: 'Set appropriate timeouts for all external API calls',
    },
    {
      name: 'Retry Logic',
      pattern: 'grep -r "retry\\|Retry\\|attempt" workers/src/handlers/ 2>/dev/null | grep -v "test" | wc -l',
      severity: 'MEDIUM',
      help: 'Implement exponential backoff for transient failures',
    },
    {
      name: 'Circuit Breaker Pattern',
      pattern: 'grep -r "circuit\\|fallback\\|failover" workers/src/ 2>/dev/null | wc -l',
      severity: 'MEDIUM',
      help: 'Add circuit breaker for external service calls',
    },
    {
      name: 'API Error Code Documentation',
      pattern: 'grep -r "error.*CODE" workers/src/handlers/ 2>/dev/null | wc -l',
      severity: 'LOW',
      help: 'Document all error codes in API documentation',
    },
  ],

  performance: [
    {
      name: 'N+1 Query Patterns',
      pattern: 'grep -r "for.*{\\|forEach(" workers/src/handlers/ 2>/dev/null | xargs grep -l "db\\.query\\|await.*sql" 2>/dev/null | head -5',
      severity: 'HIGH',
      help: 'Use JOINs or batch queries instead of loops',
    },
    {
      name: 'Large Library Imports',
      pattern: 'grep -r "import.*from\\|require(" workers/src/ 2>/dev/null | grep -v "db\\|crypto\\|path\\|lodash" | head -15',
      severity: 'MEDIUM',
      help: 'Only import what you need; consider tree-shaking',
    },
    {
      name: 'Inefficient Array Operations',
      pattern: 'grep -r "\\.map(\\|\\.filter(\\|\\.reduce(" workers/src/ 2>/dev/null | grep -v "const\\|return" | head -10',
      severity: 'LOW',
      help: 'Use for loops for performance-critical code',
    },
    {
      name: 'Missing Database Indexes',
      pattern: 'grep -r "WHERE\\|ORDER BY\\|GROUP BY" workers/src/db/*.sql 2>/dev/null | grep -v "CREATE INDEX" | head -20',
      severity: 'HIGH',
      help: 'Add indexes for filtered, ordered, and grouped columns',
    },
    {
      name: 'Cache Hit Ratio Check',
      pattern: 'grep -r "calculateChart\\|synthesis" workers/src/handlers/ 2>/dev/null | grep -v "cache\\|KV" | wc -l',
      severity: 'MEDIUM',
      help: 'Cache expensive calculations (charts, synthesis)',
    },
    {
      name: 'Memory Leak Risk (Event Listeners)',
      pattern: 'grep -r "addEventListener\\|addEventListener\\|on(" frontend/js/ 2>/dev/null | grep -v "removeEventListener\\|off(" | head -10',
      severity: 'MEDIUM',
      help: 'Clean up event listeners when components unmount',
    },
    {
      name: 'Async Waterfall (Sequential when Parallel Needed)',
      pattern: 'grep -r "await.*await" workers/src/handlers/ 2>/dev/null | head -10',
      severity: 'MEDIUM',
      help: 'Use Promise.all() for parallel operations',
    },
    {
      name: 'Large JSON Payload Handling',
      pattern: 'grep -r "JSON\\.stringify\\|JSON\\.parse" workers/src/ 2>/dev/null | wc -l',
      severity: 'LOW',
      help: 'Stream large JSON or implement chunking',
    },
    {
      name: 'Worker Bundle Size',
      pattern: 'ls -lh workers/dist/ 2>/dev/null | tail -5',
      severity: 'MEDIUM',
      help: 'Keep Worker bundle <2MB (Cloudflare Paid tier limit)',
    },
    {
      name: 'Frontend Bundle Size (app.js)',
      pattern: 'ls -lh frontend/js/app.js 2>/dev/null | awk \'{print "Size: " $5}\'',
      severity: 'MEDIUM',
      help: 'Split app.js monolith to enable lazy loading',
    },
  ],

  docs: [
    {
      name: 'Missing JSDoc on Public Functions',
      pattern: 'grep -r "^(function|exports\\.|module\\.exports)" --include="*.js" workers/src/handlers/ 2>/dev/null | grep -v -B 1 "/\\*\\*" | wc -l',
      severity: 'MEDIUM',
      help: 'Add JSDoc @param, @returns, @throws to all exports',
    },
    {
      name: 'Outdated Comments or FIXMEs',
      pattern: 'grep -r "TODO\\|FIXME\\|DEPRECATED\\|OLD:" docs/ 2>/dev/null | head -10',
      severity: 'LOW',
      help: 'Keep documentation in sync with code',
    },
    {
      name: 'Broken Documentation Links',
      pattern: 'grep -r "\\[.*\\](.*)" docs/ 2>/dev/null | grep -v "http\\|https" | head -10',
      severity: 'LOW',
      help: 'Fix broken relative links in documentation',
    },
    {
      name: 'API Routes Documented vs Actual',
      pattern: 'grep -r "router\\|app\\." workers/src/index.js 2>/dev/null | wc -l',
      severity: 'HIGH',
      help: 'Generate API docs from router; export OpenAPI spec',
    },
    {
      name: 'CONTRIBUTING.md Completeness',
      pattern: 'wc -l CONTRIBUTING.md 2>/dev/null | awk \'{print "Lines: " $1}\'',
      severity: 'MEDIUM',
      help: 'Ensure CONTRIBUTING has setup, test, deploy steps',
    },
    {
      name: 'Missing CHANGELOG',
      pattern: 'test -f CHANGELOG.md && echo "✅ Exists" || echo "❌ Missing"',
      severity: 'LOW',
      help: 'Maintain CHANGELOG.md with version history',
    },
    {
      name: 'Code Comment Standards Enforced',
      pattern: 'grep -r "^[[:space:]]*//" workers/src/ 2>/dev/null | wc -l',
      severity: 'LOW',
      help: 'Establish and enforce comment style guide',
    },
    {
      name: 'Error Code Registry',
      pattern: 'test -f docs/ERROR_CODES.md && echo "✅ Exists" || echo "❌ Missing"',
      severity: 'MEDIUM',
      help: 'Document all error codes returned by API',
    },
    {
      name: 'Runbook/Incident Response',
      pattern: 'test -f docs/RUNBOOK.md && echo "✅ Exists" || echo "❌ Missing"',
      severity: 'MEDIUM',
      help: 'Create incident response playbooks for common failures',
    },
    {
      name: 'Architecture Decision Records (ADRs)',
      pattern: 'ls -1 docs/adr/*.md 2>/dev/null | wc -l',
      severity: 'LOW',
      help: 'Document major architectural decisions',
    },
  ],
};

function runScan(scanKey) {
  const categoryScans = scans[scanKey];
  if (!categoryScans) {
    log(`❌ Unknown category: ${scanKey}`, 'red');
    return null;
  }

  const results = [];
  log(`\n📊 Running ${scanKey.toUpperCase()} Scans`, 'cyan');
  log('═'.repeat(70), 'dim');

  for (const scan of categoryScans) {
    process.stdout.write(`  ⏳ ${scan.name}... `);

    try {
      const output = exec(scan.pattern);
      const lineCount = output ? output.split('\n').filter((line) => line.trim()).length : 0;
      const hasFindings = lineCount > 0 && output.trim() !== '0';

      if (hasFindings) {
        process.stdout.write(`\r  ⚠️  ${scan.name}\n`);
        log(`      Severity: ${scan.severity}`, scan.severity === 'CRITICAL' ? 'red' : scan.severity === 'HIGH' ? 'yellow' : 'dim');
        log(`      Findings: ${lineCount}`, 'dim');
        if (output.length < 300) {
          output.split('\n').forEach((line) => {
            if (line.trim()) log(`        ${line}`, 'dim');
          });
        } else {
          log(`        ${output.split('\n')[0]}`, 'dim');
          log(`        ... and ${lineCount - 1} more`, 'dim');
        }
        log(`      Help: ${scan.help}`, 'blue');
      } else {
        process.stdout.write(`\r  ✅ ${scan.name}\n`);
      }

      results.push({
        scan: scan.name,
        severity: scan.severity,
        findings: lineCount,
        hasIssues: hasFindings,
        output: output.substring(0, 500),
      });
    } catch (error) {
      process.stdout.write(`\r  ❌ ${scan.name} (error)\n`);
      log(`      Error: ${error.message.substring(0, 100)}`, 'red');
    }
  }

  return results;
}

function summarize(allResults) {
  console.log('\n' + '═'.repeat(70));
  log('📋 SUMMARY', 'bright');
  log('═'.repeat(70), 'dim');

  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  allResults.forEach((category) => {
    category.forEach((result) => {
      if (result.hasIssues) {
        if (result.severity === 'CRITICAL') criticalCount++;
        else if (result.severity === 'HIGH') highCount++;
        else if (result.severity === 'MEDIUM') mediumCount++;
        else if (result.severity === 'LOW') lowCount++;
      }
    });
  });

  log(`🔴 CRITICAL Issues: ${criticalCount}`, 'red');
  log(`🟠 HIGH Issues: ${highCount}`, 'yellow');
  log(`🟡 MEDIUM Issues: ${mediumCount}`, colors.magenta);
  log(`🟢 LOW Issues: ${lowCount}`, 'green');

  const total = criticalCount + highCount + mediumCount + lowCount;
  if (total === 0) {
    log('\n✨ No major issues found!', 'green');
  } else {
    log(`\n⚠️  Total Issues Found: ${total}`, 'yellow');
    log('See REVIEW_AND_IMPROVEMENT_PLAN.md for remediation steps', 'dim');
  }
}

// Main
const args = process.argv.slice(2);
const categoryArg = args.find((arg) => arg.startsWith('--category=')) || '--category=all';
const exportFormat = args.find((arg) => arg.startsWith('--export=')) || '--export=text';

const category = categoryArg.split('=')[1] || 'all';
const format = exportFormat.split('=')[1] || 'text';

const validCategories = ['security', 'quality', 'compliance', 'integration', 'performance', 'docs', 'all'];
if (!validCategories.includes(category)) {
  log(`❌ Invalid category. Valid options: ${validCategories.join(', ')}`, 'red');
  process.exit(1);
}

const categoriesToRun = category === 'all' ? validCategories.slice(0, -1) : [category];
const allResults = [];

for (const cat of categoriesToRun) {
  const results = runScan(cat);
  if (results) allResults.push(...results);
}

if (format === 'json') {
  console.log(JSON.stringify(allResults, null, 2));
} else {
  summarize([allResults]);
}

log('\n🎯 Next Steps:', 'cyan');
log('  1. Review findings above', 'dim');
log('  2. Read docs/REVIEW_AND_IMPROVEMENT_PLAN.md for fixes', 'dim');
log('  3. Run specific category: node scripts/scan-codebase.js --category=security', 'dim');
log('  4. Export to JSON: node scripts/scan-codebase.js --export=json > scan-results.json', 'dim');
