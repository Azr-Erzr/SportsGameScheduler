-- Master Plan 2 contract reconciliation:
-- - secure calendar feed tokens
-- - explicit TBD/certainty fields
-- - unified event change log
-- - true sport/league taxonomy prep
-- - homepage/where-to-watch/community import tables

create extension if not exists pgcrypto;

-- Profiles: region, language, timezone, and broadcast-region controls.
alter table public.profiles
  add column if not exists region_code text,
  add column if not exists broadcast_region text,
  add column if not exists terminology_overrides jsonb not null default '{}'::jsonb;

-- Calendar feeds: hash tokens at rest and carry rendering preferences.
alter table public.calendar_feeds
  add column if not exists token_hash text,
  add column if not exists locale text not null default 'en',
  add column if not exists include_placeholders boolean not null default false,
  add column if not exists include_broadcasts boolean not null default false,
  add column if not exists default_alarm_minutes integer[] not null default '{}',
  add column if not exists last_accessed_at timestamptz;

update public.calendar_feeds
set token_hash = encode(digest(token, 'sha256'), 'hex')
where token_hash is null and token is not null;

alter table public.calendar_feeds
  alter column token_hash set not null,
  alter column token drop not null;

alter table public.calendar_feeds
  drop constraint if exists calendar_feeds_token_key;

create unique index if not exists calendar_feeds_token_hash_key
  on public.calendar_feeds (token_hash);

-- Events: represent uncertainty explicitly instead of burying it in copy/nulls.
alter table public.events
  add column if not exists certainty text not null default 'confirmed',
  add column if not exists starts_at_precision text not null default 'exact',
  add column if not exists decision_status text not null default 'known',
  add column if not exists decision_expected_at timestamptz,
  add column if not exists decision_note text;

alter table public.events
  drop constraint if exists events_certainty_check,
  add constraint events_certainty_check
    check (certainty in ('confirmed', 'provisional', 'watch_only'));

alter table public.events
  drop constraint if exists events_starts_at_precision_check,
  add constraint events_starts_at_precision_check
    check (starts_at_precision in ('exact', 'date', 'month', 'window', 'unknown'));

alter table public.events
  drop constraint if exists events_decision_status_check,
  add constraint events_decision_status_check
    check (decision_status in ('known', 'tbd', 'pending_result', 'pending_draw', 'pending_broadcast'));

-- Unified schedule change log. event_status_history remains for compatibility, but new code
-- writes here and classifies changes by user impact.
create table if not exists public.event_change_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  change_type text not null,
  significance text not null check (significance in ('silent', 'calendar', 'notify')),
  old_value jsonb,
  new_value jsonb,
  source text not null,
  created_at timestamptz not null default now()
);

create index if not exists event_change_log_event_idx
  on public.event_change_log (event_id, created_at desc);

create index if not exists event_change_log_significance_idx
  on public.event_change_log (significance, created_at desc);

alter table public.event_change_log enable row level security;

create policy "public event change logs are readable" on public.event_change_log
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_change_log.event_id and e.visibility = 'public'
    )
  );

-- Event dependencies model bracket placeholders/draw outcomes without changing event IDs.
create table if not exists public.event_dependencies (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  depends_on_event_id uuid references public.events(id) on delete set null,
  dependency_type text not null check (dependency_type in ('winner', 'loser', 'draw', 'seed', 'manual')),
  slot_label text not null,
  resolved_competitor_id uuid references public.competitors(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, slot_label)
);

alter table public.event_dependencies enable row level security;

create policy "dependencies of public events are readable" on public.event_dependencies
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_dependencies.event_id and e.visibility = 'public'
    )
  );

-- Account-backed watch requests are optional after MVP, but the table supports "tell me when
-- this is set" without creating duplicate consent models.
create table if not exists public.schedule_watch_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  watch_type text not null check (watch_type in ('time_set', 'participant_set', 'venue_set', 'broadcast_set')),
  email text,
  verified_at timestamptz,
  unsubscribe_token_hash text,
  created_at timestamptz not null default now(),
  unique (user_id, event_id, watch_type)
);

alter table public.schedule_watch_requests enable row level security;

create policy "users manage their watch requests" on public.schedule_watch_requests
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- MMA/fight-card child model. Staged previews may use metadata; fighter-following uses this.
create table if not exists public.event_bouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  weight_class text,
  card_section text not null check (card_section in ('early_prelims', 'prelims', 'main_card', 'co_main_event', 'main_event')),
  red_corner_competitor_id uuid references public.competitors(id) on delete set null,
  blue_corner_competitor_id uuid references public.competitors(id) on delete set null,
  bout_order integer,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

create index if not exists event_bouts_event_idx on public.event_bouts (event_id, bout_order);

alter table public.event_bouts enable row level security;

create policy "bouts of public events are readable" on public.event_bouts
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_bouts.event_id and e.visibility = 'public'
    )
  );

-- Homepage discovery and sponsorship/watch-commerce surfaces.
create table if not exists public.spotlight_events (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid references public.sports(id),
  league_id uuid references public.leagues(id),
  event_id uuid references public.events(id),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  global_importance integer not null default 50 check (global_importance between 0 and 100),
  provider_confidence integer not null default 50 check (provider_confidence between 0 and 100),
  region_relevance jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  editorial_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spotlight_events_active_starts_idx
  on public.spotlight_events (is_active, starts_at);

alter table public.spotlight_events enable row level security;

create policy "active spotlight events are readable" on public.spotlight_events
  for select to anon, authenticated
  using (is_active = true);

create table if not exists public.watch_links (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid references public.broadcasts(id) on delete cascade,
  region text not null,
  provider_name text not null,
  url text not null,
  link_type text not null check (link_type in ('official', 'affiliate', 'sponsored')),
  disclosure text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.watch_links enable row level security;

create policy "active watch links are readable" on public.watch_links
  for select to anon, authenticated
  using (is_active = true);

create table if not exists public.sponsorship_slots (
  id uuid primary key default gen_random_uuid(),
  slot_key text not null,
  region text,
  sport_id uuid references public.sports(id),
  league_id uuid references public.leagues(id),
  event_id uuid references public.events(id),
  sponsor_name text not null,
  label text not null default 'Sponsored',
  creative jsonb not null default '{}'::jsonb,
  destination_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.sponsorship_slots enable row level security;

create policy "active sponsorship slots are readable" on public.sponsorship_slots
  for select to anon, authenticated
  using (is_active = true and starts_at <= now() and ends_at >= now());

create table if not exists public.localized_strings (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  locale text not null,
  field text not null,
  value text not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, locale, field)
);

alter table public.localized_strings enable row level security;

create policy "localized strings are readable" on public.localized_strings
  for select to anon, authenticated
  using (true);

-- Notification deliveries can now be keyed to individual change-log rows. Keep reminders
-- idempotent separately from schedule-change notifications.
alter table public.notification_deliveries
  add column if not exists change_log_id uuid references public.event_change_log(id) on delete cascade;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_user_id_event_id_channel_kind_key;

create unique index if not exists notification_deliveries_reminder_unique
  on public.notification_deliveries (user_id, event_id, channel, kind)
  where change_log_id is null;

create unique index if not exists notification_deliveries_change_unique
  on public.notification_deliveries (user_id, change_log_id, channel)
  where change_log_id is not null;

create or replace function public.materialize_change_notifications(horizon interval default interval '24 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  with changes as (
    select c.id as change_log_id, c.event_id, c.change_type, e.starts_at, e.status
    from public.event_change_log c
    join public.events e on e.id = c.event_id
    where c.significance = 'notify'
      and c.created_at >= now() - horizon
  ),
  interested as (
    select distinct
      f.user_id,
      c.event_id,
      c.change_log_id,
      case
        when c.change_type = 'cancellation' then 'cancellation'
        when c.change_type = 'new_event' then 'new_event'
        else 'time_change'
      end as kind,
      p.email_enabled,
      p.push_enabled
    from changes c
    join public.events e on e.id = c.event_id
    join public.user_follows f
      on (
        (f.target_type = 'sport' and f.target_id = e.sport_id)
        or (f.target_type = 'league' and f.target_id = e.league_id)
        or (f.target_type = 'custom_league' and f.target_id = e.custom_league_id)
        or (
          f.target_type in ('team', 'competitor', 'player')
          and exists (
            select 1 from public.event_competitors ec
            where ec.event_id = e.id and ec.competitor_id = f.target_id
          )
        )
      )
    join public.alert_preferences p
      on p.user_id = f.user_id
     and p.target_type = f.target_type
     and p.target_id = f.target_id
    where (
      c.change_type <> 'cancellation' or p.notify_cancellations
    )
    and (
      c.change_type = 'cancellation' or p.notify_time_changes
    )
  ),
  expanded as (
    select user_id, event_id, change_log_id, kind, 'email'::text as channel
    from interested where email_enabled
    union all
    select user_id, event_id, change_log_id, kind, 'push'
    from interested where push_enabled
  )
  insert into public.notification_deliveries
    (user_id, event_id, change_log_id, channel, kind, scheduled_for)
  select user_id, event_id, change_log_id, channel, kind, now()
  from expanded
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- True sport taxonomy. Existing route aliases can remain in the frontend; DB rows should be
-- true sports with leagues below them.
insert into public.sports (key, name) values
  ('soccer', 'Soccer'),
  ('basketball', 'Basketball'),
  ('hockey', 'Hockey'),
  ('motorsport', 'Motorsport'),
  ('tennis', 'Tennis'),
  ('golf', 'Golf'),
  ('mma', 'MMA'),
  ('american_football', 'American football'),
  ('custom', 'Community')
on conflict (key) do nothing;

do $$
declare
  legacy_id uuid;
  canonical_id uuid;
begin
  -- Merge league-like legacy sport rows into true sport rows.
  for legacy_id, canonical_id in
    select old_s.id, new_s.id
    from (values
      ('f1', 'motorsport'),
      ('nhl', 'hockey'),
      ('nba', 'basketball')
    ) as m(old_key, new_key)
    join public.sports old_s on old_s.key = m.old_key
    join public.sports new_s on new_s.key = m.new_key
  loop
    update public.leagues set sport_id = canonical_id where sport_id = legacy_id;
    update public.competitors set sport_id = canonical_id where sport_id = legacy_id;
    update public.events set sport_id = canonical_id where sport_id = legacy_id;
    update public.custom_leagues set sport_id = canonical_id where sport_id = legacy_id;
    update public.user_follows set target_id = canonical_id where target_type = 'sport' and target_id = legacy_id;
    delete from public.sports where id = legacy_id;
  end loop;
end $$;

insert into public.leagues (sport_id, provider_key, provider_league_id, name, short_name, country)
select s.id, 'catalog', 'f1', 'Formula 1', 'F1', null from public.sports s where s.key = 'motorsport'
on conflict (provider_key, provider_league_id) do nothing;

insert into public.leagues (sport_id, provider_key, provider_league_id, name, short_name, country)
select s.id, 'catalog', 'nhl', 'National Hockey League', 'NHL', 'US/CA' from public.sports s where s.key = 'hockey'
on conflict (provider_key, provider_league_id) do nothing;

insert into public.leagues (sport_id, provider_key, provider_league_id, name, short_name, country)
select s.id, 'catalog', 'nba', 'National Basketball Association', 'NBA', 'US/CA' from public.sports s where s.key = 'basketball'
on conflict (provider_key, provider_league_id) do nothing;

insert into public.leagues (sport_id, provider_key, provider_league_id, name, short_name, country)
select s.id, 'catalog', 'wnba', 'Women's National Basketball Association', 'WNBA', 'US' from public.sports s where s.key = 'basketball'
on conflict (provider_key, provider_league_id) do nothing;

insert into public.leagues (sport_id, provider_key, provider_league_id, name, short_name, country)
select s.id, 'catalog', 'ufc', 'Ultimate Fighting Championship', 'UFC', null from public.sports s where s.key = 'mma'
on conflict (provider_key, provider_league_id) do nothing;

insert into public.leagues (sport_id, provider_key, provider_league_id, name, short_name, country)
select s.id, 'catalog', 'pfl', 'Professional Fighters League', 'PFL', null from public.sports s where s.key = 'mma'
on conflict (provider_key, provider_league_id) do nothing;

insert into public.leagues (sport_id, provider_key, provider_league_id, name, short_name, country)
select s.id, 'catalog', 'cfl', 'Canadian Football League', 'CFL', 'CA' from public.sports s where s.key = 'american_football'
on conflict (provider_key, provider_league_id) do nothing;

-- Provider run diagnostics for freshness/admin views.
alter table public.provider_sync_runs
  add column if not exists raw_payload_ref text,
  add column if not exists source_url text,
  add column if not exists license_note text;
