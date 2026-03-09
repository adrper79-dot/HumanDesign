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
      dataRow('Incarnation Cross', crossName);
    }

    // Footer
    y = CARD_H - 50;
    ctx.fillStyle = GOLD + '40';
    ctx.fillRect(30, y - 15, CARD_W - 60, 1);

    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('primeself.app — Human Design + Astrology + AI', CARD_W / 2, y + 10);

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
          await navigator.share({ files: [file], title: 'My Prime Self Design', text: 'My Human Design at a glance' });
        } else {
          // Fallback: copy to clipboard
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          shareBtn.textContent = '✓ Copied!';
          setTimeout(() => shareBtn.textContent = '📤 Share', 2000);
        }
      } catch (e) {
        console.warn('Share failed:', e);
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
})();
