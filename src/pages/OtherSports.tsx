import { ArrowRight, Database, Search, Sparkles, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { SportAssetIcon } from '../components/SportAssetIcon'
import { SportChannelBanner } from '../components/SportChannelBanner'
import { Badge, Panel, PanelHeading } from '../components/ui'
import { useSportSchedule } from '../data/liveSport'
import { secondarySports, type SportInfo } from '../domain/sports'

type CommunitySport = {
  name: string
  note: string
  lane: 'import' | 'provider-review' | 'community'
}

const providerBackedSports = secondarySports

const communitySports: CommunitySport[] = [
  { name: 'Badminton', note: 'BWF calendars and federation feeds', lane: 'provider-review' },
  { name: 'Table Tennis', note: 'ITTF tour, national leagues, and Olympics', lane: 'provider-review' },
  { name: 'Squash', note: 'PSA World Tour and club calendars', lane: 'provider-review' },
  { name: 'Lacrosse', note: 'PLL, World Lacrosse, school and club seasons', lane: 'community' },
  { name: 'Pickleball', note: 'PPA Tour, MLP, and local ladders', lane: 'provider-review' },
  { name: 'Netball', note: 'Domestic leagues and Commonwealth windows', lane: 'provider-review' },
  { name: 'Field Hockey', note: 'FIH, NCAA, club, and school fixtures', lane: 'provider-review' },
  { name: 'Water Polo', note: 'World Aquatics and college seasons', lane: 'provider-review' },
  { name: 'Esports', note: 'Majors across the big titles', lane: 'provider-review' },
  { name: 'Softball', note: 'College, pro, and tournament imports', lane: 'import' },
]

function laneLabel(lane: CommunitySport['lane']) {
  if (lane === 'import') return 'Import'
  if (lane === 'provider-review') return 'Review'
  return 'Community'
}

function OtherSportRouteCard({ sport }: { sport: SportInfo }) {
  const { prefs } = useAppState()
  const schedule = useSportSchedule(sport.canonicalSportKey)
  const liveReady = schedule.configured && !schedule.loading && (schedule.leagues.length > 0 || schedule.events.length > 0)
  const status = schedule.loading ? 'Checking' : liveReady ? 'DB route' : 'Queued'
  const href = `/sports/${sport.key}`
  const iconVariant = prefs.themeMode === 'program' ? 'brush' : 'neon3d'

  return (
    <Link
      to={href}
      className="group grid h-full min-h-[188px] grid-rows-[auto_1fr_auto] rounded-card border-2 border-primary/20 bg-surface/72 p-4 transition-colors hover:border-primary/50 hover:bg-primary/6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <SportAssetIcon sportKey={sport.key} size="sm" variant={iconVariant} label={`${sport.label} icon`} />
          <div className="min-w-0">
            <h3 className="truncate text-base font-black uppercase leading-none text-primary">{sport.label}</h3>
            <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-wide text-ink/45">
              {sport.flagshipLeague}
            </p>
          </div>
        </div>
        <Badge tone={liveReady ? 'secondary' : 'muted'} className="shrink-0 whitespace-nowrap text-[10px]">
          {status}
        </Badge>
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink/64">{sport.tagline}</p>

      <div className="mt-4 grid grid-cols-[auto_auto_minmax(3.5rem,1fr)] items-center gap-x-3 gap-y-1 border-t border-primary/12 pt-3">
        <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
          {schedule.loading ? '...' : `${schedule.leagues.length} leagues`}
        </span>
        <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
          {schedule.loading ? '...' : `${schedule.events.length} upcoming`}
        </span>
        <span className="inline-flex items-center justify-self-end whitespace-nowrap text-sm font-bold text-primary">
          Open <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  )
}

export function OtherSportsPage() {
  const [query, setQuery] = useState('')
  const [lane, setLane] = useState<'all' | CommunitySport['lane']>('all')

  const filteredCommunitySports = useMemo(() => {
    const q = query.trim().toLowerCase()
    return communitySports.filter((sport) => {
      const matchesLane = lane === 'all' || sport.lane === lane
      const matchesQuery = !q || sport.name.toLowerCase().includes(q) || sport.note.toLowerCase().includes(q)
      return matchesLane && matchesQuery
    })
  }, [lane, query])

  return (
    <div className="space-y-6">
      <SportChannelBanner
        sportKey="custom"
        kicker="Channel 12 / Long-tail sports"
        title="Other Sports"
        body="Provider-backed routes sit up top. Community and import-first sports stay below, so this page can grow without becoming a wall of identical tiles."
        ctaLabel="Create your own league"
        ctaTo="/custom-leagues"
        stats={[
          { value: String(providerBackedSports.length), label: 'DB routes' },
          { value: String(communitySports.length), label: 'Backlog' },
          { value: 'Your', label: 'League' },
        ]}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-primary">Provider-backed routes</h2>
            <p className="text-sm text-ink/60">
              Baseball is promoted as a full channel; the rest stay here until their coverage proves it deserves the top switcher.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
            <Database size={13} /> TheSportsDB allowlist
          </span>
        </div>

        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {providerBackedSports.map((sport) => (
            <OtherSportRouteCard key={sport.key} sport={sport} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel className="h-fit lg:sticky lg:top-20">
          <PanelHeading title="Find a sport" subtitle="Filter the long tail without flooding the page.">
            <Sparkles size={18} className="text-primary" />
          </PanelHeading>
          <label className="mb-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-page/60 px-3 py-2">
            <Search size={15} className="text-ink/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sports"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['all', 'provider-review', 'import', 'community'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLane(item)}
              className={`min-h-9 whitespace-nowrap rounded-lg border px-3 py-2 text-center font-mono text-[9px] uppercase tracking-[0.12em] transition-colors ${
                  lane === item ? 'border-primary bg-primary text-void' : 'border-primary/20 text-ink/60 hover:bg-primary/8'
                }`}
              >
                {item === 'all' ? 'All' : laneLabel(item)}
              </button>
            ))}
          </div>
          <Link
            to="/custom-leagues"
            className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-primary/25 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/8"
          >
            <Users size={15} /> Create a league
          </Link>
        </Panel>

        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCommunitySports.map((sport) => (
            <article
              key={sport.name}
              className="relative h-full min-h-[96px] overflow-hidden rounded-card border border-primary/18 bg-surface/64 px-4 py-3.5"
            >
              <div className="absolute inset-y-0 left-0 w-1.5 bg-primary/55" aria-hidden="true" />
              <div className="flex items-start justify-between gap-3 pl-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black uppercase leading-tight text-primary">{sport.name}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink/62">{sport.note}</p>
                </div>
                <span className="shrink-0 rounded-sm bg-primary/12 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-primary">
                  {laneLabel(sport.lane)}
                </span>
              </div>
            </article>
          ))}
          {filteredCommunitySports.length === 0 && (
            <Panel className="sm:col-span-2 xl:col-span-3">
              <p className="text-sm text-ink/55">No sports match that filter yet.</p>
            </Panel>
          )}
        </div>
      </section>
    </div>
  )
}
