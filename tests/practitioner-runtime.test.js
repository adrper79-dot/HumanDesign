import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createQueryFnMock } = vi.hoisted(() => ({
  createQueryFnMock: vi.fn(),
}));

const { getUserFromRequestMock, notionCreateProfilePageMock } = vi.hoisted(() => ({
  getUserFromRequestMock: vi.fn(),
  notionCreateProfilePageMock: vi.fn(),
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
    getUserByIdSafe: 'getUserByIdSafe',
    getNotionAccessTokenOnly: 'getNotionAccessTokenOnly',
    getNotionExportProfile: 'getNotionExportProfile',
    getPractitionerInvitationById: 'getPractitionerInvitationById',
    getPractitionerInvitationByTokenHash: 'getPractitionerInvitationByTokenHash',
    expirePendingPractitionerInvitationsByEmail: 'expirePendingPractitionerInvitationsByEmail',
    createPractitionerInvitation: 'createPractitionerInvitation',
    expirePractitionerInvitationById: 'expirePractitionerInvitationById',
    addClient: 'addClient',
    markPractitionerInvitationAccepted: 'markPractitionerInvitationAccepted',
  },
}));

vi.mock('../workers/src/middleware/tierEnforcement.js', () => ({
  enforceFeatureAccess: vi.fn(),
}));

vi.mock('../workers/src/middleware/auth.js', () => ({
  getUserFromRequest: getUserFromRequestMock,
}));

vi.mock('../workers/src/lib/email.js', () => ({
  sendPractitionerInvitationEmail: vi.fn(),
}));

vi.mock('../workers/src/lib/notion.js', () => ({
  NotionClient: class {
    async createProfilePage(payload) {
      return notionCreateProfilePageMock(payload);
    }
  },
}));

vi.mock('../workers/src/lib/tokenCrypto.js', () => ({
  importEncryptionKey: vi.fn(async () => 'mock-key'),
  encryptToken: vi.fn(),
  readToken: vi.fn(async (token) => token),
}));

import { handleCreateNote, handleGetAIContext, handleUpdateNote } from '../workers/src/handlers/session-notes.js';
import { handleAcceptInvitation, handleGetInvitationDetails, handlePractitioner } from '../workers/src/handlers/practitioner.js';
import { handleDeleteNote } from '../workers/src/handlers/session-notes.js';
import { handleBrandedPdfExport } from '../workers/src/handlers/pdf.js';
import { enforceFeatureAccess } from '../workers/src/middleware/tierEnforcement.js';
import { sendPractitionerInvitationEmail } from '../workers/src/lib/email.js';
import { handleExportProfile } from '../workers/src/handlers/notion.js';

describe('practitioner runtime guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceFeatureAccess.mockResolvedValue(null);
    getUserFromRequestMock.mockResolvedValue({ id: 'pract-user-1', tier: 'practitioner' });
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

  it('resends a pending practitioner invitation with a fresh link', async () => {
    sendPractitionerInvitationEmail.mockResolvedValue({ success: true });

    const query = vi.fn(async (sql, params) => {
      if (sql === 'getPractitionerByUserId') {
        return { rows: [{ id: 'pract-1', display_name: 'Avery Guide' }] };
      }
      if (sql === 'getPractitionerInvitationById') {
        expect(params).toEqual(['deadbeef-1234', 'pract-1']);
        return {
          rows: [{
            id: 'deadbeef-1234',
            practitioner_id: 'pract-1',
            client_email: 'client@example.com',
            client_name: 'Client Example',
            status: 'pending',
            message: 'See you soon',
          }],
        };
      }
      if (sql === 'expirePendingPractitionerInvitationsByEmail') {
        expect(params).toEqual(['pract-1', 'client@example.com']);
        return { rowCount: 1, rows: [] };
      }
      if (sql === 'createPractitionerInvitation') {
        expect(params[0]).toBe('pract-1');
        expect(params[1]).toBe('client@example.com');
        expect(params[2]).toBe('Client Example');
        expect(params[4]).toBe('See you soon');
        expect(typeof params[3]).toBe('string');
        expect(params[3].length).toBeGreaterThan(10);
        return { rows: [{ id: 'new-invite-1', client_email: 'client@example.com', status: 'pending' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    createQueryFnMock.mockReturnValue(query);

    const response = await handlePractitioner(
      Object.assign(new Request('https://api.test/api/practitioner/clients/invitations/deadbeef-1234/resend', {
        method: 'POST',
      }), { _user: { sub: 'pract-user-1', email: 'practitioner@example.com' } }),
      {
        NEON_CONNECTION_STRING: 'postgresql://test',
        FRONTEND_URL: 'https://selfprime.net',
        RESEND_API_KEY: 'resend_test_key',
        FROM_EMAIL: 'hello@selfprime.net',
      },
      '/clients/invitations/deadbeef-1234/resend'
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.mode).toBe('resent');
    expect(body.emailSent).toBe(true);
    expect(body.inviteUrl).toMatch(/^https:\/\/selfprime.net\/\?invite=/);
    expect(sendPractitionerInvitationEmail).toHaveBeenCalledTimes(1);
  });

  it('allows a practitioner to export a roster client profile to Notion', async () => {
    notionCreateProfilePageMock.mockResolvedValue({ id: 'page-1', url: 'https://notion.so/page-1' });

    const query = vi.fn(async (sql, params) => {
      if (sql === 'getNotionAccessTokenOnly') {
        expect(params).toEqual(['pract-user-1']);
        return { rows: [{ access_token: 'encrypted-token' }] };
      }
      if (sql === 'getNotionExportProfile') {
        expect(params).toEqual(['profile-1', 'pract-user-1']);
        return {
          rows: [{
            profile_json: { strategy: 'Wait to respond', signature: 'Satisfaction', notSelfTheme: 'Frustration', synthesis: 'Test synthesis' },
            hd_json: { type: 'Generator', profile: '5/1', authority: 'Sacral', definition: 'Split', centers: [], gates: [], channels: [] },
            email: 'client@example.com',
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    createQueryFnMock.mockReturnValue(query);

    const response = await handleExportProfile(
      new Request('https://api.test/api/notion/export/profile/profile-1', { method: 'POST' }),
      { NEON_CONNECTION_STRING: 'postgresql://test', NOTION_TOKEN_ENCRYPTION_KEY: 'abc' },
      'profile-1'
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.pageUrl).toBe('https://notion.so/page-1');
    expect(notionCreateProfilePageMock).toHaveBeenCalledTimes(1);
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
      if (sql === 'getUserByIdSafe') {
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
      if (sql === 'getUserByIdSafe') {
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
