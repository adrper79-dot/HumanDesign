/**
 * clustering-controller.js
 * Auto-extracted from frontend/js/app.js by scripts/split-app-js.mjs (GAP-001).
 *
 * Group clusters, cluster synthesis, member management
 *
 * Depends on globals defined in app.js (always loaded first):
 *   apiFetch, token, currentUser, escapeHtml, showNotification,
 *   openAuthOverlay, switchTab, showUpgradePrompt, writeJourneyFlag, readJourneyFlag
 *
 * This file is loaded lazily via _loadController() in app.js when the
 * relevant tab is first activated.  Do not add <script> tags for this
 * file to index.html — the loader handles it.
 */
// ══════════════════════════════════════════════════════════════
// CLUSTERS — Group Dynamics Analysis
// ══════════════════════════════════════════════════════════════

let currentCluster = null;

function showCreateClusterForm() {
  const form = document.getElementById('createClusterForm');
  if (form) form.style.display = 'block';
  const nameInput = document.getElementById('cluster-name');
  if (nameInput) nameInput.focus();
}

function hideCreateClusterForm() {
  const form = document.getElementById('createClusterForm');
  if (form) form.style.display = 'none';
  const nameInput = document.getElementById('cluster-name');
  if (nameInput) nameInput.value = '';
  const challengeInput = document.getElementById('cluster-challenge');
  if (challengeInput) challengeInput.value = '';
}

async function createCluster() {
  if (!token) { openAuthOverlay(); return; }

  const name = document.getElementById('cluster-name').value.trim();
  const challenge = document.getElementById('cluster-challenge').value.trim();

  if (!name) { 
    showAlert('clusterListContainer', 'Please enter a cluster name', 'error');
    return; 
  }
  if (!challenge) {
    showAlert('clusterListContainer', 'Please describe your shared challenge', 'error');
    return;
  }

  const btn = document.getElementById('clusterCreateBtn');
  const spinner = document.getElementById('clusterCreateSpinner');

  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = '';

  try {
    const data = await apiFetch('/api/cluster/create', { method: 'POST', body: JSON.stringify({ name, challenge, createdBy: null }) });
    showAlert('clusterListContainer', `Cluster "${name}" created successfully!`, 'success');
    hideCreateClusterForm();
    loadClusters();
  } catch (e) {
    showAlert('clusterListContainer', 'Error creating cluster: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

async function loadClusters() {
  if (!token) { openAuthOverlay(); return; }

  const spinner = document.getElementById('clusterListSpinner');
  const container = document.getElementById('clusterListContainer');

  if (spinner) spinner.style.display = '';
  if (container) container.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>' + window.t('clusters.loading') + '</div></div>';

  try {
    const data = await apiFetch('/api/cluster/list');
    if (container) container.innerHTML = renderClusterList(data);
  } catch (e) {
    if (container) container.innerHTML = `<div class="alert alert-error"><span class="icon-info"></span> Error loading clusters: ${escapeHtml(e.message)}</div>`;
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

function renderClusterList(data) {
  if (data.error) return `<div class="alert alert-error">${escapeHtml(data.error)}</div>`;
  const clusters = data.clusters || [];

  if (!clusters.length) {
    return `<div class="empty-state">
      <span class="icon-cluster icon-xl"></span>
      <h3 style="margin:var(--space-4) 0 8px;font-size:var(--font-size-md);color:var(--text)">No Clusters Yet</h3>
      <p style="max-width:min(500px, 90vw);margin:0 auto 16px">Create a cluster to analyze group dynamics. Overlay multiple birth charts to see which gates dominate your team, which energies are missing, and how members electromagnetically activate each other. Perfect for work teams, families, or partnerships.</p>
      <p style="color:var(--text-dim);font-size:var(--font-size-base)">Enter a name and purpose above, then click Create Cluster.</p>
    </div>`;
  }

  let html = `<div class="card"><div class="card-title">Your Clusters (${clusters.length})</div>`;
  clusters.forEach(c => {
    html += `<div class="cluster-card" data-action="viewClusterDetail" data-arg0="${escapeAttr(c.id)}">`;
    html += `  <div class="cluster-card-header">`;
    html += `    <div><div class="cluster-card-title">${escapeHtml(c.name)}</div>`;
    html += `    <div class="cluster-card-meta">Created ${formatDate(c.createdAt)}</div></div>`;
    html += `    <span class="cluster-member-count"><span class="icon-cluster"></span> ${c.memberCount || 0} members</span>`;
    html += `  </div>`;
    if (c.challenge) {
      html += `  <div class="cluster-card-challenge">"${escapeHtml(c.challenge)}"</div>`;
    }
    html += `</div>`;
  });
  html += `</div>`;
  return html;
}

async function viewClusterDetail(clusterId) {
  const container = document.getElementById('clusterDetailContainer');
  const listContainer = document.getElementById('clusterListContainer');

  if (listContainer) listContainer.style.display = 'none';
  if (!container) return;
  container.style.display = 'block';
  container.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>Loading cluster details…</div></div>';

  try {
    const data = await apiFetch(`/api/cluster/${clusterId}`);
    currentCluster = { id: clusterId, ...data };
    container.innerHTML = renderClusterDetail(data, clusterId);
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error"><span class="icon-info"></span> Error: ${escapeHtml(e.message)}</div>`;
  }
}

function renderClusterDetail(data, clusterId) {
  const members = data.members || [];
  const comp = data.composition || {};
  
  let html = `<div class="card">`;
  html += `  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4)">`;
  html += `    <div class="card-title"><span class="icon-cluster"></span> Cluster Details</div>`;
  html += `    <button class="btn-secondary btn-sm" data-action="backToClusterList">← Back to List</button>`;
  html += `  </div>`;

  // Members Section
  html += `  <h4 style="color:var(--gold);font-size:var(--font-size-base);margin:var(--space-4) 0 10px">Members (${members.length})</h4>`;
  
  if (members.length === 0) {
    html += `  <div class="alert alert-info">No members yet. Add members below to analyze group dynamics.</div>`;
  } else {
    // Type breakdown bar
    const typeCounts = {};
    members.forEach(m => {
      const type = m.forgeRole?.role || 'Unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    html += `  <div class="composition-bar">`;
    Object.keys(typeCounts).forEach(type => {
      const count = typeCounts[type];
      const pct = (count / members.length * 100).toFixed(1);
      const className = type.toLowerCase().replace(/[^a-z]/g, '');
      html += `    <div class="composition-segment ${className}" style="width:${pct}%" title="${count} ${type}">`;
      if (pct > 10) html += `${count}`;
      html += `    </div>`;
    });
    html += `  </div>`;

    // Member cards
    members.forEach(m => {
      const forgeClass = (m.forgeRole?.forge || '').toLowerCase().includes('power') ? 'power' :
                        (m.forgeRole?.forge || '').toLowerCase().includes('craft') ? 'craft' :
                        (m.forgeRole?.forge || '').toLowerCase().includes('vision') ? 'vision' :
                        (m.forgeRole?.forge || '').toLowerCase().includes('mirror') ? 'mirrors' : '';
      
      html += `  <div class="data-block" style="margin-bottom:var(--space-2)">`;
      html += `    <div style="display:flex;justify-content:space-between;align-items:center">`;
      html += `      <strong>${escapeHtml(m.email || 'Member')}</strong>`;
      html += `      <span class="forge-role-badge ${forgeClass}">${m.forgeRole?.role || 'Participant'}</span>`;
      html += `    </div>`;
      if (m.forgeRole?.forge) {
        html += `    <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-1)">${m.forgeRole.forge}</div>`;
      }
      html += `  </div>`;
    });
  }

  // Composition Insights
  if (comp.insights && comp.insights.length > 0) {
    html += `  <h4 style="color:var(--gold);font-size:var(--font-size-base);margin:var(--space-5) 0 10px">Composition Insights</h4>`;
    html += `  <ul class="indicator-list">`;
    comp.insights.forEach(insight => {
      html += `    <li>${escapeHtml(insight)}</li>`;
    });
    html += `  </ul>`;
  }

  // Actions
  html += `  <div class="action-grid">`;
  html += `    <button class="btn-secondary" data-action="showAddMemberForm">+ Add Member</button>`;
  if (members.length >= 2) {
    html += `    <button class="btn-primary" data-action="synthesizeCluster" data-arg0="${escapeAttr(clusterId)}"><span class="icon-energy"></span> Generate Synthesis</button>`;
  }
  html += `    <button class="btn-danger" data-action="leaveCluster" data-arg0="${escapeAttr(clusterId)}">Leave Cluster</button>`;
  html += `  </div>`;

  html += `</div>`;

  // Add Member Form (hidden)
  html += `<div id="addMemberFormCard" style="display:none"></div>`;
  
  // Synthesis Result
  html += `<div id="synthesisResult"></div>`;

  return html;
}

function backToClusterList() {
  const detail = document.getElementById('clusterDetailContainer');
  const list = document.getElementById('clusterListContainer');
  if (detail) detail.style.display = 'none';
  if (list) list.style.display = 'block';
  currentCluster = null;
}

function showAddMemberForm() {
  const container = document.getElementById('addMemberFormCard');
  if (!container) return;
  container.style.display = 'block';
  container.innerHTML = `
    <div class="card">
      <div class="card-title">Add Member</div>
      <p style="font-size:var(--font-size-base);color:var(--text-dim);margin-bottom:var(--space-4)">Enter member birth data to calculate their chart and add them to the cluster.</p>
      
      <div class="form-grid">
        <div class="form-group"><label>User ID or Email</label><input type="text" id="member-userId" placeholder="user@example.com"></div>
        <div class="form-group"><label>Birth Date</label><input type="date" id="member-date"></div>
        <div class="form-group"><label>Birth Time</label><input type="time" id="member-time"></div>
        <div class="form-group"><label>Latitude</label><input type="number" step="0.0001" id="member-lat" placeholder="e.g., 27.9506"></div>
        <div class="form-group"><label>Longitude</label><input type="number" step="0.0001" id="member-lng" placeholder="e.g., -82.4572"></div>
        <div class="form-group"><label>Timezone</label><select id="member-tz">
          <option value="UTC">UTC</option>
          <optgroup label="North America">
            <option value="America/New_York">America/New_York (Eastern)</option>
            <option value="America/Chicago">America/Chicago (Central)</option>
            <option value="America/Denver">America/Denver (Mountain)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
            <option value="America/Phoenix">America/Phoenix (Arizona)</option>
            <option value="America/Anchorage">America/Anchorage (Alaska)</option>
            <option value="America/Honolulu">America/Honolulu (Hawaii)</option>
            <option value="America/Toronto">America/Toronto</option>
            <option value="America/Vancouver">America/Vancouver</option>
            <option value="America/Mexico_City">America/Mexico_City</option>
          </optgroup>
          <optgroup label="South America">
            <option value="America/Sao_Paulo">America/Sao_Paulo</option>
            <option value="America/Buenos_Aires">America/Buenos_Aires</option>
          </optgroup>
          <optgroup label="Europe">
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Paris">Europe/Paris</option>
            <option value="Europe/Berlin">Europe/Berlin</option>
            <option value="Europe/Rome">Europe/Rome</option>
            <option value="Europe/Madrid">Europe/Madrid</option>
            <option value="Europe/Amsterdam">Europe/Amsterdam</option>
            <option value="Europe/Stockholm">Europe/Stockholm</option>
            <option value="Europe/Moscow">Europe/Moscow</option>
          </optgroup>
          <optgroup label="Asia">
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
            <option value="Asia/Bangkok">Asia/Bangkok</option>
            <option value="Asia/Singapore">Asia/Singapore</option>
            <option value="Asia/Shanghai">Asia/Shanghai</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
            <option value="Asia/Seoul">Asia/Seoul</option>
          </optgroup>
          <optgroup label="Australia &amp; Pacific">
            <option value="Australia/Melbourne">Australia/Melbourne</option>
            <option value="Australia/Sydney">Australia/Sydney</option>
            <option value="Pacific/Auckland">Pacific/Auckland</option>
          </optgroup>
          <optgroup label="Africa">
            <option value="Africa/Cairo">Africa/Cairo</option>
            <option value="Africa/Johannesburg">Africa/Johannesburg</option>
          </optgroup>
        </select></div>
      </div>
      
      <div style="display:flex;gap:var(--space-3);margin-top:var(--space-4)">
        <button class="btn-primary" data-action="addMemberToCluster" id="addMemberBtn">
          <span class="spinner" id="addMemberSpinner" style="display:none"></span>
          Add Member
        </button>
        <button class="btn-secondary" data-action="hideMemberForm">Cancel</button>
      </div>
    </div>
  `;
}

async function addMemberToCluster() {
  if (!currentCluster) return;

  const userId = document.getElementById('member-userId').value.trim();
  const birthDate = document.getElementById('member-date').value;
  const birthTime = document.getElementById('member-time').value;
  const lat = parseFloat(document.getElementById('member-lat').value);
  const lng = parseFloat(document.getElementById('member-lng').value);
  const birthTimezone = document.getElementById('member-tz').value;

  if (!userId || !birthDate || !birthTime || isNaN(lat) || isNaN(lng)) {
    showAlert('addMemberFormCard', 'All fields required', 'error');
    return;
  }

  const btn = document.getElementById('addMemberBtn');
  const spinner = document.getElementById('addMemberSpinner');
  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = '';

  try {
    await apiFetch(`/api/cluster/${currentCluster.id}/join`, { method: 'POST', body: JSON.stringify({
      userId, birthDate, birthTime, birthTimezone, lat, lng
    }) });
    showAlert('synthesisResult', 'Member added successfully!', 'success');
    const memberForm = document.getElementById('addMemberFormCard');
    if (memberForm) memberForm.style.display = 'none';
    viewClusterDetail(currentCluster.id); // Refresh
  } catch (e) {
    showAlert('addMemberFormCard', 'Error: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

async function synthesizeCluster(clusterId) {
  const container = document.getElementById('synthesisResult');
  if (!container) return;

  // First, validate member data completeness
  container.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>Checking member data...</div></div>';

  try {
    const validation = await apiFetch(`/api/cluster/${clusterId}/members/validation`);

    // If members are incomplete, show validation error
    if (!validation.ok || !validation.canSynthesize) {
      let html = `<div class="card">`;
      html += `  <div class="card-title"><span class="icon-warning"></span> Members Need Complete Birth Data</div>`;
      html += `  <p style="margin-bottom:var(--space-3)">${escapeHtml(validation.message || 'Some members are missing required birth information.')}</p>`;

      if (validation.incompleteMembers && validation.incompleteMembers.length > 0) {
        html += `  <div class="alert alert-warning">`;
        html += `    <strong style="display:block;margin-bottom:var(--space-2)">Incomplete Members:</strong>`;
        html += `    <ul style="margin:0;padding-left:20px">`;
        validation.incompleteMembers.forEach(member => {
          const fields = member.missingFields?.join(', ') || 'unknown fields';
          html += `      <li>${escapeHtml(member.name || 'Member')} — missing: ${escapeHtml(fields)}</li>`;
        });
        html += `    </ul>`;
        html += `  </div>`;
      }

      html += `  <p style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-3)">Ask these members to rejoin the cluster or update their birth information.</p>`;
      html += `</div>`;

      container.innerHTML = html;
      return;
    }

    // All members are complete, proceed with synthesis
    container.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>' + window.t('profile.generatingAi') + '</div></div>';

    const data = await apiFetch(`/api/cluster/${clusterId}/synthesize`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    if (data.error) {
      container.innerHTML = `<div class="alert alert-error"><span class="icon-info"></span> ${escapeHtml(data.error)}</div>`;
      return;
    }
    container.innerHTML = renderClusterSynthesis(data);
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error"><span class="icon-info"></span> Synthesis error: ${escapeHtml(e.message)}</div>`;
  }
}

function renderClusterSynthesis(data) {
  const members = data.members || [];
  const comp = data.composition || {};
  const s = data.synthesis || {};
  const meta = data.meta || {};

  let html = `<div class="card">`;
  html += `<div class="card-title"><span class="icon-energy"></span> Group Intelligence Synthesis</div>`;
  if (meta.synthesizedAt) {
    html += `<p style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-4)">Generated ${formatDate(meta.synthesizedAt)} \u00b7 ${meta.memberCount} members</p>`;
  }

  if (members.length) {
    html += `<h4 style="color:var(--gold);font-size:var(--font-size-base);margin-bottom:var(--space-3)">Forge Roles</h4>`;
    html += `<div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-5)">`;
    members.forEach(m => {
      const fl = (m.forge || '').toLowerCase();
      const forgeClass = fl.includes('power') ? 'power' : fl.includes('craft') ? 'craft' : fl.includes('vision') ? 'vision' : fl.includes('mirror') ? 'mirrors' : '';
      html += `<div class="data-block" style="flex:1;min-width:140px;padding:var(--space-3)">`;
      html += `<strong>${escapeHtml(m.name || 'Member')}</strong>`;
      html += `<div style="font-size:var(--font-size-sm);color:var(--text-dim)">${escapeHtml(m.type || '')} \u00b7 ${escapeHtml(m.profile || '')}</div>`;
      html += `<div style="margin-top:var(--space-1)"><span class="forge-role-badge ${forgeClass}">${escapeHtml(m.role || '')}</span></div>`;
      html += `<div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-1)">${escapeHtml(m.forge || '')}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  if (comp.insights?.length) {
    html += `<h4 style="color:var(--gold);font-size:var(--font-size-base);margin-bottom:var(--space-2)">Composition</h4>`;
    html += `<ul class="indicator-list" style="margin-bottom:var(--space-5)">`;
    comp.insights.forEach(i => { html += `<li>${escapeHtml(i)}</li>`; });
    html += `</ul>`;
  }

  if (s.groupDynamic) {
    html += `<div class="profile-section"><h4><span class="icon-cluster"></span> Group Dynamic</h4>`;
    html += `<p style="font-size:var(--font-size-base);line-height:1.7;color:var(--text)">${escapeHtml(s.groupDynamic)}</p></div>`;
  }
  if (s.forgeInterplay) {
    html += `<div class="profile-section"><h4><span class="icon-energy"></span> Forge Interplay</h4>`;
    html += `<p style="font-size:var(--font-size-base);line-height:1.7;color:var(--text)">${escapeHtml(s.forgeInterplay)}</p></div>`;
  }
  if (s.actionPlan?.length) {
    html += `<div class="profile-section"><h4><span class="icon-check"></span> Action Plan</h4><ul class="indicator-list">`;
    s.actionPlan.forEach(step => { html += `<li>${escapeHtml(step)}</li>`; });
    html += `</ul></div>`;
  }
  if (s.communicationStrategy) {
    html += `<div class="profile-section"><h4><span class="icon-sms"></span> Communication Strategy</h4>`;
    html += `<p style="font-size:var(--font-size-base);line-height:1.7;color:var(--text)">${escapeHtml(s.communicationStrategy)}</p></div>`;
  }
  if (s.blindSpots?.length) {
    html += `<div class="profile-section"><h4><span class="icon-info"></span> Blind Spots</h4><ul class="indicator-list">`;
    s.blindSpots.forEach(b => { html += `<li>${escapeHtml(b)}</li>`; });
    html += `</ul></div>`;
  }
  if (s.warning) {
    html += `<div class="alert alert-warn" style="margin-top:var(--space-4)"><strong>\u26a0\ufe0f Watch Out:</strong> ${escapeHtml(s.warning)}</div>`;
  }
  if (s.raw) {
    html += `<div class="profile-section"><p style="font-size:var(--font-size-base);line-height:1.7;color:var(--text);white-space:pre-wrap">${escapeHtml(s.raw)}</p></div>`;
  }

  html += `</div>`;
  return html;
}

async function leaveCluster(clusterId) {
  if (!confirm('Are you sure you want to leave this cluster?')) return;

  try {
    await apiFetch(`/api/cluster/${clusterId}/leave`, { method: 'POST' });
    showAlert('clusterListContainer', 'You have left the cluster', 'success');
    backToClusterList();
    loadClusters();
  } catch (e) {
    showAlert('synthesisResult', 'Error leaving cluster: ' + e.message, 'error');
  }
}

function showAlert(containerId, message, type = 'info') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const alertHtml = `<div class="alert alert-${type}" style="margin-top:var(--space-3)">${escapeHtml(message)}</div>`;
  container.insertAdjacentHTML('afterbegin', alertHtml);
  setTimeout(() => {
    const alert = container.querySelector('.alert');
    if (alert) alert.remove();
  }, 5000);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// SCAN-050: Sanitize raw API error messages before displaying to users.
// Only pass through short, non-technical messages; replace anything that
// looks like a stack trace, SQL fragment, or internal error with a generic fallback.
function safeErrorMsg(raw, fallback) {
  if (!raw || typeof raw !== 'string') return fallback || 'Something went wrong. Please try again.';
  if (raw.length > 120 || /stack|trace|sql|relation|column|undefined|null|TypeError|Error:/i.test(raw)) {
    return fallback || 'Something went wrong. Please try again.';
  }
  return raw;
}

// Phase 1B: Source citation helper — renders a collapsible "what this is based on" tag
function renderSourceTag(sourcesText) {
  if (!sourcesText) return '';
  return `<details class="source-tag" style="margin-top:0.5rem">
    <summary style="cursor:pointer;font-size:0.75rem;color:var(--text-dim);list-style:none">
      <span style="border-bottom:1px dashed var(--text-dim)">what this is based on ▾</span>
    </summary>
    <p style="font-size:0.75rem;color:var(--text-dim);margin:0.25rem 0 0;padding:0.25rem 0.5rem;background:var(--bg3);border-radius:4px">${escapeHtml(sourcesText)}</p>
  </details>`;
}

/** Sanitize a value for use inside an HTML attribute (quotes, angle brackets). */
function escapeAttr(val) {
  return String(val).replace(/[&"'<>]/g, c => ({'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[c]));
}

function formatDate(isoString) {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── SMS Subscription ───────────────────────────────────────────
async function subscribeSMS() {
  if (!token) { openAuthOverlay(); return; }

  const phone = document.getElementById('sms-phone').value.trim();
  if (!phone || !phone.startsWith('+')) { showNotification('Phone must be in E.164 format (+17757172255)', 'warning'); return; }

  const btn = document.getElementById('smsSubBtn');
  const spinner = document.getElementById('smsSubSpinner');
  const resultEl = document.getElementById('smsResult');

  btn.disabled = true;
  spinner.style.display = '';

  try {
    const data = await apiFetch('/api/sms/subscribe', { method: 'POST', body: JSON.stringify({ phoneNumber: phone }) });
    resultEl.innerHTML = `<div class="alert alert-success"><span class="icon-check"></span> ${escapeHtml(data.message || 'Subscribed successfully')}</div>`;
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

async function unsubscribeSMS() {
  if (!token) { openAuthOverlay(); return; }

  const phone = document.getElementById('sms-phone').value.trim();
  if (!phone || !phone.startsWith('+')) { showNotification('Phone must be in E.164 format', 'warning'); return; }
  if (!confirm('Unsubscribe this number from all SMS notifications?')) return;

  const btn = document.getElementById('smsUnsubBtn');
  const spinner = document.getElementById('smsUnsubSpinner');
  const resultEl = document.getElementById('smsResult');

  btn.disabled = true;
  spinner.style.display = '';

  try {
    const data = await apiFetch('/api/sms/unsubscribe', { method: 'POST', body: JSON.stringify({ phoneNumber: phone }) });
    resultEl.innerHTML = `<div class="alert alert-success"><span class="icon-check"></span> ${escapeHtml(data.message || 'Unsubscribed')}</div>`;
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}


// Expose to global scope for use in other controllers
window.escapeHtml = escapeHtml;
