/**
 * billing-controller.js
 * Auto-extracted from frontend/js/app.js by scripts/split-app-js.mjs (GAP-001).
 *
 * Pricing modals, Stripe checkout, billing portal, upgrade prompts
 *
 * Depends on globals defined in app.js (always loaded first):
 *   apiFetch, token, currentUser, escapeHtml, showNotification,
 *   openAuthOverlay, switchTab, showUpgradePrompt, writeJourneyFlag, readJourneyFlag
 *
 * This file is loaded lazily via _loadController() in app.js when the
 * relevant tab is first activated.  Do not add <script> tags for this
 * file to index.html — the loader handles it.
 */
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
    body: 'Track every session, store birth data, and prepare before each call — all in one place designed for Energy Blueprint professionals.',
    roi: 'Average practitioner saves 4 hrs/week on session prep. Pays for itself in week 1.'
  },
  clients: {
    headline: 'Your client list is a practice asset.',
    body: 'Track every session, store birth data, and prepare before each call — all in one place designed for Energy Blueprint professionals.',
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
    body: 'Sessions, clients, composites, reports, and your own referral link — everything a professional Energy Blueprint practice needs.',
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
