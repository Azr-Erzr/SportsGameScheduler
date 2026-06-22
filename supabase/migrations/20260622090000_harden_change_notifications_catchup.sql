-- MP3 hardening + catch-up: make schedule-change notifications database-driven and resilient.
--
-- Context (verified against remote): notifications previously ran only off event_status_history,
-- written ad-hoc by edge functions. event_change_log, notification_deliveries.change_log_id, and
-- the richer alert_preferences.notify_* flags were never applied to this project. This migration:
--   1. Creates event_change_log (the unified change log).
--   2. Adds a SECURITY DEFINER trigger on events that captures user-impacting changes into it,
--      wrapped so a logging failure can NEVER roll back the actual event write.
--   3. Adds the missing alert_preferences.notify_* columns and notification_deliveries.change_log_id.
--   4. Installs a hardened materialize_change_notifications that reads from BOTH event_change_log
--      and event_status_history (dual-source = resilient), dedupes via the existing unique key.
-- It deliberately does NOT redefine spotlight_ranked / admin_overview (the rich lifecycle versions
-- from 20260622024757 must stay). Supersedes the notification half of the unapplied
-- 20260620200650_expand_alert_preferences_and_copy migration on this project.

-- 1. Unified change log -------------------------------------------------------------------------
create table if not exists public.event_change_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  change_type text not null,
  significance text not null check (significance in ('silent', 'calendar', 'notify')),
  old_value jsonb,
  new_value jsonb,
  source text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists event_change_log_event_idx
  on public.event_change_log (event_id, created_at desc);
create index if not exists event_change_log_significance_idx
  on public.event_change_log (significance, created_at desc);

alter table public.event_change_log enable row level security;

drop policy if exists "public event change logs are readable" on public.event_change_log;
create policy "public event change logs are readable" on public.event_change_log
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_change_log.event_id and e.visibility = 'public'
    )
  );

grant select on public.event_change_log to anon, authenticated;

-- 2. Database-driven change capture -------------------------------------------------------------
-- The whole point of hardening: change detection lives in the DB, not in each sync function, so a
-- forgotten log line in an edge function can no longer cause a missed alert. Best-effort: any
-- failure inside is swallowed so the event UPDATE itself always succeeds.
create or replace function public.capture_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    -- Cancellation / postponement.
    if new.status is distinct from old.status and new.status in ('cancelled', 'postponed') then
      insert into public.event_change_log (event_id, change_type, significance, old_value, new_value, source)
      values (new.id, 'cancellation', 'notify', to_jsonb(old.status), to_jsonb(new.status), 'trigger');
    end if;

    -- Kickoff time set or moved (only for events that are still upcoming).
    if new.starts_at is distinct from old.starts_at
       and new.starts_at is not null
       and new.starts_at > now() then
      insert into public.event_change_log (event_id, change_type, significance, old_value, new_value, source)
      values (
        new.id,
        case when old.starts_at is null then 'time_set' else 'time_change' end,
        'notify',
        to_jsonb(old.starts_at),
        to_jsonb(new.starts_at),
        'trigger'
      );
    end if;

    -- Venue moved (both sides known — ignore initial venue assignment).
    if new.venue_id is distinct from old.venue_id
       and new.venue_id is not null
       and old.venue_id is not null then
      insert into public.event_change_log (event_id, change_type, significance, old_value, new_value, source)
      values (new.id, 'venue_change', 'notify', to_jsonb(old.venue_id), to_jsonb(new.venue_id), 'trigger');
    end if;
  exception when others then
    -- Change capture is best-effort and must never abort the underlying event write.
    null;
  end;
  return null;
end;
$$;

drop trigger if exists events_capture_change on public.events;
create trigger events_capture_change
  after update on public.events
  for each row execute function public.capture_event_change();

-- 3. Preference + delivery columns --------------------------------------------------------------
alter table public.alert_preferences
  add column if not exists notify_new_events boolean not null default true,
  add column if not exists notify_participant_updates boolean not null default true,
  add column if not exists notify_venue_changes boolean not null default true,
  add column if not exists notify_broadcast_updates boolean not null default true;

alter table public.notification_deliveries
  add column if not exists change_log_id uuid references public.event_change_log(id) on delete cascade;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_kind_check,
  add constraint notification_deliveries_kind_check
    check (
      kind in (
        'reminder',
        'time_change',
        'time_set',
        'cancellation',
        'new_event',
        'participant_update',
        'venue_change',
        'broadcast_update'
      )
    );

grant select, insert, update, delete on public.alert_preferences to authenticated;
grant select on public.notification_deliveries to authenticated;

-- 4. Hardened materializer (dual-source, defensive, idempotent) ---------------------------------
create or replace function public.materialize_change_notifications(lookback interval default interval '24 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  with unified_changes as (
    -- Primary path: the unified change log (written by the events trigger and, optionally,
    -- by edge functions that classify their own changes).
    select
      c.id as change_log_id,
      c.event_id,
      case
        when c.change_type in ('cancellation', 'postponement') then 'cancellation'
        when c.change_type = 'time_set' then 'time_set'
        when c.change_type in ('time_change', 'kickoff_change', 'start_time_change') then 'time_change'
        when c.change_type in ('participant_set', 'participant_update', 'bracket_slot_set', 'draw_set') then 'participant_update'
        when c.change_type in ('venue_set', 'venue_change') then 'venue_change'
        when c.change_type in ('broadcast_set', 'broadcast_update', 'watch_link_update') then 'broadcast_update'
        when c.change_type = 'new_event' then 'new_event'
        else 'time_change'
      end as kind
    from public.event_change_log c
    where c.significance = 'notify'
      and c.created_at >= now() - lookback

    union all

    -- Compatibility path: older sync functions still write event_status_history directly.
    select
      null::uuid as change_log_id,
      h.event_id,
      case
        when h.new_status in ('cancelled', 'postponed') then 'cancellation'
        when h.old_starts_at is null and h.new_starts_at is not null then 'time_set'
        else 'time_change'
      end as kind
    from public.event_status_history h
    join public.events e on e.id = h.event_id
    where h.changed_at >= now() - lookback
      and e.starts_at > now()
      and (
        h.new_status in ('cancelled', 'postponed')
        or h.old_starts_at is distinct from h.new_starts_at
      )
  ),
  interested as (
    select distinct
      f.user_id,
      c.event_id,
      c.change_log_id,
      c.kind,
      p.email_enabled,
      p.push_enabled
    from unified_changes c
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
      (c.kind = 'cancellation' and p.notify_cancellations)
      or (c.kind in ('time_change', 'time_set') and p.notify_time_changes)
      or (c.kind = 'new_event' and p.notify_new_events)
      or (c.kind = 'participant_update' and p.notify_participant_updates)
      or (c.kind = 'venue_change' and p.notify_venue_changes)
      or (c.kind = 'broadcast_update' and p.notify_broadcast_updates)
    )
  ),
  expanded as (
    select user_id, event_id, change_log_id, kind, 'email'::text as channel
    from interested where email_enabled
    union all
    select user_id, event_id, change_log_id, kind, 'push'
    from interested where push_enabled
  )
  -- Dedup via the existing (user_id, event_id, channel, kind) unique key: one notification per
  -- user/event/kind/channel, so duplicate or dual-source changes never double-send.
  insert into public.notification_deliveries
    (user_id, event_id, change_log_id, channel, kind, scheduled_for)
  select distinct on (user_id, event_id, channel, kind)
    user_id, event_id, change_log_id, channel, kind, now()
  from expanded
  order by user_id, event_id, channel, kind, change_log_id nulls last
  on conflict (user_id, event_id, channel, kind) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.materialize_change_notifications(interval) to service_role;
