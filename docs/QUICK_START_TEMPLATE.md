# Quick Start Guide Template

This is the user-facing output format that replaces jargon-heavy reports. Copy this structure into your synthesis prompt.

---

## Synthesis Prompt Addition

Add this section to `src/prompts/synthesis.js` SYSTEM_PROMPT:

```javascript
OUTPUT STRUCTURE:

Your response must include TWO layers:

1. QUICK START GUIDE (required, user-facing default)
   - 400-600 words total
   - ZERO jargon unless immediately explained in plain language
   - Conversational tone (write like explaining to a friend over coffee)
   - Specific actionable guidance, not abstract concepts
   - Must answer: "Who am I?", "How should I decide?", "What should I do?", "How do I work with others?"

2. TECHNICAL INSIGHTS (optional, collapsible)
   - Gene Keys terminology (NOT Human Design terminology)
   - Astrological placements with interpretation
   - I Ching hexagram wisdom
   - Numerology codes
   - Can include technical terms but explain correlations

LANGUAGE GUIDELINES:

FORBIDDEN TERMS (HD IP risk):
- "Human Design", "BodyGraph", "Rave Mandala"
- "Manifesting Generator", "Manifestor", "Projector", "Reflector" (as labels)
- "Incarnation Cross", "Variable", "PHS", "Environment"

APPROVED ALTERNATIVES:
- "Builder-Initiator Pattern" (not "Manifesting Generator")
- "Guide Pattern" (not "Projector")  
- "Oracle Pattern" (not "Reflector")
- "Gene Key" (not "Gate")
- "Life Purpose Vector" (not "Incarnation Cross")
- "Emotional Wave Navigation" (not "Emotional Authority")
- "Life Force Response" (not "Sacral Authority")

TONE EXAMPLES:

❌ BAD: "Your undefined Sacral center means you lack consistent access to generative life force energy and must wait for external invitations to engage your will."

✅ GOOD: "You're not designed for 9-to-5 grind-it-out work. Your energy comes in waves based on who you're around and what excites you in the moment. Honor that rhythm instead of forcing consistency."

❌ BAD: "Gate 37.4 in your Design Sun indicates unconscious capacity for transpersonal bargaining via emotional authority within tribal structures."

✅ GOOD: "You naturally know how to negotiate in family/community situations, even though you may not realize you're doing it. Trust your gut feelings about family commitments - if it feels off emotionally, it probably is."
```

---

## Template Structure

### Section 1: Who You Are (100 words)

**Pattern**: [Archetype Name] [One-sentence essence] [Key characteristics]

**Example**:
```
WHO YOU ARE: The Guide

You're designed to see what others miss. Your superpower is recognizing potential 
in people and systems before they see it themselves. You're naturally perceptive, 
strategic, and deeply aware of how things work.

BUT - you're not here to do the heavy lifting. You're here to guide, advise, and 
direct. When you try to muscle through things yourself, you burn out and feel 
bitter. Your magic happens when others invite your perspective and actually listen.
```

**Variables to fill**:
- Type → Archetype ("Guide" for Projector, "Builder-Initiator" for MG, "Catalyst" for Manifestor, etc.)
- Core essence (distilled from profile + definition + authority)
- Primary challenge/shadow
- Primary gift when aligned

---

### Section 2: How You Make Best Decisions (120 words)

**Pattern**: [Authority strategy in plain language] [What it feels like day-to-day] [Specific timing guidance] [Common mistakes]

**Example for Emotional Authority**:
```
HOW YOU MAKE BEST DECISIONS: Wait for Emotional Clarity

You have emotional waves - excitement one day, doubt the next. This is NORMAL for 
you and actually your wisdom speaking. For big decisions (job changes, relationships, 
major purchases), wait 2-3 days minimum. Let yourself feel all the feelings.

Here's how to use it:
1. Initial excitement? Note it, but don't commit yet
2. Next day feeling doubt? That's the wave - don't panic
3. After 2-3 cycles, notice what remains TRUE across both highs and lows
4. THAT consistency is your answer

Common mistake: Making decisions during emotional highs (you'll regret when wave drops) 
or lows (you'll miss opportunities). The truth lives in the pattern, not the peak.
```

**Example for Sacral Authority (Generator)**:
```
HOW YOU MAKE BEST DECISIONS: Trust Your Gut Response

You have a built-in YES/NO response in your body - a gut feeling that happens 
BEFORE your brain gets involved. It sounds like "uh-huh" (yes, excited) or 
"uh-uh" (no, not my thing).

Here's how to use it:
1. Don't decide from your head first - brain will rationalize either direction
2. Present yourself with the specific option: "Should I take this job?"
3. Notice immediate gut reaction (not thoughts about it - the GUT sensation)
4. Expansion/excitement = yes. Contraction/flatness = no.

Common mistake: Overriding your gut with logic. Your mind is powerful, but it's 
not your decision-maker. Let mind inform the gut, not override it.
```

**Authority Mapping**:
- Emotional → "Wait for Emotional Clarity" (time + wave pattern)
- Sacral → "Trust Your Gut Response" (immediate yes/no sensation)
- Splenic → "Trust Your Instant Knowing" (first instinct, can't repeat)
- Ego → "Commit Only to What Feels Worth It" (energy investment filter)
- Self-Projected → "Talk It Out Loud" (hear yourself speak truth)
- Mental/Environmental → "Discuss with Trusted Circle" (process through conversation)
- Lunar (Reflector) → "Wait 28 Days, Sample Environments" (full moon cycle)

---

### Section 3: Your Life Strategy (120 words)

**Pattern**: [Type strategy in plain language] [Why it matters] [What happens when you violate it] [How to practice it]

**Example for Projector (Guide)**:
```
YOUR LIFE STRATEGY: Wait for the Invitation

Don't force your guidance on people who aren't ready. Seriously. You'll burn out, 
feel invisible, and get bitter. Instead, wait for genuine invitations - moments 
when people actually ASK for your perspective.

What counts as an invitation:
✓ "Hey, I'd love your thoughts on..."
✓ Job offers, formal requests, "can you help with..."
✓ Moments when people are genuinely CURIOUS about your input

What's NOT an invitation:
✗ Someone complaining (they're venting, not asking)
✗ You seeing a problem (doesn't mean they want you to fix it)
✗ Thinking you know better (even if you do!)

When invited, your guidance lands powerfully. When not invited, it falls flat and 
drains you.

Practice: This week, count how many times you offer advice vs wait to be asked. 
Notice the difference in how it's received.
```

**Example for Generator (Builder)**:
```
YOUR LIFE STRATEGY: Respond, Don't Initiate

Your power comes from RESPONDING to what life presents, not trying to make things 
happen from scratch. You're designed to react/build/amplify - not to cold-start.

How this works:
• Life presents opportunities (job posts, invitations, ideas cross your path)
• You check: Does my gut say YES to this?
• If yes → GO ALL IN with your massive energy
• If no → Let it pass, wait for next thing

What happens when you violate this:
Starting things from scratch feels hard, you lose momentum, projects fizzle out. 
That's not failure - it's a sign you're force-initiating instead of responding.

Practice: For one week, don't start ANY new projects. Only respond to what comes 
to you. Notice how much easier momentum feels.
```

**Strategy Mapping**:
- Projector → "Wait for the Invitation" (recognition-based)
- Generator → "Respond, Don't Initiate" (reaction-based)
- Manifesting Generator → "Respond, Then Act Fast" (test quickly)
- Manifestor → "Inform Before You Act" (minimize resistance)
- Reflector → "Sample for 28 Days" (absorb environment)

---

### Section 4: This Month (100 words)

**Pattern**: [Active transits in plain language] [What this means for them] [Specific actions to take]

**Example**:
```
THIS MONTH (March 2026): Family Ties Activated

Your emotional intelligence around family and community is extra strong right now. 
Big planetary alignments are lighting up your relationship wisdom centers.

You might notice:
• Old family patterns resurfacing for healing
• Stronger pull toward community/tribe matters
• Increased ability to guide others through emotional situations

Good time to:
✓ Repair important relationships (you'll have unusual clarity)
✓ Set better boundaries with family (speak your truth, they'll hear it)
✓ Trust your gut when advising others on emotional matters

Avoid:
✗ Making permanent family decisions during peak emotion (still wait for your wave!)
```

**Data sources**:
- Pull from `data.transits.gateActivations` (which natal gates are being triggered)
- Pull from `data.transits.transitToNatalAspects` (tight aspects)
- Translate to plain language using synthesis knowledge

---

### Section 5: Working With Others (100 words)

**Pattern**: [What you bring] [What you need] [Best collaborators]

**Example**:
```
WORKING WITH OTHERS

What You Bring:
• Deep awareness of others' potential (you see gifts they don't know they have)
• Strategic guidance on when to act vs wait
• Emotional wisdom and strong bonding capacity
• Natural leadership presence through authenticity

What You Need:
• People who genuinely value your insights (not just use you as free advice)
• Energy from others (you're not built for solo isolation - collaboration recharges you)
• Recognition and appreciation (you wilt when invisible)
• Downtime between invitations (you can't guide 24/7)

You thrive with:
Builders (MGs/Generators) who have the energy to execute your vision, emotional 
processors who appreciate depth, and people who ask great questions.
```

---

## Full Example Output

```markdown
# YOUR PRIME SELF OVERVIEW

## WHO YOU ARE: The Guide

You're designed to see what others miss. Your superpower is recognizing potential 
in people and systems before they see it themselves. You're naturally perceptive, 
strategic, and deeply aware of how things work.

BUT - you're not here to do the heavy lifting. You're here to guide, advise, and 
direct. When you try to muscle through things yourself, you burn out and feel 
bitter. Your magic happens when others invite your perspective and actually listen.

## HOW YOU MAKE BEST DECISIONS: Wait for Emotional Clarity

You have emotional waves - excitement one day, doubt the next. This is NORMAL for 
you and actually your wisdom speaking. For big decisions (job changes, relationships, 
major purchases), wait 2-3 days minimum. Let yourself feel all the feelings.

Here's how to use it:
1. Initial excitement? Note it, but don't commit yet
2. Next day feeling doubt? That's the wave - don't panic
3. After 2-3 cycles, notice what remains TRUE across both highs and lows
4. THAT consistency is your answer

Common mistake: Making decisions during emotional highs (you'll regret when wave drops) 
or lows (you'll miss opportunities). The truth lives in the pattern, not the peak.

## YOUR LIFE STRATEGY: Wait for the Invitation

Don't force your guidance on people who aren't ready. Seriously. You'll burn out, 
feel invisible, and get bitter. Instead, wait for genuine invitations - moments 
when people actually ASK for your perspective.

What counts as an invitation:
✓ "Hey, I'd love your thoughts on..."
✓ Job offers, formal requests, "can you help with..."
✓ Moments when people are genuinely CURIOUS about your input

What's NOT an invitation:
✗ Someone complaining (they're venting, not asking)
✗ You seeing a problem (doesn't mean they want you to fix it)
✗ Thinking you know better (even if you do!)

When invited, your guidance lands powerfully. When not invited, it falls flat and 
drains you.

Practice: This week, count how many times you offer advice vs wait to be asked. 
Notice the difference in how it's received.

## THIS MONTH (March 2026): Family Ties Activated

Your emotional intelligence around family and community is extra strong right now. 
Big planetary alignments are lighting up your relationship wisdom centers.

You might notice:
• Old family patterns resurfacing for healing
• Stronger pull toward community/tribe matters  
• Increased ability to guide others through emotional situations

Good time to:
✓ Repair important relationships (you'll have unusual clarity)
✓ Set better boundaries with family (speak your truth, they'll hear it)
✓ Trust your gut when advising others on emotional matters

Avoid:
✗ Making permanent family decisions during peak emotion (still wait for your wave!)

## WORKING WITH OTHERS

**What You Bring:**
• Deep awareness of others' potential (you see gifts they don't know they have)
• Strategic guidance on when to act vs wait
• Emotional wisdom and strong bonding capacity
• Natural leadership presence through authenticity

**What You Need:**
• People who genuinely value your insights (not just use you as free advice)
• Energy from others (you're not built for solo isolation - collaboration recharges you)
• Recognition and appreciation (you wilt when invisible)
• Downtime between invitations (you can't guide 24/7)

**You Thrive With:**
Builders (people with consistent energy) who can execute your vision, emotional 
processors who appreciate depth, and people who ask great questions.

---

[Show Technical Insights ▼]
```

---

## JSON Schema for Synthesis Response

```javascript
{
  "quickStartGuide": {
    "whoYouAre": {
      "archetype": "The Guide",
      "essence": "string (2-3 sentences)",
      "coreChallenge": "string",
      "coreGift": "string"
    },
    "decisionStyle": {
      "authorityType": "Wait for Emotional Clarity",
      "howToUseIt": ["step 1", "step 2", "step 3"],
      "commonMistake": "string",
      "practicalExample": "string"
    },
    "lifeStrategy": {
      "strategyName": "Wait for the Invitation",
      "why": "string (why this matters)",
      "whenViolated": "string (consequences)",
      "examples": {
        "correct": ["✓ example", "✓ example"],
        "incorrect": ["✗ example", "✗ example"]
      },
      "practice": "string (this week, try...)"
    },
    "thisMonth": {
      "transitSummary": "Family Ties Activated",
      "whatYouMightNotice": ["•", "•", "•"],
      "recommendations": {
        "goodTime": ["✓", "✓", "✓"],
        "avoid": ["✗", "✗"]
      }
    },
    "workingWithOthers": {
      "youBring": ["•", "•", "•", "•"],
      "youNeed": ["•", "•", "•"],
      "thriveWith": "string (types of people)"
    }
  },
  
  "technicalInsights": {
    "geneKeys": [...],  // Shadow/Gift/Siddhi
    "iChing": [...],     // Hexagram wisdom
    "astrology": {...},  // Placements + aspects
    "numerology": {...}, // Life path, etc.
    "bazi": {...}        // Optional: Chinese astrology
  },
  
  "groundingAudit": {...}
}
```

---

## Implementation Checklist

- [ ] Add Quick Start section to `SYSTEM_PROMPT` in `synthesis.js`
- [ ] Update `buildReferenceFactsBlock()` to mark which data feeds Quick Start vs Technical
- [ ] Create archetype mapping table (Type → archetype name)
- [ ] Create authority plain-language templates (7 authority types)
- [ ] Create strategy plain-language templates (5 types)
- [ ] Test with 5 existing profiles, compare old vs new output
- [ ] User test with non-practitioners: "Can you explain your profile to a friend after reading?"
- [ ] A/B test: measure engagement (time on page, return visits)
- [ ] Deploy Quick Start as default, move technical to `/chart/detailed` page

---

## Success Criteria

**Before users finish reading, they should be able to answer**:
1. "Who am I?" → Pattern/archetype/core gift
2. "How should I decide?" → Specific decision protocol  
3. "What should I do differently this week?" → Concrete action step
4. "Why do I struggle with X?" → At least one "aha" moment

If they can't answer these → Quick Start needs work.  
If they can → ✅ Success!
