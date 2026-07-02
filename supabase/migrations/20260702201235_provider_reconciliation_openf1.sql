-- Provider reconciliation lane.
--
-- This lets secondary/tertiary feeds (API-Sports, OpenF1, official ICS feeds, etc.)
-- attach evidence to one canonical event instead of creating provider-specific islands.

alter table public.event_external_ids
  add column if not exists source_confidence text not null default 'provider',
  add column if not exists match_confidence integer not null default 100,
  add column if not exists payload_hash text,
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_external_ids_source_confidence_check'
      and conrelid = 'public.event_external_ids'::regclass
  ) then
    alter table public.event_external_ids
      add constraint event_external_ids_source_confidence_check
      check (source_confidence in ('official', 'provider', 'cached', 'manual', 'placeholder'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_external_ids_match_confidence_check'
      and conrelid = 'public.event_external_ids'::regclass
  ) then
    alter table public.event_external_ids
      add constraint event_external_ids_match_confidence_check
      check (match_confidence between 0 and 100);
  end if;
end $$;

create index if not exists event_external_ids_last_seen_idx
  on public.event_external_ids (provider_key, last_seen_at desc);

create table if not exists public.provider_event_sources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  provider_key text not null,
  external_id text not null,
  sport_key text not null,
  provider_league_id text,
  normalized_title text,
  starts_at timestamptz,
  status text,
  source_confidence text not null default 'provider'
    check (source_confidence in ('official', 'provider', 'cached', 'manual', 'placeholder')),
  match_confidence integer not null default 100 check (match_confidence between 0 and 100),
  payload_hash text,
  raw_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (provider_key, external_id)
);

create index if not exists provider_event_sources_event_idx
  on public.provider_event_sources (event_id) where event_id is not null;

create index if not exists provider_event_sources_sport_start_idx
  on public.provider_event_sources (sport_key, starts_at desc) where starts_at is not null;

create index if not exists provider_event_sources_provider_seen_idx
  on public.provider_event_sources (provider_key, last_seen_at desc);

alter table public.provider_event_sources enable row level security;

insert into public.source_providers
  (provider_key, name, source_type, homepage_url, terms_url, notes, is_active)
values
  (
    'openf1',
    'OpenF1',
    'api',
    'https://openf1.org/',
    'https://openf1.org/',
    'Open-source Formula 1 historical/session API. Historical data is public; live realtime requires a paid subscription.',
    true
  )
on conflict (provider_key) do update set
  name = excluded.name,
  source_type = excluded.source_type,
  homepage_url = excluded.homepage_url,
  terms_url = excluded.terms_url,
  notes = excluded.notes,
  is_active = true,
  updated_at = now();

insert into public.provider_targets
  (provider_key, provider_league_id, sport_key, expected_name, current_season, priority, is_active)
values
  ('openf1', 'f1', 'motorsport', 'Formula 1', extract(year from now())::text, 11, true)
on conflict (provider_key, provider_league_id) do update set
  sport_key = excluded.sport_key,
  expected_name = excluded.expected_name,
  current_season = excluded.current_season,
  priority = excluded.priority,
  is_active = excluded.is_active;

update public.provider_targets
set
  current_season = extract(year from now())::text,
  priority = least(priority, 12),
  is_active = true
where provider_key = 'apisports_formula1'
  and provider_league_id = 'f1';
