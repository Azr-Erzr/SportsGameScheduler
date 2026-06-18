-- Aggregated observability snapshot for the admin dashboard. Not granted to anon/authenticated;
-- only the admin-stats edge function (service role, after an allowlist check) calls it.
create or replace function public.admin_overview()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'events', (select count(*) from events),
      'upcoming_events', (select count(*) from events where starts_at >= now() and status <> 'finished'),
      'leagues', (select count(*) from leagues),
      'competitors', (select count(*) from competitors),
      'custom_leagues', (select count(*) from custom_leagues),
      'calendar_feeds', (select count(*) from calendar_feeds),
      'user_follows', (select count(*) from user_follows)
    ),
    'sports', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object(
          'sport', s.key,
          'leagues', count(distinct l.id),
          'events', count(distinct e.id),
          'upcoming', count(distinct e.id) filter (where e.starts_at >= now() and e.status <> 'finished')
        ) as x
        from sports s
        left join leagues l on l.sport_id = s.id
        left join events e on e.sport_id = s.id
        group by s.key
        order by count(distinct e.id) desc
      ) t
    ),
    'targets', (
      select jsonb_build_object(
        'active', count(*) filter (where is_active),
        'inactive', count(*) filter (where not is_active),
        'errored', count(*) filter (where last_status ilike '%fail%' or last_status = 'error')
      ) from provider_targets
    ),
    'recent_runs', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select jsonb_build_object(
          'status', status,
          'fetched', fetched_count,
          'changed', changed_count,
          'finished_at', finished_at,
          'error', error
        ) as r
        from provider_sync_runs
        order by coalesce(finished_at, started_at) desc
        limit 10
      ) t2
    )
  );
$$;
