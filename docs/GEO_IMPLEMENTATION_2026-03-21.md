# Prime Self — GEO (Generative Engine Optimization) Implementation

**Date:** March 21, 2026
**Status:** ✅ Implemented — see commit for file list
**Companion docs:** [GTM_PLAN_2026-03-21.md](GTM_PLAN_2026-03-21.md) | [WORLD_CLASS_ASSESSMENT_2026-03-21.md](WORLD_CLASS_ASSESSMENT_2026-03-21.md)

---

## What Is GEO?

Generative Engine Optimization (GEO) is the practice of structuring content so that AI search engines — Perplexity, ChatGPT Search, Google AI Overviews, Claude, and similar — surface your content in AI-generated answers. It is the AI-era successor to traditional SEO.

Where SEO optimizes for keyword ranking in a list of blue links, GEO optimizes for being **cited as the authoritative source** in a generated answer. The mechanism is different: AI engines favor content that is:

- **Definitional** — clearly defines its own terms
- **Quotable** — short, precise, factual sentences that can be extracted verbatim
- **Structured** — uses schema.org markup so AI crawlers understand content type and meaning
- **Crawlable** — properly declared in `robots.txt`, listed in `sitemap.xml`, and accessible to all known AI crawlers
- **Self-declared** — uses `llms.txt` to give AI agents a direct briefing on the site's purpose and vocabulary

---

## Why GEO Matters for Prime Self Specifically

Prime Self uses **proprietary vocabulary** (Energy Blueprint, Frequency Keys, Builder Pattern, etc.) instead of the standard field terms (Human Design, Gene Keys, Generator, etc.). This creates a double GEO challenge:

1. **AI engines don't know our terms.** A user asking Perplexity "what is my Energy Blueprint?" receives no result or a misrouted result. We are invisible for our own branded vocabulary.
2. **Competitors using standard terminology rank in AI answers.** Tools that use "Human Design" get cited when users search the broader field.

The fix is to become the authoritative source on our own vocabulary. If Prime Self publishes clear, crawlable definitions of all proprietary terms, AI engines will learn to associate those terms with `selfprime.net` and cite us in answers.

---

## What Was Built (2026-03-21)

### 1. `frontend/robots.txt`
Tells all crawlers — including named AI crawlers (GPTBot, ClaudeBot, PerplexityBot, anthropic-ai, cohere-ai) — that the site is fully indexable except admin and billing pages. References the sitemap.

### 2. `frontend/sitemap.xml`
Standard XML sitemap listing all public pages: home, pricing, definitions, privacy, terms. Submit to Google Search Console and Bing Webmaster Tools.

### 3. `frontend/llms.txt`
Following the emerging `llms.txt` standard (similar to `robots.txt` but for AI agents). Contains:
- A plain-English description of what Prime Self is and does
- Complete canonical vocabulary definitions for all proprietary terms
- Cross-references to legacy field terminology (e.g., "Energy Blueprint — also called Human Design in the field")
- Product tier descriptions
- Page index with URLs

This file gives AI agents a direct briefing that doesn't require them to parse the SPA.

### 4. `frontend/definitions.html`
A fully static, crawlable HTML page at `https://selfprime.net/definitions.html`. This is the primary GEO asset — a long-form, quotable vocabulary reference covering:
- Core system terms (Energy Blueprint, Energy Chart, gates, channels)
- All five Energy Types with percentages and strategies
- All seven Authority types
- All six Profile lines
- Life Purpose Vector and the three cross types
- Frequency Keys (Shadow / Gift / Siddhi)
- FAQ section with verbatim question/answer blocks

The page is designed to be citable: every term has a precise, quotable definition. AI engines that parse this page will have authoritative answers to questions like "What is a Guide Pattern?" or "What is the difference between a Builder and a Builder-Initiator?"

Includes `DefinedTermSet` + `FAQPage` JSON-LD schema markup so AI engines understand the page's purpose.

### 5. JSON-LD structured data in `frontend/index.html`
Three schema.org blocks added before `</head>`:
- **`SoftwareApplication`** — names the product, describes features, lists pricing tiers
- **`Organization`** — declares Prime Self as the publisher
- **`FAQPage`** — four key Q&A pairs covering what Prime Self is, what an Energy Blueprint is, what Energy Types are, and who the product is built for

### 6. `frontend/_headers` updates
Added caching rules for the new files:
- `robots.txt`, `sitemap.xml`, `llms.txt` — 24-hour cache, correct Content-Type headers
- `definitions.html` — 1-hour cache, explicit `X-Robots-Tag: index, follow`

---

## The Vocabulary Bridge Strategy

A key GEO decision: the definitions page and `llms.txt` include **field alias notes** for every proprietary term. For example:

> **Energy Blueprint** — *Also known in the broader field as: Human Design*

This bridges the gap between what users search ("what is my Human Design?") and what Prime Self calls it ("Energy Blueprint"). AI engines reading our definitions will learn that these are equivalent, making Prime Self citable for both the standard field terms and the proprietary ones.

This is not a trademark issue: we are not using the terms in marketing copy or UI labels. We are providing definitional cross-references in educational content.

---

## What GEO Does NOT Do Here

- **This does not make the SPA crawlable.** The main `app.js` application is a client-rendered SPA. AI crawlers cannot execute JavaScript. The solution is providing static, crawlable files (`definitions.html`, `llms.txt`) rather than trying to server-render the app.
- **This does not replace SEO.** `robots.txt` + `sitemap.xml` are prerequisites for both SEO and GEO. They enable Google to index the static pages.
- **This does not replace content marketing.** The blog posts outlined in the GTM plan are still needed for ongoing organic discovery. GEO assets establish vocabulary authority; content marketing builds topical authority.

---

## Next Steps

| Task | Priority | Notes |
|------|----------|-------|
| Submit `sitemap.xml` to Google Search Console | P1 — Week 1 | Requires domain verification first |
| Submit to Bing Webmaster Tools | P2 — Week 2 | Secondary but worthwhile |
| Add blog at `/blog` | P1 — Week 3–5 | GTM plan content calendar requires a home |
| Add individual blog post pages to `sitemap.xml` | P1 — ongoing | Update sitemap as content is published |
| Monitor Perplexity / ChatGPT for Prime Self mentions | P2 — ongoing | Track whether our terms appear in AI answers |
| Add `hreflang` if multi-language support is added | P3 — future | Not needed for English-only launch |
| Evaluate server-side rendering or prerendering for app routes | P3 — future | Would significantly improve crawlability of chart results pages |

---

## Files Changed

```
frontend/robots.txt          — new
frontend/sitemap.xml         — new
frontend/llms.txt            — new
frontend/definitions.html    — new
frontend/index.html          — JSON-LD added before </head>
frontend/_headers            — caching rules for new static files
docs/GEO_IMPLEMENTATION_2026-03-21.md  — this file
```
