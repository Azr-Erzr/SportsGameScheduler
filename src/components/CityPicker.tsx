import { Clock3, Globe2, MapPin } from 'lucide-react'
import { useAppState } from '../app/state-context'
import { cityLabelFor, cityOptions } from '../lib/cities'
import { localeOptions, normalizeLocale, regionOptions } from '../lib/i18n'

export function CityPicker() {
  const { prefs, setPrefs } = useAppState()

  function selectCity(value: string) {
    const option = cityOptions.find((item) => item.label === value)
    setPrefs({ ...prefs, city: value, timezone: option ? option.zone : prefs.timezone })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-surface px-3 py-2">
        <MapPin size={16} className="text-primary" />
        <input
          value={prefs.city}
          list="mp-cities"
          onChange={(event) => selectCity(event.target.value)}
          placeholder={cityLabelFor(prefs.timezone, prefs.city)}
          aria-label="City"
          className="w-32 bg-transparent text-sm font-medium outline-none"
        />
      </label>
      <datalist id="mp-cities">
        {cityOptions.map((option) => (
          <option key={option.zone} value={option.label} />
        ))}
      </datalist>

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
