-- Calendar-feed ingestion lane (MP4 4.4).
-- This is intentionally source-allowlisted and service-role-written: public users can read
-- resulting public events, but they cannot inspect source URLs or add arbitrary feeds.

create table if not exists public.source_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  name text not null,
  source_type text not null check (source_type in ('api', 'ics', 'webcal', 'curated')),
  homepage_url text,
  terms_url text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.source_targets (
  id uuid primary key default gen_random_uuid(),
  source_provider_id uuid not null references public.source_providers(id) on delete cascade,
  target_key text not null unique,
  source_type text not null check (source_type in ('ics', 'webcal')),
  url text not null,
  sport_key text not null,
  league_id uuid references public.leagues(id) on delete set null,
  expected_name text not null,
  source_confidence text not null default 'provider'
    check (source_confidence in ('official', 'provider', 'cached', 'manual', 'placeholder')),
  is_active boolean not null default true,
  dry_run boolean not null default true,
  priority integer not null default 500,
  cadence_minutes integer not null default 1440 check (cadence_minutes between 15 and 43200),
  payload_hash text,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  events_synced_at timestamptz,
  last_status text,
  last_error text,
  terms_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists source_targets_active_priority_idx
  on public.source_targets (is_active, priority, last_checked_at);
create index if not exists source_targets_sport_idx
  on public.source_targets (sport_key);
create index if not exists source_targets_league_idx
  on public.source_targets (league_id) where league_id is not null;

create table if not exists public.event_external_ids (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  source_target_id uuid references public.source_targets(id) on delete set null,
  provider_key text not null,
  external_id text not null,
  raw_uid text,
  created_at timestamptz not null default now(),
  unique (provider_key, external_id)
);

create index if not exists event_external_ids_event_idx
  on public.event_external_ids (event_id);
create index if not exists event_external_ids_target_idx
  on public.event_external_ids (source_target_id) where source_target_id is not null;

alter table public.source_providers enable row level security;
alter table public.source_targets enable row level security;
alter table public.event_external_ids enable row level security;

-- Internal tables: no anon/authenticated policies. Edge Functions use the service role.

insert into public.source_providers
  (provider_key, name, source_type, homepage_url, notes)
values
  ('ics_feed', 'Public calendar feeds', 'ics', null, 'Allowlisted official/public ICS and webcal feeds normalized into canonical events.')
on conflict (provider_key) do update
set
  name = excluded.name,
  source_type = excluded.source_type,
  notes = excluded.notes,
  is_active = true,
  updated_at = now();
