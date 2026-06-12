import {
  Bell,
  CalendarDays,
  Camera,
  ChevronRight,
  Clock,
  FileText,
  Search,
  Sparkles,
  Trophy,
  Tv,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { GlobalEventBoard, PosterFeatureStrip } from '../components/PosterMotifs'
import { Button, Panel, PanelHeading } from '../components/ui'
import { WorldClock } from '../components/WorldClock'
import { deriveTeams, filterMatchesForTeams, useMatches } from '../data/liveMatches'
import { brand } from '../domain/brand'
import { associationFootballLabel, t } from '../lib/i18n'
import { formatLongDate, formatTime } from '../lib/time'
import { getTheme } from '../theme/themes'

const spotlightEvents = [
  {
    title: 'FIFA World Cup 2026',
    sportKey: 'soccer',
    label: 'Live now',
    detail: 'Follow countries, bracket slots, and kickoff changes.',
    href: '/sports/soccer',
  },
  {
    title: 'Formula 1 race weekends',
    sportKey: 'f1',
    label: 'Staged',
    detail: 'Practice, qualifying, sprint, and race sessions.',
    href: '/sports/f1',
  },
  {
    title: 'WNBA schedule tracking',
    sportKey: 'wnba',
    label: 'Source testing',
    detail: 'TheSportsDB premium, SportsDataIO, and Sportradar candidates.',
    href: '/sports/wnba',
  },
  {
    title: 'UFC / PFL fight cards',
    sportKey: 'ufc',
    label: 'Model ready',
    detail: 'Main cards, prelims, fighters, and late changes.',
    href: '/sports/ufc',
  },
  {
    title: 'CFL and Grey Cup path',
    sportKey: 'cfl',
    label: 'Canada focus',
    detail: 'Canadian kickoff times and broadcast-region fit.',
    href: '/sports/cfl',
  },
]

const exportPaths = [
  { icon: CalendarDays, title: 'Live calendar feeds', body: 'Subscribe once and let schedule changes update in place.' },
  { icon: Camera, title: 'Photo schedules', body: 'Readable poster exports for Photos, messages, and group chats.' },
  { icon: FileText, title: 'Notes text', body: 'Clean plain text grouped for notes, email, or family planning.' },
  { icon: Bell, title: 'Email and push alerts', body: 'Reminder and change alerts without SMS in the MVP.' },
]

function ProgramCoverCard({ event, index }: { event: (typeof spotlightEvents)[number]; index: number }) {
  const theme = getTheme(event.sportKey)
  const live = event.label === 'Live now'

  return (
    <Link to={event.href} className="min-w-[270px] snap-start sm:min-w-[340px]">
      <article
        className="group relative h-full min-h-[178px] overflow-hidden rounded-card border-2 bg-surface p-4 transition-transform hover:-translate-y-1"
        style={{
          borderColor: `${theme.colors.primary}55`,
          boxShadow: `inset 0 0 0 1px ${theme.colors.primary}14`,
        }}
      >
        <div
          className="absolute -right-14 -top-20 h-52 w-52 rounded-full opacity-25 transition-transform group-hover:scale-110"
          style={{
            background: `repeating-radial-gradient(circle, ${theme.colors.primary} 0 7px, transparent 7px 23px, ${theme.colors.accent} 23px 28px, transparent 28px 46px)`,
          }}
          aria-hidden="true"
        />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <span className={`flap ${live ? 'flap-ok' : index % 2 ? 'flap-tbd' : 'flap-chg'}`}>
              {event.label}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/40">
              Ch {String(index + 1).padStart(2, '0')}
            </span>
          </div>
          <div>
            <div className="mb-3 h-1.5 w-20 rounded-full" style={{ background: theme.colors.primary }} aria-hidden="true" />
            <h3 className="max-w-[15rem] text-xl font-black leading-tight" style={{ color: theme.colors.primary }}>
              {event.title}
            </h3>
            <p className="mt-2 text-sm text-ink/62">{event.detail}</p>
          </div>
        </div>
      </article>
    </Link>
  )
}

export function HomePage() {
  const { followedTeams, toggleFollow, prefs } = useAppState()
  const { matches } = useMatches()
  const [query, setQuery] = useState('')

  const upcomingMatches = useMemo(() => {
    return filterMatchesForTeams(matches, followedTeams).slice(0, 3)
  }, [followedTeams, matches])

  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const teams = deriveTeams(matches).slice(0, 80)
    if (!normalized) return teams.slice(0, 8)
    return teams.filter((team) => team.toLowerCase().includes(normalized)).slice(0, 8)
  }, [matches, query])

  function toggleTeam(team: string) {
    toggleFollow({ targetType: 'team', targetId: team, intent: 'watch' })
  }

  const footballLabel = associationFootballLabel(prefs.locale, prefs.regionCode)

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="rounded-card border border-primary/15 bg-surface p-5 shadow-sm sm:p-7">
          <div className="max-w-4xl">
            <div>
              <p className="board-label mb-4 flex items-center gap-2 text-neon-magenta">
                <Sparkles size={13} /> Whistle to whistle / in your timezone
              </p>
              <h1 className="chrome-text max-w-3xl text-4xl sm:text-6xl">
                {t('home.headline', undefined, prefs.locale)}
              </h1>
              <p className="mt-4 max-w-2xl text-base text-ink/65 sm:text-lg">
                {t('home.body', undefined, prefs.locale)}
              </p>

              <div className="mt-5">
                <WorldClock />
              </div>

              <div className="mt-5 rounded-xl border border-primary/20 bg-page/70 p-3">
                <label className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 shadow-sm">
                  <Search size={18} className="text-ink/40" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('home.searchPlaceholder', undefined, prefs.locale)}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((team) => {
                    const selected = followedTeams.includes(team)
                    return (
                      <button
                        type="button"
                        key={team}
                        onClick={() => toggleTeam(team)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                          selected ? 'bg-primary text-void' : 'bg-surface text-primary hover:bg-primary/10'
                        }`}
                      >
                        {selected ? 'Following ' : ''}
                        {team}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/sports/soccer">
                  <Button>{footballLabel}: World Cup</Button>
                </Link>
                <Link to="/explore">
                  <Button variant="ghost">{t('home.exploreSports', undefined, prefs.locale)}</Button>
                </Link>
                <Link to="/custom-leagues">
                  <Button variant="subtle">{t('home.createCustomLeague', undefined, prefs.locale)}</Button>
                </Link>
              </div>

              <div className="mt-6 grid gap-4 rounded-xl border border-primary/20 bg-page/60 p-4 sm:grid-cols-[auto_1fr]">
                <div className="manifesto-bars h-3 min-h-0 sm:h-auto sm:min-h-28" aria-hidden="true">
                  {['#54ff9f', '#46e8ff', '#ffd34d', '#ff4fd8', '#ff5247'].map((color) => (
                    <span key={color} style={{ backgroundColor: color }} />
                  ))}
                </div>
                <div>
                  <h2 className="max-w-2xl font-head text-2xl uppercase leading-none text-paper sm:text-4xl">
                    Every game, match, race, and card <span className="text-primary">in your calendar.</span>
                  </h2>
                  <p className="mt-2 max-w-xl text-sm text-ink/62">
                    Follow what you love across every sport and league. Sync, export, get alerted, and stay in the game.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        <Panel className="flex flex-col">
          <PanelHeading
            title={followedTeams.length ? 'Your next events' : 'Start with what you follow'}
            subtitle={`${prefs.timezone} local time`}
          >
            <Clock size={18} className="text-primary" />
          </PanelHeading>
          {upcomingMatches.length ? (
            <div className="space-y-2">
              {upcomingMatches.map((match) => (
                <Link
                  key={`${match.date}-${match.team1}-${match.team2}`}
                  to="/my-schedule"
                  className="block rounded-lg bg-page/70 px-3 py-2 hover:bg-primary/10"
                >
                  <p className="text-sm font-bold">
                    {match.team1} vs {match.team2}
                  </p>
                  <p className="text-xs text-ink/55">
                    {formatLongDate(match.startsAt, prefs.timezone, { locale: prefs.locale, hour12: prefs.hour12 ?? undefined })} at{' '}
                    {formatTime(match.startsAt, prefs.timezone, { locale: prefs.locale, hour12: prefs.hour12 ?? undefined })}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-center rounded-xl bg-page/70 p-4">
              <Trophy size={26} className="text-primary" />
              <p className="mt-3 text-sm text-ink/65">
                Pick a few teams, countries, players, drivers, leagues, or custom schedules. Your combined {brand.modules.schedule.toLowerCase()}
                appears here first.
              </p>
            </div>
          )}
          <Link to="/my-schedule" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">
            Continue to My Schedule <ChevronRight size={15} />
          </Link>
        </Panel>
      </section>

      <GlobalEventBoard events={spotlightEvents} variant="room" />

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-primary">{t('home.spotlightTitle', undefined, prefs.locale)}</h2>
            <p className="text-sm text-ink/60">{t('home.spotlightSubtitle', undefined, prefs.locale)}</p>
          </div>
          <Link to="/explore" className="text-sm font-bold text-primary">
            Explore all
          </Link>
        </div>
        <div className="silbo-scrollbar flex snap-x gap-3 overflow-x-auto pb-3">
          {spotlightEvents.map((event, index) => (
            <ProgramCoverCard key={event.title} event={event} index={index} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {exportPaths.map(({ icon: Icon, title, body }) => (
            <Panel key={title} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon size={19} />
              </span>
              <div>
                <h3 className="font-bold text-primary">{title}</h3>
                <p className="mt-1 text-sm text-ink/60">{body}</p>
              </div>
            </Panel>
          ))}
        </div>

        <div className="space-y-3">
          <Panel>
            <PanelHeading title="Where to watch" subtitle="Factual first, sponsored clearly labeled.">
              <Tv size={18} className="text-primary" />
            </PanelHeading>
            <p className="text-sm text-ink/60">
              Broadcast regions and provider links will sit on event pages once licensed source data is connected.
            </p>
          </Panel>
          <Panel>
            <PanelHeading title={t('home.customTitle', undefined, prefs.locale)} subtitle="Families, coaches, and local clubs." >
              <Users size={18} className="text-primary" />
            </PanelHeading>
            <Link to="/custom-leagues">
              <Button className="w-full" variant="export">
                Create a community schedule
              </Button>
            </Link>
          </Panel>
        </div>
      </section>

      <PosterFeatureStrip />
    </div>
  )
}
