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
export async function sendEmail({ to, subject, html, text = '', replyTo = '', companyAddress = '' }, apiKey, fromEmail) {
  if (!apiKey) {
    console.warn('RESEND_API_KEY not configured, skipping email send');
    return { success: false, error: 'Email service not configured' };
  }

  // BL-FIX: Replace {{unsubscribe_url}} placeholder with a real URL
  const unsubscribeUrl = `https://selfprime.net/?action=email-unsubscribe&email=${encodeURIComponent(to)}`;
  let finalHtml = html.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);

  // CAN-SPAM: Inject physical mailing address before closing </body>
  const address = companyAddress || '8 The Green, Suite A, Dover, DE 19901, USA';
  const canSpamFooter = `<div style="text-align:center;font-size:11px;color:#999;padding:10px 0 20px;">Prime Self · ${address}</div>`;
  finalHtml = finalHtml.replace('</body>', canSpamFooter + '</body>');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),  // CTO-005: 8s — unresponsive Resend won't hang Worker
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
export async function sendWelcomeEmail1(userEmail, userName, apiKey, fromEmail, companyAddress = '') {
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
    
    <p>You just took the first step on a profound journey of self-discovery. Prime Self combines your energy blueprint, astrology, and numerology to give you a complete picture of who you are.</p>
    
    <p>Ready to see your unique energetic blueprint?</p>
    
    <a href="https://primeself.app" class="cta">Generate Your Chart →</a>
    
    <div class="tips">
      <h3>What to expect:</h3>
      <ul>
        <li><strong>Your Energy Blueprint</strong> - Discover your Energy Type, Decision Strategy, and Authority</li>
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

  return await sendEmail({ to: userEmail, subject, html, companyAddress }, apiKey, fromEmail);
}

/**
 * Send Welcome Email #2 - 24 hours after signup
 * Subject: "Understanding your unique pattern"
 */
export async function sendWelcomeEmail2(userEmail, userName, chartType, apiKey, fromEmail, companyAddress = '') {
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
    
    ${chartType === 'Generator' || chartType === 'Manifesting Generator' ? `
    <div class="highlight">
      <h3>As a ${chartType}, you:</h3>
      <ul>
        <li>Have sustainable life force energy when doing what lights you up</li>
        <li>Make best decisions by waiting to respond (not initiating)</li>
        <li>Know the answer through gut feelings (Sacral response)</li>
        ${chartType === 'Manifesting Generator' ? `<li>Move quickly and juggle multiple passions — that's your design</li>` : `<li>Build mastery through repetition and commitment</li>`}
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
      <p>Your energy blueprint reveals your optimal decision-making strategy, energy patterns, and life purpose. Each element - from your Energy Type to your defined Centers - creates a unique blueprint.</p>
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

  return await sendEmail({ to: userEmail, subject, html, companyAddress }, apiKey, fromEmail);
}

/**
 * Send Welcome Email #3 - 72 hours after signup
 * Subject: "How to use your Decision Strategy"
 */
export async function sendWelcomeEmail3(userEmail, userName, authority, apiKey, fromEmail, companyAddress = '') {
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

  return await sendEmail({ to: userEmail, subject, html, companyAddress }, apiKey, fromEmail);
}

/**
 * Send Welcome Email #4 - 7 days after signup
 * Subject: "Try Transit Insights (your personalized forecast)"
 */
export async function sendWelcomeEmail4(userEmail, userName, apiKey, fromEmail, companyAddress = '') {
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
    
    <p><strong>Bonus:</strong> Upgrade to Explorer tier to get weekly transit alerts. We'll email you when major planets activate important gates in your chart.</p>
    
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

  return await sendEmail({ to: userEmail, subject, html, companyAddress }, apiKey, fromEmail);
}

/**
 * Send Re-engagement Email - For users inactive 7+ days
 * Subject: "Your chart misses you (and your transits are interesting)"
 */
export async function sendReengagementEmail(userEmail, userName, daysSinceLastLogin, apiKey, fromEmail, companyAddress = '') {
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

  return await sendEmail({ to: userEmail, subject, html, companyAddress }, apiKey, fromEmail);
}

/**
 * Send Upgrade Nudge Email - For free tier users after 30 days
 * Subject: "Ready to unlock your full synthesis?"
 */
export async function sendUpgradeNudgeEmail(userEmail, userName, apiKey, fromEmail, companyAddress = '') {
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
    
    <p><strong>Explorer Tier - $12/month</strong></p>
    <ul>
      <li>Everything above</li>
      <li>Priority email support</li>
      <li>Early access to new features</li>
    </ul>
    
    <a href="https://primeself.app/pricing" class="cta">Upgrade to Explorer →</a>
    
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

  return await sendEmail({ to: userEmail, subject, html, companyAddress }, apiKey, fromEmail);
}

/**
 * Trial Ending Reminder — sent at day 5 of a 7-day trial (SYS-017)
 */
export async function sendTrialEndingEmail(userEmail, userName, daysLeft, tierName, apiKey, fromEmail, companyAddress = '') {
  const subject = `Your Prime Self trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
  const html = `<!DOCTYPE html><html><head><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}
.header{text-align:center;padding:20px 0;border-bottom:2px solid #C9A84C}.logo{font-size:24px;font-weight:700;color:#C9A84C}
.content{padding:30px 0}.cta{background:#C9A84C;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;display:inline-block;margin:20px 0;font-weight:600}
.footer{border-top:1px solid #eee;padding-top:20px;margin-top:30px;font-size:12px;color:#666}
</style></head><body>
<div class="header"><div class="logo">Prime Self</div></div>
<div class="content">
<h2>Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</h2>
<p>Hi ${userName || 'there'},</p>
<p>Your free trial of Prime Self ${tierName} ends in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>. After that, you'll lose access to your practitioner tools and client roster.</p>
<p>To keep everything running smoothly, add your payment details now — it takes less than 2 minutes.</p>
<a href="https://selfprime.net/billing" class="cta">Continue with ${tierName} →</a>
<p>Questions? Just reply to this email.</p>
<p>— The Prime Self Team</p>
</div>
<div class="footer"><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p></div>
</body></html>`;
  return sendEmail({ to: userEmail, subject, html, companyAddress }, apiKey, fromEmail);
}

/**
 * Subscription Renewal Confirmation (SYS-017)
 */
export async function sendRenewalConfirmationEmail(userEmail, userName, tierName, amount, nextRenewalDate, apiKey, fromEmail, companyAddress = '') {
  const subject = `Your Prime Self subscription has renewed`;
  const html = `<!DOCTYPE html><html><head><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}
.header{text-align:center;padding:20px 0;border-bottom:2px solid #C9A84C}.logo{font-size:24px;font-weight:700;color:#C9A84C}
.content{padding:30px 0}.detail-box{background:#f8f8f8;border-radius:8px;padding:16px;margin:16px 0}
.footer{border-top:1px solid #eee;padding-top:20px;margin-top:30px;font-size:12px;color:#666}
</style></head><body>
<div class="header"><div class="logo">Prime Self</div></div>
<div class="content">
<h2>Subscription renewed ✓</h2>
<p>Hi ${userName || 'there'},</p>
<p>Your Prime Self ${tierName} subscription has been renewed successfully.</p>
<div class="detail-box">
  <p><strong>Plan:</strong> ${tierName}</p>
  <p><strong>Amount charged:</strong> $${(amount / 100).toFixed(2)}</p>
  <p><strong>Next renewal:</strong> ${nextRenewalDate}</p>
</div>
<p>You can manage your subscription at any time from your billing dashboard.</p>
<p>— The Prime Self Team</p>
</div>
<div class="footer"><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p></div>
</body></html>`;
  return sendEmail({ to: userEmail, subject, html, companyAddress }, apiKey, fromEmail);
}

/**
 * Refund Issued Notification (SYS-017)
 */
export async function sendRefundIssuedEmail(userEmail, userName, amount, currency, apiKey, fromEmail, companyAddress = '') {
  const subject = `Your Prime Self refund has been processed`;
  const html = `<!DOCTYPE html><html><head><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}
.header{text-align:center;padding:20px 0;border-bottom:2px solid #C9A84C}.logo{font-size:24px;font-weight:700;color:#C9A84C}
.content{padding:30px 0}
.footer{border-top:1px solid #eee;padding-top:20px;margin-top:30px;font-size:12px;color:#666}
</style></head><body>
<div class="header"><div class="logo">Prime Self</div></div>
<div class="content">
<h2>Refund processed</h2>
<p>Hi ${userName || 'there'},</p>
<p>We've processed a refund of <strong>${currency.toUpperCase()} $${(amount / 100).toFixed(2)}</strong> to your original payment method.</p>
<p>Refunds typically appear within 5–10 business days depending on your bank.</p>
<p>If you have any questions, reply to this email and we'll help right away.</p>
<p>— The Prime Self Team</p>
</div>
<div class="footer"><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p></div>
</body></html>`;
  return sendEmail({ to: userEmail, subject, html, companyAddress }, apiKey, fromEmail);
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

/**
 * Send Password Reset Email
 * @param {string} userEmail - Recipient email
 * @param {string} resetUrl - Full URL with reset token
 * @param {string} apiKey - Resend API key
 * @param {string} fromEmail - From email address
 */
export async function sendPasswordResetEmail(userEmail, resetUrl, apiKey, fromEmail, companyAddress = '') {
  const subject = 'Reset your Prime Self password';

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0f;color:#e8e6f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1a1a24 0%,#0a0a0f 100%);padding:32px 24px;text-align:center;border-bottom:1px solid #2a2a3a">
        <div style="font-size:28px;margin-bottom:8px">✦</div>
        <h1 style="color:#c9a84c;font-size:22px;margin:0">Password Reset</h1>
      </div>
      <div style="padding:24px">
        <p style="margin:0 0 16px;line-height:1.6">You requested a password reset for your Prime Self account. Click the button below to create a new password:</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${resetUrl}" style="display:inline-block;background:#c9a84c;color:#0a0a0f;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px">Reset Password</a>
        </div>
        <p style="margin:0 0 16px;line-height:1.6;color:#8882a0;font-size:14px">This link expires in 1 hour. If you didn't request this reset, you can safely ignore this email — your password will remain unchanged.</p>
        <p style="margin:0;line-height:1.6;color:#8882a0;font-size:14px">If the button doesn't work, copy and paste this URL into your browser:</p>
        <p style="margin:8px 0 0;word-break:break-all;font-size:13px;color:#6a6580">${resetUrl}</p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #2a2a3a;text-align:center;font-size:12px;color:#6a6580">
        <p style="margin:0">Prime Self — Discover your unique energy blueprint</p>
        <p style="margin:4px 0 0"><a href="{{unsubscribe_url}}" style="color:#6a6580">Unsubscribe</a></p>
      </div>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html, companyAddress }, apiKey, fromEmail);
}

/**
 * Send Email Verification Email (AUDIT-SEC-003)
 * @param {string} userEmail - Recipient email
 * @param {string} verifyUrl - Full verification URL with raw token
 * @param {string} apiKey - Resend API key
 * @param {string} fromEmail - From email address
 */
export async function sendVerificationEmail(userEmail, verifyUrl, apiKey, fromEmail, companyAddress = '') {
  const subject = 'Verify your Prime Self email';

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0f;color:#e8e6f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1a1a24 0%,#0a0a0f 100%);padding:32px 24px;text-align:center;border-bottom:1px solid #2a2a3a">
        <div style="font-size:28px;margin-bottom:8px">✦</div>
        <h1 style="color:#c9a84c;font-size:22px;margin:0">Verify Your Email</h1>
      </div>
      <div style="padding:24px">
        <p style="margin:0 0 16px;line-height:1.6">Welcome to Prime Self! Please verify your email address to unlock AI-powered chart analysis and profile features.</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${verifyUrl}" style="display:inline-block;background:#c9a84c;color:#0a0a0f;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px">Verify Email</a>
        </div>
        <p style="margin:0 0 16px;line-height:1.6;color:#8882a0;font-size:14px">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
        <p style="margin:0;line-height:1.6;color:#8882a0;font-size:14px">If the button doesn't work, copy and paste this URL into your browser:</p>
        <p style="margin:8px 0 0;word-break:break-all;font-size:13px;color:#6a6580">${verifyUrl}</p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #2a2a3a;text-align:center;font-size:12px;color:#6a6580">
        <p style="margin:0">Prime Self — Discover your unique energy blueprint</p>
      </div>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html, companyAddress }, apiKey, fromEmail);
}

/**
 * Send Practitioner Invitation Email
 * @param {string} clientEmail - Recipient email
 * @param {string} practitionerName - Practitioner display name
 * @param {string} inviteUrl - Invitation acceptance URL
 * @param {string} apiKey - Resend API key
 * @param {string} fromEmail - From email address
 */
export async function sendPractitionerInvitationEmail(clientEmail, practitionerName, inviteUrl, apiKey, fromEmail, companyAddress = '') {
  const subject = `${practitionerName} wants to explore your energy blueprint`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0f;color:#e8e6f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1a1a24 0%,#0a0a0f 100%);padding:40px 32px;text-align:center;border-bottom:1px solid #2a2a3a">
        <div style="font-size:32px;margin-bottom:12px">✦</div>
        <h1 style="color:#c9a84c;font-size:24px;margin:0 0 8px">You've been invited</h1>
        <p style="margin:0;color:#8882a0;font-size:15px">by ${practitionerName}</p>
      </div>
      <div style="padding:32px">
        <p style="margin:0 0 20px;line-height:1.7;font-size:16px"><strong>${practitionerName}</strong> is inviting you to Prime Self — a personal growth platform that maps your unique energy blueprint using your birth data.</p>
        <div style="background:#1a1a24;border-radius:10px;padding:20px 24px;margin:0 0 24px;border-left:3px solid #c9a84c">
          <p style="margin:0 0 12px;font-weight:600;color:#c9a84c;font-size:14px;text-transform:uppercase;letter-spacing:0.5px">What you'll discover</p>
          <ul style="margin:0;padding:0 0 0 18px;color:#c4c0d8;line-height:1.9;font-size:15px">
            <li>Your Human Design chart — energy type, strategy &amp; authority</li>
            <li>Astrology birth chart with houses &amp; aspects</li>
            <li>Numerology life path &amp; expression numbers</li>
            <li>AI-generated synthesis connecting all three systems</li>
          </ul>
        </div>
        <p style="margin:0 0 24px;line-height:1.6;color:#c4c0d8;font-size:15px">Your practitioner will use these insights to guide your sessions with deeper, more personalised support.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="${inviteUrl}" style="display:inline-block;background:#c9a84c;color:#0a0a0f;font-weight:700;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:16px;letter-spacing:0.3px">View My Blueprint →</a>
        </div>
        <p style="margin:0 0 8px;text-align:center;line-height:1.6;color:#6a6580;font-size:13px">Free to use · No credit card needed · Link expires in 14 days</p>
        <p style="margin:16px 0 0;line-height:1.6;color:#6a6580;font-size:13px">Can't click the button? Copy this link into your browser:</p>
        <p style="margin:4px 0 0;word-break:break-all;font-size:12px;color:#4a4560">${inviteUrl}</p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #2a2a3a;text-align:center;font-size:12px;color:#6a6580">
        <p style="margin:0">Prime Self · 8 The Green, Suite A, Dover, DE 19901, USA</p>
        <p style="margin:4px 0 0">You received this because ${practitionerName} invited you. <a href="{{unsubscribe_url}}" style="color:#6a6580">Unsubscribe</a></p>
      </div>
    </div>
  `;

  return sendEmail({ to: clientEmail, subject, html, companyAddress }, apiKey, fromEmail);
}

/**
 * Send Subscription Confirmation Email
 * @param {string} userEmail - Recipient email
 * @param {string} tierName - Display name of the tier (e.g., "Explorer", "Practitioner")
 * @param {string} apiKey - Resend API key
 * @param {string} fromEmail - From email address
 */
export async function sendSubscriptionConfirmationEmail(userEmail, tierName, apiKey, fromEmail, companyAddress = '') {
  const subject = `Welcome to Prime Self ${tierName}! 🎉`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="text-align:center;padding:24px 0;border-bottom:1px solid #2a2a3a">
      <div style="font-size:24px;font-weight:700;color:#c9a84c">Prime Self</div>
    </div>
    <div style="padding:32px 0">
      <h2 style="margin:0 0 16px;color:#e8e4f0;font-size:22px">Your upgrade is confirmed! 🌟</h2>
      <p style="margin:0 0 16px;line-height:1.6;color:#c4c0d8">You're now on the <strong style="color:#c9a84c">${tierName}</strong> plan. Here's what you've unlocked:</p>
      <div style="background:#1a1a24;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #c9a84c">
        <ul style="margin:0;padding:0 0 0 20px;color:#c4c0d8;line-height:1.8">
          <li>Unlimited chart generation</li>
          <li>Full AI Synthesis reports</li>
          <li>Transit insights &amp; daily digest</li>
          <li>Priority support</li>
        </ul>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="https://primeself.app" style="display:inline-block;background:#c9a84c;color:#0a0a0f;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px">Explore Your New Features →</a>
      </div>
      <p style="margin:0 0 8px;line-height:1.6;color:#8882a0;font-size:14px">Your subscription will renew automatically. You can manage billing or cancel anytime from the Billing button in the app.</p>
      <p style="margin:0;line-height:1.6;color:#8882a0;font-size:14px">Questions? Just reply to this email.</p>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #2a2a3a;text-align:center;font-size:12px;color:#6a6580">
      <p style="margin:0">Prime Self — Discover your unique energy blueprint</p>
      <p style="margin:4px 0 0"><a href="{{unsubscribe_url}}" style="color:#6a6580">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({ to: userEmail, subject, html, companyAddress }, apiKey, fromEmail);
}
