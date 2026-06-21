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
| Badminton | Indonesia, Malaysia, India, China, Denmark, Japan, Korea | BWF World Tour, World Championships, Thomas/Uber Cup | BWF official calendar pages | Needs HTML/API adapter |
| Table tennis | China, Japan, Korea, Germany, France, Sweden | WTT, ITTF events, Olympics | WTT/ITTF review needed | Not yet wired |
| Squash | Egypt, UK, India, Pakistan, Malaysia, United States | PSA World Tour, World Championships | PSA review needed | Not yet wired |
| Netball | Australia, New Zealand, England, South Africa, Jamaica | Suncorp Super Netball, Netball Super League, World Cup | Federation/league review needed | Not yet wired |
| Field hockey | India, Netherlands, Germany, Belgium, Australia, Argentina | FIH Pro League, World Cup, Olympics | FIH review needed | Not yet wired |
| Water polo | Hungary, Serbia, Croatia, Greece, Italy, Spain, United States | World Aquatics, Champions League, Olympics | World Aquatics review needed | Not yet wired |
| Lacrosse | United States, Canada, Haudenosaunee, UK, Australia | PLL, NLL, World Lacrosse | League APIs/calendars review needed | Not yet wired |
| Softball | United States, Japan, Canada, Mexico, Australia | NCAA, pro leagues, WBSC events | NCAA/WBSC review needed | Not yet wired |
| Esports | Global, especially Korea, China, Europe, North America, Brazil | League of Legends, Counter-Strike, Valorant, Dota 2 | Game-specific providers required | Not yet wired |

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

## Next Technical Steps

1. Run `ics-feed-ingest` in dry-run after applying the candidate migration and record `last_status`, event count, and sample parsed payloads in admin.
2. Add a small verification script for source targets that checks HTTP status, content type, `BEGIN:VCALENDAR`, event count, and the first upcoming event.
3. Build an ECAL discovery/adapter spike separately from the ICS lane. The adapter must not rely on private user calendar URLs.
4. Promote direct feeds one at a time by sport after source review and dedupe checks.
5. For HTML-only sources such as BWF, UCI, EHF, HBL, PSA, FIH, and World Aquatics, decide between official API partnership, licensed data provider, or manual curated spotlight rows.

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
