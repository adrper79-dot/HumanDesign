/**
 * Prime Self API — Cloudflare Worker Entry Point
 *
 * Routes:
 *   POST /api/chart/calculate          – Full chart calculation
 *   POST /api/chart/save               – Save chart to database
 *   GET  /api/chart/history            – Get user's saved charts
 *   GET  /api/chart/:id                – Retrieve saved chart by ID
 *   POST /api/profile/generate         – Prime Self Profile (LLM synthesis)
 *   POST /api/profile/generate/stream  – Profile generation with SSE progress (BL-OPT-004)
 *   GET  /api/profile/list             – List user's saved profiles
 *   GET  /api/profile/:id              – Get saved profile by ID
 *   GET  /api/profile/:id/pdf          – Export profile as PDF
 *   GET  /api/transits/today           – Current transit positions
 *   GET  /api/transits/forecast        – Transit forecast
 *   GET  /api/cycles                   – Major life cycles (Saturn return, etc.)
 *   POST /api/composite                – Relationship / composite chart
 *   POST /api/rectify                  – Birth-time sensitivity analysis
 *   GET  /api/rectify/:rectificationId – Get rectification progress and result
 *   GET  /api/cluster/list             – List user's clusters
 *   POST /api/cluster/create           – Create a cluster
 *   POST /api/cluster/:id/join         – Add member to cluster
 *   POST /api/cluster/:id/leave        – Leave a cluster
 *   GET  /api/cluster/:id              – Get cluster details
 *   POST /api/cluster/:id/synthesize   – Cluster intelligence synthesis
 *   POST /api/sms/webhook              – Telnyx inbound SMS webhook
 *   POST /api/sms/send-digest          – Trigger digest send
 *   POST /api/sms/subscribe            – Subscribe to SMS digests
 *   POST /api/sms/unsubscribe          – Unsubscribe from SMS digests
 *   POST /api/auth/register            – Create account, get JWT pair
 *   POST /api/auth/login               – Email-based login, get JWT pair
 *   POST /api/auth/refresh             – Rotate refresh token, get new JWT pair
 *   POST /api/auth/logout              – Revoke all refresh tokens
 *   GET  /api/auth/me                  – Get current user info
 *   POST /api/auth/verify-email        – Verify email with token (AUDIT-SEC-003)
 *   POST /api/auth/resend-verification – Resend verification email (auth required)
 *   GET  /api/geocode                  – City → lat/lng + timezone
 *   GET  /api/health                   – Health check
 *   POST /api/practitioner/register       – Register as practitioner
 *   GET  /api/practitioner/profile        – Get practitioner profile
 *   GET  /api/practitioner/clients        – List clients
 *   POST /api/practitioner/clients/add    – Add client by email
 *   GET  /api/practitioner/clients/:id    – Client detail (chart + profile)
 *   DELETE /api/practitioner/clients/:id – Remove client
 *   GET  /api/onboarding/intro            – Savannah story intro (public)
 *   GET  /api/onboarding/forge            – Personalized Savannah arc
 *   GET  /api/onboarding/forge/:key       – Specific forge arc
 *   GET  /api/onboarding/progress         – User chapter progress
 *   POST /api/onboarding/advance          – Mark chapter as read
 *   POST /api/validation/save             – Save behavioral validation data
 *   GET  /api/validation                  – Get validation data
 *   POST /api/psychometric/save           – Save Big Five + VIA assessments
 *   GET  /api/psychometric                – Get psychometric data
 *   POST /api/diary                       – Create life event diary entry
 *   GET  /api/diary                       – List all diary entries
 *   GET  /api/diary/:id                   – Get diary entry
 *   PUT  /api/diary/:id                   – Update diary entry
 *   DELETE /api/diary/:id                 – Delete diary entry
 *   POST /api/webhook/stripe              – Process Stripe webhook events
 *   POST /api/webhooks                    – Register webhook endpoint
 *   GET  /api/webhooks                    – List user's webhooks
 *   GET  /api/webhooks/:id                – Get webhook details
 *   DELETE /api/webhooks/:id              – Delete webhook
 *   POST /api/webhooks/:id/test           – Test webhook delivery
 *   GET  /api/webhooks/:id/deliveries     – View delivery history
 *   GET  /api/push/vapid-key              – Get VAPID public key for push subscription
 *   POST /api/push/subscribe              – Subscribe to push notifications
 *   DELETE /api/push/unsubscribe          – Unsubscribe from push notifications
 *   POST /api/push/test                   – Send test notification
 *   GET  /api/push/preferences            – Get notification preferences
 *   PUT  /api/push/preferences            – Update notification preferences
 *   GET  /api/push/history                – Get notification delivery history
 *   GET  /api/alerts                      – List user's transit alerts
 *   POST /api/alerts                      – Create new transit alert
 *   GET  /api/alerts/templates            – List alert templates
 *   POST /api/alerts/from-template/:id    – Create alert from template
 *   GET  /api/alerts/history              – Get alert delivery history
 *   GET  /api/alerts/:id                  – Get alert details
 *   PUT  /api/alerts/:id                  – Update alert
 *   DELETE /api/alerts/:id                – Delete alert
 *   POST /api/keys                        – Generate new API key
 *   GET  /api/keys                        – List user's API keys
 *   GET  /api/keys/:id                    – Get API key details
 *   DELETE /api/keys/:id                  – Deactivate API key
 *   GET  /api/keys/:id/usage              – Get API key usage stats
 *   POST /api/timing/find-dates           – Find optimal dates for intention
 *   GET  /api/timing/templates            – List intention templates
 *   GET  /api/compare/celebrities         – Get top celebrity matches for user (requires auth)
 *   GET  /api/compare/celebrities/:id     – Get specific celebrity match details (requires auth)
 *   GET  /api/compare/category/:category  – Get celebrities by category (public)
 *   GET  /api/compare/search?q=query      – Search celebrities (public)
 *   GET  /api/compare/list                – List all available celebrities (public)
 *   POST /api/share/celebrity             – Generate celebrity match share content (requires auth)
 *   POST /api/share/chart                 – Generate chart share content (requires auth)
 *   POST /api/share/achievement           – Generate achievement share content (requires auth)
 *   POST /api/share/referral              – Generate referral invite share content (requires auth)
 *   GET  /api/share/stats                 – Get user's sharing stats and viral coefficient (requires auth)
 *   GET  /api/notion/auth                 – Initiate Notion OAuth flow (requires auth)
 *   GET  /api/notion/callback             – Notion OAuth callback handler (public)
 *   GET  /api/notion/status               – Get Notion connection status (requires auth)
 *   POST /api/notion/sync/clients         – Sync practitioner clients to Notion (requires auth)
 *   POST /api/notion/export/profile/:id   – Export profile as rich Notion page (requires auth)
 *   DELETE /api/notion/disconnect         – Disconnect Notion integration (requires auth)
 *   POST /api/checkin                     – Create/update today's daily check-in (requires auth)
 *   GET  /api/checkin                     – Get today's check-in status (requires auth)
 *   GET  /api/checkin/history             – Get check-in history with pagination (requires auth)
 *   GET  /api/checkin/stats               – Get alignment stats, trends, adherence rates (requires auth)
 *   GET  /api/checkin/streak              – Get current check-in streak info (requires auth)
 *   POST /api/checkin/reminder            – Set/update check-in reminder preferences (requires auth)
 *   GET  /api/checkin/reminder            – Get check-in reminder settings (requires auth)
 *   GET  /api/stats/activity              – Get public activity statistics for social proof (public)
 *   GET  /api/stats/leaderboard           – Get top users by achievement points (public)
 *   GET  /api/analytics/overview          – DAU/WAU/MAU + key metrics (admin)
 *   GET  /api/analytics/events            – Event trends over time (admin)
 *   GET  /api/analytics/funnel/:name      – Conversion funnel analysis (admin)
 *   GET  /api/analytics/retention         – Cohort retention curves (admin)
 *   GET  /api/analytics/errors            – Error rate + top errors (admin)
 *   GET  /api/analytics/revenue           – Revenue metrics (admin)
 *   GET  /api/experiments                 – List all A/B experiments (admin)
 *   GET  /api/experiments/:name           – Get experiment results + significance (admin)
 *   POST /api/experiments                 – Create new experiment (admin)
 *   PATCH /api/experiments/:name/status   – Update experiment status (admin)
 */

// Data injection for Workers runtime — MUST be first import
import './engine-compat.js';

import { handleCalculate, handleGetChart } from './handlers/calculate.js';
import { createQueryFn, QUERIES } from './db/queries.js';
import { handleSaveChart, handleChartHistory } from './handlers/chart-save.js';
import { handleGeocode } from './handlers/geocode.js';
import { handleProfile, handleGetProfile, handleListProfiles, handleSearchProfiles } from './handlers/profile.js';
import { handleProfileStream } from './handlers/profile-stream.js';
import { handleTransits } from './handlers/transits.js';
import { handleForecast } from './handlers/forecast.js';
import { handleCycles } from './handlers/cycles.js';
import { handleComposite } from './handlers/composite.js';
import { handleRectify, handleGetRectify, handleListRectifications } from './handlers/rectify.js';
import { handleCluster } from './handlers/cluster.js';
import { handleSMS } from './handlers/sms.js';
import { handleAuth } from './handlers/auth.js';
import { handleOAuthSocial, handleOAuthExchange } from './handlers/oauthSocial.js';
import { handlePdfExport, handleBrandedPdfExport } from './handlers/pdf.js';
import { handlePractitioner, handleGetInvitationDetails, handleAcceptInvitation, handleGetReferralLink } from './handlers/practitioner.js';
import { handleAgency } from './handlers/agency.js';
import {
  handleListDirectory,
  handleGetPublicProfile,
  handleGetDirectoryProfile,
  handleUpdateDirectoryProfile,
  handleGetDirectoryStats
} from './handlers/practitioner-directory.js';
import { handlePractitionerOGImage } from './handlers/practitioner-og.js';
import { handleCreateGift, handleGetGift, handleRedeemGift, handleListGifts } from './handlers/gift.js';
import {
  handleListNotes,
  handleCreateNote,
  handleUpdateNote,
  handleDeleteNote,
  handleGetAIContext,
  handleUpdateAIContext
} from './handlers/session-notes.js';
import {
  handleListReadings,
  handleCreateReading,
  handleGetReading,
  handleUpdateReading,
  handleDeleteReading,
  handleClientReadings
} from './handlers/divination-readings.js';
import {
  handleListActions,
  handleCreateAction,
  handleUpdateAction,
  handleDeleteAction,
  handleClientActions,
  handleCompleteAction
} from './handlers/session-actions.js';
import {
  handleSubmitReview,
  handleGetPublicReviews,
  handleListPractitionerReviews,
  handleApproveReview,
  handleHideReview
} from './handlers/reviews.js';
import { handleOnboarding } from './handlers/onboarding.js';
import { handleValidation } from './handlers/validation.js';
import { handlePsychometric } from './handlers/psychometric.js';
import { handleDiary } from './handlers/diary.js';
import { handleStripeWebhook } from './handlers/webhook.js';
import { handleWebhooks } from './handlers/webhooks.js';
import {
  handleCheckout,
  handleOneTimeCheckout,
  handlePortal,
  handleGetSubscription,
  handleCancelSubscription,
  handleUpgradeSubscription,
  handleGetTierConfig
  // handleWebhook removed — BL-R-C4: consolidated to handleStripeWebhook in webhook.js
} from './handlers/billing.js';
import {
  handleGenerateCode,
  handleGetStats,
  handleGetHistory,
  handleValidateCode,
  handleApplyCode,
  handleGetRewards,
  handleClaimReward
} from './handlers/referrals.js';
import {
  handleGetAchievements,
  handleGetProgress,
  handleGetLeaderboard,
  handleTrackEvent
} from './handlers/achievements.js';
import {
  handleGetCelebrityMatches,
  handleGetCelebrityMatchById,
  handleGetCelebritiesByCategory,
  handleGetCategories,
  handleSearchCelebrities,
  handleGetAllCelebrities
} from './handlers/famous.js';
import {
  handleShareCelebrity,
  handleShareChart,
  handleShareAchievement,
  handleShareReferral,
  handleGetShareStats
} from './handlers/share.js';
import {
  handleNotionAuth,
  handleNotionCallback,
  handleNotionStatus,
  handleSyncClients,
  handleExportProfile,
  handleNotionDisconnect
} from './handlers/notion.js';
import {
  handleCheckinCreate,
  handleCheckinToday,
  handleCheckinHistory,
  handleCheckinStats,
  handleCheckinStreak,
  handleSetCheckinReminder,
  handleGetCheckinReminder
} from './handlers/checkin.js';
import {
  handleGetActivityStats,
  handleGetLeaderboard as handleGetStatsLeaderboard
} from './handlers/stats.js';
import { handlePush } from './handlers/push.js';
import { handleAlerts } from './handlers/alerts.js';
import { handleApiKeys } from './handlers/keys.js';
import { handleTiming, listIntentionTemplates } from './handlers/timing.js';
import { handleEmbedValidate } from './handlers/embed.js';
import { handleValidatePromo, handleApplyPromo, handleCreatePromo, handleListPromos } from './handlers/promo.js';
import {
  handleGetClientPractitioners,
  handleGetClientPortal,
  handleGetClientSharedNotes,
  handleGetDiarySharingPrefs,
  handleSetDiarySharing
} from './handlers/client-portal.js';
import { handleAdmin } from './handlers/admin.js';
import { handleAnalytics } from './handlers/analytics.js';
import { handleExperiments } from './handlers/experiments.js';
import handleCalendar from './handlers/calendar.js';
import { trackEvent, trackError, aggregateDaily, EVENTS, captureRequestContext } from './lib/analytics.js';
import { initSentry, captureSentryRequest } from './lib/sentry.js';
import { createLogger, generateRequestId } from './lib/logger.js';
import { getCorsHeaders, handleOptions } from './middleware/cors.js';
import { authenticate } from './middleware/auth.js';
import { rateLimit, addRateLimitHeaders } from './middleware/rateLimit.js';
import { errorResponse } from './lib/errorMessages.js';
import { applyCacheForPublicAPI } from './middleware/cache.js';
import { applySecurityHeaders } from './middleware/security.js';
import { validateRequestBody } from './middleware/validate.js';
import { getCacheMetrics, kvCache } from './lib/cache.js';
import { runDailyTransitCron } from './cron.js';

// Routes that require authentication
const AUTH_ROUTES = new Set([
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/resend-verification',
  '/api/profile/generate',
  '/api/sms/send-digest',
  '/api/composite',          // HD_UPDATES3: composites gated to practitioner+ tier
  '/api/invitations/practitioner/accept',
]);

// Prefix-based auth routes (cluster endpoints, profile export, practitioner, onboarding, validation, psychometric, diary, checkout, billing, referrals, achievements, webhooks, push, alerts, api keys, timing, compare, share, notion)
const AUTH_PREFIXES = ['/api/chart/', '/api/cluster/', '/api/profile/', '/api/practitioner/', '/api/agency/', '/api/onboarding/', '/api/validation', '/api/psychometric', '/api/diary', '/api/billing/', '/api/referrals', '/api/achievements', '/api/webhooks', '/api/push/', '/api/alerts', '/api/keys', '/api/timing/', '/api/compare/celebrities', '/api/share/', '/api/notion/', '/api/checkin', '/api/analytics/', '/api/experiments/', '/api/cache/', '/api/promo/apply', '/api/client/', '/api/calendar'];

// Onboarding intro is public — exempted after prefix check
const PUBLIC_ONBOARDING = new Set(['/api/onboarding/intro']);

// Public routes (no auth required)
const PUBLIC_ROUTES = new Set([
  '/api/chart/calculate',
  '/api/geocode',
  '/api/transits/today',
  '/api/transits/forecast',
  '/api/cycles',
  '/api/rectify',
  '/api/push/vapid-key',
  '/api/sms/webhook',
  '/api/webhook/stripe',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/health',
  '/api/referrals/validate',  // Public for signup flow
  '/api/compare/list',  // Browse celebrities (public)
  '/api/compare/search',  // Search celebrities (public)
  '/api/compare/categories',  // List celebrity categories (public)
  '/api/auth/oauth/google',            // Redirect to Google (public)
  '/api/auth/oauth/apple',             // Redirect to Apple (public)
  '/api/notion/callback',              // Notion OAuth callback (public)
  '/api/calendar/google/callback',     // Google Calendar OAuth callback (public)
  '/api/auth/oauth/google/callback',   // Google OAuth callback (public)
  '/api/auth/oauth/apple/callback',    // Apple Sign In callback (public, POSTs)
  '/api/auth/oauth/exchange',           // P2-SEC-011: OAuth code exchange (public, POST)
  '/api/embed/validate',               // Embed widget feature-flag check (cross-origin, no PII)
  '/api/promo/validate',               // Promo code validation (public, no redemption)
  '/api/directory',                    // Public practitioner directory listing
  '/api/invitations/practitioner',     // Public practitioner invite preview
  '/api/analytics/audit',             // CIO-006: Audit runner uses X-Audit-Token — no user JWT
]);

function requiresAuth(path) {
  if (AUTH_ROUTES.has(path)) return true;
  // Explicit public exemptions take priority over prefix auth
  if (PUBLIC_ROUTES.has(path)) return false;
  if (PUBLIC_ONBOARDING.has(path)) return false;
  for (const prefix of AUTH_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

// ─── Route Table (BL-R-M9) ──────────────────────────────────────
// Replaces the ~230-line if/else chain with O(1) exact lookups,
// ordered prefix delegation, and regex pattern matching.

/** Exact routes: Map<"METHOD /path", handler(req, env, ctx)> */
const EXACT_ROUTES = new Map([
  // Chart
  ['POST /api/chart/calculate',       handleCalculate],
  ['POST /api/chart/save',            handleSaveChart],
  ['GET /api/chart/history',          handleChartHistory],
  // Profile
  ['POST /api/profile/generate',       handleProfile],
  ['POST /api/profile/generate/stream', handleProfileStream],
  ['GET /api/profile/list',            handleListProfiles],
  ['GET /api/profile/search',          handleSearchProfiles],
  // Transits & Cycles
  ['GET /api/transits/today',          handleTransits],
  ['GET /api/transits/forecast',       handleForecast],
  ['GET /api/cycles',                  handleCycles],
  // Composite & Rectify
  ['POST /api/composite',             handleComposite],
  ['POST /api/rectify',               handleRectify],
  ['GET /api/rectify',                handleListRectifications],
  // Timing
  ['POST /api/timing/find-dates',     handleTiming],
  ['GET /api/timing/templates',       listIntentionTemplates],
  // Billing
  ['POST /api/webhook/stripe',        handleStripeWebhook],
  ['POST /api/billing/checkout',      handleCheckout],
  ['POST /api/billing/checkout-one-time', handleOneTimeCheckout],
  ['POST /api/billing/portal',        handlePortal],
  ['GET /api/billing/subscription',   handleGetSubscription],
  ['GET /api/billing/tiers',          handleGetTierConfig],
  ['POST /api/billing/cancel',        handleCancelSubscription],
  ['POST /api/billing/upgrade',       handleUpgradeSubscription],
  // Referrals
  ['POST /api/referrals/code',        handleGenerateCode],
  ['GET /api/referrals',              handleGetStats],
  ['GET /api/referrals/history',      handleGetHistory],
  ['POST /api/referrals/validate',    handleValidateCode],
  ['POST /api/referrals/apply',       handleApplyCode],
  ['GET /api/referrals/rewards',      handleGetRewards],
  ['POST /api/referrals/claim',       handleClaimReward],
  // Achievements
  ['GET /api/achievements',            handleGetAchievements],
  ['GET /api/achievements/progress',   handleGetProgress],
  ['GET /api/achievements/leaderboard', handleGetLeaderboard],
  ['POST /api/achievements/track',     handleTrackEvent],
  // Celebrity Compare
  ['GET /api/compare/celebrities',     handleGetCelebrityMatches],
  ['GET /api/compare/categories',      handleGetCategories],
  ['GET /api/compare/search',          handleSearchCelebrities],
  ['GET /api/compare/list',            handleGetAllCelebrities],
  // Share
  ['POST /api/share/celebrity',       handleShareCelebrity],
  ['POST /api/share/chart',           handleShareChart],
  ['POST /api/share/achievement',     handleShareAchievement],
  ['POST /api/share/referral',        handleShareReferral],
  ['GET /api/share/stats',            handleGetShareStats],
  // Social OAuth (Google, Apple)
  ['GET /api/auth/oauth/google',             (req, env) => handleOAuthSocial(req, env, '/google')],
  ['GET /api/auth/oauth/google/callback',    (req, env) => handleOAuthSocial(req, env, '/google/callback')],
  ['GET /api/auth/oauth/apple',              (req, env) => handleOAuthSocial(req, env, '/apple')],
  ['GET /api/auth/oauth/apple/callback',     (req, env) => handleOAuthSocial(req, env, '/apple/callback')],
  ['POST /api/auth/oauth/apple/callback',    (req, env) => handleOAuthSocial(req, env, '/apple/callback')],
  ['POST /api/auth/oauth/exchange',           handleOAuthExchange],
  // Notion
  ['GET /api/notion/auth',            handleNotionAuth],
  ['GET /api/notion/callback',        handleNotionCallback],
  ['GET /api/notion/status',          handleNotionStatus],
  ['POST /api/notion/sync/clients',   handleSyncClients],
  ['DELETE /api/notion/disconnect',   handleNotionDisconnect],
  // Daily Check-In
  ['POST /api/checkin',               handleCheckinCreate],
  ['GET /api/checkin',                handleCheckinToday],
  ['GET /api/checkin/history',        handleCheckinHistory],
  ['GET /api/checkin/stats',          handleCheckinStats],
  ['GET /api/checkin/streak',         handleCheckinStreak],
  ['POST /api/checkin/reminder',      handleSetCheckinReminder],
  ['GET /api/checkin/reminder',       handleGetCheckinReminder],
  // Social Proof (public)
  ['GET /api/stats/activity',         handleGetActivityStats],
  ['GET /api/stats/leaderboard',      handleGetStatsLeaderboard],
  // Geocode
  ['GET /api/geocode',                handleGeocode],
  // Embed validation (public, cross-origin)
  ['GET /api/embed/validate',         handleEmbedValidate],
  ['OPTIONS /api/embed/validate',     handleEmbedValidate],
  // Promo codes (public validation; apply requires auth via auth-prefix)
  ['GET /api/promo/validate',         (req, env) => { const url = new URL(req.url); return handleValidatePromo(req, env, url.searchParams.get('code')); }],
  ['POST /api/promo/apply',           handleApplyPromo],
  // Promo admin (guarded internally by X-Admin-Token)
  ['POST /api/admin/promo',           handleCreatePromo],
  ['GET /api/admin/promo',            handleListPromos],
  // Practitioner Directory (public)
  ['GET /api/directory',              handleListDirectory],
  ['GET /api/invitations/practitioner', handleGetInvitationDetails],
  ['POST /api/invitations/practitioner/accept', handleAcceptInvitation],
  // Practitioner Directory Profile (auth)
  ['GET /api/practitioner/directory-profile',  handleGetDirectoryProfile],
  ['PUT /api/practitioner/directory-profile',  handleUpdateDirectoryProfile],
  // Practitioner Directory Stats (auth, PRAC-013)
  ['GET /api/practitioner/directory-stats',    handleGetDirectoryStats],
  // Practitioner Referral Link (auth)
  ['GET /api/practitioner/referral-link',      handleGetReferralLink],
  // Client Portal (auth)
  ['GET /api/client/my-practitioners',         handleGetClientPractitioners],
  ['GET /api/client/shared-notes',             handleGetClientSharedNotes],
  ['GET /api/client/my-readings',              handleClientReadings],
  ['GET /api/client/my-actions',               handleClientActions],
  ['POST /api/client/reviews',                 handleSubmitReview],
  ['GET /api/client/diary-sharing',            handleGetDiarySharingPrefs],
  ['PUT /api/client/diary-sharing',            handleSetDiarySharing],
  ['GET /api/practitioner/reviews',            handleListPractitionerReviews],
  // Gift-a-Reading (item 4.6)
  ['POST /api/practitioner/gifts',             handleCreateGift],
  ['GET /api/practitioner/gifts',              handleListGifts],
  // Email marketing unsubscribe (public, CAN-SPAM compliance — AUDIT-SEC-005)
  ['POST /api/email/unsubscribe',     async (request, env) => {
    const body = await request.json().catch(() => null);
    const email = body?.email;
    const token = body?.token;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return Response.json({ error: 'Valid email required' }, { status: 400 });
    }
    // Verify unsubscribe token (HMAC-SHA256 of email with JWT_SECRET as key)
    if (!token || typeof token !== 'string') {
      return Response.json({ error: 'Unsubscribe token required' }, { status: 400 });
    }
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(env.JWT_SECRET || 'fallback'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(email.toLowerCase().trim()));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
    if (token !== expected) {
      return Response.json({ error: 'Invalid unsubscribe token' }, { status: 403 });
    }
    const query = createQueryFn(env.NEON_CONNECTION_STRING);
    await query(QUERIES.emailMarketingOptOut, [email.toLowerCase().trim()]);
    return Response.json({ ok: true, message: 'You have been unsubscribed from marketing emails.' });
  }],
]);

/**
 * Prefix routes: delegate to sub-handlers that do their own internal routing.
 * Each entry: [prefix, handler, stripPrefix]
 *   - If stripPrefix is null, the full path is passed to the handler.
 *   - Otherwise, prefix is stripped and the remainder (or '/') is passed.
 */
const PREFIX_ROUTES = [
  ['/api/admin/',       handleAdmin,        '/api/admin'],
  ['/api/cluster/',     handleCluster,      null],
  ['/api/sms/',         handleSMS,          null],
  ['/api/auth/',        handleAuth,         null],
  ['/api/onboarding',   handleOnboarding,   '/api/onboarding'],
  ['/api/practitioner',  handlePractitioner, '/api/practitioner'],
  ['/api/agency',        handleAgency,       '/api/agency'],
  ['/api/validation',   handleValidation,   '/api/validation'],
  ['/api/psychometric',  handlePsychometric, '/api/psychometric'],
  ['/api/diary',        handleDiary,        '/api/diary'],
  ['/api/webhooks',     handleWebhooks,     '/api/webhooks'],
  ['/api/push',         handlePush,         '/api/push'],
  ['/api/alerts',       handleAlerts,       '/api/alerts'],
  ['/api/keys',         handleApiKeys,      '/api/keys'],
  ['/api/analytics',    handleAnalytics,    '/api/analytics'],
  ['/api/experiments',  handleExperiments,  '/api/experiments'],
  ['/api/calendar',     handleCalendar,     '/api/calendar'],
];

/**
 * Pattern routes for dynamic segments.
 * Each entry: [regex, method (null = any), paramIndex, handler]
 *   paramIndex: which capture group to extract (1-based), passed as 4th arg.
 */
const PATTERN_ROUTES = [
  [/^\/api\/chart\/([^/]+)$/,                          'GET',  1, handleGetChart],
  [/^\/api\/rectify\/([^/]+)$/,                        'GET',  1, handleGetRectify],
  [/^\/api\/compare\/celebrities\/([a-z0-9-]+)$/,      'GET',  1, handleGetCelebrityMatchById],
  [/^\/api\/compare\/category\/([a-z0-9-]+)$/,              'GET',  1, handleGetCelebritiesByCategory],
  [/^\/api\/notion\/export\/profile\/([^/]+)$/,        'POST', 1, handleExportProfile],
  // Branded PDF for practitioner clients
  [/^\/api\/practitioner\/clients\/([^/]+)\/pdf$/, 'POST', 1, (req, env, id) => handleBrandedPdfExport(req, env, id)],
  [/^\/api\/profile\/([^/]+)\/pdf$/,                    null,  1, handlePdfExport],
  [/^\/api\/profile\/([^/]+)$/,                         'GET',  1, handleGetProfile],
  // Practitioner Directory — public profile by slug
  [/^\/api\/directory\/([a-z0-9-]+)$/,                  'GET',  1, handleGetPublicProfile],
  // Session Notes — CRUD (authenticated, practitioner tier)
  [/^\/api\/practitioner\/clients\/([^/]+)\/notes$/,    'GET',  1, (req, env, id) => handleListNotes(req, env, id)],
  [/^\/api\/practitioner\/clients\/([^/]+)\/notes$/,    'POST', 1, (req, env, id) => handleCreateNote(req, env, id)],
  [/^\/api\/practitioner\/notes\/([^/]+)$/,             'PUT',  1, (req, env, id) => handleUpdateNote(req, env, id)],
  [/^\/api\/practitioner\/notes\/([^/]+)$/,             'DELETE', 1, (req, env, id) => handleDeleteNote(req, env, id)],
  // Per-client AI context
  [/^\/api\/practitioner\/clients\/([^/]+)\/ai-context$/, 'GET',  1, (req, env, id) => handleGetAIContext(req, env, id)],
  [/^\/api\/practitioner\/clients\/([^/]+)\/ai-context$/, 'POST', 1, (req, env, id) => handleUpdateAIContext(req, env, id)],
  [/^\/api\/practitioner\/clients\/([^/]+)\/ai-context$/, 'PUT',  1, (req, env, id) => handleUpdateAIContext(req, env, id)],
  [/^\/api\/practitioner\/clients\/([^/]+)\/context$/,    'GET',  1, (req, env, id) => handleGetAIContext(req, env, id)],
  [/^\/api\/practitioner\/clients\/([^/]+)\/context$/,    'POST', 1, (req, env, id) => handleUpdateAIContext(req, env, id)],
  [/^\/api\/practitioner\/clients\/([^/]+)\/context$/,    'PUT',  1, (req, env, id) => handleUpdateAIContext(req, env, id)],
  // Client Portal — dynamic practitioner ID
  [/^\/api\/client\/portal\/([^/]+)$/,                    'GET',  1, (req, env, id) => handleGetClientPortal(req, env, id)],
  // Divination Readings — CRUD (authenticated, practitioner tier)
  [/^\/api\/practitioner\/clients\/([^/]+)\/readings$/,   'GET',  1, (req, env, id) => handleListReadings(req, env, id)],
  [/^\/api\/practitioner\/clients\/([^/]+)\/readings$/,   'POST', 1, (req, env, id) => handleCreateReading(req, env, id)],
  [/^\/api\/practitioner\/readings\/([^/]+)$/,            'GET',  1, (req, env, id) => handleGetReading(req, env, id)],
  [/^\/api\/practitioner\/readings\/([^/]+)$/,            'PUT',  1, (req, env, id) => handleUpdateReading(req, env, id)],
  [/^\/api\/practitioner\/readings\/([^/]+)$/,            'DELETE',1, (req, env, id) => handleDeleteReading(req, env, id)],
  // Session Actions — CRUD (authenticated, practitioner tier) + client completion
  [/^\/api\/practitioner\/clients\/([^/]+)\/actions$/,    'GET',  1, (req, env, id) => handleListActions(req, env, id)],
  [/^\/api\/practitioner\/clients\/([^/]+)\/actions$/,    'POST', 1, (req, env, id) => handleCreateAction(req, env, id)],
  [/^\/api\/practitioner\/actions\/([^/]+)$/,             'PUT',  1, (req, env, id) => handleUpdateAction(req, env, id)],
  [/^\/api\/practitioner\/actions\/([^/]+)$/,             'DELETE',1, (req, env, id) => handleDeleteAction(req, env, id)],
  [/^\/api\/client\/actions\/([^/]+)\/complete$/,         'PUT',  1, (req, env, id) => handleCompleteAction(req, env, id)],
  // Per-practitioner OG images (public, KV-cached 24h — item 4.3)
  [/^\/api\/og\/practitioner\/([a-z0-9-]+)$/,              'GET',  1, handlePractitionerOGImage],
  // Gift token routes (item 4.6)
  [/^\/api\/gift\/([A-Za-z0-9_-]{20,60})\/redeem$/,        'POST', 1, (req, env, t) => handleRedeemGift(req, env, t)],
  [/^\/api\/gift\/([A-Za-z0-9_-]{20,60})$/,                'GET',  1, (req, env, t) => handleGetGift(req, env, t)],
  // Reviews — public directory + practitioner approve/hide
  [/^\/api\/directory\/([^/]+)\/reviews$/,               'GET',  1, (req, env, slug) => handleGetPublicReviews(req, env, slug)],
  [/^\/api\/practitioner\/reviews\/([^/]+)\/approve$/,   'PUT',  1, (req, env, id) => handleApproveReview(req, env, id)],
  [/^\/api\/practitioner\/reviews\/([^/]+)\/hide$/,      'PUT',  1, (req, env, id) => handleHideReview(req, env, id)],
];

/**
 * Resolve a request to a route handler.
 * Returns { handler, args } or null for 404.
 */
function resolveRoute(method, path) {
  // 1. Exact match — O(1)
  const exact = EXACT_ROUTES.get(`${method} ${path}`);
  if (exact) return { handler: exact, args: [] };

  // 2. Prefix delegation
  for (const [prefix, handler, strip] of PREFIX_ROUTES) {
    if (path.startsWith(prefix)) {
      const arg = strip === null ? path : (path.replace(strip, '') || '/');
      return { handler, args: [arg] };
    }
  }

  // 3. Pattern (regex) match
  for (const [pattern, reqMethod, paramIdx, handler] of PATTERN_ROUTES) {
    if (reqMethod && method !== reqMethod) continue;
    const m = path.match(pattern);
    if (m) return { handler, args: [m[paramIdx]] };
  }

  return null;
}

export default {
  /**
   * HTTP request handler.
   */
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env.ENVIRONMENT);
    }

    // Startup secrets guard — reject early if critical env vars are missing
    const missingSecrets = [];
    if (!env?.NEON_CONNECTION_STRING) missingSecrets.push('NEON_CONNECTION_STRING');
    if (!env?.JWT_SECRET) missingSecrets.push('JWT_SECRET');
    if (missingSecrets.length > 0) {
      console.error(JSON.stringify({ event: 'missing_secrets', missing: missingSecrets }));
      return new Response(JSON.stringify({ error: 'Service configuration error' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    // BL-AUDIT-M4: Boot-time JWT environment assertion
      // Reject only truly missing issuer config. `primeself` remains the current
      // production issuer, so treat it as valid and log it for observability.
      if (env.ENVIRONMENT === 'production' && !env.JWT_ISSUER) {
      console.error(JSON.stringify({ event: 'fatal_jwt_misconfiguration', env: env.ENVIRONMENT, issuer: env.JWT_ISSUER }));
      return new Response(JSON.stringify({ error: 'Service misconfigured (JWT_ISSUER)' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }
      if (env.ENVIRONMENT === 'production' && env.JWT_ISSUER === 'primeself') {
        console.warn(JSON.stringify({ event: 'jwt_issuer_default_in_production', env: env.ENVIRONMENT, issuer: env.JWT_ISSUER }));
      }

    const url = new URL(request.url);
    const path = url.pathname;
    const sentry = initSentry(env);

    // Correlation ID — echo client's if present, otherwise generate one.
    // Threaded through every log line and response header.
    const reqId = request.headers.get('X-Request-ID') || generateRequestId();
    const log   = createLogger(reqId);
    request._reqId = reqId;
    request._log   = log;
    request._ctx   = ctx; // make ctx available to route handlers via request._ctx
    const requestContext = captureRequestContext(request);
    const sentryRequest = captureSentryRequest(request);

    try {
      // Authentication check (protected routes)
      if (requiresAuth(path)) {
        const authResult = await authenticate(request, env);
        if (authResult) return addCorsHeaders(authResult, request, env.ENVIRONMENT);
      }

      // Rate limiting (all API routes)
      if (path.startsWith('/api/')) {
        const rlResult = await rateLimit(request, env);
        if (rlResult) return addCorsHeaders(rlResult, request, env.ENVIRONMENT);
      }

      // Body size limit (1 MB) — reject oversized payloads early
      const MAX_BODY_BYTES = 1_048_576;
      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > MAX_BODY_BYTES) {
        return addCorsHeaders(
          Response.json({ error: 'Payload too large' }, { status: 413 }),
          request, env.ENVIRONMENT
        );
      }

      // SYS-024: Use Cloudflare's bodySize when available to avoid cloning the body.
      // Fall back to stream-count only when cf.bodySize is absent (non-CF environments / tests).
      if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body && !contentLength) {
        const cfBodySize = request.cf?.bodySize;
        if (cfBodySize !== undefined) {
          if (cfBodySize > MAX_BODY_BYTES) {
            return addCorsHeaders(
              Response.json({ error: 'Payload too large' }, { status: 413 }),
              request, env.ENVIRONMENT
            );
          }
        } else {
          const clone = request.clone();
          const reader = clone.body.getReader();
          let totalBytes = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            if (totalBytes > MAX_BODY_BYTES) {
              reader.cancel();
              return addCorsHeaders(
                Response.json({ error: 'Payload too large' }, { status: 413 }),
                request, env.ENVIRONMENT
              );
            }
          }
        }
      }

      // Content-Type validation for mutating requests with a body
      if (['POST', 'PUT', 'PATCH'].includes(request.method) && contentLength > 0) {
        const ct = (request.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('application/json') && !ct.includes('multipart/form-data')) {
          return addCorsHeaders(
            Response.json({ error: 'Content-Type must be application/json' }, { status: 415 }),
            request, env.ENVIRONMENT
          );
        }
      }

      // Input validation — rejects malformed bodies before handler dispatch
      const validationError = await validateRequestBody(request, request.method, path);
      if (validationError) return addCorsHeaders(validationError, request, env.ENVIRONMENT);

      let response;

      // ─── Route matching (table-driven, BL-R-M9) ────────
      const route = resolveRoute(request.method, path);

      if (route) {
        response = await route.handler(request, env, ...route.args);
      } else if (path === '/api/health') {
        // Basic health — allow `?full=1` to include presence flags for required secrets (no values)
        const url = new URL(request.url);
        const full = url.searchParams.get('full');
        const base = {
          status: 'ok',
          version: '0.2.0',
          timestamp: new Date().toISOString(),
          cache: getCacheMetrics(),
        };
        if (full === '1') {
          const auditToken = url.searchParams.get('token') || request.headers.get('X-Audit-Token');
          if (!env.AUDIT_SECRET || auditToken !== env.AUDIT_SECRET) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
          }
          const secrets = {
            hasNeon: !!env?.NEON_CONNECTION_STRING,
            hasJwt: !!env?.JWT_SECRET,
            hasStripe: !!env?.STRIPE_SECRET_KEY,
            hasStripeWebhook: !!env?.STRIPE_WEBHOOK_SECRET,
            hasTelnyx: !!env?.TELNYX_API_KEY,
            hasResend: !!env?.RESEND_API_KEY,
            hasSentry: !!env?.SENTRY_DSN,
            hasAuditSecret: !!env?.AUDIT_SECRET,
            hasAnthropic: !!env?.ANTHROPIC_API_KEY,
            hasVapid: !!env?.VAPID_PUBLIC_KEY && !!env?.VAPID_PRIVATE_KEY,
          };

          // CIO-004: Run DB, KV, Stripe, and R2 reachability checks concurrently.
          const [db, kv, stripeHealth, r2Health] = await Promise.all([
            (async () => {
              if (!env?.NEON_CONNECTION_STRING) return { ok: false, latencyMs: null, error: 'not configured' };
              const { createQueryFn } = await import('./db/queries.js');
              const q = createQueryFn(env.NEON_CONNECTION_STRING);
              const t0 = Date.now();
              try {
                await q('SELECT 1 AS ping');
                return { ok: true, latencyMs: Date.now() - t0, error: null };
              } catch (e) {
                return { ok: false, latencyMs: Date.now() - t0, error: e.message };
              }
            })(),
            (async () => {
              if (!env?.CACHE) return { ok: false, error: 'not bound' };
              try {
                await env.CACHE.put('__health__', '1', { expirationTtl: 60 });
                const v = await env.CACHE.get('__health__');
                return { ok: v === '1', error: null };
              } catch (e) {
                return { ok: false, error: e.message };
              }
            })(),
            (async () => {
              if (!env?.STRIPE_SECRET_KEY) return { ok: false, latencyMs: null, error: 'not configured' };
              const { createStripeClient } = await import('./lib/stripe.js');
              const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
              const t0 = Date.now();
              try {
                await stripe.balance.retrieve();
                return { ok: true, latencyMs: Date.now() - t0, error: null };
              } catch (e) {
                return { ok: false, latencyMs: Date.now() - t0, error: e.message };
              }
            })(),
            (async () => {
              if (!env?.R2) return { ok: false, error: 'not bound' };
              try {
                await env.R2.head('__health__');
                return { ok: true, error: null };
              } catch (e) {
                return { ok: false, error: e.message };
              }
            })(),
          ]);

          const allOk = db.ok && kv.ok && stripeHealth.ok && r2Health.ok;
          response = Response.json(
            Object.assign(base, { status: allOk ? 'ok' : 'degraded', secrets, db, kv, stripe: stripeHealth, r2: r2Health }),
            { status: allOk ? 200 : 503 }
          );
        } else {
          response = Response.json(base);
        }
      } else if (path === '/api/cache/invalidate' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const prefix = body.prefix || '';
        if (!prefix) {
          response = Response.json({ error: 'Missing "prefix" in body' }, { status: 400 });
        } else {
          const deleted = await kvCache.invalidatePrefix(env, prefix, body.limit || 100);
          response = Response.json({ ok: true, prefix, deleted });
        }
      } else {
        response = Response.json({ error: 'Not Found', path }, { status: 404 });
      }

      // Add rate limit + CORS headers
      response = addRateLimitHeaders(response, request);

      // Apply CDN cache headers for public API routes (BL-OPT-001)
      response = applyCacheForPublicAPI(response, path);

      // Apply security headers (COND-1)
      response = applySecurityHeaders(response);

      // Fire-and-forget: track API call for analytics (non-blocking)
      if (path.startsWith('/api/') && path !== '/api/health') {
        ctx.waitUntil(trackEvent(env, EVENTS.API_CALL, {
          userId: request._user?.sub,
          properties: { path, method: request.method, status: response.status },
          requestContext,
        }));
      }

      return addCorsHeaders(response, request, env.ENVIRONMENT);

    } catch (err) {
      log.error('unhandled_exception', {
        error: err.message,
        path,
        method: request.method,
        stack: err.stack?.split('\n').slice(0, 3).join(' | '),
      });
      // Fire-and-forget: track error for analytics + Sentry
      ctx.waitUntil(Promise.all([
        trackError(env, err, {
          endpoint: path,
          userId: request._user?.sub,
          severity: (err.status || 500) >= 500 ? 'high' : 'medium',
          requestContext,
        }),
        sentry.captureException(err, {
          request: sentryRequest,
          user: request._user,
          tags: { path, method: request.method, reqId },
        }),
      ]));
      const errResponse = errorResponse(err, err.status || 500, env);
      return addCorsHeaders(errResponse, request, env.ENVIRONMENT);
    }
  },

  /**
   * Scheduled cron handler — daily transit snapshot + digest delivery + analytics aggregation.
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([
      runDailyTransitCron(env),
      aggregateDaily(env),
    ]));
  }
};

function addCorsHeaders(response, request, environment) {
  const headers = new Headers(response.headers);
  // Thread X-Request-ID through every response so clients can correlate logs
  if (request._reqId) headers.set('X-Request-ID', request._reqId);
  // /api/embed/validate is a public, no-PII endpoint called from any origin (third-party embeds).
  // If the handler already set Access-Control-Allow-Origin: *, do not overwrite it.
  if (headers.get('Access-Control-Allow-Origin') === '*') {
    return new Response(response.body, { status: response.status, headers });
  }
  const dynamicCorsHeaders = getCorsHeaders(request, environment);
  for (const [key, value] of Object.entries(dynamicCorsHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    headers
  });
}
