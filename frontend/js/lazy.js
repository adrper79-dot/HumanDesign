/**
 * Lazy Loading & Performance Utilities (BL-OPT-005)
 *
 * Provides:
 * - Intersection Observer for lazy-loading images and heavy sections
 * - Tab-based lazy loading (load content only when tab is first opened)
 * - Deferred non-critical resource loading
 * - Image lazy loading with fade-in
 */

(function () {
  'use strict';

  // ─── Intersection Observer for Lazy Images ────────────────────

  /**
   * Convert all <img data-src="..."> to lazy-loaded images.
   * Images load when they enter the viewport with a smooth fade-in.
   */
  function initLazyImages() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: load all images immediately on older browsers
      document.querySelectorAll('img[data-src]').forEach(function (img) {
        img.src = img.dataset.src;
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          var img = entry.target;
          img.src = img.dataset.src;
          if (img.dataset.srcset) img.srcset = img.dataset.srcset;

          img.onload = function () {
            img.classList.add('loaded');
          };

          img.removeAttribute('data-src');
          img.removeAttribute('data-srcset');
          observer.unobserve(img);
        });
      },
      { rootMargin: '200px 0px', threshold: 0.01 }
    );

    document.querySelectorAll('img[data-src]').forEach(function (img) {
      observer.observe(img);
    });
  }

  // ─── Tab-Based Lazy Loading ───────────────────────────────────

  /**
   * Track which tabs have been loaded. When a tab is first activated,
   * run its initializer function (data fetch, rendering, etc.).
   */
  var tabInitialized = {};
  var tabInitializers = {};

  /**
   * Register a lazy initializer for a tab.
   * The function will be called once when the tab is first activated.
   *
   * @param {string} tabId - The tab identifier (e.g., 'transits', 'clusters')
   * @param {Function} initFn - Function to call on first activation
   */
  window.registerTabInit = function (tabId, initFn) {
    tabInitializers[tabId] = initFn;
  };

  /**
   * Called when a tab is activated. Runs the lazy initializer if registered
   * and not yet executed.
   *
   * @param {string} tabId
   */
  window.onTabActivated = function (tabId) {
    if (!tabInitialized[tabId] && tabInitializers[tabId]) {
      tabInitialized[tabId] = true;
      try {
        tabInitializers[tabId]();
      } catch (e) {
        console.error('[LazyTab] Init failed for tab:', tabId, e);
        tabInitialized[tabId] = false; // Allow retry
      }
    }
  };

  // ─── Deferred CSS Loading ─────────────────────────────────────

  /**
   * Load a CSS file asynchronously without blocking render.
   * Uses the <link rel="preload"> → onload → rel="stylesheet" pattern.
   *
   * @param {string} href - CSS file URL
   */
  window.loadCSS = function (href) {
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    link.onload = function () {
      this.rel = 'stylesheet';
    };
    document.head.appendChild(link);

    // Fallback for browsers that don't support preload
    var noscript = document.createElement('noscript');
    noscript.innerHTML = '<link rel="stylesheet" href="' + href + '">';
    document.head.appendChild(noscript);
  };

  // ─── Intersection Observer for Heavy Sections ──────────────────

  /**
   * Defer initialization of expensive UI sections until they scroll
   * into the viewport. Add `data-lazy-init="functionName"` to any
   * element and it will call window[functionName]() when visible.
   */
  function initLazySections() {
    if (!('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          var el = entry.target;
          var fnName = el.dataset.lazyInit;
          if (fnName && typeof window[fnName] === 'function') {
            window[fnName](el);
          }
          observer.unobserve(el);
        });
      },
      { rootMargin: '100px 0px', threshold: 0.01 }
    );

    document.querySelectorAll('[data-lazy-init]').forEach(function (el) {
      observer.observe(el);
    });
  }

  // ─── Performance Marks ────────────────────────────────────────

  /**
   * Record First Contentful Paint and Time to Interactive metrics
   * when Performance API is available.
   */
  function recordPerformanceMetrics() {
    if (!window.performance || !window.PerformanceObserver) return;

    // Log FCP
    try {
      var fcpObserver = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].name === 'first-contentful-paint') {
            console.log('[Perf] FCP:', Math.round(entries[i].startTime), 'ms');
            fcpObserver.disconnect();
          }
        }
      });
      fcpObserver.observe({ type: 'paint', buffered: true });
    } catch (e) {
      // PerformanceObserver not supported for paint type
    }

    // Log resource timing summary
    window.addEventListener('load', function () {
      setTimeout(function () {
        var resources = performance.getEntriesByType('resource');
        var totalSize = 0;
        var totalDuration = 0;
        resources.forEach(function (r) {
          totalSize += r.transferSize || 0;
          totalDuration += r.duration;
        });
        console.log(
          '[Perf] Resources:',
          resources.length,
          '| Transfer:',
          Math.round(totalSize / 1024),
          'KB | Total duration:',
          Math.round(totalDuration),
          'ms'
        );
      }, 100);
    });
  }

  // ─── Init on DOM ready ────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    initLazyImages();
    initLazySections();
    recordPerformanceMetrics();
  }
})();
