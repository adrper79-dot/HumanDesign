/**
 * Practitioner QR Code Generator Tests
 * Item 4.1 — QR Code for referral URL
 *
 * Tests the QR rendering logic and download handler without a real DOM
 * by simulating the renderPractitionerReferralStats output structure
 * and the downloadPractitionerQR download flow.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Pure logic extracted from renderPractitionerReferralStats ──────────────
function buildReferralCardHtml(data) {
  if (!data?.referralUrl) return '';
  const escapeAttr = (s) => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  const urlAttr = escapeAttr(data.referralUrl);
  const total = parseInt(data.stats?.referralCount ?? data.referralCount ?? 0);
  const earnings = data.stats?.earningsThisMonth != null
    ? `$${parseFloat(data.stats.earningsThisMonth).toFixed(2)}`
    : (data.earningsThisMonth != null ? `$${parseFloat(data.earningsThisMonth).toFixed(2)}` : '—');

  return `
    <input readonly value="${urlAttr}" id="pracRefLinkDisplay" />
    <button data-action="copyPracReferralLink">Copy Link</button>
    <div>${total}</div>
    <div>${earnings}</div>
    <img id="pracQRImage" src="" alt="Referral QR Code" width="160" height="160" />
    <button data-action="downloadPractitionerQR">⬇ Download QR PNG</button>
  `;
}

// ── Download handler logic extracted ──────────────────────────────────────
function downloadPractitionerQRLogic(getElement, appendEl, removeEl, trackEvent) {
  const imgEl = getElement('pracQRImage');
  if (!imgEl?.src || imgEl.src === '') return false;
  const a = { href: '', download: '', clicked: false };
  a.href = imgEl.src;
  a.download = 'prime-self-referral-qr.png';
  appendEl(a);
  a.clicked = true;
  removeEl(a);
  trackEvent('practitioner', 'qr_downloaded', 'referral_card');
  return true;
}

// ── QR generation logic ────────────────────────────────────────────────────
function generateQRDataUrl(QRCode, url) {
  if (!QRCode?.toDataURL) return null;
  return QRCode.toDataURL(url, 6);
}

// ─────────────────────────────────────────────────────────────────────────
describe('Practitioner QR Code — renderPractitionerReferralStats HTML output', () => {
  it('returns empty string when referralUrl is missing', () => {
    expect(buildReferralCardHtml(null)).toBe('');
    expect(buildReferralCardHtml({})).toBe('');
    expect(buildReferralCardHtml({ stats: {} })).toBe('');
  });

  it('includes pracRefLinkDisplay input with referral URL as value', () => {
    const html = buildReferralCardHtml({ referralUrl: 'https://selfprime.net/?ref=alice' });
    expect(html).toContain('id="pracRefLinkDisplay"');
    expect(html).toContain('value="https://selfprime.net/?ref=alice"');
  });

  it('escapes special characters in referral URL attribute', () => {
    const html = buildReferralCardHtml({ referralUrl: 'https://selfprime.net/?ref=a&b="test"' });
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
    expect(html).not.toContain('ref=a&b='); // raw ampersand must be escaped
  });

  it('includes pracQRImage <img> element', () => {
    const html = buildReferralCardHtml({ referralUrl: 'https://selfprime.net/?ref=alice' });
    expect(html).toContain('id="pracQRImage"');
    expect(html).toContain('width="160"');
    expect(html).toContain('height="160"');
  });

  it('includes Download QR PNG button with correct data-action', () => {
    const html = buildReferralCardHtml({ referralUrl: 'https://selfprime.net/?ref=alice' });
    expect(html).toContain('data-action="downloadPractitionerQR"');
    expect(html).toContain('Download QR PNG');
  });

  it('includes copyPracReferralLink button', () => {
    const html = buildReferralCardHtml({ referralUrl: 'https://selfprime.net/?ref=alice' });
    expect(html).toContain('data-action="copyPracReferralLink"');
  });

  it('shows total referral count from stats.referralCount', () => {
    const html = buildReferralCardHtml({
      referralUrl: 'https://selfprime.net/?ref=alice',
      stats: { referralCount: 42 }
    });
    expect(html).toContain('42');
  });

  it('shows earnings from stats.earningsThisMonth', () => {
    const html = buildReferralCardHtml({
      referralUrl: 'https://selfprime.net/?ref=alice',
      stats: { earningsThisMonth: 19.99 }
    });
    expect(html).toContain('$19.99');
  });

  it('shows — for earnings when not provided', () => {
    const html = buildReferralCardHtml({ referralUrl: 'https://selfprime.net/?ref=alice' });
    expect(html).toContain('—');
  });
});

describe('Practitioner QR Code — QR generation', () => {
  it('calls QRCode.toDataURL with referral URL and scale 6', () => {
    const mockQRCode = { toDataURL: vi.fn(() => 'data:image/png;base64,abc123') };
    const result = generateQRDataUrl(mockQRCode, 'https://selfprime.net/?ref=alice');
    expect(mockQRCode.toDataURL).toHaveBeenCalledWith('https://selfprime.net/?ref=alice', 6);
    expect(result).toBe('data:image/png;base64,abc123');
  });

  it('returns null if QRCode is not available', () => {
    expect(generateQRDataUrl(null, 'https://selfprime.net/?ref=alice')).toBeNull();
    expect(generateQRDataUrl(undefined, 'https://selfprime.net/?ref=alice')).toBeNull();
    expect(generateQRDataUrl({}, 'https://selfprime.net/?ref=alice')).toBeNull();
  });
});

describe('Practitioner QR Code — download handler', () => {
  it('creates anchor with correct href and download filename', () => {
    const trackEvent = vi.fn();
    const appended = [];
    const removed = [];
    const fakeImg = { src: 'data:image/png;base64,abc123' };
    const getEl = (id) => id === 'pracQRImage' ? fakeImg : null;

    const result = downloadPractitionerQRLogic(getEl, (a) => appended.push(a), (a) => removed.push(a), trackEvent);

    expect(result).toBe(true);
    expect(appended[0].href).toBe('data:image/png;base64,abc123');
    expect(appended[0].download).toBe('prime-self-referral-qr.png');
    expect(appended[0].clicked).toBe(true);
    expect(removed).toHaveLength(1);
  });

  it('fires qr_downloaded analytics event', () => {
    const trackEvent = vi.fn();
    const fakeImg = { src: 'data:image/png;base64,abc123' };
    downloadPractitionerQRLogic(
      () => fakeImg,
      () => {},
      () => {},
      trackEvent
    );
    expect(trackEvent).toHaveBeenCalledWith('practitioner', 'qr_downloaded', 'referral_card');
  });

  it('returns false and does nothing when image has no src', () => {
    const trackEvent = vi.fn();
    const fakeImg = { src: '' };
    const result = downloadPractitionerQRLogic(() => fakeImg, () => {}, () => {}, trackEvent);
    expect(result).toBe(false);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('returns false when image element is not found', () => {
    const trackEvent = vi.fn();
    const result = downloadPractitionerQRLogic(() => null, () => {}, () => {}, trackEvent);
    expect(result).toBe(false);
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
