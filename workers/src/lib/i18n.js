/**
 * i18n — Internationalization utilities for Prime Self API
 *
 * Server-side translation for emails, SMS, PDFs, and API responses.
 * Locale files live in frontend/locales/{lang}.json and are loaded lazily.
 *
 * BL-OPT-006  Multi-Language Support
 *
 * Usage:
 *   import { detectLocale, t, formatDate, formatNumber, SUPPORTED_LOCALES } from '../lib/i18n.js';
 *   const locale = detectLocale(request);
 *   const text   = t(locale, 'chart.title');             // "Human Design Chart"
 *   const text2  = t(locale, 'errors.missingField', { field: 'email' }); // interpolation
 *   const date   = formatDate(locale, new Date());       // locale-aware date
 */

// ─── Supported locales ──────────────────────────────────────────────────
export const SUPPORTED_LOCALES = ['en', 'es', 'pt', 'de', 'fr'];
export const DEFAULT_LOCALE = 'en';

// ─── In-memory locale data (lazy loaded) ────────────────────────────────
const localeData = new Map();

/**
 * Load a locale's translation data from KV (pre-uploaded) or embedded fallback.
 * In Workers we can't import JSON dynamically, so locale data is stored in KV
 * under key `locale:{lang}` or falls back to embedded English.
 */
async function loadLocale(locale, env) {
  if (localeData.has(locale)) return localeData.get(locale);

  // Attempt KV load
  if (env?.CACHE) {
    try {
      const raw = await env.CACHE.get(`locale:${locale}`, 'json');
      if (raw) {
        localeData.set(locale, raw);
        return raw;
      }
    } catch { /* fallback below */ }
  }

  // No KV data → return null (caller uses English fallback)
  return null;
}

// ─── Embedded English strings (always available, no KV needed) ──────────
// This is a minimal subset for critical paths (emails, errors).
// Full locale data comes from KV.
const ENGLISH_FALLBACK = Object.freeze({
  'common.loading': 'Loading…',
  'common.error': 'Something went wrong.',
  'common.success': 'Success!',
  'errors.networkError': 'Network error. Please check your connection.',
  'errors.serverError': 'Server error. Please try again later.',
  'errors.notFound': 'Not found.',
  'errors.unauthorized': 'Please sign in to continue.',
  'errors.forbidden': 'You don\'t have access to this feature.',
  'errors.quotaExceeded': 'Usage limit reached. Upgrade for more.',
  'errors.invalidInput': 'Please check your input and try again.',
  'errors.missingField': 'Missing required field: {{field}}',
  'email.welcome.subject': 'Welcome to Prime Self 🌟',
  'email.digest.subject': 'Your Daily Transit Digest',
  'sms.digest.greeting': 'Good morning! Here\'s your transit digest:',
  'chart.type': 'Type',
  'chart.authority': 'Authority',
  'chart.profile': 'Profile',
  'chart.strategy': 'Strategy',
  'chart.definition': 'Definition',
  'chart.notSelf': 'Not-Self Theme',
  'chart.incarnationCross': 'Incarnation Cross',
  'chart.definedCenters': 'Defined Centers',
  'chart.openCenters': 'Open Centers',
});

/**
 * Resolve a dotted key path (e.g. 'chart.title') from nested JSON
 */
function resolveKey(data, key) {
  if (!data) return undefined;
  const parts = key.split('.');
  let node = data;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Interpolate {{placeholder}} variables into a string.
 *   interpolate('Hello {{name}}', { name: 'Alice' }) → 'Hello Alice'
 */
function interpolate(str, vars) {
  if (!vars || typeof str !== 'string') return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`;
  });
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Detect locale from request headers, query param, or user preference.
 * Priority: ?lang= query param → Accept-Language header → default
 *
 * @param {Request} request
 * @param {Object} [userPrefs] - Optional { lang } from user DB record
 * @returns {string} Normalized locale code (en, es, pt, de, fr)
 */
export function detectLocale(request, userPrefs) {
  // 1. Explicit query param: ?lang=es
  const url = new URL(request.url);
  const qLang = url.searchParams.get('lang');
  if (qLang && SUPPORTED_LOCALES.includes(qLang.toLowerCase())) {
    return qLang.toLowerCase();
  }

  // 2. User's saved preference (from DB)
  if (userPrefs?.lang && SUPPORTED_LOCALES.includes(userPrefs.lang)) {
    return userPrefs.lang;
  }

  // 3. Accept-Language header parsing
  const acceptLang = request.headers.get('Accept-Language');
  if (acceptLang) {
    // Parse weighted language tags: "es-MX,es;q=0.9,en;q=0.8"
    const tags = acceptLang.split(',').map(part => {
      const [tag, qPart] = part.trim().split(';');
      const q = qPart ? parseFloat(qPart.replace('q=', '')) : 1;
      return { lang: tag.trim().split('-')[0].toLowerCase(), q };
    }).sort((a, b) => b.q - a.q);

    for (const { lang } of tags) {
      if (SUPPORTED_LOCALES.includes(lang)) return lang;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Translate a key with optional interpolation.
 * Synchronous — uses pre-loaded locale data or English fallback.
 *
 * @param {string} locale - Locale code
 * @param {string} key - Dot-path key (e.g. 'chart.title')
 * @param {Object} [vars] - Interpolation variables
 * @returns {string} Translated string
 */
export function t(locale, key, vars) {
  // Try loaded locale data first
  const data = localeData.get(locale);
  let str = resolveKey(data, key);

  // Fallback to English locale data
  if (str === undefined && locale !== DEFAULT_LOCALE) {
    const en = localeData.get(DEFAULT_LOCALE);
    str = resolveKey(en, key);
  }

  // Fallback to embedded English constants
  if (str === undefined) {
    str = ENGLISH_FALLBACK[key];
  }

  // Last resort: return the key itself
  if (str === undefined) return key;

  return vars ? interpolate(str, vars) : str;
}

/**
 * Async translate — ensures locale data is loaded before resolving.
 * Use this in handler entry points; then use sync t() everywhere else.
 *
 * @param {string} locale
 * @param {string} key
 * @param {Object} [vars]
 * @param {Object} env - Worker env for KV access
 * @returns {Promise<string>}
 */
export async function tAsync(locale, key, vars, env) {
  await ensureLocaleLoaded(locale, env);
  return t(locale, key, vars);
}

/**
 * Pre-load locale data into memory. Call once per request in handler.
 *
 * @param {string} locale
 * @param {Object} env - Worker env with CACHE KV binding
 */
export async function ensureLocaleLoaded(locale, env) {
  if (localeData.has(locale)) return;
  await loadLocale(locale, env);
  // Always ensure English fallback is available
  if (!localeData.has(DEFAULT_LOCALE)) {
    await loadLocale(DEFAULT_LOCALE, env);
  }
}

/**
 * Format a date according to the locale.
 *
 * @param {string} locale - Locale code (en, es, pt, de, fr)
 * @param {Date|string|number} date - Date to format
 * @param {Object} [opts] - Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatDate(locale, date, opts = {}) {
  const d = date instanceof Date ? date : new Date(date);
  const intlLocale = localeToIntl(locale);
  const defaults = { year: 'numeric', month: 'long', day: 'numeric', ...opts };
  try {
    return new Intl.DateTimeFormat(intlLocale, defaults).format(d);
  } catch {
    return d.toLocaleDateString('en-US', defaults);
  }
}

/**
 * Format a number according to the locale.
 *
 * @param {string} locale
 * @param {number} num
 * @param {Object} [opts] - Intl.NumberFormat options
 * @returns {string}
 */
export function formatNumber(locale, num, opts = {}) {
  const intlLocale = localeToIntl(locale);
  try {
    return new Intl.NumberFormat(intlLocale, opts).format(num);
  } catch {
    return String(num);
  }
}

/**
 * Format currency for the locale.
 *
 * @param {string} locale
 * @param {number} amount - Amount in smallest unit (cents)
 * @param {string} [currency='USD']
 * @returns {string}
 */
export function formatCurrency(locale, amount, currency = 'USD') {
  return formatNumber(locale, amount / 100, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

/**
 * Get the locale name in its own language.
 * Returns the loaded meta.name or a hardcoded fallback.
 */
export function getLocaleName(locale) {
  const names = { en: 'English', es: 'Español', pt: 'Português', de: 'Deutsch', fr: 'Français' };
  const data = localeData.get(locale);
  return data?.meta?.name || names[locale] || locale;
}

/**
 * Map our short locale codes to full Intl locale tags.
 */
function localeToIntl(locale) {
  const map = { en: 'en-US', es: 'es-419', pt: 'pt-BR', de: 'de-DE', fr: 'fr-FR' };
  return map[locale] || 'en-US';
}

/**
 * Upload locale JSON to KV for runtime access.
 * Call this from a deploy script or migration.
 *
 * @param {Object} env - Worker env with CACHE KV binding
 * @param {string} locale - Locale code
 * @param {Object} data - Parsed locale JSON
 */
export async function uploadLocale(env, locale, data) {
  if (!env?.CACHE) throw new Error('CACHE KV binding required');
  await env.CACHE.put(`locale:${locale}`, JSON.stringify(data), {
    metadata: { locale, uploadedAt: Date.now() },
  });
}

/**
 * List all available locales with metadata.
 *
 * @returns {Array<{code: string, name: string, loaded: boolean}>}
 */
export function listLocales() {
  return SUPPORTED_LOCALES.map(code => ({
    code,
    name: getLocaleName(code),
    loaded: localeData.has(code),
  }));
}
