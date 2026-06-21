# Other Sports Source Map

Last reviewed: 2026-06-21

This document is the working map for the sports that live outside the primary switcher. It separates fan-facing calendar sync surfaces from backend-ingestible sources so future work does not confuse "they offer an add-to-calendar widget" with "we have a legal, stable feed we can normalize into Silbo events."

## Operating Rules

- Prefer official league/federation sources first, then licensed/provider APIs, then public utility feeds only as dry-run candidates.
- Keep every new calendar source in `dry_run = true` until we inspect event counts, titles, timezones, venues, UID stability, and redistribution terms.
- ECAL pages are valuable source intelligence, but they are not automatically direct ICS feeds for our backend. Treat them as `curated` source providers until an ECAL adapter or partner export route exists.
- Do not scrape pages that only expose interactive HTML unless terms and stability have been reviewed.
- TheSportsDB targets are already useful for broad coverage and artwork, but the other-sports layer needs a second source lane for official calendar updates, postponed fixtures, venues, and competitions that TheSportsDB misses.

## Current Technical State

The app already has TheSportsDB provider targets for baseball, cricket, rugby, volleyball, handball, cycling, snooker, and darts. The `ics-feed-ingest` Edge Function currently supports allowlisted direct `ics` and `webcal` rows in `source_targets`, parses `VEVENT` records, and writes canonical events only when `dry_run` is disabled.

The new calendar candidate migration seeds:

- Direct dry-run feeds for Snooker via a public Snooker.org-derived iCalendar.
- Direct dry-run feeds for RugbyFixture competition calendars.
- Metadata-only provider records for official ECAL/widget sources that need a dedicated adapter before ingestion.
- Curated review providers for every remaining Other Sports tile, so the research is queryable even before an ingest adapter exists.

## Sport Map

| Sport | High-interest markets | Priority competitions | Best current source path | Ingestion status |
| --- | --- | --- | --- | --- |
| Cricket | India, Pakistan, Bangladesh, Australia, England, New Zealand, South Africa, Caribbean | ICC events, IPL, Big Bash, domestic T20 leagues | TheSportsDB now; ICC ECAL as official sync surface | Provider-backed, ECAL adapter needed |
| Rugby | UK, Ireland, France, New Zealand, Australia, South Africa, Japan | Six Nations, Rugby World Cup, Premiership, Nations Championship, Rugby Championship | TheSportsDB plus RugbyFixture direct ICS; Six Nations/World Rugby ECAL for official reference | Dry-run ICS candidates added |
| Volleyball | Brazil, Italy, Poland, Turkey, Japan, Philippines, United States | VNL, World Championships, club/world tours | Volleyball World/VBTV official ECAL and TheSportsDB VNL target | Provider-backed, ECAL adapter needed |
| Handball | Germany, Denmark, France, Spain, Nordics, Balkans | Handball-Bundesliga, EHF Champions League, EHF EURO | TheSportsDB targets; EHF/HBL HTML fixture pages | Provider-backed, HTML/API adapter needed |
| Cycling | France, Belgium, Italy, Spain, Netherlands, UK | UCI World Tour, Women's World Tour, ProSeries, Grand Tours | TheSportsDB targets; UCI official calendar pages | Provider-backed, HTML/API adapter needed |
| Snooker | UK, Ireland, China, Hong Kong, Thailand | World Snooker Tour, ranking events, Triple Crown | Public CalenGoo/Snooker.org ICS plus WST official calendar page | Dry-run ICS candidate added |
| Darts | UK, Ireland, Netherlands, Germany, Belgium, Australia | PDC majors, Premier League, World Series, European Tour | TheSportsDB target; PDC ECAL/official calendar | Provider-backed, ECAL adapter needed |
| Badminton | Indonesia, Malaysia, India, China, Denmark, Japan, Korea | BWF World Tour, World Championships, Thomas/Uber Cup, Sudirman Cup | BWF official calendar pages | Curated source seeded; HTML/API adapter needed |
| Table tennis | China, Japan, Korea, Germany, France, Sweden | WTT Series, ITTF World Championships, Olympics | WTT official event calendar plus ITTF tournament calendar | Curated sources seeded; HTML/API adapter needed |
| Squash | Egypt, UK, India, Pakistan, Malaysia, United States | PSA World Tour, World Championships, British Open, Tournament of Champions | PSA tournament list and SquashTV schedule | Curated source seeded; HTML/API adapter needed |
| Netball | Australia, New Zealand, England, South Africa, Jamaica | Suncorp Super Netball, Netball Super League, Netball World Cup, Commonwealth windows | Netball Australia and Netball Super League fixture routes | Curated sources seeded; HTML/API adapter needed |
| Field hockey | India, Netherlands, Germany, Belgium, Australia, Argentina | FIH Pro League, Hockey World Cup, Champions Trophy/Nations Cup, Olympics | FIH official event and fixture pages | Curated source seeded; HTML/API/PDF adapter needed |
| Water polo | Hungary, Serbia, Croatia, Greece, Italy, Spain, United States | World Aquatics Water Polo World Cup, World Championships, Champions League, Olympics | World Aquatics calendar and competition pages | Curated source seeded; HTML/API adapter needed |
| Lacrosse | United States, Canada, Haudenosaunee, UK, Australia | PLL, NLL, World Lacrosse championships, Sixes, NCAA | PLL schedule and World Lacrosse event pages | Curated sources seeded; HTML/API adapter needed |
| Softball | United States, Japan, Canada, Mexico, Australia | AUSL, AUX, NCAA, WBSC World Cups, USA Softball | AUSL/AU schedules and WBSC event pages | Curated sources seeded; no stable full-season ICS found |
| Esports | Global, especially Korea, China, Europe, North America, Brazil | League of Legends, VALORANT, Counter-Strike, Dota 2, esports World Cup majors | Riot official data, HLTV, Liquipedia API, title-specific sites | Curated sources seeded; licensed/API path required |

## Review Detail By Sport

### Badminton

Priority should start with BWF World Tour and BWF Corporate calendars, then add national federation feeds only for countries where badminton is a top-tier sport. The official BWF calendar pages are the right source of truth for event windows, location, prize level, and tournament name, but static fetches can be protected and no direct iCalendar endpoint was found during review.

Recommended path: build a BWF HTML/API adapter only if terms allow it, otherwise keep BWF as curated spotlight data and use a licensed provider for fixtures/draws.

### Table Tennis

World Table Tennis has both list and calendar views with WTT Series and ITTF Event Calendar filters. ITTF also has a tournament calendar route. This makes table tennis a decent candidate for an official HTML/API adapter, but it should not be treated as a direct ICS sport yet.

Recommended path: start with WTT event windows, then enrich with ITTF championship pages. Avoid unofficial forum calendars except as source intelligence.

### Squash

PSA Squash Tour has a large official tournament list with dates, cities, and event tiers. SquashTV has schedule context for broadcast-style display. The page did not expose a direct ICS feed in static review.

Recommended path: use PSA tournament pages for event windows and SquashTV/PSA watch info as separate watch-provider enrichment. This sport probably works best as tournament stubs first, with match-level detail added later.

### Netball

Netball is split between major domestic leagues and international windows. Netball Australia exposes fixtures, broadcast, tickets, teams, ladder, and stats navigation. Netball Super League has an official fixtures/results route, though direct script fetch was rate-limited during review. No reusable ICS endpoint surfaced.

Recommended path: seed Suncorp Super Netball and Netball Super League as official HTML/API adapters before trying international federation coverage.

### Field Hockey

FIH is the correct global source. The FIH Pro League pages expose live/upcoming/results views, "Your Time / Local Time" toggles, match statistics, and a PDF calendar for 2026. A static scan saw an `eCal` marker and a PDF, but no direct ICS URL.

Recommended path: FIH adapter first. Treat the PDF as fallback source intelligence only; recurring ingestion should use a structured endpoint or licensed provider.

### Water Polo

World Aquatics has official sport calendar, competition, result, ranking, athlete, and schedule pages. Competition pages for World Cup divisions include host country, city, dates, schedule tabs, and qualification notes. The calendar page did not expose a direct ICS feed.

Recommended path: World Aquatics competition-page adapter for event windows and schedule tabs. Match-level data likely needs an API or careful HTML normalization.

### Lacrosse

The two best lanes are PLL for professional club lacrosse and World Lacrosse for international championships and sanctioned events. PLL has an official schedule page with watch/ticket context; World Lacrosse has championship and sanctioned-event navigation, including the 2026 Women's Championship and Division II pages. No direct ICS surfaced.

Recommended path: PLL first for user-facing schedules, World Lacrosse second for international windows. NCAA lacrosse can come later through broader college-data work.

### Softball

Softball has a few different products rather than one universal source. AUSL is active and official, WBSC has the international World Cup lane, and AU/AUX Softball exposes add-to-calendar UI. Static review found per-event Google/Outlook add links on AU pages and a calendar UI on AUSL, but not a stable full-season ICS endpoint.

Recommended path: start with AUSL and WBSC as curated/HTML adapters. NCAA softball is probably too broad until we decide on a college sports provider. USA Softball can be a national-team/event supplement.

### Esports

Esports needs to be treated as several sports under one discovery tile. Riot has an official esports data product for League of Legends and VALORANT, but it is an account/partner data path, not a public schedule feed. HLTV has excellent Counter-Strike event coverage, but it is not official and needs terms review. Liquipedia has a broad esports API and is the likely multi-title candidate if we want coverage beyond Riot titles.

Recommended path: do not scrape esports pages ad hoc. Use Riot official data for LoL/VALORANT if access is approved, and evaluate Liquipedia API or another licensed provider for broad schedules.

## Direct Calendar Candidates

These can be fetched by `ics-feed-ingest` today, but they are intentionally dry-run only.

| Target key | Sport | URL | Why it is useful | Review needed |
| --- | --- | --- | --- | --- |
| `snooker_calengoo_snooker_org_all_events` | Snooker | `https://calengoo.de/snooker/snooker.ics` | Daily-updated iCalendar generated from Snooker.org data, includes locations and all-day tournament windows | Confirm redistribution terms, inspect UID stability, decide whether all-day windows should become event ranges |
| `rugbyfixture_six_nations` | Rugby | `https://data.rugbyfixture.io/ical/v1/six-nations.ics` | Direct Six Nations feed with kickoff times, venues, and team matchups | Third-party source built from TheSportsDB; compare against official Six Nations ECAL |
| `rugbyfixture_premiership` | Rugby | `https://data.rugbyfixture.io/ical/v1/premiership.ics` | Club rugby coverage that can fill gaps outside global events | Third-party source review and duplicate handling with TheSportsDB |
| `rugbyfixture_nations_championship` | Rugby | `https://data.rugbyfixture.io/ical/v1/nations-championship.ics` | Future international competition feed with direct ICS format | Competition calendar still developing; keep dry-run |

## ECAL And Widget Sources

These are real fan calendar products, but should not be placed in `source_targets` until we have a legitimate backend adapter or partner route.

| Provider key | Sport | Page | Notes |
| --- | --- | --- | --- |
| `ecal_icc` | Cricket | `https://icc.ecal.com/` | Official ICC digital calendar and fixture list. Useful for ICC event sync intelligence. |
| `ecal_six_nations` | Rugby | `https://sixnationsrugby.ecal.com/` | Official Six Nations Rugby calendar. Covers men's, women's, U20, and related competitions. |
| `ecal_world_rugby` | Rugby | `https://worldrugby.ecal.com/` | World Rugby fixture sync surface. Use as official reference. |
| `ecal_england_rugby` | Rugby | `https://calendar.englandrugby.com/` | National union sync surface; useful for team-specific rugby coverage. |
| `ecal_volleyball_world` | Volleyball | `https://calendar.volleyballworld.com/` | Volleyball World/VBTV official calendar sync surface. |
| `ecal_pdc` | Darts | `https://www.pdc.tv/calendar/` | PDC has ECAL integration around its tournament calendar. |
| `ecal_wst` | Snooker | `https://www.wst.tv/news/2025/october/06/download-our-calendar-to-your-device/` | WST promotes device calendar download for the tour calendar. |

## Curated Review Sources

These sources are seeded as `source_providers` with `source_type = curated`. They are research-backed, but not direct `source_targets`.

| Provider key | Sport | Page | Adapter note |
| --- | --- | --- | --- |
| `bwf_calendar` | Badminton | `https://bwfworldtour.bwfbadminton.com/calendar/` | Official page; protected/static fetch issues; HTML/API review. |
| `wtt_events_calendar` | Table tennis | `https://www.worldtabletennis.com/events_calendar` | Official WTT calendar; no direct ICS found. |
| `ittf_tournaments` | Table tennis | `https://www.ittf.com/tournaments/` | Official federation calendar; review structured data/API. |
| `psa_squash_tournaments` | Squash | `https://www.psasquashtour.com/tournaments/` | Official tournament list; no direct ICS found. |
| `netball_super_league_fixtures` | Netball | `https://www.netballsl.com/fixtures-and-results/` | Official UK league route; rate-limited in static review. |
| `netball_australia_fixtures` | Netball | `https://netball.com.au/fixture` | Official Australia route; no direct ICS found. |
| `fih_hockey_calendar` | Field hockey | `https://www.fih.hockey/events/fih-pro-league/schedule-fixtures-results` | Official FIH schedule; eCal/PDF markers, no direct ICS found. |
| `world_aquatics_water_polo_calendar` | Water polo | `https://www.worldaquatics.com/water-polo/calendar` | Official calendar/competition pages; HTML/API review. |
| `pll_schedule` | Lacrosse | `https://premierlacrosseleague.com/schedule` | Official pro league schedule; watch/ticket enrichment. |
| `world_lacrosse_events` | Lacrosse | `https://worldlacrosse.sport/events/` | Official international event/championship lane. |
| `ausl_schedule` | Softball | `https://theausl.com/schedule/` | Official AUSL schedule; calendar UI but no stable full-season ICS found. |
| `wbsc_softball_calendar` | Softball | `https://www.wbsc.org/en/disciplines/softball` | Official international softball event lane. |
| `riot_esports_data` | Esports | `https://riotesportsdata.com/en-us/` | Official Riot esports data; requires account/partner access. |
| `hltv_events` | Esports | `https://www.hltv.org/events` | Strong Counter-Strike event coverage; terms/licensing review required. |
| `liquipedia_api` | Esports | `https://liquipedia.net/api` | Broad esports API candidate; evaluate terms and coverage. |

## Next Technical Steps

1. Run `ics-feed-ingest` in dry-run after applying the candidate migration and record `last_status`, event count, and sample parsed payloads in admin.
2. Add a small verification script for source targets that checks HTTP status, content type, `BEGIN:VCALENDAR`, event count, and the first upcoming event.
3. Build an ECAL discovery/adapter spike separately from the ICS lane. The adapter must not rely on private user calendar URLs.
4. Promote direct feeds one at a time by sport after source review and dedupe checks.
5. For HTML-only sources such as BWF, WTT, ITTF, PSA, Netball Australia, FIH, World Aquatics, PLL, World Lacrosse, AUSL, WBSC, and HLTV, decide between official API partnership, licensed data provider, or manual curated spotlight rows.
6. For esports, make a title-by-title matrix instead of treating all esports as one provider. Riot titles can use Riot's official data path if approved; Counter-Strike and Dota likely need separate licensed/community API decisions.

## Source Notes

- ICC official ECAL fixture list: https://icc.ecal.com/
- Six Nations official ECAL calendar: https://sixnationsrugby.ecal.com/
- Six Nations article confirming ECAL sync across competitions: https://www.sixnationsrugby.com/en/m6n/news/dont-miss-a-moment-add-fixtures-to-your-calendar
- Volleyball World/VBTV ECAL support: https://support.volleyballworld.com/hc/en-us/articles/25650979049628-What-is-ECAL
- Volleyball World calendar: https://calendar.volleyballworld.com/
- PDC ECAL launch note: https://ecal.com/pdc-launches-ecalendar/
- PDC official calendar: https://www.pdc.tv/calendar/
- WST calendar download note: https://www.wst.tv/news/2025/october/06/download-our-calendar-to-your-device/
- CalenGoo/Snooker.org iCalendar: https://calengoo.de/snooker/snooker.html
- RugbyFixture free iCalendar feeds: https://www.rugbyfixture.com/
- Six Nations RugbyFixture feed page: https://www.rugbyfixture.com/league/six-nations
- BWF World Tour calendar: https://bwfworldtour.bwfbadminton.com/calendar/
- BWF corporate calendar: https://corporate.bwfbadminton.com/events/calendar/
- World Table Tennis events: https://www.worldtabletennis.com/eventslist
- World Table Tennis calendar: https://www.worldtabletennis.com/events_calendar
- ITTF tournaments: https://www.ittf.com/tournaments/
- PSA Squash Tour tournaments: https://www.psasquashtour.com/tournaments/
- SquashTV schedule: https://www.squash.tv/schedule/
- Netball Super League fixtures/results: https://www.netballsl.com/fixtures-and-results/
- Netball Australia fixtures: https://netball.com.au/fixture
- FIH Pro League schedule: https://www.fih.hockey/events/fih-pro-league/schedule-fixtures-results
- World Aquatics water polo calendar: https://www.worldaquatics.com/water-polo/calendar
- Premier Lacrosse League schedule: https://premierlacrosseleague.com/schedule
- World Lacrosse events: https://worldlacrosse.sport/events/
- AUSL schedule: https://theausl.com/schedule/
- AU/AUX Softball schedule: https://auprosports.com/aux-softball/schedule/
- WBSC softball events: https://www.wbsc.org/en/disciplines/softball
- Riot official esports data: https://riotesportsdata.com/en-us/
- HLTV Counter-Strike events: https://www.hltv.org/events
- Liquipedia API: https://liquipedia.net/api
