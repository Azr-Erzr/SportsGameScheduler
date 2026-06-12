-- User profiles and follows (plan Objective 5).

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_timezone text,
  default_city text,
  locale text,
  hour12 boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('sport', 'league', 'team', 'competitor', 'player', 'custom_league')),
  target_id uuid not null,
  intent text not null default 'watch' check (intent in ('watch', 'attend', 'track')),
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id, intent)
);

create index user_follows_user_idx on public.user_follows (user_id);

alter table public.profiles enable row level security;
alter table public.user_follows enable row level security;

create policy "users manage their profile" on public.profiles
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their follows" on public.user_follows
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Personal schedule. SECURITY INVOKER: RLS on events decides what the caller can see, so
-- private custom-league events appear only for members (policy in 0004).
create or replace function public.get_my_schedule(
  start_at timestamptz,
  end_at timestamptz
)
returns setof public.events
language sql
security invoker
set search_path = public
as $$
  select distinct e.*
  from public.events e
  join public.user_follows f
    on f.user_id = auth.uid()
   and (
     (f.target_type = 'sport' and f.target_id = e.sport_id)
     or (f.target_type = 'league' and f.target_id = e.league_id)
     or (f.target_type = 'custom_league' and f.target_id = e.custom_league_id)
     -- team/competitor/player follows resolve through event_competitors, so F1 grids,
     -- golf fields, and tennis draws work — not just 1v1 home/away.
     or (
       f.target_type in ('team', 'competitor', 'player')
       and exists (
         select 1 from public.event_competitors ec
         where ec.event_id = e.id and ec.competitor_id = f.target_id
       )
     )
   )
  where e.starts_at >= start_at
    and e.starts_at < end_at
  order by e.starts_at asc;
$$;
