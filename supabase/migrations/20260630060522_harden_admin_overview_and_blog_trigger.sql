-- MP5 audit hardening:
-- 1. admin_overview() is only intended to run behind the admin-stats Edge Function,
--    after that function validates the caller against ADMIN_EMAILS. Keep direct RPC
--    execution service-role only so authenticated users cannot bypass that allowlist.
-- 2. The blog updated_at trigger does not use dynamic SQL, but setting an explicit
--    search_path closes the Supabase advisor warning and future-proofs the function.

revoke all on function public.admin_overview() from public, anon, authenticated;
grant execute on function public.admin_overview() to service_role;

alter function public.touch_blog_posts_updated_at()
  set search_path = public, pg_temp;
