// ── First-Run Onboarding Wizard ──────────────────────────────────────────────
// 4 steps: 1=Welcome, 2=Birth Data, 3=Eval Type, 4=Question
let frmCurrentStep = 1;
let _frmEvalType = 'blueprint'; // 'blueprint' | 'daily'

const _FRM_QUICKPICKS = {
  blueprint: [
    'How should I make important decisions using my authority?',
    'What are my main energy themes and life purpose?',
  ],
  daily: [
    'How do today\'s transits activate my specific gates?',
    'What should I focus on and avoid today?',
  ],
};

function frmNext() { frmGoto(frmCurrentStep + 1); }
function frmBack() { frmGoto(frmCurrentStep - 1); }

function frmClose() {
  const modal = document.getElementById('first-run-modal');
  if (modal) modal.style.display = 'none';
  try {
    localStorage.setItem('primeself_frm_seen', '1');
    localStorage.setItem('ps_hasSeenOnboarding', '1');
  } catch(e) {}
}

function frmGoto(n) {
  const total = typeof FRM_TOTAL_STEPS !== 'undefined' ? FRM_TOTAL_STEPS : 4;
  if (n < 1 || n > total) return;
  document.querySelectorAll('.frm-step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
  });
  document.querySelectorAll('.frm-dot').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
  });
  frmCurrentStep = n;
  // Populate quick-picks whenever we land on step 4
  if (n === 4) _frmBuildQuickpicks();
}

function frmSetEvalType(type) {
  _frmEvalType = type;
  document.querySelectorAll('.frm-eval-card').forEach(el => {
    el.classList.toggle('active', el.id === 'frm-eval-' + type);
  });
}

function _frmBuildQuickpicks() {
  const container = document.getElementById('frm-quickpicks');
  if (!container) return;
  const picks = _FRM_QUICKPICKS[_frmEvalType] || [];
  container.innerHTML = picks
    .map(p => `<button class="frm-quickpick-btn" data-action="frmSelectQuickpick" data-arg0="${p.replace(/"/g, '&quot;')}">${p}</button>`)
    .join('');
}

function frmSelectQuickpick(text) {
  const ta = document.getElementById('frm-question');
  if (ta) {
    ta.value = text;
    ta.focus();
  }
  // Visually mark selected
  document.querySelectorAll('.frm-quickpick-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.arg0 === text);
  });
}

function frmComplete() {
  const spinner = document.getElementById('frm-gen-spinner');
  if (spinner) spinner.style.display = '';

  // 1. Read wizard fields
  const wDate = document.getElementById('w-date')?.value?.trim() || '';
  const wTime = document.getElementById('w-time')?.value?.trim() || '';
  const wLoc  = document.getElementById('w-location')?.value?.trim() || '';
  const wLat  = document.getElementById('w-lat')?.value?.trim() || '';
  const wLng  = document.getElementById('w-lng')?.value?.trim() || '';
  const wTz   = document.getElementById('w-tz')?.value || 'UTC';
  const question = document.getElementById('frm-question')?.value?.trim() || '';

  if (!wDate) {
    if (spinner) spinner.style.display = 'none';
    frmGoto(2); // send user back to birth data
    const dateEl = document.getElementById('w-date');
    if (dateEl) { dateEl.style.outline = '2px solid var(--red,#f56565)'; dateEl.focus(); }
    return;
  }

  // 2. Copy wizard data into both c-* and p-* main form fields
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  const setTz = (selectId, tz) => {
    const sel = document.getElementById(selectId);
    if (!sel || !tz) return;
    if (!Array.from(sel.options).some(o => o.value === tz)) {
      const opt = document.createElement('option');
      opt.value = opt.textContent = tz;
      sel.insertBefore(opt, sel.firstChild);
    }
    sel.value = tz;
  };
  ['c', 'p'].forEach(pfx => {
    setVal(pfx + '-date', wDate);
    setVal(pfx + '-time', wTime);
    setVal(pfx + '-location', wLoc);
    setVal(pfx + '-lat', wLat);
    setVal(pfx + '-lng', wLng);
    setTz(pfx + '-tz', wTz);
  });
  setVal('p-question', question);

  // 3. Persist birth data so restoreBirthData picks it up on reload
  try {
    localStorage.setItem('ps_birth_date', wDate);
    localStorage.setItem('ps_birth_time', wTime);
    localStorage.setItem('ps_birth_location', wLoc);
    localStorage.setItem('ps_birth_lat', wLat);
    localStorage.setItem('ps_birth_lng', wLng);
    localStorage.setItem('ps_birth_tz', wTz);
  } catch(e) {}

  // 4. Close modal and navigate to chart tab
  frmClose();
  if (typeof switchTab === 'function') switchTab('chart');

  // 5. Trigger chart calculation (and profile for Full Blueprint)
  setTimeout(() => {
    if (spinner) spinner.style.display = 'none';
    if (typeof calculateChart === 'function') calculateChart();
    if (_frmEvalType === 'blueprint' && typeof generateProfile === 'function') {
      // Small delay ensures chart starts first, then switch to profile tab
      setTimeout(() => {
        if (typeof switchTab === 'function') switchTab('profile');
        generateProfile();
      }, 300);
    }
  }, 80);
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
