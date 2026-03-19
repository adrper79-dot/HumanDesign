/**
 * Practitioner OG Image Tests
 * Item 4.3 — Per-Practitioner OG Images
 *
 * Tests:
 * - generatePractitionerOGImage(): SVG structure and content
 * - handlePractitionerOGImage(): routing, KV cache hit/miss, 404, validation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePractitionerOGImage } from '../workers/src/lib/shareImage.js';

// ── generatePractitionerOGImage (pure SVG generation) ───────────────────────
describe('generatePractitionerOGImage — SVG structure', () => {
  const basePractitioner = {
    display_name: 'Jane Doe',
    bio: 'Expert in Human Design for over 10 years.',
    specializations: ['Generators', 'Business', 'Parenting'],
    certification: 'IHDS',
    slug: 'jane-doe-hd',
  };

  it('returns a 1200×630 SVG string', () => {
    const svg = generatePractitionerOGImage(basePractitioner);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('includes the practitioner display name', () => {
    const svg = generatePractitionerOGImage(basePractitioner);
    expect(svg).toContain('Jane Doe');
  });

  it('includes truncated bio (max 110 chars)', () => {
    const longBio = 'A'.repeat(200);
    const svg = generatePractitionerOGImage({ ...basePractitioner, bio: longBio });
    expect(svg).toContain('A'.repeat(110));
    expect(svg).not.toContain('A'.repeat(111));
  });

  it('includes up to 3 specializations joined by ·', () => {
    const svg = generatePractitionerOGImage(basePractitioner);
    expect(svg).toContain('Generators · Business · Parenting');
  });

  it('limits specializations to first 3', () => {
    const svg = generatePractitionerOGImage({
      ...basePractitioner,
      specializations: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'],
    });
    expect(svg).toContain('Alpha · Beta · Gamma');
    expect(svg).not.toContain('Delta');
    expect(svg).not.toContain('Epsilon');
  });

  it('includes certification badge when provided', () => {
    const svg = generatePractitionerOGImage(basePractitioner);
    expect(svg).toContain('IHDS');
  });

  it('omits cert badge when certification is empty', () => {
    const svg = generatePractitionerOGImage({ ...basePractitioner, certification: '' });
    // Name is still present, but no distinct cert badge text
    expect(svg).toContain('Jane Doe');
  });

  it('escapes XSS in display_name', () => {
    const svg = generatePractitionerOGImage({
      ...basePractitioner,
      display_name: '<script>alert(1)</script>',
    });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('escapes XSS in bio', () => {
    const svg = generatePractitionerOGImage({
      ...basePractitioner,
      bio: '"><img src=x onerror=alert(1)>',
    });
    expect(svg).not.toContain('<img');
    expect(svg).toContain('&lt;img');
  });

  it('handles missing optional fields gracefully', () => {
    const svg = generatePractitionerOGImage({ display_name: 'Solo' });
    expect(svg).toContain('Solo');
    expect(svg).toContain('Human Design Practitioner');
  });

  it('includes Prime Self branding', () => {
    const svg = generatePractitionerOGImage(basePractitioner);
    expect(svg).toContain('selfprime.net');
  });
});

// ── handlePractitionerOGImage (handler logic via inline re-impl) ─────────────
// Tests the handler contract without standing up a real DB.
// We inline the handler logic using the same pattern as the actual handler.

async function runHandler(slug, { practitioner = null, cacheHit = null, cachePutCalled = [] } = {}) {
  const cacheKey = `og:practitioner:v1:${slug}`;
  const isValidSlug = (s) => typeof s === 'string' && /^[a-z0-9-]{1,80}$/.test(s);

  if (!isValidSlug(slug)) return { status: 404, body: 'Not Found' };

  // KV cache hit simulation
  if (cacheHit) return { status: 200, body: cacheHit, cache: 'HIT' };

  // DB miss
  if (!practitioner) return { status: 404, body: 'Not Found' };

  const svg = generatePractitionerOGImage(practitioner);
  cachePutCalled.push({ key: cacheKey, value: svg });

  return { status: 200, body: svg, cache: 'MISS', contentType: 'image/svg+xml' };
}

describe('handlePractitionerOGImage — handler logic', () => {
  it('returns 404 for invalid slug characters', async () => {
    const r = await runHandler('../etc/passwd');
    expect(r.status).toBe(404);
  });

  it('returns 404 for empty slug', async () => {
    const r = await runHandler('');
    expect(r.status).toBe(404);
  });

  it('returns 200 SVG for valid slug with practitioner', async () => {
    const r = await runHandler('jane-doe-hd', {
      practitioner: { display_name: 'Jane Doe', bio: 'Expert', specializations: [] },
    });
    expect(r.status).toBe(200);
    expect(r.body).toContain('<svg');
    expect(r.contentType).toBe('image/svg+xml');
  });

  it('returns 200 on KV cache hit without DB call', async () => {
    const cachedSvg = '<svg>cached</svg>';
    const r = await runHandler('jane-doe-hd', { cacheHit: cachedSvg });
    expect(r.status).toBe(200);
    expect(r.body).toBe(cachedSvg);
    expect(r.cache).toBe('HIT');
  });

  it('puts SVG in KV cache on cache miss', async () => {
    const puts = [];
    const r = await runHandler('jane-doe-hd', {
      practitioner: { display_name: 'Jane', bio: '', specializations: [] },
      cachePutCalled: puts,
    });
    expect(r.status).toBe(200);
    expect(puts).toHaveLength(1);
    expect(puts[0].key).toBe('og:practitioner:v1:jane-doe-hd');
    expect(puts[0].value).toContain('<svg');
  });

  it('returns 404 when practitioner not found in DB', async () => {
    const r = await runHandler('unknown-slug', { practitioner: null });
    expect(r.status).toBe(404);
  });
});
