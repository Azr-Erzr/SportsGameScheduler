import { useEffect, useRef, useState } from 'react'
import { AD_FORMATS, ADSENSE_CLIENT, adsConfigured, type AdFormat } from '../lib/ads'
import { adsConsented, subscribeConsent } from '../lib/consent'

// A single paid placement. If a third-party network is blocked, unavailable, or unfilled,
// the reserved layout becomes a first-party sponsor slot instead of collapsing the schedule.
// Paid ads only render after advertising consent (src/lib/consent.ts); until then the slot is a
// reserved sponsor placeholder, so layout is stable and no ad cookies load without consent.
export function AdSlot({ format = 'leaderboard', className = '' }: { format?: AdFormat; className?: string }) {
  const dims = AD_FORMATS[format]
  const unitRef = useRef<HTMLModElement | null>(null)
  const [consented, setConsented] = useState(() => adsConsented())
  const adsActive = adsConfigured && consented
  // null = undetermined; false = ad failed/unfilled. Set only from async callbacks (lint: no
  // synchronous setState in an effect). The sponsor fallback shows whenever ads aren't filled.
  const [filled, setFilled] = useState<boolean | null>(null)
  const showSponsorFallback = !adsActive || filled === false

  useEffect(() => subscribeConsent(() => setConsented(adsConsented())), [])

  useEffect(() => {
    if (!adsActive) return

    try {
      const w = window as unknown as { adsbygoogle?: unknown[] }
      w.adsbygoogle = w.adsbygoogle || []
      w.adsbygoogle.push({})
    } catch {
      window.setTimeout(() => setFilled(false), 0)
    }

    const timer = window.setTimeout(() => {
      const unit = unitRef.current
      const isFilled = Boolean(unit?.querySelector('iframe')) || unit?.getAttribute('data-ad-status') === 'filled'
      setFilled(isFilled)
    }, 1800)

    return () => window.clearTimeout(timer)
  }, [adsActive])

  return (
    <div
      className={`my-1 flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-primary/20 bg-page/40 py-2 ${className}`}
      style={{ minHeight: Math.min(dims.h, 120) }}
      role="complementary"
      aria-label="Advertisement"
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink/35">Advertisement</span>
      {adsActive ? (
        <ins
          ref={unitRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : null}
      {showSponsorFallback && (
        <span className="px-3 text-center text-xs font-medium text-ink/45">
          Sponsor slot reserved for schedule-safe partners
          <span className="ml-1 font-mono text-[10px] text-ink/25">
            {dims.label} - {dims.w}x{dims.h}
          </span>
        </span>
      )}
    </div>
  )
}
