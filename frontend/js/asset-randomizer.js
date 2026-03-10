/**
 * asset-randomizer.js
 * 
 * Randomly selects between v1 and v2 logo/branding variants per session.
 * Stores the choice in sessionStorage so the user sees a consistent 
 * experience within one visit but gets variety across visits.
 *
 * Usage: loaded inline in <head> — runs before DOM render.
 *
 * Randomizes:
 *  - Favicon
 *  - Apple touch icon
 *  - Apple splash screens
 *  - OG/Twitter images (for dynamic meta — optional server-side)
 *  - Logo video/poster elements (applied after DOM ready)
 *  - Email header, embed logo references in JS
 */

(function () {
  'use strict';

  // ── Pick variant (sticky per session) ──────────────────────
  let variant;
  try {
    variant = sessionStorage.getItem('ps-brand-variant');
    if (!variant) {
      variant = Math.random() < 0.5 ? 'v1' : 'v2';
      sessionStorage.setItem('ps-brand-variant', variant);
    }
  } catch (e) {
    // sessionStorage unavailable (private browsing in some browsers)
    // Fall back to consistent v1 for the session without storage
    variant = variant || 'v1';
  }

  // Expose globally for other scripts to reference
  window.__PS_VARIANT = variant;

  const suffix = variant === 'v2' ? '-v2' : '';

  // ── Helper: update <link> href by selector ─────────────────
  function updateLink(selector, newHref) {
    const el = document.querySelector(selector);
    if (el) el.href = newHref;
  }

  // ── Helper: update all matching <link> elements ────────────
  function updateAllLinks(selector, hrefTransform) {
    document.querySelectorAll(selector).forEach(el => {
      el.href = hrefTransform(el.href);
    });
  }

  // ── Suffix injector: /icons/foo.png → /icons/foo-v2.png ───
  function addSuffix(href) {
    if (variant === 'v1') return href; // v1 files have no suffix
    return href.replace(/(\.[^.]+)$/, `${suffix}$1`);
  }

  // ── Favicons ───────────────────────────────────────────────
  updateLink('link[rel="icon"][sizes="32x32"]', `/icons/favicon-32${suffix}.png`);
  updateLink('link[rel="icon"][sizes="16x16"]', `/icons/favicon-16${suffix}.png`);
  // SVG favicon stays the same (only one version)

  // ── Apple Touch Icons ──────────────────────────────────────
  document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(el => {
    el.href = addSuffix(el.href);
  });

  // ── Apple Splash Screens ───────────────────────────────────
  document.querySelectorAll('link[rel="apple-touch-startup-image"]').forEach(el => {
    el.href = addSuffix(el.href);
  });

  // ── MS Tile ────────────────────────────────────────────────
  const msTile = document.querySelector('meta[name="msapplication-TileImage"]');
  if (msTile) msTile.content = `/icons/icon-144${suffix}.png`;

  // ── After DOM ready: randomize video/poster/logo elements ──
  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  onReady(function () {
    // ── Logo animation videos ──
    document.querySelectorAll('video[data-logo-video]').forEach(video => {
      // Update <source> children
      video.querySelectorAll('source').forEach(src => {
        src.src = addSuffix(src.src);
      });
      // Update poster
      if (video.poster) video.poster = addSuffix(video.poster);
      // Reload
      video.load();
    });

    // ── Logo poster images ──
    document.querySelectorAll('img[data-logo-poster]').forEach(img => {
      img.src = addSuffix(img.src);
    });

    // ── Any element with data-randomize-src ──
    document.querySelectorAll('[data-randomize-src]').forEach(el => {
      const attr = el.tagName === 'IMG' || el.tagName === 'VIDEO' ? 'src' : 'href';
      if (el[attr]) el[attr] = addSuffix(el[attr]);
    });

    // ── Log variant for analytics ──
    if (window.console) {
      window.DEBUG && console.log(`[Prime Self] Brand variant: ${variant}`);
    }
  });
})();
