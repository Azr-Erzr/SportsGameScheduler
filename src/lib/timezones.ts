// Timezone catalog backed by the browser's own IANA database.
//
// The old approach hardcoded ~10 cities and free-typed the rest: typing "Calgary" matched nothing,
// so the label changed but the timezone silently stayed wrong. Instead we read the full IANA zone
// list from Intl.supportedValuesOf('timeZone') (every zone the runtime actually knows), give each a
// friendly label + live offset, and add a curated city→zone alias map so searching a metro that
// isn't itself an IANA id (Calgary → America/Edmonton) still resolves correctly.

export type TimeZoneOption = {
  zone: string
  /** Friendly primary label, e.g. "Edmonton" or "New York". */
  label: string
  /** Region prefix, e.g. "America", "Europe". */
  region: string
  /** Searchable alias cities that resolve to this zone (e.g. Calgary → America/Edmonton). */
  aliases: string[]
}

// Major metros that are NOT their own IANA zone id but that users will type. Keep this practical,
// not exhaustive — the full IANA list still covers everything else by its own city name.
const CITY_ALIASES: Record<string, string> = {
  Calgary: 'America/Edmonton',
  Ottawa: 'America/Toronto',
  Montreal: 'America/Toronto',
  Quebec: 'America/Toronto',
  Boston: 'America/New_York',
  Philadelphia: 'America/New_York',
  Atlanta: 'America/New_York',
  Miami: 'America/New_York',
  Washington: 'America/New_York',
  Houston: 'America/Chicago',
  Dallas: 'America/Chicago',
  Austin: 'America/Chicago',
  Minneapolis: 'America/Chicago',
  'San Francisco': 'America/Los_Angeles',
  'San Diego': 'America/Los_Angeles',
  'San Jose': 'America/Los_Angeles',
  Seattle: 'America/Los_Angeles',
  'Las Vegas': 'America/Los_Angeles',
  Portland: 'America/Los_Angeles',
  Manchester: 'Europe/London',
  Birmingham: 'Europe/London',
  Glasgow: 'Europe/London',
  Liverpool: 'Europe/London',
  Munich: 'Europe/Berlin',
  Frankfurt: 'Europe/Berlin',
  Hamburg: 'Europe/Berlin',
  Cologne: 'Europe/Berlin',
  Barcelona: 'Europe/Madrid',
  Valencia: 'Europe/Madrid',
  Seville: 'Europe/Madrid',
  Milan: 'Europe/Rome',
  Naples: 'Europe/Rome',
  Turin: 'Europe/Rome',
  Lyon: 'Europe/Paris',
  Marseille: 'Europe/Paris',
  Munster: 'Europe/Berlin',
  Rotterdam: 'Europe/Amsterdam',
  Porto: 'Europe/Lisbon',
  Manchester_GB: 'Europe/London',
  Bengaluru: 'Asia/Kolkata',
  Bangalore: 'Asia/Kolkata',
  Mumbai: 'Asia/Kolkata',
  Delhi: 'Asia/Kolkata',
  'New Delhi': 'Asia/Kolkata',
  Chennai: 'Asia/Kolkata',
  Hyderabad: 'Asia/Kolkata',
  Osaka: 'Asia/Tokyo',
  Kyoto: 'Asia/Tokyo',
  Melbourne: 'Australia/Melbourne',
  Brisbane: 'Australia/Brisbane',
  Perth: 'Australia/Perth',
  Auckland: 'Pacific/Auckland',
  Guadalajara: 'America/Mexico_City',
  Monterrey: 'America/Monterrey',
  'Rio de Janeiro': 'America/Sao_Paulo',
  'Sao Paulo': 'America/Sao_Paulo',
  Brasilia: 'America/Sao_Paulo',
  Cordoba: 'America/Argentina/Buenos_Aires',
  Rosario: 'America/Argentina/Buenos_Aires',
  'Cape Town': 'Africa/Johannesburg',
  Durban: 'Africa/Johannesburg',
  'Abu Dhabi': 'Asia/Dubai',
}

// Reasonable fallback for older runtimes without Intl.supportedValuesOf.
const FALLBACK_ZONES = [
  'America/Los_Angeles', 'America/Denver', 'America/Edmonton', 'America/Chicago', 'America/Mexico_City',
  'America/New_York', 'America/Toronto', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Lisbon',
  'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Hong_Kong',
  'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'UTC',
]

function rawZones(): string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    if (typeof supported === 'function') {
      const zones = supported('timeZone')
      if (Array.isArray(zones) && zones.length) return zones
    }
  } catch {
    /* fall through */
  }
  return FALLBACK_ZONES
}

export function zoneCityLabel(zone: string): string {
  const segment = zone.split('/').pop() ?? zone
  return segment.replace(/_/g, ' ')
}

export function zoneRegion(zone: string): string {
  return (zone.split('/')[0] ?? '').replace(/_/g, ' ')
}

let cache: TimeZoneOption[] | null = null

export function timeZoneOptions(): TimeZoneOption[] {
  if (cache) return cache
  const aliasesByZone = new Map<string, string[]>()
  for (const [city, zone] of Object.entries(CITY_ALIASES)) {
    const display = city.replace(/_GB$/, '')
    aliasesByZone.set(zone, [...(aliasesByZone.get(zone) ?? []), display])
  }
  cache = rawZones()
    .map((zone) => ({
      zone,
      label: zoneCityLabel(zone),
      region: zoneRegion(zone),
      aliases: aliasesByZone.get(zone) ?? [],
    }))
    .sort((a, b) => a.zone.localeCompare(b.zone))
  return cache
}

// Current GMT offset for a zone, e.g. "GMT-6" / "GMT+5:30". Used to make the picker legible.
export function zoneOffsetLabel(zone: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(at)
    const name = parts.find((p) => p.type === 'timeZoneName')?.value
    if (name) return name.replace('GMT', 'GMT')
  } catch {
    /* ignore */
  }
  return ''
}

// Resolve a user-typed string (a zone id, a city label, or an alias) to a canonical IANA zone.
export function resolveZone(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const direct = CITY_ALIASES[trimmed]
  if (direct) return direct
  const lower = trimmed.toLowerCase()
  const options = timeZoneOptions()
  // Exact zone id.
  const byZone = options.find((o) => o.zone.toLowerCase() === lower)
  if (byZone) return byZone.zone
  // Exact city label or alias.
  const byLabel = options.find(
    (o) => o.label.toLowerCase() === lower || o.aliases.some((a) => a.toLowerCase() === lower),
  )
  return byLabel?.zone ?? null
}

export function searchZones(query: string, limit = 8): TimeZoneOption[] {
  const q = query.trim().toLowerCase()
  const options = timeZoneOptions()
  if (!q) return []
  const scored: Array<{ option: TimeZoneOption; score: number }> = []
  for (const option of options) {
    const label = option.label.toLowerCase()
    const zone = option.zone.toLowerCase()
    const aliasHit = option.aliases.find((a) => a.toLowerCase().includes(q))
    let score = -1
    if (label === q || aliasHit?.toLowerCase() === q) score = 0
    else if (label.startsWith(q) || aliasHit?.toLowerCase().startsWith(q)) score = 1
    else if (label.includes(q) || aliasHit) score = 2
    else if (zone.includes(q)) score = 3
    if (score >= 0) scored.push({ option, score })
  }
  return scored
    .sort((a, b) => a.score - b.score || a.option.label.localeCompare(b.option.label))
    .slice(0, limit)
    .map((s) => s.option)
}
