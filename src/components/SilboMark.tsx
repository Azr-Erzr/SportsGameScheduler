import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

// The Silbo whistle mark now uses a traced mask from the supplied logo mockup.
// CSS owns the finish: neon glow in broadcast mode, inked green in program mode,
// and sport-channel colour changes through --silbo-color / --mp-primary.

const TRACE_RATIO = 516 / 642

export type SportGlyphKey =
  | 'soccer'
  | 'basketball'
  | 'football'
  | 'hockey'
  | 'tennis'
  | 'golf'
  | 'motorsport'
  | 'combat'
  | 'track'
  | 'olympic'
  | 'custom'

export function SilboBrandMark({
  size = 40,
  color = 'var(--mp-primary, #4dff8a)',
}: {
  size?: number
  color?: string
  peaColor?: string
  arcs?: boolean
}) {
  return (
    <span
      className="silbo-mark silbo-trace-mark"
      style={{ width: size, height: size * TRACE_RATIO, '--silbo-color': color } as CSSProperties}
      aria-hidden="true"
    />
  )
}

export function SilboChannelBadge({
  color,
  size = 40,
}: {
  icon: LucideIcon
  color: string
  size?: number
  iconColor?: string
  glyph?: SportGlyphKey | string
}) {
  return (
    <span
      className="silbo-channel-badge silbo-trace-mark relative inline-block"
      style={{ width: size, height: size * TRACE_RATIO, '--silbo-color': color } as CSSProperties}
      aria-hidden="true"
    >
      <span className="silbo-sheen" aria-hidden="true" />
    </span>
  )
}

export function BrandLockup({ children }: { children?: ReactNode }) {
  return <span className="inline-flex items-center gap-3">{children}</span>
}
