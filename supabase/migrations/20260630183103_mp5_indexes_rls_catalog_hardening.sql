-- MP5 database hardening:
-- - Add covering indexes for high-value foreign keys flagged by Supabase advisors.
-- - Rewrite user-owned/private RLS policies to avoid per-row auth.uid() init plans.
-- - Hide obvious provider/system catalog artifacts from public league surfaces.

-- FK / join indexes. Existing indexes are left alone; do not drop "unused" indexes until
-- they have lived through a representative production traffic window.
create index if not exists blog_posts_related_event_idx on public.blog_posts (related_event_id) where related_event_id is not null;

create index if not exists bracket_slots_source_event_idx on public.bracket_slots (source_event_id) where source_event_id is not null;
create index if not exists bracket_slots_resolved_competitor_idx on public.bracket_slots (resolved_competitor_id) where resolved_competitor_id is not null;

create index if not exists competition_art_kits_template_idx on public.competition_art_kits (template_slug);
create index if not exists competition_instance_sources_source_target_idx on public.competition_instance_sources (source_target_id) where source_target_id is not null;
create index if not exists competition_instance_sources_provider_target_idx on public.competition_instance_sources (provider_target_id) where provider_target_id is not null;
create index if not exists competition_instances_sport_idx on public.competition_instances (sport_key);
create index if not exists competition_instances_template_idx on public.competition_instances (template_slug);
create index if not exists competition_templates_sport_key_idx on public.competition_templates (sport_key);

create index if not exists competitors_sport_id_idx on public.competitors (sport_id);
create index if not exists competitors_league_id_idx on public.competitors (league_id) where league_id is not null;

create index if not exists custom_league_members_user_id_idx on public.custom_league_members (user_id);
create index if not exists custom_leagues_owner_user_id_idx on public.custom_leagues (owner_user_id);
create index if not exists custom_leagues_sport_id_idx on public.custom_leagues (sport_id) where sport_id is not null;
create index if not exists custom_teams_custom_league_id_idx on public.custom_teams (custom_league_id);

create index if not exists event_bouts_red_corner_competitor_idx on public.event_bouts (red_corner_competitor_id) where red_corner_competitor_id is not null;
create index if not exists event_bouts_blue_corner_competitor_idx on public.event_bouts (blue_corner_competitor_id) where blue_corner_competitor_id is not null;
create index if not exists event_sessions_child_event_idx on public.event_sessions (child_event_id) where child_event_id is not null;

create index if not exists events_season_id_idx on public.events (season_id) where season_id is not null;
create index if not exists events_sport_id_starts_at_idx on public.events (sport_id, starts_at) where visibility = 'public';
create index if not exists events_venue_id_idx on public.events (venue_id) where venue_id is not null;

create index if not exists notification_deliveries_event_id_idx on public.notification_deliveries (event_id) where event_id is not null;
create index if not exists notification_deliveries_change_log_id_idx on public.notification_deliveries (change_log_id) where change_log_id is not null;

create index if not exists provider_sync_runs_league_id_idx on public.provider_sync_runs (league_id) where league_id is not null;
create index if not exists provider_targets_sport_key_idx on public.provider_targets (sport_key);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index if not exists seasons_league_id_idx on public.seasons (league_id);
create index if not exists source_targets_source_provider_id_idx on public.source_targets (source_provider_id);

create index if not exists spotlight_events_event_id_idx on public.spotlight_events (event_id) where event_id is not null;
create index if not exists spotlight_events_template_slug_idx on public.spotlight_events (template_slug) where template_slug is not null;
create index if not exists spotlight_events_competition_instance_idx on public.spotlight_events (competition_instance_id) where competition_instance_id is not null;

create index if not exists team_assets_competitor_idx on public.team_assets (competitor_id) where competitor_id is not null;
create index if not exists team_assets_league_idx on public.team_assets (league_id) where league_id is not null;
create index if not exists team_assets_sport_idx on public.team_assets (sport_key);
create index if not exists watch_links_provider_key_idx on public.watch_links (provider_key);

-- User-owned RLS policies: same access model, cheaper auth.uid() evaluation.
drop policy if exists "users manage their alert preferences" on public.alert_preferences;
create policy "users manage their alert preferences"
  on public.alert_preferences
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users manage their calendar feeds" on public.calendar_feeds;
create policy "users manage their calendar feeds"
  on public.calendar_feeds
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users manage their profile" on public.profiles;
create policy "users manage their profile"
  on public.profiles
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users manage their push subscriptions" on public.push_subscriptions;
create policy "users manage their push subscriptions"
  on public.push_subscriptions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users manage their follows" on public.user_follows;
create policy "users manage their follows"
  on public.user_follows
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users read their deliveries" on public.notification_deliveries;
create policy "users read their deliveries"
  on public.notification_deliveries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Custom league policies: preserve current owner/member behavior while removing duplicated
-- permissive SELECT policies and per-row auth.uid() init plans.
drop policy if exists "members see the member list" on public.custom_league_members;
drop policy if exists "owners manage members" on public.custom_league_members;

create policy "members or owners read league members"
  on public.custom_league_members
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.custom_league_members me
      where me.custom_league_id = custom_league_members.custom_league_id
        and me.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.custom_leagues l
      where l.id = custom_league_members.custom_league_id
        and l.owner_user_id = (select auth.uid())
    )
  );

create policy "owners insert members"
  on public.custom_league_members
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.custom_leagues l
      where l.id = custom_league_members.custom_league_id
        and l.owner_user_id = (select auth.uid())
    )
  );

create policy "owners update members"
  on public.custom_league_members
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.custom_leagues l
      where l.id = custom_league_members.custom_league_id
        and l.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.custom_leagues l
      where l.id = custom_league_members.custom_league_id
        and l.owner_user_id = (select auth.uid())
    )
  );

create policy "owners delete members"
  on public.custom_league_members
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.custom_leagues l
      where l.id = custom_league_members.custom_league_id
        and l.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "members read their leagues" on public.custom_leagues;
drop policy if exists "owners manage custom leagues" on public.custom_leagues;

create policy "members or owners read custom leagues"
  on public.custom_leagues
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.custom_league_members m
      where m.custom_league_id = custom_leagues.id
        and m.user_id = (select auth.uid())
    )
  );

create policy "owners insert custom leagues"
  on public.custom_leagues
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_user_id);

create policy "owners update custom leagues"
  on public.custom_leagues
  for update
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy "owners delete custom leagues"
  on public.custom_leagues
  for delete
  to authenticated
  using ((select auth.uid()) = owner_user_id);

drop policy if exists "admins manage teams" on public.custom_teams;
drop policy if exists "members read teams" on public.custom_teams;

create policy "members read custom teams"
  on public.custom_teams
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.custom_league_members m
      where m.custom_league_id = custom_teams.custom_league_id
        and m.user_id = (select auth.uid())
    )
  );

create policy "admins insert custom teams"
  on public.custom_teams
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.custom_league_members m
      where m.custom_league_id = custom_teams.custom_league_id
        and m.user_id = (select auth.uid())
        and m.role = any (array['owner'::text, 'admin'::text])
    )
  );

create policy "admins update custom teams"
  on public.custom_teams
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.custom_league_members m
      where m.custom_league_id = custom_teams.custom_league_id
        and m.user_id = (select auth.uid())
        and m.role = any (array['owner'::text, 'admin'::text])
    )
  )
  with check (
    exists (
      select 1
      from public.custom_league_members m
      where m.custom_league_id = custom_teams.custom_league_id
        and m.user_id = (select auth.uid())
        and m.role = any (array['owner'::text, 'admin'::text])
    )
  );

create policy "admins delete custom teams"
  on public.custom_teams
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.custom_league_members m
      where m.custom_league_id = custom_teams.custom_league_id
        and m.user_id = (select auth.uid())
        and m.role = any (array['owner'::text, 'admin'::text])
    )
  );

drop policy if exists "custom league admins manage their events" on public.events;
drop policy if exists "custom league members read their private events" on public.events;
drop policy if exists "public events are readable" on public.events;

create policy "public events are readable to guests"
  on public.events
  for select
  to anon
  using (visibility = 'public'::text);

create policy "authenticated users read allowed events"
  on public.events
  for select
  to authenticated
  using (
    visibility = 'public'::text
    or (
      visibility = 'private'::text
      and custom_league_id is not null
      and exists (
        select 1
        from public.custom_league_members m
        where m.custom_league_id = events.custom_league_id
          and m.user_id = (select auth.uid())
      )
    )
  );

create policy "custom league admins insert events"
  on public.events
  for insert
  to authenticated
  with check (
    visibility = 'private'::text
    and custom_league_id is not null
    and exists (
      select 1
      from public.custom_league_members m
      where m.custom_league_id = events.custom_league_id
        and m.user_id = (select auth.uid())
        and m.role = any (array['owner'::text, 'admin'::text])
    )
  );

create policy "custom league admins update events"
  on public.events
  for update
  to authenticated
  using (
    custom_league_id is not null
    and exists (
      select 1
      from public.custom_league_members m
      where m.custom_league_id = events.custom_league_id
        and m.user_id = (select auth.uid())
        and m.role = any (array['owner'::text, 'admin'::text])
    )
  )
  with check (
    visibility = 'private'::text
    and custom_league_id is not null
    and exists (
      select 1
      from public.custom_league_members m
      where m.custom_league_id = events.custom_league_id
        and m.user_id = (select auth.uid())
        and m.role = any (array['owner'::text, 'admin'::text])
    )
  );

create policy "custom league admins delete events"
  on public.events
  for delete
  to authenticated
  using (
    custom_league_id is not null
    and exists (
      select 1
      from public.custom_league_members m
      where m.custom_league_id = events.custom_league_id
        and m.user_id = (select auth.uid())
        and m.role = any (array['owner'::text, 'admin'::text])
    )
  );

-- Hide obvious provider/system artifact leagues from public catalog reads.
update public.leagues
set is_public = false
where is_public = true
  and (
    name ~ '^_'
    or name ~* '\m(defunct|deprecated|placeholder|unknown|tbd)\M'
  );
