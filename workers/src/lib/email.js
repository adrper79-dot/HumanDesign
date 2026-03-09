/**
 * Email Client Wrapper (BL-ENG-007)
 * 
 * Integrates with Resend API for transactional email campaigns:
 * - Welcome series (4 emails over 7 days)
 * - Re-engagement (inactive users)
 * - Upgrade nudges (free → paid conversion)
 * 
 * Resend API: https://resend.com/docs/api-reference/emails/send-email
 * 
 * Environment Variables:
 *   RESEND_API_KEY - Resend API key (re_xxxxx)
 *   FROM_EMAIL - Sender email (e.g., "Prime Self <hello@primeself.app>")
 */

/**
 * Send email via Resend API
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject line
 * @param {string} options.html - HTML email body
 * @param {string} options.text - Plain text fallback (optional)
 * @param {string} options.replyTo - Reply-to email (optional)
 * @param {string} apiKey - Resend API key
 * @param {string} fromEmail - From email address
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function sendEmail({ to, subject, html, text = '', replyTo = '' }, apiKey, fromEmail) {
  if (!apiKey) {
    console.warn('RESEND_API_KEY not configured, skipping email send');
    return { success: false, error: 'Email service not configured' };
  }

  // BL-FIX: Replace {{unsubscribe_url}} placeholder with a real URL
  const unsubscribeUrl = `https://primeself.app/?action=email-unsubscribe&email=${encodeURIComponent(to)}`;
  const finalHtml = html.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail || 'Prime Self <hello@primeself.app>',
        to: [to],
        subject,
        html: finalHtml,
        text: text || stripHtml(finalHtml),
        reply_to: replyTo || undefined
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return { success: false, error: data.message || 'Email send failed' };
    }

    return { success: true, id: data.id };

  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send Welcome Email #1 - Immediately after signup
 * Subject: "Welcome to Prime Self 🌟 Let's generate your chart"
 */
export async function sendWelcomeEmail1(userEmail, userName, apiKey, fromEmail) {
  const subject = "Welcome to Prime Self 🌟 Let's generate your chart";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #C9A84C; }
    .logo { font-size: 24px; font-weight: 700; color: #C9A84C; }
    .content { padding: 30px 0; }
    .cta { background: linear-gradient(135deg, #C9A84C 0%, #6A4FC8 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: 600; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 12px; color: #666; }
    .tips { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C9A84C; }
    .tips h3 { margin-top: 0; color: #C9A84C; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Prime Self</div>
  </div>
  
  <div class="content">
    <h2>Welcome, ${userName || 'Explorer'}! 👋</h2>
    
    <p>You just took the first step on a profound journey of self-discovery. Prime Self combines Human Design, astrology, and numerology to give you a complete picture of who you are.</p>
    
    <p>Ready to see your unique energetic blueprint?</p>
    
    <a href="https://primeself.app" class="cta">Generate Your Chart →</a>
    
    <div class="tips">
      <h3>What to expect:</h3>
      <ul>
        <li><strong>Your Human Design Chart</strong> - Discover your Energy Type, Decision Strategy, and Authority</li>
        <li><strong>AI Synthesis Report</strong> - Get a personalized 2000+ word analysis connecting all your systems</li>
        <li><strong>Transit Insights</strong> - See how current planetary movements affect your energy</li>
        <li><strong>Daily Check-In</strong> - Track alignment with your design over time</li>
      </ul>
    </div>
    
    <p><strong>Pro tip:</strong> Have your birth time ready. The more accurate your birth time, the more precise your chart will be. Don't know your exact time? Try our birth time rectification tool!</p>
    
    <p>Questions? Just reply to this email - we're here to help.</p>
    
    <p>See you inside,<br>
    <strong>The Prime Self Team</strong></p>
  </div>
  
  <div class="footer">
    <p>You're receiving this email because you signed up for Prime Self.</p>
    <p><a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="https://primeself.app">View in browser</a></p>
  </div>
</body>
</html>
  `;

  return await sendEmail({ to: userEmail, subject, html }, apiKey, fromEmail);
}

/**
 * Send Welcome Email #2 - 24 hours after signup
 * Subject: "Understanding your unique pattern"
 */
export async function sendWelcomeEmail2(userEmail, userName, chartType, apiKey, fromEmail) {
  const subject = `${userName}, understanding your ${chartType || 'unique'} pattern`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #C9A84C; }
    .logo { font-size: 24px; font-weight: 700; color: #C9A84C; }
    .content { padding: 30px 0; }
    .cta { background: linear-gradient(135deg, #C9A84C 0%, #6A4FC8 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: 600; }
    .highlight { background: #FFF9E5; padding: 20px; border-radius: 8px; border-left: 4px solid #C9A84C; margin: 20px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Prime Self</div>
  </div>
  
  <div class="content">
    <h2>Your ${chartType || 'Energy'} blueprint explained</h2>
    
    <p>Hey ${userName || 'there'},</p>
    
    <p>Yesterday you generated your chart. Today, let's dive deeper into what it means.</p>
    
    ${chartType === 'Generator' ? `
    <div class="highlight">
      <h3>As a Generator, you:</h3>
      <ul>
        <li>Have sustainable life force energy when doing what lights you up</li>
        <li>Make best decisions by waiting to respond (not initiating)</li>
        <li>Know the answer through gut feelings (Sacral response)</li>
        <li>Build mastery through repetition and commitment</li>
      </ul>
      <p><strong>This week:</strong> Notice what you're genuinely excited to respond to. That's your Sacral saying YES.</p>
    </div>
    ` : chartType === 'Projector' ? `
    <div class="highlight">
      <h3>As a Projector, you:</h3>
      <ul>
        <li>Are designed to guide and direct others' energy</li>
        <li>Make best decisions when recognized and invited</li>
        <li>Need rest and alone time to recharge (non-energy type)</li>
        <li>See things others miss - your gift is wisdom</li>
      </ul>
      <p><strong>This week:</strong> Practice waiting for invitations before offering advice. Watch how people respond differently.</p>
    </div>
    ` : chartType === 'Manifestor' ? `
    <div class="highlight">
      <h3>As a Manifestor, you:</h3>
      <ul>
        <li>Are designed to initiate and make things happen</li>
        <li>Make best decisions by informing before acting</li>
        <li>Work in bursts of energy (not sustainable like Generators)</li>
        <li>Create impact and change when you follow your urges</li>
      </ul>
      <p><strong>This week:</strong> Before making a move, inform the people it affects. Notice how resistance melts.</p>
    </div>
    ` : chartType === 'Reflector' ? `
    <div class="highlight">
      <h3>As a Reflector, you:</h3>
      <ul>
        <li>Are designed to mirror and evaluate the health of your environment</li>
        <li>Make best decisions over a full lunar cycle (28 days)</li>
        <li>Are deeply connected to the moon's phases</li>
        <li>Sample and reflect energy - you're the rarest type (1%)</li>
      </ul>
      <p><strong>This week:</strong> Track the moon phases and notice how your energy shifts. You're lunar, not solar.</p>
    </div>
    ` : `
    <div class="highlight">
      <p>Your Human Design chart reveals your optimal decision-making strategy, energy patterns, and life purpose. Each element - from your Energy Type to your defined Centers - creates a unique blueprint.</p>
      <p><strong>This week:</strong> Read your full synthesis report and identify one pattern you recognize in your life.</p>
    </div>
    `}
    
    <a href="https://primeself.app" class="cta">Read Your Full Report →</a>
    
    <p>Tomorrow, I'll share how to use your Decision Strategy in real life.</p>
    
    <p>Exploring with you,<br>
    <strong>The Prime Self Team</strong></p>
  </div>
  
  <div class="footer">
    <p><a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="https://primeself.app">View in browser</a></p>
  </div>
</body>
</html>
  `;

  return await sendEmail({ to: userEmail, subject, html }, apiKey, fromEmail);
}

/**
 * Send Welcome Email #3 - 72 hours after signup
 * Subject: "How to use your Decision Strategy"
 */
export async function sendWelcomeEmail3(userEmail, userName, authority, apiKey, fromEmail) {
  const subject = "How to make decisions aligned with your design";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #C9A84C; }
    .logo { font-size: 24px; font-weight: 700; color: #C9A84C; }
    .content { padding: 30px 0; }
    .cta { background: linear-gradient(135deg, #C9A84C 0%, #6A4FC8 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: 600; }
    .authority-box { background: #F0E6FF; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 12px; color: #666; }
    .example { background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 15px 0; font-style: italic; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Prime Self</div>
  </div>
  
  <div class="content">
    <h2>Your ${authority || 'Inner'} Authority</h2>
    
    <p>Hi ${userName || 'there'},</p>
    
    <p>You know your energy type. Now let's talk about your decision-making superpower: <strong>${authority || 'your Authority'}</strong>.</p>
    
    <div class="authority-box">
      <h3>What is Authority?</h3>
      <p>Your Authority is your internal navigation system - the most reliable way for YOU to make correct decisions. Not what works for your friend, parent, or partner. What works for you.</p>
    </div>
    
    ${authority === 'Sacral' ? `
    <h3>Your Sacral Authority</h3>
    <p>You make best decisions by listening to your gut response - that immediate "uh-huh" (yes) or "uhn-uhn" (no) you feel in your belly.</p>
    
    <div class="example">
      <strong>Example:</strong> A friend asks you to grab coffee tomorrow. Your Sacral responds immediately with excitement (uh-huh!) or a flat "meh" (uhn-uhn). Trust that first response, not the mental story that comes after.
    </div>
    
    <p><strong>This week's experiment:</strong> Ask yourself yes/no questions out loud and listen for the Sacral sound. Practice with low-stakes decisions (what to eat, which route to drive).</p>
    ` : authority === 'Emotional' ? `
    <h3>Your Emotional Authority</h3>
    <p>You make best decisions by riding your emotional wave. Never decide in the high or low - wait for clarity over time.</p>
    
    <div class="example">
      <strong>Example:</strong> You get a job offer. Day 1: You're excited! Day 2: Doubts creep in. Day 3: Feels right again. Wait for clarity. If it's correct, you'll know with certainty after the wave.
    </div>
    
    <p><strong>This week's experiment:</strong> For any big decision, wait at least 24-48 hours. Notice how your emotional clarity shifts day by day.</p>
    ` : authority === 'Splenic' ? `
    <h3>Your Splenic Authority</h3>
    <p>You make best decisions through intuitive hits in the moment. Your body knows instantly - the challenge is trusting it.</p>
    
    <div class="example">
      <strong>Example:</strong> You're house hunting. You walk into one and immediately feel "no." Another one, before you even see the bedrooms, you feel "this is it." That's Splenic knowing.
    </div>
    
    <p><strong>This week's experiment:</strong> Practice trusting your first instinct. Don't second-guess or rationalize. Your Spleen speaks once.</p>
    ` : `
    <h3>Your ${authority || 'Unique'} Authority</h3>
    <p>Your decision-making process is unique to your design. Check your full synthesis report for detailed guidance on how to trust your inner authority.</p>
    `}
    
    <a href="https://primeself.app" class="cta">See Your Authority Details →</a>
    
    <p>Tomorrow, we'll explore how transits affect your energy this week.</p>
    
    <p>Trusting with you,<br>
    <strong>The Prime Self Team</strong></p>
  </div>
  
  <div class="footer">
    <p><a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="https://primeself.app">View in browser</a></p>
  </div>
</body>
</html>
  `;

  return await sendEmail({ to: userEmail, subject, html }, apiKey, fromEmail);
}

/**
 * Send Welcome Email #4 - 7 days after signup
 * Subject: "Try Transit Insights (your personalized forecast)"
 */
export async function sendWelcomeEmail4(userEmail, userName, apiKey, fromEmail) {
  const subject = "Your transits this week - what's activating in your chart?";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #C9A84C; }
    .logo { font-size: 24px; font-weight: 700; color: #C9A84C; }
    .content { padding: 30px 0; }
    .cta { background: linear-gradient(135deg, #C9A84C 0%, #6A4FC8 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: 600; }
    .feature-highlight { background: linear-gradient(135deg, rgba(201,168,76,0.1) 0%, rgba(106,79,200,0.1) 100%); padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Prime Self</div>
  </div>
  
  <div class="content">
    <h2>Transits: Your Cosmic Weather Report</h2>
    
    <p>Hey ${userName || 'there'},</p>
    
    <p>You've learned about your fixed design. Now let's explore what's changing: <strong>transits</strong>.</p>
    
    <p>Transits are the current planetary positions overlaid on your chart. They show you what energy is activating right now - think of it as your cosmic weather forecast.</p>
    
    <div class="feature-highlight">
      <h3>Why transits matter:</h3>
      <ul>
        <li><strong>Timing decisions:</strong> See when your gates are temporarily activated (great for important actions)</li>
        <li><strong>Understanding intensity:</strong> That emotional wave you're riding? Check if the moon is transiting your Solar Plexus</li>
        <li><strong>Planning ahead:</strong> See major transits 30 days out (Saturn return, anyone?)</li>
      </ul>
    </div>
    
    <p><strong>Try this:</strong> Check your transits page daily for a week. Notice how the energy in your life matches what's activating in your chart.</p>
    
    <a href="https://primeself.app/transits" class="cta">View Your Transits →</a>
    
    <p><strong>Bonus:</strong> Upgrade to Seeker tier to get weekly transit alerts. We'll email you when major planets activate important gates in your chart.</p>
    
    <p>That wraps our welcome series! You now have the foundations to work with your design. Keep exploring - there's always more to discover.</p>
    
    <p>Questions? Reply to this email anytime.</p>
    
    <p>Happy exploring,<br>
    <strong>The Prime Self Team</strong></p>
  </div>
  
  <div class="footer">
    <p><a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="https://primeself.app">View in browser</a></p>
  </div>
</body>
</html>
  `;

  return await sendEmail({ to: userEmail, subject, html }, apiKey, fromEmail);
}

/**
 * Send Re-engagement Email - For users inactive 7+ days
 * Subject: "Your chart misses you (and your transits are interesting)"
 */
export async function sendReengagementEmail(userEmail, userName, daysSinceLastLogin, apiKey, fromEmail) {
  const subject = "Your transits this week look interesting...";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #C9A84C; }
    .logo { font-size: 24px; font-weight: 700; color: #C9A84C; }
    .content { padding: 30px 0; }
    .cta { background: linear-gradient(135deg, #C9A84C 0%, #6A4FC8 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: 600; }
    .transit-preview { background: #FFF9E5; padding: 20px; border-radius: 8px; border-left: 4px solid #C9A84C; margin: 20px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Prime Self</div>
  </div>
  
  <div class="content">
    <h2>We've been tracking your transits...</h2>
    
    <p>Hey ${userName || 'there'},</p>
    
    <p>It's been ${daysSinceLastLogin} days since you last checked your chart. A lot has shifted in the cosmos since then!</p>
    
    <div class="transit-preview">
      <h3>This week's energy:</h3>
      <p>The planets have moved through several of your gates. Some days you might have felt more energized, other days more introspective. Your chart can explain why.</p>
      <p><strong>Curious what's activating in your design right now?</strong></p>
    </div>
    
    <a href="https://primeself.app/transits" class="cta">Check Your Current Transits →</a>
    
    <p>Also new since you last visited:</p>
    <ul>
      <li>Daily Check-In feature (track your alignment over time)</li>
      <li>Improved synthesis reports (even deeper insights)</li>
      <li>Improved daily check-in insights</li>
    </ul>
    
    <p>Your chart is waiting. Come see what's lighting up your design today.</p>
    
    <p>See you inside,<br>
    <strong>The Prime Self Team</strong></p>
  </div>
  
  <div class="footer">
    <p><a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="https://primeself.app">View in browser</a></p>
  </div>
</body>
</html>
  `;

  return await sendEmail({ to: userEmail, subject, html }, apiKey, fromEmail);
}

/**
 * Send Upgrade Nudge Email - For free tier users after 30 days
 * Subject: "Ready to unlock your full synthesis?"
 */
export async function sendUpgradeNudgeEmail(userEmail, userName, apiKey, fromEmail) {
  const subject = "Unlock your full Prime Self potential";
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #C9A84C; }
    .logo { font-size: 24px; font-weight: 700; color: #C9A84C; }
    .content { padding: 30px 0; }
    .cta { background: linear-gradient(135deg, #C9A84C 0%, #6A4FC8 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: 600; }
    .tier-comparison { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .feature { margin: 10px 0; }
    .free { color: #999; }
    .premium { color: #C9A84C; font-weight: 600; }
    .testimonial { background: #FFF9E5; padding: 15px; border-radius: 6px; margin: 20px 0; font-style: italic; border-left: 4px solid #C9A84C; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Prime Self</div>
  </div>
  
  <div class="content">
    <h2>You've been exploring for 30 days...</h2>
    
    <p>Hey ${userName || 'there'},</p>
    
    <p>You've been using Prime Self for a month. We hope you've found value in your chart and synthesis.</p>
    
    <p>Here's what you're missing on the free tier:</p>
    
    <div class="tier-comparison">
      <div class="feature"><span class="free">✗</span> Full 2000+ word AI synthesis report</div>
      <div class="feature"><span class="free">✗</span> Transit alerts (know when major planets activate your gates)</div>
      <div class="feature"><span class="free">✗</span> Composite charts (relationship compatibility)</div>
      <div class="feature"><span class="free">✗</span> Daily check-in tracking (unlimited history)</div>
      <div class="feature"><span class="free">✗</span> Gene Keys integration</div>
      <div class="feature"><span class="free">✗</span> API access (for developers)</div>
    </div>
    
    <!-- BL-R-C2: Testimonials must be from real users only (FTC §255 compliance) -->
    
    <p><strong>Seeker Tier - $15/month</strong></p>
    <ul>
      <li>Everything above</li>
      <li>Priority email support</li>
      <li>Early access to new features</li>
    </ul>
    
    <a href="https://primeself.app/pricing" class="cta">Upgrade to Seeker →</a>
    
    <p><strong>Not ready?</strong> No problem. Your free tier stays active forever. We just wanted you to know what's available when you're ready to go deeper.</p>
    
    <p>Keep exploring,<br>
    <strong>The Prime Self Team</strong></p>
  </div>
  
  <div class="footer">
    <p><a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="https://primeself.app">View in browser</a></p>
  </div>
</body>
</html>
  `;

  return await sendEmail({ to: userEmail, subject, html }, apiKey, fromEmail);
}

/**
 * Strip HTML tags for plain text fallback
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>.*<\/style>/gis, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Schedule email drip campaign
 * @param {Object} user - User object with { email, name, created_at }
 * @param {string} campaignType - 'welcome' | 'reengagement' | 'upgrade'
 * @param {Object} chartData - Optional chart data (type, authority, etc.)
 * @param {Object} env - Environment variables
 */
export async function scheduleEmailCampaign(user, campaignType, chartData = {}, env) {
  // This would integrate with a job queue (e.g., Cloudflare Queues, BullMQ)
  // For now, cron jobs handle drip timing
  
  console.log(`Scheduled ${campaignType} campaign for ${user.email}`);
  
  // In a production system, you'd:
  // 1. Add to email_queue table with send_at timestamp
  // 2. Cron job picks up emails where send_at <= NOW()
  // 3. Sends email and marks as sent
  
  // Example queue record:
  // {
  //   user_id: user.id,
  //   email: user.email,
  //   campaign: 'welcome_2',
  //   send_at: user.created_at + 24 hours,
  //   status: 'pending',
  //   metadata: { chartType: 'Generator', authority: 'Sacral' }
  // }
  
  return { success: true, message: `${campaignType} campaign scheduled` };
}
