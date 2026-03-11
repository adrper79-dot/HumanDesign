/**
 * Prime Self — Frontend i18n (Internationalization)
 *
 * BL-OPT-006  Multi-Language Support
 *
 * Loads locale JSON from /locales/{lang}.json, provides a global t() function,
 * and manages a language-switcher dropdown.
 *
 * Usage:
 *   // Automatically initializes on DOMContentLoaded
 *   // From any script:
 *   const label = window.t('chart.title');           // "Energy Blueprint Chart"
 *   const msg   = window.t('errors.missingField', { field: 'email' });
 *
 * The language switcher is auto-injected near the auth area if a container
 * with id="lang-switcher" exists, or creates one.
 */
(function () {
  'use strict';

  // ─── Config ──────────────────────────────────────────────────────────
  const SUPPORTED = ['en', 'es', 'pt', 'de', 'fr'];
  const DEFAULT   = 'en';
  const STORAGE_KEY = 'ps-locale';
  const LOCALE_PATH = '/locales/';

  const LOCALE_NAMES = {
    en: 'English',
    es: 'Español',
    pt: 'Português',
    de: 'Deutsch',
    fr: 'Français',
  };

  const LOCALE_FLAGS = {
    en: '🇺🇸',
    es: '🇪🇸',
    pt: '🇧🇷',
    de: '🇩🇪',
    fr: '🇫🇷',
  };

  // ─── State ───────────────────────────────────────────────────────────
  let currentLocale = DEFAULT;
  const localeCache = {};   // { en: {...}, es: {...} }
  const listeners = [];     // onChange callbacks
  let _outsideClickHandler = null; // BL-R-L7: store ref to avoid duplicate listeners

  // ─── Locale detection ────────────────────────────────────────────────

  /**
   * Detect best locale: localStorage → URL ?lang= → navigator.language → default
   */
  function detectLocale() {
    // 1. Saved preference
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;

    // 2. URL query param
    const params = new URLSearchParams(window.location.search);
    const qLang = params.get('lang');
    if (qLang && SUPPORTED.includes(qLang.toLowerCase())) return qLang.toLowerCase();

    // 3. Browser language
    const browserLang = (navigator.language || navigator.userLanguage || '').split('-')[0].toLowerCase();
    if (SUPPORTED.includes(browserLang)) return browserLang;

    return DEFAULT;
  }

  // ─── Locale loading ──────────────────────────────────────────────────

  /**
   * Fetch and cache a locale JSON file.
   * @param {string} locale
   * @returns {Promise<Object>}
   */
  async function loadLocale(locale) {
    if (localeCache[locale]) return localeCache[locale];

    try {
      const resp = await fetch(`${LOCALE_PATH}${locale}.json`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      localeCache[locale] = data;
      return data;
    } catch (err) {
      window.DEBUG && console.warn(`[i18n] Failed to load ${locale}.json:`, err.message);
      // Fall back to English
      if (locale !== DEFAULT && !localeCache[DEFAULT]) {
        return loadLocale(DEFAULT);
      }
      return localeCache[DEFAULT] || {};
    }
  }

  // ─── Translation ─────────────────────────────────────────────────────

  /**
   * Resolve a dot-path key from nested object.
   * e.g. resolveKey(data, 'chart.title') → data.chart.title
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
   * Interpolate {{placeholder}} variables.
   */
  function interpolate(str, vars) {
    if (!vars || typeof str !== 'string') return str;
    return str.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`
    );
  }

  /**
   * Translate a key. Falls back to English, then returns the key itself.
   *
   * @param {string} key - Dot-path (e.g. 'chart.title')
   * @param {Object} [vars] - Interpolation variables
   * @returns {string}
   */
  function t(key, vars) {
    // Current locale
    let str = resolveKey(localeCache[currentLocale], key);

    // Fallback to English
    if (str === undefined && currentLocale !== DEFAULT) {
      str = resolveKey(localeCache[DEFAULT], key);
    }

    // Last resort
    if (str === undefined) return key;

    return vars ? interpolate(str, vars) : str;
  }

  // ─── DOM translation ─────────────────────────────────────────────────

  /**
   * Scan the DOM for elements with data-i18n="key" and replace their textContent.
   * Also handles data-i18n-placeholder, data-i18n-title, data-i18n-aria.
   */
  function translateDOM() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key);
    });

    // Title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.title = t(key);
    });

    // Aria labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });

    // Update html lang attribute
    document.documentElement.lang = currentLocale;
  }

  // ─── Language switcher UI ────────────────────────────────────────────

  /**
   * Create or update the language switcher dropdown.
   */
  function renderSwitcher() {
    let container = document.getElementById('lang-switcher');

    if (!container) {
      // Try to inject near auth area or header
      const authArea = document.querySelector('.auth-status') ||
                        document.querySelector('header') ||
                        document.querySelector('nav');
      if (!authArea) return;

      container = document.createElement('div');
      container.id = 'lang-switcher';
      container.className = 'lang-switcher';
      authArea.appendChild(container);
    }

    container.innerHTML = '';

    const btn = document.createElement('button');
    btn.className = 'lang-switcher-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Change language');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `<span class="lang-flag" aria-hidden="true">${LOCALE_FLAGS[currentLocale]}</span><span class="lang-name"> ${LOCALE_NAMES[currentLocale]}</span>`;

    const dropdown = document.createElement('div');
    dropdown.className = 'lang-switcher-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.hidden = true;

    for (const code of SUPPORTED) {
      const opt = document.createElement('button');
      opt.className = 'lang-switcher-option' + (code === currentLocale ? ' active' : '');
      opt.type = 'button';
      opt.setAttribute('role', 'option');
      opt.setAttribute('aria-selected', code === currentLocale ? 'true' : 'false');
      opt.dataset.locale = code;
      opt.textContent = `${LOCALE_FLAGS[code]} ${LOCALE_NAMES[code]}`;
      opt.addEventListener('click', () => setLocale(code));
      dropdown.appendChild(opt);
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !dropdown.hidden;
      dropdown.hidden = open;
      btn.setAttribute('aria-expanded', !open);
    });

    // Close on outside click — BL-R-L7: remove previous listener before adding new one
    if (_outsideClickHandler) {
      document.removeEventListener('click', _outsideClickHandler);
    }
    _outsideClickHandler = function() {
      dropdown.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    };
    document.addEventListener('click', _outsideClickHandler);

    container.appendChild(btn);
    container.appendChild(dropdown);
  }

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Switch to a new locale. Loads the JSON if needed, updates DOM, fires listeners.
   */
  async function setLocale(locale) {
    if (!SUPPORTED.includes(locale)) return;
    if (locale === currentLocale && localeCache[locale]) return;

    currentLocale = locale;
    localStorage.setItem(STORAGE_KEY, locale);

    await loadLocale(locale);
    // Always ensure English is loaded for fallback
    if (!localeCache[DEFAULT]) await loadLocale(DEFAULT);

    translateDOM();
    renderSwitcher();

    // Notify listeners
    for (const fn of listeners) {
      try { fn(locale); } catch (e) { console.error('[i18n] listener error:', e); }
    }
  }

  /**
   * Register a callback for locale changes.
   * @param {Function} fn - Called with (locale) on change
   */
  function onLocaleChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  /**
   * Get the current locale code.
   */
  function getLocale() {
    return currentLocale;
  }

  /**
   * Format a date for the current locale.
   */
  function formatDate(date, opts = {}) {
    const d = date instanceof Date ? date : new Date(date);
    const intlMap = { en: 'en-US', es: 'es-419', pt: 'pt-BR', de: 'de-DE', fr: 'fr-FR' };
    const intlLocale = intlMap[currentLocale] || 'en-US';
    try {
      return new Intl.DateTimeFormat(intlLocale, { year: 'numeric', month: 'long', day: 'numeric', ...opts }).format(d);
    } catch {
      return d.toLocaleDateString();
    }
  }

  /**
   * Format a number for the current locale.
   */
  function formatNumber(num, opts = {}) {
    const intlMap = { en: 'en-US', es: 'es-419', pt: 'pt-BR', de: 'de-DE', fr: 'fr-FR' };
    try {
      return new Intl.NumberFormat(intlMap[currentLocale] || 'en-US', opts).format(num);
    } catch {
      return String(num);
    }
  }

  // ─── Initialize ──────────────────────────────────────────────────────

  async function init() {
    currentLocale = detectLocale();

    // Load English first (fallback), then detected locale
    await loadLocale(DEFAULT);
    if (currentLocale !== DEFAULT) {
      await loadLocale(currentLocale);
    }

    translateDOM();
    renderSwitcher();
  }

  // Expose globals
  window.t = t;
  window.i18n = {
    t,
    setLocale,
    getLocale,
    onLocaleChange,
    formatDate,
    formatNumber,
    SUPPORTED,
    LOCALE_NAMES,
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
