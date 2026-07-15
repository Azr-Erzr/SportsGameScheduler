import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'
import { adsConfigured } from '../lib/ads'
import { getConsentChoice, setConsent, subscribeConsent, type ConsentChoice } from '../lib/consent'

// Cookie/advertising consent banner. Shows until the user makes a choice, then stays hidden.
// Declining means we never load the ad script — see src/lib/consent.ts. If ads aren't configured
// for this build at all, there's nothing to consent to, so we don't show the banner.

export function ConsentBanner() {
  const [choice, setChoice] = useState<ConsentChoice>(() => getConsentChoice())

  useEffect(() => subscribeConsent(setChoice), [])

  if (!adsConfigured || choice !== 'unset') return null

  return (
    <div
      role="dialog"
      aria-label="Cookie and advertising consent"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] md:pb-4"
    >
      <div className="silbo-floating-panel mx-auto flex max-w-3xl flex-col gap-3 rounded-card border border-primary/25 bg-surface/98 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <Cookie size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-ink/80">
            We use essential local storage to remember your picks and preferences. With your okay we also show ads, which set
            cookies. You can decline and still use everything.{' '}
            <Link to="/privacy" className="text-primary underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2 sm:flex-col md:flex-row">
          <button
            type="button"
            onClick={() => setConsent(false)}
            className="flex-1 whitespace-nowrap rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => setConsent(true)}
            className="flex-1 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-bold text-void transition-opacity hover:opacity-90"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
