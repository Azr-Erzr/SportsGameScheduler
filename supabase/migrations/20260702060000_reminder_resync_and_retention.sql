-- Backend hardening pass #2 (follows 20260701120000_gate_alerts_on_upcoming_events):
--
--   1. materialize_reminders: when an event's kickoff moves AFTER a reminder was queued, the
--      pending row kept its old scheduled_for and fired at the wrong time (or got skipped by the
--      staleness guard when a match moved earlier, silently eating the reminder). The materializer
--      now resyncs pending reminder rows to the current starts_at on every run.
--   2. claim_due_notifications: also skip reminders for cancelled/postponed events ("starts soon"
--      for a cancelled match is exactly the nonsense we're stamping out) and any delivery whose
--      user was deleted (deliveries.user_id is ON DELETE SET NULL, so account deletion used to
--      leave orphan rows that churned as 'failed' at dispatch).
--   3. cleanup_past_events: production data showed a delete/re-ingest churn loop — the nightly
--      job deleted ~3.6k events older than 2 days, then the hydrate crons re-inserted them from
--      provider season feeds within hours WITH NEW IDs, breaking every shared/indexed event URL
--      older than 2 days. Retention moves to 90 days (the hydrate functions gain a matching
--      skip-insert guard for long-past events so nothing bounces back), and postponed events are
--      exempt while they wait for a new date so a reschedule updates the SAME row (stable UID in
--      subscribed calendars) instead of resurrecting as a duplicate.

-- 1. Reminder resync ------------------------------------------------------------------------------
create or replace function public.materialize_reminders(horizon interval default interval '48 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  -- Resync first: pending reminders whose event time moved get their scheduled_for recomputed
  -- from the CURRENT starts_at. Only pending rows — sent history is immutable.
  with resynced as (
    select
      d.id,
      e.starts_at - make_interval(mins => min(ap.remind_minutes_before)) as new_scheduled_for
    from public.notification_deliveries d
    join public.events e on e.id = d.event_id
    join public.user_follows f on f.user_id = d.user_id
    join public.alert_preferences ap
      on ap.user_id = f.user_id
     and ap.target_type = f.target_type
     and ap.target_id = f.target_id
    where d.kind = 'reminder'
      and d.status = 'pending'
      and e.starts_at is not null
      and (
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
    group by d.id, e.starts_at
  )
  update public.notification_deliveries d
  set scheduled_for = r.new_scheduled_for
  from resynced r
  where d.id = r.id
    and d.scheduled_for is distinct from r.new_scheduled_for;

  with due as (
    select
      f.user_id,
      e.id as event_id,
      p.remind_minutes_before,
      p.email_enabled,
      p.push_enabled,
      e.starts_at
    from public.user_follows f
    join public.alert_preferences p
      on p.user_id = f.user_id
     and p.target_type = f.target_type
     and p.target_id = f.target_id
    join public.events e
      on e.starts_at between now() and now() + horizon
     and e.status = 'scheduled'
     and (
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
  ),
  expanded as (
    select user_id, event_id, 'email'::text as channel,
           starts_at - (remind_minutes_before || ' minutes')::interval as scheduled_for
    from due where email_enabled
    union all
    select user_id, event_id, 'push',
           starts_at - (remind_minutes_before || ' minutes')::interval
    from due where push_enabled
  )
  insert into public.notification_deliveries (user_id, event_id, channel, kind, scheduled_for)
  -- min(): a user can match the same event through several follows with different lead times;
  -- pick the earliest deterministically instead of whichever row the planner happened to keep.
  select user_id, event_id, channel, 'reminder', min(scheduled_for)
  from expanded
  where scheduled_for > now()
  group by user_id, event_id, channel
  on conflict (user_id, event_id, channel, kind) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- 2. Claim guard extensions -----------------------------------------------------------------------
create or replace function public.claim_due_notifications(batch_size int default 100)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Orphans first: the delivery's user was deleted (user_id ON DELETE SET NULL).
  update public.notification_deliveries
  set status = 'skipped', error = 'Recipient account deleted'
  where status = 'pending' and scheduled_for <= now() and user_id is null;

  -- Stale rows: nothing goes out for an event that started/finished, reminders keep a 15-minute
  -- post-kickoff grace for cron lag, and reminders for cancelled/postponed events never send
  -- (the cancellation alert is the one that should reach the user, not "starts soon").
  update public.notification_deliveries d
  set status = 'skipped',
      error = 'Stale at claim time: event started, finished, cancelled, or postponed'
  from public.events e
  where e.id = d.event_id
    and d.status = 'pending'
    and d.scheduled_for <= now()
    and (
      e.status = 'finished'
      or (d.kind <> 'reminder' and e.starts_at is not null and e.starts_at <= now())
      or (d.kind = 'reminder' and e.starts_at is not null and e.starts_at <= now() - interval '15 minutes')
      or (d.kind = 'reminder' and e.status in ('cancelled', 'postponed'))
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

-- 3. Retention: stop the churn, keep permalinks alive, protect postponed events -------------------
create or replace function public.cleanup_past_events(retention interval default interval '90 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.events
  where starts_at is not null
    and starts_at < (now() - retention)
    -- A postponed event's starts_at is its OLD (past) slot; keep the row so the reschedule
    -- updates it in place (same id/UID) rather than resurfacing as a duplicate. Genuinely
    -- abandoned postponements age out after a year.
    and (status <> 'postponed' or starts_at < (now() - interval '365 days'));
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Point the nightly job at the new default retention.
select cron.alter_job(
  6,
  command := $cmd$ select public.cleanup_past_events(); $cmd$
);
