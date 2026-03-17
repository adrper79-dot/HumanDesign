/**
 * Practitioner Profile SSR — Server-side rendered profiles with OG tags
 *
 * Routes:
 *   GET /api/practitioner/:username/profile — SSR public profile (HTML + OG tags)
 *   GET /api/practitioner/:username/profile.json — JSON-only (for API consumers)
 *
 * Purpose: Enable discovery via search engines, social media shares
 * - OG tags for Twitter/LinkedIn previews
 * - Server-rendered HTML for fast first paint
 * - Mobile-responsive layout
 */

import { createQueryFn, QUERIES } from '../db/queries.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * GET /api/practitioner/:username/profile
 * Return server-rendered profile HTML with OG tags
 */
export async function handleGetPractitionerProfileSSR(request, env, username) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    // Query practitioner by username
    const result = await query(
      `SELECT p.id, p.user_id, p.username, p.display_name, p.bio, p.tier, p.is_public,
              u.email, u.created_at,
              (SELECT COUNT(*) FROM practitioners_invitations WHERE practitioner_id = p.id AND status = 'accepted') as client_count
       FROM practitioners p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.username = $1 AND p.is_public = true
       LIMIT 1`,
      [username]
    );

    if (!result.rows || result.rows.length === 0) {
      return Response.json(
        { error: 'Practitioner not found or profile is private' },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const practitioner = result.rows[0];

    // Generate OG tags
    const baseUrl = 'https://selfprime.net';
    const profileUrl = `${baseUrl}/practitioner/${practitioner.username}`;
    const displayName = escapeHtml(practitioner.display_name || practitioner.username);
    const bio = escapeHtml(practitioner.bio || 'Energy Blueprint practitioner on Prime Self');
    const ogImage = `${baseUrl}/og-practitioner.png`; // Static image (can be customized per practitioner later)

    // Server-render HTML with OG tags
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${displayName} — Energy Blueprint Practitioner | Prime Self</title>
  
  <!-- OG Tags (Twitter, LinkedIn, Facebook) -->
  <meta property="og:type" content="profile">
  <meta property="og:url" content="${profileUrl}">
  <meta property="og:title" content="${displayName} — Energy Blueprint Practitioner">
  <meta property="og:description" content="${bio}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:alt" content="${displayName}'s profile">
  <meta property="og:site_name" content="Prime Self">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${profileUrl}">
  <meta name="twitter:title" content="${displayName} — Energy Blueprint Practitioner">
  <meta name="twitter:description" content="${bio}">
  <meta name="twitter:image" content="${ogImage}">
  <meta name="twitter:site" content="@PrimeSelfApp">
  
  <!-- LinkedIn specific -->
  <meta property="og:locale" content="en_US">
  
  <!-- Canonical & Robots -->
  <link rel="canonical" href="${profileUrl}">
  <meta name="robots" content="index, follow">
  <meta name="description" content="${bio}">
  
  <!-- Redirect to frontend SPA for full interaction -->
  <script>
    // Parse current URL to detect if this is a bot crawl (User-Agent)
    const ua = navigator.userAgent || '';
    const isBotCrawl = /bot|crawler|spider|scraper|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram|slack/i.test(ua);
    
    if (!isBotCrawl) {
      // Redirect human users to SPA for dynamic interaction
      window.location.replace('/#/practitioner/${practitioner.username}');
    }
  </script>
  
  <!-- Minimal styling for bots + slow connections -->
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0e27; color: #e0e0e0; }
    .container { max-width: 600px; margin: 40px auto; padding: 20px; text-align: center; }
    h1 { font-size: 28px; margin-bottom: 10px; color: #ffd700; }
    p { font-size: 16px; line-height: 1.6; margin: 10px 0; color: #b0b0b0; }
    .meta { font-size: 14px; color: #808080; margin-top: 20px; }
    .cta { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #ffd700; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold; transition: 0.2s; }
    .cta:hover { background: #ffed4e; }
    @media (max-width: 640px) {
      .container { margin: 20px auto; padding: 15px; }
      h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${displayName}</h1>
    <p>${bio}</p>
    <div class="meta">
      <p>Tier: <strong>${practitioner.tier || 'Practitioner'}</strong></p>
      <p>Clients: <strong>${practitioner.client_count || 0}</strong></p>
    </div>
    <a href="/#/practitioner/${practitioner.username}" class="cta">View Full Profile</a>
    <p style="margin-top: 40px; font-size: 12px; color: #606060;">Redirecting to Prime Self...</p>
  </div>
  
  <!-- Backup redirect if JS disabled -->
  <noscript>
    <meta http-equiv="refresh" content="0; url=/#/practitioner/${practitioner.username}">
  </noscript>
</body>
</html>
    `.trim();

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour (profile edits are rare)
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error(JSON.stringify({ event: 'practitioner_profile_ssr_error', error: err.message }));
    return Response.json(
      { error: 'Service temporarily unavailable' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/practitioner/:username/profile.json
 * Return JSON-only profile (for API consumers, no HTML)
 */
export async function handleGetPractitionerProfileJSON(request, env, username) {
  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  try {
    const result = await query(
      `SELECT p.id, p.user_id, p.username, p.display_name, p.bio, p.tier, p.is_public,
              u.email, u.created_at,
              (SELECT COUNT(*) FROM practitioners_invitations WHERE practitioner_id = p.id AND status = 'accepted') as client_count
       FROM practitioners p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.username = $1 AND p.is_public = true
       LIMIT 1`,
      [username]
    );

    if (!result.rows || result.rows.length === 0) {
      return Response.json(
        { error: 'Practitioner not found or profile is private' },
        { status: 404 }
      );
    }

    const practitioner = result.rows[0];

    return Response.json({
      ok: true,
      profile: {
        id: practitioner.id,
        username: practitioner.username,
        displayName: practitioner.display_name,
        bio: practitioner.bio,
        tier: practitioner.tier,
        clientCount: parseInt(practitioner.client_count || '0', 10),
        createdAt: practitioner.created_at,
        shareUrl: `https://selfprime.net/#/practitioner/${practitioner.username}`,
      },
    });
  } catch (err) {
    console.error(JSON.stringify({ event: 'practitioner_profile_json_error', error: err.message }));
    return Response.json(
      { error: 'Service temporarily unavailable' },
      { status: 500 }
    );
  }
}
