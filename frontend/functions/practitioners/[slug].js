/**
 * Cloudflare Pages Function — /practitioners/:slug
 *
 * CMO-002: Server-renders meta tags for practitioner profiles so Google can
 * index them. Returns a lightweight public profile page with OG/Twitter/JSON-LD
 * metadata rather than redirecting users into an incomplete SPA route.
 */

const SITE_URL = 'https://selfprime.net';

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export async function onRequestGet({ params, request }) {
  const slug = params.slug;
  const origin = new URL(request.url).origin;
  const apiBase = origin;

  // Validate slug format before hitting the API
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return Response.redirect(`${origin}/`, 302);
  }

  let practitioner;
  try {
    const res = await fetch(`${apiBase}/api/directory/${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return Response.redirect(`${origin}/`, 302);
    const data = await res.json();
    practitioner = data.practitioner;
    if (!practitioner) return Response.redirect(`${origin}/`, 302);
  } catch {
    return Response.redirect(`${origin}/`, 302);
  }

  const name        = practitioner.display_name || 'Practitioner';
  const firstName   = name.split(/\s+/)[0];
  const bio         = (practitioner.bio || '').slice(0, 155);
  const description = bio || `${name} is an Energy Blueprint practitioner on Prime Self.`;
  const profileUrl  = `${origin}/practitioners/${slug}`;
  const imageUrl    = practitioner.photo_url || `${origin}/og-image.png`;

  const specializationsArr = Array.isArray(practitioner.specializations)
    ? practitioner.specializations
    : [];
  const specializations = specializationsArr.join(', ');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    description,
    url: profileUrl,
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(practitioner.booking_url ? { url: practitioner.booking_url } : {}),
    knowsAbout: specializations || 'Energy Blueprint',
    worksFor: { '@type': 'Organization', name: 'Prime Self', url: origin },
  };

  // Build reusable HTML fragments
  const certificationBadge = practitioner.certification
    ? `<span style="display:inline-block;margin-top:0.35rem;padding:0.2rem 0.6rem;background:rgba(201,168,76,0.12);color:var(--gold,#c9a84c);border:1px solid var(--gold,#c9a84c);border-radius:4px;font-size:0.8rem;font-weight:500">${escapeHtml(practitioner.certification)}</span>`
    : '';

  const specializationPills = specializationsArr.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.75rem">${
        specializationsArr.map(s =>
          `<span style="padding:0.2rem 0.6rem;background:#f0f0f0;border-radius:4px;font-size:0.82em;color:#555">${escapeHtml(s)}</span>`
        ).join('')
      }</div>`
    : '';

  const sessionInfo = practitioner.session_format
    ? `<div style="margin-top:0.5rem;font-size:0.85em;color:#888">${escapeHtml(practitioner.session_format)}</div>`
    : '';

  const bookingCta = practitioner.booking_url
    ? `<div style="text-align:center;padding:0.5rem 0 0.25rem">
  <p style="color:#888;font-size:0.9rem;margin:0 0 0.5rem">Already know your chart?</p>
  <a href="${escapeHtml(practitioner.booking_url)}" rel="noopener noreferrer"
     style="color:var(--gold,#c9a84c);text-decoration:none;font-size:0.95rem;border-bottom:1px solid var(--gold,#c9a84c)">
    Book a session directly &rarr;
  </a>
</div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(name)} — Energy Blueprint Practitioner | Prime Self</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(profileUrl)}">

  <!-- Open Graph -->
  <meta property="og:type" content="profile">
  <meta property="og:title" content="${escapeHtml(name)} — Energy Blueprint Practitioner">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(profileUrl)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:site_name" content="Prime Self">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(name)} — Energy Blueprint Practitioner">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">

  <!-- JSON-LD Person schema -->
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    :root { --gold: #c9a84c; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 3rem auto; padding: 0 1rem; color: #1a1a2e; background: #fafafa; }
    a { color: var(--gold); }
    .card { background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; padding: 1.25rem 1.5rem; margin-bottom: 1rem; }
    .footer { text-align: center; margin-top: 2rem; font-size: 0.8em; color: #aaa; }
    .footer a { color: #aaa; text-decoration: none; border-bottom: 1px solid #ddd; }
  </style>
</head>
<body>

  <!-- Practitioner hero -->
  <div class="card">
    <h1 style="margin:0 0 0.25rem">${escapeHtml(name)}</h1>
    ${certificationBadge}
    <p style="margin:0.75rem 0 0;color:#444;line-height:1.6">${escapeHtml(description)}</p>
    ${specializationPills}
    ${sessionInfo}
  </div>

  <!-- Primary CTA — chart funnel -->
  <div class="card" style="border:2px solid var(--gold,#c9a84c);text-align:center">
    <h2 style="margin:0 0 0.5rem;font-size:1.2rem">Start by seeing what ${escapeHtml(firstName)} sees</h2>
    <p style="color:#888;margin:0 0 1.25rem;font-size:0.95rem">
      Generate your free Energy Blueprint chart — then book a session and ${escapeHtml(firstName)}
      can show you exactly what it means for your life, decisions, and relationships.
    </p>
    <a href="${escapeHtml(origin)}/?ref=${encodeURIComponent(slug)}"
       style="display:inline-block;background:var(--gold,#c9a84c);color:#000;padding:0.75rem 1.5rem;border-radius:6px;text-decoration:none;font-weight:600;font-size:1rem;margin-bottom:1rem">
      Calculate My Free Chart &rarr;
    </a>
    <p style="margin:0;font-size:0.82em;color:#888">Free &middot; No account required to start &middot; Takes 60 seconds</p>
  </div>

  <!-- How it works -->
  <div class="card">
    <h3 style="margin:0 0 0.75rem;font-size:1rem">How it works</h3>
    <div style="display:flex;flex-direction:column;gap:0.75rem">
      <div style="display:flex;gap:0.75rem;align-items:flex-start">
        <span style="color:var(--gold,#c9a84c);font-size:1.1rem;font-weight:700;flex-shrink:0;min-width:1rem">1</span>
        <div>
          <strong>Generate your free chart</strong>
          <p style="margin:0.15rem 0 0;font-size:0.85em;color:#888">Enter your birth date, time, and location. Your chart calculates instantly.</p>
        </div>
      </div>
      <div style="display:flex;gap:0.75rem;align-items:flex-start">
        <span style="color:var(--gold,#c9a84c);font-size:1.1rem;font-weight:700;flex-shrink:0;min-width:1rem">2</span>
        <div>
          <strong>See your AI synthesis</strong>
          <p style="margin:0.15rem 0 0;font-size:0.85em;color:#888">Prime Self synthesizes 9 ancient systems into a plain-language profile. Read it before your session.</p>
        </div>
      </div>
      <div style="display:flex;gap:0.75rem;align-items:flex-start">
        <span style="color:var(--gold,#c9a84c);font-size:1.1rem;font-weight:700;flex-shrink:0;min-width:1rem">3</span>
        <div>
          <strong>Book with ${escapeHtml(firstName)}</strong>
          <p style="margin:0.15rem 0 0;font-size:0.85em;color:#888">Arrive at your session knowing what your chart says. ${escapeHtml(firstName)} takes you deeper.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Secondary CTA — direct booking -->
  ${bookingCta}

  <div class="footer">
    <a href="${escapeHtml(origin)}">Powered by Prime Self</a>
  </div>

</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
