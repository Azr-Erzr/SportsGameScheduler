# Silbo Monetization — Ads + Affiliate (Actionable Playbook)

Last updated: June 19, 2026

Two revenue streams, both wired into the app now as *scaffolding* that activates the moment you
plug in account credentials (env vars). Nothing here commits a partner secret to the repo.

- **Display ads** — programmatic banners interleaved in long schedule lists + side slots.
- **Affiliate "where to watch"** — outbound links to streaming providers (Fubo, ESPN+, DAZN…)
  that pay a commission per signup. This is the high-value one: it's *useful to the user* and
  monetizes the exact moment of intent ("where do I watch this?").

---

## 1. Display ads

### What's built (live in code)
- `src/lib/ads.ts` — config, per-surface safety, and `interleaveAds()`.
- `src/components/AdSlot.tsx` — one placement. Renders a labeled, correctly-sized **placeholder**
  until `VITE_ADSENSE_CLIENT` is set; then it renders a real Google AdSense unit.
- **Placements wired:** a thin horizontal banner every **6 events** in each sport's match list
  (`SportPage`), and every **8 rows** in My Schedule's all-sports list. Verified: 19 slots
  interleaved on a 120-row basketball list; **0 slots** on the Community/custom-league surface.
- **Safety rule enforced** (`adsAllowed`): no paid ads on family/kids/community surfaces — a
  hard requirement for ad-network policy and the kids-privacy guardrail in the master plan.

### How to turn it on (AdSense — the starting network)
1. Apply at google.com/adsense (a **no-traffic-minimum** network — the right place to start).
2. Add the AdSense loader `<script>` to `index.html` (one line, documented in the AdSense UI).
3. Set `VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXX` in the Cloudflare Pages env. `AdSlot` auto-activates;
   every placeholder becomes a live unit.
4. (Optional) create named ad units and pass slot ids if you want fixed sizes instead of `auto`.

### The scaling ladder (RPM grows ~3× as you move up)
AdSense is entry-level (~$2–8 RPM). Graduate as traffic/revenue grows:

| Network | 2026 entry bar | Notes |
|---|---|---|
| **AdSense** | none | Start here. Lowest RPM, instant. |
| **Ezoic** | ~3k visits (legacy); **250k** for new sites added after Feb 2026 | Easy, AI layout testing; can run alongside AdSense early. |
| **Mediavine** | **$5k annual ad revenue** (or 10k sessions on the new "Journey" tier) | Switched to a revenue-based bar in Jan 2026; big RPM jump. |
| **Raptive** (AdThrive) | **25k pageviews/mo** (dropped from 100k in Oct 2025) | Highest RPMs; **exclusive** — must remove AdSense/others. |

Sport/news RPMs typically land between the "finance" and "lifestyle" rows of the public
comparisons — i.e., meaningful lift (3×+) once you reach Mediavine/Raptive tier.

### Google Ad Manager (later)
When you want **direct-sold** deals (a sportsbook buying your NFL pages) or fine-grained
**ad-safety profiles**, move to Google Ad Manager. Model surfaces with an `ad_safety_profile`
(`general | family | betting-eligible`) so betting creatives only ever appear on adult pro/college
pages where legal — never on community/kids pages. (This matches MP3's ads policy.)

### Side rails
The horizontal in-list banner is the highest-yield, least-annoying unit and is done. Left/right
**vertical** rails (`skyscraper`/`rectangle`) are supported by `AdSlot` (`format="skyscraper"`) —
add them in a desktop-only grid column on sport pages when you're ready; mobile should stay
single-column (no rails) to protect the schedule UX.

---

## 2. Affiliate "where to watch"

### June 19 update: DB-backed provider catalogue
- `watch_providers` is now the source of truth for provider name, country/region coverage,
  supported sports, direct URL, affiliate URL, network, approval status, notes, and priority.
- `watch_links` stores event/league/sport/region rules. It lets a US combat card prefer DAZN,
  Paramount+, UFC Fight Pass, Prime Video, PPV.com, and ESPN+, while a Canadian event can prefer
  TSN/Sportsnet+ and an India event can prefer SonyLIV/FanCode/JioHotstar.
- `src/data/watchLinks.ts` reads those rules first and falls back to `WATCH_PROVIDERS` if the DB
  is unavailable or no row matches.
- FlexOffers is verified. Impact is parked because site verification repeatedly failed despite
  correct live tags. Prefer Flex/direct routes where possible.
- Showtime Sports is not a new sports-link target; it shut down at the end of 2023. Current combat
  paths are DAZN, Paramount+, UFC Fight Pass/Fight Club, Prime Video/PBC, PPV.com, and regional
  broadcasters.
- Start with unpaid official links everywhere. Flip rows to `affiliate_status='approved'` and add
  `affiliate_url` only after a provider approves Silbo.

### What's built (live in code)
- `WATCH_PROVIDERS` registry in `src/lib/ads.ts` — static fallback coverage for US, Canada,
  UK/Ireland, Spain, Africa, India, MENA, and combat-specific services. Each entry is tagged with
  its **affiliate network**, approval status, **regions**, and sport fit.
- `watchLinkFor(key)` builds the outbound link, appending the affiliate sub-id when
  `VITE_AFFILIATE_<KEY>` is set; otherwise links direct.
- `matchWatchProvider(channel)` fuzzy-maps a broadcaster string from the data feed to a provider.
- **Surfaced on the Event Detail page** (`/events/:id`): real broadcast listings become
  affiliate links when matched; when there's no listing yet, a region-aware "common ways to
  watch" row appears. Affiliate links carry `rel="sponsored"` and a visible FTC disclosure
  ("Silbo may earn a commission, at no cost to you").

### Commissions (researched June 2026)
| Provider | Network | Payout |
|---|---|---|
| **Fubo** | Impact | ~$5/paid sub, up to **$20** for a 60-day sub ($3/$17 international) |
| **Sling TV** | FlexOffers | up to **$20**/sub, 45-day cookie |
| **ESPN+** | CJ | ~**30%** commission, 30-day cookie |
| **DAZN** | Awin | rev-share, 30-day cookie, monthly payout |
| Crave / TSN / Sportsnet+ | Direct (CA) | apply directly; good for the Canadian focus |

### How to turn it on
1. Join the networks: **Impact** (Fubo, Peacock), **FlexOffers** (Sling), **CJ** (ESPN+, Max),
   **Awin** (DAZN); apply **directly** to Crave/TSN/Sportsnet for Canada.
2. For each approved program, set `VITE_AFFILIATE_FUBO`, `VITE_AFFILIATE_ESPN_PLUS`, … in the
   Cloudflare env to your tracking/sub id. Links flip from direct → affiliate automatically.
3. Each network uses a slightly different click param (Impact `irclickid`, CJ `sid`, …) — adjust
   `watchLinkFor` per network when you wire the real deep-links (the seam is there).

### Why this is the better stream
A logged-in user looking at a UFC card and tapping "Watch on ESPN+" is the highest-intent
conversion on the site. It's also **on-brand** (we're the schedule that gets you to the game) and
**ad-safe** (no creative clutter). Prioritize affiliate over display density.

---

## 3. Revenue model (rough)
- **Display:** RPM × pageviews/1000. At AdSense ($2–8 RPM) 100k pageviews/mo ≈ $200–800; at
  Mediavine/Raptive tier the same traffic is ~3× ($600–2,400).
- **Affiliate:** conversion is small but high-value. 100k pageviews → say 0.3% click to a provider
  → 300 clicks → ~3% sign-up → ~9 subs × ~$10 ≈ $90/mo from one provider; scales with provider
  count, region match, and event intent. Grows faster than display as event coverage deepens.

Blended: affiliate becomes the larger stream as the catalog and audience grow; display is the
reliable baseline from day one.

---

## 4. Policy / safety guardrails (already enforced or specced)
- **No ads on family/community/kids surfaces** — enforced by `adsAllowed()`; custom-league pages
  verified ad-free.
- **Gambling/betting** creatives: only via Google Ad Manager with an `ad_safety_profile`, only on
  adult pro/college pages where legal, with age/responsible-gambling gating. Never on family pages.
- **FTC disclosure** on affiliate links + `rel="sponsored"`.
- **Labeling:** every ad slot is labeled "Advertisement" (network policy).

---

## 5. Next steps checklist
- [ ] Apply to AdSense; add loader script to `index.html`; set `VITE_ADSENSE_CLIENT`.
- [x] Verify FlexOffers.
- [ ] Apply to individual FlexOffers programs: ESPN+, Sling, Fubo, DAZN, Peacock, Paramount+.
- [ ] Apply directly to DAZN, UFC/Fight Pass, PPV.com, TSN, Sportsnet, Sky/NOW, Movistar, Showmax,
      DStv/SuperSport, SonyLIV/FanCode/JioHotstar where public partner routes exist.
- [ ] Add approved affiliate URLs to `watch_providers` / `watch_links`; keep unpaid direct links
      active everywhere else.
- [ ] Add a `consent` banner (GDPR/Google consent mode) before serving ads in the EU.
- [ ] When traffic crosses ~25k pageviews/mo, evaluate Raptive/Mediavine; add GAM for direct deals.
- [ ] Backfill the `broadcasts` table so event pages show real listings (then affiliate matching
      lights up automatically).
