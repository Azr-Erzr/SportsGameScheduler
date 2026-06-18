# Silbo Sports — Session Handoff (Backend / Wire-up Track)

Last updated: June 18, 2026
Purpose: a single catch-up doc so a fresh, low-context chat can continue Master-Plan work
without re-reading this whole session. Pairs with the master plans + the topic docs indexed below.

---

## 1. What Silbo is

A multi-sport **personal schedule** web app: follow teams/leagues/players/drivers/fighters across
every sport, see everything in your local time, and sync/export/share it (calendar feeds, poster
images, Notes, alerts). Soccer/World Cup is the polished launch wedge; the data model + UI are
multi-sport.

- **Stack:** React 19 + Vite + TypeScript + Tailwind v4 + React Router (lazy routes).
- **Backend:** Supabase project **`gcnbgdpicgeahxscpsfc`** (Postgres + RLS + edge functions + pg_cron).
- **Hosting:** Cloudflare Pages (SPA). Repo: `Azr-Erzr/SportsGameScheduler`, default branch `main`.
- **Brand:** "Silbo Sports" (was MatchPulse; legacy strings remain in a few places).

---

## 2. What shipped this session (all on `main`, pushed)

In rough order:

1. **League filter** — sport pages show top-N league pills + a searchable "More leagues" panel.
2. **Backend reality audit** → `docs/master-plan-4-backend-and-glue.md`. Found the core gap: the
   hard part (paced multi-sport hydration) was done, but follows/exports/feeds were World-Cup-only
   + localStorage, and several deployed functions had **schema drift**.
3. **Fixed schema drift:** `calendar-feed` rewritten to the real `events` schema; `calendar_feeds`
   migrated to hashed-token + options; notifications `materialize_change_notifications` RPC created
   (reads `event_status_history`) + **notifications cron scheduled**.
4. **Accounts made real:** follows + prefs now persist to `user_follows`/`profiles` when signed in,
   with local→account merge on sign-in (`src/data/userData.ts`, `src/app/state.tsx`). You can
   follow leagues + athletes from sport pages, rosters, and event pages.
5. **Multi-sport My Schedule + exports** (`useMyEvents`) — schedule/exports read the full DB, not
   just the WC JSON. New "all-sports calendar .ics".
6. **Calendar polish** — per-sport emoji, CATEGORIES, VALARM reminders, Silbo UID/PRODID, in both
   the live feed and downloaded `.ics`.
7. **Live Sync feeds are real** — hashed-token rows in `calendar_feeds`, resolved by the deployed
   function; multi-sport filters.
8. **DB flood** — +21 candidate `provider_targets`; the self-verifying cron absorbs them.
9. **Alert settings UI** (`/settings/alerts`) — writes `alert_preferences` so the notifications
   worker has something to act on.
10. **Event Detail page** (`/events/:id`) — time/venue/competitors/where-to-watch/follow/export;
    the target of the calendar "View" link.
11. **Provider freshness** badge ("Live · via TheSportsDB · synced Xm ago").
12. **CI** (`.github/workflows/ci.yml`: lint+test+build) + new unit tests (now 28).
13. **Live Sports Room perf + redesign** — fixed a hover re-render storm (memoized board),
    fit-to-width cards (no horizontal scroll), removed expensive per-icon `blur()`/`mix-blend`
    paints, and made the sport pips **scroll-land onto their cards and lock** (compositor-only
    view-timeline).
14. **Ads + affiliate scaffolding** — `AdSlot` (AdSense-ready, interleaved every 6 events / 8 rows,
    family-surface-safe) + a `WATCH_PROVIDERS` affiliate registry surfaced on event pages with
    `rel="sponsored"` + disclosure. Activates via env vars. See monetization doc.
15. **SEO essentials** — meta/OG/Twitter + Organization/WebSite JSON-LD in `index.html`,
    `robots.txt`, `sitemap.xml`, per-route titles/canonical (`src/lib/seo.ts`), SportsEvent JSON-LD
    on event pages.
16. **i18n** — expanded fr/es/pt tables (nav + home); switcher already exists in the city picker.
17. **Custom leagues → Supabase** — server-backed (teams+events as JSONB payload on
    `custom_leagues`), cross-device sync + local→account merge, public share via the share-gated
    `get_shared_league` RPC. `src/data/customLeagues.ts`.
18. **Real League + Team pages** (`/leagues/:id`, `/teams/:id`) — entity + upcoming events + follow,
    linked from event pages.
19. **Deploy:** `public/_redirects` SPA fallback (deep links resolve on Pages) + `docs/deployment.md`.
20. **Admin dashboard** (`/admin`) via the gated `admin-stats` edge function + `admin_overview()`
    RPC; rate-limiting documented as Cloudflare WAF rules.

---

## 3. Backend state (live on `gcnbgdpicgeahxscpsfc`)

- **Data:** ~8,400 events, 37+ leagues (growing via flood), ~5,150 athletes across 10 sports.
- **Edge functions:** `provider-hydrate`, `provider-hydrate-players`, `provider-sync`,
  `calendar-feed` (public, token-gated, no JWT), `notifications`, `admin-stats` (admin-gated).
- **Cron:** `provider-hydrate` (15 min), `provider-hydrate-players` (3×/hr), `notifications-dispatch`
  (5 min).
- **Key tables:** sports, leagues, seasons, venues, competitors (+`parent_competitor_id`),
  events (+`event_competitors`, `event_status_history`), broadcasts, provider_targets,
  provider_sync_runs, user_follows, profiles, calendar_feeds (hashed token), alert_preferences,
  push_subscriptions, notification_deliveries, custom_leagues (+`payload` jsonb), custom_teams.
- **Change detection:** the hydrator diffs title/status/starts_at, bumps `version`, logs
  `event_status_history`; that feeds change notifications.
- **Migrations + function source live in the repo** under `supabase/` (mirrored from live).

---

## 4. Key frontend files (orientation)

- `src/data/liveSport.ts` — the live read layer: `useSportSchedule`, `useMyEvents`, `useEvent`,
  `useLeague`, `useCompetitor`, `useSportRoster`.
- `src/data/userData.ts` — follows/prefs DB sync + merge.
- `src/data/customLeagues.ts` — custom-league DB sync + `useCustomLeagues` hook + share resolver.
- `src/data/alerts.ts` — alert_preferences CRUD.
- `src/lib/ads.ts` + `src/components/AdSlot.tsx` — monetization.
- `src/lib/seo.ts` — per-route meta + JSON-LD.
- `src/lib/ics.ts` + `supabase/functions/_shared/ics.ts` — calendar rendering (client + server).
- `src/app/state.tsx` — app state (follows/prefs/auth) + DB mirroring.
- `src/theme/themes.ts` + `SportThemeProvider.tsx` + `src/styles/tailwind.css` — design tokens.

---

## 5. Needs YOU (config/decisions, not code) — unblockers

- **`RESEND_API_KEY`** + `EMAIL_FROM` + a verified sending domain (SPF/DKIM/DMARC) → turns on email
  reminders/change alerts (pipeline is fully wired + scheduled, just no transport).
- **VAPID keys** → web push (stub today).
- **`ADMIN_EMAILS`** secret → unlocks `/admin` for your email.
- **`VITE_ADSENSE_CLIENT`** + `VITE_AFFILIATE_*` → activates ads + affiliate links (see monetization
  doc; you apply to AdSense + Impact/CJ/FlexOffers/Awin and paste ids).
- **Domain reconciliation:** pick `silbosports.com` (SEO/canonical/sitemap) vs `silbosports.app`
  (edge `APP_URL`) and set it consistently everywhere. On the deployment checklist.
- **Cloudflare Pages env vars** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) so the
  deployed build talks to Supabase.

---

## 6. Open work (next objectives, prioritized)

1. **SEO prerendering** — it's an SPA, so social scrapers only see the root OG card. Add prerender
   for static routes + a per-event OG worker (the single biggest SEO/sharing win). See SEO doc.
2. **i18n string extraction** — sweep hardcoded English into `t()` keys, complete fr/es/pt, add
   hreflang, then RTL → Arabic. Framework + switcher already exist.
3. **Sport-structure modeling** — fight cards (segments/bouts), playoff brackets, race-weekend
   sessions (the "graphics from data" layer). Schema designed in master-plan-4 §6; reliable
   bout/bracket data may need a second provider.
4. **Monetization activation** (after accounts/secrets) + backfill the `broadcasts` table so event
   pages show real listings (affiliate matching lights up automatically).
5. **World Cup dedup** — point the planner at TheSportsDB id 4429 and retire the openfootball set.
6. **README** still has stale (pre-Silbo) naming.

---

## 7. Doc index (read these, not the transcript)

- `docs/master-plan-1.md` / `-2.md` / `-3.md` — original product/tech plan, phases, identity/data.
- `docs/master-plan-4-backend-and-glue.md` — the backend audit + caching/refresh/structure plans.
- `docs/data-hydration-handoff.md` — the TheSportsDB hydration pipeline.
- `docs/silbo-design-context.md` — **the** design brief (two-system→two-mode, palette, banner v2).
- `docs/silbo-design-synthesis.md` — Channel S design synthesis + motif grammar.
- `docs/monetization-ads-affiliate.md` — ads + affiliate playbook.
- `docs/seo-and-i18n-plan.md` — SEO state + caveats + i18n rollout.
- `docs/deployment.md` — Cloudflare Pages + Supabase deploy + pre-launch checklist.
- `docs/admin-and-rate-limiting.md` — admin dashboard + rate-limiting.

---

## 8. Repo / branch caveats (important for the next chat)

- **`main` is the source of truth** and all backend/wire-up work above is on it and pushed.
- **A parallel design session shares this checkout.** As of this handoff there are unmerged design
  branches: `header-sport-selector-dropdown`, `home-spotlight-card-stripes`, and
  `cloudflare/workers-autoconfig` (each ~1 commit ahead of main, on origin). They are **not merged**
  — do not delete them; merge via PR when ready.
- The working tree also carries **uncommitted design WIP** (SportChannelBanner/SportAssetIcon/
  PosterMotifs edits, `public/assets/**` banner/icon `.webp`, `scripts/optimize-images.mjs`,
  `package.json`) and ~52 MB of reference mockups under `docs/` (Mockups/, New Project/, ChatGPT
  Image…/) that are intentionally untracked. These belong to the design track — leave them for that
  session to land.
- **Working rule:** scope commits narrowly to the files you touch (avoid colliding with the design
  session). Commit/push only when asked.

---

## 9. How to continue in a fresh chat

Paste a pointer to this file + the relevant topic doc for the task. Example: "Continue Silbo MP work
— read docs/session-handoff.md and docs/master-plan-4-backend-and-glue.md §6; take on SEO
prerendering next." The Supabase MCP (project `gcnbgdpicgeahxscpsfc`) and the repo are the live
surfaces; verify against them rather than the plans where they disagree.
