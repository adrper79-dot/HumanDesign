/**
 * Onboarding / Savannah Narrative Endpoints
 *
 * Phase 6: Narrative Integration — Savannah's story mapped to the 5 Prime Self Forges.
 * Users experience Savannah's journey as they discover their own Forge.
 *
 * Routes:
 *   GET /api/onboarding/intro         — Public: Savannah's world + the 5 Forges overview
 *   GET /api/onboarding/forge         — Auth: Personalized arc for user's primary Forge (from latest profile)
 *   GET /api/onboarding/forge/:key    — Auth: Arc for a specific Forge (Chronos|Eros|Aether|Lux|Phoenix)
 *   GET /api/onboarding/chapter/:key/:n — Auth: Specific chapter (1-based index within forge)
 *   GET /api/onboarding/progress      — Auth: User's narrative progress across all active forges
 *   POST /api/onboarding/advance      — Auth: Mark a chapter as read, advance progress
 */

import { createQueryFn, QUERIES } from '../db/queries.js';

// KV key format for progress: onboarding:{userId}:{forge}:{chapterIndex} = "1"
// Summary key: onboarding:progress:{userId} = JSON

// ─── Narrative Data ─────────────────────────────────────────────
// Inline summary of SavannahNarrative — Worker-safe (no filesystem reads).
// Full data lives in src/knowledgebase/prime_self/savannah_narrative.json (KB reference).

const FORGE_SUMMARIES = {
  Chronos: {
    domain: 'Time',
    bookTitle: 'Book I: The Weight of Yesterday',
    bookTheme: 'Awakening to inherited patterns, ancestral programming, and the unconscious past that shapes the present',
    chapterCount: 5,
    openingHook: 'Savannah doesn\'t know yet that her family\'s repeated cycles — her sister\'s choices, her mother\'s silences, her own fierce ambition — are not accidents. They are echoes of a story that started long before any of them had a name.'
  },
  Eros: {
    domain: 'Passion',
    bookTitle: 'Book II: The Fire That Knows',
    bookTheme: 'Discovering the sacral response, the body\'s wisdom, and authentic life force vs. conditioned desire',
    chapterCount: 4,
    openingHook: 'Savannah has the answer before she has the question. The obsessive pull toward audio production — dismissed as impractical, naive, a distraction — turns out to be the most precise navigation system she possesses.'
  },
  Aether: {
    domain: 'Universal Connection',
    bookTitle: 'Book III: The Space Between',
    bookTheme: 'Embracing openness, undefined centers, and the power of being a mirror that sees environmental truth',
    chapterCount: 5,
    openingHook: 'Savannah has always been different in every room — shifting, adapting, taking on the temperature of whoever she\'s with. She has spent years calling this a flaw. She is about to discover it is a gift.'
  },
  Lux: {
    domain: 'Illumination',
    bookTitle: 'Book IV: The Guide\'s Burden',
    bookTheme: 'Learning to see others\' potential, earning the invitation, and bearing the weight of being a step ahead',
    chapterCount: 4,
    openingHook: 'Savannah already knows the answer. She can see exactly what needs to happen — for her classmate, for the investigation, for the community. The furious resistance she meets every time she offers this seeing without being asked is her invitation to learn the hardest lesson of the Lux Forge.'
  },
  Phoenix: {
    domain: 'Rebirth',
    bookTitle: 'Book V: Ash and Becoming',
    bookTheme: 'Radical transformation, the death of the old identity, and the emergence of the next version',
    chapterCount: 4,
    openingHook: 'The mission is complete. Prescott is exposed. Gloria is freed. What Savannah expected to feel — triumph, relief, finality — is instead a terrifying blankness. The story she organized her entire identity around is over. Who is she now?'
  }
};

const VALID_FORGES = Object.keys(FORGE_SUMMARIES);

// ─── Route Handler ───────────────────────────────────────────────

export async function handleOnboarding(request, env, subpath) {
  const method = request.method;
  const userId = request._user?.sub; // may be null for public routes

  // Public route
  if (subpath === '/intro' && method === 'GET') {
    return handleIntro();
  }

  // All remaining routes require auth
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);
  const kv = env.CACHE; // reuse KV namespace for progress tracking

  try {
    // GET /api/onboarding/forge — personalized forge arc from user's latest profile
    if (subpath === '/forge' && method === 'GET') {
      return handlePersonalizedForge(userId, query);
    }

    // GET /api/onboarding/progress
    if (subpath === '/progress' && method === 'GET') {
      return handleProgress(userId, kv);
    }

    // POST /api/onboarding/advance
    if (subpath === '/advance' && method === 'POST') {
      return handleAdvance(request, userId, kv);
    }

    // GET /api/onboarding/forge/:key
    const forgeMatch = subpath.match(/^\/forge\/([A-Za-z]+)$/);
    if (forgeMatch && method === 'GET') {
      return handleForgeArc(forgeMatch[1], userId, query);
    }

    // GET /api/onboarding/chapter/:key/:n
    const chapterMatch = subpath.match(/^\/chapter\/([A-Za-z]+)\/(\d+)$/);
    if (chapterMatch && method === 'GET') {
      return handleChapter(chapterMatch[1], parseInt(chapterMatch[2], 10), userId, query);
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  } catch (err) {
    console.error('[Onboarding] Unhandled error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Public: Intro ───────────────────────────────────────────────

function handleIntro() {
  return Response.json({
    ok: true,
    title: 'The Prime Self Journey',
    protagonist: {
      name: 'Savannah',
      description: 'A determined young woman navigating a gritty urban neighborhood, a family story full of unspoken weight, and a mysterious corruption that touches everything she loves. Her journey through the five Forges mirrors every person\'s path toward their Prime Self.'
    },
    premise: 'Savannah doesn\'t know she is living the Prime Self framework. She is just trying to understand her family, expose injustice, find her voice, and become who she came here to be. The five Forges are not a curriculum — they are the chapters of her life. And yours.',
    forges: FORGE_SUMMARIES,
    totalChapters: 22,
    userMessage: 'When you generate your Prime Self Profile, Savannah\'s story will be personalized to your primary Forge. You will experience her journey through the same lens you view your own.'
  });
}

// ─── Auth: Personalized forge arc from user's profile ────────────

async function handlePersonalizedForge(userId, query) {
  // Get latest profile to find primary forge
  const profileResult = await query(QUERIES.getLatestProfile, [userId]);
  if (!profileResult.rows?.length) {
    return Response.json({
      error: 'No profile found',
      message: 'Generate your Prime Self Profile first at POST /api/profile/generate to unlock your personalized Savannah narrative.'
    }, { status: 404 });
  }

  const profileRow = profileResult.rows[0];
  const profileData = typeof profileRow.profile_json === 'string'
    ? JSON.parse(profileRow.profile_json)
    : profileRow.profile_json;

  const forgeName = profileData?.primaryForge?.forge;
  if (!forgeName || !FORGE_SUMMARIES[forgeName]) {
    return Response.json({
      error: 'Forge not identified',
      message: 'Your profile does not yet contain a primary Forge identification. Regenerate your profile for an updated reading.',
      availableForges: VALID_FORGES
    }, { status: 400 });
  }

  return buildForgeResponse(forgeName, profileData?.primaryForge);
}

// ─── Auth: Specific forge arc ─────────────────────────────────────

async function handleForgeArc(forgeKey, userId, query) {
  const normalizedKey = capitalize(forgeKey.toLowerCase());

  if (!FORGE_SUMMARIES[normalizedKey]) {
    return Response.json({
      error: `Unknown forge: ${forgeKey}`,
      validForges: VALID_FORGES
    }, { status: 400 });
  }

  return buildForgeResponse(normalizedKey, null);
}

// ─── Auth: Specific chapter ───────────────────────────────────────

async function handleChapter(forgeKey, chapterIndex, userId, query) {
  const normalizedKey = capitalize(forgeKey.toLowerCase());
  const summary = FORGE_SUMMARIES[normalizedKey];

  if (!summary) {
    return Response.json({ error: `Unknown forge: ${forgeKey}`, validForges: VALID_FORGES }, { status: 400 });
  }

  // chapterIndex is 1-based within the forge
  if (chapterIndex < 1 || chapterIndex > summary.chapterCount) {
    return Response.json({
      error: `Chapter index out of range`,
      forge: normalizedKey,
      chapterCount: summary.chapterCount,
      requested: chapterIndex
    }, { status: 400 });
  }

  return Response.json({
    ok: true,
    forge: normalizedKey,
    bookTitle: summary.bookTitle,
    chapterIndexInForge: chapterIndex,
    chapterCount: summary.chapterCount,
    note: 'Full chapter content available in the Prime Self app. This API returns structured chapter metadata.',
    forgeTeaching: buildForgeTeachingNote(normalizedKey, chapterIndex)
  });
}

// ─── Auth: Progress (KV-backed) ──────────────────────────────────

async function handleProgress(userId, kv) {
  const progress = {};
  let totalRead = 0;

  // Collect all KV keys up front for a single parallel batch
  const kvRequests = [];
  for (const forge of VALID_FORGES) {
    const total = FORGE_SUMMARIES[forge].chapterCount;
    for (let i = 1; i <= total; i++) {
      kvRequests.push({ forge, index: i, key: `onboarding:${userId}:${forge}:${i}` });
    }
  }

  // Fetch all chapter-read flags in parallel (was N+1 sequential reads)
  const values = await Promise.all(kvRequests.map(r => kv.get(r.key)));

  // Tally results per forge
  const forgeCounts = {};
  for (const forge of VALID_FORGES) {
    forgeCounts[forge] = 0;
  }
  kvRequests.forEach((r, idx) => {
    if (values[idx] === '1') forgeCounts[r.forge]++;
  });

  for (const forge of VALID_FORGES) {
    const total = FORGE_SUMMARIES[forge].chapterCount;
    const chaptersRead = forgeCounts[forge];
    totalRead += chaptersRead;
    progress[forge] = {
      chaptersRead,
      total,
      percentComplete: Math.round((chaptersRead / total) * 100),
      started: chaptersRead > 0,
      complete: chaptersRead >= total
    };
  }

  return Response.json({
    ok: true,
    totalChapters: 22,
    totalRead,
    percentComplete: Math.round((totalRead / 22) * 100),
    forges: progress
  });
}

// ─── Auth: Advance (mark chapter read, KV-backed) ─────────────────

async function handleAdvance(request, userId, kv) {
  const body = await request.json().catch(() => ({}));
  const { forge, chapterIndex } = body;

  const normalizedForge = capitalize((forge || '').toLowerCase());
  if (!FORGE_SUMMARIES[normalizedForge]) {
    return Response.json({ error: 'Invalid forge', validForges: VALID_FORGES }, { status: 400 });
  }

  const summary = FORGE_SUMMARIES[normalizedForge];
  const idx = parseInt(chapterIndex, 10);
  if (!idx || idx < 1 || idx > summary.chapterCount) {
    return Response.json({
      error: 'Invalid chapterIndex',
      forge: normalizedForge,
      chapterCount: summary.chapterCount
    }, { status: 400 });
  }

  // Store in KV with 365-day TTL
  await kv.put(`onboarding:${userId}:${normalizedForge}:${idx}`, '1', { expirationTtl: 365 * 24 * 3600 });

  return Response.json({
    ok: true,
    message: `Marked ${normalizedForge} chapter ${idx} as read`,
    nextChapter: idx < summary.chapterCount ? idx + 1 : null,
    forgeComplete: idx >= summary.chapterCount
  });
}

// ─── Helpers ──────────────────────────────────────────────────────

function buildForgeResponse(forgeName, forgeData) {
  const summary = FORGE_SUMMARIES[forgeName];
  return Response.json({
    ok: true,
    forge: forgeName,
    ...summary,
    userForgeContext: forgeData ? {
      identifiedForge: forgeName,
      domain: forgeData.domain,
      description: forgeData.description,
      practicalGuidance: forgeData.practicalGuidance
    } : null,
    chapters: Array.from({ length: summary.chapterCount }, (_, i) => ({
      index: i + 1,
      path: `/api/onboarding/chapter/${forgeName}/${i + 1}`
    }))
  });
}

function buildForgeTeachingNote(forge, chapterIndex) {
  const teachings = {
    Chronos: ['Recognition of the pattern', 'Ancestral inheritance as information', 'The unconscious Design-side', 'Saturn accountability', 'Claiming the chart with ownership'],
    Eros: ['Sacral recognition', 'Conditioned vs. authentic desire', 'Selective response', 'Integration of past forges'],
    Aether: ['Open center as perception gift', 'Lunar timing as intelligence', 'The conditioned mirror trap', 'Clear perception dissolves false authority', 'Ground state as signal'],
    Lux: ['The invitation principle', 'Recognition before direction', 'The Projector shadow: bitterness', 'Evidence was always present'],
    Phoenix: ['Identity dissolution', 'Chrysalis consciousness', 'New self has different appetites', 'Integration of all five Forges']
  };
  const arr = teachings[forge] || [];
  return arr[chapterIndex - 1] || `${forge} Forge teaching ${chapterIndex}`;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
