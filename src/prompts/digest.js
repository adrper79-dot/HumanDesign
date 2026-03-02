/**
 * SMS Transit Digest — Haiku 4.5 optimized
 *
 * Generates a concise 160-320 char SMS transit digest
 * for daily delivery via Telnyx.
 */

/**
 * Build a transit digest prompt for SMS delivery.
 *
 * @param {object} chartData — full chart from calculateFullChart()
 * @param {object} transitData — from getCurrentTransits()
 * @param {object} options — { maxChars: 320, tone: 'warm'|'direct' }
 * @returns {{ system: string, messages: Array, config: object }}
 */
export function buildDigestPrompt(chartData, transitData, options = {}) {
  const maxChars = options.maxChars || 320;
  const tone = options.tone || 'warm';

  const hdType = chartData.chart?.type || 'Unknown';
  const strategy = chartData.chart?.strategy || '';
  const authority = chartData.chart?.authority || '';

  // Collect today's notable transits
  const notableTransits = extractNotableTransits(transitData, chartData);

  const system = `You are a Prime Self transit messenger. You write ultra-concise daily
transit updates for SMS delivery (max ${maxChars} characters).

Rules:
- NEVER exceed ${maxChars} characters including spaces
- Lead with the most actionable transit of the day
- Reference the person's HD Type strategy in practical terms
- Tone: ${tone}, grounded, never fluffy
- No greetings, no sign-offs, no emojis
- Every word must earn its place
- Use the person's actual chart data — no generic horoscope language`;

  const userMessage = `Write today's transit SMS digest for this person:

HD Type: ${hdType}
Strategy: ${strategy}
Authority: ${authority}
Profile: ${chartData.chart?.profile || ''}

Today's notable transits:
${notableTransits.map(t => `- ${t}`).join('\n')}

Transit-natal aspects today:
${formatTransitAspects(transitData)}

Active transit gates matching natal:
${formatNatalMatches(transitData)}

Write the SMS message (max ${maxChars} chars):`;

  return {
    system,
    messages: [{ role: 'user', content: userMessage }],
    config: {
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 200,
      temperature: 0.6
    }
  };
}

/**
 * Build a weekly digest prompt (longer format, for email or push).
 */
export function buildWeeklyDigestPrompt(chartData, forecastData, options = {}) {
  const tone = options.tone || 'warm';

  const system = `You are a Prime Self weekly transit analyst. You write focused weekly
transit forecasts grounded in actual chart data.

Rules:
- 150-250 words maximum
- Lead with the week's dominant theme
- Highlight 2-3 key transits with specific dates
- Reference the person's HD strategy and authority
- Close with one practical suggestion
- Tone: ${tone}, grounded, actionable
- Never generic — every statement must reference actual chart positions`;

  const events = forecastData.events || [];
  const ingresses = events.filter(e => e.type === 'gate_ingress');
  const aspects = events.filter(e => e.type === 'exact_aspect');

  const userMessage = `Write this week's transit forecast for:

HD Type: ${chartData.chart?.type || 'Unknown'}
Strategy: ${chartData.chart?.strategy || ''}
Authority: ${chartData.chart?.authority || ''}
Profile: ${chartData.chart?.profile || ''}
Defined Centers: ${chartData.chart?.definedCenters?.join(', ') || 'unknown'}

This week's transit events:
${formatForecastEvents(events)}

Gate ingresses this week: ${ingresses.length}
Exact aspects this week: ${aspects.length}

Write the weekly digest:`;

  return {
    system,
    messages: [{ role: 'user', content: userMessage }],
    config: {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.6
    }
  };
}

// ─── Helpers ─────────────────────────────────────────────────

function extractNotableTransits(transitData, chartData) {
  const notes = [];

  if (transitData?.positions) {
    // Sun transit is always notable
    const sun = transitData.positions.Sun || transitData.positions.sun;
    if (sun) {
      notes.push(`Transit Sun at ${sun.sign || ''} ${(sun.degrees || sun.longitude || 0).toFixed(1)}°`);
    }

    // Moon for emotional tone
    const moon = transitData.positions.Moon || transitData.positions.moon;
    if (moon) {
      notes.push(`Transit Moon at ${moon.sign || ''} ${(moon.degrees || moon.longitude || 0).toFixed(1)}°`);
    }
  }

  // Gate activations matching natal
  if (transitData?.natalMatches?.length) {
    for (const match of transitData.natalMatches.slice(0, 3)) {
      notes.push(`Transit ${match.planet || match.body} activates your natal Gate ${match.gate}`);
    }
  }

  return notes;
}

function formatTransitAspects(transitData) {
  if (!transitData?.transitAspects?.length) return '(none today)';

  return transitData.transitAspects
    .slice(0, 5)
    .map(a => `${a.planet1 || a.transitPlanet} ${a.type} ${a.planet2 || a.natalPlanet} (orb ${a.orb?.toFixed(1)}°)`)
    .join('\n');
}

function formatNatalMatches(transitData) {
  if (!transitData?.natalMatches?.length) return '(none today)';

  return transitData.natalMatches
    .slice(0, 5)
    .map(m => `Gate ${m.gate} (${m.planet || m.body})`)
    .join(', ');
}

function formatForecastEvents(events) {
  if (!events.length) return '(no events this week)';

  return events
    .slice(0, 10)
    .map(e => {
      if (e.type === 'gate_ingress') {
        return `${e.date}: ${e.planet} enters Gate ${e.toGate}`;
      }
      if (e.type === 'exact_aspect') {
        return `${e.date}: ${e.planet1} ${e.aspectType} ${e.planet2}`;
      }
      return `${e.date}: ${e.description || e.type}`;
    })
    .join('\n');
}
