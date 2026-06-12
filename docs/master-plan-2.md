# Master Plan 2: Consolidated Implementation Plan

Last updated: June 12, 2026

This document is the single active implementation plan for everything that is partially done,
undone, newly discovered, or moved beyond the original product plan.

It consolidates and replaces these former companion docs, which have now been removed:

- `auth-and-custom-leagues-plan.md`
- `calendar-export-sync-implementation-plan.md`
- `tbd-fixtures-and-calendar-updates-plan.md`
- `regionalization-sports-and-watch-commerce-plan.md`
- `api-provider-evaluation.md`
- `naming-exploration.md`

Master Plan 1 remains the original full product and technical plan. Master Plan 2 is the
execution backlog from here to public readiness.

## Implementation Principle

Do the contract work before the polish work.

The app already has meaningful frontend and backend pieces. The biggest risk now is building
more UI on top of local-only state, placeholder feed URLs, or schema contracts that are about
to change. The next implementation push should harden the backend contracts, user ownership,
calendar feeds, and route structure before adding more surface area.

Core rules:

- Do not scrape as the default data strategy.
- Do not expose private custom-league data through public read policies.
- Do not ship provider data into public `.ics`, images, or share pages without redistribution
  rights.
- Do not carry duplicate sources of truth into production.
- Do not keep adding hardcoded English copy before the i18n/message-key shell exists.
- Do not make SMS part of the MVP.
- Do keep the app useful without an account until the user needs sync, alerts, or publishing.

## Current State Snapshot

Based on the current repo and review pass:

| Area | State | Main gap |
|---|---|---|
| Product foundation | Done for MVP shell | `/` is now a neutral multi-sport homepage; route structure is reserved for sport, league, team, and event pages. |
| Design system | Mostly done | Sport themes, expanded cards, brighter poster output, and Silbo module language are in place; deeper cross-device visual QA still needed. |
| Supabase schema | Partially done | Reconciliation migration exists locally; remote apply/verification still needed. |
| Provider sync | Partially done | Demo adapter plus canonical route/change-log updates; no cron, second provider, or live freshness UI yet. |
| Follows and My Schedule | Partially done | Local follows, expanded match cards, region/language/hour preferences, and auth UI exist; server follows and anonymous-to-account migration still pending. |
| Calendar feeds | Partially done | Function and local UI support hashed-token/TBD/broadcast contract, copy URL, and webcal open flow; server feed creation and real production URLs still pending. |
| Multi-sport frontend | Partially done | Neutral homepage, sport-family switcher, NFL/CFL/NCAA grouping, WNBA/UFC/CFL/F1/NHL/NBA staging, track/olympic surfaces exist; detail pages and real data previews still pending. |
| Export Studio | Mostly done | Poster theming, high-resolution PNG output, Silbo file names, and mobile overflow improved; committed Playwright/a11y coverage still needed. |
| Custom leagues | Partially done | Local CRUD plus private-by-default share controls exist; server shares, auth ownership, and imports still pending. |
| Notifications | Partially done | Reminder/change materializers exist; settings UI, secrets, cron, and Web Push implementation remain pending. |
| Admin/observability | Early | No dashboard, support tools, public endpoint rate limiting, or sync visibility UI. |
| Deployment/CI | Early | No public deploy, CI, SEO/social previews, or Playwright smoke suite. |
| Quality/security | Partial | Unit tests exist; RLS/feed-token/a11y/mobile smoke tests needed. |
| Localization/region | Partially done | Message-key shell, football/soccer terminology, region picker, language picker, and 12/24-hour preference exist; full translated UI/exports remain. |
| Provider sourcing | Planned | TheSportsDB premium test, OpenF1, WNBA/CFL/UFC verification, provider rights review. |

## Implementation Sprint Update - June 12, 2026

This pass moved several Master Plan 2 items from planning into repo-ready implementation. The
remote Supabase project was not mutated in this pass; backend work is present as local
migrations and Edge Function source changes ready for review/apply.

### Completed In Repo

- Added the neutral `/` homepage with a multi-sport value proposition, search/follow starter,
  upcoming-event preview, sport spotlight carousel, export-path summary, where-to-watch teaser,
  and custom-league CTA.
- Added a lightweight i18n/message-key shell with `en`, `fr`, `es`, and `pt` message tables,
  locale normalization, and soccer/football terminology switching scaffolding.
- Reconciled frontend sport taxonomy so route aliases such as `/sports/nba`, `/sports/wnba`,
  `/sports/f1`, `/sports/ufc`, and `/sports/cfl` map toward canonical sports such as
  basketball, motorsport, MMA, and Canadian/American football.
- Added staged WNBA, UFC/PFL, and CFL catalog/theme entries so those surfaces can exist before
  live provider coverage is finalized.
- Added auth UI and session plumbing for Supabase magic link, Google sign-in, sign out, and
  local/account state messaging.
- Added a backend reconciliation migration:
  `supabase/migrations/20260612035952_reconcile_calendar_change_log_certainty_taxonomy.sql`.
  It introduces hashed calendar feed tokens, event certainty/TBD fields, event change logs,
  watch requests, event dependencies, bouts, spotlight events, watch links, sponsorship slots,
  localized strings, provider sync metadata, and canonical sport/league seeds.
- Updated calendar-feed rendering to look up hashed tokens, update `last_accessed_at`, respect
  placeholder/broadcast flags, skip `watch_only` events, and render date-only tentative
  placeholders.
- Updated provider sync source to canonicalize league-like sport routes and write
  `event_change_log` entries instead of relying on the older status-history concept.
- Updated notification materialization to include change-log notifications alongside reminder
  materialization.
- Added local calendar-feed creation flags for TBD placeholders and where-to-watch notes, with
  UX copy explaining the future server-backed one-time raw URL behavior.
- Added local custom-league share controls: new leagues are private by default, sharing can be
  enabled/disabled, public tokens can be rotated, and notes stay private unless explicitly
  included.
- Updated custom-league creation/admin/share pages to use canonical sport options and friendly
  labels instead of raw route/taxonomy keys.
- Moved export poster generation toward sport theme tokens and fixed phone-width Export Studio
  overflow so schedule previews remain readable on mobile.
- Added placeholder routes for event, league, and team detail pages so deep-link structure is
  reserved before real data views are built.
- Added the June 12 follow-up cleanup: visible Silbo Sports naming, Silbo Picks/Sync/Packs/
  Community module labels, high-level user preference controls for region/language/hour
  format, webcal subscribe opening, Silbo export filenames, and preference-aware owner-side
  schedule/image/Notes/ICS rendering.

### Partially Done / Still Open

- Anonymous-to-account migration is not implemented yet. Local follows, feeds, and custom
  leagues still need a deliberate "move this device into my account" flow.
- Calendar feed creation is still local-preview UI. Server-backed feed creation must create the
  raw token once, store only `token_hash`, and expose the production app-domain feed URL.
- Custom leagues remain localStorage-backed. Server-backed owner tables, share Edge Function,
  import tools, and cross-device public shares are still pending.
- The new migration and Edge Functions have not been applied/deployed to the remote Supabase
  project from this pass.
- Notification settings UI, Resend secret setup, VAPID/Web Push implementation, cron scheduling,
  and delivery preference management remain pending.
- WNBA, CFL, UFC/PFL, F1, NHL, NBA, tennis, golf, and other staged sports still need provider
  verification, licensing records, normalization adapters, and real data previews.
- Where-to-watch and sponsorship slots are schema-ready only. No monetized placement workflow,
  regional provider matching, or rights review is complete.
- Event detail, league detail, and team detail routes are placeholders. They need real data,
  SEO metadata, watch links, follow buttons, and schedule export entry points.
- In-repo Playwright/mobile/a11y smoke tests are still pending. Browser QA has been run in
  the Codex app, but no committed smoke suite exists yet.
- Bundle size needs follow-up code splitting; the production build currently warns that the
  main JS chunk is above 500 kB.

### Verification From This Pass

- `npm run test`: 4 test files, 19 tests passing.
- `npm run lint`: passing.
- `npm run build`: passing with the known large-chunk warning.
- Browser route smoke checked `/`, `/my-schedule`, `/explore`, `/sports/wnba`, `/sports/ufc`,
  `/calendar`, `/exports`, and `/custom-leagues` with no console errors.
- In-browser interaction checks covered homepage follows, auth modal rendering, local feed
  creation with TBD/broadcast flags, custom-league creation, share enablement, admin controls,
  and public share page resolution.
- Ephemeral mobile screenshots were captured through Edge/Playwright for the homepage and
  Export Studio. A mobile overflow issue in Export Studio was found and fixed.

## Shortest Path To Public Beta

1. Confirm domain/name direction and whether the local Supabase migration should be applied to
   the remote project.
2. Apply/verify the backend reconciliation migration and deploy the updated Edge Functions.
3. Add anonymous-to-account migration for local follows, local feeds, and local custom leagues.
4. Move calendar feeds, follows, and custom-league shares to server-backed flows.
5. Add provider testing, source licensing records, and at least one second live provider path.
6. Add notification settings, secrets, cron, and Web Push.
7. Replace placeholder event, league, and team routes with real data views.
8. Add CI, deployment, committed Playwright/mobile/a11y smoke tests, and SEO/social previews.
9. Code-split the frontend bundle after the public-beta flow stabilizes.

## Phase 0: Decision Lock

Goal: remove ambiguity before implementation begins.

### Decisions To Lock

| Decision | Recommended answer |
|---|---|
| Root route | `/` is the neutral multi-sport homepage. `/my-schedule` remains the personal schedule. |
| Account model | Soft accounts with magic link and Google. No password MVP. |
| Email capture | Use magic-link auth for MVP. Do not create separate anonymous email capture yet. |
| Feed URL | Use the public app domain as the stable feed/share domain, proxying to Supabase functions. |
| Feed token storage | Store `token_hash`, show raw token URL once at creation, never store raw token. |
| Calendar behavior | Live subscribed feeds are preferred for ongoing schedules; downloaded `.ics` files are snapshots. |
| Sport taxonomy | Store true sports (`basketball`, `hockey`, `motorsport`, `mma`) and put NBA/WNBA/NHL/F1/UFC/CFL in leagues. |
| Provider data | TheSportsDB premium is first breadth test; paid providers wait for redistribution approval. |
| Homepage | Neutral multi-sport first screen, not soccer-specific. |
| i18n | Add message-key shell before homepage and onboarding copy hardens. |
| Ads | Ads/sponsorship allowed, but not on private kids/custom-league surfaces by default. |
| Name | Silbo Sports is now the visible in-app direction; MatchPulse remains legacy/internal wording only where a future package/domain cleanup is still pending. |

### Deliverables

- Add a `DECISIONS` section or checklist to this file as items are locked.
- Confirm public domain/name direction before feed URLs are generated.
- Confirm whether Supabase project state matches local migrations before any DB work.

### Acceptance Criteria

- No implementation task depends on an unresolved product decision.
- Route, account, feed, taxonomy, naming, and provider-risk decisions are documented.

## Phase 1: Schema And Backend Contract Reconciliation

Goal: align the deployed/local schema with the implementation docs before more features sit on
top of the wrong tables.

### 1.1 Calendar Feed Schema

Current deployed/local `calendar_feeds` stores a plain `token` and lacks several fields needed
for secure live feeds.

Target shape:

```sql
alter table public.calendar_feeds
  add column if not exists token_hash text,
  add column if not exists locale text not null default 'en',
  add column if not exists include_placeholders boolean not null default false,
  add column if not exists include_broadcasts boolean not null default false,
  add column if not exists default_alarm_minutes integer[] not null default '{}',
  add column if not exists last_accessed_at timestamptz;
```

Implementation notes:

- Create a clean migration through the Supabase migration workflow.
- Backfill `token_hash` from existing `token` if local/dev data exists.
- Make `token_hash` unique.
- Stop displaying the raw token after creation.
- Update `calendar-feed` Edge Function to hash incoming token before lookup.
- Keep a transitional path only for local/dev feeds if needed.

Acceptance criteria:

- Feed lookup uses token hash.
- Raw feed URL is shown once on creation.
- Users can rename, disable, and delete feeds.
- Disabled feeds return 404.
- Feed access updates `last_accessed_at`.

### 1.2 Event Change Log

Current schema uses `event_status_history`. The TBD/change plan needs a broader
`event_change_log`.

Target concept:

```sql
create table public.event_change_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  change_type text not null,
  significance text not null check (significance in ('silent', 'calendar', 'notify')),
  old_value jsonb,
  new_value jsonb,
  source text not null,
  created_at timestamptz not null default now()
);
```

Implementation notes:

- Keep `event_status_history` as a compatibility view or drop it in the same migration that
  updates `provider-sync`.
- Update provider sync to write one change-log row per meaningful field change.
- Notification materializer should use `significance = 'notify'`.
- Calendar feed `SEQUENCE` changes should follow `significance in ('calendar', 'notify')`.

Acceptance criteria:

- There is one source of truth for schedule changes.
- Provider sync, notification materialization, and calendar sequence updates use the same log.
- Silent metadata changes do not spam calendars or users.

### 1.3 Event Certainty And TBD Model

Add fields that model uncertainty instead of overloading nulls and copy.

Target fields:

- `certainty`: `confirmed`, `provisional`, `watch_only`
- `starts_at_precision`: `exact`, `date`, `month`, `window`, `unknown`
- `decision_status`: `known`, `tbd`, `pending_result`, `pending_draw`, `pending_broadcast`
- `decision_expected_at`
- `decision_note`
- `event_dependencies` for bracket/draw advancement
- `schedule_watch_requests` if standalone watch requests are ever enabled

MVP position:

- Use magic-link accounts for "tell me when set" instead of standalone anonymous email
  capture.
- Support placeholders in schedules and feeds, but let users opt out.

Acceptance criteria:

- Participant TBD, time TBD, date TBD, venue TBD, broadcast TBD, postponed, and cancelled
  states have explicit data states.
- Calendar feed renders all-day tentative placeholders correctly.
- `watch_only` events are not exported as real events unless the user asks.

### 1.4 Sport And League Taxonomy

Current frontend labels distinguish sport from flagship league, but seeded DB sport keys still
use some league-like keys.

Target:

- Sports: `soccer`, `basketball`, `hockey`, `motorsport`, `tennis`, `golf`, `mma`,
  `american_football`, `custom`
- Leagues/competitions: FIFA World Cup, NBA, WNBA, NHL, F1, UFC, PFL, CFL, Grand Slams,
  The Masters, custom leagues
- URLs may keep stable user-facing aliases, e.g. `/sports/nba`, but DB relationships should
  remain correct.

Implementation notes:

- Add or migrate true sports before adding WNBA/CFL/UFC.
- Map old route keys to canonical sport plus flagship league.
- Make `SportSwitcher` display user-friendly sport and league labels.

Acceptance criteria:

- WNBA and NBA can both live under `basketball`.
- UFC and PFL can both live under `mma`.
- F1 can live under `motorsport`.
- CFL can live under `american_football` or a deliberate Canadian football subtype.

### 1.5 Shared League Access

Current `get_shared_league` RPC is acceptable while shares are local-only, but production
server-backed shares should move behind an Edge Function.

Implementation notes:

- Build a `share-page` Edge Function when server-backed shares land.
- Return only intentionally public fields.
- Add share disable/rotate controls.
- Do not keep both public RPC and Edge Function in production.

Acceptance criteria:

- Public share pages do not require login.
- Private custom-league notes are never exposed on share pages.
- Owners can disable and rotate share links.

## Phase 2: Auth, Anonymous Migration, And User-Owned Data

Goal: unlock server-backed follows, feeds, custom leagues, alerts, and cross-device sync.

### Frontend Work

- Add sign-in modal/sheet with:
  - Magic link email.
  - Google sign-in.
  - Clear copy: "Save this schedule across devices."
- Add signed-in account menu:
  - Profile.
  - Region/language/timezone.
  - Notification settings.
  - Sign out.
- Add auth-required prompts only when needed:
  - Create live feed.
  - Publish/share custom league.
  - Enable alerts.
  - Back up local schedule.
- Add anonymous-to-account migration screen:
  - Show local follows, custom leagues, feeds, alert intents.
  - Ask user to merge after sign-in.
  - Make merge idempotent.

### Backend Work

- Confirm `profiles`, `user_follows`, `calendar_feeds`, custom leagues, alert prefs exist and
  have RLS.
- Add profile fields:
  - `region_code`
  - `locale`
  - `timezone`
  - `broadcast_region`
  - `terminology_overrides`
- Add an account migration endpoint or client-side transaction plan.
- Keep authorization decisions out of user-editable metadata.

### Store Adapter Work

- Current localStorage store should become one implementation of a store interface.
- Add Supabase store implementation.
- On sign-in:
  - Read local anonymous state.
  - Upsert follows.
  - Create server feeds where appropriate.
  - Create custom leagues and teams.
  - Mark local state as migrated.

Acceptance criteria:

- A signed-out user can still use the scheduler.
- A signed-in user can see their schedule on another device.
- Local follows do not disappear after sign-in.
- Duplicate follows are not created during repeated migration.
- RLS prevents users from reading or editing another user's private data.

## Phase 3: Server-Backed Calendar Feeds And Custom-League Shares

Goal: replace placeholder feed/share behavior with real durable URLs.

### Calendar Feed Frontend

- Create feed flow:
  - Name feed.
  - Choose scope: all follows, sport, league, team, custom league.
  - Choose timezone/locale.
  - Include/exclude placeholders.
  - Include/exclude broadcasts.
  - Choose default reminders.
- Show feed URL once.
- Add copy URL and `webcal://` buttons.
- Keep platform instructions for Apple, Google, Outlook, iPhone, Android.
- Explain honestly:
  - Downloaded `.ics` is a snapshot.
  - Subscribed feeds can update.
  - Calendar apps decide refresh timing.

### Calendar Feed Backend

- `POST /api/calendar-feeds`
- `GET /calendar/:token.ics`
- `PATCH /api/calendar-feeds/:id`
- `DELETE /api/calendar-feeds/:id`
- Hash tokens.
- Render feeds from DB, not localStorage.
- Use stable `UID` and `SEQUENCE`.
- Add `STATUS:TENTATIVE` for provisional events.
- Render date-only uncertain events with `VALUE=DATE` and `TRANSP:TRANSPARENT`.
- Exclude `watch_only` events unless feed settings include them.

### Custom-League Shares

- Move local share pages to server-backed share records.
- Add owner controls:
  - Enable public share.
  - Disable public share.
  - Rotate share token.
  - Include notes yes/no.
  - Include location yes/no.
  - Include arrival time yes/no.
- Resolve shares through the `share-page` Edge Function.

Acceptance criteria:

- Calendar URLs work on the public app domain.
- Feed URLs survive reload and another device.
- Share pages resolve without login.
- Share pages expose only intended public fields.
- Owner can revoke links.

## Phase 4: Custom League Imports, Admin, And Family Privacy

Goal: make small/community leagues useful without scraping or manual re-entry pain.

### Custom League UX

- Create league.
- Add teams.
- Add events:
  - Game.
  - Practice.
  - Tournament.
  - Meeting.
  - Travel.
- Fields:
  - Date/time/timezone.
  - Venue.
  - Opponent.
  - Uniform.
  - Arrival time.
  - Public note.
  - Private note.
- Admin page:
  - Schedule list.
  - Calendar view.
  - Bulk edit.
  - Share controls.
  - Export controls.

### Imports

Priority order:

1. `.ics` import.
2. CSV upload.
3. Google Sheets import/export template.
4. Paste schedule text assisted import.
5. Public schedule URL assisted import, only when user confirms permission.

Do not scrape authenticated youth/team pages.

### Privacy Rules

- Youth/custom leagues are private by default.
- Public shares must be intentionally enabled.
- Child/player roster support waits for privacy/legal review.
- Do not show ads on private child/team admin surfaces by default.
- Public custom-league pages may have conservative ads only after policy review.

Acceptance criteria:

- A coach or parent can create a small league schedule without a provider.
- They can import from at least one structured format.
- They can share a read-only public schedule.
- They can revoke that share.
- Private notes never appear in public views or exports unless explicitly allowed.

## Phase 5: Neutral Homepage And Discovery

Goal: make `/` a useful multi-sport starting point, not a soccer landing page.

### Positioning

Recommended headline:

```txt
One schedule for every sport you follow.
```

Recommended supporting copy:

```txt
Choose your teams, countries, players, drivers, fighters, leagues, and tournaments.
Silbo Sports combines their upcoming events in your local time, then makes the schedule easy
to save to your calendar, Photos, Notes, alerts, or group chat.
```

### Route Shape

- `/` - neutral multi-sport homepage.
- `/my-schedule` - personal schedule.
- `/explore` - sport/league catalog.
- `/sports/:sportKey` - sport page.
- `/sports/:sportKey/:leagueKey` - league/tournament page.
- `/events/:eventId` - event detail page.
- `/teams/:teamId` - team/competitor page.
- `/custom-leagues` - custom league hub.
- `/s/:token` - public share page.

### Homepage Components

- `HomePage`
- `HomeHero`
- `TrackSearchInput`
- `QuickSportChips`
- `RegionTimezoneControl`
- `SchedulePreviewPanel`
- `SpotlightCarousel`
- `FollowSuggestionGrid`
- `ExportPathStrip`
- `WhereToWatchTeaser`
- `CustomLeagueCTA`
- `HomeAdSlots`
- `FooterRegionLanguageControls`

### Backend Payload

`GET /api/home?region=CA&locale=en-CA&timezone=America/Toronto&rangeDays=42`

Payload should include:

- Region context.
- User state.
- Hero text.
- Sport navigation.
- Spotlight events.
- Recommendations.
- Schedule preview.
- Export paths.
- Ad slots.

### Spotlight Carousel

Backend-driven ranking:

- Global importance.
- Region relevance.
- User follow affinity.
- Provider confidence.
- Freshness.
- Sponsored boost only when capped and disclosed.

Examples:

- FIFA World Cup.
- UEFA Champions League.
- The Masters.
- Wimbledon.
- NBA Finals.
- WNBA playoffs.
- Grey Cup.
- UFC major PPV.
- F1 Grand Prix.
- March Madness.
- Special Olympics state/national games where regionally relevant.

Acceptance criteria:

- First viewport is multi-sport.
- User can search or choose what to track immediately.
- Returning users see a schedule preview.
- Signed-out users can start without creating an account.
- Mobile layout is touch-first and readable.
- Ads do not compete with the track picker.

## Phase 6: Regionalization, i18n, Sport Expansion, And Where To Watch

Goal: make the product feel local and global without fragmenting the codebase.

### Region Detection

Use layered detection:

1. Explicit user setting.
2. Account profile.
3. Browser language list.
4. CDN country header.
5. Optional browser geolocation after user action.

Always allow overrides for:

- Region.
- Language.
- Timezone.
- Soccer/football terminology.
- Broadcast region.

### i18n Shell

MVP languages:

- English.
- French.
- Spanish.
- Portuguese.

Next:

- German.
- Italian.
- Arabic.
- Japanese.
- Korean.

Implementation:

- Add `t(key, params)` helper.
- Move homepage/onboarding/navigation/export strings to message keys.
- Use `Intl` for dates, times, timezones, lists, region names.
- Plan for 30-50% text expansion.
- Prepare RTL-safe layout before Arabic.

### Sport Terminology

Stable internal key:

- `association_football` or existing route alias `soccer`

Region labels:

- US/Canada default: Soccer
- UK/Ireland/default global football markets: Football
- Spanish: Futbol
- Portuguese: Futebol
- German: Fussball

Search should accept aliases.

### Sport Expansion

Priority staged additions:

- WNBA.
- CFL.
- UFC/PFL/MMA.
- Special Olympics through custom/community path first.
- Women's soccer leagues.
- Tennis majors.
- Golf majors.
- F1.
- Rugby World Cup / Six Nations.
- Cricket World Cup / IPL.
- Olympics / Paralympics.

### Fight Cards

Do not force MMA into home/away only.

Add later when MMA becomes real:

```sql
create table public.event_bouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  weight_class text,
  card_section text not null,
  red_corner_competitor_id uuid references public.competitors(id),
  blue_corner_competitor_id uuid references public.competitors(id),
  bout_order integer,
  status text not null default 'scheduled'
);
```

For MVP MMA previews, metadata is acceptable. For following fighters, use `event_bouts`.

### Where To Watch

Event cards should have a `Where to watch` drawer/sheet.

It should show:

- Region-aware broadcasters.
- TV/stream/radio/PPV/free labels.
- Official links.
- Sponsored/affiliate links clearly labeled.
- "Tell me when TV info is announced" for unknown broadcasts.

Keep factual broadcasts separate from paid links:

- `broadcasts`: factual broadcast data.
- `watch_links`: official/affiliate/sponsored outbound links.
- `sponsorship_slots`: paid inventory.

Acceptance criteria:

- UI copy can switch soccer/football by region.
- Homepage and exports use message keys.
- Broadcast info is useful even without sponsorship.
- Paid placements are disclosed and never override factual data without labeling.

## Phase 7: TBD Fixtures, Change Tracking, And Notifications

Goal: make schedule uncertainty useful instead of confusing.

### Uncertainty Types

- Participant TBD.
- Time TBD.
- Date TBD.
- Venue TBD.
- Broadcast TBD.
- Postponed.
- Cancelled.
- Bracket placeholder.
- Draw pending.

### UI States

Event card labels:

- `Teams TBD`
- `Time TBD`
- `Date TBD`
- `Venue TBD`
- `TV TBD`
- `Tentative`
- `Postponed`
- `Cancelled`

Calendar page should explain:

- Snapshot `.ics` files do not auto-update.
- Subscribed feeds can update, but Apple/Google/Outlook refresh on their own timing.
- Direct Google/Outlook sync can be added later with OAuth.
- Direct Apple Calendar writing from a website is not realistic.

### Notification Rules

Notify for:

- Time/date set.
- Time/date materially changed.
- Participant resolved for followed team/country/player.
- Venue changed.
- Event cancelled/postponed.
- Broadcast announced, if user requested.

Do not notify for:

- Minor copy/logo changes.
- Provider metadata refreshes.
- Silent corrections with no user impact.

### Notification Implementation

- Add alert settings UI.
- Set `RESEND_API_KEY` and `EMAIL_FROM`.
- Add VAPID keys and Web Push send implementation.
- Schedule cron for:
  - Provider sync.
  - Reminder materialization.
  - Notification dispatch.
- Use `event_change_log.significance` to drive notifications.

Acceptance criteria:

- User can choose email and/or web push.
- Notification queue is idempotent.
- Due notifications are claimed atomically.
- Users can unsubscribe or disable alerts.
- TBD events update calendars without duplicate events.

## Phase 8: Direct Calendar Integrations Later

Goal: add deeper sync only after live subscribed feeds work.

### Google Calendar

Possible later:

- OAuth connection.
- Dedicated Silbo Sports calendar.
- Create/update/delete events through Google Calendar API.
- Store provider event IDs and sync state.

### Microsoft Outlook

Possible later:

- Microsoft OAuth.
- Microsoft Graph calendar event create/update/delete.
- Dedicated Silbo Sports calendar.

### Apple Calendar

Normal websites cannot directly write to Apple Calendar in the same way.

Options:

- Subscribed feed.
- Downloaded `.ics`.
- Native iOS app with EventKit later.

Acceptance criteria:

- Direct sync is not attempted until feed subscriptions are reliable.
- Users understand the difference between subscribed feed and direct sync.

## Phase 9: Provider Sourcing And Small-League Data

Goal: source useful schedules without building the product on unsafe scraping.

### Provider Priority

Phase 1:

- Openfootball WC2026, already bundled.
- TheSportsDB premium for broad testing.

Phase 2:

- OpenF1 for F1 schedules/sessions.
- TheSportsDB production breadth if rights and quality hold.

Hold until contract/terms are clear:

- API-SPORTS.
- SportsDataIO.
- Sportradar.

### WNBA, CFL, UFC Findings

WNBA:

- TheSportsDB league `4516`.
- SportsDataIO WNBA exists.
- Sportradar WNBA exists.
- Watch Women's Sports IRL may be useful for discovery, but commercial use needs agreement.

CFL:

- TheSportsDB league `4405`.
- Public directories list `api.cfl.ca`; verify availability and terms directly.
- Genius Sports powers CFL LiveStats for official/partner data.

UFC/MMA:

- TheSportsDB UFC league `4443`.
- API-SPORTS has MMA coverage.
- SportsDataIO has MMA/UFC.
- Sportradar has MMA coverage.
- PFL/Bellator coverage must be tested by provider.

### Scraping Position

Use this order:

1. Licensed API or permissive API.
2. Official league feed/API with permission.
3. Public iCalendar feed intentionally provided by the league/team platform.
4. User-authorized import from TeamSnap, SportsEngine, LeagueApps, GotSport, Sheets, CSV, or
   copied schedule text.
5. Manual admin curation.
6. Scraping only as temporary, documented, low-volume research/import after legal and ToS
   review.

Do not scrape:

- FotMob.
- Authenticated youth/team pages.
- Pages that block automated access.
- Child/player/private location data without organizer authorization.
- Any source that will be republished without redistribution permission.

### Provider Questions

Ask each provider in writing:

1. Can we store normalized schedule facts?
2. Can we display events in our app?
3. Can we generate user-specific `.ics` feeds?
4. Can those feed URLs be public tokenized URLs?
5. Can users download image schedule exports?
6. Can users share public schedule pages?
7. Is attribution required?
8. Are there league-specific restrictions?
9. Are there ad/sponsorship restrictions?
10. Can we send email/web-push updates based on provider changes?

Acceptance criteria:

- Provider source, URL, confidence, and license notes are stored per event.
- No paid provider powers public exports until rights are confirmed.
- TheSportsDB premium coverage is tested for WNBA/CFL/UFC timezone and depth.

## Phase 10: Naming Decision Track

Goal: lock the name before public launch.

### Name Requirements

The name should carry:

- Multi-sport schedules.
- Personal watch/follow intent.
- Calendar/export usefulness.
- Custom leagues.
- A product broader than soccer or live scores.

### Current Direction

`Silbo Sports`

Why it fits:

- Broad enough for soccer, basketball, motorsport, combat sports, Olympic sports, and
  community leagues.
- Less live-score-coded than MatchPulse.
- Flexible enough for product modules: Silbo Picks, Silbo Sync, Silbo Packs, Silbo Alerts,
  and Community Schedules.
- Works with a whistle/signal metaphor without forcing every page into a soccer-only mood.

Remaining lock tasks:

- Confirm domain, trademark, social handles, and app-store availability.
- Finish logo/wordmark decisions from the Silbo brand sheets.
- Rename packages, storage keys, old comments, and legacy docs after domain/legal lock.
- Lock feed/share URL format before public calendar links and SEO/social preview work.

## Phase 11: Ads, Sponsorship, And Monetization Policy

Goal: leave room for revenue without compromising utility or privacy.

### Allowed MVP Surfaces

- Homepage lower/right rail slots.
- Explore page slots.
- Event detail `Where to watch` sponsored links.
- Spotlight sponsored card if clearly labeled and relevance-capped.

### Avoid

- Ads above the homepage track picker.
- Sticky mobile ads covering CTAs.
- Ads on private child/custom-league admin surfaces.
- Sponsored watch links styled as factual broadcast data.
- Any implied broadcaster relationship that does not exist.

### Paid Alert Idea

Defer paid alerts until free usage proves demand.

Potential later:

- No ads.
- Enhanced alert timing.
- SMS only if legal/compliance/costs are clear.

MVP recommendation:

- Keep alerts free.
- Monetize through ads/sponsorship/affiliate placements where appropriate.
- Do not block the scheduling wedge behind a paywall.

Acceptance criteria:

- Ads policy applies to homepage, sport pages, event pages, and public shares.
- Kids/custom-league privacy constraints override ad opportunities.
- Sponsored content is clearly labeled.

## Phase 12: Admin, Observability, QA, And Deployment

Goal: make the product testable in public without silent failure modes.

### Admin/Observability

Build admin views for:

- Provider sync runs.
- Last successful sync by provider/league.
- Changed event count.
- Failed jobs.
- Feed access counts.
- Public share abuse/disable tools.
- Notification queue status.
- Provider licensing notes.

Add:

- Public endpoint rate limiting.
- Error logging.
- Source freshness UI: "Updated X minutes ago."

### Testing

Add tests for:

- RLS policies.
- Feed token hashing and one-time display.
- ICS escaping/folding.
- All-day/TBD/TENTATIVE rendering.
- UID/SEQUENCE updates.
- Anonymous-to-account migration.
- Custom share privacy.
- Provider sync diff behavior.
- Event change log significance.
- Notification idempotency.
- i18n fallback.

Add browser QA:

- Playwright smoke for core flows.
- Mobile viewport screenshots.
- Export poster readability.
- Homepage responsive layout.
- Calendar page setup.
- Share page public access.

### Deployment

Add:

- Frontend public deploy.
- GitHub Actions for lint/test/build.
- Supabase migration workflow.
- Function deploy workflow.
- Env var documentation.
- SEO/social preview metadata.
- Robots/sitemap after naming/domain lock.

Acceptance criteria:

- Public beta build can be deployed repeatedly.
- CI catches broken build/tests.
- Core flows pass desktop and mobile smoke tests.
- Supabase advisors/RLS checks pass before release.

## Implementation Order Checklist

Use this as the working checklist once implementation begins.

### Blocker Set A: Contracts

- [ ] Lock decisions in Phase 0.
- [ ] Verify local vs remote Supabase schema.
- [ ] Create migration for calendar feed token hashing/options.
- [ ] Create migration for event change log.
- [ ] Create migration for certainty/TBD fields.
- [ ] Reconcile sport vs league taxonomy.
- [ ] Update `provider-sync`.
- [ ] Update `calendar-feed`.
- [ ] Update notifications materializer.

### Blocker Set B: Accounts And Server State

- [ ] Add Supabase auth client setup.
- [ ] Build sign-in modal.
- [ ] Build account menu/settings shell.
- [ ] Add anonymous-to-account migration.
- [ ] Move follows to server when signed in.
- [ ] Move feed creation to server.
- [ ] Move custom-league publishing to server.

### Product Set C: Core User Value

- [ ] Real calendar feed creation UI.
- [ ] Real public share pages.
- [ ] Custom league share disable/rotate.
- [ ] `.ics` import for custom leagues.
- [ ] CSV/Sheets import path.
- [ ] Notes/image export privacy review.
- [ ] Export poster theme tokens.

### Product Set D: Discovery And Expansion

- [ ] Add message-key/i18n shell.
- [ ] Add region/timezone/terminology controls.
- [ ] Build neutral `/` homepage.
- [ ] Add spotlight events backend/table.
- [ ] Add event detail page.
- [ ] Add league/team pages.
- [ ] Add staged WNBA/CFL/UFC tiles.
- [ ] Test TheSportsDB premium for WNBA/CFL/UFC.

### Product Set E: Alerts And Operations

- [ ] Alert settings UI.
- [ ] Resend secrets.
- [ ] Web Push VAPID setup.
- [ ] Cron schedules.
- [ ] Admin sync dashboard.
- [ ] Rate limiting.
- [ ] Playwright/mobile/a11y tests.
- [ ] CI and public deploy.

## Definition Of Done For Public Beta

Public beta is ready when:

- Users can select teams/leagues/custom schedules and see one local-time schedule.
- Users can use the app signed out, then create an account without losing local data.
- Users can create a real live calendar feed.
- Users can export readable image and Notes schedules.
- Users can create and share a custom league without leaking private data.
- Homepage is neutral and multi-sport.
- Provider data in public exports has confirmed rights.
- TBD fixtures render honestly and update without duplicate calendar events.
- Email alerts work; Web Push works or is clearly marked pending.
- CI, deployment, and smoke tests are in place.
- Privacy, ads, and sponsorship rules are documented and enforced in the UI.
