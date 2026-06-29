-- Silbo Sports blog: data-driven, same-domain articles that link back to schedule pages.
-- Posts are authored as drafts (by a human or the Claude-API draft generator) and only become
-- publicly readable once status = 'published'. Each post can reference a real event so the
-- "catch the game" CTA renders accurate time/where-to-watch from live data.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  dek text,                                   -- short standfirst / excerpt shown in listings
  body_markdown text not null default '',
  hero_image_url text,
  sport_key text,                             -- canonical sport key, for theming + related links
  related_event_id uuid references public.events(id) on delete set null,
  seo_description text,
  author text not null default 'Silbo Sports',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Listing query is "published, newest first".
create index if not exists blog_posts_published_idx
  on public.blog_posts (published_at desc)
  where status = 'published';

alter table public.blog_posts enable row level security;

-- Public (anon) read is limited to published posts; drafts stay invisible to the frontend.
-- Authoring/editing happens via the service role (generator script / admin), which bypasses RLS.
drop policy if exists "blog_posts public read published" on public.blog_posts;
create policy "blog_posts public read published"
  on public.blog_posts
  for select
  using (status = 'published');

-- Keep updated_at fresh on every write.
create or replace function public.touch_blog_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists blog_posts_touch_updated_at on public.blog_posts;
create trigger blog_posts_touch_updated_at
  before update on public.blog_posts
  for each row execute function public.touch_blog_posts_updated_at();
