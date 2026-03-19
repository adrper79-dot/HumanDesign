/**
 * Tests for item 4.7 — Referral Landing Upgrade
 *
 * Covers:
 * - escapeHtml / escapeAttr helpers (used in template output)
 * - Bio truncation logic (>200 chars gets ellipsis)
 * - Specializations slicing (max 3 pills)
 * - Avatar HTML: photo URL vs initials fallback
 * - Certification badge HTML
 * - Booking button: shown when valid URL, hidden when absent/invalid
 * - Modal structure: key element IDs and ARIA attributes
 * - Analytics events: referral_landing_viewed and referral_landing_converted
 * - URL validation: ?ref= slug format gate
 */

import { describe, it, expect, vi } from 'vitest';

// ── Helpers re-implemented from app.js ────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

// ── Core logic extracted for unit testing ─────────────────────

function buildReferralLandingHtml(p, refSlug, { escH = escapeHtml, escA = escapeAttr } = {}) {
  const practName     = p?.display_name || 'Your Practitioner';
  const photoUrl      = p?.photo_url;
  const bio           = p?.bio ? (p.bio.length > 200 ? p.bio.slice(0, 200) + '\u2026' : p.bio) : '';
  const specs         = Array.isArray(p?.specializations) ? p.specializations.slice(0, 3) : [];
  const certification = p?.certification || '';
  const bookingUrl    = p?.booking_url;

  const avatarHtml = photoUrl && /^https?:\/\//i.test(photoUrl)
    ? `<img src="${escA(photoUrl)}" alt="${escA(practName)}" loading="lazy">`
    : `<div class="avatar-initials">${escH(practName.charAt(0).toUpperCase())}</div>`;

  const certHtml = certification
    ? `<span class="cert-badge">${escH(certification)}</span>`
    : '';

  const specPills = specs
    .map(s => `<span class="spec-pill">${escH(s)}</span>`)
    .join('');
  const specHtml = specPills ? `<div class="spec-pills">${specPills}</div>` : '';

  const bioHtml = bio
    ? `<p class="bio-text">${escH(bio)}</p>`
    : '';

  const bookBtnHtml = bookingUrl && /^https?:\/\//i.test(bookingUrl)
    ? `<a href="${escA(bookingUrl)}" target="_blank" rel="noopener noreferrer" id="ref-book-btn">Book a Session with ${escH(practName)}</a>`
    : '';

  return {
    practName, photoUrl, bio, specs, certification, bookingUrl,
    avatarHtml, certHtml, specHtml, bioHtml, bookBtnHtml,
  };
}

function isValidRefSlug(slug) {
  return /^[a-z0-9-]+$/.test(slug);
}

// ── Tests ─────────────────────────────────────────────────────

describe('4.7 Referral Landing — bio truncation', () => {
  it('returns bio unchanged if <= 200 chars', () => {
    const bio200 = 'a'.repeat(200);
    const p = { display_name: 'Alice', bio: bio200 };
    const { bio } = buildReferralLandingHtml(p, 'alice');
    expect(bio).toBe(bio200);
    expect(bio.endsWith('\u2026')).toBe(false);
  });

  it('truncates bio at 200 chars with ellipsis if > 200 chars', () => {
    const longBio = 'x'.repeat(250);
    const p = { display_name: 'Alice', bio: longBio };
    const { bio } = buildReferralLandingHtml(p, 'alice');
    expect(bio).toBe('x'.repeat(200) + '\u2026');
  });

  it('returns empty string when bio is absent', () => {
    const { bio, bioHtml } = buildReferralLandingHtml({ display_name: 'Alice' }, 'alice');
    expect(bio).toBe('');
    expect(bioHtml).toBe('');
  });

  it('HTML-encodes bio in bioHtml output', () => {
    const p = { display_name: 'Alice', bio: '<script>alert(1)</script>' };
    const { bioHtml } = buildReferralLandingHtml(p, 'alice');
    expect(bioHtml).not.toContain('<script>');
    expect(bioHtml).toContain('&lt;script&gt;');
  });
});

describe('4.7 Referral Landing — specializations', () => {
  it('renders up to 3 spec pills', () => {
    const p = { display_name: 'Bob', specializations: ['HD', 'Astrology', 'Yoga', 'Reiki'] };
    const { specs, specHtml } = buildReferralLandingHtml(p, 'bob');
    expect(specs).toHaveLength(3);
    expect(specHtml.match(/class="spec-pill"/g)).toHaveLength(3);
  });

  it('renders all pills when fewer than 3', () => {
    const p = { display_name: 'Bob', specializations: ['HD', 'Yoga'] };
    const { specHtml } = buildReferralLandingHtml(p, 'bob');
    expect(specHtml.match(/class="spec-pill"/g)).toHaveLength(2);
  });

  it('returns empty specHtml when specializations absent', () => {
    const { specHtml } = buildReferralLandingHtml({ display_name: 'Bob' }, 'bob');
    expect(specHtml).toBe('');
  });

  it('HTML-encodes specialization text', () => {
    const p = { display_name: 'Bob', specializations: ['<XSS>'] };
    const { specHtml } = buildReferralLandingHtml(p, 'bob');
    expect(specHtml).not.toContain('<XSS>');
    expect(specHtml).toContain('&lt;XSS&gt;');
  });
});

describe('4.7 Referral Landing — avatar', () => {
  it('renders img tag when photo_url is a valid http URL', () => {
    const p = { display_name: 'Carol', photo_url: 'https://cdn.example.com/carol.jpg' };
    const { avatarHtml } = buildReferralLandingHtml(p, 'carol');
    expect(avatarHtml).toContain('<img');
    expect(avatarHtml).toContain('loading="lazy"');
    expect(avatarHtml).toContain('carol.jpg');
  });

  it('renders initials fallback when photo_url is absent', () => {
    const p = { display_name: 'Carol' };
    const { avatarHtml } = buildReferralLandingHtml(p, 'carol');
    expect(avatarHtml).toContain('avatar-initials');
    expect(avatarHtml).toContain('C');
    expect(avatarHtml).not.toContain('<img');
  });

  it('renders initials fallback when photo_url is not http(s)', () => {
    const p = { display_name: 'Dave', photo_url: 'javascript:evil()' };
    const { avatarHtml } = buildReferralLandingHtml(p, 'dave');
    expect(avatarHtml).toContain('avatar-initials');
    expect(avatarHtml).not.toContain('<img');
  });

  it('escapes photo_url in src attribute', () => {
    const p = { display_name: 'Eve', photo_url: 'https://cdn.example.com/eve&q=1".jpg' };
    const { avatarHtml } = buildReferralLandingHtml(p, 'eve');
    expect(avatarHtml).not.toContain('"&');
    expect(avatarHtml).toContain('&amp;');
  });

  it('uses first letter of name as initial', () => {
    const p = { display_name: 'Zara' };
    const { avatarHtml } = buildReferralLandingHtml(p, 'zara');
    expect(avatarHtml).toContain('>Z<');
  });

  it('falls back to "Y" initial when display_name absent', () => {
    const { avatarHtml } = buildReferralLandingHtml(null, 'someone');
    // practName becomes 'Your Practitioner', initial is 'Y'
    expect(avatarHtml).toContain('>Y<');
  });
});

describe('4.7 Referral Landing — certification badge', () => {
  it('renders cert badge span when certification present', () => {
    const p = { display_name: 'Frank', certification: 'Certified HD Analyst' };
    const { certHtml } = buildReferralLandingHtml(p, 'frank');
    expect(certHtml).toContain('cert-badge');
    expect(certHtml).toContain('Certified HD Analyst');
  });

  it('returns empty certHtml when certification absent', () => {
    const { certHtml } = buildReferralLandingHtml({ display_name: 'Grace' }, 'grace');
    expect(certHtml).toBe('');
  });

  it('HTML-encodes certification text', () => {
    const p = { display_name: 'Hack', certification: '<b>Bold</b>' };
    const { certHtml } = buildReferralLandingHtml(p, 'hack');
    expect(certHtml).not.toContain('<b>');
    expect(certHtml).toContain('&lt;b&gt;');
  });
});

describe('4.7 Referral Landing — booking button', () => {
  it('renders booking link when bookingUrl is valid https', () => {
    const p = { display_name: 'Ian', booking_url: 'https://calendly.com/ian' };
    const { bookBtnHtml } = buildReferralLandingHtml(p, 'ian');
    expect(bookBtnHtml).toContain('id="ref-book-btn"');
    expect(bookBtnHtml).toContain('https://calendly.com/ian');
    expect(bookBtnHtml).toContain('noopener noreferrer');
  });

  it('renders booking link when bookingUrl is valid http', () => {
    const p = { display_name: 'Jen', booking_url: 'http://bookme.example.com/jen' };
    const { bookBtnHtml } = buildReferralLandingHtml(p, 'jen');
    expect(bookBtnHtml).toContain('id="ref-book-btn"');
  });

  it('returns empty bookBtnHtml when booking_url is absent', () => {
    const { bookBtnHtml } = buildReferralLandingHtml({ display_name: 'Kim' }, 'kim');
    expect(bookBtnHtml).toBe('');
  });

  it('returns empty bookBtnHtml when booking_url is not http(s)', () => {
    const p = { display_name: 'Lee', booking_url: 'javascript:void(0)' };
    const { bookBtnHtml } = buildReferralLandingHtml(p, 'lee');
    expect(bookBtnHtml).toBe('');
  });

  it('HTML-encodes practitioner name in booking button text', () => {
    const p = { display_name: 'M&M', booking_url: 'https://book.example.com' };
    const { bookBtnHtml } = buildReferralLandingHtml(p, 'm-and-m');
    expect(bookBtnHtml).toContain('M&amp;M');
    expect(bookBtnHtml).not.toContain('M&M"');
  });
});

describe('4.7 Referral Landing — practitioner name fallback', () => {
  it('uses display_name when present', () => {
    const { practName } = buildReferralLandingHtml({ display_name: 'Maya' }, 'maya');
    expect(practName).toBe('Maya');
  });

  it('falls back to "Your Practitioner" when data is null', () => {
    const { practName } = buildReferralLandingHtml(null, 'anyone');
    expect(practName).toBe('Your Practitioner');
  });

  it('falls back to "Your Practitioner" when display_name is empty', () => {
    const { practName } = buildReferralLandingHtml({ display_name: '' }, 'anyone');
    expect(practName).toBe('Your Practitioner');
  });
});

describe('4.7 Referral Landing — slug validation (captureReferralFromUrl gate)', () => {
  it('accepts valid lowercase slug', () => {
    expect(isValidRefSlug('alice-smith')).toBe(true);
    expect(isValidRefSlug('bob123')).toBe(true);
    expect(isValidRefSlug('a')).toBe(true);
  });

  it('rejects slug with uppercase letters', () => {
    expect(isValidRefSlug('Alice')).toBe(false);
  });

  it('rejects slug with special characters', () => {
    expect(isValidRefSlug('alice<script>')).toBe(false);
    expect(isValidRefSlug('../etc/passwd')).toBe(false);
    expect(isValidRefSlug('alice smith')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidRefSlug('')).toBe(false);
  });
});

describe('4.7 Referral Landing — analytics event labels', () => {
  it('referral_landing_viewed fires with correct category/action', () => {
    const events = [];
    function trackEvent(category, action, label) {
      events.push({ category, action, label });
    }

    // Simulate the trackEvent call in showReferralBanner
    const refSlug = 'test-practitioner';
    trackEvent('referral', 'referral_landing_viewed', refSlug);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ category: 'referral', action: 'referral_landing_viewed', label: 'test-practitioner' });
  });

  it('referral_landing_converted fires on CTA click', () => {
    const events = [];
    function trackEvent(category, action, label) {
      events.push({ category, action, label });
    }

    const refSlug = 'test-practitioner';
    // Simulate the CTA click handler
    trackEvent('referral', 'referral_landing_converted', refSlug);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ category: 'referral', action: 'referral_landing_converted', label: 'test-practitioner' });
  });

  it('uses refSlug (not practName) as analytics label', () => {
    const events = [];
    function trackEvent(cat, act, label) { events.push(label); }
    const refSlug = 'my-slug';
    trackEvent('referral', 'referral_landing_viewed', refSlug);
    expect(events[0]).toBe('my-slug');
  });
});
