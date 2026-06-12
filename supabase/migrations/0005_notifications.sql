-- Notifications: Email + Web Push (plan Objective 10, with review fixes:
-- channel-agnostic queue, idempotent materialization, atomic claiming).

create table public.alert_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  email_enabled boolean not null default true,
  push_enabled boolean not null default false,
  remind_minutes_before integer not null default 60,
  notify_time_changes boolean not null default true,
  notify_cancellations boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_id uuid references public.events(id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  kind text not null check (kind in ('reminder', 'time_change', 'cancellation', 'new_event')),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  error text,
  -- Idempotency: re-running the materializer never double-queues.
  unique (user_id, event_id, channel, kind)
);

create index notification_deliveries_due_idx
  on public.notification_deliveries (scheduled_for)
  where status = 'pending';

alter table public.alert_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

create policy "users manage their alert preferences" on public.alert_preferences
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users read their deliveries" on public.notification_deliveries
  for select to authenticated using (auth.uid() = user_id);

-- Atomic claim: FOR UPDATE SKIP LOCKED means overlapping cron runs never double-send.
create or replace function public.claim_due_notifications(batch_size int default 100)
returns setof public.notification_deliveries
language sql
security definer
set search_path = public
as $$
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
$$;

-- Materializer: expands (alert prefs x followed upcoming events) into queue rows.
-- ON CONFLICT DO NOTHING + the unique constraint keep it idempotent.
create or replace function public.materialize_reminders(horizon interval default interval '48 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
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
  select user_id, event_id, channel, 'reminder', scheduled_for
  from expanded
  where scheduled_for > now()
  on conflict (user_id, event_id, channel, kind) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
