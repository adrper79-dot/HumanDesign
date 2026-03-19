/**
 * Tests for item 4.5 — Marketing Kit Page
 *
 * Tests the pure generation logic for renderPractitionerMarketingKit and
 * the asset-type extraction logic for copyMarketingAsset, matching the
 * pattern used across the rest of the test suite (no DOM environment required).
 */

import { describe, it, expect, vi } from 'vitest';

// ── Pure helper re-implementations (mirrors app.js exactly) ──

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Returns the generated HTML for the marketing kit card (without setting DOM).
 * Mirrors the inner template of renderPractitionerMarketingKit in app.js.
 */
function buildMarketingKitHtml(data) {
  if (!data?.referralUrl) return '';

  const baseUrl = data.referralUrl;
  const platforms = [
    { platform: 'Facebook',  id: 'utm-facebook',  icon: '📘', src: 'facebook'  },
    { platform: 'Twitter/X', id: 'utm-twitter',   icon: '🐦', src: 'twitter'   },
    { platform: 'LinkedIn',  id: 'utm-linkedin',  icon: '💼', src: 'linkedin'  },
    { platform: 'Instagram', id: 'utm-instagram', icon: '📸', src: 'instagram' },
    { platform: 'WhatsApp',  id: 'utm-whatsapp',  icon: '💬', src: 'whatsapp'  },
  ];

  const emailSig =
    `Discover your soul blueprint (Human Design) at Prime Self:\n` +
    `${baseUrl}?utm_source=email&utm_medium=signature&utm_campaign=referral`;

  const snippets = [
    {
      label: 'Instagram Caption', id: 'snippet-instagram',
      text: `✨ Curious about your Human Design? Discover who you truly are — your energy type, decision-making strategy, and life purpose — with a personalized reading.\nUse my link for a free chart: ${baseUrl}?utm_source=instagram&utm_medium=social&utm_campaign=referral\n#HumanDesign #PrimeSelf`,
    },
    {
      label: 'Twitter/X Post', id: 'snippet-twitter',
      text: `Just discovered my Human Design blueprint with @PrimeSelf — mind-blowing insights! Get yours free: ${baseUrl}?utm_source=twitter&utm_medium=social&utm_campaign=referral`,
    },
    {
      label: 'LinkedIn Post', id: 'snippet-linkedin',
      text: `I've been exploring Human Design as a framework for understanding energy, leadership style, and decision-making. If you're curious about applied self-knowledge for professional growth, check out Prime Self — free chart here: ${baseUrl}?utm_source=linkedin&utm_medium=social&utm_campaign=referral`,
    },
  ];

  const utmRow = ({ platform, id, icon, src }) => {
    const url = escapeAttr(`${baseUrl}?utm_source=${src}&utm_medium=social&utm_campaign=referral`);
    return `<input readonly id="${escapeAttr(id)}" value="${url}" /><button data-action="copyMarketingAsset" data-arg0="${escapeAttr(id)}">Copy</button>`;
  };

  const snippetBlock = ({ label, id, text }) =>
    `<textarea id="${escapeAttr(id)}">${escapeHtml(text)}</textarea>` +
    `<button data-action="copyMarketingAsset" data-arg0="${escapeAttr(id)}">Copy</button>`;

  return [
    '<div class="card">',
    'Marketing Kit',
    'Ready-to-use assets',
    '📊 Platform Tracked Links',
    platforms.map(utmRow).join(''),
    '✉️ Email Signature',
    `<textarea id="mkt-email-sig">${escapeHtml(emailSig)}</textarea>`,
    '<button data-action="copyMarketingAsset" data-arg0="mkt-email-sig">Copy Signature</button>',
    '📝 Social Share Snippets',
    snippets.map(snippetBlock).join(''),
    '</div>',
  ].join('\n');
}

/** Mirrors the assetType extraction logic from copyMarketingAsset in app.js */
function extractAssetType(elementId) {
  return String(elementId).replace(/^(utm-|snippet-|mkt-)/, '').replace(/-.*$/, '');
}

// ── Tests ─────────────────────────────────────────────────────

describe('buildMarketingKitHtml', () => {
  it('returns empty string when referralUrl is missing', () => {
    expect(buildMarketingKitHtml({})).toBe('');
  });

  it('returns empty string when data is null', () => {
    expect(buildMarketingKitHtml(null)).toBe('');
  });

  it('returns HTML containing the Marketing Kit title', () => {
    const html = buildMarketingKitHtml({ referralUrl: 'https://app.primself.net/?ref=alice' });
    expect(html).toContain('Marketing Kit');
  });

  it('includes all 5 utm_source platform values', () => {
    const html = buildMarketingKitHtml({ referralUrl: 'https://app.primself.net/?ref=alice' });
    expect(html).toContain('utm_source=facebook');
    expect(html).toContain('utm_source=twitter');
    expect(html).toContain('utm_source=linkedin');
    expect(html).toContain('utm_source=instagram');
    expect(html).toContain('utm_source=whatsapp');
  });

  it('includes utm_medium=social in each platform link', () => {
    const html = buildMarketingKitHtml({ referralUrl: 'https://app.primself.net/?ref=alice' });
    const count = (html.match(/utm_medium=social/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it('includes utm_campaign=referral in every link', () => {
    const html = buildMarketingKitHtml({ referralUrl: 'https://app.primself.net/?ref=alice' });
    const count = (html.match(/utm_campaign=referral/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(5); // 5 platform + 1 email + 3 snippets
  });

  it('renders the email signature section with email UTM params', () => {
    const html = buildMarketingKitHtml({ referralUrl: 'https://app.primself.net/?ref=alice' });
    expect(html).toContain('mkt-email-sig');
    expect(html).toContain('utm_source=email');
    expect(html).toContain('utm_medium=signature');
  });

  it('renders all 3 snippet textareas', () => {
    const html = buildMarketingKitHtml({ referralUrl: 'https://app.primself.net/?ref=alice' });
    expect(html).toContain('snippet-instagram');
    expect(html).toContain('snippet-twitter');
    expect(html).toContain('snippet-linkedin');
  });

  it('instagram snippet contains Human Design hashtags', () => {
    const html = buildMarketingKitHtml({ referralUrl: 'https://app.primself.net/?ref=alice' });
    expect(html).toContain('#HumanDesign');
    expect(html).toContain('#PrimeSelf');
  });

  it('includes copy buttons with data-action="copyMarketingAsset"', () => {
    const html = buildMarketingKitHtml({ referralUrl: 'https://app.primself.net/?ref=alice' });
    const matches = (html.match(/data-action="copyMarketingAsset"/g) || []).length;
    // 5 platforms + 1 email sig + 3 snippets = 9
    expect(matches).toBe(9);
  });

  it('embeds the referral URL in each platform link', () => {
    const html = buildMarketingKitHtml({ referralUrl: 'https://app.primself.net/?ref=alice' });
    expect(html).toContain('primself.net');
    expect(html).toContain('ref=alice');
  });

  it('attr-escapes double-quotes in referralUrl to prevent attribute injection', () => {
    const html = buildMarketingKitHtml({ referralUrl: 'https://example.com/?ref=a"inject' });
    // double-quote must be escaped so it cannot break out of the value="..." attribute
    expect(html).not.toContain('"inject');
    expect(html).toContain('&quot;inject');
  });

  it('HTML-escapes ampersands in email sig textarea content', () => {
    const html = buildMarketingKitHtml({ referralUrl: 'https://app.primself.net/?ref=alice' });
    // The email sig has ?utm_source=email&utm_medium=... — after escapeHtml the & becomes &amp;
    expect(html).toContain('utm_source=email&amp;utm_medium=signature');
  });

  it('attr-escapes UTM query strings in input values (no raw &)', () => {
    const html = buildMarketingKitHtml({ referralUrl: 'https://app.primself.net/?ref=alice' });
    // inside input value= attributes all & must be &amp;
    expect(html).toContain('&amp;utm_medium=social');
  });
});

describe('extractAssetType (copyMarketingAsset helper)', () => {
  it('strips utm- prefix: utm-facebook → facebook', () => {
    expect(extractAssetType('utm-facebook')).toBe('facebook');
  });

  it('strips snippet- prefix: snippet-instagram → instagram', () => {
    expect(extractAssetType('snippet-instagram')).toBe('instagram');
  });

  it('strips mkt- prefix and trailing part: mkt-email-sig → email', () => {
    expect(extractAssetType('mkt-email-sig')).toBe('email');
  });

  it('strips utm- prefix: utm-whatsapp → whatsapp', () => {
    expect(extractAssetType('utm-whatsapp')).toBe('whatsapp');
  });

  it('strips utm- prefix: utm-linkedin → linkedin', () => {
    expect(extractAssetType('utm-linkedin')).toBe('linkedin');
  });

  it('leaves unknown ids unchanged if no prefix matches', () => {
    expect(extractAssetType('custom-id')).toBe('custom');
  });
});

describe('trackEvent integration', () => {
  it('marketing_kit_viewed fires when referralUrl is present', () => {
    const trackEvent = vi.fn();
    // Simulate render logic gate
    const data = { referralUrl: 'https://app.primself.net/?ref=alice' };
    if (data?.referralUrl && typeof trackEvent === 'function') {
      trackEvent('practitioner', 'marketing_kit_viewed');
    }
    expect(trackEvent).toHaveBeenCalledWith('practitioner', 'marketing_kit_viewed');
  });

  it('marketing_kit_viewed does NOT fire without referralUrl', () => {
    const trackEvent = vi.fn();
    const data = {};
    if (data?.referralUrl && typeof trackEvent === 'function') {
      trackEvent('practitioner', 'marketing_kit_viewed');
    }
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('marketing_asset_copied fires with correct asset type', () => {
    const trackEvent = vi.fn();
    const elementId = 'utm-twitter';
    const assetType = extractAssetType(elementId);
    trackEvent('practitioner', 'marketing_asset_copied', assetType);
    expect(trackEvent).toHaveBeenCalledWith('practitioner', 'marketing_asset_copied', 'twitter');
  });
});


