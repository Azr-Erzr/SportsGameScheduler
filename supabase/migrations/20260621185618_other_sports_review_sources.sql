-- Curated review sources for the remaining /other-sports tiles.
--
-- These are not direct ingest targets. They give Admin/future agents an allowlisted
-- source map for sports where the best current option is an official schedule page,
-- a calendar widget, or a licensed data/API partner rather than plain iCalendar.

insert into public.source_providers
  (provider_key, name, source_type, homepage_url, terms_url, notes, is_active)
values
  (
    'bwf_calendar',
    'BWF official calendars',
    'curated',
    'https://bwfworldtour.bwfbadminton.com/calendar/',
    null,
    'Official badminton calendar pages. Static fetches are protected; treat as HTML/API-adapter review, not direct ICS.',
    true
  ),
  (
    'wtt_events_calendar',
    'World Table Tennis events calendar',
    'curated',
    'https://www.worldtabletennis.com/events_calendar',
    null,
    'Official table tennis event list/calendar for WTT Series and ITTF event calendar. No direct ICS found.',
    true
  ),
  (
    'ittf_tournaments',
    'ITTF tournament calendar',
    'curated',
    'https://www.ittf.com/tournaments/',
    null,
    'Official federation tournament calendar. Site can block script fetches; review as HTML/API source.',
    true
  ),
  (
    'psa_squash_tournaments',
    'PSA Squash Tour tournaments',
    'curated',
    'https://www.psasquashtour.com/tournaments/',
    'https://www.psasquashtour.com/privacy-policy/',
    'Official PSA tournament list with dates and locations. No direct ICS found in static page.',
    true
  ),
  (
    'netball_super_league_fixtures',
    'Netball Super League fixtures',
    'curated',
    'https://www.netballsl.com/fixtures-and-results/',
    null,
    'Official UK Netball Super League fixtures/results page. Needs HTML/API review; no direct ICS found.',
    true
  ),
  (
    'netball_australia_fixtures',
    'Netball Australia fixtures',
    'curated',
    'https://netball.com.au/fixture',
    null,
    'Official Netball Australia/Suncorp Super Netball fixture route with broadcast and ticket navigation. No direct ICS found.',
    true
  ),
  (
    'fih_hockey_calendar',
    'FIH official hockey fixtures',
    'curated',
    'https://www.fih.hockey/events/fih-pro-league/schedule-fixtures-results',
    'https://www.fih.hockey/privacy-policy',
    'Official FIH fixture pages expose live/upcoming/results and a 2026 PDF calendar; no direct ICS surfaced.',
    true
  ),
  (
    'world_aquatics_water_polo_calendar',
    'World Aquatics water polo calendar',
    'curated',
    'https://www.worldaquatics.com/water-polo/calendar',
    null,
    'Official World Aquatics water polo calendar/competition pages. Needs HTML/API review; no direct ICS found.',
    true
  ),
  (
    'pll_schedule',
    'Premier Lacrosse League schedule',
    'curated',
    'https://premierlacrosseleague.com/schedule',
    null,
    'Official PLL schedule page with matchups, watch info, and tickets. No direct ICS found.',
    true
  ),
  (
    'world_lacrosse_events',
    'World Lacrosse events',
    'curated',
    'https://worldlacrosse.sport/events/',
    null,
    'Official World Lacrosse championship and sanctioned-event pages. Needs event-page adapter; no direct ICS found.',
    true
  ),
  (
    'ausl_schedule',
    'Athletes Unlimited Softball League schedule',
    'curated',
    'https://theausl.com/schedule/',
    null,
    'Official AUSL schedule page. Calendar UI exists, but static review found per-event add links rather than a stable full-season ICS.',
    true
  ),
  (
    'wbsc_softball_calendar',
    'WBSC softball events',
    'curated',
    'https://www.wbsc.org/en/disciplines/softball',
    null,
    'Official WBSC softball event listings and World Cup calendar pages. Needs HTML/API review; no direct ICS found.',
    true
  ),
  (
    'riot_esports_data',
    'Riot official esports data',
    'curated',
    'https://riotesportsdata.com/en-us/',
    'https://www.riotgames.com/en/terms-of-service',
    'Official data product for League of Legends and VALORANT esports data. Requires account/partnership access.',
    true
  ),
  (
    'hltv_events',
    'HLTV Counter-Strike events',
    'curated',
    'https://www.hltv.org/events',
    null,
    'Counter-Strike event calendar with strong coverage, but not an official/licensed feed. Review terms before use.',
    true
  ),
  (
    'liquipedia_api',
    'Liquipedia API',
    'curated',
    'https://liquipedia.net/api',
    'https://liquipedia.net/api-terms-of-use',
    'Broad esports data API covering tournaments and matches. Candidate licensed/community API path for multi-title esports.',
    true
  )
on conflict (provider_key) do update
set
  name = excluded.name,
  source_type = excluded.source_type,
  homepage_url = excluded.homepage_url,
  terms_url = excluded.terms_url,
  notes = excluded.notes,
  is_active = excluded.is_active,
  updated_at = now();
