-- Auto-delete past events (no results/archive feature, so finished events are pure storage cost).
-- Every events child FK is ON DELETE CASCADE or SET NULL (broadcasts, event_competitors,
-- event_change_log, notification_deliveries, watch_links, spotlight_events, …), so a plain delete
-- cleans up safely. TBD/placeholder rows (starts_at is null) are kept — they're future knockout
-- slots, not past games. Scheduled daily via supabase/cron.sql ('cleanup-past-events').

create or replace function public.cleanup_past_events(retention interval default interval '2 days')
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
    and starts_at < (now() - retention);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Definer function: only the scheduler/service role should run it (matches the lock-down-grants
-- migration's posture). No client role may call it.
revoke all on function public.cleanup_past_events(interval) from public;
revoke all on function public.cleanup_past_events(interval) from anon;
revoke all on function public.cleanup_past_events(interval) from authenticated;
