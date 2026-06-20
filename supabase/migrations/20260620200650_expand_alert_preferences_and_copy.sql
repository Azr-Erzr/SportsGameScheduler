-- Expand Silbo Alerts from generic reminders/change notices into real user-selectable
-- notification classes. These columns are additive so existing users keep their current
-- reminder/time/cancellation behavior and opt into the richer schedule-change defaults.

alter table public.alert_preferences
  add column if not exists notify_new_events boolean not null default true,
  add column if not exists notify_participant_updates boolean not null default true,
  add column if not exists notify_venue_changes boolean not null default true,
  add column if not exists notify_broadcast_updates boolean not null default true;

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

-- New Supabase projects may require explicit grants before public tables are visible to the
-- auto-generated Data API. RLS still controls rows.
grant select, insert, update, delete on public.alert_preferences to authenticated;
grant select on public.notification_deliveries to authenticated;

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
    select
      c.id as change_log_id,
      c.event_id,
      case
        when c.change_type in ('cancellation', 'postponement') then 'cancellation'
        when c.change_type in ('time_set') then 'time_set'
        when c.change_type in ('time_change', 'kickoff_change', 'start_time_change') then 'time_change'
        when c.change_type in ('participant_set', 'participant_update', 'bracket_slot_set', 'draw_set') then 'participant_update'
        when c.change_type in ('venue_set', 'venue_change') then 'venue_change'
        when c.change_type in ('broadcast_set', 'broadcast_update', 'watch_link_update') then 'broadcast_update'
        when c.change_type = 'new_event' then 'new_event'
        else 'time_change'
      end as kind,
      c.created_at
    from public.event_change_log c
    where c.significance = 'notify'
      and c.created_at >= now() - lookback

    union all

    -- Compatibility path for older sync functions that still write event_status_history.
    select
      null::uuid as change_log_id,
      h.event_id,
      case
        when h.new_status in ('cancelled', 'postponed') then 'cancellation'
        when h.old_starts_at is null and h.new_starts_at is not null then 'time_set'
        when h.old_starts_at is distinct from h.new_starts_at then 'time_change'
        else 'time_change'
      end as kind,
      h.changed_at as created_at
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
            select 1
            from public.event_competitors ec
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
  insert into public.notification_deliveries
    (user_id, event_id, change_log_id, channel, kind, scheduled_for)
  select user_id, event_id, change_log_id, channel, kind, now()
  from expanded
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
