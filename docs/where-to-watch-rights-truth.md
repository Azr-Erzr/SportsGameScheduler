# Where-To-Watch Rights Truth

Last verified: 2026-07-10
Implementation seed: `supabase/migrations/20260622193000_broadcast_rights_truth_seed.sql`

This is the working truth document for Silbo's where-to-watch database. It should only contain official rights holders, official league/federation watch pages, and official broadcaster destinations. Do not use unofficial stream aggregators or scraped pirate-stream pages. If a sport has no clearly published broadcast-rights table, use the official competition watch/live page as the safest link target.

Affiliate policy: every row starts as an unpaid direct link. When Silbo is approved for an affiliate program, update `watch_providers.affiliate_status` and `affiliate_url`; do not change the factual rights note.

## Source Priority

1. Official competition rights table or media-partner PDF.
2. Official league/federation "where to watch" page.
3. Official broadcaster/provider page for that competition.
4. Manual placeholder only when marked clearly and not exposed as a factual event broadcast.

## FIFA World Cup 2026

Primary source: FIFA's `FWC26 Media Rights Licensees Overview` PDF, last modified 2026-06-11, plus FIFA's media-release summary for host markets.

| Country/region | Official watch buttons seeded | Notes |
| --- | --- | --- |
| Canada | CTV / TSN / RDS | Bell Media / CTV Specialty Television Enterprises. |
| United States | FOX Sports, Telemundo Deportes | English and Spanish rights. Futbol de Primera is radio only. |
| United Kingdom | BBC iPlayer, ITVX | BBC and ITV. |
| Ireland | RTE Player | RTE listed by FIFA. |
| France | M6+, beIN SPORTS | M6 and beIN Sports France. |
| Germany | ARD Mediathek, ZDF, MagentaSport | FIFA PDF lists ARD, ZDF, Magenta Sport. |
| Italy | RaiPlay, DAZN Italy | RAI and DAZN Italy. |
| Spain | RTVE Play, DAZN Spain | FIFA PDF lists RTVE, Mediapro, DAZN Spain. Mediapro is represented via DAZN for user-facing buttons. |
| Netherlands | NOS | Official listed partner. |
| Belgium | VRT MAX, RTBF Auvio | Flemish and French public routes. |
| Portugal | Sport TV, TVI, RTP Play | FIFA PDF lists Sport TV, TVI, RTP, SIC; seeded the strongest user-facing stream destinations. |
| Denmark | DR TV, TV 2 Denmark | Official listed partners. |
| Sweden | SVT Play, TV4 Play | Official listed partners. |
| Norway | TV 2 Play Norway, NRK TV | FIFA PDF lists TV 2 Norway and NRK. |
| Finland | Yle Areena, MTV Katsomo | FIFA PDF lists Yle and MTV3. |
| Austria | ORF ON, ServusTV | Official listed partners. |
| Switzerland | SRG SSR | Official listed partner. |
| Poland | TVP Sport | FIFA PDF lists TVP. |
| Mexico | Televisa / TUDN, TV Azteca Deportes | FIFA PDF lists Televisa with TV Azteca sublicense. |
| Brazil | Globo / ge, CazeTV | FIFA PDF lists Globo and Livemode digital routes; CazeTV is the practical Livemode consumer route. |
| Argentina | Telefe, TyC Sports | Official listed partners. |
| Australia | SBS On Demand | Official listed partner. |
| New Zealand | TVNZ+ | Official listed partner. |

## Soccer Leagues And Competitions

| Competition | Canada | USA | UK / Ireland | Major EU notes | Database action |
| --- | --- | --- | --- | --- | --- |
| Premier League 2025/26-2027/28 | Fubo | NBC Sports | UK: Sky Sports, TNT Sports, BBC highlights. Ireland: Sky Sports, TNT Sports, Premier Sports | France CANAL+, Germany Sky Deutschland, Italy Sky Italia, Spain DAZN, Netherlands Viaplay, Portugal DAZN | Documented now. Seed league-specific rows only after EPL league IDs exist. |
| UEFA Champions League 2025/26 | DAZN | Paramount+, TUDN, DAZN | 2025/26 final page lists HBO Max + BBC highlights for UK final coverage; verify full-season package per cycle | France CANAL+/M6, Germany DAZN/ZDF, Italy Sky/Prime Video, Spain Movistar+/RTVE, Netherlands Ziggo Sport | Use UEFA official match/season watch page by competition and year. |
| MLS 2026 | Apple TV | Apple TV | Apple TV where available | Global-ish Apple route, no local blackouts per Apple/MLS wording | Seeded as `soccer_mls_global_apple`. |
| LaLiga | TSN+/regional provider varies by season | ESPN ecosystem | Premier Sports / Disney+ reported for 2025/26; verify official LaLiga match pages | Official LaLiga where-to-watch page is matchday-specific | Keep as document-only until league rows and current-season official table are pinned. |
| Bundesliga | Verify by season | ESPN/ESPN+ through current US cycle; 2026/27 renewal needs verification | Sky/TNT/creator sublicenses vary | Official Bundesliga broadcaster page exists | Do not hard-seed without current league-cycle confirmation. |
| Serie A | Fubo/TLN in Canada per current listings | Paramount+/DAZN/Fox Deportes by package | TNT Sports/DAZN for UK/Ireland reported | DAZN in Italy domestic; Europe varies | Seed after official Lega Serie A/current partner source is locked. |
| Ligue 1 | beIN Sports Canada | beIN Sports USA | UK rights have shifted repeatedly; verify current | Official Ligue 1 international broadcaster page exists | Use official Ligue 1 broadcaster page as source. |

## Major Multi-Sport Watch Routes

| Sport/league | Official route seeded | Countries/regions | Notes |
| --- | --- | --- | --- |
| NFL international | NFL Game Pass on DAZN | Canada, UK, Germany, France, Italy, Spain | Official international product; local rights/blackouts can override. |
| NBA | NBA League Pass | US, Canada, UK, Australia, India | Out-of-market product. US national games are split across ABC/ESPN, NBC/Peacock, and Prime Video from 2025/26. |
| MLB | MLB.TV | US, Canada, UK, Australia, Japan | Out-of-market product; blackout rules apply. |
| NHL international | NHL.TV on DAZN | Europe and many international territories | NHL official page says NHL.TV is now on DAZN for listed 2025/26 territories. Canada national rights move to Rogers/Sportsnet under the new 2026/27 deal. |
| Formula 1 | Official broadcaster table, F1 TV where eligible | Global | F1 publishes the canonical country/broadcaster table. US is Apple TV from 2026; Canada TSN/RDS; UK Sky/Channel 4; Spain DAZN; France Canal+; Germany Sky. |
| Tennis / Wimbledon | Wimbledon TV Coverage page | 220+ territories | Use tournament official pages for Slam-specific rights. |
| Cricket / ICC T20 WC 2026 | Willow TV; ICC.tv only where ICC lists Rest of World/eligible streaming | USA/Canada for Willow; territory-specific elsewhere | ICC official broadcaster page lists Willow for USA & Canada. Do not expose ICC.tv broadly where ICC names a local broadcaster. |
| Table tennis | World Table Tennis live video | Global where available | Use WTT official live-video/events pages before any third-party stream source; wire only to table-tennis-specific events/keys. |
| WNBA | WNBA League Pass, Prime Video, Peacock, Paramount+, ION, CBS Sports | USA first; League Pass also useful in Canada/UK/Australia where available | WNBA's 2026 release names ABC/ESPN, NBC/Peacock/NBCSN, Prime Video, CBS/Paramount+, ION, USA Network, NBA TV, and WNBA League Pass. Canadian broadcast schedule was still marked as later release in the WNBA note, so Canada should prefer DB broadcasts when present. |
| CFL | TSN, CBS Sports, CFL+ | Canada, USA, international | Canada defaults to TSN. US/international rows should use official CFL schedule/partner rows or CFL+ where eligible. |
| PWHL | Canada: TSN/RDS, CBC Gem, Prime Video, Sportsnet+. USA/world: thePWHL.com, PWHL YouTube, ION finals/local TV | Canada, USA, global outside excluded territories | PWHL publishes a detailed where-to-watch page; Canada has named national partners, US has local/regional partners plus PWHL YouTube/thePWHL.com availability outside Canada/Czechia/Slovakia. |
| Golf / PGA Tour | ESPN+, Golf Channel, PGA TOUR watch hub, TSN, Sky Sports Golf | USA, Canada, UK/Ireland, global hub | Event rights vary sharply by tour and major; use official event/league broadcast rows whenever available. PGA TOUR watch hub is the safe global fallback for generic golf cards. |
| Rugby | RugbyPass TV, ITVX where relevant | Global official hub, UK event-specific | RugbyPass TV is the official World Rugby-style fallback for events without a specific broadcaster row. Keep Six Nations, Rugby World Cup, club rugby, and domestic competitions event-specific. |
| Tennis / ATP | Tennis TV, TSN, Sky Sports Tennis, Wimbledon coverage page | Global, Canada, UK/Ireland, Slam-specific | ATP's TV schedule names Tennis TV as the live ATP Tour stream and publishes territory broadcasters. Slam and WTA rights should remain tournament-specific. |
| Volleyball | VBTV | Global where available | Volleyball World/VBTV is the official stream/schedule hub for VNL and Volleyball World events. |
| Snooker | WST Play, Discovery+ / Eurosport | Global and Europe | WST Watch Live is the official fallback; Eurosport/Discovery should be shown in supported European regions. |
| Darts | PDC TV, Sky Sports, DAZN Canada | Global, UK/Ireland, Canada | PDC TV is the official route for generic darts; Sky/DAZN are useful regional routes where rights match. |
| Track / athletics | World Athletics Watch, Peacock/NBC Olympics/CBC/BBC/Discovery for Olympic properties | Global official hub, Olympics by region | World Athletics says event live streams can be geo-restricted and directs users to event "where to watch" pages; use the official Watch hub as the safe generic destination. |
| Esports | LoL Esports, VALORANT Twitch, BLAST Premier Twitch, ESL CS Twitch | Global official/organizer channels | Use official league/organizer channels only; do not use restreams. |

## Ticketing Infrastructure

Ticket buttons are separate from broadcast rights. They are not factual broadcasters and should be presented as ticket-search helpers with availability/fees caveats.

Current frontend routes:

- `src/data/ticketLinks.ts` builds provider links from `title + leagueName + venue`.
- Ticketmaster is the primary provider with regional direct-search domains for US, Canada, UK/Ireland, Australia, New Zealand, and Mexico.
- StubHub, SeatGeek, and Vivid Seats remain secondary marketplace searches where supported.
- Affiliate swaps are environment-only: set `VITE_TICKET_AFFILIATE_TICKETMASTER`, `VITE_TICKET_AFFILIATE_STUBHUB`, etc. to an approved full affiliate URL when accepted. Do not hardcode affiliate URLs.

Render surfaces:

- `src/pages/EventDetail.tsx` renders the full ticket panel.
- `src/pages/SportPage.tsx` renders compact ticket buttons inside expanded quick details.
- `src/components/MatchCard.tsx` renders compact ticket buttons inside expanded World Cup ticket stubs.

## Implementation Notes

- Factual event-specific rows belong in `broadcasts`.
- Monetizable or official outbound buttons belong in `watch_providers` and `watch_links`.
- The UI already prefers `broadcasts`, then Supabase `watch_links`, then static fallbacks in `src/lib/ads.ts`.
- League-specific `watch_links.league_id` rows should only be added when the league row exists and the rights source is current for that season.
- For future affiliate swaps, keep the `provider_key` stable and replace only `affiliate_url` / `affiliate_status`.

## Frontend Wiring & Render Surfaces

Audited 2026-06-22. The data layer is `src/data/watchLinks.ts` (`useWatchOptions`) and the single
render component is `src/components/WatchOptionsPanel.tsx`. The hook resolves options in three tiers
and always returns something (it never renders empty), highest-priority first:

1. **`db`** — `watch_links` joined to `watch_providers`, filtered by `event_id` / `league_id` /
   `country_codes` / `sport_keys`. Event-specific rows boost above league rows above sport rows.
2. **`catalog`** — `CATALOG_RULES` in `watchLinks.ts`: curated official rights (e.g. the World Cup
   2026 per-country buttons) matched by region + sport + league-name pattern. Use this for known
   rights that don't yet have DB rows.
3. **`fallback`** — region/sport providers from `WATCH_PROVIDERS` in `src/lib/ads.ts`.

Because tier 3 always exists, a "Watch options reserved"-style placeholder means a surface was **not
wired to `WatchOptionsPanel` at all** — not that data is missing.

Render surfaces (keep this list current when adding new event UIs):

- `src/pages/EventDetail.tsx` — prefers factual `event.broadcasts`, else `WatchOptionsPanel`.
- `src/pages/SportPage.tsx` — `EventQuickDetails` inline panel uses `WatchOptionsPanel`.
- `src/components/MatchCard.tsx` — World Cup match cards. **Fixed 2026-06-22:** was a hardcoded
  "Watch options reserved" placeholder; now renders `WatchOptionsPanel` with
  `leagueName="FIFA World Cup 2026"` + `sportKey="soccer"` and the viewer's `broadcastRegion`, so the
  catalog World Cup rules fire. This was the lone unwired surface found in the audit.

To add a surface: render `<WatchOptionsPanel eventId/leagueId/leagueName/sportKey regionCode locale />`
and pass `prefs.broadcastRegion || prefs.regionCode` as `regionCode` so region filtering works.

## Sources

- FIFA media release and full PDF link: https://inside.fifa.com/tournament-organisation/commercial/fifa-tv/media-releases/world-cup-2026-broadcast-partnerships-global-benchmark-record-reach-innovation
- FIFA World Cup 2026 media partners PDF: https://digitalhub.fifa.com/asset/84b936a9-3c00-4f58-ba66-c6284b8801b7/FWC26-Media-Rights-Licensees-Overview.pdf
- Premier League official broadcasters: https://www.premierleague.com/en/media/broadcasters
- UEFA Champions League official watch page: https://www.uefa.com/uefachampionsleague/news/0253-0d82037aaedd-f371c464f919-1000--where-to-watch-the-champions-league-final-tv-broadcast-p/
- MLS watch page: https://www.mlssoccer.com/how-to-watch/
- Apple MLS announcement: https://www.apple.com/newsroom/2025/11/major-league-soccer-is-coming-to-apple-tv-starting-in-2026/
- LaLiga where-to-watch page: https://www.laliga.com/en-GB/where-to-watch-laliga-easports
- Bundesliga broadcaster page: https://www.bundesliga.com/en/bundesliga/info/broadcasters/
- Ligue 1 international broadcasters: https://ligue1.com/international-broadcasters
- NBA media agreements: https://www.nba.com/news/nba-media-agreements-2024
- NHL how to watch: https://www.nhl.com/info/how-to-watch-and-stream-nhl-games
- NHL/Rogers Canada rights: https://www.nhl.com/news/nhl-rogers-announce-12-year-rights-deal
- MLB.TV packages: https://www.mlb.com/live-stream-games/subscribe/allpackages
- Formula 1 broadcast information: https://www.formula1.com/en/information/f1-broadcast-information.45y3LNsT1D6VoK0ZmX8ciJ
- Wimbledon TV coverage: https://www.wimbledon.com/en_GB/about/tv_coverage
- ICC Men's T20 World Cup 2026 official broadcasters: https://www.icc-cricket.com/tournaments/mens-t20-world-cup-2026/official-broadcasters
- World Table Tennis live video: https://www.worldtabletennis.com/livevideo
- WNBA 2026 national broadcast schedule: https://www.wnba.com/news/broadcast-schedule-release-2026
- PWHL where to watch: https://www.thepwhl.com/en/where-to-watch
- CFL 2026 broadcast schedule: https://www.cfl.ca/2026-cfl-broadcast-schedule/
- ATP TV schedule: https://www.atptour.com/en/tournaments/tv-schedule
- RugbyPass TV: https://rugbypass.tv/
- Volleyball World / VBTV: https://tv.volleyballworld.com/
- World Snooker Tour watch live: https://www.wst.tv/watch-live/
- World Athletics watch live: https://worldathletics.org/watch/live
- UFC Fight Pass: https://www.ufcfightpass.com/
- LoL Esports: https://lolesports.com/
- VALORANT Twitch: https://www.twitch.tv/valorant
- BLAST Premier Twitch: https://www.twitch.tv/blastpremier
- ESL CS Twitch: https://www.twitch.tv/eslcs
