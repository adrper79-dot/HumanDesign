/**
 * Session Summary Email Tests (item 5.2)
 *
 * Tests sendSessionSummaryEmail output and the session-notes handler's
 * send_summary flag behaviour.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Global fetch mock ──────────────────────────────────────────────────────

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// ── Import under test ──────────────────────────────────────────────────────

import { sendSessionSummaryEmail } from '../workers/src/lib/email.js';

// ── sendSessionSummaryEmail ────────────────────────────────────────────────

describe('sendSessionSummaryEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email-id-1' }),
    });
  });

  it('returns null when clientEmail is missing', async () => {
    const result = await sendSessionSummaryEmail(
      '', 'Alice', 'Doc Bob', 'Great session', [], null, 'test-api-key', 'from@test.com'
    );
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when apiKey is missing', async () => {
    const result = await sendSessionSummaryEmail(
      'alice@example.com', 'Alice', 'Doc Bob', 'Great session', [], null, '', 'from@test.com'
    );
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls Resend API with correct subject', async () => {
    await sendSessionSummaryEmail(
      'alice@example.com', 'Alice', 'Doc Bob', 'Great session', [],
      null, 're_test_key', 'hello@primeself.app'
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    const payload = JSON.parse(options.body);
    expect(payload.subject).toBe('Your session summary with Doc Bob');
    expect(payload.to).toContain('alice@example.com');
  });

  it('includes personalised greeting in HTML', async () => {
    await sendSessionSummaryEmail(
      'alice@example.com', 'Alice', 'Doc Bob', 'Great session', [],
      null, 're_test_key', 'hello@primeself.app'
    );

    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.html).toContain('Hi Alice');
    expect(payload.html).toContain('Great session');
  });

  it('truncates note content longer than 600 chars', async () => {
    const longNote = 'A'.repeat(700);
    await sendSessionSummaryEmail(
      'alice@example.com', 'Alice', 'Doc', longNote, [],
      null, 're_test_key', 'from@test.com'
    );

    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body);
    // HTML-encoded note should be truncated (600 chars + ellipsis)
    expect(payload.html).toContain('A'.repeat(600));
    expect(payload.html).toContain('…');
    expect(payload.html).not.toContain('A'.repeat(601));
  });

  it('renders action items when provided', async () => {
    await sendSessionSummaryEmail(
      'alice@example.com', 'Alice', 'Doc', 'Session done',
      ['Meditate daily', 'Journal tonight'],
      null, 're_test_key', 'from@test.com'
    );

    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.html).toContain('Meditate daily');
    expect(payload.html).toContain('Journal tonight');
    expect(payload.html).toContain('Action Items');
  });

  it('omits action items block when list is empty', async () => {
    await sendSessionSummaryEmail(
      'alice@example.com', 'Alice', 'Doc', 'Session done', [],
      null, 're_test_key', 'from@test.com'
    );

    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.html).not.toContain('Action Items');
  });

  it('renders booking button for valid https booking URL', async () => {
    await sendSessionSummaryEmail(
      'alice@example.com', 'Alice', 'Doc', 'Session done', [],
      'https://cal.com/doc/session', 're_test_key', 'from@test.com'
    );

    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.html).toContain('Book Your Next Session');
    expect(payload.html).toContain('https://cal.com/doc/session');
  });

  it('does not render booking button for non-https URL', async () => {
    await sendSessionSummaryEmail(
      'alice@example.com', 'Alice', 'Doc', 'Session done', [],
      'javascript:alert(1)', 're_test_key', 'from@test.com'
    );

    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.html).not.toContain('Book Your Next Session');
  });

  it('escapes HTML in action items to prevent XSS', async () => {
    await sendSessionSummaryEmail(
      'alice@example.com', 'Alice', 'Doc', 'Done',
      ['<script>alert(1)</script>'],
      null, 're_test_key', 'from@test.com'
    );

    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.html).not.toContain('<script>');
    expect(payload.html).toContain('&lt;script&gt;');
  });

  it('uses fallback practitioner name when not provided', async () => {
    await sendSessionSummaryEmail(
      'alice@example.com', 'Alice', '', 'Done', [],
      null, 're_test_key', 'from@test.com'
    );

    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.subject).toContain('Your Practitioner');
  });
});
