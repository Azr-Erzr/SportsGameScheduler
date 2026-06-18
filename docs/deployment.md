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

### SPA fallback (shipped)
`public/_redirects` contains `/*  /index.html  200` so deep links and hard refreshes resolve to
the app shell instead of 404. **Without this, `/events/:id`, `/s/:token`, etc. break on direct
load** — required for shareable links, calendar "View" links, and SEO.

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
  provider-hydrate-players, provider-sync) deploy via the Supabase MCP / CLI.
- Cron jobs (`supabase/cron.sql`): provider-hydrate (15 min), players (3×/hr), notifications
  (5 min).
- **Secrets** (Supabase → Settings → Edge Functions): `THESPORTSDB_API_KEY` (set), and for live
  email: `RESEND_API_KEY` + `EMAIL_FROM` + `APP_URL` (pending).

## Pre-launch checklist
- [ ] Reconcile the public domain: `silbosports.com` (SEO/canonical/sitemap) vs `silbosports.app`
      (edge `APP_URL`). Pick one; set it in index.html, `seo.ts` `SEO_ORIGIN`, sitemap, robots,
      and edge `APP_URL`.
- [ ] Confirm Pages env vars are set (above) so the deployed build talks to Supabase.
- [ ] Add a 1200×630 `public/og-cover.png` (referenced by OG/Twitter tags).
- [ ] Verify `_redirects` is in the deployed output (`dist/_redirects`).
- [ ] Cloudflare WAF: add a rate-limiting rule on `/* ` or the Supabase functions domain (see
      Admin/observability doc) rather than a custom limiter.
