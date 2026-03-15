/**
 * Cloudflare Pages Function — /practitioners/:slug
 *
 * CMO-002: Server-renders meta tags for practitioner profiles so Google can
 * index them. Returns a lightweight HTML shell with OG/Twitter/JSON-LD
 * meta tags, then redirects to the SPA which renders the full UI.
 *
 * The redirect is a client-side JS redirect (instant for real users) while
 * Googlebot waits for the full render — this is the "dynamic rendering" approach.
 */

const API_BASE = 'https://prime-self-api.adrper79.workers.dev';
const SITE_URL = 'https://selfprime.net';

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export async function onRequestGet({ params }) {
  const slug = params.slug;

  // Validate slug format before hitting the API
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return Response.redirect(`${SITE_URL}/`, 302);
  }

  let practitioner;
  try {
    const res = await fetch(`${API_BASE}/api/directory/${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return Response.redirect(`${SITE_URL}/`, 302);
    const data = await res.json();
    practitioner = data.practitioner;
    if (!practitioner) return Response.redirect(`${SITE_URL}/`, 302);
  } catch {
    return Response.redirect(`${SITE_URL}/`, 302);
  }

  const name        = practitioner.display_name || 'Practitioner';
  const bio         = (practitioner.bio || '').slice(0, 155);
  const description = bio || `${name} is a Human Design practitioner on Prime Self.`;
  const profileUrl  = `${SITE_URL}/practitioners/${slug}`;
  const imageUrl    = practitioner.photo_url || `${SITE_URL}/og-image.png`;

  const specializations = Array.isArray(practitioner.specializations)
    ? practitioner.specializations.join(', ')
    : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    description,
    url: profileUrl,
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(practitioner.booking_url ? { url: practitioner.booking_url } : {}),
    knowsAbout: specializations || 'Human Design',
    worksFor: { '@type': 'Organization', name: 'Prime Self', url: SITE_URL },
  };

  const spaRedirectPath = `/?view=practitioners&slug=${encodeURIComponent(slug)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(name)} — Human Design Practitioner | Prime Self</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(profileUrl)}">

  <!-- Open Graph -->
  <meta property="og:type" content="profile">
  <meta property="og:title" content="${escapeHtml(name)} — Human Design Practitioner">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(profileUrl)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:site_name" content="Prime Self">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(name)} — Human Design Practitioner">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">

  <!-- JSON-LD Person schema -->
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

  <!-- Redirect real users to the SPA instantly; search bots stay on this page -->
  <script>
    if (!navigator.userAgent.match(/Googlebot|bingbot|Slurp|DuckDuckBot|Baiduspider/i)) {
      window.location.replace(${JSON.stringify(spaRedirectPath)});
    }
  </script>
  <style>body{font-family:system-ui,sans-serif;max-width:640px;margin:4rem auto;padding:0 1rem;color:#1a1a2e;}a{color:#c9a84c;}</style>
</head>
<body>
  <h1>${escapeHtml(name)}</h1>
  <p>${escapeHtml(description)}</p>
  ${specializations ? `<p><strong>Specializations:</strong> ${escapeHtml(specializations)}</p>` : ''}
  ${practitioner.certification ? `<p><strong>Certification:</strong> ${escapeHtml(practitioner.certification)}</p>` : ''}
  ${practitioner.session_format ? `<p><strong>Sessions:</strong> ${escapeHtml(practitioner.session_format)}</p>` : ''}
  <p><a href="${SITE_URL}">View full profile on Prime Self →</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
