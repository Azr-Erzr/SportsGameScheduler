import { ArrowRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { SportAssetIcon } from '../components/SportAssetIcon'
import { sports } from '../domain/sports'
import { getTheme, withSurfaceMode } from '../theme/themes'
import { Badge, Panel } from '../components/ui'

export function ExplorePage() {
  const { prefs } = useAppState()
  const iconVariant = prefs.themeMode === 'program' ? 'brush' : 'neon3d'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-primary">Sports directory</h1>
        <p className="text-sm text-ink/60">
          Browse supported sport families, live coverage status, and source-readiness notes as new
          leagues come online.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sports.map((sport) => {
          const theme = withSurfaceMode(getTheme(sport.key), prefs.themeMode)
          return (
            <Link key={sport.key} to={sport.key === 'custom' ? '/custom-leagues' : `/sports/${sport.key}`}>
              <Panel
                className="group h-full transition-shadow hover:shadow-md"
                style={{ borderColor: `${theme.colors.primary}33` }}
              >
                <div className="flex items-start justify-between">
                  <span
                    className="explore-sport-mark flex h-14 w-14 items-center justify-center rounded-xl"
                    style={{ '--explore-mark-primary': theme.colors.primary, '--explore-mark-accent': theme.colors.accent } as CSSProperties}
                  >
                    <SportAssetIcon sportKey={sport.key} size="sm" variant={iconVariant} />
                  </span>
                  {sport.enabled ? (
                    <Badge tone="secondary">Live</Badge>
                  ) : (
                    <Badge tone="muted">Coming soon</Badge>
                  )}
                </div>
                <h2 className="mt-3 text-lg font-bold" style={{ color: theme.colors.primary }}>
                  {sport.label}
                  <span className="ml-2 align-middle text-xs font-semibold uppercase tracking-wide text-ink/40">
                    {sport.flagshipLeague}
                  </span>
                </h2>
                <p className="mt-1 text-sm text-ink/60">{sport.tagline}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Open <ArrowRight size={14} />
                </span>
              </Panel>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
