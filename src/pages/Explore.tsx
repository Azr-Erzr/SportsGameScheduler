import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { sports } from '../domain/sports'
import { getTheme } from '../theme/themes'
import { Badge, Panel } from '../components/ui'

export function ExplorePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-primary">Silbo Picks</h1>
        <p className="text-sm text-ink/60">
          One schedule across every sport you follow. Soccer is live now; more sports light up as data
          sources come online.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sports.map((sport) => {
          const theme = getTheme(sport.key)
          const SportIcon = sport.icon
          return (
            <Link key={sport.key} to={sport.key === 'custom' ? '/custom-leagues' : `/sports/${sport.key}`}>
              <Panel
                className="group h-full transition-shadow hover:shadow-md"
                style={{ borderColor: `${theme.colors.primary}33` }}
              >
                <div className="flex items-start justify-between">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-void"
                    style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})` }}
                  >
                    <SportIcon size={22} strokeWidth={2.2} />
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
