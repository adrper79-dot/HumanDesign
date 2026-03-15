/**
 * Interactive Bodygraph Component
 *
 * Renders an SVG Energy Bodygraph with:
 * - 9 clickable energy centers (defined = filled gold, open = outline)
 * - 36 channels highlighted when active
 * - Clickable gate number badges positioned around each center
 * - Click-to-explain: center, channel, or gate shows a rich insight panel
 * - Personality gates (conscious, shown in gold) vs Design gates (unconscious, dimmer)
 *
 * Usage: renderBodygraph(containerId, chartData)
 * Dependencies: explanations.js (CENTER_EXPLANATIONS, GATE_EXPLANATIONS, CHANNEL_DESCRIPTIONS)
 *               hd-data.js (HD_CENTERS, HD_CHANNELS_META, HD_GATE_TO_CENTER)
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
    if (type === 'gate') {
      const gNum = parseInt(key);
      const name = window.GATE_NAMES?.[gNum] || window.getGateName?.(gNum) || '';
      const expl = window.GATE_EXPLANATIONS?.[gNum] || '';
      const theme = window.GATE_THEMES?.[gNum] || '';
      const center = window.HD_GATE_TO_CENTER?.[gNum] || '';
      const hexName = window.getGateHex?.(gNum) || '';

      // Determine conscious/unconscious/both
      const activations = chartData.gateActivations?.[gNum] || chartData.gateActivations?.[String(gNum)] || {};
      const isPersonality = !!activations.personality;
      const isDesign = !!activations.design;
      const sideLabel = (isPersonality && isDesign) ? 'Conscious + Unconscious'
                      : isPersonality ? 'Conscious (Personality)'
                      : isDesign ? 'Unconscious (Design)'
                      : 'Not activated';
      const sideColor = (isPersonality && isDesign) ? 'var(--gold)'
                      : isPersonality ? 'var(--accent2)'
                      : isDesign ? 'var(--text-muted)'
                      : 'var(--text-dim)';
      const borderColor = (isPersonality || isDesign) ? 'var(--gold)' : 'var(--border)';

      // Find which planets activated this gate
      const pPlanets = [], dPlanets = [];
      if (chartData.personalityGates) {
        for (const [planet, data] of Object.entries(chartData.personalityGates)) {
          if (data?.gate === gNum || data?.gate === String(gNum)) pPlanets.push(planet);
        }
      }
      if (chartData.designGates) {
        for (const [planet, data] of Object.entries(chartData.designGates)) {
          if (data?.gate === gNum || data?.gate === String(gNum)) dPlanets.push(planet);
        }
      }
      const planetHints = [
        pPlanets.length ? `<span style="color:var(--accent2)">◉ ${esc(pPlanets.join(', '))} (Conscious)</span>` : '',
        dPlanets.length ? `<span style="color:var(--text-muted)">◉ ${esc(dPlanets.join(', '))} (Unconscious)</span>` : ''
      ].filter(Boolean).join(' · ');

      const inTransit = (chartData.transitGates || []).includes(gNum) || (chartData.transitGates || []).includes(String(gNum));
      const transitBadge = inTransit ? `<span style="font-size:0.68rem;background:rgba(74,200,130,0.15);color:var(--accent2);padding:1px 6px;border-radius:3px;font-weight:600;margin-left:6px">☽ IN TRANSIT TODAY</span>` : '';

      return `<div style="padding:14px;background:var(--bg2);border-radius:8px;border-left:3px solid ${borderColor};margin-top:8px">
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:6px">
          <span style="font-weight:700;font-size:0.92rem;color:var(--gold)">Gate ${esc(String(gNum))}${transitBadge}</span>
          ${center ? `<span style="font-size:0.7rem;color:var(--text-muted);margin-left:4px">· ${esc(center)} Center</span>` : ''}
          <span style="font-size:0.7rem;color:${sideColor};margin-left:auto;white-space:nowrap">${esc(sideLabel)}</span>
        </div>
        ${name ? `<div style="font-size:0.88rem;font-weight:600;color:var(--text);margin-bottom:2px">"${esc(name)}"${hexName && hexName !== name ? ` <span style="font-size:0.75rem;color:var(--text-dim)">(I Ching: ${esc(hexName)})</span>` : ''}</div>` : ''}
        ${theme ? `<div style="font-size:0.74rem;color:var(--text-dim);font-style:italic;margin-bottom:8px">${esc(theme)}</div>` : ''}
        ${expl ? `<div style="font-size:0.83rem;color:var(--text);line-height:1.6;margin-bottom:8px">${esc(expl)}</div>` : ''}
        ${planetHints ? `<div style="font-size:0.72rem;margin-top:4px;display:flex;gap:6px;flex-wrap:wrap">${planetHints}</div>` : ''}
      </div>`;
    }

    if (type === 'center') {
      const ce = window.CENTER_EXPLANATIONS?.[key];
      const ci = window.getCenterInfo ? window.getCenterInfo(key) : null;
      const isDefined = (chartData.definedCenters || []).includes(key);
      const motorBadge = ci?.motor ? '<span style="font-size:0.7rem;background:rgba(224,80,80,0.15);color:var(--red,#e05050);padding:1px 5px;border-radius:3px;font-weight:600;margin-left:6px">MOTOR</span>' : '';

      // Get user's activated gates in this center
      const centerGates = ci?.gates || window.HD_CENTERS?.[key]?.gates || [];
      const activatedInCenter = centerGates.filter(g => {
        const act = chartData.gateActivations?.[g] || chartData.gateActivations?.[String(g)];
        return act && (act.personality || act.design);
      });
      const activatedGatesHtml = activatedInCenter.length
        ? `<div style="margin-top:8px">
            <div style="font-size:0.73rem;color:var(--text-muted);margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">Your Gates in This Center</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${activatedInCenter.map(g => {
                const act = chartData.gateActivations?.[g] || chartData.gateActivations?.[String(g)] || {};
                const gname = window.GATE_NAMES?.[g] || '';
                const gtheme = window.GATE_THEMES?.[g] || '';
                const color = (act.personality && act.design) ? 'var(--gold)' : act.personality ? 'var(--accent2)' : 'var(--text-muted)';
                return `<div style="background:var(--bg3);border-radius:6px;padding:6px 8px;font-size:0.78rem;border-left:2px solid ${color};min-width:120px;cursor:pointer" data-click-gate="${esc(String(g))}">
                  <span style="color:${color};font-weight:700">Gate ${g}</span>
                  ${gname ? `<span style="color:var(--text-dim);font-size:0.72rem;"> – ${esc(gname)}</span>` : ''}
                  ${gtheme ? `<div style="color:var(--text-dim);font-size:0.7rem;margin-top:2px;font-style:italic">${esc(gtheme.length > 55 ? gtheme.slice(0, 55) + '…' : gtheme)}</div>` : ''}
                </div>`;
              }).join('')}
            </div>
          </div>`
        : '';

      return `<div style="padding:14px;background:var(--bg2);border-radius:8px;border-left:3px solid ${isDefined ? 'var(--gold)' : 'var(--text-muted)'};margin-top:8px">
        <div style="font-weight:700;font-size:0.92rem;color:${isDefined ? 'var(--gold)' : 'var(--text)'};margin-bottom:4px">${esc(key)} Center${motorBadge} <span style="font-size:0.72rem;color:var(--text-muted)">(${isDefined ? 'Defined — consistent energy' : 'Open — sampling energy'})</span></div>
        ${ci?.bio ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">🧬 ${esc(ci.bio)}</div>` : ''}
        ${ce ? `<div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:6px">Governs: ${esc(ce.governs)}</div>` : ''}
        ${ce ? `<div style="font-size:0.83rem;color:var(--text);line-height:1.55">${esc(isDefined ? ce.defined : ce.open)}</div>` : ''}
        ${activatedGatesHtml}
        <div style="font-size:0.7rem;color:var(--text-dim);margin-top:8px">💡 Tap any gate above or a gate badge on the chart for deeper detail</div>
      </div>`;
    }

    if (type === 'channel') {
      const info = window.getChannelInfo ? window.getChannelInfo(key) : null;
      const meta = window.getChannelMeta ? window.getChannelMeta(key) : null;
      const isActive = (chartData.activeChannels || []).some(ch => (ch.channel || (ch.gates?.[0] + '-' + ch.gates?.[1])) === key);
      const circuitBadge = meta?.circuit ? `<span style="font-size:0.68rem;background:rgba(74,130,240,0.15);color:var(--accent);padding:1px 6px;border-radius:3px;font-weight:600;margin-left:6px">${esc(meta.circuit)}</span>` : '';

      // Gate details for the two gates in this channel
      const gateDetails = (meta?.gates || []).map(g => {
        const act = chartData.gateActivations?.[g] || chartData.gateActivations?.[String(g)];
        const isActivated = act && (act.personality || act.design);
        const color = isActivated ? ((act.personality && act.design) ? 'var(--gold)' : act.personality ? 'var(--accent2)' : 'var(--text-dim)') : 'var(--border)';
        const gname = window.GATE_NAMES?.[g] || '';
        const expl = window.GATE_EXPLANATIONS?.[g] || '';
        return `<div style="background:var(--bg3);border-radius:6px;padding:8px;border-left:2px solid ${color};flex:1;min-width:0;cursor:pointer" data-click-gate="${esc(String(g))}">
          <div style="font-size:0.78rem;font-weight:700;color:${color}">Gate ${g}${isActivated ? '' : ' <span style="opacity:0.5">(dormant)</span>'}</div>
          ${gname ? `<div style="font-size:0.73rem;color:var(--text-dim)">"${esc(gname)}"</div>` : ''}
          ${isActivated && expl ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:4px;line-height:1.4">${esc(expl.length > 80 ? expl.slice(0, 80) + '…' : expl)}</div>` : ''}
        </div>`;
      }).join('');

      return `<div style="padding:14px;background:var(--bg2);border-radius:8px;border-left:3px solid ${isActive ? 'var(--gold)' : 'var(--border)'};margin-top:8px">
        <div style="font-weight:700;font-size:0.92rem;color:${isActive ? 'var(--gold)' : 'var(--text)'};margin-bottom:4px">Channel ${esc(key)}${circuitBadge} <span style="font-size:0.72rem;color:var(--text-muted)">(${isActive ? 'Fully Active — both gates defined' : 'Incomplete — only one or no gates'})</span></div>
        ${meta?.centers ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">Connects: ${meta.centers.map(c => esc(c)).join(' ↔ ')}</div>` : ''}
        ${info ? `<div style="font-size:0.86rem;font-weight:600;color:var(--text);margin-bottom:4px">${esc(info.name)}</div>` : ''}
        ${info?.desc ? `<div style="font-size:0.83rem;color:var(--text);line-height:1.5;margin-bottom:8px">${esc(info.desc)}</div>` : ''}
        ${gateDetails ? `<div style="display:flex;gap:8px;margin-top:4px">${gateDetails}</div>` : ''}
        ${isActive ? '<div style="font-size:0.7rem;color:var(--accent2);margin-top:8px">✓ This channel creates a defined circuit between two centers in your design</div>' : ''}
      </div>`;
    }

    return '';
  }


  // Gate badge offsets: for each center, position gate numbers around the shape
  // Offsets are relative to center (x, y).
  // 12 positions to cover the Throat center (max 11 gates) without wrapping overlap.
  const GATE_OFFSETS = [
    { dx: -34, dy: 0   }, // left
    { dx:  34, dy: 0   }, // right
    { dx:   0, dy: -28 }, // top
    { dx:   0, dy:  28 }, // bottom
    { dx: -28, dy: -18 }, // upper-left
    { dx:  28, dy: -18 }, // upper-right
    { dx: -28, dy:  18 }, // lower-left
    { dx:  28, dy:  18 }, // lower-right
    { dx: -38, dy: -28 }, // far upper-left
    { dx:  38, dy: -28 }, // far upper-right
    { dx: -20, dy:  36 }, // far lower-left
    { dx:  20, dy:  36 }, // far lower-right
  ];

  function drawGateBadges(center, pos, chartData, transitGateSet) {
    const centerGates = window.HD_CENTERS?.[center]?.gates || [];
    let badges = '';
    let idx = 0;
    for (const g of centerGates) {
      const act = chartData.gateActivations?.[g] || chartData.gateActivations?.[String(g)];
      const isActivated = act && (act.personality || act.design);
      const inTransit = transitGateSet.has(g);
      if (!isActivated && !inTransit) continue; // only render badges for activated or transiting gates

      const off = GATE_OFFSETS[idx % GATE_OFFSETS.length];
      idx++;
      const bx = pos.x + off.dx;
      const by = pos.y + off.dy;

      // Color logic: personality=gold/green, design=dimmer, transit=teal, both=bright gold
      let fillColor, textColor, strokeColor;
      if (inTransit && !isActivated) {
        fillColor = 'rgba(74,200,130,0.15)'; textColor = '#4ac882'; strokeColor = '#4ac882';
      } else if (act?.personality && act?.design) {
        fillColor = 'rgba(201,168,76,0.25)'; textColor = '#c9a84c'; strokeColor = '#c9a84c';
      } else if (act?.personality) {
        fillColor = 'rgba(74,180,120,0.18)'; textColor = '#4ab478'; strokeColor = '#4ab478';
      } else {
        fillColor = 'rgba(255,255,255,0.08)'; textColor = 'rgba(255,255,255,0.45)'; strokeColor = 'rgba(255,255,255,0.2)';
      }

      badges += `<g class="bg-gate" data-gate="${g}" style="cursor:pointer">
        <rect x="${bx - 11}" y="${by - 8}" width="22" height="16" rx="4"
          fill="${fillColor}" stroke="${strokeColor}" stroke-width="0.8"/>
        <text x="${bx}" y="${by + 5}" text-anchor="middle"
          fill="${textColor}" font-size="7.5" font-weight="700" pointer-events="none">${g}</text>
      </g>`;
    }
    return badges;
  }

  /**
   * Render an interactive bodygraph SVG into a container
   * @param {string} containerId - DOM element ID
   * @param {object} chartData - chart object with definedCenters[], activeChannels[], gateActivations{}
   */
  /** Wire data-click-gate sub-cards inside an already-rendered info panel */
  function rewireGateSubCards(panel, chart) {
    panel.querySelectorAll('[data-click-gate]').forEach(subEl => {
      subEl.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.innerHTML = buildInfoPanel('gate', subEl.dataset.clickGate, chart);
        panel.style.opacity = '0';
        requestAnimationFrame(() => panel.style.opacity = '1');
        rewireGateSubCards(panel, chart);
      });
    });
  }

  window.renderBodygraph = function(containerId, chartData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const chart = chartData || {};
    const defined = new Set(chart.definedCenters || []);
    const activeChannelKeys = new Set(
      (chart.activeChannels || []).map(ch => ch.channel || (ch.gates?.[0] + '-' + ch.gates?.[1]))
    );
    const transitGateSet = new Set((chart.transitGates || []).map(Number));

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

    // Draw gate badges on top (after all centers so they're not occluded)
    for (const [center, pos] of Object.entries(CENTER_POS)) {
      svg += drawGateBadges(center, pos, chart, transitGateSet);
    }

    svg += '</svg>';

    // Info panel
    svg += '<div id="bg-info-panel" style="min-height:60px;transition:opacity 0.2s"></div>';

    container.innerHTML = svg;

    // Helper: show panel with fade-in + wire sub-card clicks
    function showPanel(html) {
      const panel = document.getElementById('bg-info-panel');
      if (!panel) return;
      panel.innerHTML = html;
      panel.style.opacity = '0';
      requestAnimationFrame(() => panel.style.opacity = '1');
      rewireGateSubCards(panel, chart);
    }

    // Wire center clicks
    container.querySelectorAll('.bg-center').forEach(el => {
      el.addEventListener('click', () => {
        showPanel(buildInfoPanel('center', el.dataset.center, chart));
      });
    });

    // Wire channel clicks
    container.querySelectorAll('.bg-channel').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        showPanel(buildInfoPanel('channel', el.dataset.channel, chart));
      });
    });

    // Wire gate badge clicks
    container.querySelectorAll('.bg-gate').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        showPanel(buildInfoPanel('gate', el.dataset.gate, chart));
      });
    });
  };
})();
