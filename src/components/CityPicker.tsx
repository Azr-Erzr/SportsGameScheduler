import { Clock3, Globe2 } from 'lucide-react'
import { useAppState } from '../app/state-context'
import { TimezonePicker } from './TimezonePicker'
import { localeOptions, normalizeLocale, regionOptions } from '../lib/i18n'
import { zoneCityLabel } from '../lib/timezones'

export function CityPicker({ compact = false }: { compact?: boolean }) {
  const { prefs, setPrefs } = useAppState()
  const controlClass = compact
    ? 'flex min-w-0 items-center gap-1.5 rounded-lg border border-primary/20 bg-surface px-2.5 py-2'
    : 'flex items-center gap-2 rounded-lg border border-primary/20 bg-surface px-3 py-2'

  return (
    <div className={compact ? 'grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center' : 'flex flex-wrap items-center gap-2'}>
      <TimezonePicker
        className={compact ? 'col-span-2 w-full sm:w-56' : 'w-56'}
        zone={prefs.timezone}
        onSelect={(zone) => setPrefs({ ...prefs, timezone: zone, city: zoneCityLabel(zone) })}
      />

      <label className={controlClass}>
        <Globe2 size={compact ? 15 : 16} className="shrink-0 text-primary" />
        <select
          value={prefs.regionCode}
          onChange={(event) => setPrefs({ ...prefs, regionCode: event.target.value, broadcastRegion: event.target.value })}
          aria-label="Region"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
        >
          {regionOptions.map((region) => (
            <option key={region.code} value={region.code}>
              {region.code}
            </option>
          ))}
        </select>
      </label>

      <label className={controlClass}>
        <Globe2 size={compact ? 15 : 16} className="shrink-0 text-primary" />
        <select
          value={normalizeLocale(prefs.locale)}
          onChange={(event) => setPrefs({ ...prefs, locale: event.target.value })}
          aria-label="Language"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
        >
          {localeOptions.map((locale) => (
            <option key={locale.code} value={locale.code}>
              {locale.shortLabel}
            </option>
          ))}
        </select>
      </label>

      <label className={controlClass}>
        <Clock3 size={compact ? 15 : 16} className="shrink-0 text-primary" />
        <select
          value={prefs.hour12 === null ? 'auto' : prefs.hour12 ? '12' : '24'}
          onChange={(event) => {
            const value = event.target.value
            setPrefs({ ...prefs, hour12: value === 'auto' ? null : value === '12' })
          }}
          aria-label="Time format"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
        >
          <option value="auto">Auto</option>
          <option value="12">12h</option>
          <option value="24">24h</option>
        </select>
      </label>
    </div>
  )
}
