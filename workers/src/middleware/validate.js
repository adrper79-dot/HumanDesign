/**
 * Centralized input validation middleware using zod.
 *
 * Schema registry maps "METHOD /path" → zod schema.
 * Validates JSON body before the handler runs.
 * Handlers continue to call request.json() (unaffected).
 *
 * Usage in fetch():
 *   const rejection = await validateRequestBody(request, method, path, env);
 *   if (rejection) return addCorsHeaders(rejection, request, env.ENVIRONMENT);
 */

import { z } from 'zod';

// ── Reusable primitives ─────────────────────────────────────────

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM');
const ianaTimezone = z.string().max(100);
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const email = z.string().min(1).max(254).email();
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
const platform = z.string().max(50).optional();

// Coerce lat/lng from string or number input (parseFloat in handlers)
const coerceLat = z.preprocess(v => typeof v === 'string' ? Number(v) : v, latitude);
const coerceLng = z.preprocess(v => typeof v === 'string' ? Number(v) : v, longitude);

// Birth data pattern shared by many endpoints
const birthDataRequired = {
  birthDate: dateStr,
  birthTime: timeStr,
  birthTimezone: ianaTimezone.optional(),
  lat: coerceLat,
  lng: coerceLng,
};

const birthDataOptional = {
  birthDate: dateStr.optional(),
  birthTime: timeStr.optional(),
  birthTimezone: ianaTimezone.optional(),
  lat: coerceLat.optional(),
  lng: coerceLng.optional(),
};

// ── Schema Registry ─────────────────────────────────────────────

/** @type {Map<string, import('zod').ZodType>} */
const SCHEMAS = new Map([

  // ─── Auth ────────────────────
  ['POST /api/auth/register', z.object({
    email,
    password,
    phone: z.string().max(30).optional(),
    ...birthDataOptional,
  }).passthrough()],

  ['POST /api/auth/login', z.object({
    email,
    password: z.string().min(1).max(128),
  })],

  ['POST /api/auth/forgot-password', z.object({
    email,
  })],

  ['POST /api/auth/reset-password', z.object({
    token: z.string().min(1).max(512),
    password,
  })],

  ['POST /api/auth/verify-email', z.object({
    token: z.string().min(1).max(512),
  })],

  ['POST /api/auth/2fa/enable', z.object({
    totp_code: z.string().min(1).max(10),
  })],

  ['POST /api/auth/2fa/disable', z.object({
    password: z.string().min(1).max(128),
    totp_code: z.string().min(1).max(10),
  })],

  ['POST /api/auth/2fa/verify', z.object({
    pending_token: z.string().min(1).max(2048),
    totp_code: z.string().min(1).max(10),
  })],

  // ─── Chart / Calculation ─────
  ['POST /api/chart/calculate', z.object({
    ...birthDataRequired,
  }).passthrough()],

  ['POST /api/chart/save', z.object({
    ...birthDataRequired,
    hdChart: z.record(z.unknown()),
    astroChart: z.record(z.unknown()).optional(),
  }).passthrough()],

  // ─── Profile ─────────────────
  ['POST /api/profile/generate', z.object({
    ...birthDataRequired,
    question: z.string().max(2000).optional(),
  }).passthrough()],

  // ─── Composite & Rectify ─────
  ['POST /api/composite', z.object({
    personA: z.object({
      ...birthDataRequired,
    }).passthrough(),
    personB: z.object({
      ...birthDataRequired,
    }).passthrough(),
  }).passthrough()],

  ['POST /api/rectify', z.object({
    ...birthDataRequired,
    windowMinutes: z.number().min(5).max(120).optional(),
    stepMinutes: z.number().min(1).max(15).optional(),
  }).passthrough()],

  // ─── Timing ──────────────────
  ['POST /api/timing/find-dates', z.object({
    intention: z.enum([
      'launch_project', 'start_relationship', 'sign_contract',
      'relocate', 'career_change', 'surgery_medical', 'travel', 'creative_work',
    ]).optional(),
    includeWeekends: z.boolean().optional(),
    windowDays: z.number().min(1).max(365).optional(),
    minScore: z.number().min(0).max(100).optional(),
  })],

  // ─── Billing ─────────────────
  ['POST /api/billing/checkout', z.object({
    tier: z.enum(['individual', 'practitioner', 'agency']),
    successUrl: z.string().url().max(2048).optional(),
    cancelUrl: z.string().url().max(2048).optional(),
    promoCode: z.string().max(64).optional(),
    billingPeriod: z.enum(['monthly', 'annual']).optional(),
  })],

  ['POST /api/billing/checkout-one-time', z.object({
    product: z.enum(['single_synthesis', 'composite_reading', 'transit_pass', 'lifetime_individual']),
    successUrl: z.string().url().max(2048).optional(),
    cancelUrl: z.string().url().max(2048).optional(),
  })],

  ['POST /api/billing/upgrade', z.object({
    tier: z.enum(['individual', 'practitioner', 'agency']),
  })],

  ['POST /api/billing/portal', z.object({
    returnUrl: z.string().url().max(2048).optional(),
  })],

  // ─── Referrals ───────────────
  ['POST /api/referrals/validate', z.object({
    code: z.string().min(1).max(64),
  })],

  ['POST /api/referrals/apply', z.object({
    code: z.string().min(1).max(64),
  })],

  ['POST /api/referrals/claim', z.object({
    referralId: z.string().uuid(),
  })],

  // ─── Cluster ─────────────────
  ['POST /api/cluster/create', z.object({
    name: z.string().min(1).max(200),
    challenge: z.string().min(1).max(2000),
  })],

  // ─── Daily Check-In ──────────
  ['POST /api/checkin', z.object({
    alignmentScore: z.number().min(1).max(10),
    followedStrategy: z.boolean(),
    followedAuthority: z.boolean(),
    notes: z.string().max(2000).optional(),
    mood: z.enum(['great', 'good', 'neutral', 'challenging', 'difficult']).optional(),
    energyLevel: z.number().min(1).max(10).optional(),
    timezone: ianaTimezone.optional(),
  })],

  // ─── Diary ───────────────────
  ['POST /api/diary', z.object({
    eventDate: dateStr,
    eventTitle: z.string().min(1).max(500),
    eventDescription: z.string().max(10000).optional(),
    eventType: z.enum(['career', 'relationship', 'health', 'spiritual', 'financial', 'family', 'other']).optional(),
    significance: z.enum(['major', 'moderate', 'minor']).optional(),
  })],

  // ─── Webhooks ────────────────
  ['POST /api/webhooks', z.object({
    url: z.string().url().max(2048).startsWith('https://'),
    events: z.array(z.enum([
      'chart.created', 'chart.updated', 'profile.generated',
      'transit.alert', 'client.added', 'client.removed',
      'subscription.updated', 'cycle.approaching',
    ])).min(1),
  })],

  // ─── Push ────────────────────
  ['POST /api/push/subscribe', z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
      p256dh: z.string().min(1).max(256),
      auth: z.string().min(1).max(256),
    }),
  })],

  ['PUT /api/push/preferences', z.object({
    transitDaily: z.boolean().optional(),
    gateActivation: z.boolean().optional(),
    cycleApproaching: z.boolean().optional(),
    transitAlert: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
    quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    timezone: ianaTimezone.optional(),
    dailyDigestTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    weeklyDigestDay: z.number().int().min(0).max(6).optional(),
  })],

  // ─── API Keys ────────────────
  ['POST /api/keys', z.object({
    name: z.string().min(1).max(200).transform(s => s.trim()),
    tier: z.enum(['free', 'regular', 'individual', 'practitioner', 'white_label', 'agency']).optional(),
    scopes: z.array(z.string().max(50)).max(20).optional(),
    expiresInDays: z.number().int().min(1).max(365).optional(),
  })],

  // ─── Onboarding ──────────────
  ['POST /api/onboarding/advance', z.object({
    forge: z.string().min(1).max(20),
    chapterIndex: z.number().int().min(1).max(10),
  })],

  // ─── Share ───────────────────
  ['POST /api/share/celebrity', z.object({
    celebrityId: z.string().min(1).max(200),
    platform: platform,
  })],

  ['POST /api/share/chart', z.object({
    platform: platform,
  })],

  ['POST /api/share/achievement', z.object({
    achievementId: z.string().min(1).max(200),
    platform: platform,
  })],

  ['POST /api/share/referral', z.object({
    platform: platform,
  })],

  // ─── Achievements ────────────
  ['POST /api/achievements/track', z.object({
    eventType: z.string().min(1).max(100),
    eventData: z.record(z.unknown()).optional(),
  })],

  // ─── Behavioral Validation ───
  ['POST /api/validation/save', z.object({
    decisionPattern: z.enum([
      'gut_impulse', 'sleep_on_it', 'emotional_wave',
      'wait_invitation', 'discuss_others', 'environmental',
    ]).optional(),
    energyPattern: z.enum([
      'steady_renewing', 'bursts_rest', 'mirrors_others',
      'environment_dependent', 'discerning_sampling', 'experimental_surprise',
    ]).optional(),
    currentFocus: z.string().max(2000).optional(),
  })],

  // ─── Psychometric ────────────
  ['POST /api/psychometric/save', z.object({
    bigFiveResponses: z.array(z.object({
      questionId: z.unknown(),
      score: z.unknown(),
    })).length(20).optional(),
    viaResponses: z.array(z.object({
      strength: z.unknown(),
      score: z.unknown(),
    })).length(24).optional(),
  }).passthrough()],

  // ─── Promo ───────────────────
  ['POST /api/promo/apply', z.object({
    code: z.string().min(1).max(64).regex(/^[A-Z0-9_-]+$/i, 'Invalid promo code format'),
  })],
]);

// Pattern-based schemas for dynamic-segment routes
const PATTERN_SCHEMAS = [
  [/^\/api\/diary\/[^/]+$/, 'PUT', z.object({
    eventDate: dateStr,
    eventTitle: z.string().min(1).max(500),
    eventDescription: z.string().max(10000).optional(),
    eventType: z.enum(['career', 'relationship', 'health', 'spiritual', 'financial', 'family', 'other']).optional(),
    significance: z.enum(['major', 'moderate', 'minor']).optional(),
  })],
];

// ── Lookup ───────────────────────────────────────────────────────

/**
 * Find the zod schema for a given method + path.
 * @param {string} method
 * @param {string} path
 * @returns {import('zod').ZodType | null}
 */
function getSchema(method, path) {
  const key = `${method} ${path}`;
  const exact = SCHEMAS.get(key);
  if (exact) return exact;

  for (const [pattern, reqMethod, schema] of PATTERN_SCHEMAS) {
    if (reqMethod && method !== reqMethod) continue;
    if (pattern.test(path)) return schema;
  }
  return null;
}

// ── Middleware ───────────────────────────────────────────────────

/**
 * Validate the request body against the registered schema.
 *
 * - Clones the request so handlers can still call request.json().
 * - Stores validated+coerced data on request._validatedBody.
 *
 * @param {Request} request
 * @param {string} method
 * @param {string} path
 * @returns {Promise<Response|null>} A 400 Response on failure, or null on success/no-schema.
 */
export async function validateRequestBody(request, method, path) {
  const schema = getSchema(method, path);
  if (!schema) return null;

  let body;
  try {
    const clone = request.clone();
    body = await clone.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.issues.map(i => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    return Response.json(
      { error: 'Validation failed', details },
      { status: 400 }
    );
  }

  request._validatedBody = result.data;
  return null;
}
