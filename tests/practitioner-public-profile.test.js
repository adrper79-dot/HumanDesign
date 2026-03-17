import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onRequestGet } from '../frontend/functions/practitioners/[slug].js';

describe('practitioner public profile page', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the referral-chart funnel and direct booking CTA for a valid practitioner', async () => {
    global.fetch.mockResolvedValueOnce(Response.json({
      practitioner: {
        display_name: 'Avery Guide',
        bio: 'Relationship-centered Energy Blueprint practitioner.',
        booking_url: 'https://cal.example.com/avery',
        certification: 'IHDS',
        specializations: ['Relationships', 'Projectors'],
      },
    }));

    const response = await onRequestGet({
      params: { slug: 'avery-guide' },
      request: new Request('https://prime-self.test/practitioners/avery-guide'),
    });

    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('Avery Guide');
    expect(html).toContain('https://prime-self.test/practitioners/avery-guide');
    expect(html).toContain('https://prime-self.test/?ref=avery-guide');
    expect(html).toContain('https://cal.example.com/avery');
    expect(html).toContain('Calculate My Free Chart');
    expect(html).toContain('Book a session directly');
  });

  it('redirects invalid slugs to the homepage without calling the directory API', async () => {
    const response = await onRequestGet({
      params: { slug: '../bad-slug' },
      request: new Request('https://prime-self.test/practitioners/../bad-slug'),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://prime-self.test/');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});