# Silbo Sports — Data Hydration & Live Wiring Handoff

_Last updated: 2026-06-15. This documents the work done in the **data/backend chat** (TheSportsDB
hydration → Supabase → live frontend). It is complementary to the design/frontend team's
handoff, which it does not duplicate. Read both to get the full picture._

---

## TL;DR — what now works end-to-end

- A **paced, checkpointed hydration pipeline** pulls real schedules and rosters from TheSportsDB
  into Supabase, on a cron, without tripping rate limits.
- **~37 leagues, ~8,400 events** across all sports, plus **~3,900 combat athletes / 360 tennis /
  275 golf players** are live in the DB.
- The **frontend reads live data** for every sport (leagues, upcoming events, and athlete rosters
  for individual sports), replacing the old static placeholders.
- The **World Cup planner stays the soccer landing experience**, but all other soccer leagues are
  now selectable alongside it, ordered by viewership.
- League selectors now scale to sports with long league tails via a **searchable "More leagues"
  panel** (the most recent feature — see §6).

---

## 1. The provider: TheSportsDB

- **API v1**, key-in-path: `https://www.thesportsdb.com/api/v1/json/{KEY}/{endpoint}`.
- The key lives **only as a Supabase secret** (`THESPORTSDB_KEY`). It is never in the repo, the
  frontend bundle, or chat. Do not paste it anywhere.
- Rate limits: Free 30 req/min, Premium 100 req/min. Our pipeline is paced well under this.
- Endpoints we use:
  - `lookupleague.php?id=` — verify a league id + get its canonical name/sport.
  - `search_all_teams.php?l={leagueName}` — teams/competitors for a league. **Use the name-based
    endpoint**; the id-based `lookup_all_teams.php?id=` returns 404 on the current API.
  - `eventsseason.php?id=&s={season}` — full season schedule.
  - `eventsnextleague.php?id=` — next-fixtures delta.
  - `lookup_all_players.php?id={teamId}` — roster for a team/grouping. Returns `{player:[...]}`
    (singular key — easy to get wrong).
- Quirks discovered: `all_leagues.php` only exposes soccer on the free tier;
  `search_all_leagues.php?s={Sport}` returns partial slices. NFL needs season label `2025`
  (not `2025-2026`, which returns empty).

## 2. Data model (Supabase, project `gcnbgdpicgeahxscpsfc`)

- `sports` — canonical sport families. Reconciled this chat: `f1→motorsport`, `nhl→hockey`,
  `nba→basketball`, and added `american_football`, `combat_sports`, `athletics`,
  `olympic_sports`.
- `leagues` — has `provider_key`, `provider_league_id`, `is_public`, and **`display_rank`**
  (lower = shown first; backfilled from `provider_targets.priority`). This is what drives the
  viewership ordering of the league pills.
- `events` + `event_competitors` — n-ary event model (an event has N competitors via the join
  table, so it isn't locked to home/away).
- `competitors` — has `kind` (`team` | `person`), `parent_competitor_id` (player → their
  grouping/roster), and `players_synced_at`.
- `venues` — `unique(name)`.
- `provider_targets` — the hydration allowlist + per-target cursors, call budgets, priority.

### Migrations applied (live)
- `20260614120000_provider_targets_taxonomy.sql` — sport reconcile + `provider_targets` table +
  `venues unique(name)` + seed 15 leagues.
- `20260614140000_scale_hydration.sql` — `competitors.parent_competitor_id` + `players_synced_at`,
  curated Olympics league/events, +23 league targets.
- `20260615090000_league_display_rank.sql` — `leagues.display_rank` (backfilled; `worldcup_json`=5,
  `curated`=40), index `leagues_rank_idx (sport_id, display_rank)`.

## 3. Hydration edge functions (Deno)

- **`provider-hydrate`** — paced event hydrator. Flow per target: verify → teams
  (`search_all_teams.php?l={leagueName}`) → season events (`eventsseason`) → next delta. Each
  target is wrapped in its own try/catch so one bad league can't abort the batch. Aborts on 429
  or call-budget exhaustion. `CALL_BUDGET=60`, `SPACING=750ms`.
- **`provider-hydrate-players`** — expands individual-sport grouping "teams" into real athletes.
  For individual sports, `search_all_teams` returns *grouping* entities ("PGA Tour Golfers",
  "ATP Mens", "Boxing Bantamweight", "Australia Athletics"); the real athletes are their rosters
  via `lookup_all_players.php?id={groupId}`, inserted as `competitors(kind='person',
  parent_competitor_id=group)`. `CALL_BUDGET=50`.
- Both run on **pg_cron + pg_net** with an anon JWT (see `supabase/cron.sql`). Upserts are
  idempotent on provider IDs, so reruns are safe.

### Design principle: verify-before-write
The verify step rejected 3 wrong candidate league ids that would have polluted the DB
(EuroLeague `4458`=Cricket, PFL `5358`=Basketball, IndyCar `4422`=Soccer). They're left
deactivated as secondary leagues.

## 4. Known data limits (not bugs)
- **Athletics players = 0**: the groupings are national federations, which have no individual
  rosters in TheSportsDB. Data limitation, not a pipeline failure.
- **World Cup**: TheSportsDB id `4429` is confirmed and ingested. The openfootball static set is a
  duplicate that still feeds the planner. Dedup (point planner at `4429`, retire openfootball) is
  **deferred** — see §7.

## 5. Frontend live wiring

- **`src/data/liveSport.ts`** — the generic read layer, keyed by canonical sport key:
  - `useSportSchedule(canonicalSportKey)` → `{ leagues, events, loading, configured }`. Leagues
    ordered by `display_rank` then name. Events filtered to upcoming (`starts_at >= now-3h`,
    limit 120). `loading` is **derived** from a stored `forKey` (not set synchronously in the
    effect — that caused lint errors and cascading renders).
  - `useSportRoster(canonicalSportKey, enabled)` → `{ players, loading }` (`competitors` where
    `kind='person'`, limit 500).
  - Both use the embedded-filter pattern `.select('…, sports!inner(key)').eq('sports.key', key)`.
- **`src/data/liveMatches.ts`** — World-Cup-specific (`provider_key='worldcup_json'`), feeds the
  `WorldCupPlanner`. Unchanged this chat.
- **`src/pages/SportPage.tsx`** — routes soccer → `SoccerPage` (World Cup planner + league
  switching), everything else → `LiveSportPage` (events + roster panel for individual sports).
  `INDIVIDUAL_SPORTS = ['tennis','golf','athletics','combat_sports']` drives the roster panel.
  - Roster renders for individual sports **regardless of whether events exist** (tennis has 0
    upcoming events but 360 players — earlier it showed empty; fixed). Empty events shows an
    inline notice next to the roster.
- **`src/domain/sports.ts`** — all sports flipped `enabled: true`; motorsport priorities make F1
  first.

## 6. League filter — "More leagues" + search (most recent feature)

User request: _"for sports where there will be lots of leagues … we should have a little more
leagues pill or other button option … a mini search bar so users can look for their desired
league filter."_

Implemented as a single reusable `LeagueFilter` component in `src/pages/SportPage.tsx`, used by
both `SoccerPage` (`primaryLabel="World Cup"`) and `LiveSportPage` (`primaryLabel="All"`):

- Renders the primary chip + the top **`inlineCount` (default 6)** leagues as pills, in
  `display_rank` (viewership) order.
- If the selected league is outside the inline set, it's **also shown as a chip** so the active
  selection is always visible.
- When `leagues.length > inlineCount`, a **"More +N"** button opens a dropdown panel with a
  **search input** filtering the full league list (case-insensitive substring). Selecting closes
  the panel; **Escape** and **click-outside** also close it.
- Sports with few leagues (e.g. motorsport: 5) show **no More button** — unaffected.

Verified in preview: soccer shows `World Cup + 6 pills + "MORE +2"`; the panel lists all 9,
typing `mexican` narrows to `World Cup + Mexican Primera League`, selecting it closes the panel,
sets the heading, and surfaces it as an inline chip. Motorsport shows F1 first and no More button.
No console errors. `npm run lint`, `npm run build`, `npm run test` (19 tests) all pass.

## 7. Backlog / deferred
- **World Cup dedup**: point the planner at TheSportsDB `4429`, retire the openfootball static set.
- **README naming** is still stale (pre-Silbo).
- Athletics individual athletes (blocked by provider — see §4).

## 8. Operating rules carried into this work
- API key is **Supabase-secret-only**; never in repo/frontend/chat.
- Hydration is **slow and steady**: budgets + spacing + 429-abort + idempotent upserts.
- Commit/push only when the user explicitly asks.
