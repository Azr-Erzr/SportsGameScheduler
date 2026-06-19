# MatchPulse Supabase Backend

Checked-in backend code for the plan's Objectives 3–6, 9–11. Nothing here is deployed yet —
the frontend currently runs on local data + localStorage, shaped to swap onto this API.

## Layout

- `migrations/` — numbered SQL, run in order:
  - `0001_core.sql` — sports/leagues/seasons/venues/competitors/events + `event_competitors`
    (n-ary participation) + `broadcasts` + history + sync runs. Visibility-gated RLS.
  - `0002_users.sql` — profiles, follows, `get_my_schedule` (security invoker).
  - `0003_calendar_feeds.sql` — tokenized live feeds.
  - `0004_custom_leagues.sql` — custom leagues/members/teams, private-event RLS (member
    read + admin write), owner-membership trigger, `get_shared_league` token lookup.
  - `0005_notifications.sql` — alert prefs, push subscriptions, channel-agnostic delivery
    queue, `materialize_reminders` (idempotent), `claim_due_notifications`
    (FOR UPDATE SKIP LOCKED).
- `functions/` — Deno Edge Functions:
  - `provider-sync` — adapter-based sync with diff-before-version-bump. Ships with the
    `worldcup_json` demo adapter; licensed providers slot in behind the same interface.
  - `provider-hydrate` - paced TheSportsDB league/team/event hydrator.
  - `provider-hydrate-apisports` - paced API-Sports/API-Football fixture hydrator for
    high-priority soccer targets, starting with the World Cup pilot target.
  - `calendar-feed` — `GET /calendar-feed/:token.ics`, stable UID/SEQUENCE, RFC 5545
    escaping + line folding.
  - `notifications` — materialize + claim + send, dispatching by channel (email via Resend;
    Web Push pending VAPID keys).
- `cron.sql` — pg_cron schedules for sync + notifications.

## Deploy steps (when ready)

1. `supabase init` / link the project, then `supabase db push` (or apply migrations via MCP).
2. Seed `sports` (at minimum `soccer`) and the WC2026 league row.
3. Set function secrets: `WORLDCUP_JSON_URL`, `THESPORTSDB_API_KEY`, `APISPORTS_KEY`,
   `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, VAPID keys when Web Push lands.
4. `supabase functions deploy provider-sync provider-hydrate provider-hydrate-apisports calendar-feed notifications`.
5. Run `cron.sql` with the project ref filled in.
6. Point the frontend store layer (`src/lib/store.ts`) at supabase-js instead of localStorage,
   and merge anonymous local follows into `user_follows` on first sign-in (Objective 14.2).

## API-Sports setup

Use the direct API-Sports key as a server-only Edge Function secret:

```sh
supabase secrets set APISPORTS_KEY=<your-api-sports-key>
```

The pilot hydrator reads API-Football from `https://v3.football.api-sports.io` with the
`x-apisports-key` header. Free plan usage should stay low: run this daily or manually while
testing, and keep `APISPORTS_CALL_BUDGET` small until the dashboard proves consumption is
stable.

## Before any licensed provider goes live

Confirm redistribution rights — see `../docs/master-plan-2.md`. Public `.ics` feeds and
share links are redistribution under most providers' terms.
