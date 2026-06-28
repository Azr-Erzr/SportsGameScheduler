import { ArrowUpRight, Bell, Check, ChevronDown, Download, Flag, Search, Sparkles, Star, Timer, Trophy, Tv, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { CityPicker } from '../components/CityPicker'
import { MatchCard } from '../components/MatchCard'
import { SportChannelBanner } from '../components/SportChannelBanner'
import { WatchOptionsPanel } from '../components/WatchOptionsPanel'
import { Badge, Button, EmptyState, Panel, PanelHeading } from '../components/ui'
import { deriveTeams, filterMatchesForTeams, filterUpcomingMatches, useMatches } from '../data/liveMatches'
import { useEvent, useSportRoster, useSportSchedule, type LeagueTeam, type LiveEvent } from '../data/liveSport'
import { flagPoleGradient } from '../data/flagColors'
import { allMatches, featuredTeams } from '../data/worldcup'
import { exportFilename } from '../domain/brand'
import type { Match } from '../domain/match'
import { getSport, pluralizeEventNoun, type SportInfo } from '../domain/sports'
import type { CanonicalSportKey } from '../domain/types'
import { AdSlot } from '../components/AdSlot'
import { interleaveAds } from '../lib/ads'
import { downloadBlob } from '../lib/clipboard'
import { useDocumentMeta } from '../lib/seo'
import { findConflictTiers, type OverlapTier } from '../lib/sportTiming'
import { createMultiSportIcsBlob } from '../lib/ics'
import { getSavedMatchKeys, toggleSavedMatch } from '../lib/store'
import { groupRaceWeekends, parseRaceWeekendTitle, RACE_SESSION_LABELS, type RaceWeekend } from '../lib/raceWeekends'
import { formatDate, formatLongDate, formatTime, relativeTimeFromNow } from '../lib/time'

const INDIVIDUAL_SPORTS = ['tennis', 'golf', 'athletics', 'combat_sports']
const SCHEDULE_PAGE_SIZE = 24

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

function pageCountFor(total: number, pageSize = SCHEDULE_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize))
}

function pageRange(currentPage: number, pageCount: number) {
  const pages = new Set<number>([1, pageCount])
  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= pageCount) pages.add(page)
  }
  return [...pages].sort((a, b) => a - b)
}

function activePageFor(state: { key: string; page: number }, key: string, pageCount: number) {
  return state.key === key ? Math.min(Math.max(state.page, 1), pageCount) : 1
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

function SchedulePagination({
  page,
  pageCount,
  total,
  pageSize = SCHEDULE_PAGE_SIZE,
  onPageChange,
  label = 'events',
}: {
  page: number
  pageCount: number
  total: number
  pageSize?: number
  onPageChange: (page: number) => void
  label?: string
}) {
  if (pageCount <= 1) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)
  const pages = pageRange(page, pageCount)

  function go(nextPage: number) {
    onPageChange(Math.min(Math.max(nextPage, 1), pageCount))
  }

  return (
    <nav className="flex flex-col gap-2 rounded-xl border border-primary/15 bg-surface/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between" aria-label="Schedule pages">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
        Showing {start}-{end} of {total} {label}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page === 1}
          className="rounded-full border border-primary/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-ink/70 transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Prev
        </button>
        {pages.map((pageNumber, index) => {
          const previous = pages[index - 1]
          const showGap = previous && pageNumber - previous > 1
          return (
            <span key={pageNumber} className="flex items-center gap-1.5">
              {showGap && <span className="px-1 font-mono text-[10px] text-ink/35">...</span>}
              <button
                type="button"
                onClick={() => go(pageNumber)}
                aria-current={pageNumber === page ? 'page' : undefined}
                className={`h-8 min-w-8 rounded-full border px-2 font-mono text-[10px] font-bold transition-colors ${
                  pageNumber === page
                    ? 'border-primary bg-primary text-void'
                    : 'border-primary/25 text-ink/70 hover:bg-primary/10 hover:text-primary'
                }`}
              >
                {pageNumber}
              </button>
            </span>
          )
        })}
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page === pageCount}
          className="rounded-full border border-primary/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-ink/70 transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Next
        </button>
      </div>
    </nav>
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
  const { prefs, toggleFollow, followedLeagueIds, followedCompetitorIds } = useAppState()
  const { leagues, events, lastUpdated } = useSportSchedule('soccer')
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<string[]>([])
  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState<string[]>([])
  const [selectedCompetitionIds, setSelectedCompetitionIds] = useState<string[]>([])
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [addedEventIds, setAddedEventIds] = useState<string[]>([])
  const [eventPager, setEventPager] = useState({ key: 'none', page: 1 })

  // Exclude the World Cup league rows (openfootball + TheSportsDB) — the planner IS the WC.
  const otherLeagues = useMemo(() => leagues.filter((l) => !/world cup/i.test(l.name)), [leagues])
  const liveSoccerEvents = useMemo(
    () => events.filter((event) => !/world cup/i.test(event.leagueName)),
    [events],
  )
  const leagueEvents = useMemo(
    () => filterEventsBySelections(liveSoccerEvents, selectedLeagueIds, selectedCompetitorIds, selectedCompetitionIds),
    [liveSoccerEvents, selectedLeagueIds, selectedCompetitorIds, selectedCompetitionIds],
  )
  const hasLiveFilters = selectedLeagueIds.length > 0 || selectedCompetitorIds.length > 0 || selectedCompetitionIds.length > 0
  const eventPageCount = pageCountFor(leagueEvents.length)
  const eventPageKey = `soccer:${selectedLeagueIds.join(',')}:${selectedCompetitorIds.join(',')}:${selectedCompetitionIds.join(',')}`
  const eventPage = activePageFor(eventPager, eventPageKey, eventPageCount)
  const pagedLeagueEvents = useMemo(
    () => leagueEvents.slice((eventPage - 1) * SCHEDULE_PAGE_SIZE, eventPage * SCHEDULE_PAGE_SIZE),
    [leagueEvents, eventPage],
  )

  function changeEventPage(page: number) {
    setEventPager({ key: eventPageKey, page })
    setExpandedEventId(null)
  }

  function addEventToSchedule(event: LiveEvent) {
    downloadBlob(createMultiSportIcsBlob([event], { reminderMinutes: [60] }), exportFilename('event', 'ics'))
    setAddedEventIds((current) => (current.includes(event.id) ? current : [...current, event.id]))
  }

  return (
    <div className="space-y-4">
      <DataFreshness lastUpdated={lastUpdated} />
      <SportEntityFilters
        leagues={otherLeagues}
        events={liveSoccerEvents}
        selectedLeagueIds={selectedLeagueIds}
        selectedCompetitorIds={selectedCompetitorIds}
        selectedCompetitionIds={selectedCompetitionIds}
        followedLeagueIds={followedLeagueIds}
        followedCompetitorIds={followedCompetitorIds}
        competitorLabel="Teams"
        competitionLabel="Cups / Competitions"
        emptyCompetitionsLabel="Cup and tournament filters appear when those fixtures are in the live window."
        onToggleLeague={(id) => setSelectedLeagueIds((current) => toggleId(current, id))}
        onToggleCompetitor={(id) => setSelectedCompetitorIds((current) => toggleId(current, id))}
        onToggleCompetition={(id) => setSelectedCompetitionIds((current) => toggleId(current, id))}
        onToggleLeagueFollow={(league) => toggleFollow({ targetType: 'league', targetId: league.id, intent: 'watch' })}
        onToggleCompetitorFollow={(competitor) => toggleFollow({ targetType: 'competitor', targetId: competitor.id, intent: 'watch' })}
        onClear={() => {
          setSelectedLeagueIds([])
          setSelectedCompetitorIds([])
          setSelectedCompetitionIds([])
        }}
      />

      {!hasLiveFilters ? (
        <WorldCupPlanner />
      ) : (
        <section className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-extrabold text-primary">
                {filterSummary('Soccer', selectedLeagueIds, selectedCompetitorIds, selectedCompetitionIds)}
              </h1>
              <p className="text-sm text-ink/60">
                {leagueEvents.length} upcoming - shown in {prefs.timezone}
              </p>
            </div>
          </div>
          {leagueEvents.length > 0 ? (
            <>
              <SchedulePagination page={eventPage} pageCount={eventPageCount} total={leagueEvents.length} onPageChange={changeEventPage} label="fixtures" />
              {interleaveAds(pagedLeagueEvents, (e) => e.id, 6).map((entry) =>
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
              <SchedulePagination page={eventPage} pageCount={eventPageCount} total={leagueEvents.length} onPageChange={changeEventPage} label="fixtures" />
            </>
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
  const [savedMatchKeys, setSavedMatchKeys] = useState<string[]>(() => getSavedMatchKeys())
  const [matchPager, setMatchPager] = useState({ key: 'all', page: 1 })
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

  // Match list shows upcoming only (no finished games); the kit wall below still derives from the
  // full set so every nation stays followable even after its group games have played.
  const filteredMatches = useMemo(
    () => filterUpcomingMatches(filterMatchesForTeams(matches, followedTeams)),
    [matches, followedTeams],
  )
  // Overlap is a personal-schedule signal: only flag clashes once the user has narrowed to their
  // teams. On the full browse (no follows) every match has a simultaneous twin, which is just noise.
  const conflicts = useMemo(
    () =>
      followedTeams.length
        ? findConflictTiers(filteredMatches.map((m) => ({ startsAt: m.startsAt, sportKey: 'soccer' })))
        : new Map<number, OverlapTier>(),
    [filteredMatches, followedTeams],
  )
  const matchPageCount = pageCountFor(filteredMatches.length)
  const followedTeamSignature = followedTeams.join('|')
  const matchPageKey = followedTeamSignature || 'all'
  const matchPage = activePageFor(matchPager, matchPageKey, matchPageCount)
  const pagedMatches = useMemo(
    () =>
      filteredMatches
        .map((match, index) => ({ match, index }))
        .slice((matchPage - 1) * SCHEDULE_PAGE_SIZE, matchPage * SCHEDULE_PAGE_SIZE),
    [filteredMatches, matchPage],
  )
  const popularPicksActive = featuredTeams.every((team) => followedTeams.includes(team))

  function changeMatchPage(page: number) {
    setMatchPager({ key: matchPageKey, page })
  }

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

  // Add/remove the match from My Schedule (persisted) — no surprise file download.
  function addMatchToSchedule(match: Match) {
    setSavedMatchKeys(toggleSavedMatch(matchKey(match)))
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

      <Panel className="border-primary/20 bg-surface/85">
        <PanelHeading title={`Where to watch in ${prefs.regionCode || 'US'}`} subtitle="Official World Cup broadcaster routes">
          <Tv size={18} className="text-primary" />
        </PanelHeading>
        <WatchOptionsPanel
          leagueName="FIFA World Cup 2026"
          sportKey="soccer"
          regionCode={prefs.regionCode}
          locale={prefs.locale}
          limit={4}
          compact
        />
      </Panel>

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
          <SchedulePagination page={matchPage} pageCount={matchPageCount} total={filteredMatches.length} onPageChange={changeMatchPage} label="matches" />
            {pagedMatches.map(({ match, index }) => (
              <MatchCard
                key={`${match.date}-${match.team1}-${match.team2}`}
                match={match}
                timeZone={timeZone}
                conflict={conflicts.get(index) ?? null}
                highlightTeams={followedTeams}
                locale={prefs.locale}
                hour12={prefs.hour12}
                addedToSchedule={savedMatchKeys.includes(matchKey(match))}
                onAddToSchedule={() => addMatchToSchedule(match)}
                regionCode={prefs.broadcastRegion || prefs.regionCode}
              />
            ))}
          <SchedulePagination page={matchPage} pageCount={matchPageCount} total={filteredMatches.length} onPageChange={changeMatchPage} label="matches" />
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
  // Motorsport reads better as race weekends than a flat session list — group it (see raceWeekends.ts).
  const isMotorsport = canonical === 'motorsport'
  const { leagues, events, loading, configured, lastUpdated } = useSportSchedule(canonical)
  const roster = useSportRoster(canonical, isIndividual)
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<string[]>([])
  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState<string[]>([])
  const [selectedCompetitionIds, setSelectedCompetitionIds] = useState<string[]>([])
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [addedEventIds, setAddedEventIds] = useState<string[]>([])
  const [eventPager, setEventPager] = useState({ key: `${canonical}:all`, page: 1 })

  const shownEvents = useMemo(
    () => filterEventsBySelections(events, selectedLeagueIds, selectedCompetitorIds, selectedCompetitionIds),
    [events, selectedLeagueIds, selectedCompetitorIds, selectedCompetitionIds],
  )
  const raceWeekends = useMemo(
    () => (isMotorsport ? groupRaceWeekends(shownEvents) : []),
    [isMotorsport, shownEvents],
  )
  const eventPageCount = pageCountFor(shownEvents.length)
  const eventPageKey = `${canonical}:${selectedLeagueIds.join(',')}:${selectedCompetitorIds.join(',')}:${selectedCompetitionIds.join(',')}`
  const eventPage = activePageFor(eventPager, eventPageKey, eventPageCount)
  const pagedShownEvents = useMemo(
    () => shownEvents.slice((eventPage - 1) * SCHEDULE_PAGE_SIZE, eventPage * SCHEDULE_PAGE_SIZE),
    [shownEvents, eventPage],
  )
  const hasFilters = selectedLeagueIds.length > 0 || selectedCompetitorIds.length > 0 || selectedCompetitionIds.length > 0
  const seasonReturn = hasFilters ? null : seasonReturnFor(canonical)

  function changeEventPage(page: number) {
    setEventPager({ key: eventPageKey, page })
    setExpandedEventId(null)
  }

  function addEventToSchedule(event: LiveEvent) {
    downloadBlob(createMultiSportIcsBlob([event], { reminderMinutes: [60] }), exportFilename('event', 'ics'))
    setAddedEventIds((current) => (current.includes(event.id) ? current : [...current, event.id]))
  }

  function addWeekendToSchedule(weekend: RaceWeekend<LiveEvent>) {
    const events = weekend.sessions.map((s) => s.event)
    downloadBlob(createMultiSportIcsBlob(events, { reminderMinutes: [60] }), exportFilename('race-weekend', 'ics'))
    setAddedEventIds((current) => {
      const next = new Set(current)
      for (const event of events) next.add(event.id)
      return [...next]
    })
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
      : { value: pluralizeEventNoun(sport.eventNoun), label: 'Tracked' },
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
          <SportEntityFilters
            leagues={leagues}
            events={events}
            selectedLeagueIds={selectedLeagueIds}
            selectedCompetitorIds={selectedCompetitorIds}
            selectedCompetitionIds={selectedCompetitionIds}
            followedLeagueIds={followedLeagueIds}
            followedCompetitorIds={followedCompetitorIds}
            competitorLabel={isIndividual ? 'Players' : 'Teams'}
            competitionLabel={isMotorsport ? 'Sessions / GPs' : isIndividual ? 'Tournaments' : 'Cups / Competitions'}
            emptyCompetitionsLabel={isMotorsport
              ? 'Session and Grand Prix filters appear when race weekends are in the current schedule.'
              : `${sport.label} competition filters appear when the current schedule has cups, playoffs, tournaments, or session types.`}
            showCompetitors={!isMotorsport}
            onToggleLeague={(id) => setSelectedLeagueIds((current) => toggleId(current, id))}
            onToggleCompetitor={(id) => setSelectedCompetitorIds((current) => toggleId(current, id))}
            onToggleCompetition={(id) => setSelectedCompetitionIds((current) => toggleId(current, id))}
            onToggleLeagueFollow={(league) => toggleFollow({ targetType: 'league', targetId: league.id, intent: 'watch' })}
            onToggleCompetitorFollow={(competitor) => toggleFollow({ targetType: 'competitor', targetId: competitor.id, intent: 'watch' })}
            onClear={() => {
              setSelectedLeagueIds([])
              setSelectedCompetitorIds([])
              setSelectedCompetitionIds([])
            }}
          />

          <div className={`grid gap-4 ${isIndividual ? 'lg:grid-cols-[1fr_320px]' : ''}`}>
            <section className="min-w-0 space-y-3">
              {isMotorsport && raceWeekends.length > 0 ? (
                <>
                  <p className="text-sm font-semibold text-ink/60">
                    {raceWeekends.length} race {raceWeekends.length === 1 ? 'weekend' : 'weekends'} upcoming
                  </p>
                  {raceWeekends.map((weekend) => (
                    <RaceWeekendCard
                      key={weekend.key}
                      weekend={weekend}
                      locale={prefs.locale}
                      hour12={prefs.hour12}
                      timeZone={prefs.timezone}
                      addedIds={addedEventIds}
                      onAddSession={addEventToSchedule}
                      onAddWeekend={() => addWeekendToSchedule(weekend)}
                    />
                  ))}
                </>
              ) : shownEvents.length > 0 ? (
                <>
                  <p className="text-sm font-semibold text-ink/60">{shownEvents.length} upcoming</p>
                  <SchedulePagination page={eventPage} pageCount={eventPageCount} total={shownEvents.length} onPageChange={changeEventPage} label="events" />
                  {interleaveAds(pagedShownEvents, (e) => e.id, 6).map((entry) =>
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
                  <SchedulePagination page={eventPage} pageCount={eventPageCount} total={shownEvents.length} onPageChange={changeEventPage} label="events" />
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
                <CoverageStandbyNotice
                  sport={sport}
                  leagueCount={leagues.length}
                  playerCount={roster.players.length}
                  isIndividual={isIndividual}
                  selectedLeagueName={hasFilters ? 'those filters' : null}
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

function CoverageStandbyNotice({
  sport,
  leagueCount,
  playerCount,
  isIndividual,
  selectedLeagueName,
}: {
  sport: SportInfo
  leagueCount: number
  playerCount: number
  isIndividual: boolean
  selectedLeagueName: string | null
}) {
  const title = selectedLeagueName
    ? `No upcoming ${selectedLeagueName} events right now`
    : `No upcoming ${sport.label} events right now`
  const body = selectedLeagueName
    ? 'This league is connected, but it has no scheduled events in the window yet — usually an off-season gap or before the next fixtures are published. New events appear here automatically.'
    : `${sport.label} leagues and competitors are connected, but there are no scheduled events in the window yet. This happens off-season or before the next fixtures are published — new events appear here automatically, no action needed.`

  return (
    <Panel className="overflow-hidden border-primary/20 bg-surface/90 p-0">
      <div className="grid gap-0 md:grid-cols-[150px_1fr]">
        <div className="flex flex-col justify-between bg-ticket-stub p-4 text-ticket-stub-text">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ticket-stub-text/75">
            Standby
          </span>
          <strong className="mt-6 font-head text-2xl leading-none">No events</strong>
          <span className="mt-2 font-mono text-[9px] uppercase tracking-wide text-ticket-stub-text/70">
            Auto-sync lane
          </span>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">Connected · awaiting fixtures</p>
            <h3 className="mt-1 text-xl font-extrabold text-primary">{title}</h3>
            <p className="mt-2 max-w-3xl text-sm text-ink/65">{body}</p>
          </div>
          <dl className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-primary/15 bg-page/45 px-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-wide text-ink/45">Leagues ready</dt>
              <dd className="text-sm font-extrabold text-ink">{leagueCount}</dd>
            </div>
            <div className="rounded-lg border border-primary/15 bg-page/45 px-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-wide text-ink/45">
                {isIndividual ? 'Players tracked' : 'Event type'}
              </dt>
              <dd className="truncate text-sm font-extrabold text-ink">
                {isIndividual ? (playerCount >= 500 ? '500+' : playerCount) : pluralizeEventNoun(sport.eventNoun)}
              </dd>
            </div>
            <div className="rounded-lg border border-primary/15 bg-page/45 px-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-wide text-ink/45">Next update</dt>
              <dd className="text-sm font-extrabold text-ink">Automatic</dd>
            </div>
          </dl>
        </div>
      </div>
    </Panel>
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

type FilterMode = 'leagues' | 'competitors' | 'competitions'

type FilterOption = {
  id: string
  label: string
  count: number
  meta?: string
  logoUrl?: string | null
  source?: 'schedule' | 'supported'
}

const FILTER_MODES: Array<{ id: FilterMode; label: string; icon: typeof Trophy }> = [
  { id: 'leagues', label: 'Leagues', icon: Flag },
  { id: 'competitors', label: 'Teams', icon: Users },
  { id: 'competitions', label: 'Cups', icon: Trophy },
]

function toggleId(current: string[], id: string) {
  return current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
}

function filterSummary(label: string, leagueIds: string[], competitorIds: string[], competitionIds: string[]) {
  const count = leagueIds.length + competitorIds.length + competitionIds.length
  return count ? `${label} filters (${count})` : label
}

function slugifyFilter(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function initialsForFilter(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function leagueOptionsWithCounts(leagues: Array<{ id: string; name: string; logoUrl?: string | null }>, events: LiveEvent[]): FilterOption[] {
  const counts = new Map<string, number>()
  for (const event of events) {
    if (event.leagueId) counts.set(event.leagueId, (counts.get(event.leagueId) ?? 0) + 1)
  }
  return leagues.map((league) => {
    const count = counts.get(league.id) ?? 0
    return {
      id: league.id,
      label: league.name,
      count,
      meta: count ? 'Scheduled now' : 'No current schedule',
      logoUrl: league.logoUrl,
      source: count ? 'schedule' : 'supported',
    }
  })
}

function competitorOptionsFromEvents(events: LiveEvent[]): FilterOption[] {
  const options = new Map<string, FilterOption>()
  for (const event of events) {
    for (const competitor of event.participants ?? []) {
      const current = options.get(competitor.id)
      options.set(competitor.id, {
        id: competitor.id,
        label: competitor.name,
        count: (current?.count ?? 0) + 1,
        meta: competitor.country ?? readableSportFact(competitor.kind),
        logoUrl: current?.logoUrl ?? competitor.logoUrl,
      })
    }
  }
  return [...options.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function isCompetitionLikeLeague(name: string) {
  return /\b(cup|trophy|champions|championship|tournament|open|masters|prix|grand prix|playoffs?|finals?|bowl|classic|series|league cup|nations|world)\b/i.test(name)
}

function stageOptionForTitle(title: string): FilterOption | null {
  const match = /\b(final|semifinal|semi-final|quarterfinal|quarter-final|playoff|play-off|qualifying|qualification|sprint|practice|race|heat|main card|prelims?)\b/.exec(title.toLowerCase())
  if (!match) return null
  const label = readableSportFact(match[1].replace('-', '_'))
  return { id: `stage:${slugifyFilter(label)}`, label, count: 1, meta: 'Stage' }
}

function kindOptionForEvent(event: LiveEvent): FilterOption | null {
  const raw = event.kind
  if (!raw) return null
  const label = readableSportFact(raw)
  return { id: `kind:${slugifyFilter(raw)}`, label, count: 1, meta: 'Format' }
}

function competitionKeysForEvent(event: LiveEvent) {
  const keys: string[] = []
  if (event.leagueName && isCompetitionLikeLeague(event.leagueName)) keys.push(`league:${event.leagueId ?? slugifyFilter(event.leagueName)}`)
  if (event.sportKey === 'motorsport') {
    const { weekend } = parseRaceWeekendTitle(event.title)
    if (weekend) keys.push(`weekend:${slugifyFilter(weekend)}`)
  }
  const stage = stageOptionForTitle(event.title)
  if (stage) keys.push(stage.id)
  const kind = kindOptionForEvent(event)
  if (kind) keys.push(kind.id)
  return keys
}

function competitionOptionsFromEvents(
  events: LiveEvent[],
  leagues: Array<{ id: string; name: string; logoUrl?: string | null }>,
): FilterOption[] {
  const options = new Map<string, FilterOption>()
  function add(option: FilterOption) {
    const current = options.get(option.id)
    const count = (current?.count ?? 0) + option.count
    options.set(option.id, {
      ...option,
      count,
      logoUrl: option.logoUrl ?? current?.logoUrl,
      source: count ? 'schedule' : option.source ?? current?.source,
    })
  }
  for (const league of leagues) {
    if (isCompetitionLikeLeague(league.name)) {
      add({
        id: `league:${league.id}`,
        label: league.name,
        count: 0,
        meta: 'No current schedule',
        logoUrl: league.logoUrl,
        source: 'supported',
      })
    }
  }
  for (const event of events) {
    if (event.sportKey === 'motorsport') {
      const { weekend } = parseRaceWeekendTitle(event.title)
      if (weekend) {
        add({
          id: `weekend:${slugifyFilter(weekend)}`,
          label: weekend,
          count: 1,
          meta: event.venue ?? event.leagueName,
          source: 'schedule',
        })
      }
    }
    if (event.leagueName && isCompetitionLikeLeague(event.leagueName)) {
      add({
        id: `league:${event.leagueId ?? slugifyFilter(event.leagueName)}`,
        label: event.leagueName,
        count: 1,
        meta: 'Competition',
        source: 'schedule',
      })
    }
    const stage = stageOptionForTitle(event.title)
    if (stage) add(stage)
    const kind = kindOptionForEvent(event)
    if (kind) add(kind)
  }
  return [...options.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function filterEventsBySelections(events: LiveEvent[], leagueIds: string[], competitorIds: string[], competitionIds: string[]) {
  const leagueSet = new Set(leagueIds)
  const competitorSet = new Set(competitorIds)
  const competitionSet = new Set(competitionIds)
  return events.filter((event) => {
    const leagueOk = leagueSet.size === 0 || (event.leagueId ? leagueSet.has(event.leagueId) : false)
    const competitorOk = competitorSet.size === 0 || (event.participants ?? []).some((competitor) => competitorSet.has(competitor.id))
    const competitionOk = competitionSet.size === 0 || competitionKeysForEvent(event).some((key) => competitionSet.has(key))
    return leagueOk && competitorOk && competitionOk
  })
}

function FilterLogo({ option, selected, mode }: { option: FilterOption; selected: boolean; mode: FilterMode }) {
  if (option.logoUrl) {
    return (
      <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[10px] font-extrabold ${selected ? 'border-void/30 bg-void/15 text-void' : 'border-primary/15 bg-page/80 text-primary'}`}>
        {initialsForFilter(option.label)}
        <img
          src={option.logoUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full bg-page object-contain p-0.5"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      </span>
    )
  }

  const Icon = mode === 'competitions' ? Trophy : mode === 'leagues' ? Flag : Users
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-extrabold ${selected ? 'border-void/30 bg-void/15 text-void' : 'border-primary/15 bg-primary/8 text-primary'}`}>
      {mode === 'competitions' ? <Icon size={13} /> : initialsForFilter(option.label)}
    </span>
  )
}

function ParticipantMarks({ participants }: { participants?: LiveEvent['participants'] }) {
  const shown = (participants ?? []).slice(0, 3)
  if (!shown.length) return null
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {shown.map((participant) => (
          <span
            key={participant.id}
            title={participant.name}
            className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-paper-ink/10 bg-page text-[9px] font-extrabold text-primary shadow-sm"
          >
            {initialsForFilter(participant.name)}
            {participant.logoUrl && (
              <img
                src={participant.logoUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full bg-page object-contain p-0.5"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            )}
          </span>
        ))}
      </div>
      <span className="truncate text-xs font-semibold text-paper-ink/55">
        {shown.map((participant) => participant.name).join(' / ')}
      </span>
    </div>
  )
}

function eventProviderImage(event: LiveEvent): string | null {
  const circuit = event.metadata?.circuit
  if (circuit && typeof circuit === 'object' && 'image' in circuit) {
    const image = (circuit as { image?: unknown }).image
    return typeof image === 'string' && image ? image : null
  }
  return null
}

function SportEntityFilters({
  leagues,
  events,
  selectedLeagueIds,
  selectedCompetitorIds,
  selectedCompetitionIds,
  followedLeagueIds,
  followedCompetitorIds,
  competitorLabel,
  competitionLabel,
  emptyCompetitionsLabel,
  onToggleLeague,
  onToggleCompetitor,
  onToggleCompetition,
  onToggleLeagueFollow,
  onToggleCompetitorFollow,
  onClear,
  showCompetitors = true,
}: {
  leagues: Array<{ id: string; name: string; logoUrl?: string | null }>
  events: LiveEvent[]
  selectedLeagueIds: string[]
  selectedCompetitorIds: string[]
  selectedCompetitionIds: string[]
  followedLeagueIds: string[]
  followedCompetitorIds: string[]
  competitorLabel: string
  competitionLabel: string
  emptyCompetitionsLabel: string
  onToggleLeague: (id: string) => void
  onToggleCompetitor: (id: string) => void
  onToggleCompetition: (id: string) => void
  onToggleLeagueFollow: (league: { id: string; name: string }) => void
  onToggleCompetitorFollow: (competitor: { id: string; name: string }) => void
  onClear: () => void
  showCompetitors?: boolean
}) {
  const [mode, setMode] = useState<FilterMode>('leagues')
  const [query, setQuery] = useState('')
  const filterModes = useMemo(
    () => FILTER_MODES.filter((item) => showCompetitors || item.id !== 'competitors'),
    [showCompetitors],
  )
  const activeMode = filterModes.some((item) => item.id === mode) ? mode : filterModes[0]?.id ?? 'leagues'
  const leagueOptions = useMemo(() => leagueOptionsWithCounts(leagues, events), [leagues, events])
  const competitorOptions = useMemo(() => competitorOptionsFromEvents(events), [events])
  const competitionOptions = useMemo(() => competitionOptionsFromEvents(events, leagues), [events, leagues])
  const selectedByMode = { leagues: selectedLeagueIds, competitors: selectedCompetitorIds, competitions: selectedCompetitionIds }
  const activeIds = selectedByMode[activeMode]
  const allSelectedCount = selectedLeagueIds.length + selectedCompetitorIds.length + selectedCompetitionIds.length
  const followedLeagues = useMemo(() => new Set(followedLeagueIds), [followedLeagueIds])
  const followedCompetitors = useMemo(() => new Set(followedCompetitorIds), [followedCompetitorIds])
  const modeOptions = activeMode === 'leagues' ? leagueOptions : activeMode === 'competitors' ? competitorOptions : competitionOptions
  const visibleOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? modeOptions.filter((option) => option.label.toLowerCase().includes(q) || option.meta?.toLowerCase().includes(q)) : modeOptions
  }, [modeOptions, query])
  const groupedVisibleOptions = useMemo(() => ({
    scheduled: visibleOptions.filter((option) => option.count > 0),
    supported: visibleOptions.filter((option) => option.count === 0),
  }), [visibleOptions])

  function toggleOption(id: string) {
    if (activeMode === 'leagues') onToggleLeague(id)
    else if (activeMode === 'competitors') onToggleCompetitor(id)
    else onToggleCompetition(id)
  }

  function optionFollowButton(option: FilterOption) {
    if (activeMode === 'competitions') return null
    const followed = activeMode === 'leagues' ? followedLeagues.has(option.id) : followedCompetitors.has(option.id)
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          if (activeMode === 'leagues') onToggleLeagueFollow({ id: option.id, name: option.label })
          else onToggleCompetitorFollow({ id: option.id, name: option.label })
        }}
        aria-pressed={followed}
        title={followed ? `Following ${option.label}` : `Follow ${option.label}`}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${followed ? 'text-primary' : 'text-ink/35 hover:bg-primary/10 hover:text-primary'}`}
      >
        <Star size={13} className={followed ? 'fill-primary' : ''} />
      </button>
    )
  }

  return (
    <Panel className="motion-filter-panel space-y-3 border-primary/20 bg-surface/80">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className={`grid gap-1 rounded-xl border border-primary/15 bg-page/50 p-1 ${filterModes.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {filterModes.map((item) => {
            const Icon = item.icon
            const count = selectedByMode[item.id].length
            const label = item.id === 'competitors' ? competitorLabel : item.id === 'competitions' ? competitionLabel : item.label
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMode(item.id)
                  setQuery('')
                }}
                className={`motion-filter-tab relative flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-colors ${activeMode === item.id ? 'is-active bg-primary text-void' : 'text-ink/65 hover:bg-primary/10 hover:text-primary'}`}
              >
                <Icon size={14} />
                <span className="hidden truncate sm:inline">{label}</span>
                <span className="truncate sm:hidden">{item.id === 'competitions' ? 'Cups' : label}</span>
                {count > 0 && <span className="font-mono text-[10px] opacity-75">{count}</span>}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 min-w-[210px] flex-1 items-center gap-2 rounded-lg border border-primary/20 bg-page/60 px-3 md:flex-none">
            <Search size={15} className="text-ink/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${activeMode === 'leagues' ? 'leagues' : activeMode === 'competitors' ? competitorLabel.toLowerCase() : competitionLabel.toLowerCase()}`}
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink/40"
            />
          </label>
          {allSelectedCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-primary/20 px-3 text-xs font-bold text-ink/60 transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="silbo-scrollbar flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
        {groupedVisibleOptions.scheduled.map((option) => {
          const selected = activeIds.includes(option.id)
          return (
            <div
              key={option.id}
              role="button"
              tabIndex={0}
              onClick={() => toggleOption(option.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  toggleOption(option.id)
                }
              }}
              aria-pressed={selected}
              className={`motion-filter-pill relative flex min-h-9 max-w-full items-center gap-1.5 rounded-full border py-1 pl-2 pr-3 text-left transition-colors ${selected ? 'is-selected border-primary bg-primary text-void' : 'border-primary/25 text-ink/75 hover:bg-primary/10 hover:text-primary'}`}
            >
              {optionFollowButton(option)}
              <FilterLogo option={option} selected={selected} mode={activeMode} />
              <span className="max-w-[220px] truncate text-xs font-bold">{option.label}</span>
              <span className={`font-mono text-[10px] ${selected ? 'text-void/70' : 'text-ink/40'}`}>{option.count}</span>
              {selected && activeMode === 'competitors' && (
                <Link
                  to={`/teams/${option.id}`}
                  onClick={(event) => event.stopPropagation()}
                  title={`Open ${option.label} page`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-current/75 hover:text-current"
                >
                  <ArrowUpRight size={13} />
                </Link>
              )}
            </div>
          )
        })}
        {groupedVisibleOptions.supported.length > 0 && (
          <div className="flex basis-full items-center gap-2 pt-1">
            <span className="h-px flex-1 bg-primary/10" />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink/35">
              No current schedule
            </span>
            <span className="h-px flex-1 bg-primary/10" />
          </div>
        )}
        {groupedVisibleOptions.supported.map((option) => {
          const selected = activeIds.includes(option.id)
          return (
            <div
              key={option.id}
              role="button"
              tabIndex={0}
              onClick={() => toggleOption(option.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  toggleOption(option.id)
                }
              }}
              aria-pressed={selected}
              className={`motion-filter-pill relative flex min-h-9 max-w-full items-center gap-1.5 rounded-full border py-1 pl-2 pr-3 text-left transition-colors ${
                selected
                  ? 'is-selected border-primary bg-primary/80 text-void'
                  : 'border-primary/15 bg-page/35 text-ink/45 hover:bg-primary/8 hover:text-ink/70'
              }`}
            >
              {optionFollowButton(option)}
              <FilterLogo option={option} selected={selected} mode={activeMode} />
              <span className="max-w-[220px] truncate text-xs font-bold">{option.label}</span>
              <span className={`font-mono text-[9px] uppercase ${selected ? 'text-void/70' : 'text-ink/35'}`}>Soon</span>
              {selected && activeMode === 'competitors' && (
                <Link
                  to={`/teams/${option.id}`}
                  onClick={(event) => event.stopPropagation()}
                  title={`Open ${option.label} page`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-current/75 hover:text-current"
                >
                  <ArrowUpRight size={13} />
                </Link>
              )}
            </div>
          )
        })}
        {visibleOptions.length === 0 && (
          <p className="px-1 py-2 text-sm text-ink/50">
            {mode === 'competitions' ? emptyCompetitionsLabel : `No ${mode === 'leagues' ? 'leagues' : competitorLabel.toLowerCase()} match "${query}".`}
          </p>
        )}
      </div>
    </Panel>
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
        active ? 'border-primary bg-primary/15 text-primary' : 'border-primary/25 text-ink/60 hover:bg-primary/10 hover:text-primary'
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

// Follow-your-team pills: shown under the league selector once a league is picked. Each pill
// selects the team (filtering the schedule to its fixtures), carries a follow star (→ My Schedule,
// feeds, alerts), and deep-links to the durable /teams/:id page. Mirrors LeagueChip's visual
// language but compacted so a 20–30 team league still reads as one scrollable row.
function TeamChip({
  team,
  active,
  followed,
  onSelect,
  onToggleFollow,
}: {
  team: LeagueTeam
  active: boolean
  followed: boolean
  onSelect: (id: string | null) => void
  onToggleFollow: (team: LeagueTeam) => void
}) {
  return (
    <div
      className={`flex shrink-0 items-center gap-0.5 rounded-full border pl-1 pr-1.5 transition-colors ${
        active ? 'border-primary bg-primary/10' : 'border-primary/25 hover:border-primary/45'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggleFollow(team)}
        aria-pressed={followed}
        title={followed ? `Following ${team.name}` : `Follow ${team.name}`}
        className="flex h-7 w-7 items-center justify-center rounded-full text-ink/45 transition-colors hover:text-primary"
      >
        <Star size={12} className={followed ? 'fill-primary text-primary' : ''} />
      </button>
      <button
        type="button"
        onClick={() => onSelect(active ? null : team.id)}
        aria-pressed={active}
        className={`max-w-[150px] truncate py-1 text-xs font-semibold ${active ? 'text-primary' : 'text-ink/75'}`}
      >
        {team.name}
      </button>
      {active && (
        <Link
          to={`/teams/${team.id}`}
          title={`Open ${team.name} page`}
          className="flex h-6 w-6 items-center justify-center rounded-full text-primary/70 hover:text-primary"
        >
          <ArrowUpRight size={13} />
        </Link>
      )}
    </div>
  )
}

function TeamFilter({
  teams,
  selectedId,
  onSelect,
  followedIds = [],
  onToggleFollow,
}: {
  teams: LeagueTeam[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  followedIds?: string[]
  onToggleFollow: (team: LeagueTeam) => void
}) {
  const [query, setQuery] = useState('')
  const followedSet = useMemo(() => new Set(followedIds), [followedIds])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? teams.filter((t) => t.name.toLowerCase().includes(q)) : teams
  }, [teams, query])

  if (!teams.length) return null

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-primary/15 bg-surface/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
          <Star size={11} className="text-primary" /> Follow a team in this league
        </p>
        {teams.length > 10 && (
          <label className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-page/60 px-2.5 py-1">
            <Search size={12} className="text-ink/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find team"
              className="w-24 bg-transparent text-xs outline-none placeholder:text-ink/40"
            />
          </label>
        )}
      </div>
      <div className="silbo-scrollbar flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`flex h-9 shrink-0 items-center rounded-full border px-3 font-mono text-[11px] uppercase tracking-wide transition-colors ${
            selectedId === null ? 'border-primary bg-primary text-void' : 'border-primary/25 text-ink/70 hover:bg-primary/10'
          }`}
        >
          All teams
        </button>
        {filtered.map((team) => (
          <TeamChip
            key={team.id}
            team={team}
            active={selectedId === team.id}
            followed={followedSet.has(team.id)}
            onSelect={onSelect}
            onToggleFollow={onToggleFollow}
          />
        ))}
        {filtered.length === 0 && <span className="px-2 py-2 text-xs text-ink/50">No teams match “{query}”.</span>}
      </div>
    </div>
  )
}

void LeagueFilter
void TeamFilter

// Race weekend grouped from flat session events (F1 etc.). Header capsule + one row per session,
// each with its local day/time and an add button, plus an "add full weekend" shortcut.
function RaceWeekendCard({
  weekend,
  locale,
  hour12,
  timeZone,
  addedIds,
  onAddSession,
  onAddWeekend,
}: {
  weekend: RaceWeekend<LiveEvent>
  locale?: string
  hour12?: boolean | null
  timeZone: string
  addedIds: string[]
  onAddSession: (event: LiveEvent) => void
  onAddWeekend: () => void
}) {
  const opts = { locale, hour12: hour12 ?? undefined }
  const dateRange =
    weekend.start && weekend.end
      ? weekend.start.toDateString() === weekend.end.toDateString()
        ? formatLongDate(weekend.start, timeZone, opts)
        : `${formatDate(weekend.start, timeZone, opts)} – ${formatLongDate(weekend.end, timeZone, opts)}`
      : 'Dates to be confirmed'
  const allAdded = weekend.sessions.every((s) => addedIds.includes(s.event.id))
  const weekendImage = weekend.sessions.map((session) => eventProviderImage(session.event)).find(Boolean)

  return (
    <article className="motion-ticket overflow-hidden rounded-card border border-primary/20 bg-surface">
      <header className="flex flex-wrap items-stretch justify-between gap-3 border-b border-primary/12 bg-page/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/15 bg-primary/8 text-primary">
            <Flag size={18} />
            {weekendImage && (
              <img
                src={weekendImage}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-85"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-primary">{weekend.name}</h3>
            <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[11px] uppercase tracking-wide text-ink/50">
              <span>{dateRange}</span>
              {weekend.venue && <span>{weekend.venue}</span>}
              <span>
                {weekend.sessions.length} {weekend.sessions.length === 1 ? 'session' : 'sessions'}
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddWeekend}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
            allAdded ? 'ticket-added-pulse border-primary bg-primary/15 text-primary' : 'border-primary/30 text-ink/75 hover:bg-primary/10'
          }`}
        >
          <Download size={13} /> {allAdded ? 'Weekend added' : 'Add weekend'}
        </button>
      </header>
      <ul className="divide-y divide-primary/8">
        {weekend.sessions.map((session) => {
          const event = session.event
          const isRace = session.kind === 'race'
          const added = addedIds.includes(event.id)
          return (
            <li key={event.id} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                  isRace ? 'bg-primary/15 text-primary' : 'bg-ink/8 text-ink/55'
                }`}
                aria-hidden="true"
              >
                {isRace ? <Flag size={14} /> : <Timer size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${isRace ? 'font-bold text-ink' : 'font-medium text-ink/80'}`}>
                  {RACE_SESSION_LABELS[session.kind] === session.label
                    ? session.label
                    : session.label || RACE_SESSION_LABELS[session.kind]}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wide text-ink/45">
                  {event.startsAt && !event.startsAtTbd
                    ? `${formatDate(event.startsAt, timeZone, opts)} · ${formatTime(event.startsAt, timeZone, opts)}`
                    : 'Time TBD'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAddSession(event)}
                aria-label={`Add ${session.label} to schedule`}
                className={`shrink-0 rounded-lg border p-2 transition-colors ${
                  added ? 'ticket-added-pulse border-primary bg-primary/15 text-primary' : 'border-primary/25 text-ink/60 hover:bg-primary/10'
                }`}
              >
                {added ? <Check size={14} /> : <Download size={14} />}
              </button>
            </li>
          )
        })}
      </ul>
    </article>
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
      className={`motion-ticket ticket-paper group flex w-full items-stretch overflow-hidden max-sm:flex-col ${
        expanded ? 'is-expanded ring-2 ring-primary/25' : ''
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
          <ParticipantMarks participants={event.participants} />
          {isFightCard && (
            <p className="mt-2 text-xs font-semibold text-paper-ink/60">
              Open for card order, estimated bout times, and individual fight picks.
            </p>
          )}
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-2 border-l border-paper-ink/10 px-3 max-sm:border-l-0 max-sm:border-t max-sm:px-4 max-sm:py-3">
        <button
          type="button"
          onClick={onAdd}
          aria-live="polite"
          className={`inline-flex min-w-[116px] items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors max-sm:flex-1 ${
            added
              ? 'ticket-added-pulse border-ticket-stub bg-ticket-stub text-ticket-stub-text'
              : 'border-ticket-stub/30 text-paper-ink hover:bg-ticket-stub/10'
          }`}
        >
          <Download size={13} />
          {added ? 'Added!' : 'Add to schedule'}
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} details for ${event.title}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-paper-ink/8 text-paper-ink/70 transition-colors hover:bg-paper-ink/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
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
        <WatchOptionsPanel
          eventId={detail.id}
          leagueId={detail.leagueId}
          leagueName={detail.leagueName}
          sportKey={detail.sportKey}
          regionCode={prefs.regionCode}
          locale={prefs.locale}
          compact
        />
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-ink/70">
          <Bell size={12} /> Alert settings can watch time, participant, venue, and broadcast updates.
        </p>
      </div>

      {event.competitors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {event.competitors.map((competitor) => (
            <span key={competitor.id} className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 px-2 py-1 text-xs font-semibold text-ink/75">
              <span className="relative flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-primary/8 text-[8px] font-extrabold text-primary">
                {initialsForFilter(competitor.name)}
                {competitor.logoUrl && (
                  <img
                    src={competitor.logoUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full bg-page object-contain p-0.5"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                )}
              </span>
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
