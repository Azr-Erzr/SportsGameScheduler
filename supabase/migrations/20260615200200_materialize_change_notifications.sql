-- Bridges the hydrator's diff log (event_status_history) to the notification queue.
-- For each recent change to a future event that a user follows (with the relevant alert
-- toggle on), enqueue an immediate delivery. The unique(user_id,event_id,channel,kind)
-- constraint makes this idempotent across overlapping cron runs and acts as the watermark.

create or replace function public.materialize_change_notifications(lookback interval default interval '2 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  with changes as (
    select distinct on (h.event_id)
      h.event_id,
      e.starts_at,
      e.sport_id,
      e.league_id,
      e.custom_league_id,
      h.old_status, h.new_status,
      h.old_starts_at, h.new_starts_at,
      case
        when h.new_status in ('cancelled','postponed') then 'cancellation'
        when h.old_starts_at is distinct from h.new_starts_at then 'time_change'
        else null
      end as change_kind
    from public.event_status_history h
    join public.events e on e.id = h.event_id
    where h.changed_at >= now() - lookback
      and e.starts_at > now()
    order by h.event_id, h.changed_at desc
  ),
  classified as (
    select * from changes where change_kind is not null
  ),
  matched as (
    select
      f.user_id,
      c.event_id,
      c.change_kind,
      p.email_enabled,
      p.push_enabled
    from classified c
    join public.user_follows f
      on (
           (f.target_type = 'sport' and f.target_id = c.sport_id)
        or (f.target_type = 'league' and f.target_id = c.league_id)
        or (f.target_type = 'custom_league' and f.target_id = c.custom_league_id)
        or (f.target_type in ('team','competitor','player')
            and exists (select 1 from public.event_competitors ec
                        where ec.event_id = c.event_id and ec.competitor_id = f.target_id))
      )
    join public.alert_preferences p
      on p.user_id = f.user_id
     and p.target_type = f.target_type
     and p.target_id = f.target_id
     and (
          (c.change_kind = 'time_change'  and p.notify_time_changes)
       or (c.change_kind = 'cancellation' and p.notify_cancellations)
     )
  ),
  expanded as (
    select user_id, event_id, change_kind, 'email'::text as channel from matched where email_enabled
    union all
    select user_id, event_id, change_kind, 'push' from matched where push_enabled
  )
  insert into public.notification_deliveries (user_id, event_id, channel, kind, scheduled_for)
  select user_id, event_id, channel, change_kind, now()
  from expanded
  on conflict (user_id, event_id, channel, kind) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
