// Local persistence layer, deliberately shaped like the future Supabase API surface.
//
// Until the backend is connected, follows, preferences, calendar feeds, and custom leagues
// live in localStorage. Each accessor mirrors the table it will eventually read/write
// (user_follows, profiles, calendar_feeds, custom_leagues/custom_teams/events), so swapping
// this module's internals for supabase-js calls later does not ripple through the UI.
// On sign-up, anything stored here is merged into the user's account (Objective 14.2).

export type FollowTargetType = 'sport' | 'league' | 'team' | 'competitor' | 'custom_league'

export type Follow = {
  targetType: FollowTargetType
  targetId: string
  intent: 'watch' | 'attend' | 'track'
}

export type ThemePreference = 'system' | 'broadcast' | 'program'
export type SurfaceMode = Exclude<ThemePreference, 'system'>

export type Preferences = {
  timezone: string
  city: string
  hour12: boolean | null
  locale: string
  regionCode: string
  broadcastRegion: string
  themeMode: ThemePreference
}

export type CalendarFeed = {
  id: string
  token: string
  name: string
  timezone: string
  filters: {
    teams?: string[]
    sportKey?: string
    leagueIds?: string[]
    competitorIds?: string[]
    reminderMinutes?: number[]
  }
  includePlaceholders: boolean
  includeBroadcasts: boolean
  isActive: boolean
  createdAt: string
}

export type CustomTeam = {
  id: string
  name: string
  color: string
}

export type CustomEvent = {
  id: string
  title: string
  startsAt: string
  venue: string
  opponent?: string
  arriveEarlyMinutes?: number
  uniformColor?: string
  notes?: string
  status: 'scheduled' | 'cancelled' | 'postponed'
}

export type CustomLeague = {
  id: string
  name: string
  sportKey: string
  timezone: string
  location: string
  publicToken: string
  shareEnabled: boolean
  includeNotesInShare: boolean
  teams: CustomTeam[]
  events: CustomEvent[]
  createdAt: string
}

const KEYS = {
  follows: 'mp.follows',
  prefs: 'mp.prefs',
  feeds: 'mp.feeds',
  customLeagues: 'mp.customLeagues',
  savedMatches: 'mp.savedMatches',
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function newId() {
  return crypto.randomUUID()
}

export function newToken() {
  // Unguessable share token; mirrors the backend's tokenized public URLs.
  return crypto.randomUUID().replace(/-/g, '')
}

// --- follows ---------------------------------------------------------------

export function getFollows(): Follow[] {
  return read<Follow[]>(KEYS.follows, [])
}

export function saveFollows(follows: Follow[]) {
  write(KEYS.follows, follows)
}

export function toggleFollow(follow: Follow): Follow[] {
  const follows = getFollows()
  const exists = follows.some(
    (f) => f.targetType === follow.targetType && f.targetId === follow.targetId && f.intent === follow.intent,
  )
  const next = exists
    ? follows.filter(
        (f) => !(f.targetType === follow.targetType && f.targetId === follow.targetId && f.intent === follow.intent),
      )
    : [...follows, follow]
  saveFollows(next)
  return next
}

// --- saved matches ---------------------------------------------------------
// World Cup matches are saved by key (date-team1-team2) so "Add to schedule" adds the single match
// to My Schedule (it's reconstructed from the full match list) instead of forcing a file download.

export function getSavedMatchKeys(): string[] {
  return read<string[]>(KEYS.savedMatches, [])
}

export function isMatchSaved(key: string): boolean {
  return getSavedMatchKeys().includes(key)
}

export function toggleSavedMatch(key: string): string[] {
  const saved = getSavedMatchKeys()
  const next = saved.includes(key) ? saved.filter((k) => k !== key) : [...saved, key]
  write(KEYS.savedMatches, next)
  return next
}

// --- preferences -----------------------------------------------------------

export function getPreferences(): Preferences {
  const guessedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto'
  const guessedLocale = navigator.language || 'en-US'
  const guessedRegion = guessedLocale.split('-')[1]?.toUpperCase() || 'US'
  return {
    timezone: guessedZone,
    city: '',
    hour12: null,
    locale: guessedLocale,
    regionCode: guessedRegion,
    broadcastRegion: guessedRegion,
    // New visitors follow the operating-system preference. `program` is the safe fallback
    // when matchMedia is unavailable; explicit light/dark choices continue to be persisted.
    themeMode: 'system',
    ...read<Partial<Preferences>>(KEYS.prefs, {}),
  }
}

export function getSystemSurfaceMode(): SurfaceMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'program'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'broadcast' : 'program'
}

export function savePreferences(prefs: Preferences) {
  write(KEYS.prefs, prefs)
}

// --- calendar feeds ----------------------------------------------------------

export function getFeeds(): CalendarFeed[] {
  return read<CalendarFeed[]>(KEYS.feeds, [])
}

export function saveFeeds(feeds: CalendarFeed[]) {
  write(KEYS.feeds, feeds)
}

// --- custom leagues ----------------------------------------------------------

export function getCustomLeagues(): CustomLeague[] {
  return read<CustomLeague[]>(KEYS.customLeagues, [])
}

export function saveCustomLeagues(leagues: CustomLeague[]) {
  write(KEYS.customLeagues, leagues)
}

export function getCustomLeagueByToken(token: string): CustomLeague | undefined {
  return getCustomLeagues().find((league) => league.publicToken === token && league.shareEnabled !== false)
}

export function upsertCustomLeague(league: CustomLeague) {
  const leagues = getCustomLeagues()
  const index = leagues.findIndex((item) => item.id === league.id)
  if (index >= 0) {
    leagues[index] = league
  } else {
    leagues.push(league)
  }
  saveCustomLeagues(leagues)
}

export function deleteCustomLeague(id: string) {
  saveCustomLeagues(getCustomLeagues().filter((league) => league.id !== id))
}
