(async function () {
  const API = '';
  const POST_CHECKOUT_DESTINATION_KEY = 'ps_post_checkout_destination';
  const POST_CHECKOUT_TIER_KEY = 'ps_post_checkout_tier';

  const TIER_LABELS = {
    pro: 'Pro',
    premium: 'Premium',
    practitioner: 'Practitioner',
    white_label: 'White Label',
    agency: 'Agency',
    individual: 'Individual',
    free: 'Free',
  };

  const PRACTITIONER_DESTINATION_TIERS = new Set(['practitioner', 'agency', 'white_label', 'guide']);

  function getAppRedirectTarget(tier) {
    const destination = PRACTITIONER_DESTINATION_TIERS.has(tier) ? 'practitioner' : 'overview';
    return {
      destination,
      href: `/?post_checkout=${encodeURIComponent(destination)}&tier=${encodeURIComponent(tier || 'free')}`,
      ctaLabel: destination === 'practitioner' ? 'Open Practitioner Workspace →' : 'Open Prime Self →',
    };
  }

  function showState(name) {
    document.getElementById('stateActivating').style.display = name === 'activating' ? 'block' : 'none';
    document.getElementById('stateSuccess').style.display = name === 'success' ? 'block' : 'none';
    document.getElementById('stateError').style.display = name === 'error' ? 'block' : 'none';
  }

  function updateSuccessAction(target) {
    const actionButton = document.querySelector('#stateSuccess .btn');
    if (actionButton) {
      actionButton.href = target.href;
      actionButton.textContent = target.ctaLabel;
    }
  }

  function rememberPostCheckoutDestination(target, tier) {
    try {
      sessionStorage.setItem(POST_CHECKOUT_DESTINATION_KEY, target.destination);
      sessionStorage.setItem(POST_CHECKOUT_TIER_KEY, tier || 'free');
    } catch (_) {
      // sessionStorage unavailable — query params on the redirect URL still preserve intent.
    }
  }

  function startRedirect(target) {
    let seconds = 5;
    const el = document.getElementById('countdown');
    const timer = setInterval(() => {
      seconds--;
      if (el) el.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(timer);
        window.location.replace(target.href);
      }
    }, 1000);
  }

  let token = null;
  try {
    const refreshRes = await fetch(API + '/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      token = data.accessToken ?? null;
    }
  } catch (_) {
    // Network error — still try to show success, user can verify manually.
  }

  if (!token) {
    const fallbackTarget = getAppRedirectTarget('free');
    document.getElementById('tierBadge').textContent = 'Plan Active';
    updateSuccessAction(fallbackTarget);
    showState('success');
    startRedirect(fallbackTarget);
    return;
  }

  const MAX_ATTEMPTS = 6;
  const POLL_INTERVAL_MS = 3000;

  let tier = 'free';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const subRes = await fetch(API + '/api/billing/subscription', {
        credentials: 'include',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (subRes.ok) {
        const sub = await subRes.json();
        tier = sub.tier ?? sub.subscription?.tier ?? 'free';
        if (tier && tier !== 'free') break;
      }
    } catch (_) {
      // Network blip — keep polling.
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  if (tier && tier !== 'free') {
    const target = getAppRedirectTarget(tier);
    rememberPostCheckoutDestination(target, tier);
    updateSuccessAction(target);
    document.getElementById('tierBadge').textContent =
      (TIER_LABELS[tier] ?? tier.charAt(0).toUpperCase() + tier.slice(1)) + ' — Active';
    showState('success');
    startRedirect(target);
  } else {
    document.getElementById('errorTitle').textContent = 'Almost there…';
    document.getElementById('errorMsg').textContent =
      'Your payment was received. Your account is updating and will be ready within 60 seconds. ' +
      'Sign in and refresh the page to see your new plan.';
    showState('error');
  }
})();