import { Home, ListChecks, Moon, PlusCircle, Sun, Trophy } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthButton } from '../components/AuthButton'
import { ConsentBanner } from '../components/ConsentBanner'
import { LanguageMenu } from '../components/LanguageMenu'
import { LiveTicker } from '../components/LiveTicker'
import { Onboarding } from '../components/Onboarding'
import { SilboBrandMark } from '../components/SilboMark'
import { SportSwitcher } from '../components/SportSwitcher'
import { adsConfigured } from '../lib/ads'
import { initConsent, resetConsent } from '../lib/consent'
import { hasOnboarded } from '../lib/onboarding'
import { useAppState } from './state-context'
import { brand } from '../domain/brand'
import { getSport } from '../domain/sports'
import { t } from '../lib/i18n'
import { getTheme, withSurfaceMode } from '../theme/themes'
import { SportThemeProvider } from '../theme/SportThemeProvider'

const desktopNavItems = [
  { to: '/my-schedule', labelKey: 'nav.mySchedule', mobileLabelKey: 'nav.mobile.schedule', icon: ListChecks },
  { to: '/custom-leagues', labelKey: 'nav.customLeagues', mobileLabelKey: 'nav.mobile.create', icon: PlusCircle },
]

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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/15 bg-surface px-2 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 shadow-[0_-8px_22px_rgba(0,0,0,0.24)] md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-1">
        {mobileNavItems.map(({ to, labelKey, mobileLabelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={t(labelKey, undefined, locale)}
            className={({ isActive }) =>
              `group flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-2xl px-2 text-[10px] font-bold leading-none transition-colors ${
                isActive
                  ? 'min-w-[5.35rem] bg-primary text-void shadow-[0_-1px_12px_color-mix(in_srgb,var(--mp-primary)_16%,transparent)]'
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
      className="group flex min-w-0 justify-self-start items-center gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex h-12 w-16 shrink-0 items-center justify-center sm:h-14 sm:w-[4.75rem]">
        <SilboBrandMark size={70} color="var(--mp-primary)" />
      </span>
      <span className="min-w-0">
        <span className="neon-text block whitespace-nowrap font-display text-xl leading-none tracking-wide sm:text-2xl">
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
  const { prefs, setPrefs, follows } = useAppState()
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
  const theme = withSurfaceMode(baseTheme, prefs.themeMode)
  const programMode = prefs.themeMode === 'program'

  // Restore the AdSense script if the user accepted advertising in a previous session.
  useEffect(() => initConsent(), [])

  return (
    <SportThemeProvider theme={theme}>
      <div className={`min-h-svh bg-page text-ink motif-${theme.motifs.background}`}>
        <div className="broadcast-air" aria-hidden="true" />
        {/* PERF: no backdrop-blur on the sticky header — blur over a fixed gradient forces a
            full-viewport recomposite on every scroll frame. Near-opaque surface instead. */}
        <header className="sticky top-0 z-40 border-b border-primary/15 bg-surface/95">
          <div className="mx-auto grid w-full max-w-[1460px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <BrandBlock />

            <DesktopNav locale={prefs.locale} />

            <div className="flex items-center justify-self-end gap-2">
              <button
                type="button"
                onClick={() => setPrefs({ ...prefs, themeMode: programMode ? 'broadcast' : 'program' })}
                title={t(programMode ? 'app.theme.toBroadcast' : 'app.theme.toProgram', undefined, prefs.locale)}
                aria-label={t(programMode ? 'app.theme.toBroadcast' : 'app.theme.toProgram', undefined, prefs.locale)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {programMode ? <Moon size={17} /> : <Sun size={17} />}
              </button>
              <LanguageMenu />
              <AuthButton />
            </div>
          </div>
        </header>

        <main className="relative z-[1] mx-auto w-full max-w-[1460px] px-4 pb-28 pt-5 md:py-6">
          <LiveTicker />
          <Outlet />
        </main>

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
        <ConsentBanner />
        {showOnboarding && onboardingEligible && <Onboarding onClose={() => setShowOnboarding(false)} />}
      </div>
    </SportThemeProvider>
  )
}
