-- Custom leagues (plan Objective 9), with the corrected private-event RLS story.

create table public.custom_leagues (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  sport_id uuid references public.sports(id),
  name text not null,
  timezone text not null,
  location text,
  public_token text not null unique,
  theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.custom_league_members (
  id uuid primary key default gen_random_uuid(),
  custom_league_id uuid not null references public.custom_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'viewer')),
  unique (custom_league_id, user_id)
);

create table public.custom_teams (
  id uuid primary key default gen_random_uuid(),
  custom_league_id uuid not null references public.custom_leagues(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);

-- Close the loop from 0001: custom events live in public.events with visibility='private'.
alter table public.events
  add constraint events_custom_league_fk
  foreign key (custom_league_id) references public.custom_leagues(id) on delete cascade;

create index events_custom_league_idx on public.events (custom_league_id, starts_at);

-- The owner is always also a member row (role 'owner'); insert it automatically so one
-- membership-based policy covers owners, admins, and viewers.
create or replace function public.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.custom_league_members (custom_league_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger custom_league_owner_membership
  after insert on public.custom_leagues
  for each row execute function public.add_owner_membership();

alter table public.custom_leagues enable row level security;
alter table public.custom_league_members enable row level security;
alter table public.custom_teams enable row level security;

create policy "owners manage custom leagues" on public.custom_leagues
  for all to authenticated
  using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

create policy "members read their leagues" on public.custom_leagues
  for select to authenticated
  using (exists (
    select 1 from public.custom_league_members m
    where m.custom_league_id = custom_leagues.id and m.user_id = auth.uid()
  ));

create policy "owners manage members" on public.custom_league_members
  for all to authenticated
  using (exists (
    select 1 from public.custom_leagues l
    where l.id = custom_league_members.custom_league_id and l.owner_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.custom_leagues l
    where l.id = custom_league_members.custom_league_id and l.owner_user_id = auth.uid()
  ));

create policy "members see the member list" on public.custom_league_members
  for select to authenticated
  using (exists (
    select 1 from public.custom_league_members me
    where me.custom_league_id = custom_league_members.custom_league_id and me.user_id = auth.uid()
  ));

create policy "members read teams" on public.custom_teams
  for select to authenticated
  using (exists (
    select 1 from public.custom_league_members m
    where m.custom_league_id = custom_teams.custom_league_id and m.user_id = auth.uid()
  ));

create policy "admins manage teams" on public.custom_teams
  for all to authenticated
  using (exists (
    select 1 from public.custom_league_members m
    where m.custom_league_id = custom_teams.custom_league_id
      and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from public.custom_league_members m
    where m.custom_league_id = custom_teams.custom_league_id
      and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  ));

-- The positive read path for private events (review fix): members can read their league's
-- events through the same public.events table the public policy gates.
create policy "custom league members read their private events" on public.events
  for select to authenticated
  using (
    visibility = 'private'
    and custom_league_id is not null
    and exists (
      select 1 from public.custom_league_members m
      where m.custom_league_id = events.custom_league_id and m.user_id = auth.uid()
    )
  );

create policy "custom league admins manage their events" on public.events
  for all to authenticated
  using (
    custom_league_id is not null
    and exists (
      select 1 from public.custom_league_members m
      where m.custom_league_id = events.custom_league_id
        and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  )
  with check (
    visibility = 'private'
    and custom_league_id is not null
    and exists (
      select 1 from public.custom_league_members m
      where m.custom_league_id = events.custom_league_id
        and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  );

-- Public share page resolution: SECURITY DEFINER lookup by unguessable token, returning
-- only what the share page needs. Anonymous users never get a blanket read policy.
create or replace function public.get_shared_league(share_token text)
returns table (
  league_name text,
  league_timezone text,
  league_location text,
  event_title text,
  event_starts_at timestamptz,
  event_status text,
  event_metadata jsonb
)
language sql
security definer
set search_path = public
as $$
  select l.name, l.timezone, l.location, e.title, e.starts_at, e.status, e.metadata
  from public.custom_leagues l
  left join public.events e on e.custom_league_id = l.id
  where l.public_token = share_token
  order by e.starts_at asc;
$$;
