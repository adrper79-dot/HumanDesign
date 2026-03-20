/**
 * practitioner-notes.js
 * Auto-extracted from frontend/js/app.js by scripts/split-app-js.mjs (GAP-001).
 *
 * Session notes CRUD, note templates, divination readings, session actions, AI context, directory profile, reviews, CSV, Notion, remove client
 *
 * Depends on globals defined in app.js (always loaded first):
 *   apiFetch, token, currentUser, escapeHtml, showNotification,
 *   openAuthOverlay, switchTab, showUpgradePrompt, writeJourneyFlag, readJourneyFlag
 *
 * This file is loaded lazily via _loadController() in app.js when the
 * relevant tab is first activated.  Do not add <script> tags for this
 * file to index.html — the loader handles it.
 */
// ── Session Note Template Picker ─────────────────────────────
let _noteTemplatesCache = null;

async function loadNoteTemplates(clientId) {
  const sel = document.getElementById('noteTemplate-' + clientId);
  if (!sel || sel.options.length > 1) return; // already loaded
  if (!_noteTemplatesCache) {
    try {
      const data = await apiFetch('/api/practitioner/session-templates');
      _noteTemplatesCache = data?.templates || [];
    } catch { _noteTemplatesCache = []; }
  }
  _noteTemplatesCache.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.name} — ${t.description}`;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => applyNoteTemplate(clientId));
}

async function applyNoteTemplate(clientId) {
  const sel = document.getElementById('noteTemplate-' + clientId);
  const textarea = document.getElementById('noteContent-' + clientId);
  if (!sel || !textarea) return;
  const templateId = sel.value;
  if (!templateId) { textarea.placeholder = 'Write your session notes here…'; return; }

  // Find client data from roster cache for hydration
  const client = (_practitionerRosterClients || []).find(c => c.id === clientId) || {};
  try {
    const data = await apiFetch(`/api/practitioner/session-templates/${templateId}/hydrate`, {
      method: 'POST',
      body: JSON.stringify({
        clientId,
        clientName: client.email || '',
        clientType: client.type || '',
        clientProfile: client.profile || '',
        clientAuthority: client.authority || ''
      })
    });
    if (data?.template?.sections) {
      const text = data.template.sections.map(s =>
        `## ${s.label}\n${s.context ? `_${s.context}_\n` : ''}${s.prompt}\n`
      ).join('\n');
      textarea.value = text;
      textarea.rows = Math.max(8, data.template.sections.length * 4);
      trackEvent?.('practitioner', 'template_hydrated', templateId);
    }
  } catch {
    // Fallback: use cached template sections without hydration
    const t = _noteTemplatesCache?.find(t => t.id === templateId);
    if (t) textarea.placeholder = `Template: ${t.name}`;
  }
  trackEvent?.('practitioner', 'template_selected', templateId);
}
window.applyNoteTemplate = applyNoteTemplate;

function hideNewNoteForm(clientId) {
  const form = document.getElementById('newNoteForm-' + clientId);
  if (form) {
    form.style.display = 'none';
    const content = document.getElementById('noteContent-' + clientId);
    if (content) content.value = '';
    const sel = document.getElementById('noteTemplate-' + clientId);
    if (sel) sel.value = '';
  }
}

async function saveSessionNote(clientId) {
  const content = document.getElementById('noteContent-' + clientId)?.value?.trim();
  const sessionDate = document.getElementById('noteDate-' + clientId)?.value || null;
  const shareWithAi = document.getElementById('noteShareAi-' + clientId)?.checked || false;

  if (!content) {
    showNotification('Please enter note content.', 'error');
    return;
  }

  try {
    const result = await apiFetch(`/api/practitioner/clients/${clientId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content, session_date: sessionDate, share_with_ai: shareWithAi })
    });

    if (result.error) {
      showNotification('Error saving note: ' + safeErrorMsg(result.error, 'Unable to save note'), 'error');
      return;
    }

    showNotification('Note saved', 'success');
    trackEvent('practitioner', 'note_create', clientId);
    hideNewNoteForm(clientId);
    await refreshSessionNotes(clientId);
  } catch (e) {
    showNotification('Error saving note. Please try again.', 'error');
  }
}

async function editSessionNote(noteId, clientId) {
  const noteEl = document.getElementById('note-' + noteId);
  if (!noteEl) return;

  // Get existing content from the rendered text
  const contentEl = noteEl.querySelector('[style*="white-space:pre-wrap"]');
  const existingContent = contentEl ? contentEl.textContent : '';

  noteEl.innerHTML = `
    <textarea id="editNoteContent-${escapeAttr(noteId)}" rows="4" class="form-input"
      style="width:100%;resize:vertical;margin-bottom:var(--space-2)" maxlength="5000">${escapeHtml(existingContent)}</textarea>
    <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:var(--space-1);font-size:var(--font-size-sm);color:var(--text-dim);cursor:pointer">
        <input type="checkbox" id="editNoteShareAi-${escapeAttr(noteId)}"> Share with AI
      </label>
      <div style="margin-left:auto;display:flex;gap:var(--space-2)">
        <button class="btn-secondary btn-sm" data-action="cancelEditNote" data-arg0="${escapeAttr(noteId)}" data-arg1="${escapeAttr(clientId)}">Cancel</button>
        <button class="btn-primary btn-sm" data-action="updateSessionNote" data-arg0="${escapeAttr(noteId)}" data-arg1="${escapeAttr(clientId)}">Update</button>
      </div>
    </div>`;

  document.getElementById('editNoteContent-' + noteId)?.focus();
}

async function cancelEditNote(noteId, clientId) {
  // Reload the notes to restore original rendering
  await refreshSessionNotes(clientId);
}

async function updateSessionNote(noteId, clientId) {
  const content = document.getElementById('editNoteContent-' + noteId)?.value?.trim();
  const shareWithAi = document.getElementById('editNoteShareAi-' + noteId)?.checked || false;

  if (!content) {
    showNotification('Note content cannot be empty.', 'error');
    return;
  }

  try {
    const result = await apiFetch(`/api/practitioner/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ content, share_with_ai: shareWithAi })
    });

    if (result.error) {
      showNotification('Error updating note: ' + safeErrorMsg(result.error, 'Unable to update note'), 'error');
      return;
    }

    showNotification('Note updated', 'success');
    trackEvent?.('practitioner', 'note_edited', noteId);
    await refreshSessionNotes(clientId);
  } catch (e) {
    showNotification('Error updating note. Please try again.', 'error');
  }
}

async function deleteSessionNote(noteId, clientId) {
  if (!confirm('Delete this session note?')) return;

  try {
    const result = await apiFetch(`/api/practitioner/notes/${noteId}`, { method: 'DELETE' });

    if (result.error) {
      showNotification('Error deleting note: ' + safeErrorMsg(result.error, 'Unable to delete note'), 'error');
      return;
    }

    showNotification('Note deleted', 'success');
    trackEvent?.('practitioner', 'note_deleted', noteId);
    await refreshSessionNotes(clientId);
  } catch (e) {
    showNotification('Error deleting note. Please try again.', 'error');
  }
}

async function refreshSessionNotes(clientId) {
  const listEl = document.getElementById('notesList-' + clientId);
  if (!listEl) return;

  try {
    const notesData = await apiFetch(`/api/practitioner/clients/${clientId}/notes?limit=10&offset=0`);
    const notes = notesData?.notes || [];
    const notesTotal = notesData?.total ?? notes.length;
    const notesHasMore = notesData?.hasMore ?? false;

    if (notes.length === 0) {
      listEl.innerHTML = `<div style="color:var(--text-dim);font-size:var(--font-size-sm);padding:var(--space-3) 0">No session notes yet. Add your first note to start building a record.</div>`;
    } else {
      let html = '';
      if (notesTotal > notes.length) {
        html += `<div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-2)">Showing ${notes.length} of ${notesTotal} notes</div>`;
      }
      html += notes.map(n => renderSessionNote(n, clientId)).join('');
      if (notesHasMore) {
        html += `<button class="btn-secondary btn-sm" style="margin-top:var(--space-3)" data-action="loadMoreNotes" data-arg0="${escapeAttr(clientId)}" data-arg1="1" id="loadMoreNotesBtn-${escapeAttr(clientId)}">Load 10 more</button>`;
      }
      listEl.innerHTML = html;
    }
  } catch (e) {
    listEl.innerHTML = `<div class="alert alert-error">Error loading notes: ${escapeHtml(e.message)}</div>`;
  }
}

async function loadMoreNotes(clientId, page) {
  const pageNum = parseInt(page, 10) || 1;
  const offset = pageNum * 10;
  const btn = document.getElementById('loadMoreNotesBtn-' + clientId);
  const listEl = document.getElementById('notesList-' + clientId);
  if (!listEl) return;

  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

  try {
    const notesData = await apiFetch(`/api/practitioner/clients/${clientId}/notes?limit=10&offset=${offset}`);
    const newNotes = notesData?.notes || [];
    const notesTotal = notesData?.total ?? 0;
    const notesHasMore = notesData?.hasMore ?? false;

    // Remove existing Load More button
    if (btn) btn.remove();

    // Update count display
    const countEl = listEl.querySelector('[data-notes-count]');
    const currentCount = listEl.querySelectorAll('[data-note-id]').length + newNotes.length;
    if (countEl) countEl.textContent = `Showing ${currentCount} of ${notesTotal} notes`;

    // Append new notes
    const frag = document.createDocumentFragment();
    newNotes.forEach(note => {
      const tmp = document.createElement('div');
      tmp.innerHTML = renderSessionNote(note, clientId);
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
    });

    // Insert before the "Load more" button position (append to listEl)
    listEl.appendChild(frag);

    // Append new Load More button if needed
    if (notesHasMore) {
      const newBtn = document.createElement('button');
      newBtn.className = 'btn-secondary btn-sm';
      newBtn.style.marginTop = 'var(--space-3)';
      newBtn.dataset.action = 'loadMoreNotes';
      newBtn.dataset.arg0 = clientId;
      newBtn.dataset.arg1 = String(pageNum + 1);
      newBtn.id = 'loadMoreNotesBtn-' + clientId;
      newBtn.textContent = 'Load 10 more';
      listEl.appendChild(newBtn);
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Load 10 more'; }
    showNotification('Error loading more notes: ' + e.message, 'error');
  }
}

// ── Divination Readings CRUD ─────────────────────────────────────────

function showNewReadingForm(clientId) {
  const form = document.getElementById('newReadingForm-' + clientId);
  if (form) {
    form.style.display = '';
    const dateEl = document.getElementById('readingDate-' + clientId);
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
  }
  loadClientReadings(clientId);
}

function hideNewReadingForm(clientId) {
  const form = document.getElementById('newReadingForm-' + clientId);
  if (form) form.style.display = 'none';
  const interp = document.getElementById('readingInterpretation-' + clientId);
  if (interp) interp.value = '';
  const spread = document.getElementById('readingSpread-' + clientId);
  if (spread) spread.value = '';
}

async function saveDivinationReading(clientId) {
  const dateEl = document.getElementById('readingDate-' + clientId);
  const typeEl = document.getElementById('readingType-' + clientId);
  const spreadEl = document.getElementById('readingSpread-' + clientId);
  const interpEl = document.getElementById('readingInterpretation-' + clientId);
  const shareEl = document.getElementById('readingShareAi-' + clientId);

  const interpretation = interpEl?.value?.trim();
  if (!interpretation) { showNotification('Please add an interpretation.', 'warn'); return; }

  try {
    await apiFetch(`/api/practitioner/clients/${clientId}/readings`, {
      method: 'POST',
      body: JSON.stringify({
        reading_type: typeEl?.value || 'tarot',
        spread_type: spreadEl?.value?.trim() || null,
        interpretation,
        share_with_ai: shareEl?.checked || false,
        reading_date: dateEl?.value || new Date().toISOString().slice(0, 10)
      })
    });
    showNotification('Reading saved.', 'success');
    trackEvent?.('practitioner', 'reading_created', typeEl?.value);
    hideNewReadingForm(clientId);
    await loadClientReadings(clientId);
  } catch (e) {
    showNotification('Error saving reading: ' + e.message, 'error');
  }
}

async function loadClientReadings(clientId) {
  const listEl = document.getElementById('readingsList-' + clientId);
  if (!listEl) return;
  try {
    const data = await apiFetch(`/api/practitioner/clients/${clientId}/readings?limit=10&offset=0`);
    const readings = data?.readings || [];
    if (readings.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text-dim);font-size:var(--font-size-sm);padding:var(--space-3) 0">No readings yet. Record your first divination reading.</div>';
    } else {
      listEl.innerHTML = readings.map(r => renderDivinationReading(r, clientId)).join('');
    }
  } catch (e) {
    listEl.innerHTML = `<div class="alert alert-error">Error loading readings: ${escapeHtml(e.message)}</div>`;
  }
}

function renderDivinationReading(r, clientId) {
  const date = r.reading_date ? new Date(r.reading_date).toLocaleDateString() : '—';
  const type = escapeHtml(r.reading_type || 'tarot');
  const spread = r.spread_type ? escapeHtml(r.spread_type) : '';
  const interp = escapeHtml(r.interpretation || '').substring(0, 300);
  const readingId = escapeAttr(r.id);
  const safeClientId = escapeAttr(clientId);
  return `
    <div style="padding:var(--space-3) 0;border-bottom:1px solid var(--border)" data-reading-id="${readingId}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-1)">
        <div style="font-size:var(--font-size-sm);color:var(--text-dim)">${date} · <span style="text-transform:capitalize">${type}</span>${spread ? ' · ' + spread : ''}</div>
        <div style="display:flex;gap:var(--space-2)">
          <button class="btn-secondary btn-sm" style="font-size:var(--font-size-xs);padding:2px 8px" data-action="deleteDivinationReading" data-arg0="${readingId}" data-arg1="${safeClientId}">Delete</button>
        </div>
      </div>
      <div style="font-size:var(--font-size-sm);color:var(--text);white-space:pre-wrap;line-height:1.5">${interp}${r.interpretation && r.interpretation.length > 300 ? '…' : ''}</div>
      ${r.share_with_ai ? '<div style="font-size:var(--font-size-xs);color:var(--gold);margin-top:4px">📤 Shared with client</div>' : ''}
    </div>`;
}

async function deleteDivinationReading(readingId, clientId) {
  if (!confirm('Delete this reading?')) return;
  try {
    await apiFetch(`/api/practitioner/readings/${readingId}`, { method: 'DELETE' });
    showNotification('Reading deleted.', 'success');
    trackEvent?.('practitioner', 'reading_deleted', readingId);
    await loadClientReadings(clientId);
  } catch (e) {
    showNotification('Error deleting reading: ' + e.message, 'error');
  }
}

// ── Session Actions CRUD ────────────────────────────────────────────

function showNewActionForm(clientId) {
  const form = document.getElementById('newActionForm-' + clientId);
  if (form) form.style.display = '';
}

function hideNewActionForm(clientId) {
  const form = document.getElementById('newActionForm-' + clientId);
  if (form) form.style.display = 'none';
  const title = document.getElementById('actionTitle-' + clientId);
  if (title) title.value = '';
  const desc = document.getElementById('actionDescription-' + clientId);
  if (desc) desc.value = '';
  const due = document.getElementById('actionDue-' + clientId);
  if (due) due.value = '';
}

async function saveSessionAction(clientId) {
  const titleEl = document.getElementById('actionTitle-' + clientId);
  const descEl = document.getElementById('actionDescription-' + clientId);
  const dueEl = document.getElementById('actionDue-' + clientId);

  const title = titleEl?.value?.trim();
  if (!title) { showNotification('Please enter an action title.', 'warn'); return; }

  try {
    await apiFetch(`/api/practitioner/clients/${clientId}/actions`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: descEl?.value?.trim() || null,
        due_date: dueEl?.value || null
      })
    });
    showNotification('Action assigned.', 'success');
    trackEvent?.('practitioner', 'action_created', title);
    hideNewActionForm(clientId);
    await loadClientActions(clientId);
  } catch (e) {
    showNotification('Error saving action: ' + e.message, 'error');
  }
}

async function loadClientActions(clientId) {
  const listEl = document.getElementById('actionsList-' + clientId);
  if (!listEl) return;
  try {
    const data = await apiFetch(`/api/practitioner/clients/${clientId}/actions?limit=20&offset=0`);
    const actions = data?.actions || [];
    if (actions.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text-dim);font-size:var(--font-size-sm);padding:var(--space-3) 0">No actions assigned yet.</div>';
    } else {
      listEl.innerHTML = actions.map(a => renderSessionAction(a, clientId)).join('');
    }
  } catch (e) {
    listEl.innerHTML = `<div class="alert alert-error">Error loading actions: ${escapeHtml(e.message)}</div>`;
  }
}

function renderSessionAction(a, clientId) {
  const actionId = escapeAttr(a.id);
  const safeClientId = escapeAttr(clientId);
  const isDone = a.status === 'completed';
  const isOverdue = !isDone && a.due_date && new Date(a.due_date) < new Date();
  const dueStr = a.due_date ? new Date(a.due_date).toLocaleDateString() : '';
  const statusColor = isDone ? 'var(--accent2)' : isOverdue ? 'var(--error,#e74c3c)' : 'var(--text-dim)';
  const statusLabel = isDone ? '✓ Completed' : isOverdue ? '⚠ Overdue' : (dueStr ? `Due ${dueStr}` : 'Pending');

  return `
    <div style="padding:var(--space-3) 0;border-bottom:1px solid var(--border);${isDone ? 'opacity:0.6' : ''}" data-action-id="${actionId}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-1)">
        <div style="font-weight:600;font-size:var(--font-size-sm);color:var(--text);${isDone ? 'text-decoration:line-through' : ''}">${escapeHtml(a.title)}</div>
        <div style="display:flex;gap:var(--space-2);align-items:center">
          <span style="font-size:var(--font-size-xs);color:${statusColor}">${statusLabel}</span>
          ${!isDone ? `<button class="btn-secondary btn-sm" style="font-size:var(--font-size-xs);padding:2px 8px" data-action="deleteSessionAction" data-arg0="${actionId}" data-arg1="${safeClientId}">Delete</button>` : ''}
        </div>
      </div>
      ${a.description ? `<div style="font-size:var(--font-size-sm);color:var(--text-dim);line-height:1.5;white-space:pre-wrap">${escapeHtml(a.description)}</div>` : ''}
      ${a.completed_at ? `<div style="font-size:var(--font-size-xs);color:var(--accent2);margin-top:4px">Completed ${new Date(a.completed_at).toLocaleDateString()}</div>` : ''}
    </div>`;
}

async function deleteSessionAction(actionId, clientId) {
  if (!confirm('Delete this action?')) return;
  try {
    await apiFetch(`/api/practitioner/actions/${actionId}`, { method: 'DELETE' });
    showNotification('Action deleted.', 'success');
    trackEvent?.('practitioner', 'action_deleted', actionId);
    await loadClientActions(clientId);
  } catch (e) {
    showNotification('Error deleting action: ' + e.message, 'error');
  }
}

// BL-EXC-P2-4: AI context char count + debounced autosave
const _aiContextTimers = {};
function onAIContextInput(clientId) {
  const field = document.getElementById('aiContext-' + clientId);
  const countEl = document.getElementById('aiContextCharCount-' + clientId);
  if (!field) return;
  const len = field.value.length;
  if (countEl) {
    countEl.textContent = `${len} / 2000`;
    countEl.style.color = len >= 1800 ? 'var(--warning, #e8a838)' : 'var(--text-dim)';
  }
  clearTimeout(_aiContextTimers[clientId]);
  _aiContextTimers[clientId] = setTimeout(() => saveAIContext(clientId, true), 2000);
}
window.onAIContextInput = onAIContextInput;

async function saveAIContext(clientId, isAutosave = false) {
  const field = document.getElementById('aiContext-' + clientId);
  const statusEl = document.getElementById('aiContextStatus-' + clientId);
  if (!field || !statusEl) return;

  const aiContext = field.value.trim();
  statusEl.textContent = 'Saving…';

  try {
    const result = await apiFetch(`/api/practitioner/clients/${clientId}/ai-context`, {
      method: 'PUT',
      body: JSON.stringify({ ai_context: aiContext })
    });

    if (result.error) {
      statusEl.textContent = 'AI context could not be saved.';
      if (!isAutosave) showNotification('Error saving AI context: ' + result.error, 'error');
      return;
    }

    statusEl.textContent = 'Saved ✓';
    if (!isAutosave) {
      showNotification('AI context saved.', 'success');
      trackEvent('practitioner', 'ai_context_save', clientId);
    }
    setTimeout(() => {
      const el = document.getElementById('aiContextStatus-' + clientId);
      if (el && el.textContent === 'Saved ✓') {
        const now = new Date();
        el.textContent = `Last saved: just now`;
      }
    }, 3000);
  } catch (e) {
    statusEl.textContent = 'AI context could not be saved.';
    if (!isAutosave) showNotification('Error saving AI context: ' + e.message, 'error');
  }
}

// ── Practitioner Directory Profile editing ──────────────────

function toggleDirectoryForm() {
  const form = document.getElementById('dirProfileForm');
  if (!form) return;
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function loadDirectoryProfile() {
  const summaryEl = document.getElementById('dirProfileSummary');
  if (!summaryEl) return;

  try {
    const data = await apiFetch('/api/practitioner/directory-profile');
    applyDirectoryProfileData(data);
  } catch {
    summaryEl.innerHTML = `<span style="color:var(--text-dim)">Could not load directory profile.</span>`;
  }
}

function applyDirectoryProfileData(data) {
  const summaryEl = document.getElementById('dirProfileSummary');
  if (!summaryEl) return;
  if (data?.error) {
    summaryEl.innerHTML = `<span style="color:var(--text-dim)">Not yet set up — click Edit Profile to get started.</span>`;
    return;
  }

  const p = data?.profile || {};
  const publicLabel = p.is_public ? '<span style="color:var(--accent2)">✓ Public</span>' : '<span style="color:var(--text-dim)">Hidden</span>';
  const name = escapeHtml(p.display_name || 'Not set');
  summaryEl.innerHTML = `<strong>${name}</strong> · ${publicLabel}${p.bio ? ' · ' + escapeHtml(p.bio.substring(0, 60)) + (p.bio.length > 60 ? '…' : '') : ''}`;

  const el = id => document.getElementById(id);
  if (el('dir-display-name')) el('dir-display-name').value = p.display_name || '';
  if (el('dir-bio')) el('dir-bio').value = p.bio || '';
  if (el('dir-certification')) el('dir-certification').value = p.certification || '';
  if (el('dir-session-format')) el('dir-session-format').value = p.session_format || 'Remote';
  if (el('dir-session-info')) el('dir-session-info').value = p.session_info || '';
  if (el('dir-booking-url')) el('dir-booking-url').value = p.booking_url || '';
  if (el('dir-scheduling-embed')) el('dir-scheduling-embed').value = p.scheduling_embed_url || '';
  if (el('dir-is-public')) el('dir-is-public').checked = !!p.is_public;

  const notifPrefs = p.notification_preferences || {};
  if (el('notif-client-chart-ready')) el('notif-client-chart-ready').checked = notifPrefs.clientChartReady !== false;
  if (el('notif-client-session-ready')) el('notif-client-session-ready').checked = notifPrefs.clientSessionReady !== false;

  const specs = Array.isArray(p.specializations) ? p.specializations : [];
  document.querySelectorAll('#dir-specializations input[type="checkbox"]').forEach(cb => {
    cb.checked = specs.includes(cb.value);
  });
}

async function saveDirectoryProfile() {
  const el = id => document.getElementById(id);

  const specializations = [];
  document.querySelectorAll('#dir-specializations input[type="checkbox"]:checked').forEach(cb => {
    specializations.push(cb.value);
  });

  const body = {
    display_name: el('dir-display-name')?.value?.trim() || '',
    bio: el('dir-bio')?.value?.trim() || '',
    certification: el('dir-certification')?.value || '',
    session_format: el('dir-session-format')?.value || 'Remote',
    session_info: el('dir-session-info')?.value?.trim() || '',
    booking_url: el('dir-booking-url')?.value?.trim() || '',
    scheduling_embed_url: el('dir-scheduling-embed')?.value?.trim() || '',
    is_public: el('dir-is-public')?.checked || false,
    specializations,
    notification_preferences: {
      clientChartReady: el('notif-client-chart-ready')?.checked !== false,
      clientSessionReady: el('notif-client-session-ready')?.checked !== false,
    },
  };

  try {
    const result = await apiFetch('/api/practitioner/directory-profile', {
      method: 'PUT',
      body: JSON.stringify(body)
    });

    if (result.error) {
      showNotification('Error saving profile: ' + safeErrorMsg(result.error, 'Unable to save profile'), 'error');
      return;
    }

    const profileUrl = result?.profile?.slug && body.is_public
      ? `${window.location.origin}/practitioners/${encodeURIComponent(result.profile.slug)}`
      : null;
    showNotification(
      profileUrl
        ? 'Directory profile saved! <a href="' + escapeHtml(profileUrl) + '" target="_blank" style="color:var(--gold);text-decoration:underline">View my profile →</a>'
        : 'Directory profile saved',
      'success'
    );
    toggleDirectoryForm();
    await loadDirectoryProfile();
  } catch (e) {
    showNotification('Error saving profile: ' + e.message, 'error');
  }
}

// ── Practitioner Review Moderation ──
async function loadPractitionerReviews() {
  const listEl = document.getElementById('practitionerReviewsList');
  if (!listEl) return;
  try {
    const data = await apiFetch('/api/practitioner/reviews');
    const reviews = data?.reviews || [];
    if (!reviews.length) {
      listEl.innerHTML = '<div style="color:var(--text-dim);font-size:var(--font-size-sm)">No reviews yet.</div>';
      return;
    }
    listEl.innerHTML = reviews.map(r => {
      const rid = escapeAttr(r.id);
      const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      const statusPill = r.status === 'approved'
        ? '<span class="pill green">Approved</span>'
        : r.status === 'hidden'
        ? '<span class="pill" style="background:var(--text-dim)">Hidden</span>'
        : '<span class="pill" style="background:var(--gold);color:#000">Pending</span>';
      return `<div style="padding:var(--space-3) 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><span style="color:var(--gold)">${stars}</span> · ${escapeHtml(r.client_name || r.client_email || 'Client')} ${statusPill}</div>
          <div style="display:flex;gap:var(--space-2)">
            ${r.status !== 'approved' ? `<button class="btn-primary btn-sm" style="font-size:var(--font-size-xs);padding:2px 8px" data-action="approveReview" data-arg0="${rid}">Approve</button>` : ''}
            ${r.status !== 'hidden' ? `<button class="btn-secondary btn-sm" style="font-size:var(--font-size-xs);padding:2px 8px" data-action="hideReview" data-arg0="${rid}">Hide</button>` : ''}
          </div>
        </div>
        <div style="font-size:var(--font-size-sm);color:var(--text);margin-top:var(--space-1);white-space:pre-wrap">${escapeHtml(r.content)}</div>
        <div style="font-size:var(--font-size-xs);color:var(--text-dim);margin-top:4px">${new Date(r.created_at).toLocaleDateString()}</div>
      </div>`;
    }).join('');
  } catch (e) {
    listEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  }
}

async function approveReview(reviewId) {
  try {
    await apiFetch(`/api/practitioner/reviews/${reviewId}/approve`, { method: 'PUT' });
    showNotification('Review approved — now visible on your directory profile.', 'success');
    trackEvent?.('practitioner', 'review_approved', reviewId);
    await loadPractitionerReviews();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

async function hideReview(reviewId) {
  try {
    await apiFetch(`/api/practitioner/reviews/${reviewId}/hide`, { method: 'PUT' });
    showNotification('Review hidden.', 'success');
    trackEvent?.('practitioner', 'review_hidden', reviewId);
    await loadPractitionerReviews();
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

// ── CSV Export ──
async function downloadCSV(type) {
  const validTypes = ['roster', 'notes', 'readings'];
  if (!validTypes.includes(type)) return;
  try {
    const resp = await fetch(`/api/practitioner/export/${type}`, { credentials: 'include' });
    if (!resp.ok) throw new Error('Export failed');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resp.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `${type}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    trackEvent?.('practitioner', 'csv_exported', type);
    showNotification(`${type} CSV downloaded.`, 'success');
  } catch (e) {
    showNotification('Export error: ' + e.message, 'error');
  }
}

// ── Notion Sync ──
async function checkNotionStatus() {
  const statusEl = document.getElementById('notionStatus');
  const actionsEl = document.getElementById('notionActions');
  const connectEl = document.getElementById('notionConnectWrap');
  if (!statusEl) return;
  statusEl.textContent = 'Checking…';
  try {
    const res = await apiFetch('/api/notion/status');
    if (res.connected) {
      statusEl.innerHTML = `<span class="pill green">Connected</span> to <strong>${escapeHtml(res.workspaceName || 'Notion')}</strong>`;
      if (actionsEl) actionsEl.style.display = '';
      if (connectEl) connectEl.style.display = 'none';
    } else {
      statusEl.textContent = 'Not connected';
      if (actionsEl) actionsEl.style.display = 'none';
      if (connectEl) connectEl.style.display = '';
    }
  } catch (e) {
    statusEl.textContent = 'Not connected';
    if (actionsEl) actionsEl.style.display = 'none';
    if (connectEl) connectEl.style.display = '';
  }
}

async function connectNotion() {
  try {
    const res = await apiFetch('/api/notion/auth');
    if (res.url) window.location.href = res.url;
  } catch (e) {
    showNotification('Could not start Notion connection: ' + e.message, 'error');
  }
}

async function syncNotionClients() {
  const btn = document.getElementById('notionSyncBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Syncing…'; }
  try {
    const res = await apiFetch('/api/notion/sync/clients', { method: 'POST' });
    showNotification(`Synced ${res.synced ?? 0} clients to Notion`, 'success');
  } catch (e) {
    showNotification('Sync failed: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Sync Clients to Notion'; }
  }
}

async function disconnectNotion() {
  if (!confirm('Disconnect Notion? Your synced data in Notion will remain but no new syncs will occur.')) return;
  try {
    await apiFetch('/api/notion/disconnect', { method: 'DELETE' });
    showNotification('Notion disconnected', 'success');
    checkNotionStatus();
  } catch (e) {
    showNotification('Error disconnecting: ' + e.message, 'error');
  }
}

async function removeClient(clientId, emailLabel) {
  if (!confirm(`Remove ${emailLabel} from your roster? This does not delete their account.`)) return;

  try {
    await apiFetch(`/api/practitioner/clients/${clientId}`, { method: 'DELETE' });
    showNotification(`${emailLabel} removed from roster`, 'success');
    // Hide detail panel if it's showing this client
    const panel = document.getElementById('pracDetailPanel');
    if (panel) panel.style.display = 'none';
    loadRoster();
  } catch (e) {
    showNotification('Error removing client: ' + e.message, 'error');
  }
}

