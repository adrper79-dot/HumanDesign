import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createQueryFnMock } = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
}));

vi.mock('../workers/src/db/queries.js', () => ({
  createQueryFn: createQueryFnMock,
  QUERIES: {
    getPractitionerByUserId: 'getPractitionerByUserId',
    checkPractitionerAccess: 'checkPractitionerAccess',
    createSessionNote: 'createSessionNote',
    updateSessionNote: 'updateSessionNote',
    deleteSessionNote: 'deleteSessionNote',
    getClientAIContext: 'getClientAIContext',
    updateClientAIContext: 'updateClientAIContext',
    getLatestProfile: 'getLatestProfile',
    getChartById: 'getChartById',
    getPractitionerBranding: 'getPractitionerBranding',
    getUserById: 'getUserById',
    getPractitionerInvitationByTokenHash: 'getPractitionerInvitationByTokenHash',
    expirePractitionerInvitationById: 'expirePractitionerInvitationById',
    addClient: 'addClient',
    markPractitionerInvitationAccepted: 'markPractitionerInvitationAccepted',
  },
}));

vi.mock('../workers/src/middleware/tierEnforcement.js', () => ({
  enforceFeatureAccess: vi.fn(),
}));

vi.mock('../workers/src/lib/email.js', () => ({
  sendPractitionerInvitationEmail: vi.fn(),
}));

import { handleCreateNote, handleGetAIContext, handleUpdateNote } from '../workers/src/handlers/session-notes.js';
import { handleAcceptInvitation, handleGetInvitationDetails, handlePractitioner } from '../workers/src/handlers/practitioner.js';
import { handleDeleteNote } from '../workers/src/handlers/session-notes.js';
import { handleBrandedPdfExport } from '../workers/src/handlers/pdf.js';
import { enforceFeatureAccess } from '../workers/src/middleware/tierEnforcement.js';

describe('practitioner runtime guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceFeatureAccess.mockResolvedValue(null);
  });

  it('scopes note updates by practitioner ownership', async () => {
    const query = vi.fn(async (sql, params) => {
      if (sql === 'getPractitionerByUserId') {
        return { rows: [{ id: 'pract-1' }] };
      }
      if (sql === 'updateSessionNote') {
        expect(params).toEqual(['note-1', 'Updated note', true, 'pract-1']);
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    createQueryFnMock.mockReturnValue(query);

    const response = await handleUpdateNote(
      Object.assign(new Request('https://api.test/api/practitioner/notes/note-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Updated note', share_with_ai: true }),
      }), { _user: { sub: 'user-1' } }),
      { NEON_CONNECTION_STRING: 'postgresql://test' },
      'note-1'
    );

    expect(response.status).toBe(404);
  });

  it('rejects note creation when the client is not on the practitioner roster', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId') {
        return { rows: [{ id: 'pract-1' }] };
      }
      if (sql === 'checkPractitionerAccess') {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    createQueryFnMock.mockReturnValue(query);

    const response = await handleCreateNote(
      Object.assign(new Request('https://api.test/api/practitioner/clients/client-2/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'First session note' }),
      }), { _user: { sub: 'user-1' } }),
      { NEON_CONNECTION_STRING: 'postgresql://test' },
      'client-2'
    );

    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).toMatch(/not on your roster/i);
  });

  it('rejects AI context access when the client is not on the practitioner roster', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId') {
        return { rows: [{ id: 'pract-1' }] };
      }
      if (sql === 'checkPractitionerAccess') {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    createQueryFnMock.mockReturnValue(query);

    const response = await handleGetAIContext(
      Object.assign(new Request('https://api.test/api/practitioner/clients/client-2/ai-context', {
        method: 'GET',
      }), { _user: { sub: 'user-1' } }),
      { NEON_CONNECTION_STRING: 'postgresql://test' },
      'client-2'
    );

    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).toMatch(/not on your roster/i);
  });

  it('returns 404 when a practitioner tries to delete a note they do not own', async () => {
    const query = vi.fn(async (sql, params) => {
      if (sql === 'getPractitionerByUserId') {
        return { rows: [{ id: 'pract-1' }] };
      }
      if (sql === 'deleteSessionNote') {
        expect(params).toEqual(['note-9', 'pract-1']);
        return { rowCount: 0 };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    createQueryFnMock.mockReturnValue(query);

    const response = await handleDeleteNote(
      Object.assign(new Request('https://api.test/api/practitioner/notes/note-9', {
        method: 'DELETE',
      }), { _user: { sub: 'user-1' } }),
      { NEON_CONNECTION_STRING: 'postgresql://test' },
      'note-9'
    );

    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.error).toMatch(/note not found/i);
  });

  it('rejects client detail access when the client is not on the practitioner roster', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getPractitionerByUserId') {
        return { rows: [{ id: 'pract-1' }] };
      }
      if (sql === 'checkPractitionerAccess') {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    createQueryFnMock.mockReturnValue(query);
    const clientId = 'deadbeef-1234';

    const response = await handlePractitioner(
      Object.assign(new Request(`https://api.test/api/practitioner/clients/${clientId}`, {
        method: 'GET',
      }), { _user: { sub: 'pract-user-1' } }),
      { NEON_CONNECTION_STRING: 'postgresql://test' },
      `/clients/${clientId}`
    );

    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).toMatch(/not on your roster/i);
  });

  it('rejects branded PDF export when the client is not on the practitioner roster', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'checkPractitionerAccess') {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    createQueryFnMock.mockReturnValue(query);

    const response = await handleBrandedPdfExport(
      Object.assign(new Request('https://api.test/api/practitioner/clients/client-7/pdf', {
        method: 'POST',
      }), { _user: { sub: 'pract-user-1' } }),
      { NEON_CONNECTION_STRING: 'postgresql://test' },
      'client-7'
    );

    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).toMatch(/not on your roster/i);
    expect(enforceFeatureAccess).toHaveBeenCalledTimes(1);
  });

  it('expires a stale practitioner invitation during invite preview', async () => {
    const query = vi.fn(async (sql, params) => {
      if (sql === 'getPractitionerInvitationByTokenHash') {
        return {
          rows: [{
            id: 'invite-expired',
            practitioner_id: 'pract-1',
            practitioner_user_id: 'pract-user-1',
            practitioner_display_name: 'Avery Guide',
            client_email: 'client@example.com',
            status: 'pending',
            expires_at: '2000-01-01T00:00:00.000Z',
          }],
        };
      }
      if (sql === 'expirePractitionerInvitationById') {
        expect(params).toEqual(['invite-expired']);
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    createQueryFnMock.mockReturnValue(query);

    const response = await handleGetInvitationDetails(
      new Request('https://api.test/api/invitations/practitioner?token=abcdefghijklmnopqrstuvwxyz123456', {
        method: 'GET',
      }),
      { NEON_CONNECTION_STRING: 'postgresql://test' }
    );

    const body = await response.json();
    expect(response.status).toBe(410);
    expect(body.error).toMatch(/expired/i);
  });

  it('accepts a practitioner invitation for the invited email', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getUserById') {
        return { rows: [{ id: 'client-1', email: 'client@example.com' }] };
      }
      if (sql === 'getPractitionerInvitationByTokenHash') {
        return {
          rows: [{
            id: 'invite-1',
            practitioner_id: 'pract-1',
            practitioner_user_id: 'pract-user-1',
            practitioner_display_name: 'Avery Guide',
            client_email: 'client@example.com',
            status: 'pending',
            expires_at: '2099-01-01T00:00:00.000Z',
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const txQuery = vi.fn(async (sql, params) => {
      if (sql === 'addClient') {
        expect(params).toEqual(['pract-1', 'client-1']);
        return { rowCount: 1, rows: [] };
      }
      if (sql === 'markPractitionerInvitationAccepted') {
        expect(params).toEqual(['invite-1']);
        return { rows: [{ id: 'invite-1', status: 'accepted' }] };
      }
      throw new Error(`Unexpected transaction query: ${sql}`);
    });

    query.transaction = vi.fn(async (fn) => fn(txQuery));
    createQueryFnMock.mockReturnValue(query);

    const response = await handleAcceptInvitation(
      Object.assign(new Request('https://api.test/api/invitations/practitioner/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'abcdefghijklmnopqrstuvwxyz123456' }),
      }), { _user: { sub: 'client-1' } }),
      { NEON_CONNECTION_STRING: 'postgresql://test' }
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.practitioner.name).toBe('Avery Guide');
    expect(query.transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects invitation acceptance when the signed-in email does not match the invite', async () => {
    const query = vi.fn(async (sql) => {
      if (sql === 'getUserById') {
        return { rows: [{ id: 'client-2', email: 'other@example.com' }] };
      }
      if (sql === 'getPractitionerInvitationByTokenHash') {
        return {
          rows: [{
            id: 'invite-2',
            practitioner_id: 'pract-1',
            practitioner_user_id: 'pract-user-1',
            practitioner_display_name: 'Avery Guide',
            client_email: 'client@example.com',
            status: 'pending',
            expires_at: '2099-01-01T00:00:00.000Z',
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    query.transaction = vi.fn();
    createQueryFnMock.mockReturnValue(query);

    const response = await handleAcceptInvitation(
      Object.assign(new Request('https://api.test/api/invitations/practitioner/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'abcdefghijklmnopqrstuvwxyz123456' }),
      }), { _user: { sub: 'client-2' } }),
      { NEON_CONNECTION_STRING: 'postgresql://test' }
    );

    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).toMatch(/invited email address/i);
    expect(query.transaction).not.toHaveBeenCalled();
  });
});
