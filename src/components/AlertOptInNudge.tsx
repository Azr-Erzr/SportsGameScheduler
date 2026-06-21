import { useState } from 'react'
import { ArrowRight, BellRing, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'

const DISMISS_KEY = 'silbo.alertNudgeDismissed'

// A one-time, dismissible opt-in prompt surfaced where a user already has follows (My Schedule).
// Makes the alerts opt-in obvious "along the way" and states plainly what they'd get and that it
// is off until they choose it. Self-gating: renders nothing without follows or once dismissed.
export function AlertOptInNudge() {
  const { auth, followedTeams, followedLeagueIds, followedCompetitorIds } = useAppState()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const followCount = followedTeams.length + followedLeagueIds.length + followedCompetitorIds.length
  if (dismissed || followCount === 0) return null

  const signedIn = Boolean(auth.user)

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore storage failures (private mode); the nudge just reappears next visit
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/8 px-4 py-3">
      <BellRing size={18} className="mt-0.5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-ink/90">
          {signedIn ? 'Never miss a kickoff' : 'Want reminders for what you follow?'}
        </p>
        <p className="mt-0.5 text-ink/60">
          {signedIn
            ? 'Switch on email or browser alerts for your leagues and players — kickoff reminders plus time, venue, and lineup changes. Off until you choose; only ever about things you follow.'
            : 'Sign in to turn on kickoff reminders and schedule-change alerts for everything you follow. Off until you choose; only ever about things you follow.'}
        </p>
        <Link
          to="/settings/alerts"
          className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          {signedIn ? 'Set up alerts' : 'Get alerts'}
          <ArrowRight size={14} />
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss alert reminder"
        className="shrink-0 text-ink/40 transition-colors hover:text-ink/70"
      >
        <X size={16} />
      </button>
    </div>
  )
}
