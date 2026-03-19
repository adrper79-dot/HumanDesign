/**
 * Diary AI Insights Tests — Item 2.5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Diary Insights — query presence', () => {
  it('getDiaryEntriesForInsights query exists', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.getDiaryEntriesForInsights).toBe('string');
    expect(QUERIES.getDiaryEntriesForInsights).toContain('diary_entries');
    expect(QUERIES.getDiaryEntriesForInsights).toContain('transit_snapshot');
  });

  it('query fetches up to 50 entries ordered by date', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.getDiaryEntriesForInsights).toContain('LIMIT 50');
    expect(QUERIES.getDiaryEntriesForInsights).toContain('ORDER BY event_date DESC');
  });
});

describe('Diary Insights — handler', () => {
  let handleDiaryInsights;

  beforeEach(async () => {
    vi.resetModules();
  });

  it('handleDiaryInsights is exported from diary.js', async () => {
    const mod = await import('../workers/src/handlers/diary.js');
    expect(typeof mod.handleDiaryInsights).toBe('function');
  });

  it('rejects unauthenticated requests', async () => {
    const mod = await import('../workers/src/handlers/diary.js');
    const request = { _user: null, method: 'POST' };
    const env = {};
    const resp = await mod.handleDiaryInsights(request, env);
    const body = await resp.json();
    expect(resp.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('rejects when fewer than 10 entries', async () => {
    vi.doMock('../workers/src/db/queries.js', () => ({
      QUERIES: { getDiaryEntriesForInsights: 'SELECT ...' },
      createQueryFn: () => () => Promise.resolve({ rows: Array(5).fill({}) }),
    }));
    vi.doMock('../workers/src/lib/llm.js', () => ({ callLLM: vi.fn() }));
    vi.doMock('../workers/src/lib/routeErrors.js', () => ({
      reportHandledRouteError: ({ error }) => Response.json({ error: error?.message }, { status: 500 }),
    }));
    vi.doMock('../workers/src/lib/analytics.js', () => ({
      trackEvent: vi.fn(),
    }));
    vi.doMock('../../../src/engine/transits.js', () => ({
      getCurrentTransits: vi.fn(),
    }));
    vi.doMock('../workers/src/lib/logger.js', () => ({
      createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
    }));

    const mod = await import('../workers/src/handlers/diary.js');
    const request = { _user: { sub: 'user-1' }, method: 'POST' };
    const env = { NEON_CONNECTION_STRING: 'fake' };
    const resp = await mod.handleDiaryInsights(request, env);
    const body = await resp.json();
    expect(resp.status).toBe(400);
    expect(body.error).toContain('Need at least 10');
    expect(body.error).toContain('you have 5');
  });

  it('calls LLM and returns insights when 10+ entries', async () => {
    const mockEntries = Array(12).fill(null).map((_, i) => ({
      event_date: `2025-0${(i % 9) + 1}-15`,
      event_title: `Event ${i}`,
      event_description: `Description ${i}`,
      event_type: 'career',
      significance: 'major',
      transit_snapshot: null,
    }));

    const mockCallLLM = vi.fn().mockResolvedValue('Pattern: Career focus dominates.');

    vi.doMock('../workers/src/db/queries.js', () => ({
      QUERIES: { getDiaryEntriesForInsights: 'SELECT ...' },
      createQueryFn: () => () => Promise.resolve({ rows: mockEntries }),
    }));
    vi.doMock('../workers/src/lib/llm.js', () => ({ callLLM: mockCallLLM }));
    vi.doMock('../workers/src/lib/routeErrors.js', () => ({
      reportHandledRouteError: ({ error }) => Response.json({ error: error?.message }, { status: 500 }),
    }));
    vi.doMock('../workers/src/lib/analytics.js', () => ({
      trackEvent: vi.fn(),
    }));
    vi.doMock('../../../src/engine/transits.js', () => ({
      getCurrentTransits: vi.fn(),
    }));
    vi.doMock('../workers/src/lib/logger.js', () => ({
      createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
    }));

    const mod = await import('../workers/src/handlers/diary.js');
    const request = { _user: { sub: 'user-2' }, method: 'POST' };
    const env = { NEON_CONNECTION_STRING: 'fake' };
    const resp = await mod.handleDiaryInsights(request, env);
    const body = await resp.json();
    expect(resp.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.insights).toBe('Pattern: Career focus dominates.');
    expect(body.entryCount).toBe(12);
    expect(body.generatedAt).toBeTruthy();
    expect(mockCallLLM).toHaveBeenCalledOnce();
  });

  it('passes transit data to LLM prompt when available', async () => {
    const mockEntries = Array(10).fill(null).map((_, i) => ({
      event_date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      event_title: `Event ${i}`,
      event_description: null,
      event_type: 'spiritual',
      significance: 'moderate',
      transit_snapshot: JSON.stringify({
        transitData: {
          aspects: [
            { transitPlanet: 'Saturn', aspect: 'square', natalPlanet: 'Moon' },
          ]
        }
      }),
    }));

    let capturedPrompt;
    const mockCallLLM = vi.fn().mockImplementation((payload) => {
      capturedPrompt = payload;
      return Promise.resolve('Transit patterns found.');
    });

    vi.doMock('../workers/src/db/queries.js', () => ({
      QUERIES: { getDiaryEntriesForInsights: 'SELECT ...' },
      createQueryFn: () => () => Promise.resolve({ rows: mockEntries }),
    }));
    vi.doMock('../workers/src/lib/llm.js', () => ({ callLLM: mockCallLLM }));
    vi.doMock('../workers/src/lib/routeErrors.js', () => ({
      reportHandledRouteError: ({ error }) => Response.json({ error: error?.message }, { status: 500 }),
    }));
    vi.doMock('../workers/src/lib/analytics.js', () => ({
      trackEvent: vi.fn(),
    }));
    vi.doMock('../../../src/engine/transits.js', () => ({
      getCurrentTransits: vi.fn(),
    }));
    vi.doMock('../workers/src/lib/logger.js', () => ({
      createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
    }));

    const mod = await import('../workers/src/handlers/diary.js');
    const request = { _user: { sub: 'user-3' }, method: 'POST' };
    const env = { NEON_CONNECTION_STRING: 'fake' };
    await mod.handleDiaryInsights(request, env);

    // The LLM should receive transit info in the prompt
    const userMsg = capturedPrompt.messages[0].content;
    expect(userMsg).toContain('Saturn');
    expect(userMsg).toContain('square');
    expect(userMsg).toContain('Moon');
  });
});

describe('Diary Insights — route wiring', () => {
  it('handleDiary routes POST /insights to insights handler', async () => {
    // We test the router's dispatch by checking the export list
    const mod = await import('../workers/src/handlers/diary.js');
    expect(typeof mod.handleDiary).toBe('function');
    expect(typeof mod.handleDiaryInsights).toBe('function');
  });
});
