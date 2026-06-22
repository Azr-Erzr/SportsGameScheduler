-- MP4 new-queue #2: source/provider observability on /admin.
-- Adds last_changed_at + terms_note to admin_overview()'s source_targets.recent slice so the admin
-- dashboard can show when each feed was last checked vs last changed, plus its source-terms note.
-- (create-or-replace preserves the anon-revoked grant from 20260622091500.)

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
      'user_follows', (select count(*) from user_follows),
      'source_targets', (select count(*) from source_targets),
      'watch_links', (select count(*) from watch_links where is_active),
      'competition_instances', (select count(*) from competition_instances where is_active)
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
    'spotlight', (
      select jsonb_build_object(
        'competition_instances', (select count(*) from competition_instances where is_active),
        'static_cards', (select count(*) from spotlight_events where is_active),
        'top', coalesce((
          select jsonb_agg(r) from (
            select jsonb_build_object(
              'title', title,
              'sport_key', sport_key,
              'label', label,
              'lifecycle', lifecycle,
              'template_slug', template_slug,
              'ranking_score', ranking_score
            ) as r
            from spotlight_ranked(null, 8)
          ) spotlight_rows
        ), '[]'::jsonb)
      )
    ),
    'targets', (
      select jsonb_build_object(
        'active', count(*) filter (where is_active),
        'inactive', count(*) filter (where not is_active),
        'errored', count(*) filter (where last_status ilike '%fail%' or last_status = 'error' or last_status ilike '%error%'),
        'stale', count(*) filter (
          where is_active
            and coalesce(next_synced_at, events_synced_at, teams_synced_at, verified_at) < now() - interval '36 hours'
        )
      ) from provider_targets
    ),
    'provider_targets', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object(
          'provider_key', provider_key,
          'active', count(*) filter (where is_active),
          'errored', count(*) filter (where last_status ilike '%fail%' or last_status = 'error' or last_status ilike '%error%'),
          'stale', count(*) filter (
            where is_active
              and coalesce(next_synced_at, events_synced_at, teams_synced_at, verified_at) < now() - interval '36 hours'
          ),
          'last_checked_at', max(coalesce(next_synced_at, events_synced_at, teams_synced_at, verified_at)),
          'last_error', max(last_error) filter (where last_error is not null)
        ) as x
        from provider_targets
        group by provider_key
        order by provider_key
      ) t_provider
    ),
    'source_targets', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where is_active),
        'dry_run', count(*) filter (where dry_run),
        'errored', count(*) filter (where last_status ilike '%fail%' or last_status = 'error' or last_error is not null),
        'recent', coalesce((
          select jsonb_agg(r) from (
            select jsonb_build_object(
              'target_key', target_key,
              'sport_key', sport_key,
              'dry_run', dry_run,
              'last_status', last_status,
              'last_checked_at', last_checked_at,
              'last_changed_at', last_changed_at,
              'last_error', last_error,
              'terms_note', terms_note
            ) as r
            from source_targets
            order by coalesce(last_checked_at, created_at) desc
            limit 8
          ) recent_rows
        ), '[]'::jsonb)
      )
      from source_targets
    ),
    'watch', (
      select jsonb_build_object(
        'providers', (select count(*) from watch_providers where is_active),
        'active_links', (select count(*) from watch_links where is_active),
        'pending_affiliates', (select count(*) from watch_providers where is_active and affiliate_status = 'pending'),
        'approved_affiliates', (select count(*) from watch_providers where is_active and affiliate_status = 'approved')
      )
    ),
    'recent_runs', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select jsonb_build_object(
          'provider_key', provider_key,
          'sport_key', sport_key,
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
