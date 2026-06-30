import { ArrowLeft, ArrowRight, CalendarPlus, Star } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { Button, EmptyState, Panel } from '../components/ui'
import { useCompetitor, useLeague, type LiveEvent } from '../data/liveSport'
import { getSportGuide } from '../content/sportGuides'
import { sportRoutes } from '../domain/sports'
import { sportEmoji } from '../lib/ics'
import { useDocumentMeta } from '../lib/seo'
import { formatLongDate, formatTime } from '../lib/time'

// Route segment for a sport hub from its canonical key, so an entity page can link "up" to its sport.
function sportRouteFor(sportKey: string | null): string | null {
  if (!sportKey) return null
  return sportRoutes.find((s) => s.canonicalSportKey === sportKey)?.key ?? null
}

// Evergreen context shown beneath the fixtures on a league/team page. Gives the page real, useful,
// non-duplicated content (how Silbo tracks it, a sport explainer, internal links) so it is never a
// bare name + list — even between seasons. Pages with no upcoming fixtures are noindexed anyway, but
// this keeps them genuinely useful for anyone who lands on one.
function EntityContext({ name, noun, sportKey }: { name: string; noun: string; sportKey: string | null }) {
  const guide = getSportGuide(sportKey)
  const sportRoute = sportRouteFor(sportKey)
  const sportLabel = sportRoutes.find((s) => s.canonicalSportKey === sportKey)?.label ?? null

  return (
    <Panel className="space-y-4 text-sm leading-relaxed text-ink/75">
      <div className="space-y-2">
        <h2 className="font-display text-lg tracking-wide text-ink">Following {name} on Silbo Sports</h2>
        <p>
          Silbo Sports tracks {name}&apos;s upcoming {noun}s and converts every start time to the time zone on your
          device, so you always see when the next one begins where you are. Follow {name} to keep its schedule in one
          place, add any fixture to your calendar, get a reminder before it starts, and check where to watch in your
          region.
        </p>
        {guide ? <p>{guide.intro[0]}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-primary/12 pt-3">
        {sportRoute ? (
          <Link to={`/sports/${sportRoute}`} className="inline-flex items-center gap-1 text-sm font-bold text-primary">
            All {sportLabel ?? 'sport'} schedules <ArrowRight size={14} />
          </Link>
        ) : null}
        <Link to="/calendar" className="inline-flex items-center gap-1 text-sm font-semibold text-ink/65 hover:text-primary">
          <CalendarPlus size={14} /> Sync to your calendar
        </Link>
      </div>
    </Panel>
  )
}

// Shared upcoming-events list for league + team pages. Each row links to the event detail page.
function UpcomingEvents({ events, sportKey }: { events: LiveEvent[]; sportKey: string | null }) {
  const { prefs } = useAppState()
  if (events.length === 0) {
    return <EmptyState title="No upcoming events" body="New fixtures sync in automatically as schedules are published." />
  }
  return (
    <ul className="space-y-1.5">
      {events.map((e) => (
        <li key={e.id}>
          <Link
            to={`/events/${e.id}`}
            className="flex items-center gap-3 rounded-lg bg-page/60 px-3 py-2 hover:bg-primary/10 max-sm:flex-wrap"
          >
            <span className="text-lg leading-none">{sportEmoji(e.sportKey ?? sportKey)}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.title}</span>
            <span className="shrink-0 font-mono text-xs text-ink/55 max-sm:ml-8 max-sm:w-[calc(100%-2rem)] max-sm:shrink max-sm:whitespace-normal">
              {e.startsAt
                ? `${formatLongDate(e.startsAt, prefs.timezone, { locale: prefs.locale, hour12: prefs.hour12 ?? undefined })} ${formatTime(e.startsAt, prefs.timezone, { locale: prefs.locale, hour12: prefs.hour12 ?? undefined })}`
                : 'TBD'}
            </span>
            <ArrowRight size={15} className="shrink-0 text-ink/40" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function LeaguePage() {
  const { leagueId } = useParams()
  const { prefs, toggleFollow, followedLeagueIds } = useAppState()
  const { league, events, loading, configured } = useLeague(leagueId)

  useDocumentMeta({
    title: league ? `${league.name} schedule & fixtures — Silbo Sports` : 'League — Silbo Sports',
    description: league
      ? `${league.name} upcoming fixtures in your local time. Follow the league, sync to your calendar, and never miss a game.`
      : undefined,
    canonicalPath: leagueId ? `/leagues/${leagueId}` : undefined,
    // Thin/empty (off-season, unknown id) → keep out of the index until fixtures return. Mirrors
    // the Worker's leagueMeta noindex so JS-rendering crawlers see the same directive.
    robots: !loading && (!league || events.length === 0) ? 'noindex, follow' : undefined,
  })

  if (loading) return <p className="board-label py-10 text-center text-ink/50">Loading league…</p>
  if (!configured) return <EmptyState title="Schedule unavailable" body="League schedules will appear here once coverage is connected." />
  if (!league) {
    return (
      <EmptyState title="League not found" body="This league isn't in the catalog yet.">
        <Link to="/explore"><Button variant="ghost">Back to Explore</Button></Link>
      </EmptyState>
    )
  }

  const following = followedLeagueIds.includes(league.id)
  return (
    <div className="space-y-4">
      <Link to="/explore" className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-primary">
        <ArrowLeft size={15} /> Explore
      </Link>
      <Panel className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink/50">
            {sportEmoji(league.sportKey)} League{league.country ? ` · ${league.country}` : ''}
          </p>
          <h1 className="text-2xl font-extrabold text-primary">{league.name}</h1>
          <p className="mt-1 text-sm text-ink/55">{events.length} upcoming · times in {prefs.timezone}</p>
        </div>
        <Button
          variant={following ? 'subtle' : 'solid'}
          onClick={() => toggleFollow({ targetType: 'league', targetId: league.id, intent: 'watch' })}
        >
          <Star size={15} className={following ? 'fill-current' : ''} />
          {following ? 'Following' : 'Follow'}
        </Button>
      </Panel>
      <UpcomingEvents events={events} sportKey={league.sportKey} />
      <EntityContext name={league.name} noun="fixture" sportKey={league.sportKey} />
    </div>
  )
}

export function TeamPage() {
  const { teamId } = useParams()
  const { prefs, toggleFollow, followedCompetitorIds } = useAppState()
  const { competitor, events, loading, configured } = useCompetitor(teamId)

  useDocumentMeta({
    title: competitor ? `${competitor.name} schedule — Silbo Sports` : 'Team — Silbo Sports',
    description: competitor
      ? `${competitor.name} upcoming events in your local time. Follow them, sync to your calendar, and get reminders.`
      : undefined,
    canonicalPath: teamId ? `/teams/${teamId}` : undefined,
    // No upcoming fixtures or unknown id → thin; noindex,follow until the next event syncs in.
    robots: !loading && (!competitor || events.length === 0) ? 'noindex, follow' : undefined,
  })

  if (loading) return <p className="board-label py-10 text-center text-ink/50">Loading…</p>
  if (!configured) return <EmptyState title="Schedule unavailable" body="This schedule will appear here once coverage is connected." />
  if (!competitor) {
    return (
      <EmptyState title="Not found" body="This team or player isn't in the catalog yet.">
        <Link to="/explore"><Button variant="ghost">Back to Explore</Button></Link>
      </EmptyState>
    )
  }

  const following = followedCompetitorIds.includes(competitor.id)
  return (
    <div className="space-y-4">
      <Link to="/explore" className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-primary">
        <ArrowLeft size={15} /> Explore
      </Link>
      <Panel className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink/50">
            {sportEmoji(competitor.sportKey)} {competitor.kind === 'person' ? 'Player' : 'Team'}
            {competitor.country ? ` · ${competitor.country}` : ''}
          </p>
          <h1 className="text-2xl font-extrabold text-primary">{competitor.name}</h1>
          <p className="mt-1 text-sm text-ink/55">{events.length} upcoming · times in {prefs.timezone}</p>
        </div>
        <Button
          variant={following ? 'subtle' : 'solid'}
          onClick={() => toggleFollow({ targetType: 'competitor', targetId: competitor.id, intent: 'watch' })}
        >
          <Star size={15} className={following ? 'fill-current' : ''} />
          {following ? 'Following' : 'Follow'}
        </Button>
      </Panel>
      <UpcomingEvents events={events} sportKey={competitor.sportKey} />
      <EntityContext
        name={competitor.name}
        noun={competitor.kind === 'person' ? 'event' : 'fixture'}
        sportKey={competitor.sportKey}
      />
    </div>
  )
}
