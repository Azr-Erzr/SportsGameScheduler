# Silbo Account Mechanism — where accounts belong, and why users sign up

Last updated: June 22, 2026

## Guiding principle: anonymous-first, account-when-it-pays-off
The app must stay fully usable with **no account**. An account is never a wall in front of
the core value (see a schedule in your time, export it, watch it). Instead, sign-up is offered at
the exact moments where it *unlocks something the user already wants*, and the pitch is always a
benefit ("keep this / sync this / get told when it changes"), never a toll.

## What already works today (verified in code)
More is built than it looks:
- **Auth**: magic-link + Google OAuth (`AuthButton.tsx`, `state.tsx` `signInWith*`).
- **Follows** sync to `user_follows` when signed in, and **local follows merge into the account on
  sign-in** (`state.tsx` → `userData.ts` `mergeFollowsOnSignIn`).
- **Preferences** (timezone, locale, region, theme) sync to `profiles`; first sign-in seeds the
  server profile from local prefs.
- Anonymous data lives in `localStorage` via `store.ts`, deliberately shaped like the DB tables.

So "make login real" is mostly **closing the remaining persistence gaps + driving adoption**, not
building auth from scratch.

## The gaps to close
1. **Calendar feeds** (`store.ts` `mp.feeds`) and **custom leagues** (`mp.customLeagues`) are
   **local-only** — they don't sync to `calendar_feeds` / `custom_leagues`, and they aren't claimed
   into the account on sign-in. This is the "save my stuff / adjust saved items" gap.
2. **Alerts** need an account (a verified email / stable `user_id` and `alert_preferences` rows).
   The opt-in flow should require sign-in and create the preference rows.
3. **Sign-up prompts** don't exist yet at the high-intent moments (export, alerts, league, feed).
4. **Auth delivery config**: magic-link emails + Google OAuth + redirect URLs must be set in
   Supabase Auth (Site URL `https://silbosports.com`, redirect allow-list) and an email sender
   (the project already uses Resend) so links actually arrive.
5. **Admin gating**: `admin_overview()` is callable by any `authenticated` user (security-advisor
   finding) — needs an `is_admin` claim/flag once accounts are real.

## Where an account IS needed (hard requirements)
| Capability | Why an account is required |
|---|---|
| **Email / push alerts** | You need a verified contact + stable user to deliver, respect opt-in, and unsubscribe. Anonymous can't receive email. |
| **Cross-device sync** | `localStorage` is per-device and dies on cache-clear. Not re-selecting everything ⇒ account. |
| **Server-saved / editable custom leagues** | To save, edit from any device, and share reliably, the league must be owned by a `user_id` (RLS). |
| **Managing live feeds** | Creating / renaming / revoking feeds and having them follow you needs login. |

## Where an account is NOT needed (keep frictionless — no nag)
- Browsing schedules, local times, and where-to-watch.
- One-off **exports** (ICS / poster / Notes downloads).
- **Subscribing to a calendar feed via its token URL** — this is the important nuance below.
- Creating a custom league **locally** for personal use.

## The live-sync + email question, answered
Live calendar **sync works without email or login**: the calendar app re-fetches the unguessable
token `.ics` URL on its own schedule, and the `calendar-feed` edge function serves fresh data each
time. So a user can get an auto-updating calendar anonymously.

Email/account becomes necessary for the things *around* the feed:
- **Alerts** ("tell me when kickoff moves") — these are pushed to you, so they need email/push ⇒ account.
- **Recovery & management** — if you lose the token URL, or want to rename/revoke/list your feeds
  across devices, you need the account that owns them.

So the honest line to users: **"Sync works on its own. An account is for alerts, and for managing
or recovering your feeds and saved leagues."**

## Sign-up triggers (contextual, value-first)
A single reusable nudge component, opening the existing auth flow with trigger-specific copy:
1. **After an export** — *"Want this to stay updated and on all your devices? Save it free."* (the
   highest-intent moment — they just chose to take their schedule with them.)
2. **At alert opt-in** — *"To send your kickoff reminder we need an email — create a free account."*
   (hard requirement, feels natural.)
3. **On custom-league create/share** — *"Save this league so it survives a browser clear and you
   can edit it from your phone."*
4. **At feed creation** — *"Manage and revoke this feed from any device."*
5. **After N follows** — *"You're following N teams — back them up."* (`AuthButton` already hints this.)

## Compelling reasons to sign up (the pitch)
- Never re-pick your teams, city, or timezone again.
- Get a heads-up the moment a kickoff moves, a fight card changes, or a TBD team is set.
- Your custom league is safe, shareable, and editable from your phone.
- All your calendar feeds and follows in one place, on every device.

## Implementation plan
- **Phase 1 — close persistence gaps.** Add `calendar_feeds` + `custom_leagues` sync helpers in
  `userData.ts` (mirror the follows/prefs pattern); extend the sign-in merge to claim local feeds
  and leagues into the account; keep localStorage as the offline/anonymous mirror.
- **Phase 2 — sign-up nudges.** A `<SignUpNudge trigger=…>` that reuses `AuthButton`'s flow; wire
  it into `ExportStudio`, `AlertSettings`, `CustomLeagues`, and the feed creator.
- **Phase 3 — alerts require account.** Gate alert opt-in behind sign-in; create/maintain
  `alert_preferences` rows; wire unsubscribe.
- **Phase 4 — auth delivery + account page.** Configure Supabase Auth (Site URL, redirect
  allow-list, Resend SMTP, Google OAuth credentials); add an `/account` page to manage email,
  feeds, leagues, and account deletion (GDPR).
- **Phase 5 — admin gating.** Add an `is_admin` flag/claim and restrict `admin_overview()` +
  admin surfaces to it (closes the advisor finding).

Phases 1–3 are pure app code (no infra blockers). Phase 4 has config dependencies (Supabase Auth +
email sender). Phase 5 is small and ties off the security item.
