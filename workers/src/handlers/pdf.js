/**
 * PDF Export Handlers
 *
 * GET  /api/profile/:id/pdf                   – User's own profile PDF
 * POST /api/practitioner/clients/:id/pdf      – Practitioner-branded PDF for a client
 *
 * Both use the same minimal PDF builder (no external deps — Workers-compatible).
 */

import { createQueryFn, QUERIES } from '../db/queries.js';
import { enforceFeatureAccess } from '../middleware/tierEnforcement.js';

export async function handlePdfExport(request, env, profileId) {
  if (!profileId) {
    return Response.json({ error: 'Profile ID is required' }, { status: 400 });
  }

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Fetch profile
  const profileResult = await query(QUERIES.getProfileById, [profileId]);
  const profile = profileResult.rows?.[0];

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Verify ownership — BL-FIX: fail-closed when userId is missing
  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }
  // Tier gate: PDF export requires Explorer tier or above
  const pdfFeatureCheck = await enforceFeatureAccess(request, env, 'pdfExport');
  if (pdfFeatureCheck) return pdfFeatureCheck;

  if (profile.user_id !== userId) {
    // Check if user is a practitioner with access to this client
    const practCheck = await query(QUERIES.checkPractitionerAccess, [userId, profile.user_id]);
    if (!practCheck.rows?.length) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Parse profile JSON
  const profileData = typeof profile.profile_json === 'string'
    ? JSON.parse(profile.profile_json)
    : profile.profile_json;

  // Fetch associated chart
  let chartData = null;
  if (profile.chart_id) {
    const chartResult = await query(QUERIES.getChartById, [profile.chart_id]);
    const chart = chartResult.rows?.[0];
    if (chart) {
      chartData = typeof chart.hd_json === 'string'
        ? JSON.parse(chart.hd_json)
        : chart.hd_json;
    }
  }

  // Build PDF
  const pdfBytes = generatePDF(profileData, chartData, profile.created_at);

  // Store in R2 for caching (non-blocking)
  const r2Key = `pdfs/${profileId}.pdf`;
  if (env.R2) {
    // Check if already in R2 first
    try {
      const existing = await env.R2.head(r2Key);
      if (existing) {
        // Serve from R2 cache
        const obj = await env.R2.get(r2Key);
        if (obj) {
          return new Response(obj.body, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="prime-self-profile-${profileId.slice(0, 8)}.pdf"`,
              'X-Cache': 'HIT'
            }
          });
        }
      }
    } catch { /* not in cache */ }

    // Write to R2 cache (don't await)
    env.R2.put(r2Key, pdfBytes, {
      httpMetadata: { contentType: 'application/pdf' },
      customMetadata: { profileId, userId: profile.user_id, createdAt: profile.created_at }
    }).catch(e => {
      console.warn(JSON.stringify({ event: 'r2_put_failed', key: r2Key, error: e.message }));
    });
  }

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="prime-self-profile-${profileId.slice(0, 8)}.pdf"`,
      'Content-Length': pdfBytes.byteLength.toString()
    }
  });
}

/**
 * POST /api/practitioner/clients/:clientId/pdf
 *
 * Generates a practitioner-branded PDF for a client's latest profile.
 * The PDF header shows the practitioner's name/website instead of "PRIME SELF PROFILE",
 * and the footer reads "Prepared by {name} | Powered by Prime Self".
 *
 * @param {Request} request
 * @param {Object}  env       - Cloudflare Worker env bindings
 * @param {string}  clientId  - The client's user_id (from URL)
 */
export async function handleBrandedPdfExport(request, env, clientId) {
  if (!clientId) {
    return Response.json({ error: 'Client ID is required' }, { status: 400 });
  }

  const userId = request._user?.sub;
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Gate: practitioner tier required
  const accessCheck = await enforceFeatureAccess(request, env, 'practitionerTools');
  if (accessCheck) return accessCheck;

  const query = createQueryFn(env.NEON_CONNECTION_STRING);

  // Verify current user is a practitioner with this client on their roster
  const practCheck = await query(QUERIES.checkPractitionerAccess, [userId, clientId]);
  if (!practCheck.rows?.length) {
    return Response.json({ error: 'Forbidden — client not on your roster' }, { status: 403 });
  }

  // Fetch client's latest profile
  const profileResult = await query(QUERIES.getLatestProfile, [clientId]);
  const profile = profileResult.rows?.[0];
  if (!profile) {
    return Response.json({ error: 'No profile found for this client' }, { status: 404 });
  }

  // Fetch practitioner branding
  const brandResult = await query(QUERIES.getPractitionerBranding, [userId]);
  const branding = brandResult.rows?.[0] || null;

  const profileData = typeof profile.profile_json === 'string'
    ? JSON.parse(profile.profile_json)
    : profile.profile_json;

  let chartData = null;
  if (profile.chart_id) {
    const chartResult = await query(QUERIES.getChartById, [profile.chart_id]);
    const chart = chartResult.rows?.[0];
    if (chart) {
      chartData = typeof chart.hd_json === 'string'
        ? JSON.parse(chart.hd_json)
        : chart.hd_json;
    }
  }

  // R2 cache key for branded PDF (separate from user's own PDF)
  const practitionerId = userId;
  const r2Key = `pdfs/branded/${practitionerId}/${profile.id}.pdf`;

  if (env.R2) {
    try {
      const existing = await env.R2.head(r2Key);
      if (existing) {
        const obj = await env.R2.get(r2Key);
        if (obj) {
          return new Response(obj.body, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="profile-${clientId.slice(0, 8)}.pdf"`,
              'X-Cache': 'HIT'
            }
          });
        }
      }
    } catch { /* not in cache */ }
  }

  const pdfBytes = generatePDF(profileData, chartData, profile.created_at, branding);

  if (env.R2) {
    env.R2.put(r2Key, pdfBytes, {
      httpMetadata: { contentType: 'application/pdf' },
      customMetadata: { profileId: profile.id, practitionerId, clientId }
    }).catch(e => {
      console.warn(JSON.stringify({ event: 'r2_put_failed', key: r2Key, error: e.message }));
    });
  }

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="profile-${clientId.slice(0, 8)}.pdf"`,
      'Content-Length': pdfBytes.byteLength.toString()
    }
  });
}

// ─── Minimal PDF Generator ───────────────────────────────────
// Builds a valid PDF 1.4 document with text content.
// No images or fancy layout — pure text with basic formatting.

/**
 * @param {Object|null} branding  - Optional practitioner branding
 *   { display_name, website_url, booking_url, brand_color, logo_url }
 */
function generatePDF(profileData, chartData, createdAt, branding = null) {
  const lines = [];
  const date = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  // Title
  if (branding?.display_name) {
    lines.push({ text: branding.display_name, size: 24, bold: true, y: 750 });
    if (branding.website_url) {
      lines.push({ text: branding.website_url, size: 10, y: 732 });
      lines.push({ text: `Client Report  •  Generated: ${date}`, size: 10, y: 720 });
    } else {
      lines.push({ text: `Client Report  •  Generated: ${date}`, size: 10, y: 730 });
    }
  } else {
    lines.push({ text: 'PRIME SELF PROFILE', size: 24, bold: true, y: 750 });
    lines.push({ text: `Generated: ${date}`, size: 10, y: 730 });
  }
  lines.push({ text: '─'.repeat(60), size: 10, y: 718 });

  // Chart summary
  let y = 695;
  if (chartData) {
    lines.push({ text: 'CHART SUMMARY', size: 14, bold: true, y });
    y -= 20;

    const fields = [
      ['Type', chartData.type],
      ['Authority', chartData.authority],
      ['Profile', chartData.profile],
      ['Definition', chartData.definition],
      ['Cross', chartData.cross?.name || 'N/A']
    ];

    for (const [label, value] of fields) {
      if (value) {
        lines.push({ text: `${label}: ${value}`, size: 11, y });
        y -= 16;
      }
    }
    y -= 10;
  }

  // Forge assignment
  if (profileData.forge || profileData.primaryForge) {
    const forge = profileData.forge || profileData.primaryForge;
    lines.push({ text: 'FORGE ASSIGNMENT', size: 14, bold: true, y });
    y -= 20;
    lines.push({ text: `Primary Forge: ${forge}`, size: 11, y });
    y -= 16;
    if (profileData.forgeDescription) {
      const forgeLines = wrapText(profileData.forgeDescription, 80);
      for (const line of forgeLines) {
        if (y < 50) y = 750; // page break
        lines.push({ text: line, size: 10, y });
        y -= 14;
      }
    }
    y -= 10;
  }

  // Profile synthesis
  lines.push({ text: 'PROFILE SYNTHESIS', size: 14, bold: true, y });
  y -= 20;

  const synthesisText =
    profileData.narrative ||
    profileData.synthesis ||
    profileData.description ||
    JSON.stringify(profileData, null, 2);

  const textLines = wrapText(synthesisText, 85);
  for (const line of textLines) {
    if (y < 50) y = 750; // page break
    lines.push({ text: line, size: 10, y });
    y -= 14;
  }

  // New system sections (Mayan, BaZi, Sabian, Chiron, Lilith)
  const ti2 = profileData.technicalInsights;
  if (ti2) {
    if (ti2.mayanTzolkin) {
      const m = ti2.mayanTzolkin;
      y -= 10;
      lines.push({ text: 'MAYAN TZOLKIN', size: 14, bold: true, y });
      y -= 20;
      const kinLine = `Kin ${m.kin || '?'} — ${m.seal || ''} · ${m.tone || ''}`;
      lines.push({ text: kinLine, size: 11, y });
      y -= 16;
      if (m.gift) {
        const giftLines = wrapText(`Gift: ${m.gift}`, 85);
        for (const line of giftLines) {
          if (y < 50) y = 750;
          lines.push({ text: line, size: 10, y });
          y -= 14;
        }
      }
      if (m.convergence) {
        const convLines = wrapText(m.convergence, 85);
        for (const line of convLines) {
          if (y < 50) y = 750;
          lines.push({ text: line, size: 9, y });
          y -= 13;
        }
      }
      y -= 10;
    }

    if (ti2.baziProfile) {
      const b = ti2.baziProfile;
      y -= 10;
      lines.push({ text: 'BAZI FOUR PILLARS', size: 14, bold: true, y });
      y -= 20;
      if (b.dayMaster) {
        lines.push({ text: `Day Master: ${b.dayMaster}`, size: 11, y });
        y -= 16;
      }
      if (b.elementBalance) {
        const balLines = wrapText(b.elementBalance, 85);
        for (const line of balLines) {
          if (y < 50) y = 750;
          lines.push({ text: line, size: 10, y });
          y -= 14;
        }
      }
      y -= 10;
    }

    if (ti2.sabianHighlights?.length) {
      y -= 10;
      lines.push({ text: 'SABIAN SYMBOLS', size: 14, bold: true, y });
      y -= 20;
      for (const s of ti2.sabianHighlights) {
        if (y < 50) y = 750;
        lines.push({ text: `${s.point || ''}: "${s.symbol || ''}"`, size: 11, y });
        y -= 16;
        if (s.insight) {
          const insLines = wrapText(s.insight, 85);
          for (const line of insLines) {
            if (y < 50) y = 750;
            lines.push({ text: line, size: 10, y });
            y -= 14;
          }
        }
        y -= 6;
      }
      y -= 10;
    }

    if (ti2.chironWound) {
      const ch = ti2.chironWound;
      y -= 10;
      lines.push({ text: 'CHIRON — WOUND & GIFT', size: 14, bold: true, y });
      y -= 20;
      const chHeader = [ch.archetype || ch.sign || '', ch.house ? `House ${ch.house}` : ''].filter(Boolean).join(' · ');
      lines.push({ text: chHeader, size: 11, y });
      y -= 16;
      if (ch.wound) {
        const wLines = wrapText(`Wound: ${ch.wound}`, 85);
        for (const line of wLines) {
          if (y < 50) y = 750;
          lines.push({ text: line, size: 10, y });
          y -= 14;
        }
      }
      if (ch.gift) {
        const gLines = wrapText(`Gift: ${ch.gift}`, 85);
        for (const line of gLines) {
          if (y < 50) y = 750;
          lines.push({ text: line, size: 10, y });
          y -= 14;
        }
      }
      y -= 10;
    }

    if (ti2.lilithPlacement) {
      const lil = ti2.lilithPlacement;
      y -= 10;
      lines.push({ text: 'LILITH — WILD POWER', size: 14, bold: true, y });
      y -= 20;
      const lilHeader = [lil.archetype || lil.sign || '', lil.house ? `House ${lil.house}` : ''].filter(Boolean).join(' · ');
      lines.push({ text: lilHeader, size: 11, y });
      y -= 16;
      if (lil.shadow) {
        const sLines = wrapText(`Shadow: ${lil.shadow}`, 85);
        for (const line of sLines) {
          if (y < 50) y = 750;
          lines.push({ text: line, size: 10, y });
          y -= 14;
        }
      }
      if (lil.gift) {
        const gLines = wrapText(`Gift: ${lil.gift}`, 85);
        for (const line of gLines) {
          if (y < 50) y = 750;
          lines.push({ text: line, size: 10, y });
          y -= 14;
        }
      }
      y -= 10;
    }
  }

  // Grounding audit
  if (profileData.groundingAudit) {
    y -= 10;
    lines.push({ text: 'GROUNDING AUDIT', size: 14, bold: true, y });
    y -= 20;
    const auditText = typeof profileData.groundingAudit === 'string'
      ? profileData.groundingAudit
      : JSON.stringify(profileData.groundingAudit, null, 2);
    const auditLines = wrapText(auditText, 85);
    for (const line of auditLines) {
      if (y < 50) y = 750; // page break
      lines.push({ text: line, size: 9, y });
      y -= 13;
    }
  }

  // Footer
  lines.push({ text: '─'.repeat(60), size: 10, y: 35 });
  if (branding?.display_name) {
    const footerName = branding.display_name;
    const footerSite = branding.website_url ? ` \u2022 ${branding.website_url}` : '';
    lines.push({ text: `Prepared by ${footerName}${footerSite} \u2022 Powered by Prime Self`, size: 8, y: 22 });
  } else {
    lines.push({ text: 'Prime Self \u2022 Movement-First Personal Development', size: 8, y: 22 });
  }

  return buildPDFBytes(lines);
}

function wrapText(text, maxChars) {
  const result = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para.trim() === '') {
      result.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > maxChars) {
        result.push(line.trim());
        line = word;
      } else {
        line = line ? line + ' ' + word : word;
      }
    }
    if (line.trim()) result.push(line.trim());
  }
  return result;
}

/**
 * Build raw PDF bytes from an array of text line objects.
 * Support for multiple pages — splits lines when Y coordinate resets (page break).
 * Minimal PDF 1.4 spec, Helvetica font.
 */
function buildPDFBytes(lines) {
  // Split lines into pages when Y coordinate jumps from low to high (page break)
  const pages = [[]];
  let pageIndex = 0;
  let prevY = 750;

  for (const line of lines) {
    // Detect page break: Y jumps from low (<100) back to high (>700)
    if (prevY < 100 && line.y > 700) {
      pageIndex++;
      pages[pageIndex] = [];
    }
    pages[pageIndex].push(line);
    prevY = line.y;
  }

  const objects = [];
  let objectCount = 0;

  function addObject(content) {
    objectCount++;
    const obj = { id: objectCount, content };
    objects.push(obj);
    return objectCount;
  }

  // Object 1: Catalog
  addObject('<<\n/Type /Catalog\n/Pages 2 0 R\n>>');

  // Reserve ID 2 for Pages object (will add after knowing page count)
  const pagesObjId = 2;
  objectCount = 2;

  // Object 3, 4: Fonts
  addObject('<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>');
  addObject('<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica-Bold\n>>');

  // Create page objects and content streams
  const pageObjIds = [];
  for (let i = 0; i < pages.length; i++) {
    const pageLines = pages[i];

    // Build stream content for this page
    let stream = 'BT\n';
    for (const line of pageLines) {
      const font = line.bold ? '/F2' : '/F1';
      const size = line.size || 10;
      const escaped = escapePDF(line.text || '');
      stream += `${font} ${size} Tf\n`;
      stream += `50 ${line.y} Td\n`;
      stream += `(${escaped}) Tj\n`;
    }
    stream += 'ET\n';

    // Add content stream object
    const streamObjId = addObject(`<<\n/Length ${stream.length}\n>>\nstream\n${stream}endstream`);

    // Add page object (fonts now at objects 3 and 4)
    const pageObjId = addObject(`<<\n/Type /Page\n/Parent ${pagesObjId} 0 R\n/MediaBox [0 0 612 792]\n/Contents ${streamObjId} 0 R\n/Resources <<\n  /Font <<\n    /F1 3 0 R\n    /F2 4 0 R\n  >>\n>>\n>>`);
    
    pageObjIds.push(pageObjId);
  }

  // Build Kids array for Pages object
  const kidsArray = pageObjIds.map(id => `${id} 0 R`).join(' ');

  // Insert Object 2: Pages (at position 1 in objects array, after Catalog)
  objects.splice(1, 0, {
    id: pagesObjId,
    content: `<<\n/Type /Pages\n/Kids [${kidsArray}]\n/Count ${pages.length}\n>>`
  });

  // Build PDF file
  let pdf = '%PDF-1.4\n';
  const offsets = [];

  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
  }

  // Cross-reference table
  const xrefOffset = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${objectCount + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  // Trailer
  pdf += 'trailer\n';
  pdf += `<<\n/Size ${objectCount + 1}\n/Root 1 0 R\n>>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  // Convert to ArrayBuffer
  const encoder = new TextEncoder();
  return encoder.encode(pdf).buffer;
}

function escapePDF(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?'); // Replace non-ASCII with ?
}
