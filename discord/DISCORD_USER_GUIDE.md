# Prime Self Bot — Discord User Guide

The Prime Self bot calculates your **Human Design Quick Start** directly inside Discord. No account required. Type one command, get your Type, Authority, Profile, and a real decision protocol you can use today.

---

## Quick Start

```
/primself date:1990-06-15  time:14:30  city:New York, USA
```

That's the whole command. The bot replies in a few seconds with a gold embed containing your core chart snapshot.

---

## The `/primself` Command

### Syntax

| Parameter | Required | Format | Example |
|-----------|----------|--------|---------|
| `date` | ✅ | `YYYY-MM-DD` | `1990-06-15` |
| `time` | ✅ | `HH:MM` (24-hour) | `14:30` |
| `city` | ✅ | City name, free text | `Tampa, FL, USA` |

Discord will show the three fields as autocomplete prompts when you type `/primself` — just fill them in left to right.

### Date format

The date must be in **year-month-day order** with dashes:

```
✅ 1990-06-15     (June 15, 1990)
✅ 2003-11-02
❌ 06/15/1990     (wrong order and separator)
❌ June 15, 1990  (not a date format)
```

Birth dates in the future are rejected.

### Time format

Time is **24-hour clock**, no AM/PM:

```
✅ 14:30   (2:30 PM)
✅ 09:15   (9:15 AM)
✅ 00:00   (midnight)
❌ 2:30 PM
❌ 2:30pm
```

> **Don't know your exact birth time?** Use `12:00` as a placeholder. Your Type, Profile, and most Authority readings will still be accurate. Time primarily affects the exact gates and channels, which are covered in the full chart at primeselfengine.com.

### City format

Enter the city as you would describe it to someone. The more specific, the better:

```
✅ New York, USA
✅ Tampa, FL, USA
✅ London, UK
✅ São Paulo, Brazil
✅ Mumbai, India
❌ NY              (too vague — use "New York, USA")
❌ USA             (no city specified)
```

---

## What the Bot Returns

The bot sends a **Quick Start embed** with three fields:

### 🔑 Who You Are

Your core Human Design snapshot:

```
Generator · 2/4 Profile · Sacral Authority · Single Definition
```

| Piece | What it means |
|-------|--------------|
| **Type** | Your energy strategy — Generator, Manifesting Generator, Projector, Manifestor, or Reflector |
| **Profile** | Your life role and learning style (e.g., 2/4 — Hermit/Opportunist) |
| **Authority** | Your inner decision-making intelligence |
| **Definition** | How your energy centers are connected (Single, Split, Triple Split, Quadruple Split) |

### ⚡ Your Decision Protocol

A plain-language description of *how* to make decisions based on your Authority. This is the most immediately actionable part of Human Design. Examples:

| Authority | What the bot tells you |
|-----------|----------------------|
| Sacral | Trust your gut response in the moment — an energetic "uh-huh" means yes |
| Emotional | Wait for emotional clarity; sleep on important choices |
| Splenic | Act on your first instinct; your spleen speaks once and never repeats |
| Ego | Check whether you truly want to commit before agreeing |
| Self (G Center) | Talk it through out loud — your clarity emerges through your own voice |
| Mental (Sounding Board) | Consult your environment and gather multiple perspectives |
| Lunar | Wait a full 28-day lunar cycle for major decisions |

### 🌀 This Month's Energy

Current planetary transit gates affecting the collective field right now. Shows which Human Design gates the Sun and Moon are moving through, giving you context for why certain energies feel amplified this week.

---

## Privacy & Visibility

- **Your result is public** — the embed is posted in the channel where you ran the command. Anyone in the server can see it.
- **Error messages are private** — if you make a typo or hit the rate limit, only you see the error message (Discord calls these "ephemeral" messages — they have a note saying "Only you can see this").

---

## Rate Limit — 3 Free Lookups Per Day

Each Discord account gets **3 free chart lookups every 24 hours**. The counter resets on a rolling basis from your first lookup of the day, not at midnight.

When you run out, the bot tells you exactly when your limit resets:

> ⏳ You have used all **3** free lookups for today. Your limit resets in approximately **18 hours** (around Wed, 12 Mar 2026 22:00:00 GMT). Visit [primeselfengine.com](https://primeselfengine.com) for unlimited access.

You can look up charts for other people using your daily lookups — the limit is per Discord account, not per birth data.

---

## Error Messages & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Date must be in YYYY-MM-DD format` | Wrong date format | Use `1990-06-15`, not `06/15/1990` |
| `Time must be in HH:MM 24-hour format` | Wrong time format | Use `14:30`, not `2:30 PM` |
| `City must be at least 2 characters` | City too short or blank | Enter a full city name |
| `Birth date cannot be in the future` | Date is after today | Double-check the year — 4-digit years are required |
| `Location not found for [city]` | City not found by geocoder | Add the country, e.g. `Springfield, IL, USA` instead of `Springfield` |
| `Chart calculation failed — temporary issue` | Transient server error | Wait 30 seconds and try again |
| `You have used all 3 free lookups` | Daily rate limit hit | Wait for reset time shown in the message |

---

## Getting More from Your Chart

The Quick Start embed is the top layer. The full Prime Self engine at **[primeselfengine.com](https://primeselfengine.com)** includes:

- Complete gate and channel activations for your Bodygraph
- Forge Weapons — the specific challenges and gifts wired into your design
- Priming Recommendations — what to do and avoid given your circuit configuration
- Unlimited chart lookups and saved charts
- Composite and relationship charts
- Monthly personalized transit forecasts

Click the embed title **"Your Prime Self Quick Start"** to go directly to your chart on the website with full breakdown.

---

## For Server Admins — Adding the Bot

### Bot Permissions Required

When authorizing the bot, it only needs:

- `Send Messages`
- `Embed Links`
- `Use Application Commands`

No administrator permissions, no message read history, no DM access.

### Recommended Channel Setup

Create a dedicated channel like `#chart-lookup` or `#human-design` and pin this message there. The bot works in any channel it has permission to post in.

### Suggested Pinned Message (copy-paste ready)

```
📌 **Prime Self Bot — How to Use**

Get your Human Design Quick Start right here:

/primself  date:YYYY-MM-DD  time:HH:MM  city:Your City, Country

Examples:
  /primself date:1990-06-15 time:14:30 city:New York, USA
  /primself date:1985-03-22 time:09:00 city:London, UK

• Date format: year-month-day  →  1990-06-15
• Time format: 24-hour clock   →  14:30 means 2:30 PM
• Don't know your birth time?  Use 12:00

You get 3 free lookups per 24 hours.
For unlimited access and your full chart: https://primeselfengine.com
```

---

## Frequently Asked Questions

**Q: Can I look up someone else's chart?**
Yes. Enter their birth data. The result posts publicly in the channel. Each lookup counts against your 3/day limit.

**Q: What if I don't know my exact birth time?**
Use `12:00`. Type, Profile, and Authority are correct in most cases. Some edge-case Authority types (Splenic, Ego) require exact time for full accuracy, but the reading will still be valid and useful.

**Q: The embed says "Transit data unavailable" — what does that mean?**
The transit calculation was temporarily unavailable. Your core chart (Who You Are + Decision Protocol) is still accurate and complete. Visit primeselfengine.com for the full transit forecast.

**Q: Why does the embed link to the website?**
The Quick Start embed shows your three most actionable pieces. The full chart — gates, channels, Bodygraph, Forge Weapons, Priming Recommendations — is at primeselfengine.com. The embed title is a direct link to it.

**Q: My city wasn't found — what do I do?**
Add the state/province and country. `Paris` → `Paris, France`. `Springfield` → `Springfield, IL, USA`. If it still fails, try the nearest major city.

**Q: Can the bot send results to my DMs instead of the channel?**
Not currently. Results are always posted in the channel where you ran the command.

---

*Prime Self Bot · Powered by primeselfengine.com*
