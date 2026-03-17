// toggleMobileMore redirects to sidebar drawer now
function toggleMobileMore() {
  toggleSidebar();
}

// DEF-10: Back-to-top button
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

(function initBackToTop() {
  var btn = document.getElementById('backToTopBtn');
  if (!btn) return;
  window.addEventListener('scroll', function() {
    if (window.scrollY > 300) {
      btn.style.display = '';
      // Force reflow before adding class so CSS transition plays
      btn.offsetHeight; // eslint-disable-line no-unused-expressions
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
      // Hide after transition
      btn.addEventListener('transitionend', function hide() {
        if (!btn.classList.contains('visible')) btn.style.display = 'none';
        btn.removeEventListener('transitionend', hide);
      });
    }
  }, { passive: true });
})();
window.scrollToTop = scrollToTop;

// Update mobile nav active state
function updateMobileNav(clickedItem) {
  if (window.innerWidth > 768) return; // Only on mobile
  
  // Remove active class from all items
  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.classList.remove('active');
    item.setAttribute('aria-current', 'false');
  });
  
  // Add active class to clicked item
  if (clickedItem) {
    clickedItem.classList.add('active');
    clickedItem.setAttribute('aria-current', 'page');
  }
}

// Group-aware mobile nav: highlights the correct parent tab for sub-tabs.
// Groups must match data-group values on .mobile-nav-item elements in index.html:
//   home | blueprint | today | connect
// Tabs not listed here fall through to the data-tab direct-match (accessed via sidebar drawer).
const MOBILE_TAB_GROUPS = {
  // Home
  overview: 'home',
  // Blueprint (chart & identity)
  chart: 'blueprint', profile: 'blueprint',
  celebrity: 'blueprint', achievements: 'blueprint', directory: 'blueprint',
  // Today (transits & check-in)
  transits: 'today', checkin: 'today', timing: 'today',
  diary: 'today',
  // Connect
  composite: 'connect', clusters: 'connect',
  // Drawer-only tabs → highlight "More" button via sentinel value 'more'
  enhance: 'more', practitioner: 'more', sms: 'more',
  settings: 'more', admin: 'more', embed: 'more',
};

function updateMobileNavForTab(tabName) {
  const group = MOBILE_TAB_GROUPS[tabName];
  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.classList.remove('active');
    item.setAttribute('aria-current', 'false');
  });
  let navItem;
  if (group === 'more') {
    // Drawer-only tab: highlight the "More" button so user retains orientation
    navItem = document.getElementById('mobileMoreBtn');
  } else if (group) {
    navItem = document.querySelector(`.mobile-nav-item[data-group="${group}"]`);
  }
  if (!navItem) navItem = document.querySelector(`.mobile-nav-item[data-tab="${tabName}"]`);
  if (navItem) {
    navItem.classList.add('active');
    navItem.setAttribute('aria-current', 'page');
  }
}

// Sync is now handled by updateMobileNavForTab called from switchTab
// No need to wrap switchTab from mobile nav script

// Pull-to-refresh functionality for mobile
let pullStartY = 0;
let isPulling = false;

if ('ontouchstart' in window && window.innerWidth <= 768) {
  let refreshIndicator = null;
  
  document.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
      pullStartY = e.touches[0].clientY;
      isPulling = true;
      
      // Create refresh indicator if it doesn't exist
      if (!refreshIndicator) {
        refreshIndicator = document.createElement('div');
        refreshIndicator.className = 'pull-to-refresh';
        refreshIndicator.innerHTML = '↓';
        refreshIndicator.style.cssText = `
          position: fixed;
          top: -60px;
          left: 50%;
          transform: translateX(-50%);
          width: 40px;
          height: 40px;
          background: rgba(201,168,76,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          color: var(--gold);
          transition: all 0.3s;
          z-index: var(--z-notification, 400);
        `;
        document.body.appendChild(refreshIndicator);
      }
    }
  });
  
  document.addEventListener('touchmove', (e) => {
    if (!isPulling) return;
    
    const pullDistance = e.touches[0].clientY - pullStartY;
    if (pullDistance > 0 && pullDistance < 100 && refreshIndicator) {
      refreshIndicator.style.top = `${pullDistance - 60}px`;
    }
  });
  
  document.addEventListener('touchend', (e) => {
    if (!isPulling || !refreshIndicator) return;
    
    const pullDistance = pullStartY - (e.changedTouches?.[0]?.clientY || 0);
    
    if (pullDistance < -80) {
      // Trigger refresh
      refreshIndicator.style.top = '10px';
      refreshIndicator.innerHTML = '⟳';
      refreshIndicator.style.animation = 'spin 1s linear infinite';
      
      // Reload tab-specific data when available.
      const activeTab = document.querySelector('.tab-content.active')?.id;
      const refreshActions = {
        'tab-transits':     () => typeof loadTransits          === 'function' && loadTransits(),
        'tab-history':      () => typeof loadHistory           === 'function' && loadHistory(),
        'tab-checkin':      () => typeof loadCheckinStats      === 'function' && loadCheckinStats(),
        'tab-practitioner': () => typeof loadRoster            === 'function' && loadRoster(),
        'tab-clusters':     () => typeof loadClusters          === 'function' && loadClusters(),
        'tab-diary':        () => typeof loadDiaryEntries      === 'function' && loadDiaryEntries(),
        'tab-celebrity':    () => typeof loadCelebrityMatches  === 'function' && loadCelebrityMatches(),
        'tab-achievements': () => typeof loadAchievements      === 'function' && loadAchievements(),
        'tab-directory':    () => typeof searchDirectory       === 'function' && searchDirectory(),
      };

      const action = refreshActions[activeTab];
      if (typeof action === 'function') {
        action();
      }
      
      // Hide indicator after 1 second
      setTimeout(() => {
        if (refreshIndicator) {
          refreshIndicator.style.top = '-60px';
          refreshIndicator.style.animation = '';
          refreshIndicator.innerHTML = '↓';
        }
      }, 1000);
    } else {
      // Cancel pull
      if (refreshIndicator) {
        refreshIndicator.style.top = '-60px';
      }
    }
    
    isPulling = false;
  });
}

// ── Daily Check-In Functions ──────────────────────────────────
// BL-R-C6: Fixed element IDs, API paths, field names, and added missing selectAlignment function

function selectAlignment(score) {
  score = parseInt(score, 10);
  document.getElementById('checkin-alignment-score').value = score;
  document.querySelectorAll('.alignment-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.score) === score);
  });
}

// Aliases for HTML onclick handlers (HTML uses lowercase 'i')
function saveCheckin() { return saveCheckIn(); }
function loadCheckinStats() { return loadCheckInStats(); }

async function saveCheckIn() {
  const btn = document.getElementById('checkinBtn');
  const alignmentScore = parseInt(document.getElementById('checkin-alignment-score').value);
  const followedStrategy = document.getElementById('checkin-followed-strategy').checked;
  const followedAuthority = document.getElementById('checkin-followed-authority').checked;
  const mood = document.getElementById('checkin-mood').value || null;
  const energyLevelEl = document.getElementById('checkin-energy-level');
  const energyLevel = energyLevelEl && energyLevelEl.value ? parseInt(energyLevelEl.value) : null;
  const notes = document.getElementById('checkin-notes').value.trim();

  const statusDiv = document.getElementById('checkinStatus');

  if (!alignmentScore || alignmentScore < 1 || alignmentScore > 10) {
    statusDiv.innerHTML = '<div class="alert alert-error">' + window.t('checkin.selectScore') + '</div>';
    return;
  }

  // Disable button to prevent double-submit
  btn.disabled = true;
  statusDiv.innerHTML = '<div class="alert alert-info">' + window.t('checkin.saving') + '</div>';

  try {
    const result = await apiFetch('/api/checkin', {
      method: 'POST',
      body: JSON.stringify({
        alignmentScore,
        followedStrategy,
        followedAuthority,
        mood,
        energyLevel,
        notes: notes || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    });

    if (result.success) {
      statusDiv.innerHTML = `
        <div class="alert alert-success">
          <strong>${escapeHtml(result.message || 'Check-in saved!')}</strong><br>
          ${result.checkIn?.streak > 3 ? 'Keep it going! 🌟' : ''}
        </div>
      `;

      // Reset form
      document.getElementById('checkin-alignment-score').value = '';
      document.querySelectorAll('.alignment-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById('checkin-followed-strategy').checked = false;
      document.getElementById('checkin-followed-authority').checked = false;
      if (document.getElementById('checkin-mood')) document.getElementById('checkin-mood').value = '';
      if (energyLevelEl) energyLevelEl.value = '';
      document.getElementById('checkin-notes').value = '';

      setTimeout(() => { statusDiv.innerHTML = ''; }, 3000);

      // Auto-refresh stats if visible
      const statsContainer = document.getElementById('checkinStatsContainer');
      if (statsContainer && statsContainer.style.display !== 'none') {
        loadCheckInStats();
      }
    } else {
      statusDiv.innerHTML = `
        <div class="alert alert-error">
          <strong>Error:</strong> ${escapeHtml(result.error || 'Failed to save check-in')}
        </div>
      `;
    }
  } catch (error) {
    console.error('Save check-in error:', error);
    statusDiv.innerHTML = `
      <div class="alert alert-error">
        <strong>Error:</strong> Network error. Please try again.
      </div>
    `;
  } finally {
    // Re-enable button
    btn.disabled = false;
  }
}

async function loadCheckInStats() {
  try {
    const result = await apiFetch('/api/checkin/stats');

    if (result.success) {
      const stats = result.stats;

      // Populate stats summary grid
      const summaryEl = document.getElementById('checkinStatsSummary');
      if (summaryEl) {
        summaryEl.innerHTML = `
          <div style="background:var(--bg3);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
            <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--gold)">${escapeHtml(String(stats.totalCheckins))}</div>
            <div style="font-size:var(--font-size-sm);color:var(--text-dim)">Total Check-Ins</div>
          </div>
          <div style="background:var(--bg3);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
            <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--gold)">${escapeHtml(String(stats.avgAlignmentScore ?? '—'))}</div>
            <div style="font-size:var(--font-size-sm);color:var(--text-dim)">Avg Alignment</div>
          </div>
          <div style="background:var(--bg3);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
            <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--gold)">${escapeHtml(stats.strategyAdherenceRate != null ? stats.strategyAdherenceRate + '%' : '—')}</div>
            <div style="font-size:var(--font-size-sm);color:var(--text-dim)">Strategy Rate</div>
          </div>
          <div style="background:var(--bg3);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
            <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--gold)">${escapeHtml(stats.authorityAdherenceRate != null ? stats.authorityAdherenceRate + '%' : '—')}</div>
            <div style="font-size:var(--font-size-sm);color:var(--text-dim)">Authority Rate</div>
          </div>
        `;
      }

      // Show the stats container
      const container = document.getElementById('checkinStatsContainer');
      if (container) container.style.display = 'block';

      // Render alignment chart if dailyScores exist
      if (stats.dailyScores && stats.dailyScores.length > 0) {
        renderAlignmentChart(stats.dailyScores);
      } else {
        const chartCanvas = document.getElementById('alignmentChart');
        if (chartCanvas) {
          const ctx = chartCanvas.getContext('2d');
          ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
          ctx.fillStyle = 'var(--text-dim)';
          ctx.textAlign = 'center';
          ctx.fillText('No data yet — start checking in!', chartCanvas.width / 2, chartCanvas.height / 2);
        }
      }

      // Populate history list
      if (stats.dailyScores && stats.dailyScores.length > 0) {
        const historyEl = document.getElementById('checkinHistoryList');
        if (historyEl) {
          historyEl.innerHTML = stats.dailyScores.slice().reverse().slice(0, 14).map(d => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-2) 0;border-bottom:var(--border-width-thin) solid var(--border)">
              <span style="font-size:var(--font-size-base);color:var(--text-dim)">${escapeHtml(String(d.date))}</span>
              <span style="display:flex;gap:var(--space-2);align-items:center;font-size:var(--font-size-base)">
                <span title="Alignment">${escapeHtml(String(d.alignmentScore))}/10</span>
                ${d.followedStrategy ? '<span style="color:var(--accent2)" title="Followed strategy">✓S</span>' : '<span style="color:var(--text-dim)" title="Did not follow strategy">✗S</span>'}
                ${d.followedAuthority ? '<span style="color:var(--accent2)" title="Followed authority">✓A</span>' : '<span style="color:var(--text-dim)" title="Did not follow authority">✗A</span>'}
                ${d.mood ? '<span title="Mood: ' + escapeAttr(d.mood) + '">' + ({great:'😊',good:'🙂',neutral:'😐',challenging:'😕',difficult:'😞'}[d.mood] || '') + '</span>' : ''}
              </span>
            </div>
          `).join('');
        }
      }
    } else {
      console.error('Failed to load stats:', result.error);
    }
  } catch (error) {
    console.error('Load stats error:', error);
  }
}

function renderAlignmentChart(dailyScores) {
  const canvas = document.getElementById('alignmentChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { top: 20, right: 10, bottom: 30, left: 30 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  // Y axis
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, H - pad.bottom); ctx.stroke();
  for (let i = 0; i <= 10; i += 2) {
    const y = H - pad.bottom - (i / 10) * plotH;
    ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(i, pad.left - 4, y + 3);
    ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
  }

  // Data line
  if (dailyScores.length < 2) return;
  const stepX = plotW / (dailyScores.length - 1);
  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2;
  ctx.beginPath();
  dailyScores.forEach((d, i) => {
    const x = pad.left + i * stepX;
    const y = H - pad.bottom - (d.alignmentScore / 10) * plotH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Dots
  dailyScores.forEach((d, i) => {
    const x = pad.left + i * stepX;
    const y = H - pad.bottom - (d.alignmentScore / 10) * plotH;
    ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  });
}

// ── Social Proof Stats (real data only — no fake fallbacks) ──
async function loadSocialProofStats() {
  try {
    const response = await fetch(API + '/api/stats/activity');
    const data = await response.json();
    if (data.ok && data.stats) {
      const el = document.getElementById('totalProfiles');
      if (el && data.stats.totalProfiles) {
        animateNumber('totalProfiles', 0, data.stats.totalProfiles, 1500);
      } else {
        // API returned success but no count — hide blank element
        const el2 = document.getElementById('totalProfiles');
        if (el2) el2.closest('.social-proof-stat').style.display = 'none';
      }
    } else {
      // No fake fallback — hide the stat if no real data
      const el = document.getElementById('totalProfiles');
      if (el) el.closest('.social-proof-stat').style.display = 'none';
    }
  } catch (error) {
    // No fake fallback — hide the stat if API unreachable
    const el = document.getElementById('totalProfiles');
    if (el) el.closest('.social-proof-stat').style.display = 'none';
  }
}

function animateNumber(elementId, start, end, duration) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const range = end - start;
  const increment = range / (duration / 16); // 60fps
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= end) {
      current = end;
      clearInterval(timer);
    }
    element.textContent = formatNumber(Math.floor(current));
  }, 16);
}

function formatNumber(num) {
  return num.toLocaleString('en-US');
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  loadSocialProofStats();

  // ── Smart Landing Logic ──────────────────────────────────────────────────
  // Route user to the right starting tab based on their session state
  const hasBirthData = !!localStorage.getItem('primeSelf_birthData');
  const hasSeenOnboarding = !!localStorage.getItem('ps_hasSeenOnboarding');

  if (!hasSeenOnboarding && !hasBirthData) {
    // Brand-new user — show first-run modal over the home tab
    const modal = document.getElementById('first-run-modal');
    if (modal) modal.style.display = 'flex';
  } else if (hasBirthData) {
    // Returning user with birth data — land on Home dashboard
    const homeBtn = document.getElementById('btn-home');
    if (typeof switchTab === 'function' && homeBtn) {
      switchTab('overview', homeBtn);
    }
  }
  // else: seen onboarding but no birth data → stays on chart entry form (default)

  // ── Mobile Sticky CTA IntersectionObserver (Sprint 19.3) ─────────────────
  // Show sticky CTA when chart form card scrolls out of viewport on mobile
  const chartFormCard = document.getElementById('chartFormCard');
  const stickyChartCta = document.getElementById('stickyChartCta');
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  if (chartFormCard && stickyChartCta && isMobile) {
    // Keep hidden CTA non-focusable to avoid aria-hidden + focused-descendant violations.
    stickyChartCta.inert = true;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        // Show sticky CTA when form is NOT visible (out of viewport)
        if (!entry.isIntersecting) {
          stickyChartCta.classList.add('visible');
          stickyChartCta.setAttribute('aria-hidden', 'false');
          stickyChartCta.inert = false;
        } else {
          const activeEl = document.activeElement;
          if (activeEl && stickyChartCta.contains(activeEl) && typeof activeEl.blur === 'function') {
            activeEl.blur();
          }
          stickyChartCta.classList.remove('visible');
          stickyChartCta.setAttribute('aria-hidden', 'true');
          stickyChartCta.inert = true;
        }
      });
    }, {
      threshold: 0.1, // Trigger when 10% of form is visible/hidden
      rootMargin: '-20px 0px' // Small buffer to avoid flicker
    });

    observer.observe(chartFormCard);
  }
});
