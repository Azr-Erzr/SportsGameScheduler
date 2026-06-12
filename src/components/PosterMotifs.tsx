import {
  ArrowRight,
  Bell,
  CalendarCheck,
  Clock3,
  Globe2,
  ShieldCheck,
  Ticket,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getSport } from '../domain/sports'
import { getTheme } from '../theme/themes'
import { SilboBrandMark, SilboChannelBadge } from './SilboMark'
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

const signalPositions = [
  { x: 67, y: 27, orbit: 'primary', delay: '0s', label: 'Signal east' },
  { x: 43, y: 35, orbit: 'secondary', delay: '-2.4s', label: 'Signal central' },
  { x: 56, y: 58, orbit: 'primary', delay: '-4.8s', label: 'Signal south' },
  { x: 28, y: 47, orbit: 'secondary', delay: '-7.2s', label: 'Signal west' },
  { x: 78, y: 53, orbit: 'primary', delay: '-9.6s', label: 'Signal far side' },
]

const defaultStats: CapsuleStat[] = [
  { icon: Trophy, value: '32', label: 'Teams' },
  { icon: CalendarCheck, value: '64', label: 'Matches' },
  { icon: Clock3, value: '16', label: 'Days' },
  { icon: Trophy, value: '1', label: 'Trophy' },
]

const featureItems = [
  {
    icon: Zap,
    title: 'Never miss a moment',
    body: 'Live alerts, kickoff reminders, and lineup updates.',
  },
  {
    icon: Clock3,
    title: 'Trusted times',
    body: 'Every event lands in your selected timezone.',
  },
  {
    icon: Globe2,
    title: 'Made for fans',
    body: 'Global coverage, local schedules, one place.',
  },
  {
    icon: Ticket,
    title: 'Built for the world',
    body: 'From local leagues to the biggest nights in sport.',
  },
]

function Skyline({ color = 'var(--mp-primary)' }: { color?: string }) {
  return (
    <div className="poster-skyline" aria-hidden="true">
      {Array.from({ length: 22 }).map((_, index) => (
        <span
          key={index}
          style={{
            height: `${28 + ((index * 19) % 82)}px`,
            backgroundColor: index % 4 === 0 ? 'var(--mp-export)' : index % 3 === 0 ? 'var(--mp-accent)' : color,
          }}
        />
      ))}
    </div>
  )
}

function PosterGlyph({ sportKey }: { sportKey: string }) {
  const sport = getSport(sportKey) ?? getSport('soccer')
  const theme = getTheme(sportKey)
  const Icon = sport?.icon

  if (sportKey === 'soccer') {
    return (
      <div className="poster-glyph poster-glyph-soccer" style={{ color: theme.colors.primary }}>
        <div className="poster-glyph-stripes" aria-hidden="true" />
        <div className="poster-field-arc" aria-hidden="true" />
        <div className="poster-soccer-ball" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="poster-glyph" style={{ color: theme.colors.primary }}>
      <div className="poster-glyph-stripes" aria-hidden="true" />
      {Icon && <Icon size={74} strokeWidth={1.8} />}
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
        <div className="art-sun" style={{ backgroundColor: theme.colors.export }} aria-hidden="true" />
        <Skyline color={theme.colors.ticketStub} />
      </div>
    </section>
  )
}

function EventPosterCard({
  event,
  index,
  active = false,
  onFocus,
}: {
  event: PosterEvent
  index: number
  active?: boolean
  onFocus?: () => void
}) {
  const theme = getTheme(event.sportKey)
  const card = (
    <article
      className={`event-poster-card ${active ? 'is-active' : ''}`}
      style={{ '--poster-primary': theme.colors.primary, '--poster-accent': theme.colors.accent } as CSSProperties}
    >
      <div className="event-poster-art" aria-hidden="true">
        <span className="event-poster-number">{String(index + 1).padStart(2, '0')}</span>
        <SportObjectIcon sportKey={event.sportKey} />
      </div>
      <div>
        <p>{event.label}</p>
        <h3>{event.title}</h3>
        <span>{event.detail}</span>
      </div>
    </article>
  )

  return event.href ? (
    <Link to={event.href} className="block min-w-[190px]" onFocus={onFocus} onMouseEnter={onFocus}>
      {card}
    </Link>
  ) : (
    card
  )
}

export function GlobalEventBoard({ events, variant = 'compact' }: { events: PosterEvent[]; variant?: 'compact' | 'room' }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeEvent = events[activeIndex] ?? events[0]
  const activeTheme = getTheme(activeEvent?.sportKey ?? 'neutral')

  return (
    <section className={`global-event-board ${variant === 'room' ? 'global-event-board-room' : ''}`}>
      <div className="poster-orbit poster-orbit-one" aria-hidden="true" />
      <div className="poster-orbit poster-orbit-two" aria-hidden="true" />
      <div className="poster-globe" aria-hidden="true" />
      <div className="globe-signal-layer" aria-label="Today's sport signals">
        {events.slice(0, 5).map((event, index) => {
          const position = signalPositions[index % signalPositions.length]
          const theme = getTheme(event.sportKey)
          const isActive = index === activeIndex
          return (
            <button
              key={event.title}
              type="button"
              className={`globe-signal ${isActive ? 'is-active' : ''} orbit-${position.orbit}`}
              style={
                {
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  '--signal-color': theme.colors.primary,
                  '--signal-accent': theme.colors.accent,
                  '--signal-delay': position.delay,
                } as CSSProperties
              }
              aria-pressed={isActive}
              aria-label={`${position.label}: ${event.title}`}
              onClick={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <SportObjectIcon sportKey={event.sportKey} size="sm" />
              <span>{event.label}</span>
            </button>
          )
        })}
      </div>

      <div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="board-label text-neon-magenta">Tonight's world board</p>
          <h2>{variant === 'room' ? 'Enter the live sports room.' : "Tonight's poster board."}</h2>
          {activeEvent && (
            <div className="globe-signal-preview" style={{ '--signal-preview-color': activeTheme.colors.primary } as CSSProperties}>
              <SportObjectIcon sportKey={activeEvent.sportKey} size="md" />
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
        <div className="room-tabs" aria-label="Room channels">
          {['Front', 'Tonight', 'Sync desk', 'Poster packs'].map((room) => (
            <span key={room}>{room}</span>
          ))}
        </div>
        <Bell size={24} className="text-export max-sm:hidden" />
      </div>

      <div className="poster-stack">
        {events.slice(0, 4).map((event, index) => (
          <EventPosterCard key={event.title} event={event} index={index} active={index === activeIndex} onFocus={() => setActiveIndex(index)} />
        ))}
      </div>
    </section>
  )
}

export function PosterFeatureStrip() {
  return (
    <section className="feature-ribbon">
      <div className="feature-ribbon-stripes" aria-hidden="true" />
      {featureItems.map(({ icon: Icon, title, body }) => (
        <div key={title} className="feature-ribbon-cell">
          <Icon size={25} strokeWidth={1.7} />
          <div>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        </div>
      ))}
      <div className="feature-barcode" aria-hidden="true" />
      <SilboBrandMark size={44} color="var(--mp-primary)" peaColor="var(--color-paper)" />
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
  const theme = getTheme(sportKey)

  if (!sport) return null

  return (
    <div className="sport-identity-tile paper-grain">
      <SilboChannelBadge icon={sport.icon} glyph={sport.badgeKey} color={theme.colors.ticketStub} iconColor="#f4ead8" size={92} />
      <div>
        <p className="art-kicker">{sport.flagshipLeague}</p>
        <h2>{sport.label}</h2>
        <p>{sport.tagline}</p>
      </div>
      <ShieldCheck size={24} className="text-paper-ink/45" />
    </div>
  )
}
