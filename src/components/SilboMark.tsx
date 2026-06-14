import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

// The Silbo whistle. The shell is shared across the brand mark and every sport channel.
// The pea inside the chamber changes: clock for Silbo, sport object for sport channels.

const VIEWBOX = '0 0 72 54'

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

// FILLED silhouette (MP3 P0: "simple silhouette, minimal internal linework"). A solid
// chamber + tube union reads as a whistle at 16px where the stroked outline read as noise.
function WhistleBody({ color }: { color: string }) {
  return (
    <>
      {/* chamber */}
      <circle cx="44.5" cy="32.5" r="14.5" fill={color} />
      {/* mouthpiece tube, merging into the chamber */}
      <rect x="2.5" y="21" width="31" height="12.5" rx="6.2" fill={color} />
      {/* lanyard knuckle ring */}
      <circle cx="35.5" cy="12.5" r="4" stroke={color} strokeWidth={3.4} fill="none" />
    </>
  )
}

/** Relative luminance for short/long hex colors; falls back to "dark" for CSS vars. */
function isLightColor(color: string): boolean {
  const hex = color.startsWith('#') ? color.slice(1) : null
  if (!hex || (hex.length !== 3 && hex.length !== 6)) return false
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150
}

function SignalArcs({ size = 1 }: { size?: number }) {
  const sw = 2.4 * size
  return (
    <>
      <path className="signal-arc" d="M60 13.5 a9 9 0 0 1 4.1 6.7" stroke="#ffc24b" strokeWidth={sw} strokeLinecap="round" fill="none" />
      <path className="signal-arc s2" d="M62.8 8.8 a14 14 0 0 1 6.3 10.5" stroke="#ff4fd8" strokeWidth={sw} strokeLinecap="round" fill="none" />
    </>
  )
}

function SportGlyph({ glyph, fallback: Fallback, color }: { glyph?: string; fallback?: LucideIcon; color: string }) {
  const common = {
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  }

  switch (glyph) {
    case 'soccer':
      return (
        <g className="silbo-glyph">
          <circle cx="43.5" cy="32.5" r="7.1" {...common} />
          <path d="M43.5 28.8 l3 2.2 -1.1 3.7 h-3.8 l-1.1 -3.7 Z" {...common} />
          <path d="M40.5 31 l-3.3 -1.4 M46.5 31 l3.3 -1.4 M41.6 34.7 l-2.1 2.8 M45.4 34.7 l2.1 2.8" {...common} />
        </g>
      )
    case 'basketball':
      return (
        <g className="silbo-glyph">
          <circle cx="43.5" cy="32.5" r="7.2" {...common} />
          <path d="M36.4 32.5 h14.2 M43.5 25.3 v14.4 M38.6 27.6 c3.2 2.2 6.6 2.2 9.8 0 M38.6 37.4 c3.2 -2.2 6.6 -2.2 9.8 0" {...common} />
        </g>
      )
    case 'football':
      return (
        <g className="silbo-glyph">
          <path d="M35.7 34.6 c3.2 -8 12.8 -9.5 16.5 -5.9 c-1.6 7.9 -10.8 12.2 -16.5 5.9 Z" {...common} />
          <path d="M41.4 31.8 l5.4 2.8 M43.2 30.4 l-1.4 2.8 M45.2 31.4 l-1.4 2.8 M47.2 32.4 l-1.4 2.8" {...common} />
        </g>
      )
    case 'hockey':
      return (
        <g className="silbo-glyph">
          <path d="M37.2 39.5 h9.3 c2.5 0 4.5 -1.1 4.5 -2.5 s-2 -2.5 -4.5 -2.5 h-9.3 c-2.5 0 -4.5 1.1 -4.5 2.5 s2 2.5 4.5 2.5 Z" {...common} />
          <path d="M48.8 24.8 l-5.5 10.1 M53.5 24.6 l-8.7 10.7" {...common} />
        </g>
      )
    case 'tennis':
      return (
        <g className="silbo-glyph">
          <ellipse cx="40.8" cy="30.2" rx="5.3" ry="7.2" transform="rotate(32 40.8 30.2)" {...common} />
          <path d="M45.3 35.7 l5.5 5.6 M38.2 25.8 l6 7.4 M35.9 30.4 l7.2 2.1" {...common} />
          <circle cx="52.5" cy="27" r="2.1" fill={color} stroke="none" />
        </g>
      )
    case 'golf':
      return (
        <g className="silbo-glyph">
          <path d="M39 40.2 v-16 l9.8 3.2 -9.8 3" {...common} />
          <path d="M34.5 41.2 c4.2 1.4 9.1 1.4 13.2 0" {...common} />
          <circle cx="51.4" cy="38.6" r="1.5" fill={color} stroke="none" />
        </g>
      )
    case 'motorsport':
      return (
        <g className="silbo-glyph">
          <path d="M34.8 34.2 h2.5 l2.2 -3.4 h8.2 l3.2 3.4 h2.5 v4.4 h-18.6 Z" {...common} />
          <circle cx="39" cy="39" r="2" {...common} />
          <circle cx="49.3" cy="39" r="2" {...common} />
          <path d="M40.9 30.8 l-2.2 -3 M48 30.8 l2.3 -3" {...common} />
        </g>
      )
    case 'combat':
      return (
        <g className="silbo-glyph">
          <path d="M37.2 27.8 c0 -2 1.4 -3.3 3.2 -3.3 c1.2 0 2.2 0.6 2.8 1.5 c0.6 -1 1.6 -1.5 2.8 -1.5 c2 0 3.3 1.5 3.3 3.6 v6.2 c0 3.4 -2.9 6 -6.5 6 h-2.6 c-3.3 0 -5.6 -2.2 -5.6 -5.3 v-2.6 c0 -1.2 0.9 -2.1 2.1 -2.1 h0.5 Z" {...common} />
          <path d="M40.5 25.2 v6.1 M43.3 26 v5.3 M46.2 25.4 v5.9 M36.1 37.8 h11.7" {...common} />
        </g>
      )
    case 'track':
      return (
        <g className="silbo-glyph">
          <circle cx="43.5" cy="33.2" r="7.1" {...common} />
          <path d="M43.5 26 v-3.2 M40.2 22.8 h6.6 M43.5 33.2 l4.1 -3.6 M36.6 36 c4.4 -2.2 8.8 -2.2 13.6 0" {...common} />
        </g>
      )
    case 'olympic':
      return (
        <g className="silbo-glyph" stroke={color} strokeWidth="1.35" fill="none">
          <circle cx="36.8" cy="30.4" r="3.4" />
          <circle cx="43.5" cy="30.4" r="3.4" />
          <circle cx="50.2" cy="30.4" r="3.4" />
          <circle cx="40.1" cy="36" r="3.4" />
          <circle cx="46.8" cy="36" r="3.4" />
        </g>
      )
    case 'custom':
      return (
        <g className="silbo-glyph">
          <circle cx="39.3" cy="29.5" r="3" {...common} />
          <circle cx="48.5" cy="29.5" r="3" {...common} />
          <path d="M34.2 40.5 c1 -4 4.2 -6.2 8 -5.8 M45.5 34.7 c3.8 -0.2 6.8 2 7.7 5.8" {...common} />
        </g>
      )
    default:
      return Fallback ? (
        <g className="silbo-glyph">
          <Fallback x={35.5} y={24.5} size={16} strokeWidth={2.4} color={color} />
        </g>
      ) : null
  }
}

export function SilboBrandMark({
  size = 40,
  color = 'var(--mp-primary, #4dff8a)',
  peaColor = '#f4ead8',
  arcs = true,
}: {
  size?: number
  color?: string
  peaColor?: string
  arcs?: boolean
}) {
  const pea = isLightColor(color) ? '#0b0a08' : peaColor
  return (
    <svg className="silbo-mark" width={size} height={(size * 54) / 72} viewBox={VIEWBOX} fill="none" aria-hidden="true">
      <WhistleBody color={color} />
      {arcs && <SignalArcs />}
      {/* clock pea on the solid chamber */}
      <circle className="silbo-clock-face" cx="44.5" cy="32.5" r="7" stroke={pea} strokeWidth={2.2} fill="none" />
      <path className="silbo-clock-hand" d="M44.5 28.2 v4.3 l3.2 2.4" stroke={pea} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function SilboChannelBadge({
  icon: Icon,
  color,
  size = 40,
  iconColor = '#f4ead8',
  glyph,
}: {
  icon: LucideIcon
  color: string
  size?: number
  iconColor?: string
  glyph?: SportGlyphKey | string
}) {
  const height = (size * 54) / 72
  // The glyph sits ON the solid chamber, so it must contrast with the FILL color, not the
  // page: dark glyph on light sport colors (tennis lime, gold), cream on deep ones.
  const glyphColor = isLightColor(color) ? '#0b0a08' : iconColor
  return (
    <span
      className="silbo-channel-badge relative inline-block"
      style={{ width: size, height, '--silbo-color': color } as CSSProperties}
      aria-hidden="true"
    >
      <svg width={size} height={height} viewBox={VIEWBOX} fill="none" className="absolute inset-0">
        <WhistleBody color={color} />
        <SportGlyph glyph={glyph} fallback={Icon} color={glyphColor} />
      </svg>
      <span className="silbo-sheen" aria-hidden="true" />
    </span>
  )
}

export function BrandLockup({ children }: { children?: ReactNode }) {
  return <span className="inline-flex items-center gap-3">{children}</span>
}
