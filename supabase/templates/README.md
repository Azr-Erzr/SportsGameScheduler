# Silbo email templates

Two kinds of email leave Silbo, both delivered through the **Resend SMTP** configured in Supabase:

| Email | Sent by | Template source | Action needed |
|---|---|---|---|
| **Magic link / sign-in** | Supabase Auth | `magic-link.html` (this folder) | None — installed remotely 2026-07-02; re-push after edits ↓ |
| **Confirm signup** | Supabase Auth | `confirm-signup.html` (this folder) | None — installed remotely 2026-07-02; re-push after edits ↓ |
| **Schedule alerts / reminders** | `notifications` edge function | `supabase/functions/_shared/email-template.ts` (`renderSilboAlertEmail`) | None — already branded & deployed with the function |

The alert/reminder emails are rendered in code and sent via the Resend API directly, so they need no
dashboard step. Only the **Auth** emails (magic link, confirm signup) live in Supabase Auth config.

## How to install / update the Auth templates

**Option A — Management API (no dashboard needed).** `PATCH https://api.supabase.com/v1/projects/<ref>/config/auth`
with a `sbp_…` personal access token (the Supabase CLI login token works), setting only these keys:
- `mailer_subjects_magic_link` / `mailer_templates_magic_link_content`
- `mailer_subjects_confirmation` / `mailer_templates_confirmation_content`

The PATCH is partial — untouched auth config keys are left alone. Verify with a GET afterwards.

**Option B — Dashboard.** Supabase Dashboard → project **SportsGameScheduler** → **Authentication → Emails → Templates**.

1. **Magic Link**
   - **Subject:** `Sign in to Silbo Sports`
   - **Message body:** paste the full contents of [`magic-link.html`](./magic-link.html)
2. **Confirm signup**
   - **Subject:** `Confirm your email — Silbo Sports`
   - **Message body:** paste the full contents of [`confirm-signup.html`](./confirm-signup.html)

Click **Save** on each. Send yourself a magic link from silbosports.com to verify delivery + styling.

> The app signs users in with `signInWithOtp` (magic link) and Google OAuth. Depending on whether
> "Confirm email" is enabled, a brand-new email may receive the **Confirm signup** template instead of
> **Magic Link** — that's why both are provided in the same style. There's no password flow, so the
> *Reset Password* template is unused; if you later add one, copy the magic-link styling.

## Template variables
These use Supabase's Go-template tokens, already embedded in the HTML:
- `{{ .ConfirmationURL }}` — the one-time sign-in / confirm link (button + fallback link).
- (Available if you want them) `{{ .Token }}` 6-digit code, `{{ .SiteURL }}`, `{{ .Email }}`.

## Keeping brand consistency
All three templates share the light CRT programme layout used by the site: warm cream reading paper,
a charcoal broadcast header for the neon lockup, faint scanlines where supported, and small
cyan/pink/amber/green pixel accents. Palette: charcoal `#171b18`, paper `#f3eddd` /
card `#fffaf0`, ink `#17352d` (muted `#53675f`, labels `#718178`), action green `#0b6f44`, neon
`#54ff9f`, cyan `#45c7d4`, pink `#ef6baf`, and amber `#f0b93f`. Type: Space Grotesk body /
Archivo Black display, with Arial fallbacks for clients that strip web fonts.

The texture and gradients are progressive enhancement. Every structural element, CTA, and contrast
boundary also has an inline solid-colour fallback for Outlook and clients that remove background images.
