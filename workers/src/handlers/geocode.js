/**
 * GET /api/geocode?q=Tampa+FL+USA
 *
 * Geocodes a plain-text city/location query to lat, lng, and IANA timezone.
 *
 * Sources (all free, no API key required):
 *   1. OpenStreetMap Nominatim  — lat/lng + display name
 *   2. BigDataCloud timezone API — IANA timezone ID from coordinates
 *
 * Results are cached in Workers KV for 30 days to reduce external calls.
 *
 * Response:
 * {
 *   lat: 27.9506,
 *   lng: -82.4572,
 *   timezone: "America/New_York",
 *   displayName: "Tampa, Hillsborough County, Florida, United States"
 * }
 */

const CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

export async function handleGeocode(request, env) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();

  if (!q || q.length < 2) {
    return Response.json(
      { error: 'Enter at least 2 characters for the location search.' },
      { status: 400 }
    );
  }

  // KV cache check — avoids hammering Nominatim for repeated lookups
  const cacheKey = `geo:${q.toLowerCase()}`;
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey, 'json');
      if (cached) return Response.json({ ...cached, cached: true });
    } catch {
      // Non-fatal — fall through to live lookup
    }
  }

  // ── Step 1: Nominatim geocoding ──────────────────────────────
  let geoData;
  try {
    const nominatimRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          // Nominatim usage policy requires a User-Agent identifying the app
          'User-Agent': 'PrimeSelf/1.0 (prime-self-api.adrper79.workers.dev)',
          'Accept-Language': 'en'
        }
      }
    );
    if (!nominatimRes.ok) {
      throw new Error(`Nominatim HTTP ${nominatimRes.status}`);
    }
    geoData = await nominatimRes.json();
  } catch (err) {
    return Response.json(
      { error: 'Geocoding service unavailable — try again shortly.', detail: err.message },
      { status: 502 }
    );
  }

  if (!Array.isArray(geoData) || !geoData.length) {
    return Response.json(
      { error: `Location not found: "${q}". Try adding country or state.` },
      { status: 404 }
    );
  }

  const { lat: rawLat, lon: rawLng, display_name } = geoData[0];
  const lat = parseFloat(rawLat);
  const lng = parseFloat(rawLng);

  // ── Step 2: Timezone lookup ──────────────────────────────────
  // BigDataCloud returns an IANA timezone ID from coordinates (free, no key)
  let timezone = longitudeTimezone(lng); // fallback if API is down
  try {
    const tzRes = await fetch(
      `https://api.bigdatacloud.net/data/timezone-by-location?latitude=${lat}&longitude=${lng}`,
      { headers: { Accept: 'application/json' } }
    );
    if (tzRes.ok) {
      const tzData = await tzRes.json();
      if (tzData.ianaTimeId) timezone = tzData.ianaTimeId;
    }
  } catch {
    // Fallback already set above
  }

  const result = { lat, lng, timezone, displayName: display_name };

  // Cache for 30 days
  if (env.CACHE) {
    try {
      await env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
    } catch {
      // Non-fatal
    }
  }

  return Response.json(result);
}

/**
 * Rough longitude-to-timezone fallback used when BigDataCloud is unavailable.
 * Covers the most common zones by 15-degree bands. Not DST-aware — exists only
 * as a last resort so the UI is never left with an empty timezone.
 */
function longitudeTimezone(lng) {
  if (lng < -157.5) return 'Pacific/Honolulu';
  if (lng < -127.5) return 'America/Anchorage';
  if (lng < -112.5) return 'America/Los_Angeles';
  if (lng < -97.5)  return 'America/Denver';
  if (lng < -82.5)  return 'America/Chicago';
  if (lng < -67.5)  return 'America/New_York';
  if (lng < -52.5)  return 'America/Halifax';
  if (lng < -37.5)  return 'America/Sao_Paulo';
  if (lng < -7.5)   return 'Atlantic/Azores';
  if (lng < 7.5)    return 'Europe/London';
  if (lng < 22.5)   return 'Europe/Paris';
  if (lng < 37.5)   return 'Europe/Helsinki';
  if (lng < 52.5)   return 'Europe/Moscow';
  if (lng < 67.5)   return 'Asia/Dubai';
  if (lng < 82.5)   return 'Asia/Karachi';
  if (lng < 97.5)   return 'Asia/Kolkata';
  if (lng < 112.5)  return 'Asia/Dhaka';
  if (lng < 127.5)  return 'Asia/Singapore';
  if (lng < 142.5)  return 'Asia/Tokyo';
  if (lng < 157.5)  return 'Australia/Sydney';
  return 'Pacific/Auckland';
}
