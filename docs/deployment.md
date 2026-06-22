# Silbo Deployment (Cloudflare Pages + Supabase)

Last updated: June 17, 2026

The app is a Vite SPA hosted on **Cloudflare Pages**; the backend is **Supabase** (Postgres +
edge functions + cron). This documents how a push to `main` becomes a live deploy and the config
that must be in place.

## Frontend — Cloudflare Pages

### Build settings (Pages → project → Settings → Builds)
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node version:** 20 (set `NODE_VERSION=20` env if needed)

### Required build-time env vars (Pages → Settings → Environment variables)
These are `VITE_`-prefixed, so they're inlined at build time and safe for the browser (the
Supabase key is the publishable/anon key; RLS protects data):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_ADSENSE_CLIENT` (optional — activates ads; see monetization doc)
- `VITE_AFFILIATE_*` (optional — per approved affiliate program)

### SPA fallback + headers (shipped)
`wrangler.jsonc` uses Cloudflare Workers Static Assets with
`not_found_handling = "single-page-application"` so deep links and hard refreshes resolve to the
app shell instead of 404. **Without this, `/events/:id`, `/s/:token`, etc. break on direct load**
-- required for shareable links, calendar "View" links, and SEO.

`public/_headers` ships conservative hardening headers plus immutable cache headers for
fingerprinted Vite assets. Keep `index.html` off immutable caching so new deploys propagate.

### Deploy trigger — two options
1. **Native Git integration (recommended, likely current setup):** connect the GitHub repo in the
   Cloudflare Pages dashboard. Every push to `main` auto-builds + deploys; PRs get preview URLs.
   No GitHub Actions needed. This is the simplest and avoids double-deploys.
2. **CI-driven (optional):** if you prefer deploys to run from GitHub Actions (e.g., to gate on
   the existing CI), add the workflow below and set repo secrets `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID`. **Use only one** of these two options, not both.

```yaml
# .github/workflows/deploy.yml  (enable only if NOT using Pages git-integration)
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=silbo-sports
```

CI (lint + test + build) already runs on every push/PR via `.github/workflows/ci.yml` and is
independent of the deploy path.

## Backend — Supabase
- Migrations live in `supabase/migrations/` and are applied to project `gcnbgdpicgeahxscpsfc`.
- Edge functions in `supabase/functions/` (calendar-feed, notifications, provider-hydrate,
  provider-hydrate-players, provider-sync, ics-feed-ingest, admin-stats) deploy via the Supabase
  MCP / CLI.
- **`calendar-feed` MUST be deployed with `verify_jwt = false`.** It's the public subscription
  endpoint — Google/Apple/Outlook fetch the `.ics` URL with **no Authorization header**, so with
  `verify_jwt = true` the gateway returns `401 UNAUTHORIZED_NO_AUTH_HEADER` and live sync is dead.
  Auth is the unguessable URL token (resolved server-side) + a 120-req/min per-token+IP rate limit
  (`_shared/rate-limit.ts`). Keep verify_jwt off on any redeploy.
- Cron jobs (`supabase/cron.sql`): provider-hydrate (15 min), players (3×/hr), notifications
  (5 min), **ics-feed-ingest (every 6 h, `17 */6 * * *`)** — the non-API ICS/webcal source
  re-check. The function gates each `source_targets` row by its own `cadence_minutes` (12–24 h for
  the seeded feeds), so the cron is only a heartbeat and never hammers the sources.
- **Secrets** (Supabase → Settings → Edge Functions): `THESPORTSDB_API_KEY`, `ADMIN_EMAILS`, and
  for live alerts: `RESEND_API_KEY` or the existing `RESENDAPI` alias + `EMAIL_FROM` + `APP_URL`
  + `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT`.

Run `npm run verify:prod` locally or in CI before launch. It checks the domain lock, required
build env, Supabase function secrets, VAPID/Resend readiness, asset headers, and SPA fallback.

## Pre-launch checklist
- [ ] Domain lock: production is `https://silbosports.com`; keep `seo.ts` `SEO_ORIGIN`, sitemap,
      robots, email links, calendar links, and Edge Function `APP_URL` on that domain.
- [ ] Confirm Pages env vars are set (above) so the deployed build talks to Supabase.
- [ ] Add a 1200×630 `public/og-cover.png` (referenced by OG/Twitter tags).
- [ ] Verify Workers Static Assets SPA fallback is active in the deployed Worker.
- [ ] Cloudflare WAF: add a rate-limiting rule on `/* ` or the Supabase functions domain (see
      Admin/observability doc) rather than a custom limiter.
- [ ] Legal/footer lock: Terms, Privacy, contact, and unsubscribe/alert-management links are live
      before email alerts are enabled.
