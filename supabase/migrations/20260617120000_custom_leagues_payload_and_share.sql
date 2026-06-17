-- Server-backed custom leagues. Teams + events live in a JSONB payload on the league row (a 1:1
-- match for the app's local model), avoiding the friction of forcing community events through the
-- generic, n-ary, NOT-NULL-sport events table. Owners manage their own rows via existing RLS;
-- the public share page reads through a SECURITY DEFINER resolver gated on share_enabled.

alter table public.custom_leagues
  add column if not exists share_enabled boolean not null default true,
  add column if not exists include_notes_in_share boolean not null default false,
  add column if not exists payload jsonb not null default '{}'::jsonb;

drop function if exists public.get_shared_league(text);

create function public.get_shared_league(share_token text)
returns table (
  id uuid,
  name text,
  timezone text,
  location text,
  sport_key text,
  include_notes_in_share boolean,
  payload jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.name,
    l.timezone,
    l.location,
    coalesce((select s.key from public.sports s where s.id = l.sport_id), (l.payload->>'sportKey'), 'custom') as sport_key,
    l.include_notes_in_share,
    l.payload
  from public.custom_leagues l
  where l.public_token = share_token
    and l.share_enabled = true;
$$;

grant execute on function public.get_shared_league(text) to anon, authenticated;
