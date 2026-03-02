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
 */

import { calculateFullChart } from '../../../src/engine/index.js';
import { parseToUTC } from '../utils/parseToUTC.js';

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
  const body = await request.json();

  // Validate
  for (const field of ['birthDate', 'birthTime', 'lat', 'lng']) {
    if (body[field] === undefined || body[field] === null) {
      return Response.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const { birthDate, birthTime, birthTimezone, lat, lng } = body;
  const windowMinutes = Math.min(120, Math.max(5, parseInt(body.windowMinutes || '30', 10)));
  const stepMinutes = Math.min(15, Math.max(1, parseInt(body.stepMinutes || '5', 10)));

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
  const totalSteps = Math.floor((windowMinutes * 2) / stepMinutes);

  for (let i = 0; i <= totalSteps; i++) {
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
  }

  // Summarize sensitivity
  const criticalChanges = snapshots.filter(s => s.diffs?.some(d => d.severity === 'critical'));
  const highChanges = snapshots.filter(s => s.diffs?.some(d => d.severity === 'high'));
  const stableRange = findStableRange(snapshots);

  return Response.json({
    success: true,
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
  });
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
