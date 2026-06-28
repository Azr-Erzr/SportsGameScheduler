# Schedule Release And Media Asset Truth

Last reviewed: 2026-06-28

This document tracks when supported leagues normally publish schedules, how Silbo should watch for those drops, when official calendar feeds can be used, and what media assets are safe to show in filters/cards.

## Product Rules

- Keep sport run-time rules in `docs/event-timing-and-overlaps.md`; keep schedule-release and source-watch rules here.
- Store known release windows on `competition_instances.schedule_release_expected_at` when a competition/season instance exists.
- Use `source_targets` for direct `ics` / `webcal` ingestion only after terms, UID stability, timezone quality, event counts, and duplicate behavior are reviewed.
- Treat league/federation "add to calendar" widgets as source intelligence first. Promote them to backend ingestion only when we have a stable public feed, partner access, or allowed adapter path.
- Schedule-drop alerts should be a first-class follow outcome: if a user follows a league/team/player and the next season has no fixtures yet, they should be able to opt into "tell me when the schedule drops."

## Current Backend Support

- `competition_instances.schedule_release_expected_at` exists for schedule-drop lifecycle automation.
- `source_targets` supports allowlisted direct `ics` and `webcal` feeds.
- `ics-feed-ingest` fetches those targets on cron, parses `VEVENT`s, and stays dry-run until promotion.
- `notifications` and `alert_preferences` already support email/browser alerts for followed targets; schedule-drop alerts should be modeled as a new alert kind tied to competition/source status changes.
- `design_art_kits` tracks reusable art and license status for competition surfaces.

## Priority League Watch List

| Sport | League / competition | Normal schedule release | 2026-27 state | Official calendar/feed posture |
| --- | --- | --- | --- | --- |
| Soccer | Premier League | Mid-June | Fixtures released June 18, 2026 for the 2026-27 season. Ingest/provider watch should already be live. | Official fixture pages and club calendars are useful. Verify any ICS/webcal endpoint before adding to `source_targets`. |
| Soccer | LaLiga | Late June / early July | 2026-27 fixtures are due to be presented June 30, 2026. Monitor RFEF/LaLiga and trigger provider backfill after publication. | Treat official LaLiga pages/widgets as source intelligence until a stable feed or licensed route is confirmed. |
| Soccer | UEFA Champions League | Draw/phase-based | League phase and knockout schedules depend on UEFA draw calendar. | Competition tab should show it as supported even when no future fixtures are currently hydrated. |
| Basketball | NBA | Usually August for full regular season; key dates earlier | 2026-27 key dates are public, but the full regular-season game list should be monitored for the usual August drop. | NBA/team calendar widgets may help users; backend ingestion should prefer provider/API or reviewed feed access. |
| Hockey | NHL | Usually July | Monitor mid-July for the 2026-27 regular-season schedule if not already loaded by provider. | NHL/team schedule widgets exist; verify feed stability and terms before ingestion. |
| Baseball | MLB | Often July/August for the following season | 2026 schedule was released August 26, 2025. Future release windows should be tracked annually. | MLB exposes official schedule sync surfaces; review direct feed URLs before promotion. |
| Football | NFL | Usually May | Use provider/official schedule release as the primary drop event. | Official team/league calendar widgets are source intelligence; backend route depends on feed terms. |
| Motorsport | Formula 1 | Calendar announced months ahead, session times refined later | Calendar-level schedule can be loaded early; session details need follow-up checks. | Official calendar pages and provider API should be reconciled. |
| Tennis | Grand Slams / tours | Event windows known long ahead; daily draws/sessions close to event | Model tournament windows first, then sessions/draws as they appear. | Player photos and draw data need provider/license review. |
| Combat | UFC / major cards | Rolling event announcements; bout order changes late | Track cards as event instances and update bouts after announcements. | Fighter headshots should come only from licensed/provider-supplied assets or approved official sources. |

## ICS / Calendar Feed Policy

Use official calendar feeds when they are:

- Public or partner-approved.
- Stable across refreshes with durable UIDs.
- Accurate for timezone, venue, postponement, and cancellation updates.
- Clear enough on terms to allow normalization into Silbo events.

Keep feeds in `dry_run = true` until QA confirms:

- HTTP status and content type.
- `BEGIN:VCALENDAR` exists.
- Upcoming event count is plausible.
- First upcoming event matches official web schedule.
- UID and event hash remain stable across at least two checks.
- Event titles map cleanly to `league_id`, `sport_key`, participants, and venues.

## Media Asset Policy

- League logos and team icons are trademarks. Use them only when they arrive through a licensed/approved provider field such as `leagues.logo_url` or `competitors.logo_url`, or when we have explicit first-party permission.
- Player/fighter headshots are normally copyrighted/publicity-rights-sensitive. Do not scrape or hotlink arbitrary headshots from search results, social sites, or news pages.
- If a provider gives headshots under usable terms, store the source and license state before surfacing them.
- Until rights are clear, filters/cards should use provider-supplied logos where present, then initials/generic sport art as fallback.
- Olympic and federation marks need special care. Use generic sport/venue motifs unless official marks are licensed.

## Implementation Backlog

1. Add a `schedule_drop` alert kind to the notification taxonomy.
2. Add a "Notify me when this schedule drops" CTA for followed leagues/competitions with zero future events.
3. Backfill `competition_instances.schedule_release_expected_at` for priority supported leagues.
4. Add admin/source checks that show which supported leagues have no upcoming events, last provider check, next expected schedule release, and whether a dry-run ICS target exists.
5. Promote direct calendar feeds one at a time after dry-run QA and rights review.
6. Keep provider-supplied `logo_url` rendering in filters and schedule cards, with initials fallback.

## Source Notes

- Premier League 2026-27 fixtures: https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season
- Premier League fixture amendments explained: https://www.premierleague.com/news/2647056
- RFEF 2026-27 Spanish calendar presentation notice: https://rfef.es/es/noticias/la-asamblea-general-y-la-presentacion-de-los-calendarios-2627-seran-el-30-de-junio-en
- NBA key dates: https://www.nba.com/news/key-dates
- Other sports calendar-source map: `docs/other-sports-source-map.md`
- Spotlight lifecycle automation: `docs/spotlight-lifecycle-automation.md`
- Deployment cron/source-target notes: `docs/deployment.md`
