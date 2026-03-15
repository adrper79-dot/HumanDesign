# Prime Self — Monetization Plan 2026
**Created**: March 12, 2026  
**Updated**: March 13, 2026 — Superseded by HD_UPDATES3 (Practitioner-First Revenue Architecture)  
**Status**: See `docs/HD_UPDATES3.txt` for current approved pricing. Sections below preserved for historical reference.

> **⚠️ HD_UPDATES3 SUPERSEDES THIS DOCUMENT**
> The tier names, prices, and feature matrix below were replaced on 2026-03-13.
> **Current pricing**: Free / Individual $19/mo / Practitioner $97/mo / Agency $349/mo  
> **Current DB keys**: `free` / `individual` (was `regular`) / `practitioner` / `agency` (was `white_label`)  
> **Revenue share**: 25% recurring credit to practitioner-referrers on every subscriber payment  
> **One-time products**: Single synthesis $19, Composite reading $29, 30-day transit pass $12, Lifetime $299  
> See `workers/src/lib/stripe.js` `getTierConfig()` and `getOneTimeProducts()` for live config.
> The tables and examples below are preserved for audit history only and should not be used for current pricing, setup, or customer-facing decisions.

---

## 1. Revised Tier Structure

Four tiers. Studio tier revived for resellers/enterprise — infrastructure already half-built.

| | **Free** | **Explorer** $12/mo | **Guide** $60/mo | **Studio** $149/mo |
|---|---|---|---|---|
| **DB key** | `free` | `regular` | `practitioner` | `white_label` |
| **Syntheses/month** | 1 | 30 | 200 | 1,000 |
| **AI questions/month** | 5 | 30 | 200 | 1,000 |
| **Daily synth ceiling** | 1 | 10 | 20 | 50 |
| **Daily question ceiling** | 5 | 15 | 50 | 100 |
| **Chart calculations** | 1/month | Unlimited | Unlimited | Unlimited |
| **Astrological reading** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Transit tracking** | Today snapshot only | Full + 30-day forecast | Full + 30-day forecast | Full + 30-day forecast |
| **Transit alerts** | ❌ | ✅ | ✅ | ✅ |
| **Daily check-in** | Basic (mood/energy) | Full + transit context | Full + client check-ins | Full + client check-ins |
| **Diary entries** | Unlimited | Unlimited | Unlimited (+client diaries) | Unlimited (+client diaries) |
| **Diary + transit snapshot** | ❌ | ✅ | ✅ | ✅ |
| **Composite / relationship charts** | ❌ | ✅ | ✅ | ✅ |
| **Birth time rectification** | ❌ | ✅ | ✅ | ✅ |
| **Electional timing tool** | ❌ | ✅ | ✅ | ✅ |
| **Celebrity / Famous matches** | ✅ (hook feature) | ✅ | ✅ | ✅ |
| **Historical exemplar** | In AI profile | In AI profile | In AI profile | In AI profile |
| **Book recommendations** | In AI profile | In AI profile | In AI profile | In AI profile |
| **Psychometric assessments** | ✅ | ✅ | ✅ | ✅ |
| **Achievements & leaderboard** | ✅ | ✅ | ✅ | ✅ |
| **SMS digests** | ❌ | 30/month | Unlimited | Unlimited |
| **Saved profiles** | 0 | 20 | Unlimited | Unlimited |
| **PDF export** | ❌ | ✅ own profile | ✅ own + client profiles | ✅ all profiles |
| **Clusters / group charts** | ❌ | ❌ | ✅ | ✅ |
| **Practitioner dashboard** | ❌ | ❌ | ✅ | ✅ |
| **Client management** | ❌ | ❌ | Unlimited clients | Unlimited clients |
| **Notion integration** | ❌ | ❌ | ✅ | ✅ |
| **Custom webhooks** | ❌ | ❌ | ❌ | ✅ |
| **API access (10K calls/mo)** | ❌ | ❌ | ❌ | ✅ |
| **White-label embed** | ❌ | ❌ | ❌ | ✅ |

---

## 2. Pricing Rationale

- **$12 Explorer**: Anchored at spiritual app market sweet spot ($7–12). Clear daily-user value: 30 AI questions, transit tracking, diary, composites, timing tool.
- **$60 Guide**: 5× multiplier. Justification: coaches charge $100–300/session and save significant prep time. 200 syntheses/mo with daily ceilings (20/day) prevents abuse while preserving power-user experience.
- **$149 Studio**: Enterprise/reseller tier. 1,000 syntheses/mo, 10K API calls, white-label embed, custom webhooks. 90% of API calls are chart calculations (no LLM cost). Worst-case margin: ~$20/mo AI cost on $149 revenue.
- **Daily ceilings**: All tiers have daily limits to prevent cost spikes. "Unlimited" marketing preserved — monthly caps are generous enough that normal users never hit them. Daily ceilings stop automated abuse.
- **RapidAPI**: Returns raw chart data only. AI synthesis remains exclusive to direct subscription.

---

## 3. What Every Tier Gets (Non-Gated Features)

These features are ungated to maximize retention and viral growth:

- Full chart calculation (all 8 computational layers)
- Bodygraph visualization
- Celebrity / Famous person matching + sharing
- Achievements & leaderboard
- Psychometric assessments (Big Five + VIA)
- Discord bot access
- Onboarding / Savannah story
- Referral program
- Web push notifications
- Check-in streaks & gamification

---

## 4. RapidAPI vs. Direct — Channel Differentiation

**Problem**: RapidAPI Pro ($29/mo) was offering 300K API calls for half the price of a direct Guide subscription ($60/mo).

**Fix**:
- RapidAPI returns **raw chart data only** (type, authority, profile, gates, channels — structured JSON).  
- AI synthesis, transit narratives, Gene Keys interpretation, and Historical Exemplar remain **exclusive to direct subscription**.  
- RapidAPI position: developer discovery/prototyping tool.  
- Direct API (Guide add-on): full platform access with AI layer, intended for production integrations.

---

## 5. Referral Incentive Upgrade

- **Current**: 30 days free for referrer when referee upgrades (only motivates paying users).
- **New**:
  - Free users who refer a new signup: **+5 bonus AI questions** (one-time, regardless of whether referee pays).
  - Paying users who refer someone who upgrades: **1 free month** for both referrer and new subscriber.

---

## 6. Feature Gap: Missing Frontend UI

The following features have complete backends but **no frontend tab, nav entry, or visible UI**. These must be added.

| Feature | Backend Status | Frontend Gap |
|---------|---------------|-------------|
| **Celebrity / Famous Match** | ✅ Full (`/api/compare/celebrities`, `celebrityMatch.js`) | ❌ No tab, not in sidebar nav |
| **Achievements & Leaderboard** | ✅ Full (`/api/achievements`, `achievements.js`) | ❌ No tab, not in sidebar nav |
| **Electional Timing** | ✅ Full (`/api/timing/find-dates`, `timing.js`) | ❌ No tab, not in sidebar nav |

**Notes on correctly-placed features (no change needed):**
- **Historical Exemplar** — correctly embedded within AI Profile output; no standalone section warranted.
- **Book Recommendations** — correctly embedded within AI Profile output.
- **Psychometric Assessments** — correctly embedded within Enhance tab (Big Five + VIA already have full UI).
- **Numerology** — correctly rendered within AI Profile.

---

## 7. Implementation Checklist

### Phase 1 — Tier Config (stripe.js)
- [x] Update `free.profileGenerations` → 1
- [x] Update `regular.profileGenerations` → 30
- [x] Add `white_label` (Studio) tier at $149 with 1,000 syntheses/month, 10K API calls, whiteLabel + customWebhooks
- [x] Add daily ceilings (`dailySynthesisLimit`, `dailyQuestionLimit`) per tier enforced via RATE_LIMIT_KV
- [x] Add `diaryEntriesPerMonth`: Infinity (all tiers) — diary unlimited; transit-snapshot attachment gated for free
- [x] Add `savedProfilesMax`: 0 (free), 20 (regular), Infinity (practitioner/white_label)
- [x] Add `pdfExport`: false (free), true (regular/practitioner/white_label)
- [x] Add `clientManagement`: false (free/regular), true (practitioner/white_label)
- [x] Add `smsMonthlyLimit`: 0 (free), 30 (regular), Infinity (practitioner/white_label)
- [x] Keep `smsDigests` boolean for feature access gate
- [x] Update display names in TIER_DISPLAY map

### Phase 2 — Frontend Nav & Tabs (index.html)
- [x] Add "Famous Matches" nav item under DISCOVER group
- [x] Add "Achievements" nav item under DISCOVER group
- [x] Add "Optimal Timing" nav item under DAILY group
- [x] Add `tab-celebrity` HTML section
- [x] Add `tab-achievements` HTML section
- [x] Add `tab-timing` HTML section

### Phase 3 — JavaScript Handlers (app.js)
- [x] Add `celebrity`, `achievements`, `timing` to TAB_GROUPS
- [x] Add auto-load handlers in `switchTab()`
- [x] Implement `loadCelebrityMatches()` — calls `/api/compare/celebrities`
- [x] Implement `loadAchievements()` — calls `/api/achievements` + `/api/achievements/leaderboard`
- [x] Implement `loadTimingTool()` — renders intention templates from `/api/timing/templates`
- [x] Implement `findBestDates()` — calls `POST /api/timing/find-dates`

### Phase 4 — Documentation
- [x] Update `docs/TIER_ENFORCEMENT.md` — reflect new tier names and quota values
- [x] Update `STRIPE_NEXT_STEPS.md` — update to Plan v4 tier structure (Explorer $12, Guide $60, Studio $149)
- [x] Update `docs/STRIPE_SETUP.md` — replace old prices ($15/$97/$500) with Plan v4 ($12/$60/$149)
- [x] Update `docs/API_MARKETPLACE.md` — document RapidAPI channel differentiation

### Phase 5 — Complete ✅
- [x] Implement SMS monthly cap quota enforcement (new quota action: `sms_digest`)
- [x] Implement diary transit-snapshot attachment tier gate (free users cannot attach transit snapshots to diary entries)
- [x] Implement saved profiles max quota (on profile save action)
- [x] Referral bonus: +5 AI questions for free user referrals
- [x] PDF export tier gating (currently ungated)
- [x] Electional timing tier gate (Explorer+)

---

## 8. Updated Stripe Config Snapshot

```javascript
// workers/src/lib/stripe.js — getTierConfig()
free: {
  name: 'Free', price: 0,
  features: {
    chartCalculations: 1,
    profileGenerations: 1,         // 1 synthesis/month
    aiQuestions: 5,                // 5 AI questions/month
    dailySynthesisLimit: 1,        // Daily ceiling
    dailyQuestionLimit: 5,         // Daily ceiling
    transitSnapshots: 1,
    apiCallsPerMonth: 0,
    smsDigests: false,
    smsMonthlyLimit: 0,
    practitionerTools: false,
    clientManagement: false,
    pdfExport: false,
    diaryEntriesPerMonth: Infinity,
    savedProfilesMax: 0,
    whiteLabel: false,
    customWebhooks: false
  }
},
regular: {
  name: 'Explorer', price: 1200,   // $12.00
  features: {
    chartCalculations: Infinity,
    profileGenerations: 30,        // 30 syntheses/month
    aiQuestions: 30,
    dailySynthesisLimit: 10,       // Daily ceiling
    dailyQuestionLimit: 15,
    transitSnapshots: Infinity,
    apiCallsPerMonth: 0,
    smsDigests: true,
    smsMonthlyLimit: 30,
    practitionerTools: false,
    clientManagement: false,
    pdfExport: true,
    diaryEntriesPerMonth: Infinity,
    savedProfilesMax: 20,
    whiteLabel: false,
    customWebhooks: false
  }
},
practitioner: {
  name: 'Guide', price: 6000,      // $60.00
  features: {
    chartCalculations: Infinity,
    profileGenerations: 200,       // 200 syntheses/month
    aiQuestions: 200,
    dailySynthesisLimit: 20,       // Daily ceiling
    dailyQuestionLimit: 50,
    transitSnapshots: Infinity,
    apiCallsPerMonth: 0,
    smsDigests: true,
    smsMonthlyLimit: Infinity,
    practitionerTools: true,
    clientManagement: true,
    pdfExport: true,
    diaryEntriesPerMonth: Infinity,
    savedProfilesMax: Infinity,
    whiteLabel: false,
    customWebhooks: false
  }
},
white_label: {
  name: 'Studio', price: 14900,    // $149.00
  features: {
    chartCalculations: Infinity,
    profileGenerations: 1000,      // 1,000 syntheses/month
    aiQuestions: 1000,
    dailySynthesisLimit: 50,       // Daily ceiling
    dailyQuestionLimit: 100,
    transitSnapshots: Infinity,
    apiCallsPerMonth: 10000,       // 10K API calls/month
    smsDigests: true,
    smsMonthlyLimit: Infinity,
    practitionerTools: true,
    clientManagement: true,
    pdfExport: true,
    diaryEntriesPerMonth: Infinity,
    savedProfilesMax: Infinity,
    whiteLabel: true,
    customWebhooks: true
  }
}
```

---

## 9. Open Questions for Owner Decision

1. **API calls in Guide** — currently 1,000/mo included; plan moves this to a $50 add-on. Confirm this is acceptable (may affect any existing Guide subscribers).yes
2. **Free diary limit** — 10 entries/month vs. unlimited free diary (retention argument for unlimited). Recommend: unlimited diary, gate transit-snapshot attachment only. Agreed
3. **Transit alerts** — currently planned as Explorer+. Confirm: should alerts be Free (drives daily engagement) or Explorer+ (upgrade incentive)? Yes.
4. **PDF export** — plan gives Explorer+ PDF export of own profile. Confirm this is correct, or should it be Guide-only? this is correct.
