# Silbo SEO + i18n Plan

Last updated: June 17, 2026

## Part A — SEO

### Shipped (this pass)
- **Rich static head** in `index.html`: title, description, `robots`, canonical, Open Graph
  (type/site/url/title/description/image), Twitter `summary_large_image`, and JSON-LD
  (`Organization` + `WebSite` with a `SearchAction`).
- **`public/robots.txt`** (allows all, points at the sitemap).
- **`public/sitemap.xml`** — 16 URLs: home, the section routes, and every sport page.
- **Per-route metadata** via `src/lib/seo.ts` `useDocumentMeta()`: distinct `<title>`,
  `description`, and `canonical` on sport pages (`Tennis schedule & live times — Silbo Sports`)
  and event pages. Verified live.
- **`SportsEvent` JSON-LD** injected on `/events/:id` (name, startDate, eventStatus, location,
  competitors) via `useJsonLd()`.

### The SPA caveat (important)
This is a client-rendered SPA. Googlebot **does** render JS, so the dynamic titles/canonical/
JSON-LD above are picked up. But:
- **Social/link scrapers (Facebook, X, iMessage, Slack, WhatsApp) do NOT run JS.** They read only
  the *static* `index.html`, so every shared link currently shows the **root** OG card — not the
  specific sport/event. Per-page share cards need server-rendered/prerendered OG tags.
- First-paint indexing and non-Google crawlers are weaker without HTML content.

### Recommended next steps (ranked)
1. **Prerender static routes at build** (home, `/explore`, the 11 sport pages) so crawlers and
   scrapers get real HTML + correct per-page OG. Options on the current Vite + Cloudflare stack:
   `vite-plugin-ssr`/prerender, `react-snap`, or a small Cloudflare prerender Worker that serves
   bot-specific HTML. Lowest-effort high-impact item.
2. **Dynamic OG per event/sport** via a Cloudflare Worker that injects `og:*`/`title` into the
   HTML for `/events/:id` and `/sports/:key` based on the DB (or a generated OG image endpoint).
   This is what makes shared event links look great.
3. **Dynamic sitemap** — replace the static 16-URL file with a Supabase edge function that lists
   leagues + upcoming events (`/sitemap.xml` → DB query). Deep indexing of thousands of pages.
4. **Domain reconciliation (blocker for canonical correctness):** SEO uses `silbosports.com`
   (the brand `domainHint`), but the edge functions default `APP_URL` to `silbosports.app`. Pick
   the real Cloudflare domain and set it in **one** place everywhere (index.html, `seo.ts`
   `SEO_ORIGIN`, sitemap, robots, edge `APP_URL`).
5. **Core Web Vitals = ranking.** The recent paint/perf work (removed blur/blend, scroll-lock
   pips, fit-to-width cards) directly helps LCP/INP. Keep the shell light; lazy routes are good.
6. **Create `/public/og-cover.png`** (1200×630) — referenced by OG/Twitter tags; missing today.
7. **`hreflang`** tags once i18n routing exists (see Part B).

## Part B — i18n

### What exists
- `src/lib/i18n.ts`: `t(key, params, locale)`, `localeOptions` (en/fr/es/pt), `normalizeLocale`,
  region-aware football/soccer labels.
- A **language switcher** already ships (in `CityPicker`, writing `prefs.locale`).
- Priority languages (Master Plan 2, Phase 6): **English → French → Spanish → Portuguese**, then
  **Arabic** (needs RTL).

### Gaps
- The `fr`/`es`/`pt` tables translate only a couple of keys; everything else falls back to
  English.
- Most UI copy is still **hardcoded English**, not routed through `t()` keys (nav, sport pages,
  My Schedule, Exports, Alerts, Event Detail, ads disclosures, etc.).
- No `hreflang`, no per-locale URLs, no RTL handling.

### Rollout plan
1. **Extract strings → keys.** Sweep components and replace hardcoded copy with `t('…')` keys.
   Do this incrementally per page; it's the bulk of the work and unblocks everything else.
2. **Complete fr/es/pt tables** for the keyed strings (professional or LLM translation + native
   review). This pass expands the core nav + home keys as a start.
3. **`hreflang` + discoverability:** emit `<link rel="alternate" hreflang="…">` and consider
   `?lang=` or `/es/…` path routing so each locale is separately indexable.
4. **RTL pass before Arabic:** audit layouts for logical properties (`margin-inline`, etc.), set
   `dir="rtl"` on the locale, and verify the board/banner/exports mirror cleanly. Then add `ar`.
5. **Localized formatting** is already handled (Intl-based times/dates via `prefs.locale`).

### Done this pass
Expanded the `fr`/`es`/`pt` message tables to cover the full nav + the core home strings (instead
of 2 keys each), so switching language now visibly translates the shell and homepage hero.
