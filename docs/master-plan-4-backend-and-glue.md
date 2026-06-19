# Master Plan 4: Backend Reality Check, Caching, Refresh, and the Glue That Makes Silbo Worth Using

Last updated: June 15, 2026

This plan is grounded in a live audit of the deployed Supabase project (`gcnbgdpicgeahxscpsfc`),
the edge functions, the cron schedule, and the frontend wiring — not on what the earlier plans
*intended*. It answers: what actually works today, what is quietly broken, what makes us THE
place to build a sports schedule, and the concrete data caching + refresh + structure work to
get there.

---

## 0. Update — Shipped In This Pass (June 15, 2026)

Waves 1 + 2 (glue + the promise) plus the DB flood and calendar polish landed:

- **Fixed the two schema-drift bugs.** `calendar-feed` now matches the live `events` schema and
  renders (verified live); `calendar_feeds` migrated to a hashed token + options. Created the
  missing `materialize_change_notifications` RPC (reads `event_status_history`) and **scheduled
  the notifications worker** (`notifications-dispatch`, every 5 min). Branding moved to Silbo.
- **Follows + prefs now persist to Supabase** when signed in (`user_follows` / `profiles`), with a
  local→account merge on sign-in. DB-eligible follows (league/competitor/sport, uuid ids) sync;
  WC team follows stay local. (`src/data/userData.ts`, `src/app/state.tsx`.)
- **You can now follow leagues and athletes** from the sport pages (league follow button on the
  filter row; per-player star in the roster). (`src/pages/SportPage.tsx`.)
- **My Schedule + Exports are multi-sport.** New `useMyEvents` hook reads upcoming events across
  all sports for followed leagues/competitors; My Schedule shows an "Across all sports" section
  and Exports gained an "All-sports calendar .ics". Verified: following WNBA surfaced 228 games
  with 🏀 emoji + local times. (`src/data/liveSport.ts`, `MySchedule.tsx`, `ExportStudio.tsx`.)
- **Calendar polish** in both the live feed and downloaded .ics: per-sport emoji in the title,
  `CATEGORIES`, `VALARM` reminders, richer description, Silbo `UID`/`PRODID`.
- **Live Sync feeds are real** when signed in: hashed token written to `calendar_feeds`, real
  function URL shown once, multi-sport filters. (`CalendarFeeds.tsx`.)
- **Flooded the allowlist**: +21 candidate `provider_targets`; the self-verifying cron already
  accepted new leagues (Argentinian Primera, Brazilian Serie A, EuroCup, VTB, …).

Still open (needs you / a decision): provision `RESEND_API_KEY` + a verified sending domain to
turn email on; VAPID keys for push; sport-structure modeling (Wave 4); World Cup dedup.

---

## 1. Live State Snapshot (measured June 15, 2026)

**Data in the DB (real, hydrated from TheSportsDB):**

| Sport | Leagues | Events | Upcoming | Athletes (person rows) |
|---|---:|---:|---:|---:|
| Tennis | 4 | 3,059 | 0* | 360 |
| Basketball | 2 | 1,723 | 228 | — |
| Hockey | 1 | 1,498 | 0* | — |
| Soccer | 10 | 1,078 | 461 | — |
| American Football | 2 | 444 | 95 | — |
| Motorsport | 5 | 279 | 159 | — |
| Golf | 3 | 187 | 70 | 290 |
| Combat Sports | 4 | 124 | 29 | 3,987 |
| Athletics | 5 | 14 | 0 | 517 |
| Olympic Sports | 1 | 3 | 3 | — |

Totals: **~8,400 events, 37 leagues, ~5,150 athletes.** (*Tennis/hockey "0 upcoming" =
between-seasons; events exist, just not future-dated right now.)

**What's deployed and running:**
- 5 edge functions live: `provider-hydrate`, `provider-hydrate-players`, `calendar-feed`,
  `provider-sync`, `notifications`.
- 2 cron jobs active: `provider-hydrate` every 15 min; `provider-hydrate-players` 3×/hour.
- The hydrator **already does change detection**: it diffs title/status/starts_at against the
  stored row, only writes on a real change, bumps `version`, and logs timing changes to
  `event_status_history` (**6,031 rows** logged so far). Season re-pull TTL is 24h; next-fixtures
  delta TTL is 1h. Last successful run: minutes ago. **The refresh loop is real and working.**

**The damning numbers:**
- `user_follows`: **0 rows.** `custom_leagues`: **0 rows.** `calendar_feeds`: **0 rows.**
- Nobody's personal data is server-side, because the frontend never writes it there (§3).

---

## 2. Honest Subsystem Audit — Does It Actually Work?

### 2.1 Exports — partially, and World-Cup-only
- `ExportStudio`, `MySchedule`, and `Home` all read `useMatches()` = **`liveMatches.ts`, which is
  the World Cup JSON only.** None of them touch `useSportSchedule` (the 8,400-event multi-sport
  data). Only the per-sport pages show live multi-sport data.
- So the **PNG / .ics-snapshot / Copy-for-Notes buttons all work mechanically, but they can only
  ever export World Cup matches for followed WC nations.** A user who follows the Lakers or
  Verstappen cannot export them. This is the single biggest credibility gap.
- The snapshot `.ics` (`createIcsBlob`) is fine RFC-wise but minimal: `SUMMARY = "A vs B"`,
  2-hour fixed duration, no emoji, no categories, no alarms.

### 2.2 Live Sync (subscribed calendar feed) — NOT connected, and the function is broken
- `CalendarFeeds.tsx` is **100% localStorage**. It mints fake URLs
  (`https://feeds.<domainHint>/calendar/<token>.ics`) that resolve to nothing. It never calls the
  deployed `calendar-feed` function and never writes the `calendar_feeds` table (0 rows).
- Worse: the deployed `calendar-feed` function **queries columns that no longer exist**
  (`events.certainty`, `starts_at_precision`, `decision_note`). A migration
  (`20260612...reconcile...certainty_taxonomy`) removed that taxonomy from `events`, but the
  function was never updated. **Any feed fetch would 500.** Classic schema drift.

### 2.3 Email notifications — deployed, but three things block it from ever sending
1. **No cron.** The `notifications` function is never invoked on a schedule.
2. **It errors before sending.** It calls `materialize_change_notifications` (RPC) which **does
   not exist**, and that RPC/flow expects an `event_change_log` table that **does not exist**. The
   diff writer logs to `event_status_history` instead — a name mismatch between producer and
   consumer. The function returns 500 at the change-materialize step.
3. **Nothing to notify on.** `materialize_reminders` joins `user_follows` (0 rows) ×
   `alert_preferences` (no UI to set them). Even if it ran, the working set is empty.
- Email transport itself (Resend) is coded correctly but needs `RESEND_API_KEY` + a verified
  sending domain (SPF/DKIM/DMARC) and the branding strings are still `matchpulse.app`.
- **Push** is a stub (VAPID keys not provisioned).

### 2.4 Accounts — auth works, but sign-in does almost nothing
- Magic-link + Google OAuth are correctly wired (`state.tsx`); sessions persist.
- **But `toggleFollow` and `setPrefs` only write localStorage.** There is no read/write to
  `user_follows` or `profiles`, and no local→account migration on sign-in. The sign-in popover
  promises "cross-device follows, live feed management, alerts" — **none of which happen.**
  Signing in currently buys you nothing functional. This is the "auth is the unlock" gap from
  Master Plan 1, still open.

### 2.5 Custom leagues — localStorage only
- `CustomLeagues` / `CustomLeagueAdmin` read/write `store.ts` (localStorage). The DB tables
  (`custom_leagues`, `custom_teams`) exist and are empty. Public share links therefore only work
  on the device that created them. The custom-league `.ics` export (`createCustomLeagueIcsBlob`)
  is good and even includes arrive-early/uniform/notes — but it's a local snapshot.

### 2.6 Frontend automation vs. data — only the sport pages are "alive"
- `Home`'s spotlight rail and globe board are **hardcoded arrays** (acknowledged in MP3). They do
  not read the DB. `MySchedule` and exports are WC-only. Only `SportPage` reflects live data.
- The `spotlight_events` / ranking tables from MP3 do not exist yet.

### 2.7 Calendar output on the user's phone — just a title today
- Live feed `SUMMARY` is the raw event title, e.g. `"Los Angeles Lakers vs Boston Celtics"`. No
  sport emoji, no league context, no `CATEGORIES`, no `VALARM` reminders, no link back.
- `UID`/`PRODID` still say `matchpulse.app` / `MatchPulse`.
- It *does* handle date-only precision, `STATUS:TENTATIVE/CANCELLED`, and stable
  `UID+SEQUENCE` (good — in-place updates, not duplicates).

### 2.8 Sport structure (fight cards, brackets, playoffs) — flat, not modeled
- Events are a flat list with `home_competitor_id` / `away_competitor_id` (binary) plus the
  n-ary `event_competitors` join. Combat events come in as a single `fight_card` kind with **no
  bouts, no card sections, no bout order**. There is **no bracket/round structure**, no
  `event_bouts`, no playoff series modeling. So we cannot yet draw a fight card, a tournament
  bracket, or a race-weekend session board from data — only a generic list row.

---

## 3. The Core Insight: We Have the Data, Not the Glue

The hard part (paced, idempotent, self-verifying multi-sport hydration with change detection) is
**done and running**. What's missing is the *glue* that turns 8,400 rows into a product:

> **Follows, personal schedule, exports, feeds, and alerts must all read the multi-sport DB and
> persist per-user state server-side.** Right now they read World Cup JSON and persist to
> localStorage. Closing that gap is what makes Silbo "every game in your calendar" instead of "a
> World Cup planner with extra read-only pages."

Everything below serves that, in dependency order.

---

## 4. Full Data Caching Plan

The principle (from MP3) is correct and already half-built: **public views read our DB; provider
APIs are only called by scheduled jobs.** Formalize it into tiers with explicit freshness columns.

### 4.1 Cache tiers and cadence

| Tier | Entities | Source cadence | Mechanism |
|---|---|---|---|
| **Static reference** | sports, leagues, venues, circuits | Verify monthly (`VERIFY_TTL=30d`, already in place) | `lookupleague` diff; rarely changes |
| **Seasonal reference** | teams, drivers, fighters, players, tournament fields | Diff weekly; daily near season start | `search_all_teams` / `lookup_all_players` (TTL 7d today) |
| **Schedule** | fixtures, races, fight cards, tee times | Full season re-pull daily (24h TTL today) + next-fixtures hourly | `eventsseason` + `eventsnextleague`, diff-on-write |
| **Live state** | scores, current bout, delays, postponements | 15–120s **only for live/near/followed** events | new `eventslast`/live endpoint, gated by an "active window" query |
| **User views** | follows, feeds, exports, schedule | On read, from our DB | never hits a provider |

### 4.2 Freshness columns to add (cheap, high-leverage)
Add to `events` (and mirror the pattern on `competitors`/`leagues`):
- `payload_hash text` — hash of the normalized provider payload. **Skip the UPDATE entirely when
  the hash is unchanged**, so the daily season re-pull becomes near-free on quiet leagues and we
  stop writing `updated_at` churn.
- `last_checked_at timestamptz` — when we last *looked*, distinct from `updated_at` (when it last
  *changed*). Drives the live-window query and staleness UI ("source last checked 6m ago").
- `source_confidence text` — `official | provider | cached | manual | placeholder`, for export
  disclaimers and ranking.

`provider_targets` already has the per-target cursor columns we need (`verified_at`,
`teams_synced_at`, `events_synced_at`, `next_synced_at`, `last_status`, `last_error`). Generalize
the same shape into a `provider_sync_state` view if/when we add a second provider.

### 4.3 Raw payload retention (optional, later)
When licensing allows, store raw JSON snapshots in Supabase Storage keyed by
`provider_event_id + fetched_at` so we can replay/debug diffs without re-calling the API.

---

## 5. Full Refresh Plan (Delta-Only, Change-Driven)

We already diff and only write real changes (§1). The plan upgrades it from "re-pull whole season
daily" to "look for changes, scaled by how likely the event is to change."

### 5.1 Phase-aware cadence
Compute an event "phase" and poll accordingly, instead of one flat TTL:
- **Dormant** (>7 days out): season re-pull is enough (daily).
- **Imminent** (next 72h): re-check every 1–3h.
- **Live / about-to-start** (T-30m through end): 30–120s polling, **only** for events that are
  live or have followers. A single `select` for "events starting within window OR status=live"
  drives a tight, cheap loop — we never poll the whole catalog at high frequency.
- **Just finished**: one final pull for result/score, then drop to dormant.

### 5.2 Make the change log feed notifications (fix the producer/consumer mismatch)
- The hydrator writes `event_status_history` on timing/status change. The notifications worker
  expects `event_change_log` + `materialize_change_notifications`. **Pick one name** (recommend
  reusing `event_status_history` and writing `materialize_change_notifications` against it, or
  renaming to `event_change_log` and updating the hydrator). Then a followed event's time move /
  cancellation / TBD-confirmed automatically produces a notification row.
- Significance filter (from MP3): only `time_change`, `cancellation`, `postponement`,
  `tbd_confirmed`, and followed-fight-imminent fire immediate emails. Everything else batches
  into a digest. We have the raw signal (`old_starts_at`/`new_starts_at`) to classify this.

### 5.3 `payload_hash` short-circuit
On every re-pull, compute the hash first; if unchanged, update only `last_checked_at` and skip
the row. This is what lets us crank cadence up without cost.

---

## 6. Sport-Structure Modeling (fight cards, brackets, playoffs, sessions)

This is what lets us build *graphics* instead of lists. Add structure tables that hang off
`events`:

### 6.1 Combat — `event_segments` + `event_bouts`
```
event (kind=fight_card)
 └─ event_segments  (early_prelims | prelims | main_card, ordered)
     └─ event_bouts (bout_order, competitor_a, competitor_b, weight_class,
                     scheduled_rounds, status, result, est_start_window)
```
- `est_start_window` is **derived** (card start + Σ prior bout average + broadcast padding) and
  presented as a window, never a promise — tightened live as bouts end.
- Enables the standout feature: *"alert me when the fighter I follow is about to walk."*
- TheSportsDB does not give bout order reliably; for MVP we can model the structure and populate
  main/prelim from the event + manual/secondary source, then automate per promotion.

### 6.2 Tournaments/playoffs — `event_stage` + `bracket_slots`
- Add `events.stage` (`group | round_of_16 | quarter | semi | final | medal`) and
  `events.series_id` for best-of-N playoff series (NBA/NHL). World Cup already has rounds in
  `metadata.round`; promote that to a typed column.
- A `bracket_slots` table (stage, position, home/away source slot) lets us render a real bracket
  graphic and "winner of QF2 plays here" placeholders.

### 6.3 Motorsport — `event_sessions`
- A race weekend is one `event` with child `event_sessions` (FP1/FP2/FP3, Qualifying, Sprint,
  Race), each with its own start time. Today they likely land as separate flat events; grouping
  them powers the race-weekend board and a single "F1 — Canadian GP" calendar entry with the race
  as the anchor.

### 6.4 Individual sports — sessions/rounds
- Golf rounds (R1–R4 tee sheets), tennis draw rounds, athletics heats/finals — same
  parent-event + child-session pattern. The roster work already gives us the athletes.

These four share one shape: **a parent `event` + ordered child rows.** Build the generic
`event_sessions`/`event_segments` pattern once; specialize columns per family.

---

## 7. Calendar UX on the User's Device

Make the calendar entry feel designed, not dumped. All of this is additive to the existing
`_shared/ics.ts` renderer:

- **Sport emoji in `SUMMARY`** (renders on Apple/Google/Outlook): `⚽ England vs France`,
  `🏀 Lakers vs Celtics`, `🏁 Canadian Grand Prix`, `🥊 UFC 323 — Main Card`, `🎾`, `⛳`, `🏈`,
  `🏒`, `🏃`, `🏅`. One map keyed by `sport.key`.
- **`CATEGORIES:Soccer,UEFA Champions League`** — some clients color/group by category.
- **Richer `DESCRIPTION`**: league · round/stage · venue · "Times shown in your timezone" · a
  short link back to the live event page (also the QR target for static exports).
- **`VALARM`** blocks from the user's reminder lead time (`-PT1H`, `-PT15M`) so the calendar
  itself nudges them — not just our email.
- **Fix stale identity**: `UID:<id>@silbosports.app`, `PRODID:-//Silbo Sports//...`.
- Keep the good parts already there: `SEQUENCE` from `version`, `STATUS:TENTATIVE/CANCELLED`,
  date-only precision, line folding.

---

## 8. "Flood the Backend Over Time" — Expansion Plan

The hydrator is paced and self-verifying, so scaling is mostly *adding `provider_targets` and
letting the verifier sort them*. Concretely:

1. **Widen the league allowlist.** We have 37 leagues; TheSportsDB has hundreds. Add candidate
   targets per family (more soccer leagues — Eredivisie, Liga MX already in, Championship,
   Primeira, MLS playoffs; more basketball — EuroLeague, NCAA, NBL; NHL minor/IIHF; ATP/WTA per
   tour; full F1 + MotoGP + IndyCar + WEC; boxing orgs). The verifier auto-rejects wrong IDs.
2. **Backfill historical seasons** for depth/SEO (`eventsseason` with prior `s=` values) on a
   low-priority cursor so it never starves live data.
3. **Players for team sports** (optional) — only where rosters add value; keep the "individual
   sports first" rule.
4. **Raise the per-run budget cautiously** (`HYDRATE_CALL_BUDGET`) now that we're on premium
   (100/min); current 60/run @ 750ms is conservative. More targets may warrant a second
   staggered cron rather than a bigger budget, to stay under the minute ceiling.
5. **Add a backfill/QA dashboard query** (or admin page) over `provider_targets.last_status` so
   we can see coverage and failures at a glance.

Guardrail: every new target costs ~1 verify + 1 teams + 1 season call up front, then ~1
call/hour. 100 leagues ≈ 100 calls/hour steady-state — fine on premium with staggering.

---

## 9. What I Can Tackle Right Now (no secrets / decisions needed)

Ordered by leverage-to-risk. None of these need new API keys or product decisions:

1. **Fix the two schema-drift bugs** (low risk, unblocks real features):
   - Update `calendar-feed` to the current `events` schema (drop `certainty`/`precision`/
     `decision_note`, derive tentative from `starts_at_tbd`/`status`).
   - Reconcile the notifications change-materializer with `event_status_history` (or add the
     `event_change_log` the consumer expects). Then add the missing **notifications cron**.
2. **Wire follows + prefs to Supabase** when signed in (read/write `user_follows`, `profiles`;
   merge localStorage → account on first sign-in). This is the keystone — it makes accounts,
   alerts, and cross-device real.
3. **Make exports + My Schedule multi-sport**: point them at a unified "my events" query over the
   DB (followed leagues/teams/competitors), not WC JSON. Reuse the existing pagination/poster/ics
   code — just change the data source.
4. **Connect Live Sync to the real `calendar-feed` function**: write `calendar_feeds` rows, show
   the real feed URL once, drop the placeholder domain.
5. **Calendar polish** (emoji/categories/alarms/branding) in `_shared/ics.ts` + the snapshot
   exporter — small, visible, on-brand.
6. **Flood the DB**: add a batch of `provider_targets` (§8) and let the cron absorb them.
7. **Add `payload_hash` + `last_checked_at`** and the short-circuit, then phase-aware cadence.

Needs you / external setup (not blocked on me, but I can't finish alone):
- **Email**: provision `RESEND_API_KEY` + verify a sending domain (SPF/DKIM/DMARC). Then email
  reminders/changes go live.
- **Push**: generate VAPID keys.
- **Sport structure data** (bouts/brackets): the schema I can build now; *reliable* bout order /
  bracket data may need a second provider (API-SPORTS MMA) — a procurement decision.
- **Branding**: final call on Silbo vs MatchPulse before stamping it into feeds/emails.

---

## 10. Recommended Sequence

**Wave 1 (unblock + keystone):** fix the two backend bugs → wire follows/prefs to DB →
multi-sport "my events" query. After this, signing in and following anything across all sports
actually works and persists.

**Wave 2 (the promise):** multi-sport exports + real Live Sync feeds + calendar polish (emoji/
alarms). After this, "every game in your calendar" is literally true.

**Wave 3 (retention):** notifications cron + change→alert pipeline (needs Resend) + spotlight
tables so the homepage runs from data.

**Wave 4 (distinctive):** fight-card + bracket + race-weekend structure and the graphics/exports
that ride on them — including "alert me when my fighter walks."

**Ongoing:** flood `provider_targets`; add `payload_hash`/phase-aware cadence as volume grows.

### IA Note: My Schedule as the Hub

Merge export functionality into **My Schedule** instead of treating Exports as a main page. My
Schedule should be the post-selection home base: review saved matches, choose calendar sync,
download static files, print/share, and manage reminders/settings from one surface.

Later, make the schedule hub smarter with DB-backed saved schedule summaries and reminder state.

---

## 11. Competitive Strategy Overlay (June 19, 2026)

Reviewed source pack:

- `Silbo_Competitive_Product_Technology_Strategy_2026.docx` / `.pdf`
- `Silbo_Competitive_Strategy_Decision_Workbook_2026.xlsx`
- `Silbo_Competitive_Analysis_Data.json`
- `Silbo_Competitive_Strategy_README.txt`

Strategic answer in one sentence: **do not compete as another fixed directory of team calendar
feeds; win as the neutral sports schedule compiler.** Silbo should let a fan, family, organizer,
publisher, or small rights holder express the living sports schedule they actually need, then sync,
export, print, share, embed, or alert on it without betting, fantasy, or stats-app clutter.

### 11.1 Competitive Position

The reviewed market splits into five businesses:

1. **Calendar-feed catalogues** (`Sync2Cal`, `SportsCal`, `Fixtur.es`): win with search, breadth,
   one-tap subscription, and trust that events stay updated.
2. **Static export utilities** (`Your Sports Calendar`, `Matchesio`, open ICS repos): win with no
   login, CSV/PDF/ICS, dashboard/print use, and immediate file delivery.
3. **League/tournament schedulers** (`LeagueLobster`, AI schedulers): win with deterministic
   pairing/venue constraints and organizer switching costs.
4. **Team/club operating systems** (`TeamSnap`, `SportsEngine`, `LeagueApps`): win through
   organization-mandated adoption, registration, payments, roster, chat, and RSVP bundles.
5. **Calendar-marketing infrastructure** (`ECAL`, `AddEvent`, `Teamup`): win with branded sync
   channels, analytics, localization, APIs, enterprise reliability, and permissions.

Silbo's wedge is the intersection none of them fully owns: professional + local/custom schedules,
multi-sport follows, live feeds, static exports, uncertainty-aware event modeling, multilingual UI,
and future schedule rules/recipes from one normalized event model.

### 11.2 Immediate Foundation Gates

Treat these as release gates before scaling acquisition:

- **Feed correctness and first-party delivery:** fix placeholder/TBD feed semantics for truly null
  `starts_at`, implement `include_broadcasts`, proxy calendar URLs through
  `https://silbosports.com/cal/...`, and set one canonical `APP_URL` everywhere.
- **Feed health and key management:** store last successful feed access, provider freshness,
  generation status, stale warnings, revoke/rotate controls, and a client-specific polling
  expectation note. Keep raw feed tokens unrecoverable.
- **Product analytics:** instrument anonymous and signed-in funnels before paid acquisition:
  first follow, first preview, first export, feed creation, feed activation, alert opt-in,
  collection creation, import success/failure, and week-4 retained scheduler.
- **Provider independence:** keep TheSportsDB as low-cost breadth/artwork/fallback, but introduce a
  provider adapter + field-level provenance layer and a second provider shadow scorecard before
  promising premium coverage.
- **Rights and allowed-use registry:** track which providers/leagues allow public pages, feeds,
  exports, embeds, screenshots, affiliate links, and API redistribution.
- **Architecture/documentation hygiene:** archive superseded naming/status docs and generate status
  docs from source where possible so product claims do not drift.

### 11.3 Product Objectives Added By The Competitive Review

Highest-leverage objectives to merge into the existing backlog:

- **No-account live preview + quick export:** show enough value before signup, then convert after a
  useful export/feed exists.
- **Named Silbo Collections:** turn raw follows into saved collections like "Canada + Brazil World
  Cup nights", "F1 weekends", or "family hockey + Leafs". Collections should power feeds, alerts,
  exports, share links, and future rules.
- **One export schema, many formats:** add CSV, JSON, XLSX, true PDF/print, and saved export
  recipes beside ICS, PNG, and Notes. Export recipes should remember fields, language, layout,
  accessibility/quiet mode, and branding.
- **Schedule compiler rules:** build toward union/intersection/exclusion rules, time windows,
  round/session filters, "only finals", "no events after 11pm", and "winner of this slot" logic.
- **Change intelligence:** alert on meaningful diffs, not just raw updates: time moved, venue
  changed, opponent resolved, broadcast added/removed, status postponed/cancelled, or confidence
  changed.
- **Import workflows:** ICS/CSV first, then assisted image/PDF extraction. Always include mapping,
  preview, validation, and reversible commits.
- **Custom league normalization:** keep the local-first ease, but normalize active custom teams,
  events, roles, audit history, constraints, generators, and publish state instead of depending on
  JSON payloads for long-lived operational data.
- **Direct calendar connectors:** after feed reliability, offer optional least-privilege Google and
  Outlook calendar creation while keeping portable ICS as the universal fallback.
- **Embeds / white-label publish widgets:** after rights controls, pilot a small "Silbo Sync" widget
  for clubs, publishers, and community organizers.
- **Public request + correction queue:** turn missing coverage and corrections into demand signals,
  with evidence links, review status, and accountability.

### 11.4 Data And Hydration Implications

The competitive review changes the data plan from "more leagues" to **measured source quality**:

- Add field-level provenance for important event fields (`starts_at`, venue, competitors, status,
  broadcast, round/session, artwork): source provider, source id, last checked, confidence,
  allowed-use class, and discrepancy state.
- Keep `events.source_confidence` for simple display, but add a lower-level provenance/discrepancy
  table before the second provider becomes authoritative.
- Use **API-Sports** as the most likely second-provider shadow candidate across high-demand sports;
  use **Sportmonks** selectively for premium football depth; reserve **Sportradar** for future
  official/enterprise coverage when revenue justifies procurement.
- Backfill `broadcasts`/watch links regionally before leaning on affiliate revenue. The useful unit
  is "viewer in region X with service Y", not a generic TV string.
- Add data quality SLOs and a public/internal coverage status view: freshness, stale minutes,
  target failures, confidence distribution, correction turnaround, and provider disagreement rate.
- Continue the World Cup dedupe objective: retire or bridge the `worldcup_json` planner path so
  2026 soccer runs from the same DB-backed/provider-provenance model as the rest of Silbo.

### 11.5 Monetization Direction

Principle: charge for ongoing coordination, reliability, and workflow depth; keep basic fixture
access portable and useful.

- **Free:** browse, basic follows, one live feed, limited collections, basic ICS/PNG/text, ten-event
  preview, and small community-league limits.
- **Silbo Plus:** test US$24-36/year for unlimited collections/feeds, CSV/JSON/XLSX/PDF, advanced
  rules, change intelligence, watch preferences, visual packs, and priority requests.
- **Silbo Family:** test US$48-60/year for household profiles, shared schedules, travel buffers,
  conflict rules, and quiet/accessibility profiles.
- **Silbo Organizer:** test US$9-29/month or event-volume pricing for imports, generators, roles,
  RSVP, public pages, embeds, custom branding/domain, and operational alerts.
- **Silbo Publish/API:** test US$99-599+/month for white-label sync selectors, API/webhooks,
  analytics, localization, official badges, SLA, and multi-admin publishing.

Avoid dense display ads in the schedule flow, betting affiliate dependence, per-team consumer
pricing, opaque small-club quotes, and locking users out of static/historical exports after
cancellation.

### 11.6 Twelve-Month Roadmap Overlay

- **0-30 days:** feed semantics, first-party feed URL, token/key controls, analytics, rights
  registry, architecture docs.
- **31-90 days:** provider adapter, second-provider shadow scorecard, no-account preview,
  CSV/JSON/XLSX/PDF, named Collections, correction/request queue, visible confidence, web push,
  data SLOs.
- **60-180 days:** saved compiler rules, optional Google/Outlook connectors, regional watch data,
  SEO discovery pages as product surfaces, change-diff alerts, imports, roles, entity
  localization/transliteration, uncertainty everywhere, accessible/quiet exports, subscription
  billing.
- **90-240 days:** deterministic grassroots schedule generator, assisted image/PDF import,
  conversational setup wrapper around the solver, RSVP/availability, embeds/white-label pilot,
  Organizer pricing.
- **180-365 days:** public API/webhooks, household plan, Silbo Travel prototype, saved visual packs
  and template marketplace.

### 11.7 KPI Set

Track success by product behavior, not only traffic:

- Activation: visitor -> first follow/preview/export/feed; no-account preview -> account conversion.
- Reliability: feed-option test pass rate, stale-event rate, feed fetch success, provider freshness,
  token rotations without support, correction turnaround.
- Retention: week-4 retained schedulers, collections per activated user, feeds per active user,
  alert open/action rate, export recipe reuse.
- Coverage: priority-league completeness, provider disagreement rate, confidence distribution,
  request-driven coverage closed.
- Monetization: paid conversion, ARPU, churn, Organizer publish conversion, B2B MRR, affiliate
  click-through with complaint rate guardrails.
