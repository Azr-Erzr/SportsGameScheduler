import { ArrowLeft, Bell, CalendarDays, Clock, Download, MapPin, Star, Tv } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { WatchOptionsPanel } from '../components/WatchOptionsPanel'
import { Badge, Button, EmptyState, Panel, PanelHeading } from '../components/ui'
import { useEvent } from '../data/liveSport'
import { matchWatchProvider, watchLinkFor } from '../lib/ads'
import { exportFilename } from '../domain/brand'
import { downloadBlob } from '../lib/clipboard'
import { createMultiSportIcsBlob, sportEmoji } from '../lib/ics'
import { t } from '../lib/i18n'
import { SEO_ORIGIN, useDocumentMeta, useJsonLd } from '../lib/seo'
import { formatLongDate, formatTime } from '../lib/time'

// A fixture is perishable once finished, or once its start is comfortably past (covers events whose
// status never flips). 6h grace matches the Worker's window for long formats.
function isPerishableEvent(status: string | null, startsAt: Date | null): boolean {
  if (status === 'finished') return true
  if (!startsAt) return false
  const t = startsAt.getTime()
  return Number.isFinite(t) && t < Date.now() - 6 * 3600_000
}

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
      ? `${event.title}${event.leagueName ? ` · ${event.leagueName}` : ''} — start time in your local timezone, where to watch, and add to your schedule.`
      : undefined,
    canonicalPath: eventId ? `/events/${eventId}` : undefined,
    // A finished/past fixture is perishable: noindex,follow so dead fixtures don't rot in the index
    // while humans deep-linking from a calendar entry still see the page. Mirrors the Worker's
    // isPerishable so JS-rendering crawlers get the same directive on hydration.
    robots: !loading && (!event || isPerishableEvent(event.status, event.startsAt)) ? 'noindex, follow' : undefined,
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
    return <p className="board-label py-10 text-center text-ink/50">{t('event.loading', undefined, prefs.locale)}</p>
  }

  if (!configured) {
    return <EmptyState title={t('event.liveNotConfiguredTitle', undefined, prefs.locale)} body={t('event.liveNotConfiguredBody', undefined, prefs.locale)} />
  }

  if (!event) {
    return (
      <EmptyState title={t('event.notFoundTitle', undefined, prefs.locale)} body={t('event.notFoundBody', undefined, prefs.locale)}>
        <Link to="/my-schedule">
          <Button variant="ghost">{t('event.backSchedule', undefined, prefs.locale)}</Button>
        </Link>
      </EmptyState>
    )
  }

  const timeOpts = { locale: prefs.locale, hour12: prefs.hour12 ?? undefined }
  const when = event.startsAt
    ? `${formatLongDate(event.startsAt, prefs.timezone, timeOpts)} · ${formatTime(event.startsAt, prefs.timezone, timeOpts)}`
    : t('event.timeTbd', undefined, prefs.locale)
  const venue = [event.venue, event.venueCity, event.venueCountry].filter(Boolean).join(', ')
  const leagueFollowed = event.leagueId ? followedLeagueIds.includes(event.leagueId) : false
  const regionCode = prefs.regionCode

  function exportIcs() {
    downloadBlob(createMultiSportIcsBlob([event!], { reminderMinutes: [60] }), exportFilename('event', 'ics'))
  }

  return (
    <div className="space-y-4">
      <Link to="/my-schedule" className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-primary">
        <ArrowLeft size={15} /> {t('event.backSchedule', undefined, prefs.locale)}
      </Link>

      <Panel className="event-bumper space-y-3">
        <div className="motion-only event-bumper-grid" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink/50">
              {sportEmoji(event.sportKey)}{' '}
              {event.leagueId && event.leagueName ? (
                <Link to={`/leagues/${event.leagueId}`} className="hover:text-primary hover:underline">
                  {event.leagueName}
                </Link>
              ) : (
                event.leagueName || t('event.generic', undefined, prefs.locale)
              )}
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

        {/* Plain-language answer line: states the key fact in prose for users and for AI/answer
            engines that render JS, and frames the local-time + reminder value. */}
        <p className="text-sm text-ink/70">
          {event.title}
          {event.leagueName ? ` (${event.leagueName})` : ''}{' '}
          {event.startsAt
            ? `${t('event.startsLine', undefined, prefs.locale)} ${when} (${prefs.timezone}).`
            : `${t('event.timeTbd', undefined, prefs.locale)}.`}{' '}
          {t('event.summaryTail', undefined, prefs.locale)}
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          {event.leagueId && (
            <Button
              variant={leagueFollowed ? 'subtle' : 'solid'}
              className="event-bumper-action"
              onClick={() => toggleFollow({ targetType: 'league', targetId: event.leagueId!, intent: 'watch' })}
            >
              <Star size={15} className={leagueFollowed ? 'fill-current' : ''} />
              {leagueFollowed ? t('event.followingLeague', undefined, prefs.locale) : t('event.followLeague', undefined, prefs.locale)}
            </Button>
          )}
          <button
            type="button"
            onClick={exportIcs}
            className="event-bumper-action inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/25 px-3 py-2 text-xs font-bold text-ink transition-colors hover:bg-primary/10"
          >
            <Download size={15} /> {t('event.addCalendar', undefined, prefs.locale)}
          </button>
          <Link
            to="/settings/alerts"
            className="event-bumper-action inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/25 px-3 py-2 text-xs font-bold text-ink transition-colors hover:bg-primary/10"
          >
            <Bell size={15} /> {t('event.getReminders', undefined, prefs.locale)}
          </Link>
        </div>
      </Panel>

      {/* Plain-language Q&A. People search the literal question ("what time is the netherlands
          game", "what time is the grey cup 2026"); Google ranks/snippets from VISIBLE on-page text,
          not just the meta tag, so we answer it in words right here. */}
      <Panel>
        <h2 className="text-lg font-extrabold text-primary">What time is {event.title}?</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/75">
          {event.startsAt
            ? `${event.title} starts at ${when} (${prefs.timezone})${venue ? ` at ${venue}` : ''}${
                event.leagueName ? `, part of ${event.leagueName}` : ''
              }. Silbo Sports shows the start time in your own timezone — add it to your calendar or turn on a reminder so you don't miss kickoff.`
            : `${event.title}'s start time is still to be confirmed${venue ? ` at ${venue}` : ''}. Follow it on Silbo Sports and the time will appear here in your local timezone as soon as it's set.`}
        </p>
      </Panel>

      {event.bouts.length > 0 && <FightCardPanel event={event} locale={prefs.locale} hour12={prefs.hour12} timeZone={prefs.timezone} />}

      <EventNotes event={event} />

      {event.competitors.length > 0 && (
        <Panel>
          <PanelHeading
            title={t('event.competitors', undefined, prefs.locale)}
            subtitle={t('event.competitorsSubtitle', { count: event.competitors.length }, prefs.locale)}
          />
          <ul className="space-y-1">
            {event.competitors.map((c) => {
              const following = followedCompetitorIds.includes(c.id)
              return (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-primary/8">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    <Link to={`/teams/${c.id}`} className="hover:text-primary hover:underline">
                      {c.name}
                    </Link>
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
        <PanelHeading title={t('home.watchTitle', undefined, prefs.locale)}>
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
          <WatchOptionsPanel
            eventId={event.id}
            leagueId={event.leagueId}
            leagueName={event.leagueName}
            sportKey={event.sportKey}
            regionCode={regionCode}
            locale={prefs.locale}
          />
        )}
      </Panel>
    </div>
  )
}

const FIGHT_SLOT_MINUTES = 30

function FightCardPanel({
  event,
  locale,
  hour12,
  timeZone,
}: {
  event: NonNullable<ReturnType<typeof useEvent>['event']>
  locale?: string
  hour12?: boolean | null
  timeZone: string
}) {
  const opts = { locale, hour12: hour12 ?? undefined }
  const hasExplicitMain = event.bouts.some((bout) => bout.metadata.main_event === true || bout.metadata.is_main_event === true)

  return (
    <Panel className="space-y-3">
      <PanelHeading
        title={event.leagueName ? `${event.leagueName} fight card` : 'Fight card'}
        subtitle={`${event.bouts.length} bouts - estimated local windows`}
      >
        <Clock size={18} className="text-primary" />
      </PanelHeading>
      <div className="space-y-2">
        {event.bouts.map((bout, index) => {
          const isMainEvent = hasExplicitMain
            ? bout.metadata.main_event === true || bout.metadata.is_main_event === true
            : index === event.bouts.length - 1
          const estimatedStart = bout.estimatedStartAt ?? estimateBoutStart(event.startsAt, index)
          const title =
            bout.redCorner && bout.blueCorner
              ? `${bout.redCorner.name} vs ${bout.blueCorner.name}`
              : bout.redCorner?.name ?? bout.blueCorner?.name ?? `Bout ${bout.order ?? index + 1}`
          return (
            <article
              key={bout.id}
              className={`flex items-stretch overflow-hidden rounded-xl border bg-paper text-paper-ink ${
                isMainEvent ? 'border-ticket-stub shadow-[0_0_0_2px_var(--color-ticket-stub)]' : 'border-primary/15'
              }`}
            >
              <div
                className={`flex w-24 shrink-0 flex-col items-center justify-center px-2 py-3 text-center ${
                  isMainEvent ? 'bg-ticket-stub text-ticket-stub-text' : 'bg-primary/10 text-primary'
                }`}
              >
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] opacity-75">
                  {bout.order ? `Bout ${bout.order}` : 'Bout'}
                </span>
                <strong className="font-head text-sm leading-tight">
                  {estimatedStart ? formatTime(estimatedStart, timeZone, opts) : 'TBD'}
                </strong>
                {estimatedStart && !bout.estimatedStartAt && <span className="font-mono text-[9px] uppercase opacity-70">est.</span>}
              </div>
              <div className="min-w-0 flex-1 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-bold">{title}</h3>
                  {isMainEvent && <Badge tone="secondary">Main event</Badge>}
                  {bout.status !== 'scheduled' && <Badge tone={bout.status === 'finished' ? 'muted' : 'warning'}>{bout.status}</Badge>}
                </div>
                <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] uppercase tracking-wide text-paper-ink/55">
                  {bout.weightClass && <span>{bout.weightClass}</span>}
                  {bout.scheduledRounds && <span>{bout.scheduledRounds} rounds</span>}
                  {estimatedStart && <span>{formatLongDate(estimatedStart, timeZone, opts)}</span>}
                </p>
              </div>
            </article>
          )
        })}
      </div>
      <p className="text-[11px] text-ink/45">
        Bout times are best estimates unless an official window is available; live cards can slide with stoppages and decisions.
      </p>
    </Panel>
  )
}

function estimateBoutStart(cardStart: Date | null, index: number) {
  if (!cardStart) return null
  return new Date(cardStart.getTime() + index * FIGHT_SLOT_MINUTES * 60_000)
}

function EventNotes({ event }: { event: NonNullable<ReturnType<typeof useEvent>['event']> }) {
  const facts = [
    event.kind ? ['Format', readableFact(event.kind)] : null,
    factFromMetadata(event.metadata, 'season', 'Season'),
    factFromMetadata(event.metadata, 'round', 'Round'),
  ].filter((fact): fact is [string, string] => Boolean(fact && fact[1]))

  if (!facts.length) return null

  return (
    <Panel>
      <PanelHeading title="Event details" />
      <dl className="grid gap-2 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-primary/15 bg-page/45 px-3 py-2">
            <dt className="font-mono text-[10px] uppercase tracking-wide text-ink/45">{label}</dt>
            <dd className="text-sm font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

function factFromMetadata(metadata: Record<string, unknown>, key: string, label: string): [string, string] | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? [label, readableFact(value)] : null
}

function readableFact(value: string) {
  if (value.toLowerCase() === 'thesportsdb') return 'TheSportsDB'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

// disclosure. Useful even unmonetized — it answers "where could I watch this?".
