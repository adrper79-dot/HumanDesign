/**
 * Practitioner Reviews Tests
 * Item 2.3 — Verified Testimonials/Reviews
 *
 * Tests review submission, approval, hiding, access control, and validation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueryFn = vi.fn();

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: () => mockQueryFn,
  QUERIES: {
    getPractitionerByUserId: 'getPractitionerByUserId',
    checkClientPractitionerAccess: 'checkClientPractitionerAccess',
    createReview: 'createReview',
    listApprovedReviews: 'listApprovedReviews',
    listPractitionerReviews: 'listPractitionerReviews',
    approveReview: 'approveReview',
    hideReview: 'hideReview'
  }
}));

vi.mock('../workers/src/lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  })
}));

const {
  handleSubmitReview,
  handleGetPublicReviews,
  handleListPractitionerReviews,
  handleApproveReview,
  handleHideReview
} = await import('../workers/src/handlers/reviews.js');

const PRAC = { id: 'prac-1', user_id: 'user-1', slug: 'dr-test' };
const env = { NEON_CONNECTION_STRING: 'postgres://test' };

function makeRequest(method, path, body, authed = true) {
  const url = `https://api.primeself.app${path}`;
  const opts = { method, headers: new Headers({ 'Content-Type': 'application/json' }) };
  if (body) opts.body = JSON.stringify(body);
  const req = new Request(url, opts);
  if (authed) req._user = { sub: 'user-1', id: 'user-1' };
  return req;
}

beforeEach(() => { vi.clearAllMocks(); });

describe('handleSubmitReview', () => {
  it('creates a review with valid input', async () => {
    const created = { id: 'rev-1', rating: 5, content: 'Amazing session!', status: 'pending' };
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'checkClientPractitionerAccess') return { rows: [{ 1: 1 }] };
      if (sql === 'createReview') return { rows: [created] };
      return { rows: [] };
    });

    const req = makeRequest('POST', '/api/client/reviews', {
      practitioner_id: 'prac-1',
      rating: 5,
      content: 'Amazing session!'
    });

    const res = await handleSubmitReview(req, env);
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.review.rating).toBe(5);
  });

  it('rejects missing practitioner_id', async () => {
    const req = makeRequest('POST', '/api/client/reviews', { rating: 5, content: 'Great session!' });
    const res = await handleSubmitReview(req, env);
    expect(res.status).toBe(400);
  });

  it('rejects invalid rating', async () => {
    const req = makeRequest('POST', '/api/client/reviews', {
      practitioner_id: 'prac-1', rating: 6, content: 'Great session!'
    });
    const res = await handleSubmitReview(req, env);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Rating');
  });

  it('rejects short content', async () => {
    const req = makeRequest('POST', '/api/client/reviews', {
      practitioner_id: 'prac-1', rating: 5, content: 'short'
    });
    const res = await handleSubmitReview(req, env);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('at least');
  });

  it('rejects content over max length', async () => {
    const req = makeRequest('POST', '/api/client/reviews', {
      practitioner_id: 'prac-1', rating: 5, content: 'x'.repeat(2001)
    });
    const res = await handleSubmitReview(req, env);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('exceeds');
  });

  it('rejects non-client', async () => {
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'checkClientPractitionerAccess') return { rows: [] };
      return { rows: [] };
    });
    const req = makeRequest('POST', '/api/client/reviews', {
      practitioner_id: 'prac-1', rating: 5, content: 'This is my review text.'
    });
    const res = await handleSubmitReview(req, env);
    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const req = makeRequest('POST', '/api/client/reviews', {
      practitioner_id: 'prac-1', rating: 5, content: 'This is a review'
    }, false);
    const res = await handleSubmitReview(req, env);
    expect(res.status).toBe(401);
  });
});

describe('handleGetPublicReviews', () => {
  it('returns approved reviews for a slug', async () => {
    const reviews = [{ id: 'r1', rating: 5, content: 'Great!', reviewer_name: 'Alice' }];
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'listApprovedReviews') return { rows: reviews };
      return { rows: [] };
    });
    const req = makeRequest('GET', '/api/directory/dr-test/reviews', null, false);
    const res = await handleGetPublicReviews(req, env, 'dr-test');
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.reviews)).toBe(true);
    expect(data.reviews.length).toBe(1);
  });

  it('rejects invalid slug', async () => {
    const req = makeRequest('GET', '/api/directory/INVALID_SLUG!/reviews', null, false);
    const res = await handleGetPublicReviews(req, env, 'INVALID_SLUG!');
    expect(res.status).toBe(400);
  });
});

describe('handleApproveReview', () => {
  it('approves a review', async () => {
    const approved = { id: 'rev-1', status: 'approved' };
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'approveReview') return { rows: [approved] };
      return { rows: [] };
    });
    const req = makeRequest('PUT', '/api/practitioner/reviews/rev-1/approve');
    const res = await handleApproveReview(req, env, 'rev-1');
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.review.status).toBe('approved');
  });

  it('returns 404 for missing review', async () => {
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'approveReview') return { rows: [] };
      return { rows: [] };
    });
    const req = makeRequest('PUT', '/api/practitioner/reviews/nonexist/approve');
    const res = await handleApproveReview(req, env, 'nonexist');
    expect(res.status).toBe(404);
  });
});

describe('handleHideReview', () => {
  it('hides a review', async () => {
    const hidden = { id: 'rev-1', status: 'hidden' };
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'hideReview') return { rows: [hidden] };
      return { rows: [] };
    });
    const req = makeRequest('PUT', '/api/practitioner/reviews/rev-1/hide');
    const res = await handleHideReview(req, env, 'rev-1');
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.review.status).toBe('hidden');
  });
});

describe('handleListPractitionerReviews', () => {
  it('lists all reviews for a practitioner', async () => {
    const reviews = [
      { id: 'r1', rating: 5, status: 'approved' },
      { id: 'r2', rating: 4, status: 'pending' }
    ];
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [PRAC] };
      if (sql === 'listPractitionerReviews') return { rows: reviews };
      return { rows: [] };
    });
    const req = makeRequest('GET', '/api/practitioner/reviews');
    const res = await handleListPractitionerReviews(req, env);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.reviews)).toBe(true);
    expect(data.reviews.length).toBe(2);
  });

  it('returns 403 for non-practitioner', async () => {
    mockQueryFn.mockImplementation((sql) => {
      if (sql === 'getPractitionerByUserId') return { rows: [] };
      return { rows: [] };
    });
    const req = makeRequest('GET', '/api/practitioner/reviews');
    const res = await handleListPractitionerReviews(req, env);
    expect(res.status).toBe(403);
  });
});
