import { Check, Search, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { CityPicker } from '../components/CityPicker'
import { MatchCard } from '../components/MatchCard'
import { SportChannelBanner } from '../components/SportChannelBanner'
import { Button, EmptyState, Panel, PanelHeading } from '../components/ui'
import { deriveTeams, filterMatchesForTeams, useMatches } from '../data/liveMatches'
import { allMatches, featuredTeams } from '../data/worldcup'
import { getSport, type SportInfo } from '../domain/sports'
import { findConflicts } from '../lib/conflicts'

// Kit-wall memorabilia: each team row carries a jersey-stripe bar — deterministic two-color
// pattern from the team name (kit culture without anyone's actual kit).
const KIT_PAIRS: Array<[string, string]> = [
  ['#ff5247', '#f4ead8'],
  ['#46e8ff', '#16387c'],
  ['#54ff9f', '#0c5c31'],
  ['#ffd34d', '#1d1812'],
  ['#ff4fd8', '#f4ead8'],
  ['#7aa2ff', '#f4ead8'],
  ['#ffa94d', '#1d1812'],
  ['#d8ff49', '#155e38'],
]

function kitStripe(team: string) {
  let hash = 0
  for (const char of team) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const [a, b] = KIT_PAIRS[hash % KIT_PAIRS.length]
  return `repeating-linear-gradient(180deg, ${a} 0 5px, ${b} 5px 10px)`
}

const SKYLINE_COLORS = ['var(--mp-primary)', 'var(--mp-accent)', 'var(--color-neon-magenta)', 'var(--mp-export)']

export function SportPage() {
  const { sportKey = 'soccer' } = useParams()
  const sport = getSport(sportKey)

  if (!sport) {
    return <EmptyState title="Unknown sport" body="That sport is not in the catalog yet." />
  }

  if (!sport.enabled) {
    return <ComingSoonSportPage sport={sport} />
  }

  return <WorldCupPlanner />
}

function ComingSoonSportPage({ sport }: { sport: SportInfo }) {
  return (
    <div className="space-y-5">
      <SportChannelBanner
        title={`${sport.label} Channel`}
        kicker="Source testing capsule"
        sportKey={sport.key}
        body={`${sport.flagshipLeague} will light up as soon as licensed schedule data is connected. ${sport.sourceNote ?? 'Provider coverage is being reviewed.'}`}
        ctaLabel="Back to sports"
        ctaTo="/explore"
        stats={[
          { value: 'API', label: 'Review' },
          { value: 'Feeds', label: 'Planned' },
          { value: 'Alerts', label: 'Ready' },
          { value: 'Sync', label: 'Ready' },
        ]}
      />
    </div>
  )
}

function WorldCupPlanner() {
  const { followedTeams, toggleFollow, prefs } = useAppState()
  const [query, setQuery] = useState('')
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

  return (
    <div className="space-y-4">
      <SportChannelBanner
        title="World Cup '26"
        kicker={source === 'live' ? 'Channel 01 / Live tournament capsule' : 'Channel 01 / Bundled tournament capsule'}
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
                    style={{ background: kitStripe(team) }}
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
              />
            ))}
        </section>
      </div>
    </div>
  )
}
