-- Move custom-league RLS helpers out of the exposed public schema.
-- They are still executable by authenticated users for RLS evaluation, but they are no longer
-- exposed as public REST RPC endpoints.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_custom_league_member(league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.custom_league_members m
    where m.custom_league_id = league_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function private.is_custom_league_admin(league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.custom_league_members m
    where m.custom_league_id = league_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function private.is_custom_league_member(uuid) from public, anon, authenticated;
revoke all on function private.is_custom_league_admin(uuid) from public, anon, authenticated;
grant execute on function private.is_custom_league_member(uuid) to authenticated;
grant execute on function private.is_custom_league_admin(uuid) to authenticated;

drop policy if exists "members or owners read league members" on public.custom_league_members;
drop policy if exists "owners insert members" on public.custom_league_members;
drop policy if exists "owners update members" on public.custom_league_members;
drop policy if exists "owners delete members" on public.custom_league_members;

create policy "members or owners read league members"
  on public.custom_league_members
  for select
  to authenticated
  using (private.is_custom_league_member(custom_league_id));

create policy "owners insert members"
  on public.custom_league_members
  for insert
  to authenticated
  with check (private.is_custom_league_admin(custom_league_id));

create policy "owners update members"
  on public.custom_league_members
  for update
  to authenticated
  using (private.is_custom_league_admin(custom_league_id))
  with check (private.is_custom_league_admin(custom_league_id));

create policy "owners delete members"
  on public.custom_league_members
  for delete
  to authenticated
  using (private.is_custom_league_admin(custom_league_id));

drop policy if exists "members or owners read custom leagues" on public.custom_leagues;

create policy "members or owners read custom leagues"
  on public.custom_leagues
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or private.is_custom_league_member(id)
  );

drop policy if exists "members read custom teams" on public.custom_teams;
drop policy if exists "admins insert custom teams" on public.custom_teams;
drop policy if exists "admins update custom teams" on public.custom_teams;
drop policy if exists "admins delete custom teams" on public.custom_teams;

create policy "members read custom teams"
  on public.custom_teams
  for select
  to authenticated
  using (private.is_custom_league_member(custom_league_id));

create policy "admins insert custom teams"
  on public.custom_teams
  for insert
  to authenticated
  with check (private.is_custom_league_admin(custom_league_id));

create policy "admins update custom teams"
  on public.custom_teams
  for update
  to authenticated
  using (private.is_custom_league_admin(custom_league_id))
  with check (private.is_custom_league_admin(custom_league_id));

create policy "admins delete custom teams"
  on public.custom_teams
  for delete
  to authenticated
  using (private.is_custom_league_admin(custom_league_id));

drop policy if exists "authenticated users read allowed events" on public.events;
drop policy if exists "custom league admins insert events" on public.events;
drop policy if exists "custom league admins update events" on public.events;
drop policy if exists "custom league admins delete events" on public.events;

create policy "authenticated users read allowed events"
  on public.events
  for select
  to authenticated
  using (
    visibility = 'public'
    or (
      visibility = 'private'
      and custom_league_id is not null
      and private.is_custom_league_member(custom_league_id)
    )
  );

create policy "custom league admins insert events"
  on public.events
  for insert
  to authenticated
  with check (
    visibility = 'private'
    and custom_league_id is not null
    and private.is_custom_league_admin(custom_league_id)
  );

create policy "custom league admins update events"
  on public.events
  for update
  to authenticated
  using (
    custom_league_id is not null
    and private.is_custom_league_admin(custom_league_id)
  )
  with check (
    visibility = 'private'
    and custom_league_id is not null
    and private.is_custom_league_admin(custom_league_id)
  );

create policy "custom league admins delete events"
  on public.events
  for delete
  to authenticated
  using (
    custom_league_id is not null
    and private.is_custom_league_admin(custom_league_id)
  );

revoke all on function public.is_custom_league_member(uuid) from public, anon, authenticated;
revoke all on function public.is_custom_league_admin(uuid) from public, anon, authenticated;
drop function if exists public.is_custom_league_member(uuid);
drop function if exists public.is_custom_league_admin(uuid);
