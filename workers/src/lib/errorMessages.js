/**
 * @file Error Message Translation Layer
 * @purpose Convert technical errors into user-friendly messages with recovery hints
 * 
 * Usage:
 *   import { translateError } from './lib/errorMessages.js';
 *   
 *   try {
 *     // ...operation
 *   } catch (error) {
 *     const { message, hint } = translateError(error);
 *     return new Response(JSON.stringify({ error: message, hint }), { status: 400 });
 *   }
 */

/**
 * Error message mappings: technical pattern → user-friendly explanation
 */
const ERROR_PATTERNS = [
  // ── Authentication ──
  {
    pattern: /invalid.*credentials?|authentication.*failed|wrong.*password/i,
    message: "We couldn't sign you in with those credentials.",
    hint: "Double-check your email and password. Passwords are case-sensitive."
  },
  {
    pattern: /user.*not.*found|email.*not.*registered/i,
    message: "No account exists with that email address.",
    hint: "Try creating a new account or check if you used a different email."
  },
  {
    pattern: /email.*already.*exists|duplicate.*email/i,
    message: "An account with this email already exists.",
    hint: "Try signing in instead, or use 'Forgot Password' to reset your access."
  },
  {
    pattern: /token.*expired|session.*expired/i,
    message: "Your session has expired.",
    hint: "Please sign in again to continue."
  },
  {
    pattern: /unauthorized|not.*authenticated/i,
    message: "You need to be signed in to access this feature.",
    hint: "Click 'Sign In' in the top right to continue."
  },

  // ── Input Validation ──
  {
    pattern: /invalid.*date|date.*required|birthDate.*missing/i,
    message: "Please provide a valid birth date.",
    hint: "Use the calendar picker or enter the date in YYYY-MM-DD format."
  },
  {
    pattern: /invalid.*time|time.*required|birthTime.*missing/i,
    message: "Please provide a valid birth time.",
    hint: "Enter your birth time in 24-hour format (HH:MM), e.g., 14:30 for 2:30 PM."
  },
  {
    pattern: /invalid.*timezone|timezone.*required/i,
    message: "Please select a valid timezone.",
    hint: "Use the 'Look Up' button to auto-fill timezone based on your birth location."
  },
  {
    pattern: /lat.*required|lng.*required|invalid.*coordinates/i,
    message: "Birth location coordinates are missing or invalid.",
    hint: "Enter your birth city and click 'Look Up' to get coordinates automatically."
  },
  {
    pattern: /geocode.*failed|location.*not.*found/i,
    message: "We couldn't find that location.",
    hint: "Try being more specific (e.g., 'Tampa, FL, USA') or check for typos."
  },

  // ── Database ──
  {
    pattern: /connection.*timeout|ETIMEDOUT/i,
    message: "The database took too long to respond.",
    hint: "This is usually temporary. Please try again in a few seconds."
  },
  {
    pattern: /connection.*refused|ECONNREFUSED/i,
    message: "We couldn't connect to the database.",
    hint: "Our service might be experiencing issues. Please try again in a minute."
  },
  {
    pattern: /too.*many.*connections/i,
    message: "The database is currently at capacity.",
    hint: "We're experiencing high traffic. Please wait 30 seconds and try again."
  },
  {
    pattern: /duplicate.*key|unique.*constraint/i,
    message: "This record already exists.",
    hint: "You may have already saved this chart. Check 'My Profiles' to view it."
  },

  // ── API / Network ──
  {
    pattern: /network.*error|fetch.*failed|ENOTFOUND/i,
    message: "Network connection failed.",
    hint: "Check your internet connection and try again."
  },
  {
    pattern: /rate.*limit|too.*many.*requests/i,
    message: "You're making requests too quickly.",
    hint: "Please wait 60 seconds before trying again to avoid rate limits."
  },
  {
    pattern: /service.*unavailable|503/i,
    message: "The service is temporarily unavailable.",
    hint: "We might be performing maintenance. Please try again in a few minutes."
  },
  {
    pattern: /gateway.*timeout|504/i,
    message: "The request took too long to complete.",
    hint: "This might be due to high server load. Please try again in 30 seconds."
  },

  // ── AI / LLM ──
  {
    pattern: /claude.*error|anthropic.*api/i,
    message: "AI synthesis service is temporarily unavailable.",
    hint: "This usually resolves quickly. Try generating your profile again in 1-2 minutes."
  },
  {
    pattern: /content.*filtered|safety.*policy/i,
    message: "The AI couldn't process this request due to content policies.",
    hint: "Try rephrasing your question or removing sensitive information."
  },

  // ── Chart Calculation ──
  {
    pattern: /invalid.*julian.*day|JD.*out.*of.*range/i,
    message: "The birth date is outside the supported range.",
    hint: "We support dates from 1900 to 2100. Please enter a date within this range."
  },
  {
    pattern: /planet.*calculation.*failed/i,
    message: "Planetary position calculation failed.",
    hint: "This might be due to an invalid date. Check your birth date and time."
  },

  // ── Permissions ──
  {
    pattern: /not.*practitioner|practitioner.*only/i,
    message: "This feature is only available to practitioner accounts.",
    hint: "Upgrade to a practitioner account in Settings to access this tool."
  },
  {
    pattern: /access.*denied|forbidden|403/i,
    message: "You don't have permission to access this resource.",
    hint: "You may need to sign in or upgrade your account."
  },

  // ── Generic fallback (always last) ──
  {
    pattern: /.*/,
    message: "Something unexpected happened.",
    hint: "Please try again. If the problem persists, contact support with details about what you were trying to do."
  }
];

/**
 * Translate a technical error into a user-friendly message with recovery hint
 * @param {Error|string} error - The error to translate
 * @returns {{ message: string, hint: string, technical?: string }}
 */
export function translateError(error) {
  const errorText = error?.message || String(error);
  
  // Find first matching pattern
  const match = ERROR_PATTERNS.find(({ pattern }) => pattern.test(errorText));
  
  return {
    message: match.message,
    hint: match.hint,
    technical: errorText // Include original for debugging (optional: strip in production)
  };
}

/**
 * Create a standardized error response with user-friendly messaging
 * @param {Error|string} error - The error
 * @param {number} status - HTTP status code (default 400)
 * @returns {Response}
 */
export function errorResponse(error, status = 400, env = null) {
  const { message, hint, technical } = translateError(error);
  const isDev = env?.ENVIRONMENT === 'development';
  
  return new Response(
    JSON.stringify({ 
      error: message, 
      hint,
      ...(isDev && { technical })
    }),
    { 
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Middleware wrapper that auto-translates thrown errors
 * Usage: export default wrapWithErrorTranslation(myHandler)
 */
export function wrapWithErrorTranslation(handler) {
  return async (request, env, ctx) => {
    try {
      return await handler(request, env, ctx);
    } catch (error) {
      console.error('Handler error:', error);
      return errorResponse(error, error.status || 500);
    }
  };
}
