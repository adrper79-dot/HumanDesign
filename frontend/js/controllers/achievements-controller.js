/**
 * achievements-controller.js
 * Auto-extracted from frontend/js/app.js by scripts/split-app-js.mjs (GAP-001).
 *
 * Celebrity matches, achievement badges, leaderboard
 *
 * Depends on globals defined in app.js (always loaded first):
 *   apiFetch, token, currentUser, escapeHtml, showNotification,
 *   openAuthOverlay, switchTab, showUpgradePrompt, writeJourneyFlag, readJourneyFlag
 *
 * This file is loaded lazily via _loadController() in app.js when the
 * relevant tab is first activated.  Do not add <script> tags for this
 * file to index.html — the loader handles it.
 */
let _allCelebrityMatches = [];

async function loadCelebrityMatches() {
  const btn = document.getElementById('celebLoadBtn');
  const spinner = document.getElementById('celebSpinner');
  const status = document.getElementById('celebrityStatus');
  const grid = document.getElementById('celebrityGrid');

  if (!token) { openAuthOverlay(); return; }
  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = '';
  if (status) status.textContent = 'Finding your famous matches...';

  try {
    const data = await apiFetch('/api/compare/celebrities');
    if (data.error && !data.matches) {
      if (status) status.textContent = data.error;
      return;
    }
    _allCelebrityMatches = data.matches || [];
    if (status) status.textContent = '';
    renderCelebrityGrid(_allCelebrityMatches);
    trackEvent?.('celebrity', 'celebrity_match_viewed', _allCelebrityMatches.length);
  } catch (e) {
    if (status) status.textContent = 'Error: ' + e.message;
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

function renderCelebrityGrid(matches) {
  const grid = document.getElementById('celebrityGrid');
  if (!grid) return;
  if (!matches.length) {
    grid.innerHTML = '<p style="color:var(--text-dim)">No matches found. Calculate your chart first.</p>';
    return;
  }
  grid.innerHTML = matches.map(m => {
    const pct = m.similarity?.percentage ?? 0;
    const celeb = m.celebrity || {};
    // P2-SEC-001: Escape all API-sourced data to prevent stored XSS
    const name = escapeHtml(String(celeb.name || 'Unknown'));
    const field = escapeHtml(String(celeb.field || ''));
    const type = escapeHtml(String(celeb.type || ''));
    const authority = celeb.authority ? escapeHtml(String(celeb.authority)) : '';
    const desc = celeb.description ? escapeHtml(String(celeb.description)) : '';
    const category = escapeAttr(celeb.category || 'other');
    // P2-SEC-002: Use data-action + data attribute instead of inline onclick
    const celebId = escapeAttr(celeb.id || '');
    return `
      <div class="card" style="margin-bottom:var(--space-4);display:flex;gap:var(--space-4);align-items:flex-start;flex-wrap:wrap" data-category="${category}">
        <div style="min-width:60px;text-align:center">
          <div style="font-size:2rem;font-weight:700;color:var(--gold)">${pct}%</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-dim)">match</div>
        </div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:var(--font-size-lg);color:var(--text)">${name}</div>
          <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-2)">${field} &middot; ${type} ${authority ? '&middot; ' + authority + ' Authority' : ''}</div>
          ${desc ? `<p style="font-size:var(--font-size-sm);color:var(--text-dim);margin:0 0 var(--space-3)">${desc}</p>` : ''}
          <button class="btn-secondary" style="font-size:var(--font-size-sm)" data-action="shareCelebrityMatch" data-arg0="${celebId}">Share Match</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterCelebrities(category) {
  document.querySelectorAll('.celebrity-filter').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.arg0 === category);
  });
  const filtered = category === 'all' ? _allCelebrityMatches
    : _allCelebrityMatches.filter(m => (m.celebrity?.category || '') === category);
  renderCelebrityGrid(filtered);
}

async function shareCelebrityMatch(celebrityId) {
  if (!token) { openAuthOverlay(); return; }
  try {
    const data = await apiFetch('/api/share/celebrity', {
      method: 'POST',
      body: JSON.stringify({ celebrityId, platform: 'twitter' })
    });
    if (data.shareUrls?.twitter) {
      try {
        const shareUrl = new URL(data.shareUrls.twitter);
        if (shareUrl.protocol === 'https:' || shareUrl.protocol === 'http:') {
          window.open(shareUrl.href, '_blank', 'noopener');
        }
      } catch { /* invalid URL — ignore */ }
    }
    trackEvent?.('celebrity', 'celebrity_shared', celebrityId);
  } catch (e) {
    alert('Could not generate share: ' + e.message);
  }
}

// ─── Achievements & Leaderboard ──────────────────────────────

async function loadAchievements() {
  const btn = document.getElementById('achieveLoadBtn');
  const spinner = document.getElementById('achieveSpinner');
  const status = document.getElementById('achievementsStatus');
  const badges = document.getElementById('achievementsBadges');
  const statsCard = document.getElementById('achievementsStatsCard');
  const statsEl = document.getElementById('achievementsStats');

  if (!token) { openAuthOverlay(); return; }
  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = '';
  if (status) status.textContent = 'Loading achievements...';

  try {
    const [achData, progData] = await Promise.all([
      apiFetch('/api/achievements'),
      apiFetch('/api/achievements/progress')
    ]);

    // Stats bar
    if (progData && statsCard && statsEl) {
      statsCard.style.display = '';
      statsEl.innerHTML = [
        { label: 'Points', value: progData.totalPoints ?? 0 },
        { label: 'Badges', value: (progData.totalAchievements ?? 0) + ' / ' + (progData.possibleAchievements ?? '?') },
        { label: 'Rank', value: progData.rank ? '#' + progData.rank : '—' }
      ].map(s => `<div style="text-align:center"><div style="font-size:1.8rem;font-weight:700;color:var(--gold)">${s.value}</div><div style="font-size:var(--font-size-xs);color:var(--text-dim)">${s.label}</div></div>`).join('');
    }

    // Badge grid
    const achievements = achData.achievements || [];
    const newlyUnlocked = achievements.filter(a => a.unlocked && a.unlockedAt &&
      (Date.now() - new Date(a.unlockedAt).getTime()) < 86400000);
    if (newlyUnlocked.length > 0) {
      newlyUnlocked.forEach(a => {
        showNotification(`🎉 Achievement Unlocked: ${a.name} (+${a.points || 0} pts)`, 'success');
      });
    }
    if (status) status.textContent = '';
    if (badges) badges.innerHTML = achievements.length
      ? achievements.map(a => `
          <div style="display:flex;gap:var(--space-3);align-items:flex-start;padding:var(--space-3) 0;border-bottom:var(--border-width-thin) solid var(--border);opacity:${a.unlocked ? 1 : 0.45}">
            <div style="font-size:2rem;min-width:40px;text-align:center">${escapeHtml(a.icon || '🏅')}</div>
            <div style="flex:1">
              <div style="font-weight:600;color:var(--text)">${escapeHtml(a.name)}</div>
              <div style="font-size:var(--font-size-sm);color:var(--text-dim)">${escapeHtml(a.description || '')}</div>
              ${a.unlocked ? `<div style="font-size:var(--font-size-xs);color:var(--gold);margin-top:var(--space-1)">Earned ${a.unlockedAt ? new Date(a.unlockedAt).toLocaleDateString() : ''} &middot; +${a.points || 0} pts</div>` : '<div style="font-size:var(--font-size-xs);color:var(--text-dim);margin-top:var(--space-1)">Locked</div>'}
            </div>
          </div>`).join('')
      : '<p style="color:var(--text-dim)">Complete actions to earn your first badge.</p>';

  } catch (e) {
    if (status) status.textContent = 'Error: ' + e.message;
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

async function loadLeaderboard() {
  const btn = document.getElementById('leaderboardLoadBtn');
  const spinner = document.getElementById('leaderboardSpinner');
  const list = document.getElementById('leaderboardList');

  if (!token) { openAuthOverlay(); return; }
  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = '';

  try {
    const data = await apiFetch('/api/achievements/leaderboard');
    const entries = data.leaderboard || [];
    if (list) list.innerHTML = entries.length
      ? `<table style="width:100%;border-collapse:collapse;font-size:var(--font-size-sm)">
          <thead><tr style="color:var(--text-dim);text-align:left">
            <th style="padding:var(--space-2) var(--space-3)">#</th>
            <th style="padding:var(--space-2) var(--space-3)">User</th>
            <th style="padding:var(--space-2) var(--space-3)">Points</th>
            <th style="padding:var(--space-2) var(--space-3)">Badges</th>
          </tr></thead>
          <tbody>
            ${entries.map((e, i) => `
              <tr style="border-top:var(--border-width-thin) solid var(--border)">
                <td style="padding:var(--space-2) var(--space-3);color:var(--gold);font-weight:700">${i + 1}</td>
                <td style="padding:var(--space-2) var(--space-3);color:var(--text)">${escapeHtml(e.displayName || e.email?.split('@')[0] || 'Anonymous')}</td>
                <td style="padding:var(--space-2) var(--space-3);color:var(--gold);font-weight:600">${e.totalPoints ?? 0}</td>
                <td style="padding:var(--space-2) var(--space-3);color:var(--text-dim)">${e.totalAchievements ?? 0}</td>
              </tr>`).join('')}
          </tbody>
        </table>`
      : '<p style="color:var(--text-dim)">No leaderboard data yet.</p>';
  } catch (e) {
    if (list) list.textContent = 'Error: ' + e.message;
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

// ─── Optimal Timing / Electional Astrology ───────────────────

async function findBestDates() {
  const btn = document.getElementById('timingBtn');
  const spinner = document.getElementById('timingSpinner');
  const status = document.getElementById('timingStatus');
  const resultsCard = document.getElementById('timingResultsCard');
  const results = document.getElementById('timingResults');

  if (!token) { openAuthOverlay(); return; }

  const intention = document.getElementById('timing-intention')?.value;
  const startDate = document.getElementById('timing-start')?.value;
  const windowDays = parseInt(document.getElementById('timing-window')?.value || '30');

  if (!intention) { if (status) status.textContent = 'Please select what you are planning.'; return; }
  if (!startDate) { if (status) status.textContent = 'Please select a start date.'; return; }

  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = '';
  if (status) status.textContent = 'Calculating optimal dates...';
  if (resultsCard) resultsCard.style.display = 'none';

  try {
    const data = await apiFetch('/api/timing/find-dates', {
      method: 'POST',
      body: JSON.stringify({ intention, startDate, windowDays })
    });

    const dates = data.optimalDates || data.dates || [];
    if (status) status.textContent = '';
    if (resultsCard) resultsCard.style.display = '';
    trackEvent?.('timing', 'timing_search', intention);
    if (results) results.innerHTML = dates.length
      ? dates.map(d => `
          <div style="padding:var(--space-4) 0;border-bottom:var(--border-width-thin) solid var(--border)">
            <div style="font-weight:600;color:var(--gold);font-size:var(--font-size-lg)">${new Date(d.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-1)">${d.score !== undefined ? 'Score: ' + d.score + '/10 &middot; ' : ''}${escapeHtml(d.moonPhase || '')}</div>
            <p style="font-size:var(--font-size-sm);color:var(--text);margin:var(--space-2) 0 0">${escapeHtml(d.explanation || d.reason || '')}</p>
          </div>`).join('')
      : '<p style="color:var(--text-dim)">No strongly favorable dates found in this window. Try extending the search range.</p>';
  } catch (e) {
    if (status) status.textContent = 'Error: ' + e.message;
    if (resultsCard) resultsCard.style.display = 'none';
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

// Expose to global scope for HTML event handlers
window.findBestDates = findBestDates;
