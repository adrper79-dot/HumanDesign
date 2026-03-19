/**
 * Session Template Picker Tests
 * Item 1.1 — Session Template Picker
 *
 * Tests the template listing, template detail, and hydration endpoints.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock queries.js (session-templates imports it even though it doesn't use DB queries for listing)
vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: vi.fn(),
  QUERIES: {}
}));

const {
  handleListSessionTemplates,
  handleGetSessionTemplate,
  handleHydrateTemplate
} = await import('../workers/src/handlers/session-templates.js');

describe('GET /api/practitioner/session-templates', () => {
  it('returns all templates with summary fields', async () => {
    const res = await handleListSessionTemplates({});
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.templates)).toBe(true);
    expect(data.templates.length).toBeGreaterThanOrEqual(4);
    // Each template should have summary fields, not full sections
    data.templates.forEach(t => {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('description');
      expect(t).toHaveProperty('sectionCount');
      expect(t).not.toHaveProperty('sections'); // summary only
    });
    expect(data.total).toBe(data.templates.length);
  });

  it('includes the 4 built-in templates', async () => {
    const res = await handleListSessionTemplates({});
    const data = await res.json();
    const ids = data.templates.map(t => t.id);
    expect(ids).toContain('intake');
    expect(ids).toContain('followup');
    expect(ids).toContain('integration');
    expect(ids).toContain('closing');
  });
});

describe('GET /api/practitioner/session-templates/:templateId', () => {
  it('returns full template with sections for valid ID', async () => {
    const res = await handleGetSessionTemplate({}, 'intake');
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.template.id).toBe('intake');
    expect(data.template.name).toBe('Initial Intake');
    expect(Array.isArray(data.template.sections)).toBe(true);
    expect(data.template.sections.length).toBe(5);
    data.template.sections.forEach(s => {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('label');
      expect(s).toHaveProperty('prompt');
    });
  });

  it('returns 404 for unknown template', async () => {
    const res = await handleGetSessionTemplate({}, 'nonexistent');
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Template not found');
  });
});

describe('POST /api/practitioner/session-templates/:templateId/hydrate', () => {
  function makeRequest(body) {
    return { json: () => Promise.resolve(body) };
  }

  it('hydrates template with client data', async () => {
    const req = makeRequest({
      clientId: 'c1',
      clientName: 'Alice',
      clientType: 'Generator',
      clientProfile: '3/5',
      clientAuthority: 'Sacral'
    });
    const res = await handleHydrateTemplate(req, {}, 'intake');
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.template.id).toBe('intake');
    expect(data.template.client.name).toBe('Alice');
    expect(data.template.client.type).toBe('Generator');
    expect(Array.isArray(data.template.sections)).toBe(true);
    // Each section should have context hints
    data.template.sections.forEach(s => {
      expect(s).toHaveProperty('context');
      expect(s).toHaveProperty('label');
      expect(s).toHaveProperty('prompt');
    });
  });

  it('returns 404 for unknown template during hydrate', async () => {
    const req = makeRequest({ clientId: 'c1' });
    const res = await handleHydrateTemplate(req, {}, 'nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = { json: () => Promise.reject(new Error('bad json')) };
    const res = await handleHydrateTemplate(req, {}, 'intake');
    expect(res.status).toBe(400);
  });

  it('uses defaults for missing client fields', async () => {
    const req = makeRequest({ clientId: 'c1' });
    const res = await handleHydrateTemplate(req, {}, 'followup');
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.template.client.name).toBe('Your Client');
    expect(data.template.client.type).toBe('Unknown');
  });
});
