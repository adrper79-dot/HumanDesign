/**
 * CSV Export Tests — Item 2.4
 * Tests for practitioner CSV export of roster, notes, and readings.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Inline CSV helpers (same logic as practitioner.js) ──
function escapeCSV(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV(columns, rows) {
  const header = columns.map(c => escapeCSV(c.label)).join(',');
  const lines = rows.map(row =>
    columns.map(c => escapeCSV(row[c.key])).join(',')
  );
  return header + '\n' + lines.join('\n');
}

describe('CSV Export — escapeCSV', () => {
  it('returns empty string for null/undefined', () => {
    expect(escapeCSV(null)).toBe('');
    expect(escapeCSV(undefined)).toBe('');
  });

  it('passes through plain strings', () => {
    expect(escapeCSV('hello')).toBe('hello');
  });

  it('wraps strings with commas in quotes', () => {
    expect(escapeCSV('hello, world')).toBe('"hello, world"');
  });

  it('escapes double quotes', () => {
    expect(escapeCSV('say "hello"')).toBe('"say ""hello"""');
  });

  it('wraps strings with newlines', () => {
    expect(escapeCSV('line1\nline2')).toBe('"line1\nline2"');
  });

  it('wraps strings with carriage returns', () => {
    expect(escapeCSV('line1\rline2')).toBe('"line1\rline2"');
  });

  it('converts numbers to strings', () => {
    expect(escapeCSV(42)).toBe('42');
  });
});

describe('CSV Export — toCSV', () => {
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'email', label: 'Email' },
    { key: 'name', label: 'Name' },
  ];

  it('produces header-only for empty rows', () => {
    const csv = toCSV(columns, []);
    expect(csv).toBe('ID,Email,Name\n');
  });

  it('produces correct CSV with data', () => {
    const rows = [
      { id: '1', email: 'a@b.com', name: 'Alice' },
      { id: '2', email: 'c@d.com', name: 'Bob' },
    ];
    const csv = toCSV(columns, rows);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('ID,Email,Name');
    expect(lines[1]).toBe('1,a@b.com,Alice');
    expect(lines[2]).toBe('2,c@d.com,Bob');
  });

  it('handles special characters in data', () => {
    const rows = [
      { id: '1', email: 'a@b.com', name: 'O\'Brien, "The Great"' },
    ];
    const csv = toCSV(columns, rows);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('"O\'Brien');
  });

  it('handles null/missing fields gracefully', () => {
    const rows = [
      { id: '1', email: null, name: undefined },
    ];
    const csv = toCSV(columns, rows);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('1,,');
  });
});

describe('CSV Export — roster columns', () => {
  const rosterColumns = [
    { key: 'id', label: 'ID' },
    { key: 'email', label: 'Email' },
    { key: 'display_name', label: 'Name' },
    { key: 'birth_date', label: 'Birth Date' },
    { key: 'user_joined', label: 'User Joined' },
    { key: 'added_at', label: 'Added At' },
  ];

  it('produces correct roster CSV header', () => {
    const csv = toCSV(rosterColumns, []);
    expect(csv.startsWith('ID,Email,Name,Birth Date,User Joined,Added At')).toBe(true);
  });

  it('renders a roster row', () => {
    const rows = [{
      id: 'abc-123',
      email: 'client@test.com',
      display_name: 'Test Client',
      birth_date: '1990-03-15',
      user_joined: '2025-01-01T00:00:00Z',
      added_at: '2025-06-01T00:00:00Z'
    }];
    const csv = toCSV(rosterColumns, rows);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('abc-123');
    expect(lines[1]).toContain('client@test.com');
    expect(lines[1]).toContain('Test Client');
  });
});

describe('CSV Export — notes columns', () => {
  const notesColumns = [
    { key: 'id', label: 'Note ID' },
    { key: 'client_email', label: 'Client Email' },
    { key: 'client_name', label: 'Client Name' },
    { key: 'session_date', label: 'Session Date' },
    { key: 'content', label: 'Content' },
    { key: 'share_with_ai', label: 'Shared with AI' },
    { key: 'created_at', label: 'Created At' },
  ];

  it('produces correct notes CSV header', () => {
    const csv = toCSV(notesColumns, []);
    expect(csv.startsWith('Note ID,Client Email,Client Name,Session Date,Content,Shared with AI,Created At')).toBe(true);
  });

  it('properly escapes note content with commas and newlines', () => {
    const rows = [{
      id: 'n-1',
      client_email: 'c@t.com',
      client_name: 'Client',
      session_date: '2025-06-01',
      content: 'Discussion about career, goals\nand relationships',
      share_with_ai: true,
      created_at: '2025-06-01T10:00:00Z'
    }];
    const csv = toCSV(notesColumns, rows);
    // Content with commas/newlines should be quoted
    expect(csv).toContain('"Discussion about career');
  });
});

describe('CSV Export — readings columns', () => {
  const readingsColumns = [
    { key: 'id', label: 'Reading ID' },
    { key: 'client_email', label: 'Client Email' },
    { key: 'client_name', label: 'Client Name' },
    { key: 'reading_type', label: 'Reading Type' },
    { key: 'spread_type', label: 'Spread Type' },
    { key: 'reading_date', label: 'Reading Date' },
    { key: 'interpretation', label: 'Interpretation' },
    { key: 'created_at', label: 'Created At' },
  ];

  it('produces correct readings CSV header', () => {
    const csv = toCSV(readingsColumns, []);
    expect(csv.startsWith('Reading ID,Client Email,Client Name,Reading Type,Spread Type,Reading Date,Interpretation,Created At')).toBe(true);
  });

  it('renders a reading row', () => {
    const rows = [{
      id: 'r-1',
      client_email: 'c@t.com',
      client_name: 'Client',
      reading_type: 'tarot',
      spread_type: 'celtic_cross',
      reading_date: '2025-06-01',
      interpretation: 'Good reading',
      created_at: '2025-06-01T10:00:00Z'
    }];
    const csv = toCSV(readingsColumns, rows);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('tarot');
    expect(lines[1]).toContain('celtic_cross');
    expect(lines[1]).toContain('Good reading');
  });
});

describe('CSV Export — query presence', () => {
  it('exports required queries from queries.js', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.exportRoster).toBe('string');
    expect(typeof QUERIES.exportNotes).toBe('string');
    expect(typeof QUERIES.exportReadings).toBe('string');
  });

  it('exportRoster query selects from practitioner_clients', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.exportRoster).toContain('practitioner_clients');
    expect(QUERIES.exportRoster).toContain('email');
  });

  it('exportNotes query selects from practitioner_session_notes', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.exportNotes).toContain('practitioner_session_notes');
    expect(QUERIES.exportNotes).toContain('content');
  });

  it('exportReadings query selects from divination_readings', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.exportReadings).toContain('divination_readings');
    expect(QUERIES.exportReadings).toContain('reading_type');
  });
});
