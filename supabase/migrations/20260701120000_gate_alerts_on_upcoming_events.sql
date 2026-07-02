-- Never alert on events that have already started or finished.
--
-- Root cause of the "Venue update: England vs DR Congo" email sent at 23:45 UTC on 2026-07-01,
-- 7h45m after kickoff with the match already status='finished': provider feeds keep correcting
-- data on concluded events (venue re-mapping churn is common, especially MLB), the events trigger
-- logged those venue changes with 'notify' significance regardless of event state, and
-- materialize_change_notifications' primary (event_change_log) path had no upcoming-event filter —
-- only the legacy event_status_history path checked e.starts_at > now().
--
-- Fix in three independent layers, so no single regression can reintroduce the bug:
--   1. capture_event_change(): changes on started/finished events are logged with 'calendar'
--      significance (audit trail preserved) instead of 'notify'.
--   2. materialize_change_notifications(): only materializes deliveries for events that have not
--      started (null starts_at allowed — a TBD event is still upcoming) and are not finished.
--      Cancellations still notify because a cancelled future event has starts_at > now().
--   3. claim_due_notifications(): final send-time guard — pending rows whose event has since
--      started/finished are marked 'skipped' instead of dispatched. Reminders get a 15-minute
--      post-kickoff grace so ordinary cron lag never drops a legitimate reminder.

-- 1. Trigger: demote change capture to 'calendar' once an event has started/finished -------------
create or replace function public.capture_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- An event is still alertable while it hasn't kicked off and isn't finished. Null starts_at
  -- means the fixture is TBD, which is upcoming by definition.
  alertable boolean := new.status <> 'finished'
    and (new.starts_at is null or new.starts_at > now());
begin
  begin
    -- Cancellation / postponement.
    if new.status is distinct from old.status and new.status in ('cancelled', 'postponed') then
      insert into public.event_change_log (event_id, change_type, significance, old_value, new_value, source)
      values (
        new.id,
        'cancellation',
        case when new.starts_at is null or new.starts_at > now() then 'notify' else 'calendar' end,
        to_jsonb(old.status),
        to_jsonb(new.status),
        'trigger'
      );
    end if;

    -- Kickoff time set or moved. Notify only when the NEW time is upcoming (a reschedule from a
    -- past slot to a future one is a legitimate alert) and the event isn't already finished.
    if new.starts_at is distinct from old.starts_at
       and new.starts_at is not null
       and new.starts_at > now() then
      insert into public.event_change_log (event_id, change_type, significance, old_value, new_value, source)
      values (
        new.id,
        case when old.starts_at is null then 'time_set' else 'time_change' end,
        case when new.status <> 'finished' then 'notify' else 'calendar' end,
        to_jsonb(old.starts_at),
        to_jsonb(new.starts_at),
        'trigger'
      );
    end if;

    -- Venue moved (both sides known — ignore initial venue assignment). Feed corrections on
    -- concluded games are recorded but must never notify.
    if new.venue_id is distinct from old.venue_id
       and new.venue_id is not null
       and old.venue_id is not null then
      insert into public.event_change_log (event_id, change_type, significance, old_value, new_value, source)
      values (
        new.id,
        'venue_change',
        case when alertable then 'notify' else 'calendar' end,
        to_jsonb(old.venue_id),
        to_jsonb(new.venue_id),
        'trigger'
      );
    end if;
  exception when others then
    -- Change capture is best-effort and must never abort the underlying event write.
    null;
  end;
  return null;
end;
$$;

-- 2. Materializer: only queue deliveries for upcoming events -------------------------------------
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
    -- Never queue an alert for an event that has already started or finished. Null starts_at is
    -- an upcoming TBD fixture. A cancelled future event still notifies (starts_at > now()); a
    -- correction landing after kickoff does not, regardless of which source path produced it.
    where e.status <> 'finished'
      and (e.starts_at is null or e.starts_at > now())
      and (
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
  select distinct on (user_id, event_id, channel, kind)
    user_id, event_id, change_log_id, channel, kind, now()
  from expanded
  order by user_id, event_id, channel, kind, change_log_id nulls last
  on conflict (user_id, event_id, channel, kind) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- 3. Claim: final send-time guard ----------------------------------------------------------------
-- Whatever slipped into the queue, nothing goes out for an event that has since started/finished.
-- Reminders keep a 15-minute grace after kickoff so a delayed cron run still delivers them.
create or replace function public.claim_due_notifications(batch_size int default 100)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_deliveries d
  set status = 'skipped',
      error = 'Stale at claim time: event already started or finished'
  from public.events e
  where e.id = d.event_id
    and d.status = 'pending'
    and d.scheduled_for <= now()
    and (
      e.status = 'finished'
      or (d.kind <> 'reminder' and e.starts_at is not null and e.starts_at <= now())
      or (d.kind = 'reminder' and e.starts_at is not null and e.starts_at <= now() - interval '15 minutes')
    );

  return query
  update public.notification_deliveries d
  set status = 'sending'
  where d.id in (
    select id from public.notification_deliveries
    where status = 'pending' and scheduled_for <= now()
    order by scheduled_for
    limit batch_size
    for update skip locked
  )
  returning d.*;
end;
$$;
