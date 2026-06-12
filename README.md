# MatchPulse

Personal multi-sport schedule planner. Follow the teams you care about, see every event in
your local time, then push the schedule into your calendar, photos, notes, or family group
chat. Soccer (World Cup 2026) is the live vertical; the data model and UI scale to F1, NHL,
NBA, tennis, golf, and custom community leagues.

> Working title — see `docs/master-plan-2.md` before public launch.

## Pages

- **Home** — neutral multi-sport entry point with sport selector, "what do you want to
  track?" search, schedule preview, and upcoming-event carousel.
- **My Schedule** — events for everything you follow, range filters, conflict flags, exports.
- **Explore** — sport catalog (soccer + custom live; others staged as intentional previews).
- **Soccer / World Cup 2026** — team picker + full local-time fixture list.
- **Calendar** — subscribed-feed management (snapshot `.ics` vs live feed), per-app
  subscribe instructions.
- **Exports** — Export Studio: paginated readable image posters, `.ics`, Notes text.
- **Custom Leagues** — create leagues/teams/events (practices, uniforms, arrive-early),
  public share pages at `/s/:token`.

## Stack

- React 19 + Vite + TypeScript, Tailwind CSS v4 (bright token-based theme system,
  per-sport themes via `SportThemeProvider`), react-router, framer-motion, vitest.
- `src/domain` — types; `src/lib` — pure tested logic (time, ICS, poster, pagination,
  conflicts, store); `src/pages` + `src/components` — UI.
- `supabase/` — checked-in (not yet deployed) backend: migrations with visibility-gated
  RLS, n-ary event participation, broadcasts; Edge Functions for provider sync, live
  calendar feeds, and email/push notifications. See `supabase/README.md`.
- Follows/preferences/feeds/custom leagues persist in localStorage today, shaped 1:1 to the
  future Supabase API so the swap is internal to `src/lib/store.ts`.

## Data

World Cup 2026 fixtures bundle the public-domain `openfootball/worldcup.json` dataset.
Before adding any live provider, read `docs/master-plan-2.md` — redistribution
rights gate the calendar-feed model.

## Commands

```bash
npm install
npm run dev      # local dev server
npm run test     # vitest unit tests
npm run lint
npm run build    # typecheck + production build
```

## Plan

- `docs/master-plan-1.md` — original full product and technical plan.
- `docs/master-plan-2.md` — consolidated active implementation plan for the remaining
  backend, frontend, provider, calendar, auth, custom-league, homepage, i18n, monetization,
  QA, and deployment work.
