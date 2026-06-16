-- Align calendar_feeds with the calendar-feed function: hashed token (capability URL that a
-- DB leak can't reuse), feed options, and access tracking.

alter table public.calendar_feeds add column if not exists token_hash text;
alter table public.calendar_feeds add column if not exists include_placeholders boolean not null default false;
alter table public.calendar_feeds add column if not exists include_broadcasts boolean not null default false;
alter table public.calendar_feeds add column if not exists last_accessed_at timestamptz;

-- Backfill hash from any existing plaintext tokens, then stop depending on plaintext.
update public.calendar_feeds
set token_hash = encode(digest(token, 'sha256'), 'hex')
where token_hash is null and token is not null;

-- Plaintext token is no longer the source of truth; allow it to be null going forward.
alter table public.calendar_feeds alter column token drop not null;

create unique index if not exists calendar_feeds_token_hash_idx on public.calendar_feeds (token_hash);
