-- Security hardening: SECURITY DEFINER functions get a default PUBLIC execute grant, which
-- exposes them via PostgREST (/rest/v1/rpc/...). Lock them to the roles that should call them.
-- (Flagged by the Supabase security advisor after 20260622090000.)

-- Trigger-only function: never callable via the API. Triggers fire regardless of EXECUTE grants.
revoke all on function public.capture_event_change() from public, anon, authenticated;

-- Materializer: only the notifications cron/edge function (service role) should run it; anon must
-- not be able to force notification fan-out.
revoke all on function public.materialize_change_notifications(interval) from public, anon, authenticated;
grant execute on function public.materialize_change_notifications(interval) to service_role;

-- Admin overview exposes provider/source diagnostics; keep it off the anon role.
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated, service_role;
