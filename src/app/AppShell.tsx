import { Home, ListChecks, Moon, PlusCircle, Sun, Trophy } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { AuthButton } from '../components/AuthButton'
import { ConsentBanner } from '../components/ConsentBanner'
import { InstallAppPrompt } from '../components/InstallAppPrompt'
import { LanguageMenu } from '../components/LanguageMenu'
import { LiveTicker } from '../components/LiveTicker'
import { Onboarding } from '../components/Onboarding'
import { SpotlightRail } from '../components/PosterMotifs'
import { SilboBrandMark } from '../components/SilboMark'
import { SportSwitcher } from '../components/SportSwitcher'
import { dedupeSpotlightBySport, useSpotlightEvents } from '../data/spotlight'
import { adsConfigured } from '../lib/ads'
import { initConsent, resetConsent } from '../lib/consent'
import { hasOnboarded } from '../lib/onboarding'
import { useAppState } from './state-context'
import { brand } from '../domain/brand'
import { getSport } from '../domain/sports'
import { t } from '../lib/i18n'
import { getLoopingScrollProgress } from '../lib/scrollMotion'
import { getTheme, withSurfaceMode } from '../theme/themes'
import { SportThemeProvider } from '../theme/SportThemeProvider'

const desktopNavItems = [
  { to: '/my-schedule', labelKey: 'nav.mySchedule', mobileLabelKey: 'nav.mobile.schedule', icon: ListChecks },
  { to: '/custom-leagues', labelKey: 'nav.customLeagues', mobileLabelKey: 'nav.mobile.create', icon: PlusCircle },
]

const CRT_PIXEL_SCALES = {
  cyan: [1.45, 1.2, 0.82, 0.62, 0.94, 1.32, 1.05, 0.72],
  pink: [0.68, 0.92, 1.28, 1.48, 1.12, 0.76, 0.58, 1.18],
  green: [0.78, 1.02, 1.26, 0.96, 0.66, 0.88, 1.42, 1.12],
  amber: [1.08, 0.72, 0.56, 1.04, 1.38, 1.16, 0.82, 0.64],
} as const

const CRT_SIGNAL_TRACES = [
  {
    key: 'heart',
    path: 'M2 23H58L67 23L73 34L80 5L88 39L98 23H112C124 23 129 33 141 33C156 33 162 18 177 18C192 18 198 25 210 25H238',
  },
  {
    key: 'sine',
    path: 'M2 23C18 3 34 3 50 23S82 43 98 23S130 3 146 23S178 43 194 23S222 3 238 18',
  },
  {
    key: 'square',
    path: 'M2 24H62V13H102V33H142V17H180V29H214V24H238',
  },
] as const

function CrtSignalTraces() {
  return (
    <>
      {CRT_SIGNAL_TRACES.map((trace, index) => (
        <span key={trace.key} className={`crt-signal-trace crt-trace-${trace.key} crt-trace-${index + 1}`}>
          <svg viewBox="0 0 240 44" preserveAspectRatio="none" focusable="false">
            <path className="crt-trace-ghost" pathLength="100" d={trace.path} />
            <path className="crt-trace-live" pathLength="100" d={trace.path} />
          </svg>
        </span>
      ))}
    </>
  )
}

type PageScene = 'home' | 'schedule' | 'discovery' | 'sport' | 'tools' | 'community' | 'editorial' | 'account'

function pageSceneForPath(pathname: string): PageScene {
  if (pathname === '/') return 'home'
  if (pathname === '/my-schedule') return 'schedule'
  if (pathname === '/explore' || pathname === '/other-sports') return 'discovery'
  if (/^\/(sports|leagues|teams|events)\//.test(pathname)) return 'sport'
  if (pathname === '/calendar' || pathname === '/exports' || pathname.startsWith('/settings/')) return 'tools'
  if (pathname.startsWith('/custom-leagues') || pathname.startsWith('/s/')) return 'community'
  if (pathname === '/account' || pathname === '/admin') return 'account'
  return 'editorial'
}

function PageAtmosphere({ scene }: { scene: PageScene }) {
  if (scene === 'home') return null
  return (
    <div className="page-signal-layer" aria-hidden="true">
      <svg className="page-signal page-signal-top" viewBox="0 0 640 92" preserveAspectRatio="none" focusable="false">
        <path
          className="page-signal-ghost"
          pathLength="100"
          d="M2 48H104L126 48L139 66L153 12L169 78L186 48H232C272 48 280 23 318 23C356 23 366 64 405 64C444 64 455 31 495 31C535 31 548 48 638 48"
        />
        <path
          className="page-signal-live"
          pathLength="100"
          d="M2 48H104L126 48L139 66L153 12L169 78L186 48H232C272 48 280 23 318 23C356 23 366 64 405 64C444 64 455 31 495 31C535 31 548 48 638 48"
        />
      </svg>
      <svg className="page-signal page-signal-low" viewBox="0 0 640 92" preserveAspectRatio="none" focusable="false">
        <path className="page-signal-ghost" pathLength="100" d="M2 49H118V25H192V67H266V34H342V58H416V18H490V49H638" />
        <path className="page-signal-live page-signal-live-secondary" pathLength="100" d="M2 49H118V25H192V67H266V34H342V58H416V18H490V49H638" />
      </svg>
      <span className="page-pixel-cluster page-pixel-cluster-a">
        <i className="page-pixel page-pixel-cyan" />
        <i className="page-pixel page-pixel-pink" />
        <i className="page-pixel page-pixel-green" />
        <i className="page-pixel page-pixel-amber" />
      </span>
      <span className="page-pixel-cluster page-pixel-cluster-b">
        <i className="page-pixel page-pixel-pink" />
        <i className="page-pixel page-pixel-green" />
        <i className="page-pixel page-pixel-cyan" />
      </span>
    </div>
  )
}

const mobileNavItems = [
  { to: '/', labelKey: 'nav.home', mobileLabelKey: 'nav.mobile.home', icon: Home },
  { to: '/explore', labelKey: 'nav.sports', mobileLabelKey: 'nav.mobile.sports', icon: Trophy },
  { to: '/my-schedule', labelKey: 'nav.mySchedule', mobileLabelKey: 'nav.mobile.schedule', icon: ListChecks },
  { to: '/custom-leagues', labelKey: 'nav.customLeagues', mobileLabelKey: 'nav.mobile.create', icon: PlusCircle },
]

const footerLinks = [
  { to: '/', label: 'Home' },
  { to: '/my-schedule', label: 'My Schedule' },
  { to: '/explore', label: 'Explore sports' },
  { to: '/exports', label: 'Exports' },
  { to: '/calendar', label: 'Silbo Sync' },
  { to: '/custom-leagues', label: 'Create League' },
  { to: '/settings/alerts', label: 'Alerts' },
  { to: '/account', label: 'Account' },
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'About' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/faq', label: 'FAQ' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
]

function DesktopNav({ locale }: { locale?: string | null }) {
  return (
    <nav className="hidden items-center gap-1 justify-self-center md:flex">
      <SportSwitcher />
      {desktopNavItems.map(({ to, labelKey, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className="relative flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold"
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute inset-0 rounded-lg bg-primary transition-colors" />}
              <span
                className={`relative z-10 flex items-center gap-2 transition-colors ${
                  isActive ? 'text-void' : 'text-ink/70 hover:text-primary'
                }`}
              >
                <Icon size={16} />
                <span>{t(labelKey, undefined, locale)}</span>
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function MobileNav({ locale }: { locale?: string | null }) {
  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.65rem)] z-40 rounded-2xl border border-primary/15 bg-surface/98 px-2 py-2 shadow-[0_-8px_22px_rgba(0,0,0,0.24)] md:hidden"
    >
      <div className="mx-auto flex max-w-[21.5rem] items-center justify-between gap-1">
        {mobileNavItems.map(({ to, labelKey, mobileLabelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={t(labelKey, undefined, locale)}
            className={({ isActive }) =>
              `group flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-bold leading-none transition-colors ${
                isActive
                  ? 'min-w-[4.85rem] bg-primary text-void shadow-[0_-1px_12px_color-mix(in_srgb,var(--mp-primary)_16%,transparent)]'
                  : 'text-ink/55 hover:bg-primary/10 hover:text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={19} strokeWidth={2.25} className="shrink-0" />
                <span className={`${isActive ? 'block max-w-[4rem]' : 'sr-only'} truncate`}>
                  {t(mobileLabelKey, undefined, locale)}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function BrandBlock() {
  return (
    <Link
      to="/"
      aria-label={brand.appName}
      className="group flex min-w-0 justify-self-start items-center gap-2 rounded-xl px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:gap-3"
    >
      <span className="flex h-10 w-12 shrink-0 items-center justify-center sm:h-14 sm:w-[4.75rem]">
        <span className="sm:hidden">
          <SilboBrandMark size={54} color="var(--mp-primary)" />
        </span>
        <span className="hidden sm:block">
          <SilboBrandMark size={70} color="var(--mp-primary)" />
        </span>
      </span>
      <span className="min-w-0">
        <span className="neon-text block truncate whitespace-nowrap font-display text-[1rem] leading-none tracking-wide min-[390px]:text-lg sm:text-2xl">
          Silbo Sports
        </span>
        <span className="hidden max-w-[18rem] truncate font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45 lg:block">
          {brand.tagline}
        </span>
      </span>
    </Link>
  )
}

export function AppShell() {
  // Theme follows the sport in the URL where there is one; the root uses a neutral all-sports mood.
  const { sportKey } = useParams()
  const location = useLocation()
  const { prefs, surfaceMode, setPrefs, follows } = useAppState()
  const spotlightEvents = useSpotlightEvents(prefs.regionCode)
  const footerSpotlightEvents = useMemo(() => dedupeSpotlightBySport(spotlightEvents), [spotlightEvents])
  // First-run onboarding: only for a brand-new visitor (no prior pass, nothing followed yet).
  // Decided once at mount from the synchronously-loaded follows/flag — no effect needed.
  const [showOnboarding, setShowOnboarding] = useState(() => !hasOnboarded() && follows.length === 0)
  const onboardingEligible =
    location.pathname === '/' || location.pathname === '/explore' || location.pathname === '/my-schedule'
  const baseTheme = getTheme(
    location.pathname === '/'
      ? 'neutral'
      : location.pathname === '/other-sports'
        ? 'custom'
        : sportKey && getSport(sportKey)
          ? sportKey
          : 'soccer',
  )
  const theme = withSurfaceMode(baseTheme, surfaceMode)
  const programMode = surfaceMode === 'program'
  const pageScene = pageSceneForPath(location.pathname)

  // Restore the AdSense script if the user accepted advertising in a previous session.
  useEffect(() => initConsent(), [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.surface = surfaceMode
    root.style.colorScheme = programMode ? 'light' : 'dark'
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', programMode ? '#f4ead8' : '#171b18')
  }, [programMode, surfaceMode])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    if (pageScene !== 'home') return
    const root = document.documentElement
    // Firefox keeps the lightweight static CRT artwork, but skips the extra side layers and
    // this scroll listener entirely. Its compositor is much more sensitive to fixed artwork
    // whose background position changes during scroll.
    if (root.dataset.browser === 'firefox') return
    const desktop = window.matchMedia('(min-width: 900px)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let pixelStep = -1

    const paintSideSignals = () => {
      frame = 0
      if (!desktop.matches || reducedMotion.matches) {
        root.style.removeProperty('--crt-side-left-y')
        root.style.removeProperty('--crt-side-right-y')
        root.style.removeProperty('--crt-side-left-x')
        root.style.removeProperty('--crt-side-right-x')
        root.style.removeProperty('--crt-wave-stretch')
        root.style.removeProperty('--crt-trace-one-offset')
        root.style.removeProperty('--crt-trace-two-offset')
        root.style.removeProperty('--crt-trace-three-offset')
        root.style.removeProperty('--crt-trace-two-opacity')
        root.style.removeProperty('--crt-trace-three-opacity')
        root.style.removeProperty('--crt-pixel-cyan-scale')
        root.style.removeProperty('--crt-pixel-pink-scale')
        root.style.removeProperty('--crt-pixel-green-scale')
        root.style.removeProperty('--crt-pixel-amber-scale')
        pixelStep = -1
        return
      }

      // Repeat the side-art sequence every few viewports. A ping-pong loop keeps the return
      // continuous, so very long pages never leave the traces or pixels frozen at an endpoint.
      const progress = getLoopingScrollProgress(window.scrollY, window.innerHeight)
      const step = Math.min(7, Math.floor(progress * 8))
      const pulseTwoProgress = Math.min(1, Math.max(0, (progress - 0.16) / 0.84))
      const pulseThreeProgress = Math.min(1, Math.max(0, (progress - 0.34) / 0.66))
      root.style.setProperty('--crt-side-left-y', '0px')
      root.style.setProperty('--crt-side-right-y', '0px')
      root.style.setProperty('--crt-side-left-x', `${(progress * -110).toFixed(2)}px`)
      root.style.setProperty('--crt-side-right-x', `${(progress * 96).toFixed(2)}px`)
      root.style.setProperty('--crt-wave-stretch', `${(progress * 160).toFixed(2)}px`)
      root.style.setProperty('--crt-trace-one-offset', String(24 - progress * 124))
      root.style.setProperty('--crt-trace-two-offset', String(24 - pulseTwoProgress * 124))
      root.style.setProperty('--crt-trace-three-offset', String(24 - pulseThreeProgress * 124))
      root.style.setProperty('--crt-trace-two-opacity', String(0.22 + pulseTwoProgress * 0.56))
      root.style.setProperty('--crt-trace-three-opacity', String(0.16 + pulseThreeProgress * 0.56))
      if (step !== pixelStep) {
        pixelStep = step
        root.style.setProperty('--crt-pixel-cyan-scale', String(CRT_PIXEL_SCALES.cyan[step]))
        root.style.setProperty('--crt-pixel-pink-scale', String(CRT_PIXEL_SCALES.pink[step]))
        root.style.setProperty('--crt-pixel-green-scale', String(CRT_PIXEL_SCALES.green[step]))
        root.style.setProperty('--crt-pixel-amber-scale', String(CRT_PIXEL_SCALES.amber[step]))
      }
    }

    const queueSideSignals = () => {
      if (!frame) frame = window.requestAnimationFrame(paintSideSignals)
    }

    paintSideSignals()
    window.addEventListener('scroll', queueSideSignals, { passive: true })
    window.addEventListener('resize', queueSideSignals)
    desktop.addEventListener('change', queueSideSignals)
    reducedMotion.addEventListener('change', queueSideSignals)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', queueSideSignals)
      window.removeEventListener('resize', queueSideSignals)
      desktop.removeEventListener('change', queueSideSignals)
      reducedMotion.removeEventListener('change', queueSideSignals)
      root.style.removeProperty('--crt-side-left-y')
      root.style.removeProperty('--crt-side-right-y')
      root.style.removeProperty('--crt-side-left-x')
      root.style.removeProperty('--crt-side-right-x')
      root.style.removeProperty('--crt-wave-stretch')
      root.style.removeProperty('--crt-trace-one-offset')
      root.style.removeProperty('--crt-trace-two-offset')
      root.style.removeProperty('--crt-trace-three-offset')
      root.style.removeProperty('--crt-trace-two-opacity')
      root.style.removeProperty('--crt-trace-three-opacity')
      root.style.removeProperty('--crt-pixel-cyan-scale')
      root.style.removeProperty('--crt-pixel-pink-scale')
      root.style.removeProperty('--crt-pixel-green-scale')
      root.style.removeProperty('--crt-pixel-amber-scale')
    }
  }, [pageScene])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <SportThemeProvider theme={theme}>
      <div className={`app-scene-${pageScene} min-h-svh bg-page text-ink motif-${theme.motifs.background}`}>
        <div className="broadcast-air" aria-hidden="true">
          <span className="crt-side-signal crt-side-signal-left">
            <CrtSignalTraces />
            <span className="crt-pixel crt-pixel-cyan" />
            <span className="crt-pixel crt-pixel-pink" />
            <span className="crt-pixel crt-pixel-green" />
            <span className="crt-pixel crt-pixel-amber" />
          </span>
          <span className="crt-side-signal crt-side-signal-right">
            <CrtSignalTraces />
            <span className="crt-pixel crt-pixel-cyan" />
            <span className="crt-pixel crt-pixel-pink" />
            <span className="crt-pixel crt-pixel-green" />
            <span className="crt-pixel crt-pixel-amber" />
          </span>
        </div>
        {/* PERF: no backdrop-blur on the sticky header — blur over a fixed gradient forces a
            full-viewport recomposite on every scroll frame. Near-opaque surface instead. */}
        <header className="sticky top-0 z-40 border-b border-primary/15 bg-surface/95">
          <div className="mx-auto grid w-full max-w-[1460px] grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 px-2.5 py-2.5 sm:gap-4 sm:px-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <BrandBlock />

            <DesktopNav locale={prefs.locale} />

            <div className="flex items-center justify-self-end gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setPrefs({ ...prefs, themeMode: programMode ? 'broadcast' : 'program' })}
                title={t(programMode ? 'app.theme.toBroadcast' : 'app.theme.toProgram', undefined, prefs.locale)}
                aria-label={t(programMode ? 'app.theme.toBroadcast' : 'app.theme.toProgram', undefined, prefs.locale)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-10 sm:w-10"
              >
                {programMode ? <Moon size={17} /> : <Sun size={17} />}
              </button>
              <LanguageMenu />
              <AuthButton />
            </div>
          </div>
        </header>

        <main className={`page-scene page-scene-${pageScene} relative z-[1] isolate mx-auto w-full max-w-[1460px] px-4 pb-28 pt-5 md:py-6`}>
          <PageAtmosphere scene={pageScene} />
          <div className="page-scene-content relative z-[1]">
            <LiveTicker />
            <Outlet />
          </div>
        </main>

        <div className="relative z-[1] mx-auto hidden w-full max-w-[1460px] px-4 pb-3 md:block">
          <SpotlightRail events={footerSpotlightEvents} />
        </div>

        <footer className="relative z-[1] mx-auto w-full max-w-[1460px] px-4 pb-40 pt-4 md:pb-8">
          <div className="border-t border-primary/15 pt-5">
            <div className="color-bars mb-4 h-1.5 w-28 opacity-70" aria-hidden="true" />
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <p className="max-w-2xl font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
                {t('app.footerDisclaimer', undefined, prefs.locale)}
              </p>
              <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
                {footerLinks.map((item) => (
                  <Link key={item.to} to={item.to} className="text-ink/58 transition-colors hover:text-primary">
                    {item.label}
                  </Link>
                ))}
                {adsConfigured && (
                  <button
                    type="button"
                    onClick={() => resetConsent()}
                    className="text-ink/58 transition-colors hover:text-primary"
                  >
                    Cookie settings
                  </button>
                )}
              </nav>
            </div>
          </div>
        </footer>

        <MobileNav locale={prefs.locale} />
        <InstallAppPrompt />
        <ConsentBanner />
        {showOnboarding && onboardingEligible && <Onboarding onClose={() => setShowOnboarding(false)} />}
      </div>
    </SportThemeProvider>
  )
}
