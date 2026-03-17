/**
 * Session Note Templates — Pre-built prompts for practitioners
 *
 * Routes:
 *   GET /api/practitioner/session-templates — List all templates
 *   POST /api/practitioner/session-templates/:templateId/hydrate — Hydrate template with client data
 */

import { createQueryFn, QUERIES } from '../db/queries.js';

// ─── Pre-built Templates ─────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'intake',
    name: 'Initial Intake',
    description: 'First session with a new client',
    sections: [
      { id: 'opening', label: 'Opening', prompt: 'How did they feel coming in? Any initial concerns?' },
      { id: 'chart_intro', label: 'Chart Overview', prompt: 'Walk through their chart type, strategy, authority, and defined centers. How do they resonate?' },
      { id: 'key_themes', label: 'Key Themes', prompt: 'What themes emerged in conversation?' },
      { id: 'blockers', label: 'Identified Blockers', prompt: 'What patterns or doubts are holding them back?' },
      { id: 'next_steps', label: 'Next Steps', prompt: 'What will they experiment with before next session?' },
    ],
  },
  {
    id: 'followup',
    name: 'Follow-up Session',
    description: 'Subsequent sessions to deepen practice',
    sections: [
      { id: 'recap', label: 'Recap from Last Session', prompt: 'What did they experiment with? What surprised them?' },
      { id: 'integrations', label: 'Integrations & Resistance', prompt: 'How are they living their design? What friction points emerged?' },
      { id: 'deepdive', label: 'Deep Dive (Today\'s Focus)', prompt: 'What core theme are we exploring today?' },
      { id: 'insights', label: 'Insights & Breakthroughs', prompt: 'What shifted in their understanding?' },
      { id: 'homework', label: 'Homework / Experiment', prompt: 'What will they practice or notice before next time?' },
    ],
  },
  {
    id: 'integration',
    name: 'Integration Check-in',
    description: 'Assess how client is applying their design',
    sections: [
      { id: 'context', label: 'Current Context', prompt: 'What\'s happening in their life right now?' },
      { id: 'application', label: 'How Are They Living Their Design?', prompt: 'Are they using their strategy? Are they honoring their authority?' },
      { id: 'wins', label: 'Wins & Successes', prompt: 'What\'s working? What feels aligned?' },
      { id: 'friction', label: 'Friction & Conditioning', prompt: 'Where is the old programming still running?' },
      { id: 'next_phase', label: 'Next Phase', prompt: 'What\'s the next level of embodiment?' },
    ],
  },
  {
    id: 'closing',
    name: 'Closing / Completion',
    description: 'Final session or major milestone reflection',
    sections: [
      { id: 'journey', label: 'Journey Overview', prompt: 'Reflect on the full arc of your work together. What has transformed?' },
      { id: 'anchors', label: 'Key Anchors & Practices', prompt: 'What are the non-negotiable practices they\'re taking forward?' },
      { id: 'intuition', label: 'Trust in Intuition', prompt: 'How has their trust in their inner knowing evolved?' },
      { id: 'next_chapter', label: 'Next Chapter', prompt: 'What\'s their vision for living from this design?' },
      { id: 'gratitude', label: 'Gratitude & Completion', prompt: 'Any final reflections or gratitude?' },
    ],
  },
];

// ─── Public Handler ──────────────────────────────────────────────

/**
 * GET /api/practitioner/session-templates
 * List all session note templates
 */
export async function handleListSessionTemplates(request) {
  return Response.json({
    ok: true,
    templates: TEMPLATES.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      sectionCount: t.sections.length,
    })),
    total: TEMPLATES.length,
  });
}

/**
 * GET /api/practitioner/session-templates/:templateId
 * Get full template with sections
 */
export async function handleGetSessionTemplate(request, templateId) {
  const template = TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    return Response.json({ error: 'Template not found' }, { status: 404 });
  }
  return Response.json({
    ok: true,
    template,
  });
}

/**
 * POST /api/practitioner/session-templates/:templateId/hydrate
 * Hydrate a template with client chart data
 * Body: { clientId, clientName, clientType, clientProfile, clientAuthority }
 */
export async function handleHydrateTemplate(request, env, templateId) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const template = TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    return Response.json({ error: 'Template not found' }, { status: 404 });
  }

  const { clientId, clientName, clientType, clientProfile, clientAuthority } = body;

  // Hydrate sections with client context (preserve prompt structure, add context hints)
  const hydratedTemplate = {
    id: template.id,
    name: template.name,
    description: template.description,
    client: {
      id: clientId,
      name: clientName || 'Your Client',
      type: clientType || 'Unknown',
      profile: clientProfile || 'N/A - Projector',
      authority: clientAuthority || 'Sacral',
    },
    sections: template.sections.map(s => ({
      id: s.id,
      label: s.label,
      prompt: s.prompt,
      context: generateContextHint(s.id, { clientType, clientProfile, clientAuthority }),
    })),
  };

  return Response.json({
    ok: true,
    template: hydratedTemplate,
    notes: 'Use these sections as a guide. Adapt prompts to the energy of the session and your client\'s unique journey.',
  });
}

/**
 * Generate context-specific hints based on client chart data
 */
function generateContextHint(sectionId, { clientType, clientProfile, clientAuthority }) {
  const hints = {
    'opening': `Remember their ${clientType || 'type'} strategy and ${clientAuthority || 'authority'} today.`,
    'chart_intro': `Their ${clientProfile || 'profile'} brings both clarity and potential blind spots. Notice what lands.`,
    'key_themes': `Look for patterns related to their ${clientType || 'type'}'s natural strengths and conditioning challenges.`,
    'blockers': `Often tied to ignoring their ${clientAuthority || 'authority'} or forcing a strategy that isn't theirs.`,
    'next_steps': `Ground their experiment in their ${clientAuthority || 'authority'} or natural ${clientType || 'strategy'} rhythm.`,
    'recap': `How did their experiment reveal more about their true ${clientAuthority || 'authority'}?`,
    'integrations': `Is the old ${clientType || 'not-self'} pattern still running, or are they living their design?`,
    'deepdive': `Let their ${clientProfile || 'profile'} guide the depth and pace of exploration.`,
    'insights': `Notice shifts in their language, tone, and trust of their own knowing.`,
    'homework': `Tie this to something their ${clientAuthority || 'authority'} wants to explore or an area of conditioning to watch.`,
    'application': `${clientType || 'Their type'} + ${clientAuthority || 'Their authority'} = their lived experience. How\'s that working?`,
    'wins': `Celebrate moments where they honored their design, big or small.`,
    'friction': `Recognize conditioning patterns without judgment. That\'s the work.`,
    'journey': `Their evolution from not-self to authentic self living — that\'s the real transformation.`,
    'anchors': `What practices keep them connected to their ${clientAuthority || 'authority'} and true ${clientType || 'type'} strategy?`,
  };
  return hints[sectionId] || '';
}
