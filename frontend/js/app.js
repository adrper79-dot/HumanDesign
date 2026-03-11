const API = 'https://prime-self-api.adrper79.workers.dev';
// Access token is stored in memory only — never in localStorage.
// The refresh token lives in an HttpOnly cookie set by the API.
// On page reload, silentRefresh() exchanges the cookie for a new access token.
let token = null;
let userEmail = localStorage.getItem('ps_email');
let authMode = 'login'; // 'login' | 'register'
window.currentUser = null; // populated by fetchUserProfile()

// Tier display configuration
const TIER_DISPLAY = {
  free:         { label: 'FREE',        badge: 'tier-free',         canUpgrade: true,  isPro: false },
  regular:      { label: 'EXPLORER',    badge: 'tier-seeker',       canUpgrade: true,  isPro: false },
  practitioner: { label: 'GUIDE',       badge: 'tier-guide',        canUpgrade: true,  isPro: true  },
  white_label:  { label: 'STUDIO',      badge: 'tier-practitioner', canUpgrade: false, isPro: true  },
  // legacy aliases
  seeker:       { label: 'EXPLORER',    badge: 'tier-seeker',       canUpgrade: true,  isPro: false },
  guide:        { label: 'GUIDE PRO',   badge: 'tier-guide',        canUpgrade: true,  isPro: true  },
};

// ── Auth Helpers ──────────────────────────────────────────────
function updateAuthUI() {
  const statusEl = document.getElementById('authStatusText');
  const btnEl    = document.getElementById('authBtn');
  const logoutEl = document.getElementById('logoutBtn');
  const deleteAcctEl = document.getElementById('deleteAccountBtn');
  const exportDataEl = document.getElementById('exportDataBtn');
  const badgeEl  = document.getElementById('tierBadge');
  const upgradeEl  = document.getElementById('upgradeBtn');
  const billingEl  = document.getElementById('billingBtn');

  if (token && userEmail) {
    statusEl.textContent = userEmail;
    statusEl.className   = 'auth-status logged-in';
    btnEl.style.display    = 'none';
    logoutEl.style.display = '';
    if (deleteAcctEl) deleteAcctEl.style.display = '';
    if (exportDataEl) exportDataEl.style.display = '';

    // Update tier badge and billing/upgrade buttons from cached profile
    const user = window.currentUser;
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
    } else {
      // Profile not loaded yet — hide badge until fetched
      badgeEl.style.display    = 'none';
      upgradeEl.style.display  = 'none';
      billingEl.style.display  = 'none';
    }
  } else {
    statusEl.textContent = typeof window.t === 'function' ? window.t('auth.notSignedIn') : 'Not signed in';
    statusEl.className   = 'auth-status';
    btnEl.style.display    = '';
    logoutEl.style.display = 'none';
    if (deleteAcctEl) deleteAcctEl.style.display = 'none';
    if (exportDataEl) exportDataEl.style.display = 'none';
    badgeEl.style.display  = 'none';
    upgradeEl.style.display  = 'none';
    billingEl.style.display  = 'none';
  }
}

// Fetch /api/auth/me and populate window.currentUser, then refresh UI
async function fetchUserProfile() {
  if (!token) return;
  try {
    const res = await fetch(API + '/api/auth/me', {
      credentials: 'include',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return; // silently ignore — expired tokens handled by apiFetch elsewhere
    const data = await res.json();
    if (data && data.id) {
      window.currentUser = data;
      updateAuthUI();
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

function openAuthOverlay() {
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
  if (authModalKeydownHandler) {
    modal.removeEventListener('keydown', authModalKeydownHandler);
    authModalKeydownHandler = null;
  }
  if (authBackdropClickHandler) {
    modal.removeEventListener('click', authBackdropClickHandler);
    authBackdropClickHandler = null;
  }
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
    const data = await res.json();
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

function checkOAuthCallback() {
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
    const accessToken  = params.get('token');
    const refreshToken = params.get('refresh');
    const isNewUser    = params.get('new_user') === '1';

    if (!accessToken) {
      showNotification('Login failed — no token received. Please try again.', 'error');
      return;
    }

    // Store tokens — access token in memory only; refresh token in HttpOnly cookie (set by server)
    token = accessToken;
    _sessionRestoredByOauth = true; // prevent boot IIFE from calling fetchUserProfile again
    localStorage.setItem('ps_email', userEmail || '');
    localStorage.removeItem('ps_token'); // legacy cleanup
    localStorage.removeItem('ps_refresh_token'); // SEC-001: remove any stale refresh token from localStorage

    // Fetch user profile and update UI
    fetchUserProfile().then(() => {
      if (isNewUser) {
        showNotification('Welcome to Prime Self! Enter your birth details below to generate your blueprint.', 'success');
      } else {
        showNotification('Signed in successfully.', 'success');
      }
    }).catch(() => {
      showNotification('Signed in. Loading your profile…', 'success');
    });
  }
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
  window._resetToken = resetToken;
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
      body: JSON.stringify({ token: window._resetToken, password })
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
    delete window._resetToken;
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
    // Use raw fetch here — not apiFetch — so a 401 doesn't trigger the auto-logout loop
    const rawRes = await fetch(API + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    const res = await rawRes.json();
    if (!rawRes.ok || res.error) {
      // Mark fields invalid on server error
      emailEl.setAttribute('aria-invalid', 'true');
      passwordEl.setAttribute('aria-invalid', 'true');
      errorEl.textContent = res.error || 'Login failed';
      return;
    }
    // Store tokens — access token in memory only; refresh token is an HttpOnly cookie set by API
    token = res.accessToken;
    userEmail = email;
    localStorage.setItem('ps_email', email);
    // Legacy cleanup: remove any old token that was previously stored in localStorage
    localStorage.removeItem('ps_token');
    // Apply pending referral code (if user arrived via a ?ref= link)
    if (authMode === 'register') {
      const pendingRef = localStorage.getItem('ps_pending_ref');
      if (pendingRef) {
        fetch(API + '/api/referrals/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          credentials: 'include',
          body: JSON.stringify({ code: pendingRef })
        }).catch(() => {}).finally(() => localStorage.removeItem('ps_pending_ref'));
      }
    }
    updateAuthUI();
    closeAuthOverlay();
    // Fetch subscription/tier info now that we have a valid token
    fetchUserProfile();
  } catch (e) {
    errorEl.textContent = _t('auth.connectionError', { message: e.message });
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === 'register' ? _t('auth.createAccount') : _t('auth.signIn');
  }
}

function logout() {
  if (!confirm('Are you sure you want to log out?')) return;
  const oldToken = token;
  token = null; userEmail = null;
  window.currentUser = null;
  localStorage.removeItem('ps_token');    // legacy
  localStorage.removeItem('ps_email');
  localStorage.removeItem('primeSelf_birthData');
  localStorage.removeItem('chartGenerated');
  localStorage.removeItem('profileGenerated');
  localStorage.removeItem('user');
  // Revoke all server-side refresh tokens and clear the HttpOnly cookie
  fetch(API + '/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: oldToken ? { 'Authorization': 'Bearer ' + oldToken, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
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
  const password = prompt('Enter your password to confirm account deletion:');
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
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API + '/api/auth/export', { headers, credentials: 'include' });
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
  if (!token) {
    openAuthOverlay();
    document.getElementById('authError').textContent = typeof window.t === 'function' ? window.t('auth.signInUpgrade') : 'Sign in to upgrade your plan.';
    return;
  }
  // Route professional tiers to the practitioner modal
  const tier = window.currentUser?.tier || 'free';
  if (tier === 'practitioner' || tier === 'white_label' || tier === 'guide') {
    openPractitionerPricingModal();
    return;
  }
  // Update card states based on current tier
  _syncConsumerPricingCards(tier);
  document.getElementById('pricingOverlay').classList.remove('hidden');
}

function closePricingModal() {
  document.getElementById('pricingOverlay').classList.add('hidden');
}

// Sync consumer pricing card button states to match current user tier
function _syncConsumerPricingCards(tier) {
  const freeBtn    = document.getElementById('priceBtn-free');
  const regularBtn = document.getElementById('priceBtn-regular');
  if (!freeBtn || !regularBtn) return;

  if (tier === 'regular' || tier === 'seeker') {
    // Already on Explorer
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
    regularBtn.textContent = 'Upgrade to Explorer';
    regularBtn.className   = 'btn-primary tier-cta';
  }
}

// Professional pricing modal (Guide + Studio)
function openPractitionerPricingModal() {
  if (!token) {
    openAuthOverlay();
    document.getElementById('authError').textContent = typeof window.t === 'function' ? window.t('auth.signInUpgrade') : 'Sign in to view professional plans.';
    return;
  }
  const tier = window.currentUser?.tier || 'free';
  _syncPractitionerPricingCards(tier);
  document.getElementById('practitionerPricingOverlay').classList.remove('hidden');
}

function closePractitionerPricingModal() {
  document.getElementById('practitionerPricingOverlay').classList.add('hidden');
}

// Sync practitioner pricing card button states
function _syncPractitionerPricingCards(tier) {
  const practBtn    = document.getElementById('priceBtn-practitioner');
  const studioBtn   = document.getElementById('priceBtn-white_label');
  if (!practBtn || !studioBtn) return;

  if (tier === 'white_label') {
    practBtn.disabled    = false;
    practBtn.textContent = 'Downgrade to Guide';
    practBtn.className   = 'btn-secondary tier-cta';
    studioBtn.disabled   = true;
    studioBtn.textContent = 'Current Plan';
    studioBtn.className  = 'btn-secondary tier-cta';
  } else if (tier === 'practitioner' || tier === 'guide') {
    practBtn.disabled    = true;
    practBtn.textContent = 'Current Plan';
    practBtn.className   = 'btn-secondary tier-cta';
    studioBtn.disabled   = false;
    studioBtn.textContent = 'Upgrade to Studio';
    studioBtn.className  = 'btn-primary tier-cta';
  } else {
    // Free or regular user arrived here via "For Practitioners" CTA
    practBtn.disabled    = false;
    practBtn.textContent = 'Upgrade to Guide';
    practBtn.className   = 'btn-primary tier-cta';
    studioBtn.disabled   = false;
    studioBtn.textContent = 'Upgrade to Studio';
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

    const result = await apiFetch('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify(checkoutBody)
    });

    if (result.error) {
      showNotification('Checkout failed: ' + result.error, 'error');
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = originalText;
      }
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
    showNotification('Failed to start checkout: ' + e.message, 'error');
  }
}

async function openBillingPortal() {
  if (!token) {
    openAuthOverlay();
    return;
  }

  try {
    const result = await apiFetch('/api/billing/portal', {
      method: 'POST'
    });

    if (result.error) {
      showNotification('Failed to open billing portal: ' + result.error, 'error');
      return;
    }

    if (result.url) {
      window.open(result.url, '_blank');
    }
  } catch (e) {
    showNotification('Failed to open billing portal: ' + e.message, 'error');
  }
}

// Helper to show upgrade modal on quota/feature errors
function showUpgradePrompt(message, feature) {
  openPricingModal();
  // Could enhance this to highlight specific tier needed for the feature
}

// ── API Fetch ─────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;

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

  // Auto-handle expired / missing token — try silent refresh once, then force sign-in
  if (res.status === 401) {
    const refreshed = await silentRefresh();
    if (refreshed) {
      // Retry original request with new token
      const retryHeaders = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      retryHeaders['Authorization'] = 'Bearer ' + token;
      try {
        const retryRes = await fetch(API + path, { ...options, headers: retryHeaders, credentials: 'include' });
        if (retryRes.status !== 401) return retryRes.json();
      } catch (retryErr) {
        return { ok: false, error: 'Network/CORS error on retry.' };
      }
    }
    // Refresh failed — force sign-in
    token = null;
    userEmail = null;
    localStorage.removeItem('ps_email');
    window.currentUser = null;
    updateAuthUI();
    openAuthOverlay();
    document.getElementById('authError').textContent = typeof window.t === 'function' ? window.t('auth.sessionExpired') : 'Session expired. Please sign in.';
    return { error: 'Authentication required. Please sign in.' };
  }

  // Handle quota exceeded (429) and feature not available (403)
  if (res.status === 429 || res.status === 403) {
    const errorData = await res.json();
    // Show upgrade prompt if the error indicates upgrade is needed
    if (errorData.upgrade_required) {
      showUpgradePrompt(errorData.error, errorData.feature);
    }
    return errorData;
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    return {
      ok: res.ok,
      error: text || `Unexpected non-JSON response (${res.status})`,
      status: res.status
    };
  }

  return res.json();
}

// ── Tabs ──────────────────────────────────────────────────────
// Tab group mapping: which primary button stays active for each sub-tab
const TAB_GROUPS = {
  overview: 'btn-home',
  chart: 'btn-blueprint', profile: 'btn-blueprint',
  transits: 'btn-today', checkin: 'btn-today',
  composite: 'btn-connect', clusters: 'btn-connect',
  enhance: 'btn-grow', diary: 'btn-grow',
  practitioner: 'btn-practitioner',
  // Settings drawer items — no primary tab highlights
  history: null, sms: null, rectify: null, onboarding: null
};

// Sidebar parent mapping: which parent nav items expand for sub-tabs
const SIDEBAR_PARENTS = {
  chart: 'chart', profile: 'chart',
  transits: 'transits', checkin: 'transits',
  composite: 'composite', clusters: 'composite',
  enhance: 'enhance', diary: 'enhance'
};

function switchTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  // legacy support: remove active from old .tabs .tab-btn if any remain
  document.querySelectorAll('.tabs .tab-btn').forEach(el => { el.classList.remove('active'); el.setAttribute('aria-selected', 'false'); });
  const panel = document.getElementById('tab-' + id);
  if (panel) panel.classList.add('active');

  // Activate the correct primary tab button (group-aware) — legacy support
  const groupBtn = TAB_GROUPS[id] ? document.getElementById(TAB_GROUPS[id]) : btn;
  if (groupBtn) { groupBtn.classList.add('active'); groupBtn.setAttribute('aria-selected', 'true'); }
  else if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
  
  // Update sidebar active states
  updateSidebarActive(id);

  // Update step guide progress
  updateStepGuide(id);

  // Lazy-load tab content on first activation (BL-OPT-005)
  if (typeof window.onTabActivated === 'function') window.onTabActivated(id);
  
  // Auto-load clusters when tab is activated
  if (id === 'clusters' && token && !document.getElementById('clusterListContainer')?.innerHTML) {
    loadClusters();
  }

  // Auto-load practitioner roster when tab is activated
  if (id === 'practitioner' && token) {
    loadRoster();
  }

  // Update mobile nav active state
  if (typeof updateMobileNavForTab === 'function') updateMobileNavForTab(id);
}

// ── Sidebar Navigation ────────────────────────────────────────

function sidebarNav(tabId) {
  switchTab(tabId);
  // Close mobile drawer if open
  if (window.innerWidth <= 768) closeSidebar();
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
  const isOpen = sidebar.classList.toggle('open');
  backdrop.classList.toggle('visible', isOpen);
  hamburger.setAttribute('aria-expanded', String(isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const hamburger = document.getElementById('hamburgerBtn');
  sidebar.classList.remove('open');
  backdrop.classList.remove('visible');
  if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
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
    { id: 'sg-chart', tab: 'chart' },
    { id: 'sg-profile', tab: 'profile' },
    { id: 'sg-transits', tab: 'transits' }
  ];
  steps.forEach(s => {
    const el = document.getElementById(s.id);
    if (!el) return;
    el.classList.remove('active-step');
    if (s.tab === activeTab) el.classList.add('active-step');
  });
  // Mark steps as done based on localStorage state
  if (localStorage.getItem('chartGenerated')) {
    const c = document.getElementById('sg-chart');
    if (c) { c.classList.add('done'); c.classList.remove('active-step'); }
  }
  if (localStorage.getItem('profileGenerated')) {
    const p = document.getElementById('sg-profile');
    if (p) { p.classList.add('done'); p.classList.remove('active-step'); }
  }
}

// Call on load to set initial step state
document.addEventListener('DOMContentLoaded', () => updateStepGuide('chart'));

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
                   font-size="10" fill="var(--text-dim)" opacity="0.7">${zodiacSigns[i].substr(0,3)}</text>`;
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
                    font-size="8" fill="var(--text-dim)">${name}</text>
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
              <span style="color:var(--text-dim)">${name} ${data.degrees?.toFixed(1)}° ${data.sign}</span>
            </div>`;
  });
  
  html += `</div></div>`;
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
  s.textContent = '<span class="icon-check"></span> Tampa, Florida, United States · 27.9506°N, 82.4572°W · America/New_York';
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
    statusEl.textContent = `<span class="icon-check"></span> ${data.displayName} · ${Math.abs(data.lat).toFixed(4)}°${latDir}, ${Math.abs(data.lng).toFixed(4)}°${lngDir} · ${data.timezone}`;
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
      resultEl.innerHTML = '<div class="alert alert-error"><span class="icon-info"></span> ' + window.t('chart.lookUpFirst') + '</div>';
      return;
    }
  }

  btn.disabled = true;
  spinner.style.display = '';
  resultEl.innerHTML = skeletonChart();

  try {
    const payload = {
      birthDate: document.getElementById('c-date').value,
      birthTime: document.getElementById('c-time').value,
      birthTimezone: document.getElementById('c-tz').value,
      lat: parseFloat(document.getElementById('c-lat').value),
      lng: parseFloat(document.getElementById('c-lng').value),
    };

    const data = await apiFetch('/api/chart/calculate', { method: 'POST', body: JSON.stringify(payload) });
    resultEl.innerHTML = renderChart(data);
    // Save birth data to localStorage after successful chart calculation
    saveBirthData();
    // Update overview tab with fresh data
    if (typeof updateOverview === 'function') updateOverview(data);
    // Show identity strip with type/authority/profile
    if (typeof showIdentityStrip === 'function') showIdentityStrip(data);
    // Auto-navigate to Home dashboard after first calculation
    const homeBtn = document.getElementById('btn-home');
    if (homeBtn && typeof switchTab === 'function') switchTab('overview', homeBtn);
    // Collapse the chart form now that a chart has been generated
    collapseChartForm();
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// ── Chart Form Collapse (hide form after generation, show compact summary) ──
function collapseChartForm() {
  localStorage.setItem('chartGenerated', '1');
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

function restoreBirthData() {
  try {
    const raw = localStorage.getItem(BIRTH_DATA_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data.date || !data.time) return false;

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
  if (localStorage.getItem('chartGenerated')) {
    collapseChartForm();
  }
});

function renderChart(data) {
  if (window.DEBUG) console.log('[Chart] renderChart called with data:', data);
  if (data.error) return `<div class="alert alert-error">API Error: ${escapeHtml(data.error)}</div>`;
  const d = data.data || data;
  const chart = d.chart || d;
  const astro = d.westernAstrology || d.astrology || {};
  if (window.DEBUG) console.log('[Chart] Extracted astro:', astro);
  const meta = data.meta || {};

  let html = '';

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
        ${row('Not-Self Theme <span class="icon-info help-icon" title="The emotional signal that you are out of alignment with your pattern and strategy"></span>', chart.notSelfTheme)}
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
        <h4>Purpose Vector <span class="icon-info help-icon" title="Your life purpose formed by the 4 main gene key activations: conscious Sun/Earth and unconscious Sun/Earth"></span></h4>
        ${(() => {
          const crossName = chart.cross?.name || (typeof chart.cross === 'string' ? chart.cross : null);
          const sunGate = chart.cross?.gates?.[0] || chart.personalitySunGate;
          const sunLine = chart.cross?.line || chart.personalitySunLine;
          const lookedUp = (!crossName && sunGate && sunLine) ? getCrossName(sunGate, sunLine) : '';
          return row('Cross', crossName || lookedUp || (chart.cross?.gates ? chart.cross.gates.join(', ') : '—'));
        })()}
        ${row('Type', chart.cross?.type || chart.crossType || '—')}
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
  html += `<div class="section-header">Your Bodygraph <span class="icon-info help-icon" title="Click any center or channel line to learn what it means in your design"></span></div>
  <div class="card" style="padding:var(--space-4);text-align:center">
    <div id="${_bgId}" style="min-height:200px"></div>
    <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-2)">Tap a center or channel to explore</div>
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

  html += `<div class="card" style="border-left:var(--space-1) solid var(--gold);margin-top:var(--space-5)">
    <div class="card-title"><span class="icon-chart"></span> What This Means For You</div>
    <div style="font-size:var(--font-size-base);color:var(--text);line-height:1.7">
      <p style="margin:0 0 10px">You are a <strong>${chart.type || 'unique'}</strong> with <strong>${chart.authority || 'inner'}</strong> authority.
      Your strategy is to <strong>${(chart.strategy || '').toLowerCase()}</strong>, and your life role is <strong>${chart.profile || '—'}</strong>.</p>
      <p style="margin:0 0 10px">With <strong>${definedCount} defined</strong> and <strong>${openCount} open</strong> center${openCount !== 1 ? 's' : ''},
      ${definedCount > openCount
        ? 'you carry consistent, reliable energy in most of your chart — you know who you are.'
        : definedCount === openCount
          ? 'you have a balanced mix of fixed and receptive energy — both grounded and adaptable.'
          : 'you are highly receptive and sensitive to your environment — a natural empath who samples others\' energy.'}
      ${motorCenters.length ? ` You have <strong>${motorCenters.length} motor center${motorCenters.length > 1 ? 's' : ''}</strong> defined (${motorCenters.join(', ')}), giving you consistent drive and fuel.` : ''}</p>
      ${channelCount ? `<p style="margin:0 0 10px"><strong>${channelCount} active channel${channelCount > 1 ? 's' : ''}</strong> create${channelCount === 1 ? 's' : ''} fixed energy flows between your centers — these are your reliable gifts and talents.</p>` : ''}
      ${crossDisplay ? `<p style="margin:0 0 10px">Your soul cross — <strong>${crossDisplay}</strong> — describes your life purpose and the theme you are here to live out.</p>` : ''}
      <p style="margin:0;font-size:var(--font-size-sm);color:var(--text-muted)">When you feel <em>${(chart.notSelfTheme || 'out of alignment').toLowerCase()}</em>, it\'s a signal to return to your strategy. Experiment with your design — don\'t take it on faith.</p>
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

  html += rawToggle(data);
  return html;
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

  btn.disabled = true;
  spinner.style.display = '';
  resultEl.innerHTML = skeletonProfile();

  // Progress indicator updates during the 15-30s generation
  const progressMessages = [
    { delay: 0, message: 'Analyzing your birth chart...' },
    { delay: 3000, message: 'Calculating gate activations...' },
    { delay: 6000, message: 'Mapping planetary positions...' },
    { delay: 9000, message: 'Synthesizing Gene Keys insights...' },
    { delay: 12000, message: 'Generating personalized profile...' },
    { delay: 15000, message: 'Finalizing your Prime Self synthesis...' }
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
      document.getElementById('profileResult').innerHTML =
        '<div class="alert alert-error"><span class="icon-info"></span> ' + window.t('chart.lookUpFirst') + '</div>';
      document.getElementById('profileBtn').disabled = false;
      document.getElementById('profileSpinner').style.display = 'none';
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

    const data = await apiFetch('/api/profile/generate', { method: 'POST', body: JSON.stringify(payload) });
    // Clear any remaining progress timeouts
    progressTimeouts.forEach(clearTimeout);
    resultEl.innerHTML = renderProfile(data);
  } catch (e) {
    // Clear progress timeouts on error
    progressTimeouts.forEach(clearTimeout);
    resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
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

  // Chart summary banner
  html += `<div class="card">
    <div class="card-title"><span class="icon-profile"></span> Prime Self Profile</div>
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-4)">`;
  if (chartSummary.type) html += `<span class="pill gold">${chartSummary.type}</span>`;
  if (chartSummary.authority) html += `<span class="pill">${chartSummary.authority}</span>`;
  if (chartSummary.profile) html += `<span class="pill">${chartSummary.profile} Archetype</span>`;
  if (chartSummary.definition) html += `<span class="pill">${chartSummary.definition}</span>`;
  if (chartSummary.cross) html += `<span class="pill" style="font-size:var(--font-size-sm)">${chartSummary.cross}</span>`;
  html += `</div>`;
  html += `</div>`; // close card

  // ═══ QUICK START GUIDE (Layer 1 - Human-Friendly) ═══
  if (qsg) {
    html += `<div class="card">
      <div class="card-title"><span class="icon-star"></span> Your Quick Start Guide</div>
      <p style="font-size:var(--font-size-sm);color:var(--text-dim);margin-bottom:var(--space-5)">Beginner-friendly overview — no jargon, just practical insights.</p>`;
    
    if (qsg.whoYouAre) {
      html += `<div class="profile-section">
        <h4><span class="icon-profile"></span> Who You Are</h4>
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
    
    // Gene Keys Profile
    if (ti.geneKeysProfile) {
      const gk = ti.geneKeysProfile;
      html += `<div class="card">
        <div class="card-title"><span class="icon-key"></span> Gene Keys Profile</div>`;
      
      if (gk.lifesWork) {
        const lw = gk.lifesWork;
        html += `<div class="profile-section">
          <h4>Life's Work — Gene Key ${lw.key}</h4>
          <p style="font-size:var(--font-size-sm);margin-top:var(--space-2)"><strong style="color:#f56565">Shadow:</strong> ${escapeHtml(lw.shadow)}</p>
          <p style="font-size:var(--font-size-sm)"><strong style="color:#48c774">Gift:</strong> ${escapeHtml(lw.gift)}</p>
          <p style="font-size:var(--font-size-sm)"><strong style="color:var(--gold)">Siddhi:</strong> ${escapeHtml(lw.siddhi)}</p>
          ${lw.contemplation ? `<p style="font-size:var(--font-size-base);line-height:1.6;margin-top:var(--space-2);font-style:italic;color:var(--text-dim)">${escapeHtml(lw.contemplation)}</p>` : ''}
        </div>`;
      }
      
      if (gk.otherActiveKeys?.length) {
        html += `<div class="profile-section">
          <h4>Other Active Keys</h4>`;
        gk.otherActiveKeys.forEach(k => {
          html += `<div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--bg3);border-radius:var(--space-2)">
            <div style="font-weight:600;color:var(--gold)">GK ${escapeHtml(String(k.key))} — ${escapeHtml(k.position)}</div>
            <p style="font-size:var(--font-size-sm);margin-top:var(--space-1)"><strong>Shadow:</strong> ${escapeHtml(k.shadow)} <strong>→ Gift:</strong> ${escapeHtml(k.gift)}</p>
            ${k.message ? `<p style="font-size:var(--font-size-base);margin-top:var(--space-2);font-style:italic">${escapeHtml(k.message)}</p>` : ''}
          </div>`;
        });
        html += `</div>`;
      }
      
      html += `</div>`; // close Gene Keys card
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
      
      html += `</div>`; // close Numerology card
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

  html += rawToggle(data);
  return html;
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
    if (gateName && gateTheme) parts.push(`Gate ${gate} (${gateName}) focuses on ${gateTheme.toLowerCase()}.`);
    else if (gateTheme) parts.push(`Gate ${gate} focuses on ${gateTheme.toLowerCase()}.`);
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
    html += `<div class="transit-row${isNatalHit ? ' transit-row-hit' : ''}">
      <div>
        <div class="planet-name">${sym} ${body}</div>
        <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-1)">${speed}</div>
      </div>
      <div>
        <div class="planet-pos">${pos.sign || ''} ${pos.degrees != null ? pos.degrees.toFixed ? pos.degrees.toFixed(1) : pos.degrees : ''}°</div>
        <div style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-1);line-height:1.4">${theme}</div>
        ${gateExplanation ? `<div style="font-size:var(--font-size-sm);color:var(--text);margin-top:var(--space-1);line-height:1.45">${escapeHtml(gateExplanation)}</div>` : ''}
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
      <p style="max-width:min(500px, 90vw);margin:0 auto 24px">Generate your first Prime Self Profile to unlock AI-powered synthesis combining your gates, Gene Keys, astrology, and numerology into personalized lifecycle guidance.</p>
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

// ── Composite Chart ───────────────────────────────────────────
async function generateComposite() {
  const btn = document.getElementById('compBtn');
  const spinner = document.getElementById('compSpinner');
  const resultEl = document.getElementById('compResult');

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
  resultEl.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>' + window.t('rectify.analyzing') + '</div></div>';

  try {
    const data = await apiFetch('/api/rectify', { method: 'POST', body: JSON.stringify(body) });
    resultEl.innerHTML = renderRectification(data);
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Error: ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
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

// ── Practitioner Tools ─────────────────────────────────────────

function togglePracAddForm() {
  const form = document.getElementById('pracAddForm');
  const isHidden = form.style.display === 'none';
  form.style.display = isHidden ? 'block' : 'none';
  document.getElementById('pracAddToggle').textContent = isHidden ? '✕ Cancel' : '+ Add Client';
  if (isHidden) document.getElementById('prac-email').focus();
}

async function addClient() {
  if (!token) { openAuthOverlay(); return; }

  const email = document.getElementById('prac-email').value.trim();
  if (!email) { showNotification('Client email is required', 'warning'); return; }

  const btn = document.getElementById('pracAddBtn');
  const spinner = document.getElementById('pracAddSpinner');
  const statusEl = document.getElementById('pracAddStatus');

  btn.disabled = true;
  spinner.style.display = '';
  statusEl.innerHTML = '';

  try {
    const data = await apiFetch('/api/practitioner/clients/add', {
      method: 'POST',
      body: JSON.stringify({ clientEmail: email })
    });
    showNotification(data.message || 'Client added to roster', 'success');
    document.getElementById('prac-email').value = '';
    togglePracAddForm();
    loadRoster(); // refresh roster after adding
  } catch (e) {
    statusEl.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

async function loadRoster() {
  if (!token) { openAuthOverlay(); return; }

  const resultEl = document.getElementById('pracResult');
  resultEl.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>Loading your roster…</div></div>';

  // Also load practitioner profile to get limit info
  try {
    const [rosterData, profileData] = await Promise.all([
      apiFetch('/api/practitioner/clients'),
      apiFetch('/api/practitioner/profile').catch(() => null)
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

    resultEl.innerHTML = renderRoster(rosterData);
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Error loading roster: ${escapeHtml(e.message)}</div>`;
  }
}

function renderRoster(data) {
  if (data.error) return `<div class="alert alert-error">${escapeHtml(data.error)}</div>`;
  const clients = data.clients || [];

  if (!clients.length) {
    return `<div class="empty-state">
      <span class="icon-star icon-xl"></span>
      <h3 style="margin:var(--space-4) 0 8px;font-size:var(--font-size-md);color:var(--text)">No clients yet</h3>
      <p style="max-width:min(500px,90vw);margin:0 auto">Add clients by email using the button above. They must already have a Prime Self account.</p>
    </div>`;
  }

  let html = `<div class="card">
    <div class="card-title"><span class="icon-star"></span> Roster — ${clients.length} client${clients.length !== 1 ? 's' : ''}</div>`;

  clients.forEach(c => {
    const addedDate = c.added_at ? new Date(c.added_at).toLocaleDateString() : '—';
    const chartDate = c.chart_date ? new Date(c.chart_date).toLocaleDateString() : 'No chart';
    const chartId   = c.chart_id || null;
    const clientId  = c.id;
    const emailSafe = escapeHtml(c.email);

    html += `
    <div class="client-row" id="client-row-${escapeAttr(clientId)}" style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-3);padding:var(--space-3) 0;border-bottom:var(--border-width-thin) solid var(--border)">
      <div style="flex:1;min-width:150px">
        <div style="font-weight:600;color:var(--text)">${emailSafe}</div>
        <div style="font-size:var(--font-size-sm);color:var(--text-dim)">
          Added ${addedDate} · Last chart: ${chartDate}
        </div>
      </div>
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
        <button class="btn-secondary btn-sm" data-action="viewClientDetail" data-arg0="${escapeAttr(clientId)}" data-arg1="${emailSafe}">View Details</button>
        <button class="btn-danger btn-sm" data-action="removeClient" data-arg0="${escapeAttr(clientId)}" data-arg1="${emailSafe}">Remove</button>
      </div>
    </div>`;
  });

  html += `</div>`;
  return html;
}

async function viewClientDetail(clientId, emailLabel) {
  const panel = document.getElementById('pracDetailPanel');
  panel.style.display = 'block';
  panel.innerHTML = `<div class="loading-card"><div class="spinner"></div><div>Loading ${escapeHtml(emailLabel)}…</div></div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const data = await apiFetch(`/api/practitioner/clients/${clientId}`);
    panel.innerHTML = renderClientDetail(data, emailLabel);
  } catch (e) {
    panel.innerHTML = `<div class="alert alert-error">Error loading client: ${escapeHtml(e.message)}</div>`;
  }
}

function renderClientDetail(data, emailLabel) {
  const { client, chart, profile } = data;
  const email = escapeHtml(emailLabel || client?.email || '');

  let html = `<div class="card" style="border-top:3px solid var(--gold)">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-4)">
      <div class="card-title" style="margin:0"><span class="icon-star"></span> ${email}</div>
      <button class="btn-secondary btn-sm" data-action="hidePracDetail">✕ Close</button>
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
    }

    html += `</div>`;
  } else {
    html += `<div class="alert alert-warn" style="margin-top:var(--space-3)">This client has not generated a profile synthesis yet.</div>`;
  }

  html += `</div>`;
  return html;
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
  document.getElementById('createClusterForm').style.display = 'block';
  document.getElementById('cluster-name').focus();
}

function hideCreateClusterForm() {
  document.getElementById('createClusterForm').style.display = 'none';
  document.getElementById('cluster-name').value = '';
  document.getElementById('cluster-challenge').value = '';
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

  btn.disabled = true;
  spinner.style.display = '';

  try {
    const data = await apiFetch('/api/cluster/create', { method: 'POST', body: JSON.stringify({ name, challenge, createdBy: null }) });
    showAlert('clusterListContainer', `Cluster "${name}" created successfully!`, 'success');
    hideCreateClusterForm();
    loadClusters();
  } catch (e) {
    showAlert('clusterListContainer', 'Error creating cluster: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

async function loadClusters() {
  if (!token) { openAuthOverlay(); return; }

  const spinner = document.getElementById('clusterListSpinner');
  const container = document.getElementById('clusterListContainer');

  spinner.style.display = '';
  container.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>' + window.t('clusters.loading') + '</div></div>';

  try {
    const data = await apiFetch('/api/cluster/list');
    container.innerHTML = renderClusterList(data);
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error"><span class="icon-info"></span> Error loading clusters: ${escapeHtml(e.message)}</div>`;
  } finally {
    spinner.style.display = 'none';
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
  
  listContainer.style.display = 'none';
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
  document.getElementById('clusterDetailContainer').style.display = 'none';
  document.getElementById('clusterListContainer').style.display = 'block';
  currentCluster = null;
}

function showAddMemberForm() {
  const container = document.getElementById('addMemberFormCard');
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
          <option value="America/New_York">America/New_York</option>
          <option value="America/Chicago">America/Chicago</option>
          <option value="America/Los_Angeles">America/Los_Angeles</option>
          <option value="UTC">UTC</option>
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
  btn.disabled = true;
  spinner.style.display = '';

  try {
    await apiFetch(`/api/cluster/${currentCluster.id}/join`, { method: 'POST', body: JSON.stringify({
      userId, birthDate, birthTime, birthTimezone, lat, lng
    }) });
    showAlert('synthesisResult', 'Member added successfully!', 'success');
    document.getElementById('addMemberFormCard').style.display = 'none';
    viewClusterDetail(currentCluster.id); // Refresh
  } catch (e) {
    showAlert('addMemberFormCard', 'Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

async function synthesizeCluster(clusterId) {
  const container = document.getElementById('synthesisResult');
  container.innerHTML = '<div class="loading-card"><div class="spinner"></div><div>' + window.t('profile.generatingAi') + '</div></div>';

  try {
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
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

  // Mini bodygraph
  const _ovBgId = 'overview-bodygraph-' + Date.now();
  html += `<div class="card" style="margin-bottom:var(--space-4);text-align:center">
    <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--space-3)">Your Bodygraph</div>
    <div id="${_ovBgId}"></div>
    <div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-2)">Tap centers and channels to explore</div>
  </div>`;

  // Not-Self alert
  if (chart.notSelfTheme) {
    html += `<div class="card" style="border-left:var(--space-1) solid var(--red);margin-bottom:var(--space-4)">
      <div style="font-size:var(--font-size-xs);font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--space-2)">⚠ Watch For</div>
      <div style="font-size:var(--font-size-base);color:var(--text)">When you feel <em>${chart.notSelfTheme.toLowerCase()}</em>, it's a signal you may be out of alignment with your design.</div>
    </div>`;
  }

  // Quick links
  html += `<div style="display:flex;gap:var(--space-3);flex-wrap:wrap;justify-content:center;margin-top:var(--space-3)">
    <button class="btn-primary" style="font-size:var(--font-size-sm);padding:var(--space-2) 18px" data-action="switchTab" data-arg0="chart">View Full Chart</button>
    <button class="btn-primary" style="font-size:var(--font-size-sm);padding:var(--space-2) 18px;background:var(--accent)" data-action="switchTab" data-arg0="profile">Generate AI Profile</button>
    <button class="btn-primary" style="font-size:var(--font-size-sm);padding:var(--space-2) 18px;background:transparent;border:var(--border-width-thin) solid var(--border);color:var(--text-dim)" data-action="switchTab" data-arg0="transits">Today's Transits</button>
  </div>`;

  container.innerHTML = html;

  // Deferred bodygraph render
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
    showEnhanceStatus('bigfiveStatus', 'Big Five assessment saved! Your profile will now cross-correlate psychology with your chart.', 'success');
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
  text: `I embody ${strength.toLowerCase()}.`
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
    showEnhanceStatus('viaStatus', 'Character Strengths saved! Results will map to your Gene Keys gifts.', 'success');
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
      if (updateResult?.error || updateResult?.success === false) {
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
      if (createResult?.error || createResult?.success === false) {
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
    const data = await apiFetch('/api/diary');
    if (data?.error) throw new Error(data.error);
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
    if (result?.error || result?.success === false) {
      throw new Error(result?.error || 'Failed to delete event');
    }
    showEnhanceStatus('diaryStatus', 'Event deleted', 'success');
    loadDiaryEntries();
  } catch (e) {
    showEnhanceStatus('diaryStatus', 'Error deleting: ' + e.message, 'error');
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
    const tierLimits = {
      free: { profileGenerations: 1, practitionerTools: false },
      seeker: { profileGenerations: 10, practitionerTools: false },
      guide: { profileGenerations: Infinity, practitionerTools: true },
      practitioner: { profileGenerations: Infinity, practitionerTools: true }
    };
    
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
    
    // Show profile quota notice (fetch current usage from API)
    const profileQuotaNotice = document.getElementById('profileQuotaNotice');
    const profileQuotaText = document.getElementById('profileQuotaText');
    if (profileQuotaNotice && profileQuotaText && limits.profileGenerations !== Infinity) {
      // This would require a /api/usage endpoint - for now just show limit
      profileQuotaText.textContent = `You have ${limits.profileGenerations} profile generation${limits.profileGenerations === 1 ? '' : 's'} per month on the ${tier} tier.`;
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
    const shareText = text || `Discover your unique energy blueprint through Gene Keys, Astrology, and Numerology.`;
    
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
 */
function shareToSocial(platform) {
  const shareUrl = buildShareUrl();
  const shareText = encodeURIComponent('Discover your unique energy blueprint through Gene Keys, Astrology, and Numerology on Prime Self!');
  
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
  // Future: Send to Google Analytics, Mixpanel, etc.
  // if (window.gtag) {
  //   gtag('event', action, { event_category: category, event_label: label });
  // }
}

/**
 * Open share modal — fetches real referral code from API for logged-in users
 */
async function openShareModal() {
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
}

/**
 * Copy share link from modal
 */
async function copyShareLink() {
  const shareLinkInput = document.getElementById('shareLinkInput');
  if (shareLinkInput) {
    await copyToClipboard(shareLinkInput.value);
    showNotification('Link copied! Share it anywhere.', 'success');
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
    localStorage.setItem('ps_pending_ref', ref.toUpperCase());
  }
})();

// Restore session from HttpOnly refresh cookie, then boot UI
(async () => {
  checkOAuthCallback();
  checkResetPasswordAction();
  if (_sessionRestoredByOauth) {
    // OAuth callback already set token and called fetchUserProfile — skip silentRefresh
    userEmail = localStorage.getItem('ps_email');
    return;
  }
  const restored = await silentRefresh();
  if (restored) {
    userEmail = localStorage.getItem('ps_email');
    await fetchUserProfile();
  } else {
    updateAuthUI();
  }
})();

// ── Wrapper functions for complex inline handlers ───────────────────────────
function hideMemberForm() { const el = document.getElementById('addMemberFormCard'); if (el) el.style.display = 'none'; }
function hidePracDetail()  { const el = document.getElementById('pracDetailPanel');  if (el) el.style.display = 'none'; }
function openLastShareCard() { if (typeof showShareCard === 'function') showShareCard(window._lastChart); }
function switchToPricingModal()    { closePractitionerPricingModal(); openPricingModal(); }
function switchToPracPricingModal() { openPractitionerPricingModal(); closePricingModal(); }
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
window.exportMyData = exportMyData;
window.deleteAccount = deleteAccount;
window.switchTab = switchTab;
window.geocodeLocation = geocodeLocation;
window.calculateChart = calculateChart;
window.generateProfile = generateProfile;
window.prefillExample = prefillExample;
window.expandChartForm = expandChartForm;
window.openLastShareCard = openLastShareCard;
window.toggleRaw = toggleRaw;
window.toggleDetails = toggleDetails;
window.hideMemberForm = hideMemberForm;
window.hidePracDetail = hidePracDetail;
window.switchToPricingModal = switchToPricingModal;
window.switchToPracPricingModal = switchToPracPricingModal;
window.logout = logout;
window.saveDiaryEntry = saveDiaryEntry;
window.loadDiaryEntries = loadDiaryEntries;
window.editDiaryEntry = editDiaryEntry;
window.cancelDiaryEdit = cancelDiaryEdit;
window.deleteDiaryEntry = deleteDiaryEntry;
