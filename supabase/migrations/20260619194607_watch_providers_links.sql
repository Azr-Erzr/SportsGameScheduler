-- Region-aware where-to-watch catalogue.
--
-- `broadcasts` remains factual event broadcast data. These tables are the monetizable/official
-- outbound layer that can start as unpaid canonical links and later swap individual providers to
-- approved affiliate URLs without changing event data.

create table if not exists public.watch_providers (
  key text primary key,
  name text not null,
  network text not null default 'direct'
    check (network in ('direct', 'flexoffers', 'impact', 'cj', 'awin', 'partnerize', 'cuelinks', 'google', 'other')),
  affiliate_status text not null default 'none'
    check (affiliate_status in ('none', 'pending', 'approved', 'paused', 'rejected')),
  regions text[] not null default '{}'::text[],
  sports text[] not null default '{}'::text[],
  direct_url text not null,
  affiliate_url text,
  notes text,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watch_links (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  provider_key text not null references public.watch_providers(key) on delete cascade,
  label text,
  event_id uuid references public.events(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete cascade,
  country_codes text[] not null default '{}'::text[],
  sport_keys text[] not null default '{}'::text[],
  link_kind text not null default 'official'
    check (link_kind in ('official', 'affiliate', 'sponsored', 'free')),
  url text,
  affiliate_url text,
  source_confidence text not null default 'manual'
    check (source_confidence in ('official', 'provider', 'manual', 'placeholder')),
  priority integer not null default 100,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watch_providers_active_priority_idx
  on public.watch_providers (is_active, priority);
create index if not exists watch_providers_regions_gin_idx
  on public.watch_providers using gin (regions);
create index if not exists watch_providers_sports_gin_idx
  on public.watch_providers using gin (sports);

create index if not exists watch_links_active_priority_idx
  on public.watch_links (is_active, priority);
create index if not exists watch_links_event_idx
  on public.watch_links (event_id) where event_id is not null;
create index if not exists watch_links_league_idx
  on public.watch_links (league_id) where league_id is not null;
create index if not exists watch_links_countries_gin_idx
  on public.watch_links using gin (country_codes);
create index if not exists watch_links_sports_gin_idx
  on public.watch_links using gin (sport_keys);

alter table public.watch_providers enable row level security;
alter table public.watch_links enable row level security;

drop policy if exists "active watch providers are readable" on public.watch_providers;
create policy "active watch providers are readable" on public.watch_providers
  for select to anon, authenticated
  using (is_active);

drop policy if exists "active watch links are readable" on public.watch_links;
create policy "active watch links are readable" on public.watch_links
  for select to anon, authenticated
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and (
      event_id is null
      or exists (
        select 1
        from public.events e
        where e.id = watch_links.event_id and e.visibility = 'public'
      )
    )
    and (
      league_id is null
      or exists (
        select 1
        from public.leagues l
        where l.id = watch_links.league_id and l.is_public
      )
    )
  );

grant select on public.watch_providers to anon, authenticated;
grant select on public.watch_links to anon, authenticated;

insert into public.watch_providers
  (key, name, network, affiliate_status, regions, sports, direct_url, affiliate_url, notes, priority, is_active)
values
  ('dazn', 'DAZN', 'flexoffers', 'pending', array['US','CA','GB','DE','ES','IT','ZA'], array['soccer','combat','boxing','mma'], 'https://www.dazn.com/', null, 'Direct DAZN application + FlexOffers program candidate.', 10, true),
  ('paramount_plus', 'Paramount+', 'flexoffers', 'pending', array['US','CA','GB','AU'], array['soccer','combat','football'], 'https://www.paramountplus.com/', null, 'Current combat and soccer route; Showtime Sports is shut down.', 20, true),
  ('ufc_fight_pass', 'UFC Fight Pass', 'direct', 'pending', array['US','CA','GB','AU','IN'], array['combat','mma'], 'https://ufcfightpass.com/', null, 'Official UFC library and live event product; direct/partner route.', 22, true),
  ('ufc_fight_club', 'UFC Fight Club', 'direct', 'none', array['US','CA','GB'], array['combat','mma'], 'https://ufcfightclub.com/', null, 'Useful official UFC fan/presale destination, not a standard streaming affiliate.', 45, true),
  ('prime_video', 'Prime Video', 'direct', 'pending', array['US','CA','GB','ES','IN','ZA'], array['combat','boxing','soccer','football','basketball'], 'https://www.primevideo.com/', null, 'Includes PBC/PPV and regional sports rights depending on market.', 30, true),
  ('ppv_com', 'PPV.com', 'direct', 'pending', array['US','CA'], array['combat','boxing','mma'], 'https://www.ppv.com/', null, 'Boxing and combat PPV destination.', 35, true),
  ('espn_plus', 'ESPN+', 'flexoffers', 'pending', array['US'], array['soccer','combat','football','basketball','hockey','tennis','golf'], 'https://plus.espn.com/', null, 'Use FlexOffers first; official partner page may be session-sensitive.', 15, true),
  ('fubo', 'Fubo', 'flexoffers', 'pending', array['US','CA'], array['soccer','football','basketball','hockey','baseball'], 'https://www.fubo.tv/', null, 'FlexOffers route preferred; direct affiliate path may point back to Impact.', 24, true),
  ('sling', 'Sling TV', 'flexoffers', 'pending', array['US'], array['soccer','football','basketball','hockey','baseball','combat'], 'https://www.sling.com/', null, 'FlexOffers route preferred.', 25, true),
  ('peacock', 'Peacock', 'flexoffers', 'pending', array['US'], array['soccer','football','olympic','track'], 'https://www.peacocktv.com/', null, 'US streaming destination for NBC sports rights.', 32, true),
  ('max_tnt', 'TNT Sports / Max', 'cj', 'pending', array['US'], array['basketball','hockey','soccer','combat'], 'https://www.max.com/', null, 'US TNT/Bleacher/Max sports package destination.', 34, true),
  ('tsn', 'TSN', 'direct', 'none', array['CA'], array['soccer','football','basketball','hockey','combat','tennis','golf'], 'https://www.tsn.ca/', null, 'Canada canonical broadcaster link; no public affiliate route confirmed.', 10, true),
  ('sportsnet_plus', 'Sportsnet+', 'direct', 'none', array['CA'], array['hockey','baseball','basketball','soccer','combat'], 'https://www.sportsnet.ca/plus/', null, 'Canada canonical broadcaster link.', 12, true),
  ('crave', 'Crave', 'direct', 'none', array['CA'], array['soccer','combat','basketball','hockey'], 'https://www.crave.ca/', null, 'Bell/Crave destination where rights apply.', 36, true),
  ('cbc_gem', 'CBC Gem', 'direct', 'none', array['CA'], array['olympic','soccer','hockey','track'], 'https://gem.cbc.ca/', null, 'Canada free/official public broadcaster destination.', 50, true),
  ('sky_sports', 'Sky Sports', 'direct', 'pending', array['GB','IE'], array['soccer','football','f1','motorsport','boxing','combat','golf','tennis'], 'https://www.skysports.com/', null, 'UK/Ireland canonical broadcaster path.', 10, true),
  ('now_sports', 'NOW Sports', 'direct', 'pending', array['GB','IE'], array['soccer','football','f1','motorsport','boxing','combat','golf','tennis'], 'https://www.nowtv.com/sports', null, 'UK Sky Sports streaming route.', 12, true),
  ('tnt_sports_uk', 'TNT Sports UK', 'direct', 'pending', array['GB','IE'], array['soccer','combat','boxing','mma'], 'https://www.tntsports.co.uk/', null, 'UK TNT Sports destination.', 18, true),
  ('bbc_iplayer', 'BBC iPlayer', 'direct', 'none', array['GB'], array['soccer','olympic','tennis','track'], 'https://www.bbc.co.uk/iplayer', null, 'Free UK public broadcaster destination when rights apply.', 48, true),
  ('itvx', 'ITVX', 'direct', 'none', array['GB'], array['soccer','rugby','boxing'], 'https://www.itv.com/', null, 'Free UK broadcaster destination when rights apply.', 49, true),
  ('movistar_plus', 'Movistar Plus+', 'direct', 'pending', array['ES'], array['soccer','f1','motorsport','basketball','tennis','golf'], 'https://www.movistarplus.es/', null, 'Spain canonical broadcaster path.', 10, true),
  ('rtve', 'RTVE Play', 'direct', 'none', array['ES'], array['soccer','olympic','tennis','track'], 'https://www.rtve.es/play/', null, 'Spain free public broadcaster destination when rights apply.', 48, true),
  ('showmax', 'Showmax', 'direct', 'pending', array['ZA','NG','KE','GH'], array['soccer','football','rugby','combat'], 'https://www.showmax.com/', null, 'Africa streaming destination; Premier League markets vary.', 14, true),
  ('dstv_supersport', 'DStv / SuperSport', 'direct', 'pending', array['ZA','NG','KE','GH'], array['soccer','rugby','cricket','combat','motorsport','tennis','golf'], 'https://www.dstv.com/', null, 'Africa canonical broadcaster path.', 10, true),
  ('bein_sports', 'beIN SPORTS', 'direct', 'pending', array['QA','SA','AE','EG','MA','FR','ES','US'], array['soccer','tennis','motorsport','combat'], 'https://www.beinsports.com/', null, 'Regional rights vary; affiliate portal exists in some markets.', 18, true),
  ('sonyliv', 'SonyLIV', 'cuelinks', 'pending', array['IN'], array['soccer','cricket','combat','tennis'], 'https://www.sonyliv.com/', null, 'India streaming route; Cuelinks-style publisher networks may apply.', 10, true),
  ('fancode', 'FanCode', 'direct', 'pending', array['IN'], array['cricket','soccer','basketball','baseball'], 'https://www.fancode.com/', null, 'India sports streaming route.', 14, true),
  ('hotstar_jio', 'JioHotstar', 'direct', 'pending', array['IN'], array['cricket','football','soccer','tennis','olympic'], 'https://www.hotstar.com/in', null, 'India Disney/Hotstar/Jio sports route; brand and rights may shift.', 16, true),
  ('showtime_sports', 'Showtime Sports', 'direct', 'none', array['US'], array['combat','boxing'], 'https://www.paramountplus.com/', null, 'Inactive for new sports linking; Showtime Sports shut down in 2023. Kept only as an alias note.', 500, false)
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

insert into public.watch_links
  (rule_key, provider_key, label, country_codes, sport_keys, link_kind, source_confidence, priority, notes, is_active)
values
  ('combat_us_dazn', 'dazn', 'DAZN', array['US'], array['combat','boxing','mma'], 'official', 'manual', 10, 'Current combat path.', true),
  ('combat_us_paramount', 'paramount_plus', 'Paramount+', array['US'], array['combat','boxing','mma'], 'official', 'manual', 14, 'Current Paramount/Zuffa and Showtime successor path.', true),
  ('combat_us_ufc', 'ufc_fight_pass', 'UFC Fight Pass', array['US'], array['combat','mma'], 'official', 'manual', 18, 'UFC-specific direct route.', true),
  ('combat_us_prime', 'prime_video', 'Prime Video', array['US'], array['combat','boxing'], 'official', 'manual', 24, 'PBC/PPV rights vary by event.', true),
  ('combat_us_ppv', 'ppv_com', 'PPV.com', array['US'], array['combat','boxing','mma'], 'official', 'manual', 30, 'PPV fallback for combat events.', true),
  ('sports_us_espn', 'espn_plus', 'ESPN+', array['US'], array['soccer','football','basketball','hockey','tennis','golf','combat'], 'official', 'manual', 20, 'US general sports streaming route.', true),
  ('sports_us_sling', 'sling', 'Sling TV', array['US'], array['soccer','football','basketball','hockey','baseball','combat'], 'official', 'manual', 32, 'US live TV route.', true),
  ('sports_us_fubo', 'fubo', 'Fubo', array['US'], array['soccer','football','basketball','hockey','baseball'], 'official', 'manual', 34, 'US live TV route.', true),
  ('canada_tsn', 'tsn', 'TSN', array['CA'], array['soccer','football','basketball','hockey','combat','tennis','golf'], 'official', 'manual', 10, 'Canada canonical sports route.', true),
  ('canada_sportsnet', 'sportsnet_plus', 'Sportsnet+', array['CA'], array['hockey','baseball','basketball','soccer','combat'], 'official', 'manual', 12, 'Canada canonical sports route.', true),
  ('canada_dazn', 'dazn', 'DAZN', array['CA'], array['soccer','combat','boxing','mma'], 'official', 'manual', 20, 'Canada DAZN route.', true),
  ('uk_sky', 'sky_sports', 'Sky Sports', array['GB','IE'], array['soccer','football','f1','motorsport','boxing','combat','golf','tennis'], 'official', 'manual', 10, 'UK/Ireland premium sports route.', true),
  ('uk_now', 'now_sports', 'NOW Sports', array['GB','IE'], array['soccer','football','f1','motorsport','boxing','combat','golf','tennis'], 'official', 'manual', 12, 'UK/Ireland streaming route.', true),
  ('uk_tnt', 'tnt_sports_uk', 'TNT Sports UK', array['GB','IE'], array['soccer','combat','boxing','mma'], 'official', 'manual', 18, 'UK/Ireland TNT route.', true),
  ('spain_dazn', 'dazn', 'DAZN', array['ES'], array['soccer','f1','motorsport','combat','boxing','mma'], 'official', 'manual', 10, 'Spain DAZN route.', true),
  ('spain_movistar', 'movistar_plus', 'Movistar Plus+', array['ES'], array['soccer','f1','motorsport','basketball','tennis','golf'], 'official', 'manual', 12, 'Spain premium sports route.', true),
  ('africa_supersport', 'dstv_supersport', 'DStv / SuperSport', array['ZA','NG','KE','GH'], array['soccer','rugby','cricket','combat','motorsport','tennis','golf'], 'official', 'manual', 10, 'Africa premium sports route.', true),
  ('africa_showmax', 'showmax', 'Showmax', array['ZA','NG','KE','GH'], array['soccer','football','rugby','combat'], 'official', 'manual', 14, 'Africa streaming route.', true),
  ('india_sonyliv', 'sonyliv', 'SonyLIV', array['IN'], array['soccer','cricket','combat','tennis'], 'official', 'manual', 10, 'India streaming route.', true),
  ('india_fancode', 'fancode', 'FanCode', array['IN'], array['cricket','soccer','basketball','baseball'], 'official', 'manual', 14, 'India sports streaming route.', true),
  ('india_hotstar', 'hotstar_jio', 'JioHotstar', array['IN'], array['cricket','football','soccer','tennis','olympic'], 'official', 'manual', 16, 'India major sports streaming route.', true),
  ('mena_bein', 'bein_sports', 'beIN SPORTS', array['QA','SA','AE','EG','MA'], array['soccer','tennis','motorsport','combat'], 'official', 'manual', 10, 'MENA sports route.', true)
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
