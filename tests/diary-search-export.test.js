/**
 * Diary Search/Filter + Export Tests — Item 1.10
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('buildDiaryFilterQuery — query builder', () => {
  let buildDiaryFilterQuery;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../workers/src/handlers/diary.js');
    buildDiaryFilterQuery = mod.buildDiaryFilterQuery;
  });

  it('returns base query with only userId', () => {
    const { sql, params } = buildDiaryFilterQuery('user-1', { limit: 50, offset: 0 });
    expect(sql).toContain('WHERE user_id = $1');
    expect(sql).toContain('ORDER BY event_date DESC');
    expect(sql).toContain('LIMIT $2');
    expect(params[0]).toBe('user-1');
    expect(params).toHaveLength(3); // userId, limit, offset
  });

  it('adds ILIKE condition for search', () => {
    const { sql, params } = buildDiaryFilterQuery('u1', { search: 'birthday', limit: 50, offset: 0 });
    expect(sql).toContain('ILIKE $2');
    expect(params).toContain('%birthday%');
  });

  it('adds event_type filter for valid type', () => {
    const { sql, params } = buildDiaryFilterQuery('u1', { eventType: 'career', limit: 50, offset: 0 });
    expect(sql).toContain('event_type = $2');
    expect(params).toContain('career');
  });

  it('ignores invalid event_type', () => {
    const { sql, params } = buildDiaryFilterQuery('u1', { eventType: 'invalid', limit: 50, offset: 0 });
    expect(sql).not.toContain('event_type = $ = $ = = $');
    expect(params).not.toContain('invalid');
  });

  it('adds significance filter for valid value', () => {
    const { sql, params } = buildDiaryFilterQuery('u1', { significance: 'major', limit: 50, offset: 0 });
    expect(sql).toContain('significance = $2');
    expect(params).toContain('major');
  });

  it('ignores invalid significance', () => {
    const { sql, params } = buildDiaryFilterQuery('u1', { significance: 'huge', limit: 50, offset: 0 });
    expect(sql).not.toContain('significance =');
  });

  it('adds date range filters', () => {
    const { sql, params } = buildDiaryFilterQuery('u1', { dateFrom: '2026-01-01', dateTo: '2026-12-31', limit: 50, offset: 0 });
    expect(sql).toContain('event_date >= $2::date');
    expect(sql).toContain('event_date <= $3::date');
    expect(params).toContain('2026-01-01');
    expect(params).toContain('2026-12-31');
  });

  it('rejects malformed date strings', () => {
    const { sql, params } = buildDiaryFilterQuery('u1', { dateFrom: 'not-a-date', dateTo: '2026/12/31', limit: 50, offset: 0 });
    expect(sql).not.toContain('event_date >=');
    expect(sql).not.toContain('event_date <=');
  });

  it('combines all filters with correct param indices', () => {
    const { sql, params } = buildDiaryFilterQuery('u1', {
      search: 'test',
      eventType: 'health',
      significance: 'minor',
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
      limit: 20,
      offset: 5,
    });
    // user_id=$1, search=$2, type=$3, sig=$4, from=$5, to=$6, limit=$7, offset=$8
    expect(params).toHaveLength(8);
    expect(params[0]).toBe('u1');
    expect(params[1]).toBe('%test%');
    expect(params[2]).toBe('health');
    expect(params[3]).toBe('minor');
    expect(params[4]).toBe('2026-01-01');
    expect(params[5]).toBe('2026-06-30');
    expect(params[6]).toBe(20);
    expect(params[7]).toBe(5);
    expect(sql).toContain('LIMIT $7 OFFSET $8');
  });
});

describe('handleDiaryExport — CSV export', () => {
  let handleDiaryExport;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../workers/src/db/queries.js', () => ({
      QUERIES: {
        exportUserDiary: 'SELECT event_date, event_title FROM diary_entries WHERE user_id = $1',
      },
      createQueryFn: () => async () => ({
        rows: [
          { event_date: '2026-03-01', event_title: 'Promotion', event_description: 'Got promoted', event_type: 'career', significance: 'major', created_at: '2026-03-01T12:00:00Z' },
          { event_date: '2026-03-05', event_title: 'Quote, "test"', event_description: null, event_type: 'other', significance: 'minor', created_at: '2026-03-05T12:00:00Z' },
        ],
      }),
    }));
    vi.doMock('../workers/src/lib/analytics.js', () => ({ trackEvent: vi.fn() }));
    vi.doMock('../workers/src/lib/routeErrors.js', () => ({
      reportHandledRouteError: vi.fn(() => Response.json({ error: 'err' }, { status: 500 })),
    }));
    vi.doMock('../workers/src/lib/logger.js', () => ({
      createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
    }));
    vi.doMock('../workers/src/lib/llm.js', () => ({ callLLM: vi.fn() }));
    vi.doMock('../../../src/engine/transits.js', () => ({ getCurrentTransits: vi.fn() }));

    const mod = await import('../workers/src/handlers/diary.js');
    handleDiaryExport = mod.handleDiaryExport;
  });

  it('rejects unauthenticated requests', async () => {
    const req = new Request('https://x.com/api/diary/export');
    req._user = null;
    const resp = await handleDiaryExport(req, { NEON_CONNECTION_STRING: 'x' });
    expect(resp.status).toBe(401);
  });

  it('returns CSV with correct Content-Type and header row', async () => {
    const req = new Request('https://x.com/api/diary/export');
    req._user = { sub: 'user-1' };
    const resp = await handleDiaryExport(req, { NEON_CONNECTION_STRING: 'x' });
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toContain('text/csv');
    expect(resp.headers.get('Content-Disposition')).toContain('diary-entries.csv');

    const body = await resp.text();
    const lines = body.split('\n');
    expect(lines[0]).toBe('Date,Title,Description,Type,Significance,Created At');
    expect(lines.length).toBe(3); // header + 2 rows
  });

  it('escapes CSV fields containing commas and quotes', async () => {
    const req = new Request('https://x.com/api/diary/export');
    req._user = { sub: 'user-1' };
    const resp = await handleDiaryExport(req, { NEON_CONNECTION_STRING: 'x' });
    const body = await resp.text();
    // Second row has title: Quote, "test" → should be escaped
    expect(body).toContain('"Quote, ""test"""');
  });
});

describe('handleDiaryList — filter integration', () => {
  let handleDiary;
  let lastQuery;

  beforeEach(async () => {
    vi.resetModules();
    lastQuery = null;
    vi.doMock('../workers/src/db/queries.js', () => ({
      QUERIES: {
        exportUserDiary: 'SELECT 1',
      },
      createQueryFn: () => async (sql, params) => {
        lastQuery = { sql, params };
        return { rows: [] };
      },
    }));
    vi.doMock('../workers/src/lib/analytics.js', () => ({ trackEvent: vi.fn() }));
    vi.doMock('../workers/src/lib/routeErrors.js', () => ({
      reportHandledRouteError: vi.fn(() => Response.json({ error: 'err' }, { status: 500 })),
    }));
    vi.doMock('../workers/src/lib/logger.js', () => ({
      createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
    }));
    vi.doMock('../workers/src/lib/llm.js', () => ({ callLLM: vi.fn() }));
    vi.doMock('../../../src/engine/transits.js', () => ({ getCurrentTransits: vi.fn() }));

    const mod = await import('../workers/src/handlers/diary.js');
    handleDiary = mod.default || mod.handleDiary;
  });

  it('passes search param to query builder', async () => {
    const req = new Request('https://x.com/api/diary?search=birthday');
    req._user = { sub: 'u1' };
    const resp = await handleDiary(req, { NEON_CONNECTION_STRING: 'x' }, '/');
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(lastQuery.sql).toContain('ILIKE');
    expect(lastQuery.params).toContain('%birthday%');
  });

  it('passes type and significance filters to query builder', async () => {
    const req = new Request('https://x.com/api/diary?type=career&significance=major');
    req._user = { sub: 'u1' };
    await handleDiary(req, { NEON_CONNECTION_STRING: 'x' }, '/');
    expect(lastQuery.sql).toContain('event_type = $2');
    expect(lastQuery.sql).toContain('significance = $3');
  });

  it('routes /export to CSV handler', async () => {
    const req = new Request('https://x.com/api/diary/export');
    req._user = { sub: 'u1' };
    const resp = await handleDiary(req, { NEON_CONNECTION_STRING: 'x' }, '/export');
    expect(resp.headers.get('Content-Type')).toContain('text/csv');
  });
});
