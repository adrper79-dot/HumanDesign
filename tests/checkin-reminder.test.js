/**
 * Check-in Streak Preferences Tests — Item 1.7
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Check-in Reminder — query presence', () => {
  it('cronGetDueCheckinReminders query exists', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.cronGetDueCheckinReminders).toBe('string');
    expect(QUERIES.cronGetDueCheckinReminders).toContain('checkin_reminders');
    expect(QUERIES.cronGetDueCheckinReminders).toContain('enabled = true');
  });

  it('cronGetDueCheckinReminders excludes users who already checked in today', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.cronGetDueCheckinReminders).toContain('daily_checkins');
    expect(QUERIES.cronGetDueCheckinReminders).toContain('NOT EXISTS');
  });

  it('cronGetDueCheckinReminders excludes already-sent-today reminders', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.cronGetDueCheckinReminders).toContain('last_sent_at');
    expect(QUERIES.cronGetDueCheckinReminders).toContain('CURRENT_DATE');
  });

  it('updateReminderLastSent query exists', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.updateReminderLastSent).toBe('string');
    expect(QUERIES.updateReminderLastSent).toContain('UPDATE checkin_reminders');
    expect(QUERIES.updateReminderLastSent).toContain('last_sent_at');
  });

  it('upsertCheckinReminder query exists', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.upsertCheckinReminder).toBe('string');
    expect(QUERIES.upsertCheckinReminder).toContain('ON CONFLICT');
  });

  it('getCheckinReminder query exists', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(typeof QUERIES.getCheckinReminder).toBe('string');
    expect(QUERIES.getCheckinReminder).toContain('checkin_reminders');
  });
});

describe('Check-in Reminder — handler exports', () => {
  it('handleSetCheckinReminder is exported', async () => {
    const mod = await import('../workers/src/handlers/checkin.js');
    expect(typeof mod.handleSetCheckinReminder).toBe('function');
  });

  it('handleGetCheckinReminder is exported', async () => {
    const mod = await import('../workers/src/handlers/checkin.js');
    expect(typeof mod.handleGetCheckinReminder).toBe('function');
  });
});

describe('Check-in Reminder — handler validation', () => {
  it('handleSetCheckinReminder rejects unauthenticated', async () => {
    const mod = await import('../workers/src/handlers/checkin.js');
    const request = { _user: null, method: 'POST', json: () => ({}) };
    const env = {};
    const resp = await mod.handleSetCheckinReminder(request, env);
    const body = await resp.json();
    expect(resp.status).toBe(401);
    expect(body.error).toContain('Authentication required');
  });

  it('handleGetCheckinReminder rejects unauthenticated', async () => {
    const mod = await import('../workers/src/handlers/checkin.js');
    const request = { _user: null, method: 'GET' };
    const env = {};
    const resp = await mod.handleGetCheckinReminder(request, env);
    const body = await resp.json();
    expect(resp.status).toBe(401);
    expect(body.error).toContain('Authentication required');
  });
});

describe('Check-in Reminder — cron query structure', () => {
  it('cronGetDueCheckinReminders joins users for email', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.cronGetDueCheckinReminders).toContain('JOIN users');
    expect(QUERIES.cronGetDueCheckinReminders).toContain('email');
  });

  it('cronGetDueCheckinReminders returns notification_method', async () => {
    const { QUERIES } = await import('../workers/src/db/queries.js');
    expect(QUERIES.cronGetDueCheckinReminders).toContain('notification_method');
  });
});
