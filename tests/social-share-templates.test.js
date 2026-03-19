/**
 * Social Share Platform Templates Tests
 * Item 4.4 — New share card templates + UTM tracking
 *
 * Tests:
 * - buildShareUrl(): UTM parameter generation
 * - generateTransitWeatherImage()
 * - generateSessionSummaryImage()
 * - generateReadingSummaryImage()
 * - generateCompatibilityImage()
 * - generateGiftImage()
 */
import { describe, it, expect } from 'vitest';
import {
  buildShareUrl,
  generateTransitWeatherImage,
  generateSessionSummaryImage,
  generateReadingSummaryImage,
  generateCompatibilityImage,
  generateGiftImage,
} from '../workers/src/lib/shareImage.js';

// ── buildShareUrl ────────────────────────────────────────────────────────────
describe('buildShareUrl — UTM tracking', () => {
  it('appends utm_source, utm_medium, utm_campaign', () => {
    const url = buildShareUrl('https://selfprime.net', 'twitter', 'chart_share');
    expect(url).toContain('utm_source=twitter');
    expect(url).toContain('utm_medium=social');
    expect(url).toContain('utm_campaign=chart_share');
  });

  it('uses ? separator on clean base URL', () => {
    const url = buildShareUrl('https://selfprime.net', 'facebook', 'referral');
    expect(url).toMatch(/selfprime\.net\?/);
  });

  it('uses & separator when base URL already has query params', () => {
    const url = buildShareUrl('https://selfprime.net?ref=abc', 'linkedin', 'invite');
    expect(url).toContain('ref=abc&utm_source=linkedin');
  });

  it('appends path when provided', () => {
    const url = buildShareUrl('https://selfprime.net', 'whatsapp', 'reading_share', '/readings/123');
    expect(url).toContain('/readings/123');
    expect(url).toContain('utm_source=whatsapp');
  });

  it('encodes special characters in utm params', () => {
    const url = buildShareUrl('https://selfprime.net', 'my source', 'my campaign');
    expect(url).toContain('utm_source=my%20source');
    expect(url).toContain('utm_campaign=my%20campaign');
  });
});

// ── generateTransitWeatherImage ───────────────────────────────────────────────
describe('generateTransitWeatherImage', () => {
  it('returns a 1200×630 SVG with transit data', () => {
    const svg = generateTransitWeatherImage({ date: 'Mar 20, 2026', sunGate: 17, moonGate: 19, dominant: 'Gate 17: Opinions', theme: 'Logic & Correction' });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain('Gate 17: Opinions');
    expect(svg).toContain('Logic &amp; Correction');
    expect(svg).toContain('TRANSIT WEATHER');
  });

  it('includes Sun and Moon gates', () => {
    const svg = generateTransitWeatherImage({ sunGate: 22, moonGate: 47 });
    expect(svg).toContain('Gate 22');
    expect(svg).toContain('Gate 47');
  });

  it('escapes XSS in theme field', () => {
    const svg = generateTransitWeatherImage({ theme: '<script>alert(1)</script>' });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('handles missing data gracefully', () => {
    const svg = generateTransitWeatherImage({});
    expect(svg).toContain('<svg');
    expect(svg).toContain('TRANSIT WEATHER');
  });
});

// ── generateSessionSummaryImage ────────────────────────────────────────────────
describe('generateSessionSummaryImage', () => {
  it('returns 1200×630 SVG with practitioner name and themes', () => {
    const svg = generateSessionSummaryImage({
      practitionerName: 'Jane Doe',
      sessionDate: 'Mar 18, 2026',
      themes: ['Authority', 'Profile', 'Strategy'],
      insight: 'Trust your Sacral response.',
    });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('Jane Doe');
    expect(svg).toContain('Authority · Profile · Strategy');
    expect(svg).toContain('Trust your Sacral response.');
    expect(svg).toContain('SESSION SUMMARY');
  });

  it('limits themes to first 3', () => {
    const svg = generateSessionSummaryImage({ themes: ['A', 'B', 'C', 'D', 'E'] });
    expect(svg).toContain('A · B · C');
    expect(svg).not.toContain('D · E');
  });

  it('escapes XSS in practitionerName', () => {
    const svg = generateSessionSummaryImage({ practitionerName: '"><img src=x>' });
    expect(svg).not.toContain('<img');
    expect(svg).toContain('&lt;img');
  });
});

// ── generateReadingSummaryImage ────────────────────────────────────────────────
describe('generateReadingSummaryImage', () => {
  it('returns 1200×630 SVG with reading info', () => {
    const svg = generateReadingSummaryImage({ readingType: 'Annual Reading', keyTheme: 'New Chapter', guidance: 'Follow your authority.' });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('Annual Reading');
    expect(svg).toContain('New Chapter');
    expect(svg).toContain('READING SUMMARY');
  });

  it('truncates guidance to 110 chars', () => {
    const svg = generateReadingSummaryImage({ guidance: 'X'.repeat(200) });
    expect(svg).toContain('X'.repeat(110));
    expect(svg).not.toContain('X'.repeat(111));
  });

  it('escapes XSS in guidance', () => {
    const svg = generateReadingSummaryImage({ guidance: '<b>bold</b>' });
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;b&gt;');
  });
});

// ── generateCompatibilityImage ────────────────────────────────────────────────
describe('generateCompatibilityImage', () => {
  it('returns 1200×630 SVG with both names and score', () => {
    const svg = generateCompatibilityImage({
      person1: { name: 'Alice', type: 'Generator' },
      person2: { name: 'Bob', type: 'Projector' },
      score: 87,
      channels: ['23-43', '2-14'],
    });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('Alice');
    expect(svg).toContain('Bob');
    expect(svg).toContain('87%');
    expect(svg).toContain('23-43 · 2-14');
    expect(svg).toContain('COMPATIBILITY');
  });

  it('limits channels to first 4', () => {
    const svg = generateCompatibilityImage({ channels: ['1-2', '3-4', '5-6', '7-8', '9-10'] });
    expect(svg).not.toContain('9-10');
  });

  it('omits score block when score is not provided', () => {
    const svg = generateCompatibilityImage({ person1: { name: 'Alice' }, person2: { name: 'Bob' } });
    // When no score, the conditional block is absent so there's no score% text element
    expect(svg).not.toMatch(/font-size="80".*%/);
  });

  it('escapes XSS in person names', () => {
    const svg = generateCompatibilityImage({
      person1: { name: '<script>xss</script>' },
      person2: { name: 'Bob' },
    });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });
});

// ── generateGiftImage ─────────────────────────────────────────────────────────
describe('generateGiftImage', () => {
  it('returns 1200×630 SVG with gift details', () => {
    const svg = generateGiftImage({
      recipientName: 'Sarah',
      gifterName: 'Michael',
      plan: 'Prime Self Pro',
      message: 'Happy Birthday! 🎂',
    });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('Sarah');
    expect(svg).toContain('Michael');
    expect(svg).toContain('Prime Self Pro');
    expect(svg).toContain('GIFT');
  });

  it('truncates message to 100 chars', () => {
    const svg = generateGiftImage({ recipientName: 'A', message: 'M'.repeat(150) });
    expect(svg).toContain('M'.repeat(100));
    expect(svg).not.toContain('M'.repeat(101));
  });

  it('handles missing optional fields gracefully', () => {
    const svg = generateGiftImage({});
    expect(svg).toContain('Someone Special');
    expect(svg).toContain('Prime Self');
  });
});
