(function () {
  if (typeof window === 'undefined') return;

  window.TRUST_PROOF_HEADING = window.TRUST_PROOF_HEADING || 'Launch Signals';

  window.TRUST_PROOF_ITEMS = window.TRUST_PROOF_ITEMS || [
    {
      role: 'Early-access beta',
      outcome: 'Public testimonials are intentionally withheld until written beta permission is in hand. This block stays launch-safe rather than inventing social proof.',
      consentStatus: 'confirmed',
      date: 'March 2026'
    },
    {
      role: 'Workflow proof',
      outcome: 'Practitioner directory profiles, branded exports, session prep, and referral tracking are live in the current build and visible on the public pricing path.',
      consentStatus: 'confirmed',
      date: 'March 2026'
    },
    {
      role: 'Measurement proof',
      outcome: 'Signup and checkout attribution now preserve source, medium, and campaign through conversion events so beta channels can be measured before scaling spend.',
      consentStatus: 'confirmed',
      date: 'February 2026'
    }
  ];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderFallbackTrustProof() {
    const items = window.TRUST_PROOF_ITEMS;
    if (!Array.isArray(items) || items.length === 0) return;

    const cssId = 'trust-proof-fallback-styles';
    if (!document.getElementById(cssId)) {
      const style = document.createElement('style');
      style.id = cssId;
      style.textContent = '.trust-proof-section{padding:24px 16px;max-width:1100px;margin:0 auto}.trust-proof-heading{text-align:center;color:var(--text-dim,#aaa);font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;margin:0 0 16px}.trust-proof-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.trust-proof-card{background:var(--bg2,#16161e);border:1px solid var(--border,rgba(255,255,255,.08));border-radius:10px;padding:18px 20px}.trust-proof-quote{font-size:.9rem;color:var(--text,#e8e8f0);line-height:1.6;margin:0 0 14px}.trust-proof-meta{font-size:.75rem;color:var(--text-dim,#888);display:flex;align-items:center;gap:8px;flex-wrap:wrap}.trust-proof-verified{display:inline-flex;align-items:center;gap:4px;color:var(--accent2,#2ecc71);font-size:.7rem;font-weight:700;letter-spacing:.04em}';
      document.head.appendChild(style);
    }

    const cards = items.map((item) => `
      <div class="trust-proof-card" role="article">
        <p class="trust-proof-quote">&quot;${escapeHtml(item.outcome)}&quot;</p>
        <div class="trust-proof-meta">
          <span>${escapeHtml(item.role)}${item.name ? ` · ${escapeHtml(item.name)}` : ''}</span>
          <span aria-hidden="true">·</span>
          <span>${escapeHtml(item.date)}</span>
          <span class="trust-proof-verified" aria-label="Consent confirmed">✓ Verified</span>
        </div>
      </div>
    `).join('');

    const heading = escapeHtml(window.TRUST_PROOF_HEADING || 'Launch Signals');
    const html = `<div class="trust-proof-section"><p class="trust-proof-heading">${heading}</p><div class="trust-proof-grid">${cards}</div></div>`;
    ['trust-proof-block', 'trust-proof-block-pricing'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = html;
        el.style.display = '';
      }
    });
  }

  const render = () => {
    if (typeof window.renderTrustProof === 'function') window.renderTrustProof();
    else renderFallbackTrustProof();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }
})();