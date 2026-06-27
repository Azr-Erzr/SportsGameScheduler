import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useAppState } from '../app/state-context'
import { useTickerEvents, type TickerEvent } from '../data/tickerEvents'
import { getSport } from '../domain/sports'
import { formatTime } from '../lib/time'

// Broadcast-style ticker tape across the top of the homepage: the week's events crawling by in a
// neon glow. rAF-driven (not a CSS keyframe) so it can ease to a slow crawl on hover — letting you
// actually read and click an item — instead of jumping. Respects prefers-reduced-motion.

const NORMAL_SPEED = 0.55 // px per frame (~33px/s at 60fps)
const SLOW_SPEED = 0.12
const EASE = 0.08

function dayLabel(date: Date, timeZone: string, locale?: string): string {
  const now = new Date()
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale || 'en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).format(d)
  const today = fmt(now)
  const tomorrow = fmt(new Date(now.getTime() + 86_400_000))
  const target = fmt(date)
  if (target === today) return 'Today'
  if (target === tomorrow) return 'Tomorrow'
  return new Intl.DateTimeFormat(locale || 'en-US', { timeZone, weekday: 'short' }).format(date)
}

function TickerItem({ event, timeZone, locale, hour12 }: { event: TickerEvent; timeZone: string; locale?: string; hour12?: boolean | null }) {
  const sport = event.sportKey ? getSport(event.sportKey) : undefined
  const when = `${dayLabel(event.startsAt, timeZone, locale ?? undefined)} ${formatTime(event.startsAt, timeZone, { locale: locale ?? undefined, hour12: hour12 ?? undefined })}`
  return (
    <Link
      to={`/events/${event.id}`}
      className="group inline-flex shrink-0 items-center gap-2 px-3 text-sm sm:gap-2.5 sm:px-5"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-export shadow-[0_0_6px_var(--mp-export)]" aria-hidden="true" />
      {sport && (
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-export/80">{sport.label}</span>
      )}
      <span className="font-semibold text-ink/90 transition-colors group-hover:text-export">{event.title}</span>
      <span className="font-mono text-[11px] uppercase tracking-wide text-ink/45">{when}</span>
    </Link>
  )
}

export function LiveTicker() {
  const { prefs } = useAppState()
  const { events } = useTickerEvents()
  const trackRef = useRef<HTMLDivElement>(null)
  const targetSpeed = useRef(NORMAL_SPEED)

  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    if (reduceMotion || !events.length) return
    const track = trackRef.current
    if (!track) return

    let raf = 0
    let offset = 0
    let speed = NORMAL_SPEED
    let half = track.scrollWidth / 2
    const measure = () => {
      half = track.scrollWidth / 2
    }

    const step = () => {
      speed += (targetSpeed.current - speed) * EASE
      offset -= speed
      if (half > 0 && -offset >= half) offset += half
      track.style.transform = `translate3d(${offset}px, 0, 0)`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [events, reduceMotion])

  if (!events.length) return null

  // Rendered twice for a seamless wrap (the rAF resets at the half-width boundary).
  const loop = reduceMotion ? events : [...events, ...events]

  return (
    <div
      className="relative mb-5 overflow-hidden rounded-xl border border-export/25 bg-surface/80 py-2 shadow-[inset_0_0_18px_color-mix(in_srgb,var(--mp-export)_10%,transparent)]"
      onMouseEnter={() => (targetSpeed.current = SLOW_SPEED)}
      onMouseLeave={() => (targetSpeed.current = NORMAL_SPEED)}
      aria-label="This week's events ticker"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center gap-1.5 bg-gradient-to-r from-surface via-surface/95 to-transparent pl-3 pr-8">
        <Radio size={13} className="text-export" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-export">This week</span>
      </div>
      <div
        className={`flex w-max items-center whitespace-nowrap pl-32 sm:pl-36 ${reduceMotion ? 'gap-2 overflow-x-auto' : ''}`}
        ref={trackRef}
      >
        {loop.map((event, i) => (
          <TickerItem
            key={`${event.id}-${i}`}
            event={event}
            timeZone={prefs.timezone}
            locale={prefs.locale}
            hour12={prefs.hour12}
          />
        ))}
      </div>
    </div>
  )
}
