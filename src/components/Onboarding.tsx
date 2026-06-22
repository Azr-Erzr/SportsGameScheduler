import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Clock3, Globe2, MapPin, X } from 'lucide-react'
import { useAppState } from '../app/state-context'
import { Button } from './ui'
import { sports } from '../domain/sports'
import { cityLabelFor, cityOptions } from '../lib/cities'
import { localeOptions, normalizeLocale, regionOptions } from '../lib/i18n'
import { markOnboarded } from '../lib/onboarding'

// First-run flow. A new visitor lands on a World-Cup-heavy home with no idea the app spans every
// sport; this 2-step sheet pulls their interests forward (writing sport follows) and confirms the
// timezone everything renders in. Activation step, not a wall — "Skip" is always available.

export function Onboarding({ onClose }: { onClose: () => void }) {
  const { prefs, setPrefs, follows, toggleFollow } = useAppState()
  const navigate = useNavigate()
  const [step, setStep] = useState<0 | 1>(0)

  // Sport families a new user can recognize. "Other Sports" (custom) is excluded — it's a route,
  // not an interest. We persist each pick as a sport follow so it merges into the account on sign-in.
  const pickable = useMemo(() => sports.filter((s) => s.enabled && s.key !== 'custom'), [])
  const followedSportIds = useMemo(
    () => new Set(follows.filter((f) => f.targetType === 'sport').map((f) => f.targetId)),
    [follows],
  )

  function toggleSport(key: string) {
    toggleFollow({ targetType: 'sport', targetId: key, intent: 'watch' })
  }

  function finish() {
    markOnboarded()
    onClose()
    navigate(followedSportIds.size > 0 ? '/my-schedule' : '/explore')
  }

  function skip() {
    markOnboarded()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Silbo Sports"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-void/70 p-3 sm:items-center"
    >
      <div className="relative w-full max-w-lg rounded-card border border-primary/20 bg-surface p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:p-6">
        <button
          type="button"
          onClick={skip}
          aria-label="Skip setup"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <X size={18} />
        </button>

        <div className="mb-4 flex items-center gap-2">
          <span className={`h-1.5 w-8 rounded-full ${step === 0 ? 'bg-primary' : 'bg-primary/30'}`} />
          <span className={`h-1.5 w-8 rounded-full ${step === 1 ? 'bg-primary' : 'bg-primary/30'}`} />
        </div>

        {step === 0 ? (
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
                    <span className="min-w-0 truncate">{sport.label}</span>
                    {active && <Check size={15} className="ml-auto shrink-0" />}
                  </button>
                )
              })}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <button type="button" onClick={skip} className="text-sm font-medium text-ink/50 hover:text-ink/80">
                Skip
              </button>
              <Button onClick={() => setStep(1)}>
                {followedSportIds.size > 0 ? `Next (${followedSportIds.size})` : 'Next'} <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="font-display text-2xl tracking-wide text-ink">Confirm your timezone</h2>
            <p className="mt-1 text-sm text-ink/60">
              Every time on Silbo is shown in your local zone. We guessed{' '}
              <span className="font-semibold text-ink/80">{cityLabelFor(prefs.timezone, prefs.city)}</span> — adjust if needed.
            </p>

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-page/40 px-3 py-2.5">
                <MapPin size={16} className="text-primary" />
                <input
                  value={prefs.city}
                  list="onboard-cities"
                  onChange={(e) => {
                    const option = cityOptions.find((c) => c.label === e.target.value)
                    setPrefs({ ...prefs, city: e.target.value, timezone: option ? option.zone : prefs.timezone })
                  }}
                  placeholder={cityLabelFor(prefs.timezone, prefs.city)}
                  aria-label="City"
                  className="w-full bg-transparent text-sm font-medium outline-none"
                />
              </label>
              <datalist id="onboard-cities">
                {cityOptions.map((c) => (
                  <option key={c.zone} value={c.label} />
                ))}
              </datalist>

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

            <div className="mt-5 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(0)} className="text-sm font-medium text-ink/50 hover:text-ink/80">
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
