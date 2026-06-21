import { ArrowRight, CalendarClock, Database, PlusCircle, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { SportAssetIcon } from '../components/SportAssetIcon'
import { Badge, Button, Panel, PanelHeading } from '../components/ui'
import { useSportSchedule } from '../data/liveSport'
import { secondarySports, sports, type SportInfo } from '../domain/sports'
import { getTheme, withSurfaceMode } from '../theme/themes'

const coreSports = sports.filter((sport) => sport.key !== 'custom')

const backlogSports = [
  'Badminton',
  'Table Tennis',
  'Squash',
  'Lacrosse',
  'Pickleball',
  'Netball',
  'Field Hockey',
  'Water Polo',
  'Esports',
  'Softball',
]

function LiveRouteCard({ sport, dense = false }: { sport: SportInfo; dense?: boolean }) {
  const { prefs } = useAppState()
  const schedule = useSportSchedule(sport.canonicalSportKey)
  const theme = withSurfaceMode(getTheme(sport.key), prefs.themeMode)
  const iconVariant = prefs.themeMode === 'program' ? 'brush' : 'neon3d'
  const liveReady = schedule.configured && !schedule.loading && (schedule.leagues.length > 0 || schedule.events.length > 0)
  const route = sport.key === 'custom' ? '/other-sports' : `/sports/${sport.key}`

  return (
    <Link
      to={route}
      className={`group grid h-full rounded-card border bg-surface/72 transition-colors hover:bg-primary/6 ${
        dense ? 'min-h-[132px] p-3' : 'min-h-[178px] p-4'
      }`}
      style={{ borderColor: `${theme.colors.primary}33` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <SportAssetIcon
            sportKey={sport.key}
            size={dense ? 'sm' : 'channel'}
            variant={iconVariant}
            label={`${sport.label} icon`}
          />
          <div className="min-w-0">
            <h2 className={`${dense ? 'text-base' : 'text-lg'} truncate font-black uppercase leading-none text-primary`}>
              {sport.label}
            </h2>
            <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-wide text-ink/45">
              {sport.flagshipLeague}
            </p>
          </div>
        </div>
        <Badge tone={liveReady ? 'secondary' : 'muted'}>
          {schedule.loading ? 'Checking' : liveReady ? 'Live route' : 'Queued'}
        </Badge>
      </div>

      <p className={`${dense ? 'mt-2 text-[13px]' : 'mt-3 text-sm'} line-clamp-2 leading-relaxed text-ink/62`}>
        {sport.tagline}
      </p>

      <div className="mt-4 flex items-center gap-3 self-end border-t border-primary/12 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
          {schedule.loading ? '...' : `${schedule.leagues.length} leagues`}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
          {schedule.loading ? '...' : `${schedule.events.length} upcoming`}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-sm font-bold text-primary">
          Open <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  )
}

export function ExplorePage() {
  const [query, setQuery] = useState('')

  const filteredSecondarySports = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return secondarySports
    return secondarySports.filter((sport) => {
      return (
        sport.label.toLowerCase().includes(q) ||
        sport.flagshipLeague.toLowerCase().includes(q) ||
        sport.tagline.toLowerCase().includes(q)
      )
    })
  }, [query])

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="relative overflow-hidden p-0">
          <div className="color-bars h-2 w-full" aria-hidden="true" />
          <div className="space-y-5 p-5 sm:p-6">
            <div className="max-w-3xl">
              <p className="board-label text-ink/45">Sports hub</p>
              <h1 className="mt-2 font-display text-3xl font-black uppercase leading-none text-primary sm:text-5xl">
                Pick the channel. Keep the schedule.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink/64 sm:text-base">
                Core sports get full channel pages. New live-route sports sit in their own expansion lane, with live
                counts visible before we promote them into the main dropdown.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to="/sports/baseball">
                <Button>
                  <CalendarClock size={16} /> Baseball channel
                </Button>
              </Link>
              <Link to="/other-sports">
                <Button variant="ghost">
                  <Database size={16} /> Live routes
                </Button>
              </Link>
              <Link to="/custom-leagues">
                <Button variant="ghost">
                  <PlusCircle size={16} /> Create league
                </Button>
              </Link>
            </div>
          </div>
        </Panel>

        <Panel className="h-full">
          <PanelHeading title="Coverage shape" subtitle="A quieter map of what is actually wired." >
            <Sparkles size={18} className="text-primary" />
          </PanelHeading>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-primary/10 px-3 py-3 text-center">
              <p className="font-display text-2xl font-black text-primary">{coreSports.length}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/45">Core</p>
            </div>
            <div className="rounded-lg bg-primary/10 px-3 py-3 text-center">
              <p className="font-display text-2xl font-black text-primary">{secondarySports.length}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/45">Expansion</p>
            </div>
            <div className="rounded-lg bg-primary/10 px-3 py-3 text-center">
              <p className="font-display text-2xl font-black text-primary">{backlogSports.length}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/45">Backlog</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink/60">
            This page is a launch board. The Sports dropdown stays compact; detailed coverage and long-tail decisions live here.
          </p>
        </Panel>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-primary">Core channels</h2>
            <p className="text-sm text-ink/60">First-class pages for sports already promoted into the main experience.</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">Dropdown lineup</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {coreSports.map((sport) => (
            <LiveRouteCard key={sport.key} sport={sport} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel className="h-fit lg:sticky lg:top-20">
          <PanelHeading title="Expansion lane" subtitle="Live-route sports without the wall of tiles.">
            <Database size={18} className="text-primary" />
          </PanelHeading>
          <label className="mb-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-page/60 px-3 py-2">
            <Search size={15} className="text-ink/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search live routes"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <Link to="/other-sports" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
            Open full long-tail page <ArrowRight size={14} />
          </Link>
        </Panel>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSecondarySports.map((sport) => (
            <LiveRouteCard key={sport.key} sport={sport} dense />
          ))}
          {filteredSecondarySports.length === 0 && (
            <Panel className="sm:col-span-2 xl:col-span-3">
              <p className="text-sm text-ink/55">No live routes match that search yet.</p>
            </Panel>
          )}
        </div>
      </section>
    </div>
  )
}
