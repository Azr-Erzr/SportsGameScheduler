import { LogIn, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAppState } from '../app/state-context'
import { Button } from './ui'

// Contextual, value-first sign-up prompt. Reuses the app's existing magic-link + Google auth and
// renders nothing when the user is already signed in (or when auth isn't configured), so it is safe
// to drop anywhere. Each trigger frames the benefit the user just reached for — never a wall.
const COPY = {
  export: {
    title: 'Keep this schedule updated everywhere',
    body: 'Save a free account and your picks sync across devices — no re-selecting teams, plus reminders before things start.',
  },
  alerts: {
    title: 'Sign in to set alerts',
    body: "Reminders and schedule-change emails are tied to your account so they work across devices. Sign in, then your followed leagues and players show up here.",
  },
  feed: {
    title: 'Sign in for a live, managed feed',
    body: 'An account gives you an auto-updating calendar URL you can rename, revoke, and manage from any device.',
  },
  league: {
    title: 'Save this league to your account',
    body: "Sign in so your custom league survives a browser clear, syncs across devices, and you can edit it from your phone.",
  },
  follows: {
    title: 'Back up your follows',
    body: 'Sign in so your teams, timezone, and settings follow you to every device.',
  },
} as const

export type SignUpTrigger = keyof typeof COPY

export function SignUpNudge({ trigger, className = '' }: { trigger: SignUpTrigger; className?: string }) {
  const { auth } = useAppState()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // Nothing to do if account sync isn't available or the user is already in.
  if (!auth.configured || auth.user) return null

  const copy = COPY[trigger]

  async function sendLink(event: FormEvent) {
    event.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setMessage('')
    try {
      await auth.signInWithMagicLink(email.trim())
      setMessage('Magic link sent — open it on this device to finish. Your current picks merge in automatically.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send magic link.')
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setBusy(true)
    setMessage('')
    try {
      await auth.signInWithGoogle()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start Google sign-in.')
      setBusy(false)
    }
  }

  return (
    <div className={`rounded-card border border-primary/20 bg-primary/5 p-4 ${className}`}>
      <h3 className="text-base font-bold text-primary">{copy.title}</h3>
      <p className="mt-1 text-sm text-ink/65">{copy.body}</p>
      <form onSubmit={sendLink} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="min-w-0 flex-1 rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <Button type="submit" disabled={busy}>
          <Mail size={15} /> Send magic link
        </Button>
      </form>
      <Button className="mt-2 w-full sm:w-auto" variant="ghost" onClick={google} disabled={busy}>
        <LogIn size={15} /> Continue with Google
      </Button>
      {message && <p className="mt-2 text-sm font-medium text-primary">{message}</p>}
    </div>
  )
}
