import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createQueryFnMock, getTierMock } = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
  getTierMock: vi.fn(),
}));

vi.mock('../workers/src/db/queries.js', async () => {
  const actual = await vi.importActual('../workers/src/db/queries.js');
  return {
    ...actual,
    createQueryFn: createQueryFnMock,
  };
});

vi.mock('../workers/src/lib/stripe.js', async () => {
  const actual = await vi.importActual('../workers/src/lib/stripe.js');
  return {
    ...actual,
    getTier: getTierMock,
  };
});

import { enforceDailyCeiling } from '../workers/src/middleware/tierEnforcement.js';
import { QUERIES } from '../workers/src/db/queries.js';

describe('daily ceiling — DB-backed atomic counter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTierMock.mockReturnValue({
      features: {
        dailySynthesisLimit: 2,
        dailyQuestionLimit: 5,
      },
    });
  });

  it('returns null when the incremented count stays within the daily limit', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ count: 1, window_end: new Date().toISOString() }] });
    createQueryFnMock.mockReturnValue(query);

    const request = new Request('https://api.test/api/profile/generate', { method: 'POST' });
    request._user = { sub: 'user-1' };
    request._tier = 'individual';

    const result = await enforceDailyCeiling(request, { NEON_CONNECTION_STRING: 'postgresql://test' }, 'synthesis');

    expect(result).toBeNull();
    expect(query).toHaveBeenCalledWith(
      QUERIES.atomicWindowCounterIncrement,
      [
        expect.stringContaining('daily:user-1:'),
        expect.any(String),
        expect.any(String),
      ]
    );
  });

  it('returns 429 when the incremented count exceeds the daily limit', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ count: 3, window_end: new Date().toISOString() }] });
    createQueryFnMock.mockReturnValue(query);

    const request = new Request('https://api.test/api/profile/generate', { method: 'POST' });
    request._user = { sub: 'user-1' };
    request._tier = 'individual';

    const result = await enforceDailyCeiling(request, { NEON_CONNECTION_STRING: 'postgresql://test' }, 'synthesis');

    expect(result).not.toBeNull();
    expect(result.status).toBe(429);
  });
});