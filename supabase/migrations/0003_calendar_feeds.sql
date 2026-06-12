-- Live subscribed calendar feeds (plan Objective 6).
-- The feed URL embeds an unguessable token; the calendar-feed Edge Function resolves it with
-- the service role, so no anon read policy is needed here.

create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  token text not null unique,
  name text not null,
  timezone text not null,
  filters jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index calendar_feeds_user_idx on public.calendar_feeds (user_id);

alter table public.calendar_feeds enable row level security;

create policy "users manage their calendar feeds" on public.calendar_feeds
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
