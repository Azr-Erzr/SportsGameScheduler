import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Clock3, Globe2, X } from 'lucide-react'
import { useAppState } from '../app/state-context'
import { Button } from './ui'
import { TimezonePicker } from './TimezonePicker'
import { getSport, sports } from '../domain/sports'
import { useTopLeaguesForSports } from '../data/onboardingLeagues'
import { displaySportLabel, localeOptions, normalizeLocale, regionOptions } from '../lib/i18n'
import { isSupabaseConfigured } from '../lib/supabase'
import { zoneCityLabel, zoneOffsetLabel } from '../lib/timezones'
import { markOnboarded } from '../lib/onboarding'

// First-run flow (3 steps): pick sports → follow a few popular leagues (the part that actually
// fills the schedule, since league follows carry real ids and sync) → confirm timezone. Activation
// step, not a wall — "Skip" and a backdrop click both exit and count as done.

type Step = 0 | 1 | 2

export function Onboarding({ onClose }: { onClose: () => void }) {
  const { prefs, setPrefs, follows, toggleFollow } = useAppState()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(0)

  // Sport families a new user can recognize. "Other Sports" (custom) is excluded — it's a route,
  // not an interest. We persist each pick as a sport follow so it merges into the account on sign-in.
  const pickable = useMemo(() => sports.filter((s) => s.enabled && s.key !== 'custom'), [])
  const followedSportIds = useMemo(
    () => new Set(follows.filter((f) => f.targetType === 'sport').map((f) => f.targetId)),
    [follows],
  )
  const followedLeagueIds = useMemo(
    () => new Set(follows.filter((f) => f.targetType === 'league').map((f) => f.targetId)),
    [follows],
  )

  // Map picked route keys → canonical sport keys (the DB taxonomy) for the leagues lookup.
  const selectedCanonical = useMemo(() => {
    const set = new Set<string>()
    for (const routeKey of followedSportIds) {
      const sport = getSport(routeKey)
      if (sport) set.add(sport.canonicalSportKey)
    }
    return [...set]
  }, [followedSportIds])
  const sportLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const routeKey of followedSportIds) {
      const sport = getSport(routeKey)
      if (sport) map[sport.canonicalSportKey] = sport.label
    }
    return map
  }, [followedSportIds])

  const leaguesEnabled = isSupabaseConfigured && selectedCanonical.length > 0
  const { groups, loading: leaguesLoading } = useTopLeaguesForSports(selectedCanonical, sportLabels, leaguesEnabled)
  const hasLeaguesStep = leaguesEnabled

  function toggleSport(key: string) {
    toggleFollow({ targetType: 'sport', targetId: key, intent: 'watch' })
  }
  function toggleLeague(id: string) {
    toggleFollow({ targetType: 'league', targetId: id, intent: 'watch' })
  }

  function finish() {
    markOnboarded()
    onClose()
    const hasPicks = followedSportIds.size > 0 || followedLeagueIds.size > 0
    navigate(hasPicks ? '/my-schedule' : '/explore')
  }
  function skip() {
    markOnboarded()
    onClose()
  }

  const dots: Step[] = hasLeaguesStep ? [0, 1, 2] : [0, 2]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Silbo Sports"
      onMouseDown={(e) => {
        // Click on the backdrop (not the card) dismisses — and counts as onboarded, so it won't re-open.
        if (e.target === e.currentTarget) skip()
      }}
      className="silbo-modal-backdrop fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center"
    >
      <div className="silbo-modal-panel relative w-full max-w-lg rounded-card border border-primary/20 bg-surface p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:p-6">
        <button
          type="button"
          onClick={skip}
          aria-label="Skip setup"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <X size={18} />
        </button>

        <div className="mb-4 flex items-center gap-2">
          {dots.map((d) => (
            <span key={d} className={`h-1.5 w-8 rounded-full ${step === d ? 'bg-primary' : 'bg-primary/30'}`} />
          ))}
        </div>

        {step === 0 && (
          <div>
            <h2 className="font-display text-2xl tracking-wide text-ink">What do you follow?</h2>
            <p className="mt-1 text-sm text-ink/60">
              Pick the sports you care about. Silbo spans all of them — not just the World Cup. You can change this anytime.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {pickable.map((sport) => {
                const Icon = sport.icon
                const active = followedSportIds.has(sport.key)
                return (
                  <button
                    key={sport.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSport(sport.key)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                      active
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-primary/20 text-ink/70 hover:border-primary/40 hover:bg-primary/5'
                    }`}
                  >
                    <Icon size={17} className="shrink-0" />
                    <span className="min-w-0 truncate">
                      {displaySportLabel(sport.canonicalSportKey, sport.label, prefs.locale, prefs.regionCode)}
                    </span>
                    {active && <Check size={15} className="ml-auto shrink-0" />}
                  </button>
                )
              })}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <button type="button" onClick={skip} className="text-sm font-medium text-ink/50 hover:text-ink/80">
                Skip
              </button>
              <Button onClick={() => setStep(hasLeaguesStep ? 1 : 2)}>
                {followedSportIds.size > 0 ? `Next (${followedSportIds.size})` : 'Next'} <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-display text-2xl tracking-wide text-ink">Follow a few leagues</h2>
            <p className="mt-1 text-sm text-ink/60">
              Following a league fills your schedule with its games. Pick any to start — you can add teams and more on each
              sport&apos;s page later.
            </p>

            <div className="mt-4 max-h-[320px] space-y-4 overflow-y-auto pr-1">
              {leaguesLoading ? (
                <p className="board-label py-6 text-center text-ink/50">Finding popular leagues…</p>
              ) : groups.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink/55">
                  We&apos;ll set you up on each sport&apos;s page — open one to follow its leagues and teams.
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.sportKey}>
                    <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">{group.sportLabel}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {group.leagues.map((league) => {
                        const active = followedLeagueIds.has(league.id)
                        return (
                          <button
                            key={league.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleLeague(league.id)}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                              active
                                ? 'border-primary bg-primary/15 text-primary'
                                : 'border-primary/20 text-ink/70 hover:border-primary/40 hover:bg-primary/5'
                            }`}
                          >
                            <span className="min-w-0 truncate">{league.name}</span>
                            {active && <Check size={15} className="ml-auto shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(0)} className="text-sm font-medium text-ink/50 hover:text-ink/80">
                Back
              </button>
              <Button onClick={() => setStep(2)}>
                {followedLeagueIds.size > 0 ? `Next (${followedLeagueIds.size})` : 'Next'} <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-display text-2xl tracking-wide text-ink">Confirm your timezone</h2>
            <p className="mt-1 text-sm text-ink/60">
              Every time on Silbo shows in this zone. We detected{' '}
              <span className="font-semibold text-ink/80">{zoneCityLabel(prefs.timezone)}</span>
              {zoneOffsetLabel(prefs.timezone) ? ` (${zoneOffsetLabel(prefs.timezone)})` : ''} — search to change it.
            </p>

            <div className="mt-4 space-y-3">
              <TimezonePicker
                zone={prefs.timezone}
                onSelect={(zone) => setPrefs({ ...prefs, timezone: zone, city: zoneCityLabel(zone) })}
              />

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-page/40 px-3 py-2.5">
                  <Globe2 size={16} className="text-primary" />
                  <select
                    value={prefs.regionCode}
                    onChange={(e) => setPrefs({ ...prefs, regionCode: e.target.value, broadcastRegion: e.target.value })}
                    aria-label="Region"
                    className="w-full bg-transparent text-sm font-medium outline-none"
                  >
                    {regionOptions.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-page/40 px-3 py-2.5">
                  <Clock3 size={16} className="text-primary" />
                  <select
                    value={normalizeLocale(prefs.locale)}
                    onChange={(e) => setPrefs({ ...prefs, locale: e.target.value })}
                    aria-label="Language"
                    className="w-full bg-transparent text-sm font-medium outline-none"
                  >
                    {localeOptions.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <p className="mt-4 rounded-lg bg-primary/5 px-3 py-2 text-xs leading-relaxed text-ink/60">
              You can keep building your schedule on each sport&apos;s page, then save or export it anytime from the{' '}
              <span className="font-semibold text-ink/75">My Schedule</span> tab. Timezone is adjustable there and on Exports too.
            </p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(hasLeaguesStep ? 1 : 0)}
                className="text-sm font-medium text-ink/50 hover:text-ink/80"
              >
                Back
              </button>
              <Button onClick={finish}>
                <Check size={15} /> Start
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
