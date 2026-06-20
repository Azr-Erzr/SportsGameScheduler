import { Bell, Check, Download, Search, Sparkles, Star, Tv, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { CityPicker } from '../components/CityPicker'
import { MatchCard } from '../components/MatchCard'
import { SportChannelBanner } from '../components/SportChannelBanner'
import { Badge, Button, EmptyState, Panel, PanelHeading } from '../components/ui'
import { deriveTeams, filterMatchesForTeams, useMatches } from '../data/liveMatches'
import { useEvent, useSportRoster, useSportSchedule, type LiveEvent } from '../data/liveSport'
import { flagPoleGradient } from '../data/flagColors'
import { allMatches, featuredTeams } from '../data/worldcup'
import { exportFilename } from '../domain/brand'
import type { Match } from '../domain/match'
import { getSport, type SportInfo } from '../domain/sports'
import type { CanonicalSportKey } from '../domain/types'
import { AdSlot } from '../components/AdSlot'
import { interleaveAds } from '../lib/ads'
import { downloadBlob } from '../lib/clipboard'
import { useDocumentMeta } from '../lib/seo'
import { findConflicts } from '../lib/conflicts'
import { createIcsBlob, createMultiSportIcsBlob } from '../lib/ics'
import { formatDate, formatLongDate, formatTime, relativeTimeFromNow } from '../lib/time'

const INDIVIDUAL_SPORTS = ['tennis', 'golf', 'athletics', 'combat_sports']

type SeasonReturnMarker = {
  id: string
  sportKey: CanonicalSportKey
  title: string
  leagueName: string
  startsAt: Date
  body: string
}

const SEASON_RETURN_MARKERS: Partial<Record<CanonicalSportKey, SeasonReturnMarker>> = {
  hockey: {
    id: 'season-return-nhl-2026-preseason',
    sportKey: 'hockey',
    title: 'NHL preseason begins',
    leagueName: 'NHL',
    startsAt: new Date('2026-09-19T12:00:00Z'),
    body: 'The NHL regular-season slate is still filling in, but preseason games are already landing for September. Full fixtures will appear here as the schedule fills out.',
  },
  basketball: {
    id: 'season-return-nba-2026-preseason',
    sportKey: 'basketball',
    title: 'NBA preseason tips off',
    leagueName: 'NBA',
    startsAt: new Date('2026-10-09T12:00:00Z'),
    body: 'Preseason/global games begin on October 9 and 11. This page will switch back to live fixtures once the schedule has games to show.',
  },
}

function seasonReturnFor(sportKey: CanonicalSportKey): SeasonReturnMarker | null {
  const marker = SEASON_RETURN_MARKERS[sportKey]
  if (!marker) return null
  return marker.startsAt.getTime() > Date.now() ? marker : null
}

// Customer-facing freshness line. Provider names stay internal; users just need confidence
// that Silbo has a live schedule and recent sync state.
function DataFreshness({ lastUpdated }: { lastUpdated: Date | null }) {
  return (
    <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-ink/45">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
      Live schedule{lastUpdated ? ` · synced ${relativeTimeFromNow(lastUpdated)}` : ''}
    </p>
  )
}

const SKYLINE_COLORS = ['var(--mp-primary)', 'var(--mp-accent)', 'var(--color-neon-magenta)', 'var(--mp-export)']

export function SportPage() {
  const { sportKey = 'soccer' } = useParams()
  const sport = getSport(sportKey)

  useDocumentMeta({
    title: sport ? `${sport.label} schedule & live times — Silbo Sports` : 'Sports — Silbo Sports',
    description: sport
      ? `${sport.label} fixtures — ${sport.flagshipLeague} and more in your local time. Follow teams and players, sync to your calendar, and never miss a ${sport.eventNoun}.`
      : undefined,
    canonicalPath: `/sports/${sportKey}`,
  })

  if (!sport) {
    return <EmptyState title="Unknown sport" body="That sport is not in the catalog yet." />
  }

  // Soccer keeps the polished World Cup planner, but other soccer leagues are selectable too.
  if (sport.canonicalSportKey === 'soccer') {
    return <SoccerPage />
  }

  return <LiveSportPage sport={sport} />
}

// Soccer: World Cup planner by default, with pills to switch to other live soccer leagues
// (EPL, La Liga, UCL, …) even while the World Cup is on. Leagues arrive viewership-ordered.
function SoccerPage() {
  const { prefs, toggleFollow, followedLeagueIds } = useAppState()
  const { leagues, events, lastUpdated } = useSportSchedule('soccer')
  const [leagueId, setLeagueId] = useState<string | null>(null) // null = World Cup planner
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [addedEventIds, setAddedEventIds] = useState<string[]>([])

  // Exclude the World Cup league rows (openfootball + TheSportsDB) — the planner IS the WC.
  const otherLeagues = useMemo(() => leagues.filter((l) => !/world cup/i.test(l.name)), [leagues])
  const leagueEvents = useMemo(
    () => (leagueId ? events.filter((e) => e.leagueId === leagueId) : []),
    [events, leagueId],
  )
  const activeLeague = otherLeagues.find((l) => l.id === leagueId)

  function addEventToSchedule(event: LiveEvent) {
    downloadBlob(createMultiSportIcsBlob([event], { reminderMinutes: [60] }), exportFilename('event', 'ics'))
    setAddedEventIds((current) => (current.includes(event.id) ? current : [...current, event.id]))
  }

  return (
    <div className="space-y-4">
      <DataFreshness lastUpdated={lastUpdated} />
      <LeagueFilter
        primaryLabel="World Cup"
        leagues={otherLeagues}
        selectedId={leagueId}
        onSelect={setLeagueId}
        followedIds={followedLeagueIds}
        onToggleFollow={(league) => toggleFollow({ targetType: 'league', targetId: league.id, intent: 'watch' })}
      />

      {leagueId === null ? (
        <WorldCupPlanner />
      ) : (
        <section className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-extrabold text-primary">{activeLeague?.name}</h1>
              <p className="text-sm text-ink/60">
                {leagueEvents.length} upcoming - shown in {prefs.timezone}
              </p>
            </div>
          </div>
          {leagueEvents.length > 0 ? (
            interleaveAds(leagueEvents, (e) => e.id, 6).map((entry) =>
              entry.kind === 'ad' ? (
                <AdSlot key={entry.key} format="leaderboard" />
              ) : (
                <div key={entry.key} className="space-y-2">
                  <EventTicket
                    event={entry.item}
                    locale={prefs.locale}
                    hour12={prefs.hour12}
                    timeZone={prefs.timezone}
                    expanded={expandedEventId === entry.item.id}
                    onToggle={() => setExpandedEventId((current) => (current === entry.item.id ? null : entry.item.id))}
                    added={addedEventIds.includes(entry.item.id)}
                    onAdd={() => addEventToSchedule(entry.item)}
                  />
                  {expandedEventId === entry.item.id && <EventQuickDetails eventId={entry.item.id} />}
                </div>
              ),
            )
          ) : (
            <EmptyState
              title="No upcoming fixtures"
              body="This league is between seasons — its next fixtures sync in automatically as they're published."
            />
          )}
        </section>
      )}
    </div>
  )
}

function WorldCupPlanner() {
  const { followedTeams, toggleFollow, prefs } = useAppState()
  const [query, setQuery] = useState('')
  const [addedMatchKeys, setAddedMatchKeys] = useState<string[]>([])
  const timeZone = prefs.timezone
  const { matches, source } = useMatches()

  const visibleTeams = useMemo(() => {
    const teams = deriveTeams(matches)
    const normalizedQuery = query.trim().toLowerCase()
    const pinned = teams.filter((team) => featuredTeams.includes(team))
    const rest = teams.filter((team) => !featuredTeams.includes(team))
    const ordered = [...pinned, ...rest]
    return normalizedQuery ? ordered.filter((team) => team.toLowerCase().includes(normalizedQuery)) : ordered
  }, [query, matches])

  const filteredMatches = useMemo(() => filterMatchesForTeams(matches, followedTeams), [matches, followedTeams])
  const conflicts = useMemo(() => findConflicts(filteredMatches), [filteredMatches])
  const popularPicksActive = featuredTeams.every((team) => followedTeams.includes(team))

  // Host-city capsules: real venue counts from the full fixture list (incl. knockout slots).
  const hostCities = useMemo(() => {
    const counts = new Map<string, number>()
    for (const match of allMatches) counts.set(match.ground, (counts.get(match.ground) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [])
  const venueCount = useMemo(() => new Set(allMatches.map((match) => match.ground)).size, [])
  const confirmedTeamCount = useMemo(() => deriveTeams(matches).length, [matches])

  function toggleTeam(team: string) {
    toggleFollow({ targetType: 'team', targetId: team, intent: 'watch' })
  }

  function toggleFeatured() {
    for (const team of featuredTeams) {
      const selected = followedTeams.includes(team)
      if ((popularPicksActive && selected) || (!popularPicksActive && !selected)) {
        toggleFollow({ targetType: 'team', targetId: team, intent: 'watch' })
      }
    }
  }

  function clearAll() {
    for (const team of [...followedTeams]) {
      toggleFollow({ targetType: 'team', targetId: team, intent: 'watch' })
    }
  }

  function matchKey(match: { date: string; team1: string; team2: string }) {
    return `${match.date}-${match.team1}-${match.team2}`
  }

  function addMatchToSchedule(match: Match) {
    const key = matchKey(match)
    downloadBlob(createIcsBlob([match], timeZone, prefs.locale, prefs.hour12), exportFilename('match', 'ics'))
    setAddedMatchKeys((current) => (current.includes(key) ? current : [...current, key]))
  }

  return (
    <div className="space-y-4">
      <SportChannelBanner
        title="World Cup '26"
        kicker={source === 'live' ? 'Channel 01 / Live tournament capsule' : 'Channel 01 / Tournament capsule'}
        sportKey="soccer"
        body={`Follow your nations and every kickoff lands in ${timeZone}. Group stage to final, whistle to whistle.`}
        ctaLabel="Sync schedule"
        ctaTo="/calendar"
        stats={[
          { value: String(allMatches.length), label: 'Matches' },
          { value: String(venueCount), label: 'Host cities' },
          { value: String(confirmedTeamCount), label: 'Teams' },
          { value: '1', label: 'Trophy' },
        ]}
      />

      {/* Host-city capsules (moodboard city badges) with real venue counts. */}
      <div className="silbo-scrollbar flex snap-x gap-2.5 overflow-x-auto pb-1">
        {hostCities.map(([city, count], index) => (
          <div
            key={city}
            className="flex min-w-[120px] snap-start flex-col items-center gap-1.5 rounded-xl border-2 border-primary/20 bg-surface px-3 pb-2.5 pt-3"
            style={{ color: SKYLINE_COLORS[index % SKYLINE_COLORS.length] }}
          >
            <span className="flex h-6 items-end gap-0.5" aria-hidden="true">
              {[...city.replace(/[^A-Za-z]/g, '').slice(0, 5)].map((char, barIndex) => (
                <i
                  key={barIndex}
                  className="block w-1.5 rounded-t-sm"
                  style={{ height: `${8 + ((char.charCodeAt(0) * 7 + barIndex * 13) % 16)}px`, background: 'currentColor' }}
                />
              ))}
            </span>
            <span className="max-w-[120px] truncate text-[11px] font-bold uppercase tracking-wide text-ink">
              {city.split(' (')[0]}
            </span>
            <span className="h-0.5 w-10 rounded-full" style={{ background: 'currentColor' }} aria-hidden="true" />
            <span className="font-mono text-[9px] tracking-[0.18em] text-ink/50">{count} MATCHES</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/60">Pick your nations from the kit wall.</p>
        <div className="flex flex-wrap items-center gap-2">
          <CityPicker />
          <Button
            variant={popularPicksActive ? 'solid' : 'subtle'}
            onClick={toggleFeatured}
            aria-pressed={popularPicksActive}
          >
            <Sparkles size={15} /> {popularPicksActive ? 'Popular on' : 'Popular picks'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Panel className="h-fit lg:sticky lg:top-20">
          <PanelHeading title="The kit wall" subtitle="Pick the sides you want to follow.">
            <button
              type="button"
              title="Clear teams"
              onClick={clearAll}
              className="rounded-lg p-2 text-ink/50 hover:bg-primary/10 hover:text-primary"
            >
              <X size={16} />
            </button>
          </PanelHeading>

          <label className="mb-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-page/60 px-3 py-2">
            <Search size={15} className="text-ink/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search teams"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>

          <div className="silbo-scrollbar grid max-h-[480px] grid-cols-1 gap-1 overflow-y-auto pr-1">
            {visibleTeams.map((team) => {
              const selected = followedTeams.includes(team)
              return (
                <button
                  type="button"
                  key={team}
                  onClick={() => toggleTeam(team)}
                  aria-pressed={selected}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    selected ? 'bg-primary text-void' : 'hover:bg-primary/5'
                  }`}
                >
                  <span
                    className="h-7 w-1.5 shrink-0 rounded-full"
                    style={{ background: flagPoleGradient(team) }}
                    aria-hidden="true"
                  />
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-extrabold ${
                      selected ? 'bg-void/25 text-void' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {team.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex-1">{team}</span>
                  {selected && <Check size={15} />}
                </button>
              )
            })}
          </div>
        </Panel>

        <section className="space-y-3">
          <p className="text-sm font-semibold text-ink/60">
            {followedTeams.length > 0
              ? `${filteredMatches.length} matches for ${followedTeams.length} teams`
              : `All ${filteredMatches.length} confirmed group-stage matches — follow teams to narrow this down`}
          </p>
            {filteredMatches.map((match, index) => (
              <MatchCard
                key={`${match.date}-${match.team1}-${match.team2}`}
                match={match}
                timeZone={timeZone}
                conflicted={conflicts.has(index)}
                highlightTeams={followedTeams}
                locale={prefs.locale}
                hour12={prefs.hour12}
                addedToSchedule={addedMatchKeys.includes(matchKey(match))}
                onAddToSchedule={() => addMatchToSchedule(match)}
              />
            ))}
        </section>
      </div>
    </div>
  )
}

// Live, DB-backed page for every non-soccer sport: banner + league filter + upcoming events,
// plus an athlete roster for individual sports (tennis/golf/athletics/combat).
function LiveSportPage({ sport }: { sport: SportInfo }) {
  const { prefs, toggleFollow, followedLeagueIds, followedCompetitorIds } = useAppState()
  const canonical = sport.canonicalSportKey
  const isIndividual = INDIVIDUAL_SPORTS.includes(canonical)
  const { leagues, events, loading, configured, lastUpdated } = useSportSchedule(canonical)
  const roster = useSportRoster(canonical, isIndividual)
  const [leagueId, setLeagueId] = useState<string | null>(null)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [addedEventIds, setAddedEventIds] = useState<string[]>([])

  const shownEvents = useMemo(
    () => (leagueId ? events.filter((e) => e.leagueId === leagueId) : events),
    [events, leagueId],
  )
  const seasonReturn = leagueId ? null : seasonReturnFor(canonical)

  function addEventToSchedule(event: LiveEvent) {
    downloadBlob(createMultiSportIcsBlob([event], { reminderMinutes: [60] }), exportFilename('event', 'ics'))
    setAddedEventIds((current) => (current.includes(event.id) ? current : [...current, event.id]))
  }

  function addSeasonReturnToSchedule(marker: SeasonReturnMarker) {
    downloadBlob(createMultiSportIcsBlob([seasonMarkerToEvent(marker)], { reminderMinutes: [] }), exportFilename('season-return', 'ics'))
    setAddedEventIds((current) => (current.includes(marker.id) ? current : [...current, marker.id]))
  }

  const stats = [
    { value: String(leagues.length), label: leagues.length === 1 ? 'League' : 'Leagues' },
    { value: String(events.length), label: 'Upcoming' },
    isIndividual
      ? { value: roster.players.length >= 500 ? '500+' : String(roster.players.length), label: 'Players' }
      : { value: sport.eventNoun + 's', label: 'Tracked' },
  ]

  return (
    <div className="space-y-5">
      <SportChannelBanner
        kicker={`Channel · ${sport.flagshipLeague}`}
        sportKey={sport.key}
        body={`${sport.tagline}. Every start time in ${prefs.timezone}, synced and ready to export.`}
        ctaLabel="Sync schedule"
        ctaTo="/calendar"
        stats={stats}
      />

      {!configured ? (
        <EmptyState title="Schedule unavailable" body="This sport's live schedule will appear here once coverage is connected." />
      ) : loading ? (
        <p className="board-label py-10 text-center text-ink/50">Tuning channel…</p>
      ) : (
        <>
          <DataFreshness lastUpdated={lastUpdated} />
          {leagues.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <LeagueFilter
                primaryLabel="All"
                leagues={leagues}
                selectedId={leagueId}
                onSelect={setLeagueId}
                followedIds={followedLeagueIds}
                onToggleFollow={(league) => toggleFollow({ targetType: 'league', targetId: league.id, intent: 'watch' })}
              />
            </div>
          )}

          <div className={`grid gap-4 ${isIndividual ? 'lg:grid-cols-[1fr_320px]' : ''}`}>
            <section className="min-w-0 space-y-3">
              {shownEvents.length > 0 ? (
                <>
                  <p className="text-sm font-semibold text-ink/60">{shownEvents.length} upcoming</p>
                  {interleaveAds(shownEvents, (e) => e.id, 6).map((entry) =>
                    entry.kind === 'ad' ? (
                      <AdSlot key={entry.key} format="leaderboard" />
                    ) : (
                      <div key={entry.key} className="space-y-2">
                        <EventTicket
                          event={entry.item}
                          locale={prefs.locale}
                          hour12={prefs.hour12}
                          timeZone={prefs.timezone}
                          expanded={expandedEventId === entry.item.id}
                          onToggle={() => setExpandedEventId((current) => (current === entry.item.id ? null : entry.item.id))}
                          added={addedEventIds.includes(entry.item.id)}
                          onAdd={() => addEventToSchedule(entry.item)}
                        />
                        {expandedEventId === entry.item.id && <EventQuickDetails eventId={entry.item.id} />}
                      </div>
                    ),
                  )}
                </>
              ) : seasonReturn ? (
                <SeasonReturnNotice
                  marker={seasonReturn}
                  locale={prefs.locale}
                  hour12={prefs.hour12}
                  timeZone={prefs.timezone}
                  added={addedEventIds.includes(seasonReturn.id)}
                  onAdd={() => addSeasonReturnToSchedule(seasonReturn)}
                />
              ) : (
                <EmptyState
                  title={`No upcoming ${sport.label.toLowerCase()} events`}
                  body={
                    isIndividual
                      ? 'Between seasons - the next fixtures sync in automatically. Browse the players meanwhile.'
                      : "We're tracking this sport. Upcoming events appear here as the next season is published."
                  }
                />
              )}
            </section>

            {isIndividual && (
              <RosterPanel
                players={roster.players}
                loading={roster.loading}
                noun={sport.label}
                followedIds={followedCompetitorIds}
                onToggle={(id) => toggleFollow({ targetType: 'competitor', targetId: id, intent: 'watch' })}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

function seasonMarkerToEvent(marker: SeasonReturnMarker): LiveEvent {
  return {
    id: marker.id,
    title: marker.title,
    startsAt: marker.startsAt,
    startsAtTbd: true,
    status: 'scheduled',
    leagueId: null,
    leagueName: marker.leagueName,
    sportKey: marker.sportKey,
    venue: null,
  }
}

function SeasonReturnNotice({
  marker,
  locale,
  hour12,
  timeZone,
  added,
  onAdd,
}: {
  marker: SeasonReturnMarker
  locale?: string
  hour12?: boolean | null
  timeZone: string
  added: boolean
  onAdd: () => void
}) {
  const opts = { locale, hour12: hour12 ?? undefined }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-ink/60">Season break - next marker</p>
      <article className="ticket-paper flex w-full items-stretch overflow-hidden max-sm:flex-col">
        <div className="flex w-32 shrink-0 flex-col items-center justify-center bg-ticket-stub px-2 py-4 text-center text-ticket-stub-text max-sm:w-full max-sm:flex-row max-sm:justify-between max-sm:px-4">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ticket-stub-text/75">
            {formatDate(marker.startsAt, timeZone, opts)}
          </span>
          <strong className="font-head text-base leading-tight">Preseason</strong>
          <span className="font-mono text-[9px] uppercase tracking-wide text-ticket-stub-text/70">Return</span>
        </div>
        <div className="min-w-0 flex-1 px-4 py-4">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-paper-ink/45">{marker.leagueName}</p>
          <h3 className="truncate text-lg font-bold text-paper-ink">{marker.title}</h3>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-paper-ink/55">
            {formatLongDate(marker.startsAt, timeZone, opts)} · season marker
          </p>
          <p className="mt-2 max-w-3xl text-sm text-paper-ink/65">{marker.body}</p>
        </div>
        <div className="flex shrink-0 items-center border-l border-paper-ink/10 px-3 max-sm:border-l-0 max-sm:border-t max-sm:px-4 max-sm:py-3">
          <button
            type="button"
            onClick={onAdd}
            aria-live="polite"
            className={`inline-flex min-w-[116px] items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors max-sm:w-full ${
              added
                ? 'border-ticket-stub bg-ticket-stub text-ticket-stub-text'
                : 'border-ticket-stub/30 text-paper-ink hover:bg-ticket-stub/10'
            }`}
          >
            <Download size={13} />
            {added ? 'Added!' : 'Add to schedule'}
          </button>
        </div>
      </article>
    </div>
  )
}

// A star toggle for following a league or competitor. Adds the target to the user's picks so it
// flows into My Schedule, exports, feeds, and alerts.
function FollowButton({
  active,
  onClick,
  label,
  size = 'md',
}: {
  active: boolean
  onClick: () => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? `Following ${label}` : `Follow ${label}`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-mono uppercase tracking-wide transition-colors ${
        size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'
      } ${
        active
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-primary/25 text-ink/70 hover:bg-primary/10'
      }`}
    >
      <Star size={size === 'sm' ? 11 : 13} className={active ? 'fill-primary' : ''} />
      {active ? 'Following' : 'Follow'}
    </button>
  )
}

function LeagueChip({
  label,
  active,
  followed = false,
  onClick,
}: {
  label: string
  active: boolean
  followed?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide transition-colors ${
        active ? 'border-primary bg-primary text-void' : 'border-primary/25 text-ink/70 hover:bg-primary/10'
      }`}
    >
      {followed && <Star size={11} className={active ? 'fill-void text-void' : 'fill-primary text-primary'} />}
      {label}
    </button>
  )
}

function LeagueFollowToggle({
  league,
  active,
  onToggle,
}: {
  league: { id: string; name: string }
  active: boolean
  onToggle: (league: { id: string; name: string }) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(league)}
      aria-pressed={active}
      title={active ? `Following ${league.name}` : `Follow ${league.name}`}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
        active
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-primary/25 text-ink/60 hover:bg-primary/10 hover:text-primary'
      }`}
    >
      <Star size={14} className={active ? 'fill-primary' : ''} />
    </button>
  )
}

// Inline top-N league pills (viewership-ordered) plus a searchable "More" panel for sports
// with long tails of leagues — keeps massive/hyper-local sports from overflowing the row.
function LeagueFilter({
  primaryLabel,
  leagues,
  selectedId,
  onSelect,
  followedIds = [],
  onToggleFollow,
  inlineCount = 6,
}: {
  primaryLabel: string
  leagues: Array<{ id: string; name: string }>
  selectedId: string | null
  onSelect: (id: string | null) => void
  followedIds?: string[]
  onToggleFollow?: (league: { id: string; name: string }) => void
  inlineCount?: number
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const inline = leagues.slice(0, inlineCount)
  const selected = selectedId ? leagues.find((l) => l.id === selectedId) ?? null : null
  const selectedInOverflow = Boolean(selected && !inline.some((l) => l.id === selected.id))
  const overflowCount = leagues.length - inline.length
  const followedSet = useMemo(() => new Set(followedIds), [followedIds])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? leagues.filter((l) => l.name.toLowerCase().includes(q)) : leagues
  }, [leagues, query])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(id: string | null) {
    onSelect(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      <div className="silbo-scrollbar flex gap-2 overflow-x-auto pb-1">
        <LeagueChip label={primaryLabel} active={selectedId === null} onClick={() => onSelect(null)} />
        {inline.map((l) => {
          const selectedLeague = selectedId === l.id
          const followed = followedSet.has(l.id)
          return (
            <div key={l.id} className="flex shrink-0 items-center gap-1">
              <LeagueChip label={l.name} active={selectedLeague} followed={followed} onClick={() => onSelect(l.id)} />
              {selectedLeague && onToggleFollow && (
                <LeagueFollowToggle league={l} active={followed} onToggle={onToggleFollow} />
              )}
            </div>
          )
        })}
        {selectedInOverflow && selected && (
          <div className="flex shrink-0 items-center gap-1">
            <LeagueChip label={selected.name} active followed={followedSet.has(selected.id)} onClick={() => onSelect(selected.id)} />
            {onToggleFollow && (
              <LeagueFollowToggle league={selected} active={followedSet.has(selected.id)} onToggle={onToggleFollow} />
            )}
          </div>
        )}
        {overflowCount > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide transition-colors ${
              open ? 'border-primary bg-primary/10 text-primary' : 'border-primary/25 text-ink/70 hover:bg-primary/10'
            }`}
          >
            <Search size={12} /> More <span className="text-ink/45">+{overflowCount}</span>
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-40 mt-2 w-72 rounded-xl border border-primary/20 bg-surface p-2 shadow-xl">
          <label className="mb-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-page/60 px-3 py-2">
            <Search size={14} className="text-ink/40" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leagues"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/40"
            />
          </label>
          <ul className="silbo-scrollbar max-h-72 space-y-0.5 overflow-y-auto">
            <li>
              <button
                type="button"
                onClick={() => pick(null)}
                className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selectedId === null ? 'bg-primary text-void' : 'text-ink/80 hover:bg-primary/10'
                }`}
              >
                {primaryLabel}
              </button>
            </li>
            {filtered.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => pick(l.id)}
                  className={`flex w-full items-center gap-2 truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selectedId === l.id ? 'bg-primary text-void' : 'text-ink/80 hover:bg-primary/10'
                  }`}
                >
                  {followedSet.has(l.id) && <Star size={12} className={selectedId === l.id ? 'fill-void text-void' : 'fill-primary text-primary'} />}
                  <span className="truncate">{l.name}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink/50">No leagues match “{query}”.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function EventTicket({
  event,
  locale,
  hour12,
  timeZone,
  expanded,
  onToggle,
  added,
  onAdd,
}: {
  event: LiveEvent
  locale?: string
  hour12?: boolean | null
  timeZone: string
  expanded: boolean
  onToggle: () => void
  added: boolean
  onAdd: () => void
}) {
  const opts = { locale, hour12: hour12 ?? undefined }
  const parts = event.title.includes(' vs ') ? event.title.split(' vs ') : null
  const isFightCard = event.sportKey === 'combat_sports'

  return (
    <article
      className={`ticket-paper group flex w-full items-stretch overflow-hidden transition-transform hover:-translate-y-0.5 max-sm:flex-col ${
        expanded ? 'ring-2 ring-primary/25' : ''
      } ${isFightCard ? 'min-h-[104px]' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-w-0 flex-1 items-stretch text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary max-sm:flex-col"
        aria-label={`${expanded ? 'Hide' : 'Show'} details for ${event.title}`}
      >
        <div
          className={`flex shrink-0 flex-col items-center justify-center bg-ticket-stub px-2 text-center text-ticket-stub-text ${
            isFightCard ? 'w-32 py-4' : 'w-24 py-3'
          } max-sm:w-full max-sm:flex-row max-sm:justify-between max-sm:px-4`}
        >
          {event.startsAt && !event.startsAtTbd ? (
            <>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ticket-stub-text/75">
                {formatDate(event.startsAt, timeZone, opts)}
              </span>
              <strong className={`font-head leading-tight ${isFightCard ? 'text-lg' : 'text-sm'}`}>
                {formatTime(event.startsAt, timeZone, opts)}
              </strong>
              {isFightCard && <span className="font-mono text-[9px] uppercase tracking-wide text-ticket-stub-text/70">Card starts</span>}
            </>
          ) : (
            <strong className={`font-head ${isFightCard ? 'text-lg' : 'text-sm'}`}>TBD</strong>
          )}
        </div>
        <div className={`min-w-0 flex-1 px-4 ${isFightCard ? 'py-4' : 'py-3'}`}>
          {isFightCard && <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-paper-ink/45">Fight card</p>}
          <h3 className={`truncate font-bold text-paper-ink ${isFightCard ? 'text-lg' : 'text-base'}`}>
            {parts ? (
              <>
                {parts[0]} <span className="font-mono text-[10px] not-italic text-paper-ink/40">VS</span> {parts[1]}
              </>
            ) : (
              event.title
            )}
          </h3>
          <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] uppercase tracking-wide text-paper-ink/55">
            {event.leagueName && <span>{event.leagueName}</span>}
            {event.venue && <span>{event.venue}</span>}
            {event.startsAt && !event.startsAtTbd && <span>{formatLongDate(event.startsAt, timeZone, opts)}</span>}
          </p>
          {isFightCard && (
            <p className="mt-2 text-xs font-semibold text-paper-ink/60">
              Open for card order, estimated bout times, and individual fight picks.
            </p>
          )}
        </div>
      </button>
      <div className="flex shrink-0 items-center border-l border-paper-ink/10 px-3 max-sm:border-l-0 max-sm:border-t max-sm:px-4 max-sm:py-3">
        <button
          type="button"
          onClick={onAdd}
          aria-live="polite"
          className={`inline-flex min-w-[116px] items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors max-sm:w-full ${
            added
              ? 'border-ticket-stub bg-ticket-stub text-ticket-stub-text'
              : 'border-ticket-stub/30 text-paper-ink hover:bg-ticket-stub/10'
          }`}
        >
          <Download size={13} />
          {added ? 'Added!' : 'Add to schedule'}
        </button>
      </div>
      {event.status !== 'scheduled' && (
        <span className="m-3 self-start">
          <Badge tone={event.status === 'finished' ? 'muted' : 'warning'}>{event.status}</Badge>
        </span>
      )}
    </article>
  )
}

function EventQuickDetails({ eventId }: { eventId: string }) {
  const { prefs, followedLeagueIds, toggleFollow } = useAppState()
  const { event, loading, configured } = useEvent(eventId)
  const [selectedBoutId, setSelectedBoutId] = useState<string | null>(null)

  if (loading) {
    return (
      <Panel className="border-primary/20 bg-surface/85 py-3">
        <p className="font-mono text-[10px] uppercase tracking-wide text-ink/45">Loading details...</p>
      </Panel>
    )
  }

  if (!configured) {
    return (
      <Panel className="border-primary/20 bg-surface/85 py-3">
        <p className="text-sm text-ink/55">Live details will appear here once coverage is connected.</p>
      </Panel>
    )
  }

  if (!event) return null

  const detail = event
  const opts = { locale: prefs.locale, hour12: prefs.hour12 ?? undefined }
  const when = detail.startsAt && !detail.startsAtTbd
    ? `${formatLongDate(detail.startsAt, prefs.timezone, opts)} - ${formatTime(detail.startsAt, prefs.timezone, opts)}`
    : 'Time TBD'
  const venue = [detail.venue, detail.venueCity, detail.venueCountry].filter(Boolean).join(', ')
  const leagueFollowed = detail.leagueId ? followedLeagueIds.includes(detail.leagueId) : false
  const selectedBout = detail.bouts.find((bout) => bout.id === selectedBoutId) ?? detail.bouts[0] ?? null
  const selectedBoutIndex = selectedBout ? detail.bouts.findIndex((bout) => bout.id === selectedBout.id) : -1
  const facts = [
    ['When', when],
    venue ? ['Venue', venue] : null,
    detail.kind ? ['Format', readableSportFact(detail.kind)] : null,
    metadataFact(detail.metadata, 'season', 'Season'),
    metadataFact(detail.metadata, 'round', 'Round'),
  ].filter((fact): fact is [string, string] => Boolean(fact && fact[1]))

  function exportIcs() {
    downloadBlob(createMultiSportIcsBlob([detail], { reminderMinutes: [60] }), exportFilename('event', 'ics'))
  }

  function boutTitle(bout: (typeof detail.bouts)[number], index: number) {
    if (bout.redCorner && bout.blueCorner) return `${bout.redCorner.name} vs ${bout.blueCorner.name}`
    return bout.redCorner?.name ?? bout.blueCorner?.name ?? `Bout ${bout.order ?? index + 1}`
  }

  return (
    <Panel className="space-y-3 border-primary/20 bg-surface/90">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink/45">Quick details</p>
          <h4 className="text-base font-bold text-primary">{event.title}</h4>
        </div>
        <Badge tone={event.status === 'scheduled' ? 'secondary' : event.status === 'finished' ? 'muted' : 'warning'}>{event.status}</Badge>
      </div>

      <dl className="grid gap-2 sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-primary/15 bg-page/45 px-3 py-2">
            <dt className="font-mono text-[10px] uppercase tracking-wide text-ink/45">{label}</dt>
            <dd className="truncate text-sm font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-lg border border-dashed border-primary/25 bg-page/45 p-3">
        <p className="mb-1 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink/55">
          <Tv size={13} /> Where to watch
        </p>
        <p className="text-sm font-semibold text-ink">Watch options reserved</p>
        <p className="mt-1 max-w-3xl text-xs text-ink/55">
          Local TV, streaming, radio, venue links, and affiliate offers attach here as coverage details are connected.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['TV', 'Streaming', 'Radio', 'Tickets'].map((label) => (
            <span key={label} className="rounded-full border border-primary/15 px-2 py-0.5 font-mono text-[10px] uppercase text-ink/55">
              {label}
            </span>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-ink/70">
          <Bell size={12} /> Alerts can watch for time moves and new broadcast links.
        </p>
      </div>

      {event.competitors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {event.competitors.map((competitor) => (
            <span key={competitor.id} className="rounded-full border border-primary/15 px-2.5 py-1 text-xs font-semibold text-ink/75">
              {competitor.name}
            </span>
          ))}
        </div>
      )}

      {event.bouts.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink/45">Fight card estimates</p>
            {event.bouts.map((bout, index) => {
              const active = selectedBout?.id === bout.id
              const estimatedStart = bout.estimatedStartAt ?? estimateBoutStart(event.startsAt, index)
              return (
                <button
                  key={bout.id}
                  type="button"
                  onClick={() => setSelectedBoutId(bout.id)}
                  aria-pressed={active}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    active ? 'bg-primary text-void' : 'bg-page/45 text-ink hover:bg-primary/10'
                  }`}
                >
                  <span className="min-w-0 truncate font-semibold">{boutTitle(bout, index)}</span>
                  <span className={`shrink-0 font-mono text-[10px] uppercase ${active ? 'text-void/70' : 'text-ink/50'}`}>
                    {estimatedStart ? `${formatTime(estimatedStart, prefs.timezone, opts)} est.` : 'TBD'}
                  </span>
                </button>
              )
            })}
          </div>
          {selectedBout && (
            <div className="rounded-lg border border-primary/15 bg-page/45 p-3">
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink/45">
                Bout {selectedBout.order ?? selectedBoutIndex + 1}
              </p>
              <h5 className="mt-1 text-sm font-extrabold text-primary">{boutTitle(selectedBout, selectedBoutIndex)}</h5>
              <dl className="mt-3 space-y-2 text-xs">
                {selectedBout.weightClass && (
                  <div>
                    <dt className="font-mono uppercase tracking-wide text-ink/40">Class</dt>
                    <dd className="font-semibold text-ink">{selectedBout.weightClass}</dd>
                  </div>
                )}
                {selectedBout.scheduledRounds && (
                  <div>
                    <dt className="font-mono uppercase tracking-wide text-ink/40">Rounds</dt>
                    <dd className="font-semibold text-ink">{selectedBout.scheduledRounds}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-mono uppercase tracking-wide text-ink/40">Status</dt>
                  <dd className="font-semibold text-ink">{readableSportFact(selectedBout.status)}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      )}

      {event.sportKey === 'combat_sports' && event.bouts.length === 0 && (
        <div className="rounded-lg border border-primary/15 bg-page/45 px-3 py-2 text-sm text-ink/55">
          Bout-level card order has not hydrated for this event yet. When it does, this panel becomes a selectable fight list.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {event.leagueId && (
          <FollowButton
            active={leagueFollowed}
            onClick={() => toggleFollow({ targetType: 'league', targetId: event.leagueId!, intent: 'watch' })}
            label={event.leagueName || 'league'}
            size="sm"
          />
        )}
        <button
          type="button"
          onClick={exportIcs}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/25 px-3 py-2 text-xs font-bold text-ink transition-colors hover:bg-primary/10"
        >
          <Download size={14} /> Add to schedule
        </button>
      </div>
    </Panel>
  )
}

const FIGHT_SLOT_MINUTES = 30

function estimateBoutStart(cardStart: Date | null, index: number) {
  if (!cardStart) return null
  return new Date(cardStart.getTime() + index * FIGHT_SLOT_MINUTES * 60_000)
}

function metadataFact(metadata: Record<string, unknown>, key: string, label: string): [string, string] | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? [label, readableSportFact(value)] : null
}

function readableSportFact(value: string) {
  if (value.toLowerCase() === 'thesportsdb') return 'TheSportsDB'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function RosterPanel({
  players,
  loading,
  noun,
  followedIds,
  onToggle,
}: {
  players: Array<{ id: string; name: string; country: string | null }>
  loading: boolean
  noun: string
  followedIds: string[]
  onToggle: (id: string, name: string) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? players.filter((p) => p.name.toLowerCase().includes(q)) : players
  }, [players, query])
  const followedSet = useMemo(() => new Set(followedIds), [followedIds])

  return (
    <Panel className="h-fit lg:sticky lg:top-20">
      <PanelHeading title={`${noun} players`} subtitle={loading ? 'Hydrating…' : `${players.length} tracked`}>
        <Users size={18} className="text-primary" />
      </PanelHeading>
      {players.length === 0 ? (
        <p className="text-sm text-ink/55">{loading ? 'Loading roster…' : 'Players appear here as rosters hydrate.'}</p>
      ) : (
        <>
          <label className="mb-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-page/60 px-3 py-2">
            <Search size={15} className="text-ink/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <ul className="silbo-scrollbar max-h-[460px] space-y-0.5 overflow-y-auto pr-1">
            {filtered.slice(0, 200).map((p) => {
              const following = followedSet.has(p.id)
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-primary/8">
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  {p.country && <span className="shrink-0 font-mono text-[10px] uppercase text-ink/45">{p.country}</span>}
                  <button
                    type="button"
                    onClick={() => onToggle(p.id, p.name)}
                    aria-pressed={following}
                    title={following ? `Following ${p.name}` : `Follow ${p.name}`}
                    className={`shrink-0 rounded-full p-1 transition-colors ${
                      following ? 'text-primary' : 'text-ink/30 hover:text-primary'
                    }`}
                  >
                    <Star size={14} className={following ? 'fill-primary' : ''} />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Panel>
  )
}
