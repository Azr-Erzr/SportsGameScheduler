import { ChevronDown, Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { sports } from '../domain/sports'
import { getTheme, withSurfaceMode } from '../theme/themes'
import { SportAssetIcon } from './SportAssetIcon'

// Sports are navigation, not the brand. This dropdown keeps the themed channel grid while
// leaving the header's left side free for the Silbo lockup.

export function SportSwitcher() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { sportKey } = useParams()
  const { prefs } = useAppState()
  const activeKey =
    location.pathname === '/'
      ? 'neutral'
      : location.pathname === '/other-sports'
        ? 'custom'
        : sportKey ?? 'soccer'
  const sportIconVariant = prefs.themeMode === 'program' ? 'brush' : 'neon3d'
  const sportsArea = location.pathname === '/explore' || location.pathname === '/other-sports' || location.pathname.startsWith('/sports/')

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function pick(key: string) {
    setOpen(false)
    navigate(key === 'custom' ? '/other-sports' : `/sports/${key}`)
  }

  function openDirectory() {
    setOpen(false)
    navigate('/explore')
  }

  function onTriggerClick() {
    // First click opens the picker; clicking the already-open trigger takes you to the full
    // sports directory (/explore) so the hub page is reachable, not just buried in the footer.
    if (open) openDirectory()
    else setOpen(true)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onTriggerClick}
        aria-expanded={open}
        aria-haspopup="menu"
        title={open ? 'Open the full sports directory' : 'Pick a sport'}
        className={`sport-switcher-trigger relative flex h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          sportsArea ? 'bg-primary text-void' : 'text-ink/70 hover:bg-primary/10 hover:text-primary'
        }`}
      >
        <Trophy size={16} />
        <span className="leading-none">
          Sports
        </span>
        <span className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <ChevronDown size={15} />
        </span>
      </button>

      {open && (
          <div
            role="menu"
            className="sport-switcher-menu silbo-scrollbar fixed inset-x-3 top-[4.2rem] z-50 max-h-[calc(100svh-5.2rem)] origin-top overflow-y-auto rounded-2xl border border-primary/15 bg-surface p-2.5 shadow-xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+10px)] sm:w-[38rem]"
          >
            <div className="flex flex-wrap items-end justify-between gap-2 px-1 pb-2">
              <p className="board-label text-ink/40">Pick your sport</p>
              <button
                type="button"
                onClick={openDirectory}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary transition-colors hover:text-primary/80"
              >
                Browse all sports →
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {sports.map((sport, index) => {
                const theme = withSurfaceMode(getTheme(sport.key), prefs.themeMode)
                const isActive = sport.key === activeKey
                return (
                  <button
                    key={sport.key}
                    type="button"
                    role="menuitem"
                    onClick={() => pick(sport.key)}
                    className="channel-tile relative flex min-h-[68px] items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition-colors hover:bg-primary/6"
                    style={{
                      borderColor: isActive ? theme.colors.primary : `${theme.colors.primary}33`,
                      background: isActive ? `${theme.colors.primary}14` : 'transparent',
                      boxShadow: isActive ? `0 0 0 1px ${theme.colors.primary}44` : undefined,
                    }}
                  >
                    <SportAssetIcon sportKey={sport.key} size="channel" variant={sportIconVariant} className="channel-tile-icon" label={`${sport.label} icon`} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[9px] tracking-[0.22em] text-ink/40">
                        CH {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="block truncate text-base font-black uppercase leading-none" style={{ color: theme.colors.primary }}>
                        {sport.label}
                      </span>
                      <span className="mt-1 block truncate font-mono text-[10px] uppercase tracking-wide text-ink/60">
                        {sport.flagshipLeague}
                      </span>
                    </span>
                    <span
                      className="absolute right-2 top-2 rounded-sm px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-[0.18em]"
                      style={
                        sport.enabled
                          ? { background: theme.colors.primary, color: '#0b0a08' }
                          : { background: 'color-mix(in srgb, var(--mp-text) 18%, transparent)', color: 'var(--mp-text)' }
                      }
                    >
                      {sport.enabled ? 'ON AIR' : 'SOON'}
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={openDirectory}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/25 px-3 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
            >
              <Trophy size={14} /> Open the full sports directory
            </button>
          </div>
        )}
    </div>
  )
}
