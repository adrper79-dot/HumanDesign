/**
 * POST /api/rectify
 *
 * Birth-time sensitivity analysis / rectification assistant.
 *
 * Takes an approximate birth time and a ±window, then calculates
 * charts at intervals across the window to show what changes:
 *   - Type (most critical — does the person become a different Type?)
 *   - Authority (does it shift?)
 *   - Profile (do the lines change?)
 *   - Incarnation Cross (do the gate numbers change?)
 *   - Defined channels (which appear/disappear?)
 *   - Ascendant sign (astrology, highly time-sensitive)
 *
 * This helps users with uncertain birth times understand which
 * chart elements are stable and which are sensitive.
 *
 * Request body:
 * {
 *   birthDate: "1979-08-05",
 *   birthTime: "18:51",         // Approximate time
 *   birthTimezone: "America/New_York",
 *   lat: 27.9506,
 *   lng: -82.4572,
 *   windowMinutes: 30,          // ± window (default 30, max 120)
 *   stepMinutes: 5              // Step interval (default 5, min 1, max 15)
 * }
 *
 * Response:
 * {
 *   ok: true,
 *   rectificationId: "uuid",    // Use to poll /api/rectify/:id for progress
 *   percentComplete: 0          // Initial progress
 * }
 *
 * GET /api/rectify/:rectificationId
 * Returns current progress and result (when complete)
 */

import { calculateFullChart } from '../../../src/engine/index.js';
import { parseToUTC } from '../utils/parseToUTC.js';
import { getUserFromRequest } from '../middleware/auth.js';
import { createQueryFn, QUERIES } from '../db/queries.js';

/**
 * Extract key chart fingerprint for comparison.
 */
function fingerprint(chart) {
  return {
    type: chart.chart.type,
    authority: chart.chart.authority,
    profile: chart.chart.profile,
    definition: chart.chart.definition,
    crossGates: chart.chart.cross.gates.join(','),
    crossType: chart.chart.cross.type,
    definedCenters: chart.chart.definedCenters.sort().join(','),
    channels: chart.chart.activeChannels.map(c => c.channel).sort().join(','),
    ascendant: chart.astrology?.ascendant?.sign || '',
    sunGate: chart.personalityGates?.conscious?.sun?.gate,
    moonGate: chart.personalityGates?.conscious?.moon?.gate
  };
}

/**
 * Compare two fingerprints and return list of differences.
 */
function diffFingerprints(base, test, offsetLabel) {
  const diffs = [];

  if (base.type !== test.type) {
    diffs.push({ field: 'type', base: base.type, test: test.type, severity: 'critical' });
  }
  if (base.authority !== test.authority) {
    diffs.push({ field: 'authority', base: base.authority, test: test.authority, severity: 'high' });
  }
  if (base.profile !== test.profile) {
    diffs.push({ field: 'profile', base: base.profile, test: test.profile, severity: 'high' });
  }
  if (base.definition !== test.definition) {
    diffs.push({ field: 'definition', base: base.definition, test: test.definition, severity: 'medium' });
  }
  if (base.crossGates !== test.crossGates) {
    diffs.push({ field: 'crossGates', base: base.crossGates, test: test.crossGates, severity: 'high' });
  }
  if (base.channels !== test.channels) {
    diffs.push({ field: 'channels', base: base.channels, test: test.channels, severity: 'medium' });
  }
  if (base.definedCenters !== test.definedCenters) {
    diffs.push({ field: 'definedCenters', base: base.definedCenters, test: test.definedCenters, severity: 'medium' });
  }
  if (base.ascendant !== test.ascendant) {
    diffs.push({ field: 'ascendant', base: base.ascendant, test: test.ascendant, severity: 'low' });
  }
  if (base.sunGate !== test.sunGate) {
    diffs.push({ field: 'sunGate', base: base.sunGate, test: test.sunGate, severity: 'high' });
  }
  if (base.moonGate !== test.moonGate) {
    diffs.push({ field: 'moonGate', base: base.moonGate, test: test.moonGate, severity: 'low' });
  }

  return diffs;
}

export async function handleRectify(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Validate params FIRST (before auth check) so client gets meaningful error
  // BL-BACKEND-P1-2: Return 400 for missing params, not 401 from auth
  for (const field of ['birthDate', 'birthTime', 'lat', 'lng']) {
    if (body[field] === undefined || body[field] === null) {
      return Response.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  // BL-BACKEND-P1-2: Authenticate AFTER param validation
  const user = await getUserFromRequest(request, env);
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const { birthDate, birthTime, birthTimezone, lat, lng } = body;
  const windowMinutes = Math.min(120, Math.max(5, parseInt(body.windowMinutes || '30', 10)));
  const stepMinutes = Math.min(15, Math.max(1, parseInt(body.stepMinutes || '5', 10)));

  // Create rectification record in DB (if available)
  let rectificationId = null;
  let query = null;
  const totalSteps = Math.floor((windowMinutes * 2) / stepMinutes) + 1;

  try {
    // Only initialize DB if connection string exists (production)
    if (env.NEON_CONNECTION_STRING && env.NEON_CONNECTION_STRING.includes('postgresql://')) {
      query = createQueryFn(env);
      rectificationId = crypto.randomUUID();

      // Insert initial record with status 'in_progress'
      await query(
        `INSERT INTO birthtime_rectifications
          (id, user_id, birth_date, birth_time, birth_timezone, lat, lng, window_minutes, step_minutes, total_steps, percent_complete)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [rectificationId, user.id, birthDate, birthTime, birthTimezone, lat, lng, windowMinutes, stepMinutes, totalSteps, 0]
      );
    }
  } catch (err) {
    // DB not available — continue with calculation only (test/fallback mode)
    console.warn('Rectification DB storage unavailable, proceeding with calculation only', err.message);
    query = null;
  }

  // Calculate the base chart (at the stated birth time)
  const baseUTC = parseToUTC(birthDate, birthTime, birthTimezone);
  const baseChart = calculateFullChart({
    ...baseUTC,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    includeTransits: false
  });
  const baseFP = fingerprint(baseChart);

  // Calculate charts across the sensitivity window
  const snapshots = [];

  for (let i = 0; i <= totalSteps - 1; i++) {
    const offsetMinutes = -windowMinutes + (i * stepMinutes);
    const totalMins = baseUTC.hour * 60 + baseUTC.minute + offsetMinutes;

    let snapHour = Math.floor(totalMins / 60);
    let snapMinute = totalMins % 60;
    let snapDay = baseUTC.day;
    let snapMonth = baseUTC.month;
    let snapYear = baseUTC.year;

    if (snapHour >= 24) { snapHour -= 24; snapDay++; }
    if (snapHour < 0) { snapHour += 24; snapDay--; }
    if (snapMinute < 0) { snapMinute += 60; snapHour--; }

    // Simplified day overflow — acceptable for ±120min window
    const daysInMonth = new Date(snapYear, snapMonth, 0).getDate();
    if (snapDay > daysInMonth) { snapDay = 1; snapMonth++; }
    if (snapDay < 1) { snapMonth--; snapDay = new Date(snapYear, snapMonth, 0).getDate(); }

    const chart = calculateFullChart({
      year: snapYear, month: snapMonth, day: snapDay,
      hour: snapHour, minute: snapMinute, second: 0,
      lat: parseFloat(lat), lng: parseFloat(lng),
      includeTransits: false
    });

    const fp = fingerprint(chart);
    const diffs = diffFingerprints(baseFP, fp, `${offsetMinutes >= 0 ? '+' : ''}${offsetMinutes}min`);

    snapshots.push({
      offset: offsetMinutes,
      label: `${offsetMinutes >= 0 ? '+' : ''}${offsetMinutes} min`,
      time: `${String(snapHour).padStart(2, '0')}:${String(snapMinute).padStart(2, '0')} UTC`,
      type: fp.type,
      authority: fp.authority,
      profile: fp.profile,
      definition: fp.definition,
      ascendant: fp.ascendant,
      crossGates: fp.crossGates,
      sunGate: fp.sunGate,
      changes: diffs.length,
      diffs: diffs.length > 0 ? diffs : undefined
    });

    // Update progress in DB every 5 snapshots (avoid excessive DB writes)
    if (query && (i % 5 === 0 || i === totalSteps - 1)) {
      const percentComplete = Math.round((i / (totalSteps - 1)) * 100);
      await query(
        `UPDATE birthtime_rectifications SET percent_complete = $1 WHERE id = $2`,
        [percentComplete, rectificationId]
      );
    }
  }

  // Summarize sensitivity
  const criticalChanges = snapshots.filter(s => s.diffs?.some(d => d.severity === 'critical'));
  const highChanges = snapshots.filter(s => s.diffs?.some(d => d.severity === 'high'));
  const stableRange = findStableRange(snapshots);

  const result = {
    ok: true,
    baseChart: {
      type: baseFP.type,
      authority: baseFP.authority,
      profile: baseFP.profile,
      definition: baseFP.definition,
      cross: baseChart.chart.cross,
      ascendant: baseFP.ascendant,
      sunGate: baseFP.sunGate,
      moonGate: baseFP.moonGate
    },
    sensitivity: {
      window: `±${windowMinutes} minutes`,
      step: `${stepMinutes} minutes`,
      totalSnapshots: snapshots.length,
      stableRange,
      criticalChangePoints: criticalChanges.length,
      highChangePoints: highChanges.length
    },
    snapshots,
    guidance: buildGuidance(criticalChanges, highChanges, stableRange, windowMinutes),
    meta: {
      calculatedAt: new Date().toISOString()
    }
  };

  // Store complete result in DB if available
  if (query && rectificationId) {
    await query(
      `UPDATE birthtime_rectifications
       SET result = $1, percent_complete = 100, status = 'completed', completed_at = now()
       WHERE id = $2`,
      [JSON.stringify(result), rectificationId]
    );
  }

  const response = {
    ok: true,
    ...result
  };

  // Add rectificationId if DB was available
  if (rectificationId) {
    response.rectificationId = rectificationId;
    response.percentComplete = 100;
  }

  return Response.json(response);
}

/**
 * GET /api/rectify
 *
 * List user's rectification analyses with pagination.
 *
 * Query parameters:
 *   limit (optional, default 10): Number of results to return
 *   offset (optional, default 0): Pagination offset
 *
 * Response:
 * {
 *   ok: true,
 *   rectifications: [
 *     {
 *       id: "uuid",
 *       birthDate: "1979-08-05",
 *       birthTime: "18:51",
 *       window: "±30 min",
 *       totalSnapshots: 13,
 *       sensitivity: "moderate",
 *       createdAt: "2026-03-18T14:30:00Z",
 *       completedAt: "2026-03-18T14:31:30Z"
 *     }
 *   ],
 *   totalCount: 42,
 *   limit: 10,
 *   offset: 0
 * }
 */
export async function handleListRectifications(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '10', 10));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

  try {
    const query = createQueryFn(env);

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM birthtime_rectifications WHERE user_id = $1`,
      [user.id]
    );
    const totalCount = parseInt(countResult[0].total, 10);

    // Get paginated results
    const rows = await query(
      `SELECT id, birth_date, birth_time, window_minutes, total_steps, status,
              created_at, completed_at, result
       FROM birthtime_rectifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    const rectifications = rows.map(row => {
      let sensitivity = 'unknown';
      if (row.result) {
        try {
          const result = JSON.parse(row.result);
          if (result.sensitivity) {
            const changes = result.sensitivity.criticalChangePoints;
            sensitivity = changes > 0 ? 'critical' : result.sensitivity.highChangePoints > 0 ? 'high' : 'low';
          }
        } catch (e) {
          // Silently ignore parse errors
        }
      }

      return {
        id: row.id,
        birthDate: row.birth_date,
        birthTime: row.birth_time,
        window: `±${row.window_minutes} min`,
        totalSnapshots: row.total_steps,
        status: row.status,
        sensitivity,
        createdAt: row.created_at,
        completedAt: row.completed_at
      };
    });

    return Response.json({
      ok: true,
      rectifications,
      totalCount,
      limit,
      offset
    });
  } catch (err) {
    console.warn('Error listing rectifications:', err.message);
    return Response.json(
      { error: 'Failed to retrieve rectification history' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rectify/:rectificationId
 *
 * Retrieve progress and result of a birthtime rectification analysis.
 *
 * Response:
 * {
 *   ok: true,
 *   rectificationId: "uuid",
 *   percentComplete: 0-100,
 *   status: "in_progress" | "completed" | "failed",
 *   result: { ... },     // Populated when status = "completed"
 *   error: "..."         // Populated when status = "failed"
 * }
 */
export async function handleGetRectify(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

  // Extract rectificationId from path
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const rectificationId = pathParts[pathParts.length - 1];

  if (!rectificationId || rectificationId === 'undefined') {
    return Response.json({ error: 'Missing rectificationId' }, { status: 400 });
  }

  const query = createQueryFn(env);
  const rows = await query(
    `SELECT id, percent_complete, status, result, error_message
     FROM birthtime_rectifications
     WHERE id = $1 AND user_id = $2`,
    [rectificationId, user.id]
  );

  if (rows.length === 0) {
    return Response.json({ error: 'Rectification not found' }, { status: 404 });
  }

  const record = rows[0];
  const response = {
    ok: true,
    rectificationId,
    percentComplete: record.percent_complete,
    status: record.status
  };

  if (record.result) {
    response.result = JSON.parse(record.result);
  }

  if (record.error_message) {
    response.error = record.error_message;
  }

  return Response.json(response);
}

/**
 * Find the longest contiguous range where no changes occur.
 */
function findStableRange(snapshots) {
  let maxStart = 0, maxLen = 0;
  let curStart = 0, curLen = 0;

  for (let i = 0; i < snapshots.length; i++) {
    if (snapshots[i].changes === 0) {
      if (curLen === 0) curStart = i;
      curLen++;
      if (curLen > maxLen) {
        maxLen = curLen;
        maxStart = curStart;
      }
    } else {
      curLen = 0;
    }
  }

  if (maxLen === 0) return 'No stable range found — chart is highly time-sensitive.';

  const start = snapshots[maxStart];
  const end = snapshots[maxStart + maxLen - 1];
  return `${start.label} to ${end.label} (${maxLen} steps, all chart elements stable)`;
}

/**
 * Build human-readable guidance based on sensitivity analysis.
 */
function buildGuidance(criticalChanges, highChanges, stableRange, windowMinutes) {
  const lines = [];

  if (criticalChanges.length === 0 && highChanges.length === 0) {
    lines.push(`Your chart is stable across the entire ±${windowMinutes}-minute window. ` +
      `Even with birth time uncertainty, your Type, Authority, Profile, and Cross remain the same.`);
    lines.push('Confidence: HIGH — birth time precision is not critical for your chart.');
  } else if (criticalChanges.length > 0) {
    lines.push(`Your Type changes within this window! This means birth time precision is CRITICAL. ` +
      `At some points you could be a different Type entirely.`);
    lines.push(`Consider: life events that validate your Strategy and Authority can help confirm the correct time.`);
    lines.push('Confidence: LOW — seek birth certificate or hospital records for exact time.');
  } else if (highChanges.length > 0) {
    lines.push(`Your Type stays the same, but Profile or Cross gates shift within ±${windowMinutes} minutes. ` +
      `This affects your life theme and genetic continuity.`);
    lines.push(`The stable range is: ${stableRange}`);
    lines.push('Confidence: MEDIUM — the core design is clear, but details may vary.');
  }

  return lines;
}
