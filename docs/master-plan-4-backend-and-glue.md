# Master Plan 4: Backend Reality Check, Caching, Refresh, and the Glue That Makes Silbo Worth Using

Last updated: June 21, 2026

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

## 0.1 Update - Shipped Since The June 15 Audit (June 21, 2026)

The audit sections below remain useful historical context, but several "broken" findings have now
been closed in the repo:

- **Exports and My Schedule are no longer World-Cup-only.** Multi-sport events flow into My
  Schedule, export advice, ICS, CSV, Notes/share text, image packs, and branded PDFs.
- **Live Sync is connected.** Signed-in users create real `calendar_feeds` rows with hashed tokens,
  copy/open the deployed feed URL, include TBD placeholders/broadcast metadata, and manage active
  feeds from the UI.
- **Alerts are real up to the transport boundary.** Alert settings write `alert_preferences`, copy
  is centralized, change/reminder materialization is scheduled, and notification delivery is ready
  for Resend/VAPID secrets.
- **Accounts now unlock real state.** Magic link/Google auth, follows, preferences, local-to-account
  merge, custom leagues, and feed creation all have server-backed paths.
- **Provider caching exists.** Hydrators and provider sync now compute `payload_hash`, update
  `last_checked_at` on unchanged pulls, bump versions only on calendar-visible changes, and record
  change history.
- **Calendar-feed ingestion exists.** `source_providers`, `source_targets`, and
  `event_external_ids` are in repo; `ics-feed-ingest` parses allowlisted public `.ics`/`webcal://`
  feeds, hashes payloads, respects dry-run mode, and upserts canonical events.
- **Coverage expanded.** Baseball is a full route, other provider-backed sports have a coverage
  page, and the sports nav/dropdown is now the primary discovery pattern.

Remaining MP4 work:

- Provision email and push secrets, then verify real delivery end to end.
- Add source-target admin review tooling and seed verified official calendar feeds.
- Backfill factual `broadcasts`/watch-provider data and approved affiliate URLs.
- Replace hardcoded homepage spotlight/world-board arrays with DB ranking tables/jobs and the
  competition lifecycle automation described in `docs/spotlight-lifecycle-automation.md`.
- Model `event_bouts`, bracket slots, playoff series, and race-weekend sessions once reliable data
  sources are selected.

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

## 2. Honest Subsystem Audit - Historical June 15 Snapshot

The findings in this section captured the state before the June 15-21 implementation passes. Use
the June 21 update above for current status; this section remains as the original diagnosis.

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

### 4.4 New Objective: Calendar-feed ingestion as a cheap structured-data source

Many leagues, teams, federations, venues, and tournament organizers publish `.ics` or
`webcal://` calendar feeds. These should become a second-tier hydration source after official/free
APIs and before any HTML scraping.

**Goal:** build a scheduled ingestion lane that fetches public calendar feeds, parses them into
normalized events, hashes payloads, and upserts them into the same canonical `events` model without
requiring an AI/browser-reading agent.

**Why this matters:**
- `.ics` is already structured event data: title, start/end time, venue/location, description,
  UID, sequence, status, and sometimes organizer/source metadata.
- Feeds are usually cheap or free, and often published by official sources.
- Calendar feeds are less brittle than visual page scrapes and easier to validate with deterministic
  parser tests.
- Feed polling can be paced by source freshness: daily for far-future schedules, every few hours
  around active tournaments, and more often only for followed/near-live events when the source
  permits it.

**Schema / pipeline shape:**
- Add `source_providers` / `source_targets` rows for feed-based sources, with `source_type = 'ics'`
  or `source_type = 'webcal'`.
- Store each fetched feed snapshot or normalized payload hash in the provider cache layer:
  `payload_hash`, `last_checked_at`, `last_changed_at`, `last_status`, `last_error`.
- Parse feed items into a normalized adapter result:
  `external_id`, `title`, `starts_at`, `ends_at`, `status`, `venue`, `source_url`, `raw_uid`,
  `sequence`, `description`, and optional sport/league/team hints.
- Resolve into canonical `events` through `event_external_ids`, so the same match from API-Sports,
  TheSportsDB, and an `.ics` source can dedupe rather than duplicate.
- Assign `source_confidence = 'official'` for official league/team/federation feeds, otherwise
  `source_confidence = 'provider'` or `cached`.
- Log changes into `event_status_history` when `starts_at`, `status`, title, or venue changes,
  so reminders and change notifications reuse the existing pipeline.

**Implementation steps:**
1. Add DB columns/tables needed for provider cache maturity first (`payload_hash`,
   `last_checked_at`, `source_confidence`, source target type).
2. Add a generic `ics-feed` adapter/parser with tests for common feed variants.
3. Create a small allowlist of public official feeds for low-risk sports/leagues and run them
   through a dry-run normalizer.
4. Upsert parsed events into staging/provider payload tables first; promote to canonical `events`
   only after dedupe confidence is acceptable.
5. Add cron cadence and admin observability: last check, last changed, events added/changed,
   parser errors, and source terms notes.

**Guardrails:**
- Do not scrape private calendars, authenticated calendars, or feeds that prohibit reuse.
- Respect `robots.txt` / terms where the feed is discovered from a website.
- Use deterministic parsers and adapter tests; do not rely on an AI agent reading screens.
- Treat feeds as schedule truth only when source confidence is clear; otherwise use them as
  enrichment/corroboration until verified.

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

### Current Status - June 21, 2026

Completed from the original MP4 queue:

1. [x] Fix the two schema-drift bugs: `calendar-feed` uses the current `events` schema, and
   notifications materialize from existing change/history data on cron.
2. [x] Wire follows + prefs to Supabase when signed in, including local-to-account merge.
3. [x] Make exports + My Schedule multi-sport with a unified "my events" path.
4. [x] Connect Live Sync to the real `calendar-feed` function with real `calendar_feeds` rows.
5. [x] Add calendar polish in `_shared/ics.ts` and the snapshot exporter.
6. [x] Flood the DB/provider allowlist with secondary sports and baseball targets.
7. [x] Add `payload_hash` + `last_checked_at` and unchanged-payload short-circuiting.
8. [x] Add calendar-feed ingestion for allowlisted `.ics` / `webcal://` sources.
9. [x] Add non-mutating provider verification probes for TheSportsDB, API-SPORTS, OpenF1, and
   combat coverage, plus a main-sport DB coverage audit for the 11 top navigation sports.

New immediate backend queue:

1. Seed and review official calendar-feed targets. Keep `dry_run = true` until source terms and
   source confidence are verified, then promote selected feeds.
2. Add source/provider observability to `/admin`: target status, last checked/changed, dry-run
   result counts, errors, and source terms notes.
3. Backfill factual `broadcasts`, then attach approved `watch_links` with disclosure and region
   matching.
4. Replace hardcoded homepage data with competition templates/instances, lifecycle-aware
   spotlight/ranking tables, and a region-aware world-board query.
5. Model `event_bouts`, fight-card sections, bracket slots, playoff series, race-weekend sessions,
   and export templates that use those structures.

The historical queue below is kept as audit context; every numbered item in it has been completed
in the repo.

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
8. **Add calendar-feed ingestion** (§4.4): parse official/public `.ics` and `webcal://` feeds as
   cheap structured schedule sources, cache payload hashes, dedupe through `event_external_ids`,
   and upsert verified events into the canonical DB.

Needs you / external setup (not blocked on me, but I can't finish alone):
- **Email**: provision `RESEND_API_KEY` + verify a sending domain (SPF/DKIM/DMARC). Then email
  reminders/changes go live.
- **Push**: generate VAPID keys.
- **Sport structure data** (bouts/brackets): the schema I can build now; *reliable* bout order /
  bracket data may need a second provider (API-SPORTS MMA) — a procurement decision.
- **Branding**: final call on Silbo vs MatchPulse before stamping it into feeds/emails.

---

## 10. Recommended Sequence

Current status:

- **Wave 1 (unblock + keystone):** complete in repo.
- **Wave 2 (the promise):** complete in repo, pending production-domain/env verification.
- **Wave 3 (retention):** partly complete. Notifications cron/change-alert pipeline is in repo but
  needs Resend/VAPID setup; spotlight tables are still open.
- **Wave 4 (distinctive):** still open. Fight-card, bracket, playoff-series, and race-weekend
  structures need reliable source data and UI/export templates.
- **Ongoing:** add verified provider/source targets, watch `payload_hash` effectiveness as volume
  grows, and promote calendar-feed sources from dry-run only after terms/source confidence review.

Historical sequence from the June 15 audit:

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
