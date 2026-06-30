# Silbo Deployment (Cloudflare Pages + Supabase)

Last updated: June 30, 2026

The app is a Vite SPA hosted on Cloudflare Pages/Workers Static Assets; the backend is Supabase
(Postgres, Edge Functions, and cron). This documents how a push to `main` becomes a live deploy and
the config that must be in place.

## Frontend - Cloudflare Pages

### Build settings

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 22

### Required build-time env vars

These are `VITE_`-prefixed, so they are inlined at build time and safe for the browser. The Supabase
key is the publishable key; RLS protects the data.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_ADSENSE_CLIENT` (optional; activates ads)
- `VITE_AFFILIATE_*` (optional; per approved affiliate program)

The Worker also keeps the public Supabase URL/key in `wrangler.jsonc`. The local verification
scripts read those values as a fallback, so CI and scheduled monitors do not need private secrets for
public live-data checks.

### SPA fallback and headers

`wrangler.jsonc` uses Cloudflare Workers Static Assets with
`not_found_handling = "single-page-application"` so deep links and hard refreshes resolve to the app
shell instead of 404. Without this, `/events/:id`, `/s/:token`, and similar routes break on direct
load.

`public/_headers` ships conservative hardening headers plus immutable cache headers for
fingerprinted Vite assets. Keep `index.html` off immutable caching so new deploys propagate.

### Deploy trigger

Native Git integration is the recommended deploy path: connect the GitHub repo in Cloudflare Pages.
Every push to `main` auto-builds and deploys; PRs get preview URLs. Avoid running a second deploy
workflow unless Cloudflare Git integration is intentionally disabled.

CI (`.github/workflows/ci.yml`) already runs lint, tests, e2e smoke, and build on push/PR.
`npm run build` runs strict live-data verification before Vite bundles, so a deploy with empty
critical schedules fails before publishing.

`.github/workflows/live-data-monitor.yml` runs `npm run verify:live-data -- --strict` twice an hour
and on manual dispatch. A failed scheduled run should be treated as a production incident: check
Supabase RLS, provider cron, source freshness, and recent migrations before pushing unrelated UI
changes.

## Backend - Supabase

- Project ref: `gcnbgdpicgeahxscpsfc`
- Migrations live in `supabase/migrations/`.
- Edge functions live in `supabase/functions/`.
- Cron definitions live in `supabase/cron.sql`.

Active functions:

- `calendar-feed`
- `delete-account`
- `provider-sync`
- `provider-hydrate`
- `provider-hydrate-players`
- `provider-hydrate-apisports`
- `provider-hydrate-apisports-f1`
- `provider-hydrate-pandascore`
- `ics-feed-ingest`
- `notifications`
- `admin-stats`

Important function posture:

- `delete-account` must keep JWT verification on. It reads the caller from their access token, then
  uses the service role to delete the user.
- `calendar-feed` must keep `verify_jwt = false`. Calendar clients fetch `.ics` URLs without
  authorization headers. Auth is the unguessable feed token plus rate limiting.
- `admin-stats` must remain the only public path to admin overview data; the underlying
  `admin_overview()` RPC is service-role only.

Supabase Edge Function secrets:

- `THESPORTSDB_API_KEY`
- `ADMIN_EMAILS` - currently `azharmoolla@gmail.com`
- `RESEND_API_KEY` or legacy `RESENDAPI`
- `EMAIL_FROM`
- `APP_URL`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Run `npm run verify:prod` locally before launch or after secret changes. It checks the domain lock,
required build env, deployed Supabase function secrets, VAPID/Resend readiness, asset headers, and
SPA fallback.

## Pre-launch checklist

- [ ] Keep production domain locked to `https://silbosports.com` across SEO, sitemap, robots,
      email links, calendar links, and Edge Function `APP_URL`.
- [ ] Confirm Pages env vars are set so the deployed build talks to Supabase.
- [ ] Keep `public/og-cover.png` generated for social cards.
- [ ] Verify Workers Static Assets SPA fallback is active in the deployed Worker.
- [ ] Keep Cloudflare WAF/rate-limit rules active for public app and Supabase function surfaces.
- [ ] Keep Terms, Privacy, contact, and unsubscribe/alert-management links live before email alerts
      are broadly enabled.
- [ ] Keep AdSense/advertising scripts gated behind consent.
- [ ] Keep the `delete-account` Edge Function deployed so account deletion works.
