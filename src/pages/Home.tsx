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
import { HomeSportTickets } from '../components/SportTicketsPanel'
import { Button, Panel, PanelHeading } from '../components/ui'
import { WorldClock } from '../components/WorldClock'
import { filterMatchesForTeams, filterUpcomingMatches, useMatches } from '../data/liveMatches'
import { featuredTeams } from '../data/worldcup'
import { dedupeSpotlightBySport, useSpotlightEvents } from '../data/spotlight'
import { brand } from '../domain/brand'
import { getSport } from '../domain/sports'
import { aboutContent, faqContent, howItWorksContent } from '../content/siteContent'
import { associationFootballLabel, t } from '../lib/i18n'
import { formatLongDate, formatTime } from '../lib/time'

const exportPaths = [
  { icon: CalendarDays, titleKey: 'home.export.liveTitle', bodyKey: 'home.export.liveBody' },
  { icon: Camera, titleKey: 'home.export.photoTitle', bodyKey: 'home.export.photoBody' },
  { icon: FileText, titleKey: 'home.export.notesTitle', bodyKey: 'home.export.notesBody' },
  { icon: Bell, titleKey: 'home.export.alertsTitle', bodyKey: 'home.export.alertsBody' },
]

const homeTicketSports = ['football', 'soccer', 'baseball', 'basketball'].flatMap((key) => {
  const sport = getSport(key)
  return sport ? [sport] : []
})

export function HomePage() {
  const { followedTeams, toggleFollow, prefs, surfaceMode } = useAppState()
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
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]" data-home-section="hero">
        <div className="silbo-glass-panel broadcast-tune-panel rounded-card border border-primary/15 bg-surface p-5 shadow-sm sm:p-7">
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
                  {suggestions.map((team, index) => {
                    const selected = followedTeams.includes(team)
                    return (
                      <button
                        type="button"
                        key={team}
                        onClick={() => toggleTeam(team)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${index > 5 ? 'max-sm:hidden' : ''} ${
                          surfaceMode === 'program'
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
                  <Button variant="ghost" className="home-cta">{t('home.worldCupCta', { footballLabel }, prefs.locale)}</Button>
                </Link>
                <Link to="/explore">
                  <Button variant="ghost" className="home-cta">{t('home.exploreSports', undefined, prefs.locale)}</Button>
                </Link>
                <Link to="/custom-leagues">
                  <Button variant="ghost" className="home-cta">{t('home.createCustomLeague', undefined, prefs.locale)}</Button>
                </Link>
              </div>

              <div className="mt-6 hidden gap-4 rounded-xl border border-primary/20 bg-page/60 p-4 sm:grid sm:grid-cols-[auto_1fr]">
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

      <div className="home-board hidden sm:block" data-home-section="world-board">
        <GlobalEventBoard events={spotlightBySport} variant="room" />
      </div>

      <HomeSportTickets sports={homeTicketSports} regionCode={prefs.regionCode} />

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]" data-home-section="tools">
        <div className="grid gap-3 sm:grid-cols-2">
          {exportPaths.map(({ icon: Icon, titleKey, bodyKey }) => (
            <Panel key={titleKey} className="flex gap-3 max-sm:p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon size={19} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-primary sm:text-base">{t(titleKey, undefined, prefs.locale)}</h3>
                <p className="mt-1 hidden text-sm text-ink/60 sm:block">{t(bodyKey, undefined, prefs.locale)}</p>
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

      <div className="hidden sm:block">
        <PosterFeatureStrip />
      </div>

      <HomeExplainer />
    </div>
  )
}

// Visible, original prose on the homepage so a first-time visitor (and an AdSense reviewer) lands on
// real content explaining what the product is and how it works — not just the scheduling tool. Copy
// lives in src/content/siteContent.ts; deeper detail is on /about, /how-it-works and /faq.
function HomeExplainer() {
  return (
    <section aria-labelledby="home-explainer-heading" className="mt-2 border-t border-primary/15 pt-6" data-home-section="explainer">
      <details className="rounded-card border border-primary/15 bg-surface p-4 sm:hidden">
        <summary className="cursor-pointer text-sm font-black uppercase tracking-[0.14em] text-primary">
          About, help, and FAQs
        </summary>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink/75">
          <p>{aboutContent.intro}</p>
          <Link to="/about" className="inline-flex items-center gap-1 font-bold text-primary">
            More about Silbo Sports <ChevronRight size={15} />
          </Link>
          <div className="grid gap-2">
            <Link to="/how-it-works" className="inline-flex items-center justify-between rounded-lg bg-page/60 px-3 py-2 font-bold text-primary">
              How it works <ChevronRight size={15} />
            </Link>
            <Link to="/faq" className="inline-flex items-center justify-between rounded-lg bg-page/60 px-3 py-2 font-bold text-primary">
              Common questions <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </details>

      <div className="hidden space-y-6 sm:block">
      {/* Intro and the how-it-works steps sit side by side on desktop so the section fills the page
          width like the rest of the home page and stays short. Text stays readable via max-w caps. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
        <div className="max-w-2xl space-y-3 text-sm leading-relaxed text-ink/80">
          <h2 id="home-explainer-heading" className="font-display text-2xl tracking-wide text-ink">
            What is Silbo Sports?
          </h2>
          <p>{aboutContent.intro}</p>
          <p>{aboutContent.sections[0].paragraphs[0]}</p>
          <Link to="/about" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
            More about Silbo Sports <ChevronRight size={15} />
          </Link>
        </div>

        <div className="space-y-3">
          <h3 className="font-display text-lg tracking-wide text-ink">How it works</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {howItWorksContent.steps.map((step) => (
              <div key={step.heading} className="rounded-xl border border-primary/15 bg-page/60 p-4">
                <h4 className="font-bold text-primary">{step.heading}</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-ink/65">{step.paragraphs[0]}</p>
              </div>
            ))}
          </div>
          <Link to="/how-it-works" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
            Read the full guide <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      <div className="space-y-3 text-sm leading-relaxed text-ink/80">
        <h3 className="font-display text-lg tracking-wide text-ink">Common questions</h3>
        <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {faqContent.faqs.slice(0, 4).map((faq) => (
            <div key={faq.q} className="border-b border-primary/10 pb-4">
              <dt className="font-semibold text-ink">{faq.q}</dt>
              <dd className="mt-1.5 text-ink/75">{faq.a}</dd>
            </div>
          ))}
        </dl>
        <Link to="/faq" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
          See all FAQs <ChevronRight size={15} />
        </Link>
      </div>
      </div>
    </section>
  )
}
