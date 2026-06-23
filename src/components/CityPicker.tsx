import { Clock3, Globe2 } from 'lucide-react'
import { useAppState } from '../app/state-context'
import { TimezonePicker } from './TimezonePicker'
import { localeOptions, normalizeLocale, regionOptions } from '../lib/i18n'
import { zoneCityLabel } from '../lib/timezones'

export function CityPicker() {
  const { prefs, setPrefs } = useAppState()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TimezonePicker
        className="w-56"
        zone={prefs.timezone}
        onSelect={(zone) => setPrefs({ ...prefs, timezone: zone, city: zoneCityLabel(zone) })}
      />

      <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-surface px-3 py-2">
        <Globe2 size={16} className="text-primary" />
        <select
          value={prefs.regionCode}
          onChange={(event) => setPrefs({ ...prefs, regionCode: event.target.value, broadcastRegion: event.target.value })}
          aria-label="Region"
          className="bg-transparent text-sm font-medium outline-none"
        >
          {regionOptions.map((region) => (
            <option key={region.code} value={region.code}>
              {region.code}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-surface px-3 py-2">
        <Globe2 size={16} className="text-primary" />
        <select
          value={normalizeLocale(prefs.locale)}
          onChange={(event) => setPrefs({ ...prefs, locale: event.target.value })}
          aria-label="Language"
          className="bg-transparent text-sm font-medium outline-none"
        >
          {localeOptions.map((locale) => (
            <option key={locale.code} value={locale.code}>
              {locale.shortLabel}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-surface px-3 py-2">
        <Clock3 size={16} className="text-primary" />
        <select
          value={prefs.hour12 === null ? 'auto' : prefs.hour12 ? '12' : '24'}
          onChange={(event) => {
            const value = event.target.value
            setPrefs({ ...prefs, hour12: value === 'auto' ? null : value === '12' })
          }}
          aria-label="Time format"
          className="bg-transparent text-sm font-medium outline-none"
        >
          <option value="auto">Auto</option>
          <option value="12">12h</option>
          <option value="24">24h</option>
        </select>
      </label>
    </div>
  )
}
