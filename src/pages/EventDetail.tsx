import { ArrowLeft, CalendarDays, Download, MapPin, Star, Tv } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { Badge, Button, EmptyState, Panel, PanelHeading } from '../components/ui'
import { useEvent } from '../data/liveSport'
import { exportFilename } from '../domain/brand'
import { downloadBlob } from '../lib/clipboard'
import { createMultiSportIcsBlob, sportEmoji } from '../lib/ics'
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
            {event.broadcasts.map((b, i) => (
              <li key={`${b.country}-${b.channel}-${i}`} className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase text-ink/45">{b.country}</span>
                {b.streamUrl ? (
                  <a href={b.streamUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                    {b.channel}
                  </a>
                ) : (
                  <span className="font-medium">{b.channel}</span>
                )}
                <span className="text-ink/40">· {b.kind}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/55">
            No broadcast listings yet. More options may be available in your region — check your local listings.
          </p>
        )}
      </Panel>
    </div>
  )
}
