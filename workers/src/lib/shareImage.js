/**
 * Share Image Generation — Create shareable social media images
 * 
 * Generates PNG images for:
 * - Celebrity match results ("I'm 78% like Steve Jobs!")
 * - Chart summaries (Type, Profile, Authority)
 * - Profile highlights (Savannah narrative excerpts)
 * - Referral invites ("Join me on Prime Self")
 * 
 * Uses HTML Canvas API with WASM compilation for Cloudflare Workers
 */

// BL-FIX: Escape user input for safe SVG text interpolation
function escapeXml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate celebrity match share image
 * @param {Object} match - Celebrity match data
 * @param {Object} userChart - User's chart summary
 * @returns {string} Base64 encoded PNG data URL
 */
export function generateCelebrityMatchImage(match, userChart) {
  const { celebrity, similarity } = match;
  const percentage = similarity.percentage;
  
  // SVG template for social sharing (1200x630 OG image standard)
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <!-- Background gradient -->
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Background -->
      <rect width="1200" height="630" fill="url(#bg)"/>
      
      <!-- Brand -->
      <text x="60" y="80" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff">
        Prime Self
      </text>
      
      <!-- Percentage circle -->
      <circle cx="600" cy="280" r="120" fill="none" stroke="#4a5568" stroke-width="8"/>
      <circle cx="600" cy="280" r="120" fill="none" stroke="#48bb78" stroke-width="8"
              stroke-dasharray="${(percentage / 100) * 754} 754" 
              transform="rotate(-90 600 280)" filter="url(#glow)"/>
      <text x="600" y="300" font-family="Arial, sans-serif" font-size="72" font-weight="bold" 
            fill="#48bb78" text-anchor="middle">${escapeXml(percentage)}%</text>
      
      <!-- Match text -->
      <text x="600" y="450" font-family="Arial, sans-serif" font-size="42" font-weight="bold" 
            fill="#ffffff" text-anchor="middle">
        I'm ${escapeXml(percentage)}% like
      </text>
      <text x="600" y="510" font-family="Arial, sans-serif" font-size="52" font-weight="bold" 
            fill="#fbbf24" text-anchor="middle">
        ${escapeXml(celebrity.name)}
      </text>
      
      <!-- Bottom CTA -->
      <text x="600" y="580" font-family="Arial, sans-serif" font-size="24" 
            fill="#cbd5e0" text-anchor="middle">
        Discover your energy blueprint match → primeself.app
      </text>
    </svg>
  `;
  
  // Return data URL (frontend can render SVG or convert to PNG)
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Generate chart summary share image
 * @param {Object} chart - User's chart data
 * @returns {string} Base64 encoded SVG data URL
 */
export function generateChartShareImage(chart) {
  const { type, profile, authority, definition } = chart;
  
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chartBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <rect width="1200" height="630" fill="url(#chartBg)"/>
      
      <!-- Brand -->
      <text x="60" y="80" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff">
        Prime Self — Energy Blueprint
      </text>
      
      <!-- Title -->
      <text x="600" y="180" font-family="Arial, sans-serif" font-size="48" font-weight="bold" 
            fill="#fbbf24" text-anchor="middle">
        My Energy Blueprint
      </text>
      
      <!-- Chart details -->
      <g transform="translate(300, 250)">
        <!-- Type -->
        <rect x="0" y="0" width="600" height="70" fill="#1e293b" rx="8"/>
        <text x="30" y="45" font-family="Arial, sans-serif" font-size="28" fill="#94a3b8">
          Type:
        </text>
        <text x="550" y="45" font-family="Arial, sans-serif" font-size="32" font-weight="bold" 
              fill="#ffffff" text-anchor="end">
          ${escapeXml(type)}
        </text>
        
        <!-- Profile -->
        <rect x="0" y="90" width="600" height="70" fill="#1e293b" rx="8"/>
        <text x="30" y="135" font-family="Arial, sans-serif" font-size="28" fill="#94a3b8">
          Profile:
        </text>
        <text x="550" y="135" font-family="Arial, sans-serif" font-size="32" font-weight="bold" 
              fill="#ffffff" text-anchor="end">
          ${escapeXml(profile)}
        </text>
        
        <!-- Authority -->
        <rect x="0" y="180" width="600" height="70" fill="#1e293b" rx="8"/>
        <text x="30" y="225" font-family="Arial, sans-serif" font-size="28" fill="#94a3b8">
          Authority:
        </text>
        <text x="550" y="225" font-family="Arial, sans-serif" font-size="32" font-weight="bold" 
              fill="#ffffff" text-anchor="end">
          ${escapeXml(authority)}
        </text>
      </g>
      
      <!-- CTA -->
      <text x="600" y="590" font-family="Arial, sans-serif" font-size="24" 
            fill="#cbd5e0" text-anchor="middle">
        Get your free energy blueprint → primeself.app
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Generate referral invite image
 * @param {Object} referrer - Referrer user data
 * @param {string} referralCode - Referral code
 * @returns {string} Base64 encoded SVG data URL
 */
export function generateReferralInviteImage(referrer, referralCode) {
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="refBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <rect width="1200" height="630" fill="url(#refBg)"/>
      
      <!-- Brand -->
      <text x="60" y="80" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#ffffff">
        Prime Self
      </text>
      
      <!-- Main message -->
      <text x="600" y="250" font-family="Arial, sans-serif" font-size="56" font-weight="bold" 
            fill="#ffffff" text-anchor="middle">
        Discover Your
      </text>
      <text x="600" y="320" font-family="Arial, sans-serif" font-size="56" font-weight="bold" 
            fill="#fbbf24" text-anchor="middle">
        Energy Blueprint
      </text>
      
      <!-- Offer -->
      <rect x="350" y="370" width="500" height="80" fill="rgba(255,255,255,0.2)" rx="12"/>
      <text x="600" y="425" font-family="Arial, sans-serif" font-size="38" font-weight="bold" 
            fill="#ffffff" text-anchor="middle">
        First Month FREE
      </text>
      
      <!-- Referral code -->
      <text x="600" y="520" font-family="Arial, sans-serif" font-size="28" 
            fill="#e0e7ff" text-anchor="middle">
        Use code: ${escapeXml(referralCode)}
      </text>
      
      <!-- CTA -->
      <text x="600" y="590" font-family="Arial, sans-serif" font-size="26" 
            fill="#ffffff" text-anchor="middle">
        Join me on primeself.app
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Generate achievement unlock share image
 * @param {Object} achievement - Achievement data
 * @returns {string} Base64 encoded SVG data URL
 */
export function generateAchievementShareImage(achievement) {
  const { name, icon, tier, points } = achievement;
  
  const tierColors = {
    bronze: '#cd7f32',
    silver: '#c0c0c0',
    gold: '#ffd700',
    platinum: '#e5e4e2'
  };
  
  const tierColor = tierColors[tier] || '#fbbf24';
  
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="achBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0c4a6e;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#075985;stop-opacity:1" />
        </linearGradient>
        <filter id="shine">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <rect width="1200" height="630" fill="url(#achBg)"/>
      
      <!-- Brand -->
      <text x="60" y="80" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff">
        Prime Self
      </text>
      
      <!-- Achievement unlocked banner -->
      <text x="600" y="160" font-family="Arial, sans-serif" font-size="36" 
            fill="#cbd5e0" text-anchor="middle">
        Achievement Unlocked!
      </text>
      
      <!-- Icon (emoji) -->
      <text x="600" y="320" font-family="Arial, sans-serif" font-size="120" 
            text-anchor="middle" filter="url(#shine)">
        ${escapeXml(icon)}
      </text>
      
      <!-- Achievement name -->
      <text x="600" y="420" font-family="Arial, sans-serif" font-size="48" font-weight="bold" 
            fill="${tierColor}" text-anchor="middle">
        ${escapeXml(name)}
      </text>
      
      <!-- Points -->
      <text x="600" y="490" font-family="Arial, sans-serif" font-size="32" 
            fill="#ffffff" text-anchor="middle">
        +${escapeXml(points)} points
      </text>
      
      <!-- Tier badge -->
      <rect x="520" y="510" width="160" height="50" fill="rgba(255,255,255,0.2)" rx="25"/>
      <text x="600" y="545" font-family="Arial, sans-serif" font-size="24" font-weight="bold" 
            fill="${tierColor}" text-anchor="middle" text-transform="uppercase">
        ${escapeXml(tier)}
      </text>
      
      <!-- CTA -->
      <text x="600" y="600" font-family="Arial, sans-serif" font-size="24" 
            fill="#cbd5e0" text-anchor="middle">
        Start your journey → primeself.app
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Generate per-practitioner OG image (1200×630 SVG)
 * @param {Object} practitioner - Practitioner directory record
 * @returns {string} Raw SVG XML (serve as image/svg+xml)
 */
export function generatePractitionerOGImage(practitioner) {
  const name = escapeXml(practitioner.display_name || 'Prime Self Practitioner');
  const bio = escapeXml((practitioner.bio || '').substring(0, 110));
  const specializations = Array.isArray(practitioner.specializations) ? practitioner.specializations : [];
  const specialty = escapeXml(specializations.slice(0, 3).join(' · ') || 'Human Design Practitioner');
  const cert = escapeXml(practitioner.certification || '');
  const certBadge = cert ? `<text x="60" y="578" font-family="Arial,sans-serif" font-size="20" fill="#a78bfa">${cert}</text>` : '';

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f0f1a;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#1a1040;stop-opacity:1"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#a78bfa;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <!-- Left accent bar -->
  <rect x="0" y="0" width="6" height="630" fill="url(#accent)"/>
  <!-- Top label -->
  <text x="60" y="70" font-family="Arial,sans-serif" font-size="22" font-weight="bold" fill="#7c3aed" letter-spacing="3">PRIME SELF PRACTITIONER</text>
  <!-- Practitioner name -->
  <text x="60" y="200" font-family="Arial,sans-serif" font-size="72" font-weight="bold" fill="#ffffff">${name}</text>
  <!-- Specialty pills row -->
  <text x="60" y="270" font-family="Arial,sans-serif" font-size="28" fill="#a78bfa">${specialty}</text>
  <!-- Divider line -->
  <line x1="60" y1="310" x2="1140" y2="310" stroke="#7c3aed" stroke-width="1" stroke-opacity="0.4"/>
  <!-- Bio text (truncated) -->
  <text x="60" y="360" font-family="Arial,sans-serif" font-size="26" fill="#cbd5e0">${bio}</text>
  <!-- Certification badge -->
  ${certBadge}
  <!-- Bottom branding -->
  <text x="1140" y="578" font-family="Arial,sans-serif" font-size="22" fill="#4a5568" text-anchor="end">selfprime.net</text>
  <!-- Decorative circle -->
  <circle cx="1080" cy="180" r="200" fill="none" stroke="#7c3aed" stroke-width="1" stroke-opacity="0.15"/>
  <circle cx="1080" cy="180" r="140" fill="none" stroke="#a78bfa" stroke-width="1" stroke-opacity="0.1"/>
</svg>`;
}

// ── Item 4.4: Social Share Platform Templates ──────────────────────────────

/**
 * Build a URL with UTM tracking parameters.
 * @param {string} baseUrl  - e.g. 'https://selfprime.net'
 * @param {string} utmSource - e.g. 'twitter'
 * @param {string} utmCampaign - e.g. 'chart_share'
 * @param {string} [path=''] - Optional path suffix
 * @returns {string}
 */
export function buildShareUrl(baseUrl, utmSource, utmCampaign, path = '') {
  const url = baseUrl + path;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}utm_source=${encodeURIComponent(utmSource)}&utm_medium=social&utm_campaign=${encodeURIComponent(utmCampaign)}`;
}

/**
 * Generate transit weather share image (1200×630).
 * @param {Object} data - { date, sunGate, moonGate, dominant, theme, energy }
 */
export function generateTransitWeatherImage(data) {
  const date = escapeXml(data?.date || new Date().toLocaleDateString());
  const dominant = escapeXml((data?.dominant || 'Transit Energy').substring(0, 60));
  const theme = escapeXml((data?.theme || '').substring(0, 80));
  const sunGate = escapeXml(String(data?.sunGate || ''));
  const moonGate = escapeXml(String(data?.moonGate || ''));

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0c0c1a;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#0f2040;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#tbg)"/>
  <rect x="0" y="0" width="6" height="630" fill="#3b82f6"/>
  <text x="60" y="70" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#3b82f6" letter-spacing="3">TRANSIT WEATHER — PRIME SELF</text>
  <text x="60" y="150" font-family="Arial,sans-serif" font-size="28" fill="#93c5fd">${date}</text>
  <text x="60" y="240" font-family="Arial,sans-serif" font-size="64" font-weight="bold" fill="#ffffff">${dominant}</text>
  <text x="60" y="310" font-family="Arial,sans-serif" font-size="28" fill="#93c5fd">${theme}</text>
  <line x1="60" y1="350" x2="1140" y2="350" stroke="#3b82f6" stroke-width="1" stroke-opacity="0.4"/>
  <text x="60" y="410" font-family="Arial,sans-serif" font-size="24" fill="#cbd5e0">☀ Sun: Gate ${sunGate}</text>
  <text x="300" y="410" font-family="Arial,sans-serif" font-size="24" fill="#cbd5e0">☽ Moon: Gate ${moonGate}</text>
  <text x="1140" y="600" font-family="Arial,sans-serif" font-size="20" fill="#4a5568" text-anchor="end">selfprime.net</text>
  <circle cx="1050" cy="200" r="180" fill="none" stroke="#3b82f6" stroke-width="1" stroke-opacity="0.12"/>
</svg>`;
}

/**
 * Generate session summary share image (1200×630).
 * @param {Object} data - { practitionerName, sessionDate, themes, insight }
 */
export function generateSessionSummaryImage(data) {
  const prac = escapeXml((data?.practitionerName || 'Your Practitioner').substring(0, 50));
  const sessionDate = escapeXml(data?.sessionDate || new Date().toLocaleDateString());
  const themes = Array.isArray(data?.themes) ? data.themes.slice(0, 3).map(escapeXml).join(' · ') : '';
  const insight = escapeXml((data?.insight || '').substring(0, 100));

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f0f1a;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#1a2040;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#sbg)"/>
  <rect x="0" y="0" width="6" height="630" fill="#10b981"/>
  <text x="60" y="70" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#10b981" letter-spacing="3">SESSION SUMMARY — PRIME SELF</text>
  <text x="60" y="170" font-family="Arial,sans-serif" font-size="52" font-weight="bold" fill="#ffffff">Session with ${prac}</text>
  <text x="60" y="230" font-family="Arial,sans-serif" font-size="26" fill="#6ee7b7">${sessionDate}</text>
  <line x1="60" y1="260" x2="1140" y2="260" stroke="#10b981" stroke-width="1" stroke-opacity="0.4"/>
  <text x="60" y="320" font-family="Arial,sans-serif" font-size="24" fill="#a7f3d0">Themes: ${themes}</text>
  <text x="60" y="390" font-family="Arial,sans-serif" font-size="26" fill="#e2e8f0">${insight}</text>
  <text x="1140" y="600" font-family="Arial,sans-serif" font-size="20" fill="#4a5568" text-anchor="end">selfprime.net</text>
</svg>`;
}

/**
 * Generate reading summary share image (1200×630).
 * @param {Object} data - { readingType, clientName, keyTheme, guidance }
 */
export function generateReadingSummaryImage(data) {
  const readingType = escapeXml((data?.readingType || 'Reading').substring(0, 40));
  const keyTheme = escapeXml((data?.keyTheme || '').substring(0, 60));
  const guidance = escapeXml((data?.guidance || '').substring(0, 110));

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="rbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#130a1a;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#1a0f30;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#rbg)"/>
  <rect x="0" y="0" width="6" height="630" fill="#a78bfa"/>
  <text x="60" y="70" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#a78bfa" letter-spacing="3">READING SUMMARY — PRIME SELF</text>
  <text x="60" y="170" font-family="Arial,sans-serif" font-size="56" font-weight="bold" fill="#ffffff">${readingType}</text>
  <text x="60" y="250" font-family="Arial,sans-serif" font-size="32" fill="#c4b5fd">${keyTheme}</text>
  <line x1="60" y1="285" x2="1140" y2="285" stroke="#a78bfa" stroke-width="1" stroke-opacity="0.4"/>
  <text x="60" y="360" font-family="Arial,sans-serif" font-size="26" fill="#e2e8f0">${guidance}</text>
  <text x="1140" y="600" font-family="Arial,sans-serif" font-size="20" fill="#4a5568" text-anchor="end">selfprime.net</text>
  <circle cx="1050" cy="200" r="160" fill="none" stroke="#a78bfa" stroke-width="1" stroke-opacity="0.1"/>
</svg>`;
}

/**
 * Generate compatibility summary share image (1200×630).
 * @param {Object} data - { person1: {name, type}, person2: {name, type}, score, channels }
 */
export function generateCompatibilityImage(data) {
  const name1 = escapeXml((data?.person1?.name || 'Person 1').substring(0, 30));
  const name2 = escapeXml((data?.person2?.name || 'Person 2').substring(0, 30));
  const type1 = escapeXml(data?.person1?.type || '');
  const type2 = escapeXml(data?.person2?.type || '');
  const score = escapeXml(String(data?.score || ''));
  const channels = Array.isArray(data?.channels) ? data.channels.slice(0, 4).join(' · ') : '';

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f0a1a;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#1a1030;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#cbg)"/>
  <rect x="0" y="0" width="6" height="630" fill="#f59e0b"/>
  <text x="60" y="70" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#f59e0b" letter-spacing="3">COMPATIBILITY — PRIME SELF</text>
  <text x="60" y="180" font-family="Arial,sans-serif" font-size="54" font-weight="bold" fill="#ffffff">${name1}</text>
  <text x="60" y="240" font-family="Arial,sans-serif" font-size="28" fill="#fcd34d">${type1}</text>
  <text x="600" y="180" font-family="Arial,sans-serif" font-size="54" font-weight="bold" fill="#ffffff" text-anchor="middle">✦</text>
  <text x="1140" y="180" font-family="Arial,sans-serif" font-size="54" font-weight="bold" fill="#ffffff" text-anchor="end">${name2}</text>
  <text x="1140" y="240" font-family="Arial,sans-serif" font-size="28" fill="#fcd34d" text-anchor="end">${type2}</text>
  ${score ? `<text x="600" y="360" font-family="Arial,sans-serif" font-size="80" font-weight="bold" fill="#f59e0b" text-anchor="middle">${score}%</text>` : ''}
  <line x1="60" y1="420" x2="1140" y2="420" stroke="#f59e0b" stroke-width="1" stroke-opacity="0.4"/>
  <text x="600" y="470" font-family="Arial,sans-serif" font-size="22" fill="#fde68a" text-anchor="middle">${escapeXml(channels)}</text>
  <text x="1140" y="600" font-family="Arial,sans-serif" font-size="20" fill="#4a5568" text-anchor="end">selfprime.net</text>
</svg>`;
}

/**
 * Generate gift announcement share image (1200×630).
 * @param {Object} data - { recipientName, gifterName, plan, message }
 */
export function generateGiftImage(data) {
  const recipient = escapeXml((data?.recipientName || 'Someone Special').substring(0, 40));
  const gifter = escapeXml((data?.gifterName || '').substring(0, 40));
  const plan = escapeXml((data?.plan || 'Prime Self').substring(0, 40));
  const message = escapeXml((data?.message || '').substring(0, 100));

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f0f1a;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#1a1a10;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#gbg)"/>
  <rect x="0" y="0" width="6" height="630" fill="#ec4899"/>
  <text x="60" y="70" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#ec4899" letter-spacing="3">GIFT — PRIME SELF</text>
  <text x="60" y="180" font-family="Arial,sans-serif" font-size="36" fill="#f9a8d4">🎁 A gift for</text>
  <text x="60" y="260" font-family="Arial,sans-serif" font-size="64" font-weight="bold" fill="#ffffff">${recipient}</text>
  <text x="60" y="330" font-family="Arial,sans-serif" font-size="28" fill="#f9a8d4">From ${gifter}</text>
  <line x1="60" y1="370" x2="1140" y2="370" stroke="#ec4899" stroke-width="1" stroke-opacity="0.4"/>
  <text x="60" y="430" font-family="Arial,sans-serif" font-size="30" fill="#e2e8f0">${plan}</text>
  <text x="60" y="490" font-family="Arial,sans-serif" font-size="24" fill="#cbd5e0">${message}</text>
  <text x="1140" y="600" font-family="Arial,sans-serif" font-size="20" fill="#4a5568" text-anchor="end">selfprime.net</text>
</svg>`;
}

/**
 * Generate social share metadata (OG tags)
 * @param {Object} params - Share parameters
 * @returns {Object} Meta tags for HTML head
 */
export function generateShareMetadata(params) {
  const { type, title, description, imageUrl, url } = params;
  
  const defaultImage = 'https://primeself.app/og-default.png';
  const defaultUrl = 'https://primeself.app';
  
  return {
    // Open Graph
    'og:type': type || 'website',
    'og:title': title || 'Prime Self — Energy Blueprint Intelligence',
    'og:description': description || 'Discover your unique energy blueprint and unlock your potential.',
    'og:image': imageUrl || defaultImage,
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:url': url || defaultUrl,
    'og:site_name': 'Prime Self',
    
    // Twitter Card
    'twitter:card': 'summary_large_image',
    'twitter:title': title || 'Prime Self — Energy Blueprint Intelligence',
    'twitter:description': description || 'Discover your unique energy blueprint and unlock your potential.',
    'twitter:image': imageUrl || defaultImage,
    'twitter:site': '@primeself',
    'twitter:creator': '@primeself'
  };
}

/**
 * Get pre-filled share messages for social platforms
 * @param {Object} shareData - Data to share
 * @returns {Object} Platform-specific share messages
 */
export function getShareMessages(shareData) {
  const { type, celebrityName, percentage, referralCode, achievementName, chartType } = shareData;
  
  const baseUrl = 'https://primeself.app';
  const refUrl = referralCode ? `${baseUrl}/signup?ref=${referralCode}` : baseUrl;
  
  const messages = {
    celebrity: {
      twitter: `I just discovered I'm ${percentage}% like ${celebrityName}! 🤯\n\nFind out which famous person matches YOUR energy blueprint:\n${baseUrl}/compare\n\n#PrimeSelf #EnergyBlueprint`,
      facebook: `I'm ${percentage}% like ${celebrityName} according to my energy blueprint! This is wild.\n\nWant to see which celebrity you match? Check out Prime Self: ${baseUrl}`,
      linkedin: `Fascinating insights from my energy blueprint analysis: ${percentage}% match with ${celebrityName}.\n\nPrime Self reveals your unique energetic blueprint and decision-making strategy. Worth exploring: ${baseUrl}`,
      whatsapp: `🤯 I just found out I'm ${percentage}% like ${celebrityName} based on my energy blueprint!\n\nYou should try this: ${baseUrl}/compare`,
      email: {
        subject: `I'm ${percentage}% like ${celebrityName}!`,
        body: `Hey!\n\nI just discovered something really cool - my energy blueprint shows I'm ${percentage}% similar to ${celebrityName}.\n\nYou can get your own free chart and see which famous person you match at:\n${baseUrl}\n\nIt's pretty accurate and gave me some great insights about my strengths and decision-making style.\n\nLet me know what you get!`
      }
    },
    
    referral: {
      twitter: `Just discovered my energy blueprint and it's mind-blowing! 🌟\n\nGet your first month FREE with my code: ${referralCode}\n${refUrl}\n\n#PrimeSelf #SelfDiscovery`,
      facebook: `I've been using Prime Self to understand my energy blueprint and it's been really insightful.\n\nIf you're curious about your unique blueprint, you can get your first month free with this link:\n${refUrl}\n\nUse code: ${referralCode}`,
      linkedin: `Highly recommend checking out Prime Self for energy blueprint insights.\n\nAs someone who's always looking for tools for self-awareness and better decision-making, this has been valuable.\n\nFirst month free: ${refUrl}`,
      whatsapp: `Hey! I've been using this app called Prime Self to learn about my energy blueprint.\n\nThought you might find it interesting - you can get your first month free:\n${refUrl}\n\nCode: ${referralCode}`,
      email: {
        subject: 'Thought you might find this interesting...',
        body: `Hi!\n\nI recently started using Prime Self to explore my energy blueprint, and it's given me some really valuable insights about how I make decisions and interact with the world.\n\nI thought you might find it interesting too. You can get your first month free with this link:\n${refUrl}\n\nJust use code ${referralCode} when you sign up.\n\nLet me know what you think!`
      }
    },
    
    achievement: {
      twitter: `Just unlocked "${achievementName}" on Prime Self! 🏆\n\nExploring my energy blueprint has been an amazing journey.\n\nStart yours: ${baseUrl}\n\n#PrimeSelf #Achievement`,
      facebook: `Achievement unlocked: ${achievementName}! 🎉\n\nLoving my energy blueprint journey with Prime Self.\n\nCheck it out: ${baseUrl}`,
      linkedin: `Milestone reached: ${achievementName}\n\nContinuing to explore practical applications of energy blueprints for personal and professional growth.\n\n${baseUrl}`,
      whatsapp: `🏆 Just unlocked "${achievementName}" on Prime Self!\n\nThis energy blueprint stuff is actually pretty cool: ${baseUrl}`,
      email: {
        subject: 'Achievement unlocked! 🏆',
        body: `Just wanted to share - I unlocked "${achievementName}" on Prime Self today!\n\nI've been exploring my energy blueprint and it's been really eye-opening.\n\nIf you're interested in self-discovery tools, check it out:\n${baseUrl}`
      }
    },
    
    chart: {
      twitter: `Just got my energy blueprint! I'm a ${chartType}. 🌟\n\nThis explains SO much about how I operate.\n\nGet your free chart: ${baseUrl}\n\n#PrimeSelf`,
      facebook: `Interesting! My energy type is ${chartType}.\n\nThe insights about my decision-making strategy and interaction style are spot-on.\n\nGet your free chart: ${baseUrl}`,
      linkedin: `Explored my energy blueprint today. Type: ${chartType}.\n\nFascinating framework for understanding personal strengths and optimal decision-making approaches.\n\n${baseUrl}`,
      whatsapp: `Just discovered I'm a ${chartType} in my energy blueprint!\n\nYou should get your chart, it's free: ${baseUrl}`,
      email: {
        subject: 'Check out my energy blueprint!',
        body: `Hey!\n\nI just got my energy blueprint and found out I'm a ${chartType}.\n\nIt's given me some really helpful insights about how I make decisions and where my energy comes from.\n\nYou can get your free chart here:\n${baseUrl}\n\nLet me know what type you are!`
      }
    }
  };
  
  return messages[type] || messages.chart;
}
