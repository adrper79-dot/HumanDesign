// One-time script: add final checkout audit issues to registry
const fs = require('fs');
const path = require('path');

const registryPath = path.join(__dirname, '../audits/issue-registry.json');
const d = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const newIssues = [
  {
    id: 'ARIA-001',
    persona: 'CTO',
    severity: 'P2',
    area: 'frontend/accessibility',
    title: 'Modal dialogs have no keyboard focus trap — Tab key escapes to background content',
    status: 'open',
    firstSeen: '2026-03-22',
    lastSeen: '2026-03-22',
    file: ['frontend/js/app.js', 'frontend/index.html'],
    fix: [
      'Add a focus trap that is activated when a modal opens',
      'On modal open: capture all focusable elements inside the dialog; intercept Tab/Shift+Tab to cycle only within those elements',
      'On modal close: return focus to the element that triggered the modal open',
      'Apply to all 8 modals: authOverlay, securityModal, pushPrefsModal, pricingOverlay, practitionerPricingOverlay, first-run-modal, shareModal, practitionerOnboardingOverlay'
    ],
    requirements: [
      'WCAG 2.1 SC 2.1.2 (No Keyboard Trap) — focus must not escape a dialog while it is open',
      'Focus must return to trigger element on modal dismiss',
      'Escape key must close the modal and return focus'
    ],
    acceptanceCriteria: [
      'Opening any modal and pressing Tab repeatedly cycles through modal interactive elements only — does not reach background',
      'Shift+Tab cycles in reverse through modal elements only',
      'Pressing Escape closes modal and returns focus to opener button'
    ],
    constraints: [
      'Must not break existing keyboard navigation outside of modals',
      'Can be a lightweight custom implementation — no additional npm dependency required'
    ]
  },
  {
    id: 'ARIA-002',
    persona: 'CTO',
    severity: 'P2',
    area: 'frontend/accessibility',
    title: '63 button elements in index.html lack explicit aria-label — screen readers announce unnamed buttons',
    status: 'open',
    firstSeen: '2026-03-22',
    lastSeen: '2026-03-22',
    file: ['frontend/index.html'],
    fix: [
      'Audit each unnamed button: if icon-only, add aria-label describing the action',
      'For icon buttons (close, edit, delete, share), add aria-label matching the action',
      'Prioritize: close buttons, nav hamburger, social share buttons, action icon buttons in practitioner dashboard',
      'Use aria-label attribute on the button element directly'
    ],
    requirements: [
      'WCAG 2.1 SC 4.1.2 — every UI component must have an accessible name',
      'Buttons must announce their purpose when focused via screen reader'
    ],
    acceptanceCriteria: [
      'VoiceOver/NVDA announces a meaningful label for every button when focused',
      'Zero buttons with accessible name = undefined in Axe accessibility audit'
    ],
    constraints: [
      'Prefer aria-label on the button element itself',
      'Do not change visual appearance — aria-label is invisible to sighted users'
    ]
  },
  {
    id: 'DB-001',
    persona: 'CTO',
    severity: 'P2',
    area: 'workers/db/migrations',
    title: '5 FK columns missing ON DELETE clause — user deletion leaves orphaned rows in 4 tables',
    status: 'open',
    firstSeen: '2026-03-22',
    lastSeen: '2026-03-22',
    file: [
      'workers/src/db/migrations/009_push_subscriptions.sql',
      'workers/src/db/migrations/010_transit_alerts.sql',
      'workers/src/db/migrations/058_practitioner_promo.sql',
      'workers/src/db/migrations/063_practitioner_messages.sql',
      'workers/src/db/migrations/066_fix_practitioner_messages_uuid_pk.sql'
    ],
    fix: [
      'Create corrective migration 068 that drops and re-creates each FK with ON DELETE CASCADE or ON DELETE SET NULL',
      'push_subscriptions.user_id: ON DELETE CASCADE',
      'transit_alerts.user_id: ON DELETE CASCADE',
      'practitioner_messages.sender_id: ON DELETE SET NULL (preserve message history)',
      'promo_codes.practitioner_id: ON DELETE RESTRICT (confirm with business before implementing)'
    ],
    requirements: [
      'User account deletion must not leave orphaned rows in any child table',
      'GDPR right-to-erasure compliance requires cascading deletion of PII-containing rows'
    ],
    acceptanceCriteria: [
      'After user deletion, no rows exist in push_subscriptions or transit_alerts for that user_id',
      'practitioner_messages rows with deleted sender have sender_id = NULL',
      'Migration runs cleanly on production schema without errors'
    ],
    constraints: [
      'Must write a new forward migration — do not modify existing migration files',
      'Test on a branch DB before applying to production',
      'Coordinate with GDPR deletion handler in workers/src/handlers/auth.js'
    ]
  },
  {
    id: 'CSS-001',
    persona: 'CTO',
    severity: 'P3',
    area: 'frontend/css',
    title: 'Magic color values in alerts.css and calendar.css bypass design token system',
    status: 'open',
    firstSeen: '2026-03-22',
    lastSeen: '2026-03-22',
    file: [
      'frontend/css/components/alerts.css',
      'frontend/css/components/calendar.css'
    ],
    fix: [
      'In alerts.css: replace rgba(106,79,200,...), rgba(80,200,120,...), rgba(201,168,76,...), rgba(224,80,80,...) with var(--color-*) token equivalents',
      'In calendar.css: replace #fff, #ff6b6b, #6C63FF, #FFD93D, rgba(255,77,77,...) with token references',
      'Add alpha-channel token variants to tokens.css if not present',
      'Run grep for remaining hard-coded hex/rgba values across all CSS component files after fix'
    ],
    requirements: [
      'Every color in a component CSS file must reference a var(--token) from tokens.css',
      'Exceptions allowed for utility values (transparent, currentColor, inherit) only'
    ],
    acceptanceCriteria: [
      'alerts.css and calendar.css contain zero hex (#xxx) or raw rgba() color values',
      'grep for raw color values in frontend/css/components returns no matches'
    ],
    constraints: [
      'Purely cosmetic — no behaviour change',
      'Can be batched with other CSS cleanup'
    ]
  },
  {
    id: 'ARCH-001',
    persona: 'CTO',
    severity: 'P3',
    area: 'frontend/js',
    title: 'app.js grew to 8358 lines (+858 lines since last assessment) — monolith trend continuing',
    status: 'open',
    firstSeen: '2026-03-22',
    lastSeen: '2026-03-22',
    file: ['frontend/js/app.js'],
    fix: [
      'Set a hard line-count ceiling at 8500 lines: new features require prior extraction',
      'Extract renderPractitionerDashboard, renderTransitChart, renderCheckinFlow as controllers in frontend/js/controllers/',
      'Use dynamic import() for views not needed on initial load'
    ],
    requirements: [
      'No single JS file in the frontend should exceed 8500 lines',
      'New feature code must not be added to app.js without first extracting an existing section'
    ],
    acceptanceCriteria: [
      'app.js stays below 8500 lines after next feature addition',
      'At least 2 large sections extracted to separate controller modules'
    ],
    constraints: [
      'P3 tech-debt — schedule after launch',
      'Extract incrementally — one module at a time to avoid merge conflicts'
    ]
  },
  {
    id: 'QC-001',
    persona: 'CTO',
    severity: 'P3',
    area: 'workers/src/handlers',
    title: '27 raw console.log/warn/error calls in worker handlers — should route through logger.js',
    status: 'open',
    firstSeen: '2026-03-22',
    lastSeen: '2026-03-22',
    file: [
      'workers/src/handlers/sms.js',
      'workers/src/handlers/auth.js',
      'workers/src/handlers/achievements.js',
      'workers/src/handlers/practitioner-profile.js',
      'workers/src/handlers/rectify.js',
      'workers/src/handlers/revenuecat-webhook.js',
      'workers/src/handlers/admin.js',
      'workers/src/handlers/analytics.js',
      'workers/src/handlers/checkin.js',
      'workers/src/handlers/google-calendar.js'
    ],
    fix: [
      'Replace all console.log/warn/error in handler files with structured logger from workers/src/lib/logger.js',
      'Ensure log calls include requestId and userId context',
      'Focus on sms.js first (highest count), then auth.js',
      'Add ESLint no-console rule to workers/src/handlers/ to prevent regressions'
    ],
    requirements: [
      'All observability output from worker handlers must use the structured logger',
      'Raw console.* produce unstructured output in Cloudflare Workers dashboard'
    ],
    acceptanceCriteria: [
      'Zero console.log/warn/error calls in workers/src/handlers/ directory',
      'ESLint no-console rule enabled for workers/src/handlers'
    ],
    constraints: [
      'P3 tech-debt — schedule after launch',
      'Do not change log message content, only route through logger'
    ]
  }
];

// Add new issues
d.issues.push(...newIssues);

// Recompute counts
let openCount = 0;
let resolvedCount = 0;
for (const issue of d.issues) {
  if (issue.status === 'open') openCount++;
  else if (issue.status === 'resolved') resolvedCount++;
}

d.openCount = openCount;
d.resolvedCount = resolvedCount;
d.lastAuditDate = '2026-03-22';

fs.writeFileSync(registryPath, JSON.stringify(d, null, 2));
console.log('Registry updated. Open:', openCount, 'Resolved:', resolvedCount, 'Total:', d.issues.length);
