# Language & Comprehension Audit

**Audit Date:** March 4, 2026  
**Scope:** All user-facing documentation, UI text, error messages, and API responses  
**Goal:** Identify areas where language can be improved for better human understanding

---

## Executive Summary

The repository demonstrates **strong technical documentation** but has significant gaps in **user-facing language clarity**. Technical audiences will have no issues, but non-technical users face:

- **Jargon overload** (unexplained acronyms, technical terms)
- **Assumption of prior knowledge** (HD, astrology, dev tools)
- **Inconsistent tone** (technical → conversational → academic)
- **Missing context** for beginners
- **Confusing terminology** (overlapping systems)

**Overall Grade: C+ (User-facing) | A (Technical docs)**

---

## Priority 1: CRITICAL — Blocks User Understanding

### 1.1 README.md — First Impression Issues

**Problem:** Assumes readers know what "Human Design", "LLM", "JDN", "Cloudflare Worker", etc. mean  
**Impact:** New users immediately confused  
**Examples:**

```markdown
CURRENT (Line 3):
"deterministic chart calculations, AI-powered personality profiling, transit tracking"

CLEARER:
"Generate personalized personality insights by combining Human Design (an energy system) 
with Western Astrology. Powered by AI for deep synthesis."

---

CURRENT (Line 14):
"LLM-synthesised 8-layer profile: Forge archetype, Knowledge Profile, Decision Architecture"

CLEARER:
"AI-Generated Personal Profile: Discover your archetype, decision-making style, 
life strategy, and current energy patterns. Simple language, deep insight."

---

CURRENT (Line 15):
"Live planetary positions mapped to HD gates/lines; transit-to-natal aspects"

CLEARER:
"Current Sky Energy: See how today's planetary positions affect your personal chart. 
Updated daily with specific insights for your design."
```

**Fix Required:**
- Add a "What is this?" section at the top
- Define "Human Design" and "Prime Self" in simple terms
- Explain technical terms on first use
- Add a "For Beginners" quick start

---

### 1.2 Frontend UI — Unexplained Jargon

**Problem:** Users see technical terms without definitions  
**Impact:** Confusion, abandonment  

**Examples from index.html:**

```html
CURRENT (Line 341):
"◈ The Prime Self Profile requires sign-in and a full 8-layer synthesis via Claude AI. 
Generation takes 15–30 seconds."

ISSUES:
- What is "8-layer synthesis"?
- Why do I need Claude AI?
- What am I getting?

BETTER:
"◈ Your Prime Self Profile is a personalized life blueprint that takes 15–30 seconds to generate.
It combines your birth chart with AI analysis to give you:
  • Who you are (your energy type)
  • How you make best decisions
  • Your life strategy & purpose
  • Current opportunities & challenges
Sign in required to save your profile."

---

CURRENT (Line 400):
"Birth Time Rectification"

ISSUE: 99% of users don't know this term

BETTER:
"Birth Time Finder"
+ Help text: "Not sure of your exact birth time? This tool tests different times 
within a window to find the best match."

---

CURRENT (Line 415):
"Composite Chart"

BETTER:
"Relationship Compatibility"
+ Help text: "See how two people's energies blend together. Great for partners, 
family members, or business relationships."
```

**Fix Required:**
- Add help icons (ⓘ) with tooltips for all technical terms
- Expand abbreviations on first use
- Add "What is this?" explainers for each tab
- Use everyday language in primary labels

---

### 1.3 Error Messages — Too Technical

**Problem:** Error messages assume technical knowledge  
**Impact:** Users don't know how to fix issues  

**Examples from handlers:**

```javascript
CURRENT (calculate.js line 27):
"Invalid JSON body"

USER SEES: "Invalid JSON body"
USER THINKS: "What's JSON? Did I break something?"

BETTER:
"We couldn't read your request. Please try again or contact support if this persists."

---

CURRENT (calculate.js line 36):
"Missing required field: ${field}"

USER SEES: "Missing required field: birthTimezone"  
USER THINKS: "What field? Where do I add it?"

BETTER:
"Please fill in your timezone (found under birth location)."

---

CURRENT (transits.js — no user-facing messages):
Backend errors aren't translated for users

BETTER:
Add user-friendly error mapping:
  DB connection failed → "Our servers are temporarily down. Try again in a moment."
  LLM timeout → "Profile generation is taking longer than expected. We've saved your request."
```

**Fix Required:**
- Create error message translation layer
- All errors should suggest next action
- Avoid technical terms in user messages
- Add error recovery hints

---

## Priority 2: HIGH — Reduces Comprehension

### 2.1 Documentation Inconsistency

**Problem:** Different docs use different terminology for same concept  
**Impact:** Confusion about what things are called  

**Examples:**

| Concept | README | ARCHITECTURE | BUILD_BIBLE | synthesis.js |
|---------|--------|--------------|-------------|--------------|
| User Profile | "Prime Self Profile" | "8-layer profile" | "Synthesis" | "Quick Start Guide" |
| Decision Making | "Authority" | "Decision Architecture" | "Authority" | "Inner Guidance" |
| Energy Type | "Type" | "Type" | "Type" | "Pattern/Archetype" |
| Birth Chart | "Chart" | "HD Chart" | "natal chart" | "Reference Facts" |

**Fix Required:**
- Create glossary.md
- Standardize terminology across all docs
- Always use primary term, add alternatives in parentheses

---

### 2.2 Assumed Knowledge — Human Design Terms

**Problem:** Docs use HD terms without explanation  
**Impact:** Non-HD users lost immediately  

**Examples from ARCHITECTURE.md:**

```markdown
CURRENT (Line 29):
"Layer 5: Centers / Channels / Type / Authority / Profile"

ISSUE: Only HD practitioners know these terms

BETTER:
"Layer 5: Energy Centers (9 chakra-like zones) / Channels (connections between centers) / 
Type (how you best interact with the world) / Authority (your decision-making style) / 
Profile (your life role)"

---

CURRENT (Line 58):
"AP Test Vector: Aug 5, 1979, 22:51 UTC, Tampa FL (27.9506°N, 82.4572°W)
Type: Projector, Profile: 6/2, Authority: Emotional – Solar Plexus"

ISSUE: Meaningless to beginners

ADD CONTEXT:
"AP Test Vector (example person used to verify accuracy):
  • Type: Projector (Guide archetype — best at advising others)
  • Profile: 6/2 (Role Model / Hermit — leaders who need alone time)
  • Authority: Emotional (makes best decisions after riding emotional wave)"
```

**Fix Required:**
- First use of each HD term should include plain English
- Add "Learn More" links to glossary
- Create beginner's guide to HD concepts

---

### 2.3 Developer-Centric README

**Problem:** README prioritizes developers over end-users  
**Impact:** Users think it's only for programmers  

**Current Structure:**
1. Tech stack (first thing you see)
2. Installation commands
3. Deployment instructions
4. Secrets configuration
5. Project structure
... (No "How to Use" for end-users)

**Better Structure:**
1. **What This Does** (for humans, not devs)
2. **Try It Now** (live demo link)
3. **How to Use** (user guide)
4. **Key Concepts Explained**
5. --- DEVELOPERS START HERE ---
6. Installation, deployment, etc.

**Fix Required:**
- Split README into:
  - README.md (user-facing)
  - DEVELOPER.md (technical)
- Add screenshots of UI
- Include example outputs

---

### 2.4 API Documentation — Missing Context

**Problem:** API_SPEC.md documents endpoints but not use cases  
**Impact:** Users don't know when/why to use each endpoint  

**Example:**

```markdown
CURRENT:
### `POST /api/chart/calculate`
Full chart calculation — Layers 1-7.

Request body:
{
  "birthDate": "1979-08-05",
  "birthTime": "18:51",
  ...
}

BETTER:
### `POST /api/chart/calculate` — Generate Your Birth Chart

**Use this when:** Someone wants to see their Human Design chart and astrological placements

**What you get:**
  • Your energy type (Generator, Projector, etc.)
  • Decision-making authority
  • Defined/undefined energy centers
  • Gates, channels, and lines
  • Western astrology placements

**Request body:**
{
  "birthDate": "1979-08-05",  // YYYY-MM-DD format
  "birthTime": "18:51",       // 24-hour time
  "birthTimezone": "America/New_York",  // IANA timezone
  "lat": 27.9506,             // Latitude (from geocoding)
  "lng": -82.4572             // Longitude (from geocoding)
}

**Example use case:** 
User fills out birth form → clicks "Calculate Chart" → sees their profile
```

**Fix Required:**
- Add "When to use" for each endpoint
- Include example scenarios
- Explain each field purpose
- Show sample response with annotations

---

## Priority 3: MEDIUM — Improves Experience

### 3.1 Missing Tooltips / Help Text

**Problem:** No inline help in UI  
**Impact:** Users guess what things mean  

**Where to Add:**

```html
Timezone dropdown:
  <label>
    Timezone 
    <span class="help-icon" title="Where you were born affects the chart. 
    If you used 'Look Up', this is already set correctly.">ⓘ</span>
  </label>

"Human Design Chart" section:
  <div class="card-title">
    ⊕ Human Design Chart 
    <span class="help-icon" title="Human Design maps your unique energy blueprint 
    based on birth time and location. It shows your natural strengths, 
    decision-making style, and life purpose.">ⓘ</span>
  </div>

Profile/Line numbers (e.g. "6/2"):
  <span class="help-icon" title="Your Profile is your life role. 
  6 = Role Model (lived 3 phases of life). 
  2 = Hermit (needs alone time to process).">ⓘ</span>
```

---

### 3.2 Acronym Expansion

**Problem:** Unexpanded acronyms everywhere  

**Fix List:**

```markdown
JDN → Julian Day Number (explain: "astronomers' way to count days")
UTC → Universal Time (explain: "time at Greenwich, England")
JWT → JSON Web Token (explain: "secure login credential")
HD → Human Design
API → Application Programming Interface (explain: "how programs talk to each other")
LLM → Large Language Model (explain: "AI like ChatGPT")
RAG → Retrieval Augmented Generation (explain: "AI that references your data")
KV → Key-Value Store (explain: "fast database for simple lookups")
R2 → Cloudflare Object Storage (explain: "cloud file storage")
SPA → Single Page Application (explain: "website that doesn't reload pages")
```

**Rule:** First use = full expansion. Subsequent uses = acronym OK.

---

### 3.3 Build Bible — Too Academic

**Problem:** BUILD_BIBLE.md uses algorithm language for non-specialists  

**Example:**

```markdown
CURRENT (Line 142):
"For Sun longitude:
- T = (JDN - 2451545.0) / 36525  (Julian centuries from J2000.0)
- Calculate geometric mean longitude L0
- Calculate mean anomaly M
- Calculate equation of center C"

ISSUE: Assumes astronomy background

BETTER:
"For Sun longitude (how far the sun has moved through the zodiac):
We use Jean Meeus astronomical formulas (industry standard). The process:
  1. Convert birth moment to 'Julian Days' (continuous day count since 4713 BC)
  2. Calculate how far the Sun has moved from a reference point (J2000.0 = Jan 1, 2000)
  3. Account for Earth's elliptical orbit
  4. Return degree position (0-360°)

Technical details in comments if you're curious, but the key is: 
it's verified against NASA data and matches professional astrology software."
```

---

### 3.4 Synthesis Prompt — Mixed Audiences

**Problem:** synthesis.js SYSTEM_PROMPT tries to serve two masters  
**Impact:** Output sometimes too technical, sometimes too simple  

**Current Approach:**
- Single output with "technical insights" section
- Forbidden/Approved term lists
- Tone guidelines

**Better Approach:**
- Generate TWO separate outputs:
  1. **Human Version** (no jargon, conversational, 400-600 words)
  2. **Technical Version** (HD/Astro terms, charts, full data)
- User chooses which to read
- Default = Human Version
- "Show me the details" button reveals Technical

**Implementation:**
```javascript
// In synthesis.js SYSTEM_PROMPT
You will generate TWO distinct outputs:

OUTPUT 1: HUMAN-FRIENDLY PROFILE (required)
  • Zero jargon
  • Write like texting a friend
  • Action-focused ("Do this" not "You are this")
  • 400-600 words
  • Sections: Who Am I? | How Do I Decide? | What's My Strategy? | This Month

OUTPUT 2: TECHNICAL INSIGHTS (optional, collapsible)
  • Full HD terminology OK
  • Gate/Channel details
  • Astrological placements
  • I Ching hexagrams
  • Numerology codes
  • For practitioners and HD students
```

---

## Priority 4: LOW — Polish & Consistency

### 4.1 Inconsistent Symbols

**Problem:** Different symbols used for same thing  

**Current:**
- Chart tab: ⊕
- Profile tab: ◈
- Transits tab: ⊛
- Composite: ⧈
- Rectify: ◴

**Issue:** No pattern, users can't predict meaning

**Better:** Use consistent icon language
- 👤 Person (Profile)
- 📊 Chart (Chart)
- 🌍 Current (Transits)
- 💑 Relationship (Composite)
- ⏰ Time (Rectify)

---

### 4.2 Button Labels Too Techy

**Examples:**

```html
CURRENT: "Calculate Chart"
BETTER: "Generate My Chart"

CURRENT: "Load My Profiles"
BETTER: "View Saved Profiles"

CURRENT: "Generate Composite"
BETTER: "Check Compatibility"

CURRENT: "Analyze Time Window"
BETTER: "Find My Birth Time"
```

---

### 4.3 Form Field Labels

**Current labels assume knowledge:**

```html
ISSUE: "Latitude" / "Longitude"
FIX: "Location Coordinates (auto-filled)"
  + Hide these unless "Advanced Mode" enabled

ISSUE: "Timezone"
FIX: "Time Zone Where You Were Born"

ISSUE: "Birth Date"
FIX: "Birth Date" (OK — this one is clear)

ISSUE: "Specific Question (optional)"
FIX: "Ask Something Specific (or leave blank for full reading)"
```

---

## Recommendations by Document

### README.md
- [ ] Add "What is Prime Self?" section at top (3-4 sentences)
- [ ] Create "Quick Concepts" glossary table
- [ ] Split into user guide + developer docs
- [ ] Add screenshots
- [ ] Reduce tech stack prominence (move to bottom)
- [ ] Add "Try the Live Demo" button at top

### frontend/index.html
- [ ] Add help tooltips to all technical terms
- [ ] Expand button labels ("Calculate" → "Generate My Chart")
- [ ] Add "What is this?" link on each tab
- [ ] Improve error messages (user-friendly)
- [ ] Add loading state explanations ("Calculating 88-day design offset...")
- [ ] Replace symbols with text + emoji

### ARCHITECTURE.md
- [ ] Add glossary section at top
- [ ] Explain each layer in plain English first, THEN technical
- [ ] Add "Why This Matters" for each architectural choice
- [ ] Create "For Non-Developers" summary box

### API_SPEC.md
- [ ] Add "Use Cases" for each endpoint
- [ ] Explain each field purpose
- [ ] Include example workflows
- [ ] Add response field explanations
- [ ] Create quick reference table (endpoint → purpose)

### synthesis.js
- [ ] Split output into Human + Technical versions
- [ ] Default to Human version
- [ ] Add "technical toggle" in UI
- [ ] Ensure zero jargon in Human version
- [ ] Add examples to prompt

### Error Messages (all handlers)
- [ ] Create errorMessages.js translation layer
- [ ] Map technical errors to user-friendly messages
- [ ] Always suggest next action
- [ ] Add recovery hints
- [ ] Test with non-technical users

---

## Testing Recommendations

**User Comprehension Testing:**

1. **5-Second Test** — Show README to new user for 5 seconds
   - Ask: "What does this project do?"
   - Success: Can explain in simple terms

2. **First-Time User Test** — Watch someone use UI with no training
   - Track: Where do they get confused?
   - Fix: Those exact points

3. **Error Recovery Test** — Trigger errors intentionally
   - Ask: "What do you think this means?"
   - Measure: Can they fix it?

4. **Jargon Audit** — Count unexplained acronyms/terms
   - Goal: Zero in user-facing text
   - Tool: grep for capital acronyms

5. **Reading Level Check**
   - Tool: Hemingway Editor
   - Goal: Grade 8 or below for user docs
   - Current: Grade 12+ (too academic)

---

## Implementation Priority

### Week 1: Critical Fixes
1. README.md — add "What is this?" section
2. Frontend tooltips — add to all jargon
3. Error messages — translate to plain English
4. Button labels — make action-oriented

### Week 2: High Priority
5. Create GLOSSARY.md
6. Split README → user + developer
7. API_SPEC.md — add use cases
8. Synthesis prompt — dual output

### Week 3: Medium Priority
9. ARCHITECTURE.md — add plain English summaries
10. Standardize terminology across docs
11. Add screenshots to README
12. Form label improvements

### Week 4: Polish
13. Replace obscure symbols
14. Consistency pass on all docs
15. User testing session
16. Iterate based on feedback

---

## Success Metrics

- ✅ Non-technical user can explain project in 30 seconds
- ✅ Zero unexplained acronyms in user-facing text
- ✅ All errors include next action
- ✅ New user can generate chart without documentation
- ✅ Reading level: Grade 8 or below (Hemingway test)
- ✅ User testing: 90%+ comprehension on key workflows

---

*This audit provides a roadmap for making Prime Self accessible to humans, not just developers.*
