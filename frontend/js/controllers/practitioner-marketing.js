/**
 * practitioner-marketing.js
 * Auto-extracted from frontend/js/app.js by scripts/split-app-js.mjs (GAP-001).
 *
 * Referral performance, marketing kit, gifts, earnings, promo codes, metrics, agency seats
 *
 * Depends on globals defined in app.js (always loaded first):
 *   apiFetch, token, currentUser, escapeHtml, showNotification,
 *   openAuthOverlay, switchTab, showUpgradePrompt, writeJourneyFlag, readJourneyFlag
 *
 * This file is loaded lazily via _loadController() in app.js when the
 * relevant tab is first activated.  Do not add <script> tags for this
 * file to index.html — the loader handles it.
 */
// ── Referral Performance Card (BL-EXC-P1-2) ──────────────────
function renderPractitionerReferralStats(data) {
  const el = document.getElementById('pracReferralStats');
  if (!el) return;
  if (!data?.referralUrl) { el.innerHTML = ''; return; }

  const url = escapeHtml(data.referralUrl);
  const urlAttr = escapeAttr(data.referralUrl);
  const total = parseInt(data.stats?.referralCount ?? data.referralCount ?? 0);
  const thisMonth = parseInt(data.stats?.earningsThisMonth != null ? '—' : 0);
  const earnings = data.stats?.earningsThisMonth != null
    ? `$${parseFloat(data.stats.earningsThisMonth).toFixed(2)}`
    : (data.earningsThisMonth != null ? `$${parseFloat(data.earningsThisMonth).toFixed(2)}` : '—');

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-header-row">
        <div class="card-title mb-0"><span class="nav-icon">🔗</span> Referral Performance</div>
      </div>
      <p class="card-hint">Every time someone signs up through your link and subscribes, you earn 25% commission for life.</p>
      <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3)">
        <input readonly value="${urlAttr}" id="pracRefLinkDisplay"
               style="flex:1;background:var(--bg2);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-1);padding:0.4rem 0.6rem;font-size:var(--font-size-sm);color:var(--text-dim);min-width:0"
               onclick="this.select()" />
        <button class="btn-primary btn-sm" data-action="copyPracReferralLink">Copy Link</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
        <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
          <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${total}</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-dim)">Total Referrals</div>
        </div>
        <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
          <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${earnings}</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-dim)">Earned This Month</div>
        </div>
      </div>
      <div style="border-top:var(--border-width-thin) solid var(--border);padding-top:var(--space-4);display:flex;flex-direction:column;align-items:center;gap:var(--space-3)">
        <div style="font-size:var(--font-size-sm);font-weight:600;color:var(--text)">📲 Your QR Code — share anywhere</div>
        <div style="background:#fff;padding:var(--space-2);border-radius:var(--space-2);line-height:0">
          <img id="pracQRImage" src="" alt="Referral QR Code" width="160" height="160" />
        </div>
        <button class="btn-secondary btn-sm" data-action="downloadPractitionerQR">⬇ Download QR PNG</button>
      </div>
    </div>
  `;

  // Generate QR after DOM renders (requires qr.js to be loaded)
  requestAnimationFrame(() => {
    const imgEl = document.getElementById('pracQRImage');
    if (imgEl && window.QRCode) {
      imgEl.src = window.QRCode.toDataURL(data.referralUrl, 6);
      trackEvent('practitioner', 'qr_generated', 'referral_card');
    }
  });
}

function copyPracReferralLink() {
  const val = document.getElementById('pracRefLinkDisplay')?.value;
  if (val && navigator.clipboard) {
    navigator.clipboard.writeText(val).then(() => {
      showNotification('Referral link copied!', 'success');
      trackEvent('practitioner', 'referral_link_copy', 'dashboard');
    });
  }
}
window.copyPracReferralLink = copyPracReferralLink;

function downloadPractitionerQR() {
  const imgEl = document.getElementById('pracQRImage');
  if (!imgEl?.src || imgEl.src === window.location.href) return;
  const a = document.createElement('a');
  a.href = imgEl.src;
  a.download = 'prime-self-referral-qr.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  trackEvent('practitioner', 'qr_downloaded', 'referral_card');
}
window.downloadPractitionerQR = downloadPractitionerQR;

// ── Bodygraph Chart Export (4.2) ──────────────────────────────
function downloadBodygraph(containerId, label) {
  const container = containerId ? document.getElementById(containerId) : document.querySelector('[id^="bodygraph-"]');
  const svgEl = container?.querySelector('svg');
  if (!svgEl) return;
  const filename = 'prime-self-bodygraph-' + (label || 'chart') + '.png';
  try {
    const svgStr = new XMLSerializer().serializeToString(svgEl);
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
    const img = new Image();
    img.onload = function () {
      const scale = 2; // 2× for high-DPI
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#0f0f1a';
      ctx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(function (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        trackEvent('chart', 'bodygraph_exported', 'download');
      }, 'image/png');
    };
    img.onerror = function () { showNotification('Export failed — try again', 'error'); };
    img.src = dataUrl;
  } catch (e) {
    showNotification('Export not supported in this browser', 'error');
  }
}
window.downloadBodygraph = downloadBodygraph;

function shareBodygraph() {
  const chart = window._lastChart;
  if (!chart) { showNotification('Load your chart first', 'error'); return; }
  if (typeof window.showShareCard === 'function') {
    window.showShareCard(chart);
    trackEvent('chart', 'bodygraph_shared', 'share_card');
  } else {
    showNotification('Share card not available', 'error');
  }
}
window.shareBodygraph = shareBodygraph;

// ── Marketing Kit Page (4.5) ──────────────────────────────────
function renderPractitionerMarketingKit(data) {
  const el = document.getElementById('pracMarketingKit');
  if (!el) return;
  if (!data?.referralUrl) { el.innerHTML = ''; return; }

  const baseUrl = data.referralUrl;
  const platforms = [
    { platform: 'Facebook',   id: 'utm-facebook',  icon: '📘', src: 'facebook'  },
    { platform: 'Twitter/X',  id: 'utm-twitter',   icon: '🐦', src: 'twitter'   },
    { platform: 'LinkedIn',   id: 'utm-linkedin',  icon: '💼', src: 'linkedin'  },
    { platform: 'Instagram',  id: 'utm-instagram', icon: '📸', src: 'instagram' },
    { platform: 'WhatsApp',   id: 'utm-whatsapp',  icon: '💬', src: 'whatsapp'  },
  ];

  const emailSig =
    `Discover your Energy Blueprint at Prime Self:\n` +
    `${baseUrl}?utm_source=email&utm_medium=signature&utm_campaign=referral`;

  const snippets = [
    {
      label: 'Instagram Caption', id: 'snippet-instagram',
      text: `✨ Curious about your Energy Blueprint? Discover who you truly are — your energy type, decision-making strategy, and life purpose — with a personalized reading.\nUse my link for a free chart: ${baseUrl}?utm_source=instagram&utm_medium=social&utm_campaign=referral\n#EnergyBlueprint #PrimeSelf`,
    },
    {
      label: 'Twitter/X Post', id: 'snippet-twitter',
      text: `Just discovered my Energy Blueprint with @PrimeSelf — mind-blowing insights! Get yours free: ${baseUrl}?utm_source=twitter&utm_medium=social&utm_campaign=referral`,
    },
    {
      label: 'LinkedIn Post', id: 'snippet-linkedin',
      text: `I've been exploring Energy Blueprint as a framework for understanding energy, leadership style, and decision-making. If you're curious about applied self-knowledge for professional growth, check out Prime Self — free chart here: ${baseUrl}?utm_source=linkedin&utm_medium=social&utm_campaign=referral`,
    },
  ];

  if (typeof trackEvent === 'function') trackEvent('practitioner', 'marketing_kit_viewed');

  const utmRow = ({ platform, id, icon, src }) => {
    const url = escapeAttr(`${baseUrl}?utm_source=${src}&utm_medium=social&utm_campaign=referral`);
    return `
      <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)">
        <span style="min-width:110px;font-size:var(--font-size-sm)">${icon} ${escapeHtml(platform)}</span>
        <input readonly id="${escapeAttr(id)}" value="${url}"
               style="flex:1;background:var(--bg2);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-1);padding:0.4rem 0.6rem;font-size:var(--font-size-xs);color:var(--text-dim);min-width:0"
               onclick="this.select()" />
        <button class="btn-secondary btn-sm" data-action="copyMarketingAsset" data-arg0="${escapeAttr(id)}">Copy</button>
      </div>`;
  };

  const snippetBlock = ({ label, id, text }) => `
    <div style="margin-bottom:var(--space-3)">
      <div style="font-size:var(--font-size-xs);color:var(--text-dim);margin-bottom:var(--space-1)">${escapeHtml(label)}</div>
      <textarea id="${escapeAttr(id)}" readonly rows="3"
                style="width:100%;box-sizing:border-box;background:var(--bg2);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-1);padding:0.5rem;font-size:var(--font-size-xs);color:var(--text-dim);resize:none"
                onclick="this.select()">${escapeHtml(text)}</textarea>
      <button class="btn-secondary btn-sm" style="margin-top:var(--space-1)"
              data-action="copyMarketingAsset" data-arg0="${escapeAttr(id)}">Copy</button>
    </div>`;

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-header-row">
        <div class="card-title mb-0"><span class="nav-icon">📦</span> Marketing Kit</div>
      </div>
      <p class="card-hint">Ready-to-use assets for growing your practice. Each link is tracked so you can see which channels bring clients.</p>
      <div style="margin-bottom:var(--space-5)">
        <div style="font-weight:600;margin-bottom:var(--space-3)">📊 Platform Tracked Links</div>
        ${platforms.map(utmRow).join('')}
      </div>
      <div style="margin-bottom:var(--space-5)">
        <div style="font-weight:600;margin-bottom:var(--space-2)">✉️ Email Signature</div>
        <textarea id="mkt-email-sig" readonly rows="2"
                  style="width:100%;box-sizing:border-box;background:var(--bg2);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-1);padding:0.5rem;font-size:var(--font-size-xs);color:var(--text-dim);resize:none;font-family:monospace"
                  onclick="this.select()">${escapeHtml(emailSig)}</textarea>
        <button class="btn-secondary btn-sm" style="margin-top:var(--space-1)"
                data-action="copyMarketingAsset" data-arg0="mkt-email-sig">Copy Signature</button>
      </div>
      <div>
        <div style="font-weight:600;margin-bottom:var(--space-2)">📝 Social Share Snippets</div>
        ${snippets.map(snippetBlock).join('')}
      </div>
    </div>
  `;
}

function copyMarketingAsset(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.value ?? el.textContent ?? '';
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Copied!', 'success');
    const assetType = String(elementId).replace(/^(utm-|snippet-|mkt-)/, '').replace(/-.*$/, '');
    if (typeof trackEvent === 'function') trackEvent('practitioner', 'marketing_asset_copied', assetType);
  }).catch(() => showNotification('Copy failed — please select and copy manually', 'error'));
}
window.copyMarketingAsset = copyMarketingAsset;

// ── Gift-a-Reading (4.6) ──────────────────────────────────────
async function loadPractitionerGifts() {
  const el = document.getElementById('pracGiftLinks');
  if (!el) return;
  try {
    const data = await apiFetch('/api/practitioner/gifts').catch(() => ({ gifts: [] }));
    renderPractitionerGifts(data?.gifts ?? []);
  } catch {
    renderPractitionerGifts([]);
  }
}

function renderPractitionerGifts(gifts) {
  const el = document.getElementById('pracGiftLinks');
  if (!el) return;

  const giftRows = Array.isArray(gifts) && gifts.length
    ? gifts.map(g => {
        const status = g.redeemed_at
          ? `<span style="color:var(--success,#27ae60)">✓ Redeemed ${escapeHtml(new Date(g.redeemed_at).toLocaleDateString())}</span>`
          : (new Date(g.expires_at) < new Date()
              ? `<span style="color:var(--error,#e74c3c)">Expired</span>`
              : `<span style="color:var(--text-dim)">Pending</span>`);
        const giftUrl = `${window.location.origin}/?gift=${escapeHtml(g.token)}`;
        return `
          <tr>
            <td style="font-size:var(--font-size-xs);color:var(--text-dim);padding:var(--space-2)">${escapeHtml(new Date(g.created_at).toLocaleDateString())}</td>
            <td style="font-size:var(--font-size-xs);padding:var(--space-2)">
              <input readonly value="${escapeAttr(giftUrl)}"
                     style="background:var(--bg2);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-1);padding:0.2rem 0.4rem;font-size:var(--font-size-xs);color:var(--text-dim);width:100%;min-width:0"
                     onclick="this.select()" />
            </td>
            <td style="font-size:var(--font-size-xs);padding:var(--space-2)">${status}</td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="3" style="text-align:center;color:var(--text-dim);font-size:var(--font-size-sm);padding:var(--space-3)">No gifts yet — create your first one below.</td></tr>`;

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-header-row">
        <div class="card-title mb-0"><span class="nav-icon">🎁</span> Gift-a-Reading</div>
      </div>
      <p class="card-hint">Send a free chart + intro session to anyone — great for leads, podcast appearances, or gestures of generosity.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:var(--space-4)">
        <thead>
          <tr style="border-bottom:var(--border-width-thin) solid var(--border)">
            <th style="text-align:left;font-size:var(--font-size-xs);color:var(--text-dim);padding:var(--space-2)">Created</th>
            <th style="text-align:left;font-size:var(--font-size-xs);color:var(--text-dim);padding:var(--space-2)">Gift Link</th>
            <th style="text-align:left;font-size:var(--font-size-xs);color:var(--text-dim);padding:var(--space-2)">Status</th>
          </tr>
        </thead>
        <tbody>${giftRows}</tbody>
      </table>
      <div style="display:flex;align-items:flex-start;gap:var(--space-3);flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <label style="font-size:var(--font-size-xs);color:var(--text-dim);display:block;margin-bottom:var(--space-1)">Personal message (optional)</label>
          <textarea id="giftMessage" rows="2" placeholder="e.g. Enjoy your free Energy Blueprint reading!"
                    style="width:100%;box-sizing:border-box;background:var(--bg2);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-1);padding:0.5rem;font-size:var(--font-size-sm);color:var(--text);resize:none"></textarea>
        </div>
        <button class="btn-primary btn-sm" style="align-self:flex-end" data-action="createGiftLink">+ Create Gift Link</button>
      </div>
    </div>
  `;
}

async function createGiftLink() {
  const msgEl = document.getElementById('giftMessage');
  const message = msgEl?.value?.trim() || null;
  try {
    const data = await apiFetch('/api/practitioner/gifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (data?.giftUrl) {
      if (msgEl) msgEl.value = '';
      showNotification('Gift link created!', 'success');
      trackEvent('practitioner', 'gift_created', 'dashboard');
      await loadPractitionerGifts();
    } else {
      showNotification('Failed to create gift link', 'error');
    }
  } catch (e) {
    showNotification('Error creating gift link', 'error');
  }
}
window.createGiftLink = createGiftLink;

// ── Practitioner Earnings Card (ITEM-1.8) ─────────────────────
function renderPractitionerEarnings(data) {
  const el = document.getElementById('pracEarningsCard');
  if (!el) return;
  const s = data?.stats;
  if (!s) { el.innerHTML = ''; return; }

  const totalReferrals = parseInt(s.totalReferrals ?? 0);
  const converted = parseInt(s.convertedReferrals ?? 0);
  const pendingRewards = parseInt(s.pendingRewards ?? 0);
  const totalValue = parseInt(s.totalRewardValue ?? 0);
  const ytdCredits = `$${(totalValue / 100).toFixed(2)}`;

  trackEvent('practitioner', 'earnings_card_viewed', 'dashboard');

  const stat = (value, label) => `
    <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
      <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${value}</div>
      <div style="font-size:var(--font-size-xs);color:var(--text-dim)">${label}</div>
    </div>`;

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-header-row">
        <div class="card-title mb-0"><span class="nav-icon">💰</span> Revenue &amp; Earnings</div>
      </div>
      <p class="card-hint">Earn 25% lifetime commission on every referred subscriber. Credits are applied to your Stripe balance automatically.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:var(--space-3);margin-top:var(--space-3)">
        ${stat(ytdCredits, 'Total Credits Earned')}
        ${stat(totalReferrals, 'Total Referrals')}
        ${stat(converted, 'Converted')}
        ${stat(pendingRewards, 'Pending Rewards')}
      </div>
    </div>
  `;
}

// ── Practitioner Promo Code (ITEM-1.9) ───────────────────────
async function loadPractitionerPromo() {
  const el = document.getElementById('pracPromoCard');
  if (!el) return;
  try {
    const data = await apiFetch('/api/practitioner/promo');
    renderPractitionerPromo(data?.promo);
  } catch {
    renderPractitionerPromo(null);
  }
}

function renderPractitionerPromo(promo) {
  const el = document.getElementById('pracPromoCard');
  if (!el) return;

  if (promo) {
    const code = escapeHtml(promo.code);
    const disc = parseInt(promo.discount_value);
    const used = parseInt(promo.redemptions || 0);
    const max = promo.max_redemptions ? parseInt(promo.max_redemptions) : '∞';
    const expires = promo.valid_until ? new Date(promo.valid_until).toLocaleDateString() : 'Never';
    el.innerHTML = `
      <div class="card" style="margin-bottom:var(--space-4)">
        <div class="card-header-row">
          <div class="card-title mb-0"><span class="nav-icon">🏷️</span> Your Promo Code</div>
          <button class="btn-secondary btn-sm" data-action="deactivatePractitionerPromo" data-arg0="${escapeAttr(promo.id)}" style="color:var(--error)">Deactivate</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:var(--space-3);margin-top:var(--space-3)">
          <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
            <div style="font-size:1.4rem;font-weight:700;color:var(--gold);font-family:monospace">${code}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-dim)">Code</div>
          </div>
          <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
            <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${disc}%</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-dim)">Discount</div>
          </div>
          <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
            <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${used} / ${max}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-dim)">Redemptions</div>
          </div>
          <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
            <div style="font-size:1.2rem;font-weight:700;color:var(--gold)">${expires}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-dim)">Expires</div>
          </div>
        </div>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="card" style="margin-bottom:var(--space-4)">
        <div class="card-header-row">
          <div class="card-title mb-0"><span class="nav-icon">🏷️</span> Create Promo Code</div>
        </div>
        <p class="card-hint">Create a discount code for your clients. 10-50% off their first month.</p>
        <div style="display:grid;gap:var(--space-2);max-width:360px">
          <input id="pracPromoCode" placeholder="e.g. JANE20" maxlength="32" style="text-transform:uppercase" />
          <label style="font-size:var(--font-size-sm);color:var(--text-dim)">Discount %</label>
          <input id="pracPromoDiscount" type="number" min="10" max="50" value="20" />
          <label style="font-size:var(--font-size-sm);color:var(--text-dim)">Max redemptions (optional)</label>
          <input id="pracPromoMax" type="number" min="1" max="1000" placeholder="100" />
          <label style="font-size:var(--font-size-sm);color:var(--text-dim)">Expiry date (optional)</label>
          <input id="pracPromoExpiry" type="date" />
          <button class="btn-primary" data-action="createPractitionerPromo" style="margin-top:var(--space-2)">Create Code</button>
        </div>
        <div id="pracPromoError" style="color:var(--error);margin-top:var(--space-2);font-size:var(--font-size-sm)"></div>
      </div>`;
  }
}

async function createPractitionerPromo() {
  const code = document.getElementById('pracPromoCode')?.value?.trim();
  const discount = document.getElementById('pracPromoDiscount')?.value;
  const max = document.getElementById('pracPromoMax')?.value;
  const expiry = document.getElementById('pracPromoExpiry')?.value;
  const errEl = document.getElementById('pracPromoError');

  if (!code) { if (errEl) errEl.textContent = 'Enter a promo code'; return; }

  try {
    if (errEl) errEl.textContent = '';
    const resp = await apiFetch('/api/practitioner/promo', {
      method: 'POST',
      body: JSON.stringify({
        code,
        discount_value: parseInt(discount) || 20,
        max_redemptions: max ? parseInt(max) : null,
        valid_until: expiry || null
      })
    });
    showNotification('Promo code created!', 'success');
    renderPractitionerPromo(resp.promo);
  } catch (e) {
    if (errEl) errEl.textContent = e.message || 'Failed to create promo code';
  }
}
window.createPractitionerPromo = createPractitionerPromo;

async function deactivatePractitionerPromo(promoId) {
  if (!confirm('Deactivate this promo code? Clients will no longer be able to use it.')) return;
  try {
    await apiFetch(`/api/practitioner/promo/${encodeURIComponent(promoId)}`, { method: 'DELETE' });
    showNotification('Promo code deactivated', 'success');
    renderPractitionerPromo(null);
  } catch (e) {
    showNotification(e.message || 'Failed to deactivate', 'error');
  }
}
window.deactivatePractitionerPromo = deactivatePractitionerPromo;

// ── Practitioner Metrics Card (PRAC-012) ─────────────────────
function renderPractitionerMetrics(data, dirData) {
  const el = document.getElementById('pracMetricsCard');
  if (!el) return;
  const s = data?.stats;
  if (!s) { el.innerHTML = ''; return; }

  const profileViews = dirData?.stats?.profileViews30d ?? '—';
  const stat = (value, label) => `
    <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
      <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${value}</div>
      <div style="font-size:var(--font-size-xs);color:var(--text-dim)">${label}</div>
    </div>`;

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-header-row">
        <div class="card-title mb-0"><span class="nav-icon">📊</span> Practice Metrics</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:var(--space-3);margin-top:var(--space-3)">
        ${stat(s.activeClients, 'Active Clients')}
        ${stat(s.notesThisMonth, 'Notes This Month')}
        ${stat(s.totalNotes, 'Total Notes')}
        ${stat(s.aiSharedNotes, 'AI-Shared Notes')}
        ${stat(profileViews, 'Profile Views (30d)')}
      </div>
    </div>
  `;
}

// ── Agency Seat Management ────────────────────────────────────

async function loadAgencySeats() {
  if (!token) return;
  const resultEl = document.getElementById('agencySeatsResult');
  if (!resultEl) return;
  resultEl.innerHTML = '<div style="color:var(--text-dim);font-size:var(--font-size-sm)">Loading seats…</div>';
  try {
    const data = await apiFetch('/api/agency/seats');
    resultEl.innerHTML = renderAgencySeats(data);
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  }
}

function renderAgencySeats(data) {
  const seats = data.seats || [];
  const limit = data.limit || 5;
  const count = seats.length;

  let html = `<div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-3)">${count} of ${limit} seats used</div>`;

  if (!seats.length) {
    return html + `<div style="color:var(--text-dim);font-size:var(--font-size-sm);padding:var(--space-3) 0">No seat members yet. Add a practitioner by email above.</div>`;
  }

  seats.forEach(seat => {
    const email    = escapeHtml(seat.member_email || seat.invited_email || '');
    const accepted = seat.accepted_at
      ? `<span style="color:var(--success,#27ae60);font-size:var(--font-size-sm)">Active</span>`
      : `<span style="color:var(--text-dim);font-size:var(--font-size-sm)">Pending</span>`;
    const memberId = escapeAttr(seat.member_user_id || seat.id);

    html += `<div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) 0;border-bottom:var(--border-width-thin) solid var(--border);flex-wrap:wrap">
      <div style="flex:1;min-width:160px">
        <div style="font-weight:600;color:var(--text)">${email}</div>
        <div>${accepted}</div>
      </div>
      <button class="btn-danger btn-sm" data-action="removeAgencySeat" data-arg0="${memberId}" data-arg1="${email}">Remove</button>
    </div>`;
  });

  return html;
}

async function inviteAgencySeat() {
  const emailInput = document.getElementById('agencySeatEmail');
  const statusEl   = document.getElementById('agencySeatStatus');
  const email = (emailInput?.value || '').trim();

  if (!email) {
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-warn">Please enter an email address.</div>`;
    return;
  }
  if (!token) { openAuthOverlay(); return; }

  try {
    const data = await apiFetch('/api/agency/seats/invite', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-success">${escapeHtml(data.message || 'Seat added!')}</div>`;
    if (emailInput) emailInput.value = '';
    loadAgencySeats();
    setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 4000);
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

async function removeAgencySeat(memberId, emailLabel) {
  if (!confirm(`Remove ${emailLabel || 'this seat member'} from your agency?`)) return;
  if (!token) { openAuthOverlay(); return; }

  try {
    await apiFetch(`/api/agency/seats/${memberId}`, { method: 'DELETE' });
    showNotification('Seat member removed.', 'success');
    loadAgencySeats();
  } catch (e) {
    showNotification(e.message || 'Failed to remove seat', 'error');
  }
}

function renderPractitionerActivationPlan({ rosterData, profileData, invitationsData, directoryData, metricsData }) {
  const container = document.getElementById('pracActivationPlan');
  if (!container) return;

  const clients = Array.isArray(rosterData?.clients) ? rosterData.clients : [];
  const invitations = Array.isArray(invitationsData?.invitations) ? invitationsData.invitations : [];
  const directoryProfile = directoryData?.profile || null;
  const practitioner = profileData?.practitioner || null;
  const stats = metricsData?.stats || {};

  const directoryReady = !!(directoryProfile?.display_name && directoryProfile?.bio && directoryProfile?.booking_url);
  const hasClientOrInvite = clients.length > 0 || invitations.length > 0;
  const chartReadyClient = clients.find(client => !!client.chart_id) || null;
  const hasFirstNote = parseInt(stats.totalNotes ?? 0) > 0;
  const sessionReadyClient = clients.find(client => !!client.chart_id && !!client.profile_id) || null;

  const checklist = [
    {
      key: 'profile',
      done: directoryReady,
      title: 'Complete your public profile',
      description: directoryReady
        ? 'Your profile basics and booking path are in place.'
        : 'Add your public name, bio, and booking URL so your workspace can convert attention into bookings.',
      cta: !directoryReady ? '<button class="btn-secondary btn-sm" data-action="toggleDirectoryForm">Edit Profile</button>' : ''
    },
    {
      key: 'invite',
      done: hasClientOrInvite,
      title: 'Add or invite your first client',
      description: hasClientOrInvite
        ? `Your workspace already has ${clients.length} client${clients.length === 1 ? '' : 's'} and ${invitations.length} pending invite${invitations.length === 1 ? '' : 's'}.`
        : 'Bring in your first client so the portal becomes a working session workspace.',
      cta: !hasClientOrInvite ? '<button class="btn-primary btn-sm" data-action="togglePracAddForm">Invite First Client</button>' : ''
    },
    {
      key: 'chart',
      done: !!chartReadyClient,
      title: 'Get a client chart into the workspace',
      description: chartReadyClient
        ? 'At least one client has generated their chart and is ready for review.'
        : 'You have clients in motion, but no chart is available yet. The next step is client birth-data completion and chart generation.',
      cta: (!chartReadyClient && clients[0])
        ? `<button class="btn-secondary btn-sm" data-action="viewClientDetail" data-arg0="${escapeAttr(clients[0].id)}" data-arg1="${escapeAttr(clients[0].email || '')}">Open First Client</button>`
        : ''
    },
    {
      key: 'note',
      done: hasFirstNote,
      title: 'Write your first session note',
      description: hasFirstNote
        ? `You have ${stats.totalNotes} session note${stats.totalNotes === 1 ? '' : 's'} — your practice knowledge base is growing.`
        : 'Session notes capture your observations and build a running record for each client.',
      cta: (!hasFirstNote && chartReadyClient)
        ? `<button class="btn-secondary btn-sm" data-action="viewClientDetail" data-arg0="${escapeAttr(chartReadyClient.id)}" data-arg1="${escapeAttr(chartReadyClient.email || '')}">Open Client → Add Note</button>`
        : ''
    },
    {
      key: 'brief',
      done: !!sessionReadyClient,
      title: 'Generate your first session brief',
      description: sessionReadyClient
        ? 'A client has chart and profile ready — you can generate AI session prep briefs for focused, efficient sessions.'
        : 'Once a client has both a chart and profile, you can generate AI-powered session prep briefs.',
      cta: sessionReadyClient
        ? `<button class="btn-secondary btn-sm" data-action="viewClientDetail" data-arg0="${escapeAttr(sessionReadyClient.id)}" data-arg1="${escapeAttr(sessionReadyClient.email || '')}">Open Session Workspace</button>`
        : ''
    }
  ];

  const completed = checklist.filter(item => item.done).length;
  const nextStep = checklist.find(item => !item.done) || null;
  const practitionerName = practitioner?.display_name || practitioner?.business_name || 'Practitioner';

  // Analytics: fire activation_step_completed for newly-completed steps
  const storageKey = 'ps_activation_steps_fired';
  const firedRaw = localStorage.getItem(storageKey);
  const fired = firedRaw ? JSON.parse(firedRaw) : [];
  checklist.forEach(item => {
    if (item.done && !fired.includes(item.key)) {
      fired.push(item.key);
      trackEvent?.('practitioner', 'activation_step_completed', item.key);
    }
  });
  localStorage.setItem(storageKey, JSON.stringify(fired));
  // Fire activation_checklist_complete once when all steps done
  if (completed === checklist.length && !localStorage.getItem('ps_activation_complete_fired')) {
    localStorage.setItem('ps_activation_complete_fired', '1');
    trackEvent?.('practitioner', 'activation_checklist_complete', `${checklist.length}_steps`);
  }

  container.innerHTML = `
    <div class="card" style="border-top:3px solid var(--gold)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-3);flex-wrap:wrap">
        <div>
          <div class="card-title" style="margin-bottom:var(--space-2)"><span class="icon-check"></span> Activation Plan</div>
          <p style="margin:0;color:var(--text-dim);line-height:1.6;font-size:var(--font-size-sm)">${escapeHtml(practitionerName)} is ${completed === checklist.length ? 'fully operational.' : 'still in setup.'} Complete the core milestones below to turn this portal into a repeatable practitioner workflow.</p>
        </div>
        <div style="min-width:120px;text-align:right">
          <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--gold)">${completed}/${checklist.length}</div>
          <div style="font-size:var(--font-size-sm);color:var(--text-dim)">core milestones</div>
        </div>
      </div>
      ${nextStep ? `<div style="margin-top:var(--space-3);padding:var(--space-3);border:var(--border-width-thin) solid rgba(212,175,55,0.22);border-radius:var(--space-2);background:rgba(212,175,55,0.08)"><strong style="color:var(--text)">Next step:</strong> <span style="color:var(--text-dim)">${escapeHtml(nextStep.title)}</span></div>` : '<div style="margin-top:var(--space-3);padding:var(--space-3);border:var(--border-width-thin) solid rgba(82,196,26,0.22);border-radius:var(--space-2);background:rgba(82,196,26,0.08);color:var(--text)">Your practitioner workspace is fully activated — every milestone is complete.</div>'}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--space-3);margin-top:var(--space-4)">
        ${checklist.map(item => `
          <div style="padding:var(--space-3);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-2);background:var(--bg3)">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);margin-bottom:var(--space-2)">
              <strong style="font-size:var(--font-size-sm);color:var(--text)">${escapeHtml(item.title)}</strong>
              ${renderPractitionerLifecycleBadge(item.done ? 'done' : 'next')}
            </div>
            <div style="font-size:var(--font-size-sm);color:var(--text-dim);line-height:1.6">${escapeHtml(item.description)}</div>
            ${item.cta ? `<div style="margin-top:var(--space-3)">${item.cta}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>`;
}

function getPractitionerClientLifecycle(client) {
  if (!client?.birth_date) {
    return {
      key: 'needs_birth_data',
      label: 'Needs birth data',
      tone: 'warning',
      nextStep: 'Client account exists, but birth details are not complete yet.'
    };
  }

  if (!client?.chart_id) {
    return {
      key: 'needs_chart',
      label: 'Needs chart',
      tone: 'info',
      nextStep: 'Birth details are present. Next step is chart generation.'
    };
  }

  if (!client?.profile_id) {
    return {
      key: 'needs_profile',
      label: 'Needs profile',
      tone: 'info',
      nextStep: 'Chart is ready. Generate or refresh the profile synthesis before the session.'
    };
  }

  return {
    key: 'session_ready',
    label: 'Session ready',
    tone: 'success',
    nextStep: 'Chart and profile are ready for session prep, notes, and export.'
  };
}

function renderPractitionerLifecycleBadge(tone) {
  const config = {
    success: { label: 'Ready', bg: 'rgba(46, 204, 113, 0.16)', color: 'var(--accent2)' },
    warning: { label: 'Action', bg: 'rgba(212, 175, 55, 0.14)', color: 'var(--gold)' },
    info: { label: 'In Progress', bg: 'rgba(91, 143, 249, 0.16)', color: '#8fb8ff' },
    next: { label: 'Next', bg: 'rgba(212, 175, 55, 0.14)', color: 'var(--gold)' },
    done: { label: 'Done', bg: 'rgba(46, 204, 113, 0.16)', color: 'var(--accent2)' }
  };
  const pill = config[tone] || config.info;
  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:${pill.bg};color:${pill.color};font-size:var(--font-size-xs);font-weight:700;letter-spacing:0.02em;text-transform:uppercase">${pill.label}</span>`;
}

function renderRoster(data) {
  const clients = data.clients || [];

  if (!clients.length) {
    return `<div class="empty-state">
      <span class="icon-star icon-xl"></span>
      <h3 style="margin:var(--space-4) 0 8px;font-size:var(--font-size-md);color:var(--text)">No clients yet</h3>
      <p style="max-width:min(500px,90vw);margin:0 auto 24px">Invite your first client to start building their energy blueprint together. They'll receive an email with a personalized invitation to join Prime Self.</p>
      <button class="btn-primary" style="display:inline-block;margin:0 auto" data-action="togglePracAddForm">
        <span class="icon-star"></span> Invite Your First Client
      </button>
    </div>`;
  }

  let html = `<div class="card">
    <div class="card-title"><span class="icon-star"></span> Roster — ${clients.length} client${clients.length !== 1 ? 's' : ''}</div>`;

  clients.forEach(c => {
    const addedDate = c.added_at ? new Date(c.added_at).toLocaleDateString() : '—';
    const chartDate = c.chart_date ? new Date(c.chart_date).toLocaleDateString() : 'No chart';
    const chartId   = c.chart_id || null;
    const profileDate = c.profile_date ? new Date(c.profile_date).toLocaleDateString() : 'No profile';
    const clientId  = c.id;
    const emailSafe = escapeHtml(c.email);
    const lifecycle = getPractitionerClientLifecycle(c);
    const statusBadge = renderPractitionerLifecycleBadge(lifecycle.tone).replace(/>[^<]+<\//, `>${escapeHtml(lifecycle.label)}<\/`);

    html += `
    <div class="client-row" id="client-row-${escapeAttr(clientId)}" style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-3);padding:var(--space-3) 0;border-bottom:var(--border-width-thin) solid var(--border)">
      <div style="flex:1;min-width:150px">
        <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;margin-bottom:4px">
          <div style="font-weight:600;color:var(--text)">${emailSafe}</div>
          ${statusBadge}
        </div>
        <div style="font-size:var(--font-size-sm);color:var(--text-dim)">
          Added ${addedDate} · Last chart: ${chartDate} · Last profile: ${profileDate}
        </div>
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:4px">${escapeHtml(lifecycle.nextStep)}</div>
      </div>
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center">
        ${(lifecycle.key === 'needs_birth_data' || lifecycle.key === 'needs_profile')
          ? `<button class="btn-primary btn-sm" id="remind-btn-${escapeAttr(clientId)}" data-action="sendClientReminder" data-arg0="${escapeAttr(clientId)}" data-arg1="${emailSafe}">Send Reminder</button>`
          : lifecycle.key === 'session_ready'
          ? `<button class="btn-primary btn-sm" data-action="viewClientDetail" data-arg0="${escapeAttr(clientId)}" data-arg1="${emailSafe}">Open Session →</button>`
          : `<button class="btn-primary btn-sm" data-action="viewClientDetail" data-arg0="${escapeAttr(clientId)}" data-arg1="${emailSafe}">Open Workspace</button>`}
        ${(lifecycle.key === 'needs_birth_data' || lifecycle.key === 'needs_profile')
          ? `<button class="btn-secondary btn-sm" data-action="viewClientDetail" data-arg0="${escapeAttr(clientId)}" data-arg1="${emailSafe}">View Details</button>` : ''}
        ${lifecycle.key === 'session_ready' && chartId && c.profile_id
          ? `<button class="btn-secondary btn-sm" data-action="exportBrandedPDF" data-arg0="${escapeAttr(clientId)}">Branded PDF</button>` : ''}
        <button class="btn-danger btn-sm" data-action="removeClient" data-arg0="${escapeAttr(clientId)}" data-arg1="${emailSafe}">Remove</button>
      </div>
    </div>`;
  });

  html += `</div>`;
  return html;
}

async function viewClientDetail(clientId, emailLabel) {
  const panel = document.getElementById('pracDetailPanel');
  if (!panel) return;
  panel.style.display = 'block';
  panel.innerHTML = `<div class="loading-card"><div class="spinner"></div><div>Loading ${escapeHtml(emailLabel)}…</div></div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const [data, notesData, aiContextData, diaryData] = await Promise.all([
      apiFetch(`/api/practitioner/clients/${clientId}`),
      apiFetch(`/api/practitioner/clients/${clientId}/notes?limit=10&offset=0`).catch(() => ({ notes: [], total: 0, hasMore: false })),
      apiFetch(`/api/practitioner/clients/${clientId}/ai-context`).catch(() => ({ ai_context: '', error: 'Unable to load AI context' })),
      apiFetch(`/api/practitioner/clients/${clientId}/diary`).catch(() => ({ data: [] }))
    ]);
    _practitionerClientDetailCache.set(String(clientId), data);
    panel.innerHTML = renderClientDetail(data, emailLabel, clientId, notesData, aiContextData, diaryData, _practitionerBookingUrl);
    loadClientReadings(clientId);
    loadClientActions(clientId);
    loadPractitionerMessages(clientId);
    trackEvent('practitioner', 'client_view', clientId);
  } catch (e) {
    panel.innerHTML = `<div class="alert alert-error">Error loading client: ${escapeHtml(e.message)}</div>`;
  }
}

