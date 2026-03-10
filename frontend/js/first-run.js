// ── First-Run Onboarding Modal ──────────────────────────────────────────────
let frmCurrentStep = 1;

function frmNext() { frmGoto(frmCurrentStep + 1); }
function frmBack() { frmGoto(frmCurrentStep - 1); }

function frmClose() {
  document.getElementById('first-run-modal').style.display = 'none';
  try { localStorage.setItem('ps_hasSeenOnboarding', '1'); } catch(e) {}
}

function frmGoto(n) {
  document.querySelectorAll('.frm-step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
  });
  document.querySelectorAll('.frm-dot').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
  });
  frmCurrentStep = n;
}

// ── Identity Strip ──────────────────────────────────────────────────────────
function showIdentityStrip(chartData) {
  try {
    const d = chartData?.data || chartData;
    const chart = d?.chart || d;
    if (!chart?.type) return;
    const typeEl = document.getElementById('identity-type');
    const authEl = document.getElementById('identity-auth');
    const profEl = document.getElementById('identity-profile');
    if (typeEl) typeEl.textContent = chart.type || '';
    if (authEl) authEl.textContent = chart.authority || '';
    if (profEl) profEl.textContent = chart.profile ? 'Profile ' + chart.profile : '';
    const strip = document.getElementById('identity-strip');
    if (strip) strip.style.display = 'block';
  } catch(e) { window.DEBUG && console.warn('[IdentityStrip]', e); }
}
