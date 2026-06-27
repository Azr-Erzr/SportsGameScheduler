import {
  Bell,
  CalendarDays,
  Camera,
  ChevronRight,
  Clock,
  FileText,
  Sparkles,
  Trophy,
  Tv,
  Users,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { GlobalEventBoard, PosterFeatureStrip } from '../components/PosterMotifs'
import { GlobalSearch } from '../components/GlobalSearch'
import { Button, Panel, PanelHeading } from '../components/ui'
import { WorldClock } from '../components/WorldClock'
import { filterMatchesForTeams, filterUpcomingMatches, useMatches } from '../data/liveMatches'
import { featuredTeams } from '../data/worldcup'
import { dedupeSpotlightBySport, useSpotlightEvents, type SpotlightEvent } from '../data/spotlight'
import { brand } from '../domain/brand'
import { associationFootballLabel, t } from '../lib/i18n'
import { formatLongDate, formatTime } from '../lib/time'
import { getTheme, withSurfaceMode } from '../theme/themes'

const exportPaths = [
  { icon: CalendarDays, titleKey: 'home.export.liveTitle', bodyKey: 'home.export.liveBody' },
  { icon: Camera, titleKey: 'home.export.photoTitle', bodyKey: 'home.export.photoBody' },
  { icon: FileText, titleKey: 'home.export.notesTitle', bodyKey: 'home.export.notesBody' },
  { icon: Bell, titleKey: 'home.export.alertsTitle', bodyKey: 'home.export.alertsBody' },
]

function ProgramCoverCard({
  event,
  index,
  surfaceMode,
}: {
  event: SpotlightEvent
  index: number
  surfaceMode: 'broadcast' | 'program'
}) {
  const theme = withSurfaceMode(getTheme(event.sportKey), surfaceMode)
  const live = event.label === 'Live now'
  const statusColor = live ? 'var(--color-flap-ok)' : index % 2 ? 'var(--color-flap-tbd)' : 'var(--color-flap-chg)'

  return (
    <Link to={event.href} className="w-[286px] min-w-[286px] snap-start sm:w-[344px] sm:min-w-[344px]">
      <article
        className="group relative h-[152px] overflow-hidden border-y border-r bg-surface/72 px-4 py-3 transition-colors hover:bg-primary/6"
        style={{
          borderColor: `${theme.colors.primary}44`,
          borderLeft: `5px solid ${theme.colors.primary}`,
          clipPath: 'polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%)',
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px opacity-70" style={{ background: theme.colors.primary }} aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <span
              className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: statusColor }}
            >
              {event.label}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink/35">
              Ch {String(index + 1).padStart(2, '0')}
            </span>
          </div>
          <div>
            <div className="mb-3 grid grid-cols-[2.75rem_1fr] items-center gap-3" aria-hidden="true">
              <span className="h-px" style={{ background: theme.colors.primary }} />
              <span className="h-px bg-ink/10" />
            </div>
            <h3 className="max-w-[17rem] text-[1.05rem] font-black leading-tight sm:text-lg" style={{ color: theme.colors.primary }}>
              {event.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink/62">{event.detail}</p>
          </div>
        </div>
      </article>
    </Link>
  )
}

export function HomePage() {
  const { followedTeams, toggleFollow, prefs } = useAppState()
  const { matches } = useMatches()
  const spotlightEvents = useSpotlightEvents(prefs.regionCode)
  // One card per sport on the homepage board/strip — no sport (e.g. soccer) showing up twice.
  const spotlightBySport = useMemo(() => dedupeSpotlightBySport(spotlightEvents), [spotlightEvents])

  const upcomingMatches = useMemo(() => {
    return filterUpcomingMatches(filterMatchesForTeams(matches, followedTeams)).slice(0, 3)
  }, [followedTeams, matches])

  // Popular nations as quick-follow chips; the global search field above handles find-anything.
  const suggestions = featuredTeams

  function toggleTeam(team: string) {
    toggleFollow({ targetType: 'team', targetId: team, intent: 'watch' })
  }

  const footballLabel = associationFootballLabel(prefs.locale, prefs.regionCode)

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="broadcast-tune-panel rounded-card border border-primary/15 bg-surface p-5 shadow-sm sm:p-7">
          <div className="motion-only broadcast-lock-board" aria-hidden="true">
            <span className="broadcast-lock-line" />
            <span className="broadcast-lock-line" />
            <span className="broadcast-lock-line" />
            <span className="broadcast-lock-line" />
          </div>
          <div className="relative z-[1] max-w-4xl">
            <div>
              <p className="board-label mb-4 flex items-center gap-2 text-neon-magenta">
                <Sparkles size={13} /> {t('home.kicker', undefined, prefs.locale)}
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
                <GlobalSearch placeholder={t('home.searchPlaceholder', undefined, prefs.locale)} />
                <p className="mt-3 mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
                  {t('home.popularNations', undefined, prefs.locale)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((team) => {
                    const selected = followedTeams.includes(team)
                    return (
                      <button
                        type="button"
                        key={team}
                        onClick={() => toggleTeam(team)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                          prefs.themeMode === 'program'
                            ? selected
                              ? 'bg-primary text-ticket-stub-text shadow-[0_8px_18px_color-mix(in_srgb,var(--mp-primary)_18%,transparent)]'
                              : 'bg-paper text-primary hover:bg-primary hover:text-ticket-stub-text'
                            : selected
                              ? 'bg-primary text-void'
                              : 'bg-surface text-primary hover:bg-primary/10'
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
                  <Button>{t('home.worldCupCta', { footballLabel }, prefs.locale)}</Button>
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
                    {t('home.manifestoTitle', undefined, prefs.locale)}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm text-ink/62">
                    {t('home.manifestoBody', undefined, prefs.locale)}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        <Panel className="flex flex-col">
          <PanelHeading
            title={t(followedTeams.length ? 'home.nextEvents' : 'home.startFollowing', undefined, prefs.locale)}
            subtitle={t('home.localTime', { timezone: prefs.timezone }, prefs.locale)}
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
                {t('home.pickPrompt', { module: brand.modules.schedule.toLowerCase() }, prefs.locale)}
              </p>
            </div>
          )}
          <Link to="/my-schedule" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">
            {t('home.continueSchedule', undefined, prefs.locale)} <ChevronRight size={15} />
          </Link>
        </Panel>
      </section>

      <GlobalEventBoard events={spotlightBySport} variant="room" />

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-primary">{t('home.spotlightTitle', undefined, prefs.locale)}</h2>
            <p className="text-sm text-ink/60">{t('home.spotlightSubtitle', undefined, prefs.locale)}</p>
          </div>
          <Link to="/explore" className="text-sm font-bold text-primary">
            {t('home.exploreAll', undefined, prefs.locale)}
          </Link>
        </div>
        <div className="silbo-scrollbar flex snap-x gap-3 overflow-x-auto pb-3">
          {spotlightBySport.map((event, index) => (
            <ProgramCoverCard key={event.title} event={event} index={index} surfaceMode={prefs.themeMode} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {exportPaths.map(({ icon: Icon, titleKey, bodyKey }) => (
            <Panel key={titleKey} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon size={19} />
              </span>
              <div>
                <h3 className="font-bold text-primary">{t(titleKey, undefined, prefs.locale)}</h3>
                <p className="mt-1 text-sm text-ink/60">{t(bodyKey, undefined, prefs.locale)}</p>
              </div>
            </Panel>
          ))}
        </div>

        <div className="space-y-3">
          <Panel>
            <PanelHeading title={t('home.watchTitle', undefined, prefs.locale)} subtitle={t('home.watchSubtitle', undefined, prefs.locale)}>
              <Tv size={18} className="text-primary" />
            </PanelHeading>
            <p className="text-sm text-ink/60">
              {t('home.watchBody', undefined, prefs.locale)}
            </p>
          </Panel>
          <Panel>
            <PanelHeading title={t('home.customTitle', undefined, prefs.locale)} subtitle={t('home.customSubtitle', undefined, prefs.locale)}>
              <Users size={18} className="text-primary" />
            </PanelHeading>
            <Link to="/custom-leagues">
              <Button className="w-full" variant="export">
                {t('home.customCta', undefined, prefs.locale)}
              </Button>
            </Link>
          </Panel>
        </div>
      </section>

      <PosterFeatureStrip />
    </div>
  )
}
