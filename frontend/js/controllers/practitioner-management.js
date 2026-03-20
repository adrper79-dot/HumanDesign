/**
 * practitioner-management.js
 * Auto-extracted from frontend/js/app.js by scripts/split-app-js.mjs (GAP-001).
 *
 * Activation plan, lifecycle badge, roster rendering, client detail view, reminder, checklist
 *
 * Depends on globals defined in app.js (always loaded first):
 *   apiFetch, token, currentUser, escapeHtml, showNotification,
 *   openAuthOverlay, switchTab, showUpgradePrompt, writeJourneyFlag, readJourneyFlag
 *
 * This file is loaded lazily via _loadController() in app.js when the
 * relevant tab is first activated.  Do not add <script> tags for this
 * file to index.html — the loader handles it.
 */
// ── PRAC-014: Send client reminder ────────────────────────────
async function sendClientReminder(clientId, emailLabel) {
  const btn = document.getElementById(`remind-btn-${clientId}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    const result = await apiFetch(`/api/practitioner/clients/${clientId}/remind`, { method: 'POST' });
    if (result.error) {
      showNotification(safeErrorMsg(result.error, 'Unable to send reminder'), 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Send Reminder'; }
    } else {
      showNotification('Reminder sent to ' + escapeHtml(emailLabel), 'success');
      if (btn) { btn.textContent = 'Reminder Sent'; }
    }
  } catch (e) {
    const msg = e.message?.includes('429') ? 'Reminder already sent in the last 24 hours' : 'Error sending reminder: ' + e.message;
    showNotification(msg, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Send Reminder'; }
  }
}
window.sendClientReminder = sendClientReminder;

function renderPractitionerChecklist(items) {
  return items.map(item => `
    <div style="display:flex;align-items:flex-start;gap:var(--space-2);padding:var(--space-2) 0;border-bottom:var(--border-width-thin) solid rgba(255,255,255,0.06)">
      <div style="font-size:var(--font-size-base);line-height:1.2;color:${item.done ? 'var(--accent2)' : 'var(--gold)'}">${item.done ? '✓' : '•'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--font-size-sm);font-weight:600;color:var(--text)">${escapeHtml(item.title)}</div>
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);line-height:1.5">${escapeHtml(item.description)}</div>
      </div>
    </div>`).join('');
}

function buildPractitionerFollowUpBrief({ emailLabel, chart, profile, notes, aiContext }) {
  const latestNote = Array.isArray(notes) && notes.length ? notes[0] : null;
  const aiSharedNotes = Array.isArray(notes) ? notes.filter(note => note.share_with_ai) : [];
  const hd = chart?.hdData || {};
  const profileData = profile?.profileData || {};
  const synthesisSummary = (profileData.quickStart || profileData.overview || profileData.summary || '').trim();
  const notePreview = latestNote?.content ? latestNote.content.trim().replace(/\s+/g, ' ').slice(0, 280) : '';
  const aiContextPreview = (aiContext || '').trim().replace(/\s+/g, ' ').slice(0, 280);

  const lines = [
    `Client: ${emailLabel || 'Client'}`,
    `Session Follow-Up Brief`,
    '',
    `Current blueprint: ${hd.type || 'Unknown'} · ${hd.authority || 'Unknown authority'} · ${hd.profile || 'Unknown profile'}`,
    `Profile synthesis ready: ${profile ? 'Yes' : 'No'}`,
    `Notes shared with AI: ${aiSharedNotes.length}`,
    '',
  ];

  if (synthesisSummary) {
    lines.push('Profile synthesis highlight:');
    lines.push(synthesisSummary);
    lines.push('');
  }

  if (notePreview) {
    lines.push('Latest session note:');
    lines.push(notePreview);
    lines.push('');
  }

  if (aiContextPreview) {
    lines.push('Practitioner AI context:');
    lines.push(aiContextPreview);
    lines.push('');
  }

  lines.push('Recommended next actions:');
  if (!profile) lines.push('- Have the client generate or refresh their profile synthesis before the next session.');
  if (!aiSharedNotes.length) lines.push('- Mark at least one relevant session note to share with AI so future synthesis carries session continuity.');
  if (!aiContextPreview) lines.push('- Save practitioner context describing tone, goals, and guardrails for the next follow-up.');
  if (profile && aiSharedNotes.length && aiContextPreview) lines.push('- Use this context to prepare the next check-in or send a practitioner-led follow-up summary.');

  lines.push('');
  lines.push('Prime Self practitioner workspace');
  return lines.join('\n');
}

function renderClientDetail(data, emailLabel, clientId, notesData, aiContextData, diaryData, practitionerBookingUrl = '') {
  if (!data || data.error) {
    return `<div class="alert alert-error">${escapeHtml(data?.error || 'Failed to load client detail')}</div>`;
  }

  const { client, chart, profile } = data;
  const email = escapeHtml(emailLabel || client?.email || '');
  const safeClientId = escapeAttr(clientId || client?.id || '');
  const notes = notesData?.notes || [];
  const notesTotal = notesData?.total ?? notes.length;
  const notesHasMore = notesData?.hasMore ?? false;
  const aiContext = typeof aiContextData?.ai_context === 'string' ? aiContextData.ai_context : '';
  const aiContextStatus = aiContextData?.error
    ? `<div class="alert alert-warn" style="margin-bottom:var(--space-3)">${escapeHtml(aiContextData.error)}</div>`
    : '';
  const followUpBrief = buildPractitionerFollowUpBrief({
    emailLabel: emailLabel || client?.email || '',
    chart,
    profile,
    notes,
    aiContext,
  });
  const latestSessionDate = notes[0]?.session_date ? new Date(notes[0].session_date).toLocaleDateString() : null;
  const aiSharedCount = notes.filter(note => note.share_with_ai).length;
  const workflowChecklist = [
    {
      done: !!chart,
      title: 'Client has generated their chart',
      description: chart
        ? 'The client blueprint is available for review in this workspace.'
        : 'Ask the client to sign in and complete their birth details so their blueprint is available here.'
    },
    {
      done: !!profile,
      title: 'Profile synthesis is available',
      description: profile
        ? 'You can reference the latest synthesis and export it as part of the session workflow.'
        : 'Have the client generate their Prime Self profile before you prepare a branded deliverable.'
    },
    {
      done: notes.length > 0,
      title: 'Session record has started',
      description: notes.length > 0
        ? 'Session notes are in place and can keep compounding over time.'
        : 'Capture the first session note after intake so future sessions have continuity.'
    },
    {
      done: aiContext.trim().length > 0,
      title: 'AI context is tailored',
      description: aiContext.trim().length > 0
        ? 'The synthesis engine has custom context about this client and your working style.'
        : 'Save session guardrails, goals, and recurring themes so future AI outputs stay practitioner-specific.'
    }
  ];
  const incompleteChecklistCount = workflowChecklist.filter(item => !item.done).length;

  let html = `<div class="card" style="border-top:3px solid var(--gold)">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card-title" style="margin:0"><span class="icon-star"></span> ${email}</div>
      <button class="btn-secondary btn-sm" data-action="hidePracDetail">✕ Close</button>
    </div>`;

  html += `
    <div class="card" style="margin-bottom:var(--space-4);background:linear-gradient(135deg, rgba(212,175,55,0.12), rgba(0,0,0,0));border:1px solid rgba(212,175,55,0.18)">
      <div class="card-title" style="margin-bottom:var(--space-2)"><span class="icon-check"></span> Client Session Readiness</div>
      <p style="margin:0 0 var(--space-3);color:var(--text-dim);font-size:var(--font-size-sm);line-height:1.6">
        ${incompleteChecklistCount === 0
          ? 'This client workspace is fully prepared for a practitioner-led session and follow-up synthesis.'
          : `There ${incompleteChecklistCount === 1 ? 'is' : 'are'} ${incompleteChecklistCount} step${incompleteChecklistCount === 1 ? '' : 's'} left before this workspace is fully session-ready.`}
      </p>
      <div>${renderPractitionerChecklist(workflowChecklist)}</div>
      ${practitionerBookingUrl && /^https?:\/\//i.test(practitionerBookingUrl) && incompleteChecklistCount === 0
        ? `<div style="margin-top:var(--space-4)"><a href="${escapeAttr(practitionerBookingUrl)}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="display:inline-block;text-decoration:none">📅 Book Next Session ↗</a></div>` : ''}
    </div>`;

  if (!chart) {
    html += `<div class="alert alert-warn">This client has not generated a chart yet. Ask them to log in and run their blueprint calculation.</div>`;
  } else {
    const hd = chart.hdData || {};
    const type       = escapeHtml(hd.type || hd.hdType || '—');
    const authority  = escapeHtml(hd.authority || hd.decisionStyle || '—');
    const profile    = escapeHtml(hd.profile || hd.lifeRole || '—');
    const strategy   = escapeHtml(hd.strategy || '—');
    const definition = escapeHtml(hd.definition || '—');
    const chartDate  = chart.calculatedAt ? new Date(chart.calculatedAt).toLocaleDateString() : '—';

    html += `
    <h4 style="color:var(--gold);font-size:var(--font-size-base);margin:0 0 var(--space-3)">Energy Blueprint</h4>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--space-3);margin-bottom:var(--space-5)">
      <div style="background:var(--bg3);border-radius:var(--space-2);padding:var(--space-3)">
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:4px">Pattern</div>
        <div style="font-weight:600;color:var(--text)">${type}</div>
      </div>
      <div style="background:var(--bg3);border-radius:var(--space-2);padding:var(--space-3)">
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:4px">Authority</div>
        <div style="font-weight:600;color:var(--text)">${authority}</div>
      </div>
      <div style="background:var(--bg3);border-radius:var(--space-2);padding:var(--space-3)">
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:4px">Life Role</div>
        <div style="font-weight:600;color:var(--text)">${profile}</div>
      </div>
      <div style="background:var(--bg3);border-radius:var(--space-2);padding:var(--space-3)">
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:4px">Strategy</div>
        <div style="font-weight:600;color:var(--text)">${strategy}</div>
      </div>
      <div style="background:var(--bg3);border-radius:var(--space-2);padding:var(--space-3)">
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:4px">Definition</div>
        <div style="font-weight:600;color:var(--text)">${definition}</div>
      </div>
    </div>
    <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-4)">Chart calculated: ${chartDate}</div>`;
  }

  if (data.profile) {
    const pData   = data.profile.profileData || {};
    const summary = escapeHtml(pData.quickStart || pData.overview || pData.summary || '');
    const profileDate = data.profile.createdAt ? new Date(data.profile.createdAt).toLocaleDateString() : '—';
    const profileId   = escapeHtml(data.profile.id || '');
    const audit       = data.profile.groundingAudit || {};

    html += `
    <h4 style="color:var(--gold);font-size:var(--font-size-base);margin:0 0 var(--space-3)">Profile Synthesis</h4>`;

    if (summary) {
      html += `<p style="font-size:var(--font-size-base);color:var(--text);line-height:1.6;margin-bottom:var(--space-3)">${summary}</p>`;
    }

    html += `<div style="display:flex;gap:var(--space-3);flex-wrap:wrap;align-items:center;font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-4)">
      <span>Generated: ${profileDate}</span>`;

    if (audit.claimsTotal) {
      html += `<span>Grounding: ${audit.claimsGrounded}/${audit.claimsTotal} claims verified</span>`;
    }

    if (profileId) {
      html += `<button class="btn-secondary btn-sm" data-action="exportPDF" data-arg0="${profileId}">Download PDF</button>`;
      html += `<button class="btn-secondary btn-sm" data-action="exportBrandedPDF" data-arg0="${safeClientId}" title="PDF with your name and branding in the header">Download Branded PDF</button>`;
      html += `<button class="btn-secondary btn-sm" data-action="exportProfileToNotion" data-arg0="${profileId}">Export to Notion</button>`;
    }

    html += `</div>`;
  } else {
    html += `<div class="alert alert-warn" style="margin-top:var(--space-3)">This client has not generated a profile synthesis yet.</div>`;
  }

  html += `
  <div style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-3)">
      <h4 style="color:var(--gold);font-size:var(--font-size-base);margin:0">AI Context</h4>
      <div style="font-size:var(--font-size-sm);color:var(--text-dim)">Visible only inside your practitioner workspace</div>
    </div>
    ${aiContextStatus}
    <p style="font-size:var(--font-size-sm);color:var(--text-dim);line-height:1.6;margin:0 0 var(--space-3)">
      Capture the context you want future syntheses to honor: current goals, relationship dynamics, sensitivities, coaching boundaries, and how you want the AI to frame follow-up support.
    </p>
    <textarea id="aiContext-${safeClientId}" rows="5" class="form-input" maxlength="2000"
      style="width:100%;resize:vertical;margin-bottom:var(--space-1)" placeholder="Example: Client is working through burnout, responds best to direct but gentle language, and wants follow-up synthesis focused on decision clarity and pacing."
      oninput="onAIContextInput('${safeClientId}')">${escapeHtml(aiContext)}</textarea>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)">
      <span id="aiContextCharCount-${safeClientId}" style="font-size:var(--font-size-xs);color:var(--text-dim)">${aiContext.length} / 2000</span>
      <span style="font-size:var(--font-size-xs);color:var(--text-dim);font-style:italic">Autosaves after 2 seconds of inactivity</span>
    </div>
    <p class="form-hint" style="font-size:var(--font-size-xs);color:var(--text-dim);margin:0 0 var(--space-2)">Include your modalities, specialties, and how you work with clients. More specific = better AI synthesis for your clients.</p>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap">
      <div id="aiContextStatus-${safeClientId}" style="font-size:var(--font-size-sm);color:var(--text-dim)">${aiContext.trim().length ? 'Context saved for future synthesis.' : 'No custom AI context saved yet.'}</div>
      <button class="btn-primary btn-sm" data-action="saveAIContext" data-arg0="${safeClientId}">Save AI Context</button>
    </div>
  </div>`;

  // ── Session Notes Section ──
  html += `
  <div style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
      <h4 style="color:var(--gold);font-size:var(--font-size-base);margin:0">Session Notes</h4>
      <button class="btn-primary btn-sm" data-action="showNewNoteForm" data-arg0="${safeClientId}">+ New Note</button>
    </div>
    <div id="newNoteForm-${safeClientId}" style="display:none;margin-bottom:var(--space-4)">
      <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2);flex-wrap:wrap;align-items:flex-end">
        <div>
          <label style="display:block;font-size:var(--font-size-xs);color:var(--text-dim);margin-bottom:2px">Date</label>
          <input type="date" id="noteDate-${safeClientId}" style="width:auto" class="form-input">
        </div>
        <div style="flex:1;min-width:160px">
          <label style="display:block;font-size:var(--font-size-xs);color:var(--text-dim);margin-bottom:2px">Template</label>
          <select id="noteTemplate-${safeClientId}" class="form-input" style="width:100%">
            <option value="">Blank note</option>
          </select>
        </div>
      </div>
      <textarea id="noteContent-${safeClientId}" placeholder="Write your session notes here…" rows="4"
        style="width:100%;resize:vertical;margin-bottom:var(--space-2)" class="form-input" maxlength="5000"></textarea>
      <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:var(--space-1);font-size:var(--font-size-sm);color:var(--text-dim);cursor:pointer">
          <input type="checkbox" id="noteShareAi-${safeClientId}"> Share with AI synthesis
        </label>
        <div style="margin-left:auto;display:flex;gap:var(--space-2)">
          <button class="btn-secondary btn-sm" data-action="hideNewNoteForm" data-arg0="${safeClientId}">Cancel</button>
          <button class="btn-primary btn-sm" data-action="saveSessionNote" data-arg0="${safeClientId}">Save Note</button>
        </div>
      </div>
    </div>
    <div id="notesList-${safeClientId}">`;

  if (notes.length === 0) {
    html += `<div style="color:var(--text-dim);font-size:var(--font-size-sm);padding:var(--space-3) 0">No session notes yet. Add your first note to start building a record.</div>`;
  } else {
    if (notesTotal > notes.length) {
      html += `<div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-2)">Showing ${notes.length} of ${notesTotal} notes</div>`;
    }
    notes.forEach(note => {
      html += renderSessionNote(note, safeClientId);
    });
    if (notesHasMore) {
      html += `<button class="btn-secondary btn-sm" style="margin-top:var(--space-3)" data-action="loadMoreNotes" data-arg0="${safeClientId}" data-arg1="1" id="loadMoreNotesBtn-${safeClientId}">Load 10 more</button>`;
    }
  }

  html += `</div></div>`;

  // ── Client Diary Entries Section (read-only, opt-in) ──
  const diaryEntries = Array.isArray(diaryData?.data) ? diaryData.data : [];
  html += `
  <div style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--border)">
    <h4 style="color:var(--gold);font-size:var(--font-size-base);margin:0 0 var(--space-3) 0">📔 Client Diary</h4>`;
  if (diaryEntries.length === 0) {
    html += `<div class="alert alert-info" style="font-size:var(--font-size-sm)">No diary entries shared. The client must opt in to diary sharing from their account.</div>`;
  } else {
    const typeIcon = { career: '💼', relationship: '❤️', health: '🏥', spiritual: '✨', financial: '💰', family: '👨‍👩‍👧', other: '📌' };
    diaryEntries.forEach(entry => {
      const d = new Date(entry.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      html += `
      <div class="card" style="padding:var(--space-3);margin:0 0 var(--space-2) 0">
        <div style="font-size:var(--font-size-md);font-weight:600;color:var(--gold)">${typeIcon[entry.event_type] || '📌'} ${escapeHtml(entry.event_title)}</div>
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-1)">${d} · ${entry.event_type} · ${entry.significance}</div>
        ${entry.event_description ? `<div style="font-size:var(--font-size-base);color:var(--text);margin-top:var(--space-2);line-height:1.5">${escapeHtml(entry.event_description)}</div>` : ''}
      </div>`;
    });
  }
  html += `</div>`;

  // ── Divination Readings Section ──
  html += `
  <div style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
      <h4 style="color:var(--gold);font-size:var(--font-size-base);margin:0">🔮 Divination Readings</h4>
      <button class="btn-primary btn-sm" data-action="showNewReadingForm" data-arg0="${safeClientId}">+ New Reading</button>
    </div>
    <div id="newReadingForm-${safeClientId}" style="display:none;margin-bottom:var(--space-4)">
      <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2);flex-wrap:wrap;align-items:flex-end">
        <div>
          <label style="display:block;font-size:var(--font-size-xs);color:var(--text-dim);margin-bottom:2px">Date</label>
          <input type="date" id="readingDate-${safeClientId}" style="width:auto" class="form-input">
        </div>
        <div>
          <label style="display:block;font-size:var(--font-size-xs);color:var(--text-dim);margin-bottom:2px">Type</label>
          <select id="readingType-${safeClientId}" class="form-input">
            <option value="tarot">Tarot</option>
            <option value="oracle">Oracle</option>
            <option value="runes">Runes</option>
            <option value="iching">I Ching</option>
            <option value="pendulum">Pendulum</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div style="flex:1;min-width:120px">
          <label style="display:block;font-size:var(--font-size-xs);color:var(--text-dim);margin-bottom:2px">Spread</label>
          <input type="text" id="readingSpread-${safeClientId}" class="form-input" placeholder="e.g., Celtic Cross, 3-card" style="width:100%">
        </div>
      </div>
      <textarea id="readingInterpretation-${safeClientId}" placeholder="Cards drawn and your interpretation…" rows="4"
        style="width:100%;resize:vertical;margin-bottom:var(--space-2)" class="form-input" maxlength="10000"></textarea>
      <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:var(--space-1);font-size:var(--font-size-sm);color:var(--text-dim);cursor:pointer">
          <input type="checkbox" id="readingShareAi-${safeClientId}"> Share with client
        </label>
        <div style="margin-left:auto;display:flex;gap:var(--space-2)">
          <button class="btn-secondary btn-sm" data-action="hideNewReadingForm" data-arg0="${safeClientId}">Cancel</button>
          <button class="btn-primary btn-sm" data-action="saveDivinationReading" data-arg0="${safeClientId}">Save Reading</button>
        </div>
      </div>
    </div>
    <div id="readingsList-${safeClientId}">
      <div style="color:var(--text-dim);font-size:var(--font-size-sm);padding:var(--space-3) 0">Loading readings…</div>
    </div>
  </div>`;

  // ── Session Actions ──
  html += `
  <div style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-3)">
      <h4 style="color:var(--gold);font-size:var(--font-size-base);margin:0">Assigned Actions</h4>
      <button class="btn-primary btn-sm" data-action="showNewActionForm" data-arg0="${safeClientId}">+ New Action</button>
    </div>
    <div id="newActionForm-${safeClientId}" style="display:none;padding:var(--space-3);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:var(--space-3);background:var(--card-bg)">
      <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-3)">
        <input type="text" id="actionTitle-${safeClientId}" placeholder="Action title (required)" maxlength="200" style="flex:1;min-width:200px;padding:var(--space-2);background:var(--card-bg-alt,var(--bg));color:var(--text);border:1px solid var(--border);border-radius:var(--radius)">
        <input type="date" id="actionDue-${safeClientId}" style="padding:var(--space-2);background:var(--card-bg-alt,var(--bg));color:var(--text);border:1px solid var(--border);border-radius:var(--radius)">
      </div>
      <textarea id="actionDescription-${safeClientId}" placeholder="Description (optional)" rows="2" maxlength="5000" style="width:100%;padding:var(--space-2);background:var(--card-bg-alt,var(--bg));color:var(--text);border:1px solid var(--border);border-radius:var(--radius);resize:vertical;margin-bottom:var(--space-3)"></textarea>
      <div style="display:flex;gap:var(--space-2);justify-content:flex-end">
        <button class="btn-secondary btn-sm" data-action="hideNewActionForm" data-arg0="${safeClientId}">Cancel</button>
        <button class="btn-primary btn-sm" data-action="saveSessionAction" data-arg0="${safeClientId}">Save Action</button>
      </div>
    </div>
    <div id="actionsList-${safeClientId}">
      <div style="color:var(--text-dim);font-size:var(--font-size-sm);padding:var(--space-3) 0">Loading actions…</div>
    </div>
  </div>`;

  // ── AI Session Brief (BL-EXC-P1-1) ──
  html += `
  <div style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-3)">
      <h4 style="color:var(--gold);font-size:var(--font-size-base);margin:0">AI Session Brief</h4>
      <button class="btn-primary btn-sm" data-action="generateSessionBrief" data-arg0="${safeClientId}" id="sessionBriefBtn-${safeClientId}">
        <span class="spinner" id="sessionBriefSpinner-${safeClientId}" style="display:none"></span>
        Generate Brief
      </button>
    </div>
    <p style="font-size:var(--font-size-sm);color:var(--text-dim);line-height:1.6;margin:0 0 var(--space-3)">
      A focused AI prep brief for your upcoming session — key themes, resistance areas, a suggested opening question, and current transit context. Powered by AI-shared notes and this client's chart.
    </p>
    <div id="sessionBriefOutput-${safeClientId}"></div>
  </div>`;

  html += `
  <div style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--border)">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-3)">
      <h4 style="color:var(--gold);font-size:var(--font-size-base);margin:0">Post-Session Follow-Up</h4>
      <div style="font-size:var(--font-size-sm);color:var(--text-dim)">${latestSessionDate ? `Latest note: ${latestSessionDate}` : 'No session note captured yet'}</div>
    </div>
    <p style="font-size:var(--font-size-sm);color:var(--text-dim);line-height:1.6;margin:0 0 var(--space-3)">
      Use this brief to keep session continuity tight. It composes the latest note, AI context, and synthesis state into a practitioner-ready follow-up draft.
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-3);margin-bottom:var(--space-3)">
      <div style="background:var(--bg3);border-radius:var(--space-2);padding:var(--space-3)">
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:4px">AI-shared notes</div>
        <div style="font-weight:600;color:var(--text)">${aiSharedCount}</div>
      </div>
      <div style="background:var(--bg3);border-radius:var(--space-2);padding:var(--space-3)">
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:4px">Context tailored</div>
        <div style="font-weight:600;color:var(--text)">${aiContext.trim().length ? 'Yes' : 'Not yet'}</div>
      </div>
      <div style="background:var(--bg3);border-radius:var(--space-2);padding:var(--space-3)">
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:4px">Deliverable status</div>
        <div style="font-weight:600;color:var(--text)">${profile ? 'Ready to send' : 'Needs synthesis'}</div>
      </div>
    </div>
    <textarea id="followUpBrief-${safeClientId}" rows="10" class="form-input" readonly
      style="width:100%;resize:vertical;margin-bottom:var(--space-2)">${escapeHtml(followUpBrief)}</textarea>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap">
      <div id="followUpStatus-${safeClientId}" style="font-size:var(--font-size-sm);color:var(--text-dim)">${aiSharedCount ? 'Includes AI-shared note context.' : 'Mark a note as shared with AI to strengthen future syntheses.'}</div>
      <button class="btn-primary btn-sm" data-action="copyPractitionerFollowUpBrief" data-arg0="${safeClientId}">Copy Follow-Up Brief</button>
    </div>
  </div>`;

  // ── Cross-Chart Compatibility (PRAC-005) ──
  // Provide a direct path to generate a composite chart between practitioner and this client.
  if (chart) {
    html += `
    <div class="card" style="margin-top:var(--space-4);border-top:3px solid var(--primary)">
      <div class="card-title" style="margin-bottom:var(--space-3)"><span class="icon-chart"></span> Compatibility Chart</div>
      <p style="font-size:var(--font-size-base);color:var(--text-dim);margin-bottom:var(--space-4)">
        Generate a composite relationship chart between you and ${email}. This reveals compatibility dynamics, communication patterns, and energy synergies.
      </p>
      <button class="btn-primary" data-action="openCompatibilityWithClient" data-arg0="${safeClientId}" data-arg1="${escapeAttr(emailLabel || '')}">
        <span class="icon-chart"></span> Generate Compatibility Chart
      </button>
    </div>`;
  }

  html += `</div>`;

  // ── PRAC-015: Scheduling embed (Cal.com / Calendly) ─────────
  // Messaging (5.1)
  html += `
  <div class="card" style="margin-top:var(--space-5)">
    <div class="card-header-row">
      <div class="card-title mb-0">&#x1F4AC; Messages</div>
      <button class="btn-secondary btn-sm" data-action="loadPractitionerMessages" data-arg0="${safeClientId}">Refresh</button>
    </div>
    <div id="msgThread-${safeClientId}" style="max-height:360px;overflow-y:auto;margin-bottom:var(--space-3)">
      <div class="loading-card"><div class="spinner"></div></div>
    </div>
    <div style="display:flex;gap:var(--space-2);align-items:flex-end">
      <textarea id="msgInput-${safeClientId}" rows="2" class="form-input" placeholder="Write a message..." maxlength="2000" style="flex:1;resize:none"></textarea>
      <button class="btn-primary btn-sm" data-action="sendPractitionerMessage" data-arg0="${safeClientId}">Send</button>
    </div>
    <div id="msgStatus-${safeClientId}" style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-1)"></div>
  </div>`;

  if (_pracSchedulingEmbedUrl) {
    html += `
  <div style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--border)">
    <h4 style="color:var(--gold);font-size:var(--font-size-base);margin:0 0 var(--space-3)">Schedule Next Session</h4>
    <iframe
      src="${escapeAttr(_pracSchedulingEmbedUrl)}"
      style="width:100%;height:500px;border:none;border-radius:var(--space-2)"
      loading="lazy"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      title="Schedule a session"
    ></iframe>
  </div>`;
  }

  return html;
}

function renderSessionNote(note, clientId) {
  const noteId = escapeAttr(note.id);
  const dateStr = note.session_date ? new Date(note.session_date).toLocaleDateString() : 'No date';
  const createdStr = note.created_at ? new Date(note.created_at).toLocaleDateString() : '';
  const content = escapeHtml(note.content || '');
  const shared = note.share_with_ai ? '<span style="color:var(--gold);font-size:var(--font-size-sm)" title="Shared with AI synthesis">✦ AI</span>' : '';

  return `
  <div class="session-note-item" id="note-${noteId}" style="background:var(--bg3);border-radius:var(--space-2);padding:var(--space-3);margin-bottom:var(--space-2)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-1)">
      <div style="display:flex;align-items:center;gap:var(--space-2)">
        <span style="font-weight:600;font-size:var(--font-size-sm);color:var(--text)">${dateStr}</span>
        ${shared}
      </div>
      <div style="display:flex;gap:var(--space-1)">
        <button class="btn-secondary btn-sm" data-action="editSessionNote" data-arg0="${noteId}" data-arg1="${escapeAttr(clientId)}" style="padding:2px 8px;font-size:var(--font-size-sm)">Edit</button>
        <button class="btn-danger btn-sm" data-action="deleteSessionNote" data-arg0="${noteId}" data-arg1="${escapeAttr(clientId)}" style="padding:2px 8px;font-size:var(--font-size-sm)">Delete</button>
      </div>
    </div>
    <div style="font-size:var(--font-size-base);color:var(--text);white-space:pre-wrap;line-height:1.5">${content}</div>
    ${createdStr ? `<div style="font-size:var(--font-size-xs);color:var(--text-dim);margin-top:var(--space-1)">Added ${createdStr}</div>` : ''}
  </div>`;
}

function showNewNoteForm(clientId) {
  const form = document.getElementById('newNoteForm-' + clientId);
  if (form) {
    form.style.display = 'block';
    // Default date to today
    const dateInput = document.getElementById('noteDate-' + clientId);
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
    // Load templates into dropdown on first open
    loadNoteTemplates(clientId);
    document.getElementById('noteContent-' + clientId)?.focus();
  }
}

