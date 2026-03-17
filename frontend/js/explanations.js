/**
 * Prime Self — Explanations Module
 * 
 * Centralized plain-English descriptions for every Energy Blueprint concept.
 * Used by renderChart(), renderTransits(), and renderComposite() 
 * to show "WHY it matters" alongside raw data.
 * 
 * Sources: Frequency Keys (Prime Self Research)
 */

// ── Type Explanations ──────────────────────────────────────────
window.TYPE_EXPLANATIONS = {
  'Generator': {
    short: 'You have consistent, renewable life force energy.',
    full: 'You\'re designed to find work you love and master it. When you\'re lit up, you\'re unstoppable. Your sacral response (gut feeling) is your compass — follow what genuinely excites you.'
  },
  'Manifesting Generator': {
    short: 'You have explosive multi-passionate energy.',
    full: 'Like a Generator with turbo mode — you can do many things at once and skip steps others can\'t. Honor your gut response AND your urge to initiate. Your speed is a feature, not a bug.'
  },
  'Projector': {
    short: 'You see what others miss.',
    full: 'Your gift is guiding and managing others\' energy — not doing the heavy lifting yourself. Wait to be recognized and invited before sharing your insights. When invited, your wisdom lands powerfully.'
  },
  'Manifestor': {
    short: 'You\'re designed to initiate and start things.',
    full: 'You have a closed, repelling aura that can feel intimidating to others. Your power is in informing people before you act — this prevents the resistance that naturally builds around your energy.'
  },
  'Reflector': {
    short: 'You mirror the health of your environment.',
    full: 'With no defined centers, you sample and reflect everyone around you. Your strategy is to wait a full lunar cycle (28 days) before major decisions. You are the ultimate barometer for community well-being.'
  }
};

// ── Authority Explanations ─────────────────────────────────────
window.AUTHORITY_EXPLANATIONS = {
  'Emotional': {
    short: 'Never decide in the heat of the moment.',
    full: 'You ride an emotional wave — highs and lows throughout each day. Important decisions need time. Sleep on it. Feel through both the excitement AND the doubt before choosing.'
  },
  'Emotional Authority': {
    short: 'Never decide in the heat of the moment.',
    full: 'You ride an emotional wave — highs and lows throughout each day. Important decisions need time. Sleep on it. Feel through both the excitement AND the doubt before choosing.'
  },
  'Sacral': {
    short: 'Trust your gut response — it knows instantly.',
    full: 'Your sacral center gives you clear yes/no signals through sounds ("uh-huh" / "unh-unh") or body sensations. Don\'t overthink. Ask yourself yes/no questions and listen for the gut response.'
  },
  'Sacral Authority': {
    short: 'Trust your gut response — it knows instantly.',
    full: 'Your sacral center gives you clear yes/no signals through sounds ("uh-huh" / "unh-unh") or body sensations. Don\'t overthink. Ask yourself yes/no questions and listen for the gut response.'
  },
  'Splenic': {
    short: 'Trust your first instinct — it\'s always right.',
    full: 'Your spleen speaks once, quietly, in the moment. It\'s a survival instinct that won\'t repeat itself. If something feels "off" for even a split second, honor that. Your body knows before your mind.'
  },
  'Splenic Authority': {
    short: 'Trust your first instinct — it\'s always right.',
    full: 'Your spleen speaks once, quietly, in the moment. It\'s a survival instinct that won\'t repeat itself. If something feels "off" for even a split second, honor that. Your body knows before your mind.'
  },
  'Ego': {
    short: 'Follow what your heart truly wants.',
    full: 'Your willpower center drives your decisions. Ask: "Do I truly have the heart for this?" If you can make and keep the commitment, it\'s correct. If not, don\'t make promises you can\'t keep.'
  },
  'Ego Authority': {
    short: 'Follow what your heart truly wants.',
    full: 'Your willpower center drives your decisions. Ask: "Do I truly have the heart for this?" If you can make and keep the commitment, it\'s correct. If not, don\'t make promises you can\'t keep.'
  },
  'Self-Projected': {
    short: 'Hear your truth by talking it out.',
    full: 'Your identity center speaks through your voice. When making decisions, talk to trusted people — not for their advice, but to hear your own truth emerge. Listen to what YOU say, not what they say back.'
  },
  'Self-Projected Authority': {
    short: 'Hear your truth by talking it out.',
    full: 'Your identity center speaks through your voice. When making decisions, talk to trusted people — not for their advice, but to hear your own truth emerge. Listen to what YOU say, not what they say back.'
  },
  'Mental': {
    short: 'Use your environment as a sounding board.',
    full: 'Neither your emotions nor your gut guide you — your clarity comes from discussing options with different people in different environments. Notice where and with whom you feel most clear.'
  },
  'None': {
    short: 'Wait a full lunar cycle before major decisions.',
    full: 'As a Reflector, you have no inner authority driving decisions. Wait 28+ days, discuss with trusted people, and notice how your clarity shifts with the Moon\'s transit through your chart.'
  },
  'Lunar': {
    short: 'Wait a full lunar cycle before major decisions.',
    full: 'As a Reflector, you have no inner authority driving decisions. Wait 28+ days, discuss with trusted people, and notice how your clarity shifts with the Moon\'s transit through your chart.'
  }
};

// ── Strategy Explanations ──────────────────────────────────────
window.STRATEGY_EXPLANATIONS = {
  'To Respond': {
    short: 'Wait for life to show you something, then check your gut.',
    full: 'Don\'t initiate from your mind. When something shows up — an opportunity, a question, a need — check your sacral response. Does it light you up? Your body knows before your brain.'
  },
  'Wait for the Invitation': {
    short: 'Your wisdom only lands when it\'s asked for.',
    full: 'Unsolicited advice from a Projector falls flat or creates bitterness. Wait until someone genuinely recognizes you and asks for your input. When the invitation is real, your guidance transforms people.'
  },
  'Inform Before Acting': {
    short: 'Tell people what you\'re about to do before you do it.',
    full: 'Your natural impulse is to just go. But people can\'t see it coming — your aura is closed and repelling. A simple heads-up ("I\'m going to…") removes resistance and lets your power flow freely.'
  },
  'Wait a Lunar Cycle': {
    short: 'Give yourself 28 days before any big decision.',
    full: 'The Moon transits through all 64 gates in ~28 days, temporarily activating each one in your open chart. You need that full cycle to feel all perspectives before you have real clarity.'
  }
};

// ── Profile Explanations ───────────────────────────────────────
window.PROFILE_EXPLANATIONS = {
  '1/3': {
    short: 'The Investigator-Martyr',
    full: 'You need a solid foundation of knowledge (1) and learn through trial-and-error (3). You\'re designed to break bonds that don\'t work and discover what does through experience.'
  },
  '1/4': {
    short: 'The Investigator-Opportunist',
    full: 'You research deeply (1) and share through your network (4). Your influence spreads through personal connections — who you know matters as much as what you know.'
  },
  '2/4': {
    short: 'The Hermit-Opportunist',
    full: 'You have natural talent that needs alone time to develop (2), then opportunities come through your network (4). Others see your gifts before you do — accept the call when it comes.'
  },
  '2/5': {
    short: 'The Hermit-Heretic',
    full: 'You need solitude to access your natural genius (2), and others project savior expectations onto you (5). When you emerge, people expect practical solutions — and you deliver.'
  },
  '3/5': {
    short: 'The Martyr-Heretic',
    full: 'You learn by trial-and-error (3) and others project expectations onto you (5). Embrace "failing forward" — every bond you break teaches you something that eventually benefits everyone.'
  },
  '3/6': {
    short: 'The Martyr-Role Model',
    full: 'You learn through intense experience until ~30 (3), then step back to observe until ~50 (6). Your life has three acts, and the wisdom you gain becomes your authority.'
  },
  '4/6': {
    short: 'The Opportunist-Role Model',
    full: 'Your network is everything (4), and you\'re on a three-phase life journey to become a role model (6). Your influence comes through being a living example to your community.'
  },
  '4/1': {
    short: 'The Opportunist-Investigator',
    full: 'You influence through your network (4) backed by deep research (1). You need both a solid foundation of knowledge AND the right connections to fulfill your purpose.'
  },
  '5/1': {
    short: 'The Heretic-Investigator',
    full: 'Others project savior expectations onto you (5), and you back it up with deep investigation (1). You\'re the practical problem-solver people turn to in crisis — and you deliver because you\'ve done the research.'
  },
  '5/2': {
    short: 'The Heretic-Hermit',
    full: 'Others project expectations onto you (5) while you have natural gifts that need solitude to develop (2). The call to help others is strong, but protecting your alone time is essential.'
  },
  '6/2': {
    short: 'The Role Model-Hermit',
    full: 'You\'re on a three-act life journey (6) with natural gifts that emerge in isolation (2). By midlife, you become a wise guide — but only when you honor your need for retreat.'
  },
  '6/3': {
    short: 'The Role Model-Martyr',
    full: 'Three life phases toward role model wisdom (6) combined with relentless experimentation (3). Your early life is messy by design — every "failure" builds the authority you\'ll embody later.'
  }
};

// ── Center Explanations ────────────────────────────────────────
window.CENTER_EXPLANATIONS = {
  'Head': {
    governs: 'Inspiration & mental pressure',
    defined: 'You have a consistent source of questions, inspiration, and mental pressure. You know what\'s worth thinking about.',
    open: 'You amplify others\' inspiration and can feel overwhelmed by mental pressure that isn\'t yours. Not every question needs YOUR answer.'
  },
  'Ajna': {
    governs: 'Processing & conceptualization',
    defined: 'You have a fixed way of processing and conceptualizing information. Your mind is reliable and consistent.',
    open: 'You can see things from multiple perspectives — a gift for understanding others. Don\'t get attached to any single opinion.'
  },
  'Throat': {
    governs: 'Communication & manifestation',
    defined: 'You have a consistent voice, expression style, and ability to manifest things into form through communication.',
    open: 'Your communication style adapts to your environment. You attract attention when you\'re not trying to. Let speech come naturally.'
  },
  'G': {
    governs: 'Identity, love & direction',
    defined: 'You have a strong, consistent sense of who you are, where you\'re going, and what love means to you.',
    open: 'Your identity and sense of direction shift with your environment. Place matters — where you are determines who you become.'
  },
  'Heart': {
    governs: 'Willpower & ego',
    defined: 'You have reliable willpower and can make and keep promises. Your self-worth is naturally strong.',
    open: 'Don\'t make promises or try to prove your worth. Your value isn\'t measured by productivity. Rest without guilt.'
  },
  'SolarPlexus': {
    governs: 'Emotions & feelings',
    defined: 'You ride an emotional wave — your moods have a reliable rhythm. You\'re emotionally powerful and feel everything deeply.',
    open: 'You amplify and absorb others\' emotions. That intense feeling may not be yours. Ask: "Is this my emotion or someone else\'s?"'
  },
  'Sacral': {
    governs: 'Life force & work energy',
    defined: 'You have sustainable, powerful energy for work you love. Your gut response is your decision-making compass.',
    open: 'You don\'t have consistent work energy — you borrow and amplify others\'. Know when enough is enough. Rest is productive for you.'
  },
  'Spleen': {
    governs: 'Intuition, health & survival',
    defined: 'You have a reliable immune system and strong survival instincts. Your intuition speaks once — trust it the first time.',
    open: 'You\'re health-sensitive and highly intuitive about others\' well-being. Be vigilant about boundaries around sickness and fear.'
  },
  'Root': {
    governs: 'Adrenaline, stress & drive',
    defined: 'You have a consistent relationship with pressure and drive. Stress fuels rather than overwhelms you.',
    open: 'You amplify pressure and stress from your environment. Set boundaries around urgency — not everything is as urgent as it feels.'
  }
};

// ── Channel Descriptions (from channels.json data) ─────────────
window.CHANNEL_DESCRIPTIONS = {
  '1-8':   { name: 'Inspiration', desc: 'Creative expression that inspires others — your unique contribution to the world.' },
  '2-14':  { name: 'The Beat', desc: 'A powerful drive direction guided by higher knowing — following your own rhythm.' },
  '3-60':  { name: 'Mutation', desc: 'Bringing new things into being through pulses of melancholy and breakthrough — the engine of evolution.' },
  '4-63':  { name: 'Logic', desc: 'Mental pressure to find answers and formulate theories — a logical, pattern-seeking mind.' },
  '5-15':  { name: 'Rhythms', desc: 'Connecting to the flow of universal rhythms — a natural sense of timing and seasonal awareness.' },
  '6-59':  { name: 'Intimacy', desc: 'An emotional drive for intimacy and bonding — creating and dissolving barriers in relationships.' },
  '7-31':  { name: 'The Alpha', desc: 'Democratic leadership through influence — guiding others by earning their trust, not demanding it.' },
  '9-52':  { name: 'Concentration', desc: 'An ability to focus deeply on details — determination and stillness that leads to mastery.' },
  '10-20': { name: 'Awakening', desc: 'Spontaneous self-expression in the now — living authentically without needing to explain yourself.' },
  '10-34': { name: 'Exploration', desc: 'Power to follow your own convictions — an independent spirit that lives by its own rules.' },
  '10-57': { name: 'Perfected Form', desc: 'Intuitive self-awareness — surviving and thriving by trusting your instinctual sense of self.' },
  '11-56': { name: 'Curiosity', desc: 'A storyteller and seeker of ideas — stimulating others through the sharing of experience.' },
  '12-22': { name: 'Openness', desc: 'Social grace that opens others emotionally — expressing warmth, passion, and individual feeling.' },
  '13-33': { name: 'The Prodigal', desc: 'A witness and keeper of experience — listening to and reflecting on life\'s lessons for others.' },
  '16-48': { name: 'The Wavelength', desc: 'Mastery through practice and depth — talent that develops through dedicated repetition.' },
  '17-62': { name: 'Acceptance', desc: 'Organizing and expressing detailed opinions — making complex logic understandable to others.' },
  '18-58': { name: 'Judgment', desc: 'A drive to correct and perfect — an instinct for spotting what can be improved.' },
  '19-49': { name: 'Synthesis', desc: 'Tribal sensitivity to needs and principles — knowing when to include or exclude for the group\'s survival.' },
  '20-34': { name: 'Charisma', desc: 'Busy-ness that looks effortless — being fully present and absorbed in whatever you\'re doing.' },
  '20-57': { name: 'The Brainwave', desc: 'Intuitive awareness expressed in the now — penetrating insights that emerge spontaneously.' },
  '21-45': { name: 'The Money Line', desc: 'Willful control over material resources — the natural manager and provider for the tribe.' },
  '23-43': { name: 'Structuring', desc: 'Individual knowing expressed as insight — breakthroughs that can sound genius or crazy, depending on timing.' },
  '24-61': { name: 'Awareness', desc: 'Inspiration dissolving into inner knowing — mental pressure that leads to mystical understanding.' },
  '25-51': { name: 'Initiation', desc: 'Competitive spirit guided by universal love — the courage to lead others into new territory.' },
  '26-44': { name: 'Surrender', desc: 'Recognizing and transmitting patterns of success — an instinct for what the community will value.' },
  '27-50': { name: 'Preservation', desc: 'Caring for and maintaining the wellbeing of the tribe — nourishment through responsibility and values.' },
  '28-38': { name: 'Struggle', desc: 'An individual fight for meaning — stubbornly persisting through challenges to find purpose.' },
  '29-46': { name: 'Discovery', desc: 'Saying yes to experience and being in the right place — luck through commitment and embodiment.' },
  '30-41': { name: 'Recognition', desc: 'Emotional desire fueling new experiences — the pressure to feel deeply and imagine new possibilities.' },
  '32-54': { name: 'Transformation', desc: 'Ambition driven by instinct — knowing which efforts will transform and endure over time.' },
  '34-57': { name: 'Power', desc: 'Raw intuitive power — the ability to respond to threats and opportunities with pure instinct.' },
  '35-36': { name: 'Transitoriness', desc: 'An emotional drive to seek new experiences — restlessness that leads to crisis and then emotional growth.' },
  '37-40': { name: 'Community', desc: 'Bargains of love and support — the willingness to serve the community in exchange for belonging.' },
  '39-55': { name: 'Emoting', desc: 'Emotional provocation and spirit — using mood and creativity to move others into deeper feeling.' },
  '42-53': { name: 'Maturation', desc: 'Cycles of beginning and completing — energy that needs to finish what it starts to feel whole.' },
  '47-64': { name: 'Abstraction', desc: 'Making sense of the past — visual or abstract thinking that occasionally produces "aha" clarity.' }
};

// ── Gate Names (from gate_wheel.json) ──────────────────────────
window.GATE_NAMES = {
  1: 'The Creative', 2: 'The Receptive', 3: 'Difficulty at the Beginning', 4: 'Youthful Folly',
  5: 'Waiting', 6: 'Conflict', 7: 'The Army', 8: 'Holding Together',
  9: 'Taming Power of the Small', 10: 'Treading', 11: 'Peace', 12: 'Standstill',
  13: 'Fellowship', 14: 'Possession in Great Measure', 15: 'Modesty', 16: 'Enthusiasm',
  17: 'Following', 18: 'Work on the Decayed', 19: 'Approach', 20: 'Contemplation',
  21: 'Biting Through', 22: 'Grace', 23: 'Splitting Apart', 24: 'Return',
  25: 'Innocence', 26: 'Taming Power of the Great', 27: 'Nourishment', 28: 'Preponderance of the Great',
  29: 'The Abysmal', 30: 'The Clinging', 31: 'Influence', 32: 'Duration',
  33: 'Retreat', 34: 'Power of the Great', 35: 'Progress', 36: 'Darkening of the Light',
  37: 'The Family', 38: 'Opposition', 39: 'Obstruction', 40: 'Deliverance',
  41: 'Decrease', 42: 'Increase', 43: 'Breakthrough', 44: 'Coming to Meet',
  45: 'Gathering Together', 46: 'Pushing Upward', 47: 'Oppression', 48: 'The Well',
  49: 'Revolution', 50: 'The Caldron', 51: 'The Arousing', 52: 'Keeping Still',
  53: 'Development', 54: 'The Marrying Maiden', 55: 'Abundance', 56: 'The Wanderer',
  57: 'The Gentle', 58: 'The Joyous', 59: 'Dispersion', 60: 'Limitation',
  61: 'Inner Truth', 62: 'Preponderance of the Small', 63: 'After Completion', 64: 'Before Completion'
};

// ── Not-Self Theme Explanations ────────────────────────────────
window.NOT_SELF_EXPLANATIONS = {
  'Frustration': 'This signals you\'re not doing work that lights you up. Frustration is your alarm — redirect toward what genuinely excites your gut.',
  'Bitterness': 'This means you\'re giving wisdom without being invited. When you feel bitter, stop advising. Wait for genuine recognition.',
  'Anger': 'This happens when you don\'t inform before acting. People resist what they can\'t see coming. A simple heads-up dissolves the anger.',
  'Disappointment': 'This comes from making decisions too quickly. You need a full lunar cycle to feel through all perspectives. Patience is your power.'
};

// ── Definition Explanations ────────────────────────────────────
window.DEFINITION_EXPLANATIONS = {
  'Single': 'All your defined centers connect in one continuous circuit. You process information and energy in a consistent, self-contained way.',
  'Split': 'You have two separate areas of definition. You naturally seek out people who "bridge" the gap between them — these people feel essential to you.',
  'Triple Split': 'Three separate areas of definition give you a complex inner world. You need multiple different people to feel complete. Patience with your own process is key.',
  'Quadruple Split': 'Four separate definition areas make you deeply fixed in your nature. You process slowly but thoroughly. Don\'t rush decisions — your complexity is your strength.',
  'No Definition': 'As a Reflector, you have no fixed definition. You\'re completely open to sampling and reflecting the energy around you. Your environment IS your design.'
};

// ── Gate Themes (condensed from gates.json) ────────────────────
window.GATE_THEMES = {
  1: 'Original Creative Expression',
  2: 'Devoted receptivity as the foundation of authentic direction',
  3: 'Patient Creative Gestation',
  4: 'Cultivating understanding through methodical inquiry',
  5: 'Patient readiness and natural timing',
  6: 'Emotional wisdom in conflict navigation',
  7: 'Leadership through magnetic presence',
  8: 'Magnetic contribution through authentic expression',
  9: 'The Power of Concentrated Focus',
  10: 'Authentic conduct through mindful presence',
  11: 'Mental Recognition of Peace',
  12: 'The voice of transcendent perspective',
  13: 'The Fellowship of Shared Stories',
  14: 'Creative Abundance Through Authentic Expression',
  15: 'Magnetic Humility',
  16: 'Enthusiastic Expression of Mastery',
  17: 'Mental Following and Sequential Organization',
  18: 'Intuitive Recognition of What Needs Correction',
  19: 'Sensitive approach to what sustains life',
  20: 'Contemplative Expression',
  21: 'Biting through obstacles with willful control',
  22: 'Graceful Expression Through Emotional Refinement',
  23: 'Expressing essential truth through necessary dissolution',
  24: 'Cyclical Mental Renewal',
  25: 'Authentic Innocence',
  26: 'The Great Accumulator',
  27: 'Nourishing responsibility through embodied care',
  28: 'The courage to risk for purpose',
  29: "Sacred commitment to life's depths",
  30: 'Illuminating wisdom through emotional fire',
  31: 'Magnetic Expression of Authentic Influence',
  32: 'Instinctive recognition of lasting value',
  33: 'Strategic Withdrawal and Selective Engagement',
  34: 'Power with purpose',
  35: 'The drive for experiential advancement',
  36: 'Emotional alchemy through crisis navigation',
  37: 'Emotional wisdom for family prosperity',
  38: 'Sacred Opposition',
  39: 'Catalytic provocation through strategic pressure',
  40: 'Willful Liberation Through Release',
  41: 'The pressure to diminish for renewal',
  42: 'Sustainable completion through dedicated cultivation',
  43: 'Breakthrough Insight',
  44: 'Instinctive tribal discernment',
  45: 'Gathering the tribe through voice',
  46: 'Ascending through dedicated effort',
  47: 'Understanding through constraint',
  48: 'Intuitive recognition of depth and substance',
  49: 'Revolutionary Emotional Wisdom',
  50: 'Sacred stewardship of collective nourishment',
  51: 'Thunderous awakening through shock',
  52: 'Purposeful Stillness',
  53: 'Gradual Development Through Natural Stages',
  54: 'Strategic Ascension Through Tribal Alliance',
  55: 'Recognizing inherent abundance through emotional depth',
  56: 'Stimulating consciousness through experiential storytelling',
  57: 'Gentle penetration through intuitive persistence',
  58: 'Vital joy in improvement',
  59: 'Dissolving barriers to authentic connection',
  60: 'Mastering creative constraint',
  61: 'Inner Truth Through Direct Knowing',
  62: 'Precision in Expression',
  63: 'Constructive doubt after completion',
  64: 'Mental synthesis before completion'
};

// ── Signature (aligned state) Explanations ─────────────────────
window.SIGNATURE_EXPLANATIONS = {
  'Satisfaction': 'When you are in your flow — responding to what truly lights you up and mastering it — you feel deep satisfaction. This is your compass that you are living correctly.',
  'Peace': 'When you inform before acting and let go of resistance, a profound inner peace settles in. This is your signal that you are operating in alignment.',
  'Success': 'When you wait for genuine recognition and invitation before sharing your wisdom, you experience outer success that feels effortless. Wait for it.',
  'Surprise': 'When you honor the lunar cycle and stop trying to be consistent, life surprises you with magic. Delight and wonder are your natural state when correctly placed.'
};

// ── Gate Explanations (plain-English, beginner-first) ──────────
// Each entry answers: "What does having this gate mean for me in daily life?"
window.GATE_EXPLANATIONS = {
  1:  'You carry the energy of original self-expression. Your greatest contribution is authenticity, not imitation — the world needs what only YOU can create. Don\'t dim your light to fit in.',
  2:  'You have a deep inner compass that always knows your true direction, even when your mind can\'t explain it. Trust that pull. Your body knows where you need to go before your logic catches up.',
  3:  'You\'re designed to birth new things — and that means starting is always messy. Your energy transforms chaos into order, but only when you\'re patient with the process. Breakthrough always follows the struggle.',
  4:  'You have a restless mind that constantly solves problems and asks "how?" and "why?" Your solutions are genuinely valuable — but only when someone actually invites you to share. Wait to be asked.',
  5:  'You operate on natural timing, not human schedules. You thrive through consistent habits and rhythms. When you try to force things ahead of their natural pace, everything stalls — trust the timing.',
  6:  'You have an emotional intelligence that knows exactly when to open up and when to protect yourself. You instinctively feel who is genuinely safe to connect with. Trust that read — it\'s your protection.',
  7:  'You are a natural guide who can recognize the right leader for any situation. People look to you to direct them to whoever can lead well. Your influence comes from helping others find the right direction.',
  8:  'You have a magnetic ability to make a unique contribution that holds people together. When you express what\'s genuinely different about you — rather than what you think people want — you naturally attract your tribe.',
  9:  'You have a gift for focused, sustained attention on details others overlook. This concentrated energy is a form of power — you can master anything you choose to focus on completely.',
  10: 'How you live your life IS your greatest teaching. Walking your truth authentically, without apology, is your path and your purpose. Others are watching how you live — not what you say.',
  11: 'Your mind streams ideas and possibilities constantly. Not all of them are yours to act on — many are simply for you to recognize and share when the timing is right. Discern which ideas are seeds, not just passing inspiration.',
  12: 'You carry a voice that can express truth in a way that transcends ordinary conversation. Your words carry weight — but only when the timing is aligned. Silence is power for you too; don\'t speak before it\'s right.',
  13: 'You are built to listen and hold others\' stories without judgment. People naturally trust you with their truths and histories. You are a witness — and your compassionate attention transforms the people who feel truly seen by you.',
  14: 'You carry powerful creative energy that generates material and creative abundance — but only when it\'s directed toward work YOU genuinely love. When passion and work align, you become a force of nature.',
  15: 'You naturally embrace the full range of human experience — the unconventional, the extreme, the misunderstood. Your wide acceptance of human diversity is your superpower. You help others feel normal.',
  16: 'You have contagious enthusiasm for what you love. Your excitement draws people in naturally. Develop your passion through dedicated practice, and your genuine mastery will inspire others to believe in themselves.',
  17: 'You have a logical, sequential mind that organizes information into clear opinions and conclusions. Your insights are genuinely valuable — but only when people ask. Wait for the invitation before sharing what you think.',
  18: 'You have a sharp instinct for what\'s broken, inefficient, or past its time. This critical eye is a gift when applied to things you genuinely care about and when the criticism is invited. You are a fixer, not a complainer.',
  19: 'You feel needs — yours, others\', the group\'s — with acute clarity. You know what it takes for communities to feel safe and cared for. Honor your own sensitivity; it\'s not weakness, it\'s your most precise instrument.',
  20: 'You live in the present moment. Your words have power when they arise spontaneously from genuine presence. Pre-scripted communication feels hollow to you. Speak from NOW, not from a script.',
  21: 'You need control over your own resources and domain. When you\'re in charge, your drive and force are extraordinary. Resistance comes when others try to control what you feel is rightfully yours to manage.',
  22: 'You carry social grace that moves people through emotional authenticity. In the right mood, your presence is magnetic and transformative. Honor your emotional rhythms — don\'t perform when you\'re not feeling it.',
  23: 'You receive insights that dissolve old ways of seeing — ideas that can sound like genius or madness depending on timing. Wait to be invited before sharing your insights; the right moment determines whether they land.',
  24: 'Your mind returns again and again to the same questions, spiraling closer to understanding with every cycle. Don\'t rush your process. The clarity you seek comes from completing the inner loop, not forcing a quick answer.',
  25: 'You carry a universal love for all living things — not just your inner circle. Acting from that pure, unconditioned love is your path. When you\'re truly selfless in your intentions, your impact is profound.',
  26: 'You have an instinctive talent for recognizing what\'s valuable and knowing how to share it persuasively. You can promote, sell, and influence — but your power is anchored in genuine belief in what you\'re promoting.',
  27: 'You feel called to care for, nourish, and be responsible for others\' wellbeing. This caring energy is beautiful and powerful — AND you must protect yourself from those who take without reciprocating.',
  28: 'You have the endurance of a warrior when you\'re fighting for something that matters to you. The challenge is finding what\'s worth the struggle. When you know your "why," your tenacity is unmatched.',
  29: 'You are built for full commitment. When your gut says YES to something, you can go deeper and sustain longer than almost anyone. The trap is saying yes to things your gut isn\'t truly in — exhaustion follows every half-hearted commitment.',
  30: 'You are fueled by desire — a hunger for more life, more feeling, more experience. This emotional fire is your creative engine. Channel it consciously and it drives you to extraordinary experiences.',
  31: 'You carry natural influence that grows when people choose to listen to you — not when you demand it. Speak from your democratic impulse to serve the collective, not from ego, and your voice resonates widely.',
  32: 'You have an instinctive sense of what will last and what won\'t. You evaluate everything through the lens of sustainability and longevity. This gift keeps you and your community from wasting energy on dead ends.',
  33: 'You are a keeper of experience — your own and others\'. But wisdom needs to be digested before it can be transmitted. Honor your need for solitude and retreat; the withdrawal IS part of your contribution.',
  34: 'You carry one of the most powerful energies in your design — a raw, responsive force that moves mountains when expressed in response to what life brings. Acting before you feel the call turns this power against you.',
  35: 'You hunger for new experience, new challenges, new places, new people. Boredom is a signal: time to move. You are designed to seek the frontier. Growth through experience is your nature and your joy.',
  36: 'You are built to navigate emotional crises and come out the other side transformed. You\'ve moved through darkness others haven\'t, which gives you a depth of empathy and resilience that is genuinely extraordinary.',
  37: 'You understand the invisible agreements that hold communities together. Your emotional intelligence creates the feeling of "family" — safety, loyalty, belonging — wherever you go. Honor the agreements you make.',
  38: 'You have a warrior energy that resists what feels purposeless. Opposition is your teacher — it helps you discover whether something is worth fighting for. When you find your cause, your determination is unbreakable.',
  39: 'You have a provocateur energy that stirs people out of complacency and into their own spirit. Your provocations, when they come from a genuine love for others\' growth, are powerful catalysts for awakening.',
  40: 'You have an enormous capacity for work and service — AND an equal need for solitude and rest. You can carry great burdens for the people you love, but only when there\'s a real, fair exchange. Protect your alone time fiercely.',
  41: 'You carry the spark that starts every new cycle — a pressure of imagination and desire for new experience. All creativity in your energy blueprint begins with you. Choose which desires are worth pursuing; you can\'t chase them all.',
  42: 'You are built for completion. You have the energy to see cycles all the way through — and you must. Unfinished projects drain your vitality. Commit only to what you can fully complete, then go all the way.',
  43: 'You receive breakthrough insights that arrive whole — without a logical trail to follow. Your inner knowing is ahead of your words. Learn to translate your knowing into language others can receive; it\'s your challenge and your gift.',
  44: 'You have an instinctive memory for patterns — especially what has worked and failed before. You read situations through your body, not your mind. Trust that sense of recognition or unease; it\'s your most ancient intelligence.',
  45: 'You carry the voice of collective leadership. When you speak to direct shared resources and direction, people listen. Your challenge is to lead with genuine care for the community, not just from authority.',
  46: 'When you are fully embodied and in the right place at the right time, life seems to conspire in your favor. You succeed not through force but through showing up completely. Love your physical body — it\'s your compass.',
  47: 'Your mind processes experience slowly, searching for the insight hidden in complexity. You may feel stuck or confused — but eventually, you always extract the gem of understanding. Your perspective on limitation is a profound gift.',
  48: 'You carry deep, inexhaustible wells of wisdom and skill that deepen over a lifetime. Your greatest enemy is the fear that you\'re not ready enough. You are almost always more prepared than you feel. Share your depth.',
  49: 'You carry revolutionary emotional intelligence — knowing when relationships, communities, and values need to be transformed. Your emotional read on what must change is your guidance. Act from principle, not reaction.',
  50: 'You carry the values that keep communities safe and whole. You are a steward of what matters — not a rule-follower, but a guardian of what is genuinely important. When you honor your own values, others benefit.',
  51: 'You carry the shock of initiation — the courage to leap into the unknown first. You are built to encounter life\'s sudden shocks and survive them transformed. Your competitive spirit pushes others to discover their own courage.',
  52: 'Stillness is your power. When everything else is moving, you can hold completely still — and from that stillness, genuine insight arises. Don\'t let others rush you. Your stillness is not passivity; it\'s concentration.',
  53: 'You initiate cycles of gradual, natural development. Things grow through you at their own organic pace — and they need to. When you try to rush the process, it doesn\'t stick. Trust the stages and see them through.',
  54: 'You carry driven ambition in service of something bigger than yourself. You have a strategic instinct for the alliances and movements that can transform your circumstances. Ambition anchored in authentic relationships lifts everyone.',
  55: 'Your emotional state is your creative weather. You can feel profound abundance — overflowing with creativity, love, and inspiration — and equally profound emptiness. Both are valid. Follow the mood to find the right action.',
  56: 'You are a natural storyteller who processes the world through narrative. You translate complex experience into vivid, stimulating stories and metaphors. Your gift is making abstract, intimidating ideas feel human-sized and accessible.',
  57: 'You have pure intuition that speaks in the present moment — once. Your body knows before your mind does. A flash of clarity, a sensation of unease, a moment of rightness — catch that first signal and trust it completely.',
  58: 'You carry the pure joy of improvement and aliveness. You are stimulated by what could be better and get genuine pleasure from the process of optimizing. When you apply this to something you love, your energy is infectious.',
  59: 'You have a natural ability to dissolve barriers to intimacy — to create genuine closeness where walls once stood. Use this power consciously: your ability to connect is profound, and connection requires genuine care.',
  60: 'You feel the pressure of limits acutely — and those limits are where your creativity is born. Working within constraints rather than fighting them is where your real power lives. Limitation is your creative ignition.',
  61: 'You receive flashes of inner truth — direct knowing that comes from somewhere beyond your mind. You\'re built to seek universal understanding and inspire others to do the same. Live your knowing; don\'t wait for other people\'s validation.',
  62: 'You perceive the world in precise detail and have a gift for naming things accurately. The right words, the exact specification, the correct categorization — these matter enormously to you. Your precision creates clarity for others.',
  63: 'You have a logical mind that stress-tests what\'s been built. Your doubt is responsible, not pessimistic — it protects communities from building on shaky ground. After something is finished, you ask: "Will this actually hold?" Good.',
  64: 'You hold the full complexity of past experience, searching for the unifying truth within it. Confusion is your starting point, not your ending point. Clarity arrives in flashes — the pressure you feel is the engine of your insight.'
};

// ── Zodiac Sign Explanations ───────────────────────────────────
// Plain-English meanings for the 12 signs. Used to explain planetary placements.
window.SIGN_EXPLANATIONS = {
  'Aries':       { short: 'Bold & pioneering', full: 'Aries energy is bold, direct, and first. It initiates action without overthinking, brings courage to the front, and pushes through obstacles with pure drive. In the planet it flavors: expect decisiveness, urgency, and the need to lead.' },
  'Taurus':      { short: 'Steady & sensory', full: 'Taurus energy is grounded, patient, and pleasure-loving. It builds slowly but builds to last, values beauty and security, and needs a stable foundation. In the planet it flavors: expect consistency, sensory richness, and a deep need for safety.' },
  'Gemini':      { short: 'Curious & communicative', full: 'Gemini energy is curious, quick, and multi-faceted. It processes the world through language and connection, thrives on variety, and links ideas and people. In the planet it flavors: expect adaptability, curiosity, and a need for mental stimulation.' },
  'Cancer':      { short: 'Nurturing & intuitive', full: 'Cancer energy is sensitive, protective, and deeply feeling. It creates belonging, holds emotional memory, and cares fiercely for what it calls home. In the planet it flavors: expect emotional depth, the need to nurture and be nurtured, and strong intuition.' },
  'Leo':         { short: 'Radiant & expressive', full: 'Leo energy is warm, creative, and magnetic. It needs to be seen, celebrated, and to create things that light up the room. In the planet it flavors: expect a desire to shine, a generous spirit, and a need for recognition and play.' },
  'Virgo':       { short: 'Precise & service-minded', full: 'Virgo energy is analytical, discerning, and devoted to improving. It processes details others miss and finds meaning through service and craft. In the planet it flavors: expect perfectionism, a drive to serve and fix, and a mind that notices everything.' },
  'Libra':       { short: 'Harmonious & relational', full: 'Libra energy is social, balanced, and justice-seeking. It thrives in partnership, weighs every side before deciding, and creates beauty and fairness. In the planet it flavors: expect diplomacy, a need for balance, and deep investment in relationships.' },
  'Scorpio':     { short: 'Intense & transformative', full: 'Scorpio energy is deep, magnetic, and unafraid of darkness. It digs beneath the surface, seeks truth above all, and transforms everything it touches. In the planet it flavors: expect intensity, emotional power, and an instinct to uncover what\'s hidden.' },
  'Sagittarius': { short: 'Expansive & truth-seeking', full: 'Sagittarius energy is adventurous, philosophical, and free-spirited. It seeks meaning, fire, and the horizon — always looking for the bigger picture. In the planet it flavors: expect optimism, a love of freedom and truth, and the urge to grow beyond limitations.' },
  'Capricorn':   { short: 'Disciplined & strategic', full: 'Capricorn energy is patient, ambitious, and built for the long game. It builds structures that endure, accepts no shortcuts, and earns its authority. In the planet it flavors: expect discipline, a mastery mindset, and dedication to what truly lasts.' },
  'Aquarius':    { short: 'Innovative & unconventional', full: 'Aquarius energy is visionary, collective-minded, and rule-breaking by nature. It sees humanity as a whole, challenges outdated systems, and imagines what\'s possible. In the planet it flavors: expect originality, a need for freedom, and a gift for group thinking.' },
  'Pisces':      { short: 'Intuitive & boundless', full: 'Pisces energy is compassionate, mystical, and deeply empathic. It feels everything, dissolves boundaries, and connects to something larger than the individual. In the planet it flavors: expect sensitivity, imagination, spiritual depth, and the need for creative or spiritual outlets.' }
};

// ── Astrological House Explanations ───────────────────────────
// What each of the 12 houses governs in plain, beginner-friendly terms.
window.HOUSE_EXPLANATIONS = {
  1:  { name: 'Self & Identity',      full: 'The 1st House is YOU — your body, your appearance, how you naturally walk into a room. It\'s the "I am" of your chart. Planets here shape your personality and how others first experience you.' },
  2:  { name: 'Money & Values',       full: 'The 2nd House governs what you own, earn, and value — material security, possessions, and self-worth. Planets here show how you relate to money, what you consider truly yours, and how you build financial security.' },
  3:  { name: 'Communication',        full: 'The 3rd House rules how you think and speak — your communication style, your relationship with siblings, your immediate neighborhood, and short trips. Planets here shape your mind and how you express it.' },
  4:  { name: 'Home & Roots',         full: 'The 4th House is the foundation — your family, your childhood, your private life, and the physical home. It\'s where you came from. Planets here reveal your emotional bedrock and what "home" means to you.' },
  5:  { name: 'Creativity & Play',    full: 'The 5th House is where you shine — creativity, romance, children, fun, and self-expression. It\'s the joy center of your chart. Planets here show what you love to create, how you love, and where you truly play.' },
  6:  { name: 'Health & Daily Work',  full: 'The 6th House governs your daily routines, physical health, work habits, and service to others. Planets here shape how you maintain yourself, what your "daily" feels like, and how you show up to work.' },
  7:  { name: 'Partnership',          full: 'The 7th House is one-on-one relationships — your committed partnerships, marriage, and even adversaries. Planets here reveal what you seek and project onto others, and what you attract in significant relationships.' },
  8:  { name: 'Transformation',       full: 'The 8th House rules depth, shared resources, sex, death, rebirth, and other people\'s money. Planets here show how you handle deep intimacy, crisis, and the transformative experiences that change you forever.' },
  9:  { name: 'Beliefs & Adventure',  full: 'The 9th House governs higher learning, long-distance travel, philosophy, religion, and the search for meaning. Planets here reveal your beliefs, your love of adventure, and the frameworks you use to make sense of the world.' },
  10: { name: 'Career & Legacy',      full: 'The 10th House is your public reputation, career, ambitions, and legacy — what you\'re known for. It\'s the most visible part of your chart. Planets here shape your professional path and how the world sees your achievements.' },
  11: { name: 'Community & Hopes',    full: 'The 11th House rules friends, groups, networks, social causes, and your vision for the future. Planets here shape how you relate to your community, who your people are, and your dreams for the collective.' },
  12: { name: 'Inner World',          full: 'The 12th House is the hidden realm — solitude, the unconscious, spirituality, and things beneath the surface. Planets here operate quietly, often unseen even by you. This is the space of retreat, healing, and deep inner work.' }
};

// ── Helper: Get explanation HTML for a value ───────────────────
window.getExplanation = function(map, key) {
  if (!key || !map) return '';
  const entry = map[key] || map[key.trim()];
  if (!entry) return '';
  const text = typeof entry === 'string' ? entry : entry.full || entry.short || '';
  return text ? `<div class="explanation-text">${text}</div>` : '';
};

window.getShortExplanation = function(map, key) {
  if (!key || !map) return '';
  const entry = map[key] || map[key.trim()];
  if (!entry) return '';
  return typeof entry === 'string' ? entry : entry.short || '';
};

// ── Helper: Get channel info from channel code ─────────────────
window.getChannelInfo = function(channelKey) {
  if (!channelKey) return null;
  // Normalize: "20-34" or "34-20" should both find "20-34"
  const parts = String(channelKey).split('-').map(Number).sort((a, b) => a - b);
  const normalized = parts.join('-');
  return window.CHANNEL_DESCRIPTIONS[normalized] || null;
};

// ── Helper: Get gate name ──────────────────────────────────────
window.getGateName = function(gateNum) {
  return window.GATE_NAMES[Number(gateNum)] || null;
};

window.DEBUG && console.log('[Explanations] Module loaded — types, authorities, strategies, profiles, centers, channels, gates');
