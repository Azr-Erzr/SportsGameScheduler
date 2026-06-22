# Spotlight Lifecycle Automation

Last updated: June 22, 2026

Silbo should not need a manual homepage rewrite every time UEFA Champions League, Serie A,
the Olympics, a major golf weekend, or the next World Cup becomes relevant. The backend should
identify important sports moments, assign them a lifecycle state, and let the frontend choose
the correct banner copy, card template, reminder action, and art kit from data.

This document is the operating blueprint for that system.

## Product Vision

The site should feel like a living sports desk:

- If a major event is coming, it moves toward the front automatically.
- If the schedule is published, the page shifts from "we'll let you know" to "add these events".
- If the event is live or imminent, the banner and spotlight copy become urgency-driven.
- If the last game has just ended, the site holds the result for a short window instead of
  vanishing immediately.
- If the season/tournament is over, the page becomes a return/reminder stub until the next
  edition is known.
- If Silbo already has a strong design for a recurring competition, that design can be reused
  for future editions without rebuilding the frontend.

The World Cup experience should become a reusable competition template, not a one-off page.

## Key Model Shift

Today, the DB mostly thinks in flat `events`. That is enough for listing fixtures, but not
enough for automated design.

Add a layer above events:

| Concept | Example | Purpose |
|---|---|---|
| Competition template | `world-cup`, `uefa-champions-league`, `olympics`, `grand-slam`, `f1-race-weekend` | Reusable design/copy/ranking rules across years. |
| Competition instance | `FIFA World Cup 2026`, `UEFA Champions League 2026-27`, `LA 2028 Olympics` | One real edition/season with dates, source targets, art, and status. |
| Event/session rows | `Canada vs Bosnia & Herzegovina`, `UCL qualifying first leg`, `Olympic swimming session` | The concrete things users add to calendars. |
| Lifecycle state | `schedule_pending`, `active`, `result_hold`, `return_stub` | Tells the UI which copy and CTA to show. |

The frontend should ask: "What is the highest-ranked active competition instance for this
surface and region?" Then it renders the right template.

## Lifecycle States

These states should drive copy, ranking, and CTAs:

| State | When | Homepage behavior | Sport page behavior | CTA |
|---|---|---|---|---|
| `announced` | Official dates exist, schedule not detailed | Low/mid spotlight card | Return/reminder ticket stub | "Remind me when schedule drops" |
| `schedule_pending` | Date window known, teams/draws/sessions not filled | Promote if major | Tracking notice with expected release copy | "Track schedule drop" |
| `schedule_live` | Fixtures/sessions are loaded | Promote strongly | Full event list/ticket stubs | "Add to schedule" / "Sync all" |
| `imminent` | Starts within configurable window | Top spotlight/world board | Countdown/next-event emphasis | "Add tonight" / "Open schedule" |
| `active` | Competition is currently underway | Top spotlight; live/result signals | Live/current-day mode | "Follow updates" |
| `result_hold` | Final event finished within grace window | Keep visible for 24h, show winner/result | Results summary; schedule CTA removed or softened | "View recap" / "Save next edition" |
| `completed` | Grace window over | Demote | Result archive if useful | "See final results" |
| `return_stub` | Next edition known or annual window predictable | Small seasonal card | Ticket stub with return date/window | "Remind me" |
| `dormant` | Nothing reliable to show | Hidden unless user follows it | Hydrated standby panel | "Follow league" |

Recommended result hold: 24 hours for normal finals, 48-72 hours for global finals or major
championships if results/watch-copy are valuable.

## DB Shape

Add or evolve toward these tables/views:

| Table/view | Notes |
|---|---|
| `competition_templates` | Slug, sport family, default route, card template, banner template, copy tokens, supported lifecycle states, default art keys. |
| `competition_instances` | Template id, official name, season label, start/end dates, schedule release estimate, next edition estimate, host/region, source confidence, status. |
| `competition_instance_sources` | Source targets tied to this instance: provider league, official `.ics`, official schedule page, federation feed, manual/admin source. |
| `competition_lifecycle_snapshots` | Computed state, reason, score inputs, result hold until, stale/expiry timestamps. |
| `event_rankings` | Per-event score used by homepage, world board, and sport pages. |
| `spotlight_events` or `spotlight_candidates` | Materialized cards generated from ranked competitions/events. |
| `design_art_kits` | Art key, mode (`broadcast`/`program`), template compatibility, source/license, version, fallback key. |
| `schedule_watch_requests` | User requests like "tell me when LA 2028 detailed schedule drops". |

Important fields on `competition_instances`:

```sql
template_slug text
official_name text
season_label text
starts_at timestamptz
ends_at timestamptz
schedule_release_expected_at timestamptz
next_expected_at timestamptz
result_hold_until timestamptz
status text -- announced | schedule_pending | schedule_live | active | completed | return_stub | dormant
global_importance int
region_importance jsonb
source_confidence text -- official | provider | cached | manual | placeholder
art_key text
copy_variant text
```

## Ranking Rules

The current MP3 formula still works:

`score = global_importance + region_boost + follower_boost + urgency_boost + lifecycle_boost + editorial_boost - stale_penalty`

Add competition-aware boosts:

- `template_boost`: World Cup, Olympics, UCL, Super Bowl, NBA Finals, Stanley Cup Final,
  Grand Slams, majors, F1 races, UFC numbered cards, and similar recurring moments.
- `schedule_release_boost`: when a major schedule/draw has just dropped.
- `result_hold_boost`: brief high relevance after a final/result.
- `return_stub_cap`: return stubs can appear, but should not outrank live/imminent sports unless
  the user follows that sport or it is a global mega-event.

The UI should explain this in plain language: "Schedule just dropped", "Live now",
"Final result", "Returning soon", "Because you follow Canada", "Major event near you".

## Frontend Automation

The frontend should not hardcode "World Cup banner" forever. It should render:

1. `competition_template`
2. `competition_instance`
3. `lifecycle_state`
4. `event/session children`
5. `art_key`

Template examples:

| Template | Uses |
|---|---|
| `world-cup-tournament` | FIFA World Cup, Women's World Cup, continental cups if structure fits. |
| `league-season` | NBA, NHL, MLB, Serie A, EPL, WNBA, CFL. |
| `knockout-cup` | UCL knockout, domestic cups, playoffs. |
| `multi-sport-games` | Olympics, Winter Olympics, Commonwealth Games, Pan Am Games. |
| `race-weekend` | F1, NASCAR, IndyCar, MotoGP. |
| `fight-card` | UFC, PFL, boxing cards. |
| `major-weekend` | Golf majors, tennis finals weekends, track championships. |

Copy should be tokenized:

```ts
{
  bannerTitle: "{competitionName}",
  bannerBody: "{phaseCopy}. Every start time lands in {timezone}.",
  primaryCta: "{ctaByLifecycle}",
  secondaryCta: "{secondaryByDataCompleteness}",
  resultHoldCopy: "{winnerOrResult} is official. We'll keep the recap here today.",
  returnStubCopy: "{competitionName} returns {nextWindow}. We'll let you know when the schedule drops."
}
```

## Return And Reminder Ticket Stubs

The ticket stub pattern should come back as a first-class lifecycle surface, not a hardcoded
special case. Use it when:

- A season is between active schedules and the next start/preseason date is known.
- A major tournament is announced but detailed sessions are not loaded.
- A competition has predictable annual timing but no official schedule yet.
- A user follows a league/player/team whose next event is not yet scheduled.

Examples:

- "NHL preseason begins September 2026"
- "LA 2028 Olympics: July 14-30, 2028"
- "UCL qualifying starts July 2026"
- "We'll let you know when the LA 2028 daily schedule drops"

This should create a `watch_only` or `schedule_watch_request`, not a fake match, unless the
date is official enough to export as a tentative calendar marker.

## Annual/Recurring Major Event Map

This map is not the source of truth. It is a fallback and planning guide. Official/provider
data wins whenever available.

| Sport family | Recurring moments | Rough window | Template |
|---|---|---|---|
| Soccer | FIFA World Cup, Women's World Cup, UEFA Champions League, Europa League, Copa Libertadores, Copa America/Euros, EPL/Serie A/La Liga/Bundesliga/Ligue 1 seasons | Club seasons Aug-May; UCL qualifying Jul-Aug; league phase/finals vary; World Cups Jun-Jul | `world-cup-tournament`, `knockout-cup`, `league-season` |
| Basketball | NBA/WNBA seasons, playoffs/finals, NCAA March Madness, EuroLeague, FIBA events | NBA Oct-Jun; WNBA May-Oct; NCAA Mar-Apr | `league-season`, `knockout-cup` |
| American football | NFL, CFL, college football, Super Bowl, Grey Cup, CFP | NFL Sep-Feb; CFL Jun-Nov; college Aug-Jan | `league-season`, `knockout-cup` |
| Hockey | NHL, PWHL, IIHF worlds, World Juniors, Stanley Cup playoffs | NHL Oct-Jun; preseason Sep; IIHF spring/winter windows | `league-season`, `knockout-cup` |
| Tennis | Australian Open, Roland-Garros, Wimbledon, US Open, ATP/WTA Finals, Davis/BJK Cup | Grand Slams Jan, May-Jun, Jun-Jul, Aug-Sep | `major-weekend` |
| Golf | Masters, PGA Championship, U.S. Open, The Open, Ryder/Solheim Cup, PGA/LPGA majors | Majors Apr-Jul; team cups Sep/Oct when scheduled | `major-weekend` |
| Motorsport | F1/NASCAR/IndyCar/MotoGP race weekends, Indy 500, Monaco GP | Mostly Feb-Nov depending series | `race-weekend` |
| Combat | UFC numbered cards, Fight Nights, PFL seasons/playoffs/finals, major boxing cards | Year-round; weekly/monthly | `fight-card` |
| Track & field | Diamond League, World Championships, national trials, Olympic trials | Indoor winter; outdoor spring-summer; championships summer | `major-weekend` |
| Olympic sports | Summer/Winter Olympics, Paralympics, world championships, swimming/gymnastics/cycling worlds | Olympics every two years alternating summer/winter cycle; federation worlds vary | `multi-sport-games` |
| Baseball | MLB, postseason/World Series, NPB/KBO, College World Series | MLB Mar/Apr-Oct/Nov; NPB/KBO spring-fall | `league-season` |

Known official anchors reviewed for initial seeding:

- LA28 Olympic Games: July 14-30, 2028; Paralympics: August 15-27, 2028.
- FIFA World Cup 2026: June 11-July 19, 2026.
- UEFA Champions League 2026-27 qualifying: starts July 7, 2026 and concludes August 26, 2026.
- Milano Cortina 2026 Winter Olympics: February 6-22, 2026. Since that date is now past, keep it
  as an archive/result example rather than a future stub.

## Year-Round Operating Calendar

This is the "what should Silbo be thinking about this month?" calendar. It should become seed
data for `competition_templates`, `competition_instances`, source-target audits, and art/cache
prep. Dates are rough recurring planning windows; official/provider data replaces them once a
specific season publishes.

| Month | Major recurring windows | DB/design actions |
|---|---|---|
| January | NFL playoffs, College Football Playoff title game, Australian Open, NBA/NHL/WNBA off-season futures, Dakar/F1 launch season, winter sports championships | Boost football playoff lifecycle, hydrate tennis draw/session data, prep Super Bowl and Australian Open posters, create return stubs for spring leagues. |
| February | Super Bowl, UEFA Champions League knockouts restart, Daytona 500/NASCAR season, NBA All-Star, NHL stretch run, Six Nations, early F1 testing/liveries | Promote football final/result hold, switch UCL template to knockout mode, cache motorsport team/car art, refresh basketball/hockey playoff watch rules. |
| March | NCAA March Madness, MLB Opening Day window, F1 season openers, Champions League knockouts, NBA/NHL playoff races, Indian Wells/Miami tennis | Promote brackets, hydrate MLB teams/logos/venues, move F1 race-weekend template on air, prep NBA/NHL playoff templates. |
| April | Masters, NBA playoffs begin, NHL playoffs begin, MLB full season, Champions League quarter/semi windows, Boston Marathon, spring track meets | Put golf major template front, activate playoff-series cards, cache baseball stadium imagery, hydrate track start-list/source targets. |
| May | UEFA finals stretch, Champions League final window, PGA Championship, Indy 500, Monaco GP, French Open begins, WNBA starts, NBA/NHL conference finals | Promote UCL/finals, race-weekend double-header art, tennis clay template, WNBA season launch, result-hold finals. |
| June | NBA Finals, Stanley Cup Final, U.S. Open golf, Roland-Garros finals, Wimbledon lead-in, College World Series, Le Mans, Diamond League, World Cup/Euros/Copa windows in tournament years | Major finals/result holds, tournament templates, schedule-drop watches for summer competitions, global soccer mode in tournament years. |
| July | Wimbledon, The Open, MLB All-Star, Tour de France, UCL qualifying begins, summer international soccer, Olympics/Commonwealth/Pan Am in event years | Grass tennis and golf templates, baseball All-Star card, UCL schedule-pending/qualifying lifecycle, Olympics return/reminder stubs. |
| August | US Open build/start, European club seasons begin, UCL play-offs, NFL preseason, college football kickoff, F1 second-half return, WNBA playoff race | Switch soccer league-season cards on, football return stubs become schedule-live, tennis hard-court template, refresh league logos/kits. |
| September | NFL regular season, college football, MLB playoff race, WNBA playoffs, US Open finals, Champions League league phase, NHL preseason, Ryder/Solheim Cup in scheduled years | Football homepage boost, UCL league phase card, NHL return ticket, MLB postseason prep, team logo/color refresh after transfers/kit changes. |
| October | MLB postseason/World Series, NBA season starts, NHL season starts, WNBA Finals, F1 flyaway races, UEFA league phase, UFC/boxing fall cards | Baseball playoff/final templates, basketball/hockey season launch, combat major-card boosting, result-hold champions. |
| November | NFL/CFL stretch run, Grey Cup, college football rivalry weeks, NBA/NHL regular season, ATP/WTA Finals, F1 title run, international soccer windows | Canada/regional football boost, tennis finals template, F1 title lifecycle, holiday export/ad campaigns. |
| December | College football bowls/CFP, NFL playoff race, World Juniors, NBA Christmas, Premier League festive fixtures, club/world championship windows when scheduled | Holiday sports board, football playoff prep, hockey tournament stubs, year-end archive/next-year schedule watches. |

Season-specific final windows to model as recurring rules:

| Competition | Typical final/decisive window | Notes |
|---|---|---|
| UEFA Champions League | Late May to early June | Exact final date/host changes yearly; use UEFA calendar/source targets. |
| NBA Finals | Early to mid June | Promote from conference finals through result hold. |
| Stanley Cup Final | Early to mid June | Promote series state and decisive-game alerts. |
| Super Bowl | Early to mid February | One-off final page, result hold, then next-season return stub. |
| World Series | Late October to early November | Series template, possible decisive-game spotlight. |
| Grey Cup | Mid to late November | Strong Canada regional boost. |
| NCAA March Madness finals | Late March to early April | Bracket template and school/team art cache. |
| Grand Slam finals | Late January, early June, mid July, early September | Tennis major template with session/day-night handling. |
| Golf majors | April, May, June, July | Round/tee-sheet templates; Sunday final-day boost. |
| F1 title/final races | November to early December | Race-weekend template plus title-scenario copy when available. |
| Olympics | Official edition window, every two years alternating summer/winter cycle | Return/reminder stubs may exist years ahead; detailed session schedule follows official release. |

## Team, League, Mascot, And Asset Cache

The same lifecycle system should power better visuals. A major competition template can only
make strong posters, ads, exports, and cards if Silbo has clean identity data ready before the
event window.

Cache these as first-class reference data:

| Asset/data | Use | Refresh cadence |
|---|---|---|
| Team/league logos | Cards, schedule rows, posters, exports, email headers | Verify pre-season and monthly in season. |
| Team colors | Ticket stubs, poster accents, matchup cards, conflict badges | Verify pre-season; manual override when generated colors fail contrast. |
| Mascots/nicknames | Poster copy, playful schedule packs, rivalry cards | Verify pre-season; source/license notes required. |
| Venue/stadium imagery | Event detail, travel modules, city cards, export backgrounds | Verify per season and before major tournament windows. |
| Competition art kits | World Cup route-map, UCL night board, Olympics session board, F1 circuit board | Versioned; active windows selected by lifecycle. |
| Player/fighter/driver headshots | Follow cards, alert emails, fight/race posters | Only if licensed/provider terms allow reuse. |
| Jerseys/kits/liveries | Premium posters and matchup artwork | Seasonal; strong licensing caution. |
| Broadcast/watch-provider marks | Where-to-watch cards and affiliate placements | Region-aware; must track rights and sponsorship labels. |

Suggested tables:

```sql
team_assets (
  competitor_id uuid,
  asset_type text, -- logo | mascot | headshot | kit | venue | color_palette
  url text,
  storage_path text,
  source_url text,
  license_status text, -- allowed | provider_allowed | manual_review | blocked
  valid_from timestamptz,
  valid_until timestamptz,
  dominant_colors jsonb,
  contrast_notes text,
  last_checked_at timestamptz
)

competition_art_kits (
  template_slug text,
  art_key text,
  surface_mode text, -- broadcast | program | export | email
  storage_path text,
  source_url text,
  license_status text,
  valid_from timestamptz,
  valid_until timestamptz,
  fallback_art_key text
)
```

Guardrail: logo/mascot/headshot availability does not mean reuse is licensed. The asset cache
needs a `license_status`, source URL, and fallback art key so the UI can choose safe generic art
when official marks are not usable.

## Art And Design Reuse

Do not make art choices one-off. Store:

- `art_key`: e.g. `world-cup-route-map-v1`, `olympics-rings-board-v1`, `ucl-night-board-v1`.
- `template_slug`: which layout it fits.
- `surface_mode`: `broadcast`, `program`, or both.
- `valid_from` / `valid_until`: when a special campaign art should run.
- `license/source`: generated, commissioned, licensed, official-permitted, placeholder.
- `fallback_art_key`: safe generic sport-family art.

For the World Cup specifically:

- Cache the current page as `world-cup-tournament` template.
- Keep the team selector, host-city/venue motif, knockout/TBD handling, and schedule-add flows.
- Swap the instance data, colors, event children, teams, host cities, and art key for future
  editions.

## Admin Controls

Automation still needs a small command center:

- Review generated spotlight candidates and lifecycle states.
- Override rank/copy/art with required expiry.
- Promote or suppress a competition instance.
- Mark source confidence and terms notes.
- See why a card is on the homepage: score, lifecycle, source, region, expiry.
- Preview broadcast/program/mobile variants before promotion.

No manual override should be permanent by default.

## Implementation Path

1. Add `competition_templates` and `competition_instances` schema with a few seeds:
   World Cup, UCL, Olympics, NHL/NBA season, F1 race weekend, UFC card, MLB season.
2. Seed the year-round operating calendar as rules, not fixed event rows, so each month has
   expected source audits, lifecycle candidates, and art/cache prep.
3. Add team/league/competition asset-cache tables with license status, color palettes, fallback
   art keys, and refresh cadence.
4. Create a `competition_lifecycle` view/function that computes the current state from dates,
   child events, status, result availability, and source confidence.
5. Replace the existing spotlight RPC with one that ranks competition instances first and
   individual events second.
6. Update `SpotlightEvent` types to carry `lifecycle`, `templateSlug`, `artKey`,
   `resultHoldUntil`, and `scheduleReleaseExpectedAt`.
7. Update homepage cards and sport banners to select copy/CTA from lifecycle state.
8. Generate return/reminder ticket stubs from `competition_instances`, not hardcoded constants.
9. Add admin observability and override expiry.
10. Add Playwright smoke cases for all lifecycle states using seeded fixtures.

## Guardrails

- Official/provider data beats the annual map.
- Do not use official logos/marks in art unless licensed or explicitly permitted.
- Do not create fake confirmed events. Use `watch_only` or reminder stubs when a schedule is not
  official.
- Always include expiry/result-hold windows so completed events do not linger forever.
- Keep the public phrasing honest: "schedule expected", "we'll let you know", "times may update",
  not false certainty.

## Source Anchors

- LA28 official dates: https://la28.org/en/newsroom/LA28_Announces_Games_Dates.html
- LA28 Games dates landing page: https://la28.org/en.html
- FIFA World Cup 2026 schedule hub: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums
- UEFA match calendar: https://www.uefa.com/match-calendar/
- UEFA Champions League 2026-27 qualifying article: https://www.uefa.com/uefachampionsleague/news/02a6-20e5a8be4e63-ae971c582f8c-1000--champions-league-qualifying-fixtures-dates-how-it-works/
- Olympics Milano Cortina 2026 page: https://www.olympics.com/en/olympic-games/milano-cortina-2026
