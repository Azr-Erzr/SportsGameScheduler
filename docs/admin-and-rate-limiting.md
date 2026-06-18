# Admin Dashboard + Rate Limiting

Last updated: June 17, 2026

## Admin dashboard (`/admin`)

A read-only observability view: totals, coverage-by-sport, hydration-target health, and recent
provider sync runs.

### How it works (secure path)
The dashboard never reads internal tables from the browser. Instead:
1. `/admin` (`src/pages/AdminPage.tsx`) calls the **`admin-stats` edge function** with the signed-in
   user's JWT (via `supabase.functions.invoke`).
2. `admin-stats` resolves the JWT to a user and checks their email against the **`ADMIN_EMAILS`**
   secret (comma-separated allowlist). Non-admins get `403`; signed-out callers get `401`.
3. Only then does it run `admin_overview()` (a `SECURITY DEFINER` SQL function, not granted to
   anon/authenticated) with the service role and return the JSON snapshot.

So `provider_sync_runs`, `provider_targets`, and raw counts are never exposed publicly — verified:
calling `admin-stats` with the anon JWT returns `{"error":"unauthorized"}`.

### Enabling it
- Set the **`ADMIN_EMAILS`** secret on the Supabase project (Settings → Edge Functions), e.g.
  `ADMIN_EMAILS=azharmoolla@gmail.com`. With it empty, everyone gets 403 (safe default).
- Sign in with that email and open `/admin`. (The route is intentionally unlinked in the nav.)

### Future
- Add per-target last-error drill-down and a "re-run hydrate" button (calls provider-hydrate).
- Add a `role` column / `profiles.is_admin` flag instead of an env allowlist once there are
  multiple admins.

## Rate limiting

The public attack surface is small and already defensive, so the right tool is **Cloudflare's
edge rate limiting**, not a custom in-app limiter (which would add latency and run after the
request already hit us).

### Current posture
- **`calendar-feed`** (the only public, no-JWT function): token-gated (unguessable hashed token)
  and `Cache-Control: public, max-age=300`, so repeat polls are served from Cloudflare's CDN, not
  recomputed.
- **`admin-stats`, `notifications`, `provider-hydrate*`, `provider-sync`**: `verify_jwt = true`
  (admin-stats additionally allowlist-gated; the hydrate/notify functions are cron-invoked).
- Supabase enforces baseline platform limits; PostgREST reads are RLS-gated.

### Recommended Cloudflare rules (dashboard → Security → WAF → Rate limiting)
1. **Feed abuse:** on `*.functions.supabase.co/calendar-feed/*` (or your proxied path), limit to
   ~60 requests/min per IP → block/challenge. Calendar apps poll on their own slow schedule, so
   this is generous.
2. **App-wide:** on the Pages domain, a broad rule (~600 req/min per IP) to absorb scrapers.
3. **Bot Fight Mode** on, and a challenge for unauthenticated POSTs to `/functions/v1/*` if abuse
   appears.

### Why not in-app
A Deno/edge limiter would need shared state (KV/Redis) and still let the request reach the
function. Cloudflare blocks at the edge before it costs us anything, and it's config not code.
Revisit an app-level token-bucket only if a specific endpoint needs per-user (not per-IP) limits.
