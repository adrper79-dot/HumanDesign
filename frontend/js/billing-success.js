(async function () {
  const API = 'https://prime-self-api.adrper79.workers.dev';

  const TIER_LABELS = {
    pro: 'Pro',
    premium: 'Premium',
    practitioner: 'Practitioner',
    white_label: 'White Label',
    agency: 'Agency',
    individual: 'Individual',
    free: 'Free',
  };

  function showState(name) {
    document.getElementById('stateActivating').style.display = name === 'activating' ? 'block' : 'none';
    document.getElementById('stateSuccess').style.display = name === 'success' ? 'block' : 'none';
    document.getElementById('stateError').style.display = name === 'error' ? 'block' : 'none';
  }

  function startRedirect() {
    let seconds = 5;
    const el = document.getElementById('countdown');
    const timer = setInterval(() => {
      seconds--;
      if (el) el.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(timer);
        window.location.replace('/');
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
    document.getElementById('tierBadge').textContent = 'Plan Active';
    showState('success');
    startRedirect();
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
    document.getElementById('tierBadge').textContent =
      (TIER_LABELS[tier] ?? tier.charAt(0).toUpperCase() + tier.slice(1)) + ' — Active';
    showState('success');
    startRedirect();
  } else {
    document.getElementById('errorTitle').textContent = 'Almost there…';
    document.getElementById('errorMsg').textContent =
      'Your payment was received. Your account is updating and will be ready within 60 seconds. ' +
      'Sign in and refresh the page to see your new plan.';
    showState('error');
  }
})();