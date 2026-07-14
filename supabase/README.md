# Silbo Sports Supabase Backend

Checked-in backend code for sports hydration, calendar feeds, exports, notifications, custom
leagues, and admin observability. The frontend can still run from local data, but these files are
the production database and Edge Function path.

## Layout

- `migrations/` - numbered SQL, run in order.
  - `0001_core.sql` - sports/leagues/seasons/venues/competitors/events, participation rows,
    broadcasts, status history, and sync runs.
  - `0002_users.sql` - profiles, follows, and `get_my_schedule`.
  - `0003_calendar_feeds.sql` - tokenized live feeds.
  - `0004_custom_leagues.sql` - private custom leagues, members, teams, and share tokens.
  - `0005_notifications.sql` - alert preferences, push subscriptions, and notification queue.
- `functions/` - Deno Edge Functions.
  - `provider-sync` - adapter-based sync with diff-before-version-bump.
  - `provider-hydrate` - paced TheSportsDB league/team/event hydrator.
  - `provider-hydrate-apisports` - paced API-SPORTS football fixture hydrator.
  - `provider-hydrate-apisports-f1` - paced API-SPORTS Formula 1 hydrator.
  - `provider-hydrate-openf1` - OpenF1 Formula 1 meetings/sessions + driver art hydrator.
  - `provider-hydrate-players` - TheSportsDB roster/player hydrator for individual sports.
  - `ics-feed-ingest` - allowlisted `.ics` / `webcal://` ingestion, dry-run by default.
  - `calendar-feed` - `GET /calendar-feed/:token.ics`, stable UID/SEQUENCE, RFC 5545 output.
  - `notifications` - materialize, claim, and send email via Resend or browser push via VAPID.
- `cron.sql` - pg_cron schedules for sync and notifications.

## Deploy Steps

1. `supabase init` / link the project, then `supabase db push`.
2. Seed `sports` and provider targets with the checked-in migrations.
3. Set function secrets: `WORLDCUP_JSON_URL`, `THESPORTSDB_API_KEY`, `APISPORTS_KEY`,
   `RESEND_API_KEY` (or existing alias `RESENDAPI`), `EMAIL_FROM`, `APP_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   and `VAPID_SUBJECT`.
4. Deploy functions:

```sh
supabase functions deploy provider-sync provider-hydrate provider-hydrate-apisports provider-hydrate-apisports-f1 provider-hydrate-openf1 provider-hydrate-players ics-feed-ingest calendar-feed notifications admin-stats
```

5. Run `cron.sql` with the project ref filled in.
6. Set frontend build envs for live mode, including `VITE_VAPID_PUBLIC_KEY` for browser push.

## Provider Verification

Run `npm run provider:verify` locally with whichever secrets you have in the shell. The script
checks TheSportsDB, API-SPORTS football, API-SPORTS Formula 1, OpenF1, and combat-specific
TheSportsDB endpoints without writing to the database. Missing paid keys are reported as skipped
so public/free lanes can still be verified.

## API-SPORTS Setup

Use the direct API-SPORTS key as a server-only Edge Function secret:

```sh
supabase secrets set APISPORTS_KEY=<your-api-sports-key>
```

The pilot hydrators read API-Football from `https://v3.football.api-sports.io` and
API-Formula-1 from `https://v1.formula-1.api-sports.io` with the `x-apisports-key` header.
Free plan usage should stay low: run these daily or manually while testing, and keep
`APISPORTS_CALL_BUDGET` / `APISPORTS_F1_CALL_BUDGET` small until the admin dashboard proves
consumption is stable.

API-Formula-1 free access is plan-limited on this account. A 2026 test returned "Free plans do not
have access to this season, try from 2022 to 2024," so the API-Sports F1 hydrator is now kept as a
manual/paid-tier secondary lane rather than scheduled production coverage.

## OpenF1 Setup

`provider-hydrate-openf1` reads Formula 1 meetings and sessions from `https://api.openf1.org/v1`
without an API key. It writes provider evidence to `provider_event_sources`, links each OpenF1
`session_key` through `event_external_ids`, and only creates canonical events when no existing
TheSportsDB/API-Sports row matches by sport, time, venue, and title. It also hydrates current F1
drivers using provider-supplied `headshot_url`, `team_name`, and `team_colour`.

The live project runs `provider-hydrate-openf1` daily at `07:42 UTC`. Do not enable high-volume
realtime timing endpoints here; OpenF1 realtime requires paid access and is better suited to a
separate live-alert worker if we buy that subscription.

## Alert Delivery Accounts

Email alerts need a Resend account, a verified sending domain, and these function secrets:

```sh
supabase secrets set RESEND_API_KEY=<resend-api-key> EMAIL_FROM="Silbo Sports <alerts@yourdomain>"
```

Approved Ticketmaster links can also be added to reminder emails as regional function secrets. Use the
full Impact `/c/{partner}/{ad}/{campaign}` URL; the notification worker supplies the event destination and
reporting Sub IDs automatically:

```powershell
supabase secrets set TICKETMASTER_AFFILIATE_US="<full-impact-link>" TICKETMASTER_AFFILIATE_CA="<full-impact-link>"
```

See `docs/monetization-ticket-affiliates.md` for the complete territory map, disclosure rules, and rollout
checklist. Ticket buttons are omitted when a matching approved regional secret is absent.

The deployed notification worker also accepts `RESENDAPI` for compatibility with the current
dashboard secret name. Prefer `RESEND_API_KEY` for new environments.

Browser push does not need a paid account, but it does need a VAPID keypair in both the function
secrets and the frontend build:

```sh
supabase secrets set VAPID_PUBLIC_KEY=<public-key> VAPID_PRIVATE_KEY=<private-key> VAPID_SUBJECT=mailto:alerts@yourdomain
```

Set the same public key in the frontend as `VITE_VAPID_PUBLIC_KEY`.

## Public Calendar Feed Ingestion

The MP4 calendar-feed ingestion lane uses:

- `source_providers` - internal provider registry.
- `source_targets` - reviewed feed URLs, sport/league mapping, cadence, dry-run status, payload
  hashes, and last error/status fields.
- `event_external_ids` - feed UID to canonical event mapping.
- `provider_event_sources` - raw provider evidence and match confidence for API/ICS feeds that
  attach to canonical events.

Keep `source_targets.dry_run = true` for any new feed until the source is confirmed public,
redistribution-safe, and the parsed events look sane.

## Licensed Provider Review

Confirm redistribution rights before any licensed provider goes live. Public `.ics` feeds and
share links can still be redistribution under provider terms, so the reviewed-source lane starts
dry-run and promotes targets deliberately.
