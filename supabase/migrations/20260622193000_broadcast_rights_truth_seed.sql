-- Official where-to-watch truth seed, verified 2026-06-22.
--
-- Principle: only official rights holders, league/federation watch pages, or official
-- broadcaster destinations. No unofficial stream aggregators.

insert into public.watch_providers
  (key, name, network, affiliate_status, regions, sports, direct_url, affiliate_url, notes, priority, is_active)
values
  ('fox_sports', 'FOX Sports', 'direct', 'none', array['US'], array['world_cup','soccer'], 'https://www.foxsports.com/soccer/fifa-world-cup', null, 'FIFA World Cup 2026 US English partner. Source: FIFA media partners PDF, 2026-06-11.', 4, true),
  ('telemundo', 'Telemundo Deportes', 'direct', 'none', array['US'], array['world_cup','soccer'], 'https://www.telemundo.com/deportes', null, 'FIFA World Cup 2026 US Spanish partner. Source: FIFA media partners PDF, 2026-06-11.', 5, true),
  ('ctv_tsn_rds', 'CTV / TSN / RDS', 'direct', 'none', array['CA'], array['world_cup','soccer'], 'https://www.tsn.ca/soccer', null, 'FIFA World Cup 2026 Canada partner via Bell Media/CTV Specialty Television Enterprises. Source: FIFA media partners PDF, 2026-06-11.', 4, true),
  ('rte_player', 'RTE Player', 'direct', 'none', array['IE'], array['world_cup','soccer'], 'https://www.rte.ie/player/', null, 'Ireland public broadcaster route for football rights where applicable.', 12, true),
  ('m6', 'M6+', 'direct', 'none', array['FR'], array['world_cup','soccer'], 'https://www.m6.fr/', null, 'FIFA World Cup 2026 France free-to-air partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('ard', 'ARD Mediathek', 'direct', 'none', array['DE'], array['world_cup','soccer'], 'https://www.ardmediathek.de/', null, 'FIFA World Cup 2026 Germany partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('zdf', 'ZDF', 'direct', 'none', array['DE'], array['world_cup','soccer'], 'https://www.zdf.de/', null, 'FIFA World Cup 2026 Germany partner. Source: FIFA media partners PDF, 2026-06-11.', 11, true),
  ('magenta_sport', 'MagentaSport', 'direct', 'none', array['DE'], array['world_cup','soccer'], 'https://www.magentasport.de/', null, 'FIFA World Cup 2026 Germany partner. Source: FIFA media partners PDF, 2026-06-11.', 12, true),
  ('rai_play', 'RaiPlay', 'direct', 'none', array['IT'], array['world_cup','soccer'], 'https://www.raiplay.it/', null, 'FIFA World Cup 2026 Italy partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('dazn_it', 'DAZN Italy', 'direct', 'pending', array['IT'], array['world_cup','soccer'], 'https://www.dazn.com/it-IT/home', null, 'FIFA World Cup 2026 Italy partner. Source: FIFA media partners PDF, 2026-06-11.', 11, true),
  ('dazn_es', 'DAZN Spain', 'direct', 'pending', array['ES'], array['world_cup','soccer','f1','motorsport'], 'https://www.dazn.com/es-ES/home', null, 'FIFA World Cup 2026 Spain sublicense route via Mediapro. Source: FIFA media partners PDF, 2026-06-11.', 11, true),
  ('nos', 'NOS', 'direct', 'none', array['NL'], array['world_cup','soccer'], 'https://nos.nl/sport', null, 'FIFA World Cup 2026 Netherlands partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('vrt_max', 'VRT MAX', 'direct', 'none', array['BE'], array['world_cup','soccer'], 'https://www.vrt.be/vrtmax/', null, 'FIFA World Cup 2026 Belgium Flemish partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('rtbf_auvio', 'RTBF Auvio', 'direct', 'none', array['BE'], array['world_cup','soccer'], 'https://auvio.rtbf.be/', null, 'FIFA World Cup 2026 Belgium French partner. Source: FIFA media partners PDF, 2026-06-11.', 11, true),
  ('sport_tv_pt', 'Sport TV', 'direct', 'none', array['PT'], array['world_cup','soccer'], 'https://www.sporttv.pt/', null, 'FIFA World Cup 2026 Portugal partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('tvi', 'TVI', 'direct', 'none', array['PT'], array['world_cup','soccer'], 'https://tvi.iol.pt/', null, 'FIFA World Cup 2026 Portugal partner. Source: FIFA media partners PDF, 2026-06-11.', 11, true),
  ('rtp_play', 'RTP Play', 'direct', 'none', array['PT'], array['world_cup','soccer'], 'https://www.rtp.pt/play/', null, 'FIFA World Cup 2026 Portugal sublicense route. Source: FIFA media partners PDF, 2026-06-11.', 12, true),
  ('dr_tv', 'DR TV', 'direct', 'none', array['DK'], array['world_cup','soccer'], 'https://www.dr.dk/drtv/', null, 'FIFA World Cup 2026 Denmark partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('tv2_dk', 'TV 2 Denmark', 'direct', 'none', array['DK'], array['world_cup','soccer'], 'https://tv2.dk/', null, 'FIFA World Cup 2026 Denmark partner. Source: FIFA media partners PDF, 2026-06-11.', 11, true),
  ('svt_play', 'SVT Play', 'direct', 'none', array['SE'], array['world_cup','soccer'], 'https://www.svtplay.se/', null, 'FIFA World Cup 2026 Sweden partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('tv4_play', 'TV4 Play', 'direct', 'none', array['SE'], array['world_cup','soccer'], 'https://www.tv4play.se/', null, 'FIFA World Cup 2026 Sweden partner. Source: FIFA media partners PDF, 2026-06-11.', 11, true),
  ('tv2_play_no', 'TV 2 Play Norway', 'direct', 'none', array['NO'], array['world_cup','soccer'], 'https://play.tv2.no/', null, 'FIFA World Cup 2026 Norway partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('nrk_tv', 'NRK TV', 'direct', 'none', array['NO'], array['world_cup','soccer'], 'https://tv.nrk.no/', null, 'FIFA World Cup 2026 Norway sublicense route. Source: FIFA media partners PDF, 2026-06-11.', 11, true),
  ('yle_areena', 'Yle Areena', 'direct', 'none', array['FI'], array['world_cup','soccer'], 'https://areena.yle.fi/', null, 'FIFA World Cup 2026 Finland partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('mtv_katsomo', 'MTV Katsomo', 'direct', 'none', array['FI'], array['world_cup','soccer'], 'https://www.mtv.fi/', null, 'FIFA World Cup 2026 Finland partner. Source: FIFA media partners PDF, 2026-06-11.', 11, true),
  ('orf_on', 'ORF ON', 'direct', 'none', array['AT'], array['world_cup','soccer'], 'https://on.orf.at/', null, 'FIFA World Cup 2026 Austria partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('servus_tv', 'ServusTV', 'direct', 'none', array['AT'], array['world_cup','soccer'], 'https://www.servustv.com/', null, 'FIFA World Cup 2026 Austria partner. Source: FIFA media partners PDF, 2026-06-11.', 11, true),
  ('srg_ssr', 'SRG SSR', 'direct', 'none', array['CH'], array['world_cup','soccer'], 'https://www.srgssr.ch/', null, 'FIFA World Cup 2026 Switzerland partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('tvp_sport', 'TVP Sport', 'direct', 'none', array['PL'], array['world_cup','soccer'], 'https://sport.tvp.pl/', null, 'FIFA World Cup 2026 Poland partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('canal_plus', 'CANAL+', 'direct', 'pending', array['FR','PL','LU','CH'], array['soccer','rugby','motorsport','tennis'], 'https://www.canalplus.com/', null, 'Official broadcaster for several football properties by market; verify per competition before league-specific rows.', 20, true),
  ('televisa', 'Televisa / TUDN', 'direct', 'none', array['MX'], array['world_cup','soccer'], 'https://www.tudn.com/', null, 'FIFA World Cup 2026 Mexico partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('tv_azteca', 'TV Azteca Deportes', 'direct', 'none', array['MX'], array['world_cup','soccer'], 'https://www.tvazteca.com/aztecadeportes/', null, 'FIFA World Cup 2026 Mexico sublicense route. Source: FIFA media partners PDF, 2026-06-11.', 12, true),
  ('globo', 'Globo / ge', 'direct', 'none', array['BR'], array['world_cup','soccer'], 'https://ge.globo.com/', null, 'FIFA World Cup 2026 Brazil partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('cazetv', 'CazeTV', 'direct', 'none', array['BR'], array['world_cup','soccer'], 'https://www.youtube.com/@CazeTV', null, 'Brazil digital football route tied to Livemode/CazeTV rights. Verify event availability before event-specific rows.', 12, true),
  ('telefe', 'Telefe', 'direct', 'none', array['AR'], array['world_cup','soccer'], 'https://mitelefe.com/', null, 'FIFA World Cup 2026 Argentina partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('tyc_sports', 'TyC Sports', 'direct', 'none', array['AR'], array['world_cup','soccer'], 'https://www.tycsports.com/', null, 'FIFA World Cup 2026 Argentina sublicense route. Source: FIFA media partners PDF, 2026-06-11.', 11, true),
  ('sbs_on_demand', 'SBS On Demand', 'direct', 'none', array['AU'], array['world_cup','soccer'], 'https://www.sbs.com.au/ondemand/', null, 'FIFA World Cup 2026 Australia partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('tvnz', 'TVNZ+', 'direct', 'none', array['NZ'], array['world_cup','soccer'], 'https://www.tvnz.co.nz/', null, 'FIFA World Cup 2026 New Zealand partner. Source: FIFA media partners PDF, 2026-06-11.', 10, true),
  ('apple_mls', 'MLS on Apple TV', 'direct', 'pending', array['US','CA','GB','AU'], array['soccer','mls'], 'https://tv.apple.com/us/channel/mls/tvs.sbd.7000', null, 'Official MLS route; Apple/MLS say all MLS matches stream on Apple TV from 2026.', 15, true),
  ('nfl_game_pass_dazn', 'NFL Game Pass on DAZN', 'direct', 'pending', array['CA','GB','DE','FR','IT','ES'], array['american_football','football','nfl'], 'https://www.dazn.com/en-GB/l/nfl-game-pass', null, 'Official international NFL Game Pass destination outside the US, with territory caveats.', 18, true),
  ('nhl_tv_dazn', 'NHL.TV on DAZN', 'direct', 'pending', array['GB','DE','FR','IT','ES','NL','BE'], array['hockey'], 'https://www.dazn.com/', null, 'NHL states NHL.TV is now on DAZN in listed 2025-26 territories.', 18, true),
  ('icc_tv', 'ICC.tv', 'direct', 'none', array[]::text[], array['cricket'], 'https://www.icc.tv/', null, 'Official ICC stream fallback for rest-of-world/eligible ICC events. Do not expose broadly where ICC names a local broadcaster.', 18, true),
  ('willow_tv', 'Willow TV', 'direct', 'pending', array['US','CA'], array['cricket'], 'https://www.willow.tv/', null, 'ICC Men''s T20 World Cup 2026 official USA & Canada licensee.', 10, true),
  ('wtt_live', 'World Table Tennis', 'direct', 'none', array['US','CA','GB','DE','FR','IT','ES'], array['table_tennis'], 'https://www.worldtabletennis.com/livevideo', null, 'Official World Table Tennis live-video surface; use for table tennis before any unofficial stream aggregator.', 30, true)
on conflict (key) do update
set
  name = excluded.name,
  network = excluded.network,
  affiliate_status = excluded.affiliate_status,
  regions = excluded.regions,
  sports = excluded.sports,
  direct_url = excluded.direct_url,
  affiliate_url = excluded.affiliate_url,
  notes = excluded.notes,
  priority = excluded.priority,
  is_active = excluded.is_active,
  updated_at = now();

with wc as (
  select id
  from public.leagues
  where provider_key = 'worldcup_json' and provider_league_id = 'wc2026'
  limit 1
)
insert into public.watch_links
  (rule_key, provider_key, label, league_id, country_codes, sport_keys, link_kind, source_confidence, priority, notes, is_active)
select
  row.rule_key,
  row.provider_key,
  row.label,
  wc.id,
  row.country_codes,
  array['soccer','world_cup'],
  row.link_kind,
  'official',
  row.priority,
  'FIFA World Cup 2026 official media-rights row. Source: FIFA media partners PDF last modified 2026-06-11.',
  true
from wc
cross join (
  values
    ('wc2026_us_fox', 'fox_sports', 'FOX Sports', array['US'], 'official', 1),
    ('wc2026_us_telemundo', 'telemundo', 'Telemundo Deportes', array['US'], 'official', 2),
    ('wc2026_ca_bell', 'ctv_tsn_rds', 'CTV / TSN / RDS', array['CA'], 'official', 1),
    ('wc2026_gb_bbc', 'bbc_iplayer', 'BBC iPlayer', array['GB'], 'free', 1),
    ('wc2026_gb_itv', 'itvx', 'ITVX', array['GB'], 'free', 2),
    ('wc2026_ie_rte', 'rte_player', 'RTE Player', array['IE'], 'free', 1),
    ('wc2026_fr_m6', 'm6', 'M6+', array['FR'], 'free', 1),
    ('wc2026_fr_bein', 'bein_sports', 'beIN SPORTS', array['FR'], 'official', 2),
    ('wc2026_de_ard', 'ard', 'ARD Mediathek', array['DE'], 'free', 1),
    ('wc2026_de_zdf', 'zdf', 'ZDF', array['DE'], 'free', 2),
    ('wc2026_de_magenta', 'magenta_sport', 'MagentaSport', array['DE'], 'official', 3),
    ('wc2026_it_rai', 'rai_play', 'RaiPlay', array['IT'], 'free', 1),
    ('wc2026_it_dazn', 'dazn_it', 'DAZN Italy', array['IT'], 'official', 2),
    ('wc2026_es_rtve', 'rtve', 'RTVE Play', array['ES'], 'free', 1),
    ('wc2026_es_dazn', 'dazn_es', 'DAZN Spain', array['ES'], 'official', 2),
    ('wc2026_nl_nos', 'nos', 'NOS', array['NL'], 'free', 1),
    ('wc2026_be_vrt', 'vrt_max', 'VRT MAX', array['BE'], 'free', 1),
    ('wc2026_be_rtbf', 'rtbf_auvio', 'RTBF Auvio', array['BE'], 'free', 2),
    ('wc2026_pt_sporttv', 'sport_tv_pt', 'Sport TV', array['PT'], 'official', 1),
    ('wc2026_pt_tvi', 'tvi', 'TVI', array['PT'], 'free', 2),
    ('wc2026_pt_rtp', 'rtp_play', 'RTP Play', array['PT'], 'free', 3),
    ('wc2026_dk_dr', 'dr_tv', 'DR TV', array['DK'], 'free', 1),
    ('wc2026_dk_tv2', 'tv2_dk', 'TV 2 Denmark', array['DK'], 'official', 2),
    ('wc2026_se_svt', 'svt_play', 'SVT Play', array['SE'], 'free', 1),
    ('wc2026_se_tv4', 'tv4_play', 'TV4 Play', array['SE'], 'official', 2),
    ('wc2026_no_tv2', 'tv2_play_no', 'TV 2 Play Norway', array['NO'], 'official', 1),
    ('wc2026_no_nrk', 'nrk_tv', 'NRK TV', array['NO'], 'free', 2),
    ('wc2026_fi_yle', 'yle_areena', 'Yle Areena', array['FI'], 'free', 1),
    ('wc2026_fi_mtv', 'mtv_katsomo', 'MTV Katsomo', array['FI'], 'official', 2),
    ('wc2026_at_orf', 'orf_on', 'ORF ON', array['AT'], 'free', 1),
    ('wc2026_at_servus', 'servus_tv', 'ServusTV', array['AT'], 'free', 2),
    ('wc2026_ch_srg', 'srg_ssr', 'SRG SSR', array['CH'], 'free', 1),
    ('wc2026_pl_tvp', 'tvp_sport', 'TVP Sport', array['PL'], 'free', 1),
    ('wc2026_mx_televisa', 'televisa', 'Televisa / TUDN', array['MX'], 'official', 1),
    ('wc2026_mx_azteca', 'tv_azteca', 'TV Azteca Deportes', array['MX'], 'free', 2),
    ('wc2026_br_globo', 'globo', 'Globo / ge', array['BR'], 'official', 1),
    ('wc2026_br_cazetv', 'cazetv', 'CazeTV', array['BR'], 'free', 2),
    ('wc2026_ar_telefe', 'telefe', 'Telefe', array['AR'], 'free', 1),
    ('wc2026_ar_tyc', 'tyc_sports', 'TyC Sports', array['AR'], 'official', 2),
    ('wc2026_au_sbs', 'sbs_on_demand', 'SBS On Demand', array['AU'], 'free', 1),
    ('wc2026_nz_tvnz', 'tvnz', 'TVNZ+', array['NZ'], 'free', 1)
) as row(rule_key, provider_key, label, country_codes, link_kind, priority)
on conflict (rule_key) do update
set
  provider_key = excluded.provider_key,
  label = excluded.label,
  league_id = excluded.league_id,
  country_codes = excluded.country_codes,
  sport_keys = excluded.sport_keys,
  link_kind = excluded.link_kind,
  source_confidence = excluded.source_confidence,
  priority = excluded.priority,
  notes = excluded.notes,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.watch_links
  (rule_key, provider_key, label, country_codes, sport_keys, link_kind, source_confidence, priority, notes, is_active)
values
  ('soccer_mls_global_apple', 'apple_mls', 'MLS on Apple TV', array['US','CA','GB','AU'], array['soccer','mls'], 'official', 'official', 15, 'Official MLS/Apple route: all MLS matches stream on Apple TV from the 2026 season.', true),
  ('football_international_nfl_game_pass_dazn', 'nfl_game_pass_dazn', 'NFL Game Pass on DAZN', array['CA','GB','DE','FR','IT','ES'], array['american_football','football','nfl'], 'official', 'official', 18, 'Official international NFL Game Pass destination outside the US; local blackout/territory rules apply.', true),
  ('hockey_international_nhl_tv_dazn', 'nhl_tv_dazn', 'NHL.TV on DAZN', array['GB','DE','FR','IT','ES','NL','BE'], array['hockey'], 'official', 'official', 18, 'Official NHL.TV on DAZN international route for 2025-26 eligible territories.', true),
  ('cricket_us_ca_willow', 'willow_tv', 'Willow TV', array['US','CA'], array['cricket'], 'official', 'official', 10, 'ICC Men''s T20 World Cup 2026 official USA & Canada broadcaster.', true),
  ('table_tennis_wtt_live', 'wtt_live', 'World Table Tennis', array['US','CA','GB','DE','FR','IT','ES'], array['table_tennis'], 'official', 'official', 30, 'Official WTT live-video route for table tennis where a territory-specific broadcaster is not present. Requires table_tennis sport key or event-specific row.', true)
on conflict (rule_key) do update
set
  provider_key = excluded.provider_key,
  label = excluded.label,
  country_codes = excluded.country_codes,
  sport_keys = excluded.sport_keys,
  link_kind = excluded.link_kind,
  source_confidence = excluded.source_confidence,
  priority = excluded.priority,
  notes = excluded.notes,
  is_active = excluded.is_active,
  updated_at = now();
