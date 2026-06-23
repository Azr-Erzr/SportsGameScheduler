# Esports — PandaScore Source Map

Added 2026-06-22. Esports is a first-class sport (`sports.key = 'esports'`, seeded by migration
`20260622220000_esports_sport.sql`) hydrated from [PandaScore](https://developers.pandascore.co).

## Setup (one-time)

1. **Apply the migration** so the `esports` sports row exists.
2. **Set the secret** in Supabase → Project Settings → Edge Functions → Secrets:
   - `PANDASCORE_TOKEN = <your PandaScore access token>`
   - The token is **server-only** — it is read in the edge function and never shipped to the browser.
     PandaScore explicitly warns against client-side use.
3. **Deploy** the edge function `provider-hydrate-pandascore`.
4. **Schedule it** — `provider-hydrate-pandascore` in `supabase/cron.sql` (every 30 min).

## What it does

`supabase/functions/provider-hydrate-pandascore/index.ts`:

- Auth: `Authorization: Bearer ${PANDASCORE_TOKEN}`, `Accept: application/json`, base `https://api.pandascore.co`.
- Calls `GET /{game}/matches/upcoming?sort=begin_at&per_page=50&page=1` once per game per tick.
- Default games (`PANDASCORE_GAMES`): `lol, dota2, csgo, codmw, r6siege`. CS2 is still served under the
  historical `csgo` path; COD under `codmw`. Add `valorant`, `ow`, `rl`, etc. by editing the env var.
- Upserts `leagues` (provider_key `pandascore`), team `competitors`, `events`, and `event_competitors`,
  keyed on provider ids so re-runs are idempotent and only real changes bump `version`.

## Rate limits & frugality

PandaScore's Schedules plan allows ~**1,000 requests/hour**. The function is budgeted:

- One call per game per tick (≈5 calls), paced `PANDASCORE_SPACING_MS` (400 ms) apart.
- `PANDASCORE_CALL_BUDGET` caps calls per invocation (defaults to the game count).
- A 30-minute cron cadence → ~10 calls/hour. Tune `PANDASCORE_PER_PAGE` / cadence as the plan allows.
- Stops cleanly on HTTP 429 (records `stopped: rate_limited`) and resumes next tick.

## Manual trigger

`POST /functions/v1/provider-hydrate-pandascore` with `{}`, or `{ "games": ["lol","csgo"] }` to limit
the run. Returns `{ ok, stopped, counters }`.

## Frontend

Esports appears in the Explore expansion lane and the global search. It uses the shared "Other Sports"
icon (no per-title art yet) and renders through `useSportSchedule('esports')` like every other sport.
