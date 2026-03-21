/**
 * frontend/js/state.js
 * 
 * Shared reactive state module — single source of truth for all application state.
 * All controllers import and use this module to access/modify user session, charts,
 * diary entries, and UI state.
 * 
 * Architecture:
 * - STATE object holds all mutable state
 * - Export getter/setter functions for encapsulation
 * - Controllers call setState(key, value) to mutate state
 * - Event system allows controllers to react to state changes
 */

const STATE = {
  // ─── Authentication & User Session ───────────────────────────────────────
  currentUser: null,
  token: null,
  tokenExpiresAt: 0,
  refreshTimer: null,
  userEmail: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ps_email') : null,
  authMode: 'login', // 'login' | 'register'
  pendingResetToken: null,
  refreshInProgress: null,
  sessionRestoredByOauth: false,

  // ─── API Configuration ───────────────────────────────────────────────────
  apiOrigin: (() => {
    if (typeof window !== 'undefined') {
      const configured = window.__PRIME_SELF_API_ORIGIN__;
      if (typeof configured === 'string' && configured.trim()) {
        return configured.replace(/\/$/, '');
      }
      return typeof window.DEBUG !== 'undefined' && window.DEBUG
        ? 'https://prime-self-api.adrper79.workers.dev'
        : '';
    }
    return '';
  })(),

  // ─── Chart & Calculation State ───────────────────────────────────────────
  lastChart: null,
  lastForge: null,

  // ─── Practitioner State ───────────────────────────────────────────────────
  pracSchedulingEmbedUrl: '',
  practitionerBookingUrl: '',
  practitionerRosterClients: [],
  practitionerClientDetailCache: new Map(),
  profileAdvancedPreference: null,

  // ─── Diary & Entry State ─────────────────────────────────────────────────
  diaryTransitCache: null,
  currentDiaryEdit: null,
  rawCount: 0,

  // ─── UI State ────────────────────────────────────────────────────────────
  calView: 'month',
  calDate: new Date(),
  calEvents: [],
  calAllowedTypes: ['personal', 'moon', 'reminder', 'diary'],
  calPractitionerMode: false,
  calClientColors: {},
  directoryOffset: 0,
  frmCurrentStep: 1,
  practOnbStep: 1,
  enhanceQuestionsLoaded: false,

  // ─── Pending/Transitional State ──────────────────────────────────────────
  pendingPractitionerInvite: null,
  postCheckoutDestination: null,
  postCheckoutTier: null,
  practitionerOnboardingTriggered: false,
};

/**
 * Event dispatcher for state changes
 * Controllers can subscribe to state changes via subscribe()
 */
const stateEventListeners = new Map(); // key -> Set of listeners

/**
 * Subscribe to state changes
 * @param {string} key - State key to watch
 * @param {Function} callback - Called when state[key] changes
 * @returns {Function} Unsubscribe function
 */
export function subscribe(key, callback) {
  if (!stateEventListeners.has(key)) {
    stateEventListeners.set(key, new Set());
  }
  stateEventListeners.get(key).add(callback);
  
  // Return unsubscribe function
  return () => {
    stateEventListeners.get(key).delete(callback);
    if (stateEventListeners.get(key).size === 0) {
      stateEventListeners.delete(key);
    }
  };
}

/**
 * Emit state change event to all subscribers
 * @private
 */
function emitStateChange(key, oldValue, newValue) {
  if (stateEventListeners.has(key)) {
    stateEventListeners.get(key).forEach(callback => {
      try {
        callback(newValue, oldValue);
      } catch (e) {
        console.error(`[State] Error in subscriber for ${key}:`, e);
      }
    });
  }
}

/**
 * Get state value
 * @param {string} key - State key
 * @returns {*} State value
 */
export function getState(key) {
  return STATE[key];
}

/**
 * Get all state
 * @returns {Object} Copy of STATE object
 */
export function getAllState() {
  return { ...STATE };
}

/**
 * Set state value and notify subscribers
 * @param {string} key - State key
 * @param {*} value - New value
 * @returns {*} New value
 */
export function setState(key, value) {
  if (!(key in STATE)) {
    console.warn(`[State] Unknown key: ${key}`);
  }
  
  const oldValue = STATE[key];
  
  // Only update if value actually changed
  if (oldValue === value) {
    return value;
  }
  
  STATE[key] = value;
  emitStateChange(key, oldValue, value);
  
  return value;
}

/**
 * Batch multiple state updates and notify once
 * @param {Object} updates - Key-value pairs to update
 */
export function setStateMultiple(updates) {
  const changes = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (!(key in STATE)) {
      console.warn(`[State] Unknown key: ${key}`);
      continue;
    }
    
    if (STATE[key] !== value) {
      changes.push({ key, oldValue: STATE[key], newValue: value });
      STATE[key] = value;
    }
  }
  
  // Notify all subscribers of changes
  changes.forEach(({ key, oldValue, newValue }) => {
    emitStateChange(key, oldValue, newValue);
  });
}

/**
 * Reset user session (logout)
 */
export function resetSession() {
  setStateMultiple({
    currentUser: null,
    token: null,
    tokenExpiresAt: 0,
    userEmail: null,
    pendingResetToken: null,
    sessionRestoredByOauth: false,
  });
  
  // Clear timers
  if (STATE.refreshTimer) {
    clearTimeout(STATE.refreshTimer);
    setState('refreshTimer', null);
  }
  
  // Clear practitioner state
  setState('practitionerRosterClients', []);
  setState('practitionerClientDetailCache', new Map());
  setState('pracSchedulingEmbedUrl', '');
  setState('practitionerBookingUrl', '');
  
  // Clear last chart
  setState('lastChart', null);
  setState('lastForge', null);
}

/**
 * Set auth state (after successful login/register)
 */
export function setAuthState(user, accessToken, expiresIn) {
  setStateMultiple({
    currentUser: Object.freeze(user), // Immutable (P2-FE-013)
    token: accessToken,
    tokenExpiresAt: Date.now() + (expiresIn || 3600) * 1000,
  });
}

/**
 * Helper: Is user authenticated?
 */
export function isAuthenticated() {
  return STATE.token !== null && STATE.currentUser !== null;
}

/**
 * Helper: Is user a practitioner?
 */
export function isPractitioner() {
  return STATE.currentUser?.tier === 'practitioner';
}

/**
 * Helper: Get user tier
 */
export function getUserTier() {
  return STATE.currentUser?.tier || 'free';
}

/**
 * Helper: Cancel refresh timer
 */
export function cancelRefreshTimer() {
  if (STATE.refreshTimer) {
    clearTimeout(STATE.refreshTimer);
    setState('refreshTimer', null);
  }
}

/**
 * Helper: Set refresh timer
 */
export function setRefreshTimer(timerId) {
  cancelRefreshTimer();
  setState('refreshTimer', timerId);
}

/**
 * Helper: Get API origin for requests
 */
export function getApiOrigin() {
  return STATE.apiOrigin;
}

/**
 * Debug: Log current state
 */
export function debugLogState() {
  if (typeof window !== 'undefined' && window.DEBUG) {
    console.log('[State] Current state:', {
      isAuthenticated: isAuthenticated(),
      user: STATE.currentUser?.email,
      tier: STATE.currentUser?.tier,
      lastChart: !!STATE.lastChart,
      lastForge: !!STATE.lastForge,
    });
  }
}

// Export STATE for internal use (read-only via getters above)
export default STATE;
