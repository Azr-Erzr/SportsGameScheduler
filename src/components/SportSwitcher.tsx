import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { sports } from '../domain/sports'
import { getTheme, withSurfaceMode } from '../theme/themes'
import { SilboBrandMark } from './SilboMark'
import { SportAssetIcon } from './SportAssetIcon'

// The brand block IS the sport selector: clicking the mark opens a themed bento
// popover (one tile per sport, each wearing its own theme colors). Picking a sport navigates
// and reskins the whole app via the route-driven SportThemeProvider.
// Motion language: spring pop on the panel, staggered tile entrance, rotating chevron.

export function SportSwitcher() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { sportKey } = useParams()
  const { prefs } = useAppState()
  const activeKey = location.pathname === '/' ? 'neutral' : sportKey ?? 'soccer'
  const activeTheme = withSurfaceMode(getTheme(activeKey), prefs.themeMode)
  const activeSport = sports.find((sport) => sport.key === activeKey)
  const sportIconVariant = prefs.themeMode === 'program' ? 'brush' : 'neon3d'

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
    navigate(key === 'custom' ? '/custom-leagues' : `/sports/${key}`)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="sport-switcher-trigger flex items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-primary/20 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span
          key={activeKey}
          className="sport-switcher-mark flex items-center justify-center"
        >
          <SilboBrandMark size={44} color={activeTheme.colors.primary} />
        </span>
        <span className="text-left">
          <span className="neon-text block font-display text-base leading-tight tracking-wide">
            SILBO
          </span>
          <span className="hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.3em] text-ink/50 md:block">
            {activeSport ? `CH ${String(sports.indexOf(activeSport) + 1).padStart(2, '0')} - ${activeSport.label}` : 'Sports Network'}
          </span>
        </span>
        <span className={`text-ink/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <ChevronDown size={16} />
        </span>
      </button>

      {open && (
          <div
            role="menu"
            className="sport-switcher-menu silbo-scrollbar fixed inset-x-3 top-[4.2rem] z-50 max-h-[calc(100svh-5.2rem)] origin-top overflow-y-auto rounded-2xl border border-primary/15 bg-surface p-2.5 shadow-xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+10px)] sm:w-[36rem]"
          >
            <p className="board-label px-1 pb-2 text-ink/40">Pick your channel</p>
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
                    className="channel-tile relative flex min-h-[68px] items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition-[box-shadow,transform,background-color] hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                    style={{
                      borderColor: isActive ? theme.colors.primary : `${theme.colors.primary}33`,
                      background: isActive ? `${theme.colors.primary}14` : 'transparent',
                      boxShadow: isActive ? `0 0 18px ${theme.colors.primary}30` : undefined,
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
          </div>
        )}
    </div>
  )
}
