// BL-R-M19: Derive parent origin for secure postMessage targeting
// SECURITY: Never use '*' — if origin cannot be determined, skip postMessage entirely
const parentOrigin = (function() {
  try {
    if (document.referrer) {
      return new URL(document.referrer).origin;
    }
    console.warn('[Prime Self Embed] No referrer — postMessage to parent disabled for security');
    return null;
  } catch (e) {
    console.warn('[Prime Self Embed] Invalid referrer URL — postMessage to parent disabled');
    return null;
  }
})();

// Safe postMessage wrapper — only sends if parentOrigin is valid
function safePostMessage(message) {
  if (parentOrigin && window.parent !== window) {
    window.parent.postMessage(message, parentOrigin);
  }
}

// Parse URL parameters for customization
const urlParams = new URLSearchParams(window.location.search);
const theme = urlParams.get('theme');
const accent = urlParams.get('accent');
const hideAttributionRequested = urlParams.get('hideAttribution') === 'true';
const apiKey = urlParams.get('apiKey') || '';
const apiEndpoint = urlParams.get('apiEndpoint') || 'https://prime-self-api.adrper79.workers.dev';

// Apply theme
if (theme === 'light') {
  document.body.classList.add('theme-light');
}

// Apply custom accent color (sanitize: hex only)
if (accent && /^#[0-9A-F]{6}$/i.test(accent)) {
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-hover', accent + 'dd');
}

// hideAttribution=true is ONLY honored when:
//   1. An apiKey is provided in the URL
//   2. The server confirms the key belongs to an Agency / white-label-capable subscriber
// Failing either check: attribution remains visible (fail-safe default).
async function validateAttributionPermission(key) {
  if (!key) return false;
  try {
    const res = await fetch(`${apiEndpoint}/api/embed/validate?apiKey=${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.valid === true && data.features?.hideAttribution === true;
  } catch {
    return false;
  }
}

if (hideAttributionRequested && apiKey) {
  validateAttributionPermission(apiKey).then(allowed => {
    if (allowed) {
      document.getElementById('attribution').classList.add('hidden');
    }
  });
}

function notifyResize() {
  const container = document.querySelector('.container');
  const height = container ? Math.ceil(container.scrollHeight) : document.body.scrollHeight;
  safePostMessage({
    type: 'primeself-resize',
    height,
  });
}

function displayResults(data) {
  document.getElementById('resultType').textContent = data.type || 'Unknown';
  document.getElementById('resultStrategy').textContent = data.strategy || 'Unknown';
  document.getElementById('resultAuthority').textContent = data.authority || 'Unknown';
  document.getElementById('resultProfile').textContent = data.profile || 'Unknown';

  const gatesContainer = document.getElementById('resultGates');
  gatesContainer.innerHTML = '';

  if (data.gates && data.gates.length > 0) {
    data.gates.forEach(gate => {
      const badge = document.createElement('div');
      badge.className = 'gate-badge';
      badge.textContent = gate;
      gatesContainer.appendChild(badge);
    });
  } else {
    gatesContainer.innerHTML = '<p style="color: var(--text-dim); font-size: 14px;">No defined gates</p>';
  }

  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('resultsState').classList.remove('hidden');
  notifyResize();
}

function showError(message) {
  document.getElementById('errorState').textContent = message;
  document.getElementById('errorState').classList.remove('hidden');
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('calculatorForm').classList.remove('hidden');
  notifyResize();
}

function openFullChart() {
  const birthdate = document.getElementById('birthdate').value;
  const birthtime = document.getElementById('birthtime').value;
  const location = document.getElementById('location').value;

  const params = new URLSearchParams({
    birthdate,
    birthtime,
    location,
    source: 'embed',
  });

  const fullChartUrl = `https://primeself.app/?${params.toString()}`;

  if (window.parent !== window && parentOrigin) {
    safePostMessage({
      type: 'primeself-open-chart',
      url: fullChartUrl,
    });
  } else {
    window.open(fullChartUrl, '_blank', 'noopener');
  }
}

document.getElementById('calculatorForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const birthdate = document.getElementById('birthdate').value;
  const birthtime = document.getElementById('birthtime').value || '12:00';
  const location = document.getElementById('location').value;

  if (!birthdate || !location) {
    showError('Please fill in all required fields');
    return;
  }

  document.getElementById('calculatorForm').classList.add('hidden');
  document.getElementById('resultsState').classList.add('hidden');
  document.getElementById('errorState').classList.add('hidden');
  document.getElementById('loadingState').classList.remove('hidden');

  try {
    const response = await fetch(`${apiEndpoint}/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        birthdate,
        birthtime,
        location,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to calculate chart');
    }

    const data = await response.json();
    window.chartData = data;
    displayResults(data);

    safePostMessage({
      type: 'primeself-chart-calculated',
      data,
    });

    notifyResize();
  } catch (error) {
    console.error('Chart calculation error:', error);
    safePostMessage({
      type: 'primeself-error',
      error: error.message,
    });
    showError('Unable to calculate chart. Please try again or check your internet connection.');
  }
});

document.getElementById('viewFullBtn').addEventListener('click', openFullChart);
window.addEventListener('load', notifyResize);
window.addEventListener('resize', notifyResize);