import { motion } from 'framer-motion'
import { CalendarDays, Compass, Home, ListChecks, Moon, Share2, Sun, Users } from 'lucide-react'
import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { AuthButton } from '../components/AuthButton'
import { SportSwitcher } from '../components/SportSwitcher'
import { useAppState } from './state-context'
import { brand } from '../domain/brand'
import { getSport } from '../domain/sports'
import { t } from '../lib/i18n'
import { getTheme, withSurfaceMode } from '../theme/themes'
import { SportThemeProvider } from '../theme/SportThemeProvider'

const navItems = [
  { to: '/', labelKey: 'nav.home', mobileLabel: 'Home', icon: Home },
  { to: '/my-schedule', labelKey: 'nav.mySchedule', mobileLabel: 'Schedule', icon: ListChecks },
  { to: '/explore', labelKey: 'nav.explore', mobileLabel: 'Picks', icon: Compass },
  { to: '/calendar', labelKey: 'nav.calendar', mobileLabel: 'Sync', icon: CalendarDays },
  { to: '/exports', labelKey: 'nav.exports', mobileLabel: 'Packs', icon: Share2 },
  { to: '/custom-leagues', labelKey: 'nav.customLeagues', mobileLabel: 'Local', icon: Users },
]

function DesktopNav() {
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {navItems.map(({ to, labelKey, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className="relative flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold"
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="nav-pill"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  className="absolute inset-0 rounded-lg bg-primary"
                />
              )}
              <span
                className={`relative z-10 flex items-center gap-2 transition-colors ${
                  isActive ? 'text-void' : 'text-ink/70 hover:text-primary'
                }`}
              >
                <Icon size={16} />
                <span>{t(labelKey)}</span>
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function MobileNav() {
  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/15 bg-surface/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 shadow-[0_-10px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-1">
        {navItems.map(({ to, labelKey, mobileLabel, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={t(labelKey)}
            className={({ isActive }) =>
              `group flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-2xl px-2 text-[10px] font-bold leading-none transition-all ${
                isActive
                  ? 'min-w-[5.35rem] bg-primary text-void shadow-[0_0_22px_color-mix(in_srgb,var(--mp-primary)_28%,transparent)]'
                  : 'text-ink/55 hover:bg-primary/10 hover:text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={19} strokeWidth={2.25} className="shrink-0" />
                <span className={`${isActive ? 'block max-w-[4rem]' : 'sr-only'} truncate`}>{mobileLabel}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function AppShell() {
  // Theme follows the sport in the URL where there is one; the root uses a neutral all-sports mood.
  const { sportKey } = useParams()
  const location = useLocation()
  const { prefs, setPrefs } = useAppState()
  const baseTheme = getTheme(location.pathname === '/' ? 'neutral' : sportKey && getSport(sportKey) ? sportKey : 'soccer')
  const theme = withSurfaceMode(baseTheme, prefs.themeMode)
  const programMode = prefs.themeMode === 'program'

  return (
    <SportThemeProvider theme={theme}>
      <div className={`min-h-svh bg-page text-ink motif-${theme.motifs.background}`}>
        <div className="broadcast-air" aria-hidden="true" />
        <header className="sticky top-0 z-40 border-b border-primary/15 bg-surface/85 backdrop-blur-lg">
          <div className="mx-auto flex w-full max-w-[1460px] items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-4">
            <SportSwitcher />

            <DesktopNav />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPrefs({ ...prefs, themeMode: programMode ? 'broadcast' : 'program' })}
                title={programMode ? 'Switch to Broadcast Dark' : 'Switch to Program Light'}
                aria-label={programMode ? 'Switch to Broadcast Dark' : 'Switch to Program Light'}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {programMode ? <Moon size={17} /> : <Sun size={17} />}
              </button>
              <AuthButton />
            </div>
          </div>
        </header>

        <main className="relative z-[1] mx-auto w-full max-w-[1460px] px-4 pb-28 pt-5 md:py-6">
          <Outlet />
        </main>

        <footer className="relative z-[1] mx-auto w-full max-w-[1460px] px-4 pb-28 pt-4 md:pb-8">
          <div className="color-bars mb-3 h-1.5 w-28 opacity-70" aria-hidden="true" />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
            {brand.appName} — schedules generated locally in your browser. Times shown in your
            selected timezone. Always double-check against official sources before travel.
          </p>
        </footer>

        <MobileNav />
      </div>
    </SportThemeProvider>
  )
}
