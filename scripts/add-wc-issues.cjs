// One-time script: add WC-001 through WC-008 to audits/issue-registry.json
const fs = require('fs');
const path = require('path');

const registryPath = path.join(__dirname, '../audits/issue-registry.json');
const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const today = '2026-03-21';

const newIssues = [
  {
    id: 'WC-001',
    persona: 'Operations',
    severity: 'P0',
    area: 'billing/config',
    title: 'Stripe Price IDs are placeholder strings — no subscription or one-time purchase can complete',
    status: 'open',
    firstSeen: today,
    lastSeen: today,
    file: [
      'workers/wrangler.toml',
      'workers/src/lib/stripe.js'
    ],
    fix: [
      'Create 4 subscription Price objects in Stripe Dashboard: Individual $19/mo, Practitioner $97/mo, Agency $349/mo, plus matching annual variants',
      'Create 4 one-time Price objects: single_synthesis $19, composite_reading $29, transit_pass $12, lifetime_access $299',
      'Paste the 8 resulting Price IDs into the corresponding env vars in workers/wrangler.toml (STRIPE_PRICE_INDIVIDUAL_MONTHLY, STRIPE_PRICE_PRACTITIONER_MONTHLY, etc.)',
      'Deploy workers with updated wrangler.toml'
    ],
    requirements: [
      'Every subscription tier and one-time product must have a real Stripe Price ID before checkout can be tested end-to-end',
      'Price IDs must match the pricing visible on the landing page ($19 / $97 / $349 tiers)',
      'Annual pricing should be approximately 20% discount from monthly'
    ],
    acceptanceCriteria: [
      'verify-money-path.js checkout_session_created step returns a real Stripe-hosted checkout URL (not a 400 error)',
      'A test purchase completes end-to-end in Stripe test mode',
      'Money-path canary passes checkout, portal, and subscription-status checks'
    ],
    constraints: [
      'Use Stripe test-mode Price IDs for staging; live-mode IDs for production',
      'Do not hardcode Price IDs in source — only in wrangler.toml env vars or Workers secrets'
    ]
  },
  {
    id: 'WC-002',
    persona: 'Accessibility',
    severity: 'P1',
    area: 'frontend/accessibility',
    title: 'WCAG 2.1 AA ARIA skeleton incomplete — tab roles, modal roles, form labels, landmarks, skip link, arrow-key nav, touch targets, and SVG alt all missing',
    status: 'open',
    firstSeen: today,
    lastSeen: today,
    file: [
      'frontend/index.html',
      'frontend/js/app.js',
      'frontend/css/app.css'
    ],
    fix: [
      'Add role="tab", aria-selected, aria-controls, aria-expanded to all tab panel button elements',
      'Add role="dialog", aria-modal="true", aria-labelledby to all modal overlays',
      'Add aria-label or associated <label> to every form input field',
      'Add <main>, <nav>, <aside> landmark elements to index.html shell',
      'Add a visually-hidden skip-to-main-content link at the top of <body>',
      'Implement arrow-key navigation (ArrowLeft/ArrowRight) for tab panels per ARIA Authoring Practices Guide',
      'Increase touch targets on help/tooltip icons from 16x16px to minimum 44x44px',
      'Add role="img" and aria-label to the bodygraph SVG wheel element'
    ],
    requirements: [
      'Must not break existing keyboard tab-order for sighted keyboard users',
      'Modal focus trap must be implemented alongside the dialog role + aria-modal',
      'Skip link must be visible on focus, hidden otherwise'
    ],
    acceptanceCriteria: [
      'axe-core audit reports 0 critical and 0 serious ARIA violations across all primary views',
      'Screen reader (NVDA or VoiceOver) can navigate tabs, open/close modals, and submit forms without visual reference',
      'Automated Vitest test in tests/accessibility.test.js confirms aria-label presence on all inputs'
    ],
    constraints: [
      'BL-FRONTEND-P2-8 (contrast fixes) should ship first or concurrently — both are prerequisites for WCAG AA',
      'Do not introduce new inline styles; use existing CSS classes for touch-target sizing'
    ]
  },
  {
    id: 'WC-003',
    persona: 'Security',
    severity: 'P1',
    area: 'workers/security',
    title: 'Content-Security-Policy (CSP) header missing from all frontend responses',
    status: 'open',
    firstSeen: today,
    lastSeen: today,
    file: [
      'workers/src/index.js'
    ],
    fix: [
      "Add Content-Security-Policy response header in the security-headers middleware in workers/src/index.js",
      "Initial directive: default-src 'self'; script-src 'self' https://js.stripe.com https://browser.sentry-cdn.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://prime-self-api.adrper79.workers.dev; frame-ancestors 'none'",
      "Remove or tighten unsafe-inline for style-src once CSS is consolidated (BL-FRONTEND-P1-9)",
      "Add nonce-based or hash-based CSP for any inline scripts present in index.html"
    ],
    requirements: [
      'CSP must not break existing functionality (chart SVG rendering, Stripe.js loading, Sentry SDK)',
      'frame-ancestors none is already covered by X-Frame-Options: DENY; both should be present',
      'connect-src must include the Cloudflare Worker API origin'
    ],
    acceptanceCriteria: [
      'curl -I https://selfprime.net returns a Content-Security-Policy header',
      'Browser console shows zero CSP violations on the main app flow (chart -> profile -> billing)',
      'SecurityHeaders.com scan scores A or higher'
    ],
    constraints: [
      'Do not block Stripe.js (https://js.stripe.com) — must be in script-src',
      'Do not block Sentry (https://browser.sentry-cdn.com) — must be in script-src'
    ]
  },
  {
    id: 'WC-004',
    persona: 'Operations',
    severity: 'P1',
    area: 'workers/push',
    title: 'APNs and FCM native push delivery unimplemented — iOS and Android devices do not receive push notifications',
    status: 'open',
    firstSeen: today,
    lastSeen: today,
    file: [
      'workers/src/handlers/push.js'
    ],
    fix: [
      'Implement APNs JWT-signed HTTP/2 delivery path for iOS devices in workers/src/handlers/push.js',
      'Implement FCM v1 HTTP delivery path for Android devices in workers/src/handlers/push.js',
      'Wire both paths into the existing sendPushNotification() dispatch function alongside the current VAPID web-push path',
      'Add APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, and FCM_SERVER_KEY as Workers secrets'
    ],
    requirements: [
      'Web push (VAPID) must continue to work for browser-based PWA users',
      'Device type must be detected from the stored subscription object to route to the correct delivery path',
      'Failed deliveries (token expired, device unregistered) must clean up the subscription record'
    ],
    acceptanceCriteria: [
      'iOS test device with app installed receives transit digest push notification',
      'Android test device receives the same notification via FCM',
      'Expired/invalid tokens are automatically removed from the push_subscriptions table'
    ],
    constraints: [
      'APNs requires a p8 key file — do not store in source code; use Workers secrets',
      'Depends on BL-MOBILE-P1-1 (native app) for full end-to-end delivery; web-only delivery via VAPID already works'
    ]
  },
  {
    id: 'WC-005',
    persona: 'Operations',
    severity: 'P2',
    area: 'workers/config',
    title: 'CF_API_TOKEN and CF_ACCOUNT_ID not configured — Cloudflare analytics metrics unavailable in audit output',
    status: 'open',
    firstSeen: today,
    lastSeen: today,
    file: [
      '.env.local',
      'scripts/audit-vitals.js',
      'workers/wrangler.toml'
    ],
    fix: [
      'Create a Cloudflare API token with Analytics:Read + Workers Analytics Engine:Read permissions at dash.cloudflare.com/profile/api-tokens',
      'Add CF_API_TOKEN=<token> and CF_ACCOUNT_ID=<account_id> to .env.local for local audit runs',
      'Add the same values as Workers secrets via: wrangler secret put CF_API_TOKEN and wrangler secret put CF_ACCOUNT_ID'
    ],
    requirements: [
      'CF_ACCOUNT_ID is available on the Cloudflare dashboard overview page (right sidebar)',
      'The API token needs minimum Analytics:Read scope — do not use a global API key'
    ],
    acceptanceCriteria: [
      'npm run audit:vitals output includes CF Metrics section with real request/error rate data instead of "unavailable"',
      'node scripts/test-cf-metrics.js exits 0 with metric values'
    ],
    constraints: [
      'Never commit CF_API_TOKEN to source control',
      'Rotation policy: rotate token if any team member with access leaves'
    ]
  },
  {
    id: 'WC-006',
    persona: 'Operations',
    severity: 'P2',
    area: 'workers/auth',
    title: 'Google OAuth secrets not configured in Workers production environment — Google Sign-In non-functional in production',
    status: 'open',
    firstSeen: today,
    lastSeen: today,
    file: [
      'workers/src/handlers/oauthSocial.js',
      'workers/wrangler.toml'
    ],
    fix: [
      'Create OAuth 2.0 credentials at console.cloud.google.com (Credentials -> Create -> OAuth client ID -> Web application)',
      'Add https://selfprime.net and https://prime-self-api.adrper79.workers.dev to the authorized callback URIs',
      'Run: wrangler secret put GOOGLE_CLIENT_ID and wrangler secret put GOOGLE_CLIENT_SECRET with values from Google Console'
    ],
    requirements: [
      'The handler in oauthSocial.js is complete and tested — only the secrets are missing',
      'Authorized redirect URI must match the CALLBACK_URL currently used in the handler exactly'
    ],
    acceptanceCriteria: [
      'Clicking "Sign in with Google" on the production frontend completes the OAuth flow and logs the user in',
      'New accounts created via Google OAuth appear in the users table with provider=google'
    ],
    constraints: [
      'Keep client credentials in Workers secrets, never in wrangler.toml plaintext',
      'Test in staging before applying to production OAuth credentials'
    ]
  },
  {
    id: 'WC-007',
    persona: 'Operations',
    severity: 'P2',
    area: 'workers/auth',
    title: 'Apple Sign-In secrets not configured in Workers production environment — Apple Sign-In non-functional in production',
    status: 'open',
    firstSeen: today,
    lastSeen: today,
    file: [
      'workers/src/handlers/oauthSocial.js',
      'workers/wrangler.toml'
    ],
    fix: [
      'Create a Sign In with Apple Service ID in the Apple Developer portal at developer.apple.com',
      'Generate a private key (.p8) for Sign In with Apple',
      'Run wrangler secret put for each: APPLE_CLIENT_ID (Service ID), APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (full p8 content)'
    ],
    requirements: [
      'APPLE_PRIVATE_KEY must be stored as a multiline Workers secret — test that newlines are preserved',
      'The Service ID domain (selfprime.net) must be verified in the Apple Developer portal',
      'Return URL must be https — Apple rejects non-HTTPS redirect URIs'
    ],
    acceptanceCriteria: [
      'Clicking "Sign in with Apple" on the production frontend completes the OAuth flow and logs the user in',
      'New accounts created via Apple Sign-In appear in the users table with provider=apple'
    ],
    constraints: [
      'The .p8 private key file must NEVER be committed to source control; only store as a Workers secret',
      'Apple requires annual key rotation — add a calendar reminder'
    ]
  },
  {
    id: 'WC-008',
    persona: 'Operations',
    severity: 'P2',
    area: 'workers/sms',
    title: 'TELNYX_API_KEY and TELNYX_PHONE_NUMBER not set as Workers secrets — SMS transit digest delivery non-functional in production',
    status: 'open',
    firstSeen: today,
    lastSeen: today,
    file: [
      'workers/src/handlers/sms.js',
      'workers/wrangler.toml'
    ],
    fix: [
      'Retrieve TELNYX_API_KEY and TELNYX_PHONE_NUMBER from .env.local (values already present locally)',
      'Run: wrangler secret put TELNYX_API_KEY',
      'Run: wrangler secret put TELNYX_PHONE_NUMBER',
      'Redeploy workers to pick up the new secrets'
    ],
    requirements: [
      'SMS opt-in flow and transit digest delivery must work end-to-end in production',
      'Phone number must be a Telnyx-provisioned number with SMS capability'
    ],
    acceptanceCriteria: [
      'A test SMS opt-in from a real phone number receives the confirmation message in production',
      'Transit digest delivery job sends SMS to opted-in users without 401/403 errors in Worker logs'
    ],
    constraints: [
      'Never commit Telnyx API keys to source control',
      'Telnyx has usage-based billing — monitor for unexpected spikes via the Telnyx portal'
    ]
  }
];

// Verify none of these IDs already exist
const existingIds = new Set(data.issues.map(i => i.id));
const duplicates = newIssues.filter(i => existingIds.has(i.id));
if (duplicates.length > 0) {
  console.error('ERROR: Duplicate IDs found:', duplicates.map(i => i.id));
  process.exit(1);
}

data.issues.push(...newIssues);
fs.writeFileSync(registryPath, JSON.stringify(data, null, 2) + '\n');
console.log(`Added ${newIssues.length} new issues. Total: ${data.issues.length}`);
console.log('New issue IDs:', newIssues.map(i => `${i.id} (${i.severity})`).join(', '));
