import { createQueryFn, QUERIES } from '../db/queries.js';
import { sendEmail } from '../lib/email.js';
import { createLogger } from '../lib/logger.js';

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const VALID_CATEGORIES = new Set(['chart_calc', 'profile', 'auth', 'payment', 'transit', 'ui', 'api', 'other']);

function cleanText(value, maxLength = 4000) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanJson(value, fallback = null) {
  if (!value || typeof value !== 'object') return fallback;
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

export async function handleBugReport(request, env) {
  const log = request._log || createLogger('bugs');
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const title = cleanText(body?.title, 140);
  const description = cleanText(body?.description, 5000);
  const severity = VALID_SEVERITIES.has(body?.severity) ? body.severity : 'medium';
  const category = VALID_CATEGORIES.has(body?.category) ? body.category : 'other';

  if (!title || !description) {
    return Response.json({ ok: false, error: 'Title and description are required' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const { rows: userRows } = await query(QUERIES.getUserByIdSafe, [userId]);
    const user = userRows?.[0] || {};
    const reporterEmail = user.email || null;
    const reporterName = reporterEmail ? reporterEmail.split('@')[0] : 'Authenticated user';

    const insertResult = await query(
      `INSERT INTO bug_reports (
        title, description, severity, category, status, user_id, email, reporter_name,
        user_agent, browser, os_name, viewport_width, viewport_height, page_url,
        affected_section, user_data, steps_to_reproduce, expected_behavior,
        actual_behavior, error_message, error_stack, console_logs, network_logs
      ) VALUES (
        $1, $2, $3, $4, 'reported', $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15::jsonb, $16, $17,
        $18, $19, $20, $21::jsonb, $22::jsonb
      ) RETURNING id, reported_at`,
      [
        title,
        description,
        severity,
        category,
        userId,
        reporterEmail,
        reporterName,
        cleanText(body?.userAgent, 1000),
        cleanText(body?.browser, 255),
        cleanText(body?.osName, 255),
        cleanInteger(body?.viewportWidth),
        cleanInteger(body?.viewportHeight),
        cleanText(body?.pageUrl, 1000),
        cleanText(body?.affectedSection, 255),
        cleanJson(body?.userData, '{}'),
        cleanText(body?.stepsToReproduce, 4000),
        cleanText(body?.expectedBehavior, 4000),
        cleanText(body?.actualBehavior, 4000),
        cleanText(body?.errorMessage, 4000),
        cleanText(body?.errorStack, 8000),
        cleanJson(body?.consoleLogs, '[]'),
        cleanJson(body?.networkLogs, '[]'),
      ]
    );

    const bugId = insertResult.rows?.[0]?.id;
    if (!bugId) {
      throw new Error('Failed to persist bug report');
    }

    await query(
      `INSERT INTO bug_audit_log (bug_id, changed_by, change_type, new_value, reason)
       VALUES ($1, $2, 'status_change', 'reported', 'User submitted bug report')`,
      [bugId, userId]
    ).catch(() => {});

    if (env.RESEND_API_KEY) {
      const supportEmail = env.SUPPORT_EMAIL || 'support@selfprime.net';
      const detailRows = [
        ['Bug ID', bugId],
        ['Severity', severity],
        ['Category', category],
        ['Reporter', reporterEmail || 'unknown'],
        ['Page', cleanText(body?.pageUrl, 1000) || 'unknown'],
        ['Section', cleanText(body?.affectedSection, 255) || 'unknown'],
      ];
      const detailsHtml = detailRows.map(([label, value]) => `<p><strong>${label}:</strong> ${value}</p>`).join('');
      const expected = cleanText(body?.expectedBehavior, 4000) || 'Not provided';
      const actual = cleanText(body?.actualBehavior, 4000) || 'Not provided';
      const steps = cleanText(body?.stepsToReproduce, 4000) || 'Not provided';

      await sendEmail({
        to: supportEmail,
        subject: `[Bug Report] ${severity.toUpperCase()} ${title}`,
        replyTo: reporterEmail || '',
        html: `<html><body><h2>New bug report</h2>${detailsHtml}<p><strong>Description</strong></p><p>${description.replace(/\n/g, '<br>')}</p><p><strong>Expected</strong></p><p>${expected.replace(/\n/g, '<br>')}</p><p><strong>Actual</strong></p><p>${actual.replace(/\n/g, '<br>')}</p><p><strong>Steps</strong></p><p>${steps.replace(/\n/g, '<br>')}</p></body></html>`,
      }, env.RESEND_API_KEY, env.FROM_EMAIL || 'Prime Self <hello@primeself.app>');
    }

    log.info('bug_report_submitted', { bugId, userId, severity, category });
    return Response.json({ ok: true, bugId });
  } catch (error) {
    log.error('bug_report_submit_failed', { userId, error: error.message });
    return Response.json({ ok: false, error: 'Failed to submit bug report' }, { status: 500 });
  }
}