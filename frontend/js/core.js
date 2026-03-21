/**
 * frontend/js/core.js
 * 
 * Prime Self application core — bootstrap, routing, and app initialization.
 * 
 * Responsibilities:
 * - App initialization (restore session, render UI)
 * - Tab router (switchTab() logic)
 * - Dynamic controller loading
 * - Global event listeners
 * - Update welcome message
 */

import {
  getState, setState, setStateMultiple, isAuthenticated, isPractitioner,
  subscribe, resetSession, getApiOrigin
} from './state.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const MOBILE_LAYOUT_MAX_WIDTH = 900;

// Tab grouping for legacy support
const TAB_GROUPS = {
  'chart': 'chart-tab',
  'profile': 'profile-tab',
};

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Check if device is likely a mobile phone
 */
function isLikelyMobilePhone() {
  const ua = navigator.userAgent || '';
  const uaDataMobile = !!(navigator.userAgentData && navigator.userAgentData.mobile);
  const uaMobile = /Android|iPhone|iPod|Mobile|SamsungBrowser|Silk/i.test(ua);
  const foldablePhone = /SM-F|Z Flip|Z Fold/i.test(ua);
  const hasTouch = navigator.maxTouchPoints > 1;
  const coarsePointer = !!window.matchMedia?.('(pointer: coarse)').matches;
  return uaDataMobile || uaMobile || foldablePhone || (hasTouch && coarsePointer);
}

/**
 * Check if mobile layout should be used
 */
function shouldUseMobileLayout() {
  const shortestEdge = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  const foldablePhone = /SM-F|Z Flip|Z Fold/i.test(navigator.userAgent || '');
  return isLikelyMobilePhone() && (shortestEdge <= MOBILE_LAYOUT_MAX_WIDTH || foldablePhone);
}

/**
 * Sync mobile layout class on document root
 */
function syncMobileLayoutClass() {
  document.documentElement.classList.toggle('force-mobile-layout', shouldUseMobileLayout());
}

/**
 * Load controller script dynamically
 * @param {string} path - Path to controller file (e.g., 'clustering-controller.js')
 * @returns {Promise<void>}
 */
function loadController(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `/frontend/js/controllers/${path}`;
    script.type = 'module';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load controller: ${path}`));
    document.head.appendChild(script);
  });
}

// Make available globally for use in app.js (backward compatibility)
window._loadController = loadController;

// ─── Tab Router ─────────────────────────────────────────────────────────────

/**
 * Switch to a tab by ID
 * @param {string} id - Tab ID
 * @param {HTMLElement} btn - Tab button (optional)
 */
export function switchTab(id, btn) {
  // Close More dropdown if open
  if (typeof closeMoreMenu === 'function') closeMoreMenu();
  
  // Deactivate all tab content
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  
  // Legacy: remove active from old .tabs .tab-btn if any remain
  document.querySelectorAll('.tabs .tab-btn').forEach(el => {
    el.classList.remove('active');
    el.setAttribute('aria-selected', 'false');
  });
  
  // Activate the correct tab
  const panel = document.getElementById('tab-' + id);
  if (panel) panel.classList.add('active');
  
  // Activate the correct primary tab button (group-aware)
  const groupBtn = TAB_GROUPS[id] ? document.getElementById(TAB_GROUPS[id]) : btn;
  if (groupBtn) {
    groupBtn.classList.add('active');
    groupBtn.setAttribute('aria-selected', 'true');
  } else if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
  }
  
  // Update sub-tabs (ACC-P2-1)
  document.querySelectorAll('.sub-tabs button[role="tab"]').forEach(tab => {
    const tabId = tab.getAttribute('data-arg0');
    tab.setAttribute('aria-selected', tabId === id ? 'true' : 'false');
  });
  
  // Update sidebar active states
  if (typeof updateSidebarActive === 'function') updateSidebarActive(id);
  
  // Update step guide progress
  if (typeof updateStepGuide === 'function') updateStepGuide(id);
  
  // Check for tab overflow
  if (typeof updateTabOverflowIndicator === 'function') updateTabOverflowIndicator();
  
  // Track analytics
  if (id === 'overview' && typeof trackEvent === 'function') {
    trackEvent('landing', 'hero_view');
  }
  
  if ((id === 'transits' || id === 'checkin') && typeof markJourneyMilestone === 'function') {
    markJourneyMilestone('transitsViewed');
  }
  
  // Lazy-load controller for tab
  lazyLoadTabController(id);
  
  // Notify global listeners
  if (typeof window.onTabActivated === 'function') {
    window.onTabActivated(id);
  }
}

/**
 * Register switchTab globally
 */
window.switchTab = switchTab;

/**
 * Lazy-load controller when tab is activated
 * @param {string} tabId - Tab ID
 */
async function lazyLoadTabController(tabId) {
  if (!switchTab._loading) {
    switchTab._loading = new Set();
  }
  
  const token = getState('token');
  if (!token) return; // Only load for authenticated users
  
  try {
    switch (tabId) {
      case 'clusters':
        if (!document.getElementById('clusterListContainer')?.innerHTML && 
            !switchTab._loading.has('clusters')) {
          switchTab._loading.add('clusters');
          await loadController('clustering-controller.js');
          if (typeof loadClusters === 'function') {
            await loadClusters();
          }
          switchTab._loading.delete('clusters');
        }
        break;
        
      case 'practitioner':
        if (!switchTab._loading.has('practitioner')) {
          switchTab._loading.add('practitioner');
          await Promise.all([
            loadController('practitioner-clients.js'),
            loadController('practitioner-marketing.js'),
            loadController('practitioner-management.js'),
            loadController('practitioner-notes.js'),
          ]);
          if (typeof loadRoster === 'function') {
            await loadRoster();
          }
          switchTab._loading.delete('practitioner');
        }
        break;
        
      case 'my-practitioner':
        if (!switchTab._loading.has('my-practitioner')) {
          switchTab._loading.add('my-practitioner');
          await loadController('practitioner-clients.js');
          if (typeof loadClientPortal === 'function') {
            await loadClientPortal();
          }
          switchTab._loading.delete('my-practitioner');
        }
        break;
        
      case 'celebrity':
        if (!document.getElementById('celebrityGrid')?.innerHTML && 
            !switchTab._loading.has('celebrity')) {
          switchTab._loading.add('celebrity');
          await loadController('achievements-controller.js');
          if (typeof loadCelebrityMatches === 'function') {
            await loadCelebrityMatches();
          }
          switchTab._loading.delete('celebrity');
        }
        break;
        
      case 'achievements':
        if (!document.getElementById('achievementsBadges')?.innerHTML && 
            !switchTab._loading.has('achievements')) {
          switchTab._loading.add('achievements');
          await loadController('achievements-controller.js');
          if (typeof loadAchievements === 'function') {
            await loadAchievements();
          }
          switchTab._loading.delete('achievements');
        }
        break;
        
      case 'diary':
        if (!switchTab._loading.has('diary')) {
          switchTab._loading.add('diary');
          await loadController('diary-controller.js');
          if (typeof loadDiary === 'function') {
            await loadDiary();
          }
          switchTab._loading.delete('diary');
        }
        break;
        
      case 'transits':
        if (!switchTab._loading.has('transits')) {
          switchTab._loading.add('transits');
          await loadController('transit-controller.js');
          if (typeof loadTransits === 'function') {
            await loadTransits();
          }
          switchTab._loading.delete('transits');
        }
        break;
    }
  } catch (err) {
    console.error(`[Core] Error lazy-loading controller for tab ${tabId}:`, err);
  }
}

// ─── Global Event Listeners ──────────────────────────────────────────────────

/**
 * Initialize global event listeners
 */
function initGlobalListeners() {
  // Mobile layout responsive
  window.addEventListener('resize', syncMobileLayoutClass, { passive: true });
  window.addEventListener('orientationchange', syncMobileLayoutClass);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncMobileLayoutClass, { once: true });
  } else {
    syncMobileLayoutClass();
  }
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && typeof closeAllModals === 'function') {
      closeAllModals();
    }
  });
  
  // Click delegation (handled by app.js via initDelegation)
  document.addEventListener('click', (e) => {
    if (typeof handleGlobalClick === 'function') {
      handleGlobalClick(e);
    }
  });
}

// ─── App Initialization ──────────────────────────────────────────────────────

/**
 * Initialize app
 */
async function initApp() {
  // Mark app as initializing
  document.documentElement.setAttribute('data-app-state', 'initializing');
  
  // E2E bypass: ?e2e=1 skips onboarding modal
  if (new URLSearchParams(window.location.search).get('e2e') === '1') {
    try {
      localStorage.setItem('primeself_frm_seen', '1');
    } catch {}
  }
  
  // Restore session from cookie
  await restoreSessionFromCookie();
  
  // Update UI based on auth state
  updateWelcomeMessage();
  
  // Initialize global listeners
  initGlobalListeners();
  
  // Load remaining script bundles
  await loadInitialBundles();
  
  // Mark app as ready
  document.documentElement.setAttribute('data-app-state', 'ready');
}

/**
 * Update welcome message based on auth state
 */
export function updateWelcomeMessage() {
  const welcomeEl = document.getElementById('welcome-message');
  if (!welcomeEl) return;
  
  if (isAuthenticated()) {
    const user = getState('currentUser');
    const name = user?.first_name || user?.email?.split('@')[0] || 'User';
    welcomeEl.textContent = `Welcome back, ${name}!`;
  } else {
    welcomeEl.textContent = 'Welcome to Prime Self';
  }
}

/**
 * Restore session from auth cookie
 */
async function restoreSessionFromCookie() {
  // This will be implemented in auth-controller.js
  // For now, just a placeholder
  if (typeof silentRefresh === 'function') {
    try {
      await silentRefresh();
    } catch (err) {
      console.debug('[Core] Silent refresh failed (expected on first visit):', err.message);
    }
  }
}

/**
 * Load initial bundles (common scripts)
 */
async function loadInitialBundles() {
  // These are loaded from index.html currently
  // This hook allows future optimization (code-splitting)
}

// ─── DOMContentLoaded Handler ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Set default active tab
  if (typeof updateStepGuide === 'function') {
    updateStepGuide('chart');
  }
  
  // Apply guidance
  if (typeof applyGuidedNavigation === 'function') {
    applyGuidedNavigation();
  }
  if (typeof applyGuidanceState === 'function') {
    applyGuidanceState();
  }
  
  // Update tab indicator
  if (typeof updateTabOverflowIndicator === 'function') {
    updateTabOverflowIndicator();
  }
  
  // Reactive tab overflow on resize
  window.addEventListener('resize', () => {
    if (typeof updateTabOverflowIndicator === 'function') {
      updateTabOverflowIndicator();
    }
  }, { passive: true });
});

// ─── Export API ─────────────────────────────────────────────────────────────

export {
  shouldUseMobileLayout,
  isLikelyMobilePhone,
  syncMobileLayoutClass,
  loadController,
};

// Initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
