# Reddit launch feedback log — Silbo Sports

## r/WebApps post (2026-07-12) — ~400 views, several upvotes

### Design feedback (u/AnnupKapurDotCom, acted on 2026-07-13)

> Dark mode colours make it feel like a tech product. Black + bright green
> may not appeal to non-tech people. Make dark mode more "friendly" —
> maybe use the dark green font colour from light mode as a background so
> it feels like grass on a football pitch.

**Response:** CRT-charcoal mockup implemented locally (uncommitted):

- `src/theme/themes.ts` — broadcast base `#0b0a08` → `#171b18` charcoal
  with a grass cast; surface `#16130f` → `#212622`; neutral neon
  `#4dff8a` → `#2ee06f`; soccer neon `#54ff9f` → `#38e57d` (darker pitch
  tone, same neon finish).
- `src/styles/tailwind.css` — `.broadcast-air` now carries the full CRT
  treatment: 3px-pitch scanlines + two offset broad grey static bands +
  tube vignette + the existing channel glows. Single fixed GPU layer,
  painted once. Mobile variant drops scanlines (DPR moiré) and keeps
  bands + vignette.
- Screenshots for review: `design/crt-mockup-desktop.png`,
  `design/crt-mockup-mobile.png`.

DECISION PENDING: Azhar reviews mockup → commit + deploy, tweak, or revert.

### Subreddit suggestions from commenters (candidate targets, rules unchecked)

- **r/LookWhatTheyBuilt** — suggested by u/Domx010 ("You should share it
  with the community")
- **r/WebSoftGiveaway** — suggested by u/AceReviewer ("feel free to post
  this")

Both came from engaged commenters, so a crosspost is pre-welcomed. Check
each sub's rules before posting, and respect the ~1-week Silbo posting
pause (next window ≈ 2026-07-19, World Cup final day).

### Reply debts on the r/WebApps thread

- u/AnnupKapurDotCom — thank for the colour feedback; genuinely acted on.
- u/Domx010 and u/AceReviewer — thank for the sub suggestions.
