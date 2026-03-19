// Debug logging: auto-enabled on localhost; set window.DEBUG=true in DevTools to enable on production
window.DEBUG = /localhost|127\.0\.0\.1/.test(location.hostname);

const API = 'https://prime-self-api.adrper79.workers.dev';
// Access token is stored in memory only — never in localStorage.
// The refresh token lives in an HttpOnly cookie set by the API.
// On page reload, silentRefresh() exchanges the cookie for a new access token.
let token = null;
let _tokenExpiresAt = 0; // P2-FE-005: epoch ms when access token expires
let _refreshTimer = null; // P2-FE-005: proactive refresh timer
let _pracSchedulingEmbedUrl = ''; // PRAC-015: practitioner's scheduling embed URL, set during loadRoster
let _practitionerBookingUrl   = ''; // WC-P1-1: practitioner's external booking URL, set during loadRoster
let _practitionerRosterClients = [];
const _practitionerClientDetailCache = new Map();
let _profileAdvancedPreference = null;
const PENDING_PRACTITIONER_INVITE_KEY = 'ps_pending_practitioner_invite';
const POST_CHECKOUT_DESTINATION_KEY = 'ps_post_checkout_destination';
const POST_CHECKOUT_TIER_KEY = 'ps_post_checkout_tier';
const PRACTITIONER_ONBOARDING_KEY = 'ps_pract_onb_triggered';
let userEmail = sessionStorage.getItem('ps_email');
let authMode = 'login'; // 'login' | 'register'
let _pendingResetToken = null; // SEC-001: closure-scoped, never on window
let currentUser = null; // populated by fetchUserProfile() — frozen on set (P2-FE-013); module-scoped (SYS-031)

const MOBILE_LAYOUT_MAX_WIDTH = 900;

function hasSeenFirstRunOnboarding() {
  try {
    return localStorage.getItem('primeself_frm_seen') === '1' || localStorage.getItem('ps_hasSeenOnboarding') === '1';
  } catch (_error) {
    return false;
  }
}

window.hasSeenFirstRunOnboarding = hasSeenFirstRunOnboarding;

function isLikelyMobilePhone() {
  const ua = navigator.userAgent || '';
  const uaDataMobile = !!(navigator.userAgentData && navigator.userAgentData.mobile);
  const uaMobile = /Android|iPhone|iPod|Mobile|SamsungBrowser|Silk/i.test(ua);
  const hasTouch = navigator.maxTouchPoints > 1;
  return uaDataMobile || uaMobile || hasTouch;
}

function shouldUseMobileLayout() {
  const shortestEdge = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  return shortestEdge <= MOBILE_LAYOUT_MAX_WIDTH && isLikelyMobilePhone();
}

function syncMobileLayoutClass() {
  document.documentElement.classList.toggle('force-mobile-layout', shouldUseMobileLayout());
}

window.shouldUseMobileLayout = shouldUseMobileLayout;
window.addEventListener('resize', syncMobileLayoutClass, { passive: true });
window.addEventListener('orientationchange', syncMobileLayoutClass);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syncMobileLayoutClass, { once: true });
} else {
  syncMobileLayoutClass();
}

// ─── Canonical display-name mapping (PRODUCT_PRINCIPLES.md §8) ───
const DISPLAY_TYPE = {
  'Generator': 'Builder Pattern', 'Manifesting Generator': 'Builder-Initiator Pattern',
  'Projector': 'Guide Pattern', 'Manifestor': 'Catalyst Pattern', 'Reflector': 'Mirror Pattern',
};
const DISPLAY_AUTH = {
  'Emotional': 'Emotional Wave Navigation', 'Emotional Authority': 'Emotional Wave Navigation',
  'Sacral': 'Life Force Response', 'Sacral Authority': 'Life Force Response',
  'Splenic': 'Intuitive Knowing', 'Splenic Authority': 'Intuitive Knowing',
  'Ego': 'Willpower Alignment', 'Heart': 'Willpower Alignment',
  'Self-Projected': 'Voiced Truth', 'Lunar': 'Lunar Cycle Awareness', 'None': 'Outer Authority',
};
const DISPLAY_DEF = {
  'Split': 'Bridging Pattern', 'Triple Split': 'Triple Bridging Pattern',
  'Quadruple Split': 'Quadruple Bridging Pattern', 'No Definition': 'Open Flow',
};
function dType(v) { return DISPLAY_TYPE[v] || v; }
function dAuth(v) { return DISPLAY_AUTH[v] || v; }
function dDef(v) { return DISPLAY_DEF[v] || v; }

function lowerText(value, fallback = '') {
  if (typeof value === 'string') return value.toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).toLowerCase();
  if (value && typeof value === 'object') {
    const candidate = value.label ?? value.name ?? value.title ?? value.value ?? fallback;
    return typeof candidate === 'string' ? candidate.toLowerCase() : String(candidate || fallback).toLowerCase();
  }
  return String(fallback || '').toLowerCase();
}

// Tier display configuration — HD_UPDATES3 naming
const TIER_DISPLAY = {
  free:         { label: 'FREE',          badge: 'tier-free',         canUpgrade: true,  isPro: false },
  individual:   { label: 'INDIVIDUAL',    badge: 'tier-individual',   canUpgrade: true,  isPro: false },
  practitioner: { label: 'PRACTITIONER',  badge: 'tier-practitioner', canUpgrade: true,  isPro: true  },
  agency:       { label: 'AGENCY',        badge: 'tier-agency',       canUpgrade: false, isPro: true  },
  // legacy aliases
  regular:      { label: 'INDIVIDUAL',    badge: 'tier-individual',   canUpgrade: true,  isPro: false },
  seeker:       { label: 'INDIVIDUAL',    badge: 'tier-individual',   canUpgrade: true,  isPro: false },
  white_label:  { label: 'AGENCY',        badge: 'tier-agency',       canUpgrade: false, isPro: true  },
  guide:        { label: 'PRACTITIONER',  badge: 'tier-practitioner', canUpgrade: true,  isPro: true  },
};

// ── Auth Helpers ──────────────────────────────────────────────
function updateAuthUI() {
  const statusEl = document.getElementById('authStatusText');
  const btnEl    = document.getElementById('authBtn');
  const logoutEl = document.getElementById('logoutBtn');
  const deleteAcctEl = document.getElementById('deleteAccountBtn');
  const exportDataEl = document.getElementById('exportDataBtn');
  const securityBtnEl = document.getElementById('securitySettingsBtn');
  const badgeEl  = document.getElementById('tierBadge');
  const upgradeEl  = document.getElementById('upgradeBtn');
  const billingEl  = document.getElementById('billingBtn');
  const notifBellEl = document.getElementById('notifBellBtn');

  if (token && userEmail) {
    statusEl.textContent = userEmail;
    statusEl.className   = 'auth-status logged-in';
    btnEl.style.display    = 'none';
    logoutEl.style.display = '';
    if (deleteAcctEl) deleteAcctEl.style.display = '';
    if (exportDataEl) exportDataEl.style.display = '';
    if (securityBtnEl) securityBtnEl.style.display = '';
    if (notifBellEl) notifBellEl.style.display = '';

    // Update tier badge and billing/upgrade buttons from cached profile
    const user = currentUser;
    if (user) {
      const tier    = user.tier || 'free';
      const cfg     = TIER_DISPLAY[tier] || TIER_DISPLAY.free;
      badgeEl.textContent = cfg.label;
      badgeEl.className   = 'tier-badge ' + cfg.badge;
      badgeEl.style.display = '';

      // Update sidebar tier footer
      const sidebarTier = document.getElementById('sidebarTierText');
      if (sidebarTier) sidebarTier.textContent = cfg.label + ' Tier';

      // Upgrade button: visible for tiers that can still upgrade
      upgradeEl.style.display  = cfg.canUpgrade ? '' : 'none';
      // Billing button: visible when user has any subscription
      billingEl.style.display  = (tier !== 'free') ? '' : 'none';
      
      // UX-007: Update welcome message based on tier and chart generation status
      updateWelcomeMessage();
      updateProfileAdvancedUI();
    } else {
      // Profile not loaded yet — hide badge until fetched
      badgeEl.style.display    = 'none';
      upgradeEl.style.display  = 'none';
      billingEl.style.display  = 'none';
      updateProfileAdvancedUI();
    }
  } else {
    statusEl.textContent = typeof window.t === 'function' ? window.t('auth.notSignedIn') : 'Not signed in';
    statusEl.className   = 'auth-status';
    btnEl.style.display    = '';
    logoutEl.style.display = 'none';
    if (deleteAcctEl) deleteAcctEl.style.display = 'none';
    if (exportDataEl) exportDataEl.style.display = 'none';
    if (securityBtnEl) securityBtnEl.style.display = 'none';
    if (notifBellEl) notifBellEl.style.display = 'none';
    badgeEl.style.display  = 'none';
    upgradeEl.style.display  = 'none';
    billingEl.style.display  = 'none';
    updateProfileAdvancedUI();
  }
}

// UX-007: Update welcome message based on tier and chart generation status
function updateWelcomeMessage() {
  const container = document.getElementById('overviewContent');
  if (!container) return;
  
  // Only update if chart hasn't been generated (welcome card is still visible)
  if (readJourneyFlag('chartGenerated')) return;
  
  const tier = currentUser?.tier || 'free';
  const isPractitioner = tier === 'practitioner' || tier === 'guide' || tier === 'agency' || tier === 'white_label';
  
  let html;
  if (isPractitioner) {
    // Practitioner welcome card
    html = `<div class="card card-welcome">
      <div class="welcome-icon">👥</div>
      <h3 class="welcome-title">Welcome to Your Practitioner Workspace</h3>
      <p class="welcome-text">Manage your client roster, prepare for sessions with AI context, and deliver branded reports. Start by creating your own Energy Blueprint chart, then add your first client and begin tracking their sessions.</p>
      <button class="btn-primary" data-action="switchTab" data-arg0="chart">Create Your Chart →</button>
    </div>`;
  } else {
    // Consumer welcome card — drive practitioner upgrade awareness
    html = `<div class="card card-welcome">
      <div class="welcome-icon">⚷</div>
      <h3 class="welcome-title">Discover Your Energy Blueprint</h3>
      <p class="welcome-text">Your unique energy architecture revealed. Get your Energy Blueprint chart, AI-generated personal synthesis, daily transit insights, and tools for living in alignment with your design. Start with your birth data — we'll calculate everything in seconds.</p>
      <button class="btn-primary" data-action="switchTab" data-arg0="chart">Generate Your Chart →</button>
      <p style="margin-top:0.6rem;font-size:0.85em;color:var(--text-dim)">Running an HD practice? <a href="#" data-action="heroPractitionerCta" style="color:var(--gold)">See Practitioner Plan →</a></p>
    </div>`;
  }
  
  container.innerHTML = html;
}

// Fetch /api/auth/me and populate currentUser, then refresh UI
async function fetchUserProfile() {
  if (!token) return;
  try {
    const data = await apiFetch('/api/auth/me');
    if (!data || data.error) return; // silently ignore — errors handled by apiFetch
    const user = data?.user || data;
    if (user && user.id) {
      currentUser = Object.freeze({ ...user });
      updateAuthUI();
      // AUDIT-SEC-003: Show/hide verification banner based on email_verified status
      if (user.email_verified === false) showEmailVerificationBanner();
      else hideEmailVerificationBanner();
      // Client Portal: show nav item if user is on any practitioner's roster
      checkClientPortalVisibility();
    }
  } catch (e) {
    // network error — non-fatal
  }
}

/**
 * Silently exchange the HttpOnly ps_refresh cookie for a new access token.
 * Called on page load and whenever apiFetch gets a 401.
 * Returns true if a new token was obtained, false otherwise.
 */
let _refreshInProgress = null;

// P2-FE-005: Parse JWT exp claim and schedule proactive refresh
function _scheduleTokenRefresh(jwt) {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = null;
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    if (payload.exp) {
      _tokenExpiresAt = payload.exp * 1000;
      const refreshIn = Math.max((_tokenExpiresAt - Date.now()) - 60000, 5000); // 60s before expiry, min 5s
      _refreshTimer = setTimeout(() => { silentRefresh(); }, refreshIn);
    }
  } catch { /* malformed token — reactive refresh will handle it */ }
}

async function silentRefresh() {
  // Deduplicate concurrent refresh attempts
  if (_refreshInProgress) return _refreshInProgress;
  _refreshInProgress = (async () => {
    try {
      const res = await fetch(API + '/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // cookie sent automatically
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.accessToken) {
        token = data.accessToken;
        _scheduleTokenRefresh(token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      _refreshInProgress = null;
    }
  })();
  return _refreshInProgress;
}

let authBackdropClickHandler = null;

/**
 * ACC-P2-8: Modal Focus Management
 * Stores trigger element when opening modal, restores focus when closing
 * Best practice per WCAG 2.4.3 Focus Order
 */
const modalFocusMap = new Map();

function storeModalTrigger(modalId) {
  modalFocusMap.set(modalId, document.activeElement);
}

function restoreModalFocus(modalId) {
  const trigger = modalFocusMap.get(modalId);
  if (trigger && typeof trigger.focus === 'function') {
    trigger.focus();
    modalFocusMap.delete(modalId);
  }
}

/**
 * ACC-P2-9: Standardized Loading State Management
 * Synchronizes aria-busy, button disabled state, and spinner visibility
 * Best practice: single source of truth for loading state
 *
 * @param {Object} options - Configuration
 * @param {HTMLElement} options.resultEl - Element to set aria-busy on
 * @param {HTMLElement} options.btnEl - Button to disable
 * @param {HTMLElement} options.spinnerEl - Spinner to show/hide
 * @param {boolean} options.isLoading - True to show loading, false to hide
 * @param {string} options.loadingMessage - Message to announce (optional)
 */
function setLoadingState({ resultEl, btnEl, spinnerEl, isLoading = true, loadingMessage = null }) {
  if (!resultEl) return;

  if (isLoading) {
    // Show loading state
    resultEl.setAttribute('aria-busy', 'true');
    if (btnEl) btnEl.disabled = true;
    if (spinnerEl) spinnerEl.style.display = '';

    // Optional: Announce what's loading to screen readers
    if (loadingMessage && resultEl.id) {
      const statusId = `${resultEl.id}-status`;
      let statusEl = document.getElementById(statusId);
      if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = statusId;
        statusEl.className = 'visually-hidden';
        statusEl.setAttribute('aria-live', 'polite');
        statusEl.setAttribute('aria-atomic', 'true');
        resultEl.appendChild(statusEl);
      }
      statusEl.textContent = loadingMessage;
    }
  } else {
    // Hide loading state
    resultEl.removeAttribute('aria-busy');
    if (btnEl) btnEl.disabled = false;
    if (spinnerEl) spinnerEl.style.display = 'none';

    // Clear status announcement
    if (resultEl.id) {
      const statusEl = document.getElementById(`${resultEl.id}-status`);
      if (statusEl) statusEl.textContent = '';
    }
  }
}

// ── TOTP helpers ─────────────────────────────────────────────────────────────
function _resetTOTPStep() {
  const step = document.getElementById('authTOTPStep');
  if (!step) return;
  step.style.display = 'none';
  window._totpPendingToken = null;
  const form = document.querySelector('#authOverlay form[data-action="submitAuth"]');
  if (form) form.style.display = '';
  const fpl = document.getElementById('forgotPasswordLink');
  if (fpl) fpl.style.display = '';
  const divider = document.querySelector('.auth-divider');
  if (divider) divider.style.display = '';
  const social = document.querySelector('.auth-social-list');
  if (social) social.style.display = '';
  const toggle = document.querySelector('.auth-toggle');
  if (toggle) toggle.style.display = '';
}

async function submitTOTP() {
  const code = document.getElementById('authTOTPCode').value.trim();
  const errEl = document.getElementById('authTOTPError');
  const btn = document.querySelector('#authTOTPStep button[type="submit"]');
  errEl.textContent = '';
  if (!code) { errEl.textContent = 'Enter your 6-digit code.'; return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }
  try {
    const res = await apiFetch('/api/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ pending_token: window._totpPendingToken, totp_code: code })
    });
    if (res.error) { errEl.textContent = res.error; return; }
    // SUCCESS — same flow as normal login completion
    token = res.accessToken;
    // CISO-001: Access token stored in memory only — do NOT write to localStorage
    closeAuthOverlay();
    await fetchUserProfile();
    updateAuthUI();
    document.dispatchEvent(new CustomEvent('authSuccess'));
  } catch (e) {
    errEl.textContent = 'Verification failed. Try again.';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Verify'; }
  }
}

function cancel2FA() {
  _resetTOTPStep();
}

// ── Security / 2FA management modal ─────────────────────────────────────────
function openSecuritySettings() {
  // ACC-P2-8: Store trigger element for focus restoration on close
  storeModalTrigger('securityModal');

  const modal = document.getElementById('securityModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  _renderSecurityModal();
}

function closeSecurityModal() {
  const modal = document.getElementById('securityModal');
  if (modal) modal.classList.add('hidden');
  // ACC-P2-8: Restore focus to trigger element
  restoreModalFocus('securityModal');
}

async function _renderSecurityModal() {
  const body = document.getElementById('securityModalBody');
  body.innerHTML = '<p>Loading…</p>';
  try {
    const me = await apiFetch('/api/auth/me');
    if (me.totp_enabled) {
      body.innerHTML = `
        <p>Two-factor authentication is <strong>enabled</strong>.</p>
        <p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-secondary)">
          You need your authenticator app each time you sign in.
        </p>
        <div id="disable2FAForm" style="margin-top:1.5rem">
          <label class="auth-label" for="dis2FAPass">Password</label>
          <input id="dis2FAPass" type="password" class="auth-input" autocomplete="current-password" placeholder="Current password">
          <label class="auth-label" for="dis2FACode" style="margin-top:0.75rem">Authenticator code</label>
          <input id="dis2FACode" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" class="auth-input" placeholder="123456">
          <p id="dis2FAError" style="color:var(--color-error);font-size:0.8rem;min-height:1.1em"></p>
          <button class="btn btn-primary" style="width:100%;margin-top:0.5rem" data-action="disable2FA">Disable 2FA</button>
        </div>`;
    } else {
      body.innerHTML = `
        <p>Two-factor authentication is <strong>disabled</strong>.</p>
        <p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-secondary)">
          Add an extra layer of security with any TOTP app (Google Authenticator, Authy, etc.).
        </p>
        <button class="btn btn-primary" style="width:100%;margin-top:1.5rem" data-action="begin2FASetup">Enable 2FA</button>`;
    }
  } catch {
    body.innerHTML = '<p style="color:var(--color-error)">Could not load security settings.</p>';
  }
}

async function begin2FASetup() {
  const body = document.getElementById('securityModalBody');
  body.innerHTML = '<p>Generating secret…</p>';
  try {
    const res = await apiFetch('/api/auth/2fa/setup');
    if (res.error) { body.innerHTML = `<p style="color:var(--color-error)">${escapeHtml(res.error)}</p>`; return; }
    var qrSrc = (typeof QRCode !== 'undefined') ? QRCode.toDataURL(res.otpauth_url, 4) : '';
    body.innerHTML = `
      <p>Scan this QR code with your authenticator app, or enter the secret manually.</p>
      <div style="text-align:center;margin:1rem 0">
        ${qrSrc ? '<img src="' + qrSrc + '" alt="QR code" width="180" height="180" style="border-radius:6px;image-rendering:pixelated">' : '<p style="color:var(--color-error)">QR code unavailable — enter the manual key below.</p>'}
      </div>
      <p style="font-size:0.8rem;word-break:break-all;background:var(--surface-2);padding:0.5rem 0.75rem;border-radius:4px;margin-bottom:1rem"><strong>Manual key:</strong> ${res.secret}</p>
      <label class="auth-label" for="setup2FACode">Enter the 6-digit code to confirm</label>
      <input id="setup2FACode" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" class="auth-input" placeholder="123456">
      <p id="setup2FAError" style="color:var(--color-error);font-size:0.8rem;min-height:1.1em"></p>
      <button class="btn btn-primary" style="width:100%;margin-top:0.5rem" data-action="confirm2FASetup">Activate 2FA</button>`;
  } catch {
    body.innerHTML = '<p style="color:var(--color-error)">Setup failed. Try again.</p>';
  }
}

async function confirm2FASetup(btn) {
  const code = document.getElementById('setup2FACode').value.trim();
  const errEl = document.getElementById('setup2FAError');
  errEl.textContent = '';
  if (!code) { errEl.textContent = 'Enter the 6-digit code.'; return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Activating…'; }
  try {
    const res = await apiFetch('/api/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ totp_code: code }) });
    if (res.error) { errEl.textContent = res.error; return; }
    _renderSecurityModal(); // refresh to "enabled" view
  } catch {
    errEl.textContent = 'Activation failed. Try again.';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Activate 2FA'; }
  }
}

async function disable2FA(btn) {
  const password = document.getElementById('dis2FAPass').value;
  const code = document.getElementById('dis2FACode').value.trim();
  const errEl = document.getElementById('dis2FAError');
  errEl.textContent = '';
  if (!password || !code) { errEl.textContent = 'Password and code are required.'; return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Disabling…'; }
  try {
    const res = await apiFetch('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password, totp_code: code }) });
    if (res.error) { errEl.textContent = res.error; return; }
    _renderSecurityModal(); // refresh to "disabled" view
  } catch {
    errEl.textContent = 'Failed. Try again.';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Disable 2FA'; }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

function openAuthOverlay() {
  // ACC-P2-8: Store trigger element for focus restoration on close
  storeModalTrigger('authOverlay');

  // Always reset to login mode when opening
  if (authMode !== 'login') {
    authMode = 'login';
    document.getElementById('authTitle').textContent    = typeof window.t === 'function' ? window.t('auth.signIn') : 'Sign In';
    document.getElementById('authSubtitle').textContent = typeof window.t === 'function' ? window.t('auth.accessProfile') : 'Access your Prime Self profile and saved charts.';
    document.getElementById('authSubmit').textContent   = typeof window.t === 'function' ? window.t('auth.signIn') : 'Sign In';
    document.getElementById('authToggleText').textContent = typeof window.t === 'function' ? window.t('auth.noAccount') : "Don't have an account?";
    document.getElementById('authToggleLink').textContent  = typeof window.t === 'function' ? window.t('auth.createOne') : 'Create one';
    document.getElementById('authError').textContent = '';
  }

  // Reset any lingering 2FA challenge state
  _resetTOTPStep();

  document.getElementById('authOverlay').classList.remove('hidden');
  document.getElementById('authEmail').focus();

  const modal = document.getElementById('authOverlay');
  const focusableElements = modal.querySelectorAll('input, button, a[href], [tabindex]:not([tabindex="-1"])');
  const firstElement = focusableElements[0];
  const lastElement  = focusableElements[focusableElements.length - 1];

  // Focus trap + ESC to close
  authModalKeydownHandler = function(e) {
    if (e.key === 'Escape') {
      closeAuthOverlay();
      return;
    }
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };
  modal.addEventListener('keydown', authModalKeydownHandler);

  // Backdrop click to close
  authBackdropClickHandler = function(e) {
    if (e.target === modal) closeAuthOverlay();
  };
  modal.addEventListener('click', authBackdropClickHandler);
}

function closeAuthOverlay() {
  const modal = document.getElementById('authOverlay');
  modal.classList.add('hidden');
  document.getElementById('authError').textContent = '';
  _resetTOTPStep();
  if (authModalKeydownHandler) {
    modal.removeEventListener('keydown', authModalKeydownHandler);
    authModalKeydownHandler = null;
  }
  if (authBackdropClickHandler) {
    modal.removeEventListener('click', authBackdropClickHandler);
    authBackdropClickHandler = null;
  }
  // ACC-P2-8: Restore focus to trigger element
  restoreModalFocus('authOverlay');
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  const isReg = authMode === 'register';
  const _t = typeof window.t === 'function' ? window.t : (k) => k.split('.').pop();
  document.getElementById('authTitle').textContent = isReg ? _t('auth.createAccount') : _t('auth.signIn');
  document.getElementById('authSubtitle').textContent = isReg ? _t('auth.startJourney') : _t('auth.accessProfile');
  document.getElementById('authSubmit').textContent = isReg ? _t('auth.createAccount') : _t('auth.signIn');
  document.getElementById('authToggleText').textContent = isReg ? _t('auth.alreadyAccount') : _t('auth.noAccount');
  document.getElementById('authToggleLink').textContent = isReg ? _t('auth.signInLink') : _t('auth.createOne');
  document.getElementById('authError').textContent = '';
  // Show password field and forgot link in login/register mode
  document.getElementById('authPassword').parentElement.style.display = '';
  document.getElementById('forgotPasswordLink').style.display = '';
  // Show ToS / Privacy consent notice only during registration
  const termsNotice = document.getElementById('authTermsNotice');
  if (termsNotice) termsNotice.classList.toggle('hidden', !isReg);
}

function showForgotPassword() {
  document.getElementById('authTitle').textContent = 'Reset Password';
  document.getElementById('authSubtitle').textContent = 'Enter your email and we\'ll send you a reset link.';
  document.getElementById('authSubmit').textContent = 'Send Reset Link';
  document.getElementById('authToggleText').textContent = 'Remember your password?';
  document.getElementById('authToggleLink').textContent = 'Sign In';
  document.getElementById('authToggleLink').setAttribute('onclick', 'toggleAuthMode(); document.getElementById("authPassword").parentElement.style.display=""; document.getElementById("forgotPasswordLink").style.display="";');
  document.getElementById('authError').textContent = '';
  // Hide password field and forgot link
  document.getElementById('authPassword').parentElement.style.display = 'none';
  document.getElementById('forgotPasswordLink').style.display = 'none';
  authMode = 'forgot';
}

async function submitForgotPassword() {
  const email = document.getElementById('authEmail').value.trim();
  const errorEl = document.getElementById('authError');
  const btn = document.getElementById('authSubmit');

  if (!email) {
    errorEl.textContent = 'Please enter your email address.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';
  errorEl.textContent = '';

  try {
    const res = await fetch(API + '/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = res.ok ? await res.json() : {};
    errorEl.style.color = 'var(--color-success, #30d158)';
    errorEl.textContent = data.message || 'If an account exists, a reset link has been sent.';
    btn.textContent = 'Email Sent ✓';
  } catch (e) {
    errorEl.style.color = '';
    errorEl.textContent = 'Connection error. Please try again.';
    btn.disabled = false;
    btn.textContent = 'Send Reset Link';
  }
}

// Handle OAuth redirect-back (?oauth=success&token=...&refresh=...)
// Called on page load — picks up tokens issued by social login callback
let _sessionRestoredByOauth = false;

async function checkOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const oauthStatus = params.get('oauth');
  if (!oauthStatus) return;

  // Clean URL immediately so tokens don't persist in history
  window.history.replaceState({}, '', window.location.pathname);

  if (oauthStatus === 'error') {
    const msg = params.get('msg') || 'Social login failed. Please try again.';
    showNotification(msg, 'error');
    openAuthOverlay();
    return;
  }

  if (oauthStatus === 'success') {
    const oauthCode    = params.get('code');
    const isNewUser    = params.get('new_user') === '1';

    if (!oauthCode) {
      showNotification('Login failed — no authorization code received. Please try again.', 'error');
      return;
    }

    // P2-SEC-011: Exchange one-time code for tokens via secure POST
    // Tokens are never exposed in URL — code is single-use (60s TTL)
    try {
      const _oauthExchangeBody = { code: oauthCode };
      // P0-FIX: Pass stored referral slug for new OAuth signups so attribution is captured
      if (isNewUser) {
        const _oauthRef = (localStorage.getItem('ps_pending_ref') || '').toLowerCase();
        if (_oauthRef) _oauthExchangeBody.ref = _oauthRef;
      }
      const res = await fetch(API + '/api/auth/oauth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(_oauthExchangeBody)
      });
      const data = await res.json();

      if (!res.ok || !data.token) {
        showNotification(data.error || 'Login failed — please try again.', 'error');
        return;
      }

      // Store access token in memory only; refresh token set as HttpOnly cookie by server
      token = data.token;
      _scheduleTokenRefresh(token);
      _sessionRestoredByOauth = true;
      localStorage.setItem('ps_session', '1');
      localStorage.removeItem('ps_token');
      localStorage.removeItem('ps_refresh_token');

      await fetchUserProfile();
      await processPendingPractitionerInvite();
      await applyPendingPostCheckoutIntent();
      if (data.new_user) {
        showNotification('Welcome to Prime Self! Enter your birth details below to generate your blueprint.', 'success');
      } else {
        showNotification('Signed in successfully.', 'success');
      }
    } catch (e) {
      showNotification('Login failed — connection error. Please try again.', 'error');
    }
  }
}

// Handle email unsubscribe from URL (?action=email-unsubscribe&email=...)
// AUDIT-SEC-005: CAN-SPAM compliance — working unsubscribe link in all marketing emails
function checkEmailUnsubscribeAction() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') !== 'email-unsubscribe') return;
  const email = params.get('email');
  window.history.replaceState({}, '', window.location.pathname);
  if (!email) { showNotification('Invalid unsubscribe link.', 'error'); return; }
  if (!confirm(`Unsubscribe ${email} from marketing emails?\n\nYou will still receive transactional emails (password resets, receipts).`)) return;
  fetch(API + '/api/email/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  .then(r => {
    if (!r.ok) throw new Error('Unsubscribe failed');
    return r.json();
  })
  .then(data => {
    if (data.ok) showNotification('You have been unsubscribed from marketing emails.', 'success');
    else showNotification(data.error || 'Unsubscribe failed. Please try again.', 'error');
  })
  .catch(() => showNotification('Network error. Please try again.', 'error'));
}

// Handle password reset from URL (?action=reset-password&token=...&email=...)
function checkResetPasswordAction() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'reset-password' && params.get('token')) {
    showResetPasswordForm(params.get('token'), params.get('email') || '');
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  }
}

function showResetPasswordForm(resetToken, email) {
  const overlay = document.getElementById('authOverlay');
  overlay.classList.remove('hidden');
  document.getElementById('authTitle').textContent = 'Set New Password';
  document.getElementById('authSubtitle').textContent = email ? `Resetting password for ${email}` : 'Enter your new password.';
  document.getElementById('authEmail').parentElement.style.display = 'none';
  document.getElementById('authPassword').parentElement.style.display = '';
  document.getElementById('authPassword').placeholder = 'New password (min 8 chars)';
  document.getElementById('forgotPasswordLink').style.display = 'none';
  document.getElementById('authSubmit').textContent = 'Reset Password';
  document.querySelector('.auth-toggle').style.display = 'none';
  document.getElementById('authError').textContent = '';
  authMode = 'reset';
  _pendingResetToken = resetToken;
}

async function submitResetPassword() {
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');
  const btn = document.getElementById('authSubmit');

  if (!password || password.length < 8) {
    errorEl.textContent = 'Password must be at least 8 characters.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Resetting...';
  errorEl.textContent = '';

  try {
    const res = await fetch(API + '/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: _pendingResetToken, password })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      errorEl.textContent = data.error || 'Reset failed. The link may have expired.';
      btn.disabled = false;
      btn.textContent = 'Reset Password';
      return;
    }
    errorEl.style.color = 'var(--color-success, #30d158)';
    errorEl.textContent = 'Password reset! Redirecting to sign in...';
    btn.textContent = 'Done ✓';
    _pendingResetToken = null;
    setTimeout(() => {
      // Restore auth form to login mode
      document.getElementById('authEmail').parentElement.style.display = '';
      document.getElementById('authPassword').placeholder = '••••••••';
      document.querySelector('.auth-toggle').style.display = '';
      document.getElementById('forgotPasswordLink').style.display = '';
      authMode = 'login';
      toggleAuthMode(); toggleAuthMode(); // Reset UI to login
      errorEl.style.color = '';
      errorEl.textContent = '';
    }, 2000);
  } catch (e) {
    errorEl.textContent = 'Connection error. Please try again.';
    btn.disabled = false;
    btn.textContent = 'Reset Password';
  }
}

// ─── Email Verification (AUDIT-SEC-003) ────────────────────────────────

// Handle email verification from URL (?action=verify-email&token=...)
function checkEmailVerificationAction() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') !== 'verify-email') return;
  const verifyToken = params.get('token');
  window.history.replaceState({}, '', window.location.pathname);
  if (!verifyToken) { showNotification('Invalid verification link.', 'error'); return; }

  showNotification('Verifying your email…', 'info');
  fetch(API + '/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: verifyToken })
  })
  .then(r => {
    if (!r.ok) throw new Error('Verification failed');
    return r.json();
  })
  .then(data => {
    if (data.ok) {
      showNotification('Email verified! You now have full access to AI features.', 'success');
      hideEmailVerificationBanner();
      // Refresh user data to pick up email_verified = true
      fetchUserProfile();
    } else {
      showNotification(data.error || 'Verification failed. Please request a new link.', 'error');
    }
  })
  .catch(() => showNotification('Network error. Please try again.', 'error'));
}

function capturePractitionerInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const invite = params.get('invite');
  if (!invite) return;

  sessionStorage.setItem(PENDING_PRACTITIONER_INVITE_KEY, invite);
  params.delete('invite');
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
  window.history.replaceState({}, '', next);
}

// Phase 2B: Capture practitioner referral from ?ref= URL param
function captureReferralFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (!ref) return;

  // Validate: slug format only
  if (!/^[a-z0-9-]+$/.test(ref)) return;

  sessionStorage.setItem('pending_practitioner_ref', ref);

  // Clean URL
  params.delete('ref');
  const cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  window.history.replaceState({}, '', cleanUrl);

  // Show welcome banner
  showReferralBanner(ref);
}

// ── Referral Landing Upgrade (4.7) ── Full “Meet Practitioner” modal ────────
async function showReferralBanner(refSlug) {
  let p = null;
  try {
    const data = await apiFetch(`/api/directory/${encodeURIComponent(refSlug)}`);
    if (data?.practitioner) p = data.practitioner;
  } catch { /* silent */ }

  const practName     = p?.display_name || 'Your Practitioner';
  const photoUrl      = p?.photo_url;
  const bio           = p?.bio ? (p.bio.length > 200 ? p.bio.slice(0, 200) + '\u2026' : p.bio) : '';
  const specs         = Array.isArray(p?.specializations) ? p.specializations.slice(0, 3) : [];
  const certification = p?.certification || '';
  const bookingUrl    = p?.booking_url;

  trackEvent('referral', 'referral_landing_viewed', refSlug);

  document.getElementById('referral-landing-modal')?.remove();

  const avatarHtml = photoUrl && /^https?:\/\//i.test(photoUrl)
    ? `<img src="${escapeAttr(photoUrl)}" alt="${escapeAttr(practName)}" style="width:88px;height:88px;border-radius:50%;object-fit:cover;border:3px solid var(--gold);display:block;margin:0 auto" loading="lazy">`
    : `<div aria-hidden="true" style="width:88px;height:88px;border-radius:50%;background:var(--bg3);border:3px solid var(--gold);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:2rem;color:var(--gold)">${escapeHtml(practName.charAt(0).toUpperCase())}</div>`;

  const certHtml = certification
    ? `<p style="text-align:center;margin:0.25rem 0"><span style="display:inline-block;background:var(--bg3);border:1px solid var(--gold);border-radius:20px;padding:2px 10px;font-size:0.7rem;color:var(--gold)">${escapeHtml(certification)}</span></p>`
    : '';

  const specPills = specs
    .map(s => `<span style="display:inline-block;background:var(--bg3);border-radius:12px;padding:2px 10px;font-size:0.75rem;margin:2px">${escapeHtml(s)}</span>`)
    .join('');
  const specHtml = specPills ? `<div style="text-align:center;margin:0.5rem 0">${specPills}</div>` : '';

  const bioHtml = bio
    ? `<p style="color:var(--text-dim);font-size:0.9rem;text-align:center;margin:0.75rem 0">${escapeHtml(bio)}</p>`
    : '';

  const bookBtnHtml = bookingUrl && /^https?:\/\//i.test(bookingUrl)
    ? `<a href="${escapeAttr(bookingUrl)}" target="_blank" rel="noopener noreferrer" class="btn-secondary" id="ref-book-btn" style="display:block;text-align:center;text-decoration:none;margin-top:0.5rem">Book a Session with ${escapeHtml(practName)} →</a>`
    : '';

  const overlay = document.createElement('div');
  overlay.id = 'referral-landing-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `Meet ${practName}`);
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.innerHTML = `
    <div style="background:var(--bg2);border-radius:16px;padding:2rem;max-width:440px;width:100%;max-height:90vh;overflow-y:auto;position:relative">
      <button id="ref-close-x" style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1.25rem;line-height:1" aria-label="Close">×</button>
      ${avatarHtml}
      <h2 style="text-align:center;margin:0.75rem 0 0;color:var(--gold)">${escapeHtml(practName)}</h2>
      ${certHtml}
      ${specHtml}
      ${bioHtml}
      <p style="text-align:center;font-size:0.8rem;color:var(--text-dim);margin:0.5rem 0 1.25rem">Referred by <strong>${escapeHtml(practName)}</strong></p>
      <button id="ref-cta-btn" class="btn-primary" style="width:100%">Get Your Free Chart →</button>
      ${bookBtnHtml}
      <p style="text-align:center;margin-top:1rem"><button id="ref-maybe-btn" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.85rem">Maybe Later</button></p>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => document.getElementById('referral-landing-modal')?.remove();
  overlay.querySelector('#ref-close-x').addEventListener('click', close);
  overlay.querySelector('#ref-maybe-btn').addEventListener('click', close);
  overlay.querySelector('#ref-cta-btn').addEventListener('click', () => {
    trackEvent('referral', 'referral_landing_converted', refSlug);
    trackEvent('viral', 'viral_chain_converted', refSlug); // WC-P1-2
    close();
    const chartSection = document.getElementById('chart-section')
      || document.querySelector('[data-section="chart"]')
      || document.querySelector('.chart-form');
    chartSection?.scrollIntoView({ behavior: 'smooth' });
  });
}

// Phase 2C: Check and show referral prompt after chart rendering
function checkAndShowReferralPrompt() {
  const refSlug = sessionStorage.getItem('pending_practitioner_ref');
  if (!refSlug) return;

  // Only show once per session
  if (sessionStorage.getItem('referral_prompt_shown')) return;
  sessionStorage.setItem('referral_prompt_shown', '1');

  (async () => {
    let practName = 'your practitioner';
    let bookingUrl = null;
    try {
      const data = await apiFetch(`/api/directory/${encodeURIComponent(refSlug)}`);
      if (data?.practitioner?.display_name) {
        practName = data.practitioner.display_name;
        bookingUrl = data.practitioner.booking_url;
      }
    } catch { /* silent */ }

    const actionsHtml = [
      bookingUrl && /^https?:\/\//i.test(bookingUrl)
        ? `<a href="${escapeAttr(bookingUrl)}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="display:block;text-align:center;text-decoration:none">Book a Session with ${escapeHtml(practName)} →</a>`
        : '',
      `<button class="btn-secondary" style="width:100%;margin-top:0.5rem" onclick="closeReferralModal()">Continue Exploring →</button>`
    ].filter(Boolean).join('');

    showSimpleModal(
      'Your chart is ready',
      `<p style="text-align:center"><strong style="color:var(--gold)">${escapeHtml(practName)}</strong> can walk you through what this means — your specific type, authority, and what to do with it in your actual life right now.</p>`,
      actionsHtml
    );
  })();
}

function showSimpleModal(title, bodyHtml, actionsHtml) {
  document.getElementById('referral-prompt-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'referral-prompt-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.innerHTML = `<div style="background:var(--bg2);border-radius:12px;padding:2rem;max-width:420px;width:100%">
    <h3 style="text-align:center;margin:0 0 1rem">${escapeHtml(title)}</h3>
    ${bodyHtml}
    <div style="margin-top:1.5rem">${actionsHtml}</div>
  </div>`;
  document.body.appendChild(overlay);
}

function closeReferralModal() {
  document.getElementById('referral-prompt-modal')?.remove();
}

// ── Gift-a-Reading recipient flow (4.6) ──────────────────────
function captureGiftFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('gift');
  if (!token) return;

  // Validate token format before hitting the API
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(token)) return;

  // Clean URL immediately
  params.delete('gift');
  const cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  window.history.replaceState({}, '', cleanUrl);

  // Show gift modal async
  (async () => {
    try {
      const data = await apiFetch(`/api/gift/${encodeURIComponent(token)}`);
      if (!data || data.error) return;

      const practName = escapeHtml(data.practitionerName || 'A practitioner');
      const msg = data.message ? `<p style="text-align:center;font-style:italic;color:var(--text-dim)">"${escapeHtml(data.message)}"</p>` : '';

      if (data.redeemedAt) {
        showSimpleModal(
          '🎁 Gift Already Redeemed',
          `<p style="text-align:center">This gift from <strong style="color:var(--gold)">${practName}</strong> has already been claimed.<br>Ask them for a new gift link!</p>${msg}`,
          `<button class="btn-secondary" onclick="closeReferralModal()">Close</button>`,
        );
        return;
      }

      if (data.expired) {
        showSimpleModal(
          '🎁 Gift Link Expired',
          `<p style="text-align:center">This gift from <strong style="color:var(--gold)">${practName}</strong> has expired.<br>Ask them for a fresh link!</p>${msg}`,
          `<button class="btn-secondary" onclick="closeReferralModal()">Close</button>`,
        );
        return;
      }

      // Not yet redeemed — offer to claim
      const redeemBtn = window._authUser
        ? `<button class="btn-primary" onclick="redeemGift('${token.replace(/'/g, '')}')">Claim Your Gift</button>`
        : `<button class="btn-primary" onclick="closeReferralModal();document.getElementById('loginBtn')?.click()">Log in to Claim</button>`;

      showSimpleModal(
        '🎁 You\'ve Received a Gift!',
        `<p style="text-align:center"><strong style="color:var(--gold)">${practName}</strong> has gifted you a free chart reading.<br>Claim it to get your personalised Human Design blueprint!</p>${msg}`,
        `${redeemBtn}<button class="btn-secondary" style="margin-top:0.75rem" onclick="closeReferralModal()">Maybe Later</button>`,
      );

      if (typeof trackEvent === 'function') trackEvent('gift', 'gift_landing_viewed', token.slice(0, 8));
    } catch { /* silent — don't interrupt the app for a bad gift link */ }
  })();
}

async function redeemGift(token) {
  closeReferralModal();
  try {
    const data = await apiFetch(`/api/gift/${encodeURIComponent(token)}/redeem`, { method: 'POST' });
    if (data?.ok) {
      showNotification('🎁 Gift redeemed! Your free reading is ready.', 'success');
      if (typeof trackEvent === 'function') trackEvent('gift', 'gift_redeemed');
    } else {
      showNotification(data?.error || 'Could not redeem gift', 'error');
    }
  } catch {
    showNotification('Error redeeming gift', 'error');
  }
}
window.redeemGift = redeemGift;

function getPendingPractitionerInviteToken() {
  return sessionStorage.getItem(PENDING_PRACTITIONER_INVITE_KEY);
}

function clearPendingPractitionerInviteToken() {
  sessionStorage.removeItem(PENDING_PRACTITIONER_INVITE_KEY);
}

function capturePostCheckoutIntentFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const destination = params.get('post_checkout');
  const onboarding = params.get('onboarding');
  
  if (!destination && !onboarding) return;

  const safeDestinations = new Set(['overview', 'practitioner']);
  if (destination && safeDestinations.has(destination)) {
    sessionStorage.setItem(POST_CHECKOUT_DESTINATION_KEY, destination);
    const tier = params.get('tier');
    if (tier) sessionStorage.setItem(POST_CHECKOUT_TIER_KEY, tier);
  }

  if (onboarding === 'practitioner') {
    sessionStorage.setItem(PRACTITIONER_ONBOARDING_KEY, '1');
  }

  params.delete('post_checkout');
  params.delete('tier');
  params.delete('onboarding');
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
  window.history.replaceState({}, '', next);
}

function normalizeCurrentTierName(tier) {
  if (tier === 'guide') return 'practitioner';
  if (tier === 'white_label') return 'agency';
  return tier || 'free';
}

function clearPendingPostCheckoutIntent() {
  sessionStorage.removeItem(POST_CHECKOUT_DESTINATION_KEY);
  sessionStorage.removeItem(POST_CHECKOUT_TIER_KEY);
  sessionStorage.removeItem(PRACTITIONER_ONBOARDING_KEY);
}

async function applyPendingPostCheckoutIntent() {
  const destination = sessionStorage.getItem(POST_CHECKOUT_DESTINATION_KEY);
  const shouldShowOnboarding = sessionStorage.getItem(PRACTITIONER_ONBOARDING_KEY);
  
  if (!destination && !shouldShowOnboarding) return false;
  if (!currentUser) return false;

  const currentTier = normalizeCurrentTierName(currentUser?.tier);
  const hintedTier = normalizeCurrentTierName(sessionStorage.getItem(POST_CHECKOUT_TIER_KEY));
  const effectiveTier = currentTier !== 'free' ? currentTier : hintedTier;

  if (shouldShowOnboarding === '1' && ['practitioner', 'agency'].includes(effectiveTier)) {
    requestAnimationFrame(() => {
      switchTab('practitioner');
      showNotification('Practitioner plan active. Let\'s set up your profile!', 'success');
      setTimeout(showPractitionerOnboarding, 800);
    });
    clearPendingPostCheckoutIntent();
    return true;
  }

  if (destination === 'practitioner') {
    if (effectiveTier !== 'practitioner' && effectiveTier !== 'agency') return false;

    requestAnimationFrame(() => {
      switchTab('practitioner');
      showNotification('Practitioner plan active. Your workspace is ready.', 'success');
      // Phase 6: Show onboarding if this is the first time they've upgraded to practitioner
      if (['practitioner', 'guide', 'agency', 'white_label'].includes(currentUser?.tier) && !localStorage.getItem('pract_onb_seen')) {
        setTimeout(showPractitionerOnboarding, 1500);
      }
    });
    clearPendingPostCheckoutIntent();
    return true;
  }

  if (destination === 'overview' && effectiveTier !== 'free') {
    requestAnimationFrame(() => {
      switchTab('overview', document.getElementById('btn-home'));
      showNotification('Your plan is active.', 'success');
    });
    clearPendingPostCheckoutIntent();
    return true;
  }

  return false;
}

async function processPendingPractitionerInvite(options = {}) {
  const inviteToken = getPendingPractitionerInviteToken();
  if (!inviteToken) return;

  // Check if user is authenticated
  const isAuthenticated = !!window.token;
  if (!isAuthenticated) {
    if (options.promptForAuth === true) {
      const preview = await apiFetch(`/api/invitations/practitioner?token=${encodeURIComponent(inviteToken)}`);
      if (preview?.error) {
        clearPendingPractitionerInviteToken();
        showNotification(preview.error, 'error');
        return;
      }

      const practitionerName = preview?.invitation?.practitioner_name || 'your practitioner';
      showNotification(`Invitation detected from ${practitionerName}. Sign in or create an account with the invited email to accept it.`, 'info');
      openAuthOverlay();
    }
    return;
  }

  // Show loading state while accepting invitation
  const acceptBtn = document.querySelector('[data-action="practOnbSendInvite"]');
  const originalText = acceptBtn?.textContent;
  if (acceptBtn) {
    acceptBtn.disabled = true;
    acceptBtn.textContent = 'Processing invitation...';
  }

  const result = await apiFetch('/api/invitations/practitioner/accept', {
    method: 'POST',
    body: JSON.stringify({ token: inviteToken })
  });

  // Restore button state
  if (acceptBtn) {
    acceptBtn.disabled = false;
    acceptBtn.textContent = originalText;
  }

  if (result?.error) {
    if (/expired|not found|no longer active/i.test(result.error)) {
      clearPendingPractitionerInviteToken();
    }
    showNotification(result.error, 'error');
    return;
  }

  clearPendingPractitionerInviteToken();
  showNotification(`✅ Invitation accepted! You are now linked with ${result?.practitioner?.name || 'your practitioner'}.`, 'success');
  
  // Redirect to practitioner's profile or dashboard after a brief delay
  setTimeout(() => {
    window.location.pathname = '/';
    window.location.hash = '#practitioner-dashboard';
  }, 1500);
}

// Persistent banner shown when email is not verified
function showEmailVerificationBanner() {
  if (document.getElementById('emailVerifyBanner')) return; // already showing
  const banner = document.createElement('div');
  banner.id = 'emailVerifyBanner';
  banner.setAttribute('role', 'alert');
  banner.style.cssText = 'background:#2a1f00;color:#c9a84c;padding:12px 16px;text-align:center;font-size:14px;border-bottom:1px solid #c9a84c33;position:sticky;top:0;z-index:9999;';
  banner.innerHTML = '✉️ Please verify your email to unlock AI features. Check your inbox or <button id="resendVerifyBtn" style="background:none;border:none;color:#c9a84c;text-decoration:underline;cursor:pointer;font-size:14px;padding:0">resend verification email</button>.';
  document.body.prepend(banner);
  document.getElementById('resendVerifyBtn').addEventListener('click', resendVerificationEmail);
}

function hideEmailVerificationBanner() {
  const banner = document.getElementById('emailVerifyBanner');
  if (banner) banner.remove();
}

async function resendVerificationEmail() {
  const btn = document.getElementById('resendVerifyBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    const res = await fetch(API + '/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) {
      showNotification('Failed to resend. Please try again.', 'error');
      return;
    }
    const data = await res.json();
    if (data.ok) {
      showNotification(data.message || 'Verification email sent!', 'success');
    } else {
      showNotification(data.error || 'Failed to resend. Please try again.', 'error');
    }
  } catch {
    showNotification('Network error. Please try again.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'resend verification email'; }
  }
}

async function submitAuth() {
  // Route to forgot/reset handlers if in those modes
  if (authMode === 'forgot') return submitForgotPassword();
  if (authMode === 'reset') return submitResetPassword();

  const emailEl = document.getElementById('authEmail');
  const passwordEl = document.getElementById('authPassword');
  const email = emailEl.value.trim();
  const password = passwordEl.value;
  const errorEl = document.getElementById('authError');
  const btn = document.getElementById('authSubmit');
  const _t = typeof window.t === 'function' ? window.t : (k) => k.split('.').pop();

  // Clear previous validation states
  emailEl.removeAttribute('aria-invalid');
  passwordEl.removeAttribute('aria-invalid');
  errorEl.textContent = '';

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    emailEl.setAttribute('aria-invalid', 'true');
    errorEl.textContent = _t('auth.emailRequired');
    emailEl.focus();
    return;
  }
  if (!emailRegex.test(email)) {
    emailEl.setAttribute('aria-invalid', 'true');
    errorEl.textContent = 'Please enter a valid email address';
    emailEl.focus();
    return;
  }
  if (!password) {
    passwordEl.setAttribute('aria-invalid', 'true');
    errorEl.textContent = _t('auth.passwordRequired') || 'Password is required';
    passwordEl.focus();
    return;
  }
  if (password.length < 8) {
    passwordEl.setAttribute('aria-invalid', 'true');
    errorEl.textContent = 'Password must be at least 8 characters';
    passwordEl.focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = _t('auth.pleaseWait');
  errorEl.textContent = '';

  try {
    const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
    // P0-FIX: Include stored referral slug so backend can record attribution
    const authBody = { email, password };
    if (authMode === 'register') {
      const pendingRef = (localStorage.getItem('ps_pending_ref') || '').toLowerCase();
      if (pendingRef) authBody.ref = pendingRef;
    }
    // Use raw fetch here — not apiFetch — so a 401 doesn't trigger the auto-logout loop
    const rawRes = await fetch(API + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(authBody)
    });
    const res = await rawRes.json();
    if (!rawRes.ok || res.error) {
      // Mark fields invalid on server error
      emailEl.setAttribute('aria-invalid', 'true');
      passwordEl.setAttribute('aria-invalid', 'true');
      errorEl.textContent = res.error || 'Login failed';
      return;
    }

    // ── 2FA challenge: password valid but TOTP required ──────────
    if (res.requires_2fa && res.pending_token) {
      window._totpPendingToken = res.pending_token;
      // Hide standard login elements, show TOTP step
      document.getElementById('authTOTPStep').style.display = 'block';
      document.querySelector('#authOverlay form[data-action="submitAuth"]').style.display = 'none';
      document.getElementById('forgotPasswordLink').style.display = 'none';
      document.querySelector('.auth-divider') && (document.querySelector('.auth-divider').style.display = 'none');
      document.querySelector('.auth-social-list') && (document.querySelector('.auth-social-list').style.display = 'none');
      document.querySelector('.auth-toggle') && (document.querySelector('.auth-toggle').style.display = 'none');
      document.getElementById('authTOTPCode').value = '';
      document.getElementById('authTOTPError').textContent = '';
      document.getElementById('authTOTPCode').focus();
      return;
    }
    // ────────────────────────────────────────────────────────────
    // Store tokens — access token in memory only; refresh token is an HttpOnly cookie set by API
    token = res.accessToken;
    _scheduleTokenRefresh(token);
    userEmail = email;
    sessionStorage.setItem('ps_email', email);
    localStorage.setItem('ps_session', '1');
    // Legacy cleanup: remove any old token that was previously stored in localStorage
    localStorage.removeItem('ps_token');
    // Apply pending referral code (if user arrived via a ?ref= link)
    if (authMode === 'register') {
      trackEvent('auth', 'register', 'email');
      const pendingRef = localStorage.getItem('ps_pending_ref');
      if (pendingRef) {
        fetch(API + '/api/referrals/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code: pendingRef })
        }).then(res => {
          if (res.ok) localStorage.removeItem('ps_pending_ref');
          else console.warn('Referral apply failed, will retry next login');
        }).catch(() => console.warn('Referral apply network error, will retry next login'));
      }
    } else {
      trackEvent('auth', 'login', 'email');
    }
    updateAuthUI();
    closeAuthOverlay();
    // Fetch subscription/tier info now that we have a valid token
    await fetchUserProfile();
    await processPendingPractitionerInvite();
    await applyPendingPostCheckoutIntent();
    // AUDIT-SEC-003: Show verification banner after registration
    if (authMode === 'register') {
      showEmailVerificationBanner();
    }
    // Prompt for push notifications on first auth (deferred, non-blocking)
    if ('Notification' in window && Notification.permission === 'default' && !localStorage.getItem('ps_push_prompted')) {
      localStorage.setItem('ps_push_prompted', '1');
      setTimeout(() => requestPushPermission(), 3000);
    }
  } catch (e) {
    errorEl.textContent = _t('auth.connectionError', { message: e.message });
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === 'register' ? _t('auth.createAccount') : _t('auth.signIn');
  }
}

function logout() {
  if (!confirm('Are you sure you want to log out?')) return;
  const previousScopeId = getJourneyScopeId();
  const oldToken = token;
  token = null; userEmail = null;
  currentUser = null;
  // P2-FE-009: Clear in-memory caches to prevent stale data on re-login
  _allCelebrityMatches = [];
  currentCluster = null;
  currentDiaryEdit = null;
  activePromoCode = null;
  window._lastChart = null;
  window._lastForge = null;
  // Clear rendered DOM so a second login on the same tab never sees a prior user's data
  const _chartEl = document.getElementById('chartResult');
  if (_chartEl) _chartEl.innerHTML = '';
  const _profileEl = document.getElementById('profileResult');
  if (_profileEl) _profileEl.innerHTML = '';
  _tokenExpiresAt = 0;
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
  localStorage.removeItem('ps_token');    // legacy
  localStorage.removeItem('ps_session');
  localStorage.removeItem('ps_email');   // legacy cleanup
  localStorage.removeItem('accessToken'); // CISO-001: scrub any previously-leaked token
  sessionStorage.removeItem('ps_email');
  localStorage.removeItem('primeSelf_birthData');
  clearJourneyStateForScope(previousScopeId);
  localStorage.removeItem('user');
  // Revoke all server-side refresh tokens and clear the HttpOnly cookie
  fetch(API + '/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  }).catch(() => {});
  // Clear cached API responses from service worker
  if ('caches' in window) {
    caches.keys().then(names => names.forEach(name => {
      if (name.startsWith('prime-self-')) caches.delete(name);
    }));
  }
  updateAuthUI();
}

async function deleteAccount() {
  if (!confirm('⚠️ This will permanently delete your account and ALL your data (charts, check-ins, diary entries). This action CANNOT be undone.\n\nAre you sure?')) return;
  // P2-FE-010: Use masked password input instead of prompt()
  const password = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div style="background:var(--bg-card,#1a1a2e);padding:var(--space-6,24px);border-radius:12px;max-width:360px;width:90%;">
      <h3 style="margin:0 0 12px;color:var(--text-primary,#fff);">Confirm Deletion</h3>
      <p style="margin:0 0 12px;color:var(--text-secondary,#ccc);font-size:var(--font-size-sm,14px);">Enter your password to permanently delete your account:</p>
      <input id="_delPwInput" type="password" placeholder="Password" style="width:100%;padding:8px 12px;border:1px solid var(--border-color,#333);border-radius:6px;background:var(--bg-input,#0f0f1a);color:var(--text-primary,#fff);margin-bottom:12px;box-sizing:border-box;">
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="_delCancel" class="btn-secondary" style="padding:6px 16px;">Cancel</button>
        <button id="_delConfirm" class="btn-danger" style="padding:6px 16px;">Delete</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    const inp = document.getElementById('_delPwInput');
    inp.focus();
    const cleanup = v => { document.body.removeChild(overlay); resolve(v); };
    document.getElementById('_delCancel').onclick = () => cleanup(null);
    document.getElementById('_delConfirm').onclick = () => cleanup(inp.value);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') cleanup(inp.value); if (e.key === 'Escape') cleanup(null); });
  });
  if (!password) return;
  try {
    const result = await apiFetch('/api/auth/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (result?.error) {
      showNotification(result.error || 'Failed to delete account', 'error');
      return;
    }
    showNotification('Account deleted successfully.', 'success');
    logout();
  } catch (e) {
    showNotification('Error deleting account. Please try again.', 'error');
  }
}

async function exportMyData() {
  try {
    showNotification('Preparing your data export...', 'info');
    // Use raw fetch here (not apiFetch) because this endpoint returns a binary blob,
    // not JSON — apiFetch calls res.json() which would fail for file downloads.
    // Authentication is via the ps_access HttpOnly cookie (credentials: 'include').
    const res = await fetch(API + '/api/auth/export', { credentials: 'include' });
    if (!res.ok) {
      let errMsg = 'Failed to export data';
      try {
        const errJson = await res.json();
        errMsg = errJson.error || errMsg;
      } catch {}
      showNotification(errMsg, 'error');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'prime-self-data-export.json'; a.click();
    URL.revokeObjectURL(url);
    showNotification('Data export downloaded!', 'success');
  } catch (e) {
    showNotification('Error exporting data. Please try again.', 'error');
  }
}

// ── Pricing Modals ─────────────────────────────────────────
// Consumer modal (Free + Explorer) — for free/regular tier users
// Professional modal (Guide + Studio) — for practitioner/white_label users
// These two audiences never see each other's pricing. See IMPLEMENTATION_PLAN.md.

function openPricingModal(suggestedTier = null) {
  // ACC-P2-8: Store trigger element for focus restoration on close
  storeModalTrigger('pricingOverlay');

  if (!token) {
    openAuthOverlay();
    document.getElementById('authError').textContent = typeof window.t === 'function' ? window.t('auth.signInUpgrade') : 'Sign in to upgrade your plan.';
    return;
  }
  // Route professional tiers to the practitioner modal
  const tier = currentUser?.tier || 'free';
  if (tier === 'practitioner' || tier === 'white_label' || tier === 'guide' || tier === 'agency') {
    openPractitionerPricingModal();
    return;
  }
  // Update card states based on current tier
  _syncConsumerPricingCards(tier);
  document.getElementById('pricingOverlay').classList.remove('hidden');
}

function closePricingModal() {
  document.getElementById('pricingOverlay').classList.add('hidden');
  // P2-FE-001: Clear stale promo code when modal closes
  activePromoCode = null;
  const promoInput = document.getElementById('promoCodeInput');
  const promoResult = document.getElementById('promoCodeResult');
  if (promoInput) promoInput.value = '';
  if (promoResult) promoResult.textContent = '';
  // ACC-P2-8: Restore focus to trigger element
  restoreModalFocus('pricingOverlay');
}

// Sync consumer pricing card button states to match current user tier
function _syncConsumerPricingCards(tier) {
  const freeBtn    = document.getElementById('priceBtn-free');
  const regularBtn = document.getElementById('priceBtn-regular');
  if (!freeBtn || !regularBtn) return;

  if (tier === 'individual' || tier === 'regular' || tier === 'seeker') {
    // Already on Individual
    freeBtn.disabled    = false;
    freeBtn.textContent = 'Downgrade';
    freeBtn.className   = 'btn-secondary tier-cta';
    regularBtn.disabled    = true;
    regularBtn.textContent = 'Current Plan';
    regularBtn.className   = 'btn-secondary tier-cta';
  } else {
    // On free tier
    freeBtn.disabled    = true;
    freeBtn.textContent = 'Current Plan';
    freeBtn.className   = 'btn-secondary tier-cta';
    regularBtn.disabled    = false;
    regularBtn.textContent = 'Upgrade to Individual';
    regularBtn.className   = 'btn-primary tier-cta';
  }
}

// Professional pricing modal (Guide + Studio)
function openPractitionerPricingModal() {
  // ACC-P2-8: Store trigger element for focus restoration on close
  storeModalTrigger('practitionerPricingOverlay');

  if (!token) {
    openAuthOverlay();
    document.getElementById('authError').textContent = typeof window.t === 'function' ? window.t('auth.signInUpgrade') : 'Sign in to view professional plans.';
    return;
  }
  const tier = currentUser?.tier || 'free';
  _syncPractitionerPricingCards(tier);
  document.getElementById('practitionerPricingOverlay').classList.remove('hidden');
}

function closePractitionerPricingModal() {
  document.getElementById('practitionerPricingOverlay').classList.add('hidden');
  // ACC-P2-8: Restore focus to trigger element
  restoreModalFocus('practitionerPricingOverlay');
}

// WC-P0-3: Practitioner hero CTA — fires conversion funnel event then opens pricing modal
function heroPractitionerCta() {
  trackEvent('landing', 'primary_cta_click', 'practitioner_upgrade');
  openPricingModal();
}
window.heroPractitionerCta = heroPractitionerCta;

// Sync practitioner pricing card button states
function _syncPractitionerPricingCards(tier) {
  const practBtn    = document.getElementById('priceBtn-practitioner');
  const studioBtn   = document.getElementById('priceBtn-agency');
  if (!practBtn || !studioBtn) return;

  if (tier === 'agency' || tier === 'white_label') {
    practBtn.disabled    = false;
    practBtn.textContent = 'Downgrade to Practitioner';
    practBtn.className   = 'btn-secondary tier-cta';
    studioBtn.disabled   = true;
    studioBtn.textContent = 'Current Plan';
    studioBtn.className  = 'btn-secondary tier-cta';
  } else if (tier === 'practitioner' || tier === 'guide') {
    practBtn.disabled    = true;
    practBtn.textContent = 'Current Plan';
    practBtn.className   = 'btn-secondary tier-cta';
    studioBtn.disabled   = false;
    studioBtn.textContent = 'Upgrade to Agency';
    studioBtn.className  = 'btn-primary tier-cta';
  } else {
    // Free or individual user arrived here via "For Practitioners" CTA
    practBtn.disabled    = false;
    practBtn.textContent = 'Upgrade to Practitioner';
    practBtn.className   = 'btn-primary tier-cta';
    studioBtn.disabled   = false;
    studioBtn.textContent = 'Upgrade to Agency';
    studioBtn.className  = 'btn-primary tier-cta';
  }
}

// Promo code toggle
function togglePromoInput() {
  const area = document.getElementById('promoInputArea');
  if (!area) return;
  area.style.display = area.style.display === 'none' ? '' : 'none';
  if (area.style.display !== 'none') {
    document.getElementById('promoCodeInput')?.focus();
  }
}

// Applied promo code (stored for checkout)
let activePromoCode = null;
let activeBillingPeriod = 'monthly';

function setBillingPeriod(period, audience) {
  activeBillingPeriod = period;

  // Update toggle button styles
  const isConsumer = audience === 'consumer';
  const monthlyBtn = document.getElementById(isConsumer ? 'consumerBillMonthly' : 'proBillMonthly');
  const annualBtn = document.getElementById(isConsumer ? 'consumerBillAnnual' : 'proBillAnnual');

  if (monthlyBtn && annualBtn) {
    monthlyBtn.classList.toggle('active', period === 'monthly');
    annualBtn.classList.toggle('active', period === 'annual');
  }

  // Update all price amounts in the relevant modal
  const overlay = isConsumer ? document.getElementById('pricingOverlay') : document.getElementById('practitionerPricingOverlay');
  if (!overlay) return;

  overlay.querySelectorAll('.tier-price[data-monthly]').forEach(el => {
    const amount = period === 'annual' ? el.dataset.annual : el.dataset.monthly;
    const amountEl = el.querySelector('.price-amount');
    if (amountEl) amountEl.textContent = amount;
  });

  overlay.querySelectorAll('.billing-label').forEach(el => {
    el.textContent = period === 'annual' ? 'per year' : 'per month';
  });
}

async function applyPromoCode() {
  const input   = document.getElementById('promoCodeInput');
  const result  = document.getElementById('promoCodeResult');
  const code    = input?.value?.trim();
  if (!code) return;
  result.textContent = 'Checking…';
  result.style.color = 'var(--text-dim)';

  try {
    const data = await apiFetch(`/api/promo/validate?code=${encodeURIComponent(code)}`);
    if (data.valid) {
      const savings = data.discount_type === 'percent'
        ? `${data.discount_value}% off`
        : `$${(data.discount_value / 100).toFixed(2)} off`;
      result.textContent = `✓ Code applied — ${savings}`;
      result.style.color = 'var(--accent2)';
      activePromoCode = code;
    } else {
      result.textContent = data.error || 'Invalid or expired code.';
      result.style.color = 'var(--red)';
      activePromoCode = null;
    }
  } catch (e) {
    result.textContent = 'Could not validate code.';
    result.style.color = 'var(--red)';
  }
}


async function startCheckout(tier, event) {
  if (!token) {
    closePricingModal();
    openAuthOverlay();
    return;
  }

  try {
    const checkoutBtn = event ? event.target : null;
    const originalText = checkoutBtn ? checkoutBtn.innerHTML : '';
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.innerHTML = '<span class="spinner" style="border-top-color:#0a0a0f"></span> ' + window.t('auth.creatingSession');
    }

    const checkoutBody = { tier };
    if (activePromoCode) checkoutBody.promoCode = activePromoCode;
    if (activeBillingPeriod === 'annual') checkoutBody.billingPeriod = 'annual';

    trackEvent('billing', 'checkout_start', tier);

    const result = await apiFetch('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify(checkoutBody)
    });

    if (result.error) {
      showNotification('Checkout failed: ' + safeErrorMsg(result.error, 'Unable to start checkout'), 'error');
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = originalText;
      }
      return;
    }

    // CFO-001: Agency tier requires consultation — redirect to contact email
    if (result.contactRequired) {
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = originalText;
      }
      window.location.href = 'mailto:' + result.contactEmail + '?subject=Agency%20Tier%20Inquiry';
      return;
    }

    if (result.url) {
      // BL-FIX: Validate redirect URL to prevent open redirect
      try {
        const redirectUrl = new URL(result.url);
        if (redirectUrl.hostname.endsWith('.stripe.com')) {
          window.location.href = result.url;
        } else {
          console.error('Invalid checkout URL:', redirectUrl.hostname);
          showNotification('Invalid checkout redirect. Please try again.', 'error');
        }
      } catch {
        showNotification('Invalid checkout URL received.', 'error');
      }
    }
  } catch (e) {
    showNotification('Failed to start checkout. Please try again.', 'error');
  }
}

async function openBillingPortal() {
  if (!token) {
    openAuthOverlay();
    return;
  }

  try {
    const preview = await apiFetch('/api/billing/cancel', {
      method: 'POST'
      , body: JSON.stringify({ previewOnly: true })
    });

    if (!preview?.ok) {
      showNotification('Failed to load billing options: ' + (preview?.error || 'Unknown error'), 'error');
      return;
    }

    const retentionOffer = preview.retentionOffer;
    const subscriptionTier = preview.subscription?.tier || currentUser?.tier || 'individual';

    if (retentionOffer) {
      const acceptDowngrade = confirm(
        `${retentionOffer.message}\n\nPress OK to switch now. Press Cancel for more billing options.`
      );

      if (acceptDowngrade) {
        const downgradeResult = await apiFetch(retentionOffer.upgradeEndpoint || '/api/billing/upgrade', {
          method: 'POST',
          body: JSON.stringify({ tier: retentionOffer.targetTier })
        });

        if (downgradeResult?.contactRequired) {
          window.location.href = 'mailto:' + downgradeResult.contactEmail + '?subject=Agency%20Tier%20Inquiry';
          return;
        }

        if (downgradeResult?.error) {
          showNotification('Failed to change plan: ' + downgradeResult.error, 'error');
          return;
        }

        await fetchUserProfile();
        updateAuthUI();
        showNotification(
          subscriptionTier === 'practitioner'
            ? 'Downgraded to Individual. Your subscription stays active through the current period.'
            : 'Downgraded to Free. Your subscription stays active through the current period.',
          'success'
        );
        return;
      }

      const scheduleCancel = confirm(
        'Would you rather cancel at the end of your current billing period?\n\nPress OK to schedule cancellation. Press Cancel to open the Stripe billing portal.'
      );

      if (scheduleCancel) {
        const cancelResult = await apiFetch('/api/billing/cancel', {
          method: 'POST',
          body: JSON.stringify({ immediately: false })
        });

        if (cancelResult?.error) {
          showNotification('Failed to cancel subscription: ' + cancelResult.error, 'error');
          return;
        }

        const periodEnd = cancelResult?.periodEnd
          ? new Date(cancelResult.periodEnd).toLocaleDateString()
          : 'the current billing period';
        showNotification(`Subscription will cancel at period end (${periodEnd}).`, 'success');
        return;
      }
    }

    const result = await apiFetch('/api/billing/portal', {
      method: 'POST'
    });

    if (result.error) {
      showNotification('Failed to open billing portal: ' + safeErrorMsg(result.error, 'Unable to open billing portal'), 'error');
      return;
    }

    if (result.url) {
      // P2-SEC-010: Validate URL comes from Stripe before opening
      try {
        const portalUrl = new URL(result.url);
        if (!portalUrl.hostname.endsWith('.stripe.com')) {
          showNotification('Invalid billing portal URL', 'error');
          return;
        }
      } catch {
        showNotification('Invalid billing portal URL', 'error');
        return;
      }
      window.open(result.url, '_blank', 'noopener');
    }
  } catch (e) {
    showNotification('Failed to open billing portal: ' + e.message, 'error');
  }
}

// BL-EXC-P1-3: Feature-specific upgrade copy for highest-value conversion path (Individual→Practitioner)
const PRACTITIONER_UPGRADE_COPY = {
  composite: {
    headline: 'Composite charts reveal what one chart can\'t show.',
    body: 'See how two people\'s energy centers merge, bridge, and amplify. Used by relationship coaches, family constellators, and partnership advisors.',
    roi: '2 composite sessions at $75 pays for the month. Cancel anytime.'
  },
  client_roster: {
    headline: 'Your client list is a practice asset.',
    body: 'Track every session, store birth data, and prepare before each call — all in one place designed for HD professionals.',
    roi: 'Average practitioner saves 4 hrs/week on session prep. Pays for itself in week 1.'
  },
  clients: {
    headline: 'Your client list is a practice asset.',
    body: 'Track every session, store birth data, and prepare before each call — all in one place designed for HD professionals.',
    roi: 'Average practitioner saves 4 hrs/week on session prep. Pays for itself in week 1.'
  },
  session_brief: {
    headline: 'Know what each client needs before they walk in.',
    body: 'AI session briefs surface the top 3 design tensions active for your client right now — so you arrive prepared, not reactive.',
    roi: 'One better-prepared session per week = $50–200 more in referrals. Covered.'
  },
  pdf: {
    headline: 'Branded PDF reports your clients keep forever.',
    body: 'Send a polished, white-labeled chart report after every session. Clients share them — your name spreads.',
    roi: 'Reports become referral tools. Each one is marketing you\'ve already paid for.'
  },
  practitionerTools: {
    headline: 'The full practitioner toolkit in one place.',
    body: 'Sessions, clients, composites, reports, and your own referral link — everything a professional HD practice needs.',
    roi: '2 clients at $50/session covers it. Join 200+ practitioners already running their practice here.'
  },
  whiteLabel: {
    headline: 'Your brand. Your client portal. Your practice.',
    body: 'White-label the entire client experience — your logo, your domain, your voice. Looks like yours, powered by Prime Self.',
    roi: 'Agency plan: 5 practitioner seats means your team scales without extra tooling costs.'
  },
  calendarTransits: {
    headline: 'See transits on your calendar — timing is everything.',
    body: 'Transit and retrograde events appear right in your calendar so you can plan around planetary influences.',
    roi: 'Individual plan unlocks transit calendar plus unlimited AI questions. $19/mo.'
  },
  calendarSync: {
    headline: 'Sync your Prime Self calendar with Google Calendar.',
    body: '2-way sync keeps your sessions, moon phases, and transits visible everywhere — no manual copying.',
    roi: 'Practitioner plan includes sync, session tools, and unlimited client management.'
  },
  calendarSessions: {
    headline: 'Session events on your calendar.',
    body: 'Track client sessions alongside transits and moon phases. See everything in one unified view.',
    roi: 'Practitioner plan: manage clients, run sessions, export PDFs — all for $97/mo.'
  },
  calendarPractitioner: {
    headline: 'See all your clients\' calendars at a glance.',
    body: 'The unified practitioner calendar shows every client\'s events color-coded and merged with your own. Spot patterns, plan sessions, stay on top of your practice.',
    roi: '2 clients at $50/session covers it. Join 200+ practitioners already running their practice here.'
  }
};

// Helper to show upgrade modal on quota/feature errors
// Routes free → Individual (consumer modal) and Individual → Practitioner (pro modal)
function showUpgradePrompt(message, feature) {
  const practitionerFeatures = ['practitionerTools', 'whiteLabel', 'clients', 'composite', 'pdf', 'client_roster', 'session_brief', 'calendarSync', 'calendarSessions', 'calendarPractitioner'];
  if (feature && practitionerFeatures.includes(feature)) {
    // Inject context-aware copy before opening (BL-EXC-P1-3)
    const copy = PRACTITIONER_UPGRADE_COPY[feature];
    const banner = document.getElementById('upgradeContextBanner');
    if (copy && banner) {
      document.getElementById('upgradeContextHeadline').textContent = copy.headline;
      document.getElementById('upgradeContextBody').textContent = copy.body;
      document.getElementById('upgradeContextROI').textContent = copy.roi;
      banner.classList.remove('hidden');
    } else if (banner) {
      banner.classList.add('hidden');
    }
    // Analytics: log which feature triggered the upgrade prompt
    try {
      if (typeof gtag === 'function') {
        gtag('event', 'upgrade_prompt_shown', { feature, tier: currentUser?.tier || 'free' });
      }
    } catch (_) { /* non-blocking */ }
    openPractitionerPricingModal();
  } else {
    const banner = document.getElementById('upgradeContextBanner');
    if (banner) banner.classList.add('hidden');
    openPricingModal();
  }
}

// ── API Fetch ─────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const needsBody = ['POST', 'PUT', 'PATCH'].includes((options.method || 'GET').toUpperCase());
  const headers = { ...(needsBody ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  // Prefer the HttpOnly cookie, but send the in-memory bearer token as a compatibility
  // fallback for browsers / embedded webviews that block or delay third-party cookies.
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(API + path, { ...options, headers, credentials: 'include' });
  } catch (err) {
    const isNetwork = err instanceof TypeError;
    const msg = isNetwork
      ? 'Network/CORS error: unable to reach API. Check API deployment and allowed origins.'
      : (err?.message || 'Request failed');
    return { ok: false, error: msg };
  }

  const requestId = res.headers.get('X-Request-ID') || res.headers.get('x-request-id') || '';

  function withRequestId(result) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) return result;
    if (requestId && !result.requestId) result.requestId = requestId;
    if (!res.ok && res.status >= 500 && requestId && typeof result.error === 'string' && !result.error.includes(requestId)) {
      result.error = `${result.error}${formatRequestIdSuffix(requestId)}`;
    }
    return result;
  }

  // Auto-handle expired / missing token — try silent refresh once, then force sign-in
  if (res.status === 401) {
    const refreshed = await silentRefresh();
    if (refreshed) {
      // Retry original request — new ps_access cookie was set by silentRefresh
      const retryHeaders = { ...(needsBody ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
      try {
        const retryRes = await fetch(API + path, { ...options, headers: retryHeaders, credentials: 'include' });
        if (retryRes.status !== 401) {
          const retryRequestId = retryRes.headers.get('X-Request-ID') || retryRes.headers.get('x-request-id') || '';
          const retryPayload = await retryRes.json();
          if (retryRequestId && retryPayload && typeof retryPayload === 'object' && !Array.isArray(retryPayload)) {
            retryPayload.requestId = retryPayload.requestId || retryRequestId;
            if (!retryRes.ok && retryRes.status >= 500 && typeof retryPayload.error === 'string' && !retryPayload.error.includes(retryRequestId)) {
              retryPayload.error = `${retryPayload.error}${formatRequestIdSuffix(retryRequestId)}`;
            }
          }
          return retryPayload;
        }
      } catch (retryErr) {
        return { ok: false, error: 'Network/CORS error on retry.' };
      }
    }
    // Refresh failed — force sign-in
    const previousScopeId = getJourneyScopeId();
    token = null;
    userEmail = null;
    localStorage.removeItem('ps_session');
    localStorage.removeItem('ps_email');   // legacy cleanup
    sessionStorage.removeItem('ps_email');
    clearJourneyStateForScope(previousScopeId);
    currentUser = null;
    updateAuthUI();
    openAuthOverlay();
    document.getElementById('authError').textContent = typeof window.t === 'function' ? window.t('auth.sessionExpired') : 'Session expired. Please sign in.';
    return withRequestId({ error: 'Authentication required. Please sign in.' });
  }

  // Handle quota exceeded (429) and feature not available (403)
  if (res.status === 429 || res.status === 403) {
    const errorData = await res.json();
    // AUDIT-SEC-003: Show verification banner if email not verified
    if (errorData.email_verification_required) {
      showEmailVerificationBanner();
      return errorData;
    }
    // Show upgrade prompt if the error indicates upgrade is needed
    if (errorData.upgrade_required) {
      showUpgradePrompt(errorData.error, errorData.feature);
    }
    return withRequestId(errorData);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    // P2-FE-008: Strip HTML tags to prevent raw HTML rendering in UI
    const safeText = text ? text.replace(/<[^>]*>/g, '').slice(0, 200) : '';
    return {
      ok: res.ok,
      error: safeText || `Unexpected non-JSON response (${res.status})`,
      status: res.status,
      requestId,
    };
  }

  return withRequestId(await res.json());
}

function formatRequestIdSuffix(requestId) {
  return requestId ? ` Reference: ${requestId}.` : '';
}

// ── Tabs ──────────────────────────────────────────────────────
// Tab group mapping: which primary button stays active for each sub-tab
const TAB_GROUPS = {
  overview: 'btn-home',
  chart: 'btn-blueprint', profile: 'btn-blueprint',
  transits: 'btn-today', checkin: 'btn-today', timing: 'btn-today', calendar: 'btn-today',
  composite: 'btn-connect', clusters: 'btn-connect',
  enhance: 'btn-grow', diary: 'btn-grow',
  practitioner: 'btn-practitioner',
  'my-practitioner': null,
  celebrity: null, achievements: null,
  // Settings drawer items — no primary tab highlights
  history: null, sms: null, rectify: null, onboarding: null
};

// Sidebar parent mapping: which parent nav items expand for sub-tabs
const SIDEBAR_PARENTS = {
  chart: 'chart', profile: 'chart',
  transits: 'transits', checkin: 'transits', timing: 'transits', calendar: 'transits',
  composite: 'composite', clusters: 'composite',
  enhance: 'enhance', diary: 'enhance'
};

const JOURNEY_MILESTONE_KEYS = ['chartGenerated', 'profileGenerated', 'transitsViewed'];
const JOURNEY_CHECKIN_META_KEY = 'checkinMeta';
const GUIDED_CORE_TABS = new Set(['overview', 'chart', 'profile', 'transits', 'checkin', 'composite']);
const GUIDED_UNLOCK_KEYS = ['chartGenerated', 'profileGenerated', 'transitsViewed'];

function getJourneyScopeId() {
  const userId = currentUser?.id;
  if (userId) return `uid:${String(userId)}`;
  if (userEmail) return `email:${String(userEmail).trim().toLowerCase()}`;
  return 'anon';
}

function getJourneyStorageKey(key, scopeId = getJourneyScopeId()) {
  return `ps_journey:${scopeId}:${key}`;
}

function readJourneyFlag(key) {
  if (!key) return false;
  try {
    if (localStorage.getItem(getJourneyStorageKey(key)) === '1') return true;
    // Backward compatibility for legacy flat keys.
    return localStorage.getItem(key) === '1';
  } catch (_error) {
    return false;
  }
}

function writeJourneyFlag(key) {
  if (!key) return;
  try {
    localStorage.setItem(getJourneyStorageKey(key), '1');
  } catch (_error) {
    // Storage may be unavailable in strict privacy modes.
  }
}

function clearJourneyFlag(key, scopeId = getJourneyScopeId()) {
  if (!key) return;
  try {
    localStorage.removeItem(getJourneyStorageKey(key, scopeId));
    localStorage.removeItem(key); // legacy cleanup
  } catch (_error) {
    // no-op
  }
}

function getLocalISODate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayLocalISODate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readCheckinMeta() {
  try {
    const raw = localStorage.getItem(getJourneyStorageKey(JOURNEY_CHECKIN_META_KEY));
    if (!raw) return { lastCheckinDate: null, streakDays: 0 };
    const parsed = JSON.parse(raw);
    return {
      lastCheckinDate: typeof parsed?.lastCheckinDate === 'string' ? parsed.lastCheckinDate : null,
      streakDays: Number.isFinite(parsed?.streakDays) ? Math.max(0, Number(parsed.streakDays)) : 0
    };
  } catch (_error) {
    return { lastCheckinDate: null, streakDays: 0 };
  }
}

function writeCheckinMeta(meta) {
  try {
    localStorage.setItem(getJourneyStorageKey(JOURNEY_CHECKIN_META_KEY), JSON.stringify(meta));
  } catch (_error) {
    // no-op
  }
}

function hasCheckinToday() {
  const meta = readCheckinMeta();
  return meta.lastCheckinDate === getLocalISODate();
}

function markCheckinMilestone(serverStreakDays = null) {
  const today = getLocalISODate();
  const yesterday = getYesterdayLocalISODate();
  const prev = readCheckinMeta();

  let streakDays = prev.streakDays || 0;
  if (Number.isFinite(serverStreakDays) && Number(serverStreakDays) > 0) {
    streakDays = Number(serverStreakDays);
  } else if (prev.lastCheckinDate === today) {
    streakDays = Math.max(1, streakDays || 1);
  } else if (prev.lastCheckinDate === yesterday) {
    streakDays = Math.max(1, streakDays) + 1;
  } else {
    streakDays = 1;
  }

  writeCheckinMeta({ lastCheckinDate: today, streakDays });
  const activePanel = document.querySelector('.tab-content.active')?.id || '';
  const activeTab = activePanel.startsWith('tab-') ? activePanel.slice(4) : 'checkin';
  updateStepGuide(activeTab);
  return streakDays;
}

function clearJourneyStateForScope(scopeId) {
  if (!scopeId) return;
  JOURNEY_MILESTONE_KEYS.forEach((key) => clearJourneyFlag(key, scopeId));
  try {
    localStorage.removeItem(getJourneyStorageKey(JOURNEY_CHECKIN_META_KEY, scopeId));
  } catch (_error) {
    // no-op
  }
  clearJourneyFlag('checkinDone', scopeId);
}

function markJourneyMilestone(key) {
  if (!key) return;
  writeJourneyFlag(key);
  const activePanel = document.querySelector('.tab-content.active')?.id || '';
  const activeTab = activePanel.startsWith('tab-') ? activePanel.slice(4) : 'chart';
  updateStepGuide(activeTab);
  applyGuidedNavigation();
}

function isGuidedNavigationUnlocked() {
  try {
    if (localStorage.getItem('ps_unlock_all_nav') === '1') return true;
    return GUIDED_UNLOCK_KEYS.every((key) => readJourneyFlag(key));
  } catch (_error) {
    // Fail open if storage is unavailable (private mode / browser policy).
    return true;
  }
}

function applyGuidedNavigation() {
  const unlocked = isGuidedNavigationUnlocked();
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // Keep the initial experience focused by showing only core journey tabs.
  sidebar.querySelectorAll('.nav-item[data-tab]').forEach((item) => {
    const tab = item.getAttribute('data-tab') || '';
    const shouldHide = !unlocked && !GUIDED_CORE_TABS.has(tab);
    item.classList.toggle('nav-item-guided-hidden', shouldHide);
    item.setAttribute('aria-hidden', shouldHide ? 'true' : 'false');
    if (item instanceof HTMLButtonElement || item instanceof HTMLAnchorElement) {
      item.tabIndex = shouldHide ? -1 : 0;
    }
  });

  sidebar.querySelectorAll('.nav-group').forEach((group) => {
    const hasVisibleNav = Array.from(group.querySelectorAll('.nav-item[data-tab]')).some((item) => {
      return !item.classList.contains('nav-item-guided-hidden');
    });
    group.classList.toggle('nav-group-guided-hidden', !hasVisibleNav);
  });

  sidebar.querySelectorAll('.nav-divider').forEach((divider) => {
    divider.classList.toggle('nav-divider-guided-hidden', !unlocked);
  });

  const hiddenActive = sidebar.querySelector('.nav-item.active.nav-item-guided-hidden');
  if (hiddenActive) switchTab('chart');
}

function switchTab(id, btn) {
  // Close More dropdown if open (BL-UX-C7)
  closeMoreMenu();
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  // legacy support: remove active from old .tabs .tab-btn if any remain
  document.querySelectorAll('.tabs .tab-btn').forEach(el => { el.classList.remove('active'); el.setAttribute('aria-selected', 'false'); });
  const panel = document.getElementById('tab-' + id);
  if (panel) panel.classList.add('active');

  // Activate the correct primary tab button (group-aware) — legacy support
  const groupBtn = TAB_GROUPS[id] ? document.getElementById(TAB_GROUPS[id]) : btn;
  if (groupBtn) { groupBtn.classList.add('active'); groupBtn.setAttribute('aria-selected', 'true'); }
  else if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }

  // ACC-P2-1: Update aria-selected on sub-tabs (chart/profile tabs)
  document.querySelectorAll('.sub-tabs button[role="tab"]').forEach(tab => {
    const tabId = tab.getAttribute('data-arg0');
    tab.setAttribute('aria-selected', tabId === id ? 'true' : 'false');
  });

  // Update sidebar active states
  updateSidebarActive(id);

  // Update step guide progress
  updateStepGuide(id);

  // Check for tab overflow and update indicator
  updateTabOverflowIndicator();

  // WC-P0-3: Track overview tab views for landing funnel analysis
  if (id === 'overview') trackEvent('landing', 'hero_view');

  if (id === 'transits' || id === 'checkin') {
    markJourneyMilestone('transitsViewed');
  }

  // Lazy-load tab content on first activation (BL-OPT-005)
  if (typeof window.onTabActivated === 'function') window.onTabActivated(id);
  
  // P2-FE-004: Guard auto-loads with a loading-state Set to prevent duplicate fetches
  if (!switchTab._loading) switchTab._loading = new Set();
  
  // Auto-load clusters when tab is activated
  if (id === 'clusters' && token && !document.getElementById('clusterListContainer')?.innerHTML && !switchTab._loading.has('clusters')) {
    switchTab._loading.add('clusters');
    Promise.resolve(loadClusters()).finally(() => switchTab._loading.delete('clusters'));
  }

  // Auto-load practitioner roster when tab is activated
  if (id === 'practitioner' && token && !switchTab._loading.has('practitioner')) {
    switchTab._loading.add('practitioner');
    Promise.resolve(loadRoster()).finally(() => switchTab._loading.delete('practitioner'));
  }

  // Auto-load client portal when tab is activated
  if (id === 'my-practitioner' && token && !switchTab._loading.has('my-practitioner')) {
    switchTab._loading.add('my-practitioner');
    Promise.resolve(loadClientPortal()).finally(() => switchTab._loading.delete('my-practitioner'));
  }

  // Auto-load celebrity matches on first visit
  if (id === 'celebrity' && token && !document.getElementById('celebrityGrid')?.innerHTML && !switchTab._loading.has('celebrity')) {
    switchTab._loading.add('celebrity');
    Promise.resolve(loadCelebrityMatches()).finally(() => switchTab._loading.delete('celebrity'));
  }

  // Auto-load achievements on first visit
  if (id === 'achievements' && token && !document.getElementById('achievementsBadges')?.innerHTML && !switchTab._loading.has('achievements')) {
    switchTab._loading.add('achievements');
    Promise.resolve(loadAchievements()).finally(() => switchTab._loading.delete('achievements'));
  }

  // Auto-load directory on first visit
  if (id === 'directory' && !document.getElementById('directoryResults')?.querySelector('.session-note-item, [style*="background:var(--bg3)"]')) {
    searchDirectory();
  }

  // UX-008: Auto-load diary entries when tab is activated
  if (id === 'diary' && token && !switchTab._loading.has('diary-entries')) {
    switchTab._loading.add('diary-entries');
    Promise.resolve(typeof loadDiaryEntries === 'function' ? loadDiaryEntries() : Promise.resolve()).finally(() => switchTab._loading.delete('diary-entries'));
    // Wire filter inputs once
    if (!switchTab._diaryFiltersWired) {
      switchTab._diaryFiltersWired = true;
      const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
      const reload = debounce(() => loadDiaryEntries(), 350);
      ['diaryTypeFilter','diarySignificanceFilter','diaryDateFrom','diaryDateTo'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', reload);
      });
      document.getElementById('diarySearchInput')?.addEventListener('input', reload);
    }
  }

  // UX-008: Auto-load check-in stats when tab is activated
  if (id === 'checkin' && token && !switchTab._loading.has('checkin-stats')) {
    switchTab._loading.add('checkin-stats');
    Promise.resolve(typeof loadCheckinStats === 'function' ? loadCheckinStats() : Promise.resolve()).finally(() => switchTab._loading.delete('checkin-stats'));
  }

  // 3.3: Auto-load calendar events when tab is activated
  if (id === 'calendar' && token && !switchTab._loading.has('calendar-events')) {
    switchTab._loading.add('calendar-events');
    Promise.resolve(typeof loadCalendar === 'function' ? loadCalendar() : Promise.resolve()).finally(() => switchTab._loading.delete('calendar-events'));
  }

  // UX-005: Auto-sync birth data from Chart tab to Profile tab
  if (id === 'profile') {
    const cDate = document.getElementById('c-date')?.value;
    const cTime = document.getElementById('c-time')?.value;
    const cLat = document.getElementById('c-lat')?.value;
    const cLng = document.getElementById('c-lng')?.value;
    const cTz = document.getElementById('c-tz')?.value;
    const cLoc = document.getElementById('c-location')?.value;
    
    // Only pre-fill if profile fields are empty (don't overwrite user changes)
    if (cDate && !document.getElementById('p-date').value) {
      document.getElementById('p-date').value = cDate;
    }
    if (cTime && !document.getElementById('p-time').value) {
      document.getElementById('p-time').value = cTime;
    }
    if (cLat && !document.getElementById('p-lat').value) {
      document.getElementById('p-lat').value = cLat;
    }
    if (cLng && !document.getElementById('p-lng').value) {
      document.getElementById('p-lng').value = cLng;
    }
    if (cLoc && !document.getElementById('p-location').value) {
      document.getElementById('p-location').value = cLoc;
    }
    if (cTz && !document.getElementById('p-tz').value) {
      document.getElementById('p-tz').value = cTz;
    }
  }

  // Pre-fill today's date in timing tool
  if (id === 'timing') {
    const startInput = document.getElementById('timing-start');
    if (startInput && !startInput.value) startInput.value = new Date().toISOString().split('T')[0];
  }

  // P2-FE-002: Clear diary edit mode when leaving diary tab
  if (id !== 'diary' && typeof cancelDiaryEdit === 'function') {
    cancelDiaryEdit();
  }

  // BL-EXC-P1-4: Load transit context card when diary tab is opened
  if (id === 'diary' && token && !switchTab._loading.has('diary-transits')) {
    switchTab._loading.add('diary-transits');
    Promise.resolve(loadDiaryTransitContext()).finally(() => switchTab._loading.delete('diary-transits'));
  }

  // UX-007: Update welcome message when overview tab is activated
  if (id === 'overview' && typeof updateWelcomeMessage === 'function') {
    updateWelcomeMessage();
  }

  // UX-008: Auto-load leaderboard when achievements tab is activated
  if (id === 'achievements' && token && !switchTab._loading.has('leaderboard') && !document.getElementById('leaderboardList')?.innerHTML) {
    switchTab._loading.add('leaderboard');
    Promise.resolve(loadLeaderboard()).finally(() => switchTab._loading.delete('leaderboard'));
  }

  // Update mobile nav active state
  if (typeof updateMobileNavForTab === 'function') updateMobileNavForTab(id);

  // Recompute guided navigation after tab changes because milestone state may update.
  applyGuidedNavigation();
}

/**
 * ACC-P3-2: Tab Overflow Indicator
 * Detects when tab list overflows and shows a visual fade-right gradient indicator
 * Also manages shrinking tab text when needed for mobile
 */
function updateTabOverflowIndicator() {
  // ACC-P3-2: Check sub-tab containers for overflow and show gradient indicator
  const containers = document.querySelectorAll('.tab-list, .sub-tabs');
  containers.forEach(tabList => {
    if (!tabList) return;

    // Check if content overflows
    const isOverflowing = tabList.scrollWidth > tabList.clientWidth;

    if (isOverflowing) {
      tabList.classList.add('has-overflow');

      // Add scroll event listener to hide indicator when scrolled to end
      const handleScroll = () => {
        const scrollLeft = tabList.scrollLeft;
        const scrollWidth = tabList.scrollWidth;
        const clientWidth = tabList.clientWidth;
        const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 1;

        if (isAtEnd) {
          tabList.classList.remove('has-overflow');
          // Remove listener when at end (can add it back if user scrolls left)
          tabList.removeEventListener('scroll', handleScroll);
        }
      };

      // Debounced scroll listener to update overflow state
      tabList.addEventListener('scroll', handleScroll, { passive: true });
    } else {
      tabList.classList.remove('has-overflow');
    }
  });
}

// ── Sidebar Navigation ────────────────────────────────────────

function sidebarNav(tabId) {
  switchTab(tabId);
  // Close mobile drawer if open
  if (shouldUseMobileLayout()) closeSidebar();
}

function updateSidebarActive(tabId) {
  // Remove all active states from nav items
  document.querySelectorAll('.sidebar .nav-item').forEach(el => {
    el.classList.remove('active');
  });
  // Remove expanded from all parents
  document.querySelectorAll('.sidebar .nav-parent').forEach(el => {
    el.classList.remove('expanded');
  });

  // Activate the correct nav item(s)
  document.querySelectorAll('.sidebar .nav-item[data-tab="' + tabId + '"]').forEach(el => {
    el.classList.add('active');
  });

  // Expand the parent group if this is a sub-tab
  const parentTab = SIDEBAR_PARENTS[tabId];
  if (parentTab) {
    document.querySelectorAll('.sidebar .nav-parent[data-tab="' + parentTab + '"]').forEach(el => {
      el.classList.add('active');
      el.classList.add('expanded');
    });
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const hamburger = document.getElementById('hamburgerBtn');
  const moreBtn = document.getElementById('mobileMoreBtn');
  const isOpen = sidebar.classList.toggle('open');
  backdrop.classList.toggle('visible', isOpen);
  hamburger.setAttribute('aria-expanded', String(isOpen));
  if (moreBtn) moreBtn.setAttribute('aria-expanded', String(isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const hamburger = document.getElementById('hamburgerBtn');
  const moreBtn = document.getElementById('mobileMoreBtn');
  sidebar.classList.remove('open');
  backdrop.classList.remove('visible');
  if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
  if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

function toggleSidebarCollapse() {
  const layout = document.getElementById('appLayout');
  layout.classList.toggle('sidebar-collapsed');
  const isCollapsed = layout.classList.contains('sidebar-collapsed');
  localStorage.setItem('ps_sidebar_collapsed', isCollapsed ? '1' : '0');
}

// Restore sidebar collapsed state from localStorage
(function() {
  if (localStorage.getItem('ps_sidebar_collapsed') === '1') {
    const layout = document.getElementById('appLayout');
    if (layout) layout.classList.add('sidebar-collapsed');
  }
})();

// Close sidebar on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSidebar();
});

function toggleMoreMenu(e) {
  // Legacy — kept for backward compat but sidebar replaces this
  e.stopPropagation();
  const dd = document.getElementById('more-dropdown');
  if (!dd) return;
  const arrow = document.getElementById('more-arrow');
  const isOpen = dd.classList.toggle('open');
  if (arrow) arrow.style.transform = isOpen ? 'rotate(180deg)' : '';
  const btn = document.getElementById('btn-more');
  if (btn) btn.setAttribute('aria-expanded', isOpen);
}

function closeMoreMenu() {
  const dd = document.getElementById('more-dropdown');
  const arrow = document.getElementById('more-arrow');
  if (dd) { dd.classList.remove('open'); }
  if (arrow) arrow.style.transform = '';
  const btn = document.getElementById('btn-more');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

// Close more menu when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.more-menu-btn')) closeMoreMenu();
});

// Step guide: tracks user progress through the 3-step journey
function updateStepGuide(activeTab) {
  const steps = [
    { id: 'sg-chart',         tab: 'chart' },
    { id: 'sg-profile',       tab: 'profile' },
    { id: 'sg-transits',      tab: 'transits' },
    { id: 'sg-checkins',      tab: 'checkin' },
    { id: 'sg-compatibility', tab: 'composite' }
  ];
  steps.forEach(s => {
    const el = document.getElementById(s.id);
    if (!el) return;
    el.classList.remove('active-step');
    if (s.tab === activeTab) el.classList.add('active-step');
  });
  // Mark steps as done based on scoped journey state
  if (readJourneyFlag('chartGenerated')) {
    const c = document.getElementById('sg-chart');
    if (c) { c.classList.add('done'); c.classList.remove('active-step'); }
  }
  if (readJourneyFlag('profileGenerated')) {
    const p = document.getElementById('sg-profile');
    if (p) { p.classList.add('done'); p.classList.remove('active-step'); }
  }
  if (readJourneyFlag('transitsViewed')) {
    const t = document.getElementById('sg-transits');
    if (t) { t.classList.add('done'); t.classList.remove('active-step'); }
  }
  if (hasCheckinToday()) {
    const ch = document.getElementById('sg-checkins');
    if (ch) { ch.classList.add('done'); ch.classList.remove('active-step'); }
  }
}

// CMO-004: Auto-trigger geocoding when a user leaves a location field without
// manually clicking "Look Up". Only fires if no coordinates are set yet.
document.addEventListener('blur', (e) => {
  const el = e.target;
  if (!el.matches || !el.matches('input[data-geocode-target]')) return;
  const prefix = el.getAttribute('data-geocode-target');
  const latEl = document.getElementById(prefix + '-lat');
  if (latEl && !latEl.value && el.value.trim()) {
    geocodeLocation(prefix);
  }
}, true); // capture phase so blur fires on the input element

// Call on load to set initial step state
document.addEventListener('DOMContentLoaded', () => {
  updateStepGuide('chart');
  applyGuidedNavigation();
  // Initialize tab overflow indicator
  updateTabOverflowIndicator();
  // Update tab overflow on window resize
  window.addEventListener('resize', updateTabOverflowIndicator, { passive: true });
});

// ── Astrological Chart Wheel ─────────────────────────────────
function renderAstroChart(astro) {
  if (window.DEBUG) console.log('[Chart] renderAstroChart called', astro);
  if (!astro || !astro.placements) {
    window.DEBUG && console.warn('[Chart] No astrology data or placements:', { astro, hasPlacements: astro?.placements });
    return '';
  }
  
  const zodiacSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const planetSymbols = { sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂', jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇' };
  const planetColors = { sun: '#FFD700', moon: '#C0C0C0', mercury: '#FFA500', venus: '#FF69B4', mars: '#FF4500', jupiter: '#9370DB', saturn: '#4169E1', uranus: '#00CED1', neptune: '#1E90FF', pluto: '#8B4513' };
  
  // Get planet positions (convert to 0-360 degrees)
  const planets = Object.entries(astro.placements || {}).filter(([name]) => planetSymbols[name]);
  
  let html = `<div class="card" style="background:radial-gradient(circle at center, var(--bg2) 0%, var(--bg1) 100%)">
    <div class="card-title">♈ Astrological Chart Wheel</div>
    <div style="position:relative;width:100%;max-width:min(500px,100%);margin:0 auto;aspect-ratio:1;padding:var(--space-5)">
      <svg viewBox="0 0 400 400" style="width:100%;height:100%" role="img" aria-label="Astrological birth chart">
        <!-- Outer circle -->
        <circle cx="200" cy="200" r="190" fill="none" stroke="var(--gold)" stroke-width="2" opacity="0.3"/>
        
        <!-- Zodiac wheel segments -->`;
  
  // Draw zodiac sign divisions (12 segments of 30° each)
  for (let i = 0; i < 12; i++) {
    const angle = i * 30 - 90; // Start from Aries at 0° (top right in traditional charts)
    const nextAngle = (i + 1) * 30 - 90;
    const x1 = 200 + 170 * Math.cos(angle * Math.PI / 180);
    const y1 = 200 + 170 * Math.sin(angle * Math.PI / 180);
    const textAngle = angle + 15; // Center of segment
    const textX = 200 + 180 * Math.cos(textAngle * Math.PI / 180);
    const textY = 200 + 180 * Math.sin(textAngle * Math.PI / 180);
    
    html += `<line x1="200" y1="200" x2="${x1}" y2="${y1}" stroke="var(--bg3)" stroke-width="1" opacity="0.5"/>
             <text x="${textX}" y="${textY}" text-anchor="middle" dominant-baseline="middle" 
                   font-size="10" fill="var(--text-dim)">${zodiacSigns[i].substr(0,3)}</text>`;
  }
  
  // Middle circle for houses
  html += `<circle cx="200" cy="200" r="140" fill="none" stroke="var(--bg3)" stroke-width="1" opacity="0.4"/>`;
  
  // Inner circle
  html += `<circle cx="200" cy="200" r="90" fill="var(--bg2)" stroke="var(--bg3)" stroke-width="1"/>`;
  
  // Plot planets
  planets.forEach(([name, data]) => {
    if (!data.degrees) return;
    
    // Convert zodiac position to chart degrees
    const signIndex = zodiacSigns.indexOf(data.sign);
    const totalDegrees = (signIndex * 30 + data.degrees) % 360;
    const angle = totalDegrees - 90; // Adjust for SVG coordinate system (0° = right, we want Aries at top-right)
    
    // Place planet between middle and outer circle
    const radius = 155;
    const x = 200 + radius * Math.cos(angle * Math.PI / 180);
    const y = 200 + radius * Math.sin(angle * Math.PI / 180);
    
    const color = planetColors[name] || 'var(--gold)';
    const symbol = planetSymbols[name] || name[0];
    
    html += `<g>
              <circle cx="${x}" cy="${y}" r="12" fill="${color}" opacity="0.9"/>
              <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" 
                    font-size="14" fill="var(--bg1)" font-weight="bold">${symbol}</text>
              <text x="${x}" y="${y + 22}" text-anchor="middle" 
                    font-size="10" fill="var(--text-dim)">${name}</text>
            </g>`;
  });
  
  // Ascendant marker (if available)
  if (astro.ascendant && astro.ascendant.degrees !== undefined) {
    const signIndex = zodiacSigns.indexOf(astro.ascendant.sign);
    const totalDegrees = (signIndex * 30 + astro.ascendant.degrees) % 360;
    const angle = totalDegrees - 90;
    const x = 200 + 190 * Math.cos(angle * Math.PI / 180);
    const y = 200 + 190 * Math.sin(angle * Math.PI / 180);
    
    html += `<g>
              <circle cx="${x}" cy="${y}" r="8" fill="none" stroke="#FF1493" stroke-width="2"/>
              <text x="${x}" y="${y-15}" text-anchor="middle" font-size="9" fill="#FF1493" font-weight="bold">ASC</text>
            </g>`;
  }
  
  html += `</svg>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);justify-content:center;margin-top:var(--space-4);padding:var(--space-3);background:var(--bg2);border-radius:var(--space-2)">`;
  
  // Legend
  planets.forEach(([name, data]) => {
    const color = planetColors[name] || 'var(--gold)';
    const symbol = planetSymbols[name] || name[0];
    html += `<div style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--font-size-base)">
              <span style="display:inline-block;width:var(--space-5);height:var(--space-5);background:${color};border-radius:50%;
                          text-align:center;line-height:var(--space-5);font-weight:bold;color:var(--bg1)">${symbol}</span>
              <span style="color:var(--text-dim)">${name} ${data.degrees?.toFixed(1)}° ${escapeHtml(data.sign || '')}</span>
            </div>`;
  });
  
  html += `</div>`;

  // PRA-ENGINE-004: Show user-facing notice when polar fallback triggers
  if (astro.polarWarning) {
    html += `<div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--warning-bg,rgba(255,193,7,0.12));border:1px solid var(--warning,#ffc107);border-radius:var(--space-2);font-size:var(--font-size-sm);color:var(--text-dim)">
      ⚠ Your birth latitude is above the polar circle (${Math.abs(astro.ascendant?.latitude || 67).toFixed(0)}°N/S). Placidus houses are mathematically undefined at this latitude — Equal House system has been used instead.
    </div>`;
  }

  html += `</div>`;
  return html;
}

// ── Chart Calculator ──────────────────────────────────────────
function prefillExample() {
  document.getElementById('c-date').value = '1979-08-05';
  document.getElementById('c-time').value = '18:51';
  document.getElementById('c-location').value = 'Tampa, FL, USA';
  document.getElementById('c-lat').value = '27.9506';
  document.getElementById('c-lng').value = '-82.4572';
  setTimezone('c-tz', 'America/New_York');
  const s = document.getElementById('c-geo-status');
  s.innerHTML = '<span class="icon-check"></span> Tampa, Florida, United States · 27.9506°N, 82.4572°W · America/New_York';
  s.style.color = '#48c774';
}

// ── Geocode helpers ────────────────────────────────────────────
async function geocodeLocation(prefix) {
  const locationEl = document.getElementById(prefix + '-location');
  const statusEl   = document.getElementById(prefix + '-geo-status');
  const geoBtn     = document.getElementById(prefix + '-geoBtn');
  const q = locationEl.value.trim();
  if (!q) { statusEl.style.color = '#f56565'; statusEl.textContent = window.t('chart.enterLocation'); return; }

  geoBtn.disabled = true;
  geoBtn.textContent = '…';
  statusEl.style.color = 'var(--text-dim)';
  statusEl.textContent = window.t('chart.lookingUp');

  try {
    const data = await apiFetch('/api/geocode?q=' + encodeURIComponent(q));
    if (data.error) {
      statusEl.style.color = '#f56565';
      statusEl.textContent = '✗ ' + data.error;
      return;
    }
    document.getElementById(prefix + '-lat').value = data.lat;
    document.getElementById(prefix + '-lng').value = data.lng;
    setTimezone(prefix + '-tz', data.timezone);
    const latDir = data.lat >= 0 ? 'N' : 'S';
    const lngDir = data.lng >= 0 ? 'E' : 'W';
    statusEl.style.color = '#48c774';
    statusEl.innerHTML = `<span class="icon-check"></span> ${escapeHtml(data.displayName)} · ${Math.abs(data.lat).toFixed(4)}°${latDir}, ${Math.abs(data.lng).toFixed(4)}°${lngDir} · ${escapeHtml(data.timezone)}`;
  } catch (e) {
    statusEl.style.color = '#f56565';
    statusEl.textContent = '✗ Error: ' + e.message;
  } finally {
    geoBtn.disabled = false;
    geoBtn.textContent = window.t('chart.lookupLocation');
  }
}

function setTimezone(selectId, tz) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  // Try exact match first
  for (const opt of sel.options) {
    if (opt.value === tz) { sel.value = tz; return; }
  }
  // Timezone not in existing list — add it at the top
  const opt = document.createElement('option');
  opt.value = tz; opt.textContent = tz;
  sel.insertBefore(opt, sel.firstChild);
  sel.value = tz;
}

async function calculateChart() {
  const btn = document.getElementById('calcBtn');
  const spinner = document.getElementById('calcSpinner');
  const resultEl = document.getElementById('chartResult');

  // Auto-geocode if location text is present but coordinates not yet resolved
  if (isNaN(parseFloat(document.getElementById('c-lat').value))) {
    if (document.getElementById('c-location').value.trim()) {
      await geocodeLocation('c');
    }
    if (isNaN(parseFloat(document.getElementById('c-lat').value))) {
      if (resultEl) {
        resultEl.innerHTML = '<div class="alert alert-error"><span class="icon-info"></span> ' + window.t('chart.lookUpFirst') + '</div>';
        resultEl.removeAttribute('aria-busy');
      }
      return;
    }
  }

  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = '';
  if (resultEl) {
    resultEl.setAttribute('aria-busy', 'true');
    // ACC-P2-11: Announce specific operation to screen readers
    const statusId = 'chartCalcStatus';
    let statusEl = document.getElementById(statusId);
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = statusId;
      statusEl.className = 'visually-hidden';
      statusEl.setAttribute('aria-live', 'polite');
      statusEl.setAttribute('aria-atomic', 'true');
      resultEl.appendChild(statusEl);
    }
    statusEl.textContent = 'Calculating your Energy Blueprint from your birth data...';
    if (!resultEl.getAttribute('aria-describedby')?.includes(statusId)) {
      const existing = resultEl.getAttribute('aria-describedby') || '';
      resultEl.setAttribute('aria-describedby', (existing + ' ' + statusId).trim());
    }
    resultEl.innerHTML = skeletonChart();
  }

  try {
    const payload = {
      birthDate: document.getElementById('c-date').value,
      birthTime: document.getElementById('c-time').value,
      birthTimezone: document.getElementById('c-tz').value,
      lat: parseFloat(document.getElementById('c-lat').value),
      lng: parseFloat(document.getElementById('c-lng').value),
    };

    const data = await apiFetch('/api/chart/calculate', { method: 'POST', body: JSON.stringify(payload) });
    if (resultEl) {
      resultEl.innerHTML = renderChart(data);
      resultEl.removeAttribute('aria-busy');
      // Clear the status announcement
      const statusEl = document.getElementById('chartCalcStatus');
      if (statusEl) statusEl.textContent = '';
    }
    if (resultEl) _applyChartHeadings(resultEl);
    trackEvent('chart', 'calculate');
    // Save birth data to localStorage after successful chart calculation
    saveBirthData();
    // Update overview tab with fresh data
    if (typeof updateOverview === 'function') updateOverview(data);
    // Show identity strip with type/authority/profile
    if (typeof showIdentityStrip === 'function') showIdentityStrip(data);
    // Auto-navigate to Home dashboard after first calculation
    const homeBtn = document.getElementById('btn-home');
    if (typeof switchTab === 'function') switchTab('overview', homeBtn);
    // Collapse the chart form now that a chart has been generated
    collapseChartForm();
    // Load chart history for versioning (AUDIT-UX-003)
    if (token) loadChartHistory();
  } catch (e) {
    if (resultEl) {
      resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
      resultEl.removeAttribute('aria-busy');
    }
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

// ── Chart Form Collapse (hide form after generation, show compact summary) ──
function collapseChartForm() {
  markJourneyMilestone('chartGenerated');
  // Hide the generate button row
  const btnRow = document.getElementById('chartBtnRow');
  if (btnRow) btnRow.style.display = 'none';
  // Build compact birth data summary
  const summary = document.getElementById('chartFormSummary');
  const summaryText = document.getElementById('chartFormSummaryText');
  if (summary && summaryText) {
    const date = document.getElementById('c-date')?.value || '';
    const time = document.getElementById('c-time')?.value || '';
    const loc  = document.getElementById('c-location')?.value || '';
    const parts = [];
    if (date) parts.push('📅 ' + date);
    if (time) parts.push('⏰ ' + time);
    if (loc)  parts.push('📍 ' + loc);
    summaryText.textContent = parts.join('  ');
    summary.style.display = 'flex';
  }
  // Update sticky CTA to say Recalculate
  const stickyBtn = document.querySelector('#stickyChartCta button');
  if (stickyBtn) {
    const span = stickyBtn.querySelector('span[data-i18n]');
    if (span) { span.removeAttribute('data-i18n'); span.textContent = '↻ Recalculate'; }
    stickyBtn.onclick = function() { expandChartForm(); };
  }
  // WC-P1-3: nudge push opt-in after first chart generation
  setTimeout(_maybeShowPushOptIn, 1500);
}

function expandChartForm() {
  // Show the button row again
  const btnRow = document.getElementById('chartBtnRow');
  if (btnRow) btnRow.style.removeProperty('display');
  // Hide summary bar
  const summary = document.getElementById('chartFormSummary');
  if (summary) summary.style.display = 'none';
  // Reset sticky CTA
  const stickyBtn = document.querySelector('#stickyChartCta button');
  if (stickyBtn) {
    const span = stickyBtn.querySelector('span:not(.spinner)');
    if (span) { span.setAttribute('data-i18n', 'chart.generateMyChart'); span.textContent = window.t ? window.t('chart.generateMyChart') : 'Generate My Chart'; }
    stickyBtn.onclick = calculateChart;
  }
  // Navigate back to chart tab
  if (typeof switchTab === 'function') switchTab('chart', document.getElementById('btn-blueprint'));
  // Focus the date input
  setTimeout(() => document.getElementById('c-date')?.focus({ preventScroll: false }), 100);
}

// ── Birth Data Persistence (localStorage) ─────────────────────
const BIRTH_DATA_KEY = 'primeSelf_birthData';

function saveBirthData() {
  try {
    const data = {
      date: document.getElementById('c-date')?.value,
      time: document.getElementById('c-time')?.value,
      location: document.getElementById('c-location')?.value,
      lat: document.getElementById('c-lat')?.value,
      lng: document.getElementById('c-lng')?.value,
      tz: document.getElementById('c-tz')?.value,
      savedAt: Date.now()
    };
    if (data.date && data.time) {
      localStorage.setItem(BIRTH_DATA_KEY, JSON.stringify(data));
      if (window.DEBUG) console.log('[BirthData] Saved to localStorage');
    }
  } catch (e) { window.DEBUG && console.warn('[BirthData] Save failed:', e); }
}

const BIRTH_DATA_TTL_MS = 30 * 24 * 60 * 60 * 1000; // SYS-047: 30-day TTL

function readStoredBirthData() {
  try {
    const raw = localStorage.getItem(BIRTH_DATA_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.date || !data?.time) return null;
    if (data.savedAt && (Date.now() - data.savedAt) > BIRTH_DATA_TTL_MS) {
      localStorage.removeItem(BIRTH_DATA_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function getBirthFormSeed(ids) {
  return {
    date: document.getElementById(ids.date)?.value || '',
    time: document.getElementById(ids.time)?.value || '',
    location: document.getElementById(ids.location)?.value || '',
    lat: document.getElementById(ids.lat)?.value || '',
    lng: document.getElementById(ids.lng)?.value || '',
    tz: ids.tz ? (document.getElementById(ids.tz)?.value || '') : '',
  };
}

function hasCoordinatePair(seed) {
  return seed?.lat !== '' && seed?.lat != null && seed?.lng !== '' && seed?.lng != null
    && !Number.isNaN(Number(seed.lat)) && !Number.isNaN(Number(seed.lng));
}

function hasBirthSeed(seed) {
  return !!(seed && (seed.date || seed.time || seed.location || hasCoordinatePair(seed)));
}

function getCompositeFormSeed(person) {
  return getBirthFormSeed({
    date: `comp-date${person}`,
    time: `comp-time${person}`,
    location: `comp-${person}-location`,
    lat: `comp-${person}-lat`,
    lng: `comp-${person}-lng`,
  });
}

function describeCompositeMissingFields(seed) {
  const missing = [];
  if (!seed?.date) missing.push('birth date');
  if (!seed?.time) missing.push('birth time');
  if (!hasCoordinatePair(seed)) missing.push(seed?.location ? 'location lookup' : 'birth location');
  return missing;
}

function formatFieldList(fields) {
  if (!fields.length) return '';
  if (fields.length === 1) return fields[0];
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`;
  return `${fields.slice(0, -1).join(', ')}, and ${fields[fields.length - 1]}`;
}

function setCompositeLaunchNote(message, tone = 'info') {
  const note = document.getElementById('compositeLaunchNote');
  if (!note) return;
  note.className = `alert ${tone === 'success' ? 'alert-success' : tone === 'warn' ? 'alert-warn' : 'alert-info'}`;
  note.textContent = message;
  note.style.display = message ? '' : 'none';
}

function setCompositeGeoStatus(person, message, tone = 'info') {
  const statusEl = document.getElementById(`comp-${person}-geo-status`);
  if (!statusEl) return;
  if (!message) {
    statusEl.textContent = '';
    return;
  }
  const color = tone === 'success' ? 'var(--accent2)' : tone === 'warn' ? 'var(--gold)' : 'var(--text-dim)';
  statusEl.innerHTML = `<span style="color:${color}">${escapeHtml(message)}</span>`;
}

function applyCompositePersonSeed(person, seed, sourceLabel) {
  const dateEl = document.getElementById(`comp-date${person}`);
  const timeEl = document.getElementById(`comp-time${person}`);
  const locationEl = document.getElementById(`comp-${person}-location`);
  const latEl = document.getElementById(`comp-${person}-lat`);
  const lngEl = document.getElementById(`comp-${person}-lng`);

  if (dateEl) dateEl.value = seed?.date || '';
  if (timeEl) timeEl.value = seed?.time || '';
  if (locationEl) locationEl.value = seed?.location || '';
  if (latEl) latEl.value = seed?.lat ?? '';
  if (lngEl) lngEl.value = seed?.lng ?? '';

  if (!hasBirthSeed(seed)) {
    setCompositeGeoStatus(person, `${sourceLabel} is not available yet.`, 'warn');
    return;
  }

  if (hasCoordinatePair(seed)) {
    setCompositeGeoStatus(person, seed?.location
      ? `${sourceLabel} loaded with saved coordinates.`
      : `${sourceLabel} loaded from saved birth coordinates.`, 'success');
    return;
  }

  if (seed?.location) {
    setCompositeGeoStatus(person, `${sourceLabel} includes a location. Click Look Up to resolve coordinates.`, 'warn');
    return;
  }

  setCompositeGeoStatus(person, `${sourceLabel} is partial. Add the missing details below.`, 'warn');
}

function focusCompositeMissingField(person, missing) {
  if (!missing?.length) return;
  const first = missing[0];
  const id = first === 'birth date'
    ? `comp-date${person}`
    : first === 'birth time'
      ? `comp-time${person}`
      : `comp-${person}-location`;
  document.getElementById(id)?.focus({ preventScroll: false });
}

function getPractitionerCompositeSeed() {
  const chartSeed = getBirthFormSeed({ date: 'c-date', time: 'c-time', location: 'c-location', lat: 'c-lat', lng: 'c-lng', tz: 'c-tz' });
  const profileSeed = getBirthFormSeed({ date: 'p-date', time: 'p-time', location: 'p-location', lat: 'p-lat', lng: 'p-lng', tz: 'p-tz' });
  const storedSeed = readStoredBirthData();
  return [chartSeed, profileSeed, storedSeed].find(hasBirthSeed) || {};
}

function getClientCompositeSeed(clientId) {
  const detail = _practitionerClientDetailCache.get(String(clientId));
  const rosterClient = _practitionerRosterClients.find(client => String(client.id) === String(clientId));
  const client = detail?.client || rosterClient || {};
  return {
    date: client.birth_date || '',
    time: client.birth_time || '',
    location: client.birth_location || '',
    lat: client.birth_lat ?? '',
    lng: client.birth_lng ?? '',
    tz: client.birth_tz || '',
  };
}

function restoreBirthData() {
  try {
    const data = readStoredBirthData();
    if (!data) return false;

    // Restore into ALL forms that share birth fields: chart (c-*), profile (p-*), composite A (comp-*A)
    const prefixes = ['c', 'p'];
    prefixes.forEach(prefix => {
      const dateEl = document.getElementById(`${prefix}-date`);
      const timeEl = document.getElementById(`${prefix}-time`);
      const locEl  = document.getElementById(`${prefix}-location`);
      const latEl  = document.getElementById(`${prefix}-lat`);
      const lngEl  = document.getElementById(`${prefix}-lng`);
      const tzEl   = document.getElementById(`${prefix}-tz`);

      if (dateEl) dateEl.value = data.date;
      if (timeEl) timeEl.value = data.time;
      if (locEl && data.location) locEl.value = data.location;
      if (latEl && data.lat) latEl.value = data.lat;
      if (lngEl && data.lng) lngEl.value = data.lng;
      if (tzEl && data.tz) tzEl.value = data.tz;
    });

    // Also fill Composite Person A (date + time + location)
    const compDateA = document.getElementById('comp-dateA');
    const compTimeA = document.getElementById('comp-timeA');
    const compLocA  = document.getElementById('comp-A-location');
    const compLatA  = document.getElementById('comp-A-lat');
    const compLngA  = document.getElementById('comp-A-lng');
    if (compDateA && data.date) compDateA.value = data.date;
    if (compTimeA && data.time) compTimeA.value = data.time;
    if (compLocA && data.location) compLocA.value = data.location;
    if (compLatA && data.lat) compLatA.value = data.lat;
    if (compLngA && data.lng) compLngA.value = data.lng;
    if (data.lat && data.lng && data.location) {
      const compStatusA = document.getElementById('comp-A-geo-status');
      if (compStatusA) compStatusA.innerHTML = `<span style="color:var(--accent2)">✓ Restored: ${escapeHtml(data.location)} (${parseFloat(data.lat).toFixed(2)}, ${parseFloat(data.lng).toFixed(2)})</span>`;
    }

    // Show geo status
    if (data.lat && data.lng && data.location) {
      ['c', 'p'].forEach(prefix => {
        const statusEl = document.getElementById(`${prefix}-geo-status`);
        if (statusEl) statusEl.innerHTML = `<span style="color:var(--accent2)">✓ Restored: ${escapeHtml(data.location)} (${parseFloat(data.lat).toFixed(2)}, ${parseFloat(data.lng).toFixed(2)})</span>`;
      });
    }

    if (window.DEBUG) console.log('[BirthData] Restored from localStorage');
    return true;
  } catch (e) { window.DEBUG && console.warn('[BirthData] Restore failed:', e); return false; }
}

// Restore on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', restoreBirthData);
} else {
  restoreBirthData();
}

// Show identity strip from cached chart (if page reloaded after a chart was generated)
document.addEventListener('DOMContentLoaded', () => {
  // Give renderChart() time to re-render from DOM if chartGenerated flag is set,
  // then populate the identity strip from window._lastChart if available
  setTimeout(() => {
    if (window._lastChart && typeof showIdentityStrip === 'function') {
      showIdentityStrip(window._lastChart);
    }
  }, 200);
  // Restore collapsed chart form state if chart was previously generated
  if (readJourneyFlag('chartGenerated')) {
    collapseChartForm();
  }
  // Show first-run welcome modal for new visitors (slight delay so page renders first)
  try {
    if (!hasSeenFirstRunOnboarding() && !readJourneyFlag('chartGenerated')) {
      setTimeout(frmShow, 800);
    }
  } catch(e) {}
});

function _applyChartHeadings(container) {
  container.querySelectorAll('.card-title').forEach(el => {
    el.setAttribute('role', 'heading');
    el.setAttribute('aria-level', '2');
  });
  container.querySelectorAll('.section-header').forEach(el => {
    el.setAttribute('role', 'heading');
    el.setAttribute('aria-level', '3');
  });
}

function renderChart(data) {
  if (window.DEBUG) console.log('[Chart] renderChart called with data:', data);
  if (data.error) return `<div class="alert alert-error">API Error: ${escapeHtml(data.error)}</div>`;
  const d = data.data || data;
  const chart = d.chart || d;
  const astro = d.westernAstrology || d.astrology || {};
  if (window.DEBUG) console.log('[Chart] Extracted astro:', astro);
  const meta = data.meta || {};

  let html = '';

  // Phase 4: Daily card — show transit snapshot if transit activations are available
  if (d?.transits?.activations?.length) {
    html += renderDailyCard(d.transits, chart);
  }

  // Energy Blueprint block
  html += `<div class="card">
    <div class="card-title"><span class="icon-chart"></span> Energy Blueprint Chart</div>
    <div class="chart-grid">
      <div class="data-block">
        <h4>Core Energy</h4>
        ${row('Pattern <span class="icon-info help-icon" title="Your energy type: Builder (consistent energy), Guide (recognition-based), Initiator (spontaneous), Builder-Initiator (hybrid), or Mirror (lunar mirror)"></span>', chart.type)}
        ${getExplanation(TYPE_EXPLANATIONS, chart.type)}
        ${row('Decision Style <span class="icon-info help-icon" title="How you make aligned decisions: Emotional Wave, Sacral Response, Splenic Instinct, Heart Will, etc."></span>', chart.authority)}
        ${getExplanation(AUTHORITY_EXPLANATIONS, chart.authority)}
        ${row('Strategy <span class="icon-info help-icon" title="Your interaction approach: To Respond, Wait for Invitation, Inform Before Acting, or Wait a Lunar Cycle"></span>', chart.strategy)}
        ${getExplanation(STRATEGY_EXPLANATIONS, chart.strategy)}
        ${row('Life Role <span class="icon-info help-icon" title="Your personality archetype (e.g., 1/3 Investigator-Martyr, 6/2 Role Model-Hermit). First number is conscious, second is unconscious"></span>', chart.profile)}
        ${getExplanation(PROFILE_EXPLANATIONS, chart.profile)}
        ${row('Circuit Type <span class="icon-info help-icon" title="How your energy centers connect: Single, Split, Triple Split, or Quad Split. Affects how you process and share energy"></span>', chart.definition)}
        ${getExplanation(DEFINITION_EXPLANATIONS, chart.definition)}
        ${row('Not-Self Signal <span class="icon-info help-icon" title="The emotional signal that you are out of alignment with your pattern and strategy"></span>', chart.notSelfTheme)}
        ${getExplanation(NOT_SELF_EXPLANATIONS, chart.notSelfTheme)}
        ${(() => {
          const sigMap = { 'Generator': 'Satisfaction', 'Manifesting Generator': 'Satisfaction', 'Manifestor': 'Peace', 'Projector': 'Success', 'Reflector': 'Surprise' };
          const sig = sigMap[chart.type] || '';
          if (!sig) return '';
          const expl = window.SIGNATURE_EXPLANATIONS?.[sig] || '';
          return row('Aligned State <span class="icon-info help-icon" title="When you follow your strategy and authority, this feeling signals you are living in alignment"></span>', sig)
            + (expl ? `<div class="explanation-text" style="border-left-color:var(--green)">${expl}</div>` : '');
        })()}
      </div>
      <div class="data-block">
        <h4>Purpose Vector <span class="icon-info help-icon" title="Your purpose vector emerges from your 4 main Frequency Keys activations: conscious Sun/Earth and unconscious Sun/Earth"></span></h4>
        ${(() => {
          const crossName = chart.cross?.name || (typeof chart.cross === 'string' ? chart.cross : null);
          const sunGate = chart.cross?.gates?.[0] || chart.personalitySunGate;
          const sunLine = chart.cross?.line || chart.personalitySunLine;
          const lookedUp = (!crossName && sunGate && sunLine) ? getCrossName(sunGate, sunLine) : '';
          return row('Life Purpose Vector', crossName || lookedUp || (chart.cross?.gates ? chart.cross.gates.join(', ') : '—'));
        })()}
        ${row('Type', chart.cross?.type || chart.crossType || '—')}
        ${getExplanation(window.CROSS_TYPE_EXPLANATIONS, chart.cross?.type || chart.crossType || '')}
        ${row('Quarter', chart.cross?.quarter || '—')}
        ${(() => {
          const crossName = chart.cross?.name || (typeof chart.cross === 'string' ? chart.cross : null);
          if (!crossName) return '';
          const quarterThemes = { 'Civilization': 'Your purpose is fulfilled through contribution to collective structures, society, and shared values.', 'Duality': 'Your purpose lives in relationship — your greatest growth unfolds through deep personal and professional partnerships.', 'Mutation': 'Your purpose is to catalyze transformation. You carry the energy of change, breakthrough, and evolution.', 'Maya': 'Your purpose lives in the realm of the mind — understanding, communicating, and illuminating complex truths.' };
          const q = chart.cross?.quarter || '';
          const qTheme = quarterThemes[q] || '';
          return qTheme ? `<div class="explanation-text" style="margin-top:var(--space-2)">${qTheme} Living out the <strong>${escapeHtml(crossName)}</strong> is your life\'s through-line.</div>` : '';
        })()}
      </div>
    </div>`;

  if (chart.definedCenters?.length) {
    const allCenters = ['Head','Ajna','Throat','G','Heart','SolarPlexus','Sacral','Spleen','Root'];
    const openCenters = allCenters.filter(c => !chart.definedCenters.includes(c));
    html += `<div class="section-header">Energy Centers <span class="icon-info help-icon" title="The 9 bio-energy hubs in your chart. Defined (colored) centers are consistent; Open (white) centers amplify and sample others' energy"></span></div>
    <div class="chart-grid" style="gap:var(--space-4)">
        <div style="flex:1;min-width:200px">
          <div class="data-label" style="margin-bottom:var(--space-2)">Defined</div>
          ${chart.definedCenters.map(c => {
            const ce = window.CENTER_EXPLANATIONS?.[c];
            const ci = window.getCenterInfo ? getCenterInfo(c) : null;
            const motorTag = ci?.motor ? ' <span style="font-size:var(--font-size-xs);background:rgba(224,80,80,0.15);color:var(--red);padding:var(--border-width-thin) 5px;border-radius:var(--space-1);font-weight:600">MOTOR</span>' : '';
            const bioTip = ci?.bio ? ` title="${escapeAttr(ci.bio)}"` : '';
            return `<div style="margin-bottom:var(--space-2)">
              <span class="pill green"${bioTip}>${escapeHtml(c)}</span>${motorTag}${ce ? ` <span style="font-size:var(--font-size-xs);color:var(--text-muted)">— ${escapeHtml(ce.governs)}</span>` : ''}
              ${ce ? `<div class="center-explain">${escapeHtml(ce.defined)}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
        <div style="flex:1;min-width:200px">
          <div class="data-label" style="margin-bottom:var(--space-2)">Open / Undefined</div>
          ${openCenters.map(c => {
            const ce = window.CENTER_EXPLANATIONS?.[c];
            const ci = window.getCenterInfo ? getCenterInfo(c) : null;
            const motorTag = ci?.motor ? ' <span style="font-size:var(--font-size-xs);background:rgba(224,80,80,0.15);color:var(--red);padding:var(--border-width-thin) 5px;border-radius:var(--space-1);font-weight:600">MOTOR</span>' : '';
            const bioTip = ci?.bio ? ` title="${escapeAttr(ci.bio)}"` : '';
            return `<div style="margin-bottom:var(--space-2)">
              <span class="pill"${bioTip}>${escapeHtml(c)}</span>${motorTag}${ce ? ` <span style="font-size:var(--font-size-xs);color:var(--text-muted)">— ${escapeHtml(ce.governs)}</span>` : ''}
              ${ce ? `<div class="center-explain">${escapeHtml(ce.open)}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  }

  // Interactive Bodygraph (Phase 7)
  const _bgId = 'bodygraph-' + Date.now();
  const _bgLabel = escapeAttr((chart.type || 'chart') + '-' + (chart.profile || '').replace('/', '-'));
  html += `<div class="section-header">Your Energy Chart <span class="icon-info help-icon" title="Click any center or channel line to learn what it means in your design"></span></div>
  <div class="card" style="padding:var(--space-4);text-align:center">
    <div id="${_bgId}" style="min-height:420px"></div>
    <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-2)">Tap a center or channel to explore</div>
    <div style="display:flex;justify-content:center;gap:var(--space-2);margin-top:var(--space-3)">
      <button class="btn-secondary btn-sm" data-action="downloadBodygraph" data-arg0="${_bgId}" data-arg1="${_bgLabel}" title="Save your bodygraph as a PNG image">⬇ Download Chart</button>
      <button class="btn-secondary btn-sm" data-action="shareBodygraph" title="Share your design as a Blueprint Card">⬆ Share Chart</button>
    </div>
  </div>`;
  // Deferred render after DOM insertion
  setTimeout(() => { if (typeof renderBodygraph === 'function') renderBodygraph(_bgId, chart); }, 50);

  if (chart.activeChannels?.length) {
    html += `<div class="section-header">Active Channels <span class="icon-info help-icon" title="Channels link two centers, creating a fixed energy flow. Each channel represents a specific talent or life force"></span></div>
    <div class="card" style="padding:var(--space-4)">
      ${chart.activeChannels.map(ch => {
        const chKey = ch.channel || (ch.gates?.[0] + '-' + ch.gates?.[1]);
        const info = getChannelInfo(chKey);
        const chMeta = window.getChannelMeta ? getChannelMeta(chKey) : null;
        const centers = ch.centers ? '(' + ch.centers.join('↔') + ')' : (chMeta ? '(' + chMeta.centers.join('↔') + ')' : '');
        const circuitBadge = chMeta ? ` <span style="font-size:var(--font-size-xs);background:rgba(106,79,200,0.15);color:var(--accent);padding:var(--border-width-thin) 6px;border-radius:var(--space-1);font-weight:600">${chMeta.circuit}</span>` : '';
        const hexLabel = ch.gates?.length === 2 ? ch.gates.map(g => { const h = window.getGateHex ? getGateHex(g) : ''; return h ? `<span class="gate-name-tag" aria-label="Gate ${g} hexagram ${h} - ${window.getGateName ? getGateName(g) : 'Energy Blueprint gate'}">G${g} ${h}</span>` : ''; }).join(' ') : '';
        return `<div style="margin-bottom:var(--space-3)">
          <span class="pill gold">${chKey} ${centers}</span>${circuitBadge}${info ? ` <span class="channel-name">— ${info.name}</span>` : ''}
          ${hexLabel ? `<div style="margin-top:var(--space-1)">${hexLabel}</div>` : ''}
          ${info ? `<div class="channel-detail">${info.desc}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  // ── Natal Gates Section ──
  if (chart.gateActivations && Object.keys(chart.gateActivations).length) {
    // Reverse-map: gate → [{planet, line}] for personality and design sides
    const pgByGate = {};
    if (chart.personalityGates) {
      for (const [planet, data] of Object.entries(chart.personalityGates)) {
        if (data?.gate) { const g = data.gate; pgByGate[g] = pgByGate[g] || []; pgByGate[g].push({ planet, line: data.line }); }
      }
    }
    const dgByGate = {};
    if (chart.designGates) {
      for (const [planet, data] of Object.entries(chart.designGates)) {
        if (data?.gate) { const g = data.gate; dgByGate[g] = dgByGate[g] || []; dgByGate[g].push({ planet, line: data.line }); }
      }
    }
    const sortedGates = Object.keys(chart.gateActivations).map(Number).sort((a, b) => a - b);
    html += `<div class="section-header">Natal Gates <span class="icon-info help-icon" title="Your ${sortedGates.length} activated gates are the energetic themes woven permanently into your chart. Conscious (Personality) gates are your known gifts; Unconscious (Design) gates are talents others see before you do."></span></div>
    <div class="card" style="padding:var(--space-4)">
      <p style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-3);line-height:1.5">Your <strong>${sortedGates.length} natal gates</strong> create the energetic themes you carry throughout life. <strong style="color:var(--accent)">Conscious</strong> gates are your intentional gifts — themes you identify with. <strong style="color:var(--text-dim)">Unconscious</strong> gates are gifts others notice before you do.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--space-3)">
        ${sortedGates.map(g => {
          const act = chart.gateActivations[g] || chart.gateActivations[String(g)] || {};
          const name = window.getGateName ? getGateName(g) : '';
          const theme = window.GATE_THEMES?.[g] || '';
          const center = window.HD_GATE_TO_CENTER?.[g] || '';
          const isBoth = act.personality && act.design;
          const sideLabel = isBoth ? 'Conscious + Unconscious' : act.personality ? 'Conscious' : 'Unconscious';
          const pillClass = isBoth ? 'gold' : act.personality ? 'green' : '';
          const sideColor = isBoth ? 'var(--gold)' : act.personality ? 'var(--green)' : 'var(--text-muted)';
          const pPlanets = (pgByGate[g] || []).map(p => p.planet).join(', ');
          const dPlanets = (dgByGate[g] || []).map(p => p.planet).join(', ');
          const planetHint = [pPlanets && 'via ' + pPlanets + ' (C)', dPlanets && 'via ' + dPlanets + ' (U)'].filter(Boolean).join(' · ');
          const gateExpl = window.GATE_EXPLANATIONS?.[g] || '';
          return `<div style="background:var(--surface-2);border-radius:var(--border-radius);padding:var(--space-3);border:var(--border-width-thin) solid var(--border)">
              <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-1);flex-wrap:wrap">
                <span class="pill ${pillClass}">Gate ${g}</span>
                ${center ? `<span style="font-size:var(--font-size-xs);color:var(--text-muted)">${escapeHtml(center)} Center</span>` : ''}
                <span style="font-size:var(--font-size-xs);color:${sideColor};margin-left:auto;white-space:nowrap">${sideLabel}</span>
              </div>
              ${name ? `<div style="font-size:var(--font-size-sm);font-weight:700;color:var(--text);margin-bottom:4px">"${escapeHtml(name)}"</div>` : ''}
              ${gateExpl ? `<div style="font-size:var(--font-size-sm);color:var(--text);line-height:1.6;margin-bottom:${(theme || planetHint) ? '6px' : '0'}">${escapeHtml(gateExpl)}</div>` : ''}
              ${theme ? `<div style="font-size:var(--font-size-xs);color:var(--text-dim);line-height:1.4;font-style:italic;margin-bottom:${planetHint ? '4px' : '0'}">Theme: ${escapeHtml(theme)}</div>` : ''}
              ${planetHint ? `<div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:2px">${escapeHtml(planetHint)}</div>` : ''}
            </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  html += `</div>`;

  // Western Astrology block with planet explanations
  const planetMeanings = {
    Sun:     { label: 'Your Sun',     short: 'Your core identity & life force',         full: 'Your Sun sign is the central force of who you are — your ego, your vitality, what you\'re here to express. It\'s the most fundamental energy you carry.' },
    Moon:    { label: 'Your Moon',    short: 'Your emotional nature & instincts',        full: 'Your Moon sign governs your emotional world, your instincts, and what makes you feel safe and nourished. It\'s the inner you that most people don\'t see right away.' },
    Mercury: { label: 'Your Mercury', short: 'How you think & communicate',              full: 'Your Mercury sign governs your mind — how you process information, speak, write, and learn. It shapes your communication style and what your intellect focuses on.' },
    Venus:   { label: 'Your Venus',   short: 'Your values, style & way of loving',       full: 'Your Venus sign governs what you find beautiful, how you love and want to be loved, and what you value in relationships. It shapes your aesthetic and your approach to intimacy.' },
    Mars:    { label: 'Your Mars',    short: 'Your drive, desire & action',               full: 'Your Mars sign governs how you take action, pursue what you want, and deal with anger and desire. It\'s your motivational engine and your fighting spirit.' },
    Jupiter: { label: 'Your Jupiter', short: 'Where you expand, grow & find luck',       full: 'Your Jupiter sign shows where expansion and good fortune flow most naturally. It governs your philosophical beliefs, your optimism, and the areas of life where abundance tends to arrive.' },
    Saturn:  { label: 'Your Saturn',  short: 'Where you build discipline & face lessons',full: 'Your Saturn sign governs the areas of life where you face your greatest tests and build your greatest mastery. Saturn lessons are hard but they produce lasting achievement.' },
    Uranus:  { label: 'Your Uranus',  short: 'Where you break conventions & innovate',   full: 'Your Uranus sign shows where you break free from what\'s outdated and bring innovation. This planet\'s placement reveals your generation\'s revolutionary impulse.' },
    Neptune: { label: 'Your Neptune', short: 'Your dreams, spirituality & imagination',  full: 'Your Neptune sign governs your spiritual sensitivity, your imagination, and your connection to something larger than yourself. It\'s where reality gets beautifully blurry.' },
    Pluto:   { label: 'Your Pluto',   short: 'Where you transform & encounter deep power',full: 'Your Pluto sign governs deep transformation, power, and the cycles of death and rebirth. It shows where your generation is being asked to fundamentally transform.' }
  };

  function renderPlanetCard(name, data, planetMeanings) {
    const pm = planetMeanings[name] || {};
    const signInfo = window.SIGN_EXPLANATIONS?.[data.sign] || {};
    const houseInfo = data.house ? (window.HOUSE_EXPLANATIONS?.[Number(data.house)] || {}) : {};
    const symbolMap = { Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇' };
    const colorMap  = { Sun: '#FFD700', Moon: '#C0C0C0', Mercury: '#FFA500', Venus: '#FF69B4', Mars: '#FF4500', Jupiter: '#9370DB', Saturn: '#4169E1', Uranus: '#00CED1', Neptune: '#1E90FF', Pluto: '#8B4513' };
    const sym   = symbolMap[name] || name[0];
    const color = colorMap[name]  || 'var(--gold)';
    const deg   = data.degrees != null ? data.degrees.toFixed(1) + '°' : '';
    return `<div style="background:var(--surface-2);border-radius:var(--border-radius);padding:var(--space-3);border:var(--border-width-thin) solid var(--border);margin-bottom:var(--space-3)">
      <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2);flex-wrap:wrap">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${color};color:var(--bg1);font-size:16px;font-weight:bold;flex-shrink:0">${sym}</span>
        <span style="font-weight:700;color:var(--text);font-size:var(--font-size-base)">${escapeHtml(pm.label || name)}</span>
        <span style="margin-left:auto;font-size:var(--font-size-sm);color:var(--gold);font-weight:600">${escapeHtml(data.sign || '')} ${deg}${data.house ? ' · House ' + data.house : ''}</span>
      </div>
      ${pm.full ? `<p style="font-size:var(--font-size-sm);color:var(--text-dim);margin:0 0 var(--space-2);line-height:1.55">${escapeHtml(pm.full)}</p>` : ''}
      ${signInfo.full ? `<div style="background:var(--bg2);border-radius:var(--space-1);padding:var(--space-2) var(--space-3);margin-bottom:var(--space-2)">
        <div style="font-size:var(--font-size-xs);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:2px">In ${escapeHtml(data.sign || '')}</div>
        <div style="font-size:var(--font-size-sm);color:var(--text);line-height:1.55">${escapeHtml(signInfo.full)}</div>
      </div>` : ''}
      ${houseInfo.full ? `<div style="background:var(--bg2);border-radius:var(--space-1);padding:var(--space-2) var(--space-3)">
        <div style="font-size:var(--font-size-xs);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:2px">House ${data.house} — ${escapeHtml(houseInfo.name || '')}</div>
        <div style="font-size:var(--font-size-sm);color:var(--text);line-height:1.55">${escapeHtml(houseInfo.full)}</div>
      </div>` : ''}
    </div>`;
  }

  if (astro && astro.placements) {
    const planets = Object.entries(astro.placements).slice(0, 10);

    // Ascendant / Midheaven cards
    let specialHtml = '';
    if (astro.ascendant) {
      const ascSign = window.SIGN_EXPLANATIONS?.[astro.ascendant.sign] || {};
      specialHtml += `<div style="background:var(--surface-2);border-radius:var(--border-radius);padding:var(--space-3);border:var(--border-width-thin) solid var(--border);margin-bottom:var(--space-3)">
        <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#FF1493;color:#fff;font-size:11px;font-weight:700;flex-shrink:0">ASC</span>
          <span style="font-weight:700;color:var(--text);font-size:var(--font-size-base)">Your Rising Sign (Ascendant)</span>
          <span style="margin-left:auto;font-size:var(--font-size-sm);color:var(--gold);font-weight:600">${escapeHtml(astro.ascendant.sign || '')} ${astro.ascendant.degrees != null ? astro.ascendant.degrees.toFixed(1) + '°' : ''}</span>
        </div>
        <p style="font-size:var(--font-size-sm);color:var(--text-dim);margin:0 0 var(--space-2);line-height:1.55">Your Rising Sign is the mask you wear with the world — the energy people feel when they first meet you. It governs your body, your style, and how you naturally approach anything new.</p>
        ${ascSign.full ? `<div style="background:var(--bg2);border-radius:var(--space-1);padding:var(--space-2) var(--space-3)">
          <div style="font-size:var(--font-size-xs);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:2px">In ${escapeHtml(astro.ascendant.sign || '')}</div>
          <div style="font-size:var(--font-size-sm);color:var(--text);line-height:1.55">${escapeHtml(ascSign.full)}</div>
        </div>` : ''}
      </div>`;
    }
    if (astro.midheaven) {
      const mcSign = window.SIGN_EXPLANATIONS?.[astro.midheaven.sign] || {};
      specialHtml += `<div style="background:var(--surface-2);border-radius:var(--border-radius);padding:var(--space-3);border:var(--border-width-thin) solid var(--border);margin-bottom:var(--space-3)">
        <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#7B68EE;color:#fff;font-size:11px;font-weight:700;flex-shrink:0">MC</span>
          <span style="font-weight:700;color:var(--text);font-size:var(--font-size-base)">Your Midheaven (Career & Legacy)</span>
          <span style="margin-left:auto;font-size:var(--font-size-sm);color:var(--gold);font-weight:600">${escapeHtml(astro.midheaven.sign || '')} ${astro.midheaven.degrees != null ? astro.midheaven.degrees.toFixed(1) + '°' : ''}</span>
        </div>
        <p style="font-size:var(--font-size-sm);color:var(--text-dim);margin:0 0 var(--space-2);line-height:1.55">Your Midheaven is the summit of your chart — it governs your public reputation, your calling, and what you want to be known for. It\'s the direction your ambitions are meant to point.</p>
        ${mcSign.full ? `<div style="background:var(--bg2);border-radius:var(--space-1);padding:var(--space-2) var(--space-3)">
          <div style="font-size:var(--font-size-xs);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:2px">In ${escapeHtml(astro.midheaven.sign || '')}</div>
          <div style="font-size:var(--font-size-sm);color:var(--text);line-height:1.55">${escapeHtml(mcSign.full)}</div>
        </div>` : ''}
      </div>`;
    }

    html += `<div class="card">
      <div class="card-title">♈ Western Astrology</div>
      <p style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-4);line-height:1.6">Each planet represents a different facet of who you are. The <em>sign</em> it\'s in tells you HOW that energy expresses itself — like a costume the planet wears. The <em>house</em> tells you WHERE in life that energy plays out. Together, they describe a very specific part of your story.</p>
      ${specialHtml}
      ${planets.map(([p, v]) => renderPlanetCard(p, v, planetMeanings)).join('')}
    </div>`;
    
    // Add astrological chart wheel
    html += renderAstroChart(astro);
  }

  // ── Pattern Interactions (Synergies) ──
  // All four synergies derive exclusively from existing explanations.js text + structural chart facts.
  // Each answers a different question that no individual section answers alone.
  const _synergies = [];

  // ─── SYNERGY 1: The Alignment Loop ───────────────────────────────────────
  // Question: "What is the feedback loop I live in?"
  // Sources: NOT_SELF_EXPLANATIONS + STRATEGY_EXPLANATIONS + SIGNATURE_EXPLANATIONS
  // Why: These three concepts form a closed circuit — the most fundamental experiment in the system.
  // No other section assembles them together as a loop.
  {
    const _notSelfText = window.NOT_SELF_EXPLANATIONS?.[chart.notSelfTheme] || '';
    const _stratObj = window.STRATEGY_EXPLANATIONS?.[chart.strategy];
    const _stratText = (typeof _stratObj === 'object' ? _stratObj.full : _stratObj) || '';
    const _sigMap = { 'Generator':'Satisfaction', 'Manifesting Generator':'Satisfaction', 'Manifestor':'Peace', 'Projector':'Success', 'Reflector':'Surprise' };
    const _sig = _sigMap[chart.type] || '';
    const _sigText = _sig ? (window.SIGNATURE_EXPLANATIONS?.[_sig] || '') : '';
    if (_notSelfText || _stratText || _sigText) {
      const _loopParts = [
        _notSelfText && `<strong>Off-track signal — ${escapeHtml(chart.notSelfTheme || 'not-self')}:</strong> ${escapeHtml(_notSelfText)}`,
        _stratText   && `<strong>The return path — ${escapeHtml(chart.strategy || 'your strategy')}:</strong> ${escapeHtml(_stratText)}`,
        _sigText     && `<strong>Aligned state — ${escapeHtml(_sig)}:</strong> ${escapeHtml(_sigText)}`
      ].filter(Boolean);
      _synergies.push({
        title: 'The Alignment Loop',
        insight: `These three signals form a complete feedback circuit. One tells you when you have drifted. One is the route back. One confirms you have arrived.<br><br>${_loopParts.join('<br><br>')}<br><br><em style="font-size:var(--font-size-xs);color:var(--text-muted)">The entire experiment is noticing which of these three states you are in — and responding accordingly.</em>`
      });
    }
  }

  // ─── SYNERGY 2: Primary Conditioning Terrain ─────────────────────────────
  // Question: "Why do I keep living my not-self despite knowing better?"
  // Sources: CENTER_EXPLANATIONS.open (our exact text)
  // Why: Maps the not-self theme to the 1–2 open centers whose conditioning directly produces it.
  // Bridges "here is your warning signal" to "here is the specific mechanism."
  {
    const _allCenters = ['Head','Ajna','Throat','G','Heart','SolarPlexus','Sacral','Spleen','Root'];
    const _openCenters = _allCenters.filter(c => !(chart.definedCenters || []).includes(c));
    // Each not-self theme has primary conditioning centers ordered by relevance
    const _conditioningMap = {
      'Frustration':    ['G','SolarPlexus','Root'],   // direction confusion / emotional urgency / adrenaline pressure bypass the sacral
      'Bitterness':     ['Throat','Head','Ajna'],      // compulsive speaking / mental pressure = uninvited guidance
      'Anger':          ['G','Heart'],                 // direction confusion skips informing / ego-proving replaces informing
      'Disappointment': ['Sacral','SolarPlexus']       // amplified urgency / borrowed emotional certainty = decides too fast
    };
    const _relevantOpen = (_conditioningMap[chart.notSelfTheme] || []).filter(c => _openCenters.includes(c)).slice(0, 2);
    if (_relevantOpen.length > 0) {
      const _centerLabel = c => c === 'G' ? 'G (Identity)' : c === 'SolarPlexus' ? 'Solar Plexus' : c;
      const _centerParts = _relevantOpen.map(c => {
        const ce = window.CENTER_EXPLANATIONS?.[c];
        return ce ? `<strong>Open ${escapeHtml(_centerLabel(c))} Center</strong> — ${escapeHtml(ce.open)}` : null;
      }).filter(Boolean);
      if (_centerParts.length > 0) {
        _synergies.push({
          title: `Why ${escapeHtml(chart.notSelfTheme || 'Off-Track')} Keeps Returning: Your Conditioning Terrain`,
          insight: `Your open center${_relevantOpen.length > 1 ? 's are' : ' is'} the door your not-self most often walks through. This is not a flaw — it is where you are most sensitive and most susceptible to absorbing energy from others as if it were your own signal:<br><br>${_centerParts.join('<br><br>')}<br><br>When you notice ${escapeHtml(lowerText(chart.notSelfTheme, 'that signal'))}, the first question is: am I running on my own ${escapeHtml((chart.authority || 'authority').replace(' Authority',''))} — or on energy I absorbed through ${_relevantOpen.length > 1 ? 'these centers' : 'this center'}?`
        });
      }
    }
  }

  // ─── SYNERGY 3: How Your Energy Reaches Expression ───────────────────────
  // Question: "How does my energy naturally want to reach the world?"
  // Sources: CHANNEL_DESCRIPTIONS + CENTER_EXPLANATIONS.Throat (our exact text)
  // Why: Whether a motor connects to the Throat is one of the most behaviorally observable
  // differences between people — it explains why some naturally fill silence and others wait.
  // Three clean structural cases: motor-Throat / defined-without-motor / open Throat.
  {
    const _motorThroatMap = { '20-34':'Sacral','34-20':'Sacral','12-22':'Solar Plexus','22-12':'Solar Plexus','21-45':'Heart','45-21':'Heart' };
    const _activeKeys = (chart.activeChannels || []).map(ch => ch.channel || ((ch.gates?.[0] || '') + '-' + (ch.gates?.[1] || '')));
    const _motorThroatKey = _activeKeys.find(k => _motorThroatMap[k]);
    const _throatDefined = (chart.definedCenters || []).includes('Throat');
    const _throatCE = window.CENTER_EXPLANATIONS?.['Throat'];

    if (_motorThroatKey) {
      const _chInfo = typeof getChannelInfo === 'function' ? getChannelInfo(_motorThroatKey) : null;
      const _motor = _motorThroatMap[_motorThroatKey];
      _synergies.push({
        title: `Expression Pathway: Motor-to-Throat via ${_chInfo?.name || _motorThroatKey}`,
        insight: `Your ${escapeHtml(_chInfo?.name || _motorThroatKey)} channel (${escapeHtml(_motorThroatKey)}) runs a direct line from your ${escapeHtml(_motor)} center to your Throat.${_chInfo?.desc ? ' ' + escapeHtml(_chInfo.desc) : ''} This means your expression carries its own fuel — you can initiate conversation, speak in the moment, and fill silence from a genuine internal source. The risk: because the motor is always ready, it is easy to speak ahead of your authority. The motor activates expression; your ${escapeHtml((chart.authority || '').replace(' Authority',''))} is still the one that should govern what you say and when.`
      });
    } else if (_throatDefined) {
      const _defCh = (chart.activeChannels || []).find(ch => {
        const k = ch.channel || ((ch.gates?.[0] || '') + '-' + (ch.gates?.[1] || ''));
        const meta = typeof getChannelMeta === 'function' ? getChannelMeta(k) : null;
        return meta?.centers?.includes('Throat');
      });
      const _defChInfo = _defCh ? (typeof getChannelInfo === 'function' ? getChannelInfo(_defCh.channel || ((_defCh.gates?.[0] || '') + '-' + (_defCh.gates?.[1] || ''))) : null) : null;
      _synergies.push({
        title: 'Expression Pathway: Defined Throat (Guidance-Driven)',
        insight: `${_throatCE?.defined ? escapeHtml(_throatCE.defined) + ' ' : ''}${_defChInfo ? `Your Throat is connected through the ${escapeHtml(_defChInfo.name)} channel — ${escapeHtml(_defChInfo.desc)} ` : ''}Because no motor runs directly into your Throat, your expression is most powerful when it arises from recognition, genuine response, or invitation — not self-generated force. The consistency is there; what determines impact is timing, not volume.`
      });
    } else {
      _synergies.push({
        title: 'Expression Pathway: Open Throat',
        insight: `${_throatCE?.open ? escapeHtml(_throatCE.open) + ' ' : ''}An open Throat means your expression adapts fluidly to context — and people often notice your voice more than you realise. The shadow is chasing the feeling of being heard by speaking too much or too soon. Your most memorable expression tends to arrive when you are not trying to fill silence, but responding to what is genuinely in front of you.`
      });
    }
  }

  // ─── SYNERGY 4: The Inner Tension of Your Life Role ──────────────────────
  // Question: "What is the core inner tension I navigate in my daily life?"
  // Sources: PROFILE_EXPLANATIONS (our text) + line archetype knowledge per specific pair
  // Why: People feel this line-tension in their bones but have no language for it.
  // The WTMFY card uses the combined profile description — this unpacks the friction between the two lines.
  {
    const _profileStr = chart.profile || '';
    const _profileParts = _profileStr.split('/');
    const _L1 = parseInt(_profileParts[0] || '0');
    const _L2 = parseInt(_profileParts[1] || '0');
    const _profileEntry = window.PROFILE_EXPLANATIONS?.[_profileStr];
    const _profileFull = _profileEntry ? (typeof _profileEntry === 'object' ? _profileEntry.full : _profileEntry) : '';

    const _profileTensions = {
      '1/3': 'Your Investigator nature (Line 1) needs a solid foundation of knowledge to feel secure — but your Martyr path (Line 3) learns by having things break. These two forces are in conversation, not conflict. You research to build solid ground; life breaks something; you research why it broke and build better. Every ending and failure is data. This cycle never fully stops, but what it produces is wisdom that purely theoretical people cannot reach.',
      '1/4': 'Your deep investigative capacity (Line 1) powers your influence through relationships (Line 4). Without the research, your network reach feels hollow to you. Without the network, your knowledge stays private. The tension you navigate daily: when to keep studying versus when to bring what you know into your connections. Both are always necessary — they take turns being urgent.',
      '2/4': 'Your natural genius develops in genuine solitude (Line 2) — but it reaches its full expression only through your network (Line 4). The tension: people call you out before you feel ready, and retreating can feel selfish when your relationships need you. Honour the hermit\'s timing. The network benefits far more from what emerges in solitude than from what you produce under pressure.',
      '2/5': 'Natural gifts formed in private (Line 2) meet a public projection field where others place expectations on you whether you invited it or not (Line 5). The tension: your best work happens in solitude, but the world keeps calling you to perform publicly before you feel prepared. Guard your alone time. The projection field will have something real to meet only if the hermit is well-tended.',
      '3/5': 'You learn by having bonds break — projects, paths, relationships (Line 3) — while others project practical expectations onto you (Line 5). The tension: your path requires visible experimentation and visible failure, which can erode the projections others hold. This is by design. The hard-won practical knowledge your path produces eventually fulfils the projection more completely than any smooth trajectory could. Trust the mess.',
      '3/6': 'Relentless experimentation and bond-breaking (Line 3) feeds a three-phase arc toward embodied wisdom (Line 6). The tension: the 3 line wants to experiment and break, yet the 6 line has a structure — roughly 30 years of active learning, then a withdrawal and integration period, then emergence as a living example. Your early failures are curriculum for the person you will eventually embody. The mess is not wasted.',
      '4/6': 'Your network is central to everything (Line 4) — but the three-phase 6-line arc means your community changes substantially at each life phase. The tension: your depth of loyalty to relationship meets a design that keeps renewing your world. This is not loss. The people and contexts of each phase are precisely what that phase requires, and your network-building instinct ensures each transition has roots.',
      '4/1': 'Influence through relationships (Line 4) is backed by deep investigative capacity (Line 1) — but here the numbers are transposed, meaning you move into relationship first and build knowledge foundation second. The tension: your network may grant you influence before you feel you have fully earned it. The 1 line is your answer — keep researching. Depth backs up what your connections open the door for.',
      '5/1': 'Others project practical savior expectations onto you whether you invite it or not (Line 5), and your deep investigative capacity (Line 1) gives you genuine ability to fulfil them. The tension: when you fall short of those projections, the disengagement is sharp. Your insurance is preparation — the more thoroughly you have studied, the more you can actually deliver on what is expected. Study is not optional for you; it is load-bearing.',
      '5/2': 'Public projections draw you out of the solitude where your natural gifts develop (Line 2 meeting Line 5). The tension: your best contribution forms in private, but the world expects consistent public availability. You will often feel pulled in both directions simultaneously. The hermit is your source. Protect it, and the projection field will have something genuine to meet when it calls.',
      '6/2': 'A three-phase arc toward embodied wisdom (Line 6) combined with natural gifts that develop in isolation (Line 2). The tension: the second phase of the 6-line arc — the rooftop withdrawal and integration period — aligns with the hermit\'s deepest need for solitude. This is your integration phase, not a detour. The gifts you build privately across your life become the lived teaching you embody in the third phase.',
      '6/3': 'Relentless experimentation and bond-breaking (Line 3) building toward a three-phase arc of embodied wisdom (Line 6). The tension: the 3 line\'s chaos and the 6 line\'s structure seem incompatible — but they are the same engine. Every bond that breaks in the early phase produces wisdom that cannot be theorised, only lived. By the third phase, your authority to guide others comes precisely from having navigated what others are afraid to approach.'
    };

    const _tension = _profileTensions[_profileStr];
    if (_tension && _L1 && _L2) {
      _synergies.push({
        title: `Profile ${escapeHtml(_profileStr)} — Line ${_L1} × Line ${_L2}: The Core Tension`,
        insight: `${_tension}${_profileFull ? `<br><br><span style="font-size:var(--font-size-xs);color:var(--text-muted)">${escapeHtml(_profileFull)}</span>` : ''}`
      });
    }
  }

  // Render synergies card
  if (_synergies.length > 0) {
    html += `<div class="card" style="border-left:var(--space-1) solid var(--accent);margin-top:var(--space-4)">
    <div class="card-title">🔗 Pattern Interactions</div>
    <p style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-4);line-height:1.6">Your chart's elements don't work in isolation — they interact. These are the structural patterns that explain the texture of your daily experience.</p>
    ${_synergies.map((s, i) => `<div style="margin-bottom:var(--space-4)${i < _synergies.length - 1 ? ';padding-bottom:var(--space-4);border-bottom:var(--border-width-thin) solid var(--border)' : ''}">
      <div style="font-size:var(--font-size-sm);font-weight:700;color:var(--accent);margin-bottom:var(--space-2)">${escapeHtml(s.title)}</div>
      <p style="font-size:var(--font-size-sm);color:var(--text);line-height:1.75;margin:0">${s.insight}</p>
    </div>`).join('')}
  </div>`;
  }

  // "What This Means For You" synthesis summary
  const definedCount = chart.definedCenters?.length || 0;
  const openCount = 9 - definedCount;
  const channelCount = chart.activeChannels?.length || 0;
  const crossDisplay = (() => {
    const n = chart.cross?.name || (typeof chart.cross === 'string' ? chart.cross : null);
    const sg = chart.cross?.gates?.[0] || chart.personalitySunGate;
    const sl = chart.cross?.line || chart.personalitySunLine;
    return n || (sg && sl && typeof getCrossName === 'function' ? getCrossName(sg, sl) : '') || '';
  })();
  const motorCenters = (chart.definedCenters || []).filter(c => typeof isMotorCenter === 'function' && isMotorCenter(c));

  // Per-type deeper guidance
  const typeGuidance = {
    'Generator': 'Builder Pattern: Your chart reveals the most abundant and consistent life-force energy in the system. This pattern suggests you thrive when you master things you genuinely love — the key word is <em>genuinely</em>. When you are engaged with work or a project that lights you up, your energy feels renewable and your impact multiplies. When you are doing things out of obligation or to please others, the data suggests you drain. The Sacral gut response is your compass: pay attention to sounds and sensations your body makes before your mind catches up.',
    'Manifesting Generator': 'Builder-Initiator Pattern: Your data shows a rare combination — the sustained life force of a Builder with the initiating impulse of a Catalyst. This pattern suggests you move faster than almost anyone and can do multiple things simultaneously without losing quality. The trap is initiating from the mind rather than from a gut response. You skip steps others cannot, and that is fine — but this pattern works best when you wait for a clear sacral yes before starting. Let life show you the opening, then explode into it. Frustration or anger signals you\'ve been trying to push through on pure willpower.',
    'Projector': 'Guide Pattern: Your chart points to a natural ability to see systems and people more clearly than they see themselves. This pattern suggests you\'re not designed to match a Builder\'s output — your power is concentrated, not continuous. The invitation matters enormously: when someone genuinely asks for your guidance, your insights land deep. When you give guidance uninvited, even correct guidance, it creates resistance. Rest without guilt. Your clarity comes from withdrawal as much as engagement.',
    'Manifestor': 'Catalyst Pattern: Your data reveals a closed, initiating energy field. This pattern suggests you are designed to initiate new things that others then carry forward. Others may feel like you are moving too fast or operating in secret — even when you\'re not. The fix is simple and transformative: inform the people who will be affected by your actions before you act. A quick "I\'m about to do X" dissolves the resistance that builds around your natural energy. Anger signals you\'ve been suppressing your instinct to move.',
    'Reflector': 'Mirror Pattern: Your chart shows the rarest configuration — all centers open. This pattern suggests you reflect and amplify the energy of your environment. Less than 1% of people share this design. You are the most sensitive barometer in any environment, and your feelings about a place or group are genuinely accurate readings of that community\'s health. Protect your environment fiercely. Never rush major decisions — this pattern works best when you wait the full 28-day lunar cycle, talking to many different people until clarity arrives on its own.'
  };

  // Per-authority deeper guidance
  const authorityGuidance = {
    'Emotional': 'Emotional Wave Navigation: Your chart data suggests clarity comes through emotional cycles rather than in a single moment. This pattern works best when you avoid committing at the peak of excitement or the depth of fear. Sleep on decisions, then sleep on them again. When the emotional wave has settled and you still feel a quiet "yes," that yes is trustworthy. The phrase "I need time to feel this through" is power, not weakness.',
    'Emotional Authority': 'Emotional Wave Navigation: Your chart data suggests clarity comes through emotional cycles rather than in a single moment. This pattern works best when you avoid committing at the peak of excitement or the depth of fear. Sleep on decisions, then sleep on them again. When the emotional wave has settled and you still feel a quiet "yes," that yes is trustworthy. The phrase "I need time to feel this through" is power, not weakness.',
    'Sacral': 'Life Force Response: Your chart points to a body-based yes/no signal that speaks before your mind does. Listen for sounds — an "uh-huh" in your throat or chest when life offers something aligned, an "unh-unh" when it doesn\'t. Ask yourself yes/no questions out loud and notice what your body does. This pattern suggests the sacral speaks once, in the present tense. It does not debate.',
    'Sacral Authority': 'Life Force Response: Your chart points to a body-based yes/no signal that speaks before your mind does. Listen for sounds — an "uh-huh" in your throat or chest when life offers something aligned, an "unh-unh" when it doesn\'t. Ask yourself yes/no questions out loud and notice what your body does. This pattern suggests the sacral speaks once, in the present tense. It does not debate.',
    'Splenic': 'Intuitive Knowing: Your chart reveals one of the quietest inner signals in the system. It speaks once, in the moment, as a faint knowing or a sudden "that\'s off" feeling. It never repeats itself. If you wait to hear it again — it will be gone. This pattern suggests trusting the first instinct even when you can\'t explain it logically. Your body\'s survival intelligence is older and faster than your conscious mind.',
    'Splenic Authority': 'Intuitive Knowing: Your chart reveals one of the quietest inner signals in the system. It speaks once, in the moment, as a faint knowing or a sudden "that\'s off" feeling. It never repeats itself. If you wait to hear it again — it will be gone. This pattern suggests trusting the first instinct even when you can\'t explain it logically. Your body\'s survival intelligence is older and faster than your conscious mind.',
    'Self-Projected': 'Voiced Truth: Your data suggests you find clarity by speaking your truth out loud. Not to get advice — to hear yourself. Talk through important decisions with a trusted person who will listen rather than give opinions. As you speak, your authentic direction reveals itself in your own voice. The answer is always already in you.',
    'Ego': 'Willpower Alignment: Your chart shows a rare consistent willpower center. Your "I want" or "I don\'t want" is not selfishness — this pattern suggests it is your navigation system. What the heart genuinely wants leads you correctly. What the heart genuinely rejects leads you to depletion. Commit only to what you will actually do.',
    'Mental': 'Your chart suggests your truth comes from your environment, not from within. There\'s no single internal oracle — this pattern works best when you talk through decisions with many different people and gather perspectives. The answer emerges from the conversation, not from any one voice. Choose your sounding boards wisely.',
    'Lunar': 'Lunar Cycle Awareness: Your chart suggests your clarity unfolds over a full lunar cycle. This pattern works best when you live with a decision for a full month before acting on it. Talk to many different people as the moon moves through each gate — each person mirrors back a different facet of the choice. When the cycle completes and the feeling is consistent, you have your answer.'
  };

  // Definition-type social dynamics
  const definitionGuidance = {
    'Single': 'Single Definition: Your chart shows all defined centers connected in one continuous circuit. This pattern suggests you process information in a consistent, self-contained way — you rarely need others to feel complete. You can be misread as self-sufficient to a fault. Give others time to catch up to your internal processing speed.',
    'Split': 'Bridging Pattern: Your chart shows two separate areas of definition with a gap between them. This pattern suggests you naturally seek people who bridge that gap, often feeling more whole in their presence. This is not weakness — it is your design. Just be aware that bridgers can feel essential even when the relationship isn\'t right for you. Take time to check your authority before committing.',
    'Triple Split': 'Triple Bridging Pattern: Your chart reveals three separate circuitry areas. This pattern suggests you need a variety of different people to feel the full range of your chart activated. No single person will ever complete you — and that is perfect. This design thrives in rich social ecosystems. Patience is required: your complex inner life needs more time to process and decide.',
    'Quadruple Split': 'Quadruple Bridging Pattern: Your chart shows the most complex circuitry in the system. This pattern suggests you are deeply fixed in your nature, slow to decide, and thorough. You require great diversity in your social environment to activate all four areas of your chart. Rushing any major life decision will almost always cost you. Your depth is your superpower.',
    'No Definition': 'Open Flow: Your chart shows no fixed definition — every person you spend time with activates different parts of your chart temporarily. This pattern suggests you are not inconsistent — you are environmental. Your open design gives you the gift of experiencing life through enormous variety. Guard your sleep environment above all else: who you sleep next to literally shapes your biology.'
  };

  // Build active channel titles as concrete talent list
  const channelTalents = (chart.activeChannels || []).map(ch => {
    const chKey = ch.channel || (ch.gates?.[0] + '-' + ch.gates?.[1]);
    const info = typeof getChannelInfo === 'function' ? getChannelInfo(chKey) : null;
    return info ? `<strong>${info.name}</strong>` : `Channel ${chKey}`;
  });

  html += `<div class="card" style="border-left:var(--space-1) solid var(--gold);margin-top:var(--space-5)">
    <div class="card-title"><span class="icon-chart"></span> What This Means For You</div>
    <div style="font-size:var(--font-size-base);color:var(--text);line-height:1.75">

      <p style="margin:0 0 var(--space-4);font-size:var(--font-size-sm);color:var(--text-muted);font-style:italic">This is a plain-language synthesis of everything your chart reveals. Use it as a starting map, not a fixed verdict. Experiment with what resonates — your lived experience is always the final authority.</p>

      <h4 style="font-size:var(--font-size-sm);font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 var(--space-2)">Your Energy Type — ${escapeHtml(chart.type || '—')}</h4>
      <p style="margin:0 0 var(--space-4)">${typeGuidance[chart.type] || 'You carry a unique energy blueprint. Follow your strategy and authority above all else — your type is the operating system; those two are the applications.'}</p>

      <h4 style="font-size:var(--font-size-sm);font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 var(--space-2)">Your Inner Authority — ${escapeHtml(chart.authority || '—')}</h4>
      <p style="margin:0 0 var(--space-4)">${authorityGuidance[chart.authority] || 'Your authority is the specific inner signal your design uses to guide you toward correct decisions. Trust it above reasoning, above other people\'s advice, above urgency.'}</p>

      <h4 style="font-size:var(--font-size-sm);font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 var(--space-2)">Your Life Role — Profile ${escapeHtml(chart.profile || '—')}</h4>
      <p style="margin:0 0 var(--space-4)">${window.PROFILE_EXPLANATIONS?.[chart.profile] ? (typeof window.PROFILE_EXPLANATIONS[chart.profile] === 'object' ? window.PROFILE_EXPLANATIONS[chart.profile].full : window.PROFILE_EXPLANATIONS[chart.profile]) : 'Your profile describes the archetypal costume you wear in this lifetime — the energetic role you naturally play in every room you enter.'}</p>

      <h4 style="font-size:var(--font-size-sm);font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 var(--space-2)">Your Circuitry — ${escapeHtml(chart.definition || '—')}</h4>
      <p style="margin:0 0 var(--space-4)">${definitionGuidance[chart.definition] || `You have <strong>${definedCount} defined</strong> and <strong>${openCount} open</strong> center${openCount !== 1 ? 's' : ''}. Open centers sample and amplify the energies of those around you; defined centers express consistently regardless of who is present.`}${motorCenters.length ? ` Your ${motorCenters.length > 1 ? motorCenters.length + ' motor centers' : 'motor center'} (${motorCenters.join(', ')}) ${motorCenters.length > 1 ? 'give' : 'gives'} you consistent drive — reliable fuel that does not depend on external motivation.` : ''}</p>

      ${channelTalents.length ? `<h4 style="font-size:var(--font-size-sm);font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 var(--space-2)">Your Fixed Gifts — ${channelCount} Active Channel${channelCount !== 1 ? 's' : ''}</h4>
      <p style="margin:0 0 var(--space-4)">These are not interests or preferences — they are wired-in capacities you carry 24 hours a day: ${channelTalents.join(', ')}. These themes will recur throughout your life in different forms. When others comment on one of these qualities in you⁠ — even unsolicited — pay attention. You are likely in your correct flow.</p>` : ''}

      ${crossDisplay ? `<h4 style="font-size:var(--font-size-sm);font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 var(--space-2)">Your Life Purpose — ${escapeHtml(crossDisplay)}</h4>
      <p style="margin:0 0 var(--space-4)">The <strong>${escapeHtml(crossDisplay)}</strong> is the overarching theme your soul is here to live out. It is not a job title or a spiritual mission statement you force — it is the current that runs beneath all your choices when you are in alignment. ${chart.cross?.type ? `As a <strong>${escapeHtml(chart.cross.type)}</strong>, ${lowerText(window.CROSS_TYPE_EXPLANATIONS?.[chart.cross.type])}` : ''}</p>` : ''}

      <div style="background:var(--bg3);border-radius:var(--radius);padding:var(--space-4);margin-top:var(--space-2);border-left:3px solid var(--accent)">
        <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--space-2)">⚡ Your Experiment Starts Here</div>
        <p style="margin:0 0 var(--space-2);font-size:var(--font-size-sm);color:var(--text)">For the next 30 days, commit to one thing: follow your <strong>${escapeHtml(chart.strategy || 'strategy')}</strong> — and nothing else from this chart. Don't think about gates, channels, or profile lines yet.</p>
        <p style="margin:0;font-size:var(--font-size-sm);color:var(--text-dim)">When you feel <em>${escapeHtml(lowerText(chart.notSelfTheme, 'out of alignment'))}</em>, treat it as feedback — not failure. That feeling is your chart asking you to return to your strategy. Notice the pattern. The rest of your design becomes clear from there.</p>
      </div>
    </div>
    <button class="btn-primary" style="margin-top:var(--space-4);font-size:var(--font-size-base);padding:var(--space-2) 20px" data-action="openLastShareCard">
      📤 Share Your Design
    </button>
  </div>`;

  // Store chart data for share card
  window._lastChart = chart;

  // Meta
  if (meta.chartId) {
    html += `<div class="alert alert-success"><span class="icon-check"></span> Chart saved (ID: ${meta.chartId})</div>`;
  }

  // UX-006: CTA card linking chart → AI profile generation
  html += `<div class="card" style="margin-top:var(--space-5);background:linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(158,107,0,0.05) 100%);border:2px solid var(--gold);border-radius:var(--radius)">
    <div style="display:flex;align-items:center;gap:var(--space-4);flex-wrap:wrap">
      <div style="flex:1;min-width:280px">
        <h3 style="margin:0 0 var(--space-2);font-size:var(--font-size-lg);color:var(--gold);font-weight:700">✦ What's next?</h3>
        <p style="margin:0 0 var(--space-3);font-size:var(--font-size-base);color:var(--text);line-height:1.6">Your chart is calculated. Now unlock your personalized AI Profile — a synthesis of your gates, channels, and cross tailored to your exact design.</p>
        <button class="btn-primary" style="font-size:var(--font-size-base);padding:var(--space-2) var(--space-4)" onclick="switchTab('profile');document.getElementById('profileBtn')?.focus()">
          Generate Your AI Profile →
        </button>
      </div>
      <div style="display:none;flex-shrink:0;text-align:center;font-size:48px" aria-hidden="true">✦</div>
    </div>
  </div>`;

  html += rawToggle(data);
  return html;
}

// ── Chart History (AUDIT-UX-003) ──────────────────────────────
async function loadChartHistory() {
  if (!token) return;
  const section = document.getElementById('chartHistorySection');
  const list = document.getElementById('chartHistoryList');
  if (!section || !list) return;

  list.innerHTML = '<span class="spinner"></span> Loading…';
  section.style.display = '';

  try {
    const data = await apiFetch('/api/chart/history');
    if (!data.charts?.length) {
      list.innerHTML = '<p style="color:var(--text-dim)">No previous charts found.</p>';
      return;
    }
    list.innerHTML = data.charts.map(c => {
      const date = new Date(c.calculatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const typeBadge = c.type ? `<span style="color:var(--gold);font-weight:600">${escapeHtml(c.type)}</span> · ` : '';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
        <div>${typeBadge}<span style="color:var(--text-dim)">${date}</span></div>
        <button class="btn-secondary btn-sm" data-action="loadChartById" data-arg0="${escapeAttr(c.id)}">View</button>
      </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = '<p style="color:var(--text-dim)">Could not load chart history.</p>';
  }
}

async function loadChartById(chartId) {
  if (!token || !chartId) return;
  const resultEl = document.getElementById('chartResult');
  if (!resultEl) return;

  resultEl.innerHTML = '<div style="text-align:center;padding:var(--space-6)"><span class="spinner"></span> Loading chart…</div>';

  try {
    const resp = await apiFetch('/api/chart/' + encodeURIComponent(chartId));
    if (!resp?.data) {
      resultEl.innerHTML = '<div class="alert alert-warn">Could not load chart.</div>';
      return;
    }
    const d = resp.data;
    const combined = Object.assign({}, d.hdChart, { astro: d.astroChart, meta: { chartId: d.id } });
    resultEl.innerHTML = renderChart(combined);
    _applyChartHeadings(resultEl);
    const chart = d.hdChart?.chart || d.hdChart;
    if (typeof renderBodygraph === 'function' && chart) renderBodygraph(chart);
    window._lastChart = chart;
  } catch (e) {
    resultEl.innerHTML = '<div class="alert alert-warn">Failed to load chart: ' + escapeHtml(e.message) + '</div>';
  }
}

// ── Profile Generator ─────────────────────────────────────────
async function generateProfile() {
  if (!token) {
    openAuthOverlay();
    document.getElementById('authError').textContent = window.t('auth.signInRequired');
    return;
  }

  const btn = document.getElementById('profileBtn');
  const spinner = document.getElementById('profileSpinner');
  const resultEl = document.getElementById('profileResult');

  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = '';
  if (resultEl) {
    resultEl.setAttribute('aria-busy', 'true');
    // ACC-P2-11: Announce specific operation to screen readers
    const statusId = 'profileGenStatus';
    let statusEl = document.getElementById(statusId);
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = statusId;
      statusEl.className = 'visually-hidden';
      statusEl.setAttribute('aria-live', 'polite');
      statusEl.setAttribute('aria-atomic', 'true');
      resultEl.appendChild(statusEl);
    }
    statusEl.textContent = 'Generating your personalized energy profile with AI synthesis...';
    if (!resultEl.getAttribute('aria-describedby')?.includes(statusId)) {
      const existing = resultEl.getAttribute('aria-describedby') || '';
      resultEl.setAttribute('aria-describedby', (existing + ' ' + statusId).trim());
    }
    resultEl.innerHTML = skeletonProfile();
  }

  // Progress indicator: cycles every 8s, covers 45s timeout window (BL-EXC-P0-3)
  const progressMessages = [
    { delay: 0,     message: 'Reading your gates...' },
    { delay: 8000,  message: 'Interpreting your profile lines...' },
    { delay: 16000, message: 'Mapping planetary influences...' },
    { delay: 24000, message: 'Synthesizing Frequency Keys insights...' },
    { delay: 32000, message: 'Writing your synthesis...' },
    { delay: 40000, message: 'Almost ready...' },
  ];

  // Set up progress message updates
  const progressTimeouts = progressMessages.map(({ delay, message }) =>
    setTimeout(() => {
      const progressEl = resultEl.querySelector('.profile-progress-message');
      if (progressEl) {
        progressEl.textContent = message;
      }
    }, delay)
  );

  // Auto-geocode if location text is present but coordinates not yet resolved
  if (isNaN(parseFloat(document.getElementById('p-lat').value))) {
    if (document.getElementById('p-location').value.trim()) {
      await geocodeLocation('p');
    }
    if (isNaN(parseFloat(document.getElementById('p-lat').value))) {
      // Clear progress timeouts
      progressTimeouts.forEach(clearTimeout);
      if (resultEl) {
        resultEl.innerHTML =
          '<div class="alert alert-error"><span class="icon-info"></span> ' + window.t('chart.lookUpFirst') + '</div>';
        resultEl.removeAttribute('aria-busy');
      }
      if (btn) btn.disabled = false;
      if (spinner) spinner.style.display = 'none';
      return;
    }
  }

  try {
    const payload = {
      birthDate: document.getElementById('p-date').value,
      birthTime: document.getElementById('p-time').value,
      birthTimezone: document.getElementById('p-tz').value,
      lat: parseFloat(document.getElementById('p-lat').value),
      lng: parseFloat(document.getElementById('p-lng').value),
    };
    const q = document.getElementById('p-question').value.trim();
    if (q) payload.question = q;

    payload.systemPreferences = getSystemPreferences();

    // Abort after 45s — prevents infinite spinner on slow or timed-out AI calls (BL-EXC-P0-3)
    const controller = new AbortController();

    // ACC-P2-10: Timeout warning at 42s (3s before 45s abort)
    const warningTimeout = setTimeout(() => {
      if (resultEl && resultEl.getAttribute('aria-busy') === 'true') {
        const warningEl = document.createElement('div');
        warningEl.className = 'alert alert-warn';
        warningEl.setAttribute('role', 'alert');
        warningEl.setAttribute('aria-live', 'assertive');
        warningEl.style.padding = '12px 16px';
        warningEl.style.marginBottom = 'var(--space-4)';
        warningEl.innerHTML = '⏱️ Taking longer than expected... (will time out in 3 seconds)';
        const existingWarning = resultEl.querySelector('[aria-live="assertive"]');
        if (existingWarning) existingWarning.remove();
        resultEl.insertBefore(warningEl, resultEl.firstChild);
      }
    }, 42_000);

    const abortTimeout = setTimeout(() => controller.abort(), 45_000);

    let data;
    try {
      data = await apiFetch('/api/profile/generate', { method: 'POST', body: JSON.stringify(payload), signal: controller.signal });
    } finally {
      clearTimeout(abortTimeout);
      clearTimeout(warningTimeout);
    }

    // Clear any remaining progress timeouts
    progressTimeouts.forEach(clearTimeout);

    // Detect timeout — show retry and fallback (BL-EXC-P0-3)
    if (data && data.error && /abort/i.test(data.error)) {
      if (resultEl) {
        resultEl.innerHTML = `<div class="alert alert-warn" style="padding:16px">
        <strong>AI synthesis timed out.</strong>
        <p style="margin:8px 0 12px">This can happen when AI is under load. Your chart data is ready.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-secondary btn-sm" onclick="generateProfile()">Try again</button>
          <button class="btn-dim btn-sm" onclick="switchTab('chart')">View chart without synthesis</button>
        </div>
      </div>`;
        resultEl.removeAttribute('aria-busy');
        // Clear the status announcement
        const statusEl = document.getElementById('profileGenStatus');
        if (statusEl) statusEl.textContent = '';
      }
      return;
    }

    if (resultEl) {
      resultEl.innerHTML = renderProfile(data);
      resultEl.removeAttribute('aria-busy');
      // Clear the status announcement
      const statusEl = document.getElementById('profileGenStatus');
      if (statusEl) statusEl.textContent = '';
    }
    trackEvent('profile', 'generate');
    markJourneyMilestone('profileGenerated');
    updateStepGuide('profile');
    checkAndShowReferralPrompt(); // Phase 2C
    setTimeout(() => _maybeShowPushOptIn('profile'), 2000); // WC-P1-3
  } catch (e) {
    // Clear progress timeouts on error
    progressTimeouts.forEach(clearTimeout);
    if (resultEl) {
      resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
      resultEl.removeAttribute('aria-busy');
    }
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

function renderProfile(data) {
  if (window.DEBUG) console.log('[Profile] renderProfile called - Version 2.1');
  if (window.DEBUG) console.log('Raw data:', data);
  
  if (data.error) return `<div class="alert alert-error">API Error: ${escapeHtml(data.error)}<br><small>${escapeHtml(data.message || '')}</small></div>`;

  // Ensure we're working with the data payload (handle potential wrappers)
  const payload = data.data || data;
  const qsg = payload.quickStartGuide;
  const ti = payload.technicalInsights;
  const chartSummary = payload.chart || {};
  const meta = payload.meta || {};

  // Debug logging
  if (window.DEBUG) console.log('Profile data:', { hasQSG: !!qsg, hasTI: !!ti, qsg, ti, payload });

  // Check if data exists (null/undefined, not just empty objects)
  if ((qsg === null || qsg === undefined) && (ti === null || ti === undefined)) {
    window.DEBUG && console.warn('[Profile] No profile data found - showing raw response');
    return `<div class="alert alert-warn">Profile generation returned no data. Raw response below.</div>` + rawToggle(data);
  }
  
  if (window.DEBUG) console.log('✅ Profile data valid - rendering...');

  let html = '';

  // Synthesis opener — felt statement before technical content (Phase 1A)
  if (qsg?.whoYouAre) {
    html += `<div class="card synthesis-opener" style="border-left:3px solid var(--gold);padding:1.5rem">
      <p style="font-size:1.15rem;line-height:1.7;margin:0 0 0.5rem;font-style:italic">${escapeHtml(qsg.whoYouAre)}</p>
      <p style="font-size:0.8rem;color:var(--text-dim);margin:0">Your full blueprint follows below — <button class="link-btn" data-action="scrollToProfile">skip to details ↓</button></p>
    </div>`;
  }

  // Chart summary banner
  html += `<div class="card">
    <div class="card-title"><span class="icon-profile"></span> Prime Self Profile</div>
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-4)">`;
  if (chartSummary.type) html += `<span class="pill gold">${escapeHtml(chartSummary.type)}</span>`;
  if (chartSummary.authority) html += `<span class="pill">${escapeHtml(chartSummary.authority)}</span>`;
  if (chartSummary.profile) html += `<span class="pill">${escapeHtml(chartSummary.profile)} Archetype</span>`;
  if (chartSummary.definition) html += `<span class="pill">${escapeHtml(chartSummary.definition)}</span>`;
  if (chartSummary.cross) html += `<span class="pill" style="font-size:var(--font-size-sm)">${escapeHtml(chartSummary.cross)}</span>`;
  html += `</div>`;

  // Systems-used ribbon (read from request payload echoed back, or from local prefs)
  const _sysPref = getSystemPreferences ? getSystemPreferences() : null;
  if (_sysPref) {
    const _SYS_LABELS = {
      astrology: '☉ Astrology', geneKeys: '🔑 Frequency Keys', numerology: '# Numerology',
      vedic: '☽ Vedic', ogham: '᚛ Ogham', mayan: '◎ Mayan', bazi: '☯ BaZi',
      sabian: '◉ Sabian', chiron: '⚷ Chiron', lilith: '🌑 Lilith',
      transits: '↻ Transits', psychometrics: '⬡ Psychology', behavioral: '★ Behavioral', diary: '📖 Life Events'
    };
    const _OPTIONAL_KEYS = Object.keys(_SYS_LABELS);
    const activeNames = _OPTIONAL_KEYS.filter(k => _sysPref[k] !== false).map(k => _SYS_LABELS[k]);
    const offCount = _OPTIONAL_KEYS.length - activeNames.length;
    if (offCount > 0) {
      html += `<div style="margin-top:var(--space-2);display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        <span style="font-size:var(--font-size-xs);color:var(--text-dim)">Synthesized from:</span>
        ${activeNames.map(n => `<span class="pill" style="font-size:var(--font-size-xs)">${escapeHtml(n)}</span>`).join('')}
      </div>`;
    }
  }

  html += `</div>`; // close card

  // Blueprint Composition Wheel
  html += renderSystemsWheel(payload, typeof getSystemPreferences === 'function' ? getSystemPreferences() : null);

  // ═══ QUICK START GUIDE (Layer 1 - Human-Friendly) ═══
  if (qsg) {
    html += `<div class="card">
      <div class="card-title"><span class="icon-star"></span> Your Quick Start Guide</div>
      <p style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-5)">Beginner-friendly overview — no jargon, just practical insights.</p>
      <p style="font-size:0.85em;color:#b0b0b0;margin-bottom:16px;padding:10px 14px;border-left:3px solid var(--gold, #c9a84c);background:rgba(201,168,76,0.05);border-radius:0 6px 6px 0">This synthesis is generated from your chart data across multiple systems. It reveals patterns — not fixed truths. Your lived experience is always the final authority.</p>`;
    
    if (qsg.whoYouAre) {
      html += `<div class="profile-section">
        <h4><span class="icon-profile"></span> What Your Data Reveals</h4>
        <p style="font-size:var(--font-size-base);line-height:1.7;color:var(--text)">${escapeHtml(qsg.whoYouAre)}</p>
      </div>`;
    }
    
    if (qsg.decisionStyle) {
      html += `<div class="profile-section">
        <h4><span class="icon-compass"></span> How To Make Best Decisions</h4>
        <p style="font-size:var(--font-size-base);line-height:1.7;color:var(--text)">${escapeHtml(qsg.decisionStyle)}</p>
      </div>`;
    }
    
    if (qsg.lifeStrategy) {
      html += `<div class="profile-section">
        <h4><span class="icon-target"></span> Your Life Strategy</h4>
        <p style="font-size:var(--font-size-base);line-height:1.7;color:var(--text)">${escapeHtml(qsg.lifeStrategy)}</p>
      </div>`;
    }
    
    if (qsg.thisMonth) {
      html += `<div class="profile-section">
        <h4><span class="icon-calendar"></span> This Month</h4>
        <p style="font-size:var(--font-size-base);line-height:1.7;color:var(--text)">${escapeHtml(qsg.thisMonth)}</p>
      </div>`;
    }
    
    if (qsg.workingWithOthers) {
      html += `<div class="profile-section">
        <h4><span class="icon-partnership"></span> Working With Others</h4>
        <p style="font-size:var(--font-size-base);line-height:1.7;color:var(--text)">${escapeHtml(qsg.workingWithOthers)}</p>
      </div>`;
    }
    
    html += `</div>`; // close Quick Start Guide card
  }

  // ═══ PRIMING RECOMMENDATIONS (Sprint 19.2) ═══
  if (ti?.primingRecommendations) {
    const pr = ti.primingRecommendations;
    html += `<div class="card">
      <div class="card-title"><span class="icon-book"></span> Your Priming Guide</div>`;
    
    // Historical Exemplar
    if (pr.historicalExemplar) {
      const ex = pr.historicalExemplar;
      html += `<div class="profile-section">
        <h4>Historical Exemplar</h4>
        <div class="exemplar-card">
          <div class="exemplar-name">${escapeHtml(ex.name || '—')}</div>
          ${ex.relevance ? `<p>${escapeHtml(ex.relevance)}</p>` : ''}
          ${ex.keyLesson ? `<div class="exemplar-lesson"><strong>Key Lesson:</strong> ${escapeHtml(ex.keyLesson)}</div>` : ''}
          ${ex.invocationContext ? `<div class="exemplar-invoke"><strong>When to invoke:</strong> ${escapeHtml(ex.invocationContext)}</div>` : ''}
        </div>
      </div>`;
    }
    
    // Alternate Exemplars
    if (pr.alternateExemplars?.length) {
      html += `<div class="profile-section">
        <h4>Other Exemplars to Study</h4>
        <div class="pill-list">${pr.alternateExemplars.map(e => `<span class="pill">${escapeHtml(e)}</span>`).join('')}</div>
      </div>`;
    }
    
    // Book Recommendations
    if (pr.bookRecommendations) {
      const br = pr.bookRecommendations;
      html += `<div class="profile-section">
        <h4>Recommended Reading</h4>
        <div class="book-recs">`;
      if (br.fiction) {
        html += `<div class="book-rec">
          <div class="book-type">Fiction</div>
          <div class="book-title">${escapeHtml(br.fiction.title || '—')}</div>
          <div class="book-author">by ${escapeHtml(br.fiction.author || 'Unknown')}</div>
          ${br.fiction.relevance ? `<div class="book-relevance">${escapeHtml(br.fiction.relevance)}</div>` : ''}
        </div>`;
      }
      if (br.nonFiction) {
        html += `<div class="book-rec">
          <div class="book-type">Non-Fiction</div>
          <div class="book-title">${escapeHtml(br.nonFiction.title || '—')}</div>
          <div class="book-author">by ${escapeHtml(br.nonFiction.author || 'Unknown')}</div>
          ${br.nonFiction.relevance ? `<div class="book-relevance">${escapeHtml(br.nonFiction.relevance)}</div>` : ''}
        </div>`;
      }
      html += `</div></div>`;
    }
    
    // Current Knowledge Focus
    if (pr.currentKnowledgeFocus) {
      html += `<div class="profile-section">
        <h4>Your Current Focus</h4>
        <div class="knowledge-focus-badge">${escapeHtml(pr.currentKnowledgeFocus)}</div>
      </div>`;
    }
    
    html += `</div>`; // close Priming Recommendations card
  }

  // ═══ TECHNICAL DETAILS TOGGLE ═══
  if (ti) {
    const toggleId = 'tech-details-' + Date.now();
    html += `<div class="card" style="text-align:center;padding:var(--space-4)">
      <button class="btn-secondary" data-action="toggleDetails" data-arg0="${escapeAttr(toggleId)}" 
        style="width:min(300px,100%)">
        ▶ Show Technical Details
      </button>
    </div>`;

    // ═══ TECHNICAL INSIGHTS (Layer 2 - Collapsible) ═══
    html += `<div id="${escapeAttr(toggleId)}" style="display:none">`;
    
    // Frequency Keys Profile
    if (ti.geneKeysProfile) {
      const gk = ti.geneKeysProfile;
      html += `<div class="card">
        <div class="card-title"><span class="icon-key"></span> Frequency Keys Profile</div>`;
      
      if (gk.lifesWork) {
        const lw = gk.lifesWork;
        html += `<div class="profile-section">
          <h4>Life's Work — Frequency Key ${lw.key}</h4>
          <p style="font-size:var(--font-size-sm);margin-top:var(--space-2)"><strong style="color:#f56565">Shadow Pattern:</strong> ${escapeHtml(lw.shadow)}</p>
          <p style="font-size:var(--font-size-sm)"><strong style="color:#48c774">Gift:</strong> ${escapeHtml(lw.gift)}</p>
          <p style="font-size:var(--font-size-sm)"><strong style="color:var(--gold)">Mastery:</strong> ${escapeHtml(lw.siddhi)}</p>
          ${lw.contemplation ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2);font-style:italic;color:var(--text-dim)">${escapeHtml(lw.contemplation)}</p>` : ''}
        </div>`;
      }
      
      if (gk.otherActiveKeys?.length) {
        html += `<div class="profile-section">
          <h4>Other Active Keys</h4>`;
        gk.otherActiveKeys.forEach(k => {
          html += `<div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--bg3);border-radius:var(--space-2)">
            <div style="font-weight:600;color:var(--gold)">FK ${escapeHtml(String(k.key))} — ${escapeHtml(k.position)}</div>
            <p style="font-size:var(--font-size-sm);margin-top:var(--space-1)"><strong>Shadow Pattern:</strong> ${escapeHtml(k.shadow)} <strong>→ Gift:</strong> ${escapeHtml(k.gift)}</p>
            ${k.message ? `<p style="font-size:var(--font-size-base);margin-top:var(--space-2);font-style:italic">${escapeHtml(k.message)}</p>` : ''}
          </div>`;
        });
        html += `</div>`;
      }
      
      html += renderSourceTag(ti.geneKeysProfile?._sources);
      html += `</div>`; // close Frequency Keys card
    }

    // Numerology Insights
    if (ti.numerologyInsights) {
      const num = ti.numerologyInsights;
      html += `<div class="card">
        <div class="card-title"><span class="icon-numbers"></span> Numerology Insights</div>`;
      
      if (num.lifePath) {
        const lp = num.lifePath;
        html += `<div class="profile-section">
          <h4>Life Path ${lp.number} — ${escapeHtml(lp.name || '')}</h4>
          <p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2)">${escapeHtml(lp.essence || '')}</p>
          ${lp.currentGuidance ? `<p style="font-size:var(--font-size-base);margin-top:var(--space-2);padding:var(--space-3);background:var(--bg3);border-radius:var(--space-2)"><strong>Current Guidance:</strong> ${escapeHtml(lp.currentGuidance)}</p>` : ''}
        </div>`;
      }
      
      if (num.personalYear) {
        const py = num.personalYear;
        html += `<div class="profile-section">
          <h4>Personal Year ${py.number} — ${escapeHtml(py.theme || '')}</h4>
          <p style="font-size:var(--font-size-base);line-height:1.6">${escapeHtml(py.guidance || '')}</p>
        </div>`;
      }
      
      if (num.tarotCard) {
        const tc = num.tarotCard;
        html += `<div class="profile-section">
          <h4>Tarot Card — ${escapeHtml(tc.card || '')}</h4>
          <p style="font-size:var(--font-size-base);line-height:1.6">${escapeHtml(tc.message || '')}</p>
        </div>`;
      }
      
      html += renderSourceTag(ti.numerologyInsights?._sources);
      html += `</div>`; // close Numerology card
    }

    // Vedic / Jyotish Overlay
    if (ti.vedicOverlay) {
      const ved = ti.vedicOverlay;
      html += `<div class="card">
        <div class="card-title">☽ Vedic / Jyotish</div>
        <div class="profile-section">
          ${ved.moonNakshatra ? `<h4>Moon Nakshatra — ${escapeHtml(ved.moonNakshatra)}</h4>` : ''}
          ${ved.nakshatraGift ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2)"><strong style="color:var(--gold)">Gift:</strong> ${escapeHtml(ved.nakshatraGift)}</p>` : ''}
          ${ved.currentDasha ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2);padding:var(--space-3);background:var(--bg3);border-radius:var(--space-2)"><strong>Current Dasha:</strong> ${escapeHtml(ved.currentDasha)}</p>` : ''}
          ${ved.siderealSun ? `<p style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-2)">Sidereal Sun: ${escapeHtml(ved.siderealSun)}</p>` : ''}
        </div>
      </div>`;
      html += renderSourceTag(ti.vedicOverlay?._sources);
    }

    // Celtic Ogham Tree
    if (ti.celticOghamTree) {
      const og = ti.celticOghamTree;
      html += `<div class="card">
        <div class="card-title">᚛ Celtic Ogham</div>
        <div class="profile-section">
          ${og.tree ? `<h4>${escapeHtml(og.tree)}${og.period ? ` · ${escapeHtml(og.period)}` : ''}</h4>` : ''}
          ${og.gift ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2)"><strong style="color:var(--gold)">Gift:</strong> ${escapeHtml(og.gift)}</p>` : ''}
          ${og.shadow ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-1)"><strong style="color:#f56565">Shadow:</strong> ${escapeHtml(og.shadow)}</p>` : ''}
          ${og.convergence ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2);padding:var(--space-3);background:var(--bg3);border-radius:var(--space-2);font-style:italic">${escapeHtml(og.convergence)}</p>` : ''}
        </div>
      </div>`;
      html += renderSourceTag(ti.celticOghamTree?._sources);
    }

    // Mayan Tzolkin
    if (ti.mayanTzolkin) {
      const mayan = ti.mayanTzolkin;
      html += `<div class="card">
        <div class="card-title">◎ Mayan Tzolkin</div>
        <div class="profile-section">
          <h4>Kin ${mayan.kin || '?'} — ${escapeHtml(mayan.seal || '')} · ${escapeHtml(mayan.tone || '')}</h4>
          ${mayan.archetype ? `<p style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-1)">${escapeHtml(mayan.archetype)}</p>` : ''}
          ${mayan.gift ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2)"><strong style="color:var(--gold)">Gift:</strong> ${escapeHtml(mayan.gift)}</p>` : ''}
          ${mayan.convergence ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2);padding:var(--space-3);background:var(--bg3);border-radius:var(--space-2);font-style:italic">${escapeHtml(mayan.convergence)}</p>` : ''}
        </div>
      </div>`;
      html += renderSourceTag(ti.mayanTzolkin?._sources);
    }

    // BaZi Profile
    if (ti.baziProfile) {
      const bazi = ti.baziProfile;
      html += `<div class="card">
        <div class="card-title">☯ BaZi Four Pillars</div>
        <div class="profile-section">
          ${bazi.dayMaster ? `<h4>Day Master — ${escapeHtml(bazi.dayMaster)}</h4>` : ''}
          ${bazi.elementBalance ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2)">${escapeHtml(bazi.elementBalance)}</p>` : ''}
          ${bazi.convergence ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2);padding:var(--space-3);background:var(--bg3);border-radius:var(--space-2);font-style:italic">${escapeHtml(bazi.convergence)}</p>` : ''}
        </div>
      </div>`;
      html += renderSourceTag(ti.baziProfile?._sources);
    }

    // Sabian Symbols
    if (ti.sabianHighlights?.length) {
      html += `<div class="card">
        <div class="card-title">◉ Sabian Symbols</div>`;
      ti.sabianHighlights.forEach(s => {
        html += `<div class="profile-section">
          <h4>${escapeHtml(s.point || '')} — "${escapeHtml(s.symbol || '')}"</h4>
          ${s.insight ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2)">${escapeHtml(s.insight)}</p>` : ''}
        </div>`;
      });
      html += renderSourceTag(ti.sabianSources);
      html += `</div>`;
    }

    // Chiron Wound & Gift
    if (ti.chironWound) {
      const ch = ti.chironWound;
      html += `<div class="card">
        <div class="card-title">⚷ Chiron — Wound &amp; Gift</div>
        <div class="profile-section">
          <h4>${escapeHtml(ch.archetype || ch.sign || '')}${ch.house ? ` · House ${ch.house}` : ''}</h4>
          ${ch.wound ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2)"><strong style="color:#f56565">Wound:</strong> ${escapeHtml(ch.wound)}</p>` : ''}
          ${ch.gift ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-1)"><strong style="color:#48c774">Gift:</strong> ${escapeHtml(ch.gift)}</p>` : ''}
          ${ch.convergence ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2);padding:var(--space-3);background:var(--bg3);border-radius:var(--space-2);font-style:italic">${escapeHtml(ch.convergence)}</p>` : ''}
        </div>
      </div>`;
      html += renderSourceTag(ti.chironWound?._sources);
    }

    // Lilith Placement
    if (ti.lilithPlacement) {
      const lil = ti.lilithPlacement;
      html += `<div class="card">
        <div class="card-title">🌑 Lilith — Wild Power</div>
        <div class="profile-section">
          <h4>${escapeHtml(lil.archetype || lil.sign || '')}${lil.house ? ` · House ${lil.house}` : ''}</h4>
          ${lil.shadow ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2)"><strong style="color:#f56565">Shadow:</strong> ${escapeHtml(lil.shadow)}</p>` : ''}
          ${lil.gift ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-1)"><strong style="color:#48c774">Gift:</strong> ${escapeHtml(lil.gift)}</p>` : ''}
          ${lil.convergence ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2);padding:var(--space-3);background:var(--bg3);border-radius:var(--space-2);font-style:italic">${escapeHtml(lil.convergence)}</p>` : ''}
        </div>
      </div>`;
      html += renderSourceTag(ti.lilithPlacement?._sources);
    }

    // Astrological Signatures
    if (ti.astrologicalSignatures?.length) {
      html += `<div class="card">
        <div class="card-title"><span class="icon-sparkle"></span> Astrological Signatures</div>`;
      ti.astrologicalSignatures.forEach(sig => {
        html += `<div class="profile-section">
          <h4>${escapeHtml(sig.placement || '')}</h4>
          <p style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-1)">${escapeHtml(sig.interpretation || '')}</p>
          ${sig.practicalImplication ? `<p style="font-size:var(--font-size-base);margin-top:var(--space-2);padding:var(--space-2);background:var(--bg3);border-radius:var(--space-1)"><strong>Practical:</strong> ${escapeHtml(sig.practicalImplication)}</p>` : ''}
        </div>`;
      });
      html += `</div>`;
    }
    
    // Astrological Chart Wheel (if astrology data is available)
    const astroData = payload.westernAstrology || payload.astrology || chartSummary.westernAstrology || chartSummary.astrology;
    if (astroData && astroData.placements) {
      html += renderAstroChart(astroData);
    }
    
    // Energy Blueprint
    if (ti.energyBlueprint) {
      const eb = ti.energyBlueprint;
      html += `<div class="card">
        <div class="card-title"><span class="icon-energy"></span> Energy Blueprint</div>
        ${eb.pattern ? `<div class="profile-section"><h4>Pattern</h4><p>${escapeHtml(eb.pattern)}</p></div>` : ''}
        <div class="chart-grid">
          <div>
            <div class="section-header">Defined Centers</div>
            <div class="pill-list">${(eb.definedCenters||[]).map(c => `<span class="pill green">${escapeHtml(c)}</span>`).join('') || '<span style="color:var(--text-dim)">None</span>'}</div>
          </div>
          <div>
            <div class="section-header">Open Centers</div>
            <div class="pill-list">${(eb.openCenters||[]).map(c => `<span class="pill">${escapeHtml(c)}</span>`).join('') || '<span style="color:var(--text-dim)">None</span>'}</div>
          </div>
        </div>
        ${eb.connectionPattern ? `<div class="profile-section"><h4>Connection Pattern</h4><p style="font-size:var(--font-size-base)">${escapeHtml(eb.connectionPattern)}</p></div>` : ''}
      </div>`;
    }
    
    // Forge Identification
    if (ti.forgeIdentification) {
      const forge = ti.forgeIdentification;
      window._lastForge = forge;
      html += `<div class="card">
        <div class="card-title"><span class="icon-fire"></span> Forge Identification</div>
        <div class="forge-badge">
          ✦ ${escapeHtml(forge.primaryForge || '—')} Forge
          <span class="confidence-pill ${forge.confidence==='high'?'':'medium'}">${escapeHtml(forge.confidence || '')}</span>
        </div>`;
      
      // Forge Weapon (Sprint 19.2)
      if (forge.forgeWeapon) {
        html += `<div class="forge-weapon">
          <span class="forge-icon">⚔</span>
          <div><strong>Your Weapon:</strong> ${escapeHtml(forge.forgeWeapon)}</div>
        </div>`;
      }
      
      // Forge Defense (Sprint 19.2)
      if (forge.forgeDefense) {
        html += `<div class="forge-defense">
          <span class="forge-icon">🛡</span>
          <div><strong>Your Defense:</strong> ${escapeHtml(forge.forgeDefense)}</div>
        </div>`;
      }
      
      // Shadow Warning (Sprint 19.2)
      if (forge.shadowWarning) {
        html += `<div class="forge-shadow">
          <span class="forge-icon">⚠</span>
          <div><strong>Shadow Warning:</strong> ${escapeHtml(forge.shadowWarning)}</div>
        </div>`;
      }
      
      if (forge.indicators?.length) {
        html += `<div class="section-header" style="margin-top:var(--space-4)">Indicators</div><ul class="indicator-list">`;
        forge.indicators.forEach(i => {
          html += `<li><span class="sys-badge">${escapeHtml(i.system)}</span>${escapeHtml(i.dataPoint)}</li>`;
        });
        html += `</ul>`;
      }
      html += `<div style="margin-top:var(--space-4)"><button class="btn-primary" style="font-size:var(--font-size-sm);padding:8px 18px" data-action="openBlueprintCard">📸 Share Blueprint Card</button></div>`;
      html += `</div>`;
    }
    
    html += `</div>`; // close technical details collapsible div
  }

  // Grounding Audit
  if (meta.groundingAudit) {
    const ga = meta.groundingAudit;
    const pct = ga.claimsTotal ? Math.round((ga.claimsGrounded / ga.claimsTotal) * 100) : 0;
    html += `<div class="card">
      <div class="card-title"><span class="icon-check"></span> Grounding Audit</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:var(--font-size-base)">${ga.claimsGrounded} / ${ga.claimsTotal} claims grounded</span>
        <span class="confidence-pill ${pct>=90?'':'medium'}">${pct}%</span>
      </div>
      <div class="audit-bar-wrap" style="margin-top:var(--space-3)"><div class="audit-bar" style="width:${pct}%"></div></div>
      ${ga.ungroundedFields?.length ? `<div style="margin-top:var(--space-2);font-size:var(--font-size-sm);color:var(--text-dim)">Ungrounded: ${ga.ungroundedFields.join(', ')}</div>` : ''}
      ${meta.partialGrounding ? `<div class="alert alert-warn" style="margin-top:var(--space-3)"><span class="icon-info"></span> Partial grounding — some claims could not be fully grounded to reference data.</div>` : ''}
    </div>`;
  }

  if (meta.profileId) html += `<div class="alert alert-success"><span class="icon-check"></span> Profile saved (ID: ${escapeHtml(meta.profileId)}) <button class="btn-secondary btn-sm" data-action="exportPDF" data-arg0="${escapeAttr(meta.profileId)}" style="margin-left:var(--space-3)">Download PDF</button></div>`;

  // Phase 1E: Practitioner CTA — direct users to practitioners after synthesis
  const _practCtaType = chartSummary.type ? escapeHtml(chartSummary.type) + 's' : null;
  html += `<div class="card" style="background:linear-gradient(135deg,var(--bg2),var(--bg3));border:1px solid var(--gold-dim,var(--border))">
    <div class="card-title" style="color:var(--gold)">✦ Want to go deeper?</div>
    <p style="margin:0 0 1rem">An AI profile is a map — a certified Prime Self practitioner can be your guide. They'll show you how your blueprint applies to your specific relationships, decisions, timing, and career right now.</p>
    <button class="btn-primary" data-action="switchTab" data-arg0="directory" style="margin-bottom:0.5rem;width:100%">
      ${_practCtaType ? `Find a Practitioner Who Specializes in ${_practCtaType}` : 'Find a Practitioner Who Specializes in Your Type'}
    </button>
    <p style="text-align:center;font-size:0.82em;color:var(--text-dim);margin:0">Already working with a practitioner? <button class="link-btn" data-action="switchTab" data-arg0="settings">Connect your account in settings →</button></p>
  </div>`;

  html += rawToggle(data);
  return html;
}

// ── Daily Engagement Card (Phase 4) ──────────────────────────
function renderDailyCard(transitsData, chartData) {
  if (!transitsData || !chartData) return '';

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Find the most active transit (natal hit first, else first activation)
  const activations = transitsData.activations || [];
  const topHit = activations.find(a => a.natal) || activations[0];

  let cardBody = '';
  if (topHit) {
    const planet = topHit.planet || 'The planets';
    const gate = topHit.gate ? ` · Gate ${topHit.gate}` : '';
    cardBody = `<p style="margin:0.5rem 0 0;font-size:0.95rem;color:var(--text-dim)">${escapeHtml(planet)}${escapeHtml(gate)} is active in your chart today.</p>`;
    if (topHit.natal) {
      cardBody += `<p style="margin:0.5rem 0 0;font-size:0.88rem;color:var(--gold)">✦ This directly activates one of your natal gates.</p>`;
    }
  }

  return `<div class="card daily-card" style="border-left:3px solid var(--gold)">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div class="card-title" style="margin:0">☽ Today — ${today}</div>
      <button class="btn-secondary btn-sm" data-action="switchTab" data-arg0="transits">Full Report →</button>
    </div>
    ${cardBody || '<p style="margin:0.5rem 0 0;color:var(--text-dim);font-size:0.9rem">See today\'s planetary energy and how it activates your chart.</p>'}
  </div>`;
}

// ── Transits ──────────────────────────────────────────────────
async function loadTransits() {
  const btn = document.getElementById('transitBtn');
  const spinner = document.getElementById('transitSpinner');
  const resultEl = document.getElementById('transitResult');

  btn.disabled = true;
  spinner.style.display = '';
  resultEl.innerHTML = skeletonTransits();

  try {
    const data = await apiFetch('/api/transits/today');
    _diaryTransitCache = data; // BL-EXC-P1-4: cache for diary tab
    resultEl.innerHTML = renderTransits(data);
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

function renderTransits(data) {
  if (data.error) return `<div class="alert alert-error">API Error: ${escapeHtml(data.error)}</div>`;

  const t = data.data || data.transits || data;
  const positions = t.transitPositions || t.positions || {};

  if (!Object.keys(positions).length) {
    return `<div class="alert alert-warn">No transit positions returned. Check API response.</div>` + rawToggle(data);
  }

  const PLANET_SYMBOLS = { Sun:'☉', Moon:'☽', Mercury:'☿', Venus:'♀', Mars:'♂', Jupiter:'♃', Saturn:'♄', Uranus:'♅', Neptune:'♆', Pluto:'♇', NorthNode:'☊', TrueNode:'☊', Chiron:'⚷' };
  const PLANET_SPEED = { Sun:'changes gate weekly', Moon:'changes gate every 2–3 days', Mercury:'changes gate every few days', Venus:'changes gate weekly', Mars:'changes gate every 2 weeks', Jupiter:'activates a gate for ~1 month', Saturn:'activates a gate for ~3 months', Uranus:'activates a gate for ~1 year', Neptune:'activates a gate for ~2 years', Pluto:'activates a gate for ~2–3 years', NorthNode:'activates a gate for ~1 month', TrueNode:'activates a gate for ~1 month', Chiron:'activates a gate for ~1 year' };
  const PLANET_THEME = {
    Sun: 'What the collective is focused on. The theme you\'ll feel most in conversation and media.',
    Moon: 'The emotional undertow right now. Moods, instincts, and what people need for security.',
    Mercury: 'How people are thinking and communicating. Good or bad time for contracts, difficult talks.',
    Venus: 'What feels beautiful and worthwhile. Relationships, aesthetics, and what you value.',
    Mars: 'The collective drive and friction level. Energy for action — or conflict if misused.',
    Jupiter: 'Where expansion and luck are concentrated. The area of life that wants to grow.',
    Saturn: 'What requires discipline and structure. The lesson being taught by life right now.',
    Uranus: 'Where disruption and breakthrough are happening. Expect the unexpected in this gate\'s themes.',
    Neptune: 'Where illusion or spiritual insight is thickest. Be discerning with information in this gate.',
    Pluto: 'The deepest transformation underway in the collective. Power, death, and rebirth of this gate\'s themes.',
    NorthNode: 'The collective soul\'s growth direction right now.',
    TrueNode: 'The collective soul\'s growth direction right now.',
    Chiron: 'Where collective wounding and healing are surfacing. A chance to help others through your own experience.'
  };

  function getTransitGateExplanation(gate, line, planet, isNatalHit) {
    const gateName = (typeof getGateName === 'function' && gate) ? getGateName(gate) : '';
    const gateTheme = window.GATE_THEMES?.[gate] || '';
    const lineTone = {
      1: 'Line 1 asks for grounding and foundations before action.',
      2: 'Line 2 favors natural talent and allowing the right invitation to come to you.',
      3: 'Line 3 is experimental: test, iterate, and learn quickly from feedback.',
      4: 'Line 4 works best through your network, trust, and direct conversations.',
      5: 'Line 5 carries projection: be clear and practical so expectations stay realistic.',
      6: 'Line 6 prefers perspective: zoom out, observe patterns, then choose deliberately.'
    };
    const planetFocus = {
      Sun: 'Visibility is high now, so this gate can shape your public tone.',
      Moon: 'Emotions are moving quickly, so notice this gate in moods and body signals.',
      Mercury: 'Communication is highlighted, so this gate may show up in talks and decisions.',
      Venus: 'Values and relationship choices are active through this gate right now.',
      Mars: 'Action pressure is high here, so channel this gate into clean, intentional moves.',
      Jupiter: 'Growth opportunities are available if you stay aligned with this gate’s lesson.',
      Saturn: 'Responsibility and boundaries are being tested through this gate.',
      Uranus: 'Expect surprises and breakthroughs around this gate’s theme.',
      Neptune: 'Intuition is strong, but avoid assumptions around this gate.',
      Pluto: 'Deep transformation is happening here over a longer arc.',
      NorthNode: 'This gate points toward current collective growth direction.',
      TrueNode: 'This gate points toward current collective growth direction.',
      Chiron: 'Healing and mentoring themes may surface through this gate.'
    };

    const parts = [];
    if (gateName && gateTheme) parts.push(`Gate ${gate} (${gateName}) focuses on ${lowerText(gateTheme)}.`);
    else if (gateTheme) parts.push(`Gate ${gate} focuses on ${lowerText(gateTheme)}.`);
    if (lineTone[line]) parts.push(lineTone[line]);
    if (planetFocus[planet]) parts.push(planetFocus[planet]);
    if (isNatalHit) parts.push('Because this also touches your natal gate, the effect is usually more personal and noticeable.');
    return parts.join(' ');
  }

  // Collect natal hits if available
  const natalHits = (t.gateActivations || []).filter(a => a.natalGatePresent);
  const natalGateSet = new Set(natalHits.map(a => String(a.gate)));

  // Summary banner
  let html = `<div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-4)">
      <div class="card-title" style="margin-bottom:0"><span class="icon-transit"></span> ${t.date || new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'})}</div>
      ${natalHits.length ? `<div style="background:rgba(201,168,76,0.15);border:var(--border-width-thin) solid var(--gold-dim);border-radius:var(--space-5);padding:var(--space-2) 14px;font-size:var(--font-size-sm);color:var(--gold);font-weight:600">✦ ${natalHits.length} planet${natalHits.length>1?'s':''} touching your natal gates today</div>` : ''}
    </div>`;

  // Natal hits first — most relevant to the user
  if (natalHits.length) {
    html += `<div style="margin-bottom:var(--space-5)">
      <div style="font-size:var(--font-size-sm);font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--gold-dim);margin-bottom:var(--space-3)">✦ Personal — Activating Your Gates</div>`;
    natalHits.forEach(a => {
      const sym = PLANET_SYMBOLS[a.transitPlanet] || '';
      const pos = positions[a.transitPlanet] || {};
      const speed = PLANET_SPEED[a.transitPlanet] || '';
      const theme = PLANET_THEME[a.transitPlanet] || '';
      const gateExplanation = getTransitGateExplanation(a.gate, pos.line || a.line, a.transitPlanet, true);
      html += `<div style="background:rgba(201,168,76,0.08);border:var(--border-width-thin) solid rgba(201,168,76,0.35);border-radius:var(--space-2);padding:var(--space-4) 16px;margin-bottom:var(--space-2)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);flex-wrap:wrap">
          <div style="font-size:var(--font-size-md);font-weight:700;color:var(--gold)">${sym} ${a.transitPlanet} → your Gate ${a.gate}${getGateName(a.gate) ? ` <span class="gate-name-tag">— ${getGateName(a.gate)}</span>` : ''}${typeof getGateHex==='function'&&getGateHex(a.gate) ? ` <span style="font-size:var(--font-size-xs);color:var(--text-muted);font-weight:400;font-style:italic">☰ ${getGateHex(a.gate)}</span>` : ''}</div>
          <div style="display:flex;gap:var(--space-2);align-items:center">
            <span style="font-size:var(--font-size-sm);color:var(--text-dim)">${pos.sign || ''} ${pos.degrees != null ? (pos.degrees.toFixed ? pos.degrees.toFixed(1) : pos.degrees) : ''}°</span>
            <span class="gate-badge">Gate ${pos.gate || a.gate}.${pos.line || '?'}</span>
          </div>
        </div>
        <div style="font-size:var(--font-size-sm);color:var(--text);margin-top:var(--space-2);line-height:1.55">${theme}</div>
        ${gateExplanation ? `<div style="font-size:var(--font-size-sm);color:var(--text);margin-top:var(--space-2);line-height:1.55">${escapeHtml(gateExplanation)}</div>` : ''}
        ${window.GATE_THEMES?.[a.gate] ? `<div style="font-size:var(--font-size-sm);color:var(--gold-dim);margin-top:var(--space-2);line-height:1.5;padding:var(--space-2) 10px;background:rgba(201,168,76,0.08);border-radius:var(--space-1)">✦ Your Gate ${a.gate} theme: <em>${escapeHtml(window.GATE_THEMES[a.gate])}</em></div>` : ''}
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-2)">⏱ Duration: ${speed}</div>
      </div>`;
    });
    html += `</div>`;
  }

  // All planets — collective picture
  html += `<div>
    <div style="font-size:var(--font-size-sm);font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:var(--space-3)">All Planetary Positions — Collective Field</div>`;

  for (const [body, pos] of Object.entries(positions)) {
    const sym = PLANET_SYMBOLS[body] || '';
    const theme = PLANET_THEME[body] || 'Planetary influence';
    const speed = PLANET_SPEED[body] || '';
    const isNatalHit = natalGateSet.has(String(pos.gate));
    const gateExplanation = getTransitGateExplanation(pos.gate, pos.line, body, isNatalHit);
    const reflectPrompt = GATE_DIARY_PROMPTS[pos.gate] ? escapeAttr(GATE_DIARY_PROMPTS[pos.gate]) : '';
    html += `<div class="transit-row${isNatalHit ? ' transit-row-hit' : ''}">
      <div>
        <div class="planet-name">${sym} ${body}</div>
        <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-1)">${speed}</div>
      </div>
      <div>
        <div class="planet-pos">${pos.sign || ''} ${pos.degrees != null ? pos.degrees.toFixed ? pos.degrees.toFixed(1) : pos.degrees : ''}°</div>
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-1);line-height:1.4">${theme}</div>
        ${gateExplanation ? `<div style="font-size:var(--font-size-sm);color:var(--text);margin-top:var(--space-1);line-height:1.45">${escapeHtml(gateExplanation)}</div>` : ''}
        ${reflectPrompt ? `<button class="btn-secondary btn-sm" style="margin-top:var(--space-2);font-size:var(--font-size-xs)" data-action="openDiaryFromTransit" data-arg0="${escapeAttr(String(pos.gate))}" data-arg1="${reflectPrompt}">📖 Reflect on this</button>` : ''}
      </div>
      <div class="gate-badge" role="img" aria-label="Gate ${pos.gate || '?'}, Line ${pos.line || '?'}${getGateName(pos.gate) ? ' — ' + getGateName(pos.gate) : ''}" title="Gate ${pos.gate || '?'}, Line ${pos.line || '?'}${getGateName(pos.gate) ? ' — ' + getGateName(pos.gate) : ''}${typeof getGateHex==='function'&&getGateHex(pos.gate) ? ' ('+getGateHex(pos.gate)+')' : ''}">Gate ${pos.gate || '?'}.${pos.line || '?'}${getGateName(pos.gate) ? ` <span class="gate-name-tag">${getGateName(pos.gate)}</span>` : ''}${typeof getGateHex==='function'&&getGateHex(pos.gate) ? ` <span style="font-size:var(--font-size-xs);color:var(--text-muted);font-style:italic">☰ ${getGateHex(pos.gate)}</span>` : ''}</div>
    </div>`;
  }

  html += `</div>`;

  // Transit Timeline — visual duration bars
  const DURATION_DAYS = { Sun:7, Moon:2.5, Mercury:5, Venus:7, Mars:14, Jupiter:30, Saturn:90, Uranus:365, Neptune:730, Pluto:1000, NorthNode:30, TrueNode:30, Chiron:365 };
  const maxDays = Math.max(...Object.values(DURATION_DAYS));
  html += `<div style="margin-top:var(--space-5)">
    <div style="font-size:var(--font-size-sm);font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:var(--space-4)">⏱ Transit Duration Timeline</div>
    <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-bottom:var(--space-3)">Approximate time each planet activates its current gate</div>`;
  
  const sortedPlanets = Object.keys(positions).sort((a, b) => (DURATION_DAYS[a] || 7) - (DURATION_DAYS[b] || 7));
  for (const body of sortedPlanets) {
    const days = DURATION_DAYS[body] || 7;
    const pct = Math.max(5, (days / maxDays) * 100);
    const pos = positions[body] || {};
    const sym = PLANET_SYMBOLS[body] || '';
    const isNatalHit = natalGateSet.has(String(pos.gate));
    const barColor = isNatalHit ? 'var(--gold)' : 'var(--accent, #6a4fc8)';
    const label = days < 10 ? days + 'd' : days < 60 ? Math.round(days/7) + 'w' : days < 400 ? Math.round(days/30) + 'mo' : Math.round(days/365) + 'yr';
    html += `<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)">
      <div style="width:80px;font-size:var(--font-size-sm);color:var(--text-dim);text-align:right;flex-shrink:0">${sym} ${body}</div>
      <div style="flex:1;height:var(--space-4);background:rgba(255,255,255,0.04);border-radius:var(--space-2);overflow:hidden;position:relative">
        <div style="width:${pct}%;height:100%;background:${barColor};border-radius:var(--space-2);opacity:0.7;transition:width 0.5s"></div>
      </div>
      <div style="width:var(--space-10);font-size:var(--font-size-xs);color:var(--text-muted);flex-shrink:0">${label}</div>
    </div>`;
  }
  html += `</div>`;

  html += `</div>` + rawToggle(data);
  return html;
}

// ── Profile History ───────────────────────────────────────────
async function loadHistory() {
  if (!token) { openAuthOverlay(); return; }

  const btn = document.getElementById('historyBtn');
  const spinner = document.getElementById('historySpinner');
  const resultEl = document.getElementById('historyResult');

  btn.disabled = true;
  spinner.style.display = '';
  resultEl.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>' + window.t('profile.loadingProfiles') + '</div></div>';

  try {
    const data = await apiFetch('/api/profile/list');
    resultEl.innerHTML = renderHistory(data);
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

function renderHistory(data) {
  if (data.error) return `<div class="alert alert-error">API Error: ${escapeHtml(data.error)}</div>`;

  const profiles = data.data || [];

  if (!profiles.length) {
    return `<div class="empty-state">
      <span class="icon-profile icon-xl"></span>
      <h3 style="margin:var(--space-4) 0 8px;font-size:var(--font-size-md);color:var(--text)">No Saved Profiles Yet</h3>
      <p style="max-width:min(500px, 90vw);margin:0 auto 24px">Generate your first Prime Self Profile to unlock AI-powered synthesis combining your energy gates, Frequency Keys, astrology, and numerology into personalized lifecycle guidance.</p>
      <button class="btn-primary" data-action="switchTab" data-arg0="profile" style="margin:0 auto;display:inline-block">
        <span class="icon-sparkle"></span> Generate Your Profile
      </button>
    </div>`;
  }

  let html = `<div class="card">
    <div class="card-title"><span class="icon-cluster"></span> ${profiles.length} Saved Profile${profiles.length > 1 ? 's' : ''}</div>`;

  profiles.forEach(p => {
    const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Unknown date';
    html += `<div class="history-item" data-action="loadSingleProfile" data-arg0="${escapeAttr(p.id)}">
      <div>
        <div style="font-size:var(--font-size-base);font-weight:600">Profile ${p.id?.slice(0,8) || '—'}</div>
        <div class="history-meta">Created ${date} · Chart ${p.chartId?.slice(0,8) || 'N/A'} · ${p.modelUsed || ''}</div>
      </div>
      <button class="btn-secondary btn-sm">View →</button>
    </div>`;
  });

  html += `</div>`;
  return html;
}

async function loadSingleProfile(id) {
  const resultEl = document.getElementById('historyResult');
  resultEl.innerHTML += `<div class="loading-card"><div class="spinner"></div><div>Loading profile ${id.slice(0,8)}…</div></div>`;

  try {
    const data = await apiFetch('/api/profile/' + id);
    if (data.error) { resultEl.innerHTML += `<div class="alert alert-error">${escapeHtml(data.error)}</div>`; return; }

    const profileData = data.data?.profile || {};
    const rendered = renderProfile({ profile: profileData, meta: { groundingAudit: data.data?.groundingAudit }, chart: {} });
    resultEl.innerHTML = rendered;
  } catch (e) {
    resultEl.innerHTML += `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  }
}

// ── Profile Search ────────────────────────────────────────────
async function searchProfiles() {
  const input = document.getElementById('profileSearchInput');
  const resultEl = document.getElementById('historyResult');
  const term = (input?.value || '').trim();
  if (term.length < 2) { loadHistory(); return; }
  if (!token) { openAuthOverlay(); return; }

  resultEl.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>Searching…</div></div>';
  try {
    const data = await apiFetch('/api/profile/search?q=' + encodeURIComponent(term));
    resultEl.innerHTML = renderHistory(data);
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  }
}

// debounced search on input
(function () {
  let _t;
  const el = document.getElementById('profileSearchInput');
  if (el) el.addEventListener('input', () => { clearTimeout(_t); _t = setTimeout(searchProfiles, 400); });
})();

// ── Composite Chart ───────────────────────────────────────────
async function generateComposite() {
  const btn = document.getElementById('compBtn');
  const spinner = document.getElementById('compSpinner');
  const resultEl = document.getElementById('compResult');

  const personASeed = getCompositeFormSeed('A');
  const personBSeed = getCompositeFormSeed('B');
  const personAMissing = describeCompositeMissingFields(personASeed);
  const personBMissing = describeCompositeMissingFields(personBSeed);

  if (personAMissing.length || personBMissing.length) {
    const parts = [];
    if (personAMissing.length) parts.push(`Person A still needs ${formatFieldList(personAMissing)}.`);
    if (personBMissing.length) parts.push(`Person B still needs ${formatFieldList(personBMissing)}.`);
    const message = parts.join(' ');
    setCompositeLaunchNote(message, 'warn');
    resultEl.innerHTML = `<div class="alert alert-warn">${escapeHtml(message)}</div>`;
    focusCompositeMissingField(personAMissing.length ? 'A' : 'B', personAMissing.length ? personAMissing : personBMissing);
    return;
  }

  const personA = {
    birthDate: document.getElementById('comp-dateA').value,
    birthTime: document.getElementById('comp-timeA').value,
    lat: parseFloat(document.getElementById('comp-A-lat').value),
    lng: parseFloat(document.getElementById('comp-A-lng').value)
  };

  const personB = {
    birthDate: document.getElementById('comp-dateB').value,
    birthTime: document.getElementById('comp-timeB').value,
    lat: parseFloat(document.getElementById('comp-B-lat').value),
    lng: parseFloat(document.getElementById('comp-B-lng').value)
  };

  btn.disabled = true;
  spinner.style.display = '';
  resultEl.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>' + window.t('composite.generating') + '</div></div>';

  try {
    const data = await apiFetch('/api/composite', { 
      method: 'POST', 
      body: JSON.stringify({ personA, personB }) 
    });
    resultEl.innerHTML = renderComposite(data);
    trackEvent?.('composite', 'composite_generated');
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

function renderComposite(data) {
  if (data.error) return `<div class="alert alert-error">${escapeHtml(data.error)}</div>`;
  const c = data.composite || {};
  
  let html = `<div class="card">
    <div class="card-title"><span class="icon-partnership"></span> Relationship Dynamics</div>
    <div class="chart-grid">
      <div class="data-block">
        <h4>Person A</h4>
        ${row('Pattern', c.personA?.type || '—')}
        ${row('Authority', c.personA?.authority || '—')}
        ${row('Profile', c.personA?.profile || '—')}
        ${row('Forge', c.personA?.forge || '—')}
      </div>
      <div class="data-block">
        <h4>Person B</h4>
        ${row('Pattern', c.personB?.type || '—')}
        ${row('Authority', c.personB?.authority || '—')}
        ${row('Profile', c.personB?.profile || '—')}
        ${row('Forge', c.personB?.forge || '—')}
      </div>
    </div>
    ${row('Combined Definition', c.combinedDefinition || '—')}
  </div>`;
  
  // Electromagnetic connections (chemistry!)
  if (c.electromagnetic?.length) {
    html += `<div class="card">
      <div class="card-title"><span class="icon-energy"></span> Electromagnetic Connections (${c.electromagnetic.length})</div>
      <p style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-3)">
        Channels where each person provides one gate - creates magnetic attraction and chemistry.
      </p>
      <div class="pill-list">`;
    c.electromagnetic.forEach(em => {
      html += `<span class="pill gold">${em.channel} (${em.centers.join(' ↔ ')})</span>`;
    });
    html += `</div></div>`;
  }
  
  // Companionship channels
  if (c.companionship?.length) {
    html += `<div class="card">
      <div class="card-title"><span class="icon-partnership"></span> Companionship Channels (${c.companionship.length})</div>
      <p style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-3)">
        Both people have these channels defined individually - shared strengths.
      </p>
      <div class="pill-list">`;
    c.companionship.forEach(ch => {
      html += `<span class="pill green">${ch.channel} (${ch.centers.join(' ↔ ')})</span>`;
    });
    html += `</div></div>`;
  }
  
  // Relationship dynamics
  if (c.dynamics?.length) {
    html += `<div class="card">
      <div class="card-title"><span class="icon-lightbulb"></span> Relationship Insights</div>`;
    c.dynamics.forEach(d => {
      html += `<div style="padding:var(--space-3);margin:var(--space-2) 0;background:var(--bg2);border-left:var(--space-1) solid var(--gold);border-radius:var(--space-1)">
        <div style="font-weight:600;color:var(--gold);font-size:var(--font-size-sm);text-transform:uppercase;margin-bottom:var(--space-1)">${escapeHtml(d.area)}</div>
        <div style="color:var(--text);font-size:var(--font-size-base);line-height:1.6">${escapeHtml(d.note)}</div>
      </div>`;
    });
    html += `</div>`;
  }
  
  html += rawToggle(data);
  return html;
}

// ── Birth Time Rectification ──────────────────────────────────
async function runRectification() {
  const btn = document.getElementById('rectBtn');
  const spinner = document.getElementById('rectSpinner');
  const resultEl = document.getElementById('rectResult');

  const body = {
    birthDate: document.getElementById('rect-date').value,
    birthTime: document.getElementById('rect-time').value,
    lat: parseFloat(document.getElementById('rect-lat').value),
    lng: parseFloat(document.getElementById('rect-lng').value),
    windowMinutes: parseInt(document.getElementById('rect-window').value) || 30,
    stepMinutes: parseInt(document.getElementById('rect-step').value) || 5
  };

  btn.disabled = true;
  spinner.style.display = '';
  resultEl.setAttribute('aria-busy', 'true');
  resultEl.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>' + window.t('rectify.analyzing') + '</div></div>';

  try {
    const data = await apiFetch('/api/rectify', { method: 'POST', body: JSON.stringify(body) });

    // If rectificationId is present, poll for updates
    if (data.rectificationId) {
      await pollRectificationProgress(data.rectificationId, resultEl);
    } else {
      // Fallback: display result immediately if no ID (test mode)
      resultEl.innerHTML = renderRectification(data);
      resultEl.removeAttribute('aria-busy');
    }
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
    resultEl.removeAttribute('aria-busy');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

/**
 * Poll for rectification progress until completion
 */
async function pollRectificationProgress(rectificationId, resultEl) {
  let isComplete = false;
  let pollCount = 0;
  const maxPolls = 120; // 2 minutes max (1s interval)

  while (!isComplete && pollCount < maxPolls) {
    pollCount++;

    try {
      const status = await apiFetch(`/api/rectify/${rectificationId}`, { method: 'GET' });

      // Update progress bar
      resultEl.innerHTML = `
        <div class="loading-card">
          <div class="section-title">Analyzing Birth Time Sensitivity</div>
          <div style="margin: var(--space-4) 0">
            <div style="background: var(--bg3); height: 24px; border-radius: var(--space-1); overflow: hidden; position: relative;">
              <div style="
                background: linear-gradient(90deg, var(--accent), var(--accent2));
                height: 100%;
                width: ${status.percentComplete}%;
                transition: width 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: white;
                font-weight: bold;
              ">${status.percentComplete}%</div>
            </div>
          </div>
          <div style="text-align: center; color: var(--text-dim); margin: var(--space-2) 0;">
            ${status.percentComplete}% complete
          </div>
        </div>
      `;

      if (status.status === 'completed') {
        isComplete = true;
        if (status.result) {
          resultEl.innerHTML = renderRectification(status.result);
        }
        resultEl.removeAttribute('aria-busy');
      } else if (status.status === 'failed') {
        resultEl.innerHTML = `<div class="alert alert-error">${window.t('error.rectify_failed')}: ${escapeHtml(status.error || 'Unknown error')}</div>`;
        resultEl.removeAttribute('aria-busy');
        isComplete = true;
      }
    } catch (err) {
      console.warn('Rectification polling error:', err);
      // Continue polling on transient errors
    }

    if (!isComplete) {
      // Wait before next poll
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!isComplete) {
    resultEl.innerHTML = `<div class="alert alert-error">${window.t('error.rectify_timeout')}</div>`;
  }
}

function renderRectification(data) {
  if (data.error) return `<div class="alert alert-error">${escapeHtml(data.error)}</div>`;

  const sensitivity = Array.isArray(data.sensitivity) ? data.sensitivity : [];
  const guidance = Array.isArray(data.guidance) ? data.guidance : [];

  let html = `<div class="card"><div class="card-title"><span class="icon-time"></span> Rectification Analysis</div>`;
  html += `<div class="section-title">Time Window Variations</div>`;
  html += `<div style="font-size:var(--font-size-base);color:var(--text-dim);margin:var(--space-2) 0">Analyzed ${sensitivity.length} time points</div>`;

  sensitivity.slice(0, 5).forEach(s => {
    html += `<div style="padding:var(--space-2);background:var(--bg3);border-radius:var(--space-2);margin:var(--space-2) 0">`;
    html += `<strong>${s.time}</strong> → Type: ${s.type}, Profile: ${s.profile}, Authority: ${s.authority}`;
    html += `</div>`;
  });

  if (guidance.length) {
    html += `<div class="section-title" style="margin-top:var(--space-5)">Guidance</div>`;
    guidance.forEach(g => html += `<div style="color:var(--accent2);margin:var(--space-2) 0">• ${escapeHtml(g)}</div>`);
  }

  html += `</div>`;
  return html;
}

/**
 * Load and display rectification history
 */
async function loadRectificationHistory() {
  const list = document.getElementById('rectHistoryList');
  const content = document.getElementById('rectHistoryContent');

  // Show loading state
  content.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>Loading history...</div></div>';

  try {
    const data = await apiFetch('/api/rectify?limit=5&offset=0', { method: 'GET' });

    if (!data.ok || !data.rectifications || data.rectifications.length === 0) {
      content.innerHTML = '<div style="color: var(--text-dim); padding: var(--space-3);">No previous analyses yet.</div>';
      return;
    }

    let html = '';
    data.rectifications.forEach((rect, i) => {
      const date = new Date(rect.createdAt);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const sensitivityColor = rect.sensitivity === 'critical' ? 'var(--alert)' :
                               rect.sensitivity === 'high' ? 'var(--accent2)' :
                               rect.sensitivity === 'moderate' ? 'var(--accent)' :
                               'var(--text-dim)';

      html += `<div style="
        padding: var(--space-3);
        background: var(--bg2);
        border-radius: var(--space-2);
        margin-bottom: var(--space-2);
        border-left: 3px solid ${sensitivityColor};
      ">`;
      html += `<div style="display: flex; justify-content: space-between; align-items: flex-start;">`;
      html += `<div>`;
      html += `<div><strong>${rect.birthDate} @ ${rect.birthTime}</strong></div>`;
      html += `<div style="font-size: var(--font-size-sm); color: var(--text-dim); margin-top: var(--space-1);">${dateStr} at ${timeStr}</div>`;
      html += `<div style="font-size: var(--font-size-sm); margin-top: var(--space-1);">Window: ${rect.window} | ${rect.totalSnapshots} snapshots</div>`;
      html += `</div>`;
      html += `<div style="text-align: right;">`;
      html += `<div style="color: ${sensitivityColor}; font-weight: bold; font-size: var(--font-size-sm);">${rect.sensitivity.toUpperCase()}</div>`;
      html += `<button class="btn-secondary" style="margin-top: var(--space-2); font-size: var(--font-size-sm);" onclick="reloadRectification('${escapeAttr(rect.id)}')">Reload</button>`;
      html += `</div>`;
      html += `</div>`;
      html += `</div>`;
    });

    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<div class="alert alert-error">Failed to load history: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * Toggle rectification history visibility
 */
function toggleRectificationHistory() {
  const list = document.getElementById('rectHistoryList');
  const icon = document.getElementById('rectHistoryIcon');
  const isHidden = list.style.display === 'none';

  if (isHidden) {
    list.style.display = 'block';
    icon.style.transform = 'rotate(180deg)';
    loadRectificationHistory();
  } else {
    list.style.display = 'none';
    icon.style.transform = 'rotate(0deg)';
  }
}

/**
 * Reload a specific rectification by ID
 */
async function reloadRectification(rectificationId) {
  const resultEl = document.getElementById('rectResult');

  resultEl.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>Loading analysis...</div></div>';

  try {
    const data = await apiFetch(`/api/rectify/${rectificationId}`, { method: 'GET' });

    if (data.status === 'completed' && data.result) {
      resultEl.innerHTML = renderRectification(data.result);
    } else if (data.status === 'failed') {
      resultEl.innerHTML = `<div class="alert alert-error">Analysis failed: ${escapeHtml(data.error || 'Unknown error')}</div>`;
    } else {
      resultEl.innerHTML = `<div class="alert alert-warn">Analysis is still in progress or unavailable.</div>`;
    }
  } catch (err) {
    resultEl.innerHTML = `<div class="alert alert-error">Error loading analysis: ${escapeHtml(err.message)}</div>`;
  }
}

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

// ── Referral Performance Card (BL-EXC-P1-2) ──────────────────
function renderPractitionerReferralStats(data) {
  const el = document.getElementById('pracReferralStats');
  if (!el) return;
  if (!data?.referralUrl) { el.innerHTML = ''; return; }

  const url = escapeHtml(data.referralUrl);
  const urlAttr = escapeAttr(data.referralUrl);
  const total = parseInt(data.stats?.referralCount ?? data.referralCount ?? 0);
  const thisMonth = parseInt(data.stats?.earningsThisMonth != null ? '—' : 0);
  const earnings = data.stats?.earningsThisMonth != null
    ? `$${parseFloat(data.stats.earningsThisMonth).toFixed(2)}`
    : (data.earningsThisMonth != null ? `$${parseFloat(data.earningsThisMonth).toFixed(2)}` : '—');

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-header-row">
        <div class="card-title mb-0"><span class="nav-icon">🔗</span> Referral Performance</div>
      </div>
      <p class="card-hint">Every time someone signs up through your link and subscribes, you earn 25% commission for life.</p>
      <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3)">
        <input readonly value="${urlAttr}" id="pracRefLinkDisplay"
               style="flex:1;background:var(--bg2);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-1);padding:0.4rem 0.6rem;font-size:var(--font-size-sm);color:var(--text-dim);min-width:0"
               onclick="this.select()" />
        <button class="btn-primary btn-sm" data-action="copyPracReferralLink">Copy Link</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:var(--space-3);margin-bottom:var(--space-4)">
        <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
          <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${total}</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-dim)">Total Referrals</div>
        </div>
        <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
          <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${earnings}</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-dim)">Earned This Month</div>
        </div>
      </div>
      <div style="border-top:var(--border-width-thin) solid var(--border);padding-top:var(--space-4);display:flex;flex-direction:column;align-items:center;gap:var(--space-3)">
        <div style="font-size:var(--font-size-sm);font-weight:600;color:var(--text)">📲 Your QR Code — share anywhere</div>
        <div style="background:#fff;padding:var(--space-2);border-radius:var(--space-2);line-height:0">
          <img id="pracQRImage" src="" alt="Referral QR Code" width="160" height="160" />
        </div>
        <button class="btn-secondary btn-sm" data-action="downloadPractitionerQR">⬇ Download QR PNG</button>
      </div>
    </div>
  `;

  // Generate QR after DOM renders (requires qr.js to be loaded)
  requestAnimationFrame(() => {
    const imgEl = document.getElementById('pracQRImage');
    if (imgEl && window.QRCode) {
      imgEl.src = window.QRCode.toDataURL(data.referralUrl, 6);
      trackEvent('practitioner', 'qr_generated', 'referral_card');
    }
  });
}

function copyPracReferralLink() {
  const val = document.getElementById('pracRefLinkDisplay')?.value;
  if (val && navigator.clipboard) {
    navigator.clipboard.writeText(val).then(() => {
      showNotification('Referral link copied!', 'success');
      trackEvent('practitioner', 'referral_link_copy', 'dashboard');
    });
  }
}
window.copyPracReferralLink = copyPracReferralLink;

function downloadPractitionerQR() {
  const imgEl = document.getElementById('pracQRImage');
  if (!imgEl?.src || imgEl.src === window.location.href) return;
  const a = document.createElement('a');
  a.href = imgEl.src;
  a.download = 'prime-self-referral-qr.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  trackEvent('practitioner', 'qr_downloaded', 'referral_card');
}
window.downloadPractitionerQR = downloadPractitionerQR;

// ── Bodygraph Chart Export (4.2) ──────────────────────────────
function downloadBodygraph(containerId, label) {
  const container = containerId ? document.getElementById(containerId) : document.querySelector('[id^="bodygraph-"]');
  const svgEl = container?.querySelector('svg');
  if (!svgEl) return;
  const filename = 'prime-self-bodygraph-' + (label || 'chart') + '.png';
  try {
    const svgStr = new XMLSerializer().serializeToString(svgEl);
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
    const img = new Image();
    img.onload = function () {
      const scale = 2; // 2× for high-DPI
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#0f0f1a';
      ctx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(function (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        trackEvent('chart', 'bodygraph_exported', 'download');
      }, 'image/png');
    };
    img.onerror = function () { showNotification('Export failed — try again', 'error'); };
    img.src = dataUrl;
  } catch (e) {
    showNotification('Export not supported in this browser', 'error');
  }
}
window.downloadBodygraph = downloadBodygraph;

function shareBodygraph() {
  const chart = window._lastChart;
  if (!chart) { showNotification('Load your chart first', 'error'); return; }
  if (typeof window.showShareCard === 'function') {
    window.showShareCard(chart);
    trackEvent('chart', 'bodygraph_shared', 'share_card');
  } else {
    showNotification('Share card not available', 'error');
  }
}
window.shareBodygraph = shareBodygraph;

// ── Marketing Kit Page (4.5) ──────────────────────────────────
function renderPractitionerMarketingKit(data) {
  const el = document.getElementById('pracMarketingKit');
  if (!el) return;
  if (!data?.referralUrl) { el.innerHTML = ''; return; }

  const baseUrl = data.referralUrl;
  const platforms = [
    { platform: 'Facebook',   id: 'utm-facebook',  icon: '📘', src: 'facebook'  },
    { platform: 'Twitter/X',  id: 'utm-twitter',   icon: '🐦', src: 'twitter'   },
    { platform: 'LinkedIn',   id: 'utm-linkedin',  icon: '💼', src: 'linkedin'  },
    { platform: 'Instagram',  id: 'utm-instagram', icon: '📸', src: 'instagram' },
    { platform: 'WhatsApp',   id: 'utm-whatsapp',  icon: '💬', src: 'whatsapp'  },
  ];

  const emailSig =
    `Discover your soul blueprint (Human Design) at Prime Self:\n` +
    `${baseUrl}?utm_source=email&utm_medium=signature&utm_campaign=referral`;

  const snippets = [
    {
      label: 'Instagram Caption', id: 'snippet-instagram',
      text: `✨ Curious about your Human Design? Discover who you truly are — your energy type, decision-making strategy, and life purpose — with a personalized reading.\nUse my link for a free chart: ${baseUrl}?utm_source=instagram&utm_medium=social&utm_campaign=referral\n#HumanDesign #PrimeSelf`,
    },
    {
      label: 'Twitter/X Post', id: 'snippet-twitter',
      text: `Just discovered my Human Design blueprint with @PrimeSelf — mind-blowing insights! Get yours free: ${baseUrl}?utm_source=twitter&utm_medium=social&utm_campaign=referral`,
    },
    {
      label: 'LinkedIn Post', id: 'snippet-linkedin',
      text: `I've been exploring Human Design as a framework for understanding energy, leadership style, and decision-making. If you're curious about applied self-knowledge for professional growth, check out Prime Self — free chart here: ${baseUrl}?utm_source=linkedin&utm_medium=social&utm_campaign=referral`,
    },
  ];

  if (typeof trackEvent === 'function') trackEvent('practitioner', 'marketing_kit_viewed');

  const utmRow = ({ platform, id, icon, src }) => {
    const url = escapeAttr(`${baseUrl}?utm_source=${src}&utm_medium=social&utm_campaign=referral`);
    return `
      <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)">
        <span style="min-width:110px;font-size:var(--font-size-sm)">${icon} ${escapeHtml(platform)}</span>
        <input readonly id="${escapeAttr(id)}" value="${url}"
               style="flex:1;background:var(--bg2);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-1);padding:0.4rem 0.6rem;font-size:var(--font-size-xs);color:var(--text-dim);min-width:0"
               onclick="this.select()" />
        <button class="btn-secondary btn-sm" data-action="copyMarketingAsset" data-arg0="${escapeAttr(id)}">Copy</button>
      </div>`;
  };

  const snippetBlock = ({ label, id, text }) => `
    <div style="margin-bottom:var(--space-3)">
      <div style="font-size:var(--font-size-xs);color:var(--text-dim);margin-bottom:var(--space-1)">${escapeHtml(label)}</div>
      <textarea id="${escapeAttr(id)}" readonly rows="3"
                style="width:100%;box-sizing:border-box;background:var(--bg2);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-1);padding:0.5rem;font-size:var(--font-size-xs);color:var(--text-dim);resize:none"
                onclick="this.select()">${escapeHtml(text)}</textarea>
      <button class="btn-secondary btn-sm" style="margin-top:var(--space-1)"
              data-action="copyMarketingAsset" data-arg0="${escapeAttr(id)}">Copy</button>
    </div>`;

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-header-row">
        <div class="card-title mb-0"><span class="nav-icon">📦</span> Marketing Kit</div>
      </div>
      <p class="card-hint">Ready-to-use assets for growing your practice. Each link is tracked so you can see which channels bring clients.</p>
      <div style="margin-bottom:var(--space-5)">
        <div style="font-weight:600;margin-bottom:var(--space-3)">📊 Platform Tracked Links</div>
        ${platforms.map(utmRow).join('')}
      </div>
      <div style="margin-bottom:var(--space-5)">
        <div style="font-weight:600;margin-bottom:var(--space-2)">✉️ Email Signature</div>
        <textarea id="mkt-email-sig" readonly rows="2"
                  style="width:100%;box-sizing:border-box;background:var(--bg2);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-1);padding:0.5rem;font-size:var(--font-size-xs);color:var(--text-dim);resize:none;font-family:monospace"
                  onclick="this.select()">${escapeHtml(emailSig)}</textarea>
        <button class="btn-secondary btn-sm" style="margin-top:var(--space-1)"
                data-action="copyMarketingAsset" data-arg0="mkt-email-sig">Copy Signature</button>
      </div>
      <div>
        <div style="font-weight:600;margin-bottom:var(--space-2)">📝 Social Share Snippets</div>
        ${snippets.map(snippetBlock).join('')}
      </div>
    </div>
  `;
}

function copyMarketingAsset(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.value ?? el.textContent ?? '';
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Copied!', 'success');
    const assetType = String(elementId).replace(/^(utm-|snippet-|mkt-)/, '').replace(/-.*$/, '');
    if (typeof trackEvent === 'function') trackEvent('practitioner', 'marketing_asset_copied', assetType);
  }).catch(() => showNotification('Copy failed — please select and copy manually', 'error'));
}
window.copyMarketingAsset = copyMarketingAsset;

// ── Gift-a-Reading (4.6) ──────────────────────────────────────
async function loadPractitionerGifts() {
  const el = document.getElementById('pracGiftLinks');
  if (!el) return;
  try {
    const data = await apiFetch('/api/practitioner/gifts').catch(() => ({ gifts: [] }));
    renderPractitionerGifts(data?.gifts ?? []);
  } catch {
    renderPractitionerGifts([]);
  }
}

function renderPractitionerGifts(gifts) {
  const el = document.getElementById('pracGiftLinks');
  if (!el) return;

  const giftRows = Array.isArray(gifts) && gifts.length
    ? gifts.map(g => {
        const status = g.redeemed_at
          ? `<span style="color:var(--success,#27ae60)">✓ Redeemed ${escapeHtml(new Date(g.redeemed_at).toLocaleDateString())}</span>`
          : (new Date(g.expires_at) < new Date()
              ? `<span style="color:var(--error,#e74c3c)">Expired</span>`
              : `<span style="color:var(--text-dim)">Pending</span>`);
        const giftUrl = `${window.location.origin}/?gift=${escapeHtml(g.token)}`;
        return `
          <tr>
            <td style="font-size:var(--font-size-xs);color:var(--text-dim);padding:var(--space-2)">${escapeHtml(new Date(g.created_at).toLocaleDateString())}</td>
            <td style="font-size:var(--font-size-xs);padding:var(--space-2)">
              <input readonly value="${escapeAttr(giftUrl)}"
                     style="background:var(--bg2);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-1);padding:0.2rem 0.4rem;font-size:var(--font-size-xs);color:var(--text-dim);width:100%;min-width:0"
                     onclick="this.select()" />
            </td>
            <td style="font-size:var(--font-size-xs);padding:var(--space-2)">${status}</td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="3" style="text-align:center;color:var(--text-dim);font-size:var(--font-size-sm);padding:var(--space-3)">No gifts yet — create your first one below.</td></tr>`;

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-header-row">
        <div class="card-title mb-0"><span class="nav-icon">🎁</span> Gift-a-Reading</div>
      </div>
      <p class="card-hint">Send a free chart + intro session to anyone — great for leads, podcast appearances, or gestures of generosity.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:var(--space-4)">
        <thead>
          <tr style="border-bottom:var(--border-width-thin) solid var(--border)">
            <th style="text-align:left;font-size:var(--font-size-xs);color:var(--text-dim);padding:var(--space-2)">Created</th>
            <th style="text-align:left;font-size:var(--font-size-xs);color:var(--text-dim);padding:var(--space-2)">Gift Link</th>
            <th style="text-align:left;font-size:var(--font-size-xs);color:var(--text-dim);padding:var(--space-2)">Status</th>
          </tr>
        </thead>
        <tbody>${giftRows}</tbody>
      </table>
      <div style="display:flex;align-items:flex-start;gap:var(--space-3);flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <label style="font-size:var(--font-size-xs);color:var(--text-dim);display:block;margin-bottom:var(--space-1)">Personal message (optional)</label>
          <textarea id="giftMessage" rows="2" placeholder="e.g. Enjoy your free Human Design reading!"
                    style="width:100%;box-sizing:border-box;background:var(--bg2);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-1);padding:0.5rem;font-size:var(--font-size-sm);color:var(--text);resize:none"></textarea>
        </div>
        <button class="btn-primary btn-sm" style="align-self:flex-end" data-action="createGiftLink">+ Create Gift Link</button>
      </div>
    </div>
  `;
}

async function createGiftLink() {
  const msgEl = document.getElementById('giftMessage');
  const message = msgEl?.value?.trim() || null;
  try {
    const data = await apiFetch('/api/practitioner/gifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (data?.giftUrl) {
      if (msgEl) msgEl.value = '';
      showNotification('Gift link created!', 'success');
      trackEvent('practitioner', 'gift_created', 'dashboard');
      await loadPractitionerGifts();
    } else {
      showNotification('Failed to create gift link', 'error');
    }
  } catch (e) {
    showNotification('Error creating gift link', 'error');
  }
}
window.createGiftLink = createGiftLink;

// ── Practitioner Earnings Card (ITEM-1.8) ─────────────────────
function renderPractitionerEarnings(data) {
  const el = document.getElementById('pracEarningsCard');
  if (!el) return;
  const s = data?.stats;
  if (!s) { el.innerHTML = ''; return; }

  const totalReferrals = parseInt(s.totalReferrals ?? 0);
  const converted = parseInt(s.convertedReferrals ?? 0);
  const pendingRewards = parseInt(s.pendingRewards ?? 0);
  const totalValue = parseInt(s.totalRewardValue ?? 0);
  const ytdCredits = `$${(totalValue / 100).toFixed(2)}`;

  trackEvent('practitioner', 'earnings_card_viewed', 'dashboard');

  const stat = (value, label) => `
    <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
      <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${value}</div>
      <div style="font-size:var(--font-size-xs);color:var(--text-dim)">${label}</div>
    </div>`;

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-header-row">
        <div class="card-title mb-0"><span class="nav-icon">💰</span> Revenue &amp; Earnings</div>
      </div>
      <p class="card-hint">Earn 25% lifetime commission on every referred subscriber. Credits are applied to your Stripe balance automatically.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:var(--space-3);margin-top:var(--space-3)">
        ${stat(ytdCredits, 'Total Credits Earned')}
        ${stat(totalReferrals, 'Total Referrals')}
        ${stat(converted, 'Converted')}
        ${stat(pendingRewards, 'Pending Rewards')}
      </div>
    </div>
  `;
}

// ── Practitioner Promo Code (ITEM-1.9) ───────────────────────
async function loadPractitionerPromo() {
  const el = document.getElementById('pracPromoCard');
  if (!el) return;
  try {
    const data = await apiFetch('/api/practitioner/promo');
    renderPractitionerPromo(data?.promo);
  } catch {
    renderPractitionerPromo(null);
  }
}

function renderPractitionerPromo(promo) {
  const el = document.getElementById('pracPromoCard');
  if (!el) return;

  if (promo) {
    const code = escapeHtml(promo.code);
    const disc = parseInt(promo.discount_value);
    const used = parseInt(promo.redemptions || 0);
    const max = promo.max_redemptions ? parseInt(promo.max_redemptions) : '∞';
    const expires = promo.valid_until ? new Date(promo.valid_until).toLocaleDateString() : 'Never';
    el.innerHTML = `
      <div class="card" style="margin-bottom:var(--space-4)">
        <div class="card-header-row">
          <div class="card-title mb-0"><span class="nav-icon">🏷️</span> Your Promo Code</div>
          <button class="btn-secondary btn-sm" data-action="deactivatePractitionerPromo" data-arg0="${escapeAttr(promo.id)}" style="color:var(--error)">Deactivate</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:var(--space-3);margin-top:var(--space-3)">
          <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
            <div style="font-size:1.4rem;font-weight:700;color:var(--gold);font-family:monospace">${code}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-dim)">Code</div>
          </div>
          <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
            <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${disc}%</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-dim)">Discount</div>
          </div>
          <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
            <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${used} / ${max}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-dim)">Redemptions</div>
          </div>
          <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
            <div style="font-size:1.2rem;font-weight:700;color:var(--gold)">${expires}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-dim)">Expires</div>
          </div>
        </div>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="card" style="margin-bottom:var(--space-4)">
        <div class="card-header-row">
          <div class="card-title mb-0"><span class="nav-icon">🏷️</span> Create Promo Code</div>
        </div>
        <p class="card-hint">Create a discount code for your clients. 10-50% off their first month.</p>
        <div style="display:grid;gap:var(--space-2);max-width:360px">
          <input id="pracPromoCode" placeholder="e.g. JANE20" maxlength="32" style="text-transform:uppercase" />
          <label style="font-size:var(--font-size-sm);color:var(--text-dim)">Discount %</label>
          <input id="pracPromoDiscount" type="number" min="10" max="50" value="20" />
          <label style="font-size:var(--font-size-sm);color:var(--text-dim)">Max redemptions (optional)</label>
          <input id="pracPromoMax" type="number" min="1" max="1000" placeholder="100" />
          <label style="font-size:var(--font-size-sm);color:var(--text-dim)">Expiry date (optional)</label>
          <input id="pracPromoExpiry" type="date" />
          <button class="btn-primary" data-action="createPractitionerPromo" style="margin-top:var(--space-2)">Create Code</button>
        </div>
        <div id="pracPromoError" style="color:var(--error);margin-top:var(--space-2);font-size:var(--font-size-sm)"></div>
      </div>`;
  }
}

async function createPractitionerPromo() {
  const code = document.getElementById('pracPromoCode')?.value?.trim();
  const discount = document.getElementById('pracPromoDiscount')?.value;
  const max = document.getElementById('pracPromoMax')?.value;
  const expiry = document.getElementById('pracPromoExpiry')?.value;
  const errEl = document.getElementById('pracPromoError');

  if (!code) { if (errEl) errEl.textContent = 'Enter a promo code'; return; }

  try {
    if (errEl) errEl.textContent = '';
    const resp = await apiFetch('/api/practitioner/promo', {
      method: 'POST',
      body: JSON.stringify({
        code,
        discount_value: parseInt(discount) || 20,
        max_redemptions: max ? parseInt(max) : null,
        valid_until: expiry || null
      })
    });
    showNotification('Promo code created!', 'success');
    renderPractitionerPromo(resp.promo);
  } catch (e) {
    if (errEl) errEl.textContent = e.message || 'Failed to create promo code';
  }
}
window.createPractitionerPromo = createPractitionerPromo;

async function deactivatePractitionerPromo(promoId) {
  if (!confirm('Deactivate this promo code? Clients will no longer be able to use it.')) return;
  try {
    await apiFetch(`/api/practitioner/promo/${encodeURIComponent(promoId)}`, { method: 'DELETE' });
    showNotification('Promo code deactivated', 'success');
    renderPractitionerPromo(null);
  } catch (e) {
    showNotification(e.message || 'Failed to deactivate', 'error');
  }
}
window.deactivatePractitionerPromo = deactivatePractitionerPromo;

// ── Practitioner Metrics Card (PRAC-012) ─────────────────────
function renderPractitionerMetrics(data, dirData) {
  const el = document.getElementById('pracMetricsCard');
  if (!el) return;
  const s = data?.stats;
  if (!s) { el.innerHTML = ''; return; }

  const profileViews = dirData?.stats?.profileViews30d ?? '—';
  const stat = (value, label) => `
    <div style="background:var(--bg2);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
      <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${value}</div>
      <div style="font-size:var(--font-size-xs);color:var(--text-dim)">${label}</div>
    </div>`;

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-header-row">
        <div class="card-title mb-0"><span class="nav-icon">📊</span> Practice Metrics</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:var(--space-3);margin-top:var(--space-3)">
        ${stat(s.activeClients, 'Active Clients')}
        ${stat(s.notesThisMonth, 'Notes This Month')}
        ${stat(s.totalNotes, 'Total Notes')}
        ${stat(s.aiSharedNotes, 'AI-Shared Notes')}
        ${stat(profileViews, 'Profile Views (30d)')}
      </div>
    </div>
  `;
}

// ── Agency Seat Management ────────────────────────────────────

async function loadAgencySeats() {
  if (!token) return;
  const resultEl = document.getElementById('agencySeatsResult');
  if (!resultEl) return;
  resultEl.innerHTML = '<div style="color:var(--text-dim);font-size:var(--font-size-sm)">Loading seats…</div>';
  try {
    const data = await apiFetch('/api/agency/seats');
    resultEl.innerHTML = renderAgencySeats(data);
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  }
}

function renderAgencySeats(data) {
  const seats = data.seats || [];
  const limit = data.limit || 5;
  const count = seats.length;

  let html = `<div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-3)">${count} of ${limit} seats used</div>`;

  if (!seats.length) {
    return html + `<div style="color:var(--text-dim);font-size:var(--font-size-sm);padding:var(--space-3) 0">No seat members yet. Add a practitioner by email above.</div>`;
  }

  seats.forEach(seat => {
    const email    = escapeHtml(seat.member_email || seat.invited_email || '');
    const accepted = seat.accepted_at
      ? `<span style="color:var(--success,#27ae60);font-size:var(--font-size-sm)">Active</span>`
      : `<span style="color:var(--text-dim);font-size:var(--font-size-sm)">Pending</span>`;
    const memberId = escapeAttr(seat.member_user_id || seat.id);

    html += `<div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) 0;border-bottom:var(--border-width-thin) solid var(--border);flex-wrap:wrap">
      <div style="flex:1;min-width:160px">
        <div style="font-weight:600;color:var(--text)">${email}</div>
        <div>${accepted}</div>
      </div>
      <button class="btn-danger btn-sm" data-action="removeAgencySeat" data-arg0="${memberId}" data-arg1="${email}">Remove</button>
    </div>`;
  });

  return html;
}

async function inviteAgencySeat() {
  const emailInput = document.getElementById('agencySeatEmail');
  const statusEl   = document.getElementById('agencySeatStatus');
  const email = (emailInput?.value || '').trim();

  if (!email) {
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-warn">Please enter an email address.</div>`;
    return;
  }
  if (!token) { openAuthOverlay(); return; }

  try {
    const data = await apiFetch('/api/agency/seats/invite', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-success">${escapeHtml(data.message || 'Seat added!')}</div>`;
    if (emailInput) emailInput.value = '';
    loadAgencySeats();
    setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 4000);
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

async function removeAgencySeat(memberId, emailLabel) {
  if (!confirm(`Remove ${emailLabel || 'this seat member'} from your agency?`)) return;
  if (!token) { openAuthOverlay(); return; }

  try {
    await apiFetch(`/api/agency/seats/${memberId}`, { method: 'DELETE' });
    showNotification('Seat member removed.', 'success');
    loadAgencySeats();
  } catch (e) {
    showNotification(e.message || 'Failed to remove seat', 'error');
  }
}

function renderPractitionerActivationPlan({ rosterData, profileData, invitationsData, directoryData, metricsData }) {
  const container = document.getElementById('pracActivationPlan');
  if (!container) return;

  const clients = Array.isArray(rosterData?.clients) ? rosterData.clients : [];
  const invitations = Array.isArray(invitationsData?.invitations) ? invitationsData.invitations : [];
  const directoryProfile = directoryData?.profile || null;
  const practitioner = profileData?.practitioner || null;
  const stats = metricsData?.stats || {};

  const directoryReady = !!(directoryProfile?.display_name && directoryProfile?.bio && directoryProfile?.booking_url);
  const hasClientOrInvite = clients.length > 0 || invitations.length > 0;
  const chartReadyClient = clients.find(client => !!client.chart_id) || null;
  const hasFirstNote = parseInt(stats.totalNotes ?? 0) > 0;
  const sessionReadyClient = clients.find(client => !!client.chart_id && !!client.profile_id) || null;

  const checklist = [
    {
      key: 'profile',
      done: directoryReady,
      title: 'Complete your public profile',
      description: directoryReady
        ? 'Your profile basics and booking path are in place.'
        : 'Add your public name, bio, and booking URL so your workspace can convert attention into bookings.',
      cta: !directoryReady ? '<button class="btn-secondary btn-sm" data-action="toggleDirectoryForm">Edit Profile</button>' : ''
    },
    {
      key: 'invite',
      done: hasClientOrInvite,
      title: 'Add or invite your first client',
      description: hasClientOrInvite
        ? `Your workspace already has ${clients.length} client${clients.length === 1 ? '' : 's'} and ${invitations.length} pending invite${invitations.length === 1 ? '' : 's'}.`
        : 'Bring in your first client so the portal becomes a working session workspace.',
      cta: !hasClientOrInvite ? '<button class="btn-primary btn-sm" data-action="togglePracAddForm">Invite First Client</button>' : ''
    },
    {
      key: 'chart',
      done: !!chartReadyClient,
      title: 'Get a client chart into the workspace',
      description: chartReadyClient
        ? 'At least one client has generated their chart and is ready for review.'
        : 'You have clients in motion, but no chart is available yet. The next step is client birth-data completion and chart generation.',
      cta: (!chartReadyClient && clients[0])
        ? `<button class="btn-secondary btn-sm" data-action="viewClientDetail" data-arg0="${escapeAttr(clients[0].id)}" data-arg1="${escapeAttr(clients[0].email || '')}">Open First Client</button>`
        : ''
    },
    {
      key: 'note',
      done: hasFirstNote,
      title: 'Write your first session note',
      description: hasFirstNote
        ? `You have ${stats.totalNotes} session note${stats.totalNotes === 1 ? '' : 's'} — your practice knowledge base is growing.`
        : 'Session notes capture your observations and build a running record for each client.',
      cta: (!hasFirstNote && chartReadyClient)
        ? `<button class="btn-secondary btn-sm" data-action="viewClientDetail" data-arg0="${escapeAttr(chartReadyClient.id)}" data-arg1="${escapeAttr(chartReadyClient.email || '')}">Open Client → Add Note</button>`
        : ''
    },
    {
      key: 'brief',
      done: !!sessionReadyClient,
      title: 'Generate your first session brief',
      description: sessionReadyClient
        ? 'A client has chart and profile ready — you can generate AI session prep briefs for focused, efficient sessions.'
        : 'Once a client has both a chart and profile, you can generate AI-powered session prep briefs.',
      cta: sessionReadyClient
        ? `<button class="btn-secondary btn-sm" data-action="viewClientDetail" data-arg0="${escapeAttr(sessionReadyClient.id)}" data-arg1="${escapeAttr(sessionReadyClient.email || '')}">Open Session Workspace</button>`
        : ''
    }
  ];

  const completed = checklist.filter(item => item.done).length;
  const nextStep = checklist.find(item => !item.done) || null;
  const practitionerName = practitioner?.display_name || practitioner?.business_name || 'Practitioner';

  // Analytics: fire activation_step_completed for newly-completed steps
  const storageKey = 'ps_activation_steps_fired';
  const firedRaw = localStorage.getItem(storageKey);
  const fired = firedRaw ? JSON.parse(firedRaw) : [];
  checklist.forEach(item => {
    if (item.done && !fired.includes(item.key)) {
      fired.push(item.key);
      trackEvent?.('practitioner', 'activation_step_completed', item.key);
    }
  });
  localStorage.setItem(storageKey, JSON.stringify(fired));
  // Fire activation_checklist_complete once when all steps done
  if (completed === checklist.length && !localStorage.getItem('ps_activation_complete_fired')) {
    localStorage.setItem('ps_activation_complete_fired', '1');
    trackEvent?.('practitioner', 'activation_checklist_complete', `${checklist.length}_steps`);
  }

  container.innerHTML = `
    <div class="card" style="border-top:3px solid var(--gold)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-3);flex-wrap:wrap">
        <div>
          <div class="card-title" style="margin-bottom:var(--space-2)"><span class="icon-check"></span> Activation Plan</div>
          <p style="margin:0;color:var(--text-dim);line-height:1.6;font-size:var(--font-size-sm)">${escapeHtml(practitionerName)} is ${completed === checklist.length ? 'fully operational.' : 'still in setup.'} Complete the core milestones below to turn this portal into a repeatable practitioner workflow.</p>
        </div>
        <div style="min-width:120px;text-align:right">
          <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--gold)">${completed}/${checklist.length}</div>
          <div style="font-size:var(--font-size-sm);color:var(--text-dim)">core milestones</div>
        </div>
      </div>
      ${nextStep ? `<div style="margin-top:var(--space-3);padding:var(--space-3);border:var(--border-width-thin) solid rgba(212,175,55,0.22);border-radius:var(--space-2);background:rgba(212,175,55,0.08)"><strong style="color:var(--text)">Next step:</strong> <span style="color:var(--text-dim)">${escapeHtml(nextStep.title)}</span></div>` : '<div style="margin-top:var(--space-3);padding:var(--space-3);border:var(--border-width-thin) solid rgba(82,196,26,0.22);border-radius:var(--space-2);background:rgba(82,196,26,0.08);color:var(--text)">Your practitioner workspace is fully activated — every milestone is complete.</div>'}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--space-3);margin-top:var(--space-4)">
        ${checklist.map(item => `
          <div style="padding:var(--space-3);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-2);background:var(--bg3)">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);margin-bottom:var(--space-2)">
              <strong style="font-size:var(--font-size-sm);color:var(--text)">${escapeHtml(item.title)}</strong>
              ${renderPractitionerLifecycleBadge(item.done ? 'done' : 'next')}
            </div>
            <div style="font-size:var(--font-size-sm);color:var(--text-dim);line-height:1.6">${escapeHtml(item.description)}</div>
            ${item.cta ? `<div style="margin-top:var(--space-3)">${item.cta}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>`;
}

function getPractitionerClientLifecycle(client) {
  if (!client?.birth_date) {
    return {
      key: 'needs_birth_data',
      label: 'Needs birth data',
      tone: 'warning',
      nextStep: 'Client account exists, but birth details are not complete yet.'
    };
  }

  if (!client?.chart_id) {
    return {
      key: 'needs_chart',
      label: 'Needs chart',
      tone: 'info',
      nextStep: 'Birth details are present. Next step is chart generation.'
    };
  }

  if (!client?.profile_id) {
    return {
      key: 'needs_profile',
      label: 'Needs profile',
      tone: 'info',
      nextStep: 'Chart is ready. Generate or refresh the profile synthesis before the session.'
    };
  }

  return {
    key: 'session_ready',
    label: 'Session ready',
    tone: 'success',
    nextStep: 'Chart and profile are ready for session prep, notes, and export.'
  };
}

function renderPractitionerLifecycleBadge(tone) {
  const config = {
    success: { label: 'Ready', bg: 'rgba(46, 204, 113, 0.16)', color: 'var(--accent2)' },
    warning: { label: 'Action', bg: 'rgba(212, 175, 55, 0.14)', color: 'var(--gold)' },
    info: { label: 'In Progress', bg: 'rgba(91, 143, 249, 0.16)', color: '#8fb8ff' },
    next: { label: 'Next', bg: 'rgba(212, 175, 55, 0.14)', color: 'var(--gold)' },
    done: { label: 'Done', bg: 'rgba(46, 204, 113, 0.16)', color: 'var(--accent2)' }
  };
  const pill = config[tone] || config.info;
  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:${pill.bg};color:${pill.color};font-size:var(--font-size-xs);font-weight:700;letter-spacing:0.02em;text-transform:uppercase">${pill.label}</span>`;
}

function renderRoster(data) {
  const clients = data.clients || [];

  if (!clients.length) {
    return `<div class="empty-state">
      <span class="icon-star icon-xl"></span>
      <h3 style="margin:var(--space-4) 0 8px;font-size:var(--font-size-md);color:var(--text)">No clients yet</h3>
      <p style="max-width:min(500px,90vw);margin:0 auto 24px">Invite your first client to start building their energy blueprint together. They'll receive an email with a personalized invitation to join Prime Self.</p>
      <button class="btn-primary" style="display:inline-block;margin:0 auto" data-action="togglePracAddForm">
        <span class="icon-star"></span> Invite Your First Client
      </button>
    </div>`;
  }

  let html = `<div class="card">
    <div class="card-title"><span class="icon-star"></span> Roster — ${clients.length} client${clients.length !== 1 ? 's' : ''}</div>`;

  clients.forEach(c => {
    const addedDate = c.added_at ? new Date(c.added_at).toLocaleDateString() : '—';
    const chartDate = c.chart_date ? new Date(c.chart_date).toLocaleDateString() : 'No chart';
    const chartId   = c.chart_id || null;
    const profileDate = c.profile_date ? new Date(c.profile_date).toLocaleDateString() : 'No profile';
    const clientId  = c.id;
    const emailSafe = escapeHtml(c.email);
    const lifecycle = getPractitionerClientLifecycle(c);
    const statusBadge = renderPractitionerLifecycleBadge(lifecycle.tone).replace(/>[^<]+<\//, `>${escapeHtml(lifecycle.label)}<\/`);

    html += `
    <div class="client-row" id="client-row-${escapeAttr(clientId)}" style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-3);padding:var(--space-3) 0;border-bottom:var(--border-width-thin) solid var(--border)">
      <div style="flex:1;min-width:150px">
        <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;margin-bottom:4px">
          <div style="font-weight:600;color:var(--text)">${emailSafe}</div>
          ${statusBadge}
        </div>
        <div style="font-size:var(--font-size-sm);color:var(--text-dim)">
          Added ${addedDate} · Last chart: ${chartDate} · Last profile: ${profileDate}
        </div>
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:4px">${escapeHtml(lifecycle.nextStep)}</div>
      </div>
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center">
        ${(lifecycle.key === 'needs_birth_data' || lifecycle.key === 'needs_profile')
          ? `<button class="btn-primary btn-sm" id="remind-btn-${escapeAttr(clientId)}" data-action="sendClientReminder" data-arg0="${escapeAttr(clientId)}" data-arg1="${emailSafe}">Send Reminder</button>`
          : lifecycle.key === 'session_ready'
          ? `<button class="btn-primary btn-sm" data-action="viewClientDetail" data-arg0="${escapeAttr(clientId)}" data-arg1="${emailSafe}">Open Session →</button>`
          : `<button class="btn-primary btn-sm" data-action="viewClientDetail" data-arg0="${escapeAttr(clientId)}" data-arg1="${emailSafe}">Open Workspace</button>`}
        ${(lifecycle.key === 'needs_birth_data' || lifecycle.key === 'needs_profile')
          ? `<button class="btn-secondary btn-sm" data-action="viewClientDetail" data-arg0="${escapeAttr(clientId)}" data-arg1="${emailSafe}">View Details</button>` : ''}
        ${lifecycle.key === 'session_ready' && chartId && c.profile_id
          ? `<button class="btn-secondary btn-sm" data-action="exportBrandedPDF" data-arg0="${escapeAttr(clientId)}">Branded PDF</button>` : ''}
        <button class="btn-danger btn-sm" data-action="removeClient" data-arg0="${escapeAttr(clientId)}" data-arg1="${emailSafe}">Remove</button>
      </div>
    </div>`;
  });

  html += `</div>`;
  return html;
}

async function viewClientDetail(clientId, emailLabel) {
  const panel = document.getElementById('pracDetailPanel');
  if (!panel) return;
  panel.style.display = 'block';
  panel.innerHTML = `<div class="loading-card"><div class="spinner"></div><div>Loading ${escapeHtml(emailLabel)}…</div></div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const [data, notesData, aiContextData, diaryData] = await Promise.all([
      apiFetch(`/api/practitioner/clients/${clientId}`),
      apiFetch(`/api/practitioner/clients/${clientId}/notes?limit=10&offset=0`).catch(() => ({ notes: [], total: 0, hasMore: false })),
      apiFetch(`/api/practitioner/clients/${clientId}/ai-context`).catch(() => ({ ai_context: '', error: 'Unable to load AI context' })),
      apiFetch(`/api/practitioner/clients/${clientId}/diary`).catch(() => ({ data: [] }))
    ]);
    _practitionerClientDetailCache.set(String(clientId), data);
    panel.innerHTML = renderClientDetail(data, emailLabel, clientId, notesData, aiContextData, diaryData, _practitionerBookingUrl);
    loadClientReadings(clientId);
    loadClientActions(clientId);
    loadPractitionerMessages(clientId);
    trackEvent('practitioner', 'client_view', clientId);
  } catch (e) {
    panel.innerHTML = `<div class="alert alert-error">Error loading client: ${escapeHtml(e.message)}</div>`;
  }
}

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

// ── Clusters ───────────────────────────────────────────────────
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

// ── Onboarding Story ───────────────────────────────────────────
async function startOnboarding() {
  if (!token) { openAuthOverlay(); return; }

  const btn = document.getElementById('onboardBtn');
  const spinner = document.getElementById('onboardSpinner');
  const progressEl = document.getElementById('onboardProgress');
  const contentEl = document.getElementById('onboardContent');

  btn.disabled = true;
  spinner.style.display = '';
  progressEl.style.display = 'block';

  try {
    // Fetch user's personalized forge arc from backend
    const forgeData = await apiFetch('/api/onboarding/forge');
    const forgeKey = forgeData.forge || forgeData.key;
    const chapters = forgeData.chapters || [];
    const totalChapters = chapters.length || forgeData.chapterCount || 5;

    // Show forge intro
    contentEl.innerHTML = renderOnboardingStep({
      content: forgeData.openingHook || forgeData.summary || `Welcome to the ${escapeHtml(forgeKey)} Forge`,
      title: forgeData.bookTitle || `The ${escapeHtml(forgeKey)} Forge`
    }, 0);

    // Walk through chapters
    for (let step = 1; step <= totalChapters; step++) {
      await new Promise(r => setTimeout(r, 600));
      document.getElementById('onboardBar').style.width = `${Math.round((step / totalChapters) * 100)}%`;

      const chapterData = await apiFetch(`/api/onboarding/chapter/${encodeURIComponent(forgeKey)}/${step}`);
      contentEl.innerHTML = renderOnboardingStep(chapterData, step);

      // Mark chapter as read
      await apiFetch('/api/onboarding/advance', {
        method: 'POST',
        body: JSON.stringify({ forge: forgeKey, chapter: step })
      });
    }

    contentEl.innerHTML += `<div class="alert alert-success" style="margin-top:var(--space-4)"><span class="icon-check"></span> Onboarding complete!</div>`;
  } catch (e) {
    contentEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

function renderOnboardingStep(data, step) {
  if (data.error) return `<div class="alert alert-error">${escapeHtml(data.error)}</div>`;
  
  const title = data.title || data.chapterTitle || `Chapter ${step}`;
  const content = data.content || data.narrative || data.prompt || '';
  return `<div class="card" style="margin-top:var(--space-3)">
    <div class="card-title">${escapeHtml(title)}</div>
    <div style="color:var(--text);font-size:var(--font-size-base);line-height:1.7">${escapeHtml(content)}</div>
  </div>`;
}

// ── Utilities ─────────────────────────────────────────────────
async function exportPDF(profileId) {
  if (!profileId) { showNotification('No profile ID provided', 'warning'); return; }
  
  try {
    const url = `${API}/api/profile/${profileId}/pdf`;
    // Open in new window to trigger download
    window.open(url, '_blank');
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

async function exportBrandedPDF(clientId) {
  if (!clientId) { showNotification('No client ID provided', 'warning'); return; }
  if (!token) { openAuthOverlay(); return; }

  try {
    showNotification('Generating branded PDF…', 'info');
    const res = await fetch(`${API}/api/practitioner/clients/${clientId}/pdf`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showNotification(err.error || 'Failed to generate branded PDF', 'error');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profile-${clientId.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    trackEvent('practitioner', 'branded_pdf_export', clientId);
  } catch (e) {
    showNotification('Error: ' + e.message, 'error');
  }
}

async function exportProfileToNotion(profileId) {
  if (!profileId) { showNotification('No profile ID provided', 'warning'); return; }
  if (!token) { openAuthOverlay(); return; }

  try {
    showNotification('Exporting profile to Notion…', 'info');
    const result = await apiFetch(`/api/notion/export/profile/${profileId}`, { method: 'POST' });

    if (result?.error) {
      showNotification(safeErrorMsg(result.error, 'Unable to export to Notion'), 'error');
      return;
    }

    if (result?.pageUrl) {
      window.open(result.pageUrl, '_blank', 'noopener');
    }

    showNotification('Profile exported to Notion.', 'success');
    trackEvent('practitioner', 'notion_export', profileId);
  } catch (e) {
    showNotification('Error exporting to Notion: ' + e.message, 'error');
  }
}

async function copyPractitionerFollowUpBrief(clientId) {
  const field = document.getElementById('followUpBrief-' + clientId);
  const statusEl = document.getElementById('followUpStatus-' + clientId);
  if (!field) return;

  const copied = await copyToClipboard(field.value);
  if (statusEl) {
    statusEl.textContent = copied
      ? 'Follow-up brief copied. Paste it into your email, CRM, or Notion workflow.'
      : 'Copy failed. Select the brief manually and paste it where you need it.';
  }
  showNotification(copied ? 'Follow-up brief copied.' : 'Could not copy follow-up brief.', copied ? 'success' : 'error');
}

// ── AI Session Brief (BL-EXC-P1-1) ──────────────────────────

async function generateSessionBrief(clientId) {
  const btn = document.getElementById('sessionBriefBtn-' + clientId);
  const spinner = document.getElementById('sessionBriefSpinner-' + clientId);
  const output = document.getElementById('sessionBriefOutput-' + clientId);
  if (!output) return;

  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = '';
  output.innerHTML = '<p style="color:var(--text-dim);font-size:var(--font-size-sm)">Generating session brief…</p>';

  try {
    const data = await apiFetch(`/api/practitioner/clients/${clientId}/session-brief`, { method: 'POST' });

    if (data.error) {
      output.innerHTML = `<div class="alert alert-error">${escapeHtml(data.error)}</div>`;
      return;
    }

    const b = data.brief || {};

    if (data.raw) {
      output.innerHTML = `<pre style="white-space:pre-wrap;font-size:var(--font-size-sm);color:var(--text)">${escapeHtml(data.raw)}</pre>`;
      return;
    }

    let html = `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:var(--space-4);margin-top:var(--space-3)">
      <div style="font-size:var(--font-size-xs);color:var(--text-dim);margin-bottom:var(--space-4);text-align:right">Generated by AI — verify against your own session knowledge</div>`;

    if (b.themes?.length) {
      html += `<div style="margin-bottom:var(--space-4)">
        <div style="font-weight:600;color:var(--gold);margin-bottom:var(--space-2)">Key Themes</div>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
          ${b.themes.map(t => `<div style="background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.25);border-radius:20px;padding:6px 14px;font-size:var(--font-size-sm);color:var(--text)">${escapeHtml(t)}</div>`).join('')}
        </div>
      </div>`;
    }

    if (b.resistanceAreas?.length) {
      html += `<div style="margin-bottom:var(--space-4)">
        <div style="font-weight:600;color:var(--text);margin-bottom:var(--space-2)">Resistance Areas</div>
        <ul style="margin:0;padding-left:var(--space-4);font-size:var(--font-size-sm);color:var(--text-dim);line-height:1.7">
          ${b.resistanceAreas.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
        </ul>
      </div>`;
    }

    if (b.suggestedQuestion) {
      html += `<div style="margin-bottom:var(--space-4);background:rgba(255,255,255,0.04);border-left:3px solid var(--gold);padding:var(--space-3) var(--space-4);border-radius:0 6px 6px 0">
        <div style="font-weight:600;color:var(--text);margin-bottom:4px;font-size:var(--font-size-sm)">Opening Question</div>
        <div style="font-size:var(--font-size-base);color:var(--text);font-style:italic">"${escapeHtml(b.suggestedQuestion)}"</div>
      </div>`;
    }

    if (b.transitImpact) {
      html += `<div>
        <div style="font-weight:600;color:var(--text);margin-bottom:var(--space-2);font-size:var(--font-size-sm)">Current Transit Context</div>
        <p style="margin:0;font-size:var(--font-size-sm);color:var(--text-dim);line-height:1.7">${escapeHtml(b.transitImpact)}</p>
      </div>`;
    }

    html += `</div>`;
    output.innerHTML = html;

  } catch (e) {
    output.innerHTML = `<div class="alert alert-error">Failed to generate brief: ${escapeHtml(e.message)}</div>`;
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}
window.generateSessionBrief = generateSessionBrief;

// ── Skeleton Loading Templates ────────────────────────────────
function skeletonChart() {
  return `<div class="skeleton-card">
    <div class="skeleton-line tall w-60"></div>
    <div class="skeleton-grid">
      <div><div class="skeleton-line"></div><div class="skeleton-line w-75"></div><div class="skeleton-line w-60"></div><div class="skeleton-line w-50"></div><div class="skeleton-line w-75"></div><div class="skeleton-line w-40"></div></div>
      <div><div class="skeleton-line"></div><div class="skeleton-line w-60"></div><div class="skeleton-line w-75"></div></div>
    </div>
    <div class="skeleton-line tall w-40" style="margin-top:var(--space-4)"></div>
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-1)"><span class="skeleton-pill"></span><span class="skeleton-pill" style="width:80px"></span><span class="skeleton-pill" style="width:50px"></span><span class="skeleton-pill" style="width:var(--space-20)"></span></div>
    <div class="skeleton-line tall w-40" style="margin-top:var(--space-4)"></div>
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-1)"><span class="skeleton-pill" style="width:100px"></span><span class="skeleton-pill" style="width:90px"></span></div>
  </div>`;
}

function skeletonProfile() {
  return `<div class="skeleton-card">
    <div class="skeleton-line tall w-50"></div>
    <div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line w-75"></div>
    <div class="skeleton-line" style="margin-top:var(--space-4)"></div><div class="skeleton-line"></div><div class="skeleton-line w-60"></div>
    <div class="skeleton-line" style="margin-top:var(--space-4)"></div><div class="skeleton-line"></div><div class="skeleton-line w-50"></div>
  </div>
  <div style="text-align:center;margin-top:var(--space-3);font-size:var(--font-size-sm);color:var(--text-muted)">
    <div class="profile-progress-message">Analyzing your birth chart...</div>
    <div style="margin-top:var(--space-1);font-size:var(--font-size-sm)">This takes 15-30 seconds</div>
  </div>`;
}

function skeletonTransits() {
  return `<div class="skeleton-card">
    <div class="skeleton-line tall w-50"></div>
    <div class="skeleton-line w-75"></div>
    ${[1,2,3,4,5].map(() => `<div style="display:flex;gap:var(--space-3);align-items:center;margin-bottom:var(--space-3)"><div class="skeleton-circle"></div><div style="flex:1"><div class="skeleton-line w-60"></div><div class="skeleton-line w-40"></div></div><span class="skeleton-pill" style="width:var(--space-20)"></span></div>`).join('')}
  </div>`;
}

function row(label, value) {
  if (!value && value !== 0) return '';
  return `<div class="data-row"><span class="data-label">${label}</span><span class="data-value">${escapeHtml(String(value))}</span></div>`;
}

let _rawCount = 0;
function rawToggle(data) {
  const id = 'raw-' + (++_rawCount);
  return `<span class="raw-toggle" data-action="toggleRaw" data-arg0="${escapeAttr(id)}">Show raw JSON ▾</span>
    <pre class="raw-json" id="${escapeAttr(id)}">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
}

function toggleRaw(id) {
  const el = document.getElementById(id);
  el.classList.toggle('open');
}

// ── Overview Synthesis Tab (Phase 7) ──────────────────────────────
function updateOverview(chartResponse) {
  const container = document.getElementById('overviewContent');
  if (!container) return;

  const d = chartResponse.data || chartResponse;
  const chart = d.chart || d;
  const astro = d.westernAstrology || d.astrology || {};

  const definedCount = chart.definedCenters?.length || 0;
  const openCount = 9 - definedCount;
  const channelCount = chart.activeChannels?.length || 0;
  const crossName = chart.cross?.name || (typeof chart.cross === 'string' ? chart.cross : null)
    || (chart.cross?.gates?.[0] && chart.cross?.line && typeof getCrossName === 'function'
      ? getCrossName(chart.cross.gates[0], chart.cross.line) : '');
  const motorCenters = (chart.definedCenters || []).filter(c => typeof isMotorCenter === 'function' && isMotorCenter(c));

  // Build the overview
  let html = '';

  // Quick Stats Row
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));gap:var(--space-3);margin-bottom:var(--space-5)">
    <div class="card" style="padding:var(--space-4);text-align:center">
      <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--gold)">${chart.type || '—'}</div>
      <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-1)">Energy Pattern</div>
    </div>
    <div class="card" style="padding:var(--space-4);text-align:center">
      <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--text)">${chart.profile || '—'}</div>
      <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-1)">Life Role</div>
    </div>
    <div class="card" style="padding:var(--space-4);text-align:center">
      <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--accent)">${definedCount}/${openCount}</div>
      <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-1)">Defined/Open</div>
    </div>
    <div class="card" style="padding:var(--space-4);text-align:center">
      <div style="font-size:var(--font-size-xl);font-weight:700;color:var(--gold)">${channelCount}</div>
      <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-1)">Active Channels</div>
    </div>
  </div>`;

  // Strategy + Authority card
  html += `<div class="card" style="border-left:var(--space-1) solid var(--gold);margin-bottom:var(--space-4)">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-4)">
      <div>
        <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--space-2)">Your Strategy</div>
        <div style="font-size:var(--font-size-md);font-weight:600;color:var(--text);margin-bottom:var(--space-1)">${chart.strategy || '—'}</div>
        ${typeof getExplanation === 'function' ? getExplanation(STRATEGY_EXPLANATIONS, chart.strategy) : ''}
      </div>
      <div>
        <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--space-2)">Decision Style</div>
        <div style="font-size:var(--font-size-md);font-weight:600;color:var(--text);margin-bottom:var(--space-1)">${chart.authority || '—'}</div>
        ${typeof getExplanation === 'function' ? getExplanation(AUTHORITY_EXPLANATIONS, chart.authority) : ''}
      </div>
    </div>
  </div>`;

  // Purpose / Cross
  if (crossName) {
    html += `<div class="card" style="margin-bottom:var(--space-4)">
      <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--space-2)">Your Life Purpose</div>
      <div style="font-size:var(--font-size-md);font-weight:700;color:var(--text)">${crossName}</div>
      <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-1)">Your soul cross describes the overarching theme of your life journey.</div>
    </div>`;
  }

  // Mini Energy Chart
  const _ovBgId = 'overview-bodygraph-' + Date.now();
  html += `<div class="card" style="margin-bottom:var(--space-4);text-align:center">
    <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--space-3)">Your Energy Chart</div>
    <div id="${_ovBgId}"></div>
    <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-2)">Tap centers and channels to explore</div>
  </div>`;

  // Not-Self alert
  if (chart.notSelfTheme) {
    html += `<div class="card" style="border-left:var(--space-1) solid var(--red);margin-bottom:var(--space-4)">
      <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--space-2)">⚠ Watch For</div>
      <div style="font-size:var(--font-size-base);color:var(--text)">When you feel <em>${escapeHtml(lowerText(chart.notSelfTheme, 'out of alignment'))}</em>, it's a signal you may be out of alignment with your design.</div>
    </div>`;
  }

  // Quick links
  html += `<div style="display:flex;gap:var(--space-3);flex-wrap:wrap;justify-content:center;margin-top:var(--space-3)">
    <button class="btn-primary" style="font-size:var(--font-size-sm);padding:var(--space-2) 18px" data-action="switchTab" data-arg0="chart">View Full Chart</button>
    <button class="btn-primary" style="font-size:var(--font-size-sm);padding:var(--space-2) 18px;background:var(--accent)" data-action="switchTab" data-arg0="profile">Generate AI Profile</button>
    <button class="btn-primary" style="font-size:var(--font-size-sm);padding:var(--space-2) 18px;background:transparent;border:var(--border-width-thin) solid var(--border);color:var(--text-dim)" data-action="switchTab" data-arg0="transits">Today's Transits</button>
  </div>`;

  // Deepen Your Synthesis journey card
  const _hasProfile = readJourneyFlag('profileGenerated');
  const _steps = [
    { done: true,       icon: '⊙', label: 'Chart calculated',           cta: null },
    { done: _hasProfile, icon: '⬡', label: 'AI Profile generated',       cta: ['profile', 'Generate now'] },
    { done: false,      icon: '★', label: 'Behavioral Validation saved', cta: ['enhance', 'Add validation'] },
    { done: false,      icon: '◈', label: 'Big Five (OCEAN) saved',      cta: ['enhance', 'Take assessment'] },
    { done: false,      icon: '✦', label: 'Character Strengths saved',   cta: ['enhance', 'Take assessment'] },
    { done: false,      icon: '📖', label: '3+ Diary entries added',      cta: ['diary',   'Start diary'] },
  ];
  const doneCount = _steps.filter(s => s.done).length;
  const pct = Math.round((doneCount / _steps.length) * 100);
  html += `<div class="card" style="margin-top:var(--space-4)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3)">
      <div style="font-size:0.82rem;font-weight:700;color:var(--text)">Deepen Your Synthesis</div>
      <span style="font-size:0.78rem;color:var(--gold);font-weight:600">${doneCount}/${_steps.length} complete</span>
    </div>
    <div style="height:4px;background:var(--bg3);border-radius:2px;margin-bottom:var(--space-4);overflow:hidden">
      <div style="height:100%;width:${pct}%;background:var(--gold);border-radius:2px;transition:width 0.8s ease"></div>
    </div>
    ${_steps.map(s => `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:0.8rem;color:${s.done ? 'var(--text)' : 'var(--text-dim)'}">${s.done ? '✅' : '○'} ${s.icon} ${s.label}</span>
      ${(!s.done && s.cta) ? `<button class="btn-secondary" style="font-size:0.72rem;padding:2px 8px" data-action="switchTab" data-arg0="${s.cta[0]}">${s.cta[1]}</button>` : ''}
    </div>`).join('')}
    <p style="font-size:0.72rem;color:var(--text-dim);margin-top:var(--space-3)">Each layer you add unlocks richer AI synthesis — the more data, the deeper the insight.</p>
  </div>`;

  container.innerHTML = html;

  // Deferred Energy Chart render
  setTimeout(() => { if (typeof renderBodygraph === 'function') renderBodygraph(_ovBgId, chart); }, 50);
}

// ── Ambient Art Initialization ────────────────────────────────────
function initStars() {
  const container = document.getElementById('starsContainer');
  if (!container) return;
  
  const starCount = 80;
  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.animationDelay = Math.random() * 3 + 's';
    container.appendChild(star);
  }
}

function initParticles() {
  const container = document.getElementById('particlesContainer');
  if (!container) return;
  
  const particleCount = 10;
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 10 + 's';
    particle.style.animationDuration = (10 + Math.random() * 10) + 's';
    container.appendChild(particle);
  }
}

// Initialize ambient art on page load
initStars();
initParticles();

// ══════════════════════════════════════════════════════════════
// ENHANCEMENT & DIARY FUNCTIONS
// ══════════════════════════════════════════════════════════════

// BL-EXC-P1-4: Gate→diary prompt map (client-side, no AI call)
const GATE_DIARY_PROMPTS = {
  1: "What are you being called to create or express today?",
  2: "Where does your inner knowing want to guide you right now?",
  3: "What uncertainty or confusion can you turn into a learning experiment today?",
  4: "What solution or idea keeps returning — is it time to share it?",
  5: "What rhythm or ritual supports you more than you realize?",
  6: "Where do you sense a potential connection or collision forming?",
  7: "Who is looking to you for direction right now, and what do you need?",
  8: "What unique contribution feels most authentic to share today?",
  9: "What detail or pattern deserves closer attention in your life right now?",
  10: "How are you being true to yourself, even if others don't understand?",
  11: "What new idea or vision wants to be explored — not acted on yet, just held?",
  12: "Where are you being selective about your voice — what's worth expressing?",
  13: "Who carries a story that needs to be heard, and are you available to listen?",
  14: "Where are you aligning your material focus with what genuinely empowers you?",
  15: "How are you honoring your natural rhythms rather than forcing consistency?",
  16: "What skill or enthusiasm feels worth investing in right now?",
  17: "What opinion is forming — and what evidence supports or challenges it?",
  18: "What needs improvement or correction in your immediate environment?",
  19: "Where do you feel called to belong or contribute to something larger?",
  20: "What do you need to acknowledge or act on right in this moment?",
  21: "Where are you taking charge — and is it in service or in reaction?",
  22: "What feeling or mood wants to be honored rather than managed?",
  23: "What truth feels ready to be articulated, even if it disrupts comfort?",
  24: "What cycle of thought is ready to transform into understanding?",
  25: "Where are you being asked to act from innocence rather than strategy?",
  26: "What ego strength or personal power serves the greater good today?",
  27: "Where are you being called to nurture — yourself or others?",
  28: "What risk or struggle is making your life more meaningful right now?",
  29: "What commitment are you deepening — and is it truly aligned for you?",
  30: "What desire or passion wants to be felt fully rather than acted on impulsively?",
  31: "What leadership is emerging through you — not forced, but offered?",
  32: "What needs to be preserved before it can transform?",
  33: "What memory or story from the past holds a lesson for right now?",
  34: "What independent action feels most powerful and necessary today?",
  35: "What new experience is calling you out of your comfort zone?",
  36: "What emotional intensity is seeking understanding rather than relief?",
  37: "Where does belonging or family harmony require your attention?",
  38: "What are you fighting for that truly matters at a soul level?",
  39: "Where does tension point toward what matters most to you?",
  40: "Where have you been over-giving — and where do you need rest?",
  41: "What desire in you is brand new and not yet shaped into form?",
  42: "What cycle is completing, and are you allowing the ending?",
  43: "What insight just arrived that might not make sense to others yet?",
  44: "What patterns from the past are informing your current awareness?",
  45: "What resources or communities are you being asked to gather or lead?",
  46: "How is your body guiding your path today?",
  47: "What has been confusing that is now becoming clear?",
  48: "What depth of knowledge do you have that hasn't been invited yet?",
  49: "What principles are you refusing to compromise — and what does that cost?",
  50: "What values are you being asked to uphold or protect?",
  51: "Where did something unexpected shock you into greater awareness?",
  52: "What deserves your steady, focused attention right now?",
  53: "What new beginning wants to start — and do you have real energy for it?",
  54: "What ambition is driving you, and is it in alignment with your spirit?",
  55: "What mood is carrying an important message about what you need?",
  56: "What story or meaning are you constructing from recent experiences?",
  57: "What subtle intuition or body signal is worth trusting today?",
  58: "What brings you genuine aliveness and joy today?",
  59: "Where is intimacy or honest connection calling you?",
  60: "What limitation is actually the container for your next breakthrough?",
  61: "What truth is pressing for understanding even if it has no words yet?",
  62: "What facts or details help you think clearly about a current challenge?",
  63: "What are you genuinely doubtful about — and what would resolve it?",
  64: "What unresolved confusion is actually the beginning of an insight?",
};

// BL-EXC-P1-4: Load transit context for diary tab
let _diaryTransitCache = null;
async function loadDiaryTransitContext() {
  const container = document.getElementById('diaryTransitContext');
  if (!container) return;

  try {
    const data = _diaryTransitCache || await apiFetch('/api/transits/today');
    _diaryTransitCache = data;

    const t = data.data || data.transits || data;
    const positions = t.transitPositions || t.positions || {};
    const activations = t.gateActivations || [];

    // Get top 3 gates (natal hits first, then by planet priority)
    const PLANET_ORDER = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','NorthNode','TrueNode','Chiron'];
    const topGates = Object.entries(positions)
      .map(([planet, pos]) => ({ planet, gate: pos.gate, line: pos.line, isNatal: activations.some(a => a.natalGatePresent && String(a.gate) === String(pos.gate)) }))
      .filter(p => p.gate)
      .sort((a, b) => {
        if (a.isNatal !== b.isNatal) return a.isNatal ? -1 : 1;
        return PLANET_ORDER.indexOf(a.planet) - PLANET_ORDER.indexOf(b.planet);
      })
      .slice(0, 3);

    if (!topGates.length) { container.style.display = 'none'; return; }

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    let html = `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-3)">
      <div class="card-title" style="margin:0;font-size:var(--font-size-base)">☽ Today's Transit Energy — ${escapeHtml(today)}</div>
      <button class="btn-secondary btn-sm" data-action="switchTab" data-arg0="transits" style="font-size:var(--font-size-sm)">Full Report →</button>
    </div>
    <p style="font-size:var(--font-size-sm);color:var(--text-dim);margin:0 0 var(--space-3)">Today's active gates. Tap a reflection prompt to pre-fill your diary entry.</p>
    <div style="display:flex;flex-direction:column;gap:var(--space-2)">`;

    topGates.forEach(({ planet, gate, line, isNatal }) => {
      const prompt = GATE_DIARY_PROMPTS[gate] || `What does Gate ${gate} energy mean in your life today?`;
      const safePlanet = escapeHtml(planet);
      const safeGate = escapeAttr(String(gate));
      const safePrompt = escapeAttr(prompt);
      html += `<div style="background:var(--bg3);border-radius:var(--space-2);padding:var(--space-3);display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-2);flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <div style="font-size:var(--font-size-sm);font-weight:600;color:${isNatal ? 'var(--gold)' : 'var(--text)'}">
            ${safePlanet} · Gate ${escapeHtml(String(gate))}${line ? '.' + escapeHtml(String(line)) : ''}${isNatal ? ' ✦' : ''}
          </div>
          <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:2px;line-height:1.4">${escapeHtml(prompt)}</div>
        </div>
        <button class="btn-secondary btn-sm" data-action="prefillDiaryFromTransit" data-arg0="${safeGate}" data-arg1="${safePrompt}" style="white-space:nowrap;flex-shrink:0">Reflect →</button>
      </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
    container.style.display = '';
  } catch {
    container.style.display = 'none';
  }
}
window.loadDiaryTransitContext = loadDiaryTransitContext;

function prefillDiaryFromTransit(gate, prompt) {
  const titleEl = document.getElementById('diary-title');
  const descEl = document.getElementById('diary-description');
  const dateEl = document.getElementById('diary-date');
  if (titleEl && !titleEl.value) titleEl.value = `Gate ${gate} reflection`;
  if (descEl) descEl.value = prompt + (descEl.value ? '\n\n' + descEl.value : '');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  descEl?.focus();
  descEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
window.prefillDiaryFromTransit = prefillDiaryFromTransit;

function openDiaryFromTransit(gate, prompt) {
  switchTab('diary');
  // Allow tab switch render to complete before pre-filling
  setTimeout(() => prefillDiaryFromTransit(gate, prompt), 100);
}
window.openDiaryFromTransit = openDiaryFromTransit;

// ── Behavioral Validation ─────────────────────────────────────
async function saveValidation() {
  if (!token) { openAuthOverlay(); return; }

  const decision = document.getElementById('enhance-decision').value;
  const energy = document.getElementById('enhance-energy').value;
  const focus = document.getElementById('enhance-focus').value.trim();

  if (!decision || !energy) {
    showEnhanceStatus('enhanceStatus1', 'Please select both decision and energy patterns', 'error');
    return;
  }

  const btn = document.getElementById('enhanceBtn1');
  const spinner = document.getElementById('enhanceSpinner1');
  btn.disabled = true;
  spinner.style.display = '';

  try {
    await apiFetch('/api/validation/save', {
      method: 'POST',
      body: JSON.stringify({
        decisionPattern: decision,
        energyPattern: energy,
        currentFocus: focus || null
      })
    });
    showEnhanceStatus('enhanceStatus1', 'Behavioral validation saved! Your next profile will include this data.', 'success');
  } catch (e) {
    showEnhanceStatus('enhanceStatus1', 'Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// ── OCEAN Radar & VIA Bar Visualizations ─────────────────────
function _computeOceanScores(responses) {
  const acc = { openness: [], conscientiousness: [], extraversion: [], agreeableness: [], neuroticism: [] };
  responses.forEach(({ questionId, score }) => {
    const q = BIG_FIVE_QUESTIONS.find(q => q.id === questionId);
    if (!q) return;
    acc[q.dimension].push(q.reverse ? 6 - score : score);
  });
  const out = {};
  Object.entries(acc).forEach(([dim, vals]) => {
    if (!vals.length) { out[dim] = 50; return; }
    const mn = vals.length, mx = vals.length * 5;
    out[dim] = Math.round(((vals.reduce((a, b) => a + b, 0) - mn) / (mx - mn)) * 100);
  });
  return out;
}

function renderOceanRadar(scores) {
  const DIMS = [
    { key: 'openness',          label: 'Openness',           abbr: 'O', color: '#818CF8' },
    { key: 'conscientiousness', label: 'Conscientiousness',  abbr: 'C', color: '#34D399' },
    { key: 'extraversion',      label: 'Extraversion',       abbr: 'E', color: '#F5C842' },
    { key: 'agreeableness',     label: 'Agreeableness',      abbr: 'A', color: '#38BDF8' },
    { key: 'neuroticism',       label: 'Stability',          abbr: 'N', color: '#F472B6' },
  ];
  const N = DIMS.length, cx = 160, cy = 160, maxR = 110;

  const poly = (r) => DIMS.map((_, i) => {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

  let svg = `<svg viewBox="0 0 320 320" style="width:100%;max-width:300px;height:auto;display:block;margin:0 auto" role="img" aria-label="OCEAN personality radar chart">`;
  [0.25, 0.5, 0.75, 1].forEach(f => {
    svg += `<polygon points="${poly(maxR * f)}" fill="none" stroke="var(--bg3)" stroke-width="1" opacity="0.45"/>`;
  });
  DIMS.forEach((d, i) => {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    svg += `<line x1="${cx}" y1="${cy}" x2="${(cx + maxR * Math.cos(a)).toFixed(1)}" y2="${(cy + maxR * Math.sin(a)).toFixed(1)}" stroke="var(--bg3)" stroke-width="1" opacity="0.4"/>`;
  });
  // user polygon
  const dataPts = DIMS.map((d, i) => {
    const r = ((scores[d.key] || 0) / 100) * maxR;
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  svg += `<polygon points="${dataPts}" fill="rgba(56,189,248,0.14)" stroke="#38BDF8" stroke-width="2" stroke-linejoin="round"/>`;
  DIMS.forEach((d, i) => {
    const val = scores[d.key] || 0;
    const r = (val / 100) * maxR;
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    const px = (cx + r * Math.cos(a)).toFixed(1), py = (cy + r * Math.sin(a)).toFixed(1);
    const lx = (cx + (maxR + 24) * Math.cos(a)).toFixed(1);
    const ly = cy + (maxR + 24) * Math.sin(a);
    svg += `<circle cx="${px}" cy="${py}" r="4" fill="${d.color}"/>`;
    svg += `<text x="${lx}" y="${(ly - 5).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="bold" fill="${d.color}">${d.abbr}</text>`;
    svg += `<text x="${lx}" y="${(ly + 6).toFixed(1)}" text-anchor="middle" font-size="8" fill="var(--text-dim)">${Math.round(val)}%</text>`;
  });
  svg += `</svg>`;

  const bars = DIMS.map(d => {
    const val = Math.round(scores[d.key] || 0);
    // Neuroticism: lower raw score = higher stability, invert for display
    const display = d.key === 'neuroticism' ? 100 - val : val;
    const displayLabel = d.key === 'neuroticism' ? 'Emotional Stability' : d.label;
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span style="font-size:0.78rem;color:var(--text)">${displayLabel}</span>
        <span style="font-size:0.78rem;font-weight:600;color:${d.color}">${display}%</span>
      </div>
      <div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${display}%;background:${d.color};border-radius:3px;transition:width 0.8s ease"></div>
      </div>
    </div>`;
  }).join('');

  return `<div style="margin-top:var(--space-4);padding:var(--space-4);background:var(--bg2);border-radius:8px;border:1px solid var(--border)">
    <div style="font-size:0.88rem;font-weight:600;color:var(--text);margin-bottom:var(--space-3)">◈ Your OCEAN Profile</div>
    ${svg}
    <div style="margin-top:var(--space-4)">${bars}</div>
    <p style="font-size:0.73rem;color:var(--text-dim);margin-top:var(--space-3)">These scores inform your AI synthesis. Generate an AI Profile to see cross-correlations with your Energy Blueprint.</p>
  </div>`;
}

function renderVIATopStrengths(responses) {
  const COLORS = ['#F5C842', '#38BDF8', '#A78BFA', '#34D399', '#F472B6'];
  const sorted = [...responses].sort((a, b) => b.score - a.score);
  const top5 = sorted.slice(0, 5);
  const bars = top5.map((r, i) => {
    const pct = Math.round((r.score / 5) * 100);
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:0.82rem;color:var(--text)">${escapeHtml(r.strength || '')}</span>
        <span style="font-size:0.78rem;font-weight:600;color:${COLORS[i]}">${pct}%</span>
      </div>
      <div style="height:7px;background:var(--bg3);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${COLORS[i]};border-radius:4px;transition:width 0.8s ease"></div>
      </div>
    </div>`;
  }).join('');
  return `<div style="margin-top:var(--space-4);padding:var(--space-4);background:var(--bg2);border-radius:8px;border:1px solid var(--border)">
    <div style="font-size:0.88rem;font-weight:600;color:var(--text);margin-bottom:var(--space-3)">✦ Your Top 5 Character Strengths</div>
    ${bars}
    <p style="font-size:0.73rem;color:var(--text-dim);margin-top:var(--space-3)">Character strengths map to your Frequency Keys gifts. Generate an AI Profile to see the correlation.</p>
  </div>`;
}

// ── Big Five Assessment ───────────────────────────────────────
const BIG_FIVE_QUESTIONS = [
  {id: 1, text: "I am the life of the party.", dimension: "extraversion"},
  {id: 2, text: "I feel little concern for others.", dimension: "agreeableness", reverse: true},
  {id: 3, text: "I am always prepared.", dimension: "conscientiousness"},
  {id: 4, text: "I get stressed out easily.", dimension: "neuroticism"},
  {id: 5, text: "I have a rich vocabulary.", dimension: "openness"},
  {id: 6, text: "I don't talk a lot.", dimension: "extraversion", reverse: true},
  {id: 7, text: "I am interested in people.", dimension: "agreeableness"},
  {id: 8, text: "I leave my belongings around.", dimension: "conscientiousness", reverse: true},
  {id: 9, text: "I am relaxed most of the time.", dimension: "neuroticism", reverse: true},
  {id: 10, text: "I have difficulty understanding abstract ideas.", dimension: "openness", reverse: true},
  {id: 11, text: "I feel comfortable around people.", dimension: "extraversion"},
  {id: 12, text: "I insult people.", dimension: "agreeableness", reverse: true},
  {id: 13, text: "I pay attention to details.", dimension: "conscientiousness"},
  {id: 14, text: "I worry about things.", dimension: "neuroticism"},
  {id: 15, text: "I have a vivid imagination.", dimension: "openness"},
  {id: 16, text: "I keep in the background.", dimension: "extraversion", reverse: true},
  {id: 17, text: "I sympathize with others' feelings.", dimension: "agreeableness"},
  {id: 18, text: "I make a mess of things.", dimension: "conscientiousness", reverse: true},
  {id: 19, text: "I seldom feel blue.", dimension: "neuroticism", reverse: true},
  {id: 20, text: "I am not interested in abstract ideas.", dimension: "openness", reverse: true}
];

function renderBigFiveQuestions() {
  const container = document.getElementById('bigfive-questions');
  let html = '';
  
  BIG_FIVE_QUESTIONS.forEach(q => {
    html += `
      <div style="margin-bottom:var(--space-4);padding-bottom:var(--space-4);border-bottom:var(--border-width-thin) solid var(--border)">
        <div style="font-size:var(--font-size-base);color:var(--text);margin-bottom:var(--space-2)">${q.id}. ${q.text}</div>
        <div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap">
          ${[1,2,3,4,5].map(val => `
            <label style="display:flex;align-items:center;gap:var(--space-1);cursor:pointer;font-size:var(--font-size-sm);color:var(--text-dim)">
              <input type="radio" name="bigfive-${q.id}" value="${val}" style="width:auto">
              <span>${['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'][val-1]}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

async function saveBigFive() {
  if (!token) { openAuthOverlay(); return; }

  const responses = [];
  for (const q of BIG_FIVE_QUESTIONS) {
    const selected = document.querySelector(`input[name="bigfive-${q.id}"]:checked`);
    if (!selected) {
      showEnhanceStatus('bigfiveStatus', `Please answer question ${q.id}`, 'error');
      return;
    }
    responses.push({ questionId: q.id, score: parseInt(selected.value) });
  }

  const btn = document.getElementById('bigfiveBtn');
  const spinner = document.getElementById('bigfiveSpinner');
  btn.disabled = true;
  spinner.style.display = '';

  try {
    await apiFetch('/api/psychometric/save', {
      method: 'POST',
      body: JSON.stringify({ bigFiveResponses: responses })
    });
    const scores = _computeOceanScores(responses);
    const statusEl = document.getElementById('bigfiveStatus');
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-success">Big Five saved — cross-correlations unlocked for your next AI Profile.</div>${renderOceanRadar(scores)}`;
  } catch (e) {
    showEnhanceStatus('bigfiveStatus', 'Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// ── VIA Character Strengths ───────────────────────────────────
const VIA_STRENGTHS = [
  "Creativity", "Curiosity", "Judgment", "Love of Learning", "Perspective",
  "Bravery", "Perseverance", "Honesty", "Zest",
  "Love", "Kindness", "Social Intelligence",
  "Teamwork", "Fairness", "Leadership",
  "Forgiveness", "Humility", "Prudence", "Self-Regulation",
  "Appreciation of Beauty", "Gratitude", "Hope", "Humor", "Spirituality"
];

const VIA_QUESTIONS = VIA_STRENGTHS.map((strength, i) => ({
  id: i + 1,
  strength,
  text: `I embody ${lowerText(strength)}.`
}));

function renderVIAQuestions() {
  const container = document.getElementById('via-questions');
  let html = '';
  
  VIA_QUESTIONS.forEach(q => {
    html += `
      <div style="margin-bottom:var(--space-4);padding-bottom:var(--space-4);border-bottom:var(--border-width-thin) solid var(--border)">
        <div style="font-size:var(--font-size-base);color:var(--text);margin-bottom:var(--space-2)">${q.id}. ${q.strength}</div>
        <div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap">
          ${[1,2,3,4,5].map(val => `
            <label style="display:flex;align-items:center;gap:var(--space-1);cursor:pointer;font-size:var(--font-size-sm);color:var(--text-dim)">
              <input type="radio" name="via-${q.id}" value="${val}" style="width:auto">
              <span>${['Not like me', 'A little', 'Somewhat', 'Mostly', 'Very much'][val-1]}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

async function saveVIA() {
  if (!token) { openAuthOverlay(); return; }

  const responses = [];
  for (const q of VIA_QUESTIONS) {
    const selected = document.querySelector(`input[name="via-${q.id}"]:checked`);
    if (!selected) {
      showEnhanceStatus('viaStatus', `Please answer question ${q.id}`, 'error');
      return;
    }
    responses.push({ strength: q.strength, score: parseInt(selected.value) });
  }

  const btn = document.getElementById('viaBtn');
  const spinner = document.getElementById('viaSpinner');
  btn.disabled = true;
  spinner.style.display = '';

  try {
    await apiFetch('/api/psychometric/save', {
      method: 'POST',
      body: JSON.stringify({ viaResponses: responses })
    });
    const statusEl = document.getElementById('viaStatus');
    if (statusEl) statusEl.innerHTML = `<div class="alert alert-success">Character Strengths saved — Frequency Keys correlations unlocked.</div>${renderVIATopStrengths(responses)}`;
  } catch (e) {
    showEnhanceStatus('viaStatus', 'Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// ── Diary Functions ───────────────────────────────────────────
let currentDiaryEdit = null;

async function saveDiaryEntry() {
  if (!token) { openAuthOverlay(); return; }

  const date = document.getElementById('diary-date').value;
  const type = document.getElementById('diary-type').value;
  const significance = document.getElementById('diary-significance').value;
  const title = document.getElementById('diary-title').value.trim();
  const description = document.getElementById('diary-description').value.trim();

  if (!date || !title) {
    showEnhanceStatus('diaryStatus', 'Event date and title are required', 'error');
    return;
  }

  const btn = document.getElementById('diaryBtn');
  const spinner = document.getElementById('diarySpinner');
  btn.disabled = true;
  spinner.style.display = '';

  try {
    const payload = {
      eventDate: date,
      eventTitle: title,
      eventDescription: description || null,
      eventType: type,
      significance
    };

    if (currentDiaryEdit) {
      // Update existing entry
      const updateResult = await apiFetch(`/api/diary/${currentDiaryEdit}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (!updateResult?.ok) {
        throw new Error(updateResult?.error || 'Failed to update event');
      }
      showEnhanceStatus('diaryStatus', 'Event updated!', 'success');
      currentDiaryEdit = null;
      document.getElementById('diaryCancelBtn').style.display = 'none';
    } else {
      // Create new entry
      const createResult = await apiFetch('/api/diary', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!createResult?.ok) {
        throw new Error(createResult?.error || 'Failed to save event');
      }
      showEnhanceStatus('diaryStatus', 'Event saved! Transits auto-calculated for correlation.', 'success');
    }

    // Clear form
    document.getElementById('diary-date').value = '';
    document.getElementById('diary-title').value = '';
    document.getElementById('diary-description').value = '';
    
    // Reload list
    loadDiaryEntries();
  } catch (e) {
    showEnhanceStatus('diaryStatus', 'Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

async function loadDiaryEntries() {
  if (!token) { openAuthOverlay(); return; }

  const btn = document.getElementById('diaryLoadBtn');
  const spinner = document.getElementById('diaryLoadSpinner');
  const container = document.getElementById('diaryList');

  if (btn) {
    btn.disabled = true;
    spinner.style.display = '';
  }

  try {
    const params = new URLSearchParams();
    const search = document.getElementById('diarySearchInput')?.value?.trim();
    const type = document.getElementById('diaryTypeFilter')?.value;
    const significance = document.getElementById('diarySignificanceFilter')?.value;
    const dateFrom = document.getElementById('diaryDateFrom')?.value;
    const dateTo = document.getElementById('diaryDateTo')?.value;
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    if (significance) params.set('significance', significance);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const qs = params.toString();
    const hasFilters = qs.length > 0;

    const data = await apiFetch('/api/diary' + (hasFilters ? '?' + qs : ''));
    if (data?.error) throw new Error(data.error);
    if (hasFilters) trackEvent('diary_filtered', { search: !!search, type: !!type, significance: !!significance, dateRange: !!(dateFrom || dateTo) });
    const entries = Array.isArray(data?.data) ? data.data : [];

    if (entries.length === 0) {
      container.innerHTML = `<div class="alert alert-info">${window.t('diary.noEvents')}</div>`;
      return;
    }

    let html = '<div style="display:flex;flex-direction:column;gap:var(--space-3)">';
    
    entries.forEach(entry => {
      const date = new Date(entry.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const typeIcon = {
        career: '💼', relationship: '❤️', health: '🏥', spiritual: '✨',
        financial: '💰', family: '👨‍👩‍👧', other: '📌'
      }[entry.event_type] || '📌';

      html += `
        <div class="card" style="padding:var(--space-4);margin:0">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-2)">
            <div>
              <div style="font-size:var(--font-size-md);font-weight:600;color:var(--gold)">${typeIcon} ${escapeHtml(entry.event_title)}</div>
              <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-1)">${date} · ${entry.event_type} · ${entry.significance}</div>
            </div>
            <div style="display:flex;gap:var(--space-2)">
              <button class="btn-sm btn-secondary" data-action="editDiaryEntry" data-arg0="${escapeAttr(entry.id)}">Edit</button>
              <button class="btn-sm btn-danger" data-action="deleteDiaryEntry" data-arg0="${escapeAttr(entry.id)}">Delete</button>
            </div>
          </div>
          ${entry.event_description ? `<div style="font-size:var(--font-size-base);color:var(--text);margin-top:var(--space-2);line-height:1.5">${escapeHtml(entry.event_description)}</div>` : ''}
          ${entry.transit_snapshot ? '<div style="margin-top:var(--space-2);padding:var(--space-2);background:rgba(106,79,200,0.1);border-radius:var(--space-1);font-size:var(--font-size-sm);color:var(--accent)">🔮 Transit correlation data available</div>' : ''}
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">Error loading events: ${escapeHtml(e.message)}</div>`;
  } finally {
    if (btn) {
      btn.disabled = false;
      spinner.style.display = 'none';
    }
  }
}

async function exportDiary() {
  if (!token) { openAuthOverlay(); return; }
  try {
    const resp = await fetch('/api/diary/export', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!resp.ok) throw new Error('Export failed');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diary-entries.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    trackEvent('diary_exported');
  } catch (e) {
    showToast('Export failed: ' + e.message, 'error');
  }
}

async function editDiaryEntry(entryId) {
  if (!token) { openAuthOverlay(); return; }

  try {
    const data = await apiFetch(`/api/diary/${entryId}`);
    if (data?.error || !data?.data) throw new Error(data?.error || 'Failed to load entry');
    const entry = data.data;

    // Populate form
    document.getElementById('diary-date').value = entry.event_date.split('T')[0];
    document.getElementById('diary-type').value = entry.event_type;
    document.getElementById('diary-significance').value = entry.significance;
    document.getElementById('diary-title').value = entry.event_title;
    document.getElementById('diary-description').value = entry.event_description || '';

    // Set edit mode
    currentDiaryEdit = entryId;
    document.getElementById('diaryCancelBtn').style.display = '';
    
    // Scroll to form
    document.querySelector('#tab-diary .card').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    showEnhanceStatus('diaryStatus', 'Error loading entry: ' + e.message, 'error');
  }
}

function cancelDiaryEdit() {
  currentDiaryEdit = null;
  document.getElementById('diaryCancelBtn').style.display = 'none';
  document.getElementById('diary-date').value = '';
  document.getElementById('diary-title').value = '';
  document.getElementById('diary-description').value = '';
}

async function deleteDiaryEntry(entryId) {
  if (!token) { openAuthOverlay(); return; }
  if (!confirm('Delete this event? This cannot be undone.')) return;

  try {
    const result = await apiFetch(`/api/diary/${entryId}`, { method: 'DELETE' });
    if (!result?.ok) {
      throw new Error(result?.error || 'Failed to delete event');
    }
    showEnhanceStatus('diaryStatus', 'Event deleted', 'success');
    loadDiaryEntries();
  } catch (e) {
    showEnhanceStatus('diaryStatus', 'Error deleting: ' + e.message, 'error');
  }
}

// ── Diary AI Pattern Insights ──
async function generateDiaryInsights() {
  if (!token) { openAuthOverlay(); return; }
  const btn = document.getElementById('diaryInsightsBtn');
  const spinner = document.getElementById('diaryInsightsSpinner');
  const result = document.getElementById('diaryInsightsResult');
  if (btn) { btn.disabled = true; if (spinner) spinner.style.display = ''; }
  if (result) result.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>Analyzing patterns…</div></div>';

  try {
    const data = await apiFetch('/api/diary/insights', { method: 'POST' });
    if (data?.error) throw new Error(data.error);
    const md = data.insights || 'No insights generated.';
    result.innerHTML = `
      <div style="background:var(--bg3);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-2);padding:var(--space-4);line-height:1.6;white-space:pre-wrap">${escapeHtml(md)}</div>
      <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-2)">${data.entryCount} entries analyzed · ${new Date(data.generatedAt).toLocaleString()}</div>
    `;
    trackEvent?.('diary', 'diary_insights_generated');
  } catch (e) {
    if (result) result.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  } finally {
    if (btn) { btn.disabled = false; if (spinner) spinner.style.display = 'none'; }
  }
}

// ─── Check-In Functions ──────────────────────────────────────────────────────

function selectAlignment(score) {
  const scoreNum = parseInt(score, 10);
  document.getElementById('checkin-alignment-score').value = scoreNum;
  document.querySelectorAll('.alignment-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.score, 10) === scoreNum);
  });
}

async function saveCheckin() {
  if (!token) { openAuthOverlay(); return; }

  const score = parseInt(document.getElementById('checkin-alignment-score').value, 10);
  if (!score || score < 1 || score > 10) {
    showEnhanceStatus('checkinStatus', 'Please select an alignment score (1–10)', 'error');
    return;
  }

  const followedStrategy = document.getElementById('checkin-followed-strategy').checked;
  const followedAuthority = document.getElementById('checkin-followed-authority').checked;
  const mood = document.getElementById('checkin-mood').value || null;
  const energyRaw = document.getElementById('checkin-energy-level').value;
  const energyLevel = energyRaw ? parseInt(energyRaw, 10) : null;
  const notes = document.getElementById('checkin-notes').value.trim() || null;

  const btn = document.getElementById('checkinBtn');
  const spinner = document.getElementById('checkinSpinner');
  btn.disabled = true;
  spinner.style.display = '';

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const result = await apiFetch('/api/checkin', {
      method: 'POST',
      body: JSON.stringify({ alignmentScore: score, followedStrategy, followedAuthority, mood, energyLevel, notes, timezone })
    });

    if (result?.error) throw new Error(result.error);

    const serverStreak = Number.isFinite(result?.streak?.current) ? result.streak.current : null;
    const localStreak = markCheckinMilestone(serverStreak);

    // Show completed banner
    document.getElementById('checkinCompletedMsg').style.display = '';

    // Update streak badge
    const streak = serverStreak || localStreak;
    if (streak && streak > 0) {
      document.getElementById('streakDays').textContent = streak;
      document.getElementById('checkinStreakBadge').style.display = '';
    }

    showEnhanceStatus('checkinStatus', 'Check-in saved! ✓', 'success');

    // Clear notes field only; keep score visible so user can re-edit today
    document.getElementById('checkin-notes').value = '';
  } catch (e) {
    showEnhanceStatus('checkinStatus', 'Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

async function loadCheckinStats() {
  if (!token) { openAuthOverlay(); return; }

  const btn = document.getElementById('checkinStatsBtn');
  const spinner = document.getElementById('checkinStatsSpinner');
  btn.disabled = true;
  spinner.style.display = '';

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const [statsData, streakData, historyData] = await Promise.all([
      apiFetch('/api/checkin/stats?period=30'),
      apiFetch('/api/checkin/streak'),
      apiFetch('/api/checkin/history?days=10')
    ]);

    if (statsData?.error) throw new Error(statsData.error);

    const s = statsData?.stats || {};
    const streak = streakData?.streak?.current || 0;

    // Stat tiles
    const summary = document.getElementById('checkinStatsSummary');
    const tile = (label, value, sub) => `
      <div style="background:var(--bg3);border:var(--border-width-thin) solid var(--border);border-radius:var(--space-2);padding:var(--space-3);text-align:center">
        <div style="font-size:1.5rem;font-weight:700;color:var(--gold)">${value}</div>
        <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;margin:2px 0">${label}</div>
        ${sub ? `<div style="font-size:var(--font-size-xs);color:var(--text-muted)">${sub}</div>` : ''}
      </div>`;

    summary.innerHTML =
      tile('Avg Alignment', s.avgAlignmentScore ? s.avgAlignmentScore.toFixed(1) : '—', '30-day avg') +
      tile('Total Check-ins', s.totalCheckins ?? 0, '30 days') +
      tile('Strategy %', s.strategyAdherenceRate != null ? s.strategyAdherenceRate.toFixed(0) + '%' : '—', 'adherence') +
      tile('Authority %', s.authorityAdherenceRate != null ? s.authorityAdherenceRate.toFixed(0) + '%' : '—', 'adherence') +
      tile('🔥 Streak', streak, streak === 1 ? 'day' : 'days');

    // Recent history list
    const historyEl = document.getElementById('checkinHistoryList');
    const checkins = historyData?.checkins || [];
    const today = getLocalISODate();
    const hasTodayCheckin = checkins.some((entry) => String(entry?.checkinDate || '').slice(0, 10) === today);
    if (hasTodayCheckin) {
      markCheckinMilestone(streak);
    }
    if (checkins.length === 0) {
      historyEl.innerHTML = '<div class="alert alert-info">No check-in history yet. Save your first check-in above!</div>';
    } else {
      const moodIcon = { great: '😊', good: '🙂', neutral: '😐', challenging: '😕', difficult: '😞' };
      historyEl.innerHTML = checkins.slice().reverse().map(c => {
        const d = new Date(c.checkinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const scoreColor = c.alignmentScore >= 7 ? 'var(--accent2)' : c.alignmentScore >= 4 ? 'var(--gold)' : 'var(--red)';
        return `<div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) 0;border-bottom:var(--border-width-thin) solid var(--border)">
          <div style="width:36px;height:36px;border-radius:50%;background:${scoreColor};color:var(--bg1);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--font-size-base);flex-shrink:0">${c.alignmentScore}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:var(--font-size-sm);font-weight:600;color:var(--text)">${d} ${c.mood ? moodIcon[c.mood] || '' : ''}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-dim)">${c.followedStrategy ? '✓ Strategy' : '✗ Strategy'} · ${c.followedAuthority ? '✓ Authority' : '✗ Authority'}${c.notes ? ' · ' + escapeHtml(c.notes.substring(0, 60)) + (c.notes.length > 60 ? '…' : '') : ''}</div>
          </div>
        </div>`;
      }).join('');
    }

    document.getElementById('checkinStatsContainer').style.display = '';
  } catch (e) {
    showEnhanceStatus('checkinStatus', 'Error loading stats: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// ── Check-in Reminder Preferences ──
async function loadCheckinReminder() {
  if (!token) return;
  try {
    const data = await apiFetch('/api/checkin/reminder');
    if (data?.reminder) {
      const r = data.reminder;
      const timeEl = document.getElementById('reminder-time');
      const enabledEl = document.getElementById('reminder-enabled');
      const pushEl = document.getElementById('reminder-push');
      const emailEl = document.getElementById('reminder-email');
      if (timeEl) timeEl.value = r.reminder_time?.slice(0, 5) || '20:00';
      if (enabledEl) enabledEl.checked = r.enabled !== false;
      const methods = Array.isArray(r.notification_method) ? r.notification_method : [];
      if (pushEl) pushEl.checked = methods.includes('push');
      if (emailEl) emailEl.checked = methods.includes('email');
    }
  } catch (e) {
    console.warn('Failed to load reminder prefs', e);
  }
}

async function saveCheckinReminder() {
  if (!token) { openAuthOverlay(); return; }
  const time = document.getElementById('reminder-time')?.value || '20:00';
  const enabled = document.getElementById('reminder-enabled')?.checked !== false;
  const methods = [];
  if (document.getElementById('reminder-push')?.checked) methods.push('push');
  if (document.getElementById('reminder-email')?.checked) methods.push('email');

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    await apiFetch('/api/checkin/reminder', {
      method: 'POST',
      body: JSON.stringify({
        enabled,
        reminderTime: time + ':00',
        timezone: tz,
        notificationMethod: methods,
      }),
    });
    showEnhanceStatus('reminderStatus', enabled ? 'Reminder saved!' : 'Reminder disabled.', 'success');
    trackEvent?.('checkin', 'checkin_reminder_set', time);
  } catch (e) {
    showEnhanceStatus('reminderStatus', 'Error: ' + e.message, 'error');
  }
}

function showEnhanceStatus(elementId, message, type = 'info') {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  const alertClass = `alert-${type}`;
  el.innerHTML = `<div class="alert ${alertClass}">${escapeHtml(message)}</div>`;
  
  setTimeout(() => { el.innerHTML = ''; }, 5000);
}

// Initialize assessment questions lazily when Enhance tab is first activated
let _enhanceQuestionsLoaded = false;
function loadEnhanceQuestions() {
  if (_enhanceQuestionsLoaded) return;
  _enhanceQuestionsLoaded = true;
  renderBigFiveQuestions();
  renderVIAQuestions();
}

if (typeof window.registerTabInit === 'function') {
  window.registerTabInit('enhance', loadEnhanceQuestions);
}

function autoDetectTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      ['c-tz', 'p-tz'].forEach(id => setTimezone(id, tz));
    }
  } catch (e) { /* browser may not support Intl */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    updateTierUI();
    autoDetectTimezone();
  });
} else {
  updateTierUI();
  autoDetectTimezone();
}

// ── Update Tier-Specific UI ──────────────────────────────────
async function updateTierUI() {
  if (!token) return;
  
  try {
    const userData = await apiFetch('/api/auth/me');
    if (!userData || !userData.user) return;
    
    const tier = userData.user.tier || 'free';
    
    // SCAN-015: Fetch tier configuration from backend (source of truth)
    // Fallback to conservative defaults if fetch fails
    let tierLimits = null;
    try {
      const tierConfigRes = await apiFetch('/api/billing/tiers');
      if (tierConfigRes && tierConfigRes.ok && tierConfigRes.tiers) {
        // Build tierLimits from fetched config
        tierLimits = {};
        for (const [tierName, tierData] of Object.entries(tierConfigRes.tiers)) {
          tierLimits[tierName] = {
            profileGenerations: tierData.features?.profileGenerations || 1,
            practitionerTools: tierData.features?.practitionerTools || false
          };
        }
      }
    } catch (apiError) {
      console.warn('Failed to fetch tier config from backend, using fallback:', apiError);
      // Fallback to conservative frontend defaults
      tierLimits = null;
    }
    
    // If fetch failed, use fallback tier limits
    if (!tierLimits) {
      tierLimits = {
        free: { profileGenerations: 1, practitionerTools: false },
        individual: { profileGenerations: 10, practitionerTools: false },
        practitioner: { profileGenerations: 500, practitionerTools: true },
        agency: { profileGenerations: 2000, practitionerTools: true },
        // Legacy aliases (match to canonical tiers for backward compat)
        regular: { profileGenerations: 10, practitionerTools: false },
        seeker: { profileGenerations: 10, practitionerTools: false },
        white_label: { profileGenerations: 2000, practitionerTools: true },
        guide: { profileGenerations: 500, practitionerTools: true },
      };
    }
    
    const limits = tierLimits[tier];
    
    // Show practitioner upgrade notice if not guide/practitioner
    const practUpgradeNotice = document.getElementById('practitionerUpgradeNotice');
    if (practUpgradeNotice) {
      if (!limits.practitionerTools) {
        practUpgradeNotice.style.display = 'block';
      } else {
        practUpgradeNotice.style.display = 'none';
      }
    }
    
    // Show profile quota notice — for free/individual tiers, include upgrade CTA
    const profileQuotaNotice = document.getElementById('profileQuotaNotice');
    const profileQuotaText = document.getElementById('profileQuotaText');
    if (profileQuotaNotice && profileQuotaText && limits.profileGenerations !== Infinity) {
      if (tier === 'free') {
        profileQuotaText.innerHTML = `Free plan includes 1 AI synthesis per month. <a href="#" data-action="openPricingModal" style="text-decoration:underline">Upgrade to Individual ($19/mo)</a> for 10 syntheses, full transit reports, and more.`;
      } else {
        profileQuotaText.textContent = `You have ${limits.profileGenerations} profile generation${limits.profileGenerations === 1 ? '' : 's'} per month on the ${tier} tier.`;
      }
      profileQuotaNotice.style.display = 'block';
    } else if (profileQuotaNotice) {
      profileQuotaNotice.style.display = 'none';
    }
  } catch (e) {
    console.error('Failed to update tier UI:', e);
  }
}

// ── Share & Export Functions ──────────────────────────────────

/**
 * Share profile using Web Share API or fallback
 * @param {string} title - Share title
 * @param {string} text - Share description
 * @param {string} url - URL to share (optional, defaults to current user profile)
 */
async function shareProfile(title, text, url) {
  try {
    // Get current user for personalized sharing
    const user = await apiFetch('/api/auth/me').catch(() => null);
    
    // Build share URL with referral tracking
    const shareUrl = url || buildShareUrl(user);
    const shareTitle = title || `Check out my Prime Self Energy Blueprint!`;
    const shareText = text || `Discover your unique energy blueprint through Frequency Keys, Astrology, and Numerology.`;
    
    // Use Web Share API if available (mobile browsers)
    if (navigator.share) {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl
      });
      if (window.DEBUG) console.log('✅ Share successful');
      
      // Track share event (optional analytics)
      trackEvent('share', 'profile', 'web_share_api');
    } else {
      // Fallback: Copy link to clipboard and show notification
      await copyToClipboard(shareUrl);
      showNotification('Link copied to clipboard! Share it anywhere.', 'success');
      
      // Track fallback share
      trackEvent('share', 'profile', 'clipboard_fallback');
    }
  } catch (error) {
    if (error.name !== 'AbortError') { // User cancelled share
      console.error('Share failed:', error);
      showNotification('Share failed. Please try again.', 'error');
    }
  }
}

/**
 * Build shareable URL with referral tracking
 * @param {object} user - Current user object
 * @returns {string} - URL with referral parameters
 */
function buildShareUrl() {
  const baseUrl = window.location.origin;
  const params = new URLSearchParams();
  
  // Add referral code if user is logged in — use userEmail since 'user' object is not stored
  if (userEmail) {
    // Create a short hash from email for referral tracking
    let hash = 0;
    for (let i = 0; i < userEmail.length; i++) {
      hash = ((hash << 5) - hash) + userEmail.charCodeAt(i);
      hash |= 0;
    }
    params.set('ref', Math.abs(hash).toString(36));
  }
  
  // Add UTM parameters for tracking
  params.set('utm_source', 'share');
  params.set('utm_medium', 'web_share');
  params.set('utm_campaign', 'user_referral');
  
  return `${baseUrl}${params.toString() ? '?' + params.toString() : ''}`;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<void>}
 */
async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    // Modern Clipboard API
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * Share to specific social platform
 * @param {string} platform - 'facebook', 'twitter', 'linkedin', 'whatsapp'
 *
 * NOTE (SYS-038): 'facebook' opens the standard Facebook share dialog (sharer.php),
 * NOT Facebook OAuth login. Facebook login is not implemented — the backend returns 501
 * for /api/auth/oauth/facebook/* routes. Only Google and Apple OAuth are active.
 */
function shareToSocial(platform) {
  const shareUrl = buildShareUrl();
  const shareText = encodeURIComponent('Discover your unique energy blueprint through Frequency Keys, Astrology, and Numerology on Prime Self!');
  
  const urls = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${shareText}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    whatsapp: `https://wa.me/?text=${shareText}%20${encodeURIComponent(shareUrl)}`,
    email: `mailto:?subject=Check out Prime Self&body=${shareText}%0A%0A${encodeURIComponent(shareUrl)}`
  };
  
  if (urls[platform]) {
    window.open(urls[platform], '_blank', 'width=600,height=400');
    trackEvent('share', 'profile', platform);
    trackEvent('viral', 'viral_share_sent', platform); // WC-P1-2
  }
}

/**
 * Show notification message (Sprint 19.3 - consolidated error handling)
 * @param {string} message - Notification text
 * @param {string} type - 'success', 'error', 'info', 'warning'
 */
function showNotification(message, type = 'info') {
  // Check if notification container exists, create if not
  let container = document.getElementById('notificationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notificationContainer';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Notifications');
    container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: var(--z-modal, 400);
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      max-height: calc(100vh - 100px);
      overflow-y: auto;
    `;
    document.body.appendChild(container);
  }
  
  // Color mapping for notification types
  const colors = {
    success: 'rgba(80,200,120,0.95)',
    error: 'rgba(224,80,80,0.95)',
    warning: 'rgba(230,170,50,0.95)',
    info: 'rgba(106,79,200,0.95)'
  };
  
  // Create notification element with aria-live for screen readers
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.setAttribute('role', 'alert');
  notification.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  notification.style.cssText = `
    background: ${colors[type] || colors.info};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: var(--shadow);
    font-size: 0.9rem;
    font-weight: 600;
    max-width: 300px;
    pointer-events: auto;
    animation: slideInRight 0.3s ease-out;
  `;
  notification.textContent = message;
  
  container.appendChild(notification);
  
  // Auto-remove after delay (errors last longer)
  const delay = type === 'error' ? 5000 : 3000;
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, delay);
}

/**
 * Track analytics event (stub for future analytics integration)
 */
function trackEvent(category, action, label) {
  if (window.DEBUG) console.log(`📊 Event: ${category} / ${action} / ${label}`);
  // Plausible Analytics — fires when plausible.io/js/script.js is loaded
  if (typeof window.plausible === 'function') {
    window.plausible(`${category}:${action}`, { props: { label: label || '' } });
  }
}

/**
 * Open share modal — fetches real referral code from API for logged-in users
 */
async function openShareModal() {
  // ACC-P2-8: Store trigger element for focus restoration on close
  storeModalTrigger('shareModal');

  const modal = document.getElementById('shareModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  if (token) {
    // Fetch (or generate) the user's real referral code
    try {
      const codeData = await apiFetch('/api/referrals/code', { method: 'POST' });
      if (codeData?.ok && codeData.url) {
        const shareLinkInput = document.getElementById('shareLinkInput');
        if (shareLinkInput) shareLinkInput.value = codeData.url;
      }
    } catch (_) { /* fall through to local URL */ }

    // Fetch referral stats to display in modal
    try {
      const statsData = await apiFetch('/api/referrals');
      if (statsData?.ok && statsData.stats) {
        const s = statsData.stats;
        const statsEl = document.getElementById('referralStats');
        if (statsEl) {
          document.getElementById('refStatTotal').textContent = s.totalReferrals || 0;
          document.getElementById('refStatConverted').textContent = s.convertedReferrals || 0;
          document.getElementById('refStatRewards').textContent =
            s.totalRewardValue ? `$${(s.totalRewardValue / 100).toFixed(0)}` : '$0';
          statsEl.style.display = 'block';
        }
      }
    } catch (_) { /* stats optional */ }
  } else {
    // Not logged in — use local URL
    const shareLinkInput = document.getElementById('shareLinkInput');
    if (shareLinkInput) shareLinkInput.value = buildShareUrl();
  }
}

/**
 * Close share modal
 */
function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  // ACC-P2-8: Restore focus to trigger element
  restoreModalFocus('shareModal');
}

/**
 * Copy share link from modal
 */
async function copyShareLink() {
  const shareLinkInput = document.getElementById('shareLinkInput');
  if (shareLinkInput) {
    await copyToClipboard(shareLinkInput.value);
    showNotification('Link copied! Share it anywhere.', 'success');
    trackEvent?.('viral', 'viral_link_copied'); // WC-P1-2
    // WC-P1-2: post-copy compare invite nudge (shown once per modal open)
    if (!document.getElementById('share-compare-nudge')) {
      const body = document.querySelector('#shareModal .share-modal-body');
      if (body) {
        const nudge = document.createElement('div');
        nudge.id = 'share-compare-nudge';
        nudge.className = 'share-section';
        nudge.style.cssText = 'background:rgba(212,175,55,0.08);border-radius:8px;padding:12px 16px';
        nudge.innerHTML = `<p style="margin:0 0 8px;font-size:var(--font-size-sm);color:var(--text)">See which famous figures share your blueprint — then invite a friend to compare theirs.</p><button class="btn-secondary btn-sm" data-action="goToCompareAndClose">→ See Famous Matches</button>`;
        body.appendChild(nudge);
      }
    }
  }
}

// Add slide-in/out animations
if (!document.getElementById('notificationStyles')) {
  const style = document.createElement('style');
  style.id = 'notificationStyles';
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
    /* Share Modal Styles */
    .share-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      padding: 20px;
    }
    .share-modal-overlay.hidden {
      display: none;
    }
    .share-modal {
      background: var(--bg2);
      border-radius: 12px;
      max-width: 500px;
      width: 100%;
      box-shadow: var(--shadow-xl);
      border: 1px solid var(--gold-dim);
    }
    @media (max-width: 768px) {
      .share-modal {
        max-width: 100%;
        margin: 0;
        border-radius: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// ── Init ──────────────────────────────────────────────────────
// Capture referral code from URL before any redirects strip it
(function captureReferralCode() {
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref && /^[A-Z0-9_-]{1,64}$/i.test(ref)) {
    localStorage.setItem('ps_pending_ref', ref.toLowerCase());
  }
})();

capturePractitionerInviteFromUrl();
capturePostCheckoutIntentFromUrl();
captureReferralFromUrl(); // Phase 2B
captureGiftFromUrl();    // item 4.6

// Restore session from HttpOnly refresh cookie, then boot UI
(async () => {
  await checkOAuthCallback();
  checkResetPasswordAction();
  checkEmailUnsubscribeAction();
  checkEmailVerificationAction();
  if (_sessionRestoredByOauth) {
    // OAuth callback already set token and called fetchUserProfile — skip silentRefresh
    userEmail = sessionStorage.getItem('ps_email');
    await processPendingPractitionerInvite();
    await applyPendingPostCheckoutIntent();
    return;
  }
  // Avoid noisy /auth/refresh 400s for users who have never signed in on this device.
  const hasSessionHint = !!localStorage.getItem('ps_session');
  if (!hasSessionHint) {
    updateAuthUI();
    await processPendingPractitionerInvite({ promptForAuth: true });
    return;
  }
  const restored = await silentRefresh();
  if (restored) {
    userEmail = sessionStorage.getItem('ps_email');
    await fetchUserProfile();
    await processPendingPractitionerInvite();
    await applyPendingPostCheckoutIntent();
  } else {
    updateAuthUI();
    await processPendingPractitionerInvite({ promptForAuth: true });
  }
})();

// ── Wrapper functions for complex inline handlers ───────────────────────────
function hideMemberForm() { const el = document.getElementById('addMemberFormCard'); if (el) el.style.display = 'none'; }
function hidePracDetail()  { const el = document.getElementById('pracDetailPanel');  if (el) el.style.display = 'none'; }
// Phase 1A: Scroll past the synthesis opener to the main profile card
function scrollToProfile() {
  const profileResult = document.getElementById('profileResult');
  if (!profileResult) return;
  const card = profileResult.querySelector('.card:not(.synthesis-opener)');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// PRAC-016: Navigate to composite tab with practitioner/client data already carried over.
function openCompatibilityWithClient(clientId, emailLabel) {
  switchTab('composite');
  const detail = _practitionerClientDetailCache.get(String(clientId));
  const clientName = detail?.client?.display_name || emailLabel || 'this client';
  const practitionerSeed = getPractitionerCompositeSeed();
  const clientSeed = getClientCompositeSeed(clientId);

  applyCompositePersonSeed('A', practitionerSeed, 'Your saved data');
  applyCompositePersonSeed('B', clientSeed, `${clientName}'s saved data`);

  if (practitionerSeed.location && !hasCoordinatePair(practitionerSeed)) {
    geocodeLocation('comp-A').catch(() => {});
  }
  if (clientSeed.location && !hasCoordinatePair(clientSeed)) {
    geocodeLocation('comp-B').catch(() => {});
  }

  const personAMissing = describeCompositeMissingFields(practitionerSeed);
  const personBMissing = describeCompositeMissingFields(clientSeed);
  const parts = [`Compatibility setup started from ${clientName}'s workspace.`];
  if (personAMissing.length) {
    parts.push(`Person A still needs ${formatFieldList(personAMissing)}.`);
  } else {
    parts.push('Your data is ready as Person A.');
  }
  if (personBMissing.length) {
    parts.push(`${clientName} still needs ${formatFieldList(personBMissing)} as Person B.`);
  } else {
    parts.push(`${clientName}'s saved data is ready as Person B.`);
  }
  const launchMessage = parts.join(' ');
  setCompositeLaunchNote(launchMessage, personAMissing.length || personBMissing.length ? 'warn' : 'success');

  const compResult = document.getElementById('compResult');
  if (compResult) compResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showNotification(personAMissing.length || personBMissing.length ? 'Compatibility setup loaded with targeted missing fields.' : 'Compatibility setup loaded from saved birth data.', 'info');
  if (personAMissing.length || personBMissing.length) {
    focusCompositeMissingField(personAMissing.length ? 'A' : 'B', personAMissing.length ? personAMissing : personBMissing);
  }
}
function openLastShareCard() { if (typeof showShareCard === 'function') showShareCard(window._lastChart); }
function openBlueprintCard() { if (typeof showBlueprintCard === 'function') showBlueprintCard(window._lastChart, window._lastForge); }
function switchToPricingModal()    { closePractitionerPricingModal(); openPricingModal(); }
function switchToPracPricingModal() { openPractitionerPricingModal(); closePricingModal(); }

// ── Notification Drawer (AUDIT-UX-002) ──────────────────────────────────────
function toggleNotifDrawer() {
  const drawer = document.getElementById('notifDrawer');
  if (!drawer) return;
  const visible = drawer.style.display !== 'none';
  drawer.style.display = visible ? 'none' : '';
  if (!visible && token) loadNotificationHistory();
}

async function loadNotificationHistory() {
  if (!token) return;
  const list = document.getElementById('notifDrawerList');
  if (!list) return;
  list.innerHTML = '<p style="text-align:center;padding:16px"><span class="spinner"></span></p>';

  try {
    const data = await apiFetch('/api/push/history?limit=30');
    if (!data.notifications?.length) {
      list.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px 0">No notifications yet.</p>';
      return;
    }
    list.innerHTML = data.notifications.map(n => {
      const date = new Date(n.sentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `<div class="notif-item">
        <div class="notif-item-title">${escapeHtml(n.title || '')}</div>
        <div class="notif-item-body">${escapeHtml(n.body || '')}</div>
        <div class="notif-item-time">${date}</div>
      </div>`;
    }).join('');
  } catch {
    list.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:24px 0">Could not load notifications.</p>';
  }
}

// ── Capacitor native push bridge ────────────────────────────────────────────
function _isCapacitorNative() {
  return !!(window.Capacitor?.isNativePlatform?.());
}

async function _subscribeCapacitorNativePush() {
  const { PushNotifications } = window.Capacitor.Plugins;
  try {
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      trackEvent?.('push', 'push_permission_denied');
      return;
    }
    await PushNotifications.register();
    // Token delivered via 'registration' listener — set up once
    PushNotifications.addListener('registration', async (token) => {
      trackEvent?.('push', 'push_permission_granted');
      const platform = window.Capacitor.getPlatform?.() === 'android' ? 'fcm' : 'apns';
      await apiFetch('/api/push/native-subscribe', {
        method: 'POST',
        body: JSON.stringify({ nativeToken: token.value, platform })
      });
      _renderPushPrefsState?.();
    });
    PushNotifications.addListener('registrationError', (err) => {
      console.warn('Capacitor push registration error:', err.error);
      trackEvent?.('push', 'push_permission_denied');
    });
  } catch (e) {
    console.warn('Capacitor push setup failed:', e.message);
  }
}

// ── WC-P1-3: Push opt-in nudge at key moments ──────────────────────────────
function _maybeShowPushOptIn(context = 'chart') {
  const isNative = _isCapacitorNative();
  if (!isNative && !('Notification' in window)) return;
  if (!isNative && Notification.permission !== 'default') return;
  if (localStorage.getItem('push_optin_offered')) return;
  localStorage.setItem('push_optin_offered', '1');
  trackEvent?.('push', 'push_optin_shown');

  const target = context === 'profile'
    ? document.getElementById('profileResult')
    : (document.getElementById('overviewContent') || document.getElementById('chartResult'));
  if (!target) return;

  const card = document.createElement('div');
  card.id = 'push-optin-nudge';
  card.className = 'card';
  card.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.2);margin-top:16px';
  card.innerHTML = `<span aria-hidden="true" style="color:var(--gold);font-size:1.125rem">📲</span><p style="flex:1;margin:0;font-size:var(--font-size-sm);color:var(--text)">Get your daily energy insight — transit, gate, and cycle alerts sent each morning.</p><div style="display:flex;gap:8px;flex-shrink:0"><button class="btn-primary btn-sm" id="push-optin-yes">Enable notifications</button><button class="btn-secondary btn-sm" id="push-optin-no">Not now</button></div>`;
  target.appendChild(card);

  card.querySelector('#push-optin-yes').addEventListener('click', () => {
    trackEvent?.('push', 'push_optin_accepted');
    card.remove();
    requestPushPermission();
  });
  card.querySelector('#push-optin-no').addEventListener('click', () => {
    trackEvent?.('push', 'push_optin_dismissed');
    card.remove();
  });
}

// ── WC-P1-2: Go to celebrity compare tab ─────────────────────────────────────
function goToCompareAndClose() {
  trackEvent?.('viral', 'viral_compare_clicked');
  closeShareModal();
  if (typeof switchTab === 'function') {
    const btn = document.querySelector('[data-tab="celebrity"]');
    switchTab('celebrity', btn);
  }
}
window.goToCompareAndClose = goToCompareAndClose;

// ── WC-P1-5: Trust Proof Block ───────────────────────────────────────────────
// Content is supplied via window.TRUST_PROOF_ITEMS array.
// Each item requires: { role, outcome, consentStatus, date }
// Optional: { name } — use role/title only if name withheld by request.
// Call renderTrustProof() after DOMContentLoaded once items are available.
//
// Content lint: scripts/lint-trust-proof.js will flag items missing required fields
// or with placeholder text. Run via: node scripts/lint-trust-proof.js
function renderTrustProof() {
  const items = window.TRUST_PROOF_ITEMS;
  if (!Array.isArray(items) || items.length < 1) return;

  const requiredFields = ['role', 'outcome', 'consentStatus', 'date'];
  const valid = items.filter(item =>
    requiredFields.every(f => item[f] && String(item[f]).trim().length > 0) &&
    item.consentStatus === 'confirmed'
  );
  if (valid.length === 0) return;

  const css = `
    .trust-proof-section { padding: 24px 16px; max-width: 1100px; margin: 0 auto; }
    .trust-proof-heading { text-align: center; color: var(--text-dim, #aaa); font-size: 0.78rem; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 16px; }
    .trust-proof-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .trust-proof-card { background: var(--bg2, #16161e); border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 10px; padding: 18px 20px; }
    .trust-proof-quote { font-size: 0.9rem; color: var(--text, #e8e8f0); line-height: 1.6; margin: 0 0 14px; }
    .trust-proof-meta { font-size: 0.75rem; color: var(--text-dim, #888); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .trust-proof-verified { display: inline-flex; align-items: center; gap: 4px; color: var(--accent2, #2ecc71); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em; }
  `;
  if (!document.getElementById('trust-proof-styles')) {
    const style = document.createElement('style');
    style.id = 'trust-proof-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  const cards = valid.map(item => {
    const quoteSafe   = escapeHtml(item.outcome);
    const roleSafe    = escapeHtml(item.role);
    const dateSafe    = escapeHtml(item.date);
    const nameSafe    = item.name ? ` · ${escapeHtml(item.name)}` : '';
    return `<div class="trust-proof-card" role="article">
      <p class="trust-proof-quote">"${quoteSafe}"</p>
      <div class="trust-proof-meta">
        <span>${roleSafe}${nameSafe}</span>
        <span aria-hidden="true">·</span>
        <span>${dateSafe}</span>
        <span class="trust-proof-verified" aria-label="Consent confirmed">✓ Verified</span>
      </div>
    </div>`;
  }).join('');

  const html = `<div class="trust-proof-section">
    <p class="trust-proof-heading">What practitioners &amp; clients say</p>
    <div class="trust-proof-grid">${cards}</div>
  </div>`;

  // Populate all proof block slots on the page
  ['trust-proof-block', 'trust-proof-block-pricing'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = html; el.style.display = ''; }
  });
}
// Auto-render on load if items are pre-defined
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderTrustProof);
} else {
  renderTrustProof();
}
window.renderTrustProof = renderTrustProof;

// ── Push Notification Preferences ───────────────────────────────────────────
function openPushPreferences() {
  storeModalTrigger('pushPrefsModal');
  const modal = document.getElementById('pushPrefsModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  _renderPushPrefsState();
  loadPushPreferences();
}

function closePushPreferences() {
  const modal = document.getElementById('pushPrefsModal');
  if (modal) modal.classList.add('hidden');
  restoreModalFocus('pushPrefsModal');
}

function _renderPushPrefsState() {
  const status = document.getElementById('pushPermissionStatus');
  const enableBtn = document.getElementById('pushEnableBtn');
  const toggles = document.getElementById('pushPrefsToggles');
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    if (status) status.textContent = 'Push notifications are not supported in this browser.';
    if (enableBtn) enableBtn.style.display = 'none';
    if (toggles) toggles.style.display = 'none';
    return;
  }
  const perm = Notification.permission;
  if (perm === 'granted') {
    if (status) status.textContent = 'Push notifications are enabled.';
    if (enableBtn) enableBtn.style.display = 'none';
    if (toggles) toggles.style.display = '';
  } else if (perm === 'denied') {
    if (status) status.textContent = 'Push notifications are blocked. Please enable them in your browser settings.';
    if (enableBtn) enableBtn.style.display = 'none';
    if (toggles) toggles.style.display = 'none';
  } else {
    if (status) status.textContent = 'Enable push notifications to receive transit alerts, session reminders, and more.';
    if (enableBtn) enableBtn.style.display = '';
    if (toggles) toggles.style.display = 'none';
  }
}

async function requestPushPermission() {
  if (_isCapacitorNative()) {
    return _subscribeCapacitorNativePush();
  }
  if (!('Notification' in window)) return;
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      trackEvent?.('push', 'push_permission_granted');
      await _subscribeToPush();
    } else {
      trackEvent?.('push', 'push_permission_denied');
    }
    _renderPushPrefsState();
  } catch {
    showNotification('Could not request notification permission.', 'error');
  }
}

async function _subscribeToPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const keyRes = await apiFetch('/api/push/vapid-key');
    if (!keyRes?.vapidKey) return;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(keyRes.vapidKey)
    });
    await apiFetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription: sub.toJSON() })
    });
  } catch (e) {
    console.warn('Push subscription failed:', e.message);
  }
}

function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function loadPushPreferences() {
  if (!token) return;
  try {
    const data = await apiFetch('/api/push/preferences');
    const prefs = data.preferences || data;
    const fields = ['transitDaily', 'gateActivation', 'cycleApproaching', 'transitAlert', 'weeklyDigest'];
    fields.forEach(f => {
      const el = document.getElementById(`pushPref-${f}`);
      if (el) el.checked = prefs[f] !== false;
    });
    const qs = document.getElementById('pushPref-quietStart');
    const qe = document.getElementById('pushPref-quietEnd');
    if (qs) qs.value = prefs.quietHoursStart != null ? String(prefs.quietHoursStart) : '';
    if (qe) qe.value = prefs.quietHoursEnd != null ? String(prefs.quietHoursEnd) : '';
  } catch {
    // non-fatal
  }
}

async function savePushPreferences() {
  if (!token) return;
  const fields = ['transitDaily', 'gateActivation', 'cycleApproaching', 'transitAlert', 'weeklyDigest'];
  const prefs = {};
  fields.forEach(f => {
    const el = document.getElementById(`pushPref-${f}`);
    if (el) prefs[f] = el.checked;
  });
  const qs = document.getElementById('pushPref-quietStart');
  const qe = document.getElementById('pushPref-quietEnd');
  if (qs?.value) prefs.quietHoursStart = parseInt(qs.value, 10);
  if (qe?.value) prefs.quietHoursEnd = parseInt(qe.value, 10);
  try {
    await apiFetch('/api/push/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs)
    });
    showNotification('Notification preferences saved.', 'success');
    trackEvent?.('push', 'push_preferences_updated');
    closePushPreferences();
  } catch (e) {
    showNotification('Could not save preferences: ' + e.message, 'error');
  }
}

async function testPushNotification() {
  if (!token) return;
  try {
    await apiFetch('/api/push/test', { method: 'POST' });
    showNotification('Test notification sent!', 'info');
  } catch (e) {
    showNotification('Could not send test: ' + e.message, 'error');
  }
}

// ── First-Run Onboarding Modal ─────────────────────────────────────────────
let _frmCurrentStep = 1;
const FRM_TOTAL_STEPS = 4;

function frmShow() {
  if (hasSeenFirstRunOnboarding() || readJourneyFlag('chartGenerated')) return;
  // ACC-P2-8: Store trigger element for focus restoration on close
  storeModalTrigger('first-run-modal');

  const modal = document.getElementById('first-run-modal');
  if (modal) modal.style.display = '';
  _frmCurrentStep = 1;
  // Prefer first-run.js's frmGoto if available (loads after this file)
  if (typeof frmGoto === 'function') { frmGoto(1); } else { _frmRender(); }
}

function frmClose() {
  const modal = document.getElementById('first-run-modal');
  if (modal) modal.style.display = 'none';
  try {
    localStorage.setItem('primeself_frm_seen', '1');
    localStorage.setItem('ps_hasSeenOnboarding', '1');
  } catch(e) {}
  // ACC-P2-8: Restore focus to trigger element
  restoreModalFocus('first-run-modal');
}

function frmNext() {
  if (_frmCurrentStep < FRM_TOTAL_STEPS) {
    _frmCurrentStep++;
    _frmRender();
  }
}

function frmBack() {
  if (_frmCurrentStep > 1) {
    _frmCurrentStep--;
    _frmRender();
  }
}

function _frmRender() {
  for (let i = 1; i <= FRM_TOTAL_STEPS; i++) {
    const step = document.getElementById('frm-step-' + i);
    const dot  = document.getElementById('frm-dot-' + i);
    if (step) step.classList.toggle('active', i === _frmCurrentStep);
    if (dot)  dot.classList.toggle('active', i === _frmCurrentStep);
  }
}

function frmCloseChart()   { frmClose(); switchTab('chart'); }
function shareProfileAndClose() { if (typeof shareProfile === 'function') shareProfile(); closeShareModal(); }
function toggleDetails(toggleId, btn) {
  const el = document.getElementById(toggleId);
  if (!el) return;
  const hidden = el.style.display === 'none' || !el.style.display;
  el.style.display = hidden ? 'block' : 'none';
  if (btn) btn.textContent = hidden ? '\u25bc Hide Technical Details' : '\u25b6 Show Technical Details';
}

// ── CSP-Compliant Event Delegation ──────────────────────────────────────────
// Replaces all inline onclick/onchange/oninput/onkeydown/onsubmit attributes.
(function initDelegation() {
  // These actions receive the native event as an extra argument
  var EVENT_AS_ARG = new Set(['startCheckout']);

  function dispatch(el, event) {
    var action = el.dataset.action;
    var fn = window[action];
    if (typeof fn !== 'function') {
      window.DEBUG && console.warn('[Dispatch] Unknown action:', action);
      return;
    }
    var args = [];
    if (el.dataset.arg0 !== undefined && el.dataset.arg0 !== '') args.push(el.dataset.arg0);
    if (el.dataset.arg1 !== undefined && el.dataset.arg1 !== '') args.push(el.dataset.arg1);
    if (EVENT_AS_ARG.has(action)) args.push(event);
    if (action === 'toggleDetails') args.push(el); // btn reference
    var BTN_ARG_ACTIONS = new Set(['confirm2FASetup', 'disable2FA']);
    if (BTN_ARG_ACTIONS.has(action)) args.push(el); // btn reference for disabling
    fn.apply(null, args);
  }

  // Click delegation
  document.addEventListener('click', function(e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    // Prevent default for <a> tags and elements that opt-in via data-prevent
    if (el.tagName === 'A' || el.hasAttribute('data-prevent')) e.preventDefault();
    dispatch(el, e);
  });

  // Form submit delegation
  document.addEventListener('submit', function(e) {
    if (!e.target.dataset.action) return;
    e.preventDefault();
    dispatch(e.target, e);
  });

  // Input delegation — uppercase fields
  document.addEventListener('input', function(e) {
    if (e.target.classList.contains('js-uppercase')) {
      e.target.value = e.target.value.toUpperCase();
    }
  });

  // Keydown delegation — Enter triggers geocode
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    var target = e.target.dataset.geocodeTarget;
    if (target) { e.preventDefault(); geocodeLocation(target); }
  });
})();

// ── Practitioner Onboarding Modal (Phase 6) ──────────────────────────────────
let _practOnbStep = 1;
const PRACT_ONB_TOTAL = 4;

async function showPractitionerOnboarding() {
  // ACC-P2-8: Store trigger element for focus restoration on close
  storeModalTrigger('practitionerOnboardingOverlay');

  _practOnbStep = 1;
  _practOnbRender();
  document.getElementById('practitionerOnboardingOverlay')?.classList.remove('hidden');

  // Load referral link
  try {
    const data = await apiFetch('/api/practitioner/referral-link');
    if (data?.referralUrl) {
      const input = document.getElementById('pract-onb-reflink');
      if (input) input.value = data.referralUrl;
    }
  } catch { /* silent */ }
}

function _practOnbRender() {
  for (let i = 1; i <= PRACT_ONB_TOTAL; i++) {
    const step = document.getElementById(`pract-onb-step-${i}`);
    const dot = document.getElementById(`pract-onb-dot-${i}`);
    if (step) step.style.display = i === _practOnbStep ? '' : 'none';
    if (dot) {
      dot.style.background = i === _practOnbStep ? 'var(--gold)' : 'var(--border)';
    }
  }
}

function practOnbNext() {
  if (_practOnbStep < PRACT_ONB_TOTAL) {
    _practOnbStep++;
    _practOnbRender();
  }
}

function practOnbSkip() {
  practOnbFinish();
}

function practOnbFinish() {
  document.getElementById('practitionerOnboardingOverlay')?.classList.add('hidden');
  localStorage.setItem('pract_onb_seen', '1');
  switchTab('practitioner');
  // ACC-P2-8: Restore focus to trigger element
  restoreModalFocus('practitionerOnboardingOverlay');
}

function practOnbCopyLink() {
  const val = document.getElementById('pract-onb-reflink')?.value;
  if (val && navigator.clipboard) {
    navigator.clipboard.writeText(val).then(() => showNotification('Referral link copied!', 'success'));
  }
}

async function practOnbSaveProfile() {
  const name = document.getElementById('pract-onb-name')?.value?.trim();
  const specialty = document.getElementById('pract-onb-specialty')?.value?.trim();
  const bio = document.getElementById('pract-onb-bio')?.value?.trim();
  const statusEl = document.getElementById('pract-onb-dir-status');
  if (!name && !specialty) {
    practOnbNext(); // allow skipping if blank
    return;
  }
  if (statusEl) statusEl.textContent = 'Saving…';
  try {
    await apiFetch('/api/practitioner/directory-profile', {
      method: 'POST',
      body: JSON.stringify({ displayName: name, specialty, bio, visible: true })
    });
    if (statusEl) statusEl.textContent = '✓ Profile saved';
    // reflect in step 4 stat
    const stat = document.getElementById('pract-onb-stat-profile');
    if (stat) { stat.textContent = 'Done'; stat.style.color = 'var(--accent2)'; }
    setTimeout(() => practOnbNext(), 600);
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Could not save — try again in your Practitioner workspace.';
    setTimeout(() => practOnbNext(), 1500);
  }
}

async function practOnbSendInvite() {
  const email = document.getElementById('pract-onb-client-email')?.value?.trim();
  const name = document.getElementById('pract-onb-client-name')?.value?.trim();
  const statusEl = document.getElementById('pract-onb-invite-status');
  if (!email) {
    practOnbNext(); // blank → skip
    return;
  }
  if (statusEl) statusEl.textContent = 'Sending…';
  try {
    await apiFetch('/api/practitioner/clients', {
      method: 'POST',
      body: JSON.stringify({ email, name: name || undefined })
    });
    if (statusEl) statusEl.textContent = '✓ Invite sent';
    const stat = document.getElementById('pract-onb-stat-clients');
    if (stat) stat.textContent = '1';
    setTimeout(() => practOnbNext(), 600);
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Could not send — you can invite clients from your workspace.';
    setTimeout(() => practOnbNext(), 1500);
  }
}

// Ensure delegated actions are always discoverable on global scope.
// (top-level function declarations in non-module scripts are already on window,
//  but explicit assignment makes the intent clear and safe for any tooling.)
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.openAuthOverlay = openAuthOverlay;
window.closeAuthOverlay = closeAuthOverlay;
window.submitAuth = submitAuth;
window.toggleAuthMode = toggleAuthMode;
window.showForgotPassword = showForgotPassword;
window.openPricingModal = openPricingModal;
window.openBillingPortal = openBillingPortal;
window.setBillingPeriod = setBillingPeriod;
window.exportMyData = exportMyData;
window.deleteAccount = deleteAccount;
window.switchTab = switchTab;
window.geocodeLocation = geocodeLocation;
window.calculateChart = calculateChart;
window.generateProfile = generateProfile;
window.submitTOTP = submitTOTP;
window.cancel2FA = cancel2FA;
window.openSecuritySettings = openSecuritySettings;
window.closeSecurityModal = closeSecurityModal;
window.begin2FASetup = begin2FASetup;
window.confirm2FASetup = confirm2FASetup;
window.disable2FA = disable2FA;
window.saveAIContext = saveAIContext;
window.scrollToProfile = scrollToProfile;
window.showPractitionerOnboarding = showPractitionerOnboarding;
window.practOnbNext = practOnbNext;
window.practOnbSkip = practOnbSkip;
window.practOnbFinish = practOnbFinish;
window.practOnbCopyLink = practOnbCopyLink;
window.practOnbSaveProfile = practOnbSaveProfile;
window.practOnbSendInvite = practOnbSendInvite;
window.checkAndShowReferralPrompt = checkAndShowReferralPrompt;
window.closeReferralModal = closeReferralModal;

// ── UX-QUICKPICK: Evaluation type + preset question buttons ──────────────────
const EVAL_QUICKPICKS = {
  'full-blueprint': [
    'What is my core decision strategy?',
    "What's my life purpose pattern?",
  ],
  'daily-focus': [
    'Where should I focus my energy today?',
    'What should I be aware of energetically?',
  ],
  'relationships': [
    'How do I best connect with others?',
    'What conditioning do I receive from others?',
  ],
  'career': [
    'What work aligns with my design?',
    'How do I find purpose in my career?',
  ],
};

function isProfilePowerUser() {
  const tier = currentUser?.tier || 'free';
  return tier === 'practitioner' || tier === 'guide' || tier === 'agency' || tier === 'white_label';
}

function updateProfileAdvancedUI() {
  const panel = document.getElementById('profileAdvancedPanel');
  const toggle = document.getElementById('profileAdvancedToggle');
  const summary = document.getElementById('profileDefaultSummary');
  if (!panel || !toggle || !summary) return;

  const expanded = _profileAdvancedPreference !== null ? _profileAdvancedPreference : isProfilePowerUser();
  panel.style.display = expanded ? '' : 'none';
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.textContent = expanded ? 'Hide advanced options' : 'Customize this reading';
  summary.textContent = expanded
    ? 'Advanced controls are open. Keep the default Full Blueprint path, or tailor the reading by theme, question, and optional systems.'
    : 'Default: Full Blueprint with your core systems. Open advanced options only if you want to target a theme, ask a specific question, or add more depth systems.';
}

function toggleProfileAdvanced() {
  const panel = document.getElementById('profileAdvancedPanel');
  if (!panel) return;
  _profileAdvancedPreference = panel.style.display === 'none';
  updateProfileAdvancedUI();
}

function initializeProfileComposerUI() {
  const hasActiveEval = !!document.querySelector('.eval-type-btn.active');
  if (!hasActiveEval) setEvalType('full-blueprint');
  _updateSysSummary();
  updateProfileAdvancedUI();
}

function setEvalType(type) {
  document.querySelectorAll('.eval-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.arg0 === type);
  });
  const picks = EVAL_QUICKPICKS[type];
  const row = document.getElementById('quickpickRow');
  if (picks && row) {
    const btn1 = document.getElementById('quickpick1');
    const btn2 = document.getElementById('quickpick2');
    btn1.textContent = picks[0];
    btn1.dataset.arg0 = picks[0];
    btn2.textContent = picks[1];
    btn2.dataset.arg0 = picks[1];
    row.style.display = '';
  }
}

function setQuickPick(question) {
  const input = document.getElementById('p-question');
  if (input) input.value = question;
}

// ── Blueprint Composition Wheel ────────────────────────────────
function renderSystemsWheel(payload, sysPref) {
  const ti = (payload && payload.technicalInsights) || {};
  const prefs = sysPref || {};

  const SYSTEMS = [
    { key: 'energyBlueprint', label: 'Energy\nBlueprint',   icon: '⬡', color: '#F5C842', core: true,  hasData: true },
    { key: 'forge',           label: 'Forge\nArchetype',    icon: '✦', color: '#F5C842', core: true,  hasData: !!(ti.forgeIdentification) },
    { key: 'astrology',       label: 'Natal\nAstrology',    icon: '☉', color: '#38BDF8', core: false, hasData: !!(ti.astrologicalSignatures && ti.astrologicalSignatures.length) },
    { key: 'geneKeys',        label: 'Gene\nKeys',          icon: '⟡', color: '#A78BFA', core: false, hasData: !!(ti.geneKeysProfile) },
    { key: 'numerology',      label: 'Numerology',          icon: '∞', color: '#60A5FA', core: false, hasData: !!(ti.numerologyInsights) },
    { key: 'vedic',           label: 'Vedic /\nJyotish',    icon: '☽', color: '#818CF8', core: false, hasData: !!(payload.vedic && !payload.vedic.error) },
    { key: 'ogham',           label: 'Celtic\nOgham',       icon: '᚛', color: '#34D399', core: false, hasData: !!(payload.ogham && !payload.ogham.error) },
    { key: 'transits',        label: 'Transits',             icon: '↻', color: '#22D3EE', core: false, hasData: !!(payload.transits) },
    { key: 'psychometrics',   label: 'Psychology\nProfile', icon: '◈', color: '#F472B6', core: false, hasData: !!(payload.psychometricData || payload.psychometrics) },
    { key: 'behavioral',      label: 'Behavioral\nPattern', icon: '★', color: '#FB923C', core: false, hasData: !!(payload.validationData || payload.behavioral) },
    { key: 'diary',           label: 'Life\nEvents',        icon: '◉', color: '#F87171', core: false, hasData: !!(Array.isArray(payload.diaryEntries) && payload.diaryEntries.length) },
  ];

  const N = SYSTEMS.length;
  const cx = 200, cy = 200, outerR = 148, nodeR = 20;

  SYSTEMS.forEach((s, i) => {
    const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
    s.angle = angle;
    s.x = cx + outerR * Math.cos(angle);
    s.y = cy + outerR * Math.sin(angle);
    if (s.core) s.state = 'core';
    else if (prefs[s.key] === false) s.state = 'off';
    else if (s.hasData) s.state = 'active';
    else s.state = 'nodata';
  });

  const stateProps = {
    core:   { op: 1,    sw: 2.5, getFill: ()  => 'rgba(245,200,66,0.18)',   nc: '#F5C842', dash: '' },
    active: { op: 1,    sw: 2,   getFill: (c) => `rgba(${_hexRgb(c)},0.12)`, nc: null,      dash: '' },
    nodata: { op: 0.35, sw: 1,   getFill: ()  => 'rgba(100,116,139,0.08)', nc: '#64748B', dash: '4 3' },
    off:    { op: 0.18, sw: 0.8, getFill: ()  => 'rgba(100,116,139,0.05)', nc: '#475569', dash: '3 4' },
  };

  let svg = `<svg viewBox="0 0 400 400" style="width:100%;max-width:420px;height:auto;display:block;margin:0 auto" `
    + `role="img" aria-label="Blueprint composition diagram showing active synthesis systems">
    <defs>
      <radialGradient id="swBg${Date.now()}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="var(--bg2)"/>
        <stop offset="100%" stop-color="var(--bg1)"/>
      </radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="198" fill="var(--bg2)" opacity="0.95"/>
    <circle cx="${cx}" cy="${cy}" r="${outerR + nodeR + 30}" fill="none" stroke="var(--bg3)" stroke-width="1" opacity="0.2" stroke-dasharray="2 5"/>
    <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="var(--bg3)" stroke-width="0.8" opacity="0.15" stroke-dasharray="3 6"/>
    <circle cx="${cx}" cy="${cy}" r="${(outerR * 0.6).toFixed(0)}" fill="none" stroke="var(--bg3)" stroke-width="0.8" opacity="0.1" stroke-dasharray="2 6"/>`;

  // Polygon connecting active + core systems
  const activeGroup = SYSTEMS.filter(s => s.state === 'core' || s.state === 'active');
  if (activeGroup.length >= 3) {
    const pts = activeGroup.map(s => `${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(' ');
    svg += `<polygon points="${pts}" fill="rgba(56,189,248,0.05)" stroke="rgba(56,189,248,0.22)" stroke-width="1.5" stroke-linejoin="round"/>`;
  }

  // Spokes, glows, nodes, labels
  SYSTEMS.forEach(s => {
    const sp = stateProps[s.state];
    const nc = sp.nc || s.color;
    const fill = sp.getFill(s.color);
    const dashAttr = sp.dash ? ` stroke-dasharray="${sp.dash}"` : '';
    const sx = s.x.toFixed(1), sy = s.y.toFixed(1);

    svg += `<line x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}" stroke="${nc}" stroke-width="${sp.sw}" opacity="${sp.op}"${dashAttr}/>`;

    if (s.state === 'core' || s.state === 'active') {
      svg += `<circle cx="${sx}" cy="${sy}" r="${nodeR + 8}" fill="${nc}" opacity="0.07"/>`;
    }

    const descSuffix = s.state === 'off' ? ' — excluded from synthesis'
      : s.state === 'nodata' ? ' — awaiting data input' : '';
    svg += `<circle cx="${sx}" cy="${sy}" r="${nodeR}" fill="${fill}" stroke="${nc}" stroke-width="${sp.sw}" opacity="${sp.op}"><title>${escapeHtml(s.label.replace(/\n/g, ' ') + descSuffix)}</title></circle>`;

    svg += `<text x="${sx}" y="${sy}" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="${nc}" opacity="${sp.op}" style="pointer-events:none">${s.icon}</text>`;

    // Label outside node
    const labelR = outerR + nodeR + 14;
    const lx = (cx + labelR * Math.cos(s.angle)).toFixed(1);
    const ly = (cy + labelR * Math.sin(s.angle));
    const lines = s.label.split('\n');
    const lineH = 9;
    const startY = lines.length === 1 ? ly : ly - (lineH * (lines.length - 1)) / 2;
    lines.forEach((line, li) => {
      svg += `<text x="${lx}" y="${(startY + li * lineH).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="8.5" fill="var(--text-dim)" opacity="${sp.op}" style="pointer-events:none">${escapeHtml(line)}</text>`;
    });
  });

  // Core circle
  svg += `<circle cx="${cx}" cy="${cy}" r="62" fill="#F5C842" opacity="0.05"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="48" fill="rgba(245,200,66,0.1)" stroke="#F5C842" stroke-width="2"/>`;
  svg += `<text x="${cx}" y="${cy - 9}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="bold" fill="#F5C842">Prime</text>`;
  svg += `<text x="${cx}" y="${cy + 9}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="bold" fill="#F5C842">Self</text>`;
  svg += `</svg>`;

  // Legend
  const counts = { active: 0, nodata: 0, off: 0 };
  SYSTEMS.forEach(s => { if (!s.core && counts[s.state] !== undefined) counts[s.state]++; });
  const legendParts = [`<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.8rem;font-weight:500;color:var(--text)"><span style="width:9px;height:9px;border-radius:50%;background:#F5C842;display:inline-block;flex-shrink:0"></span> Core (always on)</span>`];
  if (counts.active  > 0) legendParts.push(`<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.8rem;font-weight:500;color:var(--text)"><span style="width:9px;height:9px;border-radius:50%;background:#38BDF8;display:inline-block;flex-shrink:0"></span> ${counts.active} system${counts.active > 1 ? 's' : ''} active</span>`);
  if (counts.nodata  > 0) legendParts.push(`<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.8rem;font-weight:500;color:var(--text)"><span style="width:9px;height:9px;border-radius:50%;background:#64748B;display:inline-block;flex-shrink:0;opacity:0.45"></span> ${counts.nodata} awaiting data</span>`);
  if (counts.off     > 0) legendParts.push(`<span style="display:inline-flex;align-items:center;gap:5px;font-size:0.8rem;font-weight:500;color:var(--text)"><span style="width:9px;height:9px;border-radius:50%;background:#475569;display:inline-block;flex-shrink:0;opacity:0.25"></span> ${counts.off} excluded</span>`);

  return `<div class="card" style="background:radial-gradient(circle at center, var(--bg2) 0%, var(--bg1) 100%)">
    <div class="card-title">⬡ Blueprint Composition</div>
    <p style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-4)">Systems woven into this synthesis — hover each node for details.</p>
    ${svg}
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-3);justify-content:center;margin-top:var(--space-4)">${legendParts.join('')}</div>
  </div>`;
}

// Helper: hex color "#RRGGBB" → "r,g,b" for rgba()
function _hexRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)].join(',');
}

// ── Systems-to-Synthesize toggle ────────────────────────────────
const _OPTIONAL_SYSTEMS = ['astrology','geneKeys','numerology','vedic','ogham','mayan','bazi','sabian','chiron','lilith','transits','psychometrics','behavioral','diary'];

function toggleSystem(btn) {
  if (btn.classList.contains('sys-toggle-core')) return; // always-on
  const isOn = btn.classList.contains('sys-toggle-on');
  btn.classList.toggle('sys-toggle-on', !isOn);
  btn.classList.toggle('sys-toggle-off', isOn);
  btn.setAttribute('aria-pressed', String(!isOn));
  _updateSysSummary();
}

function _updateSysSummary() {
  const hint = document.getElementById('sysSummaryHint');
  if (!hint) return;
  const onCount = _OPTIONAL_SYSTEMS.filter(s => {
    const btn = document.querySelector(`.sys-toggle-btn[data-system="${s}"]`);
    return btn && btn.classList.contains('sys-toggle-on');
  }).length;
  const total = _OPTIONAL_SYSTEMS.length;
  if (onCount === total) hint.textContent = `All ${total} optional systems active — deepest synthesis.`;
  else if (onCount === 0) hint.textContent = 'Energy Blueprint + Forge only — fastest, most focused synthesis.';
  else hint.textContent = `${onCount} of ${total} optional systems active.`;
}


function getSystemPreferences() {
  const prefs = { energyBlueprint: true, forge: true }; // always on
  _OPTIONAL_SYSTEMS.forEach(s => {
    const btn = document.querySelector(`.sys-toggle-btn[data-system="${s}"]`);
    prefs[s] = !btn || btn.classList.contains('sys-toggle-on'); // default on if missing
  });
  return prefs;
}

window.setEvalType = setEvalType;
window.setQuickPick = setQuickPick;
window.toggleProfileAdvanced = toggleProfileAdvanced;
window.toggleSystem = toggleSystem;
window.prefillExample = prefillExample;
window.expandChartForm = expandChartForm;
window.openLastShareCard = openLastShareCard;
window.openBlueprintCard = openBlueprintCard;
window.loadChartHistory = loadChartHistory;
window.loadChartById = loadChartById;
window.toggleNotifDrawer = toggleNotifDrawer;
window.searchProfiles = searchProfiles;
window.toggleRaw = toggleRaw;
window.toggleDetails = toggleDetails;
window.hideMemberForm = hideMemberForm;
window.hidePracDetail = hidePracDetail;
window.loadPractitionerMessages = loadPractitionerMessages;
window.sendPractitionerMessage = sendPractitionerMessage;
window.loadClientMessages = loadClientMessages;
window.sendClientMessage = sendClientMessage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeProfileComposerUI, { once: true });
} else {
  initializeProfileComposerUI();
}
window.openCompatibilityWithClient = openCompatibilityWithClient;
window.loadPractitionerInvitations = loadPractitionerInvitations;
window.revokePractitionerInvitation = revokePractitionerInvitation;
window.showNewNoteForm = showNewNoteForm;
window.hideNewNoteForm = hideNewNoteForm;
window.saveSessionNote = saveSessionNote;
window.editSessionNote = editSessionNote;
window.cancelEditNote = cancelEditNote;
window.updateSessionNote = updateSessionNote;
window.deleteSessionNote = deleteSessionNote;
window.loadMoreNotes = loadMoreNotes;
window.toggleDirectoryForm = toggleDirectoryForm;
window.saveDirectoryProfile = saveDirectoryProfile;
window.checkNotionStatus = checkNotionStatus;
window.connectNotion = connectNotion;
window.syncNotionClients = syncNotionClients;
window.disconnectNotion = disconnectNotion;
window.switchToPricingModal = switchToPricingModal;
window.switchToPracPricingModal = switchToPracPricingModal;
window.logout = logout;
window.saveDiaryEntry = saveDiaryEntry;
window.loadDiaryEntries = loadDiaryEntries;
window.exportDiary = exportDiary;
window.editDiaryEntry = editDiaryEntry;
window.cancelDiaryEdit = cancelDiaryEdit;
window.deleteDiaryEntry = deleteDiaryEntry;
window.selectAlignment = selectAlignment;
window.saveCheckin = saveCheckin;
window.loadCheckinStats = loadCheckinStats;
window.frmShow = frmShow;
window.frmClose = frmClose;
window.frmNext = frmNext;
window.frmBack = frmBack;
window.frmCloseChart = frmCloseChart;
// frmComplete, frmSetEvalType, frmSelectQuickpick are declared in first-run.js (loads after)
// They are plain global functions so window[action] delegation reaches them automatically.
window.loadCelebrityMatches = loadCelebrityMatches;
window.filterCelebrities = filterCelebrities;
window.loadAchievements = loadAchievements;
window.loadLeaderboard = loadLeaderboard;
window.findBestDates = findBestDates;
window.searchDirectory = searchDirectory;
window.loadDirectoryPage = loadDirectoryPage;
window.startOneTimePurchase = startOneTimePurchase;
window.loadCalendar = loadCalendar;
window.calendarPrev = calendarPrev;
window.calendarNext = calendarNext;
window.calendarSetView = calendarSetView;
window.calendarAddEvent = calendarAddEvent;
window.calendarDeleteEvent = calendarDeleteEvent;
window.calendarTogglePractitioner = calendarTogglePractitioner;

// ─── Calendar (3.3 + 3.4 Tier Gating) ───────────────────────

let _calView = 'month';
let _calDate = new Date();
let _calEvents = [];
let _calAllowedTypes = ['personal', 'moon', 'reminder', 'diary'];
let _calPractitionerMode = false;
let _calClientColors = {};

const EVENT_TYPE_COLORS = {
  personal: '#6C63FF', transit: '#FFD93D', moon: '#C0C0C0',
  retrograde: '#FF4D4D', session: '#2ECC71', reminder: '#F39C12', diary: '#E056A0'
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

async function loadCalendar() {
  const first = new Date(_calDate.getFullYear(), _calDate.getMonth(), 1);
  const last = new Date(_calDate.getFullYear(), _calDate.getMonth() + 1, 0);
  const from = new Date(first); from.setDate(from.getDate() - 7);
  const to = new Date(last); to.setDate(to.getDate() + 7);

  try {
    const endpoint = _calPractitionerMode
      ? `/api/calendar/practitioner/events?from=${from.toISOString()}&to=${to.toISOString()}`
      : `/api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`;
    const data = await apiFetch(endpoint);

    if (data?.upgrade_required) {
      // 403 returned — handled by apiFetch showUpgradePrompt${_calPractitionerMode ? ' (All Clients)' : ''}`;

  // Show/hide practitioner toggle
  const practToggle = document.getElementById('calPractitionerToggle');
  const tier = currentUser?.tier || 'free';
  const isPract = ['practitioner', 'guide', 'agency', 'white_label'].includes(tier);
  if (practToggle) {
    practToggle.style.display = isPract ? '' : 'none';
    practToggle.classList.toggle('active', _calPractitionerMode);
  }

  // Gate event type selector options
  const typeSelect = document.getElementById('calEventType');
  if (typeSelect) {
    Array.from(typeSelect.options).forEach(opt => {
      const locked = !_calAllowedTypes.includes(opt.value);
      opt.disabled = locked;
      opt.textContent = opt.getAttribute('data-label') || opt.textContent.replace(/ 🔒$/, '');
      if (!opt.getAttribute('data-label')) opt.setAttribute('data-label', opt.textContent);
      if (locked) opt.textContent += ' 🔒';
    });
  }
      _calPractitionerMode = false;
      return;
    }

    _calEvents = data?.data || [];
    if (data?.allowed_types) _calAllowedTypes = data.allowed_types;
    if (data?.client_colors) _calClientColors = data.client_colors;
  } catch { _calEvents = []; }

  renderCalendar();
  trackEvent?.('calendar', 'calendar_view_changed', _calView);
}

function renderCalendar() {
  const title = document.getElementById('calendarTitle');
  if (title) title.textContent = `${MONTH_NAMES[_calDate.getMonth()]} ${_calDate.getFullYear()}`;

  // Update view toggle active state
  ['Month','Week','Day'].forEach(v => {
    const btn = document.getElementById('calView' + v);
    if (btn) btn.classList.toggle('active', _calView === v.toLowerCase());
  });

  // Show/hide views
  const views = { month: 'calendarMonthView', week: 'calendarWeekView', day: 'calendarDayView' };
  Object.entries(views).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = key === _calView ? '' : 'none';
  });

  if (_calView === 'month') renderMonthView();
  else if (_calView === 'week') renderWeekView();
  else renderDayView();
}

function renderMonthView() {
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  const year = _calDate.getFullYear();
  const month = _calDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0,0,0,0);

  // Monday-start: getDay() Sun=0 → offset 6, Mon=1 → offset 0
  let startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startOffset);

  let html = '';
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const isOther = d.getMonth() !== month;
    const isToday = d.getTime() === today.getTime();
    const dateStr = d.toISOString().slice(0, 10);

    const dayEvents = _calEvents.filter(e => (e.start_date || '').slice(0, 10) === dateStr);
    const dots = dayEvents.slice(0, 5).map(e =>
      `<span class="event-dot ${e.event_type || 'personal'}" title="${(e.title || '').replace(/"/g, '&quot;')}" style="${e.color ? 'background:' + e.color : ''}"></span>`
    ).join('');

    html += `<div class="calendar-cell${isOther ? ' other-month' : ''}${isToday ? ' today' : ''}" data-date="${dateStr}" onclick="calendarSetView('day','${dateStr}')">
      <span class="day-num">${d.getDate()}</span>
      <div class="event-dots">${dots}</div>
    </div>`;
  }
  grid.innerHTML = html;
}

function renderWeekView() {
  const container = document.getElementById('calendarWeekContent');
  if (!container) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(_calDate);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday start

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const isToday = d.getTime() === today.getTime();
    const dayEvents = _calEvents.filter(e => (e.start_date || '').slice(0, 10) === dateStr);

    html += `<div class="week-day-row">
      <div class="week-day-label${isToday ? ' today' : ''}">${DAY_NAMES[i]}<br>${d.getDate()}</div>
      <div class="week-events">`;

    if (dayEvents.length === 0) {
      html += '<div style="color:var(--text-muted);font-size:0.8rem;padding:4px">No events</div>';
    } else {
      dayEvents.forEach(e => {
        const color = _calPractitionerMode && e.client_color
          ? e.client_color
          : (e.color || EVENT_TYPE_COLORS[e.event_type] || '#6C63FF');
        const time = e.all_day
          ? 'All day'
          : new Date(e.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const clientTag = _calPractitionerMode && e.client_email && !e.is_own
          ? `<span class="cal-client-tag" style="background:${e.client_color || '#666'}">${e.client_email.split('@')[0]}</span>`
          : '';
        html += `<div class="day-event-card">
          <div class="day-event-color" style="background:${color}"></div>
          <div class="day-event-info">
            <div class="day-event-title">${e.title || 'Untitled'}${clientTag}</div>
            <div class="day-event-time">${time} · ${e.event_type || 'personal'}</div>
            ${e.description ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">${e.description}</div>` : ''}
          </div>
          <div class="day-event-actions">${e.is_own !== false ? `<button class="btn-icon" onclick="calendarDeleteEvent('${e.id}')" title="Delete">🗑</button>` : ''}</div>
        </div>`;
      });
    }

    html += '</div></div>';
  }

  container.innerHTML = html;
}

function renderDayView() {
  const container = document.getElementById('calendarDayContent');
  if (!container) return;

  const dateStr = _calDate.toISOString().slice(0, 10);
  const dayEvents = _calEvents.filter(e => (e.start_date || '').slice(0, 10) === dateStr);

  let html = `<h3 style="margin-bottom:var(--space-sm)">${_calDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>`;

  if (dayEvents.length === 0) {
    html += '<p style="color:var(--text-muted)">No events for this day.</p>';
  } else {
    dayEvents.forEach(e => {
      const color = e.color || EVENT_TYPE_COLORS[e.event_type] || '#6C63FF';
      const time = e.all_day ? 'All day' : new Date(e.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      html += `<div class="day-event-card">
        <div class="day-event-color" style="background:${color}"></div>
        <div class="day-event-info">
          <div class="day-event-title">${e.title || 'Untitled'}</div>
          <div class="day-event-time">${time} · ${e.event_type || 'personal'}</div>
          ${e.description ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">${e.description}</div>` : ''}
        </div>
        <div class="day-event-actions"><button class="btn-icon" onclick="calendarDeleteEvent('${e.id}')" title="Delete">🗑</button></div>
      </div>`;
    });
  }
  container.innerHTML = html;
}

function calendarPrev() {
  if (_calView === 'month') _calDate.setMonth(_calDate.getMonth() - 1);
  else if (_calView === 'week') _calDate.setDate(_calDate.getDate() - 7);
  else _calDate.setDate(_calDate.getDate() - 1);
  loadCalendar();
}

function calendarNext() {
  if (_calView === 'month') _calDate.setMonth(_calDate.getMonth() + 1);
  else if (_calView === 'week') _calDate.setDate(_calDate.getDate() + 7);
  else _calDate.setDate(_calDate.getDate() + 1);
  loadCalendar();
}

function calendarSetView(view, dateStr) {
  _calView = view;
  if (dateStr) _calDate = new Date(dateStr + 'T00:00:00');
  renderCalendar();
  trackEvent?.('calendar', 'calendar_view_changed', view);
}

async function calendarAddEvent() {
  const title = document.getElementById('calEventTitle')?.value?.trim();
  const date = document.getElementById('calEventDate')?.value;
  const eventType = document.getElementById('calEventType')?.value || 'personal';
  const color = document.getElementById('calEventColor')?.value;

  if (!title || !date) {
    showToast?.('Please enter a title and date', 'error');
function calendarTogglePractitioner() {
  _calPractitionerMode = !_calPractitionerMode;
  loadCalendar();
  trackEvent?.('calendar', 'calendar_practitioner_toggle', _calPractitionerMode ? 'on' : 'off');
}

    return;
  }

  try {
    await apiFetch('/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ title, start_date: new Date(date).toISOString(), event_type: eventType, color })
    });
    document.getElementById('calEventTitle').value = '';
    showToast?.('Event added', 'success');
    loadCalendar();
  } catch (err) {
    showToast?.('Failed to add event', 'error');
  }
}

async function calendarDeleteEvent(eventId) {
  if (!eventId) return;
  try {
    await apiFetch(`/api/calendar/events/${eventId}`, { method: 'DELETE' });
    showToast?.('Event deleted', 'success');
    loadCalendar();
    trackEvent?.('calendar', 'calendar_event_deleted', eventId);
  } catch {
    showToast?.('Failed to delete event', 'error');
  }
}

// ─── One-Time Purchases ──────────────────────────────────────

async function startOneTimePurchase(product) {
  if (!token) {
    closePricingModal();
    openAuthOverlay();
    return;
  }

  try {
    const result = await apiFetch('/api/billing/checkout-one-time', {
      method: 'POST',
      body: JSON.stringify({ product })
    });

    if (result.error) {
      showNotification('Checkout failed: ' + safeErrorMsg(result.error, 'Unable to start checkout'), 'error');
      return;
    }

    if (result.url) {
      try {
        const redirectUrl = new URL(result.url);
        if (redirectUrl.hostname.endsWith('.stripe.com')) {
          window.location.href = result.url;
        } else {
          showNotification('Invalid checkout redirect. Please try again.', 'error');
        }
      } catch {
        showNotification('Invalid checkout URL received.', 'error');
      }
    }
  } catch (e) {
    showNotification('Failed to start checkout. Please try again.', 'error');
  }
}

// ─── Practitioner Directory Browsing ─────────────────────────

let _directoryOffset = 0;
const _directoryLimit = 20;

async function searchDirectory() {
  _directoryOffset = 0;
  await loadDirectoryPage();
}

async function loadDirectoryPage(offset) {
  if (offset !== undefined) _directoryOffset = offset;

  const resultsEl = document.getElementById('directoryResults');
  const paginationEl = document.getElementById('directoryPagination');
  if (!resultsEl) return;

  resultsEl.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>Searching practitioners…</div></div>';
  if (paginationEl) paginationEl.innerHTML = '';

  const specialty = document.getElementById('dirFilterSpecialty')?.value || '';
  const certification = document.getElementById('dirFilterCert')?.value || '';
  const format = document.getElementById('dirFilterFormat')?.value || '';

  let qs = `?limit=${_directoryLimit}&offset=${_directoryOffset}`;
  if (specialty) qs += `&specialty=${encodeURIComponent(specialty)}`;
  if (certification) qs += `&certification=${encodeURIComponent(certification)}`;
  if (format) qs += `&format=${encodeURIComponent(format)}`;

  try {
    const data = await apiFetch('/api/directory' + qs);
    const practitioners = data.practitioners || [];

    if (practitioners.length === 0) {
      resultsEl.innerHTML = `<div style="color:var(--text-dim);font-size:var(--font-size-sm);padding:var(--space-4) 0;text-align:center">
        No practitioners found matching your filters. Try broadening your search.
      </div>`;
      return;
    }

    resultsEl.innerHTML = practitioners.map(renderDirectoryCard).join('');

    // Pagination
    if (paginationEl) {
      let pagHtml = '';
      if (_directoryOffset > 0) {
        pagHtml += `<button class="btn-secondary btn-sm" data-action="loadDirectoryPage" data-arg0="${_directoryOffset - _directoryLimit}">← Previous</button>`;
      }
      if (practitioners.length === _directoryLimit) {
        pagHtml += `<button class="btn-secondary btn-sm" data-action="loadDirectoryPage" data-arg0="${_directoryOffset + _directoryLimit}">Next →</button>`;
      }
      paginationEl.innerHTML = pagHtml;
    }
  } catch (e) {
    resultsEl.innerHTML = `<div class="alert alert-error">Error loading directory: ${escapeHtml(e.message)}</div>`;
  }
}

function renderDirectoryCard(p) {
  const name = escapeHtml(p.display_name || 'Practitioner');
  const bio = escapeHtml(p.bio || '');
  const cert = escapeHtml(p.certification || '');
  const format = escapeHtml(p.session_format || '');
  const slug = typeof p.slug === 'string' && /^[a-z0-9-]+$/.test(p.slug) ? p.slug : '';
  const profileUrl = slug ? `/practitioners/${encodeURIComponent(slug)}` : '';
  const clients = parseInt(p.client_count || '0', 10);
  const specs = Array.isArray(p.specializations) ? p.specializations.map(escapeHtml) : [];
  const languages = Array.isArray(p.languages) ? p.languages.map(escapeHtml) : [];
  const sessionInfo = escapeHtml(p.session_info || '');

  let html = `
  <div style="background:var(--bg3);border-radius:var(--space-2);padding:var(--space-4);margin-bottom:var(--space-3)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-2)">
      <div>
        <div style="font-weight:600;font-size:var(--font-size-md);color:var(--text)">${name}</div>
        ${cert ? `<div style="font-size:var(--font-size-sm);color:var(--gold)">${cert}</div>` : ''}
      </div>
      <div style="font-size:var(--font-size-sm);color:var(--text-dim)">${clients} client${clients !== 1 ? 's' : ''}</div>
    </div>`;

  if (bio) {
    html += `<p style="font-size:var(--font-size-base);color:var(--text);line-height:1.5;margin:0 0 var(--space-2)">${bio}</p>`;
  }

  if (specs.length > 0) {
    html += `<div style="display:flex;flex-wrap:wrap;gap:var(--space-1);margin-bottom:var(--space-2)">
      ${specs.map(s => `<span style="background:var(--bg2);color:var(--gold);padding:2px 8px;border-radius:var(--space-2);font-size:var(--font-size-sm)">${s}</span>`).join('')}
    </div>`;
  }

  const details = [];
  if (format) details.push(format);
  if (languages.length > 0) details.push(languages.join(', '));
  if (sessionInfo) details.push(sessionInfo);
  if (details.length > 0) {
    html += `<div style="font-size:var(--font-size-sm);color:var(--text-dim)">${details.map(escapeHtml).join(' · ')}</div>`;
  }

  // P2-SEC-015: Block javascript: protocol in booking URLs
  const safeBookingUrl = /^https?:\/\//i.test(p.booking_url || '') ? escapeAttr(p.booking_url) : '';
  const ctas = [];
  if (profileUrl) {
    ctas.push(`<a href="${profileUrl}" class="btn-secondary btn-sm" style="display:inline-block;text-decoration:none">View Profile</a>`);
  }
  if (safeBookingUrl) {
    ctas.push(`<a href="${safeBookingUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary btn-sm" style="display:inline-block;text-decoration:none">Book a Session</a>`);
  }
  if (ctas.length > 0) {
    html += `<div style="margin-top:var(--space-3);display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:center">
      ${ctas.join('')}
    </div>`;
  }
  if (profileUrl) {
    html += `<div style="margin-top:var(--space-2);font-size:var(--font-size-sm);color:var(--text-dim)">Preview their public profile, generate your chart, then book when you're ready.</div>`;
  }

  html += `</div>`;
  return html;
}

// ─── Celebrity / Famous Matches ──────────────────────────────

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

// ─── Theme Toggle ─────────────────────────────────────────────────────────

function toggleTheme() {
  const root = document.documentElement;
  const btn = document.getElementById('themeToggleBtn');
  const isLight = root.getAttribute('data-theme') === 'light';
  if (isLight) {
    root.removeAttribute('data-theme');
    localStorage.setItem('ps-theme', 'dark');
    if (btn) { btn.textContent = '☀'; btn.setAttribute('aria-label', 'Switch to light mode'); }
  } else {
    root.setAttribute('data-theme', 'light');
    localStorage.setItem('ps-theme', 'light');
    if (btn) { btn.textContent = '☽'; btn.setAttribute('aria-label', 'Switch to dark mode'); }
  }
}
window.toggleTheme = toggleTheme;

// Sync button icon to match applied theme on initial load
document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('themeToggleBtn');
  if (btn && document.documentElement.getAttribute('data-theme') === 'light') {
    btn.textContent = '☽';
    btn.setAttribute('aria-label', 'Switch to dark mode');
  }
});
