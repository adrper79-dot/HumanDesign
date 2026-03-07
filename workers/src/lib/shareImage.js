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
            fill="#48bb78" text-anchor="middle">${percentage}%</text>
      
      <!-- Match text -->
      <text x="600" y="450" font-family="Arial, sans-serif" font-size="42" font-weight="bold" 
            fill="#ffffff" text-anchor="middle">
        I'm ${percentage}% like
      </text>
      <text x="600" y="510" font-family="Arial, sans-serif" font-size="52" font-weight="bold" 
            fill="#fbbf24" text-anchor="middle">
        ${celebrity.name}
      </text>
      
      <!-- Bottom CTA -->
      <text x="600" y="580" font-family="Arial, sans-serif" font-size="24" 
            fill="#cbd5e0" text-anchor="middle">
        Discover your Human Design match → primeself.app
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
        Prime Self — Human Design
      </text>
      
      <!-- Title -->
      <text x="600" y="180" font-family="Arial, sans-serif" font-size="48" font-weight="bold" 
            fill="#fbbf24" text-anchor="middle">
        My Human Design
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
          ${type}
        </text>
        
        <!-- Profile -->
        <rect x="0" y="90" width="600" height="70" fill="#1e293b" rx="8"/>
        <text x="30" y="135" font-family="Arial, sans-serif" font-size="28" fill="#94a3b8">
          Profile:
        </text>
        <text x="550" y="135" font-family="Arial, sans-serif" font-size="32" font-weight="bold" 
              fill="#ffffff" text-anchor="end">
          ${profile}
        </text>
        
        <!-- Authority -->
        <rect x="0" y="180" width="600" height="70" fill="#1e293b" rx="8"/>
        <text x="30" y="225" font-family="Arial, sans-serif" font-size="28" fill="#94a3b8">
          Authority:
        </text>
        <text x="550" y="225" font-family="Arial, sans-serif" font-size="32" font-weight="bold" 
              fill="#ffffff" text-anchor="end">
          ${authority}
        </text>
      </g>
      
      <!-- CTA -->
      <text x="600" y="590" font-family="Arial, sans-serif" font-size="24" 
            fill="#cbd5e0" text-anchor="middle">
        Get your free Human Design chart → primeself.app
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
        Human Design
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
        Use code: ${referralCode}
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
        ${icon}
      </text>
      
      <!-- Achievement name -->
      <text x="600" y="420" font-family="Arial, sans-serif" font-size="48" font-weight="bold" 
            fill="${tierColor}" text-anchor="middle">
        ${name}
      </text>
      
      <!-- Points -->
      <text x="600" y="490" font-family="Arial, sans-serif" font-size="32" 
            fill="#ffffff" text-anchor="middle">
        +${points} points
      </text>
      
      <!-- Tier badge -->
      <rect x="520" y="510" width="160" height="50" fill="rgba(255,255,255,0.2)" rx="25"/>
      <text x="600" y="545" font-family="Arial, sans-serif" font-size="24" font-weight="bold" 
            fill="${tierColor}" text-anchor="middle" text-transform="uppercase">
        ${tier}
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
    'og:title': title || 'Prime Self — Human Design Intelligence',
    'og:description': description || 'Discover your unique Human Design chart and unlock your potential.',
    'og:image': imageUrl || defaultImage,
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:url': url || defaultUrl,
    'og:site_name': 'Prime Self',
    
    // Twitter Card
    'twitter:card': 'summary_large_image',
    'twitter:title': title || 'Prime Self — Human Design Intelligence',
    'twitter:description': description || 'Discover your unique Human Design chart and unlock your potential.',
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
      twitter: `I just discovered I'm ${percentage}% like ${celebrityName}! 🤯\n\nFind out which famous person matches YOUR Human Design:\n${baseUrl}/compare\n\n#HumanDesign #PrimeSelf`,
      facebook: `I'm ${percentage}% like ${celebrityName} according to my Human Design chart! This is wild.\n\nWant to see which celebrity you match? Check out Prime Self: ${baseUrl}`,
      linkedin: `Fascinating insights from my Human Design analysis: ${percentage}% match with ${celebrityName}.\n\nHuman Design reveals your unique energetic blueprint and decision-making strategy. Worth exploring: ${baseUrl}`,
      whatsapp: `🤯 I just found out I'm ${percentage}% like ${celebrityName} based on my Human Design!\n\nYou should try this: ${baseUrl}/compare`,
      email: {
        subject: `I'm ${percentage}% like ${celebrityName}!`,
        body: `Hey!\n\nI just discovered something really cool - my Human Design chart shows I'm ${percentage}% similar to ${celebrityName}.\n\nYou can get your own free chart and see which famous person you match at:\n${baseUrl}\n\nIt's pretty accurate and gave me some great insights about my strengths and decision-making style.\n\nLet me know what you get!`
      }
    },
    
    referral: {
      twitter: `Just discovered my Human Design and it's mind-blowing! 🌟\n\nGet your first month FREE with my code: ${referralCode}\n${refUrl}\n\n#HumanDesign #SelfDiscovery`,
      facebook: `I've been using Prime Self to understand my Human Design and it's been really insightful.\n\nIf you're curious about your unique blueprint, you can get your first month free with this link:\n${refUrl}\n\nUse code: ${referralCode}`,
      linkedin: `Highly recommend checking out Prime Self for Human Design insights.\n\nAs someone who's always looking for tools for self-awareness and better decision-making, this has been valuable.\n\nFirst month free: ${refUrl}`,
      whatsapp: `Hey! I've been using this app called Prime Self to learn about my Human Design.\n\nThought you might find it interesting - you can get your first month free:\n${refUrl}\n\nCode: ${referralCode}`,
      email: {
        subject: 'Thought you might find this interesting...',
        body: `Hi!\n\nI recently started using Prime Self to explore my Human Design chart, and it's given me some really valuable insights about how I make decisions and interact with the world.\n\nI thought you might find it interesting too. You can get your first month free with this link:\n${refUrl}\n\nJust use code ${referralCode} when you sign up.\n\nLet me know what you think!`
      }
    },
    
    achievement: {
      twitter: `Just unlocked "${achievementName}" on Prime Self! 🏆\n\nExploring my Human Design has been an amazing journey.\n\nStart yours: ${baseUrl}\n\n#HumanDesign #Achievement`,
      facebook: `Achievement unlocked: ${achievementName}! 🎉\n\nLoving my Human Design journey with Prime Self.\n\nCheck it out: ${baseUrl}`,
      linkedin: `Milestone reached: ${achievementName}\n\nContinuing to explore practical applications of Human Design for personal and professional growth.\n\n${baseUrl}`,
      whatsapp: `🏆 Just unlocked "${achievementName}" on Prime Self!\n\nThis Human Design stuff is actually pretty cool: ${baseUrl}`,
      email: {
        subject: 'Achievement unlocked! 🏆',
        body: `Just wanted to share - I unlocked "${achievementName}" on Prime Self today!\n\nI've been exploring my Human Design chart and it's been really eye-opening.\n\nIf you're interested in self-discovery tools, check it out:\n${baseUrl}`
      }
    },
    
    chart: {
      twitter: `Just got my Human Design chart! I'm a ${chartType}. 🌟\n\nThis explains SO much about how I operate.\n\nGet your free chart: ${baseUrl}\n\n#HumanDesign`,
      facebook: `Interesting! My Human Design type is ${chartType}.\n\nThe insights about my decision-making strategy and interaction style are spot-on.\n\nGet your free chart: ${baseUrl}`,
      linkedin: `Explored my Human Design chart today. Type: ${chartType}.\n\nFascinating framework for understanding personal strengths and optimal decision-making approaches.\n\n${baseUrl}`,
      whatsapp: `Just discovered I'm a ${chartType} in Human Design!\n\nYou should get your chart, it's free: ${baseUrl}`,
      email: {
        subject: 'Check out my Human Design chart!',
        body: `Hey!\n\nI just got my Human Design chart and found out I'm a ${chartType}.\n\nIt's given me some really helpful insights about how I make decisions and where my energy comes from.\n\nYou can get your free chart here:\n${baseUrl}\n\nLet me know what type you are!`
      }
    }
  };
  
  return messages[type] || messages.chart;
}
