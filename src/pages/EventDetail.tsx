import { ArrowLeft, CalendarDays, Download, MapPin, Star, Tv } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { Badge, Button, EmptyState, Panel, PanelHeading } from '../components/ui'
import { useEvent } from '../data/liveSport'
import { matchWatchProvider, watchLinkFor, WATCH_PROVIDERS } from '../lib/ads'
import { exportFilename } from '../domain/brand'
import { downloadBlob } from '../lib/clipboard'
import { createMultiSportIcsBlob, sportEmoji } from '../lib/ics'
import { SEO_ORIGIN, useDocumentMeta, useJsonLd } from '../lib/seo'
import { formatLongDate, formatTime } from '../lib/time'

const STATUS_TONE: Record<string, 'secondary' | 'muted' | 'warning'> = {
  scheduled: 'secondary',
  live: 'secondary',
  finished: 'muted',
  postponed: 'warning',
  cancelled: 'warning',
}

export function EventDetailPage() {
  const { eventId } = useParams()
  const { prefs, toggleFollow, followedLeagueIds, followedCompetitorIds } = useAppState()
  const { event, loading, configured } = useEvent(eventId)

  useDocumentMeta({
    title: event ? `${event.title} — when & where to watch | Silbo Sports` : 'Event — Silbo Sports',
    description: event
      ? `${event.title}${event.leagueName ? ` · ${event.leagueName}` : ''} — start time in your local timezone, where to watch, follow, and add to your calendar.`
      : undefined,
    canonicalPath: eventId ? `/events/${eventId}` : undefined,
  })
  useJsonLd(
    'event',
    event && event.startsAt
      ? {
          '@context': 'https://schema.org',
          '@type': 'SportsEvent',
          name: event.title,
          startDate: event.startsAt.toISOString(),
          eventStatus:
            event.status === 'cancelled'
              ? 'https://schema.org/EventCancelled'
              : event.status === 'postponed'
                ? 'https://schema.org/EventPostponed'
                : 'https://schema.org/EventScheduled',
          ...(event.venue
            ? {
                location: {
                  '@type': 'Place',
                  name: event.venue,
                  address: [event.venueCity, event.venueCountry].filter(Boolean).join(', ') || undefined,
                },
              }
            : {}),
          ...(event.competitors.length
            ? { competitor: event.competitors.map((c) => ({ '@type': 'SportsTeam', name: c.name })) }
            : {}),
          url: `${SEO_ORIGIN}/events/${event.id}`,
        }
      : null,
  )

  if (loading) {
    return <p className="board-label py-10 text-center text-ink/50">Tuning channel…</p>
  }

  if (!configured) {
    return <EmptyState title="Live data not configured" body="Connect Supabase to view event details." />
  }

  if (!event) {
    return (
      <EmptyState title="Event not found" body="This event may have finished or been removed.">
        <Link to="/my-schedule">
          <Button variant="ghost">Back to My Schedule</Button>
        </Link>
      </EmptyState>
    )
  }

  const timeOpts = { locale: prefs.locale, hour12: prefs.hour12 ?? undefined }
  const when = event.startsAt
    ? `${formatLongDate(event.startsAt, prefs.timezone, timeOpts)} · ${formatTime(event.startsAt, prefs.timezone, timeOpts)}`
    : 'Time to be confirmed'
  const venue = [event.venue, event.venueCity, event.venueCountry].filter(Boolean).join(', ')
  const leagueFollowed = event.leagueId ? followedLeagueIds.includes(event.leagueId) : false
  const regionCode = prefs.regionCode

  function exportIcs() {
    downloadBlob(createMultiSportIcsBlob([event!], { reminderMinutes: [60] }), exportFilename('event', 'ics'))
  }

  return (
    <div className="space-y-4">
      <Link to="/my-schedule" className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-primary">
        <ArrowLeft size={15} /> Back to My Schedule
      </Link>

      <Panel className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink/50">
              {sportEmoji(event.sportKey)} {event.leagueName || 'Event'}
            </p>
            <h1 className="text-2xl font-extrabold text-primary">{event.title}</h1>
          </div>
          <Badge tone={STATUS_TONE[event.status] ?? 'muted'}>{event.status}</Badge>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays size={16} className="shrink-0 text-primary" />
            <span>{when} <span className="text-ink/50">({prefs.timezone})</span></span>
          </div>
          {venue && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={16} className="shrink-0 text-primary" />
              <span>{venue}</span>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap gap-2 pt-1">
          {event.leagueId && (
            <Button
              variant={leagueFollowed ? 'subtle' : 'solid'}
              onClick={() => toggleFollow({ targetType: 'league', targetId: event.leagueId!, intent: 'watch' })}
            >
              <Star size={15} className={leagueFollowed ? 'fill-current' : ''} />
              {leagueFollowed ? 'Following league' : 'Follow league'}
            </Button>
          )}
          <Button variant="ghost" onClick={exportIcs}>
            <Download size={15} /> Add to calendar (.ics)
          </Button>
        </div>
      </Panel>

      {event.competitors.length > 0 && (
        <Panel>
          <PanelHeading title="Competitors" subtitle={`${event.competitors.length} in this event`} />
          <ul className="space-y-1">
            {event.competitors.map((c) => {
              const following = followedCompetitorIds.includes(c.id)
              return (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-primary/8">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {c.name}
                    {c.role && c.role !== 'participant' && (
                      <span className="ml-2 font-mono text-[10px] uppercase text-ink/40">{c.role}</span>
                    )}
                  </span>
                  {c.country && <span className="shrink-0 font-mono text-[10px] uppercase text-ink/45">{c.country}</span>}
                  <button
                    type="button"
                    onClick={() => toggleFollow({ targetType: 'competitor', targetId: c.id, intent: 'watch' })}
                    aria-pressed={following}
                    title={following ? `Following ${c.name}` : `Follow ${c.name}`}
                    className={`shrink-0 rounded-full p-1 transition-colors ${following ? 'text-primary' : 'text-ink/30 hover:text-primary'}`}
                  >
                    <Star size={14} className={following ? 'fill-primary' : ''} />
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      <Panel>
        <PanelHeading title="Where to watch">
          <Tv size={18} className="text-primary" />
        </PanelHeading>
        {event.broadcasts.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {event.broadcasts.map((b, i) => {
              const provider = matchWatchProvider(b.channel)
              const link = provider ? watchLinkFor(provider.key) : null
              const href = b.streamUrl ?? link?.href
              return (
                <li key={`${b.country}-${b.channel}-${i}`} className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase text-ink/45">{b.country}</span>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel={link?.affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}
                      className="font-medium text-primary hover:underline"
                    >
                      {b.channel}
                    </a>
                  ) : (
                    <span className="font-medium">{b.channel}</span>
                  )}
                  <span className="text-ink/40">· {b.kind}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <WatchOptions regionCode={regionCode} />
        )}
      </Panel>
    </div>
  )
}

// No specific broadcast yet: surface region-relevant streaming destinations. These are
// affiliate links when an affiliate id is configured (see lib/ads.ts), with the required
// disclosure. Useful even unmonetized — it answers "where could I watch this?".
function WatchOptions({ regionCode }: { regionCode?: string | null }) {
  const region = (regionCode ?? 'US').toUpperCase()
  const regional = WATCH_PROVIDERS.filter((p) => p.regions.includes(region))
  const providers = (regional.length ? regional : WATCH_PROVIDERS).slice(0, 5)
  const links = providers.map((p) => watchLinkFor(p.key)!).filter(Boolean)
  const anyAffiliate = links.some((l) => l.affiliate)

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink/55">
        No confirmed broadcast yet. Common ways to watch in your region:
      </p>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.name}
            href={l.href}
            target="_blank"
            rel={l.affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}
            className="rounded-lg border border-primary/25 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            {l.name}
          </a>
        ))}
      </div>
      <p className="text-[11px] text-ink/40">
        {anyAffiliate
          ? 'Some links are affiliate links — Silbo may earn a commission, at no cost to you.'
          : 'Availability varies by region — check your local listings.'}
      </p>
    </div>
  )
}
