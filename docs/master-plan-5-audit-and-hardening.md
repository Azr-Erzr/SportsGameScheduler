# Master Plan 5: Full-Site Audit And Hardening

Last audited: 2026-06-30, America/Toronto.

## Executive Snapshot

The site is currently buildable, hydrated, and testable. The most important production guard is working: `npm run build` runs strict live-data verification before Vite bundles, so a deploy with empty critical schedules should fail instead of silently publishing a dead app.

Completed in this MP5 pass:

- Hardened `public.admin_overview()` so only `service_role` can execute it directly; the public admin screen still goes through the `admin-stats` Edge Function allowlist check.
- Set an explicit `search_path` on `public.touch_blog_posts_updated_at()`.
- Set deployed `ADMIN_EMAILS=azharmoolla@gmail.com`.
- Updated `verify:prod` so it can prove deployed Supabase secret names exist, not only local `.env` values.
- Updated production/live-data verification to read public Supabase vars from `wrangler.jsonc`, matching the deployed Worker config.
- Added `.github/workflows/live-data-monitor.yml`, a twice-hourly scheduled guard that runs strict live-data verification.
- Added the MP5 DB hardening migration: high-value FK indexes, optimized auth RLS policies, combined custom-league policies, and public catalog artifact cleanup.
- Added private-schema custom-league RLS helper functions so membership/admin checks do not recurse and are not exposed as public REST RPCs.
- Expanded where-to-watch tests for USA, Canada, UK, Mexico, major EU markets, and key non-soccer routes.
- Removed moderate/high npm audit findings by refreshing vulnerable transitive packages in `package-lock.json`.
- Fixed mobile league/team detail rows so event dates wrap under titles instead of squeezing into one row.
- Raised live ticker tap target height and loosened mobile sport-banner clipping.

## Verified Gates

These passed during the MP5 pass:

- `npm run lint`
- `npm test` - 16 files, 84 tests
- `npm test -- --run src/data/__tests__/watchLinks.test.ts` - 11 where-to-watch tests
- `npm run test:e2e` - 36 Playwright checks across desktop and mobile
- `npm run build` - includes strict live-data verification
- `npm audit --audit-level=moderate` - 0 vulnerabilities
- `npm run verify:prod` - 15/15 clean
- `npm run verify:live-data -- --strict`
- `npm run provider:verify` - TheSportsDB, OpenF1, and combat path OK; local API-SPORTS checks skipped because `APISPORTS_KEY` is not in local env
- Supabase security advisor: no remaining `admin_overview` or trigger search-path warnings
- Supabase security advisor: custom-league RLS helper functions are in the `private` schema, not public RPC
- Supabase performance advisor: missing-FK-index and RLS-initplan findings cleared

## Live Data Health

Strict live-data verification passed. Current upcoming counts:

| Sport | Upcoming | Public leagues | Status |
| --- | ---: | ---: | --- |
| Soccer | 970 | 19 | OK |
| Baseball | 1598 | 5 | OK |
| Basketball | 187 | 4 | OK |
| American football | 87 | 2 | OK |
| Motorsport | 178 | 9 | OK |
| Combat sports | 22 | 4 | OK |
| Golf | 85 | 4 | OK |
| Rugby | 102 | 2 | OK |
| Esports | 214 | 30 | OK |
| Hockey | 20 | 1 | OK |
| Snooker | 54 | 1 | OK |
| Darts | 5 | 1 | OK |
| Olympic sports | 3 | 1 | OK, long-range only |
| Cycling | 54 | 3 | OK, optional/seasonal |
| Volleyball | 36 | 1 | OK, optional/seasonal |
| Tennis | 0 | 4 | Seasonal/source gap |
| Athletics | 0 | 5 | Seasonal/source gap |
| Cricket | 0 | 2 | Seasonal/source gap |
| Handball | 0 | 2 | Seasonal/source gap |

Action: empty-but-supported sports already say the schedule is connected but no fixtures are currently in the live window. A public source-freshness aggregate is still pending; do not expose raw provider/source tables to the browser.

## Supabase And Backend

Edge functions deployed and active:

- `calendar-feed` - public, must keep token validation strong
- `delete-account` - public, must keep JWT/user validation strong
- `provider-sync`
- `provider-hydrate`
- `provider-hydrate-players`
- `provider-hydrate-apisports`
- `provider-hydrate-apisports-f1`
- `provider-hydrate-pandascore`
- `ics-feed-ingest`
- `notifications`
- `admin-stats`

Cron jobs are active and recent runs succeeded:

- TheSportsDB hydrate every 15 minutes
- Player hydrate at 7/27/47 minutes hourly
- Notifications every 5 minutes
- ICS feed ingest every 6 hours
- PandaScore every 30 minutes
- Cleanup past events daily

Backend gaps and posture:

- `ADMIN_EMAILS` is set to `azharmoolla@gmail.com`.
- API-SPORTS soccer has a FIFA World Cup target but `events_synced_at` is still null. TheSportsDB/seeded data covers the live site now, but API-SPORTS fallback is not proven.
- API-SPORTS F1 last sync is 2026-06-19; OpenF1 and TheSportsDB are covering current motorsport, but this target should be reviewed.
- ICS ingestion has only rugby and snooker targets, and all are `dry_run=true`; this is not yet a production enrichment lane.
- Provider observability tables are intentionally RLS-enabled with no policies, service-role only. Keep that documented so advisor warnings are not confused with outages.

## Security

Fixed:

- Direct authenticated RPC access to `admin_overview()` was revoked. It is service-role only now.
- `touch_blog_posts_updated_at()` now has `search_path=public, pg_temp`.
- High-traffic user-owned policies now avoid per-row `auth.uid()` initplan overhead.
- Custom-league member/admin policy checks now use `private.is_custom_league_member()` and `private.is_custom_league_admin()` to avoid recursive RLS checks while keeping the helpers out of the exposed API schema.
- Public catalog artifact rows with defunct/placeholder/unknown/TBD-style names were hidden from public league lists.

Remaining advisor items:

- `get_shared_league(share_token text)` is a public `SECURITY DEFINER` RPC. This is intentional for share links, but it should stay limited to `share_enabled=true` and unguessable tokens. Consider moving to an Edge Function if share payloads become more sensitive.
- Auth leaked-password protection is disabled. Enable it before password login becomes important.
- Several internal ingestion/source tables have RLS with no policies. This is acceptable because they are service-role-only.
- Cron job definitions contain bearer tokens in `cron.job`. Treat cron table access as admin-only and document rotation.

## Performance

Fixed:

- The missing-FK-index findings from the first MP5 scan were addressed by `20260630183103_mp5_indexes_rls_catalog_hardening.sql`.
- High-traffic user-owned RLS policies now use `(select auth.uid())`; Supabase renders this in policy text as `SELECT auth.uid() AS uid`.
- Custom-league policies were combined/split by operation to reduce multiple permissive SELECT policy overlap.

Current performance advisor output is mostly "unused index" INFO on new or seasonal indexes. Do not drop these until at least one real production traffic window has passed.

Recommended follow-up:

1. Re-run the performance advisor after production traffic uses the new paths.
2. Remove only proven-unused duplicate indexes, not advisor-fresh indexes added for FK integrity and seasonal reads.
3. Switch Supabase Auth DB connection strategy to percentage-based allocation if the project is upgraded and auth traffic grows.

## Where To Watch

Database state:

- 68 active watch links
- 65 providers represented in links
- 72 active watch providers
- 27 providers marked affiliate pending
- 0 approved affiliate links currently wired

Current posture is good for non-affiliate routing. The first country/region coverage tests now protect USA, Canada, UK, Mexico, major EU markets, NBA, MLB, NFL Game Pass, cricket, F1, WTT, and World Cup routing.

Next pass should add:

- Provider health/admin page showing stale links and missing regions.
- Affiliate replacement workflow that swaps `url`/`affiliate_url` without changing UI contracts.
- A watch-link coverage matrix generated from the DB, not just catalog fallback rules.

## Mobile Audit

Automated coverage:

- 76 route/viewport checks at 360px and 390px.
- Routes included home, explore, schedule, calendar, export, account, content pages, all sport pages, event/league/team detail pages, admin, and 404.
- Result: 0 console errors, 0 horizontal page overflow, 0 blank routes.
- E2E mobile smoke also passed for core routes, main sport routes, match-card expansion, watch slot visibility, and serious a11y checks.

Manual/targeted overlay findings:

- First-run onboarding intentionally blocks header controls until dismissed.
- Language menu, sign-in popover, global search, and sport filter search fit within 360px.
- Desktop sport switcher trigger is hidden on mobile; mobile sports access is through bottom navigation.

Mobile fixes completed:

- League/team detail event rows wrap dates under titles.
- Sport-banner mobile title/copy no longer clips itself.
- Live ticker items have larger tap height.

Remaining mobile polish:

- Some display headings use very tight line-height by design. They pass overflow checks, but visual QA should keep watching them on real iOS Gmail/Safari sizes.
- Home poster carousel cards still use dense poster-style text; acceptable for now, but they are the next mobile readability target.

## Frontend And Feature Cleanup

Open items found from docs/code scan:

- `Blog` still has a "Blog coming soon" empty state if no published posts exist.
- League/team pages are no longer pure placeholders, but they are still lightweight. Add richer standings/context once data is reliable.
- `docs/master-plan-4-backend-and-glue.md` contains historical push-stub language in the June 15 section; June 21+ status is live up to transport and `verify:prod` now proves deployed VAPID secrets.
- `docs/handoff-banners-baseball.md` still marks baseball action art as placeholder.
- Combat sports still lacks licensed/structured undercard coverage for most events, which blocks accurate fight-level reminders.
- Player/team follows only fully work where event-participant links exist; golf, cycling, motorsport, snooker, darts, some rugby, and combat need sport-specific participant modeling.

## MP5 Priority Backlog

### P0

- Set deployed `ADMIN_EMAILS` to the actual admin allowlist. Done: `azharmoolla@gmail.com`.
- Add a production monitor that runs `verify:live-data --strict` on a schedule and alerts before deployment/live traffic sees empty critical sports. Done: GitHub scheduled monitor.
- Prove API-SPORTS World Cup hydrate or explicitly disable/document it as inactive fallback.

### P1

- Add high-value FK indexes for events, competitors, notification deliveries, watch links, source targets, and competition source joins. Done.
- Convert high-traffic RLS policies to `(select auth.uid())`. Done for user-owned high-traffic policies.
- Build source freshness UI for empty sports: last provider sync, next expected schedule release, and "alert me when schedule drops". Blocked until a sanitized public aggregate exists; raw provider/source tables should stay service-role-only.
- Turn ICS dry-run feeds into a controlled production ingestion lane after source terms are approved.
- Add combat undercard provider/curation plan with estimated bout timing.

### P2

- Clean public league catalog artifacts and hide defunct/provider-only leagues. Done for current visible artifacts; keep monitoring seeded provider rows.
- Expand mobile visual QA to real iOS Safari/Gmail screenshots for email and app pages.
- Update MP4/push docs to reflect current VAPID and notification behavior.
- Add where-to-watch coverage tests by country and sport. Initial priority-region test suite done.
- Add admin health widgets for stale provider targets, stale watch links, and dry-run source feeds.

### P3

- Revisit unused indexes after real traffic.
- Improve home poster carousel readability on narrow devices.
- Add richer league/team detail pages and standings once source coverage is stronger.
