/**
 * Prime Self Admin Dashboard
 * Moved from inline script in admin.html to external file (BL-AUDIT-H4: CSP hardening)
 */

// ─── Config ────────────────────────────────────────────────
const API = '';
let ADMIN_TOKEN = '';
let usersOffset = 0;
let usersLimit = 50;
let usersTotal = 0;
let userSearchTimer = null;

// ─── Auth ──────────────────────────────────────────────────
function doLogin() {
  const t = document.getElementById('login-token').value.trim();
  if (!t) return toast('Enter your admin token', 'err');
  ADMIN_TOKEN = t;
  document.getElementById('login-token').value = '';
  init();
}

function signOut() {
  ADMIN_TOKEN = '';
  document.getElementById('login-token').value = '';
  document.getElementById('login').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function init() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('header-api').textContent = API.replace('https://', '');
  loadStats();
  loadPromos();
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-token').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});

// ─── API fetch wrapper ─────────────────────────────────────
async function api(path, opts = {}) {
  if (!ADMIN_TOKEN) {
    signOut();
    throw new Error('Admin session expired. Sign in again.');
  }
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': ADMIN_TOKEN,
      ...(opts.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

// ─── Toast ─────────────────────────────────────────────────
let _toastTimer;
function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = type;
  el.style.display = 'block';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ─── Tab navigation ────────────────────────────────────────
function showTab(id, btn) {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
}

// ─── Stats ─────────────────────────────────────────────────
async function loadStats() {
  try {
    const { stats } = await api('/api/admin/stats');
    const grid = document.getElementById('stats-grid');
    grid.innerHTML = [
      ['Total Users', stats.total_users],
      ['New (24h)', stats.new_users_24h],
      ['New (7d)', stats.new_users_7d],
      ['Verified', stats.verified_users],
      ['Individual', stats.individual_users],
      ['Practitioner', stats.practitioner_users],
      ['Agency', stats.agency_users],
      ['Active Subs', stats.active_subscriptions],
      ['Charts (24h)', stats.charts_24h],
      ['Profiles (24h)', stats.profiles_24h],
    ].map(([label, value]) =>
      `<div class="stat"><div class="value">${Number(value).toLocaleString()}</div><div class="label">${label}</div></div>`
    ).join('');
  } catch (e) {
    toast('Stats load failed: ' + e.message, 'err');
  }
}

// ─── Users ─────────────────────────────────────────────────
function debounceUserSearch() {
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(() => loadUsers(0), 400);
}

async function loadUsers(offset = 0) {
  const email = document.getElementById('user-search').value.trim() || '';
  usersOffset = Math.max(0, offset);
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);text-align:center"><span class="spin"></span> Loading&hellip;</td></tr>';
  try {
    const params = new URLSearchParams({ limit: usersLimit, offset: usersOffset });
    if (email) params.set('email', email);
    const { users, total } = await api('/api/admin/users?' + params);
    usersTotal = total;
    document.getElementById('users-page-info').textContent =
      `${usersOffset + 1}–${Math.min(usersOffset + users.length, total)} of ${total}`;
    document.getElementById('btn-prev').disabled = usersOffset === 0;
    document.getElementById('btn-next').disabled = usersOffset + usersLimit >= total;

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);text-align:center">No users found</td></tr>';
      return;
    }
    tbody.innerHTML = users.map(u => `
      <tr>
        <td title="${esc(u.email)}">${esc(u.email)}</td>
        <td><span class="badge ${u.tier}">${u.tier}</span></td>
        <td><span class="badge ${u.email_verified ? 'yes' : 'no'}">${u.email_verified ? 'yes' : 'no'}</span></td>
        <td>${fmtDate(u.created_at)}</td>
        <td>${u.last_login_at ? fmtDate(u.last_login_at) : '—'}</td>
        <td>
          <select class="tier-select" id="tier-${u.id}" onchange="">
            <option value="free" ${u.tier==='free'?'selected':''}>free</option>
            <option value="individual" ${u.tier==='individual'?'selected':''}>individual</option>
            <option value="practitioner" ${u.tier==='practitioner'?'selected':''}>practitioner</option>
            <option value="agency" ${u.tier==='agency'?'selected':''}>agency</option>
          </select>
          <button class="sm" style="margin-left:4px" onclick="setTier('${u.id}')">Set</button>
          ${!u.email_verified ? `<button class="sm secondary" style="margin-left:4px" onclick="verifyUser('${u.id}')">Verify</button>` : ''}
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--danger)">${esc(e.message)}</td></tr>`;
  }
}

async function setTier(userId) {
  const tier = document.getElementById('tier-' + userId).value;
  try {
    const { user } = await api(`/api/admin/users/${userId}/tier`, {
      method: 'PATCH',
      body: JSON.stringify({ tier }),
    });
    toast(`${user.email} → ${user.tier}`, 'ok');
  } catch (e) {
    toast('Set tier failed: ' + e.message, 'err');
  }
}

async function verifyUser(userId) {
  try {
    const { user } = await api(`/api/admin/users/${userId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ verified: true }),
    });
    toast(`${user.email} email verified`, 'ok');
    loadUsers(usersOffset);
  } catch (e) {
    toast('Verify failed: ' + e.message, 'err');
  }
}

// ─── Promos ────────────────────────────────────────────────
async function loadPromos() {
  const tbody = document.getElementById('promos-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted);text-align:center"><span class="spin"></span> Loading&hellip;</td></tr>';
  try {
    const data = await api('/api/admin/promo');
    const promos = data.promos || data;
    if (!promos.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted);text-align:center">No promo codes</td></tr>';
      return;
    }
    tbody.innerHTML = promos.map(p => `
      <tr>
        <td><strong>${esc(p.code)}</strong></td>
        <td>${p.discount_type === 'percentage' ? '%' : '$'}</td>
        <td>${p.discount_type === 'percentage' ? p.discount_value + '%' : '$' + (p.discount_value/100).toFixed(2)}</td>
        <td>${p.redemptions}${p.max_redemptions ? '/'+p.max_redemptions : '/∞'}</td>
        <td>${p.valid_until ? fmtDate(p.valid_until) : 'Never'}</td>
        <td><span class="badge ${p.active ? 'yes' : 'no'}">${p.active ? 'active' : 'off'}</span></td>
        <td>${p.active ? `<button class="sm danger" onclick="deactivatePromo('${p.id}')">Deactivate</button>` : ''}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger)">${esc(e.message)}</td></tr>`;
  }
}

async function createPromo() {
  const code = document.getElementById('promo-code').value.trim().toUpperCase();
  const discount_type = document.getElementById('promo-type').value;
  const discount_value = parseFloat(document.getElementById('promo-value').value);
  const max_r = document.getElementById('promo-max').value;
  const expires = document.getElementById('promo-expires').value;

  if (!code || isNaN(discount_value)) return toast('Code and value are required', 'err');
  try {
    await api('/api/admin/promo', {
      method: 'POST',
      body: JSON.stringify({
        code,
        discount_type,
        discount_value,
        max_redemptions: max_r ? parseInt(max_r) : null,
        valid_until: expires || null,
      }),
    });
    toast(`Promo ${code} created`, 'ok');
    document.getElementById('promo-code').value = '';
    document.getElementById('promo-value').value = '';
    document.getElementById('promo-max').value = '';
    document.getElementById('promo-expires').value = '';
    loadPromos();
  } catch (e) {
    toast('Create failed: ' + e.message, 'err');
  }
}

async function deactivatePromo(id) {
  if (!confirm('Deactivate this promo code?')) return;
  try {
    await api(`/api/admin/promo/${id}/deactivate`, { method: 'PATCH' });
    toast('Promo deactivated', 'ok');
    loadPromos();
  } catch (e) {
    toast('Deactivate failed: ' + e.message, 'err');
  }
}

// ─── Helpers ───────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
