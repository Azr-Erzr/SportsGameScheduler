-- Other-sports calendar candidates.
--
-- ECAL/widget sources are seeded as source providers only. They are official fan sync
-- surfaces, but not direct backend ICS targets until an adapter or partner export is built.
-- Direct iCalendar feeds are kept in dry-run pending event parsing and source review.

insert into public.source_providers
  (provider_key, name, source_type, homepage_url, terms_url, notes, is_active)
values
  (
    'ecal_icc',
    'ICC official ECAL calendar',
    'curated',
    'https://icc.ecal.com/',
    'https://www.icc-cricket.com/about/the-icc/legal-notices/website-terms-of-use',
    'Official ICC fan calendar sync surface. Requires ECAL adapter/partner route before backend ingestion.',
    true
  ),
  (
    'ecal_six_nations',
    'Six Nations Rugby official ECAL calendar',
    'curated',
    'https://sixnationsrugby.ecal.com/',
    null,
    'Official Six Nations Rugby fan calendar sync surface. Covers mens, womens, U20, and related competitions.',
    true
  ),
  (
    'ecal_world_rugby',
    'World Rugby calendar sync',
    'curated',
    'https://worldrugby.ecal.com/',
    'https://www.world.rugby/terms-and-conditions',
    'Official World Rugby fixture sync surface. Use for source intelligence until ECAL adapter exists.',
    true
  ),
  (
    'ecal_england_rugby',
    'England Rugby digital calendar',
    'curated',
    'https://calendar.englandrugby.com/',
    null,
    'National union calendar sync surface. Candidate for team-specific rugby coverage.',
    true
  ),
  (
    'ecal_volleyball_world',
    'Volleyball World official calendar',
    'curated',
    'https://calendar.volleyballworld.com/',
    null,
    'Official Volleyball World/VBTV ECAL sync surface. Requires adapter before backend ingestion.',
    true
  ),
  (
    'ecal_pdc',
    'PDC calendar sync',
    'curated',
    'https://www.pdc.tv/calendar/',
    'https://www.pdc.tv/terms-conditions',
    'Professional Darts Corporation calendar surface with ECAL integration. Keep as curated source until direct feed is cleared.',
    true
  ),
  (
    'ecal_wst',
    'World Snooker Tour calendar sync',
    'curated',
    'https://www.wst.tv/news/2025/october/06/download-our-calendar-to-your-device/',
    'https://www.wst.tv/terms-of-use/',
    'World Snooker Tour promotes calendar download/sync for tour events. Keep as curated source until direct feed is cleared.',
    true
  ),
  (
    'snooker_org_public_ical',
    'Snooker.org public iCalendar via CalenGoo',
    'ics',
    'https://calengoo.de/snooker/snooker.html',
    null,
    'Public iCalendar generated from Snooker.org data and updated daily. Dry-run until redistribution and event-shape review are complete.',
    true
  ),
  (
    'rugbyfixture_public_ical',
    'RugbyFixture public iCalendar feeds',
    'ics',
    'https://www.rugbyfixture.com/',
    null,
    'Public rugby union iCalendar feeds. Useful dry-run candidates, but third-party source review is required before promotion.',
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

insert into public.source_targets
  (
    source_provider_id,
    target_key,
    source_type,
    url,
    sport_key,
    expected_name,
    source_confidence,
    is_active,
    dry_run,
    priority,
    cadence_minutes,
    terms_note,
    metadata
  )
select
  p.id,
  x.target_key,
  'ics',
  x.url,
  x.sport_key,
  x.expected_name,
  'manual',
  true,
  true,
  x.priority,
  x.cadence_minutes,
  x.terms_note,
  x.metadata
from public.source_providers p
join (
  values
    (
      'snooker_calengoo_snooker_org_all_events',
      'snooker_org_public_ical',
      'https://calengoo.de/snooker/snooker.ics',
      'snooker',
      'Snooker.org all events calendar via CalenGoo',
      210,
      1440,
      'Public utility feed generated from Snooker.org data; keep dry-run until redistribution terms and all-day tournament modeling are reviewed.',
      '{"source_page":"https://calengoo.de/snooker/snooker.html","source_data":"Snooker.org","review_state":"needs_terms_review","calendar_shape":"all_day_tournament_windows"}'::jsonb
    ),
    (
      'rugbyfixture_six_nations',
      'rugbyfixture_public_ical',
      'https://data.rugbyfixture.io/ical/v1/six-nations.ics',
      'rugby',
      'Six Nations RugbyFixture iCalendar',
      220,
      720,
      'Third-party public feed; compare against official Six Nations ECAL before promotion.',
      '{"source_page":"https://www.rugbyfixture.com/league/six-nations","league_hint":"Six Nations Championship","review_state":"needs_official_comparison","source_data":"TheSportsDB via RugbyFixture"}'::jsonb
    ),
    (
      'rugbyfixture_premiership',
      'rugbyfixture_public_ical',
      'https://data.rugbyfixture.io/ical/v1/premiership.ics',
      'rugby',
      'Premiership RugbyFixture iCalendar',
      226,
      720,
      'Third-party public feed; useful for club rugby coverage but needs duplicate and rights review.',
      '{"source_page":"https://www.rugbyfixture.com/league/premiership","league_hint":"Premiership Rugby","review_state":"needs_terms_review","source_data":"TheSportsDB via RugbyFixture"}'::jsonb
    ),
    (
      'rugbyfixture_nations_championship',
      'rugbyfixture_public_ical',
      'https://data.rugbyfixture.io/ical/v1/nations-championship.ics',
      'rugby',
      'Nations Championship RugbyFixture iCalendar',
      228,
      720,
      'Third-party public feed for a future international competition; keep dry-run while calendar stabilizes.',
      '{"source_page":"https://www.rugbyfixture.com/league/nations-championship","league_hint":"Nations Championship","review_state":"future_calendar_watch","source_data":"TheSportsDB via RugbyFixture"}'::jsonb
    )
) as x(target_key, provider_key, url, sport_key, expected_name, priority, cadence_minutes, terms_note, metadata)
  on p.provider_key = x.provider_key
on conflict (target_key) do update
set
  source_type = excluded.source_type,
  url = excluded.url,
  sport_key = excluded.sport_key,
  expected_name = excluded.expected_name,
  source_confidence = excluded.source_confidence,
  is_active = excluded.is_active,
  dry_run = excluded.dry_run,
  priority = excluded.priority,
  cadence_minutes = excluded.cadence_minutes,
  terms_note = excluded.terms_note,
  metadata = excluded.metadata,
  updated_at = now();
