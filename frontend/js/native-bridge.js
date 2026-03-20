/**
 * Native Bridge — GAP-005 Phase 0
 *
 * Detects Capacitor runtime and activates native APIs:
 *   - Safe-area CSS variables (notch / Dynamic Island insets)
 *   - Deep link routing (primeself:// scheme)
 *   - Status bar overlay
 *   - App lifecycle (resume = silent token refresh)
 *   - Share sheet with web fallback
 *   - Haptics shim (no-op on web)
 *
 * Exposes: window.NativeBridge
 *
 * Loaded as eager defer BEFORE app.js so that NativeBridge is available
 * when app.js initialises. Works in both Capacitor WKWebView and plain browser —
 * all paths guard on isNative before calling Capacitor APIs.
 */
(function () {
  'use strict';

  // ── Detection ────────────────────────────────────────────────────────────────

  var cap = window.Capacitor || null;
  var isNative = !!(cap && cap.isNative);
  var platform = isNative ? (cap.getPlatform ? cap.getPlatform() : 'ios') : 'web';

  // ── Safe-area insets ─────────────────────────────────────────────────────────
  // Inject CSS variables from env(safe-area-inset-*) so layout CSS can use
  // var(--sat), var(--sab), var(--sal), var(--sar) without a Capacitor plugin.

  function initSafeAreaInsets() {
    var style = document.createElement('style');
    style.id = 'native-safe-area';
    style.textContent = [
      ':root {',
      '  --sat: env(safe-area-inset-top, 0px);',
      '  --sab: env(safe-area-inset-bottom, 0px);',
      '  --sal: env(safe-area-inset-left, 0px);',
      '  --sar: env(safe-area-inset-right, 0px);',
      '}'
    ].join('\n');
    document.head.appendChild(style);

    if (isNative) {
      // Add class so CSS can target Capacitor-hosted views specifically.
      document.documentElement.classList.add('is-native-app', 'platform-' + platform);
    }
  }

  // ── Status bar ───────────────────────────────────────────────────────────────

  function initStatusBar() {
    if (!isNative) return;
    try {
      var StatusBar = cap.Plugins && cap.Plugins.StatusBar;
      if (!StatusBar) return;
      StatusBar.setOverlaysWebView({ overlay: true });
      StatusBar.setStyle({ style: 'DARK' });
    } catch (e) {
      // StatusBar plugin not installed — ignore.
    }
  }

  // ── Deep links ───────────────────────────────────────────────────────────────
  // Handles primeself://tab/<id>  → switchTab(id)
  //          primeself://auth?token=<code> → OAuth exchange
  //          primeself://profile/<userId>  → open profile tab

  function handleDeepLinkUrl(url) {
    try {
      // Parse the deep link URL safely.
      var parsed;
      try {
        parsed = new URL(url);
      } catch (_) {
        return;
      }

      var scheme = parsed.protocol.replace(':', '');
      if (scheme !== 'primeself' && scheme !== 'https') return;

      var path = parsed.pathname || '/';
      var params = parsed.searchParams;

      // primeself://tab/<tabName>
      var tabMatch = path.match(/^\/tab\/([a-zA-Z0-9_-]+)/);
      if (tabMatch) {
        var tabName = tabMatch[1];
        if (typeof window.switchTab === 'function') {
          window.switchTab(tabName);
        }
        return;
      }

      // primeself://auth?token=<exchange_code>
      if (path === '/auth' && params.get('token')) {
        var token = params.get('token');
        // Post to the OAuth exchange endpoint — matches handleOAuthExchange pattern.
        fetch('/api/auth/oauth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: token, provider: 'deep_link' }),
          credentials: 'include'
        }).then(function (res) {
          if (res.ok) {
            // Reload to pick up the new session cookie.
            window.location.reload();
          }
        }).catch(function () {
          // Silent failure — user stays on current page.
        });
        return;
      }

      // primeself://profile/<userId>
      var profileMatch = path.match(/^\/profile\/([a-zA-Z0-9_-]+)/);
      if (profileMatch) {
        if (typeof window.switchTab === 'function') {
          window.switchTab('chart');
        }
        return;
      }
    } catch (e) {
      // Ignore malformed deep links to prevent any crash.
    }
  }

  function initDeepLinks() {
    if (!isNative) return;
    try {
      var App = cap.Plugins && cap.Plugins.App;
      if (!App) return;
      App.addListener('appUrlOpen', function (data) {
        if (data && data.url) {
          handleDeepLinkUrl(data.url);
        }
      });
    } catch (e) {
      // App plugin not installed.
    }
  }

  // ── App lifecycle ────────────────────────────────────────────────────────────
  // On resume: attempt a silent token refresh so long-backgrounded sessions
  // do not hit an expired-token error on the next API call.

  function initAppLifecycle() {
    if (!isNative) return;
    try {
      var App = cap.Plugins && cap.Plugins.App;
      if (!App) return;
      App.addListener('appStateChange', function (state) {
        if (state && state.isActive) {
          // Silent refresh — fire-and-forget; failure is acceptable here.
          fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include'
          }).catch(function () {});
        }
      });
    } catch (e) {
      // App plugin not installed.
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Share content using the native share sheet (iOS/Android) or the
   * Web Share API, falling back to copying the URL to the clipboard.
   * @param {object} opts  { title, text, url }
   * @returns {Promise<void>}
   */
  function share(opts) {
    opts = opts || {};
    if (isNative) {
      try {
        var Share = cap.Plugins && cap.Plugins.Share;
        if (Share) {
          return Share.share({
            title: opts.title || '',
            text: opts.text || '',
            url: opts.url || window.location.href,
            dialogTitle: opts.title || 'Share'
          });
        }
      } catch (e) { /* fall through */ }
    }
    if (navigator.share) {
      return navigator.share({
        title: opts.title || '',
        text: opts.text || '',
        url: opts.url || window.location.href
      });
    }
    // Last resort: copy to clipboard.
    var textToCopy = opts.url || window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(textToCopy);
    }
    return Promise.resolve();
  }

  /**
   * Trigger haptic feedback. No-op on web.
   * @param {'light'|'medium'|'heavy'} style
   */
  function haptic(style) {
    if (!isNative) return;
    try {
      var Haptics = cap.Plugins && cap.Plugins.Haptics;
      if (!Haptics) return;
      var ImpactStyle = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' };
      Haptics.impact({ style: ImpactStyle[style] || 'MEDIUM' });
    } catch (e) { /* plugin not installed */ }
  }

  /**
   * Open an internal deep link URL.
   * @param {string} url  e.g. "primeself://tab/transits"
   */
  function openDeepLink(url) {
    handleDeepLinkUrl(url);
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────

  function boot() {
    initSafeAreaInsets();
    initStatusBar();
    initDeepLinks();
    initAppLifecycle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Expose public interface.
  window.NativeBridge = {
    isNative: isNative,
    platform: platform,
    share: share,
    haptic: haptic,
    openDeepLink: openDeepLink
  };
}());
