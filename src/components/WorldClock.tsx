import { useAppState } from '../app/state-context'
import { useNow } from '../lib/useNow'

// World clock strip (adopted from the poster-team entry): four cities, the user's own
// timezone first. Says "local time is the product" without a sentence of copy.

const WORLD_CITIES = [
  { label: 'London', zone: 'Europe/London' },
  { label: 'Tokyo', zone: 'Asia/Tokyo' },
  { label: 'Sydney', zone: 'Australia/Sydney' },
]

const CLOCK_COLORS = ['text-primary', 'text-neon-cyan', 'text-neon-magenta', 'text-export']

export function WorldClock() {
  const { prefs } = useAppState()
  const nowMs = useNow()

  const slots = [
    { label: prefs.city || 'You', zone: prefs.timezone },
    ...WORLD_CITIES.filter((city) => city.zone !== prefs.timezone),
  ].slice(0, 4)

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border-2 border-primary/20 bg-primary/15 sm:grid-cols-4">
      {slots.map((slot, index) => {
        const time = new Intl.DateTimeFormat(prefs.locale || undefined, {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: slot.zone,
          ...(prefs.hour12 !== null ? { hour12: prefs.hour12 } : {}),
        }).format(new Date(nowMs))
        return (
          <div key={slot.zone + slot.label} className="bg-surface px-4 py-2.5 text-center">
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink/45">{slot.label}</p>
            <p className={`font-head text-lg leading-tight ${CLOCK_COLORS[index % CLOCK_COLORS.length]}`}>{time}</p>
          </div>
        )
      })}
    </div>
  )
}
