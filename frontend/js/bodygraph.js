/**
 * Interactive Bodygraph Component
 * 
 * Renders an SVG Energy Bodygraph with:
 * - 9 clickable energy centers (colored if defined, outline if open)
 * - 36 channels connecting centers (highlighted if active)
 * - Click-to-explain: tapping a center or channel shows its meaning
 * 
 * Usage: renderBodygraph(containerId, chartData)
 * Dependencies: explanations.js (CENTER_EXPLANATIONS, CHANNEL_DESCRIPTIONS)
 *               hd-data.js (HD_CENTERS, HD_CHANNELS_META)
 */

(function() {
  'use strict';

  // Center positions (x, y) within a 300x420 viewBox
  const CENTER_POS = {
    Head:         { x: 150, y: 30,  shape: 'triangle-up' },
    Ajna:         { x: 150, y: 80,  shape: 'triangle-down' },
    Throat:       { x: 150, y: 135, shape: 'square' },
    G:            { x: 150, y: 200, shape: 'diamond' },
    Heart:        { x: 95,  y: 185, shape: 'triangle-right' },
    SolarPlexus:  { x: 210, y: 275, shape: 'triangle-right' },
    Sacral:       { x: 150, y: 290, shape: 'square' },
    Spleen:       { x: 90,  y: 275, shape: 'square' },
    Root:         { x: 150, y: 370, shape: 'square' }
  };

  // Channel connections: which centers they link
  const CHANNEL_LINES = {
    '64-47': ['Head', 'Ajna'],
    '61-24': ['Head', 'Ajna'],
    '63-4':  ['Head', 'Ajna'],
    '17-62': ['Ajna', 'Throat'],
    '43-23': ['Ajna', 'Throat'],
    '11-56': ['Ajna', 'Throat'],
    '16-48': ['Throat', 'Spleen'],
    '20-57': ['Throat', 'Spleen'],
    '20-34': ['Throat', 'Sacral'],
    '20-10': ['Throat', 'G'],
    '31-7':  ['Throat', 'G'],
    '33-13': ['Throat', 'G'],
    '45-21': ['Throat', 'Heart'],
    '35-36': ['Throat', 'SolarPlexus'],
    '12-22': ['Throat', 'SolarPlexus'],
    '8-1':   ['Throat', 'G'],
    '25-51': ['G', 'Heart'],
    '46-29': ['G', 'Sacral'],
    '10-34': ['G', 'Sacral'],
    '15-5':  ['G', 'Sacral'],
    '2-14':  ['G', 'Sacral'],
    '10-57': ['G', 'Spleen'],
    '26-44': ['Heart', 'Spleen'],
    '40-37': ['Heart', 'SolarPlexus'],
    '6-59':  ['Sacral', 'SolarPlexus'],
    '36-35': ['SolarPlexus', 'Throat'],
    '30-41': ['SolarPlexus', 'Root'],
    '55-39': ['SolarPlexus', 'Root'],
    '49-19': ['SolarPlexus', 'Root'],
    '42-53': ['Sacral', 'Root'],
    '3-60':  ['Sacral', 'Root'],
    '9-52':  ['Sacral', 'Root'],
    '27-50': ['Sacral', 'Spleen'],
    '34-57': ['Sacral', 'Spleen'],
    '28-38': ['Spleen', 'Root'],
    '18-58': ['Spleen', 'Root'],
    '32-54': ['Spleen', 'Root'],
    '48-16': ['Spleen', 'Throat'],
    '57-20': ['Spleen', 'Throat'],
    '44-26': ['Spleen', 'Heart']
  };

  const DEFINED_COLOR = 'rgba(201, 168, 76, 0.9)';
  const OPEN_COLOR = 'rgba(255, 255, 255, 0.15)';
  const DEFINED_STROKE = '#c9a84c';
  const OPEN_STROKE = 'rgba(255, 255, 255, 0.3)';
  const ACTIVE_CHANNEL = 'rgba(201, 168, 76, 0.7)';
  const INACTIVE_CHANNEL = 'rgba(255, 255, 255, 0.08)';
  const CENTER_SIZE = 22;

  function drawCenterShape(center, pos, isDefined) {
    const fill = isDefined ? DEFINED_COLOR : OPEN_COLOR;
    const stroke = isDefined ? DEFINED_STROKE : OPEN_STROKE;
    const s = CENTER_SIZE;

    switch (pos.shape) {
      case 'triangle-up':
        return `<polygon points="${pos.x},${pos.y - s} ${pos.x - s},${pos.y + s*0.6} ${pos.x + s},${pos.y + s*0.6}" 
          fill="${fill}" stroke="${stroke}" stroke-width="1.5" class="bg-center" data-center="${center}" style="cursor:pointer"/>`;
      case 'triangle-down':
        return `<polygon points="${pos.x - s},${pos.y - s*0.6} ${pos.x + s},${pos.y - s*0.6} ${pos.x},${pos.y + s}" 
          fill="${fill}" stroke="${stroke}" stroke-width="1.5" class="bg-center" data-center="${center}" style="cursor:pointer"/>`;
      case 'triangle-right':
        return `<polygon points="${pos.x - s*0.6},${pos.y - s} ${pos.x + s},${pos.y} ${pos.x - s*0.6},${pos.y + s}" 
          fill="${fill}" stroke="${stroke}" stroke-width="1.5" class="bg-center" data-center="${center}" style="cursor:pointer"/>`;
      case 'diamond':
        return `<polygon points="${pos.x},${pos.y - s} ${pos.x + s},${pos.y} ${pos.x},${pos.y + s} ${pos.x - s},${pos.y}" 
          fill="${fill}" stroke="${stroke}" stroke-width="1.5" class="bg-center" data-center="${center}" style="cursor:pointer"/>`;
      default: // square
        return `<rect x="${pos.x - s}" y="${pos.y - s}" width="${s*2}" height="${s*2}" rx="3"
          fill="${fill}" stroke="${stroke}" stroke-width="1.5" class="bg-center" data-center="${center}" style="cursor:pointer"/>`;
    }
  }

  function drawCenterLabel(center, pos) {
    const labels = {
      Head: 'HEAD', Ajna: 'AJNA', Throat: 'THROAT', G: 'G/SELF',
      Heart: 'HEART', SolarPlexus: 'SOLAR', Sacral: 'SACRAL', Spleen: 'SPLEEN', Root: 'ROOT'
    };
    return `<text x="${pos.x}" y="${pos.y + 4}" text-anchor="middle" 
      fill="white" font-size="7" font-weight="600" pointer-events="none" style="text-shadow:0 1px 2px rgba(0,0,0,0.5)">${labels[center] || center}</text>`;
  }

  function drawChannel(key, from, to, isActive) {
    const color = isActive ? ACTIVE_CHANNEL : INACTIVE_CHANNEL;
    const width = isActive ? 2.5 : 1;
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" 
      stroke="${color}" stroke-width="${width}" class="bg-channel" data-channel="${key}" style="cursor:pointer" stroke-linecap="round"/>`;
  }

  // BL-FIX: Escape helper for HTML content in info panel
  function esc(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function buildInfoPanel(type, key, chartData) {
    if (type === 'center') {
      const ce = window.CENTER_EXPLANATIONS?.[key];
      const ci = window.getCenterInfo ? window.getCenterInfo(key) : null;
      const isDefined = chartData.definedCenters?.includes(key);
      const motorBadge = ci?.motor ? '<span style="font-size:0.7rem;background:rgba(224,80,80,0.15);color:var(--red);padding:1px 5px;border-radius:3px;font-weight:600;margin-left:6px">MOTOR</span>' : '';
      
      return `<div style="padding:12px;background:var(--bg2);border-radius:8px;border-left:3px solid ${isDefined ? 'var(--gold)' : 'var(--text-muted)'};margin-top:8px">
        <div style="font-weight:700;font-size:0.9rem;color:${isDefined ? 'var(--gold)' : 'var(--text)'};margin-bottom:4px">${esc(key)} Center${motorBadge} <span style="font-size:0.72rem;color:var(--text-muted)">(${isDefined ? 'Defined' : 'Open'})</span></div>
        ${ci?.bio ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">🧬 ${esc(ci.bio)}</div>` : ''}
        ${ce ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">Governs: ${esc(ce.governs)}</div>` : ''}
        ${ce ? `<div style="font-size:0.83rem;color:var(--text);line-height:1.5">${esc(isDefined ? ce.defined : ce.open)}</div>` : ''}
      </div>`;
    }

    if (type === 'channel') {
      const info = window.getChannelInfo ? window.getChannelInfo(key) : null;
      const meta = window.getChannelMeta ? window.getChannelMeta(key) : null;
      const isActive = (chartData.activeChannels || []).some(ch => (ch.channel || (ch.gates?.[0] + '-' + ch.gates?.[1])) === key);
      const circuitBadge = meta?.circuit ? `<span style="font-size:0.68rem;background:rgba(106,79,200,0.15);color:var(--accent);padding:1px 6px;border-radius:3px;font-weight:600;margin-left:6px">${esc(meta.circuit)}</span>` : '';
      
      return `<div style="padding:12px;background:var(--bg2);border-radius:8px;border-left:3px solid ${isActive ? 'var(--gold)' : 'var(--border)'};margin-top:8px">
        <div style="font-weight:700;font-size:0.9rem;color:${isActive ? 'var(--gold)' : 'var(--text)'};margin-bottom:4px">Channel ${esc(key)}${circuitBadge} <span style="font-size:0.72rem;color:var(--text-muted)">(${isActive ? 'Active' : 'Dormant'})</span></div>
        ${meta?.centers ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">${meta.centers.map(c => esc(c)).join(' ↔ ')}</div>` : ''}
        ${info ? `<div style="font-size:0.85rem;font-weight:600;color:var(--text);margin-bottom:4px">${esc(info.name)}</div>` : ''}
        ${info?.desc ? `<div style="font-size:0.83rem;color:var(--text);line-height:1.5">${esc(info.desc)}</div>` : ''}
      </div>`;
    }

    return '';
  }

  /**
   * Render an interactive bodygraph SVG into a container
   * @param {string} containerId - DOM element ID
   * @param {object} chartData - chart object with definedCenters[], activeChannels[]
   */
  window.renderBodygraph = function(containerId, chartData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const chart = chartData || {};
    const defined = new Set(chart.definedCenters || []);
    const activeChannelKeys = new Set(
      (chart.activeChannels || []).map(ch => ch.channel || (ch.gates?.[0] + '-' + ch.gates?.[1]))
    );

    // Build SVG
    let svg = `<svg viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg" 
      style="width:100%;max-width:300px;height:auto;display:block;margin:0 auto" role="img" aria-label="Interactive Energy Bodygraph Chart">`;

    // Draw channels first (behind centers)
    for (const [key, centers] of Object.entries(CHANNEL_LINES)) {
      const from = CENTER_POS[centers[0]];
      const to = CENTER_POS[centers[1]];
      if (from && to) {
        svg += drawChannel(key, from, to, activeChannelKeys.has(key));
      }
    }

    // Draw centers
    for (const [center, pos] of Object.entries(CENTER_POS)) {
      svg += drawCenterShape(center, pos, defined.has(center));
      svg += drawCenterLabel(center, pos);
    }

    svg += '</svg>';

    // Info panel
    svg += '<div id="bg-info-panel" style="min-height:60px;transition:opacity 0.2s"></div>';

    container.innerHTML = svg;

    // Wire click events
    container.querySelectorAll('.bg-center').forEach(el => {
      el.addEventListener('click', () => {
        const name = el.dataset.center;
        const panel = document.getElementById('bg-info-panel');
        if (panel) {
          panel.innerHTML = buildInfoPanel('center', name, chart);
          panel.style.opacity = '0';
          requestAnimationFrame(() => panel.style.opacity = '1');
        }
      });
    });

    container.querySelectorAll('.bg-channel').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = el.dataset.channel;
        const panel = document.getElementById('bg-info-panel');
        if (panel) {
          panel.innerHTML = buildInfoPanel('channel', key, chart);
          panel.style.opacity = '0';
          requestAnimationFrame(() => panel.style.opacity = '1');
        }
      });
    });
  };
})();
