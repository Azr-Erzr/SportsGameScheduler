import {
  ArrowRight,
  Bell,
  CalendarCheck,
  Clock3,
  Globe2,
  ShieldCheck,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { getSport } from '../domain/sports'
import { getTheme } from '../theme/themes'
import { SilboBrandMark } from './SilboMark'
import { SportAssetIcon } from './SportAssetIcon'
import { Button } from './ui'

export type PosterEvent = {
  title: string
  sportKey: string
  label: string
  detail: string
  href?: string
}

type CapsuleStat = {
  icon?: LucideIcon
  value: string
  label: string
}

const defaultStats: CapsuleStat[] = [
  { icon: Trophy, value: '32', label: 'Teams' },
  { icon: CalendarCheck, value: '64', label: 'Matches' },
  { icon: Clock3, value: '16', label: 'Days' },
  { icon: Trophy, value: '1', label: 'Trophy' },
]

const featureItems = [
  {
    icon: Trophy,
    title: 'Browse coverage',
    body: 'Find every sport, league, card, race, and tournament we support.',
    href: '/explore',
  },
  {
    icon: CalendarCheck,
    title: 'Add events',
    body: 'Save one-off games and cards straight into your calendar.',
    href: '/my-schedule',
  },
  {
    icon: Globe2,
    title: 'Sync anywhere',
    body: 'Keep your schedule portable with feeds, exports, and shares.',
    href: '/calendar',
  },
  {
    icon: Zap,
    title: 'Get alerts',
    body: 'Set reminders around starts, changes, and the moments you care about.',
    href: '/settings/alerts',
  },
]

// landmarks — not a random rainbow bar chart.
function WorldRouteMap({ color = 'var(--mp-primary)' }: { color?: string }) {
  return (
    <div className="world-route-map" aria-hidden="true">
      <svg viewBox="0 0 360 190">
        <path className="route-land" d="M31 68c23-25 58-30 91-18 21 8 38 2 55-6 22-10 48-6 64 13 14 17 38 19 72 12" />
        <path className="route-land route-land-two" d="M61 112c36-12 58-8 84 7 23 13 46 12 67-1 28-17 53-17 87-1" />
        <path className="route-arc route-a" d="M86 125C124 78 168 62 244 75" />
        <path className="route-arc route-b" d="M142 132c38-16 72-18 129-68" />
        <path className="route-arc route-c" d="M218 134c-32-41-54-72-118-84" />
        <path className="route-arc route-d" d="M251 75c25 28 42 44 73 52" />
        <circle className="route-host" cx="254" cy="75" r="28" />
        <circle className="route-dot" cx="86" cy="125" r="4" style={{ fill: color }} />
        <circle className="route-dot" cx="142" cy="132" r="4" />
        <circle className="route-dot" cx="218" cy="134" r="4" />
        <circle className="route-dot" cx="324" cy="127" r="4" />
      </svg>
    </div>
  )
}

// Banner art panel: every sport uses the SAME composition — diagonal stripe field with the
// Silbo channel badge (whistle + sport glyph) centered. One badge system, no stray objects.
function PosterGlyph({ sportKey }: { sportKey: string }) {
  const sport = getSport(sportKey) ?? getSport('soccer')
  const theme = getTheme(sportKey)
  const { surfaceMode } = useAppState()
  const iconVariant = surfaceMode === 'program' ? 'brush' : 'neon3d'

  if (!sport) return null

  return (
    <div className="poster-glyph poster-glyph-badge" style={{ color: theme.colors.ticketStub }}>
      <div className="poster-glyph-stripes" aria-hidden="true" />
      <SportAssetIcon sportKey={sport.key} size="hero" variant={iconVariant} className="poster-glyph-asset" label={`${sport.label} icon`} />
    </div>
  )
}

function sportObjectKind(sportKey: string) {
  const sport = getSport(sportKey)
  return sport?.badgeKey ?? sportKey
}

export function SportObjectIcon({
  sportKey,
  size = 'lg',
  className = '',
}: {
  sportKey: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const theme = getTheme(sportKey)
  const kind = sportObjectKind(sportKey)

  return (
    <span
      className={`sport-object sport-object-${kind} sport-object-${size} ${className}`}
      style={{ '--sport-object-primary': theme.colors.primary, '--sport-object-accent': theme.colors.accent } as CSSProperties}
      aria-hidden="true"
    >
      <span className="sport-object-core" />
      <span className="sport-object-detail detail-one" />
      <span className="sport-object-detail detail-two" />
    </span>
  )
}

function EventBlueprint({ sportKey }: { sportKey: string }) {
  const kind = sportObjectKind(sportKey)
  const { surfaceMode } = useAppState()
  const iconVariant = surfaceMode === 'program' ? 'brush' : 'neon3d'

  return (
    <div className={`event-blueprint event-blueprint-${kind}`}>
      <SportAssetIcon sportKey={sportKey} size="poster" variant={iconVariant} className="event-blueprint-icon" />
    </div>
  )
}

export function TournamentCapsule({
  title,
  kicker = 'Global tournament capsule',
  body = 'The world comes together. You stay one step ahead. Follow what matters, get alerts, sync your calendar, never miss a moment.',
  ctaLabel = 'How it works',
  ctaTo = '/calendar',
  sportKey = 'soccer',
  stats = defaultStats,
}: {
  title: string
  kicker?: string
  body?: string
  ctaLabel?: string
  ctaTo?: string
  sportKey?: string
  stats?: CapsuleStat[]
}) {
  const theme = getTheme(sportKey)

  return (
    <section className="art-capsule paper-grain">
      <div className="art-capsule-panel">
        <PosterGlyph sportKey={sportKey} />
      </div>

      <div className="art-capsule-copy">
        <p className="art-kicker">{kicker}</p>
        <h1>{title}</h1>
        <div className="art-stat-row">
          {stats.map(({ icon: Icon, value, label }) => (
            <span key={`${value}-${label}`}>
              {Icon && <Icon size={17} />}
              <strong>{value}</strong>
              <em>{label}</em>
            </span>
          ))}
        </div>
      </div>

      <div className="art-capsule-side">
        <p>{body}</p>
        <Link to={ctaTo}>
          <Button variant="ghost" className="border-paper-ink/35 text-paper-ink hover:bg-paper-ink/10">
            {ctaLabel} <ArrowRight size={15} />
          </Button>
        </Link>
      </div>

      <div className="art-capsule-city">
        <WorldRouteMap color={theme.colors.ticketStub} />
      </div>
    </section>
  )
}

// Memoized so a change to the board's active index only re-renders the two cards whose
// `active` flips — not all ~11 cards (each of which renders a sport asset). Without this,
// sweeping the mouse across the board re-rendered the whole stack on every pointer move.
const EventPosterCard = memo(function EventPosterCard({
  event,
  index,
  active = false,
  onActivate,
}: {
  event: PosterEvent
  index: number
  active?: boolean
  onActivate?: (index: number) => void
}) {
  const theme = getTheme(event.sportKey)
  const focus = onActivate ? () => onActivate(index) : undefined
  const wrapperStyle = {
    '--poster-primary': theme.colors.primary,
    '--poster-accent': theme.colors.accent,
  } as CSSProperties
  const sportLabel = getSport(event.sportKey)?.label ?? theme.label

  const inner = (
    <article className={`event-poster-card ${active ? 'is-active' : ''}`}>
      <div className="event-poster-art" aria-hidden="true">
        <span className="event-poster-number">{String(index + 1).padStart(2, '0')}</span>
        <EventBlueprint sportKey={event.sportKey} />
      </div>
      <div className="event-poster-copy">
        <div>
          <p>{event.label}</p>
          <h3>{event.title}</h3>
          <span>{event.detail}</span>
        </div>
        <em>
          {sportLabel}
          <ArrowRight size={13} />
        </em>
      </div>
    </article>
  )

  return event.href ? (
    <Link to={event.href} className="poster-card-link" style={wrapperStyle} onFocus={focus} onMouseEnter={focus}>
      {inner}
    </Link>
  ) : (
    <div className="poster-card-link" style={wrapperStyle}>
      {inner}
    </div>
  )
})

// How many poster cards fit the stack at a given width — so the board never overflows into a
// horizontal scroll. Card + gap widths mirror the CSS clamps in tailwind.css.
function fitCount(containerWidth: number, viewportWidth: number, variant: 'compact' | 'room', total: number) {
  const gap = variant === 'room' ? Math.min(24, Math.max(10, viewportWidth * 0.02)) : 12
  const cardW = variant === 'room' ? Math.min(285, Math.max(230, viewportWidth * 0.19)) : 210
  const n = Math.floor((containerWidth + gap) / (cardW + gap))
  return Math.max(1, Math.min(n, total))
}

export function SpotlightRail({ events }: { events: PosterEvent[] }) {
  const { surfaceMode } = useAppState()
  const iconVariant = surfaceMode === 'program' ? 'brush' : 'neon3d'
  const visibleEvents = events.slice(0, 6)

  if (!visibleEvents.length) return null

  return (
    <section className="site-spotlight-rail" aria-labelledby="site-spotlight-title">
      <div className="site-spotlight-header">
        <div>
          <p className="board-label text-neon-magenta">Around the schedules</p>
          <h2 id="site-spotlight-title">Big games coming up</h2>
        </div>
        <Link to="/explore">
          Explore all <ArrowRight size={14} />
        </Link>
      </div>
      <div className="site-spotlight-grid">
        {visibleEvents.map((event) => {
          const theme = getTheme(event.sportKey)
          return (
            <Link
              key={`${event.sportKey}-${event.title}`}
              to={event.href ?? '/explore'}
              className="site-spotlight-card"
              style={{ '--spotlight-primary': theme.colors.primary, '--spotlight-accent': theme.colors.accent } as CSSProperties}
            >
              <SportAssetIcon sportKey={event.sportKey} size="sm" variant={iconVariant} />
              <div>
                <p>{event.label}</p>
                <strong>{event.title}</strong>
                <span>{event.detail}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function GlobalEventBoard({ events, variant = 'compact' }: { events: PosterEvent[]; variant?: 'compact' | 'room' }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMobileCarousel, setIsMobileCarousel] = useState(false)
  const { surfaceMode } = useAppState()
  const activeEvent = events[activeIndex] ?? events[0]
  const activeTheme = getTheme(activeEvent?.sportKey ?? 'neutral')
  const iconVariant = surfaceMode === 'program' ? 'brush' : 'neon3d'
  const activate = useCallback((index: number) => setActiveIndex((current) => (current === index ? current : index)), [])

  // Render only the cards that fit the viewport — no horizontal scroll on any screen.
  const stackRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(variant === 'room' ? 4 : 5)
  useEffect(() => {
    const el = stackRef.current
    if (!el) return
    const media = window.matchMedia('(max-width: 760px)')
    const recompute = () => {
      setIsMobileCarousel(media.matches)
      if (!media.matches) setVisibleCount(fitCount(el.clientWidth, window.innerWidth, variant, events.length))
    }
    recompute()
    const observer = new ResizeObserver(recompute)
    observer.observe(el)
    media.addEventListener('change', recompute)
    return () => {
      observer.disconnect()
      media.removeEventListener('change', recompute)
    }
  }, [variant, events.length])

  const onStackScroll = useCallback(() => {
    if (!isMobileCarousel) return
    const stack = stackRef.current
    if (!stack) return
    const stackBox = stack.getBoundingClientRect()
    const stackCenter = stackBox.left + stackBox.width / 2
    const cards = Array.from(stack.children) as HTMLElement[]
    const closest = cards.reduce(
      (best, card, index) => {
        const box = card.getBoundingClientRect()
        const distance = Math.abs(box.left + box.width / 2 - stackCenter)
        return distance < best.distance ? { index, distance } : best
      },
      { index: activeIndex, distance: Number.POSITIVE_INFINITY },
    )
    activate(closest.index)
  }, [activate, activeIndex, isMobileCarousel])

  function scrollToCard(index: number) {
    const card = stackRef.current?.children[index] as HTMLElement | undefined
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  // Chromium drives the pip entrance off a CSS scroll-timeline. Firefox/Safari don't support
  // scroll-driven animations, so we trigger a one-time time-based entrance when the board scrolls
  // into view. The class is inert in Chromium (its rule lives under `@supports not (...)`).
  const boardRef = useRef<HTMLElement>(null)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const el = boardRef.current
    if (!el || revealed) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -15% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [revealed])

  const visibleEvents = isMobileCarousel ? events : events.slice(0, visibleCount)

  return (
    <section
      ref={boardRef}
      className={`global-event-board ${variant === 'room' ? 'global-event-board-room' : ''} ${revealed ? 'is-revealed' : ''}`}
    >
      <div className="poster-orbit poster-orbit-one" aria-hidden="true" />
      <div className="poster-orbit poster-orbit-two" aria-hidden="true" />
      <div className="poster-globe" aria-hidden="true" />

      <div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="board-label text-neon-magenta">Tonight's world board</p>
          <h2>{variant === 'room' ? 'Enter the live sports room.' : "Tonight's poster board."}</h2>
          {activeEvent && (
            <div className="globe-signal-preview" style={{ '--signal-preview-color': activeTheme.colors.primary } as CSSProperties}>
              <SportAssetIcon sportKey={activeEvent.sportKey} size="sm" variant={iconVariant} />
              <div>
                <p>{activeEvent.label}</p>
                <strong>{activeEvent.title}</strong>
                <span>{activeEvent.detail}</span>
              </div>
              {activeEvent.href && (
                <Link to={activeEvent.href} aria-label={`Open ${activeEvent.title}`}>
                  <ArrowRight size={18} />
                </Link>
              )}
            </div>
          )}
        </div>
        <Bell size={24} className="text-export max-sm:hidden" />
      </div>

      <div className="poster-stack" ref={stackRef} onScroll={onStackScroll} aria-label="Featured sports boards">
        {visibleEvents.map((event, index) => (
          <EventPosterCard
            key={event.title}
            event={event}
            index={index}
            active={index === activeIndex}
            onActivate={activate}
          />
        ))}
      </div>

      <div className="poster-carousel-dots" aria-label="Choose featured board">
        {visibleEvents.map((event, index) => (
          <button
            key={event.title}
            type="button"
            aria-label={`Show ${event.title}`}
            aria-current={index === activeIndex}
            onClick={() => scrollToCard(index)}
          />
        ))}
      </div>
    </section>
  )
}

export function PosterFeatureStrip() {
  return (
    <section className="feature-ribbon" aria-label="Schedule tools">
      <div className="feature-ribbon-lead">
        <SilboBrandMark size={50} color="var(--mp-primary)" />
        <div>
          <h2>Build your sports calendar</h2>
          <p>Add individual events, follow the things that repeat, and keep every start time local.</p>
        </div>
      </div>
      {featureItems.map(({ icon: Icon, title, body, href }) => (
        <Link key={title} to={href} className="feature-ribbon-cell">
          <Icon size={22} strokeWidth={1.8} />
          <div>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
          <ArrowRight size={15} className="feature-ribbon-arrow" />
        </Link>
      ))}
    </section>
  )
}

export function ManifestoPoster() {
  return (
    <section className="manifesto-poster">
      <div className="manifesto-bars" aria-hidden="true">
        {['#54ff9f', '#46e8ff', '#ffd34d', '#ff4fd8', '#ff5247'].map((color) => (
          <span key={color} style={{ backgroundColor: color }} />
        ))}
      </div>
      <div>
        <h2>
          Every game, match, race, and card <em>in your calendar</em>
        </h2>
        <p>Follow what you love across every sport and league. Sync, export, get alerted, and stay in the game.</p>
      </div>
    </section>
  )
}

export function SportIdentityTile({ sportKey }: { sportKey: string }) {
  const sport = getSport(sportKey) ?? getSport('soccer')
  const { surfaceMode } = useAppState()
  const iconVariant = surfaceMode === 'program' ? 'brush' : 'neon3d'

  if (!sport) return null

  return (
    <div className="sport-identity-tile paper-grain">
      <SportAssetIcon sportKey={sport.key} size="hero" variant={iconVariant} className="sport-identity-icon" label={`${sport.label} icon`} />
      <div>
        <p className="art-kicker">{sport.flagshipLeague}</p>
        <h2>{sport.label}</h2>
        <p>{sport.tagline}</p>
      </div>
      <ShieldCheck size={24} className="text-paper-ink/45" />
    </div>
  )
}
