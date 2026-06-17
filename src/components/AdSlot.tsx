import { useEffect } from 'react'
import { AD_FORMATS, ADSENSE_CLIENT, adsConfigured, type AdFormat } from '../lib/ads'

// A single ad placement. Renders a Google AdSense unit when VITE_ADSENSE_CLIENT is set,
// otherwise a clearly labeled, correctly-sized placeholder so the layout slot is reserved and
// designed around now. Always labeled "Advertisement" per ad-network/FTC policy.
export function AdSlot({ format = 'leaderboard', className = '' }: { format?: AdFormat; className?: string }) {
  const dims = AD_FORMATS[format]

  useEffect(() => {
    if (!adsConfigured) return
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] }
      w.adsbygoogle = w.adsbygoogle || []
      w.adsbygoogle.push({})
    } catch {
      /* AdSense script not loaded yet — no-op */
    }
  }, [])

  return (
    <div
      className={`my-1 flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-primary/20 bg-page/40 py-2 ${className}`}
      style={{ minHeight: Math.min(dims.h, 120) }}
      role="complementary"
      aria-label="Advertisement"
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink/35">Advertisement</span>
      {adsConfigured ? (
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <span className="font-mono text-[10px] text-ink/25">
          {dims.label} · {dims.w}×{dims.h}
        </span>
      )}
    </div>
  )
}
