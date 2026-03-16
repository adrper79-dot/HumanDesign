/**
 * Share Card Generator
 * 
 * Creates a "Your Design at a Glance" shareable card rendered to Canvas,
 * then exportable as PNG for social media sharing.
 * 
 * Usage: generateShareCard(chartData) — returns a Promise<Blob>
 *        showShareCard(chartData) — renders into a modal with download button
 * 
 * Dependencies: hd-data.js (getCrossName)
 */

(function() {
  'use strict';

  const CARD_W = 600;
  const CARD_H = 800;
  const BG_COLOR = '#0f0f1a';
  const GOLD = '#c9a84c';
  const TEXT = '#e8e6f0';
  const TEXT_DIM = '#c4c0d8';
  const TEXT_MUTED = '#918db0';
  const ACCENT = '#6a4fc8';

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let curY = y;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line.trim(), x, curY);
        line = word + ' ';
        curY += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), x, curY);
    return curY + lineH;
  }

  /**
   * Generate a share card canvas
   * @param {object} chartData - chart object
   * @returns {HTMLCanvasElement}
   */
  function createShareCanvas(chartData) {
    const chart = chartData || {};
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = BG_COLOR;
    drawRoundedRect(ctx, 0, 0, CARD_W, CARD_H, 16);
    ctx.fill();

    // Gold top accent line
    ctx.fillStyle = GOLD;
    ctx.fillRect(30, 0, CARD_W - 60, 3);

    // Header
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦  P R I M E   S E L F  ✦', CARD_W / 2, 36);

    ctx.fillStyle = TEXT;
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.fillText('Your Design at a Glance', CARD_W / 2, 72);

    // Horizontal rule
    const grad = ctx.createLinearGradient(60, 90, CARD_W - 60, 90);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.3, GOLD + '66');
    grad.addColorStop(0.7, GOLD + '66');
    grad.addColorStop(1, 'transparent');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 90);
    ctx.lineTo(CARD_W - 60, 90);
    ctx.stroke();

    let y = 120;
    ctx.textAlign = 'left';
    const padL = 40;
    const padR = CARD_W - 40;
    const valX = 230;

    function dataRow(label, value) {
      if (!value) return;
      ctx.fillStyle = TEXT_MUTED;
      ctx.font = '600 14px system-ui, -apple-system, sans-serif';
      ctx.fillText(label, padL, y);
      ctx.fillStyle = TEXT;
      ctx.font = '600 16px system-ui, -apple-system, sans-serif';
      ctx.fillText(String(value), valX, y);
      y += 32;
    }

    function sectionLabel(text) {
      y += 8;
      ctx.fillStyle = GOLD;
      ctx.font = '700 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(text.toUpperCase(), padL, y);
      y += 22;
    }

    // Core data
    sectionLabel('Core Energy');
    dataRow('Pattern', chart.type);
    dataRow('Decision Style', chart.authority);
    dataRow('Strategy', chart.strategy);
    dataRow('Life Role', chart.profile);
    dataRow('Circuit Type', chart.definition);

    // Centers
    if (chart.definedCenters?.length) {
      sectionLabel('Energy Centers');
      const definedStr = chart.definedCenters.join(', ');
      const allCenters = ['Head','Ajna','Throat','G','Heart','SolarPlexus','Sacral','Spleen','Root'];
      const openStr = allCenters.filter(c => !chart.definedCenters.includes(c)).join(', ');

      ctx.fillStyle = TEXT_MUTED;
      ctx.font = '600 14px system-ui, -apple-system, sans-serif';
      ctx.fillText('Defined', padL, y);
      ctx.fillStyle = GOLD;
      ctx.font = '14px system-ui, -apple-system, sans-serif';
      y = wrapText(ctx, definedStr, valX, y, padR - valX, 20);
      y += 6;

      ctx.fillStyle = TEXT_MUTED;
      ctx.font = '600 14px system-ui, -apple-system, sans-serif';
      ctx.fillText('Open', padL, y);
      ctx.fillStyle = TEXT_DIM;
      ctx.font = '14px system-ui, -apple-system, sans-serif';
      y = wrapText(ctx, openStr, valX, y, padR - valX, 20);
      y += 6;
    }

    // Channels
    if (chart.activeChannels?.length) {
      sectionLabel('Active Channels');
      ctx.fillStyle = TEXT_DIM;
      ctx.font = '14px system-ui, -apple-system, sans-serif';
      const chList = chart.activeChannels.map(ch => ch.channel || (ch.gates?.[0] + '-' + ch.gates?.[1])).join('  ·  ');
      y = wrapText(ctx, chList, padL, y, padR - padL, 20);
      y += 6;
    }

    // Cross
    const crossName = chart.cross?.name || (typeof chart.cross === 'string' ? chart.cross : null)
      || (chart.cross?.gates?.[0] && chart.cross?.line && typeof getCrossName === 'function'
        ? getCrossName(chart.cross.gates[0], chart.cross.line) : '');
    if (crossName) {
      sectionLabel('Purpose');
      dataRow('Soul Cross', crossName);
    }

    // Footer
    y = CARD_H - 50;
    ctx.fillStyle = GOLD + '40';
    ctx.fillRect(30, y - 15, CARD_W - 60, 1);

    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('selfprime.net — Energy Blueprint + Astrology + AI', CARD_W / 2, y + 10);

    ctx.fillStyle = TEXT_MUTED + '80';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText('Generated ' + new Date().toLocaleDateString(), CARD_W / 2, y + 28);

    return canvas;
  }

  /**
   * Generate share card as PNG Blob
   */
  window.generateShareCard = function(chartData) {
    return new Promise((resolve) => {
      const canvas = createShareCanvas(chartData);
      canvas.toBlob(blob => resolve(blob), 'image/png');
    });
  };

  /**
   * Show shareable card in a modal with download + share buttons
   */
  window.showShareCard = function(chartData) {
    const canvas = createShareCanvas(chartData);

    // Create modal
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg,#1a1a24);border-radius:16px;padding:20px;max-width:640px;width:100%;max-height:90vh;overflow-y:auto;text-align:center';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:1rem;font-weight:700;color:var(--gold,#c9a84c);margin-bottom:12px';
    title.textContent = '✦ Your Shareable Design Card';

    canvas.style.cssText = 'max-width:100%;height:auto;border-radius:12px;border:1px solid rgba(255,255,255,0.1)';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;margin-top:14px;flex-wrap:wrap';

    // Download button
    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn-primary';
    dlBtn.style.cssText = 'font-size:0.85rem;padding:8px 20px';
    dlBtn.textContent = '⬇ Download PNG';
    dlBtn.addEventListener('click', () => {
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prime-self-design.png';
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    });

    // Native share (if available)
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn-primary';
    shareBtn.style.cssText = 'font-size:0.85rem;padding:8px 20px;background:var(--accent,#6a4fc8)';
    shareBtn.textContent = '📤 Share';
    shareBtn.addEventListener('click', async () => {
      try {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const file = new File([blob], 'prime-self-design.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'My Prime Self Design', text: 'My Energy Blueprint at a glance' });
        } else {
          // Fallback: copy to clipboard
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          shareBtn.textContent = '✓ Copied!';
          setTimeout(() => shareBtn.textContent = '📤 Share', 2000);
        }
      } catch (e) {
        window.DEBUG && console.warn('Share failed:', e);
      }
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'font-size:0.85rem;padding:8px 20px;background:none;border:1px solid var(--border,#32324a);color:var(--text-dim,#c4c0d8);border-radius:8px;cursor:pointer';
    closeBtn.textContent = '✕ Close';
    closeBtn.addEventListener('click', () => overlay.remove());

    btnRow.append(dlBtn, shareBtn, closeBtn);
    modal.append(title, canvas, btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  };

  // ── Blueprint Card (UX-SHARE) ────────────────────────────────────────────
  // Two formats: square 1080×1080 (Twitter/IG post) and story 1080×1920 (IG story)

  const FORGE_DOMAINS = {
    Chronos: 'Time & Legacy',
    Eros: 'Passion & Creation',
    Aether: 'Universal Connection',
    Lux: 'Illumination & Guidance',
    Phoenix: 'Rebirth & Transformation',
  };

  function scatterStars(ctx, w, h, count) {
    ctx.save();
    for (var i = 0; i < count; i++) {
      var x = Math.random() * w;
      var y = Math.random() * h;
      var r = Math.random() * 1.5 + 0.3;
      var alpha = Math.random() * 0.6 + 0.15;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
      ctx.fill();
    }
    ctx.restore();
  }

  function createBlueprintCanvas(chart, forge, format) {
    var isStory = format === 'story';
    var W = 1080;
    var H = isStory ? 1920 : 1080;
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');

    // Background gradient
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#07071a');
    bg.addColorStop(0.5, '#0f0820');
    bg.addColorStop(1, '#080f1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Stars
    scatterStars(ctx, W, H, isStory ? 220 : 130);

    // Gold top accent bar
    ctx.fillStyle = GOLD;
    ctx.fillRect(60, 0, W - 120, 4);

    // ── Brand header ─────────────────────────────────────────
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.fillText('✦  P R I M E   S E L F  ✦', W / 2, 64);

    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '22px system-ui, -apple-system, sans-serif';
    ctx.fillText('Energy Blueprint', W / 2, 102);

    // Horizontal rule after header
    var lineY = 130;
    var lineGrad = ctx.createLinearGradient(80, lineY, W - 80, lineY);
    lineGrad.addColorStop(0, 'transparent');
    lineGrad.addColorStop(0.3, GOLD + '55');
    lineGrad.addColorStop(0.7, GOLD + '55');
    lineGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(80, lineY);
    ctx.lineTo(W - 80, lineY);
    ctx.stroke();

    // ── Forge section ─────────────────────────────────────────
    var forgeName = (forge && forge.primaryForge) ? forge.primaryForge : null;
    var forgeDomain = forgeName ? (FORGE_DOMAINS[forgeName] || '') : '';
    var forgeWeapon = (forge && forge.forgeWeapon) ? forge.forgeWeapon : null;
    var forgeY = isStory ? 240 : 210;

    if (forgeName) {
      // Forge glow circle
      var cx = W / 2;
      var cy = forgeY + 80;
      var glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 180);
      glow.addColorStop(0, ACCENT + '40');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, forgeY - 20, W, 300);

      ctx.textAlign = 'center';
      // Forge flame icon
      ctx.font = isStory ? '72px serif' : '56px serif';
      ctx.fillText('🔥', W / 2, forgeY + 60);

      ctx.fillStyle = TEXT;
      ctx.font = 'bold ' + (isStory ? '80px' : '68px') + ' system-ui, -apple-system, sans-serif';
      ctx.fillText((forgeName).toUpperCase() + ' FORGE', W / 2, forgeY + 145);

      if (forgeDomain) {
        ctx.fillStyle = GOLD;
        ctx.font = (isStory ? '34px' : '28px') + ' system-ui, -apple-system, sans-serif';
        ctx.fillText(forgeDomain, W / 2, forgeY + 192);
      }
      forgeY += isStory ? 250 : 220;
    } else {
      // No forge — show tagline instead
      ctx.textAlign = 'center';
      ctx.fillStyle = TEXT_MUTED;
      ctx.font = (isStory ? '38px' : '32px') + ' system-ui, -apple-system, sans-serif';
      ctx.fillText('Prime Self Blueprint', W / 2, forgeY + 60);
      forgeY += isStory ? 120 : 100;
    }

    // ── Divider ───────────────────────────────────────────────
    var div2Y = isStory ? (forgeName ? 510 : 390) : (forgeName ? 460 : 350);
    var hr2 = ctx.createLinearGradient(80, div2Y, W - 80, div2Y);
    hr2.addColorStop(0, 'transparent');
    hr2.addColorStop(0.3, GOLD + '44');
    hr2.addColorStop(0.7, GOLD + '44');
    hr2.addColorStop(1, 'transparent');
    ctx.strokeStyle = hr2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, div2Y);
    ctx.lineTo(W - 80, div2Y);
    ctx.stroke();

    // ── Chart data rows ──────────────────────────────────────
    var c = chart || {};
    var dataY = div2Y + (isStory ? 70 : 56);
    var labelX = 160;
    var valX = W - 160;
    var rowH = isStory ? 66 : 58;

    function dataRow2(label, value) {
      if (!value) return;
      ctx.textAlign = 'left';
      ctx.fillStyle = TEXT_MUTED;
      ctx.font = '600 ' + (isStory ? '28px' : '24px') + ' system-ui, -apple-system, sans-serif';
      ctx.fillText(label, labelX, dataY);

      ctx.textAlign = 'right';
      ctx.fillStyle = TEXT;
      ctx.font = '600 ' + (isStory ? '30px' : '26px') + ' system-ui, -apple-system, sans-serif';
      // Truncate long values
      var val = String(value);
      if (ctx.measureText(val).width > W - labelX - 100) {
        while (ctx.measureText(val + '…').width > W - labelX - 100 && val.length > 4) val = val.slice(0, -1);
        val += '…';
      }
      ctx.fillText(val, valX, dataY);

      // subtle row line
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(labelX, dataY + 14);
      ctx.lineTo(valX, dataY + 14);
      ctx.stroke();

      dataY += rowH;
    }

    dataRow2('Type', c.type);
    dataRow2('Profile', c.profile);
    dataRow2('Authority', c.authority);
    dataRow2('Strategy', c.strategy);
    var crossVal = c.cross?.name || (typeof c.cross === 'string' ? c.cross : null);
    if (crossVal) dataRow2('Soul Cross', crossVal);

    // ── Forge Weapon insight ──────────────────────────────────
    if (forgeWeapon) {
      var insightY = dataY + (isStory ? 80 : 60);
      // Subtle box
      ctx.fillStyle = 'rgba(106,79,200,0.15)';
      ctx.beginPath();
      drawRoundedRect(ctx, 80, insightY - 40, W - 160, isStory ? 140 : 120, 16);
      ctx.fill();
      ctx.strokeStyle = ACCENT + '55';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = GOLD;
      ctx.font = '700 ' + (isStory ? '24px' : '20px') + ' system-ui, -apple-system, sans-serif';
      ctx.fillText('YOUR WEAPON', W / 2, insightY + 4);
      ctx.fillStyle = TEXT_DIM;
      ctx.font = (isStory ? '30px' : '26px') + ' system-ui, -apple-system, sans-serif';
      wrapText(ctx, forgeWeapon, W / 2, insightY + 46, W - 200, isStory ? 40 : 34);
    }

    // ── Footer ────────────────────────────────────────────────
    var footY = H - (isStory ? 100 : 80);
    var footGrad = ctx.createLinearGradient(60, footY, W - 60, footY);
    footGrad.addColorStop(0, 'transparent');
    footGrad.addColorStop(0.3, GOLD + '44');
    footGrad.addColorStop(0.7, GOLD + '44');
    footGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = footGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, footY);
    ctx.lineTo(W - 60, footY);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = (isStory ? '28px' : '24px') + ' system-ui, -apple-system, sans-serif';
    ctx.fillText('selfprime.net — Discover Your Energy Design', W / 2, footY + (isStory ? 48 : 38));

    ctx.fillStyle = GOLD + '70';
    ctx.font = 'bold ' + (isStory ? '24px' : '20px') + ' system-ui, -apple-system, sans-serif';
    ctx.fillText('selfprime.net', W / 2, footY + (isStory ? 90 : 70));

    return canvas;
  }

  /**
   * Show Blueprint Card in a format-selectable modal
   * @param {object} chart - HD chart data (window._lastChart)
   * @param {object} forge - Forge identification data (window._lastForge)
   */
  window.showBlueprintCard = function(chart, forge) {
    var currentFormat = 'square';

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

    var modal = document.createElement('div');
    modal.style.cssText = 'background:#1a1a24;border-radius:16px;padding:20px;max-width:560px;width:100%;max-height:95vh;overflow-y:auto;text-align:center;border:1px solid rgba(201,168,76,0.2)';

    var title = document.createElement('div');
    title.style.cssText = 'font-size:1rem;font-weight:700;color:#c9a84c;margin-bottom:14px';
    title.textContent = '✦ Share Your Blueprint';

    // Format toggle
    var toggleRow = document.createElement('div');
    toggleRow.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-bottom:14px';

    function mkFmtBtn(label, fmt) {
      var b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'padding:6px 16px;border-radius:20px;border:1px solid rgba(201,168,76,0.3);background:' + (fmt===currentFormat?'#c9a84c':'transparent') + ';color:' + (fmt===currentFormat?'#12121e':'#c9a84c') + ';font-size:0.8rem;cursor:pointer';
      b.addEventListener('click', function() {
        currentFormat = fmt;
        renderCanvas();
        toggleRow.querySelectorAll('button').forEach(function(btn) {
          var isSel = btn === b;
          btn.style.background = isSel ? '#c9a84c' : 'transparent';
          btn.style.color = isSel ? '#12121e' : '#c9a84c';
        });
      });
      return b;
    }

    toggleRow.appendChild(mkFmtBtn('□ Square (1:1)', 'square'));
    toggleRow.appendChild(mkFmtBtn('▯ Story (9:16)', 'story'));

    // Canvas preview container
    var previewWrap = document.createElement('div');
    previewWrap.style.cssText = 'display:flex;justify-content:center;margin-bottom:14px';

    var currentCanvas = null;
    function renderCanvas() {
      previewWrap.innerHTML = '';
      currentCanvas = createBlueprintCanvas(chart, forge, currentFormat);
      // Scale down for display
      var displayW = Math.min(480, window.innerWidth - 80);
      var scale = displayW / currentCanvas.width;
      var displayH = Math.round(currentCanvas.height * scale);
      currentCanvas.style.cssText = 'width:' + displayW + 'px;height:' + displayH + 'px;border-radius:12px;border:1px solid rgba(255,255,255,0.1)';
      previewWrap.appendChild(currentCanvas);
    }
    renderCanvas();

    // Share caption
    var capitonText = (forge && forge.primaryForge)
      ? 'My Prime Self Blueprint — ' + forge.primaryForge + ' Forge. Discover yours: selfprime.net'
      : 'My Prime Self Energy Blueprint. Discover yours: selfprime.net';

    // Button row
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:4px';

    // Download button
    var dlBtn = document.createElement('button');
    dlBtn.style.cssText = 'padding:8px 22px;border-radius:8px;background:#c9a84c;border:none;color:#12121e;font-weight:700;font-size:0.85rem;cursor:pointer';
    dlBtn.textContent = '⬇ Download PNG';
    dlBtn.addEventListener('click', function() {
      currentCanvas.toBlob(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'prime-self-blueprint-' + currentFormat + '.png';
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    });

    // Native share (with image)
    var shareBtn = document.createElement('button');
    shareBtn.style.cssText = 'padding:8px 22px;border-radius:8px;background:#6a4fc8;border:none;color:#fff;font-weight:700;font-size:0.85rem;cursor:pointer';
    shareBtn.textContent = '📤 Share';
    shareBtn.addEventListener('click', async function() {
      try {
        var blob = await new Promise(function(r) { currentCanvas.toBlob(r, 'image/png'); });
        var file = new File([blob], 'prime-self-blueprint.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'My Prime Self Blueprint', text: capitonText });
        } else {
          // Copy link fallback
          await navigator.clipboard.writeText('https://selfprime.net/?ref=blueprint');
          shareBtn.textContent = '✓ Link Copied!';
          setTimeout(function() { shareBtn.textContent = '📤 Share'; }, 2500);
        }
      } catch(e) { /* user cancelled */ }
    });

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'padding:8px 20px;border-radius:8px;background:none;border:1px solid rgba(255,255,255,0.15);color:#c4c0d8;font-size:0.85rem;cursor:pointer';
    closeBtn.textContent = '✕ Close';
    closeBtn.addEventListener('click', function() { overlay.remove(); });

    btnRow.appendChild(dlBtn);
    btnRow.appendChild(shareBtn);
    btnRow.appendChild(closeBtn);

    // Caption hint
    var hint = document.createElement('div');
    hint.style.cssText = 'margin-top:12px;font-size:0.75rem;color:#918db0;text-align:center';
    hint.textContent = 'Download and share on Instagram, Twitter, or any platform';

    modal.appendChild(title);
    modal.appendChild(toggleRow);
    modal.appendChild(previewWrap);
    modal.appendChild(btnRow);
    modal.appendChild(hint);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  };

})();
