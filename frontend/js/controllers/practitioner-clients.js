/**
 * practitioner-clients.js
 * Auto-extracted from frontend/js/app.js by scripts/split-app-js.mjs (GAP-001).
 *
 * Client roster load/render, client portal, practitioner messages, invitations, referral stats
 *
 * Depends on globals defined in app.js (always loaded first):
 *   apiFetch, token, currentUser, escapeHtml, showNotification,
 *   openAuthOverlay, switchTab, showUpgradePrompt, writeJourneyFlag, readJourneyFlag
 *
 * This file is loaded lazily via _loadController() in app.js when the
 * relevant tab is first activated.  Do not add <script> tags for this
 * file to index.html — the loader handles it.
 */
// ── Practitioner Tools ─────────────────────────────────────────

function togglePracAddForm() {
  const form = document.getElementById('pracAddForm');
  const isHidden = form.style.display === 'none';
  form.style.display = isHidden ? 'block' : 'none';
  document.getElementById('pracAddToggle').textContent = isHidden ? '✕ Cancel' : '+ Invite Client';
  if (isHidden) document.getElementById('prac-client-name').focus();
}

async function addClient() {
  if (!token) { openAuthOverlay(); return; }

  const clientName = document.getElementById('prac-client-name').value.trim();
  const email = document.getElementById('prac-email').value.trim();
  if (!email) { showNotification('Client email is required', 'warning'); return; }

  const btn = document.getElementById('pracAddBtn');
  const spinner = document.getElementById('pracAddSpinner');
  const statusEl = document.getElementById('pracAddStatus');

  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = '';
  if (statusEl) statusEl.innerHTML = '';

  try {
    const data = await apiFetch('/api/practitioner/clients/invite', {
      method: 'POST',
      body: JSON.stringify({ clientName, clientEmail: email })
    });

    if (data?.error) {
      statusEl.innerHTML = `<div class="alert alert-error">${escapeHtml(data.message || data.error)}</div>`;
      return;
    }

    if (data?.mode === 'added') {
      showNotification(data.message || 'Client added to roster', 'success');
    } else {
      showNotification(data.message || 'Invitation sent', 'success');
    }
    trackEvent('practitioner', 'client_invite', data?.mode || 'unknown');

    if (data?.inviteUrl && !data?.emailSent) {
      statusEl.innerHTML = `<div class="alert alert-warn">Email delivery unavailable. Share this link manually:<br><a href="${escapeAttr(data.inviteUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(data.inviteUrl)}</a></div>`;
    }

    document.getElementById('prac-client-name').value = '';
    document.getElementById('prac-email').value = '';
    togglePracAddForm();
    loadRoster();
    loadPractitionerInvitations();
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

async function loadPractitionerInvitations() {
  if (!token) return;

  const el = document.getElementById('pracInvitesResult');
  if (!el) return;
  el.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>Loading invitations…</div></div>';

  try {
    const data = await apiFetch('/api/practitioner/clients/invitations');
    applyPractitionerInvitations(data);
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">Error loading invitations: ${escapeHtml(e.message)}</div>`;
  }
}

function applyPractitionerInvitations(data) {
  const el = document.getElementById('pracInvitesResult');
  if (!el) return;
  el.innerHTML = renderPractitionerInvitations(data);
}

function renderPractitionerInvitations(data) {
  if (data?.error) return `<div class="alert alert-error">${escapeHtml(data.error)}</div>`;

  const invitations = Array.isArray(data?.invitations) ? data.invitations : [];
  if (!invitations.length) {
    return '<div class="empty-state" style="padding:var(--space-4)"><p style="margin:0">No pending invitations.</p></div>';
  }

  let html = '<div style="display:flex;flex-direction:column;gap:var(--space-2)">';
  invitations.forEach((invite) => {
    const inviteId = escapeAttr(invite.id);
    const email = escapeHtml(invite.client_email || '');
    const name = invite.client_name ? escapeHtml(invite.client_name) : '';
    const expiresAt = invite.expires_at ? new Date(invite.expires_at).toLocaleDateString() : '—';
    html += `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap;padding:var(--space-3);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-2)">
        <div>
          <div style="font-weight:600;color:var(--text)">${name || email}</div>
          <div style="font-size:var(--font-size-sm);color:var(--text-dim)">${name ? email + ' · ' : ''}Expires ${expiresAt}</div>
        </div>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
          <button class="btn-secondary btn-sm" data-action="resendPractitionerInvitation" data-arg0="${inviteId}" data-arg1="${email}">Resend</button>
          <button class="btn-danger btn-sm" data-action="revokePractitionerInvitation" data-arg0="${inviteId}" data-arg1="${email}">Revoke</button>
        </div>
      </div>
    `;
  });
  html += '</div>';
  return html;
}

async function resendPractitionerInvitation(invitationId, emailLabel) {
  try {
    const result = await apiFetch(`/api/practitioner/clients/invitations/${invitationId}/resend`, { method: 'POST' });
    if (result?.error) {
      showNotification(safeErrorMsg(result.error, 'Unable to resend invitation'), 'error');
      return;
    }

    if (result?.inviteUrl && !result?.emailSent) {
      const copied = await copyToClipboard(result.inviteUrl);
      showNotification(
        copied
          ? `Fresh invite link copied for ${emailLabel}.`
          : `Fresh invite link created for ${emailLabel}. Share it manually.`,
        'success'
      );
    } else {
      showNotification(result?.message || `Invitation resent to ${emailLabel}`, 'success');
    }

    loadPractitionerInvitations();
  } catch (e) {
    showNotification('Error resending invitation: ' + e.message, 'error');
  }
}

async function revokePractitionerInvitation(invitationId, emailLabel) {
  if (!confirm(`Revoke invitation for ${emailLabel}?`)) return;

  try {
    await apiFetch(`/api/practitioner/clients/invitations/${invitationId}`, { method: 'DELETE' });
    showNotification(`Invitation revoked for ${emailLabel}`, 'success');
    loadPractitionerInvitations();
  } catch (e) {
    showNotification('Error revoking invitation: ' + e.message, 'error');
  }
}

// ── Client Portal ──────────────────────────────────────────────────────────
// Reverse view: client sees their practitioners, shared notes, portal data

let _portalSharedNotesOffset = 0;

async function loadClientPortal() {
  if (!token) { openAuthOverlay(); return; }

  const listEl = document.getElementById('portalPractitionersList');
  if (!listEl) return;
  listEl.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>Loading practitioners…</div></div>';

  try {
    const [data, sharingData] = await Promise.all([
      apiFetch('/api/client/my-practitioners'),
      apiFetch('/api/client/diary-sharing').catch(() => ({ data: [] }))
    ]);
    if (!data.ok || !data.practitioners?.length) {
      listEl.innerHTML = '<div class="alert alert-info">You are not currently on any practitioner\'s roster. When a practitioner adds you as a client, they\'ll appear here.</div>';
      return;
    }

    const sharingMap = {};
    (sharingData?.data || []).forEach(s => { sharingMap[s.practitioner_user_id] = s.share_diary; });

    listEl.innerHTML = data.practitioners.map(function(p) {
      const sharing = sharingMap[p.id] || false;
      return '<div class="card" style="cursor:pointer;margin-bottom:var(--space-3)" data-action="viewPortalPractitioner" data-arg0="' + escapeAttr(p.id) + '">' +
        '<div class="card-header-row">' +
          '<div><strong>' + escapeHtml(p.display_name || 'Practitioner') + '</strong>' +
            (p.specializations ? '<div class="card-hint">' + escapeHtml([].concat(p.specializations).join(', ')) + '</div>' : '') +
          '</div>' +
          (p.photo_url ? '<img src="' + escapeAttr(p.photo_url) + '" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover">' : '') +
        '</div>' +
        '<div class="card-hint">Client since ' + escapeHtml(p.relationship_since ? new Date(p.relationship_since).toLocaleDateString() : 'N/A') + '</div>' +
        '<div style="margin-top:var(--space-2);display:flex;align-items:center;gap:var(--space-2)" onclick="event.stopPropagation()">' +
          '<label style="font-size:var(--font-size-sm);color:var(--text-dim);display:flex;align-items:center;gap:var(--space-1);cursor:pointer">' +
            '<input type="checkbox" ' + (sharing ? 'checked' : '') + ' onchange="toggleDiarySharing(\'' + escapeAttr(p.id) + '\', this.checked)"> Share diary with this practitioner' +
          '</label>' +
        '</div>' +
      '</div>';
    }).join('');

    // Show all shared notes card if there are practitioners
    var allNotesCard = document.getElementById('portalAllNotesCard');
    if (allNotesCard) {
      allNotesCard.style.display = '';
      loadAllSharedNotes();
    }
  } catch (e) {
    listEl.innerHTML = '<div class="alert alert-error">Error loading portal: ' + escapeHtml(e.message) + '</div>';
  }
}

async function toggleDiarySharing(practitionerUserId, share) {
  if (!token) return;
  try {
    await apiFetch('/api/client/diary-sharing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ practitioner_user_id: practitionerUserId, share_diary: share })
    });
    showNotification(share ? 'Diary sharing enabled' : 'Diary sharing disabled', 'success');
  } catch (e) {
    showNotification('Failed to update diary sharing', 'error');
  }
}
window.toggleDiarySharing = toggleDiarySharing;

async function viewPortalPractitioner(practitionerId) {
  if (!token || !practitionerId) return;

  var detailView = document.getElementById('portalDetailView');
  var pracInfo = document.getElementById('portalPracInfo');
  var notesCard = document.getElementById('portalSharedNotes');
  var notesContent = document.getElementById('portalNotesContent');
  if (!detailView || !pracInfo) return;

  detailView.style.display = '';
  pracInfo.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>Loading portal…</div></div>';

  try {
    var data = await apiFetch('/api/client/portal/' + encodeURIComponent(practitionerId));
    if (!data.ok) {
      pracInfo.innerHTML = '<div class="alert alert-error">' + escapeHtml(data.error || 'Unable to load portal') + '</div>';
      return;
    }

    var p = data.practitioner || {};
    var html = '<div class="card-title">🤝 ' + escapeHtml(p.display_name || 'Your Practitioner') + '</div>';
    if (p.bio) html += '<p>' + escapeHtml(p.bio) + '</p>';
    if (p.session_format) html += '<div class="card-hint">Session format: ' + escapeHtml(p.session_format) + '</div>';
    if (p.booking_url) html += '<div style="margin-top:var(--space-3)"><a href="' + escapeAttr(p.booking_url) + '" target="_blank" rel="noopener" class="btn-primary btn-sm">Book a Session</a></div>';

    if (data.chart) {
      html += '<div class="card-hint" style="margin-top:var(--space-3)">📊 Chart calculated: ' + escapeHtml(new Date(data.chart.calculatedAt).toLocaleDateString()) + '</div>';
    }
    if (data.profile) {
      html += '<div class="card-hint">📋 Profile generated: ' + escapeHtml(new Date(data.profile.createdAt).toLocaleDateString()) + '</div>';
    }

    pracInfo.innerHTML = html;

    // Review form
    var reviewHtml = '<div style="margin-top:var(--space-4);padding-top:var(--space-3);border-top:1px solid var(--border)">' +
      '<h4 style="color:var(--gold);font-size:var(--font-size-sm);margin:0 0 var(--space-2)">Leave a Review</h4>' +
      '<div id="reviewFormArea-' + escapeAttr(practitionerId) + '">' +
        '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2)">' +
          '<select id="reviewRating-' + escapeAttr(practitionerId) + '" style="padding:var(--space-2);background:var(--card-bg);color:var(--text);border:1px solid var(--border);border-radius:var(--radius)">' +
            '<option value="5">★★★★★</option><option value="4">★★★★</option><option value="3">★★★</option><option value="2">★★</option><option value="1">★</option>' +
          '</select>' +
        '</div>' +
        '<textarea id="reviewContent-' + escapeAttr(practitionerId) + '" placeholder="Share your experience (min 10 chars)…" rows="3" maxlength="2000" style="width:100%;padding:var(--space-2);background:var(--card-bg);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);resize:vertical;margin-bottom:var(--space-2)"></textarea>' +
        '<button class="btn-primary btn-sm" data-action="submitReview" data-arg0="' + escapeAttr(practitionerId) + '">Submit Review</button>' +
      '</div>' +
    '</div>';
    pracInfo.innerHTML = html + reviewHtml;

    // Shared notes
    if (data.sharedNotes?.length && notesCard && notesContent) {
      notesCard.style.display = '';
      notesContent.innerHTML = data.sharedNotes.map(function(n) {
        return '<div class="session-note-item" style="padding:var(--space-3);border-bottom:var(--border-width-thin) solid var(--border-subtle)">' +
          '<div class="card-hint">' + escapeHtml(n.session_date || '') + '</div>' +
          '<p style="margin:var(--space-1) 0 0">' + escapeHtml(n.content) + '</p>' +
        '</div>';
      }).join('');
    } else if (notesCard) {
      notesCard.style.display = 'none';
    }

    // 5.1+5.3: messaging + journey
    loadClientMessages(practitionerId);
    loadPortalJourney(practitionerId, data);
  } catch (e) {
    pracInfo.innerHTML = '<div class="alert alert-error">Error: ' + escapeHtml(e.message) + '</div>';
  }
}

async function submitReview(practitionerId) {
  const ratingEl = document.getElementById('reviewRating-' + practitionerId);
  const contentEl = document.getElementById('reviewContent-' + practitionerId);
  const content = contentEl?.value?.trim();
  if (!content || content.length < 10) { showNotification('Review must be at least 10 characters.', 'warn'); return; }
  try {
    await apiFetch('/api/client/reviews', {
      method: 'POST',
      body: JSON.stringify({
        practitioner_id: practitionerId,
        rating: parseInt(ratingEl?.value || '5', 10),
        content
      })
    });
    showNotification('Review submitted! It will appear after practitioner approval.', 'success');
    trackEvent?.('client', 'review_submitted', practitionerId);
    const area = document.getElementById('reviewFormArea-' + practitionerId);
    if (area) area.innerHTML = '<div class="alert alert-success" style="font-size:var(--font-size-sm)">✓ Review submitted — pending approval</div>';
  } catch (e) {
    showNotification(e.message?.includes('already') ? 'You have already reviewed this practitioner.' : 'Error: ' + e.message, 'error');
  }
}

// Practitioner-Client Messaging (5.1)
async function loadPractitionerMessages(clientId) {
  var el = document.getElementById('msgThread-' + clientId);
  if (!el) return;
  try {
    var data = await apiFetch('/api/practitioner/clients/' + encodeURIComponent(clientId) + '/messages?limit=50&offset=0');
    var msgs = data.messages || [];
    if (!msgs.length) {
      el.innerHTML = '<div style="color:var(--text-dim);font-size:var(--font-size-sm);padding:var(--space-3)">No messages yet. Start the conversation.</div>';
      return;
    }
    el.innerHTML = msgs.map(function(m) {
      var isPract = m.sender_is_practitioner;
      var align   = isPract ? 'right' : 'left';
      var bg      = isPract ? 'rgba(201,168,76,0.14)' : 'var(--bg3)';
      return '<div style="padding:8px 12px;margin-bottom:6px;border-radius:6px;background:' + bg + ';max-width:80%;margin-' + align + ':' + (align==='right'?'auto':'0') + '">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px">' +
          '<span style="font-size:12px;font-weight:600;color:var(--gold)">' + escapeHtml(m.sender_name || '') + '</span>' +
          '<span style="font-size:11px;color:var(--text-dim)">' + escapeHtml(new Date(m.created_at).toLocaleString()) + '</span>' +
        '</div>' +
        '<div style="color:var(--text);word-break:break-word">' + escapeHtml(m.body || '') + '</div></div>';
    }).join('');
    el.scrollTop = el.scrollHeight;
  } catch (e) {
    if (el) el.innerHTML = '<div class="alert alert-warn">Could not load messages.</div>';
  }
}

async function sendPractitionerMessage(clientId) {
  var inputEl  = document.getElementById('msgInput-'  + clientId);
  var statusEl = document.getElementById('msgStatus-' + clientId);
  var body = inputEl ? inputEl.value.trim() : '';
  if (!body) { showNotification('Please enter a message.', 'warn'); return; }
  if (body.length > 2000) { showNotification('Message too long (max 2000 chars).', 'warn'); return; }
  try {
    if (statusEl) statusEl.textContent = 'Sending...';
    await apiFetch('/api/practitioner/clients/' + encodeURIComponent(clientId) + '/messages', {
      method: 'POST', body: JSON.stringify({ body: body })
    });
    if (inputEl)  inputEl.value = '';
    if (statusEl) statusEl.textContent = 'Sent!';
    await loadPractitionerMessages(clientId);
    setTimeout(function() { if (statusEl) statusEl.textContent = ''; }, 2000);
  } catch (e) {
    showNotification('Failed to send: ' + e.message, 'error');
    if (statusEl) statusEl.textContent = '';
  }
}

// Client Messaging (5.1)
async function loadClientMessages(practitionerId) {
  var card    = document.getElementById('portalMessagesCard');
  var content = document.getElementById('portalMessagesContent');
  var sendBtn = document.getElementById('portalMsgSendBtn');
  if (!card || !content) return;
  try {
    var data = await apiFetch('/api/client/messages');
    var msgs = (data.messages || []).filter(function(m) { return m.practitioner_id === practitionerId; });
    card.style.display = '';
    if (msgs.length) {
      content.innerHTML = msgs.map(function(m) {
        var isMine = !m.sender_is_practitioner;
        var align  = isMine ? 'right' : 'left';
        var bg     = isMine ? 'rgba(201,168,76,0.14)' : 'var(--bg3)';
        return '<div style="padding:8px 12px;margin-bottom:6px;border-radius:6px;background:' + bg + ';max-width:80%;margin-' + align + ':' + (align==='right'?'auto':'0') + '">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px">' +
            '<span style="font-size:12px;font-weight:600;color:var(--gold)">' + escapeHtml(m.sender_name || '') + '</span>' +
            '<span style="font-size:11px;color:var(--text-dim)">' + escapeHtml(new Date(m.created_at).toLocaleString()) + '</span>' +
          '</div>' +
          '<div style="color:var(--text);word-break:break-word">' + escapeHtml(m.body || '') + '</div></div>';
      }).join('');
      content.scrollTop = content.scrollHeight;
    } else {
      content.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:12px">No messages yet. Send your first message below.</div>';
    }
    if (sendBtn) {
      var _pid = practitionerId;
      sendBtn.onclick = function() { sendClientMessage(_pid); };
    }
  } catch (e) {
    if (card) card.style.display = 'none';
  }
}

async function sendClientMessage(practitionerId) {
  var inputEl  = document.getElementById('portalMsgInput');
  var statusEl = document.getElementById('portalMsgStatus');
  var body = inputEl ? inputEl.value.trim() : '';
  if (!body) { showNotification('Please enter a message.', 'warn'); return; }
  if (body.length > 2000) { showNotification('Message too long (max 2000 chars).', 'warn'); return; }
  if (!practitionerId) { showNotification('No practitioner selected.', 'warn'); return; }
  try {
    if (statusEl) statusEl.textContent = 'Sending...';
    await apiFetch('/api/client/messages', {
      method: 'POST', body: JSON.stringify({ practitionerId: practitionerId, body: body })
    });
    if (inputEl)  inputEl.value = '';
    if (statusEl) statusEl.textContent = 'Sent!';
    await loadClientMessages(practitionerId);
    setTimeout(function() { if (statusEl) statusEl.textContent = ''; }, 2000);
  } catch (e) {
    showNotification('Failed to send: ' + e.message, 'error');
    if (statusEl) statusEl.textContent = '';
  }
}

// Client Journey Timeline (5.3)
function loadPortalJourney(practitionerId, data) {
  var card    = document.getElementById('portalJourneyCard');
  var content = document.getElementById('portalJourneyContent');
  if (!card || !content) return;
  content.innerHTML = renderPortalJourneyTimeline(data);
  card.style.display = '';
}

function renderPortalJourneyTimeline(data) {
  if (!data) return '';
  var p       = data.practitioner || {};
  var chart   = data.chart;
  var profile = data.profile;
  var notes   = data.sharedNotes || [];
  var milestones = [
    { label: 'Connected with ' + escapeHtml(p.display_name || 'Practitioner'),
      date: data.connectedAt || null, icon: '&#x1F91D;', done: true },
    { label: 'Blueprint Calculated',
      date: chart ? (chart.calculatedAt || null) : null,
      icon: '&#x1F4CA;', done: !!chart },
    { label: 'Prime Self Profile Generated',
      date: profile ? (profile.createdAt || null) : null,
      icon: '&#x1F4CB;', done: !!profile },
    { label: 'First Shared Session Note',
      date: notes.length ? (notes[notes.length-1].session_date || notes[notes.length-1].created_at || null) : null,
      icon: '&#x1F4DD;', done: notes.length > 0 },
    { label: '3-Month Integration Milestone', date: null, icon: '&#x2728;', done: false },
  ];
  var html = '<div style="position:relative;padding-left:28px">';
  milestones.forEach(function(m, i) {
    var isLast  = i === milestones.length - 1;
    var dateStr = m.date ? new Date(m.date).toLocaleDateString() : '';
    var lineColor = m.done ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.08)';
    html += '<div style="position:relative;padding-bottom:' + (isLast ? '0' : '20px') + '">';
    if (!isLast) html += '<div style="position:absolute;left:-20px;top:20px;bottom:0;width:2px;background:' + lineColor + '"></div>';
    html += '<div style="position:absolute;left:-28px;top:4px;width:16px;height:16px;border-radius:50%;background:' + (m.done ? 'var(--gold)' : 'var(--bg3)') + ';border:2px solid ' + (m.done ? 'var(--gold)' : 'var(--text-dim)') + ';display:flex;align-items:center;justify-content:center;font-size:8px;color:#000">' + (m.done ? '\u2713' : '') + '</div>';
    html += '<div style="padding-left:4px"><div style="font-size:13px;font-weight:600;color:' + (m.done ? 'var(--gold)' : 'var(--text-dim)') + '">' + m.icon + ' ' + m.label + '</div>' + (dateStr ? '<div style="font-size:11px;color:var(--text-dim)">' + escapeHtml(dateStr) + '</div>' : '') + '</div></div>';
  });
  html += '</div>';
  return html;
}

async function loadAllSharedNotes() {
  if (!token) return;
  _portalSharedNotesOffset = 0;
  var el = document.getElementById('portalAllNotesContent');
  if (!el) return;
  el.innerHTML = '<div class="spinner"></div>';

  try {
    var data = await apiFetch('/api/client/shared-notes?limit=20&offset=0');
    if (!data.ok || !data.notes?.length) {
      el.innerHTML = '<div class="card-hint">No shared notes yet. When your practitioner shares session notes with you, they\'ll appear here.</div>';
      document.getElementById('portalAllNotesMore').style.display = 'none';
      return;
    }

    el.innerHTML = data.notes.map(function(n) {
      return '<div class="session-note-item" style="padding:var(--space-3);border-bottom:var(--border-width-thin) solid var(--border-subtle)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<strong>' + escapeHtml(n.practitioner_name || 'Practitioner') + '</strong>' +
          '<span class="card-hint">' + escapeHtml(n.session_date || '') + '</span>' +
        '</div>' +
        '<p style="margin:var(--space-1) 0 0">' + escapeHtml(n.content) + '</p>' +
      '</div>';
    }).join('');

    _portalSharedNotesOffset = data.notes.length;
    var moreEl = document.getElementById('portalAllNotesMore');
    if (moreEl) moreEl.style.display = data.hasMore ? '' : 'none';
  } catch (e) {
    el.innerHTML = '<div class="alert alert-error">' + escapeHtml(e.message) + '</div>';
  }
}

async function loadMoreSharedNotes() {
  if (!token) return;
  var el = document.getElementById('portalAllNotesContent');
  if (!el) return;

  try {
    var data = await apiFetch('/api/client/shared-notes?limit=20&offset=' + _portalSharedNotesOffset);
    if (!data.ok || !data.notes?.length) {
      document.getElementById('portalAllNotesMore').style.display = 'none';
      return;
    }

    el.innerHTML += data.notes.map(function(n) {
      return '<div class="session-note-item" style="padding:var(--space-3);border-bottom:var(--border-width-thin) solid var(--border-subtle)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<strong>' + escapeHtml(n.practitioner_name || 'Practitioner') + '</strong>' +
          '<span class="card-hint">' + escapeHtml(n.session_date || '') + '</span>' +
        '</div>' +
        '<p style="margin:var(--space-1) 0 0">' + escapeHtml(n.content) + '</p>' +
      '</div>';
    }).join('');

    _portalSharedNotesOffset += data.notes.length;
    var moreEl = document.getElementById('portalAllNotesMore');
    if (moreEl) moreEl.style.display = data.hasMore ? '' : 'none';
  } catch (e) {
    // silent — pagination error
  }
}

// Show portal nav item when user is on any practitioner's roster
async function checkClientPortalVisibility() {
  if (!token) return;
  try {
    var data = await apiFetch('/api/client/my-practitioners');
    var navBtn = document.getElementById('nav-my-practitioner');
    if (navBtn && data.ok && data.practitioners?.length > 0) {
      navBtn.style.display = '';
    }
  } catch (_) { /* silent */ }
}

async function loadRoster() {
  if (!token) { openAuthOverlay(); return; }

  const resultEl = document.getElementById('pracResult');
  if (!resultEl) return;
  resultEl.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>Loading your roster…</div></div>';

  try {
    const [rosterData, profileData, invitationsData, directoryData, referralData, metricsData, dirStatsData, earningsData] = await Promise.all([
      apiFetch('/api/practitioner/clients'),
      apiFetch('/api/practitioner/profile').catch(() => null),
      apiFetch('/api/practitioner/clients/invitations').catch(() => ({ invitations: [] })),
      apiFetch('/api/practitioner/directory-profile').catch(() => ({ error: 'Not yet configured' })),
      apiFetch('/api/practitioner/referral-link').catch(() => null),
      apiFetch('/api/practitioner/stats').catch(() => null),
      apiFetch('/api/practitioner/directory-stats').catch(() => null),
      apiFetch('/api/referrals').catch(() => null)
    ]);

    // Update limit bar
    if (profileData?.practitioner) {
      const { clientCount, clientLimit } = profileData.practitioner;
      const limitEl = document.getElementById('pracLimitBar');
      const labelEl = document.getElementById('pracLimitLabel');
      const fillEl  = document.getElementById('pracLimitFill');
      if (limitEl && clientLimit !== null) {
        limitEl.style.display = 'block';
        labelEl.textContent = `${clientCount} / ${clientLimit}`;
        fillEl.style.width = `${Math.min(100, (clientCount / clientLimit) * 100)}%`;
        fillEl.style.background = clientCount >= clientLimit ? 'var(--error, #e74c3c)' : 'var(--gold)';
      }
    }

    renderPractitionerActivationPlan({ rosterData, profileData, invitationsData, directoryData, metricsData });
    renderPractitionerMetrics(metricsData, dirStatsData);
    resultEl.innerHTML = renderRoster(rosterData);
    _practitionerRosterClients = Array.isArray(rosterData?.clients) ? rosterData.clients : [];
    applyPractitionerInvitations(invitationsData);
    applyDirectoryProfileData(directoryData);
    renderPractitionerReferralStats(referralData);
    renderPractitionerMarketingKit(referralData);
    loadPractitionerGifts();
    renderPractitionerEarnings(earningsData);
    loadPractitionerPromo();
    _pracSchedulingEmbedUrl    = directoryData?.profile?.scheduling_embed_url || '';
    _practitionerBookingUrl    = directoryData?.profile?.booking_url || '';

    // Show and populate Agency Seats card for Agency-tier users
    const tier = currentUser?.tier || 'free';
    const agencyCard = document.getElementById('agencySeatsCard');
    if (agencyCard) {
      agencyCard.style.display = (tier === 'agency' || tier === 'white_label') ? '' : 'none';
      if (tier === 'agency' || tier === 'white_label') loadAgencySeats();
    }
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Error loading roster: ${escapeHtml(e.message)}</div>`;
  }
}

