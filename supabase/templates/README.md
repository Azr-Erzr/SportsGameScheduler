# Silbo email templates

Two kinds of email leave Silbo, both delivered through the **Resend SMTP** configured in Supabase:

| Email | Sent by | Template source | Action needed |
|---|---|---|---|
| **Magic link / sign-in** | Supabase Auth | `magic-link.html` (this folder) | Paste into the dashboard ↓ |
| **Confirm signup** | Supabase Auth | `confirm-signup.html` (this folder) | Paste into the dashboard ↓ |
| **Schedule alerts / reminders** | `notifications` edge function | `supabase/functions/_shared/email-template.ts` (`renderSilboAlertEmail`) | None — already branded & deployed with the function |

The alert/reminder emails are rendered in code and sent via the Resend API directly, so they need no
dashboard step. Only the **Auth** emails (magic link, confirm signup) are configured in the dashboard.

## How to install the Auth templates
Supabase Dashboard → project **SportsGameScheduler** → **Authentication → Emails → Templates**.

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
All three templates share the same palette so inbox + in-app feel like one product:
background `#070908`, card `#0b0f0d`, brand green `#28f070`, body text `#c4cabf`, hairline `#16351f`.
